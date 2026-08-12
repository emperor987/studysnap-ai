# SECURITY.md — StudySnap

Posture de sécurité du projet, procédures de signalement et guide de déploiement sûr.

## Principes

1. **Pas de secret côté client.** Toutes les clés (IA, Stripe, email, webhook) sont
   injectées via `process.env` dans les fichiers « use node » Convex, alimentées par
   l'UI Keys de la plateforme. Le bundle frontend ne contient aucune clé.
2. **Ownership systématique.** Chaque mutation/query filtre sur l'utilisateur connecté
   (`getAuthUserId`). Un storageId, un scan, une fiche ou un quiz n'est jamais
   accessible, modifiable, supprimable ou OCRisable par un autre compte.
3. **Le serveur fait confiance au serveur.** Score de quiz recalculé côté serveur,
   ownership des fichiers vérifiée côté serveur, statut/plan imposés côté serveur.
4. **Erreurs sans fuite.** Les erreurs exposées au client contiennent un code et un
   message pédagogique — jamais de stack trace, jamais de clé, jamais de token.

## Secrets attendus (UI Keys de la plateforme)

| Variable | Usage | Requise |
|---|---|---|
| `AI_API_KEY` | Fournisseur IA (raisonnement) | Production |
| `AI_API_KEY_FAST` | Fournisseur IA (OCR) | Production |
| `FREEBUFF_EMAIL_API_KEY` | Envoi des codes OTP par email | Oui |
| `STRIPE_SECRET_KEY` | API Stripe (checkout) | Production |
| `STRIPE_WEBHOOK_SECRET` | Vérification des webhooks Stripe | Production |
| `SITE_URL` | Origine de confiance pour les liens email (parental) | **Recommandé** |
| `VLY_INTEGRATION_KEY` | Envoi des emails parentaux | Production |

> ⚠️ **`SITE_URL` doit être configuré en production** : sans lui, les liens de
> confirmation parentale acceptent toute origine https (mode aperçu dev).
> Voir `src/lib/url.ts`.

## Contrôles clés

| Domaine | Contrôle | Emplacement |
|---|---|---|
| Stockage d'images | Registre `uploads` (storageId → userId), URLs signées, OCR propriétaire uniquement | `src/convex/files.ts`, `schema.ts` |
| Uploads | URL d'upload signée + session requise, enregistrement systématique | `files.ts`, `Scanner.tsx`, `Sheets.tsx` |
| Paiements | Webhook HMAC-SHA256 + anti-rejeu (timestamp ± 5 min), origine des URLs de retour validée | `src/convex/stripe.ts`, `src/lib/url.ts` |
| Mineurs | Consentement parental : token 256 bits haché SHA-256, usage unique, expiration 72 h, rappel 48 h | `src/lib/consent-token.ts`, `src/convex/parentalConsent.ts` |
| Quiz | Score recalculé serveur (le client ne peut pas fausser `isCorrect`) | `src/convex/quizzes.ts` |
| Auth | OTP 6 chiffres / 15 min, anti-brute-force (5 échecs/h), sessions httpOnly Convex | `src/convex/auth.ts`, `emailOtp.ts` |
| Rétention | Suppression auto des photos après expiration (cron), purge à la fermeture du compte | `src/convex/cleanup.ts`, `crons.ts`, `account.ts` |
| Frontend | Rendu Markdown sans HTML brut (`stripHtmlArtifacts` + react-markdown), `returnTo` validé, referrer masqué | `markdown.tsx`, `lib/clean.ts`, `lib/redirect.ts`, `index.html` |

## Suite de tests

```bash
# Suite complète (148 tests, dont la sécurité)
bun test

# Suite de sécurité seule
bun test tests/security

# Typecheck (Convex + frontend)
bunx convex dev --once && bun tsc -b --noEmit
```

La suite de sécurité est exécutée en CI sur chaque push/PR (`bun test tests/security`).
Elle utilise uniquement des fixtures locales — aucun backend déployé, aucune clé tierce.

Couverture : authentification, IDOR/BOLA, mass assignment, injection, XSS (rendu réel),
CSRF (sessions httpOnly — pas de cookie lisible), open redirect, path traversal, uploads,
rate limiting/quotas, en-têtes de sécurité, CORS, redaction des logs, gestion d'erreurs,
secrets, signature webhook + anti-rejeu, notation serveur, tokens parentaux.

## Gestion des dépendances

- `bun install --frozen-lockfile` en CI (lockfile vérifié).
- Vérifier régulièrement les mises à jour : `bun update --latest` dans une branche dédiée,
  puis relancer `bun test` et `bunx convex dev --once && bun tsc -b --noEmit`.

## Signaler une vulnérabilité

1. **Ne pas** créer d'issue publique avec les détails exploitables.
2. Envoyer un email à **security@studysnap.app** avec :
   - l'impact (quoi, qui, données concernées) ;
   - la reproduction la plus courte possible ;
   - le niveau de sévérité estimé (critique / élevé / moyen / faible).
3. Délai de réponse : 72 h ouvrées ; correctif priorisé selon la sévérité.

## Déploiement sûr

1. Configurer toutes les variables listées ci-dessus (dont `SITE_URL`) dans l'UI Keys.
2. Vérifier que la suite de sécurité passe en CI.
3. Activer le webhook Stripe avec l'endpoint `/stripe-webhook` et le secret associé.
4. En production, confirmer que les liens de consentement parental pointent vers
   `SITE_URL` (régime strict d'origine).
5. Ne jamais partager un lien d'aperçu de développement (déploiement non publié).
