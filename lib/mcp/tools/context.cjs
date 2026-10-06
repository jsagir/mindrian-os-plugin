'use strict';
// Phase 270-09. This tool is a WIRE, not an implementation. getRoomContext
// (lib/core/navigation/room-context.cjs:244) is a 4-leg local fusion that
// has shipped for phases with zero MCP surface (RESEARCH.md 3.2). This
// module resolves the session room, opens the room.db through the Part 9
// chokepoint, calls navigation.getRoomContext, and returns. It adds no
// assembly logic of its own. Don't Hand-Roll row 6: do not build a second
// assembler.
//
// The wire caveat (room-context.cjs:14-18): that header says the output
// feeds Larry's IN-PROCESS reasoning and MUST NOT cross the wire. This tool
// DOES put it on the MCP wire, which is a local stdio or loopback transport
// to the user's own client, never the Brain. Recording that distinction
// explicitly so a future reader does not mistake an MCP response for a
// Part 8 egress: no Brain client is imported here and no network call is
// added.
//
// No em-dashes. CJS only.

const fs = require('node:fs');
const path = require('node:path');
const { z } = require('zod');

const navigation = require('../../core/navigation.cjs');
const { resolveEffectiveSessionId } = require('../../core/session-binding.cjs');
const { resolveSessionRoomDir } = require('../session-room.cjs');
// 369.25 plan 20 (FBRIEF-02, FBRIEF-06): Desktop and Cowork have no SessionStart hook, so this assembler carries
// what the hook carries: the active nest's first three brief blocks (the SAME formatter function, so the two
// assemblers cannot disagree, RESEARCH Pitfall 18) and the room-not-ready line with the recovery card body.
const briefFormatter = require('../../memory/triple-context-formatter.cjs');
const roomReadiness = require('../../core/room-readiness.cjs');
const recoveryGate = require('../room-readiness-gate.cjs');

