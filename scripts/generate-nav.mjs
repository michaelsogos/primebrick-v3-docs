#!/usr/bin/env node
/**
 * Generate navigation fragment from pages/ directory structure.
 * Scans pages/<repo>/guide/ for .md/.mdx files and generates
 * src/generated-nav.ts with a navigation array.
 *
 * Page order is determined by docs/user-guide/_order.json (copied to
 * pages/<repo>/guide/_order.json by sync-repo-docs.mjs). Pages listed
 * in _order.json appear in the specified order; unlisted pages are
 * appended alphabetically. If _order.json is missing, all pages are
 * sorted alphabetically.
 *
 * Usage: node scripts/generate-nav.mjs
 * Run AFTER sync-repo-docs.mjs
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const pagesDir = join(projectRoot, 'pages');

// Each repo is tagged with its sidebar group:
//   'service'  → appears under the "Services" category
//   'library'  → appears under the "Libraries" category
// This explicit tagging replaces the old positional slice(0,3)/slice(3)
// split, which silently shifted categories when a repo was filtered out
// (e.g. Backend having no docs caused DAL to slide into Services).
const REPOS = [
  { slug: 'backend',      label: 'Backend',      icon: 'server',   group: 'service' },
  { slug: 'frontend',     label: 'Frontend',     icon: 'monitor',  group: 'service' },
  { slug: 'microservices', label: 'Microservices', icon: 'boxes',  group: 'service' },
  { slug: 'dal',          label: 'DAL Library',  icon: 'database', group: 'library' },
  { slug: 'sdk',          label: 'SDK Library',  icon: 'package',  group: 'library' },
];

const SUBDIRS = ['guide'];

function extractTitle(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const fmMatch = content.match(/^---\n[\s\S]*?title:\s*["']?(.+?)["']?\s*$/m);
    if (fmMatch) return fmMatch[1];
    const h1Match = content.match(/^#\s+(.+)$/m);
    if (h1Match) return h1Match[1];
  } catch {}
  return null;
}

/**
 * Read _order.json from a directory and return the ordered page slugs.
 * Returns null if _order.json doesn't exist.
 */
function readOrderManifest(dir) {
  const manifestPath = join(dir, '_order.json');
  if (!existsSync(manifestPath)) return null;
  try {
    const content = readFileSync(manifestPath, 'utf-8');
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed.pages)) return parsed.pages;
  } catch (err) {
    console.warn(`  Warning: failed to parse _order.json in ${dir}: ${err.message}`);
  }
  return null;
}

/**
 * Recursively scan a directory for .md/.mdx files.
 * Returns a flat list of { type, file, label, slug } items.
 *
 * - file: path relative to pagesDir (e.g. "microservices/guide/services/emailsender")
 * - slug: path relative to the guide dir (e.g. "services/emailsender" or "overview")
 *
 * Subdirectories are recursed into (except _extracted and hidden dirs).
 * The slug includes the subdirectory path so _order.json can reference
 * "services/emailsender" as a single entry.
 */
function scanDir(dir, guideDir) {
  const items = [];
  if (!existsSync(dir)) return items;

  const entries = readdirSync(dir).sort();
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      // Skip _extracted (extraction JSON) and hidden directories
      if (entry === '_extracted' || entry.startsWith('.')) continue;
      // Recurse into subdirectories
      items.push(...scanDir(fullPath, guideDir));
      continue;
    }

    if (!entry.match(/\.(md|mdx)$/)) continue;

    const name = entry.replace(/\.(md|mdx)$/, '');
    // Skip index files (landing pages, handled separately)
    if (name === 'index') continue;

    const title = extractTitle(fullPath) || name.split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const relativePath = relative(pagesDir, fullPath).replace(/\\/g, '/').replace(/\.(md|mdx)$/, '');
    // Slug is relative to the guide dir, e.g. "services/emailsender" or "overview"
    const slug = relative(guideDir, fullPath).replace(/\\/g, '/').replace(/\.(md|mdx)$/, '');

    items.push({
      type: 'doc',
      file: relativePath,
      label: title,
      slug: slug,
    });
  }

  return items;
}

/**
 * Sort pages by _order.json manifest. Pages in the manifest appear first
 * in the specified order. Pages not in the manifest are appended alphabetically.
 */
