#!/usr/bin/env node
'use strict';

/*
 * tests/e2e-369/views.cjs -- Phase 369-25 (SHELL369-06, SHELL369-07): the review views in a real browser,
 * against the built shell and a hermetic daemon.
 *
 * What runs: a hermetic flag-ON daemon with one fixture room (a governing question, evidence with one CONTRADICTS
 * pair, a claim a person confirmed, a proposed claim, a recorded decision and a deliverable with a real Markdown
 * file), the built shell (a plugin-like tree that reaches only the root node_modules), and a Chromium page signed in
 * with an armed bootstrap code. Writes after the first visit come from a child process through the write door,
 * as a hook would make them. One egress capture and one console capture span the whole run.
 *
 * Arms:
 *   1  first visit: Work shows the question as the only H1, "What the room holds now", no "Since you were here"
 *   2  a decision waiting: the Next decision panel names it, the primary action is the one ochre triangle
 *   3  leave Work, a write lands, come back: "Since you were here" lists the new item with its tile and words
 *   4  revisit with no change: "Nothing changed since your last visit on {date}."
 *   5  Evidence: the contradiction row says "Contradicts"; an item opens a read-only document (no editable
 *      element, no toolbar, no side menu, room content as text, no script run)
 *   6  Decisions: three H2 groups in order and "Confirmed by you," on the settled row
 *   7  Deliverables: a document opens, no publish, export or download control
 *   8  Graph is text only with the typed-links caption
 *   9  every view has exactly one h1, focus is on it after a page load, no tile without words
 *  10  at 390 px: no horizontal scroll, the Next decision panel sits above "Since you were here"
 *  11  a room that has no question: the empty-state H1 and its body
 *  12  egress: only 127.0.0.1, no iframe, no unexpected console or page error, no CSP violation
 *
 * Exit 77 only when Playwright, Chromium, the shell build or the root node_modules are absent; never to hide a
 * failing arm. Hermetic: temp HOME, never ~/MindrianRooms. Canon Part 8: loopback only. Canon Part 9: tests/ is
 * allow-listed for raw SQL; the seed and the child writes go through the write door, plus one source_path UPDATE
 * (the indexer writes it; no typed writer takes it). Hyphens only; the dash guard builds its characters at run time.
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
const HERMETIC = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-369-views-'));
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

const QUESTION = 'What would make this customer problem worth solving?';
const NODE_FOR_GATE = 'node-views-369';
const ITEM_DOC = 'evidence/interview.md';
const DELIVERABLE_DOC = 'deliverables/pilot-plan.md';

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

function httpStatus(port, p, headers) {
  const http = require('node:http');
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: p, headers: headers || {} }, (res) => {
      res.resume();
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject);
    req.end();
  });
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

// The room the views read: a question, evidence with a CONTRADICTS pair, a confirmed claim, a proposed claim
// that a gate can be minted about, one recorded decision and one deliverable with a real file.
function seedRoom(roomDir, env) {
  fs.mkdirSync(path.join(roomDir, 'evidence'), { recursive: true });
  fs.mkdirSync(path.join(roomDir, 'deliverables'), { recursive: true });
  fs.writeFileSync(
    path.join(roomDir, ITEM_DOC),
    '---\nsection: evidence\n---\n# Interview notes\n\nThe buyer said the pilot fee is the sticking point.\n\n- Budget is set in January\n- The pilot must show a result in 30 days\n\n<script>window.__xss = true</script>\n\n[a link](https://example.invalid/)\n'
  );
  fs.writeFileSync(path.join(roomDir, DELIVERABLE_DOC), '# Pilot plan\n\nThree steps to a result inside 30 days.\n\n1. Agree the scope\n2. Run the pilot\n3. Review the result\n');
  return runChild(
    'const db = openRoomDb(' + J(roomDir) + ');' +
      'try {' +
      "const q = frames.setGoverningQuestion(db, " + J(roomDir) + ", { text: " + J(QUESTION) + ", origin: 'chosen' });" +
      "if (!q.ok) throw new Error('question: ' + JSON.stringify(q));" +
      "const claim = (text, tag) => { const r = navigation.writeClaimNode(db, { knowledge_type: 'fact', text, sessionId: 'views-' + tag }); if (!r.ok) throw new Error('claim: ' + JSON.stringify(r)); return r.node_id; };" +
      "const a = claim('Demand assumption: pilots will pay for a result', 'a');" +
      "const b = claim('Interview excerpt: the buyer refuses a pilot fee', 'b');" +
      "const c = claim('Pricing claim: the pilot costs 1200 a month', 'c');" +
      "const d = claim('A note about " + NODE_FOR_GATE + ": the person must click to confirm.', 'd');" +
      "const e = navigation.writeEdge(db, { source_id: a, target_id: b, edge_type: 'CONTRADICTS', properties: { origin: 'e2e-369' } });" +
      "if (!e.ok) throw new Error('edge: ' + JSON.stringify(e));" +
      "const p = navigation.promoteNodeStatus(db, c, 'proposed', 'confirmed', 'user', 'e2e-369');" +
      "if (!p.ok) throw new Error('promote: ' + JSON.stringify(p));" +
      "db.prepare('UPDATE nodes SET source_path = ? WHERE id = ?').run(" + J(ITEM_DOC) + ", a);" +
      "insertNode(db, 'decision:e2e-views-1', 'decision', JSON.stringify({ title: 'Run the pilot at the lower fee', gate_id: 'gate-e2e-1', subject_node_id: c }), { epistemic_type: 'decision', review_status: 'confirmed' });" +
      "insertNode(db, 'artifact:e2e-views-1', 'Artifact', JSON.stringify({ title: 'Pilot plan', section: 'deliverables', file: " + J(DELIVERABLE_DOC) + " }), { epistemic_type: 'observation' });" +
      'console.log(JSON.stringify({ a, b, c, d }));' +
      '} finally { closeRoomDb(db); }',
    env
  );
}

function writeClaim(roomDir, text, tag, env) {
  return runChild(
    'const db = openRoomDb(' + J(roomDir) + ');' +
      'try { const r = navigation.writeClaimNode(db, { knowledge_type: ' + "'fact'" + ', text: ' + J(text) + ', sessionId: ' + J('views-' + tag) + ' }); if (!r.ok) throw new Error(JSON.stringify(r));' +
      'console.log(JSON.stringify({ id: r.node_id })); } finally { closeRoomDb(db); }',
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

  // The plugin-like tree: built output plus only the root node_modules (the ruled shape).
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
    });
  } catch (err) {
    GAP('the hermetic daemon could not start (' + String(err && err.message).slice(0, 200) + ')');
  }
  const roomV = daemon.roomDirs['room-v'];
  const ids = await seedRoom(roomV, daemon.env);

  const shellPort = await freePort();
  const code = crypto.randomBytes(32).toString('base64url');
  const tokenFile = path.join(HERMETIC, 'ctl', 'control.token');
  const env = Object.assign({}, process.env, {
    HOME: HERMETIC, USERPROFILE: HERMETIC, MINDRIAN_ROOMS_HOME: path.join(HERMETIC, 'rooms'),
    MOS_DAEMON_URL: 'http://127.0.0.1:' + daemon.port, MOS_SHELL_PORT: String(shellPort), MOS_PROPOSAL_SOURCE: 'adapter',
    MOS_SHELL_BOOTSTRAP_SHA256: sha(code), MOS_SHELL_CONTROL_TOKEN_FILE: tokenFile,
    HOSTNAME: '127.0.0.1', PORT: String(shellPort), NEXT_TELEMETRY_DISABLED: '1', DO_NOT_TRACK: '1',
  });
  const shell = cp.spawn(process.execPath, ['server.js'], { cwd: dist, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let shellLog = '';
  shell.stdout.on('data', (d) => { shellLog += d; });
  shell.stderr.on('data', (d) => { shellLog += d; });
  const origin = 'http://127.0.0.1:' + shellPort;

  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const egress = pw.captureEgress(page);
  const consoleErrors = [];
  const cspViolations = [];
  const cspEvents = [];
  await page.exposeFunction('__cspReport', (line) => { cspEvents.push(line); });
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => window.__cspReport(e.violatedDirective + ' ' + e.blockedURI + ' ' + e.sourceFile + ':' + e.lineNumber + ' ' + String(e.sample).slice(0, 80)));
  });
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    consoleErrors.push(m.text());
    if (/Content Security Policy|Refused to/i.test(m.text())) cspViolations.push(m.text());
  });
  onFail = async () => page.url() + ' | ' + (await page.locator('#view').innerText()).replace(/\s+/g, ' ').slice(0, 500) + ' | since: ' + (await page.$$eval('.work-since', (els) => els.map((e) => e.outerHTML.slice(0, 260)).join(' // '))) + ' | copy: ' + (await page.$$eval('[data-row="browser-copy"]', (els) => els.map((e) => e.getAttribute('data-copy-state') + '/' + e.getAttribute('data-copy-seq') + '/' + e.getAttribute('data-copy-count')).join(','))) + ' | pulls: ' + (await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name).join(','))).slice(0, 300);
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String((e && e.message) || e)));

  let styledAfterDoc = [];
  // MOS_VIEWS_SHOTS=<dir> saves a screenshot of each view for the manual review against Canon v3 (1280 px and 390 px).
  const shot = async (name) => {
    if (!process.env.MOS_VIEWS_SHOTS) return;
    fs.mkdirSync(process.env.MOS_VIEWS_SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(process.env.MOS_VIEWS_SHOTS, name + '.png'), fullPage: true });
  };
  // Reading text out of the page: the main view only (the frame has its own text).
  const view = () => page.locator('#view');
  const viewText = async () => (await view().innerText()).replace(/\s+/g, ' ');

  async function openRoom(p, slug) {
    await p.goto(origin + '/?rooms');
    const row = p.locator('.room-list-row', { hasText: slug });
    await row.waitFor({ timeout: 20000 });
    await row.getByText('Open this room').click();
    // A decision open on the room being left asks first; this run switches.
    await p.getByRole('button', { name: /^Switch to/ }).click({ timeout: 2500 }).catch(() => {});
    await p.waitForFunction((s) => document.querySelector('.rs-name') && document.querySelector('.rs-name').textContent === s, slug, { timeout: 20000 });
  }
  // The copy has read the room: Status says current.
  const waitCurrent = (p) =>
    p.waitForFunction(() => { const el = document.querySelector('[data-row="browser-copy"]'); return !!el && el.getAttribute('data-copy-state') === 'current'; }, null, { timeout: 30000 });
  async function go(p, urlPath) {
    await p.goto(origin + urlPath);
    await p.waitForSelector('#view h1', { timeout: 30000 });
  }
  const h1s = (p) => p.$$eval('h1', (els) => els.map((e) => e.textContent));
  // A page load reads the room once more before it settles; wait until the view is no longer in a reading state.
  const waitWork = (p, state) => p.waitForSelector('.work-since[data-state="' + state + '"]', { timeout: 30000 });

  console.log('Phase 369-25 review views, real browser');
  try {
    await waitUntil(async () => fs.existsSync(tokenFile) && (await httpStatus(shellPort, '/auth/bootstrap', { 'sec-fetch-site': 'none' })) > 0, 30000, 'the shell to answer', 100);
    await page.goto(origin + '/auth/bootstrap?code=' + encodeURIComponent(code));
    await page.waitForSelector('header.shell-header', { timeout: 30000 });

    await arm('1 first visit: the question is the only H1, "What the room holds now", no "Since you were here"', async () => {
      await openRoom(page, 'room-v');
      await page.waitForSelector('#view h1[data-question]', { timeout: 30000 });
      assert.deepStrictEqual(await h1s(page), [QUESTION]);
      await waitWork(page, 'holds-now');
      const text = await viewText();
      assert.ok(text.includes('What the room holds now'), text.slice(0, 300));
      assert.ok(!text.includes('Since you were here'), 'no change history on a first visit');
      assert.ok(text.toLowerCase().includes('current question'), 'the eyebrow names the question');
      assert.ok(text.includes('Open decisions'), 'the open decisions are counted');
      assert.strictEqual(await page.$$eval('[data-mark="circle"]', (e) => e.length) >= 1, true, 'the current circle is drawn');
      assert.ok(text.includes('No decision is waiting for you.'), text.slice(0, 400));
      assert.ok(text.includes('Open the evidence'), 'the panel offers the evidence');
      assert.strictEqual(await page.$$eval('#view .ab[data-variant="primary"]', (e) => e.length), 1, 'one primary action');
      await shot('work-first-visit');
    });

    await arm('2 a decision waiting: the Next decision panel names it, with the one primary action', async () => {
      const asked = await page.evaluate(
        async ({ node }) => {
          const csrf = document.querySelector('meta[name="mos-csrf"]').getAttribute('content');
          const res = await fetch('/api/actions/askClaude', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json', 'x-mos-csrf': csrf }, body: JSON.stringify({ selectedNodeId: node, question: 'Should this claim be confirmed?' }) });
          return res.json();
        },
        { node: NODE_FOR_GATE }
      );
      assert.strictEqual(asked.ok, true, 'the proposal minted a gate on the browser session: ' + J(asked));
      await go(page, '/');
      await page.waitForSelector('.work-panel .ab-label', { timeout: 30000 });
      const label = await page.textContent('.work-panel .ab-label');
      assert.strictEqual(label, 'Review the next decision');
      assert.ok((await page.textContent('.work-panel .ab-consequence')).includes('Nothing is saved until you approve.'));
      const panel = (await page.textContent('.work-panel')).replace(/\s+/g, ' ');
      assert.ok(panel.includes('Next decision') && !panel.includes('No decision is waiting for you.'), panel);
      assert.strictEqual(await page.$$eval('#view .ab[data-variant="primary"]', (e) => e.length), 1, 'one primary action');
      assert.strictEqual(await page.$$eval('#view .sm-tri', (e) => e.length), 1, 'one ochre triangle');
      assert.strictEqual(await page.$$eval('#view [data-mark="circle"]', (e) => e.length), 1, 'one cobalt circle');
      // The decisions tab says so in words.
      assert.ok((await page.textContent('nav')).includes('Decisions (1 waiting)'));
      await shot('work-decision-waiting');
    });

    await arm('3 leave, a write lands, come back: "Since you were here" lists the new item with its tile and written status', async () => {
      await waitCurrent(page);
      await sleep(900); // the person looks at Work for a moment
      // Leaving Work writes the last-visit marker (the page hides); give the local write a moment to land.
      await go(page, '/evidence');
      await sleep(600);
      await writeClaim(roomV, 'Interview excerpt, site visit two', 'new1', daemon.env);
      await go(page, '/');
      await waitWork(page, 'changes');
      const rows = page.locator('.work-since .item-row');
      await rows.first().waitFor({ timeout: 20000 });
      const first = rows.first();
      assert.ok((await first.textContent()).includes('Interview excerpt, site visit two'), 'the new claim is the newest row');
      assert.strictEqual(await first.locator('[data-tile]').getAttribute('data-tile'), 'blue');
      assert.strictEqual((await first.locator('.tile-status').textContent()).trim(), 'PROPOSED');
      assert.ok((await rows.count()) <= 5, 'at most five rows');
      const text = await viewText();
      assert.ok(text.includes('Since you were here'));
      assert.ok(!text.includes('What the room holds now'));
      assert.strictEqual(await page.locator('.work-since .legend').count(), 1, 'the legend sits under the list');
      await shot('work-since');
    });

    await arm('4 revisit with no change: "Nothing changed since your last visit on {date}."', async () => {
      await waitCurrent(page);
      await sleep(900);
      await go(page, '/evidence');
      await sleep(600);
      await go(page, '/');
      await waitWork(page, 'nothing-changed');
      const text = await viewText();
      assert.ok(/Nothing changed since your last visit on \d{1,2} [A-Z][a-z]{2} \d{4}\./.test(text), text.slice(0, 400));
    });

    await arm('5 Evidence: the contradiction row says "Contradicts"; an item opens a read-only document', async () => {
      await go(page, '/evidence');
      await page.waitForSelector('.ev-list .item-row', { timeout: 30000 });
      assert.deepStrictEqual(await h1s(page), ['Evidence']);
      const rowText = (await page.locator('.ev-list').innerText()).replace(/\s+/g, ' ');
      assert.ok(rowText.includes('Contradicts'), 'a row says what it contradicts');
      assert.ok((await page.locator('.ev-list [data-tile="yellow"]').count()) >= 2, 'both ends of the pair carry the yellow tile');
      assert.ok(rowText.includes('CONTRADICTION'), 'with its written status');
      assert.ok((await page.locator('.ev-list .legend').count()) === 1, 'the legend');
      // Open the item that has a source document.
      await page.locator('.ev-list .item-row-title', { hasText: 'Demand assumption' }).click();
      await page.waitForSelector('.reader h2', { timeout: 20000 });
      await page.waitForSelector('.doc-display .bn-editor', { timeout: 30000 });
      await page.waitForFunction(() => { const el = document.querySelector('.doc-display'); return !!el && el.textContent.includes('Interview notes'); }, null, { timeout: 30000 });
      const doc = (await page.locator('.doc-display').innerText()).replace(/\s+/g, ' ');
      assert.ok(doc.includes('The buyer said the pilot fee is the sticking point.'), doc.slice(0, 300));
      assert.ok(doc.includes('Budget is set in January'));
      assert.ok(!doc.includes('section: evidence'), 'front matter is not shown as text');
      assert.strictEqual(await page.$$eval('[contenteditable="true"]', (els) => els.length), 0, 'no element is editable');
      assert.strictEqual(await page.$$eval('.bn-editor[contenteditable="false"]', (els) => els.length), 1, 'the editor is explicitly read only');
      for (const sel of ['.bn-formatting-toolbar', '.bn-side-menu', '.bn-suggestion-menu', '.bn-link-toolbar', '.bn-file-panel']) {
        assert.strictEqual(await page.$$eval(sel, (els) => els.length), 0, sel + ' is absent');
      }
      assert.strictEqual(await page.$$eval('.doc-display script', (els) => els.length), 0, 'room content never becomes a script element');
      assert.strictEqual(await page.evaluate(() => window.__xss === undefined), true, 'room content ran no script');
      styledAfterDoc = await page.$$eval('[style]', (els) => els.map((e) => e.tagName + '.' + e.className + ' style=' + e.getAttribute('style')));
      // The reader's provenance and links.
      const reader = (await page.locator('.reader').innerText()).replace(/\s+/g, ' ');
      assert.ok(reader.includes(ITEM_DOC), 'the provenance names the file');
      assert.ok(reader.includes('Linked to') && reader.includes('CONTRADICTS'), reader.slice(0, 400));
      // A key press in the document changes nothing.
      await page.locator('.doc-display .bn-editor').click();
      await page.keyboard.type('zzz');
      assert.ok(!(await page.locator('.doc-display').innerText()).includes('zzz'), 'typing into the document changes nothing');
      // No request left the page to save it.
      assert.ok(!egress.urls().some((u) => /\/api\/(save|raw)\b/.test(u)), 'no save route');
      await shot('evidence-document');
    });

    await arm('6 Decisions: three H2 groups in order, and "Confirmed by you," on the settled row', async () => {
      await go(page, '/decisions');
      await page.waitForSelector('.ev-list h2', { timeout: 30000 });
      await page.waitForSelector('[data-group="settled"] .item-row', { timeout: 30000 });
      assert.deepStrictEqual(await h1s(page), ['Decisions']);
      const groups = await page.$$eval('.ev-list h2', (els) => els.map((e) => e.textContent));
      assert.deepStrictEqual(groups, ['Waiting for you', 'Proposed', 'Settled']);
      const waiting = await page.locator('[data-group="waiting"] .item-row').first();
      assert.ok((await waiting.textContent()).includes('WAITING FOR YOU'));
      assert.ok((await waiting.locator('a').first().getAttribute('href')).startsWith('/gate/'), 'a waiting row opens the gate view');
      const settled = (await page.locator('[data-group="settled"]').innerText()).replace(/\s+/g, ' ');
      assert.ok(settled.includes('Confirmed by you,'), settled);
      await shot('decisions');
      assert.ok(settled.includes('Pricing claim'), 'the confirmed claim is settled');
      assert.ok(settled.includes('Run the pilot at the lower fee'), 'the recorded decision is settled');
      const proposed = (await page.locator('[data-group="proposed"]').innerText()).replace(/\s+/g, ' ');
      assert.ok(proposed.includes('PROPOSED'));
      // Opening a settled row shows it in the reader.
      await page.locator('[data-group="settled"] .item-row-title', { hasText: 'Pricing claim' }).click();
      await page.waitForSelector('.reader h2', { timeout: 10000 });
      assert.ok((await page.textContent('.reader h2')).includes('Pricing claim'));
    });

    await arm('7 Deliverables: a document opens through the display, and there is no publish, export or download control', async () => {
      await go(page, '/deliverables');
      await page.waitForSelector('.ev-list .item-row', { timeout: 30000 });
      assert.deepStrictEqual(await h1s(page), ['Deliverables']);
      const row = (await page.locator('.ev-list .item-row').first().innerText()).replace(/\s+/g, ' ');
      assert.ok(row.includes('DELIVERED'), row);
      await page.locator('.ev-list .item-row-title', { hasText: 'Pilot plan' }).click();
      await page.waitForFunction(() => { const el = document.querySelector('.doc-display'); return !!el && el.textContent.includes('Three steps to a result'); }, null, { timeout: 30000 });
      assert.strictEqual(await page.$$eval('[contenteditable="true"]', (els) => els.length), 0);
      await shot('deliverable-document');
      const controls = await page.$$eval('#view button, #view a, #view [role="button"]', (els) => els.map((e) => (e.textContent || '').trim()));
      assert.ok(!controls.some((t) => /publish|export|download|share/i.test(t)), 'no publish, export or download control: ' + controls.join(' | '));
    });

    await arm('8 Graph is text only, with the typed-links caption', async () => {
      await go(page, '/graph?item=' + encodeURIComponent(ids.a));
      await page.waitForSelector('[data-graph="item"] .linked-row', { timeout: 30000 });
      assert.deepStrictEqual(await h1s(page), ['Graph']);
      const text = await viewText();
      assert.ok(text.includes("Relations shown here are only as complete as the room's typed links."), text.slice(0, 300));
      assert.strictEqual(await page.$$eval('#view canvas, #view svg, #view img', (els) => els.length), 0, 'no canvas, diagram or image');
      assert.ok(text.includes('CONTRADICTS'), 'the relation type is written');
      assert.ok(text.includes('Interview excerpt: the buyer refuses a pilot fee'), 'the other end is named');
      // Without a selection the view lists the items that have typed links.
      await go(page, '/graph');
      await page.waitForSelector('[data-graph="choose"] .linked-row', { timeout: 30000 });
      await shot('graph');
    });

    await arm('9 every view: exactly one h1, focus on it after a load, no tile without its words', async () => {
      for (const p of ['/', '/evidence', '/decisions', '/deliverables', '/graph']) {
        await go(page, p);
        await page.waitForFunction(() => document.activeElement && document.activeElement.tagName === 'H1', null, { timeout: 15000 });
        assert.strictEqual((await h1s(page)).length, 1, p + ' has one h1');
        const bare = await page.$$eval('[data-tile]', (els) => els.filter((e) => !(e.querySelector('.tile-status') || {}).textContent || !(e.querySelector('.tile-status').textContent.trim())).length);
        assert.strictEqual(bare, 0, p + ' has no tile without words');
      }
    });

    await arm('10 at 390 px: no horizontal scroll, the Next decision panel sits above "Since you were here"', async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      try {
        await go(page, '/');
        await page.waitForSelector('.work-since', { timeout: 30000 });
        await page.waitForSelector('.work-panel .ab', { timeout: 30000 });
        const order = await page.evaluate(() => {
          const panel = document.querySelector('.work-panel').getBoundingClientRect().top;
          const since = document.querySelector('.work-since').getBoundingClientRect().top;
          const question = document.querySelector('.work-question').getBoundingClientRect().top;
          return { panel, since, question };
        });
        assert.ok(order.question < order.panel && order.panel < order.since, 'question, then the panel, then Since you were here: ' + J(order));
        await shot('phone-work');
        for (const url of ['/', '/evidence', '/decisions', '/deliverables', '/graph']) {
          await go(page, url);
          await sleep(300);
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
          assert.ok(overflow <= 0, url + ' scrolls sideways by ' + overflow + ' px at 390 px');
        }
        // An open document too.
        await go(page, '/evidence');
        await page.locator('.ev-list .item-row-title', { hasText: 'Demand assumption' }).click();
        await page.waitForFunction(() => { const el = document.querySelector('.doc-display'); return !!el && el.textContent.includes('Interview notes'); }, null, { timeout: 30000 });
        assert.ok((await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0, 'an open document does not scroll the page sideways');
        assert.strictEqual(await page.locator('.ev-list').isVisible(), false, 'on a phone the reader replaces the list');
        await shot('phone-evidence-document');
        await page.getByText('Back to evidence').click();
        await page.waitForSelector('.ev-list .item-row', { timeout: 10000 });
      } finally {
        await page.setViewportSize({ width: 1280, height: 800 });
      }
    });

    await arm('11 a room that has no question: the empty-state H1 and its body', async () => {
      await openRoom(page, 'room-q');
      await page.waitForSelector('#view h1[data-question="empty"]', { timeout: 30000 });
      assert.deepStrictEqual(await h1s(page), ['This room has no question written yet.']);
      assert.ok((await viewText()).includes('Ask Larry in Claude Code to state what this room is trying to resolve.'));
      await openRoom(page, 'room-v');
    });

    await arm('12 egress: only 127.0.0.1, no iframe, no unexpected console or page error, no CSP violation', async () => {
      pw.assertOnlyLoopback(egress);
      assert.strictEqual(await page.$$eval('iframe', (els) => els.length), 0, 'no iframe in the page');
      assert.deepStrictEqual(cspEvents, [], 'no Content-Security-Policy violation event: ' + J(cspEvents.slice(0, 3)) + ' ' + cspViolations.length + ' of them; elements with a style attribute after a document opened: ' + J(styledAfterDoc).slice(0, 600));
      const bad = consoleErrors.concat(pageErrors).filter((m) => !/Failed to load resource|net::ERR|ERR_CONNECTION|the server responded with a status|EventSource|aborted/i.test(m));
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
