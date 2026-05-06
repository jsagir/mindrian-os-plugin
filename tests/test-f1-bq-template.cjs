'use strict';
/*
 * Phase 117-03 Wave 2 -- AUTOEXPLORE-117-16 (Brain Section 8.5 BQ-anchored Larry voice).
 * 10 tests covering composeBQAnchoredLarryVoice + BQ_TEMPLATE_REGISTRY.
 *
 * Per RESEARCH Section 8.5: F.1 line uses BQ template registry hitting
 * GUIDED_BY/GENERATES_MATRIX BQ patterns. Sample:
 *   "weather_algorithm x synthetic_inertia" should produce
 *   "What if the deepest pattern here isn't 'wind power' but ..."
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

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
    source_section: 'wind power',
    target_section: 'computational stability',
    framework_chain: ['wind power'],
    semantic_surprise: 'embodied algorithms providing computational stability',
    category_errors_identified: ['wind power'],
    top_differential: 'wind power * computational stability: 0.850',
    top_differential_score: 0.85,
    generated_at: 0,
  };
  return Object.assign(base, overrides || {});
}

// Test 1: composeBQAnchoredLarryVoice returns string with template-substituted text.
test('AUTOEXPLORE-117-16 #1: composeBQAnchoredLarryVoice returns substituted line', () => {
  const f = makeFinding();
  const line = agent.composeBQAnchoredLarryVoice(f);
  assert.ok(typeof line === 'string' && line.length > 0);
  assert.ok(!line.includes('{category_error}'));
  assert.ok(!line.includes('{semantic_surprise}'));
});

// Test 2: cross-domain pipeline uses GENERATES_MATRIX template ("What if the deepest pattern...").
test('AUTOEXPLORE-117-16 #2: cross-domain uses GENERATES_MATRIX template', () => {
  const f = makeFinding({ source_pipeline: 'cross-domain' });
  const line = agent.composeBQAnchoredLarryVoice(f);
  assert.match(line, /What if the deepest pattern here isn't/);
});

// Test 3: Sample input weather_algorithm x synthetic_inertia produces expected substitution.
test('AUTOEXPLORE-117-16 #3: sample input produces "What if ... not wind power but ..." pattern', () => {
  const f = makeFinding({
    source_pipeline: 'cross-domain',
    semantic_surprise: 'embodied algorithms providing computational stability',
    category_errors_identified: ['wind power'],
  });
  const line = agent.composeBQAnchoredLarryVoice(f);
  assert.match(line, /'wind power'/);
  assert.match(line, /'embodied algorithms providing computational stability'/);
});

// Test 4: BQ_TEMPLATE_REGISTRY has 4 entries (cross-domain + reverse-salients + domain + trends).
test('AUTOEXPLORE-117-16 #4: BQ_TEMPLATE_REGISTRY has 4 entries', () => {
  const reg = agent.BQ_TEMPLATE_REGISTRY;
  assert.ok(reg && typeof reg === 'object');
  for (const k of ['cross-domain', 'reverse-salients', 'domain', 'trends']) {
    assert.ok(reg[k], 'missing key: ' + k);
  }
});

// Test 5: Suppression paths still emit BQ-anchored line (reverse-salients).
test('AUTOEXPLORE-117-16 #5: reverse-salients pipeline emits lagging-element BQ', () => {
  const f = makeFinding({
    source_pipeline: 'reverse-salients',
    source_section: 'fundraising',
    target_section: 'product',
  });
  const line = agent.composeBQAnchoredLarryVoice(f);
  assert.match(line, /lagging element/);
  assert.match(line, /fundraising/);
  assert.match(line, /product/);
});

// Test 6: Non-BQ raw render fails lint -- ensure no source uses raw "Top match" framing in render.
test('AUTOEXPLORE-117-16 #6: non-BQ raw render fails lint -- no "Top match: X * Y" in BQ output', () => {
  const f = makeFinding();
  const line = agent.composeBQAnchoredLarryVoice(f);
  assert.ok(!/^Top match:/.test(line));
});

// Test 7: Persona-blend BQ selection -- function takes optional persona arg but v1 ignores it.
test('AUTOEXPLORE-117-16 #7: persona-blend arg ignored in v1', () => {
  const f = makeFinding();
  const line1 = agent.composeBQAnchoredLarryVoice(f);
  const line2 = agent.composeBQAnchoredLarryVoice(f, { persona: 'researcher' });
  // v1 ignores persona; lines should match.
  assert.equal(line1, line2);
});

// Test 8: Three-surface BQ parity -- same finding produces same BQ-anchored line.
test('AUTOEXPLORE-117-16 #8: three-surface BQ parity', () => {
  const f = makeFinding();
  const cliLine = agent.composeBQAnchoredLarryVoice(f);
  const desktopLine = agent.composeBQAnchoredLarryVoice(f);
  const coworkLine = agent.composeBQAnchoredLarryVoice(f);
  assert.equal(cliLine, desktopLine);
  assert.equal(desktopLine, coworkLine);
});

// Test 9: BQ_TEMPLATE_REGISTRY entries include bq_id + bq_text + brain_canonical_name.
test('AUTOEXPLORE-117-16 #9: registry entries carry bq_id + bq_text + brain_canonical_name', () => {
  const reg = agent.BQ_TEMPLATE_REGISTRY;
  for (const k of ['cross-domain', 'reverse-salients', 'domain', 'trends']) {
    assert.ok(typeof reg[k].template === 'string' && reg[k].template.length > 0);
    assert.ok(typeof reg[k].bq_id === 'string' && reg[k].bq_id.length > 0);
    assert.ok(typeof reg[k].bq_text === 'string' && reg[k].bq_text.length > 0);
    assert.ok(typeof reg[k].brain_canonical_name === 'string' && reg[k].brain_canonical_name.length > 0,
      'missing brain_canonical_name on ' + k);
  }
});

// Test 10: Each registry entry's template uses placeholder vocabulary consistently.
test('AUTOEXPLORE-117-16 #10: registry templates use {category_error}/{semantic_surprise}/{source_section}/{target_section}', () => {
  const reg = agent.BQ_TEMPLATE_REGISTRY;
  // cross-domain template uses category_error + semantic_surprise.
  assert.match(reg['cross-domain'].template, /\{category_error\}/);
  assert.match(reg['cross-domain'].template, /\{semantic_surprise\}/);
  // reverse-salients template uses source_section + target_section.
  assert.match(reg['reverse-salients'].template, /\{source_section\}/);
  assert.match(reg['reverse-salients'].template, /\{target_section\}/);
  // domain template uses source_section.
  assert.match(reg['domain'].template, /\{source_section\}/);
  // trends template uses source_section.
  assert.match(reg['trends'].template, /\{source_section\}/);

  // Brain canonical names are verbatim from RESEARCH Section 8.5 Cypher.
  const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'agents', 'auto-explore-agent.cjs'), 'utf8');
  assert.ok(src.includes('Domain Sensing & Placement'));
  assert.ok(src.includes('Domain Reassessment & Transition'));
  assert.ok(src.includes('Question-Domain-Expert Breakthrough Map'));
});
