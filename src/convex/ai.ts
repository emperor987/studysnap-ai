"use node";

/**
 * StudySnap — couche IA, agnostique du fournisseur.
 *
 * Appels effectués uniquement côté serveur (actions Convex) : aucune clé
 * n'est jamais exposée au client. Compatible avec toute API compatible
 * OpenAI — dont NVIDIA NIM (integrate.api.nvidia.com), qui accepte le même
 * format de requête mais attend les images en data URI base64 (il ne peut
 * pas aller chercher une URL arbitraire).
 *
 * Variables d'environnement (à renseigner dans l'UI Keys de la plateforme) :
 *   AI_API_KEY   — clé du fournisseur (ex: clé NVIDIA NIM de build.nvidia.com)
 *   AI_BASE_URL  — base de l'API (défaut https://api.openai.com/v1 ;
 *                  NVIDIA NIM : https://integrate.api.nvidia.com/v1)
 *   AI_MODEL     — modèle principal / raisonnement (défaut gpt-4.1-mini ;
 *                  NVIDIA NIM : nvidia/nemotron-3-nano-omni-30b-a3b-reasoning)
 *   AI_MODEL_FAST— modèle rapide dédié à l'OCR des photos, étape 1 du
 *                  pipeline (ex: nvidia/nemotron-nano-12b-v2-vl). Sans lui,
 *                  le comportement historique est conservé (appel vision
 *                  unique avec AI_MODEL).
 *   AI_MAX_TOKENS— limite de génération (défaut 4096)
 *
 * Sans clé configurée, l'app fonctionne en mode démo avec des contenus
 * réalistes (voir demoData.ts). En cas de limite de débit (HTTP 429), une
 * erreur dédiée est levée et affichée côté client.
 */

import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { action, type ActionCtx } from "./_generated/server";
import {
  demoAnalysis,
  demoQuiz,
  demoSheet,
  hashSeed,
  type DemoAnalysis,
  type DemoSheet,
} from "./demoData";

export const AI_MODEL_DEFAULT = "gpt-4.1-mini";
/** Message d'erreur propagé au client en cas de limite de débit du fournisseur. */
export const AI_RATE_LIMITED_MESSAGE = "AI_RATE_LIMITED";
export const AI_NOT_CONFIGURED_MESSAGE = "AI_NOT_CONFIGURED";

function aiKey(): string | undefined {
  return process.env.AI_API_KEY ?? process.env.OPENAI_API_KEY;
}

function aiBaseUrl(): string {
  const raw = process.env.AI_BASE_URL ?? "https://api.openai.com/v1";
  // Certaines saisies incluent déjà le chemin complet "/chat/completions"
  // (ex: https://integrate.api.nvidia.com/v1/chat/completions). On le
  // retire pour ne jamais concaténer le suffixe deux fois, puis on enlève
  // les slashes de fin.
  return raw
    .replace(/\/chat\/completions\/?$/i, "")
    .replace(/\/+$/, "");
}

function aiModel(): string {
  return process.env.AI_MODEL ?? AI_MODEL_DEFAULT;
}

/**
 * Modèle "rapide" dédié à l'OCR / lecture des photos (étape 1 du pipeline
 * d'analyse). Variable AI_MODEL_FAST — ex: nvidia/nemotron-nano-12b-v2-vl
 * sur NVIDIA NIM. Sans valeur, on retombe sur AI_MODEL (le modèle principal
 * lit directement les images, comportement historique).
 */
function aiFastModel(): string {
  return process.env.AI_MODEL_FAST?.trim() || aiModel();
}

function aiFastModelConfigured(): boolean {
  return Boolean(process.env.AI_MODEL_FAST?.trim());
}

