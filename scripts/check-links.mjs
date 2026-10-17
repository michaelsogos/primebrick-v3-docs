#!/usr/bin/env node
/**
 * Internal link checker for the docs site.
 *
 * Scans pages/**\/*.{md,mdx} and verifies that every internal markdown link
 * resolves to an existing page. Links inside fenced code blocks and inline
 * code spans are ignored.
 *
 * Exits non-zero when broken links are found — wired into build:full so a
 * bad upstream link can never reach the deployed site.
 *
 * Usage: node scripts/check-links.mjs
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const PAGES_DIR = join(projectRoot, 'pages');
const PUBLIC_DIR = join(projectRoot, 'public');

// Site routes that do not map to pages/** files (zudoku-generated).
const VIRTUAL_PREFIXES = ['/catalog', '/api/'];

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      if (entry === '_extracted' || entry.startsWith('.')) continue;
      yield* walk(p);
    } else if (/\.(md|mdx)$/.test(entry)) {
      yield p;
    }
  }
}

function routeExists(absRoute) {
  const clean = absRoute.replace(/\/$/, '');
  if (clean === '') return true; // site root
  for (const base of [PAGES_DIR, PUBLIC_DIR]) {
    const p = join(base, clean.replace(/^\//, ''));
    if (
      existsSync(`${p}.mdx`) || existsSync(`${p}.md`) ||
      existsSync(join(p, 'index.mdx')) || existsSync(join(p, 'index.md')) ||
      existsSync(p) // assets in public/ or extensionless dir hits
    ) return true;
  }
  return false;
}

const broken = [];
let checked = 0;

for (const file of walk(PAGES_DIR)) {
  const content = readFileSync(file, 'utf-8');
  const parts = content.split(/(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]+`)/g);
  for (let i = 0; i < parts.length; i += 2) {
    const re = /\]\(([^)\s]+)\)/g;
    let m;
    while ((m = re.exec(parts[i])) !== null) {
      const target = m[1];
      if (/^(https?:|mailto:|tel:|#)/.test(target)) continue;
      const [pathPart] = target.split(/[#?]/);
      if (!pathPart) continue;
      checked++;
      if (pathPart.startsWith('/')) {
        if (VIRTUAL_PREFIXES.some((v) => pathPart.startsWith(v))) continue;
        if (!routeExists(pathPart)) {
          broken.push(`${relative(PAGES_DIR, file)} → ${target}`);
        }
      } else {
        const abs = resolve(dirname(file), pathPart);
        const relToPages = relative(PAGES_DIR, abs);
        if (relToPages.startsWith('..')) {
          // Links escaping pages/ — repo files etc. Cannot resolve on the site.
          broken.push(`${relative(PAGES_DIR, file)} → ${target} (escapes pages/)`);
          continue;
        }
        const stripped = abs.replace(/\.(md|mdx)$/, '');
        if (
          !existsSync(`${stripped}.mdx`) && !existsSync(`${stripped}.md`) &&
          !existsSync(join(stripped, 'index.mdx')) && !existsSync(join(stripped, 'index.md'))
        ) {
          broken.push(`${relative(PAGES_DIR, file)} → ${target}`);
        }
      }
    }
  }
}

if (broken.length) {
  console.error(`✗ check-links: ${broken.length} broken internal link(s):`);
  for (const b of broken) console.error(`  ${b}`);
  process.exit(1);
}
console.log(`✓ check-links: ${checked} internal links verified, 0 broken`);
