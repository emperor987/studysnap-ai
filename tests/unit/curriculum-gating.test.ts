/**
 * Tests de l'extension de couverture des matières de l'IA StudySnap :
 *
 *  1. Base de connaissances du programme scolaire français (collège →
 *     lycée) : détection de la matière et du niveau sur les matières
 *     classiques (maths, français, histoire-géo, SVT, physique-chimie,
 *     langues, technologie, SES…).
 *  2. Détection des contenus AVANCÉS (philosophie, spécialités, post-bac)
 *     qui déclenchent le paywall — et surtout l'ABSENCE de déclenchement
 *     sur les contenus classiques (aucun faux positif).
 *  3. Recherche internet de secours (client Brave) : clé absente → null,
 *     clé présente → résultats mappés, endpoint KO → null (jamais d'erreur).
 *  4. analyzeText côté serveur : plan Gratuit + contenu avancé → résultat
 *     « gated » ; plan payant ou contenu classique → analyse normale.
 *
 * Aucun backend, aucune clé tierce.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "bun:test";

import * as ai from "@/convex/ai";
import * as rateLimit from "@/convex/rateLimit";
import {
  buildCurriculumContext,
  buildSearchQuery,
  COVERED_SUBJECTS,
  detectAdvancedContent,
  detectLevel,
  detectSubject,
  levelLabel,
  lookupCurriculum,
  normalizeForMatch,
} from "@/lib/curriculum";
import {
  buildSearchContext,
  searchEnabled,
  searchWeb,
  type SearchResult,
} from "@/lib/websearch";

import {
  call,
  makeDb,
  makeMutationCtx,
  seedUser,
  setCurrentUser,
  uid,
} from "../helpers/mock-convex";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Contexte d'ACTION simulé (même patron que plan-upgrade-workflow). */
function actionCtx(db: ReturnType<typeof makeDb>, plan: string) {
  const base = makeMutationCtx(db);
  return {
    ...base,
    runMutation: async (_fn: unknown, args: unknown) =>
      call(rateLimit.consume, makeMutationCtx(db), args),
    runQuery: async (_fn: unknown, args: unknown) =>
      (args as { userId?: string }).userId ? plan : null,
    scheduler: { runAfter: async () => undefined },
  };
}

function seedFreeUser(db: ReturnType<typeof makeDb>, n = 1) {
  seedUser(db, uid(n));
  setCurrentUser(uid(n));
}

/* ------------------------------------------------------------------ */
/* 1. Base de connaissances — matières et niveaux                      */
/* ------------------------------------------------------------------ */

