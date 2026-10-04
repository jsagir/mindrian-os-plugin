'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 363 Plan 17 -- the research_run MCP tool (lib/mcp/tools/research.cjs),
 * the Desktop and Cowork door to the planner facade. Legs M1-M12.
 *
 * The tool is driven through the register seam: registerCoreTools(stubServer)
 * discovers lib/mcp/tools/research.cjs and gate.cjs, and the stub captures both
 * handlers, so a gate minted by research_run is answered by the REAL gate_answer
 * through the one shared gate ledger (Canon Part 3, one governed path). M4 spawns
 * a fresh node process to prove a grant survives a server restart. Quick runs use
 * the recorded OpenAlex replay as globalThis.fetch; every other moment is under
 * the net guard. Rooms come from fixture-room-363; no network anywhere.
 *
 * No em-dash or en-dash literals: those characters are spelled with
 * String.fromCharCode. Exit 0 pass, 1 fail, 77 skip (fixtures absent).
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos363-mcp-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos363-mcp-roomshome-'));
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;

const ROOT = path.resolve(__dirname, '..');
const hygiene = require(path.join(__dirname, 'helpers', 'hygiene-355.cjs'));
hygiene.scrubVendorKey();
delete process.env.OPENALEX_API_KEY;
delete process.env.OPENALEX_EMAIL;
const guard = hygiene.installNetGuard();
const NET_GUARD_FETCH = globalThis.fetch;
const { check, summary } = hygiene.makeChecker('363-17 research_run MCP tool');

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

let buildRoom363 = null;
let makeReplayFetch = null;
try {
  buildRoom363 = require(path.join(__dirname, 'helpers', 'fixture-room-363.cjs')).buildRoom363;
  makeReplayFetch = require(path.join(__dirname, 'helpers', 'openalex-replay-363.cjs')).makeReplayFetch;
} catch (_e) {
  console.log('SKIP: 363-02 helpers absent');
  process.exit(77);
}

const QS_DIR = path.join(ROOT, 'tests', 'fixtures', '363-question-sets');
function qsFile(name) { return JSON.parse(fs.readFileSync(path.join(QS_DIR, name + '.json'), 'utf8')); }

const planner = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'planner.cjs'));
const grants = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'grants.cjs'));
const { registerCoreTools } = require(path.join(ROOT, 'lib', 'mcp', 'register-core-tools.cjs'));

const TOOL_PATH = path.join(ROOT, 'lib', 'mcp', 'tools', 'research.cjs');
const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'mos363-mcp-scratch-'));
const rooms = [];
function newRoom(role) {
  const r = buildRoom363({ role: role || 'founder' });
  rooms.push(r);
  return r;
}

// -- the register seam ---------------------------------------------------------
function boot(room, surface) {
  const captured = new Map();
  const stub = {
    tool: function (name, description, schema, handler) { captured.set(name, { description: description, schema: schema, handler: handler }); },
    registerTool: function (name, config, handler) {
      const cfg = config || {};
      captured.set(name, { description: cfg.description, schema: cfg.inputSchema, handler: handler });
    },
  };
  registerCoreTools(stub, { fallbackRoomDir: room.roomDir, pluginRoot: ROOT, surface: surface || 'desktop' });
  return captured;
}

function parse(raw) {
  const text = raw && raw.content && raw.content[0] && raw.content[0].text;
  try { return JSON.parse(text); } catch (_e) { return { _unparsed: String(text).slice(0, 300) }; }
}

function client(room, sessionId, surface) {
  const captured = boot(room, surface);
  const reg = captured.get('research_run');
  const answerReg = captured.get('gate_answer');
  const extra = { sessionId: sessionId };
  return {
    captured: captured,
    reg: reg,
    call: async function (input) {
      if (!reg) throw new Error('research_run is not registered');
      return parse(await reg.handler(input, extra));
    },
    answer: async function (gateId, chosen, verdict) {
      if (!answerReg) throw new Error('gate_answer is not registered');
      return parse(await answerReg.handler({ gate_id: gateId, chosen: chosen, verdict: verdict }, extra));
    },
  };
}

