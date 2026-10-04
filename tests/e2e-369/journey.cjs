#!/usr/bin/env node
'use strict';

/*
 * tests/e2e-369/journey.cjs -- Phase 369-30 (SHELL369-11, CM369-03): the ONE recoverable journey that defines done for
 * Phase 369 (D-08), run against the BUILT, SHIPPED shell (lib/ui-shell/dist) started the way a person starts it
 * (node lib/ui-shell/launch.cjs start), in a real browser, against a hermetic flag-ON daemon.
 *
 *   1  local authentication: no access without the one-time link; the link signs in; a reused link fails
 *   2  the correct room: the picker lists both rooms; choose room-x; the header's first content item is room-x, not the
 *      CLI's active room (room-y, which stays the registry's active room)
 *   3  inspect evidence: a document holding script markup renders as text and runs nothing; open its sources
 *   4  decide: a proposal about a claim raises the gate (the ruled room-proposal source, deterministic); the
 *      recommendation is checked; Approve; "Decision recorded in the room." only after the room's answer; click-to-recorded ms
 *   5  persisted: the decision is in Decisions (Settled, "Confirmed by you,") and in "Since you were here" after Work is
 *      left and reopened; room-y has no new node
 *   6  restart and recover: stop the shell, kill and respawn the daemon, write to the room while the shell is down, start the
 *      shell again, sign in with the NEW link, open room-x: the decision is still there, the read copy converges with 0
 *      missing, the old gate id is not answered a second time; catch-up ms measured
 *   7  offline assets: the egress capture over steps 1-6 holds only 127.0.0.1
 *
 * Counters (CM369-03, counts and milliseconds only, SEED-074) go to output/journey-metrics.json:
 *   gate_click_to_recorded_ms, restart_catch_up_ms, lost_writes
 *
 * `--navigator` (plan 369-30 Task 2) does not run the journey: it prepares the same fixture, starts the shipped shell,
 * opens a HEADED browser signed in, files a proposal and raises its gate on that browser's own session, then waits for the
 * navigator to close the window. The shell has no browser control that raises a gate (the Ask Claude hop is an action with no
 * button), so a person's click test needs the gate raised on the person's own browser session.
 *
 * Exit 77 only when Playwright, Chromium, the dist or the root node_modules are absent; never to hide a failing step.
 * Hermetic: temp HOME, a hermetic daemon, never ~/MindrianRooms. Kills only what it started. Canon Part 8: loopback only.
 * Canon Part 9: tests/ is allow-listed for raw SQL; every write goes through the write door in a child process. Hyphens only.
 */

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..', '..');
// Playwright finds its browsers under the real HOME; keep that path before the hermetic HOME replaces it.
if (!process.env.PLAYWRIGHT_BROWSERS_PATH) process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(os.homedir(), '.cache', 'ms-playwright');
const HERMETIC = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-369-journey-'));
process.env.HOME = HERMETIC;
process.env.USERPROFILE = HERMETIC;
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;

const pw = require('./lib/pw.cjs');
const D = require('../helpers/mcp-daemon-369.cjs');
const { DatabaseSync } = require('node:sqlite');
const navigation = require(path.join(REPO, 'lib', 'core', 'navigation.cjs'));

const DIST = path.join(REPO, 'lib', 'ui-shell', 'dist');
const LAUNCH = path.join(REPO, 'lib', 'ui-shell', 'launch.cjs');
const OUT = path.join(__dirname, 'output');
const NAVIGATOR = process.argv.includes('--navigator');
const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);
const SEP = String.fromCharCode(31);
const GAP = (msg) => {
  console.log('SKIPPED (ENV GAP): ' + msg);
  process.exit(pw.SKIP_EXIT_CODE);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const J = JSON.stringify;

const QUESTION = 'What would make this customer problem worth solving?';
const NODE = 'node-journey-369';
const ITEM_DOC = 'evidence/interview.md';
const NOT_SIGNED_IN = 'This browser is not signed in to the workspace.';
const RECORDED = 'Decision recorded in the room.';
const REPLAYED = 'This decision was already recorded.';
const PWNED_LINE = '<script>window.__pwned = 1</script>';

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port;
      s.close(() => resolve(p));
    });
    s.on('error', reject);
  });
}

async function waitUntil(fn, ms, what, step) {
  const end = Date.now() + ms;
  for (;;) {
    let value;
    try {
      value = await fn();
    } catch (_e) {
      value = false;
    }
    if (value) return value;
    if (Date.now() > end) throw new Error('timeout waiting for ' + what);
    await sleep(step || 50);
  }
}

// ---------------------------------------------------------------------------------------------
// Child writers: every write goes through the write door in its own process, as a hook would
// ---------------------------------------------------------------------------------------------

const PRELUDE =
  'const { openRoomDb, closeRoomDb } = require(' + J(path.join(REPO, 'lib', 'core', 'room-db.cjs')) + ');' +
  'const { insertNode } = require(' + J(path.join(REPO, 'lib', 'core', 'node-insert.cjs')) + ');' +
  'const navigation = require(' + J(path.join(REPO, 'lib', 'core', 'navigation.cjs')) + ');' +
  'const frames = require(' + J(path.join(REPO, 'lib', 'core', 'frame-provenance.cjs')) + ');';

