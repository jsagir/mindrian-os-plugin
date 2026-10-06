#!/usr/bin/env node
'use strict';
/*
 * 369.25 plan 14 (RID-07, RID-08): the working sequence, end to end, on the shipped doors.
 *
 * Brief section 4 "Done means a working sequence": create, register, bind, inspect, governed write, read back,
 * restart, inspect again. Each step below drives the door a user reaches:
 *
 *   W1  create     a child process runs birthRoom the way commands/ignite.md:186 calls it (node -e, the session id from
 *                  the environment, approvedBy set) and returns ok:true with a room_id
 *   W2  register   registry.json lists the slug with that room_id
 *   W3  bind       the real stdio MCP server (bin/mindrian-mcp-server.cjs) binds the room: effective true, same room_id
 *                  (a different session id than the birth session, so the bind is a real step, not a repeat)
 *   W4  inspect    status_read over the same server: room_binding.bound true, the same room_id
 *   W5  write      artifact_file lands in a section of that room; the result names the same room_id
 *   W6  read back  a different door (the read-only door on a copy, own SQL) finds the artifact node; the file is on
 *                  disk under the identified room
 *   W7  restart    the server process this test spawned is stopped; a new one is spawned with the same
 *                  CLAUDE_CODE_SESSION_ID; status resolves the same room with the same room_id
 *   W8  again      the artifact is still found; readRoomIdentity is ready with the same seven values as after W1
 *
 * Windows path shape (RID-08), what this host can run:
 *   WIN1  normalizeRoomPath (win32) makes the backslash, forward-slash and Git Bash /c/ forms of one folder equal;
 *         readRoomIdentity (platform win32) on an identity stored in the backslash form of the folder is ready,
 *         and the same stored value under the host platform is identity_path_mismatch (the leg discriminates)
 *   WIN2  room-registry: update on a registry entry whose path is a Git Bash /c/Users/... path keeps the entry and its
 *         path and writes room_id; the registry script's own normwin function, run with sys.platform set to win32,
 *         turns /c/Users/Ann/MindrianRooms/x into C:\Users\Ann\MindrianRooms\x
 *   WIN3  SKIPPED (untested): the read door on a backslash Windows path ('file:' + path + '?mode=ro'), and the whole
 *         sequence on a Windows host, need a Windows host (RESEARCH Pitfall 14, LOW)
 *   MAC1  SKIPPED (untested): the macOS leg (python 3.9 floor on a real Mac) needs a macOS host
 *
 * A step that cannot run here throws Skip: it prints SKIPPED (untested) by name and is counted apart from PASSED.
 *
 * Hermetic: every home is a mkdtemp directory under the OS temp dir (tests/helpers/isolated-home-36925.cjs), the
 * navigator's real ~/MindrianRooms and ~/.mindrian are never touched, and the only processes stopped are the server
 * processes this test spawned (by their own pid, never by name or port).
 * Hyphens only. CJS.
 */
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const H = require('./helpers/isolated-home-36925.cjs');
const { Client } = require('@modelcontextprotocol/client');
const { StdioClientTransport } = require('@modelcontextprotocol/client/stdio');

const LOCAL_SERVER = path.join(ROOT, 'bin', 'mindrian-mcp-server.cjs');
const IDENTITY = require(path.join(ROOT, 'lib', 'core', 'navigation', 'room-identity.cjs'));
const SPINE = require(path.join(ROOT, 'lib', 'core', 'navigation', 'spine-events.cjs'));

class Skip extends Error {}
let passed = 0;
let failed = 0;
let skipped = 0;
async function leg(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log('PASS ' + name);
  } catch (e) {
    if (e instanceof Skip) { skipped += 1; console.log('SKIPPED (untested) ' + name + ': ' + e.message); return; }
    failed += 1;
    console.log('FAIL ' + name + '\n    ' + String((e && e.message) || e).split('\n').join('\n    '));
  }
}

