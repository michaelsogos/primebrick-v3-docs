#!/usr/bin/env node
/**
 * generate-reference-docs.mjs — Auto-generates 4 critical reference MDX docs
 * for the AI chat knowledge base, extracted from BE/FE source code.
 *
 * Generated docs (written to pages/backend/guide/):
 *   1. entity-field-reference.mdx   — All entity fields from *.meta.ts
 *   2. filter-operator-reference.mdx — All SqlOperator values from dsl.ts
 *   3. filter-syntax-guide.mdx       — Filter syntax with examples per operator
 *   4. navigation-map.mdx            — FE routes + entity association
 *
 * MUST run AFTER sync-repo-docs.mjs (which clones repos to .tmp-repo-sync/).
 * MUST run BEFORE generate-nav.mjs (which reads _order.json).
 *
 * Usage: node scripts/generate-reference-docs.mjs
 *
 * Each generated doc has a <!-- AUTO-GENERATED --> marker — do NOT hand-edit.
 * Re-run this script (or trigger the docs CI) to regenerate from source.
 */
import { execSync } from 'node:child_process';
import {
  mkdirSync,
  writeFileSync,
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
} from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const tmpDir = join(projectRoot, '.tmp-repo-sync');
const beRepoDir = join(tmpDir, 'backend');
const feRepoDir = join(tmpDir, 'frontend');
const backendGuideDir = join(projectRoot, 'pages', 'backend', 'guide');

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Use tsx to import a TypeScript file and extract an exported value as JSON.
 * Mirrors fetch-openapi.mjs's extractSpecViaTsx pattern.
 */
function extractViaTsx(tsFilePath, exportName) {
  const extractorPath = join(projectRoot, '_extract-ref.ts');
  const relativePath = tsFilePath.replace(projectRoot, '.').replace(/\\/g, '/');
  const helperCode = `import { ${exportName} } from "${relativePath}";
console.log(JSON.stringify(${exportName}));
`;
  writeFileSync(extractorPath, helperCode, 'utf-8');
  try {
    const stdout = execSync(`npx tsx "${extractorPath}"`, {
      encoding: 'utf-8',
      cwd: projectRoot,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30000,
    });
    return JSON.parse(stdout.trim());
  } catch (err) {
    console.warn(`  ! Failed to extract ${exportName} from ${tsFilePath}: ${err.message}`);
    return null;
  } finally {
    try { writeFileSync(extractorPath, '', 'utf-8'); } catch {}
  }
}

/** Recursively list files matching a predicate. */
function listFilesRecursive(dir, predicate) {
  if (!existsSync(dir)) return [];
  const results = [];
  function walk(d) {
    for (const name of readdirSync(d)) {
      const full = join(d, name);
      const stat = statSync(full);
      if (stat.isDirectory()) walk(full);
      else if (predicate(name)) results.push(full);
    }
  }
  walk(dir);
  return results;
}

function toPosix(p) {
  return p.split(sep).join('/');
}

// ─── 1. Entity Field Reference ────────────────────────────────────────────

/**
 * Extract entity metadata from all *.meta.ts files in the BE repo.
 * Each meta file exports a const like `customerMeta`, `organizationMeta`, etc.
 */
function collectEntityMetas() {
  const metaFiles = listFilesRecursive(
    join(beRepoDir, 'src', 'modules'),
    (n) => n.endsWith('.meta.ts'),
  );
  console.log(`  Found ${metaFiles.length} *.meta.ts files`);

  const metas = [];
  for (const file of metaFiles) {
    // Heuristic: derive candidate export names from filename.
    // customers → customerMeta | customersMeta
    // user-profiles → userProfileMeta | userProfilesMeta
    // role-mappings → roleMappingMeta | roleMappingsMeta
    const baseName = file.split(sep).pop().replace(/\.meta\.ts$/, '');
    const singular = baseName.replace(/s$/, '');
    const toCamel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const candidates = [
      `${toCamel(singular)}Meta`,
      `${toCamel(baseName)}Meta`,
    ];

    let meta = null;
    let usedName = null;
    for (const candidate of candidates) {
      meta = extractViaTsx(file, candidate);
      if (meta) { usedName = candidate; break; }
    }
    if (meta) {
      metas.push({ file, exportName: usedName, meta });
    }
  }
  return metas;
}

