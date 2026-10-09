'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { load } = require('./harness.cjs');

const N = load('new', 'ahp-weights').mod;
const O = load('orig', 'ahp-weights').mod;

// ---- AHP ----
test('ahp: consistent matrix gives exact weights, CR 0, sum 1', () => {
  // criteria 1 : 2 : 4 -> weights 1/7, 2/7, 4/7
  const m = [[1, 0.5, 0.25], [2, 1, 0.5], [4, 2, 1]];
  const r = N.computeAhpWeights(m);
  assert.ok(Math.abs(r.weights[0] - 1 / 7) < 1e-12);
  assert.ok(Math.abs(r.weights[2] - 4 / 7) < 1e-12);
  assert.ok(Math.abs(r.weights.reduce((a, b) => a + b, 0) - 1) < 1e-12);
  assert.ok(r.cr < 1e-9 && r.consistent === true);
  assert.strictEqual(r.method, 'geometric-mean');
});
test('ahp: Saaty textbook inconsistent matrix is rejected by CR > 0.1', () => {
  // 1 vs 2 = 9, 2 vs 3 = 9, but 1 vs 3 = 1/9 : wildly intransitive
  const m = [[1, 9, 1 / 9], [1 / 9, 1, 9], [9, 1 / 9, 1]];
  const r = N.computeAhpWeights(m);
  assert.ok(r.cr > 0.1 && r.consistent === false, 'cr=' + r.cr);
});
test('ahp: lambdaMax >= n always (CI never negative)', () => {
  const r = N.computeAhpWeights([[1, 3, 5], [1 / 3, 1, 2], [1 / 5, 1 / 2, 1]]);
  assert.ok(r.lambdaMax >= 3 - 1e-12 && r.ci >= 0);
  assert.ok(r.cr < 0.1);
});
test('ahp: non-reciprocal and non-positive matrices still rejected', () => {
  assert.throws(() => N.computeAhpWeights([[1, 3, 1], [3, 1, 1], [1, 1, 1]]), /AHP_RECIPROCITY/);
  assert.throws(() => N.computeAhpWeights([[1, 0, 1], [1, 1, 1], [1, 1, 1]]), /AHP_MATRIX_POSITIVE/);
  assert.throws(() => N.computeAhpWeights([[1, 2], [0.5, 1]]), /AHP_MATRIX_SHAPE/);
});
test('ahp: BUG(orig) hand-rounded reciprocal 0.333 rejected by orig, accepted by new', () => {
  const m = [[1, 3, 3], [0.333, 1, 1], [0.333, 1, 1]];
  assert.throws(() => O.computeAhpWeights(m), /AHP_RECIPROCITY/);
  const r = N.computeAhpWeights(m);
  assert.ok(Math.abs(r.weights.reduce((a, b) => a + b, 0) - 1) < 1e-12);
});
test('ahp: out_of_scale flag for judgments beyond 1/9..9', () => {
  assert.strictEqual(N.computeAhpWeights([[1, 2, 3], [0.5, 1, 1.5], [1 / 3, 2 / 3, 1]]).out_of_scale, false);
  assert.strictEqual(N.computeAhpWeights([[1, 20, 20], [1 / 20, 1, 1], [1 / 20, 1, 1]]).out_of_scale, true);
});
test('ahp: BUG(orig) composeScore can exceed 1 by float error; new clamps', () => {
  const m = [[1, 1.1428571428571428, 1], [0.875, 1, 1.1429714285714285], [1, 0.8749125087491251, 1]];
  const d = { strategic_fit: 1, validated_demand: 1, tech_econ_feasibility: 1 };
  const w = O.computeAhpWeights(m).weights;
  assert.ok(O.composeScore(d, w) > 1, 'orig score ' + O.composeScore(d, w));
  assert.strictEqual(N.composeScore(d, N.computeAhpWeights(m).weights), 1);
});
test('ahp: composeScore rejects NaN / negative weights (orig returned NaN)', () => {
  const d = { strategic_fit: 0.5, validated_demand: 0.5, tech_econ_feasibility: 0.5 };
  assert.ok(Number.isNaN(O.composeScore(d, [NaN, 0.5, 0.5])));
  assert.throws(() => N.composeScore(d, [NaN, 0.5, 0.5]), /DIM_RANGE/);
  assert.throws(() => N.composeScore(d, [-0.1, 0.6, 0.5]), /DIM_RANGE/);
  assert.throws(() => N.composeScore({ strategic_fit: 2, validated_demand: 0, tech_econ_feasibility: 0 }, [1 / 3, 1 / 3, 1 / 3]), /DIM_RANGE/);
});
test('ahp: loadAhpConfig good, inconsistent, bad json, bad criteria', () => {
  const tmp = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'ahp-'));
  const w = (n, o) => { const p = path.join(tmp, n); fs.writeFileSync(p, typeof o === 'string' ? o : JSON.stringify(o)); return p; };
  const crit = ['strategic_fit', 'validated_demand', 'tech_econ_feasibility'];
  const good = N.loadAhpConfig(w('g.json', { criteria: crit, matrix: [[1, 2, 2], [0.5, 1, 1], [0.5, 1, 1]] }));
  assert.ok(Math.abs(good.weights.reduce((a, b) => a + b, 0) - 1) < 1e-12);
  assert.throws(() => N.loadAhpConfig(w('i.json', { criteria: crit, matrix: [[1, 9, 1 / 9], [1 / 9, 1, 9], [9, 1 / 9, 1]] })), /AHP_INCONSISTENT/);
  assert.throws(() => N.loadAhpConfig(w('b.json', '{nope')), /AHP_CONFIG_PARSE/);
  assert.throws(() => N.loadAhpConfig(w('c.json', { criteria: ['a', 'b', 'c'], matrix: [[1, 1, 1], [1, 1, 1], [1, 1, 1]] })), /AHP_MATRIX_SHAPE/);
});

