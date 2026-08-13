/**
 * StudySnap — base de connaissances du programme scolaire français (collège
 * 6ᵉ→3ᵉ et lycée Seconde→Terminale) + détection de la matière, du niveau et
 * des contenus « avancés » (philosophie, spécialités, post-bac).
 *
 * Objectifs :
 *  1. Couvrir toutes les matières classiques (maths, français, histoire-géo,
 *     SVT, physique-chimie, langues, technologie, SES…) : l'IA reçoit une
 *     RÉFÉRENCE PÉDAGOGIQUE (notions + formules) utilisée en priorité.
 *  2. Détecter au moment du scan les contenus avancés qui déclenchent le
 *     paywall côté serveur pour le plan Gratuit (philosophie, spécialités,
 *     post-bac) — jamais pour les contenus classiques.
 *  3. Signaler quand la base ne couvre pas le contenu (confidence « low ») :
 *     l'action IA bascule alors sur une recherche internet de secours.
 *
 * Logique pure (aucune dépendance) — testable en unitaire.
 */

export type LevelKey =
  | "college"
  | "seconde"
  | "premiere"
  | "terminale"
  | "postbac"
  /** Niveau générique pour un chapitre valable sur tout le lycée. */
  | "lycee";

export type AdvancedCategory = "philosophie" | "specialite" | "avance";

export interface CurriculumChapter {
  /** Niveau principal du chapitre. */
  level: LevelKey;
  title: string;
  /** Mots-clés de reconnaissance (recherchés dans le texte OCR, insensible aux accents/casse). */
  keywords: string[];
  /** Formules / théorèmes clés (LaTeX). */
  formulas: string[];
  /** Notions essentielles du chapitre. */
  concepts: string[];
}

export interface CurriculumSubject {
  id: string;
  label: string;
  /** Mots-clés de détection de la matière. */
  aliases: string[];
  cycles: Array<"college" | "lycee" | "postbac">;
  chapters: CurriculumChapter[];
}

/* ------------------------------------------------------------------ */
/* Normalisation                                                        */
/* ------------------------------------------------------------------ */

