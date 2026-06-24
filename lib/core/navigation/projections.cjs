'use strict';
// Phase 125-01 -- pure projection helpers for f-selector-ranker (Plan 05 consumer).
// All three functions are pure + synchronous; they project roomState into the
// three signals D4's scoring formula consumes. No I/O. No Brain calls. No db
// writes. Database READS via existing navigation primitives only -- no direct
// room-db access.
//
// Canon Part 9: SQL remembers and navigates; these helpers are the "navigate"
// projections over the local mind that the ranker reads BEFORE making its
// recommendation. Canon Part 7: extension of navigation/, not modification of
// navigation.cjs's closed surface. Plan 05 may require these directly from
// projections.cjs OR via navigation.cjs re-export -- Plan 01 ships the
// projections; navigation.cjs re-export is OPTIONAL (deferred to Plan 05 if
// preferred to avoid the closed-surface widening discussion).
//
// Function signatures (LOCKED in 125-CONTEXT.md "Function signatures (LOCKED)"):
//   resolveActiveFrameworks(roomState) -> Array<{name, weight, source}>
//   resolveHopDepth(roomState)         -> {depth: 1|2|3, rationale: string}
//   computeInvestmentLevel(roomState)  -> {level: number, label: string}
//
// roomState shape (extends the chain-recommender.cjs shape per RESEARCH G-03 + G-04):
//   {
//     problemType?: 'UDP'|'IDP'|'WDP'|string,
//     governing_thought?: string,
//     activeJtbd?: string,
//     brainAnchors?: string[],
//     framework_invocations?: number,    // from COUNT(memory_event WHERE event_type='framework_invoked')
//     feedsIntoEdges?: Edge[],
//     brainSection?: object,
//     brainSections?: object,
//     recentFrameworks?: string[],       // from findRecentChanges memory_event 'framework_invoked'
//   }

// Common frameworks in the Brain teaching graph -- used as substring hints
// when extracting from governing_thought free-text. NOT exhaustive (the Brain
// has 100+ frameworks); just the high-traffic ones for early-room
// governing_thought parsing. Plan 05 may extend this list or replace with a
// registry-derived superset; the projection helper is just a substring scan.
const KNOWN_FRAMEWORK_HINTS = Object.freeze([
  'Beautiful Question Framework', 'Mullins 7 Domains', 'SWOT', 'Porter Five Forces',
  'JTBD', 'Jobs to be Done', 'Lean Canvas', 'Business Model Canvas',
  'Six Thinking Hats', 'Cynefin', 'Root Cause Analysis', 'First Principles',
  'Wardley Map', 'OKR', 'Scenario Planning', 'Design Thinking',
]);

function _extractFrameworkFromThought(text) {
  if (typeof text !== 'string' || text.length === 0) return null;
  for (const fw of KNOWN_FRAMEWORK_HINTS) {
    if (text.indexOf(fw) !== -1) return fw;
  }
  return null;
}

