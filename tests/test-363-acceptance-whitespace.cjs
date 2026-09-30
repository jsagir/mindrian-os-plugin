'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 363 Plan 20 Task 1 -- D-06 acceptance: SEED-097's first slice (the
 * Whitespace plus OpenAlex slice) in BOTH modes, through the real doors, all
 * offline. Legs W1-W9 (plus W9b, the honest known-limitation leg).
 *
 * Doors: the CLI (scripts/research-planner.cjs) is spawned with
 * NODE_OPTIONS=--require <replay preload>, so the child's fetch is the recorded
 * OpenAlex replay and no leg needs the network. The MCP door (W8) runs through
 * the register seam in this process with the replay swapped in for one call at a
 * time; the ambient branch (W7, W9) runs in-process the same way. The net guard
 * stays installed everywhere else and its counter is the last check.
 *
 * The question the navigator asked: is this zone absent from the literature, or
 * only absent from this room? The first-slice answer is a computed verdict and
 * one answer line, never a model opinion. Falsifiers exercised: covered under
 * another term (W2), irrelevant as not researchable (W4), extraction failure as
 * a local room check (W3).
 *
 * Measured values are printed on the last stdout line as
 * `ACCEPTANCE_METRICS {...}` for 363-ACCEPTANCE.md.
 *
 * No em-dash or en-dash literals: those characters are spelled with
 * String.fromCharCode. Exit 0 pass, 1 fail, 77 skip (helpers or fixtures absent).
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos363-acc-ws-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos363-acc-ws-roomshome-'));
process.env.MINDRIAN_BRAIN_URL = 'http://127.0.0.1:1';
process.env.MINDRIAN_BRAIN_TIMEOUT_MS = '500';
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;

const ROOT = path.resolve(__dirname, '..');
const hygiene = require(path.join(__dirname, 'helpers', 'hygiene-355.cjs'));
hygiene.scrubVendorKey();
delete process.env.OPENALEX_API_KEY;
delete process.env.OPENALEX_EMAIL;
const guard = hygiene.installNetGuard();
const NET_GUARD_FETCH = globalThis.fetch;
const { check, summary } = hygiene.makeChecker('363-20 acceptance: whitespace slice, both modes');

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

let buildRoom363 = null;
let GAP_TERM_363 = null;
let makeReplayFetch = null;
let writeReplayPreload = null;
try {
  const fx = require(path.join(__dirname, 'helpers', 'fixture-room-363.cjs'));
  buildRoom363 = fx.buildRoom363;
  GAP_TERM_363 = fx.GAP_TERM_363;
  const rp = require(path.join(__dirname, 'helpers', 'openalex-replay-363.cjs'));
  makeReplayFetch = rp.makeReplayFetch;
  writeReplayPreload = rp.writeReplayPreload;
} catch (_e) {
  console.log('SKIP: 363-02 helpers absent');
  process.exit(77);
}

const QS_DIR = path.join(ROOT, 'tests', 'fixtures', '363-question-sets');
function qsFile(name) { return JSON.parse(fs.readFileSync(path.join(QS_DIR, name + '.json'), 'utf8')); }
function clone(v) { return JSON.parse(JSON.stringify(v)); }

const CLI_PATH = path.join(ROOT, 'scripts', 'research-planner.cjs');
const planner = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'planner.cjs'));
const grants = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'grants.cjs'));
const auditLedger = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'audit-ledger.cjs'));
const corpus = require(path.join(ROOT, 'lib', 'core', 'research-corpus.cjs'));
const AMBIENT = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'ambient.cjs'));
const { registerCoreTools } = require(path.join(ROOT, 'lib', 'mcp', 'register-core-tools.cjs'));

const SYN = 'ultrasonic biofilm removal';
const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'mos363-acc-ws-scratch-'));
const rooms = [];

function newRoom(role) {
  const r = buildRoom363({ role: role || 'researcher' });
  rooms.push(r);
  try { fs.rmSync(path.join(TMP_HOME, '.mindrian'), { recursive: true, force: true }); } catch (_e) { /* ok */ }
  return r;
}
function runDir(room, runId) { return path.join(room.roomDir, '.mindrian', 'research-runs', runId); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function writeScratch(name, obj) {
  const file = path.join(SCRATCH, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2), 'utf8');
  return file;
}
function ms(startNs) { return Number(process.hrtime.bigint() - startNs) / 1e6; }
function pct(arr, p) {
  const a = arr.slice().sort(function (x, y) { return x - y; });
  if (a.length === 0) return null;
  const idx = Math.min(a.length - 1, Math.max(0, Math.ceil((p / 100) * a.length) - 1));
  return Number(a[idx].toFixed(1));
}

// The question set the way /mos:whitespace research ZONE_ID writes it: the
// gap term and the two-section cohort from the frozen zone, synonyms as slots,
// falsifier leaves, the lite perspective (the checked-in fixture), and the
// irrelevant dimension recorded as a reasoned not-researchable coverage note.
function whitespaceQs(zone) {
  const z = zone || {};
  const qs = qsFile('whitespace-quick');
  const term = z.zone_term || GAP_TERM_363;
  qs.stated_question = 'Is there published work on ' + term + '?';
  qs.leaves[0].question = qs.stated_question;
  qs.leaves[0].slots = { term: term };
  qs.leaves[1].slots = { term: term, synonyms: [SYN] };
  qs.scqa.situation = 'The room maps ' + (z.sections || []).join(' and ') + '.';
  qs.coverage_notes = [{ dimension: 'ws:irrelevant', not_researchable_reason: 'navigator judgment: whether the zone is worth filling at all' }];
  qs.return_target = { section: (z.sections || ['market-analysis'])[0] };
  return qs;
}

