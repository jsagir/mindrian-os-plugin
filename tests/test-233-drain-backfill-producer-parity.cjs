'use strict';
/*
 * Phase 233-02 Task 2 -- RCA item 4b/4e: drain / backfill DEFAULT-PRODUCER PARITY.
 * ==============================================================================
 * 233-CONTEXT.md's 4b decision says: "Confirm the in-session /mos:graph --derive
 * backfill path wires the SAME local score-based producer 224-02 proved out for
 * the headless drain -- do not let the two paths diverge."
 *
 * That claim has lived only in prose. This suite PINS it, so a future edit that
 * points one path at a different producer fails a gate instead of silently
 * deriving different edges from the same room depending on which trigger fired.
 *
 * TWO INDEPENDENT PROOFS, because either alone is weak:
 *
 *   A. SOURCE (comment-stripped, the run-all-158.sh grep-gate-hygiene idiom):
 *      both modules carry a LIVE `classifier.scoreBasedDeriveFn` default-path
 *      assignment, and NEITHER carries a live reference to the gated hosted
 *      producer (graph-candidate-producer). Comment stripping matters in both
 *      directions here: the drain's header PROSE mentions graph-candidate-producer
 *      ("NO require of graph-candidate-producer here"), which must not trip the
 *      gate, and a comment must never be able to satisfy it either.
 *
 *   B. LIVE (the real modules, two byte-identical fixture rooms):
 *      the SHARED cached classifier exports object has scoreBasedDeriveFn swapped
 *      for a deterministic recording stand-in. Both modules then run their DEFAULT
 *      (non-injected) path. If either resolved to any other function, its
 *      invocation list would be empty. Both lists being non-empty AND carrying the
 *      identical pair ids is live proof they share one producer -- not textual
 *      similarity. Finally the two rooms' cascade edges are read back off disk and
 *      compared as sets: functionally identical output for identical input.
 *
 * Canon Part 8: LOCAL only. Zero network. The encoder probe is satisfied by an
 * injected encodeFn seam, never by loading a model or dialing a wire.
 *
 * No em-dashes. CJS only, zero new deps.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const DRAIN_PATH = path.join(REPO_ROOT, 'scripts', 'gsd-graph-derive-drain.cjs');
const BACKFILL_PATH = path.join(REPO_ROOT, 'lib', 'core', 'graph-backfill.cjs');
const CLASSIFIER_PATH = path.join(REPO_ROOT, 'lib', 'core', 'graph-derive-classifier.cjs');

const drain = require(DRAIN_PATH);
const backfill = require(BACKFILL_PATH);
const classifier = require(CLASSIFIER_PATH);
const sweep = require(path.join(REPO_ROOT, 'scripts', 'gsd-graph-derive-sweep.cjs'));
const spineEvents = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'spine-events.cjs'));
const { CASCADE_SUBSET } = require(path.join(REPO_ROOT, 'lib', 'core', 'graph-derivation.cjs'));
const { buildFixtureRoom224 } = require(path.join(REPO_ROOT, 'tests', 'helpers', 'fixture-room-224.cjs'));

let pass = 0;
function check(label, cond) {
  assert.ok(cond, label);
  pass += 1;
  console.log('  ok -', label);
}

// The grep-gate-hygiene idiom (T-158-04-04, tests/run-all-158.sh strip_comments):
// drop whole-line // comments and block-comment body lines, so header PROSE can
// neither trip a gate nor satisfy one.
function stripComments(filePath) {
  return fs.readFileSync(filePath, 'utf8')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join('\n');
}

// A tiny available-encoder probe stub (mirrors tests/test-224-cost-bound.cjs):
// two distinct vectors -> a real cosine, so the D-04 probe reports available
// WITHOUT loading the heavy encoder and without any network.
function probeEncodeFn() {
  return [[1, 0, 0], [0, 1, 0]];
}

// Read the cascade-family edges back off a room's real room.db through the
// read-only navigation door (Phase 232.1). Returns a sorted tuple list so two
// rooms can be compared as sets.
//
// COLUMN NAMES: the edges table is (source, target, type, properties,
// review_status) -- NOT source_id/target_id/edge_type. `edge_type`/`source_id`
// are the FINDING-shape field names inside candidateToFinding, which the writer
// maps down to the column names on the way in. Verified against a real fixture
// room.db with PRAGMA table_info(edges), not assumed from the finding shape.
function readCascadeEdges(roomDir) {
  const db = spineEvents.openRoomDbReadOnlyForCaller(roomDir);
  if (!db) return [];
  try {
    const types = Array.from(CASCADE_SUBSET);
    const rows = db.prepare(
      'SELECT source, target, type, review_status FROM edges WHERE type IN ('
      + types.map(() => '?').join(',') + ')'
    ).all(...types);
    return rows
      .map((r) => r.type + '|' + r.source + '|' + r.target + '|' + (r.review_status || ''))
      .sort();
  } catch (_e) {
    return [];
  } finally {
    try { db.close(); } catch (_e) { /* tolerate */ }
  }
}

