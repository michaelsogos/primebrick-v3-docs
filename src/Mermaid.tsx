import { useEffect, useRef, useState, type ReactNode } from "react";
import mermaid from "mermaid";

mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  securityLevel: "loose",
  fontFamily: "inherit",
});

let idCounter = 0;

export default function Mermaid({ children }: { children?: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const code =
    typeof children === "string"
      ? children
      : Array.isArray(children)
        ? children.join("")
        : "";

  useEffect(() => {
    if (!code.trim()) return;

    const id = `mermaid-${++idCounter}`;

    mermaid
      .render(id, code)
      .then(({ svg: rendered }) => {
        setSvg(rendered);
        setError(null);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      });
  }, [code]);

  if (error) {
    return (
      <pre
        style={{
          whiteSpace: "pre-wrap",
          color: "#ef4444",
          padding: "1rem",
          border: "1px solid #ef4444",
          borderRadius: "0.5rem",
          overflowX: "auto",
        }}
      >
        Mermaid error: {error}
        {"\n\n"}
        {code}
      </pre>
    );
  }

  return (
    <div
      ref={containerRef}
      className="mermaid-container"
      style={{ textAlign: "center", overflowX: "auto" }}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: mermaid output is sanitized by the library
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
    />
  );
}
