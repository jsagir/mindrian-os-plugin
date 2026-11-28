#!/usr/bin/env node
'use strict';
// Phase 400.2-12: run-research, the wrapper over the Bono research leg, the honest states and the evidence packs
// (scripts/persona-hats.cjs cmdRunResearch, stringState, hatResearchState). Legs S1 to S15.
// No test sends a network request: every fetch goes through the injected seam _fetchCorpusEnvelope.
const fs = require('node:fs');
const crypto = require('node:crypto');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..');
const DOOR_PATH = path.join(ROOT, 'scripts', 'persona-hats.cjs');

let failed = 0;
let passed = 0;
const queue = [];
function check(label, fn) {
  queue.push({ label, fn });
}

let door;
let fam;
let seEnv;
let roomDbMod;
let navigation;
try {
  door = require(DOOR_PATH);
  fam = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'families.cjs'));
  seEnv = require(path.join(ROOT, 'lib', 'core', 'recovery', 'stage-envelope.cjs'));
  roomDbMod = require(path.join(ROOT, 'lib', 'core', 'room-db.cjs'));
  navigation = require(path.join(ROOT, 'lib', 'core', 'navigation.cjs'));
} catch (e) {
  console.log('FAIL: a module is missing: ' + (e && e.message ? e.message : String(e)));
  process.exit(1);
}

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
const NO_KEYS = { TAVILY_API_KEY: null, PATENTSVIEW_API_KEY: null };
const FULL_KEYS = { TAVILY_API_KEY: 'dummy-value', PATENTSVIEW_API_KEY: 'dummy-value' };

const tmpRoots = [];
function mkTmp(label) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-4002-research-states-' + label + '-'));
  tmpRoots.push(d);
  return d;
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
    sub_questions: ['Who pays first?', 'What breaks at the hand-off?', 'What does the retainer replace?'],
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
  const w = door.cmdWritePersona({ roomDir: room, runId: res.run_id }, opts(env));
  assert.equal(w.ok, true, JSON.stringify(w));
  const answer = {};
  for (const h of todo) answer[h] = { decision: 'accept' };
  const ap = writeJsonTmp('answer', 'answer.json', { schema: 'mos.persona-accept/1', run_id: res.run_id, hats: answer });
  const a = door.cmdAcceptPersona({ roomDir: room, runId: res.run_id, answerPath: ap }, opts(env));
  assert.equal(a.ok && a.accept_done, true, JSON.stringify(a));
  return res;
}
function writeHandles(res, hat, handles) {
  fs.writeFileSync(path.join(res.hats[hat].dir, 'handles.json'), JSON.stringify({
    schema: 'mos.persona-handles/1',
    hat,
    handles: handles.map(h => ({ handle: h, why: 'It names the field of the problem.' })),
  }), 'utf8');
}
function ledgerOf(ctx) {
  return JSON.parse(fs.readFileSync(path.join(ctx.res.review_dir, 'run.json'), 'utf8'));
}
function mapOf(ctx) {
  return door.readRunMap(ctx.env.homeDir, ctx.res.run_id, ctx.room);
}
function packOf(ctx, hat, file) {
  return JSON.parse(fs.readFileSync(path.join(ctx.res.hats[hat].dir, file || 'evidence.json'), 'utf8'));
}
function shaOf(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/** A room taken to a finished plan. Call it inside withEnvAsync so the provider set is the one the leg wants. */
function planned(options) {
  const o = options || {};
  const room = harborRoom();
  if (o.db !== false) roomDbMod.closeRoomDb(roomDbMod.openRoomDb(room));
  const env = envOf();
  const res = runToAccepted(room, env);
  for (const h of RESEARCH) writeHandles(res, h, GOOD[h]);
  const out = door.cmdPlanResearch({ roomDir: room, runId: res.run_id }, opts(env));
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.deepEqual(out.planned, RESEARCH);
  return { room, env, res, plan: out.plan };
}
function approveHat(plan, hat, hashes) {
  const p = plan.hats[hat];
  return { decision: 'approve', q_hashes: hashes || p.strings.map(s => s.q_hash), providers: p.providers.slice() };
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
    out.push({ title: 'Title ' + i + ' of ' + args.source, url: 'https://example.org/' + args.source + '/' + i + '/' + fam.qHash(args.query).slice(7, 15), abstract: 'About ' + args.query + ', item ' + i + '.' });
  }
  return out;
}
/** A recording stand-in for the fetch of the corpus. behave(args) may return an envelope. */
function makeSeam(behave) {
  const calls = [];
  const fn = async (args) => {
    calls.push({ source: args.source, query: args.query });
    if (behave) {
      const r = behave(args);
      if (r) return r;
    }
    return okEnv(args.source, itemsFor(args, 2));
  };
  return { fn, calls };
}
function go(ctx, approvedPath, seam, extra) {
  return door.cmdRunResearch({ roomDir: ctx.room, runId: ctx.res.run_id, approvedPath }, opts(ctx.env, Object.assign({ _fetchCorpusEnvelope: seam.fn, _sleep: async () => {} }, extra || {})));
}
function walkKeys(v, out) {
  if (Array.isArray(v)) v.forEach(x => walkKeys(x, out));
  else if (v && typeof v === 'object') {
    for (const k of Object.keys(v)) { out.push(k); walkKeys(v[k], out); }
  }
  return out;
}