function runChild(body, env) {
  return new Promise((resolve, reject) => {
    const child = cp.spawn('node', ['-e', PRELUDE + '(async () => {' + body + '})().catch((e) => { console.error(String(e && e.stack || e)); process.exit(1); });'], {
      env: Object.assign({}, env || process.env, { HOME: HERMETIC, USERPROFILE: HERMETIC }),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (c) => { out += c.toString('utf8'); });
    child.stderr.on('data', (c) => { err += c.toString('utf8'); });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code !== 0) return reject(new Error('child failed (' + code + '): ' + err.slice(-400)));
      try {
        resolve(JSON.parse(out.trim().split('\n').pop()));
      } catch (_e) {
        resolve(null);
      }
    });
  });
}

// room-x: a governing question, three evidence items (one CONTRADICTS pair, one with a real source document that holds
// script markup as plain text), one claim a person already confirmed. room-y: one claim of its own.
function seedRoomX(roomDir, env) {
  fs.mkdirSync(path.join(roomDir, 'evidence'), { recursive: true });
  fs.writeFileSync(
    path.join(roomDir, ITEM_DOC),
    '---\nsection: evidence\n---\n# Interview notes\n\nThe buyer said the pilot fee is the sticking point.\n\n- Budget is set in January\n- The pilot must show a result in 30 days\n\nA hostile line a careless page would run: ' + PWNED_LINE + '\n\nAnd another: <img src="x" onerror="window.__pwned = 2">\n\nThe same markup written as text: `' + PWNED_LINE + '`\n'
  );
  return runChild(
    'const db = openRoomDb(' + J(roomDir) + ');' +
      'try {' +
      "const q = frames.setGoverningQuestion(db, " + J(roomDir) + ", { text: " + J(QUESTION) + ", origin: 'chosen' });" +
      "if (!q.ok) throw new Error('question: ' + JSON.stringify(q));" +
      "const claim = (text, tag) => { const r = navigation.writeClaimNode(db, { knowledge_type: 'fact', text, sessionId: 'journey-' + tag }); if (!r.ok) throw new Error('claim: ' + JSON.stringify(r)); return r.node_id; };" +
      "const a = claim('Demand assumption: pilots will pay for a result', 'a');" +
      "const b = claim('Interview excerpt: the buyer refuses a pilot fee', 'b');" +
      "const c = claim('Pricing claim: the pilot costs 1200 a month', 'c');" +
      "const e = navigation.writeEdge(db, { source_id: a, target_id: b, edge_type: 'CONTRADICTS', properties: { origin: 'e2e-369' } });" +
      "if (!e.ok) throw new Error('edge: ' + JSON.stringify(e));" +
      "const p = navigation.promoteNodeStatus(db, c, 'proposed', 'confirmed', 'user', 'e2e-369');" +
      "if (!p.ok) throw new Error('promote: ' + JSON.stringify(p));" +
      "db.prepare('UPDATE nodes SET source_path = ? WHERE id = ?').run(" + J(ITEM_DOC) + ", a);" +
      'console.log(JSON.stringify({ a, b, c }));' +
      '} finally { closeRoomDb(db); }',
    env
  );
}

function seedRoomY(roomDir, env) {
  return runChild(
    'const db = openRoomDb(' + J(roomDir) + ');' +
      'try {' +
      "const r = navigation.writeClaimNode(db, { knowledge_type: 'fact', text: 'Room Y claim that must stay untouched', sessionId: 'journey-y' });" +
      "if (!r.ok) throw new Error(JSON.stringify(r));" +
      'console.log(JSON.stringify({ id: r.node_id }));' +
      '} finally { closeRoomDb(db); }',
    env
  );
}

function writeClaim(roomDir, text, tag, env) {
  return runChild(
    'const db = openRoomDb(' + J(roomDir) + ');' +
      'try { const r = navigation.writeClaimNode(db, { knowledge_type: ' + "'fact'" + ', text: ' + J(text) + ', sessionId: ' + J('journey-' + tag) + ' }); if (!r.ok) throw new Error(JSON.stringify(r));' +
      'console.log(JSON.stringify({ id: r.node_id })); } finally { closeRoomDb(db); }',
    env
  );
}

// One proposed claim that names the selected node id, with a source node behind it, so the room's own record
// recommends "approve" (ADAPTER-RULING: located_source or source_edge recommends approve, anything else holds).
function proposedClaim(roomDir, tag, env) {
  return runChild(
    'const db = openRoomDb(' + J(roomDir) + ');' +
      'try {' +
      "const c = navigation.writeClaimNode(db, { knowledge_type: 'fact', text: " + J('Pilot note ' + tag + ' about ' + NODE + ': the person must click to confirm.') + ", sessionId: 'journey-prop-' + " + J(tag) + " });" +
      "if (!c.ok) throw new Error('claim: ' + JSON.stringify(c));" +
      "const s = navigation.writeEvidenceClaim(db, { topic: " + J('Interview source ' + tag) + ", source: 'e2e-369', url: " + J('https://example.org/369/journey/' + tag) + ", retrieved_at: '2026-10-01T00:00:00Z', evidence_tier: 'Academic', summary: 'interview', sessionId: 'journey-src-' + " + J(tag) + " });" +
      "if (!s.ok) throw new Error('source: ' + JSON.stringify(s));" +
      'const src = s.node_id || s.id;' +
      "const e = navigation.writeEdge(db, { source_id: c.node_id, target_id: src, edge_type: 'SOURCED_FROM', properties: { origin: 'e2e-369' } });" +
      "if (!e.ok) throw new Error('edge: ' + JSON.stringify(e));" +
      "db.prepare('UPDATE nodes SET source_path = ? WHERE id = ?').run(" + J(ITEM_DOC) + ', src);' +
      'console.log(JSON.stringify({ claim: c.node_id, source: src }));' +
      '} finally { closeRoomDb(db); }',
    env
  );
}

