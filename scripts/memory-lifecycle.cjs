#!/usr/bin/env node
'use strict';

/**
 * memory-lifecycle.cjs (Phase 84-03)
 *
 * Thin CLI that every SessionStart, Stop, PreCompact, PostCompact hook calls
 * into so the memory layer (lib/core/memory-ops.cjs) becomes load-bearing and
 * observable to Claude. Scoped strictly to the currently active room from
 * ~/MindrianRooms/.rooms/registry.json (Phase 83 canonical source).
 *
 * Subcommands:
 *   session-start <roomDir>   Open db, startSession, write pointer, fetch
 *                             history, emit RECENT SESSIONS block on stdout.
 *   stop <roomDir>            Read pointer, addFragment(session-summary),
 *                             endSession, writeVoiceLogStub, delete pointer.
 *   pre-compact <roomDir>     Read pointer, endSession. Pointer kept.
 *   post-compact <roomDir>    startSession new id, overwrite pointer,
 *                             addFragment(role='post-compact') marker.
 *
 * Design notes:
 *   - The "role" values 'session-summary' and 'post-compact' are intentionally
 *     new free-string values on the fragments table. The schema treats role as
 *     TEXT NOT NULL with no enum. Documented in 84-CONTEXT D-03.
 *   - v1.10.8 session summaries are deliberately minimal (last 3 fragments
 *     concatenated, truncated to 500 chars) per 84-CONTEXT D-12. The synthesis
 *     voice will replace this with a real summarizer in a later release.
 *   - post-compact creates a NEW session id; the pre-compact handler closed
 *     the old one. Compact is a context discontinuity.
 *   - A stale .mindrian/current-session.json pointer (from a crashed session)
 *     causes the next session-start to simply create a new session row. No
 *     cleanup needed. Documented here.
 *   - No writes outside the active room directory. Phase 83 write-scope-check
 *     hook enforces this at the filesystem level too.
 *   - All failure modes are silent no-ops that exit 0. Hooks must never crash
 *     the session because memory is broken.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOM_DB_MODULE = path.join(__dirname, '..', 'lib', 'core', 'room-db.cjs');

// ---------------------------------------------------------------------------
// Active room resolution (Phase 83 canonical registry)
// ---------------------------------------------------------------------------

function resolveRoomsRoot() {
  if (process.env.MINDRIAN_ROOMS_ROOT && process.env.MINDRIAN_ROOMS_ROOT.trim()) {
    return process.env.MINDRIAN_ROOMS_ROOT.trim();
  }
  const home = process.env.HOME || '';
  if (home) {
    const candidate = path.join(home, 'MindrianRooms');
    if (fs.existsSync(candidate)) return candidate;
  }
  return '';
}

function resolveActiveRoomDir() {
  const root = resolveRoomsRoot();
  if (!root) return '';
  const registry = path.join(root, '.rooms', 'registry.json');
  if (!fs.existsSync(registry)) return '';
  try {
    const raw = fs.readFileSync(registry, 'utf8');
    const parsed = JSON.parse(raw);
    const active = (parsed && typeof parsed.active === 'string') ? parsed.active.trim() : '';
    if (!active) return '';
    const dir = path.join(root, active);
    if (!fs.existsSync(dir)) return '';
    return dir;
  } catch (_) {
    return '';
  }
}

// Effective room dir: if an explicit argv path is provided AND exists, honor
// it (test fixtures). Otherwise fall back to the registry-resolved active.
function effectiveRoomDir(argPath) {
  if (argPath && typeof argPath === 'string' && fs.existsSync(argPath)) {
    return argPath;
  }
  return resolveActiveRoomDir();
}

// ---------------------------------------------------------------------------
// Session pointer file
// ---------------------------------------------------------------------------

function pointerPath(roomDir) {
  return path.join(roomDir, '.mindrian', 'current-session.json');
}

function readPointer(roomDir) {
  const p = pointerPath(roomDir);
  if (!fs.existsSync(p)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (parsed && typeof parsed.id === 'number') return parsed;
    return null;
  } catch (_) {
    return null;
  }
}

function writePointer(roomDir, id, startedAt) {
  const dir = path.join(roomDir, '.mindrian');
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (_) { /* ignore */ }
  fs.writeFileSync(
    pointerPath(roomDir),
    JSON.stringify({ id: id, started_at: startedAt }, null, 2)
  );
}

