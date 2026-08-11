/**
 * StudySnap — données de démonstration réalistes.
 *
 * Utilisées quand aucune clé IA n'est configurée : l'app reste 100% fonctionnelle
 * (démo à vide) avec des analyses, fiches et quiz crédibles en français.
 */

export type DemoExercise = {
  question: string;
  answer: string;
  hint: string;
};

export type DemoAnalysis = {
  detection: {
    subject: string;
    topic: string;
    level: string;
    prompt: string;
    data: string;
    formulas: string[];
    legible: boolean;
  };
  quick: { answer: string; calculation: string; keyPoint: string };
  explain: {
    question: string;
    importantInfo: string[];
    method: string;
    steps: string[];
    result: string;
    commonMistake: string;
  };
  revise: {
    lesson: string;
    keyFormulas: string[];
    exercises: DemoExercise[];
  };
};

export type DemoSheet = {
  title: string;
  subject: string;
  level: string;
  content: {
    concepts: { term: string; definition: string }[];
    formulas: { name: string; formula: string }[];
    methods: string[];
    example: { question: string; solution: string };
    pitfalls: string[];
    takeaways: string[];
  };
};

export const DEMO_SUBJECTS = [
  "Mathématiques",
  "Physique-Chimie",
  "Français",
  "Histoire-Géo",
  "SVT",
  "Anglais",
  "Espagnol",
  "Philosophie",
  "NSI",
];

export const DEMO_LEVELS = [
  { value: "college", label: "Collège" },
  { value: "seconde", label: "Seconde" },
  { value: "premiere", label: "Première" },
  { value: "terminale", label: "Terminale" },
  { value: "postbac", label: "Post-bac" },
];

function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(...parts: (string | number)[]) {
  let h = 2166136261;
  for (const p of parts) {
    const s = String(p);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
  }
  return h >>> 0;
}

export function pickFrom<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function demoEquations(seed: number): DemoAnalysis {
  const rng = mulberry32(seed * 2654435761);
  // Choisit a et b tels que ax + b = 17 admette une solution entière x.
  let a = 2 + Math.floor(rng() * 5); // 2..6
  let k = 1 + Math.floor(rng() * 4); // x = k
  while (a * k >= 17) k = 1 + Math.floor(rng() * 4);
  const b = 17 - a * k;
  const x = k;
  const q: DemoExercise[] = [
    {
      question: `Résoudre dans ℝ : ${a}x + ${b} = 17`,
      answer: `x = ${x}`,
      hint: "Isole x en deux étapes : soustrais puis divise.",
    },
    {
      question: `Résoudre dans ℝ : 3(x − 2) = ${a * 3}`,
      answer: `x = ${2 + a}`,
      hint: "Divise d'abord les deux membres par 3.",
    },
    {
      question: `Résoudre dans ℝ : x − ${b} = ${a + b}`,
      answer: `x = ${a + 2 * b}`,
      hint: "Ajoute le même nombre des deux côtés.",
    },
  ];
  return {
    detection: {
      subject: "Mathématiques",
      topic: "Équations du premier degré",
      level: "seconde",
      prompt: `Résoudre dans ℝ l'équation ${a}x + ${b} = 17.`,
      data: `Coefficients : a = ${a}, b = ${b}, constante = 17.`,
      formulas: ["x = (17 − b) / a"],
      legible: true,
    },
    quick: {
      answer: `x = ${x}`,
      calculation: `${a}x + ${b} = 17 → ${a}x = ${17 - b} → x = (${17 - b}) / ${a} = ${x}`,
      keyPoint: "On isole x en appliquant la même opération aux deux membres.",
    },
    explain: {
      question: `Résoudre dans ℝ l'équation ${a}x + ${b} = 17.`,
      importantInfo: [
        "Équation du premier degré à une inconnue x.",
        `Les coefficients sont ${a} (devant x) et ${b} (terme constant).`,
        "La solution doit vérifier l'équation de départ.",
      ],
      method: "Isoler x en inversant les opérations : on soustrait d'abord le terme constant, puis on divise par le coefficient de x.",
      steps: [
        `Soustraire ${b} des deux membres : ${a}x = ${17 - b}.`,
        `Diviser les deux membres par ${a} : x = ${17 - b} / ${a}.`,
        `Simplifier : x = ${x}.`,
        `Vérification : ${a} × ${x} + ${b} = ${a * x} + ${b} = ${a * x + b} = 17. La solution est correcte.`,
      ],
      result: `S = { ${x} }`,
      commonMistake:
        "Oublier d'appliquer l'opération aux deux membres (ex. soustraire b seulement à gauche), ou se tromper de signe en divisant par un coefficient négatif.",
    },
    revise: {
      lesson: `Une **équation du premier degré** est une égalité de la forme $ax + b = c$ où $a \\neq 0$. Résoudre, c'est trouver la (ou les) valeur(s) de $x$ qui rendent l'égalité vraie. On utilise la règle d'or : **toute opération faite d'un côté doit être faite de l'autre**.`,
      keyFormulas: [
        "$ax + b = c \\iff x = \\dfrac{c - b}{a}$ (si $a \\neq 0$)",
        "Produit en croix : $\\dfrac{a}{b} = \\dfrac{c}{d} \\iff ad = bc$",
      ],
      exercises: q,
    },
  };
}

