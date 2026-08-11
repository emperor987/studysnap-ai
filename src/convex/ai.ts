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
 *   AI_MODEL     — modèle (défaut gpt-4.1-mini ;
 *                  NVIDIA NIM : nvidia/nemotron-3-nano-omni-30b-a3b-reasoning)
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

async function chatJson(
  messages: { role: "system" | "user" | "assistant"; content: unknown }[],
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const key = aiKey();
  if (!key) throw new Error(AI_NOT_CONFIGURED_MESSAGE);

  const post = async (withJsonMode: boolean) => {
    const body: Record<string, unknown> = {
      model: aiModel(),
      temperature: 0.4,
      max_tokens: aiMaxTokens(),
      messages,
    };
    if (withJsonMode) {
      // Certains endpoints compatibles OpenAI (dont certains modèles NVIDIA
      // NIM) refusent response_format : on réessaie sans lui en cas de 400.
      body.response_format = { type: "json_object" };
    }
    return fetch(`${aiBaseUrl()}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
      signal,
    });
  };

  let res = await post(true);
  if (res.status === 429) throw new AiRateLimitedError();
  if (res.status === 400) {
    res = await post(false);
    if (res.status === 429) throw new AiRateLimitedError();
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Erreur IA (${res.status}): ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  return extractJson(content);
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

/** Analyse d'une ou plusieurs photos d'exercice : extraction + les 3 modes. */
export const analyzeImages = action({
  args: {
    storageIds: v.array(v.string()),
    contentTypes: v.optional(v.array(v.string())),
    prompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const seed = hashSeed(userId, args.storageIds.join(","), new Date().getDate());

    // Mode démo : reste actif tant qu'aucune clé n'est configurée.
    if (!aiKey()) {
      await minLatency();
      return demoResult(seed);
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

    const contentParts: (
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    )[] = [
      {
        type: "text",
        text:
          "Voici une photo d'exercice scolaire (peut-être plusieurs). Analyse-la : " +
          (args.prompt ? `Consigne complémentaire : ${args.prompt}` : ""),
      },
      ...imageParts,
    ];

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90000);
    try {
      const parsed = await chatJson(
        [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: contentParts },
        ],
        controller.signal,
      );
      const detection = (parsed.detection ?? {}) as Record<string, unknown>;
      return {
        detection: {
          subject: String(detection.subject ?? "Mathématiques"),
          topic: String(detection.topic ?? ""),
          level: String(detection.level ?? "seconde"),
          prompt: String(detection.prompt ?? ""),
          data: String(detection.data ?? ""),
          formulas: Array.isArray(detection.formulas)
            ? (detection.formulas as string[])
            : [],
          legible: detection.legible !== false,
        },
        quick: (parsed.quick ?? { answer: "", calculation: "", keyPoint: "" }) as DemoAnalysis["quick"],
        explain: (parsed.explain ?? {
          question: "",
          importantInfo: [],
          method: "",
          steps: [],
          result: "",
          commonMistake: "",
        }) as DemoAnalysis["explain"],
        revise: (parsed.revise ?? { lesson: "", keyFormulas: [], exercises: [] }) as DemoAnalysis["revise"],
      };
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

    const parts: unknown[] = [
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

    const parsed = await chatJson([
      { role: "system", content: SHEET_SYSTEM_PROMPT },
      { role: "user", content: parts },
    ]);
    return {
      title: String(parsed.title ?? "Fiche de révision"),
      subject: String(parsed.subject ?? args.subject ?? "Mathématiques"),
      level: String(parsed.level ?? "seconde"),
      content: parsed.content as DemoSheet["content"],
    };
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
        role: "user",
        content: {
          type: "text",
          text: `Matière : ${args.subject}${args.topic ? ` — notion : ${args.topic}` : ""}.
Niveau : ${args.level ?? "seconde"}.
Nombre de questions : ${count}.
Difficulté : ${args.difficulty}.
Types : ${args.types.join(", ")}.`,
        },
      },
    ]);
    const questions = Array.isArray(parsed.questions) ? parsed.questions : [];
    return {
      title: String(parsed.title ?? `Quiz ${args.subject}`),
      questions: questions.slice(0, count).map((q) => ({
        type: String(q?.type ?? "qcm"),
        question: String(q?.question ?? ""),
        options: Array.isArray(q?.options) ? (q.options as string[]) : undefined,
        answer: String(q?.answer ?? ""),
        explanation: String(q?.explanation ?? ""),
        topic: q?.topic ? String(q.topic) : undefined,
      })),
    };
  },
});

function demoResult(seed: number): DemoAnalysis {
  return demoAnalysis(seed);
}
