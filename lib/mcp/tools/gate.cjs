'use strict';
// Phase 198-05 (SPEC-4, Task 2) -- gate_render + gate_answer MCP tools.
//
// gate_render composes the Mindrian gate superset card via the renderer
// ladder (lib/mcp/gate-render.cjs) for the CALLING client's own capabilities
// (real elicitation capability negotiated at MCP initialize time; a
// recognized Claude host surface falls to the thin-adapter AskUserQuestion
// rung; everything else gets the headless structured-text rung -- RESEARCH
// A2 re-check: Claude Code/Desktop still do not declare the elicitation
// client capability, issue #2799 still open as of this build; the ladder
// keeps all three rungs regardless).
//
// gate_answer accepts the canonical { gate_id, chosen, verdict } payload and,
// on an approve verdict, RATIFIES the decision by routing the write through
// lib/core/navigation.cjs (Part 9, T-198-04) -- this file never opens the
// graph store directly.
//
// T-198-10 (spoofing): gate_answer only ratifies a gate_id THIS server
// process actually minted via gate_render -- a small in-memory, single-use
// live-gate ledger (mint on gate_render, consume on gate_answer) rejects a
// forged or replayed gate_id before any write happens.
//
// Canon Part 7: reuses lib/mcp/gate-render.cjs (Task 1) for all rendering /
// answer normalization; this file is the tool surface + ratification only.
// Canon Part 8: zero Brain/network tokens.
// Canon Part 11 (born-wired): register(server, ctx) + connectors export,
// same disjoint-file module contract as lib/mcp/tools/room.cjs and
// lib/mcp/tools/graph.cjs (198-04) -- never requires those modules or
// lib/mcp/tool-router.cjs at module-load time.

const { z } = require('zod');

const gateRender = require('../gate-render.cjs');
const gateLedger = require('../gate-ledger.cjs');
const navigation = require('../../core/navigation.cjs');
const { resolveWriteRoom, resolveActiveRoom } = require('../../core/resolve-active-room.cjs');
const { resolveEffectiveSessionId } = require('../../core/session-binding.cjs');
const { isMcpFirst } = require('../mcp-first-flag.cjs');

