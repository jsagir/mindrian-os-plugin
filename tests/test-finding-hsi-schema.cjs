'use strict';
/*
 * Phase 117-03 Wave 2 -- AUTOEXPLORE-117-15 (Brain Section 8.4 HSIAnalysis schema).
 * 8 tests covering populateHSIAnalysis fields + RECOMMENDED gate at >= 0.7.
 *
 * Per RESEARCH Section 8.4: finding shape extends HSIAnalysis with
 *   top_differential / semantic_surprise / category_errors_identified / top_differential_score
 * F.1 RECOMMENDED gate at >= 0.7 mirrors Phase 88.2 invariant.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const agent = require('../lib/agents/auto-explore-agent.cjs');

function makeFinding(overrides) {
  const base = {
    id: 'a'.repeat(32),
    material_id: 'b'.repeat(32),
    source_pipeline: 'cross-domain',
    source_node_id: 'src',
    target_node_id: 'tgt',
    score: 0.85,
    candidate_count: 1,
    candidates_per_pipeline: { 'domain': 0, 'trends': 0, 'reverse-salients': 0, 'cross-domain': 1 },
    top_differential: null,
    semantic_surprise: null,
    category_errors_identified: [],
    top_differential_score: null,
    source_section: 'wind power',
    target_section: 'computational stability',
    framework_chain: ['wind power'],
    generated_at: 0,
  };
  return Object.assign(base, overrides || {});
}

// Test 1: top_differential field non-null after populate.
test('AUTOEXPLORE-117-15 #1: top_differential field populated as non-null string', () => {
  const f = agent.populateHSIAnalysis(makeFinding({ score: 0.85 }));
  assert.ok(typeof f.top_differential === 'string' && f.top_differential.length > 0);
  // Should encode source * target * score
  assert.match(f.top_differential, /wind power/);
  assert.match(f.top_differential, /computational stability/);
});

// Test 2: semantic_surprise field populated as one-line reframe.
test('AUTOEXPLORE-117-15 #2: semantic_surprise populated as one-line reframe', () => {
  const f = agent.populateHSIAnalysis(makeFinding({ source_pipeline: 'cross-domain' }));
  assert.ok(typeof f.semantic_surprise === 'string' && f.semantic_surprise.length > 0);
  assert.match(f.semantic_surprise, /analogy|cross|domain/i);
});

// Test 3: category_errors_identified is array.
test('AUTOEXPLORE-117-15 #3: category_errors_identified is array<string>', () => {
  const f = agent.populateHSIAnalysis(makeFinding({ framework_chain: ['wind power', 'spinning blade'] }));
  assert.ok(Array.isArray(f.category_errors_identified));
  assert.equal(f.category_errors_identified.length, 2);
  assert.equal(f.category_errors_identified[0], 'wind power');
});

// Test 4: top_differential_score numeric in [0,1].
test('AUTOEXPLORE-117-15 #4: top_differential_score numeric in [0,1]', () => {
  const f1 = agent.populateHSIAnalysis(makeFinding({ score: 0.85 }));
  assert.ok(typeof f1.top_differential_score === 'number');
  assert.ok(f1.top_differential_score >= 0 && f1.top_differential_score <= 1);
  // Out-of-range score gets clamped.
  const f2 = agent.populateHSIAnalysis(makeFinding({ score: 1.5 }));
  assert.equal(f2.top_differential_score, 1);
  const f3 = agent.populateHSIAnalysis(makeFinding({ score: -0.1 }));
  assert.equal(f3.top_differential_score, 0);
});

// Test 5: F.1 RECOMMENDED gate fires only at top_differential_score >= 0.7 (W6 atomic re-persist + on-disk verification).
test('AUTOEXPLORE-117-15 #5: RECOMMENDED gate at >= 0.7 with W6 atomic re-persist on disk', () => {
  const dir = path.join(os.tmpdir(), 'mindrian-117-03-hsi-' + crypto.randomBytes(6).toString('hex'));
  fs.mkdirSync(path.join(dir, '.mindrian'), { recursive: true });
  try {
    const finding = makeFinding({ score: 0.85, material_id: 'c'.repeat(32) });
    const result = agent.surfaceFinding({
      finding: finding,
      roomDir: dir,
      operator: 'AUTONOMOUS',
      tier: 1,
    });
    assert.equal(result.surfaced, true);
    // W6: verify on-disk JSON contains populated fields, not nulls.
    const jsonPath = path.join(dir, '.mindrian', 'auto-explore-' + 'c'.repeat(32) + '.json');
    assert.ok(fs.existsSync(jsonPath), 'expected on-disk auto-explore JSON');
    const onDisk = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    assert.equal(typeof onDisk.top_differential_score, 'number');
    assert.notEqual(onDisk.top_differential_score, null);
    assert.ok(onDisk.top_differential_score >= 0.7);
    assert.ok(typeof onDisk.top_differential === 'string');
    assert.ok(typeof onDisk.semantic_surprise === 'string');
    assert.ok(Array.isArray(onDisk.category_errors_identified));
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_e) {}
  }
});

// Test 6: HSIAnalysis-shape lint -- all 4 fields present in returned shape.
test('AUTOEXPLORE-117-15 #6: HSIAnalysis-shape lint -- all 4 fields present', () => {
  const f = agent.populateHSIAnalysis(makeFinding());
  for (const k of ['top_differential', 'semantic_surprise', 'category_errors_identified', 'top_differential_score']) {
    assert.ok(f[k] !== undefined, 'expected field: ' + k);
  }
});

// Test 7: Backward-compat with Section 5 finding shape -- id + material_id + source_pipeline still present.
test('AUTOEXPLORE-117-15 #7: backward-compat with Section 5 finding shape', () => {
  const f = agent.populateHSIAnalysis(makeFinding());
  assert.ok(typeof f.id === 'string');
  assert.ok(typeof f.material_id === 'string');
  assert.ok(typeof f.source_pipeline === 'string');
  assert.ok(typeof f.source_node_id === 'string');
  assert.ok(typeof f.target_node_id === 'string');
});

// Test 8: Extension fields documented inline (Brain Section 8.4 citation present in source).
test('AUTOEXPLORE-117-15 #8: HSIAnalysis citation present in source', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'agents', 'auto-explore-agent.cjs'), 'utf8');
  assert.match(src, /Brain Section 8\.4.*HSIAnalysis|HSIAnalysis.*Brain Section 8\.4/);
});
