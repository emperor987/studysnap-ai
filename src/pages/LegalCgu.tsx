import {
  LegalLayout,
  LegalList,
  LegalNote,
  LegalSection,
} from "@/components/legal";
import { Link } from "react-router";

export default function LegalCgu() {
  return (
    <LegalLayout
      badge="⚖️ Conditions Générales d'Utilisation"
      title="Conditions Générales d'Utilisation"
      subtitle="Les règles qui encadrent ton utilisation de StudySnap. Lis-les une fois, elles sont écrites simplement — on explique tout en français clair."
      lastUpdated="Août 2026"
    >
      <LegalNote>
        📌 StudySnap est édité par une société en cours d&apos;immatriculation en
        France. Les mentions d&apos;identification (SIRET, forme juridique, siège
        social) seront complétées dès la création officielle de l&apos;entreprise.
        Les présentes CGU restent pleinement applicables en attendant.
      </LegalNote>

      <LegalSection title="Article 1 — Objet">
        <p>
          StudySnap est un service d&apos;assistance scolaire par intelligence
          artificielle. Il permet à l&apos;utilisateur de prendre en photo un
          exercice ou un cours (ou d&apos;en coller le texte) et d&apos;obtenir,
          selon le mode choisi :
        </p>
        <LegalList
          items={[
            <>
              <strong className="text-foreground">⚡ Réponse rapide</strong> : la
              réponse finale et le calcul essentiel, formulés simplement ;
            </>,
            <>
              <strong className="text-foreground">👨‍🏫 Explication</strong> : une
              explication pédagogique pas à pas, adaptée au niveau détecté ;
            </>,
            <>
              <strong className="text-foreground">📚 Révision</strong> : une
              mini-leçon, les formules clés, des exercices similaires et un quiz
              pour vérifier l&apos;acquisition.
            </>,
          ]}
        />
        <p>
          Les présentes Conditions Générales d&apos;Utilisation (ci-après « les
          CGU ») définissent les conditions d&apos;accès et d&apos;utilisation du
          service StudySnap entre l&apos;éditeur (ci-après « StudySnap » ou
          « nous ») et toute personne utilisant le service (ci-après «
          l&apos;utilisateur » ou « tu »).
        </p>
      </LegalSection>

      <LegalSection title="Article 2 — Accès au service et création de compte">
        <LegalList
          items={[
            <>
              <strong className="text-foreground">Création de compte</strong> :
              l&apos;accès au service nécessite la création d&apos;un compte avec
              une adresse email valide et un mot de passe. Le mot de passe est
              stocké de façon sécurisée (hashé), il n&apos;est jamais conservé
              en clair.
            </>,
            <>
              <strong className="text-foreground">Âge minimum</strong> : le
              service est destiné aux lycéens, collégiens et étudiants.
              L&apos;inscription est ouverte aux personnes âgées d&apos;au moins
              13 ans. Pour les mineurs de moins de 15 ans, l&apos;accord d&apos;un
              représentant légal est requis. En t&apos;inscrivant, tu déclares
              remplir ces conditions.
            </>,
            <>
              <strong className="text-foreground">Exactitude des informations</strong>{" "}
              : tu t&apos;engages à fournir des informations exactes et à jour.
              Tu es responsable de la confidentialité de ton mot de passe et de
              toute activité réalisée depuis ton compte.
            </>,
            <>
              <strong className="text-foreground">Compte invité (démo)</strong> :{" "}
              une connexion en invité permet de découvrir le service sans
              créer de mot de passe. Les données associées à un compte invité
              sont conservées uniquement le temps de la session de découverte.
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection title="Article 3 — Description des offres">
        <p>StudySnap propose trois formules :</p>
        <LegalList
          items={[
            <>
              <strong className="text-foreground">Gratuit — 0 €/mois</strong> :{" "}
              4 scans d&apos;exercices par mois, 3 fiches de révision par mois, 3 quiz
              par mois (5 questions maximum par quiz),
              3 quiz par mois, l&apos;accès aux 3 modes de réponse (rapide,
              explication, révision) et l&apos;historique des exercices.
            </>,
            <>
              <strong className="text-foreground">Student — 4,99 €/mois</strong>{" "}
              (ou <strong className="text-foreground">49,99 €/an</strong>, soit
              environ 4,17 €/mois — 2 mois offerts) : scans illimités (dans le
              cadre d&apos;un usage raisonnable, voir Article 5), fiches de
              révision illimitées, quiz illimités (5 à 20 questions),
              explications adaptées au niveau, support par email.
            </>,
            <>
              <strong className="text-foreground">
                Student Pro — 6,99 €/mois
              </strong>{" "}
              (ou <strong className="text-foreground">69,99 €/an</strong>, soit
              environ 5,83 €/mois — 2 mois offerts) : tout le plan Student,
              plus l&apos;analyse multi-pages (plusieurs photos), des
              statistiques avancées de progression, la priorité IA (réponses
              plus rapides) et l&apos;export PDF des fiches.
            </>,
          ]}
        />
        <p>
          Les prix incluent la TVA applicable en France. StudySnap se réserve
          le droit de faire évoluer les offres, les prix et les avantages, dans
          le respect de l&apos;Article 11 des présentes CGU.
        </p>
      </LegalSection>

      <LegalSection title="Article 4 — Abonnement, facturation et résiliation">
        <LegalList
          items={[
            <>
              <strong className="text-foreground">Reconduction automatique</strong>{" "}
              : les abonnements payants sont souscrits pour une durée d&apos;un
              mois et sont reconduits automatiquement à chaque échéance,
              sauf résiliation.
            </>,
            <>
              <strong className="text-foreground">Résiliation à tout moment</strong>{" "}
              : tu peux résilier ton abonnement à tout moment depuis les
              Paramètres de ton compte (bouton « Gérer mon abonnement ») ou en
              nous contactant. La résiliation prend effet à la fin de la période
              en cours : tu conserves l&apos;accès jusqu&apos;au terme de la
              période déjà payée.
            </>,
            <>
              <strong className="text-foreground">Remboursements</strong> : le
              service étant fourni de manière continue, il n&apos;est pas
              procédé à des remboursements au prorata en cas de résiliation en
              cours de période, sauf obligation légale applicable.
            </>,
            <>
              <strong className="text-foreground">Impayés</strong> : en cas
              d&apos;échec de paiement, nous t&apos;informerons par email. Le
              service peut être suspendu en cas de non-régularisation, puis le
              compte repasse en formule gratuite.
            </>,
            <>
              <strong className="text-foreground">Paiement sécurisé</strong> : les
              paiements sont traités exclusivement par notre prestataire Stripe.
              StudySnap ne stocke jamais tes numéros de carte bancaire (voir la
              Politique de confidentialité).
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection title="Article 5 — Utilisation du service">
        <LegalList
          items={[
            <>
              <strong className="text-foreground">Usage personnel</strong> : le
              service est réservé à un usage strictement personnel, scolaire et
              non commercial. Il est interdit de revendre, redistribuer ou
              exploiter commercialement les contenus générés.
            </>,
            <>
              <strong className="text-foreground">Usage raisonnable</strong> : les
              offres illimitées le sont dans le cadre d&apos;un usage
              raisonnable pour un élève ou étudiant. Un usage automatisé,
              massif ou anormal (ex. des centaines de scans quotidiens) peut
              être considéré comme abusif.
            </>,
            <>
              <strong className="text-foreground">Interdictions</strong> : il est
              interdit d&apos;utiliser le service pour du spam, du harcèlement,
              du contenu illégal ou frauduleux, de tenter d&apos;accéder aux
              comptes d&apos;autres utilisateurs, ou de contourner les
              mécanismes de sécurité et de limitation.
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection title="Article 6 — Contenu généré par IA">
        <LegalList
          items={[
            <>
              <strong className="text-foreground">Nature du service</strong> : les
              réponses, explications, fiches et quiz sont générés par une
              intelligence artificielle. Comme tout système d&apos;IA, ils
              peuvent contenir des <strong className="text-foreground">erreurs,
              approximations ou imprécisions</strong>. StudySnap fait son
              possible pour être fiable, mais ne peut pas garantir
              l&apos;exactitude de chaque réponse.
            </>,
            <>
              <strong className="text-foreground">Aide à la compréhension</strong>{" "}
              : le service est un outil d&apos;aide à la compréhension et à la
              révision. Il ne remplace pas un enseignant, un cours ni un
              encadrement pédagogique humain.
            </>,
            <>
              <strong className="text-foreground">Responsabilité de
              l&apos;utilisateur</strong> : tu restes responsable de la
              vérification des réponses avant toute utilisation en contrôle, en
              examen ou dans un travail noté. L&apos;usage de StudySnap doit
              respecter les règles de ton établissement.
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection title="Article 7 — Propriété intellectuelle">
        <LegalList
          items={[
            <>
              <strong className="text-foreground">Propriété de StudySnap</strong>{" "}
              : la marque StudySnap, le logo, le design, l&apos;interface et la
              technologie du service sont la propriété exclusive de StudySnap.
              Toute reproduction ou utilisation non autorisée est interdite.
            </>,
            <>
              <strong className="text-foreground">Tes contenus</strong> : les
              photos d&apos;exercices que tu importes restent ta propriété. Nous
              ne les utilisons que pour te fournir le service (voir la
              Politique de confidentialité).
            </>,
            <>
              <strong className="text-foreground">Contenus générés</strong> : les
              fiches, réponses et quiz générés pour ton compte te sont
              destinés. Tu disposes d&apos;un droit d&apos;usage pour ton usage
              personnel et scolaire uniquement.
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection title="Article 8 — Responsabilité">
        <LegalList
          items={[
            <>
              <strong className="text-foreground">Disponibilité</strong> :
              StudySnap s&apos;efforce de maintenir le service accessible, mais
              ne peut garantir une disponibilité ininterrompue (maintenances,
              incidents techniques, fournisseur d&apos;IA, réseau…). La
              responsabilité de StudySnap est limitée en cas
              d&apos;indisponibilité temporaire.
            </>,
            <>
              <strong className="text-foreground">Résultats scolaires</strong> :{" "}
              StudySnap ne garantit aucun résultat scolaire, note ou
              progression. Le service est un outil ; les résultats dépendent de
              l&apos;utilisation qui en est faite.
            </>,
            <>
              <strong className="text-foreground">Limitation</strong> : la
              responsabilité de StudySnap est limitée aux dommages directs et
              prévisibles, dans les limites prévues par la loi. Rien dans les
              présentes CGU n&apos;exclut la responsabilité en cas de faute
              lourde ou de dol.
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection title="Article 9 — Résiliation par StudySnap">
        <p>
          StudySnap peut suspendre ou résilier un compte en cas de manquement
          aux présentes CGU, notamment en cas de :
        </p>
        <LegalList
          items={[
            "fraude, tentative de piratage ou accès non autorisé au service ;",
            "usage abusif, automatisé ou détournement du service ;",
            "contenu illégal, harcèlement ou comportement préjudiciable envers d'autres utilisateurs ;",
            "non-paiement persistant après relance.",
          ]}
        />
        <p>
          Tu seras informé·e de la suspension ou résiliation par email, sauf si
          la loi ou une urgence l&apos;interdit. Tu peux demander une
          explication et contester la décision en nous écrivant.
        </p>
      </LegalSection>

      <LegalSection title="Article 10 — Droit applicable et litiges">
        <p>
          Les présentes CGU sont soumises au <strong className="text-foreground">droit
          français</strong>. En cas de litige, les parties s&apos;engagent à
          rechercher une <strong className="text-foreground">résolution
          amiable</strong> avant tout recours judiciaire : écris-nous d&apos;abord
          à{" "}
          <a
            href="mailto:support@studysnap.app"
            className="text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
          >
            support@studysnap.app
          </a>
          , nous répondons sous 48 h ouvrées. À défaut d&apos;accord amiable, le
          litige sera porté devant les tribunaux français compétents.
        </p>
      </LegalSection>

      <LegalSection title="Article 11 — Modification des CGU">
        <p>
          StudySnap peut faire évoluer les présentes CGU à tout moment (évolutions
          du service, évolutions légales ou réglementaires). Les utilisateurs
          seront notifiés par email en cas de modification substantielle. Les
          nouvelles CGU s&apos;appliquent à compter de leur notification ; la
          poursuite de l&apos;utilisation du service après cette date vaut
          acceptation. Tu peux consulter la version à jour à tout moment sur
          cette page.
        </p>
      </LegalSection>

      <LegalSection title="Une question ?">
        <p>
          Contacte-nous via la{" "}
          <Link
            to="/legal/contact"
            className="text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
          >
            page Contact
          </Link>{" "}
          — question générale, support technique, facturation ou demande RGPD,
          on répond sous 48 h ouvrées.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
