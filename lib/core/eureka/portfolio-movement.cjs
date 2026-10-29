'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 314-01 -- the portfolio movement detector.
 *
 * WHAT THIS IS
 *   A pure function over two stored portfolio runs (portfolio-snapshot.cjs).
 *   It finds what MOVED between them by the composite rule of D-03. Any one of
 *   these three is enough to surface:
 *     1. band_cross      a pair crossed a band, with a firing band on one side
 *     2. tail_enter      a handle entered the tail quadrant
 *     3. top_n_reshuffle the top-N order changed by more than the measured
 *                        wobble (OFF until data/eureka-portfolio-thresholds.json
 *                        says calibrated true, D-04)
 *
 * D-02: the sensor never starts a run. This module never reads the room, never
 * scores a pair, and never writes. The run command calls diffRuns and
 * buildMovementEnvelope, then stores the result through writeMovement.
 *
 * PART 8
 *   The movement envelope is a closed schema of enums, opaque handles and
 *   counts. No label, title or room text can enter it: buildMovementEnvelope
 *   reads handles and bands only, and validateEnvelope refuses any other key.
 *
 * Node built-ins only. No network. Nothing here throws.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const snapshotStore = require('./portfolio-snapshot.cjs');
// The one band list. Band definitions are not changed or copied by this phase.
const { FIRING_BANDS } = require('../sensors/sensor-eureka.cjs');

const BAND_ORDER = Object.freeze(['none', 'low', 'moderate', 'opportunity', 'high', 'breakthrough']);
const MAX_EVENTS = 3;
const MIN_TOP_N = 2;
const ENVELOPE_KIND = 'portfolio_movement';
const EVENT_KINDS = Object.freeze(['band_cross', 'tail_enter', 'top_n_reshuffle']);
const KIND_ORDER = Object.freeze({ band_cross: 0, tail_enter: 1, top_n_reshuffle: 2 });
const THRESHOLDS_PATH = path.join(__dirname, '..', '..', '..', 'data', 'eureka-portfolio-thresholds.json');

const HANDLE_RE = snapshotStore.HANDLE_RE;
const SCOPE_ID_RE = snapshotStore.SCOPE_ID_RE;
const MOVEMENT_ID_RE = snapshotStore.MOVEMENT_ID_RE;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

// ---------- helpers ----------

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function sortedKeysEqual(obj, keys) {
  if (!isPlainObject(obj)) return false;
  const have = Object.keys(obj).slice().sort();
  const want = keys.slice().sort();
  if (have.length !== want.length) return false;
  for (let i = 0; i < have.length; i += 1) {
    if (have[i] !== want[i]) return false;
  }
  return true;
}

function isHandle(v) {
  return typeof v === 'string' && HANDLE_RE.test(v);
}

function isCount(v) {
  return Number.isInteger(v) && v >= 0 && v <= Number.MAX_SAFE_INTEGER;
}

function isPositiveInt(v) {
  return Number.isInteger(v) && v > 0 && v <= Number.MAX_SAFE_INTEGER;
}

function pairKey(a, b) {
  return a < b ? a + '|' + b : b + '|' + a;
}

function bandIndex(band) {
  return BAND_ORDER.indexOf(band);
}

function isFiring(band) {
  return FIRING_BANDS.indexOf(band) !== -1;
}

function zeroCounts() {
  return { band_cross: 0, tail_enter: 0, top_n_reshuffle: 0 };
}

function notComparable(reason, reshuffleActive) {
  return { comparable: false, reason: reason, reshuffle_active: reshuffleActive === true, events: [], counts: zeroCounts() };
}

// ---------- thresholds ----------

function defaultThresholds() {
  return { schema_version: 1, calibrated: false, top_n: null, reshuffle_min_moved: null, reshuffle_min_displacement: null, calibration: null };
}

/**
 * loadThresholds(pathOverride) -> the thresholds object. A missing, corrupt or
 * inconsistent file gives the calibrated-false default. calibrated true needs
 * three positive integers (top_n at least 2) and a calibration object. The
 * numbers are measured by plan 314-07 and are never guessed here (D-04).
 */
