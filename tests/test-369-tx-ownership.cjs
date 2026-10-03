#!/usr/bin/env node
'use strict';

/**
 * Phase 369-06 (CHG369-03, D-18) -- transaction ownership at the eight
 * unconditional-BEGIN writer sites.
 *
 * Static arm (every site): the function body must open its transaction only
 * when `owns` (db.isTransaction !== true), and every COMMIT and ROLLBACK that
 * belongs to that transaction must be guarded by `owns` too. A later edit that
 * reintroduces an unconditional BEGIN, COMMIT or ROLLBACK fails by naming the
 * site and the line.
 *
 * Behavioural arms (fresh `wide` fixture rooms through the write door):
 *   1. promoteNodeStatus standalone: status changes, commits as before
 *   2. inside withRoomTx, fn throws: status unchanged, no new log row for it
 *   3. inside withRoomTx, completes: persists, log rows share one transaction_id
 *      with a second insert made in the same withRoomTx
 *   4. inside a raw outer BEGIN IMMEDIATE: no nested-transaction error, outer
 *      ROLLBACK reverts it
 *   5. every other site that accepts a caller-owned handle, inside a raw outer
 *      BEGIN IMMEDIATE: no nested-transaction error, outer ROLLBACK leaves the
 *      row counts unchanged. Sites that open their own handle report
 *      "owns its handle: composition not reachable" and pass on the static arm.
 *
 * Canon Part 9: raw handles on throwaway fixtures only (tests/ is allow-listed
 * by the substrate guard). Canon Part 8: no network. No em-dashes or en-dashes.
 */

const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const HERMETIC = fs.mkdtempSync(path.join(os.tmpdir(), 'test-369-tx-own-'));
process.env.HOME = HERMETIC;
process.env.USERPROFILE = HERMETIC;
process.env.MINDRIAN_ROOMS_HOME = path.join(HERMETIC, 'rooms');
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;

const REPO = path.resolve(__dirname, '..');
const navigation = require(path.join(REPO, 'lib', 'core', 'navigation.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
const { promoteNodeStatus } = require(path.join(REPO, 'lib', 'core', 'navigation', 'transitions.cjs'));
const { setFocus } = require(path.join(REPO, 'lib', 'core', 'navigation', 'focus.cjs'));
const { fileEvidenceWithReadback } = require(path.join(REPO, 'lib', 'core', 'navigation', 'file-evidence-readback.cjs'));
const { writeBreakthrough } = require(path.join(REPO, 'lib', 'core', 'breakthrough', 'schema.cjs'));
const lazygraph = require(path.join(REPO, 'lib', 'core', 'lazygraph-ops.cjs'));
const { insertNode } = require(path.join(REPO, 'lib', 'core', 'node-insert.cjs'));
const { buildRoom369 } = require('./helpers/fixture-room-369.cjs');

// The eight sites: file, function that holds the transaction, and the access
// mode the behavioural arm can reach.
const SITES = [
  { id: 'transitions.promoteNodeStatus', file: 'lib/core/navigation/transitions.cjs', fn: 'promoteNodeStatus', handle: 'caller' },
  { id: 'focus.setFocus', file: 'lib/core/navigation/focus.cjs', fn: 'setFocus', handle: 'caller' },
  { id: 'file-evidence-readback.fileEvidenceWithReadback', file: 'lib/core/navigation/file-evidence-readback.cjs', fn: 'fileEvidenceWithReadback', handle: 'caller' },
  { id: 'room-discard-cascade.discardPlaceholderRoom', file: 'lib/core/room-discard-cascade.cjs', fn: 'discardPlaceholderRoom', handle: 'own' },
  { id: 'ambient-run.runAmbientComposition', file: 'lib/core/ambient-run.cjs', fn: 'runAmbientComposition', handle: 'own' },
  { id: 'lazygraph-ops.indexArtifact', file: 'lib/core/lazygraph-ops.cjs', fn: 'indexArtifact', handle: 'caller' },
  { id: 'lazygraph-ops.rebuildGraph', file: 'lib/core/lazygraph-ops.cjs', fn: 'rebuildGraph', handle: 'caller' },
  { id: 'breakthrough-schema.writeBreakthrough', file: 'lib/core/breakthrough/schema.cjs', fn: 'writeBreakthrough', handle: 'caller' },
];

const results = []; // { site, arm, result }
let failed = 0;

function record(site, arm, ok, err) {
  results.push({ site, arm, result: ok ? 'PASS' : 'FAIL' });
  if (!ok) {
    failed += 1;
    process.stdout.write('  FAIL ' + site + ' [' + arm + ']\n');
    if (err) process.stdout.write('    ' + (err.stack || err.message || String(err)) + '\n');
  } else {
    process.stdout.write('  ok ' + site + ' [' + arm + ']\n');
  }
}
function arm(site, name, fn) {
  try { fn(); record(site, name, true); } catch (e) { record(site, name, false, e); }
}
function note(site, name, text) {
  results.push({ site, arm: name, result: text });
  process.stdout.write('  -- ' + site + ' [' + name + '] ' + text + '\n');
}

// ---------------------------------------------------------------------------
// Static arm
// ---------------------------------------------------------------------------

function functionBody(src, fn) {
  const lines = src.split('\n');
  const re = new RegExp('^(async\\s+)?function\\s+' + fn + '\\s*\\(');
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (re.test(lines[i])) { start = i; break; }
  }
  if (start < 0) throw new Error('function ' + fn + ' not found');
  let end = lines.length - 1;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^}/.test(lines[i])) { end = i; break; }
  }
  return { lines: lines.slice(start, end + 1), startLine: start + 1 };
}

