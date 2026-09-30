'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 363 Plan 20 Task 2 -- the Canon Part 8 sweep (DRP363-17, DRP363-09).
 *
 * One fixture room carries a planted marker in its prose. Every door then runs
 * with a fake OpenAlex key in the environment (OPENALEX_API_KEY=fake-key-363):
 *   D1  the CLI quick flow   (plan, grant approve, run-quick)
 *   D2  the CLI deep flow    (plan, review approve, the step loop to done)
 *   D3  filing               (basket, file-run) through the CLI
 *   D4  the MCP tool ops     (plan, grant_request + gate_answer, run_quick,
 *                             deep_plan, basket, file, pending, grant_status)
 *   D5  the ambient branch   (maybeQuick with a standing grant)
 *   D6  the structure live refresh (buildPlanLive with a recording stub client)
 * plus one failing-search run so the shared egress telemetry sink is written.
 *
 * Then the sweep asserts, over everything those doors touched:
 *   - the marker is in no child argv, stdout or stderr, no MCP response, no
 *     telemetry record, no cache file name or content, no Theo (brain client)
 *     call argument, no audit record, no new room file, and no new room.db
 *     node (a door never copies room text anywhere);
 *   - every audit record's q is an approved q from the plan files (round one)
 *     or is built only from approved slot phrases (later rounds), and the
 *     room-derived approved strings never reach argv, telemetry or Theo;
 *   - the API key is in no file under the room or the test home, no captured
 *     stream, and every replayed request carried it only as a Bearer header
 *     (has_auth true, never in the URL).
 *
 * Offline: every child fetch is the recorded OpenAlex replay (a logging
 * preload), the parent's fetch is the replay only inside one corpus call, and
 * the net guard counter is the last check. No em-dash or en-dash literals: those
 * characters are spelled with String.fromCharCode. Exit 0 pass, 1 fail, 77 skip.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const FAKE_KEY = 'fake-key-363';
const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos363-p8-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos363-p8-roomshome-'));
process.env.MINDRIAN_BRAIN_URL = 'http://127.0.0.1:1';
process.env.MINDRIAN_BRAIN_TIMEOUT_MS = '500';
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;

const ROOT = path.resolve(__dirname, '..');
const hygiene = require(path.join(__dirname, 'helpers', 'hygiene-355.cjs'));
hygiene.scrubVendorKey();
delete process.env.OPENALEX_EMAIL;
process.env.OPENALEX_API_KEY = FAKE_KEY;
const guard = hygiene.installNetGuard();
const NET_GUARD_FETCH = globalThis.fetch;
const { check, summary } = hygiene.makeChecker('363-20 Part 8 sweep over every door');

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

let buildRoom363 = null;
let GAP_TERM_363 = null;
let makeReplayFetch = null;
try {
  const fx = require(path.join(__dirname, 'helpers', 'fixture-room-363.cjs'));
  buildRoom363 = fx.buildRoom363;
  GAP_TERM_363 = fx.GAP_TERM_363;
  makeReplayFetch = require(path.join(__dirname, 'helpers', 'openalex-replay-363.cjs')).makeReplayFetch;
} catch (_e) {
  console.log('SKIP: 363-02 helpers absent');
  process.exit(77);
}

const REPLAY_HELPER = path.join(__dirname, 'helpers', 'openalex-replay-363.cjs');
const QS_DIR = path.join(ROOT, 'tests', 'fixtures', '363-question-sets');
function qsFile(name) { return JSON.parse(fs.readFileSync(path.join(QS_DIR, name + '.json'), 'utf8')); }

const planner = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'planner.cjs'));
const grants = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'grants.cjs'));
const auditLedger = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'audit-ledger.cjs'));
const AMBIENT = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'ambient.cjs'));
const structure = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'structure.cjs'));
const quick = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'quick.cjs'));
const corpus = require(path.join(ROOT, 'lib', 'core', 'research-corpus.cjs'));
const telemetryMod = require(path.join(ROOT, 'lib', 'core', 'rs-egress-telemetry.cjs'));
const brainClient = require(path.join(ROOT, 'lib', 'core', 'brain-client.cjs'));
const { registerCoreTools } = require(path.join(ROOT, 'lib', 'mcp', 'register-core-tools.cjs'));

const CLI_PATH = path.join(ROOT, 'scripts', 'research-planner.cjs');
const SYN = 'ultrasonic biofilm removal';
const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'mos363-p8-scratch-'));
const REPLAY_LOG = path.join(SCRATCH, 'child-replay-log.jsonl');

// -- captures ------------------------------------------------------------------
const CAP = { children: [], mcp: [], theo: [], stubTheo: [], inproc: [] };

