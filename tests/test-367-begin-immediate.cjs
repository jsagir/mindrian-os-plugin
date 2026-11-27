#!/usr/bin/env node
'use strict';

/*
 * tests/test-367-begin-immediate.cjs -- Phase 367 plan 03.
 *
 * Design 5.1 (the runner batch writer) and design section 2 R9 with AC11
 * (Phase 273 M5): a deferred BEGIN that reads before its first write gets
 * SQLITE_BUSY (5) or SQLITE_BUSY_SNAPSHOT (517) at once under a concurrent
 * writer in WAL mode. BEGIN IMMEDIATE takes the write lock before any read
 * and waits inside the busy timeout.
 *
 * Owner ruling C10 (400.3-CONTEXT.md, 'Owner rulings after the build';
 * 367-OWNER-RULING-C10-SCOPE-2026-11-26.md): BEGIN IMMEDIATE on the lazygraph
 * index path (indexArtifact and rebuildGraph) is plan 400.3-06. This file
 * does not change those sites. Arms I1 and I2 are KNOWN-OPEN until 400.3-06
 * lands and turn into real passes by themselves. Arm I3 is the runner path
 * (navigation.withRoomTx around indexArtifactsBatch) that Phase 367 owns.
 *
 * Usage: node tests/test-367-begin-immediate.cjs [batch|ac11|all]
 * Roles (this file re-invoked through child_process.fork):
 *   --role holder <dbPath> <holdMs>
 *   --role worker <mode> <roomDir> <file>   (mode indexArtifact|rebuildGraph|batch)
 *
 * Canon Part 8: fixture rooms under os.tmpdir() only. No network, no Brain.
 * tests/ is on scripts/check-substrate.cjs ALLOWED_DIRECT_IMPORT.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const LG_PATH = path.join(REPO, 'lib', 'core', 'lazygraph-ops.cjs');
const NAV_PATH = path.join(REPO, 'lib', 'core', 'navigation.cjs');

// ---------------------------------------------------------------- roles

function runRole(role, args) {
  if (role === 'holder') return roleHolder(args[0], Number(args[1]));
  if (role === 'worker') return roleWorker(args[0], args[1], args[2]);
  process.stderr.write('unknown role ' + role + ' ' + args.join(' ') + '\n');
  process.exit(9);
}

// Role holder: BEGIN IMMEDIATE plus one write, hold on its own timer, commit.
// The write goes into the existing nodes table (the room.db the parent made).
// A raw DatabaseSync with timeout 0: the holder is the writer and never waits.
function roleHolder(dbPath, holdMs) {
  const { DatabaseSync } = require('node:sqlite');
  let db;
  try {
    db = new DatabaseSync(dbPath, { timeout: 0 });
    db.exec('BEGIN IMMEDIATE');
    // One write into an existing table (no new schema, Phase 108 D-05); a
    // non-indexer type, so the rebuild wipe (Artifact, Section) leaves it alone.
    db.prepare('INSERT OR REPLACE INTO nodes (id, type, properties) VALUES (?, ?, ?)').run('t367-holder', 'T367Holder', '{}');
  } catch (e) {
    process.send({ held: false, message: String(e && e.message) }, () => process.exit(3));
    return;
  }
  process.send({ held: true });
  setTimeout(() => {
    try { db.exec('COMMIT'); } catch (_e) { /* the parent sees no committed_at */ }
    const committedAt = Date.now();
    try { db.close(); } catch (_e) { /* ignore */ }
    process.send({ committed_at: committedAt }, () => process.exit(0));
  }, Number.isFinite(holdMs) && holdMs > 0 ? holdMs : 1500);
}

// Role worker: one index call on the room while the holder holds the write lock.
async function roleWorker(mode, roomDir, file) {
  const lg = require(LG_PATH);
  let conn = null;
  let startAt = null;
  try {
    ({ conn } = await lg.openGraph(roomDir));
    if (mode === 'indexArtifact') {
      startAt = Date.now();
      await lg.indexArtifact(conn, roomDir, file);
    } else if (mode === 'rebuildGraph') {
      startAt = Date.now();
      await lg.rebuildGraph(conn, roomDir);
    } else if (mode === 'batch') {
      const nav = require(NAV_PATH);
      const content = lg._readArtifactContent(file); // read before the transaction
      startAt = Date.now();
      nav.withRoomTx(conn, () => lg.indexArtifactsBatch(conn, roomDir, [{ abs: file, content }], undefined));
    } else {
      throw new Error('unknown worker mode ' + mode);
    }
    const endAt = Date.now();
    try { await lg.closeGraph(conn); } catch (_e) { /* ignore */ }
    process.send({ ok: true, start_at: startAt, end_at: endAt }, () => process.exit(0));
  } catch (e) {
    if (conn) { try { await lg.closeGraph(conn); } catch (_e) { /* ignore */ } }
    process.send({
      ok: false,
      errcode: e && typeof e.errcode === 'number' ? e.errcode : null,
      message: String(e && e.message).slice(0, 300),
      start_at: startAt,
    }, () => process.exit(2));
  }
}

