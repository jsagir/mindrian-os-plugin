#!/usr/bin/env node
'use strict';

/**
 * Phase 369-17 (FEED369-03, FEED369-05, D-18) -- the room.changed wake-up and the
 * daemon-side room watcher behind it.
 *
 *   1. vocabulary: EVENT_KINDS[3] is room.changed, the first three unchanged
 *   2. cross-process: a child process commits a claim through the write door; an
 *      in-process subscriber receives exactly one room.changed whose latestSeq equals
 *      the room's new max change_seq (latency recorded, counts only)
 *   3. quiet: no write for 1500 ms, no room.changed
 *   4. a write through a second in-process connection also publishes
 *   5. idle stop: with idleMs 300 the watcher is gone from _state after 1200 ms and
 *      its handle is closed
 *   6. live daemon: a legacy client bound to room-x calls room_changes (starting the
 *      watcher); GET /event is read as SSE frames; a child write to room-x yields a
 *      room.changed frame within 2000 ms whose data has exactly roomId and latestSeq
 *   7. static: room-watcher.cjs requires only node:fs, node:path, navigation.cjs and
 *      sse-event-bus.cjs, and holds no Brain or network token
 *
 * Hermetic: temp HOME, USERPROFILE, MINDRIAN_ROOMS_HOME; CLAUDE_ACTIVE_ROOM and
 * CLAUDE_CODE_SESSION_ID unset. Canon Part 9: tests/ is allow-listed for raw SQL; the
 * writes under test go through the write door (insertNode). No literal em-dash or
 * en-dash here (the dash guard builds them at run time). Exit 77 only if the daemon
 * cannot start.
 */

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const HERMETIC = fs.mkdtempSync(path.join(os.tmpdir(), 'test-369-sse-room-changed-'));
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
const bus = require(path.join(REPO, 'lib', 'mcp', 'sse-event-bus.cjs'));
const watcher = require(path.join(REPO, 'lib', 'mcp', 'room-watcher.cjs'));
const { buildRoom369 } = require('./helpers/fixture-room-369.cjs');
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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// A subscriber that records every frame the bus publishes to it.
function collector() {
  const frames = [];
  const res = {
    write(str) {
      frames.push(str);
    },
  };
  bus.subscribe(res);
  return {
    frames: frames,
    parsed() {
      return frames
        .map((f) => {
          const m = /^event: (.*)\ndata: (.*)\n\n$/s.exec(f);
          return m ? { kind: m[1], data: JSON.parse(m[2]) } : null;
        })
        .filter(Boolean);
    },
    roomChanged() {
      return this.parsed().filter((p) => p.kind === 'room.changed');
    },
  };
}

async function waitFor(pred, timeoutMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (pred()) return Date.now() - t0;
    await sleep(10);
  }
  return -1;
}

let counter = 0;
function makeRoom() {
  counter += 1;
  const slug = 'rw-' + counter;
  const built = buildRoom369({
    tmpDir: path.join(ROOMS_HOME, slug),
    slug: slug,
    variant: 'wide',
    migrate: true,
  });
  return { slug: slug, roomDir: built.roomDir };
}

function maxSeq(roomDir) {
  const db = new DatabaseSync(path.join(roomDir, '.mindrian', 'room.db'), { readOnly: true });
  try {
    const row = db.prepare('SELECT MAX(change_seq) AS m FROM room_change_log').get();
    return Number(row.m);
  } finally {
    db.close();
  }
}

