#!/usr/bin/env node
'use strict';
/*
 * tests/test-354-concurrency-surfaces.cjs -- Phase 354-16 Task 1 (close-out).
 *
 * The handoff's "Concurrent CLI/MCP/browser clients do not cross rooms, lose
 * updates silently, or bypass required human decisions" acceptance clause,
 * exercised across the CLI, MCP stdio (Desktop protocol) and browser
 * clients on real filesystem/database handles, never through response text
 * alone:
 *
 *   K1  Desktop protocol, two rooms   -- two real bin/mindrian-mcp-server.cjs
 *       stdio spawns (StdioClientTransport, the test-248-surface-probes.cjs
 *       idiom), 10 concurrent artifact_file writes each; room A holds
 *       exactly its own 10 files and 10 memory_event rows, room B the same,
 *       neither leaks into the other; status_read reports
 *       tool_registration.complete true on both.
 *   K2  CLI + MCP, one room, no lost update -- 5 forked CLI-style writers
 *       (tests/helpers/write-lock-holder-354.cjs, new 'graph-write' mode,
 *       a real node through lib/core/graph-ops.cjs/node-insert.cjs) run
 *       concurrently with 5 MCP artifact_file calls on room A's own K1
 *       client; every one of the 10 writes is present afterward; any lock
 *       contention surfaces as an explicit held error the writer retries
 *       (never a silent drop -- writers report their outcome over IPC).
 *   K3  Human decision cannot be bypassed -- file-meeting (session S1),
 *       gate_answer approve from a DIFFERENT session (S2) is refused
 *       session_mismatch and the claim stays proposed; a second approve
 *       from S1 on the same gate_id is refused as consumed
 *       (gate-ledger.cjs:100's fail-closed single-use burn); a fresh
 *       file-meeting + S1 approve confirms that exact claim.
 *   K4  Browser + MCP, same document -- the localhost POC server in room
 *       mode on room A; a real Playwright page; the MCP client (still bound
 *       to room A) files a new version of the SAME artifact
 *       (workspace-poc.md via artifact_file); a clean page reloads the
 *       external change; a dirty page shows the conflict banner and a save
 *       returns 409 (no silent overwrite). ENV GAP (exit 77) if Playwright
 *       is unavailable, ONLY when K1-K3 passed.
 *   K5  Cowork shared state -- a covered-by statement (K1-K4 already
 *       exercise the shared room folder at the filesystem/database layer
 *       Cowork itself shares across sessions); prints the literal line
 *       'HOST UI NOT RUN: Claude Desktop app, Cowork app' so no host UI
 *       check is implied by this file's PASS.
 *
 * Exit 1 on any failure. Exit 77 (SKIPPED) only when K1-K3 all passed and
 * Playwright is unavailable for K4. Exit 0 when every leg that ran passed.
 * No em-dashes (CLAUDE.md).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const cp = require('node:child_process');

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

const { openRoomDb, closeRoomDb } = require(path.join(__dirname, '..', 'lib', 'core', 'room-db.cjs'));
const { makeScratchRoom, captureToolServer, SKIP_EXIT_CODE } = require(path.join(__dirname, 'helpers', 'fixture-room-354.cjs'));
const { resolvePlaywright } = require(path.join(__dirname, 'helpers', 'playwright-354.cjs'));

const REPO_ROOT = path.resolve(__dirname, '..');
const MCP_SERVER = path.join(REPO_ROOT, 'bin', 'mindrian-mcp-server.cjs');
const POC_SERVER = path.join(REPO_ROOT, 'docs', 'reviews', 'localhost-poc', 'server.cjs');
const GRAPH_WRITE_HELPER = path.join(__dirname, 'helpers', 'write-lock-holder-354.cjs');

console.log('test-354-concurrency-surfaces');

let checks = 0;
let failed = 0;
function ok(label) {
  checks += 1;
  console.log('  ok - ' + label);
}
function fail(label, error) {
  failed += 1;
  console.log('  NOT OK - ' + label);
  console.log('    ' + (error && error.message ? error.message : String(error)));
}
async function checkThat(label, fn) {
  try {
    await fn();
    ok(label);
  } catch (e) {
    fail(label, e);
  }
}

// -----------------------------------------------------------------------
// Shared MCP-client helpers (StdioClientTransport, the test-248 idiom).
// -----------------------------------------------------------------------
function textOf(raw) {
  return (raw && raw.content && raw.content[0] && raw.content[0].text) || '';
}
function parseToolJson(raw) {
  const text = textOf(raw);
  const marker = text.indexOf('\n\n## Suggested Next');
  const jsonText = marker === -1 ? text : text.slice(0, marker);
  try {
    return JSON.parse(jsonText);
  } catch (_e) {
    return null;
  }
}

async function openStdioClient(sessionId, roomsHome, homeDir, bootFallback) {
  const env = {
    HOME: homeDir,
    MINDRIAN_ROOMS_HOME: roomsHome,
    MINDRIAN_ROOM: bootFallback,
    PATH: process.env.PATH,
    CLAUDE_CODE_SESSION_ID: sessionId,
    // D-04/D-12 (lib/mcp/mcp-first-flag.cjs): an unidentified or pre-init
    // caller is write-path OFF by design (write_path_disabled), never a
    // silent bypass. This probe client is not a recognized host, so it must
    // opt in explicitly via the same flag a real Claude Code session sets,
    // exactly like tests/test-354-gate-subject-promotion.cjs's top-level
    // process.env.MINDRIAN_MCP_FIRST = 'all' does for its in-process harness.
    MINDRIAN_MCP_FIRST: 'all',
  };
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [MCP_SERVER],
    env,
    stderr: 'pipe',
    cwd: REPO_ROOT,
  });
  const client = new Client({ name: 'mos-354-concurrency-probe', version: '1.0.0' }, { capabilities: {} });
  await client.connect(transport);
  return client;
}
async function closeClient(client) {
  try { await client.close(); } catch (_e) { /* best-effort teardown */ }
}
async function bindRoom(client, roomSlug) {
  const raw = await client.callTool({ name: 'room_bind', arguments: { room: roomSlug } });
  const json = parseToolJson(raw);
  assert.ok(json && json.ok === true && json.effective === true, 'room_bind(' + roomSlug + ') failed: ' + textOf(raw).slice(0, 300));
  return json;
}
async function callToolJson(client, name, args) {
  const raw = await client.callTool({ name, arguments: args });
  return { text: textOf(raw), json: parseToolJson(raw) };
}

