/**
 * Tests de sécurité — notation des quiz CÔTÉ SERVEUR.
 *
 * Le client envoie `isCorrect` dans saveQuizResult : ce champ est ignoré et
 * le serveur recalcule la justesse (comparaison texte, insensible à la
 * casse, identique à l'interface). Un utilisateur ne peut donc pas fausser
 * son score ni sa progression en se marquant toutes les réponses correctes.
 */
import { describe, expect, test } from "bun:test";

import * as quizzes from "@/convex/quizzes";

import {
  call,
  makeDb,
  makeMutationCtx,
  setCurrentUser,
  uid,
} from "../helpers/mock-convex";

function seedQuiz(db: ReturnType<typeof makeDb>, owner: string) {
  db.seed("quizzes", [
    {
      _id: "quizzes-1",
      userId: owner,
      subject: "Maths",
      level: "seconde",
      title: "Quiz",
      settings: { count: 2, difficulty: "easy", types: ["qcm"] },
      questions: [
        {
          type: "qcm",
          question: "2 + 2 ?",
          options: ["3", "4", "5"],
          answer: "4",
          explanation: "",
          topic: "additions",
        },
        {
          type: "qcm",
          question: "Capitale de la France ?",
          options: ["Paris", "Londres"],
          answer: "Paris",
          explanation: "",
          topic: "géo",
        },
      ],
      status: "pending",
      createdAt: 1,
    },
  ]);
}

describe("saveQuizResult — score calculé côté serveur (anti-triche)", () => {
  test("le client ne peut pas se marquer une réponse FAUSSE comme correcte", async () => {
    setCurrentUser(uid(1));
    const db = makeDb();
    seedQuiz(db, uid(1));
    const res = await call<{ score: number; total: number }>(
      quizzes.saveQuizResult,
      makeMutationCtx(db) as never,
      {
        quizId: "quizzes-1",
        answers: [
          { questionIndex: 0, selected: "3", isCorrect: true }, // ment : 3 ≠ 4
        ],
        durationSeconds: 10,
      } as never,
    );
    expect(res?.score).toBe(0); // recalculé : 0 bonne réponse
    const stored = db.raw("quiz_answers")[0] as unknown as { isCorrect: boolean };
    expect(stored.isCorrect).toBe(false);
  });

  test("le client ne peut pas se marquer une réponse CORRECTE comme fausse", async () => {
    setCurrentUser(uid(1));
    const db = makeDb();
    seedQuiz(db, uid(1));
    const res = await call<{ score: number }>(
      quizzes.saveQuizResult,
      makeMutationCtx(db) as never,
      {
        quizId: "quizzes-1",
        answers: [
          { questionIndex: 0, selected: "4", isCorrect: false }, // prétend faux
        ],
        durationSeconds: 10,
      } as never,
    );
    expect(res?.score).toBe(1); // le serveur voit la bonne réponse
  });

  test("comparaison insensible à la casse et aux espaces (comme l'interface)", async () => {
    setCurrentUser(uid(1));
    const db = makeDb();
    seedQuiz(db, uid(1));
    const res = await call<{ score: number }>(
      quizzes.saveQuizResult,
      makeMutationCtx(db) as never,
      {
        quizId: "quizzes-1",
        answers: [
          { questionIndex: 1, selected: "  paris ", isCorrect: false },
        ],
        durationSeconds: 10,
      } as never,
    );
    expect(res?.score).toBe(1);
  });

  test("les réponses au-delà du nombre de questions du quiz sont ignorées", async () => {
    setCurrentUser(uid(1));
    const db = makeDb();
    seedQuiz(db, uid(1));
    const res = await call<{ score: number; total: number }>(
      quizzes.saveQuizResult,
      makeMutationCtx(db) as never,
      {
        quizId: "quizzes-1",
        answers: [
          { questionIndex: 0, selected: "4", isCorrect: true },
          { questionIndex: 1, selected: "Paris", isCorrect: true },
          { questionIndex: 2, selected: "x", isCorrect: true }, // n'existe pas
          { questionIndex: 99, selected: "y", isCorrect: true },
        ],
        durationSeconds: 10,
      } as never,
    );
    expect(res?.total).toBe(2);
    expect(res?.score).toBe(2); // seules les 2 vraies questions comptent
    expect(db.raw("quiz_answers")).toHaveLength(2);
  });
});
