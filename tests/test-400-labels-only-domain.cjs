#!/usr/bin/env node
'use strict';
// Phase 400-07 (CY-06, RL-03): the Cynefin closed sets in the one labels-only validator, and the
// shared catalog fingerprint. Legs V1 to V6 (domain and move closed sets, 399 renders unchanged).
// Legs P1 to P4 (catalogFingerprint) follow in the same file.
// Run once with --write-fixture before the code edit to freeze the 399 renders. Do not run it again.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..');
const AD = path.join(ROOT, 'lib', 'core', 'decision-advisor');
const L = require(path.join(AD, 'labels-only.cjs'));
const A = require(path.join(AD, 'adapter.cjs'));
const AX = require(path.join(ROOT, 'lib', 'core', 'problem-axes.cjs'));
const GEMINI = require(path.join(AD, 'providers', 'gemini.cjs'));
const JEV = require(path.join(AD, 'providers', 'jev.cjs'));

const FIXTURE = path.join(ROOT, 'tests', 'fixtures', '400', 'render-399-sample.json');
const SAMPLE = path.join(ROOT, 'tests', 'fixtures', '399', 'neutral-request-sample.json');

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

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const clone = (o) => JSON.parse(JSON.stringify(o));
const vocab = readJson(path.join(ROOT, 'data', 'job-vocabulary.json'));
const registry = readJson(path.join(ROOT, 'data', 'command-registry.json'));
const JOB = 'validate-idea';
const SUMMARY = vocab.jobs[JOB].summary;
const CMD = '/mos:validate';
const CMD2 = '/mos:challenge-assumptions';
const CMD3 = '/mos:scenario-plan';
const teachingOf = (c) => registry.commands.find((x) => x.command === c).teaching;

// A request that uses all 3 old templates and every old context key.
function allOldReq() {
  return {
    context: { job_id: JOB, job_summary: SUMMARY, definition_level: 'ill-defined', wicked: true, last_command: CMD2 },
    questions: {
      q0001: { type: 'yes_no', template: 'serves_job_v1', subject: CMD },
      q0002: { type: 'choice', template: 'next_command_v1', options: { [CMD]: teachingOf(CMD), [CMD3]: teachingOf(CMD3), none_of_these: A.NONE_OPTION_GLOSS } },
      q0003: { type: 'score', template: 'fit_score_v1', subject: CMD3 },
    },
  };
}

function renders(req, catalog) {
  const rendered = A.renderRequest(req, catalog);
  return { request: req, render: rendered, gemini: GEMINI.buildBody(rendered), jev: JEV.buildBody(rendered, {}) };
}

if (process.argv.includes('--write-fixture')) {
  const cat = L.buildLabelCatalog();
  const out = {
    _note: 'Phase 400-07: frozen 399 renders (renderRequest plus both provider bodies) written before the Cynefin edit. Every later render must deep-equal this file.',
    sample: renders(readJson(SAMPLE), cat),
    all_old: renders(allOldReq(), cat),
  };
  fs.mkdirSync(path.dirname(FIXTURE), { recursive: true });
  fs.writeFileSync(FIXTURE, JSON.stringify(out, null, 2) + '\n');
  console.log('wrote ' + path.relative(ROOT, FIXTURE));
  process.exit(0);
}

const catalog = L.buildLabelCatalog();

function domainReq(domain) {
  const r = {
    context: { job_id: JOB, job_summary: SUMMARY, definition_level: 'ill-defined' },
    questions: { q0001: { type: 'yes_no', template: 'serves_job_v1', subject: CMD } },
  };
  if (arguments.length) r.context.cause_effect_domain = domain;
  return r;
}

