#!/usr/bin/env node
'use strict';
// Phase 399-04: provider-neutral decision adapter and labels-only validator.
// Legs V1 to V7 (validator, render, chunking, askDecisionModel over an injected transport).
// Legs P1 to P5 (provider shapes, response fixtures) are appended in the same file.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..');
const AD = path.join(ROOT, 'lib', 'core', 'decision-advisor');
const L = require(path.join(AD, 'labels-only.cjs'));
const A = require(path.join(AD, 'adapter.cjs'));

let failed = 0;
let passed = 0;
function check(label, fn) {
  try {
    fn();
    passed += 1;
    console.log('ok: ' + label);
  } catch (e) {
    failed += 1;
    console.log('FAIL: ' + label + ' -- ' + (e && e.message ? e.message : String(e)));
  }
}
async function checkAsync(label, fn) {
  try {
    await fn();
    passed += 1;
    console.log('ok: ' + label);
  } catch (e) {
    failed += 1;
    console.log('FAIL: ' + label + ' -- ' + (e && e.message ? e.message : String(e)));
  }
}

const vocab = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'job-vocabulary.json'), 'utf8'));
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'command-registry.json'), 'utf8'));
const catalog = L.buildLabelCatalog();
const JOB = 'validate-idea';
const SUMMARY = vocab.jobs[JOB].summary;
const CMD = '/mos:validate';
const CMD2 = '/mos:challenge-assumptions';
const CMD3 = '/mos:scenario-plan';
const teachingOf = (c) => registry.commands.find((x) => x.command === c).teaching;

function validReq() {
  return {
    context: { job_id: JOB, job_summary: SUMMARY },
    questions: { q0001: { type: 'yes_no', template: 'serves_job_v1', subject: CMD } },
  };
}
const clone = (o) => JSON.parse(JSON.stringify(o));

// ---------------------------------------------------------------------------
// V1
// ---------------------------------------------------------------------------
check('V1: a valid request passes validateNeutralRequest', () => {
  assert.deepEqual(L.validateNeutralRequest(validReq(), catalog), { ok: true });
});
check('V1: catalog holds 20 jobs, every registry command, the definition levels', () => {
  assert.equal(catalog.jobs.size, vocab.ids.length);
  assert.equal(catalog.commands.size, registry.commands.length);
  assert.ok(catalog.definitionLevels.has('ill-defined'));
  assert.ok(catalog.templates.has('serves_job_v1'));
});
check('V1: a choice request with array options and a score request pass', () => {
  const r = validReq();
  r.questions.q0002 = { type: 'choice', template: 'next_command_v1', options: [CMD, CMD2, 'none_of_these'] };
  r.questions.q0003 = { type: 'score', template: 'fit_score_v1', subject: CMD };
  r.context.definition_level = 'ill-defined';
  r.context.wicked = true;
  r.context.last_command = CMD2;
  assert.deepEqual(L.validateNeutralRequest(r, catalog), { ok: true });
});

// ---------------------------------------------------------------------------
// V2
// ---------------------------------------------------------------------------
check('V2: a job_summary that differs by 1 character is refused', () => {
  const r = validReq();
  r.context.job_summary = SUMMARY.slice(0, -1) + (SUMMARY.slice(-1) === 'x' ? 'y' : 'x');
  const v = L.validateNeutralRequest(r, catalog);
  assert.equal(v.ok, false);
  assert.equal(v.reason, 'free_text_outside_label_set');
});
check('V2: a teaching gloss that differs by 1 character is refused', () => {
  const r = validReq();
  r.questions.q0002 = {
    type: 'choice',
    template: 'next_command_v1',
    options: { [CMD]: teachingOf(CMD) + '.', [CMD2]: teachingOf(CMD2) },
  };
  const v = L.validateNeutralRequest(r, catalog);
  assert.equal(v.ok, false);
  assert.equal(v.reason, 'free_text_outside_label_set');
  const ok = validReq();
  ok.questions.q0002 = {
    type: 'choice',
    template: 'next_command_v1',
    options: { [CMD]: teachingOf(CMD), [CMD2]: teachingOf(CMD2) },
  };
  assert.deepEqual(L.validateNeutralRequest(ok, catalog), { ok: true });
});
check('V2: a Unicode lookalike of a command name is refused (no widening normalisation)', () => {
  const fake = CMD.replace('a', 'а'); // Cyrillic a
  assert.notEqual(fake, CMD);
  for (const place of ['subject', 'last_command', 'options']) {
    const r = validReq();
    if (place === 'subject') r.questions.q0001.subject = fake;
    if (place === 'last_command') r.context.last_command = fake;
    if (place === 'options') r.questions.q0002 = { type: 'choice', template: 'next_command_v1', options: [fake] };
    const v = L.validateNeutralRequest(r, catalog);
    assert.equal(v.ok, false, place);
    assert.equal(v.reason, 'unknown_command', place);
  }
  const r2 = validReq();
  r2.context.job_summary = SUMMARY.replace('a', 'а');
  assert.equal(L.validateNeutralRequest(r2, catalog).reason, 'free_text_outside_label_set');
  const r3 = validReq();
  r3.context.job_id = JOB.replace('a', 'а');
  assert.equal(L.validateNeutralRequest(r3, catalog).reason, 'unknown_job');
  const r4 = validReq();
  r4.context.definition_level = 'ill-defined​';
  assert.equal(L.validateNeutralRequest(r4, catalog).reason, 'free_text_outside_label_set');
});