check('S1. NEGATIVE: an error from every provider is a failed string and a failed hat, never "found nothing"', async () => {
  await withEnvAsync(NO_KEYS, async () => {
    const ctx = planned();
    const seam = makeSeam((a) => failEnv(a.source, 'http_error'));
    const out = await go(ctx, approvedFile(ctx, approveAll(ctx.plan)), seam);
    assert.equal(out.ok, true, JSON.stringify(out));
    for (const hat of RESEARCH) {
      assert.equal(out.hats[hat], 'failed', hat);
      assert.equal(out.reasons[hat], 'provider_failed:http_error', hat);
      for (const s of out.strings[hat]) assert.equal(s.state, 'failed:provider_failed:http_error');
      const pack = packOf(ctx, hat);
      assert.equal(pack.research_state, 'failed');
      assert.deepEqual(pack.items, []);
      for (const s of pack.strings) {
        assert.equal(s.state, 'failed:provider_failed:http_error');
        assert.equal(s.providers[0].operation_state, 'not_executed');
        assert.equal(s.providers[0].reason, 'provider_failed:http_error');
      }
      assert.equal(ledgerOf(ctx).hats[hat].research, 'failed');
    }
    assert.ok(seam.calls.length >= 8);
  });
});

check('S2. a provider that answered with zero items gives ran_empty; only then may a hat say it found nothing', async () => {
  // Plan 19: with no Tavily key a web lens is a host-web search that the command runs; a run with no host results file
  // reports it as not run, so a hat is ran_empty only when every provider answered. The full key set makes every lens a
  // door provider (the host-web legs are in tests/test-4002-sources.cjs, W6).
  await withEnvAsync(FULL_KEYS, async () => {
    const ctx = planned();
    const seam = makeSeam((a) => emptyEnv(a.source));
    const out = await go(ctx, approvedFile(ctx, approveAll(ctx.plan)), seam);
    assert.equal(out.ok, true, JSON.stringify(out));
    for (const hat of RESEARCH) {
      assert.equal(out.hats[hat], 'ran_empty', hat);
      assert.equal(out.reasons[hat], null);
      const pack = packOf(ctx, hat);
      assert.equal(pack.research_state, 'ran_empty');
      assert.deepEqual(pack.items, []);
      for (const s of pack.strings) {
        assert.equal(s.state, 'ran_empty');
        assert.equal(s.partial, false);
        assert.equal(s.providers[0].operation_state, 'executed_empty');
        assert.equal(s.providers[0].items, 0);
        assert.equal(s.providers[0].cache_hit, false);
      }
    }
    assert.equal(ledgerOf(ctx).hats.white.research, 'ran_empty');
  });
});

