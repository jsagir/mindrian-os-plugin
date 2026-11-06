'use strict';
/*
 * Phase 386 plan 16 (B14): the PostToolUse memory hook must reconcile only the
 * room that owns the written file. Fixture rooms only (Canon Part 8): HOME is
 * a temp directory, rooms are temp directories, the hook runs as a child
 * process. A reconcile is detected by the count of memory_artifact nodes in
 * the active room's room.db (a number, never content). Every arm builds a
 * fresh active room, so one arm cannot hide another.
 *
 *   M1 a write to MINTO.md in room B (not active) leaves room A unchanged.
 *   M2 a write to ROOM.md in an unrelated directory leaves room A unchanged.
 *   M3 a write to MINTO.md inside room A reconciles room A (pin).
 *   M4 a write to notes.md is a no-op (pin).
 *   M5 a symlinked path that resolves inside room A reconciles room A (pin).
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

try { require('node:sqlite'); } catch (_) {
  process.stdout.write('SKIP test-386-memory-artifact-hook-room-scope.cjs (node:sqlite unavailable)\n');
  process.exit(0);
}

const ROOT = path.resolve(__dirname, '..');
const HOOK = path.join(ROOT, 'scripts', 'memory-artifact-graph-hook.cjs');
const { openRoomDb } = require(path.join(ROOT, 'lib', 'core', 'room-db.cjs'));
const { DatabaseSync } = require('node:sqlite');

let failures = 0;
function check(label, cond, detail) {
  if (cond) process.stdout.write('ok - ' + label + '\n');
  else { failures++; process.stdout.write('FAIL - ' + label + (detail ? ' :: ' + detail : '') + '\n'); }
}

const tmpRoots = [];
process.on('exit', () => { for (const r of tmpRoots) { try { fs.rmSync(r, { recursive: true, force: true }); } catch (_) {} } });

function mkRoom(base, name) {
  const d = path.join(base, name);
  fs.mkdirSync(path.join(d, 'sec'), { recursive: true });
  fs.writeFileSync(path.join(d, 'ROOM.md'), '# Room\n', 'utf8');
  fs.writeFileSync(path.join(d, 'notes.md'), '# notes\n', 'utf8');
  fs.writeFileSync(path.join(d, 'sec', 'MINTO.md'),
    '---\nschema_version: "v88"\ngoverning_thought: "fixture thought"\n' +
    'last_generated_at: "2026-01-01T00:00:00Z"\ndecision_log: []\n---\nbody\n', 'utf8');
  const db = openRoomDb(d);
  db.close();
  return d;
}

function fresh() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'b14-386-16-'));
  tmpRoots.push(base);
  const A = mkRoom(base, 'roomA');
  const B = mkRoom(base, 'roomB');
  const other = path.join(base, 'other');
  fs.mkdirSync(other);
  fs.writeFileSync(path.join(other, 'ROOM.md'), '# other\n', 'utf8');
  fs.mkdirSync(path.join(base, 'home'));
  return { base, A, B, other };
}

function nodeCount(roomA) {
  const db = new DatabaseSync(path.join(roomA, '.mindrian', 'room.db'));
  try { return db.prepare("SELECT COUNT(*) AS c FROM nodes WHERE type = 'memory_artifact'").get().c; }
  finally { db.close(); }
}

function runHook(fx, filePath) {
  const before = nodeCount(fx.A);
  const r = spawnSync(process.execPath, ['--no-warnings', HOOK], {
    input: JSON.stringify({ tool_name: 'Write', tool_input: { file_path: filePath } }),
    env: Object.assign({}, process.env, { CLAUDE_ROOM_DIR: fx.A, HOME: path.join(fx.base, 'home') }),
    encoding: 'utf8',
    timeout: 60000,
  });
  return { status: r.status, before, after: nodeCount(fx.A) };
}

{
  const fx = fresh();
  const r = runHook(fx, path.join(fx.B, 'sec', 'MINTO.md'));
  check('M1 a write in another room causes no change in the active room',
    r.status === 0 && r.after === r.before, 'exit=' + r.status + ' before=' + r.before + ' after=' + r.after);
}
{
  const fx = fresh();
  const r = runHook(fx, path.join(fx.other, 'ROOM.md'));
  check('M2 a write in an unrelated directory causes no change in the active room',
    r.status === 0 && r.after === r.before, 'exit=' + r.status + ' before=' + r.before + ' after=' + r.after);
}
{
  const fx = fresh();
  const r = runHook(fx, path.join(fx.A, 'sec', 'MINTO.md'));
  check('M3 a write inside the active room reconciles it', r.status === 0 && r.after > r.before,
    'exit=' + r.status + ' before=' + r.before + ' after=' + r.after);
}
{
  const fx = fresh();
  const r = runHook(fx, path.join(fx.A, 'notes.md'));
  check('M4 a file with another name is a no-op', r.status === 0 && r.after === r.before,
    'exit=' + r.status + ' before=' + r.before + ' after=' + r.after);
}
{
  const fx = fresh();
  const link = path.join(fx.base, 'link');
  let linked = true;
  try { fs.symlinkSync(path.join(fx.A, 'sec'), link, 'dir'); } catch (_) { linked = false; }
  if (!linked) {
    process.stdout.write('ok - M5 skipped (symlinks unavailable on this platform)\n');
  } else {
    const r = runHook(fx, path.join(link, 'MINTO.md'));
    check('M5 a symlinked path that resolves inside the room reconciles it', r.status === 0 && r.after > r.before,
      'exit=' + r.status + ' before=' + r.before + ' after=' + r.after);
  }
}

process.exit(failures === 0 ? 0 : 1);