function demoPythagore(seed: number): DemoAnalysis {
  const rng = mulberry32(seed * 97);
  const legs = [3, 4, 5, 12, 6, 8, 9, 12];
  const i = Math.floor(rng() * 4) * 2;
  const a = legs[i];
  const b = legs[i + 1];
  const c = Math.sqrt(a * a + b * b);
  const q: DemoExercise[] = [
    {
      question: `Dans un triangle rectangle, les côtés de l'angle droit mesurent ${a} cm et ${b} cm. Quelle est la longueur de l'hypoténuse ?`,
      answer: `${c} cm`,
      hint: "Applique le théorème de Pythagore : c² = a² + b².",
    },
    {
      question: `Un triangle a pour côtés ${a} cm, ${b} cm et ${c} cm. Est-il rectangle ?`,
      answer: `Oui, car ${a}² + ${b}² = ${c}².`,
      hint: "Vérifie si le plus grand côté au carré vaut la somme des carrés des deux autres.",
    },
    {
      question: `L'hypoténuse d'un triangle rectangle mesure ${c} cm et un côté de l'angle droit mesure ${a} cm. Combien mesure l'autre côté ?`,
      answer: `${b} cm`,
      hint: "C'est la réciproque : côté² = hypoténuse² − côté connu².",
    },
  ];
  return {
    detection: {
      subject: "Mathématiques",
      topic: "Théorème de Pythagore",
      level: "seconde",
      prompt: `Calculer la longueur de l'hypoténuse d'un triangle rectangle dont les côtés de l'angle droit mesurent ${a} cm et ${b} cm.`,
      data: `Triangle rectangle ; côtés de l'angle droit : ${a} cm et ${b} cm.`,
      formulas: ["c² = a² + b²", "c = √(a² + b²)"],
      legible: true,
    },
    quick: {
      answer: `L'hypoténuse mesure ${c} cm.`,
      calculation: `c² = ${a}² + ${b}² = ${a * a} + ${b * b} = ${a * a + b * b} → c = √(${a * a + b * b}) = ${c} cm`,
      keyPoint: "Dans un triangle rectangle, l'hypoténuse au carré vaut la somme des carrés des deux autres côtés.",
    },
    explain: {
      question: `Dans un triangle rectangle, les côtés de l'angle droit mesurent ${a} cm et ${b} cm. Calculer l'hypoténuse.`,
      importantInfo: [
        "Le triangle est rectangle → le théorème de Pythagore s'applique.",
        `Les deux côtés donnés (${a} cm et ${b} cm) sont ceux de l'angle droit.`,
        "L'hypoténuse est le côté opposé à l'angle droit (le plus long).",
      ],
      method: "Écrire l'égalité de Pythagore, calculer les carrés, additionner, puis prendre la racine carrée.",
      steps: [
        `Identifier l'hypoténuse : c'est le côté cherché.`,
        `Écrire l'égalité : c² = ${a}² + ${b}².`,
        `Calculer : c² = ${a * a} + ${b * b} = ${a * a + b * b}.`,
        `Prendre la racine carrée : c = √(${a * a + b * b}) = ${c} cm.`,
        "Conclure : l'hypoténuse mesure ${c} cm.",
      ],
      result: `c = ${c} cm`,
      commonMistake:
        "Confondre l'hypoténuse avec un autre côté : on doit toujours additionner les carrés des côtés de l'angle droit, jamais ceux de l'hypoténuse.",
    },
    revise: {
      lesson: `Le **théorème de Pythagore** relie les longueurs des côtés d'un triangle rectangle : le carré de l'hypoténuse est égal à la somme des carrés des deux autres côtés. Sa **réciproque** permet de prouver qu'un triangle est rectangle.`,
      keyFormulas: [
        "Théorème : $c^2 = a^2 + b^2$ (c = hypoténuse)",
        "Réciproque : si $c^2 = a^2 + b^2$, alors le triangle est rectangle",
        "Longueur : $c = \\sqrt{a^2 + b^2}$",
      ],
      exercises: q,
    },
  };
}

