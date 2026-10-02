#!/usr/bin/env node
'use strict';

/**
 * Phase 267 Plan 15 (MCPV2-06, MCPV2-01) -- the two in-repo MCP clients on the
 * v2 client package.
 * ==========================================================================
 * bin/mindrian-mcp-shim.cjs (stdio <-> daemon bridge) and
 * lib/mcp/adapter-client.cjs (hook-side queryDaemon) move to
 * @modelcontextprotocol/client and keep the DEFAULT 2025-era handshake (no
 * versionNegotiation), which the daemon's sessionful legacy path serves.
 *
 * Arms:
 *   1. source: both files require @modelcontextprotocol/client (the shim also
 *      @modelcontextprotocol/server/stdio), neither requires
 *      @modelcontextprotocol/sdk on a code line, adapter-client never mentions
 *      versionNegotiation. RED on the v1 clients.
 *   2. shim, unbound (no MINDRIAN_SESSION_ID): a raw 2025-11-25 initialize is
 *      answered at 2025-11-25, tools/list count equals the snapshot count,
 *      room_bind creates exactly one new session binding file naming room-x.
 *   3. RCA 7 pin: with MINDRIAN_SESSION_ID set the daemon still rejects the
 *      shim's pre-seeded id (400 No valid session ID provided) and no
 *      initialize response reaches stdout. Pinned, not fixed, in this phase
 *      (.planning/debug/mcp-shim-preseeded-session-id-rejected.md); a future
 *      fix flips this arm deliberately.
 *   4. adapter-client: queryDaemon('contract_version') twice, each opens and
 *      terminates its own session.
 *
 * Hygiene: one hermetic home; the daemon PID from its pidfile and every
 * spawned shim are SIGKILLed in finally. No em-dashes. CJS.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const cp = require('node:child_process');
const { hermeticEnv, rpcOverStdio } = require('./helpers/mcp-wire-267.cjs');

const REPO_ROOT = path.resolve(__dirname, '..');
const SHIM = path.join(REPO_ROOT, 'bin', 'mindrian-mcp-shim.cjs');
const ADAPTER = path.join(REPO_ROOT, 'lib', 'mcp', 'adapter-client.cjs');

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

function codeLines(file) {
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l));
}

function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return !(e && e.code === 'ESRCH');
  }
}

function sessionFiles(roomsHome) {
  const dir = path.join(roomsHome, '.rooms', 'sessions');
  try {
    return fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  } catch (_e) {
    return [];
  }
}

function parseToolJson(text) {
  const marker = text.indexOf('\n\n## Suggested Next');
  return JSON.parse(marker === -1 ? text : text.slice(0, marker));
}

// Sequential stdio driver: the shim forwards messages verbatim, so a client
// must wait for the initialize response before sending anything else (the
// helper's pipelined rpcOverStdio races the daemon's handshake through a
// bridge). Resolves { responses: Map(id -> msg), stderr }; always SIGKILLs the
// shim it spawned.
function driveShim(env, calls, timeoutMs) {
  return new Promise((resolve) => {
    const child = cp.spawn('node', [SHIM], { cwd: REPO_ROOT, env, stdio: ['pipe', 'pipe', 'pipe'] });
    const responses = new Map();
    let stdoutBuf = '';
    let stderr = '';
    let done = false;
    const send = (m) => {
      try {
        child.stdin.write(JSON.stringify(m) + '\n');
      } catch (_e) {
        /* shim gone */
      }
    };
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try {
        child.stdin.end();
      } catch (_e) {
        /* closed */
      }
      try {
        process.kill(child.pid, 'SIGKILL');
      } catch (_e) {
        /* gone */
      }
      resolve({ responses, stderr });
    };
    const timer = setTimeout(finish, timeoutMs);
    let nextIdx = 0;
    const sendNext = () => {
      if (nextIdx >= calls.length) return;
      const c = calls[nextIdx];
      nextIdx += 1;
      send({ jsonrpc: '2.0', id: nextIdx + 1, method: c.method, params: c.params || {} });
    };
    child.stdout.on('data', (chunk) => {
      stdoutBuf += chunk.toString('utf8');
      let nl;
      while ((nl = stdoutBuf.indexOf('\n')) !== -1) {
        const line = stdoutBuf.slice(0, nl).trim();
        stdoutBuf = stdoutBuf.slice(nl + 1);
        if (!line) continue;
        let obj;
        try {
          obj = JSON.parse(line);
        } catch (_e) {
          continue;
        }
        if (!obj || obj.id === undefined || obj.id === null) continue;
        responses.set(obj.id, obj);
        if (obj.id === 1) send({ jsonrpc: '2.0', method: 'notifications/initialized' });
        if (responses.size >= calls.length + 1) finish();
        else sendNext();
      }
    });
    child.stderr.on('data', (c) => {
      stderr += c.toString('utf8');
    });
    child.on('error', finish);
    child.on('exit', finish);
    send({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'test-267-15', version: '1' } },
    });
  });
}

