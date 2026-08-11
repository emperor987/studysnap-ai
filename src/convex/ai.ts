/**
 * StudySnap — couche IA, agnostique du fournisseur.
 *
 * Appels effectués uniquement côté serveur (actions Convex) : aucune clé
 * n'est jamais exposée au client. Compatible avec toute API compatible
 * OpenAI (OpenAI, Google Gemini via son endpoint compatible, etc.).
 *
 * Variables d'environnement (à renseigner dans l'UI Keys de la plateforme) :
 *   AI_API_KEY  (ou OPENAI_API_KEY)  — clé du fournisseur
 *   AI_MODEL    (défaut: gpt-4.1-mini)
 *   AI_BASE_URL (défaut: https://api.openai.com/v1)
 *
 * Sans clé configurée, l'app fonctionne en mode démo avec des contenus
 * réalistes (voir demoData.ts).
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

function aiKey(): string | undefined {
  return process.env.AI_API_KEY ?? process.env.OPENAI_API_KEY;
}

function aiBaseUrl(): string {
  return process.env.AI_BASE_URL ?? "https://api.openai.com/v1";
}

function aiModel(): string {
  return process.env.AI_MODEL ?? AI_MODEL_DEFAULT;
}

/** L'utilisateur courant (authentifié) ou erreur. */
async function requireUser(ctx: ActionCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Vous devez être connecté·e.");
  return userId;
}

async function chatJson(
  messages: { role: "system" | "user" | "assistant"; content: unknown }[],
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const key = aiKey();
  if (!key) throw new Error("AI_NOT_CONFIGURED");
  const res = await fetch(`${aiBaseUrl()}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: aiModel(),
      temperature: 0.4,
      max_tokens: 4096,
      response_format: { type: "json_object" },
      messages,
    }),
    signal,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Erreur IA (${res.status}): ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content ?? "";
  const cleaned = content
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
  const parsed = JSON.parse(cleaned) as Record<string, unknown>;
  return parsed;
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

function demoResult(seed: number): DemoAnalysis {
  return demoAnalysis(seed);
}

/** Analyse d'une ou plusieurs photos d'exercice : extraction + les 3 modes. */
export const analyzeImages = action({
  args: {
    storageIds: v.array(v.string()),
    prompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const seed = hashSeed(userId, args.storageIds.join(","), new Date().getDate());

    if (!aiKey()) {
      await minLatency();
      return demoResult(seed);
    }

    const urls = (
      await Promise.all(args.storageIds.map((id) => ctx.storage.getUrl(id)))
    ).filter((u): u is string => Boolean(u));

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
      ...urls.map((url) => ({
        type: "image_url" as const,
        image_url: { url },
      })),
    ];

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 55000);
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

    const parts: unknown[] = [
      {
        type: "text",
        text: `Construis une fiche de révision${
          args.subject ? ` pour la matière « ${args.subject} »` : ""
        }${
          args.level ? `, niveau ${args.level}` : ""
        }. ${args.sourceText ? `Voici le cours :\n\n${args.sourceText}` : ""}`,
      },
      ...urls.map((url) => ({ type: "image_url", image_url: { url } })),
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