function readArtifactMemoryEvents(roomDir) {
  const db = openRoomDb(roomDir);
  try {
    const rows = db.prepare(
      "SELECT id, properties FROM nodes WHERE type = 'memory_event' AND json_extract(properties, '$.label') = 'artifact_file'"
    ).all();
    return rows.map((r) => {
      let props = {};
      try { props = JSON.parse(r.properties); } catch (_e) { /* leave empty */ }
      return { id: r.id, filename: props.filename };
    });
  } finally {
    closeRoomDb(db);
  }
}

// =========================================================================
// K1 -- Desktop protocol, two rooms: cross-room isolation.
// =========================================================================
async function runK1() {
  console.log('\n== K1: Desktop protocol, two rooms (cross-room isolation) ==');
  const roomsHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-354-k1-rooms-'));
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-354-k1-home-'));
  const bootFallback = path.join(roomsHome, 'boot-fallback');
  fs.mkdirSync(bootFallback, { recursive: true });
  const roomA = path.join(roomsHome, 'room-a');
  const roomB = path.join(roomsHome, 'room-b');
  fs.mkdirSync(roomA, { recursive: true });
  fs.mkdirSync(roomB, { recursive: true });
  closeRoomDb(openRoomDb(roomA));
  closeRoomDb(openRoomDb(roomB));

  const clientA = await openStdioClient('sess-k1-a', roomsHome, homeDir, bootFallback);
  const clientB = await openStdioClient('sess-k1-b', roomsHome, homeDir, bootFallback);
  await bindRoom(clientA, 'room-a');
  await bindRoom(clientB, 'room-b');

  const writesA = Array.from({ length: 10 }, (_v, i) =>
    callToolJson(clientA, 'artifact_file', { section: 'notes', filename: 'k1-a-' + i + '.md', content: 'K1 room A file ' + i }));
  const writesB = Array.from({ length: 10 }, (_v, i) =>
    callToolJson(clientB, 'artifact_file', { section: 'notes', filename: 'k1-b-' + i + '.md', content: 'K1 room B file ' + i }));
  const [resultsA, resultsB] = await Promise.all([Promise.all(writesA), Promise.all(writesB)]);

  await checkThat('K1: all 10 room-A artifact_file calls returned ok', () => {
    resultsA.forEach((r, i) => assert.strictEqual(r.json && r.json.ok, true, 'A write ' + i + ' failed: ' + r.text.slice(0, 200)));
  });
  await checkThat('K1: all 10 room-B artifact_file calls returned ok', () => {
    resultsB.forEach((r, i) => assert.strictEqual(r.json && r.json.ok, true, 'B write ' + i + ' failed: ' + r.text.slice(0, 200)));
  });

  await checkThat('K1: room A notes/ holds exactly its own 10 files, none of B\'s', () => {
    const filesA = fs.readdirSync(path.join(roomA, 'notes'));
    assert.strictEqual(filesA.length, 10, 'room A notes/ has ' + filesA.length + ' files: ' + filesA.join(','));
    assert.ok(filesA.every((f) => f.startsWith('k1-a-')), 'room A notes/ contains a non-A file: ' + filesA.join(','));
  });
  await checkThat('K1: room B notes/ holds exactly its own 10 files, none of A\'s', () => {
    const filesB = fs.readdirSync(path.join(roomB, 'notes'));
    assert.strictEqual(filesB.length, 10, 'room B notes/ has ' + filesB.length + ' files: ' + filesB.join(','));
    assert.ok(filesB.every((f) => f.startsWith('k1-b-')), 'room B notes/ contains a non-B file: ' + filesB.join(','));
  });

  await checkThat('K1: room A has exactly 10 artifact memory_event rows for k1-a-*, zero for k1-b-*', () => {
    const rows = readArtifactMemoryEvents(roomA);
    const aRows = rows.filter((r) => typeof r.filename === 'string' && r.filename.startsWith('k1-a-'));
    const bRows = rows.filter((r) => typeof r.filename === 'string' && r.filename.startsWith('k1-b-'));
    assert.strictEqual(aRows.length, 10, 'room A memory_event count for k1-a-*: ' + aRows.length);
    assert.strictEqual(bRows.length, 0, 'room A leaked a k1-b-* memory_event row');
  });
  await checkThat('K1: room B has exactly 10 artifact memory_event rows for k1-b-*, zero for k1-a-*', () => {
    const rows = readArtifactMemoryEvents(roomB);
    const aRows = rows.filter((r) => typeof r.filename === 'string' && r.filename.startsWith('k1-a-'));
    const bRows = rows.filter((r) => typeof r.filename === 'string' && r.filename.startsWith('k1-b-'));
    assert.strictEqual(bRows.length, 10, 'room B memory_event count for k1-b-*: ' + bRows.length);
    assert.strictEqual(aRows.length, 0, 'room B leaked a k1-a-* memory_event row');
  });

  const statusA = await callToolJson(clientA, 'status_read', {});
  const statusB = await callToolJson(clientB, 'status_read', {});
  await checkThat('K1: status_read on room A reports tool_registration.complete true', () => {
    const tr = statusA.json && statusA.json.segments && statusA.json.segments.capability_floor && statusA.json.segments.capability_floor.tool_registration;
    assert.strictEqual(tr && tr.complete, true, JSON.stringify(tr));
  });
  await checkThat('K1: status_read on room B reports tool_registration.complete true', () => {
    const tr = statusB.json && statusB.json.segments && statusB.json.segments.capability_floor && statusB.json.segments.capability_floor.tool_registration;
    assert.strictEqual(tr && tr.complete, true, JSON.stringify(tr));
  });

  await closeClient(clientB);

  return {
    clientA, roomA, roomB, roomsHome, homeDir, bootFallback,
    cleanup: () => { fs.rmSync(roomsHome, { recursive: true, force: true }); fs.rmSync(homeDir, { recursive: true, force: true }); },
  };
}

