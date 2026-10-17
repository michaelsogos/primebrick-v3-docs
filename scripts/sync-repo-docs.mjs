#!/usr/bin/env node
/**
 * Sync documentation from each Primebrick repo to Zudoku docs pages.
 * Shallow-clones each repo (depth 1), copies docs/user-guide/** and
 * docs/dev-guide/**.
 *
 * Usage: node scripts/sync-repo-docs.mjs
 *
 * Output:
 *   pages/<repo>/guide/*.md(x)  — user-facing docs (docs/user-guide)
 *   pages/<repo>/dev/*.md(x)    — developer docs (docs/dev-guide)
 *
 * Strategy:
 * - docs/user-guide/** → pages/<repo>/guide/**  (user-facing MDX docs)
 * - docs/dev-guide/**  → pages/<repo>/dev/**    (dev-facing MDX docs)
 * - If a synced source dir is absent after a successful clone, the
 *   corresponding pages dir is removed (repo no longer owns that tier).
 */
import { execSync } from 'node:child_process';
import {
  mkdirSync,
  rmSync,
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { join, dirname, basename, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPOS } from './repos.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

/** doc tier: source dir inside the repo → pages subdir */
const TIERS = [
  { src: 'docs/user-guide', dest: 'guide' },
  { src: 'docs/dev-guide', dest: 'dev' },
];

const TMP_DIR = join(projectRoot, '.tmp-repo-sync');

/**
 * Rewrite doc links authored inside upstream repos into site routes.
 *
 * Upstream sources link with repo-rooted paths (`/docs/dev-guide/x`,
 * `docs/user-guide/y`, `../dev-guide/z`) or the legacy inverted scheme
 * (`/dev/<repo>/…`). On the site pages live under `/<repo>/<tier>/**`,
 * so every link is normalized at copy time — sources never change.
 *
 * Links inside fenced code blocks and inline code spans are untouched.
 * Anchors (#…) are preserved; .md/.mdx extensions are stripped.
 */
const TIER_FOR_SRC = { 'user-guide': 'guide', 'dev-guide': 'dev' };
const KNOWN_SLUGS = REPOS.map((r) => r.slug);
// Repo shorthand aliases usable inside doc links (`../be/dev/x` → /backend/dev/x).
const SLUG_ALIASES = { be: 'backend', fe: 'frontend', us: 'microservices' };
const LINK_SLUGS = [...KNOWN_SLUGS, ...Object.keys(SLUG_ALIASES)];
const canonSlug = (s) => SLUG_ALIASES[s] ?? s;

function stripDocExt(rest) {
  return rest.replace(/\.(md|mdx)$/, '').replace(/\/index$/, '');
}

function rewriteLinkTarget(target, repoSlug) {
  // Split off anchor/query — never part of path mapping.
  const m = target.match(/^([^#?]*)([#?].*)?$/);
  let path = m[1];
  const suffix = m[2] || '';

  // 1) Repo-rooted tier links: [/]docs/(user-guide|dev-guide)/… and
  //    (../)+…/(user-guide|dev-guide)/…  (cross-tier relative from docs/<other>/…)
  let t = path.match(/^(?:\/)?docs\/(user-guide|dev-guide)\/(.+)$/);
  if (!t) t = path.match(/^(?:\.\.\/)+(?:[^/]+\/)*(user-guide|dev-guide)\/(.+)$/);
  if (t) return `/${repoSlug}/${TIER_FOR_SRC[t[1]]}/${stripDocExt(t[2])}${suffix}`;

  // 2) Legacy inverted site scheme: /dev/<slug>/… or /guide/<slug>/…
  t = path.match(/^\/(dev|guide)\/([^/]+)\/(.+)$/);
  if (t && LINK_SLUGS.includes(t[2])) {
    return `/${canonSlug(t[2])}/${t[1]}/${stripDocExt(t[3])}${suffix}`;
  }

  // 3) Repo-relative cross-repo links: [../]<slug-or-alias>/(guide|dev)/…
  t = path.match(/^(?:\.\.\/)*([^/]+)\/(guide|dev)\/(.+)$/);
  if (t && LINK_SLUGS.includes(t[1])) {
    return `/${canonSlug(t[1])}/${t[2]}/${stripDocExt(t[3])}${suffix}`;
  }

  return target;
}

function rewriteLinks(content, repoSlug) {
  // Skip fenced code blocks and inline code spans (odd parts = code).
  const parts = content.split(/(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]+`)/g);
  for (let i = 0; i < parts.length; i += 2) {
    parts[i] = parts[i].replace(/\]\(([^)\s]+)\)/g, (match, target) => {
      if (/^(https?:|mailto:|tel:|#)/.test(target)) return match;
      return `](${rewriteLinkTarget(target, repoSlug)})`;
    });
  }
  return parts.join('');
}

function addFrontmatter(content, title, repoSlug) {
  if (content.startsWith('---')) {
    return content;
  }
  // Strip the first H1 heading from the body — Zudoku renders the frontmatter
  // title as the page title, so an H1 in the body would duplicate it.
  content = content.replace(/^#\s+.+\r?\n?/, '');
  return `---
title: "${title}"
source: guide
repo: "${repoSlug}"
---

${content}`;
}

function processMarkdownFile(srcPath, destPath, repoSlug) {
  let content = readFileSync(srcPath, 'utf-8');
  content = rewriteLinks(content, repoSlug);
  const filename = basename(srcPath, '.md');
  const title = filename
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  content = addFrontmatter(content, title, repoSlug);
  mkdirSync(dirname(destPath), { recursive: true });
  writeFileSync(destPath, content, 'utf-8');
}

/**
 * Recursively copy a directory, preserving subdirectory structure.
 * Only copies .md and .mdx files.
 */
function copyDirRecursive(srcDir, destDir, repoSlug) {
  if (!existsSync(srcDir)) return 0;

  let count = 0;
  const entries = readdirSync(srcDir);

  for (const entry of entries) {
    const srcPath = join(srcDir, entry);
    const destPath = join(destDir, entry);

    if (statSync(srcPath).isDirectory()) {
      // Skip _extracted directory (extraction JSON output, not for the site)
      if (entry === '_extracted') continue;
      // Skip hidden directories (e.g. .obsidian)
      if (entry.startsWith('.')) continue;
      count += copyDirRecursive(srcPath, destPath, repoSlug);
    } else if (entry === '_order.json') {
      // Copy _order.json manifest (needed by generate-nav.mjs)
      mkdirSync(dirname(destPath), { recursive: true });
      writeFileSync(destPath, readFileSync(srcPath, 'utf-8'), 'utf-8');
      count++;
    } else if (entry.match(/\.(md|mdx)$/)) {
      // MDX files with existing frontmatter are copied as-is
      // MD files get frontmatter added if missing
      let content = readFileSync(srcPath, 'utf-8');
      if (entry.endsWith('.mdx') || content.startsWith('---')) {
        // Strip the first H1 heading from the body if frontmatter has a title —
        // Zudoku renders the frontmatter title as the page title, so an H1 in
        // the body would duplicate it.
        if (content.startsWith('---')) {
          content = content.replace(/^(---[\s\S]*?---\s*\n)#\s+.+\r?\n?/, '$1');
        }
        content = rewriteLinks(content, repoSlug);
        mkdirSync(dirname(destPath), { recursive: true });
        writeFileSync(destPath, content, 'utf-8');
      } else {
        processMarkdownFile(srcPath, destPath, repoSlug);
      }
      count++;
    }
  }

  return count;
}

function syncRepo(repo) {
  console.log(`Syncing docs for ${repo.slug}...`);
  const cloneDir = join(TMP_DIR, repo.slug);

  rmSync(cloneDir, { recursive: true, force: true });
  mkdirSync(cloneDir, { recursive: true });

  try {
    // Always clone `main` explicitly — never rely on the repo's default branch.
    // The docs site must reflect what is released on `main` of each upstream
    // repo, not whatever branch GitHub happens to expose as default.
    execSync(`git clone --depth 1 --branch main ${repo.git} ${cloneDir}`, {
      stdio: 'pipe',
      timeout: 60000,
    });
  } catch (err) {
    console.error(`  Failed to clone ${repo.git} (branch main): ${err.message}`);
    return;
  }

  for (const tier of TIERS) {
    const srcDir = join(cloneDir, tier.src);
    const targetDir = join(projectRoot, 'pages', repo.slug, tier.dest);

    if (!existsSync(srcDir)) {
      // Clone succeeded — the tier genuinely does not exist in this repo
      // (e.g. dev-only repos have no user-guide). Remove stale synced pages.
      if (existsSync(targetDir)) {
        rmSync(targetDir, { recursive: true, force: true });
        console.log(`  No ${tier.src}/ in ${repo.slug} — removed stale pages/${repo.slug}/${tier.dest}/`);
      } else {
        console.log(`  No ${tier.src}/ in ${repo.slug} — nothing to sync for ${tier.dest}`);
      }
      continue;
    }

    rmSync(targetDir, { recursive: true, force: true });
    mkdirSync(targetDir, { recursive: true });
    const count = copyDirRecursive(srcDir, targetDir, repo.slug);
    console.log(`  Copied ${count} files from ${tier.src}/ → pages/${repo.slug}/${tier.dest}/`);
  }

  // Umbrella repos (serviceDocs: true): each <svc>/docs/{tier} syncs to
  // pages/<slug>/<tier>/services/<svc>/ so /microservices/dev/services/x
  // links resolve.
  if (repo.serviceDocs) {
    for (const entry of readdirSync(cloneDir)) {
      const svcDocsDir = join(cloneDir, entry, 'docs');
      if (!statSyncSafe(svcDocsDir)?.isDirectory()) continue;
      if (entry.startsWith('.') || entry === 'node_modules') continue;
      for (const tier of TIERS) {
        const srcDir = join(svcDocsDir, tier.src.split('/')[1]);
        const targetDir = join(projectRoot, 'pages', repo.slug, tier.dest, 'services', entry);
        if (!existsSync(srcDir)) {
          if (existsSync(targetDir)) {
            rmSync(targetDir, { recursive: true, force: true });
            console.log(`  No ${tier.src}/ in ${repo.slug}/${entry} — removed stale pages`);
          }
          continue;
        }
        rmSync(targetDir, { recursive: true, force: true });
        mkdirSync(targetDir, { recursive: true });
        const count = copyDirRecursive(srcDir, targetDir, repo.slug);
        console.log(`  Copied ${count} files from ${entry}/${tier.src}/ → pages/${repo.slug}/${tier.dest}/services/${entry}/`);
      }
    }
  }
}

function statSyncSafe(p) {
  try {
    return statSync(p);
  } catch {
    return null;
  }
}

// Main
console.log('=== In-repo docs sync started ===');
rmSync(TMP_DIR, { recursive: true, force: true });
mkdirSync(TMP_DIR, { recursive: true });

for (const repo of REPOS) {
  try {
    syncRepo(repo);
  } catch (err) {
    console.error(`Failed to sync ${repo.slug}: ${err.message}`);
  }
}

// NOTE: .tmp-repo-sync/ is NOT cleaned up here.
// fetch-openapi.mjs reads from it and cleans up when done.
console.log('=== In-repo docs sync complete ===');
console.log('(.tmp-repo-sync/ left for fetch-openapi.mjs)');