function orderPages(pages, manifest) {
  if (!manifest || manifest.length === 0) {
    // Fallback: alphabetical by slug
    return pages.sort((a, b) => a.slug.localeCompare(b.slug));
  }

  const ordered = [];
  const used = new Set();

  // Add pages in manifest order
  for (const slug of manifest) {
    const page = pages.find(p => p.slug === slug);
    if (page) {
      ordered.push(page);
      used.add(slug);
    }
  }

  // Append remaining pages alphabetically
  const remaining = pages
    .filter(p => !used.has(p.slug))
    .sort((a, b) => a.slug.localeCompare(b.slug));
  ordered.push(...remaining);

  return ordered;
}

/**
 * Group ordered docs into nav items.
 *
 * Top-level docs (slug has no "/") become string shorthands in the items array.
 * Subdirectory docs (slug contains "/") are grouped into nested categories,
 * one per subdirectory. The category appears at the position of its first
 * child in the ordered list, preserving _order.json ordering.
 */
function groupOrderedDocs(orderedDocs) {
  const result = [];
  const subCategories = new Map(); // subdir name → { type, label, items }

  for (const doc of orderedDocs) {
    const slashIdx = doc.slug.indexOf('/');
    if (slashIdx === -1) {
      // Top-level doc — push as string shorthand
      result.push(doc.file);
    } else {
      // Subdirectory doc — group into a nested category
      const subdirName = doc.slug.substring(0, slashIdx);
      if (!subCategories.has(subdirName)) {
        const label = subdirName.split(/[-_]/)
          .map(w => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
        const category = {
          type: 'category',
          label,
          items: [],
        };
        subCategories.set(subdirName, category);
        result.push(category);
      }
      subCategories.get(subdirName).items.push(doc.file);
    }
  }

  return result;
}

function buildRepoNav(repo) {
  const items = [];

  for (const subdir of SUBDIRS) {
    const dir = join(pagesDir, repo.slug, subdir);
    const docs = scanDir(dir, dir);

    if (docs.length === 0) {
      // Keep the placeholder index if no synced content
      const indexPath = join(dir, 'index.mdx');
      if (existsSync(indexPath)) {
        items.push(`${repo.slug}/${subdir}/index`);
      }
      continue;
    }

    // Read _order.json and sort pages accordingly
    const manifest = readOrderManifest(dir);
    const ordered = orderPages(docs, manifest);

    if (manifest) {
      console.log(`  ${repo.slug}/guide: using _order.json (${manifest.length} pages in manifest)`);
    } else {
      console.log(`  ${repo.slug}/guide: no _order.json, alphabetical fallback`);
    }

    // Group ordered docs into nav items (with nested categories for subdirs)
    const navItems = groupOrderedDocs(ordered);
    items.push(...navItems);
  }

  if (items.length === 0) {
    // No docs and no index file — skip this repo from the nav entirely
    // rather than referencing a non-existent page (which crashes the build)
    console.warn(`  ${repo.slug}: no docs found and no index.mdx — skipping from nav`);
    return null;
  }

  return {
    type: 'category',
    label: repo.label,
    icon: repo.icon,
    collapsed: true,
    items,
  };
}

// Main
console.log('=== Generating navigation fragment ===');

const repoNavs = REPOS.map(buildRepoNav).filter(n => n !== null);

// Split for stacked navigation by explicit group tag.
// This is position-independent: a repo being filtered out (null) can
// never cause a repo to land in the wrong sidebar group.
const serviceLabels = new Set(REPOS.filter(r => r.group === 'service').map(r => r.label));
const libraryLabels = new Set(REPOS.filter(r => r.group === 'library').map(r => r.label));

const output = `// AUTO-GENERATED by scripts/generate-nav.mjs — DO NOT EDIT
// Regenerated on each sync run in CI
import type { Navigation } from "zudoku";

export const generatedRepoNav: Navigation = ${JSON.stringify(repoNavs, null, 2)};

// Split for stacked navigation by explicit group tag (service vs library).
// Position-independent: a filtered-out repo can never shift another repo
// into the wrong sidebar group.
export const serviceNav: Navigation = ${JSON.stringify(repoNavs.filter(n => n && serviceLabels.has(n.label)), null, 2)};
export const libraryNav: Navigation = ${JSON.stringify(repoNavs.filter(n => n && libraryLabels.has(n.label)), null, 2)};
`;

const outputPath = join(projectRoot, 'src', 'generated-nav.ts');
writeFileSync(outputPath, output, 'utf-8');
console.log(`Wrote ${outputPath}`);
console.log('=== Navigation generation complete ===');