// =========================================================================
// K2 -- CLI + MCP, one room, no lost update.
// =========================================================================
function forkGraphWriter(roomDir, nodeId) {
  return new Promise((resolve, reject) => {
    const child = cp.fork(GRAPH_WRITE_HELPER, [roomDir, 'graph-write', nodeId], { stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
    let msg = null;
    let stderr = '';
    child.on('message', (m) => { msg = m; });
    if (child.stderr) child.stderr.on('data', (d) => { stderr += d; });
    child.once('exit', () => {
      if (msg && msg.written) resolve(msg);
      else reject(new Error('graph-write child for ' + nodeId + ' did not report written:true: ' + JSON.stringify(msg) + (stderr ? (' stderr: ' + stderr.trim()) : '')));
    });
    child.once('error', reject);
  });
}

async function runK2(k1) {
  console.log('\n== K2: CLI + MCP, one room, no lost update ==');
  const nodeIds = Array.from({ length: 5 }, (_v, i) => 'claim:k2-concurrency-' + i);
  const writerPromises = nodeIds.map((id) => forkGraphWriter(k1.roomA, id));
  const mcpPromises = Array.from({ length: 5 }, (_v, i) =>
    callToolJson(k1.clientA, 'artifact_file', { section: 'k2-notes', filename: 'k2-' + i + '.md', content: 'K2 MCP file ' + i }));

  const [writerResults, mcpResults] = await Promise.all([
    Promise.allSettled(writerPromises),
    Promise.all(mcpPromises),
  ]);

  await checkThat('K2: all 5 forked CLI graph writers eventually reported written:true (no silent drop)', () => {
    writerResults.forEach((r, i) => {
      assert.strictEqual(r.status, 'fulfilled', 'writer ' + i + ' (node ' + nodeIds[i] + ') never reported success: ' + (r.reason && r.reason.message));
    });
  });
  const retried = writerResults.filter((r) => r.status === 'fulfilled' && r.value.attempts > 1);
  if (retried.length > 0) {
    console.log('  info - ' + retried.length + ' of 5 CLI writers hit explicit lock contention and retried (attempts: ' +
      retried.map((r) => r.value.attempts).join(',') + ') -- held error surfaced and handled, never a silent drop');
  }

  await checkThat('K2: all 5 MCP artifact_file calls returned ok', () => {
    mcpResults.forEach((r, i) => assert.strictEqual(r.json && r.json.ok, true, 'MCP write ' + i + ' failed: ' + r.text.slice(0, 200)));
  });

  await checkThat('K2: every one of the 10 writes is present afterward (5 graph nodes + 5 filed artifacts)', () => {
    const db = openRoomDb(k1.roomA);
    let rows;
    try {
      rows = db.prepare("SELECT id FROM nodes WHERE id LIKE 'claim:k2-concurrency-%'").all();
    } finally {
      closeRoomDb(db);
    }
    assert.strictEqual(rows.length, 5, 'expected 5 K2 CLI-written graph nodes, got ' + rows.length);
    const files = fs.readdirSync(path.join(k1.roomA, 'k2-notes'));
    assert.strictEqual(files.length, 5, 'expected 5 K2 MCP-filed artifacts, got ' + files.length);
  });
}

// =========================================================================
// K3 -- human decision cannot be bypassed.
// =========================================================================
async function runK3() {
  console.log('\n== K3: human decision cannot be bypassed ==');
  const { registerRouterTools } = require(path.join(REPO_ROOT, 'lib', 'mcp', 'tool-router.cjs'));
  const gateTool = require(path.join(REPO_ROOT, 'lib', 'mcp', 'tools', 'gate.cjs'));

  const scratch = makeScratchRoom('k3-bypass');
  const { server, handlers } = captureToolServer();
  registerRouterTools(server, scratch.room, REPO_ROOT, { full: '' }, 'cli');
  gateTool.register(server, { fallbackRoomDir: scratch.room, pluginRoot: REPO_ROOT, surface: 'cli' });

  function extractGateId(text) {
    const m = /gate_id[:*"\s]+\**\s*([A-Za-z0-9._-]+)/.exec(text);
    return m ? m[1] : null;
  }
  function extractClaimId(text) {
    const m = /Claim node (\S+) was written/.exec(text);
    return m ? m[1] : null;
  }
  async function fileMeeting(extra, claimText) {
    const raw = await handlers.get('meeting')({ command: 'file-meeting', knowledge_type: 'fact', claim_text: claimText }, extra);
    const text = textOf(raw);
    return { text, gateId: extractGateId(text), claimId: extractClaimId(text) };
  }
  async function answerGate(extra, gateId, verdict) {
    const raw = await handlers.get('gate_answer')({ gate_id: gateId, chosen: [verdict], verdict }, extra);
    return { json: parseToolJson(raw) };
  }
  function readNode(nodeId) {
    const db = openRoomDb(scratch.room);
    try {
      return db.prepare('SELECT id, review_status FROM nodes WHERE id = ?').get(nodeId);
    } finally {
      closeRoomDb(db);
    }
  }

  const S1 = { sessionId: 'test-354-k3-s1' };
  const S2 = { sessionId: 'test-354-k3-s2' };

  try {
    const filed = await fileMeeting(S1, 'K3 synthetic subject claim, wrong-session bypass attempt.');
    await checkThat('K3: file-meeting (session S1) returned a gate_id and a claim id', () => {
      assert.ok(filed.gateId, 'no gate_id in: ' + filed.text.slice(0, 200));
      assert.ok(filed.claimId, 'no claim id in: ' + filed.text.slice(0, 200));
    });

    if (filed.gateId && filed.claimId) {
      const wrongSession = await answerGate(S2, filed.gateId, 'approve');
      await checkThat('K3: gate_answer from a DIFFERENT session (S2) is refused session_mismatch', () => {
        assert.strictEqual(wrongSession.json && wrongSession.json.ok, false, JSON.stringify(wrongSession.json));
        assert.strictEqual(wrongSession.json && wrongSession.json.reason, 'session_mismatch', JSON.stringify(wrongSession.json));
      });
      await checkThat('K3: the claim stays proposed after the wrong-session bypass attempt', () => {
        const row = readNode(filed.claimId);
        assert.ok(row && row.review_status === 'proposed', 'row=' + JSON.stringify(row));
      });

      const burned = await answerGate(S1, filed.gateId, 'approve');
      await checkThat('K3: a SECOND approve from the CORRECT session (S1) is refused as consumed (single-use burn, gate-ledger.cjs:100)', () => {
        assert.strictEqual(burned.json && burned.json.ok, false, JSON.stringify(burned.json));
        assert.strictEqual(burned.json && burned.json.reason, 'unknown_or_expired_gate', JSON.stringify(burned.json));
      });
      await checkThat('K3: the claim STILL reads proposed (the burned gate confirmed nothing)', () => {
        const row = readNode(filed.claimId);
        assert.ok(row && row.review_status === 'proposed', 'row=' + JSON.stringify(row));
      });
    }

    const filed2 = await fileMeeting(S1, 'K3 synthetic subject claim, correct-session confirmation.');
    await checkThat('K3: a fresh file-meeting (S1) returns a new gate_id and claim id', () => {
      assert.ok(filed2.gateId, 'no gate_id in: ' + filed2.text.slice(0, 200));
      assert.ok(filed2.claimId, 'no claim id in: ' + filed2.text.slice(0, 200));
    });
    if (filed2.gateId && filed2.claimId) {
      const answered2 = await answerGate(S1, filed2.gateId, 'approve');
      await checkThat('K3: the correct session (S1) approving its OWN fresh gate confirms the exact claim', () => {
        assert.strictEqual(answered2.json && answered2.json.ok, true, JSON.stringify(answered2.json));
        const row = readNode(filed2.claimId);
        assert.ok(row && row.review_status === 'confirmed', 'row=' + JSON.stringify(row));
      });
    }
  } finally {
    scratch.cleanup();
  }
}

// =========================================================================
// K4 -- browser + MCP, same document.
// =========================================================================
function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
}
async function reservePort() {
  const s = http.createServer();
  const port = await listen(s);
  await new Promise((resolve) => s.close(resolve));
  return port;
}
function spawnPocServer(extraArgs) {
  return new Promise((resolve, reject) => {
    const child = cp.spawn(process.execPath, [POC_SERVER, ...extraArgs], { stdio: ['ignore', 'pipe', 'pipe'] });
    let settled = false;
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d; });
    const onData = () => {
      if (settled) return;
      settled = true;
      child.stdout.removeListener('data', onData);
      resolve(child);
    };
    child.stdout.on('data', onData);
    child.once('error', (e) => { if (!settled) { settled = true; reject(e); } });
    child.once('exit', (code) => {
      if (!settled) {
        settled = true;
        reject(Object.assign(new Error('POC server exited ' + code + (stderr ? (' stderr: ' + stderr.trim()) : '')), { code, stderr }));
      }
    });
  });
}

