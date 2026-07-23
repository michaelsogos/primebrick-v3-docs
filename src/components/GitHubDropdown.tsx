import { useState, useRef, useEffect } from "react";

interface Repo {
  label: string;
  href: string;
  isOrg?: boolean;
}

const repos: Repo[] = [
  { label: "Primebrick Organization", href: "https://github.com/michaelsogos", isOrg: true },
  { label: "Backend", href: "https://github.com/michaelsogos/primebrick-v3-backend" },
  { label: "Frontend", href: "https://github.com/michaelsogos/primebrick-v3-frontend" },
  { label: "Microservices", href: "https://github.com/michaelsogos/primebrick-v3-microservices" },
  { label: "DAL", href: "https://github.com/michaelsogos/primebrick-v3-dal" },
  { label: "SDK", href: "https://github.com/michaelsogos/primebrick-v3-sdk" },
  { label: "Website", href: "https://github.com/michaelsogos/primebrick-v3-website" },
  { label: "Docs", href: "https://github.com/michaelsogos/primebrick-v3-docs" },
];

const GithubIcon = () => (
  <svg width="1rem" height="1rem" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0016 8c0-4.42-3.58-8-8-8z" />
  </svg>
);

const RepoIcon = () => (
  <svg width="0.875rem" height="0.875rem" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 010-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8zM5 12.25v3.25a.25.25 0 00.4.2l1.45-1.087a.25.25 0 01.3 0L8.6 15.7a.25.25 0 00.4-.2v-3.25a.25.25 0 00-.25-.25h-3.5a.25.25 0 00-.25.25z" />
  </svg>
);

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    width="0.75rem"
    height="0.75rem"
    viewBox="0 0 12 12"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden="true"
    style={{ transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "none" }}
  >
    <path d="M3 4.5L6 7.5L9 4.5" />
  </svg>
);

export default function GitHubDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label="GitHub repositories"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.5rem",
          fontSize: "0.875rem",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "0.25rem 0.5rem",
          borderRadius: "0.375rem",
          color: "inherit",
          transition: "color 0.2s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--primary, #0ea5e9)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "inherit")}
      >
        <GithubIcon />
        <span>GitHub</span>
        <ChevronIcon open={open} />
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: "0.5rem",
            minWidth: "14rem",
            borderRadius: "0.5rem",
            border: "1px solid var(--border, #e5e7eb)",
            background: "var(--card, #ffffff)",
            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.15)",
            padding: "0.375rem",
            zIndex: 100,
          }}
        >
          {repos.map((repo) => (
            <a
              key={repo.href}
              href={repo.href}
              target="_blank"
              rel="noopener"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.5rem 0.625rem",
                fontSize: "0.8125rem",
                textDecoration: "none",
                borderRadius: "0.375rem",
                color: "var(--foreground, #1f2937)",
                transition: "background 0.15s, color 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--accent, #0ea5e9)";
                e.currentTarget.style.color = "var(--accent-foreground, #ffffff)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--foreground, #1f2937)";
              }}
            >
              {repo.isOrg ? <GithubIcon /> : <RepoIcon />}
              {repo.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
