#!/usr/bin/env node
'use strict';
/*
 * tests/test-354-poc-room-journey.cjs -- Phase 354-11 (SYS-06, the handoff's
 * full browser-to-room-to-graph journey).
 *
 * Proves the complete acceptance journey the handoff names: bind a room,
 * edit/save/reopen the working file, see it indexed through the governed
 * artifact_file path (memory_event + claim:artifact node), inspect it on
 * the graph tab, ask the local graph a grounded question and get an answer
 * with references, and see an external edit appear without a manual reload
 * (plus a conflict banner when the editor is dirty). Also proves room
 * isolation (J8): a server bound to room A never reads or writes room B.
 *
 * Seeded from tests/test-354-poc-save-origin.cjs's spawn/reserve-port idiom
 * and tests/helpers/{playwright-354,fixture-room-354}.cjs (Canon Part 7,
 * reuse before build). Unlike save-origin (which copies the POC into a
 * scratch dir with no repo tree beside it, so it can validate fixture-mode
 * safety in isolation), this test spawns server.cjs directly from its real
 * location in the repo -- room mode requires the ROOT-relative
 * lib/core/navigation.cjs and lib/mcp/tools/views.cjs requires to resolve
 * against the REAL repo tree, not a disposable copy.
 *
 * RED-PROOF (against the pre-354-11 room mode): J2 fails because the old
 * room-mode writer was `fs.writeFileSync(documentPath, ...)` straight into
 * <room>/workspace-poc.md (the room ROOT, not a governed section). J3 fails
 * because that raw write never called fileArtifact, so no claim:artifact
 * node or artifact_file memory_event exists. J5 fails because the old
 * graph()/graphAnswer() never labelled answers 'deterministic_graph_lookup'
 * and carried no references. J6 fails because there was no
 * GET /api/document/revision polling in app.js yet.
 *
 * Plain-Node harness (test-354-poc-save-origin.cjs shape): ok(label)/
 * fail(label, err), a leading log line, a trailing PASS/FAIL summary,
 * process.exitCode = 1 on any failure, process.exit(77) on ENV GAP (never
 * exit 0 when Playwright cannot resolve). Hyphens only, no em-dashes
 * (CLAUDE.md).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { resolvePlaywright } = require(path.join(__dirname, 'helpers', 'playwright-354.cjs'));
const { makeScratchRoom } = require(path.join(__dirname, 'helpers', 'fixture-room-354.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(__dirname, '..', 'lib', 'core', 'room-db.cjs'));

const REPO = path.resolve(__dirname, '..');
const SERVER_PATH = path.join(REPO, 'docs', 'reviews', 'localhost-poc', 'server.cjs');

console.log('test-354-poc-room-journey');

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

function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
}
async function reservePort() {
  const s = http.createServer();
  const port = await listen(s);
  await new Promise((resolve) => s.close(resolve));
  return port;
}

// Spawns server.cjs with the given extra CLI args, resolving as soon as the
// child prints its startup line (the same "first stdout data" idiom
// test-354-poc-save-origin.cjs uses). Rejects with the exit code when the
// process exits before ever printing (the refusal-to-start legs, J1/J8).
function spawnServer(extraArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SERVER_PATH, ...extraArgs], { stdio: ['ignore', 'pipe', 'pipe'] });
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
        reject(Object.assign(new Error('server exited ' + code + (stderr ? (' stderr: ' + stderr.trim()) : '')), { code, stderr }));
      }
    });
  });
}

// Runs server.cjs to completion (it is expected to refuse to start and exit
// non-zero before ever printing to stdout) and returns { code, stderr }.
function runServerExpectingRefusal(extraArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SERVER_PATH, ...extraArgs], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let stdoutSaw = false;
    child.stdout.on('data', (d) => { stdout += d; stdoutSaw = true; });
    child.stderr.on('data', (d) => { stderr += d; });
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('server did not exit within the refusal timeout; stdout=' + stdout));
    }, 5000);
    child.once('exit', (code) => {
      clearTimeout(timer);
      if (stdoutSaw) {
        reject(new Error('server printed a startup line instead of refusing; stdout=' + stdout));
        return;
      }
      resolve({ code, stderr });
    });
    child.once('error', (e) => { clearTimeout(timer); reject(e); });
  });
}

async function fetchToken(origin, hostHeader) {
  const r = await fetch(origin + '/', { headers: { Host: hostHeader } });
  const html = await r.text();
  const m = html.match(/<meta name="mos-poc-token" content="([^"]*)"/);
  return m ? m[1] : '';
}

async function clickSaveAndWait(page) {
  const before = await page.locator('#save-state').textContent();
  await page.locator('#save').click();
  await page.waitForFunction((prev) => {
    const el = document.getElementById('save-state');
    return !!el && el.textContent !== prev;
  }, before, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(300);
  return page.locator('#save-state').textContent();
}

function readRoomDbRows(roomDir) {
  const db = openRoomDb(roomDir);
  try {
    const claimNodes = db.prepare("SELECT id, type FROM nodes WHERE id LIKE 'claim:artifact:%'").all();
    const memoryEvents = db.prepare(
      "SELECT id, properties FROM nodes WHERE type = 'memory_event' " +
      "AND json_extract(properties, '$.label') = 'artifact_file' " +
      "AND json_extract(properties, '$.filename') = 'workspace-poc.md'"
    ).all();
    return { claimNodes, memoryEvents };
  } finally {
    closeRoomDb(db);
  }
}

(async () => {
  const pw = resolvePlaywright();
  if (!pw) {
    console.log('ENV GAP: playwright unavailable');
    process.exit(77);
    return;
  }
  const { chromium } = pw;

  const roomA = makeScratchRoom('journey-a');
  const roomB = makeScratchRoom('journey-b');
  fs.writeFileSync(path.join(roomA.room, 'ROOM.md'), '# Room A\n\nJourney test room.\n');

  const port = await reservePort();
  const origin = 'http://127.0.0.1:' + port;
  const hostHeader = '127.0.0.1:' + port;

  let child;
  let browser;

  try {
    // ---- J1 (part 2): explicit binding refuses a directory with no room.db ----
    await checkThat('J1b: --room without .mindrian/room.db refuses to start, naming room.db', async () => {
      const unbound = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'mos-354-journey-unbound-'));
      try {
        const { code, stderr } = await runServerExpectingRefusal([String(await reservePort()), '--room', unbound]);
        assert.notStrictEqual(code, 0, 'expected non-zero exit, got ' + code);
        assert.ok(/room\.db/.test(stderr), 'stderr did not name room.db: ' + stderr);
      } finally {
        fs.rmSync(unbound, { recursive: true, force: true });
      }
    });

    // ---- J8 (part 2): a malformed --section refuses before listening ----
    await checkThat('J8b: --section ../roomB refuses to start before listening (SECTION_RE)', async () => {
      const { code, stderr } = await runServerExpectingRefusal([String(await reservePort()), '--room', roomA.room, '--section', '../roomB']);
      assert.notStrictEqual(code, 0, 'expected non-zero exit, got ' + code);
      assert.ok(stderr.length > 0, 'expected a stderr refusal message');
    });

    // ---- Spawn the real journey server, bound to room A, section workspace ----
    child = await spawnServer([String(port), '--room', roomA.room, '--section', 'workspace']);
    browser = await chromium.launch();
    const page = await browser.newPage();

    // ---- J1 (part 1): bind ----
    await checkThat('J1a: GET /api/room reports mode room and room A\'s name', async () => {
      const info = await fetch(origin + '/api/room', { headers: { Host: hostHeader } }).then((r) => r.json());
      assert.strictEqual(info.mode, 'room');
      assert.strictEqual(info.name, path.basename(roomA.room));
    });
    await page.goto(origin);
    await page.locator('#editor').waitFor();
    await checkThat('J1a: the header renders room A\'s name', async () => {
      const text = await page.locator('.top').textContent();
      assert.ok(text.includes(path.basename(roomA.room)), 'header did not include room A name: ' + text);
    });

    // ---- J2: edit, save, reopen ----
    const EDIT_LINE = 'JOURNEY_EDIT_1 marks this working line';
    const documentContent = '# Journey heading\n' + EDIT_LINE + '\n';
    await checkThat('J2: type + save + reload round-trips through the governed section path', async () => {
      await page.locator('#editor').fill(documentContent);
      await clickSaveAndWait(page);
      await page.reload();
      await page.locator('#editor').waitFor();
      const editorValue = await page.locator('#editor').inputValue();
      assert.ok(editorValue.includes('JOURNEY_EDIT_1'), 'editor did not contain JOURNEY_EDIT_1 after reload: ' + editorValue);
      assert.ok(fs.existsSync(path.join(roomA.room, 'workspace', 'workspace-poc.md')), 'file missing at <room>/workspace/workspace-poc.md');
      assert.ok(!fs.existsSync(path.join(roomA.room, 'workspace-poc.md')), 'file incorrectly written at the room root');
    });

    // ---- J3: governed index (fresh room.db handle) ----
    await checkThat('J3: a claim:artifact node and an artifact_file memory_event exist', async () => {
      const rows = readRoomDbRows(roomA.room);
      assert.ok(rows.claimNodes.length >= 1, 'no claim:artifact node found');
      assert.ok(rows.memoryEvents.length >= 1, 'no artifact_file memory_event found for workspace-poc.md');
    });
    await checkThat('J3: saving twice more yields exactly one claim:artifact node', async () => {
      const token = await fetchToken(origin, hostHeader);
      for (let i = 0; i < 2; i += 1) {
        const docInfo = await fetch(origin + '/api/document', { headers: { Host: hostHeader } }).then((r) => r.json());
        await fetch(origin + '/api/document', {
          method: 'POST',
          headers: { Origin: origin, Host: hostHeader, 'Content-Type': 'application/json', 'X-Mindrian-Poc-Token': token },
          body: JSON.stringify({ markdown: documentContent + '\nextra save ' + i + '\n', base_revision: docInfo.revision }),
        });
      }
      const rows = readRoomDbRows(roomA.room);
      assert.strictEqual(rows.claimNodes.length, 1, 'expected exactly one claim:artifact node, got ' + rows.claimNodes.length);
    });

    // Re-sync the browser's own editor/revision state after the raw-HTTP saves above.
    await page.reload();
    await page.locator('#editor').waitFor();

    // ---- J4: inspect graph ----
    await checkThat('J4: the graph tab renders the saved node after a fresh GET /api/graph', async () => {
      const g = await fetch(origin + '/api/graph', { headers: { Host: hostHeader } }).then((r) => r.json());
      const artifactNode = g.nodes.find((n) => typeof n.id === 'string' && n.id.startsWith('claim:artifact:'));
      assert.ok(artifactNode, 'no claim:artifact node in GET /api/graph');
      await page.locator('[data-tab="graph"]').first().click();
      await page.locator('#graph-canvas').waitFor();
      await page.waitForTimeout(200);
      const canvasHtml = await page.locator('#graph-canvas').innerHTML();
      const snippet = String(artifactNode.title || '').slice(0, 20);
      assert.ok(snippet.length > 0 && canvasHtml.includes(snippet.slice(0, 10)), 'graph canvas did not include the node label/first-line snippet');
    });

    // ---- J5: grounded ask ----
    await checkThat('J5: a grounded question returns a labelled deterministic answer with references', async () => {
      await page.locator('#question').fill('what marks this working line');
      await page.locator('#ask').click();
      await page.waitForTimeout(300);
      const headingText = await page.locator('.talk h2').textContent();
      assert.strictEqual(headingText.trim(), 'Graph lookup (deterministic, no model)');
      const refsHtml = await page.locator('#references').innerHTML();
      const rows = readRoomDbRows(roomA.room);
      const claimId = rows.claimNodes[0].id;
      assert.ok(refsHtml.includes(claimId), 'references list did not include the claim:artifact node id: ' + refsHtml);
      assert.ok(refsHtml.includes('workspace/workspace-poc.md'), 'references list did not include the relative source path: ' + refsHtml);
    });

    // ---- J6: external edit, clean editor ----
    await checkThat('J6: an external edit appears in a clean editor within 5s, no manual reload', async () => {
      await page.reload();
      await page.locator('#editor').waitFor();
      const cleanValue = await page.locator('#editor').inputValue();
      fs.appendFileSync(path.join(roomA.room, 'workspace', 'workspace-poc.md'), '\nEXTERNAL_EDIT_2\n');
      await page.waitForFunction(() => {
        const el = document.getElementById('editor');
        return !!el && el.value.includes('EXTERNAL_EDIT_2');
      }, null, { timeout: 5000 });
      const updated = await page.locator('#editor').inputValue();
      assert.ok(updated.includes('EXTERNAL_EDIT_2'), 'editor did not pick up the external edit: ' + updated);
      assert.ok(updated !== cleanValue, 'editor value did not change');
    });

    // ---- J7: external edit, dirty editor ----
    await checkThat('J7: a dirty editor shows a conflict banner and never loses either version', async () => {
      const UNSAVED_TEXT = 'UNSAVED_DIRTY_TEXT_' + Date.now();
      await page.locator('#editor').fill(UNSAVED_TEXT);
      fs.appendFileSync(path.join(roomA.room, 'workspace', 'workspace-poc.md'), '\nEXTERNAL_EDIT_3\n');
      await page.locator('#conflict-banner:not([hidden])').waitFor({ timeout: 5000 });
      const editorValue = await page.locator('#editor').inputValue();
      assert.strictEqual(editorValue, UNSAVED_TEXT, 'editor lost the unsaved text during an external edit');
      const onDisk = fs.readFileSync(path.join(roomA.room, 'workspace', 'workspace-poc.md'), 'utf8');
      assert.ok(onDisk.includes('EXTERNAL_EDIT_3'), 'file no longer holds EXTERNAL_EDIT_3: ' + onDisk);
    });

    // ---- J8 (part 1): room B is untouched ----
    await checkThat('J8a: room B has no workspace/ folder and no claim:artifact node', () => {
      assert.ok(!fs.existsSync(path.join(roomB.room, 'workspace')), 'room B unexpectedly has a workspace/ folder');
      const rows = readRoomDbRows(roomB.room);
      assert.strictEqual(rows.claimNodes.length, 0, 'room B unexpectedly has a claim:artifact node');
    });

    // ---- J8 (part 3): extra body keys are ignored ----
    await checkThat('J8c: a POST body carrying extra section/path keys is ignored', async () => {
      const token = await fetchToken(origin, hostHeader);
      const docInfo = await fetch(origin + '/api/document', { headers: { Host: hostHeader } }).then((r) => r.json());
      const injectedMarkdown = 'INJECTED_VIA_EXTRA_KEYS\n';
      const res = await fetch(origin + '/api/document', {
        method: 'POST',
        headers: { Origin: origin, Host: hostHeader, 'Content-Type': 'application/json', 'X-Mindrian-Poc-Token': token },
        body: JSON.stringify({
          markdown: injectedMarkdown,
          base_revision: docInfo.revision,
          section: '../evil-section',
          path: '/etc/passwd',
        }),
      });
      assert.strictEqual(res.status, 200, 'save with extra keys unexpectedly failed');
      assert.ok(!fs.existsSync(path.join(roomA.room, 'evil-section')), 'a section named by the injected key was created');
      const onDisk = fs.readFileSync(path.join(roomA.room, 'workspace', 'workspace-poc.md'), 'utf8');
      assert.strictEqual(onDisk, injectedMarkdown, 'save did not land in the bound section/filename despite extra keys');
    });

    await page.close();
  } finally {
    if (browser) await browser.close();
    if (child) { try { child.kill('SIGINT'); } catch (_e) { /* ignore */ } }
    roomA.cleanup();
    roomB.cleanup();
  }

  console.log('');
  if (failed > 0) {
    console.log('FAIL - ' + failed + ' of ' + (checks + failed) + ' checks failed (checks that ran: ' + checks + ')');
    process.exitCode = 1;
  } else {
    console.log('PASS - ' + checks + ' checks');
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
