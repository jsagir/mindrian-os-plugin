'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick task 260728-7kc -- the read-only proof for the two declared-read MCP
 * pull tools (suggest_next / reach_candidates) and the opt-in readOnly mode on
 * the shared Phase 222 ranker.
 * ============================================================================
 * WHY THIS FILE EXISTS. suggest_next and reach_candidates both declare
 * hitl_shape 'none' and both read as pure reads at the tool surface, but they
 * inherited THREE writes one layer down: the Phase 222 fire-and-forget Hedge
 * weight-state upsert, the Req 7 degrade memory_event, and (largest, on EVERY
 * call rather than only on 2+ candidates) the mkdir + 13 CREATE TABLE + 5
 * migrations that room-db.cjs runs on any openRoomDbForCaller. A tool that says
 * read-only and migrates the caller's database is the same false-status bug
 * class this repo already tracks.
 *
 * THE GATE IS RUNTIME BYTE-IDENTITY, NEVER INSPECTION. A grep for
 * openRoomDbForCaller in sensors.cjs would be a FALSE gate: contradiction_check
 * and whitespace_scan legitimately still use it in the same file. So the proof
 * is a per-file sha256 of everything under .mindrian/ taken before and after
 * real handler invocations, plus a control arm proving the same fixture DOES
 * change on disk through the write path.
 *
 * UPDATED by quick task 260728-8av (RCA hedge-fold-has-no-production-trigger):
 * the Hedge weight refit moved OFF rankFiredCandidates entirely, onto the
 * explicit navigator-triggered scripts/hedge-refit-pipeline.cjs. The ranking
 * call no longer folds in ANY mode, readOnly or not, so leg A below no longer
 * pins a fold parity; it now pins the degrade write plus the write-free hot
 * path (see tests/test-222-fold-wired.cjs for the new entry point's own
 * production-trigger and end-to-end proofs).
 *
 * Leg map:
 *   A. DEFAULT-OFF PARITY  -- readOnly absent leaves the CLI path byte-identical:
 *                             the ranking call folds NOTHING in either mode
 *                             (quick 260728-8av moved the fold out), the degrade
 *                             still writes a memory_event. (The opt-in seam
 *                             mirrors Phase 233-03's skipRebuild precedent:
 *                             default OFF.)
 *   B. NO FOLD UNDER readOnly -- proven twice: against a REAL room.db (no weight
 *                             state is written) and against a stubbed navigation
 *                             module recording every call (the fold's queries
 *                             are never even issued). Each carries its own
 *                             load-bearing control.
 *   C. DEGRADE TO SINK     -- under readOnly the enum token lands on
 *                             roomState.degradeSink and NOT in room.db, for both
 *                             fault kinds, with an absent-sink safety leg.
 *   D. ORDERING PARITY     -- the mode removes writes only. Two identically
 *                             seeded rooms rank to the SAME non-trivial order.
 *   E. RUNTIME NO-WRITE    -- the real exported dispatchCandidateReaches against
 *                             real rooms: .mindrian/ byte-identical, never
 *                             created in a Tier 0 room, an unmigrated db never
 *                             migrated and its fault disclosed in the result.
 *   F. ORDER PRESERVED AT THE TOOL -- the real registered handlers still return
 *                             the scored order and still omit degraded when null.
 *
 * Plain CJS node:assert/strict; PASS line + non-zero exit on failure.
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const ranker = require(path.join(REPO_ROOT, 'lib', 'workflow', 'reach-hedge-ranker.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const sensorsTool = require(path.join(REPO_ROOT, 'lib', 'mcp', 'tools', 'sensors.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));

const dispatchCandidateReaches = sensorsTool._internal.dispatchCandidateReaches;
const EUREKA_FIXTURE = path.join(REPO_ROOT, 'tests', 'fixtures', '213', 'last-eureka.json');

// Deterministic N / eta: prove the SHIPPED defaults, never an ambient env.
delete process.env.MINDRIAN_HEDGE_UPDATE_N;
delete process.env.MINDRIAN_HEDGE_ETA;

const N = ranker.HEDGE_UPDATE_N_DEFAULT;
const REACH_IDS = ranker.REACH_IDS;