// Wrap child_process.spawnSync so every child this test (or any door running in
// this process) starts is captured: argv, stdout, stderr.
const realSpawnSync = cp.spawnSync;
cp.spawnSync = function wrappedSpawnSync(cmd, args, opts) {
  const res = realSpawnSync.apply(cp, arguments);
  CAP.children.push({
    cmd: String(cmd),
    argv: Array.isArray(args) ? args.map(String) : [],
    stdout: res && res.stdout ? String(res.stdout) : '',
    stderr: res && res.stderr ? String(res.stderr) : '',
  });
  return res;
};
['spawn', 'execFile', 'execFileSync', 'exec', 'execSync'].forEach(function (name) {
  const real = cp[name];
  cp[name] = function wrapped(cmd, args) {
    CAP.children.push({ cmd: String(cmd), argv: Array.isArray(args) ? args.map(String) : [], stdout: '', stderr: '', via: name });
    return real.apply(cp, arguments);
  };
});

// Record every argument any door hands the shared Brain (Theo) client.
Object.keys(brainClient).forEach(function (name) {
  const real = brainClient[name];
  if (typeof real !== 'function') return;
  brainClient[name] = function wrappedBrain() {
    CAP.theo.push({ fn: name, args: JSON.stringify(Array.prototype.slice.call(arguments)) });
    return real.apply(this, arguments);
  };
});

const rooms = [];
function newRoom(role) {
  const r = buildRoom363({ role: role || 'researcher' });
  rooms.push(r);
  // Snapshot what already carries the marker (the seeded room prose and nodes)
  // so S7 can prove no door added to it.
  r.snapFiles = {};
  walkFiles(r.roomDir, []).forEach(function (f) {
    if (/room\.db/.test(path.basename(f))) return;
    const n = countOf(fs.readFileSync(f), r.marker);
    if (n > 0) r.snapFiles[f] = n;
  });
  r.snapNodes = nodesWithMarker(r);
  return r;
}
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function writeScratch(name, obj) {
  const file = path.join(SCRATCH, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2), 'utf8');
  return file;
}
function runDir(room, runId) { return path.join(room.roomDir, '.mindrian', 'research-runs', runId); }
function walkFiles(dir, out) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_e) { return out; }
  entries.forEach(function (e) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) walkFiles(abs, out); else if (e.isFile()) out.push(abs);
  });
  return out;
}
function countOf(buf, needle) {
  const text = Buffer.isBuffer(buf) ? buf.toString('latin1') : String(buf);
  let n = 0;
  let i = text.indexOf(needle);
  while (i !== -1) { n += 1; i = text.indexOf(needle, i + needle.length); }
  return n;
}

// -- the logging preload for spawned CLI children ------------------------------------
// Replays OpenAlex, and appends one JSON line per request: the query, and how the
// key rode (a Bearer header, never in the URL, never in another header).
function writeLoggingPreload(name, routeSrc) {
  const routeFile = path.join(SCRATCH, 'route-' + name + '.cjs');
  fs.writeFileSync(routeFile, routeSrc, 'utf8');
  const file = path.join(SCRATCH, 'preload-' + name + '.cjs');
  const body = [
    "'use strict';",
    "const fs = require('node:fs');",
    'const { makeReplayFetch } = require(' + JSON.stringify(REPLAY_HELPER) + ');',
    'const route = require(' + JSON.stringify(routeFile) + ');',
    'const KEY = ' + JSON.stringify(FAKE_KEY) + ';',
    'const inner = makeReplayFetch({ route: route, onCall: function (rec) {',
    '  fs.appendFileSync(' + JSON.stringify(REPLAY_LOG) + ', JSON.stringify({ q: rec.q, url: rec.url, has_auth: rec.has_auth, key_in_url: rec.key_in_url }) + \'\\n\');',
    '} });',
    'globalThis.fetch = async function (url, init) {',
    '  const h = (init && init.headers) || {};',
    '  const get = function (k) { if (typeof h.get === \'function\') return h.get(k); const kk = Object.keys(h).filter(function (x) { return x.toLowerCase() === k.toLowerCase(); })[0]; return kk ? h[kk] : undefined; };',
    '  const others = Object.keys(h).filter(function (x) { return x.toLowerCase() !== \'authorization\' && String(h[x]).indexOf(KEY) !== -1; });',
    '  fs.appendFileSync(' + JSON.stringify(REPLAY_LOG) + ', JSON.stringify({ auth_is_bearer: get(\'Authorization\') === \'Bearer \' + KEY, key_in_url: String(url).indexOf(KEY) !== -1, key_in_other_header: others.length > 0 }) + \'\\n\');',
    '  return inner(url, init);',
    '};',
    '',
  ].join('\n');
  fs.writeFileSync(file, body, 'utf8');
  return file;
}
const PRELOAD_ZERO = writeLoggingPreload('zero', 'module.exports = function route() { return \'gap_primary_zero\'; };\n');
const PRELOAD_THIN = writeLoggingPreload('thin', 'module.exports = function route() { return \'derivation_hit\'; };\n');

