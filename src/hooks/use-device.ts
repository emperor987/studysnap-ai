import { useState } from "react";

/**
 * Détection du type d'appareil côté client (mobile vs desktop).
 *
 * L'écran Scanner affiche une interface différente selon l'appareil :
 * - mobile : caméra en direct + import galerie ;
 * - desktop : simple dépôt de fichier (drag & drop).
 *
 * La détection combine le user agent, les capacités tactiles et la
 * disponibilité de l'API média (navigator.mediaDevices), conformément au
 * cahier des charges. `detectDevice` accepte un environnement simulé pour
 * être testable en unitaire (bun, sans DOM).
 */

export interface DeviceInfo {
  /** true si l'utilisateur est sur un téléphone ou une tablette. */
  isMobile: boolean;
  /** true si l'appareil est un iPhone / iPad / iPod (Safari iOS). */
  isIOS: boolean;
}

export interface DetectEnv {
  userAgent?: string;
  maxTouchPoints?: number;
  hasMediaDevices?: boolean;
  innerWidth?: number;
  userAgentDataMobile?: boolean;
}

export function detectDevice(env: DetectEnv = {}): DeviceInfo {
  const ua =
    env.userAgent ??
    (typeof navigator !== "undefined" ? navigator.userAgent : "");
  const touch =
    env.maxTouchPoints ??
    (typeof navigator !== "undefined" ? navigator.maxTouchPoints : 0);
  const hasMedia =
    env.hasMediaDevices ??
    (typeof navigator !== "undefined" && "mediaDevices" in navigator);
  const width =
    env.innerWidth ??
    (typeof window !== "undefined" ? window.innerWidth : 1280);
  const uadMobile =
    env.userAgentDataMobile ??
    (typeof navigator !== "undefined"
      ? (navigator as Navigator & { userAgentData?: { mobile?: boolean } })
          .userAgentData?.mobile ?? false
      : false);

  const isIOS =
    /iPhone|iPad|iPod/i.test(ua) ||
    // iPadOS ≥ 13 se présente comme un Mac : seul le tactile permet de le
    // distinguer d'un MacBook.
    (/Macintosh/i.test(ua) && touch > 1);

  const isMobile =
    Boolean(uadMobile) ||
    /Android|iPhone|iPod|iPad|Windows Phone|IEMobile|Opera Mini|Mobile/i.test(
      ua,
    ) ||
    // Appareil tactile non détecté par l'UA : petit écran + API caméra
    // disponible = on propose l'interface mobile (tablette/téléphone).
    (touch > 1 && hasMedia && width <= 1024);

  return { isMobile, isIOS };
}

export function useDevice(): DeviceInfo {
  // Calculée une seule fois : le type d'appareil ne change pas en cours de
  // session (pas de re-render inutile ni de bascule d'UI en plein flux).
  const [device] = useState<DeviceInfo>(detectDevice);
  return device;
}
