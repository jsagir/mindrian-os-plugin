#!/usr/bin/env node
'use strict';

/**
 * Phase 267 Plan 05 (MCPV2-11) -- the canary wire test for
 * bin/mindrian-brain-mcp-client.cjs, the smallest, most isolated stdio
 * surface in the phase's migration.
 * ==========================================================================
 * Drives the REAL v2 `Client` (from `@modelcontextprotocol/client`, over
 * `@modelcontextprotocol/client/stdio`'s `StdioClientTransport`) against the
 * REAL shim process (`node bin/mindrian-brain-mcp-client.cjs`) in both
 * protocol eras:
 *
 *   - 2025 arm: a default-options v2 Client (mode: 'legacy', the library
 *     default) negotiates protocolVersion 2025-11-25 and lists the 6 brain
 *     tools, byte-comparable (name, description, normalized inputSchema) to
 *     the brain section of tests/fixtures/267/wire-snapshot-zod4.json.
 *   - 2026 arm: a v2 Client with versionNegotiation in 'auto' mode
 *     negotiates protocolVersion 2026-07-28 and lists the same 6 tools. RED
 *     before the shim migrates to serveStdio -- a v1 server has no
 *     `server/discover` handler, so 'auto' mode's conservative fallback
 *     lands it on the legacy 2025-11-25 handshake instead, and this arm's
 *     era assertion fails.
 *   - Keyless arms (both eras): brain_stats returns the byte-locked
 *     DIRECTOR_NOT_AVAILABLE tier-0 sentinel (lib/core/refusal-messaging.cjs)
 *     with zero network reached -- hermeticEnv() strips MINDRIAN_BRAIN_KEY
 *     and points MINDRIAN_BRAIN_URL at an unreachable loopback, and
 *     MINDRIAN_DISABLE_AUTO_REGISTER=1 prevents even the silent-registration
 *     POST from firing.
 *   - Source arm: the shim's own source requires @modelcontextprotocol/server
 *     (via requireWithHeal) on the connect path and never requires
 *     @modelcontextprotocol/sdk. RED before migration -- today's shim still
 *     requires @modelcontextprotocol/sdk/server/{mcp,stdio}.js.
 *
 * Process hygiene: every PID this test spawns (the real shim connection; the
 * 'auto' mode client also spawns a short-lived disposable sibling process on
 * the SDK's own StdioClientTransport to probe with server/discover, which the
 * client library disposes of internally) is verified dead by the end of the
 * run, via both a direct liveness check on the PIDs this test observed AND a
 * defensive pgrep sweep for ANY surviving mindrian-brain-mcp-client.cjs
 * process, so a failing arm never leaks a process into the next test file.
 *
 * No em-dashes (hyphens only). CJS.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const { hermeticEnv, normalizeSchema, BRAIN_SHIM } = require('./helpers/mcp-wire-267.cjs');

const { Client } = require('@modelcontextprotocol/client');
const { StdioClientTransport } = require('@modelcontextprotocol/client/stdio');

const REPO_ROOT = path.resolve(__dirname, '..');
const SNAPSHOT = JSON.parse(
  fs.readFileSync(path.join(REPO_ROOT, 'tests', 'fixtures', '267', 'wire-snapshot-zod4.json'), 'utf8')
);
const EXPECTED_TOOLS = SNAPSHOT.brain.tools;

let passed = 0;
let failed = 0;

function ok(name) {
  passed += 1;
  console.log('  ok ' + name);
}
function fail(name, err) {
  failed += 1;
  console.log('  FAIL ' + name);
  console.log('    ' + (err && err.message ? err.message : String(err)));
}
async function test(name, fn) {
  try {
    await fn();
    ok(name);
  } catch (err) {
    fail(name, err);
  }
}

// ---------------------------------------------------------------------------
// Process bookkeeping -- every real connection's transport.pid is tracked so
// the final hygiene arm can confirm it is dead.
// ---------------------------------------------------------------------------
const spawnedPids = [];

function isAlive(pid) {
  if (typeof pid !== 'number') return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (_e) {
    return false;
  }
}

async function connectClient(opts) {
  const o = opts || {};
  const { env } = hermeticEnv(Object.assign({ MINDRIAN_DISABLE_AUTO_REGISTER: '1' }, o.envOverrides || {}));
  const transport = new StdioClientTransport({
    command: 'node',
    args: [BRAIN_SHIM],
    env,
    cwd: REPO_ROOT,
  });
  const client = new Client({ name: 'test-267-mcpv2-brain-shim', version: '1' }, o.clientOptions || {});
  await client.connect(transport);
  if (typeof transport.pid === 'number') spawnedPids.push(transport.pid);
  return { client, transport };
}

async function closeClient(conn) {
  try {
    await conn.client.close();
  } catch (_e) {
    /* best effort */
  }
  if (typeof conn.transport.pid === 'number') {
    try {
      process.kill(conn.transport.pid, 'SIGKILL');
    } catch (_e) {
      /* already gone */
    }
  }
}