function textResponse(payload, isError) {
  const result = { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
  if (isError) result.isError = true;
  return result;
}

// Is this room ready to be read? readinessFor(roomDir, 'status') never refuses (plan 13: status always answers and
// shows the state). Returns null for a ready room and for a folder that is not a room (no .room-root: a plain folder
// keeps the legacy behavior, the heal net draws the same line). Otherwise the plain-words line and the typed reason.
//
// The recovery card BODY (header, notice, options, gate id) is carried only when the room's record cannot be read at
// all (room.db missing or damaged): there this call answers with the refusal anyway, exactly as a refused governed
// write does, and mintRecoveryGate returns the one live card for this session and room (a second call returns the
// first). When the record is merely incomplete (a legacy room: the real context is returned beside the gap) the card
// is NOT minted by a read: the card id is session-keyed, so minting it here would make two sessions' reads of the
// same room differ, which tests/test-347-context-focus.cjs Test 5 pins as byte-identical (measured: it failed with
// exactly that gate id difference). Showing an already-minted card there needs a read-only lookup in
// lib/mcp/room-readiness-gate.cjs, which this plan does not own (recorded in the 369.25-20 SUMMARY).
// Nothing is written to the room.
function readinessFacts(roomDir, sessionId) {
  try {
    if (!roomDir || !fs.existsSync(path.join(roomDir, '.room-root'))) return null;
    const r = roomReadiness.readinessFor(roomDir, 'status');
    if (!r || r.state !== 'not_ready') return null;
    const facts = {
      not_ready_reason: r.reason,
      requirement: r.requirement,
      remediation: r.remediation,
      line: null,
      card: null,
      gate_id: null,
      db_unusable: r.reason === 'room_db_missing' || r.reason === 'room_db_unreadable',
    };
    if (facts.db_unusable && r.remediation === 'recover_room_record') {
      const minted = recoveryGate.mintRecoveryGate({ roomDir: roomDir, sessionId: sessionId, readiness: r });
      if (minted && minted.ok === true) { facts.card = minted.card; facts.gate_id = minted.gate_id; }
    }
    facts.line = briefFormatter.readinessLine(r.requirement, { withCard: facts.card !== null });
    return facts;
  } catch (_e) {
    return null;
  }
}

function readinessFields(facts) {
  if (!facts) return {};
  const out = { feyminto_readiness: facts.line, not_ready_reason: facts.not_ready_reason, requirement: facts.requirement, remediation: facts.remediation };
  if (facts.card) { out.recovery_card = facts.card; out.recovery_gate_id = facts.gate_id; }
  return out;
}

function register(server, ctx) {
  server.registerTool(
    'context_assemble',
    {
      title: 'Context Assemble',
      description: 'Assembles this session\'s room context from four local legs: the room state summary, recent session fragments, a ranked graph neighborhood around the conversation, and projected cortex nodes. Every leg reads locally through the navigation.cjs chokepoint, with zero Brain calls. The four numeric parameters are your budget dial. Beside the budget dial, focus_node_id centers the graph-neighborhood leg on a specific node instead of the one derived from the conversation, so a node can be given its own scoped context. Set estimate_only to see the projected cost per leg WITHOUT the bodies, so you can price a context pull before paying for it. Never returns raw file contents.',
      inputSchema: z.object({
        fragment_window: z.number().int().min(1).max(50).optional()
          .describe('How many of the most recent session fragments to include (default 6).'),
        fragment_char_cap: z.number().int().min(50).max(4000).optional()
          .describe('Per-fragment character cap before truncation (default 400).'),
        top_k: z.number().int().min(1).max(100).optional()
          .describe('Max ranked graph-neighborhood results to return (default 10).'),
        max_depth: z.number().int().min(1).max(5).optional()
          .describe('Max graph traversal depth for the neighborhood leg (default 2).'),
        // IN-01 (347 code review): narrowed from a bare z.string().min(1) to
        // the actual local-id/slug shape the docstring below promises --
        // letters, digits, hyphen, underscore, colon, dot, slash, starting
        // with an alphanumeric. Wide enough for every real node id shape in
        // this codebase (section:market-analysis, claim:wire-focus,
        // chain:run:<ts>:<hex>:<n>:<kind>, room:<roomId>), narrow enough to
        // refuse whitespace/newlines/quotes -- garbage that was already
        // functionally harmless (room-context.cjs binds it as a parameterized
        // SQL parameter and checks node existence first) but which the
        // schema previously accepted despite the docstring's own claim.
        focus_node_id: z.string().min(1).max(200)
          .regex(/^[A-Za-z0-9][A-Za-z0-9_.:/-]*$/, 'must be a local node id or section slug (letters, digits, hyphen, underscore, colon, dot, slash)')
          .optional()
          .describe('The node id to center the graph-neighborhood leg on, instead of the node derived from the conversation\'s last ~2 fragments. A local node id or section slug only; omit to keep today\'s conversation-derived focus.'),
        estimate_only: z.boolean().optional()
          .describe('When true, returns the projected per-leg cost with all leg bodies nulled, so you can see the price before paying it (default false).'),
      }),
    },
    async ({ fragment_window, fragment_char_cap, top_k, max_depth, focus_node_id, estimate_only }, extra) => {
      const sessionId = resolveEffectiveSessionId(undefined, extra);
      const roomDir = resolveSessionRoomDir(sessionId, ctx);
      const readiness = readinessFacts(roomDir, sessionId);
      if (readiness && readiness.db_unusable) {
        // a room whose room.db is missing or cannot be opened has no context to assemble: the same refusal reason as
        // before, now typed and with the recovery offered instead of a bare "no room db"
        return textResponse(Object.assign({ ok: false, reason: 'no_room_db', room_dir: roomDir }, readinessFields(readiness)));
      }
      const db = navigation.openRoomDbForCaller(roomDir);
      if (!db) {
        return textResponse(Object.assign({ ok: false, reason: 'no_room_db', room_dir: roomDir }, readinessFields(readiness)));
      }
      try {
        // The existing convention every getRoomContext caller uses
        // (scripts/intent-classifier.cjs): the room id is the room
        // directory's own basename, never a second identity scheme.
        const roomId = path.basename(roomDir || '.') || 'room';
        const result = await navigation.getRoomContext(db, roomId, {
          fragmentWindow: fragment_window,
          fragmentCharCap: fragment_char_cap,
          topK: top_k,
          maxDepth: max_depth,
          focusNodeId: focus_node_id,
          estimateOnly: estimate_only === true,
        });
        // the active nest's brief head, prepended: the same text the session-start hook prints
        let briefFields = {};
        try {
          const asm = briefFormatter.assembleBriefHead({ roomDir: roomDir, sessionId: sessionId, db: db });
          if (asm && typeof asm.text === 'string') {
            briefFields = {
              feyminto_brief: estimate_only === true ? null : asm.text,
              feyminto_brief_meta: { section: asm.section, source: asm.source, state: asm.state, tokens: asm.tokens, budget_tokens: briefFormatter.BRIEF_HEAD_BUDGET.total },
            };
          }
        } catch (_e) { briefFields = {}; }
        return textResponse(Object.assign({ ok: true, room_dir: roomDir }, readinessFields(readiness), briefFields, result));
      } catch (e) {
        return textResponse({ ok: false, reason: (e && e.message) || 'context_assemble_failed', room_dir: roomDir }, true);
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
    tool: 'context_assemble',
    surface: 'context_assemble',
    connector: 'mcp-tool',
    hitl_shape: 'none',
    hitl_why: 'A pure read across four local legs (room state, session fragments, graph neighborhood, projected cortex) through the navigation.cjs chokepoint -- no graph mutation, no node minted, no fork. Contrast with memory_event\'s F.1: this tool never writes, the read/write line RESEARCH.md 2.5 names as the load-bearing distinction this phase preserves.',
    layer: 'context',
    layer_why: 'Assembles room state, session fragments, graph neighborhood and projected cortex into one turn\'s context; changing what the model can see this turn, the rubric\'s own step 4 signal verbatim.',
  },
];

module.exports = { register, connectors };
