# OWASP Mapping — StudySnap

Cartographie des contrôles de sécurité de StudySnap contre l'**OWASP Top 10 : 2025** et
l'**OWASP ASVS 5.0.0** (extraits). Chaque entrée indique le risque, les fichiers concernés,
le contrôle en place et le test qui le prouve.

Légende statuts : ✅ contrôlé et testé · ⚠️ atténué (risque résiduel documenté) · ❌ non couvert

---

## A01 / A02 — Broken Access Control & Cryptographic Failures

| Contrôle | Fichiers | Statut | Test |
|---|---|---|---|
| **Ownership (IDOR/BOLA)** : chaque requête filtre sur `userId` ; les queries renvoient `null`, les mutations sont sans effet sur les données d'autrui | `scans.ts`, `revisionSheets.ts`, `quizzes.ts`, `usage.ts` | ✅ | `tests/security/auth.test.ts` (getScan/listMyScans/deleteScan/getSheet/getQuiz/getMyUsage) |
| **Registre d'ownership des uploads** : `storageId → userId` ; aucune lecture/OCR/attachement/suppression d'un fichier d'autrui | `schema.ts` (table `uploads`), `files.ts`, `scans.ts`, `revisionSheets.ts`, `ai.ts` | ✅ | `tests/security/storage-access.test.ts` |
| **Mass assignment** : `userId`, `role`, `status`, `score` fournis par le client ignorés (valeurs imposées par le serveur) | `scans.ts`, `quizzes.ts`, `users.ts` | ✅ | `tests/security/auth.test.ts` (« Mass assignment ») |
| **Fonctions internes non exposées au client** : cleanup, cron, rappels parentaux passés en `internalMutation`/`internalAction` | `cleanup.ts`, `crons.ts`, `parentalConsent.ts`, `parentalConsentStatus.ts` | ✅ | `convex dev --once` + revue |
| **Sessions** : cookies httpOnly + Secure + Partitioned (Convex Auth) ; aucun token/session en `localStorage`/`sessionStorage`/cookie JS ; expiration ABSOLUE 14 j ; rotation de session à chaque connexion (anti-fixation) ; invalidation serveur au logout (suppression du session document + refresh tokens) | `auth.ts`, `auth.config.ts` | ✅ | `tests/security/sessions.test.ts`, `frontend-and-infra.test.ts` |
| **Mots de passe** : hash scrypt (provider Password), jamais stockés par notre code, anti-brute-force (`maxFailedAttempsPerHour: 5`, compteur distribué) | `auth.ts` | ✅ | `tests/security/frontend-and-infra.test.ts` |
| **Secrets** : aucune clé en dur ; clés lues depuis `process.env` (UI Keys) ; tokens parentaux hachés SHA-256 ; **rotation avec chevauchement** (clé précédente de secours : email OTP, webhook Stripe) ; scans de secrets repo-wide | `emailOtp.ts`, `ai.ts`, `stripe.ts`, `consent-token.ts` | ✅ | `tests/security/secrets.test.ts`, `secrets-rotation.test.ts` |

## A03 — Injection

| Contrôle | Fichiers | Statut | Test |
|---|---|---|---|
| Pas de SQL/NoSQL : base Convex typée ; les payloads (`' OR 1=1`, `{"$gt":""}`) sont stockés comme données brutes | tous (`src/convex`) | ✅ | `tests/security/rate-limit-and-injection.test.ts` (« Injection ») |
| XSS : rendu Markdown sans `rehype-raw` + `stripHtmlArtifacts` (aucune balise brute) ; `dangerouslySetInnerHTML` interdit hors primitives shadcn | `markdown.tsx`, `lib/clean.ts` | ✅ | `tests/security/xss-render.test.tsx`, `tests/security/frontend-and-infra.test.ts` (XSS) |
| Path traversal : pas d'accès au filesystem dans Convex ; ids de stockage = clés opaques | tous (`src/convex`) | ✅ | `tests/security/frontend-and-infra.test.ts` (« Path traversal »), `rate-limit-and-injection.test.ts` |

## A04 — Insecure Design

