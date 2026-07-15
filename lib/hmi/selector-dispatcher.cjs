/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 101-04 + 101-05 + 88.2-04 -- single integration point for Shape F/G/H rendering.
 *
 * Phase 101-05 (Mode A/B/Tier 0 graceful degradation per Canon Part 3):
 *
 *   Tier helper:
 *     - Resolved at: lib/hmi/tier-check.cjs (v1 stub; Phase 90 follow-on
 *       will replace with full Brain-ping + cache + BRAIN.md presence audit).
 *     - Expected return from getTier(): integer in {0, 1, 2, 3}.
 *     - Mode mapping (Canon Part 3 "Option generation tier-awareness"):
 *         tier >= 2 -> Mode A (Full Loop): Brain reachable, RECOMMENDED >= 0.7 marker rendered.
 *         tier 1    -> Mode B (Local Only): Navigation Engine; no RECOMMENDED marker; Zone 1 carries
 *                      "Brain unreachable; running on local graph only." prefix line.
 *         tier 0    -> degraded; dispatcher refuses expensive shapes per Canon Part 3 Rule 2,
 *                      returns { shape: 'error', rendered: { error: 'tier-0-refused', ... } }.
 *
 *   Defense-in-depth: dispatcher computes mode from tier and propagates `mode` to every renderer.
 *   Renderers (F.6 + G + H) ALSO suppress RECOMMENDED markers internally when mode === 'B' so a
 *   buggy caller who forgets to pass mode still cannot leak a `▶` marker in Mode B.
 *
 * Phase 88.2-04 (Operator-aware F.1..F.5 sub-shape dispatch + telemetry + AskUserQuestion trailer):
 *
 *   F.1..F.5 sub-shape dispatch:
 *     requestedShape ∈ {'F.1','F.2','F.3','F.4','F.5'} routes directly to the matching
 *     Phase 88.2 wave-1 renderer (lib/hmi/shape-fN-renderer.cjs). The umbrella 'F'
 *     branch is preserved byte-stable -- it still routes via JTBD state to F.6 (or
 *     F.1 fallback). Existing 9-test selector-dispatcher contract is preserved.
 *
 *   JUST_TALK refuse (Canon Part 3 + render-v2 compaction gate):
 *     When `operator === 'JUST_TALK'` and ANY Shape F.* (umbrella or sub-shape) is
 *     requested, the dispatcher returns:
 *       { shape: 'error', rendered: { error: 'render_v2_compaction_violation', ... } }
 *     mirroring lib/render/render-v2.cjs#244 ("JUST_TALK suppresses ALL output").
 *     A Shape F selector cannot be presented while the conversation is in JUST_TALK
 *     prose-only mode without violating the compaction contract.
 *
 *   Telemetry emission (Canon Part 8 LOCAL ONLY):
 *     Every successful Shape F.* presentation calls
 *     selector-telemetry.recordPresentation(roomDir, {sub_shape, mode, options_count,
 *     recommended_present, operator}). Wrapped in try/catch -- telemetry NEVER fails
 *     Larry's turn. The companion recordResponse() is exposed as a re-export for
 *     consumers that wire the AskUserQuestion answer back to the ledger.
 *
 *   AskUserQuestion structural-marker trailer:
 *     Every successful Shape F.* return carries an
 *     `rendered.askuserquestion_marker = '[AskUserQuestion contract: shape=F.X verbs=N]'`
 *     scalar AND the marker is appended (preceded by a blank line) to
 *     `rendered.zones.footer`. Consumers that compose zones see the trailer
 *     in the rendered surface; consumers that introspect the contract can
 *     read the scalar directly.
 *
 * API:
 *   pickShape({ requestedShape, roomDir, operator, tier, payload })
 *     -> { shape, rendered } | { shape, passthrough: true }
 *
 *   - requestedShape:    'F' | 'F.1' | 'F.2' | 'F.3' | 'F.4' | 'F.5' | 'G' | 'H' | 'A' | 'B' | 'C' | 'D' | 'E'
 *   - roomDir:           absolute path; used to read JTBD state for F-shape dispatch.
 *   - operator:          one of OPERATORS or null. JUST_TALK refuses Shape F.*.
 *   - tier:              optional override; if omitted, dispatcher calls getTier().
 *   - payload:           shape-specific input forwarded to the corresponding renderer.
 *
 *   recordSelectorResponse(roomDir, record)
 *     Re-export of selector-telemetry.recordResponse for consumers wiring
 *     AskUserQuestion answers back to the local ledger.
 *
 * Pure CJS, node built-ins only, zero deps (Phase 87 invariant).
 */

'use strict';

// Phase 121-02 D-04: unified-stream selector_pick emit chokepoint.
// require()-loaded lazily inside emitSelectorPickUnified() so a missing writer
// module (or a stripped-down install) cannot crash the dispatcher at load.
const crypto = require('node:crypto');
function _sha256(s) {
  return crypto.createHash('sha256').update(String(s || '')).digest('hex');
}

const FREE_TEXT = 'Free-Text';
const MODE_B_ZONE1_PREFIX = '⚠ Brain unreachable; running on local graph only.';

// Phase 148-03 (IRW-04, D-03): the reach -> toggleable-component-archetype map.
// Registry-is-the-table -- the dispatcher reads lib/hmi/reach-component-map.json
// and NEVER a hardcoded switch (mirrors the connector-registry / ORCH-01
// pattern). A new reach joins by adding a row to the JSON, not by editing this
// file. resolveArchetype() folds the three key namespaces (reaches /
// sub_modes / standing_options) into a single flat lookup; the default on a
// miss is 'select' (the Shape F.1 single-pick path). The archetype then drives
// which AskUserQuestion mode the dispatcher constructs (multiSelect / confirm /
// ordered follow-up / auto / select) -- the construction stays INSIDE this file
// per SEED-020 (no bespoke AskUserQuestion payload built anywhere else).
const ARCHETYPE_DEFAULT = 'select';
const VALID_ARCHETYPES = ['select', 'multiSelect', 'ordered', 'group', 'confirm', 'auto', 'text'];

let _reachComponentMapCache = null;
function _loadReachComponentMap() {
  if (_reachComponentMapCache !== null) return _reachComponentMapCache;
  let flat = {};
  try {
    const raw = require('./reach-component-map.json');
    const namespaces = ['reaches', 'sub_modes', 'standing_options'];
    for (const ns of namespaces) {
      const group = raw && raw[ns];
      if (group && typeof group === 'object') {
        for (const key of Object.keys(group)) {
          const entry = group[key];
          const arch = entry && typeof entry.archetype === 'string' ? entry.archetype : null;
          if (arch && VALID_ARCHETYPES.indexOf(arch) !== -1) {
            flat[key] = arch;
          }
        }
      }
    }
  } catch (_e) {
    // Missing / malformed map (degraded install): every reach falls back to the
    // default 'select' archetype -- the renderer still works, no crash.
    flat = {};
  }
  _reachComponentMapCache = flat;
  return _reachComponentMapCache;
}

// Phase 150-06 (MEM-06, D-02): the archetype-escalation rank. The static
// reach-component-map is the FLOOR; the projected cortex can only ESCALATE a
// reach UP this rank, never lower it. A higher index is a higher-friction gate
// (a contradiction in the cortex warrants a confirm before a bare select acts).
// 'confirm' is the escalation ceiling for the contradiction signal; multiSelect /
// ordered / group / auto / text are orthogonal interaction modes and are never
// down-ranked by the escalation (escalate only lifts select -> confirm).
const _ESCALATION_RANK = { select: 0, confirm: 1 };