const REAL_SCORE_BASED = classifier.scoreBasedDeriveFn;

// FIXTURE DETERMINISM (found the hard way, by a reproducible 2-in-6 flake).
// ------------------------------------------------------------------------
// buildAllPairs orders every pair (a = OLDER, b = NEWER) by a strict mtimeMs
// comparison, because the INFORMS direction rule composes off "the older artifact
// informs the newer one". That is CORRECT product behavior. But it means two
// separately-built fixture rooms are only truly identical if their files also
// carry the same mtime RELATIONSHIPS, and they do not: filesystem timestamp
// granularity plus write timing means room A can land three distinct mtimes while
// room B lands three identical ones, which flips the a/b orientation of a pair and
// makes B3/B6 fail for a reason that has nothing to do with producer parity.
//
// So the fixtures are stamped: every artifact gets a fixed, strictly increasing
// mtime keyed to its ROOM-RELATIVE id, identically in both rooms. This does not
// weaken the test. It removes an uncontrolled variable so the assertion measures
// what it claims to measure (which producer ran) instead of filesystem timing.
const BASE_MTIME_SEC = 1700000000; // a fixed epoch second; the absolute value is irrelevant

function stampArtifactMtimes(roomDir) {
  const arts = classifier._test.enumerateArtifacts(roomDir)
    .slice()
    .sort((x, y) => (x.id < y.id ? -1 : (x.id > y.id ? 1 : 0)));
  arts.forEach((art, i) => {
    const t = BASE_MTIME_SEC + i; // strictly increasing, id-ordered, room-independent
    fs.utimesSync(art.path, t, t);
  });
  return arts.map((a) => a.id);
}