const SLUG = 'ws-room';
const BIRTH_SESSION = 'ws-birth-session-14';
const MCP_SESSION = 'ws-mcp-session-14';
const ARTIFACT_BODY = '---\ntitle: Working sequence artifact\n---\n# Working sequence artifact\n\nFiled by the 369.25-14 acceptance test.\n';

const iso = H.mkIsolatedHome('ws14');
const spawnedPids = [];

function serverEnv() {
  const env = Object.assign({}, process.env);
  for (const k of [
    'MINDRIAN_ROOM', 'MINDRIAN_SESSION_ID', 'CLAUDE_CODE_SESSION_ID', 'MINDRIAN_MCP_FIRST', 'MINDRIAN_MCP_DAEMON',
    'MINDRIAN_BRAIN_KEY', 'CLAUDE_ACTIVE_ROOM', 'CLAUDE_SURFACE', 'COWORK_SESSION_ID', 'CLAUDE_SESSION_ID',
  ]) delete env[k];
  env.HOME = iso.home;
  env.USERPROFILE = iso.home;
  env.MINDRIAN_ROOMS_HOME = iso.roomsHome;
  env.MINDRIAN_TRANSPORT = 'stdio';
  env.MINDRIAN_BRAIN_URL = 'http://127.0.0.1:9'; // unreachable loopback, never a real Brain
  env.CLAUDE_CODE_SESSION_ID = MCP_SESSION;
  return env;
}

async function connect() {
  const transport = new StdioClientTransport({ command: process.execPath, args: [LOCAL_SERVER], env: serverEnv(), cwd: iso.home });
  const client = new Client(
    { name: 'claude-code', version: '2.1.0' },
    { capabilities: {} }
  );
  const origStart = transport.start.bind(transport);
  transport.start = async function () {
    const r = await origStart();
    if (typeof transport.pid === 'number') spawnedPids.push(transport.pid);
    return r;
  };
  await client.connect(transport);
  if (typeof transport.pid === 'number' && !spawnedPids.includes(transport.pid)) spawnedPids.push(transport.pid);
  return { client, transport, pid: transport.pid };
}

// Stop only the process this test spawned, by the pid its transport reported.
async function stopServer(conn) {
  try { await conn.client.close(); } catch (_e) { /* best effort */ }
  if (typeof conn.pid === 'number') { try { process.kill(conn.pid, 'SIGKILL'); } catch (_e) { /* gone */ } }
}

function bodyJson(result) {
  const text = result && result.content && result.content[0] && result.content[0].text;
  assert.ok(typeof text === 'string' && text.length > 0, 'tool must return text content');
  const marker = text.indexOf('\n\n## Suggested Next');
  return JSON.parse(marker === -1 ? text : text.slice(0, marker));
}
async function call(conn, name, args) { return conn.client.callTool({ name: name, arguments: args || {} }); }

// A reader that does not use room-identity.cjs: the read-only door on a throwaway copy, own SQL.
function copyReader(roomDir) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), '36925-ws-copy-'));
  let db = null;
  try {
    fs.mkdirSync(path.join(tmp, '.mindrian'));
    ['', '-wal', '-shm'].forEach((suffix) => {
      const src = path.join(roomDir, '.mindrian', 'room.db' + suffix);
      if (fs.existsSync(src)) fs.copyFileSync(src, path.join(tmp, '.mindrian', 'room.db' + suffix));
    });
    db = SPINE.openRoomDbReadOnlyForCaller(tmp);
    assert.ok(db, 'the read-only door returned no handle');
    return {
      identity: db.prepare('SELECT key, value FROM identity').all(),
      artifactNodes: db.prepare("SELECT id, source_path FROM nodes WHERE id LIKE 'claim:artifact%'").all(),
    };
  } finally {
    try { SPINE.closeRoomDbForCaller(db); } catch (_e) { /* best effort */ }
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
}

