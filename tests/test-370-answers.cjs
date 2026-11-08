'use strict';
// Phase 370 answers test (plan 370-04). It proves that data/review-contract.json agrees with the
// owner answers recorded in 370-DECISION.md. The answers come from `370-gate.cjs resolve`; no answer
// is written into this test. Every arm branches on the resolved value, so the test is true for any
// answer the owner gave. Node built-ins only. No network, no Brain call (Canon Part 8).
//
// TEST_370_ANSWERS_CONTRACT (optional): path to a contract JSON file to check instead of
// data/review-contract.json. It lets a reviewer run the test against an older contract (RED proof).

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const H = require('./helpers/review-contract-370.cjs');

const rep = H.reporter('test-370-answers');
const M = H.requireModule(rep);

const PHASE_DIR = path.join(H.ROOT, '.planning', 'phases', '370-review-contract-for-mos-grade-and-mos-deep-grade-fixed-stude');
const GATE = path.join(PHASE_DIR, '370-gate.cjs');
const DECISION = path.join(PHASE_DIR, '370-DECISION.md');
const ITEMS = ['O1', 'O2', 'O3', 'O4A', 'O4B', 'O6A', 'O6B', 'O8'];

function loadContractFile() {
  const p = process.env.TEST_370_ANSWERS_CONTRACT;
  if (p) return JSON.parse(fs.readFileSync(path.resolve(p), 'utf8'));
  return H.realContract();
}

let contract;
try {
  contract = loadContractFile();
} catch (e) {
  rep.fatal('cannot read the contract data: ' + e.message);
}

// Resolve the owner answers through the gate script (one source of truth).
let resolved = {};
{
  const r = cp.spawnSync(process.execPath, [GATE, 'resolve', DECISION], { encoding: 'utf8' });
  if (r.status !== 0) {
    rep.fatal('370-gate.cjs resolve exited ' + r.status + ': ' + String(r.stdout || r.stderr).split('\n')[0]);
  }
  for (const line of String(r.stdout).split('\n')) {
    if (!line.trim()) continue;
    const cols = line.split('\t');
    if (cols.length !== 3) rep.fatal('bad resolve row: ' + line);
    resolved[cols[0]] = cols[2];
  }
}

// The three O2-VALUE lines of the card (used only when O2 is SET-CAPS).
function o2Values() {
  const text = fs.readFileSync(DECISION, 'utf8');
  const out = {};
  for (const m of text.matchAll(/^O2-VALUE ([a-z_]+):[ \t]*(.*?)[ \t]*$/gm)) out[m[1]] = m[2];
  return out;
}

const bodyIds = () => contract.forbidden_body_patterns.map((e) => e.id);
const headingIds = () => contract.forbidden_headings.map((e) => e.id);
const tailIds = () => contract.optional_tail.map((e) => e.id);
const OPTS = (extra) => Object.assign({ repoRoot: H.ROOT, contract }, extra || {});
const classes = (res) => res.violations.map((v) => v.rule + '/' + v.class);

rep.arm('A1 owner_answers equals the gate resolve output for all eight items', () => {
  rep.eq(Object.keys(resolved).sort().join(','), ITEMS.slice().sort().join(','), 'items resolved by the gate');
  rep.ok(contract.owner_answers && typeof contract.owner_answers === 'object', 'owner_answers missing');
  rep.eq(Object.keys(contract.owner_answers).sort().join(','), ITEMS.slice().sort().join(','), 'owner_answers keys');
  for (const k of ITEMS) rep.eq(contract.owner_answers[k], resolved[k], 'owner_answers.' + k);
});

