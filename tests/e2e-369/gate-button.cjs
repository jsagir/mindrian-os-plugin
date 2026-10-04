#!/usr/bin/env node
'use strict';

/*
 * tests/e2e-369/gate-button.cjs -- Phase 369-27 (SHELL369-10, GREC369-05): the gate button in a real browser, against the
 * built shell and a hermetic daemon (started with MINDRIAN_TEST_MODE=1 so plan 369-26's test-only fault markers work).
 *
 * What runs: a hermetic flag-ON daemon with two fixture rooms, the built shell (a plugin-like tree that reaches only the
 * root node_modules), and Chromium signed in with an armed bootstrap code. A proposal comes through askClaude with the
 * room's own adapter proposal source (a proposed claim that names the node id; a claim with a SOURCED_FROM edge is
 * recommended "approve", one without is recommended "hold"), which mints a real gate on the browser session. Writes the
 * person could not make (a changed claim, a fault marker) come from a child process or the room's .mindrian directory,
 * as another session or a failing disk would.
 *
 * Arms (GREC369-05, every state of the UI-SPEC table):
 *   1  the recommended option is checked on render and the primary action is enabled; the evidence opens inline in the
 *      read-only document display; a card with no recommendation renders nothing checked and the action is
 *      aria-disabled with "Choose an answer first."
 *   2  Enter inside the option group does not answer
 *   3  Approve shows Saving, then "Decision recorded in the room." in the success colour with the rust completion
 *      square; the decision appears in Decisions without a reload by hand
 *   4  Reject and Decide later show "Your answer is recorded." with no rust square
 *   5  replayed: re-open an answered gate id: "This decision was already recorded."
 *   6  lost in transit: the approve response is dropped after the room saved it; the view checks by gate id, then shows
 *      the recorded state (saved once)
 *   7  stale_subject: the claim changes after the card opened: the stale copy, nothing saved
 *   8  room_switched: the browser leaves the room (confirmLeave): the room copy, nothing saved
 *   9  gate_expired through the .test-fault-gate-expire marker
 *  10  session_mismatch: the gate id opened in a second signed-in browser context is not answerable there (no gate to
 *      answer), the first session's gate stays open; the session_mismatch copy renders for an answer the server refuses
 *  11  human_only: an approve with a stale render nonce (the gate was re-read in another tab) shows the human-only copy
 *      after the one automatic re-read, and nothing is saved
 *  12  persistence failure through the .test-fault-gate-persist marker: the InlineError sits above the still-enabled
 *      actions; the next answer is recorded
 *  13  the session indicator shows the risk tier while an answer is being checked
 *  14  radius 0 on the gate view except the circle mark, one H1, one primary action, one ochre triangle
 *  15  egress: only 127.0.0.1, no iframe, no unexpected console or page error, no CSP violation
 *
 * Exit 77 only when Playwright, Chromium, the shell build or the root node_modules are absent; never to hide a failing
 * arm. Hermetic: temp HOME, never ~/MindrianRooms. Canon Part 8: loopback only. Canon Part 9: tests/ is allow-listed for
 * raw SQL; the seed and the child writes go through the write door, plus the UPDATEs that stand in for another session.
 * Hyphens only; the dash guard builds its characters at run time.
 */

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..', '..');
// Playwright finds its browsers under the real HOME; keep that path before the hermetic HOME replaces it.
if (!process.env.PLAYWRIGHT_BROWSERS_PATH) process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(os.homedir(), '.cache', 'ms-playwright');
const HERMETIC = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-369-gate-'));
process.env.HOME = HERMETIC;
process.env.USERPROFILE = HERMETIC;
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;

const pw = require('./lib/pw.cjs');
const D = require('../helpers/mcp-daemon-369.cjs');

