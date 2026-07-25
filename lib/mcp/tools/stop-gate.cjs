'use strict';
// Phase 198-09 (SPEC-5, D-05, Task 1) -- stop_gate_check: the MCP tool
// surface that registers the moved Stop-gate enforcement on the daemon
// (198-09-PLAN.md: "Register the handler on the daemon (a route or internal
// dispatch reachable from adapter-client's queryDaemon), flag-gated by
// isMcpFirst").
//
// This file is thin by design -- it owns ONLY the capability read (the same
// split lib/mcp/tools/gate.cjs already established: capability detection
// lives at the TOOL layer so lib/mcp/stop-gate-handler.cjs stays testable
// without a live MCP connection) and delegates the entire enforcement
// decision + business close-out to lib/mcp/stop-gate-handler.cjs::
// handleStopEvent. Canon Part 11 (born-wired): register(server, ctx) +
// connectors export, the same disjoint-file module contract every other
// lib/mcp/tools/*.cjs module uses (register-core-tools.cjs auto-discovers
// this file; no other module needs to change to wire it in).
//
// No em-dashes. CJS only.

const { z } = require('zod');

const stopGateHandler = require('../stop-gate-handler.cjs');
const { resolveEffectiveSessionId } = require('../../core/session-binding.cjs');

// detectClientCapabilities -- an independent copy of lib/mcp/tools/gate.cjs's
// own function (kept disjoint per register-core-tools.cjs's "tool modules
// never require each other" seam). A Stop event is never a live, in-band
// tool call, so elicitation realistically never applies here -- but the
// read is kept identical to gate.cjs's for consistency and future-proofing
// (a future MCP host that DOES support elicitation on a Stop-equivalent
// event should not require touching this file).
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

function textResponse(payload) {
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
}

function register(server, ctx) {
  server.tool(
    'stop_gate_check',
    'Server-side Stop-gate enforcement (D-05, migrated LAST after gate-dedup + relevance existed). Consults gate-dedup (fire-once, only-when-relevant) then the shipped check-card-fire predicate; on a genuine unanswered/relevant/novel gate it composes and returns the gate_render payload; otherwise returns { fire: false }. Also owns the server-side business close-out (STATE.md persist + memory-lifecycle/minto-debouncer/folder-memory) for the session\'s bound room.',
    {
      session_id: z.string().optional(),
      transcript_path: z.string().optional(),
      output_text: z.string().optional(),
      ran_entries: z.array(z.string()).optional(),
      preceding_user_text: z.string().optional(),
    },
    async (input, extra) => {
      const sessionId = resolveEffectiveSessionId(input && input.session_id, extra);
      const capabilities = detectClientCapabilities(server, ctx);
      const stopContext = Object.assign({ surface: (ctx && ctx.surface) || 'cli' }, input, { capabilities: capabilities });
      if (capabilities.elicitation && server && server.server && typeof server.server.elicitInput === 'function') {
        stopContext.elicitInput = function (params) { return server.server.elicitInput(params); };
      }
      let result;
      try {
        result = await stopGateHandler.handleStopEvent(sessionId, stopContext);
      } catch (e) {
        return textResponse({ fire: false, reason: 'tool_error', detail: String((e && e.message) || e) });
      }
      return textResponse(result);
    }
  );
}

// Born-wired SOURCE of truth (Part 11 R1/R16). stop_gate_check reaches a
// genuine Decision-Gate fork (it IS the moved Stop-gate enforcement) --
// scripts/build-connector-registry.cjs discovers this export and
// regenerates data/mcp-tool-connectors.json + data/connector-registry.json
// from it; never hand-edit either generated file.
const connectors = [
  {
    tool: 'stop_gate_check',
    surface: 'stop_gate_check',
    connector: 'mcp-tool',
    hitl_shape: 'F.1',
    hitl_why: 'The moved Stop-gate enforcement: on a genuine unanswered/relevant/novel gate it composes and returns a gate_render payload for the calling adapter to surface; a do-not-fire verdict composes nothing.',
  },
];

module.exports = {
  register: register,
  connectors: connectors,
  _internal: {
    detectClientCapabilities: detectClientCapabilities,
  },
};