async function main() {
  // ---- Arm 1: source ------------------------------------------------------
  await test('source: shim and adapter-client are on the v2 client package, no v1 sdk, no versionNegotiation in adapter', async () => {
    const shim = codeLines(SHIM);
    const adapter = codeLines(ADAPTER);
    assert.ok(shim.some((l) => /require\(/.test(l) && l.includes('@modelcontextprotocol/client')), 'shim must require @modelcontextprotocol/client');
    assert.ok(shim.some((l) => /require\(/.test(l) && l.includes('@modelcontextprotocol/server/stdio')), 'shim must require @modelcontextprotocol/server/stdio');
    assert.ok(adapter.some((l) => /require\(/.test(l) && l.includes('@modelcontextprotocol/client')), 'adapter-client must require @modelcontextprotocol/client');
    assert.equal(shim.filter((l) => l.includes('@modelcontextprotocol/sdk')).length, 0, 'shim must not reference @modelcontextprotocol/sdk');
    assert.equal(adapter.filter((l) => l.includes('@modelcontextprotocol/sdk')).length, 0, 'adapter-client must not reference @modelcontextprotocol/sdk');
    for (const f of [SHIM, ADAPTER]) {
      assert.equal((fs.readFileSync(f, 'utf8').match(/versionNegotiation/g) || []).length, 0, path.basename(f) + ' must not mention versionNegotiation');
    }
  });

  const hermetic = hermeticEnv({ MINDRIAN_MCP_FIRST: 'cli' });
  const roomsHome = hermetic.dirs.roomsHome;
  const roomX = path.join(roomsHome, 'room-x');
  fs.mkdirSync(roomX, { recursive: true });
  fs.mkdirSync(path.join(roomsHome, '.rooms'), { recursive: true });
  fs.writeFileSync(
    path.join(roomsHome, '.rooms', 'registry.json'),
    JSON.stringify(
      {
        active: 'room-267',
        rooms: {
          'room-x': { slug: 'room-x', abs_path: roomX },
          'room-267': { slug: 'room-267', abs_path: hermetic.dirs.roomDir },
        },
      },
      null,
      2
    )
  );
  const pidfile = path.join(roomsHome, '.rooms', 'daemon', 'mcp-daemon.json');
  const snapshot = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'tests', 'fixtures', '267', 'wire-snapshot-zod4.json'), 'utf8'));
  const snapshotCount = snapshot.local.tools.length;

  try {
    // ---- Arm 2: shim, unbound --------------------------------------------
    await test('shim unbound: 2025-11-25 initialize, snapshot tool count, room_bind writes exactly one session file naming room-x', async () => {
      const before = new Set(sessionFiles(roomsHome));
      const res = await driveShim(
        hermetic.env,
        [
          { method: 'tools/list' },
          { method: 'tools/call', params: { name: 'room_bind', arguments: { room: 'room-x' } } },
        ],
        45000
      );
      const init = res.responses.get(1);
      assert.ok(init && init.result, 'shim must answer initialize; stderr: ' + res.stderr.slice(-400));
      assert.equal(init.result.protocolVersion, '2025-11-25');
      const list = res.responses.get(2);
      assert.ok(list && list.result && Array.isArray(list.result.tools), 'tools/list answered');
      assert.equal(list.result.tools.length, snapshotCount, 'tools/list count must equal snapshot count ' + snapshotCount);
      const call = res.responses.get(3);
      assert.ok(call && call.result && call.result.content, 'room_bind answered: ' + JSON.stringify(call));
      const bind = parseToolJson(call.result.content[0].text);
      assert.equal(bind.ok, true, 'room_bind ok: ' + JSON.stringify(bind));
      const added = sessionFiles(roomsHome).filter((f) => !before.has(f));
      assert.equal(added.length, 1, 'exactly one new session binding file, got ' + added.length);
      const body = fs.readFileSync(path.join(roomsHome, '.rooms', 'sessions', added[0]), 'utf8');
      assert.ok(body.includes('room-x'), 'session file must name room-x: ' + body.slice(0, 200));
    });

    // ---- Arm 3: RCA 7 pin ------------------------------------------------
    await test('RCA 7 pin (mcp-shim-preseeded-session-id-rejected): MINDRIAN_SESSION_ID set -> daemon 400s, no initialize response', async () => {
      const env = Object.assign({}, hermetic.env, { MINDRIAN_SESSION_ID: 'shim-267-pin' });
      const res = await rpcOverStdio(SHIM, [], { env, timeoutMs: 10000 });
      assert.equal(res.initialize, null, 'no initialize response may reach stdout (RCA 7 pinned)');
      assert.ok(res.stderr.includes('No valid session ID provided'), 'shim stderr must carry the 400 text; got: ' + res.stderr.slice(-400));
    });

    // ---- Arm 4: adapter-client -------------------------------------------
    await test('adapter-client: queryDaemon completes two real tool calls, each on its own terminated session', async () => {
      const { queryDaemon } = require(ADAPTER);
      const opts = { daemonOpts: { home: roomsHome, env: hermetic.env } };
      for (let i = 0; i < 2; i += 1) {
        const r = await queryDaemon('contract_version', {}, opts);
        const text = r && r.content && r.content[0] && r.content[0].text;
        assert.ok(typeof text === 'string', 'call ' + (i + 1) + ' must return text content');
        const parsed = JSON.parse(text);
        assert.ok(typeof parsed.version === 'string' && parsed.version.length > 0, 'contract version named: ' + text);
      }
    });
  } finally {
    let pid = null;
    try {
      pid = JSON.parse(fs.readFileSync(pidfile, 'utf8')).pid;
    } catch (_e) {
      /* no daemon recorded */
    }
    if (Number.isInteger(pid)) {
      try {
        process.kill(pid, 'SIGKILL');
      } catch (_e) {
        /* already gone */
      }
      await new Promise((r) => setTimeout(r, 300));
      await test('hygiene: the hermetic daemon is dead', async () => {
        assert.equal(pidAlive(pid), false, 'daemon pid ' + pid + ' must be dead');
      });
    }
    hermetic.cleanup();
  }

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('fatal: ' + (err && err.stack ? err.stack : err));
  process.exit(1);
});