// -- replay routes for the spawned CLI --------------------------------------------
const ROUTES = {};
function routeModule(name, body) {
  if (ROUTES[name]) return ROUTES[name];
  const file = path.join(SCRATCH, 'route-' + name + '.cjs');
  fs.writeFileSync(file, body, 'utf8');
  const preload = writeReplayPreload(path.join(SCRATCH, 'preload-' + name), { routeModulePath: file });
  ROUTES[name] = preload;
  return preload;
}
const ROUTE_SRC_SHAPE = function (cover, prior, primary) {
  return 'module.exports = function route(q) {\n'
    + '  const s = String(q || \'\');\n'
    + '  if (s.indexOf(\' OR \') !== -1) return ' + JSON.stringify(cover) + ';\n'
    + '  if (s.indexOf(\' AND (\') !== -1) return ' + JSON.stringify(prior) + ';\n'
    + '  return ' + JSON.stringify(primary) + ';\n'
    + '};\n';
};
function preloadZero() { return routeModule('zero', ROUTE_SRC_SHAPE('gap_primary_zero', 'gap_primary_zero', 'gap_primary_zero')); }
function preloadCovered() { return routeModule('covered', ROUTE_SRC_SHAPE('synonym_hits', 'gap_primary_zero', 'gap_primary_zero')); }
function preloadThin() { return routeModule('thin', 'module.exports = function route() { return \'derivation_hit\'; };\n'); }

const CLI_TIMES = { plan: [], grant: [], quick: [], deep_loop: [], deep_call: [] };

function cli(args, opts) {
  const o = opts || {};
  const env = Object.assign({}, process.env, {
    HOME: TMP_HOME,
    USERPROFILE: TMP_HOME,
    NODE_OPTIONS: '--require ' + (o.preload || preloadZero()),
  });
  delete env.OPENALEX_API_KEY;
  delete env.OPENALEX_EMAIL;
  delete env.TYPESAFE_API_KEY;
  const t0 = process.hrtime.bigint();
  const res = spawnSync(process.execPath, [CLI_PATH].concat(args), { encoding: 'utf8', env: env, timeout: 120000 });
  const wall = ms(t0);
  let json = null;
  try { json = JSON.parse(String(res.stdout || '').trim()); } catch (_e) { json = null; }
  return { code: res.status, stdout: String(res.stdout || ''), stderr: String(res.stderr || ''), json: json, wall_ms: wall };
}

// plan -> grant approve -> run-quick, all through the CLI doors.
function cliQuick(room, qs, preload) {
  const qsPath = writeScratch('qs-' + path.basename(path.dirname(room.roomDir)) + '.json', qs);
  const planned = cli(['plan', qsPath, '--room', room.roomDir, '--mode', 'quick', '--section', 'market-analysis'], { preload: preload });
  CLI_TIMES.plan.push(planned.wall_ms);
  if (planned.code !== 0 || !planned.json) return { error: 'plan failed: ' + planned.code + ' ' + planned.stdout.slice(0, 300) + planned.stderr.slice(0, 200) };
  const runId = planned.json.run_id;
  if (!planned.json.proposal) return { error: 'plan gave no grant proposal: ' + JSON.stringify(planned.json).slice(0, 200) };
  const proposalPath = writeScratch('proposal-' + runId + '.json', planned.json.proposal);
  const approved = cli(['grant', 'approve', proposalPath, '--room', room.roomDir, '--approved-via', 'cli'], { preload: preload });
  CLI_TIMES.grant.push(approved.wall_ms);
  if (approved.code !== 0) return { error: 'grant approve failed: ' + approved.code + ' ' + approved.stdout.slice(0, 300) };
  const ran = cli(['run-quick', runId, '--room', room.roomDir], { preload: preload });
  CLI_TIMES.quick.push(ran.wall_ms);
  return { runId: runId, planned: planned, approved: approved, ran: ran, wall_ms: ran.wall_ms };
}

