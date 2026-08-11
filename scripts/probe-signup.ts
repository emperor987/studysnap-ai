/**
 * Probe de diagnostic (jetable) : reproduit EXACTEMENT l'appel client de
 * l'écran Auth — client.authenticatedCall("auth:signIn", { provider, params })
 * sur un client NON authentifié (pas de setAuth avant l'appel), sur le
 * déploiement utilisé par la preview.
 */
import { ConvexReactClient } from "convex/react";

const url = "https://standing-sandpiper-465.convex.cloud";
const client = new ConvexReactClient(url);
const email = `probe-${Date.now()}@studysnap.test`;
const password = "Test1234!";

const act = (client as unknown as {
  action: (n: string, a: unknown) => Promise<unknown>;
});
const query = (client as unknown as {
  query: (n: string, a: unknown) => Promise<unknown>;
});

try {
  // SANS setAuth : même chemin que le premier signup côté client.
  const res = (await act.action("auth:signIn", {
    provider: "password",
    params: { flow: "signUp", email, password },
  })) as { tokens?: { token: string } };
  console.log("SIGNUP(unauthenticated) OK, token len:", res.tokens?.token.length);

  // Puis on pose le token (comme setToken côté client) et on vérifie la query.
  (client as unknown as {
    setAuth: (fn: () => Promise<string | null>) => void;
  }).setAuth(async () => res.tokens!.token);
  const user = await query.query("users:currentUser", {});
  console.log("currentUser OK:", JSON.stringify(user).slice(0, 150));
} catch (e) {
  console.log("TOP ERR:", e instanceof Error ? e.message : String(e));
  if (e instanceof Error && e.stack) console.log(e.stack.split("\n").slice(0, 5).join("\n"));
}
process.exit(0);
