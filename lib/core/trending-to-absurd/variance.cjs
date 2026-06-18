/**
 * MindrianOS Plugin -- The 4-persona x 3-path variance matrix + Shape F hybrid
 * gate (Phase 163, Wave 5 SURFACE-B).
 *
 * D-163-06 (LOCKED): ship FULL variance in v1 -- not a subset. The Visionary
 * Innovation Companion offers:
 *
 *   PERSONA LENSES (D-163-06): Founder / Researcher / Investor / Analyst. The
 *     persona reshapes the FRAMING -- a Founder reads the absurd extrapolation
 *     differently than an Investor. Aligned with the Canon Appendix E SME
 *     archetypes (Founder / Researcher / Investor are three of the seven; Analyst
 *     is the data-reads-the-signal lens the Visionary spec names).
 *
 *   PATH VARIANTS: Quick / Full / Expert. The path sets the DEPTH + gate policy:
 *     Quick  = fewer rings + auto (autonomous_safe everything; no judgment-point
 *              gate -- fastest to a first read).
 *     Full   = all rings (FUTURES_DEPTH_CAP, reused) + hybrid gates (the D-163-05
 *              default: auto-run autonomous_safe stages, Shape F gate at the
 *              judgment points -- trend selection, opportunity pick).
 *     Expert = all rings + hybrid + multi-agent refinement (the
 *              economic/tech/social/environmental sub-agents ride the EXISTING
 *              Canon Part 2 SUB-AGENT SPAWN affordance, NOT a new mechanism; the
 *              multi_agent flag is a descriptor the command body dispatches).
 *
 * All variance rides the SAME hybrid rails (D-163-05). The persona + path are
 * chosen at a Shape F Decision Gate (surfacePersonaPathGate); the selection
 * becomes graph data via navigation.writeEdge (recordPersonaPathSelection).
 *
 * Canon Part 4: every choice is graph data -- the persona/path selection writes a
 *   typed edge (SELECTED_REACH; the system-bookkeeping reach-selection edge).
 * Canon Part 8: edge properties are ENUM/scalar ONLY (persona + path enums + the
 *   decision handle); never prose, never a Brain egress. The persona/path gate's
 *   BRAIN panel carries a GENERIC framework handle only.
 * Canon Part 9: SELECTED_REACH is system bookkeeping (created_by=system), kept
 *   distinct from any confirmNode truth-claim promotion.
 *
 * Pure Node.js built-ins only (zero npm deps). NO em-dashes (CLAUDE.md HARD RULE).
 */

'use strict';

const path = require('path');
const navigation = require('../navigation.cjs');

// Part 7 reuse: FUTURES_DEPTH_CAP is the "all rings" depth (reused from the
// futures harness; never minted anew). Quick uses fewer; Full / Expert use all.
const futures = require('../futures/orchestrator.cjs');
const { FUTURES_DEPTH_CAP } = futures;

// D-163-06: the four persona lenses. Frozen; the gate offers exactly these.
const PERSONA_LENSES = Object.freeze(['Founder', 'Researcher', 'Investor', 'Analyst']);
const PERSONA_SET = new Set(PERSONA_LENSES);

// The persona-specific framing handle (the beautiful question each lens opens
// with, Canon Appendix E). The command body uses this to reshape the Larry
// framing; it is a GENERIC methodology handle (Part 8), never user content.
const PERSONA_FRAMING = Object.freeze({
  Founder: 'What if we are solving the wrong problem?',
  Researcher: 'Why do we believe this is true?',
  Investor: 'What has to be true for this to return 10x?',
  Analyst: 'What does the signal actually say, stripped of the hype?',
});

// The three path variants. Quick = fewer rings + auto; Full = all rings + hybrid;
// Expert = all rings + hybrid + multi-agent refinement. Frozen.
const PATH_VARIANTS = Object.freeze({
  Quick: Object.freeze({ rings: 1, gate_policy: 'auto', multi_agent: false }),
  Full: Object.freeze({ rings: FUTURES_DEPTH_CAP, gate_policy: 'hybrid', multi_agent: false }),
  Expert: Object.freeze({ rings: FUTURES_DEPTH_CAP, gate_policy: 'hybrid', multi_agent: true }),
});
const PATH_SET = new Set(Object.keys(PATH_VARIANTS));