// Read the contradiction-presence signal off a cortexState WITHOUT importing the
// adapter at module load (lazy require so a degraded install that lacks the
// adapter still resolves the static floor). cortexState may carry either a
// pre-computed boolean (cortexState.hasContradiction) or the raw cortexNodes the
// adapter inspects. Presence-only; never reads prose (Canon Part 8).
function _cortexEscalatesToConfirm(cortexState) {
  if (!cortexState || typeof cortexState !== 'object') return false;
  if (cortexState.hasContradiction === true) return true;
  const nodes = cortexState.cortexNodes;
  if (!Array.isArray(nodes) || nodes.length === 0) return false;
  try {
    const adapter = require('./cortex-reach-adapter.cjs');
    if (adapter && typeof adapter.hasContradiction === 'function') {
      return adapter.hasContradiction(nodes) === true;
    }
  } catch (_e) {
    // Degraded install: no adapter -> no escalation, the static floor stands.
  }
  return false;
}

/**
 * Phase 148-03 (IRW-04, D-03) + Phase 150-06 (MEM-06, D-02): resolve a reach_id /
 * sub_mode / standing-option key to its toggleable-component archetype. Reads
 * lib/hmi/reach-component-map.json (registry-is-the-table). Returns the default
 * 'select' on any miss.
 *
 * The OPTIONAL second arg cortexState (Phase 150-06): when omitted (every
 * existing caller) the static-map archetype is returned BYTE-STABLE -- the floor
 * is unchanged. When provided and carrying projected node-type presence that
 * warrants escalation (a contradiction decision node present), a 'select' reach
 * ESCALATES to 'confirm'. The static map is the floor and is NEVER lowered
 * (T-150-06-04): escalation only lifts.
 */
function resolveArchetype(reachIdOrSubMode, cortexState) {
  if (typeof reachIdOrSubMode !== 'string' || reachIdOrSubMode.length === 0) {
    return ARCHETYPE_DEFAULT;
  }
  const map = _loadReachComponentMap();
  const hit = map[reachIdOrSubMode];
  const staticArchetype = (typeof hit === 'string' && hit.length > 0) ? hit : ARCHETYPE_DEFAULT;

  // No cortexState (every existing caller) -> byte-stable static floor.
  if (cortexState === undefined || cortexState === null) {
    return staticArchetype;
  }

  // Cortex escalation: only lift select -> confirm; never lower the floor.
  if (_cortexEscalatesToConfirm(cortexState)) {
    const staticRank = (typeof _ESCALATION_RANK[staticArchetype] === 'number')
      ? _ESCALATION_RANK[staticArchetype] : null;
    const confirmRank = _ESCALATION_RANK.confirm;
    // Only escalate when the static archetype is on the select->confirm ladder
    // AND below confirm. Orthogonal archetypes (multiSelect/ordered/group/auto/
    // text) are left untouched -- the escalation never down-ranks them.
    if (staticRank !== null && staticRank < confirmRank) {
      return 'confirm';
    }
  }

  return staticArchetype;
}

/**
 * Phase 148-03: translate a resolved archetype into the AskUserQuestion-shape
 * hints the dispatcher attaches to a Shape F.* rendered contract. This is the
 * ONLY place the archetype becomes an interactivity mode (SEED-020 single
 * door). The hints are scalars consumed by the render host when it composes
 * the AskUserQuestion call -- no bespoke payload is built here or elsewhere.
 *
 *   multiSelect -> { multiSelect: true }
 *   confirm     -> { confirm: true }      (a confirm follow-up gate)
 *   ordered     -> { ordered: true }      (an ordering follow-up prompt, D-02;
 *                                          NOT a live ordered widget)
 *   auto        -> { auto: true }         (no pick -- the host runs it, D-04)
 *   select      -> { multiSelect: false } (the default single-pick path)
 */
function archetypeToContractHints(archetype) {
  const arch = (typeof archetype === 'string' && VALID_ARCHETYPES.indexOf(archetype) !== -1)
    ? archetype : ARCHETYPE_DEFAULT;
  const hints = { archetype: arch, multiSelect: false };
  if (arch === 'multiSelect' || arch === 'group') {
    hints.multiSelect = true;
  } else if (arch === 'confirm') {
    hints.confirm = true;
  } else if (arch === 'ordered') {
    hints.ordered = true;
  } else if (arch === 'auto') {
    hints.auto = true;
  } else if (arch === 'text') {
    hints.freeText = true;
  }
  return hints;
}

/**
 * Phase 148-03: apply the archetype-driven AskUserQuestion-mode hints onto a
 * rendered Shape F.* contract. The dispatcher resolves the archetype from the
 * caller-supplied reachKey (reach_id / sub_mode / standing-option key) and folds
 * the hints onto rendered.contract so the render host constructs the right
 * AskUserQuestion mode. Construction stays inside the dispatcher (SEED-020).
 */
function applyArchetypeRouting(rendered, reachKey) {
  if (!rendered || typeof rendered !== 'object') return rendered;
  if (!rendered.contract || typeof rendered.contract !== 'object') return rendered;
  const archetype = resolveArchetype(reachKey);
  const hints = archetypeToContractHints(archetype);
  rendered.contract.archetype = hints.archetype;
  rendered.contract.multiSelect = hints.multiSelect;
  if (hints.confirm) rendered.contract.confirm = true;
  if (hints.ordered) rendered.contract.ordered = true;
  if (hints.auto) rendered.contract.auto = true;
  if (hints.freeText) rendered.contract.freeText = true;
  return rendered;
}

// Phase 121.5-10 Sub-plan K (LOCKED decisions 1 + Bundle A):
// Brain-suggestion content template constants. The locked chip / glyphs /
// footer values are non-negotiable per audit Section 5.2 -- consumers passing
// brain_suggestion_variant:true receive these literal values composed into
// rendered.zones.body and rendered.zones.footer. Alias map loaded once at
// module init from lib/hmi/jtbd-taxonomy.json alias_map.verb_aliases.
const BRAIN_CHIP = '[■ BRAIN]';
const BRAIN_GLYPH_RECOMMENDED = '▶';
const BRAIN_GLYPH_ALTERNATIVE = '▷';

// Load alias_map once. Safe-require: if jtbd-taxonomy.json is missing or
// malformed (degraded install), fall back to empty map -- consumers without
// alias_map get pass-through behavior (verb renders verbatim, no collapse).
let _aliasMapCache = null;
function _loadAliasMap() {
  if (_aliasMapCache !== null) return _aliasMapCache;
  try {
    const tax = require('./jtbd-taxonomy.json');
    if (tax && tax.alias_map && tax.alias_map.verb_aliases
        && typeof tax.alias_map.verb_aliases === 'object') {
      _aliasMapCache = tax.alias_map.verb_aliases;
      return _aliasMapCache;
    }
  } catch (_e) { /* graceful */ }
  _aliasMapCache = {};
  return _aliasMapCache;
}

/**
 * Phase 121.5-10 Sub-plan K (LOCKED decision 1): collapse a user-facing verb
 * alias to its canonical form for graph-edge persistence. Aliases live in
 * lib/hmi/jtbd-taxonomy.json alias_map.verb_aliases; unknown verbs pass
 * through unchanged (no-op for already-canonical verbs).
 *
 * Optional explicit aliasMap arg overrides the module-level cache (test seam
 * + per-call override for surfaces with surface-specific aliases).
 */
function aliasToCanonical(verb, aliasMap) {
  if (typeof verb !== 'string' || verb.length === 0) return verb;
  const map = (aliasMap && typeof aliasMap === 'object') ? aliasMap : _loadAliasMap();
  if (Object.prototype.hasOwnProperty.call(map, verb)) {
    const canonical = map[verb];
    if (typeof canonical === 'string' && canonical.length > 0) return canonical;
  }
  return verb;
}

