'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 184 -- READER R1: the grounded-vs-ungrounded A/B harness
 * =============================================================
 * R1 is the mandatory A/B: a GROUNDED option set (projection-ranked, via the READER)
 * versus an UNGROUNDED option set (no projection, the Canon Part 3 Tier-0 minimal
 * verbs), measuring choice-shift + latency. This module builds the harness AND the
 * LOCAL measurement that runs today.
 *
 * THE NAMED DEBT (recorded honestly, no euphemism). The LOCAL structural measurement
 * (does the projection meaningfully shift the option set, and at what latency cost)
 * runs every time. But the LIVE grounded-vs-ungrounded A/B -- a REAL navigator's
 * ACTUAL choice and latency at the gate -- CANNOT return a real result until a live
 * navigator subject reaches the gate. Today no live navigator has (the Phase 183
 * METER first reading came back subject_class=unknown / transfer_uninstrumented). So
 * this harness records the honest third state -- subject_class 'unknown',
 * live_ab.state 'uninstrumented', result null -- rather than fabricating a live pass.
 * This mirrors the Phase 183 two-gauge transfer_uninstrumented idiom
 * (lib/core/meter/two-gauge.cjs): a welded instrument that cannot tell "no quality"
 * from "no instrument" is blindfolded, so the third state is named, not zeroed.
 *
 * The harness is STRUCTURED TO RUN the live A/B the instant a subject exists: pass a
 * navigator subject_class plus a real liveChoice and the result returns 'measured'.
 * It does NOT manufacture that subject. (Navigator-authority override note: Phase 184
 * was built into v1.15.0-beta.9 on navigator authority despite METER reading
 * subject_class=unknown; the CODE ships green, but R1's LIVE reading remains a NAMED
 * DEBT until a live navigator reaches the gate. See 184-SUMMARY.md.)
 *
 * Canon Part 8: LOCAL only. The harness reads the LOCAL projection through the READER
 * and derives subject_class from a LOCAL env marker only -- never a key, never a user
 * id, never any network. House rule: hyphens only, no em-dashes. Never throws.
 */

const reader = require('./decide-projection-reader.cjs');

// subject_class enum, mirroring lib/core/meter/two-gauge.cjs CORRECTION A. Only
// subject_class==navigator (a live, non-maintainer keyed turn) with a REAL live
// choice clears the A/B to 'measured'. A maintainer/dogfood reading does NOT clear
// it (the entry-20-style override guard: a maintainer reading is not the live
// navigator reading R1 names).
const SUBJECT_CLASS = Object.freeze({
  MAINTAINER: 'maintainer',
  NAVIGATOR: 'navigator',
  UNKNOWN: 'unknown',
});
const SUBJECT_CLASS_VALUES = Object.freeze([
  SUBJECT_CLASS.MAINTAINER, SUBJECT_CLASS.NAVIGATOR, SUBJECT_CLASS.UNKNOWN,
]);

// The live-A/B weld state. Mirrors the two-gauge TRANSFER_STATE { measured,
// uninstrumented } third-state honesty.
const LIVE_AB_STATE = Object.freeze({ MEASURED: 'measured', UNINSTRUMENTED: 'uninstrumented' });

// The UNGROUNDED arm: the Canon Part 3 Tier-0 hardcoded minimal verb set (Run
// Methodology / Reformulate / Free-Text), the option set the gate renders with NO
// projection grounding. Frozen so the A/B baseline is stable. Each is CONTENT only;
// fires:false (the harness never runs a capability -- READER-04).
const UNGROUNDED_OPTIONS = Object.freeze([
  Object.freeze({ label: 'Run Methodology', command: null, reach_id: null, sub_mode: null, framework: null, why: 'tier-0 minimal (ungrounded)', fires: false }),
  Object.freeze({ label: 'Reformulate', command: null, reach_id: null, sub_mode: null, framework: null, why: 'tier-0 minimal (ungrounded)', fires: false }),
  Object.freeze({ label: 'Free-Text', command: null, reach_id: null, sub_mode: null, framework: null, why: 'tier-0 minimal (ungrounded)', fires: false }),
]);

/**
 * Derive subject_class from a LOCAL env marker only (Part 8). Default 'unknown' --
 * the honest default when no maintainer/navigator signal is resolvable, never a
 * fragile guess. A test seam (opts.subjectClass) overrides for harness exercise.
 */
function deriveSubjectClass(opts) {
  const o = opts || {};
  if (typeof o.subjectClass === 'string' && SUBJECT_CLASS_VALUES.indexOf(o.subjectClass) !== -1) {
    return o.subjectClass;
  }
  if (typeof process.env.MINDRIAN_DOGFOOD_ROOM_DIR === 'string'
      && process.env.MINDRIAN_DOGFOOD_ROOM_DIR.trim().length > 0) {
    return SUBJECT_CLASS.MAINTAINER;
  }
  return SUBJECT_CLASS.UNKNOWN;
}

