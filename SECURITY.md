# SECURITY.md — StudySnap

Posture de sécurité du projet, procédures de signalement et guide de déploiement sûr.

## Principes

1. **Pas de secret côté client.** Toutes les clés (IA, Stripe, email, webhook, Supabase) sont
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
| `VLY_INTEGRATION_KEY` (emails OTP) | Plateforme — service email natif (`vly.email.send`, clé **injectée automatiquement** à la création du projet) | Par la plateforme | Non (clé unique) | Aucune clé à obtenir : les codes OTP transitent par le même canal que les emails de consentement parental. En cas de rotation côté plateforme, remplacer la clé dans l'UI Keys (relue à chaque envoi) |
| `STRIPE_WEBHOOK_SECRET` | Stripe (endpoint webhook) | Non | ✅ plusieurs secrets actifs (`_PREVIOUS`, config provisionnée) | 1. Ajouter le nouveau secret côté Stripe ; 2. le mettre dans `STRIPE_WEBHOOK_SECRET`, l'ancien dans `_PREVIOUS` ; 3. rejouer un événement de test ; 4. supprimer l'ancien côté Stripe puis en env |
| `STRIPE_SECRET_KEY` | Stripe | Non | Non nécessaire (rotation immédiate + re-provisionnement) | Remplacer la clé dans l'UI Keys ; le provisionnement recrée la config au prochain checkout. **Changement de compte** : la config est empreintée par l'ID du compte (`accountId`) — une clé d'un AUTRE compte déclenche un re-provisionnement complet (produits, prix, webhook, secret) sans toucher au code |
| `AI_API_KEY` | DeepSeek (api.deepseek.com) | Non | Non | Remplacer la clé (lue à chaque appel). Clé API DeepSeek : `https://platform.deepseek.com/` → API Keys → Create |
| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | Supabase (Postgres analytics) | Non | Non | Remplacer les deux clés dans l'UI Keys (relues à chaque appel ; le client est mis en cache mais recrée après rotation). Le client utilise la **service-role key** (opérations admin) — jamais exposée côté client |
| `SITE_URL`, `CONVEX_SITE_URL`, `VITE_CONVEX_URL` | Config (non secrets) | — | — | — |
| JWT/session (signature) | Plateforme Convex (clé du déploiement) | Oui, par la plateforme | — | Via le dashboard Convex en cas de compromission |

Principe de rotation : **chevauchement sans interruption** — l'ancienne valeur
reste acceptée (fallback de code ou liste de candidats) le temps de valider la
nouvelle, puis est révoquée. Le code ne lit jamais une valeur « figée » à l'import :
toutes les clés sont relues à chaque appel.

Preuve : `tests/security/secrets.test.ts`, `tests/security/secrets-rotation.test.ts`.

## Migration de compte Stripe (runbook)

Procédure pour passer StudySnap sur un **autre compte Stripe** (même compte
marchand ou nouveau), sans casser le paiement ni la sécurité.

> Le code ne contient **aucune clé, aucun price_id ni aucun secret** en dur :
> tout est lu depuis l'UI Keys (`STRIPE_SECRET_KEY`, surcharges de prix
> optionnelles) et la config auto-provisionnée en base (`stripe_config`, accès
> interne uniquement). La migration est donc un changement de clé + une
> vérification — pas une refonte.

### 1. Remplacer la clé API

1. Dans l'UI Keys de la plateforme, remplacer `STRIPE_SECRET_KEY` par la
   nouvelle clé (`sk_test_...` ou `sk_live_...`) du nouveau compte Stripe.
2. **Aucun changement de code nécessaire** : le provisionnement détecte le
   changement de compte via `GET /v1/account` (`accountId` ≠ config
   enregistrée) et recrée tout sous le nouveau compte au prochain checkout.

### 2. Produits et prix (recréation automatique)

Au premier checkout après le changement de clé, `provisionStripe` crée dans le
nouveau compte :

| Produit | Mensuel | Annuel | Lookup keys |
|---|---|---|---|
| Student | 4,99 € (`price_...`) | 49,99 € (`price_...`) | `studysnap_student_monthly_v2` / `studysnap_student_annual` |
| Student Pro | 6,99 € (`price_...`) | 69,99 € (`price_...`) | `studysnap_pro_monthly_v2` / `studysnap_pro_annual` |

Les nouveaux `price_id` remplacent automatiquement l'ancienne config en base
(`stripe_config`) — Checkout utilise toujours les prix du bon compte.

### 3. Webhook

- L'endpoint `{SITE_URL}/stripe-webhook` est recréé dans le nouveau compte,
  abonné aux mêmes événements : `checkout.session.completed`,
  `customer.subscription.updated`, `customer.subscription.deleted`,
  `invoice.payment_failed`.
