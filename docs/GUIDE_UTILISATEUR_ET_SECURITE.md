# Guide pratique StudySnap — problèmes, réflexes et sécurité

*Ce guide est écrit pour toi, sans jargon. Tu n'as pas besoin de savoir coder
pour t'en servir : chaque problème a un « symptôme », une cause probable et un
réflexe à avoir. La règle d'or : **ne touche à rien, décris ce que tu vois, et
demande**. Les détails techniques précis (fichiers, seuils, preuves) sont dans
`SECURITY.md`.*

---

## Partie 1 — « Mon app a un problème » : symptôme → réflexe

| Problème observé | Cause la plus probable | Réflexe |
|---|---|---|
| **Page blanche / rien ne s'affiche** dans l'aperçu | Erreur de code (TypeScript) qui bloque le chargement, ou le serveur de dev est tombé | 1. Recharge la page (Ctrl+Shift+R / Cmd+Shift+R). 2. Si rien ne change, colle-moi le message d'erreur de la console (F12 → onglet Console) ou la capture d'écran. 3. Ne redémarre rien toi-même. |
| **Impossible de créer un compte** | Clé email absente/invalide, code OTP non reçu, ou le service est momentanément indisponible | Vérifie que les clés (`FREEBUFF_EMAIL_API_KEY`…) sont bien remplies dans l'onglet Keys. Réessaie dans 5 min. Sinon, transmets-moi le message exact affiché. |
| **Impossible de se connecter** (« email ou mot de passe incorrect ») | Mot de passe oublié, ou 5 échecs/heure (protection anti brute-force) | Attends 1 h si le message « trop de tentatives » apparaît (c'est normal : c'est la sécurité qui bloque). Sinon, utilise le lien « mot de passe oublié » / un code par email. |
| **Génération très lente** (scan / fiche / quiz) | L'IA répond lentement (service tiers), réseau, ou photo volumineuse | C'est souvent temporaire. Réessaie. Si c'est systématique, note l'heure et le type de génération (scan, fiche, quiz) et décris-le-moi : je peux mesurer les temps dans le code. |
| **« Trop de demandes » / quota atteint** | Limites de sécurité : 4 scans, 3 fiches, 3 quiz/mois (gratuit, quiz plafonnés à 5 questions) ; 30 générations IA/heure ; 4 s entre deux scans | C'est voulu (anti-abus). Message : attends le délai indiqué, ou passe à un plan payant. Si un utilisateur te dit être bloqué alors qu'il ne devrait pas l'être, vérifie son cas avec moi. |
| **Un scan gratuit affiche « Analyse approfondie réservée aux plans Student »** | Contenu avancé détecté côté serveur (philosophie, spécialité de lycée, post-bac) : c'est le paywall volontaire | C'est voulu : les contenus classiques (maths, français, histoire-géo, SVT, physique-chimie, langues, technologie, SES…) restent gratuits. Si un utilisateur juge son exercice CLASSIQUE bloqué à tort, note le texte exact de l'énoncé et transmets-le-moi (anti-faux-positif). |
| **Paiement Stripe échoue / bouton qui ne fait rien** | Clés Stripe absentes/invalides, webhook mal configuré | Vérifie `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET` dans l'onglet Keys. Regarde le dashboard Stripe (événements du webhook). Je peux rejouer un événement de test avec toi. |
| **Après un changement de compte Stripe, un paiement échoue avec une erreur « No such price »** | L'ancienne config (prix/webhook de l'ancien compte) traînait encore | C'est automatiquement résolu : le premier checkout détecte le changement de compte (`accountId`) et recrée produits + prix + webhook sous le nouveau compte. Recharge la page et réessaie le paiement. |
| **Le code email / consentement parental n'arrive pas** | Clé email absente, envoi bloqué (max 3 codes/15 min), ou spam | Vérifie les spams. Si l'utilisateur a déjà demandé 3 codes en 15 min, il doit attendre. Vérifie la clé email dans l'onglet Keys. |
| **La photo ne se charge pas / erreur au scan** | Fichier trop lourd, format non supporté, ou erreur temporaire | Réessaie avec une photo plus légère (moins de 5 Mo). Sinon colle-moi le message d'erreur. |
| **L'app est cassée sur mobile** (il faut dézoomer, boutons qui débordent) | Régressions de mise en page après une modification | Dis-moi le modèle de téléphone et ce qui déborde ; je corrige le responsive. |
| **Les utilisateurs voient une vieille version** | Cache du navigateur | Recharge avec Ctrl+Shift+R. Vérifie aussi que la dernière version est bien publiée (lien de partage de la plateforme). |
| **« L'app ne répond plus » / erreur 400 sandbox** | Le conteneur/sandbox de la plateforme s'est arrêté (souvent temporaire) | Attends 2-3 min et recharge. Si ça persiste, contacte le support de la plateforme (c'est un problème d'infrastructure, pas du code) en leur collant le message d'erreur exact. |
| **Un utilisateur voit les données d'un autre** | Normalement impossible (chaque donnée est vérifiée côté serveur) | **Signale-le immédiatement** (cf. Partie 2) — c'est le seul cas qui demande une action urgente. |
| **Erreur bizarre avec du texte technique** | Peut être une panne temporaire du backend | Ne cherche pas à comprendre le message : copie-le et envoie-le-moi. |

