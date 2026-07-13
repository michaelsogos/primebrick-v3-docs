import type { ZudokuConfig } from "zudoku";
import { generatedRepoNav } from "./src/generated-nav";
import "./src/styles.css";

const config: ZudokuConfig = {
  site: {
    title: "Primebrick Docs",
    logo: {
      src: { light: "/logo-light.svg", dark: "/logo-dark.svg" },
      alt: "Primebrick",
      width: "140px",
      href: "/",
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
            { label: "API Explorer", href: "/api" },
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
      { label: "Primebrick.dev", to: "https://primebrick.dev", target: "_blank" },
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
          label: "Try the API",
          to: "/api",
          icon: "play",
        },
      ],
    },
    ...generatedRepoNav,
    {
      type: "link",
      to: "/api",
      label: "API Explorer",
      icon: "play",
    },
  ],
  redirects: [
    { from: "/", to: "/getting-started/introduction" },
  ],
  apis: [
    {
      type: "url",
      input: "http://localhost:3001/api/v1/openapi/aggregated.json",
      path: "/api",
      options: {
        disableSecurity: false,
        expandAllTags: true,
        showInfoPage: true,
        examplesLanguage: "js",
        schemaDownload: {
          enabled: true,
          fileName: "primebrick-openapi",
        },
      },
    },
  ],
};

export default config;
