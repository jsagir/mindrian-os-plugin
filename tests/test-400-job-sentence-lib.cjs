#!/usr/bin/env node
'use strict';
// Phase 400-01: the job-sentence module (O-01 formula, three stored slots).
// Legs L1 to L7 (module). L7 is the mutation control for the framework view.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..');

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

let js = null;
try {
  js = require(path.join(ROOT, 'lib/core/job-sentence.cjs'));
} catch (e) {
  js = null;
}
function need() {
  assert.ok(js, 'lib/core/job-sentence.cjs is missing or does not load');
}

const VALID = [
  { when: 'a', want: 'to b', so: 'c' },
  { when: 'I have a venture, an opportunity or an approach in front of me', want: 'to judge whether it is worth my time', so: 'commit or walk away with a reason' },
  { when: 'my notes pile up', want: 'to sort, group, and name them', so: 'see what I already know' },
  { when: 'a decision is close', want: 'to compare the options side by side', so: 'choose with the trade-offs in view' },
  { when: 'the problem keeps coming back', want: 'to find the cause, not the symptom', so: 'fix it once' },
];

check('L1 renderJob renders the O-01 formula', () => {
  need();
  assert.equal(js.renderJob({ when: 'a', want: 'to b', so: 'c' }), 'When a, I want to b, so I can c.');
});

check('L2 parseJob(renderJob(s)) round-trips 5 valid slot sets, commas inside when and want', () => {
  need();
  for (const s of VALID) {
    assert.deepEqual(js.slotErrors(s), [], 'valid set refused: ' + JSON.stringify(s));
    assert.deepEqual(js.parseJob(js.renderJob(s)), s);
  }
  assert.ok(VALID.some((s) => s.when.includes(',')), 'a when slot with a comma');
  assert.ok(VALID.some((s) => s.want.includes(',')), 'a want slot with a comma');
});

check('L3 slotErrors refuses every bad shape and accepts a valid set', () => {
  need();
  const ok = { when: 'my notes pile up', want: 'to sort them', so: 'see what I know' };
  assert.deepEqual(js.slotErrors(ok), []);
  const bad = [
    ['missing slot', { when: 'a', want: 'to b' }],
    ['blank slot', { when: '  ', want: 'to b', so: 'c' }],
    ['over 160 characters', { when: 'x'.repeat(161), want: 'to b', so: 'c' }],
    ['en dash', { when: 'a \u2013 b', want: 'to b', so: 'c' }],
    ['em dash', { when: 'a', want: 'to b \u2014 c', so: 'c' }],
    ['double quote', { when: 'a "b"', want: 'to b', so: 'c' }],
    ['backslash', { when: 'a', want: 'to b\\c', so: 'c' }],
    ['newline', { when: 'a', want: 'to b', so: 'c\nd' }],
    ['ends with period', { when: 'a', want: 'to b', so: 'c.' }],
    ['ends with semicolon', { when: 'a;', want: 'to b', so: 'c' }],
    ['ends with colon', { when: 'a', want: 'to b:', so: 'c' }],
    ['ends with bang', { when: 'a', want: 'to b', so: 'c!' }],
    ['ends with question', { when: 'a', want: 'to b', so: 'c?' }],
    ['when begins with when', { when: 'when a', want: 'to b', so: 'c' }],
    ['When begins with When', { when: 'When a', want: 'to b', so: 'c' }],
    ['want without to', { when: 'a', want: 'b', so: 'c' }],
    ['so begins with so', { when: 'a', want: 'to b', so: 'so c' }],
    ['so begins with I can', { when: 'a', want: 'to b', so: 'I can c' }],
    ['marker I want inside', { when: 'a, I want x', want: 'to b', so: 'c' }],
    ['marker so I can inside', { when: 'a', want: 'to b, so I can x', so: 'c' }],
    ['extra key', { when: 'a', want: 'to b', so: 'c', why: 'd' }],
    ['not an object', null],
  ];
  for (const [label, s] of bad) {
    const e = js.slotErrors(s);
    assert.ok(Array.isArray(e) && e.length > 0, 'not refused: ' + label);
  }
});

check('L4 parseJob returns null without the anchors', () => {
  need();
  assert.equal(js.parseJob('If a, I want to b, so I can c.'), null);
  assert.equal(js.parseJob('When a, I wish to b, so I can c.'), null);
  assert.equal(js.parseJob('When a, I want to b, so that c.'), null);
  assert.equal(js.parseJob('When a, so I can c, I want to b.'), null);
  assert.equal(js.parseJob('When a, I want to b, so I can c'), null);
  assert.equal(js.parseJob(42), null);
});

check('L5 slotsFromFrontmatter, FRONTMATTER_KEYS, SENTENCE_STATUSES', () => {
  need();
  assert.deepEqual(js.slotsFromFrontmatter({ job_when: 'a', job_want: 'to b', job_so: 'c', name: 'x' }), { when: 'a', want: 'to b', so: 'c' });
  assert.equal(js.slotsFromFrontmatter({ job_when: 'a', job_want: 'to b' }), null);
  assert.equal(js.slotsFromFrontmatter({ job_want: 'to b', job_so: 'c' }), null);
  assert.equal(js.slotsFromFrontmatter(null), null);
  assert.deepEqual(js.FRONTMATTER_KEYS, { when: 'job_when', want: 'job_want', so: 'job_so', status: 'job_sentence_status' });
  assert.deepEqual(js.SENTENCE_STATUSES, ['provisional', 'ruled']);
  assert.deepEqual(js.SLOT_KEYS, ['when', 'want', 'so']);
});

check('L6 frameworkSentences gives counts.ruled_main entries with three non-empty slots', () => {
  need();
  const fj = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/framework-jobs.json'), 'utf8'));
  const list = js.frameworkSentences();
  assert.equal(list.length, fj.counts.ruled_main);
  assert.equal(list.length, 184);
  for (const e of list) {
    assert.ok(typeof e.name === 'string' && e.name.length > 0, 'name');
    assert.ok(e.slots, 'no slots for ' + e.name);
    for (const k of ['when', 'want', 'so']) assert.ok(e.slots[k] && e.slots[k].trim(), k + ' empty for ' + e.name);
  }
  assert.deepEqual(js.frameworkSlots('When a, I want to b, so I can c.'), { when: 'a', want: 'to b', so: 'c' });
  assert.deepEqual(js.frameworkSlots('When a, I want to b, so we can c.'), { when: 'a', want: 'to b', so: 'c' });
  assert.deepEqual(js.frameworkSlots('When a, I want a map, so I can c'), { when: 'a', want: 'a map', so: 'c' });
});

check('L7 mutation control: a ruled statement without ", I want " gives null', () => {
  need();
  const fj = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/framework-jobs.json'), 'utf8'));
  let text = null;
  for (const fw of fj.frameworks) for (const j of fw.jobs) if (!text && j.status === 'ruled' && j.main) text = j.text;
  assert.ok(js.frameworkSlots(text), 'the unmutated statement parses');
  assert.equal(js.frameworkSlots(text.replace(', I want ', ' I want ')), null);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