function demoFactorisation(seed: number): DemoAnalysis {
  const rng = mulberry32(seed * 131);
  const pairs = [
    { x: 3, y: 6 },
    { x: 2, y: 6 },
    { x: 4, y: 4 },
    { x: 5, y: 10 },
    { x: 3, y: 9 },
    { x: 2, y: 8 },
  ];
  const p = pairs[Math.floor(rng() * pairs.length)];
  const { x, y } = p;
  const a2 = x * x;
  const q: DemoExercise[] = [
    {
      question: `Factoriser l'expression : ${x}²x² − ${y * y}`,
      answer: `(${x}x − ${y})(${x}x + ${y})`,
      hint: "C'est une différence de deux carrés : a² − b² = (a − b)(a + b).",
    },
    {
      question: `Factoriser l'expression : ${x}x² + ${y}x`,
      answer: `${x}x(x + ${y / x})`,
      hint: "Cherche le facteur commun : x apparaît dans chaque terme.",
    },
    {
      question: `Factoriser : x² + ${2 * x}x + ${x * x}`,
      answer: `(x + ${x})²`,
      hint: "C'est une identité remarquable : a² + 2ab + b² = (a + b)².",
    },
  ];
  return {
    detection: {
      subject: "Mathématiques",
      topic: "Factorisation — identités remarquables",
      level: "seconde",
      prompt: `Factoriser l'expression ${x}²x² − ${y * y}.`,
      data: `Expression : ${x}²x² − ${y * y}.`,
      formulas: ["a² − b² = (a − b)(a + b)", "a² + 2ab + b² = (a + b)²", "ka + kb = k(a + b)"],
      legible: true,
    },
    quick: {
      answer: `(${x}x − ${y})(${x}x + ${y})`,
      calculation: `${x}²x² − ${y * y} = (${x}x)² − ${y}² = (${x}x − ${y})(${x}x + ${y})`,
      keyPoint: "Reconnaître une différence de deux carrés pour appliquer a² − b² = (a − b)(a + b).",
    },
    explain: {
      question: `Factoriser l'expression ${x}²x² − ${y * y}.`,
      importantInfo: [
        `${x}²x² = (${x}x)² : c'est un carré parfait.`,
        `${y * y} = ${y}² : c'est aussi un carré parfait.`,
        "Il y a un signe « − » entre les deux carrés → différence de deux carrés.",
      ],
      method: "Repérer la forme a² − b², identifier a et b, puis appliquer la formule.",
      steps: [
        `Écrire l'expression sous la forme a² − b² : (${x}x)² − ${y}².`,
        `Identifier a = ${x}x et b = ${y}.`,
        `Appliquer la formule a² − b² = (a − b)(a + b).`,
        `Écrire le résultat : (${x}x − ${y})(${x}x + ${y}).`,
      ],
      result: `(${x}x − ${y})(${x}x + ${y})`,
      commonMistake:
        "Écrire (a − b)² au lieu de (a − b)(a + b), ou oublier de reconnaître que 9x² = (3x)².",
    },
    revise: {
      lesson: `**Factoriser**, c'est transformer une somme en produit. Les trois identités remarquables sont les outils de base : $a^2 - b^2 = (a-b)(a+b)$, $a^2 + 2ab + b^2 = (a+b)^2$ et $a^2 - 2ab + b^2 = (a-b)^2$. On cherche aussi toujours un **facteur commun** avant d'appliquer une identité.`,
      keyFormulas: [
        "$a^2 - b^2 = (a-b)(a+b)$",
        "$a^2 + 2ab + b^2 = (a+b)^2$",
        "$ka + kb = k(a+b)$",
      ],
      exercises: q,
    },
  };
}

