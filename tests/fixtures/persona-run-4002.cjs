'use strict';
// Phase 400.2-13: a shared fixture for the real-research legs of the 400.2 tests.
// It builds a deep run up to a finished plan, a recording stand-in for the fetch of the corpus, and the helpers that
// run run-research and write readings. A test builds its room under os.tmpdir() and calls cleanup() at the end.
// No function here sends a network request: every fetch goes through the injected seam _fetchCorpusEnvelope.
const fs = require('node:fs');
const crypto = require('node:crypto');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..', '..');
const door = require(path.join(ROOT, 'scripts', 'persona-hats.cjs'));
const fam = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'families.cjs'));
const seEnv = require(path.join(ROOT, 'lib', 'core', 'recovery', 'stage-envelope.cjs'));
const roomDbMod = require(path.join(ROOT, 'lib', 'core', 'room-db.cjs'));
const navigation = require(path.join(ROOT, 'lib', 'core', 'navigation.cjs'));

const HATS = ['white', 'red', 'black', 'yellow', 'green', 'blue'];
const RESEARCH = ['white', 'black', 'yellow', 'green'];
const READ_HATS = ['white', 'red', 'black', 'yellow', 'green'];
const NOW = new Date('2026-11-25T10:20:30.000Z');
const HARBOR_STATE = '---\nventure: Harbor Light Studio\nstage: seed\n---\n\n# Harbor Light Studio\n\nA test venture.\n';
const GOOD = {
  white: ['battery recycling', 'grid storage'],
  black: ['supply chains', 'retainer pricing'],
  yellow: ['subscription models', 'hand off'],
  green: ['coral reefs', 'swarm logistics'],
};
// PS-09: the nature-terms handle of Green for the nature lens (AskNature).
const GOOD_NATURE = 'organisms that recover metals';
const NO_KEYS = { TAVILY_API_KEY: null, PATENTSVIEW_API_KEY: null };

const tmpRoots = [];
function mkTmp(label) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-4002-fixture-' + label + '-'));
  tmpRoots.push(d);
  return d;
}
function cleanup() {
  for (const d of tmpRoots) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) { /* ignore */ }
  }
}
function put(room, rel, text) {
  const abs = path.join(room, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text, 'utf8');
}
function harborRoom() {
  const parent = mkTmp('p');
  const room = path.join(parent, 'harbor-room');
  fs.mkdirSync(room, { recursive: true });
  put(room, 'STATE.md', HARBOR_STATE);
  put(room, 'problem-definition/core-problem.md', '# Core problem\nSmall studios lose clients at the hand-off.\n');
  put(room, 'market-analysis/size.md', '# Size\nAbout many studios in the region.\n');
  return room;
}
async function withEnvAsync(patch, fn) {
  const saved = {};
  for (const k of Object.keys(patch)) saved[k] = process.env[k];
  for (const k of Object.keys(patch)) { if (patch[k] === null) delete process.env[k]; else process.env[k] = patch[k]; }
  try { return await fn(); } finally {
    for (const k of Object.keys(saved)) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  }
}