// A child process that commits one claim through the write door. Async so this
// process's event loop keeps running and the watcher can fire.
function childWrite(roomDir, id, env) {
  const script =
    "const { openRoomDb, closeRoomDb } = require(" + JSON.stringify(path.join(REPO, 'lib', 'core', 'room-db.cjs')) + ");" +
    "const { insertNode } = require(" + JSON.stringify(path.join(REPO, 'lib', 'core', 'node-insert.cjs')) + ");" +
    "const db = openRoomDb(" + JSON.stringify(roomDir) + ");" +
    "try { insertNode(db, " + JSON.stringify(id) + ", 'claim', JSON.stringify({ text: 'child write ' + " + JSON.stringify(id) + " }), { epistemic_type: 'observation' }); } finally { closeRoomDb(db); }";
  return new Promise((resolve, reject) => {
    const child = cp.spawn('node', ['-e', script], {
      env: Object.assign({}, env || process.env, { HOME: HERMETIC, USERPROFILE: HERMETIC }),
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let err = '';
    child.stderr.on('data', (c) => { err += c.toString('utf8'); });
    child.once('error', reject);
    child.once('exit', (code) => (code === 0 ? resolve() : reject(new Error('child write failed (' + code + '): ' + err.slice(-300)))));
  });
}

// Read an SSE response body as frames; resolves the reader handle.
function sseReader(response) {
  const frames = [];
  const decoder = new TextDecoder();
  let buf = '';
  const reader = response.body.getReader();
  (async () => {
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) return;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf('\n\n')) !== -1) {
          const raw = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const ev = /^event: (.*)$/m.exec(raw);
          const data = /^data: (.*)$/m.exec(raw);
          if (ev && data) {
            let parsed = null;
            try { parsed = JSON.parse(data[1]); } catch (_e) { /* ignore */ }
            frames.push({ kind: ev[1], data: parsed });
          }
        }
      }
    } catch (_e) {
      /* aborted */
    }
  })();
  return { frames: frames, cancel: () => reader.cancel().catch(() => {}) };
}

function parseTool(res) {
  const text = res.content[0].text;
  const marker = text.indexOf('\n\n## Suggested Next');
  return JSON.parse(marker === -1 ? text : text.slice(0, marker));
}