// Resolve a JTBD id to a framework name via:
//   jtbd-taxonomy.json (entry.methodology_hooks[0]) -> command slug
//   command-registry.json (commands[].command) -> first frameworks[]
// Synchronous, fs-only read. Returns null on any failure -- never throws.
// Mirrors lib/brain/chain-recommender.cjs::_jtbdToFramework (same fs pattern,
// same fail-soft contract). Plan 05 may share the registry via injection if
// it wants to centralize the cache; Plan 01 just reads.
function _jtbdToFramework(activeJtbd) {
  if (typeof activeJtbd !== 'string' || activeJtbd.length === 0) return null;
  const path = require('node:path');
  const fs = require('node:fs');
  const TAXONOMY_PATH = path.join(__dirname, '..', '..', 'hmi', 'jtbd-taxonomy.json');
  const REGISTRY_PATH = path.join(__dirname, '..', '..', '..', 'data', 'command-registry.json');
  let tax;
  let reg;
  try { tax = JSON.parse(fs.readFileSync(TAXONOMY_PATH, 'utf8')); } catch (_e) { return null; }
  try { reg = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8')); } catch (_e) { return null; }
  const entry = (tax.entries || []).find((e) => e && e.id === activeJtbd);
  if (!entry || !Array.isArray(entry.methodology_hooks) || entry.methodology_hooks.length === 0) return null;
  const firstHook = entry.methodology_hooks[0]; // e.g. '/mos:beautiful-question' or 'mos:beautiful-question'
  if (typeof firstHook !== 'string') return null;
  const parts = firstHook.split(':');
  if (parts.length < 2) return null;
  const slug = parts.slice(1).join(':');
  const cmd = (reg.commands || []).find((c) => c && typeof c.command === 'string' && c.command.split(':').slice(1).join(':') === slug);
  return (cmd && Array.isArray(cmd.frameworks) && cmd.frameworks.length > 0) ? cmd.frameworks[0] : null;
}

// Phase 150-04 (MEM-07): the brainAnchors PRODUCER -- closes the orphaned
// consumer at resolveActiveFrameworks (the weight-0.5 brain_md signal at :108
// consumed roomState.brainAnchors but nothing populated it).
//
// deriveBrainAnchors(cortexNodes) reads the projected BRAIN-derivation cortex
// node (the BRAIN-kind memory_artifact surfaced by getRoomContext legD, Phase
// 150-04 Task 2) and returns the generic framework-name handles Phase 90 derives
// (the BRAIN node's properties.anchors array). Part 8: only generic framework-name
// handles flow -- never BRAIN.md prose (threat T-150-04-03). Defensive: returns []
// on any malformed/absent input; never throws.
//
// CHOSEN PRODUCER SITE: projections.cjs (this module), NOT the getRoomContext->
// roomState adapter. Rationale: resolveActiveFrameworks lives here and consumes
// roomState.brainAnchors here, so co-locating the producer keeps the brain_md
// signal's producer + consumer in one auditable module; the caller assembles
// roomState.brainAnchors = deriveBrainAnchors(roomContext.cortexNodes) before
// calling resolveActiveFrameworks. resolveActiveFrameworks stays the PURE consumer.
function deriveBrainAnchors(cortexNodes) {
  if (!Array.isArray(cortexNodes) || cortexNodes.length === 0) return [];
  const out = [];
  const seen = new Set();
  for (const n of cortexNodes) {
    if (!n || typeof n !== 'object' || n.type !== 'memory_artifact') continue;
    const props = (n.properties && typeof n.properties === 'object') ? n.properties : {};
    if (props.kind !== 'BRAIN') continue;
    const anchors = Array.isArray(props.anchors) ? props.anchors : [];
    for (const a of anchors) {
      // Generic framework-name handles only -- a string, no prose. Part 8.
      if (typeof a === 'string' && a.length > 0 && !seen.has(a)) {
        seen.add(a);
        out.push(a);
      }
    }
  }
  return out;
}

// D1 -- Active-framework multi-signal projection.
// Precedence (highest -> lowest weight):
//   1.00  governing_thought  (CONTEXT signal, Phase 90)
//   0.75  activeJtbd         (INTENT signal, /mos:jtbd via taxonomy)
//   0.50  brainAnchors       (MEMORY signal, BRAIN.md anchors per Phase 90)
//   0.25  recentFrameworks   (TEMPORAL signal, memory_event 'framework_invoked' recency)
// First-write-wins per framework name (a framework already claimed by a higher
// signal does NOT also appear at a lower one). Empty array on empty roomState.
function resolveActiveFrameworks(roomState) {
  if (!roomState || typeof roomState !== 'object') return [];
  const out = new Map(); // name -> {name, weight, source}

  // 1. governing_thought (CONTEXT signal, weight 1.0)
  if (typeof roomState.governing_thought === 'string' && roomState.governing_thought.length > 0) {
    const fw = _extractFrameworkFromThought(roomState.governing_thought);
    if (fw) out.set(fw, { name: fw, weight: 1.0, source: 'governing_thought' });
  }

  // 2. activeJtbd (INTENT signal, weight 0.75)
  if (typeof roomState.activeJtbd === 'string' && roomState.activeJtbd.length > 0) {
    const fw = _jtbdToFramework(roomState.activeJtbd);
    if (fw && !out.has(fw)) {
      out.set(fw, { name: fw, weight: 0.75, source: 'activeJtbd' });
    }
  }

  // 3. BRAIN.md anchors (MEMORY signal, weight 0.5)
  if (Array.isArray(roomState.brainAnchors)) {
    for (const a of roomState.brainAnchors) {
      if (typeof a === 'string' && a.length > 0 && !out.has(a)) {
        out.set(a, { name: a, weight: 0.5, source: 'brain_md' });
      }
    }
  }

  // 4. memory_event recency (TEMPORAL signal, weight 0.25)
  if (Array.isArray(roomState.recentFrameworks)) {
    for (const a of roomState.recentFrameworks) {
      if (typeof a === 'string' && a.length > 0 && !out.has(a)) {
        out.set(a, { name: a, weight: 0.25, source: 'memory_event' });
      }
    }
  }

  return Array.from(out.values()).sort((a, b) => b.weight - a.weight);
}

// D2 -- Variable hop depth, context-driven.
// Defaults to depth 3 (WIDE) on ambiguity per CONTEXT.md.
//   depth 1: WDP + strong governing_thought (execution mode)
//   depth 2: IDP (exploratory mode); or WDP without governing_thought
//   depth 3: wicked / undefined / no anchor (default WIDE)
function resolveHopDepth(roomState) {
  if (!roomState || typeof roomState !== 'object') {
    return { depth: 3, rationale: 'no roomState provided; defaulting WIDE on ambiguity' };
  }
  const problemType = roomState.problemType;
  const hasGoverningThought =
    typeof roomState.governing_thought === 'string' && roomState.governing_thought.length > 0;
  if (problemType === 'WDP' && hasGoverningThought) {
    return {
      depth: 1,
      rationale: 'well-defined state with strong governing_thought; execution mode',
    };
  }
  if (problemType === 'IDP') {
    return {
      depth: 2,
      rationale: 'ill-defined state; evolving governing_thought; exploratory mode',
    };
  }
  if (problemType === 'WDP') {
    return {
      depth: 2,
      rationale: 'well-defined problemType but no governing_thought; moderate slice',
    };
  }
  return {
    depth: 3,
    rationale: 'wicked or undefined state; no anchor; defaulting WIDE on ambiguity',
  };
}

// D3 -- Continuous investment gradient (Phase 177 BCH-S1: + runtime turn_count term).
//   base  = framework_invocations / 10        (D3, Phase 125 -- the original term)
//   turn  = turn_count / TURN_DIVISOR          (Phase 177 -- the NEW per-turn runtime term)
//   level = min(1.0, max(0.0, base + turn))    (ADDITIVE; clamped to [0,1])
//   level === 0       -> "fresh room, ranking with Brain priors"
//   0 < level < 0.5   -> "warming up: Brain + early local signal"
//   0.5 <= level < 1  -> "balanced: Brain + memory equal weight"
//   level === 1.0     -> "full local scoring with Brain confidence"
// Caps at 1.0; floors at 0.0 for missing or negative counters. Drives D4's
// scoring formula:
//   score = brain_confidence*0.40 + (1-recency_decay)*0.30*investment_level
//         + problem_type_bind*0.30*investment_level
//   (normalized to 0..1)
//
// Phase 177 BCH-S1 (D-177-Q5): investment_level is THE single canonical runtime
// number. This extends it to fold in a NEW runtime turn_count term ADDITIVELY on
// top of the existing framework_invocations term. The function stays PURE (same
// inputs -> same output, no I/O). When roomState.turn_count is absent or non-number
// the turn term contributes 0, so every framework_invocations-only caller (and the
// test-f-selector-ranker + navigation-projections suites) stays byte-stable.
//
//   turn_count: the per-turn runtime counter (a number; absent / non-number / negative
//     contributes 0, mirroring the framework_invocations defensive read above). TURN_DIVISOR
//     is 20 so a deep multi-turn conversation ramps the gradient gently relative to the
//     framework term (10 framework invocations or 20 turns each reach full local on their own).
//
//   Reserved jump-condition fields (read-if-present, default no-op; the deterministic jumps
//   -- escape hatch / saturation / pushback / evidence -- are folded in by LATER WAVES; named
//   here so the canonical number has one documented home and absent fields never alter the
//   result): roomState.investment_jump_escape_hatch, .investment_jump_saturation,
//   .investment_jump_pushback, .investment_jump_evidence -- each, when a finite number, adds
//   ADDITIVELY before the clamp; absent / non-number contributes 0. Wave 1 ships the read-if-
//   present plumbing only; no caller sets them yet, so behavior is unchanged today.
//
// The prose Ask-Tell dial is INJECTED from this number in Pass 2 (a later wave), NOT computed
// by the model (D-177-Q5). This function adds NO prompt-side dial computation.
const TURN_DIVISOR = 20;

function _finiteNonNegative(v) {
  return (typeof v === 'number' && Number.isFinite(v)) ? Math.max(0, v) : 0;
}

function _jumpTerm(roomState, key) {
  // Read-if-present reserved jump condition. Absent / non-number -> 0 (no-op).
  // Negative jumps are NOT floored to 0 here (a future wave may model a pull-back),
  // but the final level is clamped to [0,1], so a negative jump can only pull the
  // gradient down, never below 0.
  if (!roomState || typeof roomState !== 'object') return 0;
  const v = roomState[key];
  return (typeof v === 'number' && Number.isFinite(v)) ? v : 0;
}

function computeInvestmentLevel(roomState) {
  const rawFw =
    roomState && typeof roomState === 'object' && typeof roomState.framework_invocations === 'number'
      ? roomState.framework_invocations
      : 0;
  const baseTerm = Math.max(0.0, rawFw) / 10;
  // NEW runtime turn_count term (BCH-S1). Absent / non-number / negative -> 0.
  const turnTerm = _finiteNonNegative(
    roomState && typeof roomState === 'object' ? roomState.turn_count : undefined
  ) / TURN_DIVISOR;
  // Reserved jump conditions (read-if-present; default no-op until a later wave sets them).
  const jumpTerm =
      _jumpTerm(roomState, 'investment_jump_escape_hatch')
    + _jumpTerm(roomState, 'investment_jump_saturation')
    + _jumpTerm(roomState, 'investment_jump_pushback')
    + _jumpTerm(roomState, 'investment_jump_evidence');
  const level = Math.min(1.0, Math.max(0.0, baseTerm + turnTerm + jumpTerm));
  let label;
  if (level === 0) {
    label = 'fresh room, ranking with Brain priors';
  } else if (level < 0.5) {
    label = 'warming up: Brain + early local signal';
  } else if (level < 1.0) {
    label = 'balanced: Brain + memory equal weight';
  } else {
    label = 'full local scoring with Brain confidence';
  }
  return { level, label };
}

module.exports = {
  resolveActiveFrameworks,
  resolveHopDepth,
  computeInvestmentLevel,
  // Phase 150-04 (MEM-07): the brainAnchors producer (closes the orphaned
  // weight-0.5 brain_md consumer). Callers assemble
  //   roomState.brainAnchors = deriveBrainAnchors(roomContext.cortexNodes)
  // before resolveActiveFrameworks. Generic framework-name handles only (Part 8).
  deriveBrainAnchors,
  // Test seam (private; used by lib/memory/navigation-projections.test.cjs only).
  _test: { _extractFrameworkFromThought, _jtbdToFramework, KNOWN_FRAMEWORK_HINTS },
};
