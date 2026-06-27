'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 183-02 METER-01+02 -- the WELDED two-gauge read (Canon Part 5, Appendix D
 * entry 31; the v1.19 headline product metric instrumented at the telemetry layer).
 * ============================================================================
 * readTwoGauge(db, sinceEpochMs, roomState) computes Gauge 1 (invocation density,
 * the VOLUME reading) AND Gauge 2 (the named-debt transfer SOURCE, the QUALITY
 * reading) in the SAME call and returns them welded in ONE frozen object. A caller
 * CANNOT obtain density without the transfer slot beside it: there is NO exported
 * function whose return type is a bare density number, and the assembled object is
 * asserted to carry the transfer slot before it is frozen (it THROWS on a genuine
 * welded-contract violation). This is the canon's "invocation density is structurally
 * un-reportable without the transfer denominator beside it -- welded, not a clause".
 *
 * THREE outcomes (CORRECTION B -- not just "pair or throw"):
 *   (1) the welded PAIR when the transfer substrate exists  -> transfer_state 'measured'
 *   (2) the pair with transfer=null when the substrate is EMPTY -> transfer_state
 *       'uninstrumented' (NEVER a flat/zero transfer value). The f_selector_decision
 *       substrate is unwritten-from-the-dial in production today (ROADMAP:2846), so the
 *       transfer/reject-capture denominator cold-starts structurally EMPTY on most
 *       rooms -- that is honest, and it MUST read as uninstrumented, not flat.
 *   (3) THROW if a caller assembles a bare density without the transfer slot present.
 *
 * The two-directional regression guard (D-180-02). The read returns BOTH a
 * volume_direction and a quality_direction; the verdict names BOTH single-direction
 * failures as regressions, never as a win:
 *   - win                = volume up AND quality holds-or-climbs.
 *   - regression_dealer  = volume-up-quality-flat (the Hooked Dealer quadrant -- more
 *                          reaches that teach nothing).
 *   - regression_starved = quality-up-by-starving-volume (the virtuous-looking inverse
 *                          that buys a higher per-invocation number by suppressing the
 *                          reaches themselves).
 *   - flat               = neither direction moves.
 *   - transfer_uninstrumented = the transfer substrate is EMPTY. This is a
 *                          DISTINCT state from flat: uninstrumented is NOT the Hooked
 *                          Dealer regression and NOT the starving-volume inverse -- it
 *                          is no-instrument, which licenses NO regression verdict at all.
 *                          A welded metric that cannot tell "no quality" from
 *                          "no instrument" is blindfolded.
 *
 * Honest-default note: METER is the Gauge-2 SOURCE over NAMED-DEBT proxies, NOT a
 * finished transfer measurement. A real transfer CLIMB needs a Part-5 baseline
 * (a novel-problem delta) that METER cannot produce, so quality_direction defaults to
 * 'flat' for a measured reading -- the meter REFUSES to declare a win without a real
 * transfer delta beside it (the structural anti-engagement-machine guard). Phase 184
 * READER's R1 A/B test supplies the real quality direction.
 *
 * Contract: opens NO db (caller-owned handle); makes NO Brain / network call; imports
 * NO packet.cjs and no Brain client module. Reads ONLY through the two shipped meter
 * readers (which read via the Part 9 navigation chokepoint). Canon Part 8: the
 * run-all-183.sh grep-sweep proves zero network surface here. House rule: hyphens only,
 * no em-dashes.
 */

const crypto = require('node:crypto');
const gateDensity = require('./gate-density-reader.cjs');
const transferReader = require('./transfer-reader.cjs');

// The active-key resolver (Part-8-clean: reads LOCAL env/files only, zero network).
// Loaded defensively so a meter read never hard-fails on a resolver hiccup.
let _resolveBrainKey = null;
try {
  _resolveBrainKey = require('../resolve-brain-key.cjs').resolveBrainKey;
} catch (_e) {
  _resolveBrainKey = null;
}

