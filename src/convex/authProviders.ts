import { query } from "./_generated/server";

/** Fournisseurs d'authentification actuellement disponibles. */
export const authProviders = query({
  args: {},
  handler: async () => ({
    google:
      Boolean(process.env.GOOGLE_CLIENT_ID) &&
      Boolean(process.env.GOOGLE_CLIENT_SECRET),
  }),
});
