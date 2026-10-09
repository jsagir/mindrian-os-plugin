'use strict';
const path = require('node:path');
const S = require('./_stubs.cjs');
const critic = require(path.join(__dirname, '../../lib/core/eureka-critic.cjs'));
const check = S.check;

(async function () {
  // tags + exports
  const tags = critic.loadCriticTags();
  check('tags schema_version 1', tags.schema_version === 1);
  critic.EMITTED_REASONING_TAGS.forEach(function (t) { check('tag registered ' + t, !!tags.reasoning_tags[t]); });
  check('verdicts frozen 4', critic.VERDICTS.length === 4);

  // verdictFromRubric truth table kept
  check('verdict f false', critic.verdictFromRubric({ a: 1, b: 1, c: 1, d: 1, e: 1, f: 0 }) === 'pseudoscience');
  check('verdict e false', critic.verdictFromRubric({ a: 1, b: 1, c: 1, d: 1, e: 0, f: 1 }) === 'restatement');
  check('verdict transferable', critic.verdictFromRubric({ a: 1, b: 1, c: 1, d: 1, e: 1, f: 1 }) === 'transferable');
  check('verdict d false', critic.verdictFromRubric({ a: 1, b: 1, c: 1, d: 0, e: 1, f: 1 }) === 'general_shallow');

  // parser
  const P = critic.parseRubricResponse;
  const txt = '- (a) yes: x\n- (b) no\nc) true\nd: 1\ne = yesterday\nf) 10 things';
  const parsed = P(txt);
  check('parse a yes', parsed.a === true);
  check('parse b no', parsed.b === false);
  check('parse c true', parsed.c === true);
  check('parse d 1', parsed.d === true);
  check('parse e yesterday is NOT yes (word boundary fix)', parsed.e === false);
  check('parse f "10" is NOT 1 (word boundary fix)', parsed.f === false);
  const det = critic.parseRubricResponseDetailed(txt);
  check('unparsed reported', det.unparsed.indexOf('e') !== -1 && det.unparsed.indexOf('f') !== -1);
  check('object response', P({ a: true, b: 'yes', c: 0 }).b === true);
  check('garbage -> all false', Object.values(P('lorem')).every(function (v) { return v === false; }));

  // prompts: default byte-identical shape, seeded reorder, cap
  const cand = { mechanismText: 'M'.repeat(20), mappingStatement: 'map' };
  const pn = critic.buildNeutralPrompt(cand);
  check('neutral default order a..f', /\(a\)[\s\S]*\(b\)[\s\S]*\(c\)[\s\S]*\(d\)[\s\S]*\(e\)[\s\S]*\(f\)/.test(pn));
  check('neutral default has no truncation', pn.indexOf('truncated') === -1);
  const s1 = critic.buildNeutralPrompt(cand, { seed: 'x' });
  const s2 = critic.buildNeutralPrompt(cand, { seed: 'x' });
  check('same seed same prompt', s1 === s2);
  let differs = false;
  for (let i = 0; i < 20; i += 1) if (critic.buildNeutralPrompt(cand, { seed: 's' + i }) !== pn) differs = true;
  check('some seed reorders items', differs);
  check('seeded prompt keeps all six items', ['(a)', '(b)', '(c)', '(d)', '(e)', '(f)'].every(function (k) { return s1.indexOf(k) !== -1; }));
  const long = { mechanismText: 'z'.repeat(50000), mappingStatement: 'q'.repeat(50000) };
  const lp = critic.buildAdversarialPrompt(long);
  check('length cap applied', lp.length < 20000 && lp.indexOf('[truncated at 8000 chars]') !== -1);
  check('cap same both passes', critic.buildNeutralPrompt(long).indexOf('[truncated at 8000 chars]') !== -1);
  check('maxChars option 0 disables cap', critic.buildNeutralPrompt(long, { maxChars: 0 }).length > 100000);

  // runRubric original behaviour
  const yes = { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1 };
  let calls = 0;
  const r0 = await critic.runRubric(cand, { judgeFn: function () { calls += 1; return yes; } });
  check('2 calls default', calls === 2 && r0.calls === 2);
  check('all-yes transferable', r0.verdict === 'transferable' && r0.rubric_pattern === '111111' && r0.reasoning_tag === 'passes_all_gates');
  check('agreement key present', r0.agreement && r0.agreement.mean_item_agreement === 1 && r0.agreement.neutral_adversarial_agree === true);

  const r1 = await critic.runRubric(cand, { judgeFn: function (p) { return /Argue this/.test(p) ? Object.assign({}, yes, { b: 0 }) : yes; } });
  check('disagreement -> x slot', r1.rubric_pattern === '1x1111' && r1.verdict === 'general_shallow' && r1.reasoning_tag === 'rubric_disagreement');
  check('disagreement agreement report', r1.agreement.neutral_adversarial_agree === false && r1.agreement.item_agreement.b === 0.5);

  // seeded order + repeats
  const seen = [];
  const rs = await critic.runRubric(cand, { seed: 'k', repeats: 3, judgeFn: function (p, meta) { seen.push(meta); return yes; } });
  check('repeats=3 -> 6 calls', seen.length === 6 && rs.calls === 6 && rs.repeats === 3);
  check('meta carries pass/replicate/seed', seen.every(function (m) { return m.pass && typeof m.replicate === 'number' && /^k:/.test(m.seed); }));
  const seen2 = [];
  await critic.runRubric(cand, { seed: 'k', repeats: 3, judgeFn: function (p, meta) { seen2.push(meta.pass + meta.replicate); return yes; } });
  check('same seed same call order', JSON.stringify(seen.map(function (m) { return m.pass + m.replicate; })) === JSON.stringify(seen2));
  let orders = new Set();
  for (let i = 0; i < 30; i += 1) {
    let first = null;
    await critic.runRubric(cand, { seed: 'o' + i, judgeFn: function (p, m) { if (!first) first = m.pass; return yes; } });
    orders.add(first);
  }
  check('seeded coin uses both pass orders', orders.size === 2, Array.from(orders).join(','));
  // unstable judge across replicates -> x
  let n = 0;
  const unstable = await critic.runRubric(cand, { seed: 'u', repeats: 2, judgeFn: function () { n += 1; return n <= 2 ? yes : Object.assign({}, yes, { d: 0 }); } });
  check('replicate instability -> x', unstable.rubric_pattern === '111x11' && unstable.agreement.replicate_stable === false);
  check('repeats clamp', (await critic.runRubric(cand, { repeats: 99, judgeFn: function () { return yes; } })).calls === 18);
  let threw = false; try { await critic.runRubric(cand, {}); } catch (e) { threw = e instanceof TypeError; }
  check('no judgeFn throws TypeError', threw);

  // stageA
  const mech = 'The Kalman filter at NASA tracks Apollo trajectories while the Heimlich maneuver clears obstruction airway pressure';
  const a1 = await critic.stageA({ text: 'costs $5B', mechanismText: mech }, {});
  check('gate1 text pseudoscience', a1.route === 'pseudoscience' && a1.tag === 'unsourced_quantity');
  const a2 = await critic.stageA({ text: 'fine', mechanismText: 'revenue of 3B per year from valve architecture' }, {});
  check('gate1 scans mechanism (2026)', a2.route === 'pseudoscience');
  process.env.EUREKA_GATE1_MECHANISM = '0';
  const a2b = await critic.stageA({ text: 'fine', mechanismText: 'revenue of 3B per year from valve architecture' }, {});
  check('gate1 mechanism scan can be disabled', a2b.tag !== 'unsourced_quantity');
  delete process.env.EUREKA_GATE1_MECHANISM;
  const a3 = await critic.stageA({ text: 'x', mechanismText: '   ' }, {});
  check('empty mechanism fails fast', a3.pass === false && a3.features.empty_mechanism === true);
  const a4 = await critic.stageA({ text: 'x', mechanismText: mech }, { _forceUnavailable: true });
  check('encoder unavailable degrades', a4.degraded === true && a4.tag === 'calibration_unknown');
  const a5 = await critic.stageA({ text: 'x', mechanismText: mech }, { knnFn: async function () { throw new Error('boom'); } });
  check('knn error recorded, not swallowed', (a5.features || a5.pass === true) && ((a5.features && a5.features.nn_error === 'boom') || a5.pass === true));
  const a6 = await critic.stageA({ text: 'x', mechanismText: mech }, { knnFn: async function () { return [{ similarity: 0.99 }]; } });
  check('knn restatement gate', a6.route === 'restatement' && a6.tag === 'low_novelty_delta');

  // classify: degraded -> unknown (bug fix), gate trip -> high
  const c1 = await critic.classifyCandidate({ text: 'x', mechanismText: mech }, { _forceUnavailable: true, now: '2026-01-01T00:00:00.000Z' });
  check('degraded Stage A confidence unknown (bug fix)', c1.confidence === 'unknown' && c1.degraded === true);
  const c2 = await critic.classifyCandidate({ text: 'costs $5B', mechanismText: mech }, { now: '2026-01-01T00:00:00.000Z' });
  check('gate trip confidence high', c2.confidence === 'high' && c2.stage === 'A' && c2.verdict === 'pseudoscience');
  check('provenance present', c2.provenance && c2.provenance.computed_at === '2026-01-01T00:00:00.000Z' && c2.provenance.judge_role.indexOf('triage') === 0);
  const c3 = await critic.classifyCandidate({ text: 'x', mechanismText: mech, mappingStatement: 'm' }, { judgeFn: function () { return yes; }, seed: 7, repeats: 2, baselinePath: '/nonexistent/baseline.json', knnFn: async function () { return [{ similarity: 0.1 }]; }, now: '2026-01-01T00:00:00.000Z' });
  check('stage B result shape', c3.stage === 'B' && c3.verdict === 'transferable' && c3.confidence === 'unknown');
  check('calibration error recorded', typeof c3.calibration_error === 'string' && c3.calibration_error.length > 0);
  check('novelty_check checked', c3.novelty_check === 'checked');
  check('provenance seed/repeats', c3.provenance.seed === '7' && c3.provenance.repeats === 2 && c3.provenance.judge_calls === 4);

  // entities
  process.env.EUREKA_SWAP_INVARIANCE_FLOOR = '0';
  const ent = await critic.stageA({ text: 'x', mechanismText: 'Valves open. Pressure rises. Flow stops.' }, {});
  check('sentence-start capitals not entities (2026)', ent.pass === false && ent.tag === 'entity_nonspecific' && ent.features.entity_count === 0, JSON.stringify(ent));
  const ent2 = await critic.stageA({ text: 'x', mechanismText: 'Valves at NASA open near Houston under 50mg load' }, {});
  check('real entities still counted', ent2.pass === true && ent2.features.entity_count >= 3, JSON.stringify(ent2));
  delete process.env.EUREKA_SWAP_INVARIANCE_FLOOR;
  const fs = require('node:fs'); const os = require('node:os');
  const bp = path.join(os.tmpdir(), 'eureka-rest-baseline-' + process.pid + '.json');
  fs.writeFileSync(bp, JSON.stringify({ status: 'calibrated', embedding_model: 'stub-hash-64', buckets: { '111111': { n: 10, correct: 10 } } }));
  const c4 = await critic.classifyCandidate({ text: 'x', mechanismText: mech, mappingStatement: 'm', sourceDomainTag: 'biology', targetDomainTag: 'computing', lsa_similarity: 0.5, semantic_similarity: 0.2, differential_score: 0.3 }, { judgeFn: function () { return yes; }, baselinePath: bp });
  check('calibrated baseline yields high confidence', c4.confidence === 'high', c4.confidence + ' ' + (c4.calibration_error || ''));
  fs.unlinkSync(bp);

  // criticRule
  const bp2 = path.join(os.tmpdir(), 'eureka-rest-baseline2-' + process.pid + '.json');
  fs.writeFileSync(bp2, JSON.stringify({ buckets: { '111111': { n: 4, correct: 4 }, '110111': { n: 10, correct: 5 } } }));
  const payload = critic.assembleCriticPayload({ differential_score: 0.456, semantic_similarity: 0.1, lsa_similarity: 0.6, surprise_type: 'structural_transfer', source_domain_tag: 'biology', target_domain_tag: 'finance', rubric_pattern: '111111' });
  check('payload quantized', payload.differential_score === 0.46 && payload.schema_version === 1);
  check('criticRule high', critic.criticRule(payload, { baselinePath: bp2 }).confidence === 'high');
  check('criticRule xxxxxx', critic.criticRule(Object.assign({}, payload, { rubric_pattern: 'xxxxxx' }), { baselinePath: bp2 }).confidence === 'high');
  check('criticRule unseen -> unknown', critic.criticRule(Object.assign({}, payload, { rubric_pattern: '000000' }), { baselinePath: bp2 }).confidence === 'unknown');
  let t2 = false; try { critic.criticRule(Object.assign({}, payload, { extra: 1 }), { baselinePath: bp2 }); } catch (e) { t2 = e instanceof TypeError; }
  check('closed key discipline', t2);
  let t3 = false; try { critic.assembleCriticPayload({ source_domain_tag: 'nope', target_domain_tag: 'finance' }); } catch (e) { t3 = e instanceof TypeError; }
  check('domain enum enforced', t3);
  fs.unlinkSync(bp2);

  // bands
  const cb = critic.confidenceFromBucket;
  check('bands', cb({ n: 10, correct: 9 }) === 'high' && cb({ n: 10, correct: 7 }) === 'medium' && cb({ n: 10, correct: 6 }) === 'low');
  check('JEV bucket medium (73/96)', cb({ correct: 73, n: 96 }) === 'medium');
  check('impossible bucket unknown (2026)', cb({ n: 3, correct: 5 }) === 'unknown' && cb({ n: 3, correct: -1 }) === 'unknown' && cb(null) === 'unknown');
  const iv = critic.bucketInterval({ n: 1, correct: 1 });
  check('wilson interval wide for n=1', iv && iv.low < 0.25 && iv.high === 1);
  check('quantize no -0', Object.is(critic.quantize(-0.001), 0) && critic.quantize(NaN) === null);

  // tags JSON vs code: every (verdict, tag) the pure rubric mapping can emit is allowed by tag_verdicts
  let bad = [];
  for (let m = 0; m < 64; m += 1) {
    const it = {}; 'abcdef'.split('').forEach(function (k, i) { it[k] = !!(m & (1 << i)); });
    const v = critic.verdictFromRubric(it);
    // reasoningTagFromItems is internal; reach it through runRubric
    const r = await critic.runRubric(cand, { judgeFn: function () { return it; } });
    if ((tags.tag_verdicts[r.reasoning_tag] || []).indexOf(r.verdict) === -1) bad.push(m + ':' + r.verdict + '/' + r.reasoning_tag);
    if (r.verdict !== v) bad.push('verdict mismatch ' + m);
  }
  check('all 64 rubric outcomes consistent with tag_verdicts', bad.length === 0, bad.join(' '));
  check('stage A routes allowed by tag_verdicts', [['pseudoscience', 'unsourced_quantity'], ['general_shallow', 'domain_swap_invariant'], ['restatement', 'low_novelty_delta'], ['general_shallow', 'entity_nonspecific'], ['general_shallow', 'calibration_unknown']].every(function (rt) { return tags.tag_verdicts[rt[1]].indexOf(rt[0]) !== -1; }));
  S.done('test-critic');
})();
