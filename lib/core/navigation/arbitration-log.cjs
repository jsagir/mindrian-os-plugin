'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 346-05 -- the arbitration decision's audit row: one logged
 * memory_event per turn, enum tokens only, deduped, recording whether the
 * posture flipped from the prior turn in the same session (ARB-07/ARB-08).
 *
 * This module lives under lib/core/navigation/, not lib/core/, because
 * logEvent is internal to this directory: memory-events.cjs's own header
 * (line 4) states "logEvent is internal (not in the closed 13-function
 * surface); other navigation/* helpers call it directly." This module is
 * exactly that -- a navigation/* sibling calling logEvent and
 * findRecentChanges directly, never a second SQL door.
 *
 * Canon Part 8: the payload built here carries closed-enum tokens and
 * integers only, never prose, never user text, and never crosses to Brain.
 * This is LOCAL room.db bookkeeping.
 * Canon Part 9: written ONLY through the navigation chokepoint (the sibling
 * logEvent call below); a system-bookkeeping node under the Part 9 v1.5
 * audit-node carve-out (it records what the system DECIDED, not a venture
 * truth-claim), so created_by=system review_status=confirmed is canon-legal.
 *
 * House rule: CJS, Node built-ins only, hyphens only, no em-dashes.
 */

// The complete require set of this module: the sibling internal writer/
// reader, and the pure resolver whose exported closed vocabularies this
// module validates against. No node:fs, no db opening: the handle is
// caller-threaded, exactly as navigation-engine.cjs states the rule ("the
// engine does not OPEN room.db; it uses a caller-threaded handle").
const memoryEvents = require('./memory-events.cjs');
const arbitration = require('../arbitration.cjs');

const ARBITRATION_EVENT_TYPE = 'arbitration_decided';

// FLIP_LOOKBACK_MS: 24 hours. A longer window costs nothing (the underlying
// findRecentChanges query is indexed on created_at and capped at 20 rows by
// the limit passed below); a shorter window would report a false hold after
// a pause longer than the window (a resumed session reads as "no prior
// decision" instead of correctly comparing against the last one).
const FLIP_LOOKBACK_MS = 24 * 60 * 60 * 1000;

// The literal sanitizer replacement token. A value outside its closed
// vocabulary is replaced by this, never passed through and never dropped
// silently (T-346-01, T-346-20: a tampered value normalizes to 'invalid',
// which compares unequal to every real value and therefore reads as a flip,
// the safe direction). Exported as a small set so the test can assert
// membership without re-typing the literal.
const INVALID_TOKEN = 'invalid';
const SANITIZED_TOKENS = Object.freeze([INVALID_TOKEN]);

// The four flip_reason tokens this module mints. A first decision is
// 'no_prior_decision', never a fabricated hold; a failed prior read is
// 'prior_read_failed', never a fabricated hold either (T-346-20).
const FLIP_REASONS = Object.freeze([
  'no_prior_decision', 'prior_read_failed', 'axes_changed', 'hold',
]);

// No live export exists anywhere in the tree for these two closed
// vocabularies (the same gap tests/test-346-part8-enum-only.cjs already
// documents for the autonomy mode literals: "the three hand-typed autonomy
// mode literals, which have no live export anywhere in the tree"). Hand-typed
// here, mirroring that precedent, because lib/core/decision-axes.cjs and
// lib/core/directive-envelope.cjs are deliberately NOT required by this
// module -- the require set above is the complete set, matching
// arbitration.cjs's own Pitfall-9 discipline (capabilities and every other
// caller-side fact arrive named, never a second resolver import).
const DELIVERY_VALUES = Object.freeze(['ask_and_hedged', 'tell_and_hedged']);
const AUTONOMY_VALUES = Object.freeze(['GUIDED', 'HYBRID', 'AUTONOMOUS']);

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Validate `value` against a closed vocabulary; degrade to INVALID_TOKEN
 * rather than pass through or drop silently (stance-state.cjs:84-102 idiom:
 * validate against the frozen set and degrade to a safe default).
 * @param {*} value
 * @param {readonly string[]} closedList
 * @returns {string}
 */
function sanitizeEnum(value, closedList) {
  return (typeof value === 'string' && closedList.indexOf(value) !== -1) ? value : INVALID_TOKEN;
}

/**
 * Comma-join a list of enum tokens, sanitizing every member against
 * `closedList` first. Never a nested array (the brain_cmdmap_divergence
 * payload precedent: "brain_commands / local_commands as comma-joined
 * command-slug strings").
 * @param {*} list
 * @param {readonly string[]} closedList
 * @returns {string}
 */
function joinEnumList(list, closedList) {
  if (!Array.isArray(list)) return '';
  return list.map(function (v) { return sanitizeEnum(v, closedList); }).join(',');
}

