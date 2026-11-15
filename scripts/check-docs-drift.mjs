#!/usr/bin/env node
/**
 * Detect upstream documentation drift.
 *
 * Modes:
 *   node scripts/check-docs-drift.mjs           remote SHA drift (CI sync)
 *   node scripts/check-docs-drift.mjs --local   local integrity suite:
 *     shared-rule/doc drift (shared-files-manifest.json), internal links,
 *     dead _order.json slugs — no network, reads sibling checkouts.
 *
 * Remote mode compares each upstream repo's `main` HEAD sha against the
 * recorded state in scripts/docs-sync-state.json, then rewrites the state
 * file with the freshly observed SHAs.
 *
 * Output (GitHub Actions): drift=true|false on $GITHUB_OUTPUT.
 */
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPOS } from './repos.mjs';

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const DOCS_REPO = resolve(SCRIPTS_DIR, '..');

if (process.argv.includes('--local')) {
  process.exit(runLocalChecks() === 0 ? 0 : 1);
}

const statePath = join(SCRIPTS_DIR, 'docs-sync-state.json');
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

// ─── --local: filesystem drift suite ────────────────────────────────────────
// Repo-scoped shared-rule drift + internal-link + dead-slug checks.
// No network — everything reads the sibling checkouts.

function runLocalChecks() {
  const manifestPath = join(SCRIPTS_DIR, 'shared-files-manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const reposParent = resolve(DOCS_REPO, '..');
  const governed = manifest.repos;
  let failures = 0;
  const fail = (msg) => { failures++; console.log(`  ✗ ${msg}`); };

  // 1. Shared-file drift — identical = byte-equal; variant = must exist.
  console.log('\n[shared files]');
  const fileSets = {};
  for (const [rel, spec] of Object.entries(manifest.files)) {
    const targets = spec.repos === '*' ? governed : spec.repos;
    fileSets[rel] = targets;
    const present = targets.filter((r) => existsSync(join(reposParent, r, rel)));
    for (const missing of targets.filter((r) => !present.includes(r)))
      fail(`${rel}: missing in ${missing}`);
    if (spec.mode === 'identical' && present.length > 1) {
      const hashes = new Map();
      for (const r of present) {
        const h = createHash('md5').update(readFileSync(join(reposParent, r, rel))).digest('hex');
        (hashes.get(h) ?? hashes.set(h, []).get(h)).push(r);
      }
      if (hashes.size > 1)
        fail(`${rel}: ${hashes.size} variants — ${[...hashes.values()].map((g) => g[0]).join(' | ')}`);
    }
  }

  // Coverage hint — shared files in >=2 governed repos absent from the manifest.
  const seen = new Map();
  for (const r of governed) {
    for (const base of ['.devin/rules', 'docs/ai']) {
      const dir = join(reposParent, r, base);
      if (!existsSync(dir)) continue;
      for (const f of readdirSync(dir).filter((x) => x.endsWith('.md') && x !== 'README.md')) {
        const rel = `${base}/${f}`;
        if (!manifest.files[rel]) (seen.get(rel) ?? seen.set(rel, []).get(rel)).push(r);
      }
    }
  }
  for (const [rel, rs] of seen)
    if (rs.length >= 2) console.log(`  ? unlisted shared file ${rel} in ${rs.length} repos — add to manifest or keep repo-local`);

  // 2. Internal links — relative markdown links + docs/ references resolve.
  console.log('\n[internal links]');
  const LINK = /\[[^\]]*\]\(([^)]+)\)|`((?:docs|\.devin)\/[^`\s]+)`/g;
  for (const r of governed) {
    const repoDir = join(reposParent, r);
    const scanDirs = ['.devin/rules', 'docs/ai', 'docs/dev-guide', 'docs/user-guide', 'docs'];
    const files = [];
    for (const d of scanDirs) {
      const dir = join(repoDir, d);
      if (!existsSync(dir)) continue;
      for (const f of readdirSync(dir, { recursive: true }))
        if (typeof f === 'string' && /\.(md|mdx)$/.test(f)) files.push(join(dir, f));
    }
    for (const f of ['AGENTS.md', 'CLAUDE.md']) {
      const p = join(repoDir, f);
      if (existsSync(p)) files.push(p);
    }
    for (const file of files) {
      const src = readFileSync(file, 'utf-8');
      for (const m of src.matchAll(LINK)) {
        // brace expansion: path/{a,b}.ext → path/a.ext, path/b.ext
        const rawLink = (m[1] ?? m[2]).split('#')[0].trim();
        const raws = rawLink.includes('{')
          ? (() => { const mm = rawLink.match(/^(.*)\{([^}]*)\}(.*)$/); return mm ? mm[2].split(',').map((v) => mm[1] + v + mm[3]) : [rawLink]; })()
          : [rawLink];
        for (const raw of raws) {
        if (!raw) continue;
        if (/^(https?:|mailto:|#)/.test(raw)) continue; // external / anchor
        if (raw.startsWith('/')) continue; // site slug — resolves via the built nav, not the repo FS
        if (raw.includes('*')) continue; // glob pattern, not a concrete path
        if (/^(url|path|link|href|file)$/i.test(raw)) continue; // doc placeholders
        if (raw.includes('_extracted/')) continue; // generated extraction artifacts (produced at sync time)
        const rooted = raw.startsWith('docs/') || raw.startsWith('.devin/');
        // rooted refs into a top dir that doesn't exist here are convention
        // prose (e.g. docs/user-guide/… in a repo with no user-guide tree)
        if (rooted && !existsSync(join(repoDir, raw.split('/').slice(0, 2).join('/')))) continue;
        const target = rooted ? join(repoDir, raw) : resolve(dirname(file), raw);
        if (existsSync(target)) continue;
        // bare directory references are descriptive (e.g. "docs/user-guide/"
        // in a repo that has no user-guide tree) — only concrete file refs drift
        if (rooted && !/\.[a-z0-9]+$/i.test(raw)) continue;
        const candidates = /\.[a-z0-9]+$/i.test(raw)
          ? [target.replace(/\.(md|mdx)$/, '.mdx'), target.replace(/\.(md|mdx)$/, '.md')]
          : [target + '.mdx', target + '.md', target + '.json', join(target, 'index.mdx'), join(target, 'index.md')];
        if (candidates.some((c) => existsSync(c))) continue;
        fail(`${r}/${relative(repoDir, file)}: dead link → ${raw}`);
        }
      }
    }
  }

  // 3. Dead slugs — every _order.json entry maps to an existing page.
  console.log('\n[order slugs]');
  for (const r of governed) {
    const repoDir = join(reposParent, r);
    for (const d of ['docs/user-guide', 'docs/dev-guide', 'docs/ai']) {
      const dir = join(repoDir, d);
      const orderPath = join(dir, '_order.json');
      if (!existsSync(orderPath)) continue;
      const order = JSON.parse(readFileSync(orderPath, 'utf8'));
      const entries = Array.isArray(order) ? order : (order.order ?? []);
      for (const slug of entries) {
        const base = String(slug).replace(/\.(mdx?|json)$/, '');
        if (
          !existsSync(join(dir, base + '.mdx')) &&
          !existsSync(join(dir, base + '.md')) &&
          !existsSync(join(dir, base, '_order.json')) &&
          !existsSync(join(dir, slug))
        )
          fail(`${r}/${d}/_order.json: dead slug '${slug}'`);
      }
    }
  }

  console.log(failures === 0 ? '\nLOCAL: no drift' : `\nLOCAL: ${failures} drift item(s)`);
  return failures;
}
