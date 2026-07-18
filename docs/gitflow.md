# GitFlow Rules - Primebrick Docs (docs.primebrick.dev)

This repository follows GitFlow. AI agents MUST follow these rules.

## ⚠️ CRITICAL: NEVER COMMIT AUTOMATICALLY

**AI agents MUST NEVER commit changes without explicit user instruction.**

- **WAIT for the user to explicitly tell you to commit** before running any `git commit` command
- This applies to ALL situations - no exceptions
- The user must explicitly say "commit", "procedi con il commit", or equivalent
- Do NOT commit even if you think the work is complete
- Do NOT commit even if you think it's "obvious"
- **ALWAYS wait for explicit user instruction before committing**

## ⚠️ CRITICAL: NEVER work on `main` — always stay on `develop`

**The default working branch is `develop`. NEVER checkout `main` for development.**

- `main` is ONLY for release merges (from `release/*` or `hotfix/*` branches)
- `main` auto-deploys to Cloudflare on every push — treat it as production
- All day-to-day work happens on `develop` or `feature/*` branches
- After a release merge to `main`, ALWAYS merge `main` back to `develop` and
  switch back to `develop` before doing any new work

## Branch Creation Rules

- **NEVER work directly on `develop` or `main`** - always create feature branches first
- **Feature branches**: `git checkout -b feature/<slug>` from updated `develop`
- **Release branches**: `git checkout -b release/<version>` from `develop` (for version bumps)
- **Hotfix branches**: `git checkout -b hotfix/<version>` from `main` (for production fixes)

## When to ask user permission

- **ASK before creating NEW feature branch** if another feature branch is already open
- **DO NOT ask permission** to commit changes on existing feature branch
- **DO NOT ask permission** to close a feature branch (follow proper closing procedure)

## Branch Closing Procedure (MANDATORY)

When closing ANY branch (`feature/*`, `release/*`, `hotfix/*`):

1. **Merge to appropriate base branch**:
   - Feature: `git merge --no-ff feature/<branch>` into `develop`
   - Release: `git merge --no-ff release/<version>` into `main`
   - Hotfix: `git merge --no-ff hotfix/<version>` into `main`

2. **Push the merged base branch**: `git push origin <base-branch>`

3. **Delete branch LOCALLY**: `git branch -d <branch-name>`

4. **Delete branch on ORIGIN**: `git push origin --delete <branch-name>`

5. **For Release/Hotfix**: Also merge `main` back to `develop` to stay aligned

## Deployment flow (Cloudflare Workers auto-deploy)

This repo uses **Cloudflare Worker CI** — push to `main` triggers automatic
build and deployment. The deployment flow is:

1. Work on `feature/*` branches from `develop`
2. Merge feature branches into `develop` via `--no-ff`
3. When ready to deploy: create `release/<version>` from `develop`
4. Merge `release/<version>` into `main` with `--no-ff`
5. Tag `main` with the version number (e.g., `git tag 0.2.0`)
6. Push `main` with tags: `git push origin main --tags`
7. **Cloudflare auto-builds and deploys** on the `main` push
8. Merge `main` back to `develop`, push `develop`
9. Delete the `release/*` branch (local + origin)

**The tag is for version history. The Cloudflare deploy is triggered by the
`main` push, not by the tag.**

## Version Tagging Rules

- **NO 'v' prefix** in branch names: `release/0.2.0` (not `release/v0.2.0`)
- **NO 'v' prefix** in tags: `0.2.0` (not `v0.2.0`)
- **Tag derived from branch name**: `release/0.2.0` → tag `0.2.0`
- **Hotfix increments PATCH**: `0.2.0` → `hotfix/0.2.1` → tag `0.2.1`
- **Release increments MINOR**: `0.2.0` → `release/0.3.0` → tag `0.3.0`
- **First release**: `release/0.1.0` → tag `0.1.0` (matches `package.json` version)

## Common Mistakes to Avoid

- ❌ Committing directly on `develop` or `main`
- ❌ Checking out `main` for development (main is production — auto-deploys)
- ❌ Creating commits before creating feature branch
- ❌ Forgetting to delete branches (both local and origin)
- ❌ Using 'v' prefix in tags
- ❌ Not pushing merged base branch
- ❌ Leaving feature branches open after merge
- ❌ Forgetting to merge `main` back to `develop` after a release

## Repository-Specific Rules

- When working from meta-workspace root, use `cd primebrick-v3-docs && git <command>`
- The `build:full` npm script wraps the full sync + build chain (see AGENTS.md)
- The Cloudflare dashboard build command must be `pnpm run build:full`

## Commit rules

- NEVER commit automatically - wait for explicit user instruction
- DO NOT ask user to approve commit messages
- Write appropriate commit messages directly when instructed
- DO NOT open editor for commit approval

## Commit and Push Guidelines

When instructed to "commit and push everything" or similar commands:
- Run `git add -A` in the repository
- Commit ALL staged files
- Push the current branch to origin
- Do NOT filter files by task relevance - commit everything that has changed

## New task workflow

When the user starts a fresh piece of work with phrases such as "Let's start a new task", "Iniziamo un nuovo task", or equivalent:

1. Infer a branch slug from context — lowercase, kebab-case, ASCII letters/digits/hyphens only
2. Ensure you are on `develop` (NOT `main`) and `develop` is up to date with `origin/develop`
3. Before the first tracked-file change, create a branch `feature/<slug>` from `develop`
4. State the slug once (e.g. "Branch: `feature/vpat-report`") so the user can rename if needed
5. After creating a feature branch, verify with `git branch --show-current` so the working tree matches the branch
