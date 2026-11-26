#!/usr/bin/env node
'use strict';
// Phase 400.2 plan 01: the nine job statements of /mos:persona.
// Legs J1 to J4 and J9 guard the store. Legs J5 to J8 guard the command (body section, serves_jtbd, slots, description).
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..');
const { parseJob, renderJob, slotErrors } = require(path.join(ROOT, 'lib', 'core', 'job-sentence.cjs'));
const STORE_REL = 'data/capability-job-statements.json';
const EXPECTED_IDS = ['audit-room', 'compare-options', 'decide-pursue', 'explore', 'find-problem', 'navigate', 'prepare-pitch', 'surface-contradiction', 'validate-idea'];
const ORDER = ['validate-idea', 'explore', 'decide-pursue', 'surface-contradiction', 'compare-options', 'prepare-pitch', 'find-problem', 'navigate', 'audit-room'];

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
const readText = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const readJson = (rel) => JSON.parse(readText(rel));

function storeErrors(store) {
  const errs = [];
  if (!store || store.schema !== 'mos.capability-job-statements/1') errs.push('schema');
  if (!store || store.ruled_at !== '2026-11-25') errs.push('ruled_at');
  if (!store || typeof store._note !== 'string' || !store._note) errs.push('_note');
  const caps = store && Array.isArray(store.capabilities) ? store.capabilities : [];
  if (caps.length !== 1) errs.push('capabilities length ' + caps.length);
  const cap = caps[0] || {};
  if (cap.surface !== '/mos:persona') errs.push('surface');
  if (!Array.isArray(cap.jobs) || cap.jobs.length !== 9) errs.push('jobs length ' + (cap.jobs ? cap.jobs.length : 'none'));
  return errs;
}

function frontmatter(rel) {
  const lines = readText(rel).split('\n');
  assert.equal(lines[0], '---');
  const end = lines.indexOf('---', 1);
  assert.ok(end > 0, 'no frontmatter end');
  return lines.slice(1, end);
}
function fmValue(lines, key) {
  const l = lines.find((x) => x.startsWith(key + ':'));
  assert.ok(l, 'no key ' + key);
  return l.slice(key.length + 1).trim();
}
const unquote = (v) => (v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1) : v);

let store = null;
try { store = readJson(STORE_REL); } catch (e) { store = null; }

check('J1. store has schema, ruled_at 2026-11-25, a _note and one capability /mos:persona with nine jobs', () => {
  assert.ok(store, 'store missing or unreadable: ' + STORE_REL);
  assert.deepEqual(storeErrors(store), []);
});

check('J2. each job has exactly the keys job_id, when, want, so, status; status is ruled; no key named main', () => {
  assert.ok(store, 'store missing');
  for (const j of store.capabilities[0].jobs) {
    assert.deepEqual(Object.keys(j).sort(), ['job_id', 'so', 'status', 'want', 'when']);
    assert.equal(j.status, 'ruled');
  }
  assert.ok(!/"main"/.test(readText(STORE_REL)), 'a key named main exists');
});

check('J3. each job_id is in the vocabulary, unique, and the sorted list is the nine ruled ids', () => {
  assert.ok(store, 'store missing');
  const vocab = new Set(readJson('data/job-vocabulary.json').ids);
  const ids = store.capabilities[0].jobs.map((j) => j.job_id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.ok(vocab.has(id), 'not in vocabulary: ' + id);
  assert.deepEqual(ids.slice().sort(), EXPECTED_IDS);
});

check('J4. slotErrors is empty for each job and parseJob(renderJob(slots)) equals the slots', () => {
  assert.ok(store, 'store missing');
  for (const j of store.capabilities[0].jobs) {
    const slots = { when: j.when, want: j.want, so: j.so };
    assert.deepEqual(slotErrors(slots), [], j.job_id);
    assert.deepEqual(parseJob(renderJob(slots)), slots, j.job_id);
  }
});

check('J9. mutation control: a store with one statement removed fails J1', () => {
  assert.ok(store, 'store missing');
  const copy = JSON.parse(JSON.stringify(store));
  copy.capabilities[0].jobs.pop();
  assert.notDeepEqual(storeErrors(copy), []);
  assert.deepEqual(storeErrors(store), []);
});

function bodySection() {
  const lines = readText('commands/persona.md').split('\n');
  const i = lines.indexOf('## When to use it');
  assert.ok(i >= 0, 'section "## When to use it" missing in commands/persona.md');
  let k = i + 1;
  const section = [];
  while (k < lines.length && !/^## /.test(lines[k])) { section.push(lines[k]); k += 1; }
  return section;
}

check('J5. the bullets under "## When to use it" equal the nine rendered store sentences; no hat and no command named', () => {
  assert.ok(store, 'store missing');
  const section = bodySection();
  const bullets = section.filter((l) => l.startsWith('- ')).map((l) => l.slice(2).trim());
  const want = store.capabilities[0].jobs.map((j) => renderJob({ when: j.when, want: j.want, so: j.so }));
  assert.deepEqual(bullets.slice().sort(), want.slice().sort());
  const joined = section.join('\n');
  assert.ok(!/\/mos:/.test(joined), 'section names a command');
  assert.ok(!/\b(white|red|black|yellow|green|blue)\b/i.test(joined), 'section names a hat colour');
  assert.ok(!/\bhats?\b/i.test(joined), 'section names the hats');
});

check('J6. serves_jtbd of commands/persona.md equals the nine store ids as a set; first id is validate-idea', () => {
  assert.ok(store, 'store missing');
  const fm = frontmatter('commands/persona.md');
  const ids = JSON.parse(fmValue(fm, 'serves_jtbd'));
  assert.deepEqual(ids.slice().sort(), store.capabilities[0].jobs.map((j) => j.job_id).sort());
  assert.equal(ids[0], 'validate-idea');
  assert.deepEqual(ids, ORDER);
});

check('J7. job_when, job_want, job_so equal the validate-idea row of the store; status is provisional', () => {
  assert.ok(store, 'store missing');
  const row = store.capabilities[0].jobs.find((j) => j.job_id === 'validate-idea');
  const fm = frontmatter('commands/persona.md');
  assert.equal(unquote(fmValue(fm, 'job_when')), row.when);
  assert.equal(unquote(fmValue(fm, 'job_want')), row.want);
  assert.equal(unquote(fmValue(fm, 'job_so')), row.so);
  assert.equal(unquote(fmValue(fm, 'job_sentence_status')), 'provisional');
});

check('J8. description line is byte-equal to the base text; no em dash and no en dash in the files', () => {
  const lines = readText('commands/persona.md').split('\n');
  const d = lines.filter((l) => l.startsWith('description:'));
  assert.deepEqual(d, ['description: Generate Six-Hats lenses from room data']);
  for (const f of ['commands/persona.md', STORE_REL, 'tests/test-4002-job-statements.cjs']) {
    if (!fs.existsSync(path.join(ROOT, f))) continue;
    assert.ok(!new RegExp('[' + String.fromCharCode(0x2013) + String.fromCharCode(0x2014) + ']').test(readText(f)), f);
  }
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