const SHELL = path.join(REPO, 'ui', 'shell');
const STANDALONE = path.join(SHELL, '.next', 'standalone');
const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);
const GAP = (msg) => {
  console.log('SKIPPED (ENV GAP): ' + msg);
  process.exit(pw.SKIP_EXIT_CODE);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const J = JSON.stringify;
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

const NODE = 'node-gate-369';
const SOURCE_DOC = 'evidence/interview.md';
const SUCCESS_RGB = 'rgb(47, 104, 73)';
const RUST_RGB = 'rgb(168, 70, 45)';

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

function request(port, opts) {
  const http = require('node:http');
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method: opts.method || 'GET', path: opts.path, headers: opts.headers || {} }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

// ---------------------------------------------------------------------------------------------
// Child writers and read-only looks at the room
// ---------------------------------------------------------------------------------------------

const PRELUDE =
  'const { openRoomDb, closeRoomDb } = require(' + J(path.join(REPO, 'lib', 'core', 'room-db.cjs')) + ');' +
  'const navigation = require(' + J(path.join(REPO, 'lib', 'core', 'navigation.cjs')) + ');';

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

function withDb(roomDir, fn) {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(path.join(roomDir, '.mindrian', 'room.db'), { readOnly: true });
  try {
    return fn(db);
  } finally {
    db.close();
  }
}
const decisionNodes = (roomDir, gateId) => withDb(roomDir, (db) => db.prepare('SELECT id, review_status FROM nodes WHERE id = ?').all('decision:gate:' + gateId));
const claimStatus = (roomDir, claimId) => withDb(roomDir, (db) => (db.prepare('SELECT review_status FROM nodes WHERE id = ?').get(claimId) || {}).review_status);

function seedRoom(roomDir) {
  fs.mkdirSync(path.join(roomDir, 'evidence'), { recursive: true });
  fs.writeFileSync(path.join(roomDir, SOURCE_DOC), '---\nsection: evidence\n---\n# Interview notes\n\nThe buyer said the pilot fee is the sticking point.\n');
}

// One proposed claim that names the node id, newest in the room. A sourced claim points at a source node (so the room's
// own record recommends "approve"); an unsourced one is recommended "hold".
let claimCounter = 0;
function newClaim(roomDir, tag, sourced, env) {
  claimCounter += 1;
  const n = claimCounter;
  const text = 'Pilot note ' + tag + ' about ' + NODE + ': the person must click to confirm (' + n + ').';
  return runChild(
    'const db = openRoomDb(' + J(roomDir) + ');' +
      'try {' +
      "const c = navigation.writeClaimNode(db, { knowledge_type: 'fact', text: " + J(text) + ", sessionId: 'gate-' + " + J(tag + n) + " });" +
      "if (!c.ok) throw new Error('claim: ' + JSON.stringify(c));" +
      'let src = null;' +
      (sourced
        ? "const s = navigation.writeEvidenceClaim(db, { topic: " + J('Interview source ' + tag) + ", source: 'e2e-369', url: " + J('https://example.org/369/gate/' + n) + ", retrieved_at: '2026-10-01T00:00:00Z', evidence_tier: 'Academic', summary: 'interview', sessionId: 'gate-src-' + " + J(tag + n) + " });" +
          "if (!s.ok) throw new Error('source: ' + JSON.stringify(s));" +
          'src = s.node_id || s.id;' +
          "const e = navigation.writeEdge(db, { source_id: c.node_id, target_id: src, edge_type: 'SOURCED_FROM', properties: { origin: 'e2e-369' } });" +
          "if (!e.ok) throw new Error('edge: ' + JSON.stringify(e));" +
          "db.prepare('UPDATE nodes SET source_path = ? WHERE id = ?').run(" + J(SOURCE_DOC) + ', src);'
        : '') +
      'console.log(JSON.stringify({ claim: c.node_id, source: src }));' +
      '} finally { closeRoomDb(db); }',
    env
  );
}

// ---------------------------------------------------------------------------------------------
// Arms
// ---------------------------------------------------------------------------------------------

const results = [];
let onFail = null;
async function arm(name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    results.push({ name, ok: true });
    console.log('  PASS ' + name + ' (' + (Date.now() - t0) + ' ms)');
  } catch (err) {
    results.push({ name, ok: false });
    console.log('  FAIL ' + name);
    console.log('    ' + String((err && err.stack) || err).split('\n').slice(0, 8).join('\n    '));
    if (onFail) {
      try {
        console.log('    page: ' + (await onFail()));
      } catch (_e) { /* the page is gone */ }
    }
  }
}