// The two reaches the ordering legs use. context_block is canonical rank 0 (the
// registry expert fully endorses it); deep_research is canonical rank 4. Seeded
// weights favor the d4_blend expert and context_block carries a Phase 158 reject
// history, so the scored pick FLIPS the input order (a non-trivial assertion).
const REGISTRY_FIRST_REACH = 'context_block';
const SCORE_FIRST_REACH = 'deep_research';

// The co-fire turn (tests/test-222-reach-wired.cjs:49): this text alone already
// fires >= 2 candidate reaches, so the multi-candidate db-open path is exercised
// even in a room carrying no .mindrian/ side-channel file at all.
const COFIRE_TEXT = 'the data pipeline is the bottleneck';

let passed = 0;
async function check(name, fn) {
  await fn();
  passed += 1;
  console.log('  ok - ' + name);
}

// ---------- LOCAL fixture seams (throwaway temp rooms; never a real room) ----------

const tempDirs = [];
const openDbs = [];

function newRoomDir(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function newRoomDb(prefix) {
  const db = openRoomDb(newRoomDir(prefix));
  openDbs.push(db);
  return db;
}

function firedPair() {
  return [
    { reach_id: REGISTRY_FIRST_REACH, posture: 'suggest' },
    { reach_id: SCORE_FIRST_REACH, posture: 'suggest' },
  ];
}

function degradeEvents(db) {
  return navigation.findRecentChanges(db, 0, { eventType: 'reach_weight_state_unavailable' }) || [];
}

// snapshotMindrian(roomDir) -- the runtime no-write gate's measuring instrument.
// A per-file sha256 over the whole .mindrian/ tree, so a schema migration, a new
// memory_event node, a weight-state row, a journal file, or a freshly created
// database all show up as a difference. Deterministic ordering (sorted names) so
// two snapshots of an untouched directory compare deepStrictEqual.
function snapshotMindrian(roomDir) {
  const dir = path.join(roomDir, '.mindrian');
  if (!fs.existsSync(dir)) return { exists: false, entries: [] };
  const entries = fs.readdirSync(dir).sort().map(function (name) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (!st.isFile()) return { name: name, kind: 'dir' };
    return {
      name: name,
      kind: 'file',
      size: st.size,
      sha256: crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),
    };
  });
  return { exists: true, entries: entries };
}

// The two SQLite WAL sidecars. A read-only connection to a WAL database MUST be
// able to create <db>-shm (and an empty <db>-wal) or the open fails outright:
// WAL readers coordinate through that shared-memory index, and node:sqlite has no
// way to skip it short of ?immutable=1, which would be a lie for a live room a CLI
// session may be writing. They are transient coordination files, carry no user
// data, and never change room.db itself. The write path creates them too and just
// happens to delete them on a clean close, which a read-only connection is not
// permitted to do, so under this fix they linger instead. That is the ONE
// disclosed filesystem effect of the read-only door, and these legs pin it as a
// named exception rather than hiding it behind a loose assertion.
const SQLITE_SIDECAR_RE = /\.db-(wal|shm)$/;

function contentEntries(snap) {
  return {
    exists: snap.exists,
    entries: snap.entries.filter((e) => !SQLITE_SIDECAR_RE.test(e.name)),
  };
}

// assertNoContentChange -- room.db and every other real file must be byte-identical;
// the only names permitted to appear or change are the two WAL sidecars.
function assertNoContentChange(before, after, message) {
  assert.deepStrictEqual(contentEntries(after), contentEntries(before), message);
  const beforeNames = new Set(before.entries.map((e) => e.name));
  for (const entry of after.entries) {
    if (beforeNames.has(entry.name)) continue;
    assert.ok(SQLITE_SIDECAR_RE.test(entry.name),
      message + ' A new file appeared that is not a SQLite WAL sidecar: ' + entry.name);
  }
}

// Read a room's persisted state through a throwaway handle, so the inspection
// itself is never confused with the behavior under test.
function withProbeDb(roomDir, fn) {
  const db = openRoomDb(roomDir);
  try {
    return fn(db);
  } finally {
    try { closeRoomDb(db); } catch (_e) { /* best effort */ }
  }
}