function aiMaxTokens(): number {
  const raw = parseInt(process.env.AI_MAX_TOKENS ?? "4096", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 4096;
}

/** L'utilisateur courant (authentifié) ou erreur. */
async function requireUser(ctx: ActionCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Vous devez être connecté·e.");
  return userId;
}

class AiRateLimitedError extends Error {
  constructor() {
    super(AI_RATE_LIMITED_MESSAGE);
    this.name = "AiRateLimitedError";
  }
}

/**
 * Récupère l'image depuis le stockage Convex et la convertit en data URI
 * base64 — le format attendu par l'endpoint compatible OpenAI de NVIDIA NIM.
 */
async function imageAsDataUri(url: string, mime: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Image inaccessible (HTTP ${res.status})`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > 20 * 1024 * 1024) {
    throw new Error("IMAGE_TOO_LARGE");
  }
  return `data:${mime};base64,${buf.toString("base64")}`;
}

/** Extrait un objet JSON d'une réponse texte (fences markdown, prose…). */
function extractJson(text: string): Record<string, unknown> {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
    }
  }
  throw new Error("Réponse IA invalide (JSON attendu)");
}

/** Coerce une valeur en chaîne (avec repli). */
function asString(v: unknown, fallback = ""): string {
  if (typeof v === "string") return v;
  if (v === null || v === undefined) return fallback;
  return String(v);
}

/** Coerce une valeur en tableau de chaînes (accepte une chaîne multi-lignes). */
function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v.map((x) => asString(x)).filter((s) => s.length > 0);
  }
  if (typeof v === "string") {
    return v
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/** Coerce les exercices générés (objet -> { question, answer, hint }). */
function normalizeExercises(
  v: unknown,
): { question: string; answer: string; hint: string }[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => {
      const o = (x ?? {}) as Record<string, unknown>;
      return {
        question: asString(o.question),
        answer: asString(o.answer),
        hint: asString(o.hint),
      };
    })
    .filter((x) => x.question.length > 0 || x.answer.length > 0);
}

/**
 * Normalise la réponse du modèle : il ne respecte pas toujours le schéma
 * demandé (sections manquantes, tableaux en chaînes, champs omis…). On
 * force les types et on comble les manques pour que la validation du scan
 * (recordScan) ne rejette jamais la réponse.
 */
function normalizeAnalysis(parsed: Record<string, unknown>): DemoAnalysis {
  const d = (parsed.detection ?? {}) as Record<string, unknown>;
  const q = (parsed.quick ?? {}) as Record<string, unknown>;
  const e = (parsed.explain ?? {}) as Record<string, unknown>;
  const r = (parsed.revise ?? {}) as Record<string, unknown>;
  return {
    detection: {
      subject: asString(d.subject, "Mathématiques"),
      topic: asString(d.topic),
      level: asString(d.level, "seconde"),
      prompt: asString(d.prompt),
      data: asString(d.data),
      formulas: asStringArray(d.formulas),
      legible: d.legible !== false,
    },
    quick: {
      answer: asString(q.answer),
      calculation: asString(q.calculation),
      keyPoint: asString(q.keyPoint),
    },
    explain: {
      question: asString(e.question),
      importantInfo: asStringArray(e.importantInfo),
      method: asString(e.method),
      steps: asStringArray(e.steps),
      result: asString(e.result),
      commonMistake: asString(e.commonMistake),
    },
    revise: {
      lesson: asString(r.lesson),
      keyFormulas: asStringArray(r.keyFormulas),
      exercises: normalizeExercises(r.exercises),
    },
  };
}

/** Normalise le contenu d'une fiche de révision (mêmes protections). */
function normalizeSheet(
  parsed: Record<string, unknown>,
  fallbackSubject: string,
): DemoSheet {
  const c = (parsed.content ?? {}) as Record<string, unknown>;
  const concepts = Array.isArray(c.concepts)
    ? c.concepts
        .map((x) => {
          const o = (x ?? {}) as Record<string, unknown>;
          return { term: asString(o.term), definition: asString(o.definition) };
        })
        .filter((x) => x.term.length > 0 || x.definition.length > 0)
    : [];
  const formulas = Array.isArray(c.formulas)
    ? c.formulas
        .map((x) => {
          const o = (x ?? {}) as Record<string, unknown>;
          return { name: asString(o.name), formula: asString(o.formula) };
        })
        .filter((x) => x.name.length > 0 || x.formula.length > 0)
    : [];
  const example = (c.example ?? {}) as Record<string, unknown>;
  return {
    title: asString(parsed.title, "Fiche de révision"),
    subject: asString(parsed.subject, fallbackSubject),
    level: asString(parsed.level, "seconde"),
    content: {
      concepts,
      formulas,
      methods: asStringArray(c.methods),
      example: {
        question: asString(example.question),
        solution: asString(example.solution),
      },
      pitfalls: asStringArray(c.pitfalls),
      takeaways: asStringArray(c.takeaways),
    },
  };
}

interface ChatOptions {
  model?: string;
  maxTokens?: number;
  signal?: AbortSignal;
}

/**
 * Appel brut au fournisseur : renvoie le texte de la réponse.
 * Repli progressif (JSON activé/désactivé, raisonnement activé/désactivé)
 * et nouvelle tentative automatique sur échec transitoire (jamais sur 429).
 */
async function chatRaw(
  messages: { role: "system" | "user" | "assistant"; content: unknown }[],
  opts: ChatOptions & {
    attempts?: { jsonMode: boolean; thinking?: "off" | "on" }[];
  } = {},
): Promise<string> {
  const key = aiKey();
  if (!key) throw new Error(AI_NOT_CONFIGURED_MESSAGE);
  const model = opts.model ?? aiModel();
  const tokens = opts.maxTokens ?? aiMaxTokens();
  const attempts = opts.attempts ?? [{ jsonMode: false }];

  const post = async (a: { jsonMode: boolean; thinking?: "off" | "on" }) => {
    const body: Record<string, unknown> = {
      model,
      temperature: 0.4,
      max_tokens: tokens,
      messages,
    };
    if (a.jsonMode) {
      // Certains endpoints compatibles OpenAI (dont certains modèles NVIDIA
      // NIM) refusent response_format : on réessaie sans lui en cas de 400.
      body.response_format = { type: "json_object" };
    }
    if (a.thinking === "off") {
      // NVIDIA NIM — modèles reasoning (ex: nemotron-3-nano-omni…reasoning) :
      // "enable_thinking": false coupe la chaîne de raisonnement → réponse
      // directe, latence fortement réduite. Paramètre documenté par NVIDIA.
      body.chat_template_kwargs = { enable_thinking: false };
    } else if (a.thinking === "on") {
      // Certains modèles NIM (ex: nemotron-nano-12b-v2-vl) ne produisent
      // AUCUN contenu sans raisonnement : enable_thinking: true est alors
      // nécessaire pour obtenir une réponse (le texte va dans "content").
      body.chat_template_kwargs = { enable_thinking: true };
    }
    return fetch(`${aiBaseUrl()}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
      signal: opts.signal,
    });
  };

  // Repli progressif : certains endpoints refusent chat_template_kwargs
  // et/ou response_format — on retombe sur des requêtes plus simples. Une
  // réponse 200 avec content vide (bug "thinking-only" de certains endpoints
  // NIM) déclenche aussi la tentative suivante.
  const chatOnce = async (): Promise<string> => {
    let lastStatus = 0;
    let lastBody = "";
    for (const a of attempts) {
      const res = await post(a);
      if (res.status === 429) throw new AiRateLimitedError();
      if (!res.ok) {
        lastStatus = res.status;
        lastBody = (await res.text().catch(() => "")).slice(0, 300);
        continue;
      }
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = data.choices?.[0]?.message?.content ?? "";
      if (content.trim().length > 0) return content;
      lastBody = "Réponse IA vide (content vide)";
    }
    throw new Error(`Erreur IA (${lastStatus}): ${lastBody}`);
  };

  // Les endpoints gratuits (NVIDIA free tier) peuvent échouer de façon
  // transitoire (file d'attente, timeout réseau) : on retente une fois,
  // sauf en cas de 429 (limite de débit — inutile d'empirer).
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await chatOnce();
    } catch (e) {
      if (e instanceof AiRateLimitedError) throw e;
      lastError = e;
      if (attempt === 0) await new Promise((r) => setTimeout(r, 700));
    }
  }
  throw lastError;
}

