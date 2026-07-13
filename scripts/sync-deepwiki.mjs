#!/usr/bin/env node
/**
 * Sync DeepWiki content to Zudoku docs pages.
 * Uses read_wiki_contents (instant, returns full pre-generated wiki).
 *
 * Usage: node scripts/sync-deepwiki.mjs
 * Requires: DEVIN_API_KEY environment variable
 *
 * Output: pages/<repo>/deepwiki/*.md
 */
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

const REPOS = [
  { name: 'michaelsogos/primebrick-v3-backend', slug: 'backend', dir: 'pages/backend/deepwiki' },
  { name: 'michaelsogos/primebrick-v3-frontend', slug: 'frontend', dir: 'pages/frontend/deepwiki' },
  { name: 'michaelsogos/primebrick-v3-microservices', slug: 'microservices', dir: 'pages/microservices/deepwiki' },
  { name: 'michaelsogos/primebrick-v3-dal', slug: 'dal', dir: 'pages/dal/deepwiki' },
  { name: 'michaelsogos/primebrick-v3-sdk', slug: 'sdk', dir: 'pages/sdk/deepwiki' },
];

const API_KEY = process.env.DEVIN_API_KEY;
if (!API_KEY) {
  console.warn('WARNING: DEVIN_API_KEY not set — skipping DeepWiki sync.');
  console.warn('         Set it as a GitHub Actions secret to enable DeepWiki sync.');
  console.warn('         Only in-repo docs will be synced. DeepWiki content will be missing.');
  process.exit(0);
}

const MCP_URL = 'https://mcp.devin.ai/mcp';

/**
 * Call a Devin MCP tool via Streamable HTTP.
 */
async function callMcpTool(toolName, args) {
  const baseHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
    'Authorization': `Bearer ${API_KEY}`,
  };

  // Initialize
  const initResponse = await fetch(MCP_URL, {
    method: 'POST',
    headers: baseHeaders,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'primebrick-docs-sync', version: '1.0.0' },
      },
    }),
  });

  if (!initResponse.ok) {
    throw new Error(`MCP initialize failed: ${initResponse.status} ${initResponse.statusText}`);
  }

  const sessionId = initResponse.headers.get('Mcp-Session-Id');
  const headers = { ...baseHeaders };
  if (sessionId) headers['Mcp-Session-Id'] = sessionId;

  // Send initialized notification
  await fetch(MCP_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
  });

  // Call the tool
  const toolResponse = await fetch(MCP_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: toolName, arguments: args },
    }),
  });

  if (!toolResponse.ok) {
    const errorText = await toolResponse.text();
    throw new Error(`MCP tool call failed: ${toolResponse.status} ${errorText}`);
  }

  // Response may be SSE or plain JSON
  const contentType = toolResponse.headers.get('content-type') || '';
  let result;
  if (contentType.includes('text/event-stream')) {
    const text = await toolResponse.text();
    const dataLines = text.split('\n').filter(l => l.startsWith('data:'));
    const lastData = dataLines[dataLines.length - 1]?.slice(5).trim();
    result = JSON.parse(lastData);
  } else {
    result = await toolResponse.json();
  }

  if (result.error) {
    throw new Error(`MCP error: ${JSON.stringify(result.error)}`);
  }

  const content = result.result?.content;
  if (Array.isArray(content)) {
    for (const item of content) {
      if (item.type === 'text') return item.text;
    }
  }
  return JSON.stringify(result.result);
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Parse read_wiki_contents response into separate pages.
 * The response uses "# Page: <Title>" as page separators.
 * Returns array of { title, content }.
 */
function parseWikiPages(text) {
  const pages = [];
  const sections = text.split(/^# Page:\s+/m);

  for (const section of sections) {
    if (!section.trim()) continue;

    const newlineIdx = section.indexOf('\n');
    if (newlineIdx < 0) continue;

    const title = section.slice(0, newlineIdx).trim();
    const content = section.slice(newlineIdx + 1).trim();

    if (title && content) {
      pages.push({ title, content });
    }
  }

  return pages;
}

async function syncRepo(repo) {
  const targetDir = join(projectRoot, repo.dir);
  rmSync(targetDir, { recursive: true, force: true });
  mkdirSync(targetDir, { recursive: true });

  const timestamp = new Date().toISOString();

  let wikiText;
  try {
    console.log(`  Fetching wiki contents for ${repo.name}...`);
    wikiText = await callMcpTool('read_wiki_contents', { repoName: repo.name });
  } catch (err) {
    console.error(`  Failed to fetch wiki for ${repo.name}: ${err.message}`);
    console.error(`  Skipping — visit https://app.devin.ai/wiki/${repo.name} to check wiki status.`);
    return;
  }

  const pages = parseWikiPages(wikiText);

  if (pages.length === 0) {
    // Fallback: write the entire response as a single file
    console.warn(`  No page markers found — writing single file.`);
    writeFileSync(join(targetDir, '_full.md'), `---
title: "${repo.slug} — Full DeepWiki"
source: deepwiki
repo: "${repo.name}"
last_synced_at: "${timestamp}"
---

${wikiText}
`, 'utf-8');
    console.log(`  Wrote 1 file to ${repo.dir}`);
    return;
  }

  let pagesWritten = 0;
  for (const page of pages) {
    const slug = slugify(page.title);
    const md = `---
title: "${page.title.replace(/"/g, '\\"')}"
source: deepwiki
repo: "${repo.name}"
deepwiki_page: "${page.title.replace(/"/g, '\\"')}"
last_synced_at: "${timestamp}"
---

${page.content}
`;
    writeFileSync(join(targetDir, `${slug}.md`), md, 'utf-8');
    pagesWritten++;
  }

  console.log(`  Wrote ${pagesWritten} pages to ${repo.dir}`);
}

// Main
console.log('=== DeepWiki sync started ===');

for (const repo of REPOS) {
  console.log(`Syncing ${repo.name}...`);
  try {
    await syncRepo(repo);
  } catch (err) {
    console.error(`Failed to sync ${repo.name}: ${err.message}`);
  }
}

console.log('=== DeepWiki sync complete ===');