let runCounter = 0;
function hexSeam() {
  let n = 0;
  return (len) => crypto.createHash('sha256').update('seam-' + (n += 1)).digest('hex').slice(0, len);
}
function envOf() {
  return { homeDir: mkTmp('home'), tmpDir: mkTmp('tmp') };
}
function opts(env, extra) {
  runCounter += 1;
  return Object.assign({ homeDir: env.homeDir, tmpDir: env.tmpDir, now: new Date(NOW.getTime() + runCounter * 7000), randomHex: hexSeam() }, extra || {});
}
function briefOf() {
  return {
    schema: 'mos.persona-brief/1',
    target: 'room',
    governing_question: 'Should the studio move to a fixed monthly retainer model for new clients?',
    sub_questions: ['Who pays first?', 'What breaks at the hand-off?'],
    reading_list: ['problem-definition/core-problem.md', 'market-analysis/size.md'],
    mode: 'deep',
    triage: { recommended: 'deep', reason: 'A pricing change with money at stake.' },
  };
}
function writeJsonTmp(label, name, obj) {
  const d = mkTmp(label);
  const p = path.join(d, name);
  fs.writeFileSync(p, JSON.stringify(obj), 'utf8');
  return p;
}
function specOf(hat) {
  return {
    schema: 'mos.persona-spec/1',
    hat,
    focus: 'Look at the ' + hat + ' side of the retainer question.',
    hat_questions: ['What does the room show?', 'What is missing?', 'What would change the view?'],
    must_not_judge: ['The price level.'],
    room_sources: ['problem-definition/core-problem.md'],
  };
}
function runToAccepted(room, env) {
  const res = door.cmdStart({ roomDir: room, briefPath: writeJsonTmp('brief', 'brief.json', briefOf()), mode: 'deep' }, opts(env));
  assert.equal(res.ok, true, JSON.stringify(res));
  const todo = res.to_build.concat(res.to_accept);
  for (const h of res.to_build) fs.writeFileSync(path.join(res.hats[h].dir, 'persona.json'), JSON.stringify(specOf(h)), 'utf8');
  if (res.to_build.length > 0) {
    const w = door.cmdWritePersona({ roomDir: room, runId: res.run_id }, opts(env));
    assert.equal(w.ok, true, JSON.stringify(w));
  }
  if (todo.length > 0) {
    const answer = {};
    for (const h of todo) answer[h] = { decision: 'accept' };
    const ap = writeJsonTmp('answer', 'answer.json', { schema: 'mos.persona-accept/1', run_id: res.run_id, hats: answer });
    const a = door.cmdAcceptPersona({ roomDir: room, runId: res.run_id, answerPath: ap }, opts(env));
    assert.equal(a.ok && a.accept_done, true, JSON.stringify(a));
  }
  return res;
}
// nature: the nature handle of green (PS-09); undefined gives GOOD_NATURE, null gives none. Other hats have none.
function writeHandles(res, hat, handles, nature) {
  const doc = {
    schema: 'mos.persona-handles/1',
    hat,
    handles: handles.map(h => ({ handle: h, why: 'It names the field of the problem.' })),
  };
  const n = nature === undefined ? GOOD_NATURE : nature;
  if (hat === 'green' && typeof n === 'string') doc.nature_handle = { handle: n, why: 'How a living system does the same job.' };
  fs.writeFileSync(path.join(res.hats[hat].dir, 'handles.json'), JSON.stringify(doc), 'utf8');
}
function ledgerOfRun(res) {
  return JSON.parse(fs.readFileSync(path.join(res.review_dir, 'run.json'), 'utf8'));
}

/**
 * A deep run taken to a finished plan. Call it inside withEnvAsync so the provider set is the one the leg wants.
 * options: db (default true), room (reuse a room), env (reuse an env), handles ({hat: [handle, handle]}),
 * nature (the nature handle of green; undefined gives GOOD_NATURE, null gives none).
 */
function planned(options) {
  const o = options || {};
  const room = o.room || harborRoom();
  if (o.db !== false) roomDbMod.closeRoomDb(roomDbMod.openRoomDb(room));
  const env = o.env || envOf();
  const res = runToAccepted(room, env);
  const handles = o.handles || GOOD;
  for (const h of RESEARCH) writeHandles(res, h, handles[h], o.nature);
  const out = door.cmdPlanResearch({ roomDir: room, runId: res.run_id }, opts(env));
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.deepEqual(out.planned, RESEARCH);
  return { room, env, res, plan: out.plan, ids: ledgerOfRun(res).sub_questions.map(s => s.id) };
}
function ledgerOf(ctx) {
  return ledgerOfRun(ctx.res);
}
function mapOf(ctx) {
  return door.readRunMap(ctx.env.homeDir, ctx.res.run_id, ctx.room);
}
function packOf(ctx, hat, file) {
  return JSON.parse(fs.readFileSync(path.join(ctx.res.hats[hat].dir, file || 'evidence.json'), 'utf8'));
}
function approveHat(plan, hat, hashes) {
  const p = plan.hats[hat];
  // The default approves every planned string, the nature string of green included (PS-09).
  const all = p.strings.map(s => s.q_hash).concat(p.nature && p.nature.state === 'planned' ? [p.nature.q_hash] : []);
  return { decision: 'approve', q_hashes: hashes || all, providers: p.providers.slice() };
}
function approvedFile(ctx, hats, over) {
  return writeJsonTmp('approved', 'approved.json', Object.assign({ schema: 'mos.persona-approved/1', run_id: ctx.res.run_id, plan_seq: 1, hats }, over || {}));
}
function approveAll(plan, skip) {
  const hats = {};
  for (const hat of RESEARCH) if (!(skip || []).includes(hat)) hats[hat] = approveHat(plan, hat);
  return hats;
}