// Seed a room.db so the SCORED pick (deep_research) beats the registry-first
// pick (context_block), mirroring tests/test-222-reach-wired.cjs::seedRoomDb.
// updatedAt 0 plus only 2 decision rows keeps the fold debounce inert, so the
// stored weights are identical for both arms of the ordering-parity leg.
function seedOrderingRoom(db) {
  navigation.upsertHedgeWeightState(db, { d4_blend: 0.9, registry_order: 0.1 }, { updatedAt: 0 });
  for (let i = 0; i < 2; i += 1) {
    navigation.logMemoryEvent(db, 'reach_presented', { reach_id: REGISTRY_FIRST_REACH });
  }
  for (let i = 0; i < 2; i += 1) {
    navigation.logMemoryEvent(db, 'f_selector_decision', {
      reach_id: REGISTRY_FIRST_REACH,
      decision: 'reject',
    });
  }
}

// Seed >= N qualifying reject rows so maybeUpdateHedgeWeights has a real fold to
// perform. Without this the no-fold assertions would pass vacuously.
function seedFoldableRoom(db) {
  for (let i = 0; i < N; i += 1) {
    navigation.logMemoryEvent(db, 'f_selector_decision', {
      reach_id: REACH_IDS[0],
      decision: 'reject',
    });
  }
}

// Normalize the dispatchCandidateReaches return across the shape change, so the
// PRECONDITION assertions report a useful failure instead of a TypeError while
// the fix is mid-landing.
function reachesOf(out) {
  if (out && !Array.isArray(out) && Array.isArray(out.reaches)) return out.reaches;
  return out;
}

