'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 218 (T-218-VD-5, post-live-session follow-on) -- eureka run's
 * freshness-gated entity-extraction pre-step (the 218-CONTEXT.md D-03
 * "deferred, not rejected" idea, built once today's session hit the exact
 * two-step manual-sequencing gap it named).
 *
 * THE CLAIM: `node scripts/eureka-command.cjs ROOM_DIR run` now extracts
 * entities FIRST when the room is stale (never extracted, or has content
 * newer than the last successful extraction), then ranks -- one command,
 * not two. Freshness-gated: a second run with no new content does NOT
 * re-extract. Best-effort: never blocks ranking. --no-extract opts out.
 *
 * NO em-dashes anywhere (CLAUDE.md HARD RULE).
 */

require('./eureka-offline-preload.cjs');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { openRoomDb, closeRoomDb } = require('../lib/core/room-db.cjs');
const { insertNode } = require('../lib/core/node-insert.cjs');
const dispatcher = require('../scripts/eureka-command.cjs');
// The dispatcher holds entity-extract's exports object and calls .main as a
// property lookup at call time, so requiring the SAME module here (Node caches
// by resolved path) and reassigning .main intercepts the pre-step in-process.
const ENTITY_EXTRACT = require('../scripts/entity-extract.cjs');
const realMain = ENTITY_EXTRACT.main;

function mkTempRoom() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-218-autoextract-'));
  fs.mkdirSync(path.join(dir, 'competitive-analysis'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'competitive-analysis', 'landscape.md'),
    '# Landscape\n\nHelix Biosciences rivals Genomix in the gene-therapy market.\n',
    'utf8'
  );
  return dir;
}

function seedAnchor(dir) {
  const db = openRoomDb(dir, { allowExtension: true });
  insertNode(db, 'memory_artifact:competitive-analysis:ROOM', 'memory_artifact', JSON.stringify({
    section: 'competitive-analysis', kind: 'ROOM', path: 'competitive-analysis/ROOM.md', hash: '',
  }), { source_path: 'memory:competitive-analysis:ROOM', created_by: 'system' });
  closeRoomDb(db);
}

function entityExtractStatus(dir) {
  const p = path.join(dir, '.mindrian', 'entity-extract', 'status.json');
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_e) { return null; }
}

function eurekaStatus(dir) {
  const p = path.join(dir, '.mindrian', 'eureka', 'status.json');
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_e) { return null; }
}

function entityCount(dir) {
  const db = openRoomDb(dir, { allowExtension: true });
  const n = db.prepare("SELECT COUNT(*) c FROM nodes WHERE type IN ('company','technology','market')").get().c;
  closeRoomDb(db);
  return n;
}

