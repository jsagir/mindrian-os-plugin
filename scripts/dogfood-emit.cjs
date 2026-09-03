#!/usr/bin/env node
'use strict';
// Phase 260517-dcw Task 2: dog-food bridge -- emit phase.
//
// Drains ~/.mindrian/dogfood-queue.jsonl into ~/MindrianRooms/mindrian/room.db
// via the Phase 109 navigation chokepoint (lib/core/navigation.cjs).
//
// Canon Part 9 D-05 invariant: ALL memory_event writes go through navigation.cjs::logMemoryEvent.
// Canon Part 8 invariant: ZERO remote calls; ZERO network surface; LOCAL only.
// Canon Part 6: the plugin's own development becomes graph data in its own venture room.
//
// Modes:
//   node scripts/dogfood-emit.cjs            -- live drain (truncates queue on success)
//   node scripts/dogfood-emit.cjs --dry-run  -- prints {would_emit, parse_errors}; writes nothing

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const PLUGIN_ROOT = path.resolve(__dirname, '..');
const navigation = require(path.join(PLUGIN_ROOT, 'lib/core/navigation.cjs'));

const QUEUE_FILE = path.join(os.homedir(), '.mindrian', 'dogfood-queue.jsonl');
const ROOM_DIR = process.env.MINDRIAN_DOGFOOD_ROOM_DIR
  || path.join(os.homedir(), 'MindrianRooms', 'mindrian');
const ROOM_DB = path.join(ROOM_DIR, 'room.db');

const DRY_RUN = process.argv.includes('--dry-run');

function softWarn(msg) { process.stderr.write('dogfood-emit: ' + msg + '\n'); }

function openRoomDb() {
  // Use the same node:sqlite DatabaseSync surface that lib/core/room-db.cjs uses internally.
  // We open the file here, but ALL writes are routed through navigation.cjs::logMemoryEvent;
  // this script never issues a raw INSERT against the nodes table directly. Canon Part 9 D-05.
  let DatabaseSync;
  try { DatabaseSync = require('node:sqlite').DatabaseSync; }
  catch (_) { return null; }
  // Phase 276 C4: busy-timeout option, one line, see lib/core/room-db.cjs:242-251
  // for the full reasoning.
  try { return new DatabaseSync(ROOM_DB, { timeout: 5000 }); } catch (_) { return null; }
}

function atomicTruncate(filePath) {
  const tmp = filePath + '.tmp.' + process.pid + '.' + Date.now();
  fs.writeFileSync(tmp, '', 'utf8');
  fs.renameSync(tmp, filePath);
}

function main() {
  if (!fs.existsSync(QUEUE_FILE)) {
    process.stdout.write(JSON.stringify({
      queued: 0, emitted: 0, drained: false, reason: 'no_queue_file',
    }) + '\n');
    return 0;
  }

  const raw = fs.readFileSync(QUEUE_FILE, 'utf8');
  const lines = raw.split('\n').filter((l) => l.trim().length > 0);
  const parsed = [];
  let parseErrors = 0;
  for (const ln of lines) {
    try { parsed.push(JSON.parse(ln)); }
    catch (_) { parseErrors += 1; }
  }

  if (DRY_RUN) {
    process.stdout.write(JSON.stringify({
      would_emit: parsed.length,
      parse_errors: parseErrors,
      queue_size_bytes: raw.length,
    }) + '\n');
    return 0;
  }

  if (!fs.existsSync(ROOM_DIR) || !fs.existsSync(ROOM_DB)) {
    softWarn('target room not found at ' + ROOM_DIR + ' -- skipping (queue preserved)');
    process.stdout.write(JSON.stringify({
      queued: parsed.length, emitted: 0, drained: false, reason: 'no_room',
    }) + '\n');
    return 0;
  }

  const db = openRoomDb();
  if (!db) {
    softWarn('could not open room.db -- skipping (queue preserved)');
    process.stdout.write(JSON.stringify({
      queued: parsed.length, emitted: 0, drained: false, reason: 'db_open_failed',
    }) + '\n');
    return 0;
  }

  let emitted = 0;
  for (const evt of parsed) {
    if (typeof evt.path !== 'string') continue;
    const relPath = evt.path.startsWith(PLUGIN_ROOT + path.sep)
      ? evt.path.slice(PLUGIN_ROOT.length + 1)
      : evt.path;
    const res = navigation.logMemoryEvent(db, 'file_changed', {
      tool: typeof evt.tool === 'string' ? evt.tool : 'unknown',
      path: relPath,
      ts: typeof evt.ts === 'string' ? evt.ts : new Date().toISOString(),
      source_path: 'plugin-repo:' + relPath,
      created_by: 'system:dogfood-bridge',
    });
    if (res && res.ok) emitted += 1;
  }

  try { db.close(); } catch (_) { /* best-effort */ }

  // Truncate the queue atomically ONLY if every parsed row was emitted successfully.
  // Parse errors do not block truncation -- malformed rows would just re-fail on next run.
  if (emitted === parsed.length) {
    try { atomicTruncate(QUEUE_FILE); } catch (_) { /* leave queue intact on truncate failure */ }
  }

  process.stdout.write(JSON.stringify({
    queued: parsed.length,
    emitted,
    drained: emitted === parsed.length,
    parse_errors: parseErrors,
  }) + '\n');
  return 0;
}

process.exit(main());