function withDb(room, fn) {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(path.join(room.roomDir, '.mindrian', 'room.db'));
  try { return fn(db); } finally { db.close(); }
}
function nodeExists(room, id) {
  return withDb(room, function (db) { return !!db.prepare('SELECT id FROM nodes WHERE id = ?').get(id); });
}
function runDir(room, runId) { return path.join(room.roomDir, '.mindrian', 'research-runs', runId); }
function optionIds(card) { return (card && card.options ? card.options : []).map(function (o) { return o.id; }); }
function replayFor(route) {
  return makeReplayFetch({ route: route || function () { return 'gap_primary_zero'; } });
}
async function withReplay(replay, fn) {
  globalThis.fetch = replay;
  try { return await fn(); } finally { globalThis.fetch = NET_GUARD_FETCH; }
}

// plan a quick run and approve a standing grant through the real gate flow.
async function planQuick(c) {
  const planned = await c.call({ op: 'plan', question_set: qsFile('whitespace-quick'), mode: 'quick' });
  return planned;
}
async function approveGrantFor(c, runId) {
  const req = await c.call({ op: 'grant_request', run_id: runId });
  if (!req.gate || !req.gate.gate_id) return { error: 'no gate: ' + JSON.stringify(req).slice(0, 300) };
  const ans = await c.answer(req.gate.gate_id, ['approve_standing'], 'approve');
  return { req: req, ans: ans };
}

async function leg(name, fn) {
  try {
    const r = await fn();
    check(name, r === true, String(r));
  } catch (e) {
    check(name, false, (e && e.stack) || String(e));
  }
}

const SHARED = {};

