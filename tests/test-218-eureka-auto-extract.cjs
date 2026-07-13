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

    console.log('test-218-eureka-auto-extract: ' + passed + '/5 legs PASSED');
  } finally {
    try { fs.rmSync(roomDir, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
}

main().then(function () {
  process.exit(0);
}).catch(function (err) {
  console.error('test-218-eureka-auto-extract FAILED:', err && err.message ? err.message : err);
  process.exit(1);
});
