# Devin Rule: GitFlow Enforcement

## Trigger
- Applies to ALL git operations (branch, checkout, merge, tag, push, release)
- Applies at the start of any new task, feature, bugfix, or release

## CRITICAL: Never work on `main`

**The default working branch is `develop`. NEVER checkout `main` for development.**

- `main` is ONLY for release merges (from `release/*` or `hotfix/*` branches)
- `main` auto-deploys to Cloudflare on every push — treat it as PRODUCTION
- All day-to-day work happens on `develop` or `feature/*` branches

## Mandatory Pre-Action Checklist

Before ANY git operation, the AI agent MUST:

1. **Read `docs/gitflow.md`** — the full GitFlow rules for this repository
2. **Check current branch** — `git branch --show-current`
3. **If on `main`**: STOP. Switch to `develop` immediately (`git checkout develop`)
4. **If `develop` is behind `origin/develop`**: pull first (`git pull --ff-only`)
5. **Only then proceed** with the requested operation

## Branch Rules (MANDATORY)

1. **NEVER commit directly on `develop` or `main`** — always create a `feature/*` branch first
2. **Feature branches**: `git checkout -b feature/<slug>` from up-to-date `develop`
3. **Release branches**: `git checkout -b release/<version>` from `develop`
4. **Hotfix branches**: `git checkout -b hotfix/<version>` from `main`
5. **NEVER use 'v' prefix** in branch names or tags: `release/0.2.0` (not `release/v0.2.0`)

## Release / New Build Procedure

**A new build = a new release.** To deploy to Cloudflare:

1. Create `release/<version>` from `develop`
2. Merge `release/<version>` into `main` with `--no-ff`
3. Tag `main` with the version: `git tag <version>`
4. Push `main` with tags: `git push origin main --tags`
5. Cloudflare auto-builds and deploys on the `main` push
6. Merge `main` back to `develop`: `git checkout develop && git merge main --no-ff && git push`
7. Delete the `release/*` branch (local + origin)

**NEVER push to `main` directly from `develop` or a feature branch.**
**The ONLY path to `main` is through a `release/*` or `hotfix/*` branch.**

## Branch Closing Procedure (MANDATORY)

When closing ANY branch:

1. Merge to appropriate base branch with `--no-ff`
2. Push the merged base branch: `git push origin <base-branch>`
3. Delete branch LOCALLY: `git branch -d <branch-name>`
4. Delete branch on ORIGIN: `git push origin --delete <branch-name>`
5. For Release/Hotfix: merge `main` back to `develop` and push

## Version Tagging Rules

- Tag derived from branch name: `release/0.2.0` → tag `0.2.0`
- Hotfix increments PATCH: `0.2.0` → `hotfix/0.2.1` → tag `0.2.1`
- Release increments MINOR: `0.2.0` → `release/0.3.0` → tag `0.3.0`
- NO 'v' prefix in tags: `0.2.0` (not `v0.2.0`)

## New Task Workflow

When the user starts a fresh piece of work:

1. Ensure on `develop` (NOT `main`): `git checkout develop && git pull --ff-only`
2. Infer a branch slug — lowercase, kebab-case, ASCII only
3. Create `feature/<slug>` from `develop`: `git checkout -b feature/<slug>`
4. State the slug once so the user can rename if needed
5. Verify: `git branch --show-current`

## Forbidden Behaviors

- ❌ Checking out `main` for development
- ❌ Committing directly on `develop` or `main`
- ❌ Pushing to `main` without going through a `release/*` or `hotfix/*` branch
- ❌ Using 'v' prefix in tags or branch names
- ❌ Forgetting `--no-ff` on merges
- ❌ Forgetting to delete branches after merge
- ❌ Forgetting to merge `main` back to `develop` after a release
- ❌ Creating commits before creating a feature branch

## Enforcement

- AI agent MUST read `docs/gitflow.md` before any git operation
- AI agent MUST be on `develop` (or a `feature/*` branch) before making changes
- AI agent MUST NEVER checkout `main` except for release/hotfix merge operations
- AI agent MUST NEVER push to `main` except via the release/hotfix procedure
- AI agent MUST ALWAYS use `--no-ff` when merging branches
- AI agent MUST ALWAYS merge `main` back to `develop` after a release
- AI agent MUST ALWAYS delete branches (local + origin) after closing