async function main() {
  // M1 ---------------------------------------------------------------------
  await leg('M1 the server lists research_run with an honest description', async function () {
    const room = newRoom('founder');
    const c = client(room, 'sess-m1');
    if (!c.reg) return 'research_run not registered';
    const d = String(c.reg.description || '');
    if (d.length < 120) return 'description too short ' + d.length;
    if (!/quick/i.test(d) || !/deep/i.test(d)) return 'description does not name quick and deep runs';
    if (!/Claude Code/.test(d)) return 'description does not say deep execution happens in Claude Code';
    if (d.indexOf(EM) !== -1 || d.indexOf(EN) !== -1) return 'dash in description';
    if (!c.captured.get('gate_answer')) return 'gate_answer not registered beside it';
    return true;
  });

  // M2 ---------------------------------------------------------------------
  await leg('M2 planners and plan answer exactly as the facade does', async function () {
    const room = newRoom('founder');
    const c = client(room, 'sess-m2');
    const p = await c.call({ op: 'planners' });
    if (p.ok !== true || !Array.isArray(p.planners) || p.planners.length === 0) return 'planners ' + JSON.stringify(p).slice(0, 200);
    const planned = await planQuick(c);
    if (planned.ok !== true || !/^rp-/.test(String(planned.run_id))) return 'plan ' + JSON.stringify(planned).slice(0, 300);
    if (planned.status !== 'ready' || planned.mode !== 'quick') return 'status ' + planned.status + ' mode ' + planned.mode;
    const loaded = planner.loadPlan(room.roomDir, planned.run_id);
    if (!loaded.ok) return 'plan not saved';
    const want = planner.cardFor(room.roomDir, loaded.plan, {});
    if (planned.next !== want.next) return 'next ' + planned.next + ' vs ' + want.next;
    if ((planned.card && planned.card.shape) !== (want.card && want.card.shape)) return 'card shape differs';
    if (planned.card && planned.card.title !== want.card.title) return 'card title differs';
    SHARED.m2 = { room: room, runId: planned.run_id };
    return true;
  });

  // M3 ---------------------------------------------------------------------
  await leg('M3 grant_request mints a gate; nothing persists until gate_answer approve; single use', async function () {
    const room = newRoom('founder');
    const c = client(room, 'sess-m3');
    const planned = await planQuick(c);
    const req = await c.call({ op: 'grant_request', run_id: planned.run_id });
    if (req.ok !== true || !req.gate || !req.gate.gate_id) return 'no gate ' + JSON.stringify(req).slice(0, 300);
    if (!req.card || req.card.shape !== 'F.0') return 'card shape ' + (req.card && req.card.shape);
    if (typeof req.gate.rendered === 'undefined') return 'gate not rendered through renderGate';
    const before = grants.readGrants(room.roomDir, {}).grants;
    if (before.length !== 0) return 'grant written before gate_answer';
    const ans = await c.answer(req.gate.gate_id, ['approve_standing'], 'approve');
    if (ans.ok !== true) return 'gate_answer ' + JSON.stringify(ans).slice(0, 300);
    if (!ans.chain_result || ans.chain_result.ok !== true) return 'resume ' + JSON.stringify(ans.chain_result).slice(0, 300);
    const after = grants.readGrants(room.roomDir, {}).grants;
    if (after.length !== 1) return 'grant count ' + after.length;
    const g = after[0];
    if (!g.approved_via || g.approved_via.surface !== 'mcp') return 'approved_via ' + JSON.stringify(g.approved_via);
    if (!g.approved_via.decision_node_id || !nodeExists(room, g.approved_via.decision_node_id)) return 'decision node missing';
    const again = await c.answer(req.gate.gate_id, ['approve_standing'], 'approve');
    // Phase 369 plan 26: a second answer replays the recorded one (replayed:true) and writes nothing.
    if (again.ok !== true || again.replayed !== true) return 'second answer ' + JSON.stringify(again).slice(0, 200);
    if (grants.readGrants(room.roomDir, {}).grants.length !== 1) return 'replay wrote another grant';
    // a reject writes nothing
    const other = newRoom('founder');
    const c2 = client(other, 'sess-m3b');
    const p2 = await planQuick(c2);
    const r2 = await c2.call({ op: 'grant_request', run_id: p2.run_id });
    const rej = await c2.answer(r2.gate.gate_id, ['not_now'], 'reject');
    if (rej.ok === false && rej.reason) return 'reject refused ' + rej.reason;
    if (grants.readGrants(other.roomDir, {}).grants.length !== 0) return 'reject wrote a grant';
    // approving verdict with a non-approving choice writes nothing
    const r3 = await c2.call({ op: 'grant_request', run_id: p2.run_id });
    const odd = await c2.answer(r3.gate.gate_id, ['not_now'], 'approve');
    if (grants.readGrants(other.roomDir, {}).grants.length !== 0) return 'approve verdict on a not_now choice wrote a grant';
    // 2026-10-04: Phase 369 reply-shape change. gate_answer now refuses an approve verdict on a
    // non-approving choice up front (ok:false, reason chosen_not_approving, gate left open, no
    // resume), so the odd answer is flagged at the top level, not under chain_result.
    if (!(odd.ok === false && odd.reason === 'chosen_not_approving')) return 'odd answer not flagged ' + JSON.stringify(odd).slice(0, 200);
    if (odd.chain_result) return 'odd answer resumed the chain ' + JSON.stringify(odd.chain_result).slice(0, 200);
    SHARED.m3 = { room: room, runId: planned.run_id };
    return true;
  });

  // M4 ---------------------------------------------------------------------
  await leg('M4 a fresh server process reads the approved grant through grant_status', async function () {
    const m3 = SHARED.m3;
    if (!m3) return 'M3 did not produce a room';
    const script = path.join(SCRATCH, 'restart-probe.cjs');
    fs.writeFileSync(script, [
      "'use strict';",
      'const path = require(\'node:path\');',
      'const root = ' + JSON.stringify(ROOT) + ';',
      'const { registerCoreTools } = require(path.join(root, \'lib\', \'mcp\', \'register-core-tools.cjs\'));',
      'const cap = new Map();',
      'const stub = { tool: function (n, d, s, h) { cap.set(n, h); }, registerTool: function (n, c, h) { cap.set(n, h); } };',
      'registerCoreTools(stub, { fallbackRoomDir: ' + JSON.stringify(m3.room.roomDir) + ', pluginRoot: root, surface: \'desktop\' });',
      '(async function () {',
      '  const raw = await cap.get(\'research_run\')({ op: \'grant_status\' }, { sessionId: \'sess-restart\' });',
      '  process.stdout.write(raw.content[0].text);',
      '})().catch(function (e) { process.stderr.write(String(e && e.stack)); process.exit(1); });',
      '',
    ].join('\n'), 'utf8');
    const env = Object.assign({}, process.env, { HOME: TMP_HOME, USERPROFILE: TMP_HOME });
    const res = spawnSync(process.execPath, [script], { encoding: 'utf8', env: env, timeout: 60000 });
    if (res.status !== 0) return 'child exit ' + res.status + ' ' + String(res.stderr).slice(0, 300);
    let out = null;
    try { out = JSON.parse(res.stdout); } catch (_e) { return 'child output not json: ' + String(res.stdout).slice(0, 200); }
    if (!out.standing || out.standing.approved_via.surface !== 'mcp') return 'standing grant not visible after restart ' + JSON.stringify(out).slice(0, 300);
    return true;
  });

  // M5 ---------------------------------------------------------------------
  await leg('M5 run_quick with a grant returns the evidence card; without one returns the F.0 card and fetches nothing', async function () {
    const m3 = SHARED.m3;
    if (!m3) return 'M3 did not produce a room';
    const c = client(m3.room, 'sess-m5');
    const replay = replayFor();
    const done = await withReplay(replay, function () { return c.call({ op: 'run_quick', run_id: m3.runId }); });
    if (done.ok !== true || done.status !== 'done') return 'run_quick ' + JSON.stringify(done).slice(0, 400);
    if (!done.card || typeof done.answer_line !== 'string' || !done.verdict) return 'no evidence card, verdict or answer line';
    if (replay.calls.length === 0) return 'no replay call was made by a covered run';
    SHARED.m5 = { room: m3.room, runId: m3.runId };

    const bare = newRoom('founder');
    const cb = client(bare, 'sess-m5b');
    const planned = await planQuick(cb);
    const replay2 = replayFor();
    const asked = await withReplay(replay2, function () { return cb.call({ op: 'run_quick', run_id: planned.run_id }); });
    if (replay2.calls.length !== 0) return 'a fetch happened without a grant: ' + replay2.calls.length;
    if (!asked.card || asked.card.shape !== 'F.0') return 'no F.0 card without a grant ' + JSON.stringify(asked).slice(0, 300);
    if (asked.status === 'done') return 'ran without a grant';
    if (fs.existsSync(path.join(runDir(bare, planned.run_id), 'run.json'))) return 'run state written without a grant';
    return true;
  });

  // M6 ---------------------------------------------------------------------
  await leg('M6 deep_plan returns the F.6 gate and says deep execution runs in Claude Code', async function () {
    const room = newRoom('founder');
    const c = client(room, 'sess-m6');
    const before = guard.attempts();
    const res = await c.call({ op: 'deep_plan', question_set: qsFile('scientific-roadmapping') });
    if (res.ok !== true) return 'deep_plan ' + JSON.stringify(res).slice(0, 300);
    if (!res.card || res.card.shape !== 'F.6') return 'card shape ' + (res.card && res.card.shape);
    if (!res.gate || !res.gate.gate_id) return 'no gate';
    if (!/Claude Code/.test(String(res.deep_execution || ''))) return 'no Claude Code line ' + JSON.stringify(res.deep_execution);
    if (!/research-runs/.test(String(res.deep_execution || ''))) return 'saved plan location not named';
    if (grants.findActiveGrant(room.roomDir, { lifetime: 'run', run_id: res.run_id })) return 'run grant before approval';
    const ans = await c.answer(res.gate.gate_id, ['run'], 'approve');
    if (ans.ok !== true || !ans.chain_result || ans.chain_result.ok !== true) return 'approve ' + JSON.stringify(ans).slice(0, 300);
    const g = grants.findActiveGrant(room.roomDir, { lifetime: 'run', run_id: res.run_id });
    if (!g) return 'no run grant after approval';
    if (g.approved_via.surface !== 'mcp') return 'approved_via surface ' + g.approved_via.surface;
    if (guard.attempts() !== before) return 'a fetch was attempted by deep_plan';
    if (!fs.existsSync(path.join(runDir(room, res.run_id), 'plan.json'))) return 'plan not saved under research-runs';
    if (fs.existsSync(path.join(runDir(room, res.run_id), 'state.json'))) return 'deep state started on Desktop';
    // a plan that is not ready gets a card and no gate
    const bad = await c.call({ op: 'deep_plan', question_set: qsFile('restated-only') });
    if (bad.gate) return 'a gate was minted for a plan that is not ready';
    if (!bad.card) return 'no card for a plan that is not ready';
    return true;
  });

  // M7 ---------------------------------------------------------------------
  await leg('M7 basket mints an F.8 gate; file needs a consumed basket gate from this tool', async function () {
    const m5 = SHARED.m5;
    if (!m5) return 'M5 did not produce a finished run';
    const c = client(m5.room, 'sess-m7');
    const b = await c.call({ op: 'basket', run_id: m5.runId });
    if (b.ok !== true || !b.gate || !b.gate.gate_id) return 'basket ' + JSON.stringify(b).slice(0, 300);
    if (!b.card || b.card.shape !== 'F.8') return 'card shape ' + (b.card && b.card.shape);
    if (!Array.isArray(b.items) || b.items.length === 0) return 'no items';
    const filedPath = path.join(runDir(m5.room, m5.runId), 'filing.json');
    // a bare flag, a made-up id, and an unanswered gate all refuse and write nothing
    const bare = await c.call({ op: 'file', run_id: m5.runId, approved: true });
    if (bare.ok !== false) return 'bare file was not refused';
    const fake = await c.call({ op: 'file', gate_id: 'gate-0000000000000000' });
    if (fake.ok !== false) return 'a gate id this tool never minted was accepted';
    const early = await c.call({ op: 'file', gate_id: b.gate.gate_id });
    if (early.ok !== false) return 'an unanswered gate was accepted';
    if (fs.existsSync(filedPath)) return 'something was filed before approval';
    // another session cannot use this session's approval
    const ids = b.items.filter(function (i) { return i.default_on; }).map(function (i) { return i.id; });
    if (ids.length === 0) return 'no default-on items in the basket';
    const ans = await c.answer(b.gate.gate_id, ids, 'approve');
    if (ans.ok !== true) return 'gate_answer ' + JSON.stringify(ans).slice(0, 300);
    const other = client(m5.room, 'sess-m7-other');
    const stolen = await other.call({ op: 'file', gate_id: b.gate.gate_id });
    if (stolen.ok !== false) return 'a different session filed with this approval';
    const filed = await c.call({ op: 'file', gate_id: b.gate.gate_id });
    if (filed.ok !== true) return 'file after approval ' + JSON.stringify(filed).slice(0, 400);
    if (!fs.existsSync(filedPath)) return 'filing.json not written';
    const twice = await c.call({ op: 'file', gate_id: b.gate.gate_id });
    if (twice.ok !== false) return 'the approval was used twice';
    return true;
  });

  // M8 ---------------------------------------------------------------------
  await leg('M8 every response carries pending cards exactly once', async function () {
    const room = newRoom('founder');
    const c = client(room, 'sess-m8');
    const planned = await planQuick(c);
    const q = planner.queuePendingCard(room.roomDir, { run_id: planned.run_id, kind: 'plan_card_no_grant' });
    if (!q.ok) return 'queue ' + JSON.stringify(q);
    const first = await c.call({ op: 'grant_status' });
    if (!Array.isArray(first.pending_cards)) return 'no pending_cards array on a response';
    if (first.pending_cards.length !== 1 || first.pending_cards[0].run_id !== planned.run_id) return 'first response ' + JSON.stringify(first.pending_cards).slice(0, 200);
    const second = await c.call({ op: 'planners' });
    if (!Array.isArray(second.pending_cards) || second.pending_cards.length !== 0) return 'card shown twice ' + JSON.stringify(second.pending_cards).slice(0, 200);
    const q2 = planner.queuePendingCard(room.roomDir, { run_id: planned.run_id, kind: 'evidence' });
    if (!q2.ok) return 'second queue failed';
    const viaPending = await c.call({ op: 'pending' });
    if (!Array.isArray(viaPending.cards) && !Array.isArray(viaPending.pending_cards)) return 'pending op returned no list';
    const seen = (viaPending.cards || viaPending.pending_cards || []);
    if (seen.length !== 1) return 'pending op cards ' + seen.length;
    const after = await c.call({ op: 'pending' });
    if ((after.cards || after.pending_cards || []).length !== 0) return 'pending op repeated a surfaced card';
    return true;
  });

  // M9 ---------------------------------------------------------------------
  await leg('M9 grant_revoke revokes and a later run_quick asks again', async function () {
    const room = newRoom('founder');
    const c = client(room, 'sess-m9');
    const planned = await planQuick(c);
    const ok = await approveGrantFor(c, planned.run_id);
    if (ok.error) return ok.error;
    const st = await c.call({ op: 'grant_status' });
    if (!st.standing || !st.standing.grant_id) return 'no standing grant to revoke';
    const bad = await c.call({ op: 'grant_revoke', grant_id: 'not-a-grant' });
    if (bad.ok !== false) return 'a malformed grant id was accepted';
    const rev = await c.call({ op: 'grant_revoke', grant_id: st.standing.grant_id });
    if (rev.ok !== true) return 'revoke ' + JSON.stringify(rev).slice(0, 200);
    const replay = replayFor();
    const res = await withReplay(replay, function () { return c.call({ op: 'run_quick', run_id: planned.run_id }); });
    if (replay.calls.length !== 0) return 'a fetch happened after revoke';
    if (!res.card || res.card.shape !== 'F.0') return 'no F.0 card after revoke ' + JSON.stringify(res).slice(0, 300);
    if (['grant_revoked', 'no_grant'].indexOf(res.reason) === -1) return 'reason ' + res.reason;
    return true;
  });

  // M10 --------------------------------------------------------------------
  await leg('M10 the zod schema rejects an unknown op and a non-object question_set without echoing input', async function () {
    const room = newRoom('founder');
    const c = client(room, 'sess-m10');
    if (!c.reg) return 'research_run not registered';
    const schema = c.reg.schema;
    if (!schema || typeof schema.safeParse !== 'function') return 'no zod input schema';
    const MARK = 'SECRET-363-zz' + Date.now();
    const a = schema.safeParse({ op: MARK });
    if (a.success) return 'unknown op accepted';
    if (JSON.stringify(a.error.issues).indexOf(MARK) !== -1) return 'unknown op echoed in the error';
    const b = schema.safeParse({ op: 'plan', question_set: MARK });
    if (b.success) return 'string question_set accepted';
    if (JSON.stringify(b.error.issues).indexOf(MARK) !== -1) return 'question_set echoed in the error';
    const ok = schema.safeParse({ op: 'planners' });
    if (!ok.success) return 'a valid op was rejected';
    const ops = ['planners', 'plan', 'grant_request', 'grant_status', 'grant_revoke', 'run_quick', 'deep_plan', 'basket', 'file', 'pending', 'perspective_recall', 'perspective_candidates', 'perspective_judge'];
    for (let i = 0; i < ops.length; i += 1) {
      if (!schema.safeParse({ op: ops[i] }).success) return 'op ' + ops[i] + ' not in the schema';
    }
    const unknown = await c.call({ op: 'nope' });
    if (unknown.ok !== false) return 'handler accepted an unknown op';
    if (JSON.stringify(unknown).indexOf('nope') !== -1) return 'handler echoed the op';
    const missing = await c.call({ op: 'plan' });
    if (missing.ok !== false) return 'plan without a question_set was accepted';
    return true;
  });

  // M11 --------------------------------------------------------------------
  await leg('M11 Part 8: no brain or theo reach, the planted marker never leaves', async function () {
    const code = hygiene.nonCommentLines(TOOL_PATH);
    const codeText = Array.isArray(code) ? code.join('\n') : String(code);
    if (/brain|theo|adapter-client|part8/i.test(codeText)) return 'source names a brain or theo surface';
    const room = newRoom('founder');
    const c = client(room, 'sess-m11');
    const names = Array.from(c.captured.keys());
    const reach = names.filter(function (n) { return /^brain_|^theo|mindrian-brain/i.test(n); });
    if (reach.length !== 0) return 'brain-shaped tools registered beside it: ' + reach.join(',');
    const planned = await planQuick(c);
    const ok = await approveGrantFor(c, planned.run_id);
    if (ok.error) return ok.error;
    const replay = replayFor();
    const done = await withReplay(replay, function () { return c.call({ op: 'run_quick', run_id: planned.run_id }); });
    if (done.status !== 'done') return 'run did not finish ' + JSON.stringify(done).slice(0, 200);
    if (replay.calls.length === 0) return 'no search was made';
    const urls = replay.calls.map(function (x) { return x.url; }).join('\n');
    if (urls.indexOf(room.marker) !== -1) return 'marker in a search url';
    const hosts = replay.calls.every(function (x) { return /^https:\/\/api\.openalex\.org\//.test(x.url); });
    if (!hosts) return 'a call went somewhere other than the provider';
    if (replay.violations.length !== 0) return 'replay recorded a violation';
    const mdir = path.join(room.roomDir, '.mindrian');
    const audit = path.join(mdir, 'research-audit.jsonl');
    if (fs.existsSync(audit) && fs.readFileSync(audit, 'utf8').indexOf(room.marker) !== -1) return 'marker in the audit ledger';
    const gfile = path.join(mdir, 'research-grants.json');
    if (fs.existsSync(gfile) && fs.readFileSync(gfile, 'utf8').indexOf(room.marker) !== -1) return 'marker in the grants file';
    if (JSON.stringify(done).indexOf(room.marker) !== -1) return 'marker in the response';
    return true;
  });

  // M12 --------------------------------------------------------------------
  await leg('M12 the connectors export declares research_run as an F.6 mcp-tool', async function () {
    if (!fs.existsSync(TOOL_PATH)) return 'lib/mcp/tools/research.cjs missing';
    const mod = require(TOOL_PATH);
    if (typeof mod.register !== 'function') return 'no register export';
    if (!Array.isArray(mod.connectors) || mod.connectors.length !== 1) return 'connectors export missing';
    const e = mod.connectors[0];
    if (e.tool !== 'research_run' || e.surface !== 'research_run') return 'tool or surface name';
    if (e.connector !== 'mcp-tool') return 'connector ' + e.connector;
    if (e.hitl_shape !== 'F.6') return 'hitl_shape ' + e.hitl_shape;
    if (typeof e.hitl_why !== 'string' || e.hitl_why.length < 20) return 'no hitl_why';
    if (typeof e.layer !== 'string' || typeof e.layer_why !== 'string' || e.layer_why.length < 20) return 'no layer or layer_why';
    for (const k of Object.keys(e)) {
      if (typeof e[k] === 'string' && (e[k].indexOf(EM) !== -1 || e[k].indexOf(EN) !== -1)) return 'dash in connectors.' + k;
    }
    return true;
  });

  // guards -----------------------------------------------------------------
  check('dash guard: no em-dash or en-dash in the tool or this test', (function () {
    const files = [__filename, TOOL_PATH].filter(function (f) { return fs.existsSync(f); });
    return files.every(function (f) {
      const s = fs.readFileSync(f, 'utf8');
      return s.indexOf(EM) === -1 && s.indexOf(EN) === -1;
    });
  })());
  check('net guard: the only fetches were the recorded replay (zero real attempts)', guard.attempts() === 0, 'attempts ' + guard.attempts());
  check('global fetch restored to the net guard', globalThis.fetch === NET_GUARD_FETCH);

  rooms.forEach(function (r) { try { r.cleanup(); } catch (_e) { /* ok */ } });
  return summary();
}

main().then(function (code) { process.exit(code); }).catch(function (e) {
  console.log('FAIL: harness ' + ((e && e.stack) || String(e)));
  process.exit(1);
});
