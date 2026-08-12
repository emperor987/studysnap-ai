/**
 * Sons du quiz — Web Audio API, synthèse locale.
 *
 * Aucun fichier audio, aucune dépendance, aucun réseau : les sons sont des
 * notes courtes (< 300 ms) générées à la demande, donc l'ajout de cette
 * fonctionnalité ne pèse rien sur le chargement de la page quiz.
 *
 * Politique d'autoplay des navigateurs : l'AudioContext n'est créé que lors
 * du premier appel, qui survient toujours dans un geste utilisateur (clic sur
 * une réponse / soumission du formulaire) — `resume()` est appelé si besoin
 * (Safari iOS).
 *
 * Préférence : `localStorage["studysnap.quizSound"]` ("off" = coupé),
 * activé par défaut. Toute erreur audio est ignorée : un problème de son ne
 * bloque jamais le déroulement du quiz.
 */

const STORAGE_KEY = "studysnap.quizSound";

/** Le son est-il activé ? (activé par défaut, persisté entre les sessions) */
export function isQuizSoundEnabled(): boolean {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) !== "off";
  } catch {
    // Pas de stockage disponible (blocage navigateur, test…) → activé.
    return true;
  }
}

/** Persiste la préférence son (activé/coupé). */
export function setQuizSoundEnabled(enabled: boolean): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    /* silencieux : le mute reste valable pour la session en cours */
  }
}

type Ctor = new () => AudioContext;

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor };
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) {
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") {
    void ctx.resume().catch(() => {});
  }
  return ctx;
}

/** Joue une note courte avec enveloppe douce (pas de clic, pas d'intrusion). */
function tone(
  context: AudioContext,
  freq: number,
  start: number,
  duration: number,
  type: OscillatorType = "sine",
  gainPeak = 0.1,
): void {
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(gainPeak, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(context.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

/**
 * Bonne réponse : deux notes ascendantes (Do5 → Sol5), brèves et positives.
 * Durée totale ≈ 0,29 s.
 */
export function playCorrectSound(): void {
  if (!isQuizSoundEnabled()) return;
  const context = getContext();
  if (!context) return;
  const t = context.currentTime + 0.01;
  tone(context, 523.25, t, 0.14, "sine", 0.1);
  tone(context, 783.99, t + 0.11, 0.18, "sine", 0.1);
}

/**
 * Mauvaise réponse : deux notes graves descendantes (Mi4 → Ré4), volume bas,
 * neutre et jamais agressif ni humiliant. Durée totale ≈ 0,32 s.
 */
export function playWrongSound(): void {
  if (!isQuizSoundEnabled()) return;
  const context = getContext();
  if (!context) return;
  const t = context.currentTime + 0.01;
  tone(context, 329.63, t, 0.16, "sine", 0.06);
  tone(context, 293.66, t + 0.13, 0.19, "sine", 0.05);
}
