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
    check('N6 the same gate_id answered twice -> unknown_or_expired_gate, no second write',
      again.ok === false && again.reason === 'unknown_or_expired_gate' && first.entries.length === 1 && after.entries.length === 1, JSON.stringify(again));
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
    check('N7 end to end: verdict approve with chosen reject lands nothing',
      neverDoBytes(room) === null && res.chain_result && res.chain_result.ok === false, JSON.stringify(res.chain_result));
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

  // TASK2-MARKER

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
