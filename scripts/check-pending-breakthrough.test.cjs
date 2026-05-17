'use strict';

/*
 * Phase 120-02 Wave 2 Task 3 -- session-start hook tests.
 *
 * Coverage:
 *   10. no-active-room branch -- emits continue:true
 *   11. empty-state branch -- D-16 silence
 *   12. happy-path -- F.7 surfaced via additionalContext
 *   13. graceful degradation -- corrupt room never blocks session
 *   14. hooks.json wiring -- entry ordering invariant
 */

const test = require('node:test');
const { strict: assert } = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const HOOK_SCRIPT = path.join(REPO_ROOT, 'scripts', 'check-pending-breakthrough.cjs');
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const { openRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));

function makeTmpRoomsHome(prefix) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(home, '.rooms'), { recursive: true });
  return home;
}

function writeRegistry(roomsHome, slug) {
  fs.writeFileSync(
    path.join(roomsHome, '.rooms', 'registry.json'),
    JSON.stringify({ active: slug, rooms: [{ slug: slug }] })
  );
}

function makeRoom(roomsHome, slug) {
  const dir = path.join(roomsHome, slug);
  fs.mkdirSync(path.join(dir, '.mindrian'), { recursive: true });
  return dir;
}

function seedArtifact(db, id) {
  const nowMs = Date.now();
  db.prepare(
    "INSERT INTO nodes (id, type, properties, source_path, created_by, review_status, created_at, last_seen_at) " +
    "VALUES (?, 'artifact', '{}', 'test', 'system', 'confirmed', ?, ?)"
  ).run(id, nowMs, nowMs);
}

function writeWhitespaceGap(roomDir, artifacts, theme, differential) {
  const target = path.join(roomDir, '.mindrian', 'whitespace-results.json');
  let payload = { gaps: [] };
  if (fs.existsSync(target)) {
    try { payload = JSON.parse(fs.readFileSync(target, 'utf8')); } catch (_e) {}
    if (!Array.isArray(payload.gaps)) payload.gaps = [];
  }
  payload.gaps.push({
    theme: theme,
    artifacts: artifacts,
    differential: differential,
    sections: ['s1', 's2'],
    detected_at: Date.now(),
  });
  fs.writeFileSync(target, JSON.stringify(payload));
}

function runHook(roomsHome) {
  const env = Object.assign({}, process.env, {
    MINDRIAN_ROOMS_HOME: roomsHome || '',
  });
  return spawnSync('node', [HOOK_SCRIPT], { env: env, encoding: 'utf8', timeout: 6000 });
}

test('120-02 Task 3 Test 10: hook no-active-room branch emits continue:true', () => {
  const home = makeTmpRoomsHome('p120-02-hook-t10-');
  // No registry written -> no active room.
  const result = runHook(home);
  assert.equal(result.status, 0);
  const parsed = JSON.parse((result.stdout || '').trim() || '{}');
  assert.equal(parsed.continue, true);
  assert.equal(parsed.hookSpecificOutput, undefined,
    'no additionalContext on no-active-room branch');
});

test('120-02 Task 3 Test 11: hook empty-state branch (D-16 silence) emits continue:true', () => {
  const home = makeTmpRoomsHome('p120-02-hook-t11-');
  const slug = 'empty-room';
  makeRoom(home, slug);
  writeRegistry(home, slug);
  // No math files seeded; nothing to detect.
  const result = runHook(home);
  assert.equal(result.status, 0);
  const parsed = JSON.parse((result.stdout || '').trim() || '{}');
  assert.equal(parsed.continue, true);
  assert.equal(parsed.hookSpecificOutput, undefined,
    'D-16 silence: no additionalContext on empty-state branch');
});

test('120-02 Task 3 Test 12: hook happy-path F.7 surfaced via additionalContext', () => {
  const home = makeTmpRoomsHome('p120-02-hook-t12-');
  const slug = 'happy-room';
  const roomDir = makeRoom(home, slug);
  writeRegistry(home, slug);
  // Seed artifacts via the openRoomDb chokepoint so the FK targets exist.
  const db = openRoomDb(roomDir);
  seedArtifact(db, 'a1'); seedArtifact(db, 'a2'); seedArtifact(db, 'a3'); seedArtifact(db, 'a4');
  db.close();
  writeWhitespaceGap(roomDir, ['a1', 'a2', 'a3', 'a4'], 'happy-theme', 0.7);

  const result = runHook(home);
  assert.equal(result.status, 0, 'hook exited 0; stderr=' + (result.stderr || ''));
  const parsed = JSON.parse((result.stdout || '').trim() || '{}');
  assert.equal(parsed.continue, true);
  assert.ok(parsed.hookSpecificOutput, 'happy-path emits hookSpecificOutput');
  assert.equal(parsed.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.equal(typeof parsed.hookSpecificOutput.additionalContext, 'string');
  // The additionalContext is stringified JSON of the F.7 envelope.
  const ctx = JSON.parse(parsed.hookSpecificOutput.additionalContext);
  assert.equal(ctx.shape, 'F.7');
  assert.ok(ctx.breakthrough);
  assert.equal(ctx.breakthrough.kind, 'convergence');

  // breakthrough_surfaced memory_event landed in the room.
  const db2 = openRoomDb(roomDir);
  const events = navigation.findRecentChanges(db2, 0, { eventType: 'breakthrough_surfaced', limit: 10 });
  assert.ok(events.length >= 1, 'breakthrough_surfaced event must land');
  db2.close();
});

test('120-02 Task 3 Test 13: hook graceful degradation -- corrupt room never blocks session', () => {
  const home = makeTmpRoomsHome('p120-02-hook-t13-');
  const slug = 'corrupt-room';
  const roomDir = makeRoom(home, slug);
  writeRegistry(home, slug);
  // Write a malformed whitespace-results.json (the detector should swallow this
  // and the hook should still emit continue:true).
  fs.writeFileSync(path.join(roomDir, '.mindrian', 'whitespace-results.json'),
    'this is not JSON');
  const result = runHook(home);
  assert.equal(result.status, 0, 'hook exits 0 even on corrupt input');
  const parsed = JSON.parse((result.stdout || '').trim() || '{}');
  assert.equal(parsed.continue, true);
});

test('120-02 Task 3 Test 14: hooks.json wiring -- SessionStart array contains check-pending-breakthrough', () => {
  const hooksPath = path.join(REPO_ROOT, 'hooks', 'hooks.json');
  const raw = fs.readFileSync(hooksPath, 'utf8');
  const hooks = JSON.parse(raw);
  const sessionStart = (hooks && hooks.hooks && hooks.hooks.SessionStart) || [];
  // Flatten the matcher -> hooks[] nested shape to a list of command strings.
  const commands = [];
  for (const entry of sessionStart) {
    if (entry && Array.isArray(entry.hooks)) {
      for (const h of entry.hooks) {
        if (h && typeof h.command === 'string') commands.push(h.command);
      }
    }
  }
  const breakthroughIdx = commands.findIndex(function (c) {
    return c.indexOf('check-pending-breakthrough') !== -1;
  });
  assert.ok(breakthroughIdx >= 0, 'check-pending-breakthrough must be wired into SessionStart');
});