// ---------------------------------------------------------------- harness

let passed = 0;
let failed = 0;
let knownOpen = 0;
function check(label, cond, detail) {
  if (cond) { passed += 1; console.log('PASS: ' + label); }
  else { failed += 1; console.log('FAIL: ' + label + (detail !== undefined ? ' :: ' + detail : '')); }
}
// KNOWN-OPEN: an owner-accepted open item. Measured and printed every run, never counted as a pass.
function known(label, detail) { knownOpen += 1; console.log('KNOWN-OPEN: ' + label + (detail !== undefined ? ' :: ' + detail : '')); }

const ROOTS = [];
process.on('exit', () => {
  for (const r of ROOTS) { try { fs.rmSync(r, { recursive: true, force: true }); } catch (_e) { /* best effort */ } }
});

function mkRoom(label) {
  const r = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-367-03-' + label + '-'));
  ROOTS.push(r);
  fs.writeFileSync(path.join(r, '.room-root'), '');
  fs.mkdirSync(path.join(r, 'problem-definition'), { recursive: true });
  return r;
}

function put(room, rel, body) {
  const abs = path.join(room, ...rel.split('/'));
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body);
  return abs;
}

function artifactHash(db, id) {
  const row = db.prepare("SELECT json_extract(properties,'$.content_hash') AS h FROM nodes WHERE id = ? AND type = 'Artifact'").get(id);
  return row ? row.h : null;
}

// ---------------------------------------------------------------- group batch