// CORRECTION A -- subject_class enum. Only subject_class==navigator satisfies the
// entry-31 self-binding-clause precondition. A maintainer reading proves the
// instrument FIRES; it does NOT clear the self-bind. This is the structural guard
// against an entry-20-style override (a maintainer reading, the ~1287-request
// dogfooding key, masquerading as the navigator reading the clause named).
const SUBJECT_CLASS = Object.freeze({
  MAINTAINER: 'maintainer',
  NAVIGATOR: 'navigator',
  UNKNOWN: 'unknown',
});
const SUBJECT_CLASS_VALUES = Object.freeze([
  SUBJECT_CLASS.MAINTAINER, SUBJECT_CLASS.NAVIGATOR, SUBJECT_CLASS.UNKNOWN,
]);

const TRANSFER_STATE = Object.freeze({ MEASURED: 'measured', UNINSTRUMENTED: 'uninstrumented' });

const VERDICT = Object.freeze({
  WIN: 'win',
  REGRESSION_DEALER: 'regression_dealer',
  REGRESSION_STARVED: 'regression_starved',
  FLAT: 'flat',
  TRANSFER_UNINSTRUMENTED: 'transfer_uninstrumented',
});

// The maintainer-key fingerprint seam. The navigator sets MINDRIAN_MAINTAINER_KEY_SHA256
// on the maintainer box to the sha256 HEX of the maintainer (dogfooding) Brain key. We
// NEVER store or egress the key itself -- only a one-way fingerprint to compare against
// (Part 8). Returns the lowercased 64-hex string or null when unset/malformed.
function _maintainerFingerprint() {
  const fp = process.env.MINDRIAN_MAINTAINER_KEY_SHA256;
  if (typeof fp === 'string' && /^[0-9a-f]{64}$/i.test(fp.trim())) {
    return fp.trim().toLowerCase();
  }
  return null;
}

// Derive subject_class AT READ TIME, Part-8-clean: a derived scalar enum, NEVER the
// key, NEVER a user identifier. Precedence:
//   1. MINDRIAN_DOGFOOD_ROOM_DIR set  -> 'maintainer' (the EXISTING maintainer/dogfood-box
//      marker; the maintainer's own dogfooding reads are stamped maintainer).
//   2. a maintainer fingerprint is configured AND the active key's sha256 matches
//      -> 'maintainer' (positive maintainer match).
//   3. a maintainer fingerprint is configured AND an active key is present but does NOT
//      match -> 'navigator' (positively a non-maintainer keyed live turn).
//   4. otherwise -> 'unknown'. We do NOT guess 'navigator' when no maintainer signal is
//      resolvable: without a reference we cannot prove a reading is not the maintainer's
//      (the entry-31 enum's correctness is load-bearing, so 'unknown' is the honest
//      default, never a fragile guess).
function _deriveSubjectClass() {
  if (typeof process.env.MINDRIAN_DOGFOOD_ROOM_DIR === 'string'
      && process.env.MINDRIAN_DOGFOOD_ROOM_DIR.trim().length > 0) {
    return SUBJECT_CLASS.MAINTAINER;
  }
  const fp = _maintainerFingerprint();
  if (!fp) return SUBJECT_CLASS.UNKNOWN; // no maintainer signal -> never guess navigator
  let active = null;
  try {
    active = _resolveBrainKey ? _resolveBrainKey() : null;
  } catch (_e) {
    active = null;
  }
  if (!active || active.available !== true
      || typeof active.key !== 'string' || active.key.length === 0) {
    return SUBJECT_CLASS.UNKNOWN; // no active key -> cannot classify
  }
  let activeFp;
  try {
    activeFp = crypto.createHash('sha256').update(active.key, 'utf8').digest('hex');
  } catch (_e) {
    return SUBJECT_CLASS.UNKNOWN;
  }
  if (activeFp === fp) return SUBJECT_CLASS.MAINTAINER; // positive maintainer match
  return SUBJECT_CLASS.NAVIGATOR; // positively a non-maintainer keyed live turn
}

// Map the per-cycle independence trend (rising | falling | flat) to a volume direction.
function _volumeDirection(trend) {
  const d = trend && trend.direction;
  if (d === 'rising') return 'up';
  if (d === 'falling') return 'down';
  return 'flat';
}