function demoFonctions(seed: number): DemoAnalysis {
  const rng = mulberry32(seed * 173);
  const a = 2 + Math.floor(rng() * 4);
  const b = -3 + Math.floor(rng() * 7);
  const x = 1 + Math.floor(rng() * 5);
  const fx = a * x + b;
  const root = -b / a;
  const q: DemoExercise[] = [
    {
      question: `Soit f(x) = ${a}x ${b < 0 ? "−" : "+"} ${Math.abs(b)}. Calculer f(${x}).`,
      answer: `f(${x}) = ${fx}`,
      hint: "Remplace x par sa valeur dans l'expression.",
    },
    {
      question: `Soit f(x) = ${a}x ${b < 0 ? "−" : "+"} ${Math.abs(b)}. Résoudre f(x) = 0.`,
      answer: `x = ${root}`,
      hint: "f(x) = 0 → ax + b = 0 → x = −b/a.",
    },
    {
      question: `La droite représentant f(x) = ${a}x ${b < 0 ? "−" : "+"} ${Math.abs(b)} coupe l'axe des ordonnées en quel point ?`,
      answer: `(0 ; ${b})`,
      hint: "À l'intersection avec l'axe des ordonnées, x = 0.",
    },
  ];
  return {
    detection: {
      subject: "Mathématiques",
      topic: "Fonctions affines",
      level: "seconde",
      prompt: `Soit f la fonction affine définie par f(x) = ${a}x ${b < 0 ? "−" : "+"} ${Math.abs(b)}. Calculer f(${x}).`,
      data: `f(x) = ${a}x ${b < 0 ? "−" : "+"} ${Math.abs(b)} ; x = ${x}.`,
      formulas: ["f(x) = ax + b", "coefficient directeur : a", "ordonnée à l'origine : b"],
      legible: true,
    },
    quick: {
      answer: `f(${x}) = ${fx}`,
      calculation: `f(${x}) = ${a} × ${x} ${b < 0 ? "−" : "+"} ${Math.abs(b)} = ${a * x} ${b < 0 ? "−" : "+"} ${Math.abs(b)} = ${fx}`,
      keyPoint: "Une fonction affine s'écrit f(x) = ax + b ; on calcule une image en remplaçant x.",
    },
    explain: {
      question: `Soit f(x) = ${a}x ${b < 0 ? "−" : "+"} ${Math.abs(b)}. Calculer f(${x}) et interpréter.`,
      importantInfo: [
        "f est une fonction affine : f(x) = ax + b avec a = ${a} et b = ${b}.",
        "Calculer f(${x}) = l'image de ${x} par f.",
        "La représentation graphique est une droite.",
      ],
      method: "Remplacer la variable x par sa valeur, puis appliquer les priorités de calcul (multiplication avant addition).",
      steps: [
        `Écrire f(${x}) = ${a} × ${x} ${b < 0 ? "−" : "+"} ${Math.abs(b)}.`,
        `Calculer le produit : ${a} × ${x} = ${a * x}.`,
        `Ajouter b : ${a * x} ${b < 0 ? "−" : "+"} ${Math.abs(b)} = ${fx}.`,
        `Conclure : f(${x}) = ${fx}.`,
      ],
      result: `f(${x}) = ${fx}`,
      commonMistake:
        "Faire l'addition avant la multiplication, ou confondre l'image f(x) avec l'antécédent x.",
    },
    revise: {
      lesson: `Une **fonction affine** $f$ est définie par $f(x) = ax + b$. Le nombre $a$ est le **coefficient directeur** (pente de la droite), $b$ l'**ordonnée à l'origine**. L'image de $x$ s'obtient en remplaçant $x$ dans la formule ; l'antécédent de $y$ en résolvant $f(x) = y$.`,
      keyFormulas: [
        "$f(x) = ax + b$",
        "Racine : $x_0 = -\\dfrac{b}{a}$",
        "Variation : croissante si $a > 0$, décroissante si $a < 0$",
      ],
      exercises: q,
    },
  };
}