function cli(args, preload) {
  const env = Object.assign({}, process.env, {
    HOME: TMP_HOME,
    USERPROFILE: TMP_HOME,
    OPENALEX_API_KEY: FAKE_KEY,
    NODE_OPTIONS: '--require ' + preload,
  });
  delete env.TYPESAFE_API_KEY;
  const res = cp.spawnSync(process.execPath, [CLI_PATH].concat(args), { encoding: 'utf8', env: env, timeout: 120000 });
  let json = null;
  try { json = JSON.parse(String(res.stdout || '').trim()); } catch (_e) { json = null; }
  return { code: res.status, stdout: String(res.stdout || ''), stderr: String(res.stderr || ''), json: json };
}

function wsQs(room) {
  const qs = qsFile('whitespace-quick');
  qs.stated_question = 'Is there published work on ' + GAP_TERM_363 + '?';
  qs.leaves[0].question = qs.stated_question;
  qs.leaves[0].slots = { term: GAP_TERM_363 };
  qs.leaves[1].slots = { term: GAP_TERM_363, synonyms: [SYN] };
  qs.return_target = { section: room.zones.twoSection.sections[0] };
  return qs;
}

function deepLoop(room, runId, preload) {
  let finished = false;
  for (let i = 0; i < 80 && !finished; i += 1) {
    const n = cli(['deep-next', runId, '--room', room.roomDir], preload);
    if (n.code !== 0 || !n.json || n.json.ok !== true) return 'deep-next ' + n.code + ' ' + n.stdout.slice(0, 200);
    const step = n.json.step;
    if (step === 'fetch_round') {
      const f = cli(['deep-fetch', runId, '--room', room.roomDir], preload);
      if (f.code !== 0) return 'deep-fetch ' + f.stdout.slice(0, 200);
    } else if (step === 'dispatch_lanes') {
      for (let j = 0; j < n.json.payload.lanes.length; j += 1) {
        const p = n.json.payload.lanes[j];
        const records = readJson(path.join(room.roomDir, p.records_path)).records;
        const rows = records.length === 0 ? [] : [{ leaf_id: p.leaves[0].leaf_id, record_id: records[0].id, claim: 'Model claim', quote: records[0].title, label: 'supports' }];
        const r = cli(['deep-record', runId, p.lane, writeScratch('rows-' + runId + '-' + p.lane + '-' + i + '.json', rows), '--room', room.roomDir], preload);
        if (r.code !== 0) return 'deep-record ' + r.stdout.slice(0, 200);
      }
    } else if (step === 'reflect') {
      const r = cli(['deep-followups', runId, writeScratch('fu-' + runId + '-' + i + '.json', []), '--room', room.roomDir], preload);
      if (r.code !== 0) return 'deep-followups ' + r.stdout.slice(0, 200);
    } else if (step === 'extend_card') {
      const r = cli(['deep-extend', runId, writeScratch('dec-' + runId + '-' + i + '.json', { decision: 'stop' }), '--room', room.roomDir], preload);
      if (r.code !== 0) return 'deep-extend ' + r.stdout.slice(0, 200);
    } else if (step === 'counterevidence') {
      const ce = cli(['deep-counterevidence', runId, '--room', room.roomDir], preload);
      if (ce.code !== 0) return 'deep-counterevidence ' + ce.stdout.slice(0, 200);
      if (ce.json && ce.json.lane_payload) {
        const p = ce.json.lane_payload;
        const records = readJson(path.join(room.roomDir, p.records_path)).records;
        const rows = records.length === 0 ? [] : [{ leaf_id: p.leaves[0].leaf_id, record_id: records[0].id, claim: 'Counter claim', quote: records[0].title, label: 'contradicts' }];
        const r = cli(['deep-record', runId, 'CE', writeScratch('rows-ce-' + runId + '.json', rows), '--room', room.roomDir], preload);
        if (r.code !== 0) return 'deep-record CE ' + r.stdout.slice(0, 200);
      }
    } else if (step === 'synthesize') {
      const s = cli(['deep-synthesize', runId, '--room', room.roomDir], preload);
      if (s.code !== 0) return 'deep-synthesize ' + s.stdout.slice(0, 200);
      finished = true;
    } else if (step === 'done') {
      finished = true;
    }
  }
  return finished ? null : 'loop did not finish';
}

