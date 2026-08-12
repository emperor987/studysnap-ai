/**
 * Tests de sécurité — XSS via le rendu Markdown des contenus IA.
 *
 * Les réponses IA (texte OCR d'un devoir = contenu potentiellement hostile,
 * injection de prompt) sont rendues par react-markdown SANS rehype-raw : le
 * HTML brut est échappé. On vérifie par rendu serveur réel que les payloads
 * classiques ne produisent JAMAIS de balise exécutable dans le HTML final.
 */
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import { stripHtmlArtifacts } from "@/lib/clean";

function render(payload: string): string {
  return renderToStaticMarkup(<ReactMarkdown>{payload}</ReactMarkdown>);
}

describe("XSS — les payloads Markdown ne produisent pas de code exécutable", () => {
  test("<script> est échappé (jamais de balise script)", () => {
    const html = render("<script>alert(1)</script>");
    expect(html).not.toContain("<script");
  });

  test("les attributs onerror sont inoffensifs", () => {
    const html = render('<img src=x onerror="alert(1)">');
    // Aucune vraie balise <img> ni attribut exécutable : le HTML brut est
    // échappé en texte inerte — le payload n'apparaît QUE sous forme échappée.
    expect(html).not.toMatch(/<img[\s/>]/i);
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  test("les liens javascript: sont neutralisés", () => {
    const html = render("[clique](javascript:alert(1))");
    expect(html).not.toContain("javascript:");
  });

  test("les liens data:text/html sont neutralisés", () => {
    const html = render("[x](data:text/html,<script>alert(1)</script>)");
    expect(html).not.toContain("data:text/html");
  });

  test("les balises iframe/object/embed ne sont pas rendues", () => {
    const html = render("<iframe src=https://evil.example></iframe>");
    expect(html).not.toMatch(/<iframe/i);
  });

  test("stripHtmlArtifacts + rendu : double défense pour les artefacts IA", () => {
    const payload = stripHtmlArtifacts(
      '<div style="background:url(javascript:alert(1))">Bonjour</div>',
    );
    expect(payload).toBe("Bonjour");
    const html = render(payload);
    expect(html).not.toContain("<div");
    expect(html).not.toContain("javascript:");
  });

  test("le contenu légitime (LaTeX, listes) reste rendu correctement", () => {
    const html = render("$x = \\frac{-b}{2a}$\n\n- un point\n- deux points");
    expect(html).toContain("un point");
    expect(html).toContain("deux points");
  });
});