check('S2b. NEGATIVE: one provider empty and one failed is not "found nothing"', async () => {
  await withEnvAsync(FULL_KEYS, async () => {
    const ctx = planned();
    const seam = makeSeam((a) => (a.source === 'tavily' ? failEnv('tavily', 'http_error') : emptyEnv(a.source)));
    const out = await go(ctx, approvedFile(ctx, { white: approveHat(ctx.plan, 'white') }), seam);
    assert.equal(out.ok, true, JSON.stringify(out));
    for (const s of out.strings.white) {
      assert.equal(s.state, 'ran_empty');
      assert.equal(s.partial, true);
    }
    assert.equal(out.hats.white, 'failed');
    assert.equal(out.reasons.white, 'provider_failed:http_error');
  });
});

check('S3. NEGATIVE: an empty frozen lens set gives failed:empty_lens_set and no fetch', async () => {
  await withEnvAsync(NO_KEYS, async () => {
    const ctx = planned();
    // Forge a plan with an empty lens set for white, and keep the hash of the ledger in step with it.
    const planPath = path.join(mapOf(ctx).scratch_root, 'plan.json');
    const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
    plan.hats.white.lens_set = [];
    plan.hats.white.host_lenses = [];
    plan.hats.white.host_searches = [];
    plan.hats.white.providers = [];
    fs.writeFileSync(planPath, JSON.stringify(plan, null, 2) + '\n', 'utf8');
    const ledgerPath = path.join(ctx.res.review_dir, 'run.json');
    const l = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
    l.plan_sha256 = shaOf(planPath);
    fs.writeFileSync(ledgerPath, JSON.stringify(l), 'utf8');
    const seam = makeSeam();
    const approved = approvedFile(ctx, { white: { decision: 'approve', q_hashes: plan.hats.white.strings.map(s => s.q_hash), providers: [] } });
    const out = await go(ctx, approved, seam, { preflightLenses: () => ({ available: [], unavailable: [] }) });
    assert.equal(out.ok, true, JSON.stringify(out));
    assert.equal(seam.calls.length, 0);
    assert.equal(out.hats.white, 'failed');
    assert.equal(out.reasons.white, 'empty_lens_set');
    for (const s of out.strings.white) assert.equal(s.state, 'failed:empty_lens_set');
  });
});

check('S4. a wire result that is not ok gives fetched_not_wired:wire_failed and no item; a room with no room.db gives no_db', async () => {
  await withEnvAsync(NO_KEYS, async () => {
    const ctx = planned();
    const seam = makeSeam();
    const out = await go(ctx, approvedFile(ctx, { white: approveHat(ctx.plan, 'white') }), seam, { wireAccept: () => ({ ok: false, reason: 'unresolved_target' }) });
    assert.equal(out.ok, true, JSON.stringify(out));
    assert.equal(out.hats.white, 'fetched_not_wired');
    assert.equal(out.reasons.white, 'wire_failed');
    for (const s of out.strings.white) assert.equal(s.state, 'fetched_not_wired:wire_failed');
    assert.deepEqual(packOf(ctx, 'white').items, []);
    assert.equal(ledgerOf(ctx).hats.white.research, 'fetched_not_wired');

    const ctx2 = planned({ db: false });
    const seam2 = makeSeam();
    const out2 = await go(ctx2, approvedFile(ctx2, { white: approveHat(ctx2.plan, 'white') }), seam2);
    assert.equal(out2.ok, true, JSON.stringify(out2));
    assert.equal(out2.hats.white, 'fetched_not_wired');
    assert.equal(out2.reasons.white, 'no_db');
    for (const s of out2.strings.white) assert.equal(s.state, 'fetched_not_wired:no_db');
    assert.deepEqual(packOf(ctx2, 'white').items, []);
  });
});

