#!/usr/bin/env node
'use strict';

/**
 * RCA desktop-session-binding-fallback (.planning/debug/desktop-session-binding-fallback.md)
 * ==========================================================================
 * Navigator ruling 2026-10-02: process key + refuse.
 *
 * The bug, on Claude Desktop (stdio, no session id): room_bind with no sessionId
 * returned no_session_id; an explicit-sessionId bind was orphaned (no later call
 * could present that key); claim_write and the room-state reads then used the
 * machine-wide registry `active` room, so a write could land in a room the
 * navigator never chose, under the id claim:nosession:<hash>.
 *
 * This test drives the REAL stdio server (bin/mindrian-mcp-server.cjs) with a
 * v2 Client shaped like Desktop's handshake (clientInfo claude-ai 0.1.0,
 * protocol 2025-11-25, extensions-only capabilities, no session id), against a
 * throwaway rooms home with room-a (registry active) and room-b present. It is a
 * scripted stand-in, not a human Desktop probe.
 *
 * Arms:
 *   1. bind then act: room_bind {room:'room-b'} with NO sessionId succeeds
 *      (effective, session.primary); status_read, room_state_bound and
 *      room_state read room-b; claim_write lands in room-b's room.db (read
 *      directly) under a non-nosession id; room-a's db was never created. A
 *      gate_render -> gate_answer round trip approves in the same process (the
 *      gate-ledger key resolves the same on mint and consume).
 *   2. nothing bound: every write refuses with the typed reason no_bound_room
 *      ("bind a room first") and room-a is byte-for-byte unchanged; reads may
 *      still show room-a but label it as the registry fallback, never a binding;
 *      a binding-card gate (kind binding) still ratifies without a room write.
 *   3. two Desktop windows (two server processes, one rooms home): a bind in
 *      one is invisible to the other (distinct process keys).
 *   4. explicit sessionId still wins: the binding lands under that key, and the
 *      result honestly says later calls will not carry it.
 *   5. CLI path unchanged: with CLAUDE_CODE_SESSION_ID set the binding is keyed
 *      by that id, no synthetic stdio key is minted, and the claim id carries it.
 *   6. key mechanics (child processes, so this process stays unregistered):
 *      precedence explicit > extra > CLAUDE_CODE_SESSION_ID > stdio key > null;
 *      unregistered stays null (no_session_id preserved for in-process callers);
 *      ledgerSessionKey is unchanged for every input.
 *   7. HTTP flag-OFF is unchanged: no process key is minted on an HTTP request,
 *      so room_bind with no sessionId still answers no_session_id (skipped with
 *      a note when port 3847 is held by something this test did not spawn).
 *
 * Hermetic: HOME and MINDRIAN_ROOMS_HOME are mkdtemp dirs; the real
 * ~/MindrianRooms registry is never touched. Every server this test spawns is
 * SIGKILLed in finally. No em-dashes. CJS.
 */

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');

const { Client } = require('@modelcontextprotocol/client');
const { StdioClientTransport } = require('@modelcontextprotocol/client/stdio');

const REPO_ROOT = path.resolve(__dirname, '..');
const LOCAL_SERVER = path.join(REPO_ROOT, 'bin', 'mindrian-mcp-server.cjs');
const SESSION_BINDING = path.join(REPO_ROOT, 'lib', 'core', 'session-binding.cjs');
const GATE_LEDGER = path.join(REPO_ROOT, 'lib', 'mcp', 'gate-ledger.cjs');

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

// ---------------------------------------------------------------------------
// Fixture: a throwaway rooms home with room-a (registry active) and room-b.
// ---------------------------------------------------------------------------
const cleanups = [];
const spawnedPids = [];

