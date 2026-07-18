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
1. **Project documentation** — architecture docs, user-facing guides sourced from per-repo `docs/user-guide/` directories, served as MDX pages
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
| Full sync + build | `pnpm run build:full` (wraps the full chain below) |

## CI build chain (Cloudflare build agent on push to main)

The Cloudflare build agent build command is the single wrapped script:

```
pnpm run build:full
```

`build:full` is defined in `package.json` and runs the full chain below.
**Do NOT** paste the concatenated chain into the Cloudflare dashboard — keep the
build command as `pnpm run build:full` so the chain is maintained in
`package.json` (editable by dev/AI) rather than in the dashboard.

The chain executed by `build:full` is:

```
pnpm install
&& node scripts/sync-repo-docs.mjs
&& node scripts/sync-vpat-data.mjs
&& node scripts/fetch-openapi.mjs
&& node scripts/generate-nav.mjs
&& node scripts/generate-vpat-pdf.mjs
&& pnpm run build
```

1. **`sync-repo-docs.mjs`** — shallow-clones all 5 Primebrick repos, copies
   `docs/user-guide/**` → `pages/<repo>/guide/**` (recursive, preserves
   subdirectories like `services/`).
2. **`sync-vpat-data.mjs`** — copies `public/vpat/vpat-data.json` from the
   shallow-cloned FE repo (`.tmp-repo-sync/frontend/`) to `public/vpat/`.
   Skips gracefully if the FE repo doesn't have it yet.
3. **`fetch-openapi.mjs`** — extracts OpenAPI specs from the shallow-cloned
   repos: BE's `src/openapi/openapi.ts` → `apis/system.json` + `apis/mcp.json`,
   and each microservice's `src/server/openapi-route.ts` → `apis/<service>.json`.
   Also generates `src/generated-apis.ts` for Zudoku's API Catalog config.
4. **`generate-nav.mjs`** — reads `_order.json` from each `pages/<repo>/guide/`
   directory and generates `src/generated-nav.ts` with the sidebar navigation
   in logical reading order. Recurses into subdirectories (e.g. `services/`)
   and creates nested categories.
5. **`generate-vpat-pdf.mjs`** — generates `public/vpat/vpat-2.5.pdf` using
   pdfkit (pure Node.js, no browser). Reads `public/vpat/vpat-data.json`
   (synced in step 2) and produces a formal VPAT 2.5 INT PDF document.
6. **`zudoku build`** — prerenders all routes to static HTML. Copies
   `public/**` → `dist/**` (including `public/vpat/vpat-2.5.pdf`).

The GitHub Actions workflow (`sync-docs.yml`) also runs this chain on a cron
schedule (every 6 hours) and on push to `main`, committing any changes back
to the repo.

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

## CI / Deployment

**This repo uses Cloudflare Worker CI — push to `main` triggers deployment.**

No GitFlow release process is needed for this repo. A simple `git push origin main`
is sufficient — Cloudflare's GitHub integration automatically builds and deploys
the site on every push to `main`.

### Primebrick CI/Deployment overview (all repos)

| Repo | CI/Deployment | Process to deploy |
|------|--------------|-------------------|
| **primebrick-v3-docs** (this repo) | Cloudflare Worker CI | Push to `main` — auto-deploys |
| **primebrick-v3-website** | Cloudflare Worker CI | Push to `main` — auto-deploys |
| **primebrick-v3-backend** (BE) | No auto-deploy CI | GitFlow: create release branch → close → merge to `main` + tag |
| **primebrick-v3-frontend** (FE) | No auto-deploy CI | GitFlow: create release branch → close → merge to `main` + tag |
| **primebrick-v3-microservices** (US) | No auto-deploy CI | GitFlow: create release branch → close → merge to `main` + tag |
| **primebrick-v3-sdk** (SDK) | GitHub Actions | GitFlow: create release → close → merge to `main` + tag → CI publishes to npm |
| **primebrick-v3-dal** (DAL) | GitHub Actions | GitFlow: create release → close → merge to `main` + tag → CI publishes to npm |

**Key points for AI agents:**
- **Docs/Website**: Just push to `main`. No release process.
- **BE/FE/US**: Must follow full GitFlow. Pushing to `develop` or feature branches
  is fine for development, but deployment only happens when a release is closed
  and merged to `main` with a version tag.
- **SDK/DAL**: Same GitFlow process as BE/FE/US, but GitHub Actions auto-publishes
  to npm when the tagged release lands on `main`.

## Custom domain

The Worker should be bound to `docs.primebrick.dev` via Cloudflare dashboard
(Workers > Routes > Add custom domain). This is a manual step, not in code.

## Synced documentation

User-facing MDX files are written into `pages/<repo>/guide/` by sync scripts
that run in GitHub Actions CI (NOT on the Worker). The sync flow is:

1. **`scripts/sync-repo-docs.mjs`** — shallow-clones each Primebrick repo,
   copies `docs/user-guide/**` → `pages/<repo>/guide/`. README.md is used as
   `overview.md` fallback if no `overview.mdx` exists in `docs/user-guide/`.
2. **`scripts/generate-nav.mjs`** — reads `_order.json` from each
   `pages/<repo>/guide/` directory and generates `src/generated-nav.ts` with
   the sidebar navigation in logical reading order (not alphabetical).

### Where docs content lives

- **User-facing guides** are authored in each repo's `docs/user-guide/`
  directory (MDX files with frontmatter). They are synced to this repo by
  the sync scripts — do NOT hand-edit `pages/*/guide/` files here.
- **Hand-written docs** (getting-started, api guides) live directly in
  `pages/getting-started/` and `pages/api/` in this repo.
- **Internal AI docs** (`docs/ai/`, `docs/skills/`, `docs/gitflow.md`) stay
  in each repo and are NOT synced to the docs site.

### _order.json manifest

Each repo's `docs/user-guide/_order.json` defines the logical reading order
of pages in the sidebar. Format:

```json
{
  "pages": ["overview", "authentication", "rbac", "creating-a-microservice"]
}
```

Pages listed in `_order.json` appear first in the specified order. Pages not
listed are appended alphabetically. If `_order.json` is missing, all pages
fall back to alphabetical order.

### Mermaid diagrams

All Mermaid diagrams in MDX files MUST use the `<Mermaid chart={...} />`
component (registered in `zudoku.config.tsx`). NEVER use ` ```Code ` or
` ```mermaid ` fenced code blocks for Mermaid — they will not render on
the docs site.

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
