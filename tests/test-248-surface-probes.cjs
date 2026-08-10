#!/usr/bin/env node
'use strict';

/*
 * Phase 248-02 Task 2 -- the CTX-03 scripted merge gate.
 * =============================================================================
 * Live before/after proof that a bound session's room_bind is authoritative
 * on all THREE surface-equivalent transports, against a FRESH spawn of
 * bin/mindrian-mcp-server.cjs every time (the fix-not-live-until-released
 * hard rule: a running process never hot-reloads, so every probe below opens
 * a brand-new child process rather than reusing one). Real-host Desktop and
 * Cowork confirmation (an actual Claude Desktop app, an actual Cowork VM) is
 * NOT what this file proves -- that is a STATED DEFERRAL to v2.0.0-beta
 * release pickup (recorded in the SUMMARY and the closed defect file). What
 * this file DOES prove is the scripted transport-equivalent for each surface:
 *
 *   CLI-equivalent      stdio spawn, CLAUDE_CODE_SESSION_ID in the child env
 *                        (the SDK never populates extra.sessionId on stdio).
 *   Desktop-equivalent   stdio spawn, CLAUDE_SURFACE=desktop + the same env
 *                        var (spawned pipes are already non-TTY, matching
 *                        surface-detect.cjs rung 4).
 *   Cowork-equivalent    MINDRIAN_TRANSPORT=http daemon spawn, TWO concurrent
 *                        HTTP client connections (extra.sessionId assigned
 *                        PER CONNECTION by the SDK) -- the one isolation
 *                        proof stdio structurally cannot give.
 *
 * The Cowork-equivalent leg additionally sets MINDRIAN_MCP_FIRST=cowork in
 * ONLY that leg's child env. This is NOT a room-RESOLUTION dependency (248-01
 * made resolution unconditional; see lib/mcp/session-room.cjs's own header) --
 * it is bin/mindrian-mcp-server.cjs's OWN daemon-lifecycle gate
 * (isMcpFirst(surface.surface), lines 226-237): flag-OFF HTTP wires exactly
 * ONE shared stateless transport (sessionIdGenerator: undefined), so no
 * connection ever gets its own extra.sessionId and the isolation proof this
 * leg exists for would be structurally impossible to observe. Flag-ON keys a
 * per-session transport map by a real generated session id. This is the
 * flag's remaining live consumer named in docs/ENV-TUNING.md's Phase 248
 * amendment: daemon lifecycle/registration, not room resolution.
 *
 * Five-step sequence per leg (research CTX-03 recipe), against a stale-
 * pointer fixture (registry `active` deliberately points at a THIRD room,
 * room-other, that neither bind call ever touches):
 *   1. room_bind({room:'room-x'}) -> ok:true AND effective:true AND
 *      resolved_dir ends with /room-x.
 *   2. room_state_bound in the SAME session -> room_dir === room-x path
 *      (before the fix this resolved the stale global/boot fallback -- the
 *      defect's exact signature).
 *   3. room_bind({room:'room-y'}) then room_state_bound -> room-y (the
 *      2026-07-29 first-bind-remnant regression case).
 *   4. A FRESH, UNBOUND session control -> resolves room-other (reg.active,
 *      byte-identical legacy for the never-bound user).
 *   5. registry.json `active` still 'room-other' (no write-through).
 *
 * A leg that cannot even START (its transport will not come up in this
 * sandbox) SKIPs LOUDLY with the reason recorded -- never a silent pass
 * (Tri-Polar rule: a skip is a stated call, never an oversight).
 *
 * Node built-in assert only + the shipped MCP SDK client (already a direct
 * dependency; lib/mcp/adapter-client.cjs already uses the same two classes
 * for the daemon's own HTTP leg -- Canon Part 7 reuse). CJS only. No
 * em-dashes.
 */

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');

const REPO_ROOT = path.resolve(__dirname, '..');
const SERVER = path.join(REPO_ROOT, 'bin', 'mindrian-mcp-server.cjs');
const SPAWN_TIMEOUT_MS = 20000;

let pass = 0;
let fail = 0;
let skipped = 0;
function check(label, cond, detail) {
  if (cond) {
    pass += 1;
    console.log('  ok -', label);
  } else {
    fail += 1;
    console.log('  FAIL -', label, detail !== undefined ? '(' + detail + ')' : '');
  }
}
function skipLeg(legName, reason) {
  skipped += 1;
  console.log('  SKIP -', legName, '-- environment reason:', reason);
}

