'use strict';
// Plan 276-12 (TOOLHON-07) -- claim_write MCP tool.
//
// Closes the reachable half of the Tri-Polar meeting gap named in
// references/meeting/filing-protocol.md:44-63 (plan 276-05, D-276-1): a
// direct writeClaimNode call was reachable from the CLI but no MCP tool
// exposed it, so a meeting claim filed from Desktop/Cowork was a different
// (weaker) kind of object than the same claim filed from the CLI, and
// nothing on the Desktop surface said so.
//
// 276-DECISIONS.md OQ-276-2 ANSWER (option a, ratified commit 26083bac):
// ONE tool, `claim_write`, write-then-gate. Files the claim node at
// review_status 'proposed' through typed-claim.cjs's writeClaimNode ->
// lib/core/node-insert.cjs (the single node-write chokepoint) via
// navigation.cjs, the ONE door -- never a second write path, never a direct
// sqlite built-in / room-db.cjs construction, never a raw INSERT. Promotion
// to 'confirmed' happens only through the SHIPPED gate_answer approve branch
// (lib/mcp/tools/gate.cjs:168-235, navigation.confirmNode) -- this file does
// not touch gate.cjs and mints no second promotion path.
//
// This tool writes ONE claim it is given. It does NOT run the five-
// perspective subagent fan-out (structurally unreachable from MCP -- no
// Agent tool, no subagent registry on this surface) and it does NOT run the
// F.8 filing gate (owned by plan 276-14). It does not duplicate Claimify
// extraction logic; extraction stays where it is.
//
// Canon Part 9: writePathRefusal (lib/mcp/tools/graph.cjs:100-108 precedent)
// applies at call time, identically to graph_write / memory_event /
// artifact_file. This module obtains its db handle the SAME sanctioned way
// every other lib/mcp/tools/*.cjs write tool does (navigation.
// openRoomDbForCaller / closeRoomDbForCaller) -- it never opens room.db
// itself. Canon Part 8: zero Brain/network tokens; the claim text and every
// provenance field stay local.
//
// Canon Part 11 (born-wired): register(server, ctx) + connectors export,
// same disjoint-file module contract as room.cjs / graph.cjs / gate.cjs /
// views.cjs -- never requires those modules or lib/mcp/tool-router.cjs at
// module-load time. Auto-discovered by lib/mcp/register-core-tools.cjs;
// this file is never referenced by register-core-tools.cjs or
// tool-router.cjs by name.

const { z } = require('zod');

const navigation = require('../../core/navigation.cjs');
const { resolveEffectiveSessionId } = require('../../core/session-binding.cjs');
const { isWritePathEnabled } = require('../mcp-first-flag.cjs');
const { resolveSessionRoomDir } = require('../session-room.cjs');
// Phase 353 Plan 02 Task 7 (D-353-8): same best-effort local jtbd-state
// read views.cjs::fileArtifact uses for the filing gate's servesJtbd
// signal. Pure local JSON, never a Brain call.
const jtbdState = require('../../hmi/jtbd-state.cjs');

