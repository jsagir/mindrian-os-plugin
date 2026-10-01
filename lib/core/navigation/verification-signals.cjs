'use strict';

// Phase 365-11: the weekly verification record and the two unsolicited
// verification signals (D-17, D-18, D-23).
//
// Canon Part 9: the snapshot is a memory_event written ONLY through the
//   navigation logMemoryEvent path (memory-events.cjs logEvent); every read
//   here goes through the db handle the caller opened via navigation. This
//   module never opens a database itself.
// Canon Part 8: the snapshot payload is a fixed list of counts plus a week key
//   and created_by. No claim text, no id, no url. Nothing leaves the machine.
// Canon Part 12: no signal text carries a score, grade, badge or praise, and a
//   low standing is never framed as failure. Every signal carries its fix.
//
// Two signals only (D-17), both computed from the ONE standing reader
// (verification.cjs claimStanding); no model computes or grades either:
//   1. a decision rests on a claim whose standing is model_only.
//   2. the last STALL_WEEKS weekly snapshots show the same standing counts
//      while records_total grew, and the last snapshot still has a claim at
//      model_only or none: checks were recorded that moved no claim past
//      asking a model.
//
// The Zone 3 strip renders only `type: message`, so each message ends with its
// fix (INV-SL-4); the separate `fix` field keeps the structured copy.
//
// NO em-dashes in this file (CLAUDE.md HARD RULE); hyphens only.

const verification = require('./verification.cjs');
const memoryEvents = require('./memory-events.cjs');

// Disclosed in data/floor-ledger.json (verification-signals.STALL_WEEKS): the
// number of flat weekly snapshots, with checks still being recorded, before
// the room says checks moved no claim past asking a model (365 D-23, unmeasured).
const STALL_WEEKS = 4;
// The stall signal never fires with fewer than this many snapshots (D-17).
const MIN_SNAPSHOTS = 2;

const SNAPSHOT_EVENT = 'verification_distribution_snapshot';
// Gate decision nodes (gate.cjs mints decision:gate:<id>) record the gate's own
// answer about a claim; they never count as a decision resting on that claim.
const GATE_DECISION_PREFIX = 'decision:gate:';
const MS_PER_DAY = 86400000;
const MAX_DECISIONS_SCANNED = 50;
const SNAPSHOT_KEYS = Object.freeze([
  'week', 'located_source', 'source_edge', 'model_only', 'none', 'held', 'records_total', 'created_by',
]);
const STANDING_COUNT_KEYS = Object.freeze(['located_source', 'source_edge', 'model_only', 'none']);
const COUNT_KEYS = Object.freeze(['located_source', 'source_edge', 'model_only', 'none', 'held']);

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function pad2(n) {
  return n < 10 ? '0' + n : String(n);
}

// isoWeekKey(nowMs) -> 'YYYY-Www' using the ISO 8601 week-year (Thursday rule).
function isoWeekKey(nowMs) {
  const t = Number.isFinite(nowMs) ? nowMs : Date.now();
  const d = new Date(t);
  const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = day.getUTCDay() === 0 ? 7 : day.getUTCDay(); // Mon=1 .. Sun=7
  day.setUTCDate(day.getUTCDate() + 4 - dow); // the Thursday of this ISO week
  const yearStart = Date.UTC(day.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((day.getTime() - yearStart) / MS_PER_DAY + 1) / 7);
  return day.getUTCFullYear() + '-W' + pad2(week);
}

// readDistribution(db) -> counts of claims by standing, the held count (claims
// at review_status needs_evidence), and records_total. Read-only; never throws.
function readDistribution(db) {
  const out = { located_source: 0, source_edge: 0, model_only: 0, none: 0, held: 0, records_total: 0 };
  let rows = [];
  try {
    rows = db.prepare("SELECT id, review_status FROM nodes WHERE type = 'claim'").all() || [];
  } catch (_e) {
    return out;
  }
  for (const row of rows) {
    const st = verification.claimStanding(db, row.id);
    if (!st || !st.found) continue;
    if (STANDING_COUNT_KEYS.indexOf(st.standing) !== -1) {
      out[st.standing] += 1;
    } else {
      out.none += 1;
    }
    if (row.review_status === 'needs_evidence') out.held += 1;
    out.records_total += Number.isInteger(st.records_total) ? st.records_total : 0;
  }
  return out;
}

function parseJson(text) {
  try {
    const v = JSON.parse(text || '{}');
    return isPlainObject(v) ? v : {};
  } catch (_e) {
    return {};
  }
}

function toSnapshot(props) {
  const snap = {};
  snap.week = typeof props.week === 'string' ? props.week : '';
  for (const k of COUNT_KEYS) snap[k] = Number.isInteger(props[k]) && props[k] >= 0 ? props[k] : 0;
  snap.records_total = Number.isInteger(props.records_total) && props.records_total >= 0 ? props.records_total : 0;
  snap.created_by = typeof props.created_by === 'string' ? props.created_by : 'system';
  return snap;
}

// readSnapshots(db, limit) -> snapshots ordered by week ascending (the last
// `limit` weeks; one per week). Read-only; never throws.
function readSnapshots(db, limit) {
  const cap = Number.isInteger(limit) && limit > 0 ? limit : 52;
  let rows = [];
  try {
    rows = db.prepare(
      "SELECT properties FROM nodes WHERE type = 'memory_event' " +
      "AND json_extract(properties, '$.event_type') = ? ORDER BY created_at ASC"
    ).all(SNAPSHOT_EVENT) || [];
  } catch (_e) {
    return [];
  }
  const byWeek = new Map();
  for (const row of rows) {
    const snap = toSnapshot(parseJson(row.properties));
    if (!snap.week) continue;
    if (!byWeek.has(snap.week)) byWeek.set(snap.week, snap);
  }
  const all = Array.from(byWeek.values()).sort((a, b) => (a.week < b.week ? -1 : a.week > b.week ? 1 : 0));
  return all.slice(Math.max(0, all.length - cap));
}