// ---------------------------------------------------------------------------
// V3
// ---------------------------------------------------------------------------
check('V3: unknown_key for an extra key at every level', () => {
  const a = validReq(); a.extra = 1;
  const b = validReq(); b.context.note = 'x';
  const c = validReq(); c.questions.q0001.text = 'free text';
  const d = validReq(); d.questions.bad_id = d.questions.q0001; delete d.questions.q0001;
  const e = validReq(); e.questions.q0001.options = [CMD];
  for (const r of [a, b, c, d, e]) {
    const v = L.validateNeutralRequest(r, catalog);
    assert.equal(v.ok, false);
    assert.equal(v.reason, 'unknown_key');
  }
});
check('V3: unknown_job, unknown_command, unknown_template, unknown_type', () => {
  const j = validReq(); j.context.job_id = 'not-a-job';
  assert.equal(L.validateNeutralRequest(j, catalog).reason, 'unknown_job');
  const c = validReq(); c.questions.q0001.subject = '/mos:not-a-command';
  assert.equal(L.validateNeutralRequest(c, catalog).reason, 'unknown_command');
  const t = validReq(); t.questions.q0001.template = 'free_form_v1';
  assert.equal(L.validateNeutralRequest(t, catalog).reason, 'unknown_template');
  const y = validReq(); y.questions.q0001.type = 'choice';
  assert.equal(L.validateNeutralRequest(y, catalog).reason, 'unknown_type');
  const o = validReq(); o.questions.q0002 = { type: 'choice', template: 'next_command_v1', options: [CMD, CMD] };
  assert.equal(L.validateNeutralRequest(o, catalog).reason, 'unknown_command');
});
check('V3: every refusal reason is in REFUSAL_REASONS, which is frozen', () => {
  assert.ok(Object.isFrozen(L.REFUSAL_REASONS));
  for (const r of ['not_an_object', 'unknown_key', 'free_text_outside_label_set', 'unknown_job', 'unknown_command', 'unknown_template', 'unknown_type', 'too_deep', 'too_many_nodes', 'not_finite', 'body_not_render_of_validated_request']) {
    assert.ok(L.REFUSAL_REASONS.includes(r), r);
  }
});

// ---------------------------------------------------------------------------
// V4
// ---------------------------------------------------------------------------
check('V4: too_deep at depth 9, too_many_nodes above the cap, not_finite for NaN and Infinity', () => {
  const deep = validReq();
  let cur = (deep.context.x = {});
  for (let i = 0; i < 10; i += 1) cur = (cur.a = {});
  assert.equal(L.validateNeutralRequest(deep, catalog).reason, 'too_deep');
  const wide = validReq();
  wide.context.x = new Array(200001).fill(0);
  assert.equal(L.validateNeutralRequest(wide, catalog).reason, 'too_many_nodes');
  const nan = validReq(); nan.context.wicked = NaN;
  assert.equal(L.validateNeutralRequest(nan, catalog).reason, 'not_finite');
  const inf = validReq(); inf.context.wicked = Infinity;
  assert.equal(L.validateNeutralRequest(inf, catalog).reason, 'not_finite');
});
check('V4: the validator never throws on null, arrays, strings, numbers, functions or circular input', () => {
  const circ = validReq(); circ.context.self = circ;
  const throwing = validReq();
  Object.defineProperty(throwing.context, 'job_id', { enumerable: true, get() { throw new Error('boom'); } });
  for (const bad of [null, undefined, [], 'text', 42, true, () => 1, circ, throwing, Object.create(null), { context: null, questions: null }, { context: [], questions: [] }]) {
    const v = L.validateNeutralRequest(bad, catalog);
    assert.equal(v.ok, false);
    assert.ok(L.REFUSAL_REASONS.includes(v.reason), String(v.reason));
  }
});