// Refuse, never strip: the request object must deep-equal its copy from before the call.
function refusedUnchanged(req, reasons) {
  const before = clone(req);
  const v = L.validateNeutralRequest(req, catalog);
  assert.equal(v.ok, false, 'expected a refusal');
  const allowed = Array.isArray(reasons) ? reasons : [reasons];
  assert.ok(allowed.includes(v.reason), 'reason ' + v.reason + ' not in ' + allowed.join(','));
  assert.ok(L.REFUSAL_REASONS.includes(v.reason));
  assert.deepEqual(req, before, 'the validator changed the request');
  return v;
}

// ---------------------------------------------------------------------------
// V1: the 399 renders are byte-identical to the frozen fixture
// ---------------------------------------------------------------------------
check('V1: the frozen fixture exists', () => {
  assert.ok(fs.existsSync(FIXTURE), 'run once with --write-fixture before the code edit');
});
check('V1: the 399 sample request renders and builds both bodies as frozen', () => {
  const fx = readJson(FIXTURE);
  assert.deepEqual(fx.sample.request, readJson(SAMPLE));
  const now = renders(readJson(SAMPLE), catalog);
  assert.equal(JSON.stringify(now.render), JSON.stringify(fx.sample.render));
  assert.equal(JSON.stringify(now.gemini), JSON.stringify(fx.sample.gemini));
  assert.equal(JSON.stringify(now.jev), JSON.stringify(fx.sample.jev));
});
check('V1: a request with all 3 old templates and every old context key renders as frozen', () => {
  const fx = readJson(FIXTURE);
  assert.deepEqual(fx.all_old.request, allOldReq());
  const now = renders(allOldReq(), catalog);
  assert.equal(JSON.stringify(now.render), JSON.stringify(fx.all_old.render));
  assert.equal(JSON.stringify(now.gemini), JSON.stringify(fx.all_old.gemini));
  assert.equal(JSON.stringify(now.jev), JSON.stringify(fx.all_old.jev));
  assert.deepEqual(L.validateProviderBody('gemini', fx.all_old.gemini, allOldReq(), catalog), { ok: true });
  assert.deepEqual(L.validateProviderBody('jev', fx.all_old.jev, allOldReq(), catalog), { ok: true });
});

// ---------------------------------------------------------------------------
// V2: context.cause_effect_domain is a closed set
// ---------------------------------------------------------------------------
check('V2: cause_effect_domain complex passes and renders after the level part', () => {
  assert.deepEqual(L.validateNeutralRequest(domainReq('complex'), catalog), { ok: true });
  const ctx = A.renderRequest(domainReq('complex'), catalog).context;
  assert.ok(ctx.includes(' Cause and effect domain: complex.'), ctx);
  assert.equal(ctx, 'Job to be done: ' + JOB + '. ' + SUMMARY + ' Problem definition level: ill-defined. Cause and effect domain: complex.');
});
check('V2: the domain part sits before the wicked part and the last command part', () => {
  const r = domainReq('chaotic');
  r.context.wicked = true;
  r.context.last_command = CMD2;
  assert.equal(
    A.renderContext(r.context, catalog),
    'Job to be done: ' + JOB + '. ' + SUMMARY + ' Problem definition level: ill-defined. Cause and effect domain: chaotic. Wicked problem: yes. Already run: ' + CMD2 + '.'
  );
});
check('V2: every one of the 5 domains passes', () => {
  for (const d of AX.CAUSE_EFFECT_DOMAINS) assert.deepEqual(L.validateNeutralRequest(domainReq(d), catalog), { ok: true }, d);
});
check('V2: values outside the closed set are refused', () => {
  for (const bad of ['Complex', 'wicked', '', 'confused']) {
    const v = refusedUnchanged(domainReq(bad), 'free_text_outside_label_set');
    assert.equal(v.path, '$.context.cause_effect_domain');
  }
  for (const bad of [3, null]) refusedUnchanged(domainReq(bad), ['free_text_outside_label_set', 'not_an_object']);
});

