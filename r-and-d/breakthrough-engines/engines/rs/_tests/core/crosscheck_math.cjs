'use strict';
// Node vs Python numerical cross-check for rs-math.cjs and rs_math.py on seeded data.
// Run: node rs/_tests/core/crosscheck_math.cjs   (from package-2026)
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const assert = require('node:assert');

const core = path.resolve(__dirname, '..', '..', 'shared', 'lib', 'core');
const m = require(path.join(core, 'rs-math.cjs'));

function rng(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

let pass = 0; let fail = 0;
function check(name, fn) { try { fn(); pass += 1; console.log('PASS ' + name); } catch (e) { fail += 1; console.log('FAIL ' + name + ': ' + e.message); } }
function near(a, b, tol, label) { assert.ok(Math.abs(a - b) <= tol || (Number.isNaN(a) && Number.isNaN(b)), (label || '') + ' ' + a + ' vs ' + b); }

function makeCase(seed, n) {
  const r = rng(seed);
  const nt = 6;
  const counts = []; for (let i = 0; i < n; i++) { const row = []; for (let t = 0; t < nt; t++) row.push(r() < 0.3 ? 0 : Math.floor(r() * 5)); counts.push(row); }
  counts[1] = counts[0].slice(); // duplicate row -> ties
  const tokens = []; const vocab = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  for (let i = 0; i < n; i++) { const L = 5 + Math.floor(r() * 20); const ts = []; for (let w = 0; w < L; w++) ts.push(vocab[Math.floor(r() * vocab.length)]); tokens.push(ts); }
  const topics = [['a', 'b', 'c'], ['c', 'd'], ['e', 'f', 'g'], ['h']];
  const q = (x) => Math.round(x * 20) / 20; // quantised -> many exact ties
  const lsa = []; const sem = [];
  for (let i = 0; i < n; i++) { lsa.push(new Array(n).fill(0)); sem.push(new Array(n).fill(0)); }
  for (let i = 0; i < n; i++) for (let j = i; j < n; j++) { const a = q(r()); const b = q(r()); lsa[i][j] = lsa[j][i] = a; sem[i][j] = sem[j][i] = b; }
  const vals = []; for (let i = 0; i < 57; i++) vals.push(q(r()) * 3 - 1);
  return { counts, tokens, topics, lsa, sem, k: 40, pct: 0.8, vals, qs: [0, 0.1, 0.25, 0.5, 0.9, 0.95, 1], xs: [vals[0], vals[5], -5, 9, 0.5], dirs: [-0.2, 0, 1e-12, 0.4] };
}

for (const [seed, n] of [[1, 12], [7, 25], [42, 40]]) {
  const c = makeCase(seed, n);
  const file = path.join(os.tmpdir(), 'rs-crosscheck-' + process.pid + '-' + seed + '.json');
  fs.writeFileSync(file, JSON.stringify(c));
  const res = cp.spawnSync('python3', ['-I', path.join(__dirname, 'crosscheck_math_py.py'), file, core], { encoding: 'utf8', env: Object.assign({}, process.env, { PYTHONDONTWRITEBYTECODE: '1' }) });
  fs.unlinkSync(file);
  if (res.status !== 0) { fail += 1; console.log('FAIL python run seed ' + seed + ': ' + res.stderr.slice(0, 400)); continue; }
  const py = JSON.parse(res.stdout);
  const tag = ' (seed ' + seed + ', n=' + n + ')';

  check('normalizeAndL1Similarity matches' + tag, () => {
    const js = m.normalizeAndL1Similarity(c.counts);
    assert.strictEqual(js.length, py.sim.length);
    for (let i = 0; i < js.length; i++) for (let j = 0; j < js.length; j++) near(js[i][j], py.sim[i][j], 1e-12, 'sim[' + i + '][' + j + ']');
  });
  check('countTopicMembership matches' + tag, () => { assert.deepStrictEqual(m.countTopicMembership(c.tokens, c.topics), py.membership); });
  const cmpPairs = (jsList, pyList, label) => {
    assert.strictEqual(jsList.length, pyList.length, label + ' length ' + jsList.length + ' vs ' + pyList.length);
    for (let t = 0; t < jsList.length; t++) {
      const a = jsList[t]; const b = pyList[t];
      assert.strictEqual(a.i, b[0], label + ' i@' + t); assert.strictEqual(a.j, b[1], label + ' j@' + t);
      near(a.signedDiff, b[2], 1e-12, label + ' signed@' + t); near(a.absDiff, b[3], 1e-12, label + ' abs@' + t);
    }
  };
  check('absDiffTopk order identical (incl. tie-breaks)' + tag, () => cmpPairs(m.absDiffTopk(c.lsa, c.sem, { k: c.k }), py.topk, 'topk'));
  check('absDiffTopk minPercentile identical' + tag, () => cmpPairs(m.absDiffTopk(c.lsa, c.sem, { k: c.k, minPercentile: c.pct }), py.topk_pct, 'topk_pct'));
  check('absDiffTopk skipDiagonal=false identical' + tag, () => cmpPairs(m.absDiffTopk(c.lsa, c.sem, { k: c.k, skipDiagonal: false }), py.topk_diag, 'topk_diag'));
  check('rankPairsByPercentile identical (percentile, z)' + tag, () => {
    const js = m.rankPairsByPercentile(c.lsa, c.sem, { k: c.k, minPercentile: c.pct });
    assert.strictEqual(js.length, py.ranked.length);
    js.forEach((a, t) => { const b = py.ranked[t]; assert.strictEqual(a.i, b.i); assert.strictEqual(a.j, b.j); near(a.percentile, b.percentile, 1e-12, 'pct'); near(a.zScore, b.z_score, 1e-9, 'z'); });
  });
  check('quantile matches python and numpy.percentile' + tag, () => {
    const sorted = c.vals.slice().sort((a, b) => a - b);
    c.qs.forEach((q, t) => { near(m.quantile(sorted, q), py.quantiles[t], 1e-12, 'q' + q); near(py.quantiles[t], py.np_quantiles[t], 1e-12, 'np q' + q); });
  });
  check('percentileRank + zScores match' + tag, () => {
    const sorted = c.vals.slice().sort((a, b) => a - b);
    c.xs.forEach((x, t) => near(m.percentileRank(sorted, x), py.ranks[t], 1e-15, 'rank'));
    const z = m.zScores(c.vals); z.forEach((v, t) => near(v, py.z[t], 1e-12, 'z'));
  });
}

check('absDiffTopk shape mismatch returns envelope', () => { const r = m.absDiffTopk([[0, 0], [0, 0]], [[0]]); assert.strictEqual(r.ok, false); });
check('absDiffTopk NaN never selected', () => { const r = m.absDiffTopk([[0, NaN], [NaN, 0]], [[0, 0.5], [0.5, 0]]); assert.deepStrictEqual(r, []); });
check('zScores constant input is all zeros, no NaN', () => { assert.deepStrictEqual(m.zScores([2, 2, 2]), [0, 0, 0]); });
check('quantile empty is NaN, no throw', () => { assert.ok(Number.isNaN(m.quantile([], 0.5))); });

console.log('\ncrosscheck_math: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
