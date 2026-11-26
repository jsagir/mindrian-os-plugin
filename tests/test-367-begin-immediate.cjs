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
  // ROLE_SLOT: Task 2 adds the holder and worker roles.
  process.stderr.write('unknown role ' + role + ' ' + args.join(' ') + '\n');
  process.exit(9);
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

async function groupAc11() {
  // AC11_SLOT: Task 2 adds I1, I2 and I3.
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