// LOCAL structural choice-shift: the fraction of grounded option labels NOT present
// in the ungrounded set. 1.0 means the projection grounding wholly reshaped the
// option set; 0.0 means it changed nothing. A structural measure, not a live choice.
function _choiceShift(grounded, ungrounded) {
  const g = Array.isArray(grounded) ? grounded.map(function (o) { return o && o.label; }) : [];
  const u = new Set((Array.isArray(ungrounded) ? ungrounded : []).map(function (o) { return o && o.label; }));
  if (g.length === 0) return 0;
  let diff = 0;
  for (const l of g) if (!u.has(l)) diff += 1;
  return diff / g.length;
}

/**
 * runGroundedVsUngroundedAB(context, opts) -> frozen {
 *   local_measurement: {...},   // the structural A/B that runs TODAY
 *   live_ab: {...},             // the NAMED DEBT: 'measured' only with a live subject
 * }
 *
 * opts (all optional; the test + future-live seams):
 *   projection / projectionPath  forwarded to the READER (fixture injection)
 *   subjectClass                 forces the derived subject_class (test seam)
 *   liveChoice                   a REAL navigator choice { arm, label, latency_ms }
 *                                supplied when a live subject exists -> clears to
 *                                'measured'. Absent -> 'uninstrumented' (the debt).
 * Never throws.
 */
function runGroundedVsUngroundedAB(context, opts) {
  const o = opts || {};

  // GROUNDED arm -- projection-ranked options via the READER.
  const tG = Date.now();
  const grounded = reader.offerProjectionCapabilities(context, o);
  const latG = Date.now() - tG;

  // UNGROUNDED arm -- the Tier-0 minimal set, no projection.
  const tU = Date.now();
  const ungroundedOptions = UNGROUNDED_OPTIONS.slice();
  const latU = Date.now() - tU;

  const groundedOptions = (grounded && grounded.skipped) ? [] : ((grounded && grounded.options) || []);
  const choice_shift = _choiceShift(groundedOptions, ungroundedOptions);

  const local_measurement = {
    grounded_option_count: groundedOptions.length,
    ungrounded_option_count: ungroundedOptions.length,
    choice_shift: choice_shift,
    latency_grounded_ms: latG,
    latency_ungrounded_ms: latU,
    latency_delta_ms: latG - latU,
    grounded_skipped: !!(grounded && grounded.skipped),
    grounded_reason: grounded ? grounded.reason : 'no_result',
  };

  // LIVE A/B -- the NAMED DEBT. 'measured' only when a live navigator subject exists
  // AND supplies a real choice. Otherwise the honest 'uninstrumented' third state.
  const subject_class = deriveSubjectClass(o);
  const liveChoice = o.liveChoice;
  const hasLiveSubject = subject_class === SUBJECT_CLASS.NAVIGATOR
    && liveChoice && typeof liveChoice === 'object';

  let live_ab;
  if (hasLiveSubject) {
    live_ab = {
      subject_class: subject_class,
      state: LIVE_AB_STATE.MEASURED,
      result: {
        chosen_arm: typeof liveChoice.arm === 'string' ? liveChoice.arm : null,
        chosen_label: typeof liveChoice.label === 'string' ? liveChoice.label : null,
        latency_ms: typeof liveChoice.latency_ms === 'number' ? liveChoice.latency_ms : null,
      },
      named_debt: null,
    };
  } else {
    live_ab = {
      subject_class: subject_class,
      state: LIVE_AB_STATE.UNINSTRUMENTED,
      result: null,
      named_debt: 'R1 live grounded-vs-ungrounded A/B is UNINSTRUMENTED: no live navigator '
        + 'has reached the gate (subject_class=' + subject_class + '). The harness CAN run '
        + 'the live A/B the instant a navigator subject exists; today it records this honest '
        + 'third state rather than fabricating a live pass. Mirrors Phase 183 METER '
        + 'transfer_uninstrumented.',
    };
  }

  return Object.freeze({ local_measurement: local_measurement, live_ab: live_ab });
}

module.exports = {
  runGroundedVsUngroundedAB: runGroundedVsUngroundedAB,
  deriveSubjectClass: deriveSubjectClass,
  SUBJECT_CLASS: SUBJECT_CLASS,
  LIVE_AB_STATE: LIVE_AB_STATE,
  UNGROUNDED_OPTIONS: UNGROUNDED_OPTIONS,
};
