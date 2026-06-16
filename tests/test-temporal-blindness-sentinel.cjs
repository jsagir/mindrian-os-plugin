'use strict';
/*
 * Phase 160-06 Task 3 test -- the temporal-blindness sentinel (R12, D-04).
 * ========================================================================
 *
 * sensorTemporalBlindness(ctx) scans room.db for real-world-event nodes
 * (type 'meeting' OR has_event_date===true) where valid_at IS NULL and returns
 * EXACTLY those nodes for dating; emits temporal_blindness_surfaced when it
 * surfaces any. SPEC R12 acceptance:
 *   - with N undated real-world nodes present, returns exactly those N;
 *   - with zero present, returns empty and surfaces nothing (emits NO event).
 *
 * The sentinel must IGNORE:
 *   - dated real-world nodes (valid_at present in properties), and
 *   - non-real-world undated nodes (a plain assumption, no has_event_date flag).
 *
 * Also asserts the EVENT_TYPES FLOOR (additive named-membership): the new type
 * is present, representative prior members still pass, a made-up type is
 * rejected.
 *
 * House rule: hyphens only, no em-dashes. node:sqlite SKIP-77 when unavailable
 * (treated as PASS by the aggregator).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');

// SKIP-77 probe.
try {
  require('node:sqlite');
} catch (_e) {
  process.stdout.write('SKIP-77: node:sqlite unavailable -- skipping temporal-blindness sentinel test\n');
  process.exit(77);
}

const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const { sensorTemporalBlindness } = require(path.join(REPO_ROOT, 'lib', 'core', 'sensors', 'sensor-temporal-blindness.cjs'));
const { EVENT_TYPES } = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'memory-events.cjs'));

const REF = Date.UTC(2026, 5, 16, 12, 0, 0, 0);

let checks = 0;
let passed = 0;
function check(label, condition, detail) {
  checks += 1;
  if (condition) {
    passed += 1;
    process.stdout.write('  ok ' + label + '\n');
  } else {
    process.stdout.write('  FAIL ' + label + (detail ? ' -- ' + detail : '') + '\n');
  }
}

// Insert a node with optional valid_at / has_event_date on the properties JSON.
function insertNode(db, id, type, props) {
  const properties = JSON.stringify(props || {});
  db.prepare(
    "INSERT INTO nodes (id, type, properties, source_path, created_by, review_status, created_at, last_seen_at) " +
    "VALUES (?, ?, ?, ?, 'user', 'confirmed', ?, ?)"
  ).run(id, type, properties, type + '/' + id, REF, REF);
}

function newRoom() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-160-sentinel-'));
  const db = openRoomDb(tmp);
  return { tmp, db };
}
function cleanup(tmp, db) {
  try { closeRoomDb(db); } catch (_) { /* ignore */ }
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* ignore */ }
}

// ---------------------------------------------------------------------------
// EVENT_TYPES FLOOR (additive named-membership; never an absolute size).
// ---------------------------------------------------------------------------
check('FLOOR: temporal_blindness_surfaced is in EVENT_TYPES', EVENT_TYPES.has('temporal_blindness_surfaced'));
check('FLOOR: prior member reach_presented still present', EVENT_TYPES.has('reach_presented'));
check('FLOOR: prior member f_selector_sync_confirmed still present', EVENT_TYPES.has('f_selector_sync_confirmed'));
check('FLOOR: prior member room_created still present', EVENT_TYPES.has('room_created'));
check('FLOOR: a made-up type is NOT a member', EVENT_TYPES.has('temporal_blindness_made_up') === false);