// ---------------------------------------------------------------------------------------------
// The truth, read from the room's own database (read-only), and the browser copy's stored ids
// ---------------------------------------------------------------------------------------------

function withDb(roomDir, fn) {
  const db = new DatabaseSync(path.join(roomDir, '.mindrian', 'room.db'), { readOnly: true });
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

function truth(roomDir) {
  return withDb(roomDir, (db) => {
    const out = { nodes: new Set(), relations: new Set(), artifacts: new Set(), decisions: new Set(), activity: new Set() };
    for (const r of db.prepare('SELECT id, type FROM nodes').all()) out[navigation.collectionForNodeType(r.type, r.id)].add(String(r.id));
    for (const r of db.prepare('SELECT source, type, target FROM edges').all()) out.relations.add(String(r.source) + SEP + String(r.type) + SEP + String(r.target));
    return out;
  });
}

const total = (t) => Object.values(t).reduce((n, s) => n + s.size, 0);
const nodeCount = (roomDir) => withDb(roomDir, (db) => db.prepare('SELECT COUNT(*) AS n FROM nodes').get().n);
const decisionNodes = (roomDir, gateId) => withDb(roomDir, (db) => db.prepare('SELECT id, review_status FROM nodes WHERE id = ?').all('decision:gate:' + gateId));
const claimStatus = (roomDir, claimId) => withDb(roomDir, (db) => (db.prepare('SELECT review_status FROM nodes WHERE id = ?').get(claimId) || {}).review_status);

const ROW = '[data-row="browser-copy"]';
async function copyRow(page) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    return { state: el.getAttribute('data-copy-state'), seq: el.getAttribute('data-copy-seq'), count: Number(el.getAttribute('data-copy-count')) };
  }, ROW);
}

