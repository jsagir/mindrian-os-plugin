#!/usr/bin/env node
'use strict';

/**
 * Phase 289 plan 02 (CONTRACT289-01..04, CARD289-05) -- the gate contract names
 * its recommended option, and a card builder can read the id BY VALUE.
 * ==========================================================================
 * Why: Phase 369's UI shell renders a gate card and needs to know which option
 * to put first. Today the id is not on the wire at all: renderShapeF8 pins
 * `recommended: null`, grantOptions flattens a recommendation into a prose
 * `description: 'Recommended'`, and the rung (b) imperative counts zero
 * options. Phase 369-26's probe part 1 looks for a non-null string field
 * OUTSIDE `superset_options` and OUTSIDE the zone text whose value equals a
 * superset option id, found by value, and asserts it is the top-ranked one.
 * This file defines that rule at the renderer, at the research passthrough and
 * on a live flag-ON daemon, and prints the JSON path it found.
 *
 * Ruling pinned here: a rank of 1 is the TOP rank (lower is better); an
 * explicit `recommended: true` on an option outranks rank; equal ranks keep
 * input order; a multi-select basket carries NO recommended id, because a
 * basket has no single answer (Canon Appendix D entry 32).
 *
 * Three arms (repeatable --arm <id>; no flag runs all three):
 *   unit      normalizeCard derivation, rung (b) and rung (c) renders, the
 *             option count in the rung (b) imperative (D-07), the by-value
 *             path finder, and the F.8 renderer staying recommendation-free
 *   research  lib/mcp/tools/research.cjs grantOptions passes the grant card's
 *             recommended flag through as a flag, not as prose
 *   live      the same by-value finder against a hermetic flag-ON daemon
 *             (legacy-mode client, bound room, ranked options); exit 77 with
 *             an ENV GAP line only when the daemon cannot start
 *
 * Hermetic: temp HOME and rooms home are set BEFORE any lib/ module loads,
 * MINDRIAN_BRAIN_URL is unreachable, the dirs are removed on exit, and only a
 * PID this test spawned is ever killed.
 *
 * No em-dashes (hyphens only). CJS.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

// ---------------------------------------------------------------------------
// Hermetic environment, BEFORE the first require of any lib/ module.
// ---------------------------------------------------------------------------
const REPO = path.resolve(__dirname, '..');
const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 't289-contract-home-'));
const TMP_ROOMS = fs.mkdtempSync(path.join(os.tmpdir(), 't289-contract-rooms-'));
process.env.HOME = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = TMP_ROOMS;
process.env.MINDRIAN_BRAIN_URL = 'http://127.0.0.1:9';
delete process.env.MINDRIAN_BRAIN_KEY;
delete process.env.CLAUDE_CODE_SESSION_ID;
process.on('exit', () => {
  for (const d of [TMP_HOME, TMP_ROOMS]) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
});

const RECOMMENDED_PATH = 'rendered.contract.recommended';

let passed = 0;
let failed = 0;
let envGap = false;
async function check(label, fn) {
  try {
    await fn();
    passed += 1;
    console.log('PASS: ' + label);
  } catch (err) {
    failed += 1;
    let msg = (err && err.message) ? String(err.message).split('\n')[0] : String(err);
    if (err && err.code === 'ERR_ASSERTION' && err.actual !== undefined) {
      msg += ' (actual: ' + JSON.stringify(err.actual).slice(0, 100) + ')';
    }
    console.log('FAIL: ' + label + ' :: ' + msg);
  }
}

function parseArms(argv) {
  const picked = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--arm' && i + 1 < argv.length) {
      picked.push(argv[i + 1]);
      i += 1;
    }
  }
  return picked.length > 0 ? picked : ['unit', 'research', 'live'];
}

/**
 * pathsWithValue(obj, values, excludePrefixes) -> [{ path, value }]: every
 * dotted path (array indexes as [n]) whose value is a string in `values`,
 * skipping any path equal to or beneath an excluded prefix. The base object's
 * own keys start the path, so pass { rendered: ... } to get `rendered.*`.
 */