**Réflexe universel en cas de doute :** note ce que tu faisais, ce qui s'est
affiché, l'heure — et décris-le-moi. Ne modifie jamais de fichiers toi-même.

---

## Partie 2 — Abus et tentatives de piratage : signes et réflexes

### Signes qui doivent t'alerter

1. **Des refus en rafale dans `security_events`** — c'est le journal des
   tentatives bloquées (nouveauté de cette mise à jour). S'il montre beaucoup
   de lignes pour une même cible, c'est un signe d'attaque (brute-force,
   scriptage de l'IA, flood d'emails).
2. **Beaucoup de comptes créés en peu de temps** (ex. : des dizaines en une
   heure) — souvent des bots qui veulent contourner les limites gratuites.
3. **Un seul utilisateur consomme énormément** (centaines de scans) — compte
   scripté, pas un élève.
4. **Des emails envoyés depuis ton domaine que tu n'as pas envoyés** — clé
   email possiblement compromise.
5. **Des paiements étranges / chargebacks** dans le dashboard Stripe.
6. **Quelqu'un accède au compte d'un autre** — signalé par un utilisateur.

### Procédure pas à pas si tu soupçonnes un abus

1. **Ne panique pas, ne casse rien.** Ne supprime pas de comptes à l'aveugle :
   tu perds des données sans résoudre le problème.
2. **Regarde `security_events`** dans le dashboard Convex (ta table est
   listée parmi les tables du déploiement) : trie par `deniedAt` décroissant,
   repère les cibles (`ai:<user>`, `otp:<email>`) avec le plus de refus.
   Copie ce que tu vois et envoie-le-moi.
3. **Rote les clés concernées** (procédure détaillée dans `SECURITY.md`) :
   - email flood → `FREEBUFF_EMAIL_API_KEY` (nouvelle clé + `_PREVIOUS`) ;
   - IA consommée en masse → `AI_API_KEY` / `AI_API_KEY_FAST` ;
   - paiements suspects → `STRIPE_SECRET_KEY` + secret webhook.
   Chaque clé se remplace dans l'onglet **Keys** de la plateforme — jamais dans
   le code.
4. **Bloque le compte abusif** : dans le dashboard Convex, retrouve
   l'utilisateur (table `users`, cherche par email) et passe `role` à
   `"blocked"` ou supprime son compte. Le rate limiting et l'ownership
   serveur l'empêchent déjà d'accéder aux données des autres.