/** Appel JSON (objet parsé), avec repli progressif JSON → texte brut. */
async function chatJson(
  messages: { role: "system" | "user" | "assistant"; content: unknown }[],
  signal?: AbortSignal,
  maxTokens?: number,
): Promise<Record<string, unknown>> {
  const raw = await chatRaw(messages, {
    signal,
    maxTokens,
    attempts: [
      { jsonMode: true, thinking: "off" },
      { jsonMode: true },
      { jsonMode: false },
    ],
  });
  return extractJson(raw);
}

/** Démarre un timeout court pour donner l'illusion de rapidité (2-4 s perçues). */
function minLatency(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 1400 + Math.random() * 900));
}

const SYSTEM_PROMPT = `Tu es StudySnap, un assistant pédagogique pour lycéens francophones.
Règles absolues :
1. Ne JAMAIS inventer une donnée absente sur la photo. Si un élément est illisible, dis-le dans "legibility" et demande une nouvelle photo.
2. Adapte le vocabulaire au niveau scolaire détecté (collège → très simple ; lycée → précis mais clair).
3. Sépare toujours la réponse finale et l'explication.
4. Réponds en Markdown ; utilise LaTeX entre $...$ ou $$...$$ pour les maths (ex: $x = \\frac{-b \\pm \\sqrt{\\Delta}}{2a}$).
5. Mode "quick" : réponse finale + calcul essentiel, formulation simple, sans long développement.
6. Mode "explain" : structure fixe — Ce qu'on demande / Infos importantes / Méthode / Étapes numérotées / Résultat / Erreur fréquente à éviter. Ton naturel.
7. Mode "revise" : mini-leçon sur la notion + formules clés + 3 exercices similaires générés (avec réponse et indice).
8. Privilégie la compréhension de la méthode plutôt que la réponse brute.
9. Détecte la matière ("Mathématiques", "Physique-Chimie", "Français", "SVT", "Histoire-Géo", "Anglais", "Espagnol", "NSI", "Philosophie"...) et le niveau scolaire (college, seconde, premiere, terminale, postbac).
10. Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, au format exact :
{
  "detection": {
    "subject": "string",
    "topic": "string",
    "level": "college|seconde|premiere|terminale|postbac",
    "prompt": "consigne reformulée",
    "data": "données utiles extraites",
    "formulas": ["formules utiles"],
    "legible": true,
    "legibilityNote": "string ou vide"
  },
  "quick": { "answer": "string", "calculation": "string", "keyPoint": "string" },
  "explain": {
    "question": "string", "importantInfo": ["string"], "method": "string",
    "steps": ["string"], "result": "string", "commonMistake": "string"
  },
  "revise": {
    "lesson": "string", "keyFormulas": ["string"],
    "exercises": [ { "question": "string", "answer": "string", "hint": "string" } ]
  }
}`;

