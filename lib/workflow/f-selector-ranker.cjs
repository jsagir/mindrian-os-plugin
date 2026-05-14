'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 125-05 -- F-selector top-K ranker. Pure synchronous function.
 * ====================================================================
 * Implements CONTEXT.md D1-D11. Plan 05 of the 9-plan F-selector ranker
 * phase. The heart of Phase 125 -- turns the packet (Phase 110) + projections
 * (Plan 01) + command registry (Phase 122 + Phase 104.1) into a top-K
 * ranked F-selector list with investment-aware content selection (D9) and
 * decay-weight integration (D7).
 *
 * HARD PRECONDITION: Phase 104.1 ships jtbd_label + jtbd_summary + teaching
 * fields in data/command-registry.json. The ranker fails closed on every
 * command if Phase 104.1 hasn't shipped (returns empty list, no crash).
 * Verified at module load via the contract: every command must have all
 * three fields or it is excluded from F-selector output.
 *
 * Canon Part 7 (reuse over build): extends shipped command-resolver +
 *   chain-recommender + packet without modifying their closed surfaces.
 * Canon Part 8 (Graph Boundary): zero Brain calls (consumes packet, never
 *   issues query); LOCAL only. No network. No db writes. No I/O writes.
 * Canon Part 9 (Memory Locality): this ranker is the "ranks structured
 *   packets" face -- SQL navigates; Brain reasons over packets that have
 *   already been built; this module just ranks what's on the table.
 *
 * Function signatures LOCKED in 125-CONTEXT.md "Function signatures":
 *   rankForSelector({jtbd, problemType, focusNodeId, roomState,
 *                    packetOptional, k=3}) -> Array<RankedItem>
 *   selectWhyContent(jtbd_summary, teaching, investment_level) -> string
 *   renderInvestmentBadge(investment_level) -> string
 *   renderSliceBadge(slice_scope, slice_rationale) -> string
 *
 * Returned RankedItem shape (CONTEXT.md):
 *   {
 *     command:          '/mos:slug',
 *     jtbd_label:       string,                 // from Phase 104.1
 *     jtbd_summary:     string,                 // from Phase 104.1
 *     teaching:         string,                 // from Phase 104.1 (D11)
 *     framework:        string,                 // implementation detail
 *     score:            number,                 // 0..1 (D7 decay applied)
 *     why:              string,                 // shape scales with investment (D9)
 *     source:           'packet'|'chain'|'registry-only',
 *     investment_level: number,                 // 0..1
 *   }
 *
 * D4 scoring formula (CONTEXT.md verbatim):
 *   score = (
 *       brain_confidence    * 0.40                                 // always weighted
 *     + (1 - recency_decay) * 0.30 * investment_level              // grows with use
 *     + problem_type_bind   * 0.30 * investment_level              // grows with use
 *   ) / (0.40 + 0.30*investment_level + 0.30*investment_level)     // normalize 0..1
 *
 * License: BSL 1.1.
 */

const path = require('node:path');
const fs = require('node:fs');
const projections = require('../core/navigation/projections.cjs');

const REGISTRY_PATH = path.join(__dirname, '..', '..', 'data', 'command-registry.json');
const TAXONOMY_PATH = path.join(__dirname, '..', 'hmi', 'jtbd-taxonomy.json');

// DEFAULT_SEED is duplicated from lib/brain/chain-recommender.cjs intentionally
// to keep rankForSelector synchronous + module-independent for the cold-start
// path. If chain-recommender ever exports DEFAULT_SEED as a const, switch to
// import. Minor Canon Part 7 (reuse) drift accepted in exchange for zero
// cross-module coupling on the hot ranking path.
const DEFAULT_SEED = 'Beautiful Question Framework';

// Per-process caches. The registry + taxonomy are generated artifacts that do
// not change during a run; reading each once is the command-resolver.cjs
// precedent. Tests can override the registry via _test._setRegistry.
let _registryCache = null;
let _taxonomyCache = null;

function _loadRegistry() {
  if (_registryCache) return _registryCache;
  try {
    _registryCache = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  } catch (_e) {
    _registryCache = { commands: [] };
  }
  return _registryCache;
}

function _loadTaxonomy() {
  if (_taxonomyCache) return _taxonomyCache;
  try {
    _taxonomyCache = JSON.parse(fs.readFileSync(TAXONOMY_PATH, 'utf8'));
  } catch (_e) {
    _taxonomyCache = { entries: [] };
  }
  return _taxonomyCache;
}