/** minuscules + suppression des accents (pour des recherches fiables). */
export function normalizeForMatch(text: string): string {
  return (text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Vrai si le mot / la phrase apparaît isolé(e) (frontières de mot). */
export function containsWord(text: string, word: string): boolean {
  const re = new RegExp(`\\b${escapeRe(normalizeForMatch(word))}\\b`);
  return re.test(normalizeForMatch(text));
}

/* ------------------------------------------------------------------ */
/* Matières                                                            */
/* ------------------------------------------------------------------ */

export const SUBJECTS: CurriculumSubject[] = [
  {
    id: "mathematiques",
    label: "Mathématiques",
    aliases: [
      "mathématiques", "maths", "math", "algèbre", "algèbre", "géométrie",
      "calcul", "équation", "équations", "inéquations", "système d'équations",
      "systeme d'equations", "fonction", "suite", "probabilité", "probabilités",
      "trigonométrie", "vecteur", "vecteurs", "dérivée", "dérivées",
      "intégrale", "intégrales", "statistique", "statistiques", "arithmétique",
      "nombres", "factoriser", "pythagore", "thalès", "thales", "polynôme",
      "trinôme", "nombre dérivé", "tableau de signes", "calcul littéral",
    ],
    cycles: ["college", "lycee", "postbac"],
    chapters: [
      {
        level: "college",
        title: "Nombres et calculs",
        keywords: ["fraction", "fractions", "nombre relatif", "nombres relatifs", "puissance", "puissances", "calcul littéral", "proportionnalité", "pourcentage", "pourcentages", "double distributivité", "PGCD"],
        formulas: ["$\\dfrac{a}{b} + \\dfrac{c}{d} = \\dfrac{ad + cb}{bd}$", "$a^{-n} = \\dfrac{1}{a^n}$", "$k(a+b) = ka + kb$", "$(a+b)(c+d) = ac + ad + bc + bd$"],
        concepts: ["Fractions et nombres relatifs", "Puissances et notation scientifique", "Calcul littéral et développement", "Proportionnalité et pourcentages"],
      },
      {
        level: "college",
        title: "Équations et inéquations",
        keywords: ["équation", "équations", "inéquation", "inéquations", "système", "systèmes", "résoudre", "résolution", "inconnue", "premier degré", "membre"],
        formulas: ["$ax + b = c \\iff x = \\dfrac{c-b}{a}$", "$a \\times x + b = c$ se résout en isolant $x$"],
        concepts: ["Équation du premier degré à une inconnue", "Règle d'or : même opération des deux côtés", "Inéquations et droite graduée"],
      },
      {
        level: "college",
        title: "Géométrie plane",
        keywords: ["pythagore", "thalès", "triangle", "rectangle", "carré", "cercle", "aire", "périmètre", "volume", "angle", "symétrie", "rotation", "translation", "parallèle", "perpendiculaire", "hypoténuse", "médiatrice", "bissectrice"],
        formulas: ["$c^2 = a^2 + b^2$ (Pythagore)", "$\\dfrac{AM}{AB} = \\dfrac{AN}{AC} = \\dfrac{MN}{BC}$ (Thalès)", "Aire triangle : $\\dfrac{base \\times hauteur}{2}$", "Aire cercle : $\\pi r^2$", "Volume : $L \\times l \\times h$"],
        concepts: ["Théorème de Pythagore et sa réciproque", "Théorème de Thalès et sa réciproque", "Aires, périmètres et volumes", "Transformations : symétrie, rotation, translation"],
      },
      {
        level: "college",
        title: "Fonctions et proportionnalité",
        keywords: ["fonction linéaire", "fonction affine", "tableau de proportionnalité", "graphique", "coefficient directeur", "vitesse", "situation de proportionnalité"],
        formulas: ["$f(x) = ax$ (linéaire)", "$f(x) = ax + b$ (affine)", "$v = \\dfrac{d}{t}$"],
        concepts: ["Notion de fonction (image, antécédent)", "Représentation graphique", "Proportionnalité et coefficient de proportionnalité"],
      },
      {
        level: "college",
        title: "Statistiques et probabilités",
        keywords: ["moyenne", "médiane", "fréquence", "effectif", "expérience aléatoire", "probabilité", "hasard", "tableau", "diagramme", "étendue"],
        formulas: ["Moyenne : $\\dfrac{\\text{sum des valeurs}}{\\text{effectif total}}$", "Probabilité : $p = \\dfrac{\\text{cas favorables}}{\\text{cas possibles}}$"],
        concepts: ["Moyenne, médiane, étendue", "Fréquences et diagrammes", "Probabilité d'un événement (0 à 1)"],
      },
      {
        level: "seconde",
        title: "Fonctions de référence",
        keywords: ["fonction carré", "fonction inverse", "variations", "tableau de variations", "tableau de signes", "fonction affine", "maximum", "minimum", "courbe représentative"],
        formulas: ["$f(x) = x^2$ : décroissante sur $\\mathbb{R}^-$ puis croissante", "$f(x) = \\dfrac{1}{x}$ : décroissante sur chaque intervalle", "$f(x) = ax + b$"],
        concepts: ["Fonctions de référence (affine, carré, inverse)", "Variations et tableau de variations", "Résolution graphique d'équations"],
      },
      {
        level: "seconde",
        title: "Géométrie repérée et vecteurs",
        keywords: ["vecteur", "vecteurs", "coordonnées", "repère", "colinéarité", "translation", "milieu", "distance", "norme"],
        formulas: ["$\\vec{u}(x;y) + \\vec{v}(x';y') = (x+x'; y+y')$", "Milieu : $M\\left(\\dfrac{x_A+x_B}{2}; \\dfrac{y_A+y_B}{2}\\right)$", "Distance : $\\sqrt{(x_B-x_A)^2 + (y_B-y_A)^2}$", "Colinéarité : $xy' - x'y = 0$"],
        concepts: ["Vecteurs et translation", "Coordonnées dans un repère", "Colinéarité et parallélisme"],
      },
      {
        level: "seconde",
        title: "Probabilités et statistiques",
        keywords: ["probabilité", "événement", "univers", "union", "intersection", "complémentaire", "équiprobabilité", "quartile", "écart-type", "médiane"],
        formulas: ["$p(A \\cup B) = p(A) + p(B) - p(A \\cap B)$", "$p(\\overline{A}) = 1 - p(A)$"],
        concepts: ["Expérience aléatoire et univers", "Union, intersection, complémentaire", "Statistiques : moyenne, médiane, quartiles, écart-type"],
      },
      {
        level: "premiere",
        title: "Second degré",
        keywords: ["trinôme", "trinome", "discriminant", "second degré", "2nde degré", "parabole", "forme canonique", "racine", "racines", "delta", "équation du second degré"],
        formulas: ["$\\Delta = b^2 - 4ac$", "$x_{1,2} = \\dfrac{-b \\pm \\sqrt{\\Delta}}{2a}$", "Somme : $S = -\\dfrac{b}{a}$ ; produit : $P = \\dfrac{c}{a}$"],
        concepts: ["Discriminant et nombre de solutions", "Factorisation et signe d'un trinôme", "Forme canonique et extremum"],
      },
      {
        level: "premiere",
        title: "Dérivation",
        keywords: ["dérivée", "nombre dérivé", "tangente", "fonction dérivée", "variations", "extremum", "tableau de variations", "taux de variation"],
        formulas: ["$f'(a) = \\lim_{h\\to 0} \\dfrac{f(a+h)-f(a)}{h}$", "$(x^n)' = nx^{n-1}$", "$(u+v)' = u' + v'$", "$(ku)' = ku'$", "Tangente : $y = f'(a)(x-a) + f(a)$"],
        concepts: ["Nombre dérivé et tangente", "Fonction dérivée des fonctions usuelles", "Lien signe de la dérivée / variations"],
      },
      {
        level: "premiere",
        title: "Suites",
        keywords: ["suite", "suites", "arithmétique", "géométrique", "raison", "terme général", "récurrence", "somme des termes"],
        formulas: ["$u_n = u_0 + nr$ (arithmétique)", "$u_n = u_0 \\times q^n$ (géométrique)", "Somme arithmétique : $\\dfrac{n(u_0 + u_n)}{2}$", "Somme géométrique : $u_0 \\times \\dfrac{1 - q^{n+1}}{1-q}$"],
        concepts: ["Suites arithmétiques et géométriques", "Sens de variation d'une suite", "Sommes de termes"],
      },
      {
        level: "premiere",
        title: "Trigonométrie",
        keywords: ["trigonométrie", "cercle trigonométrique", "radian", "radians", "cosinus", "sinus", "cos", "sin", "équation trigonométrique", "angles associés", "courbe sinusoïdale"],
        formulas: ["$\\cos^2 x + \\sin^2 x = 1$", "$\\pi$ rad $= 180°$", "$\\cos(x+\\pi) = -\\cos x$", "$\\sin(x+\\pi) = -\\sin x$"],
        concepts: ["Cercle trigonométrique et radians", "Courbes cosinus et sinus", "Résolution d'équations trigonométriques simples"],
      },
      {
        level: "premiere",
        title: "Probabilités conditionnelles",
        keywords: ["probabilité conditionnelle", "conditionnelles", "indépendance", "indépendants", "arbre pondéré", "tableau croisé", "événements indépendants"],
        formulas: ["$p_B(A) = \\dfrac{p(A \\cap B)}{p(B)}$", "A et B indépendants : $p(A \\cap B) = p(A)p(B)$"],
        concepts: ["Probabilité conditionnelle", "Formule des probabilités totales", "Indépendance d'événements"],
      },
      {
        level: "terminale",
        title: "Exponentielle et logarithme",
        keywords: ["exponentielle", "logarithme", "ln", "exp", "logarithme népérien", "croissance exponentielle", "limite exponentielle", "fonction ln"],
        formulas: ["$(e^x)' = e^x$", "$e^{a+b} = e^a e^b$", "$\\ln(ab) = \\ln a + \\ln b$", "$\\ln'(x) = \\dfrac{1}{x}$", "$\\lim_{x \\to +\\infty} \\dfrac{e^x}{x} = +\\infty$"],
        concepts: ["Fonction exponentielle et ses propriétés", "Logarithme népérien", "Croissances comparées"],
      },
      {
        level: "terminale",
        title: "Intégration",
        keywords: ["primitive", "primitives", "intégrale", "intégrales", "aire sous la courbe", "valeur moyenne", "intégration par parties", "calcul intégral"],
        formulas: ["$\\int_a^b f(x)\\,dx = F(b) - F(a)$", "Valeur moyenne : $\\dfrac{1}{b-a} \\int_a^b f(x)\\,dx$", "$(\\int_a^x f)' = f(x)$"],
        concepts: ["Primitives des fonctions usuelles", "Intégrale et aire", "Valeur moyenne et intégration par parties"],
      },
      {
        level: "terminale",
        title: "Limites et suites",
        keywords: ["limite", "limites", "convergence", "divergence", "suite récurrente", "limite de suite", "converge", "tend vers", "forme indéterminée"],
        formulas: ["$\\lim_{x\\to +\\infty} x^n = +\\infty$", "$\\lim_{x\\to +\\infty} \\dfrac{1}{x^n} = 0$", "Théorème des gendarmes"],
        concepts: ["Limites de fonctions et de suites", "Formes indéterminées", "Théorème des gendarmes et suite majorée"],
      },
      {
        level: "terminale",
        title: "Probabilités (lois)",
        keywords: ["loi binomiale", "loi normale", "variable aléatoire", "espérance", "variance", "échantillonnage", "intervalle de confiance", "loi de probabilité"],
        formulas: ["$P(X=k) = \\binom{n}{k} p^k (1-p)^{n-k}$", "$E(X) = np$ (binomiale)", "$\\sigma = \\sqrt{np(1-p)}$"],
        concepts: ["Variable aléatoire discrète", "Loi binomiale et loi normale", "Échantillonnage et intervalle de fluctuation"],
      },
      {
        level: "terminale",
        title: "Nombres complexes",
        keywords: ["complexe", "complexes", "nombre complexe", "partie réelle", "partie imaginaire", "forme algébrique", "forme trigonométrique", "module", "argument", "équation complexe"],
        formulas: ["$z = a + ib$", "$i^2 = -1$", "$|z| = \\sqrt{a^2 + b^2}$", "$z \\bar{z} = |z|^2$"],
        concepts: ["Forme algébrique et opérations", "Module, argument, forme trigonométrique", "Résolution d'équations dans $\\mathbb{C}$"],
      },
      {
        level: "terminale",
        title: "Géométrie dans l'espace",
        keywords: ["espace", "produit scalaire", "vecteur normal", "plan", "droite", "sphère", "parallélépipède", "tétraèdre", "orthogonalité", "section plane"],
        formulas: ["$\\vec{u} \\cdot \\vec{v} = xx' + yy' + zz'$", "Équation de plan : $ax + by + cz + d = 0$", "Volume tétraèdre : $\\dfrac{1}{3} \\times \\text{aire base} \\times h$"],
        concepts: ["Produit scalaire dans l'espace", "Équations de plans et de droites", "Sections planes et volumes"],
      },
    ],
  },
  {
    id: "francais",
    label: "Français",
    aliases: [
      "français", "francais", "grammaire", "conjugaison", "orthographe",
      "verbe", "verbes", "imparfait", "subjonctif", "conditionnel",
      "passé simple", "passé composé", "nature", "pronom", "adjectif",
      "déterminant", "accord", "accords", "phrase",
      "rédaction", "redaction", "commentaire", "dissertation", "analyse de texte",
      "poésie", "poesie", "théâtre", "theatre", "littérature", "litterature",
      "figure de style", "figures de style", "vocabulaire", "dictée", "dictee",
      "texte", "récit", "recit", "narrateur", "point de vue", "argumentation",
    ],
    cycles: ["college", "lycee"],
    chapters: [
      {
        level: "college",
        title: "Grammaire",
        keywords: ["nature", "fonction", "phrase simple", "phrase complexe", "proposition", "complément", "sujet", "verbe", "attribut", "C.O.D", "C.O.I", "complément circonstanciel", "coordination", "subordination", "relative"],
        formulas: [],
        concepts: ["Classes grammaticales et fonctions", "Phrase simple / complexe", "Propositions indépendante, principale, subordonnée", "Compléments : COD, COI, circonstanciels"],
      },
      {
        level: "college",
        title: "Conjugaison",
        keywords: ["conjugaison", "indicatif", "conditionnel", "subjonctif", "imparfait", "passé simple", "futur", "plus-que-parfait", "participe passé", "infinitif", "impératif", "temps", "mode", "accord du participe"],
        formulas: [],
        concepts: ["Temps simples et composés de l'indicatif", "Mode subjonctif et conditionnel", "Accord du participe passé"],
      },
      {
        level: "college",
        title: "Orthographe et vocabulaire",
        keywords: ["orthographe", "accord", "accords", "homophone", "homophones", "pluriel", "féminin", "préfixe", "suffixe", "racine", "champ lexical", "synonyme", "antonyme", "mot de la même famille"],
        formulas: [],
        concepts: ["Accords dans le groupe nominal et le groupe verbal", "Homophones (a/à, et/est, son/sont…)", "Formation des mots : préfixes, suffixes, racines"],
      },
      {
        level: "college",
        title: "Lecture et compréhension",
        keywords: ["texte narratif", "texte descriptif", "texte informatif", "texte argumentatif", "schéma narratif", "schéma actantiel", "personnage", "incipit", "chute", "moralité", "inférence", "implicite", "lecture"],
        formulas: [],
        concepts: ["Types de textes et intention", "Schéma narratif : situation initiale → situation finale", "Personnages, narrateur, point de vue"],
      },
      {
        level: "college",
        title: "Expression écrite",
        keywords: ["rédaction", "rédiger", "paragraphe", "narration", "description", "dialogue", "argumentation", "introduction", "conclusion", "brouillon", "respecter la consigne"],
        formulas: [],
        concepts: ["Structure d'une rédaction (intro, développement, conclusion)", "Types de textes : raconter, décrire, argumenter", "Relecture et correction"],
      },
      {
        level: "college",
        title: "Poésie, théâtre et récit",
        keywords: ["vers", "strophe", "versification", "rime", "alexandrin", "poème", "poesie", "fable", "scène", "acte", "tragédie", "comédie", "didascalie", "réplique", "nouvelle", "roman", "conte"],
        formulas: [],
        concepts: ["Versification : vers, strophes, rimes", "Genres : poésie, théâtre, récit", "Structure d'une pièce et d'un récit"],
      },
      {
        level: "premiere",
        title: "Analyse de texte et commentaire",
        keywords: ["commentaire composé", "commentaire", "analyse de texte", "registre", "registres", "énonciation", "procédés", "relever", "interpréter", "axe de lecture", "mouvement du texte"],
        formulas: [],
        concepts: ["Méthode du commentaire composé", "Registres : tragique, comique, lyrique, pathétique, épique…", "Énonciation et procédés d'écriture"],
      },
      {
        level: "lycee",
        title: "Mouvements littéraires",
        keywords: ["humanisme", "classicisme", "lumières", "lumiere", "romantisme", "réalisme", "realisme", "naturalisme", "symbolisme", "surréalisme", "surrealisme", "existentialisme", "nouveau roman", "baroque", "préciosité", "préciosite"],
        formulas: [],
        concepts: ["Chronologie des mouvements littéraires", "Caractéristiques de chaque mouvement", "Grands auteurs et œuvres repères"],
      },
      {
        level: "lycee",
        title: "Genres, registres et figures de style",
        keywords: ["roman", "théâtre", "poésie", "essai", "autobiographie", "figure de style", "métaphore", "comparaison", "hyperbole", "personnification", "anaphore", "oxymore", "antithèse", "ironie", "euphémisme", "litote", "allégorie", "métonymie", "gradation"],
        formulas: [],
        concepts: ["Genres littéraires et leurs codes", "Registres et tonalités", "Figures de style : comparaison, métaphore, hyperbole…"],
      },
      {
        level: "lycee",
        title: "Dissertation et argumentation",
        keywords: ["dissertation", "thèse", "these", "argument", "exemple", "plan", "problématique", "problematic", "introduction", "développement", "transition", "réfutation", "refutation", "convaincre", "persuader"],
        formulas: [],
        concepts: ["Méthode de la dissertation (intro, développement, conclusion)", "Construction d'un argument (thèse, argument, exemple)", "Convaincre, persuader, délibérer"],
      },
      {
        level: "lycee",
        title: "Langue : grammaire avancée",
        keywords: ["discours rapporté", "discours direct", "discours indirect", "concordance des temps", "subjonctif", "conditionnel", "phrase interrogative", "négation", "négative", "expansion du nom", "apposition", "pronom relatif", "subordonnée circonstancielle"],
        formulas: [],
        concepts: ["Discours direct / indirect", "Concordance des temps", "Subordonnées et leurs fonctions"],
      },
    ],
  },
  {
    id: "histoire-geo",
    label: "Histoire-Géographie",
    aliases: [
      "histoire", "géographie", "geographie", "géo", "geo", "histoire-géo",
      "histoire géo", "h-g", "guerre", "révolution", "revolution", "empire",
      "colonie", "colonisation", "mondialisation", "territoire", "territoires",
      "cartographie", "carte", "chronologie", "régime", "regime", "démocratie",
      "dictature", "frontière", "frontiere", "migration", "urbanisation",
    ],
    cycles: ["college", "lycee"],
    chapters: [
      {
        level: "college",
        title: "Histoire — chronologie",
        keywords: ["préhistoire", "prehistoire", "antiquité", "antiquite", "moyen âge", "moyen age", "renaissance", "temps modernes", "révolution française", "revolution francaise", "19e siècle", "19e siecle", "première guerre mondiale", "seconde guerre mondiale", "guerres mondiales", "frise chronologique", "gaulois", "romains", "empire romain"],
        formulas: [],
        concepts: ["Grandes périodes historiques", "Repères chronologiques (dates-clés)", "Événements majeurs : Révolutions, guerres mondiales"],
      },
      {
        level: "college",
        title: "Géographie",
        keywords: ["continent", "continents", "océan", "oceans", "climat", "climats", "population", "densité", "densite", "développement", "developpement", "pays développé", "pays en développement", "mondialisation", "urbanisation", "migration", "inégalités", "inegalites", "ressources", "développement durable", "developpement durable"],
        formulas: [],
        concepts: ["Repères géographiques (continents, océans)", "Répartition de la population", "Développement et inégalités", "Développement durable"],
      },
      {
        level: "lycee",
        title: "Histoire — XXᵉ siècle",
        keywords: ["première guerre mondiale", "seconde guerre mondiale", "totalitarisme", "totalitarismes", "fascisme", "nazisme", "stalinisme", "guerre froide", "décolonisation", "decolonisation", "construction européenne", "construction europeenne", "crise de 1929", "chute du mur", "génocide", "genocide", "résistance", "resistance"],
        formulas: [],
        concepts: ["Guerres mondiales et leurs conséquences", "Totalitarismes et démocraties", "Guerre froide et décolonisation", "Construction européenne"],
      },
      {
        level: "lycee",
        title: "Géographie — mondialisation et territoires",
        keywords: ["mondialisation", "métropolisation", "metropolisation", "aire urbaine", "développement durable", "developpement durable", "transition", "France", "union européenne", "union europeenne", "territoires", "aménagement", "amenagement", "flux", "réseaux", "reseaux", "littoral", "montagne", "espaces productifs"],
        formulas: [],
        concepts: ["Mondialisation et acteurs", "Métropolisation et aires urbaines", "Aménagement du territoire français", "L'Union européenne"],
      },
    ],
  },
  {
    id: "svt",
    label: "SVT",
    aliases: [
      "svt", "sciences de la vie", "biologie", "géologie", "geologie", "cellule",
      "organisme", "génétique", "genetique", "écosystème", "ecosysteme",
      "évolution", "evolution", "corps humain", "immunité", "immunite",
      "photosynthèse", "photosynthese", "climat", "tectonique", "plaque", "plaques",
      "espèce", "espece", "biodiversité", "biodiversite", "végétal", "vegetal",
      "reproduction", "chromosome", "adn", "gène", "gene",
    ],
    cycles: ["college", "lycee"],
    chapters: [
      {
        level: "college",
        title: "Le vivant et son fonctionnement",
        keywords: ["cellule", "cellules", "organisme", "organisme vivant", "nutrition", "respiration", "circulation", "reproduction", "digestion", "végétaux", "vegetaux", "photosynthèse", "photosynthese", "micro-organisme", "micro-organismes"],
        formulas: [],
        concepts: ["La cellule, unité du vivant", "Fonctions de nutrition (digestion, respiration, circulation)", "Reproduction des êtres vivants"],
      },
      {
        level: "college",
        title: "Biodiversité et évolution",
        keywords: ["biodiversité", "biodiversite", "espèce", "espece", "écosystème", "ecosysteme", "adaptation", "évolution", "evolution", "classification", "fossile", "fossiles", "milieu de vie", "chaîne alimentaire", "chaine alimentaire", "réseau trophique", "reseau trophique"],
        formulas: [],
        concepts: ["Diversité et classification du vivant", "Écosystèmes et chaînes alimentaires", "Évolution et fossiles"],
      },
      {
        level: "college",
        title: "Planète Terre et environnement",
        keywords: ["volcan", "volcans", "séisme", "seisme", "tectonique des plaques", "roche", "roches", "sol", "érosion", "erosion", "climat", "météorologie", "meteorologie", "ressources", "nappe phréatique", "nappe phreatique"],
        formulas: [],
        concepts: ["Volcans et séismes", "Tectonique des plaques", "Roches, sols et érosion", "Climat et météorologie"],
      },
      {
        level: "college",
        title: "Corps humain et santé",
        keywords: ["squelette", "muscle", "muscles", "système nerveux", "systeme nerveux", "système reproducteur", "systeme reproducteur", "hygiène", "hygiene", "addiction", "puberté", "puberte", "alimentation", "sommeil", "activité physique", "activite physique"],
        formulas: [],
        concepts: ["Mouvement : squelette, muscles, système nerveux", "Reproduction et puberté", "Santé : alimentation, sommeil, hygiène"],
      },
      {
        level: "lycee",
        title: "Génétique et ADN",
        keywords: ["adn", "gène", "gene", "gènes", "genes", "chromosome", "chromosomes", "mitose", "méiose", "meiose", "brassage", "mutation", "mutations", "allèle", "allele", "génotype", "genotype", "phénotype", "phenotype", "caryotype"],
        formulas: [],
        concepts: ["Structure de l'ADN et du gène", "Mitose, méiose et brassage génétique", "Mutations et maladies génétiques"],
      },
      {
        level: "lycee",
        title: "Immunologie",
        keywords: ["immunité", "immunite", "système immunitaire", "systeme immunitaire", "anticorps", "antigène", "antigene", "vaccin", "vaccins", "lymphocyte", "lymphocytes", "réaction inflammatoire", "reaction inflammatoire", "défense", "defense", "allergie", "greffe"],
        formulas: [],
        concepts: ["Réaction inflammatoire (immunité innée)", "Immunité adaptative : lymphocytes et anticorps", "Vaccination et mémoire immunitaire"],
      },
      {
        level: "lycee",
        title: "Évolution et biodiversité",
        keywords: ["sélection naturelle", "selection naturelle", "dérive génétique", "derive genetique", "spéciation", "speciation", "histoire de la vie", "ancêtre commun", "ancetre commun", "parenté", "parente", "arbre phylogénétique", "arbre phylogenetique", "darwin", "lamarck"],
        formulas: [],
        concepts: ["Mécanismes de l'évolution", "Dérive génétique et sélection naturelle", "Arbres phylogénétiques et parenté"],
      },
      {
        level: "lycee",
        title: "Écosystèmes et climat",
        keywords: ["écosystème", "ecosysteme", "photosynthèse", "photosynthese", "effet de serre", "réchauffement", "rechauffement", "climat", "réseau trophique", "reseau trophique", "cycle du carbone", "biodiversité", "biodiversite", "biomasse"],
        formulas: [],
        concepts: ["Écosystèmes et réseaux trophiques", "Photosynthèse et flux de matière/énergie", "Climat, effet de serre et actions humaines"],
      },
      {
        level: "lycee",
        title: "Procréation et santé",
        keywords: ["contraception", "hormone", "hormones", "cycle menstruel", "ist", "sida", "fécondation", "fecondation", "procréation", "procreation", "grossesse", "planning familial", "endocrinien"],
        formulas: [],
        concepts: ["Contrôle hormonal de la reproduction", "Contraception et prévention des IST", "Procréation médicalement assistée"],
      },
    ],
  },
  {
    id: "physique-chimie",
    label: "Physique-Chimie",
    aliases: [
      "physique", "chimie", "physique-chimie", "physique chimie", "électricité",
      "electricite", "atome", "atomes", "molécule", "molecule", "réaction chimique",
      "reaction chimique", "force", "forces", "mouvement", "énergie", "energie",
      "onde", "ondes", "tension", "intensité", "intensite", "résistance", "resistance",
      "circuit", "circuits", "ph", "acide", "acides", "base", "bases", "tableau périodique",
      "tableau periodique", "loi d'ohm", "pression", "température", "temperature",
    ],
    cycles: ["college", "lycee"],
    chapters: [
      {
        level: "college",
        title: "Électricité",
        keywords: ["circuit électrique", "circuit", "série", "serie", "dérivation", "derivation", "tension", "intensité", "intensite", "résistance", "resistance", "loi d'ohm", "loi d'ohm", "puissance", "électrique", "electrique", "voltmètre", "voltmètre", "ampèremètre", "amperemetre", "court-circuit", "générateur", "generateur", "dipôle", "dipole"],
        formulas: ["$U = R \\times I$ (loi d'Ohm)", "$P = U \\times I$", "Circuit en série : $U = U_1 + U_2$", "Circuit en dérivation : $I = I_1 + I_2$"],
        concepts: ["Montages en série et en dérivation", "Tension, intensité, résistance", "Loi d'Ohm et puissance"],
      },
      {
        level: "college",
        title: "Matière et transformations",
        keywords: ["état de la matière", "etat de la matiere", "solide", "liquide", "gaz", "fusion", "ébullition", "ebullition", "solidification", "vaporisation", "condensation", "mélange", "melange", "dissolution", "solution", "soluté", "solvant", "transformation chimique", "réaction chimique", "reaction chimique", "atome", "molécule", "molecule", "espèce chimique", "espece chimique", "conservation de la masse"],
        formulas: ["Masse volumique : $\\rho = \\dfrac{m}{V}$", "Conservation de la masse lors d'une transformation chimique"],
        concepts: ["États de la matière et changements d'état", "Mélanges et dissolution", "Atomes et molécules", "Transformations chimiques"],
      },
      {
        level: "college",
        title: "Mouvement et interactions",
        keywords: ["vitesse", "mouvement", "trajectoire", "référentiel", "referentiel", "force", "forces", "gravitation", "poids", "masse", "interaction", "contact", "distance", "courbe", "relatif", "uniforme", "accéléré", "accelere", "freinage"],
        formulas: ["$v = \\dfrac{d}{t}$", "$P = m \\times g$ (poids)"],
        concepts: ["Vitesse et mouvement (relatif)", "Forces et interactions", "Gravitation et poids"],
      },
      {
        level: "college",
        title: "Énergie et environnement",
        keywords: ["énergie", "energie", "source d'énergie", "source d'energie", "renouvelable", "non renouvelable", "conversion", "économie d'énergie", "economie d'energie", "transport", "chauffage", "éolienne", "eolienne", "solaire", "nucleaire", "pétrole", "petrole", "gaz", "charbon"],
        formulas: ["$E = P \\times t$ (énergie = puissance × durée)"],
        concepts: ["Formes et conversions d'énergie", "Sources d'énergie renouvelables et non renouvelables", "Énergie et développement durable"],
      },
      {
        level: "college",
        title: "Sons et signaux",
        keywords: ["son", "sons", "fréquence", "frequence", "lumière", "lumiere", "propagation", "signal", "signaux", "audible", "ultrason", "hertz", "vision", "écho", "echo", "vitesse du son", "vitesse de la lumière", "spectre"],
        formulas: ["$v_{son} \\approx 340$ m/s dans l'air", "$v_{lumiere} \\approx 3 \\times 10^8$ m/s"],
        concepts: ["Caractéristiques d'un son (fréquence, intensité)", "Propagation de la lumière et du son", "Signaux et information"],
      },
      {
        level: "lycee",
        title: "Mécanique",
        keywords: ["lois de newton", "principe d'inertie", "principe de newton", "force", "mouvement uniforme", "mouvement accéléré", "acceleration", "énergie cinétique", "energie cinetique", "énergie potentielle", "energie potentielle", "travail", "référentiel galiléen", "referentiel galileen", "quantité de mouvement", "quantite de mouvement"],
        formulas: ["$\\sum \\vec{F} = m \\vec{a}$ (2ᵉ loi de Newton)", "$E_c = \\dfrac{1}{2}mv^2$", "$E_{pp} = mgh$", "$\\vec{p} = m\\vec{v}$"],
        concepts: ["Principe d'inertie et lois de Newton", "Énergie cinétique et potentielle", "Quantité de mouvement et collisions"],
      },
      {
        level: "lycee",
        title: "Chimie",
        keywords: ["mole", "quantité de matière", "quantite de matiere", "concentration", "molaire", "acido-basique", "ph", "acide", "base", "oxydoréduction", "oxydoreduction", "réaction d'oxydoréduction", "chimie organique", "alcane", "alcool", "alcools", "ester", "dosage", "équation-bilan", "equation-bilan", "tableau d'avancement", "tableau d'avancement", "ions", "atome", "masse molaire", "volume molaire"],
        formulas: ["$n = \\dfrac{m}{M}$ (quantité de matière)", "$C = \\dfrac{n}{V}$ (concentration molaire)", "$pH = -\\log[H^+]$"],
        concepts: ["Mole et quantité de matière", "Réactions acido-basiques et pH", "Oxydoréduction", "Chimie organique : familles et réactions"],
      },
      {
        level: "lycee",
        title: "Ondes et signaux",
        keywords: ["onde", "ondes", "onde mécanique", "onde mécanique", "onde électromagnétique", "onde electromagnetique", "fréquence", "frequence", "période", "periode", "longueur d'onde", "longueur d'onde", "célérité", "celerite", "spectre", "effet doppler", "interférences", "interferences", "diffraction", "son", "lumière", "lumiere", "rayonnement"],
        formulas: ["$v = \\lambda \\times f$", "$T = \\dfrac{1}{f}$"],
        concepts: ["Caractéristiques d'une onde", "Ondes mécaniques et électromagnétiques", "Diffraction, interférences, effet Doppler"],
      },
      {
        level: "lycee",
        title: "Énergie et thermodynamique",
        keywords: ["thermodynamique", "température", "temperature", "chaleur", "transfert thermique", "travail", "puissance", "rendement", "bilan énergétique", "bilan energetique", "énergie interne", "energie interne", "premier principe", "gaz parfait", "pression"],
        formulas: ["$\\Delta U = W + Q$ (1ᵉʳ principe)", "$\\eta = \\dfrac{E_{utile}}{E_{consommee}}$", "$PV = nRT$ (gaz parfait)"],
        concepts: ["Premier principe de la thermodynamique", "Travail, chaleur et énergie interne", "Rendement et bilans d'énergie"],
      },
      {
        level: "lycee",
        title: "Radioactivité et noyau",
        keywords: ["radioactivité", "radioactivite", "noyau", "noyaux", "isotope", "isotopes", "désintégration", "desintegration", "demi-vie", "demie-vie", "activité", "activite", "fission", "fusion", "nucléaire", "nucleaire", "énergie nucléaire", "energie nucleaire"],
        formulas: ["$N(t) = N_0 \\times 2^{-t/T}$ (décroissance radioactive)", "$\\Delta m c^2 = E$ (équivalence masse-énergie)"],
        concepts: ["Structure du noyau et isotopes", "Désintégrations et demi-vie", "Fission et fusion nucléaires"],
      },
    ],
  },
  {
    id: "anglais",
    label: "Anglais",
    aliases: ["anglais", "english", "anglophone", "vocabulaire anglais", "grammaire anglaise", "traduction", "traduire", "traduisez", "compréhension", "comprehension", "compréhension orale", "compréhension écrite", "expression orale", "expression écrite", "civilisation anglo-saxonne", "prétérit", "preterit", "présent simple", "present perfect", "anglais"],
    cycles: ["college", "lycee"],
    chapters: [
      {
        level: "college",
        title: "Grammaire anglaise",
        keywords: ["présent simple", "present simple", "présent continu", "present continu", "prétérit", "preterit", "futur", "will", "going to", "modaux", "can", "must", "should", "comparatif", "superlatif", "adjectif possessif", "pronom personnel", "question", "négation", "negation", "article", "articles", "some", "any"],
        formulas: [],
        concepts: ["Temps : présent simple/continu, prétérit, futur", "Modaux (can, must, should…)", "Comparatifs et superlatifs", "Questions et négations"],
      },
      {
        level: "college",
        title: "Vocabulaire et compréhension",
        keywords: ["vocabulaire", "thème", "theme", "école", "ecole", "famille", "maison", "nourriture", "vêtements", "vetements", "ville", "voyage", "compréhension", "comprehension", "lecture", "écouter", "ecouter", "dialoguer", "décrire", "decrire"],
        formulas: [],
        concepts: ["Lexique des thèmes du programme", "Compréhension orale et écrite", "S'exprimer : se présenter, décrire, raconter"],
      },
      {
        level: "lycee",
        title: "Anglais — temps et aspects avancés",
        keywords: ["present perfect", "past perfect", "pluperfect", "conditionnel", "passif", "voice passive", "discours indirect", "reported speech", "phrasal verbs", "conditionnel", "if clauses", "subjonctif", "gerund", "infinitive"],
        formulas: [],
        concepts: ["Present perfect et past perfect", "Voix passive et discours indirect", "Phrasal verbs et expressions idiomatiques"],
      },
      {
        level: "lycee",
        title: "Anglais — culture et argumentation",
        keywords: ["civilisation", "culture", "mythes et héros", "mythes et heros", "lieux et formes du pouvoir", "idée de progrès", "idee de progres", "espaces et échanges", "espaces et echanges", "argumenter", "essai", "essay", "opinion", "débattre", "debattre"],
        formulas: [],
        concepts: ["Axes culturels du lycée", "Construire un avis argumenté", "Compréhension de documents authentiques"],
      },
    ],
  },
  {
    id: "espagnol",
    label: "Espagnol",
    aliases: ["espagnol", "español", "espanol", "espagnole", "castillan", "subjonctif espagnol", "passé simple espagnol", "imparfait espagnol", "ser", "estar", "por", "para"],
    cycles: ["college", "lycee"],
    chapters: [
      {
        level: "college",
        title: "Grammaire espagnole",
        keywords: ["présent de l'indicatif", "presente de indicativo", "passé simple", "passe simple", "imparfait", "futur", "subjonctif", "impératif", "imperatif", "ser", "estar", "haber", "gustar", "pronom", "article défini", "article indéfini", "adjectif", "possessif", "démonstratif", "demonstratif"],
        formulas: [],
        concepts: ["Conjugaison : présent, passé simple, imparfait, futur", "Ser / estar / haber", "Subjonctif et son emploi"],
      },
      {
        level: "lycee",
        title: "Espagnol — temps avancés et culture",
        keywords: ["subjonctif imparfait", "conditionnel", "passé composé", "plus-que-parfait", "passe compose", "voix passive", "gérondif", "gerondif", "por", "para", "culture hispanique", "hispanique", "mondes hispaniques", "argumenter", "dissertation espagnole", "expression écrite espagnole"],
        formulas: [],
        concepts: ["Concordance des temps et subjonctif", "Emplois de por / para", "Axes culturels et argumentation"],
      },
    ],
  },
  {
    id: "allemand",
    label: "Allemand",
    aliases: ["allemand", "deutsch", "allemande", "grammaire allemande", "déclinaison allemande", "declinaison allemande", "vocabulaire allemand"],
    cycles: ["college", "lycee"],
    chapters: [
      {
        level: "college",
        title: "Grammaire allemande",
        keywords: ["déclinaison", "declinaison", "nominatif", "accusatif", "datif", "génitif", "genitif", "article", "articles", "pluriel", "verbe", "verbes", "présent", "passe compose", "prétérit", "preterit", "futur", "subordonnée", "subordonnee", "conjonction", "sein", "haben", "werden"],
        formulas: [],
        concepts: ["Déclinaisons (nominatif, accusatif, datif, génitif)", "Temps : présent, parfait, prétérit, futur", "Place du verbe dans la phrase allemande"],
      },
      {
        level: "lycee",
        title: "Allemand — temps avancés et culture",
        keywords: ["plus-que-parfait", "conditionnel", "subjonctif", "passif", "voix passive allemande", "préposition", "preposition", "cas", "culture germanophone", "germanophone", "argumenter en allemand"],
        formulas: [],
        concepts: ["Subjonctif et conditionnel", "Voix passive", "Prépositions et cas", "Axes culturels germanophones"],
      },
    ],
  },
  {
    id: "italien",
    label: "Italien",
    aliases: ["italien", "italiano", "italienne", "grammaire italienne", "vocabulaire italien", "passato prossimo", "imperfetto"],
    cycles: ["college", "lycee"],
    chapters: [
      {
        level: "college",
        title: "Grammaire italienne",
        keywords: ["présent", "passato prossimo", "imparfait", "futur", "conditionnel", "subjonctif", "congiuntivo", "article", "articles", "pronom", "pronomi", "essere", "avere", "adjectif possessif", "accord", "pluriel"],
        formulas: [],
        concepts: ["Conjugaison : présent, passato prossimo, imparfait, futur", "Être / avoir (essere / avere)", "Articles et accords"],
      },
      {
        level: "lycee",
        title: "Italien — temps avancés et culture",
        keywords: ["congiuntivo", "passé simple", "passato remoto", "gérondif", "gerundio", "culture italienne", "argumenter en italien"],
        formulas: [],
        concepts: ["Subjonctif (congiuntivo)", "Passato remoto et concordance des temps", "Axes culturels italiens"],
      },
    ],
  },
  {
    id: "latin",
    label: "Latin",
    aliases: ["latin", "déclinaison latine", "declinaison latine", "traduction latine", "version latine", "civilisation romaine", "auteur latin", "latiniste", "grec ancien"],
    cycles: ["college", "lycee"],
    chapters: [
      {
        level: "college",
        title: "Latin — langue",
        keywords: ["déclinaison", "declinaison", "nominatif", "vocatif", "accusatif", "génitif", "genitif", "datif", "ablatif", "conjugaison", "présent", "imparfait", "parfait", "infinitif", "participe", "ablative absolu", "traduction", "version"],
        formulas: [],
        concepts: ["Les 5 déclinaisons", "Conjugaison des verbes réguliers", "Cas et fonctions dans la phrase"],
      },
      {
        level: "lycee",
        title: "Latin — civilisation et textes",
        keywords: ["civilisation romaine", "mythologie", "auteur latin", "textes latins", "étymologie", "etymologie", "cité romaine", "cite romaine", "société romaine", "societe romaine", "traduction littéraire", "traduction litteraire"],
        formulas: [],
        concepts: ["Civilisation et histoire romaine", "Grands auteurs latins", "Étymologie et racines françaises"],
      },
    ],
  },
  {
    id: "technologie",
    label: "Technologie",
    aliases: ["technologie", "technique", "objet technique", "objets techniques", "design", "programmation", "algorithme", "algorithmes", "robot", "capteur", "capteurs", "actionneur", "actionneurs", "système numérique", "systeme numerique", "domotique", "impression 3d", "électronique", "electronique", "matériaux", "materiaux", "cycle de vie", "snt", "sciences numériques", "engrenage", "engrenages", "mécanisme", "mécanismes", "transmission", "assemblage", "assembler"],
    cycles: ["college", "lycee"],
    chapters: [
      {
        level: "college",
        title: "Objets techniques",
        keywords: ["fonction d'usage", "fonction d'usage", "fonction technique", "fonctions techniques", "contrainte", "contraintes", "cahier des charges", "design", "matériaux", "materiaux", "cycle de vie", "durée de vie", "duree de vie", "éco-conception", "eco-conception", "innovation", "invention", "évolution", "evolution", "solution technique", "solutions techniques"],
        formulas: [],
        concepts: ["Fonction d'usage et fonctions techniques", "Contraintes et cahier des charges", "Cycle de vie d'un objet et éco-conception"],
      },
      {
        level: "college",
        title: "Numérique et programmation",
        keywords: ["programmation", "algorithme", "algorithmes", "robot", "capteur", "capteurs", "actionneur", "actionneurs", "boucle", "boucles", "condition", "variable", "variables", "scratch", "python", "arduino", "objet connecté", "objet connecte", "données", "donnees", "traitement", "simulation", "maquette"],
        formulas: [],
        concepts: ["Algorithme : séquence, boucle, condition, variable", "Capteurs et actionneurs (robotique)", "Systèmes embarqués et objets connectés"],
      },
      {
        level: "seconde",
        title: "Sciences numériques et technologie (SNT)",
        keywords: ["snt", "sciences numériques", "sciences numeriques", "internet", "web", "données", "donnees", "géolocalisation", "geolocalisation", "réseaux sociaux", "reseaux sociaux", "photographie numérique", "photographie numerique", "objets connectés", "objets connectes", "moteur de recherche", "données massives", "donnees massives"],
        formulas: [],
        concepts: ["Internet et le web", "Données, algorithmes et moteurs de recherche", "Géolocalisation, réseaux sociaux, objets connectés"],
      },
    ],
  },
  {
    id: "ses",
    label: "SES",
    aliases: [
      "ses", "sciences économiques", "sciences economiques", "économie", "economie",
      "sociologie", "sciences politiques", "marché", "marche", "offre", "demande",
      "production", "croissance", "pib", "chômage", "chomage", "inflation",
      "monnaie", "inégalités", "inegalites", "entreprise", "budget", "consommation",
      "socialisation", "normes", "valeurs", "mobilité sociale", "mobilite sociale",
      "déviance", "deviance", "pouvoir", "opinion publique", "participation politique",
    ],
    cycles: ["lycee"],
    chapters: [
      {
        level: "seconde",
        title: "SES — économie, sociologie, sciences politiques",
        keywords: ["marché", "marche", "offre", "demande", "prix", "production", "entreprise", "ménage", "menage", "revenu", "budget", "consommation", "épargne", "epargne", "socialisation", "normes", "valeurs", "groupes sociaux", "pouvoir politique", "démocratie", "democratie", "citoyenneté", "citoyennete"],
        formulas: [],
        concepts: ["Marché : offre, demande, prix", "Ménages, entreprises : revenus et consommation", "Socialisation, normes et valeurs", "Pouvoir politique et citoyenneté"],
      },
      {
        level: "premiere",
        title: "SES — marché et société",
        keywords: ["offre", "demande", "équilibre de marché", "equilibre de marche", "élasticité", "elasticite", "monopole", "concurrence", "externalité", "externalite", "production", "coût", "cout", "productivité", "productivite", "revenu", "redistribution", "protection sociale", "inégalités", "inegalites", "déviance", "deviance", "contrôle social", "controle social"],
        formulas: [],
        concepts: ["Fonctionnement du marché et défaillances", "Production, coûts et productivité", "Redistribution et protection sociale", "Inégalités, déviance et contrôle social"],
      },
      {
        level: "terminale",
        title: "SES — approfondissement",
        keywords: ["croissance économique", "croissance economique", "développement", "developpement", "pib", "capital humain", "progrès technique", "progres technique", "chômage", "chomage", "emploi", "monnaie", "banque centrale", "politique monétaire", "politique monetaire", "politique budgétaire", "politique budgetaire", "mondialisation", "commerce international", "mobilité sociale", "mobilite sociale", "classe sociale", "lien social", "opinion publique", "vote", "participation politique"],
        formulas: [],
        concepts: ["Croissance, développement et PIB", "Chômage, emploi et politiques économiques", "Mondialisation et commerce international", "Mobilité sociale et classes sociales", "Opinion publique et vote"],
      },
    ],
  },
  {
    id: "nsi",
    label: "NSI",
    aliases: [
      "nsi", "numérique et sciences informatiques", "numerique et sciences informatiques",
      "programmation python", "python", "algorithmique", "algorithme", "complexité", "complexite",
      "récursivité", "recursivite", "base de données", "base de donnees", "sql",
      "architecture des ordinateurs", "réseaux", "reseaux", "protocole", "http",
      "html", "css", "javascript", "machine learning", "intelligence artificielle",
    ],
    cycles: ["lycee"],
    chapters: [
      {
        level: "lycee",
        title: "NSI — programmation",
        keywords: ["python", "variable", "variables", "boucle", "boucles", "fonction", "fonctions", "liste", "listes", "dictionnaire", "dictionnaires", "tuple", "traitement de données", "traitement de donnees", "type", "types", "itération", "iteration", "condition", "conditions"],
        formulas: [],
        concepts: ["Syntaxe Python : variables, types, boucles, fonctions", "Structures de données : listes, tuples, dictionnaires", "Traitement de données en table"],
      },
      {
        level: "lycee",
        title: "NSI — algorithmique",
        keywords: ["tri", "tris", "recherche", "algorithmes de tri", "tri par insertion", "tri par sélection", "tri par selection", "recherche dichotomique", "complexité", "complexite", "récursivité", "recursivite", "diviser pour régner", "diviser pour regner", "algorithme glouton", "algorithme des gloutons"],
        formulas: [],
        concepts: ["Tri par insertion, sélection", "Recherche et complexité (O(n), O(n²), O(log n))", "Récursivité et diviser pour régner"],
      },
      {
        level: "lycee",
        title: "NSI — données, web et réseaux",
        keywords: ["base de données", "base de donnees", "sql", "requête", "requete", "table", "tables", "html", "css", "javascript", "http", "url", "réseau", "reseau", "protocole", "protocoles", "internet", "paquet", "paquets", "architecture", "processeur", "mémoire", "memoire", "système d'exploitation", "systeme d'exploitation"],
        formulas: [],
        concepts: ["Bases de données et requêtes SQL", "Web : HTML, CSS, HTTP", "Architecture des machines et réseaux (protocoles, paquets)"],
      },
    ],
  },
  {
    id: "philosophie",
    label: "Philosophie",
    aliases: [
      "philosophie", "philo", "dissertation de philosophie", "sujet de philosophie",
      "bac de philo", "explication de texte", "auteur", "auteurs", "pensée", "pensee",
      "conscience", "perception", "autrui", "désir", "desir", "existence", "temps",
      "langage", "art", "travail", "technique", "religion", "histoire", "raison",
      "vérité", "verite", "justice", "droit", "état", "etat", "liberté", "liberte",
      "morale", "éthique", "ethique", "kant", "descartes", "platon", "aristote",
      "nietzsche", "sartre", "spinoza", "hume", "rousseau", "hegel", "arendt",
    ],
    cycles: ["lycee"],
    chapters: [
      {
        level: "terminale",
        title: "Philosophie — notions",
        keywords: ["conscience", "perception", "autrui", "désir", "desir", "existence", "temps", "langage", "art", "travail", "technique", "religion", "histoire", "raison", "vérité", "verite", "justice", "droit", "état", "etat", "liberté", "liberte", "morale", "éthique", "ethique", "notion", "notions"],
        formulas: [],
        concepts: ["Notions au programme : sujet, culture, raison et réel, politique, morale", "Problématiques associées à chaque notion", "Exemples et références pour la dissertation"],
      },
      {
        level: "terminale",
        title: "Philosophie — auteurs",
        keywords: ["platon", "aristote", "descartes", "kant", "rousseau", "spinoza", "hume", "hegel", "nietzsche", "sartre", "arendt", "bergson", "pascal", "montaigne", "auteur", "auteurs", "pensée", "pensee", "courant", "courants"],
        formulas: [],
        concepts: ["Grands auteurs et leurs thèses", "Courants : empirisme, rationalisme, existentialisme…", "Références mobilisables en dissertation"],
      },
      {
        level: "terminale",
        title: "Philosophie — méthode",
        keywords: ["dissertation", "explication de texte", "problématique", "problematique", "thèse", "these", "argument", "contre-exemple", "contre-exemple", "introduction", "conclusion", "transition", "réfutation", "refutation", "sujet de bac", "méthodologie", "methodologie"],
        formulas: [],
        concepts: ["Méthode de la dissertation de philosophie", "Méthode de l'explication de texte", "Construire une problématique et argumenter"],
      },
    ],
  },
];

/** Matières couvertes par la base, avec leur cycle (pour l'affichage). */
export const COVERED_SUBJECTS: { id: string; label: string; cycle: string }[] =
  SUBJECTS.flatMap((s) =>
    s.cycles.map((c) => ({
      id: s.id,
      label: s.label,
      cycle:
        c === "college" ? "Collège (6ᵉ → 3ᵉ)" : c === "lycee" ? "Lycée" : "Post-bac",
    })),
  );

/* ------------------------------------------------------------------ */
/* Détection de la matière                                              */
/* ------------------------------------------------------------------ */

export interface SubjectDetection {
  id: string;
  label: string;
  score: number;
}

/**
 * Détecte la matière dominante d'un texte (OCR). Score = nombre de mots-clés
 * (alias) différents trouvés. Retourne null si aucune matière n'est reconnue.
 */
export function detectSubject(text: string): SubjectDetection | null {
  const normalized = normalizeForMatch(text);
  if (!normalized) return null;
  let best: SubjectDetection | null = null;
  for (const subject of SUBJECTS) {
    let score = 0;
    // Dédoublonnage des alias normalisés : "liberté" et "liberte" (ou les
    // doublons accidentels) ne doivent compter qu'une seule fois.
    const counted = new Set<string>();
    for (const alias of subject.aliases) {
      const key = normalizeForMatch(alias);
      if (counted.has(key)) continue;
      counted.add(key);
      if (containsWord(normalized, alias)) score += 1;
    }
    if (score > 0 && (best === null || score > best.score)) {
      best = { id: subject.id, label: subject.label, score };
    }
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* Détection du niveau                                                  */
/* ------------------------------------------------------------------ */

const POSTBAC_MARKERS = [
  "post-bac", "postbac", "post bac", "classe préparatoire", "classe preparatoire",
  "prépa", "prepa", "mpsi", "pcsi", "bcpst", "mp2i", "ptsi", "math sup", "maths sup",
  "math spé", "maths spé", "math spe", "maths spe", "licence", "université", "universite",
  "faculté", "faculte", "l1", "l2", "l3", "master", "école d'ingénieur", "ecole d'ingenieur",
];

const TERMINALE_MARKERS = ["terminale", "tle", "term", "bac", "baccalauréat", "baccalaureat"];
const PREMIERE_MARKERS = ["première", "premiere", "1ère", "1ere", "1re"];
const SECONDE_MARKERS = ["seconde", "2nde", "2de", "2nd"];
const COLLEGE_MARKERS = [
  "collège", "college", "6ème", "6eme", "6e", "5ème", "5eme", "5e",
  "4ème", "4eme", "4e", "3ème", "3eme", "3e", "brevet", "sixième", "sixieme",
  "cinquième", "cinquieme", "quatrième", "quatrieme", "troisième", "troisieme",
];

export function detectLevel(text: string): LevelKey | null {
  const normalized = normalizeForMatch(text);
  if (!normalized) return null;
  if (POSTBAC_MARKERS.some((m) => containsWord(normalized, m))) return "postbac";
  if (TERMINALE_MARKERS.some((m) => containsWord(normalized, m))) return "terminale";
  if (PREMIERE_MARKERS.some((m) => containsWord(normalized, m))) return "premiere";
  if (SECONDE_MARKERS.some((m) => containsWord(normalized, m))) return "seconde";
  if (COLLEGE_MARKERS.some((m) => containsWord(normalized, m))) return "college";
  return null;
}

/** Libellé français d'un niveau détecté. */
export function levelLabel(level: LevelKey | null | undefined): string | undefined {
  switch (level) {
    case "college":
      return "Collège";
    case "seconde":
      return "Seconde";
    case "premiere":
      return "Première";
    case "terminale":
      return "Terminale";
    case "postbac":
      return "Post-bac";
    case "lycee":
      return "Lycée";
    default:
      return undefined;
  }
}

/* ------------------------------------------------------------------ */
/* Contenus avancés → paywall                                           */
/* ------------------------------------------------------------------ */

/** Marqueurs explicites de spécialité de lycée. */
const SPECIALITE_MARKERS = [
  "spécialité", "specialite", "spé", "spe",
  "maths expertes", "math expertes", "option maths expertes",
  "maths complémentaires", "math complementaires", "maths complementaires",
  "hggsp", "hlp", "llcer",
  "sciences de l'ingénieur", "sciences de l'ingenieur", "sciences de l'ingenieur",
  "ses approfondie", "ses approfondie",
  "spé maths", "spe maths", "spé math", "spe math",
  "spé physique", "spe physique", "spé chimie", "spe chimie",
  "spé svt", "spe svt", "spé ses", "spe ses", "spé nsi", "spe nsi",
  "spé histoire", "spe histoire", "spé géo", "spe geo",
  "nsi", "maths spé terminale",
];

/** Marqueurs de niveau post-bac / avancé. */
const AVANCE_MARKERS = [
  "post-bac", "postbac", "post bac", "classe préparatoire", "classe preparatoire",
  "prépa", "prepa", "mpsi", "pcsi", "bcpst", "mp2i", "ptsi", "math sup", "maths sup",
  "math spé", "maths spé", "math spe", "maths spe", "licence", "université", "universite",
  "faculté", "faculte", "master", "école d'ingénieur", "ecole d'ingenieur", "concours",
  "olympiades", "grand oral", "agrégation", "agregation",
];

/** Marqueurs explicites de philosophie (suffisent seuls à déclencher). */
const PHILO_STRONG = [
  "philosophie",
  "philo",
  "sujet de philosophie",
  "bac de philo",
  "dissertation de philosophie",
  "explication de texte philosophique",
];

export interface AdvancedDetection {
  advanced: boolean;
  category?: AdvancedCategory;
  reason?: string;
  subjectLabel?: string;
  level?: LevelKey | null;
}

/**
 * Détecte un contenu « avancé » qui déclenche le paywall pour le plan
 * Gratuit : philosophie, spécialités de lycée (spé, maths expertes, HGGSP,
 * NSI…) ou niveau post-bac / très avancé. Les contenus classiques (collège
 * et tronc commun lycée) ne sont JAMAIS marqués.
 */
export function detectAdvancedContent(text: string): AdvancedDetection {
  const normalized = normalizeForMatch(text);
  if (!normalized) return { advanced: false };

  // Garde-fou : un contenu de collège ne déclenche jamais le paywall.
  const level = detectLevel(normalized);
  if (level === "college") return { advanced: false, level };

  const subject = detectSubject(normalized);

  // 1) Philosophie → analyse approfondie. Deux mots-clés au minimum, OU un
  //    marqueur explicite (philosophie, philo, sujet de bac de philo…) : un
  //    texte isolé sur « la liberté » ou « la vérité » ne doit pas suffire.
  const philosophyStrong = PHILO_STRONG.some((m) =>
    containsWord(normalized, m),
  );
  if (
    subject?.id === "philosophie" &&
    (subject.score >= 2 || philosophyStrong)
  ) {
    return {
      advanced: true,
      category: "philosophie",
      reason:
        "Un sujet de philosophie a été détecté. Passe à Student ou Student Pro pour une analyse approfondie.",
      subjectLabel: subject.label,
      level,
    };
  }

  // 2) Spécialités de lycée (spé, maths expertes, NSI, HGGSP…).
  if (SPECIALITE_MARKERS.some((m) => containsWord(normalized, m))) {
    return {
      advanced: true,
      category: "specialite",
      reason:
        "Un contenu de spécialité a été détecté (spécialité, maths expertes, HGGSP…). Passe à Student ou Student Pro pour une analyse plus approfondie.",
      subjectLabel: subject?.label,
      level,
    };
  }

  // 3) Niveau avancé / post-bac.
  if (AVANCE_MARKERS.some((m) => containsWord(normalized, m))) {
    return {
      advanced: true,
      category: "avance",
      reason:
        "Un contenu d'un niveau avancé a été détecté (prépa, post-bac, concours…). Passe à Student ou Student Pro pour une analyse approfondie.",
      subjectLabel: subject?.label,
      level,
    };
  }

  return { advanced: false, level };
}

/* ------------------------------------------------------------------ */
/* Recherche dans la base de connaissances                              */
/* ------------------------------------------------------------------ */

export interface CurriculumKnowledge {
  subject: SubjectDetection | null;
  level: LevelKey | null;
  /** Chapitres correspondants (≤ 4, triés par pertinence). */
  chapters: {
    level: LevelKey;
    title: string;
    keywordsHit: number;
    formulas: string[];
    concepts: string[];
  }[];
  /** Formules de référence dédupliquées (tous chapitres retenus). */
  formulas: string[];
  /** La base couvre-t-elle le contenu avec une confiance suffisante ? */
  covered: boolean;
  confidence: "high" | "medium" | "low";
}

export function lookupCurriculum(text: string): CurriculumKnowledge {
  const normalized = normalizeForMatch(text);
  const subject = detectSubject(normalized);
  const level = detectLevel(normalized);

  const hits: {
    level: LevelKey;
    title: string;
    keywordsHit: number;
    formulas: string[];
    concepts: string[];
  }[] = [];

  if (subject) {
    const subjectDef = SUBJECTS.find((s) => s.id === subject.id);
    for (const chapter of subjectDef?.chapters ?? []) {
      // Dédoublonnage : les mots-clés "liberté"/"liberte" comptent une fois.
      const countedK = new Set<string>();
      const keywordsHit = chapter.keywords.filter((k) => {
        const key = normalizeForMatch(k);
        if (countedK.has(key)) return false;
        countedK.add(key);
        return containsWord(normalized, k);
      }).length;
      if (keywordsHit > 0) {
        hits.push({
          level: chapter.level,
          title: chapter.title,
          keywordsHit,
          formulas: chapter.formulas,
          concepts: chapter.concepts,
        });
      }
    }
  }

  // Les chapitres du niveau détecté d'abord, puis les plus pertinents.
  hits.sort((a, b) => {
    if (level && a.level === level && b.level !== level) return -1;
    if (level && b.level === level && a.level !== level) return 1;
    return b.keywordsHit - a.keywordsHit;
  });
  const top = hits.slice(0, 4);

  const formulas = [...new Set(top.flatMap((c) => c.formulas))];
  const confidence: CurriculumKnowledge["confidence"] =
    subject && top.length > 0
      ? subject.score >= 2 || top[0].keywordsHit >= 2
        ? "high"
        : "medium"
      : "low";

  return {
    subject,
    level,
    chapters: top,
    formulas,
    covered: Boolean(subject && top.length > 0),
    confidence,
  };
}

/* ------------------------------------------------------------------ */
/* Construction du contexte injecté à l'IA                              */
/* ------------------------------------------------------------------ */

/**
 * Rédige la section « Référence pédagogique » insérée dans le prompt IA :
 * matière + niveau détectés, notions et formules de la base de connaissances.
 * L'IA doit l'utiliser EN PRIORITÉ pour vérifier méthode et formules.
 */
export function buildCurriculumContext(knowledge: CurriculumKnowledge): string {
  const lines: string[] = [];
  lines.push(
    "— RÉFÉRENCE PÉDAGOGIQUE (programme scolaire français — base de connaissances StudySnap) —",
  );
  if (knowledge.subject) {
    lines.push(
      `Matière détectée : ${knowledge.subject.label}${knowledge.level ? ` · niveau ${levelLabel(knowledge.level)}` : ""}.`,
    );
  } else if (knowledge.level) {
    lines.push(`Niveau détecté : ${levelLabel(knowledge.level)}.`);
  } else {
    lines.push("Matière non reconnue avec certitude par la base.");
  }
  if (knowledge.chapters.length > 0) {
    lines.push(
      `Notions couvertes : ${knowledge.chapters.map((c) => c.title).join(" ; ")}.`,
    );
  }
  if (knowledge.formulas.length > 0) {
    lines.push(`Formules de référence : ${knowledge.formulas.join(" · ")}`);
  }
  if (knowledge.confidence === "high") {
    lines.push(
      "Consigne : utilise cette référence EN PRIORITÉ pour vérifier la méthode, les formules et le vocabulaire de ta réponse.",
    );
  } else if (knowledge.confidence === "medium") {
    lines.push(
      "Consigne : utilise cette référence pour vérifier les notions reconnues. Si l'énoncé porte sur une notion absente de la base, réponds avec la plus grande rigueur et signale ton doute dans \"detection.legibilityNote\".",
    );
  } else {
    lines.push(
      "Consigne : le contenu n'est pas couvert par la base de connaissances. Analyse-le avec la plus grande rigueur, sans inventer de donnée, et signale toute incertitude dans \"detection.legibilityNote\".",
    );
  }
  return lines.join("\n");
}

/** Construit la requête de recherche de secours (Brave/Tavily…). */
export function buildSearchQuery(
  text: string,
  knowledge: CurriculumKnowledge,
): string {
  const subject = knowledge.subject?.label;
  const level = levelLabel(knowledge.level);
  const topic =
    knowledge.chapters.length > 0 ? knowledge.chapters[0].title : undefined;
  const head = (text ?? "").trim().replace(/\s+/g, " ").slice(0, 160);
  const parts = [
    "programme scolaire français",
    subject,
    level,
    topic,
    head,
  ].filter((p): p is string => Boolean(p));
  return parts.join(" ");
}