async function main() {
  console.log('test-222-readonly-rank.cjs: opt-in read-only ranking + no-write MCP pull tools (quick 260728-7kc)');

  // =========================================================================
  // A. DEFAULT-OFF PARITY -- the CLI path is byte-unchanged.
  // =========================================================================

  await check('A1 DEFAULT-OFF: readOnly absent folds NOTHING now (quick 260728-8av moved the fold off this call)', () => {
    const db = newRoomDb('ro-parity-fold-');
    seedFoldableRoom(db);
    const out = ranker.rankFiredCandidates(firedPair(), { db: db });
    assert.ok(Array.isArray(out) && out.length === 2, 'the ranking must still return both candidates');
    assert.strictEqual(navigation.readHedgeWeightState(db), null,
      'RE-FUSED FOLD RISK: rankFiredCandidates persisted a Hedge weight state; the fold must live only in ' +
      'scripts/hedge-refit-pipeline.cjs after quick task 260728-8av, never fire-and-forget inside the ranking call.');
    // CONTROL: the SAME db, through the shipped fold directly, DOES persist a
    // weight state. This proves the fixture was genuinely foldable and the
    // ranking call declined to fold it, rather than the room having nothing to
    // fold in the first place.
    const controlOut = ranker.maybeUpdateHedgeWeights(db, {});
    assert.ok(controlOut && controlOut.updated === true,
      'VACUOUS-GREEN RISK: the control fold did not fold, so this arm proves nothing about the fixture; got ' +
      JSON.stringify(controlOut));
    const state = navigation.readHedgeWeightState(db);
    assert.ok(state, 'the control fold must persist a weight state on the same db');
    assert.strictEqual(state.updateCount, 1,
      'the control fold must advance updateCount to 1, got ' + (state && state.updateCount));
  });

  await check('A2 DEFAULT-OFF: readOnly absent still writes the Req 7 degrade memory_event', () => {
    const db = newRoomDb('ro-parity-degrade-');
    db.exec('DROP TABLE ranker_weights');
    ranker.rankFiredCandidates(firedPair(), { db: db });
    const events = degradeEvents(db);
    assert.strictEqual(events.length, 1,
      'DEFAULT-OFF REGRESSION: a degraded read must still emit exactly one event, got ' + events.length);
    assert.strictEqual(events[0].properties.fault_kind, 'read_fault', 'wrong fault_kind for a read fault');
  });

  await check('A3 DEFAULT-OFF: readOnly === false is treated exactly like absent (no accidental truthiness gate)', () => {
    const db = newRoomDb('ro-parity-false-');
    seedFoldableRoom(db);
    ranker.rankFiredCandidates(firedPair(), { db: db, readOnly: false });
    // readOnly:false must behave exactly like readOnly absent, which after
    // quick task 260728-8av means it too folds nothing: there is no fold left
    // inside rankFiredCandidates in any mode for this arm to gate.
    assert.strictEqual(navigation.readHedgeWeightState(db), null,
      'readOnly:false must fold exactly like readOnly absent (nothing), got a persisted weight state');
  });

  // =========================================================================
  // B. NO FOLD UNDER readOnly -- proven against a real db AND against a stub.
  // =========================================================================

  await check('B1 READ-ONLY (real db): a foldable room gains NO weight state, while the control fold does', () => {
    // Control arm first: the SAME fixture, folded directly through the shipped
    // fold (quick 260728-8av moved the trigger out of rankFiredCandidates, so
    // the control can no longer go through the ranking call and still prove
    // the fixture is foldable; it must call the fold itself). This is what
    // makes the read-only arm load-bearing rather than vacuous.
    const controlDb = newRoomDb('ro-nofold-control-');
    seedFoldableRoom(controlDb);
    ranker.maybeUpdateHedgeWeights(controlDb, {});
    assert.ok(navigation.readHedgeWeightState(controlDb),
      'VACUOUS-GREEN RISK: the control arm did not fold, so the read-only arm proves nothing');

    const db = newRoomDb('ro-nofold-');
    seedFoldableRoom(db);
    const out = ranker.rankFiredCandidates(firedPair(), { db: db, readOnly: true, degradeSink: [] });
    assert.ok(Array.isArray(out) && out.length === 2, 'read-only ranking must still return both candidates');
    assert.strictEqual(navigation.readHedgeWeightState(db), null,
      'WRITE LEAK: readOnly:true persisted a Hedge weight state');
    assert.strictEqual(degradeEvents(db).length, 0, 'WRITE LEAK: readOnly:true wrote a degrade memory_event');
  });

  await check('B2 READ-ONLY (stubbed navigation): the fold query and the upsert are never even issued', () => {
    const realRead = navigation.readHedgeWeightState;
    const realFind = navigation.findRecentChanges;
    const realUpsert = navigation.upsertHedgeWeightState;
    const realLog = navigation.logMemoryEvent;
    const calls = [];
    try {
      navigation.readHedgeWeightState = function () { calls.push({ fn: 'readHedgeWeightState' }); return null; };
      navigation.findRecentChanges = function (_db, _since, opts) {
        calls.push({ fn: 'findRecentChanges', opts: opts || {} });
        return [];
      };
      navigation.upsertHedgeWeightState = function () { calls.push({ fn: 'upsertHedgeWeightState' }); };
      navigation.logMemoryEvent = function () { calls.push({ fn: 'logMemoryEvent' }); return { ok: true }; };

      const fakeDb = { __fixture: 'not-a-real-handle' };
      ranker.rankFiredCandidates(firedPair(), { db: fakeDb, readOnly: true, degradeSink: [] });

      assert.strictEqual(calls.filter((c) => c.fn === 'upsertHedgeWeightState').length, 0,
        'WRITE LEAK: upsertHedgeWeightState was invoked under readOnly:true');
      assert.strictEqual(calls.filter((c) => c.fn === 'logMemoryEvent').length, 0,
        'WRITE LEAK: logMemoryEvent was invoked under readOnly:true');
      // The fold's own query carries limit 500 (reach-reject-reader's reads do not),
      // so this is the fold-specific signature, not a blanket read ban.
      assert.strictEqual(calls.filter((c) => c.fn === 'findRecentChanges' && c.opts.limit === 500).length, 0,
        'FOLD LEAK: maybeUpdateHedgeWeights issued its 500-row training query under readOnly:true');

      // Control: the shipped fold called directly (quick 260728-8av moved the
      // trigger out of rankFiredCandidates, so the control can no longer route
      // through the ranking call) DOES issue the 500-row query under the same
      // stubs, so the assertion above is measuring something real.
      calls.length = 0;
      ranker.maybeUpdateHedgeWeights(fakeDb, {});
      assert.ok(calls.filter((c) => c.fn === 'findRecentChanges' && c.opts.limit === 500).length >= 1,
        'VACUOUS-GREEN RISK: the control arm never issued the fold query either');
    } finally {
      navigation.readHedgeWeightState = realRead;
      navigation.findRecentChanges = realFind;
      navigation.upsertHedgeWeightState = realUpsert;
      navigation.logMemoryEvent = realLog;
    }
  });

  // =========================================================================
  // C. DEGRADE TO SINK -- the Req 7 signal is preserved, not deleted.
  // =========================================================================

  await check('C1 SINK: a read_fault under readOnly lands on degradeSink and NOT in room.db', () => {
    const db = newRoomDb('ro-sink-readfault-');
    db.exec('DROP TABLE ranker_weights');
    const sink = [];
    const out = ranker.rankFiredCandidates(firedPair(), { db: db, readOnly: true, degradeSink: sink });
    assert.ok(Array.isArray(out) && out.length === 2, 'a degraded read-only ranking must still return both candidates');
    assert.deepStrictEqual(sink, ['read_fault'],
      'the read_fault enum token must land on the sink; got ' + JSON.stringify(sink));
    assert.strictEqual(degradeEvents(db).length, 0,
      'WRITE LEAK: the degrade was written into room.db under readOnly:true');
  });

  await check('C2 SINK: a corrupt_scalar under readOnly lands on degradeSink and NOT in room.db', () => {
    const db = newRoomDb('ro-sink-corrupt-');
    navigation.upsertHedgeWeightState(db, { d4_blend: 0.7, registry_order: 0.3 }, { updateCount: 1 });
    db.prepare('UPDATE ranker_weights SET weight = -1').run();
    const sink = [];
    ranker.rankFiredCandidates(firedPair(), { db: db, readOnly: true, degradeSink: sink });
    assert.deepStrictEqual(sink, ['corrupt_scalar'],
      'the corrupt_scalar enum token must land on the sink; got ' + JSON.stringify(sink));
    assert.strictEqual(degradeEvents(db).length, 0,
      'WRITE LEAK: the degrade was written into room.db under readOnly:true');
  });

  await check('C3 SINK: an ABSENT degradeSink under readOnly is safe (no throw, no write, token dropped)', () => {
    const db = newRoomDb('ro-sink-absent-');
    db.exec('DROP TABLE ranker_weights');
    const out = ranker.rankFiredCandidates(firedPair(), { db: db, readOnly: true });
    assert.ok(Array.isArray(out) && out.length === 2, 'an absent sink must not break the ranking');
    assert.strictEqual(degradeEvents(db).length, 0,
      'WRITE LEAK: an absent sink fell back to writing the memory_event');
  });

  await check('C4 SINK: the sink carries closed enum tokens only (Part 8: no prose, no reason field)', () => {
    const db = newRoomDb('ro-sink-enum-');
    db.exec('DROP TABLE ranker_weights');
    const sink = [];
    ranker.rankFiredCandidates(firedPair(), { db: db, readOnly: true, degradeSink: sink });
    assert.ok(sink.length >= 1, 'the arm must have collected a token to inspect');
    for (const token of sink) {
      assert.strictEqual(typeof token, 'string', 'every sink entry must be a bare string enum token');
      assert.ok(['read_fault', 'corrupt_scalar'].indexOf(token) !== -1,
        'the sink must carry a CLOSED enum token, never prose; got ' + JSON.stringify(token));
    }
  });

  // =========================================================================
  // D. ORDERING PARITY -- the mode removes writes only, never changes the pick.
  // =========================================================================

  await check('D1 PARITY: two identically seeded rooms rank to the SAME non-trivial order in both modes', () => {
    const writeDb = newRoomDb('ro-order-write-');
    seedOrderingRoom(writeDb);
    const readDb = newRoomDb('ro-order-read-');
    seedOrderingRoom(readDb);

    const writeOrder = ranker
      .rankFiredCandidates(firedPair(), { db: writeDb })
      .map((r) => r.reach_id);
    const readOrder = ranker
      .rankFiredCandidates(firedPair(), { db: readDb, readOnly: true, degradeSink: [] })
      .map((r) => r.reach_id);

    assert.deepStrictEqual(readOrder, writeOrder,
      'READ-ONLY MODE CHANGED THE PICK: write-mode ' + JSON.stringify(writeOrder) +
      ' vs read-mode ' + JSON.stringify(readOrder));
    // Non-trivial: the scored order must actually differ from the input order,
    // otherwise the parity assertion would hold for a broken ranker too.
    assert.deepStrictEqual(readOrder, [SCORE_FIRST_REACH, REGISTRY_FIRST_REACH],
      'VACUOUS-GREEN RISK: the scored order did not flip the input order; got ' + JSON.stringify(readOrder));
  });

  await check('D2 PARITY: the read is NOT dropped -- read-only still applies the stored Hedge weights', () => {
    // The seam must keep the READ. Dropping the handle would also stop the write,
    // but it would silently flatten the ranking: on the MCP path no cortex nodes
    // are threaded, so every candidate sits on the flat 0.5 D4 floor and the Hedge
    // outcome layer is the ONLY differentiator. This leg pins the read against a
    // db-free control.
    const seededDb = newRoomDb('ro-read-kept-');
    seedOrderingRoom(seededDb);
    const seededOrder = ranker
      .rankFiredCandidates(firedPair(), { db: seededDb, readOnly: true, degradeSink: [] })
      .map((r) => r.reach_id);
    const noDbOrder = ranker
      .rankFiredCandidates(firedPair(), { readOnly: true, degradeSink: [] })
      .map((r) => r.reach_id);
    assert.notDeepStrictEqual(seededOrder, noDbOrder,
      'READ DROPPED: the seeded weight state made no difference under readOnly, so the read was discarded');
    assert.strictEqual(seededOrder[0], SCORE_FIRST_REACH,
      'the seeded read-only ranking must lead with the scored winner; got ' + seededOrder[0]);
  });

  // =========================================================================
  // E. RUNTIME NO-WRITE -- the REAL exported handler path against REAL rooms.
  //    This is the gate. Not a grep: contradiction_check and whitespace_scan
  //    legitimately still call openRoomDbForCaller in the same file, so a
  //    blanket source sweep would be a FALSE gate. Byte-identity is the truth.
  // =========================================================================

  await check('E1 NO-WRITE: repeated dispatchCandidateReaches leaves .mindrian/ byte-identical', () => {
    const dir = newRoomDir('ro-nowrite-migrated-');
    withProbeDb(dir, seedFoldableRoom); // >= N rows: the pre-fix path WOULD have folded and written

    const before = snapshotMindrian(dir);
    assert.ok(before.exists && before.entries.length >= 1,
      'PRECONDITION: the fixture room must already carry a migrated .mindrian/');
    const roomDbBefore = before.entries.find((e) => e.name === 'room.db');
    assert.ok(roomDbBefore, 'PRECONDITION: the fixture room must carry a room.db to compare');

    for (let i = 0; i < 3; i += 1) {
      const reaches = reachesOf(dispatchCandidateReaches('s7kc', dir, { userText: COFIRE_TEXT }));
      assert.ok(Array.isArray(reaches) && reaches.length >= 2,
        'PRECONDITION: the pull must co-fire >= 2 candidates so the db-open path is exercised; got ' +
        JSON.stringify(Array.isArray(reaches) ? reaches.map((r) => r.reach_id) : reaches));
    }

    assertNoContentChange(before, snapshotMindrian(dir),
      'WRITE LEAK: dispatchCandidateReaches mutated .mindrian/. A declared-read tool wrote to the room.');
    const state = withProbeDb(dir, (db) => navigation.readHedgeWeightState(db));
    assert.strictEqual(state, null,
      'WRITE LEAK: a Hedge weight state was persisted by a declared-read pull; got ' + JSON.stringify(state));
  });

  await check('E1s DISCLOSURE: the ONE filesystem effect that remains is the SQLite WAL sidecar pair', () => {
    // Pinned, not hidden. If a future change makes the read-only door leave the
    // directory pristine, this leg goes red and someone updates the disclosure
    // deliberately instead of a loose assertion quietly absorbing a real write.
    const dir = newRoomDir('ro-nowrite-sidecar-');
    withProbeDb(dir, seedOrderingRoom);
    const before = snapshotMindrian(dir);
    dispatchCandidateReaches('s7kc', dir, { userText: COFIRE_TEXT });
    const after = snapshotMindrian(dir);

    const beforeNames = before.entries.map((e) => e.name);
    const newNames = after.entries.map((e) => e.name).filter((n) => beforeNames.indexOf(n) === -1);
    for (const name of newNames) {
      assert.ok(SQLITE_SIDECAR_RE.test(name),
        'UNDISCLOSED FILESYSTEM EFFECT: the read-only pull created ' + name);
    }
    const roomDbBefore = before.entries.find((e) => e.name === 'room.db');
    const roomDbAfter = after.entries.find((e) => e.name === 'room.db');
    assert.strictEqual(roomDbAfter.sha256, roomDbBefore.sha256,
      'WRITE LEAK: room.db itself changed, which no sidecar explanation can cover');
  });

  await check('E1c CONTROL: the SAME fixture DOES change on disk through a real write path (the gate is real)', () => {
    // UPDATED by quick task 260728-8av: rankFiredCandidates no longer writes
    // in ANY mode (the fold moved to scripts/hedge-refit-pipeline.cjs), so it
    // can no longer serve as this control's "write path". The remaining real
    // write path is the shipped fold itself, called directly. This still
    // proves what the control exists to prove: SOME path through this room
    // architecture produces a real on-disk change, so E1/E2/E3/E4 finding no
    // change via dispatchCandidateReaches is a meaningful result, not a
    // fixture that could never change either way.
    const dir = newRoomDir('ro-nowrite-control-');
    withProbeDb(dir, seedFoldableRoom);

    const before = snapshotMindrian(dir);
    const writeDb = navigation.openRoomDbForCaller(dir);
    try {
      ranker.maybeUpdateHedgeWeights(writeDb, {});
    } finally {
      if (writeDb) navigation.closeRoomDbForCaller(writeDb);
    }
    assert.notDeepStrictEqual(snapshotMindrian(dir), before,
      'VACUOUS-GREEN RISK: even the WRITE path left the fixture unchanged, so E1 proves nothing');
  });

  await check('E2 NO-WRITE: a room with NO .mindrian/ never gains one (the largest of the three writes)', () => {
    const dir = newRoomDir('ro-nowrite-bare-');
    assert.strictEqual(fs.existsSync(path.join(dir, '.mindrian')), false,
      'PRECONDITION: the bare fixture must start with no .mindrian/');

    const reaches = reachesOf(dispatchCandidateReaches('s7kc', dir, { userText: COFIRE_TEXT }));
    assert.ok(Array.isArray(reaches) && reaches.length >= 2,
      'the bare-room pull must still return its fired candidate array; got ' + JSON.stringify(reaches));
    assert.strictEqual(fs.existsSync(path.join(dir, '.mindrian')), false,
      'SCHEMA-MIGRATION LEAK: a declared-read pull CREATED the room database in a Tier 0 room');
  });

  await check('E3 NO-WRITE: an unmigrated room.db is not migrated, and the fault is DISCLOSED in the result', () => {
    const dir = newRoomDir('ro-nowrite-unmigrated-');
    withProbeDb(dir, (db) => { db.exec('DROP TABLE ranker_weights'); }); // the pre-ranker_weights shape

    const out = dispatchCandidateReaches('s7kc', dir, { userText: COFIRE_TEXT });
    const reaches = reachesOf(out);
    assert.ok(Array.isArray(reaches) && reaches.length >= 2,
      'an unmigrated room must still return the full candidate set; got ' + JSON.stringify(reaches));
    assert.strictEqual(out && out.degraded, 'read_fault',
      'the degrade must be DISCLOSED in the tool result; got ' + JSON.stringify(out && out.degraded));

    // The table must still be absent AFTER the pull. Read it with a raw read-only
    // handle: re-opening through openRoomDb would itself re-create the table and
    // destroy the evidence.
    const roDb = navigation.openRoomDbReadOnlyForCaller(dir);
    assert.ok(roDb, 'PROBE: the read-only door must return a handle for an existing room.db');
    try {
      const rows = roDb.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='ranker_weights'"
      ).all();
      assert.strictEqual(rows.length, 0,
        'SCHEMA-MIGRATION LEAK: the pull re-created the ranker_weights table on an unmigrated room.db');
      const events = navigation.findRecentChanges(roDb, 0, { eventType: 'reach_weight_state_unavailable' }) || [];
      assert.strictEqual(events.length, 0,
        'WRITE LEAK: the degrade was written into room.db instead of disclosed in the result');
    } finally {
      navigation.closeRoomDbForCaller(roDb);
    }
  });

  await check('E4 NO-WRITE: a healthy pull reports degraded null (so the tool payload stays unchanged)', () => {
    const dir = newRoomDir('ro-nowrite-healthy-');
    withProbeDb(dir, seedOrderingRoom);
    const out = dispatchCandidateReaches('s7kc', dir, { userText: COFIRE_TEXT });
    assert.strictEqual(out && out.degraded, null,
      'a healthy read must report degraded null; got ' + JSON.stringify(out && out.degraded));
  });

  // =========================================================================
  // F. ORDER PRESERVED AT THE TOOL -- the fix removes writes, not the ranking.
  // =========================================================================

  await check('F1 ORDER: the REAL suggest_next / reach_candidates handlers still return the SCORED order', async () => {
    const dir = newRoomDir('ro-order-handlers-');
    fs.mkdirSync(path.join(dir, '.mindrian'), { recursive: true });
    fs.copyFileSync(EUREKA_FIXTURE, path.join(dir, '.mindrian', 'last-eureka.json'));
    withProbeDb(dir, seedOrderingRoom);

    const priorActive = process.env.CLAUDE_ACTIVE_ROOM;
    process.env.CLAUDE_ACTIVE_ROOM = dir;
    try {
      const registered = [];
      const fakeServer = {
        tool(name, _desc, schemaOrHandler, maybeHandler) {
          const handler = typeof maybeHandler === 'function' ? maybeHandler : schemaOrHandler;
          registered.push({ name: name, handler: handler });
        },
        server: { getClientCapabilities() { return {}; } },
      };
      sensorsTool.register(fakeServer, { fallbackRoomDir: dir });
      const suggestNext = registered.find((r) => r.name === 'suggest_next');
      const reachCandidates = registered.find((r) => r.name === 'reach_candidates');
      assert.ok(suggestNext && reachCandidates, 'both pull tools must register through the REAL register()');

      const before = snapshotMindrian(dir);

      const snPayload = JSON.parse(
        (await suggestNext.handler({ user_text: COFIRE_TEXT }, { sessionId: 's7kc' })).content[0].text);
      assert.ok(snPayload.suggestion, 'suggest_next must return a suggestion');
      assert.strictEqual(snPayload.suggestion.reach_id, SCORE_FIRST_REACH,
        'RANKING REGRESSION: suggest_next must still return the SCORED top; got ' +
        snPayload.suggestion.reach_id);
      assert.strictEqual(snPayload.degraded, undefined,
        'a healthy pull must OMIT the degraded field, keeping the normal payload unchanged');

      const rcPayload = JSON.parse(
        (await reachCandidates.handler({ user_text: COFIRE_TEXT }, { sessionId: 's7kc' })).content[0].text);
      const order = rcPayload.candidates.map((r) => r.reach_id);
      assert.strictEqual(order[0], SCORE_FIRST_REACH,
        'RANKING REGRESSION: reach_candidates must lead with the scored winner; got ' + JSON.stringify(order));
      assert.notStrictEqual(order[0], REGISTRY_FIRST_REACH,
        'REGISTRY-ORDER LEAK: the handler returned SENSOR_REGISTRY order');
      assert.strictEqual(rcPayload.count, order.length, 'count must match the returned candidate array');
      assert.strictEqual(rcPayload.degraded, undefined,
        'a healthy pull must OMIT the degraded field on reach_candidates too');

      assertNoContentChange(before, snapshotMindrian(dir),
        'WRITE LEAK: the REAL registered handlers mutated .mindrian/');
    } finally {
      if (priorActive === undefined) { delete process.env.CLAUDE_ACTIVE_ROOM; }
      else { process.env.CLAUDE_ACTIVE_ROOM = priorActive; }
    }
  });

  console.log('');
  console.log('PASS test-222-readonly-rank.cjs (' + passed + ' checks)');
}

main()
  .catch((err) => {
    console.error('FAIL test-222-readonly-rank.cjs');
    console.error(err && err.stack ? err.stack : err);
    process.exitCode = 1;
  })
  .finally(() => {
    for (const db of openDbs) {
      try { closeRoomDb(db); } catch (_e) { /* best effort */ }
    }
    for (const dir of tempDirs) {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
    }
  });