- Le **nouveau secret de signature** (renvoyé une seule fois par Stripe à la
  création) est stocké automatiquement dans `stripe_config`. La validation
  accepte déjà plusieurs candidats (`STRIPE_WEBHOOK_SECRET`,
  `STRIPE_WEBHOOK_SECRET_PREVIOUS`, config provisionnée) : pas de fenêtre de
  rejet pendant la bascule, anti-rejeu conservé.
- Optionnel : définir `STRIPE_WEBHOOK_SECRET` en env avec le nouveau secret
  (le config en base suffit). Si l'ancien endpoint de l'ancien compte envoie
  encore des événements (même URL), ils seront **rejetés** par la validation
  de signature — laisser l'ancien compte en pause ou supprimer son endpoint.

### 4. Vérifications (à faire après le changement de clé)

1. `bunx convex dev --once && bun tsc -b --noEmit` puis `bun test` (suite
   complète, dont `tests/unit/stripe-migration.test.ts`).
2. Paiement test réussi (carte Stripe 4242...) sur Student ou Student Pro →
   le webhook reçoit `checkout.session.completed`, le compte passe en plan
   payant immédiatement (toast Settings + accès complet).
3. Paiement échoué (carte refusée 4000...) → `invoice.payment_failed` passe
   l'abonnement en `past_due` : l'accès payant est retiré (getMyPlan → free).
4. Résiliation → `customer.subscription.deleted` → statut `canceled`.
5. Dashboard Stripe du nouveau compte : produits/prices présents, endpoint
   webhook actif, aucun événement d'échec de signature.
6. Vérifier qu'aucune référence à l'ancien compte ne subsiste : la table
   `stripe_config` porte le nouveau `accountId` ; aucun `sk_`/`whsec_`/`price_`
   n'existe dans le code (testé par `tests/security/secrets.test.ts`).

Preuve : `tests/unit/stripe-migration.test.ts` (re-provisionnement sur
changement de compte, événements du webhook, montants, signature).

## Paywall serveur — documents complets (plans payants)

Les documents corrigés complets (Réponse rapide) et les fiches de révision
sont des contenus **payants** (Student / Student Pro). Le paywall est
**côté serveur**, jamais un simple masquage frontend :

- `getScan` ne renvoie aux comptes gratuits qu'un **aperçu** (premier
  exercice visible, le reste retiré — le document complet n'est jamais
  envoyé au client) ;
- `listMyScans` retire le document complet des réponses de liste ;
- `getSheet` / `listMySheets` ne renvoient aux gratuits que quelques
  concepts d'aperçu + des compteurs (`summary`) ;
- l'export PDF (`buildPdf`) et le contenu complet ne sont affichés que si
  le plan est payant (`useIsPaid`, basé sur `subscriptions.getMyPlan`).

Le déblocage est **automatique** : le webhook Stripe
`checkout.session.completed` appelle `subscriptions.upsertSubscription` avec
`status: "active"` ; les queries réactives renvoient alors immédiatement le
contenu complet et les limites gratuites tombent (voir
`tests/unit/plan-upgrade-workflow.test.ts`).

## Paywall serveur — contenus avancés (analyse approfondie)

Les contenus « avancés » (philosophie, spécialités de lycée — spé, maths
expertes, HGGSP, NSI —, niveau post-bac) sont réservés aux plans Student /
Student Pro. La détection et le blocage sont **côté serveur**, AVANT toute
génération (aucun quota consommé) :

- `detectAdvancedContent` (base de connaissances `src/lib/curriculum.ts`)
  est appelé en tête de `analyzeText` sur le texte OCR ; un compte Gratuit
  reçoit `{ gated: true, reason, category, … }` sans appel au modèle ;
- les contenus classiques (maths, français, histoire-géo, SVT,
  physique-chimie, langues, technologie, SES…) ne sont **jamais** marqués
  (garde-fous : collège, score d'alias dédoublonné, mots isolés de
  vocabulaire) ;
- le frontend affiche le panneau paywall (→ `/pricing`) uniquement sur ce
  résultat serveur ; un abonné actif reçoit l'analyse normale.

La base de connaissances couvre le programme scolaire français (collège
6ᵉ→3ᵉ et lycée Seconde→Terminale) et est injectée en priorité dans le
prompt IA. Quand elle ne couvre pas le contenu (`confidence: low`), une
recherche internet de secours (Brave, clé `SEARCH_API_KEY` dans l'UI Keys)
complète l'analyse — jamais d'exception, jamais de clé côté client.

Preuve : `tests/unit/curriculum-gating.test.ts` (détection des matières,
contenus avancés vs classiques, recherche de secours, gating par plan).

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
