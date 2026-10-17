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

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

const REPOS = [
  { git: 'https://github.com/michaelsogos/primebrick-v3-backend.git', slug: 'backend' },
  { git: 'https://github.com/michaelsogos/primebrick-v3-frontend.git', slug: 'frontend' },
  { git: 'https://github.com/michaelsogos/primebrick-v3-microservices.git', slug: 'microservices' },
  { git: 'https://github.com/michaelsogos/primebrick-v3-dal.git', slug: 'dal' },
  { git: 'https://github.com/michaelsogos/primebrick-v3-sdk.git', slug: 'sdk' },
];

/** doc tier: source dir inside the repo → pages subdir */
const TIERS = [
  { src: 'docs/user-guide', dest: 'guide' },
  { src: 'docs/dev-guide', dest: 'dev' },
];

const TMP_DIR = join(projectRoot, '.tmp-repo-sync');

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