check('S4b. a provider with items and zero findings gives fetched_not_wired:filtered; items with no usable URL give wire_failed', async () => {
  await withEnvAsync(NO_KEYS, async () => {
    const ctx = planned();
    // A result of the driver in which the provider answered with 3 items and every finding was filtered out.
    const filtered = async () => ({
      ok: true,
      findings: [],
      lens_set: [{ lens: 'scholarly', weight: 1 }],
      research_mode: 'normal',
      providers: [{ provider: 'openalex', lens: 'scholarly', status: 'ok', reason: 'live_fetch', counts: { items: 3 }, operation: { state: 'executed_with_results', reason: null, result_count: 3, cache_hit: false } }],
    });
    const seam = makeSeam();
    const out = await go(ctx, approvedFile(ctx, { white: approveHat(ctx.plan, 'white') }), seam, { runSourceLens: filtered });
    assert.equal(out.ok, true, JSON.stringify(out));
    assert.equal(out.hats.white, 'fetched_not_wired');
    assert.equal(out.reasons.white, 'filtered');
    for (const s of out.strings.white) assert.equal(s.state, 'fetched_not_wired:filtered');
    assert.deepEqual(packOf(ctx, 'white').items, []);
    // Items with no URL reach the wirer, which refuses them.
    const ctx2 = planned();
    const noUrl = makeSeam((a) => okEnv(a.source, [{ title: 'A title', abstract: 'About ' + a.query }]));
    const out2 = await go(ctx2, approvedFile(ctx2, { white: approveHat(ctx2.plan, 'white') }), noUrl);
    assert.equal(out2.ok, true, JSON.stringify(out2));
    assert.equal(out2.hats.white, 'fetched_not_wired', JSON.stringify(out2.strings.white));
    assert.equal(out2.reasons.white, 'wire_failed');
    assert.deepEqual(packOf(ctx2, 'white').items, []);
  });
});

check('S5. one provider with results and one with an error is ran_with_results, partial, with the failed provider named', async () => {
  await withEnvAsync(FULL_KEYS, async () => {
    const ctx = planned();
    const seam = makeSeam((a) => (a.source === 'tavily' ? failEnv('tavily', 'http_error') : null));
    const out = await go(ctx, approvedFile(ctx, { white: approveHat(ctx.plan, 'white') }), seam);
    assert.equal(out.ok, true, JSON.stringify(out));
    assert.equal(out.hats.white, 'ran_with_results');
    const pack = packOf(ctx, 'white');
    assert.ok(pack.items.length >= 1);
    // Plan 19: arXiv is a second keyless provider of the hat.
    for (const it of pack.items) assert.ok(['openalex', 'arxiv'].includes(it.provider), it.provider);
    for (const s of pack.strings) {
      assert.equal(s.state, 'ran_with_results');
      assert.equal(s.partial, true);
      const t = s.providers.find(p => p.provider === 'tavily');
      assert.equal(t.operation_state, 'not_executed');
      assert.equal(t.reason, 'provider_failed:http_error');
      const o = s.providers.find(p => p.provider === 'openalex');
      assert.equal(o.operation_state, 'executed_with_results');
      assert.ok(o.items >= 1);
    }
  });
});

