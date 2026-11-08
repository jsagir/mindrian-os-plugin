#!/usr/bin/env node
'use strict';

/**
 * Phase 374 plan 08, Task 2: plan, approval gate, start (decisions D-04, D-08, D-10; threats T-374-30 to T-374-36).
 *
 * Arms (one line each, "ok - P<n> ..." or "FAIL - P<n> ..." at column 1):
 *   P1  a start with no approval: one plan call, no start call, one material_step gate (approving approve_run),
 *       an awaiting_approval answer with a gate_id and a plan_summary and no job_id, the plan child closed
 *   P2  refused before any child: an artifacts key, an approval key, the network opt-in, bad node_ids, an empty
 *       objective, a bad top_k, an unknown key
 *   P3  a blocked plan and a refused plan (each of the 15 codes) return the fixed sentence of the table, mint no
 *       gate and start nothing; an unknown code gives the generic sentence; the engine text never shows
 *   P4  approve through the ledger makes exactly one start call, with the planned request plus
 *       approval { plan_digest, approval_ref = gate id } and a 64 hex idempotency key; a job session is kept
 *   P5  reject and defer start nothing; a second answer finds no gate; after a restart (ledger cleared) the
 *       answer finds no gate and the awaiting note says to plan again
 *   P6  a start refused with plan_consumed shows the fixed sentence and the fake saw exactly one start call
 *   P7  the card text holds the counts, both engine names, the label, the 30 day record and the delete-path
 *       wording, and none of the marker strings planted in titles, texts and warnings
 *
 * In-process fake Client and Transport. A stub prepare returns the bundle. The real gate ledger is used. No
 * engine, no network, no room. CJS. Hyphens only.
 */

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const ID = 'opportunity.run_pair_screen';
const SESSION = 'p-session-374-08';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 't374-08-plan-gate-'));
const ENGINE = path.join(TMP, 'engine');
fs.mkdirSync(ENGINE);
fs.writeFileSync(path.join(ENGINE, 'pyproject.toml'), '[project]\nname = "mindrian-eureka"\n\n[project.scripts]\neureka-mcp = "fixture:main"\n');
const SAVED_HOME = process.env.HOME;
const SAVED_USERPROFILE = process.env.USERPROFILE;
process.env.HOME = TMP;
process.env.USERPROFILE = TMP;
function cleanup() {
  if (SAVED_HOME === undefined) delete process.env.HOME; else process.env.HOME = SAVED_HOME;
  if (SAVED_USERPROFILE === undefined) delete process.env.USERPROFILE; else process.env.USERPROFILE = SAVED_USERPROFILE;
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
}

const jobs = require(path.join(REPO, 'lib', 'mcp', 'tools', 'eureka-capability-jobs.cjs'));
const run = require(path.join(REPO, 'lib', 'mcp', 'tools', 'eureka-capability-run.cjs'));
const gateLedger = require(path.join(REPO, 'lib', 'mcp', 'gate-ledger.cjs'));
let pairScreen = null;
let loadError = null;
try { pairScreen = require(path.join(REPO, 'lib', 'mcp', 'eureka-pair-screen.cjs')); } catch (e) { loadError = e; }

let failed = 0;
async function arm(id, label, fn) {
  try {
    await fn();
    process.stdout.write('ok - ' + id + ' ' + label + '\n');
  } catch (err) {
    failed += 1;
    const msg = (err && err.message) ? String(err.message).split('\n')[0] : String(err);
    process.stdout.write('FAIL - ' + id + ' ' + label + ' :: ' + msg + '\n');
  }
}

const MARK_T = ['PLANTTITLE-5b7e-1', 'PLANTTITLE-5b7e-2', 'PLANTTITLE-5b7e-3'];
const MARK_X = ['PLANTTEXT-d013-1', 'PLANTTEXT-d013-2', 'PLANTTEXT-d013-3'];
const MARK_W = 'PLANTWARN-77aa';
const MARK_E = 'ENGINE-TEXT-MARK-3c9d';
const MARKERS = MARK_T.concat(MARK_X, [MARK_W, MARK_E]);

const NODE_IDS = ['n1', 'n2', 'n3'];
function hex(text) { return crypto.createHash('sha256').update(text, 'utf8').digest('hex'); }
function sc(payload) { return { structuredContent: payload, content: [{ type: 'text', text: JSON.stringify(payload) }] }; }

