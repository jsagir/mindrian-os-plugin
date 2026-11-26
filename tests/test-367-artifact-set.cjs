#!/usr/bin/env node
'use strict';

/*
 * tests/test-367-artifact-set.cjs -- Phase 367 plan 01 (design 5.1).
 *
 * The one shared artifact set of a room: lib/core/content-artifacts.cjs
 * listContentArtifacts(roomDir) and getArtifactId. The catch-up runner, the
 * derive backfill and the doctor read the same set, so this file pins it.
 *
 * Arms:
 *   W1 rebuild difference: rebuild ids minus walker ids equals the scaffold
 *      file ids plus the ids of the files of a top-level section folder that
 *      holds .room-root; walker ids minus rebuild ids is empty.
 *   W2 collision: the order .md, .docx, .html, .htm picks the winner; every
 *      loser is in collisions with its rel and id.
 *   W3 isFile: a directory named x.md is never listed (flat, nested, root).
 *   W4 order and id: files sorted by rel; id equals getArtifactId; the
 *      lazygraph-ops re-export is the same function object.
 *   W5 sub-rooms: a nested child with .room-root is skipped; a top-level
 *      section folder with .room-root contributes no file.
 *   W6 backfill set: graph-backfill.cjs _artifactsToIndex delegates to
 *      listContentArtifacts (source check); the set holds the root files and
 *      no file of a top-level sub-room.
 *   W7 lazy load: requiring content-artifacts.cjs does not load
 *      scaffold-predicate.cjs; section-registry.cjs is byte-unchanged
 *      against the plan BASE.
 *
 * Canon Part 8: fixture rooms under os.tmpdir() only. No network, no Brain.
 * tests/ is on scripts/check-substrate.cjs ALLOWED_DIRECT_IMPORT, so the
 * direct lazygraph-ops use here is sanctioned.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const CA_PATH = path.join(REPO, 'lib', 'core', 'content-artifacts.cjs');
const LG_PATH = path.join(REPO, 'lib', 'core', 'lazygraph-ops.cjs');
const BACKFILL_PATH = path.join(REPO, 'lib', 'core', 'graph-backfill.cjs');

// The plan BASE (git rev-parse HEAD at the start of plan 367-01 Task 1).
const PLAN_BASE = process.env.MOS_367_01_BASE || 'b0fb5a1abc9753f10bd2b6480ba80901812a85f0';

let passed = 0;
let failed = 0;
const tmpRoots = [];

function ok(name) {
  passed += 1;
  process.stdout.write('  ok ' + name + '\n');
}

function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.stack || err.message || String(err)) + '\n');
}

async function scenario(name, fn) {
  try {
    await fn();
    ok(name);
  } catch (e) {
    fail(name, e);
  }
}

function mkRoom(label) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-367-01-' + label + '-'));
  tmpRoots.push(dir);
  fs.writeFileSync(path.join(dir, '.room-root'), '');
  return dir;
}

function put(root, rel, body) {
  const abs = path.join(root, ...rel.split('/'));
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body == null ? '# ' + rel + '\n\nbody of ' + rel + '\n' : body);
  return abs;
}

function loadCA() {
  return require(CA_PATH);
}

// The W1 fixture room. Returns the room path and the ids the walker must drop.
function buildW1Fixture() {
  const root = mkRoom('w1');
  put(root, 'ROOM.md', '# Room\n');
  put(root, 'root-note.md');
  put(root, 'problem-definition/STATE.md', '# state\n');
  put(root, 'problem-definition/market.md');
  put(root, 'problem-definition/MINTO.md', '# Minto\n');
  put(root, 'problem-definition/deep/deep.md');
  put(root, 'problem-definition/sub/.room-root', '');
  put(root, 'problem-definition/sub/inner.md');
  put(root, 'solution-design/idea.md');
  put(root, 'solution-design/plan.docx', 'docx bytes');
  put(root, 'solution-design/view.html', '<h1>view</h1>');
  put(root, 'subroom-top/.room-root', '');
  put(root, 'subroom-top/child.md');
  put(root, 'subroom-top/nested/n.md');
  return {
    root,
    scaffoldIds: ['problem-definition/MINTO'],
    subRoomIds: ['subroom-top/child', 'subroom-top/nested/n'],
  };
}

async function rebuildArtifactIds(roomDir) {
  const lg = require(LG_PATH);
  const { db } = await lg.openGraph(roomDir);
  try {
    await lg.rebuildGraph(db, roomDir);
    // The Artifact ids rebuild writes: every Artifact node, plus every
    // BELONGS_TO source. A room root file (root-note.md, id 'root-note') is
    // written as an Artifact and then overwritten by the Section upsert of
    // the same id (section = first id segment), so its node reads as type
    // Section; its BELONGS_TO edge keeps the write visible. That retype is a
    // pre-existing rebuild defect (367 deferred-items.md), not part of the set.
    const ids = new Set(db.prepare("SELECT id FROM nodes WHERE type = 'Artifact'").all().map((r) => r.id));
    for (const r of db.prepare("SELECT source FROM edges WHERE type = 'BELONGS_TO'").all()) ids.add(r.source);
    return [...ids];
  } finally {
    await lg.closeGraph(db);
  }
}

function sorted(arr) {
  return arr.slice().sort();
}

async function main() {
  process.stdout.write('test-367-artifact-set (Phase 367 plan 01, design 5.1)\n');

  await scenario('W1 rebuild difference = scaffold + top-level sub-room files', async () => {
    const { listContentArtifacts } = loadCA();
    const fx = buildW1Fixture();
    const copy = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-367-01-w1copy-'));
    tmpRoots.push(copy);
    fs.cpSync(fx.root, copy, { recursive: true });
    const rebuildIds = new Set(await rebuildArtifactIds(copy));
    const walkerIds = new Set(listContentArtifacts(fx.root).files.map((f) => f.id));
    const rebuildMinusWalker = sorted([...rebuildIds].filter((id) => !walkerIds.has(id)));
    const walkerMinusRebuild = sorted([...walkerIds].filter((id) => !rebuildIds.has(id)));
    assert.deepEqual(rebuildMinusWalker, sorted(fx.scaffoldIds.concat(fx.subRoomIds)));
    assert.deepEqual(walkerMinusRebuild, []);
    // The walker holds the real content of every pass.
    for (const id of ['root-note', 'problem-definition/market', 'problem-definition/deep/deep',
      'solution-design/idea', 'solution-design/plan', 'solution-design/view']) {
      assert.ok(walkerIds.has(id), 'walker holds ' + id);
    }
  });

  await scenario('W2 collision order .md, .docx, .html, .htm', async () => {
    const { listContentArtifacts } = loadCA();
    const r1 = mkRoom('w2a');
    put(r1, 'problem-definition/a.md');
    put(r1, 'problem-definition/a.html', '<p>a</p>');
    const out1 = listContentArtifacts(r1);
    assert.deepEqual(out1.files.map((f) => f.rel), ['problem-definition/a.md']);
    assert.deepEqual(out1.collisions, [{ rel: 'problem-definition/a.html', id: 'problem-definition/a' }]);

    const r2 = mkRoom('w2b');
    put(r2, 'problem-definition/note.md');
    put(r2, 'problem-definition/a.htm', '<p>a</p>');
    put(r2, 'problem-definition/a.docx', 'docx bytes');
    const out2 = listContentArtifacts(r2);
    assert.deepEqual(out2.files.map((f) => f.rel), ['problem-definition/a.docx', 'problem-definition/note.md']);
    assert.deepEqual(out2.collisions, [{ rel: 'problem-definition/a.htm', id: 'problem-definition/a' }]);
  });

  await scenario('W3 a directory named x.md is never listed (flat, nested, root)', async () => {
    const { listContentArtifacts } = loadCA();
    const r = mkRoom('w3');
    put(r, 'problem-definition/real.md');
    fs.mkdirSync(path.join(r, 'problem-definition', 'x.md'));
    put(r, 'problem-definition/child/kid.md');
    fs.mkdirSync(path.join(r, 'problem-definition', 'child', 'x.md'));
    fs.mkdirSync(path.join(r, 'x.md'));
    put(r, 'top.md');
    const rels = listContentArtifacts(r).files.map((f) => f.rel);
    assert.deepEqual(rels, ['problem-definition/child/kid.md', 'problem-definition/real.md', 'top.md']);
    for (const rel of rels) assert.ok(!/(^|\/)x\.md$/.test(rel), 'no directory x.md: ' + rel);
  });

  await scenario('W4 order by rel, id = getArtifactId, one shared function object', async () => {
    const ca = loadCA();
    const fx = buildW1Fixture();
    const { files, collisions } = ca.listContentArtifacts(fx.root);
    assert.ok(files.length > 0, 'files listed');
    const rels = files.map((f) => f.rel);
    const plain = rels.slice().sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    assert.deepEqual(rels, plain);
    for (const f of files) {
      assert.equal(f.id, ca.getArtifactId(f.abs, fx.root));
      assert.equal(path.isAbsolute(f.abs), true);
      assert.equal(f.rel, path.relative(fx.root, f.abs).split(path.sep).join('/'));
    }
    assert.deepEqual(collisions, []);
    const lg = require(LG_PATH);
    assert.equal(typeof ca.getArtifactId, 'function');
    assert.equal(lg.getArtifactId, ca.getArtifactId);
  });

  await scenario('W5 sub-rooms: nested .room-root child skipped, top-level sub-room gives no file', async () => {
    const { listContentArtifacts } = loadCA();
    const fx = buildW1Fixture();
    const rels = listContentArtifacts(fx.root).files.map((f) => f.rel);
    assert.ok(!rels.some((r) => r.startsWith('problem-definition/sub/')), 'nested sub-room skipped');
    assert.ok(!rels.some((r) => r.startsWith('subroom-top/')), 'top-level sub-room skipped');
    assert.ok(rels.includes('problem-definition/deep/deep.md'), 'plain nested child kept');
  });

  await scenario('W6 backfill set: _artifactsToIndex delegates to listContentArtifacts', async () => {
    const src = fs.readFileSync(BACKFILL_PATH, 'utf8');
    const start = src.indexOf('function _artifactsToIndex(');
    assert.ok(start >= 0, '_artifactsToIndex exists');
    const end = src.indexOf('\nfunction ', start + 1);
    const body = src.slice(start, end < 0 ? src.length : end);
    assert.ok(body.includes('listContentArtifacts('), 'the body calls listContentArtifacts(');
    assert.ok(!body.includes('readdirSync('), 'the body holds no readdirSync(');
    const { listContentArtifacts } = loadCA();
    const fx = buildW1Fixture();
    const notes = put(fx.root, 'notes.md');
    const set = listContentArtifacts(fx.root).files.map((f) => f.abs);
    assert.ok(set.includes(notes), 'the root file notes.md is in the backfill set');
    const subDir = path.join(fx.root, 'subroom-top') + path.sep;
    assert.ok(!set.some((f) => f.startsWith(subDir)), 'no file of the top-level sub-room');
  });

  await scenario('W7 lazy scaffold load; section-registry.cjs unchanged since BASE', async () => {
    const code = 'require(' + JSON.stringify(CA_PATH) + ');' +
      "process.stdout.write(String(Object.keys(require.cache).some(function (k) { return k.endsWith('scaffold-predicate.cjs'); })));";
    const r = spawnSync(process.execPath, ['-e', code], { encoding: 'utf8' });
    assert.equal(r.status, 0, 'child exits 0: ' + r.stderr);
    assert.equal(r.stdout.trim(), 'false');
    const g = spawnSync('git', ['cat-file', '-e', PLAN_BASE + '^{commit}'], { cwd: REPO });
    if (g.status !== 0) {
      process.stdout.write('    (BASE ' + PLAN_BASE + ' not in this clone; the git diff arm did not run)\n');
      return;
    }
    const d = spawnSync('git', ['diff', '--quiet', PLAN_BASE, '--', 'lib/core/section-registry.cjs'], { cwd: REPO });
    assert.equal(d.status, 0, 'section-registry.cjs differs from BASE');
  });

  for (const d of tmpRoots) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
  }
  process.stdout.write('\n' + passed + ' passed, ' + failed + ' failed\n');
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  process.stdout.write('FATAL ' + (e && e.stack ? e.stack : String(e)) + '\n');
  process.exit(1);
});
