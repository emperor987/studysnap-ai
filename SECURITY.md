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
   ownership des fichiers vérifiée côté serveur, statut/plan imposés côté serveur,
   origines (Stripe, liens email) validées côté serveur.
4. **Erreurs sans fuite.** Les erreurs exposées au client contiennent un code et un
   message pédagogique — jamais de stack trace, jamais de clé, jamais de token.
5. **Les en-têtes de sécurité sont appliqués au runtime**, pas seulement documentés :
   anti-clickjacking bloquant en production, politique d'origines restrictive sur
   l'aperçu (voir « Clickjacking »).

## Sessions & authentification

| Contrôle | Valeur | Emplacement |
|---|---|---|
| Flags des cookies de session | `httpOnly`, `Secure`, `Partitioned` ; `SameSite=None` **nécessaire** (le backend Convex est une origine différente de l'app), compensé par Secure+Partitioned et la protection CSRF de la plateforme Convex (en-tête custom obligatoire + préflight CORS) | `@convex-dev/auth` (cookies.js) — non affaibli par notre code |
| Expiration des sessions | **Absolue : 14 jours** (`session.totalDurationMs`) ; inactivité : 30 j (défaut bibliothèque) | `src/convex/auth.ts` |
| Rotation de session (anti-fixation) | Nouvelle session à chaque connexion (`createNewAndDeleteExistingSession` — password, OTP, OAuth) | Convex Auth |
| Déconnexion | Invalidation **serveur** : suppression du session document + de tous les refresh tokens (`auth:signOut`), appelée par Settings / menu / shell | `src/hooks/use-auth.ts`, `pages/Settings.tsx` |
| Brute-force | 5 échecs/heure/email (mot de passe + OTP), compteur distribué en base | `src/convex/auth.ts` |
| Validation d'origine | `resolveStripeOrigin` (checkout), `resolveSiteBaseUrl` (lien parental) — jamais de confiance à l'origine/header fournis par le client | `src/lib/url.ts` |

> `SameSite` ne peut pas être `Lax`/`Strict` ici : le cookie de session est posé par
> l'**origine Convex** (déploiement séparé du domaine de l'app), donc chaque appel
> client vers Convex est un contexte *cross-site*. Passer à `Lax` casserait la
> connexion. La protection CSRF reste assurée par Convex (les requêtes depuis un
> navigateur doivent porter un en-tête custom non posable cross-origin sans
> préflight CORS, et aucun CORS sauvage n'est configuré).

Preuve : `tests/security/sessions.test.ts`.

## Rate limiting (multi-dimension, distribué)

Convex étant serverless (plusieurs instances), tous les compteurs vivent dans la
base (`rate_limits`) : lecture-vérification-écriture atomique dans une même mutation
= mécanisme distribué. Une erreur `RATE_LIMITED` (avec délai de réessai) est levée
sans jamais exposer de détail interne.

| Dimension | Clé | Seuil | Justification |
|---|---|---|---|
| Quotas mensuels du plan gratuit | `usage` (par compte) | 5 scans / 3 fiches / 3 quiz | Fair-use du free tier |
| Espacement des scans | `usage.lastScanAt` | ≥ 4 s | Anti-spam du pipeline d'analyse (2 appels IA par scan) |
| Générations IA (endpoints coûteux) | `ai:<userId>` (fenêtre glissante 1 h) | **30 / heure / compte** | ~10-15 parcours complets/heure — très au-dessus d'un usage élève, bloque le scriptage du free tier |
| Envois de codes OTP | `otp:<email>` (fenêtre glissante 15 min) | **3 / 15 min / email** | Anti-flood d'emails (connexion + inscription par code) |
| Connexion (brute-force) | `authRateLimits` (par email) | 5 échecs/heure | Réduit l'énumération + le cassage de mots de passe |
| Renvoi de consentement parental | cooldown 5 min par compte | 1 envoi / 5 min | Anti-spam d'emails parents |

Seuils configurables : `OTP_SEND_LIMITS` / `AI_GENERATION_LIMITS` dans
`src/convex/rateLimit.ts` (surcharge de test : `AI_RATE_LIMIT_MAX`, jamais utilisé
pour affaiblir en production).

**Limite par IP : non applicable à cette couche.** Convex 1.43 n'expose pas
l'adresse IP du client aux fonctions (query/mutation/action). La protection IP/réseau
doit être portée par la plateforme :
- domaine de production : WAF / rate limiting (ex. Cloudflare) devant le site et le
  déploiement Convex ;
- aperçu de dev : protections de la plateforme Freebuff.

Sans elle, un bot authentifié peut créer des comptes pour repousser les limites
par compte — d'où aussi les plafonds par email et par heure ci-dessus.

Preuve : `tests/security/rate-limit.test.ts`, `tests/security/rate-limit-and-injection.test.ts`.

## Journal d'abus (`security_events`) et contrôle santé

- **Journal d'abus** : chaque refus du rate limiter (générations IA au-dessus
  du plafond, flood d'emails OTP, etc.) est journalisé dans la table
  `security_events` (`bucket`, `kind`, `windowStart`, `deniedAt`). Une ligne
  par seau et par fenêtre (croissance bornée), jamais exposée au client,
  purgée par le cron hebdomadaire après 30 jours. Visible dans le dashboard
  Convex — c'est la première chose à regarder en cas de soupçon d'abus.
- **Contrôle santé** : `GET /health` (backend Convex) répond `{"status":"ok"}`
  sans aucune information interne — à brancher sur un service de surveillance
  de disponibilité (UptimeRobot, Better Stack…).
- **Guide pratique** (problèmes courants, réflexes anti-abus, routine) :
  `docs/GUIDE_UTILISATEUR_ET_SECURITE.md`.

Preuve : `tests/security/health-and-events.test.ts`.

## Clickjacking

- **Production** (`public/_headers`) : `frame-ancestors 'none'` (CSP) +
  `X-Frame-Options: DENY` — l'application n'a aucun embedding légitime.
- **Aperçu de dev** (`vite.config.ts` → `server.headers`) : la plateforme Freebuff
  affiche l'aperçu dans une iframe, donc seules ses origines sont autorisées :
  `'self' https://freebuff.com https://*.freebuff.com https://freebuff.app
  https://*.freebuff.app https://*.freebuff.dev https://*.vly.ai https://*.vly.sh`.
- Toutes les réponses du serveur de dev (routes, fallback SPA, erreurs) portent les
  en-têtes ; en production, la règle `/*` de `_headers` couvre toutes les routes.
- La politique effective est **évaluée** (pas seulement vérifiée présente) par les
  tests : les origines hostiles sont refusées, les origines Freebuff acceptées.

Preuve : `tests/security/clickjacking.test.ts`, `tests/security/frontend-and-infra.test.ts`.

## Contrôle des dépendances (CI)

- **CI** : `.github/workflows/security-audit.yml` exécute `bun run audit:deps` sur
  chaque push/PR **et une fois par semaine** (nouveaux advisories détectés sans
  attendre une PR).
- **Seuil** : échec si une advisory ≥ `high` (directe **ou transitive**) n'est pas
  exemptée. Sévérité configurable : `bun run audit:deps --level=low|moderate|high|critical`.
- **Exceptions** : uniquement via `security/audit-exceptions.json` — chaque entrée
  porte un `id` (GHSA/CVE), une **justification d'exploitabilité** et une **date
  d'expiration**. Une exception expirée déclenche un avertissement. Ce n'est jamais
  un moyen de masquer : le scanner reste actif et l'exception est revue.
- **Correctifs appliqués en cours de projet** : `@convex-dev/auth` → 0.0.95 +
  `@auth/core` → 0.41.3 (advisories critiques Auth.js), `react-router` → 7.18.2
  (CSRF RSC), `hono` → 4.13.1, `postcss` → 8.5.26, `brace-expansion` → 1.1.18,
  `js-yaml` → 5.2.3 — via `package.json` (`overrides` pour les transitives dont
  l'ancêtre n'a pas encore relâché de range corrigé).

### Procédure de mise à jour

1. `bun update <paquet>` (ou `bun update --latest` dans une branche dédiée).
2. `bun run audit:deps` + `bun test` + `bunx convex dev --once && bun tsc -b --noEmit`.
3. Si une advisory n'a **pas** de correctif publié (ex. rame non backportée) :
   documenter dans `security/audit-exceptions.json` avec analyse et échéance,
   puis re-tester. Sinon mettre à jour le `overrides` correspondant.

## Secrets — inventaire et rotation

Tous les secrets sont stockés dans l'**UI Keys** de la plateforme (variables
d'environnement) — jamais dans le repository. Aucun secret n'est journalisé par la
CI (les workflows ne passent pas `secrets.*` à `echo` ; vérifié par tests).

| Secret | Propriétaire | Rotation automatique ? | Chevauchement | Rotation |
|---|---|---|---|---|
| `FREEBUFF_EMAIL_API_KEY` | Plateforme (compte de l'utilisateur) | Non — déclenchement manuel | ✅ `FREEBUFF_EMAIL_API_KEY_PREVIOUS` (repli sur 401/403) | 1. Saisir la nouvelle clé dans `FREEBUFF_EMAIL_API_KEY` ; 2. déplacer l'ancienne dans `FREEBUFF_EMAIL_API_KEY_PREVIOUS` ; 3. envoyer un OTP de test ; 4. retirer `*_PREVIOUS` |
| `STRIPE_WEBHOOK_SECRET` | Stripe (endpoint webhook) | Non | ✅ plusieurs secrets actifs (`_PREVIOUS`, config provisionnée) | 1. Ajouter le nouveau secret côté Stripe ; 2. le mettre dans `STRIPE_WEBHOOK_SECRET`, l'ancien dans `_PREVIOUS` ; 3. rejouer un événement de test ; 4. supprimer l'ancien côté Stripe puis en env |
| `STRIPE_SECRET_KEY` | Stripe | Non | Non nécessaire (rotation immédiate + re-provisionnement) | Remplacer la clé dans l'UI Keys ; le provisionnement recrée la config au prochain checkout |
| `AI_API_KEY` / `AI_API_KEY_FAST` | Fournisseur IA | Non | Non | Remplacer la clé (lue à chaque appel) |
| `VLY_INTEGRATION_KEY` | Plateforme (SDK Vly) | Non | Non | Remplacer dans l'UI Keys ; le SDK relit l'env |
| `SITE_URL`, `CONVEX_SITE_URL`, `VITE_CONVEX_URL` | Config (non secrets) | — | — | — |
| JWT/session (signature) | Plateforme Convex (clé du déploiement) | Oui, par la plateforme | — | Via le dashboard Convex en cas de compromission |

Principe de rotation : **chevauchement sans interruption** — l'ancienne valeur
reste acceptée (fallback de code ou liste de candidats) le temps de valider la
nouvelle, puis est révoquée. Le code ne lit jamais une valeur « figée » à l'import :
toutes les clés sont relues à chaque appel.

Preuve : `tests/security/secrets.test.ts`, `tests/security/secrets-rotation.test.ts`.

## Suite de tests

```bash
# Suite complète
bun test

# Suite de sécurité seule
bun test tests/security

# Contrôle des dépendances
bun run audit:deps

# Typecheck (Convex + frontend)
bunx convex dev --once && bun tsc -b --noEmit
```

La suite de sécurité est exécutée en CI sur chaque push/PR (`.github/workflows/security-tests.yml`),
l'audit de dépendances aussi (`.github/workflows/security-audit.yml`). Toutes les
fixtures sont locales — aucun backend déployé, aucune clé tierce.

Couverture : authentification, IDOR/BOLA, mass assignment, injection, XSS (rendu réel),
CSRF (sessions httpOnly + en-tête Convex), open redirect, path traversal, uploads,
rate limiting multi-dimension, clickjacking (politique évaluée), sessions (flags,
rotation, logout, TTL), en-têtes de sécurité, CORS, redaction des logs, gestion
d'erreurs, secrets + rotation, signature webhook + anti-rejeu + multi-secrets,
notation serveur, tokens parentaux, journal d'abus `security_events` (déduplication,
retention, purge), endpoint `/health` (aucune fuite).

## Signaler une vulnérabilité

1. **Ne pas** créer d'issue publique avec les détails exploitables.
2. Envoyer un email à **security@studysnap.app** avec :
   - l'impact (quoi, qui, données concernées) ;
   - la reproduction la plus courte possible ;
   - le niveau de sévérité estimé (critique / élevé / moyen / faible).
3. Délai de réponse : 72 h ouvrées ; correctif priorisé selon la sévérité.

## Déploiement sûr

1. Configurer toutes les variables listées ci-dessus (dont **`SITE_URL`** et les
   variables `*_PREVIOUS` pour la rotation) dans l'UI Keys.
2. Vérifier que la suite de sécurité et l'audit de dépendances passent en CI.
3. Activer le webhook Stripe avec l'endpoint `/stripe-webhook` et le secret associé.
4. En production, confirmer que les liens de consentement parental pointent vers
   `SITE_URL` (régime strict d'origine) et que `_headers` est bien servi
   (`frame-ancestors 'none'` + `X-Frame-Options: DENY`).
5. **Protection IP** : activer un WAF / rate limiting (ex. Cloudflare) devant le
   domaine de production et le déploiement Convex (l'application ne peut pas limiter
   par IP elle-même — voir « Rate limiting »).
6. Ne jamais partager un lien d'aperçu de développement (déploiement non publié).
