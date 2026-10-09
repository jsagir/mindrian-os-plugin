'use strict';
// Regression: improved rs-math.cjs / rs_math.py must return exactly what the ORIGINAL
// implementation returned (iterative argmax) on seeded data. Originals are read from
// _baseline/orig and run from a temp sandbox with tiny stubs for the missing modules.
// Run: node rs/_tests/core/regress_math.cjs   (from package-2026)
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path'); const cp = require('node:child_process'); const assert = require('node:assert');
const pkg = path.resolve(__dirname, '..', '..', '..');
const rel = 'rs/shared/lib/core/rs-math.cjs';
const sb = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-regress-'));
fs.mkdirSync(path.join(sb, 'numeric'));
fs.writeFileSync(path.join(sb, 'numeric', 'tfidf.cjs'), 'module.exports={fitTfidf(){return {vocabulary:[],idf:[],weights:[]};}};');
fs.writeFileSync(path.join(sb, 'numeric', 'svd.cjs'), 'module.exports={truncatedSvdWithSignFlip(){return {ok:false};}};');
fs.writeFileSync(path.join(sb, 'direction-convention.cjs'), 'module.exports={classifyDiff(d){return d>0?"structural_transfer":"semantic_implementation";}};');
fs.copyFileSync(path.join(pkg, '_baseline', 'orig', rel), path.join(sb, 'orig-math.cjs'));
const orig = require(path.join(sb, 'orig-math.cjs'));
const neu = require(path.join(pkg, rel));
function rng(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
let pass = 0; let fail = 0;
function check(n, f) { try { f(); pass++; console.log('PASS ' + n); } catch (e) { fail++; console.log('FAIL ' + n + ': ' + e.message); } }
const cases = [];
for (let seed = 1; seed <= 25; seed++) {
  const r = rng(seed); const n = 2 + Math.floor(r() * 30); const q = (x) => Math.round(x * 10) / 10;
  const lsa = []; const sem = []; for (let i = 0; i < n; i++) { lsa.push(new Array(n).fill(0)); sem.push(new Array(n).fill(0)); }
  for (let i = 0; i < n; i++) for (let j = i; j < n; j++) { const a = q(r()); const b = q(r()); lsa[i][j] = lsa[j][i] = a; sem[i][j] = sem[j][i] = b; }
  cases.push({ seed, n, lsa, sem, counts: lsa.map((row) => row.slice(0, 5).map((v) => Math.floor(v * 10))) });
}
check('absDiffTopk == original on 25 seeded matrices (k default, k=7, skipDiagonal false)', () => {
  for (const c of cases) for (const o of [{}, { k: 7 }, { k: 3, skipDiagonal: false }, { k: 0 }]) {
    assert.deepStrictEqual(neu.absDiffTopk(c.lsa, c.sem, o), orig.absDiffTopk(c.lsa, c.sem, o), 'seed ' + c.seed + ' ' + JSON.stringify(o));
  }
});
check('normalizeAndL1Similarity == original', () => { for (const c of cases) assert.deepStrictEqual(neu.normalizeAndL1Similarity(c.counts), orig.normalizeAndL1Similarity(c.counts)); });
check('countTopicMembership == original', () => { const t = [['a', 'b', 'a'], ['c']]; assert.deepStrictEqual(neu.countTopicMembership(t, [['a'], ['c', 'b']]), orig.countTopicMembership(t, [['a'], ['c', 'b']])); });
check('exports are a superset of original exports', () => { for (const k of Object.keys(orig)) assert.ok(k in neu, k); });

// Python: new vs original abs_diff_topk / normalize
const py = `
import sys, json, importlib.util
import numpy as np
def load(p, name):
    spec = importlib.util.spec_from_file_location(name, p); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
o = load(sys.argv[1], 'orig_math'); n = load(sys.argv[2], 'new_math')
cases = json.load(open(sys.argv[3]))
bad = 0
for c in cases:
    lsa, sem = np.array(c['lsa']), np.array(c['sem'])
    for kw in ({}, {'k': 7}, {'k': 3, 'skip_diagonal': False}, {'k': 0}):
        if o.abs_diff_topk(lsa, sem, **kw) != n.abs_diff_topk(lsa, sem, **kw): bad += 1; print('topk diff', c['seed'], kw)
    cm = np.array(c['counts'], dtype=np.float32)
    if not np.allclose(o.normalize_and_l1_similarity(cm), n.normalize_and_l1_similarity(cm), atol=1e-5): bad += 1; print('norm diff', c['seed'])
    if n.normalize_and_l1_similarity(cm).dtype != np.float32: bad += 1; print('dtype changed')
print(json.dumps({'bad': bad}))
`;
const cf = path.join(sb, 'cases.json'); fs.writeFileSync(cf, JSON.stringify(cases));
const res = cp.spawnSync('python3', ['-I', '-c', py, path.join(pkg, '_baseline', 'orig', 'rs/shared/lib/core/rs_math.py'), path.join(pkg, 'rs/shared/lib/core/rs_math.py'), cf], { encoding: 'utf8', env: Object.assign({}, process.env, { PYTHONDONTWRITEBYTECODE: '1' }) });
check('python abs_diff_topk / normalize == original on same 25 cases', () => { assert.strictEqual(res.status, 0, res.stderr.slice(0, 300)); assert.strictEqual(JSON.parse(res.stdout.trim().split('\n').pop()).bad, 0, res.stdout); });
console.log('\nregress_math: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