// ---------------------------------------------------------------------------
// V3: fits_domain_v1 needs a subject and a context domain
// ---------------------------------------------------------------------------
check('V3: fits_domain_v1 with a registry command subject and a context domain passes', () => {
  const r = domainReq('complex');
  r.questions.q0002 = { type: 'yes_no', template: 'fits_domain_v1', subject: CMD3 };
  assert.deepEqual(L.validateNeutralRequest(r, catalog), { ok: true });
  assert.deepEqual(A.renderRequest(r, catalog).questions.q0002, {
    type: 'yes_no',
    instructions: 'Does this command fit a situation in the cause and effect domain named above? Command ' + CMD3 + ': ' + teachingOf(CMD3),
  });
});
check('V3: fits_domain_v1 without a context domain is refused unknown_template', () => {
  const r = domainReq();
  r.questions.q0002 = { type: 'yes_no', template: 'fits_domain_v1', subject: CMD3 };
  const v = refusedUnchanged(r, 'unknown_template');
  assert.equal(v.path, '$.questions.q0002.template');
});
check('V3: fits_domain_v1 with an options key is refused unknown_key', () => {
  const r = domainReq('complex');
  r.questions.q0002 = { type: 'yes_no', template: 'fits_domain_v1', subject: CMD3, options: [CMD] };
  refusedUnchanged(r, 'unknown_key');
});
check('V3: fits_domain_v1 with a subject outside the registry is refused unknown_command', () => {
  const r = domainReq('complex');
  r.questions.q0002 = { type: 'yes_no', template: 'fits_domain_v1', subject: '/mos:not-a-command' };
  refusedUnchanged(r, 'unknown_command');
});

// ---------------------------------------------------------------------------
// V4: move_type_v1 renders the 5 move types with fixed glosses
// ---------------------------------------------------------------------------
function moveReq() {
  const r = domainReq();
  r.questions.q0002 = { type: 'choice', template: 'move_type_v1', subject: CMD };
  return r;
}
check('V4: move_type_v1 renders a choice keyed by MOVE_TYPES in order with the glosses', () => {
  assert.deepEqual(L.validateNeutralRequest(moveReq(), catalog), { ok: true });
  const q = A.renderRequest(moveReq(), catalog).questions.q0002;
  assert.equal(q.type, 'choice');
  assert.equal(q.instructions, 'Which move does this command make? Command ' + CMD + ': ' + teachingOf(CMD));
  assert.deepEqual(Object.keys(q.options), AX.MOVE_TYPES.slice());
  for (const m of AX.MOVE_TYPES) assert.equal(q.options[m], A.MOVE_TYPE_GLOSSES[m]);
  assert.deepEqual(A.MOVE_TYPE_GLOSSES, {
    categorize: 'Sort the facts under a known practice.',
    analyze: 'Study the parts with expert analysis.',
    probe: 'Run a small safe-to-fail test and watch what happens.',
    act: 'Act at once to make the situation stable.',
    slice: 'Break the situation into parts that each fit one domain.',
  });
  assert.ok(Object.isFrozen(A.MOVE_TYPE_GLOSSES));
});
check('V4: a caller options key on move_type_v1 is refused unknown_key', () => {
  const r = moveReq();
  r.questions.q0002.options = { probe: A.MOVE_TYPE_GLOSSES.probe };
  refusedUnchanged(r, 'unknown_key');
});
check('V4: the Gemini and Jev bodies of move_type_v1 pass validateProviderBody', () => {
  const rendered = A.renderRequest(moveReq(), catalog);
  assert.deepEqual(L.validateProviderBody('gemini', GEMINI.buildBody(rendered), moveReq(), catalog), { ok: true });
  assert.deepEqual(L.validateProviderBody('jev', JEV.buildBody(rendered, {}), moveReq(), catalog), { ok: true });
});
check('V4: a body with one gloss changed is refused body_not_render_of_validated_request', () => {
  const body = GEMINI.buildBody(A.renderRequest(moveReq(), catalog));
  body.questions.q0002.criteria.probe = 'Run a big test.';
  const v = L.validateProviderBody('gemini', body, moveReq(), catalog);
  assert.equal(v.ok, false);
  assert.equal(v.reason, 'body_not_render_of_validated_request');
});
check('V4: both parsers read the move ids as choice keys', () => {
  const rendered = A.renderRequest(moveReq(), catalog);
  const resp = { answers: { q0002: { type: 'choice', choice: 'probe', probabilities: { probe: 0.7, analyze: 0.3 }, confidence: 0.7 } } };
  for (const P of [GEMINI, JEV]) {
    const a = P.parseResponse(resp, rendered.questions).answers.q0002;
    assert.equal(a.choice, 'probe', P.ID);
    assert.deepEqual(a.probabilities, { probe: 0.7, analyze: 0.3 });
  }
});

