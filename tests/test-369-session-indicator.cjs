#!/usr/bin/env node
'use strict';

/*
 * tests/test-369-session-indicator.cjs -- Phase 369-24 (CANON369-06): the session indicator against the
 * navigator-signed design note (369-SESSION-INDICATOR-DESIGN.md, D-04, "Q1 A, Q2 B, Q3 B, Q4 A").
 *
 * Arms:
 *   1  the note is signed, and every quoted state word, fix and announcement in its state table is produced
 *      by indicatorModel() for the matching status fixture (healthy, reconnecting, disconnected, catching up,
 *      rebuilding, risk, plus the drafted connection-dropped sentence)
 *   2  INV-SL-1 / INV-SL-4: every non-healthy state returns a non-null adjacent fix; the healthy state returns none
 *   3  INV-SL-2 / INV-SL-5: the healthy state carries no counter beyond the signed change number and announces nothing
 *   4  T-369-24-01: "Connected" needs an acknowledged round trip that is recent; an old or missing lastAckAt never reads Connected
 *   5  T-369-24-03: an answer pending with a lost connection maps to the risk state with its fix
 *   6  announceFor(): once on entering a state, silence for a healthy change number, "Browser copy is current." after a rebuild
 *   7  static: no emoji, no em-dash or en-dash, the interim marker is gone, the model is wired through the status context
 *   8  render (exit 77 without Playwright, a shell build or the root node_modules): a signed-in built shell on a
 *      hermetic daemon shows the healthy words and the change number; killing the daemon shows the reconnecting
 *      words and then the disconnected words, each with its fix; a restart returns to Connected; the live region
 *      said each change once; at 390 px the indicator is inside the Status panel
 *
 * Hermetic: temp HOME, never ~/MindrianRooms. Canon Part 8: loopback only. Hyphens only; the dash guard builds
 * its characters at run time.
 */

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO = path.resolve(__dirname, '..');
// Playwright finds its browsers under the real HOME; keep that path before the hermetic HOME replaces it.
if (!process.env.PLAYWRIGHT_BROWSERS_PATH) process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(os.homedir(), '.cache', 'ms-playwright');
const HERMETIC = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-369-indicator-'));
process.env.HOME = HERMETIC;
process.env.USERPROFILE = HERMETIC;
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;

const pw = require('./e2e-369/lib/pw.cjs');
const D = require('./helpers/mcp-daemon-369.cjs');

const PHASE_DIR = path.join(REPO, '.planning', 'phases', '369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-');
const NOTE = path.join(PHASE_DIR, '369-SESSION-INDICATOR-DESIGN.md');
const SHELL = path.join(REPO, 'ui', 'shell');
const FRAME = path.join(SHELL, 'client', 'frame');
const STANDALONE = path.join(SHELL, '.next', 'standalone');
const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

const results = [];
async function arm(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log('  PASS ' + name);
  } catch (err) {
    results.push({ name, ok: false });
    console.log('  FAIL ' + name);
    console.log('    ' + String((err && err.stack) || err).split('\n').slice(0, 6).join('\n    '));
  }
}

// ---------------------------------------------------------------------------------------------
// The note: the state table's quoted words are the contract
// ---------------------------------------------------------------------------------------------