// The frozen-set edge type the persona/path selection writes. SELECTED_REACH is
// the canonical reach-selection edge (Phase 143.1-03; system bookkeeping per
// Part 9), already in the ALLOWED_EDGE_TYPES closed set -- never minted anew.
const SELECTION_EDGE_TYPE = 'SELECTED_REACH';
// The typed target handle the selection points at (a generic reach handle, NOT
// user content; Part 8). The persona/path selection IS a reach into the
// trending-to-absurd surface.
const SELECTION_TARGET = 'reach:trending-to-absurd';

/**
 * surfacePersonaPathGate -- assemble the Shape F Decision Gate at the
 * PERSONA + PATH judgment point (D-163-05 hybrid; this is the FIRST gate, fired
 * before the trend-selection gate). It MIRRORS the futures surfaceBridgesAtGate
 * shape: LOCAL assembly only -- it NEVER renders the gate itself. Larry / the
 * command layer renders the returned descriptor through the Shape F selector (the
 * only choice primitive, Part 3): F.2 path-control for the path choice, F.1
 * next-move for the persona.
 *
 * The navigator selects WHICH persona lens reshapes the framing and WHICH path
 * sets the depth + gate policy.
 *
 * @param {string} roomDir - absolute room directory (LOCAL context source)
 * @param {Object} [opts]
 * @returns {{ judgment_point: string, surface: string, personas: string[],
 *   paths: Object, persona_framing: Object, contexts: Object }}
 */
function surfacePersonaPathGate(roomDir, opts) {
  opts = opts || {};
  return {
    judgment_point: 'persona-path-selection',
    // F.2 path-control (the path choice = choosing structure, not content) + F.1
    // next-move (the persona choice). The command body renders both; the
    // descriptor names F.2 as the primary surface (the structural choice leads).
    surface: 'F.2',
    personas: PERSONA_LENSES.slice(),
    paths: PATH_VARIANTS,
    persona_framing: PERSONA_FRAMING,
    // Tri-context panels: LOCAL (the room) + BRAIN (generic methodology handle
    // ONLY, never room content; Part 8) + SIGNAL (none this turn -- the
    // persona/path pick is a LOCAL structural choice, no external sweep).
    contexts: {
      local: { roomDir: path.resolve(roomDir), personaCount: PERSONA_LENSES.length, pathCount: PATH_SET.size },
      brain: { methodology: 'S-Curve Analysis', note: 'generic framework handle only (Part 8)' },
      signal: { note: 'none this turn' },
    },
  };
}

/**
 * recordPersonaPathSelection -- write the persona/path selection as a typed edge
 * via the navigation.writeEdge chokepoint so the selection becomes graph data
 * (Canon Part 4). The edge is SELECTED_REACH FROM the focus node TO the
 * trending-to-absurd reach handle, carrying ENUM-ONLY props { persona, path }
 * (Canon Part 8: no prose, no Brain egress). Defensive: an invalid persona or
 * path is rejected without writing.
 *
 * @param {Object} db - the caller-owned room.db handle (openRoomDb)
 * @param {Object} params
 * @param {string} params.persona - one of PERSONA_LENSES
 * @param {string} params.path - one of PATH_VARIANTS keys
 * @param {string} params.focusNodeId - the active focus node the selection rides
 * @returns {{ ok: boolean, reason?: string, edge_id?: string }}
 */
function recordPersonaPathSelection(db, params) {
  params = params || {};
  const { persona, path: pathChoice, focusNodeId } = params;

  if (!PERSONA_SET.has(persona)) {
    return { ok: false, reason: 'invalid_persona' };
  }
  if (!PATH_SET.has(pathChoice)) {
    return { ok: false, reason: 'invalid_path' };
  }
  if (typeof focusNodeId !== 'string' || focusNodeId.length === 0) {
    return { ok: false, reason: 'invalid_focus_node' };
  }

  // The selection is graph data: a SELECTED_REACH edge with enum-only props.
  // navigation.writeEdge is the ONLY write path (the chokepoint; Part 9).
  return navigation.writeEdge(db, {
    source_id: focusNodeId,
    target_id: SELECTION_TARGET,
    edge_type: SELECTION_EDGE_TYPE,
    // Part 8: ENUM/scalar ONLY. persona + path are closed-set enums; no prose.
    properties: { persona, path: pathChoice },
  });
}

module.exports = {
  PERSONA_LENSES,
  PERSONA_FRAMING,
  PATH_VARIANTS,
  SELECTION_EDGE_TYPE,
  SELECTION_TARGET,
  surfacePersonaPathGate,
  recordPersonaPathSelection,
};
