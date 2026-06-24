'use strict';
// Phase 177-05 (BCH-04) -- the thin LOCAL calibration writer.
//
// logCalibrationObservation(db, obs) writes exactly ONE row into the dedicated
// calibration_observations table (minted by memory-ops.cjs initCalibrationSchema)
// and optionally emits ONE scalar audit-marker memory_event.
//
// SHADOW-ONLY. This wave logs; it does NOT fire. No reach is minted, routing_source
// stays legacy, no semantic seam opens. The writer is the observation tape Wave 3
// (BCH-CAL) reads to pin the behavioral-channel floor/ceiling.
//
// THE LOAD-BEARING BEHAVIOR (BCH-04): a below-floor cue (confidence < FLOOR) STILL
// writes a row, with cue_disposition 'discarded'. Discarded cues are LOGGED, not
// dropped -- "shadow before trust".
//
// Canon Part 8: the row store is a DEDICATED LOCAL table; buildBrainPacket never
// reads it (packet.cjs reads only nodes + identity). The columns hold ONLY scalars
// + enum handles; no prose column exists, and the audit marker carries no row body.
// All writes use prepared statements with ? parameters (no string interpolation).

const crypto = require('node:crypto');
const memoryEvents = require('./memory-events.cjs');

// The engine-owned thresholds, read from their home rather than re-typed (the
// computed-not-hand-typed pattern: BCH-06 / the Wave-1 ceiling derivation). If a
// caller pre-computes band + cue_disposition, those are honored; otherwise they are
// derived here against the live engine constants so the writer can never drift from
// the ranker's notion of FLOOR / CEILING.
const {
  BEHAVIORAL_CHANNEL_FLOOR,
  BEHAVIORAL_CHANNEL_CEILING,
} = require('../../workflow/f-selector-ranker.cjs');

/**
 * Derive (cue_disposition, band) from a numeric confidence against the engine-owned
 * thresholds. The protected band is the closed interval [FLOOR, CEILING]:
 *   confidence <  FLOOR    -> { disposition: 'discarded',     band: 'below_floor' }
 *   FLOOR <= c <= CEILING  -> { disposition: 'fired',         band: 'protected' }
 *   confidence >  CEILING  -> { disposition: 'above_ceiling', band: 'above_ceiling' }
 * @param {number} confidence
 * @returns {{disposition: string, band: string}}
 */
function deriveDisposition(confidence) {
  if (typeof confidence !== 'number' || Number.isNaN(confidence)) {
    return { disposition: 'discarded', band: 'below_floor' };
  }
  if (confidence < BEHAVIORAL_CHANNEL_FLOOR) {
    return { disposition: 'discarded', band: 'below_floor' };
  }
  if (confidence > BEHAVIORAL_CHANNEL_CEILING) {
    return { disposition: 'above_ceiling', band: 'above_ceiling' };
  }
  return { disposition: 'fired', band: 'protected' };
}

/**
 * Write ONE calibration_observations row (the dedicated-table store) and optionally
 * emit ONE scalar audit-marker memory_event.
 *
 * @param {import('node:sqlite').DatabaseSync} db - caller-owned db handle (schema
 *   must already exist via initCalibrationSchema; the chokepoint contract is that
 *   the caller owns the open handle, mirroring writeEdge / logMemoryEvent).
 * @param {object} obs
 * @param {string}  [obs.cue_kind]        - the observation cue family handle (enum string,
 *                                          e.g. reframe_cue / escape_hatch). Defaults 'unknown_cue'.
 * @param {number}  [obs.confidence]      - numeric cue confidence.
 * @param {string}  [obs.turn_id]         - optional turn handle.
 * @param {number}  [obs.turn_count]      - optional turn counter scalar.
 * @param {string}  [obs.cue_disposition] - caller pre-computed disposition; derived when absent.
 * @param {string}  [obs.band]            - caller pre-computed band; derived when absent.
 * @param {string}  [obs.created_by]      - defaults 'system'.
 * @param {boolean} [obs.emit_audit_marker=true] - emit the scalar audit-marker memory_event.
 * @param {string}  [obs.dedupe_key]      - optional dedupe key forwarded to the audit marker.
 * @param {object}  [opts]                - { now } clock seam forwarded to logEvent.
 * @returns {{ok: boolean, id?: string, cue_disposition?: string, band?: string, reason?: string}}
 */
function logCalibrationObservation(db, obs, opts) {
  if (!db || typeof db.prepare !== 'function') {
    return { ok: false, reason: 'invalid_db' };
  }
  if (!obs || typeof obs !== 'object') {
    return { ok: false, reason: 'invalid_observation' };
  }

  const options = opts && typeof opts === 'object' ? opts : {};
  const nowFn = typeof options.now === 'function' ? options.now : Date.now;
  const nowMs = nowFn();

  const cueKind = typeof obs.cue_kind === 'string' && obs.cue_kind.length > 0 ? obs.cue_kind : 'unknown_cue';
  const confidence = typeof obs.confidence === 'number' ? obs.confidence : null;
  const turnId = typeof obs.turn_id === 'string' ? obs.turn_id : null;
  const turnCount = Number.isInteger(obs.turn_count) ? obs.turn_count : null;
  const createdBy = typeof obs.created_by === 'string' && obs.created_by.length > 0 ? obs.created_by : 'system';

  // Derive disposition + band unless the caller pre-computed them (the table stays
  // the source of truth either way).
  const derived = deriveDisposition(confidence);
  const cueDisposition = typeof obs.cue_disposition === 'string' && obs.cue_disposition.length > 0
    ? obs.cue_disposition
    : derived.disposition;
  const band = typeof obs.band === 'string' && obs.band.length > 0 ? obs.band : derived.band;

  const id = 'calibration_observation:' + nowMs + ':' + crypto.randomBytes(4).toString('hex');

  try {
    db.prepare(
      'INSERT INTO calibration_observations ' +
      '(id, turn_id, turn_count, cue_kind, confidence, cue_disposition, band, created_by, created_at) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, turnId, turnCount, cueKind, confidence, cueDisposition, band, createdBy, nowMs);
  } catch (err) {
    return { ok: false, reason: err.message };
  }

  // Optional scalar audit marker. Carries the turn handle + disposition enum +
  // confidence scalar ONLY -- never a row body (Canon Part 8). The ROW STORE is the
  // dedicated table above; this memory_event is just the audit trail.
  const emitMarker = obs.emit_audit_marker !== false;
  if (emitMarker) {
    const markerPayload = {
      turn_count: turnCount,
      cue_disposition: cueDisposition,
      confidence,
      created_by: createdBy,
    };
    if (typeof obs.dedupe_key === 'string' && obs.dedupe_key.length > 0) {
      markerPayload.dedupe_key = obs.dedupe_key;
    }
    // Best-effort: the audit marker must never block the row write. logEvent
    // returns a structured result; we ignore failures here (the row already landed).
    try {
      memoryEvents.logEvent(db, 'calibration_observation_logged', markerPayload, options);
    } catch (_err) {
      // tolerant: the row store is the source of truth; the marker is advisory.
    }
  }

  return { ok: true, id, cue_disposition: cueDisposition, band };
}

module.exports = { logCalibrationObservation, deriveDisposition };