function textResponse(payload, isError) {
  const result = { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
  if (isError) result.isError = true;
  return result;
}

/**
 * Phase 234-05 pattern, independently re-declared per the disjoint-file
 * seam (same discipline as graph.cjs / views.cjs / gate.cjs / chain.cjs /
 * sensors.cjs -- tools/*.cjs never requires a sibling tools/*.cjs module).
 * The live client identity, read PER CALL (populated only after the MCP
 * initialize handshake, so undefined at registration time).
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
 * The per-call write gate (Phase 234-05 D-04/D-05 pattern). Returns null
 * when the call may proceed, or the honest refusal payload when it may not.
 * Applied identically to graph_write / memory_event / artifact_file.
 *
 * @param {object} server
 * @param {{surface?: string}} ctx
 * @returns {object|null}
 */
function writePathRefusal(server, ctx) {
  const clientVersion = currentClientVersion(server);
  if (isWritePathEnabled({ surface: ctx && ctx.surface, clientVersion: clientVersion })) return null;
  return textResponse({
    ok: false,
    reason: 'write_path_disabled',
    hint: 'Write path is off for this caller: the client is unidentified or has not completed initialize, or it is a tier1 host with its own hook channel (Grok Build, OpenCode). Set MINDRIAN_MCP_FIRST for this surface to override.',
  }, true);
}

function register(server, ctx) {
  server.tool(
    'claim_write',
    "Write one typed DIKW claim node (knowledge_type: fact, causal, heuristic, anomaly_cue, mental_model, or assumption) through typed-claim.cjs's writeClaimNode, the single lib/core/node-insert.cjs write chokepoint, never a second write path. The claim lands at review_status 'proposed', never 'confirmed': this tool renders no gate and ratifies nothing itself. Promotion to 'confirmed' happens only through a separate gate_render / gate_answer approve cycle (unchanged by this tool). This writes exactly one claim you give it, not the five-perspective meeting subagent fan-out and not the F.8 filing gate, both of which are CLI-only and structurally unreachable from MCP.",
    {
      knowledge_type: z.enum(Array.from(navigation.KNOWLEDGE_TYPES))
        .describe('One of the six DIKW knowledge types: fact, causal, heuristic, anomaly_cue, mental_model, assumption. An out-of-enum value is refused here at the schema boundary, and again by writeClaimNode itself if reached another way.'),
      text: z.string().min(1).max(10000)
        .describe('The atomic claim sentence itself.'),
      source_segment: z.string().max(2000).optional()
        .describe('Optional transcript segment id or excerpt this claim was drawn from. Also doubles as the idempotency key: re-filing the same segment upserts rather than duplicates.'),
      source_speaker: z.string().max(200).optional()
        .describe('Optional speaker attribution for this claim.'),
      conditions: z.string().max(2000).optional()
        .describe('Optional conditions under which this claim holds.'),
      counter_conditions: z.string().max(2000).optional()
        .describe('Optional conditions under which this claim would NOT hold.'),
      valid_from: z.string().max(64).optional()
        .describe('Optional ISO-ish start of this claim\'s validity window.'),
      valid_until: z.string().max(64).optional()
        .describe('Optional ISO-ish end of this claim\'s validity window.'),
      disambiguation: z.string().max(64).optional()
        .describe("Optional marker (e.g. 'ambiguous') for a downstream disambiguation queue. Additive only; never a new review_status value."),
    },
    async ({ knowledge_type, text, source_segment, source_speaker, conditions, counter_conditions, valid_from, valid_until, disambiguation }, extra) => {
      const refused = writePathRefusal(server, ctx);
      if (refused) return refused;
      const sessionId = resolveEffectiveSessionId(undefined, extra);
      const roomDir = resolveSessionRoomDir(sessionId, ctx);
      const db = navigation.openRoomDbForCaller(roomDir);
      if (!db) {
        return textResponse({ ok: false, reason: 'no_room_db', room_dir: roomDir }, true);
      }
      try {
        // Phase 353 Plan 02 Task 7 (D-353-8, R-353-D): the filing gate.
        // claim_write resolves ITS section through resolveFocusSection
        // (getActiveFocus), never a widened MCP schema. Runs before the
        // write; under 'strict' a mismatch refuses and writes nothing.
        const focusSection = navigation.resolveFocusSection(db, sessionId);
        let servesJtbd = null;
        try {
          const current = jtbdState.getCurrent(roomDir);
          servesJtbd = (current && typeof current.jtbd === 'string') ? current.jtbd : null;
        } catch (_e) {
          servesJtbd = null;
        }
        const gateMode = 'flag';
        const gateResult = navigation.evaluateFilingGate({
          section: focusSection.ok ? focusSection.section : null,
          servesJtbd: servesJtbd,
          mode: gateMode,
        });
        if (gateResult.verdict === 'mismatch' && gateMode === 'strict') {
          return textResponse({
            ok: false,
            reason: 'job_mismatch',
            section_job: gateResult.section_job,
            declared_job: gateResult.declared_job,
            room_dir: roomDir,
          }, true);
        }

        // Pattern 3 (the rooms-open verified-result construction): the
        // response is built FROM writeClaimNode's own return value, never
        // asserted independently. A success shape is structurally
        // impossible without the write having actually happened.
        const result = navigation.writeClaimNode(db, {
          knowledge_type: knowledge_type,
          text: text,
          sessionId: sessionId,
          sourceSegment: source_segment,
          sourceSpeaker: source_speaker,
          conditions: conditions,
          counter_conditions: counter_conditions,
          valid_from: valid_from,
          valid_until: valid_until,
          disambiguation: disambiguation,
        });

        // Phase 353 Plan 02 Task 7 (D-353-K): a job mismatch under 'flag'
        // rides a memory_event (mcp_client_event_logged), never a refusal.
        // No new EVENT_TYPES member.
        if (gateResult.verdict === 'mismatch' && result && result.ok === true) {
          navigation.logMemoryEvent(db, 'mcp_client_event_logged', {
            label: 'claim_write',
            job_mismatch: true,
            declared_job: gateResult.declared_job,
            section_job: gateResult.section_job,
            reason: gateResult.reason,
          });
        }

        // Mint-then-edge anchor (R-353-I/J): section_job is the anchor
        // target, independent of match/mismatch. Canon Part 9 floor: a
        // failed mint/edge never touches result.ok; the claim already
        // wrote.
        let anchorEdge = null;
        if (result && result.ok === true && gateResult.section_job) {
          try {
            const mintResult = navigation.mintJtbdAnchor(db, gateResult.section_job);
            if (mintResult && mintResult.ok === true) {
              anchorEdge = navigation.writeEdge(db, {
                source_id: result.node_id,
                target_id: navigation.JTBD_ANCHOR_ID(gateResult.section_job),
                edge_type: 'SOURCED_FROM',
                properties: { relation: 'sourced_from', origin: 'claim_write' },
              });
            } else {
              anchorEdge = { ok: false, reason: 'anchor_mint_failed' };
            }
          } catch (e) {
            anchorEdge = { ok: false, reason: 'anchor_edge_threw', detail: String((e && e.message) || e).slice(0, 80) };
          }
        }

        return textResponse(Object.assign({ room_dir: roomDir, anchor_edge: anchorEdge }, result), result.ok === false);
      } finally {
        navigation.closeRoomDbForCaller(db);
      }
    }
  );
}

// Born-wired SOURCE of truth (Part 11 R1/R16). claim_write writes a proposed
// DIKW claim node -- a material graph write, not a pure read, the same F.1
// shape graph_write / memory_event / artifact_file already carry (views.cjs
// precedent). The write itself renders no fork: it does not present options,
// it does not ratify anything, and it decides nothing. The genuine
// Decision-Gate fork this claim eventually passes through is gate_answer
// (lib/mcp/tools/gate.cjs), which already declares F.1 and is unchanged by
// this plan. scripts/build-connector-registry.cjs discovers this export and
// regenerates data/mcp-tool-connectors.json + data/connector-registry.json
// from it; never hand-edit either generated file.
const connectors = [
  {
    tool: 'claim_write',
    surface: 'claim_write',
    connector: 'mcp-tool',
    hitl_shape: 'F.1',
    hitl_why: 'Writes a proposed DIKW claim node through the node-insert.cjs chokepoint, a material graph write (not a pure read), the same F.1 shape graph_write/memory_event/artifact_file already carry. The write itself renders no fork; the genuine Decision-Gate fork it later passes through is gate_answer, which already declares F.1 and promotes this node to confirmed.',
    layer: 'harness',
    layer_why: 'Writes a proposed DIKW claim node through the node-insert.cjs chokepoint; a graph/memory infrastructure write, the rubric\'s own step 3 signal.',
  },
];

module.exports = {
  register: register,
  connectors: connectors,
  _internal: {
    currentClientVersion: currentClientVersion,
    writePathRefusal: writePathRefusal,
  },
};
