'use strict';
/*
 * Phase 224-02 Task 2 -- Req 6 cost bound (exact-N scorer calls per write).
 * =======================================================================
 * A per-write drain over a room with N existing artifacts plus 1 new write must
 * make EXACTLY N score calls -- O(n) new-artifact-vs-existing pairing, NOT N
 * squared and NOT N-choose-2. Proven with an injected counting scorer so the
 * assertion is deterministic and encoder-free.
 *
 * No em-dashes. CJS only.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const sweep = require(path.join(REPO_ROOT, 'scripts', 'gsd-graph-derive-sweep.cjs'));
const drain = require(path.join(REPO_ROOT, 'scripts', 'gsd-graph-derive-drain.cjs'));
const classifier = require(path.join(REPO_ROOT, 'lib', 'core', 'graph-derive-classifier.cjs'));
const { buildFixtureRoom224 } = require(path.join(REPO_ROOT, 'tests', 'helpers', 'fixture-room-224.cjs'));

let pass = 0;
function check(label, cond) {
  assert.ok(cond, label);
  pass += 1;
  console.log('  ok -', label);
}

// A tiny available-encoder probe stub: two distinct vectors -> real cosine, so the
// D-04 probe reports available WITHOUT loading the heavy encoder.
function probeEncodeFn() {
  return [[1, 0, 0], [0, 1, 0]];
}

async function main() {
  console.log('test-224-cost-bound (Req 6 exact-N scorer calls)');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'derive-224-cost-'));
  // 5 fixture artifacts (2 related + 3 unrelated) already on disk.
  const fixture = await buildFixtureRoom224(tmp, { artifactCount: 5 });
  const roomDir = fixture.roomDir;
  const N = fixture.allFiles.length; // 5 existing content artifacts

  // Write ONE extra markdown file (the "new write").
  const newFile = path.join(roomDir, 'venture-new-write.md');
  fs.writeFileSync(newFile,
    '# New Write\n\nA fresh artifact written by the simulated per-write trigger, ' +
    'distinct enough to enumerate as its own markdown node.\n', 'utf8');

  // A counting scorer that always returns a below-floor semantic (no edges), so the
  // ONLY thing under test is the CALL COUNT.
  let scoreCalls = 0;
  function countingStub() {
    scoreCalls += 1;
    return Promise.resolve({
      semantic: 0.1, lexical: 0.0, signed_diff: 0.1, abs_diff: 0.1,
      direction: null, passes: false, band: 'low',
      provenance: { semantic_model: 'stub', dim: 3 },
    });
  }
  const deriveFn = (step) => classifier.scoreBasedDeriveFn(step, { scoreFn: countingStub });

  sweep.enqueueDerive(roomDir, { filePath: newFile });
  await drain.drainDerive(roomDir, { deriveFn, probeOpts: { encodeFn: probeEncodeFn } });

  check('the new write scored exactly N existing artifacts (O(n), Req 6)', scoreCalls === N);
  check('the cost is NOT N squared (dense pairing)', scoreCalls !== N * N);
  check('the cost is NOT N-choose-2 (full backfill pairing)',
    scoreCalls !== (N * (N - 1)) / 2 || N <= 2);

  console.log(`\nPASS (${pass}/${pass}) -- Req 6: ${scoreCalls} calls for ${N} existing artifacts`);
}

main().catch((e) => {
  console.error('FAIL', e && e.stack ? e.stack : e);
  process.exit(1);
});