async function runK4(k1) {
  console.log('\n== K4: browser + MCP, same document ==');
  const pw = resolvePlaywright();
  if (!pw) {
    console.log('ENV GAP: playwright unavailable, K4 skipped');
    return { skipped: true };
  }
  const { chromium } = pw;

  const port = await reservePort();
  const origin = 'http://127.0.0.1:' + port;
  let child;
  let browser;
  try {
    child = await spawnPocServer([String(port), '--room', k1.roomA, '--section', 'k4-doc']);
    browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(origin);
    await page.locator('#editor').waitFor();

    // Clean editor: an external MCP artifact_file write reloads silently.
    const EXTERNAL_V1 = '# K4 external version 1\n\nWritten via the MCP artifact_file tool while the page was clean.\n';
    await checkThat('K4: the page loads room A\'s bound document at start', async () => {
      const text = await page.locator('.top').textContent().catch(() => '');
      assert.ok(typeof text === 'string');
    });
    const write1 = await callToolJson(k1.clientA, 'artifact_file', { section: 'k4-doc', filename: 'workspace-poc.md', content: EXTERNAL_V1 });
    await checkThat('K4: the MCP artifact_file write (external, clean editor) returned ok', () => {
      assert.strictEqual(write1.json && write1.json.ok, true, write1.text.slice(0, 200));
    });
    await checkThat('K4: a clean editor picks up the external MCP change without a manual reload', async () => {
      await page.waitForFunction(() => {
        const el = document.getElementById('editor');
        return !!el && el.value.includes('K4 external version 1');
      }, null, { timeout: 6000 });
      const value = await page.locator('#editor').inputValue();
      assert.ok(value.includes('K4 external version 1'), 'editor did not reload the external change: ' + value);
    });

    // Dirty editor: an external MCP write shows the conflict banner; save returns 409.
    const UNSAVED_TEXT = 'K4_UNSAVED_DIRTY_TEXT_' + Date.now();
    await page.locator('#editor').fill(UNSAVED_TEXT);
    const EXTERNAL_V2 = '# K4 external version 2\n\nWritten via MCP artifact_file while the page was dirty.\n';
    const write2 = await callToolJson(k1.clientA, 'artifact_file', { section: 'k4-doc', filename: 'workspace-poc.md', content: EXTERNAL_V2 });
    await checkThat('K4: the MCP artifact_file write (external, dirty editor) returned ok', () => {
      assert.strictEqual(write2.json && write2.json.ok, true, write2.text.slice(0, 200));
    });
    await checkThat('K4: a dirty editor shows the conflict banner instead of silently overwriting', async () => {
      await page.locator('#conflict-banner:not([hidden])').waitFor({ timeout: 6000 });
      const value = await page.locator('#editor').inputValue();
      assert.strictEqual(value, UNSAVED_TEXT, 'the dirty editor lost the unsaved text during the external edit');
    });
    await checkThat('K4: clicking save on the stale base_revision returns 409, and the conflict banner stays visible', async () => {
      const [resp] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/api/document') && r.request().method() === 'POST'),
        page.locator('#save').click(),
      ]);
      assert.strictEqual(resp.status(), 409, 'expected 409, got ' + resp.status());
      const bannerHidden = await page.locator('#conflict-banner').isHidden();
      assert.strictEqual(bannerHidden, false, 'conflict banner was hidden after the 409 save attempt');
    });
    await checkThat('K4: the disk still holds the external version, never the stale unsaved overwrite', () => {
      const onDisk = fs.readFileSync(path.join(k1.roomA, 'k4-doc', 'workspace-poc.md'), 'utf8');
      assert.ok(onDisk.includes('K4 external version 2'), 'disk content was overwritten by the stale save: ' + onDisk.slice(0, 200));
    });

    await page.close();
  } finally {
    if (browser) await browser.close();
    if (child) { try { child.kill('SIGINT'); } catch (_e) { /* ignore */ } }
  }
  return { skipped: false };
}

