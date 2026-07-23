#!/usr/bin/env node
/**
 * Extract OpenAPI specs from shallow-cloned repos in .tmp-repo-sync/
 * and write them as JSON files to apis/.
 *
 * Also generates src/generated-apis.ts with Zudoku API Catalog config.
 *
 * MUST run AFTER sync-repo-docs.mjs (which clones repos to .tmp-repo-sync/).
 * This script leaves .tmp-repo-sync/ intact for downstream scripts (compliance scanner).
 *
 * Usage: node scripts/fetch-openapi.mjs
 *
 * Output:
 *   apis/system.json       — BE (system brick) OpenAPI spec
 *   apis/<service>.json    — One per microservice with an exported OpenAPI spec
 *   src/generated-apis.ts  — Zudoku apis config array for API Catalog
 */
import { execSync } from 'node:child_process';
import {
  mkdirSync,
  rmSync,
  writeFileSync,
  existsSync,
  readdirSync,
  readFileSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const tmpDir = join(projectRoot, '.tmp-repo-sync');
const apisDir = join(projectRoot, 'apis');
const generatedDir = join(projectRoot, 'src');

// ─── Helpers ───────────────────────────────────────────────

/**
 * Use tsx to import a TypeScript file and extract an exported value as JSON.
 * Writes a temp .ts extractor, runs it with npx tsx, captures stdout.
 *
 * @param {string} tsFilePath — Absolute path to the .ts file
 * @param {string} exportName — Name of the exported const
 * @returns {object|null} — Parsed JSON or null if extraction failed
 */
function extractSpecViaTsx(tsFilePath, exportName) {
  // Write extractor to project root (not .tmp-repo-sync/) so relative imports work
  const extractorPath = join(projectRoot, '_extract-spec.ts');
  // Use relative path from project root for the import
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
    const stderr = err.stderr?.toString() || err.message;
    if (stderr.includes('does not provide an export named')) {
      console.warn(`  WARNING: "${exportName}" is not exported from ${tsFilePath}`);
      console.warn('           Add "export" to the const in the source repo.');
    } else {
      // Log first 3 lines of stderr for debugging
      const lines = stderr.split('\n').filter((l) => l.trim()).slice(0, 3);
      console.warn(`  WARNING: Failed to extract spec from ${tsFilePath}`);
      lines.forEach((l) => console.warn(`           ${l}`));
    }
    return null;
  } finally {
    rmSync(extractorPath, { force: true });
  }
}

/**
 * Scan microservices repo for subdirectories with openapi-route.ts files.
 */
function findMicroserviceSpecs() {
  const microservicesDir = join(tmpDir, 'microservices');
  if (!existsSync(microservicesDir)) return [];

  const specs = [];
  const entries = readdirSync(microservicesDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const openapiRoutePath = join(microservicesDir, entry.name, 'src', 'server', 'openapi-route.ts');
    if (!existsSync(openapiRoutePath)) continue;

    specs.push({ serviceCode: entry.name, routePath: openapiRoutePath });
  }

  return specs;
}

// ─── Main ──────────────────────────────────────────────────

console.log('=== OpenAPI spec extraction started ===');

if (!existsSync(tmpDir)) {
  console.error('ERROR: .tmp-repo-sync/ not found. Run sync-repo-docs.mjs first.');
  console.log('=== OpenAPI spec extraction aborted ===');
  process.exit(1);
}

// Prepare apis/ directory
rmSync(apisDir, { recursive: true, force: true });
mkdirSync(apisDir, { recursive: true });

const extractedApis = [];

// ── 1. Extract BE (system brick) spec ──
console.log('Extracting BE (system) OpenAPI spec...');
const beOpenapiPath = join(tmpDir, 'backend', 'src', 'openapi', 'openapi.ts');

