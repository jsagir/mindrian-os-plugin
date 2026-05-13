/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 125-01 -- lib/core/navigation/projections.cjs test suite.
 *
 * Covers the 8 acceptance bullets from 125-CONTEXT.md "Projections" section
 * (D1 + D2 + D3) via 16 behaviors:
 *   resolveActiveFrameworks  (Tests 1-5)   D1 multi-signal precedence
 *   resolveHopDepth          (Tests 6-9)   D2 depth + rationale; default WIDE
 *   computeInvestmentLevel   (Tests 10-15) D3 linear gradient 0..1
 *   purity invariant         (Test 16)     all three helpers pure + idempotent
 *
 * Three-surface compatibility: pure CJS + node built-ins + node:test. No
 * surface-specific branches. No db / no fs / no Brain / no network.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const PROJECTIONS_PATH = path.resolve(__dirname, '..', 'core', 'navigation', 'projections.cjs');

function loadProjections() {
  delete require.cache[require.resolve(PROJECTIONS_PATH)];
  return require(PROJECTIONS_PATH);
}

// ----------- resolveActiveFrameworks (D1) -----------

test('Test 1: resolveActiveFrameworks({}) returns []', () => {
  const { resolveActiveFrameworks } = loadProjections();
  const out = resolveActiveFrameworks({});
  assert.ok(Array.isArray(out), 'returns an array');
  assert.strictEqual(out.length, 0, 'empty for empty roomState');
});

test('Test 1b: resolveActiveFrameworks(null/undefined) returns []', () => {
  const { resolveActiveFrameworks } = loadProjections();
  assert.deepStrictEqual(resolveActiveFrameworks(null), []);
  assert.deepStrictEqual(resolveActiveFrameworks(undefined), []);
  assert.deepStrictEqual(resolveActiveFrameworks('not-an-object'), []);
});

test('Test 2: resolveActiveFrameworks extracts Mullins 7 Domains from governing_thought', () => {
  const { resolveActiveFrameworks } = loadProjections();
  const out = resolveActiveFrameworks({
    governing_thought: 'Apply Mullins 7 Domains to validate market attractiveness',
  });
  assert.ok(out.length >= 1, 'at least one entry');
  const fw = out.find((x) => x.name === 'Mullins 7 Domains');
  assert.ok(fw, 'Mullins 7 Domains is present');
  assert.strictEqual(fw.source, 'governing_thought');
  assert.strictEqual(fw.weight, 1.0);
});

test('Test 3: resolveActiveFrameworks precedence -- governing_thought sorts first by weight', () => {
  const { resolveActiveFrameworks } = loadProjections();
  const out = resolveActiveFrameworks({
    governing_thought: 'Use SWOT to assess the position',
    activeJtbd: 'find-problem',
  });
  assert.ok(out.length >= 1);
  // First entry has the highest weight; governing_thought wins (1.0 > 0.75)
  assert.strictEqual(out[0].source, 'governing_thought');
  assert.strictEqual(out[0].weight, 1.0);
});

test('Test 4: resolveActiveFrameworks reads brainAnchors with source=brain_md weight 0.5', () => {
  const { resolveActiveFrameworks } = loadProjections();
  const out = resolveActiveFrameworks({
    brainAnchors: ['SWOT', 'Porter Five Forces'],
  });
  assert.strictEqual(out.length, 2);
  const names = out.map((x) => x.name).sort();
  assert.deepStrictEqual(names, ['Porter Five Forces', 'SWOT']);
  for (const e of out) {
    assert.strictEqual(e.source, 'brain_md');
    assert.strictEqual(e.weight, 0.5);
  }
});