function loadThresholds(pathOverride) {
  try {
    const file = typeof pathOverride === 'string' && pathOverride ? pathOverride : THRESHOLDS_PATH;
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!isPlainObject(doc) || doc.schema_version !== 1 || typeof doc.calibrated !== 'boolean') return defaultThresholds();
    if (doc.calibrated !== true) return defaultThresholds();
    if (!Number.isInteger(doc.top_n) || doc.top_n < MIN_TOP_N) return defaultThresholds();
    if (!isPositiveInt(doc.reshuffle_min_moved) || !isPositiveInt(doc.reshuffle_min_displacement)) return defaultThresholds();
    if (!isPlainObject(doc.calibration)) return defaultThresholds();
    return {
      schema_version: 1,
      calibrated: true,
      top_n: doc.top_n,
      reshuffle_min_moved: doc.reshuffle_min_moved,
      reshuffle_min_displacement: doc.reshuffle_min_displacement,
      calibration: doc.calibration
    };
  } catch (_e) {
    return defaultThresholds();
  }
}

function reshuffleIsActive(t) {
  return isPlainObject(t) &&
    t.calibrated === true &&
    Number.isInteger(t.top_n) && t.top_n >= MIN_TOP_N &&
    isPositiveInt(t.reshuffle_min_moved) &&
    isPositiveInt(t.reshuffle_min_displacement);
}

// ---------- top-N measure (one function, used by the detector and by plan 07) ----------

function topRanks(snapshot, n) {
  const out = new Map();
  if (!snapshot || !Array.isArray(snapshot.pairs)) return out;
  snapshot.pairs.forEach(function (p) {
    if (p && Number.isInteger(p.rank) && p.rank <= n) out.set(pairKey(p.a, p.b), p.rank);
  });
  return out;
}

/**
 * topNMetrics(previous, current, n) -> { entered, left, max_shift }.
 * entered: members of the current top n that were not in the previous top n.
 * left: members of the previous top n that are not in the current top n.
 * max_shift: the largest absolute rank change among members in both.
 */
function topNMetrics(previous, current, n) {
  const zero = { entered: 0, left: 0, max_shift: 0 };
  try {
    if (!previous || !current || !Number.isInteger(n) || n < 1) return zero;
    const prev = topRanks(previous, n);
    const cur = topRanks(current, n);
    let entered = 0;
    let left = 0;
    let maxShift = 0;
    cur.forEach(function (rank, key) {
      if (!prev.has(key)) {
        entered += 1;
      } else {
        const shift = Math.abs(rank - prev.get(key));
        if (shift > maxShift) maxShift = shift;
      }
    });
    prev.forEach(function (_rank, key) {
      if (!cur.has(key)) left += 1;
    });
    return { entered: entered, left: left, max_shift: maxShift };
  } catch (_e) {
    return zero;
  }
}

// ---------- the diff ----------

function bandCrossEvents(previous, current) {
  const before = new Map();
  previous.pairs.forEach(function (p) { before.set(pairKey(p.a, p.b), p.band); });
  const out = [];
  const seen = new Set();
  current.pairs.forEach(function (p) {
    const key = pairKey(p.a, p.b);
    if (seen.has(key)) return;
    seen.add(key);
    const fromBand = before.has(key) ? before.get(key) : 'none';
    const toBand = p.band;
    if (fromBand === toBand) return;
    if (!isFiring(fromBand) && !isFiring(toBand)) return;
    out.push({
      kind: 'band_cross',
      a_handle: p.a < p.b ? p.a : p.b,
      b_handle: p.a < p.b ? p.b : p.a,
      from_band: fromBand,
      to_band: toBand,
      direction: bandIndex(toBand) > bandIndex(fromBand) ? 'up' : 'down'
    });
  });
  return out;
}

