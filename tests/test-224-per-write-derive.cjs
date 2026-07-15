'use strict';
/*
 * Phase 224-02 Task 2 -- Req 1 per-write derivation via the shared cascade.
 * =======================================================================
 * Behaviors:
 *   1. a per-write derive over a RELATED pair lands >= 1 cascade-family edge
 *      with review_status 'proposed'; the SAME flow over the UNRELATED pair
 *      lands zero cascade-family candidates (the no-false-positive floor).
 *   2. runCascade over a newly written markdown file puts a {roomDir, filePath}
 *      entry into graph-derive-queue.json (the FOREGROUND effect) and the perFile
 *      entry carries a deriveEnqueue field with status ok; the test then drains
 *      synchronously in-process and asserts edges (no detached-process timing).
 *   3. source assertions: _runCascadeSteps contains enqueueDerive + an unref'd
 *      spawn, and contains NO scoreMeasured and NO await of the spawned drain
 *      (D-02 refined: never inline, never serialized on the write-lock).
 *
 * The detached drain spawn is disabled during this test via
 * MOS_NO_DETACHED_DERIVE=1 so the in-process drain is the ONLY writer (race-free).
 * Reads in tests are exempt from the navigation chokepoint rule. No em-dashes.
 */

// Disable the real detached drain spawn BEFORE requiring the cascade so the test
// owns the drain deterministically (no reliance on detached-process timing).
process.env.MOS_NO_DETACHED_DERIVE = '1';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const REPO_ROOT = path.resolve(__dirname, '..');
const sweep = require(path.join(REPO_ROOT, 'scripts', 'gsd-graph-derive-sweep.cjs'));
const drain = require(path.join(REPO_ROOT, 'scripts', 'gsd-graph-derive-drain.cjs'));
const classifier = require(path.join(REPO_ROOT, 'lib', 'core', 'graph-derive-classifier.cjs'));
const cascade = require(path.join(REPO_ROOT, 'lib', 'core', 'intelligence-cascade.cjs'));
const { buildFixtureRoom224 } = require(path.join(REPO_ROOT, 'tests', 'helpers', 'fixture-room-224.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));

let pass = 0;
function check(label, cond) {
  assert.ok(cond, label);
  pass += 1;
  console.log('  ok -', label);
}

// Deterministic semantic encoder: the two RELATED artifacts share a "venture"
// direction (cosine 1 -> CONVERGES); every unrelated domain gets a DISTINCT
// orthogonal direction keyed by a stable hash (never the venture slot), so no
// cross-domain pair collides into a false positive.
function encodeFn(texts) {
  return texts.map((t) => {
    const s = String(t);
    if (/meal-kit|home cooking delivery|recurring parcel/i.test(s)) {
      return [1, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    }
    const h = crypto.createHash('md5').update(s).digest();
    const slot = 1 + (h[0] % 9); // slots 1..9, never 0 (the venture direction)
    const v = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    v[slot] = 1;
    return v;
  });
}

// The injected score-based producer wrapper (bakes the deterministic encoder in).
const injectedDeriveFn = (step) => classifier.scoreBasedDeriveFn(step, { scoreOpts: { encodeFn } });

function cascadeEdgeRows(roomDir) {
  const db = openRoomDb(roomDir);
  try {
    return db.prepare(
      "SELECT source, target, type, review_status FROM edges WHERE type IN " +
      "('CONVERGES','INFORMS','CONTRADICTS','INVALIDATES','ENABLES','REFINES','ROOT_CAUSES')"
    ).all();
  } finally {
    closeRoomDb(db);
  }
}

async function main() {
  console.log('test-224-per-write-derive (Req 1 per-write trigger)');

  // ---- Behavior 1: related pair lands a proposed edge; unrelated lands zero. ----
  {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'derive-224-pw1-'));
    const fixture = await buildFixtureRoom224(tmp, { artifactCount: 5 });
    const roomDir = fixture.roomDir;

    // Drive the per-write derivation over the RELATED file (Req 1 wiring proof).
    sweep.enqueueDerive(roomDir, { filePath: fixture.relatedPair.a });
    await drain.drainDerive(roomDir, { deriveFn: injectedDeriveFn, probeOpts: { encodeFn } });

    const edges = cascadeEdgeRows(roomDir);
    check('the related-pair per-write derive lands >= 1 cascade-family edge', edges.length >= 1);
    check("every derived edge carries review_status 'proposed' (Req 4 wiring)",
      edges.every((e) => e.review_status === 'proposed'));

    // The no-false-positive floor: the SAME producer over the unrelated pair yields
    // zero candidates.
    const pairs = classifier.buildNewArtifactPairs(roomDir, fixture.relatedPair.a);
    const relB = path.basename(fixture.relatedPair.b);
    const unrel0 = path.basename(fixture.unrelatedPair.b);
    const relPair = pairs.find((p) => path.basename(p.b.path) === relB);
    const unrelPair = pairs.find((p) => path.basename(p.b.path) === unrel0);
    assert.ok(relPair && unrelPair, 'the test must locate both the related and unrelated pair');

    const relCandidates = await injectedDeriveFn({ roomDir, artifactPair: relPair });
    const unrelCandidates = await injectedDeriveFn({ roomDir, artifactPair: unrelPair });
    check('the related pair produces a cascade-family candidate',
      relCandidates.length >= 1 && classifier._test.REASON_CONVERGES !== undefined);
    check('the unrelated pair produces ZERO candidates (no-false-positive floor)',
      unrelCandidates.length === 0);
  }

  // ---- Behavior 2: runCascade enqueues + carries a deriveEnqueue envelope. ----
  {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'derive-224-pw2-'));
    const fixture = await buildFixtureRoom224(tmp, { artifactCount: 5 });
    const roomDir = fixture.roomDir;
    const writtenFile = fixture.relatedPair.a;

    const result = await cascade.runCascade(roomDir, { trigger: 'test', filePath: writtenFile });

    check('runCascade returns a deriveEnqueue envelope with status ok',
      result && result.deriveEnqueue && result.deriveEnqueue.status === 'ok');

    const q = sweep.readQueue(roomDir);
    const hasEntry = q.entries.some((e) =>
      e && path.resolve(e.roomDir) === path.resolve(roomDir) &&
      typeof e.filePath === 'string' && path.basename(e.filePath) === path.basename(writtenFile));
    check('runCascade enqueued a {roomDir, filePath} entry (the foreground effect)', hasEntry);

    // Drain synchronously in-process (race-free) and assert edges.
    await drain.drainDerive(roomDir, { deriveFn: injectedDeriveFn, probeOpts: { encodeFn } });
    const edges = cascadeEdgeRows(roomDir);
    check('the in-process drain of the enqueued entry lands >= 1 proposed edge',
      edges.length >= 1 && edges.every((e) => e.review_status === 'proposed'));
  }

  // ---- Behavior 3: source assertions on _runCascadeSteps. ----
  {
    const raw = fs.readFileSync(path.join(REPO_ROOT, 'lib', 'core', 'intelligence-cascade.cjs'), 'utf8');
    // Comment-strip: drop lines that START with optional whitespace then // or * or /*.
    const code = raw.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
    check('_runCascadeSteps calls enqueueDerive', code.includes('enqueueDerive'));
    check('_runCascadeSteps spawns the drain detached and unref()s it', code.includes('unref'));
    check('the cascade NEVER calls scoreMeasured inline (D-02: never on the write-lock)',
      !code.includes('scoreMeasured'));
    check('the cascade NEVER awaits the spawned drain (D-02: never serialized)',
      !/await[^\n]*\b(drain|spawn)\b/i.test(code));
  }

  console.log(`\nPASS (${pass}/${pass})`);
}

main().catch((e) => {
  console.error('FAIL', e && e.stack ? e.stack : e);
  process.exit(1);
});