function textResponse(payload, isError) {
  const result = { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
  if (isError) result.isError = true;
  return result;
}

/**
 * Resolve THIS session's room for the gate_answer ratified write. Same D-02/
 * D-04/D-07 precedence as lib/mcp/tools/room.cjs and lib/mcp/tools/graph.cjs's
 * own independent copies (kept disjoint per lib/mcp/register-core-tools.cjs's
 * "tool modules never require each other" seam).
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

// -----------------------------------------------------------------------
// T-198-10 spoofing mitigation, now on the SHARED ledger: gate_answer only
// ratifies a gate_id THIS process minted via gate_render, single-use, TTL-
// bounded. Phase 238-02 built lib/mcp/gate-ledger.cjs as the ONE ledger both
// this file and chain.cjs mint into and consume from -- until 238-03, this
// file kept its own private _liveGates Map, minted separately from chain.
// cjs's own _resumeLedger under the SAME T-198-10 doctrine, and the two were
// never joined: a gate_id minted by a chain halt could not be consumed by a
// gate answer (238-RESEARCH.md Finding 1). This block is the gate-side half
// of joining them; 238-04 re-points chain.cjs onto the same module.
//
// gateLedger.cjs is NOT a lib/mcp/tools/*.cjs module (it lives one directory
// up), so requiring it here mirrors this file's own pre-existing require of
// ../gate-render.cjs -- not a tools/tools collision under the disjoint-file
// contract (lib/mcp/register-core-tools.cjs).
//
// _mintLiveGate / _consumeLiveGate stay as real named functions so the
// existing tests/test-198-*.cjs files (which reach through _internal) keep
// resolving; they are now thin wrappers over gateLedger.mintGate/consumeGate.
function _mintLiveGate(gateId, card, sessionId) {
  gateLedger.mintGate(gateId, {
    card: card,
    sessionId: sessionId,
    kind: (card && typeof card.kind === 'string' && card.kind.length > 0) ? card.kind : 'general',
  });
}

function _consumeLiveGate(gateId, sessionId) {
  return gateLedger.consumeGate(gateId, sessionId);
}

/**
 * detectClientCapabilities -- the ladder's capability read. Real elicitation
 * capability comes from the MCP initialize handshake (server.server.
 * getClientCapabilities()). Claude Code/Desktop/Cowork do not declare it
 * (RESEARCH A2, issue #2799 open) -- they are identified by the D-07
 * MINDRIAN_MCP_FIRST surface list on ctx.surface instead. Any other caller
 * (VS Code, MCP Inspector, an unrecognized surface) falls to the headless
 * text rung.
 */
const CLAUDE_HOST_SURFACES = ['cli', 'desktop', 'cowork'];

function detectClientCapabilities(server, ctx) {
  let elicitation = false;
  try {
    const caps = (server && server.server && typeof server.server.getClientCapabilities === 'function')
      ? server.server.getClientCapabilities()
      : null;
    elicitation = !!(caps && caps.elicitation);
  } catch (_e) {
    elicitation = false;
  }
  const surface = (ctx && typeof ctx.surface === 'string') ? ctx.surface : null;
  const claudeCode = !elicitation && surface !== null && CLAUDE_HOST_SURFACES.indexOf(surface) !== -1;
  return { elicitation: elicitation, claudeCode: claudeCode };
}

const gateOptionSchema = z.object({
  id: z.string().min(1).optional(),
  label: z.string().min(1),
  description: z.string().optional(),
  rank: z.number().optional(),
  preview: z.string().optional(),
});

function register(server, ctx) {
  server.tool(
    'gate_render',
    'Render the Mindrian gate superset card (options + per-option descriptions + ranks + previews + single/multi-select) via the capability-detected 3-rung renderer ladder: MCP elicitation, Claude Code AskUserQuestion thin adapter, or headless structured text. Returns a minted gate_id that gate_answer must reference to ratify.',
    {
      gate_id: z.string().min(1).optional(),
      header: z.string().optional(),
      kind: z.string().optional()
        .describe("e.g. 'binding' for the D-04 once-per-session-on-ambiguity F.8 card; defaults to 'general'."),
      ambiguous: z.boolean().optional()
        .describe("Only relevant to kind:'binding' -- an unambiguous context never fires the card."),
      select_mode: z.enum(['single', 'multi']).optional(),
      options: z.array(gateOptionSchema).min(1),
    },
    async ({ gate_id, header, kind, ambiguous, select_mode, options }, extra) => {
      const sessionId = resolveEffectiveSessionId(undefined, extra);
      const capabilities = detectClientCapabilities(server, ctx);
      const card = { gate_id: gate_id, header: header, kind: kind, ambiguous: ambiguous, selectMode: select_mode, options: options };
      const renderCtx = { capabilities: capabilities, sessionId: sessionId };
      if (capabilities.elicitation && server && server.server && typeof server.server.elicitInput === 'function') {
        renderCtx.elicitInput = function (params) { return server.server.elicitInput(params); };
      }

      let result;
      try {
        result = await gateRender.renderGate(card, renderCtx);
      } catch (e) {
        return textResponse({ ok: false, reason: 'render_failed', detail: String((e && e.message) || e) }, true);
      }

      if (result.suppressed) {
        return textResponse({ ok: true, suppressed: true, gate_id: result.card.gate_id });
      }

      _mintLiveGate(result.card.gate_id, result.card, sessionId);
      const response = {
        ok: true,
        gate_id: result.card.gate_id,
        renderer: result.renderer,
        rendered: result.rendered,
      };
      // Elicitation completes its round trip INLINE (server.server.elicitInput
      // awaits the live client response within THIS call, unlike the other two
      // rungs whose answer arrives later via a separate gate_answer call). When
      // it produced an answer, surface it now and consume the live-gate entry
      // immediately so the SAME gate_id cannot be replayed through gate_answer.
      if (result.answer) {
        _consumeLiveGate(result.card.gate_id, sessionId);
        response.answer = result.answer;
      }
      return textResponse(response);
    }
  );

  server.tool(
    'gate_answer',
    'Ratify a gate_render decision. Accepts the canonical { gate_id, chosen, verdict } payload; only ratifies a gate_id THIS server actually minted via gate_render (T-198-10 spoofing guard). On an approve verdict, routes the material write through lib/core/navigation.cjs (Part 9) -- never a direct DB write.',
    {
      gate_id: z.string().min(1),
      chosen: z.array(z.string().min(1)).min(1),
      verdict: z.enum(['approve', 'reject', 'defer']),
    },
    async ({ gate_id, chosen, verdict }, extra) => {
      const sessionId = resolveEffectiveSessionId(undefined, extra);
      const live = _consumeLiveGate(gate_id, sessionId);
      if (!live) {
        return textResponse({ ok: false, reason: 'unknown_or_expired_gate', gate_id: gate_id }, true);
      }
      if (live.ok === false) {
        return textResponse({ ok: false, reason: live.reason, gate_id: gate_id }, true);
      }
      const answer = gateRender.normalizeGateAnswer(gate_id, chosen, verdict);

      const roomDir = resolveSessionRoomDir(sessionId, ctx);
      const db = navigation.openRoomDbForCaller(roomDir);
      if (!db) {
        return textResponse({ ok: false, reason: 'no_room_db', room_dir: roomDir }, true);
      }
      let logResult;
      try {
        logResult = navigation.logMemoryEvent(db, 'mcp_client_event_logged', {
          label: 'gate_answer',
          gate_id: answer.gate_id,
          chosen: answer.chosen,
          verdict: answer.verdict,
        });
      } finally {
        navigation.closeRoomDbForCaller(db);
      }
      return textResponse({
        ok: true,
        gate_id: answer.gate_id,
        chosen: answer.chosen,
        verdict: answer.verdict,
        ratified: answer.verdict === 'approve',
        memory_event: logResult,
      });
    }
  );
}

// Born-wired SOURCE of truth (Part 11 R1/R16). Both tools reach a genuine
// Decision-Gate fork (they ARE the HITL surface). scripts/build-connector-
// registry.cjs discovers this export and regenerates data/mcp-tool-
// connectors.json + data/connector-registry.json from it; never hand-edit
// either generated file.
const connectors = [
  {
    tool: 'gate_render',
    surface: 'gate_render',
    connector: 'mcp-tool',
    hitl_shape: 'F.1',
    hitl_why: 'Renders the Mindrian gate superset card via the 3-rung renderer ladder for a genuine Decision-Gate fork; the F.8/F.9 shipped renderers it composes from are the same binding/reconcile HITL shapes.',
  },
  {
    tool: 'gate_answer',
    surface: 'gate_answer',
    connector: 'mcp-tool',
    hitl_shape: 'F.1',
    hitl_why: 'Ratifies a gate decision; an approve verdict routes a material write through navigation.cjs (Part 9) -- the fork the human already resolved via gate_render.',
  },
];

module.exports = {
  register: register,
  connectors: connectors,
  _internal: {
    resolveSessionRoomDir: resolveSessionRoomDir,
    detectClientCapabilities: detectClientCapabilities,
    _liveGates: gateLedger._internal._ledger,
    _mintLiveGate: _mintLiveGate,
    _consumeLiveGate: _consumeLiveGate,
  },
};