function demoOhm(seed: number): DemoAnalysis {
  const rng = mulberry32(seed * 251);
  const U = 6 + Math.floor(rng() * 10);
  const R = 2 + Math.floor(rng() * 10);
  const I = U / R;
  const q: DemoExercise[] = [
    {
      question: `Un conducteur ohmique de résistance R = ${R} Ω est soumis à une tension U = ${U} V. Calculer l'intensité I qui le traverse.`,
      answer: `I = ${I} A`,
      hint: "Loi d'Ohm : U = R × I, donc I = U / R.",
    },
    {
      question: `Quelle tension faut-il appliquer à une résistance de ${R} Ω pour y faire circuler ${I} A ?`,
      answer: `U = ${U} V`,
      hint: "U = R × I.",
    },
    {
      question: `Une résistance de ${R} Ω laisse passer ${I} A. L'intensité double-t-elle si la tension double ?`,
      answer: "Oui : U = R × I est une relation de proportionnalité (R constant).",
      hint: "Regarde si U et I sont proportionnels.",
    },
  ];
  return {
    detection: {
      subject: "Physique-Chimie",
      topic: "Loi d'Ohm",
      level: "seconde",
      prompt: `Calculer l'intensité du courant traversant une résistance de ${R} Ω soumise à une tension de ${U} V.`,
      data: `Résistance R = ${R} Ω ; tension U = ${U} V.`,
      formulas: ["U = R × I", "I = U / R", "R = U / I"],
      legible: true,
    },
    quick: {
      answer: `I = ${I} A`,
      calculation: `I = U / R = ${U} / ${R} = ${I} A`,
      keyPoint: "La loi d'Ohm relie tension, intensité et résistance : U = R × I.",
    },
    explain: {
      question: `Un conducteur ohmique de résistance ${R} Ω est soumis à une tension de ${U} V. Calculer l'intensité.`,
      importantInfo: [
        "La loi d'Ohm s'écrit U = R × I (U en volts, R en ohms, I en ampères).",
        `U = ${U} V, R = ${R} Ω.`,
        "On cherche I, donc on utilise la forme I = U / R.",
      ],
      method: "Identifier les grandeurs connues, choisir la bonne forme de la loi d'Ohm, remplacer et calculer.",
      steps: [
        `Écrire la loi d'Ohm : U = R × I.`,
        `Isoler l'intensité : I = U / R.`,
        `Remplacer par les valeurs : I = ${U} / ${R}.`,
        `Calculer : I = ${I} A.`,
      ],
      result: `I = ${I} A`,
      commonMistake:
        "Inverser la formule (I = R × U) ou oublier les unités : la résistance doit être en ohms et la tension en volts.",
    },
    revise: {
      lesson: `La **loi d'Ohm** modélise un conducteur ohmique (résistance) : la tension à ses bornes est proportionnelle à l'intensité qui le traverse, avec la résistance pour coefficient de proportionnalité : $U = R \\times I$.`,
      keyFormulas: [
        "$U = R \\times I$",
        "$I = \\dfrac{U}{R}$",
        "$R = \\dfrac{U}{I}$",
      ],
      exercises: q,
    },
  };
}