// -- in-process replay -----------------------------------------------------------------
const INPROC_REPLAYS = [];
function inprocReplay(route) {
  const r = makeReplayFetch({ route: route || function () { return 'gap_primary_zero'; } });
  INPROC_REPLAYS.push(r);
  return r;
}
function seam(replay) {
  return async function (args) {
    const prev = globalThis.fetch;
    globalThis.fetch = replay;
    try { return await corpus.fetchCorpusEnvelope(args); } finally { globalThis.fetch = prev; }
  };
}
async function withReplay(replay, fn) {
  globalThis.fetch = replay;
  try { return await fn(); } finally { globalThis.fetch = NET_GUARD_FETCH; }
}

function mcpClient(room, sessionId) {
  const captured = new Map();
  const stub = {
    tool: function (name, description, schema, handler) { captured.set(name, { handler: handler }); },
    registerTool: function (name, config, handler) { captured.set(name, { handler: handler }); },
  };
  registerCoreTools(stub, { fallbackRoomDir: room.roomDir, pluginRoot: ROOT, surface: 'desktop' });
  const reg = captured.get('research_run');
  const answerReg = captured.get('gate_answer');
  const extra = { sessionId: sessionId };
  function parse(raw) {
    const text = raw && raw.content && raw.content[0] && raw.content[0].text;
    CAP.mcp.push(String(text));
    try { return JSON.parse(text); } catch (_e) { return { _unparsed: String(text).slice(0, 300) }; }
  }
  return {
    call: async function (input) { return parse(await reg.handler(input, extra)); },
    answer: async function (gateId, chosen, verdict) { return parse(await answerReg.handler({ gate_id: gateId, chosen: chosen, verdict: verdict }, extra)); },
  };
}

function nodesWithMarker(room) {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(path.join(room.roomDir, '.mindrian', 'room.db'));
  try {
    return db.prepare('SELECT COUNT(*) AS n FROM nodes WHERE properties LIKE ?').get('%' + room.marker + '%').n;
  } finally { db.close(); }
}

async function leg(name, fn) {
  try {
    const r = await fn();
    if (r === undefined) return;
    check(name, r === true, String(r));
  } catch (e) {
    check(name, false, (e && e.stack) || String(e));
  }
}