function readRegistry() {
  return JSON.parse(fs.readFileSync(path.join(iso.roomsHome, '.rooms', 'registry.json'), 'utf8'));
}

function sevenValues(id) {
  return IDENTITY.IDENTITY_KEYS.map((k) => k + '=' + id[k.slice('room.'.length)]).join('|');
}

(async function main() {
  const state = { roomDir: path.join(iso.roomsHome, SLUG), roomId: null, afterW1: null, artifactId: null, artifactPath: null };
  let conn = null;
  let conn2 = null;
  const savedEnv = {};
  for (const k of ['HOME', 'USERPROFILE', 'MINDRIAN_ROOMS_HOME', 'CLAUDE_CODE_SESSION_ID', 'MINDRIAN_ACTIVE_SESSION_ID']) savedEnv[k] = process.env[k];
  // The in-process libraries (readRoomIdentity's registry check) must see the isolated rooms home.
  process.env.HOME = iso.home;
  process.env.USERPROFILE = iso.home;
  process.env.MINDRIAN_ROOMS_HOME = iso.roomsHome;
  delete process.env.CLAUDE_CODE_SESSION_ID;
  delete process.env.MINDRIAN_ACTIVE_SESSION_ID;

  try {
    await leg('W1 create: birthRoom in the ignite shape (child process) returns ok:true and a room_id', async () => {
      const opts = {
        slug: SLUG, roomDir: state.roomDir, ventureText: 'A venture for the working sequence', jtbd: '',
        canonicalRole: 'founder', vname: SLUG, vstage: 'Pre-Opportunity',
      };
      // the shape of commands/ignite.md:186: birthRoom({...opts, approvedBy, sessionId: process.env.CLAUDE_SESSION_ID})
      const code = "const {birthRoom}=require(" + JSON.stringify(path.join(ROOT, 'lib', 'core', 'navigation', 'room-birth.cjs')) + ");"
        + "const opts=JSON.parse(process.env.WS_OPTS);"
        + "const r=birthRoom(Object.assign({}, opts, {approvedBy:'ws-14-test', sessionId: process.env.CLAUDE_SESSION_ID}));"
        + "process.stdout.write('\\nWS_RESULT ' + JSON.stringify(r) + '\\n');";
      const env = Object.assign({}, iso.env, { WS_OPTS: JSON.stringify(opts), CLAUDE_SESSION_ID: BIRTH_SESSION });
      const r = cp.spawnSync(process.execPath, ['-e', code], { env: env, cwd: iso.home, encoding: 'utf8', timeout: 120000 });
      assert.equal(r.status, 0, 'child exit ' + r.status + ' stderr: ' + String(r.stderr).slice(0, 400));
      const line = String(r.stdout).split('\n').filter((l) => l.startsWith('WS_RESULT ')).pop();
      assert.ok(line, 'no WS_RESULT line in: ' + String(r.stdout).slice(0, 300));
      const res = JSON.parse(line.slice('WS_RESULT '.length));
      assert.equal(res.ok, true, 'birth ok: ' + JSON.stringify(res).slice(0, 300));
      assert.ok(typeof res.room_id === 'string' && res.room_id.length > 0, 'birth result has no room_id');
      state.roomId = res.room_id;
      const id = IDENTITY.readRoomIdentity(state.roomDir);
      assert.equal(id.state, 'ready', 'identity after birth: ' + JSON.stringify(id).slice(0, 300));
      assert.equal(id.room_id, state.roomId, 'identity room_id vs the birth result');
      state.afterW1 = sevenValues(id);
    });

    await leg('W2 register: registry.json lists the slug with that room_id', async () => {
      assert.ok(state.roomId, 'W1 did not produce a room_id');
      const reg = readRegistry();
      assert.ok(reg.rooms && reg.rooms[SLUG], 'registry has no entry for ' + SLUG);
      assert.equal(reg.rooms[SLUG].room_id, state.roomId, 'registry room_id');
      assert.equal(reg.rooms[SLUG].path, state.roomDir, 'registry path');
    });

    await leg('W3 bind: the real stdio server binds the room (effective true, the same room_id)', async () => {
      assert.ok(state.roomId, 'W1 did not produce a room_id');
      conn = await connect();
      const before = bodyJson(await call(conn, 'status_read', {}));
      assert.equal(before.segments.room_binding.bound, false, 'this session was not bound before room_bind: ' + JSON.stringify(before.segments.room_binding));
      const j = bodyJson(await call(conn, 'room_bind', { room: SLUG }));
      assert.equal(j.ok, true, 'room_bind ok: ' + JSON.stringify(j).slice(0, 300));
      assert.equal(j.effective, true, 'effective');
      assert.equal(j.room_id, state.roomId, 'room_bind room_id');
    });

    await leg('W4 inspect: status_read shows room_binding.bound true and the same room_id', async () => {
      assert.ok(conn, 'W3 did not connect');
      const s = bodyJson(await call(conn, 'status_read', {}));
      assert.equal(s.segments.room_binding.bound, true, 'bound: ' + JSON.stringify(s.segments.room_binding));
      assert.equal(s.segments.room_binding.room_id, state.roomId, 'status room_id: ' + JSON.stringify(s.segments.room_binding));
      assert.equal(fs.realpathSync(s.segments.room_dir), fs.realpathSync(state.roomDir), 'status room_dir');
    });

    await leg('W5 governed write: artifact_file lands in a section of that room and names the same room_id', async () => {
      assert.ok(conn, 'W3 did not connect');
      const j = bodyJson(await call(conn, 'artifact_file', { section: 'problem-definition', filename: 'ws-artifact', content: ARTIFACT_BODY }));
      assert.equal(j.ok, true, 'artifact_file ok: ' + JSON.stringify(j).slice(0, 400));
      assert.equal(j.room_id, state.roomId, 'artifact_file room_id');
      assert.equal(fs.realpathSync(j.room_dir), fs.realpathSync(state.roomDir), 'artifact_file room_dir');
      assert.ok(j.artifact_id, 'no artifact_id in the result');
      state.artifactId = j.artifact_id;
      state.artifactPath = path.join(state.roomDir, 'problem-definition', 'ws-artifact.md');
    });

    await leg('W6 read back: a different door finds the artifact node and the file is on disk in the identified room', async () => {
      assert.ok(state.artifactId, 'W5 did not file an artifact');
      assert.ok(fs.existsSync(state.artifactPath), 'file missing: ' + state.artifactPath);
      assert.ok(fs.readFileSync(state.artifactPath, 'utf8').includes('Filed by the 369.25-14 acceptance test'), 'file body');
      const seen = copyReader(state.roomDir);
      const mine = seen.artifactNodes.filter((n) => String(n.source_path) === 'artifact:' + state.artifactId);
      assert.equal(mine.length, 1, 'artifact nodes with source_path artifact:' + state.artifactId + ': ' + JSON.stringify(seen.artifactNodes));
      const roomIdRow = seen.identity.find((r) => r.key === 'room.room_id');
      assert.ok(roomIdRow && roomIdRow.value === state.roomId, 'the copy reader sees room.room_id ' + JSON.stringify(roomIdRow));
      // the file sits under the folder whose room.db carries that room_id
      assert.ok(state.artifactPath.startsWith(state.roomDir + path.sep), 'artifact path is not under the room dir');
    });

    await leg('W7 restart: a new server process with the same session id resolves the same room and room_id', async () => {
      assert.ok(conn, 'W3 did not connect');
      const firstPid = conn.pid;
      assert.equal(typeof firstPid, 'number', 'the first server reported no pid');
      await stopServer(conn);
      conn = null;
      conn2 = await connect();
      assert.notEqual(conn2.pid, firstPid, 'the second server must be a new process');
      const s = bodyJson(await call(conn2, 'status_read', {}));
      assert.equal(s.segments.room_binding.bound, true, 'bound after restart: ' + JSON.stringify(s.segments.room_binding));
      assert.equal(s.segments.room_binding.room_id, state.roomId, 'room_id after restart: ' + JSON.stringify(s.segments.room_binding));
      assert.equal(fs.realpathSync(s.segments.room_dir), fs.realpathSync(state.roomDir), 'room_dir after restart');
    });

    await leg('W8 inspect again: the artifact is still found and the seven identity values are unchanged', async () => {
      assert.ok(state.artifactId && state.afterW1, 'earlier steps did not complete');
      const seen = copyReader(state.roomDir);
      assert.equal(seen.artifactNodes.filter((n) => String(n.source_path) === 'artifact:' + state.artifactId).length, 1, 'artifact node after restart');
      assert.ok(fs.existsSync(state.artifactPath), 'file after restart');
      const id = IDENTITY.readRoomIdentity(state.roomDir);
      assert.equal(id.state, 'ready', 'identity after restart: ' + JSON.stringify(id).slice(0, 300));
      assert.equal(sevenValues(id), state.afterW1, 'seven values moved');
    });
  } finally {
    if (conn) await stopServer(conn);
    if (conn2) await stopServer(conn2);
  }

  // ----- Windows path shape ---------------------------------------------------------------------------------------
  await leg('WIN1 normalizeRoomPath (win32) makes the three forms equal; readRoomIdentity (win32) accepts the backslash form', async () => {
    const forms = ['C:\\Users\\Ann\\MindrianRooms\\x', 'c:/Users/Ann/MindrianRooms/x/', '/c/Users/Ann/MindrianRooms/x'];
    const norm = forms.map((f) => IDENTITY.normalizeRoomPath(f, { platform: 'win32' }));
    assert.equal(new Set(norm).size, 1, 'normalized forms differ: ' + JSON.stringify(norm));
    assert.equal(norm[0], 'C:\\Users\\Ann\\MindrianRooms\\x', 'canonical form');

    const iso2 = H.mkIsolatedHome('ws14-win');
    const born = H.birthFixtureRoom({ iso: iso2, slug: 'win-room' });
    assert.equal(born.ok, true, 'fixture birth');
    process.env.MINDRIAN_ROOMS_HOME = iso2.roomsHome;
    const real = fs.realpathSync(born.roomDir);
    const ready = IDENTITY.readRoomIdentity(born.roomDir);
    assert.equal(ready.state, 'ready', 'fixture identity before the rewrite');
    // store the canonical path in the backslash form of the same folder (what a Windows host writes)
    const db = require(path.join(ROOT, 'lib', 'core', 'room-db.cjs')).openRoomDb(born.roomDir);
    try {
      db.prepare('UPDATE identity SET value = ? WHERE key = ?').run(real.replace(/\//g, '\\'), 'room.canonical_path');
    } finally { db.close(); }
    const win = IDENTITY.readRoomIdentity(born.roomDir, { platform: 'win32', roomsHome: iso2.roomsHome });
    assert.equal(win.state, 'ready', 'win32 compare of the backslash form: ' + JSON.stringify(win).slice(0, 300));
    const host = IDENTITY.readRoomIdentity(born.roomDir, { roomsHome: iso2.roomsHome });
    assert.equal(host.state, 'not_ready', 'the host platform must refuse the backslash form (control)');
    assert.equal(host.reason, 'identity_path_mismatch', 'control reason');
    process.env.MINDRIAN_ROOMS_HOME = iso.roomsHome;
  });

  await leg('WIN2 room-registry keeps a /c/Users/... path entry and writes room_id; normwin maps it under sys.platform win32', async () => {
    const iso3 = H.mkIsolatedHome('ws14-reg');
    const regDir = path.join(iso3.roomsHome, '.rooms');
    fs.mkdirSync(regDir, { recursive: true });
    const gitBashPath = '/c/Users/Ann/MindrianRooms/x';
    fs.writeFileSync(path.join(regDir, 'registry.json'), JSON.stringify({
      version: 1, active: 'x',
      rooms: { x: { path: gitBashPath, status: 'active', venture_name: 'x' } },
    }, null, 2));
    const script = path.join(ROOT, 'scripts', 'room-registry');
    const r = cp.spawnSync('bash', [script, 'update', 'x', 'room_id', 'ws-room-id-win2'], {
      encoding: 'utf8', timeout: 20000, env: Object.assign({}, iso3.env),
    });
    assert.equal(r.status, 0, 'room-registry update exit ' + r.status + ' stderr: ' + String(r.stderr).slice(0, 300));
    const reg = JSON.parse(fs.readFileSync(path.join(regDir, 'registry.json'), 'utf8'));
    assert.ok(reg.rooms.x, 'entry x was dropped');
    assert.equal(reg.rooms.x.path, gitBashPath, 'the /c/ path was rewritten');
    assert.equal(reg.rooms.x.room_id, 'ws-room-id-win2', 'room_id not written');
    assert.equal(reg.active, 'x', 'active moved');

    // the registry script's own normwin, extracted from its text and run with sys.platform and os.sep set as on Windows
    const py = cp.spawnSync('python3', ['--version'], { encoding: 'utf8' });
    if (py.error || py.status !== 0) throw new Skip('no python3 on this host for the normwin probe');
    const src = fs.readFileSync(script, 'utf8');
    const m = /^def normwin\(p\):\n(?:    .*\n)+/m.exec(src);
    assert.ok(m, 'no normwin definition found in scripts/room-registry');
    const probe = 'import os, sys\nsys.platform = "win32"\nos.sep = "\\\\"\n' + m[0]
      + 'print(normwin("/c/Users/Ann/MindrianRooms/x"))\nprint(normwin("C:\\\\Users\\\\Ann"))\nprint(normwin("relative/p"))\n';
    const out = cp.spawnSync('python3', ['-c', probe], { encoding: 'utf8' });
    assert.equal(out.status, 0, 'probe exit ' + out.status + ' ' + String(out.stderr).slice(0, 200));
    const lines = String(out.stdout).trim().split('\n');
    assert.equal(lines[0], 'C:\\Users\\Ann\\MindrianRooms\\x', 'normwin of the Git Bash form: ' + lines[0]);
    assert.equal(lines[1], 'C:\\Users\\Ann', 'normwin leaves a native path alone');
    assert.equal(lines[2], 'relative/p', 'normwin leaves a relative path alone');
  });

  await leg('WIN3 the read door on a backslash Windows path, and the whole sequence on a Windows host', async () => {
    if (process.platform === 'win32') throw new Skip('this test does not run the Windows host legs even on win32 yet');
    throw new Skip('untested: needs a Windows host (RESEARCH Pitfall 14: file: + path + ?mode=ro with backslashes)');
  });

  await leg('MAC1 the macOS leg (python 3.9 floor on a real Mac)', async () => {
    throw new Skip('untested: needs a macOS host');
  });

  // ----- dash guard ------------------------------------------------------------------------------------------------
  await leg('DG dash guard: this file has no em dash or en dash', async () => {
    const bad = H.dashGuard([__filename]);
    assert.deepEqual(bad, [], 'dash found in ' + bad.join(', '));
  });

  for (const k of Object.keys(savedEnv)) { if (savedEnv[k] === undefined) delete process.env[k]; else process.env[k] = savedEnv[k]; }
  console.log('\nPASSED=' + passed + ' FAILED=' + failed + ' SKIPPED=' + skipped + ' (SKIPPED legs are untested, never passed)');
  process.exit(failed === 0 ? 0 : 1);
})().catch((e) => {
  console.log('FATAL ' + String((e && e.stack) || e));
  for (const pid of spawnedPids) { try { process.kill(pid, 'SIGKILL'); } catch (_e) { /* gone */ } }
  process.exit(1);
});
