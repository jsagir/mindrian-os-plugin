'use strict';
// Phase 369 plan 17 (FEED369-03, FEED369-05, D-18) -- the daemon-side room
// watcher: it turns a commit by ANY process into one content-free
// `room.changed {roomId, latestSeq}` SSE hint, so the browser shell refreshes in
// tens of milliseconds instead of waiting a poll interval.
//
// Why it lives here: room.db is written by hooks, scripts and Python outside the
// MCP server, so the in-process bus never sees those writes (spike 006 measured 0
// frames across every write). Only the daemon may open room.db (D-18), so the
// daemon watches.
//
// How it watches (spike 006): fs.watch on the room's .mindrian/ directory,
// filtered to filenames starting with room.db (the WAL and shm files move on
// every commit), debounced, and gated by PRAGMA data_version read on ONE
// long-lived read-only connection (data_version is only meaningful on the same
// connection, 369-RESEARCH Pitfall 13). A 500 ms poll is the safety net. The
// hint publishes only when the change log's latest seq actually advanced.
//
// Lifecycle: started lazily by the first room_changes call for a room, refreshed
// by every later call, stopped after an idle window. It never throws, and it
// holds nothing that keeps the daemon alive (non-persistent watch, unref'd timer).
//
// Canon Part 8: local only; the payload is a slug and a number, never room
// content. Canon Part 9: room.db is read only through navigation.cjs exports
// (openRoomDbReadOnlyForCaller, readDataVersion, readLatestSeq); this file never
// requires room-db.cjs or node:sqlite.
//
// No em-dashes. CJS only.

const fs = require('node:fs');
const path = require('node:path');

const navigation = require('../core/navigation.cjs');
const bus = require('./sse-event-bus.cjs');

// Contract defaults (reasons in 369-17-PLAN.md): 10 minutes is one third of the
// shell's 30-minute browser-session idle expiry; 25 ms folds the burst of
// room.db-wal and room.db-shm events one commit makes into one check while
// staying far below the poll net; 500 ms is spike 006's poll safety net.
const DEFAULT_IDLE_MS = 10 * 60 * 1000;
const DEBOUNCE_MS = 25;
const POLL_MS = 500;

// roomId -> { roomId, roomDir, db, version, seq, watch, timer, debounce, lastTouched, idleMs }
const state = new Map();

function teardown(entry) {
  if (!entry) return;
  if (entry.debounce) { try { clearTimeout(entry.debounce); } catch (_e) { /* best effort */ } entry.debounce = null; }
  if (entry.timer) { try { clearInterval(entry.timer); } catch (_e) { /* best effort */ } entry.timer = null; }
  if (entry.watch) { try { entry.watch.close(); } catch (_e) { /* best effort */ } entry.watch = null; }
  if (entry.db) { try { navigation.closeRoomDbForCaller(entry.db); } catch (_e) { /* best effort */ } entry.db = null; }
}

function drop(roomId) {
  const entry = state.get(roomId);
  state.delete(roomId);
  teardown(entry);
}

// One look: stop when idle, read data_version on the long-lived handle and, when
// it moved, read the latest seq and publish only if the seq advanced.
function check(roomId) {
  const entry = state.get(roomId);
  if (!entry) return;
  try {
    if (Date.now() - entry.lastTouched > entry.idleMs) {
      drop(roomId);
      return;
    }
    if (!entry.db) { drop(roomId); return; }
    const version = navigation.readDataVersion(entry.db);
    if (version === entry.version) return;
    entry.version = version;
    const seq = Number(navigation.readLatestSeq(entry.db)) || 0;
    if (seq > entry.seq) {
      entry.seq = seq;
      bus.publish('room.changed', { roomId: roomId, latestSeq: seq });
    } else if (seq < entry.seq) {
      // The log was rebuilt (a reset). Track it quietly; the shell's own cursor
      // poll learns about the new epoch through room_changes.
      entry.seq = seq;
    }
  } catch (_e) {
    // Any failure drops the watcher; the next ensureWatching restarts it.
    drop(roomId);
  }
}

function schedule(roomId) {
  const entry = state.get(roomId);
  if (!entry || entry.debounce) return;
  entry.debounce = setTimeout(() => {
    const e = state.get(roomId);
    if (e) e.debounce = null;
    check(roomId);
  }, DEBOUNCE_MS);
  if (typeof entry.debounce.unref === 'function') entry.debounce.unref();
}

/**
 * ensureWatching({ roomId, roomDir, idleMs }) -> { watching, reason? }
 * Starts (or refreshes) the watcher for one room. Never throws.
 */
function ensureWatching(opts) {
  try {
    const o = opts && typeof opts === 'object' ? opts : {};
    const roomId = typeof o.roomId === 'string' && o.roomId.length > 0 ? o.roomId : null;
    const roomDir = typeof o.roomDir === 'string' && o.roomDir.length > 0 ? o.roomDir : null;
    if (!roomId || !roomDir) return { watching: false, reason: 'bad_args' };

    const existing = state.get(roomId);
    if (existing) {
      existing.lastTouched = Date.now();
      if (Number.isFinite(o.idleMs) && o.idleMs > 0) existing.idleMs = o.idleMs;
      return { watching: true, reason: 'already' };
    }

    const db = navigation.openRoomDbReadOnlyForCaller(roomDir);
    if (!db) return { watching: false, reason: 'no_db' };

    const entry = {
      roomId: roomId,
      roomDir: roomDir,
      db: db,
      version: 0,
      seq: 0,
      watch: null,
      timer: null,
      debounce: null,
      lastTouched: Date.now(),
      idleMs: Number.isFinite(o.idleMs) && o.idleMs > 0 ? o.idleMs : DEFAULT_IDLE_MS,
    };
    try {
      entry.version = navigation.readDataVersion(db);
      entry.seq = Number(navigation.readLatestSeq(db)) || 0;
    } catch (_e) {
      teardown(entry);
      return { watching: false, reason: 'read_failed' };
    }
    state.set(roomId, entry);

    try {
      entry.watch = fs.watch(path.join(roomDir, '.mindrian'), { persistent: false }, (_evt, name) => {
        if (name && String(name).startsWith('room.db')) schedule(roomId);
      });
      entry.watch.on('error', () => { /* the poll net still runs */ });
    } catch (_e) {
      entry.watch = null; // the poll net alone still wakes the shell
    }
    entry.timer = setInterval(() => check(roomId), POLL_MS);
    if (typeof entry.timer.unref === 'function') entry.timer.unref();
    return { watching: true, reason: 'started' };
  } catch (_e) {
    return { watching: false, reason: 'error' };
  }
}

/** stopWatching(roomId) -- close one room's watch, timer and handle. */
function stopWatching(roomId) {
  try { drop(roomId); } catch (_e) { /* never throws */ }
}

/** stopAll() -- close every watcher. */
function stopAll() {
  for (const roomId of Array.from(state.keys())) stopWatching(roomId);
}

module.exports = { ensureWatching, stopWatching, stopAll, _state: state };
