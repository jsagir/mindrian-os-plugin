#!/usr/bin/env node
'use strict';

/**
 * Phase 267 Plan 11 (MCPV2-02, MCPV2-01, MCPV2-07, MCPV2-03) -- dual-era wire
 * test for the LOCAL server (bin/mindrian-mcp-server.cjs) over stdio.
 * ==========================================================================
 * Drives the REAL v2 `Client` (@modelcontextprotocol/client, over
 * @modelcontextprotocol/client/stdio's StdioClientTransport) against the REAL
 * spawned local server, in both protocol eras, the same shape as the canary
 * test tests/test-267-mcpv2-brain-shim.cjs:
 *
 *   - era 2025: a default-options v2 Client (legacy mode) negotiates
 *     2025-11-25. Instructions equal RUNTIME_INSTRUCTIONS; tools, prompts,
 *     resources and templates equal the zod4 snapshot (plus only the accepted
 *     deltas); every tool carries a non-empty title.
 *   - era 2026: a v2 Client with versionNegotiation { mode: 'auto' }
 *     negotiates 2026-07-28 (the SDK probes with server/discover). Same
 *     instructions, same surface. RED before the swap: a v1 server has no
 *     server/discover, so 'auto' falls back to the legacy handshake.
 *   - elicitation, era 2025: the client declares { elicitation: {} } and
 *     answers elicitation/create with accept + the first option. A gate_render
 *     call produces exactly ONE elicitation request at the client (rung (a)).
 *   - elicitation, era 2026: same client in auto mode. The server cannot see
 *     client capabilities on a 2026 connection, so gate_render must NOT
 *     elicit (rung (b)/(c)); the result still carries a gate_id for
 *     gate_answer. No MRTR code exists or is exercised.
 *
 * Process hygiene: the 'auto' client spawns a disposable sibling server to
 * probe server/discover, and this server has boot side effects (dep-heal
 * check, tree watcher, session catch-up). Every PID this test observed is
 * SIGKILLed in finally, and the last arm asserts that no
 * bin/mindrian-mcp-server.cjs process anchored to THIS repo that this test
 * started survives (pgrep set before/after, only PIDs not present before).
 *
 * No em-dashes (hyphens only). CJS.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const { hermeticEnv, compareToSnapshot } = require('./helpers/mcp-wire-267.cjs');

const { Client } = require('@modelcontextprotocol/client');
const { StdioClientTransport } = require('@modelcontextprotocol/client/stdio');

const REPO_ROOT = path.resolve(__dirname, '..');
const LOCAL_SERVER = path.join(REPO_ROOT, 'bin', 'mindrian-mcp-server.cjs');
const SNAPSHOT = JSON.parse(
  fs.readFileSync(path.join(REPO_ROOT, 'tests', 'fixtures', '267', 'wire-snapshot-zod4.json'), 'utf8')
).local;
const DELTAS = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'tests', 'fixtures', '267', 'zod4-accepted-deltas.json'), 'utf8'));
const ACCEPTED = []
  .concat(DELTAS.zod4_additionalProperties_dropped || [])
  .concat(DELTAS.zod4_other || [])
  .concat(DELTAS.app_views_schema_fix || [])
  .concat(DELTAS.prompts_fix || []);
const { RUNTIME_INSTRUCTIONS } = require('../lib/mcp/runtime-instructions.cjs');

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
// Process bookkeeping.
// ---------------------------------------------------------------------------
const spawnedPids = [];
const cleanups = [];

function isAlive(pid) {
  if (typeof pid !== 'number') return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (_e) {
    return false;
  }
}

function serverPids() {
  const escaped = LOCAL_SERVER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  try {
    const out = execSync('pgrep -f "node .*' + escaped + '" || true').toString().trim();
    return out ? out.split('\n').map((s) => parseInt(s, 10)).filter((n) => Number.isFinite(n)) : [];
  } catch (_e) {
    return [];
  }
}
const PIDS_BEFORE = new Set(serverPids());

async function connectClient(opts) {
  const o = opts || {};
  const hermetic = hermeticEnv({});
  cleanups.push(hermetic.cleanup);
  const transport = new StdioClientTransport({
    command: 'node',
    args: [LOCAL_SERVER],
    env: hermetic.env,
    cwd: REPO_ROOT,
  });
  const client = new Client({ name: 'test-267-mcpv2-dual-era', version: '1' }, o.clientOptions || {});
  if (typeof o.setup === 'function') o.setup(client);
  // Track the pid as soon as the transport has one, even if connect() throws.
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

const AUTO = { versionNegotiation: { mode: 'auto' } };

// ---------------------------------------------------------------------------
// Surface comparison shared by both eras.
// ---------------------------------------------------------------------------
async function assertSurface(client) {
  assert.equal(client.getInstructions(), RUNTIME_INSTRUCTIONS, 'server instructions must equal RUNTIME_INSTRUCTIONS');

  const { tools } = await client.listTools();
  const { prompts } = await client.listPrompts();
  const { resources } = await client.listResources();
  const { resourceTemplates } = await client.listResourceTemplates();

  const live = {
    tools: tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
    prompts: prompts.map((p) => ({ name: p.name, description: p.description, arguments: p.arguments })),
  };
  const diffs = compareToSnapshot(live, SNAPSHOT, ACCEPTED);
  assert.deepEqual(
    diffs.map((d) => d.kind + ':' + d.name + ':' + d.field),
    [],
    'tools and prompts must equal the zod4 snapshot plus only the accepted deltas'
  );
  assert.equal(tools.length, SNAPSHOT.tools.length, 'tool count must equal the snapshot (' + SNAPSHOT.tools.length + ')');

  const untitled = tools.filter((t) => typeof t.title !== 'string' || t.title.length === 0).map((t) => t.name);
  assert.deepEqual(untitled, [], 'every tool must carry a non-empty title');

  assert.deepEqual(
    resources.map((r) => r.uri).sort(),
    SNAPSHOT.resources.map((r) => r.uri).sort(),
    'resource uris must equal the snapshot'
  );
  assert.deepEqual(
    resourceTemplates.map((t) => t.uriTemplate).sort(),
    SNAPSHOT.templates.map((t) => t.uriTemplate).sort(),
    'resource template uriTemplates must equal the snapshot'
  );
}

const GATE_CARD = {
  gate_id: 'gate-267-11-dual-era',
  header: 'Pick one',
  options: [
    { id: 'alpha', label: 'Alpha' },
    { id: 'beta', label: 'Beta' },
  ],
};

function parseToolText(result) {
  const text = result && result.content && result.content[0] && result.content[0].text;
  assert.ok(typeof text === 'string' && text.length > 0, 'tool must return text content');
  return JSON.parse(text);
}

async function main() {
  await test('era 2025 (default v2 client): negotiates 2025-11-25; instructions + tools/prompts/resources/templates match the snapshot; every tool titled', async () => {
    const conn = await connectClient({});
    try {
      assert.equal(conn.client.getNegotiatedProtocolVersion(), '2025-11-25', 'default-mode client must negotiate 2025-11-25');
      await assertSurface(conn.client);
      console.log('    negotiated ' + conn.client.getNegotiatedProtocolVersion() + ' (era ' + conn.client.getProtocolEra() + ')');
    } finally {
      await closeClient(conn);
    }
  });

  await test('era 2026 (auto-negotiating v2 client): negotiates 2026-07-28; same instructions and surface', async () => {
    const conn = await connectClient({ clientOptions: AUTO });
    try {
      assert.equal(conn.client.getProtocolEra(), 'modern', 'auto-mode client must land on the modern era once the server serves 2026-07-28');
      assert.equal(conn.client.getNegotiatedProtocolVersion(), '2026-07-28', 'auto-mode client must negotiate 2026-07-28');
      await assertSurface(conn.client);
      console.log('    negotiated ' + conn.client.getNegotiatedProtocolVersion() + ' (era ' + conn.client.getProtocolEra() + ')');
    } finally {
      await closeClient(conn);
    }
  });

  await test('elicitation, era 2025: gate_render causes exactly ONE elicitation request at the client (rung (a) live)', async () => {
    const seen = [];
    const conn = await connectClient({
      clientOptions: { capabilities: { elicitation: {} } },
      setup: (client) => {
        client.setRequestHandler('elicitation/create', async (request) => {
          seen.push(request);
          return { action: 'accept', content: { choice: 'alpha' } };
        });
      },
    });
    try {
      assert.equal(conn.client.getNegotiatedProtocolVersion(), '2025-11-25');
      const result = await conn.client.callTool({ name: 'gate_render', arguments: GATE_CARD });
      const body = parseToolText(result);
      console.log('    negotiated ' + conn.client.getNegotiatedProtocolVersion() + '; elicitation requests seen: ' + seen.length + '; renderer ' + body.renderer);
      assert.equal(seen.length, 1, 'exactly one elicitation request must reach the client, saw ' + seen.length);
      assert.equal(body.ok, true, 'gate_render must succeed');
      assert.equal(body.renderer, 'elicitation', 'renderer must be rung (a)');
      assert.deepEqual(body.answer && body.answer.chosen, ['alpha'], 'the inline answer must carry the chosen option');
    } finally {
      await closeClient(conn);
    }
  });

  await test('elicitation, era 2026: gate_render causes NO elicitation request; falls to rung (b)/(c) with a usable gate_id', async () => {
    const seen = [];
    const conn = await connectClient({
      clientOptions: Object.assign({ capabilities: { elicitation: {} } }, AUTO),
      setup: (client) => {
        client.setRequestHandler('elicitation/create', async (request) => {
          seen.push(request);
          return { action: 'accept', content: { choice: 'alpha' } };
        });
      },
    });
    try {
      assert.equal(conn.client.getNegotiatedProtocolVersion(), '2026-07-28', 'auto-mode client must negotiate 2026-07-28');
      const result = await conn.client.callTool({ name: 'gate_render', arguments: GATE_CARD });
      const body = parseToolText(result);
      console.log('    negotiated ' + conn.client.getNegotiatedProtocolVersion() + '; elicitation requests seen: ' + seen.length + '; renderer ' + body.renderer);
      assert.equal(seen.length, 0, 'no elicitation request may reach the client on a 2026 connection, saw ' + seen.length);
      assert.equal(body.ok, true, 'gate_render must still succeed');
      assert.notEqual(body.renderer, 'elicitation', 'renderer must be rung (b) or (c), not (a)');
      assert.equal(body.gate_id, GATE_CARD.gate_id, 'the result must carry a gate_id usable by gate_answer');
    } finally {
      await closeClient(conn);
    }
  });

  await test('process hygiene: no bin/mindrian-mcp-server.cjs process this test started survives', async () => {
    for (const pid of spawnedPids) {
      try {
        process.kill(pid, 'SIGKILL');
      } catch (_e) {
        /* already gone */
      }
    }
    // Give the OS a beat to reap, then verify.
    await new Promise((r) => setTimeout(r, 300));
    for (const pid of spawnedPids) {
      assert.equal(isAlive(pid), false, 'pid ' + pid + ' (a connection this test opened) is still alive after close');
    }
    const leaked = serverPids().filter((p) => !PIDS_BEFORE.has(p));
    if (leaked.length > 0) {
      for (const p of leaked) {
        try {
          process.kill(p, 'SIGKILL');
        } catch (_e) {
          /* gone */
        }
      }
      assert.fail('local server process(es) started by this test survived: ' + leaked.join(', '));
    }
  });

  for (const c of cleanups) {
    try {
      c();
    } catch (_e) {
      /* best effort */
    }
  }

  console.log('');
  console.log('RESULT: PASS=' + passed + ' FAIL=' + failed);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('FATAL:', err);
  for (const pid of spawnedPids) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch (_e) {
      /* gone */
    }
  }
  process.exit(1);
});