const OCR_SYSTEM_PROMPT = `Tu es un moteur d'OCR pour des exercices et cours scolaires francophones (texte imprimé ou manuscrit).
Extrais de la photo TOUT le contenu utile, sans reformuler et sans résoudre l'exercice :
- l'énoncé et la consigne, mot pour mot ;
- les données chiffrées, les valeurs, les unités ;
- les formules mathématiques en LaTeX (entre $...$ ou $$...$$) ;
- les schémas/figures : décris-les brièvement entre crochets, ex : [figure : triangle ABC rectangle en A].
Si un passage est illisible, écris [illisible] à sa place.
Réponds UNIQUEMENT avec le texte extrait, sans commentaire.`;

/**
 * Étape 1 du pipeline : lecture de la photo (OCR) avec le modèle rapide
 * (AI_MODEL_FAST). Si le modèle rapide est indisponible (erreur transitoire),
 * on retente la lecture avec le modèle principal — sauf vrai 429.
 */
async function ocrImageText(
  imageParts: { type: "image_url"; image_url: { url: string } }[],
  signal?: AbortSignal,
): Promise<string> {
  const messages = [
    { role: "system" as const, content: OCR_SYSTEM_PROMPT },
    {
      role: "user" as const,
      content: [
        {
          type: "text" as const,
          text: "Voici une photo d'exercice scolaire. Extrais-en le texte intégral :",
        },
        ...imageParts,
      ],
    },
  ];
  try {
    // Modèle rapide d'abord (sans JSON : simple extraction).
    // nemotron-nano-12b-v2-vl ne répond qu'avec enable_thinking: true →
    // tentative en dernier recours dans la chaîne.
    const text = await chatRaw(messages, {
      model: aiFastModel(),
      signal,
      maxTokens: 2048,
      attempts: [
        { jsonMode: false },
        { jsonMode: false, thinking: "off" },
        { jsonMode: false, thinking: "on" },
      ],
    });
    return text.trim();
  } catch (e) {
    if (e instanceof AiRateLimitedError) throw e;
    // Modèle rapide indisponible : repli sur le modèle principal (vision).
    const text = await chatRaw(messages, {
      model: aiModel(),
      signal,
      maxTokens: 2048,
      attempts: [
        { jsonMode: false, thinking: "off" },
        { jsonMode: false },
        { jsonMode: false, thinking: "on" },
      ],
    });
    return text.trim();
  }
}

