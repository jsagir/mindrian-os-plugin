'use strict';
/*
 * Phase 165 Wave-3 GREEN test -- test-unknowns-resume (D-165-09).
 *
 * GREEN assertion (sourced from 165-VALIDATION.md + 165-RESEARCH section 1.6, the
 * resumable per-pull checkpoint):
 *   An interrupted-then-resumed scan is BYTE-IDENTICAL to an uninterrupted scan:
 *   same corpusHash, same pull order, same findings, same cumulativeUtility. The
 *   checkpoint (the CHECKPOINT_SHAPE / CHECKPOINT_ARM_SHAPE in the shared iface)
 *   is written per pull; on resume, if corpusHash matches, the scan continues from
 *   `pull`; if it differs (a dirty corpus), it starts a FRESH scan. No Date.now in
 *   the checkpoint key (deterministic; scanId keys the sidecar so a re-run is a
 *   cache hit), Pitfall 4 (non-deterministic resume) guarded.
 *
 * NO em-dashes (CLAUDE.md HARD RULE).
 */
const assert = require('assert');
const bandit = require('../lib/core/unknowns/bandit.cjs');
const { CHECKPOINT_SHAPE, CHECKPOINT_ARM_SHAPE } = require('../lib/core/unknowns/iface.cjs');

let failures = 0;
function check(name, fn) {
  try {
    fn();
    console.log('  ok - ' + name);
  } catch (e) {
    failures++;
    console.error('  FAIL - ' + name + ': ' + e.message);
  }
}

function partitions() {
  return [
    {
      id: 'pA', meanConfidence: 0.95,
      pattern: { conditions: [{ feature: 'domain', operator: '=', value: 'biotech' }] },
      instances: [{ claimId: 'claim:a1' }, { claimId: 'claim:a2' }, { claimId: 'claim:a3' }],
    },
    {
      id: 'pB', meanConfidence: 0.5,
      pattern: { conditions: [{ feature: 'domain', operator: '=', value: 'software' }] },
      instances: [{ claimId: 'claim:b1' }, { claimId: 'claim:b2' }, { claimId: 'claim:b3' }],
    },
  ];
}
function oracle(claimId) {
  return { trueLabel: claimId.startsWith('claim:b') ? 1 : 0, cost: 0.0 };
}
const HASH = 'corpus-hash-v1';
const CFG = { roomDir: '/tmp/uu-room', corpusHash: HASH, budget: 1.0 };

check('the checkpoint matches the documented CHECKPOINT_SHAPE', () => {
  const res = bandit.selectNextInstance(partitions(), oracle, { roomDir: CFG.roomDir, corpusHash: HASH, budget: 0.5 });
  const cp = res.checkpoint;
  for (const k of Object.keys(CHECKPOINT_SHAPE)) {
    assert(k in cp, 'checkpoint missing field ' + k);
  }
  assert(Array.isArray(cp.arms) && cp.arms.length > 0, 'checkpoint arms empty');
  for (const k of Object.keys(CHECKPOINT_ARM_SHAPE)) {
    assert(k in cp.arms[0], 'checkpoint arm missing field ' + k);
  }
  assert.strictEqual(cp.corpusHash, HASH, 'checkpoint corpusHash mismatch');
});

check('interrupt-then-resume is byte-identical to an uninterrupted scan', () => {
  // Full uninterrupted scan (budget = N = 6).
  const full = bandit.selectNextInstance(partitions(), oracle, CFG);

  // Interrupt after 2 pulls, capture the checkpoint, then resume.
  let captured = null;
  const interrupted = bandit.selectNextInstance(partitions(), oracle, CFG, {
    maxPulls: 2,
    onCheckpoint: (cp) => { captured = cp; },
  });
  assert(captured, 'no checkpoint was emitted');
  assert.strictEqual(interrupted.records.length, 2, 'interrupt should stop after 2 pulls');

  const resumed = bandit.resumeFrom(captured, partitions(), oracle, HASH, { roomDir: CFG.roomDir });
  assert(!resumed.freshScanRequired, 'matching corpusHash should NOT require a fresh scan');

  assert.strictEqual(
    JSON.stringify(resumed.records),
    JSON.stringify(full.records),
    'resumed record sequence is not byte-identical to the uninterrupted run'
  );
  assert.strictEqual(resumed.cumulativeUtility, full.cumulativeUtility, 'cumulativeUtility differs after resume');
});

check('a checkpoint whose corpusHash differs starts a FRESH scan', () => {
  let captured = null;
  bandit.selectNextInstance(partitions(), oracle, CFG, { maxPulls: 2, onCheckpoint: (cp) => { captured = cp; } });
  const resumed = bandit.resumeFrom(captured, partitions(), oracle, 'a-DIFFERENT-hash', { roomDir: CFG.roomDir });
  assert.strictEqual(resumed.freshScanRequired, true, 'a dirty corpus must signal a fresh scan');
  assert.strictEqual(resumed.reason, 'corpus_dirty', 'fresh-scan reason should be corpus_dirty');
});

check('scanId is deterministic over (roomDir, corpusHash) with no Date.now', () => {
  const a = bandit.deriveScanId(CFG.roomDir, HASH);
  const b = bandit.deriveScanId(CFG.roomDir, HASH);
  assert.strictEqual(a, b, 'scanId is not stable for the same (roomDir, corpusHash)');
  const c = bandit.deriveScanId(CFG.roomDir, 'other');
  assert(a !== c, 'scanId did not change when corpusHash changed');
});

if (failures > 0) {
  console.error('test-unknowns-resume: ' + failures + ' assertion(s) FAILED');
  process.exit(1);
}
console.log('test-unknowns-resume: GREEN (per-pull checkpoint; byte-identical resume; dirty-corpus fresh-scan)');
process.exit(0);