/**
 * Phase 121.5-10 Sub-plan K: compose the locked Brain-suggestion option-row
 * block from a normalized optionRows array. Each row is two lines:
 *   Row 1: `<glyph> <N>. <verb>` left-padded, `<conf>%` right-aligned to 80c
 *   Row 2: 5-space indent, `<meta>`
 * Per audit Section 5.2.1. Returns the composed string (one block).
 */
function composeBrainOptionRows(optionRows) {
  if (!Array.isArray(optionRows) || optionRows.length === 0) return '';
  const COL_WIDTH = 80;
  const blocks = [];
  for (let i = 0; i < optionRows.length; i += 1) {
    const r = optionRows[i] || {};
    const glyph = (r.glyph === BRAIN_GLYPH_RECOMMENDED || r.glyph === BRAIN_GLYPH_ALTERNATIVE)
      ? r.glyph : BRAIN_GLYPH_ALTERNATIVE;
    const num = Number.isInteger(r.number) ? r.number : (i + 1);
    const verb = (typeof r.verb === 'string' && r.verb.length > 0) ? r.verb : '';
    const confPct = (Number.isInteger(r.confPct)) ? r.confPct : 0;
    const meta = (typeof r.meta === 'string') ? r.meta : '';
    const left = glyph + ' ' + String(num) + '. ' + verb;
    const right = String(confPct) + '%';
    const padCount = Math.max(1, COL_WIDTH - left.length - right.length);
    const row1 = left + ' '.repeat(padCount) + right;
    const row2 = '     ' + meta;
    blocks.push(row1 + '\n' + row2);
  }
  return blocks.join('\n\n');
}

// Phase 88.2-04: F.* sub-shape registry and JUST_TALK refuse vocabulary.
// Phase 88.2-05: 'F.0' Mini Decision Gate prepended (closed-vocab; freeTextOffered:false carve-out).
// Phase 88.2-06: 'F.6' Plan Review Round appended (closed-vocab; routes to the
//   collision-safe lib/hmi/shape-f6-plan-review-renderer.cjs path; the umbrella 'F'
//   branch continues to route to Phase 101-01's lib/hmi/shape-f6-renderer.cjs via
//   JTBD logic preserved byte-stable per R1 invariant).
// Phase 120-01: 'F.7' was the Breakthrough Surface (CONTEXT.md D-07..D-10 + D-20).
//   SUPERSEDED by Phase 188-01 (SFS-06): bare 'F.7' is the CANONICAL DIAL now
//   (renderDialShape, mirroring 'F.7-dial'); Breakthrough is no longer a shape (D-10
//   canonical ten) but re-homes to an F.1 next-move. The shape-f7-breakthrough-renderer.cjs
//   module stays live as the home of the frozen 5-verb set + the D-20 provenance HARD FLOOR;
//   it is simply no longer reachable via the bare-F.7 single door.
// Phase 177-02: 'F.7-dial' appended -- the four-arrow register HUD branch
//   (BCH-10/BCH-16). Routes to lib/hmi/dial-selector.cjs via the explicit
//   requestedShape:'F.7-dial' branch in dispatchShapeFSubShape, mirroring the
//   F.7 opt-in dispatch. The umbrella 'F' branch does NOT resolve to it.
// Phase 188-06 (SFS-01): 'F.8' appended -- the multiSelect Action Set. It joins by
//   an F_SUBSHAPES row + a `requestedShape === 'F.8'` branch mirroring F.5 (SEED-020
//   single door). The multiSelect hint is folded by archetypeToContractHints; render
//   is a thin safeRequire of shape-f8-renderer.cjs. The umbrella 'F' branch does NOT
//   resolve to it (opt-in dispatch only).
const F_SUBSHAPES = ['F.0', 'F.1', 'F.2', 'F.3', 'F.4', 'F.5', 'F.6', 'F.7', 'F.7-dial', 'F.8', 'F.9'];
const F_UMBRELLA = 'F';
const JUST_TALK = 'JUST_TALK';
const COMPACTION_VIOLATION_CODE = 'render_v2_compaction_violation';

function safeRequire(modPath) {
  try {
    return require(modPath);
  } catch (e) {
    if (e && e.code === 'MODULE_NOT_FOUND') return null;
    throw e;
  }
}

function resolveTier(explicitTier) {
  if (typeof explicitTier === 'number' && Number.isFinite(explicitTier)) {
    return explicitTier;
  }
  try {
    const helper = require('./tier-check.cjs');
    const t = helper.getTier();
    return (typeof t === 'number' && Number.isFinite(t)) ? t : 1;
  } catch (e) {
    // tier-check absent or broken -> assume Local Only (Mode B), the safer default.
    return 1;
  }
}

function modeFromTier(tier) {
  if (tier >= 2) return 'A';
  if (tier === 1) return 'B';
  return '0';
}

/**
 * Defense-in-depth: ensure Free-Text is the last verb in any F-shape contract.
 * Per Canon Part 3 Layer 2 + D-10. Mutates the rendered structure in place.
 *
 * Phase 88.2-04 carve-out: closed-vocabulary sub-shapes (F.3 Rabbit-Hole Depth,
 * F.4 Insight Extraction) DO NOT offer Free-Text per skills/ui-system/SKILL.md
 * Section 2 (depth/extraction are closed axes). Renderers signal this by
 * setting `contract.freeTextOffered === false`. Respecting that flag preserves
 * the closed-vocab invariant; injecting Free-Text would silently break the
 * Wave-1 contract and the renderer's own 7-assertion test suite.
 */
function ensureFreeTextLast(rendered) {
  if (!rendered || !rendered.contract || !Array.isArray(rendered.contract.verbs)) return rendered;
  // Closed-vocab carve-out: F.3, F.4 explicitly opt out of Free-Text.
  if (rendered.contract.freeTextOffered === false) return rendered;
  const verbs = rendered.contract.verbs;
  if (verbs.length === 0 || verbs[verbs.length - 1] !== FREE_TEXT) {
    const filtered = verbs.filter(v => v !== FREE_TEXT);
    filtered.push(FREE_TEXT);
    rendered.contract.verbs = filtered;
  }
  return rendered;
}

/**
 * Prepend the Mode B Zone 1 prefix to a renderer's zones.header. The prefix is
 * a separate line BEFORE the renderer's own header (Task 2.3 contract).
 */
function applyModeBPrefix(rendered) {
  if (!rendered || !rendered.zones) return rendered;
  const existing = typeof rendered.zones.header === 'string' ? rendered.zones.header : '';
  rendered.zones.header = MODE_B_ZONE1_PREFIX + '\n' + existing;
  return rendered;
}

function tier0Refuse() {
  return {
    shape: 'error',
    rendered: {
      error: 'tier-0-refused',
      detail: '/mos:setup brain or graph required for selectors',
    },
  };
}

/**
 * Phase 88.2-04: refuse Shape F.* presentation while the conversation operator
 * is JUST_TALK. JUST_TALK is the prose-only operator (Canon Part 3 + render-v2
 * step 6); a selector block would violate the compaction contract.
 */
function justTalkRefuse(requestedShape) {
  return {
    shape: 'error',
    rendered: {
      error: COMPACTION_VIOLATION_CODE,
      detail: 'Shape F selector refused: operator JUST_TALK suppresses all selector output (render-v2 step 6 / Canon Part 3).',
      operator: JUST_TALK,
      requested: requestedShape,
    },
  };
}

/**
 * Phase 121-02 D-04: emit selector_pick event into the unified
 * ~/.mindrian/telemetry/v1.13/events-YYYY-WNN.jsonl stream (Plan 121-00
 * writer chokepoint). Wrapped in try/catch -- telemetry NEVER fails Larry's
 * turn. Canon Part 8: room slug is sha256-hashed; payload fields are scalar
 * enums / numbers / booleans only. The emit is gated by validateEventPayload
 * inside writer.emit() so adversarial fixtures (Cypher in verb_chosen, etc.)
 * cannot leak. Non-blocking: any thrown error is swallowed so the pickShape
 * dispatch resolution still returns to the caller.
 */
