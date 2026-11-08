'use strict';
// Phase 370 rules test (RED until plan 370-02 creates lib/core/review-contract.cjs and the data file).
// Arms R0 to R16. The tests follow the "Interface contract" of 370-CONTEXT.md word for word.
// Dash and zero-width characters are built from code points so this source stays plain ASCII.
// Node built-ins only. No network, no Brain call.

const fs = require('fs');
const path = require('path');
const H = require('./helpers/review-contract-370.cjs');

const rep = H.reporter('test-370-check-rules');
const M = H.requireModule(rep);

const OPTS = { repoRoot: H.ROOT };
function check(text, extra) {
  return M.checkReview(text, Object.assign({}, OPTS, extra || {}));
}
function has(res, rule, cls, line) {
  return (res.violations || []).some((v) => v.rule === rule && (cls === undefined || v.class === cls) && (line === undefined || v.line === line));
}
function bullets(n, label) {
  const out = [];
  for (let i = 1; i <= n; i++) out.push('- **' + (label || 'Point') + ' ' + i + ':** plain words for point ' + i + '.');
  return out.join('\n');
}
function crossBullets(n, tag) {
  const out = [];
  for (let i = 1; i <= n; i++) out.push('- **Cross-domain:** idea ' + (tag || 'x') + ' ' + i + ' from another field.');
  return out.join('\n');
}
const ADVANCED = '## For advanced students\n\n';
const LIMIT_SRC = '370-DECISION.md O2 test';

rep.arm('R0 baseline: version, loadContract, a valid review passes', () => {
  rep.eq(M.CONTRACT_VERSION, 1, 'CONTRACT_VERSION');
  const c = M.loadContract({ repoRoot: H.ROOT });
  rep.eq(c.review_contract, 1, 'loaded contract version');
  for (const bad of [{}, Object.assign({}, H.realContract(), { sections: undefined })]) {
    let err = null;
    try { M.loadContract({ contract: bad }); } catch (e) { err = e; }
    rep.ok(err && err.code === 'REVIEW_CONTRACT_INVALID', 'loadContract must throw code REVIEW_CONTRACT_INVALID');
  }
  const res = check(H.review());
  rep.ok(res.ok === true && res.violations.length === 0, 'a valid review must pass: ' + JSON.stringify(res.violations));
  rep.eq(res.contract_version, 1, 'result.contract_version');
});

// R1: one input per term, one violation with the right tier, class and 1-based file line.
const R1 = [
  ['The SystemArchetypeAgent ran.', 'H1', 'agent_name', 'SystemArchetypeAgent'],
  ['The Grading Agent ran.', 'H1', 'agent_name', 'Grading Agent'],
  ['Open /mos:grade now.', 'H2', 'command', '/mos:grade'],
  ['Open mos:grade now.', 'H2', 'command', 'mos:grade'],
  ['The artifact_file step ran.', 'H3', 'tool_id', 'artifact_file'],
  ['The mcp__x__y call ran.', 'H3', 'tool_id', 'mcp__x__y'],
  ['The brain_ask call ran.', 'H3', 'tool_id', 'brain_ask'],
  ['See lib/core/x.cjs for it.', 'H4', 'path_or_id', 'lib/core/x.cjs'],
  ['See REASONING.md for it.', 'H4', 'path_or_id', 'REASONING.md'],
  ['See rp-2026-11-08-abcdef12 for it.', 'H4', 'path_or_id', 'rp-2026-11-08-abcdef12'],
  ['The MCP answered.', 'E1', 'backend_name', 'MCP'],
  ['The Neo4j store answered.', 'E1', 'backend_name', 'Neo4j'],
  ['The Brain answered.', 'E1', 'backend_name', 'Brain'],
  ['The Theo answered.', 'E1', 'backend_name', 'Theo'],
  ['The Cypher query answered.', 'E1', 'backend_name', 'Cypher'],
];
rep.arm('R1 every tier class is caught in the body with the right line', () => {
  const failures = [];
  for (const [snippet, tier, cls, needle] of R1) {
    const text = H.wrap(snippet);
    const res = check(text);
    const line = H.lineOf(text, needle);
    const hit = (res.violations || []).some((v) => v.rule === 'internal_name' && v.tier === tier && v.class === cls && v.line === line);
    if (!hit) failures.push(needle + ' (' + tier + '/' + cls + ' line ' + line + ')');
  }
  rep.ok(failures.length === 0, 'not flagged as expected: ' + failures.join('; '));
});

