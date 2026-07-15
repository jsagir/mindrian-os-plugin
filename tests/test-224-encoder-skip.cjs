'use strict';
/*
 * Phase 224-02 Task 1 -- D-04 encoder-unavailable skip + disclosure marker.
 * ========================================================================
 * Proves the drain's DEFAULT (score-based) path is a SOFT-FAIL, ADVISORY skip
 * when the semantic encoder is unavailable (SEED-059 disclosure convention):
 *   1. ZERO scoring, ZERO typed edges, exactly ONE derivation_skipped
 *      memory_event with reason 'encoder_unavailable', queue CLEARED, ok:true
 *      (never throws, never blocks).
 *   2. the derivation_skipped payload carries SCALAR fields only (reason,
 *      trigger basename, pair count) -- never artifact body text (Part 8).
 *   3. a second forced-unavailable drain inside the 60s dedupe window does NOT
 *      write a second marker (payload.dedupe_key rides the logEvent idempotency).
 *
 * Reads in tests are exempt from the navigation chokepoint rule (repo
 * convention): the marker row is asserted via a direct SELECT. No em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const sweep = require(path.join(REPO_ROOT, 'scripts', 'gsd-graph-derive-sweep.cjs'));
const drain = require(path.join(REPO_ROOT, 'scripts', 'gsd-graph-derive-drain.cjs'));
const { buildFixtureRoom224 } = require(path.join(REPO_ROOT, 'tests', 'helpers', 'fixture-room-224.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));

let pass = 0;
function check(label, cond) {
  assert.ok(cond, label);
  pass += 1;
  console.log('  ok -', label);
}

function selectSkipMarkers(roomDir) {
  const db = openRoomDb(roomDir);
  try {
    return db.prepare(
      "SELECT properties FROM nodes WHERE type = 'memory_event' " +
      "AND json_extract(properties, '$.event_type') = 'derivation_skipped'"
    ).all();
  } finally {
    closeRoomDb(db);
  }
}

function countCascadeEdges(roomDir) {
  const db = openRoomDb(roomDir);
  try {
    const row = db.prepare(
      "SELECT COUNT(*) AS n FROM edges WHERE type IN " +
      "('CONVERGES','INFORMS','CONTRADICTS','INVALIDATES','ENABLES','REFINES','ROOT_CAUSES')"
    ).get();
    return row ? row.n : 0;
  } finally {
    closeRoomDb(db);
  }
}

async function main() {
  console.log('test-224-encoder-skip (D-04 skip + disclosure marker)');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'derive-224-skip-'));
  const fixture = await buildFixtureRoom224(tmp, { artifactCount: 4 });
  const roomDir = fixture.roomDir;
  const triggerFile = fixture.relatedPair.a;

  // --- Behavior 1: forced-unavailable drain skips everything + discloses. ---
  sweep.enqueueDerive(roomDir, { filePath: triggerFile });
  const res1 = await drain.drainDerive(roomDir, { probeOpts: { _forceUnavailable: true } });

  check('the forced-unavailable drain returns ok:true (soft-fail, never throws)', res1 && res1.ok === true);
  check('the queue is cleared after the skip', sweep.readQueue(roomDir).entries.length === 0);
  check('ZERO typed cascade edges were written', countCascadeEdges(roomDir) === 0);

  const markers1 = selectSkipMarkers(roomDir);
  check('exactly ONE derivation_skipped marker was written', markers1.length === 1);

  const payload1 = JSON.parse(markers1[0].properties);
  check("the marker reason is 'encoder_unavailable'", payload1.reason === 'encoder_unavailable');
  check('the marker trigger is the room-relative basename', payload1.trigger === path.basename(triggerFile));
  check('the marker carries a numeric pairs_skipped scalar', typeof payload1.pairs_skipped === 'number' && payload1.pairs_skipped > 0);

  // --- Behavior 2: scalar-only payload, never artifact body text (Part 8). ---
  const rawPayload = markers1[0].properties;
  // A distinctive phrase from the RELATED artifact body -- must NOT leak into the marker.
  check('the marker payload contains NO artifact body text (Part 8)',
    rawPayload.indexOf('pre-portioned') === -1 && rawPayload.indexOf('subscription box') === -1);
  const allScalar = Object.keys(payload1).every((k) => {
    const v = payload1[k];
    return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';
  });
  check('every derivation_skipped payload field is a scalar', allScalar);

  // --- Behavior 3: a second forced-unavailable drain dedupes (no 2nd marker). ---
  sweep.enqueueDerive(roomDir, { filePath: triggerFile });
  const res2 = await drain.drainDerive(roomDir, { probeOpts: { _forceUnavailable: true } });
  check('the second forced-unavailable drain also returns ok:true', res2 && res2.ok === true);

  const markers2 = selectSkipMarkers(roomDir);
  check('the second drain does NOT write a second marker (60s dedupe window)', markers2.length === 1);

  console.log(`\nPASS (${pass}/${pass})`);
}

main().catch((e) => {
  console.error('FAIL', e && e.stack ? e.stack : e);
  process.exit(1);
});