function quoted(cell) {
  return [...cell.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

function readNote() {
  const text = fs.readFileSync(NOTE, 'utf8');
  const start = text.indexOf('### State table');
  const end = text.indexOf('Notes on the table', start);
  assert.ok(start >= 0 && end > start, 'the note has a state table');
  const rows = text
    .slice(start, end)
    .split('\n')
    .filter((l) => /^\|\s*\d\./.test(l))
    .map((l) => l.split('|').map((c) => c.trim()));
  assert.strictEqual(rows.length, 6, 'six states in the table');
  const byState = {};
  for (const cells of rows) {
    // cells: '', state, words, StateMark, fix, announcement
    byState[cells[1].replace(/^\d\.\s*/, '')] = { words: quoted(cells[2]), fix: quoted(cells[4]), announce: quoted(cells[5]) };
  }
  const dropped = text.match(/"(The connection dropped while a decision is open\. Reconnect now)"/);
  return { text, byState, dropped: dropped ? dropped[1] : null };
}

async function loadModel() {
  return import(pathToFileURL(path.join(FRAME, 'indicator-model.ts')).href);
}

const NOW = 1_800_000_000_000;
const base = { connection: 'connected', lastAckAt: NOW - 1000, readAt: NOW, copyState: 'current', copySeq: 42, waitingCount: 0, answerPending: false };

async function modelArms() {
  const m = await loadModel();
  const note = readNote();
  const S = note.byState;
  const fixtures = {
    Healthy: { ...base },
    Reconnecting: { ...base, connection: 'reconnecting' },
    Disconnected: { ...base, connection: 'disconnected' },
    'Catching up': { ...base, copyState: 'catching up' },
    Rebuilding: { ...base, copyState: 'rebuilding' },
    Risk: { ...base, connection: 'disconnected', answerPending: true },
  };

  await arm('1 the note is signed and every quoted state word, fix and announcement is produced by the model', async () => {
    assert.ok(/^Signed: navigator via AskUserQuestion, \d{4}-\d{2}-\d{2}/m.test(note.text), 'the note carries a Signed line');
    for (const [state, fixture] of Object.entries(fixtures)) {
      const row = S[state];
      assert.ok(row, 'the note has a row for ' + state);
      const model = m.indicatorModel(fixture);
      const first = row.words[0].replace('{n}', '42');
      assert.strictEqual(model.words, first, state + ' words');
      console.log('    PASS state word "' + model.words + '" (' + state + ')');
      if (state === 'Healthy') {
        assert.strictEqual(model.copyLine, row.words[1].replace('{n}', '42'), 'healthy copy line');
        console.log('    PASS state word "' + model.copyLine + '" (Healthy)');
        assert.strictEqual(model.fix, null);
      } else {
        assert.strictEqual(model.fix && model.fix.label, row.fix[0], state + ' fix: ' + JSON.stringify(row.fix));
        console.log('    PASS fix "' + model.fix.label + '" (' + state + ')');
      }
      if (state !== 'Healthy' && state !== 'Risk') assert.strictEqual(model.announce, row.announce[0], state + ' announcement');
    }
    // The risk row's announcement is "the sentence" itself.
    assert.strictEqual(m.indicatorModel(fixtures.Risk).announce, S.Risk.words[0]);
    // Rebuilding's second announcement comes from announceFor when the rebuild ends.
    assert.strictEqual(m.announceFor(m.indicatorModel(fixtures.Rebuilding), m.indicatorModel(fixtures.Healthy)), S.Rebuilding.announce[1]);
    // The drafted second risk sentence is quoted in the notes and produced when a decision is open and the link dropped.
    assert.ok(note.dropped, 'the note quotes the second risk sentence');
    const dropped = m.indicatorModel({ ...base, connection: 'disconnected', waitingCount: 2 });
    assert.strictEqual(dropped.words, note.dropped);
    assert.strictEqual(dropped.kind, 'risk');
    assert.strictEqual(dropped.fix.label, 'Reconnect now');
    console.log('    PASS state word "' + dropped.words + '" (Risk, connection dropped)');
    assert.strictEqual(m.catchingUpWords(7), 'Catching up, change 7');
  });

  await arm('2 INV-SL-1 and INV-SL-4: every non-healthy state has an adjacent one-click fix', async () => {
    for (const [state, fixture] of Object.entries(fixtures)) {
      const model = m.indicatorModel(fixture);
      if (state === 'Healthy') assert.strictEqual(model.fix, null, 'healthy needs no fix');
      else assert.ok(model.fix && model.fix.label && model.fix.action, state + ' returns a fix');
    }
    assert.ok(m.indicatorModel({ ...base, connection: 'connected', lastAckAt: null }).fix, 'no acknowledgement yet: fix present');
  });

  await arm('3 INV-SL-2 and INV-SL-5: the healthy state is static words, the signed change number only, no announcement', async () => {
    const h = m.indicatorModel(base);
    assert.strictEqual(h.kind, 'healthy');
    assert.strictEqual(h.announce, null);
    assert.strictEqual(m.announceFor(null, h), null, 'a healthy first answer is silent');
    assert.strictEqual(m.announceFor(h, m.indicatorModel({ ...base, copySeq: 43 })), null, 'a healthy change number is never announced');
    assert.deepStrictEqual(Object.keys(h).sort(), ['announce', 'copyLine', 'fix', 'kind', 'mark', 'words']);
    assert.strictEqual(h.words, 'Connected');
    assert.strictEqual(h.copyLine, 'Browser copy: up to change 42');
    // No copy yet: nothing to count, so the line is not drawn.
    assert.strictEqual(m.indicatorModel({ ...base, copyState: 'none', copySeq: null }).copyLine, null);
    // The waiting-decisions count never enters the indicator while healthy (it stays in the Decisions tab).
    assert.strictEqual(JSON.stringify(m.indicatorModel({ ...base, waitingCount: 5 })), JSON.stringify(h));
  });

  await arm('4 T-369-24-01: Connected only after a recent acknowledged round trip', async () => {
    assert.strictEqual(m.indicatorModel({ ...base, lastAckAt: NOW - m.ACK_FRESH_MS - 1 }).words, 'Reconnecting...');
    assert.strictEqual(m.indicatorModel({ ...base, lastAckAt: NOW - 3600000 }).words, 'Reconnecting...');
    assert.strictEqual(m.indicatorModel({ ...base, lastAckAt: null }).words, 'Reconnecting...');
    assert.notStrictEqual(m.indicatorModel({ ...base, lastAckAt: NOW - m.ACK_FRESH_MS }).words, 'Reconnecting...');
    // A server that says "connected" while its acknowledgement is old is never shown as Connected, whatever else is true.
    for (const copyState of ['none', 'current', 'catching up', 'rebuilding']) {
      assert.notStrictEqual(m.indicatorModel({ ...base, lastAckAt: null, copyState }).words, 'Connected');
    }
  });

  await arm('5 T-369-24-03: an answer pending with a lost connection is the risk state with its fix', async () => {
    for (const connection of ['reconnecting', 'disconnected']) {
      const model = m.indicatorModel({ ...base, connection, answerPending: true });
      assert.strictEqual(model.kind, 'risk');
      assert.strictEqual(model.words, 'Your answer is not confirmed yet. Check now');
      assert.strictEqual(model.fix.action, 'check-now');
      assert.strictEqual(model.mark, 'square');
    }
    assert.strictEqual(m.indicatorModel({ ...base, answerPending: true }).kind, 'healthy', 'a live connection is not a risk');
  });

  await arm('6 announceFor: once on entering a state, "Browser copy is current." after a rebuild', async () => {
    const healthy = m.indicatorModel(base);
    const rec = m.indicatorModel({ ...base, connection: 'reconnecting' });
    assert.strictEqual(m.announceFor(healthy, rec), 'Reconnecting to the room.');
    assert.strictEqual(m.announceFor(rec, m.indicatorModel({ ...base, connection: 'reconnecting', lastAckAt: null })), null, 'the same state is not announced twice');
    assert.strictEqual(m.announceFor(rec, m.indicatorModel({ ...base, connection: 'disconnected' })), 'Disconnected from the room.');
    assert.strictEqual(m.announceFor(rec, healthy), null, 'returning to healthy is silent');
  });
}

function staticArm() {
  return arm('7 static: no emoji, no em-dash or en-dash, the interim marker is gone, the model is wired', async () => {
    const files = ['indicator-model.ts', 'status-context.ts', 'SessionIndicator.tsx', 'StatusPanel.tsx', 'ShellFrame.tsx', 'Banners.tsx'].map((f) => path.join(FRAME, f));
    for (const f of files) {
      const text = fs.readFileSync(f, 'utf8');
      assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(text), 'no emoji in ' + path.basename(f));
      assert.ok(!text.includes(EM) && !text.includes(EN), 'no em-dash or en-dash in ' + path.basename(f));
    }
    const indicator = fs.readFileSync(path.join(FRAME, 'SessionIndicator.tsx'), 'utf8');
    assert.strictEqual((indicator.match(/INTERIM\(plan 24\)/g) || []).length, 0, 'plan 20 interim marker removed');
    assert.ok(!indicator.includes('CONNECTION_WORDS'), 'the interim body (a bare connection word) was replaced, not wrapped');
    assert.ok(indicator.includes('indicatorModel(') && indicator.includes('StateMark'), 'the component draws the model through StateMark');
    const frame = fs.readFileSync(path.join(FRAME, 'ShellFrame.tsx'), 'utf8');
    assert.ok(frame.includes('<StatusProvider>'), 'the frame provides the status context');
    assert.ok(!/indexedDB/.test(frame + indicator), 'plan 19 scan: no indexedDB in shell source');
    const panel = fs.readFileSync(path.join(FRAME, 'StatusPanel.tsx'), 'utf8');
    assert.ok(panel.includes('placement="panel"'), 'the Status panel carries the phone placement');
    assert.ok(!/setInterval\([^)]*Date\.now\(\)/.test(indicator), 'no vanity timers in the indicator');
  });
}

// ---------------------------------------------------------------------------------------------
// The render arm
// ---------------------------------------------------------------------------------------------

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

function startForwarder(getTarget) {
  const sockets = new Set();
  const server = net.createServer((client) => {
    const upstream = net.connect(getTarget(), '127.0.0.1');
    sockets.add(client);
    sockets.add(upstream);
    const drop = () => {
      client.destroy();
      upstream.destroy();
      sockets.delete(client);
      sockets.delete(upstream);
    };
    client.on('error', drop);
    upstream.on('error', drop);
    client.on('close', drop);
    upstream.on('close', drop);
    client.pipe(upstream);
    upstream.pipe(client);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({
        port: server.address().port,
        dropAll() {
          for (const s of sockets) s.destroy();
          sockets.clear();
        },
        close() {
          for (const s of sockets) s.destroy();
          server.close();
        },
      });
    });
  });
}

