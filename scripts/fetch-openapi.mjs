#!/usr/bin/env node
/**
 * Fetch the aggregated OpenAPI spec from the Primebrick backend
 * and save it as apis/openapi.json for the Zudoku build.
 *
 * Usage: node scripts/fetch-openapi.mjs
 * Environment:
 *   OPENAPI_URL — URL of the aggregated spec (default: http://localhost:3001/api/v1/openapi/aggregated.json)
 *
 * If the fetch fails, the existing apis/openapi.json is kept as a fallback.
 */
import { writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const outputPath = join(projectRoot, 'apis', 'openapi.json');

const SPEC_URL = process.env.OPENAPI_URL || 'http://localhost:3001/api/v1/openapi/aggregated.json';

async function main() {
  console.log(`=== Fetching OpenAPI spec from ${SPEC_URL} ===`);

  try {
    const response = await fetch(SPEC_URL, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const spec = await response.json();

    if (!spec.openapi && !spec.swagger) {
      throw new Error('Response is not a valid OpenAPI document (missing openapi/swagger field)');
    }

    writeFileSync(outputPath, JSON.stringify(spec, null, 2), 'utf-8');
    console.log(`Wrote ${outputPath} (${JSON.stringify(spec).length} bytes)`);
    console.log('=== OpenAPI spec fetch complete ===');
  } catch (err) {
    console.warn(`WARNING: Failed to fetch OpenAPI spec: ${err.message}`);
    if (existsSync(outputPath)) {
      console.warn(`         Using existing fallback: ${outputPath}`);
    } else {
      console.warn('         No fallback spec found. The API Explorer will show placeholder content.');
    }
    console.log('=== OpenAPI spec fetch skipped (using fallback) ===');
  }
}

main();
