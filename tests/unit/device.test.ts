/**
 * Tests unitaires — détection du type d'appareil (mobile vs desktop).
 *
 * L'écran Scanner affiche une interface différente selon l'appareil :
 * mobile = caméra en direct + import galerie, desktop = dépôt de fichier.
 * La détection combine user agent, capacités tactiles, largeur d'écran et
 * API média ; elle doit rester fiable sur iPhone (Safari iOS), Android
 * (Chrome) et iPadOS (qui se présente comme un Mac).
 */
import { describe, expect, test } from "bun:test";
import { detectDevice } from "@/hooks/use-device";

describe("detectDevice — détection du type d'appareil", () => {
  test("iPhone (Safari iOS) → mobile + iOS", () => {
    const d = detectDevice({
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    });
    expect(d.isMobile).toBe(true);
    expect(d.isIOS).toBe(true);
  });

  test("Android (Chrome mobile) → mobile, pas iOS", () => {
    const d = detectDevice({
      userAgent:
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
    });
    expect(d.isMobile).toBe(true);
    expect(d.isIOS).toBe(false);
  });

  test("iPadOS 13+ (Macintosh + tactile + API média) → mobile + iOS", () => {
    const d = detectDevice({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
      maxTouchPoints: 5,
      hasMediaDevices: true,
      innerWidth: 834,
    });
    expect(d.isMobile).toBe(true);
    expect(d.isIOS).toBe(true);
  });

  test("desktop Windows (Chrome) → desktop", () => {
    const d = detectDevice({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      maxTouchPoints: 0,
      hasMediaDevices: true,
    });
    expect(d.isMobile).toBe(false);
    expect(d.isIOS).toBe(false);
  });

  test("MacBook (Macintosh sans tactile) → desktop, pas iOS", () => {
    const d = detectDevice({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
      maxTouchPoints: 0,
      hasMediaDevices: true,
    });
    expect(d.isMobile).toBe(false);
    expect(d.isIOS).toBe(false);
  });

  test("userAgentData mobile (Chrome Android récent) → mobile", () => {
    const d = detectDevice({
      userAgent:
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      userAgentDataMobile: true,
    });
    expect(d.isMobile).toBe(true);
  });

  test("tablette tactile avec caméra et petit écran → mobile", () => {
    const d = detectDevice({
      userAgent: "Mozilla/5.0 (X11; Linux x86_64) Chrome/126.0.0.0",
      maxTouchPoints: 10,
      hasMediaDevices: true,
      innerWidth: 800,
    });
    expect(d.isMobile).toBe(true);
  });

  test("écran tactile large (> 1024 px) → desktop malgré le tactile", () => {
    const d = detectDevice({
      userAgent: "Mozilla/5.0 (X11; Linux x86_64) Chrome/126.0.0.0",
      maxTouchPoints: 10,
      hasMediaDevices: true,
      innerWidth: 1440,
    });
    expect(d.isMobile).toBe(false);
  });
});