rep.arm('A2a O1 and O4A follow the mapping table in the data', () => {
  const o1 = resolved.O1;
  const hasScoresTail = tailIds().indexOf('scores') !== -1;
  const wantBody = o1 === 'WITHHOLD' ? ['letter_grade_line', 'percentile', 'score_table']
    : o1 === 'GRADE-ONLY' ? ['score_table'] : [];
  rep.eq(bodyIds().slice().sort().join(','), wantBody.join(','), 'forbidden_body_patterns ids for O1 ' + o1);
  rep.eq(headingIds().indexOf('score_heading') !== -1, o1 !== 'KEEP', 'score_heading presence for O1 ' + o1);
  rep.eq(hasScoresTail, o1 === 'KEEP', 'scores tail item for O1 ' + o1);
  if (o1 === 'KEEP') {
    const t = contract.optional_tail;
    rep.eq(t[t.length - 1].id, 'advanced', 'advanced stays last in optional_tail');
    rep.eq(t[tailIds().indexOf('scores')].heading, 'Scores', 'scores tail heading');
  } else {
    for (const e of contract.forbidden_headings.concat(contract.forbidden_body_patterns)) {
      if (['score_heading', 'score_table', 'letter_grade_line', 'percentile'].indexOf(e.id) !== -1) {
        rep.ok(/\bO1\b/.test(e.why), 'why of ' + e.id + ' must name O1');
      }
    }
  }

  const o4a = resolved.O4A;
  rep.eq(tailIds().indexOf('perspective') !== -1, o4a === 'KEEP', 'perspective tail item for O4A ' + o4a);
  rep.eq(headingIds().indexOf('persona_perspective') !== -1, o4a !== 'KEEP', 'persona_perspective for O4A ' + o4a);
  if (o4a === 'KEEP') {
    const item = contract.optional_tail[tailIds().indexOf('perspective')];
    rep.ok(typeof item.heading_pattern === 'string' && item.heading_pattern.length > 0, 'perspective needs a heading_pattern');
    rep.ok(tailIds().indexOf('perspective') < tailIds().indexOf('advanced'), 'perspective sits before advanced');
  } else {
    const e = contract.forbidden_headings.find((x) => x.id === 'persona_perspective');
    rep.ok(/\bO4A\b/.test(e.why), 'why of persona_perspective must name O4A');
  }
  // O4B changes no data: it is recorded in owner_answers only (acted on in plans 370-07 and 370-09).
});

rep.arm('A2b O3, O6A, O6B and O8 follow the mapping table in the data', () => {
  const policy = { KEEP: 'strict', 'EXEMPT-IF-IN-SOURCE': 'exempt_if_in_source', 'COMPOUND-ONLY': 'compound_only' };
  rep.eq(contract.soft_terms.policy, policy[resolved.O3], 'soft_terms.policy for O3 ' + resolved.O3);
  const sev = { KEEP: 'off', ADVISORY: 'advisory', BLOCKER: 'blocker' };
  const mode = { KEEP: 'off', 'LOG-ONLY': 'log-only', ENFORCE: 'enforce' };
  const door = { KEEP: 'off', FRONTMATTER: 'frontmatter' };
  const en = contract.enforcement;
  rep.ok(en && typeof en === 'object', 'enforcement block missing');
  rep.eq(en.source, '370-DECISION.md', 'enforcement.source');
  rep.eq(en.doctor_severity, sev[resolved.O6A], 'enforcement.doctor_severity for O6A ' + resolved.O6A);
  rep.eq(en.hook_mode, mode[resolved.O6B], 'enforcement.hook_mode for O6B ' + resolved.O6B);
  rep.eq(en.door, door[resolved.O8], 'enforcement.door for O8 ' + resolved.O8);
  rep.eq(contract.applies_to.classify, resolved.O8 === 'KEEP' ? 'none' : 'frontmatter', 'applies_to.classify for O8 ' + resolved.O8);
});

rep.arm('A3 limits follow O2 and the card lines; the plan invents no number', () => {
  if (resolved.O2 === 'KEEP') {
    rep.eq(JSON.stringify(contract.limits), '{}', 'limits must be the empty object for O2 KEEP');
    rep.ok(!Object.prototype.hasOwnProperty.call(contract.limits, 'limits_source'), 'no limits_source for O2 KEEP');
    return;
  }
  rep.eq(resolved.O2, 'SET-CAPS', 'O2 must resolve to KEEP or SET-CAPS');
  const v = o2Values();
  const isWhole = (s) => /^[1-9][0-9]*$/.test(String(s));
  rep.ok(isWhole(v.body_words_max), 'O2-VALUE body_words_max must be a positive whole number');
  rep.ok(isWhole(v.reflection_questions_max), 'O2-VALUE reflection_questions_max must be a positive whole number');
  rep.eq(contract.limits.body_words_max, Number(v.body_words_max), 'limits.body_words_max');
  rep.eq(contract.limits.reflection_questions_max, Number(v.reflection_questions_max), 'limits.reflection_questions_max');
  if (v.cross_domain_under === 'NONE') {
    rep.ok(!Object.prototype.hasOwnProperty.call(contract.limits, 'cross_domain_under'), 'cross_domain_under must be omitted for NONE');
  } else {
    rep.ok(['research_reframe', 'strategic_challenge'].indexOf(v.cross_domain_under) !== -1, 'O2-VALUE cross_domain_under value');
    rep.eq(contract.limits.cross_domain_under, v.cross_domain_under, 'limits.cross_domain_under');
  }
  rep.ok(typeof contract.limits.limits_source === 'string' && contract.limits.limits_source.indexOf('370-DECISION.md O2') === 0,
    'limits_source must start with 370-DECISION.md O2');
});