test('Test 5: resolveActiveFrameworks 4-signal output ordered by weight desc', () => {
  const { resolveActiveFrameworks } = loadProjections();
  const out = resolveActiveFrameworks({
    governing_thought: 'Use SWOT to find white space',
    activeJtbd: 'find-problem',
    brainAnchors: ['Wardley Map'],
    recentFrameworks: ['Cynefin'],
  });
  // All 4 sources should appear (assuming activeJtbd resolves to *some* framework
  // and the registry is loadable; if it doesn't resolve, that signal silently
  // drops -- still strictly weight-desc ordered)
  // Weights monotonically descend.
  for (let i = 1; i < out.length; i++) {
    assert.ok(out[i - 1].weight >= out[i].weight,
      `weight at ${i-1} (${out[i-1].weight}) >= weight at ${i} (${out[i].weight})`);
  }
  // First entry is governing_thought (the highest weight, 1.0)
  assert.strictEqual(out[0].source, 'governing_thought');
  // Sources observed are a subset of the 4 canonical sources
  const allowed = new Set(['governing_thought', 'activeJtbd', 'brain_md', 'memory_event']);
  for (const e of out) {
    assert.ok(allowed.has(e.source), `unknown source ${e.source}`);
  }
});

// ----------- resolveHopDepth (D2) -----------

test('Test 6: resolveHopDepth({problemType: "WDP", governing_thought: "strong"}) returns depth 1', () => {
  const { resolveHopDepth } = loadProjections();
  const out = resolveHopDepth({ problemType: 'WDP', governing_thought: 'strong' });
  assert.strictEqual(out.depth, 1);
  assert.ok(typeof out.rationale === 'string' && out.rationale.length > 0);
  const r = out.rationale.toLowerCase();
  assert.ok(r.includes('well-defined') || r.includes('execution'),
    `rationale mentions well-defined or execution: "${out.rationale}"`);
});

test('Test 7: resolveHopDepth({problemType: "IDP"}) returns depth 2', () => {
  const { resolveHopDepth } = loadProjections();
  const out = resolveHopDepth({ problemType: 'IDP' });
  assert.strictEqual(out.depth, 2);
  assert.ok(typeof out.rationale === 'string' && out.rationale.length > 0);
  const r = out.rationale.toLowerCase();
  assert.ok(r.includes('ill-defined') || r.includes('evolving') || r.includes('exploratory'),
    `rationale mentions ill-defined / evolving / exploratory: "${out.rationale}"`);
});

test('Test 8: resolveHopDepth on unknown problemType returns depth 3 (default WIDE)', () => {
  const { resolveHopDepth } = loadProjections();
  const out = resolveHopDepth({ problemType: 'WDP-but-actually-unknown' });
  assert.strictEqual(out.depth, 3);
  assert.ok(typeof out.rationale === 'string' && out.rationale.length > 0);
  const r = out.rationale.toLowerCase();
  assert.ok(r.includes('wicked') || r.includes('no anchor') || r.includes('default') || r.includes('ambiguity'),
    `rationale mentions wicked / no anchor / default / ambiguity: "${out.rationale}"`);
});

test('Test 9: resolveHopDepth({}) returns {depth: 3, ...} (default WIDE on ambiguity per D2)', () => {
  const { resolveHopDepth } = loadProjections();
  const out = resolveHopDepth({});
  assert.strictEqual(out.depth, 3);
  assert.ok(typeof out.rationale === 'string' && out.rationale.length > 0);
});

test('Test 9b: resolveHopDepth(null/undefined) returns depth 3', () => {
  const { resolveHopDepth } = loadProjections();
  assert.strictEqual(resolveHopDepth(null).depth, 3);
  assert.strictEqual(resolveHopDepth(undefined).depth, 3);
  assert.strictEqual(resolveHopDepth('not-an-object').depth, 3);
});

// ----------- computeInvestmentLevel (D3) -----------

test('Test 10: computeInvestmentLevel({framework_invocations: 0}) returns level 0', () => {
  const { computeInvestmentLevel } = loadProjections();
  const out = computeInvestmentLevel({ framework_invocations: 0 });
  assert.strictEqual(out.level, 0);
  assert.ok(typeof out.label === 'string' && out.label.length > 0);
  assert.strictEqual(out.label, 'fresh room, ranking with Brain priors');
});