function pathsWithValue(obj, values, excludePrefixes) {
  const wanted = new Set(values);
  const skip = excludePrefixes || [];
  const found = [];
  function excluded(p) {
    return skip.some((x) => p === x || p.startsWith(x + '.') || p.startsWith(x + '['));
  }
  function walk(node, p) {
    if (excluded(p)) return;
    if (typeof node === 'string') {
      if (wanted.has(node)) found.push({ path: p, value: node });
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((child, i) => walk(child, p + '[' + i + ']'));
      return;
    }
    if (node && typeof node === 'object') {
      for (const k of Object.keys(node)) walk(node[k], p === '' ? k : p + '.' + k);
    }
  }
  walk(obj, '');
  return found;
}

// The option count the rung (b) imperative names ("with the N options above").
function countIn(text) {
  const m = /with the (\d+) options above/.exec(String(text));
  return m ? 'verbs=' + m[1] : 'no count (' + String(text).slice(0, 60) + ')';
}

const EXCLUDED_PREFIXES = ['rendered.contract.superset_options', 'rendered.zones'];

// Ids differ from labels on purpose, so a label array (contract.options, the
// F.8 preChecked and verbs labels) can never collide with an id.
function ranked() {
  return [
    { id: 'opt-c', label: 'Third pick', rank: 3 },
    { id: 'opt-b', label: 'Top pick', rank: 1 },
    { id: 'opt-a', label: 'Second pick', rank: 2 },
  ];
}
const IDS = ['opt-a', 'opt-b', 'opt-c'];

