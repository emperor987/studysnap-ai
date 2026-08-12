# THREAT_MODEL.md — StudySnap

Modèle de menace du produit StudySnap (assistant IA mobile-first : photo d'exercice →
réponse / explication / fiche de révision / quiz). Il couvre les acteurs, les actifs,
les scénarios d'attaque priorisés et les contrôles en place (état actuel, aligné sur
OWASP_MAPPING.md).

## Périmètre

- **Frontend** : React + Vite + Tailwind (SPA).
- **Backend** : Convex (mutations/queries/actions, tables typées, cron, HTTP router
  pour les webhooks).
- **Tiers** : fournisseur IA (OCR + raisonnement), Stripe (paiements), envoi d'emails
  (OTP + consentement parental), stockage d'images Convex (URLs signées temporaires).
- **Auth** : Convex Auth (password scrypt, code par email OTP, invité) + validation
  parentale pour les mineurs.

## Actifs

| Actif | Sensibilité | Où |
|---|---|---|
| Photos de devoirs (contenu privé, parfois scanné de vie privée) | Élevée | Storage Convex + `uploads`, référencées par `scans`/`revision_sheets` |
| Analyses IA (sujet, note, erreurs) | Moyenne | `scans` |
| Compte utilisateur (email, nom, âge, plan) | Moyenne | `users`, `authAccounts` |
| Données de progression / résultats de quiz | Faible–Moyenne | `quizzes`, `quiz_answers` |
| Paiements | Élevée | Stripe (hors de nos systèmes) + `subscriptions` |
| Clés API (IA, Stripe, webhook, email) | Critique | `process.env` côté « use node » uniquement |
| Token de consentement parental | Critique | URL d'email → hash SHA-256 en base |

## Acteurs

| Acteur | Motivations | Capacités |
|---|---|---|
| Élève utilisateur | Honnête / curieux (lire ses données, tricher sur son score) | Authentifié, API client |
| Élève malveillant | Accéder aux devoirs des autres, fausser sa progression, contourner les quotas | Authentifié, API client, outils dev |
| Attaquant externe | Vol de données, phishing, abus de ressources, fraude de paiement | Non authentifié, forge de requêtes webhook |
| Administrateur / plateforme | — | Accès infra (hors menace) |

## Scénarios priorisés (STRIDE) et contrôles

### S1 — BOLA/IDOR : lire/OCR/supprimer la photo d'un autre élève (Spofing→Info disclosure)
- **Vecteur** : deviner un `storageId` (ou un id de scan/fiche) et l'utiliser dans
  `getStorageUrl`, `recordScan`, `ocrPhotos`, `deleteScan`.
- **Contrôles** : registre d'ownership `uploads` ; `getStorageUrl` → `null` si non
  propriétaire ; mutations/actions lèvent `INVALID_UPLOAD` ; URLs signées et temporaires ;
  queries par utilisateur.
- **Preuve** : `tests/security/storage-access.test.ts`, `tests/security/auth.test.ts`.

### S2 — Mass assignment : usurper un rôle, un propriétaire ou un statut (Privilege escalation)
- **Vecteur** : passer `userId`, `role`, `status`, `score`, `isAnonymous` dans le body.
- **Contrôles** : arguments validés (`convex/values`), valeurs imposées par le serveur
  (`userId` = session, `status`/`score` recalculés, `role` jamais modifiable).
- **Preuve** : `tests/security/auth.test.ts` (« Mass assignment »).

### S3 — Falsification du score de quiz (Integrity)
- **Vecteur** : envoyer `isCorrect: true` pour toutes les réponses.
- **Contrôles** : `saveQuizResult` ignore `isCorrect` et recalcule la justesse côté
  serveur ; les réponses hors bornes sont ignorées.
- **Preuve** : `tests/security/quiz-grading.test.ts`.

### S4 — Contournement des quotas / abus de ressources (Denial of wallet / abuse)
- **Vecteur** : spam de générations IA (coût par appel), scans trop rapprochés.
- **Contrôles** : quotas par plan (5 scans / 3 fiches / 3 quiz gratuits), espacement
  de 4 s entre scans, OTP à durée courte, génération d'URL d'upload soumise à session.
- **Preuve** : `tests/security/rate-limit-and-injection.test.ts`.

### S5 — Rejeu / falsification du webhook Stripe (Integrity, spoofing)
- **Vecteur** : rejouer une notification valide (double activation de plan) ou forger
  un payload.
