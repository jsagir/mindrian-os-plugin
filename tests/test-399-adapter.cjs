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

  // -------------------------------------------------------------------------
  // P1 to P5: provider shapes, response fixtures, merged ask over a fake transport
  // -------------------------------------------------------------------------
  const G = require(path.join(AD, 'providers', 'gemini.cjs'));
  const J = require(path.join(AD, 'providers', 'jev.cjs'));
  const fixture = (n) => JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', '399', n), 'utf8'));

  function mixedReq() {
    return {
      context: { job_id: JOB, job_summary: SUMMARY, definition_level: 'ill-defined', last_command: CMD2 },
      questions: {
        q0001: { type: 'choice', template: 'next_command_v1', options: [CMD, CMD2, CMD3] },
        q0002: { type: 'yes_no', template: 'serves_job_v1', subject: CMD },
        q0003: { type: 'score', template: 'fit_score_v1', subject: CMD },
      },
    };
  }

  check('P1: gemini.buildBody gives input, noul/choice/score, stable option ids; constants', () => {
    const rr = A.renderRequest(mixedReq(), catalog);
    const body = G.buildBody(rr);
    assert.equal(body.model, 'gemini-decision-1');
    assert.equal(body.input, rr.context);
    assert.equal('state' in body, false);
    assert.equal(body.questions.q0001.type, 'choice');
    assert.deepEqual(Object.keys(body.questions.q0001.criteria), [CMD, CMD2, CMD3, 'none_of_these']);
    assert.equal(body.questions.q0002.type, 'noul');
    assert.equal('criteria' in body.questions.q0002, false);
    assert.equal(body.questions.q0003.type, 'score');
    assert.deepEqual(body.questions.q0003.criteria, ['Poor fit', 'Partial fit', 'Strong fit']);
    assert.equal(G.MAX_QUESTIONS, 1000);
    assert.equal(G.SORTS_OPTIONS, true);
    assert.equal(G.API_VERSION, 'v1beta');
    assert.equal(G.REQUEST_FIELD, 'input');
    assert.equal(G.PATH, null);
    assert.equal(G.PATH_CONFIRMED, false);
    assert.deepEqual(G.TYPE_MAP, { yes_no: 'noul', choice: 'choice', score: 'score' });
  });
  check('P2: jev.buildBody gives state, default jev-latest, kev-latest on request; constants', () => {
    const rr = A.renderRequest(mixedReq(), catalog);
    const body = J.buildBody(rr);
    assert.equal(body.model, 'jev-latest');
    assert.equal(body.state, rr.context);
    assert.equal('input' in body, false);
    assert.deepEqual(body.questions, G.buildBody(rr).questions);
    assert.equal(J.buildBody(rr, { model: 'kev-latest' }).model, 'kev-latest');
    assert.equal(J.buildBody(rr, { model: 'other-model' }).model, 'jev-latest');
    assert.equal(J.PATH, '/v1/systemone');
    assert.equal(J.REQUEST_FIELD, 'state');
    assert.equal(J.SORTS_OPTIONS, false);
    assert.equal(J.MAX_QUESTIONS, 20);
  });
  check('P2: validateProviderBody accepts each real provider render and refuses a tampered body', () => {
    const req = mixedReq();
    const rr = A.renderRequest(req, catalog);
    for (const [id, p] of [['gemini', G], ['jev', J]]) {
      const body = p.buildBody(rr);
      assert.deepEqual(L.validateProviderBody(id, body, req, catalog), { ok: true }, id);
      const bad = clone(body);
      bad.questions.q0002.instructions += ' with a room note';
      assert.equal(L.validateProviderBody(id, bad, req, catalog).ok, false, id);
    }
    assert.deepEqual(L.validateProviderBody('jev', J.buildBody(rr, { model: 'kev-latest' }), req, catalog), { ok: true });
    assert.equal(L.validateProviderBody('nope', {}, req, catalog).ok, false);
  });

  const EXPECT = {
    q0001: {
      type: 'choice',
      choice: CMD,
      confidence: 0.4528,
      probabilities: { [CMD]: 0.5622, [CMD2]: 0.2749, [CMD3]: 0.0985, none_of_these: 0.0644 },
    },
    q0002: { type: 'yes_no', p: 0.5305 },
    q0003: { type: 'score', score: 0.4124, confidence: 0.3814, probabilities: { 0: 0.6417, 1: 0.3041, 2: 0.0542 } },
  };
  const renderedMixed = A.renderRequest(mixedReq(), catalog).questions;

  check('P3: jev.parseResponse of the fixture gives neutral answers and usage', () => {
    const out = J.parseResponse(fixture('jev-response-shape.json'), renderedMixed);
    assert.deepEqual(out.answers, EXPECT);
    assert.deepEqual(out.usage, { input_tokens: 195, output_tokens: 227 });
  });
  check('P3: gemini.parseResponse of the fixture gives the same neutral answers; usage in both casings', () => {
    const out = G.parseResponse(fixture('gemini-response-shape.json'), renderedMixed);
    assert.deepEqual(out.answers, EXPECT);
    assert.deepEqual(out.usage, { input_tokens: 195, output_tokens: 0 });
    const camel = G.parseResponse({ answers: {}, usage: { totalInputTokens: 77 } }, renderedMixed);
    assert.equal(camel.usage.input_tokens, 77);
  });
  check('P3: fixtures carry _shape_source and no path, host or key', () => {
    for (const n of ['jev-response-shape.json', 'gemini-response-shape.json']) {
      const raw = fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', '399', n), 'utf8');
      assert.ok(JSON.parse(raw)._shape_source);
      assert.equal(/\/home\/|MindrianOS\/research|api\.|_KEY/.test(raw), false, n);
    }
  });

  check('P4: parseResponse never throws; missing, out-of-range and unknown ids are handled', () => {
    for (const P of [G, J]) {
      const base = clone(fixture(P === G ? 'gemini-response-shape.json' : 'jev-response-shape.json'));
      delete base.answers.q0002;
      base.answers.q0001.probabilities[CMD] = 1.5;
      base.answers.q9999 = { type: 'noul', noul: 0.4, choice: 'x' };
      const out = P.parseResponse(base, renderedMixed);
      assert.deepEqual(out.answers.q0002, { type: 'yes_no', missing: true });
      assert.deepEqual(out.answers.q0001, { type: 'choice', missing: true });
      assert.equal('q9999' in out.answers, false);
      assert.equal(out.answers.q0003.type, 'score');
      const neg = P.parseResponse({ answers: { q0002: P === G ? { noul: -0.1 } : { type: 'noul', noul: -0.1 } } }, renderedMixed);
      assert.equal(neg.answers.q0002.missing, true);
      const nan = P.parseResponse({ answers: { q0002: P === G ? { noul: NaN } : { type: 'noul', noul: NaN } } }, renderedMixed);
      assert.equal(nan.answers.q0002.missing, true);
      for (const junk of [null, undefined, 'text', 42, [], { answers: null }, { answers: 'x', usage: 5 }]) {
        const o = P.parseResponse(junk, renderedMixed);
        assert.equal(Object.keys(o.answers).length, 3);
        assert.deepEqual(o.usage, { input_tokens: 0, output_tokens: 0 });
        for (const k of Object.keys(o.answers)) assert.equal(o.answers[k].missing, true);
      }
    }
  });
  check('P4: a probability key outside the question options is dropped, not trusted', () => {
    const resp = clone(fixture('jev-response-shape.json'));
    resp.answers.q0001.probabilities['/mos:invented'] = 0.9;
    const out = J.parseResponse(resp, renderedMixed);
    assert.equal('/mos:invented' in out.answers.q0001.probabilities, false);
  });

  // A fake transport builds a typed answer for every question in the body it receives.
  function fakeAnswer(shape, q) {
    if (q.type === 'noul') return shape === 'jev' ? { type: 'noul', noul: 0.25 } : { noul: 0.25 };
    if (q.type === 'choice') {
      const keys = Object.keys(q.criteria);
      const probabilities = {};
      for (const k of keys) probabilities[k] = 1 / keys.length;
      const a = { choice: keys[0], confidence: 0.5, probabilities };
      return shape === 'jev' ? Object.assign({ type: 'choice' }, a) : a;
    }
    const a = { score: 0.5, confidence: 0.5, probabilities: { 0: 0.2, 1: 0.3, 2: 0.5 } };
    return shape === 'jev' ? Object.assign({ type: 'score' }, a) : a;
  }
  function fakeTransport(shape, calls) {
    return async (body, meta) => {
      calls.push({ meta, n: Object.keys(body.questions).length, field: shape === 'jev' ? body.state : body.input });
      const answers = {};
      for (const id of Object.keys(body.questions)) answers[id] = fakeAnswer(shape, body.questions[id]);
      return shape === 'jev' ? { model: body.model, answers, usage: { input_tokens: 10, output_tokens: 5 } } : { answers, usage: { total_input_tokens: 10 } };
    };
  }
  await checkAsync('P5: askDecisionModel merges 1,500 gemini questions in 2 transport calls', async () => {
    const calls = [];
    const out = await A.askDecisionModel(bigReq(1500), { provider: 'gemini', transport: fakeTransport('gemini', calls), catalog });
    assert.equal(out.ok, true);
    assert.deepEqual(calls.map((c) => c.n), [1000, 500]);
    assert.equal(Object.keys(out.answers).length, 1500);
    assert.deepEqual(out.answers.q1500, { type: 'yes_no', p: 0.25 });
    assert.deepEqual(out.usage, { input_tokens: 20, output_tokens: 0 });
    assert.equal(calls[0].field, calls[1].field);
  });
  await checkAsync('P5: askDecisionModel merges 45 jev questions in 3 transport calls', async () => {
    const calls = [];
    const out = await A.askDecisionModel(bigReq(45), { provider: 'jev', transport: fakeTransport('jev', calls), catalog });
    assert.equal(out.ok, true);
    assert.deepEqual(calls.map((c) => c.n), [20, 20, 5]);
    assert.equal(Object.keys(out.answers).length, 45);
    assert.deepEqual(out.usage, { input_tokens: 30, output_tokens: 15 });
  });
  await checkAsync('P5: a mixed request over the real providers gives typed neutral answers', async () => {
    const out = await A.askDecisionModel(mixedReq(), { provider: 'jev', transport: fakeTransport('jev', []), catalog, model: 'kev-latest' });
    assert.equal(out.ok, true);
    assert.equal(out.answers.q0001.type, 'choice');
    assert.equal(out.answers.q0002.type, 'yes_no');
    assert.equal(out.answers.q0003.type, 'score');
  });
  await checkAsync('P5: an unknown provider id is refused before any transport call', async () => {
    const calls = [];
    const out = await A.askDecisionModel(validReq(), { provider: 'other', transport: fakeTransport('jev', calls), catalog });
    assert.deepEqual([out.ok, out.reason, calls.length], [false, 'unknown_provider', 0]);
  });
  console.log('');
  console.log(passed + ' passed, ' + failed + ' failed');
  if (failed) process.exit(1);
  console.log('>>> test-399-adapter.cjs: PASSED');
})();