/**
 * Coerce to a string and truncate to 64 characters. session_id and turn_id
 * are opaque identifiers here, never authorization tokens (ASVS V3): this
 * module uses session_id only as a dedupe key and a flip-comparison scope.
 * @param {*} value
 * @returns {string}
 */
function coerceId(value) {
  return String(value != null ? value : '').slice(0, 64);
}

/**
 * Build the flat, enum-only payload for one arbitration_decided row.
 * Validates every axis value/rationale against the closed vocabulary it
 * belongs to; a value outside its vocabulary is replaced by INVALID_TOKEN,
 * never passed through and never dropped silently. Every read is a named
 * path off `result` (result.delivery.value, result.autonomy.rationale, ...),
 * never a generic top-level spread -- the same discipline
 * arbitration.cjs's own buildModeSignals states out loud: an arbiter that
 * spread an untrusted object into its payload would be exactly the
 * second-selection-brain / prose-leak risk this phase's drift guards exist
 * to catch, just moved one hop downstream.
 *
 * `opts.flip` / `opts.flippedAxes` / `opts.flipReason` are supplied by
 * `logArbitrationDecision` once it has computed them against the prior row;
 * when absent (the first internal call this module makes to sanitize the
 * CURRENT turn's axis values before that comparison exists yet) they default
 * to the safe, honest values below.
 *
 * @param {*} result the value shape lib/core/arbitration.cjs::resolveArbitration returns
 * @param {{sessionId?:*, turnId?:*, flip?:boolean, flippedAxes?:string[], flipReason?:string}} [opts]
 * @returns {object} flat object of strings, numbers and booleans only
 */
function buildArbitrationPayload(result, opts) {
  const r = isPlainObject(result) ? result : {};
  const o = isPlainObject(opts) ? opts : {};

  const delivery = isPlainObject(r.delivery) ? r.delivery : {};
  const autonomy = isPlainObject(r.autonomy) ? r.autonomy : {};
  const enforcement = isPlainObject(r.enforcement) ? r.enforcement : {};

  const sessionId = coerceId(o.sessionId);
  const turnId = coerceId(o.turnId);

  const flip = o.flip === true;
  const flippedAxes = Array.isArray(o.flippedAxes) ? o.flippedAxes : [];
  const flipReason = sanitizeEnum(o.flipReason, FLIP_REASONS) === INVALID_TOKEN
    ? 'hold'
    : o.flipReason;

  const inputsRead = Array.isArray(r.inputs_read) ? r.inputs_read : [];
  const inputsMissing = Array.isArray(r.inputs_missing) ? r.inputs_missing : [];

  return {
    arbitration_version: (r.arbitration_version === arbitration.ARBITRATION_VERSION)
      ? r.arbitration_version
      : INVALID_TOKEN,
    delivery_value: sanitizeEnum(delivery.value, DELIVERY_VALUES),
    delivery_rationale: sanitizeEnum(delivery.rationale, arbitration.DELIVERY_RATIONALES),
    autonomy_value: sanitizeEnum(autonomy.value, AUTONOMY_VALUES),
    autonomy_rationale: sanitizeEnum(autonomy.rationale, arbitration.AUTONOMY_RATIONALES),
    enforcement_value: sanitizeEnum(enforcement.value, arbitration.ENFORCEMENT_VALUES),
    enforcement_rationale: sanitizeEnum(enforcement.rationale, arbitration.ENFORCEMENT_RATIONALES),
    ranked: joinEnumList(r.ranked, arbitration.RANKED_ORDER),
    inputs_read: joinEnumList(inputsRead, arbitration.ARBITRATION_INPUTS),
    inputs_missing: joinEnumList(inputsMissing, arbitration.ARBITRATION_INPUTS),
    floors_applied: joinEnumList(r.floors_applied, arbitration.FLOOR_TOKENS),
    inputs_read_count: inputsRead.length,
    inputs_missing_count: inputsMissing.length,
    flip: flip,
    flipped_axes: joinEnumList(flippedAxes, arbitration.RANKED_ORDER),
    flip_reason: flipReason,
    session_id: sessionId,
    turn_id: turnId,
    dedupe_key: 'arb:' + sessionId + ':' + turnId,
    created_by: 'system',
    source_path: 'system:arbitration',
  };
}