/** Résultat de l'OCR : texte extrait OU photo illisible. */
export type OcrResult =
  | { unreadable: true; note: string }
  | { fullText: string };

/** Message affiché quand la photo ne permet aucune extraction exploitable. */
export const UNREADABLE_MESSAGE =
  "Ta photo n'est pas assez lisible. Reprends-la : mieux cadrée, à plat, avec un meilleur éclairage.";

/** Texte OCR de démonstration (mode démo, aucune clé configurée). */
const DEMO_OCR_TEXT = `Exercice — Fonctions affines (niveau seconde)

On considère la fonction f définie sur R par f(x) = 2x - 3.

1. Calculer f(0), f(1) et f(-1).
2. Déterminer le coefficient directeur et l'ordonnée à l'origine de la droite représentant f.
3. Résoudre l'équation f(x) = 5.
4. Tracer la courbe représentative de f dans un repère orthonormé.`;

/**
 * Étape 1 du pipeline d'analyse : lecture de la photo (OCR) avec le modèle
 * rapide (AI_MODEL_FAST, ex: nvidia/nemotron-nano-12b-v2-vl). Si la photo
 * est illisible (texte vide ou trop court), renvoie { unreadable } — l'étape
 * 2 ne doit alors pas être appelée.
 */
export const ocrPhotos = action({
  args: {
    storageIds: v.array(v.string()),
    contentTypes: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args): Promise<OcrResult> => {
    await requireUser(ctx);

    // Mode démo : reste actif tant qu'aucune clé n'est configurée.
    if (!aiKey()) {
      await minLatency();
      return { fullText: DEMO_OCR_TEXT };
    }

    const urls = (
      await Promise.all(args.storageIds.map((id) => ctx.storage.getUrl(id)))
    ).filter((u): u is string => Boolean(u));

    // NVIDIA NIM (compatible OpenAI) attend les images en data URI base64 :
    // on récupère les octets du stockage et on les encode côté serveur.
    const imageParts = await Promise.all(
      urls.map(async (url, i) => ({
        type: "image_url" as const,
        image_url: {
          url: await imageAsDataUri(url, args.contentTypes?.[i] ?? "image/jpeg"),
        },
      })),
    );

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90000);
    try {
      const fullText = await ocrImageText(imageParts, controller.signal);
      if (fullText.length < 20) {
        return { unreadable: true, note: UNREADABLE_MESSAGE };
      }
      return { fullText };
    } finally {
      clearTimeout(timer);
    }
  },
});

