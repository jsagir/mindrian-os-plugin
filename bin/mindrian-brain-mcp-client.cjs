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
const { ensureDepsPresent, requireWithHeal, beginConnectPathBudget, connectPathRemainingMs } = require('../lib/core/mcp-dep-heal.cjs');
const healLog = (msg) => { try { process.stderr.write(msg + '\n'); } catch (e) { /* swallow */ } };
// Phase 266 Plan 03 (MCPFIX-03): this process is answering a host that is
// already counting down a ~30-second connect timeout, so the heal is bounded
// to CONNECT_PATH_BUDGET_MS instead of the full hook-path budget.
//
// Phase 266 Plan 05 (MCPFIX-03 gap closure): arms ONE process-wide connect
// deadline at the earliest possible moment. Every connectPath:true heal call
// in this file (this ensureDepsPresent and the three requireWithHeal calls
// below) now spends from this ONE shrinking budget. Before Phase 266 Plan 05
// each of those four calls started its own fresh 15000ms clock, for a
// measured worst case of 60296ms, double the host's ~30000ms connect timeout
// the budget exists to respect.
beginConnectPathBudget();
const depHealOutcome = ensureDepsPresent({ log: healLog, connectPath: true });
if (depHealOutcome && depHealOutcome.ok === false) {
  healLog(
    '[mindrian-brain] dependency heal did not complete inside the connect budget (' +
      connectPathRemainingMs() + 'ms left); the requires below will propagate immediately rather than starting a new install'
  );
}

const { McpServer } = requireWithHeal('@modelcontextprotocol/sdk/server/mcp.js', { log: healLog, connectPath: true });
const { StdioServerTransport } = requireWithHeal('@modelcontextprotocol/sdk/server/stdio.js', { log: healLog, connectPath: true });
const { z } = requireWithHeal('zod', { log: healLog, connectPath: true });

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

// Phase 257 (D-03/D-05, LOCUS-01, Task 2) -- maps a raw brainClient result to
// a typed refusal on the two non-success shapes a raw-passthrough tool can
// see: `result == null` (the pre-existing transport-failure contract) and the
// Part 8 sentinel object `{error:'egress_blocked',...}` (a constitutional
// block, distinct from an outage). Zero shape definition lives here (Part 7)
// -- this helper only chooses WHICH chokepoint call to make, mirroring
// tier0Response's one-line delegation immediately above. Any other result
// (success payload, or a sentinel with a different .error) passes through
// unchanged, by identity.
function honestRefusal(result, toolName) {
  if (result == null) return refusalResponse('unreachable', { tool: toolName });
  if (result && typeof result === 'object' && result.error === 'egress_blocked') {
    return refusalResponse('egress_blocked', { tool: toolName, egress_class: result.egress_class });
  }
  return result;
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

// ---------------------------------------------------------------------------
// Phase 257 Plan 08 (D-09, LOCUS-07) -- the undeclared-key smuggling gap.
// Provenance: the Theo consult's GUARD-01
// (/home/jsagi/Theo/src/mcp/register-content-tool.ts, a different repo, read
// only) measured that a plain zod raw-shape input schema silently ACCEPTS an
// undeclared key and drops it before the handler ever sees it -- a call
// carrying {question:'x', roomSecret:'LEAK'} succeeds, the handler receives
// only {question:'x'}, and nothing logs, rejects, or traces the extra field.
// A Part 8 violation the content classifier structurally cannot see, because
// classify() only ever inspects keys the schema declared.
//
// MEASURED THIS PHASE, on this repo's own installed pins (see
// tests/test-257-strict-input-shapes.cjs Arms Z1-Z3): the same gap exists
// here. A strict zod object shape closes it: safeParse rejects with an
// unrecognized_keys issue instead of silently dropping the field.
//
// MEASURED MECHANISM (Arm Z4, do not "simplify" this back to the OLD
// positional registration form). The SDK's positional tool-registration
// overload (name, description, schema, callback) detects its schema
// argument with isZodRawShapeCompat, which returns FALSE for a ZodObject
// instance (a ZodObject is a schema, not a raw shape) -- so passing a strict
// zod object positionally falls into the annotations branch and THROWS
// ("expected a Zod schema or ToolAnnotations, but received an unrecognized
// object"). The config-object registration overload used below (name,
// {description, inputSchema}, callback) routes inputSchema through
// getZodSchemaObject, which returns a ZodObject unchanged -- this is the
// only form that preserves strictness on the pinned SDK, which is why every
// registration in this file was migrated to it.
// ---------------------------------------------------------------------------

// -- brain_ask: highest-level entry; wraps response in DirectiveEnvelope.
server.registerTool(
  'brain_ask',
  {
    description: 'Ask the remote PWS teaching graph a natural-language methodology question. Routing happens server-side over the live Memgraph teaching graph using locally-embedded multilingual-e5-large vectors. Returns a DirectiveEnvelope (default mode: GUIDED) carrying the directive content. Reach for this first for an open methodology question; use brain_search when you already know the topic and want matching nodes directly.',
    inputSchema: z.strictObject({ question: z.string().describe('A methodology question (generic framework handles only -- never user artifacts or personal data per Canon Part 8).') }),
  },
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
    // Phase 257 (D-03, LOCUS-01, G1) -- THE MEASURED DEFECT. brainClient.ask()
    // can also resolve to the Part 8 sentinel OBJECT
    // {error:'egress_blocked', tool:'brain_ask', egress_class:...} -- which is
    // NOT null, so before this branch existed control fell all the way through
    // to `wrapDirective(raw, signals)` below and rendered a well-formed EMPTY
    // DirectiveEnvelope with no trace of the block: the words 'egress_blocked',
    // 'error' and 'content_set' appeared nowhere in what the model received.
    // The sentinel is deliberately an OBJECT rather than null
    // (lib/core/brain-client.cjs:576-580) precisely so a constitutional
    // refusal can never be confused with a transport outage -- this branch is
    // the honest-refusal idiom for that object, cloned from the `raw == null`
    // branch immediately above. CRITICAL: signals must NOT carry the
    // transport-outage flag the branch above sets -- that would re-create the
    // exact refusal-versus-outage conflation this branch exists to fix, one
    // layer up in the signals plane. Only `tool` and `egress_class` cross
    // into refusalResponse; the question text is never echoed.
    if (raw && typeof raw === 'object' && raw.error === 'egress_blocked') {
      const refusal = refusalResponse('egress_blocked', { tool: 'brain_ask', egress_class: raw.egress_class });
      return asContent(wrapDirective({
        directive: { guided: { questions: [], framework: null, stage: 'tier_0_' + refusal.kind } },
        next_gate: { sub_shape: 'F.1', options: refusal.next_moves.slice() },
        refusal: refusal,
      }, { command_context: 'brain_ask' }));
    }
    const signals = (raw && typeof raw === 'object' && raw.mode_signals) ? raw.mode_signals : {};
    return asContent(wrapDirective(raw, signals));
  }
);

