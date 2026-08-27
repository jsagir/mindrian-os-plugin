'use strict';
// Phase 270-10 Task 3 (MEMOP-07/MEMOP-13) -- graph_reason, the operator's own
// genuinely graph-native Tool.
//
// `graph_query` (lib/mcp/tools/graph.cjs) is a bare getNeighborhood wrapper
// and is already thin (RESEARCH.md 3.3's own closing line: do not re-expose
// it under a new name and call that graph-native). This tool exposes TWO
// reads a flat tree or a KV store structurally could not answer:
//
//   transitive_support           -- a claim's support closure through
//     intermediate nodes (navigation.findTransitiveSupport, the recursive
//     CTE upgrade of findUnsupportedClaims's single-hop NOT EXISTS check).
//   nearest_sub_room_decisions   -- structural-distance ranking of decision
//     nodes ACROSS a room.db boundary (icm-forest.cjs::findNearestSubRoomDecisions,
//     the second read-only consumer of rollupSubRooms).
//
// Re-exposing getNeighborhood under a new name here would not be graph-native,
// only renamed -- this file never calls it directly (see the grep-checkable
// note at the bottom of the handler below).
//
// ONE tool with a bounded mode enum, not three tools. RESEARCH.md 2.3
// established that the number and size of registered tool descriptions is
// the ONLY token lever this repo has, so three near-identical schemas would
// work directly against this phase's own goal. Pitfall P1 (tool-router.cjs's
// z.enum anti-pattern) is specifically an enum spanning a MIX of 'none' and
// F.* hitl_shape operations, losing per-operation safety tracking. This mode
// enum is NOT that: every mode here is a pure read with hitl_shape 'none', so
// there is no material operation hiding behind the dispatch for tracking to
// lose. That distinction -- reusing the one-tool-many-modes SHAPE while never
// inheriting the shape-tracking GAP -- is the whole point of building this as
// one tool rather than three.
//
// point_in_time / queryAsOf (RESEARCH.md 3.3 candidate 3) is DELIBERATELY
// DEFERRED, not silently omitted (see this plan's SUMMARY for the recorded
// decision): queryAsOf(db, nodeKey, T_tx, T_v) is a single-node bitemporal
// point lookup, not a graph traversal, and needs its own (nodeKey, T_tx, T_v)
// parameter shape unrelated to this schema's node/depth/result-count fields --
// bolting it on would bloat the schema for a capability that is not "multi-hop",
// the theme this tool exists to add. It already has a navigation.cjs
// re-export with zero MCP surface (queryAsOf: pointInTime.queryAsOf) and is
// better served by its own small tool in a later phase.
//
// Canon Part 8: every read goes through the navigation.cjs chokepoint; zero
// Brain calls, zero network calls. No em-dashes. CJS only.

const { z } = require('zod');

const navigation = require('../../core/navigation.cjs');
const { resolveEffectiveSessionId } = require('../../core/session-binding.cjs');
const { resolveSessionRoomDir } = require('../session-room.cjs');

function textResponse(payload, isError) {
  const result = { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
  if (isError) result.isError = true;
  return result;
}

function register(server, ctx) {
  server.tool(
    'graph_reason',
    'Multi-hop graph reads a flat tree or a plain lookup cannot express. Mode transitive_support traces whether a claim is supported directly, only transitively through intermediate nodes, or not at all -- prefer it over graph_query when the question is "supported how, through what chain," not "what is adjacent." Mode nearest_sub_room_decisions ranks a room\'s sub-rooms by which one\'s decisions sit structurally nearest a focus node, crossing the room.db boundary read-only. Every mode is a pure read; it never writes a node or an edge.',
    {
      mode: z.enum(['transitive_support', 'nearest_sub_room_decisions'])
        .describe('Which graph-native read to run.'),
      node_id: z.string().min(1).optional()
        .describe('The focus node id. Required for transitive_support. Optional for nearest_sub_room_decisions (falls back to room-tree distance alone when absent).'),
      max_depth: z.number().int().min(1).max(5).optional()
        .describe('Cascade bound for transitive_support (default 5, the same bound findBlockingAssumptions uses). Unused by nearest_sub_room_decisions.'),
      max_results: z.number().int().min(1).max(50).optional()
        .describe('Max results for nearest_sub_room_decisions (default 10, hard-capped server-side regardless of this value). Unused by transitive_support.'),
    },
    async ({ mode, node_id, max_depth, max_results }, extra) => {
      if (mode === 'transitive_support' && (typeof node_id !== 'string' || node_id.length === 0)) {
        return textResponse({ ok: false, reason: 'missing_node_id', mode: mode });
      }

      const sessionId = resolveEffectiveSessionId(undefined, extra);
      const roomDir = resolveSessionRoomDir(sessionId, ctx);

      // The two modes take asymmetric inputs, and that asymmetry is
      // deliberate, not an inconsistency: transitive_support runs a single
      // recursive SELECT over an already-open db handle (the ordinary Part 9
      // shape every other read tool in this file uses). nearest_sub_room_
      // decisions instead takes a room DIRECTORY, because it manages its OWN
      // cross-room ATTACH lifecycle end to end via rollupSubRooms (open,
      // ATTACH each child read-only, DETACH, close) -- handing it an
      // already-open handle would not fit that lifecycle, and opening a
      // second db handle here just to hand it over unused would be pointless.
      // Both modes still close everything they open, in a finally, below.
      const db = navigation.openRoomDbForCaller(roomDir);
      if (!db) {
        return textResponse({ ok: false, reason: 'no_room_db', room_dir: roomDir, mode: mode });
      }
      try {
        if (mode === 'transitive_support') {
          const result = navigation.findTransitiveSupport(db, node_id, { maxDepth: max_depth });
          return textResponse({ ok: true, mode: mode, room_dir: roomDir, ...result });
        }
        // mode === 'nearest_sub_room_decisions'. icm-forest.cjs opens and
        // closes its OWN db handle internally (it takes a directory, not a
        // handle); this file's own `db` above is opened only to satisfy the
        // no_room_db refusal check every mode here shares, and is closed in
        // the finally below regardless of which branch ran.
        const { findNearestSubRoomDecisions } = require('../../core/icm-forest.cjs');
        const result = findNearestSubRoomDecisions(roomDir, { focusNodeId: node_id, maxResults: max_results });
        return textResponse({ ok: true, mode: mode, ...result });
      } catch (e) {
        return textResponse({ ok: false, reason: (e && e.message) || 'graph_reason_failed', mode: mode, room_dir: roomDir }, true);
      } finally {
        navigation.closeRoomDbForCaller(db);
      }
    }
  );
}

// Born-wired SOURCE of truth (Part 11 R1/R16). scripts/build-connector-
// registry.cjs discovers this export and regenerates data/mcp-tool-
// connectors.json + data/connector-registry.json from it; never hand-edit
// either generated file.
const connectors = [
  {
    tool: 'graph_reason',
    surface: 'graph_reason',
    connector: 'mcp-tool',
    hitl_shape: 'none',
    hitl_why: 'Every mode is a pure read through the navigation.cjs chokepoint: no node minted, no edge written, and specifically NO cross-room edge materialized (edges.cjs:45, "Cross-room aggregation forbidden"). Contrast with graph_write\'s F.1: this tool never writes, the read/write line RESEARCH.md 2.5 names as the load-bearing distinction this phase preserves.',
  },
];

module.exports = { register, connectors };
