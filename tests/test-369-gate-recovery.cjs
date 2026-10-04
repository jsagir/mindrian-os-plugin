#!/usr/bin/env node
'use strict';

/**
 * Phase 369 Plan 26 (GREC369-01..04, D-16, deliverable 11) -- a gate answer is
 * RECOVERABLE, proven on a live daemon (the shipped Phase 267 flag-ON server,
 * tests/helpers/mcp-daemon-369.cjs, legacy clients).
 * ==========================================================================
 * Arms (numbers are the plan's):
 *   1   lost response, approve: answer again -> replayed true, same decision node, one node
 *   2   lost response, reject: answer again -> replayed true, verdict reject, one memory_event
 *   3   restart: a gate answered before the restart replays after it; an unanswered one is unknown_gate
 *   4   room switch: room_switched, nothing written anywhere, then ratifies once rebound
 *   5   stale subject: the claim changed (its change_seq moved): an approve is refused stale_subject, claim
 *       untouched, gate still open; a defer on the same stale card is allowed
 *   6   expiry: gate_expired (the daemon is a separate process, so the TTL is aged by the
 *       MINDRIAN_TEST_MODE fault marker .test-fault-gate-expire holding the gate id)
 *   7   persistence failure: the fault marker .test-fault-gate-persist throws after the first
 *       write: persistence_failed, a real rollback (no decision node, no new change-log row),
 *       the gate stays answerable and then ratifies
 *   7b  the fault hooks are test-only: a daemon WITHOUT MINDRIAN_TEST_MODE ignores both markers,
 *       and every read of a test fault path in gate.cjs sits inside a MINDRIAN_TEST_MODE branch
 *   8   one transaction: every room_change_log row of one ratification shares one non-NULL transaction_id
 *   9   refusals never consume: a chosen value outside the card, then a stranger, then the owner ratifies
 *   10  unbound write (D-16 validation): the existing resolveMcpWriteRoom refusal, nothing written,
 *       and the gate was not consumed (it ratifies after the bind)
 *
 * No chmod anywhere (unreliable as root and on WSL drvfs). Exit 0 all PASS, 1 any FAIL, 77 only
 * when the daemon cannot start for an environment reason. Hyphens only. CJS.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

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

function parseToolJson(result) {
  const text = result && result.content && result.content[0] && result.content[0].text;
  assert.ok(typeof text === 'string' && text.length > 0, 'tool call must return text content');
  const marker = text.indexOf('\n\n## Suggested Next');
  return JSON.parse(marker === -1 ? text : text.slice(0, marker));
}

const OPTIONS = [
  { id: 'approve', label: 'Approve', rank: 1, description: 'Recommended: ratify.' },
  { id: 'reject', label: 'Reject', rank: 2 },
  { id: 'defer', label: 'Defer', rank: 3 },
];

async function mint(client, header, subjectNodeId) {
  const args = { header: header, kind: 'general', select_mode: 'single', options: OPTIONS };
  if (subjectNodeId) args.subject_node_id = subjectNodeId;
  const out = parseToolJson(await client.callTool({ name: 'gate_render', arguments: args }));
  assert.equal(out.ok, true, 'gate_render: ' + JSON.stringify(out));
  assert.ok(typeof out.gate_id === 'string' && out.gate_id.length > 0, 'gate id');
  return out.gate_id;
}

async function answer(client, gateId, verdict, chosen) {
  return parseToolJson(await client.callTool({
    name: 'gate_answer',
    arguments: { gate_id: gateId, chosen: chosen || [verdict], verdict: verdict },
  }));
}

async function bind(client, room) {
  const out = parseToolJson(await client.callTool({ name: 'room_bind', arguments: { room: room } }));
  assert.equal(out.ok, true, 'room_bind ' + room + ': ' + JSON.stringify(out));
  return out;
}

// Read-only looks at a room.db: no write door.
function withDb(roomDir, fn) {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(path.join(roomDir, '.mindrian', 'room.db'), { readOnly: true });
  try {
    return fn(db);
  } finally {
    db.close();
  }
}
function nodeRows(roomDir, like) {
  return withDb(roomDir, (db) => db.prepare('SELECT id, type, review_status FROM nodes WHERE id LIKE ?').all(like));
}
function claimIds(roomDir) {
  return withDb(roomDir, (db) => db.prepare("SELECT id FROM nodes WHERE id LIKE 'claim:%' ORDER BY rowid").all().map((r) => r.id));
}
function answerEvents(roomDir, gateId) {
  return withDb(roomDir, (db) => db.prepare(
    "SELECT id FROM nodes WHERE type = 'memory_event' AND json_extract(properties, '$.dedupe_key') = ?"
  ).all('gate_answer:' + gateId));
}
function latestSeq(roomDir) {
  return withDb(roomDir, (db) => Number(db.prepare('SELECT COALESCE(MAX(change_seq), 0) AS m FROM room_change_log').get().m));
}
function changeRowsAfter(roomDir, seq) {
  return withDb(roomDir, (db) => db.prepare(
    'SELECT change_seq, entity_type, entity_id, operation, transaction_id FROM room_change_log WHERE change_seq > ? ORDER BY change_seq'
  ).all(seq));
}

function writeMarker(roomDir, name, body) {
  const file = path.join(roomDir, '.mindrian', '.test-fault-' + name);
  fs.writeFileSync(file, body || 'x');
  return file;
}

const SEED = [
  { kind: 'claim', text: 'Local-first rooms keep a founder in control of the decision trail.' },
  { kind: 'claim', text: 'A second claim used by the stale subject arm.' },
  { kind: 'claim', text: 'A third claim used by the one-transaction arm.' },
  { kind: 'source', url: 'https://example.org/369/gate-recovery-1', retrieved_at: '2026-10-01T00:00:00Z' },
];

async function main() {
  const clients = [];
  const handles = [];
  let h = null;
  try {
    try {
      h = await D.startDaemon({
        rooms: [
          { slug: 'room-x', variant: 'wide', migrate: true, seed: SEED },
          { slug: 'room-y', variant: 'wide', migrate: true },
        ],
        extraEnv: { MINDRIAN_TEST_MODE: '1' },
      });
    } catch (err) {
      console.log('SKIP: daemon could not start (' + (err && err.message ? err.message : err) + ')');
      process.exit(77);
    }
    handles.push(h);
    const roomX = h.roomDirs['room-x'];
    const roomY = h.roomDirs['room-y'];
    const claims = claimIds(roomX);
    assert.ok(claims.length >= 3, 'room-x must hold the seeded claims');
    console.log('rooms: room-x, room-y; seeded claims: ' + claims.join(', '));

    let A = await D.legacyClient(h.port, 'recovery-369');
    clients.push(A);
    await bind(A.client, 'room-x');

    await arm('1 lost response, approve: the second answer replays, same decision node, exactly one node', async () => {
      const g = await mint(A.client, 'Approve replay');
      const first = await answer(A.client, g, 'approve');
      assert.equal(first.ok, true, 'first: ' + JSON.stringify(first));
      assert.equal(first.ratified, true);
      const second = await answer(A.client, g, 'approve');
      assert.equal(second.ok, true, 'second: ' + JSON.stringify(second));
      assert.equal(second.replayed, true, 'replayed: ' + JSON.stringify(second));
      assert.equal(second.verdict, 'approve');
      assert.equal(second.decision_node_id, 'decision:gate:' + g, 'same decision node: ' + JSON.stringify(second));
      assert.equal(nodeRows(roomX, 'decision:gate:' + g).length, 1, 'exactly one decision node');
      assert.equal(answerEvents(roomX, g).length, 1, 'exactly one answer record');
    });

    await arm('2 lost response, reject: the second answer replays with verdict reject, one memory_event', async () => {
      const g = await mint(A.client, 'Reject replay');
      const first = await answer(A.client, g, 'reject');
      assert.equal(first.ok, true, 'first: ' + JSON.stringify(first));
      assert.equal(first.ratified, false);
      const second = await answer(A.client, g, 'reject');
      assert.equal(second.ok, true, 'second: ' + JSON.stringify(second));
      assert.equal(second.replayed, true);
      assert.equal(second.verdict, 'reject', JSON.stringify(second));
      assert.equal(second.decision_node_id, undefined, 'a reject writes no decision node');
      assert.equal(answerEvents(roomX, g).length, 1, 'exactly one gate_answer memory_event');
      const flipped = await answer(A.client, g, 'approve');
      assert.equal(flipped.replayed, true, 'a different verdict never re-ratifies: ' + JSON.stringify(flipped));
      assert.equal(flipped.verdict, 'reject', 'the recorded verdict stands: ' + JSON.stringify(flipped));
      assert.equal(nodeRows(roomX, 'decision:gate:' + g).length, 0, 'still no decision node');
    });

    await arm('3 restart: an answered gate replays after the restart, an unanswered one is unknown_gate', async () => {
      const g3 = await mint(A.client, 'Answered before restart');
      const g4 = await mint(A.client, 'Open at restart');
      const done = await answer(A.client, g3, 'approve');
      assert.equal(done.ok, true, JSON.stringify(done));
      h = await D.restartDaemon(h);
      handles[0] = h;
      A = await D.legacyClient(h.port, 'recovery-369-after-restart');
      clients.push(A);
      await bind(A.client, 'room-x');
      const replay = await answer(A.client, g3, 'approve');
      assert.equal(replay.ok, true, 'replay after restart: ' + JSON.stringify(replay));
      assert.equal(replay.replayed, true, JSON.stringify(replay));
      assert.equal(replay.decision_node_id, 'decision:gate:' + g3);
      const lost = await answer(A.client, g4, 'approve');
      assert.equal(lost.ok, false, 'unanswered gate lost to the restart: ' + JSON.stringify(lost));
      assert.equal(lost.reason, 'unknown_gate', JSON.stringify(lost));
      assert.equal(nodeRows(roomX, 'decision:gate:' + g4).length, 0, 'nothing written for the lost gate');
    });

    await arm('4 room switch: room_switched writes nothing, then ratifies in room-x once rebound', async () => {
      const g = await mint(A.client, 'Room switch');
      await bind(A.client, 'room-y');
      const refused = await answer(A.client, g, 'approve');
      assert.equal(refused.ok, false, JSON.stringify(refused));
      assert.equal(refused.reason, 'room_switched', JSON.stringify(refused));
      assert.equal(nodeRows(roomX, 'decision:gate:' + g).length, 0, 'nothing in room-x');
      assert.equal(nodeRows(roomY, 'decision:gate:' + g).length, 0, 'nothing in room-y');
      assert.equal(answerEvents(roomY, g).length, 0, 'no answer record in room-y');
      await bind(A.client, 'room-x');
      const ok = await answer(A.client, g, 'approve');
      assert.equal(ok.ok, true, 'rebound answer: ' + JSON.stringify(ok));
      assert.equal(ok.ratified, true);
      assert.equal(nodeRows(roomX, 'decision:gate:' + g).length, 1, 'ratified in room-x');
      assert.equal(nodeRows(roomY, 'decision:gate:' + g).length, 0, 'still nothing in room-y');
    });

    await arm('5 stale subject: the claim changed after the card: stale_subject, claim untouched, gate still open', async () => {
      const claimId = claims[1];
      const before = nodeRows(roomX, claimId)[0];
      assert.ok(before, 'claim row');
      const g = await mint(A.client, 'Stale subject', claimId);
      const seqBefore = latestSeq(roomX);
      // A different process changes the claim: its change_seq moves.
      const child = cp.spawnSync('node', ['-e',
        "const { DatabaseSync } = require('node:sqlite');" +
        "const db = new DatabaseSync(process.argv[1]);" +
        "db.exec('PRAGMA busy_timeout = 5000');" +
        "db.prepare('UPDATE nodes SET last_seen_at = ? WHERE id = ?').run(Date.now(), process.argv[2]);" +
        "db.close();",
        path.join(roomX, '.mindrian', 'room.db'), claimId,
      ], { encoding: 'utf8' });
      assert.equal(child.status, 0, 'child update failed: ' + child.stderr);
      assert.ok(latestSeq(roomX) > seqBefore, 'the claim change moved the feed');
      const refused = await answer(A.client, g, 'approve');
      assert.equal(refused.ok, false, JSON.stringify(refused));
      assert.equal(refused.reason, 'stale_subject', JSON.stringify(refused));
      const after = nodeRows(roomX, claimId)[0];
      assert.equal(after.review_status, before.review_status, 'claim status unchanged');
      assert.equal(nodeRows(roomX, 'decision:gate:' + g).length, 0, 'no decision node');
      const again = await answer(A.client, g, 'approve');
      assert.equal(again.reason, 'stale_subject', 'the gate is still open (a peek shows it): ' + JSON.stringify(again));
      // Only an approve can ratify a changed subject; a defer records "not this one" and lets the
      // person dismiss the stale card.
      const dismissed = await answer(A.client, g, 'defer');
      assert.equal(dismissed.ok, true, 'a defer on a stale card is allowed: ' + JSON.stringify(dismissed));
      assert.equal(dismissed.ratified, false);
      assert.equal(nodeRows(roomX, claimId)[0].review_status, before.review_status, 'the claim is still untouched after the defer');
    });

    await arm('6 expiry: gate_expired, and nothing written', async () => {
      const g = await mint(A.client, 'Expiry');
      const marker = writeMarker(roomX, 'gate-expire', g);
      const refused = await answer(A.client, g, 'approve');
      assert.equal(refused.ok, false, JSON.stringify(refused));
      assert.equal(refused.reason, 'gate_expired', JSON.stringify(refused));
      assert.equal(fs.existsSync(marker), false, 'the marker is deleted when used');
      assert.equal(nodeRows(roomX, 'decision:gate:' + g).length, 0, 'nothing written');
      const unknown = await answer(A.client, 'gate-never-minted-0000', 'approve');
      assert.equal(unknown.reason, 'unknown_gate', 'a never-minted id is unknown_gate, not gate_expired: ' + JSON.stringify(unknown));
    });

    await arm('7 persistence failure: persistence_failed, a real rollback, the gate stays answerable and then ratifies', async () => {
      const g = await mint(A.client, 'Persistence failure');
      const seqBefore = latestSeq(roomX);
      const eventsBefore = withDb(roomX, (db) => Number(db.prepare("SELECT COUNT(*) AS c FROM nodes WHERE type = 'memory_event'").get().c));
      const marker = writeMarker(roomX, 'gate-persist');
      const failed1 = await answer(A.client, g, 'approve');
      assert.equal(failed1.ok, false, JSON.stringify(failed1));
      assert.equal(failed1.reason, 'persistence_failed', JSON.stringify(failed1));
      assert.equal(fs.existsSync(marker), false, 'the marker is deleted when used');
      assert.equal(nodeRows(roomX, 'decision:gate:' + g).length, 0, 'no decision node');
      assert.equal(answerEvents(roomX, g).length, 0, 'no answer record');
      assert.equal(changeRowsAfter(roomX, seqBefore).length, 0, 'no new room_change_log row from the failed attempt');
      assert.equal(withDb(roomX, (db) => Number(db.prepare("SELECT COUNT(*) AS c FROM nodes WHERE type = 'memory_event'").get().c)), eventsBefore, 'no new memory_event');
      const ok = await answer(A.client, g, 'approve');
      assert.equal(ok.ok, true, 'the gate stayed answerable: ' + JSON.stringify(ok));
      assert.equal(ok.ratified, true);
      assert.equal(ok.replayed, undefined, 'a real ratification, not a replay');
      assert.equal(nodeRows(roomX, 'decision:gate:' + g).length, 1, 'now ratified');
    });

    await arm('7b fault hooks are test-only: a daemon without MINDRIAN_TEST_MODE ignores both markers, and gate.cjs guards every read', async () => {
      const h2 = await D.startDaemon({
        rooms: [{ slug: 'room-n', variant: 'wide', migrate: true }],
      });
      handles.push(h2);
      const roomN = h2.roomDirs['room-n'];
      const N = await D.legacyClient(h2.port, 'recovery-369-normal');
      clients.push(N);
      await bind(N.client, 'room-n');
      const g = await mint(N.client, 'Markers ignored');
      const persist = writeMarker(roomN, 'gate-persist');
      const expire = writeMarker(roomN, 'gate-expire', g);
      const ok = await answer(N.client, g, 'approve');
      assert.equal(ok.ok, true, 'a normal daemon ratifies despite both markers: ' + JSON.stringify(ok));
      assert.equal(ok.ratified, true);
      assert.equal(fs.existsSync(persist) && fs.existsSync(expire), true, 'the markers were never read or deleted');
      assert.equal(nodeRows(roomN, 'decision:gate:' + g).length, 1, 'decision node written');

      const src = fs.readFileSync(path.join(REPO_ROOT, 'lib', 'mcp', 'tools', 'gate.cjs'), 'utf8');
      const needle = '.test-fault-';
      let at = src.indexOf(needle);
      assert.ok(at !== -1, 'gate.cjs holds the fault path');
      let seen = 0;
      while (at !== -1) {
        seen += 1;
        const window = src.slice(Math.max(0, at - 400), at);
        assert.ok(/MINDRIAN_TEST_MODE === '1'/.test(window), 'a read of ' + needle + ' at offset ' + at + ' is not inside a MINDRIAN_TEST_MODE === \'1\' branch');
        at = src.indexOf(needle, at + needle.length);
      }
      assert.ok(seen >= 1);
    });

    await arm('8 one transaction: every room_change_log row of one ratification shares one non-NULL transaction_id', async () => {
      const claimId = claims[2];
      const g = await mint(A.client, 'One transaction', claimId);
      const seqBefore = latestSeq(roomX);
      const ok = await answer(A.client, g, 'approve');
      assert.equal(ok.ok, true, JSON.stringify(ok));
      const rows = changeRowsAfter(roomX, seqBefore);
      assert.ok(rows.length >= 3, 'the ratification logged several rows, got ' + rows.length);
      const txs = new Set(rows.map((r) => r.transaction_id));
      assert.equal(txs.has(null), false, 'no row has a NULL transaction_id: ' + JSON.stringify(rows));
      assert.equal(txs.size, 1, 'one transaction id across every row, got ' + JSON.stringify(Array.from(txs)));
      const ids = rows.map((r) => r.entity_id);
      assert.ok(ids.includes('decision:gate:' + g), 'the decision node is in the transaction');
      assert.ok(rows.some((r) => r.entity_type === 'edge'), 'a provenance edge is in the transaction');
      assert.ok(ids.includes(claimId), 'the subject claim promotion is in the transaction');
    });

    await arm('9 refusals never consume: a chosen value outside the card, a stranger, then the owner ratifies', async () => {
      const g = await mint(A.client, 'Refusals do not consume');
      const bad = await answer(A.client, g, 'approve', ['not-an-option']);
      assert.equal(bad.ok, false, JSON.stringify(bad));
      assert.equal(bad.reason, 'chosen_not_in_card_options', JSON.stringify(bad));
      const B = await D.legacyClient(h.port, 'recovery-369-stranger');
      clients.push(B);
      await bind(B.client, 'room-x');
      const stranger = await answer(B.client, g, 'approve');
      assert.equal(stranger.ok, false);
      assert.equal(stranger.reason, 'session_mismatch', JSON.stringify(stranger));
      assert.equal(nodeRows(roomX, 'decision:gate:' + g).length, 0, 'nothing written by either refusal');
      const owner = await answer(A.client, g, 'approve');
      assert.equal(owner.ok, true, 'the gate survived both refusals: ' + JSON.stringify(owner));
      assert.equal(owner.ratified, true);
      assert.equal(nodeRows(roomX, 'decision:gate:' + g).length, 1);
    });

    await arm('10 unbound write (D-16): the existing resolveMcpWriteRoom refusal, nothing written, the gate not consumed', async () => {
      const U = await D.legacyClient(h.port, 'recovery-369-unbound');
      clients.push(U);
      const g = await mint(U.client, 'Unbound mint');
      const before = latestSeq(roomX);
      const refused = await answer(U.client, g, 'approve');
      assert.equal(refused.ok, false, 'an unbound session must be refused: ' + JSON.stringify(refused));
      assert.equal(refused.reason, 'no_bound_room', JSON.stringify(refused));
      assert.equal(nodeRows(roomX, 'decision:gate:' + g).length, 0, 'nothing written in room-x');
      assert.equal(nodeRows(roomY, 'decision:gate:' + g).length, 0, 'nothing written in room-y');
      assert.equal(latestSeq(roomX), before, 'no room_change_log row');
      await bind(U.client, 'room-x');
      const ok = await answer(U.client, g, 'approve');
      assert.equal(ok.ok, true, 'the refused gate was not consumed: ' + JSON.stringify(ok));
      assert.equal(nodeRows(roomX, 'decision:gate:' + g).length, 1);
    });
  } finally {
    for (const c of clients) {
      try { await c.close(); } catch (_e) { /* best effort */ }
    }
    for (const x of handles) {
      try { await D.stopDaemon(x); } catch (_e) { /* best effort */ }
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