// ---------------------------------------------------------------------------
// Arm: unit
// ---------------------------------------------------------------------------
async function armUnit() {
  const gateRender = require(path.join(REPO, 'lib', 'mcp', 'gate-render.cjs'));
  const { renderShapeF8 } = require(path.join(REPO, 'lib', 'hmi', 'shape-f8-renderer.cjs'));
  const uc = (label, fn) => check('unit: ' + label, fn);
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

  // --- derivation ---
  await uc('derivation: ranks {a:2, b:1} give recommended b (rank 1 is the top)', () => {
    const c = gateRender.normalizeCard({ options: [{ id: 'a', label: 'A', rank: 2 }, { id: 'b', label: 'B', rank: 1 }] });
    assert.equal(c.recommended, 'b', 'recommended must be b, got ' + String(c.recommended));
  });
  await uc('derivation: an explicit recommended flag outranks rank', () => {
    const c = gateRender.normalizeCard({ options: [{ id: 'a', label: 'A', rank: 2, recommended: true }, { id: 'b', label: 'B', rank: 1 }] });
    assert.equal(c.recommended, 'a', 'recommended must be a, got ' + String(c.recommended));
  });
  await uc('derivation: two explicit flags give the first flagged', () => {
    const c = gateRender.normalizeCard({ options: [
      { id: 'a', label: 'A' }, { id: 'b', label: 'B', recommended: true }, { id: 'c', label: 'C', recommended: true },
    ] });
    assert.equal(c.recommended, 'b', 'recommended must be b, got ' + String(c.recommended));
  });
  await uc('derivation: equal lowest ranks keep input order', () => {
    const c = gateRender.normalizeCard({ options: [
      { id: 'a', label: 'A', rank: 2 }, { id: 'b', label: 'B', rank: 1 }, { id: 'c', label: 'C', rank: 1 },
    ] });
    assert.equal(c.recommended, 'b', 'recommended must be b, got ' + String(c.recommended));
  });
  await uc('derivation: no rank and no flag give null', () => {
    const c = gateRender.normalizeCard({ options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] });
    assert.equal(has(c, 'recommended'), true, 'the normalized card must carry a recommended key');
    assert.equal(c.recommended, null);
  });
  await uc('derivation: a flagged option has recommended:true and an unflagged option has no own recommended key', () => {
    const c = gateRender.normalizeCard({ options: [{ id: 'a', label: 'A', recommended: true }, { id: 'b', label: 'B' }] });
    assert.equal(c.options[0].recommended, true);
    assert.equal(has(c.options[1], 'recommended'), false);
  });

  // --- rung (b), single-select ---
  const resB = await gateRender.renderGate({ options: ranked() }, { capabilities: { claudeCode: true } });
  await uc('rung (b) single: contract.recommended equals the top-ranked option id', () => {
    assert.equal(resB.renderer, 'askuserquestion');
    assert.equal(resB.rendered.contract.shape, 'F.8');
    assert.equal(resB.rendered.contract.multiSelect, false);
    assert.equal(resB.rendered.contract.recommended, 'opt-b', 'got ' + String(resB.rendered.contract.recommended));
  });
  await uc('rung (b) single: each superset_options row carries a boolean recommended, true only for the top id', () => {
    const rows = resB.rendered.contract.superset_options;
    assert.equal(rows.length, 3);
    for (const r of rows) assert.equal(typeof r.recommended, 'boolean', 'row ' + r.id + ' must carry a boolean recommended');
    assert.deepEqual(rows.filter((r) => r.recommended === true).map((r) => r.id), ['opt-b']);
  });

  // --- rung (b), multi-select ---
  const resBMulti = await gateRender.renderGate({ options: ranked(), selectMode: 'multi' }, { capabilities: { claudeCode: true } });
  await uc('rung (b) multi: contract.recommended stays null with ranks (Canon Appendix D entry 32)', () => {
    assert.equal(resBMulti.rendered.contract.multiSelect, true);
    assert.equal(resBMulti.rendered.contract.recommended, null);
  });
  await uc('rung (b) multi: with ranks and no flags every row is recommended:false', () => {
    const rows = resBMulti.rendered.contract.superset_options;
    assert.ok(rows.length === 3 && rows.every((r) => r.recommended === false), 'rows: ' + JSON.stringify(rows.map((r) => r.recommended)));
  });
  await uc('rung (b) multi: one explicitly flagged option marks only its own row', async () => {
    const opts = ranked();
    opts[0].recommended = true; // opt-c
    const res = await gateRender.renderGate({ options: opts, selectMode: 'multi' }, { capabilities: { claudeCode: true } });
    assert.equal(res.rendered.contract.recommended, null);
    assert.deepEqual(res.rendered.contract.superset_options.filter((r) => r.recommended === true).map((r) => r.id), ['opt-c']);
  });

  // --- rung (c) ---
  await uc('rung (c) single: contract.recommended is the top id and exactly one body line ends with (recommended)', async () => {
    const res = await gateRender.renderGate({ options: ranked() }, { capabilities: {} });
    assert.equal(res.renderer, 'text');
    assert.equal(res.rendered.contract.recommended, 'opt-b', 'got ' + String(res.rendered.contract.recommended));
    const marked = res.rendered.zones.body.split('\n').filter((l) => l.endsWith(' (recommended)'));
    assert.equal(marked.length, 1, 'exactly one marked line, got ' + marked.length);
    assert.ok(marked[0].includes('[opt-b]'), 'the marked line must be the opt-b line, got: ' + marked[0]);
  });
  await uc('rung (c) multi: contract.recommended is null and no body line carries the marker', async () => {
    const res = await gateRender.renderGate({ options: ranked(), selectMode: 'multi' }, { capabilities: {} });
    assert.equal(res.rendered.contract.recommended, null);
    assert.equal(res.rendered.zones.body.split('\n').filter((l) => l.endsWith(' (recommended)')).length, 0);
  });

  // --- CARD289-05 (D-07): the imperative names the real option count ---
  await uc('CARD289-05: a 3-option rung (b) imperative says "with the 3 options above" and the marker says verbs=3', () => {
    assert.equal(resB.rendered.askuserquestion_marker, '[AskUserQuestion contract: shape=F.8 verbs=3]');
    assert.ok(resB.rendered.askuserquestion_binding.includes('with the 3 options above'), 'binding names ' + countIn(resB.rendered.askuserquestion_binding) + ' options above, want 3');
  });
  await uc('CARD289-05: a 2-option rung (b) imperative says "with the 2 options above"', async () => {
    const res = await gateRender.renderGate({ options: ranked().slice(0, 2) }, { capabilities: { claudeCode: true } });
    assert.ok(res.rendered.askuserquestion_binding.includes('with the 2 options above'), 'binding names ' + countIn(res.rendered.askuserquestion_binding) + ' options above, want 2');
  });

  // --- by value ---
  await uc('by value: exactly one path outside superset_options and zones holds an option id, and it is ' + RECOMMENDED_PATH, () => {
    const hits = pathsWithValue({ rendered: resB.rendered }, IDS, EXCLUDED_PREFIXES);
    assert.deepEqual(hits.map((h) => h.path), [RECOMMENDED_PATH], 'paths found: ' + JSON.stringify(hits));
    assert.equal(hits[0].value, 'opt-b', 'the value must be the top-ranked id');
    console.log('      recommended id JSON path: ' + hits[0].path);
  });

  // --- layering ---
  await uc('layering: the F.8 renderer itself stays recommendation-free (recommended null)', () => {
    const out = renderShapeF8({ options: [{ label: 'x', confidence: null }] });
    assert.equal(out.contract.recommended, null);
  });
}

