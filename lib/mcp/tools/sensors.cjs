'use strict';
// Phase 198-06 (SPEC-2, Task 1) -- suggest_next / reach_candidates /
// contradiction_check / whitespace_scan (sensors as PULL) + framework_run.
//
// The four sensors are READ-ONLY, session-scoped tools that pull through the
// SHIPPED reach path: lib/core/insight-sensors.cjs's dispatchSensors (the
// PRODUCER of candidate reaches, Phase 143) and lib/core/navigation.cjs's
// insight query primitives (findContradictions / findOpenQuestions /
// findUnsupportedClaims, Phase 109-05). This module mints NO second sensor
// registry and NO second SQL query -- it is a thin MCP surface over what
// already ships (Canon Part 7).
//
// framework_run wraps lib/workflow/command-resolver.cjs's composeWorkflow --
// the 107 methodology commands become PARAMETERS (a framework-name chain), not
// new tool surfaces. It does NOT mint a second selection brain (R4): it never
// re-implements framework-to-command resolution, and it never executes a
// material step unattended -- a material (non-autonomous_safe) step composes a
// gate via lib/mcp/gate-render.cjs's SAME renderGate ladder Plan 05 shipped
// (lib/mcp/tools/gate.cjs), and returns it instead of running the command.
//
// Canon Part 8: zero Brain/network tokens. Canon Part 9: any graph read routes
// through lib/core/navigation.cjs (findContradictions / findOpenQuestions /
// findUnsupportedClaims) -- this module never opens room.db directly.
// Canon Part 11: register(server, ctx) + connectors export, same disjoint-file
// module contract as room.cjs / graph.cjs / gate.cjs -- never requires those
// modules or lib/mcp/tool-router.cjs at module-load time. gate-render.cjs is
// NOT a lib/mcp/tools/*.cjs module (it lives one directory up), so requiring
// it here mirrors gate.cjs's own require -- not a tools/tools collision.
//
// No em-dashes. CJS only.

const { z } = require('zod');

const navigation = require('../../core/navigation.cjs');
const { dispatchSensors } = require('../../core/insight-sensors.cjs');
const reachHedgeRanker = require('../../workflow/reach-hedge-ranker.cjs');
const { composeWorkflow, validateChainAutonomy } = require('../../workflow/command-resolver.cjs');
const gateRender = require('../gate-render.cjs');
const { resolveWriteRoom, resolveActiveRoom } = require('../../core/resolve-active-room.cjs');
const { resolveEffectiveSessionId } = require('../../core/session-binding.cjs');
const { isMcpFirst } = require('../mcp-first-flag.cjs');

