# AI AGENT INSTRUCTIONS - Primebrick Docs (docs.primebrick.dev)

## ⚠️ CRITICAL: NEVER COMMIT AUTOMATICALLY

**AI agents MUST NEVER commit changes without explicit user instruction.**

- WAIT for the user to explicitly tell you to commit before running any `git commit` command
- This applies to ALL situations - no exceptions

## Repository overview

`primebrick-v3-docs` is the documentation and API explorer site for Primebrick,
deployed at `docs.primebrick.dev`. It is a Zudoku (React + Vite) site deployed to
Cloudflare Workers free plan via the experimental SSR adapter.

The site serves two purposes:
1. **Project documentation** — architecture docs, guides sourced from DeepWiki + in-repo `docs/` folders, served as MDX pages
2. **OpenAPI REPL / API explorer** — interactive API reference with live try-it, server selector, and auth, powered by Zudoku's built-in OpenAPI playground

**Tech stack**: Zudoku 0.82.x + React 19 + Vite 8 + Tailwind (via Zudoku)
**Deployment**: Cloudflare Workers (free plan) via `wrangler deploy` (static assets mode)
**Rendering**: Prerendered at build time (SSG). 0ms Worker CPU, free unlimited requests.

The landing page (`primebrick.dev`) is a SEPARATE project (`primebrick-v3-website`, Astro).
This repo only handles `docs.primebrick.dev`.

**Documentation language:** All `*.md` / `*.mdx` files must use **English**.

## Commands

| Action | Command |
|--------|---------|
| Install | `pnpm install` |
| Dev | `pnpm run dev` (Zudoku dev server, default port) |
| Build | `pnpm run build` (prerenders static HTML) |
| Preview (Worker) | `pnpm run preview` (wrangler dev, port 8787) |
| Deploy | `pnpm run deploy` (build + wrangler deploy) |
| Lint | `pnpm run lint` |

## Dev server

Zudoku dev server (`pnpm run dev`) runs on Zudoku's default port (check `zudoku dev --help`).
For Worker-local preview, use `pnpm run preview` which runs `wrangler dev` on port **8787**.

Before starting `wrangler dev`, check port 8787:
`netstat -ano | findstr "LISTENING" | findstr ":8787"`

Do NOT start a second `wrangler dev` instance. If one is already running, reuse it.

## Conventions

- **kebab-case** for all filenames
- **Zudoku config is the source of truth**: All navigation, theming, and API config lives in `zudoku.config.tsx`
- **MDX pages** live in `pages/` directory (file-based routing)
- **OpenAPI specs** live in `apis/` directory (build-time) or via URL (runtime)
- **No Node.js APIs in SSR code** — Workers runtime is V8 isolate, not Node.js. The `nodejs_compat` flag enables some Node APIs but not all.
- **Pinned package versions only** — NO ranges (`^`, `~`, `>=`, `*`, `latest`). See package-versioning rule.

## Deployment architecture

This project deploys as a **Cloudflare Worker** with static assets (NOT Pages — Pages is deprecated).

- `wrangler.jsonc` configures an assets-only Worker (no `main` script)
- `assets.directory: "./dist"` serves prerendered HTML + static assets (JS, CSS, images)
- `assets.not_found_handling: "404-page"` serves `404.html` for unmatched routes
- No `nodejs_compat` flag needed (no SSR, no Worker script)
- Build command: `zudoku build` (prerenders all routes to static HTML)
- Deploy command: `wrangler deploy`
- 0ms Worker CPU — all requests served as static assets (free, unlimited)

## Custom domain

The Worker should be bound to `docs.primebrick.dev` via Cloudflare dashboard
(Workers > Routes > Add custom domain). This is a manual step, not in code.

## Synced documentation

Synced MD/MDX files (DeepWiki, in-repo `docs/`) are written into `pages/` by
sync scripts that run in GitHub Actions CI (NOT on the Worker). These scripts
will be ported from `primebrick-v3-website/scripts/` and retargeted to write
into this repo's `pages/` directory.

- Files under `pages/*/deepwiki/` and `pages/*/manual/` are auto-generated.
  Do NOT hand-edit them — changes will be overwritten on next sync.
- Hand-written docs go in `pages/*/handwritten/` or directly in `pages/`.

## Package Versioning — FIXED versions only (MANDATORY)

All package versions in `package.json` MUST be pinned to exact versions (e.g.
`"zudoku": "0.82.3"`). NO ranges (`^`, `~`, `>=`, `*`, `latest`) are allowed
for registry packages.

## Further documentation

- [Zudoku docs](https://zudoku.dev/docs)
- [Zudoku GitHub](https://github.com/zuplo/zudoku)
- [Cloudflare Workers static assets](https://developers.cloudflare.com/workers/static-assets/)
- [cosmocargo example](https://github.com/zuplo/zudoku/tree/main/examples/cosmo-cargo) — production-grade reference config

## GitFlow rules

This repository follows GitFlow. AI agents MUST follow these rules.
Ensure you follow branch management, version tagging, and commit protocols.