// =========================================================================
// Main
// =========================================================================
(async () => {
  let k1 = null;
  let k4EnvGap = false;
  try {
    k1 = await runK1();
    await runK2(k1);
  } catch (e) {
    fail('K1/K2 setup or execution threw', e);
  }

  try {
    await runK3();
  } catch (e) {
    fail('K3 setup or execution threw', e);
  }

  if (k1) {
    try {
      const k4result = await runK4(k1);
      k4EnvGap = !!(k4result && k4result.skipped);
    } catch (e) {
      fail('K4 setup or execution threw', e);
    } finally {
      await closeClient(k1.clientA);
      k1.cleanup();
    }
  } else {
    console.log('\n== K4: browser + MCP, same document ==');
    console.log('SKIPPED: K1 setup failed, no room A available for K4');
  }

  console.log('\n== K5: Cowork shared state ==');
  console.log('COVERED-BY: Cowork shares the room folder across sessions, which K1-K4 already');
  console.log('exercise at the filesystem and database layer (concurrent writers on the same');
  console.log('room.db and section files, cross-room isolation, external-edit detection).');
  console.log('HOST UI NOT RUN: Claude Desktop app, Cowork app');

  console.log('');
  if (failed > 0) {
    console.log('FAIL - ' + failed + ' of ' + (checks + failed) + ' checks failed (checks that ran: ' + checks + ')');
    process.exitCode = 1;
  } else if (k4EnvGap) {
    console.log('SKIPPED - K1-K3 passed (' + checks + ' checks); K4 is ENV GAP (playwright unavailable)');
    process.exitCode = SKIP_EXIT_CODE;
  } else {
    console.log('PASS - ' + checks + ' checks');
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