function generateEntityFieldReference(entityMetas) {
  const lines = [
    '---',
    'title: "Entity Field Reference"',
    'description: "Complete field reference for all Primebrick entities — auto-generated from BE metadata"',
    'source: guide',
    'repo: "backend"',
    '---',
    '',
    '# Entity Field Reference',
    '',
    '<!-- AUTO-GENERATED:entity-fields — DO NOT EDIT MANUALLY. Run generate-reference-docs.mjs to regenerate. -->',
    '',
    'This document lists every field exposed by each Primebrick entity, including',
    'type, filterability, sortability, and the i18n label key. It is the canonical',
    'reference for the AI assistant when answering questions about entity fields.',
    '',
  ];

  for (const { meta } of entityMetas) {
    const entityName = meta.entity || 'unknown';
    const titleKey = meta.titleKey || `entities.${entityName}.title`;
    lines.push(`## ${entityName}`);
    lines.push('');
    lines.push(`**Title key:** \`${titleKey}\``);
    lines.push(`**UID field:** \`${meta.uid || 'uuid'}\``);
    lines.push('');

    const columns = meta.list?.columns;
    if (columns && Array.isArray(columns)) {
      lines.push('| Field | Type | Sortable | Filterable | Searchable | Label Key |');
      lines.push('|-------|------|----------|------------|------------|-----------|');
      for (const col of columns) {
        const sortable = col.sortable ? 'yes' : 'no';
        const filterable = col.filterable ? 'yes' : 'no';
        const searchable = col.searchable === false ? 'no' : 'yes';
        lines.push(
          `| \`${col.key}\` | ${col.type || 'text'} | ${sortable} | ${filterable} | ${searchable} | \`${col.labelKey || ''}\` |`,
        );
      }
      lines.push('');

      if (meta.list?.defaultSort) {
        lines.push(`**Default sort:** \`${meta.list.defaultSort.key}\` ${meta.list.defaultSort.dir || 'asc'}`);
        lines.push('');
      }
      if (meta.list?.rowActions) {
        const actions = Object.entries(meta.list.rowActions)
          .filter(([, v]) => v)
          .map(([k]) => k)
          .join(', ');
        if (actions) {
          lines.push(`**Row actions:** ${actions}`);
          lines.push('');
        }
      }
    } else {
      lines.push('_No list columns defined._');
      lines.push('');
    }
  }

  lines.push('<!-- END -->');
  return lines.join('\n');
}

// ─── 2. Filter Operator Reference ─────────────────────────────────────────

