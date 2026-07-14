import type { ZudokuConfig } from "zudoku";
import { Mermaid } from "zudoku/mermaid";
import { serviceNav, libraryNav } from "./src/generated-nav";
import { generatedApis } from "./src/generated-apis";
import "./src/styles.css";

const config: ZudokuConfig = {
  site: {
    title: "Primebrick Docs",
    logo: {
      src: { light: "/logo-light.svg", dark: "/logo-dark.svg" },
      alt: "Primebrick",
      width: "120px",
      href: "https://primebrick.dev",
    },
    sidebar: {
      collapsible: true,
      toggleVisibility: "hover",
      togglePosition: "center",
    },
    footer: {
      position: "center",
      columns: [
        {
          title: "Resources",
          links: [
            { label: "Landing Page", href: "https://primebrick.dev" },
            { label: "API Catalog", href: "/catalog" },
            { label: "GitHub", href: "https://github.com/michaelsogos" },
          ],
        },
      ],
      social: [
        { icon: "github", href: "https://github.com/michaelsogos" },
      ],
      copyright: `© ${new Date().getFullYear()} Primebrick. MIT License.`,
      logo: {
        src: { light: "/logo-light.svg", dark: "/logo-dark.svg" },
        alt: "Primebrick",
        width: "120px",
      },
    },
  },
  theme: {
    light: {
      background: "#ffffff",
      foreground: "#1f2937",
      card: "#ffffff",
      cardForeground: "#0f172a",
      popover: "#ffffff",
      popoverForeground: "#0f172a",
      primary: "#0ea5e9",
      primaryForeground: "#ffffff",
      secondary: "#f8fafc",
      secondaryForeground: "#0f172a",
      muted: "#f8fafc",
      mutedForeground: "#6b7280",
      accent: "#0ea5e9",
      accentForeground: "#ffffff",
      destructive: "#ef4444",
      destructiveForeground: "#ffffff",
      border: "#e5e7eb",
      input: "#e5e7eb",
      ring: "#0ea5e9",
      radius: "0.5rem",
    },
    dark: {
      background: "#020617",
      foreground: "#cbd5e1",
      card: "#0f172a",
      cardForeground: "#f8fafc",
      popover: "#0f172a",
      popoverForeground: "#f8fafc",
      primary: "#38bdf8",
      primaryForeground: "#0c4a6e",
      secondary: "#1e293b",
      secondaryForeground: "#f8fafc",
      muted: "#1e293b",
      mutedForeground: "#94a3b8",
      accent: "#38bdf8",
      accentForeground: "#0c4a6e",
      destructive: "#ef4444",
      destructiveForeground: "#ffffff",
      border: "#1e293b",
      input: "#1e293b",
      ring: "#38bdf8",
      radius: "0.5rem",
    },
  },
  header: {
    themeSwitcher: {
      enabled: true,
    },
    navigation: [
      { label: "Docs", to: "https://primebrick.dev", target: "_blank" },
      { label: "Contact", to: "https://primebrick.dev/en/contact", target: "_blank" },
      { label: "MIT License", to: "https://opensource.org/license/MIT", target: "_blank" },
      { label: "GitHub", to: "https://github.com/michaelsogos", target: "_blank" },
    ],
    placements: {
      navigation: "end",
      auth: "end",
    },
  },
  navigation: [
    {
      type: "category",
      label: "Documentation",
      icon: "book-open",
      items: [
        { type: "filter", placeholder: "Filter documentation..." },
        {
          type: "category",
          label: "Getting Started",
          icon: "sparkles",
          items: [
            "getting-started/introduction",
            "getting-started/quick-start",
            "getting-started/architecture",
            "getting-started/infrastructure",
          ],
        },
        { type: "separator" },
        {
          type: "category",
          label: "API Reference",
          icon: "code",
          items: [
            "api/introduction",
            "api/authentication",
            "api/authentication-how-to",
            "api/rbac",
            "api/microservice-standard",
            "api/error-handling",
          ],
        },
        { type: "separator" },
        {
          type: "link",
          label: "API Catalog",
          to: "/catalog",
          icon: "square-library",
        },
      ],
    },
    {
      type: "category",
      label: "Services",
      icon: "layers",
      stack: true,
      items: [
        ...serviceNav,
      ],
    },
    {
      type: "category",
      label: "Libraries",
      icon: "library",
      stack: true,
      items: [
        ...libraryNav,
      ],
    },
    {
      type: "link",
      to: "/catalog",
      label: "API Catalog",
      icon: "square-library",
    },
  ],
  redirects: [
    { from: "/", to: "/getting-started/introduction" },
  ],
  catalogs: {
    path: "/catalog",
    label: "API Catalog",
  },
  mdx: {
    components: {
      Mermaid,
    },
  },
  syntaxHighlighting: {
    languages: [
      "php",
      "python",
      "bash",
      "json",
      "typescript",
      "javascript",
      "sql",
      "svelte",
      "dotenv",
    ],
  },
  apis: generatedApis,
};

export default config;