async function main() {
  if (!pw.resolvePlaywright()) GAP('Playwright is not installed (spike 006 install or a walled dev package)');
  if (!fs.existsSync(path.join(STANDALONE, 'server.js'))) GAP('the shell is not built (cd ui/shell && npm run build)');
  const rootNm = path.join(REPO, 'node_modules');
  if (!fs.existsSync(path.join(rootNm, 'next', 'package.json')) || !fs.existsSync(path.join(rootNm, 'react-dom', 'package.json'))) {
    GAP('the root node_modules does not carry next and react-dom (run npm ci --ignore-scripts at the repo root)');
  }
  let launched;
  try {
    launched = await pw.launch();
  } catch (e) {
    GAP('Chromium could not launch: ' + String(e.message || e).split('\n')[0]);
  }
  const { browser } = launched;

  const plugin = path.join(HERMETIC, 'plugin');
  fs.mkdirSync(path.join(plugin, 'lib', 'ui-shell'), { recursive: true });
  fs.symlinkSync(rootNm, path.join(plugin, 'node_modules'), 'dir');
  const dist = path.join(plugin, 'lib', 'ui-shell', 'dist');
  fs.cpSync(STANDALONE, dist, { recursive: true });

  let daemon;
  try {
    daemon = await D.startDaemon({
      rooms: [
        { slug: 'room-v', variant: 'wide', migrate: true },
        { slug: 'room-q', variant: 'wide', migrate: true },
      ],
      extraEnv: { MINDRIAN_TEST_MODE: '1' },
    });
  } catch (err) {
    GAP('the hermetic daemon could not start (' + String(err && err.message).slice(0, 200) + ')');
  }
  const roomV = daemon.roomDirs['room-v'];
  seedRoom(roomV);

  const shellPort = await freePort();
  const code1 = crypto.randomBytes(32).toString('base64url');
  const tokenFile = path.join(HERMETIC, 'ctl', 'control.token');
  const env = Object.assign({}, process.env, {
    HOME: HERMETIC, USERPROFILE: HERMETIC, MINDRIAN_ROOMS_HOME: path.join(HERMETIC, 'rooms'),
    MOS_DAEMON_URL: 'http://127.0.0.1:' + daemon.port, MOS_SHELL_PORT: String(shellPort), MOS_PROPOSAL_SOURCE: 'adapter',
    MOS_SHELL_BOOTSTRAP_SHA256: sha(code1), MOS_SHELL_CONTROL_TOKEN_FILE: tokenFile,
    HOSTNAME: '127.0.0.1', PORT: String(shellPort), NEXT_TELEMETRY_DISABLED: '1', DO_NOT_TRACK: '1',
  });
  const shell = cp.spawn(process.execPath, ['server.js'], { cwd: dist, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let shellLog = '';
  shell.stdout.on('data', (d) => { shellLog += d; });
  shell.stderr.on('data', (d) => { shellLog += d; });
  const origin = 'http://127.0.0.1:' + shellPort;

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const egress = pw.captureEgress(page);
  const consoleErrors = [];
  const cspEvents = [];
  await context.exposeFunction('__cspReport', (line) => { cspEvents.push(line); });
  await context.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => window.__cspReport(e.violatedDirective + ' ' + e.blockedURI + ' ' + e.sourceFile + ':' + e.lineNumber));
  });
  const watch = (p) => {
    p.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    p.on('pageerror', (e) => consoleErrors.push(String((e && e.message) || e)));
  };
  watch(page);
  let approveCalls = 0;
  page.on('request', (r) => { if (r.url().includes('/api/actions/approveDecision')) approveCalls += 1; });
  onFail = async () => page.url() + ' | ' + (await page.locator('#view').innerText()).replace(/\s+/g, ' ').slice(0, 600);

  const view = () => page.locator('#view');
  const viewText = async (p) => ((await (p || page).locator('#view').innerText()) || '').replace(/\s+/g, ' ');

  async function openRoom(p, slug) {
    await p.goto(origin + '/?rooms');
    const row = p.locator('.room-list-row', { hasText: slug });
    await row.waitFor({ timeout: 20000 });
    await row.getByText('Open this room').click();
    await p.getByRole('button', { name: /^Switch to/ }).click({ timeout: 2500 }).catch(() => {});
    await p.waitForFunction((s) => document.querySelector('.rs-name') && document.querySelector('.rs-name').textContent === s, slug, { timeout: 20000 });
  }
  // A page-side action call, as the browser makes it (cookie and CSRF from the page).
  const act = (p, name, body) =>
    p.evaluate(
      async ({ name, body }) => {
        const csrf = document.querySelector('meta[name="mos-csrf"]').getAttribute('content');
        const res = await fetch('/api/actions/' + name, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json', 'x-mos-csrf': csrf }, body: JSON.stringify(body || {}) });
        return res.json();
      },
      { name, body }
    );
  // A new claim, then the proposal that mints a gate on the browser session.
  async function mint(p, tag, sourced) {
    const ids = await newClaim(roomV, tag, sourced, daemon.env);
    const asked = await act(p, 'askClaude', { selectedNodeId: NODE, question: 'Should this claim be confirmed?' });
    assert.strictEqual(asked.ok, true, 'the proposal minted a gate: ' + J(asked));
    assert.strictEqual(asked.subject_node_id, ids.claim, 'the proposal is about the claim just filed: ' + J({ asked, ids }));
    assert.strictEqual(asked.recommended_id, sourced ? 'approve' : 'hold', 'the room recommends from its own record: ' + J(asked));
    return { gate: asked.gate_id, claim: ids.claim, source: ids.source };
  }
  async function openGate(p, gateId, state) {
    await p.goto(origin + '/gate/' + encodeURIComponent(gateId));
    await p.waitForSelector('#view .gate-card[data-state="' + (state || 'ready') + '"]', { timeout: 30000 });
  }
  const primary = (p) => (p || page).locator('#view .ab[data-variant="primary"]');
  const status = async (p) => ((await (p || page).locator('.gate-status').first().innerText()) || '').replace(/\s+/g, ' ').trim();

  console.log('Phase 369-27 gate button, real browser');
  try {
    await waitUntil(async () => fs.existsSync(tokenFile) && (await request(shellPort, { path: '/auth/bootstrap', headers: { 'sec-fetch-site': 'none' } })).status > 0, 30000, 'the shell to answer', 100);
    await page.goto(origin + '/auth/bootstrap?code=' + encodeURIComponent(code1));
    await page.waitForSelector('header.shell-header', { timeout: 30000 });
    await openRoom(page, 'room-v');

    let g1 = null;
    await arm('1 the recommendation is checked and the action is enabled; the evidence opens inline; no recommendation: nothing checked, the action is disabled', async () => {
      g1 = await mint(page, 'g1', true);
      await openGate(page, g1.gate);
      // The eyebrow, the one H1 and the provenance line.
      const text = await viewText();
      assert.ok(/WAITING FOR YOU/i.test(text) && /DECISION \/ room-v/i.test(text), text.slice(0, 300));
      assert.strictEqual(await page.$$eval('h1', (els) => els.length), 1);
      assert.ok(text.includes('Proposal from Claude Code. Only a person can approve it.'), 'the provenance line on an adapter proposal');
      // The subject: its text, then its tile with the written status (read from the browser copy once it holds the claim).
      await page.waitForSelector('.gate-subject .tile', { timeout: 45000 });
      assert.ok((await page.locator('.gate-subject-text').textContent()).includes('Pilot note g1'), 'the subject text');
      assert.strictEqual((await page.locator('.gate-subject .tile-status').textContent()).trim(), 'PROPOSED');
      // The recommended option is checked; the tag says so once; the primary action is enabled.
      assert.strictEqual(await page.locator('input.opt-input:checked').getAttribute('value'), 'approve');
      assert.strictEqual(await page.locator('.opt-tag').count(), 1);
      assert.strictEqual(await page.locator('.opt-row[data-recommended="true"]').getAttribute('data-option'), 'approve');
      assert.strictEqual(await primary().getAttribute('aria-disabled'), null, 'the primary action is enabled');
      assert.ok((await primary().locator('.ab-label').textContent()).startsWith('Approve'), 'the label names the approval');
      // Options are ranked: two-digit prefixes in order.
      assert.deepStrictEqual(await page.$$eval('.opt-rank', (els) => els.map((e) => e.textContent)), ['01', '02', '03']);
      // The notice band is the contract's, and the options sit in a fieldset with a legend.
      assert.strictEqual(await page.locator('fieldset.gate-answer legend').textContent(), 'Your answer');
      // Evidence is reachable on the same page: the region lists the evidence, and the source opens in the document display.
      await page.waitForSelector('aside.gate-evidence[data-placement="side"]', { timeout: 15000 });
      const evidence = await page.locator('aside.gate-evidence').innerText();
      assert.ok(/Evidence \(2\)/i.test(evidence), evidence);
      await page.locator('.gate-evidence-item summary', { hasText: 'Interview source g1' }).click();
      await page.waitForFunction(() => { const el = document.querySelector('.gate-evidence .doc-display'); return !!el && el.textContent.includes('Interview notes'); }, null, { timeout: 30000 });
      assert.strictEqual(await page.$$eval('[contenteditable="true"]', (els) => els.length), 0, 'the evidence document is read only');

      // A card that carries no recommendation (the contract's recommended id removed on the wire): nothing is checked.
      await page.route('**/api/actions/readGate', async (route) => {
        const res = await route.fetch();
        const body = await res.json();
        if (body && body.gate && body.gate.rendered && body.gate.rendered.contract) {
          body.gate.rendered.contract.recommended = null;
          for (const o of body.gate.rendered.contract.superset_options) o.recommended = false;
        }
        await route.fulfill({ response: res, json: body });
      });
      try {
        await openGate(page, g1.gate);
        assert.strictEqual(await page.locator('input.opt-input:checked').count(), 0, 'nothing is preselected');
        assert.strictEqual(await page.locator('.opt-tag').count(), 0);
        assert.strictEqual(await primary().getAttribute('aria-disabled'), 'true');
        assert.strictEqual(await primary().locator('.ab-consequence').textContent(), 'Choose an answer first.');
        const before = approveCalls;
        await primary().click({ force: true });
        await sleep(300);
        assert.strictEqual(approveCalls, before, 'a disabled action sends nothing');
        // Choosing an answer enables it.
        await page.locator('.opt-row[data-option="approve"] label').click();
        assert.strictEqual(await primary().getAttribute('aria-disabled'), null);
      } finally {
        await page.unroute('**/api/actions/readGate');
      }
    });

    await arm('2 Enter inside the option group does not answer', async () => {
      await openGate(page, g1.gate);
      const before = approveCalls;
      await page.locator('input.opt-input:checked').focus();
      await page.keyboard.press('Enter');
      await page.keyboard.press('Enter');
      await sleep(400);
      assert.strictEqual(approveCalls, before, 'no answer was sent');
      assert.strictEqual(await page.locator('#view .gate-card').getAttribute('data-state'), 'ready');
      assert.strictEqual(await page.locator('.gate-status').count(), 0);
      assert.strictEqual(decisionNodes(roomV, g1.gate).length, 0, 'nothing was written');
    });

    let approvedGate = null;
    await arm('3 Approve shows Saving, then the recorded state with the rust square; the decision appears in Decisions', async () => {
      await openGate(page, g1.gate);
      // Hold the response for a moment so Saving is on screen.
      await page.route('**/api/actions/approveDecision', async (route) => {
        await sleep(900);
        await route.continue();
      });
      try {
        await primary().click();
        await page.waitForSelector('#view .gate-card[data-state="saving"]', { timeout: 10000 });
        assert.strictEqual(await primary().locator('.ab-label').textContent(), 'Saving your answer...');
        assert.strictEqual(await primary().getAttribute('aria-disabled'), 'true', 'the action stops answering while saving');
        assert.strictEqual(await page.locator('fieldset.gate-answer').evaluate((el) => el.disabled), true, 'the options are disabled while saving');
        assert.strictEqual(await primary().locator('[data-marker="line"]').count(), 1, 'the triangle became the progress line');
        await page.waitForSelector('#view .gate-card[data-state="recorded"]', { timeout: 30000 });
      } finally {
        await page.unroute('**/api/actions/approveDecision');
      }
      assert.strictEqual(await status(), 'Decision recorded in the room.');
      assert.strictEqual(await page.locator('.gate-status').evaluate((el) => getComputedStyle(el).color), SUCCESS_RGB, 'the success colour');
      assert.strictEqual(await page.locator('.gate-status .sm[data-mark="square"]').evaluate((el) => getComputedStyle(el).backgroundColor), RUST_RGB, 'the rust completion square');
      assert.ok((await viewText()).includes('It now appears in Decisions with its evidence.'));
      assert.strictEqual(await page.locator('.opt-row').count(), 0, 'options and actions are removed');
      assert.ok((await page.locator('h1').textContent()).endsWith('.'), 'the H1 is the chosen answer and a period');
      assert.strictEqual(await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-gate-status')), 'recorded', 'focus moved to the status line');
      assert.strictEqual(await primary().locator('.ab-label').textContent(), 'Back to Work');
      assert.strictEqual(await page.locator('#view .ab[data-variant="primary"]').count(), 1, 'still one primary action');
      assert.strictEqual(decisionNodes(roomV, g1.gate).length, 1, 'the room wrote the decision once');
      approvedGate = g1.gate;
      // The decision is in Decisions: from the gate view to the tab by its link, no page reload by hand.
      await page.locator('nav a', { hasText: 'Decisions' }).first().click();
      await page.waitForSelector('[data-group="settled"] .item-row', { timeout: 30000 });
      await waitUntil(async () => (await page.locator('[data-group="settled"]').innerText()).includes('Decision on'), 30000, 'the recorded decision in Settled', 250);
    });

    await arm('4 Reject and Decide later show "Your answer is recorded." with no rust square', async () => {
      for (const [tag, label, verdictWord] of [['g4a', 'Reject', 'reject'], ['g4b', 'Decide later', 'defer']]) {
        const g = await mint(page, tag, false);
        await openGate(page, g.gate);
        assert.strictEqual(await page.locator('input.opt-input:checked').getAttribute('value'), 'hold', 'the room recommends holding an unsourced claim');
        assert.ok((await primary().locator('.ab-label').textContent()).startsWith('Record: '), 'a hold selection never reads as Approve');
        if (label === 'Reject') await page.locator('#view .ab[data-variant="secondary"]', { hasText: 'Reject' }).click();
        else await page.locator('#view .text-action', { hasText: 'Decide later' }).click();
        await page.waitForSelector('#view .gate-card[data-state="recorded"]', { timeout: 30000 });
        assert.strictEqual(await status(), 'Your answer is recorded.', verdictWord);
        assert.strictEqual(await page.locator('.gate-status').evaluate((el) => getComputedStyle(el).color), 'rgb(20, 32, 43)', 'ink, not the success colour');
        assert.strictEqual(await page.locator('.gate-status .sm').count(), 0, 'no rust square: nothing became fixed');
        assert.ok((await viewText()).includes('Nothing else was saved to the room.'));
        assert.strictEqual(claimStatus(roomV, g.claim), 'proposed', 'the claim was not confirmed by a ' + verdictWord);
      }
    });

    await arm('5 replayed: re-opening an answered gate id says it was already recorded', async () => {
      await openGate(page, approvedGate, 'recorded');
      assert.strictEqual(await status(), 'This decision was already recorded.');
      assert.strictEqual(await page.locator('.gate-status .sm[data-mark="square"]').count(), 1, 'an approve keeps its square');
      assert.strictEqual(await page.locator('.opt-row').count(), 0);
      assert.strictEqual(decisionNodes(roomV, approvedGate).length, 1, 'nothing was written twice');
    });

    await arm('6 lost in transit: the response is dropped after the room saved it; the view checks by gate id, then shows the recorded state', async () => {
      const g = await mint(page, 'g6', true);
      await openGate(page, g.gate);
      let dropped = false;
      await page.route('**/api/actions/approveDecision', async (route) => {
        if (!dropped) {
          dropped = true;
          await route.fetch();
          await route.abort('failed');
        } else {
          await route.continue();
        }
      });
      // Hold the check a moment so the checking state is on screen.
      await page.route('**/api/actions/readGate', async (route) => {
        await sleep(1200);
        await route.continue();
      });
      try {
        await primary().click();
        await page.waitForSelector('#view .gate-card[data-state="checking"]', { timeout: 10000 });
        assert.strictEqual(await primary().locator('.ab-label').textContent(), 'Checking whether your answer was saved...');
        assert.ok(!(await viewText()).includes('Decision recorded in the room.'), 'never "recorded" before the room says so');
        await page.waitForSelector('#view .gate-card[data-state="recorded"]', { timeout: 40000 });
      } finally {
        await page.unroute('**/api/actions/approveDecision');
        await page.unroute('**/api/actions/readGate');
      }
      assert.strictEqual(dropped, true);
      assert.strictEqual(await status(), 'Decision recorded in the room.');
      assert.strictEqual(decisionNodes(roomV, g.gate).length, 1, 'saved once, not once per check');
    });

    await arm('7 stale_subject: the claim changed after the card opened; the stale copy shows and nothing is saved', async () => {
      const g = await mint(page, 'g7', true);
      await openGate(page, g.gate);
      const child = cp.spawnSync('node', ['-e',
        "const { DatabaseSync } = require('node:sqlite');" +
        "const db = new DatabaseSync(process.argv[1]); db.exec('PRAGMA busy_timeout = 5000');" +
        "db.prepare('UPDATE nodes SET last_seen_at = ? WHERE id = ?').run(Date.now(), process.argv[2]); db.close();",
        path.join(roomV, '.mindrian', 'room.db'), g.claim,
      ], { encoding: 'utf8' });
      assert.strictEqual(child.status, 0, child.stderr);
      await primary().click();
      await page.waitForSelector('#view .gate-card[data-state="refused"]', { timeout: 30000 });
      const text = await viewText();
      assert.ok(text.includes('The claim changed after this decision was opened.'), text.slice(0, 400));
      assert.ok(text.includes('Approving an old version could confirm something that is no longer true.'));
      assert.ok(text.includes('Nothing was saved. See what changed, then ask Larry in Claude Code for a fresh decision.'));
      assert.strictEqual(await page.locator('.gate-refusal a', { hasText: 'See what changed' }).count(), 1);
      assert.strictEqual(decisionNodes(roomV, g.gate).length, 0, 'nothing saved');
      assert.notStrictEqual(claimStatus(roomV, g.claim), 'confirmed', 'the claim is not confirmed');
      assert.strictEqual(await page.locator('.gate-status').count(), 0, 'no recorded line');
    });

    await arm('8 room_switched: the browser left the room after the decision opened; the room copy shows and nothing is saved', async () => {
      const g = await mint(page, 'g8', true);
      await openGate(page, g.gate);
      const left = await act(page, 'openRoom', { room: 'room-q', confirmLeave: true });
      assert.strictEqual(left.ok, true, J(left));
      try {
        await primary().click();
        await page.waitForSelector('#view .gate-card[data-state="refused"]', { timeout: 30000 });
        const text = await viewText();
        assert.ok(text.includes('This decision belongs to room-v.'), text.slice(0, 400));
        assert.ok(text.includes('This browser switched rooms after the decision opened.'));
        assert.ok(text.includes('Nothing was saved. Switch back to room-v and ask for the decision again in Claude Code.'));
        assert.strictEqual(decisionNodes(roomV, g.gate).length, 0);
        // Re-opening the old gate id says the same.
        await page.goto(origin + '/gate/' + encodeURIComponent(g.gate));
        await page.waitForSelector('#view .gate-card[data-refusal="room_switched"]', { timeout: 30000 });
        assert.ok((await page.locator('#view h1').textContent()).includes('belongs to room-v'));
      } finally {
        const back = await act(page, 'openRoom', { room: 'room-v', confirmLeave: true });
        assert.strictEqual(back.ok, true, J(back));
      }
    });

    await arm('9 gate_expired through the test marker: "This decision is no longer open." and nothing is saved', async () => {
      const g = await mint(page, 'g9', true);
      await openGate(page, g.gate);
      const marker = path.join(roomV, '.mindrian', '.test-fault-gate-expire');
      fs.writeFileSync(marker, g.gate);
      await primary().click();
      await page.waitForSelector('#view .gate-card[data-state="refused"]', { timeout: 30000 });
      const text = await viewText();
      assert.ok(text.includes('This decision is no longer open.'), text.slice(0, 400));
      assert.ok(text.includes('Open decisions close after a while, and they close when MindrianOS restarts.'));
      assert.ok(text.includes('Nothing was saved. Ask Larry in Claude Code to raise it again.'));
      assert.strictEqual(page.url().includes(g.gate), true);
      assert.strictEqual(decisionNodes(roomV, g.gate).length, 0);
      assert.strictEqual(claimStatus(roomV, g.claim), 'proposed');
      try { fs.unlinkSync(marker); } catch (_e) { /* consumed */ }
    });

    let open10 = null;
    await arm('10 session_mismatch: a second browser session has no gate to answer here; the first session stays answerable; the refusal copy renders', async () => {
      open10 = await mint(page, 'g10', true);
      // A second signed-in browser context (a second browser session).
      const code2 = crypto.randomBytes(32).toString('base64url');
      const token = fs.readFileSync(tokenFile, 'utf8').trim();
      const armed = await request(shellPort, { method: 'POST', path: '/control/bootstrap', headers: { 'content-type': 'application/json', 'x-mos-control-token': token }, body: J({ sha256: sha(code2) }) });
      assert.strictEqual(armed.status, 200, armed.body);
      const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page2 = await ctx2.newPage();
      watch(page2);
      try {
        await page2.goto(origin + '/auth/bootstrap?code=' + encodeURIComponent(code2));
        await page2.waitForSelector('header.shell-header', { timeout: 30000 });
        await openRoom(page2, 'room-v');
        await page2.goto(origin + '/gate/' + encodeURIComponent(open10.gate));
        await page2.waitForSelector('#view .gate-card[data-refusal]', { timeout: 30000 });
        assert.strictEqual(await page2.locator('#view .gate-card').getAttribute('data-refusal'), 'unknown_gate');
        assert.ok((await viewText(page2)).includes('This decision is no longer open.'));
        assert.strictEqual(await page2.locator('.opt-row').count(), 0, 'the other session offers no answer');
        // The first session still holds it, answerable.
        const listed = await act(page, 'listOpenGates', {});
        assert.ok(listed.gates.some((x) => x.gate_id === open10.gate), 'the gate is still open in the first session');
      } finally {
        await ctx2.close();
      }
      // The refusal the server gives a different MCP session (proven against the real server in test-369-human-only and
      // test-369-gate-recovery): the copy a person reads.
      await openGate(page, open10.gate);
      await page.route('**/api/actions/approveDecision', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: J({ ok: false, reason: 'session_mismatch', gate_id: open10.gate }) });
      });
      try {
        await primary().click();
        await page.waitForSelector('#view .gate-card[data-state="refused"]', { timeout: 15000 });
        const text = await viewText();
        assert.ok(text.includes('This decision was opened in another session.'), text.slice(0, 300));
        assert.ok(text.includes('A decision can only be answered where it was opened.'));
        assert.ok(text.includes('Nothing was saved. Answer it in the session that opened it.'));
      } finally {
        await page.unroute('**/api/actions/approveDecision');
      }
      assert.strictEqual(decisionNodes(roomV, open10.gate).length, 0);
    });

    await arm('11 human_only: an approve with a stale render nonce shows the human-only copy after the one automatic re-read; nothing is saved', async () => {
      const g = await mint(page, 'g11', true);
      await openGate(page, g.gate);
      // Another tab reads the same gate: the server issues it a fresh nonce, and this tab's is stale.
      const tab2 = await context.newPage();
      watch(tab2);
      try {
        await tab2.goto(origin + '/gate/' + encodeURIComponent(g.gate));
        await tab2.waitForSelector('#view .gate-card[data-state="ready"]', { timeout: 30000 });
      } finally {
        await tab2.close();
      }
      let reReads = 0;
      page.on('request', (r) => { if (r.url().includes('/api/actions/readGate')) reReads += 1; });
      const readsBefore = reReads;
      await primary().click();
      await page.waitForSelector('#view .gate-card[data-state="refused"]', { timeout: 30000 });
      const text = await viewText();
      assert.ok(text.includes('Only a person can approve this.'), text.slice(0, 300));
      assert.ok(text.includes('The request did not come from a click in this browser.'));
      assert.ok(text.includes('Reload the page and approve it here.'));
      assert.ok(reReads - readsBefore >= 1, 'the page re-read the gate once for a fresh nonce');
      assert.strictEqual(decisionNodes(roomV, g.gate).length, 0, 'nothing was saved');
      // Reloading gives a valid click.
      await openGate(page, g.gate);
      await primary().click();
      await page.waitForSelector('#view .gate-card[data-state="recorded"]', { timeout: 30000 });
      assert.strictEqual(decisionNodes(roomV, g.gate).length, 1);
    });

    await arm('12 persistence failure: the InlineError sits above the still-enabled actions; the next answer is recorded', async () => {
      const g = await mint(page, 'g12', true);
      await openGate(page, g.gate);
      const marker = path.join(roomV, '.mindrian', '.test-fault-gate-persist');
      fs.writeFileSync(marker, 'x');
      await primary().click();
      await page.waitForSelector('#view .gate-error .inline-error', { timeout: 30000 });
      const text = await viewText();
      assert.ok(text.includes('The room could not save your answer.'), text.slice(0, 400));
      assert.ok(text.includes('Nothing was written and the decision is still open. Try again.'));
      assert.strictEqual(await page.locator('#view .gate-card').getAttribute('data-state'), 'ready', 'the gate is still open');
      assert.strictEqual(await primary().getAttribute('aria-disabled'), null, 'the primary action is still enabled');
      assert.strictEqual(await page.locator('fieldset.gate-answer').evaluate((el) => el.disabled), false, 'the options are still enabled');
      assert.strictEqual(await page.locator('#view .ab[data-variant="secondary"]', { hasText: 'Reject' }).count(), 1, 'Reject is still offered');
      const above = await page.evaluate(() => {
        const err = document.querySelector('.gate-error').getBoundingClientRect().bottom;
        const btn = document.querySelector('#view .ab[data-variant="primary"]').getBoundingClientRect().top;
        return err <= btn + 1;
      });
      assert.strictEqual(above, true, 'the error is above the actions');
      assert.strictEqual(decisionNodes(roomV, g.gate).length, 0, 'nothing was written');
      assert.strictEqual(fs.existsSync(marker), false, 'the marker was consumed');
      await primary().click();
      await page.waitForSelector('#view .gate-card[data-state="recorded"]', { timeout: 30000 });
      assert.strictEqual(await status(), 'Decision recorded in the room.');
      assert.strictEqual(decisionNodes(roomV, g.gate).length, 1);
    });

    await arm('13 the session indicator shows the risk tier while an answer is being checked', async () => {
      const g = await mint(page, 'g13', true);
      await openGate(page, g.gate);
      assert.notStrictEqual(await page.locator('.session-indicator').first().getAttribute('data-state'), 'risk', 'not at risk before an answer');
      let dropped = false;
      await page.route('**/api/actions/approveDecision', async (route) => {
        if (!dropped) {
          dropped = true;
          await route.fetch();
          await route.abort('failed');
        } else {
          await route.continue();
        }
      });
      // Hold the checks long enough to look, and let the status read say the link is not live.
      await page.route('**/api/actions/readGate', async (route) => {
        await sleep(3500);
        await route.continue();
      });
      await page.route('**/api/status*', async (route) => {
        const res = await route.fetch();
        const body = await res.json();
        body.connection = 'reconnecting';
        body.lastAckAt = 1;
        await route.fulfill({ response: res, json: body });
      });
      try {
        await primary().click();
        await page.waitForSelector('#view .gate-card[data-state="checking"]', { timeout: 10000 });
        await page.waitForSelector('.session-indicator[data-state="risk"]', { timeout: 15000 });
        const words = await page.locator('.session-indicator[data-state="risk"]').first().innerText();
        assert.ok(words.includes('Your answer is not confirmed yet.'), words);
        await page.waitForSelector('#view .gate-card[data-state="recorded"]', { timeout: 60000 });
      } finally {
        await page.unroute('**/api/actions/approveDecision');
        await page.unroute('**/api/actions/readGate');
        await page.unroute('**/api/status*');
      }
      // Once the answer is saved the risk tier clears.
      await waitUntil(async () => (await page.locator('.session-indicator').first().getAttribute('data-state')) !== 'risk', 20000, 'the risk tier to clear', 200);
      assert.strictEqual(decisionNodes(roomV, g.gate).length, 1);
    });

    await arm('14 radius 0 except the circle mark, one H1, one primary action, one ochre triangle', async () => {
      await openGate(page, open10.gate);
      const radii = await page.$$eval('#view *', (els) => els.filter((e) => !e.matches('[data-mark="circle"]') && getComputedStyle(e).borderRadius !== '0px').map((e) => e.tagName + '.' + e.className));
      assert.deepStrictEqual(radii, [], 'every gate element has radius 0');
      assert.strictEqual(await page.$$eval('h1', (els) => els.length), 1, 'one H1');
      assert.strictEqual(await page.$$eval('#view .ab[data-variant="primary"]', (els) => els.length), 1, 'one primary action');
      assert.strictEqual(await page.$$eval('#view .sm-tri', (els) => els.length), 1, 'one ochre triangle');
      assert.strictEqual(await page.$$eval('#view [data-mark="circle"]', (els) => els.length), 0, 'no circle on the gate view');
      assert.strictEqual(await page.$$eval('#view [data-tile]', (els) => els.filter((e) => !(e.querySelector('.tile-status') || {}).textContent).length), 0, 'no tile without its words');
      // A phone: no sideways scroll, the evidence is a disclosure under the subject, then the options and the actions.
      await page.setViewportSize({ width: 390, height: 844 });
      try {
        await openGate(page, open10.gate);
        await page.waitForSelector('details.gate-evidence[data-placement="inline"]', { timeout: 15000 });
        assert.ok((await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0, 'no sideways scroll at 390 px');
        const order = await page.evaluate(() => {
          const top = (sel) => document.querySelector(sel).getBoundingClientRect().top;
          return { evidence: top('details.gate-evidence'), options: top('fieldset.gate-answer'), action: top('#view .ab[data-variant="primary"]') };
        });
        assert.ok(order.evidence < order.options && order.options < order.action, 'evidence, then options, then actions: ' + J(order));
        assert.strictEqual(await page.locator('details.gate-evidence').evaluate((el) => el.open), true, 'two items: open by default');
        assert.ok((await page.locator('.opt-label').first().evaluate((el) => el.getBoundingClientRect().height)) >= 56, 'option rows are at least 56 px');
      } finally {
        await page.setViewportSize({ width: 1280, height: 900 });
      }
    });

    await arm('15 egress: only 127.0.0.1, no iframe, no unexpected console or page error, no CSP violation', async () => {
      pw.assertOnlyLoopback(egress);
      assert.strictEqual(await page.$$eval('iframe', (els) => els.length), 0, 'no iframe in the page');
      assert.deepStrictEqual(cspEvents, [], 'no Content-Security-Policy violation: ' + J(cspEvents.slice(0, 3)));
      const bad = consoleErrors.filter((m) => !/Failed to load resource|net::ERR|ERR_CONNECTION|ERR_FAILED|the server responded with a status|EventSource|aborted|Failed to fetch|TypeError: Load failed/i.test(m));
      assert.deepStrictEqual(bad, [], 'no unexpected console or page errors: ' + bad.slice(0, 3).join(' | '));
    });
  } finally {
    await browser.close().catch(() => {});
    await new Promise((resolve) => {
      if (shell.exitCode !== null) return resolve();
      shell.once('exit', resolve);
      shell.kill('SIGTERM');
      setTimeout(() => { try { shell.kill('SIGKILL'); } catch (_e) { /* gone */ } resolve(); }, 3000).unref();
    });
    await D.stopDaemon(daemon);
  }

  const failed = results.filter((r) => !r.ok).length;
  const ownSource = fs.readFileSync(__filename, 'utf8');
  if (ownSource.includes(EM) || ownSource.includes(EN)) {
    console.log('  FAIL dash guard: this file carries a dash character');
    process.exit(1);
  }
  if (failed > 0) {
    console.log('\n' + failed + ' of ' + results.length + ' arms failed');
    console.log('--- shell log (tail) ---\n' + shellLog.split('\n').slice(-12).join('\n'));
    process.exit(1);
  }
  console.log('\nPASS: all ' + results.length + ' arms');
}

main().catch((err) => {
  console.error('FATAL ' + String((err && err.stack) || err));
  process.exit(1);
});
