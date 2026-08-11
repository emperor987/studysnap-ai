import { query } from "./_generated/server";
import { DEMO_SUBJECTS } from "./demoData";

/** Matières de référence StudySnap (sélecteurs, filtres…). */
export const listSubjects = query({
  args: {},
  handler: async () => DEMO_SUBJECTS,
});
