import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { stripHtmlArtifacts } from "@/lib/clean";

/**
 * Rendu Markdown + LaTeX des réponses IA (avec styles dédiés dans index.css).
 * Les contenus passent par un nettoyage défensif : si l'IA renvoie des
 * balises HTML/CSS brutes (ex: <div>, "div5"), elles sont retirées avant le
 * rendu — aucune balise ne peut s'afficher à l'écran.
 */
export function Markdown({ content }: { content: string }) {
  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
      >
        {stripHtmlArtifacts(content)}
      </ReactMarkdown>
    </div>
  );
}