- **Contrôles** : HMAC-SHA256 (Web Crypto) + anti-rejeu par timestamp `t=` (± 5 min) ;
  le webhook ne renvoie pas de données sensibles.
- **Preuve** : `tests/security/stripe-webhook.test.ts`.

### S6 — Phishing / vol de token via le lien email parental (Spoofing, Information disclosure)
- **Vecteur** : injecter une `siteUrl` attaquante (le lien du token partirait vers
  evil.com) ; fuite du token via le Referer.
- **Contrôles** : validation d'origine (`resolveSiteBaseUrl` — strict en production,
  https + sans credentials toujours), token haché en base, usage unique, expiration
  72 h, `<meta name="referrer" content="no-referrer">`.
- **Preuve** : `tests/security/url-validation.test.ts`, `tests/security/secrets.test.ts`.

### S7 — XSS via contenu IA ou OCR (execution)
- **Vecteur** : un devoir injecte un prompt qui fait renvoyer à l'IA du HTML/JS
  (`<img onerror>`, `<script>`, `javascript:`).
- **Contrôles** : react-markdown sans `rehype-raw` + `stripHtmlArtifacts` (double
  défense), lien `javascript:` neutralisé, `dangerouslySetInnerHTML` interdit hors
  primitives.
- **Preuve** : `tests/security/xss-render.test.tsx`, `tests/security/frontend-and-infra.test.ts`.

### S8 — Injection (SQL/NoSQL/opérateurs) (execution, data integrity)
- **Vecteur** : payloads `' OR 1=1`, `{"$gt": ""}` dans les champs texte ou les ids.
- **Contrôles** : base documentaire typée Convex ; les valeurs sont stockées comme
  données ; les ids sont des clés opaques.
- **Preuve** : `tests/security/rate-limit-and-injection.test.ts`.

### S9 — Fuite de secrets / erreurs verbeuses (Information disclosure)
- **Vecteur** : stack traces dans les erreurs client, clé API dans un message d'erreur
  d'envoi, token dans les logs.
- **Contrôles** : erreurs génériques (code + message pédagogique), aucun `console.*`
  sensible, clés uniquement en env, JSON.stringify d'erreur axios interdit.
- **Preuve** : `tests/security/secrets.test.ts`, `rate-limit-and-injection.test.ts`,
  `frontend-and-infra.test.ts` (logs).

### S10 — Open redirect via `returnTo` (phishing)
- **Vecteur** : `?returnTo=https://evil.com` après connexion.
- **Contrôles** : `resolveRedirectAfterAuth` (chemins relatifs uniquement, variantes
  `//`, `\` rejetées).
- **Preuve** : `tests/security/frontend-and-infra.test.ts` (Open redirect).

### S11 — CSRF (session hijacking)
- **Vecteur** : formulaire hostile dans une autre origine déclenchant des mutations.
- **Contrôles** : sessions Convex Auth en cookie httpOnly (non lisibles par JS), pas
  d'authentification par cookie lisible → CSRF non applicable ; aucun CORS sauvage.
- **Preuve** : `frontend-and-infra.test.ts` (CORS, cookies).

### S12 — Attaques sur les sessions / tokens
- **Vecteur** : session persistante après déconnexion, token parental réutilisable.
- **Contrôles** : sessions révocables (Convex Auth), token parental à usage unique
  (réinitialisé après confirmation) et expirant.
- **Preuve** : `secrets.test.ts`, revue.

## Risques résiduels acceptés

1. **Mode dev / aperçu** : sans `SITE_URL`, les liens email acceptent toute origine
   https (nécessaire pour la preview). Strict en production dès que `SITE_URL` est
   défini. → Mettre en place au déploiement.
2. **Clickjacking** : `frame-ancestors` non bloquant pour préserver l'aperçu en iframe
   (Freebuff). Mitigé par sessions httpOnly + vérifications d'origine serveur.
3. **Rate limiting IP** : quotas par compte, pas par IP (un bot peut créer des comptes).
4. **Audit de dépendances** : `bun audit` pas en CI (à ajouter).
5. **Rotation des secrets** : manuelle.
6. **SSRF** : les appels sortants sont vers des endpoints fixes ; le contenu OCR
   (texte extrait d'une image) n'est pas utilisé comme URL.

## Hypothèses

- Les clés d'environnement sont correctement configurées via l'UI Keys (pas de
  commit de secrets).
- Le fournisseur IA est considéré comme fiable pour le contenu qu'on lui envoie
  (les photos de devoirs, déjà stockées chez nous).
- Le compte de service Convex / la plateforme d'hébergement est de confiance.