function makeWorld() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'desk-bind-home-'));
  const roomsHome = fs.mkdtempSync(path.join(os.tmpdir(), 'desk-bind-rooms-'));
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'desk-bind-cwd-'));
  cleanups.push(() => {
    for (const d of [home, roomsHome, cwd]) {
      try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
    }
  });
  const roomA = path.join(roomsHome, 'room-a');
  const roomB = path.join(roomsHome, 'room-b');
  for (const [dir, slug] of [[roomA, 'room-a'], [roomB, 'room-b']]) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'STATE.md'), '# ' + slug + ' state marker\n\nSynthetic fixture room.\n');
    fs.writeFileSync(path.join(dir, 'ROOM.md'), '# ' + slug + '\n');
  }
  fs.mkdirSync(path.join(roomsHome, '.rooms'), { recursive: true });
  fs.writeFileSync(
    path.join(roomsHome, '.rooms', 'registry.json'),
    JSON.stringify({
      version: 1,
      active: 'room-a',
      rooms: {
        'room-a': { slug: 'room-a', name: 'room-a', path: 'room-a', status: 'active' },
        'room-b': { slug: 'room-b', name: 'room-b', path: 'room-b', status: 'active' },
      },
    }, null, 2)
  );
  // A born room has a room.db already (openRoomDbForCaller refuses to create one),
  // so give both rooms a real, empty one. Without it a wrong-room write would
  // fail with no_room_db instead of landing, and this test could not tell.
  const { openRoomDb } = require('../lib/core/room-db.cjs');
  for (const dir of [roomA, roomB]) {
    const db = openRoomDb(dir);
    db.close();
  }
  const world = { home, roomsHome, cwd, roomA, roomB };
  world.baseA = roomSnapshot(roomA);
  world.baseB = roomSnapshot(roomB);
  return world;
}

function serverEnv(world, extra) {
  const env = Object.assign({}, process.env);
  for (const k of [
    'MINDRIAN_ROOM', 'MINDRIAN_SESSION_ID', 'CLAUDE_CODE_SESSION_ID', 'MINDRIAN_MCP_FIRST',
    'MINDRIAN_MCP_DAEMON', 'MINDRIAN_BRAIN_KEY', 'CLAUDE_ACTIVE_ROOM', 'CLAUDE_SURFACE',
    'COWORK_SESSION_ID',
  ]) {
    delete env[k];
  }
  env.HOME = world.home;
  env.USERPROFILE = world.home;
  env.MINDRIAN_ROOMS_HOME = world.roomsHome;
  env.MINDRIAN_TRANSPORT = 'stdio';
  env.MINDRIAN_BRAIN_URL = 'http://127.0.0.1:9'; // unreachable loopback, never a real Brain
  return Object.assign(env, extra || {});
}

// The Desktop-shaped client: clientInfo claude-ai 0.1.0, extensions-only
// capabilities, no elicitation, no session id, protocol 2025-11-25 (v2 default).
async function connectDesktop(world, envExtra) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [LOCAL_SERVER],
    env: serverEnv(world, envExtra),
    cwd: world.cwd,
  });
  const client = new Client(
    { name: 'claude-ai', version: '0.1.0' },
    { capabilities: { extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: ['text/html;profile=mcp-app'] } } } }
  );
  const origStart = transport.start.bind(transport);
  transport.start = async function () {
    const r = await origStart();
    if (typeof transport.pid === 'number') spawnedPids.push(transport.pid);
    return r;
  };
  await client.connect(transport);
  if (typeof transport.pid === 'number' && !spawnedPids.includes(transport.pid)) spawnedPids.push(transport.pid);
  return { client, transport };
}

async function closeConn(conn) {
  try { await conn.client.close(); } catch (_e) { /* best effort */ }
  if (typeof conn.transport.pid === 'number') {
    try { process.kill(conn.transport.pid, 'SIGKILL'); } catch (_e) { /* gone */ }
  }
}

function bodyText(result) {
  const text = result && result.content && result.content[0] && result.content[0].text;
  assert.ok(typeof text === 'string' && text.length > 0, 'tool must return text content');
  return text;
}

// Parse the leading JSON object (formatSuggestedNext appends a block after it).
function toolJson(result) {
  const text = bodyText(result);
  const marker = text.indexOf('\n\n## Suggested Next');
  return JSON.parse(marker === -1 ? text : text.slice(0, marker));
}

async function call(conn, name, args) {
  return conn.client.callTool({ name, arguments: args || {} });
}

