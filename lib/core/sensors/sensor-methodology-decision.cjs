'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 143-02 Task 2 -- SENS-03 methodology-decision detector.
 *
 * A net-new detector that finally AUTO-INVOKES the EXISTING but never-fired
 * brain_framework_chain CHAINS_TO pattern (references/brain/query-patterns.md
 * Section 1: "recommend a framework for a {problem_type} venture that has already
 * applied {current_frameworks}"). When a methodology just completed, a decision
 * point is reached, or the Decision Gate verb-1 ("Run Methodology") context
 * lands, this sensor SURFACES a brain_consult candidate reach whose companion is
 * the brain_framework_chain query.
 *
 * CANON PART 8 -- THE BRAIN SEAM (the reason this is the Brain-touching sensor):
 * the brain_framework_chain companion carries ONLY generic handles --
 *   - the framework NAMES from the LOCAL methodology cache (tuple.current_frameworks),
 *   - the problem_type ENUM (tuple.problem_type).
 * Never artifact bodies, meeting content, proprietary numbers, or identifiers.
 * "recommend a framework for a wicked venture that applied SWOT, Porter" is
 * allowed; "here is the user's model, what does Brain say" is the forbidden
 * breach line. The sensor itself makes NO Brain call -- it constructs the
 * generic-handle companion and surfaces the reach for the Decision Gate
 * (Canon Part 3). decide() / a Brain client CONSUMES it later, never here.
 *
 * Phase 144 fence: this file PRODUCES a candidate reach; it never assigns
 * routing_source and never requires/defines decide(). The routing fence over
 * lib/core/sensors/ asserts this. The inherited Part-8 5-tripwire sweep
 * (no packet/brain-client require, no projection token, no hashing call site)
 * also spans this file -- so the sensor constructs the companion as a plain
 * generic-handle string, never via a hashing or egress-projection path.
 *
 * Pure / sync / LOCAL-first. node built-ins + project libs only. No new deps.
 * House rule: hyphens only, no em-dashes.
 */

const { makeReach } = require('./sensor-types.cjs');

/**
 * The methodology-decision signal kinds. A turn is { signals: [...] } where each
 * signal is a string kind or { kind }. Any of these means a methodology just
 * landed / a decision point was reached / the Decision Gate verb-1 context fired.
 */
const DECISION_SIGNALS = [
  'methodology_completed',
  'methodology_ran',
  'decision_point',
  'decision_gate',
  'chains_to',
  'run_methodology',
];

/**
 * True if `turn` carries any methodology-decision signal. Defensive against
 * malformed input -- returns false rather than throwing.
 */
function hasDecisionSignal(turn) {
  if (!turn || typeof turn !== 'object') return false;
  const signals = Array.isArray(turn.signals) ? turn.signals : [];
  for (const s of signals) {
    const kind = (typeof s === 'string') ? s : (s && typeof s === 'object' ? s.kind : '');
    if (typeof kind === 'string' && DECISION_SIGNALS.indexOf(kind) !== -1) return true;
  }
  return false;
}

/**
 * Pull the problem_type enum off the diagnose tuple as a generic handle.
 * Returns 'undefined' (the enum value) when absent -- never user content.
 */
function problemTypeEnum(tuple) {
  if (!tuple || typeof tuple !== 'object') return 'undefined';
  const pt = tuple.problem_type;
  return (typeof pt === 'string' && pt) ? pt : 'undefined';
}

/**
 * Pull the framework-NAME handles from the LOCAL methodology cache
 * (tuple.current_frameworks). These are generic framework names (e.g. "SWOT",
 * "Porter Five Forces") -- generic handles, never artifact bodies. Non-string
 * entries are dropped defensively so no object can smuggle user content.
 */
function frameworkHandles(tuple) {
  if (!tuple || typeof tuple !== 'object') return [];
  const fw = Array.isArray(tuple.current_frameworks) ? tuple.current_frameworks : [];
  return fw.filter(function (f) { return typeof f === 'string' && f.length > 0; });
}

/**
 * SENS-03 -- methodology-decision -> the brain_framework_chain CHAINS_TO reach.
 *
 * @param {object} turn  -- the turn signal bag (reads turn.signals only)
 * @param {object} tuple -- the /mos:diagnose tuple { problem_type, current_frameworks }
 * @param {object} _ctx  -- LOCAL context (unused; the handles come off the tuple)
 * @returns {Readonly<object>|null}
 */
function sensorMethodologyDecision(turn, tuple, _ctx) {
  if (!hasDecisionSignal(turn)) return null;

  const pt = problemTypeEnum(tuple);
  const handles = frameworkHandles(tuple);

  // The brain_framework_chain companion. Format encodes ONLY generic handles:
  //   'brain_framework_chain:<problem_type_enum>:<framework_name>'
  // one companion per already-applied framework (the CHAINS_TO traversal input),
  // plus a bare problem-type companion so the query has the enum even when no
  // framework has been applied yet. NO user content -- only enum + framework name.
  const companions = ['brain_framework_chain:' + pt];
  for (const fw of handles) {
    companions.push('brain_framework_chain:' + pt + ':' + fw);
  }

  return makeReach({
    reach_id: 'brain_consult',
    // 'hold' posture: surface the next-framework recommendation and hold for the
    // navigator's Decision Gate selection rather than auto-advancing.
    posture: 'hold',
    // Dispatch names the generic CHAINS_TO query pattern (a handle, not a call).
    dispatch: 'brain_framework_chain (CHAINS_TO next-framework)',
    companions: companions,
    signal: 'methodology_decision',
    // LOCAL scalars only: the count of already-applied frameworks + the enum.
    // The framework NAMES ride the companions (generic handles); no count of
    // user bytes, no artifact reference.
    evidence: { problem_type: pt, current_framework_count: handles.length },
  });
}

module.exports = {
  sensorMethodologyDecision: sensorMethodologyDecision,
};