5. **Si c'est une vraie compromission** (clé volée, compte admin touché) :
   contacte le support de la plateforme **et** (si Stripe est concerné) le
   support Stripe, avec une chronologie.
6. **Après coup** : dis-moi ce qui s'est passé, je vérifie que les protections
   ont bien fonctionné (le journal `security_events` le prouve) et je renforce
   si besoin.

### Ce qui est déjà en place (et que tu n'as rien à faire)

- Chaque tentative de connexion ratée, génération IA au-dessus du plafond et
  envoi d'email en rafale est **bloqué et journalisé**.
- Un utilisateur ne peut **jamais** voir, modifier ou supprimer les données
  d'un autre (vérifié côté serveur, testé).
- Les clés ne sont **jamais** dans le code ni exposées aux navigateurs.
- Les sessions expirent, tournent à chaque connexion et sont invalidées à la
  déconnexion.

---

## Partie 3 — Routine hebdomadaire (5 minutes)

1. **Vérifie le journal d'abus** : dashboard Convex → table `security_events`
   → y a-t-il des refus en rafale depuis la dernière fois ?
2. **Vérifie Stripe** : dashboard Stripe → des paiements échoués inhabituels,
   des chargebacks, des événements webhook en erreur ?
3. **Demande-moi de lancer les vérifications automatiques** (je le fais pour
   toi) :
   - `bun test` — les 200 tests de l'app (dont 40+ tests de sécurité) ;
   - `bun run audit:deps` — les dépendances ont-elles des failles connues ?
   - `bun tsc -b --noEmit` — le code est-il sain ?
4. **Regarde les emails de la plateforme** : alertes de quota, de facturation,
  de sécurité.

---

## Partie 4 — Surveillance de disponibilité (uptime)

Depuis cette mise à jour, ton backend expose un point de contrôle santé :
**`GET /health`** (réponse `{"status":"ok"}` si tout va bien). Tu peux l'utiliser
avec un service gratuit de surveillance (UptimeRobot, Better Stack, Cronitor) :

1. Crée un compte sur le service de surveillance.
2. Ajoute une « monitor » de type **HTTPS** avec l'URL :
   `https://<ton-deploiement-convex>.convex.cloud/health`
   (l'adresse de ton déploiement est visible dans la plateforme / le dashboard
   Convex).
3. Règle un intervalle de 5 min et l'alerte par email.
4. Si l'app tombe, **tu es prévenu par email** — tu peux alors suivre la
   Partie 1 (problème de sandbox ou autre).

---

## Partie 5 — Qui fait quoi (pour savoir à qui demander)

| Acteur | Rôle | Quand le solliciter |
|---|---|---|
| **Toi** | Décide, regarde les dashboards (Stripe, Convex, Keys), partage les liens | Toujours le premier : tu observes et tu décides |
| **L'assistant (moi)** | Corrige le code, lance les tests, explique, mesure les performances, renforce la sécurité | Dès qu'il y a un symptôme, un doute ou une décision technique à préparer |
| **Support plateforme (Freebuff)** | Infrastructure : sandbox, serveur de dev, déploiement, clés de la plateforme | Sandbox tombée (erreur 400), aperçu cassé sans cause de code, problème de compte plateforme |
| **Stripe** | Paiements, chargebacks, comptes marchands | Problème de paiement non résolu côté code, litige client |
| **Fournisseur IA** | Qualité et disponibilité du modèle | Générations systématiquement lentes ou en échec alors que le code est sain |

---

## Pour aller plus loin

- **Détails techniques et preuves** : `SECURITY.md` (posture, sessions, rate
  limiting, secrets, procédures de rotation).
- **Menaces et risques résiduels** : `THREAT_MODEL.md`.
- **Correspondance OWASP** : `OWASP_MAPPING.md`.
- **Signaler une vulnérabilité** : ne jamais publier les détails exploitables ;
  écrire à `security@studysnap.app` (voir `SECURITY.md`).