async function main() {
  await arm('1 vocabulary: room.changed is the fourth kind, the first three unchanged', async () => {
    assert.deepEqual(Array.from(bus.EVENT_KINDS), ['status-segment', 'gate-fired', 'reconcile-raised', 'room.changed']);
    assert.equal(bus.EVENT_KINDS[3], 'room.changed');
  });

  await arm('2 cross-process: a child commit publishes exactly one room.changed with the new max seq', async () => {
    const r = makeRoom();
    const sub = collector();
    const res = watcher.ensureWatching({ roomId: r.slug, roomDir: r.roomDir });
    assert.equal(res.watching, true, 'watching: ' + JSON.stringify(res));
    const t0 = Date.now();
    await childWrite(r.roomDir, 'claim:xproc-1');
    const waited = await waitFor(() => sub.roomChanged().length >= 1, 1500);
    assert.ok(waited >= 0, 'a room.changed arrived within 1500 ms');
    const latency = Date.now() - t0;
    await sleep(700);
    const got = sub.roomChanged();
    assert.equal(got.length, 1, 'exactly one room.changed, got ' + got.length);
    assert.deepEqual(Object.keys(got[0].data).sort(), ['latestSeq', 'roomId']);
    assert.equal(got[0].data.roomId, r.slug);
    assert.equal(got[0].data.latestSeq, maxSeq(r.roomDir), 'latestSeq equals the new max change_seq');
    console.log('  cross-process latency (child spawn + commit + wake-up) ms=' + latency + ', wake-up after exit ms=' + waited);
    watcher.stopWatching(r.slug);
  });

  await arm('3 quiet: no write for 1500 ms publishes nothing', async () => {
    const r = makeRoom();
    const sub = collector();
    watcher.ensureWatching({ roomId: r.slug, roomDir: r.roomDir });
    await sleep(1500);
    assert.equal(sub.roomChanged().length, 0, 'no room.changed without a write');
    watcher.stopWatching(r.slug);
  });

  await arm('4 a write through a second in-process connection also publishes', async () => {
    const r = makeRoom();
    const sub = collector();
    watcher.ensureWatching({ roomId: r.slug, roomDir: r.roomDir });
    const db = openRoomDb(r.roomDir);
    try {
      insertNode(db, 'claim:inproc-1', 'claim', JSON.stringify({ text: 'in process' }), { epistemic_type: 'observation' });
    } finally {
      closeRoomDb(db);
    }
    const waited = await waitFor(() => sub.roomChanged().length >= 1, 1500);
    assert.ok(waited >= 0, 'a room.changed arrived');
    assert.equal(sub.roomChanged()[0].data.latestSeq, maxSeq(r.roomDir));
    watcher.stopWatching(r.slug);
  });

  await arm('5 idle stop: the watcher is gone and its handle closed after the idle window', async () => {
    const r = makeRoom();
    const res = watcher.ensureWatching({ roomId: r.slug, roomDir: r.roomDir, idleMs: 300 });
    assert.equal(res.watching, true);
    const entry = watcher._state.get(r.slug);
    assert.ok(entry && entry.db, 'watcher holds a handle while active');
    await sleep(1200);
    assert.equal(watcher._state.has(r.slug), false, 'watcher dropped from _state');
    assert.equal(entry.db, null, 'handle closed');
    assert.equal(entry.watch, null, 'fs watch closed');
    assert.equal(entry.timer, null, 'poll timer cleared');
    // A repeated ensureWatching restarts it.
    assert.equal(watcher.ensureWatching({ roomId: r.slug, roomDir: r.roomDir }).watching, true);
    watcher.stopAll();
    assert.equal(watcher._state.size, 0, 'stopAll empties the map');
  });

  await arm('6 live daemon: a child write to room-x yields a room.changed frame on GET /event with only roomId and latestSeq', async () => {
    let h;
    try {
      h = await D.startDaemon({
        rooms: [{ slug: 'room-x', variant: 'wide', migrate: true, seed: [{ kind: 'claim', text: 'A live wake-up claim.' }] }],
      });
    } catch (err) {
      console.log('SKIP: daemon could not start (' + (err && err.message ? err.message : err) + ')');
      process.exit(77);
    }
    let client = null;
    let ac = null;
    let reader = null;
    try {
      ac = new AbortController();
      const response = await fetch('http://127.0.0.1:' + h.port + '/event', { signal: ac.signal });
      assert.equal(response.status, 200, '/event answers 200');
      reader = sseReader(response);

      client = await D.legacyClient(h.port, 'mindrian-shell');
      const bind = parseTool(await client.client.callTool({ name: 'room_bind', arguments: { room: 'room-x' } }));
      assert.equal(bind.ok, true, 'bind ok');
      const first = parseTool(await client.client.callTool({ name: 'room_changes', arguments: { collection: 'nodes' } }));
      assert.equal(first.ok, true, 'room_changes ok (starts the watcher)');
      await sleep(200);

      const t0 = Date.now();
      await childWrite(h.roomDirs['room-x'], 'claim:live-1', h.env);
      const waited = await waitFor(() => reader.frames.some((f) => f.kind === 'room.changed'), 2000);
      assert.ok(waited >= 0, 'a room.changed frame arrived within 2000 ms; frames=' + JSON.stringify(reader.frames).slice(0, 300));
      const frame = reader.frames.find((f) => f.kind === 'room.changed');
      assert.deepEqual(Object.keys(frame.data).sort(), ['latestSeq', 'roomId'], 'exactly roomId and latestSeq');
      assert.equal(frame.data.roomId, 'room-x');
      assert.equal(frame.data.latestSeq, maxSeq(h.roomDirs['room-x']));
      console.log('  live /event latency (child spawn + commit + frame) ms=' + (Date.now() - t0));
    } finally {
      if (reader) await reader.cancel();
      if (ac) { try { ac.abort(); } catch (_e) { /* best effort */ } }
      if (client) { try { await client.close(); } catch (_e) { /* best effort */ } }
      await D.stopDaemon(h);
    }
  });

  await arm('7 static: room-watcher.cjs requires only the four allowed modules and holds no Brain or network token', async () => {
    const file = path.join(REPO, 'lib', 'mcp', 'room-watcher.cjs');
    const src = fs.readFileSync(file, 'utf8');
    const required = Array.from(src.matchAll(/require\(['"]([^'"]+)['"]\)/g)).map((m) => m[1]).sort();
    assert.deepEqual(required, ['../core/navigation.cjs', './sse-event-bus.cjs', 'node:fs', 'node:path']);
    assert.equal(/require\(['"](node:sqlite|[^'"]*room-db)/.test(src), false, 'no room-db or node:sqlite require');
    for (const token of ['brain-client', 'brain-router', 'mindrian-brain', 'theo-mcp', 'onrender', 'node:http', 'https', 'fetch(']) {
      assert.equal(src.includes(token), false, 'forbidden token: ' + token);
    }
    assert.equal(src.includes(EM) || src.includes(EN), false, 'no em-dash or en-dash');
    assert.ok(src.split('\n').length >= 80, 'at least 80 lines');
  });

  watcher.stopAll();
  console.log('PASS=' + passed + ' FAIL=' + failed);
  try { fs.rmSync(HERMETIC, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  process.exit(failed === 0 ? 0 : 1);
}

main();