const GAP = (msg) => {
  console.log('  SKIPPED (ENV GAP) render arm: ' + msg);
  return false;
};

async function renderArm() {
  if (!pw.resolvePlaywright()) return GAP('Playwright is not installed');
  if (!fs.existsSync(path.join(STANDALONE, 'server.js'))) return GAP('the shell is not built (cd ui/shell && npm run build)');
  const rootNm = path.join(REPO, 'node_modules');
  if (!fs.existsSync(path.join(rootNm, 'next', 'package.json')) || !fs.existsSync(path.join(rootNm, 'react-dom', 'package.json'))) return GAP('the root node_modules does not carry next and react-dom');
  let launched;
  try {
    launched = await pw.launch();
  } catch (e) {
    return GAP('Chromium could not launch: ' + String(e.message || e).split('\n')[0]);
  }
  const { browser } = launched;

  const plugin = path.join(HERMETIC, 'plugin');
  fs.mkdirSync(path.join(plugin, 'lib', 'ui-shell'), { recursive: true });
  fs.symlinkSync(rootNm, path.join(plugin, 'node_modules'), 'dir');
  const dist = path.join(plugin, 'lib', 'ui-shell', 'dist');
  fs.cpSync(STANDALONE, dist, { recursive: true });

  let daemon;
  try {
    daemon = await D.startDaemon({ rooms: [{ slug: 'room-i', variant: 'wide', migrate: true }] });
  } catch (err) {
    await browser.close();
    return GAP('the hermetic daemon could not start (' + String(err && err.message).slice(0, 200) + ')');
  }
  const forwarder = await startForwarder(() => daemon.port);
  const shellPort = await freePort();
  const code = crypto.randomBytes(32).toString('base64url');
  const tokenFile = path.join(HERMETIC, 'ctl', 'control.token');
  const env = Object.assign({}, process.env, {
    HOME: HERMETIC, USERPROFILE: HERMETIC, MINDRIAN_ROOMS_HOME: path.join(HERMETIC, 'rooms'),
    MOS_DAEMON_URL: 'http://127.0.0.1:' + forwarder.port, MOS_SHELL_PORT: String(shellPort),
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

  const HEADER = '.shell-header .session-indicator';
  const stateOf = (p) => p.evaluate((sel) => { const el = document.querySelector(sel); return el ? el.getAttribute('data-state') : null; }, HEADER);
  const wordsOf = (p) => p.evaluate((sel) => { const el = document.querySelector(sel + ' .si-words'); return el ? el.textContent : null; }, HEADER);
  const fixOf = (p) => p.evaluate((sel) => { const el = document.querySelector(sel + ' .si-fix'); return el ? el.textContent : null; }, HEADER);
  const liveOf = (p) => p.evaluate(() => Array.from(document.querySelectorAll('[role="status"]')).map((e) => e.textContent));

  console.log('  render arm: real browser, built shell, hermetic daemon');
  try {
    await waitUntil(async () => fs.existsSync(tokenFile) && (await httpStatus(shellPort, '/auth/bootstrap', { 'sec-fetch-site': 'none' })) > 0, 30000, 'the shell to answer', 100);
    await page.goto(origin + '/auth/bootstrap?code=' + encodeURIComponent(code));
    await page.waitForSelector('header.shell-header', { timeout: 30000 });
    await page.goto(origin + '/');
    const row = page.locator('.room-list-row', { hasText: 'room-i' });
    await row.waitFor({ timeout: 20000 });
    await row.getByText('Open this room').click();
    await page.waitForFunction(() => document.querySelector('.rs-name') && document.querySelector('.rs-name').textContent === 'room-i', null, { timeout: 20000 });

    // Record every state and every live-region message from here on.
    await page.evaluate((sel) => {
      const states = [];
      const live = [];
      const read = () => {
        const el = document.querySelector(sel);
        const s = el ? el.getAttribute('data-state') : null;
        if (s && states[states.length - 1] !== s) states.push(s);
        const l = Array.from(document.querySelectorAll('[role="status"]')).map((e) => e.textContent)[0];
        if (l && live[live.length - 1] !== l) live.push(l);
      };
      window.__states = states;
      window.__live = live;
      new MutationObserver(read).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
      read();
    }, HEADER);

    await arm('8a healthy: "Connected" and the change number, no fix, one live region, nothing announced', async () => {
      await waitUntil(async () => (await stateOf(page)) === 'healthy' && (await wordsOf(page)) === 'Connected', 30000, 'the healthy indicator');
      const line = await waitUntil(async () => {
        const t = await page.evaluate((sel) => { const el = document.querySelector(sel + ' [data-line="copy"]'); return el ? el.textContent : null; }, HEADER);
        return t && /^Browser copy: up to change \d+$/.test(t) ? t : false;
      }, 30000, 'the browser copy line');
      console.log('    ' + line);
      assert.strictEqual(await fixOf(page), null, 'a healthy indicator has no fix');
      assert.strictEqual((await liveOf(page)).length, 1, 'one role=status region');
      // The first read of the room is a real catching-up state and is announced once; once healthy, nothing more is said.
      const spoken = (await page.evaluate(() => window.__live)).length;
      await sleep(5000);
      assert.strictEqual((await page.evaluate(() => window.__live)).length, spoken, 'nothing announced while healthy (a healthy change number is never announced)');
      assert.deepStrictEqual((await page.evaluate(() => window.__live)).filter((t) => /Reconnecting|Disconnected|Rebuilding/.test(t)), []);
      // The header indicator is not a link and holds no control but a fix.
      assert.strictEqual(await page.locator(HEADER + ' a, ' + HEADER + ' button').count(), 0);
    });

    await arm('8b killing the daemon: "Reconnecting..." then "Disconnected", each with "Reconnect now"', async () => {
      daemon.child.kill('SIGKILL');
      await waitUntil(async () => (await wordsOf(page)) === 'Reconnecting...', 30000, 'the reconnecting words', 25);
      assert.strictEqual(await fixOf(page), 'Reconnect now');
      assert.strictEqual(await stateOf(page), 'reconnecting');
      await waitUntil(async () => (await wordsOf(page)) === 'Disconnected', 60000, 'the disconnected words', 50);
      assert.strictEqual(await fixOf(page), 'Reconnect now');
      assert.strictEqual(await stateOf(page), 'disconnected');
      assert.ok(await page.locator('[data-banner="connection-lost"]').count(), 'the connection-lost banner is shown too');
      assert.strictEqual(await page.locator(HEADER + ' [data-line="copy"]').count(), 0, 'the copy line is replaced while not healthy');
    });

    await arm('8c restarting the daemon returns to "Connected"; the live region said each change once', async () => {
      try {
        daemon = await D.restartDaemon(daemon);
      } catch (err) {
        console.log('    respawn retry after: ' + String(err && err.message).slice(0, 120));
        daemon = await D.restartDaemon(daemon);
      }
      forwarder.dropAll();
      await page.locator(HEADER + ' .text-action').click();
      await waitUntil(async () => (await wordsOf(page)) === 'Connected', 60000, 'Connected again', 50);
      const states = await page.evaluate(() => window.__states);
      assert.ok(states.includes('reconnecting') && states.includes('disconnected'), 'states seen: ' + states.join(' > '));
      assert.ok(states.indexOf('reconnecting') < states.indexOf('disconnected'), 'reconnecting came first: ' + states.join(' > '));
      const live = await page.evaluate(() => window.__live);
      const allowed = ['Reconnecting to the room.', 'Disconnected from the room.', 'Catching up with the room.', 'Rebuilding the browser copy.', 'Browser copy is current.'];
      for (let i = 0; i < live.length; i += 1) {
        assert.ok(allowed.includes(live[i]) || /^The room was tidied/.test(live[i]), 'a live message outside the signed set: ' + live[i]);
        if (i > 0) assert.notStrictEqual(live[i], live[i - 1], 'a message announced twice in a row: ' + live[i]);
      }
      assert.ok(live.includes('Disconnected from the room.'), 'disconnect announced: ' + live.join(' | '));
      assert.strictEqual(live.filter((t) => t === 'Disconnected from the room.').length, 1, 'disconnect announced exactly once');
      assert.strictEqual(live.filter((t) => t === 'Reconnecting to the room.').length <= 1, true, 'reconnecting announced at most once');
      console.log('    states: ' + states.join(' > '));
      console.log('    live: ' + live.join(' | '));
    });

    await arm('8d phone (390 px): the indicator lives in the Status panel, not the header', async () => {
      await page.setViewportSize({ width: 390, height: 800 });
      await waitUntil(async () => !(await page.locator(HEADER).isVisible()), 5000, 'the header indicator to hide');
      await page.click('#status-trigger');
      await page.waitForSelector('#status-panel[data-open="true"]');
      const inPanel = page.locator('#status-panel .session-indicator');
      assert.ok(await inPanel.isVisible(), 'the indicator is visible inside the Status panel');
      assert.strictEqual(await inPanel.locator('.si-words').textContent(), 'Connected');
      assert.strictEqual(await page.locator('.shell-header .session-indicator').isVisible(), false);
      assert.strictEqual((await liveOf(page)).length, 1, 'still one role=status region');
    });
  } catch (err) {
    results.push({ name: 'render setup', ok: false });
    console.log('  FAIL render setup');
    console.log('    ' + String((err && err.stack) || err).split('\n').slice(0, 6).join('\n    '));
    console.log('    shell log tail: ' + shellLog.slice(-400));
  } finally {
    try { await browser.close(); } catch (_e) { /* done */ }
    try { shell.kill('SIGKILL'); } catch (_e) { /* done */ }
    forwarder.close();
    try { await D.stopDaemon(daemon); } catch (_e) { /* done */ }
    try { fs.rmSync(HERMETIC, { recursive: true, force: true }); } catch (_e) { /* done */ }
  }
  return true;
}

async function main() {
  console.log('Phase 369-24 session indicator (CANON369-06) against the signed note');
  await modelArms();
  await staticArm();
  const ran = await renderArm();
  const failed = results.filter((r) => !r.ok);
  console.log('\n' + (results.length - failed.length) + '/' + results.length + ' arms passed' + (ran ? '' : ' (render arm skipped)'));
  if (failed.length) process.exit(1);
  if (!ran) process.exit(pw.SKIP_EXIT_CODE);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