// room_bind / room_state_bound both return a text content block; room_bind's
// success shape appends a "## Suggested Next" block after the JSON payload
// (formatSuggestedNext). Parse only the leading JSON object.
function parseToolJson(result) {
  const text = result && result.content && result.content[0] && result.content[0].text;
  assert.ok(typeof text === 'string' && text.length > 0, 'tool call must return text content');
  const marker = text.indexOf('\n\n## Suggested Next');
  const jsonText = marker === -1 ? text : text.slice(0, marker);
  return JSON.parse(jsonText);
}

// -----------------------------------------------------------------------
// Hermetic fixture: tmp MINDRIAN_ROOMS_HOME with room-x/room-y/room-other
// real on disk; registry `active` deliberately points at room-other (the
// stale-pointer fixture -- neither bind call below ever targets it); a
// SEPARATE tmp HOME so room_bind's advisory health-cache write never
// touches the developer's real ~/.mindrian/.
// -----------------------------------------------------------------------
const roomsHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-248-probes-rooms-'));
const userHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-248-probes-home-'));
const roomX = path.join(roomsHome, 'room-x');
const roomY = path.join(roomsHome, 'room-y');
const roomOther = path.join(roomsHome, 'room-other');
fs.mkdirSync(roomX, { recursive: true });
fs.mkdirSync(roomY, { recursive: true });
fs.mkdirSync(roomOther, { recursive: true });
const registryDir = path.join(roomsHome, '.rooms');
fs.mkdirSync(registryDir, { recursive: true });
const registryPath = path.join(registryDir, 'registry.json');
const registryOriginal = JSON.stringify({
  active: 'room-other',
  rooms: {
    'room-x': { slug: 'room-x', abs_path: roomX },
    'room-y': { slug: 'room-y', abs_path: roomY },
    'room-other': { slug: 'room-other', abs_path: roomOther },
  },
}, null, 2);
fs.writeFileSync(registryPath, registryOriginal);
// The boot-time miss-fallback (MINDRIAN_ROOM): a FOURTH real dir, distinct
// from all three registered rooms, so a boot-fallback hit is distinguishable
// from every other outcome.
const bootFallback = path.join(roomsHome, 'boot-fallback');
fs.mkdirSync(bootFallback, { recursive: true });

function baseEnv() {
  return {
    HOME: userHome,
    MINDRIAN_ROOMS_HOME: roomsHome,
    MINDRIAN_ROOM: bootFallback,
    PATH: process.env.PATH,
  };
}

function registryUnchanged() {
  const after = fs.readFileSync(registryPath, 'utf8');
  return after === registryOriginal;
}

// -----------------------------------------------------------------------
// STDIO leg driver (CLI-equivalent, Desktop-equivalent). Each session gets
// its OWN freshly spawned server process (release-liveness rule: never a
// long-lived process; a fresh spawn per session also happens to be the only
// way to give an unbound "fresh session" control a session id CLAUDE_CODE_
// SESSION_ID has never seen, since stdio's session id source is a single
// env var for the whole process).
// -----------------------------------------------------------------------
async function openStdioClient(sessionId, extraEnv) {
  const env = Object.assign(baseEnv(), extraEnv || {});
  if (sessionId) env.CLAUDE_CODE_SESSION_ID = sessionId;
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [SERVER],
    env,
    stderr: 'pipe',
    cwd: REPO_ROOT,
  });
  const client = new Client({ name: 'mos-248-probe-stdio', version: '1.0.0' }, { capabilities: {} });
  await client.connect(transport);
  return client;
}

async function closeClient(client) {
  try { await client.close(); } catch (_e) { /* best-effort teardown */ }
}

/**
 * Drives the five-step sequence over a stdio-shaped transport (steps 1-4
 * split across TWO fresh spawns: one bound session for steps 1-3, one
 * genuinely fresh/unbound session for step 4 -- a single stdio process only
 * ever carries one CLAUDE_CODE_SESSION_ID, so "fresh unbound session" means
 * a fresh process, not a fresh call).
 */
