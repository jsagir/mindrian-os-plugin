'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 365 Plan 13 -- the "Reject and never do this" follow-up gate (D-10, D-14,
 * D-15, D-26). Task 1 (N1..N8): the proposal gate helper and the approval-trail
 * landing. Task 2 (N9..N13): the offer on a material-step Reject, on surfaced
 * ambient plan-only cards, and on halted_constraint cards rendered as gates.
 *
 * The gate, chain and research tools are registered on one capture server, so a gate
 * minted by lib/mcp/never-do-gate.cjs (or by chain_run, or by research_run) is
 * answered by the REAL gate_answer through the one shared gate ledger. Verdicts are
 * read from .mindrian/never-do.json on disk and from a fresh room.db handle.
 *
 * No em-dash or en-dash literals: those characters are spelled with
 * String.fromCharCode. Exit 0 pass, 1 fail, 77 skip (fixtures absent).
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos365-13-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos365-13-roomshome-'));
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
const { check, summary } = hygiene.makeChecker('365-13 never-do proposal gate');

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

let buildRoom363 = null;
let GAP_TERM_363 = null;
try {
  const fx = require(path.join(__dirname, 'helpers', 'fixture-room-363.cjs'));
  buildRoom363 = fx.buildRoom363;
  GAP_TERM_363 = fx.GAP_TERM_363;
} catch (_e) {
  console.log('SKIP: 363-02 helpers absent');
  process.exit(77);
}

const rc = require(path.join(ROOT, 'lib', 'core', 'room-constraints.cjs'));
const navigation = require(path.join(ROOT, 'lib', 'core', 'navigation.cjs'));
const gateLedger = require(path.join(ROOT, 'lib', 'mcp', 'gate-ledger.cjs'));
const neverDoGate = require(path.join(ROOT, 'lib', 'mcp', 'never-do-gate.cjs'));
const gateModule = require(path.join(ROOT, 'lib', 'mcp', 'tools', 'gate.cjs'));
const chainTool = require(path.join(ROOT, 'lib', 'mcp', 'tools', 'chain.cjs'));
const researchTool = require(path.join(ROOT, 'lib', 'mcp', 'tools', 'research.cjs'));
const AMBIENT = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'ambient.cjs'));
const grants = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'grants.cjs'));
const exec = require(path.join(ROOT, 'lib', 'core', 'chain-executor.cjs'));

const FLOOR = rc.FLOOR_SENTENCE;
const SESSION = 's365-13';
const rooms = [];
function newRoom() {
  const r = buildRoom363({ role: 'researcher' });
  rooms.push(r);
  return r;
}

// -- the capture server (the register seam) -------------------------------------
function makeServer(clientCaps) {
  const captured = new Map();
  return {
    captured: captured,
    registerTool: function (name, config, handler) {
      const cfg = config || {};
      captured.set(name, { title: cfg.title, description: cfg.description, schema: cfg.inputSchema, handler: handler });
    },
    server: { getClientCapabilities: function () { return clientCaps || {}; } },
  };
}

function parse(raw) {
  const text = raw && raw.content && raw.content[0] && raw.content[0].text;
  try { return JSON.parse(text); } catch (_e) { return { _unparsed: String(text).slice(0, 300) }; }
}

function boot(room, opts) {
  const o = opts || {};
  const server = makeServer(o.clientCaps);
  const ctx = { fallbackRoomDir: room.roomDir, pluginRoot: ROOT, surface: o.surface || 'cli' };
  gateModule.register(server, ctx);
  chainTool.register(server, ctx);
  researchTool.register(server, ctx);
  const extra = { sessionId: SESSION };
  function tool(name) {
    const t = server.captured.get(name);
    if (!t) throw new Error(name + ' is not registered');
    return t;
  }
  return {
    server: server,
    ctx: ctx,
    call: async function (name, input) { return parse(await tool(name).handler(input, extra)); },
    answer: async function (gateId, chosen, verdict) {
      return parse(await tool('gate_answer').handler({ gate_id: gateId, chosen: chosen, verdict: verdict }, extra));
    },
  };
}

function withDb(room, fn) {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(path.join(room.roomDir, '.mindrian', 'room.db'));
  try { return fn(db); } finally { db.close(); }
}
function nodeRow(room, id) {
  return withDb(room, function (db) { return db.prepare('SELECT id, review_status FROM nodes WHERE id = ?').get(id) || null; });
}
function neverDoFile(room) { return path.join(room.roomDir, '.mindrian', 'never-do.json'); }
function neverDoBytes(room) { try { return fs.readFileSync(neverDoFile(room), 'utf8'); } catch (_e) { return null; } }
function hasDash(text) { return text.indexOf(EM) !== -1 || text.indexOf(EN) !== -1; }

const PROPOSAL = { kind: 'term', value: 'solid state battery', why: 'Never let an unattended ambient step search for solid state battery.', alternatives: [{ kind: 'section', value: 'market-analysis' }] };

