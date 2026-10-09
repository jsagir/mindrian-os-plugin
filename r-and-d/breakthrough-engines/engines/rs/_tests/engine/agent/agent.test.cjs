'use strict';
// Run: node --test rs/_tests/engine/agent/agent.test.cjs   (from package-2026/)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const PKG = path.resolve(__dirname, '..', '..', '..', '..');
const ENGINE_DIR = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-agent-'));
const tree = path.join(tmp, 'tree');

// Build the python tree (engine + lib/core + stubs) with the shared helper.
const mk = spawnSync('python3', ['-I', '-c', `
import sys; sys.dont_write_bytecode=True; sys.path.insert(0, ${JSON.stringify(ENGINE_DIR)})
import make_tree, synth
e, real = make_tree.build(${JSON.stringify(tree)}, ${JSON.stringify(path.join(PKG, 'rs/shared/scripts/rs-engine.py'))}, ${JSON.stringify(PKG)})
synth.make_corpus(${JSON.stringify(path.join(tmp, 'room'))})
print(real)`], { encoding: 'utf8', env: Object.assign({}, process.env, { PYTHONDONTWRITEBYTECODE: '1' }) });
assert.equal(mk.status, 0, mk.stderr);
const realMath = mk.stdout.trim();

fs.mkdirSync(path.join(tree, 'lib', 'agents'), { recursive: true });
fs.copyFileSync(path.join(PKG, 'rs/shared/lib/agents/reverse-salient-agent.cjs'), path.join(tree, 'lib/agents/reverse-salient-agent.cjs'));
require('./agent_stubs.cjs')(path.join(tree, 'lib'));
const agent = require(path.join(tree, 'lib/agents/reverse-salient-agent.cjs'));
const room = path.join(tmp, 'room');

process.env.PYTHONDONTWRITEBYTECODE = '1';
process.env.RS_REAL_MATH = realMath;
process.env.RS_EMBEDDING_MODEL = 'hashing';
process.env.TEST_BACKEND = 'python';

test('mapDirectionToCascadeEdge unchanged', () => {
  assert.equal(agent.mapDirectionToCascadeEdge('structural_transfer', 0.5), 'INFORMS');
  assert.equal(agent.mapDirectionToCascadeEdge('structural_transfer', -0.9), 'ENABLES');
  assert.equal(agent.mapDirectionToCascadeEdge('semantic_implementation', 0.2), 'CONVERGES');
  assert.equal(agent.mapDirectionToCascadeEdge('semantic_implementation', 0.8), 'INVALIDATES');
  assert.equal(agent.mapDirectionToCascadeEdge('blindspot', 0), 'CONTRADICTS');
  assert.equal(agent.mapDirectionToCascadeEdge('???', 9), 'INFORMS');
});

test('normalizePair prefers raw-scale values and keeps legacy output', () => {
  const n = agent._internal.normalizePair({ signed_diff: 3.1, abs_diff: 3.1, raw_signed_diff: 0.4, raw_abs_diff: 0.4, direction: 'structural_transfer' });
  assert.equal(n.signed_diff, 0.4); assert.equal(n.abs_diff, 0.4);
  const o = agent._internal.normalizePair({ signed_delta: -0.2, abs_diff: 0.2, innovation_type: 'semantic_implementation' });
  assert.equal(o.signed_diff, -0.2); assert.equal(o.direction, 'semantic_implementation');
  assert.doesNotThrow(() => agent._internal.normalizePair(null));
});

test('python backend end to end against the 2026 engine', async () => {
  const rs = await agent.runRsEngine({ roomDir: room, mode: 'internal', topk: 5 });
  assert.equal(rs.ok, true, JSON.stringify(rs));
  assert.ok(rs.pairs.length > 0);
  for (const p of rs.pairs) assert.ok(Math.abs(p.signed_diff) <= 1.0, 'cascade mapping must see the raw scale, got ' + p.signed_diff);
  assert.ok(rs.pairs[0].verification && rs.pairs[0].verification.source_trail.length === 2);
  assert.equal(rs.metadata.scoring, 'hybrid');
});

test('detectAndSurface carries evidence as data and keeps the render scalar-free', async () => {
  const out = await agent.detectAndSurface({ roomDir: room, mode: 'internal', topk: 2 });
  assert.equal(out.ok, true);
  const f = out.findings[0];
  assert.ok(f.verification && f.verification.second_signal);
  const lines = agent.renderBottleneckFinding(f, f.stamp);
  assert.ok(!lines.join('\n').includes(f.verification.source_trail[0].extracted_sentence || '\u0000'));
});