export function demoAnalysis(seed: number): DemoAnalysis {
  const fns = [demoEquations, demoPythagore, demoFactorisation, demoFonctions, demoOhm];
  const idx = seed % fns.length;
  return fns[idx](seed);
}

export function demoSheet(seed: number, subject: string): DemoSheet {
  const analysis = demoAnalysis(seed);
  const fallback =
    subject === "Physique-Chimie"
      ? demoOhm(seed)
      : subject === "Français"
        ? demoPythagore(seed + 1)
        : demoAnalysis(seed + 2);
  const src = fallback.detection.subject === subject ? fallback : analysis;
  const d = src.detection;
  return {
    title: `Fiche — ${d.topic}`,
    subject: d.subject,
    level: d.level,
    content: {
      concepts: [
        {
          term: d.topic.split(" ")[0],
          definition: src.revise.lesson.replace(/\*\*/g, "").split(".")[0] + ".",
        },
        { term: "Notion clé", definition: src.quick.keyPoint },
        {
          term: "Exemple de référence",
          definition: `L'exercice type porte sur « ${d.prompt} » et se résout avec la méthode décrite ci-dessous.`,
        },
      ],
      formulas: src.revise.keyFormulas.map((f, i) => ({
        name: `Formule ${i + 1}`,
        formula: f,
      })),
      methods: [
        src.explain.method,
        "Toujours vérifier le résultat en remplaçant dans l'énoncé de départ.",
      ],
      example: { question: d.prompt, solution: src.explain.result },
      pitfalls: [src.explain.commonMistake, "Ne pas sauter d'étape : chaque étape écrite rapporte des points."],
      takeaways: src.quick.keyPoint.split(". "),
    },
  };
}

function demoQuizMath(
  seed: number,
  count: number,
  difficulty: string,
  types: string[],
): { questions: { type: string; question: string; options?: string[]; answer: string; explanation: string; topic: string }[] } {
  const rng = mulberry32(seed * 31337);
  const questions: { type: string; question: string; options?: string[]; answer: string; explanation: string; topic: string }[] = [];
  const typePool = types.length ? types : ["qcm", "qcm", "truefalse", "free", "problem"];
  const k = difficulty === "easy" ? 2 : difficulty === "hard" ? 7 : 4;
  for (let i = 0; i < count; i++) {
    const type = typePool[i % typePool.length];
    // Génère une équation à solution entière : ax + b = 20 avec b = 20 − a·x
    let a = 2 + Math.floor(rng() * Math.max(k, 2));
    let x = 1 + Math.floor(rng() * 3);
    while (a * x >= 20) x = 1 + Math.floor(rng() * 3);
    const b = 20 - a * x;
    if (type === "truefalse") {
      const correct = rng() > 0.5;
      const statement = correct
        ? `Pour l'équation ${a}x + ${b} = 20, la solution est x = ${x}.`
        : `Pour l'équation ${a}x + ${b} = 20, la solution est x = ${x + 1}.`;
      questions.push({
        type: "truefalse",
        question: `Vrai ou faux ? ${statement}`,
        options: ["Vrai", "Faux"],
        answer: correct ? "Vrai" : "Faux",
        explanation: `On résout : ${a}x = ${20 - b} donc x = ${20 - b}/${a} = ${x}.`,
        topic: "Équations",
      });
    } else if (type === "free") {
      questions.push({
        type: "free",
        question: `Résoudre dans ℝ : ${a}x + ${b} = 20.`,
        answer: `x = ${x}`,
        explanation: `x = (20 − ${b}) / ${a} = ${x}.`,
        topic: "Équations",
      });
    } else if (type === "problem") {
      const u = 5 + Math.floor(rng() * 8);
      const r = 2 + Math.floor(rng() * 5);
      const iVal = u / r;
      questions.push({
        type: "problem",
        question: `Une lampe de résistance ${r} Ω est branchée sur une pile de ${u} V. Quelle intensité (en A) la traverse ?`,
        options: [`${iVal.toFixed(2)} A`, `${(u * r).toFixed(2)} A`, `${r} A`, `${u} A`],
        answer: `${iVal.toFixed(2)} A`,
        explanation: `Loi d'Ohm : I = U / R = ${u} / ${r} = ${iVal.toFixed(2)} A.`,
        topic: "Électricité",
      });
    } else {
      const opts = [
        `x = ${x}`,
        `x = ${x + 1}`,
        `x = ${x - 2}`,
        `x = ${x + 3}`,
      ];
      questions.push({
        type: "qcm",
        question: `L'équation ${a}x + ${b} = 20 admet pour solution :`,
        options: opts,
        answer: `x = ${x}`,
        explanation: `${a} × ${x} + ${b} = ${a * x + b} = 20. La seule valeur qui vérifie l'équation est x = ${x}.`,
        topic: "Équations",
      });
    }
  }
  return { questions };
}