async function main() {
  if (!fs.existsSync(CLI_PATH)) { console.log('SKIP: CLI absent'); return 77; }

  const room = newRoom('researcher');
  const marker = room.marker;
  check('setup: the marker is planted in room prose and in seeded room.db nodes', Object.keys(room.snapFiles).length >= 4 && room.snapNodes >= 4,
    'files ' + Object.keys(room.snapFiles).length + ' nodes ' + room.snapNodes);

  // D1: CLI quick ------------------------------------------------------------------
  let quickRunId = null;
  await leg('D1 CLI quick flow runs under the fake key', async function () {
    const qsPath = writeScratch('qs-quick.json', wsQs(room));
    const planned = cli(['plan', qsPath, '--room', room.roomDir, '--mode', 'quick', '--section', room.zones.twoSection.sections[0]], PRELOAD_ZERO);
    if (planned.code !== 0 || !planned.json || !planned.json.proposal) return 'plan ' + planned.stdout.slice(0, 200);
    quickRunId = planned.json.run_id;
    const approved = cli(['grant', 'approve', writeScratch('proposal.json', planned.json.proposal), '--room', room.roomDir, '--approved-via', 'cli'], PRELOAD_ZERO);
    if (approved.code !== 0) return 'grant approve ' + approved.stdout.slice(0, 200);
    const ran = cli(['run-quick', quickRunId, '--room', room.roomDir], PRELOAD_ZERO);
    if (ran.code !== 0 || !ran.json || ran.json.status !== 'done') return 'run-quick ' + ran.stdout.slice(0, 300);
    return true;
  });

  // D2: CLI deep ---------------------------------------------------------------------
  // A separate room: the quick and deep round-one searches are the same strings,
  // so in one room the deep run would read the local cache and send nothing.
  let deepRunId = null;
  const deepRoom = newRoom('researcher');
  await leg('D2 CLI deep flow runs under the fake key', async function () {
    const qsPath = writeScratch('qs-deep.json', wsQs(deepRoom));
    const planned = cli(['plan', qsPath, '--room', deepRoom.roomDir, '--mode', 'deep', '--section', deepRoom.zones.twoSection.sections[0]], PRELOAD_THIN);
    if (planned.code !== 0 || !planned.json || planned.json.next !== 'review') return 'plan ' + planned.stdout.slice(0, 300);
    deepRunId = planned.json.run_id;
    const appr = cli(['review', 'approve', deepRunId, '--room', deepRoom.roomDir, '--approved-via', 'cli'], PRELOAD_THIN);
    if (appr.code !== 0) return 'review approve ' + appr.stdout.slice(0, 200);
    const err = deepLoop(deepRoom, deepRunId, PRELOAD_THIN);
    if (err) return err;
    return true;
  });

  // D3: filing through the CLI ----------------------------------------------------------
  await leg('D3 CLI filing (basket, file-run) under the fake key', async function () {
    const basket = cli(['basket', quickRunId, '--room', room.roomDir], PRELOAD_ZERO);
    if (basket.code !== 0 || !basket.json || !basket.json.card) return 'basket ' + basket.stdout.slice(0, 200);
    const sel = writeScratch('sel.json', { approved: true, items: basket.json.card.payload.defaults.concat(['opportunity:0']) });
    const filed = cli(['file-run', quickRunId, sel, '--room', room.roomDir, '--approved-via', 'cli'], PRELOAD_ZERO);
    if (filed.code !== 0 || !filed.json || filed.json.ok !== true) return 'file-run ' + filed.stdout.slice(0, 300);
    const deepBasket = cli(['basket', deepRunId, '--room', deepRoom.roomDir], PRELOAD_THIN);
    if (deepBasket.code !== 0) return 'deep basket ' + deepBasket.stdout.slice(0, 200);
    return true;
  });

  // D4: MCP tool ops -----------------------------------------------------------------------
  let mcpRoom = null;
  await leg('D4 MCP tool ops (plan, grant gate, run_quick, deep_plan, basket, file, pending, grant_status) under the fake key', async function () {
    mcpRoom = newRoom('researcher');
    const c = mcpClient(mcpRoom, 'sess-p8');
    const planned = await c.call({ op: 'plan', question_set: wsQs(mcpRoom), mode: 'quick' });
    if (planned.ok !== true) return 'plan ' + JSON.stringify(planned).slice(0, 200);
    const req = await c.call({ op: 'grant_request', run_id: planned.run_id });
    if (!req.gate) return 'no gate ' + JSON.stringify(req).slice(0, 200);
    const ans = await c.answer(req.gate.gate_id, ['approve_standing'], 'approve');
    if (ans.ok !== true) return 'gate_answer ' + JSON.stringify(ans).slice(0, 200);
    const replay = inprocReplay();
    const done = await withReplay(replay, function () { return c.call({ op: 'run_quick', run_id: planned.run_id }); });
    if (done.status !== 'done') return 'run_quick ' + JSON.stringify(done).slice(0, 300);
    const b = await c.call({ op: 'basket', run_id: planned.run_id });
    if (!b.gate) return 'basket ' + JSON.stringify(b).slice(0, 200);
    const ids = b.items.filter(function (i) { return i.default_on; }).map(function (i) { return i.id; });
    const banswer = await c.answer(b.gate.gate_id, ids, 'approve');
    if (banswer.ok !== true) return 'basket answer ' + JSON.stringify(banswer).slice(0, 200);
    const filed = await c.call({ op: 'file', gate_id: b.gate.gate_id });
    if (filed.ok !== true) return 'file ' + JSON.stringify(filed).slice(0, 300);
    const deep = await c.call({ op: 'deep_plan', question_set: qsFile('scientific-roadmapping') });
    if (deep.ok !== true) return 'deep_plan ' + JSON.stringify(deep).slice(0, 200);
    const st = await c.call({ op: 'grant_status' });
    const pend = await c.call({ op: 'pending' });
    if (st.ok === false || pend.ok === false) return 'status or pending refused';
    return true;
  });

  // D5: the ambient branch -------------------------------------------------------------------
  let ambientRoom = null;
  await leg('D5 ambient branch under the fake key', async function () {
    ambientRoom = newRoom('researcher');
    const proposal = grants.buildStandingProposal(ambientRoom.roomDir, { terms: [{ term: GAP_TERM_363, synonyms: [SYN] }] });
    const g = planner.approveStandingGrant(ambientRoom.roomDir, proposal, { approvedVia: 'cli' });
    if (!g.ok) return 'grant ' + JSON.stringify(g);
    const replay = inprocReplay();
    const out = await AMBIENT.maybeQuick(ambientRoom.roomDir, { producers: { whitespace: { outcome: 'no_candidate', posture: 'run' } } }, {
      budgetMs: 4 * 60 * 1000, now: Date.parse('2026-09-30T10:00:00Z'), deltaHash: 'f'.repeat(64), deps: { fetchEnvelopeFn: seam(replay) },
    });
    CAP.inproc.push(JSON.stringify(out));
    if (out.outcome !== 'ran') return 'ambient ' + JSON.stringify(out);
    return true;
  });

  // D6: structure live refresh with a recording stub client ------------------------------------
  await leg('D6 structure live refresh reads only generic handles through the guarded client', async function () {
    const liveRoom = newRoom('researcher');
    const stub = {
      query: async function (cypher, params) {
        CAP.stubTheo.push(JSON.stringify({ cypher: cypher, params: params }));
        return { records: [] };
      },
    };
    const built = await planner.buildPlanLive(liveRoom.roomDir, qsFile('scientific-roadmapping'), { mode: 'deep', liveStructure: true, brainClient: stub });
    CAP.inproc.push(JSON.stringify({ status: built.status, structure_source: built.structure_source }));
    const direct = await structure.refreshLive({ brainClient: stub });
    CAP.inproc.push(JSON.stringify({ source: direct.source, reason: direct.reason }));
    if (CAP.stubTheo.length === 0) return 'the live refresh door made no read, so it was not exercised';
    return true;
  });

  // D7: a failing search so the shared egress telemetry sink is written ---------------------------
  let telemetryEntries = 0;
  await leg('D7 a failing search writes the shared egress telemetry sink (hash only)', async function () {
    const room7 = newRoom('researcher');
    const proposal = grants.buildStandingProposal(room7.roomDir, { terms: [{ term: GAP_TERM_363, synonyms: [SYN] }] });
    const g = planner.approveStandingGrant(room7.roomDir, proposal, { approvedVia: 'cli' });
    if (!g.ok) return 'grant ' + JSON.stringify(g);
    const built = planner.buildPlan(room7.roomDir, wsQs(room7), { mode: 'quick' });
    const replay = inprocReplay(function () { return 'SENTINEL_500'; });
    const res = await quick.runQuick(room7.roomDir, built.plan, { fetchEnvelopeFn: seam(replay), now: Date.now() });
    if (res.status !== 'done') return 'run ' + res.status + ' ' + res.reason;
    try { telemetryEntries = JSON.parse(fs.readFileSync(telemetryMod.TELEMETRY_FILE, 'utf8')).entries.length; } catch (_e) { telemetryEntries = 0; }
    return true;
  });

  // ---- the sweep ---------------------------------------------------------------------------------
  const allRooms = [room, mcpRoom, ambientRoom].concat(rooms).filter(Boolean);
  const uniqRooms = allRooms.filter(function (r, i) { return allRooms.indexOf(r) === i; });

  // 1. children: argv, stdout, stderr
  await leg('S1 the marker and the key are in no child argv, stdout or stderr (' + CAP.children.length + ' children)', async function () {
    if (CAP.children.length < 10) return 'too few children captured: ' + CAP.children.length;
    for (let i = 0; i < CAP.children.length; i += 1) {
      const c = CAP.children[i];
      const argv = c.argv.join(' ');
      if (uniqRooms.some(function (r) { return argv.indexOf(r.marker) !== -1 || c.stdout.indexOf(r.marker) !== -1 || c.stderr.indexOf(r.marker) !== -1; })) return 'marker in child ' + i + ' ' + argv.slice(0, 100);
      if (argv.indexOf(FAKE_KEY) !== -1 || c.stdout.indexOf(FAKE_KEY) !== -1 || c.stderr.indexOf(FAKE_KEY) !== -1) return 'key in child ' + i;
      if (argv.indexOf(GAP_TERM_363) !== -1 || argv.indexOf(SYN) !== -1) return 'an approved room-derived term rode on argv of child ' + i;
      if (c.stderr.trim() !== '') return 'child ' + i + ' wrote to stderr: ' + c.stderr.slice(0, 80);
    }
    return true;
  });

  // 2. MCP responses and in-process results
  await leg('S2 the marker and the key are in no MCP response and no in-process door result', async function () {
    const blobs = CAP.mcp.concat(CAP.inproc);
    if (CAP.mcp.length < 8) return 'too few MCP responses captured: ' + CAP.mcp.length;
    for (let i = 0; i < blobs.length; i += 1) {
      if (uniqRooms.some(function (r) { return blobs[i].indexOf(r.marker) !== -1; })) return 'marker in response ' + i;
      if (blobs[i].indexOf(FAKE_KEY) !== -1) return 'key in response ' + i;
    }
    return true;
  });

  // 3. telemetry
  await leg('S3 the shared egress telemetry sink holds no marker, no key and no query text (' + telemetryEntries + ' entries)', async function () {
    if (telemetryEntries === 0) return 'the telemetry sink was never written, so the sweep could not cover it';
    const text = fs.readFileSync(telemetryMod.TELEMETRY_FILE, 'utf8');
    if (uniqRooms.some(function (r) { return text.indexOf(r.marker) !== -1; })) return 'marker in telemetry';
    if (text.indexOf(FAKE_KEY) !== -1) return 'key in telemetry';
    if (text.indexOf(GAP_TERM_363) !== -1 || text.indexOf(SYN) !== -1) return 'query text in telemetry (hash only is allowed)';
    if (!/query_text_hash/.test(text)) return 'telemetry record shape unexpected';
    return true;
  });

  // 4. cache
  await leg('S4 no cache file name or content carries the marker or the key', async function () {
    let files = 0;
    for (let i = 0; i < uniqRooms.length; i += 1) {
      const dir = path.join(uniqRooms[i].roomDir, '.mindrian', 'research-cache');
      const list = walkFiles(dir, []);
      for (let j = 0; j < list.length; j += 1) {
        files += 1;
        const name = path.basename(list[j]);
        const content = fs.readFileSync(list[j], 'latin1');
        if (uniqRooms.some(function (r) { return name.indexOf(r.marker) !== -1 || content.indexOf(r.marker) !== -1; })) return 'marker in cache ' + name;
        if (name.indexOf(FAKE_KEY) !== -1 || content.indexOf(FAKE_KEY) !== -1) return 'key in cache ' + name;
      }
    }
    if (files === 0) return 'no cache file exists, so the sweep could not cover it';
    return true;
  });

  // 5. Theo
  await leg('S5 no Theo call argument carries the marker or a room-derived term; the live-refresh reads are handles only', async function () {
    const shared = CAP.theo.map(function (c) { return c.args; });
    const stub = CAP.stubTheo;
    const all = shared.concat(stub);
    if (stub.length === 0) return 'the live refresh reads were not recorded';
    for (let i = 0; i < all.length; i += 1) {
      if (uniqRooms.some(function (r) { return all[i].indexOf(r.marker) !== -1; })) return 'marker in a Theo call ' + i;
      if (all[i].indexOf(GAP_TERM_363) !== -1 || all[i].indexOf(SYN) !== -1) return 'a room-derived term in a Theo call ' + i;
      if (all[i].indexOf(FAKE_KEY) !== -1) return 'key in a Theo call ' + i;
      if (all[i].indexOf('Fixture Room 363') !== -1) return 'room identity in a Theo call ' + i;
    }
    const nonReads = stub.filter(function (s) { return !/^\{"cypher":"MATCH /.test(s); });
    if (nonReads.length !== 0) return 'a live-refresh call was not a plain MATCH read';
    return true;
  });

  // 6. audit records
  await leg('S6 every audit record holds an approved q (round one from the plan files, later rounds only from approved phrases) and no marker or key', async function () {
    let records = 0;
    for (let i = 0; i < uniqRooms.length; i += 1) {
      const r = uniqRooms[i];
      const audit = auditLedger.readAudit(r.roomDir, {});
      const raw = fs.existsSync(path.join(r.roomDir, '.mindrian', 'research-audit.jsonl')) ? fs.readFileSync(path.join(r.roomDir, '.mindrian', 'research-audit.jsonl'), 'utf8') : '';
      if (raw.indexOf(r.marker) !== -1) return 'marker in the audit ledger';
      if (raw.indexOf(FAKE_KEY) !== -1 || /Bearer /i.test(raw)) return 'key material in the audit ledger';
      const approvedQ = {};
      const approvedPhrases = {};
      const runsDir = path.join(r.roomDir, '.mindrian', 'research-runs');
      let runIds = [];
      try { runIds = fs.readdirSync(runsDir); } catch (_e) { runIds = []; }
      runIds.forEach(function (id) {
        let plan = null;
        try { plan = readJson(path.join(runsDir, id, 'plan.json')); } catch (_e) { return; }
        plan.leaves.forEach(function (leaf) {
          (leaf.queries || []).forEach(function (q) { approvedQ[q.q] = true; });
          const slots = leaf.slots || {};
          Object.keys(slots).forEach(function (k) {
            [].concat(slots[k]).forEach(function (v) { if (typeof v === 'string') approvedPhrases[v.toLowerCase()] = true; });
          });
        });
        (plan.perspective.limiters || []).forEach(function (l) { [l.statement, l.label, l.question].forEach(function (v) { if (typeof v === 'string') approvedPhrases[v.toLowerCase()] = true; }); });
        if (plan.perspective.goal && typeof plan.perspective.goal.target === 'string') approvedPhrases[plan.perspective.goal.target.toLowerCase()] = true;
      });
      const g = grants.readGrants(r.roomDir, {}).grants;
      g.forEach(function (gr) { (gr.approved_terms || []).forEach(function (t) { approvedPhrases[String(t.term).toLowerCase()] = true; (t.synonyms || []).forEach(function (s) { approvedPhrases[String(s).toLowerCase()] = true; }); }); });
      for (let j = 0; j < audit.length; j += 1) {
        records += 1;
        const q = audit[j].q;
        if (q.indexOf(r.marker) !== -1) return 'marker in an audit q';
        if (approvedQ[q]) continue;
        const phrases = (q.match(/"[^"]+"/g) || []).map(function (p) { return p.slice(1, -1).toLowerCase(); });
        if (phrases.length === 0) return 'audit q with no approved phrase: ' + q.slice(0, 80);
        const bad = phrases.filter(function (p) { return !approvedPhrases[p]; });
        if (bad.length > 0) return 'audit q carries a phrase that is not approved: ' + bad[0].slice(0, 60);
      }
    }
    if (records < 10) return 'too few audit records swept: ' + records;
    return true;
  });

  // 7. room files and nodes: nothing new carries the marker
  await leg('S7 no door copied room text: no room file and no room.db node gained the marker (' + uniqRooms.length + ' rooms)', async function () {
    for (let k = 0; k < uniqRooms.length; k += 1) {
      const r = uniqRooms[k];
      const after = walkFiles(r.roomDir, []);
      for (let i = 0; i < after.length; i += 1) {
        if (/room\.db/.test(path.basename(after[i]))) continue;
        const n = countOf(fs.readFileSync(after[i]), r.marker);
        if (n !== (r.snapFiles[after[i]] || 0)) return 'marker count changed in ' + path.relative(r.roomDir, after[i]) + ' (' + (r.snapFiles[after[i]] || 0) + ' -> ' + n + ')';
      }
      if (nodesWithMarker(r) !== r.snapNodes) return 'a new room.db node carries the marker in room ' + k;
    }
    return true;
  });

  // 8. the key
  await leg('S8 the API key is in no file under any room or the test home', async function () {
    const roots = uniqRooms.map(function (r) { return r.roomDir; }).concat([TMP_HOME, process.env.MINDRIAN_ROOMS_HOME]);
    let scanned = 0;
    for (let i = 0; i < roots.length; i += 1) {
      const files = walkFiles(roots[i], []);
      for (let j = 0; j < files.length; j += 1) {
        scanned += 1;
        if (fs.readFileSync(files[j]).includes(Buffer.from(FAKE_KEY))) return 'key found in ' + files[j];
      }
    }
    return scanned > 50 || ('only ' + scanned + ' files scanned');
  });

  // 9. how the key rode
  await leg('S9 every replayed request carried the key only as a Bearer header, never in a URL or another header', async function () {
    const lines = fs.readFileSync(REPLAY_LOG, 'utf8').trim().split('\n').filter(Boolean).map(function (l) { return JSON.parse(l); });
    const requests = lines.filter(function (l) { return l.q !== undefined; });
    const auth = lines.filter(function (l) { return l.auth_is_bearer !== undefined; });
    if (requests.length < 6) return 'too few child requests logged: ' + requests.length;
    if (requests.some(function (l) { return l.has_auth !== true || l.key_in_url === true; })) return 'a child request had no Authorization header or the key in the URL';
    if (auth.some(function (l) { return l.auth_is_bearer !== true || l.key_in_url || l.key_in_other_header; })) return 'a child request carried the key in the wrong place';
    const parent = [];
    INPROC_REPLAYS.forEach(function (r) { r.calls.forEach(function (c) { parent.push(c); }); });
    if (parent.length < 6) return 'too few in-process requests: ' + parent.length;
    if (parent.some(function (c) { return c.has_auth !== true || c.key_in_url === true; })) return 'an in-process request had no Authorization header or the key in the URL';
    if (INPROC_REPLAYS.some(function (r) { return r.violations.length !== 0; })) return 'the replay recorded a violation';
    if (JSON.stringify(parent).indexOf(FAKE_KEY) !== -1 || JSON.stringify(lines).indexOf(FAKE_KEY) !== -1) return 'the key value was recorded';
    // the only room-derived strings on the wire are approved queries
    const wire = requests.map(function (l) { return String(l.q); }).concat(parent.map(function (c) { return String(c.q); }));
    if (wire.some(function (q) { return uniqRooms.some(function (r) { return q.indexOf(r.marker) !== -1; }); })) return 'a marker went out on the wire';
    return true;
  });

  // guards ----------------------------------------------------------------------------------------
  check('dash guard: no em-dash or en-dash in this test', (function () {
    const s = fs.readFileSync(__filename, 'utf8');
    return s.indexOf(EM) === -1 && s.indexOf(EN) === -1;
  })());
  check('net guard: the only fetches were the recorded replay (zero real attempts)', guard.attempts() === 0, 'attempts ' + guard.attempts());
  check('global fetch restored to the net guard', globalThis.fetch === NET_GUARD_FETCH);

  cp.spawnSync = realSpawnSync;
  uniqRooms.forEach(function (r) { try { r.cleanup(); } catch (_e) { /* ok */ } });
  return summary();
}


main().then(function (code) { process.exit(code); }).catch(function (e) {
  console.log('FAIL: harness ' + ((e && e.stack) || String(e)));
  process.exit(1);
});