rep.arm('R2 handles are allowed in frontmatter', () => {
  const fm = [
    '---', 'methodology: deep-grade', 'review_contract: 1', 'assessor: grading', 'team: Team Cedar Wharf',
    'note: SystemArchetypeAgent Neo4j MCP Brain Theo', 'route: /mos:grade', 'tool: artifact_file', 'path: lib/core/x.cjs', '---',
  ].join('\n');
  const res = check(H.review({ fm }));
  rep.ok(res.ok === true, 'frontmatter handles must not fail: ' + JSON.stringify(res.violations));
});

rep.arm('R3 a term inside a fenced block in the body is still flagged', () => {
  const text = H.wrap('```\nNeo4j\n```');
  const res = check(text);
  rep.ok(has(res, 'internal_name', 'backend_name', H.lineOf(text, 'Neo4j')), 'fenced Neo4j not flagged on its line');
});

rep.arm('R4 normalization catches hidden characters and keeps line numbers', () => {
  const zw = 'ZW1 Neo' + H.ZWSP + '4j here.';
  const sh = 'SH1 Ne' + H.SHY + 'o4j here.';
  const fw = 'FW1 ' + String.fromCharCode(0xff2d, 0xff23, 0xff30) + ' here.';
  for (const [snippet, marker] of [[zw, 'ZW1'], [sh, 'SH1'], [fw, 'FW1']]) {
    const text = H.wrap('Plain line before.\n\n' + snippet + '\n\nPlain line after.');
    const res = check(text);
    rep.ok(has(res, 'internal_name', 'backend_name', H.lineOf(text, marker)), marker + ' not flagged on line ' + H.lineOf(text, marker));
  }
});

rep.arm('R5 false-positive guards', () => {
  const snippet = [
    'A note on K12 education and the price index at the ferry server hook.',
    'The taught words are leverage points, causal loops, and stocks and flows.',
    'The research was careful and the grading was fair.',
  ].join('\n\n');
  const res = check(H.wrap(snippet));
  rep.ok(res.ok === true, 'plain words were flagged: ' + JSON.stringify(res.violations));
});

rep.arm('R6 shape rules', () => {
  const six = H.SIX_HEADINGS.slice();
  const swapped = six.slice(); swapped[1] = six[2]; swapped[2] = six[1];
  rep.ok(has(check(H.rawReview(swapped)), 'shape_order'), 'swapped sections: shape_order expected');

  const missing = six.filter((h) => h !== '## Expert Conversations');
  rep.ok(has(check(H.rawReview(missing)), 'missing_section'), 'dropped section: missing_section expected');

  const extra = check(H.rawReview(six.concat(['## Notes'])));
  rep.ok(has(extra, 'extra_section'), 'unknown heading: extra_section expected');

  const ta = six.slice(0, 5).concat(['## Tool Analysis'], six.slice(5));
  const taRes = check(H.rawReview(ta));
  rep.ok(has(taRes, 'forbidden_section'), 'Tool Analysis: forbidden_section expected');
  rep.ok(!has(taRes, 'extra_section'), 'Tool Analysis must not also be extra_section');

  const advMid = six.slice(0, 5).concat(['## For advanced students'], six.slice(5));
  rep.ok(has(check(H.rawReview(advMid)), 'shape_order'), 'advanced note not last: shape_order expected');

  const advLast = check(H.review({ tail: ADVANCED + crossBullets(1, 'adv') }));
  rep.ok(advLast.ok === true, 'advanced note last must pass: ' + JSON.stringify(advLast.violations));

  const sci = check(H.wrap('### Sci-Fi Connection\n\nA short story idea.', 'research'));
  rep.ok(has(sci, 'forbidden_section'), 'Sci-Fi sub-heading: forbidden_section expected');

  const fenced = check(H.wrap('```\n## Notes\n```'));
  rep.ok(fenced.ok === true, 'a heading inside a fence must not count: ' + JSON.stringify(fenced.violations));

  const sub = check(H.wrap('### Detail\n\nA free sub-heading.'));
  rep.ok(sub.ok === true, 'a ### sub-heading is free: ' + JSON.stringify(sub.violations));
});