// The deep loop through the CLI, step by step (the way commands/research.md
// runs it), with deterministic lane rows quoting fetched records.
function cliDeepLoop(room, runId, preload) {
  const t0 = process.hrtime.bigint();
  const steps = [];
  let finished = false;
  let calls = 0;
  function call(args) {
    calls += 1;
    const r = cli(args, { preload: preload });
    CLI_TIMES.deep_call.push(r.wall_ms);
    return r;
  }
  for (let i = 0; i < 80 && !finished; i += 1) {
    const n = call(['deep-next', runId, '--room', room.roomDir]);
    if (n.code !== 0 || !n.json || n.json.ok !== true) return { error: 'deep-next ' + n.code + ' ' + n.stdout.slice(0, 300) };
    const step = n.json.step;
    steps.push(step);
    if (step === 'fetch_round') {
      const f = call(['deep-fetch', runId, '--room', room.roomDir]);
      if (f.code !== 0 || !f.json || f.json.ok !== true) return { error: 'deep-fetch ' + f.code + ' ' + f.stdout.slice(0, 300) };
    } else if (step === 'dispatch_lanes') {
      const lanes = n.json.payload.lanes;
      for (let j = 0; j < lanes.length; j += 1) {
        const p = lanes[j];
        const records = readJson(path.join(room.roomDir, p.records_path)).records;
        const rows = records.length === 0 ? [] : [{ leaf_id: p.leaves[0].leaf_id, record_id: records[0].id, claim: 'Model claim for ' + p.leaves[0].leaf_id, quote: records[0].title, label: 'supports' }];
        const rp = writeScratch('rows-' + runId + '-' + p.lane + '-' + i + '.json', rows);
        const rec = call(['deep-record', runId, p.lane, rp, '--room', room.roomDir]);
        if (rec.code !== 0 || !rec.json || rec.json.ok !== true) return { error: 'deep-record ' + rec.code + ' ' + rec.stdout.slice(0, 300) };
      }
    } else if (step === 'reflect') {
      const fp = writeScratch('followups-' + runId + '-' + i + '.json', []);
      const r = call(['deep-followups', runId, fp, '--room', room.roomDir]);
      if (r.code !== 0 || !r.json || r.json.ok !== true) return { error: 'deep-followups ' + r.code + ' ' + r.stdout.slice(0, 300) };
    } else if (step === 'extend_card') {
      const dp = writeScratch('decision-' + runId + '-' + i + '.json', { decision: 'stop' });
      const r = call(['deep-extend', runId, dp, '--room', room.roomDir]);
      if (r.code !== 0 || !r.json || r.json.ok !== true) return { error: 'deep-extend ' + r.code + ' ' + r.stdout.slice(0, 300) };
    } else if (step === 'counterevidence') {
      const ce = call(['deep-counterevidence', runId, '--room', room.roomDir]);
      if (ce.code !== 0 || !ce.json || ce.json.ok !== true) return { error: 'deep-counterevidence ' + ce.code + ' ' + ce.stdout.slice(0, 300) };
      if (ce.json.lane_payload) {
        const p = ce.json.lane_payload;
        const records = readJson(path.join(room.roomDir, p.records_path)).records;
        const rows = records.length === 0 ? [] : [{ leaf_id: p.leaves[0].leaf_id, record_id: records[0].id, claim: 'Counter claim', quote: records[0].title, label: 'contradicts' }];
        const rp = writeScratch('rows-ce-' + runId + '.json', rows);
        const rec = call(['deep-record', runId, 'CE', rp, '--room', room.roomDir]);
        if (rec.code !== 0 || !rec.json || rec.json.ok !== true) return { error: 'deep-record CE ' + rec.code + ' ' + rec.stdout.slice(0, 300) };
      }
    } else if (step === 'synthesize') {
      const s = call(['deep-synthesize', runId, '--room', room.roomDir]);
      if (s.code !== 0 || !s.json || s.json.ok !== true) return { error: 'deep-synthesize ' + s.code + ' ' + s.stdout.slice(0, 300) };
      finished = true;
    } else if (step === 'done') {
      finished = true;
    }
  }
  const wall = ms(t0);
  CLI_TIMES.deep_loop.push(wall);
  if (!finished) return { error: 'loop did not finish: ' + steps.join(',') };
  return { steps: steps, wall_ms: wall, calls: calls };
}

function auditFor(room, runId) { return auditLedger.readAudit(room.roomDir, { run_id: runId }); }

const METRICS = { legs: {}, notes: [] };
async function leg(name, fn) {
  const t0 = process.hrtime.bigint();
  try {
    const r = await fn();
    if (r === undefined) return;
    check(name, r === true, String(r));
  } catch (e) {
    check(name, false, (e && e.stack) || String(e));
  }
  METRICS.legs[name.split(' ')[0]] = Number(ms(t0).toFixed(1));
}

// -- MCP door (register seam), in process ------------------------------------------
function mcpClient(room, sessionId) {
  const captured = new Map();
  const stub = {
    tool: function (name, description, schema, handler) { captured.set(name, { description: description, schema: schema, handler: handler }); },
    registerTool: function (name, config, handler) {
      const cfg = config || {};
      captured.set(name, { description: cfg.description, schema: cfg.inputSchema, handler: handler });
    },
  };
  registerCoreTools(stub, { fallbackRoomDir: room.roomDir, pluginRoot: ROOT, surface: 'desktop' });
  const reg = captured.get('research_run');
  const answerReg = captured.get('gate_answer');
  const extra = { sessionId: sessionId };
  function parse(raw) {
    const text = raw && raw.content && raw.content[0] && raw.content[0].text;
    try { return JSON.parse(text); } catch (_e) { return { _unparsed: String(text).slice(0, 300) }; }
  }
  return {
    reg: reg,
    call: async function (input) { return parse(await reg.handler(input, extra)); },
    answer: async function (gateId, chosen, verdict) { return parse(await answerReg.handler({ gate_id: gateId, chosen: chosen, verdict: verdict }, extra)); },
  };
}
function routeShape(map) {
  return function (q) {
    const s = String(q || '');
    if (s.indexOf(' OR ') !== -1) return map.cover;
    if (s.indexOf(' AND (') !== -1) return map.prior;
    return map.primary;
  };
}
async function withReplay(replay, fn) {
  globalThis.fetch = replay;
  try { return await fn(); } finally { globalThis.fetch = NET_GUARD_FETCH; }
}
function seam(replay) {
  return async function (args) {
    const prev = globalThis.fetch;
    globalThis.fetch = replay;
    try { return await corpus.fetchCorpusEnvelope(args); } finally { globalThis.fetch = prev; }
  };
}