check('S6. NEGATIVE: with a failed provider the room corpus is never wired as web evidence', async () => {
  await withEnvAsync(NO_KEYS, async () => {
    const ctx = planned();
    const text = ctx.plan.hats.white.strings[0].text;
    // A research artifact of the room that matches the search string by its path.
    const { insertNode } = require(path.join(ROOT, 'lib', 'core', 'node-insert.cjs'));
    const db = roomDbMod.openRoomDb(ctx.room);
    try {
      insertNode(db, 'memory_artifact:research/battery-recycling-grid-notes', 'memory_artifact', JSON.stringify({ path: 'research/battery-recycling-data-statistics.md', section: 'research', kind: 'note' }), { source_path: 'research/battery-recycling-data-statistics.md', created_by: 'system', review_status: 'proposed', epistemic_type: 'extracted_fact' });
    } finally {
      roomDbMod.closeRoomDb(db);
    }
    // Control: the default substitute of the recovery path WOULD return a room item for this string.
    const filing = require(path.join(ROOT, 'lib', 'core', 'semantic-index', 'research-filing.cjs'));
    const control = filing.queryRoomCorpus(ctx.room, [text]);
    assert.ok(control && Array.isArray(control.results) && control.results.length >= 1, 'the control finds a room item: ' + JSON.stringify(control));
    const seam = makeSeam((a) => failEnv(a.source, 'http_error'));
    const out = await go(ctx, approvedFile(ctx, { white: approveHat(ctx.plan, 'white') }), seam);
    assert.equal(out.ok, true, JSON.stringify(out));
    assert.equal(out.hats.white, 'failed');
    assert.deepEqual(packOf(ctx, 'white').items, []);
    for (const s of out.strings.white) {
      assert.ok(s.substitute_calls >= 1, 'the substitute seam was reached');
      assert.notEqual(s.recovery_action, 'substituted');
      assert.equal(s.wired, 0);
    }
    const db2 = navigation.openRoomDbForCaller(ctx.room);
    try {
      assert.equal(db2.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type = 'EvidenceClaim'").get().n, 0);
    } finally {
      navigation.closeRoomDbForCaller(db2);
    }
    assert.equal(JSON.stringify(packOf(ctx, 'white')).includes('battery-recycling-data-statistics'), false);
  });
});

check('S7. each wired finding is an item with title, URL, tier, provider and summary, and the pack holds no verdict word', async () => {
  await withEnvAsync(NO_KEYS, async () => {
    const ctx = planned();
    const seam = makeSeam();
    const out = await go(ctx, approvedFile(ctx, approveAll(ctx.plan)), seam);
    assert.equal(out.ok, true, JSON.stringify(out));
    for (const hat of RESEARCH) {
      const pack = packOf(ctx, hat);
      assert.deepEqual(Object.keys(pack).sort(), ['hat', 'items', 'research_state', 'run_id', 'schema', 'strings']);
      assert.equal(pack.schema, 'mos.persona-evidence/1');
      assert.equal(pack.hat, hat);
      assert.equal(pack.run_id, ctx.res.run_id);
      assert.ok(pack.items.length >= 1 && pack.items.length <= 10);
      for (const it of pack.items) {
        assert.deepEqual(Object.keys(it).sort(), ['id', 'provider', 'q_hash', 'retrieved_at', 'summary', 'tier', 'title', 'url']);
        assert.ok(it.id.startsWith('EvidenceClaim:persona-' + hat + '-'), it.id);
        assert.match(it.id, /^EvidenceClaim:persona-[a-z]+-[0-9a-f]{12}:/);
        assert.equal(it.tier, 'Academic');
        assert.ok(['openalex', 'arxiv'].includes(it.provider), it.provider);
        assert.match(it.url, /^https:\/\/example\.org\//);
        assert.ok(it.summary.length <= 600);
        assert.ok(ctx.plan.hats[hat].strings.some(s => s.q_hash === it.q_hash));
      }
      const keys = walkKeys(pack, []).map(k => k.toLowerCase());
      for (const bad of ['disposition', 'stance', 'confidence', 'rank', 'score', 'ranking']) assert.equal(keys.includes(bad), false, bad);
      assert.equal(JSON.stringify(pack).includes('confirming'), false);
      assert.equal(JSON.stringify(pack).includes('supports'), false);
    }
    // the wired nodes are proposed, never confirmed
    const db = navigation.openRoomDbForCaller(ctx.room);
    try {
      const rows = db.prepare("SELECT review_status FROM nodes WHERE type = 'EvidenceClaim'").all();
      assert.ok(rows.length >= 4);
      for (const r of rows) assert.equal(r.review_status, 'proposed');
    } finally {
      navigation.closeRoomDbForCaller(db);
    }
  });
});

check('S8. White is fetched first; the other hats follow only after every White call', async () => {
  await withEnvAsync(NO_KEYS, async () => {
    const ctx = planned();
    const seam = makeSeam();
    const out = await go(ctx, approvedFile(ctx, approveAll(ctx.plan)), seam);
    assert.equal(out.ok, true, JSON.stringify(out));
    const whiteTexts = ctx.plan.hats.white.strings.map(s => s.text);
    const idx = seam.calls.map(c => whiteTexts.includes(c.query));
    const lastWhite = idx.lastIndexOf(true);
    const firstOther = idx.indexOf(false);
    assert.ok(lastWhite >= 1);
    assert.ok(firstOther > lastWhite, JSON.stringify(idx));
    // Two keyless door providers (openalex, arxiv) are asked each of the 8 approved strings.
    assert.equal(seam.calls.length, 16);
  });
});

check('S9. the White package is copied into white, red, black, yellow and green and not into blue', async () => {
  await withEnvAsync(NO_KEYS, async () => {
    const ctx = planned();
    const seam = makeSeam();
    const out = await go(ctx, approvedFile(ctx, approveAll(ctx.plan)), seam);
    assert.equal(out.ok, true, JSON.stringify(out));
    const white = packOf(ctx, 'white');
    assert.ok(white.items.length >= 1);
    const ref = shaOf(path.join(ctx.res.hats.white.dir, 'evidence.json'));
    for (const hat of READ_HATS) {
      const f = path.join(ctx.res.hats[hat].dir, 'shared-white.json');
      assert.equal(fs.existsSync(f), true, hat);
      assert.deepEqual(JSON.parse(fs.readFileSync(f, 'utf8')), white);
      assert.equal(shaOf(f), ref, hat);
    }
    assert.equal(fs.existsSync(path.join(ctx.res.hats.blue.dir, 'shared-white.json')), false);
    assert.equal(fs.existsSync(path.join(ctx.res.hats.blue.dir, 'evidence.json')), false);
    assert.equal(fs.existsSync(path.join(ctx.res.hats.red.dir, 'evidence.json')), false);
    for (const hat of RESEARCH) assert.equal(fs.existsSync(path.join(ctx.res.hats[hat].dir, 'evidence.json')), true, hat);
    // the packs are sealed in the ledger before run_research is done
    const l = ledgerOf(ctx);
    assert.equal(l.packs.shared_white, ref);
    for (const hat of RESEARCH) assert.equal(l.packs.evidence[hat], shaOf(path.join(ctx.res.hats[hat].dir, 'evidence.json')), hat);
  });
});

check('S10. a declined White leaves a copy with the state and zero items in five directories; the other hats still run', async () => {
  await withEnvAsync(NO_KEYS, async () => {
    const ctx = planned();
    const hats = approveAll(ctx.plan, ['white']);
    hats.white = { decision: 'refuse', q_hashes: [], providers: [] };
    const seam = makeSeam();
    const out = await go(ctx, approvedFile(ctx, hats), seam);
    assert.equal(out.ok, true, JSON.stringify(out));
    assert.equal(out.hats.white, 'declined');
    for (const hat of READ_HATS) {
      const copy = packOf(ctx, hat, 'shared-white.json');
      assert.equal(copy.research_state, 'declined', hat);
      assert.deepEqual(copy.items, []);
    }
    for (const hat of ['black', 'yellow', 'green']) assert.equal(out.hats[hat], 'ran_with_results', hat);
    assert.equal(seam.calls.length, 12);
  });
});

check('S11. the ledger holds the research state of the six hats, run_research is done and check is accepted', async () => {
  await withEnvAsync(FULL_KEYS, async () => {
    const ctx = planned();
    const seam = makeSeam((a) => (a.query.endsWith('failure cases') ? emptyEnv(a.source) : null));
    const out = await go(ctx, approvedFile(ctx, approveAll(ctx.plan)), seam);
    assert.equal(out.ok, true, JSON.stringify(out));
    const l = ledgerOf(ctx);
    assert.deepEqual(Object.keys(l.hats).sort(), HATS.slice().sort());
    assert.equal(l.hats.white.research, 'ran_with_results');
    assert.equal(l.hats.black.research, 'ran_empty');
    assert.equal(l.hats.yellow.research, 'ran_with_results');
    assert.equal(l.hats.green.research, 'ran_with_results');
    assert.equal(l.hats.red.research, 'never_searches');
    assert.equal(l.hats.blue.research, 'never_searches');
    assert.equal(l.steps.run_research.state, 'done');
    assert.deepEqual(l.research, { strings_approved: 8, strings_refused: 0 });
    assert.deepEqual(Object.keys(out.hats), HATS);
    assert.equal(out.hats.red, 'never_searches');
    const checked = door.cmdCheck({ roomDir: ctx.room, runId: ctx.res.run_id }, opts(ctx.env));
    assert.equal(checked.ok, true, JSON.stringify(checked));
    // a second call is refused
    const again = await go(ctx, approvedFile(ctx, approveAll(ctx.plan)), makeSeam());
    assert.deepEqual(again, { ok: false, reason: 'step_already_done:run_research' });
  });
});

check('S11b. the deep notice names the reason of a declined hat and of a failed hat', async () => {
  await withEnvAsync(NO_KEYS, async () => {
    const ctx = planned();
    const hats = approveAll(ctx.plan, ['white', 'yellow']);
    hats.white = { decision: 'defer', q_hashes: [], providers: [] };
    const seam = makeSeam((a) => (a.query.endsWith('failure cases') ? failEnv(a.source, 'http_error') : null));
    const out = await go(ctx, approvedFile(ctx, hats), seam);
    assert.equal(out.ok, true, JSON.stringify(out));
    const lines = door.deepNoticeLines(ledgerOf(ctx));
    assert.ok(lines.includes('Research not run for: white (deferred), yellow (no_answer).'), JSON.stringify(lines));
    assert.ok(lines.includes('Research failed for: black (provider_failed:http_error).'), JSON.stringify(lines));
  });
});

check('S12. NEGATIVE: no Brain lens, no Brain source and no brainFn reach the fetch', async () => {
  await withEnvAsync(FULL_KEYS, async () => {
    const ctx = planned();
    const real = require(path.join(ROOT, 'lib', 'core', 'bono', 'persona-research.cjs')).personaDispatchCell;
    const driver = require(path.join(ROOT, 'lib', 'lens-engine', 'source-lens-driver.cjs'));
    const ctxSeen = [];
    const optsSeen = [];
    const seam = makeSeam();
    const out = await go(ctx, approvedFile(ctx, approveAll(ctx.plan)), seam, {
      personaDispatchCell: (cell, c) => { ctxSeen.push(c); return real(cell, c); },
      runSourceLens: (o) => { optsSeen.push(o); return driver.runSourceLens(o); },
    });
    assert.equal(out.ok, true, JSON.stringify(out));
    assert.equal(ctxSeen.length, 8);
    for (const c of ctxSeen) {
      assert.equal(Object.prototype.hasOwnProperty.call(c, 'brainFn'), false);
      assert.equal(Object.prototype.hasOwnProperty.call(c, 'classifyFn'), false);
      assert.deepEqual(Object.keys(c).sort(), ['db', 'extractContextFn', 'roomDir', 'runSourceLensFn', 'sessionId', 'wireAcceptFn']);
      assert.match(c.sessionId, /^persona-(white|black|yellow|green)-[0-9a-f]{12}$/);
    }
    assert.equal(optsSeen.length, 8);
    for (const o of optsSeen) {
      for (const e of o.lensSet) assert.notEqual(e.lens, 'brain');
      assert.equal(typeof o._substituteFn, 'function');
      assert.equal(await o._substituteFn(), null);
    }
    for (const c of seam.calls) assert.notEqual(c.source, 'brain-cypher');
    const sources = new Set(seam.calls.map(c => c.source));
    assert.deepEqual([...sources].sort(), ['arxiv', 'openalex', 'patents', 'tavily']);
  });
});

check('S13. NEGATIVE: a plan string that changed shape is failed:handle_changed and is not fetched', async () => {
  await withEnvAsync(NO_KEYS, async () => {
    const ctx = planned();
    const planPath = path.join(mapOf(ctx).scratch_root, 'plan.json');
    const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
    const forged = 'sha256:' + 'a'.repeat(64);
    plan.hats.black.strings[0] = { text: 'Mixed Case failure cases', q_hash: forged, handle: 'Mixed Case', qualifier: 'failure cases', edited: false };
    fs.writeFileSync(planPath, JSON.stringify(plan, null, 2) + '\n', 'utf8');
    const ledgerPath = path.join(ctx.res.review_dir, 'run.json');
    const l = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
    l.plan_sha256 = shaOf(planPath);
    fs.writeFileSync(ledgerPath, JSON.stringify(l), 'utf8');
    const seam = makeSeam();
    const out = await go(ctx, approvedFile(ctx, { black: approveHat(plan, 'black', [forged]) }), seam);
    assert.equal(out.ok, true, JSON.stringify(out));
    assert.equal(seam.calls.length, 0);
    assert.equal(out.hats.black, 'failed');
    assert.equal(out.reasons.black, 'handle_changed');
    assert.equal(out.strings.black[0].state, 'failed:handle_changed');
  });
});

check('S14. NEGATIVE: a plan file that changed since planning is refused and nothing is fetched', async () => {
  await withEnvAsync(NO_KEYS, async () => {
    const ctx = planned();
    const planPath = path.join(mapOf(ctx).scratch_root, 'plan.json');
    const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
    plan.hats.white.strings[0].text = 'forged text data statistics';
    fs.writeFileSync(planPath, JSON.stringify(plan, null, 2) + '\n', 'utf8');
    const seam = makeSeam();
    const out = await go(ctx, approvedFile(ctx, approveAll(ctx.plan)), seam);
    assert.deepEqual(out, { ok: false, reason: 'plan_changed' });
    assert.equal(seam.calls.length, 0);
    assert.equal(ledgerOf(ctx).steps.run_research, undefined);
  });
});

check('S15. the router takes run-research with --approved and prints one JSON object (a refusal here)', async () => {
  const { spawnSync } = require('node:child_process');
  await withEnvAsync(NO_KEYS, async () => {
    const ctx = planned();
    const env2 = Object.assign({}, process.env, { MINDRIAN_HOME: ctx.env.homeDir });
    const bad = approvedFile(ctx, {}, { schema: 'wrong' });
    const r = spawnSync(process.execPath, [DOOR_PATH, 'run-research', '--room', ctx.room, '--run', ctx.res.run_id, '--approved', bad], { env: env2, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(JSON.parse(r.stdout), { ok: false, reason: 'schema_invalid:schema' });
    const miss = spawnSync(process.execPath, [DOOR_PATH, 'run-research', '--room', ctx.room, '--run', ctx.res.run_id], { env: env2, encoding: 'utf8' });
    assert.equal(miss.status, 2);
  });
});

(async () => {
  for (const t of queue) {
    try {
      await t.fn();
      passed += 1;
      console.log('ok: ' + t.label);
    } catch (e) {
      failed += 1;
      console.log('FAIL: ' + t.label + ' -- ' + (e && e.message ? e.message : String(e)));
    }
  }
  for (const d of tmpRoots) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) { /* ignore */ }
  }
  console.log(passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})();
