#!/usr/bin/env node
'use strict';
// Phase 400-01 Task 2: three-slot sentences for the 20 vocabulary jobs (JS-01, O-01, O-14).
// Legs J1 to J5. summary stays byte-identical to base c1e496ae8 (Pitfall 1).
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const BASE = 'c1e496ae8';
const REL = 'data/job-vocabulary.json';
const js = require(path.join(ROOT, 'lib/core/job-sentence.cjs'));

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

const raw = fs.readFileSync(path.join(ROOT, REL), 'utf8');
const vocab = JSON.parse(raw);
const base = JSON.parse(execFileSync('git', ['show', BASE + ':' + REL], { cwd: ROOT, encoding: 'utf8' }));

check('J1 every job has valid slots and sentence equals renderJob(slots); sentence style holds', () => {
  assert.equal(vocab.ids.length, 20);
  for (const id of vocab.ids) {
    const j = vocab.jobs[id];
    assert.ok(j.slots, 'no slots for ' + id);
    assert.deepEqual(js.slotErrors(j.slots), [], 'slot errors for ' + id);
    assert.equal(j.sentence, js.renderJob(j.slots), 'sentence is not the render for ' + id);
    assert.deepEqual(js.parseJob(j.sentence), j.slots, 'round trip for ' + id);
    const words = j.sentence.split(/\s+/).filter(Boolean).length;
    assert.ok(words <= 40, id + ' has ' + words + ' words');
    assert.ok(!/\d/.test(j.sentence), id + ' holds a digit');
    assert.ok(!/\b(Larry|Theo|MindrianOS)\b/.test(j.sentence), id + ' holds a product name');
    assert.ok(!/\/mos:|\/m:/.test(j.sentence), id + ' holds a command name');
  }
});

// Rulings of 2026-11-25 (label review section 1). The owner reworded and ruled these 7.
const RULED_BY_OWNER = ['build', 'decide-pursue', 'design-solution', 'explore', 'navigate', 'plan-execution', 'protect-assets'];
// The other 13 were ruled as written, by Fable 5.2 under the owner's delegation of the same day.

check('J2 every job has sentence_status ruled (7 by the owner, 13 by delegation)', () => {
  for (const id of RULED_BY_OWNER) assert.ok(vocab.ids.includes(id), id + ' left the vocabulary');
  for (const id of vocab.ids) assert.equal(vocab.jobs[id].sentence_status, 'ruled', id);
});

check('J3 summary, summary_source and origins are byte-identical to base ' + BASE, () => {
  for (const id of base.ids) {
    for (const k of ['summary', 'summary_source', 'origins']) {
      assert.equal(JSON.stringify(vocab.jobs[id][k]), JSON.stringify(base.jobs[id][k]), id + '.' + k);
    }
  }
});

check('J4 ids, jobs key order, schema and _note are unchanged', () => {
  assert.deepEqual(vocab.ids, base.ids);
  assert.deepEqual(Object.keys(vocab.jobs), Object.keys(base.jobs));
  assert.equal(vocab.schema, base.schema);
  assert.equal(vocab._note, base._note);
  for (const id of vocab.ids) {
    assert.deepEqual(Object.keys(vocab.jobs[id]), [...Object.keys(base.jobs[id]), 'sentence', 'slots', 'sentence_status'], id);
  }
});

check('J5 no en dash or em dash in the file', () => {
  assert.ok(!/[\u2013\u2014]/.test(raw));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
