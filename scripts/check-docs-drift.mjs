#!/usr/bin/env node
/**
 * Detect upstream documentation drift.
 *
 * Compares each upstream repo's `main` HEAD sha against the recorded state
 * in scripts/docs-sync-state.json, then rewrites the state file with the
 * freshly observed SHAs.
 *
 * Usage: node scripts/check-docs-drift.mjs
 * Output (GitHub Actions): drift=true|false on $GITHUB_OUTPUT.
 *
 * SHA drift is a cheap proxy — upstream may have moved without touching
 * docs/**. The workflow still runs the sync, then releases only when the
 * synced content actually differs.
 */
import { execSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPOS } from './repos.mjs';

const statePath = join(dirname(fileURLToPath(import.meta.url)), 'docs-sync-state.json');
const state = existsSync(statePath)
  ? JSON.parse(readFileSync(statePath, 'utf8'))
  : { shas: {} };

let drift = false;
const next = {};
for (const repo of REPOS) {
  const sha = execSync(`git ls-remote ${repo.git} refs/heads/main`, { encoding: 'utf8' })
    .trim()
    .split(/\s+/)[0];
  next[repo.slug] = sha;
  if (state.shas[repo.slug] !== sha) drift = true;
  console.log(`${repo.slug}: ${state.shas[repo.slug] || '(none recorded)'} -> ${sha}`);
}

writeFileSync(statePath, JSON.stringify({ shas: next }, null, 2) + '\n');
console.log(drift ? 'DRIFT DETECTED' : 'No drift');

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `drift=${drift}\n`);
}