function textResponse(payload, isError) {
  const result = { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
  if (isError) result.isError = true;
  return result;
}

/**
 * Resolve THIS session's room for a READ. Independent copy per the
 * disjoint-file tool-module contract (mirrors room.cjs / graph.cjs / gate.cjs
 * -- each tool module keeps its own copy rather than requiring a sibling).
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
 * Build the minimal (turn, tuple, ctx) triple dispatchSensors expects, from an
 * MCP call's optional free-text + section params. Degrade-safe: an absent
 * user_text/section still dispatches (most sensors read turn/tuple/ctx
 * defensively per lib/core/insight-sensors.cjs's own soft-fail discipline).
 *
 * @param {string|undefined} sessionId
 * @param {string} roomDir
 * @param {{userText?: string, section?: string}} params
 */
function buildSensorInputs(sessionId, roomDir, params) {
  const turn = {
    userText: typeof params.userText === 'string' ? params.userText : '',
    sectionPath: typeof params.section === 'string' ? params.section : null,
    sessionId: sessionId,
  };
  const tuple = {}; // /mos:diagnose classification unknown to a bare MCP pull -- sensors degrade gracefully
  const ctx = { roomDir: roomDir, lowFillSections: null };
  return { turn, tuple, ctx };
}

/**
 * dispatchCandidateReaches -- the ONE call every sensor pull-tool routes
 * through. Never throws (dispatchSensors itself never throws; a defensive
 * try/catch here is belt-and-suspenders for a malformed params object).
 */
function dispatchCandidateReaches(sessionId, roomDir, params) {
  const { turn, tuple, ctx } = buildSensorInputs(sessionId, roomDir, params || {});
  try {
    const reaches = dispatchSensors(turn, tuple, ctx);
    const fired = Array.isArray(reaches) ? reaches : [];
    // Phase 222 (D-01/Req 1): no cortexNodes are threaded on this path (deferred,
    // SPEC boundary) - every candidate sits on the flat 0.5 D4 floor and the Hedge
    // outcome layer is the ONLY differentiator here (Req 3's MCP-path role). The
    // 0/1-candidate path skips the db open entirely: byte- AND cost-identical to
    // today. A multi-candidate pull opens room.db through the SAME navigation.cjs
    // seam the neighboring tools use (nullable; the ranker degrades on a null db),
    // and releases it in finally, mirroring their open/close lifecycle exactly.
    if (fired.length <= 1) return fired;
    const db = navigation.openRoomDbForCaller(roomDir);
    try {
      return reachHedgeRanker.rankFiredCandidates(fired, { roomDir: roomDir, db: db });
    } finally {
      if (db) navigation.closeRoomDbForCaller(db);
    }
  } catch (_e) {
    return [];
  }
}

/**
 * detectClientCapabilities -- the SAME ladder-detection shape gate.cjs uses
 * (kept as an independent copy per the disjoint-file contract). Real
 * elicitation capability from the MCP initialize handshake; a recognized
 * Claude host surface falls to the thin-adapter rung; everything else is
 * headless text.
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

function register(server, ctx) {
  // --- suggest_next: the single top-ranked candidate reach (or none). ---
  server.tool(
    'suggest_next',
    "Next-action suggestion for this session's bound room. Pulls through the shipped dispatchSensors reach path (Phase 143) -- the SAME candidate-reach registry the per-turn navigation engine consumes, called here on demand as a read. Returns the first (highest-priority, canonical dispatch order) candidate reach, or none.",
    {
      user_text: z.string().max(4000).optional()
        .describe('Optional free text to seed the pull (e.g. the user\'s last message). Absent -> sensors that read turn text degrade gracefully.'),
      section: z.string().regex(/^[a-z0-9-]+$/).optional()
        .describe('Optional section slug for section-scoped sensors.'),
    },
    async ({ user_text, section }, extra) => {
      const sessionId = resolveEffectiveSessionId(undefined, extra);
      const roomDir = resolveSessionRoomDir(sessionId, ctx);
      const reaches = dispatchCandidateReaches(sessionId, roomDir, { userText: user_text, section: section });
      const top = reaches.length > 0 ? reaches[0] : null;
      return textResponse({
        ok: true,
        room_dir: roomDir,
        suggestion: top,
        note: top ? undefined : 'No candidate reach fired for this pull.',
      });
    }
  );

  // --- reach_candidates: the full candidate set feeding a reach card. ---
  server.tool(
    'reach_candidates',
    "The full candidate-reach set feeding a reach card for this session's bound room. Pulls through the SAME dispatchSensors reach path as suggest_next (Phase 143 SENSOR_REGISTRY, canonical order) -- this is the un-truncated list, not just the top pick.",
    {
      user_text: z.string().max(4000).optional()
        .describe('Optional free text to seed the pull. Absent -> sensors that read turn text degrade gracefully.'),
      section: z.string().regex(/^[a-z0-9-]+$/).optional()
        .describe('Optional section slug for section-scoped sensors.'),
    },
    async ({ user_text, section }, extra) => {
      const sessionId = resolveEffectiveSessionId(undefined, extra);
      const roomDir = resolveSessionRoomDir(sessionId, ctx);
      const reaches = dispatchCandidateReaches(sessionId, roomDir, { userText: user_text, section: section });
      return textResponse({ ok: true, room_dir: roomDir, candidates: reaches, count: reaches.length });
    }
  );

  // --- contradiction_check: navigation.findContradictions through the chokepoint. ---
  server.tool(
    'contradiction_check',
    "CONTRADICTS scan for this session's bound room, through the navigation.cjs chokepoint (lib/core/navigation/insights.cjs::findContradictions, Phase 109-05). Resolves the focus node from node_id, or from this session's active focus when node_id is absent.",
    {
      node_id: z.string().min(1).optional()
        .describe('Explicit focus node id. Defaults to this session\'s active focus when absent.'),
    },
    async ({ node_id }, extra) => {
      const sessionId = resolveEffectiveSessionId(undefined, extra);
      const roomDir = resolveSessionRoomDir(sessionId, ctx);
      const db = navigation.openRoomDbForCaller(roomDir);
      if (!db) {
        return textResponse({ ok: false, reason: 'no_room_db', room_dir: roomDir }, true);
      }
      try {
        let focusNodeId = typeof node_id === 'string' && node_id ? node_id : null;
        if (!focusNodeId) {
          try {
            const focus = navigation.getActiveFocus(db, sessionId);
            focusNodeId = focus && focus.focusNodeId ? focus.focusNodeId : null;
          } catch (_e) {
            focusNodeId = null;
          }
        }
        if (!focusNodeId) {
          return textResponse({ ok: true, room_dir: roomDir, contradictions: [], note: 'No focus node. Pass node_id, or set a session focus first.' });
        }
        const contradictions = navigation.findContradictions(db, focusNodeId);
        return textResponse({ ok: true, room_dir: roomDir, focus_node_id: focusNodeId, contradictions: contradictions });
      } finally {
        navigation.closeRoomDbForCaller(db);
      }
    }
  );

  // --- whitespace_scan: findOpenQuestions + findUnsupportedClaims (gap scan). ---
  server.tool(
    'whitespace_scan',
    "Gap scan for this session's bound room, through the navigation.cjs chokepoint: unanswered open_question nodes (findOpenQuestions) and claims with no SUPPORTS/EVIDENCES edge (findUnsupportedClaims) -- the two shipped Phase 109-05 insight primitives closest to 'whitespace' (a gap not yet filled). This module mints no third query.",
    {},
    async (_args, extra) => {
      const sessionId = resolveEffectiveSessionId(undefined, extra);
      const roomDir = resolveSessionRoomDir(sessionId, ctx);
      const db = navigation.openRoomDbForCaller(roomDir);
      if (!db) {
        return textResponse({ ok: false, reason: 'no_room_db', room_dir: roomDir }, true);
      }
      try {
        const roomId = require('node:path').basename(roomDir);
        let openQuestions = [];
        let unsupportedClaims = [];
        try { openQuestions = navigation.findOpenQuestions(db, roomId) || []; } catch (_e) { openQuestions = []; }
        try { unsupportedClaims = navigation.findUnsupportedClaims(db, roomId) || []; } catch (_e) { unsupportedClaims = []; }
        return textResponse({
          ok: true,
          room_dir: roomDir,
          open_questions: openQuestions,
          unsupported_claims: unsupportedClaims,
          gap_count: openQuestions.length + unsupportedClaims.length,
        });
      } finally {
        navigation.closeRoomDbForCaller(db);
      }
    }
  );

  // --- framework_run: the 107 commands become PARAMETERS via composeWorkflow. ---
  server.tool(
    'framework_run',
    "Resolve an ordered framework-name chain to its command plan via lib/workflow/command-resolver.cjs::composeWorkflow -- the ONE governed reach path (R4: this tool mints NO second resolver). A fully autonomous_safe chain returns the resolved plan. A chain with a material (non-autonomous_safe) step HALTS at that step and returns a gate (via the SAME gate-render.cjs ladder gate_render uses) instead of executing it unattended.",
    {
      chain: z.array(z.string().min(1)).min(1)
        .describe('Ordered list of framework names (the same names lib/workflow/command-resolver.cjs\'s registry indexes).'),
    },
    async ({ chain }, extra) => {
      const sessionId = resolveEffectiveSessionId(undefined, extra);
      const roomDir = resolveSessionRoomDir(sessionId, ctx);

      const workflow = composeWorkflow(chain);
      const autonomy = validateChainAutonomy(workflow);

      if (autonomy.runnable) {
        return textResponse({
          ok: true,
          room_dir: roomDir,
          workflow: workflow,
          runnable: true,
          note: 'Resolved plan only -- this tool composes the command plan; chain_run executes it server-side.',
        });
      }

      // Material step(s) found: halt and render a gate instead of proceeding.
      const first = autonomy.blockers[0];
      const step = workflow.find((w) => w.step === first.step);
      const card = {
        header: 'Confirm material step: ' + (step ? step.framework : 'unknown') + (first.command ? ' (' + first.command + ')' : ''),
        kind: 'general',
        select_mode: 'single',
        options: [
          { id: 'approve', label: 'Approve -- run ' + (first.command || step && step.framework || 'this step') },
          { id: 'skip', label: 'Skip this step' },
          { id: 'stop', label: 'Stop the chain' },
        ],
      };
      const capabilities = detectClientCapabilities(server, ctx);
      const renderCtx = { capabilities: capabilities, sessionId: sessionId };
      if (capabilities.elicitation && server && server.server && typeof server.server.elicitInput === 'function') {
        renderCtx.elicitInput = function (params) { return server.server.elicitInput(params); };
      }

      let rendered;
      try {
        rendered = await gateRender.renderGate(card, renderCtx);
      } catch (e) {
        return textResponse({ ok: false, reason: 'gate_render_failed', detail: String((e && e.message) || e) }, true);
      }

      return textResponse({
        ok: true,
        room_dir: roomDir,
        workflow: workflow,
        runnable: false,
        blockers: autonomy.blockers,
        gate: { gate_id: rendered.card.gate_id, renderer: rendered.renderer, rendered: rendered.rendered, answer: rendered.answer },
        note: 'Chain halted at a material step; it was NOT executed unattended.',
      });
    }
  );
}

// Born-wired SOURCE of truth (Part 11 R1/R16). The four sensors reach no
// navigator-facing Decision-Gate fork (hitl_shape 'none' -- WR-04: per
// docs/HITL-SHAPE-DECLARATION-CONTRACT.md, hitl_shape classifies whether a
// surface reaches a place the NAVIGATOR picks among options, not whether it
// performs a write; suggest_next/reach_candidates now performing a debounced,
// system-internal room.db bookkeeping write, per Phase 222, is correctly
// still 'none' -- there is no fork to declare either way. Their hitl_why
// strings are updated below to stop reading as a zero-side-effect claim, since
// a future doctor/audit surface could otherwise reasonably assume that);
// framework_run reaches a genuine material-step fork (hitl_shape 'F.1', the
// same shape gate_render/gate_answer carry). scripts/build-connector-registry.cjs
// discovers this export and regenerates data/mcp-tool-connectors.json +
// data/connector-registry.json from it; never hand-edit either generated file.
const connectors = [
  {
    tool: 'suggest_next',
    surface: 'suggest_next',
    connector: 'mcp-tool',
    hitl_shape: 'none',
    hitl_why: 'Pulls the top candidate reach through the shipped dispatchSensors path -- no navigator-facing fork. Phase 222: on >= 2 fired candidates this may also persist a debounced, system-internal Hedge weight-state snapshot (room.db bookkeeping, never a material or user-visible write, never gated on approval).',
  },
  {
    tool: 'reach_candidates',
    surface: 'reach_candidates',
    connector: 'mcp-tool',
    hitl_shape: 'none',
    hitl_why: 'Pulls the full candidate-reach set through the shipped dispatchSensors path -- no navigator-facing fork. Phase 222: on >= 2 fired candidates this may also persist a debounced, system-internal Hedge weight-state snapshot (room.db bookkeeping, never a material or user-visible write, never gated on approval).',
  },
  {
    tool: 'contradiction_check',
    surface: 'contradiction_check',
    connector: 'mcp-tool',
    hitl_shape: 'none',
    hitl_why: 'Pure read: navigation.cjs findContradictions through the chokepoint, no fork.',
  },
  {
    tool: 'whitespace_scan',
    surface: 'whitespace_scan',
    connector: 'mcp-tool',
    hitl_shape: 'none',
    hitl_why: 'Pure read: navigation.cjs findOpenQuestions + findUnsupportedClaims through the chokepoint, no fork.',
  },
  {
    tool: 'framework_run',
    surface: 'framework_run',
    connector: 'mcp-tool',
    hitl_shape: 'F.1',
    hitl_why: 'Resolves a framework chain via composeWorkflow; a material (non-autonomous_safe) step is a genuine Decision-Gate fork -- it halts and renders a gate rather than executing unattended.',
  },
];

module.exports = {
  register,
  connectors,
  _internal: {
    resolveSessionRoomDir,
    dispatchCandidateReaches,
    detectClientCapabilities,
  },
};
