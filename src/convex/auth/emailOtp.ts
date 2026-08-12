import { Email } from "@convex-dev/auth/providers/Email";
import axios from "axios";
import { RandomReader, generateRandomString } from "@oslojs/crypto/random";

/**
 * Clé d'envoi d'OTP par email — FOURNIE PAR L'ENVIRONNEMENT (UI Keys de la
 * plateforme), jamais codée en dur dans le code source. Sans clé, l'envoi
 * échoue proprement (message générique, aucun secret dans l'erreur).
 *
 * Lue à chaque envoi (pas capturée à l'import du module) pour rester
 * cohérente avec l'environnement courant (tests, rechargement de clé).
 */

export const emailOtp = Email({
  id: "email-otp",
  maxAge: 60 * 15, // 15 minutes
  // This function can be asynchronous
  async generateVerificationToken() {
    const random: RandomReader = {
      read(bytes: Uint8Array) {
        crypto.getRandomValues(bytes);
      },
    };
    const alphabet = "0123456789";
    return generateRandomString(random, alphabet, 6);
  },
  async sendVerificationRequest({ identifier: email, token }) {
    const apiKey = process.env.FREEBUFF_EMAIL_API_KEY;
    if (!apiKey) {
      // Ne JAMAIS renvoyer le token ni la clé dans le message d'erreur :
      // l'erreur peut être journalisée par Convex ou affichée au client.
      throw new Error("Le service d'envoi de codes n'est pas configuré.");
    }
    try {
      await axios.post(
        "https://auth.freebuff.app/send_otp",
        {
          to: email,
          otp: token,
          appName: process.env.VLY_APP_NAME || "a freebuff.com application",
        },
        {
          headers: {
            "x-api-key": apiKey,
          },
        },
      );
    } catch {
      // Message générique : ne pas sérialiser l'erreur axios (JSON.stringify
      // d'une AxiosError expose la config de la requête — clé API + OTP).
      throw new Error("Échec de l'envoi du code — réessaie dans un instant.");
    }
  },
});
