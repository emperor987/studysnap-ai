import {
  LegalLayout,
  LegalList,
  LegalNote,
  LegalSection,
  LegalTable,
} from "@/components/legal";
import { Link } from "react-router";

export default function LegalPrivacy() {
  return (
    <LegalLayout
      badge="🔒 Politique de confidentialité"
      title="Politique de confidentialité"
      subtitle="Comment StudySnap collecte, utilise et protège tes données personnelles, conformément au Règlement Général sur la Protection des Données (RGPD)."
      lastUpdated="Août 2026"
    >
      <LegalNote>
        📌 StudySnap s&apos;engage à protéger tes données : on collecte le
        minimum nécessaire, on n&apos;utilise tes photos que pour te répondre,
        et on ne vend jamais tes données à des tiers.
      </LegalNote>

      <LegalSection title="Préambule — notre engagement">
        <p>
          StudySnap agit en qualité de responsable de traitement au sens du
          RGPD (Règlement (UE) 2016/679) et de la loi Informatique et Libertés.
          Nous collectons uniquement les données strictement nécessaires au
          fonctionnement du service, nous les protégeons techniquement, et
          nous te donnons un contrôle total sur elles (accès, correction,
          suppression).
        </p>
      </LegalSection>

      <LegalSection title="1. Données collectées et finalités">
        <p>
          Voici, de façon transparente, les données que nous traitons et la
          raison pour laquelle nous les traitons :
        </p>
        <LegalTable
          head={["Donnée collectée", "Finalité", "Base légale"]}
          rows={[
            [
              <>
                <strong className="text-foreground">Email et mot de passe</strong>{" "}
                (mot de passe stocké hashé, jamais en clair)
              </>,
              "Création et gestion du compte, connexion sécurisée, contact si nécessaire",
              "Exécution du contrat (CGU)",
            ],
            [
              <>
                <strong className="text-foreground">Photos d'exercices
                uploadées</strong>
              </>,
              "Génération de la réponse, de l'explication ou de la fiche de révision. Elles ne sont utilisées à aucune autre fin",
              "Exécution du contrat (CGU)",
            ],
            [
              <>
                <strong className="text-foreground">Historique : scans,
                fiches, quiz et résultats</strong>
              </>,
              "Suivi de ta progression personnelle, accès à ton historique, amélioration de l'expérience",
              "Exécution du contrat (CGU) + intérêt légitime",
            ],
            [
              <>
                <strong className="text-foreground">Données de paiement</strong>
              </>,
              <>
                Traitées exclusivement par notre prestataire <strong className="text-foreground">Stripe</strong>{" "}
                (facturation, abonnement). StudySnap ne stocke jamais les
                numéros de carte bancaire
              </>,
              "Exécution du contrat (CGU)",
            ],
            [
              <>
                <strong className="text-foreground">Données techniques</strong>{" "}
                (adresse IP, type d'appareil, navigateur)
              </>,
              "Sécurité du service, prévention des fraudes, bon fonctionnement",
              "Intérêt légitime",
            ],
          ]}
        />
      </LegalSection>

      <LegalSection title="2. Durée de conservation des données">
        <LegalTable
          head={["Donnée", "Durée de conservation"]}
          rows={[
            [
              "Compte utilisateur (email, profil)",
              "Tant que le compte est actif — supprimé à la demande de l'utilisateur, ou après une période d'inactivité prolongée",
            ],
            [
              "Photos d'exercices",
              "Supprimées automatiquement après 30 jours, sauf si elles sont volontairement conservées (fiche de révision, historique sauvegardé)",
            ],
            [
              "Historique des scans, fiches, quiz et résultats",
              "Tant que le compte est actif — supprimé avec le compte",
            ],
            [
              "Données de facturation",
              "Conservées selon les obligations légales comptables françaises (10 ans pour les documents comptables)",
            ],
            [
              "Journaux techniques (IP, logs de sécurité)",
              "Durée limitée (quelques semaines à quelques mois), le temps de la protection du service",
            ],
          ]}
        />
      </LegalSection>

      <LegalSection title="3. Destinataires et sous-traitants">
        <p>
          Nous ne vendons jamais tes données à des tiers à des fins
          commerciales. Tes données ne sont partagées qu&apos;avec les
          prestataires strictement nécessaires au fonctionnement du service :
        </p>
        <LegalList
          items={[
            <>
              <strong className="text-foreground">Stripe</strong> (paiement et
              gestion des abonnements) — données de paiement uniquement ;
            </>,
            <>
              <strong className="text-foreground">Hébergeur</strong> du site et
              de la base de données (infrastructure cloud) — données hébergées ;
            </>,
            <>
              <strong className="text-foreground">Fournisseur d'IA</strong> pour
              l&apos;analyse des photos et la génération des réponses — les
              photos et textes sont transmis le temps du traitement ;
            </>,
            <>
              <strong className="text-foreground">Service d'envoi d'emails</strong>{" "}
              (codes de connexion, notifications) — adresse email uniquement.
            </>,
          ]}
        />
        <p>
          Chaque sous-traitant est lié par des engagements contractuels de
          protection des données conformes au RGPD.
        </p>
      </LegalSection>

      <LegalSection title="4. Transferts hors Union européenne">
        <p>
          Certains de nos sous-traitants (notamment le fournisseur
          d&apos;intelligence artificielle et l&apos;hébergeur) peuvent être
          situés en dehors de l&apos;Union européenne (ex. : États-Unis). Dans
          ce cas, les transferts sont encadrés par des garanties appropriées
          conformes au RGPD :
        </p>
        <LegalList
          items={[
            <>
              <strong className="text-foreground">Clauses contractuelles types</strong>{" "}
              (CCT) adoptées par la Commission européenne ;
            </>,
            "ou décision d'adéquation de la Commission européenne le cas échéant ;",
            "et minimisation des données transférées (uniquement ce qui est nécessaire au traitement).",
          ]}
        />
      </LegalSection>

      <LegalSection title="5. Tes droits (RGPD)">
        <p>
          Conformément au RGPD, tu disposes des droits suivants sur tes données
          personnelles :
        </p>
        <LegalList
          items={[
            <>
              <strong className="text-foreground">Droit d'accès</strong> :
              obtenir une copie des données que nous détenons sur toi ;
            </>,
            <>
              <strong className="text-foreground">Droit de rectification</strong>{" "}
              : corriger des données inexactes ou incomplètes ;
            </>,
            <>
              <strong className="text-foreground">Droit à l'effacement</strong>{" "}
              (« droit à l'oubli ») : demander la suppression de tes données ;
            </>,
            <>
              <strong className="text-foreground">Droit à la limitation du
              traitement</strong> : restreindre temporairement le traitement de
              tes données ;
            </>,
            <>
              <strong className="text-foreground">Droit à la portabilité</strong>{" "}
              : recevoir tes données dans un format structuré et réutilisable ;
            </>,
            <>
              <strong className="text-foreground">Droit d'opposition</strong> :
              t'opposer à certains traitements fondés sur notre intérêt
              légitime ;
            </>,
            <>
              <strong className="text-foreground">Retrait du consentement</strong>{" "}
              lorsque le traitement repose sur ton consentement.
            </>,
          ]}
        />
        <p>
          Pour exercer ces droits, écris-nous à{" "}
          <a
            href="mailto:privacy@studysnap.app"
            className="text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
          >
            privacy@studysnap.app
          </a>{" "}
          (ou via la{" "}
          <Link
            to="/legal/contact"
            className="text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
          >
            page Contact
          </Link>{" "}
          — sujet « Demande RGPD »). Nous répondons sous un mois maximum, comme
          le prévoit le RGPD. Une pièce d&apos;identité pourra être demandée
          pour vérifier ton identité.
        </p>
      </LegalSection>

      <LegalSection title="6. Sécurité des données">
        <LegalList
          items={[
            <>
              <strong className="text-foreground">Mots de passe hashés</strong>{" "}
              (jamais stockés en clair) ;
            </>,
            <>
              <strong className="text-foreground">Connexions chiffrées HTTPS</strong>{" "}
              sur l&apos;ensemble du service ;
            </>,
            <>
              <strong className="text-foreground">Accès restreint</strong> aux
              données : seules les personnes en ayant besoin y ont accès, avec
              des droits limités ;
            </>,
            <>
              <strong className="text-foreground">Protection anti-brute-force</strong>{" "}
              sur les connexions (limitation des tentatives) ;
            </>,
            <>
              <strong className="text-foreground">Suppression automatique</strong>{" "}
              des photos d&apos;exercices après 30 jours, sauf sauvegarde
              volontaire.
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection title="7. Cookies">
        <p>
          Le site utilise uniquement des cookies <strong className="text-foreground">fonctionnels
          et techniques</strong> strictement nécessaires au bon fonctionnement
          du service (maintien de ta session de connexion, mémorisation de tes
          préférences). Aucun cookie publicitaire n&apos;est utilisé. Si des
          outils de mesure d&apos;audience anonymisée venaient à être ajoutés,
          ils seraient présentés ici et soumis à ton consentement le cas
          échéant.
        </p>
      </LegalSection>

      <LegalSection title="8. Contact RGPD et DPO">
        <p>
          Pour toute question relative à la protection de tes données, ou pour
          exercer tes droits, tu peux contacter notre point de contact RGPD :
        </p>
        <LegalList
          items={[
            <>
              Par email :{" "}
              <a
                href="mailto:privacy@studysnap.app"
                className="text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
              >
                privacy@studysnap.app
              </a>
            </>,
            <>
              Via le formulaire de la{" "}
              <Link
                to="/legal/contact"
                className="text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
              >
                page Contact
              </Link>{" "}
              (sujet « Demande RGPD »).
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection title="9. Réclamation auprès de la CNIL">
        <p>
          Si tu estimes que tes droits ne sont pas respectés, tu peux adresser
          une réclamation à la <strong className="text-foreground">CNIL</strong>{" "}
          (Commission Nationale de l&apos;Informatique et des Libertés) :
        </p>
        <LegalList
          items={[
            <>
              En ligne :{" "}
              <a
                href="https://www.cnil.fr/fr/plaintes"
                target="_blank"
                rel="noreferrer"
                className="text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
              >
                www.cnil.fr/fr/plaintes
              </a>
            </>,
            "Par courrier : CNIL — Service des plaintes, 3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07.",
          ]}
        />
        <p>
          Nous te recommandons de nous contacter d&apos;abord : dans la grande
          majorité des cas, nous pouvons résoudre le problème directement et
          rapidement.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