// Every stored document id of one collection of a room, read straight from the page's IndexedDB (deleted rows skipped).
async function storedIds(page, roomSlug, collection) {
  return page.evaluate(
    async ({ room, coll }) => {
      const list = await indexedDB.databases();
      const re = new RegExp('^rxdb-dexie-(mos-' + room + '-[a-z0-9]+-p\\d+)--\\d+--' + coll + '$');
      const hit = list.map((d) => d.name || '').find((n) => re.test(n));
      if (!hit) return null;
      const idb = await new Promise((resolve, reject) => {
        const req = indexedDB.open(hit);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      try {
        const names = Array.from(idb.objectStoreNames);
        const store = names.find((n) => n === 'docs') || names[0];
        const rows = await new Promise((resolve, reject) => {
          const req = idb.transaction(store, 'readonly').objectStore(store).getAll();
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
        const dead = (v) => v === true || v === 'true' || v === 1 || v === '1';
        return rows.filter((r) => !dead(r._deleted)).map((r) => String(r.id));
      } finally {
        idb.close();
      }
    },
    { room: roomSlug, coll: collection }
  );
}

// The copy against the room: counts only. missing is what the room holds and the copy does not (a lost write).
async function compareCopy(page, roomSlug, roomDir) {
  const t = truth(roomDir);
  let missing = 0;
  let extra = 0;
  let duplicates = 0;
  for (const c of Object.keys(t)) {
    const got = (await storedIds(page, roomSlug, c)) || [];
    const have = new Set(got);
    duplicates += got.length - have.size;
    for (const id of t[c]) if (!have.has(id)) missing += 1;
    for (const id of have) if (!t[c].has(id)) extra += 1;
  }
  return { missing, extra, duplicates, items: total(t) };
}

// ---------------------------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------------------------

async function main() {
  const t0 = Date.now();
  if (!pw.resolvePlaywright()) GAP('Playwright is not installed (spike 006 install or a walled dev package)');
  const manifestFile = path.join(DIST, 'manifest.json');
  if (!fs.existsSync(manifestFile)) GAP('the shell dist is absent (lib/ui-shell/dist/manifest.json): run node scripts/build-ui-shell.cjs');
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  if (!fs.existsSync(path.join(DIST, manifest.serverEntry))) GAP('the dist names a server entry that is missing: ' + manifest.serverEntry);
  const rootNm = path.join(REPO, 'node_modules');
  if (!fs.existsSync(path.join(rootNm, 'next', 'package.json')) || !fs.existsSync(path.join(rootNm, 'react-dom', 'package.json'))) {
    GAP('the root node_modules does not carry next and react-dom (run npm ci --ignore-scripts at the repo root)');
  }

  console.log('Phase 369-30 recoverable journey (SHELL369-11, CM369-03), built shell, real browser' + (NAVIGATOR ? ' [navigator mode]' : ''));
  console.log('  dist: source hash ' + String(manifest.sourceHash).slice(0, 16) + ', built ' + manifest.builtAt + ', ' + manifest.chassis);

  let launched;
  try {
    launched = await pw.launch({ headless: !NAVIGATOR });
  } catch (e) {
    GAP('Chromium could not launch' + (NAVIGATOR ? ' headed (no display?)' : '') + ': ' + String(e.message || e).split('\n')[0]);
  }
  const { browser } = launched;

  // room-y is registered first, so it is the registry's active room: the CLI's active room is NOT the room the journey opens.
  let daemon;
  try {
    daemon = await D.startDaemon({
      rooms: [
        { slug: 'room-y', variant: 'wide', migrate: true },
        { slug: 'room-x', variant: 'wide', migrate: true },
      ],
      extraEnv: { MINDRIAN_TEST_MODE: '1' },
    });
  } catch (err) {
    await browser.close().catch(() => {});
    GAP('the hermetic daemon could not start (' + String(err && err.message).slice(0, 200) + ')');
  }
  const roomX = daemon.roomDirs['room-x'];
  const roomY = daemon.roomDirs['room-y'];
  const registryFile = path.join(daemon.roomsHome, '.rooms', 'registry.json');
  const ids = await seedRoomX(roomX, daemon.env);
  await seedRoomY(roomY, daemon.env);
  const yNodesBefore = nodeCount(roomY);
  const xTruthSeed = total(truth(roomX));

  const shellPort = await freePort();
  const launchEnv = Object.assign({}, process.env, {
    HOME: HERMETIC, USERPROFILE: HERMETIC, MINDRIAN_ROOMS_HOME: daemon.roomsHome,
    MOS_PROPOSAL_SOURCE: 'adapter', MINDRIAN_TEST_MODE: '1', MOS_SHELL_START_TIMEOUT_MS: '90000',
    MINDRIAN_BRAIN_URL: 'http://127.0.0.1:9', NEXT_TELEMETRY_DISABLED: '1', DO_NOT_TRACK: '1',
  });
  delete launchEnv.CLAUDE_CODE_SESSION_ID;
  delete launchEnv.CLAUDE_ACTIVE_ROOM;
  function startLink() {
    const r = cp.spawnSync(process.execPath, [LAUNCH, 'start', '--port', String(shellPort)], { env: launchEnv, encoding: 'utf8', timeout: 120000 });
    if (r.status !== 0) throw new Error('launch.cjs start failed (' + r.status + '): ' + String(r.stderr || r.stdout).slice(-500));
    const link = String(r.stdout).split('\n').find((l) => /^http:\/\/127\.0\.0\.1:\d+\/auth\/bootstrap\?code=/.test(l));
    if (!link) throw new Error('launch.cjs printed no sign-in link: ' + r.stdout.slice(0, 300));
    return link;
  }
  function stopShell() {
    const r = cp.spawnSync(process.execPath, [LAUNCH, 'stop'], { env: launchEnv, encoding: 'utf8', timeout: 30000 });
    return String(r.stdout || '').trim();
  }
  const origin = 'http://127.0.0.1:' + shellPort;

  // One egress capture for the whole run (every page of every context): request, websocket and EventSource.
  const requests = [];
  const cspEvents = [];
  const consoleErrors = [];
  const contexts = [];
  async function newCtx(opts) {
    const ctx = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 900 } }, opts || {}));
    contexts.push(ctx);
    ctx.on('request', (r) => { requests.push({ url: r.url(), type: r.resourceType() }); });
    await ctx.exposeFunction('__cspReport', (line) => { cspEvents.push(line); });
    await ctx.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (e) => window.__cspReport(e.violatedDirective + ' ' + e.blockedURI + ' ' + e.sourceFile + ':' + e.lineNumber));
    });
    return ctx;
  }
  function watch(p) {
    p.on('websocket', (ws) => { requests.push({ url: ws.url(), type: 'websocket' }); });
    p.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    p.on('pageerror', (e) => consoleErrors.push(String((e && e.message) || e)));
  }

  const act = (p, name, body) =>
    p.evaluate(
      async ({ name, body }) => {
        const csrf = document.querySelector('meta[name="mos-csrf"]').getAttribute('content');
        const res = await fetch('/api/actions/' + name, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json', 'x-mos-csrf': csrf }, body: JSON.stringify(body || {}) });
        return res.json();
      },
      { name, body }
    );
  async function openRoom(p, slug) {
    await p.goto(origin + '/?rooms');
    const row = p.locator('.room-list-row', { hasText: slug });
    await row.waitFor({ timeout: 30000 });
    await row.getByText('Open this room').click();
    await p.getByRole('button', { name: /^Switch to/ }).click({ timeout: 2500 }).catch(() => {});
    await p.waitForFunction((s) => document.querySelector('.rs-name') && document.querySelector('.rs-name').textContent === s, slug, { timeout: 30000 });
  }
  async function go(p, urlPath) {
    await p.goto(origin + urlPath);
    await p.waitForSelector('#view h1', { timeout: 30000 });
  }
  async function openGate(p, gateId, state) {
    await p.goto(origin + '/gate/' + encodeURIComponent(gateId));
    await p.waitForSelector('#view .gate-card[data-state="' + (state || 'ready') + '"]', { timeout: 45000 });
  }
  const waitCurrent = (p) =>
    p.waitForFunction(() => { const el = document.querySelector('[data-row="browser-copy"]'); return !!el && el.getAttribute('data-copy-state') === 'current'; }, null, { timeout: 45000 });
  const waitWork = (p, state) => p.waitForSelector('.work-since[data-state="' + state + '"]', { timeout: 45000 });
  const primary = (p) => p.locator('#view .ab[data-variant="primary"]');
  const viewText = async (p) => (((await p.locator('#view').innerText()) || '') + '').replace(/\s+/g, ' ');

  // ---- navigator mode: prepare, hand over a signed-in headed window with a gate raised on its own session ----
  if (NAVIGATOR) {
    let code = 0;
    try {
      const link = startLink();
      const ctx = await newCtx();
      const page = await ctx.newPage();
      watch(page);
      await page.goto(link);
      await page.waitForSelector('header.shell-header', { timeout: 45000 });
      await openRoom(page, 'room-x');
      await go(page, '/');
      const made = await proposedClaim(roomX, 'navigator', daemon.env);
      const asked = await act(page, 'askClaude', { selectedNodeId: NODE, question: 'Should this claim be confirmed?' });
      assert.strictEqual(asked.ok, true, 'the proposal raised a gate: ' + J(asked));
      await go(page, '/');
      console.log('');
      console.log('NAVIGATOR READY');
      console.log('  The window is signed in to a throwaway fixture room (room-x) in a temporary home. No real room is read or written.');
      console.log('  Shell: ' + origin + '   Gate raised on this window: ' + origin + '/gate/' + asked.gate_id + '   (claim ' + made.claim + ')');
      console.log('  Work shows "Decisions (1 waiting)". Open the evidence document, open the decision, press the preselected Approve once.');
      console.log('  Close the browser window when you are done; this command then stops everything it started.');
      const bye = () => { browser.close().catch(() => {}); };
      process.once('SIGINT', bye);
      process.once('SIGTERM', bye);
      await new Promise((resolve) => { browser.on('disconnected', resolve); });
    } catch (err) {
      console.log('FAIL navigator mode: ' + String((err && err.stack) || err).split('\n').slice(0, 6).join(' | '));
      code = 1;
    } finally {
      await browser.close().catch(() => {});
      stopShell();
      await D.stopDaemon(daemon);
    }
    process.exit(code);
  }

  // ---- the journey ----
  const metrics = { gate_click_to_recorded_ms: null, restart_catch_up_ms: null, lost_writes: null };
  const results = [];
  const failures = [];
  const facts = {};
  let current = '';
  const stepStart = (n, name) => { current = n + ' ' + name; process.stdout.write('  ... ' + current + '\n'); };
  const stepDone = (n, name, note) => { results.push({ n, name, ok: true, note }); };

  let ctx1 = null;
  let page = null;
  try {
    // ===== 1 local authentication =====
    stepStart(1, 'local authentication');
    const link1 = startLink();
    const anon = await newCtx();
    const anonPage = await anon.newPage();
    watch(anonPage);
    await anonPage.goto(origin + '/');
    const anonText = (await anonPage.locator('body').innerText()).replace(/\s+/g, ' ');
    assert.ok(anonText.includes(NOT_SIGNED_IN), 'GET / without the link answers the not-signed-in copy: ' + anonText.slice(0, 200));
    assert.strictEqual(await anonPage.locator('header.shell-header').count(), 0, 'no shell without the link');
    const anonApi = await anon.request.post(origin + '/api/actions/listRooms', { data: {}, failOnStatusCode: false });
    requests.push({ url: origin + '/api/actions/listRooms', type: 'fetch' });
    assert.notStrictEqual(anonApi.status(), 200, 'an action call without the session is refused (status ' + anonApi.status() + ')');
    const anonBody = await anonApi.text();
    assert.ok(!anonBody.includes('room-x'), 'the refusal names no room');

    ctx1 = await newCtx();
    page = await ctx1.newPage();
    watch(page);
    await page.goto(link1);
    await page.waitForSelector('header.shell-header', { timeout: 45000 });

    const reuse = await newCtx();
    const reusePage = await reuse.newPage();
    watch(reusePage);
    await reusePage.goto(link1);
    const reuseText = (await reusePage.locator('body').innerText()).replace(/\s+/g, ' ');
    assert.ok(reuseText.includes(NOT_SIGNED_IN), 'a reused link fails with the not-signed-in copy: ' + reuseText.slice(0, 200));
    assert.strictEqual(await reusePage.locator('header.shell-header').count(), 0, 'a reused link opens no shell');
    await reuse.close();
    await anon.close();
    stepDone(1, 'local authentication', 'no link: not-signed-in copy and a refused action call; link: signed in; the same link in a fresh browser: refused');

    // ===== 2 the correct room =====
    stepStart(2, 'open the correct room');
    await page.goto(origin + '/?rooms');
    await page.locator('.room-list-row', { hasText: 'room-x' }).waitFor({ timeout: 30000 });
    assert.strictEqual(await page.locator('.room-list-row', { hasText: 'room-y' }).count(), 1, 'the picker lists room-y');
    assert.strictEqual(await page.locator('.room-list-row', { hasText: 'room-x' }).count(), 1, 'the picker lists room-x');
    assert.strictEqual(JSON.parse(fs.readFileSync(registryFile, 'utf8')).active, 'room-y', 'the CLI active room is room-y before the journey');
    await openRoom(page, 'room-x');
    const header = (await page.locator('header.shell-header').innerText()).replace(/\s+/g, ' ').trim();
    assert.ok(/^Room room-x\b/.test(header), 'the header\'s first content item is the room actually opened, room-x: "' + header.slice(0, 80) + '"');
    assert.strictEqual(JSON.parse(fs.readFileSync(registryFile, 'utf8')).active, 'room-y', 'opening a room in the browser does not move the CLI active room');
    await page.waitForSelector('#view h1[data-question]', { timeout: 45000 });
    await waitWork(page, 'holds-now');
    await waitCurrent(page);
    await sleep(1200); // the last-visit marker is written 400 ms after the copy is current
    stepDone(2, 'open the correct room', 'picker lists both rooms; header "Room room-x"; the registry\'s active room stays room-y');

    // ===== 3 inspect evidence =====
    stepStart(3, 'inspect evidence');
    await go(page, '/evidence');
    await page.waitForSelector('.ev-list .item-row', { timeout: 45000 });
    await page.locator('.ev-list .item-row-title', { hasText: 'Demand assumption' }).click();
    await page.waitForFunction(() => { const el = document.querySelector('.doc-display'); return !!el && el.textContent.includes('Interview notes'); }, null, { timeout: 45000 });
    await page.waitForFunction(() => { const el = document.querySelector('.doc-display'); return !!el && el.textContent.includes('written as text'); }, null, { timeout: 15000 });
    await sleep(500);
    const safe = await page.evaluate(() => {
      const doc = document.querySelector('.doc-display');
      return {
        pwned: typeof window.__pwned,
        scripts: doc.querySelectorAll('script').length,
        handlers: doc.querySelectorAll('[onerror],[onload],[onclick]').length,
        text: doc.textContent,
      };
    });
    assert.strictEqual(safe.pwned, 'undefined', 'window.__pwned stays undefined');
    assert.strictEqual(safe.scripts, 0, 'no script element inside the rendered document');
    assert.strictEqual(safe.handlers, 0, 'no inline event handler inside the rendered document');
    // Markup written as text (a code span) is shown as the characters; bare markup is dropped by the display, never run.
    facts.scriptShownAsText = safe.text.includes(PWNED_LINE);
    assert.ok(facts.scriptShownAsText, 'the script markup written as text is shown as text: "' + safe.text.slice(0, 300).replace(/\s+/g, ' ') + '"');
    facts.bareMarkupInDisplay = safe.text.includes('careless page would run: <script>') ? 'shown' : 'dropped';
    const factsText = (await page.locator('[data-reader="evidence"] .facts').innerText()).replace(/\s+/g, ' ');
    assert.ok(factsText.includes(ITEM_DOC), 'the reader names its source document: ' + factsText);
    const linked = page.locator('[data-reader="evidence"] .linked-row .linked-title').first();
    await linked.waitFor({ timeout: 15000 });
    assert.ok(/Interview excerpt/.test(await linked.innerText()), 'the reader links to the item it contradicts');
    await linked.click();
    await page.waitForFunction(() => { const h = document.querySelector('[data-reader="evidence"] h2'); return !!h && h.textContent.includes('Interview excerpt'); }, null, { timeout: 15000 });
    assert.strictEqual(await page.evaluate(() => typeof window.__pwned), 'undefined', 'still undefined after opening the linked source');
    stepDone(3, 'inspect evidence', 'document with script markup rendered as text, nothing ran; source file and linked item opened');

    // ===== 4 decide =====
    stepStart(4, 'decide');
    const made = await proposedClaim(roomX, 'journey', daemon.env);
    await go(page, '/');
    const asked = await act(page, 'askClaude', { selectedNodeId: NODE, question: 'Should this claim be confirmed?' });
    assert.strictEqual(asked.ok, true, 'the proposal raised a gate: ' + J(asked));
    assert.strictEqual(asked.subject_node_id, made.claim, 'the proposal is about the claim just filed');
    assert.strictEqual(asked.recommended_id, 'approve', 'the room recommends approve for a claim with a located source');
    const gateId = asked.gate_id;
    await openGate(page, gateId);
    assert.strictEqual(await page.locator('input.opt-input:checked').getAttribute('value'), 'approve', 'the recommended option is checked');
    assert.strictEqual(await page.locator('.gate-status').count(), 0, 'nothing says recorded before the answer');
    assert.strictEqual(claimStatus(roomX, made.claim), 'proposed', 'the claim is still only proposed');
    await page.evaluate((recorded) => {
      window.__tStatus = null;
      const look = () => {
        if (window.__tStatus) return;
        const el = document.querySelector('.gate-status');
        if (el && el.textContent.includes(recorded)) window.__tStatus = Date.now();
      };
      new MutationObserver(look).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
    }, RECORDED);
    let tFetched = null;
    await page.route('**/api/actions/approveDecision', async (route) => {
      const resp = await route.fetch();
      tFetched = Date.now(); // the shell's answer is in hand; the page has not been given it yet
      await route.fulfill({ response: resp });
    });
    const tClick = Date.now();
    await primary(page).click();
    await page.waitForSelector('#view .gate-card[data-state="recorded"]', { timeout: 45000 });
    await page.unroute('**/api/actions/approveDecision');
    const tStatus = await waitUntil(async () => page.evaluate(() => window.__tStatus), 5000, 'the recorded status timestamp', 20);
    assert.ok(tFetched !== null, 'the answer went through the shell action');
    assert.ok(tStatus >= tFetched, 'the recorded line appeared only after the room\'s answer was in hand (' + (tStatus - tFetched) + ' ms after)');
    metrics.gate_click_to_recorded_ms = tStatus - tClick;
    const statusText = (await page.locator('.gate-status').first().innerText()).replace(/\s+/g, ' ').trim();
    assert.strictEqual(statusText, RECORDED);
    assert.strictEqual(decisionNodes(roomX, gateId).length, 1, 'the room wrote the decision once');
    assert.strictEqual(claimStatus(roomX, made.claim), 'confirmed', 'only now is the claim confirmed');
    facts.gateId = gateId;
    facts.claim = made.claim;
    stepDone(4, 'decide', 'Approve recorded once; click to recorded ' + metrics.gate_click_to_recorded_ms + ' ms');

    // ===== 5 persisted =====
    stepStart(5, 'the persisted result');
    await page.locator('nav a', { hasText: 'Decisions' }).first().click();
    await page.waitForSelector('[data-group="settled"] .item-row', { timeout: 45000 });
    await waitUntil(async () => /Confirmed by you,/.test(await page.locator('[data-group="settled"]').innerText()), 30000, '"Confirmed by you," in Settled', 250);
    const settled = (await page.locator('[data-group="settled"]').innerText()).replace(/\s+/g, ' ');
    assert.ok(/Decision on/.test(settled), 'the decision row is in Settled: ' + settled.slice(0, 300));
    await page.locator('nav a', { hasText: 'Work' }).first().click();
    await waitWork(page, 'changes');
    await page.waitForSelector('.work-since .item-row', { timeout: 30000 });
    const since = (await page.locator('.work-since').innerText()).replace(/\s+/g, ' ');
    assert.ok(/Since you were here/.test(since), 'the section is "Since you were here"');
    assert.ok(/Decision on/.test(since), '"Since you were here" lists the decision: ' + since.slice(0, 400));
    assert.strictEqual(nodeCount(roomY), yNodesBefore, 'room-y has no new node (isolation)');
    assert.strictEqual(withDb(roomY, (db) => db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE id LIKE 'decision:%'").get().n), 0, 'room-y holds no decision');
    stepDone(5, 'the persisted result', 'Settled "Confirmed by you,"; listed under "Since you were here"; room-y unchanged (' + yNodesBefore + ' nodes)');

    // ===== 6 restart and recover =====
    stepStart(6, 'restart both servers and recover');
    const stopped = stopShell();
    assert.ok(/stopped/.test(stopped), 'the launcher stopped the shell: ' + stopped);
    daemon = await D.restartDaemon(daemon); // SIGKILL then a fresh process on the same rooms home
    const down = await writeClaim(roomX, 'Interview excerpt written while the shell was down', 'down', daemon.env);
    assert.ok(down && down.id, 'a write landed in the room while the shell was down');
    const expected = total(truth(roomX));
    const link2 = startLink();
    assert.notStrictEqual(link2, link1, 'a new link');
    await page.goto(link2);
    await page.waitForSelector('header.shell-header', { timeout: 60000 });
    const tOpen = Date.now();
    await openRoom(page, 'room-x');
    await waitUntil(async () => {
      const r = await copyRow(page);
      return r && r.state === 'current' && r.count === expected ? r : false;
    }, 60000, 'the read copy to hold all ' + expected + ' items of room-x', 25);
    metrics.restart_catch_up_ms = Date.now() - tOpen;
    const cmp = await compareCopy(page, 'room-x', roomX);
    metrics.lost_writes = cmp.missing;
    facts.copyItems = cmp.items;
    assert.strictEqual(cmp.missing, 0, 'the copy misses ' + cmp.missing + ' of the room\'s items');
    assert.strictEqual(cmp.extra, 0, 'the copy holds ' + cmp.extra + ' ids the room does not');
    assert.strictEqual(cmp.duplicates, 0, 'the copy holds duplicates');
    const stored = new Set((await storedIds(page, 'room-x', 'nodes')) || []);
    assert.ok(stored.has(down.id), 'the write made while the shell was down is in the copy');
    await go(page, '/decisions');
    await page.waitForSelector('[data-group="settled"] .item-row', { timeout: 45000 });
    await waitUntil(async () => /Confirmed by you,/.test(await page.locator('[data-group="settled"]').innerText()), 30000, 'the decision in Settled after the restart', 250);
    assert.strictEqual(decisionNodes(roomX, facts.gateId).length, 1, 'the decision is still one node in the room');
    assert.strictEqual(claimStatus(roomX, facts.claim), 'confirmed');

    // The old gate id, from the browser, after both servers restarted: it must not be answered a second time.
    await page.goto(origin + '/gate/' + encodeURIComponent(facts.gateId));
    await page.waitForSelector('#view .gate-card, #view .gate-error, #view .inline-error', { timeout: 45000 });
    await sleep(600);
    const oldGateView = await viewText(page);
    facts.oldGateView = oldGateView.slice(0, 160);
    assert.ok(!oldGateView.includes(RECORDED), 'the old gate does not claim a new recording');
    assert.strictEqual(await primary(page).count() === 0 || (await page.locator('input.opt-input').count()) === 0, true, 'the old gate offers nothing to answer');
    assert.strictEqual(decisionNodes(roomX, facts.gateId).length, 1, 'nothing was written twice');
    // And a direct re-answer from the page (no render nonce can exist for a gate this shell never drew): refused, nothing written.
    const reanswer = await act(page, 'approveDecision', { gate_id: facts.gateId, chosen: ['approve'], verdict: 'approve' });
    assert.strictEqual(reanswer.ok, false, 'a browser re-answer of the old gate id is refused: ' + J(reanswer));
    facts.browserReanswerReason = reanswer.reason;
    assert.strictEqual(decisionNodes(roomX, facts.gateId).length, 1, 'the refused re-answer wrote nothing');
    facts.browserReplayWords = oldGateView.includes(REPLAYED) ? 'already-recorded' : 'no-longer-open';

    // The room itself, asked again with the old gate id on the new daemon: ok with replayed:true, nothing new written.
    let replay = null;
    try {
      const mcp = await D.legacyClient(daemon.port, 'journey-369');
      try {
        const parse = (r) => { const t = (r.content || []).map((c) => c.text || '').join('').split('\n\n## ')[0]; try { return JSON.parse(t); } catch (_e) { return { raw: t }; } };
        const bound = parse(await mcp.client.callTool({ name: 'room_bind', arguments: { room: 'room-x' } }));
        assert.strictEqual(bound.ok, true, 'room_bind: ' + J(bound));
        replay = parse(await mcp.client.callTool({ name: 'gate_answer', arguments: { gate_id: facts.gateId, chosen: ['approve'], verdict: 'approve' } }));
      } finally {
        await mcp.close();
      }
    } catch (err) {
      if (/Cannot find module/.test(String(err && err.message))) facts.replaySkipped = 'MCP client package absent';
      else throw err;
    }
    if (replay) {
      assert.strictEqual(replay.ok, true, 'the room answers the old gate id: ' + J(replay));
      assert.strictEqual(replay.replayed, true, 'the room says replayed: ' + J(replay));
      assert.strictEqual(decisionNodes(roomX, facts.gateId).length, 1, 'the replay wrote nothing');
    }
    facts.roomReplay = replay ? 'replayed:true' : facts.replaySkipped;
    assert.strictEqual(nodeCount(roomY), yNodesBefore, 'room-y still untouched after the restart');
    assert.strictEqual(JSON.parse(fs.readFileSync(registryFile, 'utf8')).active, 'room-y', 'the CLI active room never moved');
    stepDone(6, 'restart both servers and recover', 'decision kept; copy ' + cmp.items + ' items, 0 missing, catch-up ' + metrics.restart_catch_up_ms + ' ms; old gate id: browser says ' + facts.browserReplayWords + ', room says ' + facts.roomReplay);

    // ===== 7 offline assets =====
    stepStart(7, 'offline assets');
    const hostOf = (u) => { try { return new URL(u).host || null; } catch (_e) { return null; } };
    const hosts = [];
    for (const r of requests) {
      const h = hostOf(r.url);
      if (h && !hosts.includes(h)) hosts.push(h);
    }
    const outside = hosts.filter((h) => h.indexOf('127.0.0.1:') !== 0 && h !== '127.0.0.1');
    assert.deepStrictEqual(outside, [], 'requests to hosts other than 127.0.0.1: ' + outside.join(', '));
    assert.ok(requests.length > 100, 'the capture saw the journey (' + requests.length + ' requests)');
    assert.ok(requests.some((r) => r.type === 'eventsource'), 'the capture saw the event-stream leg');
    assert.deepStrictEqual(cspEvents, [], 'no Content-Security-Policy violation: ' + cspEvents.slice(0, 3).join(' | '));
    const badConsole = consoleErrors.filter((m) => !/Failed to load resource|net::ERR|ERR_CONNECTION|ERR_FAILED|the server responded with a status|EventSource|aborted|Failed to fetch|TypeError: Load failed/i.test(m));
    assert.deepStrictEqual(badConsole, [], 'unexpected console or page errors: ' + badConsole.slice(0, 3).join(' | '));
    facts.requests = requests.length;
    facts.hosts = hosts.join(', ');
    stepDone(7, 'offline assets', requests.length + ' requests, hosts: ' + hosts.join(', ') + '; 0 CSP events');
  } catch (err) {
    failures.push('step ' + current + ': ' + String((err && err.stack) || err).split('\n').slice(0, 5).join(' | '));
    if (page) {
      try { failures.push('page: ' + page.url() + ' | ' + (await viewText(page)).slice(0, 400)); } catch (_e) { /* page gone */ }
    }
  } finally {
    await browser.close().catch(() => {});
    // Kill only what this run started: the shell through its own launcher, the daemon through the helper.
    try { stopShell(); } catch (_e) { /* best effort */ }
    await D.stopDaemon(daemon);
  }

  // ---- report ----
  console.log('');
  for (const r of results) console.log('PASS step ' + r.n + ' ' + r.name + ' [' + r.note + ']');
  for (const f of failures) console.log('FAIL ' + f);
  let failed = failures.length;
  if (results.length !== 7 && failures.length === 0) {
    failed += 1;
    console.log('FAIL only ' + results.length + ' of 7 steps ran');
  }
  if (failed === 0) {
    if (metrics.lost_writes !== 0) {
      failed += 1;
      console.log('FAIL lost_writes is ' + metrics.lost_writes + ', expected 0');
    }
    fs.mkdirSync(OUT, { recursive: true });
    const metricsFile = path.join(OUT, 'journey-metrics.json');
    fs.writeFileSync(metricsFile, JSON.stringify(metrics, null, 2) + '\n');
    console.log('metrics: ' + J(metrics) + ' (' + path.relative(REPO, metricsFile) + ')');
    console.log('facts: ' + J(facts));
  }
  const own = fs.readFileSync(__filename, 'utf8');
  if (own.includes(EM) || own.includes(EN)) {
    failed += 1;
    console.log('FAIL dash guard: this file carries a dash character');
  }
  console.log((failed ? failed + ' check(s) failed' : 'PASS: the recoverable journey, steps 1 to 7') + ' in ' + Math.round((Date.now() - t0) / 1000) + ' s');
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error('FATAL ' + String((err && err.stack) || err));
  process.exit(1);
});
