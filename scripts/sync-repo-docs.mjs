#!/usr/bin/env node
/**
 * Sync user-facing documentation from each Primebrick repo to Zudoku docs pages.
 * Shallow-clones each repo (depth 1), copies docs/user-guide/** and README.md.
 *
 * Usage: node scripts/sync-repo-docs.mjs
 *
 * Output: pages/<repo>/guide/*.md(x)
 *
 * Strategy:
 * - docs/user-guide/** → pages/<repo>/guide/**  (user-facing MDX docs)
 * - README.md → pages/<repo>/guide/overview.md  (fallback if no overview.mdx)
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
  { git: 'https://github.com/michaelsogos/primebrick-v3-backend.git', slug: 'backend', dir: 'pages/backend/guide' },
  { git: 'https://github.com/michaelsogos/primebrick-v3-frontend.git', slug: 'frontend', dir: 'pages/frontend/guide' },
  { git: 'https://github.com/michaelsogos/primebrick-v3-microservices.git', slug: 'microservices', dir: 'pages/microservices/guide' },
  { git: 'https://github.com/michaelsogos/primebrick-v3-dal.git', slug: 'dal', dir: 'pages/dal/guide' },
  { git: 'https://github.com/michaelsogos/primebrick-v3-sdk.git', slug: 'sdk', dir: 'pages/sdk/guide' },
];

const TMP_DIR = join(projectRoot, '.tmp-repo-sync');

function addFrontmatter(content, title, repoSlug) {
  if (content.startsWith('---')) {
    return content;
  }
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
    } else if (entry.match(/\.(md|mdx)$/)) {
      // MDX files with existing frontmatter are copied as-is
      // MD files get frontmatter added if missing
      const content = readFileSync(srcPath, 'utf-8');
      if (entry.endsWith('.mdx') || content.startsWith('---')) {
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
    execSync(`git clone --depth 1 ${repo.git} ${cloneDir}`, {
      stdio: 'pipe',
      timeout: 60000,
    });
  } catch (err) {
    console.error(`  Failed to clone ${repo.git}: ${err.message}`);
    return;
  }

  const targetDir = join(projectRoot, repo.dir);
  rmSync(targetDir, { recursive: true, force: true });
  mkdirSync(targetDir, { recursive: true });

  // Copy docs/user-guide/** → pages/<repo>/guide/**
  const userGuideDir = join(cloneDir, 'docs', 'user-guide');
  let guideCount = 0;
  if (existsSync(userGuideDir)) {
    guideCount = copyDirRecursive(userGuideDir, targetDir, repo.slug);
    console.log(`  Copied ${guideCount} files from docs/user-guide/`);
  } else {
    console.log(`  No docs/user-guide/ directory found in ${repo.slug}`);
  }

  // Copy README.md as overview.md (fallback if no overview.mdx in user-guide)
  const overviewExists = existsSync(join(targetDir, 'overview.mdx')) || existsSync(join(targetDir, 'overview.md'));
  if (!overviewExists) {
    const readme = join(cloneDir, 'README.md');
    if (existsSync(readme)) {
      processMarkdownFile(readme, join(targetDir, 'overview.md'), repo.slug);
      console.log(`  Copied README.md as overview.md (fallback)`);
    }
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