test('Test 11: computeInvestmentLevel({framework_invocations: 3}) returns level 0.3 label includes Brain', () => {
  const { computeInvestmentLevel } = loadProjections();
  const out = computeInvestmentLevel({ framework_invocations: 3 });
  assert.strictEqual(out.level, 0.3);
  assert.ok(typeof out.label === 'string' && out.label.length > 0);
  const l = out.label.toLowerCase();
  assert.ok(l.includes('brain') && (l.includes('local signal') || l.includes('local')),
    `label includes Brain and local signal: "${out.label}"`);
});

test('Test 12: computeInvestmentLevel({framework_invocations: 5}) returns level 0.5 balanced', () => {
  const { computeInvestmentLevel } = loadProjections();
  const out = computeInvestmentLevel({ framework_invocations: 5 });
  assert.strictEqual(out.level, 0.5);
  assert.ok(typeof out.label === 'string' && out.label.length > 0);
  assert.ok(out.label.toLowerCase().includes('balanced'),
    `label includes 'balanced': "${out.label}"`);
});

test('Test 13: computeInvestmentLevel({framework_invocations: 10}) returns level 1.0 full local', () => {
  const { computeInvestmentLevel } = loadProjections();
  const out = computeInvestmentLevel({ framework_invocations: 10 });
  assert.strictEqual(out.level, 1.0);
  assert.ok(typeof out.label === 'string' && out.label.length > 0);
  const l = out.label.toLowerCase();
  assert.ok(l.includes('full local') || l.includes('full'),
    `label includes 'full local' or 'full': "${out.label}"`);
});

test('Test 14: computeInvestmentLevel({framework_invocations: 15}) caps at 1.0', () => {
  const { computeInvestmentLevel } = loadProjections();
  const out = computeInvestmentLevel({ framework_invocations: 15 });
  assert.strictEqual(out.level, 1.0);
});

test('Test 15: computeInvestmentLevel({}) returns level 0 (cold-start with no counter)', () => {
  const { computeInvestmentLevel } = loadProjections();
  const out = computeInvestmentLevel({});
  assert.strictEqual(out.level, 0);
  assert.ok(typeof out.label === 'string' && out.label.length > 0);
});

test('Test 15b: computeInvestmentLevel(null/undefined) returns level 0', () => {
  const { computeInvestmentLevel } = loadProjections();
  assert.strictEqual(computeInvestmentLevel(null).level, 0);
  assert.strictEqual(computeInvestmentLevel(undefined).level, 0);
});

test('Test 15c: computeInvestmentLevel handles negative input by clamping to 0', () => {
  const { computeInvestmentLevel } = loadProjections();
  const out = computeInvestmentLevel({ framework_invocations: -3 });
  assert.strictEqual(out.level, 0);
});

// ----------- Purity invariant (Test 16) -----------

test('Test 16: All three functions are pure -- twice with identical input -> deepEqual result', () => {
  const { resolveActiveFrameworks, resolveHopDepth, computeInvestmentLevel } = loadProjections();
  const roomState = {
    problemType: 'IDP',
    governing_thought: 'Use SWOT to assess the venture',
    activeJtbd: 'find-problem',
    brainAnchors: ['Porter Five Forces', 'Wardley Map'],
    recentFrameworks: ['Cynefin'],
    framework_invocations: 4,
  };
  const a1 = resolveActiveFrameworks(roomState);
  const a2 = resolveActiveFrameworks(roomState);
  assert.deepStrictEqual(a1, a2, 'resolveActiveFrameworks is pure');

  const h1 = resolveHopDepth(roomState);
  const h2 = resolveHopDepth(roomState);
  assert.deepStrictEqual(h1, h2, 'resolveHopDepth is pure');

  const c1 = computeInvestmentLevel(roomState);
  const c2 = computeInvestmentLevel(roomState);
  assert.deepStrictEqual(c1, c2, 'computeInvestmentLevel is pure');
});
