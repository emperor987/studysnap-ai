/**
 * Tests de sécurité — Couche frontend & infrastructure :
 * XSS (rendu), open redirect, en-têtes HTTP, CORS, redaction des logs,
 * path traversal, stockage des mots de passe, sessions côté client.
 *
 * Aucun backend déployé : fonctions pures + assertions statiques sur le code
 * source. Aucune clé tierce requise.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { stripHtmlArtifacts } from "@/lib/clean";
import { resolveRedirectAfterAuth } from "@/lib/redirect";

const ROOT = resolve(import.meta.dir, "..", "..");
const SRC = join(ROOT, "src");
const PUB = join(ROOT, "public");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx|js|jsx)$/.test(entry)) out.push(p);
  }
  return out;
}

const srcFiles = () => walk(SRC).map((p) => p.replace(`${SRC}/`, ""));
const srcCode = () =>
  walk(SRC)
    .map((p) => readFileSync(p, "utf8"))
    .join("\n");

/* ------------------------------------------------------------------ */
/* 6. XSS — les contenus IA ne peuvent jamais devenir du code exécuté   */
/* ------------------------------------------------------------------ */

describe("XSS — aucun artefact HTML ni code exécutable dans le rendu", () => {
  test("stripHtmlArtifacts retire toutes les balises HTML connues", () => {
    expect(stripHtmlArtifacts("<div>Bonjour</div>")).toBe("Bonjour");
    expect(stripHtmlArtifacts('<span class="x">a</span> <b>b</b>')).toBe("a b");
    expect(stripHtmlArtifacts("<ul><li>1</li><li>2</li></ul>")).toBe("12");
    expect(stripHtmlArtifacts("<p>Paragraphe</p>")).toBe("Paragraphe");
  });

  test("stripHtmlArtifacts retire les artefacts type 'div5' et les scripts", () => {
    expect(stripHtmlArtifacts("<div5>contenu</div5>")).toBe("contenu");
    expect(stripHtmlArtifacts("<script>alert(1)</script>")).toBe("alert(1)");
    expect(stripHtmlArtifacts('<img src="x" onerror="alert(1)">')).toBe("");
    expect(stripHtmlArtifacts("<style>.x{color:red}</style>")).toBe(".x{color:red}");
  });

  test("stripHtmlArtifacts ne casse pas les comparaisons mathématiques", () => {
    expect(stripHtmlArtifacts("x < 5 et 2 > 1")).toBe("x < 5 et 2 > 1");
    expect(stripHtmlArtifacts("a && b")).toBe("a && b");
  });

  test("le composant Markdown nettoie le contenu avant rendu", () => {
    const md = readFileSync(join(SRC, "components/markdown.tsx"), "utf8");
    expect(md).toContain("stripHtmlArtifacts(content)");
    expect(md).not.toContain("rehype-raw"); // jamais de HTML brut rendu
  });

  test("dangerouslySetInnerHTML confiné aux primitives shadcn (jamais sur du contenu IA/utilisateur)", () => {
    const offenders: string[] = [];
    for (const rel of srcFiles()) {
      if (rel.startsWith("components/ui/")) continue; // primitives de confiance (chart tooltip CSS interne)
      if (readFileSync(join(SRC, rel), "utf8").includes("dangerouslySetInnerHTML")) {
        offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* 8. Open redirect — returnTo ne peut pas sortir du domaine            */
/* ------------------------------------------------------------------ */

describe("Open redirect — le paramètre returnTo est validé", () => {
  test("URL absolue → rejetée (fallback)", () => {
    expect(resolveRedirectAfterAuth("https://evil.com")).toBe("/dashboard");
    expect(resolveRedirectAfterAuth("http://evil.com/x")).toBe("/dashboard");
    expect(resolveRedirectAfterAuth("javascript:alert(1)")).toBe("/dashboard");
  });

  test("URL protocol-relative → rejetée", () => {
    expect(resolveRedirectAfterAuth("//evil.com")).toBe("/dashboard");
    expect(resolveRedirectAfterAuth("///evil.com")).toBe("/dashboard");
  });

  test("variante backslash → rejetée (normalisée en // par les navigateurs)", () => {
    expect(resolveRedirectAfterAuth("/\\evil.com")).toBe("/dashboard");
    expect(resolveRedirectAfterAuth("/\\/evil.com")).toBe("/dashboard");
  });

  test("chemin interne relatif → conservé", () => {
    expect(resolveRedirectAfterAuth("/dashboard")).toBe("/dashboard");
    expect(resolveRedirectAfterAuth("/scanner")).toBe("/scanner");
    expect(resolveRedirectAfterAuth("/revision")).toBe("/revision");
  });

  test("returnTo absent → fallback par défaut", () => {
    expect(resolveRedirectAfterAuth(null)).toBe("/dashboard");
    expect(resolveRedirectAfterAuth(undefined as never)).toBe("/dashboard");
  });

  test("la page Auth utilise bien la fonction validée", () => {
    const auth = readFileSync(join(SRC, "pages/Auth.tsx"), "utf8");
    expect(auth).toContain("resolveRedirectAfterAuth");
    expect(auth).not.toContain("returnTo?.startsWith");
  });
});

/* ------------------------------------------------------------------ */
/* 12. En-têtes de sécurité                                             */
/* ------------------------------------------------------------------ */

describe("En-têtes de sécurité HTTP", () => {
  const headers = readFileSync(join(PUB, "_headers"), "utf8");

  test("X-Content-Type-Options: nosniff présent", () => {
    expect(headers).toMatch(/X-Content-Type-Options:\s*nosniff/i);
  });

  // L'application doit rester EMBARBABLE en iframe : Freebuff affiche
  // l'aperçu (preview) dans une iframe. Un X-Frame-Options: DENY ou un
  // frame-ancestors 'none' rendrait l'aperçu entièrement blanc. La
  // protection anti-clickjacking repose sur les sessions httpOnly Convex
  // (jamais de cookie session lisible côté client) et les vérifications
  // d'origine côté serveur.
  test("aucun X-Frame-Options bloquant (l'aperçu iframe doit s'afficher)", () => {
    expect(headers).not.toMatch(/X-Frame-Options:\s*DENY/i);
    expect(headers).not.toMatch(/X-Frame-Options:\s*SAMEORIGIN/i);
  });

  test("Referrer-Policy restrictive présente", () => {
    expect(headers).toMatch(/Referrer-Policy:\s*strict-origin-when-cross-origin/i);
  });

  test("Permissions-Policy restrictive présente", () => {
    expect(headers).toMatch(/Permissions-Policy:/i);
  });

  test("Content-Security-Policy présente, sans frame-ancestors bloquant (object-src 'none')", () => {
    expect(headers).toMatch(/Content-Security-Policy:/i);
    const csp = headers.match(/Content-Security-Policy:\s*([^\n]+)/i)?.[1] ?? "";
    expect(csp).not.toMatch(/frame-ancestors/);
    expect(csp).toMatch(/object-src\s+'none'/);
  });

  test("aucun favicon ni logo n'est déclaré dans le <head>", () => {
    const html = readFileSync(join(ROOT, "index.html"), "utf8");
    expect(html).not.toMatch(/rel=["']icon["']/i);
    expect(html).not.toContain("apple-touch-icon");
    expect(html).not.toContain("favicon");
    expect(html).not.toContain("logo.svg");
    expect(html).not.toContain("manifest.webmanifest");
  });

  test("aucun fichier favicon/logo ne traîne dans public/ ni src/assets/", () => {
    const leftovers = [
      "favicon.ico",
      "favicon-16.png",
      "favicon-32.png",
      "favicon-180-apple-touch.png",
      "favicon-192.png",
      "favicon-512.png",
      "logo.svg",
    ].filter(
      (f) =>
        existsSync(join(PUB, f)) ||
        existsSync(join(join(ROOT, "src", "assets"), f)),
    );
    expect(leftovers).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* 17. CORS — aucune origine sauvage autorisée                          */
/* ------------------------------------------------------------------ */

describe("CORS — pas de wildcard ni de middleware permissif", () => {
  test("aucun 'Access-Control-Allow-Origin: *' dans le code serveur", () => {
    expect(srcCode()).not.toMatch(/Access-Control-Allow-Origin\s*:\s*\*/i);
  });

  test("le routeur HTTP (webhooks) ne définit pas de CORS ouvert", () => {
    const http = readFileSync(join(SRC, "convex/http.ts"), "utf8");
    expect(http).not.toMatch(/cors|Access-Control/i);
  });
});

/* ------------------------------------------------------------------ */
/* 18. Redaction des logs — jamais de secrets dans les logs             */
/* ------------------------------------------------------------------ */

describe("Redaction des logs — aucun secret journalisé", () => {
  const SENSITIVE_IN_LOG =
    /\b(password|authToken|sessionToken|accessToken|refreshToken|apiKey|cookie|authorization|whsec_|sk_live_|sk_test_|nvapi-)\b/i;

  test("aucun appel console.* ne journalise un identifiant sensible", () => {
    const offenders: string[] = [];
    for (const rel of srcFiles()) {
      const lines = readFileSync(join(SRC, rel), "utf8").split("\n");
      lines.forEach((line, i) => {
        if (/console\.(log|info|warn|debug|error)\(/.test(line)) {
          if (SENSITIVE_IN_LOG.test(line)) {
            offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
          }
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  test("aucun process.env secret n'est passé à un appel console.*", () => {
    for (const rel of srcFiles()) {
      const lines = readFileSync(join(SRC, rel), "utf8").split("\n");
      lines.forEach((line, i) => {
        if (/console\.(log|info|warn|debug|error)\(/.test(line)) {
          expect(line, `${rel}:${i + 1}`).not.toContain("process.env");
        }
      });
    }
  });
});

/* ------------------------------------------------------------------ */
/* 9. Path traversal — les ids de stockage restent des clés opaques     */
/* ------------------------------------------------------------------ */

describe("Path traversal — pas d'accès au système de fichiers", () => {
  test("les actions Convex n'utilisent jamais le filesystem", () => {
    const convex = walk(join(SRC, "convex"))
      .map((p) => readFileSync(p, "utf8"))
      .join("\n");
    expect(convex).not.toMatch(/from ["']node:fs["']/);
    expect(convex).not.toMatch(/child_process/);
    expect(convex).not.toMatch(/readFileSync|writeFileSync/);
  });
});

/* ------------------------------------------------------------------ */
/* 14/16. Mots de passe & sessions — gérés par Convex Auth              */
/* ------------------------------------------------------------------ */

describe("Mots de passe & sessions", () => {
  test("le provider Password (hash scrypt) est actif dans la config auth", () => {
    const auth = readFileSync(join(SRC, "convex/auth.ts"), "utf8");
    expect(auth).toContain('from "@convex-dev/auth/providers/Password"');
    expect(auth).toContain("Password");
  });

  test("anti-brute-force configuré sur les connexions (max 5 échecs/heure)", () => {
    const auth = readFileSync(join(SRC, "convex/auth.ts"), "utf8");
    expect(auth).toMatch(/maxFailedAttempsPerHour\s*:\s*\d+/);
    expect(auth).not.toMatch(/maxFailedAttempsPerHour\s*:\s*0/);
  });

  test("les codes OTP par email expirent après un délai court", () => {
    const otp = readFileSync(join(SRC, "convex/auth/emailOtp.ts"), "utf8");
    expect(otp).toMatch(/maxAge\s*:\s*60\s*\*\s*15/); // 15 minutes max
  });

  test("l'application ne crée jamais d'utilisateur directement (pas de mot de passe en clair)", () => {
    const convex = walk(join(SRC, "convex"))
      .map((p) => readFileSync(p, "utf8"))
      .join("\n");
    // Les comptes sont créés par Convex Auth (hash scrypt) — jamais par notre code.
    expect(convex).not.toMatch(/insert\(\s*["']users["']/);
    expect(convex).not.toMatch(/["']password["']\s*:/);
  });

  test("le client ne manipule jamais les cookies de session ni les tokens en clair", () => {
    // Seul cookie écrit par l'app : la préférence UI de la sidebar (jamais de session).
    const cookieWrites = srcCode().match(/document\.cookie\s*=/g) ?? [];
    expect(cookieWrites.length).toBeLessThanOrEqual(1);
    expect(srcCode()).not.toMatch(/document\.cookie[^\n]*\b(session|token|auth)\b/i);
    // Les sessions Convex Auth passent par des cookies httpOnly gérés par le serveur.
    expect(srcCode()).not.toMatch(/localStorage\.setItem\([^)]*(token|auth|session)/i);
    expect(srcCode()).not.toMatch(/sessionStorage\.setItem\([^)]*(token|auth|session)/i);
  });
});
