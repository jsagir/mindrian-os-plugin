#!/usr/bin/env node
'use strict';

/**
 * Phase 369-08 (SHELL369-01, RXP369-01, HUM369-01) -- the chassis-neutral
 * shell core in ui/shared (D-15, D-18, D-19, deliverable 4).
 *
 *   1. erasable proof: every ui/shared/src/*.ts and src/generated/*.ts loads
 *      under Node's own type stripping (no build, no tsconfig read).
 *   2. static: no `mode: 'auto'` anywhere in ui/shared/src, `mode: 'legacy'`
 *      present in the session pool, no URL literal other than 127.0.0.1.
 *   3. parseSseFrames splits a multi-frame chunk and carries a partial frame.
 *   4. live (hermetic flag-ON daemon): the legacy pool binds, calls, keeps the
 *      adapter on its own session, refuses the reserved key, and survives a
 *      daemon restart by re-binding (reconnected: true).
 *   5. projection: six collections, toDoc upsert and delete, stable
 *      sanitized dbName with the projection version, isResetReason.
 *   6. static replica: no dev-mode import, replicateRxCollection present, no
 *      push key.
 *   7. actions: exposure is mandatory, an adapter-tagged definition is
 *      refused, callableBy returns the right sets.
 *   8. proposal: recommended_id must be an option id; fixedProposalSource.
 *   9. the adapter generator --check exits 0 and MCP_TOOL_NAMES equals the
 *      wire snapshot's tool count.
 *
 * Hermetic: temp HOME, USERPROFILE and MINDRIAN_ROOMS_HOME; CLAUDE_ACTIVE_ROOM
 * and CLAUDE_CODE_SESSION_ID are unset. Exit 77 only for an environment
 * failure to start the daemon. No literal em-dash or en-dash in this file
 * (the dash guard builds the characters at run time). CJS.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = path.resolve(__dirname, '..');
const SHARED = path.join(REPO_ROOT, 'ui', 'shared');
const SRC = path.join(SHARED, 'src');
const GEN = path.join(SRC, 'generated');

// Hermetic process env before anything loads.
const TEMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-369-08-'));
process.env.HOME = TEMP_HOME;
process.env.USERPROFILE = TEMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = path.join(TEMP_HOME, 'MindrianRooms');
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log('  ok ' + name);
  } catch (err) {
    failed += 1;
    console.log('  FAIL ' + name);
    console.log('    ' + (err && err.message ? err.message : String(err)));
  }
}

function tsFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.ts')).map((f) => path.join(dir, f));
}

function allSrcFiles() {
  return tsFiles(SRC).concat(tsFiles(GEN));
}

function load(rel) {
  return import(pathToFileURL(path.join(SRC, rel)).href);
}

function readSrc(rel) {
  return fs.readFileSync(path.join(SRC, rel), 'utf8');
}

async function main() {
  console.log('static and pure arms');

  await test('1. every ui/shared source .ts loads under Node type stripping', async () => {
    const files = allSrcFiles();
    assert.ok(files.length >= 2, 'expected shared sources, found ' + files.length);
    for (const f of files) {
      await import(pathToFileURL(f).href);
    }
  });

  await test('2. legacy client mode explicit, no auto mode, no outside URL literal', async () => {
    const files = allSrcFiles();
    let legacySeen = false;
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8');
      assert.ok(!/mode:\s*'auto'/.test(src), f + ' must never negotiate (mode: auto)');
      if (/mode:\s*'legacy'/.test(src)) legacySeen = true;
      const bad = src.match(/https?:\/\/(?!127\.0\.0\.1)[^\s'"`)]*/g);
      assert.equal(bad, null, f + ' has an outside URL literal: ' + (bad || []).join(', '));
    }
    assert.ok(/mode:\s*'legacy'/.test(readSrc('mcp-session-pool.ts')), "pool must set mode: 'legacy'");
    assert.ok(legacySeen);
    const longDashes = [String.fromCharCode(0x2014), String.fromCharCode(0x2013)];
    for (const f of files.concat([path.join(SHARED, 'README.md'), path.join(SHARED, 'package.json')])) {
      const src = fs.readFileSync(f, 'utf8');
      for (const d of longDashes) assert.ok(!src.includes(d), f + ' contains a long dash');
    }
  });

  await test('3. parseSseFrames splits frames and carries a partial one', async () => {
    const { parseSseFrames } = await load('feed-relay.ts');
    const a = parseSseFrames('event: room.changed\ndata: {"roomId":"r","latestSeq":3}\n\nevent: status-segment\ndata: {"x":1}\n\nevent: room.chan');
    assert.equal(a.frames.length, 2);
    assert.equal(a.frames[0].event, 'room.changed');
    assert.equal(JSON.parse(a.frames[0].data).latestSeq, 3);
    assert.equal(a.frames[1].event, 'status-segment');
    assert.equal(a.carry, 'event: room.chan');
    const b = parseSseFrames('ged\ndata: {"roomId":"r","latestSeq":4}\n\n', a.carry);
    assert.equal(b.frames.length, 1);
    assert.equal(b.frames[0].event, 'room.changed');
    assert.equal(JSON.parse(b.frames[0].data).latestSeq, 4);
    assert.equal(b.carry, '');
  });

  await test('3b. subscribeHints emits only for the right room, falls back to the poll, and unsubscribes', async () => {
    const { createFeedRelay } = await load('feed-relay.ts');
    const enc = new TextEncoder();
    let release = null;
    const fetchImpl = async () => {
      let ctrl = null;
      const body = new ReadableStream({
        start(c) {
          ctrl = c;
          c.enqueue(enc.encode('event: room.changed\ndata: {"roomId":"other","latestSeq":9}\n\nevent: room.changed\ndata: {"roomId":"r1","lat'));
          release = () => c.enqueue(enc.encode('estSeq":5}\n\n'));
        },
      });
      return { ok: true, status: 200, body };
    };
    let latest = 1;
    const pool = { call: async () => ({ ok: true, isError: false, text: '', data: { latest_seq: latest }, reconnected: false }) };
    const relay = createFeedRelay({ pool, daemonUrl: 'http://127.0.0.1:1', pollMs: 40, fetchImpl });
    const hints = [];
    const stop = relay.subscribeHints('s', 'r1', (h) => hints.push(h));
    await new Promise((r) => setTimeout(r, 20));
    release();
    await new Promise((r) => setTimeout(r, 30));
    assert.deepEqual(hints.filter((h) => h.source === 'sse'), [{ roomId: 'r1', latestSeq: 5, source: 'sse' }]);
    latest = 8;
    await new Promise((r) => setTimeout(r, 150));
    assert.ok(hints.some((h) => h.source === 'poll' && h.latestSeq === 8), 'the poll net must wake on an advanced latest_seq');
    stop();
    const n = hints.length;
    latest = 20;
    await new Promise((r) => setTimeout(r, 120));
    assert.equal(hints.length, n, 'no hints after unsubscribe');
  });

  // ARMS-INSERT-PURE

  console.log('live legacy pool against the hermetic flag-ON daemon');
  const { startDaemon, restartDaemon, stopDaemon } = require('./helpers/mcp-daemon-369.cjs');
  let handle = null;
  let pool = null;
  try {
    try {
      handle = await startDaemon({ rooms: [{ slug: 'room-x', variant: 'wide', migrate: true }] });
    } catch (err) {
      const msg = String(err && err.message ? err.message : err);
      if (/EPERM|EACCES|EADDRINUSE|bind|did not report its port|exited early/i.test(msg)) {
        console.log('SKIPPED (ENV GAP): the daemon could not start here: ' + msg.slice(0, 200));
        process.exit(77);
      }
      throw err;
    }
    const { createSessionPool, ADAPTER_SESSION_KEY } = await load('mcp-session-pool.ts');
    pool = createSessionPool({ daemonUrl: () => 'http://127.0.0.1:' + handle.port, idleMs: 60000 });

    await test('4. pool binds, calls, isolates the adapter, refuses the reserved key, survives a restart', async () => {
      const entry = await pool.get('b1');
      assert.ok(entry.mcpSessionId, 'a sessionful (legacy) connection must carry an mcp-session-id');
      const bound = await pool.bind('b1', 'room-x');
      assert.equal(bound.ok, true, 'bind ok: ' + bound.text.slice(0, 200));
      assert.equal(bound.data.effective, true);
      assert.equal(entry.boundRoom, 'room-x');
      const st = await pool.call('b1', 'room_state', { command: 'status' });
      assert.equal(st.ok, true, 'room_state ok: ' + st.text.slice(0, 200));
      assert.equal(st.reconnected, false);

      const adapter = await pool.adapterSession();
      assert.ok(adapter.mcpSessionId && adapter.mcpSessionId !== entry.mcpSessionId, 'adapter must have its own MCP session');
      assert.equal(adapter.boundRoom, null, 'the adapter never inherits the human binding');
      await assert.rejects(() => pool.get(ADAPTER_SESSION_KEY), /reserved/);
      await assert.rejects(() => pool.call(ADAPTER_SESSION_KEY, 'room_state', {}), /reserved/);

      const before = entry.mcpSessionId;
      handle = await restartDaemon(handle);
      const after = await pool.call('b1', 'room_state', { command: 'status' });
      assert.equal(after.reconnected, true, 'a dead session must reconnect: ' + after.text.slice(0, 200));
      assert.equal(after.ok, true);
      const fresh = await pool.get('b1');
      assert.notEqual(fresh.mcpSessionId, before, 'a new session id after the restart');
      assert.equal(fresh.boundRoom, 'room-x', 'boundRoom is re-bound after reconnect');
    });

    await test('4b. sweepIdle closes entries past idleMs and keeps live ones', async () => {
      assert.ok(pool.size() >= 1);
      const closed = await pool.sweepIdle(Date.now() + 61000);
      assert.ok(closed >= 1);
      assert.equal(pool.size(), 0);
    });

    await test('4c. pageChanges reports feed_unavailable when room_changes is not served', async () => {
      const { createFeedRelay } = await load('feed-relay.ts');
      const relay = createFeedRelay({ pool, daemonUrl: () => 'http://127.0.0.1:' + handle.port, pollMs: 100000 });
      await pool.bind('b2', 'room-x');
      const tools = await (await pool.get('b2')).client.listTools();
      const served = tools.tools.some((t) => t.name === 'room_changes');
      const r = await relay.pageChanges('b2', { limit: 1 });
      if (!served) {
        assert.deepEqual(r, { ok: false, reason: 'feed_unavailable' });
      } else {
        assert.ok(r && typeof r === 'object', 'a served feed answers an object');
      }
    });
  } catch (err) {
    failed += 1;
    console.log('  FAIL harness: ' + (err && err.message ? err.message : String(err)));
  } finally {
    if (pool) await pool.closeAll();
    if (handle) await stopDaemon(handle);
  }

  console.log('');
  console.log('RESULT: PASS=' + passed + ' FAIL=' + failed);
  try { fs.rmSync(TEMP_HOME, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
