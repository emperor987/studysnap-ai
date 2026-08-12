/**
 * Tests unitaires — sons du quiz (`src/lib/quiz-sounds.ts`).
 *
 * Les sons sont synthétisés par Web Audio API (aucun fichier, aucune
 * dépendance). On vérifie avec un AudioContext factice :
 * - activés par défaut, préférence persistée (mute) ;
 * - bonne réponse = 2 notes ascendantes, mauvaise réponse = 2 notes graves ;
 * - chaque son dure moins d'une seconde (non intrusif) ;
 * - le mute est respecté au moment du clic (aucun nœud audio créé) ;
 * - l'AudioContext est repris s'il est suspendu (Safari iOS).
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  isQuizSoundEnabled,
  playCorrectSound,
  playWrongSound,
  setQuizSoundEnabled,
} from "@/lib/quiz-sounds";

/* ------------------------------------------------------------------ */
/* Mocks : AudioContext + localStorage                                 */
/* ------------------------------------------------------------------ */

class FakeGain {
  gain = {
    setValueAtTime() {},
    exponentialRampToValueAtTime() {},
  };
  connect() {
    return this;
  }
}

class FakeOscillator {
  type = "sine" as OscillatorType;
  freq = 0;
  startT = 0;
  stopT = 0;
  frequency = {
    setValueAtTime: (v: number) => {
      this.freq = v;
    },
  };
  connect(node: unknown) {
    return node;
  }
  start(t: number) {
    this.startT = t;
  }
  stop(t: number) {
    this.stopT = t;
  }
}

const contexts: FakeAudioContext[] = [];

class FakeAudioContext {
  state: AudioContextState = "running";
  currentTime = 100;
  destination = {};
  oscillators: FakeOscillator[] = [];
  resumeCalls = 0;
  constructor() {
    contexts.push(this);
  }
  createOscillator() {
    const o = new FakeOscillator();
    this.oscillators.push(o);
    return o;
  }
  createGain() {
    return new FakeGain();
  }
  resume() {
    this.resumeCalls += 1;
    this.state = "running";
    return Promise.resolve();
  }
}

const store = new Map<string, string>();
const fakeStorage: Storage = {
  getItem: (k) => store.get(k) ?? null,
  setItem: (k, v) => {
    store.set(k, v);
  },
  removeItem: (k) => {
    store.delete(k);
  },
  clear: () => store.clear(),
  key: (i) => [...store.keys()][i] ?? null,
  get length() {
    return store.size;
  },
};

const previousWindow = (globalThis as Record<string, unknown>).window;
const previousStorage = (globalThis as Record<string, unknown>).localStorage;

beforeAll(() => {
  (globalThis as Record<string, unknown>).window = {
    AudioContext: FakeAudioContext,
  };
  (globalThis as Record<string, unknown>).localStorage = fakeStorage;
});

afterAll(() => {
  if (previousWindow === undefined) {
    delete (globalThis as Record<string, unknown>).window;
  } else {
    (globalThis as Record<string, unknown>).window = previousWindow;
  }
  if (previousStorage === undefined) {
    delete (globalThis as Record<string, unknown>).localStorage;
  } else {
    (globalThis as Record<string, unknown>).localStorage = previousStorage;
  }
});

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

describe("quiz-sounds — préférence sonore", () => {
  test("le son est activé par défaut (aucune préférence stockée)", () => {
    store.clear();
    expect(isQuizSoundEnabled()).toBe(true);
  });

  test("setQuizSoundEnabled(false) persiste le mute", () => {
    store.clear();
    setQuizSoundEnabled(false);
    expect(isQuizSoundEnabled()).toBe(false);
  });

  test("setQuizSoundEnabled(true) réactive le son", () => {
    store.clear();
    setQuizSoundEnabled(false);
    setQuizSoundEnabled(true);
    expect(isQuizSoundEnabled()).toBe(true);
  });

  test("mute : aucun nœud audio n'est créé tant que le son est coupé", () => {
    store.clear();
    setQuizSoundEnabled(false);
    const before = contexts.length;
    playCorrectSound();
    playWrongSound();
    expect(contexts.length).toBe(before);
  });
});

describe("quiz-sounds — synthèse des sons", () => {
  test("bonne réponse : 2 notes ascendantes, durée totale < 1 s", () => {
    store.clear();
    setQuizSoundEnabled(true);
    const before = contexts.length;
    playCorrectSound();
    const c = contexts[contexts.length - 1];
    expect(contexts.length).toBe(before + 1);
    expect(c.oscillators).toHaveLength(2);
    // Ascendant et positif : Do5 (523,25 Hz) puis Sol5 (783,99 Hz).
    expect(c.oscillators[0].freq).toBe(523.25);
    expect(c.oscillators[1].freq).toBe(783.99);
    expect(c.oscillators[1].freq).toBeGreaterThan(c.oscillators[0].freq);
    // Chaque note dure moins d'une seconde.
    for (const o of c.oscillators) {
      expect(o.stopT - o.startT).toBeLessThan(1);
    }
  });

  test("mauvaise réponse : 2 notes graves douces, durée totale < 1 s", () => {
    store.clear();
    setQuizSoundEnabled(true);
    playWrongSound();
    const c = contexts[contexts.length - 1];
    const last = c.oscillators.slice(-2);
    expect(last).toHaveLength(2);
    // Grave et neutre : Mi4 (329,63 Hz) puis Ré4 (293,66 Hz).
    expect(last[0].freq).toBe(329.63);
    expect(last[1].freq).toBe(293.66);
    expect(last[1].freq).toBeLessThan(last[0].freq);
    for (const o of last) {
      expect(o.stopT - o.startT).toBeLessThan(1);
    }
  });

  test("les sons ne bloquent pas : un AudioContext existant est réutilisé", () => {
    store.clear();
    setQuizSoundEnabled(true);
    // Garantit qu'un contexte existe déjà (créé par un test précédent).
    if (contexts.length === 0) playCorrectSound();
    const before = contexts.length;
    playCorrectSound();
    playWrongSound();
    playCorrectSound();
    // Aucun nouveau contexte : le même est réutilisé pour toutes les lectures.
    expect(contexts.length).toBe(before);
  });

  test("AudioContext suspendu (Safari iOS) : resume() est appelé", () => {
    store.clear();
    setQuizSoundEnabled(true);
    playCorrectSound();
    const c = contexts[contexts.length - 1];
    c.state = "suspended";
    const resumeBefore = c.resumeCalls;
    playCorrectSound();
    expect(c.resumeCalls).toBeGreaterThan(resumeBefore);
    expect(c.state === ("running" as AudioContextState)).toBe(true);
  });
});