/**
 * Read the most recent arbitration_decided row for `sessionId` within
 * FLIP_LOOKBACK_MS, or report that the read itself faulted. Scoped to the
 * same session_id: a prior row from a different session is ignored.
 *
 * Returns `{ ok: true, row: object|null }` on a normal read (row is null
 * when no matching prior row exists -- the honest "first turn" case), or
 * `{ ok: false, row: null }` when the underlying query throws (a missing,
 * locked or corrupt database is a normal runtime state here, never an
 * exception) -- distinguishing "no prior decision" from "the read failed" is
 * exactly what lets logArbitrationDecision report the correct flip_reason
 * instead of collapsing both into a fabricated hold.
 *
 * @param {*} db
 * @param {string} sessionId
 * @param {number} nowMs
 * @returns {{ok: boolean, row: object|null}}
 */
function readPreviousDecision(db, sessionId, nowMs) {
  try {
    const rows = memoryEvents.findRecentChanges(db, nowMs - FLIP_LOOKBACK_MS, {
      eventType: ARBITRATION_EVENT_TYPE,
      limit: 20,
    });
    for (let i = 0; i < rows.length; i += 1) {
      const props = rows[i] && rows[i].properties;
      if (isPlainObject(props) && props.session_id === sessionId) {
        return { ok: true, row: props };
      }
    }
    return { ok: true, row: null };
  } catch (e) {
    return { ok: false, row: null };
  }
}

// WD-3 (docs/ARBITRATION-CONTRACT.md): disclosure is flip-only. The caller
// MAY surface one short line when the returned `flip` is true, and stays
// silent when it is false. This module only records the flip; it never
// renders anything and holds no opinion about how that one line reads.
/**
 * Log one arbitration_decided row for this turn, computing the flip against
 * the previous row in the same session. Never throws (R7 fault-safety): a
 * missing, locked or malformed database degrades to a returned failure
 * reason.
 *
 * @param {*} db caller-threaded room.db handle
 * @param {*} result the value shape resolveArbitration returns
 * @param {{sessionId?:*, turnId?:*, now?:() => number}} [opts]
 * @returns {{ok:boolean, deduped?:boolean, eventId?:string, reason?:string,
 *   flip:boolean, flipped_axes:string[], flip_reason:string}}
 */
function logArbitrationDecision(db, result, opts) {
  try {
    if (!db) return { ok: false, reason: 'no_db', flip: false, flipped_axes: [], flip_reason: 'no_prior_decision' };
    if (!isPlainObject(result)) return { ok: false, reason: 'no_result', flip: false, flipped_axes: [], flip_reason: 'no_prior_decision' };

    const o = isPlainObject(opts) ? opts : {};
    const nowFn = typeof o.now === 'function' ? o.now : Date.now;
    const nowMs = nowFn();
    const sessionId = coerceId(o.sessionId);
    const turnId = coerceId(o.turnId);

    // First pass: sanitize this turn's own axis values (RANKED_ORDER order)
    // so the flip comparison below compares apples to apples -- the SAME
    // sanitization the stored row already went through when it was written.
    const currentDraft = buildArbitrationPayload(result, { sessionId: sessionId, turnId: turnId });

    const prev = readPreviousDecision(db, sessionId, nowMs);
    let flip = false;
    const flippedAxes = [];
    let flipReason;
    if (!prev.ok) {
      flipReason = 'prior_read_failed';
    } else if (!prev.row) {
      flipReason = 'no_prior_decision';
    } else {
      arbitration.RANKED_ORDER.forEach(function (axis) {
        const currentVal = currentDraft[axis + '_value'];
        const priorVal = prev.row[axis + '_value'];
        if (typeof priorVal !== 'string' || priorVal !== currentVal) {
          flippedAxes.push(axis);
        }
      });
      flip = flippedAxes.length > 0;
      flipReason = flip ? 'axes_changed' : 'hold';
    }

    const payload = buildArbitrationPayload(result, {
      sessionId: sessionId,
      turnId: turnId,
      flip: flip,
      flippedAxes: flippedAxes,
      flipReason: flipReason,
    });

    const writeResult = memoryEvents.logEvent(db, ARBITRATION_EVENT_TYPE, payload, o);

    return {
      ok: writeResult.ok,
      deduped: writeResult.deduped === true,
      eventId: writeResult.eventId,
      reason: writeResult.reason,
      flip: flip,
      flipped_axes: flippedAxes,
      flip_reason: flipReason,
    };
  } catch (err) {
    return {
      ok: false,
      reason: (err && err.message) ? err.message : String(err),
      flip: false,
      flipped_axes: [],
      flip_reason: 'prior_read_failed',
    };
  }
}

module.exports = {
  ARBITRATION_EVENT_TYPE,
  buildArbitrationPayload,
  logArbitrationDecision,
  // The sanitizer's replacement-token set, exported so the test can assert
  // membership without re-typing the literal (behavior spec, Task 2).
  SANITIZED_TOKENS,
  // Test seam (private), mirroring arbitration.cjs's own _test block.
  _test: {
    FLIP_LOOKBACK_MS,
    readPreviousDecision,
  },
};