// -- brain_query: raw Cypher (generic methodology handles only).
// NOTE: strictness applies at the TOP level only, to reject undeclared
// sibling keys of cypher/params. `params` itself stays z.record(z.any()) --
// it is a Cypher binding map whose keys are legitimately arbitrary. Do NOT
// make params strict internally; that would break legitimate bindings.
server.registerTool(
  'brain_query',
  {
    description: 'Cypher query against the Brain teaching graph. Generic framework handles only (Canon Part 8). Returns { records: [...] } on success.',
    inputSchema: z.strictObject({
      cypher: z.string().describe('Cypher query string.'),
      params: z.record(z.any()).optional().describe('Optional binding map -- generic handles only.'),
    }),
  },
  async ({ cypher, params }) => {
    if (!(await brainClient.ensureAvailable())) return asContent(tier0Response('brain_query'));
    const r = await brainClient.query(cypher, params);
    // Phase 257 (D-05, G2, ACCEPTED GAP): query()'s null-return contract is
    // NOT changed by this phase. query() returns null on a Part 8 block at
    // lib/core/brain-client.cjs:884, BEFORE callTool() ever runs, so this
    // call site can never see the egress_blocked sentinel -- honestRefusal()
    // is a deliberate no-op on the block path here, always taking the
    // `result == null` -> 'unreachable' branch. This conflation (a block
    // reported as an outage) is a KNOWN and ACCEPTED gap for this phase,
    // pinned by roughly 82 degradation tests keyed on query()'s null
    // contract and by Plan 07's own invariant test so it cannot drift
    // silently. See docs/257-NOTE-part8-enforcement-locus-rulings.md section 3.
    return asContent(honestRefusal(r, 'brain_query'));
  }
);

// -- brain_schema: cached 30 min in brain-client; passthrough here.
server.registerTool(
  'brain_schema',
  {
    description: 'Reports the teaching graph schema: labels, relationship types and property keys from the live Memgraph backend. Memoized for 30 minutes.',
    inputSchema: z.strictObject({}),
  },
  async () => {
    if (!(await brainClient.ensureAvailable())) return asContent(tier0Response('brain_schema'));
    const r = await brainClient.schema();
    return asContent(honestRefusal(r, 'brain_schema'));
  }
);

// -- brain_search: semantic via locally-embedded e5 vectors, with a graph
// fulltext fallback (smartSearch handles the fallback branch).
server.registerTool(
  'brain_search',
  {
    description: 'Runs semantic search over the teaching graph using locally-embedded multilingual-e5-large vectors, with a graph fulltext fallback when the vector search comes up empty.',
    inputSchema: z.strictObject({
      query: z.string().describe('Search query (generic methodology language -- Canon Part 8).'),
      namespace: z.string().optional(),
      topK: z.number().int().min(1).max(50).optional(),
    }),
  },
  async ({ query, namespace, topK }) => {
    if (!(await brainClient.ensureAvailable())) return asContent(tier0Response('brain_search'));
    const r = await brainClient.smartSearch(query, { namespace: namespace, topK: topK });
    return asContent(honestRefusal(r, 'brain_search'));
  }
);

// -- brain_stats: operational stats passthrough.
server.registerTool(
  'brain_stats',
  {
    description: 'Reports teaching-graph size and coverage counts, plus last-update markers, from the live Memgraph backend.',
    inputSchema: z.strictObject({}),
  },
  async () => {
    if (!(await brainClient.ensureAvailable())) return asContent(tier0Response('brain_stats'));
    const r = await brainClient.stats();
    return asContent(honestRefusal(r, 'brain_stats'));
  }
);

// -- brain_write: admin-tier; not user-surfaced but proxied for parity.
server.registerTool(
  'brain_write',
  {
    description: 'Write Cypher to the Brain. Admin-tier; requires a write-capable key. Generic methodology framework writes only (Canon Part 8).',
    inputSchema: z.strictObject({ cypher: z.string().describe('Cypher write query (generic methodology only).') }),
  },
  async ({ cypher }) => {
    if (!(await brainClient.ensureAvailable())) return asContent(tier0Response('brain_write'));
    const r = await brainClient.write(cypher);
    return asContent(honestRefusal(r, 'brain_write'));
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