if (existsSync(beOpenapiPath)) {
  const spec = extractSpecViaTsx(beOpenapiPath, 'openapi');
  if (spec) {
    // Split MCP endpoints into a separate spec
    const mcpPaths = {};
    const systemPaths = {};
    const mcpSchemaNames = new Set();
    for (const [path, methods] of Object.entries(spec.paths)) {
      let isMcp = false;
      for (const [method, op] of Object.entries(methods)) {
        if (op.tags && (op.tags.includes('MCP') || op.tags.includes('MCP OAuth'))) {
          isMcp = true;
          if (op.requestBody?.content) {
            for (const ct of Object.values(op.requestBody.content)) {
              if (ct.schema?.$ref) mcpSchemaNames.add(ct.schema.$ref.split('/').pop());
            }
          }
          if (op.responses) {
            for (const resp of Object.values(op.responses)) {
              if (resp.content) {
                for (const ct of Object.values(resp.content)) {
                  if (ct.schema?.$ref) mcpSchemaNames.add(ct.schema.$ref.split('/').pop());
                }
              }
            }
          }
        }
      }
      if (isMcp) {
        mcpPaths[path] = methods;
      } else {
        systemPaths[path] = methods;
      }
    }

    // Build MCP-specific schemas
    const mcpSchemas = {};
    for (const name of mcpSchemaNames) {
      if (spec.components?.schemas?.[name]) {
        mcpSchemas[name] = spec.components.schemas[name];
      }
    }

    // Write system.json (without MCP endpoints)
    spec.paths = systemPaths;
    spec.tags = (spec.tags || []).filter(t => t.name !== 'MCP' && t.name !== 'MCP OAuth');
    if (spec.components?.schemas) {
      for (const name of mcpSchemaNames) {
        delete spec.components.schemas[name];
      }
    }
    const systemFile = join(apisDir, 'system.json');
    writeFileSync(systemFile, JSON.stringify(spec, null, 2), 'utf-8');
    console.log(`  Wrote ${systemFile} (${JSON.stringify(spec).length} bytes)`);
    extractedApis.push({
      file: './apis/system.json',
      path: '/catalog/system',
      label: spec.info.title,
      categories: [{ label: 'System Brick', tags: ['Backend', 'Core'] }],
    });

    // Write mcp.json (MCP endpoints only)
    const mcpSpec = {
      openapi: spec.openapi,
      info: {
        title: 'MCP Catalog',
        version: '1.0.0',
        description: 'Model Context Protocol (MCP) server for Primebrick. AI clients (Claude, ChatGPT, Cursor, VS Code) connect to the MCP endpoint to access Primebrick tools for entity CRUD, discovery, and service management. OAuth 2.1 authentication with RFC 9728, RFC 8414, and RFC 7591 support.'
      },
      servers: spec.servers,
      security: spec.security,
      tags: [
        { name: 'MCP', description: 'Model Context Protocol server endpoint for AI client integration' },
        { name: 'MCP OAuth', description: 'OAuth 2.1 endpoints for MCP server authentication (RFC 9728, RFC 8414, RFC 7591)' }
      ],
      paths: mcpPaths,
      components: {
        securitySchemes: spec.components?.securitySchemes || {},
        schemas: mcpSchemas
      }
    };
    const mcpFile = join(apisDir, 'mcp.json');
    writeFileSync(mcpFile, JSON.stringify(mcpSpec, null, 2), 'utf-8');
    console.log(`  Wrote ${mcpFile} (${JSON.stringify(mcpSpec).length} bytes)`);
    extractedApis.push({
      file: './apis/mcp.json',
      path: '/catalog/mcp',
      label: mcpSpec.info.title,
      categories: [{ label: 'System Brick', tags: ['MCP', 'AI'] }],
    });
  }
} else {
  console.warn('  WARNING: BE openapi.ts not found at expected path');
}

// ── 2. Extract microservice specs ──
console.log('Scanning microservices for OpenAPI specs...');
const microserviceSpecs = findMicroserviceSpecs();

if (microserviceSpecs.length === 0) {
  console.warn('  No microservices with openapi-route.ts found');
}

for (const { serviceCode, routePath } of microserviceSpecs) {
  console.log(`Extracting spec for microservice: ${serviceCode}...`);

  // Try to import OPENAPI_SPEC (requires export to be added in the source repo)
  const spec = extractSpecViaTsx(routePath, 'OPENAPI_SPEC');
  if (spec) {
    const outFile = join(apisDir, `${serviceCode}.json`);
    writeFileSync(outFile, JSON.stringify(spec, null, 2), 'utf-8');
    console.log(`  Wrote ${outFile} (${JSON.stringify(spec).length} bytes)`);

    // Use the spec's info.title as the label (same source as catalog card)
    const label = spec.info?.title || serviceCode;

    extractedApis.push({
      file: `./apis/${serviceCode}.json`,
      path: `/catalog/${serviceCode}`,
      label,
      categories: [{ label: 'Microservices', tags: [label, 'Brick'] }],
    });
  }
}

// ── 3. Fallback: write placeholder if nothing was extracted ──
if (extractedApis.length === 0) {
  console.warn('WARNING: No specs extracted. Writing placeholder.');
  const placeholder = {
    openapi: '3.0.0',
    info: {
      title: 'Primebrick API (placeholder)',
      version: '0.0.0',
      description: 'No OpenAPI specs could be extracted. Ensure repos are accessible and exports are added.',
    },
    paths: {},
  };
  writeFileSync(join(apisDir, 'system.json'), JSON.stringify(placeholder, null, 2), 'utf-8');
  extractedApis.push({
    file: './apis/system.json',
    path: '/catalog/system',
    label: placeholder.info.title,
    categories: [{ label: 'System Brick', tags: ['Backend', 'Core'] }],
  });
}

// ── 4. Generate src/generated-apis.ts ──
console.log('Generating src/generated-apis.ts...');

const apisCode = `// AUTO-GENERATED by scripts/fetch-openapi.mjs — DO NOT EDIT MANUALLY.
// Regenerated on every build via: node scripts/fetch-openapi.mjs

import type { ZudokuConfig } from "zudoku";

export const generatedApis: ZudokuConfig["apis"] = [
${extractedApis
  .map(
    (api) => `  {
    type: "file",
    input: "${api.file}",
    path: "${api.path}",
    label: ${JSON.stringify(api.label)},
    options: {
      disableSecurity: false,
      expandAllTags: true,
      showInfoPage: true,
      examplesLanguage: "js",
      schemaDownload: {
        enabled: true,
        fileName: "primebrick-${api.path.split('/').pop()}",
      },
    },
    categories: ${JSON.stringify(api.categories, null, 6).replace(/^/gm, '    ').trimStart()},
  },`,
  )
  .join('\n')}
];
`;

mkdirSync(generatedDir, { recursive: true });
writeFileSync(join(generatedDir, 'generated-apis.ts'), apisCode, 'utf-8');
console.log(`  Wrote src/generated-apis.ts (${extractedApis.length} API entries)`);

// ── 5. Leave .tmp-repo-sync/ for the compliance scanner ──
// Previously cleaned up here, but the compliance scanner runs after this
// script and needs the shallow-cloned repos. Cleanup is handled by the
// CI workflow's final step or by sync-repo-docs.mjs on its next run
// (it does a fresh clone anyway).
console.log('Left .tmp-repo-sync/ for downstream scripts (compliance scanner)');

console.log(`=== OpenAPI spec extraction complete (${extractedApis.length} specs) ===`);