rep.arm('R7 counts', () => {
  for (const n of [2, 6]) {
    const res = check(H.review({ sections: { exec: 'A short paragraph.\n\n' + bullets(n) } }));
    rep.ok(has(res, 'revision_points_count'), n + ' revision points: revision_points_count expected');
  }
  for (const n of [3, 5]) {
    const res = check(H.review({ sections: { exec: 'A short paragraph.\n\n' + bullets(n) } }));
    rep.ok(!has(res, 'revision_points_count'), n + ' revision points must pass');
  }
  const three = check(H.review({ sections: { research: H.DEFAULT_SECTIONS.research + '\n\n' + crossBullets(3) } }));
  rep.ok(has(three, 'cross_domain_count'), '3 cross-domain bullets in the body: cross_domain_count expected');
  const moved = check(H.review({
    sections: { research: H.DEFAULT_SECTIONS.research + '\n\n' + crossBullets(2) },
    tail: ADVANCED + crossBullets(1, 'adv'),
  }));
  rep.ok(moved.ok === true, '2 in the body and 1 under the note must pass: ' + JSON.stringify(moved.violations));
  const allAdv = check(H.review({ tail: ADVANCED + crossBullets(3, 'adv') }));
  rep.ok(!has(allAdv, 'cross_domain_count'), 'extras under the advanced note must not count');
});

rep.arm('R8 limits', () => {
  const small = H.contractWith({ limits: { body_words_max: 40, limits_source: LIMIT_SRC } });
  rep.ok(has(check(H.review(), { contract: small }), 'length'), 'body_words_max 40: length expected');
  const none = H.contractWith({ limits: {} });
  const big = H.review({ sections: { reality: Array(400).fill('Plain ferry words for the reality check.').join(' ') } });
  rep.ok(!has(check(big, { contract: none }), 'length'), 'with no limits no length rule may fire');

  const rq2 = H.contractWith({ limits: { reflection_questions_max: 2, limits_source: LIMIT_SRC } });
  rep.ok(has(check(H.review(), { contract: rq2 }), 'reflection_questions_count'), '3 questions with max 2: reflection_questions_count expected');
  const rq3 = H.contractWith({ limits: { reflection_questions_max: 3, limits_source: LIMIT_SRC } });
  rep.ok(!has(check(H.review(), { contract: rq3 }), 'reflection_questions_count'), '3 questions with max 3 must pass');

  const pos = H.contractWith({ limits: { cross_domain_under: 'strategic_challenge', limits_source: LIMIT_SRC } });
  const inResearch = H.review({ sections: { research: H.DEFAULT_SECTIONS.research + '\n\n' + crossBullets(1) } });
  rep.ok(has(check(inResearch, { contract: pos }), 'cross_domain_position'), 'marker bullet under Research Validation: cross_domain_position expected');
  const inStrategic = H.review({ sections: { strategic: H.DEFAULT_SECTIONS.strategic + '\n\n' + crossBullets(1) } });
  rep.ok(!has(check(inStrategic, { contract: pos }), 'cross_domain_position'), 'marker bullet under Strategic Challenge must pass');
});

rep.arm('R9 forbidden body patterns flag the matching line only', () => {
  const c = H.contractWith({ forbidden_body_patterns: [{ id: 'zebra', pattern: 'zebra crossing', why: 'test pattern' }] });
  const text = H.wrap('We saw a zebra crossing near the dock.\n\nWe saw a plain road near the dock.');
  const res = check(text, { contract: c });
  const hits = H.findV(res, 'forbidden_pattern');
  rep.eq(hits.length, 1, 'forbidden_pattern count');
  rep.eq(hits[0].line, H.lineOf(text, 'zebra crossing'), 'forbidden_pattern line');
});

function withPolicy(policy) {
  const c = H.contractWith({});
  c.soft_terms = Object.assign({}, c.soft_terms, { policy });
  return c;
}
rep.arm('R10 soft terms by policy', () => {
  const text = H.wrap('The team keeps a shared database of tide tables.\n\nThe team drew a graph of ferry delays.');
  const dbLine = H.lineOf(text, 'database');
  const gLine = H.lineOf(text, 'graph of');
  const src = H.readFixture('source-student.md');

  const strict = check(text, { contract: withPolicy('strict'), sourceText: src });
  rep.ok(has(strict, 'internal_name', 'soft_term', dbLine) && has(strict, 'internal_name', 'soft_term', gLine), 'strict: both soft terms flagged even with source text');

  const ex = withPolicy('exempt_if_in_source');
  rep.ok(check(text, { contract: ex, sourceText: src }).ok === true, 'exempt_if_in_source: source holds both words, must pass');
  rep.ok(has(check(text, { contract: ex }), 'internal_name', 'soft_term'), 'exempt_if_in_source: no source text, must flag');
  rep.ok(has(check(text, { contract: ex, sourceText: 'Nothing relevant here.' }), 'internal_name', 'soft_term'), 'exempt_if_in_source: source lacks the words, must flag');
  const partial = check(text, { contract: ex, sourceText: 'We keep a database of tide tables.' });
  rep.ok(!has(partial, 'internal_name', 'soft_term', dbLine) && has(partial, 'internal_name', 'soft_term', gLine), 'exempt_if_in_source: only the word in the source is exempt');

  const co = withPolicy('compound_only');
  rep.ok(check(text, { contract: co }).ok === true, 'compound_only: bare words must pass');
  const comp = H.wrap('The team built a graph database.\n\nThe team built a knowledge graph.');
  const compRes = check(comp, { contract: co });
  rep.ok(has(compRes, 'internal_name', undefined, H.lineOf(comp, 'graph database')), 'compound_only: graph database must be flagged');
  rep.ok(has(compRes, 'internal_name', undefined, H.lineOf(comp, 'knowledge graph')), 'compound_only: knowledge graph must be flagged');

  for (const policy of ['strict', 'exempt_if_in_source', 'compound_only']) {
    const hard = H.wrap('The SystemArchetypeAgent ran.');
    const res = check(hard, { contract: withPolicy(policy), sourceText: 'The SystemArchetypeAgent ran in our notes.' });
    rep.ok(has(res, 'internal_name', 'agent_name'), policy + ': a hard-tier term must stay flagged');
  }

  const skip = check(text, { contract: withPolicy('strict'), softTerms: 'skip' });
  rep.ok(!has(skip, 'internal_name', 'soft_term'), "softTerms 'skip' must never report a soft term");
  rep.ok(skip.ok === true, "softTerms 'skip' on a clean text must pass");
});

