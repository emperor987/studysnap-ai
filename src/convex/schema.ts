import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

export const planValidator = v.union(
  v.literal("free"),
  v.literal("student"),
  v.literal("pro"),
);
export type Plan = Infer<typeof planValidator>;

export const scanModeValidator = v.union(
  v.literal("quick"),
  v.literal("explain"),
  v.literal("revise"),
);
export type ScanMode = Infer<typeof scanModeValidator>;

export const quizTypeValidator = v.union(
  v.literal("qcm"),
  v.literal("truefalse"),
  v.literal("free"),
  v.literal("problem"),
);
export type QuizType = Infer<typeof quizTypeValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove

      // --- StudySnap profil utilisateur ---
      firstName: v.optional(v.string()),
      schoolLevel: v.optional(v.string()), // "college" | "seconde" | "premiere" | "terminale" | "postbac"
      favoriteSubjects: v.optional(v.array(v.string())),
      language: v.optional(v.string()), // "fr" | "en"
      explanationLevel: v.optional(v.string()), // "simple" | "normal" | "detail" | "expert"

      // --- Consentement parental (mineurs < 15 ans) ---
      isMinor: v.optional(v.boolean()), // l'utilisateur a déclaré avoir moins de 15 ans
      parentEmail: v.optional(v.string()), // email du parent / tuteur légal
      parentalConsentStatus: v.optional(
        v.union(
          v.literal("pending"),
          v.literal("confirmed"),
          v.literal("expired"),
          v.literal("refused"),
        ),
      ), // statut de validation parentale
      parentalConsentConfirmedAt: v.optional(v.number()),
      parentalConsentTokenHash: v.optional(v.string()), // hash SHA-256 du token (jamais le token brut)
      parentalConsentTokenExpiresAt: v.optional(v.number()),
      parentalConsentLastSentAt: v.optional(v.number()),
      parentalConsentReminderSentAt: v.optional(v.number()),
    })
      .index("email", ["email"]) // index for the email. do not remove or modify
      .index("by_parental_token", ["parentalConsentTokenHash"])
      .index("by_parental_pending", ["parentalConsentStatus"]),

    // Abonnement / plan (Stripe)
    subscriptions: defineTable({
      userId: v.id("users"),
      plan: planValidator,
      status: v.string(), // "active" | "trialing" | "past_due" | "canceled" | "incomplete"
      stripeCustomerId: v.optional(v.string()),
      stripeSubscriptionId: v.optional(v.string()),
      periodEnd: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_customer", ["stripeCustomerId"]),

    // Un scan = un exercice analysé par l'IA (photo(s) + résultat)
    scans: defineTable({
      userId: v.id("users"),
      storageIds: v.array(v.string()), // images Convex (supprimées après rétention)
      contentTypes: v.optional(v.array(v.string())), // MIME de chaque image (réencodage base64)
      subject: v.string(),
      topic: v.optional(v.string()),
      level: v.string(), // niveau détecté : "college", "seconde"...
      title: v.string(),
      fullText: v.optional(v.string()), // texte extrait (OCR / vision)
      status: v.string(), // "analyzing" | "done" | "failed"
      mode: v.optional(scanModeValidator), // dernier mode consulté
      result: v.optional(
        v.object({
          detection: v.object({
            subject: v.string(),
            topic: v.string(),
            level: v.string(),
            prompt: v.string(),
            data: v.string(),
            formulas: v.array(v.string()),
            legible: v.boolean(),
          }),
          quick: v.object({
            answer: v.string(),
            calculation: v.string(),
            keyPoint: v.string(),
          }),
          explain: v.object({
            question: v.string(),
            importantInfo: v.array(v.string()),
            method: v.string(),
            steps: v.array(v.string()),
            result: v.string(),
            commonMistake: v.string(),
          }),
          revise: v.object({
            lesson: v.string(),
            keyFormulas: v.array(v.string()),
            exercises: v.array(
              v.object({
                question: v.string(),
                answer: v.string(),
                hint: v.string(),
              }),
            ),
          }),
          // Document complet corrigé (un bloc par exercice) — export PDF payant.
          document: v.object({
            title: v.string(),
            exercises: v.array(
              v.object({
                number: v.number(),
                question: v.string(),
                answer: v.string(),
                calculation: v.string(),
              }),
            ),
          }),
        }),
      ),
      feedback: v.optional(
        v.object({
          useful: v.boolean(),
          createdAt: v.number(),
        }),
      ),
      saved: v.optional(v.boolean()), // sauvegardé par l'utilisateur
      createdAt: v.number(),
    })
      .index("by_user", ["userId", "createdAt"])
      .index("by_user_subject", ["userId", "subject"]),

    // Fiches de révision générées
    revision_sheets: defineTable({
      userId: v.id("users"),
      title: v.string(),
      subject: v.string(),
      level: v.string(),
      sourceType: v.union(v.literal("photo"), v.literal("text"), v.literal("scan")),
      storageIds: v.array(v.string()),
      sourceText: v.optional(v.string()),
      content: v.object({
        concepts: v.array(v.object({ term: v.string(), definition: v.string() })),
        formulas: v.array(v.object({ name: v.string(), formula: v.string() })),
        methods: v.array(v.string()),
        example: v.object({ question: v.string(), solution: v.string() }),
        pitfalls: v.array(v.string()),
        takeaways: v.array(v.string()),
      }),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_user", ["userId", "createdAt"])
      .index("by_user_subject", ["userId", "subject"]),

    // Quiz générés
    quizzes: defineTable({
      userId: v.id("users"),
      subject: v.string(),
      level: v.string(),
      title: v.string(),
      settings: v.object({
        count: v.number(),
        difficulty: v.string(), // "easy" | "medium" | "hard"
        types: v.array(quizTypeValidator),
      }),
      questions: v.array(
        v.object({
          type: quizTypeValidator,
          question: v.string(),
          options: v.optional(v.array(v.string())),
          answer: v.string(), // réponse attendue (texte ou index d'option)
          explanation: v.string(),
          topic: v.optional(v.string()), // notion testée (pour "notions à revoir")
        }),
      ),
      score: v.optional(v.number()),
      total: v.optional(v.number()),
      durationSeconds: v.optional(v.number()),
      status: v.union(v.literal("pending"), v.literal("done")),
      createdAt: v.number(),
    })
      .index("by_user", ["userId", "createdAt"])
      .index("by_user_subject", ["userId", "subject"]),

    // Réponses détaillées d'un quiz (analysées pour la Progression)
    quiz_answers: defineTable({
      userId: v.id("users"),
      quizId: v.id("quizzes"),
      subject: v.string(),
      topic: v.optional(v.string()),
      questionIndex: v.number(),
      selected: v.optional(v.string()),
      isCorrect: v.boolean(),
      createdAt: v.number(),
    }).index("by_user", ["userId", "createdAt"]),

    // Configuration Stripe auto-provisionnée (produits, prix, webhook).
    // Ligne unique (singleton) écrite par l'action stripe:provisionStripe ;
    // jamais exposée au client (accès via fonctions internes uniquement).
    stripe_config: defineTable({
      singleton: v.literal("default"),
      accountId: v.optional(v.string()), // acct_... : empreinte du compte Stripe (migration = re-provisionnement)
      mode: v.string(), // "test" | "live" (environnement des objets créés)
      priceStudent: v.string(), // price_... plan Student mensuel (4,99 €/mois)
      pricePro: v.string(), // price_... plan Student Pro mensuel (6,99 €/mois)
      priceStudentAnnual: v.optional(v.string()), // price_... Student annuel (49,99 €/an)
      priceProAnnual: v.optional(v.string()), // price_... Student Pro annuel (69,99 €/an)
      webhookId: v.string(),
      webhookSecret: v.string(), // whsec_... (secret du endpoint créé)
      updatedAt: v.number(),
    }).index("by_singleton", ["singleton"]),

    // Registre des images téléversées par chaque utilisateur (sécurité).
    // Un storageId ne peut être référencé (scan, fiche, OCR) que s'il figure
    // ici pour le MÊME utilisateur : empêche de lire, de lier ou de supprimer
    // l'image d'un autre compte en devinant son storageId (BOLA/IDOR).
    uploads: defineTable({
      userId: v.id("users"),
      storageId: v.string(),
      contentType: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_storage", ["storageId"])
      .index("by_user", ["userId", "createdAt"]),

    // Rate limiting distribué (multi-dimension) : seau à fenêtre glissante
    // par clé — "otp:<email>" (envois de codes), "ai:<userId>" (générations
    // IA), etc. Écrit par l'interne mutation rateLimit:consume ; les seaux
    // inactifs sont purgés par le cron hebdomadaire.
    rate_limits: defineTable({
      key: v.string(), // clé unique du seau (email / utilisateur / endpoint)
      windowStart: v.number(), // début de la fenêtre glissante courante
      count: v.number(), // consommations dans la fenêtre
      updatedAt: v.number(),
    }).index("by_key", ["key"]),

    // Journal d'audit des tentatives BLOQUÉES (abus). Écrit par le rate
    // limiter quand il refuse une requête (jamais sur les requêtes
    // autorisées). Une ligne par seau et par fenêtre — croissance bornée.
    // Visible dans le dashboard Convex (table security_events) ; purgé par
    // le cron hebdomadaire après 30 jours. Jamais exposé au client.
    security_events: defineTable({
      bucket: v.string(), // cible : "ai:<userId>", "otp:<email>"…
      kind: v.string(), // type : "ai_generation" | "otp_flood" | "rate_limit"…
      windowStart: v.number(), // fenêtre du seau refusée (déduplication exacte)
      deniedAt: v.number(), // horodatage du refus
    })
      .index("by_bucket", ["bucket"])
      .index("by_denied_at", ["deniedAt"]),

    // Snapshots d'health (monitoring du plan gratuit).
    // Un cron horaire compte les lignes de chaque table et enregistre un
    // snapshot. Si les seuils sont franchis, une alerte email est envoyée.
    // Rétention : 30 derniers snapshots (purge automatique).
    health_snapshots: defineTable({
      timestamp: v.number(),
      totalRows: v.number(),
      tableCounts: v.any(), // Record<string, number>
      storageRefCount: v.number(),
      estimatedDbBytes: v.number(),
      rowsPercent: v.number(),
      dbPercent: v.number(),
      biggestTable: v.string(),
      biggestCount: v.number(),
      alertLevel: v.union(
        v.literal("ok"),
        v.literal("warn"),
        v.literal("critical"),
      ),
    }).index("by_timestamp", ["timestamp"]),

    // Backups Convex → Supabase (export périodique de toutes les tables).
    // Un snapshot = un enregistrement dans `backup_snapshots` Supabase.
    // Rétention : les 20 derniers backups sont conservés côté Supabase.
    // (pas de table Convex — les backups vivent dans Supabase)

    // Compteurs mensuels (limites plan gratuit + stats)
    usage: defineTable({
      userId: v.id("users"),
      month: v.string(), // "2026-08"
      scansCount: v.number(),
      sheetsCount: v.number(),
      quizzesCount: v.number(),
      lastScanAt: v.optional(v.number()),
      updatedAt: v.number(),
    })
      .index("by_user_month", ["userId", "month"])
      .index("by_user", ["userId"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