function tailEnterEvents(previous, current) {
  if (current.tail.insufficient_structure === true || current.tail.suspect_noise === true) return [];
  const before = new Set(previous.tail.items.map(function (i) { return i.id; }));
  const out = [];
  const seen = new Set();
  current.tail.items.forEach(function (i) {
    if (before.has(i.id) || seen.has(i.id)) return;
    seen.add(i.id);
    out.push({ kind: 'tail_enter', handle: i.id });
  });
  return out;
}

function eventSortKey(e) {
  if (e.kind === 'band_cross') return e.a_handle + '|' + e.b_handle;
  if (e.kind === 'tail_enter') return e.handle;
  return '';
}

function orderEvents(events) {
  return events.slice().sort(function (x, y) {
    const k = KIND_ORDER[x.kind] - KIND_ORDER[y.kind];
    if (k !== 0) return k;
    const sx = eventSortKey(x);
    const sy = eventSortKey(y);
    return sx < sy ? -1 : sx > sy ? 1 : 0;
  });
}

/**
 * diffRuns(previous, current, thresholds) ->
 *   { comparable, reason, reshuffle_active, events, counts }.
 * Not comparable: no previous run, another scope, another encoder kind, another
 * schema version, or a snapshot that fails the closed schema. A non-comparable
 * result carries no events. Never throws.
 */
function diffRuns(previous, current, thresholds) {
  try {
    const t = thresholds === undefined ? defaultThresholds() : thresholds;
    const active = reshuffleIsActive(t);
    if (previous === null || previous === undefined) return notComparable('no_previous_run', active);
    if (!isPlainObject(previous) || !isPlainObject(current)) return notComparable('invalid_snapshot', active);
    if (previous.schema_version !== current.schema_version) return notComparable('schema_mismatch', active);
    if (!snapshotStore.validateSnapshot(previous)) return notComparable('invalid_previous', active);
    if (!snapshotStore.validateSnapshot(current)) return notComparable('invalid_current', active);
    if (previous.scope_id !== current.scope_id) return notComparable('scope_changed', active);
    if (previous.encoder_kind !== current.encoder_kind) return notComparable('encoder_changed', active);

    let events = bandCrossEvents(previous, current).concat(tailEnterEvents(previous, current));
    if (active) {
      const m = topNMetrics(previous, current, t.top_n);
      if (m.entered + m.left >= t.reshuffle_min_moved || m.max_shift >= t.reshuffle_min_displacement) {
        events.push({ kind: 'top_n_reshuffle', top_n: t.top_n, entered: m.entered, left: m.left, max_shift: m.max_shift });
      }
    }
    events = orderEvents(events);
    const counts = zeroCounts();
    events.forEach(function (e) { counts[e.kind] += 1; });
    return { comparable: true, reason: events.length ? 'movement' : 'no_movement', reshuffle_active: active, events: events, counts: counts };
  } catch (_e) {
    return notComparable('diff_error', false);
  }
}

// ---------- the envelope ----------

function validEvent(e) {
  if (!isPlainObject(e)) return false;
  if (e.kind === 'band_cross') {
    if (!sortedKeysEqual(e, ['kind', 'a_handle', 'b_handle', 'from_band', 'to_band', 'direction'])) return false;
    return isHandle(e.a_handle) && isHandle(e.b_handle) &&
      BAND_ORDER.indexOf(e.from_band) !== -1 && BAND_ORDER.indexOf(e.to_band) !== -1 &&
      (e.direction === 'up' || e.direction === 'down');
  }
  if (e.kind === 'tail_enter') {
    return sortedKeysEqual(e, ['kind', 'handle']) && isHandle(e.handle);
  }
  if (e.kind === 'top_n_reshuffle') {
    if (!sortedKeysEqual(e, ['kind', 'top_n', 'entered', 'left', 'max_shift'])) return false;
    return Number.isInteger(e.top_n) && e.top_n >= MIN_TOP_N && isCount(e.entered) && isCount(e.left) && isCount(e.max_shift);
  }
  return false;
}

/**
 * validateEnvelope(env) -> boolean. The closed schema: exact keys, enums,
 * opaque handles and counts. Any extra key, such as a title or a label, fails.
 */