async function groupBatch() {
  const lg = require(LG_PATH);
  const nav = require(NAV_PATH);

  // B1: three items inside withRoomTx; the passed content is indexed, not the file content.
  {
    const room = mkRoom('b1');
    const items = ['one', 'two', 'three'].map((n) => {
      const abs = put(room, 'problem-definition/' + n + '.md', '# disk ' + n + '\n\nbytes on disk\n');
      return { abs, content: '# passed ' + n + '\n\npassed content ' + n + '\n' };
    });
    const { db } = await lg.openGraph(room);
    try {
      const r = nav.withRoomTx(db, () => lg.indexArtifactsBatch(db, room, items, undefined));
      check('B1 indexed holds the 3 abs paths', JSON.stringify(r && r.indexed) === JSON.stringify(items.map((i) => i.abs)), JSON.stringify(r));
      check('B1 failed is []', r && Array.isArray(r.failed) && r.failed.length === 0, JSON.stringify(r && r.failed));
      for (const it of items) {
        const id = lg.getArtifactId(it.abs, room);
        const h = artifactHash(db, id);
        check('B1 ' + id + ' content_hash = computeHash(passed content)', h === lg.computeHash(it.content), h);
        check('B1 ' + id + ' content_hash != hash of the disk bytes', h !== lg.computeHash(fs.readFileSync(it.abs, 'utf8')), h);
      }
    } catch (e) {
      check('B1 batch inside withRoomTx', false, e && e.stack);
    } finally {
      await lg.closeGraph(db);
    }
  }

  // B2: a TEMP trigger fails item 2; its SAVEPOINT rolls back; the transaction commits.
  {
    const room = mkRoom('b2');
    const items = ['good1', 'bad', 'good2'].map((n) => {
      const abs = put(room, 'problem-definition/' + n + '.md', '# ' + n + '\n');
      return { abs, content: '# ' + n + '\n\ncontent ' + n + '\n' };
    });
    const { db } = await lg.openGraph(room);
    try {
      db.exec("CREATE TEMP TRIGGER t367 BEFORE INSERT ON nodes WHEN NEW.id = 'problem-definition/bad' BEGIN SELECT RAISE(ABORT, 'forced'); END");
      const r = nav.withRoomTx(db, () => lg.indexArtifactsBatch(db, room, items, undefined));
      check('B2 two indexed', r && r.indexed.length === 2 && r.indexed[0] === items[0].abs && r.indexed[1] === items[2].abs, JSON.stringify(r));
      check('B2 failed = [{abs: item 2, code: node_write}]', JSON.stringify(r && r.failed) === JSON.stringify([{ abs: items[1].abs, code: 'node_write' }]), JSON.stringify(r && r.failed));
      const bad = db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE id = 'problem-definition/bad'").get().n;
      check('B2 no node of item 2', bad === 0, bad);
      const badEdge = db.prepare("SELECT COUNT(*) AS n FROM edges WHERE source = 'problem-definition/bad'").get().n;
      check('B2 no edge of item 2', badEdge === 0, badEdge);
      check('B2 the transaction committed (items 1 and 3 persist, no open tx)',
        db.isTransaction === false && artifactHash(db, 'problem-definition/good1') !== null && artifactHash(db, 'problem-definition/good2') !== null);
    } catch (e) {
      check('B2 batch with a failing item', false, e && e.stack);
    } finally {
      await lg.closeGraph(db);
    }
  }

  // B3: a transaction-level error (errcode 13 FULL) is thrown, not returned.
  {
    const room = mkRoom('b3');
    const abs = put(room, 'problem-definition/full.md', '# full\n');
    const { db } = await lg.openGraph(room);
    let insertSeen = false;
    const wrapper = new Proxy(db, {
      get(target, prop) {
        if (prop === 'prepare') {
          return (sql) => {
            if (!insertSeen && /^\s*INSERT/i.test(String(sql))) {
              insertSeen = true;
              const e = new Error('database or disk is full');
              e.code = 'ERR_SQLITE_ERROR';
              e.errcode = 13;
              throw e;
            }
            return target.prepare(sql);
          };
        }
        const v = target[prop];
        return typeof v === 'function' ? v.bind(target) : v;
      },
    });
    let thrown = null;
    let returned;
    db.exec('BEGIN IMMEDIATE');
    try {
      returned = lg.indexArtifactsBatch(wrapper, room, [{ abs, content: '# full\n' }], undefined);
    } catch (e) {
      thrown = e;
    } finally {
      try { db.exec('ROLLBACK'); } catch (_e) { /* ignore */ }
    }
    check('B3 the FULL error is thrown', thrown !== null && thrown.errcode === 13, thrown ? thrown.errcode : JSON.stringify(returned));
    check('B3 nothing is returned', returned === undefined);
    check('B3 the wrapper reached an INSERT', insertSeen === true);
    await lg.closeGraph(db);
  }

  // B4: no open transaction -> NO_TX, nothing written.
  {
    const room = mkRoom('b4');
    const abs = put(room, 'problem-definition/loose.md', '# loose\n');
    const { db } = await lg.openGraph(room);
    let thrown = null;
    try {
      lg.indexArtifactsBatch(db, room, [{ abs, content: '# loose\n' }], undefined);
    } catch (e) {
      thrown = e;
    }
    check('B4 NO_TX thrown', thrown !== null && thrown.code === 'NO_TX', thrown ? thrown.code : 'no throw');
    const n = db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type = 'Artifact'").get().n;
    check('B4 nothing written', n === 0, n);
    await lg.closeGraph(db);
  }

  // B5: the exports.
  {
    const keys = Object.keys(lg);
    for (const k of ['computeHash', '_readArtifactContent', 'indexArtifactsBatch', 'getArtifactId']) {
      check('B5 lazygraph-ops exports ' + k, keys.includes(k));
    }
  }
}

// ---------------------------------------------------------------- group ac11

const HOLD_MS = 1500;