describe("Base de connaissances — programme scolaire français", () => {
  test("détecte les matières classiques du collège et du lycée", () => {
    const cases: [string, string][] = [
      ["Résoudre dans R l'équation 2x² − 5x + 3 = 0 puis dresser le tableau de signes de f.", "mathematiques"],
      ["Conjuguez les verbes à l'imparfait et identifiez la nature de chaque mot.", "francais"],
      ["Expliquez les causes de la Première Guerre mondiale et situez les grandes puissances sur la carte.", "histoire-geo"],
      ["Décrivez le rôle de la cellule dans la photosynthèse et la chaîne alimentaire.", "svt"],
      ["Un circuit en série avec une résistance : appliquez la loi d'Ohm pour calculer l'intensité.", "physique-chimie"],
      ["Traduisez ce texte au prétérit et répondez aux questions de compréhension.", "anglais"],
      ["Conjuguez au passé simple espagnol et employez ser ou estar selon le contexte.", "espagnol"],
      ["Assemblez le système avec les engrenages et décris le mécanisme de transmission.", "technologie"],
      ["Analysez la courbe de l'offre et de la demande dans le cadre des SES.", "ses"],
    ];
    for (const [text, expected] of cases) {
      expect(detectSubject(text)?.id, text).toBe(expected);
    }
  });

  test("détecte les niveaux du collège au post-bac", () => {
    expect(detectLevel("Exercice de maths de 4ème")).toBe("college");
    expect(detectLevel("Exercice de 3ème au brevet")).toBe("college");
    expect(detectLevel("Devoir maison de seconde")).toBe("seconde");
    expect(detectLevel("Chapitre de première sur la dérivation")).toBe("premiere");
    expect(detectLevel("Sujet de terminale pour le bac")).toBe("terminale");
    expect(detectLevel("Exercice de prépa MPSI")).toBe("postbac");
    expect(detectLevel("une phrase sans marqueur")).toBeNull();
  });

  test("levelLabel couvre tous les niveaux (aucun trou)", () => {
    expect(levelLabel("college")).toBe("Collège");
    expect(levelLabel("seconde")).toBe("Seconde");
    expect(levelLabel("premiere")).toBe("Première");
    expect(levelLabel("terminale")).toBe("Terminale");
    expect(levelLabel("postbac")).toBe("Post-bac");
    expect(levelLabel("lycee")).toBe("Lycée");
    expect(levelLabel(null)).toBeUndefined();
  });

  test("la couverture déclarée inclut toutes les matières du collège et du lycée", () => {
    const ids = COVERED_SUBJECTS.map((s) => s.id);
    for (const id of [
      "mathematiques",
      "francais",
      "histoire-geo",
      "svt",
      "physique-chimie",
      "anglais",
      "espagnol",
      "allemand",
      "technologie",
      "ses",
    ]) {
      expect(ids).toContain(id);
    }
    // Chaque matière est déclarée au moins pour un cycle.
    expect(COVERED_SUBJECTS.length).toBeGreaterThanOrEqual(12);
  });

  test("lookupCurriculum fournit notions et formules, avec une confiance élevée sur un énoncé classique", () => {
    const knowledge = lookupCurriculum(
      "Résoudre l'équation du second degré : calculer le discriminant puis les racines du trinôme.",
    );
    expect(knowledge.subject?.id).toBe("mathematiques");
    expect(knowledge.covered).toBe(true);
    expect(knowledge.confidence).toBe("high");
    expect(knowledge.formulas.length).toBeGreaterThan(0);
    // Le contexte injecté à l'IA mentionne la référence pédagogique et les formules.
    const context = buildCurriculumContext(knowledge);
    expect(context).toContain("RÉFÉRENCE PÉDAGOGIQUE");
    expect(context).toContain("Mathématiques");
  });

  test("lookupCurriculum signale une couverture faible quand la matière n'est pas reconnue (déclenche la recherche de secours)", () => {
    const knowledge = lookupCurriculum(
      "Question très spécialisée hors programme sur un sujet inconnu.",
    );
    expect(knowledge.confidence).toBe("low");
    expect(knowledge.covered).toBe(false);
    expect(buildCurriculumContext(knowledge)).toContain("pas couvert");
  });

  test("buildSearchQuery combine matière, niveau et extrait du texte", () => {
    const knowledge = lookupCurriculum(
      "Résoudre le système d'équations par substitution en classe de seconde.",
    );
    const q = buildSearchQuery("Résoudre le système d'équations par substitution", knowledge);
    expect(q).toContain("programme scolaire français");
    expect(q).toContain("Mathématiques");
    expect(q).toContain("Seconde");
  });

  test("normalizeForMatch retire accents et casse", () => {
    expect(normalizeForMatch("Équation À ÉCOLE")).toBe("equation a ecole");
  });
});

/* ------------------------------------------------------------------ */
/* 2. Détection des contenus avancés → paywall                         */
/* ------------------------------------------------------------------ */

