#!/usr/bin/env node
'use strict';

/**
 * Phase 369-13 (FEED369-01, D-18) -- the room_changes MCP read tool and the
 * read-only projection reader behind it.
 *
 *   1. paging: 450 claims on `nodes`, pages of 200, contiguous from/through, every
 *      claim exactly once, last page's through equals latest_seq
 *   2. last-state-only: three updates inside one window yield one change
 *   3. deletes: a delete is a row with no document on nodes, artifacts, decisions
 *      and activity
 *   4. routing: a decision node lands on decisions, not nodes; an edge lands on
 *      relations with source, target and type
 *   5. resets: a raised floor answers checkpoint_expired; a wrong epoch answers
 *      epoch_changed; each carries a snapshot revision
 *   6. snapshot then tail: snapshot pages plus the delta from as_of_seq cover the
 *      current table
 *   7. change_log_absent on a room.db the write door never opened; snapshot mode
 *      still answers, and nothing was migrated
 *   8. unbound session (even with a registry active room) answers room_unbound
 *   9. read-only: data_version on a separate connection and the identity table are
 *      unchanged by a room_changes call
 *  10. live: a hermetic flag-ON daemon, a legacy client bound to room-x, room_changes
 *      on nodes answers ok with an epoch
 *  11. static: feed.cjs requires neither room-db.cjs nor node:sqlite and holds no
 *      Brain host or network token; the description is under 600 bytes
 *
 * Hermetic: temp HOME, USERPROFILE, MINDRIAN_ROOMS_HOME; CLAUDE_ACTIVE_ROOM and
 * CLAUDE_CODE_SESSION_ID unset. Canon Part 9: tests/ is allow-listed for raw SQL by
 * the substrate guard; writes under test go through insertNode, writeEdge and
 * plain statements on a throwaway fixture. No literal em-dash or en-dash here
 * (the dash guard builds them at run time). Exit 77 only if the daemon cannot start.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const HERMETIC = fs.mkdtempSync(path.join(os.tmpdir(), 'test-369-room-changes-'));
process.env.HOME = HERMETIC;
process.env.USERPROFILE = HERMETIC;
process.env.MINDRIAN_ROOMS_HOME = path.join(HERMETIC, 'rooms');
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;

const REPO = path.resolve(__dirname, '..');
const ROOMS_HOME = process.env.MINDRIAN_ROOMS_HOME;
const { DatabaseSync } = require('node:sqlite');
const { openRoomDb, closeRoomDb } = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
const { insertNode } = require(path.join(REPO, 'lib', 'core', 'node-insert.cjs'));
const navigation = require(path.join(REPO, 'lib', 'core', 'navigation.cjs'));
const { writeSessionBinding } = require(path.join(REPO, 'lib', 'core', 'session-binding.cjs'));
const feed = require(path.join(REPO, 'lib', 'mcp', 'tools', 'feed.cjs'));
const { buildRoom369, writeRegistry } = require('./helpers/fixture-room-369.cjs');
const D = require('./helpers/mcp-daemon-369.cjs');

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

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

// In-process capture that keeps the registered config (for the description check).
const captured = new Map();
const configs = new Map();
feed.register(
  {
    registerTool(name, config, handler) {
      captured.set(name, handler);
      configs.set(name, config);
    },
  },
  {}
);
const roomChanges = captured.get('room_changes');

function parse(result) {
  const text = result && result.content && result.content[0] && result.content[0].text;
  assert.ok(typeof text === 'string' && text.length > 0, 'tool call must return text content');
  return JSON.parse(text);
}

function call(sessionId, args) {
  return roomChanges(args, { sessionId: sessionId }).then(parse);
}

const rooms = [];
let roomCounter = 0;
// Build a migrated fixture room, register it, and bind a session to it.
function makeRoom(opts) {
  roomCounter += 1;
  const slug = 'rc-' + roomCounter;
  const built = buildRoom369({
    tmpDir: path.join(ROOMS_HOME, slug),
    slug: slug,
    variant: 'wide',
    migrate: !(opts && opts.migrate === false),
  });
  rooms.push({ slug: slug, roomDir: built.roomDir });
  writeRegistry(ROOMS_HOME, rooms, rooms[0].slug);
  const session = 'sess-' + slug;
  writeSessionBinding(session, { primary: slug, bound: [slug] }, { home: ROOMS_HOME });
  return { slug: slug, roomDir: built.roomDir, session: session };
}

function claim(db, id, text) {
  insertNode(db, id, 'claim', JSON.stringify({ text: text || 'claim ' + id }), { epistemic_type: 'observation' });
}

function withWrite(room, fn) {
  const db = openRoomDb(room.roomDir);
  try {
    return fn(db);
  } finally {
    closeRoomDb(db);
  }
}

async function pageAll(session, collection, limit) {
  const pages = [];
  let after = 0;
  let epoch = null;
  for (let guard = 0; guard < 100; guard += 1) {
    const out = await call(session, { collection: collection, after: after, epoch: epoch, limit: limit });
    assert.equal(out.ok, true, 'page ok: ' + JSON.stringify(out).slice(0, 200));
    pages.push(out);
    after = out.through;
    epoch = out.epoch;
    if (!out.has_more) return pages;
  }
  throw new Error('paging did not terminate');
}

async function main() {
  await arm('1 paging: 450 claims in pages of 200, contiguous, each exactly once, ends at latest_seq', async () => {
    const r = makeRoom();
    withWrite(r, (db) => {
      db.exec('BEGIN');
      for (let i = 0; i < 450; i += 1) claim(db, 'claim:page-' + String(i).padStart(3, '0'));
      db.exec('COMMIT');
    });
    const pages = await pageAll(r.session, 'nodes', 200);
    assert.ok(pages.length >= 3, 'at least three pages, got ' + pages.length);
    for (let i = 1; i < pages.length; i += 1) assert.equal(pages[i].from, pages[i - 1].through, 'contiguous from/through');
    const seen = new Map();
    for (const p of pages) {
      assert.ok(p.changes.length <= 200, 'page respects limit');
      for (const ch of p.changes) {
        if (ch.entity_id.startsWith('claim:page-')) seen.set(ch.entity_id, (seen.get(ch.entity_id) || 0) + 1);
      }
    }
    assert.equal(seen.size, 450, 'every claim seen');
    for (const [id, n] of seen) assert.equal(n, 1, id + ' seen exactly once');
    const last = pages[pages.length - 1];
    assert.equal(last.through, last.latest_seq, 'last through equals latest_seq');
    assert.equal(last.has_more, false);
    assert.ok(typeof last.epoch === 'string' && last.epoch.length > 0, 'epoch present');
  });

  await arm('2 last-state-only: three updates in one window yield one change with the final status', async () => {
    const r = makeRoom();
    withWrite(r, (db) => claim(db, 'claim:flip'));
    const start = (await call(r.session, { collection: 'nodes' })).latest_seq;
    withWrite(r, (db) => {
      db.prepare("UPDATE nodes SET review_status = 'needs_evidence' WHERE id = ?").run('claim:flip');
      db.prepare("UPDATE nodes SET review_status = 'stale' WHERE id = ?").run('claim:flip');
      db.prepare("UPDATE nodes SET review_status = 'validated' WHERE id = ?").run('claim:flip');
    });
    const out = await call(r.session, { collection: 'nodes', after: start });
    const rows = out.changes.filter((c) => c.entity_id === 'claim:flip');
    assert.equal(rows.length, 1, 'one change for the entity');
    assert.equal(rows[0].op, 'upsert');
    assert.equal(rows[0].doc.status, 'validated', 'final status');
    assert.equal(rows[0].seq, out.through, 'carries the last seq');
  });

  await arm('3 deletes: a delete is a row with no doc on nodes, artifacts, decisions and activity', async () => {
    const r = makeRoom();
    const start = (await call(r.session, { collection: 'nodes' })).latest_seq;
    withWrite(r, (db) => {
      claim(db, 'claim:gone');
      insertNode(db, 'sec/art-gone/art-gone.md', 'Artifact', JSON.stringify({ title: 'Gone' }), { epistemic_type: 'observation' });
      insertNode(db, 'decision:gone', 'decision', JSON.stringify({ section: 's' }), { epistemic_type: 'decision' });
      insertNode(db, 'memory_event:gone:1:aa', 'memory_event', JSON.stringify({ event_type: 'x' }), { epistemic_type: 'observation' });
      for (const id of ['claim:gone', 'sec/art-gone/art-gone.md', 'decision:gone', 'memory_event:gone:1:aa']) {
        db.prepare('DELETE FROM nodes WHERE id = ?').run(id);
      }
    });
    const expect = {
      nodes: 'claim:gone',
      artifacts: 'sec/art-gone/art-gone.md',
      decisions: 'decision:gone',
      activity: 'memory_event:gone:1:aa',
    };
    for (const collection of Object.keys(expect)) {
      const out = await call(r.session, { collection: collection, after: start });
      const row = out.changes.find((c) => c.entity_id === expect[collection]);
      assert.ok(row, collection + ' carries a row for the deleted node: ' + JSON.stringify(out.changes));
      assert.equal(row.op, 'delete', collection + ' op');
      assert.equal(row.doc, undefined, collection + ' delete has no doc');
    }
  });

  await arm('4 routing: decision on decisions not nodes; edge on relations with source, target, type', async () => {
    const r = makeRoom();
    const start = (await call(r.session, { collection: 'nodes' })).latest_seq;
    withWrite(r, (db) => {
      claim(db, 'claim:edge-a');
      claim(db, 'claim:edge-b');
      insertNode(db, 'decision:route', 'decision', JSON.stringify({ section: 'market', title: 'Pick the wedge' }), { epistemic_type: 'decision' });
      const res = navigation.writeEdge(db, { source_id: 'claim:edge-a', target_id: 'claim:edge-b', edge_type: 'SUPPORTS', properties: { origin: 'test' } });
      assert.equal(res.ok, true, 'edge written: ' + JSON.stringify(res));
    });
    const nodes = await call(r.session, { collection: 'nodes', after: start });
    const decisions = await call(r.session, { collection: 'decisions', after: start });
    const relations = await call(r.session, { collection: 'relations', after: start });
    assert.ok(!nodes.changes.some((c) => c.entity_id === 'decision:route'), 'decision not on nodes');
    assert.ok(nodes.changes.some((c) => c.entity_id === 'claim:edge-a'), 'claim on nodes');
    const d = decisions.changes.find((c) => c.entity_id === 'decision:route');
    assert.ok(d && d.doc && d.doc.title === 'Pick the wedge', 'decision doc on decisions');
    assert.equal(relations.changes.length, 1, 'one relation change');
    const e = relations.changes[0];
    assert.equal(e.entity_type, 'edge');
    assert.equal(e.doc.source, 'claim:edge-a');
    assert.equal(e.doc.target, 'claim:edge-b');
    assert.equal(e.doc.type, 'SUPPORTS');
  });

  await arm('5 resets: raised floor answers checkpoint_expired, wrong epoch answers epoch_changed, each with a snapshot revision', async () => {
    const r = makeRoom();
    withWrite(r, (db) => { for (let i = 0; i < 5; i += 1) claim(db, 'claim:reset-' + i); });
    const base = await call(r.session, { collection: 'nodes' });
    assert.ok(base.latest_seq >= 5);
    withWrite(r, (db) => {
      db.prepare('INSERT OR REPLACE INTO identity (key, value, updated_at) VALUES (?, ?, ?)')
        .run('change_log_floor', String(base.latest_seq), new Date().toISOString());
    });
    const expired = await call(r.session, { collection: 'nodes', after: base.latest_seq - 1, epoch: base.epoch });
    assert.equal(expired.ok, false);
    assert.equal(expired.reason, 'checkpoint_expired');
    assert.equal(expired.snapshot_revision, base.latest_seq);
    assert.equal(expired.floor, base.latest_seq);
    const fine = await call(r.session, { collection: 'nodes', after: base.latest_seq, epoch: base.epoch });
    assert.equal(fine.ok, true, 'a cursor at the floor is not expired');
    const wrong = await call(r.session, { collection: 'nodes', after: base.latest_seq, epoch: 'not-this-epoch' });
    assert.equal(wrong.ok, false);
    assert.equal(wrong.reason, 'epoch_changed');
    assert.equal(wrong.epoch, base.epoch);
    assert.equal(wrong.snapshot_revision, base.latest_seq);
  });

  await arm('6 snapshot then tail: pages plus the delta from as_of_seq cover the current table', async () => {
    const r = makeRoom();
    withWrite(r, (db) => { for (let i = 0; i < 30; i += 1) claim(db, 'claim:snap-' + String(i).padStart(2, '0')); });
    const docs = new Map();
    let cursor;
    let asOf = null;
    let pageNo = 0;
    for (let guard = 0; guard < 20; guard += 1) {
      const out = await call(r.session, { collection: 'nodes', mode: 'snapshot', limit: 10, snapshot_cursor: cursor });
      assert.equal(out.ok, true, 'snapshot ok: ' + JSON.stringify(out).slice(0, 200));
      if (asOf === null) asOf = out.as_of_seq;
      assert.equal(out.as_of_seq, asOf, 'one as_of_seq across pages');
      for (const d of out.docs) docs.set(d.id, d);
      pageNo += 1;
      if (pageNo === 1) {
        withWrite(r, (db) => { for (let i = 0; i < 5; i += 1) claim(db, 'claim:snap-late-' + i); });
      }
      if (out.done) break;
      cursor = out.next_cursor;
      assert.ok(typeof cursor === 'string' && cursor.length > 0, 'next_cursor while not done');
    }
    const tail = await call(r.session, { collection: 'nodes', after: asOf, limit: 500 });
    for (const ch of tail.changes) if (ch.op === 'upsert') docs.set(ch.entity_id, ch.doc);
    const raw = new DatabaseSync(path.join(r.roomDir, '.mindrian', 'room.db'), { readOnly: true });
    let current;
    try {
      current = raw.prepare('SELECT id, type FROM nodes').all()
        .filter((n) => navigation.collectionForNodeType(n.type, n.id) === 'nodes')
        .map((n) => n.id).sort();
    } finally {
      raw.close();
    }
    assert.deepEqual([...docs.keys()].sort(), current, 'union equals the current table');
    for (let i = 0; i < 5; i += 1) assert.ok(docs.has('claim:snap-late-' + i), 'late claim ' + i + ' present');
  });

  await arm('7 change_log_absent on a room.db the write door never opened; snapshot mode still answers; nothing migrated', async () => {
    const r = makeRoom({ migrate: false });
    const delta = await call(r.session, { collection: 'nodes' });
    assert.equal(delta.ok, false);
    assert.equal(delta.reason, 'change_log_absent');
    assert.equal(delta.snapshot_required, true);
    const snap = await call(r.session, { collection: 'nodes', mode: 'snapshot' });
    assert.equal(snap.ok, true, 'snapshot answers: ' + JSON.stringify(snap).slice(0, 200));
    assert.equal(snap.epoch, null);
    assert.equal(snap.as_of_seq, 0);
    assert.ok(snap.docs.some((d) => d.id === 'section:test-subject'), 'the seeded subject node is in the snapshot');
    const raw = new DatabaseSync(path.join(r.roomDir, '.mindrian', 'room.db'), { readOnly: true });
    try {
      const has = raw.prepare("SELECT 1 AS x FROM sqlite_master WHERE name = 'room_change_log'").get();
      assert.equal(has, undefined, 'the read door did not migrate the room');
    } finally {
      raw.close();
    }
  });

  await arm('8 unbound session answers room_unbound, even with a registry active room', async () => {
    makeRoom();
    const out = await call('sess-never-bound', { collection: 'nodes' });
    assert.equal(out.ok, false);
    assert.equal(out.reason, 'room_unbound');
    const none = await roomChanges({ collection: 'nodes' }, {}).then(parse);
    assert.equal(none.reason, 'room_unbound', 'no session at all is unbound too');
  });

  await arm('9 read-only: data_version on a separate connection and the identity table are unchanged', async () => {
    const r = makeRoom();
    withWrite(r, (db) => claim(db, 'claim:ro'));
    const probe = new DatabaseSync(path.join(r.roomDir, '.mindrian', 'room.db'));
    try {
      const idSql = 'SELECT key, value, updated_at FROM identity ORDER BY key';
      const dv = () => probe.prepare('PRAGMA data_version').get().data_version;
      const before = { dv: dv(), identity: JSON.stringify(probe.prepare(idSql).all()), seq: probe.prepare('SELECT MAX(change_seq) AS m FROM room_change_log').get().m };
      await call(r.session, { collection: 'nodes' });
      await call(r.session, { collection: 'nodes', mode: 'snapshot' });
      await call(r.session, { collection: 'relations' });
      const after = { dv: dv(), identity: JSON.stringify(probe.prepare(idSql).all()), seq: probe.prepare('SELECT MAX(change_seq) AS m FROM room_change_log').get().m };
      assert.deepEqual(after, before, 'room_changes wrote nothing');
    } finally {
      probe.close();
    }
  });

  await arm('10 live: legacy client bound to room-x calls room_changes on nodes, ok with an epoch', async () => {
    let h;
    try {
      h = await D.startDaemon({
        rooms: [{ slug: 'room-x', variant: 'wide', migrate: true, seed: [{ kind: 'claim', text: 'A live feed claim for the shell.' }] }],
      });
    } catch (err) {
      console.log('SKIP: daemon could not start (' + (err && err.message ? err.message : err) + ')');
      process.exit(77);
    }
    let client = null;
    try {
      client = await D.legacyClient(h.port, 'mindrian-shell');
      const bind = parse(await client.client.callTool({ name: 'room_bind', arguments: { room: 'room-x' } }).then((res) => {
        const text = res.content[0].text;
        const marker = text.indexOf('\n\n## Suggested Next');
        return { content: [{ type: 'text', text: marker === -1 ? text : text.slice(0, marker) }] };
      }));
      assert.equal(bind.ok, true, 'bind ok');
      const out = parse(await client.client.callTool({ name: 'room_changes', arguments: { collection: 'nodes' } }));
      assert.equal(out.ok, true, 'room_changes ok: ' + JSON.stringify(out).slice(0, 300));
      assert.ok(typeof out.epoch === 'string' && out.epoch.length > 0, 'epoch present');
      assert.ok(out.changes.length >= 1, 'the seeded claim is in the feed');
      assert.equal(out.room, 'room-x');
    } finally {
      if (client) { try { await client.close(); } catch (_e) { /* best effort */ } }
      await D.stopDaemon(h);
    }
  });

  await arm('11 static: no room-db or node:sqlite in feed.cjs, no Brain host or network token, description under 600 bytes', async () => {
    const file = path.join(REPO, 'lib', 'mcp', 'tools', 'feed.cjs');
    const src = fs.readFileSync(file, 'utf8');
    assert.equal(/require\(['"](node:sqlite|[^'"]*room-db)/.test(src), false, 'no room-db or node:sqlite require');
    for (const token of ['brain-client', 'brain-router', 'mindrian-brain', 'theo-mcp', 'onrender', "require('http", "require('node:http", "require('https", 'fetch(']) {
      assert.equal(src.includes(token), false, 'forbidden token: ' + token);
    }
    assert.equal(src.includes(EM) || src.includes(EN), false, 'no em-dash or en-dash');
    const description = configs.get('room_changes').description;
    const bytes = Buffer.byteLength(description, 'utf8');
    console.log('  room_changes description bytes=' + bytes);
    assert.ok(bytes < 600, 'description under 600 bytes, got ' + bytes);
    assert.equal(description.includes(EM) || description.includes(EN), false, 'description has no long dash');
    assert.equal(feed.connectors.length, 1);
    assert.equal(feed.connectors[0].hitl_shape, 'none');
    assert.equal(feed.connectors[0].layer, 'harness');
  });

  console.log('PASS=' + passed + ' FAIL=' + failed);
  try { fs.rmSync(HERMETIC, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.log('FATAL ' + (err && err.stack ? err.stack : err));
  process.exit(1);
});
