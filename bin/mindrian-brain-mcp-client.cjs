#!/usr/bin/env node
'use strict';

/**
 * mindrian-brain MCP stdio shim (Phase 127, BRAIN-MCP-127-01)
 *
 * Local stdio MCP server that proxies the 6 canonical Brain tools to the
 * remote Render-hosted Brain via lib/core/brain-client.cjs. Bundled with the
 * plugin via .mcp.json so every new install gets mindrian-brain auto-loaded
 * with zero user wiring beyond MINDRIAN_BRAIN_KEY in env / ~/.mindrian.env.
 *
 * Canon Part 7: ~85% reuse of brain-client.cjs -- this file is JUST a stdio
 * transport wrapper. It contains zero network code; every Brain payload is
 * constructed by brain-client.cjs (which inherits Phase 110 typed-packet
 * enforcement on its typed-job entry; this shim proxies the 6
 * tool-surface entry points which carry only generic methodology handles
 * per Canon Part 8).
 *
 * Canon Part 8: adversarial scan against this file's active code MUST return
 * zero matches for the network-surface token set (delegation property --
 * every network call lives in brain-client.cjs).
 *
 * HARD RULE: no em-dashes anywhere in this file (hyphens only).
 */

const path = require('path');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');

const brainClient = require('../lib/core/brain-client.cjs');
const { wrapDirective } = require('../lib/core/directive-envelope.cjs');
const { tier0Response: chokepointTier0 } = require('../lib/core/tier0-messaging.cjs');

const pluginRoot = path.resolve(__dirname, '..');
const pluginMeta = require('../.claude-plugin/plugin.json');
const version = pluginMeta.version;

// Tier-0 sentinel -- structured DIRECTOR_NOT_AVAILABLE response. Returned by
// the 5 tools that surface raw Brain payloads (query/schema/search/stats/write).
// brain_ask wraps Tier-0 differently (in a DirectiveEnvelope) so Larry's
// surface reads a uniform shape regardless of tier.
//
// Phase 127-02 BRAIN-MCP-127-09 refactor: this is now a one-line passthrough
// to the single chokepoint at lib/core/tier0-messaging.cjs. The local symbol
// is preserved so existing tests + tool closures keep their reference.
// Delegation property: zero duplicate sentinel-shape definition lives here.
function tier0Response(commandContext) {
  return chokepointTier0(commandContext);
}

function asContent(obj) {
  return { content: [{ type: 'text', text: JSON.stringify(obj) }] };
}

const server = new McpServer({ name: 'mindrian-brain', version: version });

// -- brain_ask: highest-level entry; wraps response in DirectiveEnvelope.
server.tool(
  'brain_ask',
  'Natural-language methodology question. Returns a DirectiveEnvelope (default mode: GUIDED) carrying the directive content. Auto-routes Pinecone/Neo4j server-side.',
  { question: z.string().describe('A methodology question (generic framework handles only -- never user artifacts or personal data per Canon Part 8).') },
  async ({ question }) => {
    if (!brainClient.isAvailable()) {
      return asContent(wrapDirective(null, { brain_unreachable: true, command_context: 'brain_ask' }));
    }
    const raw = await brainClient.ask(question);
    if (raw == null) {
      return asContent(wrapDirective(null, { brain_unreachable: true, command_context: 'brain_ask' }));
    }
    const signals = (raw && typeof raw === 'object' && raw.mode_signals) ? raw.mode_signals : {};
    return asContent(wrapDirective(raw, signals));
  }
);

// -- brain_query: raw Cypher (generic methodology handles only).
server.tool(
  'brain_query',
  'Cypher query against the Brain teaching graph. Generic framework handles only (Canon Part 8). Returns { records: [...] } on success.',
  {
    cypher: z.string().describe('Cypher query string.'),
    params: z.record(z.any()).optional().describe('Optional binding map -- generic handles only.'),
  },
  async ({ cypher, params }) => {
    if (!brainClient.isAvailable()) return asContent(tier0Response('brain_query'));
    const r = await brainClient.query(cypher, params);
    return asContent(r == null ? tier0Response('brain_query') : r);
  }
);

// -- brain_schema: cached 30 min in brain-client; passthrough here.
server.tool(
  'brain_schema',
  'Brain Neo4j schema (labels, relationship types, property keys). Memoized 30 minutes.',
  {},
  async () => {
    if (!brainClient.isAvailable()) return asContent(tier0Response('brain_schema'));
    const r = await brainClient.schema();
    return asContent(r == null ? tier0Response('brain_schema') : r);
  }
);

// -- brain_search: semantic via Pinecone (smartSearch handles Neo4j fallback).
server.tool(
  'brain_search',
  'Semantic search across the curriculum graph (Pinecone with Neo4j fulltext fallback).',
  {
    query: z.string().describe('Search query (generic methodology language -- Canon Part 8).'),
    namespace: z.string().optional(),
    topK: z.number().int().min(1).max(50).optional(),
  },
  async ({ query, namespace, topK }) => {
    if (!brainClient.isAvailable()) return asContent(tier0Response('brain_search'));
    const r = await brainClient.smartSearch(query, { namespace: namespace, topK: topK });
    return asContent(r == null ? tier0Response('brain_search') : r);
  }
);

// -- brain_stats: operational stats passthrough.
server.tool(
  'brain_stats',
  'Brain operational stats (Pinecone index size, last-update markers).',
  {},
  async () => {
    if (!brainClient.isAvailable()) return asContent(tier0Response('brain_stats'));
    const r = await brainClient.stats();
    return asContent(r == null ? tier0Response('brain_stats') : r);
  }
);

// -- brain_write: admin-tier; not user-surfaced but proxied for parity.
server.tool(
  'brain_write',
  'Write Cypher to the Brain. Admin-tier; requires a write-capable key. Generic methodology framework writes only (Canon Part 8).',
  { cypher: z.string().describe('Cypher write query (generic methodology only).') },
  async ({ cypher }) => {
    if (!brainClient.isAvailable()) return asContent(tier0Response('brain_write'));
    const r = await brainClient.write(cypher);
    return asContent(r == null ? tier0Response('brain_write') : r);
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write('[mindrian-brain] MCP server v' + version + ' started (stdio)\n');
}

main().catch((err) => {
  process.stderr.write('[mindrian-brain] Fatal: ' + (err && err.message ? err.message : String(err)) + '\n');
  process.exit(1);
});
