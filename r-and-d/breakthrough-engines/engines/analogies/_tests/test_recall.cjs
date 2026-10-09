'use strict';
// Run: node analogies/_tests/test_recall.cjs  (from package-2026). Stubs eureka-recall, shared, navigation in a temp sandbox.
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
const PKG = path.resolve(__dirname, '..'); const ORIG = path.resolve(PKG, '..', '_baseline', 'orig', 'analogies');
let pass = 0; let fail = 0;
function ok(c, n) { if (c) { pass += 1; console.log('PASS ' + n); } else { fail += 1; console.log('FAIL ' + n); } }
function build(src, tag) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rec-' + tag + '-'));
  const dir = path.join(root, 'lib/core/research-planner/perspectives'); fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(path.join(src, 'lib/core/research-planner/perspectives/analogies-recall.cjs'), path.join(dir, 'analogies-recall.cjs'));
  fs.writeFileSync(path.join(root, 'lib/core/navigation.cjs'), `module.exports={openRoomDbReadOnlyForCaller(){return {close(){}}}};`);
  fs.writeFileSync(path.join(dir, 'shared.cjs'), `module.exports={runTagNow(){return 'T0'},runDirFor(r,rr,t){return rr+'/'+t},writeRunFiles(){return 'dir'},readCandidates(){return []}};`);
  fs.writeFileSync(path.join(dir, 'eureka-recall.cjs'), `
exports.BUDGETS={max_candidates:500};
exports.buildSubstrate=function(){return global.__SUB;};
exports.recallCandidates=function(){return {candidates:global.__POOL,counts:{things:3,sections:2,canon_resolved:0,known_pairs:0,excluded_known:0},couplings:[]};};
exports.questionSetFor=function(recall){return {schema:'s',leaves:recall.candidates.map(c=>({pair:{a:c.a,b:c.b},origin:'x'}))};};
`);
  return path.join(dir, 'analogies-recall.cjs');
}
const N = require(build(PKG, 'n')); const O = require(build(ORIG, 'o'));
function mk(a, b, lex, ents) { return { a, b, lexical: lex, shared_entities: ents, lanes: ['eureka'], title_a: a, title_b: b, section_a: 's1', section_b: 's2' }; }
global.__SUB = { things: [1, 2, 3], sections: [1, 2], framework_nodes: { f1: {} }, edges: [{ type: 'USES_FRAMEWORK', source: 'p', target: 'f1' }, { type: 'USES_FRAMEWORK', source: 'q', target: 'f1' }] };
const pool = [mk('a', 'b', 0.05, ['e']), mk('c', 'd', 0.10, ['e', 'f']), mk('e', 'f', 0.30, ['e']), mk('g', 'h', 0.0, []), mk('p', 'q', 0.02, [])];
global.__POOL = pool;
const o = O.recallCandidates(global.__SUB, '/r', {}); const n = N.recallCandidates(global.__SUB, '/r', {});
ok(o.candidates.length === 3 && n.candidates.length === 3, 'default (fixed) keeps same candidate set as original');
ok(n.candidates[0].a === 'c' && n.candidates.every(c => c.lanes.includes('structural')), 'most signal first, lane structural added');
ok(n.candidates.every(c => !('_signal' in c)), 'internal _signal not leaked');
ok(n.counts.dropped_lexical_above_ceiling === 1 && n.counts.dropped_no_relational_signal === 1, 'counts: lexical and no-signal drops');
ok(Object.keys(o.counts).every(k => k in n.counts), 'all original counts keys kept');
ok(n.counts.lexical_mode === 'fixed', 'small pool reports fixed');
// tie-break: equal signal, lower lexical first
global.__POOL = [mk('x1', 'y1', 0.12, ['e']), mk('x2', 'y2', 0.01, ['e'])];
ok(N.recallCandidates(global.__SUB, '/r', {}).candidates[0].a === 'x2', 'equal signal: least shared wording first');
// percentile mode tightens, never loosens
global.__POOL = Array.from({ length: 10 }, (_, i) => mk('u' + i, 'v' + i, 0.01 + 0.014 * i, ['e']));
const pf = N.recallCandidates(global.__SUB, '/r', {}); const pp = N.recallCandidates(global.__SUB, '/r', { lexical_mode: 'percentile' });
ok(pp.counts.lexical_mode === 'percentile' && pp.candidates.length < pf.candidates.length, 'percentile mode tightens vs fixed');
ok(pp.counts.lexical_ceiling_used <= 0.15, 'percentile ceiling never above fixed ceiling');
const bad = N.recallCandidates({}, '/r', {});
ok(Array.isArray(bad.candidates), 'missing edges/framework_nodes tolerated');
let threw = false; try { O.recallCandidates({}, '/r', {}); } catch (e) { threw = true; }
ok(threw, 'original threw on substrate without edges');
global.__POOL = [mk('a', 'b', 0.05, ['e'])];
const rr = N.runRecall('/tmp', { tag: 'T1' });
ok(rr.ok && rr.question_set.template_id === 'analogies' && rr.statement_template.slots.length === 3, 'runRecall end-to-end with stubs');
ok(Object.keys(O).every(k => k in N), 'every original export kept');
ok(!/—|–/.test(fs.readFileSync(path.join(PKG, 'lib/core/research-planner/perspectives/analogies-recall.cjs'), 'utf8')), 'no em/en dash');
console.log('RESULT pass=' + pass + ' fail=' + fail); process.exitCode = fail ? 1 : 0;
