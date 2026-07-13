#!/usr/bin/env node
/**
 * Sync README.md from each Primebrick repo to Zudoku docs pages.
 * Shallow-clones each repo (depth 1), copies README.md only.
 *
 * Usage: node scripts/sync-repo-docs.mjs
 *
 * Output: pages/<repo>/manual/*.md
 */
import { execSync } from 'node:child_process';
import {
  mkdirSync,
  rmSync,
  readFileSync,
  writeFileSync,
  existsSync,
} from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

const REPOS = [
  { git: 'https://github.com/michaelsogos/primebrick-v3-backend.git', slug: 'backend', dir: 'pages/backend/manual' },
  { git: 'https://github.com/michaelsogos/primebrick-v3-frontend.git', slug: 'frontend', dir: 'pages/frontend/manual' },
  { git: 'https://github.com/michaelsogos/primebrick-v3-microservices.git', slug: 'microservices', dir: 'pages/microservices/manual' },
  { git: 'https://github.com/michaelsogos/primebrick-v3-dal.git', slug: 'dal', dir: 'pages/dal/manual' },
  { git: 'https://github.com/michaelsogos/primebrick-v3-sdk.git', slug: 'sdk', dir: 'pages/sdk/manual' },
];

const TMP_DIR = join(projectRoot, '.tmp-repo-sync');

function addFrontmatter(content, title, repoSlug) {
  if (content.startsWith('---')) {
    return content;
  }
  return `---
title: "${title}"
source: manual
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

  // Copy README.md as overview (human-facing project overview)
  const readme = join(cloneDir, 'README.md');
  if (existsSync(readme)) {
    processMarkdownFile(readme, join(targetDir, 'overview.md'), repo.slug);
    console.log(`  Copied README.md as overview.md`);
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

// Cleanup
rmSync(TMP_DIR, { recursive: true, force: true });
console.log('=== In-repo docs sync complete ===');