rep.arm('R11 dash rule', () => {
  for (const [dash, tag] of [[H.EM, 'em'], [H.EN, 'en']]) {
    const text = H.wrap('A line with a ' + tag + ' dash' + dash + 'here.');
    const res = check(text);
    rep.ok(has(res, 'em_dash', undefined, H.lineOf(text, tag + ' dash')), tag + ' dash in the body: em_dash expected on its line');
  }
  const fm = ['---', 'methodology: deep-grade', 'review_contract: 1', 'team: Team Cedar Wharf' + H.EM + 'Two', '---'].join('\n');
  rep.ok(check(H.review({ fm })).ok === true, 'a dash in frontmatter must pass');
});

rep.arm('R12 the result never echoes matched text or body text', () => {
  const pre = H.readFixture('pre-fix.md');
  const res = check(pre);
  const json = JSON.stringify(res);
  for (const planted of ['SystemArchetypeAgent', 'LeveragePointAgent', 'Neo4j', 'artifact_file', 'Network Analysis', 'challenge-assumptions']) {
    rep.ok(json.indexOf(planted) === -1, 'result echoes planted text: ' + planted);
  }
  const body = M.splitArtifact(pre).body;
  for (let i = 0; i + 20 <= body.length; i += 3) {
    const slice = body.slice(i, i + 20);
    if (json.indexOf(slice) !== -1) throw new Error('result echoes a 20-character slice of the body at offset ' + i);
  }
  rep.ok(res.violations.length > 0, 'the pre-fix fixture must produce violations');
  for (const v of res.violations) {
    rep.eq(Object.keys(v).sort().join(','), 'class,line,rule,tier', 'violation keys');
  }
});

rep.arm('R13 timing on adversarial input', () => {
  check(H.review()); // warm up: loads the contract and builds the denylist once
  const unit = 'Neo Agen Agent? Neo4 MC Bra Theo-ish A' + 'a'.repeat(200) + ' ';
  let adv = 'A' + 'a'.repeat(60000) + '\n';
  while (adv.length < 200000) adv += unit;
  let t0 = process.hrtime.bigint();
  check(H.wrap(adv));
  let ms = Number(process.hrtime.bigint() - t0) / 1e6;
  rep.ok(ms < 1500, 'adversarial 200000-character body took ' + Math.round(ms) + ' ms');

  const lines = [];
  for (let i = 0; i < 5000; i++) lines.push('Line ' + i + ' of plain text about ferries and tides.');
  t0 = process.hrtime.bigint();
  check(H.wrap(lines.join('\n')));
  ms = Number(process.hrtime.bigint() - t0) / 1e6;
  rep.ok(ms < 1500, '5000-line body took ' + Math.round(ms) + ' ms');
});