// ---------------------------------------------------------------------------
// R12: with N undated real-world nodes present, returns EXACTLY those N + emits.
// ---------------------------------------------------------------------------
(function withUndatedNodes() {
  const { tmp, db } = newRoom();
  try {
    // 3 undated real-world nodes (the N to surface):
    insertNode(db, 'meeting:a', 'meeting', {});                       // meeting, no valid_at
    insertNode(db, 'meeting:b', 'meeting', { has_event_date: true }); // meeting, no valid_at
    insertNode(db, 'decision:c', 'decision', { has_event_date: true });// flagged, no valid_at
    // Distractors that must NOT be returned:
    insertNode(db, 'meeting:dated', 'meeting', { valid_at: REF });    // dated meeting
    insertNode(db, 'assumption:idea', 'assumption', {});              // not a real-world event
    insertNode(db, 'claim:plain', 'claim', { has_event_date: false });// flagged false

    const res = sensorTemporalBlindness({ db, now: () => REF });

    check('R12: sentinel returns a result object', res && typeof res === 'object', JSON.stringify(res));
    check('R12: returns EXACTLY the 3 undated real-world nodes',
      Array.isArray(res.nodes) && res.nodes.length === 3,
      'got ' + (res && res.nodes ? res.nodes.length : 'none'));
    const ids = (res.nodes || []).map((n) => n.id).sort();
    check('R12: returns exactly {meeting:a, meeting:b, decision:c}',
      JSON.stringify(ids) === JSON.stringify(['decision:c', 'meeting:a', 'meeting:b']),
      JSON.stringify(ids));
    check('R12: count scalar matches', res.count === 3, String(res.count));

    // The temporal_blindness_surfaced event WAS emitted (it surfaced 3).
    const evRow = db.prepare(
      "SELECT id FROM nodes WHERE type = 'memory_event' " +
      "AND json_extract(properties, '$.event_type') = 'temporal_blindness_surfaced' LIMIT 1"
    ).get();
    check('R12: temporal_blindness_surfaced emitted when nodes surfaced', !!evRow);

    // Part 8: the event payload carries a count scalar only, never node prose.
    const evProps = evRow ? JSON.parse(
      db.prepare('SELECT properties FROM nodes WHERE id = ?').get(evRow.id).properties
    ) : {};
    check('R12: event payload carries the count scalar', evProps.count === 3, JSON.stringify(evProps));
  } finally {
    cleanup(tmp, db);
  }
})();

// ---------------------------------------------------------------------------
// R12: with ZERO undated real-world nodes, returns empty + emits NOTHING.
// ---------------------------------------------------------------------------
(function withZeroUndated() {
  const { tmp, db } = newRoom();
  try {
    // Only dated + non-real-world nodes present.
    insertNode(db, 'meeting:dated', 'meeting', { valid_at: REF });
    insertNode(db, 'assumption:idea', 'assumption', {});

    const res = sensorTemporalBlindness({ db, now: () => REF });

    check('R12-empty: returns empty nodes array', Array.isArray(res.nodes) && res.nodes.length === 0,
      JSON.stringify(res.nodes));
    check('R12-empty: count is 0', res.count === 0, String(res.count));
    check('R12-empty: surfaced is false', res.surfaced === false, String(res.surfaced));

    // No temporal_blindness_surfaced event emitted when nothing surfaced.
    const evRow = db.prepare(
      "SELECT COUNT(*) AS c FROM nodes WHERE type = 'memory_event' " +
      "AND json_extract(properties, '$.event_type') = 'temporal_blindness_surfaced'"
    ).get();
    check('R12-empty: NO temporal_blindness_surfaced event emitted', evRow.c === 0, String(evRow.c));
  } finally {
    cleanup(tmp, db);
  }
})();

// ---------------------------------------------------------------------------
// Robustness: a missing db handle degrades to empty (never throws).
// ---------------------------------------------------------------------------
(function noDb() {
  const res = sensorTemporalBlindness({});
  check('robust: no db -> empty result, no throw', res && Array.isArray(res.nodes) && res.nodes.length === 0,
    JSON.stringify(res));
})();

process.stdout.write('\n');
process.stdout.write('temporal-blindness sentinel: ' + passed + '/' + checks + ' checks passed\n');
process.exit(passed === checks ? 0 : 1);