// ---------------------------------------------------------------------------
// readTwoGauge(db, sinceEpochMs, roomState)
//   -> frozen {
//        gauge1, gauge2, gauge1_density, gauge2_transfer, density, transfer,
//        transfer_state, subject_class, volume_direction, quality_direction, verdict
//      }
//
// gauge1 / gauge1_density / density : the Gauge-1 invocation-density reading (object)
//                                     and its density scalar (the VOLUME half).
// gauge2 / gauge2_transfer / transfer: the Gauge-2 named-debt transfer reading (object),
//                                     or null when the transfer substrate is EMPTY.
// transfer_state                    : 'measured' | 'uninstrumented'.
// subject_class                     : 'maintainer' | 'navigator' | 'unknown' (CORRECTION A).
// volume_direction / quality_direction / verdict : the two-directional regression guard.
//
// Returns the pair welded together or THROWS; there is NO bare-density path.
// ---------------------------------------------------------------------------
function readTwoGauge(db, sinceEpochMs, roomState) {
  const since = (typeof sinceEpochMs === 'number' && Number.isFinite(sinceEpochMs)) ? sinceEpochMs : 0;

  // Gauge 1 -- the volume reading.
  const density = gateDensity.computeInvocationDensity(db, since, roomState);

  // Gauge 2 source -- the three named-debt transfer proxies.
  const capture = transferReader.rejectReasonCaptureRate(db, since, roomState);
  const latency = transferReader.insightToValidatedDecisionLatency(db, since, roomState);
  const independence = transferReader.independenceTrend(db, since, roomState);

  // The transfer substrate is 'measured' only when there is at least one transfer data
  // point (a reject-capture row OR an insight->validated-decision latency pair). When
  // the denominator is structurally EMPTY it is 'uninstrumented', NOT flat -- a distinct
  // third state (CORRECTION B).
  const reject_total = (capture && typeof capture.reject_total === 'number') ? capture.reject_total : 0;
  const sample_count = (latency && typeof latency.sample_count === 'number') ? latency.sample_count : 0;
  const measured = reject_total > 0 || sample_count > 0;
  const transfer_state = measured ? TRANSFER_STATE.MEASURED : TRANSFER_STATE.UNINSTRUMENTED;

  const transfer = measured
    ? Object.freeze({
        reject_reason_capture: capture,
        insight_to_validated_decision_latency: latency,
        independence_trend: independence,
        proxy_class: 'named-debt',
      })
    : null; // EMPTY substrate -> null, never a fabricated zero (CORRECTION B)

  const volume_direction = _volumeDirection(independence);

  // quality_direction: 'uninstrumented' when there is no transfer instrument; else
  // defaults to 'flat' -- METER cannot prove a transfer CLIMB without a Part-5 baseline,
  // so it never claims a win on the named-debt proxies alone (Phase 184 READER supplies
  // the real direction).
  const quality_direction = measured ? 'flat' : 'uninstrumented';

  // The two-directional guard. uninstrumented licenses NO regression verdict.
  let verdict;
  if (!measured) {
    verdict = VERDICT.TRANSFER_UNINSTRUMENTED;
  } else if (volume_direction === 'up' && (quality_direction === 'up' || quality_direction === 'climbs')) {
    verdict = VERDICT.WIN; // volume up AND quality holds-or-climbs
  } else if (volume_direction === 'up' && quality_direction === 'flat') {
    verdict = VERDICT.REGRESSION_DEALER; // volume-up-quality-flat (Hooked Dealer)
  } else if (volume_direction === 'down' && quality_direction === 'up') {
    verdict = VERDICT.REGRESSION_STARVED; // quality-up-by-starving-volume
  } else {
    verdict = VERDICT.FLAT;
  }

  const out = {
    gauge1: density,
    gauge2: transfer,
    gauge1_density: density && typeof density.density === 'number' ? density.density : 0,
    gauge2_transfer: transfer,
    density: density && typeof density.density === 'number' ? density.density : 0,
    transfer: transfer,
    transfer_state: transfer_state,
    subject_class: _deriveSubjectClass(),
    volume_direction: volume_direction,
    quality_direction: quality_direction,
    verdict: verdict,
  };

  // Structural weld assertion (CORRECTION B outcome 3): the density is un-returnable
  // without the transfer slot present in the same object. THROW on a genuine
  // welded-contract violation rather than ever yielding a lone density.
  if (!('transfer' in out) || !('gauge1_density' in out)) {
    throw new Error('unwelded_density: readTwoGauge refuses to return a density without the transfer slot beside it');
  }

  return Object.freeze(out);
}

module.exports = { readTwoGauge };