function emitSelectorPickUnified(roomDir, subShape, rendered, payloadIn) {
  try {
    let writer;
    try {
      writer = require('../core/telemetry/writer.cjs');
    } catch (_e) {
      return; // missing writer module -- soft skip, do not crash dispatch
    }
    if (!writer || typeof writer.emit !== 'function') return;
    const contract = (rendered && rendered.contract) ? rendered.contract : {};
    const verbs = Array.isArray(contract.verbs) ? contract.verbs : [];
    const mode = (typeof contract.mode === 'string') ? contract.mode : 'A';
    const recommended = contract.recommended;
    const payload = (payloadIn && typeof payloadIn === 'object') ? payloadIn : {};
    const rankerConfidence = (typeof payload.rankerConfidence === 'number')
      ? payload.rankerConfidence
      : 0;
    const recommendedRendered = (recommended !== null && recommended !== undefined)
      ? true
      : Boolean(payload.recommendedRendered);
    const verbChosen = (typeof payload.verb_chosen === 'string' && payload.verb_chosen.length > 0)
      ? payload.verb_chosen
      : (typeof contract.recommended === 'string' ? contract.recommended : '');
    const slugSource = (typeof roomDir === 'string' && roomDir.length > 0)
      ? String(roomDir).split('/').filter(Boolean).pop() || roomDir
      : (String(process.cwd()).split('/').filter(Boolean).pop() || 'default-room');
    writer.emit('selector_pick', {
      sub_shape: String(subShape || '').slice(0, 64),
      mode: String(mode || 'A').slice(0, 64),
      ranker_confidence: rankerConfidence,
      recommended_rendered: Boolean(recommendedRendered),
      options_count: Number.isInteger(verbs.length) ? verbs.length : 0,
      room_slug_sha256: _sha256(slugSource),
      verb_chosen: String(verbChosen || '').slice(0, 64),
    });
  } catch (_e) {
    // Canon Part 8 validation failure or any other emit failure: swallow.
    // The dispatch resolution must still return cleanly per non-blocking
    // contract (selector-pick-capture test 3 verifies this).
  }
}

/**
 * Phase 88.2-04: emit selector presentation telemetry. Wrapped in try/catch --
 * telemetry NEVER fails Larry's turn. Canon Part 8: LOCAL ledger only, room
 * slug sha256-hashed, never crosses any network boundary.
 */
function emitPresentationTelemetry(roomDir, subShape, rendered, operator) {
  try {
    const tel = safeRequire('./selector-telemetry.cjs');
    if (!tel || typeof tel.recordPresentation !== 'function') return;
    const contract = (rendered && rendered.contract) ? rendered.contract : {};
    const verbs = Array.isArray(contract.verbs) ? contract.verbs : [];
    const mode = (typeof contract.mode === 'string') ? contract.mode : null;
    const recommendedPresent = (contract.recommended !== null && contract.recommended !== undefined);
    const record = {
      sub_shape: subShape,
      mode: mode,
      options_count: verbs.length,
      recommended_present: recommendedPresent,
    };
    if (typeof operator === 'string' && operator.length > 0) {
      record.operator = operator;
    }
    tel.recordPresentation(roomDir, record);
  } catch (_e) {
    // Graceful: never fail Larry's turn on a telemetry I/O hiccup.
  }
}

/**
 * Phase 88.2-04 / Phase 209 Wave-1 E1: append the AskUserQuestion trailer to a
 * Shape F.* rendered envelope. The trailer is now SELF-DECODING -- it carries a
 * binding imperative that TELLS the model to fire AskUserQuestion now, instead
 * of shipping a bare structural marker the model may render as an ASCII box.
 *
 * Root cause it kills (research 2026-07-02, RC-2 / verdicts 2, 5, 21): the old
 * trailer was "a scalar string for introspection" with zero imperative language,
 * so a gate that reached Larry carried a trigger but no instruction to act on it.
 * Fix pattern reused verbatim from scripts/room-naming-selector.cjs:158-160
 * ("INSTRUCTION FOR LARRY ... dispatch ... via AskUserQuestion"), Canon Part 7.
 *
 * Three surfaces:
 *   1. rendered.askuserquestion_marker -- the BYTE-FROZEN scalar marker
 *      `[AskUserQuestion contract: shape=F.X verbs=N]`. Introspection contract;
 *      unchanged (tests: trailer_format, post-filing-selector, 150.5 shape fence,
 *      148 frozen-contracts). The engine-arm concatenation reads this scalar
 *      positionally; its self-decoding upgrade (E2) is Phase 209 Wave 2.
 *   2. rendered.askuserquestion_binding -- the scalar FIRE-IF-FORK imperative
 *      line (Phase 210-05 softened the unconditional BINDING wording to
 *      fire-if-genuine-fork; the field NAME is kept, consumers read it).
 *   3. rendered.zones.footer -- marker line + binding line, appended (preceded by
 *      a blank line if the footer is non-empty). Every composeZones() consumer
 *      (the pickShape door + renderRoomChooserCard -- the incident's actual
 *      conversational room-pick fork) now sees a self-decoding imperative, not a
 *      bare marker.
 *
 * Marker (frozen):        [AskUserQuestion contract: shape=F.X verbs=N]
 * Imperative (E1 + 210-E): [FIRE-IF-FORK: ... call the AskUserQuestion tool ... (SEED-021)]
 */
function appendAskUserQuestionTrailer(rendered, subShape) {
  if (!rendered) return rendered;
  const contract = rendered.contract || {};
  const verbs = Array.isArray(contract.verbs) ? contract.verbs : [];
  const shapeStr = (typeof contract.shape === 'string' && contract.shape.length > 0)
    ? contract.shape : subShape;
  const marker = '[AskUserQuestion contract: shape=' + shapeStr + ' verbs=' + verbs.length + ']';

  // Surface 1: byte-frozen scalar marker (introspection; do NOT alter shape).
  rendered.askuserquestion_marker = marker;

  // Surface 2: the imperative -- makes the trigger self-decoding. Phase 210-05
  // (item 210-E-2) softened the unconditional BINDING wording to a conditional
  // fire-if-genuine-fork directive with the stable machine-greppable prefix
  // [FIRE-IF-FORK: (same bracket-prefix shape as the literal it replaced). It
  // still instructs firing the AskUserQuestion tool on a genuine unanswered
  // fork, explicitly licenses NOT firing when the navigator already answered
  // in plain text or the gate is unrelated to the current conversation, and
  // keeps the SEED-021 no-reproduce render-hygiene clause verbatim (render
  // hygiene is not over-reach). The field NAME stays askuserquestion_binding
  // (consumers read it); only its contents changed.
  const binding = '[FIRE-IF-FORK: if this fork is genuinely unanswered and relevant to the '
    + 'current conversation, call the AskUserQuestion tool in THIS response with the '
    + verbs.length + ' options above; if the navigator already answered in plain text or '
    + 'the gate is unrelated to the current conversation, do NOT fire it - acknowledge '
    + 'and proceed instead; do not reproduce this block as text (SEED-021)]';
  rendered.askuserquestion_binding = binding;

  // Surface 3: the rendered footer carries BOTH lines, so a card-capable
  // consumer that renders zones reads the imperative next to the marker.
  const trailer = marker + '\n' + binding;
  if (!rendered.zones || typeof rendered.zones !== 'object') return rendered;
  const existing = rendered.zones.footer;
  if (existing === null || existing === undefined || existing === '') {
    rendered.zones.footer = trailer;
  } else {
    rendered.zones.footer = String(existing) + '\n\n' + trailer;
  }
  return rendered;
}