/**
 * Étape 2 : génération des 3 modes (Réponse rapide / Explication / Révision)
 * à partir du texte extrait à l'étape 1 — plus aucune image à traiter,
 * donc nettement plus rapide.
 */
export const analyzeText = action({
  args: {
    text: v.string(),
    prompt: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<DemoAnalysis> => {
    const userId = await requireUser(ctx);

    // Mode démo : reste actif tant qu'aucune clé n'est configurée.
    if (!aiKey()) {
      return demoResult(hashSeed(userId, args.text, new Date().getDate()));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90000);
    try {
      // Plafond de sortie élevé : l'analyse renvoie les 3 modes à la fois,
      // un JSON tronqué rendrait la réponse inutilisable.
      const parsed = await chatJson(
        [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "Voici le texte extrait d'une photo d'exercice scolaire (OCR). " +
                  "Il peut contenir des [illisible] — ne devine jamais une donnée absente.\n\n" +
                  (args.prompt ? `Consigne complémentaire : ${args.prompt}\n\n` : "") +
                  `--- Texte de l'exercice ---\n${args.text}`,
              },
            ],
          },
        ],
        controller.signal,
        8000,
      );
      // Le modèle peut omettre des sections ou mal typer des champs : la
      // normalisation garantit que l'enregistrement du scan ne rejette
      // jamais la réponse (validation stricte côté recordScan).
      return normalizeAnalysis(parsed);
    } finally {
      clearTimeout(timer);
    }
  },
});

const SHEET_SYSTEM_PROMPT = `Tu es StudySnap, un assistant qui transforme un cours (photo ou texte) en fiche de révision pour lycéen.
Structure fixe de la fiche :
- concepts : liste de paires { term, definition } (les notions clés du chapitre)
- formulas : liste de paires { name, formula } (formules ou théorèmes, en LaTeX)
- methods : méthodes à connaître (2 à 4)
- example : un exemple type { question, solution }
- pitfalls : pièges à éviter (2 à 3)
- takeaways : l'essentiel à retenir (3 à 5 points courts)
Réponds UNIQUEMENT avec un objet JSON valide :
{ "title": "string", "subject": "string", "level": "college|seconde|premiere|terminale|postbac", "content": {
  "concepts": [{"term": "string", "definition": "string"}],
  "formulas": [{"name": "string", "formula": "string"}],
  "methods": ["string"],
  "example": {"question": "string", "solution": "string"},
  "pitfalls": ["string"],
  "takeaways": ["string"]
} }`;

/** Génère une fiche de révision depuis des photos et/ou un texte de cours. */
export const generateSheet = action({
  args: {
    storageIds: v.optional(v.array(v.string())),
    contentTypes: v.optional(v.array(v.string())),
    sourceText: v.optional(v.string()),
    subject: v.optional(v.string()),
    level: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const seed = hashSeed(userId, args.sourceText ?? "", args.storageIds?.join(",") ?? "", new Date().getDate());

    if (!aiKey()) {
      await minLatency();
      return demoSheet(seed, args.subject ?? "");
    }

    const urls = args.storageIds
      ? (
          await Promise.all(args.storageIds.map((id) => ctx.storage.getUrl(id)))
        ).filter((u): u is string => Boolean(u))
      : [];

    const imageParts = await Promise.all(
      urls.map(async (url, i) => ({
        type: "image_url" as const,
        image_url: {
          url: await imageAsDataUri(url, args.contentTypes?.[i] ?? "image/jpeg"),
        },
      })),
    );

    let parts: unknown[] = [
      {
        type: "text",
        text: `Construis une fiche de révision${
          args.subject ? ` pour la matière « ${args.subject} »` : ""
        }${
          args.level ? `, niveau ${args.level}` : ""
        }. ${args.sourceText ? `Voici le cours :\n\n${args.sourceText}` : ""}`,
      },
      ...imageParts,
    ];

    // Photos + AI_MODEL_FAST : OCR rapide d'abord, puis fiche générée à
    // partir du texte seul (bien plus rapide). En cas d'échec OCR, on garde
    // les photos (repli robuste, comportement historique).
    if (imageParts.length > 0 && aiFastModelConfigured()) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 60000);
      try {
        const ocrText = await ocrImageText(imageParts, controller.signal);
        if (ocrText.length >= 20) {
          parts = [
            {
              type: "text",
              text: `Construis une fiche de révision${
                args.subject ? ` pour la matière « ${args.subject} »` : ""
              }${
                args.level ? `, niveau ${args.level}` : ""
              }. ${args.sourceText ? `Voici le cours :\n\n${args.sourceText}` : ""}\n\n--- Contenu de la/les photo(s) (OCR) ---\n${ocrText}`,
            },
          ];
        }
      } catch {
        // OCR indisponible : les photos restent envoyées au modèle vision.
      } finally {
        clearTimeout(timer);
      }
    }

    const parsed = await chatJson([
      { role: "system", content: SHEET_SYSTEM_PROMPT },
      { role: "user", content: parts },
    ]);
    return normalizeSheet(parsed, args.subject ?? "Mathématiques");
  },
});

