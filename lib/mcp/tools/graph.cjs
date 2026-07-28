'use strict';
// Phase 198-04 (SPEC-2, Task 3) -- graph_query / graph_write / memory_event.
//
// graph_query is a read-only wrap of navigation.getNeighborhood (Part 9
// chokepoint). graph_write and memory_event are WRITES: they route
// EXCLUSIVELY through navigation.writeEdge / navigation.logMemoryEvent --
// this module never opens the graph store directly, never requires a native
// database driver, and never mints a second SQL surface (Canon Part 9, R4).
// The ONLY door into the graph from this file is lib/core/navigation.cjs.
//
// D-07 (SUPERSEDED by Phase 234-05, D-05): graph_write / memory_event used to
// be gated at REGISTRATION time behind isMcpFirst(ctx.surface), so when the
// flag was off they were never offered to the client at all. That conflated
// two different concerns and produced RESEARCH.md's Gap D, the "silent one-way
// mirror": on a foreign MCP host the flag defaults off, so the product could
// read the room graph and never record into it, and the model could not even
// SEE that a write tool existed to ask for.
//
// The registration gate could not simply learn about the host, either. The MCP
// SDK only populates getClientVersion() AFTER the initialize handshake, while
// registration runs once inside createServer() before any client connects, on
// every transport this codebase runs. Registration-time host detection is
// structurally impossible, not merely inelegant.
//
// So the gate MOVED: registration is now unconditional (DISCOVERY), and each
// write handler evaluates isWritePathEnabled({surface, clientVersion}) as its
// FIRST statement (PERMISSION). A refused call returns an honest, actionable
// {ok:false, reason:'write_path_disabled', hint} rather than vanishing from
// the catalog. Governance stays server-side in the handler (D-04), which is
// the only enforcement point that holds on a host with no hook channel.
// graph_query is read-only and, as before, always registered.
//
// isMcpFirst is still imported and still used by resolveSessionRoomDir below:
// per-session write-room resolution is a separate D-07 concern from the
// write-path gate, and is deliberately left byte-unchanged.
//
// Canon Part 8: zero Brain/network tokens. Canon Part 9: every write goes
// through navigation.cjs; checkLostUpdate (the Phase 194 CAS reconcile guard)
// is reused, not re-invented, when a caller supplies a read_version.

const { z } = require('zod');

const navigation = require('../../core/navigation.cjs');
const { resolveWriteRoom, resolveActiveRoom } = require('../../core/resolve-active-room.cjs');
const { resolveEffectiveSessionId } = require('../../core/session-binding.cjs');
const { isMcpFirst, isWritePathEnabled } = require('../mcp-first-flag.cjs');