rep.arm('R14 isReviewArtifact classification', () => {
  const o = { contract: H.realContract() };
  const fmText = (k) => '---\n' + k + '\n---\n# T\n';
  rep.ok(M.isReviewArtifact(fmText('methodology: grade'), o) === true, 'methodology grade');
  rep.ok(M.isReviewArtifact(fmText('methodology: deep-grade'), o) === true, 'methodology deep-grade');
  rep.ok(M.isReviewArtifact(fmText('review_contract: 1'), o) === true, 'review_contract key');
  rep.ok(M.isReviewArtifact(fmText('methodology: grade-grant'), o) === false, 'methodology grade-grant');
  rep.ok(M.isReviewArtifact('# Title only\n\nNo frontmatter.\n', o) === false, 'no frontmatter');
  rep.ok(M.isReviewArtifact(fmText('team: Team Cedar Wharf'), o) === false, 'frontmatter without the keys');
});

rep.arm('R15 splitArtifact', () => {
  const bom = String.fromCharCode(0xfeff);
  const crlf = bom + '---\r\nmethodology: grade\r\n---\r\n# Title\r\nline two\r\n';
  const s = M.splitArtifact(crlf);
  rep.ok(s.frontmatter !== null && s.frontmatter.replace(/\r/g, '').trim() === 'methodology: grade', 'BOM and CRLF frontmatter');
  rep.eq(s.bodyStartLine, 4, 'bodyStartLine with BOM and CRLF');
  rep.ok(s.body.replace(/\r/g, '').split('\n')[0] === '# Title', 'first body line');

  const text = H.review();
  const t = M.splitArtifact(text);
  rep.eq(t.bodyStartLine, H.FM_LINES.length + 1, 'bodyStartLine for a plain frontmatter');
  rep.eq(t.body.split('\n')[1], '# Review of the Cedar Wharf tide service', 'title line of a plain review (the first body line is the blank line after the fence)');

  const plain = '# No frontmatter\n\nJust text.\n';
  const p = M.splitArtifact(plain);
  rep.ok(p.frontmatter === null, 'no frontmatter returns null');
  rep.eq(p.body, plain, 'whole text is the body');
  rep.eq(p.bodyStartLine, 1, 'bodyStartLine without frontmatter');
});

rep.arm('R16 collectSourceText', () => {
  const room = H.mkTmpDir('rc370-room-');
  const outside = H.mkTmpDir('rc370-out-');
  const w = (rel, txt) => {
    const f = path.join(room, rel);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, txt);
  };
  w('01_Problem/problem.md', '# Problem\n\ntidewordalpha is the student problem text.\n');
  w('02_Solution/idea/idea.md', '# Idea\n\nferrywordbeta is the student idea text.\n');
  w('01_Problem/BRAIN.md', 'brainwordx\n');
  w('STATE.md', 'statewordx\n');
  w('02_Solution/REASONING.md', 'reasonwordx\n');
  w('ROOM.md', 'roomwordx\n');
  w('grades/g.md', 'gradewordx\n');
  w('deep-grades/d.md', 'deepwordx\n');
  w('03_Market/review.md', '---\nmethodology: grade\n---\nreviewwordx\n');
  w('04_Big/big.md', 'bigword '.repeat(20000));
  fs.writeFileSync(path.join(outside, 'secret.md'), 'outsidewordx\n');
  fs.mkdirSync(path.join(outside, 'dir'));
  fs.writeFileSync(path.join(outside, 'dir', 'more.md'), 'outsidedirwordx\n');
  let linked = true;
  try {
    fs.symlinkSync(path.join(outside, 'secret.md'), path.join(room, '01_Problem', 'link.md'));
    fs.symlinkSync(path.join(outside, 'dir'), path.join(room, '05_Link'));
  } catch (_) { linked = false; }

  const r = M.collectSourceText(room, { maxFiles: 200, maxBytes: 400000 });
  rep.ok(typeof r === 'string', 'collectSourceText returns a string');
  rep.ok(r.indexOf('tidewordalpha') !== -1 && r.indexOf('ferrywordbeta') !== -1, 'student words must be present');
  for (const bad of ['brainwordx', 'statewordx', 'reasonwordx', 'roomwordx', 'gradewordx', 'deepwordx', 'reviewwordx']) {
    rep.ok(r.indexOf(bad) === -1, 'excluded file text is present: ' + bad);
  }
  if (linked) {
    rep.ok(r.indexOf('outsidewordx') === -1 && r.indexOf('outsidedirwordx') === -1, 'a symlink target was read');
  }
  const small = M.collectSourceText(room, { maxFiles: 200, maxBytes: 2000 });
  rep.ok(Buffer.byteLength(small) <= 2000, 'maxBytes must bound the result');
  const one = M.collectSourceText(room, { maxFiles: 1, maxBytes: 400000 });
  rep.ok(!(one.indexOf('tidewordalpha') !== -1 && one.indexOf('ferrywordbeta') !== -1), 'maxFiles must bound the number of files read');
});

rep.done();