// ---------------------------------------------------------------------------
// V5
// ---------------------------------------------------------------------------
check('V5: renderContext joins job, level and last command in the fixed wording', () => {
  assert.equal(A.renderContext({ job_id: JOB }, catalog), 'Job to be done: ' + JOB + '. ' + SUMMARY);
  assert.equal(
    A.renderContext({ job_id: JOB, definition_level: 'ill-defined', last_command: CMD2 }, catalog),
    'Job to be done: ' + JOB + '. ' + SUMMARY + ' Problem definition level: ill-defined. Already run: ' + CMD2 + '.'
  );
});
check('V5: a serves_job_v1 question renders the recorded wording', () => {
  const rr = A.renderRequest(validReq(), catalog);
  assert.equal(rr.context, 'Job to be done: ' + JOB + '. ' + SUMMARY);
  assert.deepEqual(rr.questions.q0001, {
    type: 'yes_no',
    instructions: 'Would running this command help a user get this job done? Command ' + CMD + ': ' + teachingOf(CMD),
  });
});
check('V5: a next_command_v1 choice renders options keyed by command plus none_of_these', () => {
  const r = validReq();
  r.questions.q0002 = { type: 'choice', template: 'next_command_v1', options: [CMD, CMD2] };
  const q = A.renderRequest(r, catalog).questions.q0002;
  assert.equal(q.type, 'choice');
  assert.deepEqual(Object.keys(q.options), [CMD, CMD2, 'none_of_these']);
  assert.equal(q.options[CMD], teachingOf(CMD));
  assert.equal(q.options.none_of_these, 'None of these commands fits the job now.');
  assert.equal(A.NONE_OPTION_ID, 'none_of_these');
});
check('V5: a fit_score_v1 question renders the 3 levels', () => {
  const r = validReq();
  r.questions.q0003 = { type: 'score', template: 'fit_score_v1', subject: CMD };
  const q = A.renderRequest(r, catalog).questions.q0003;
  assert.deepEqual(q.levels, ['Poor fit', 'Partial fit', 'Strong fit']);
  assert.equal(q.type, 'score');
});
check('V5: renderRequest refuses an invalid request (throws, no body)', () => {
  const r = validReq(); r.context.note = 'x';
  assert.throws(() => A.renderRequest(r, catalog), /refused/);
});
check('V5: exports named in the plan exist and none is named decide', () => {
  for (const k of ['QUESTION_TYPES', 'QUESTION_TEMPLATES', 'NONE_OPTION_ID', 'PROVIDERS', 'renderContext', 'renderRequest', 'chunkRequest', 'askDecisionModel']) {
    assert.ok(k in A, k);
  }
  assert.equal('decide' in A, false);
  assert.deepEqual(Object.keys(A.QUESTION_TEMPLATES).sort(), ['fit_score_v1', 'next_command_v1', 'serves_job_v1']);
});

// ---------------------------------------------------------------------------
// V6
// ---------------------------------------------------------------------------
function bigReq(n) {
  const r = { context: { job_id: JOB }, questions: {} };
  for (let i = 1; i <= n; i += 1) r.questions['q' + String(i).padStart(4, '0')] = { type: 'yes_no', template: 'serves_job_v1', subject: CMD };
  return r;
}
check('V6: chunkRequest splits 1,500 into 1,000 + 500 and 45 into 20 + 20 + 5', () => {
  const a = A.chunkRequest(bigReq(1500), 1000);
  assert.deepEqual(a.map((c) => Object.keys(c.questions).length), [1000, 500]);
  const b = A.chunkRequest(bigReq(45), 20);
  assert.deepEqual(b.map((c) => Object.keys(c.questions).length), [20, 20, 5]);
});
check('V6: ids and order are kept and every chunk carries the same context', () => {
  const req = bigReq(45);
  const chunks = A.chunkRequest(req, 20);
  const ids = chunks.flatMap((c) => Object.keys(c.questions));
  assert.deepEqual(ids, Object.keys(req.questions));
  for (const c of chunks) assert.deepEqual(c.context, req.context);
  assert.throws(() => A.chunkRequest(req, 0), RangeError);
});