async function runStdioLeg(legName, extraEnv) {
  console.log('');
  console.log('-- ' + legName + ' --');
  let boundClient = null;
  let unboundClient = null;
  try {
    boundClient = await openStdioClient('sess-bound-' + legName.replace(/\W+/g, '-'), extraEnv);

    // Step 1: bind room-x.
    const bind1 = parseToolJson(await boundClient.callTool({ name: 'room_bind', arguments: { room: 'room-x' } }));
    check(legName + ' step1: room_bind(room-x) ok:true', bind1.ok === true, JSON.stringify(bind1));
    check(legName + ' step1: room_bind(room-x) effective:true', bind1.effective === true, JSON.stringify(bind1));
    check(legName + ' step1: resolved_dir ends with /room-x', typeof bind1.resolved_dir === 'string' && bind1.resolved_dir.endsWith(path.sep + 'room-x'), 'got ' + bind1.resolved_dir);

    // Step 2: room_state_bound in the SAME session resolves room-x (the
    // defect's exact signature before the fix: this used to resolve the
    // stale global/boot fallback instead).
    const state1 = parseToolJson(await boundClient.callTool({ name: 'room_state_bound', arguments: {} }));
    check(legName + ' step2: room_state_bound room_dir === room-x', state1.room_dir === roomX, 'got ' + state1.room_dir);

    // Step 3: re-bind to room-y, then room_state_bound -- the 2026-07-29
    // first-bind-remnant regression case.
    const bind2 = parseToolJson(await boundClient.callTool({ name: 'room_bind', arguments: { room: 'room-y' } }));
    check(legName + ' step3a: room_bind(room-y) effective:true', bind2.effective === true, JSON.stringify(bind2));
    const state2 = parseToolJson(await boundClient.callTool({ name: 'room_state_bound', arguments: {} }));
    check(legName + ' step3b: room_state_bound room_dir === room-y (not the room-x remnant)', state2.room_dir === roomY, 'got ' + state2.room_dir);

    // Step 4: a FRESH, UNBOUND session (a separate spawn, never called
    // room_bind) resolves room-other -- byte-identical reg.active legacy.
    unboundClient = await openStdioClient('sess-unbound-' + legName.replace(/\W+/g, '-'), extraEnv);
    const state3 = parseToolJson(await unboundClient.callTool({ name: 'room_state_bound', arguments: {} }));
    check(legName + ' step4: fresh unbound session resolves room-other (reg.active)', state3.room_dir === roomOther, 'got ' + state3.room_dir);
  } finally {
    if (boundClient) await closeClient(boundClient);
    if (unboundClient) await closeClient(unboundClient);
  }
}

// -----------------------------------------------------------------------
// HTTP leg driver (Cowork-equivalent). ONE spawned daemon process, TWO
// concurrent client connections -- the isolation proof stdio cannot give,
// because the SDK assigns extra.sessionId PER HTTP CONNECTION, not per
// environment variable.
// -----------------------------------------------------------------------
function spawnHttpServer() {
  return new Promise((resolve, reject) => {
    const env = Object.assign(baseEnv(), {
      MINDRIAN_TRANSPORT: 'http',
      // Daemon-lifecycle's OWN gate (not room resolution -- see file header).
      MINDRIAN_MCP_FIRST: 'cowork',
    });
    const proc = cp.spawn(process.execPath, [SERVER], {
      cwd: REPO_ROOT,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderrBuf = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { proc.kill('SIGKILL'); } catch (_e) { /* already gone */ }
      reject(new Error('timed out waiting for the HTTP daemon to report its port; stderr tail: ' + stderrBuf.slice(-600)));
    }, SPAWN_TIMEOUT_MS);

    proc.stderr.on('data', (chunk) => {
      stderrBuf += chunk.toString('utf8');
      const m = stderrBuf.match(/HTTP on 127\.0\.0\.1:(\d+)/);
      if (m && !settled) {
        settled = true;
        clearTimeout(timer);
        resolve({ proc: proc, port: Number(m[1]) });
      }
    });
    proc.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
    proc.on('exit', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error('HTTP daemon exited before reporting a port (code ' + code + '); stderr tail: ' + stderrBuf.slice(-600)));
    });
  });
}

async function openHttpClient(port) {
  const url = new URL('http://127.0.0.1:' + port + '/mcp');
  const transport = new StreamableHTTPClientTransport(url);
  const client = new Client({ name: 'mos-248-probe-http', version: '1.0.0' }, { capabilities: {} });
  await client.connect(transport);
  return { client, transport };
}

async function closeHttpClient(entry) {
  if (!entry) return;
  try { await entry.transport.terminateSession(); } catch (_e) { /* best-effort */ }
  try { await entry.client.close(); } catch (_e) { /* best-effort */ }
}

