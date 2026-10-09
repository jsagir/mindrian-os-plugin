'use strict';
const path = require('node:path');
const S = require('./_stubs.cjs');
S.extra['./shared.cjs'] = { writeJsonl: function () {}, readJsonl: function () { return []; }, deriveStatus: function () {} };
S.extra['./eureka-recall.cjs'] = { STAGE_A_LANES: ['icm_declared', 'lexical'], runDirFor: function (r, t) { return path.join(r, t); }, STATUS_TITLE: 't', readCandidates: function () { return null; } };
const pkg = path.join(__dirname, '../..');
const J = require(path.join(pkg, 'lib/core/research-planner/perspectives/eureka-judge.cjs'));
const O = require(path.join(pkg, '../_baseline/orig/eureka/lib/core/research-planner/perspectives/eureka-judge.cjs'));
const check = S.check;

(async function () {
  const cands = [
    { a: 'n1', b: 'n2', section_a: 's1', section_b: 's2', lanes: ['lexical'], shared_entities: [], title_a: 'valve', title_b: 'gate' },
    { a: 'n3', b: 'n4', section_a: 's1', section_b: 's2', lanes: ['shared_entity'], shared_entities: [], title_a: 'x', title_b: 'y' }, // no credited lane, no entities -> fail
    { a: 'n5', b: 'n6', section_a: 's1', section_b: 's2', lanes: [], shared_entities: ['E'], title_a: 'costs 5B', title_b: 'y' }, // fabricated quantity
    { a: 'n7', b: 'n8', section_a: 's1', section_b: 's2', lanes: ['icm_declared'], shared_entities: [], title_a: 'pump', title_b: 'heart' },
  ];
  const now = '2026-01-01T00:00:00.000Z';
  // identical to original on defaults (no judge)
  const o0 = await O.judgeCandidates(cands, { now: now });
  const n0 = await J.judgeCandidates(cands, { now: now });
  check('no-judge rows identical to original', JSON.stringify(o0.rows) === JSON.stringify(n0.rows));
  check('stage A tags', n0.rows[1].stage_a.tag === 'entity_nonspecific' && n0.rows[2].stage_a.tag === 'unsourced_quantity');
  check('summary stage_a_failed 2', n0.summary.stage_a_failed === 2);

  // identical with a single deterministic judge
  const jf = async function (c) { return { choice: c.a === 'n1' ? 'useful' : 'already_known', confidence: 0.5 }; };
  const o1 = await O.judgeCandidates(cands, { judge: 'jev', judgeFn: jf, bucket: O.JEV_USEFULNESS_BUCKET, now: now });
  const n1 = await J.judgeCandidates(cands, { judge: 'jev', judgeFn: jf, bucket: J.JEV_USEFULNESS_BUCKET, now: now });
  const strip = function (rows) { return rows.map(function (r) { const x = Object.assign({}, r); delete x.agreement; return x; }); };
  check('single-run rows equal original (modulo agreement key)', JSON.stringify(strip(o1.rows)) === JSON.stringify(strip(n1.rows)));
  check('band medium, human routed', n1.summary.band === 'medium' && n1.summary.human_routed === true);
  check('bucket interval reported', n1.summary.bucket_interval && n1.summary.bucket_interval.n === 96);

  // judge error recorded (orig swallowed)
  const ne = await J.judgeCandidates(cands, { judgeFn: async function () { throw new Error('net down'); }, now: now });
  check('judge error recorded', ne.rows[0].judge_error === 'net down' && ne.summary.judge_errors === 2 && ne.rows[0].choice === null);

  // repeats + seed
  const metas = [];
  const stable = await J.judgeCandidates(cands, { seed: 'S', repeats: 4, judgeFn: async function (c, m) { metas.push(m); return { choice: 'useful', confidence: 0.8 }; }, now: now });
  check('4 repeats x 2 passing candidates = 8 calls', metas.length === 8);
  const swaps = metas.filter(function (m) { return m.swap; }).length;
  check('half the replicates swapped', swaps === 4);
  check('stable rows not unstable', stable.rows[0].unstable === undefined && stable.rows[0].agreement.modal_share === 1 && stable.rows[0].choice === 'useful');
  const noSeed = []; await J.judgeCandidates(cands, { repeats: 3, judgeFn: async function (c, m) { noSeed.push(m.swap); return { choice: 'useful' }; }, now: now });
  check('no seed never swaps', noSeed.every(function (s) { return s === false; }));
  const seq = [['useful', 'not_useful', 'useful'], ['not_useful', 'already_known', 'useful']]; let ci = 0; let which = 0;
  const unst = await J.judgeCandidates([cands[0], cands[3]], { seed: 'S', repeats: 3, judgeFn: async function (c) { const v = seq[c.a === 'n1' ? 0 : 1][ci % 3]; ci += 1; return { choice: v }; }, now: now });
  check('2/3 majority keeps choice but flags unstable', unst.rows[0].choice === 'useful' && unst.rows[0].unstable === true && unst.rows[0].human_routed === true);
  check('three-way split -> null choice, unstable', unst.rows[1].choice === null && unst.rows[1].unstable === true);
  check('summary unstable count', unst.summary.unstable === 2 && unst.summary.mean_modal_share > 0 && unst.summary.mean_modal_share < 1);
  check('repeats clamp', (await J.judgeCandidates([cands[0]], { repeats: 50, judgeFn: async function () { return { choice: 'none' }; }, now: now })).rows[0].agreement.runs === 9);
  check('order preserved', unst.rows[0].a === 'n1' && unst.rows[1].a === 'n7');
  S.done('test-judge');
})();