const SHARED = {};

async function main() {
  if (!fs.existsSync(CLI_PATH)) {
    console.log('SKIP: scripts/research-planner.cjs absent');
    return 77;
  }

  // W1 -------------------------------------------------------------------------
  await leg('W1 quick run, gap confirmed: verdict, plurality, three audit records, literature_gap, answer line', async function () {
    const room = newRoom('researcher');
    const q = cliQuick(room, whitespaceQs(room.zones.twoSection), preloadZero());
    if (q.error) return q.error;
    if (q.planned.json.next !== 'grant' || !q.planned.json.card || q.planned.json.card.shape !== 'F.0') return 'plan card ' + JSON.stringify(q.planned.json.next);
    const r = q.ran.json;
    if (q.ran.code !== 0 || !r || r.status !== 'done') return 'run-quick ' + q.ran.code + ' ' + q.ran.stdout.slice(0, 300);
    if (r.verdict !== 'gap-confirmed') return 'verdict ' + r.verdict;
    const audit = auditFor(room, q.runId);
    if (audit.length !== 3) return 'expected three audited searches, got ' + audit.length;
    if (!audit.every(function (a) { return a.outcome === 'empty_valid' && a.count === 0; })) return 'audit outcomes ' + JSON.stringify(audit.map(function (a) { return a.outcome; }));
    const run = readJson(path.join(runDir(room, q.runId), 'run.json'));
    if (!run.verdict_detail || run.verdict_detail.plurality_ran !== true) return 'plurality did not run';
    const lit = run.opportunity_candidates.filter(function (c) { return c.kind === 'literature_gap'; });
    if (lit.length !== 1) return 'literature_gap candidates ' + lit.length;
    if (!/No published work/.test(r.answer_line)) return 'answer line does not say the literature is silent: ' + r.answer_line;
    if (r.escalation_offer !== null && r.escalation_offer !== undefined) return 'a confirmed gap offered a deep run';
    if (r.card.body_md.indexOf('Answer: ' + r.answer_line) === -1) return 'the card does not carry the answer line';
    if (run.local_checks.length !== 1 || run.local_checks[0].flagged !== false) return 'local check ' + JSON.stringify(run.local_checks);
    if (run.filed !== false) return 'a quick run filed';
    run.queries.forEach(function (x) { METRICS.rows_per_query = METRICS.rows_per_query || []; METRICS.rows_per_query.push(x.result_count); });
    SHARED.w1 = { room: room, runId: q.runId };
    return true;
  });

  // W2 -------------------------------------------------------------------------
  await leg('W2 covered under another term: synonym hits give settled, the gap is only absent from the room', async function () {
    const room = newRoom('researcher');
    const q = cliQuick(room, whitespaceQs(room.zones.twoSection), preloadCovered());
    if (q.error) return q.error;
    const r = q.ran.json;
    if (q.ran.code !== 0 || !r || r.status !== 'done') return 'run-quick ' + q.ran.code + ' ' + q.ran.stdout.slice(0, 300);
    if (r.verdict !== 'settled') return 'verdict ' + r.verdict;
    if (!/already studied under another wording/.test(r.answer_line)) return 'answer line does not say the room is the only silent place: ' + r.answer_line;
    const run = readJson(path.join(runDir(room, q.runId), 'run.json'));
    const sup = run.rows.filter(function (x) { return x.leaf_id === 'L2' && x.label === 'supports'; });
    if (sup.length < 1) return 'no supporting row on the covered-elsewhere leaf';
    if (run.opportunity_candidates.some(function (c) { return c.kind === 'literature_gap'; })) return 'a settled zone produced a literature_gap candidate';
    const cover = auditFor(room, q.runId).filter(function (a) { return a.template_id === 'ws.synonym_cover'; })[0];
    if (!cover || cover.count !== 240) return 'synonym cover audit ' + JSON.stringify(cover && cover.count);
    METRICS.replay_rows_settled = run.queries.map(function (x) { return { template_id: x.template_id, count: x.count, result_count: x.result_count }; });
    return true;
  });

  // W3 -------------------------------------------------------------------------
  await leg('W3 extraction failure: a room artifact already names the term, flagged locally, no request for that leaf', async function () {
    const room = newRoom('researcher');
    const extra = path.join(room.roomDir, 'market-analysis', 'field-notes', 'field-notes.md');
    fs.mkdirSync(path.dirname(extra), { recursive: true });
    fs.writeFileSync(extra, '# Field Notes\n\nWe tried ' + GAP_TERM_363 + ' on the test loop last spring.\n', 'utf8');
    const q = cliQuick(room, whitespaceQs(room.zones.twoSection), preloadZero());
    if (q.error) return q.error;
    if (q.ran.code !== 0 || !q.ran.json || q.ran.json.status !== 'done') return 'run-quick ' + q.ran.code + ' ' + q.ran.stdout.slice(0, 300);
    const run = readJson(path.join(runDir(room, q.runId), 'run.json'));
    const lc = run.local_checks.filter(function (c) { return c.kind === 'extraction_failure'; })[0];
    if (!lc || lc.flagged !== true || lc.artifact_count < 1) return 'extraction failure not flagged ' + JSON.stringify(run.local_checks);
    if (lc.leaf_id !== 'L3') return 'local check leaf ' + lc.leaf_id;
    const audit = auditFor(room, q.runId);
    if (audit.some(function (a) { return /L3/.test(String(a.origin_ref)); })) return 'a request was made for the room-only leaf';
    if (q.ran.json.card.body_md.indexOf('the gap may be an extraction failure') === -1) return 'the card does not say the gap may be an extraction failure';
    if (q.ran.json.card.body_md.indexOf('Nothing was sent for this check.') === -1) return 'the card does not say nothing was sent';
    return true;
  });

  // W4 -------------------------------------------------------------------------
  await leg('W4 irrelevant: ws:irrelevant is not researchable, shown as such, and never searched', async function () {
    const room = newRoom('researcher');
    const q = cliQuick(room, whitespaceQs(room.zones.twoSection), preloadZero());
    if (q.error) return q.error;
    const plan = readJson(path.join(runDir(room, q.runId), 'plan.json'));
    const nr = (plan.pyramid.coverage && plan.pyramid.coverage.not_researchable) || [];
    const hit = nr.filter(function (n) { return n.dimension === 'ws:irrelevant'; })[0];
    if (!hit || !/navigator judgment/.test(hit.reason)) return 'coverage did not list ws:irrelevant as not researchable ' + JSON.stringify(nr);
    // "Shown as such": the plan review card (F.6) lists it under its own heading.
    const qsPath = writeScratch('qs-w4-deep.json', whitespaceQs(room.zones.twoSection));
    const deepPlanned = cli(['plan', qsPath, '--room', room.roomDir, '--mode', 'deep', '--section', 'market-analysis'], { preload: preloadZero() });
    if (deepPlanned.code !== 0 || !deepPlanned.json || !deepPlanned.json.card || deepPlanned.json.card.shape !== 'F.6') return 'deep plan ' + deepPlanned.stdout.slice(0, 300);
    const shown = deepPlanned.json.card.body_md;
    if (shown.indexOf('### Not researchable in this run') === -1 || !/- ws:irrelevant: navigator judgment/.test(shown)) return 'the plan review card does not show it as not researchable';
    const searched = plan.leaves.filter(function (l) { return l.dimension === 'ws:irrelevant' && (l.queries || []).length > 0; });
    if (searched.length !== 0) return 'the irrelevant dimension has queries';
    if (auditFor(room, q.runId).some(function (a) { return /irrelevant/.test(String(a.template_id)); })) return 'the irrelevant dimension was searched';
    return true;
  });

  // W5 -------------------------------------------------------------------------
  await leg('W5 thin card offers deep once; escalate, review approve, deep loop to done with counterevidence and a stop reason', async function () {
    const room = newRoom('researcher');
    const q = cliQuick(room, whitespaceQs(room.zones.twoSection), preloadThin());
    if (q.error) return q.error;
    const r = q.ran.json;
    if (q.ran.code !== 0 || !r || r.status !== 'done') return 'run-quick ' + q.ran.code + ' ' + q.ran.stdout.slice(0, 300);
    if (r.verdict !== 'thin') return 'verdict ' + r.verdict;
    const offerLines = r.card.body_md.split('\n').filter(function (l) { return /run deep on this\?/i.test(l); });
    if (offerLines.length !== 1) return 'deep offer lines ' + offerLines.length;
    if (!r.escalation_offer || r.escalation_offer.text !== 'run deep on this?') return 'escalation_offer ' + JSON.stringify(r.escalation_offer);
    const esc = cli(['escalate', q.runId, '--room', room.roomDir], { preload: preloadThin() });
    if (esc.code !== 0 || !esc.json || esc.json.mode !== 'deep' || esc.json.run_id === q.runId) return 'escalate ' + esc.code + ' ' + esc.stdout.slice(0, 300);
    if (esc.json.next !== 'review' || !esc.json.card || esc.json.card.shape !== 'F.6') return 'escalated plan is not at the review card: ' + JSON.stringify({ n: esc.json.next, r: esc.json.reason, s: esc.json.status, e: esc.json.errors, l: esc.json.local_only_leaves });
    const deepId = esc.json.run_id;
    const noVia = cli(['review', 'approve', deepId, '--room', room.roomDir], { preload: preloadThin() });
    if (noVia.code !== 2) return 'review approve without --approved-via exited ' + noVia.code;
    const appr = cli(['review', 'approve', deepId, '--room', room.roomDir, '--approved-via', 'cli'], { preload: preloadThin() });
    if (appr.code !== 0 || !appr.json || appr.json.ok !== true) return 'review approve ' + appr.code + ' ' + appr.stdout.slice(0, 300);
    const g = grants.findActiveGrant(room.roomDir, { lifetime: 'run', run_id: deepId });
    if (!g || g.approved_via.surface !== 'cli' || !g.approved_via.decision_node_id) return 'no run grant with a decision node after review approve';
    const loop = cliDeepLoop(room, deepId, preloadThin());
    if (loop.error) return loop.error;
    if (loop.steps.indexOf('counterevidence') === -1) return 'counterevidence pass skipped: ' + loop.steps.join(',');
    const run = readJson(path.join(runDir(room, deepId), 'run.json'));
    if (run.mode !== 'deep' || typeof run.stop_reason !== 'string' || run.stop_reason.length === 0) return 'no stop reason on the deep run';
    if (!run.counterevidence || run.counterevidence.ran !== true) return 'counterevidence not marked as run';
    if (!Array.isArray(run.unresolved_branches)) return 'no unresolved branches list on the deep report';
    const audit = auditFor(room, deepId);
    if (audit.length === 0 || audit.length > 16) return 'deep searches ' + audit.length;
    const lanes = run.lanes || [];
    if (lanes.length === 0) return 'no lane results';
    const st = cli(['status', deepId, '--room', room.roomDir], { preload: preloadThin() });
    if (st.code !== 0 || !st.json || st.json.stage !== 'done') return 'status ' + st.stdout.slice(0, 200);
    METRICS.deep = { searches: audit.length, stop_reason: run.stop_reason, steps: loop.steps.length, cli_calls: loop.calls, unresolved: run.unresolved_branches.length };
    SHARED.w5 = { room: room, deepId: deepId };
    return true;
  });

  // W5b ------------------------------------------------------------------------
  await leg('W5b deep run answers the same two-halved question directly: gap confirmed (strengthened) and covered under another term (weakened)', async function () {
    const out = {};
    const cases = [
      { name: 'gap', preload: preloadZero(), governing: 'strengthened', wantLit: true },
      { name: 'covered', preload: preloadCovered(), governing: 'weakened', wantLit: false },
    ];
    for (let i = 0; i < cases.length; i += 1) {
      const c = cases[i];
      const room = newRoom('researcher');
      const qsPath = writeScratch('qs-w5b-' + c.name + '.json', whitespaceQs(room.zones.twoSection));
      const planned = cli(['plan', qsPath, '--room', room.roomDir, '--mode', 'deep', '--section', 'market-analysis'], { preload: c.preload });
      if (planned.code !== 0 || !planned.json || planned.json.next !== 'review') return c.name + ' plan ' + planned.stdout.slice(0, 300);
      const deepId = planned.json.run_id;
      const appr = cli(['review', 'approve', deepId, '--room', room.roomDir, '--approved-via', 'cli'], { preload: c.preload });
      if (appr.code !== 0) return c.name + ' review approve ' + appr.stdout.slice(0, 200);
      const loop = cliDeepLoop(room, deepId, c.preload);
      if (loop.error) return c.name + ' ' + loop.error;
      const run = readJson(path.join(runDir(room, deepId), 'run.json'));
      if (!run.verdict_detail || run.verdict_detail.plurality_ran !== true) return c.name + ' plurality did not run in the deep run';
      if (run.governing_status !== c.governing) return c.name + ' governing ' + run.governing_status;
      const lit = run.opportunity_candidates.some(function (x) { return x.kind === 'literature_gap'; });
      if (lit !== c.wantLit) return c.name + ' literature_gap candidate ' + lit;
      if (!run.counterevidence || run.counterevidence.ran !== true) return c.name + ' counterevidence not run';
      out[c.name] = { governing: run.governing_status, primary_count: run.verdict_detail.primary_count, cover_count: run.verdict_detail.cover_count, stop_reason: run.stop_reason, searches: auditFor(room, deepId).length };
    }
    METRICS.deep_direct = out;
    return true;
  });

  // W6 -------------------------------------------------------------------------
  await leg('W6 basket then file-run: approved selection files the run home and the opportunity (opt-in); approved false files nothing', async function () {
    const w1 = SHARED.w1;
    if (!w1) return 'W1 did not produce a run';
    const room = w1.room;
    const basket = cli(['basket', w1.runId, '--room', room.roomDir]);
    if (basket.code !== 0 || !basket.json || !basket.json.card) return 'basket ' + basket.code + ' ' + basket.stdout.slice(0, 300);
    const defaults = basket.json.card.payload.defaults;
    const all = basket.json.card.payload.item_ids;
    if (!Array.isArray(defaults) || defaults.length === 0) return 'no default items';
    if (defaults.some(function (id) { return /^opportunity:/.test(id); })) return 'an opportunity item is on by default';
    if (all.indexOf('opportunity:0') === -1) return 'the literature_gap candidate is not offered in the basket';
    const researchDir = path.join(room.roomDir, 'research');
    const notApproved = writeScratch('sel-w6-no.json', { approved: false, items: defaults });
    const no = cli(['file-run', w1.runId, notApproved, '--room', room.roomDir, '--approved-via', 'cli']);
    if (no.code !== 2 || !no.json || no.json.ok !== false) return 'approved:false exit ' + no.code;
    if (fs.existsSync(researchDir) || fs.existsSync(path.join(runDir(room, w1.runId), 'filing.json'))) return 'approved:false wrote something';
    const sel = writeScratch('sel-w6-ok.json', { approved: true, items: defaults.concat(['opportunity:0']) });
    const filed = cli(['file-run', w1.runId, sel, '--room', room.roomDir, '--approved-via', 'cli']);
    if (filed.code !== 0 || !filed.json || filed.json.ok !== true || !filed.json.report) return 'file-run ' + filed.code + ' ' + filed.stdout.slice(0, 400);
    if (!fs.existsSync(researchDir) || fs.readdirSync(researchDir).length === 0) return 'run home not filed';
    if (!fs.existsSync(path.join(runDir(room, w1.runId), 'filing.json'))) return 'filing marker missing';
    const opps = (filed.json.report.opportunities || []);
    if (opps.length !== 1 || opps[0].kind !== 'literature_gap') return 'opportunity not filed ' + JSON.stringify(opps);
    const bank = path.join(room.roomDir, 'opportunity-bank');
    if (!fs.existsSync(bank) || fs.readdirSync(bank).length === 0) return 'no opportunity card in the bank';
    return true;
  });

  // W7 -------------------------------------------------------------------------
  await leg('W7 a one-section zone returns context_insufficient: nothing planned, nothing sent, nothing written', async function () {
    const room = newRoom('researcher');
    fs.writeFileSync(path.join(room.roomDir, '.mindrian', 'whitespace-results.json'),
      JSON.stringify({ metadata: { frozen_for: 'phase-363-tests' }, gaps: [room.zones.oneSection] }, null, 2), 'utf8');
    const grant = planner.approveStandingGrant(room.roomDir, grants.buildStandingProposal(room.roomDir, { terms: [{ term: room.zones.oneSection.zone_term, synonyms: [] }] }), { approvedVia: 'cli' });
    if (!grant.ok) return 'grant ' + JSON.stringify(grant);
    const replay = makeReplayFetch({ route: routeShape({ primary: 'gap_primary_zero', cover: 'gap_primary_zero', prior: 'gap_primary_zero' }) });
    const out = await AMBIENT.maybeQuick(room.roomDir, { producers: { whitespace: { outcome: 'no_candidate', posture: 'run' } } }, {
      budgetMs: 4 * 60 * 1000, now: Date.parse('2026-09-30T10:00:00Z'), deltaHash: 'c'.repeat(64), deps: { fetchEnvelopeFn: seam(replay) },
    });
    if (out.outcome !== 'context_insufficient' || out.reason !== 'fewer_than_2_sections') return 'outcome ' + JSON.stringify(out);
    if (replay.calls.length !== 0) return 'a search was sent';
    let dirs = [];
    try { dirs = fs.readdirSync(path.join(room.roomDir, '.mindrian', 'research-runs')); } catch (_e) { dirs = []; }
    if (dirs.length !== 0) return 'run state written for a one-section zone';
    if (auditFor(room, 'x').length !== 0 || auditLedger.readAudit(room.roomDir, {}).length !== 0) return 'an audit record exists';
    return true;
  });

  // W8 -------------------------------------------------------------------------
  await leg('W8 MCP door: run_quick returns the same verdict as the CLI for the same replay; deep_plan says the deep run executes in Claude Code', async function () {
    const room = newRoom('researcher');
    const c = mcpClient(room, 'sess-acc-w8');
    if (!c.reg) return 'research_run is not registered';
    const qs = whitespaceQs(room.zones.twoSection);
    const planned = await c.call({ op: 'plan', question_set: qs, mode: 'quick' });
    if (planned.ok !== true || planned.status !== 'ready') return 'plan ' + JSON.stringify(planned).slice(0, 300);
    const req = await c.call({ op: 'grant_request', run_id: planned.run_id });
    if (!req.gate || !req.gate.gate_id) return 'no grant gate ' + JSON.stringify(req).slice(0, 300);
    const ans = await c.answer(req.gate.gate_id, ['approve_standing'], 'approve');
    if (ans.ok !== true) return 'gate_answer ' + JSON.stringify(ans).slice(0, 300);
    const replay = makeReplayFetch({ route: routeShape({ primary: 'gap_primary_zero', cover: 'gap_primary_zero', prior: 'gap_primary_zero' }) });
    const t0 = process.hrtime.bigint();
    const done = await withReplay(replay, function () { return c.call({ op: 'run_quick', run_id: planned.run_id }); });
    METRICS.mcp_run_quick_ms = Number(ms(t0).toFixed(1));
    if (done.ok !== true || done.status !== 'done') return 'run_quick ' + JSON.stringify(done).slice(0, 400);
    const cliRoom = newRoom('researcher');
    const q = cliQuick(cliRoom, whitespaceQs(cliRoom.zones.twoSection), preloadZero());
    if (q.error) return q.error;
    if (done.verdict !== q.ran.json.verdict) return 'MCP verdict ' + done.verdict + ' vs CLI verdict ' + q.ran.json.verdict;
    if (done.answer_line !== q.ran.json.answer_line) return 'answer lines differ: ' + done.answer_line + ' | ' + q.ran.json.answer_line;
    if (replay.calls.length !== 3) return 'MCP searches ' + replay.calls.length;
    const deepRoom = newRoom('researcher');
    const dc = mcpClient(deepRoom, 'sess-acc-w8-deep');
    const deep = await dc.call({ op: 'deep_plan', question_set: qsFile('scientific-roadmapping') });
    if (deep.ok !== true || !deep.card || deep.card.shape !== 'F.6') return 'deep_plan ' + JSON.stringify(deep).slice(0, 300);
    if (!/Claude Code/.test(String(deep.deep_execution || ''))) return 'deep_plan does not say the run executes in Claude Code: ' + JSON.stringify(deep.deep_execution);
    if (fs.existsSync(path.join(runDir(deepRoom, deep.run_id), 'state.json'))) return 'deep execution started on Desktop';
    return true;
  });

  // W9 -------------------------------------------------------------------------
  await leg('W9 ambient branch with a standing grant: a pending evidence card the CLI pending door returns exactly once', async function () {
    const room = newRoom('researcher');
    const proposal = grants.buildStandingProposal(room.roomDir, { terms: [{ term: GAP_TERM_363, synonyms: [SYN] }] });
    const g = planner.approveStandingGrant(room.roomDir, proposal, { approvedVia: 'cli' });
    if (!g.ok) return 'grant ' + JSON.stringify(g);
    const replay = makeReplayFetch({ route: routeShape({ primary: 'gap_primary_zero', cover: 'gap_primary_zero', prior: 'gap_primary_zero' }) });
    const out = await AMBIENT.maybeQuick(room.roomDir, { producers: { whitespace: { outcome: 'no_candidate', posture: 'run' } } }, {
      budgetMs: 4 * 60 * 1000, now: Date.parse('2026-09-30T10:00:00Z'), deltaHash: 'd'.repeat(64), deps: { fetchEnvelopeFn: seam(replay) },
    });
    if (out.outcome !== 'ran' || out.verdict !== 'gap-confirmed') return 'ambient outcome ' + JSON.stringify(out);
    if (replay.calls.length !== 3) return 'ambient searches ' + replay.calls.length;
    const run = readJson(path.join(runDir(room, out.run_id), 'run.json'));
    if (run.trigger !== 'ambient' || run.filed !== false) return 'ambient run trigger ' + run.trigger + ' filed ' + run.filed;
    const first = cli(['pending', '--room', room.roomDir]);
    if (first.code !== 0 || !first.json || !Array.isArray(first.json.cards) || first.json.cards.length !== 1) return 'first pending ' + first.stdout.slice(0, 300);
    if (first.json.cards[0].run_id !== out.run_id || first.json.cards[0].kind !== 'evidence') return 'pending card ' + JSON.stringify(first.json.cards[0]).slice(0, 200);
    if (!first.json.cards[0].card || first.json.cards[0].card.shape !== 'evidence') return 'pending card has no evidence card attached';
    const second = cli(['pending', '--room', room.roomDir]);
    if (second.code !== 0 || !second.json || second.json.cards.length !== 0) return 'the card was surfaced twice';
    if (fs.existsSync(path.join(room.roomDir, 'research'))) return 'the ambient run filed something';
    return true;
  });

  // W9b: the honest known limitation, pinned so it cannot go quiet -------------------
  await leg('W9b KNOWN LIMITATION: production-shaped whitespace results carry no zone_term, so the ambient branch answers context_insufficient (no_zone_term)', async function () {
    const room = newRoom('researcher');
    const stripped = clone(room.zones.twoSection);
    delete stripped.zone_term;
    fs.writeFileSync(path.join(room.roomDir, '.mindrian', 'whitespace-results.json'),
      JSON.stringify({ metadata: { frozen_for: 'phase-363-tests' }, gaps: [stripped] }, null, 2), 'utf8');
    const replay = makeReplayFetch({ route: routeShape({ primary: 'gap_primary_zero', cover: 'gap_primary_zero', prior: 'gap_primary_zero' }) });
    const out = await AMBIENT.maybeQuick(room.roomDir, { producers: { whitespace: { outcome: 'no_candidate', posture: 'run' } } }, {
      budgetMs: 4 * 60 * 1000, now: Date.parse('2026-09-30T10:00:00Z'), deltaHash: 'e'.repeat(64), deps: { fetchEnvelopeFn: seam(replay) },
    });
    if (out.outcome !== 'context_insufficient' || out.reason !== 'no_zone_term') return 'outcome ' + JSON.stringify(out);
    if (replay.calls.length !== 0) return 'a search was sent without a zone term';
    return true;
  });

  // guards -----------------------------------------------------------------------
  check('dash guard: no em-dash or en-dash in this test', (function () {
    const s = fs.readFileSync(__filename, 'utf8');
    return s.indexOf(EM) === -1 && s.indexOf(EN) === -1;
  })());
  check('net guard: the only fetches were the recorded replay (zero real attempts)', guard.attempts() === 0, 'attempts ' + guard.attempts());
  check('global fetch restored to the net guard', globalThis.fetch === NET_GUARD_FETCH);

  rooms.forEach(function (r) { try { r.cleanup(); } catch (_e) { /* ok */ } });
  const code = summary();

  const metrics = {
    note: 'offline replay: latency is engine and process overhead only, not network',
    quick_run_cli_ms: { n: CLI_TIMES.quick.length, p50: pct(CLI_TIMES.quick, 50), p90: pct(CLI_TIMES.quick, 90) },
    plan_cli_ms: { n: CLI_TIMES.plan.length, p50: pct(CLI_TIMES.plan, 50), p90: pct(CLI_TIMES.plan, 90) },
    grant_approve_cli_ms: { n: CLI_TIMES.grant.length, p50: pct(CLI_TIMES.grant, 50), p90: pct(CLI_TIMES.grant, 90) },
    deep_loop_total_ms: { n: CLI_TIMES.deep_loop.length, p50: pct(CLI_TIMES.deep_loop, 50), p90: pct(CLI_TIMES.deep_loop, 90) },
    deep_cli_call_ms: { n: CLI_TIMES.deep_call.length, p50: pct(CLI_TIMES.deep_call, 50), p90: pct(CLI_TIMES.deep_call, 90) },
    mcp_run_quick_ms: METRICS.mcp_run_quick_ms === undefined ? null : METRICS.mcp_run_quick_ms,
    rows_per_query: METRICS.rows_per_query || [],
    deep: METRICS.deep || null,
    deep_direct: METRICS.deep_direct || null,
    replay_rows_settled: METRICS.replay_rows_settled || null,
    legs_ms: METRICS.legs,
  };
  console.log('ACCEPTANCE_METRICS ' + JSON.stringify(metrics));
  return code;
}

main().then(function (code) { process.exit(code); }).catch(function (e) {
  console.log('FAIL: harness ' + ((e && e.stack) || String(e)));
  process.exit(1);
});