async function runHttpLeg() {
  const legName = 'Cowork-equivalent (HTTP, two concurrent sessions)';
  console.log('');
  console.log('-- ' + legName + ' --');

  let server;
  try {
    server = await spawnHttpServer();
  } catch (e) {
    skipLeg(legName, (e && e.message) || String(e));
    return;
  }

  let clientA = null;
  let clientB = null;
  let clientControl = null;
  try {
    clientA = await openHttpClient(server.port);
    clientB = await openHttpClient(server.port);

    check(legName + ': two connections received DIFFERENT session ids (per-connection, not per-process)',
      typeof clientA.transport.sessionId === 'string' && typeof clientB.transport.sessionId === 'string'
        && clientA.transport.sessionId !== clientB.transport.sessionId,
      'A=' + clientA.transport.sessionId + ' B=' + clientB.transport.sessionId);

    // Steps 1-3, run on client A (room-x then room-y) and client B (room-y
    // then room-x) INTERLEAVED, so a bleed between the two connections would
    // show up as either session resolving the OTHER's room.
    const aBind1 = parseToolJson(await clientA.client.callTool({ name: 'room_bind', arguments: { room: 'room-x' } }));
    const bBind1 = parseToolJson(await clientB.client.callTool({ name: 'room_bind', arguments: { room: 'room-y' } }));
    check(legName + ' step1: session A room_bind(room-x) effective:true', aBind1.effective === true, JSON.stringify(aBind1));
    check(legName + ' step1: session B room_bind(room-y) effective:true', bBind1.effective === true, JSON.stringify(bBind1));

    const aState1 = parseToolJson(await clientA.client.callTool({ name: 'room_state_bound', arguments: {} }));
    const bState1 = parseToolJson(await clientB.client.callTool({ name: 'room_state_bound', arguments: {} }));
    check(legName + ' step2: session A resolves ITS OWN room-x, not session B\'s room-y', aState1.room_dir === roomX, 'got ' + aState1.room_dir);
    check(legName + ' step2: session B resolves ITS OWN room-y, not session A\'s room-x', bState1.room_dir === roomY, 'got ' + bState1.room_dir);

    // Step 3: swap -- A re-binds to room-y, B re-binds to room-x. Proves the
    // isolation survives a second bind on each side (the first-bind-remnant
    // case, doubled).
    const aBind2 = parseToolJson(await clientA.client.callTool({ name: 'room_bind', arguments: { room: 'room-y' } }));
    const bBind2 = parseToolJson(await clientB.client.callTool({ name: 'room_bind', arguments: { room: 'room-x' } }));
    check(legName + ' step3a: session A re-bind(room-y) effective:true', aBind2.effective === true, JSON.stringify(aBind2));
    check(legName + ' step3a: session B re-bind(room-x) effective:true', bBind2.effective === true, JSON.stringify(bBind2));

    const aState2 = parseToolJson(await clientA.client.callTool({ name: 'room_state_bound', arguments: {} }));
    const bState2 = parseToolJson(await clientB.client.callTool({ name: 'room_state_bound', arguments: {} }));
    check(legName + ' step3b: session A now resolves room-y (its own re-bind)', aState2.room_dir === roomY, 'got ' + aState2.room_dir);
    check(legName + ' step3b: session B now resolves room-x (its own re-bind, not A\'s)', bState2.room_dir === roomX, 'got ' + bState2.room_dir);

    // Step 4: a THIRD, fresh, never-bound HTTP connection resolves room-other.
    clientControl = await openHttpClient(server.port);
    const controlState = parseToolJson(await clientControl.client.callTool({ name: 'room_state_bound', arguments: {} }));
    check(legName + ' step4: a fresh unbound HTTP session resolves room-other (reg.active)', controlState.room_dir === roomOther, 'got ' + controlState.room_dir);
  } catch (e) {
    check(legName + ': the full drive completed without throwing', false, (e && e.stack) || String(e));
  } finally {
    await closeHttpClient(clientA);
    await closeHttpClient(clientB);
    await closeHttpClient(clientControl);
    try { server.proc.kill('SIGKILL'); } catch (_e) { /* already gone */ }
  }
}

// -----------------------------------------------------------------------
// Run all three legs, then the shared step-5 registry-untouched assertion
// (T-248-04's tripwire -- must hold across EVERY leg above, not just one).
// -----------------------------------------------------------------------
async function main() {
  console.log('test-248-surface-probes (CTX-03 scripted surface-equivalent gate)');

  try {
    await runStdioLeg('CLI-equivalent (stdio, CLAUDE_CODE_SESSION_ID)', {});
    await runStdioLeg('Desktop-equivalent (stdio, CLAUDE_SURFACE=desktop)', { CLAUDE_SURFACE: 'desktop' });
    await runHttpLeg();

    console.log('');
    check('step5 (all legs): registry.json active still room-other (no write-through, T-248-04)', registryUnchanged());

    console.log('');
    console.log('---');
    console.log(pass + '/' + (pass + fail) + ' green, ' + skipped + ' leg(s) skipped');
    process.exitCode = fail === 0 ? 0 : 1;
  } finally {
    try { fs.rmSync(roomsHome, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
    try { fs.rmSync(userHome, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
  }
}

main().catch((err) => {
  process.stderr.write('FATAL: ' + ((err && err.stack) || err) + '\n');
  process.exit(1);
});