const TX_OPEN_RE = /(\.exec\(\s*['"]BEGIN(?:\s+\w+)?['"]\s*\)|prepare\(\s*['"]BEGIN(?:\s+\w+)?['"]\s*\)\s*\.run\(\))/;
const TX_END_RE = /(\.exec\(\s*['"](COMMIT|ROLLBACK)['"]\s*\)|prepare\(\s*['"](COMMIT|ROLLBACK)['"]\s*\)\s*\.run\(\))/;
const OWNS_DECL_RE = /const\s+owns\s*=\s*\w+\.isTransaction\s*!==\s*true\s*;/;

// A statement is guarded when its own line carries `owns`, or the nearest
// non-blank preceding line is an `else if (owns)` / `if (owns) {` header or a
// bare else-if branch on owns, or the enclosing block was opened by an
// `if (owns)` / `else if (owns)` / `if (!owns)` header within the previous
// three lines.
function isGuarded(lines, idx) {
  if (/\bowns\b/.test(lines[idx])) return true;
  let seen = 0;
  for (let back = 1; back <= 6 && idx - back >= 0 && seen < 2; back++) {
    const prev = lines[idx - back];
    const t = prev.trim();
    if (t === '' || t.startsWith('//')) continue;
    seen += 1;
    // block header opened on owns
    if (/\b(if|else if)\s*\(\s*owns\s*(&&[^)]*)?\)\s*\{?\s*$/.test(prev)) return true;
    // early exit for the not-owns case, so the statement below runs only when owns
    if (/\bif\s*\(\s*!owns\s*\)\s*(throw|return)\b/.test(prev)) return true;
  }
  return false;
}

for (const site of SITES) {
  arm(site.id, 'static', () => {
    const src = fs.readFileSync(path.join(REPO, site.file), 'utf8');
    const body = functionBody(src, site.fn);
    const text = body.lines.join('\n');
    assert.ok(OWNS_DECL_RE.test(text), site.id + ': no `const owns = <handle>.isTransaction !== true;` in body');
    let opens = 0;
    let ends = 0;
    body.lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
      const lineNo = body.startLine + i;
      if (TX_OPEN_RE.test(line)) {
        opens += 1;
        assert.ok(isGuarded(body.lines, i), site.id + ': unguarded transaction open at ' + site.file + ':' + lineNo);
      }
      if (TX_END_RE.test(line)) {
        ends += 1;
        assert.ok(isGuarded(body.lines, i), site.id + ': unguarded COMMIT/ROLLBACK at ' + site.file + ':' + lineNo);
      }
    });
    assert.ok(opens >= 1, site.id + ': no transaction open found in body');
    assert.ok(ends >= 2, site.id + ': expected at least a COMMIT and a ROLLBACK in body');
  });
}

// ---------------------------------------------------------------------------
// Behavioural arms
// ---------------------------------------------------------------------------

let roomCounter = 0;
function freshRoom() {
  roomCounter += 1;
  const tmpDir = path.join(HERMETIC, 'rooms', 'r' + roomCounter);
  return buildRoom369({ tmpDir, slug: 'r' + roomCounter, variant: 'wide', migrate: true });
}
function withDb(room, fn) {
  const db = openRoomDb(room.roomDir);
  try { return fn(db); } finally { closeRoomDb(db); }
}
function seedClaim(db, text) {
  const res = navigation.writeClaimNode(db, { knowledge_type: 'fact', text, sessionId: 'tx-own-' + text });
  assert.equal(res.ok, true, 'claim seed: ' + JSON.stringify(res));
  return res.node_id;
}
function status(db, id) { return db.prepare('SELECT review_status AS s FROM nodes WHERE id = ?').get(id).s; }
function count(db, table) { return db.prepare('SELECT COUNT(*) AS c FROM ' + table).get().c; }
function logCount(db) { return count(db, 'room_change_log'); }
function logRowsFor(db, id) {
  return db.prepare("SELECT * FROM room_change_log WHERE entity_type = 'node' AND entity_id = ? ORDER BY change_seq").all(id);
}
const NESTED_RE = /within a transaction/i;

const PS = 'transitions.promoteNodeStatus';

arm(PS, 'standalone', () => {
  const room = freshRoom();
  withDb(room, (db) => {
    const id = seedClaim(db, 'standalone');
    assert.equal(status(db, id), 'proposed');
    const res = promoteNodeStatus(db, id, 'proposed', 'confirmed', 'jonathan', 'test');
    assert.equal(res.ok, true, JSON.stringify(res));
    assert.equal(status(db, id), 'confirmed');
    assert.equal(db.isTransaction, false, 'transaction left open');
  });
});

arm(PS, 'withRoomTx-throw-reverts', () => {
  const room = freshRoom();
  withDb(room, (db) => {
    const id = seedClaim(db, 'reverts');
    const logBefore = logCount(db);
    const nodesBefore = count(db, 'nodes');
    const rowsBefore = logRowsFor(db, id).length;
    assert.throws(() => navigation.withRoomTx(db, () => {
      const res = promoteNodeStatus(db, id, 'proposed', 'confirmed', 'jonathan', 'test');
      assert.equal(res.ok, true, JSON.stringify(res));
      assert.equal(status(db, id), 'confirmed', 'in-transaction view');
      throw new Error('boom');
    }), /boom/);
    assert.equal(status(db, id), 'proposed', 'status not reverted');
    assert.equal(logRowsFor(db, id).length, rowsBefore, 'new log row for the claim survived rollback');
    assert.equal(logCount(db), logBefore, 'log rows survived rollback');
    assert.equal(count(db, 'nodes'), nodesBefore, 'audit node survived rollback');
  });
});

arm(PS, 'withRoomTx-commit-shared-tx-id', () => {
  const room = freshRoom();
  withDb(room, (db) => {
    const id = seedClaim(db, 'commits');
    const other = 'claim:tx-own-second';
    const before = db.prepare('SELECT COALESCE(MAX(change_seq), 0) AS m FROM room_change_log').get().m;
    navigation.withRoomTx(db, () => {
      const res = promoteNodeStatus(db, id, 'proposed', 'confirmed', 'jonathan', 'test');
      assert.equal(res.ok, true, JSON.stringify(res));
      insertNode(db, other, 'claim', JSON.stringify({ text: 'second' }), { epistemic_type: 'observation' });
    });
    assert.equal(status(db, id), 'confirmed');
    const fresh = db.prepare('SELECT * FROM room_change_log WHERE change_seq > ? ORDER BY change_seq').all(before);
    assert.ok(fresh.length >= 3, 'expected status, audit node and second insert rows, got ' + fresh.length);
    const ids = new Set(fresh.map((r) => r.transaction_id));
    assert.equal(ids.size, 1, 'rows carry more than one transaction_id: ' + [...ids].join(','));
    assert.ok([...ids][0], 'transaction_id is NULL');
    assert.ok(fresh.some((r) => r.entity_id === id), 'status change not logged');
    assert.ok(fresh.some((r) => r.entity_id === other), 'second insert not logged');
  });
});

arm(PS, 'raw-outer-begin-immediate', () => {
  const room = freshRoom();
  withDb(room, (db) => {
    const id = seedClaim(db, 'raw');
    const logBefore = logCount(db);
    db.exec('BEGIN IMMEDIATE');
    let res;
    try {
      res = promoteNodeStatus(db, id, 'proposed', 'confirmed', 'jonathan', 'test');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    assert.equal(res.ok, true, JSON.stringify(res));
    assert.ok(!NESTED_RE.test(String(res.reason || '')), 'nested transaction error');
    assert.equal(db.isTransaction, true, 'callee closed the outer transaction');
    db.exec('ROLLBACK');
    assert.equal(status(db, id), 'proposed');
    assert.equal(logCount(db), logBefore);
  });
});

// Outer-transaction harness for the remaining caller-handle sites.
function composeArm(site, fn, tables) {
  arm(site, 'outer-rollback', () => {
    const room = freshRoom();
    withDb(room, (db) => {
      const ctx = { room };
      const prep = fn.prepare ? fn.prepare(db, ctx) : undefined;
      const before = tables.map((t) => count(db, t));
      db.exec('BEGIN IMMEDIATE');
      let out;
      try {
        out = fn.run(db, ctx, prep);
      } catch (e) {
        try { db.exec('ROLLBACK'); } catch (_e) { /* gone */ }
        assert.ok(!NESTED_RE.test(String(e && e.message)), 'nested transaction error: ' + e.message);
        throw e;
      }
      assert.equal(db.isTransaction, true, 'callee closed the outer transaction');
      if (fn.check) fn.check(db, out);
      db.exec('ROLLBACK');
      const after = tables.map((t) => count(db, t));
      assert.deepEqual(after, before, 'row counts moved after outer ROLLBACK: ' + tables.join(',') + ' ' + JSON.stringify(before) + ' -> ' + JSON.stringify(after));
    });
  });
}

composeArm('focus.setFocus', {
  prepare: (db) => seedClaim(db, 'focus'),
  run: (db, _c, id) => setFocus(db, 'sess-tx-own', id, 'user'),
  check: (db, res) => {
    assert.equal(res.ok, true, JSON.stringify(res));
    assert.equal(count(db, 'session_focus'), 1, 'focus row not written inside outer tx');
  },
}, ['nodes', 'session_focus', 'room_change_log']);

composeArm('file-evidence-readback.fileEvidenceWithReadback', {
  prepare: (db) => seedClaim(db, 'evidence target'),
  run: (db, _c, targetId) => fileEvidenceWithReadback(db, {
    topic: 'tx ownership',
    source: 'test-369',
    url: 'https://example.com/tx-own',
    retrieved_at: '2026-10-03T00:00:00.000Z',
    evidence_tier: 'Academic',
    summary: 'composition probe',
    sessionId: 'tx-own-evidence',
    informsTargetId: targetId,
  }),
  check: (_db, res) => assert.equal(res.ok, true, JSON.stringify(res)),
}, ['nodes', 'edges', 'room_change_log']);

composeArm('breakthrough-schema.writeBreakthrough', {
  prepare: (db) => seedClaim(db, 'breakthrough artifact'),
  run: (db, _c, artifactId) => writeBreakthrough(db, {
    id: 'breakthrough:tx-own',
    kind: 'cross_section',
    confidence: 0.5,
    theme: 'tx ownership',
    artifact_ids: [artifactId],
  }),
  check: (_db, res) => assert.equal(res.ok, true, JSON.stringify(res)),
}, ['nodes', 'edges', 'room_change_log']);

function writeSectionFile(room, name, body) {
  const dir = path.join(room.roomDir, 'problem-definition');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name);
  fs.writeFileSync(file, body, 'utf8');
  return file;
}

composeArm('lazygraph-ops.indexArtifact', {
  prepare: (_db, ctx) => writeSectionFile(ctx.room, 'tx-own.md', '---\ntitle: Tx Own\n---\n\nComposition probe.\n'),
  run: (db, ctx, file) => lazygraph.indexArtifact(db, ctx.room.roomDir, file),
  check: (db) => assert.ok(count(db, 'nodes') > 0),
}, ['nodes', 'edges', 'room_change_log']);

// rebuildGraph is async and awaits inside the transaction body only through
// sync helpers, so the outer transaction is still open when the promise
// settles; run it with an explicit await in an async arm below.
async function rebuildArm() {
  const site = 'lazygraph-ops.rebuildGraph';
  try {
    const room = freshRoom();
    const db = openRoomDb(room.roomDir);
    try {
      writeSectionFile(room, 'tx-own-a.md', '---\ntitle: A\n---\n\nAlpha.\n');
      const tables = ['nodes', 'edges', 'room_change_log'];
      const before = tables.map((t) => count(db, t));
      db.exec('BEGIN IMMEDIATE');
      try {
        await lazygraph.rebuildGraph(db, room.roomDir);
      } catch (e) {
        try { db.exec('ROLLBACK'); } catch (_e) { /* gone */ }
        assert.ok(!NESTED_RE.test(String(e && e.message)), 'nested transaction error: ' + e.message);
        throw e;
      }
      assert.equal(db.isTransaction, true, 'callee closed the outer transaction');
      db.exec('ROLLBACK');
      const after = tables.map((t) => count(db, t));
      assert.deepEqual(after, before, 'row counts moved after outer ROLLBACK');
    } finally {
      closeRoomDb(db);
    }
    record(site, 'outer-rollback', true);
  } catch (e) {
    record(site, 'outer-rollback', false, e);
  }
}

// Own-handle sites: composition is not reachable from outside.
note('room-discard-cascade.discardPlaceholderRoom', 'outer-rollback', 'owns its handle: composition not reachable');
note('ambient-run.runAmbientComposition', 'outer-rollback', 'owns its handle: composition not reachable');

// Standalone behaviour of the own-handle discard site is covered by the
// existing lib/core/room-discard-cascade.test.cjs regression; here we only
// confirm it still commits on its own handle.
arm('room-discard-cascade.discardPlaceholderRoom', 'standalone', () => {
  const { discardPlaceholderRoom } = require(path.join(REPO, 'lib', 'core', 'room-discard-cascade.cjs'));
  const slug = 'untitled-2026-10-03-0001';
  const roomsHome = path.join(HERMETIC, 'discard-home');
  const roomDir = path.join(roomsHome, slug);
  fs.mkdirSync(path.join(roomsHome, '.rooms'), { recursive: true });
  fs.mkdirSync(roomDir, { recursive: true });
  fs.writeFileSync(path.join(roomDir, '.room-root'), '');
  closeRoomDb(openRoomDb(roomDir));
  fs.writeFileSync(path.join(roomsHome, '.rooms', 'registry.json'), JSON.stringify({
    version: 1,
    active: slug,
    rooms: { [slug]: { path: roomDir, venture_name: 'untitled', venture_stage: 'Pre-Opportunity', status: 'active', last_opened: Date.now() } },
  }), 'utf8');
  const res = discardPlaceholderRoom(roomsHome, slug, { decided_by: 'tx-own' });
  assert.equal(res.ok, true, JSON.stringify(res));
  assert.equal(res.rolled_back_db, true, 'discard event did not commit on its own handle');
});

(async () => {
  await rebuildArm();

  process.stdout.write('\nsite | arm | result\n');
  for (const r of results) process.stdout.write(r.site + ' | ' + r.arm + ' | ' + r.result + '\n');

  const staticPass = SITES.filter((s) => results.some((r) => r.site === s.id && r.arm === 'static' && r.result === 'PASS')).length;
  process.stdout.write('\nstatic PASS at ' + staticPass + ' of ' + SITES.length + ' sites; failures: ' + failed + '\n');
  try { fs.rmSync(HERMETIC, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  process.exit(failed === 0 && staticPass === SITES.length ? 0 : 1);
})();
