import {
  LegalLayout,
  LegalList,
  LegalNote,
  LegalSection,
} from "@/components/legal";

export default function LegalMentions() {
  return (
    <LegalLayout
      badge="📄 Mentions légales"
      title="Mentions légales"
      subtitle="Les informations légales relatives à l'édition et à l'hébergement du site StudySnap."
      lastUpdated="Août 2026"
    >
      <LegalNote>
        🏢 StudySnap est édité par une société en cours d&apos;immatriculation.
        Les informations d&apos;identification ci-dessous (forme juridique,
        SIRET, siège social) seront complétées dès l&apos;immatriculation
        officielle de l&apos;entreprise.
      </LegalNote>

      <LegalSection title="Éditeur du site">
        <LegalList
          items={[
            <>
              <strong className="text-foreground">Éditeur</strong> : StudySnap
            </>,
            <>
              <strong className="text-foreground">Forme juridique</strong> : en
              cours de constitution — les informations (forme juridique, SIRET,
              capital social, siège social) seront complétées dès
              l&apos;immatriculation de la société
            </>,
            <>
              <strong className="text-foreground">SIRET</strong> : à compléter
              dès l&apos;immatriculation
            </>,
            <>
              <strong className="text-foreground">Siège social</strong> : France
              — adresse à compléter dès l&apos;immatriculation
            </>,
            <>
              <strong className="text-foreground">Contact éditeur</strong> :{" "}
              <a
                href="mailto:contact@studysnap.app"
                className="text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
              >
                contact@studysnap.app
              </a>
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection title="Responsable de la publication">
        <p>
          <strong className="text-foreground">Responsable de la publication</strong>{" "}
          : à compléter (nom et fonction) dès la désignation officielle, en
          application de l&apos;article 6-III de la loi n° 2004-575 du 21 juin
          2004 pour la confiance dans l&apos;économie numérique (LCEN).
        </p>
      </LegalSection>

      <LegalSection title="Hébergement">
        <p>
          Le site StudySnap est hébergé par :
        </p>
        <LegalList
          items={[
            <>
              <strong className="text-foreground">Hébergeur</strong> : à
              compléter selon la stack technique retenue (infrastructure cloud)
            </>,
            <>
              <strong className="text-foreground">Adresse</strong> : à compléter
            </>,
            <>
              <strong className="text-foreground">Contact</strong> : à compléter
            </>,
          ]}
        />
        <p>
          Les données sont hébergées sur des serveurs sécurisés, dans le
          respect de la Politique de confidentialité.
        </p>
      </LegalSection>

      <LegalSection title="Propriété intellectuelle">
        <p>
          L&apos;ensemble des éléments du site StudySnap — textes, logo,
          graphisme, design, interface, code source, bases de données — est
          protégé par le droit de la propriété intellectuelle et reste la
          propriété exclusive de StudySnap.
        </p>
        <p>
          Toute reproduction, représentation, modification ou exploitation,
          totale ou partielle, sans autorisation écrite préalable, est
          interdite et constitutive de contrefaçon. Le nom « StudySnap », le
          logo et les visuels ne peuvent être utilisés sans autorisation.
        </p>
      </LegalSection>

      <LegalSection title="Limitation de responsabilité">
        <p>
          StudySnap s&apos;efforce d&apos;assurer l&apos;exactitude et la mise
          à jour des informations publiées sur le site, sans pouvoir garantir
          leur exhaustivité ni leur absence d&apos;erreur. Les contenus générés
          par l&apos;intelligence artificielle (réponses, explications, fiches,
          quiz) sont fournis à titre indicatif et pédagogique : ils ne
          constituent pas un avis professionnel ni une garantie de résultat
          (voir les CGU, article 6).
        </p>
        <p>
          StudySnap ne pourra être tenu responsable des dommages directs ou
          indirects résultant de l&apos;utilisation du site ou de
          l&apos;impossibilité d&apos;y accéder.
        </p>
      </LegalSection>

      <LegalSection title="Droit applicable">
        <p>
          Les présentes mentions légales sont soumises au{" "}
          <strong className="text-foreground">droit français</strong>. En cas de
          litige, et à défaut de résolution amiable, les tribunaux français
          compétents seront seuls compétents.
        </p>
      </LegalSection>

      <LegalSection title="Liens utiles">
        <LegalList
          items={[
            <>
              <a
                href="/legal/cgu"
                className="text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
              >
                Conditions Générales d&apos;Utilisation
              </a>
            </>,
            <>
              <a
                href="/legal/privacy"
                className="text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
              >
                Politique de confidentialité
              </a>
            </>,
            <>
              <a
                href="/legal/contact"
                className="text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
              >
                Contact
              </a>
            </>,
          ]}
        />
      </LegalSection>
    </LegalLayout>
  );
}