function validateEnvelope(env) {
  try {
    if (!sortedKeysEqual(env, ['schema_version', 'kind', 'movement_id', 'detected_at', 'scope', 'scope_id', 'encoder_kind', 'counts', 'events'])) return false;
    if (env.schema_version !== 1 || env.kind !== ENVELOPE_KIND) return false;
    if (typeof env.movement_id !== 'string' || !MOVEMENT_ID_RE.test(env.movement_id)) return false;
    if (typeof env.detected_at !== 'string' || !ISO_RE.test(env.detected_at) || !Number.isFinite(Date.parse(env.detected_at))) return false;
    if (env.scope !== 'room' && env.scope !== 'subset') return false;
    if (typeof env.scope_id !== 'string' || !SCOPE_ID_RE.test(env.scope_id)) return false;
    if ((env.scope === 'room') !== (env.scope_id === 'room')) return false;
    if (env.encoder_kind !== 'live' && env.encoder_kind !== 'stub') return false;
    if (!sortedKeysEqual(env.counts, EVENT_KINDS.slice())) return false;
    for (let i = 0; i < EVENT_KINDS.length; i += 1) {
      if (!isCount(env.counts[EVENT_KINDS[i]])) return false;
    }
    if (!Array.isArray(env.events) || env.events.length < 1 || env.events.length > MAX_EVENTS) return false;
    for (let i = 0; i < env.events.length; i += 1) {
      if (!validEvent(env.events[i])) return false;
    }
    return true;
  } catch (_e) {
    return false;
  }
}

function eventIdentity(e) {
  if (e.kind === 'band_cross') return ['band_cross', e.a_handle, e.b_handle, e.from_band, e.to_band].join(':');
  if (e.kind === 'tail_enter') return 'tail_enter:' + e.handle;
  return ['top_n_reshuffle', e.top_n, e.entered, e.left, e.max_shift].join(':');
}

/**
 * buildMovementEnvelope(diff, current, now) -> the closed envelope, or null when
 * there are no events. At most MAX_EVENTS events are kept (Shape F MAX_K); the
 * counts hold the full numbers. The movement id is a hash of the run time, the
 * scope id and the sorted event identities, so the same inputs give the same id.
 * Reads handles, bands and counts only: no label can reach the envelope.
 */
function buildMovementEnvelope(diff, current, now) {
  try {
    if (!isPlainObject(diff) || diff.comparable !== true) return null;
    if (!Array.isArray(diff.events) || diff.events.length === 0) return null;
    if (!isPlainObject(current)) return null;
    const when = now instanceof Date ? now : new Date(now === undefined ? Date.now() : now);
    if (!Number.isFinite(when.getTime())) return null;
    const ordered = orderEvents(diff.events);
    const identities = ordered.map(eventIdentity).sort();
    const hash = crypto.createHash('sha256').update([current.ran_at, current.scope_id, identities.join(',')].join('|')).digest('hex');
    const counts = diff.counts && sortedKeysEqual(diff.counts, EVENT_KINDS.slice())
      ? { band_cross: diff.counts.band_cross, tail_enter: diff.counts.tail_enter, top_n_reshuffle: diff.counts.top_n_reshuffle }
      : zeroCounts();
    const env = {
      schema_version: 1,
      kind: ENVELOPE_KIND,
      movement_id: 'pm_' + hash.slice(0, 12),
      detected_at: when.toISOString(),
      scope: current.scope,
      scope_id: current.scope_id,
      encoder_kind: current.encoder_kind,
      counts: counts,
      events: ordered.slice(0, MAX_EVENTS)
    };
    return validateEnvelope(env) ? env : null;
  } catch (_e) {
    return null;
  }
}

module.exports = {
  BAND_ORDER: BAND_ORDER,
  MAX_EVENTS: MAX_EVENTS,
  THRESHOLDS_PATH: THRESHOLDS_PATH,
  loadThresholds: loadThresholds,
  topNMetrics: topNMetrics,
  diffRuns: diffRuns,
  buildMovementEnvelope: buildMovementEnvelope,
  validateEnvelope: validateEnvelope
};