async function main() {
  // ---- N1 the card ------------------------------------------------------------
  {
    const card = neverDoGate.buildProposalCard(PROPOSAL);
    const byId = {};
    card.options.forEach(function (o) { byId[o.id] = o; });
    check('N1 header asks "Reject and never do this?" and names the proposed entry',
      card.header.indexOf('Reject and never do this?') === 0 && card.header.indexOf('solid state battery') !== -1, card.header);
    check('N1 kind general, single select, exactly the three options approve, reject, defer',
      card.kind === 'general' && card.select_mode === 'single'
      && JSON.stringify(card.options.map(function (o) { return o.id; })) === JSON.stringify(['approve', 'reject', 'defer']));
    check('N1 approve is labelled "Reject and never do this" and says it adds one entry and matching steps stop and ask',
      byId.approve.label === 'Reject and never do this'
      && /adds one entry to this room's never-do list/i.test(byId.approve.description)
      && /stop and ask/.test(byId.approve.description), JSON.stringify(byId.approve));
    check('N1 reject is labelled "Just reject this time" (nothing added) and defer "Decide later"',
      byId.reject.label === 'Just reject this time' && /nothing is added/i.test(byId.reject.description)
      && byId.defer.label === 'Decide later');
    check('N1 the notice shows kind, value, why and the whole floor sentence',
      card.notice === 'term: solid state battery. Why: ' + PROPOSAL.why + ' ' + FLOOR, card.notice);
    const long = neverDoGate.buildProposalCard({ kind: 'path', value: 'research/' + 'v'.repeat(180), why: 'w'.repeat(300) });
    check('N1 a long value and why still leave the floor sentence whole inside 400 characters',
      long.notice.length <= 400 && long.notice.endsWith(FLOOR), String(long.notice.length));
    check('N1 the card carries no dash characters', !hasDash(JSON.stringify(card)) && !hasDash(JSON.stringify(long)));
  }

  // ---- N2 mint: renders, mints, validates -----------------------------------------
  {
    const room = newRoom();
    const claude = await neverDoGate.mintProposalGate(PROPOSAL, { roomDir: room.roomDir, sessionId: SESSION, capabilities: { elicitation: false, claudeCode: true } });
    const plain = await neverDoGate.mintProposalGate(PROPOSAL, { roomDir: room.roomDir, sessionId: SESSION, capabilities: { elicitation: false, claudeCode: false } });
    const entry = gateLedger._internal._ledger.get(claude.gate_id);
    check('N2 a Claude host gets rung b (askuserquestion), any other host rung c (text)',
      claude.ok === true && claude.renderer === 'askuserquestion' && plain.ok === true && plain.renderer === 'text',
      claude.renderer + '/' + plain.renderer);
    check('N2 the ledger holds a single-use material_step entry with the card, session, resumeFn and proposal',
      !!entry && entry.kind === 'material_step' && typeof entry.resumeFn === 'function' && entry.sessionId === SESSION
      && !!entry.card && entry.proposal && entry.proposal.value === 'solid state battery');
    check('N2 the return carries gate_id, renderer, rendered and the proposal',
      typeof claude.gate_id === 'string' && !!claude.rendered && claude.proposal.kind === 'term');
    const before = gateLedger._internal._ledger.size;
    const bads = [
      await neverDoGate.mintProposalGate({ kind: 'galaxy', value: 'x', why: 'y' }, { roomDir: room.roomDir, sessionId: SESSION }),
      await neverDoGate.mintProposalGate({ kind: 'term', value: '   ', why: 'y' }, { roomDir: room.roomDir, sessionId: SESSION }),
      await neverDoGate.mintProposalGate(null, { roomDir: room.roomDir, sessionId: SESSION }),
    ];
    check('N2 an invalid proposal (bad kind, empty value, null) returns {ok:false, reason} and mints nothing',
      bads.every(function (b) { return b.ok === false && typeof b.reason === 'string'; })
      && gateLedger._internal._ledger.size === before, JSON.stringify(bads));
  }

  // ---- N3 approve lands the entry with the approval trail ---------------------------
  {
    const room = newRoom();
    const app = boot(room);
    const minted = await neverDoGate.mintProposalGate(PROPOSAL, { roomDir: room.roomDir, sessionId: SESSION, capabilities: { claudeCode: true } });
    check('N3 FIXTURE: nothing is on the list before the click', neverDoBytes(room) === null);
    const res = await app.answer(minted.gate_id, ['approve'], 'approve');
    const nodeId = 'decision:gate:' + minted.gate_id;
    const node = nodeRow(room, nodeId);
    const list = rc.readNeverDo(room.roomDir);
    const stored = list.ok && list.entries[0];
    check('N3 gate_answer wrote and confirmed the decision node decision:gate:<gate_id>',
      !!node && node.review_status === 'confirmed', JSON.stringify(node));
    check('N3 never-do.json has the entry with approved_via {surface:mcp, decision_node_id: that id}',
      list.ok && list.entries.length === 1 && stored.kind === 'term' && stored.value === 'solid state battery'
      && stored.approved_via.surface === 'mcp' && stored.approved_via.decision_node_id === nodeId, JSON.stringify(list));
    check('N3 chain_result is {ok:true, executed:true, never_do_written:{ok:true}}',
      res.ok === true && res.chain_result && res.chain_result.ok === true && res.chain_result.executed === true
      && res.chain_result.never_do_written && res.chain_result.never_do_written.ok === true, JSON.stringify(res.chain_result));
  }

  // ---- N4 reject and defer write nothing -----------------------------------------------
  {
    const room = newRoom();
    const app = boot(room);
    const a = await neverDoGate.mintProposalGate(PROPOSAL, { roomDir: room.roomDir, sessionId: SESSION });
    const b = await neverDoGate.mintProposalGate(PROPOSAL, { roomDir: room.roomDir, sessionId: SESSION });
    const rej = await app.answer(a.gate_id, ['reject'], 'reject');
    const def = await app.answer(b.gate_id, ['defer'], 'defer');
    check('N4 reject -> chain_result {ok:true, executed:false}', rej.ok === true && rej.chain_result.ok === true && rej.chain_result.executed === false, JSON.stringify(rej.chain_result));
    check('N4 defer -> chain_result {ok:true, executed:false}', def.ok === true && def.chain_result.ok === true && def.chain_result.executed === false, JSON.stringify(def.chain_result));
    check('N4 never-do.json is still absent', neverDoBytes(room) === null);
    // an existing list stays byte-identical
    const room2 = newRoom();
    const app2 = boot(room2);
    fs.mkdirSync(path.join(room2.roomDir, '.mindrian'), { recursive: true });
    const seed = JSON.stringify({ schema: rc.SCHEMA, entries: [] }, null, 2) + '\n';
    fs.writeFileSync(neverDoFile(room2), seed, 'utf8');
    const c = await neverDoGate.mintProposalGate(PROPOSAL, { roomDir: room2.roomDir, sessionId: SESSION });
    await app2.answer(c.gate_id, ['reject'], 'reject');
    check('N4 an existing list is byte-unchanged after a reject', neverDoBytes(room2) === seed);
  }

  // ---- N5 malformed existing file ---------------------------------------------------
  {
    const room = newRoom();
    const app = boot(room);
    fs.mkdirSync(path.join(room.roomDir, '.mindrian'), { recursive: true });
    fs.writeFileSync(neverDoFile(room), '{ not json', 'utf8');
    const m = await neverDoGate.mintProposalGate(PROPOSAL, { roomDir: room.roomDir, sessionId: SESSION });
    const res = await app.answer(m.gate_id, ['approve'], 'approve');
    check('N5 approve over a malformed list -> chain_result ok false with existing_file_malformed',
      res.chain_result && res.chain_result.ok === false && res.chain_result.never_do_written
      && res.chain_result.never_do_written.reason === 'existing_file_malformed', JSON.stringify(res.chain_result));
    check('N5 the file bytes are unchanged', neverDoBytes(room) === '{ not json');
  }

  // ---- N6 replay -----------------------------------------------------------------------
  {
    const room = newRoom();
    const app = boot(room);
    const m = await neverDoGate.mintProposalGate(PROPOSAL, { roomDir: room.roomDir, sessionId: SESSION });
    await app.answer(m.gate_id, ['approve'], 'approve');
    const first = rc.readNeverDo(room.roomDir);
    const again = await app.answer(m.gate_id, ['approve'], 'approve');
    const after = rc.readNeverDo(room.roomDir);
    // Phase 369 plan 26: a second answer replays the saved one (replayed:true) instead of refusing; no second write.
    check('N6 the same gate_id answered twice -> replayed, no second write',
      again.ok === true && again.replayed === true && first.entries.length === 1 && after.entries.length === 1, JSON.stringify(again));
    // another session cannot consume it either
    const m2 = await neverDoGate.mintProposalGate(PROPOSAL, { roomDir: room.roomDir, sessionId: SESSION });
    const other = parse(await app.server.captured.get('gate_answer').handler({ gate_id: m2.gate_id, chosen: ['approve'], verdict: 'approve' }, { sessionId: 'someone-else' }));
    check('N6 a different session cannot answer it', other.ok === false, JSON.stringify(other));
  }

  // ---- N7 resumeFn without gate_answer: no decision node, no write ------------------------
  {
    const room = newRoom();
    boot(room);
    const m = await neverDoGate.mintProposalGate(PROPOSAL, { roomDir: room.roomDir, sessionId: SESSION });
    const live = gateLedger._internal._ledger.get(m.gate_id);
    const direct = await live.resumeFn({ gate_id: m.gate_id, chosen: ['approve'], verdict: 'approve' });
    check('N7 calling the resumeFn with no decision node on record refuses decision_node_missing and writes nothing',
      direct.ok === false && direct.reason === 'decision_node_missing' && neverDoBytes(room) === null, JSON.stringify(direct));
    const wrongChosen = await live.resumeFn({ gate_id: m.gate_id, chosen: ['reject'], verdict: 'approve' });
    check('N7 an approve verdict that names a non-approving option refuses chosen_not_approving',
      wrongChosen.ok === false && wrongChosen.reason === 'chosen_not_approving' && neverDoBytes(room) === null, JSON.stringify(wrongChosen));
    // a gate_answer approve that names the reject option is stopped the same way, end to end
    const m2 = await neverDoGate.mintProposalGate(PROPOSAL, { roomDir: room.roomDir, sessionId: SESSION });
    const res = await boot(room).answer(m2.gate_id, ['reject'], 'approve');
    // Phase 289 review CR-01: the mismatch is now refused BEFORE the consume (reason
    // chosen_not_approving at the top level, nothing resumed), so the gate survives.
    check('N7 end to end: verdict approve with chosen reject lands nothing',
      neverDoBytes(room) === null && res.ok === false && res.reason === 'chosen_not_approving'
      && !res.chain_result && gateLedger.peekGate(m2.gate_id, SESSION) !== null, JSON.stringify(res));
  }

  // ---- N8 elicitation never answers a proposal card inline ----------------------------------
  {
    const room = newRoom();
    let elicitCalls = 0;
    const m = await neverDoGate.mintProposalGate(PROPOSAL, {
      roomDir: room.roomDir,
      sessionId: SESSION,
      capabilities: { elicitation: true, claudeCode: false },
      surface: 'cli',
      elicitInput: function () { elicitCalls += 1; return Promise.resolve({ action: 'accept', content: { choice: 'approve' } }); },
    });
    const m2 = await neverDoGate.mintProposalGate(PROPOSAL, {
      roomDir: room.roomDir, sessionId: SESSION, capabilities: { elicitation: true, claudeCode: false },
    });
    check('N8 an elicitation-capable Claude host still gets rung b and the inline answer is never asked for',
      m.ok === true && m.renderer === 'askuserquestion' && elicitCalls === 0, m.renderer + ' calls=' + elicitCalls);
    check('N8 an elicitation-capable unknown host gets rung c (text)', m2.ok === true && m2.renderer === 'text', m2.renderer);
    check('N8 the gate is still waiting in the ledger for gate_answer (nothing consumed it inline)',
      gateLedger._internal._ledger.has(m.gate_id) && neverDoBytes(room) === null);
  }

  // =================== Task 2: reject, ambient plan-only and halted_constraint ====================
  const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'command-registry.json'), 'utf8'));
  const safeCmds = registry.commands.filter(function (c) { return c && c.autonomous_safe === true && typeof c.command === 'string'; })
    .map(function (c) { return c.command; });
  const materialCmd = registry.commands.filter(function (c) { return c && c.autonomous_safe !== true && typeof c.command === 'string'; })
    .map(function (c) { return c.command; }).find(function (c) { return !exec.isIrreversibleStep({ command: c }); });
  function mkSteps(cmds) {
    return cmds.map(function (c, i) { return { step: i + 1, framework: 'fixture-' + (i + 1), command: c, optional: false }; });
  }
  async function stubOnStep() { return { chain_output: { ran: true }, quality: 'high' }; }
  function chainOpts(room, extra) {
    return Object.assign({
      roomDir: room.roomDir, sessionId: SESSION, onStep: stubOnStep, targetSection: 'market-analysis',
      gateRenderCtx: { capabilities: { elicitation: false, claudeCode: true } },
    }, extra || {});
  }
  function putList(room, entries, raw) {
    fs.mkdirSync(path.join(room.roomDir, '.mindrian'), { recursive: true });
    const full = (entries || []).map(function (e) {
      return { kind: e.kind, value: e.value, why: e.why || 'The navigator ruled this out of unattended work.', approved_via: { surface: 'cli', decision_node_id: 'd-365-13-seed' }, approved_at: '2026-10-01T09:00:00.000Z' };
    });
    fs.writeFileSync(neverDoFile(room), raw !== undefined ? raw : JSON.stringify({ schema: rc.SCHEMA, entries: full }, null, 2), 'utf8');
  }

  // ---- N9 a Reject on an ordinary material step grows the list ----------------------------
  {
    const room = newRoom();
    const app = boot(room);
    const steps = mkSteps([materialCmd]);
    const run = await chainTool.chainRun(steps, chainOpts(room));
    check('N9 FIXTURE: the chain halts at the material step as an ordinary gate_halt', run.halted === true && run.halted_at.reason === 'gate_halt', JSON.stringify(run.halted_at && run.halted_at.reason));
    const want = rc.proposalFromFields(rc.declaredFieldsOfChainStep(steps[0], { targetSection: 'market-analysis' }), { surface: 'chain_run' });
    const rej = await app.answer(run.gate.gate_id, ['reject'], 'reject');
    const cr = rej.chain_result || {};
    const ndg = cr.never_do_gate;
    check('N9 reject returns never_do_gate {gate_id, renderer, rendered, proposal, next_step} in chain_result',
      cr.ok === true && cr.executed === false && !!ndg && typeof ndg.gate_id === 'string' && typeof ndg.renderer === 'string'
      && !!ndg.rendered && !!ndg.proposal && typeof ndg.next_step === 'string' && ndg.next_step.indexOf(FLOOR) !== -1, JSON.stringify(cr).slice(0, 300));
    check('N9 the proposal kind and value come from the halted step declared fields',
      !!want && !!ndg && ndg.proposal.kind === want.kind && ndg.proposal.value === want.value, JSON.stringify(ndg && ndg.proposal));
    check('N9 nothing is written until the follow-up is approved', neverDoBytes(room) === null);
    const ok = await app.answer(ndg.gate_id, ['approve'], 'approve');
    const list = rc.readNeverDo(room.roomDir);
    check('N9 approving the follow-up writes the entry with an mcp approval trail',
      ok.ok === true && list.ok && list.entries.length === 1 && list.entries[0].value === want.value
      && list.entries[0].approved_via.surface === 'mcp' && list.entries[0].approved_via.decision_node_id === 'decision:gate:' + ndg.gate_id
      && !!nodeRow(room, 'decision:gate:' + ndg.gate_id), JSON.stringify(list));
    const again = await chainTool.chainRun(mkSteps([materialCmd]), chainOpts(room));
    check('N9 the next unattended run of that step halts as constraint_named (the list grew from what tripped)',
      again.halted === true && again.halted_at.reason === 'constraint_named' && again.halted_at.constraint.value === want.value, JSON.stringify(again.halted_at && again.halted_at.reason));

    // defer carries no offer
    const room2 = newRoom();
    const app2 = boot(room2);
    const run2 = await chainTool.chainRun(mkSteps([materialCmd]), chainOpts(room2));
    const def = await app2.answer(run2.gate.gate_id, ['defer'], 'defer');
    check('N9 defer carries no never_do_gate', def.chain_result && def.chain_result.never_do_gate === undefined && neverDoBytes(room2) === null);
    // the direct chain_run resume path offers it the same way
    const room3 = newRoom();
    const run3 = await chainTool.chainRun(mkSteps([materialCmd]), chainOpts(room3));
    const direct = await chainTool.chainRun(null, { sessionId: SESSION, gateAnswer: { gate_id: run3.gate.gate_id, chosen: ['reject'], verdict: 'reject' } });
    check('N9 the direct chain_run gate_answer path offers the same follow-up', !!direct.never_do_gate && typeof direct.never_do_gate.gate_id === 'string', JSON.stringify(direct).slice(0, 200));
  }

  // ---- N10 a constraint halt carries no follow-up -------------------------------------------
  {
    const room = newRoom();
    const app = boot(room);
    putList(room, [{ kind: 'command', value: safeCmds[0] }]);
    const run = await chainTool.chainRun(mkSteps([safeCmds[0]]), chainOpts(room, { postureFn: function () { return { autonomous_safe: true, posture: 'run' }; } }));
    check('N10 FIXTURE: the list halts the chain as constraint_named', run.halted === true && run.halted_at.reason === 'constraint_named');
    const rej = await app.answer(run.gate.gate_id, ['reject'], 'reject');
    check('N10 a reject on a constraint_named card carries no never_do_gate', rej.chain_result && rej.chain_result.ok === true && rej.chain_result.never_do_gate === undefined, JSON.stringify(rej.chain_result));
    const room2 = newRoom();
    const app2 = boot(room2);
    putList(room2, null, '{ broken');
    const run2 = await chainTool.chainRun(mkSteps([safeCmds[0]]), chainOpts(room2));
    const rej2 = await app2.answer(run2.gate.gate_id, ['reject'], 'reject');
    check('N10 a reject on a constraints_malformed card carries no never_do_gate', run2.halted_at.reason === 'constraints_malformed' && rej2.chain_result.never_do_gate === undefined);
  }

  // ---- ambient fixtures (the 365-10 runner) -------------------------------------------------
  const NOW = Date.parse('2026-09-30T10:00:00Z');
  function fetchingRoom() {
    const r = newRoom();
    const proposal = grants.buildStandingProposal(r.roomDir, { terms: [{ term: GAP_TERM_363, synonyms: [] }] });
    const w = grants.writeGrant(r.roomDir, proposal, { approved_via: { surface: 'cli', decision_node_id: 'd-365-13-grant' } });
    if (!w.ok) throw new Error('grant failed: ' + JSON.stringify(w));
    return r;
  }
  function compWithWhitespace() {
    return { producers: { whitespace: { outcome: 'no_candidate', posture: 'run' } }, tier_counts: { strong: 0, indirect: 0, unverified: 0 }, card: null, surfaced_via: 'none' };
  }
  let fetchCalls = 0;
  async function ambient(room) {
    return AMBIENT.maybeQuick(room.roomDir, compWithWhitespace(), {
      budgetMs: 4 * 60 * 1000, now: NOW, deltaHash: 'a'.repeat(64),
      deps: { fetchEnvelopeFn: async function () { fetchCalls += 1; throw new Error('no fetch in this test'); } },
    });
  }
  async function haltedRoom(entries, raw) {
    const room = fetchingRoom();
    putList(room, entries, raw);
    const out = await ambient(room);
    return { room: room, out: out };
  }

  // ---- N11 surfaced ambient plan-only cards carry the follow-up -------------------------------
  {
    const room = newRoom();
    const app = boot(room);
    const out = await ambient(room);
    check('N11 FIXTURE: an ambient plan-only card is pending', out.outcome === 'plan_card_no_grant');
    const pend = await app.call('research_run', { op: 'pending' });
    const card = (pend.cards || [])[0];
    const ndg = card && card.never_do_gate;
    check('N11 the pending entry carries never_do_gate with the card proposal (term, the zone term)',
      !!card && card.kind === 'plan_card_no_grant' && !!ndg && ndg.proposal.kind === 'term' && ndg.proposal.value === GAP_TERM_363
      && typeof ndg.gate_id === 'string' && !!ndg.rendered && typeof ndg.next_step === 'string', JSON.stringify(card && Object.keys(card)));
    check('N11 the card itself is unchanged (payload still has the proposal) and nothing is written yet',
      card.card.payload.never_do_proposal.value === GAP_TERM_363 && neverDoBytes(room) === null);
    const ok = await app.answer(ndg.gate_id, ['approve'], 'approve');
    const list = rc.readNeverDo(room.roomDir);
    check('N11 approving it writes the entry', ok.ok === true && list.ok && list.entries.length === 1 && list.entries[0].kind === 'term'
      && list.entries[0].value === GAP_TERM_363 && list.entries[0].approved_via.surface === 'mcp', JSON.stringify(list));

    // ride-along on another op, exactly once
    const room2 = newRoom();
    const app2 = boot(room2);
    await ambient(room2);
    const status = await app2.call('research_run', { op: 'grant_status' });
    const ride = (status.pending_cards || [])[0];
    check('N11 the same card riding along on another op gets the same treatment',
      !!ride && ride.kind === 'plan_card_no_grant' && !!ride.never_do_gate && ride.never_do_gate.proposal.value === GAP_TERM_363, JSON.stringify(status.pending_cards));
    const status2 = await app2.call('research_run', { op: 'grant_status' });
    check('N11 and exactly once: the next op carries no card and mints no second gate', Array.isArray(status2.pending_cards) && status2.pending_cards.length === 0);
  }

  // ---- N13 halted_constraint cards rendered as gates (D-26) -------------------------------------
  {
    // (a) approve: the attended run_quick next step
    const a = await haltedRoom([{ kind: 'command', value: '/mos:whitespace' }]);
    const appA = boot(a.room);
    check('N13 FIXTURE: the room-started run halts before any request', a.out.outcome === 'halted_constraint' && fetchCalls === 0);
    const pendA = await appA.call('research_run', { op: 'pending' });
    const cardA = (pendA.cards || [])[0];
    const gateA = cardA && cardA.gate;
    const bodyA = JSON.stringify(gateA && gateA.rendered);
    const headerA = cardA && cardA.card && cardA.card.header;
    const live = gateA && gateLedger._internal._ledger.get(gateA.gate_id);
    check('N13 the entry carries gate {gate_id, renderer, rendered} minted as a single-use material_step gate',
      !!cardA && cardA.kind === 'halted_constraint' && !!gateA && typeof gateA.gate_id === 'string' && typeof gateA.renderer === 'string'
      && !!live && live.kind === 'material_step' && typeof live.resumeFn === 'function' && live.sessionId === SESSION, JSON.stringify(cardA && Object.keys(cardA)));
    check('N13 the rendered gate holds the header, the notice and exactly the three options',
      !!gateA && gateA.rendered.zones.header === headerA && bodyA.indexOf(FLOOR) !== -1
      && JSON.stringify(gateA.rendered.contract.superset_options.map(function (o) { return o.id; })) === JSON.stringify(['approve', 'reject', 'defer'])
      && gateA.rendered.contract.options.length === 3, bodyA.slice(0, 300));
    const resA = await appA.answer(gateA.gate_id, ['approve'], 'approve');
    const crA = resA.chain_result || {};
    check('N13 approve answers with the attended run_quick next step for that run_id',
      resA.ok === true && crA.ok === true && crA.executed === false && /research_run with op run_quick/.test(crA.next_step)
      && crA.next_step.indexOf(a.out.run_id) !== -1 && neverDoBytes(a.room) !== null && rc.readNeverDo(a.room.roomDir).entries.length === 1, JSON.stringify(crA));
    const replay = await appA.answer(gateA.gate_id, ['approve'], 'approve');
    check('N13 a replay answers replayed and re-runs nothing (Phase 369 plan 26)',
      replay.ok === true && replay.replayed === true && replay.chain_result === undefined && rc.readNeverDo(a.room.roomDir).entries.length === 1);

    // (b) reject: the Reject and never do this follow-up from the card's own proposal
    const b = await haltedRoom([{ kind: 'command', value: '/mos:whitespace' }]);
    const appB = boot(b.room);
    const cardB = ((await appB.call('research_run', { op: 'pending' })).cards || [])[0];
    const resB = await appB.answer(cardB.gate.gate_id, ['reject'], 'reject');
    const ndgB = resB.chain_result && resB.chain_result.never_do_gate;
    check('N13 reject mints the follow-up from the card never_do_proposal (term, the zone term)',
      !!ndgB && ndgB.proposal.kind === 'term' && ndgB.proposal.value === GAP_TERM_363 && typeof ndgB.gate_id === 'string', JSON.stringify(resB.chain_result));
    const okB = await appB.answer(ndgB.gate_id, ['approve'], 'approve');
    const listB = rc.readNeverDo(b.room.roomDir);
    check('N13 approving the follow-up adds the entry beside the one that caused the halt',
      okB.ok === true && listB.ok && listB.entries.length === 2 && listB.entries.some(function (e) { return e.kind === 'term' && e.value === GAP_TERM_363 && e.approved_via.surface === 'mcp'; }), JSON.stringify(listB));

    // (c) defer leaves it
    const c = await haltedRoom([{ kind: 'command', value: '/mos:whitespace' }]);
    const appC = boot(c.room);
    const cardC = ((await appC.call('research_run', { op: 'pending' })).cards || [])[0];
    const resC = await appC.answer(cardC.gate.gate_id, ['defer'], 'defer');
    check('N13 defer -> {ok:true, executed:false} and no follow-up', resC.chain_result.ok === true && resC.chain_result.executed === false && resC.chain_result.never_do_gate === undefined);

    // (d) omission 1: the halt was caused by the very entry the proposal names
    const d = await haltedRoom([{ kind: 'term', value: GAP_TERM_363 }]);
    const appD = boot(d.room);
    const cardD = ((await appD.call('research_run', { op: 'pending' })).cards || [])[0];
    check('N13 FIXTURE: the card still carries a proposal naming the listed term', !!cardD.card.payload.never_do_proposal && cardD.card.payload.never_do_proposal.value === GAP_TERM_363);
    const resD = await appD.answer(cardD.gate.gate_id, ['reject'], 'reject');
    check('N13 omitted: a halt caused by an existing entry never offers to add it again',
      resD.chain_result.ok === true && resD.chain_result.never_do_gate === undefined);

    // (e) omission 2: a malformed list has nothing sensible to propose
    const e = await haltedRoom(null, '{ broken');
    const appE = boot(e.room);
    const cardE = ((await appE.call('research_run', { op: 'pending' })).cards || [])[0];
    const resE = await appE.answer(cardE.gate.gate_id, ['reject'], 'reject');
    check('N13 omitted: a constraints_malformed halt offers no follow-up and the file is untouched',
      e.out.reason === 'constraints_malformed' && resE.chain_result.ok === true && resE.chain_result.never_do_gate === undefined && neverDoBytes(e.room) === '{ broken');

    // (f) omission 3: a card whose payload carries no proposal
    const f = await haltedRoom([{ kind: 'command', value: '/mos:whitespace' }]);
    const rawCard = JSON.parse(fs.readFileSync(path.join(f.room.roomDir, '.mindrian', 'research-runs', f.out.run_id, 'card.json'), 'utf8'));
    delete rawCard.payload.never_do_proposal;
    const mintedF = await neverDoGate.mintHaltedConstraintGate(rawCard, { roomDir: f.room.roomDir, sessionId: SESSION, capabilities: {} });
    const resF = await boot(f.room).answer(mintedF.gate_id, ['reject'], 'reject');
    check('N13 omitted: no proposal in the payload means no follow-up', mintedF.ok === true && resF.chain_result.ok === true && resF.chain_result.never_do_gate === undefined);
    check('N13 a non-halted card is refused by the helper', (await neverDoGate.mintHaltedConstraintGate({ header: 'x', payload: {} }, { roomDir: f.room.roomDir })).ok === false);
  }

  // ---- N12 parity: gate, chain and research registrations equal PLAN_BASE -------------------------
  {
    const Module = require('node:module');
    const PLAN_BASE = 'ab5e1d16b1a6e6622a8e98db92263649f5487749';
    // 366-12 (D-07) deliberately changed research_run (the perspective op set, its enum and its
    // description), so its parity pin moves to the commit that landed that change; gate and chain
    // stay pinned to PLAN_BASE. Any later edit to research_run's registration must re-pin this.
    // quick 261002-cud re-pinned it for the offline field and the offline and canon-release description sentences.
    // Re-pinned 2026-10-05 (369.2-10, once, after its last research.cjs commit): research_run's description now names the
    // approval by its job and no longer says "grant" (navigator ruling 2026-10-05, 369.2-CONTEXT ruling_2026_10_05_grant_name).
    // Its input schema is byte-identical to the previous pin; only the description moved. Any later edit to research_run's
    // registration must re-pin this.
    const RESEARCH_BASE = '55a1e4f665afe5d14e6484d5ff7c55c8e6cf9298';
    // Re-pinned 2026-10-04 (Phase 369 plan 26): gate_answer's recovery contract (durable consumption after the
    // withRoomTx commit, replayed, room_switched, stale_subject, gate_expired, unknown_gate, persistence_failed) is
    // in gate.cjs at b2f03de02, the last gate.cjs commit of that plan. Its description was rewritten within the
    // 2048-byte floor to say so honestly, so the gate_answer description and title pin moves to this sha (the
    // research_run precedent above); gate_render, chain_run and every input schema stay pinned to PLAN_BASE below.
    // The byte-identity pin of gate.cjs itself (N12, further down) moves to the same sha. Any later edit to gate.cjs
    // must re-pin GATE_BASE.
    // Re-pinned 2026-10-04 (Phase 369 plan 41, once, after the LAST gate.cjs commit of the gap closure): GATE_BASE is
    // now cd27faa94 (plan 369-38, gate hardening WR-01 to WR-06). Between plan 26 and here gate.cjs changed for plan
    // 369-33 (gate_list registered; the gate_render description made honest about recording the card in the room),
    // plan 369-36 (the gate_render mirror_of input and the mirror description; the gate_answer description for
    // answered_elsewhere) and plan 369-38 (the gate_render approving input; gate_id_in_use, gate_id_answered,
    // too_many_open_gates, bad_approving, replay_lookup_failed in the descriptions). So the gate_render description,
    // title and input schema and the gate_answer description and title pins move to this sha; the gate_answer input
    // schema, chain_run and research_run stay on their bases.
    // Re-pinned 2026-10-04 (quick 261004-av2, once, after its last gate.cjs commit): gate.cjs gained the answered_via marker
    // (CR-02 option 2, SEED-114); the gate_render and gate_answer descriptions, titles and input schemas are byte-identical
    // to cd27faa94, so only the byte-identity pin moves.
    // Re-pinned 2026-10-05 (quick 261005-mux, once, after its last gate.cjs commit): gate.cjs gained the card_pending
    // refusal (a relayed gate_answer on an open elicitation-rendered gate) and its mint stores the renderer; the
    // gate_render and gate_answer descriptions, titles and input schemas are byte-identical to ea60b398b, so only the
    // byte-identity pin moves.
    // Re-pinned 2026-10-06 (369.25 plan 13, once, after its last gate.cjs commit): gate.cjs gained the room-recovery
    // card's answer path (_answerRecoveryGate) and the gate-raised observer skip for a recovery gate; the gate_render
    // and gate_answer descriptions, titles and input schemas are byte-identical to 80ef6a9d5, so only the
    // byte-identity pin moves.
    const GATE_BASE = '0d0a879d845c292141da2bcfd2acaa709c6cf52b';
    const probe = spawnSync('git', ['cat-file', '-e', PLAN_BASE + ':lib/mcp/tools/chain.cjs'], { cwd: ROOT });
    if (probe.status !== 0) {
      console.log('SKIP: N12 PLAN_BASE object not available (shallow clone)');
    } else {
      const loadBase = function (rel, refOverride) {
        const file = path.join(ROOT, rel);
        const baseRef = refOverride || (rel === 'lib/mcp/tools/research.cjs' ? RESEARCH_BASE : PLAN_BASE);
        const src = spawnSync('git', ['show', baseRef + ':' + rel.split(path.sep).join('/')], { cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).stdout;
        const m = new Module(file, module);
        m.filename = file;
        m.paths = Module._nodeModulePaths(path.dirname(file));
        m._compile(src, file);
        return m.exports;
      };
      const shape = function (z) {
        if (!z || !z._def) return String(z);
        const d = z._def;
        const o = { t: d.typeName, desc: z.description || null };
        if (d.typeName === 'ZodObject') {
          const sh = typeof d.shape === 'function' ? d.shape() : d.shape;
          o.f = Object.keys(sh).sort().map(function (k) { return [k, shape(sh[k])]; });
        } else if (d.typeName === 'ZodArray') {
          o.el = shape(d.type);
        } else if (d.typeName === 'ZodOptional') {
          o.inner = shape(d.innerType);
        } else if (d.typeName === 'ZodEnum') {
          o.v = d.values;
        } else if (d.typeName === 'ZodString' || d.typeName === 'ZodNumber') {
          o.checks = d.checks;
        } else if (d.typeName === 'ZodUnion') {
          o.u = d.options.map(shape);
        } else if (d.typeName === 'ZodRecord') {
          o.k = shape(d.keyType);
          o.v = shape(d.valueType);
        }
        return o;
      };
      const capture = function (mod) {
        const got = {};
        mod.register({ registerTool: function (name, opts) { got[name] = opts; }, server: {} }, {});
        return got;
      };
      [['lib/mcp/tools/gate.cjs', gateModule, ['gate_render', 'gate_answer']],
        ['lib/mcp/tools/chain.cjs', chainTool, ['chain_run']],
        ['lib/mcp/tools/research.cjs', researchTool, ['research_run']]].forEach(function (row) {
        const base = capture(loadBase(row[0]));
        const gateBase = row[0] === 'lib/mcp/tools/gate.cjs' ? capture(loadBase(row[0], GATE_BASE)) : null;
        const now = capture(row[1]);
        row[2].forEach(function (name) {
          check('N12 ' + name + ' is registered on both', !!base[name] && !!now[name]);
          // 369-41: both gate tools' description and title, and gate_render's input schema, pin to GATE_BASE.
          const descBase = gateBase || base;
          const schemaBase = (name === 'gate_render' && gateBase) ? gateBase : base;
          check('N12 ' + name + ' description and title are byte-identical to ' + (descBase === gateBase ? 'GATE_BASE (plan 369-41)' : 'PLAN_BASE'),
            descBase[name].description === now[name].description && descBase[name].title === now[name].title);
          check('N12 ' + name + ' input schema (fields, requiredness, descriptions) is identical to ' + (schemaBase === gateBase ? 'GATE_BASE (plan 369-41)' : 'PLAN_BASE'),
            JSON.stringify(shape(schemaBase[name].inputSchema)) === JSON.stringify(shape(now[name].inputSchema)));
        });
      });
      // debug desktop-session-binding-fallback (96804284d) deliberately changed gate.cjs's
      // gate_answer write path (resolveMcpWriteRoom + the binding-card carve-out). Its
      // registration (description, title, input schema) is unchanged and still pinned to
      // PLAN_BASE above; only the byte-identity pin moves to that commit. Any later edit
      // to gate.cjs must re-pin GATE_BASE.
      // Re-pinned 2026-10-04 (Phase 289 plans 05 and 07): gate_answer peek-refuse-consume
      // (eee25f512) and the capability delegation (40116b9a1) changed gate.cjs bodies only; the
      // registration (description, title, input schema) is unchanged and still pinned to PLAN_BASE.
      // Re-pinned 2026-10-04 (Phase 289 code review fixes, iteration 1): CR-01 verdict/chosen coherence
      // check, WR-02 residual comment and WR-05 recommended option field (797eacda0) changed gate.cjs; the
      // gate_answer and gate_render descriptions and titles are unchanged and the input schema grows only
      // the optional boolean recommended on an option, still pinned to PLAN_BASE above.
      // Re-pinned 2026-10-04 (Phase 369 plan 26, once, after its last gate.cjs commit): GATE_BASE (defined above)
      // was b2f03de02, the commit that carries the durable-consumption and recovery changes to gate_answer.
      // Re-pinned 2026-10-04 (Phase 369 plan 41, once, after plans 33, 36 and 38): GATE_BASE is now cd27faa94, the last
      // gate.cjs commit of the gap closure; see the dated comment on GATE_BASE above for what moved.
      // Re-pinned 2026-10-04 (quick 261004-av2, once, after its last gate.cjs commit): GATE_BASE is now ea60b398b, the commit that
      // added the answered_via marker; see the dated comment on GATE_BASE above.
      // Re-pinned 2026-10-05 (quick 261005-mux, once, after its last gate.cjs commit): GATE_BASE is now 80ef6a9d5, the commit that
      // added card_pending and the stored renderer; see the dated comment on GATE_BASE above.
      // Re-pinned 2026-10-06 (369.25 plan 13, once, after its last gate.cjs commit): GATE_BASE is now 0d0a879d8, the commit that
      // added the room-recovery card's answer path; see the dated comment on GATE_BASE above.
      check('N12 lib/mcp/tools/gate.cjs is byte-identical to GATE_BASE',
        spawnSync('git', ['diff', '--quiet', GATE_BASE, '--', 'lib/mcp/tools/gate.cjs'], { cwd: ROOT }).status === 0);
    }
  }

  check('Part 8: the helper has no network token in its code lines',
    hygiene.nonCommentLines(path.join(ROOT, 'lib', 'mcp', 'never-do-gate.cjs')).every(function (l) { return !/brain-client|brain_query|pws-brain|fetch\(|https?:\/\/|node:https?|curl |wget /.test(l); }));

  check('net guard: zero real fetch attempts', guard.attempts() === 0, 'attempts=' + guard.attempts());
  {
    const files = [
      path.join(ROOT, 'lib', 'mcp', 'never-do-gate.cjs'),
      path.join(ROOT, 'lib', 'mcp', 'tools', 'chain.cjs'),
      path.join(ROOT, 'lib', 'mcp', 'tools', 'research.cjs'),
      __filename,
    ];
    const dirty = files.filter(function (f) { return hasDash(fs.readFileSync(f, 'utf8')); });
    check('dash guard: no em-dash or en-dash in the touched files', dirty.length === 0, dirty.join(','));
  }
}

main().then(function () {
  rooms.forEach(function (r) { try { r.cleanup(); } catch (_e) { /* ignore */ } });
  try { fs.rmSync(TMP_HOME, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
  process.exit(summary());
}).catch(function (e) {
  console.log('FAIL: test crashed: ' + ((e && e.stack) || e));
  rooms.forEach(function (r) { try { r.cleanup(); } catch (_e) { /* ignore */ } });
  process.exit(1);
});