async function main() {
  let passed = 0;
  const roomDir = mkTempRoom();
  try {
    seedAnchor(roomDir);

    // Leg 1: a never-extracted room -- `eureka run` extracts first, then
    // ranks. Entities from the room's own prose must exist afterward.
    const code1 = await dispatcher.main([roomDir, 'run', '--offline']);
    assert.equal(code1, 0, 'eureka run should exit 0');
    const st1 = entityExtractStatus(roomDir);
    assert.ok(st1 && st1.state === 'done', 'entity-extract status must read done after the first eureka run: ' + JSON.stringify(st1));
    assert.ok(entityCount(roomDir) > 0, 'eureka run on a fresh room must have extracted entities first');
    passed += 1;
    console.log('  leg 1 (fresh room auto-extracts): PASSED, finished_at=' + st1.finished_at);

    // Leg 2: freshness gate holds -- a second run with no new content must
    // NOT re-run extraction (the status.json finished_at must be unchanged).
    const code2 = await dispatcher.main([roomDir, 'run', '--offline']);
    assert.equal(code2, 0, 'second eureka run should exit 0');
    const st2 = entityExtractStatus(roomDir);
    assert.equal(st2.finished_at, st1.finished_at, 'freshness gate must skip re-extraction when nothing changed: ' + JSON.stringify(st2));
    passed += 1;
    console.log('  leg 2 (freshness gate holds, no re-extraction): PASSED');

    // Leg 3: touching a real artifact file (newer mtime) makes the room
    // stale again -- the next run MUST re-extract.
    await new Promise((r) => setTimeout(r, 20));
    const filePath = path.join(roomDir, 'competitive-analysis', 'landscape.md');
    const future = new Date(Date.now() + 5000);
    fs.utimesSync(filePath, future, future);
    const code3 = await dispatcher.main([roomDir, 'run', '--offline']);
    assert.equal(code3, 0, 'third eureka run should exit 0');
    const st3 = entityExtractStatus(roomDir);
    assert.notEqual(st3.finished_at, st2.finished_at, 'a newer artifact mtime must trigger re-extraction: ' + JSON.stringify(st3));
    passed += 1;
    console.log('  leg 3 (stale room re-extracts): PASSED');

    // Isolation reset (load-bearing, not decorative): leg 3 set landscape.md
    // to Date.now()+5000 (a real future mtime, deliberately far ahead to
    // dodge filesystem mtime-resolution flakiness) and that timestamp
    // OUTLIVES leg 3's own run -- it stays newer than whatever finished_at
    // gets stamped moments later. Left alone, that stale-future mtime alone
    // would make leg 3b "pass" even with the ORIGINAL one-level-deep bug
    // (it would still see landscape.md directly under competitive-analysis/
    // and never need to see the nested file at all) -- a false green that
    // proves nothing. Wind it back to a safe past point so the ONLY
    // remaining reason a re-extraction could trigger is the nested artifact
    // leg 3b is actually testing.
    const past = new Date(Date.now() - 60000);
    fs.utimesSync(filePath, past, past);

    // Leg 3b (BUGFIX regression pin, 2026-07-13, live-discovered against a
    // real room, not a fixture): the freshness probe must see an artifact
    // filed under this codebase's OWN standard nested layout --
    // `section/name/name.md`, one folder per artifact (decisions.md #16,
    // every navigation.cjs write incl. ingestUrl lands there) -- not just a
    // flat `section/name.md` file. The original walk went exactly one
    // directory level deep and was structurally blind to this shape, so
    // `eureka run` silently never re-extracted a room's real content. Legs
    // 1-3 above all use a FLAT fixture (`mkTempRoom`'s landscape.md sits
    // directly under competitive-analysis/) and stayed green through that
    // exact bug in production -- this leg is the one that would have
    // caught it, and does now.
    await new Promise((r) => setTimeout(r, 20));
    const nestedDir = path.join(roomDir, 'competitive-analysis', 'nested-finding');
    fs.mkdirSync(nestedDir, { recursive: true });
    fs.writeFileSync(
      path.join(nestedDir, 'nested-finding.md'),
      '# Nested Finding\n\nCryoline Components supplies a cold-chain part Thermex Rivals depends on.\n',
      'utf8'
    );
    const code3b = await dispatcher.main([roomDir, 'run', '--offline']);
    assert.equal(code3b, 0, 'nested-artifact eureka run should exit 0');
    const st3b = entityExtractStatus(roomDir);
    assert.notEqual(st3b.finished_at, st3.finished_at, 'a NEW artifact filed in the standard nested section/name/name.md layout must trip the freshness gate, not just a flat section/name.md file: ' + JSON.stringify(st3b));
    passed += 1;
    console.log('  leg 3b (nested section/name/name.md artifact re-extracts): PASSED');

    // Leg 4: --no-extract opts out even on a stale/never-touched room.
    const roomDir2 = mkTempRoom();
    seedAnchor(roomDir2);
    const code4 = await dispatcher.main([roomDir2, 'run', '--offline', '--no-extract']);
    assert.equal(code4, 0, '--no-extract run should still exit 0 (ranking proceeds)');
    assert.equal(entityExtractStatus(roomDir2), null, '--no-extract must skip the pre-step entirely: no status.json written');
    passed += 1;
    console.log('  leg 4 (--no-extract opts out): PASSED');
    try { fs.rmSync(roomDir2, { recursive: true, force: true }); } catch (_e) { /* best effort */ }

    // ----------------------------------------------------------------------
    // Legs 5-7 (quick-task 260714-jjm): the silent extraction-failure swallow,
    // the fourth confirmed instance of today's silent-skip-false-success
    // pattern. The David-session incident shape is a pre-step failure that
    // leaves exit 0, state done, and ZERO surfaced trace anywhere on the
    // eureka surface. Legs 5 and 6 reproduce that shape (RED against pre-fix
    // HEAD) and pin it fixed; leg 7 is the clean-run control (the field must
    // be absent, never a false positive). maybeExtractFirst calls
    // ENTITY_EXTRACT.main as a property lookup at call time, so reassigning the
    // shared exports .main here intercepts it in-process. Restore realMain
    // before the control leg AND in the outer finally.
    // ----------------------------------------------------------------------

    // Leg 5 (throw path): an extraction that THROWS must surface as an
    // extraction_error field in the eureka status.json plus one stderr line,
    // while ranking still proceeds (degrade-never-throw intact).
    const room5 = mkTempRoom();
    seedAnchor(room5);
    let stderr5 = '';
    const realWrite5 = process.stderr.write.bind(process.stderr);
    ENTITY_EXTRACT.main = async function () { throw new Error('injected extraction failure'); };
    try {
      process.stderr.write = function (chunk) { stderr5 += String(chunk); return true; };
      const code5 = await dispatcher.main([room5, 'run', '--offline']);
      process.stderr.write = realWrite5;
      const est5 = eurekaStatus(room5);
      // A thin single-anchor room may make the runner exit non-zero; the
      // load-bearing assertion is the surfaced extraction_error, not the
      // final state. Accept done OR failed, but require the error present.
      assert.ok(est5 && (est5.state === 'done' || est5.state === 'failed'), 'leg 5: eureka status.json must exist with state done or failed: ' + JSON.stringify(est5));
      assert.ok(est5.extraction_error && est5.extraction_error.indexOf('injected extraction failure') !== -1, 'leg 5: a THROWN extraction failure must surface as extraction_error in the eureka status.json (exit code ' + code5 + '): ' + JSON.stringify(est5));
      assert.ok(stderr5.indexOf('pre-step') !== -1, 'leg 5: the throw must write one stderr line naming the pre-step failure: ' + JSON.stringify(stderr5));
      passed += 1;
      console.log('  leg 5 (thrown extraction surfaces extraction_error + stderr): PASSED');
    } finally {
      process.stderr.write = realWrite5;
      try { fs.rmSync(room5, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
    }

    // Leg 6 (caught exit-1 path, the likelier David mechanism): entity-extract
    // catches its own errors, writes a state failed status.json with the real
    // message, and RETURNS 1 without throwing (entity-extract.cjs cmdRun lines
    // 700-710). maybeExtractFirst must read that diagnostic trail and surface
    // its error field as extraction_error.
    const room6 = mkTempRoom();
    seedAnchor(room6);
    ENTITY_EXTRACT.main = async function (argv) {
      const rd = argv[0];
      const sp = path.join(rd, '.mindrian', 'entity-extract', 'status.json');
      fs.mkdirSync(path.dirname(sp), { recursive: true });
      fs.writeFileSync(sp, JSON.stringify({
        state: 'failed',
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
        pid: process.pid,
        error: 'injected db open failure',
      }) + '\n', 'utf8');
      return 1;
    };
    try {
      const code6 = await dispatcher.main([room6, 'run', '--offline']);
      const est6 = eurekaStatus(room6);
      assert.ok(est6 && (est6.state === 'done' || est6.state === 'failed'), 'leg 6: eureka status.json must exist: ' + JSON.stringify(est6));
      assert.ok(est6.extraction_error && est6.extraction_error.indexOf('injected db open failure') !== -1, 'leg 6: a caught exit-1 extraction must surface entity-extract own status.json error as extraction_error (exit code ' + code6 + '): ' + JSON.stringify(est6));
      passed += 1;
      console.log('  leg 6 (caught exit-1 surfaces entity-extract status error): PASSED');
    } finally {
      try { fs.rmSync(room6, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
    }

    // Restore the REAL main before the control leg.
    ENTITY_EXTRACT.main = realMain;

    // Leg 7 (control): a clean run with the real extractor writes NO
    // extraction_error key at all. The field is additive and absent on
    // success (assert the key is absent, not merely falsy).
    const room7 = mkTempRoom();
    seedAnchor(room7);
    try {
      const code7 = await dispatcher.main([room7, 'run', '--offline']);
      assert.equal(code7, 0, 'leg 7: a clean run should exit 0');
      const est7 = eurekaStatus(room7);
      assert.ok(est7 && est7.state === 'done', 'leg 7: clean run status.json must read done: ' + JSON.stringify(est7));
      assert.ok(!('extraction_error' in est7), 'leg 7: a clean run must NOT write an extraction_error key (absent, not falsy): ' + JSON.stringify(est7));
      passed += 1;
      console.log('  leg 7 (clean run has no extraction_error key): PASSED');
    } finally {
      try { fs.rmSync(room7, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
    }

    console.log('test-218-eureka-auto-extract: ' + passed + '/8 legs PASSED');
  } finally {
    ENTITY_EXTRACT.main = realMain;
    try { fs.rmSync(roomDir, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
}

main().then(function () {
  process.exit(0);
}).catch(function (err) {
  console.error('test-218-eureka-auto-extract FAILED:', err && err.message ? err.message : err);
  process.exit(1);
});
