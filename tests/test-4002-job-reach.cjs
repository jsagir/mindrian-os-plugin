#!/usr/bin/env node
'use strict';
// Phase 400.2 plan 01: the nine jobs of /mos:persona reach the ranker.
// R1 to R4. The table legs come in plan 02.
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

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
