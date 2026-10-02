#!/usr/bin/env node
'use strict';

/**
 * Phase 267 Plan 12 (MCPV2-05, MCPV2-17, MCPV2-10, MCPV2-19) -- flag-OFF HTTP
 * branch of the LOCAL server (bin/mindrian-mcp-server.cjs, MINDRIAN_TRANSPORT=http,
 * MINDRIAN_MCP_FIRST unset).
 * ==========================================================================
 * RCA 1 (.planning/debug/mcp-http-flag-off-one-request-per-process.md): the
 * pre-fix branch reused ONE stateless transport for the whole process, so the
 * first request succeeded and every later one returned a bare 500 ("Stateless
 * transport cannot be reused across requests"). Arms:
 *
 *   1. legacy 2025 over raw HTTP POSTs: initialize, notifications/initialized,
 *      tools/list (count equals the zod4 snapshot), tools/call contract_version,
 *      then 5 more tools/list, every one 2xx.
 *   2. 2026-07-28: a v2 Client over StreamableHTTPClientTransport with
 *      versionNegotiation auto negotiates 2026-07-28 and lists the same tool names.
 *   3. DNS rebinding: Host evil.example and Origin evil.example get 403;
 *      Host 127.0.0.1 with no Origin and Origin http://localhost both get 200.
 *   4. latency: 10 sequential tools/list, each under 5000 ms; p50/p95 printed.
 *
 * Port 3847 is fixed for flag-OFF. If something this test did not spawn holds
 * it, exit 77 (ENV GAP) naming the PID; never kill it. Only the PID this test
 * spawned is SIGKILLed, in finally.
 *
 * No em-dashes (hyphens only). CJS.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const cp = require('node:child_process');

const { hermeticEnv, LOCAL_SERVER } = require('./helpers/mcp-wire-267.cjs');

const REPO_ROOT = path.resolve(__dirname, '..');
const PORT = 3847;
const URL_MCP = 'http://127.0.0.1:' + PORT + '/mcp';
const SNAPSHOT = JSON.parse(
  fs.readFileSync(path.join(REPO_ROOT, 'tests', 'fixtures', '267', 'wire-snapshot-zod4.json'), 'utf8')
).local;

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

function portHeld() {
  return new Promise((resolve) => {
    const s = net.connect({ host: '127.0.0.1', port: PORT });
    s.once('connect', () => {
      s.destroy();
      resolve(true);
    });
    s.once('error', () => resolve(false));
  });
}

function holderPid() {
  try {
    const out = cp.execSync('ss -ltnp 2>/dev/null | grep ":' + PORT + ' " || true').toString();
    const m = out.match(/pid=(\d+)/);
    return m ? m[1] : 'unknown';
  } catch (_e) {
    return 'unknown';
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Parse a JSON or SSE (data: frames) response body into the JSON-RPC object(s).
function parseBody(text) {
  const t = (text || '').trim();
  if (!t) return null;
  if (t.startsWith('{') || t.startsWith('[')) return JSON.parse(t);
  const frames = [];
  for (const line of t.split('\n')) {
    if (line.startsWith('data:')) {
      const d = line.slice(5).trim();
      if (d) frames.push(JSON.parse(d));
    }
  }
  return frames.length <= 1 ? frames[0] || null : frames;
}

async function post(body, headers) {
  const res = await fetch(URL_MCP, {
    method: 'POST',
    headers: Object.assign(
      { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      headers || {}
    ),
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = parseBody(text);
  } catch (_e) {
    json = null;
  }
  return { status: res.status, text, json };
}

const INIT = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'test-267-12', version: '1' } },
};

function listReq(id) {
  return { jsonrpc: '2.0', id, method: 'tools/list', params: {} };
}

function startServer() {
  const hermetic = hermeticEnv({ MINDRIAN_TRANSPORT: 'http' });
  const child = cp.spawn('node', [LOCAL_SERVER], { cwd: REPO_ROOT, env: hermetic.env, stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('server did not print "HTTP on 127.0.0.1:' + PORT + '" within 30s; stderr: ' + stderr.slice(-400)));
    }, 30000);
    child.stderr.on('data', (c) => {
      stderr += c.toString('utf8');
      if (stderr.includes('HTTP on 127.0.0.1:' + PORT)) {
        clearTimeout(timer);
        resolve({ child, hermetic, getStderr: () => stderr });
      }
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error('server exited early (code ' + code + '); stderr: ' + stderr.slice(-400)));
    });
  });
}

async function main() {
  if (await portHeld()) {
    console.log('ENV GAP: port ' + PORT + ' is held by pid ' + holderPid() + ' (not spawned by this test); not killing it.');
    process.exit(77);
  }

  let srv = null;
  try {
    srv = await startServer();

    await test('legacy 2025 over raw HTTP: initialize, initialized, tools/list, tools/call, then 5 more tools/list, every one 2xx', async () => {
      const r1 = await post(INIT);
      assert.equal(r1.status, 200, 'initialize must be 200, got ' + r1.status);
      const r2 = await post({ jsonrpc: '2.0', method: 'notifications/initialized' });
      assert.ok(r2.status === 200 || r2.status === 202, 'notifications/initialized must be 200 or 202, got ' + r2.status);
      const r3 = await post(listReq(2));
      assert.equal(r3.status, 200, 'tools/list must be 200, got ' + r3.status + ' (second-request 500 is RCA 1)');
      const tools = r3.json && r3.json.result && r3.json.result.tools;
      assert.ok(Array.isArray(tools), 'tools/list must return a tools array');
      assert.equal(tools.length, SNAPSHOT.tools.length, 'tool count must equal the snapshot (' + SNAPSHOT.tools.length + '), got ' + tools.length);
      const r4 = await post({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'contract_version', arguments: {} },
      });
      assert.equal(r4.status, 200, 'tools/call contract_version must be 200, got ' + r4.status);
      assert.ok(r4.json && r4.json.result, 'tools/call must return a result');
      for (let i = 0; i < 5; i += 1) {
        const r = await post(listReq(10 + i));
        assert.equal(r.status, 200, 'extra tools/list #' + (i + 1) + ' must be 200, got ' + r.status);
      }
    });

    await test('era 2026: v2 Client over StreamableHTTPClientTransport negotiates 2026-07-28 and lists the same tool names', async () => {
      const { Client, StreamableHTTPClientTransport } = require('@modelcontextprotocol/client');
      const client = new Client({ name: 'test-267-12-modern', version: '1' }, { versionNegotiation: { mode: 'auto' } });
      const transport = new StreamableHTTPClientTransport(new URL(URL_MCP));
      try {
        await client.connect(transport);
        assert.equal(client.getNegotiatedProtocolVersion(), '2026-07-28', 'auto client must negotiate 2026-07-28, got ' + client.getNegotiatedProtocolVersion());
        const { tools } = await client.listTools();
        assert.deepEqual(
          tools.map((t) => t.name).sort(),
          SNAPSHOT.tools.map((t) => t.name).sort(),
          'tool names must equal the snapshot'
        );
      } finally {
        try {
          await client.close();
        } catch (_e) {
          /* best effort */
        }
      }
    });

    await test('DNS rebinding: bad Host 403, bad Origin 403, loopback Host without Origin 200, localhost Origin 200', async () => {
      const badHost = await post(INIT, { Host: 'evil.example:' + PORT });
      assert.equal(badHost.status, 403, 'Host evil.example must be 403, got ' + badHost.status);
      const badOrigin = await post(INIT, { Origin: 'http://evil.example' });
      assert.equal(badOrigin.status, 403, 'Origin evil.example must be 403, got ' + badOrigin.status);
      const noOrigin = await post(INIT, { Host: '127.0.0.1:' + PORT });
      assert.equal(noOrigin.status, 200, 'Host 127.0.0.1 with no Origin must be 200, got ' + noOrigin.status);
      const okOrigin = await post(INIT, { Origin: 'http://localhost:' + PORT });
      assert.equal(okOrigin.status, 200, 'Origin http://localhost must be 200, got ' + okOrigin.status);
    });

    await test('latency: 10 sequential tools/list each under 5000 ms (p50/p95 recorded)', async () => {
      const times = [];
      for (let i = 0; i < 10; i += 1) {
        const t0 = Date.now();
        const r = await post(listReq(100 + i));
        times.push(Date.now() - t0);
        assert.equal(r.status, 200, 'tools/list #' + (i + 1) + ' must be 200, got ' + r.status);
      }
      const sorted = times.slice().sort((a, b) => a - b);
      const p50 = sorted[Math.floor(sorted.length * 0.5)];
      const p95 = sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)];
      console.log('    tools/list latency ms: p50=' + p50 + ' p95=' + p95 + ' max=' + sorted[sorted.length - 1] + ' all=' + times.join(','));
      for (const t of times) assert.ok(t < 5000, 'a tools/list took ' + t + ' ms, over the 5000 ms bound');
    });

    await test('tree watcher boot did not fail (once-per-process is gated structurally by the createServer grep)', async () => {
      const log = srv.getStderr();
      const failures = (log.match(/tree watcher failed to start/g) || []).length;
      assert.equal(failures, 0, 'tree watcher must not fail to start');
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

  await test('process hygiene: port ' + PORT + ' is free after the run', async () => {
    assert.equal(await portHeld(), false, 'port ' + PORT + ' still held after teardown');
  });

  console.log('');
  console.log('RESULT: PASS=' + passed + ' FAIL=' + failed);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