describe("Détection des contenus avancés (paywall)", () => {
  test("un exercice de maths SIMPLE ne déclenche jamais le paywall", () => {
    const res = detectAdvancedContent(
      "Résoudre dans R l'équation 2x − 5 = 3, puis calculer l'aire du triangle rectangle.",
    );
    expect(res.advanced).toBe(false);
  });

  test("une fiche de FRANÇAIS (grammaire / conjugaison) ne déclenche pas le paywall", () => {
    const res = detectAdvancedContent(
      "Fiche de révision : la concordance des temps, les compléments circonstanciels et la méthode du commentaire.",
    );
    expect(res.advanced).toBe(false);
  });

  test("une question d'HISTOIRE-GÉO ne déclenche pas le paywall", () => {
    const res = detectAdvancedContent(
      "Expliquer les causes de la Première Guerre mondiale et décrire la mondialisation.",
    );
    expect(res.advanced).toBe(false);
  });

  test("une question de SVT ne déclenche pas le paywall", () => {
    const res = detectAdvancedContent(
      "Décrire le rôle de la cellule et de la photosynthèse dans un écosystème.",
    );
    expect(res.advanced).toBe(false);
  });

  test("un contenu de COLLÈGE ne déclenche jamais le paywall, même avec des mots d'un chapitre avancé", () => {
    const res = detectAdvancedContent(
      "Exercice de maths de 4ème : calculer le périmètre d'un cercle avec le nombre pi.",
    );
    expect(res.advanced).toBe(false);
  });

  test("un SUJET DE PHILOSOPHIE déclenche le paywall (catégorie philosophie)", () => {
    const res = detectAdvancedContent(
      "Sujet de dissertation de philosophie : la liberté suppose-t-elle l'absence de contraintes ? Rédigez une introduction, une problématique et un plan.",
    );
    expect(res.advanced).toBe(true);
    expect(res.category).toBe("philosophie");
    expect(res.reason).toContain("philosophie");
    expect(res.subjectLabel).toBe("Philosophie");
  });

  test("un mot isolé de vocabulaire (ex: « la liberté ») ne déclenche PAS le paywall (anti-faux-positif)", () => {
    const res = detectAdvancedContent(
      "La liberté d'expression est essentielle dans une société démocratique.",
    );
    expect(res.advanced).toBe(false);
  });

  test("un exercice de SPÉCIALITÉ déclenche le paywall (catégorie spécialité)", () => {
    const res = detectAdvancedContent(
      "Exercice de spécialité maths expertes : résoudre l'équation dans les nombres complexes et étudier la matrice.",
    );
    expect(res.advanced).toBe(true);
    expect(res.category).toBe("specialite");
    expect(res.reason).toContain("spécialité");
  });

  test("HGGSP / NSI déclenchent le paywall", () => {
    expect(detectAdvancedContent("Étude de cas HGGSP sur la frontière.").advanced).toBe(true);
    expect(detectAdvancedContent("Programmer une structure de données en NSI.").advanced).toBe(true);
  });

  test("un contenu de niveau POST-BAC déclenche le paywall (catégorie avance)", () => {
    const res = detectAdvancedContent(
      "Exercice de prépa MPSI : étudier la convergence de la série numérique.",
    );
    expect(res.advanced).toBe(true);
    expect(res.category).toBe("avance");
  });

  test("une matière inconnue sans marqueur avancé ne déclenche rien", () => {
    const res = detectAdvancedContent("Photocopie d'un document administratif quelconque.");
    expect(res.advanced).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* 3. Recherche internet de secours (Brave)                            */
/* ------------------------------------------------------------------ */

describe("Recherche web de secours", () => {
  const savedKeys = {
    search: process.env.SEARCH_API_KEY,
    brave: process.env.BRAVE_API_KEY,
  };
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    delete process.env.SEARCH_API_KEY;
    delete process.env.BRAVE_API_KEY;
    globalThis.fetch = originalFetch;
  });

  afterEach(() => {
    if (savedKeys.search) process.env.SEARCH_API_KEY = savedKeys.search;
    if (savedKeys.brave) process.env.BRAVE_API_KEY = savedKeys.brave;
    globalThis.fetch = originalFetch;
  });

  test("sans clé : désactivée et searchWeb renvoie null sans erreur", async () => {
    expect(searchEnabled()).toBe(false);
    expect(await searchWeb("équation du second degré")).toBeNull();
  });

  test("avec clé : searchWeb mappe les résultats de l'API Brave", async () => {
    process.env.SEARCH_API_KEY = "bsa_test_123";
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          web: {
            results: [
              { title: "Second degré — Cours", url: "https://ex.fr/cours", description: "Méthode du discriminant." },
              { title: "  ", url: "", description: "" },
            ],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const results = await searchWeb("discriminant trinôme");
    expect(results).not.toBeNull();
    expect(results).toHaveLength(1);
    expect(results![0].title).toBe("Second degré — Cours");
    expect(results![0].url).toBe("https://ex.fr/cours");
    // L'en-tête de clé est bien envoyé, jamais dans l'URL.
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).not.toContain("bsa_test_123");
    expect((init.headers as Record<string, string>)["X-Subscription-Token"]).toBe("bsa_test_123");
  });

  test("avec clé : endpoint KO → null (jamais d'exception bloquante)", async () => {
    process.env.BRAVE_API_KEY = "bsa_test_456";
    globalThis.fetch = (async () => new Response("rate limited", { status: 429 })) as unknown as typeof fetch;
    expect(await searchWeb("sujet")).toBeNull();
  });

  test("avec clé : réponse invalide ou timeout → null", async () => {
    process.env.SEARCH_API_KEY = "bsa_test_789";
    globalThis.fetch = (async () => new Response("not json", { status: 200 })) as unknown as typeof fetch;
    expect(await searchWeb("sujet")).toBeNull();
  });

  test("buildSearchContext formate les résultats avec sources", () => {
    const results: SearchResult[] = [
      { title: "Titre A", url: "https://a.fr", description: "Description A" },
      { title: "Titre B", url: "", description: "Description B" },
    ];
    const ctx = buildSearchContext(results);
    expect(ctx).toContain("VÉRIFICATION EXTERNE");
    expect(ctx).toContain("Titre A");
    expect(ctx).toContain("source : https://a.fr");
    expect(ctx).toContain("Titre B");
  });
});

/* ------------------------------------------------------------------ */
/* 4. analyzeText — paywall côté serveur selon le plan                  */
/* ------------------------------------------------------------------ */

describe("analyzeText — gating selon le plan de l'utilisateur", () => {
  test("GRATUIT + sujet de philosophie → résultat gated (paywall), aucune analyse générée", async () => {
    const db = makeDb();
    seedFreeUser(db);
    const ctx = actionCtx(db, "free");

    const res = await call<{ gated?: boolean; category?: string; reason?: string }>(
      ai.analyzeText,
      ctx as never,
      {
        text: "Sujet de dissertation de philosophie : la liberté suppose-t-elle l'absence de contraintes ?",
      } as never,
    );
    expect(res.gated).toBe(true);
    expect(res.category).toBe("philosophie");
    expect(res.reason).toContain("Student");
  });

  test("GRATUIT + exercice de spécialité → résultat gated (spécialité)", async () => {
    const db = makeDb();
    seedFreeUser(db);
    const ctx = actionCtx(db, "free");

    const res = await call<{ gated?: boolean; category?: string }>(
      ai.analyzeText,
      ctx as never,
      { text: "Exercice de spécialité maths expertes sur les nombres complexes." } as never,
    );
    expect(res.gated).toBe(true);
    expect(res.category).toBe("specialite");
  });

  test("GRATUIT + exercice de maths SIMPLE → analyse normale (non gated)", async () => {
    const db = makeDb();
    seedFreeUser(db);
    const ctx = actionCtx(db, "free");

    const res = await call<{ gated?: boolean }>(
      ai.analyzeText,
      ctx as never,
      { text: "Résoudre dans R l'équation 2x − 5 = 3." } as never,
    );
    expect(res.gated).toBeUndefined();
    expect(res).toHaveProperty("quick");
  });

  test("PAYANT (Student) + sujet de philosophie → analyse normale, aucun blocage", async () => {
    const db = makeDb();
    seedFreeUser(db);
    const ctx = actionCtx(db, "student");

    const res = await call<{ gated?: boolean }>(
      ai.analyzeText,
      ctx as never,
      { text: "Sujet de dissertation de philosophie sur le temps." } as never,
    );
    expect(res.gated).toBeUndefined();
    expect(res).toHaveProperty("quick");
  });

  test("PAYANT (Pro) + spécialité → analyse normale, aucun blocage", async () => {
    const db = makeDb();
    seedFreeUser(db);
    const ctx = actionCtx(db, "pro");

    const res = await call<{ gated?: boolean }>(
      ai.analyzeText,
      ctx as never,
      { text: "Exercice de spécialité NSI sur les arbres binaires." } as never,
    );
    expect(res.gated).toBeUndefined();
    expect(res).toHaveProperty("quick");
  });

  test("aucune session → erreur d'authentification (jamais de paywall contournable)", async () => {
    const db = makeDb();
    setCurrentUser(null);
    const ctx = actionCtx(db, "free");

    await expect(
      call(ai.analyzeText, ctx as never, {
        text: "Sujet de philosophie",
      } as never),
    ).rejects.toThrow("Vous devez être connecté");
  });
});