// ---------------------------------------------------------------------------
// compareTools(liveTools) -- exact name-set equality against the 6 brain
// tools, plus per-tool description and normalized-inputSchema equality
// (normalizeSchema strips $schema, so draft-07 vs draft 2020-12 is not a
// diff), plus an explicit additionalProperties:false assertion per Phase 257.
// ---------------------------------------------------------------------------
function compareTools(liveTools) {
  const liveMap = new Map(liveTools.map((t) => [t.name, t]));
  const expectedNames = EXPECTED_TOOLS.map((t) => t.name).sort();
  const liveNames = liveTools.map((t) => t.name).sort();
  assert.deepEqual(liveNames, expectedNames, 'tool name set must equal the 6 brain tools');

  for (const exp of EXPECTED_TOOLS) {
    const live = liveMap.get(exp.name);
    assert.ok(live, 'missing tool: ' + exp.name);
    assert.equal(live.description, exp.description, exp.name + ' description must match byte-for-byte');
    assert.equal(
      JSON.stringify(normalizeSchema(live.inputSchema)),
      JSON.stringify(normalizeSchema(exp.inputSchema)),
      exp.name + ' inputSchema must match (normalized: $schema stripped, keys sorted)'
    );
    assert.equal(
      live.inputSchema.additionalProperties,
      false,
      exp.name + ' must advertise additionalProperties:false (Phase 257 strict schemas)'
    );
  }
}

async function keylessRefusalCheck(conn) {
  const result = await conn.client.callTool({ name: 'brain_stats', arguments: {} });
  const text = result.content && result.content[0] && result.content[0].text;
  assert.ok(typeof text === 'string' && text.length > 0, 'brain_stats must return text content');
  const parsed = JSON.parse(text);
  assert.equal(parsed.status, 'DIRECTOR_NOT_AVAILABLE', 'keyless brain_stats must return the byte-locked tier-0 sentinel');
  assert.equal(parsed.command_context, 'brain_stats', 'tier-0 sentinel must name the calling tool');
}

async function main() {
  await test(
    '2025 arm (default v2 client, legacy mode): negotiates 2025-11-25 and lists the 6 brain tools, byte-matching the pinned snapshot',
    async () => {
      const conn = await connectClient({});
      try {
        assert.equal(conn.client.getNegotiatedProtocolVersion(), '2025-11-25', 'default-mode client must negotiate 2025-11-25');
        const { tools } = await conn.client.listTools();
        compareTools(tools);
      } finally {
        await closeClient(conn);
      }
    }
  );

  await test('2025 arm: keyless brain_stats returns the tier-0 refusal shape, no network reached', async () => {
    const conn = await connectClient({});
    try {
      await keylessRefusalCheck(conn);
    } finally {
      await closeClient(conn);
    }
  });

  await test(
    '2026 arm (auto-negotiating v2 client): negotiates 2026-07-28 and lists the same 6 tools -- RED before migration',
    async () => {
      const conn = await connectClient({ clientOptions: { versionNegotiation: { mode: 'auto' } } });
      try {
        assert.equal(conn.client.getProtocolEra(), 'modern', 'auto-mode client must negotiate the modern era once the shim serves 2026-07-28');
        assert.equal(conn.client.getNegotiatedProtocolVersion(), '2026-07-28', 'auto-mode client must negotiate protocolVersion 2026-07-28');
        const { tools } = await conn.client.listTools();
        compareTools(tools);
      } finally {
        await closeClient(conn);
      }
    }
  );

  await test('2026 arm: keyless brain_stats returns the tier-0 refusal shape, no network reached', async () => {
    const conn = await connectClient({ clientOptions: { versionNegotiation: { mode: 'auto' } } });
    try {
      await keylessRefusalCheck(conn);
    } finally {
      await closeClient(conn);
    }
  });

  await test(
    'source arm: the shim requires @modelcontextprotocol/server via requireWithHeal and never requires @modelcontextprotocol/sdk -- RED before migration',
    () => {
      const src = fs.readFileSync(BRAIN_SHIM, 'utf8');
      // Strip comment-only lines so a doc mention (this header's own prose,
      // or the shim's own header comment) never counts as a require.
      const code = src
        .split('\n')
        .filter((l) => !/^\s*\/\//.test(l) && !/^\s*\*/.test(l))
        .join('\n');
      assert.ok(
        /requireWithHeal\(\s*['"]@modelcontextprotocol\/server['"]/.test(code),
        'the shim must requireWithHeal(\'@modelcontextprotocol/server\', ...) on its connect path'
      );
      assert.ok(
        !/require(?:WithHeal)?\(\s*['"]@modelcontextprotocol\/sdk/.test(code),
        'the shim must never require() or requireWithHeal() anything under @modelcontextprotocol/sdk'
      );
    }
  );

  await test('process hygiene: no spawned mindrian-brain-mcp-client.cjs process survives this test', () => {
    for (const pid of spawnedPids) {
      assert.equal(isAlive(pid), false, 'pid ' + pid + ' (a connection this test opened) is still alive after close');
    }
    try {
      // Anchor to THIS repo's absolute shim path, not a bare filename match --
      // a real, unrelated mindrian-brain MCP server from the installed
      // plugin cache (backing other live Claude Code / Desktop / Cowork
      // sessions on this machine) legitimately runs the same basename
      // continuously and must never be mistaken for a leak this test caused.
      const escaped = BRAIN_SHIM.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const out = execSync('pgrep -af "node .*' + escaped + '" || true').toString().trim();
      if (out) {
        console.log('ORPHAN PROCESS DETECTED:\n' + out);
        assert.fail('a mindrian-brain-mcp-client.cjs process spawned from THIS repo survived this test run');
      }
    } catch (e) {
      if (e instanceof assert.AssertionError) throw e;
      // pgrep absent on this platform -- not a failure of this test.
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