export function demoQuiz(
  seed: number,
  subject: string,
  count: number,
  difficulty: string,
  types: string[],
): { title: string; questions: { type: string; question: string; options?: string[]; answer: string; explanation: string; topic: string }[] } {
  if (subject === "Mathématiques" || subject === "") {
    return { title: `Quiz ${subject || "Mathématiques"}`, ...demoQuizMath(seed, count, difficulty, types) };
  }
  // Autres matières : quiz générique crédible
  const rng = mulberry32(seed * 999);
  const questions: { type: string; question: string; options?: string[]; answer: string; explanation: string; topic: string }[] = [];
  const pool = [
    {
      type: "qcm" as const,
      question: "Quelle est l'unité de l'énergie dans le Système international ?",
      options: ["Le watt", "Le joule", "Le volt", "L'ampère"],
      answer: "Le joule",
      explanation: "L'énergie s'exprime en joules (J) ; le watt est une puissance, le volt une tension, l'ampère une intensité.",
      topic: "Unités",
    },
    {
      type: "truefalse" as const,
      question: "La tension se mesure en volts (V).",
      options: ["Vrai", "Faux"],
      answer: "Vrai",
      explanation: "La tension électrique s'exprime en volts, en hommage à Alessandro Volta.",
      topic: "Électricité",
    },
    {
      type: "qcm" as const,
      question: "Une année-lumière est une unité de…",
      options: ["Temps", "Distance", "Vitesse", "Luminosité"],
      answer: "Distance",
      explanation: "L'année-lumière est la distance parcourue par la lumière en un an (~9 460 milliards de km).",
      topic: "Astronomie",
    },
    {
      type: "free" as const,
      question: "Complète : la formule reliant vitesse, distance et temps est v = …",
      answer: "d / t",
      explanation: "La vitesse moyenne est le rapport de la distance parcourue sur la durée du trajet.",
      topic: "Mouvement",
    },
    {
      type: "qcm" as const,
      question: "Quel appareil mesure l'intensité du courant ?",
      options: ["Le voltmètre", "L'ampèremètre", "L'ohmmètre", "Le wattmètre"],
      answer: "L'ampèremètre",
      explanation: "L'ampèremètre se branche en série et mesure l'intensité ; le voltmètre se branche en dérivation.",
      topic: "Mesures",
    },
    {
      type: "truefalse" as const,
      question: "Dans un circuit en série, l'intensité est la même en tout point.",
      options: ["Vrai", "Faux"],
      answer: "Vrai",
      explanation: "En série, le courant ne se divise pas : l'intensité est identique dans tout le circuit.",
      topic: "Circuits",
    },
  ];
  for (let i = 0; i < count; i++) {
    const q = pool[i % pool.length];
    const chosenType = types.length ? types[i % types.length] : q.type;
    questions.push({ ...q, type: chosenType === "problem" ? "qcm" : chosenType });
  }
  return { title: `Quiz ${subject}`, questions };
}