function readyPlan(request) {
  return {
    schema_version: 'eureka.pair-screen-plan.v1', status: 'ready', label: 'candidate, not verified', capability_id: ID,
    plan_digest: hex(JSON.stringify(request)), expires_at: '2026-11-09T10:00:00Z',
    scope_id: request.scope_id, snapshot_id: request.snapshot_id, objective: request.objective,
    top_k: request.top_k === undefined ? 200 : request.top_k,
    counts: { artifacts: 3, text_bytes: 4242, records_usable: 2, records_dropped: 1 },
    engines: [
      { name: 'Find Unusual Pairs Across a Research Collection', capability_id: 'opportunity.find_unusual_pairs' },
      { name: 'Rank Unusual Pairs by Wording and Meaning', capability_id: 'opportunity.rank_unusual_pairs_wording_meaning' },
    ],
    model: { found: true, origin: 'local model source' },
    outputs_expected: ['unusual-pairs.json', 'ranked-pairs.md'],
    network: 'denied; the run is offline and makes no network call',
    writes: { room: 'none', portfolio: 'none', job_store: 'kept 30 days' },
    approval_required: true, how_to_approve: 'Ask the person.', stages: ['validate'],
    warnings: [MARK_W + ' warning text that holds room words'],
    host_handoff: { state: 'awaiting_approval', owner: 'mindrianos' },
  };
}

// One fresh set of fakes for each arm.
function makeWorld() {
  const log = { calls: [], clients: [], prepareCalls: [] };
  const state = {
    plan: (request) => readyPlan(request),
    start: () => ({ job_id: 'job-p-1', status: 'queued' }),
  };
  class FakeTransport { constructor(options) { this.options = options; this.stderr = null; } }
  class FakeClient {
    constructor() { this.closed = false; log.clients.push(this); }
    async connect() { /* nothing */ }
    async close() { this.closed = true; }
    async callTool(call) {
      log.calls.push({ name: call.name, arguments: JSON.parse(JSON.stringify(call.arguments || {})) });
      const args = call.arguments || {};
      if (call.name === 'scout_capabilities') {
        return sc({ capabilities: [
          { id: ID, status: 'experimental', routes: { mcp: { tool: 'scout_start_pair_screen', plan_tool: 'scout_plan_pair_screen' } } },
          { id: 'opportunity.other_pair_route', status: 'experimental', routes: { mcp: { tool: 'scout_start_pair_screen' } } },
        ] });
      }
      if (call.name === 'scout_capability_contract') {
        return sc({ capability: { id: args.capability_id }, schemas: { input: { type: 'object' }, output: { type: 'object' } } });
      }
      if (call.name === 'scout_plan_pair_screen') return sc(state.plan(args.request));
      if (call.name === 'scout_start_pair_screen') return sc(state.start(args.request, args));
      return sc({});
    }
  }
  const artifacts = NODE_IDS.map((id, i) => ({
    id, source_ref: 'mindrian-graph://node/' + id, title: MARK_T[i], text: 'Synthetic ' + MARK_X[i], sha256: hex('Synthetic ' + MARK_X[i]),
  }));
  const deps = {
    env: Object.assign({}, process.env, { MINDRIAN_EUREKA_ROOT: ENGINE }),
    ctx: { surface: 'cli' },
    server: { registerTool() {}, server: { getClientCapabilities() { return {}; } } },
    Client: FakeClient,
    StdioClientTransport: FakeTransport,
    callerIdentity: () => ({ sessionKeyHash: hex(SESSION), roomId: 'room:p' }),
    prepare: async (a) => {
      log.prepareCalls.push(a);
      return { ok: true, scope_id: 'room:p', snapshot_id: 'snap-p-1', projection: {}, room_binding: { room_id: 'room:p' }, bundle: { artifacts: JSON.parse(JSON.stringify(artifacts)) } };
    },
  };
  const calls = (name) => log.calls.filter((c) => c.name === name);
  return { log, state, deps, calls };
}

const EXTRA = { sessionId: SESSION };
function startArgs(requestPatch) {
  return { capability_id: ID, request: Object.assign({ node_ids: NODE_IDS.slice(), objective: 'Find unusual pairs' }, requestPatch || {}) };
}
function gateIds() { return Array.from(gateLedger._internal._ledger.keys()); }
function dropGates(before) { for (const id of gateIds()) if (!before.includes(id)) gateLedger._internal._ledger.delete(id); }
function allStrings(value, out) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => allStrings(v, out));
  else if (value && typeof value === 'object') Object.keys(value).forEach((k) => { out.push(k); allStrings(value[k], out); });
  return out;
}
async function answer(gateId, chosen, verdict) {
  const entry = gateLedger.consumeGate(gateId, SESSION);
  if (!entry || entry.ok === false || typeof entry.resumeFn !== 'function') return { ok: false, reason: 'unknown_gate' };
  return entry.resumeFn({ gate_id: gateId, chosen, verdict });
}

