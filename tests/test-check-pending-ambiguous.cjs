'use strict';
// Phase 150.8-03 Task 2 (DIKW-06) -- the hermetic-spawn integration test for
// scripts/check-pending-ambiguous.cjs (the SessionStart ambiguous-queue
// resurface hook). Mirrors tests/test-mva-dror-harness.cjs:156-184 (hermetic
// HOME + env-pointed room dir) and check-pending-breakthrough's envelope.
//
// Asserts:
//   1. against a fixture room with queued ambiguous claims, the hook emits a
//      parseable {continue:true, hookSpecificOutput:{...additionalContext}}
//      envelope carrying COUNTS + node ids only (no segment prose, Part 8) and a
//      mandatory Dismiss verb.
//   2. against an EMPTY queue, the hook emits {continue:true} (D-16 silence) exit 0.
//   3. the additionalContext carries NO transcript prose (Part 8): the queued
//      claim text never appears in the stdout.
//   4. the throttle bumps surfacing_count; >= 3 flips disambiguation to
//      'dismissed' so the same node never re-surfaces forever.
//
// SKIP 77 on a no-sqlite box. NO em-dashes. NO emoji.

const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const HOOK_PATH = path.join(REPO_ROOT, 'scripts', 'check-pending-ambiguous.cjs');
const HOOK_BUDGET_MS = 8000;

let DatabaseSync;
try {
  ({ DatabaseSync } = require('node:sqlite'));
} catch (_e) {
  console.log('SKIP: node:sqlite unavailable (exit 77)');
  process.exit(77);
}

const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const roomDb = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));

let pass = 0;
function check(label, fn) {
  fn();
  pass += 1;
  console.log('  ok -', label);
}

console.log('test-check-pending-ambiguous');

// Build a hermetic rooms-home with a single room.db at the CANONICAL path
// (<roomDir>/.mindrian/room.db, exactly where openRoomDb resolves it) by
// projecting claims THROUGH openRoomDb -- the same handle the hook reads.
// Returns { roomsHome, roomDir, dbPath }.
function makeFixtureRoom(withAmbiguous) {
  const roomsHome = fs.mkdtempSync(path.join(os.tmpdir(), 'amb-hook-'));
  const roomDir = path.join(roomsHome, 'amb-room');
  fs.mkdirSync(roomDir, { recursive: true });
  const db = roomDb.openRoomDb(roomDir);
  if (withAmbiguous) {
    navigation.writeClaimNode(db, {
      text: 'SECRETPROSE_they_said_the_deal_closes_Q3',
      knowledge_type: 'assumption',
      sessionId: 'sess-amb',
      sourceSegment: 'seg-amb-1',
      disambiguation: 'ambiguous',
    });
    navigation.writeClaimNode(db, {
      text: 'SECRETPROSE_revenue_was_1p2M',
      knowledge_type: 'fact',
      sessionId: 'sess-clean',
      sourceSegment: 'seg-clean-1',
    });
  }
  try { roomDb.closeRoomDb(db); } catch (_e) {}
  const dbPath = path.join(roomDir, '.mindrian', 'room.db');
  return { roomsHome, roomDir, dbPath };
}

function spawnHook(roomDir) {
  // Point the hook at the fixture room via MINDRIAN_ACTIVE_ROOM_DIR (the test
  // fallback the breakthrough room-resolver honors). Hermetic HOME so no real
  // ~/MindrianRooms is touched. MINDRIAN_ROOMS_HOME unset so registry path is
  // skipped and the env fallback wins.
  const hermeticHome = fs.mkdtempSync(path.join(os.tmpdir(), 'amb-home-'));
  const env = Object.assign({}, process.env, {
    HOME: hermeticHome,
    USERPROFILE: hermeticHome,
    MINDRIAN_ACTIVE_ROOM_DIR: roomDir,
  });
  delete env.MINDRIAN_ROOMS_HOME;
  const r = spawnSync(process.execPath, [HOOK_PATH], {
    env, encoding: 'utf8', timeout: HOOK_BUDGET_MS,
  });
  try { fs.rmSync(hermeticHome, { recursive: true, force: true }); } catch (_e) {}
  return r;
}

function parseEnvelope(stdout) {
  const line = String(stdout || '').trim().split('\n').filter(Boolean).pop() || '';
  return JSON.parse(line);
}

