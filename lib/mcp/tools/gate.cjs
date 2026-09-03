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
const { resolveEffectiveSessionId } = require('../../core/session-binding.cjs');
const { resolveSessionRoomDir } = require('../session-room.cjs');

function textResponse(payload, isError) {
  const result = { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
  if (isError) result.isError = true;
  return result;
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
      subject_node_id: z.string().min(1).optional()
        .describe('Opaque LOCAL room-graph node id, provenance only. Nothing consumes this yet -- carried on the minted gate card for a later write half. Canon Part 8: must never be a Brain identifier or room content.'),
      evidence_node_ids: z.array(z.string().min(1)).optional()
        .describe('Opaque LOCAL room-graph node ids, provenance only. Nothing consumes this yet -- carried on the minted gate card for a later write half. Canon Part 8: must never be Brain identifiers or room content.'),
    },
    async ({ gate_id, header, kind, ambiguous, select_mode, options, subject_node_id, evidence_node_ids }, extra) => {
      const sessionId = resolveEffectiveSessionId(undefined, extra);
      const capabilities = detectClientCapabilities(server, ctx);
      const card = { gate_id: gate_id, header: header, kind: kind, ambiguous: ambiguous, selectMode: select_mode, options: options, subject_node_id: subject_node_id, evidence_node_ids: evidence_node_ids };
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
    'Ratify a gate decision. Accepts the canonical { gate_id, chosen, verdict } payload; only ratifies a gate_id THIS server process minted through the shared ledger (lib/mcp/gate-ledger.cjs), including a gate id minted by a chain_run halt (T-198-10 spoofing guard, session-scoped). chosen must be an option id or an option label from the card that was actually minted; a chosen value outside that set is rejected with chosen_not_in_card_options before any write happens. On an approve verdict, routes the material write through lib/core/navigation.cjs (Part 9) -- never a direct DB write. When the gate_id was minted by a chain_run halt at a material step, gate_answer is ALSO the verb that resumes that chain: an approve verdict runs the halted step and continues the chain in this SAME call, returning the result nested under chain_result; if the continued chain halts again at a later material step, chain_result carries the next gate_id to answer the same way. The gate is single-use, so a second gate_answer for the same gate_id, or a chain_run call threaded with the same answer afterward, is refused with unknown_or_expired_gate and nothing re-runs.',
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
      // GATE-01 G-2 (ASVS V5 value-domain check): the minted card is in hand
      // right here, and until now it went unused -- chosen was copied
      // verbatim into a ratified memory_event without ever checking it was
      // among the card's actual options. This check runs strictly BEFORE
      // resolveSessionRoomDir / openRoomDbForCaller / logMemoryEvent below,
      // so a rejected answer opens no DB and writes no row.
      const validChosen = gateRender.validateChosenAgainstCard(live.card, chosen);
      if (!validChosen) {
        const validOptionIds = (live.card && Array.isArray(live.card.options))
          ? live.card.options.map((o) => o.id)
          : [];
        return textResponse({
          ok: false,
          reason: 'chosen_not_in_card_options',
          gate_id: gate_id,
          valid_option_ids: validOptionIds,
        }, true);
      }
      // quick task 260819-c55 (Task 2): a material_step entry with no
      // callable resumeFn is refused honestly BEFORE any room db is opened
      // and BEFORE any ratification is written -- a gate whose execution
      // owner is gone must not leave a ratified memory_event for a step
      // that will never run, the same conservative direction the
      // chosen-validation check above already takes.
      if (live.kind === 'material_step' && typeof live.resumeFn !== 'function') {
        return textResponse({ ok: false, reason: 'resume_owner_missing', gate_id: gate_id }, true);
      }

      // Persist the RESOLVED option ids (validChosen), not the raw submitted
      // chosen array -- a label that resolved to an id must not leave a raw
      // label string in the ratified memory_event. Mirrors the
      // AskUserQuestion rung's own _resolveChosenIds -> normalizeGateAnswer
      // call shape in gate-render.cjs.
      const answer = gateRender.normalizeGateAnswer(gate_id, validChosen, verdict);

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

      const response = {
        ok: true,
        gate_id: answer.gate_id,
        chosen: answer.chosen,
        verdict: answer.verdict,
        ratified: answer.verdict === 'approve',
        memory_event: logResult,
      };

      // Ordering doctrine (quick task 260819-c55, Task 2): the ratification
      // memory_event above is written BEFORE the step executes, deliberately.
      // The halted step may be irreversible, so a step that runs must never
      // be unrecorded; the inverse case -- a ratification recorded for a
      // step that then faulted -- stays visible through chain_result.ok:false
      // below and is the recoverable direction.
      if (live.kind === 'material_step') {
        let chainResult;
        try {
          chainResult = await live.resumeFn({ gate_id: answer.gate_id, chosen: answer.chosen, verdict: answer.verdict });
        } catch (e) {
          chainResult = { ok: false, reason: 'resume_fault', detail: String((e && e.message) || e) };
        }
        // Nest, do not spread: chain_result carries its own ok / completed /
        // halted / executed / gate_id / chain_output / gate keys, and
        // flattening them would clobber the ratification fields above.
        response.resumed = true;
        response.chain_result = chainResult;
        if (chainResult && chainResult.ok === false) {
          response.ok = false;
        }
        return textResponse(response, response.ok === false);
      }

      return textResponse(response);
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