function textResponse(payload, isError) {
  const result = { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
  if (isError) result.isError = true;
  return result;
}

/**
 * Phase 234-05: the live client identity, read PER CALL. The MCP SDK only
 * populates getClientVersion() after the initialize handshake, so this is
 * undefined at registration time and populated by the time any handler runs.
 * Defensive: a server object without the accessor (a test double, an older
 * SDK) degrades to undefined, which floors to the conservative unknown/tier0
 * answer rather than throwing inside a tool call.
 *
 * Same independent-copy discipline as detectClientCapabilities in chain.cjs /
 * gate.cjs / sensors.cjs (tools/*.cjs stays a disjoint-file seam).
 *
 * @param {object} server - the McpServer passed into register()
 * @returns {{name?: string, version?: string}|undefined}
 */
function currentClientVersion(server) {
  try {
    if (server && server.server && typeof server.server.getClientVersion === 'function') {
      return server.server.getClientVersion();
    }
  } catch (_e) {
    // fall through to the conservative floor
  }
  return undefined;
}

/**
 * Phase 234-05 (D-04, D-05): the per-call write gate. Returns null when the
 * call may proceed, or the honest refusal payload when it may not.
 *
 * This is the SERVER-SIDE enforcement point D-04 requires -- no client hook is
 * involved, so it holds identically on a host that has no hook channel at all.
 * The refusal is informative and actionable (T-234-09): the tool is still
 * listed in tools/list, and the caller is told exactly what would enable it.
 *
 * @param {object} server - the McpServer passed into register()
 * @param {{surface?: string}} ctx
 * @returns {object|null}
 */
function writePathRefusal(server, ctx) {
  const clientVersion = currentClientVersion(server);
  if (isWritePathEnabled({ surface: ctx && ctx.surface, clientVersion: clientVersion })) return null;
  return textResponse({
    ok: false,
    reason: 'write_path_disabled',
    hint: 'Set MINDRIAN_MCP_FIRST or connect from a recognized non-Claude-Code host once initialize completes.',
  }, true);
}

/**
 * Resolve THIS session's room. Same D-02/D-04/D-07 precedence as
 * lib/mcp/tools/room.cjs's resolveSessionRoomDir (kept as an independent copy
 * so tools/*.cjs stays a disjoint-file seam per lib/mcp/register-core-tools.cjs
 * -- neither tool module requires the other or lib/mcp/tool-router.cjs).
 *
 * @param {string|undefined} sessionId
 * @param {{fallbackRoomDir: string, surface?: string}} ctx
 * @returns {string}
 */
function resolveSessionRoomDir(sessionId, ctx) {
  const fallback = (ctx && ctx.fallbackRoomDir) || process.cwd();
  try {
    if (isMcpFirst(ctx && ctx.surface)) {
      const r = resolveWriteRoom({ sessionId: sessionId, home: process.env.MINDRIAN_ROOMS_HOME });
      if (r && r.abs_path) return r.abs_path;
    }
    const active = resolveActiveRoom();
    if (active && active.abs_path) return active.abs_path;
  } catch (_e) {
    // fall through to fallback
  }
  return fallback;
}

/**
 * graph_query: read-only neighborhood retrieval through the navigation
 * chokepoint. Resolves the focus node from an explicit nodeId, or from the
 * session's active focus (navigation.getActiveFocus) when nodeId is absent.
 *
 * @param {object} db - a caller-owned graph-store handle (navigation.openRoomDbForCaller)
 * @param {{nodeId?: string, sessionId?: string, maxDepth?: number, topK?: number}} params
 */
async function graphQuery(db, params) {
  const p = params || {};
  let focusNodeId = typeof p.nodeId === 'string' && p.nodeId ? p.nodeId : null;
  if (!focusNodeId && p.sessionId) {
    try {
      const focus = navigation.getActiveFocus(db, p.sessionId);
      focusNodeId = focus && focus.focusNodeId ? focus.focusNodeId : null;
    } catch (_e) {
      focusNodeId = null;
    }
  }
  if (!focusNodeId) {
    return { ok: true, results: [], note: 'No focus node. Pass node_id, or set a session focus first.' };
  }
  const results = navigation.getNeighborhood(db, focusNodeId, {
    maxDepth: p.maxDepth,
    topK: p.topK,
  });
  return { ok: true, focus_node_id: focusNodeId, results };
}

/**
 * graph_write: typed edge write through navigation.writeEdge (the ONLY door).
 * When params.readVersion is supplied, reuses navigation.checkLostUpdate (the
 * Phase 194 CAS reconcile guard) against params.sourceId before writing -- a
 * lost update is rejected as a conflict instead of silently clobbering.
 *
 * @param {object} db - a caller-owned graph-store handle
 * @param {{sourceId: string, targetId: string, edgeType: string, properties?: object, readVersion?: number|null}} params
 */
async function graphWrite(db, params) {
  const p = params || {};
  if (p.readVersion !== undefined && p.readVersion !== null && p.sourceId) {
    const cas = navigation.checkLostUpdate(db, p.sourceId, p.readVersion);
    if (cas.conflict) {
      return { ok: false, reason: 'lost_update_conflict', current_version: cas.currentVersion };
    }
  }
  return navigation.writeEdge(db, {
    source_id: p.sourceId,
    target_id: p.targetId,
    edge_type: p.edgeType,
    properties: p.properties,
  });
}

/**
 * memory_event: append-only observation log through navigation.logMemoryEvent
 * (the ONLY door). Always logs event_type 'mcp_client_event_logged' (the
 * generic external-client bucket, Task 3 additive EVENT_TYPES extension) --
 * an MCP client never gets to pick an internal-semantics event type.
 *
 * @param {object} db - a caller-owned graph-store handle
 * @param {{label: string, payload?: object, dedupeKey?: string}} params
 */
async function memoryEvent(db, params) {
  const p = params || {};
  const body = Object.assign({}, (p.payload && typeof p.payload === 'object') ? p.payload : {}, {
    label: p.label,
  });
  if (typeof p.dedupeKey === 'string' && p.dedupeKey.length > 0) {
    body.dedupe_key = p.dedupeKey;
  }
  return navigation.logMemoryEvent(db, 'mcp_client_event_logged', body);
}

function register(server, ctx) {
  // graph_query -- read-only, registered unconditionally.
  server.tool(
    'graph_query',
    "Read-only graph neighborhood query through the navigation.cjs chokepoint. Resolves the focus node from node_id, or from this session's active focus when node_id is absent.",
    {
      node_id: z.string().min(1).optional()
        .describe('Explicit focus node id. Defaults to this session\'s active focus when absent.'),
      max_depth: z.number().int().min(1).max(5).optional()
        .describe('Max graph traversal depth (default 2).'),
      top_k: z.number().int().min(1).max(100).optional()
        .describe('Max results returned (default 20).'),
    },
    async ({ node_id, max_depth, top_k }, extra) => {
      const sessionId = resolveEffectiveSessionId(undefined, extra);
      const roomDir = resolveSessionRoomDir(sessionId, ctx);
      const db = navigation.openRoomDbForCaller(roomDir);
      if (!db) {
        return textResponse({ ok: false, reason: 'no_room_db', room_dir: roomDir });
      }
      try {
        const result = await graphQuery(db, { nodeId: node_id, sessionId, maxDepth: max_depth, topK: top_k });
        return textResponse(result);
      } finally {
        navigation.closeRoomDbForCaller(db);
      }
    }
  );

  // graph_write / memory_event -- WRITES. Phase 234-05 (D-05, Gap D): both are
  // now ALWAYS registered. The write gate moved from REGISTRATION time
  // (visibility) to CALL time (permission) -- see this file's header for why
  // the old registration-time gate could never see the host.
  server.tool(
    'graph_write',
    'Write a typed edge between two graph nodes. Routes EXCLUSIVELY through navigation.cjs (the single Part 9 chokepoint) -- never opens the graph store directly.',
    {
      source_id: z.string().min(1),
      target_id: z.string().min(1),
      edge_type: z.string().min(1)
        .describe('One of navigation.cjs\'s ALLOWED_EDGE_TYPES (e.g. DEFERRED, REJECTED, INFORMS, FOLLOWS_FROM).'),
      properties: z.record(z.any()).optional(),
      read_version: z.number().nullable().optional()
        .describe('Optional CAS token (last_modified_at) from a prior read of source_id; a lost update is rejected as a conflict instead of silently clobbering.'),
    },
    async ({ source_id, target_id, edge_type, properties, read_version }, extra) => {
      const refused = writePathRefusal(server, ctx);
      if (refused) return refused;
      const sessionId = resolveEffectiveSessionId(undefined, extra);
      const roomDir = resolveSessionRoomDir(sessionId, ctx);
      const db = navigation.openRoomDbForCaller(roomDir);
      if (!db) {
        return textResponse({ ok: false, reason: 'no_room_db', room_dir: roomDir }, true);
      }
      try {
        const result = await graphWrite(db, {
          sourceId: source_id,
          targetId: target_id,
          edgeType: edge_type,
          properties: properties,
          readVersion: read_version,
        });
        return textResponse(result, !result.ok);
      } finally {
        navigation.closeRoomDbForCaller(db);
      }
    }
  );

  server.tool(
    'memory_event',
    'Log an append-only, MCP-client-originated observation. Routes EXCLUSIVELY through navigation.cjs (the single Part 9 chokepoint) -- never opens the graph store directly.',
    {
      label: z.string().min(1).max(200)
        .describe('Short label for this event.'),
      payload: z.record(z.any()).optional()
        .describe('Additional structured fields (generic handles only; never crosses to Brain).'),
      dedupe_key: z.string().max(200).optional()
        .describe('Optional 60s idempotency key (Phase 129-01 dedupe window).'),
    },
    async ({ label, payload, dedupe_key }, extra) => {
      const refused = writePathRefusal(server, ctx);
      if (refused) return refused;
      const sessionId = resolveEffectiveSessionId(undefined, extra);
      const roomDir = resolveSessionRoomDir(sessionId, ctx);
      const db = navigation.openRoomDbForCaller(roomDir);
      if (!db) {
        return textResponse({ ok: false, reason: 'no_room_db', room_dir: roomDir }, true);
      }
      try {
        const result = await memoryEvent(db, { label, payload, dedupeKey: dedupe_key });
        return textResponse(result, !result.ok);
      } finally {
        navigation.closeRoomDbForCaller(db);
      }
    }
  );
}

// Born-wired SOURCE of truth (Part 11 R1/R16). graph_write and memory_event
// mint typed edges / append-only nodes -- a material hitl_shape (F.1, the
// deferred-decision cascade-edge shape already carried by the Phase 125
// DEFERRED/REJECTED edge vocabulary these tools write through). graph_query is
// a pure read (hitl_shape 'none'). scripts/build-connector-registry.cjs
// discovers this export and regenerates data/mcp-tool-connectors.json +
// data/connector-registry.json from it; never hand-edit either generated file.
const connectors = [
  {
    tool: 'graph_query',
    surface: 'graph_query',
    connector: 'mcp-tool',
    hitl_shape: 'none',
    hitl_why: 'Pure read: graph neighborhood retrieval through the navigation.cjs chokepoint, no fork.',
  },
  {
    tool: 'graph_write',
    surface: 'graph_write',
    connector: 'mcp-tool',
    hitl_shape: 'F.1',
    hitl_why: 'Mints a typed graph edge (a cascade decision, the same DEFERRED/REJECTED F.1 vocabulary navigation.cjs already writes) -- a material graph mutation, not a pure read.',
  },
  {
    tool: 'memory_event',
    surface: 'memory_event',
    connector: 'mcp-tool',
    hitl_shape: 'F.1',
    hitl_why: 'Mints an append-only memory_event node recording an external observation -- a material graph write, not a pure read.',
  },
];

module.exports = {
  register,
  connectors,
  graphQuery,
  graphWrite,
  memoryEvent,
  _internal: { resolveSessionRoomDir, currentClientVersion, writePathRefusal },
};
