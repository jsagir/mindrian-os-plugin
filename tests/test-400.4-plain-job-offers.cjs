#!/usr/bin/env node
'use strict';
// Phase 400.4 plan 08 (QA-F1): plain job labels and sentences in goal_job.offers and on the goal card.
//
// Legs P1 to P7:
//   P1 jobOffer(id) joins data/job-vocabulary.json: {id, label, sentence}; null for a non-job; a vocabulary id with no
//      jobs entry gives {id, label: id, sentence: null}.
//   P2 suggest_next goal_job.offers is 19 objects {id, label, sentence} in base id order, explore left out;
//      goal_job.offer_ids holds the same ids as bare strings.
//   P3 goal_job.how_to tells the host to show the label and the sentence of each offer; the pinned phrases stay.
//   P4 no label or sentence holds an em dash or an en dash.
//   P5 gate_render, kind strategy_goal, the option "Set this job" with a vocabulary job in its preview: the label
//      becomes "Set this job: <label without the final period>", the description is the job sentence; defer unchanged.
//   P6 gate_answer approve still writes the goal; a caller description is kept; a preview with a non-vocabulary id or
//      with explore leaves the label "Set this job".
//   P7 a strategy_goal card with other labels (the drift card), a general card and a mirror render are unchanged.
// Real registered handlers on a fake server, a born fixture room under an isolated home. No network.
// Node built-ins only. Hyphens only in this file.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const H = require('./helpers/isolated-home-36925.cjs');

const SESSION = 'test-4004-08-' + Date.now() + '-' + Math.random().toString(36).slice(2);
const VOC = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'job-vocabulary.json'), 'utf8'));
const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);
const JOB = 'find-problem';
const SET_LABEL = 'Set this job';

let passed = 0;
let failed = 0;
async function leg(label, fn) {
  try { await fn(); passed += 1; console.log('ok: ' + label); }
  catch (e) { failed += 1; console.log('FAIL: ' + label + ' -- ' + String(e && e.stack ? e.stack : e).split('\n').slice(0, 5).join(' | ')); }
}

function fakeServer(inner) {
  const registered = [];
  return {
    registered,
    server: {
      tool(name, _d, a, b) { registered.push({ name, handler: typeof b === 'function' ? b : a }); },
      registerTool(name, _c, handler) { registered.push({ name, handler }); },
      server: inner,
    },
  };
}

async function call(handler, args) {
  const res = await handler(args, { sessionId: SESSION });
  return JSON.parse(res.content[0].text);
}

function goalCard(preview, extra) {
  return [Object.assign({ id: 'rewrite-jtbd', label: SET_LABEL, preview: preview }, extra || {}), { id: 'defer', label: 'Not now' }];
}