/**
 * Phase 121.5-10 Sub-plan K: overlay the locked Brain-suggestion content
 * template onto a rendered F.* envelope per audit Section 5.2. Mutates the
 * rendered object in place. Locked slot values per LOCKED Bundle A decisions:
 *
 *   - Header chip:       [■ BRAIN]               (payload.header overrides)
 *   - Question line:     "Choose next move:"     (payload.questionLine overrides;
 *                        rendered as the first line of zones.body BEFORE the
 *                        two-line option rows)
 *   - Option rows:       Two-line dense per Section 5.2.1; composed from
 *                        payload.optionRows via composeBrainOptionRows().
 *   - Footer:            Stat-strip line `▶ Brain · top-K of N ranked · cyan
 *                        = informing` (payload.footer overrides). Prepended
 *                        to existing footer with a blank-line separator.
 *
 * alias_map: when payload.alias_map is set, contract.alias_map surfaces it
 * for downstream consumers (the selection-time canonical-verb collapse runs
 * in the consumer via aliasToCanonical(verb_chosen, contract.alias_map) per
 * LOCKED decision 1).
 */
function applyBrainSuggestionVariant(rendered, payloadObj) {
  if (!rendered || typeof rendered !== 'object') return rendered;
  if (!rendered.zones || typeof rendered.zones !== 'object') return rendered;

  // Header: enforce the locked chip (allow caller override).
  const header = (typeof payloadObj.header === 'string' && payloadObj.header.length > 0)
    ? payloadObj.header : BRAIN_CHIP;
  rendered.zones.header = header;

  // Body: compose two-line dense option rows + optional question line on top.
  // If optionRows missing, keep the renderer's body (graceful: a Mode B / no-
  // packet caller may legitimately have no rows to render).
  const questionLine = (typeof payloadObj.questionLine === 'string' && payloadObj.questionLine.length > 0)
    ? payloadObj.questionLine : 'Choose next move:';
  if (Array.isArray(payloadObj.optionRows) && payloadObj.optionRows.length > 0) {
    const rowsBlock = composeBrainOptionRows(payloadObj.optionRows);
    rendered.zones.body = questionLine + '\n\n' + rowsBlock;
  }

  // Footer: prepend the stat-strip caption ahead of any existing footer (the
  // AskUserQuestion trailer is appended AFTER this overlay; see pickShape).
  const footer = (typeof payloadObj.footer === 'string' && payloadObj.footer.length > 0)
    ? payloadObj.footer : null;
  if (footer !== null) {
    const existing = rendered.zones.footer;
    if (existing === null || existing === undefined || existing === '') {
      rendered.zones.footer = footer;
    } else {
      rendered.zones.footer = footer + '\n\n' + String(existing);
    }
  }

  // alias_map: surface on contract so downstream selection handlers can
  // call aliasToCanonical(verb_chosen, contract.alias_map) per LOCKED
  // decision 1 (aliases render to user, canonical persists to graph).
  if (payloadObj.alias_map && typeof payloadObj.alias_map === 'object') {
    if (!rendered.contract || typeof rendered.contract !== 'object') {
      rendered.contract = {};
    }
    rendered.contract.alias_map = payloadObj.alias_map;
  }

  // Surface the locked chip as a scalar for introspection without zone parsing.
  rendered.brain_suggestion_chip = BRAIN_CHIP;

  return rendered;
}

function dispatchShapeF(args) {
  const { roomDir, tier, mode, payload } = args;
  const payloadObj = (payload && typeof payload === 'object') ? payload : {};
  const recommendedVerb = (mode === 'A' && typeof payloadObj.recommendedVerb === 'string')
    ? payloadObj.recommendedVerb : null;

  // Read JTBD state -- F.6 path requires non-null jtbd.
  const jtbdState = safeRequire('./jtbd-state.cjs');
  let jtbdId = null;
  if (jtbdState && typeof jtbdState.getCurrent === 'function' && typeof roomDir === 'string') {
    try {
      const current = jtbdState.getCurrent(roomDir);
      jtbdId = (current && typeof current.jtbd === 'string') ? current.jtbd : null;
    } catch (e) {
      jtbdId = null;
    }
  }

  if (jtbdId !== null) {
    const f6 = safeRequire('./shape-f6-renderer.cjs');
    if (f6 && typeof f6.renderShapeF6 === 'function') {
      const result = f6.renderShapeF6({ jtbd: jtbdId, tier, recommendedVerb });
      if (result && !result.error && !result.fallthrough) {
        return { shape: 'F.6', rendered: ensureFreeTextLast(result) };
      }
      // fall through to F.1 path on degenerate / unknown JTBD
    }
  }

  // F.1 path -- prefer Phase 88.2 module if shipped, else fall back to Phase 101's inline canonical-10.
  const f1 = safeRequire('./shape-f1-renderer.cjs') || safeRequire('./shape-f1-fallback.cjs');
  if (f1 && typeof f1.renderShapeF1 === 'function') {
    const result = f1.renderShapeF1({ tier, recommendedVerb });
    return { shape: 'F.1', rendered: ensureFreeTextLast(result) };
  }

  // Neither F.1 nor F.6 module available -- return error.
  return {
    shape: 'error',
    rendered: { error: 'no-f-renderer', detail: 'shape-f1 and shape-f6 modules both missing' },
  };
}

// Phase 188-04: resolve the per-room roomDir the caller threads on the payload
// (either payload.roomDir or payload.roomState.roomDir). Read-only; returns null
// when absent so the state read degrades to null (Part 3 graceful fallback).
function _resolveRoomDirFromPayload(payloadObj) {
  if (!payloadObj || typeof payloadObj !== 'object') return null;
  if (typeof payloadObj.roomDir === 'string' && payloadObj.roomDir.length > 0) return payloadObj.roomDir;
  const rs = payloadObj.roomState;
  if (rs && typeof rs === 'object' && typeof rs.roomDir === 'string' && rs.roomDir.length > 0) return rs.roomDir;
  return null;
}

// Phase 188-04 (SFS-08): read-only current DEPTH state for the F.3 branch. Never
// writes; a cold / absent / unavailable state yields null (degrade-never-block).
function readCurrentDepthState(payloadObj) {
  const roomDir = _resolveRoomDirFromPayload(payloadObj);
  if (roomDir === null) return null;
  const depthState = safeRequire('./depth-state.cjs');
  if (!depthState || typeof depthState.getCurrent !== 'function') return null;
  try {
    const cur = depthState.getCurrent(roomDir);
    return (cur && typeof cur.depth === 'string') ? cur.depth : null;
  } catch (_e) {
    return null;
  }
}

// Phase 188-04 (SFS-09): read-only current accumulated SCOPE state for the F.4
// branch. Never writes; a cold / absent / unavailable state yields [] (graceful).
function readCurrentScopeState(payloadObj) {
  const roomDir = _resolveRoomDirFromPayload(payloadObj);
  if (roomDir === null) return [];
  const scopeState = safeRequire('./harvest-scope-state.cjs');
  if (!scopeState || typeof scopeState.getScope !== 'function') return [];
  try {
    const scope = scopeState.getScope(roomDir);
    return Array.isArray(scope) ? scope : [];
  } catch (_e) {
    return [];
  }
}

/**
 * Phase 88.2-04: direct sub-shape dispatch for F.1..F.5. Each renderer is the
 * Wave-1 module shipped in 88.2-01..03 (open-vocab F.1/F.2/F.5 + closed-vocab
 * F.3/F.4). Mode B Zone-1 prefix and AskUserQuestion trailer are applied at
 * the dispatcher entry point (pickShape) so this helper returns a canonical
 * { shape, rendered } envelope without those concerns.
 */