function okEnv(source, items) {
  return seEnv.makeStageEnvelope({ stage: 'retrieval', engine: source, status: 'ok', payload: { results: items }, output: items });
}
function emptyEnv(source) {
  return seEnv.makeStageEnvelope({ stage: 'retrieval', engine: source, status: 'empty_valid', payload: { results: [] }, output: [] });
}
function failEnv(source, cls) {
  return seEnv.makeStageEnvelope({ stage: 'retrieval', engine: source, status: 'failed', failure_class: cls || 'http_error', retryable: false, error: 'forced failure' });
}
function itemsFor(args, n) {
  const out = [];
  for (let i = 1; i <= n; i += 1) {
    out.push({ title: 'Title ' + i + ' of ' + args.source, url: 'https://example.org/' + args.source + '/' + i + '/' + fam.qHash(args.query).slice(7, 15), abstract: 'About the field, item ' + i + '.' });
  }
  return out;
}
/** A recording stand-in for the fetch of the corpus. behave(args) may return an envelope. */
function makeSeam(behave, count) {
  const calls = [];
  const fn = async (args) => {
    calls.push({ source: args.source, query: args.query });
    if (behave) {
      const r = behave(args);
      if (r) return r;
    }
    return okEnv(args.source, itemsFor(args, count || 2));
  };
  return { fn, calls };
}
function go(ctx, approvedPath, seam, extra) {
  return door.cmdRunResearch({ roomDir: ctx.room, runId: ctx.res.run_id, approvedPath }, opts(ctx.env, Object.assign({ _fetchCorpusEnvelope: seam.fn, _sleep: async () => {} }, extra || {})));
}

/** One call: plan a run, run the research, and give back the context and the output. */
async function researched(options) {
  const o = options || {};
  const ctx = planned(o);
  const seam = o.seam || makeSeam(o.behave, o.count);
  const hats = o.hats ? (typeof o.hats === 'function' ? o.hats(ctx.plan) : o.hats) : approveAll(ctx.plan, o.skip);
  const out = await go(ctx, approvedFile(ctx, hats), seam);
  assert.equal(out.ok, true, JSON.stringify(out));
  return { ctx, out, seam };
}

function readingOf(run, hat, over) {
  const base = { schema: 'mos.persona-reading/1', run_id: run.res.run_id, hat };
  const value = hat === 'green' ? 'alternative_offered' : 'favours';
  base.positions = run.ids.map((id, i) => ({ sub_question: id, value, line: hat + ' line ' + i }));
  if (hat === 'white') Object.assign(base, { evidence: [], missing_data: ['The price of rival plans.'] });
  if (hat === 'black') Object.assign(base, { evidence: [], steelman: 'The best case.' });
  if (hat === 'yellow') Object.assign(base, { evidence: [], none_found: false });
  if (hat === 'green') Object.assign(base, { provocations: ['What if the client owns the hand-off?'], evidence: [] });
  return Object.assign(base, over || {});
}
function blueReadingOf(run, over) {
  return Object.assign({ schema: 'mos.persona-reading/1', run_id: run.res.run_id, hat: 'blue', skipped: ['No search was run for green.'], thin: ['The red hat gave only short lines.'], ask_next: ['Ask who pays first.'] }, over || {});
}
function writeReading(run, hat, obj) {
  fs.writeFileSync(path.join(run.res.hats[hat].dir, 'reading.json'), typeof obj === 'string' ? obj : JSON.stringify(obj), 'utf8');
}
function doCheck(run) {
  return door.cmdCheck({ roomDir: run.room, runId: run.res.run_id }, opts(run.env));
}
async function doMerge(run, counts) {
  const countsPath = path.join(run.res.inbox_dir, 'counts.json');
  fs.writeFileSync(countsPath, JSON.stringify(counts || { agent_runs: 7, stops: 3, cards: 4 }), 'utf8');
  return door.cmdMerge({ roomDir: run.room, runId: run.res.run_id, countsPath }, opts(run.env));
}

/** Row counts of room.db: all nodes, EvidenceClaim nodes, all edges, INFORMS edges. */
function dbCounts(room) {
  const db = navigation.openRoomDbForCaller(room);
  try {
    return {
      nodes: db.prepare('SELECT COUNT(*) AS n FROM nodes').get().n,
      claims: db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type = 'EvidenceClaim'").get().n,
      edges: db.prepare('SELECT COUNT(*) AS n FROM edges').get().n,
      informs: db.prepare("SELECT COUNT(*) AS n FROM edges WHERE type = 'INFORMS'").get().n,
    };
  } finally {
    navigation.closeRoomDbForCaller(db);
  }
}

module.exports = {
  ROOT, door, fam, seEnv, roomDbMod, navigation,
  HATS, RESEARCH, READ_HATS, NOW, GOOD, GOOD_NATURE, NO_KEYS,
  mkTmp, cleanup, put, harborRoom, withEnvAsync, envOf, opts, writeJsonTmp,
  runToAccepted, writeHandles, planned, ledgerOf, mapOf, packOf,
  approveHat, approvedFile, approveAll,
  okEnv, emptyEnv, failEnv, itemsFor, makeSeam, go, researched,
  readingOf, blueReadingOf, writeReading, doCheck, doMerge, dbCounts,
};