// ---- tail-quadrant ----
const TN = load('new', 'tail-quadrant').mod;
const TO = load('orig', 'tail-quadrant').mod;
function cohort(n) { // attention and growth are independent permutations of i/(n-1)
  const items = [];
  for (let i = 0; i < n; i += 1) items.push({ id: 'T' + i, attention: i / (n - 1), growth: ((i * 7) % n) / (n - 1) });
  return items;
}
test('tail: quantile numerics (linear interpolation)', () => {
  const q = TN._test.quantile;
  assert.strictEqual(q([0, 1, 2, 3, 4], 0.25), 1);
  assert.strictEqual(q([0, 10], 0.5), 5);
  assert.strictEqual(q([7], 0.9), 7);
  assert.strictEqual(q([], 0.5), null);
});
test('tail: flags low-attention/high-growth quadrant, sorted best-first, same as orig by default', () => {
  const items = cohort(41);
  const rn = TN.classifyTail(items);
  const ro = TO.classifyTail(items);
  assert.deepStrictEqual(rn.tail, ro.tail);
  assert.deepStrictEqual(rn.thresholds, ro.thresholds);
  assert.ok(rn.tail.length > 0);
  for (const t of rn.tail) { assert.ok(t.attention <= rn.thresholds.attnCut && t.growth >= rn.thresholds.growthCut); }
  for (let i = 1; i < rn.tail.length; i += 1) assert.ok(rn.tail[i - 1].growth - rn.tail[i - 1].attention >= rn.tail[i].growth - rn.tail[i].attention);
  assert.strictEqual(rn.cohort_size, 41);
});
test('tail: sparse cohort and flat axis are insufficient_structure with empty tail', () => {
  assert.strictEqual(TN.classifyTail(cohort(10)).insufficient_structure, true);
  const flat = cohort(40).map((x) => Object.assign({}, x, { growth: 0.5 }));
  const r = TN.classifyTail(flat);
  assert.strictEqual(r.insufficient_structure, true);
  assert.deepStrictEqual(r.tail, []);
});
test('tail: suspect_noise when the quadrant swallows >25%', () => {
  const items = cohort(40).map((x) => ({ id: x.id, attention: x.attention, growth: 1 - x.attention })); // anti-correlated: quadrant is large? tune via maxTailFraction
  const r = TN.classifyTail(items, { maxTailFraction: 0.01 });
  assert.strictEqual(r.suspect_noise, true);
});
test('tail: BUG(orig) NaN quantile option silently yields empty tail; new falls back to defaults', () => {
  const items = cohort(41);
  assert.strictEqual(TO.classifyTail(items, { attnQ: NaN }).tail.length, 0);
  assert.deepStrictEqual(TN.classifyTail(items, { attnQ: NaN }).tail, TN.classifyTail(items).tail);
  assert.deepStrictEqual(TN.classifyTail(items, { growthQ: 7 }).thresholds, TN.classifyTail(items).thresholds);
});
test('tail: deterministic tie order by id, brokerage clamped and composed', () => {
  const items = [];
  for (let i = 0; i < 40; i += 1) items.push({ id: 'X' + String(i).padStart(2, '0'), attention: i < 8 ? 0 : (i + 1) / 41, growth: i < 8 ? 1 : (i % 20) / 41 });
  items.push({ id: 'Z', attention: 0.001, growth: 0.99 });
  const r = TN.classifyTail(items);
  const ids = r.tail.filter((t) => t.id.startsWith('X')).map((t) => t.id);
  assert.deepStrictEqual(ids, ids.slice().sort());
  const b = new Map([['Z', 99], ['X03', -5]]);
  const rb = TN.classifyTail(items, { brokerage: b });
  assert.strictEqual(rb.composition, 'attention-growth-brokerage');
  assert.strictEqual(rb.tail.find((t) => t.id === 'Z').brokerage, 1);
  assert.strictEqual(rb.tail.find((t) => t.id === 'X03').brokerage, 0);
});
test('tail: out-of-range axis throws TAIL_AXIS_RANGE', () => {
  assert.throws(() => TN.classifyTail([{ id: 'a', attention: 2, growth: 0 }]), /TAIL_AXIS_RANGE/);
});

