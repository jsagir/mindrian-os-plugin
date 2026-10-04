#!/usr/bin/env node
'use strict';

/**
 * Phase 369 Plan 33 (SHELL369-12 visibility half, GREC369-05 read surface, REV369-06) -- a gate
 * raised in ANY process leaves a durable gate_raised record in its room, and the read-only
 * gate_list tool lists the open ones and reads any one gate's state.
 * ==========================================================================
 * Why it exists. Claude Code runs the MindrianOS server as its OWN stdio process, so a gate
 * Larry raises there lives in that process's in-memory ledger; the shell talks to a different
 * process, the flag-ON daemon. The one medium both share is the room's room.db. This test runs a
 * real Claude Code shaped stdio process (tests/helpers/cli-gate-369.cjs) and a real daemon
 * (tests/helpers/mcp-daemon-369.cjs) over the same hermetic rooms home.
 *
 * Arms (numbers are the plan's; 10 runs last because it swaps the ledger observers):
 *   1   a stdio CLI session bound to room-x renders a card; a daemon client bound to room-x lists
 *       exactly that gate with the contract (option ids in rank order, recommended, subject,
 *       expires_at = minted_at + 30 min); a client bound to room-y lists none
 *   2   the raw gate_raised row holds no property named like session or ledger and no value equal
 *       to the CLI session id (Canon Part 8, D-16)
 *   3   gate_list with gate_id: open with the contract; a never-minted id reads unknown
 *   4   the CLI answers the gate: it leaves the list, reads answered with verdict, chosen and the
 *       decision node, and no gate_closed row exists for it
 *   5   a chain-shaped mint (roomDir, haltedStep, resumeFn) and a research-shaped mint (only a
 *       sessionId bound to room-x) are both listed; consumeGate on the chain one writes one
 *       gate_closed row and drops it; the research one stays
 *   6   a mint with mintedAt 31 minutes ago is not listed and reads expired
 *   7   an unbound CLI session's gate_render and a kind binding card write no gate_raised row
 *   8   an elicitation gate answered inline leaves a raise row and a close row and is not listed
 *   9   a room holding a memory_event with malformed JSON still answers gate_list and reads a
 *       real gate's state; a bound room whose room.db cannot be opened answers lookup_failed
 *   10  static and in-process: consumeGate and peekGate declare two parameters, gate-ledger.cjs
 *       holds one non-comment `_ledger.delete(`, observers that throw change no mint and no take
 *   11  gate_list lists at most 50 items, oldest first, every string field within its cap
 *
 * Exit 0 all PASS, 1 any FAIL, 77 only when @modelcontextprotocol/client cannot be loaded or the
 * daemon cannot start. Every child it spawns is killed in a finally. Hyphens only. CJS.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

try {
  require('@modelcontextprotocol/client');
} catch (e) {
  console.log('SKIP: @modelcontextprotocol/client cannot be loaded (' + (e && e.message ? e.message : e) + ')');
  process.exit(77);
}

const D = require('./helpers/mcp-daemon-369.cjs');
const { cliClient } = require('./helpers/cli-gate-369.cjs');

let passed = 0;
let failed = 0;
async function arm(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log('  PASS ' + name);
  } catch (err) {
    failed += 1;
    console.log('  FAIL ' + name);
    console.log('    ' + (err && err.message ? err.message : String(err)).split('\n').join('\n    '));
  }
}

// -- reading a tool result ----------------------------------------------------------------
function parseToolJson(result) {
  const text = (result && Array.isArray(result.content) ? result.content : [])
    .map((c) => (c && typeof c.text === 'string' ? c.text : ''))
    .join('');
  const marker = text.indexOf('\n\n## ');
  const body = marker === -1 ? text : text.slice(0, marker);
  try {
    return JSON.parse(body);
  } catch (_e) {
    return { __error: 'unparseable tool body: ' + body.slice(0, 200) };
  }
}

// A daemon client call that never throws: a missing tool comes back as { __error }.
async function dcall(client, name, args) {
  try {
    return parseToolJson(await client.callTool({ name: name, arguments: args || {} }));
  } catch (e) {
    return { __error: String((e && e.message) || e).slice(0, 300) };
  }
}

async function dbind(client, room) {
  const out = await dcall(client, 'room_bind', { room: room });
  assert.equal(out.ok, true, 'room_bind ' + room + ': ' + JSON.stringify(out));
}

// -- raw reads of room.db (tests/ is on the Canon Part 9 allow-list) ------------------------
function withDb(roomDir, fn, writable) {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(path.join(roomDir, '.mindrian', 'room.db'), writable ? {} : { readOnly: true });
  try {
    return fn(db);
  } finally {
    db.close();
  }
}
function eventRows(roomDir, dedupeKey) {
  return withDb(roomDir, (db) => db.prepare(
    "SELECT id, properties FROM nodes WHERE type = 'memory_event' AND json_valid(properties) " +
    "AND json_extract(properties, '$.dedupe_key') = ?"
  ).all(dedupeKey));
}
function labelCount(roomDir, label) {
  return withDb(roomDir, (db) => Number(db.prepare(
    "SELECT COUNT(*) AS c FROM nodes WHERE type = 'memory_event' AND json_valid(properties) " +
    "AND json_extract(properties, '$.label') = ?"
  ).get(label).c));
}
function claimIds(roomDir) {
  return withDb(roomDir, (db) => db.prepare("SELECT id FROM nodes WHERE id LIKE 'claim:%' ORDER BY rowid").all().map((r) => r.id));
}

function walk(value, visit, pathParts) {
  const here = pathParts || [];
  visit(value, here);
  if (Array.isArray(value)) {
    value.forEach((v, i) => walk(v, visit, here.concat(String(i))));
  } else if (value && typeof value === 'object') {
    for (const k of Object.keys(value)) walk(value[k], visit, here.concat(k));
  }
}

const OPTIONS = [
  { id: 'approve', label: 'Approve', rank: 1, description: 'Recommended: ratify.', preview: 'Ratifies the claim.' },
  { id: 'hold', label: 'Hold', rank: 2 },
  { id: 'reject', label: 'Reject', rank: 3 },
];
const CHAIN_TTL_MS = 1800000;

const SEED = [
  { kind: 'claim', text: 'Local-first rooms keep a founder in control of the decision trail.' },
  { kind: 'claim', text: 'A second claim for the gate-raised test.' },
  { kind: 'source', url: 'https://example.org/369/gate-raised-1', retrieved_at: '2026-10-01T00:00:00Z' },
];

function cardFor(gateId, extra) {
  const gateRender = require('../lib/mcp/gate-render.cjs');
  return gateRender.normalizeCard(Object.assign({
    gate_id: gateId,
    header: 'In-process gate ' + gateId,
    kind: 'general',
    options: OPTIONS,
  }, extra || {}));
}

async function main() {
  const clients = [];
  const cleanups = [];
  let h = null;
  let cli = null;
  let cliUnbound = null;
  const savedEnv = {};
  try {
    try {
      h = await D.startDaemon({
        rooms: [
          { slug: 'room-x', variant: 'wide', migrate: true, seed: SEED },
          { slug: 'room-y', variant: 'wide', migrate: true },
          { slug: 'room-bad', variant: 'wide', migrate: true },
        ],
        extraEnv: { MINDRIAN_TEST_MODE: '1' },
      });
    } catch (err) {
      console.log('SKIP: daemon could not start (' + (err && err.message ? err.message : err) + ')');
      process.exit(77);
    }
    cleanups.push(() => D.stopDaemon(h));
    const roomX = h.roomDirs['room-x'];
    const roomY = h.roomDirs['room-y'];
    const roomBad = h.roomDirs['room-bad'];
    const claims = claimIds(roomX);
    assert.ok(claims.length >= 2, 'room-x must hold the seeded claims');
    console.log('rooms: room-x, room-y, room-bad; seeded claims: ' + claims.join(', '));

    const CLI_SESSION = 'cli-gate-369-session-a';
    cli = await cliClient({ roomsHome: h.roomsHome, home: h.env.HOME, sessionId: CLI_SESSION });
    cliUnbound = await cliClient({ roomsHome: h.roomsHome, home: h.env.HOME, sessionId: 'cli-gate-369-unbound' });

    const X = await D.legacyClient(h.port, 'gate-raised-x');
    const Y = await D.legacyClient(h.port, 'gate-raised-y');
    const BAD = await D.legacyClient(h.port, 'gate-raised-bad');
    clients.push(X, Y, BAD);
    await dbind(X.client, 'room-x');
    await dbind(Y.client, 'room-y');
    await dbind(BAD.client, 'room-bad');
    const list = (c, args) => dcall(c.client, 'gate_list', args || {});

    let S = null;
    let sMintedAt = null;

    await arm('1 a gate raised in a Claude Code shaped stdio process is listed by a daemon session bound to the same room', async () => {
      await cli.bind('room-x');
      const out = await cli.call('gate_render', {
        header: 'Ratify the first claim?',
        kind: 'general',
        select_mode: 'single',
        options: OPTIONS,
        subject_node_id: claims[0],
      });
      assert.equal(out.ok, true, 'cli gate_render: ' + JSON.stringify(out));
      S = out.gate_id;
      assert.ok(typeof S === 'string' && S.length > 0, 'gate id');
      const l = await list(X);
      assert.equal(l.ok, true, 'gate_list (room-x): ' + JSON.stringify(l));
      assert.equal(l.gates.length, 1, 'exactly one open gate in room-x: ' + JSON.stringify(l).slice(0, 400));
      const g = l.gates[0];
      assert.equal(g.gate_id, S);
      assert.deepEqual(g.options.map((o) => o.id), ['approve', 'hold', 'reject'], 'option ids in rank order');
      assert.equal(g.recommended, 'approve');
      assert.equal(g.subject_node_id, claims[0]);
      assert.equal(typeof g.minted_at, 'number');
      assert.equal(g.expires_at, g.minted_at + CHAIN_TTL_MS, 'expires_at is minted_at plus 30 minutes');
      sMintedAt = g.minted_at;
      const ly = await list(Y);
      assert.equal(ly.ok, true, 'gate_list (room-y): ' + JSON.stringify(ly));
      assert.equal(ly.gates.length, 0, 'room-y lists none');
    });

    await arm('2 the raw gate_raised row carries no session identity and no ledger key', async () => {
      assert.ok(S, 'arm 1 must have minted a gate');
      const rows = eventRows(roomX, 'gate_raised:' + S);
      assert.equal(rows.length, 1, 'exactly one gate_raised row for the gate, got ' + rows.length);
      const props = JSON.parse(rows[0].properties);
      assert.equal(props.label, 'gate_raised');
      walk(props, (v, p) => {
        const key = p.length > 0 ? p[p.length - 1] : '';
        assert.ok(!/session|ledger/i.test(key), 'property name must not name a session or a ledger: ' + p.join('.'));
        if (typeof v === 'string') {
          assert.ok(v.indexOf(CLI_SESSION) === -1, 'no value may carry the CLI session id: ' + p.join('.'));
        }
      });
    });

    await arm('3 gate_list with a gate_id reads open with the contract; a never-minted id reads unknown', async () => {
      assert.ok(S);
      const open = await list(X, { gate_id: S });
      assert.equal(open.ok, true, JSON.stringify(open));
      assert.equal(open.gate.state, 'open', JSON.stringify(open));
      assert.ok(open.gate.contract && Array.isArray(open.gate.contract.options), 'open state carries the contract');
      assert.equal(open.gate.contract.options.length, 3);
      const unknown = await list(X, { gate_id: 'never-minted-gate-369' });
      assert.equal(unknown.ok, true, JSON.stringify(unknown));
      assert.equal(unknown.gate.state, 'unknown', JSON.stringify(unknown));
    });

    await arm('4 the CLI answers the gate: it leaves the list and reads answered with the recorded answer; no close row', async () => {
      assert.ok(S);
      const ans = await cli.call('gate_answer', { gate_id: S, chosen: ['approve'], verdict: 'approve' });
      assert.equal(ans.ok, true, 'cli gate_answer: ' + JSON.stringify(ans));
      const l = await list(X);
      assert.equal(l.ok, true, JSON.stringify(l));
      assert.ok(!l.gates.some((g) => g.gate_id === S), 'the answered gate is no longer listed');
      const st = await list(X, { gate_id: S });
      assert.equal(st.ok, true, JSON.stringify(st));
      assert.equal(st.gate.state, 'answered', JSON.stringify(st));
      assert.equal(st.gate.answered.verdict, 'approve');
      assert.deepEqual(st.gate.answered.chosen, ['approve']);
      assert.equal(st.gate.answered.decision_node_id, 'decision:gate:' + S);
      assert.equal(eventRows(roomX, 'gate_closed:' + S).length, 0, 'an answered gate writes no gate_closed row');
    });

    // -- in-process setup for arms 5, 6, 8, 10, 11 ------------------------------------------
    for (const k of ['HOME', 'USERPROFILE', 'MINDRIAN_ROOMS_HOME', 'CLAUDE_CODE_SESSION_ID', 'MINDRIAN_BRAIN_URL', 'MINDRIAN_TEST_MODE']) {
      savedEnv[k] = process.env[k];
    }
    process.env.HOME = h.env.HOME;
    process.env.USERPROFILE = h.env.HOME;
    process.env.MINDRIAN_ROOMS_HOME = h.roomsHome;
    process.env.MINDRIAN_BRAIN_URL = 'http://127.0.0.1:9';
    delete process.env.CLAUDE_CODE_SESSION_ID;
    const gateLedger = require('../lib/mcp/gate-ledger.cjs');
    const gateTools = require('../lib/mcp/tools/gate.cjs'); // loading it installs the observers
    const { writeSessionBinding } = require('../lib/core/session-binding.cjs');
    writeSessionBinding('inproc-research', { bound: ['room-x'], primary: 'room-x' });
    writeSessionBinding('inproc-inline', { bound: ['room-x'], primary: 'room-x' });
    writeSessionBinding('inproc-big', { bound: ['room-y'], primary: 'room-y' });

    await arm('5 a chain-shaped mint and a research-shaped mint are both listed; a take without an answer closes one', async () => {
      gateLedger.mintGate('g-chain-369', {
        card: cardFor('g-chain-369', { kind: 'material_step' }),
        sessionId: 'inproc-chain',
        kind: 'material_step',
        roomDir: roomX,
        haltedStep: { framework: 'six-thinking-hats' },
        resumeFn: async () => ({ ok: true }),
        approving: ['approve'],
      });
      gateLedger.mintGate('g-research-369', {
        card: cardFor('g-research-369', { kind: 'material_step' }),
        sessionId: 'inproc-research',
        kind: 'material_step',
        resumeFn: async () => ({ ok: true }),
        approving: ['approve'],
      });
      const l = await list(X);
      assert.equal(l.ok, true, JSON.stringify(l));
      const ids = l.gates.map((g) => g.gate_id);
      assert.ok(ids.includes('g-chain-369'), 'chain-shaped gate listed: ' + ids.join(','));
      assert.ok(ids.includes('g-research-369'), 'research-shaped gate listed: ' + ids.join(','));
      const chain = l.gates.find((g) => g.gate_id === 'g-chain-369');
      assert.equal(chain.resumes, true, 'a step resumes on the chain gate');
      assert.equal(chain.framework, 'six-thinking-hats');
      const taken = gateLedger.consumeGate('g-chain-369', 'inproc-chain');
      assert.ok(taken && taken.ok !== false, 'consumeGate returns the entry');
      assert.equal(eventRows(roomX, 'gate_closed:g-chain-369').length, 1, 'exactly one gate_closed row');
      const l2 = await list(X);
      const ids2 = l2.gates.map((g) => g.gate_id);
      assert.ok(!ids2.includes('g-chain-369'), 'the closed gate left the list');
      assert.ok(ids2.includes('g-research-369'), 'the research gate stays');
      const st = await list(X, { gate_id: 'g-chain-369' });
      assert.equal(st.gate.state, 'closed', JSON.stringify(st));
    });

    await arm('6 a gate minted 31 minutes ago is not listed and reads expired', async () => {
      gateLedger.mintGate('g-old-369', {
        card: cardFor('g-old-369'),
        sessionId: 'inproc-research',
        kind: 'general',
        mintedAt: Date.now() - 31 * 60 * 1000,
      });
      const l = await list(X);
      assert.equal(l.ok, true, JSON.stringify(l));
      assert.ok(!l.gates.some((g) => g.gate_id === 'g-old-369'), 'an expired gate is not listed');
      const st = await list(X, { gate_id: 'g-old-369' });
      assert.equal(st.ok, true, JSON.stringify(st));
      assert.equal(st.gate.state, 'expired', JSON.stringify(st));
    });

    await arm('7 an unbound CLI session and a binding card write no gate_raised row in any room', async () => {
      const before = [roomX, roomY, roomBad].map((r) => labelCount(r, 'gate_raised'));
      const unbound = await cliUnbound.call('gate_render', { header: 'Unbound card', kind: 'general', options: OPTIONS });
      assert.equal(unbound.ok, true, 'unbound gate_render: ' + JSON.stringify(unbound));
      const binding = await cli.call('gate_render', {
        header: 'Which room?',
        kind: 'binding',
        ambiguous: true,
        options: [{ id: 'room-x', label: 'room-x' }, { id: 'room-y', label: 'room-y' }],
      });
      assert.equal(binding.ok, true, 'binding gate_render: ' + JSON.stringify(binding));
      assert.ok(!binding.suppressed, 'the binding card must actually mint: ' + JSON.stringify(binding));
      const after = [roomX, roomY, roomBad].map((r) => labelCount(r, 'gate_raised'));
      assert.deepEqual(after, before, 'no room gained a gate_raised row');
    });

    await arm('8 an elicitation gate answered inline leaves a raise row and a close row and is not listed', async () => {
      const handlers = {};
      const fakeServer = {
        registerTool(name, _cfg, handler) { handlers[name] = handler; },
        server: {
          getClientCapabilities: () => ({ elicitation: {} }),
          getClientVersion: () => ({ name: 'Visual Studio Code', version: '1.0.0' }),
          elicitInput: async () => ({ action: 'accept', content: { choice: 'approve' } }),
        },
      };
      gateTools.register(fakeServer, {});
      assert.equal(typeof handlers.gate_render, 'function', 'gate_render registered on the fake server');
      const res = await handlers.gate_render(
        { gate_id: 'g-inline-369', header: 'Inline?', kind: 'general', options: OPTIONS },
        { sessionId: 'inproc-inline' }
      );
      const body = parseToolJson(res);
      assert.equal(body.ok, true, JSON.stringify(body));
      assert.ok(body.answer, 'the elicitation answered inline: ' + JSON.stringify(body).slice(0, 300));
      assert.equal(eventRows(roomX, 'gate_raised:g-inline-369').length, 1, 'one raise row');
      assert.equal(eventRows(roomX, 'gate_closed:g-inline-369').length, 1, 'one close row');
      const l = await list(X);
      assert.ok(!l.gates.some((g) => g.gate_id === 'g-inline-369'), 'the inline gate is not listed');
    });

    await arm('9 a malformed memory_event row aborts nothing; an unopenable room answers lookup_failed, never unknown', async () => {
      withDb(roomX, (db) => {
        db.prepare(
          "INSERT INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at) " +
          "VALUES (?, 'memory_event', ?, 'test:malformed', 'system', NULL, 'confirmed', ?, ?)"
        ).run('memory_event:malformed:369', '{"label": "gate_raised", broken', Date.now(), Date.now());
      }, true);
      const l = await list(X);
      assert.equal(l.ok, true, 'gate_list over a room with a malformed row: ' + JSON.stringify(l));
      assert.ok(l.gates.some((g) => g.gate_id === 'g-research-369'), 'a real open gate is still listed');
      const st = await list(X, { gate_id: 'g-research-369' });
      assert.equal(st.ok, true, JSON.stringify(st));
      assert.equal(st.gate.state, 'open', JSON.stringify(st));
      // Break room-bad's room.db: not a database at all.
      const dbFile = path.join(roomBad, '.mindrian', 'room.db');
      for (const suffix of ['', '-wal', '-shm']) {
        try { fs.rmSync(dbFile + suffix, { force: true }); } catch (_e) { /* best effort */ }
      }
      fs.writeFileSync(dbFile, 'this is not a sqlite database, on purpose\n'.repeat(40));
      const lb = await list(BAD);
      assert.equal(lb.ok, false, 'a room that cannot be opened is not an empty list: ' + JSON.stringify(lb));
      assert.equal(lb.reason, 'lookup_failed', JSON.stringify(lb));
      const sb = await list(BAD, { gate_id: 'any-gate-369' });
      assert.equal(sb.ok, false, JSON.stringify(sb));
      assert.equal(sb.reason, 'lookup_failed', 'never unknown on a read failure: ' + JSON.stringify(sb));
    });

    await arm('11 gate_list lists at most 50 items, oldest first, every string field within its cap', async () => {
      const long = (n, ch) => (ch || 'x').repeat(n);
      const base = Date.now() - 20 * 60 * 1000;
      for (let i = 0; i < 60; i += 1) {
        const id = 'g-big-369-' + String(i).padStart(2, '0');
        gateLedger.mintGate(id, {
          card: {
            gate_id: id,
            header: long(5000, 'h'),
            kind: 'general',
            ambiguous: false,
            selectMode: 'single',
            options: Array.from({ length: 30 }, (_v, k) => ({
              id: 'o' + k, label: long(2000, 'l'), description: long(3000, 'd'), rank: k + 1, preview: long(5000, 'p'),
            })),
            recommended: 'o0',
            subjectNodeId: long(600, 's'),
            evidenceNodeIds: Array.from({ length: 30 }, (_v, k) => long(600, 'e') + k),
            notice: long(3000, 'n'),
          },
          sessionId: 'inproc-big',
          kind: 'general',
          mintedAt: base + i * 1000,
        });
      }
      const l = await list(Y);
      assert.equal(l.ok, true, JSON.stringify(l).slice(0, 300));
      assert.equal(l.gates.length, 50, 'at most 50 listed, got ' + l.gates.length);
      const times = l.gates.map((g) => g.minted_at);
      assert.deepEqual(times.slice().sort((a, b) => a - b), times, 'oldest first');
      assert.equal(l.gates[0].gate_id, 'g-big-369-00');
      for (const g of l.gates) {
        assert.ok(g.gate_id.length <= 200);
        assert.ok(String(g.header || '').length <= 200, 'header cap');
        assert.ok(g.options.length <= 20, 'option cap');
        for (const o of g.options) {
          assert.ok(String(o.id).length <= 200 && String(o.label).length <= 200, 'option id and label caps');
          assert.ok(String(o.description || '').length <= 500, 'option description cap');
          assert.ok(String(o.preview || '').length <= 1000, 'option preview cap');
        }
        assert.ok(String(g.notice || '').length <= 500, 'notice cap');
        assert.ok(String(g.subject_node_id || '').length <= 200, 'subject id cap');
        assert.ok(g.evidence_node_ids.length <= 20, 'evidence id count cap');
        for (const e of g.evidence_node_ids) assert.ok(e.length <= 200, 'evidence id cap');
      }
    });

    await arm('10 ledger contract: two parameters, one non-comment delete, throwing observers change nothing', async () => {
      assert.equal(gateLedger.consumeGate.length, 2, 'consumeGate declares two parameters');
      assert.equal(gateLedger.peekGate.length, 2, 'peekGate declares two parameters');
      assert.equal(typeof gateLedger.setGateObservers, 'function', 'setGateObservers is exported');
      const src = fs.readFileSync(path.join(REPO_ROOT, 'lib', 'mcp', 'gate-ledger.cjs'), 'utf8');
      const deletes = src.split('\n').filter((line) => !/^\s*\/\//.test(line) && line.indexOf('_ledger.delete(') !== -1);
      assert.equal(deletes.length, 1, 'exactly one non-comment `_ledger.delete(`, got ' + deletes.length);
      assert.ok(gateTools && gateTools.register, 'gate.cjs loaded');

      const shape = (id, sess) => {
        gateLedger.mintGate(id, { card: cardFor(id), sessionId: sess, kind: 'general' });
        const peeked = gateLedger.peekGate(id, sess);
        const stranger = gateLedger.consumeGate(id, 'someone-else');
        const taken = gateLedger.consumeGate(id, sess);
        const again = gateLedger.consumeGate(id, sess);
        return {
          peekedId: peeked && peeked.card && peeked.card.gate_id,
          stranger: stranger,
          takenId: taken && taken.card && taken.card.gate_id,
          again: again,
        };
      };
      gateLedger.setGateObservers(null);
      const plain = shape('g-obs-plain-369', 'obs-session');
      gateLedger.setGateObservers({
        onMint() { throw new Error('observer boom (mint)'); },
        onTake() { throw new Error('observer boom (take)'); },
      });
      const thrown = shape('g-obs-plain-369', 'obs-session');
      gateLedger.setGateObservers(null);
      assert.deepEqual(thrown, plain, 'throwing observers change no mint and no take');
      assert.equal(plain.takenId, 'g-obs-plain-369');
      assert.deepEqual(plain.stranger, { ok: false, reason: 'session_mismatch' });
      assert.equal(plain.again, null, 'a gate is single use');
    });

    console.log('\n' + (failed === 0 ? 'PASS' : 'FAIL') + ': ' + passed + ' passed, ' + failed + ' failed');
  } finally {
    for (const k of Object.keys(savedEnv)) {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k];
    }
    for (const c of clients) {
      try { await c.close(); } catch (_e) { /* best effort */ }
    }
    for (const c of [cli, cliUnbound]) {
      if (c) {
        try { await c.close(); } catch (_e) { /* best effort */ }
      }
    }
    for (const fn of cleanups.reverse()) {
      try { await fn(); } catch (_e) { /* best effort */ }
    }
  }
}

// Dash guard on this file and its helper: hyphens only.
(function dashGuard() {
  const files = [__filename, path.join(__dirname, 'helpers', 'cli-gate-369.cjs')];
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8');
    if (text.indexOf(String.fromCharCode(0x2014)) !== -1 || text.indexOf(String.fromCharCode(0x2013)) !== -1) {
      console.log('FAIL: em-dash or en-dash found in ' + f);
      process.exit(1);
    }
  }
})();

main().then(() => process.exit(failed === 0 ? 0 : 1)).catch((err) => {
  console.log('FAIL: ' + (err && err.stack ? err.stack : err));
  process.exit(1);
});
