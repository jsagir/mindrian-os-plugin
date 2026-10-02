#!/usr/bin/env node
'use strict';

/**
 * Phase 267 Plan 14 (MCPV2-06, MCPV2-17) -- flag-ON daemon routing by protocol
 * era (bin/mindrian-mcp-server.cjs, MINDRIAN_TRANSPORT=http, MINDRIAN_MCP_FIRST=cowork).
 * ==========================================================================
 * The flag-ON daemon stays sessionful and 2025-era for existing clients (the
 * session-keyed room binding in lib/core/session-binding.cjs needs a
 * transport-minted session id), and answers 2026-07-28 envelope-claim traffic
 * through a modern-only createMcpHandler. Arms:
 *
 *   1. legacy isolation: two concurrent v2 Clients (2025 default) each get a
 *      distinct mcp-session-id; room_bind(room-x) in A resolves room-x in A
 *      while a fresh unbound B does not; a session file for A exists under
 *      <rooms home>/.rooms/sessions/.
 *   2. legacy unknown session: a POST carrying an unknown mcp-session-id is 400.
 *   3. modern: a v2 Client with versionNegotiation auto negotiates 2026-07-28
 *      against the daemon and lists the same tool names as the legacy session.
 *   4. rebinding: POST /mcp and GET /event with Host evil.example are 403;
 *      Host 127.0.0.1:<port> without Origin is served on both; a bad Origin
 *      on /mcp is 403.
 *   5. hygiene: only the spawned PID is SIGKILLed; it is dead and its pidfile
 *      PID is not alive afterwards.
 *
 * No em-dashes (hyphens only). CJS.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const cp = require('node:child_process');

const { hermeticEnv, LOCAL_SERVER } = require('./helpers/mcp-wire-267.cjs');

const REPO_ROOT = path.resolve(__dirname, '..');

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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return !(e && e.code === 'ESRCH');
  }
}

// room_bind / room_state_bound return a text block; room_bind appends a
// "## Suggested Next" block after the JSON payload. Parse the leading JSON.
function parseToolJson(result) {
  const text = result && result.content && result.content[0] && result.content[0].text;
  assert.ok(typeof text === 'string' && text.length > 0, 'tool call must return text content');
  const marker = text.indexOf('\n\n## Suggested Next');
  return JSON.parse(marker === -1 ? text : text.slice(0, marker));
}

// node:http request: fetch (undici) will not let a caller override Host.
// Resolves on response headers (the /event SSE stream never ends), then drops the socket.
function rawRequest(port, method, urlPath, headers, body) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : JSON.stringify(body);
    const h = Object.assign({}, headers || {});
    if (data !== null) {
      h['Content-Type'] = 'application/json';
      h.Accept = 'application/json, text/event-stream';
      h['Content-Length'] = Buffer.byteLength(data);
    }
    const req = http.request({ host: '127.0.0.1', port, path: urlPath, method, headers: h }, (res) => {
      const status = res.statusCode;
      res.on('error', () => {});
      res.destroy();
      resolve({ status });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => req.destroy(new Error('request timed out')));
    if (data !== null) req.end(data);
    else req.end();
  });
}

const INIT = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'test-267-14', version: '1' } },
};

function startDaemon() {
  const hermetic = hermeticEnv({ MINDRIAN_TRANSPORT: 'http', MINDRIAN_MCP_FIRST: 'cowork' });
  const roomsHome = hermetic.dirs.roomsHome;
  const roomX = path.join(roomsHome, 'room-x');
  const roomY = path.join(roomsHome, 'room-y');
  fs.mkdirSync(roomX, { recursive: true });
  fs.mkdirSync(roomY, { recursive: true });
  fs.mkdirSync(path.join(roomsHome, '.rooms'), { recursive: true });
  fs.writeFileSync(
    path.join(roomsHome, '.rooms', 'registry.json'),
    JSON.stringify(
      {
        active: 'room-267',
        rooms: {
          'room-x': { slug: 'room-x', abs_path: roomX },
          'room-y': { slug: 'room-y', abs_path: roomY },
          'room-267': { slug: 'room-267', abs_path: hermetic.dirs.roomDir },
        },
      },
      null,
      2
    )
  );
  const child = cp.spawn('node', [LOCAL_SERVER], { cwd: REPO_ROOT, env: hermetic.env, stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('daemon did not report its port within 30s; stderr: ' + stderr.slice(-400)));
    }, 30000);
    child.stderr.on('data', (c) => {
      stderr += c.toString('utf8');
      const m = stderr.match(/HTTP on 127\.0\.0\.1:(\d+)/);
      if (m) {
        clearTimeout(timer);
        resolve({ child, hermetic, port: Number(m[1]), roomX, roomY, getStderr: () => stderr });
      }
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error('daemon exited early (code ' + code + '); stderr: ' + stderr.slice(-400)));
    });
  });
}

async function main() {
  const { Client, StreamableHTTPClientTransport } = require('@modelcontextprotocol/client');

  let srv = null;
  let pidfilePid = null;
  try {
    srv = await startDaemon();
    const url = new URL('http://127.0.0.1:' + srv.port + '/mcp');
    const pidfile = path.join(srv.hermetic.dirs.roomsHome, '.rooms', 'daemon', 'mcp-daemon.json');
    try {
      pidfilePid = JSON.parse(fs.readFileSync(pidfile, 'utf8')).pid;
    } catch (_e) {
      pidfilePid = srv.child.pid;
    }

    const legacyToolNames = [];

    await test('legacy 2025: two concurrent sessions get distinct ids, room_bind is per-session, session file written', async () => {
      const mk = async (name) => {
        const client = new Client({ name, version: '1' });
        const transport = new StreamableHTTPClientTransport(url);
        await client.connect(transport);
        return { client, transport };
      };
      const a = await mk('test-267-14-a');
      const b = await mk('test-267-14-b');
      try {
        const sidA = a.transport.sessionId;
        const sidB = b.transport.sessionId;
        assert.ok(typeof sidA === 'string' && typeof sidB === 'string' && sidA !== sidB, 'distinct session ids, got A=' + sidA + ' B=' + sidB);
        assert.notEqual(a.client.getNegotiatedProtocolVersion(), '2026-07-28', 'default client must be 2025-era');

        const bind = parseToolJson(await a.client.callTool({ name: 'room_bind', arguments: { room: 'room-x' } }));
        assert.equal(bind.ok, true, 'room_bind ok: ' + JSON.stringify(bind));
        const stateA = parseToolJson(await a.client.callTool({ name: 'room_state_bound', arguments: {} }));
        assert.equal(stateA.room_dir, srv.roomX, 'session A resolves room-x, got ' + stateA.room_dir);
        const stateB = parseToolJson(await b.client.callTool({ name: 'room_state_bound', arguments: {} }));
        assert.notEqual(stateB.room_dir, srv.roomX, 'unbound session B must not resolve room-x');

        const sessionFile = path.join(srv.hermetic.dirs.roomsHome, '.rooms', 'sessions', sidA + '.json');
        assert.ok(fs.existsSync(sessionFile), 'session file must exist at ' + sessionFile);

        const { tools } = await a.client.listTools();
        for (const t of tools) legacyToolNames.push(t.name);
        assert.ok(legacyToolNames.length > 0, 'legacy tools/list must return tools');
      } finally {
        for (const x of [a, b]) {
          try {
            await x.transport.terminateSession();
          } catch (_e) {
            /* best effort */
          }
          try {
            await x.client.close();
          } catch (_e) {
            /* best effort */
          }
        }
      }
    });

    await test('legacy: an unknown mcp-session-id is 400', async () => {
      const r = await rawRequest(
        srv.port,
        'POST',
        '/mcp',
        { 'mcp-session-id': 'not-a-real-session', Host: '127.0.0.1:' + srv.port },
        { jsonrpc: '2.0', id: 9, method: 'tools/list', params: {} }
      );
      assert.equal(r.status, 400, 'unknown session id must be 400, got ' + r.status);
    });

    await test('modern 2026-07-28: auto-negotiating Client negotiates 2026-07-28 and lists the same tool names', async () => {
      const client = new Client({ name: 'test-267-14-modern', version: '1' }, { versionNegotiation: { mode: 'auto' } });
      const transport = new StreamableHTTPClientTransport(url);
      try {
        await client.connect(transport);
        assert.equal(client.getNegotiatedProtocolVersion(), '2026-07-28', 'must negotiate 2026-07-28, got ' + client.getNegotiatedProtocolVersion());
        const { tools } = await client.listTools();
        assert.deepEqual(tools.map((t) => t.name).sort(), legacyToolNames.slice().sort(), 'modern tool names must equal the legacy session list');
      } finally {
        try {
          await client.close();
        } catch (_e) {
          /* best effort */
        }
      }
    });

    await test('DNS rebinding: bad Host 403 on /mcp and /event, bad Origin 403, loopback Host served on both', async () => {
      const evil = 'evil.example:' + srv.port;
      const good = '127.0.0.1:' + srv.port;
      const mcpBadHost = await rawRequest(srv.port, 'POST', '/mcp', { Host: evil }, INIT);
      assert.equal(mcpBadHost.status, 403, 'POST /mcp bad Host must be 403, got ' + mcpBadHost.status);
      const eventBadHost = await rawRequest(srv.port, 'GET', '/event', { Host: evil });
      assert.equal(eventBadHost.status, 403, 'GET /event bad Host must be 403, got ' + eventBadHost.status);
      const mcpBadOrigin = await rawRequest(srv.port, 'POST', '/mcp', { Host: good, Origin: 'http://evil.example' }, INIT);
      assert.equal(mcpBadOrigin.status, 403, 'POST /mcp bad Origin must be 403, got ' + mcpBadOrigin.status);
      const eventBadOrigin = await rawRequest(srv.port, 'GET', '/event', { Host: good, Origin: 'http://evil.example' });
      assert.equal(eventBadOrigin.status, 403, 'GET /event bad Origin must be 403, got ' + eventBadOrigin.status);
      const mcpOk = await rawRequest(srv.port, 'POST', '/mcp', { Host: good }, INIT);
      assert.equal(mcpOk.status, 200, 'POST /mcp loopback Host without Origin must be 200, got ' + mcpOk.status);
      const eventOk = await rawRequest(srv.port, 'GET', '/event', { Host: good });
      assert.equal(eventOk.status, 200, 'GET /event loopback Host without Origin must be 200, got ' + eventOk.status);
    });

    await test('tree watcher boot did not fail', async () => {
      assert.equal((srv.getStderr().match(/tree watcher failed to start/g) || []).length, 0, 'tree watcher must not fail to start');
    });
  } catch (err) {
    failed += 1;
    console.log('  FAIL harness: ' + (err && err.message ? err.message : String(err)));
  } finally {
    if (srv && srv.child && typeof srv.child.pid === 'number') {
      try {
        process.kill(srv.child.pid, 'SIGKILL');
      } catch (_e) {
        /* already gone */
      }
    }
    await sleep(300);
    if (srv && srv.hermetic) srv.hermetic.cleanup();
  }

  await test('process hygiene: the spawned daemon PID is dead after the run', async () => {
    if (srv && srv.child) assert.equal(pidAlive(srv.child.pid), false, 'spawned daemon pid ' + srv.child.pid + ' still alive');
    if (pidfilePid && srv && srv.child && pidfilePid !== srv.child.pid) {
      assert.equal(pidAlive(pidfilePid), false, 'pidfile pid ' + pidfilePid + ' still alive');
    }
  });

  console.log('');
  console.log('RESULT: PASS=' + passed + ' FAIL=' + failed);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