const QUIZ_SYSTEM_PROMPT = `Tu es StudySnap, un générateur de quiz pour lycéen francophone.
Génère exactement le nombre de questions demandé, au niveau de difficulté demandé, avec les types demandés.
Types possibles : "qcm" (4 options), "truefalse" (Vrai/Faux), "free" (réponse libre courte), "problem" (problème à résoudre, options).
Chaque question : { type, question, options (si applicable), answer (la bonne réponse, texte exact), explanation (courte, pédagogique), topic (notion testée) }.
Réponds UNIQUEMENT avec un objet JSON valide : { "title": "string", "questions": [ ... ] }`;

/** Génère un quiz paramétrable sur une matière. */
export const generateQuiz = action({
  args: {
    subject: v.string(),
    level: v.optional(v.string()),
    count: v.number(),
    difficulty: v.string(),
    types: v.array(v.union(v.literal("qcm"), v.literal("truefalse"), v.literal("free"), v.literal("problem"))),
    topic: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const count = Math.min(20, Math.max(5, args.count));
    const seed = hashSeed(userId, args.subject, count, args.difficulty, args.types.join(","), args.topic ?? "");

    if (!aiKey()) {
      await minLatency();
      return demoQuiz(seed, args.subject, count, args.difficulty, args.types);
    }

    const parsed = await chatJson([
      { role: "system", content: QUIZ_SYSTEM_PROMPT },
      {
        // Contenu au format OpenAI : un TABLEAU de parties (l'endpoint NIM
        // refuse un objet nu — 400 "ChatCompletionRequestUserMessageContent").
        role: "user",
        content: [
          {
            type: "text",
            text: `Matière : ${args.subject}${args.topic ? ` — notion : ${args.topic}` : ""}.
Niveau : ${args.level ?? "seconde"}.
Nombre de questions : ${count}.
Difficulté : ${args.difficulty}.
Types : ${args.types.join(", ")}.`,
          },
        ],
      },
    ]);
    const questions = Array.isArray(parsed.questions) ? parsed.questions : [];
    return {
      title: String(parsed.title ?? `Quiz ${args.subject}`),
      questions: questions
        .slice(0, count)
        .map((q) => {
          const o = (q ?? {}) as Record<string, unknown>;
          return {
            type: asString(o.type, "qcm"),
            question: asString(o.question),
            options: Array.isArray(o.options)
              ? (o.options as unknown[]).map((x) => asString(x)).filter(Boolean)
              : typeof o.options === "string"
                ? o.options
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                : undefined,
            answer: asString(o.answer),
            explanation: asString(o.explanation),
            topic: o.topic ? asString(o.topic) : undefined,
          };
        })
        .filter((q) => q.question.length > 0),
    };
  },
});

function demoResult(seed: number): DemoAnalysis {
  return demoAnalysis(seed);
}