// --- Case 1: queue with ambiguous claims -> populated envelope + Dismiss ---
{
  const fx = makeFixtureRoom(true);
  const r = spawnHook(fx.roomDir);
  check('hook exits 0 on a populated queue', () => {
    assert.equal(r.status, 0, 'stderr=' + (r.stderr || ''));
  });
  let env;
  check('stdout is a parseable envelope', () => {
    env = parseEnvelope(r.stdout);
    assert.equal(env.continue, true);
  });
  check('envelope carries hookSpecificOutput.additionalContext', () => {
    assert.ok(env.hookSpecificOutput, 'expected hookSpecificOutput');
    assert.equal(env.hookSpecificOutput.hookEventName, 'SessionStart');
    assert.equal(typeof env.hookSpecificOutput.additionalContext, 'string');
  });
  check('additionalContext carries a COUNT (ambiguous_count >= 1)', () => {
    const ctx = JSON.parse(env.hookSpecificOutput.additionalContext);
    assert.ok(Number.isInteger(ctx.ambiguous_count), 'ambiguous_count must be an int');
    assert.ok(ctx.ambiguous_count >= 1, 'count must be >= 1');
    assert.ok(Array.isArray(ctx.node_ids), 'node_ids must be an array');
    assert.ok(ctx.node_ids.length >= 1);
  });
  check('a mandatory Dismiss verb is present', () => {
    const raw = JSON.stringify(env);
    assert.ok(/Dismiss/i.test(raw), 'envelope must carry a Dismiss verb');
  });
  check('Part 8: NO transcript prose leaks into stdout (counts + ids only)', () => {
    assert.equal(r.stdout.indexOf('SECRETPROSE'), -1, 'segment prose must never appear in the hook payload');
  });
  try { fs.rmSync(fx.roomsHome, { recursive: true, force: true }); } catch (_e) {}
}

// --- Case 2: empty queue -> {continue:true} D-16 silence ---
{
  const fx = makeFixtureRoom(false);
  const r = spawnHook(fx.roomDir);
  check('hook exits 0 on an empty queue', () => {
    assert.equal(r.status, 0, 'stderr=' + (r.stderr || ''));
  });
  check('empty queue emits {continue:true} with NO additionalContext (D-16 silence)', () => {
    const env = parseEnvelope(r.stdout);
    assert.equal(env.continue, true);
    assert.ok(!env.hookSpecificOutput, 'empty queue must be silent (no additionalContext)');
  });
  try { fs.rmSync(fx.roomsHome, { recursive: true, force: true }); } catch (_e) {}
}

// --- Case 3: throttle: 3 surfaces flip disambiguation 'ambiguous' -> 'dismissed' ---
{
  const fx = makeFixtureRoom(true);
  // Surface 3 times.
  spawnHook(fx.roomDir);
  spawnHook(fx.roomDir);
  spawnHook(fx.roomDir);
  check('after 3 surfaces the ambiguous claim flips to dismissed (no forever re-surface)', () => {
    const db = new DatabaseSync(fx.dbPath);
    const rows = db.prepare(
      "SELECT properties FROM nodes WHERE type='claim'"
    ).all();
    db.close();
    let sawDismissed = false;
    let sawAmbiguousStillProposed = false;
    for (const row of rows) {
      const props = JSON.parse(row.properties);
      if (props.disambiguation === 'dismissed') sawDismissed = true;
      if (props.disambiguation === 'ambiguous') sawAmbiguousStillProposed = true;
    }
    assert.equal(sawDismissed, true, 'the throttled claim must flip to dismissed after 3 surfaces');
    assert.equal(sawAmbiguousStillProposed, false, 'no claim should remain ambiguous after the 3-strikes throttle');
  });
  check('a dismissed claim is no longer in the active queue', () => {
    const db = new DatabaseSync(fx.dbPath);
    const queued = db.prepare(
      "SELECT id FROM nodes WHERE type='claim' " +
      "AND json_extract(properties,'$.disambiguation')='ambiguous' " +
      "AND review_status='proposed'"
    ).all();
    db.close();
    assert.equal(queued.length, 0, 'dismissed claim must not re-surface');
  });
  try { fs.rmSync(fx.roomsHome, { recursive: true, force: true }); } catch (_e) {}
}

console.log('test-check-pending-ambiguous: ' + pass + ' checks passed');
process.exit(0);
