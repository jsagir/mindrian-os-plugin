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

// -- Dependency self-heal (Option D, debug session
// mcp-servers-cache-missing-node-modules). `claude plugin update` can land a
// fresh plugin cache with NO node_modules; on the first post-update session
// this MCP server may spawn before the SessionStart reconcile hook finishes its
// npm install. mcp-dep-heal.cjs + npm-install-lock.cjs are pure node-built-in
// modules (safe to require with node_modules absent). ensureDepsPresent runs a
// guarded one-shot `npm install` if node_modules is missing/incomplete BEFORE
// the SDK/zod requires below; requireWithHeal is the per-require backstop.
const { ensureDepsPresent, requireWithHeal } = require('../lib/core/mcp-dep-heal.cjs');
const healLog = (msg) => { try { process.stderr.write(msg + '\n'); } catch (e) { /* swallow */ } };
ensureDepsPresent({ log: healLog });

const { McpServer } = requireWithHeal('@modelcontextprotocol/sdk/server/mcp.js', { log: healLog });
const { StdioServerTransport } = requireWithHeal('@modelcontextprotocol/sdk/server/stdio.js', { log: healLog });
const { z } = requireWithHeal('zod', { log: healLog });

const brainClient = require('../lib/core/brain-client.cjs');
const { wrapDirective } = require('../lib/core/directive-envelope.cjs');
const { tier0Response: chokepointTier0, refusalResponse } = require('../lib/core/refusal-messaging.cjs');

const pluginRoot = path.resolve(__dirname, '..');
const pluginMeta = require('../.claude-plugin/plugin.json');
const version = pluginMeta.version;

// Tier-0 sentinel -- structured DIRECTOR_NOT_AVAILABLE response. Returned by
// the 5 tools that surface raw Brain payloads (query/schema/search/stats/write).
// brain_ask wraps Tier-0 differently (in a DirectiveEnvelope) so Larry's
// surface reads a uniform shape regardless of tier.
//
// Phase 127-02 BRAIN-MCP-127-09 refactor: this is now a one-line passthrough
// to the single chokepoint at lib/core/refusal-messaging.cjs (renamed from
// tier0-messaging.cjs in Phase 252-01, SWEEP-01). The local symbol
// is preserved so existing tests + tool closures keep their reference.
// Delegation property: zero duplicate sentinel-shape definition lives here.
function tier0Response(commandContext) {
  return chokepointTier0(commandContext);
}

function asContent(obj) {
  return { content: [{ type: 'text', text: JSON.stringify(obj) }] };
}

// Phase 250-04 (HONEST-03, SEED-011 Option A): every gate below awaits
// brainClient.ensureAvailable() instead of calling the synchronous
// isAvailable(). This IS the "first Brain consult" seam -- Larry's native
// MCP tool calls in Claude Code CLI chat route through THIS shim (Desktop
// and Cowork reach the remote pws-brain-mcp MCP server directly and are
// unaffected), so without this change silent registration would only ever
// fire for direct brain-client.cjs consumers (e.g. /mos: command scripts),
// never for the primary chat-driven consult path. ensureAvailable() is a
// pure passthrough to isAvailable() when a key already resolves (fast,
// no network); it only awaits a mint attempt when the ladder is empty.
const server = new McpServer({ name: 'mindrian-brain', version: version });

// -- brain_ask: highest-level entry; wraps response in DirectiveEnvelope.
server.tool(
  'brain_ask',
  'Natural-language methodology question. Returns a DirectiveEnvelope (default mode: GUIDED) carrying the directive content. Auto-routes Pinecone/Neo4j server-side.',
  { question: z.string().describe('A methodology question (generic framework handles only -- never user artifacts or personal data per Canon Part 8).') },
  async ({ question }) => {
    if (!(await brainClient.ensureAvailable())) {
      // Keyless path unchanged (127-02 sentinel, byte-locked).
      return asContent(wrapDirective(null, { brain_unreachable: true, command_context: 'brain_ask' }));
    }
    const raw = await brainClient.ask(question);
    if (raw == null) {
      // Phase 250-01 (HONEST-01, site #9 conflation fix): a VALID-key
      // transport failure is honestly distinct from the keyless case above --
      // wrap refusalResponse('unreachable', ...) in the SAME wrapDirective
      // envelope mechanism via its typed-directive pass-through, so the
      // envelope carries kind='unreachable' and an honest reason instead of
      // silently reusing the keyless tier0 sentinel shape.
      const refusal = refusalResponse('unreachable', { tool: 'brain_ask' });
      return asContent(wrapDirective({
        directive: { guided: { questions: [], framework: null, stage: 'tier_0_' + refusal.kind } },
        next_gate: { sub_shape: 'F.1', options: refusal.next_moves.slice() },
        refusal: refusal,
      }, { brain_unreachable: true, command_context: 'brain_ask' }));
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
    if (!(await brainClient.ensureAvailable())) return asContent(tier0Response('brain_query'));
    const r = await brainClient.query(cypher, params);
    return asContent(r == null ? refusalResponse('unreachable', { tool: 'brain_query' }) : r);
  }
);

// -- brain_schema: cached 30 min in brain-client; passthrough here.
server.tool(
  'brain_schema',
  'Brain Neo4j schema (labels, relationship types, property keys). Memoized 30 minutes.',
  {},
  async () => {
    if (!(await brainClient.ensureAvailable())) return asContent(tier0Response('brain_schema'));
    const r = await brainClient.schema();
    return asContent(r == null ? refusalResponse('unreachable', { tool: 'brain_schema' }) : r);
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
    if (!(await brainClient.ensureAvailable())) return asContent(tier0Response('brain_search'));
    const r = await brainClient.smartSearch(query, { namespace: namespace, topK: topK });
    return asContent(r == null ? refusalResponse('unreachable', { tool: 'brain_search' }) : r);
  }
);

// -- brain_stats: operational stats passthrough.
server.tool(
  'brain_stats',
  'Brain operational stats (Pinecone index size, last-update markers).',
  {},
  async () => {
    if (!(await brainClient.ensureAvailable())) return asContent(tier0Response('brain_stats'));
    const r = await brainClient.stats();
    return asContent(r == null ? refusalResponse('unreachable', { tool: 'brain_stats' }) : r);
  }
);

// -- brain_write: admin-tier; not user-surfaced but proxied for parity.
server.tool(
  'brain_write',
  'Write Cypher to the Brain. Admin-tier; requires a write-capable key. Generic methodology framework writes only (Canon Part 8).',
  { cypher: z.string().describe('Cypher write query (generic methodology only).') },
  async ({ cypher }) => {
    if (!(await brainClient.ensureAvailable())) return asContent(tier0Response('brain_write'));
    const r = await brainClient.write(cypher);
    return asContent(r == null ? refusalResponse('unreachable', { tool: 'brain_write' }) : r);
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
