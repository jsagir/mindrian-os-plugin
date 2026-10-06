#!/usr/bin/env node
'use strict';
/*
 * Phase 369.25 plan 05 -- the FeyMinto Theo ask (lib/core/feyminto/theo-ask.cjs).
 *
 * Arms:
 *   H1-H4  nestHandles: problem type precedence, canonical framework handles only, room_not_ready
 *   Q1-Q7  askTheoForNest: the four reads in order, null / egress sentinel / offline / at_birth, no "(no signal)"
 *   Q6     handlesFingerprint stability
 *   S1     the reads are all on the wire only through callTool (no framework_route call), THEO_ORIGINS untouched
 *   D1     dash guard on the files this plan wrote
 *
 * No network: every callTool here is an injected stub. Nothing touches ~/MindrianRooms or ~/.mindrian.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
let pass = 0;
let fail = 0;
function ok(cond, label, detail) {
  if (cond) { pass++; console.log('PASS: ' + label); }
  else { fail++; console.log('FAIL: ' + label + (detail ? ' -- ' + detail : '')); }
}

let ask = null;
try { ask = require(path.join(ROOT, 'lib', 'core', 'feyminto', 'theo-ask.cjs')); }
catch (e) { console.log('FAIL: load theo-ask.cjs -- ' + (e && e.message)); fail++; }

// Canonical framework names are read from the shipped vocabulary at test time, never guessed.
const names = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'framework-names.json'), 'utf8'));
const NAME_RE = /^[A-Za-z0-9 '(),.\/-]{1,60}$/;
const CANON = names.framework_names.filter((n) => NAME_RE.test(n)).slice(0, 5);
const VENTURE_A = 'Nimbus Robotics';
const VENTURE_B = 'Orla Venn';

const IDENTITY_OK = { ok: true, room_id: 'room-fixture', repaired: false };
const IDENTITY_BAD = { ok: false, reason: 'identity_missing' };
const TRIPLE_IDP = { reasoning: { exists: true, governing_thought: 'x', mece_status: 'warn', arguments_count: 2, evidence_density: 0.2 } };
const TRIPLE_NONE = { reasoning: { exists: false } };

function stubCallTool(responder) {
  const calls = [];
  const fn = async (tool, args) => {
    calls.push({ tool, args: JSON.parse(JSON.stringify(args)) });
    return responder(tool, args);
  };
  fn.calls = calls;
  return fn;
}
const GOOD = (tool) => {
  if (tool === 'find_frameworks_for_problem_type') return { rows: [{ problemType: 'IllDefined', chapters: [{ chapterId: 'c1' }, { chapterId: 'c2' }], matched: 2, total: 9 }] };
  if (tool === 'commands_for_problem_type') return { rows: [{ command: 'a', jtbd: 'j', framework: 'f' }, { command: 'b', jtbd: 'j', framework: 'f' }, { command: 'c', jtbd: 'j', framework: 'f' }], commandsTotal: 3 };
  if (tool === 'recommend_chain') return { grounded: true, chain: [{ step: 1, framework: 'f1' }, { step: 2, framework: 'f2' }] };
  if (tool === 'framework_neighborhood') return { name: 'x', chapters: [{ id: 'c1', label: 'L' }], brainRecords: [], commands: ['cmd'] };
  return null;
};

(async () => {
  if (!ask) {
    ['H1', 'H2', 'H3', 'H4', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'S1'].forEach((a) => { fail++; console.log('FAIL: ' + a + ' -- module missing'); });
  } else {
    // H1
    const h1 = ask.nestHandles({ section: 'problem-definition', identity: IDENTITY_OK, triple: TRIPLE_IDP, roomRung: null, frameworksInPlay: [] });
    ok(h1.ok === true, 'H1 ok');
    ok(JSON.stringify(h1.handles) === JSON.stringify({ problem_type: 'IllDefined', section_kind: 'problem-definition', job_id: 'find-problem', frameworks: [] }),
      'H1 handles are exactly problem_type, section_kind, job_id, frameworks', JSON.stringify(h1.handles));

    // H2
    const h2a = ask.nestHandles({ section: 'strategy', identity: IDENTITY_OK, triple: null, roomRung: 'Wicked', frameworksInPlay: [] });
    ok(h2a.ok === true && h2a.handles.problem_type === 'Wicked', 'H2 no MINTO and room rung Wicked gives Wicked', JSON.stringify(h2a));
    const h2b = ask.nestHandles({ section: 'strategy', identity: IDENTITY_OK, triple: TRIPLE_NONE, roomRung: null, frameworksInPlay: [] });
    ok(h2b.ok === false && h2b.not_asked === 'no_handle_to_send', 'H2 neither lens gives no_handle_to_send', JSON.stringify(h2b));
    const h2c = ask.nestHandles({ section: 'strategy', identity: IDENTITY_OK, triple: null, roomRung: VENTURE_A, frameworksInPlay: [] });
    ok(h2c.ok === false && h2c.not_asked === 'no_handle_to_send', 'H2 a non-rung room goal gives no_handle_to_send', JSON.stringify(h2c));
    const h2d = ask.nestHandles({ section: 'strategy', identity: IDENTITY_OK, triple: TRIPLE_IDP, roomRung: 'Wicked', frameworksInPlay: [] });
    ok(h2d.ok === true && h2d.handles.problem_type === 'IllDefined', 'H2 the nest own lens wins over the room rung', JSON.stringify(h2d));

    // H3
    const mixed = [VENTURE_A, CANON[0], CANON[1], VENTURE_B, CANON[2], CANON[3]];
    const h3 = ask.nestHandles({ section: 'problem-definition', identity: IDENTITY_OK, triple: TRIPLE_IDP, roomRung: null, frameworksInPlay: mixed });
    ok(h3.ok && h3.handles.frameworks.length === 3 && h3.handles.frameworks.every((f) => CANON.indexOf(f) !== -1), 'H3 at most three, all canonical', JSON.stringify(h3.handles && h3.handles.frameworks));
    ok(JSON.stringify(h3).indexOf(VENTURE_A) === -1 && JSON.stringify(h3).indexOf(VENTURE_B) === -1, 'H3 a venture name never reaches a handle');
    const h3b = ask.nestHandles({ section: 'problem-definition', identity: IDENTITY_OK, triple: null, roomRung: null, frameworksInPlay: [VENTURE_A, CANON[0], CANON[0]] });
    ok(h3b.ok && JSON.stringify(h3b.handles.frameworks) === JSON.stringify([CANON[0]]), 'H3 frameworks only (no problem type) still asks, duplicates collapse', JSON.stringify(h3b));
    const h3c = ask.nestHandles({ section: 'not-a-section', identity: IDENTITY_OK, triple: TRIPLE_IDP, roomRung: null, frameworksInPlay: [] });
    ok(h3c.ok && !('section_kind' in h3c.handles) && !('job_id' in h3c.handles), 'H3 a non-core section slug never becomes a section_kind handle', JSON.stringify(h3c));

    // H4
    const h4 = ask.nestHandles({ section: 'problem-definition', identity: IDENTITY_BAD, triple: TRIPLE_IDP, roomRung: null, frameworksInPlay: [] });
    ok(h4.ok === false && h4.not_asked === 'room_not_ready', 'H4 identity not ready gives room_not_ready', JSON.stringify(h4));

    // Q1
    const handlesFull = { problem_type: 'IllDefined', section_kind: 'problem-definition', job_id: 'find-problem', frameworks: [CANON[0], CANON[1]] };
    const t1 = stubCallTool(GOOD);
    const r1 = await ask.askTheoForNest(handlesFull, { callTool: t1, now: () => '2026-10-06T00:00:00.000Z', origin: 'https://theo-mcp.onrender.com' });
    const seq = t1.calls.map((c) => c.tool).join(',');
    ok(seq === 'find_frameworks_for_problem_type,commands_for_problem_type,recommend_chain,framework_neighborhood,framework_neighborhood', 'Q1 call order', seq);
    ok(JSON.stringify(t1.calls[0].args) === '{"problem_type":"IllDefined"}', 'Q1 find_frameworks args');
    ok(JSON.stringify(t1.calls[1].args) === '{"problem_type":"IllDefined"}' && !('limit' in t1.calls[1].args), 'Q1 commands args carry no limit key');
    ok(JSON.stringify(t1.calls[2].args) === '{"problem_type":"IllDefined","max_steps":6}', 'Q1 recommend_chain args');
    ok(t1.calls[3].args.framework === CANON[0] && Object.keys(t1.calls[3].args).length === 1 && t1.calls[4].args.framework === CANON[1], 'Q1 one neighborhood per handle');
    ok(r1.asked === true && r1.queries_sent === 5, 'Q1 asked true, queries_sent 5', JSON.stringify(r1));
    ok(r1.rows_returned.find_frameworks === 2 && r1.rows_returned.commands === 3 && r1.rows_returned.route === 2 && r1.rows_returned.neighborhood === 2,
      'Q1 rows_returned per read', JSON.stringify(r1.rows_returned));
    ok(r1.origin === 'https://theo-mcp.onrender.com' && r1.asked_at === '2026-10-06T00:00:00.000Z' && Array.isArray(r1.refusals) && r1.refusals.length === 0, 'Q1 provenance origin, asked_at, refusals');
    ok(JSON.stringify(r1.handles_sent) === JSON.stringify(handlesFull) && /^sha256:[0-9a-f]{64}$/.test(r1.handles_fingerprint), 'Q1 handles_sent and fingerprint recorded');
    ok(JSON.stringify(r1.handles_on_wire) === JSON.stringify(['problem_type', 'frameworks']), 'Q1 handles_on_wire names only the handle keys that appear in a query', JSON.stringify(r1.handles_on_wire));
    const t1b = stubCallTool(GOOD);
    const r1b = await ask.askTheoForNest({ frameworks: [CANON[0]] }, { callTool: t1b, now: () => 'T', origin: 'o' });
    ok(t1b.calls.length === 1 && t1b.calls[0].tool === 'framework_neighborhood' && r1b.asked === true, 'Q1 frameworks-only handles skip the three problem-type reads');

    // Q2
    const t2 = stubCallTool(() => null);
    const r2 = await ask.askTheoForNest(handlesFull, { callTool: t2, now: () => 'T', origin: 'o' });
    ok(r2.asked === false && r2.not_asked === 'theo_unavailable' && r2.queries_sent === 5, 'Q2 all null gives theo_unavailable with queries counted', JSON.stringify(r2));
    const t2b = stubCallTool(() => { throw new Error('boom'); });
    const r2b = await ask.askTheoForNest(handlesFull, { callTool: t2b, now: () => 'T', origin: 'o' });
    ok(r2b.asked === false && r2b.not_asked === 'theo_unavailable', 'Q2 a thrown call counts as transport, never throws');

    // Q3
    const SENT = (tool) => ({ error: 'egress_blocked', tool, egress_class: 'content_set', token_class: null, reason: 'x' });
    const t3 = stubCallTool((tool) => (tool === 'commands_for_problem_type' ? SENT(tool) : GOOD(tool)));
    const r3 = await ask.askTheoForNest(handlesFull, { callTool: t3, now: () => 'T', origin: 'o' });
    ok(r3.asked === true && r3.refusals.length === 1 && r3.refusals[0].tool === 'commands_for_problem_type' && r3.refusals[0].kind === 'egress_blocked', 'Q3 one refusal listed', JSON.stringify(r3.refusals));
    ok(r3.rows_returned.find_frameworks === 2 && r3.rows_returned.commands === 0 && r3.rows_returned.route === 2, 'Q3 the other reads still count', JSON.stringify(r3.rows_returned));
    const t3b = stubCallTool((tool) => SENT(tool));
    const r3b = await ask.askTheoForNest({ problem_type: 'IllDefined', frameworks: [CANON[0]] }, { callTool: t3b, now: () => 'T', origin: 'o' });
    ok(t3b.calls.length === 4 && r3b.asked === false && r3b.not_asked === 'egress_blocked', 'Q3 all four egress-blocked gives not_asked egress_blocked', JSON.stringify(r3b));
    const t3c = stubCallTool((tool) => (tool === 'recommend_chain' ? null : SENT(tool)));
    const r3c = await ask.askTheoForNest({ problem_type: 'IllDefined', frameworks: [CANON[0]] }, { callTool: t3c, now: () => 'T', origin: 'o' });
    ok(r3c.asked === false && r3c.not_asked === 'theo_unavailable', 'Q3 a mix of refusal and transport failure is theo_unavailable', JSON.stringify(r3c));

    // Q4
    const t4 = stubCallTool(GOOD);
    const r4 = await ask.askTheoForNest(handlesFull, { callTool: t4, offline: true, now: () => 'T', origin: 'o' });
    ok(t4.calls.length === 0 && r4.asked === false && r4.not_asked === 'offline' && r4.queries_sent === 0, 'Q4 offline sends nothing', JSON.stringify(r4));

    // Q5
    const everything = JSON.stringify([r1, r1b, r2, r2b, r3, r3b, r3c, r4, ask.NOT_ASKED_LINES]);
    ok(everything.indexOf('(no signal)') === -1, 'Q5 no result carries the string (no signal)');

    // Q6
    const fp = ask.handlesFingerprint;
    ok(fp(handlesFull) === fp(Object.assign({}, handlesFull)) && fp({ b: 1, a: 2 }) === fp({ a: 2, b: 1 }), 'Q6 equal handles, equal fingerprint');
    ok(fp(handlesFull) !== fp(Object.assign({}, handlesFull, { job_id: 'other' })) && fp(handlesFull) !== fp(Object.assign({}, handlesFull, { frameworks: [CANON[1], CANON[0]] }))
      && fp(handlesFull) !== fp(Object.assign({}, handlesFull, { problem_type: 'Wicked' })), 'Q6 any handle changing changes the fingerprint');

    // Q7
    const t7 = stubCallTool(GOOD);
    const r7 = await ask.askTheoForNest(handlesFull, { callTool: t7, atBirth: true, now: () => 'T', origin: 'o' });
    ok(t7.calls.length === 0 && r7.asked === false && r7.not_asked === 'at_birth', 'Q7 at_birth sends nothing', JSON.stringify(r7));

    // Q8 (369.25-17 carry-over from plan 08): the find_frameworks row's matched and total reach results.coverage
    const r8 = await ask.askTheoForNest({ problem_type: 'IllDefined' }, { callTool: stubCallTool(GOOD), now: () => 'T', origin: 'o' });
    ok(r8.results.coverage && r8.results.coverage.matched === 2 && r8.results.coverage.total === 9, 'Q8 row matched and total are carried into results.coverage', JSON.stringify(r8.results.coverage));
    const TOP = (tool, args) => (tool === 'find_frameworks_for_problem_type'
      ? { rows: [{ problemType: 'IllDefined', chapters: [{ chapterId: 'c1' }] }], coverage: { matched: 4, total: 33, status: 'partial' } }
      : GOOD(tool, args));
    const r8b = await ask.askTheoForNest({ problem_type: 'IllDefined' }, { callTool: stubCallTool(TOP), now: () => 'T', origin: 'o' });
    ok(r8b.results.coverage && r8b.results.coverage.matched === 4 && r8b.results.coverage.total === 33 && Object.keys(r8b.results.coverage).length === 2,
      'Q8 a top-level coverage block wins and only matched and total are kept', JSON.stringify(r8b.results.coverage));
    const NONE = (tool, args) => (tool === 'find_frameworks_for_problem_type' ? { rows: [{ problemType: 'IllDefined', chapters: [{ chapterId: 'c1' }] }] } : GOOD(tool, args));
    const r8c = await ask.askTheoForNest({ problem_type: 'IllDefined' }, { callTool: stubCallTool(NONE), now: () => 'T', origin: 'o' });
    ok(!('coverage' in r8c.results), 'Q8 no matched or total from Theo means no coverage key (the face then says it was not returned)', JSON.stringify(r8c.results.coverage));

    // enum and lines
    const keys = Object.keys(ask.NOT_ASKED).sort().join(',');
    ok(keys === 'at_birth,egress_blocked,no_handle_to_send,offline,room_not_ready,theo_unavailable', 'NOT_ASKED is the closed six', keys);
    ok(Object.keys(ask.NOT_ASKED).every((k) => typeof ask.NOT_ASKED_LINES[k] === 'string' && ask.NOT_ASKED_LINES[k].indexOf('not asked:') === 0), 'every reason has a reader line');
    ok(JSON.stringify(Array.from(ask.THEO_READS)) === JSON.stringify(['find_frameworks_for_problem_type', 'commands_for_problem_type', 'recommend_chain', 'framework_neighborhood']), 'THEO_READS is the four reads');
    ok(Object.isFrozen(ask.NOT_ASKED) && Object.isFrozen(ask.THEO_READS), 'NOT_ASKED and THEO_READS are frozen');

    // S1
    const src = fs.readFileSync(path.join(ROOT, 'lib', 'core', 'feyminto', 'theo-ask.cjs'), 'utf8');
    ok(/framework_route/.test(src) && !/callTool\(\s*'framework_route'/.test(src), 'S1 framework_route named in the header, never called');
    const bc = require(path.join(ROOT, 'lib', 'core', 'brain-client.cjs'));
    ok(bc.THEO_ORIGINS.length === 1, 'S1 THEO_ORIGINS still one element');
  }

  // D1
  const helper = require(path.join(ROOT, 'tests', 'helpers', 'isolated-home-36925.cjs'));
  const dashed = helper.dashGuard([
    path.join(ROOT, 'tests', 'test-36925-theo-ask.cjs'),
    path.join(ROOT, 'lib', 'core', 'feyminto', 'theo-ask.cjs'),
    path.join(ROOT, 'lib', 'core', 'part8-egress-guard.test.cjs'),
  ]);
  ok(dashed.length === 0, 'D1 no em or en dash in the files this plan wrote', dashed.join(','));

  console.log('\nPASS=' + pass + ' FAIL=' + fail);
  process.exit(fail === 0 ? 0 : 1);
})();