// ---------------------------------------------------------------------------
// V5: refuse, never strip
// ---------------------------------------------------------------------------
check('V5: refused requests are not changed by the validator', () => {
  const cases = [];
  const a = domainReq('Complex'); cases.push(a);
  const b = moveReq(); b.questions.q0002.options = ['probe']; cases.push(b);
  const c = domainReq(); c.questions.q0002 = { type: 'yes_no', template: 'fits_domain_v1', subject: CMD }; cases.push(c);
  const d = domainReq('complex'); d.context.cause_effect_note = 'x'; cases.push(d);
  const e = moveReq(); e.questions.q0002.type = 'yes_no'; cases.push(e);
  for (const r of cases) {
    const before = clone(r);
    const v = L.validateNeutralRequest(r, catalog);
    assert.equal(v.ok, false);
    assert.deepEqual(r, before);
  }
});

// ---------------------------------------------------------------------------
// V6: the old template map is unchanged; the catalog carries the new sets
// ---------------------------------------------------------------------------
check('V6: QUESTION_TEMPLATES keeps exactly the 3 old ids', () => {
  assert.deepEqual(Object.keys(A.QUESTION_TEMPLATES), ['serves_job_v1', 'next_command_v1', 'fit_score_v1']);
});
check('V6: DOMAIN_TEMPLATES holds the 2 new ids with the fixed wording', () => {
  assert.deepEqual(Object.keys(A.DOMAIN_TEMPLATES), ['fits_domain_v1', 'move_type_v1']);
  assert.deepEqual(A.DOMAIN_TEMPLATES.fits_domain_v1, {
    type: 'yes_no', needs: 'subject', needs_domain: true,
    prefix: 'Does this command fit a situation in the cause and effect domain named above? Command ',
  });
  assert.deepEqual(A.DOMAIN_TEMPLATES.move_type_v1, {
    type: 'choice', needs: 'subject', move_options: true,
    prefix: 'Which move does this command make? Command ',
  });
  assert.ok(Object.isFrozen(A.DOMAIN_TEMPLATES) && Object.isFrozen(A.DOMAIN_TEMPLATES.move_type_v1));
});
check('V6: templateSpec looks up the old map first, then the domain map, else null', () => {
  assert.equal(A.templateSpec('serves_job_v1'), A.QUESTION_TEMPLATES.serves_job_v1);
  assert.equal(A.templateSpec('move_type_v1'), A.DOMAIN_TEMPLATES.move_type_v1);
  assert.equal(A.templateSpec('nope_v1'), null);
  assert.equal(A.templateSpec('constructor'), null);
  assert.equal(A.templateSpec(undefined), null);
});
check('V6: catalog.templates holds 5 ids; catalog.domains and catalog.moveTypes equal the axes constants', () => {
  assert.deepEqual([...catalog.templates].sort(), ['fit_score_v1', 'fits_domain_v1', 'move_type_v1', 'next_command_v1', 'serves_job_v1']);
  assert.deepEqual([...catalog.domains], AX.CAUSE_EFFECT_DOMAINS.slice());
  assert.deepEqual([...catalog.moveTypes], AX.MOVE_TYPES.slice());
});
check('V6: no refusal reason was added', () => {
  assert.equal(L.REFUSAL_REASONS.length, 11);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