test('threshold, topic, scoring and output are forwarded on the python path', async () => {
  const fake = path.join(tmp, 'fake-python.sh');
  fs.writeFileSync(fake, '#!/bin/sh\necho "$@" > "' + path.join(tmp, 'args.txt') + '"\n');
  fs.chmodSync(fake, 0o755);
  process.env.MINDRIAN_PYTHON = fake;
  try {
    await agent.runRsEngine({ roomDir: room, mode: 'external', topk: 3, threshold: 0.25, topic: 'x y', scoring: 'legacy' });
  } finally { delete process.env.MINDRIAN_PYTHON; }
  const args = fs.readFileSync(path.join(tmp, 'args.txt'), 'utf8');
  for (const needle of ['--mode external', '--topk 3', '--threshold 0.25', '--topic x y', '--scoring legacy', '--output']) assert.ok(args.includes(needle), needle + ' missing in: ' + args);
});

test('stale results from a previous run are not surfaced', async () => {
  const r2 = path.join(tmp, 'room-stale'); fs.mkdirSync(r2, { recursive: true });
  const rf = path.join(r2, '.rs-engine-results.json');
  fs.writeFileSync(rf, JSON.stringify({ pairs: [{ source_artifact_id: 'a', target_artifact_id: 'b', direction: 'structural_transfer', signed_diff: 0.1 }] }));
  const old = new Date(Date.now() - 3600 * 1000); fs.utimesSync(rf, old, old);
  process.env.MINDRIAN_PYTHON = '/bin/true';
  try {
    const rs = await agent.runRsEngine({ roomDir: r2, mode: 'internal' });
    assert.equal(rs.ok, false); assert.equal(rs.reason, 'rs_engine_results_stale');
  } finally { delete process.env.MINDRIAN_PYTHON; }
});

test('engine timeout is configurable', async () => {
  const slow = path.join(tmp, 'slow.sh'); fs.writeFileSync(slow, '#!/bin/sh\nsleep 5\n'); fs.chmodSync(slow, 0o755);
  process.env.MINDRIAN_PYTHON = slow; process.env.RS_ENGINE_TIMEOUT_MS = '300';
  const t0 = Date.now();
  try {
    const rs = await agent.runRsEngine({ roomDir: room, mode: 'internal' });
    assert.equal(rs.ok, false); assert.equal(rs.reason, 'rs_engine_invocation_failed');
    assert.ok(Date.now() - t0 < 3000);
  } finally { delete process.env.MINDRIAN_PYTHON; delete process.env.RS_ENGINE_TIMEOUT_MS; }
});

test('rsEndpoints refuses ids that escape the room', () => {
  fs.writeFileSync(path.join(tmp, 'outside.md'), 'SECRET framework: leaked');
  const e = agent.rsEndpoints({ source_artifact_id: '../outside', source_title: 'T1', target_artifact_id: 'alpha/alpha-note-00', target_title: 'T2' }, room);
  assert.equal(e.fromTitle, 'T1');
  assert.equal(agent._internal.resolveInside(room, '../outside.md'), null);
  assert.ok(agent._internal.resolveInside(room, 'alpha/alpha-note-00.md'));
});

test('invalid room dir and parse failure contracts', async () => {
  assert.deepEqual(await agent.runRsEngine({ roomDir: '' }), { ok: false, reason: 'invalid_room_dir', pairs: [] });
  const r3 = path.join(tmp, 'room-bad'); fs.mkdirSync(r3, { recursive: true });
  fs.writeFileSync(path.join(r3, '.rs-engine-results.json'), '{not json');
  process.env.MINDRIAN_PYTHON = '/bin/true';
  try { assert.equal((await agent.runRsEngine({ roomDir: r3 })).reason, 'rs_engine_results_parse_failed'); }
  finally { delete process.env.MINDRIAN_PYTHON; }
});

test('no em dash in the shipped agent file', () => {
  const txt = fs.readFileSync(path.join(PKG, 'rs/shared/lib/agents/reverse-salient-agent.cjs'), 'utf8');
  assert.ok(!txt.includes('\u2014'));
});

test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