function extractSqlOperators() {
  // Read dsl.ts and extract the SqlOperator union via regex
  const dslPath = join(beRepoDir, 'src', 'db', 'repository', 'dsl.ts');
  if (!existsSync(dslPath)) {
    console.warn(`  ! dsl.ts not found at ${dslPath}`);
    return [];
  }
  const content = readFileSync(dslPath, 'utf-8');
  const match = content.match(/export type SqlOperator\s*=\s*([^;]+);/s);
  if (!match) return [];
  const unionBody = match[1];
  const ops = [...unionBody.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  return ops;
}

function generateFilterOperatorReference(operators) {
  const opDescriptions = {
    '=': 'Equality. Matches rows where the field equals the value.',
    '!=': 'Inequality. Matches rows where the field does not equal the value.',
    '<>': 'Inequality (ANSI alternative to !=). Same behavior as !=.',
    '<': 'Less than. Matches rows where the field is strictly less than the value.',
    '<=': 'Less than or equal. Matches rows where the field is <= the value.',
    '>': 'Greater than. Matches rows where the field is strictly greater than the value.',
    '>=': 'Greater than or equal. Matches rows where the field is >= the value.',
    ILIKE: 'Case-insensitive pattern match (PostgreSQL). Use % as wildcard for any sequence, _ for any single char.',
    LIKE: 'Case-sensitive pattern match. Use % and _ wildcards.',
    IN: 'Membership in a set. Value is an array; matches rows where the field equals any element.',
    'NOT IN': 'Exclusion from a set. Value is an array; matches rows where the field is not any element.',
    BETWEEN: 'Range check. Value is an object { start, end }; matches rows where start <= field <= end.',
    IS: 'Null/boolean check. Use value: null for IS NULL, true/false for boolean.',
    'IS NOT': 'Negated null/boolean check. Use value: null for IS NOT NULL.',
  };

  const lines = [
    '---',
    'title: "Filter Operator Reference"',
    'description: "All supported filter operators for entity list queries — auto-generated from BE source"',
    'source: guide',
    'repo: "backend"',
    '---',
    '',
    '# Filter Operator Reference',
    '',
    '<!-- AUTO-GENERATED:filter-operators — DO NOT EDIT MANUALLY. Run generate-reference-docs.mjs to regenerate. -->',
    '',
    'Primebrick entity list endpoints (`GET /api/v1/entities/:entity/list`) accept a',
    '`filters` array. Each filter condition specifies a `field`, an `op` (operator),',
    'and a `value`. This document lists every supported operator.',
    '',
    '| Operator | Description | Value type |',
    '|----------|-------------|------------|',
  ];

  for (const op of operators) {
    const desc = opDescriptions[op] || 'Custom operator.';
    const valueType = op === 'IN' || op === 'NOT IN'
      ? 'array'
      : op === 'BETWEEN'
        ? '`{ start, end }`'
        : op === 'IS' || op === 'IS NOT'
          ? 'null / boolean'
          : 'string / number';
    lines.push(`| \`${op}\` | ${desc} | ${valueType} |`);
  }

  lines.push('');
  lines.push('## Filter connectors');
  lines.push('');
  lines.push('When multiple filters are provided, they are combined with a connector:');
  lines.push('- `AND` (default) — all filters must match');
  lines.push('- `OR` — any filter must match');
  lines.push('');
  lines.push('<!-- END -->');
  return lines.join('\n');
}

// ─── 3. Filter Syntax Guide ───────────────────────────────────────────────

function generateFilterSyntaxGuide(entityMetas, operators) {
  const lines = [
    '---',
    'title: "Filter Syntax Guide"',
    'description: "Examples of filter syntax for every operator and entity — auto-generated from BE metadata"',
    'source: guide',
    'repo: "backend"',
    '---',
    '',
    '# Filter Syntax Guide',
    '',
    '<!-- AUTO-GENERATED:filter-syntax — DO NOT EDIT MANUALLY. Run generate-reference-docs.mjs to regenerate. -->',
    '',
    'This guide shows concrete examples of how to construct filter queries for',
    'Primebrick entity list endpoints. Each example is a JSON snippet for the',
    '`filters` query parameter.',
    '',
    '## Common patterns',
    '',
    '### Equality (`=`)',
    '```json',
    '[{ "field": "status", "op": "=", "value": "ACTIVE" }]',
    '```',
    '',
    '### Case-insensitive search (`ILIKE`)',
    '```json',
    '[{ "field": "email", "op": "ILIKE", "value": "%@example.com" }]',
    '```',
    '',
    '### Membership (`IN`)',
    '```json',
    '[{ "field": "status", "op": "IN", "value": ["ACTIVE", "INACTIVE"] }]',
    '```',
    '',
    '### Date range (`BETWEEN`)',
    '```json',
    '[{ "field": "created_at", "op": "BETWEEN", "value": { "start": "2026-01-01", "end": "2026-12-31" } }]',
    '```',
    '',
    '### Null check (`IS`)',
    '```json',
    '[{ "field": "deleted_at", "op": "IS", "value": null }]',
    '```',
    '',
    '### Combined filters with OR connector',
    '```json',
    '[',
    '  { "field": "status", "op": "=", "value": "ACTIVE" },',
    '  { "field": "email", "op": "ILIKE", "value": "%@gmail.com" }',
    ']',
    '```',
    'With `connector=OR` query parameter, matches rows where status is ACTIVE **or** email ends with @gmail.com.',
    '',
    '## Filterable fields per entity',
    '',
  ];

  for (const { meta } of entityMetas) {
    const entityName = meta.entity || 'unknown';
    const columns = meta.list?.columns;
    if (!columns) continue;
    const filterable = columns.filter((c) => c.filterable);
    if (filterable.length === 0) continue;

    lines.push(`### ${entityName}`);
    lines.push('');
    lines.push('| Field | Type | Example |');
    lines.push('|-------|------|---------|');
    for (const col of filterable) {
      const example = col.type === 'datetime'
        ? `{ "op": "BETWEEN", "value": { "start": "2026-01-01", "end": "2026-12-31" } }`
        : col.type === 'badge'
          ? `{ "op": "=", "value": "ACTIVE" }`
          : `{ "op": "ILIKE", "value": "%search%" }`;
      lines.push(`| \`${col.key}\` | ${col.type} | \`${example}\` |`);
    }
    lines.push('');
  }

  lines.push('<!-- END -->');
  return lines.join('\n');
}

// ─── 4. Navigation Map ────────────────────────────────────────────────────

function collectFeRoutes() {
  const appDir = join(feRepoDir, 'src', 'routes', '(app)');
  if (!existsSync(appDir)) {
    console.warn(`  ! FE (app) routes dir not found: ${appDir}`);
    return [];
  }
  const pageFiles = listFilesRecursive(appDir, (n) => n === '+page.svelte');
  const routes = [];
  for (const file of pageFiles) {
    const relPath = toPosix(relative(appDir, file)).replace(/\/\+page\.svelte$/, '');
    const routePath = relPath === '+page.svelte' ? '/' : `/${relPath}`;
    // Normalize Windows separators and SvelteKit group dirs
    const normalized = routePath
      .replace(/\(app\)\//g, '')
      .replace(/\([^)]+\)\//g, '')
      .replace(/\\/g, '/');
    // Detect entity association by scanning the file for /api/v1/entities/{x}/meta
    let entity = null;
    try {
      const content = readFileSync(file, 'utf-8');
      const match = content.match(/\/api\/v1\/entities\/(\w+)\/(?:meta|list)/);
      if (match) entity = match[1];
    } catch {}
    routes.push({ path: normalized, entity, file: toPosix(relative(feRepoDir, file)) });
  }
  return routes.sort((a, b) => a.path.localeCompare(b.path));
}

function generateNavigationMap(routes) {
  const lines = [
    '---',
    'title: "Navigation Map"',
    'description: "Frontend route map with entity associations — auto-generated from FE source"',
    'source: guide',
    'repo: "backend"',
    '---',
    '',
    '# Navigation Map',
    '',
    '<!-- AUTO-GENERATED:navigation-map — DO NOT EDIT MANUALLY. Run generate-reference-docs.mjs to regenerate. -->',
    '',
    'This document maps every frontend route to its associated backend entity',
    '(when detectable from the page source). The AI assistant uses this to answer',
    '"where do I find X?" questions and to emit navigation events.',
    '',
    '| Route | Entity | Source file |',
    '|-------|--------|-------------|',
  ];

  for (const r of routes) {
    const entity = r.entity || '—';
    lines.push(`| \`${r.path}\` | ${entity} | \`${r.file}\` |`);
  }

  lines.push('');
  lines.push('## Routes grouped by entity');
  lines.push('');

  const byEntity = new Map();
  for (const r of routes) {
    if (!r.entity) continue;
    if (!byEntity.has(r.entity)) byEntity.set(r.entity, []);
    byEntity.get(r.entity).push(r.path);
  }
  for (const [entity, paths] of [...byEntity.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`### ${entity}`);
    for (const p of paths) lines.push(`- \`${p}\``);
    lines.push('');
  }

  lines.push('<!-- END -->');
  return lines.join('\n');
}

// ─── Main ─────────────────────────────────────────────────────────────────

function updateOrderJson() {
  const orderPath = join(backendGuideDir, '_order.json');
  let order = { pages: [] };
  if (existsSync(orderPath)) {
    try { order = JSON.parse(readFileSync(orderPath, 'utf-8')); } catch {}
  }
  const newPages = [
    'entity-field-reference',
    'filter-operator-reference',
    'filter-syntax-guide',
    'navigation-map',
  ];
  for (const p of newPages) {
    if (!order.pages.includes(p)) order.pages.push(p);
  }
  writeFileSync(orderPath, JSON.stringify(order, null, 2) + '\n', 'utf-8');
  console.log(`  Updated _order.json: ${order.pages.join(', ')}`);
}

function main() {
  console.log('[generate-reference-docs] Starting...');
  if (!existsSync(beRepoDir)) {
    console.error(`  ! BE repo not cloned at ${beRepoDir}. Run sync-repo-docs.mjs first.`);
    process.exit(1);
  }

  mkdirSync(backendGuideDir, { recursive: true });

  console.log('[generate-reference-docs] Collecting entity metadata...');
  const entityMetas = collectEntityMetas();
  console.log(`  Extracted ${entityMetas.length} entity metas`);

  console.log('[generate-reference-docs] Extracting SqlOperator enum...');
  const operators = extractSqlOperators();
  console.log(`  Found ${operators.length} operators: ${operators.join(', ')}`);

  console.log('[generate-reference-docs] Collecting FE routes...');
  const routes = collectFeRoutes();
  console.log(`  Found ${routes.length} FE routes`);

  console.log('[generate-reference-docs] Generating entity-field-reference.mdx...');
  writeFileSync(
    join(backendGuideDir, 'entity-field-reference.mdx'),
    generateEntityFieldReference(entityMetas) + '\n',
    'utf-8',
  );

  console.log('[generate-reference-docs] Generating filter-operator-reference.mdx...');
  writeFileSync(
    join(backendGuideDir, 'filter-operator-reference.mdx'),
    generateFilterOperatorReference(operators) + '\n',
    'utf-8',
  );

  console.log('[generate-reference-docs] Generating filter-syntax-guide.mdx...');
  writeFileSync(
    join(backendGuideDir, 'filter-syntax-guide.mdx'),
    generateFilterSyntaxGuide(entityMetas, operators) + '\n',
    'utf-8',
  );

  console.log('[generate-reference-docs] Generating navigation-map.mdx...');
  writeFileSync(
    join(backendGuideDir, 'navigation-map.mdx'),
    generateNavigationMap(routes) + '\n',
    'utf-8',
  );

  console.log('[generate-reference-docs] Updating _order.json...');
  updateOrderJson();

  console.log('[generate-reference-docs] Done. 4 reference docs generated.');
}

main();
