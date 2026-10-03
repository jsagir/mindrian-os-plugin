#!/usr/bin/env node
'use strict';

/*
 * tests/e2e-369/replica.cjs -- Phase 369-23 (RXP369-02, RXP369-03, CM369-02): the browser read copy
 * (deliverable 4) in a real browser, against the built shell and a hermetic daemon.
 *
 * What runs: a hermetic flag-ON daemon with fixture rooms (the room under test seeded with about 400
 * nodes and edges across the five room-backed collections), the built shell (a plugin-like tree that
 * reaches only the root node_modules), a Chromium page signed in with an armed bootstrap code, and one
 * egress capture for the whole run. The daemon sits behind a tiny TCP forwarder so the shell's daemon
 * URL survives the kill-and-restart arm.
 *
 * Arms (each reads the Status panel's data-copy-* attributes; ids are read from the page's own
 * IndexedDB, compared with a read-only look at room.db):
 *   1  cold catch-up: time to current, counts and ids match the room, one pass over six collections
 *   2  live update: one claim from a child process appears with no reload (ms recorded)
 *   3  burst: 200 writes from 10 child processes at once, 0 missing
 *   4  kill and restart the daemon: 6 writes afterwards converge, 0 missing
 *   5  hard deletes: a graph rebuild removes indexer-owned rows, they leave the copy
 *   6  warm reload pulls 0 changes; Rebuild the browser copy reads the room again
 *   7  crash mid-batch: 2,000 writes caught up slowly, reload part-way, converge with 0 missing, no duplicates
 *   8  two tabs: both converge, only one tab pulls (leader election)
 *   9  stale checkpoint after compaction: reset, tidy-up announced, last-visit marker gone, copy rebuilt
 *  10  UI schema bump: a projection-version-0 database is removed, the current one exists
 *  11  browser data outliving a removed room: a stored copy of a gone room is removed; the open room
 *      removed shows "This room is no longer on this machine." and its data is gone
 *  12  egress: only 127.0.0.1, no iframe, no unexpected console or page error
 *
 * Counters (CM369-02, counts and milliseconds only, SEED-074) go to output/replica-metrics.json:
 *   catch_up_ms, live_update_ms, burst_catch_up_ms, lost_writes, restart_converge_ms, restart_missing
 *
 * Exit 77 only when Playwright, Chromium, the shell build or the root node_modules are absent; never to
 * hide a failing arm. Hermetic: temp HOME, never ~/MindrianRooms. Canon Part 8: loopback only.
 * Canon Part 9: tests/ is allow-listed for raw SQL; the seed and the child writes go through the write
 * door (insertNode, writeEdge). Hyphens only; the dash guard builds its characters at run time.
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
const HERMETIC = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-369-replica-'));
process.env.HOME = HERMETIC;
process.env.USERPROFILE = HERMETIC;
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;

const pw = require('./lib/pw.cjs');
const D = require('../helpers/mcp-daemon-369.cjs');
const { DatabaseSync } = require('node:sqlite');
const { openRoomDb, closeRoomDb } = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
const { insertNode } = require(path.join(REPO, 'lib', 'core', 'node-insert.cjs'));
const navigation = require(path.join(REPO, 'lib', 'core', 'navigation.cjs'));

const SHELL = path.join(REPO, 'ui', 'shell');
const STANDALONE = path.join(SHELL, '.next', 'standalone');
const OUTPUT = path.join(__dirname, 'output');
const SEP = String.fromCharCode(31);
const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);
const GAP = (msg) => {
  console.log('SKIPPED (ENV GAP): ' + msg);
  process.exit(pw.SKIP_EXIT_CODE);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const J = JSON.stringify;
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

// ---------------------------------------------------------------------------------------------
// Small helpers
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

// A TCP forwarder in front of the daemon: the shell's daemon URL is fixed at start, the daemon's port
// changes on restart. Connections to a dead daemon are reset, which is what the shell must survive.
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

// ---------------------------------------------------------------------------------------------
// Child writers: every write goes through the write door in its own process, as a hook would
// ---------------------------------------------------------------------------------------------

const PRELUDE =
  'const { openRoomDb, closeRoomDb } = require(' + J(path.join(REPO, 'lib', 'core', 'room-db.cjs')) + ');' +
  'const { insertNode } = require(' + J(path.join(REPO, 'lib', 'core', 'node-insert.cjs')) + ');' +
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

// Write `n` claims, one commit each, and report the ids and the commit time of the last one.
function writeClaims(roomDir, prefix, n, env, oneTransaction) {
  return runChild(
    'const db = openRoomDb(' + J(roomDir) + ');' +
      'const ids = [];' +
      'try {' +
      (oneTransaction ? "db.exec('BEGIN IMMEDIATE');" : '') +
      'for (let i = 0; i < ' + n + '; i += 1) { const id = ' + J('claim:' + prefix + '-') + ' + i;' +
      "insertNode(db, id, 'claim', JSON.stringify({ text: 'e2e write ' + id }), { epistemic_type: 'observation' }); ids.push(id); }" +
      (oneTransaction ? "db.exec('COMMIT');" : '') +
      '} finally { closeRoomDb(db); }' +
      'console.log(JSON.stringify({ ids, committed_at: Date.now() }));',
    env
  );
}

// ---------------------------------------------------------------------------------------------
// The truth: a read-only look at room.db, partitioned the way the projection partitions it
// ---------------------------------------------------------------------------------------------

function truth(roomDir) {
  const db = new DatabaseSync(path.join(roomDir, '.mindrian', 'room.db'), { readOnly: true });
  try {
    const out = { nodes: new Set(), relations: new Set(), artifacts: new Set(), decisions: new Set(), activity: new Set() };
    for (const r of db.prepare('SELECT id, type FROM nodes').all()) out[navigation.collectionForNodeType(r.type, r.id)].add(String(r.id));
    for (const r of db.prepare('SELECT source, type, target FROM edges').all()) out.relations.add(String(r.source) + SEP + String(r.type) + SEP + String(r.target));
    return out;
  } finally {
    db.close();
  }
}

const total = (t) => Object.values(t).reduce((n, s) => n + s.size, 0);

// ---------------------------------------------------------------------------------------------
// The page: reads the Status panel's attributes and the page's own IndexedDB
// ---------------------------------------------------------------------------------------------

const ROW = '[data-row="browser-copy"]';

async function copyRow(page) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    return { state: el.getAttribute('data-copy-state'), seq: el.getAttribute('data-copy-seq'), count: Number(el.getAttribute('data-copy-count')) };
  }, ROW);
}

async function waitCurrent(page, expectedCount, ms) {
  return waitUntil(async () => {
    const r = await copyRow(page);
    return r && r.state === 'current' && (expectedCount === undefined || r.count === expectedCount) ? r : false;
  }, ms || 30000, 'the browser copy to be current' + (expectedCount === undefined ? '' : ' with ' + expectedCount + ' items'), 25);
}

// Every stored document id of one collection of a room, read straight from IndexedDB (deleted rows skipped).
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

async function allStoredIds(page, roomSlug) {
  const out = {};
  for (const c of ['nodes', 'relations', 'artifacts', 'decisions', 'activity']) out[c] = await storedIds(page, roomSlug, c);
  return out;
}

function diff(expectedSet, actualList) {
  const have = new Set(actualList || []);
  const missing = [...expectedSet].filter((id) => !have.has(id));
  const extra = [...have].filter((id) => !expectedSet.has(id));
  return { missing, extra, duplicates: (actualList || []).length - have.size };
}

async function assertMatches(page, roomSlug, roomDir, label) {
  const t = truth(roomDir);
  const got = await allStoredIds(page, roomSlug);
  for (const c of Object.keys(t)) {
    const d = diff(t[c], got[c]);
    assert.ok(d.missing.length === 0, label + ': ' + c + ' missing ' + d.missing.length + ' (' + d.missing.slice(0, 3).join(', ') + ')');
    assert.ok(d.extra.length === 0, label + ': ' + c + ' has ' + d.extra.length + ' ids the room does not (' + d.extra.slice(0, 3).join(', ') + ')');
    assert.ok(d.duplicates === 0, label + ': ' + c + ' has duplicate ids');
  }
  return t;
}

// ---------------------------------------------------------------------------------------------
// Seed: about 400 nodes and edges across the five room-backed collections, through the write door
// ---------------------------------------------------------------------------------------------

function seedRoom(roomDir) {
  const db = openRoomDb(roomDir);
  const claimIds = [];
  try {
    db.exec('BEGIN IMMEDIATE');
    for (let i = 0; i < 260; i += 1) {
      const id = 'claim:seed-' + i;
      insertNode(db, id, 'claim', J({ text: 'Seed claim ' + i, title: 'Seed claim ' + i }), { epistemic_type: 'observation' });
      claimIds.push(id);
    }
    for (let i = 0; i < 2; i += 1) insertNode(db, 'section:seed-' + i, 'Section', J({ title: 'Section ' + i }), { epistemic_type: 'observation' });
    for (let i = 0; i < 6; i += 1) {
      insertNode(db, 'artifact:seed-' + i, 'Artifact', J({ title: 'Artifact ' + i, section: 'section-' + (i % 2), file: 'seed/a' + i + '.md' }), { epistemic_type: 'observation' });
    }
    for (let i = 0; i < 4; i += 1) {
      insertNode(db, 'decision:seed-' + i, 'decision', J({ title: 'Decision ' + i, gate_id: 'gate-' + i }), { epistemic_type: 'decision' });
    }
    for (let i = 0; i < 6; i += 1) {
      insertNode(db, 'memory_event:seed-' + i, 'memory_event', J({ event_type: 'seeded', target_node_id: claimIds[i] }), { epistemic_type: 'observation' });
    }
    db.exec('COMMIT');
    for (let i = 0; i < 140; i += 1) {
      const res = navigation.writeEdge(db, { source_id: claimIds[i], target_id: claimIds[i + 1], edge_type: 'INFORMS', properties: { origin: 'e2e-369' } });
      assert.ok(res && res.ok === true, 'seed edge ' + i + ': ' + J(res));
    }
    // The indexer writes BELONGS_TO itself (writeEdge refuses it), so the test plants the same rows the indexer would:
    // tests/ is allow-listed for raw SQL (Canon Part 9).
    const planted = db.prepare('INSERT INTO edges (source, target, type) VALUES (?, ?, ?) ON CONFLICT DO NOTHING');
    for (let i = 0; i < 6; i += 1) planted.run('artifact:seed-' + i, 'section:seed-' + (i % 2), 'BELONGS_TO');
  } finally {
    closeRoomDb(db);
  }
}

// ---------------------------------------------------------------------------------------------
// Arms
// ---------------------------------------------------------------------------------------------

const results = [];
async function arm(name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    results.push({ name, ok: true });
    console.log('  PASS ' + name + ' (' + (Date.now() - t0) + ' ms)');
  } catch (err) {
    results.push({ name, ok: false });
    console.log('  FAIL ' + name);
    console.log('    ' + String((err && err.stack) || err).split('\n').slice(0, 6).join('\n    '));
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

  const metrics = { catch_up_ms: null, live_update_ms: null, burst_catch_up_ms: null, lost_writes: null, restart_converge_ms: null, restart_missing: null };

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
        { slug: 'room-r', variant: 'wide', migrate: true },
        { slug: 'room-s', variant: 'wide', migrate: true, seed: [{ kind: 'claim', text: 'A claim in the room that will go away.' }] },
        { slug: 'room-t', variant: 'wide', migrate: true, seed: [{ kind: 'claim', text: 'A claim in the room that is open when it goes away.' }] },
      ],
    });
  } catch (err) {
    GAP('the hermetic daemon could not start (' + String(err && err.message).slice(0, 200) + ')');
  }
  const roomR = daemon.roomDirs['room-r'];
  seedRoom(roomR);

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
  const egress = pw.captureEgress(page);
  const consoleErrors = [];
  const allConsole = [];
  page.on('console', (m) => { allConsole.push(m.type() + ' ' + m.text()); if (m.type() === 'error') consoleErrors.push(m.text()); });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e && e.message || e)));

  // Network gate for the page: 'open' passes everything; 'block' refuses the feed (the browser is cut off
  // while the room changes); 'slow' delays each delta page so a catch-up can be interrupted part-way.
  let gate = 'open';
  let slowMs = 300;
  await page.route('**/api/feed/**', async (route) => {
    if (gate === 'block') return route.abort('connectionrefused');
    if (gate === 'slow' && route.request().url().includes('/api/feed/changes')) await sleep(slowMs);
    return route.continue();
  });
  // Every pull the page makes, with what each answer carried (counts only).
  const pulls = [];
  page.on('response', async (res) => {
    const url = res.url();
    if (!url.includes('/api/feed/changes')) return;
    try {
      const body = await res.json();
      pulls.push({ at: Date.now(), page: 1, rows: (Array.isArray(body.changes) ? body.changes.length : 0) + (Array.isArray(body.docs) ? body.docs.length : 0) });
    } catch (_e) {
      pulls.push({ at: Date.now(), page: 1, rows: -1 });
    }
  });

  const nudge = (p) => (p || page).evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  async function openRoom(p, slug) {
    await p.goto(origin + '/');
    const row = p.locator('.room-list-row', { hasText: slug });
    await row.waitFor({ timeout: 20000 });
    await row.getByText('Open this room').click();
    await p.waitForFunction((s) => document.querySelector('.rs-name') && document.querySelector('.rs-name').textContent === s, slug, { timeout: 20000 });
  }

  console.log('Phase 369-23 browser read copy, real browser');
  try {
    await waitUntil(async () => fs.existsSync(tokenFile) && (await httpStatus(shellPort, '/auth/bootstrap', { 'sec-fetch-site': 'none' })) > 0, 30000, 'the shell to answer', 100);
    await page.goto(origin + '/auth/bootstrap?code=' + encodeURIComponent(code));
    await page.waitForSelector('header.shell-header', { timeout: 30000 });

    let truthNow = null;

    await arm('1 cold catch-up: time to current, counts and ids match the room', async () => {
      const t0 = Date.now();
      await openRoom(page, 'room-r');
      const expected = total(truth(roomR));
      assert.ok(expected >= 380, 'the seeded room holds about 400 items, has ' + expected);
      await waitCurrent(page, expected, 60000);
      metrics.catch_up_ms = Date.now() - t0;
      truthNow = await assertMatches(page, 'room-r', roomR, 'cold catch-up');
      const r = await copyRow(page);
      assert.ok(r.seq !== '' && Number(r.seq) > 0, 'the row says which change it is current through: ' + J(r));
      assert.ok(pulls.some((p) => p.rows > 200) || pulls.length > 6, 'the first read spans more than one 200-row page per collection');
    });

    await arm('2 live update: one claim from a child process appears with no reload, under 1500 ms', async () => {
      const before = (await copyRow(page)).count;
      const res = await writeClaims(roomR, 'live', 1, daemon.env);
      const t = await waitUntil(async () => ((await copyRow(page)).count === before + 1 ? Date.now() : false), 10000, 'the claim to reach the copy', 10);
      metrics.live_update_ms = t - res.committed_at;
      console.log('    live update after commit ms=' + metrics.live_update_ms + ' (spike 006 P2 write-to-render p95 22-29 ms over a direct pull server; this path adds the shell relay hop)');
      assert.ok(metrics.live_update_ms < 1500, 'live update took ' + metrics.live_update_ms + ' ms');
      await waitCurrent(page);
      await assertMatches(page, 'room-r', roomR, 'live update');
    });

    await arm('3 burst: 200 writes from 10 child processes, 0 missing', async () => {
      const before = (await copyRow(page)).count;
      // 10 child processes of 20 commits each, all at once. A child whose write-door open loses a lock race fails
      // loudly and wrote nothing (seen once in 24 runs at 25 children), so it is run again with a fresh prefix:
      // that is the writer's contention limit, not a write the copy could lose.
      const runs = await Promise.all(Array.from({ length: 10 }, (_, i) => writeClaims(roomR, 'burst' + i, 20, daemon.env).catch(() => writeClaims(roomR, 'burst' + i + 'b', 20, daemon.env))));
      const ids = runs.flatMap((r) => r.ids);
      assert.strictEqual(ids.length, 200);
      const doneAt = Date.now();
      await waitUntil(async () => (await copyRow(page)).count >= before + 200, 30000, '200 burst writes in the copy', 25);
      metrics.burst_catch_up_ms = Date.now() - doneAt;
      await waitCurrent(page);
      const got = new Set(await storedIds(page, 'room-r', 'nodes'));
      const missing = ids.filter((id) => !got.has(id));
      metrics.lost_writes = missing.length;
      assert.strictEqual(missing.length, 0, 'lost writes: ' + missing.slice(0, 3).join(', '));
      await assertMatches(page, 'room-r', roomR, 'burst');
    });

    await arm('4 kill and restart the daemon: 6 writes afterwards converge with 0 missing', async () => {
      const before = (await copyRow(page)).count;
      try {
        daemon = await D.restartDaemon(daemon);
      } catch (err) {
        // The harness waits 30 s for the respawned daemon to print its port; one slow respawn in about 25 runs
        // was seen on this machine. The kill and the respawn are what is under test, so try the respawn once more.
        console.log('    respawn retry after: ' + String(err && err.message).slice(0, 120));
        daemon = await D.restartDaemon(daemon);
      }
      forwarder.dropAll();
      const run = await writeClaims(roomR, 'restart', 6, daemon.env);
      const t0 = Date.now();
      await waitUntil(async () => (await copyRow(page)).count >= before + 6, 30000, '6 writes after the restart', 25);
      metrics.restart_converge_ms = Date.now() - t0;
      await waitCurrent(page);
      const got = new Set(await storedIds(page, 'room-r', 'nodes'));
      const missing = run.ids.filter((id) => !got.has(id));
      metrics.restart_missing = missing.length;
      assert.strictEqual(missing.length, 0, 'missing after the restart: ' + missing.join(', '));
      await assertMatches(page, 'room-r', roomR, 'restart');
    });

    await arm('5 hard deletes: a graph rebuild removes indexer-owned rows and they leave the copy', async () => {
      const before = truth(roomR);
      assert.ok(before.artifacts.size >= 6 && before.relations.size > 140);
      await runChild('const db = openRoomDb(' + J(roomR) + '); try { const { rebuildGraph } = require(' + J(path.join(REPO, 'lib', 'core', 'lazygraph-ops.cjs')) + '); await rebuildGraph(db, ' + J(roomR) + '); } finally { closeRoomDb(db); } console.log("{}");', daemon.env);
      const after = truth(roomR);
      assert.ok(after.artifacts.size < before.artifacts.size, 'the rebuild removed the seeded artifacts from the room');
      await waitUntil(async () => (await copyRow(page)).count === total(after), 20000, 'the deletes to reach the copy', 25);
      await waitCurrent(page, total(after));
      await assertMatches(page, 'room-r', roomR, 'hard delete');
    });

    await arm('6 warm reload pulls 0 changes; Rebuild the browser copy reads the room again', async () => {
      const expected = total(truth(roomR));
      // RxDB writes a pull's checkpoint after the documents without waiting for it (replication-protocol
      // downstream: "we do not await checkpoint writes"), so a reload within milliseconds of the last write can
      // re-read that last page. That is at-least-once and idempotent (never a loss); a warm reload is one that
      // comes after the copy has settled, so let the checkpoint land first.
      await sleep(1500);
      const mark = pulls.length;
      await page.reload();
      await page.waitForSelector('header.shell-header');
      await waitCurrent(page, expected, 30000);
      await sleep(600);
      const after = pulls.slice(mark);
      assert.ok(after.length > 0, 'the warm page did ask the feed');
      assert.strictEqual(after.reduce((n, p) => n + Math.max(p.rows, 0), 0), 0, 'a warm reload pulled documents: ' + J(after.map((p) => p.rows)));
      await assertMatches(page, 'room-r', roomR, 'warm reload');

      // The person asks for a rebuild: deletes the copy in this browser and reads again; the room is untouched.
      await page.click('#status-trigger');
      await page.waitForSelector('#status-panel[data-open="true"]');
      assert.ok((await page.textContent('#status-panel')).includes('Deletes the copy in this browser and reads it again from the room. The room is not touched.'));
      const roomBefore = truth(roomR);
      const mark2 = pulls.length;
      await page.getByText('Rebuild the browser copy').click();
      await waitUntil(async () => pulls.length > mark2 && pulls.slice(mark2).some((p) => p.rows > 0), 30000, 'the rebuild to read the room again', 50);
      await waitCurrent(page, expected, 30000);
      await assertMatches(page, 'room-r', roomR, 'rebuild');
      assert.strictEqual(total(truth(roomR)), total(roomBefore), 'the room was not touched');
      await page.keyboard.press('Escape');
    });

    await arm('7 crash mid-batch: 2,000 writes caught up slowly, reload part-way, converge with 0 missing and no duplicates', async () => {
      const before = (await copyRow(page)).count;
      gate = 'block';
      const run = await writeClaims(roomR, 'crash', 2000, daemon.env, true);
      gate = 'slow';
      slowMs = 300;
      await nudge();
      await waitUntil(async () => (await copyRow(page)).count >= before + 150, 30000, 'the catch-up to start', 25);
      const mid = (await copyRow(page)).count;
      assert.ok(mid < before + 2000, 'the reload happens part-way (' + (mid - before) + ' of 2000 in)');
      await page.reload();
      gate = 'open';
      await page.waitForSelector('header.shell-header');
      await waitCurrent(page, before + 2000, 60000);
      const got = await storedIds(page, 'room-r', 'nodes');
      const have = new Set(got);
      assert.strictEqual(got.length, have.size, 'no duplicate ids');
      assert.strictEqual(run.ids.filter((id) => !have.has(id)).length, 0, 'every one of the 2,000 writes is present');
      await assertMatches(page, 'room-r', roomR, 'crash mid-batch');
      console.log('    reloaded with ' + (mid - before) + ' of 2000 caught up');
    });

    await arm('8 two tabs: both converge, only one tab pulls (leader election)', async () => {
      const expected = total(truth(roomR));
      const page2 = await context.newPage();
      const perPage = { 1: 0, 2: 0 };
      let counting = false;
      page.on('request', (r) => { if (counting && r.url().includes('/api/feed/changes')) perPage[1] += 1; });
      page2.on('request', (r) => { if (counting && r.url().includes('/api/feed/changes')) perPage[2] += 1; });
      try {
        await page2.goto(origin + '/');
        await page2.waitForSelector('header.shell-header');
        await waitCurrent(page2, expected, 30000);
        await waitCurrent(page, expected, 30000);
        counting = true;
        await writeClaims(roomR, 'twotabs', 3, daemon.env);
        await waitUntil(async () => (await copyRow(page)).count === expected + 3 && (await copyRow(page2)).count === expected + 3, 20000, 'both tabs to converge', 25);
        await sleep(500);
        counting = false;
        const pullers = [perPage[1], perPage[2]].filter((n) => n > 0).length;
        assert.strictEqual(pullers, 1, 'exactly one tab pulls; requests per tab ' + J(perPage));
        await waitCurrent(page2, expected + 3);
        await assertMatches(page2, 'room-r', roomR, 'second tab');
      } finally {
        await page2.close();
      }
      await waitCurrent(page, expected + 3);
    });

    await arm('9 stale checkpoint after compaction: reset, the tidy-up is announced, the last-visit marker is gone, the copy is rebuilt', async () => {
      // The person was last here at this change number: the page writes it when it hides.
      await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
      const noteKey = async () => page.evaluate(async () => {
        const list = await indexedDB.databases();
        let found = 0;
        for (const d of list) {
          const name = d.name || '';
          if (!name.startsWith('rxdb-dexie-mos-room-r-') || !/local|internal/i.test(name)) continue;
          const idb = await new Promise((resolve, reject) => { const q = indexedDB.open(name); q.onsuccess = () => resolve(q.result); q.onerror = () => reject(q.error); });
          try {
            for (const store of Array.from(idb.objectStoreNames)) {
              const rows = await new Promise((resolve, reject) => { const q = idb.transaction(store, 'readonly').objectStore(store).getAll(); q.onsuccess = () => resolve(q.result); q.onerror = () => reject(q.error); });
              found += rows.filter((r) => JSON.stringify(r).includes('last-visit') && !JSON.stringify(r).includes('"_deleted":true')).length;
            }
          } finally {
            idb.close();
          }
        }
        return found;
      });
      await waitUntil(async () => (await noteKey()) > 0, 10000, 'the last-visit marker to be stored', 100);

      gate = 'block';
      await runChild(
        'const db = openRoomDb(' + J(roomR) + '); try {' +
          "for (let i = 0; i < 12; i += 1) insertNode(db, 'claim:compact-' + i, 'claim', JSON.stringify({ text: 'after the cut-off ' + i }), { epistemic_type: 'observation' });" +
          'const { compactChangeLog } = require(' + J(path.join(REPO, 'lib', 'core', 'navigation', 'room-change-log.cjs')) + ');' +
          'const r = compactChangeLog(db, { keepRows: 3 }); console.log(JSON.stringify(r)); } finally { closeRoomDb(db); }',
        daemon.env
      );
      const marker = pulls.length;
      gate = 'open';
      await nudge();
      await page.waitForFunction(() => Array.from(document.querySelectorAll('[role="status"]')).some((el) => el.textContent.includes('The room was tidied since your last visit, so this browser is reading it again.')), null, { timeout: 30000 });
      const expected = total(truth(roomR));
      await waitCurrent(page, expected, 60000);
      assert.ok(pulls.slice(marker).some((p) => p.rows > 0), 'the copy read the room again');
      await assertMatches(page, 'room-r', roomR, 'compaction reset');
      assert.strictEqual(await noteKey(), 0, 'the rebuilt copy has no last-visit marker (the opening screen falls back to first-visit)');
    });

    await arm('10 UI schema bump: a projection-version-0 database is removed, the current version exists', async () => {
      await page.evaluate(async () => {
        for (const coll of ['nodes', 'room']) {
          await new Promise((resolve, reject) => {
            const q = indexedDB.open('rxdb-dexie-mos-room-r-deadbeef-p0--0--' + coll, 1);
            q.onupgradeneeded = () => q.result.createObjectStore('docs', { keyPath: 'id' });
            q.onsuccess = () => { q.result.close(); resolve(); };
            q.onerror = () => reject(q.error);
          });
        }
      });
      const names = () => page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name || ''));
      assert.ok((await names()).some((n) => n.includes('-p0--')), 'the old-version database was planted');
      await page.reload();
      await page.waitForSelector('header.shell-header');
      await waitCurrent(page, total(truth(roomR)), 30000);
      await waitUntil(async () => !(await names()).some((n) => n.includes('-p0--')), 10000, 'the old-version database to be removed', 100);
      assert.ok((await names()).some((n) => /^rxdb-dexie-mos-room-r-[a-z0-9]+-p1--/.test(n)), 'the current version exists');
    });

    await arm('11 browser data outliving a removed room: a stored copy of a gone room is removed; an open room that goes shows the removed state', async () => {
      // A copy of room-s is stored by opening it once; then the page goes back to room-r.
      await openRoom(page, 'room-s');
      await waitCurrent(page, total(truth(daemon.roomDirs['room-s'])), 30000);
      await openRoom(page, 'room-r');
      await waitCurrent(page, total(truth(roomR)), 30000);
      const stored = (slug) => page.evaluate(async (s) => (await indexedDB.databases()).map((d) => d.name || '').filter((n) => n.startsWith('rxdb-dexie-mos-' + s + '-')).length, slug);
      assert.ok((await stored('room-s')) > 0, 'room-s has a stored copy in this browser; names=' + J(await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name))) + ' row=' + J(await copyRow(page)) + ' errors=' + J(consoleErrors.slice(-6)) + ' console=' + J(allConsole.filter((l) => l.includes('[copy]'))));

      const registryPath = path.join(daemon.roomsHome, '.rooms', 'registry.json');
      const fullRegistry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
      const registryFor = (rooms) => {
        const map = {};
        for (const slug of Object.keys(fullRegistry.rooms)) if (rooms.some((r) => r.slug === slug)) map[slug] = fullRegistry.rooms[slug];
        return JSON.stringify({ active: 'room-r', rooms: map }, null, 2);
      };
      // room_list enumerates the directories under the rooms home, so a room leaves the machine with its whole folder.
      const sDir = path.dirname(daemon.roomDirs['room-s']);
      fs.writeFileSync(registryPath, registryFor([{ slug: 'room-r' }, { slug: 'room-t' }, { slug: 'room-267' }]));
      fs.rmSync(sDir, { recursive: true, force: true });
      await waitUntil(async () => (await stored('room-s')) === 0, 20000, 'the removed room\'s stored copy to be deleted', 100);

      // The open room goes away.
      await openRoom(page, 'room-t');
      await waitCurrent(page, total(truth(daemon.roomDirs['room-t'])), 30000);
      assert.ok((await stored('room-t')) > 0);
      fs.writeFileSync(registryPath, registryFor([{ slug: 'room-r' }, { slug: 'room-267' }]));
      fs.rmSync(path.dirname(daemon.roomDirs['room-t']), { recursive: true, force: true });
      await page.waitForFunction(() => document.body.textContent.includes('This room is no longer on this machine.'), null, { timeout: 20000 });
      await waitUntil(async () => (await stored('room-t')) === 0, 20000, 'the open removed room\'s stored copy to be deleted', 100);
      assert.ok((await page.textContent('main')).includes('Choose another room'), 'the removed state offers the way out');
      assert.strictEqual(await page.$$eval('[role="status"]', (els) => els.length), 1, 'one live region');
    });

    await arm('12 egress: only 127.0.0.1, no iframe, no unexpected console or page error', async () => {
      pw.assertOnlyLoopback(egress);
      assert.strictEqual(await page.$$eval('iframe', (els) => els.length), 0, 'no iframe in the page');
      assert.strictEqual(page.frames().length, 1, 'one frame only');
      assert.ok(!egress.urls().some((u) => /rxdb\.info/.test(u)), 'the RxDB dev-mode frame never loaded');
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
    forwarder.close();
    await D.stopDaemon(daemon);
  }

  fs.mkdirSync(OUTPUT, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT, 'replica-metrics.json'), JSON.stringify(metrics, null, 2) + '\n');
  console.log('  metrics ' + JSON.stringify(metrics));
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