// Read a room's db directly (read-only). { exists:false } when no room.db.
function roomSnapshot(dir) {
  const p = path.join(dir, '.mindrian', 'room.db');
  if (!fs.existsSync(p)) return { exists: false };
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(p, { readOnly: true });
  try {
    return {
      exists: true,
      nodes: db.prepare('SELECT count(*) AS c FROM nodes').get().c,
      edges: db.prepare('SELECT count(*) AS c FROM edges').get().c,
      claims: db.prepare("SELECT id FROM nodes WHERE type = 'claim' ORDER BY id").all().map((r) => r.id),
    };
  } finally {
    db.close();
  }
}

function sessionFiles(world) {
  const dir = path.join(world.roomsHome, '.rooms', 'sessions');
  try {
    return fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  } catch (_e) {
    return [];
  }
}

function readSessionFile(world, file) {
  return JSON.parse(fs.readFileSync(path.join(world.roomsHome, '.rooms', 'sessions', file), 'utf8'));
}

function realpath(p) {
  try { return fs.realpathSync.native(p); } catch (_e) { return path.resolve(p); }
}

const CLAIM = {
  knowledge_type: 'fact',
  text: 'The surrogate claim must land only in the room the navigator bound.',
  source_segment: 'desktop-binding-seg-1',
};

const GATE_CARD = {
  gate_id: 'gate-desktop-binding-1',
  header: 'Pick one',
  options: [
    { id: 'alpha', label: 'Alpha' },
    { id: 'beta', label: 'Beta' },
  ],
};

// Every write tool the unbound session must be refused on, with minimal valid args.
const WRITE_CALLS = [
  ['claim_write', CLAIM],
  ['memory_event', { label: 'unbound-probe' }],
  ['artifact_file', { section: 'notes', filename: 'unbound-probe', content: '# probe\n' }],
  ['graph_write', { source_id: 'node-x', target_id: 'node-y', edge_type: 'INFORMS' }],
  ['room_content', { command: 'file-opportunity', section: JSON.stringify({ title: 'probe-opportunity', funder: 'probe-funder' }) }],
];

function leaksIntoRoom(dir) {
  // Any file under the room other than the two fixture files means a write landed.
  const seen = [];
  (function walk(d) {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, ent.name);
      if (ent.isDirectory()) walk(full);
      else seen.push(path.relative(dir, full));
    }
  })(dir);
  return seen.filter((f) => f !== 'STATE.md' && f !== 'ROOM.md' && !f.startsWith('.mindrian' + path.sep));
}

function portHeld(port) {
  return new Promise((resolve) => {
    const s = net.connect({ host: '127.0.0.1', port });
    s.once('connect', () => { s.destroy(); resolve(true); });
    s.once('error', () => resolve(false));
  });
}

