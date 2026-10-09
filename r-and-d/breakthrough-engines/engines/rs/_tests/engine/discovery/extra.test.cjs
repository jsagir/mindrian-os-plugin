'use strict';
// Run: node --test rs/_tests/engine/discovery/extra.test.cjs   (from package-2026/)
const test = require('node:test'); const assert = require('node:assert/strict');
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
const pkg = path.resolve(__dirname, '..', '..', '..', '..');
const tree = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-disc-x-'));
require('./build_tree.cjs')(tree, pkg);
const eng = require(path.join(tree, 'scripts/rs-discovery-engine.cjs'));
const { ExternalEgressViolation } = require(path.join(tree, 'lib/core/rs-egress-violations.cjs'));
const base = () => ({
  chainFeeder: { lookupUpstream: async () => ({ state: 'ready' }), emitChainMetadata: (t, s) => ({ rs_type: t, score: s }) },
  fetchCorpus: async () => [], researchCache: { getCached: () => null, putCached: () => {} },
  preprocessor: { preprocess: () => [{ id: 'a', abstract: 'A reasonably long sentence about caching methods here.', methods: ['caching'], source: 'academic' }] },
  sqliteMirror: { writeDiscovery: async () => ({ wrote_node_count: 1 }) },
});

test('ExternalEgressViolation from a scorer bubbles instead of being recorded as an item error', async () => {
  const m = base(); m.differentialScorer = { score: async () => { throw new ExternalEgressViolation('blocked by audit'); } };
  await assert.rejects(eng.runDiscovery('t', { tier: 'tier0', room_dir: tree, _test_mocks: m }), (e) => e.name === 'ExternalEgressViolation');
});

test('input audit still runs first', async () => {
  await assert.rejects(eng.runDiscovery('FORBIDDEN_TEST_PATTERN', { tier: 'tier0', room_dir: tree, _test_mocks: base() }), (e) => e.name === 'ExternalEgressViolation');
});

test('empty discovery: chain_metadata uses classification none; verification and provenance present', async () => {
  const m = base(); m.preprocessor = { preprocess: () => [] };
  const b = await eng.runDiscovery('t', { tier: 'tier0', room_dir: tree, _test_mocks: m });
  assert.equal(b.chain_metadata.length, 1); assert.equal(b.chain_metadata[0].rs_type, 'none');
  assert.deepEqual(b.verification, []); assert.equal(b.provenance.written_index, -1);
  for (const k of ['topic', 'domain_analysis', 'query_matrix', 'fetched_results', 'preprocessed', 'scored', 'classified', 'breakthroughs', 'theses', 'commercial', 'output', 'chain_metadata']) assert.ok(k in b, k);
});

test('selectWriteIndex ties and missing scores resolve to index 0', () => {
  const s = eng._test.selectWriteIndex;
  assert.equal(s([{}, {}, {}]), 0); assert.equal(s([]), -1);
  assert.equal(s([{ breakthrough: { score: 0.5 } }, { breakthrough: { score: 0.5 } }]), 0);
  assert.equal(s([{ breakthrough: { score: 0.1 } }, { breakthrough: { score: NaN } }, { breakthrough: { score: 0.3 } }]), 2);
});

test('no em dash', () => { assert.ok(!fs.readFileSync(path.join(pkg, 'rs/shared/scripts/rs-discovery-engine.cjs'), 'utf8').includes('\u2014')); });
test.after(() => fs.rmSync(tree, { recursive: true, force: true }));