// ---------------------------------------------------------------------------
// Arm: research
// ---------------------------------------------------------------------------
async function armResearch() {
  const gateRender = require(path.join(REPO, 'lib', 'mcp', 'gate-render.cjs'));
  const research = require(path.join(REPO, 'lib', 'mcp', 'tools', 'research.cjs'));
  // The card shape lib/core/research-planner/grants.cjs grantCard() builds.
  const grantCardShape = {
    shape: 'F.0',
    options: [
      { id: 'approve_standing', label: 'Approve this standing grant (Recommended)', recommended: true },
      { id: 'approve_run', label: 'Approve this one run only' },
      { id: 'not_now', label: 'Not now' },
    ],
  };
  await check('research: _internal.grantOptions is exported', () => {
    assert.equal(typeof research._internal.grantOptions, 'function', 'grantOptions is not exported on research._internal');
  });
  await check('research: grantOptions carries recommended:true on approve_standing only', () => {
    const out = research._internal.grantOptions(grantCardShape, true);
    assert.deepEqual(out.filter((o) => o.recommended === true).map((o) => o.id), ['approve_standing']);
    assert.ok(out.every((o) => o.recommended === undefined || typeof o.recommended === 'boolean'), 'recommended must be a flag, not prose');
  });
  await check('research: normalizeCard over the grantOptions result recommends approve_standing', () => {
    const out = research._internal.grantOptions(grantCardShape, true);
    assert.equal(gateRender.normalizeCard({ options: out }).recommended, 'approve_standing');
  });
}

// ---------------------------------------------------------------------------
// Arm: live (hermetic flag-ON daemon, legacy-mode client with no capabilities)
// ---------------------------------------------------------------------------
function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return !(e && e.code === 'ESRCH');
  }
}

function startDaemon(hermeticEnv, LOCAL_SERVER) {
  const hermetic = hermeticEnv({ MINDRIAN_TRANSPORT: 'http', MINDRIAN_MCP_FIRST: 'cowork' });
  const roomsHome = hermetic.dirs.roomsHome;
  const roomX = path.join(roomsHome, 'room-x');
  fs.mkdirSync(roomX, { recursive: true });
  fs.mkdirSync(path.join(roomsHome, '.rooms'), { recursive: true });
  fs.writeFileSync(path.join(roomsHome, '.rooms', 'registry.json'), JSON.stringify({
    active: 'room-267',
    rooms: {
      'room-x': { slug: 'room-x', abs_path: roomX },
      'room-267': { slug: 'room-267', abs_path: hermetic.dirs.roomDir },
    },
  }, null, 2));
  const child = cp.spawn('node', [LOCAL_SERVER], { cwd: REPO, env: hermetic.env, stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      try { process.kill(child.pid, 'SIGKILL'); } catch (_e) { /* gone */ }
      hermetic.cleanup();
      reject(new Error('daemon did not report its port within 30s; stderr: ' + stderr.slice(-300)));
    }, 30000);
    child.stderr.on('data', (c) => {
      stderr += c.toString('utf8');
      const m = stderr.match(/HTTP on 127\.0\.0\.1:(\d+)/);
      if (m) {
        clearTimeout(timer);
        resolve({ child, hermetic, port: Number(m[1]), roomX });
      }
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      hermetic.cleanup();
      reject(new Error('daemon exited early (code ' + code + '); stderr: ' + stderr.slice(-300)));
    });
  });
}