function dispatchShapeFSubShape(requestedShape, args) {
  const { tier, mode, payload } = args;
  const payloadObj = (payload && typeof payload === 'object') ? payload : {};
  const recommendedVerb = (mode === 'A' && typeof payloadObj.recommendedVerb === 'string')
    ? payloadObj.recommendedVerb : null;
  const callerVerbs = Array.isArray(payloadObj.verbs) ? payloadObj.verbs : undefined;
  const callerHeader = (typeof payloadObj.header === 'string' && payloadObj.header.length > 0)
    ? payloadObj.header : undefined;

  let mod = null;
  let fnName = null;
  let inputArgs = null;
  if (requestedShape === 'F.0') {
    // Phase 88.2-05: F.0 Mini Decision Gate. Closed-vocab (freeTextOffered:false);
    // dispatcher passes only header + body + parent_decision_id pass-through. The
    // renderer ignores any caller-supplied verbs[] or recommendedVerb (closed-vocab
    // is non-negotiable per CONTEXT.md spec body 2026-04-29).
    mod = safeRequire('./shape-f0-renderer.cjs');
    fnName = 'renderShapeF0';
    inputArgs = {
      tier: tier,
      header: callerHeader,
      body: (typeof payloadObj.body === 'string' && payloadObj.body.length > 0) ? payloadObj.body : undefined,
      parent_decision_id: (typeof payloadObj.parent_decision_id === 'string' && payloadObj.parent_decision_id.length > 0)
        ? payloadObj.parent_decision_id : undefined,
    };
  } else if (requestedShape === 'F.1') {
    mod = safeRequire('./shape-f1-renderer.cjs') || safeRequire('./shape-f1-fallback.cjs');
    fnName = 'renderShapeF1';
    inputArgs = { tier: tier, recommendedVerb: recommendedVerb, verbs: callerVerbs, header: callerHeader };
  } else if (requestedShape === 'F.2') {
    mod = safeRequire('./shape-f2-renderer.cjs');
    fnName = 'renderShapeF2';
    inputArgs = { tier: tier, recommendedVerb: recommendedVerb, verbs: callerVerbs, header: callerHeader };
  } else if (requestedShape === 'F.3') {
    // Phase 188-04 (SFS-08): thread the current per-room DEPTH state into the F.3
    // branch so the render can reflect it. The state is read-only here (the write
    // half is the f3-depth-consumer over the caller-owned room). The renderer stays
    // CLOSED-VOCAB: it ignores currentDepth for its option set (no marker, no
    // Free-Text); currentDepth rides alongside {header} as informational context only.
    mod = safeRequire('./shape-f3-renderer.cjs');
    fnName = 'renderShapeF3';
    inputArgs = { header: callerHeader, currentDepth: readCurrentDepthState(payloadObj) };
  } else if (requestedShape === 'F.4') {
    // Phase 188-04 (SFS-09): thread the current per-room accumulated SCOPE state into
    // the F.4 branch (read-only; the write half is the f4-scope-consumer). Closed-vocab
    // is preserved: the renderer ignores currentScope for its ladder (no marker, no
    // Free-Text); currentScope rides alongside {header} as informational context only.
    mod = safeRequire('./shape-f4-renderer.cjs');
    fnName = 'renderShapeF4';
    inputArgs = { header: callerHeader, currentScope: readCurrentScopeState(payloadObj) };
  } else if (requestedShape === 'F.5') {
    mod = safeRequire('./shape-f5-renderer.cjs');
    fnName = 'renderShapeF5';
    inputArgs = { tier: tier, recommendedVerb: recommendedVerb, verbs: callerVerbs, header: callerHeader };
  } else if (requestedShape === 'F.6') {
    // Phase 88.2-06: F.6 Plan Review Round. Closed-vocab parent shape (3 verbs
    // Confirm / Reject / Discuss, freeTextOffered:false; reject reason is captured
    // via a downstream prompt and lands as a property on the REVIEWED edge).
    // Routes to the collision-safe path lib/hmi/shape-f6-plan-review-renderer.cjs;
    // the umbrella 'F' branch above continues to route to Phase 101-01's
    // lib/hmi/shape-f6-renderer.cjs via JTBD logic (R1 invariant preserved).
    mod = safeRequire('./shape-f6-plan-review-renderer.cjs');
    fnName = 'renderShapeF6PlanReview';
    inputArgs = {
      tier: tier,
      header: callerHeader,
      position: (Number.isInteger(payloadObj.position) ? payloadObj.position : undefined),
      totalQuestions: (Number.isInteger(payloadObj.totalQuestions) ? payloadObj.totalQuestions : undefined),
      claim: (typeof payloadObj.claim === 'string' && payloadObj.claim.length > 0)
        ? payloadObj.claim : undefined,
      counts: (payloadObj.counts && typeof payloadObj.counts === 'object') ? payloadObj.counts : undefined,
      round_id: (typeof payloadObj.round_id === 'string' && payloadObj.round_id.length > 0)
        ? payloadObj.round_id : undefined,
      personaContext: (typeof payloadObj.personaContext === 'string' && payloadObj.personaContext.length > 0)
        ? payloadObj.personaContext : undefined,
    };
  } else if (requestedShape === 'F.7') {
    // Phase 188-01 (SFS-06): the "Breakthrough Surface" collapse. Bare F.7 is the
    //   CANONICAL DIAL now, NOT the breakthrough renderer. Per canon D-10 the canon
    //   knows EXACTLY ten shapes; "Breakthrough" is no longer one of them -- it
    //   re-homes to an F.1 next-move (a MOVE, not a shape). The retired
    //   shape-f7-breakthrough-renderer.cjs module stays LIVE as the definitional
    //   home of the 5-verb set + the D-20 provenance HARD FLOOR, but it is no
    //   longer reachable through the bare-F.7 single door (SEED-020). This branch
    //   mirrors the F.7-dial branch below: same safeRequire of dial-selector.cjs,
    //   same renderDialShape envelope. (Historic route, retired here:
    //   shape-f7-breakthrough-renderer.cjs via requestedShape:'F.7'.)
    mod = safeRequire('./dial-selector.cjs');
    fnName = 'renderDialShape';
    inputArgs = {
      investment_level: (typeof payloadObj.investment_level === 'number') ? payloadObj.investment_level : 0.5,
      posture: (typeof payloadObj.posture === 'string') ? payloadObj.posture : 'hold',
      tty: payloadObj.tty === true,
    };
  } else if (requestedShape === 'F.7-dial') {
    // Phase 177-02 (BCH-10 / BCH-16): the four-arrow register HUD branch.
    //   Mirrors the F.7 branch above (safeRequire of a renderer module, the
    //   inputArgs envelope, the { shape, rendered } return). The dial renderer
    //   is lib/hmi/dial-selector.cjs::renderDialHud -- a PURE module (no I/O, no
    //   Brain wire, Part 8 LOCAL). The HUD MOVES the two existing axes
    //   (investment_level up/down, posture left/right over the frozen 3); it
    //   mints NO reach and adds NO shape vocabulary outside this pickShape
    //   branch (Part 3 render contract frozen elsewhere). On a missing module
    //   this falls through to the no-subshape-renderer error envelope below.
    mod = safeRequire('./dial-selector.cjs');
    fnName = 'renderDialShape';
    inputArgs = {
      investment_level: (typeof payloadObj.investment_level === 'number') ? payloadObj.investment_level : 0.5,
      posture: (typeof payloadObj.posture === 'string') ? payloadObj.posture : 'hold',
      tty: payloadObj.tty === true,
    };
  } else if (requestedShape === 'F.8') {
    // Phase 188-06 (SFS-01): the multiSelect Action Set. Mirrors the F.5 branch --
    //   a safeRequire of the renderer + the inputArgs envelope. The renderer emits a
    //   toggle basket (MAX_TOGGLE_N paged, NO single recommended marker; a candidate
    //   at Brain confidence >=0.70 renders PRE-CHECKED but never auto-applies). The
    //   candidate set arrives on payloadObj.options (falling back to payloadObj.verbs);
    //   each option is a string OR { label, confidence } so the >=0.70 pre-check map
    //   threads through. This is the ONLY dispatcher edit in this plan.
    mod = safeRequire('./shape-f8-renderer.cjs');
    fnName = 'renderShapeF8';
    inputArgs = {
      tier: tier,
      options: Array.isArray(payloadObj.options)
        ? payloadObj.options
        : (Array.isArray(payloadObj.verbs) ? payloadObj.verbs : []),
      header: callerHeader,
      personaContext: (typeof payloadObj.personaContext === 'string' && payloadObj.personaContext.length > 0)
        ? payloadObj.personaContext : undefined,
    };
  } else if (requestedShape === 'F.9') {
    // Phase 188-07 (SFS-04): the ordered Cascade / Reconcile Gate. Mirrors the F.5
    //   branch -- a safeRequire of the renderer + the inputArgs envelope. The renderer
    //   emits ONE question per cascade item in ARRAY ORDER (order IS meaning), each
    //   carrying the closed ordered-outcome set APPROVE/REJECT/DEFER (no marker, no
    //   Free-Text; paged past the ceiling, never a live widget -- the TTY wall). The
    //   ordered cascade arrives on payloadObj.items; the header rides callerHeader.
    //   This is the F.9 registration branch (F.8 landed in 188-06, untouched).
    mod = safeRequire('./shape-f9-renderer.cjs');
    fnName = 'renderShapeF9';
    inputArgs = {
      tier: tier,
      items: Array.isArray(payloadObj.items) ? payloadObj.items : [],
      header: callerHeader,
      personaContext: (typeof payloadObj.personaContext === 'string' && payloadObj.personaContext.length > 0)
        ? payloadObj.personaContext : undefined,
    };
  }

  if (!mod || typeof mod[fnName] !== 'function') {
    return {
      shape: 'error',
      rendered: {
        error: 'no-subshape-renderer',
        detail: requestedShape + ' renderer module missing',
      },
    };
  }

  let result;
  try {
    result = mod[fnName](inputArgs);
  } catch (e) {
    return {
      shape: 'error',
      rendered: {
        error: 'subshape-render-failed',
        detail: requestedShape + ': ' + (e && e.message ? String(e.message).slice(0, 80) : 'unknown'),
      },
    };
  }

  if (!result || result.error) {
    return {
      shape: 'error',
      rendered: result || { error: 'subshape-empty', detail: requestedShape },
    };
  }

  return { shape: requestedShape, rendered: ensureFreeTextLast(result) };
}