function deletePointer(roomDir) {
  try {
    fs.unlinkSync(pointerPath(roomDir));
  } catch (_) { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Summary extraction (minimal v1.10.8 algorithm per D-12)
// ---------------------------------------------------------------------------

function summarizeSession(db, sessionId) {
  try {
    const rows = db.prepare(
      'SELECT role, content FROM fragments WHERE session_id = ? ORDER BY timestamp DESC LIMIT 3'
    ).all(sessionId);
    if (!rows || rows.length === 0) return '';
    const parts = rows.reverse().map((r) => r.content || '');
    const joined = parts.join(' | ');
    return joined.slice(0, 500);
  } catch (_) {
    return '';
  }
}

// ---------------------------------------------------------------------------
// RECENT SESSIONS block formatter
// ---------------------------------------------------------------------------

function formatHistoryBlock(sessions) {
  if (!sessions || sessions.length === 0) return '';
  const lines = [];
  lines.push('## RECENT SESSIONS IN THIS ROOM');
  lines.push('');
  lines.push('The following sessions are recorded in the active room\'s memory layer');
  lines.push('(lib/core/memory-ops.cjs, room/.mindrian/room.db). This is real cross-session');
  lines.push('memory for THIS room only. It does not reach any other room on this machine.');
  lines.push('');
  for (const s of sessions) {
    const when = s.started_at || 'unknown-time';
    const sid = typeof s.id === 'number' ? s.id : 'unknown';
    const summary = (s.summary && String(s.summary).trim()) || 'no summary yet';
    lines.push('- ' + when + ' session ' + sid + ': ' + summary);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Subcommand: session-start
// ---------------------------------------------------------------------------

async function cmdSessionStart(roomDir) {
  const { openRoomDb, closeRoomDb } = require(ROOM_DB_MODULE);
  const memory = require(path.join(__dirname, '..', 'lib', 'core', 'memory-ops.cjs'));

  const handle = await openRoomDb(roomDir);
  try {
    const session = await memory.startSession(handle.db);
    writePointer(roomDir, session.id, session.started_at);

    const limitRaw = parseInt(process.env.MINDRIAN_MEMORY_HISTORY_LIMIT || '5', 10);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 5;

    // Prior sessions exclude the just-created row: fetch limit+1 then drop the
    // newest if it matches the new id.
    const rows = await memory.getSessionHistory(handle.db, limit + 1);
    const prior = rows.filter((r) => r.id !== session.id).slice(0, limit);

    const block = formatHistoryBlock(prior);
    if (block) process.stdout.write(block + '\n');
  } finally {
    await closeRoomDb(handle);
  }
}

// ---------------------------------------------------------------------------
// Subcommand: stop
// ---------------------------------------------------------------------------

async function cmdStop(roomDir) {
  const pointer = readPointer(roomDir);
  if (!pointer) return; // no active session, nothing to close

  const { openRoomDb, closeRoomDb } = require(ROOM_DB_MODULE);
  const memory = require(path.join(__dirname, '..', 'lib', 'core', 'memory-ops.cjs'));

  const handle = await openRoomDb(roomDir);
  try {
    const summary = summarizeSession(handle.db, pointer.id);
    await memory.addFragment(handle.db, {
      session_id: pointer.id,
      role: 'session-summary',
      content: summary || 'session ended',
    });
    await memory.endSession(handle.db, pointer.id, {
      summary: summary || null,
      key_decisions: [],
      open_questions: [],
      artifacts_filed: [],
    });
    await memory.writeVoiceLogStub(handle.db, {
      command: 'session-summary',
      answer_summary: summary || null,
    });
  } finally {
    await closeRoomDb(handle);
    deletePointer(roomDir);
  }
}

// ---------------------------------------------------------------------------
// Subcommand: pre-compact
// ---------------------------------------------------------------------------

async function cmdPreCompact(roomDir) {
  const pointer = readPointer(roomDir);
  if (!pointer) return;

  const { openRoomDb, closeRoomDb } = require(ROOM_DB_MODULE);
  const memory = require(path.join(__dirname, '..', 'lib', 'core', 'memory-ops.cjs'));

  const handle = await openRoomDb(roomDir);
  try {
    const summary = summarizeSession(handle.db, pointer.id);
    await memory.endSession(handle.db, pointer.id, {
      summary: summary || null,
      key_decisions: [],
      open_questions: [],
      artifacts_filed: [],
    });
  } finally {
    await closeRoomDb(handle);
    // Do NOT delete pointer: post-compact will overwrite it.
  }
}

// ---------------------------------------------------------------------------
// Subcommand: post-compact
// ---------------------------------------------------------------------------

async function cmdPostCompact(roomDir) {
  const { openRoomDb, closeRoomDb } = require(ROOM_DB_MODULE);
  const memory = require(path.join(__dirname, '..', 'lib', 'core', 'memory-ops.cjs'));

  const handle = await openRoomDb(roomDir);
  try {
    const session = await memory.startSession(handle.db);
    writePointer(roomDir, session.id, session.started_at);
    await memory.addFragment(handle.db, {
      session_id: session.id,
      role: 'post-compact',
      content: 'session resumed after auto-compact context discontinuity',
    });
  } finally {
    await closeRoomDb(handle);
  }
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

function usage() {
  process.stderr.write(
    'usage: memory-lifecycle.cjs <session-start|stop|pre-compact|post-compact> [roomDir]\n'
  );
}

async function main() {
  const sub = process.argv[2];
  const argPath = process.argv[3];

  if (!sub) {
    usage();
    process.exit(1);
  }

  const roomDir = effectiveRoomDir(argPath);
  if (!roomDir) {
    // Graceful no-op: no active room, no registry, or room missing.
    process.exit(0);
  }

  try {
    switch (sub) {
      case 'session-start': await cmdSessionStart(roomDir); break;
      case 'stop': await cmdStop(roomDir); break;
      case 'pre-compact': await cmdPreCompact(roomDir); break;
      case 'post-compact': await cmdPostCompact(roomDir); break;
      default:
        usage();
        process.exit(1);
    }
  } catch (err) {
    // Last-resort graceful no-op. Log to stderr at debug level so the hook
    // log still records something, but never crash the session.
    if (process.env.MINDRIAN_MEMORY_DEBUG === '1') {
      process.stderr.write('[memory-lifecycle] ' + sub + ' failed: ' + (err && err.message ? err.message : String(err)) + '\n');
    }
    process.exit(0);
  }
}

main();
