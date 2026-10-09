'use strict';
// Tests for rs-expert-brain-projection.cjs with a HAND-MADE guard stub and
// injected readers. No Brain is contacted.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { stage } = require('./_harness.cjs');

const root = stage(['rs-experts/lib/core/rs-expert-brain-projection.cjs']);
const proj = require(path.join(root, 'lib/core/rs-expert-brain-projection.cjs'));
const allow = () => ({ verdict: 'allow' });
const NODE = { name: 'Ada Lovelace', institution: 'Analytical Engine Co', orcid: '0000-0001-2345-6789', framework: 'Jobs To Be Done', domain: 'healthcare' };
const reader = (rows) => async () => rows;

test('compat: projectExpertHandles returns the same string[] and never sends person bytes', async () => {
  let sent = null;
  const out = await proj.projectExpertHandles(NODE, {
    brainAvailable: true, classify: allow, onOutbound: (p) => { sent = p; },
    brainReader: reader([{ metadata: { framework_name: 'Lean Canvas' } }, { metadata: { framework: 'Lean Canvas' } }, { framework: 'Six Hats' }]),
  });
  assert.deepEqual(out, ['Lean Canvas', 'Six Hats']);
  const q = sent.question.toLowerCase();
  for (const bad of ['ada', 'lovelace', 'analytical', 'engine', '0000-0001']) assert.ok(!q.includes(bad), bad);
  assert.match(q, /jobs to be done/);
});

test('detailed: degrade reasons are explicit and carry no person bytes', async () => {
  const d = (node, o) => proj.projectExpertHandlesDetailed(node, Object.assign({ classify: allow, brainAvailable: true }, o));
  assert.equal((await d(NODE, { brainAvailable: false })).degraded_reason, 'no_brain');
  assert.equal((await d(null, {})).degraded_reason, 'invalid_node');
  assert.equal((await d({ name: 'X Y' }, {})).degraded_reason, 'no_generic_handles');
  assert.equal((await d(NODE, { classify: () => { throw new Error('x'); } })).degraded_reason, 'guard_threw');
  assert.equal((await d(NODE, { classify: () => ({ verdict: 'block' }) })).degraded_reason, 'guard_blocked');
  assert.equal((await d(NODE, { brainReader: async () => { throw new Error('net'); } })).degraded_reason, 'reader_threw');
  assert.equal((await d(NODE, { brainReader: async () => 'str' })).degraded_reason, 'reader_not_array');
  const none = await d(NODE, { brainReader: reader([{ metadata: { framework: 'Ada Lovelace Method' } }]) });
  assert.equal(none.degraded_reason, 'no_generic_inbound'); assert.equal(none.inbound_dropped, 1);
  const ok = await d(NODE, { brainReader: reader([{ metadata: { framework: 'Lean Canvas' } }]) });
  assert.equal(ok.degraded_reason, null); assert.equal(ok.guard_verdict, 'allow'); assert.equal(ok.outbound_handle_count, 2);
  assert.ok(!JSON.stringify(ok).toLowerCase().includes('lovelace'));
});

test('outbound leak scan fails closed when a whitelisted value echoes a person token', async () => {
  const node = { name: 'Discovery Smith', framework: 'smith method' };
  const r = await proj.projectExpertHandlesDetailed(node, { brainAvailable: true, classify: allow, brainReader: reader([{ framework: 'X' }]) });
  assert.deepEqual(r.handles, []); assert.equal(r.degraded_reason, 'no_generic_handles');
});

test('fixed methodology vocabulary colliding with a person token blocks the whole projection', async () => {
  const r = await proj.projectExpertHandlesDetailed({ name: 'Discovery', framework: 'lean' }, { brainAvailable: true, classify: allow, brainReader: reader([{ framework: 'X' }]) });
  assert.equal(r.degraded_reason, 'outbound_leak_blocked'); assert.deepEqual(r.handles, []);
});

test('Unicode person tokens are collected (Hebrew, accents) for the leak scan', () => {
  const n = proj._collectPersonBytes({ name: 'יונתן שגיר', institution: { display_name: 'Universität Zürich' } });
  assert.ok(n.includes('יונתן') && n.includes('שגיר'));
  assert.ok(n.includes('universität') && n.includes('zürich'));
  // a Hebrew surname echoed in an inbound handle is dropped
  assert.deepEqual(proj._extractGenericHandles([{ framework: 'שגיר method' }, { framework: 'Lean Canvas' }], n), ['Lean Canvas']);
});

test('inbound shape validation: addresses, URLs, markup dropped; limit clamped', async () => {
  const rows = [{ framework: 'mail me@x.org' }, { framework: 'see https://x.y' }, { framework: '<b>bold</b>' }, { framework: 'www.evil.test' }, { framework: 'Real Framework' }];
  assert.deepEqual(proj._extractGenericHandles(rows, []), ['Real Framework']);
  let seen;
  await proj.projectExpertHandles(NODE, { brainAvailable: true, classify: allow, limit: 100000, brainReader: async (_p, o) => { seen = o.limit; return []; } });
  assert.equal(seen, 200);
  await proj.projectExpertHandles(NODE, { brainAvailable: true, classify: allow, limit: -5, brainReader: async (_p, o) => { seen = o.limit; return []; } });
  assert.equal(seen, 1);
});

test('never throws on hostile inputs', async () => {
  for (const node of [undefined, null, 5, 'x', [], { framework: 5 }, { framework: '$$$' }]) {
    assert.deepEqual(await proj.projectExpertHandles(node, { brainAvailable: true, classify: allow }), []);
  }
});
