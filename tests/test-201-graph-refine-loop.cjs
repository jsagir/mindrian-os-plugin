'use strict';
// Phase 201-03 -- SEED-033 L2: the self-improving graph loop (propose -> fact-check -> refine).
//
// Human-gated (dryRun default, writes only on approve), LOCAL only (Part 8), all writes
// through navigation.writeEdge (Part 9), bounded (maxRounds + no-new-verified stop),
// dedup (a rejected proposal is not re-proposed). Logic legs run offline via injected
// seams; the write leg uses a real migrated room.db.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const { runGraphRefine, defaultFactCheck } = require(path.join(REPO, 'lib', 'core', 'graph-refine-loop.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
const navigation = require(path.join(REPO, 'lib', 'core', 'navigation.cjs'));

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

const FOCUS = 'node:a';
const NEIGHBORHOOD = [{ id: 'node:b', type: 'claim', edgeTypeIn: 'RELATED_TO' }];
const stubNeighbors = function () { return NEIGHBORHOOD; };

console.log('test-201-graph-refine-loop');

ok('defaultFactCheck: verified only when endpoints present + type allowed + not duplicate', function () {
  assert.equal(defaultFactCheck({ from: FOCUS, to: 'node:b', type: 'SHARES_JOB' }, NEIGHBORHOOD, FOCUS).verified, true);
  assert.equal(defaultFactCheck({ from: FOCUS, to: 'node:z', type: 'SHARES_JOB' }, NEIGHBORHOOD, FOCUS).verified, false); // absent
  assert.equal(defaultFactCheck({ from: FOCUS, to: 'node:b', type: 'BOGUS_TYPE' }, NEIGHBORHOOD, FOCUS).verified, false); // not allowed
  // Duplicate: node:b already reached from focus by RELATED_TO -> proposing RELATED_TO is a dup.
  assert.equal(defaultFactCheck({ from: FOCUS, to: 'node:b', type: 'RELATED_TO' }, NEIGHBORHOOD, FOCUS).verified, false);
});

ok('dry-run (default) returns verified proposals and writes NOTHING', function () {
  let calls = 0;
  const res = runGraphRefine(null, {
    focusNodeId: FOCUS,
    db: {}, // never touched in dry-run
    getNeighborhoodFn: stubNeighbors,
    proposeFn: function () { calls += 1; return calls === 1 ? [{ from: FOCUS, to: 'node:b', type: 'SHARES_JOB' }] : []; },
  });
  assert.equal(res.verified.length, 1, 'one verified proposal');
  assert.equal(res.written.length, 0, 'dry-run writes nothing');
});

ok('bounded: stops at maxRounds and early on no-new-verified', function () {
  // A proposeFn that keeps proposing the SAME verified edge: after round 1 it is seen,
  // round 2 has no fresh proposals -> converge before maxRounds.
  const res = runGraphRefine(null, {
    focusNodeId: FOCUS, db: {}, maxRounds: 5, getNeighborhoodFn: stubNeighbors,
    proposeFn: function () { return [{ from: FOCUS, to: 'node:b', type: 'SHARES_JOB' }]; },
  });
  assert.equal(res.rounds <= 2, true, 'converges within 2 rounds, got ' + res.rounds);
  assert.equal(res.verified.length, 1, 'the edge is verified once, not duplicated across rounds');
});

ok('dedup: a rejected proposal is not re-proposed (and never verified)', function () {
  let rounds = 0;
  const res = runGraphRefine(null, {
    focusNodeId: FOCUS, db: {}, maxRounds: 5, getNeighborhoodFn: stubNeighbors,
    proposeFn: function () { rounds += 1; return [{ from: FOCUS, to: 'node:z', type: 'SHARES_JOB' }]; }, // node:z absent -> rejected
  });
  assert.equal(res.verified.length, 0, 'the invalid proposal never verifies');
  assert.equal(res.proposed.length, 1, 'the rejected proposal is proposed once, then dedup-blocked');
});

ok('approve + real room.db: verified edge is WRITTEN through the chokepoint + memory_event', function () {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'graph-refine-'));
  fs.mkdirSync(path.join(tmp, '.mindrian'), { recursive: true });
  const db = openRoomDb(tmp);
  const now = Date.now();
  const insertNode = db.prepare(
    'INSERT INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at) ' +
    "VALUES (?, ?, '{}', 'system:test', 'system', NULL, 'proposed', ?, ?)"
  );
  insertNode.run(FOCUS, 'claim', now, now);
  insertNode.run('node:b', 'claim', now, now);
  // Seed a RELATED_TO edge so node:b appears in the neighborhood of the focus.
  navigation.writeEdge(db, { source_id: FOCUS, target_id: 'node:b', edge_type: 'RELATED_TO', properties: {} });

  const res = runGraphRefine(null, {
    focusNodeId: FOCUS, db: db, approve: true, dryRun: false,
    proposeFn: function (nb, seen) { return seen.size === 0 ? [{ from: FOCUS, to: 'node:b', type: 'SHARES_JOB' }] : []; },
  });
  assert.equal(res.written.length, 1, 'the verified SHARES_JOB edge was written');

  // Confirm the edge landed and a memory_event was emitted.
  const edge = db.prepare("SELECT COUNT(*) AS c FROM edges WHERE source=? AND target=? AND type='SHARES_JOB'").get(FOCUS, 'node:b').c;
  assert.equal(edge, 1, 'SHARES_JOB edge present in room.db');
  const ev = db.prepare("SELECT COUNT(*) AS c FROM nodes WHERE type='memory_event' AND json_extract(properties,'$.event_type')='edge_added'").get().c;
  assert.equal(ev >= 1, true, 'an edge_added memory_event was emitted through the chokepoint');

  closeRoomDb(db);
  fs.rmSync(tmp, { recursive: true, force: true });
});

console.log('\nPASS test-201-graph-refine-loop (' + n + ' assertions)');