| Contrôle | Fichiers | Statut | Test |
|---|---|---|---|
| **Anti-triche** : `saveQuizResult` recalcule la justesse côté serveur, ignore `isCorrect` du client, borne le nombre de réponses | `quizzes.ts` | ✅ | `tests/security/quiz-grading.test.ts` |
| **Rate limiting multi-dimension (distribué)** : quotas mensuels par compte (5 scans / 3 fiches / 3 quiz) ; espacement 4 s entre scans ; **générations IA par compte/heure** (30/h, fenêtre glissante `rate_limits`) ; **envois OTP par email** (3/15 min) ; anti-brute-force auth (5 échecs/h) ; erreur `RATE_LIMITED` + délai de réessai. Limite par IP : portée par la plateforme (Convex n'expose pas l'IP client — voir SECURITY.md) | `rateLimit.ts`, `scans.ts`, `revisionSheets.ts`, `quizzes.ts`, `ai.ts`, `emailOtp.ts`, `auth.ts` | ✅ | `tests/security/rate-limit.test.ts`, `rate-limit-and-injection.test.ts` |
| **Uploads** : URL d'upload signées et temporaires, session obligatoire, tailles/caps | `files.ts`, `quizzes.ts`, `revisionSheets.ts` | ✅ | `tests/security/rate-limit-and-injection.test.ts` (« Uploads ») |
| **OTP** : code 6 chiffres, expiration 15 min | `emailOtp.ts` | ✅ | `frontend-and-infra.test.ts` |

## A05 — Security Misconfiguration