// ---- compression-meter ----
const C = load('new', 'compression-meter').mod;
test('compression: delta arithmetic and guards', () => {
  assert.strictEqual(C.computeCompressionDelta(10, 4), 0.6);
  assert.strictEqual(C.computeCompressionDelta(10, 12), 0);
  assert.strictEqual(C.computeCompressionDelta(0, 1), 0);
  assert.strictEqual(C.computeCompressionDelta(10, -1), 0);
  assert.strictEqual(C.computeCompressionDelta(NaN, 1), 0);
  assert.strictEqual(C.computeCompressionDelta(10, 0), 1);
});
test('compression: gates, lured negative leg, never NaN', () => {
  assert.strictEqual(C.compressionScore({ compressionDelta: 0.8, guardEvents: [], statusQuoEvents: [] }), 0.8);
  assert.strictEqual(C.compressionScore({ compressionDelta: 0.8, guardEvents: ['pseudoscience'] }), 0);
  assert.strictEqual(C.compressionScore({ compressionDelta: 0.8, statusQuoEvents: ['x', 'status_quo_stuck'] }), 0);
  assert.strictEqual(C.compressionScore({ compressionDelta: 0.8, arrival: 'Lured', guardEvents: [] }), -0.8);
  assert.strictEqual(C.compressionScore({ compressionDelta: 0, arrival: 'Lured' }), -0.25);
  assert.strictEqual(C.compressionScore({ compressionDelta: 5 }), 1);
  assert.strictEqual(C.compressionScore(null), 0);
  assert.strictEqual(C.compressionScore({ compressionDelta: NaN }), 0);
});

// ---- portfolio-dimensions ----
const P = load('new', 'portfolio-dimensions').mod;
const PO = load('orig', 'portfolio-dimensions').mod;
test('dims: percentileRank ties share mean rank, min 0 max 1, degenerate 0.5', () => {
  const s = [1, 2, 2, 2, 5];
  assert.strictEqual(P.percentileRank(1, s), 0);
  assert.strictEqual(P.percentileRank(5, s), 1);
  assert.strictEqual(P.percentileRank(2, s), 0.5);
  assert.strictEqual(P.percentileRank(3, s), 0.875); // absent value ranks BETWEEN neighbours (orig returned 1.0, tying with the max)
  assert.strictEqual(PO.percentileRank(3, s), 1);
  assert.strictEqual(P.percentileRank(9, [4]), 0.5);
});
test('dims: prepared cohort gives identical output to the per-call path', () => {
  const coh = [];
  for (let i = 0; i < 60; i += 1) coh.push({ id: 't' + i, primary_tier: (i % 3) + 1, pair_count: i % 11, degree: (i * 5) % 13 });
  const prep = P.prepareCohort(coh);
  for (const t of coh) {
    assert.deepStrictEqual(P.scoreTechDimensions(t, coh, prep), P.scoreTechDimensions(t, coh));
    assert.deepStrictEqual(P.scoreTechDimensions(t, coh), PO.scoreTechDimensions(t, coh));
  }
});
test('dims: feasibility map, weak/complementary, NaN floor falls back', () => {
  const F = P._test.FEASIBILITY;
  assert.strictEqual(P._test.feasibilityFromRs({ passes: false }), F.fail);
  assert.strictEqual(P._test.feasibilityFromRs({ passes: true, direction: 'semantic_implementation', abs_diff: 0.2 }), F.bridge);
  assert.strictEqual(P._test.feasibilityFromRs({ passes: true, direction: 'semantic_implementation', abs_diff: 0.4 }), F.transfer);
  assert.strictEqual(P._test.feasibilityFromRs({ passes: true, direction: 'structural_transfer', abs_diff: 0.2 }), F.semantic);
  const a = { strategic_fit: 0.1, validated_demand: 0.9, tech_econ_feasibility: 0.9 };
  const b = { strategic_fit: 0.9, validated_demand: 0.1, tech_econ_feasibility: 0.9 };
  assert.deepStrictEqual(P.weakDimensions(a), ['strategic_fit']);
  assert.strictEqual(P.complementary(a, b), true);
  assert.strictEqual(P.complementary(a, a), false);
  assert.deepStrictEqual(PO.weakDimensions(a, NaN), []);
  assert.deepStrictEqual(P.weakDimensions(a, NaN), ['strategic_fit']);
});