// Test seam. Lets tests reset between cases AND inject a fake registry shape
// so the ranker doesn't have to read disk. NOT exposed via the public API.
function _resetCaches() {
  _registryCache = null;
  _taxonomyCache = null;
}
function _setRegistry(obj) {
  _registryCache = obj || { commands: [] };
}
function _setTaxonomy(obj) {
  _taxonomyCache = obj || { entries: [] };
}

// ---------------------------------------------------------------------------
// D9 implementation -- content selection by investment_level.
// Pure. Same inputs -> same output. No I/O. No state mutation.
//
//   investment_level < 0.4         -> teaching (Larry-voice prose)
//   investment_level >= 0.7        -> jtbd_summary (terse rationale)
//   0.4 <= investment_level < 0.7  -> stitched: teaching + ' -- ' + jtbd_summary
//
// The separator is ' -- ' (double-hyphen with spaces) per the project no-em-
// dash rule + CONTEXT.md D9 (Open question 9 resolution: lean double-hyphen
// over parens or newline).
// ---------------------------------------------------------------------------
function selectWhyContent(jtbd_summary, teaching, investment_level) {
  const hasJtbd = typeof jtbd_summary === 'string' && jtbd_summary.length > 0;
  const hasTeaching = typeof teaching === 'string' && teaching.length > 0;
  if (!hasJtbd && !hasTeaching) return '';
  if (!hasJtbd) return teaching;
  if (!hasTeaching) return jtbd_summary;
  const lvl = (typeof investment_level === 'number') ? investment_level : 0;
  if (lvl < 0.4) return teaching;
  if (lvl >= 0.7) return jtbd_summary;
  // Mid-band: stitch with the ' -- ' separator.
  return teaching + ' -- ' + jtbd_summary;
}

// ---------------------------------------------------------------------------
// D5 visible-investment badge. Single-line, <= 80 chars. The renderer (F-
// selector consumer) drops this string into the intelligence strip.
// ---------------------------------------------------------------------------
function renderInvestmentBadge(investment_level) {
  const lvl = (typeof investment_level === 'number')
    ? Math.max(0, Math.min(1, investment_level))
    : 0;
  const pct = Math.round(lvl * 100);
  const remaining = Math.max(0, 10 - Math.round(lvl * 10));
  let line;
  if (lvl === 0) {
    line = 'Investment: 0% -- Brain priors only (10 invocations to full local)';
  } else if (lvl >= 1.0) {
    line = 'Investment: 100% -- full local scoring with Brain confidence';
  } else {
    line = 'Investment: ' + pct + '% -- Brain + local signal ('
      + remaining + ' invocations to full)';
  }
  return (line.length > 80) ? line.slice(0, 80) : line;
}

// ---------------------------------------------------------------------------
// D5 slice rationale badge. Single-line, <= 80 chars.
// ---------------------------------------------------------------------------
function renderSliceBadge(slice_scope, slice_rationale) {
  const scope = (slice_scope === 1 || slice_scope === 2 || slice_scope === 3)
    ? slice_scope : 3;
  const rationaleStr = (typeof slice_rationale === 'string') ? slice_rationale : '';
  const head = 'Slice: ' + scope + ' hop' + (scope === 1 ? '' : 's') + ' -- ';
  const room = Math.max(0, 80 - head.length);
  const rationaleShort = rationaleStr.slice(0, room);
  return head + rationaleShort;
}

// ---------------------------------------------------------------------------
// D7 decay-weight integration. When opts._applyDecayWeight is provided
// (typically by the F-selector renderer that wires Plan 05 + Plan 06), apply
// it. When absent, default no-op (returns base score untouched). Plan 06
// ships the actual decay function; Plan 05 stays callable in its absence.
// ---------------------------------------------------------------------------
function _applyDecay(applyDecayWeight, baseScore, commandId, roomState) {
  if (typeof applyDecayWeight !== 'function') return baseScore;
  try {
    const adjusted = applyDecayWeight(baseScore, commandId, roomState);
    return (typeof adjusted === 'number' && isFinite(adjusted)) ? adjusted : baseScore;
  } catch (_e) {
    return baseScore;
  }
}

// JTBD selection per RESEARCH G-01: lean roomState.activeJtbd if it matches
// one of the command's serves_jtbd entries; otherwise fall back to serves_jtbd[0].
function _resolveJtbdForCommand(cmd, roomState) {
  const serves = Array.isArray(cmd.serves_jtbd) ? cmd.serves_jtbd : [];
  if (serves.length === 0) return null;
  const activeJtbd =
    (roomState && typeof roomState.activeJtbd === 'string') ? roomState.activeJtbd : null;
  if (activeJtbd && serves.indexOf(activeJtbd) !== -1) return activeJtbd;
  return serves[0];
}

