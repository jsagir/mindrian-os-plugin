#!/usr/bin/env node
'use strict';
// Phase 399-01 Task 1: the one job vocabulary (D-01, I-01) and its drift test.
// Legs V1 to V9. V8 is the mutation control: the membership function must bite on a bad id.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..');
const read = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

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

const VOCAB_REL = 'data/job-vocabulary.json';
let vocab = null;
try {
  vocab = read(VOCAB_REL);
} catch (e) {
  vocab = null;
}

// The membership function under test. Returns the values that are NOT in the closed list.
function misses(values, ids) {
  const set = new Set(ids);
  return values.filter((v) => !set.has(v));
}

function registryJobs(registry) {
  const out = [];
  for (const c of registry.commands) {
    for (const j of c.serves_jtbd || []) out.push(j);
  }
  return out;
}

check('V1 file parses, schema, 20 sorted unique ids, every id has a summary', () => {
  assert.ok(vocab, VOCAB_REL + ' is missing or does not parse');
  assert.equal(vocab.schema, 'mos.job-vocabulary/1');
  assert.ok(Array.isArray(vocab.ids));
  assert.equal(vocab.ids.length, 20);
  assert.deepEqual(vocab.ids, [...vocab.ids].sort());
  assert.equal(new Set(vocab.ids).size, vocab.ids.length);
  assert.deepEqual(Object.keys(vocab.jobs).sort(), vocab.ids);
  for (const id of vocab.ids) {
    const s = vocab.jobs[id].summary;
    assert.ok(typeof s === 'string' && s.trim().length > 0, 'empty summary for ' + id);
    assert.ok(Array.isArray(vocab.jobs[id].origins) && vocab.jobs[id].origins.length > 0, 'origins for ' + id);
  }
});

check('V2 every registry serves_jtbd value is in ids', () => {
  assert.ok(vocab);
  assert.deepEqual(misses(registryJobs(read('data/command-registry.json')), vocab.ids), []);
});

check('V3 every taxonomy id is in ids and its summary equals the taxonomy one_line', () => {
  assert.ok(vocab);
  const tax = read('lib/hmi/jtbd-taxonomy.json');
  assert.ok(tax.entries.length > 0);
  assert.deepEqual(misses(tax.entries.map((e) => e.id), vocab.ids), []);
  for (const e of tax.entries) {
    assert.equal(vocab.jobs[e.id].summary, e.one_line, 'summary differs for ' + e.id);
    assert.equal(vocab.jobs[e.id].summary_source, 'taxonomy', 'summary_source for ' + e.id);
  }
});

check('V4 every section canon job id is in ids', () => {
  assert.ok(vocab);
  const canon = read('data/section-job-canon.json');
  const values = [];
  for (const s of Object.values(canon.sections)) {
    values.push(s.job_id);
    if (s.secondary_job_id) values.push(s.secondary_job_id);
  }
  for (const j of canon.vocabulary_extension_jobs) values.push(j);
  assert.ok(values.length > 0);
  assert.deepEqual(misses(values, vocab.ids), []);
});

check('V5 section-registry JOB_VOCABULARY deep-equals ids', () => {
  assert.ok(vocab);
  const sr = require('../lib/core/section-registry.cjs');
  assert.deepEqual([...sr.JOB_VOCABULARY].sort(), vocab.ids);
});

check('V6 ledger row jobs and selection eval case jobs are in ids', () => {
  assert.ok(vocab);
  const ledger = read('data/section-command-ledger.json');
  const ledgerJobs = Object.keys(ledger.rows).map((k) => k.split('|')[0]);
  assert.ok(ledgerJobs.length > 0);
  assert.deepEqual(misses(ledgerJobs, vocab.ids), []);
  const cases = read('evals/selection/cases.json').cases;
  assert.ok(cases.length > 0);
  assert.deepEqual(misses(cases.map((c) => c.job_id), vocab.ids), []);
});

check('V7 summary_source for the 7 jobs added by phase 399', () => {
  assert.ok(vocab);
  for (const j of ['temporal-correction', 'build', 'navigate']) {
    assert.equal(vocab.jobs[j].summary_source, 'phase-399', j);
  }
  for (const j of ['design-solution', 'model-business', 'model-finances', 'protect-assets']) {
    assert.equal(vocab.jobs[j].summary_source, 'phase-399-section-canon', j);
  }
});

check('V8 mutation control: a changed serves_jtbd value is reported as a miss', () => {
  assert.ok(vocab);
  const registry = JSON.parse(JSON.stringify(read('data/command-registry.json')));
  const target = registry.commands.find((c) => Array.isArray(c.serves_jtbd) && c.serves_jtbd.length > 0);
  assert.ok(target);
  target.serves_jtbd[0] = 'not-a-job';
  assert.deepEqual(misses(registryJobs(registry), vocab.ids).filter((v) => v === 'not-a-job'), ['not-a-job']);
});

check('V9 no em dash or en dash in the vocabulary file', () => {
  const text = fs.readFileSync(path.join(ROOT, VOCAB_REL), 'utf8');
  assert.equal(/[–—]/.test(text), false);
});

if (failed > 0) {
  console.log('>>> test-399-job-vocabulary.cjs: FAILED (' + failed + ' failed, ' + passed + ' passed)');
  process.exit(1);
}
console.log('>>> test-399-job-vocabulary.cjs: PASSED');
