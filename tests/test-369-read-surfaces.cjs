#!/usr/bin/env node
'use strict';

/**
 * Phase 369-39 (REV369-07, REV369-15) -- the read-surface findings of 369-REVIEW.md.
 *
 *   WR-07  a room_changes cursor beyond the log's latest sequence under the same
 *          epoch answers checkpoint_expired (a room.db restored from a copy can
 *          never leave a browser copy marked current over a gap)
 *   WR-08  the log metadata and the page rows of one room_changes call come from
 *          one read transaction, so a compaction committed between them cannot
 *          drop rows silently; the detector is proved by running the same
 *          interleaving without the transaction and seeing the gap
 *   WR-19  room_search never reads a file through a symbolic link and never a
 *          file whose real path leaves the room
 *
 * Hermetic: temp HOME, USERPROFILE, MINDRIAN_ROOMS_HOME; CLAUDE_ACTIVE_ROOM and
 * CLAUDE_CODE_SESSION_ID unset. Canon Part 9: tests/ is allow-listed for raw SQL;
 * writes under test go through insertNode and the compaction helper on a
 * throwaway fixture. Symlinks are created in the hermetic temp dir only. No
 * literal em-dash or en-dash here (the dash guard builds them at run time).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const HERMETIC = fs.mkdtempSync(path.join(os.tmpdir(), 'test-369-read-surfaces-'));
process.env.HOME = HERMETIC;
process.env.USERPROFILE = HERMETIC;
process.env.MINDRIAN_ROOMS_HOME = path.join(HERMETIC, 'rooms');
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;

const REPO = path.resolve(__dirname, '..');
const ROOMS_HOME = process.env.MINDRIAN_ROOMS_HOME;
const sqlite = require('node:sqlite');
const { openRoomDb, closeRoomDb } = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
const { insertNode } = require(path.join(REPO, 'lib', 'core', 'node-insert.cjs'));
const navigation = require(path.join(REPO, 'lib', 'core', 'navigation.cjs'));
const changeLog = require(path.join(REPO, 'lib', 'core', 'navigation', 'room-change-log.cjs'));
const { writeSessionBinding } = require(path.join(REPO, 'lib', 'core', 'session-binding.cjs'));
const feed = require(path.join(REPO, 'lib', 'mcp', 'tools', 'feed.cjs'));
const roomTools = require(path.join(REPO, 'lib', 'mcp', 'tools', 'room.cjs'));
const { buildRoom369, writeRegistry } = require('./helpers/fixture-room-369.cjs');

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

const captured = new Map();
const fakeServer = {
  registerTool(name, _config, handler) {
    captured.set(name, handler);
  },
};
feed.register(fakeServer, {});
roomTools.register(fakeServer, {});
const roomChanges = captured.get('room_changes');
const roomSearch = captured.get('room_search');

function parse(result) {
  const text = result && result.content && result.content[0] && result.content[0].text;
  assert.ok(typeof text === 'string' && text.length > 0, 'tool call must return text content');
  return JSON.parse(text);
}

const rooms = [];
let roomCounter = 0;
function makeRoom() {
  roomCounter += 1;
  const slug = 'rs-' + roomCounter;
  const built = buildRoom369({
    tmpDir: path.join(ROOMS_HOME, slug),
    slug: slug,
    variant: 'wide',
    migrate: true,
  });
  rooms.push({ slug: slug, roomDir: built.roomDir });
  writeRegistry(ROOMS_HOME, rooms, rooms[0].slug);
  const session = 'sess-' + slug;
  writeSessionBinding(session, { primary: slug, bound: [slug] }, { home: ROOMS_HOME });
  return { slug: slug, roomDir: built.roomDir, session: session };
}

function claim(db, id) {
  insertNode(db, id, 'claim', JSON.stringify({ text: 'claim ' + id }), { epistemic_type: 'observation' });
}

function withWrite(room, fn) {
  const db = openRoomDb(room.roomDir);
  try {
    return fn(db);
  } finally {
    closeRoomDb(db);
  }
}

function changes(room, args) {
  return roomChanges(args, { sessionId: room.session }).then(parse);
}

// Run `fn` while the first prepare() of the change-log ROWS statement first lets
// `before` run (a compaction on a second connection). Restores the prototype.
function withInterleave(before, fn) {
  const proto = sqlite.DatabaseSync.prototype;
  const original = proto.prepare;
  let fired = false;
  proto.prepare = function patched(sql) {
    if (!fired && typeof sql === 'string' && sql.includes('FROM room_change_log WHERE change_seq > ?') && sql.includes('ORDER BY change_seq')) {
      fired = true;
      before();
    }
    return original.call(this, sql);
  };
  try {
    return { result: fn(), fired: () => fired };
  } finally {
    proto.prepare = original;
  }
}

async function main() {
  // ---------------- WR-07 ----------------
  await arm('WR-07a cursor beyond latest_seq under the same epoch answers checkpoint_expired with the head as snapshot_revision', async () => {
    const r = makeRoom();
    withWrite(r, (db) => { claim(db, 'claim:a'); claim(db, 'claim:b'); claim(db, 'claim:c'); });
    const head = await changes(r, { collection: 'nodes' });
    assert.equal(head.ok, true);
    const latest = head.latest_seq;
    assert.ok(latest >= 3, 'fixture has a head, got ' + latest);
    const future = await changes(r, { collection: 'nodes', after: latest + 5000, epoch: head.epoch });
    assert.equal(future.ok, false, 'future cursor must not be ok: ' + JSON.stringify(future).slice(0, 200));
    assert.equal(future.reason, 'checkpoint_expired');
    assert.equal(future.snapshot_revision, latest);
    assert.equal(future.epoch, head.epoch);
    assert.equal(typeof future.floor, 'number');
  });

  await arm('WR-07b cursor equal to latest_seq answers ok with no changes; one above is expired', async () => {
    const r = makeRoom();
    withWrite(r, (db) => { claim(db, 'claim:a'); claim(db, 'claim:b'); });
    const head = await changes(r, { collection: 'nodes' });
    const same = await changes(r, { collection: 'nodes', after: head.latest_seq, epoch: head.epoch });
    assert.equal(same.ok, true, 'cursor at the head is current: ' + JSON.stringify(same).slice(0, 200));
    assert.equal(same.changes.length, 0);
    assert.equal(same.through, head.latest_seq);
    const above = await changes(r, { collection: 'nodes', after: head.latest_seq + 1, epoch: head.epoch });
    assert.equal(above.ok, false);
    assert.equal(above.reason, 'checkpoint_expired');
  });

  // ---------------- WR-08 ----------------
  function seedForCompaction(r) {
    withWrite(r, (db) => {
      db.exec('BEGIN');
      for (let i = 0; i < 40; i += 1) claim(db, 'claim:cmp-' + String(i).padStart(2, '0'));
      db.exec('COMMIT');
    });
  }
  function compactOnSecondConnection(r, keepRows) {
    return () => {
      const db = openRoomDb(r.roomDir);
      try {
        changeLog.compactChangeLog(db, { keepRows: keepRows });
      } finally {
        closeRoomDb(db);
      }
    };
  }

  await arm('WR-08a detector: metadata then rows with no read transaction shows a gap; the same interleave inside BEGIN on the read-only handle does not', async () => {
    const ROWS_SQL = 'SELECT change_seq FROM room_change_log WHERE change_seq > ? ORDER BY change_seq LIMIT ?';
    const readRows = (db) => db.prepare(ROWS_SQL).all(0, 500).map((x) => Number(x.change_seq));

    const bare = makeRoom();
    seedForCompaction(bare);
    const db1 = navigation.openRoomDbReadOnlyForCaller(bare.roomDir);
    try {
      assert.equal(navigation.readChangeLogMeta(db1).floor, 0, 'fixture floor starts at 0');
      const run = withInterleave(compactOnSecondConnection(bare, 10), () => readRows(db1));
      assert.equal(run.fired(), true, 'interleave must fire');
      assert.ok(navigation.readChangeLogMeta(db1).floor > 0, 'compaction raised the floor');
      assert.ok(run.result.length > 0 && Math.min.apply(null, run.result) > 1, 'unguarded rows start above seq 1 (a gap): first ' + Math.min.apply(null, run.result));
    } finally {
      navigation.closeRoomDbForCaller(db1);
    }

    const guarded = makeRoom();
    seedForCompaction(guarded);
    const db2 = navigation.openRoomDbReadOnlyForCaller(guarded.roomDir);
    try {
      db2.exec('BEGIN');
      assert.equal(navigation.readChangeLogMeta(db2).floor, 0);
      const run = withInterleave(compactOnSecondConnection(guarded, 10), () => readRows(db2));
      assert.equal(run.fired(), true, 'interleave must fire');
      db2.exec('COMMIT');
      assert.equal(Math.min.apply(null, run.result), 1, 'inside one read transaction the page still starts at seq 1');
    } finally {
      navigation.closeRoomDbForCaller(db2);
    }
  });

  await arm('WR-08b room_changes across a compaction never returns a gap with an advanced through', async () => {
    const r = makeRoom();
    seedForCompaction(r);
    const head = await changes(r, { collection: 'nodes' });
    assert.equal(head.floor, 0);
    const proto = sqlite.DatabaseSync.prototype;
    const original = proto.prepare;
    let fired = false;
    const compact = compactOnSecondConnection(r, 10);
    proto.prepare = function patched(sql) {
      if (!fired && typeof sql === 'string' && sql.includes('FROM room_change_log WHERE change_seq > ?') && sql.includes('ORDER BY change_seq')) {
        fired = true;
        compact();
      }
      return original.call(this, sql);
    };
    let out;
    try {
      out = await changes(r, { collection: 'nodes', after: 0, epoch: head.epoch, limit: 500 });
    } finally {
      proto.prepare = original;
    }
    assert.equal(fired, true, 'interleave must fire');
    if (out.ok === false) {
      assert.equal(out.reason, 'checkpoint_expired', 'a refusal is checkpoint_expired, got ' + JSON.stringify(out).slice(0, 200));
      return;
    }
    // ok: every retained entity between the cursor and the head is present, contiguous from seq 1.
    const seqs = out.changes.map((c) => c.seq).sort((x, y) => x - y);
    assert.ok(seqs.length > 0, 'a page with rows');
    assert.equal(seqs[0], 1, 'the page starts at the first row after cursor 0, got ' + seqs[0]);
    assert.equal(out.through, head.latest_seq, 'through is the head of the snapshot');
  });

  await arm('WR-08c a cursor overtaken by the floor between calls still answers checkpoint_expired', async () => {
    const r = makeRoom();
    seedForCompaction(r);
    const head = await changes(r, { collection: 'nodes' });
    compactOnSecondConnection(r, 10)();
    const out = await changes(r, { collection: 'nodes', after: 3, epoch: head.epoch });
    assert.equal(out.ok, false);
    assert.equal(out.reason, 'checkpoint_expired');
  });

  // ---------------- WR-19 ----------------
  function searchRoom(r, query) {
    return roomSearch({ query: query }, { sessionId: r.session }).then(parse);
  }

  await arm('WR-19a a symlinked file whose target is outside the room is never read; a plain file is', async () => {
    const r = makeRoom();
    const outside = path.join(HERMETIC, 'outside-secret.md');
    fs.writeFileSync(outside, 'zebrafinch secret line outside the room\n');
    const notes = path.join(r.roomDir, 'notes');
    fs.mkdirSync(notes, { recursive: true });
    fs.symlinkSync(outside, path.join(notes, 'link.md'));
    fs.writeFileSync(path.join(notes, 'real.md'), 'zebrafinch plain line inside the room\n');
    const out = await searchRoom(r, 'zebrafinch');
    const files = out.results.map((x) => x.file);
    assert.ok(files.some((f) => f.endsWith('real.md')), 'the plain file is found: ' + JSON.stringify(files));
    assert.equal(files.some((f) => f.endsWith('link.md')), false, 'the symlinked file must not be read: ' + JSON.stringify(files));
    assert.equal(JSON.stringify(out).includes('outside the room'), false, 'no line from the outside file');
  });

  await arm('WR-19b a symlink to a file inside the room is still not followed (symlinks are skipped)', async () => {
    const r = makeRoom();
    const notes = path.join(r.roomDir, 'notes');
    fs.mkdirSync(notes, { recursive: true });
    fs.writeFileSync(path.join(notes, 'target.md'), 'okapi inside line\n');
    fs.symlinkSync(path.join(notes, 'target.md'), path.join(notes, 'alias.md'));
    const out = await searchRoom(r, 'okapi');
    const files = out.results.map((x) => x.file);
    assert.ok(files.some((f) => f.endsWith('target.md')), 'target found');
    assert.equal(files.some((f) => f.endsWith('alias.md')), false, 'alias skipped: ' + JSON.stringify(files));
  });

  await arm('WR-19c a symlinked directory is skipped', async () => {
    const r = makeRoom();
    const outDir = path.join(HERMETIC, 'outside-dir');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'deep.md'), 'quokka line in an outside directory\n');
    fs.symlinkSync(outDir, path.join(r.roomDir, 'linked-dir'));
    const out = await searchRoom(r, 'quokka');
    assert.equal(out.results.length, 0, 'nothing read through the linked directory: ' + JSON.stringify(out.results));
  });

  await arm('static: no long dash in this file', async () => {
    const src = fs.readFileSync(__filename, 'utf8');
    assert.equal(src.includes(EM) || src.includes(EN), false, 'no em-dash or en-dash');
  });

  console.log('PASS=' + passed + ' FAIL=' + failed);
  try { fs.rmSync(HERMETIC, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.log('FATAL ' + (err && err.stack ? err.stack : err));
  process.exit(1);
});