async function main() {
  // -------------------------------------------------------------------------
  // Arm 1: bind (no sessionId) then act. The Desktop happy path.
  // -------------------------------------------------------------------------
  await test('1a. room_bind with NO sessionId succeeds on Desktop stdio (effective, session.primary)', async () => {
    const world = makeWorld();
    const conn = await connectDesktop(world);
    try {
      const r = await call(conn, 'room_bind', { room: 'room-b' });
      assert.notEqual(r.isError, true, 'room_bind must not error: ' + bodyText(r));
      const j = toolJson(r);
      assert.equal(j.ok, true, 'ok');
      assert.equal(j.bound, true, 'bound');
      assert.equal(j.primary, 'room-b', 'primary');
      assert.equal(j.effective, true, 'effective: a later read in this session must see the binding');
      assert.equal(j.resolved_source, 'session.primary', 'resolved_source');
    } finally {
      await closeConn(conn);
    }
  });

  await test('1b. after the bind, reads follow it (status_read, room_state_bound, room_state) and label it as a binding', async () => {
    const world = makeWorld();
    const conn = await connectDesktop(world);
    try {
      await call(conn, 'room_bind', { room: 'room-b' });

      const status = toolJson(await call(conn, 'status_read', {}));
      assert.equal(realpath(status.segments.room_dir), realpath(world.roomB), 'status_read must report room-b');
      assert.equal(status.segments.room_binding.bound, true, 'status_read must label room-b as a binding');
      assert.equal(status.segments.room_binding.source, 'session.primary');
      assert.equal(status.segments.room_binding.registry_fallback, false);

      const bound = toolJson(await call(conn, 'room_state_bound', {}));
      assert.equal(realpath(bound.room_dir), realpath(world.roomB), 'room_state_bound must report room-b');
      assert.match(bound.state, /room-b state marker/, 'room_state_bound must read room-b STATE.md');
      assert.equal(bound.room_binding.bound, true);

      const rs = bodyText(await call(conn, 'room_state', { command: 'status' }));
      assert.match(rs, /room-b state marker/, 'room_state status must read room-b');
      assert.doesNotMatch(rs, /room-a state marker/, 'room_state status must not read room-a');
      assert.doesNotMatch(rs, /registry fallback/i, 'a bound read carries no registry-fallback label');
    } finally {
      await closeConn(conn);
    }
  });

  await test('1c. claim_write lands in room-b room.db under a non-nosession id; room-a is never touched', async () => {
    const world = makeWorld();
    const conn = await connectDesktop(world);
    try {
      await call(conn, 'room_bind', { room: 'room-b' });
      const r = await call(conn, 'claim_write', CLAIM);
      assert.notEqual(r.isError, true, 'claim_write must succeed once bound: ' + bodyText(r));
      const j = toolJson(r);
      assert.equal(j.ok, true);
      assert.equal(realpath(j.room_dir), realpath(world.roomB), 'the tool must report room-b');

      const b = roomSnapshot(world.roomB);
      assert.equal(b.exists, true, 'room-b room.db must exist');
      assert.equal(b.claims.length, 1, 'exactly one claim in room-b, saw ' + JSON.stringify(b.claims));
      assert.ok(!b.claims[0].startsWith('claim:nosession:'), 'claim id must not be nosession: ' + b.claims[0]);
      assert.equal(j.node_id, b.claims[0], 'the reported node_id is the row in room-b room.db');

      assert.deepEqual(roomSnapshot(world.roomA), world.baseA, 'room-a room.db must be unchanged');
      assert.deepEqual(leaksIntoRoom(world.roomA), [], 'nothing may be written under room-a');

      // The binding file is keyed by a key the model never had to invent.
      const files = sessionFiles(world);
      assert.equal(files.length, 1, 'exactly one session binding file, saw ' + JSON.stringify(files));
      assert.equal(readSessionFile(world, files[0]).primary, 'room-b');
      assert.ok(/^stdio-\d+-[0-9a-f]+\.json$/.test(files[0]), 'process-scoped stdio key expected, saw ' + files[0]);
    } finally {
      await closeConn(conn);
    }
  });

  await test('1d. gate_render -> gate_answer approve succeeds in the same stdio process (gate-ledger key resolves the same on mint and consume)', async () => {
    const world = makeWorld();
    const conn = await connectDesktop(world);
    try {
      await call(conn, 'room_bind', { room: 'room-b' });
      const rendered = toolJson(await call(conn, 'gate_render', GATE_CARD));
      assert.equal(rendered.ok, true, 'gate_render must succeed');
      assert.equal(rendered.gate_id, GATE_CARD.gate_id);
      const answered = await call(conn, 'gate_answer', { gate_id: GATE_CARD.gate_id, chosen: ['alpha'], verdict: 'approve' });
      assert.notEqual(answered.isError, true, 'gate_answer must not error: ' + bodyText(answered));
      const j = toolJson(answered);
      assert.equal(j.ok, true, 'gate_answer ok');
      assert.equal(j.ratified, true, 'approve must ratify');
      assert.notEqual(j.reason, 'session_mismatch');
      // The ratification landed in the bound room, not in room-a.
      assert.ok(roomSnapshot(world.roomB).nodes > 0, 'the ratification must be recorded in room-b');
      assert.deepEqual(roomSnapshot(world.roomA), world.baseA, 'room-a must stay untouched');
    } finally {
      await closeConn(conn);
    }
  });

  // -------------------------------------------------------------------------
  // Arm 2: nothing bound. Writes refuse; reads label the registry fallback.
  // -------------------------------------------------------------------------
  await test('2a. nothing bound: claim_write refuses with no_bound_room and room-a is unchanged', async () => {
    const world = makeWorld();
    const conn = await connectDesktop(world);
    try {
      const before = roomSnapshot(world.roomA);
      const r = await call(conn, 'claim_write', CLAIM);
      assert.equal(r.isError, true, 'an unbound claim_write must be an error result');
      const j = toolJson(r);
      assert.equal(j.ok, false);
      assert.equal(j.reason, 'no_bound_room', 'typed refusal reason');
      assert.match(j.message, /room_bind/, 'the message must tell the model to bind a room first');
      assert.deepEqual(roomSnapshot(world.roomA), before, 'room-a (the registry active room) must be unchanged');
      assert.deepEqual(leaksIntoRoom(world.roomA), [], 'nothing may be written under room-a');
      assert.deepEqual(roomSnapshot(world.roomB), world.baseB, 'room-b must be untouched too');
    } finally {
      await closeConn(conn);
    }
  });

  await test('2b. nothing bound: every write tool refuses with no_bound_room (claim_write, memory_event, artifact_file, graph_write, room_content file-opportunity)', async () => {
    const world = makeWorld();
    const conn = await connectDesktop(world);
    try {
      for (const [name, args] of WRITE_CALLS) {
        const r = await call(conn, name, args);
        assert.equal(r.isError, true, name + ' must refuse when unbound, got: ' + bodyText(r).slice(0, 200));
        const text = bodyText(r);
        let reason = null;
        try { reason = toolJson(r).reason; } catch (_e) { /* router tools may answer in prose */ }
        assert.ok(reason === 'no_bound_room' || /no_bound_room/.test(text), name + ' must carry the typed reason no_bound_room, got: ' + text.slice(0, 200));
      }
      assert.deepEqual(roomSnapshot(world.roomA), world.baseA, 'room-a room.db must be unchanged');
      assert.deepEqual(leaksIntoRoom(world.roomA), [], 'no file may land under room-a');
    } finally {
      await closeConn(conn);
    }
  });

  await test('2c. nothing bound: reads still show room-a but label it the registry fallback, never a binding', async () => {
    const world = makeWorld();
    const conn = await connectDesktop(world);
    try {
      const status = toolJson(await call(conn, 'status_read', {}));
      assert.equal(realpath(status.segments.room_dir), realpath(world.roomA), 'reads may still show the active room');
      assert.equal(status.segments.room_binding.bound, false, 'must not be labelled as a binding');
      assert.equal(status.segments.room_binding.source, 'reg.active');
      assert.equal(status.segments.room_binding.registry_fallback, true);

      const bound = toolJson(await call(conn, 'room_state_bound', {}));
      assert.equal(bound.room_binding.bound, false);
      assert.equal(bound.room_binding.registry_fallback, true);
      assert.match(bound.note, /registry/i, 'a plain-words note must say this is the registry fallback');

      const rs = bodyText(await call(conn, 'room_state', { command: 'status' }));
      assert.match(rs, /registry fallback/i, 'room_state text must carry the registry-fallback label');
      assert.match(rs, /room_bind/, 'and tell the model how to bind');
    } finally {
      await closeConn(conn);
    }
  });

  await test('2d. nothing bound: a binding-card gate still ratifies (the F.8 ceremony must not deadlock) and writes no room', async () => {
    const world = makeWorld();
    const conn = await connectDesktop(world);
    try {
      const rendered = toolJson(await call(conn, 'gate_render', {
        gate_id: 'gate-binding-card-1',
        kind: 'binding',
        ambiguous: true,
        header: 'Which room?',
        options: [{ id: 'room-b', label: 'room-b' }, { id: 'room-a', label: 'room-a' }],
      }));
      assert.equal(rendered.ok, true);
      assert.equal(rendered.suppressed, undefined, 'an ambiguous binding card must render');
      const answered = await call(conn, 'gate_answer', { gate_id: 'gate-binding-card-1', chosen: ['room-b'], verdict: 'approve' });
      assert.notEqual(answered.isError, true, 'binding gate_answer must not refuse: ' + bodyText(answered));
      assert.equal(toolJson(answered).ok, true);
      assert.deepEqual(roomSnapshot(world.roomA), world.baseA, 'the binding ratification must not write into room-a');
      // And the model can now bind and write normally.
      await call(conn, 'room_bind', { room: 'room-b' });
      const r = await call(conn, 'claim_write', CLAIM);
      assert.notEqual(r.isError, true, bodyText(r));
    } finally {
      await closeConn(conn);
    }
  });

  await test('2e. nothing bound: a non-binding gate_answer approve refuses (no silent write to the registry room)', async () => {
    const world = makeWorld();
    const conn = await connectDesktop(world);
    try {
      await call(conn, 'gate_render', GATE_CARD);
      const answered = await call(conn, 'gate_answer', { gate_id: GATE_CARD.gate_id, chosen: ['alpha'], verdict: 'approve' });
      assert.equal(answered.isError, true, 'must refuse when unbound');
      assert.equal(toolJson(answered).reason, 'no_bound_room');
      assert.deepEqual(roomSnapshot(world.roomA), world.baseA, 'room-a must stay untouched');
    } finally {
      await closeConn(conn);
    }
  });

  // -------------------------------------------------------------------------
  // Arm 3: two Desktop windows on one rooms home do not share a binding.
  // -------------------------------------------------------------------------
  await test('3. two windows: a bind in one server process is invisible to the other', async () => {
    const world = makeWorld();
    const c1 = await connectDesktop(world);
    const c2 = await connectDesktop(world);
    try {
      const bind = toolJson(await call(c1, 'room_bind', { room: 'room-b' }));
      assert.equal(bind.effective, true);
      const w1 = await call(c1, 'claim_write', CLAIM);
      assert.notEqual(w1.isError, true, bodyText(w1));
      const w2 = await call(c2, 'claim_write', CLAIM);
      assert.equal(w2.isError, true, 'window 2 never bound a room, so it must refuse');
      assert.equal(toolJson(w2).reason, 'no_bound_room');
      assert.equal(roomSnapshot(world.roomB).claims.length, 1, 'only window 1 wrote');
      assert.deepEqual(roomSnapshot(world.roomA), world.baseA, 'room-a untouched');
    } finally {
      await closeConn(c1);
      await closeConn(c2);
    }
  });

  // -------------------------------------------------------------------------
  // Arm 4: an explicit sessionId still wins, and the result says it will not carry.
  // -------------------------------------------------------------------------
  await test('4. explicit sessionId still wins (binding keyed by it) and the result warns later calls will not carry it', async () => {
    const world = makeWorld();
    const conn = await connectDesktop(world);
    try {
      const r = await call(conn, 'room_bind', { room: 'room-b', sessionId: 'claude-ai-chat-explicit' });
      assert.notEqual(r.isError, true, bodyText(r));
      const j = toolJson(r);
      assert.equal(j.ok, true);
      assert.equal(j.effective, true, 'effective for the explicit key');
      assert.equal(j.carries_to_later_calls, false, 'later calls resolve this connection\'s own key, not the explicit one');
      assert.match(j.warning, /without sessionId/i, 'the warning must say how to bind for this connection');
      assert.deepEqual(sessionFiles(world), ['claude-ai-chat-explicit.json'], 'binding keyed by the explicit id only');
      // The honest consequence: a later write without that key is refused, not misrouted.
      const w = await call(conn, 'claim_write', CLAIM);
      assert.equal(w.isError, true);
      assert.equal(toolJson(w).reason, 'no_bound_room');
      assert.deepEqual(roomSnapshot(world.roomA), world.baseA);
    } finally {
      await closeConn(conn);
    }
  });

  // -------------------------------------------------------------------------
  // Arm 5: CLI path unchanged (CLAUDE_CODE_SESSION_ID wins over the stdio key).
  // -------------------------------------------------------------------------
  await test('5. CLI path: CLAUDE_CODE_SESSION_ID keys the binding (no stdio-* binding file); claim id carries it', async () => {
    const world = makeWorld();
    const conn = await connectDesktop(world, { CLAUDE_CODE_SESSION_ID: 'cli-sess-42' });
    try {
      const j = toolJson(await call(conn, 'room_bind', { room: 'room-b' }));
      assert.equal(j.effective, true);
      assert.equal(j.carries_to_later_calls, true, 'the CLAUDE_CODE_SESSION_ID key carries to later calls');
      assert.equal(j.warning, undefined, 'nothing to warn about when the key carries');
      assert.deepEqual(sessionFiles(world), ['cli-sess-42.json'], 'binding keyed by CLAUDE_CODE_SESSION_ID, no stdio-* file');
      const w = await call(conn, 'claim_write', CLAIM);
      assert.notEqual(w.isError, true, bodyText(w));
      const id = toolJson(w).node_id;
      assert.ok(id.startsWith('claim:cli-sess-42:'), 'claim id carries the CLI session id: ' + id);
      assert.equal(roomSnapshot(world.roomB).claims.length, 1);
      assert.deepEqual(roomSnapshot(world.roomA), world.baseA);
    } finally {
      await closeConn(conn);
    }
  });

  // -------------------------------------------------------------------------
  // Arm 6: key mechanics, in child processes so this process stays unregistered.
  // -------------------------------------------------------------------------
  function evalChild(code, env) {
    const r = cp.spawnSync(process.execPath, ['-e', code], {
      env: Object.assign({}, process.env, { CLAUDE_CODE_SESSION_ID: '' }, env || {}),
      encoding: 'utf8',
    });
    if (r.status !== 0) throw new Error('child failed: ' + (r.stderr || r.stdout));
    return JSON.parse(r.stdout.trim());
  }

  await test('6a. resolveEffectiveSessionId precedence: explicit > extra > CLAUDE_CODE_SESSION_ID > stdio key > null', async () => {
    const out = evalChild(`
      const sb = require(${JSON.stringify(SESSION_BINDING)});
      const res = {};
      res.unregistered = sb.resolveEffectiveSessionId(undefined, undefined);
      const key = sb.registerStdioProcessSession();
      res.key = key;
      res.again = sb.registerStdioProcessSession();
      res.bare = sb.resolveEffectiveSessionId(undefined, {});
      res.extra = sb.resolveEffectiveSessionId(undefined, { sessionId: 'sdk-1' });
      res.explicit = sb.resolveEffectiveSessionId('explicit-1', { sessionId: 'sdk-1' });
      process.env.CLAUDE_CODE_SESSION_ID = 'env-1';
      res.env = sb.resolveEffectiveSessionId(undefined, {});
      res.envOverStdio = sb.resolveEffectiveSessionId(undefined, undefined);
      res.extraOverEnv = sb.resolveEffectiveSessionId(undefined, { sessionId: 'sdk-1' });
      console.log(JSON.stringify(res));
    `);
    assert.equal(out.unregistered, null, 'an unregistered process (HTTP, in-process callers) must still resolve null');
    assert.ok(/^stdio-\d+-[0-9a-f]{8,}$/.test(out.key), 'key shape stdio-<pid>-<hex>: ' + out.key);
    assert.equal(out.again, out.key, 'registering twice returns the same ONE key');
    assert.equal(out.bare, out.key, 'with nothing else, the stdio key resolves');
    assert.equal(out.extra, 'sdk-1');
    assert.equal(out.explicit, 'explicit-1');
    assert.equal(out.env, 'env-1', 'CLAUDE_CODE_SESSION_ID outranks the stdio key');
    assert.equal(out.envOverStdio, 'env-1');
    assert.equal(out.extraOverEnv, 'sdk-1');
  });

  await test('6b. the stdio key is safe as a file name and distinct per process', async () => {
    const code = `const sb=require(${JSON.stringify(SESSION_BINDING)});const k=sb.registerStdioProcessSession();console.log(JSON.stringify({k,safe:sb.isSafeSlug(k)}));`;
    const a = evalChild(code);
    const b = evalChild(code);
    assert.equal(a.safe, true);
    assert.notEqual(a.k, b.k, 'two processes must mint two different keys');
  });

  await test('6c. ledgerSessionKey is unchanged for every input; mint and consume agree on the stdio key', async () => {
    const out = evalChild(`
      const sb = require(${JSON.stringify(SESSION_BINDING)});
      const gl = require(${JSON.stringify(GATE_LEDGER)});
      const key = sb.registerStdioProcessSession();
      const res = {
        pid: process.pid,
        str: gl.ledgerSessionKey('abc'),
        nul: gl.ledgerSessionKey(null),
        und: gl.ledgerSessionKey(undefined),
        empty: gl.ledgerSessionKey(''),
        stdio: gl.ledgerSessionKey(key),
        key,
      };
      const sid = sb.resolveEffectiveSessionId(undefined, {});
      gl.mintGate('g-1', { sessionId: sid, kind: 'general', card: {} });
      const consumed = gl.consumeGate('g-1', sb.resolveEffectiveSessionId(undefined, {}));
      res.roundTrip = !!(consumed && consumed.sessionKey === key);
      console.log(JSON.stringify(res));
    `);
    assert.equal(out.str, 'abc', 'a non-empty string is returned unchanged');
    assert.equal(out.nul, 'no-session:' + out.pid, 'null still collapses to the process sentinel');
    assert.equal(out.und, 'no-session:' + out.pid);
    assert.equal(out.empty, 'no-session:' + out.pid);
    assert.equal(out.stdio, out.key, 'the stdio key passes through unchanged');
    assert.equal(out.roundTrip, true, 'a gate minted and consumed through the resolver round-trips');
  });

  // -------------------------------------------------------------------------
  // Arm 7: HTTP flag-OFF is unchanged: no process key on an HTTP request.
  // -------------------------------------------------------------------------
  await test('7. HTTP flag-OFF: room_bind with no sessionId still answers no_session_id (no process key minted on HTTP)', async () => {
    if (await portHeld(3847)) {
      console.log('    SKIPPED arm 7: port 3847 is held by something this test did not spawn');
      return;
    }
    const world = makeWorld();
    const child = cp.spawn(process.execPath, [LOCAL_SERVER], {
      cwd: world.cwd,
      env: serverEnv(world, { MINDRIAN_TRANSPORT: 'http' }),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    spawnedPids.push(child.pid);
    child.stdout.resume();
    child.stderr.resume();
    try {
      let up = false;
      for (let i = 0; i < 100 && !up; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 100));
        // eslint-disable-next-line no-await-in-loop
        up = await portHeld(3847);
      }
      assert.ok(up, 'the flag-OFF HTTP server must come up on 3847');
      const post = async (body) => {
        const res = await fetch('http://127.0.0.1:3847/mcp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
          body: JSON.stringify(body),
        });
        const text = await res.text();
        const t = text.trim();
        if (t.startsWith('{')) return JSON.parse(t);
        const frame = t.split('\n').find((l) => l.startsWith('data:'));
        return frame ? JSON.parse(frame.slice(5).trim()) : null;
      };
      const init = await post({
        jsonrpc: '2.0', id: 1, method: 'initialize',
        params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'claude-ai', version: '0.1.0' } },
      });
      assert.ok(init && init.result, 'initialize must answer');
      const bind = await post({
        jsonrpc: '2.0', id: 2, method: 'tools/call',
        params: { name: 'room_bind', arguments: { room: 'room-b' } },
      });
      assert.ok(bind && bind.result, 'room_bind must answer');
      assert.match(bind.result.content[0].text, /no_session_id/, 'HTTP flag-OFF has no session identity, so no_session_id is preserved');
      assert.deepEqual(sessionFiles(world), [], 'no binding file may be written on a session-less HTTP request');
    } finally {
      try { process.kill(child.pid, 'SIGKILL'); } catch (_e) { /* gone */ }
    }
  });

  // -------------------------------------------------------------------------
  // Hygiene.
  // -------------------------------------------------------------------------
  await test('process hygiene: no server this test started survives', async () => {
    for (const pid of spawnedPids) {
      try { process.kill(pid, 'SIGKILL'); } catch (_e) { /* gone */ }
    }
    await new Promise((r) => setTimeout(r, 300));
    for (const pid of spawnedPids) {
      let alive = true;
      try { process.kill(pid, 0); } catch (_e) { alive = false; }
      assert.equal(alive, false, 'pid ' + pid + ' (started by this test) is still alive');
    }
  });

  for (const c of cleanups) {
    try { c(); } catch (_e) { /* best effort */ }
  }
  console.log('');
  console.log('RESULT: PASS=' + passed + ' FAIL=' + failed);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('FATAL:', err);
  for (const pid of spawnedPids) {
    try { process.kill(pid, 'SIGKILL'); } catch (_e) { /* gone */ }
  }
  process.exit(1);
});