async function main() {
  const registry = require(path.join(ROOT, 'lib', 'core', 'section-registry.cjs'));
  const jtbdState = require(path.join(ROOT, 'lib', 'hmi', 'jtbd-state.cjs'));

  await leg('P1 jobOffer joins the vocabulary summary and sentence', async () => {
    assert.equal(typeof registry.jobOffer, 'function');
    const o = registry.jobOffer(JOB);
    assert.deepEqual(o, { id: JOB, label: VOC.jobs[JOB].summary, sentence: VOC.jobs[JOB].sentence });
    assert.equal(registry.jobOffer('nope'), null);
    assert.equal(registry.jobOffer(''), null);
    assert.equal(registry.jobOffer(undefined), null);
    // A declared job that has no entry in the data file: the id is the label, the sentence is null.
    const missing = registry.JOB_VOCABULARY.find((id) => !VOC.jobs[id]);
    if (missing) assert.deepEqual(registry.jobOffer(missing), { id: missing, label: missing, sentence: null });
  });

  const iso = H.mkIsolatedHome('4004-08');
  const born = H.birthFixtureRoom({ iso, slug: 'plain', vname: 'Quokka Labs', ventureText: 'Quokka Labs onboarding platform' });
  if (!born || born.ok !== true) throw new Error('fixture birth failed: ' + JSON.stringify(born));
  const roomDir = fs.realpathSync(born.roomDir);
  const bind = require(path.join(ROOT, 'lib', 'core', 'session-binding.cjs'))
    .writeSessionBinding(SESSION, { bound: ['plain'], primary: 'plain', sticky: false }, { home: iso.roomsHome });
  if (!bind || bind.ok !== true) throw new Error('session binding failed: ' + JSON.stringify(bind));

  const sensors = require(path.join(ROOT, 'lib', 'mcp', 'tools', 'sensors.cjs'));
  const sFake = fakeServer({ getClientCapabilities() { return {}; } });
  sensors.register(sFake.server, { fallbackRoomDir: roomDir });
  const suggestNext = sFake.registered.find((r) => r.name === 'suggest_next').handler;

  const gate = require(path.join(ROOT, 'lib', 'mcp', 'tools', 'gate.cjs'));
  const gFake = fakeServer({ getClientCapabilities() { return {}; } });
  gate.register(gFake.server, { fallbackRoomDir: roomDir });
  const render = gFake.registered.find((r) => r.name === 'gate_render').handler;
  const answer = gFake.registered.find((r) => r.name === 'gate_answer').handler;

  const baseIds = registry.JOB_VOCABULARY.filter((id) => id !== 'explore').slice(0, 24);

  await leg('P2 offers are {id, label, sentence} in base order; offer_ids keeps the bare ids', async () => {
    const r = await call(suggestNext, { section: 'problem-definition' });
    const g = r.goal_job;
    assert.equal(g.state, 'not_set');
    assert.equal(g.offers.length, 19);
    assert.deepEqual(g.offers.map((o) => o.id), baseIds);
    assert.deepEqual(g.offer_ids, baseIds);
    for (const o of g.offers) {
      assert.deepEqual(Object.keys(o).sort(), ['id', 'label', 'sentence'], o.id);
      assert.equal(o.label, VOC.jobs[o.id].summary, o.id);
      assert.equal(o.sentence, VOC.jobs[o.id].sentence, o.id);
    }
    assert.ok(!g.offer_ids.includes('explore'));
    assert.ok(!g.offers.some((o) => o.id === 'explore'));
  });

  await leg('P3 how_to tells the host to show the label and the sentence of each offer', async () => {
    const r = await call(suggestNext, { section: 'problem-definition' });
    const t = r.goal_job.how_to;
    assert.ok(t.indexOf('No goal job ranks the next move.') === 0);
    assert.ok(t.indexOf('show the label and the sentence of each offer in goal_job.offers') !== -1);
    ['gate_render', '"strategy_goal"', 'approving ["rewrite-jtbd"]', 'gate_answer', 'goal_job.offers', 'Do not pick for the person',
      'unknown_gate', 'card_pending', 'strategy_ratification.goal_written true'].forEach((w) => {
      assert.ok(t.indexOf(w) !== -1, 'how_to names: ' + w);
    });
  });

  await leg('P4 no label or sentence holds an em dash or an en dash', async () => {
    const r = await call(suggestNext, { section: 'problem-definition' });
    for (const o of r.goal_job.offers) {
      for (const s of [o.label, o.sentence]) {
        assert.equal(typeof s, 'string', o.id);
        assert.ok(s.indexOf(EM) === -1 && s.indexOf(EN) === -1, o.id);
      }
    }
  });

  const offer = registry.jobOffer(JOB);
  const wantLabel = SET_LABEL + ': ' + offer.label.replace(/\.$/, '');

  await leg('P5 the goal card shows the plain job label and the job sentence', async () => {
    const r = await call(render, { header: 'Set the job', kind: 'strategy_goal', approving: ['rewrite-jtbd'], options: goalCard(JSON.stringify({ jtbd: JOB })) });
    assert.equal(r.ok, true, JSON.stringify(r));
    const set = r.card.options.find((o) => o.id === 'rewrite-jtbd');
    const defer = r.card.options.find((o) => o.id === 'defer');
    assert.equal(set.label, wantLabel);
    assert.equal(set.description, offer.sentence);
    assert.equal(defer.label, 'Not now');
    assert.ok(!defer.description);
    assert.equal(set.preview, JSON.stringify({ jtbd: JOB }));
    const body = JSON.stringify(r);
    assert.ok(body.indexOf(wantLabel) !== -1 && body.indexOf(offer.sentence) !== -1, 'the text rung shows label and sentence');
  });

  await leg('P6 gate_answer still writes the goal; caller description kept; bad previews keep the old label', async () => {
    assert.equal(jtbdState.getGoal(roomDir), null, 'precondition: no goal');
    const r = await call(render, { header: 'Set the job', kind: 'strategy_goal', approving: ['rewrite-jtbd'], options: goalCard(JSON.stringify({ jtbd: JOB })) });
    const done = await call(answer, { gate_id: r.gate_id, chosen: ['rewrite-jtbd'], verdict: 'approve' });
    assert.equal(done.ok, true, JSON.stringify(done));
    assert.equal(done.strategy_ratification.goal_written, true, JSON.stringify(done.strategy_ratification));
    assert.equal(jtbdState.getGoal(roomDir).jtbd, JOB);

    const kept = await call(render, { header: 'Set the job', kind: 'strategy_goal', approving: ['rewrite-jtbd'],
      options: goalCard(JSON.stringify({ jtbd: JOB }), { description: 'My own words.' }) });
    const keptOpt = kept.card.options.find((o) => o.id === 'rewrite-jtbd');
    assert.equal(keptOpt.label, wantLabel);
    assert.equal(keptOpt.description, 'My own words.');

    for (const preview of [JSON.stringify({ jtbd: 'not-a-job' }), JSON.stringify({ jtbd: 'explore' }), 'not json', JSON.stringify({ jtbd: 7 }), JSON.stringify({ rung: 'Wicked' })]) {
      const x = await call(render, { header: 'Set the job', kind: 'strategy_goal', approving: ['rewrite-jtbd'], options: goalCard(preview) });
      assert.equal(x.ok, true, JSON.stringify(x));
      const o = x.card.options.find((q) => q.id === 'rewrite-jtbd');
      assert.equal(o.label, SET_LABEL, preview);
      assert.ok(!o.description, preview);
    }
  });

  await leg('P7 other labels, a general card and a mirror render are unchanged', async () => {
    const drift = [
      { id: 'keep-jtbd', label: 'Keep the ratified job', description: 'Keep it.', preview: JSON.stringify({ jtbd: JOB }) },
      { id: 'rewrite-jtbd', label: 'Rewrite the job', description: 'Rewrite it.', preview: JSON.stringify({ jtbd: JOB }) },
      { id: 'climb', label: 'Climb the ladder', description: 'Up.' },
      { id: 'defer', label: 'Defer', description: 'Later.' },
    ];
    const a = await call(render, { header: 'Drift', kind: 'strategy_goal', options: drift });
    assert.equal(a.ok, true, JSON.stringify(a));
    assert.deepEqual(a.card.options.map((o) => [o.id, o.label, o.description]), drift.map((o) => [o.id, o.label, o.description]));
    const gen = await call(render, { header: 'General', options: [{ id: 'rewrite-jtbd', label: SET_LABEL, preview: JSON.stringify({ jtbd: JOB }) }, { id: 'no', label: 'No' }] });
    assert.equal(gen.ok, true, JSON.stringify(gen));
    assert.equal(gen.card.options.find((o) => o.id === 'rewrite-jtbd').label, SET_LABEL);
    const gs = JSON.stringify(gen.card.options);
    assert.ok(gs.indexOf(offer.sentence) === -1);
    // A mirror render takes its card from the room record: the label there is whatever was recorded, so a mirror of a
    // card with the plain label shows that label once, never twice.
    const src = await call(render, { header: 'Set the job', kind: 'strategy_goal', approving: ['rewrite-jtbd'], options: goalCard(JSON.stringify({ jtbd: JOB })) });
    assert.equal(src.ok, true);
    const m = await call(render, { mirror_of: src.gate_id, options: src.card.options.map((o) => ({ id: o.id, label: o.label })) });
    if (m.ok === true) {
      const lab = m.card.options.find((o) => o.id === 'rewrite-jtbd').label;
      assert.equal(lab, wantLabel);
    }
  });

  await leg('P8 no em dash or en dash in the files of this plan', async () => {
    const files = ['lib/core/section-registry.cjs', 'lib/mcp/tools/sensors.cjs', 'lib/mcp/tools/gate.cjs', 'tests/test-400.4-plain-job-offers.cjs']
      .map((f) => path.join(ROOT, f));
    assert.deepEqual(H.dashGuard(files), []);
  });

  console.log('PASSED=' + passed + ' FAILED=' + failed);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.log('FAIL: ' + (e && e.stack ? e.stack : e)); process.exit(1); });