rep.arm('A4a behavior: the score rules of O1 hold under the contract', () => {
  const o1 = resolved.O1;
  const table = H.wrap('| Criterion | Weight |\n| --- | --- |\n| Need | 4 |');
  const letter = H.wrap('Final Grade: B');
  const pct = H.wrap('This team sits in a high percentile.');
  const heading = H.review({ tail: '## Scores\n\nPlain text for this section.' });
  const tCls = classes(M.checkReview(table, OPTS()));
  const lCls = classes(M.checkReview(letter, OPTS()));
  const pCls = classes(M.checkReview(pct, OPTS()));
  const hRes = M.checkReview(heading, OPTS());
  if (o1 === 'KEEP') {
    rep.eq(hRes.ok, true, 'a Scores section after Strategic Challenge must pass for O1 KEEP: ' + JSON.stringify(hRes.violations));
    return;
  }
  rep.ok(tCls.indexOf('forbidden_pattern/score_table') !== -1, 'score table row must fail: ' + tCls.join(','));
  rep.ok(classes(hRes).indexOf('forbidden_section/score_heading') !== -1, 'Scores heading must fail: ' + classes(hRes).join(','));
  if (o1 === 'WITHHOLD') {
    rep.ok(lCls.indexOf('forbidden_pattern/letter_grade_line') !== -1, 'letter grade line must fail: ' + lCls.join(','));
    rep.ok(pCls.indexOf('forbidden_pattern/percentile') !== -1, 'percentile must fail: ' + pCls.join(','));
  } else {
    rep.eq(lCls.length, 0, 'GRADE-ONLY leaves a letter grade line alone: ' + lCls.join(','));
    rep.eq(pCls.length, 0, 'GRADE-ONLY leaves a percentile alone: ' + pCls.join(','));
  }
});

rep.arm('A4b behavior: the persona rule of O4A holds under the contract', () => {
  const doc = H.review({ tail: "## Professor Example's Perspective\n\nPlain text for this section." });
  const res = M.checkReview(doc, OPTS());
  if (resolved.O4A === 'KEEP') {
    rep.eq(res.ok, true, 'a Professor Perspective note must pass for O4A KEEP: ' + JSON.stringify(res.violations));
  } else {
    rep.ok(classes(res).indexOf('forbidden_section/persona_perspective') !== -1, 'Professor Perspective heading must fail: ' + classes(res).join(','));
  }
});

rep.arm('A4c behavior: the soft term policy of O3 holds under the contract', () => {
  const text = H.wrap('We keep a shared database of tide times and a graph of delays.');
  const source = H.readFixture('source-student.md');
  const bare = M.checkReview(text, OPTS());
  const withSource = M.checkReview(text, OPTS({ sourceText: source }));
  const soft = (res) => res.violations.filter((v) => v.class === 'soft_term').length;
  const p = contract.soft_terms.policy;
  if (p === 'strict') {
    rep.ok(soft(bare) > 0, 'strict flags soft terms without a source');
    rep.ok(soft(withSource) > 0, 'strict flags soft terms even when the source holds them');
  } else if (p === 'exempt_if_in_source') {
    rep.ok(soft(bare) > 0, 'exempt_if_in_source flags a soft term the source lacks');
    rep.eq(soft(withSource), 0, 'exempt_if_in_source passes a soft term the source holds');
  } else {
    rep.eq(soft(bare), 0, 'compound_only leaves bare soft terms alone');
    rep.eq(soft(withSource), 0, 'compound_only leaves bare soft terms alone with a source');
  }
});

rep.arm('A5 fixtures: pre-fix fails and post-fix passes under the final contract', () => {
  const src = H.readFixture('source-student.md');
  const pre = M.checkReview(H.readFixture('pre-fix.md'), OPTS());
  rep.eq(pre.ok, false, 'pre-fix fixture must fail');
  const preSrc = M.checkReview(H.readFixture('pre-fix.md'), OPTS({ sourceText: src }));
  rep.eq(preSrc.ok, false, 'pre-fix fixture must fail with source text');
  const post = M.checkReview(H.readFixture('post-fix.md'), OPTS());
  rep.eq(post.ok, true, 'post-fix fixture must pass: ' + JSON.stringify(post.violations));
  const postSrc = M.checkReview(H.readFixture('post-fix.md'), OPTS({ sourceText: src }));
  rep.eq(postSrc.ok, true, 'post-fix fixture must pass with source text: ' + JSON.stringify(postSrc.violations));
});

rep.done();
