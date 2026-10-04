#!/usr/bin/env node
'use strict';

/**
 * Phase 369 Plan 07 (SESS369-01, SESS369-02, D-19) -- the shell's MCP path is
 * proven SESSIONFUL against the shipped Phase 267 flag-ON daemon, on the legacy
 * (2025-era) leg. Connect-and-list-tools is not the proof.
 * ==========================================================================
 * Six arms, one hermetic daemon (tests/helpers/mcp-daemon-369.cjs, plan 04):
 *
 *   1. bind       legacy client A room_bind(room-x): effective true, carries to
 *                 later calls, session file keyed by A's transport session id.
 *   2. mint       A gate_render on a seeded claim: renderer askuserquestion
 *                 (cowork is a Claude host surface, no elicitation declared),
 *                 gate id G1, then G2.
 *   3. answer     A gate_answer G1 approve: ok and ratified; node
 *                 decision:gate:<G1> is in room-x and absent from room-y.
 *   4. isolation  B (unbound, then bound to room-y) answering G2:
 *                 session_mismatch both times. Owner-after-stranger is the
 *                 Phase 289 dependency: today a refusal burns the owner's gate
 *                 (KNOWN); once consumeGate checks before it deletes (289) the
 *                 owner's answer ratifies and this arm flips by itself.
 *   5. reconnect  restart the daemon: A's old transport fails (HTTP 400 "No
 *                 valid session ID" class), a fresh client A2 starts unbound,
 *                 re-binds, G1 is gone from the in-memory ledger but replays
 *                 from its saved answer (plan 26, replayed true), the decision
 *                 node survives on disk.
 *   6. modern     an auto-negotiating client with no inherited CLI session id
 *                 gets no_session_id (PINNED: the shell uses the legacy path
 *                 explicitly). A daemon spawned directly with a CLI session id
 *                 in its env binds every modern request to it (HAZARD PINNED);
 *                 ensureDaemon scrubs that variable (test-369-daemon-env-scrub).
 *
 * Exit 0 all arms PASS. Exit 1 on any FAIL. Exit 77 only when the daemon cannot
 * start for an environment reason. KNOWN / PINNED lines are printed, never
 * counted as failures. No em-dashes (hyphens only). CJS.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const D = require('./helpers/mcp-daemon-369.cjs');

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
    console.log('    ' + (err && err.message ? err.message : String(err)));
  }
}

// Tool results carry one text block; room_bind appends a "## Suggested Next"
// block after the JSON payload, so parse the leading JSON only.
function parseToolJson(result) {
  const text = result && result.content && result.content[0] && result.content[0].text;
  assert.ok(typeof text === 'string' && text.length > 0, 'tool call must return text content');
  const marker = text.indexOf('\n\n## Suggested Next');
  return JSON.parse(marker === -1 ? text : text.slice(0, marker));
}

const OPTIONS = [
  { id: 'approve', label: 'Approve', rank: 1, description: 'Recommended: ratify the claim.' },
  { id: 'reject', label: 'Reject', rank: 2 },
  { id: 'defer', label: 'Defer', rank: 3 },
];

async function renderGate(client, subjectNodeId, header) {
  const out = parseToolJson(
    await client.callTool({
      name: 'gate_render',
      arguments: { header: header, kind: 'general', select_mode: 'single', options: OPTIONS, subject_node_id: subjectNodeId },
    })
  );
  return out;
}

async function answerGate(client, gateId, verdict) {
  const res = await client.callTool({
    name: 'gate_answer',
    arguments: { gate_id: gateId, chosen: [verdict], verdict: verdict },
  });
  return parseToolJson(res);
}

// Read-only look at a room.db: no write door, no mutation.
function readNodes(roomDir, like) {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(path.join(roomDir, '.mindrian', 'room.db'), { readOnly: true });
  try {
    return db.prepare('SELECT id, type FROM nodes WHERE id LIKE ?').all(like);
  } finally {
    db.close();
  }
}

function claimIdOf(roomDir) {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(path.join(roomDir, '.mindrian', 'room.db'), { readOnly: true });
  try {
    const rows = db.prepare("SELECT id FROM nodes WHERE id LIKE 'claim:%' ORDER BY rowid").all();
    return rows.length > 0 ? rows[0].id : null;
  } finally {
    db.close();
  }
}

// Does consumeGate delete the ledger entry AFTER the session check (Phase 289,
// consume-after-checks)? Read from source so this arm flips by itself.
function phase289Landed() {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'lib', 'mcp', 'gate-ledger.cjs'), 'utf8');
  const start = src.indexOf('function consumeGate(');
  assert.ok(start !== -1, 'consumeGate must exist');
  const body = src.slice(start, src.indexOf('\n}\n', start));
  const sessionCheck = body.indexOf('session_mismatch');
  const del = body.indexOf('_ledger.delete(');
  assert.ok(sessionCheck !== -1 && del !== -1, 'consumeGate must hold a session check and a delete');
  return del > sessionCheck;
}

function isSessionError(err) {
  const m = String((err && err.message) || err);
  return /400|session/i.test(m);
}

async function main() {
  const handles = [];
  const clients = [];
  let h = null;
  try {
    try {
      h = await D.startDaemon({
        rooms: [
          {
            slug: 'room-x',
            variant: 'wide',
            migrate: true,
            seed: [
              { kind: 'claim', text: 'Local-first rooms keep a founder in control of the decision trail.' },
              { kind: 'source', url: 'https://example.org/369/source-1', retrieved_at: '2026-10-01T00:00:00Z' },
            ],
          },
          { slug: 'room-y', variant: 'wide', migrate: true },
        ],
      });
    } catch (err) {
      console.log('SKIP: daemon could not start (' + (err && err.message ? err.message : err) + ')');
      process.exit(77);
    }
    handles.push(h);
    const roomX = h.roomDirs['room-x'];
    const roomY = h.roomDirs['room-y'];
    const claimId = claimIdOf(roomX);
    console.log('rooms: room-x, room-y; seeded claim: ' + claimId);
    assert.ok(claimId, 'room-x must hold the seeded claim');

    let A = null;
    let G1 = null;
    let G2 = null;

    await arm('1 bind: legacy client A room_bind(room-x) is effective, carries to later calls, session file written', async () => {
      A = await D.legacyClient(h.port, 'mindrian-shell');
      clients.push(A);
      assert.notEqual(A.client.getNegotiatedProtocolVersion(), '2026-07-28', 'legacy client must be 2025-era');
      const sid = A.transport.sessionId;
      assert.ok(typeof sid === 'string' && sid.length > 0, 'A has a transport session id');
      const bind = parseToolJson(await A.client.callTool({ name: 'room_bind', arguments: { room: 'room-x' } }));
      assert.equal(bind.ok, true, 'room_bind ok: ' + JSON.stringify(bind));
      assert.equal(bind.effective, true, 'effective: ' + JSON.stringify(bind));
      assert.equal(bind.carries_to_later_calls, true, 'carries_to_later_calls: ' + JSON.stringify(bind));
      const file = path.join(h.roomsHome, '.rooms', 'sessions', sid + '.json');
      assert.ok(fs.existsSync(file), 'session file must exist at ' + file);
    });

    await arm('2 mint: A gate_render on the seeded claim returns renderer askuserquestion and two gate ids', async () => {
      assert.ok(A, 'arm 1 must have connected A');
      const r1 = await renderGate(A.client, claimId, 'Confirm the claim (G1)');
      assert.equal(r1.ok, true, 'render G1: ' + JSON.stringify(r1));
      assert.equal(r1.renderer, 'askuserquestion', 'renderer: ' + r1.renderer);
      assert.ok(typeof r1.gate_id === 'string' && r1.gate_id.length > 0, 'G1 id');
      // Plan 26 (stale_subject): G1's approval confirms the claim, so a second card on the SAME
      // claim would rightly read stale to its owner. G2 carries no subject: arm 4 is about session
      // isolation, not about the subject.
      const r2 = await renderGate(A.client, undefined, 'Decide (G2)');
      assert.equal(r2.ok, true, 'render G2: ' + JSON.stringify(r2));
      assert.equal(r2.renderer, 'askuserquestion');
      assert.notEqual(r1.gate_id, r2.gate_id, 'distinct gate ids');
      G1 = r1.gate_id;
      G2 = r2.gate_id;
      console.log('  gate ids: G1=' + G1 + ' G2=' + G2);
    });

    await arm('3 answer: A gate_answer G1 approve is ok and ratified; decision node lands in room-x only', async () => {
      assert.ok(G1, 'arm 2 must have minted G1');
      const ans = await answerGate(A.client, G1, 'approve');
      assert.equal(ans.ok, true, 'answer ok: ' + JSON.stringify(ans));
      assert.equal(ans.ratified, true, 'ratified: ' + JSON.stringify(ans));
      const inX = readNodes(roomX, 'decision:gate:' + G1);
      assert.equal(inX.length, 1, 'room-x must hold decision:gate:' + G1 + ', got ' + JSON.stringify(inX));
      const inY = readNodes(roomY, 'decision:gate:%');
      assert.equal(inY.length, 0, 'room-y must hold no decision node, got ' + JSON.stringify(inY));
    });

    await arm('4 isolation: a stranger cannot answer G2 (unbound or bound elsewhere); owner-after-stranger recorded', async () => {
      assert.ok(G2, 'arm 2 must have minted G2');
      const B = await D.legacyClient(h.port, 'mindrian-shell-stranger');
      clients.push(B);
      assert.notEqual(B.transport.sessionId, A.transport.sessionId, 'B has its own session id');
      const unbound = await answerGate(B.client, G2, 'approve');
      assert.equal(unbound.ok, false, 'unbound B must be refused: ' + JSON.stringify(unbound));
      assert.equal(unbound.reason, 'session_mismatch', 'unbound B: ' + JSON.stringify(unbound));
      const bindY = parseToolJson(await B.client.callTool({ name: 'room_bind', arguments: { room: 'room-y' } }));
      assert.equal(bindY.ok, true, 'B binds room-y: ' + JSON.stringify(bindY));
      const bound = await answerGate(B.client, G2, 'approve');
      assert.equal(bound.ok, false, 'bound B must be refused: ' + JSON.stringify(bound));
      // Today the first refusal already burned the entry, so the second answer
      // is unknown_or_expired_gate; with 289 it stays session_mismatch. Either
      // way the stranger never ratifies.
      assert.ok(
        bound.reason === 'session_mismatch' || bound.reason === 'unknown_or_expired_gate',
        'bound B refusal reason: ' + JSON.stringify(bound)
      );
      assert.equal(readNodes(roomY, 'decision:gate:%').length, 0, 'the stranger wrote nothing to room-y');
      const owner = await answerGate(A.client, G2, 'approve');
      if (phase289Landed()) {
        assert.equal(owner.ok, true, 'Phase 289 landed: the owner must ratify after a refused stranger: ' + JSON.stringify(owner));
        assert.equal(owner.ratified, true, 'owner ratified: ' + JSON.stringify(owner));
        console.log('  owner-after-stranger ratified (Phase 289 consume-after-checks is in)');
      } else {
        assert.equal(owner.ok, false, 'owner-after-stranger must be the known refusal: ' + JSON.stringify(owner));
        assert.equal(owner.reason, 'unknown_or_expired_gate', 'owner-after-stranger: ' + JSON.stringify(owner));
        console.log("  KNOWN: a cross-session refusal burns the owner's gate (spike 007 burn-probe); Phase 289 fixes it");
      }
    });

    let A2 = null;
    await arm('5 reconnect: after a daemon restart the old transport is dead, a new client starts unbound, the decision node survives', async () => {
      const restarted = await D.restartDaemon(h);
      h = restarted;
      handles[0] = h; // same hermetic dirs; the first child is already dead
      let threw = null;
      try {
        await A.client.callTool({ name: 'room_state_bound', arguments: {} });
      } catch (err) {
        threw = err;
      }
      assert.ok(threw, 'the old transport must fail after a restart');
      assert.ok(isSessionError(threw), 'failure must be the HTTP 400 no-valid-session class, got: ' + String(threw.message || threw));

      A2 = await D.legacyClient(h.port, 'mindrian-shell');
      clients.push(A2);
      assert.notEqual(A2.transport.sessionId, A.transport.sessionId, 'A2 gets a new session id');
      const state = parseToolJson(await A2.client.callTool({ name: 'room_state_bound', arguments: {} }));
      assert.ok(state.room_binding && state.room_binding.bound === false, 'A2 must start unbound: ' + JSON.stringify(state.room_binding));
      // A write-scoped call before re-binding reports the session as unbound:
      // ratifying a gate writes a room node, so it is refused, not landed in
      // the registry fallback room.
      const probe = await renderGate(A2.client, undefined, 'Binding probe');
      assert.equal(probe.ok, true, 'probe render: ' + JSON.stringify(probe));
      const refused = await answerGate(A2.client, probe.gate_id, 'approve');
      assert.equal(refused.ok, false, 'unbound write must be refused: ' + JSON.stringify(refused));
      console.log('  unbound write refusal: ' + JSON.stringify(refused.reason));
      assert.equal(readNodes(roomX, 'decision:gate:' + probe.gate_id).length, 0, 'the unbound answer wrote nothing');
      const bind = parseToolJson(await A2.client.callTool({ name: 'room_bind', arguments: { room: 'room-x' } }));
      assert.equal(bind.ok, true, 'A2 room_bind ok: ' + JSON.stringify(bind));
      assert.equal(bind.effective, true, 'A2 effective: ' + JSON.stringify(bind));
      // The ledger is in memory and did not survive the restart, but G1 was answered before it:
      // plan 26 replays the saved answer by gate id (replayed:true) instead of refusing it, and
      // nothing is written a second time.
      const gone = await answerGate(A2.client, G1, 'approve');
      assert.equal(gone.ok, true, 'G1 was answered before the restart, so it replays: ' + JSON.stringify(gone));
      assert.equal(gone.replayed, true, 'G1 replays from the saved answer: ' + JSON.stringify(gone));
      assert.equal(gone.decision_node_id, 'decision:gate:' + G1);
      assert.equal(readNodes(roomX, 'decision:gate:' + G1).length, 1, 'decision node for G1 must survive the restart, exactly once');
    });

    await arm('6 modern: an auto client with no inherited CLI session id gets no_session_id; an inherited id binds every request', async () => {
      const M = await D.autoClient(h.port, 'mindrian-shell-modern');
      clients.push(M);
      assert.equal(M.client.getNegotiatedProtocolVersion(), '2026-07-28', 'auto client must negotiate 2026-07-28');
      const res = await M.client.callTool({ name: 'room_bind', arguments: { room: 'room-x' } });
      const out = parseToolJson(res);
      assert.equal(out.ok, false, 'modern room_bind must not bind: ' + JSON.stringify(out));
      assert.equal(out.reason, 'no_session_id', 'modern room_bind: ' + JSON.stringify(out));
      console.log('  PINNED: modern request identity is not proven; the shell uses the legacy sessionful path explicitly (D-19)');

      // Second daemon, spawned directly (not through ensureDaemon), inheriting a CLI session id.
      const h2 = await D.startDaemon({
        rooms: [{ slug: 'room-x', variant: 'wide', migrate: true }],
        extraEnv: { CLAUDE_CODE_SESSION_ID: 'cli-session-369' },
      });
      handles.push(h2);
      const M2 = await D.autoClient(h2.port, 'mindrian-shell-modern-2');
      clients.push(M2);
      const out2 = parseToolJson(await M2.client.callTool({ name: 'room_bind', arguments: { room: 'room-x' } }));
      assert.equal(out2.ok, true, 'inherited id binds the modern request: ' + JSON.stringify(out2));
      const file = path.join(h2.roomsHome, '.rooms', 'sessions', 'cli-session-369.json');
      assert.ok(fs.existsSync(file), 'binding file must be keyed cli-session-369 at ' + file);
      console.log('  HAZARD PINNED: a daemon that inherits a CLI session id binds every modern request to it; ensureDaemon scrubs the variable (test-369-daemon-env-scrub)');
    });
  } finally {
    for (const c of clients) {
      try {
        await c.close();
      } catch (_e) {
        /* best effort */
      }
    }
    for (const x of handles) {
      try {
        await D.stopDaemon(x);
      } catch (_e) {
        /* best effort */
      }
    }
  }

  console.log('');
  console.log('RESULT: PASS=' + passed + ' FAIL=' + failed);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