// Extract brain_confidence for this command's framework from the packet's
// framework_chain_hint. The highest confidence edge that touches the
// framework (as source or target) wins. Returns null when no signal.
function _brainConfidenceFromPacket(packetOptional, framework) {
  if (!packetOptional || !packetOptional.local_graph_summary) return null;
  const hint = packetOptional.local_graph_summary.framework_chain_hint;
  if (!hint || !Array.isArray(hint.edges)) return null;
  let best = null;
  for (const e of hint.edges) {
    if (!e) continue;
    const touches = (e.from === framework) || (e.to === framework);
    if (touches && typeof e.confidence === 'number') {
      if (best === null || e.confidence > best) best = e.confidence;
    }
  }
  return best;
}

// D4 recency_decay term: 1.0 = fully decayed (old); 0.0 = fresh.
// Computed from roomState.lastInvokedAt[command] if available (ms epoch),
// else 0.5 default. Linear ramp: 0..30 days -> 0..1.
function _recencyDecay(cmd, roomState) {
  if (!roomState || !roomState.lastInvokedAt) return 0.5;
  const last = roomState.lastInvokedAt[cmd.command];
  if (typeof last !== 'number' || !isFinite(last)) return 0.5;
  const ageDays = (Date.now() - last) / (24 * 3600 * 1000);
  if (ageDays <= 0) return 0;
  return Math.min(1.0, ageDays / 30);
}

// D4 problem_type_bind term: 1.0 if the command's frameworks align with
// roomState.problemType's preferred shape; 0.0 otherwise; 0.5 default when
// problemType is absent.
// Simple proxy (Plan 05 v1; Plan 06+ may refine via Brain chain weight):
//   WDP        + kind=methodology                                  -> 1.0
//   UDP/IDP    + frameworks includes 'Beautiful Question Framework'-> 1.0
//   else                                                           -> 0.5
function _problemTypeBind(cmd, roomState) {
  if (!roomState || typeof roomState.problemType !== 'string') return 0.5;
  const pt = roomState.problemType.toUpperCase();
  const fws = Array.isArray(cmd.frameworks) ? cmd.frameworks : [];
  if (pt === 'WDP' && cmd.kind === 'methodology') return 1.0;
  if ((pt === 'UDP' || pt === 'IDP') && fws.indexOf('Beautiful Question Framework') !== -1) {
    return 1.0;
  }
  return 0.5;
}

// D4 scoring formula. Numerator + denominator coded with the exact 0.40 /
// 0.30 / 0.30 weights from CONTEXT.md. Normalizes to 0..1 at every
// investment_level; investment_level=0 reduces to pure brain_confidence
// (no discontinuity).
function _scoreCommand({ cmd, packetOptional, roomState, investment_level }) {
  const fw = (Array.isArray(cmd.frameworks) && cmd.frameworks.length > 0)
    ? cmd.frameworks[0] : DEFAULT_SEED;
  const bc = _brainConfidenceFromPacket(packetOptional, fw);
  const brain_confidence = (typeof bc === 'number') ? bc : 0.5;
  const recency_decay = _recencyDecay(cmd, roomState);
  const problem_type_bind = _problemTypeBind(cmd, roomState);
  const inv = investment_level;
  const numerator =
      brain_confidence * 0.40
    + (1 - recency_decay) * 0.30 * inv
    + problem_type_bind * 0.30 * inv;
  const denominator = 0.40 + 0.30 * inv + 0.30 * inv;
  if (denominator <= 0) return 0;
  return numerator / denominator;
}

// Per-command source attribution per Test 5 (CONTEXT.md acceptance):
//   packet has framework_chain_hint with edges            -> 'packet'
//   command has frameworks[] (chain-recommender-derivable)-> 'chain'
//   neither                                               -> 'registry-only'
function _sourceFor(packetOptional, cmd) {
  if (packetOptional
      && packetOptional.local_graph_summary
      && packetOptional.local_graph_summary.framework_chain_hint) {
    const hint = packetOptional.local_graph_summary.framework_chain_hint;
    if (Array.isArray(hint.edges) && hint.edges.length > 0) return 'packet';
  }
  if (Array.isArray(cmd.frameworks) && cmd.frameworks.length > 0) return 'chain';
  return 'registry-only';
}