| Contrôle | Fichiers | Statut | Test |
|---|---|---|---|
| En-têtes de sécurité — **anti-clickjacking BLOQUANT** : production `frame-ancestors 'none'` + `X-Frame-Options: DENY` (aucun embedding légitime) ; aperçu de dev : liste d'origines Freebuff explicites (`vite.config.ts` server.headers) ; `nosniff`, `Referrer-Policy`, `Permissions-Policy` | `public/_headers`, `vite.config.ts`, `index.html` | ✅ | `tests/security/clickjacking.test.ts` (politique évaluée contre des origines hostiles), `frontend-and-infra.test.ts` (« En-têtes ») |
| Pas de CORS sauvage : aucun `Access-Control-Allow-Origin: *` ; le routeur HTTP ne définit pas de CORS | `http.ts`, `stripe.ts` | ✅ | `frontend-and-infra.test.ts` (« CORS ») |
| **Gestion d'erreurs** : erreurs métier = code + message pédagogique, jamais de stack trace ; erreurs d'envoi génériques (aucun secret) | `scans.ts`, `files.ts`, `emailOtp.ts` | ✅ | `rate-limit-and-injection.test.ts` (« Gestion d'erreurs »), `secrets.test.ts` |
| **Logs** : aucun `console.*` ne journalise mot de passe/token/cookie/Authorization | tous (`src`) | ✅ | `frontend-and-infra.test.ts` (« Redaction des logs ») |

## A06 — Vulnerable and Outdated Components

| Contrôle | Fichiers | Statut | Test |
|---|---|---|---|
| CI exécute la suite de sécurité à chaque push/PR | `.github/workflows/security-tests.yml` | ✅ | `bun test tests/security` |
| **Audit de dépendances en CI** : `bun run audit:deps` (bun audit directes + transitives, seuil « high », exceptions documentées et datées dans `security/audit-exceptions.json`) ; workflow planifié hebdomadaire | `.github/workflows/security-audit.yml`, `scripts/audit-check.ts` | ✅ | `bun run audit:deps` (local + CI) |

## A07 — Identification & Authentication Failures

| Contrôle | Fichiers | Statut | Test |
|---|---|---|---|
| Connexion en étapes (email → « Choisir ton compte » → mot de passe) ; erreurs génériques (pas d'énumération de comptes exploitable) | `pages/Auth.tsx`, `users.ts` (accountsByEmail) | ✅ | tests unitaires `auth-accounts.test.ts` |
| Sessions révocables Convex Auth ; `getAuthUserId` sur chaque handler | tous (`src/convex`) | ✅ | `auth.test.ts` |

## A08 — Software & Data Integrity Failures

| Contrôle | Fichiers | Statut | Test |
|---|---|---|---|
| **Webhook Stripe** : vérification HMAC-SHA256 + **anti-rejeu** (timestamp `t=` à ± 5 min) ; **multi-secrets** (env primaire / précédente / provisionnée) pour la rotation en chevauchement | `stripe.ts` | ✅ | `tests/security/stripe-webhook.test.ts`, `secrets-rotation.test.ts` |

## A09 — Security Logging & Monitoring Failures

| Contrôle | Fichiers | Statut | Test |
|---|---|---|---|
| Logs de timing IA sans secrets (`[StudySnap ai]`) ; pas de données sensibles | `ai.ts` | ✅ | `frontend-and-infra.test.ts` (redaction) |
| **Audit trail** : historique des scans/fiches/quiz par utilisateur (données applicatives) ; pas de journal d'audit serveur dédié | — | ⚠️ | hors périmètre MVP |

## A10 — Server-Side Request Forgery (SSRF)

| Contrôle | Fichiers | Statut | Test |
|---|---|---|---|
| Aucune URL arbitraire fournie par le client n'est fetchée côté serveur (les appels sortants sont fixés : fournisseur IA, Stripe, email) | `ai.ts`, `stripe.ts`, `emailOtp.ts`, `vly-integrations.ts` | ✅ | revue statique |

## Cross-cutting (OWASP ASVS 5.0.0)

| Exigence ASVS | Contrôle | Statut | Test |
|---|---|---|---|
| V1 Architecture | Séparation backend (`src/convex`, « use node » pour les secrets) / frontend ; aucune clé côté client | ✅ | `secrets.test.ts` |
| V2 Authentification | OTP à durée courte, anti-brute-force, sessions httpOnly | ✅ | `frontend-and-infra.test.ts` |
| V4 Contrôle d'accès | Ownership systématique, fonctions internes, queries sans session → données vides | ✅ | `auth.test.ts`, `storage-access.test.ts` |
| V5 Validation | Validation des arguments (`convex/values`), caps de taille, format email | ✅ | `rate-limit-and-injection.test.ts` |
| V6 Cryptographie | Tokens 256 bits (`randomBytes(32)`), hash SHA-256 des tokens parentaux, clés en env | ✅ | `secrets.test.ts` |
| V7 Erreurs & logs | Erreurs génériques, pas de stack, pas de secrets dans les logs | ✅ | `rate-limit-and-injection.test.ts`, `frontend-and-infra.test.ts` |
| V8 Protection des données | URLs signées temporaires, rétention + suppression auto (cron), suppression à la fermeture du compte | ✅ | `rate-limit-and-injection.test.ts`, `account.ts` |
| V9 Communication | HTTPS, no-referrer sur le token parental | ✅ | `index.html`, `_headers` |
| V11 Business logic | Quotas par plan, anti-triche quiz, anti-rejeu webhook | ✅ | `rate-limit-and-injection.test.ts`, `quiz-grading.test.ts`, `stripe-webhook.test.ts` |
| V12 Fichiers & uploads | Registre d'ownership, formats/caps, suppression | ✅ | `storage-access.test.ts` |

## Points à surveiller (risques résiduels)

1. **Origines en mode dev** : sans `SITE_URL`/`CONVEX_SITE_URL`, les liens email acceptent toute origine https (nécessaire pour l'aperçu) — les contrôles https/credentials restent actifs. **En production, configurer `SITE_URL`** pour activer le régime strict (`src/lib/url.ts`).
2. **Rate limiting par IP / réseau** : les quotas sont par compte et par email — pas par IP (Convex 1.43 n'expose pas l'adresse IP client aux fonctions). Un bot authentifié peut multiplier les comptes ; couverture IP à porter par la plateforme (WAF/rate limiting du domaine de production, protections de l'aperçu).
3. **Rotation des secrets** : mécanismes de chevauchement en place (email OTP, webhook Stripe) ; le déclenchement reste manuel (runbook SECURITY.md) — rotation automatique non automatisable sans infrastructure dédiée (à confier à l'opérateur de la plateforme).
4. **Clickjacking** : l'aperçu de dev autorise les origines de la plateforme Freebuff (nécessaire pour l'iframe) — production bloquée à `'none'`/DENY.
