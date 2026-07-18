#!/usr/bin/env node
/**
 * Sync the VPAT audit data (vpat-data.json) from the FE repo's
 * public/vpat/ directory into this docs repo's public/vpat/ directory.
 *
 * This runs in the Cloudflare build chain AFTER sync-repo-docs.mjs (which
 * shallow-clones the FE repo to .tmp-repo-sync/frontend/).
 *
 * Usage: node scripts/sync-vpat-data.mjs
 *
 * Output: public/vpat/vpat-data.json
 */
import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

const SRC = join(projectRoot, '.tmp-repo-sync', 'frontend', 'public', 'vpat', 'vpat-data.json');
const DEST_DIR = join(projectRoot, 'public', 'vpat');
const DEST = join(DEST_DIR, 'vpat-data.json');

console.log('=== VPAT data sync started ===');

if (!existsSync(SRC)) {
  console.warn(`  Source not found: ${SRC}`);
  console.warn('  The FE repo may not have public/vpat/vpat-data.json committed.');
  console.warn('  Run `pnpm run test:a11y` in the FE repo first to generate it.');
  console.warn('  Skipping VPAT data sync — VPAT page will show "Not Evaluated".');
  process.exit(0);
}

mkdirSync(DEST_DIR, { recursive: true });
copyFileSync(SRC, DEST);
console.log(`  Copied vpat-data.json → public/vpat/vpat-data.json`);

console.log('=== VPAT data sync complete ===');