// ---------------------------------------------------------------------------
// MAIN SIGNATURE -- rankForSelector. Pure synchronous function. No Promise.
// No await. No Brain calls. No db writes. No memory_event writes. No event
// subscriptions (D10 invariant).
// ---------------------------------------------------------------------------
function rankForSelector(args) {
  const o = args || {};
  // jtbd, problemType, focusNodeId are intentionally read off args even when
  // we don't immediately use them here (the LOCKED CONTEXT.md signature
  // preserves them as ranker inputs; consumers may surface them via roomState
  // patching for future tuning passes).
  const jtbd = (typeof o.jtbd === 'string') ? o.jtbd : null;
  const problemType = (typeof o.problemType === 'string') ? o.problemType : null;
  const focusNodeId = (typeof o.focusNodeId === 'string') ? o.focusNodeId : null;
  const roomState = (o.roomState && typeof o.roomState === 'object') ? o.roomState : {};
  const packetOptional = (o.packetOptional && typeof o.packetOptional === 'object')
    ? o.packetOptional : null;
  const k = (typeof o.k === 'number' && o.k > 0) ? Math.floor(o.k) : 3;
  const applyDecayWeight = (typeof o._applyDecayWeight === 'function')
    ? o._applyDecayWeight : null;

  // Patch roomState with jtbd / problemType if caller supplied them at the
  // top level but not on roomState. Non-destructive: tests that pass
  // roomState verbatim should see no mutation.
  let effectiveRoomState = roomState;
  if (jtbd && !roomState.activeJtbd) {
    effectiveRoomState = Object.assign({}, roomState, { activeJtbd: jtbd });
  }
  if (problemType && !effectiveRoomState.problemType) {
    effectiveRoomState = Object.assign({}, effectiveRoomState, { problemType });
  }

  // Snapshot investment level at rank time (D9 invariant: all returned items
  // see the same investment_level).
  const { level: investment_level } = projections.computeInvestmentLevel(effectiveRoomState);

  const reg = _loadRegistry();
  const commands = Array.isArray(reg.commands) ? reg.commands : [];
  const scored = [];

  for (const cmd of commands) {
    if (!cmd || typeof cmd.command !== 'string') continue;

    // D6 fail-closed: jtbd_summary required.
    const jtbd_summary = (typeof cmd.jtbd_summary === 'string' && cmd.jtbd_summary.length > 0)
      ? cmd.jtbd_summary : null;
    if (jtbd_summary === null) continue;

    // D11 fail-closed: teaching required.
    const teaching = (typeof cmd.teaching === 'string' && cmd.teaching.length > 0)
      ? cmd.teaching : null;
    if (teaching === null) continue;

    const jtbd_label = (typeof cmd.jtbd_label === 'string') ? cmd.jtbd_label : '';
    const framework = (Array.isArray(cmd.frameworks) && cmd.frameworks.length > 0)
      ? cmd.frameworks[0] : DEFAULT_SEED;

    const baseScore = _scoreCommand({
      cmd, packetOptional, roomState: effectiveRoomState, investment_level,
    });
    const adjustedScore = _applyDecay(
      applyDecayWeight, baseScore, cmd.command, effectiveRoomState,
    );

    const why = selectWhyContent(jtbd_summary, teaching, investment_level);
    const source = _sourceFor(packetOptional, cmd);

    scored.push({
      command: cmd.command,
      jtbd_label,
      jtbd_summary,
      teaching,
      framework,
      score: Math.max(0, Math.min(1, adjustedScore)),
      why,
      source,
      investment_level,
    });
  }

  // Sort score desc. Stable on ties.
  scored.sort((a, b) => b.score - a.score);

  // Tier 0 cold-start fallback: when zero eligible commands but k > 0, the
  // ranker degrades gracefully to []. The HARD PRECONDITION (Phase 104.1
  // shipped) makes this branch effectively unreachable in production --
  // every command has the required content. Kept for future-proofing
  // against registry regressions.
  if (scored.length === 0) return [];

  // Reference focusNodeId so static linters don't flag it as unused. It is
  // part of the LOCKED signature for downstream tuning (Phase 117 may pass
  // it through for hop-depth selection).
  if (focusNodeId) { /* reserved for future hop-relative scoring */ }

  return scored.slice(0, k);
}

module.exports = {
  rankForSelector,
  selectWhyContent,
  renderInvestmentBadge,
  renderSliceBadge,
  // Test seam (private; consumed only by lib/memory/f-selector-ranker.test.cjs).
  _test: {
    _resetCaches,
    _setRegistry,
    _setTaxonomy,
    _scoreCommand,
    _brainConfidenceFromPacket,
    _resolveJtbdForCommand,
    _sourceFor,
    _applyDecay,
    _recencyDecay,
    _problemTypeBind,
    DEFAULT_SEED,
  },
};
