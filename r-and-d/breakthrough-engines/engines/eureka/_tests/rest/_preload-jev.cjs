'use strict';
// Preload for running eureka-jev-judge.cjs as a CLI with stubbed dev-time client/guards.
const path = require('node:path'); const fs = require('node:fs');
const S = require('./_stubs.cjs');
const log = process.env.JEV_LOG;
S.extra['./shared.cjs'] = { writeJsonl: function (f, rows) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, rows.map(function (r) { return JSON.stringify(r); }).join('\n') + '\n'); }, readJsonl: function () { return []; }, deriveStatus: function () {} };
S.extra['eureka-recall.cjs'] = {
  STAGE_A_LANES: ['icm_declared', 'lexical'], STATUS_TITLE: 't',
  runDirFor: function (room, tag) { return path.join(room, 'run-' + tag); },
  readCandidates: function (room) { try { return { candidates: JSON.parse(fs.readFileSync(path.join(room, 'cands.json'), 'utf8')) }; } catch (e) { return null; } },
};
S.extra['navigation.cjs'] = { openRoomDbReadOnlyForCaller: function (room) { if (process.env.JEV_NODB) return null; const nodes = JSON.parse(fs.readFileSync(path.join(room, 'nodes.json'), 'utf8')); return { prepare: function () { return { get: function (id) { return nodes[id] ? { id: id, properties: JSON.stringify({ text: nodes[id] }) } : undefined; } }; }, close: function () {} }; } };
S.extra['jev-devtime-client.cjs'] = {
  loadKey: function () { return process.env.NOKEY ? null : 'sk-test-secret-123'; },
  makeEgressGuard: function () { return function () {}; },
  EGRESS_PROFILES: { usefulness_judge: {} },
  jev: async function (body, o) {
    if (log) fs.appendFileSync(log, JSON.stringify({ a: body.state.a_excerpt, b: body.state.b_excerpt }) + '\n');
    if (process.env.JEV_FAIL) throw new Error('upstream said Bearer abcdef0123456789 and sk-live-999 rejected');
    // deliberately position-biased judge: prefers whichever excerpt is shown first when it is longer
    const choice = body.state.a_excerpt.length >= body.state.b_excerpt.length ? 'useful' : 'not_useful';
    return { status: 200, json: { choice: choice, usage: { input_tokens: 10 } } };
  },
};
S.extra['jev-question-ceilings.cjs'] = {
  PINNED_MODEL: 'pinned-model-x',
  USEFULNESS_QUESTIONS: { usefulness: { criteria: { useful: 1 } } },
  composeGuard: function (g, c) { return function (b) { g(b); c(b); }; },
  makeUsefulnessCeiling: function (pairMap) { return function (body) { const ok = Array.from(pairMap.values()).some(function (v) { return v.a_excerpt === body.state.a_excerpt && v.b_excerpt === body.state.b_excerpt; }); if (!ok) throw new Error('ceiling guard: unknown pair state'); }; },
};
S.extra['jev-response-schema.cjs'] = { parseJevResponse: function (res) { return { ok: true, answers: { usefulness: { choice: res.json.choice, confidence: 0.7 } } }; } };