// ---------------------------------------------------------------------------
// V7 (stub providers: the real ones are checked in P1 to P5)
// ---------------------------------------------------------------------------
function stubProvider(id, max) {
  return {
    ID: id,
    MAX_QUESTIONS: max,
    buildBody(rendered) { return { model: 'stub', state: rendered.context, questions: rendered.questions }; },
    parseResponse(resp, questions) {
      const answers = {};
      for (const k of Object.keys(questions)) answers[k] = { type: questions[k].type, p: (resp.answers && resp.answers[k]) || 0 };
      return { answers, usage: { input_tokens: resp.n || 0, output_tokens: 0 } };
    },
  };
}
(async () => {
  await checkAsync('V7: a refused request never calls the transport and returns { ok: false, reason }', async () => {
    let calls = 0;
    const transport = async () => { calls += 1; return {}; };
    const r = validReq(); r.context.note = 'room content';
    const out = await A.askDecisionModel(r, { provider: 'gemini', transport, catalog, providers: { gemini: stubProvider('gemini', 1000) } });
    assert.equal(out.ok, false);
    assert.equal(out.reason, 'unknown_key');
    assert.equal(calls, 0);
  });
  await checkAsync('V7: a valid request calls transport once per chunk and merges the answers', async () => {
    const calls = [];
    const transport = async (body, meta) => {
      calls.push(meta);
      const answers = {};
      for (const k of Object.keys(body.questions)) answers[k] = 0.5;
      return { answers, n: Object.keys(body.questions).length };
    };
    const out = await A.askDecisionModel(bigReq(45), { provider: 'jev', transport, catalog, providers: { jev: stubProvider('jev', 20) } });
    assert.equal(out.ok, true);
    assert.equal(calls.length, 3);
    assert.deepEqual(calls.map((c) => c.chunkIndex), [0, 1, 2]);
    assert.equal(Object.keys(out.answers).length, 45);
    assert.equal(out.usage.input_tokens, 45);
  });
  await checkAsync('V7: a transport that throws gives { ok: false, reason: transport_error } with no message', async () => {
    const transport = async () => { throw new Error('secret host 10.0.0.1'); };
    const out = await A.askDecisionModel(validReq(), { provider: 'jev', transport, catalog, providers: { jev: stubProvider('jev', 20) } });
    assert.equal(out.ok, false);
    assert.equal(out.reason, 'transport_error');
    assert.equal(JSON.stringify(out).includes('10.0.0.1'), false);
  });
  await checkAsync('V7: validateProviderBody accepts the render and refuses a tampered body', async () => {
    const providers = { jev: stubProvider('jev', 20) };
    const req = validReq();
    const body = providers.jev.buildBody(A.renderRequest(req, catalog));
    assert.deepEqual(L.validateProviderBody('jev', body, req, catalog, providers), { ok: true });
    const bad = clone(body);
    bad.state += ' extra room text';
    assert.equal(L.validateProviderBody('jev', bad, req, catalog, providers).reason, 'body_not_render_of_validated_request');
    const bad2 = clone(body);
    bad2.questions.q0001.note = 'x';
    assert.equal(L.validateProviderBody('jev', bad2, req, catalog, providers).reason, 'body_not_render_of_validated_request');
    const badReq = validReq(); badReq.context.note = 'x';
    assert.equal(L.validateProviderBody('jev', body, badReq, catalog, providers).reason, 'unknown_key');
  });

  // @@P-LEGS@@
  console.log('');
  console.log(passed + ' passed, ' + failed + ' failed');
  if (failed) process.exit(1);
  console.log('>>> test-399-adapter.cjs: PASSED');
})();