async function main() {
  console.log('test-233-drain-backfill-producer-parity (RCA 4b/4e: one producer, two triggers)');

  // =========================================================================
  // PROOF A -- source level, comment-stripped.
  // =========================================================================
  const drainSrc = stripComments(DRAIN_PATH);
  const backfillSrc = stripComments(BACKFILL_PATH);

  check('A1. the headless drain carries a LIVE classifier.scoreBasedDeriveFn default assignment',
    drainSrc.indexOf('classifier.scoreBasedDeriveFn') !== -1);
  check('A2. the in-session backfill carries a LIVE classifier.scoreBasedDeriveFn default assignment',
    backfillSrc.indexOf('classifier.scoreBasedDeriveFn') !== -1);
  check('A3. neither module carries a LIVE reference to the gated hosted producer '
    + '(graph-candidate-producer); the drain header PROSE that names it is stripped first',
    drainSrc.indexOf('graph-candidate-producer') === -1
    && backfillSrc.indexOf('graph-candidate-producer') === -1);
  check('A4. the stripper is honest: the UNSTRIPPED drain source DOES mention '
    + 'graph-candidate-producer in prose, so A3 is a real gate and not a vacuous one',
    fs.readFileSync(DRAIN_PATH, 'utf8').indexOf('graph-candidate-producer') !== -1);

  // 4e: the stale doctrine phrase must be gone from the header.
  const drainRaw = fs.readFileSync(DRAIN_PATH, 'utf8');
  check('A5. [4e] the stale "and CLEARS the drained entry" doctrine phrase is gone',
    drainRaw.indexOf('and CLEARS the drained entry') === -1);
  check('A6. [4e] the header states the real reconcile behavior and the division of labor',
    drainRaw.indexOf('MAX_DERIVE_ATTEMPTS') !== -1
    && drainRaw.indexOf('DIVISION OF LABOR') !== -1
    && drainRaw.indexOf('graph-backfill.cjs') !== -1);
  check('A7. [4e] the already-correct "Failure discipline" paragraph is intact (untouched by 233-02)',
    drainRaw.indexOf('Failure discipline: exit-0, never-block, but NEVER SILENT ROT') !== -1
    && drainRaw.indexOf('Only a SUCCESSFUL derive clears the entry.') !== -1);

  // =========================================================================
  // PROOF B -- live. Swap the SHARED cached classifier export for a recorder.
  // Both modules read `classifier.scoreBasedDeriveFn` as a PROPERTY at call time
  // off this one exports object, so an empty invocation list would mean that
  // module's default resolved somewhere else.
  // =========================================================================
  const invocations = { drain: [], backfill: [] };
  let phase = null;

  function recordingStandIn(step, injectOpts) {
    const pair = (step && step.artifactPair) || {};
    const a = (pair.a && pair.a.id) || '';
    const b = (pair.b && pair.b.id) || '';
    if (phase) {
      invocations[phase].push({
        a: a,
        b: b,
        // The D-04 TOCTOU contract: on the DEFAULT path BOTH modules must hand the
        // producer the same seam the probe used, plus an onOutcome counter.
        gotProducerOpts: !!(injectOpts && typeof injectOpts === 'object'),
        gotScoreOptsSeam: !!(injectOpts && Object.prototype.hasOwnProperty.call(injectOpts, 'scoreOpts')),
        gotOnOutcome: !!(injectOpts && typeof injectOpts.onOutcome === 'function'),
      });
    }
    // Deterministic, room-path-independent candidate: artifactId is ROOM-RELATIVE,
    // so two byte-identical fixture rooms must yield byte-identical candidates.
    if (!a || !b) return Promise.resolve([]);
    return Promise.resolve([{
      source: 'artifact:' + a,
      target: 'artifact:' + b,
      edge_type: 'INFORMS',
      reason: 'parity stand-in',
    }]);
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'derive-233-parity-'));
  const roomDrain = (await buildFixtureRoom224(path.join(tmp, 'headless'), { artifactCount: 3 })).roomDir;
  const roomBackfill = (await buildFixtureRoom224(path.join(tmp, 'insession'), { artifactCount: 3 })).roomDir;

  // Make the two rooms identical on the TIME axis too (see stampArtifactMtimes).
  const drainIds = stampArtifactMtimes(roomDrain);
  const backfillIds = stampArtifactMtimes(roomBackfill);
  check('B0. the two fixture rooms enumerate the identical artifact id set with '
    + 'identical, deterministic mtime ordering (so B3/B6 measure the producer, '
    + 'not filesystem timestamp granularity)',
    drainIds.length === 3 && JSON.stringify(drainIds) === JSON.stringify(backfillIds));

  classifier.scoreBasedDeriveFn = recordingStandIn;
  try {
    // --- the HEADLESS trigger: enqueue room-scoped, then drain the DEFAULT path.
    phase = 'drain';
    sweep.enqueueDerive(roomDrain, {});
    await drain.drainDerive(roomDrain, { probeOpts: { encodeFn: probeEncodeFn } });

    // --- the IN-SESSION trigger: /mos:graph --derive backfill, DEFAULT path.
    phase = 'backfill';
    await backfill.runDeriveBackfill({ roomDir: roomBackfill, probeOpts: { encodeFn: probeEncodeFn } });
    phase = null;
  } finally {
    classifier.scoreBasedDeriveFn = REAL_SCORE_BASED;
  }

  check('B1. the headless drain default path INVOKED classifier.scoreBasedDeriveFn '
    + '(a different producer would leave this list empty)',
    invocations.drain.length > 0);
  check('B2. the in-session backfill default path INVOKED THE SAME classifier.scoreBasedDeriveFn',
    invocations.backfill.length > 0);

  const drainPairs = invocations.drain.map((i) => i.a + '::' + i.b).sort();
  const backfillPairs = invocations.backfill.map((i) => i.a + '::' + i.b).sort();
  // Self-explaining failure: dump both sets BEFORE asserting, so a future
  // divergence reports what differed instead of just which line threw.
  if (JSON.stringify(drainPairs) !== JSON.stringify(backfillPairs)) {
    console.error('  DIVERGED\n    headless : ' + JSON.stringify(drainPairs)
      + '\n    in-session: ' + JSON.stringify(backfillPairs));
  }
  check('B3. both triggers drove the producer over the IDENTICAL pair set for '
    + 'byte-identical rooms (' + drainPairs.length + ' pairs each)',
    drainPairs.length > 0
    && JSON.stringify(drainPairs) === JSON.stringify(backfillPairs));

  check('B4. both triggers handed the producer the same D-04 seam shape '
    + '(scoreOpts + onOutcome), so probe and scoring cannot diverge on either path',
    invocations.drain.every((i) => i.gotProducerOpts && i.gotScoreOptsSeam && i.gotOnOutcome)
    && invocations.backfill.every((i) => i.gotProducerOpts && i.gotScoreOptsSeam && i.gotOnOutcome));

  const drainEdges = readCascadeEdges(roomDrain);
  const backfillEdges = readCascadeEdges(roomBackfill);
  check('B5. the headless path actually LANDED cascade edges in room.db '
    + '(' + drainEdges.length + ' edges), so B6 compares real output not two empties',
    drainEdges.length > 0);
  check('B6. FUNCTIONAL parity: identical input pairs produced the IDENTICAL '
    + 'cascade edge set on disk through both triggers',
    JSON.stringify(drainEdges) === JSON.stringify(backfillEdges));
  check('B7. both triggers landed the edges PROPOSED, never auto-confirmed '
    + '(Canon Part 3/9: only a human confirms)',
    drainEdges.every((e) => e.endsWith('|proposed'))
    && backfillEdges.every((e) => e.endsWith('|proposed')));

  console.log(`\nPASS (${pass}/${pass}) -- RCA 4b/4e: headless and in-session share ONE default producer`);
}

main().catch((e) => {
  try { classifier.scoreBasedDeriveFn = REAL_SCORE_BASED; } catch (_e) { /* tolerate */ }
  console.error('FAIL', e && e.stack ? e.stack : e);
  process.exit(1);
});