function dispatchShapeG(args) {
  const { tier, mode, payload } = args;
  const g = safeRequire('./shape-g-renderer.cjs');
  if (!g || typeof g.renderShapeG !== 'function') {
    return { shape: 'error', rendered: { error: 'no-g-renderer' } };
  }
  const inputPayload = Object.assign({}, (payload && typeof payload === 'object') ? payload : {}, {
    tier: tier,
    mode: mode,
  });
  const result = g.renderShapeG(inputPayload);
  if (result && result.fallthrough === true) {
    return { shape: 'E', passthrough: true, fallthroughFrom: 'G', rendered: result };
  }
  return { shape: 'G', rendered: result };
}

function dispatchShapeH(args) {
  const { tier, mode, payload } = args;
  const h = safeRequire('./shape-h-renderer.cjs');
  if (!h || typeof h.renderShapeH !== 'function') {
    return { shape: 'error', rendered: { error: 'no-h-renderer' } };
  }
  const inputPayload = Object.assign({}, (payload && typeof payload === 'object') ? payload : {}, {
    tier: tier,
    mode: mode,
  });
  const result = h.renderShapeH(inputPayload);
  if (result && result.error) {
    return { shape: 'error', rendered: result };
  }
  return { shape: 'H', rendered: result };
}

/**
 * Single entry point.
 */