// Fork this file in a role. Returns {child, next(pred, timeoutMs), done}.
function forkRole(args) {
  const { fork } = require('node:child_process');
  const child = fork(__filename, ['--role', ...args], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
  const msgs = [];
  const waiters = [];
  let stderr = '';
  child.stderr.on('data', (d) => { stderr += String(d); });
  child.on('message', (m) => {
    msgs.push(m);
    for (const w of waiters.slice()) w();
  });
  const exited = new Promise((resolve) => child.on('exit', (code) => { resolve(code); for (const w of waiters.slice()) w(); }));
  let exitCode;
  exited.then((c) => { exitCode = c; });
  function next(pred, timeoutMs) {
    return new Promise((resolve) => {
      const t = setTimeout(() => { remove(); resolve(null); }, timeoutMs);
      const w = () => {
        const hit = msgs.find(pred);
        if (hit) { clearTimeout(t); remove(); resolve(hit); return; }
        if (exitCode !== undefined) { clearTimeout(t); remove(); resolve(null); }
      };
      function remove() { const i = waiters.indexOf(w); if (i >= 0) waiters.splice(i, 1); }
      waiters.push(w);
      w();
    });
  }
  return { child, next, exited, stderr: () => stderr };
}

async function killAndAwait(h) {
  if (!h) return;
  if (h.child.exitCode === null && h.child.signalCode === null) {
    try { h.child.kill('SIGKILL'); } catch (_e) { /* ignore */ }
  }
  await h.exited;
}

// One AC11 run: a holder holds BEGIN IMMEDIATE for HOLD_MS; the worker runs mode.
async function ac11Run(mode) {
  const lg = require(LG_PATH);
  const room = mkRoom('ac11-' + mode);
  const file = put(room, 'problem-definition/target.md', '# target\n\nAC11 ' + mode + '\n');
  {
    const { db } = await lg.openGraph(room); // room.db with the lazygraph schema before the fork
    await lg.closeGraph(db);
  }
  const dbPath = path.join(room, '.mindrian', 'room.db');
  let holder = null;
  let worker = null;
  try {
    holder = forkRole(['holder', dbPath, String(HOLD_MS)]);
    const held = await holder.next((m) => m && 'held' in m, 10000);
    if (!held || held.held !== true) return { setupError: 'the holder did not hold the lock: ' + JSON.stringify(held) + ' ' + holder.stderr() };
    worker = forkRole(['worker', mode, room, file]);
    const result = await worker.next((m) => m && 'ok' in m, 30000);
    const committed = await holder.next((m) => m && 'committed_at' in m, 10000);
    if (!result) return { setupError: 'the worker sent no result: ' + worker.stderr() };
    let nodeExists = false;
    try {
      const { db } = await lg.openGraph(room);
      nodeExists = db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE id = 'problem-definition/target' AND type = 'Artifact'").get().n === 1;
      await lg.closeGraph(db);
    } catch (_e) { nodeExists = false; }
    return { result, committedAt: committed ? committed.committed_at : null, nodeExists };
  } finally {
    await killAndAwait(worker);
    await killAndAwait(holder);
  }
}

function waitedAndSucceeded(run) {
  const r = run.result;
  return r.ok === true && typeof run.committedAt === 'number' &&
    r.start_at < run.committedAt && run.committedAt <= r.end_at;
}

function describeRun(run) {
  if (run.setupError) return run.setupError;
  const r = run.result;
  return JSON.stringify({ ok: r.ok, errcode: r.errcode, message: r.message, start_at: r.start_at, end_at: r.end_at,
    committed_at: run.committedAt, waited_ms: (r.end_at && r.start_at) ? r.end_at - r.start_at : null });
}

async function groupAc11() {
  // I3: the runner path that Phase 367 owns (withRoomTx BEGIN IMMEDIATE around indexArtifactsBatch).
  {
    const run = await ac11Run('batch');
    console.log('  I3 run: ' + describeRun(run));
    check('I3 batch in withRoomTx waits for the holder and succeeds (R9 closed on the runner path)',
      !run.setupError && waitedAndSucceeded(run), describeRun(run));
    check('I3 the Artifact node exists after the worker ends', !run.setupError && run.nodeExists === true);
  }
  // I1 and I2: the lazygraph index path; BEGIN IMMEDIATE there is plan 400.3-06 (owner ruling C10).
  for (const [label, mode] of [['I1 indexArtifact', 'indexArtifact'], ['I2 rebuildGraph', 'rebuildGraph']]) {
    const run = await ac11Run(mode);
    console.log('  ' + label + ' run: ' + describeRun(run));
    if (run.setupError) { check(label + ' setup', false, run.setupError); continue; }
    if (waitedAndSucceeded(run)) {
      check(label + ' waits for the holder and succeeds', true);
    } else if (run.result.ok === false && typeof run.result.errcode === 'number' && (run.result.errcode & 255) === 5) {
      known(label + ' busy under a concurrent writer', 'errcode ' + run.result.errcode + '; BEGIN IMMEDIATE on the index path is plan 400.3-06 (owner ruling C10)');
    } else {
      check(label + ' waits and succeeds, or fails with errcode & 255 === 5', false, describeRun(run));
    }
  }
}

// ---------------------------------------------------------------- main

async function main() {
  const group = process.argv[2] || 'all';
  console.log('test-367-begin-immediate (Phase 367 plan 03) group ' + group);
  if (group === 'batch' || group === 'all') await groupBatch();
  if (group === 'ac11' || group === 'all') await groupAc11();
  console.log(passed + ' passed, ' + failed + ' failed, ' + knownOpen + ' known-open');
  process.exit(failed > 0 ? 1 : 0);
}

// ---------------------------------------------------------------- dispatch (last: every const above is initialized)

const roleIdx = process.argv.indexOf('--role');
if (roleIdx !== -1) {
  runRole(process.argv[roleIdx + 1], process.argv.slice(roleIdx + 2));
} else {
  main().catch((e) => {
    console.log('FAIL: FATAL :: ' + (e && e.stack ? e.stack : String(e)));
    process.exit(1);
  });
}
