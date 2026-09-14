#!/usr/bin/env node
// Phase 344 (the layer contract), Plan 01, Task 2.
// Pins the shape of data/layer-declaration-schema.json: the closed six-member
// layer vocabulary, the own-rung validation rule, the fail-closed default,
// the surface-count-never-hardcoded discipline, and the six-step
// classification rubric (first match wins, one terminal per vocabulary
// member). Modeled on the registry-is-the-table idiom this schema mirrors
// (data/hitl-shape-declaration-schema.json).
//
// House rule: hyphens only, no em-dashes, no emoji.

const assert = require('node:assert');
const path = require('node:path');

const SCHEMA_PATH = path.join(__dirname, '..', 'data', 'layer-declaration-schema.json');

let PASS = 0;
let FAIL = 0;

function check(label, fn) {
  try {
    fn();
    console.log(`PASS: ${label}`);
    PASS++;
  } catch (err) {
    console.log(`FAIL: ${label}`);
    console.log(`  ${err.message}`);
    FAIL++;
  }
}

let schema;
check('the file parses as JSON and exposes a single top-level _doc object', () => {
  schema = require(SCHEMA_PATH);
  assert.ok(schema && typeof schema === 'object', 'schema did not load as an object');
  const keys = Object.keys(schema);
  assert.strictEqual(keys.length, 1, `expected exactly one top-level key, found ${keys.length}: ${keys.join(', ')}`);
  assert.strictEqual(keys[0], '_doc', 'the single top-level key must be _doc');
  assert.ok(schema._doc && typeof schema._doc === 'object', '_doc must be an object');
});

check('_doc.layer_vocabulary is the ordered six-member array', () => {
  const v = schema._doc.layer_vocabulary;
  assert.ok(Array.isArray(v), 'layer_vocabulary must be an array');
  assert.strictEqual(
    v.join(','),
    'prompt,context,harness,loop,graph,none',
    `layer_vocabulary order/members mismatch, got: ${v.join(',')}`
  );
});

check('_doc.layer_vocabulary_note explains the sixth member (WD-11)', () => {
  const n = schema._doc.layer_vocabulary_note;
  assert.strictEqual(typeof n, 'string');
  assert.ok(n.length > 0, 'layer_vocabulary_note must be non-empty');
  assert.ok(/none/i.test(n), 'layer_vocabulary_note should discuss the none member');
});

check('_doc.validation_rule is a non-empty string stating the one-value own-rung rule (WD-6)', () => {
  const r = schema._doc.validation_rule;
  assert.strictEqual(typeof r, 'string');
  assert.ok(r.length > 0, 'validation_rule must be non-empty');
  assert.ok(/own/i.test(r) && /one/i.test(r), 'validation_rule must state the own-rung, exactly-one-value discipline');
});

check('_doc.default_on_miss is a non-empty string beginning with "reject"', () => {
  const d = schema._doc.default_on_miss;
  assert.strictEqual(typeof d, 'string');
  assert.ok(/^reject/.test(d), `default_on_miss must begin with "reject", got: ${d}`);
});

check('_doc.surface_count_principle is non-empty and carries no 2+ digit run', () => {
  const s = schema._doc.surface_count_principle;
  assert.strictEqual(typeof s, 'string');
  assert.ok(s.length > 0, 'surface_count_principle must be non-empty');
  assert.ok(!/\d{2,}/.test(s), `surface_count_principle must not freeze a multi-digit count, got: ${s}`);
});

check('_doc.classification_rubric is six ordered steps, first match wins, one terminal per vocabulary member', () => {
  const rubric = schema._doc.classification_rubric;
  assert.ok(Array.isArray(rubric), 'classification_rubric must be an array');
  assert.strictEqual(rubric.length, 6, `classification_rubric must have exactly 6 steps, found ${rubric.length}`);

  const expectedOrder = ['graph', 'loop', 'harness', 'context', 'prompt', 'none'];
  const seen = new Set();
  rubric.forEach((step, i) => {
    assert.ok(step && typeof step === 'object', `step ${i + 1} must be an object`);
    assert.ok(typeof step.signal === 'string' && step.signal.length > 0, `step ${i + 1} must carry a non-empty signal`);
    assert.ok(
      schema._doc.layer_vocabulary.includes(step.layer),
      `step ${i + 1}'s layer "${step.layer}" must be a member of layer_vocabulary`
    );
    assert.strictEqual(
      step.layer,
      expectedOrder[i],
      `step ${i + 1} must terminate in "${expectedOrder[i]}" (first match wins, widest scope first), got "${step.layer}"`
    );
    seen.add(step.layer);
  });
  assert.strictEqual(seen.size, 6, 'each of the six vocabulary members must appear exactly once across the rubric');
});

check('_doc.body_shape_vocabulary_note records the deferred body_shape census (WD-9)', () => {
  const n = schema._doc.body_shape_vocabulary_note;
  assert.strictEqual(typeof n, 'string');
  assert.ok(n.length > 0, 'body_shape_vocabulary_note must be non-empty');
  assert.ok(/defer/i.test(n), 'body_shape_vocabulary_note must state that normalization is deferred');
  assert.ok(/awk/i.test(n), 'body_shape_vocabulary_note must cite the awk command that produced the census');
});

check('_doc.declaration_homes states the markdown-frontmatter and MCP-connector twin (WD-7)', () => {
  const h = schema._doc.declaration_homes;
  assert.ok(Array.isArray(h) && h.length === 2, 'declaration_homes must be a two-row map');
});

check('_doc.purpose names this file, the gate, and the sibling shape schema', () => {
  const p = schema._doc.purpose;
  assert.strictEqual(typeof p, 'string');
  assert.ok(p.length > 0, 'purpose must be non-empty');
  assert.ok(/hitl-shape-declaration-schema/.test(p), 'purpose must cross-reference the sibling shape schema');
});

console.log('');
console.log(`${PASS} passed, ${FAIL} failed`);
process.exit(FAIL > 0 ? 1 : 0);