function weekAlreadyWritten(db, week) {
  try {
    const row = db.prepare(
      "SELECT id FROM nodes WHERE type = 'memory_event' " +
      "AND json_extract(properties, '$.event_type') = ? AND json_extract(properties, '$.week') = ? LIMIT 1"
    ).get(SNAPSHOT_EVENT, week);
    return !!row;
  } catch (_e) {
    return false;
  }
}

// snapshotWeek(db, nowMs) -> {written, week, ...}. One event per ISO week; a
// second call in the same week writes nothing. Counts only (D-18, Canon Part 8).
function snapshotWeek(db, nowMs) {
  const now = Number.isFinite(nowMs) ? nowMs : Date.now();
  const week = isoWeekKey(now);
  if (weekAlreadyWritten(db, week)) return { written: false, week, reason: 'already_written' };
  const dist = readDistribution(db);
  const payload = {
    week,
    located_source: dist.located_source,
    source_edge: dist.source_edge,
    model_only: dist.model_only,
    none: dist.none,
    held: dist.held,
    records_total: dist.records_total,
    created_by: 'system',
  };
  const res = memoryEvents.logEvent(db, SNAPSHOT_EVENT, payload, { now: () => now });
  if (!res || res.ok !== true) {
    return { written: false, week, reason: (res && res.reason) || 'write_failed' };
  }
  return { written: true, week, eventId: res.eventId, payload };
}

function snippet(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= 70) return clean;
  return clean.slice(0, 67).trimEnd() + '...';
}

// Signal 1: a non-gate decision resting on a model_only claim. At most one
// insight: the most recently touched decision that rests on one.
function decisionOnModelCheck(db) {
  let decisions = [];
  try {
    decisions = db.prepare(
      "SELECT id FROM nodes WHERE type = 'decision' " +
      "AND substr(id, 1, ?) != ? " +
      "AND COALESCE(review_status, '') NOT IN ('rejected', 'superseded') " +
      "ORDER BY last_seen_at DESC, created_at DESC LIMIT ?"
    ).all(GATE_DECISION_PREFIX.length, GATE_DECISION_PREFIX, MAX_DECISIONS_SCANNED) || [];
  } catch (_e) {
    return null;
  }
  const types = Array.from(verification.PROVENANCE_EDGE_TYPES);
  for (const dec of decisions) {
    let targets = [];
    try {
      targets = db.prepare(
        'SELECT DISTINCT target FROM edges WHERE source = ? AND type IN (' + types.map(() => '?').join(',') + ')'
      ).all(dec.id, ...types) || [];
    } catch (_e) {
      targets = [];
    }
    for (const t of targets) {
      const st = verification.claimStanding(db, t.target);
      if (!st || !st.found || st.standing !== 'model_only') continue;
      let text = '';
      try {
        const row = db.prepare('SELECT properties FROM nodes WHERE id = ?').get(t.target);
        text = parseJson(row && row.properties).text;
      } catch (_e) {
        text = '';
      }
      const closes = verification.STANDING_WORDS.model_only.moves_when;
      const label = snippet(text);
      const fix = '/mos:research';
      const message = 'A decision rests on ' + (label ? '"' + label + '", ' : 'a claim ') +
        verification.STANDING_WORDS.model_only.label + '. It moves when ' + closes + '. Next: ' + fix + '.';
      return { type: 'verification', key: 'verification:decision_on_model_check:' + t.target, confidence: 'medium', message, fix };
    }
  }
  return null;
}

function sameCounts(a, b) {
  return COUNT_KEYS.every((k) => a[k] === b[k]);
}

// Signal 2: the last STALL_WEEKS snapshots are flat while records_total grew,
// and the final snapshot still has a claim at model_only or none.
function stallSignal(snapshots) {
  if (!Array.isArray(snapshots)) return null;
  if (snapshots.length < Math.max(MIN_SNAPSHOTS, STALL_WEEKS)) return null;
  const window = snapshots.slice(snapshots.length - STALL_WEEKS);
  const first = window[0];
  const last = window[window.length - 1];
  if (!window.every((s) => sameCounts(s, first))) return null;
  if (!(last.records_total > first.records_total)) return null;
  if (!(last.model_only + last.none >= 1)) return null;
  const fix = 'Pick one claim a decision rests on and check it against a source document (/mos:research).';
  const message = 'Checks in the last ' + STALL_WEEKS + ' weeks moved no claim past asking a model. ' + fix;
  return { type: 'verification', key: 'verification:stall', confidence: 'medium', message, fix };
}

// readVerificationSignals(db, snapshots) -> 0 to 2 insights, never throws.
// `snapshots` defaults to readSnapshots(db).
function readVerificationSignals(db, snapshots) {
  const out = [];
  try {
    const one = decisionOnModelCheck(db);
    if (one) out.push(one);
  } catch (_e) { /* a signal fault never raises */ }
  try {
    const snaps = Array.isArray(snapshots) ? snapshots : readSnapshots(db);
    const two = stallSignal(snaps);
    if (two) out.push(two);
  } catch (_e) { /* a signal fault never raises */ }
  return out;
}

module.exports = {
  STALL_WEEKS,
  MIN_SNAPSHOTS,
  SNAPSHOT_EVENT,
  SNAPSHOT_KEYS,
  GATE_DECISION_PREFIX,
  isoWeekKey,
  readDistribution,
  snapshotWeek,
  readSnapshots,
  readVerificationSignals,
};
