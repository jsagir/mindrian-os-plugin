'use strict';
// Phase 395-01: the job is real. Plain Node script. Exit 0 when all checks pass, 1 when one fails.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert');

const jtbdState = require('../lib/hmi/jtbd-state.cjs');
const { composeNextMove } = require('../lib/core/feyminto/next-move.cjs');
const goalGate = require('../lib/core/strategy/goal-gate.cjs');

const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-395-'));
let failed = 0;

function check(name, fn) {
  try {
    fn();
    console.log('ok: ' + name);
  } catch (e) {
    failed += 1;
    console.log('FAIL: ' + name + ' -- ' + (e && e.message ? e.message : String(e)));
  }
}

function room(n) {
  const dir = path.join(base, 'room' + n);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const BASE_INPUT = { face: { asked: false, commands: [] }, sources: null, ledgerCandidates: null, attempted: [], need: {} };

try {
  const room1 = room(1);
  check('1. no state file: section job used, rung null', () => {
    assert.deepStrictEqual(jtbdState.resolveSelectionJob(room1, 'find-problem'), { id: 'find-problem', origin: 'section', rung: null });
  });

  check('2. goal job in vocabulary wins over section job', () => {
    jtbdState.setGoal(room1, { jtbd: 'validate-idea', rung: 'IllDefined' });
    assert.deepStrictEqual(jtbdState.resolveSelectionJob(room1, 'find-problem'), { id: 'validate-idea', origin: 'goal', rung: 'IllDefined' });
  });

  const room2 = room(2);
  check('3. goal job outside vocabulary is ignored for selection', () => {
    jtbdState.setGoal(room2, { jtbd: 'a sentence that is not a job id' });
    const r = jtbdState.resolveSelectionJob(room2, 'find-problem');
    assert.strictEqual(r.id, 'find-problem');
    assert.strictEqual(r.origin, 'section');
  });

  const room3 = room(3);
  check('4. no state file and no section job: none', () => {
    assert.deepStrictEqual(jtbdState.resolveSelectionJob(room3, null), { id: null, origin: null, rung: null });
  });

  check('5. composeNextMove with no job: job_unknown and job_offers array', () => {
    const m = composeNextMove(Object.assign({ surface: 'mcp', jobId: null }, BASE_INPUT));
    assert.strictEqual(m.state, 'job_unknown');
    assert.strictEqual(m.job, null);
    assert.ok(Array.isArray(m.job_offers));
  });

  check('6. composeNextMove with goal job: state ok and job origin goal', () => {
    const m = composeNextMove(Object.assign({ surface: 'mcp', jobId: 'validate-idea', jobOrigin: 'goal' }, BASE_INPUT));
    assert.strictEqual(m.state, 'ok');
    assert.deepStrictEqual(m.job, { id: 'validate-idea', origin: 'goal' });
  });

  check('7. composeNextMove with section job and no jobOrigin: origin section', () => {
    const m = composeNextMove(Object.assign({ surface: 'mcp', jobId: 'find-problem' }, BASE_INPUT));
    assert.deepStrictEqual(m.job, { id: 'find-problem', origin: 'section' });
  });

  const room4 = room(4);
  check('8. applyGoalFile without rung keeps the stored rung', () => {
    jtbdState.setGoal(room4, { jtbd: 'validate-idea', rung: 'Wicked' });
    goalGate.applyGoalFile(room4, { jtbd: 'understand-market' });
    const g = jtbdState.getGoal(room4);
    assert.strictEqual(g.jtbd, 'understand-market');
    assert.strictEqual(g.rung, 'Wicked');
  });

  check('9. applyGoalFile with rung sets the rung', () => {
    goalGate.applyGoalFile(room4, { jtbd: 'understand-market', rung: 'IllDefined' });
    assert.strictEqual(jtbdState.getGoal(room4).rung, 'IllDefined');
  });
} finally {
  try { fs.rmSync(base, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
}

if (failed > 0) {
  console.log('FAILED: ' + failed + ' check(s)');
  process.exit(1);
}
console.log('PASSED: all checks');
process.exit(0);
