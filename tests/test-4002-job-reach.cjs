#!/usr/bin/env node
'use strict';
// Phase 400.2 plan 01: the nine jobs of /mos:persona reach the ranker.
// R1 to R4 (plan 01). T1 to T4 (plan 02): a labelled command stays in its job row below the row depth.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..');
const ranker = require(path.join(ROOT, 'lib', 'workflow', 'f-selector-ranker.cjs'));
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

let failed = 0;
let passed = 0;
function check(label, fn) {
  try {
    fn();
    passed += 1;
    console.log('ok: ' + label);
  } catch (e) {
    failed += 1;
    console.log('FAIL: ' + label + ' -- ' + (e && e.message ? e.message : String(e)));
  }
}

const registry = readJson('data/command-registry.json');
const row = registry.commands.find((c) => c.command === '/mos:persona');
const IDS = ['validate-idea', 'explore', 'decide-pursue', 'surface-contradiction', 'compare-options', 'prepare-pitch', 'find-problem', 'navigate', 'audit-room'];
const resolve = ranker._test._resolveJtbdForCommand;

check('R0. the ranker exports _resolveJtbdForCommand and the registry has /mos:persona', () => {
  assert.equal(typeof resolve, 'function');
  assert.ok(row, 'no /mos:persona row');
});

check('R1. for each of the nine ids as the active room job, the ranker job key is that id', () => {
  for (const id of IDS) assert.equal(resolve(row, { activeJtbd: id }), id, id);
});

check('R2. with no active job the key is validate-idea; position 0 is a placeholder, not a rank', () => {
  assert.equal(resolve(row, {}), 'validate-idea');
  assert.equal(resolve(row, null), 'validate-idea');
  console.log('note: position 0 is a placeholder, not a rank');
});

check('R3. every owner_direct pair of data/job-label-rulings.json is in the registry serves_jtbd of /mos:persona', () => {
  const rulings = readJson('data/job-label-rulings.json');
  assert.equal(rulings.owner_direct.length, 8);
  const miss = rulings.owner_direct.filter((p) => !(row.serves_jtbd || []).includes(p.job)).map((p) => p.job);
  assert.deepEqual(miss, []);
  assert.deepEqual(row.serves_jtbd.slice().sort(), IDS.slice().sort());
});

check('R4. jtbd_label of /mos:persona in the registry is "Validate Idea"', () => {
  assert.equal(row.jtbd_label, 'Validate Idea');
});

// ---- Plan 02: table reach legs T1 to T4 ----
const builder = require(path.join(ROOT, 'scripts', 'build-decision-advisor-table.cjs'));
const table = readJson('data/decision-advisor-table.json');
const recorded = readJson('tests/fixtures/399/recorded-job-command-yes-no.json');
const scope = readJson('data/run-step-capabilities.json');
const live = builder.resolveDeprecated(scope.commands, path.join(ROOT, 'commands'));
const liveSet = new Set(live.commands);
const served = new Map(registry.commands.map((c) => [c.command, new Set(Array.isArray(c.serves_jtbd) ? c.serves_jtbd : [])]));
const recordedJobs = Array.from(new Set(recorded.pairs.map((pr) => pr.job))).sort();
const rowOf = (job) => table.rows[job + '|*|*'] || null;

// The old rule, recomputed from the recorded pairs: sorted by value, then by command name.
function sortedList(job) {
  const list = recorded.pairs
    .filter((pr) => pr.job === job && liveSet.has(pr.command))
    .map((pr) => ({ command: pr.command, calibrated: builder.applyCalibration(table.calibration.breakpoints, pr.p) }));
  list.sort((a, b) => b.calibrated - a.calibrated || (a.command < b.command ? -1 : 1));
  return list;
}

check('T1. for each recorded job, every live-scope command that carries the job label and has a recorded pair is in the row', () => {
  assert.equal(recordedJobs.length, 20);
  const missing = [];
  for (const job of recordedJobs) {
    const row = rowOf(job);
    assert.ok(row, 'no row for ' + job);
    const inRow = new Set(row.map((e) => e.command));
    for (const e of sortedList(job)) {
      if (served.has(e.command) && served.get(e.command).has(job) && !inRow.has(e.command)) missing.push(job + ':' + e.command);
    }
  }
  assert.deepEqual(missing, []);
});

check('T2. every entry at index 12 or later carries the job label in the registry', () => {
  let deep = 0;
  for (const job of recordedJobs) {
    const row = rowOf(job);
    for (let i = table.row_depth; i < row.length; i += 1) {
      deep += 1;
      assert.ok(served.has(row[i].command) && served.get(row[i].command).has(job), 'unlabelled entry below depth: ' + job + ':' + row[i].command);
    }
  }
  assert.ok(deep > 0, 'no row is longer than the row depth: the rule did not act');
});

check('T3. rows stay sorted; the first 12 entries equal the old rule; later entries keep list order', () => {
  for (const job of recordedJobs) {
    const row = rowOf(job);
    const old = sortedList(job);
    assert.deepEqual(row.slice(0, table.row_depth), old.slice(0, table.row_depth), 'first 12 changed for ' + job);
    const expectedTail = old.slice(table.row_depth).filter((e) => served.has(e.command) && served.get(e.command).has(job));
    assert.deepEqual(row.slice(table.row_depth), expectedTail, 'tail differs for ' + job);
    for (let i = 1; i < row.length; i += 1) {
      const a = row[i - 1];
      const b = row[i];
      assert.ok(a.calibrated > b.calibrated || (a.calibrated === b.calibrated && a.command < b.command), 'order in ' + job);
    }
  }
});

check('T4. with the advisor on, scoreFor returns a value for /mos:persona in each of the nine job rows that exists', () => {
  const prev = process.env.MINDRIAN_DECISION_ADVISOR;
  process.env.MINDRIAN_DECISION_ADVISOR = 'on';
  try {
    const { scoreFor } = require(path.join(ROOT, 'lib', 'core', 'decision-advisor', 'shortlist.cjs'));
    const pending = [];
    for (const id of IDS) {
      if (!rowOf(id)) {
        pending.push(id);
        console.log('no row for ' + id + ': recorded run of plan 18 pending');
        continue;
      }
      assert.notEqual(scoreFor({ jobId: id }, '/mos:persona'), null, 'scoreFor is null for ' + id);
    }
    const navigateRecorded = recorded.pairs.some((pr) => pr.job === 'navigate');
    assert.deepEqual(pending, navigateRecorded ? [] : ['navigate']);
  } finally {
    if (prev === undefined) delete process.env.MINDRIAN_DECISION_ADVISOR;
    else process.env.MINDRIAN_DECISION_ADVISOR = prev;
  }
});


console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