async function armLive() {
  let sdk;
  let wire;
  try {
    sdk = require('@modelcontextprotocol/client');
    wire = require('./helpers/mcp-wire-267.cjs');
  } catch (e) {
    envGap = true;
    console.log('ENV GAP: the MCP client package or the wire helper cannot be required (' + ((e && e.message) || e) + ')');
    return;
  }
  const { Client, StreamableHTTPClientTransport } = sdk;

  let srv = null;
  try {
    srv = await startDaemon(wire.hermeticEnv, wire.LOCAL_SERVER);
  } catch (e) {
    envGap = true;
    console.log('ENV GAP: the flag-ON daemon cannot start (' + ((e && e.message) || e) + ')');
    return;
  }

  let pidfilePid = null;
  try {
    pidfilePid = JSON.parse(fs.readFileSync(path.join(srv.hermetic.dirs.roomsHome, '.rooms', 'daemon', 'mcp-daemon.json'), 'utf8')).pid;
  } catch (_e) { /* no pidfile: the spawned child is the only pid */ }

  const client = new Client({ name: 'test-289-contract', version: '1' }, { versionNegotiation: { mode: 'legacy' } });
  const transport = new StreamableHTTPClientTransport(new URL('http://127.0.0.1:' + srv.port + '/mcp'));
  try {
    await client.connect(transport);
    const parse = (res) => {
      const text = res && res.content && res.content[0] && res.content[0].text;
      assert.ok(typeof text === 'string' && text.length > 0, 'tool must return text content');
      const marker = text.indexOf('\n\n## Suggested Next');
      return JSON.parse(marker === -1 ? text : text.slice(0, marker));
    };
    await check('live: a legacy-mode client with no declared capabilities binds room-x', async () => {
      assert.equal(client.getNegotiatedProtocolVersion() === '2026-07-28', false, 'the client must be on the legacy era');
      const bind = parse(await client.callTool({ name: 'room_bind', arguments: { room: 'room-x' } }));
      assert.equal(bind.ok, true, 'room_bind: ' + JSON.stringify(bind).slice(0, 200));
    });
    await check('live: exactly one path outside superset_options and zones holds an option id, it is ' + RECOMMENDED_PATH + ', and its value is opt-top', async () => {
      const body = parse(await client.callTool({
        name: 'gate_render',
        arguments: {
          header: 'Pick one',
          options: [
            { id: 'opt-second', label: 'Second choice', rank: 2 },
            { id: 'opt-top', label: 'Top choice', rank: 1 },
            { id: 'opt-third', label: 'Third choice', rank: 3 },
          ],
        },
      }));
      assert.equal(body.ok, true, 'gate_render: ' + JSON.stringify(body).slice(0, 200));
      const hits = pathsWithValue(body, ['opt-second', 'opt-top', 'opt-third'], EXCLUDED_PREFIXES);
      assert.deepEqual(hits.map((h) => h.path), [RECOMMENDED_PATH], 'paths found: ' + JSON.stringify(hits));
      assert.equal(hits[0].value, 'opt-top', 'the value must be the top-ranked id, got ' + hits[0].value);
      console.log('      recommended id JSON path: ' + hits[0].path);
    });
  } catch (err) {
    failed += 1;
    console.log('FAIL: live harness :: ' + ((err && err.message) ? String(err.message).split('\n')[0] : String(err)));
  } finally {
    try { await client.close(); } catch (_e) { /* best effort */ }
    for (const pid of [srv.child.pid, pidfilePid]) {
      if (typeof pid === 'number') {
        try { process.kill(pid, 'SIGKILL'); } catch (_e) { /* already gone */ }
      }
    }
    await new Promise((r) => setTimeout(r, 300));
    await check('live: no daemon process this test spawned is left alive', () => {
      assert.equal(pidAlive(srv.child.pid), false, 'spawned daemon pid ' + srv.child.pid + ' is still alive');
      if (typeof pidfilePid === 'number') assert.equal(pidAlive(pidfilePid), false, 'pidfile pid ' + pidfilePid + ' is still alive');
    });
    srv.hermetic.cleanup();
  }
}

async function main() {
  const table = { unit: armUnit, research: armResearch, live: armLive };
  for (const id of parseArms(process.argv.slice(2))) {
    if (!table[id]) {
      failed += 1;
      console.log('FAIL: unknown arm ' + id + ' (ids: unit, research, live)');
      continue;
    }
    console.log('-- arm ' + id);
    try {
      await table[id]();
    } catch (err) {
      failed += 1;
      console.log('FAIL: arm ' + id + ' setup :: ' + ((err && err.message) ? String(err.message).split('\n')[0] : String(err)));
    }
  }
  console.log('');
  console.log('RESULT: PASS=' + passed + ' FAIL=' + failed);
  if (failed > 0) process.exit(1);
  process.exit(envGap ? 77 : 0);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