async function main() {
  const need = () => { if (loadError) throw loadError; return pairScreen; };

  await arm('P1', 'a start with no approval plans once, mints one material_step gate and starts nothing', async () => {
    need();
    run.clearCatalogCache();
    const w = makeWorld();
    const before = gateIds();
    const out = await jobs.startCapability(startArgs(), EXTRA, w.deps);
    try {
      assert.equal(out.ok, true, JSON.stringify(out).slice(0, 300));
      assert.equal(out.status, 'awaiting_approval');
      assert.equal(typeof out.gate_id, 'string');
      assert.ok(out.plan_summary && typeof out.plan_summary === 'object', 'no plan_summary');
      assert.ok(!('job_id' in out), 'a job_id before the approval');
      assert.equal(w.calls('scout_plan_pair_screen').length, 1);
      assert.equal(w.calls('scout_start_pair_screen').length, 0);
      const minted = gateIds().filter((id) => !before.includes(id));
      assert.equal(minted.length, 1, 'gates minted: ' + minted.length);
      const entry = gateLedger.peekGate(out.gate_id, SESSION);
      assert.ok(entry && entry.ok !== false, 'the gate is not in the ledger');
      assert.equal(entry.kind, 'material_step');
      assert.deepEqual(entry.approving, ['approve_run']);
      assert.ok(w.log.clients.length >= 1 && w.log.clients.every((c) => c.closed), 'a plan child stayed open');
      assert.deepEqual(w.log.prepareCalls[0].node_ids, NODE_IDS, 'prepare did not get the node ids');
    } finally { dropGates(before); }
  });

  await arm('P2', 'bad input is refused before any child starts', async () => {
    need();
    const cases = [
      ['pair_screen_requires_node_ids', startArgs({ artifacts: [{ id: 'a' }] }), {}],
      ['pair_screen_approval_not_accepted', startArgs({ approval: { plan_digest: 'a'.repeat(64), approval_ref: 'x' } }), {}],
      ['network_opt_in_active', startArgs(), { MINDRIAN_EUREKA_ALLOW_NETWORK: '1' }],
      ['invalid_request', startArgs({ node_ids: ['n1'] }), {}],
      ['invalid_request', startArgs({ node_ids: Array.from({ length: 2501 }, (_, i) => 'n' + i) }), {}],
      ['invalid_request', startArgs({ node_ids: ['n1', 'n1'] }), {}],
      ['invalid_request', startArgs({ objective: '   ' }), {}],
      ['invalid_request', startArgs({ top_k: 0 }), {}],
      ['invalid_request', startArgs({ top_k: 1.5 }), {}],
      ['invalid_request', startArgs({ top_k: pairScreen.TOP_K_MAX + 1 }), {}],
      ['invalid_request', startArgs({ scope_id: 'forged' }), {}],
    ];
    assert.equal(pairScreen.TOP_K_MAX, 100, 'TOP_K_MAX');
    for (const [reason, args, envPatch] of cases) {
      run.clearCatalogCache();
      const w = makeWorld();
      w.deps.env = Object.assign({}, w.deps.env, envPatch);
      const before = gateIds();
      const out = await jobs.startCapability(args, EXTRA, w.deps);
      assert.equal(out.ok, false, reason + ': ' + JSON.stringify(out).slice(0, 200));
      assert.equal(out.reason, reason, 'expected ' + reason + ', got ' + out.reason);
      assert.equal(w.log.clients.length, 0, reason + ': a child started');
      assert.equal(w.log.prepareCalls.length, 0, reason + ': prepare ran');
      assert.equal(gateIds().length, before.length, reason + ': a gate was minted');
    }
    // another capability id that points at the pair-screen start route is refused, and nothing starts (T-374-30)
    run.clearCatalogCache();
    const wOther = makeWorld();
    const other = await jobs.startCapability({ capability_id: 'opportunity.other_pair_route', request: { scope_id: 's', snapshot_id: 't' } }, EXTRA, wOther.deps);
    assert.equal(other.ok, false);
    assert.equal(other.reason, 'capability_requires_approval');
    assert.equal(wOther.calls('scout_start_pair_screen').length, 0, 'the start route was called');
    // a good top_k is passed on
    run.clearCatalogCache();
    const w = makeWorld();
    const before = gateIds();
    const good = await jobs.startCapability(startArgs({ top_k: 7 }), EXTRA, w.deps);
    try {
      assert.equal(good.ok, true);
      assert.equal(w.calls('scout_plan_pair_screen')[0].arguments.request.top_k, 7);
    } finally { dropGates(before); }
  });

  await arm('P3', 'a blocked or refused plan gives the fixed sentence, no gate and no start', async () => {
    const ps = need();
    const CODES = ['bad_request', 'too_many_artifacts', 'bundle_too_large', 'duplicate_artifact_id', 'id_collision', 'artifact_hash_mismatch',
      'external_corpus_refused', 'approval_missing', 'approval_bad_reference', 'plan_unknown', 'plan_expired', 'plan_consumed', 'plan_mismatch',
      'local_model_unavailable', 'too_few_usable_records'];
    assert.deepEqual(Object.keys(ps.REFUSALS).sort(), CODES.slice().sort(), 'the table does not hold the 15 codes');
    const BLOCKED = new Set(['local_model_unavailable', 'too_few_usable_records']);
    for (const code of CODES.concat(['a_code_nobody_knows'])) {
      run.clearCatalogCache();
      const w = makeWorld();
      w.state.plan = (request) => (BLOCKED.has(code)
        ? { schema_version: 'eureka.pair-screen-plan.v1', status: 'blocked', label: 'candidate, not verified', capability_id: ID, reason: code,
          message: MARK_E, fix: MARK_E, scope_id: request.scope_id, snapshot_id: request.snapshot_id, host_handoff: { state: 'blocked' } }
        : { status: 'refused', reason: code, message: MARK_E, fix: MARK_E, label: 'candidate, not verified', room_write: 'not_performed' });
      const before = gateIds();
      const out = await jobs.startCapability(startArgs(), EXTRA, w.deps);
      assert.equal(out.ok, false, code + ': ' + JSON.stringify(out).slice(0, 200));
      const known = Object.prototype.hasOwnProperty.call(ps.REFUSALS, code);
      assert.equal(out.reason, known ? code : 'pair_screen_refused', code + ': reason ' + out.reason);
      assert.equal(out.message, known ? ps.REFUSALS[code] : ps.GENERIC_REFUSAL, code + ': message');
      assert.ok(JSON.stringify(out).indexOf(MARK_E) === -1, code + ': the engine text shows');
      assert.equal(gateIds().length, before.length, code + ': a gate was minted');
      assert.equal(w.calls('scout_start_pair_screen').length, 0, code + ': a start call');
      assert.ok(w.log.clients.every((c) => c.closed), code + ': a child stayed open');
    }
    // every sentence is plain, single-line and free of dash characters
    for (const sentence of Object.values(ps.REFUSALS).concat([ps.GENERIC_REFUSAL])) {
      assert.ok(sentence.length > 20 && sentence.length < 300 && !/[\u2013\u2014\n]/.test(sentence), 'bad sentence: ' + sentence);
    }
  });

  await arm('P4', 'approve makes exactly one start call with the planned request plus the approval block', async () => {
    need();
    run.clearCatalogCache();
    const w = makeWorld();
    const before = gateIds();
    const awaiting = await jobs.startCapability(startArgs({ top_k: 5 }), EXTRA, w.deps);
    try {
      assert.equal(awaiting.ok, true, JSON.stringify(awaiting).slice(0, 200));
      const planned = w.calls('scout_plan_pair_screen')[0].arguments.request;
      const planDigest = hex(JSON.stringify(planned));
      const res = await answer(awaiting.gate_id, ['approve_run'], 'approve');
      assert.equal(res.ok, true, JSON.stringify(res).slice(0, 300));
      assert.equal(typeof res.job_id, 'string');
      const startCalls = w.calls('scout_start_pair_screen');
      assert.equal(startCalls.length, 1, 'start calls: ' + startCalls.length);
      const sent = startCalls[0].arguments;
      assert.deepEqual(sent.request, Object.assign({}, planned, { approval: { plan_digest: planDigest, approval_ref: awaiting.gate_id } }));
      assert.match(sent.idempotency_key, /^[a-f0-9]{64}$/);
      assert.equal(sent.idempotency_key, hex(planDigest + ':' + awaiting.gate_id));
      assert.ok(jobs.sessions.has(res.job_id), 'no job session is kept');
      await jobs.closeSession(res.job_id);
    } finally { dropGates(before); }
  });

  await arm('P5', 'reject and defer start nothing; a second answer and a restart find no gate', async () => {
    need();
    const before = gateIds();
    try {
      for (const [chosen, verdict] of [[['stop'], 'reject'], [[], 'defer']]) {
        run.clearCatalogCache();
        const w = makeWorld();
        const awaiting = await jobs.startCapability(startArgs(), EXTRA, w.deps);
        const res = await answer(awaiting.gate_id, chosen, verdict);
        assert.equal(res.executed, false, verdict + ': executed');
        assert.equal(w.calls('scout_start_pair_screen').length, 0, verdict + ': a start call');
        const second = await answer(awaiting.gate_id, ['approve_run'], 'approve');
        assert.equal(second.reason, 'unknown_gate', verdict + ': second answer');
        assert.equal(w.calls('scout_start_pair_screen').length, 0, verdict + ': a start after the second answer');
      }
      // approve once, then answer again: only one start
      run.clearCatalogCache();
      const w = makeWorld();
      const awaiting = await jobs.startCapability(startArgs(), EXTRA, w.deps);
      const first = await answer(awaiting.gate_id, ['approve_run'], 'approve');
      assert.equal(first.ok, true);
      const again = await answer(awaiting.gate_id, ['approve_run'], 'approve');
      assert.equal(again.reason, 'unknown_gate');
      assert.equal(w.calls('scout_start_pair_screen').length, 1);
      await jobs.closeSession(first.job_id);
      // restart between plan and answer
      run.clearCatalogCache();
      const w2 = makeWorld();
      const awaiting2 = await jobs.startCapability(startArgs(), EXTRA, w2.deps);
      assert.ok(/plan again/i.test(String(awaiting2.note)), 'the note does not say to plan again: ' + awaiting2.note);
      gateLedger._internal._ledger.clear();
      const lost = await answer(awaiting2.gate_id, ['approve_run'], 'approve');
      assert.equal(lost.reason, 'unknown_gate');
      assert.equal(w2.calls('scout_start_pair_screen').length, 0);
    } finally { dropGates(before); }
  });

  await arm('P6', 'plan_consumed is shown as the fixed sentence and not retried', async () => {
    const ps = need();
    run.clearCatalogCache();
    const w = makeWorld();
    w.state.start = () => ({ status: 'refused', reason: 'plan_consumed', message: MARK_E, fix: MARK_E, label: 'candidate, not verified', room_write: 'not_performed' });
    const before = gateIds();
    const awaiting = await jobs.startCapability(startArgs(), EXTRA, w.deps);
    try {
      const res = await answer(awaiting.gate_id, ['approve_run'], 'approve');
      assert.equal(res.ok, false, JSON.stringify(res).slice(0, 200));
      assert.equal(res.reason, 'plan_consumed');
      assert.equal(res.message, ps.REFUSALS.plan_consumed);
      assert.ok(JSON.stringify(res).indexOf(MARK_E) === -1, 'the engine text shows');
      assert.equal(w.calls('scout_start_pair_screen').length, 1, 'the start was retried');
      assert.equal(jobs.sessions.size, 0, 'a job session was kept after a refusal');
    } finally { dropGates(before); }
  });

  await arm('P7', 'the card holds counts, engines, label, the 30 day record and the delete path, and no planted text', async () => {
    const ps = need();
    run.clearCatalogCache();
    const w = makeWorld();
    const before = gateIds();
    const awaiting = await jobs.startCapability(startArgs(), EXTRA, w.deps);
    try {
      assert.equal(awaiting.ok, true, JSON.stringify(awaiting).slice(0, 200));
      const entry = gateLedger.peekGate(awaiting.gate_id, SESSION);
      const text = allStrings(entry.card, []).join('\n');
      for (const needle of ['3', '2', '1', '4242', 'Find Unusual Pairs Across a Research Collection', 'Rank Unusual Pairs by Wording and Meaning',
        'candidate, not verified', '30 days', 'To forget this run later, ask Larry to forget it.']) {
        assert.ok(text.indexOf(needle) !== -1, 'the card lacks: ' + needle);
      }
      for (const m of MARKERS) assert.ok(text.indexOf(m) === -1, 'the card holds ' + m);
      assert.ok(!/[\u2013\u2014]/.test(text), 'a dash character on the card');
      // the answer carries no planted note text, and the plan warnings are marked as untrusted
      const rest = allStrings(Object.assign({}, awaiting, { plan_warnings: undefined }), []).join('\n');
      for (const m of MARK_T.concat(MARK_X, [MARK_W])) assert.ok(rest.indexOf(m) === -1, 'the answer holds ' + m);
      assert.equal(awaiting.plan_warnings.untrusted, true);
      assert.ok(typeof ps.cardBody === 'function');
    } finally { dropGates(before); }
  });

  cleanup();
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { process.stdout.write('FAIL - P0 ' + String((e && e.stack) || e) + '\n'); cleanup(); process.exit(1); });
