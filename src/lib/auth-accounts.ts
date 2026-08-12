/**
 * Logique d'affichage de l'écran « Choisir ton compte » (src/pages/Auth.tsx).
 * Séparée du composant pour être testable en unitaire.
 */

export interface AuthAccountInfo {
  userId: string;
  name: string | null;
  email: string | null;
  isAnonymous: boolean;
  providers: string[];
}

/** Libellé français du provider de connexion d'un compte. */
export function accountProviderLabel(provider: string): string {
  switch (provider) {
    case "password":
      return "Mot de passe";
    case "email-otp":
      return "Code par email";
    case "anonymous":
      return "Invité";
    case "vly-convex":
      return "Freebuff";
    default:
      return provider;
  }
}

/** Initiales d'avatar d'un compte (nom → partie locale de l'email → « ? »). */
export function accountAvatarLabel(account: {
  name?: string | null;
  email?: string | null;
}): string {
  const name = account.name?.trim();
  if (name) {
    const parts = name.split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  const local = account.email?.split("@")[0] ?? "";
  return local ? local.slice(0, 2).toUpperCase() : "?";
}

/** Nom d'affichage d'un compte (prénom → partie locale de l'email → défaut). */
export function accountDisplayName(account: {
  name?: string | null;
  email?: string | null;
}): string {
  if (account.name && account.name.trim()) return account.name.trim();
  const local = account.email?.split("@")[0]?.trim();
  if (local) return `Compte ${local}`;
  return "Compte StudySnap";
}