function pickShape(args) {
  try {
    const opts = (args && typeof args === 'object') ? args : {};
    const requestedShape = typeof opts.requestedShape === 'string' ? opts.requestedShape : '';
    const operator = (typeof opts.operator === 'string' && opts.operator.length > 0) ? opts.operator : null;
    const tier = resolveTier(opts.tier);
    const mode = modeFromTier(tier);

    // Tier 0 refuse path (Canon Part 3 Rule 2). Applies BEFORE operator gates
    // because tier 0 cannot host any selector regardless of operator.
    if (tier === 0) {
      return tier0Refuse();
    }

    // Phase 88.2-04: JUST_TALK operator refuses ALL Shape F.* surfaces. This
    // mirrors render-v2 step 6 (lib/render/render-v2.cjs#244) which suppresses
    // entire output when operator === JUST_TALK. The dispatcher refuses earlier
    // (before invoking renderers) to avoid wasted CPU on a payload that will be
    // dropped downstream.
    const isShapeF = (requestedShape === F_UMBRELLA || F_SUBSHAPES.indexOf(requestedShape) !== -1);
    if (isShapeF && operator === JUST_TALK) {
      return justTalkRefuse(requestedShape);
    }

    let result;
    if (requestedShape === F_UMBRELLA) {
      result = dispatchShapeF({ roomDir: opts.roomDir, tier, mode, payload: opts.payload });
    } else if (F_SUBSHAPES.indexOf(requestedShape) !== -1) {
      result = dispatchShapeFSubShape(requestedShape, { tier, mode, payload: opts.payload });
    } else if (requestedShape === 'G') {
      result = dispatchShapeG({ tier, mode, payload: opts.payload });
    } else if (requestedShape === 'H') {
      result = dispatchShapeH({ tier, mode, payload: opts.payload });
    } else if (
      requestedShape === 'A' || requestedShape === 'B' ||
      requestedShape === 'C' || requestedShape === 'D' ||
      requestedShape === 'E'
    ) {
      return { shape: requestedShape, passthrough: true };
    } else {
      return {
        shape: 'error',
        rendered: { error: 'unknown-shape', detail: 'requestedShape: ' + JSON.stringify(requestedShape) },
      };
    }

    // Mode B Zone 1 prefix (defense-in-depth at dispatcher).
    if (mode === 'B' && result && result.rendered && result.shape !== 'error') {
      applyModeBPrefix(result.rendered);
    }

    // Phase 121.5-10 Sub-plan K: Brain-suggestion variant overlay. Applied
    // BEFORE the AskUserQuestion trailer so the trailer lands AFTER the
    // stat-strip footer per audit Section 5.2. Only fires when payload
    // carries brain_suggestion_variant === true; otherwise no-op (every
    // existing F.* consumer is preserved byte-for-byte).
    if (result && result.shape !== 'error' && !result.passthrough) {
      const payloadObj = (opts.payload && typeof opts.payload === 'object') ? opts.payload : {};
      if (payloadObj.brain_suggestion_variant === true && result.rendered) {
        applyBrainSuggestionVariant(result.rendered, payloadObj);
      }
      // Phase 148-03 (IRW-04, D-03): archetype routing. When the caller names the
      // reach (reach_id / sub_mode / standing-option key) via payload.reachKey,
      // resolve its toggleable-component archetype from reach-component-map.json
      // and fold the AskUserQuestion-mode hints onto the contract. The default
      // 'select' is applied even when reachKey is omitted so every F.* contract
      // carries an explicit archetype. SEED-020: this is the only construction site.
      if (result.rendered) {
        const reachKey = (typeof payloadObj.reachKey === 'string' && payloadObj.reachKey.length > 0)
          ? payloadObj.reachKey : null;
        applyArchetypeRouting(result.rendered, reachKey);
      }
    }

    // Phase 88.2-04: AskUserQuestion structural-marker trailer + telemetry.
    // Both apply ONLY to successful Shape F.* presentations (umbrella resolves
    // to F.1/F.6; sub-shapes resolve to themselves). Error paths and G/H/A-E
    // are NOT touched -- they preserve the existing 9-test contract byte-for-byte.
    //
    // Telemetry is opt-in via `payload.emitTelemetry === true`. This protects
    // Canon Part 8 fs_scope (lib/render/render-v2.cjs invokes the dispatcher
    // for Zone 4 enrichment -- that call is NOT a presentation event and must
    // produce zero FS side-effects). The actual presentation surface (where a
    // human navigator answers an AskUserQuestion prompt) sets the flag to true.
    // The trailer is unconditionally attached: it is part of the rendered
    // surface, not a side-effect.
    if (result && result.shape !== 'error' && !result.passthrough) {
      const isFShape = (typeof result.shape === 'string' && result.shape.indexOf('F') === 0);
      if (isFShape) {
        appendAskUserQuestionTrailer(result.rendered, result.shape);
        const payloadObj = (opts.payload && typeof opts.payload === 'object') ? opts.payload : {};
        if (payloadObj.emitTelemetry === true) {
          emitPresentationTelemetry(opts.roomDir, result.shape, result.rendered, operator);
          // Phase 121-02 D-04: capture selector pick (88.2/125 ranker) into
          // the unified ~/.mindrian/telemetry/v1.13/events-YYYY-WNN.jsonl
          // stream (Plan 121-00 writer chokepoint). Non-blocking; never
          // throws back to caller.
          emitSelectorPickUnified(opts.roomDir, result.shape, result.rendered, payloadObj);
          // Phase 209-06 (H3): the PRIMARY side-channel producer. No
          // session_id reaches this seam (this call site never had one),
          // so the record files under NO_SESSION_KEY; the consumer unions
          // that bucket into every session-scoped read (documented in
          // lib/core/card-fire-sidechannel.cjs). Gated on the SAME
          // emitTelemetry flag as the two calls above (Canon Part 8
          // fs_scope: lib/render/render-v2.cjs's Zone-4 dispatcher call
          // must stay zero-FS). Lazy-required inside try/catch; a writer
          // fault never affects the presentation result.
          // Hoisted above the try below so the Phase 227-04 additive sibling
          // block can read the SAME computed value instead of recomputing
          // the header+body join a second time (D-03 site 1).
          let gateSubjectText = '';
          try {
            const sidechannel = require('../core/card-fire-sidechannel.cjs');
            // 2026-07-05 relevance-gate fix: capture the gate's OWN rendered
            // content (pre-trailer header+body, independent of what the
            // model later says) as the subject text signal.
            gateSubjectText = [
              result.rendered && result.rendered.zones && result.rendered.zones.header,
              result.rendered && result.rendered.zones && result.rendered.zones.body,
            ].filter(function (s) { return typeof s === 'string' && s.length > 0; }).join(' ');
            sidechannel.recordReachedGate({
              surface: 'lib/hmi/selector-dispatcher.cjs',
              shape: result.shape,
              subjectText: gateSubjectText,
            });
          } catch (_e) {
            /* never let a side-channel fault affect the presentation result */
          }
          // Phase 227-04 (D-03 site 1, T-227-10/T-227-11): additive sibling to
          // the card-fire-sidechannel call above. This records specifically
          // the F.1 mode-select lane-picker card fire (skills/conversation-
          // mode/SKILL.md's "Are we just chatting, brainstorming, or building
          // something?" card), NOT every F.1 gate in the app -- F.1 is also
          // used by other Decision Gates (for example trending-to-absurd's
          // own trend-selection stage also renders as F.1). The subject-text
          // scoping check below (both "brainstorming" and "building
          // something" present, case-insensitive) is what narrows the
          // recording to the mode-select card specifically. Only 'lane:
          // card-fired' is knowable here (the trailer fires at render time,
          // before the navigator answers); sessionId is not in scope at this
          // call site either, matching the existing card-fire-sidechannel
          // producer's own NO_SESSION_KEY gap at this exact location --
          // mode-select-sidechannel.cjs's union-read already accounts for
          // this. Wrapped in its own try/catch (isolated from the block
          // above) so a fault here never affects the existing block or the
          // presentation result.
          try {
            if (result.shape === 'F.1') {
              const subjectLower = gateSubjectText.toLowerCase();
              if (
                subjectLower.indexOf('brainstorming') !== -1 &&
                subjectLower.indexOf('building something') !== -1
              ) {
                require('../core/mode-select-sidechannel.cjs').recordLanePick({
                  lane: 'card-fired',
                });
              }
            }
          } catch (_e) {
            /* never let a side-channel fault affect the presentation result */
          }
        }
      }
    }

    return result;
  } catch (e) {
    return {
      shape: 'error',
      rendered: {
        error: 'dispatch-failed',
        detail: (e && e.message ? String(e.message).slice(0, 80) : 'unknown'),
      },
    };
  }
}

/**
 * Phase 88.2-04: re-export of selector-telemetry.recordResponse so consumers
 * wiring AskUserQuestion answers back to the local ledger have a single
 * dispatcher-level entry point. Wrapped in try/catch -- never fails Larry's turn.
 */
function recordSelectorResponse(roomDir, record) {
  try {
    const tel = safeRequire('./selector-telemetry.cjs');
    if (!tel || typeof tel.recordResponse !== 'function') return;
    tel.recordResponse(roomDir, record);
  } catch (_e) {
    // Graceful.
  }
}

module.exports = {
  pickShape: pickShape,
  recordSelectorResponse: recordSelectorResponse,
  // Phase 150.5-02 (DIAL-ATOM-01): the SEED-020 single construction door,
  // exported top-level so the engine render caller (intent-classifier.cjs
  // renderEngineDecisionWithDial) threads the dial contract through the
  // dispatcher instead of composing the trailer anywhere else.
  appendAskUserQuestionTrailer: appendAskUserQuestionTrailer,
  // Phase 121.5-10 Sub-plan K: alias-to-canonical helper for graph-edge
  // persistence per LOCKED decision 1 (aliases render to user; canonical
  // verbs persist via navigation.cjs).
  aliasToCanonical: aliasToCanonical,
  // Phase 148-03 (IRW-04, D-03): the reach -> toggleable-component-archetype
  // resolver. Reads lib/hmi/reach-component-map.json (registry-is-the-table).
  resolveArchetype: resolveArchetype,
  _internal: {
    resolveArchetype: resolveArchetype,
    archetypeToContractHints: archetypeToContractHints,
    applyArchetypeRouting: applyArchetypeRouting,
    resolveTier: resolveTier,
    modeFromTier: modeFromTier,
    ensureFreeTextLast: ensureFreeTextLast,
    applyModeBPrefix: applyModeBPrefix,
    appendAskUserQuestionTrailer: appendAskUserQuestionTrailer,
    emitPresentationTelemetry: emitPresentationTelemetry,
    justTalkRefuse: justTalkRefuse,
    applyBrainSuggestionVariant: applyBrainSuggestionVariant,
    composeBrainOptionRows: composeBrainOptionRows,
    MODE_B_ZONE1_PREFIX: MODE_B_ZONE1_PREFIX,
    F_SUBSHAPES: F_SUBSHAPES.slice(),
    JUST_TALK: JUST_TALK,
    COMPACTION_VIOLATION_CODE: COMPACTION_VIOLATION_CODE,
    BRAIN_CHIP: BRAIN_CHIP,
    BRAIN_GLYPH_RECOMMENDED: BRAIN_GLYPH_RECOMMENDED,
    BRAIN_GLYPH_ALTERNATIVE: BRAIN_GLYPH_ALTERNATIVE,
  },
};
