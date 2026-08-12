/**
 * Tokens de consentement parental — génération et hachage purs (node:crypto),
 * sans dépendance au backend : testables en unitaire.
 *
 * Le token brut (256 bits aléatoires) n'est JAMAIS stocké : seul son hash
 * SHA-256 est persisté, ce qui permet la comparaison au moment de la
 * confirmation sans exposer le lien (un token volé en base est inutilisable
 * pour un autre lien, et un hash fuit sans permettre de prédire le token).
 */
import { createHash, randomBytes } from "node:crypto";

/** Durée de validité d'un lien de confirmation (72 h). */
export const CONSENT_TTL_MS = 72 * 60 * 60 * 1000;

/** Hash SHA-256 d'un token (jamais le token brut en base). */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Token aléatoire 256 bits + hash + expiration. */
export function generateToken(): {
  token: string;
  hash: string;
  expiresAt: number;
} {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token), expiresAt: Date.now() + CONSENT_TTL_MS };
}
