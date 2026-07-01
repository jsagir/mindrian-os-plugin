'use strict';
/*
 * Phase 119-01 -- Transactionally-safe placeholder room discard cascade.
 *
 * Per CONTEXT.md D-06 + Architectural Decision item 4: when the user picks
 * [discard room] in the F.1 selector, the entire placeholder is removed:
 * room.db rows + STATE.md + MINTO.md + section folders + ROOM.md identity
 * files + registry entry. Wrapped in a SQLite transaction + ordered fs ops
 * so a partial failure is recoverable.
 *
 * Cascade ORDER (matters; the reverse-order rollback is unwinding):
 *   1. Open room.db handle (room-db.cjs::openRoomDb -- the canonical opener
 *      that applies the Phase 109 nodes-provenance + session_focus migrations
 *      the memory_event log depends on).
 *   2. BEGIN sqlite transaction.
 *   3. emit room_discarded memory_event INSIDE the transaction (via navigation.cjs).
 *   4. COMMIT transaction.
 *   5. Close room.db handle (handle MUST close before file removal).
 *   6. execFileSync bash scripts/room-registry archive <slug> + direct
 *      registry-key removal (the archive subcommand soft-deletes; we want hard
 *      removal because the user picked [discard room]).
 *   7. fs.rmSync($roomsHome/$slug, {recursive: true, force: true}) (LAST -- the
 *      fs removal is final; the registry archive is rollback-able by a
 *      recovery script; the memory_event is durable in the rooms-meta.db
 *      fallback).
 *
 * Partial-failure recovery: if step 7 fails, emit a room_discard_partial_failure
 * memory_event to a SEPARATE .rooms/rooms-meta.db at the rooms-home level (the
 * room.db is either gone or in an inconsistent state). The rooms-meta.db is a
 * Phase 119-01 introduced artifact for the discard recovery signal ONLY; future
 * phases may consolidate this into the central registry-host db.
 *
 * Guard: only PLACEHOLDER slugs (matching PLACEHOLDER_SLUG_RE from Plan 119-00)
 * are discardable via this cascade. Non-placeholder rooms MUST go through
 * /mos:rooms archive.
 *
 * Canon Part 8: pure-local; no Brain MCP coupling.
 * Canon Part 9: ALL memory_event writes route through navigation.cjs::logMemoryEvent.
 * Canon Part 10 sub-claim 3: discard is a typed graph event (the placeholder
 *   becomes graph data even on departure).
 * Em-dash discipline: uses `--` never the U+2014 character per HARD RULE.
 */

const fs = require('node:fs');
const path = require('node:path');
const child_process = require('node:child_process');

// Cross-import the Plan 119-00 placeholder pattern (the cascade refuses any
// slug that does not match this regex).
const { PLACEHOLDER_SLUG_RE } = require('./room-auto-create.cjs');

/**
 * discardPlaceholderRoom(roomsHome, slug, opts) -> {ok, slug, rolled_back_*, ...}
 *
 * @param {string} roomsHome
 * @param {string} slug           must match PLACEHOLDER_SLUG_RE
 * @param {object} opts
 * @param {string} [opts.decided_by]   collaborator identity for the memory_event payload
 * @returns {{ok, slug, rolled_back_db, rolled_back_fs, rolled_back_registry, partial_failure_event_id?, reason?}}
 */
function discardPlaceholderRoom(roomsHome, slug, opts) {
  const options = opts || {};
  const result = {
    ok: false,
    slug: slug,
    rolled_back_db: false,
    rolled_back_fs: false,
    rolled_back_registry: false,
  };

  // Guard 1: placeholder slug invariant.
  if (typeof slug !== 'string' || !PLACEHOLDER_SLUG_RE.test(slug)) {
    result.reason = 'not_a_placeholder_slug';
    return result;
  }

  const roomDir = path.join(roomsHome, slug);
  const dbPath = path.join(roomDir, '.mindrian', 'room.db');

  // Guard 2: roomDir must exist.
  if (!fs.existsSync(roomDir)) {
    result.reason = 'room_dir_not_found';
    return result;
  }

  // Steps 1-5: room_discarded memory_event INSIDE a sqlite transaction.
  let dbHandle = null;
  try {
    if (fs.existsSync(dbPath)) {
      // Use room-db.cjs::openRoomDb (canonical opener; applies Phase 109
      // migrations) per the Plan 119-00 Rule 3 deviation. The plan invoked
      // lazygraph-ops.openRoomDb which does not exist; this is the canonical
      // surface.
      const { openRoomDb, closeRoomDb } = require('./room-db.cjs');
      dbHandle = openRoomDb(roomDir);
      if (dbHandle) {
        const nav = require('./navigation.cjs');
        try {
          dbHandle.exec('BEGIN');
          const eventResult = nav.logMemoryEvent(dbHandle, 'room_discarded', {
            previous_slug: slug,
            decided_by: options.decided_by || 'anonymous',
            source_path: 'system:room-discard-cascade',
            created_by: 'system',
          });
          if (eventResult && eventResult.ok) {
            dbHandle.exec('COMMIT');
            result.rolled_back_db = true;
          } else {
            try { dbHandle.exec('ROLLBACK'); } catch (_e2) { /* swallow */ }
          }
        } catch (_e) {
          try { dbHandle.exec('ROLLBACK'); } catch (_e2) { /* swallow */ }
        } finally {
          try { closeRoomDb(dbHandle); } catch (_e2) { /* swallow */ }
          dbHandle = null;
        }
      }
    }
  } catch (_e) {
    // room-db unavailable -- skip the db step; the registry purge + fs.rmSync
    // still proceed because the durable graph signal is best-effort.
    if (dbHandle) {
      try { dbHandle.close(); } catch (_e2) { /* swallow */ }
      dbHandle = null;
    }
  }

  // Step 6: registry archive + direct key removal.
  try {
    const registryScript = path.join(__dirname, '..', '..', 'scripts', 'room-registry');
    if (fs.existsSync(registryScript)) {
      try {
        child_process.execFileSync('bash', [registryScript, 'archive', slug], {
          cwd: process.cwd(),
          env: Object.assign({}, process.env, { MINDRIAN_ROOMS_HOME: roomsHome }),
          stdio: 'pipe',
          timeout: 5000,
        });
      } catch (_archiveErr) {
        // archive may fail if entry doesn't exist; continue to direct mutation.
      }
    }
    // Direct registry mutation: remove the key entirely (the archive subcommand
    // sets status=archived; the discard cascade goes further by deleting the key).
    const registryPath = path.join(roomsHome, '.rooms', 'registry.json');
    if (fs.existsSync(registryPath)) {
      const raw = fs.readFileSync(registryPath, 'utf8');
      const reg = JSON.parse(raw);
      if (reg && typeof reg.rooms === 'object' && reg.rooms[slug]) {
        delete reg.rooms[slug];
        if (reg.active === slug) reg.active = '';
        const tmpPath = registryPath + '.tmp.' + process.pid + '.' + Math.random().toString(36).slice(2, 8);
        fs.writeFileSync(tmpPath, JSON.stringify(reg, null, 2), 'utf8');
        fs.renameSync(tmpPath, registryPath);
        result.rolled_back_registry = true;
      } else if (reg && typeof reg.rooms === 'object') {
        // Entry already absent (idempotent path); mark as registry purged.
        result.rolled_back_registry = true;
      }
    } else {
      // No registry to purge; treat as nothing-to-do success for this step.
      result.rolled_back_registry = true;
    }
  } catch (registryErr) {
    // Registry update failed -- record partial failure and bail out before fs.rmSync.
    _emitPartialFailure(roomsHome, slug, result, registryErr);
    return result;
  }

  // Step 6b (Phase 195-04, FCM-11c): purge cross-room UMBILICAL_TO edges touching
  // this slug so no dangling peer edge survives the cascade (D-03 orphan-reap,
  // layer 1). The registry-level cross-room store (.rooms/cross-room.db) is
  // SEPARATE from the room dir removed in step 7, so its edges would otherwise
  // outlive the room. Best-effort + never throws (purgeRoomEdges swallows), and it
  // runs AFTER the registry key removal so the room is already de-registered.
  try {
    const crossRoomStore = require('./cross-room-store.cjs');
    result.cross_room_edges_purged = crossRoomStore.purgeRoomEdges(roomsHome, slug);
  } catch (_crossErr) {
    result.cross_room_edges_purged = 0;
  }

  // Step 7: filesystem rmSync (LAST -- final, irreversible). On failure, emit the
  // partial-failure memory_event to a fallback rooms-meta.db so /mos:doctor can
  // find the orphaned directory + the archived-but-still-present registry footprint.
  try {
    fs.rmSync(roomDir, { recursive: true, force: true });
    if (!fs.existsSync(roomDir)) {
      result.rolled_back_fs = true;
    }
  } catch (fsErr) {
    _emitPartialFailure(roomsHome, slug, result, fsErr);
    return result;
  }

  result.ok = result.rolled_back_fs && result.rolled_back_registry;
  return result;
}

/**
 * Internal: emit the room_discard_partial_failure memory_event to a fallback
 * .rooms-meta.db at the rooms-home level. This is the recovery hook /mos:doctor
 * --orphaned-room-cleanup uses to find orphaned placeholder rooms (the v1.13.0
 * housekeeping pass; THIS plan only ships the recovery signal).
 */
function _emitPartialFailure(roomsHome, slug, result, err) {
  const error_short = String(err && err.message || err).slice(0, 60);
  result.reason = error_short;
  try {
    const metaRoomDir = path.join(roomsHome, '.rooms', '_meta');
    // _meta is a synthetic "room dir" containing a real room.db; we use the
    // canonical openRoomDb opener with the standard .mindrian/room.db nesting.
    fs.mkdirSync(path.join(metaRoomDir, '.mindrian'), { recursive: true, mode: 0o755 });
    const { openRoomDb, closeRoomDb } = require('./room-db.cjs');
    const handle = openRoomDb(metaRoomDir);
    if (handle) {
      const nav = require('./navigation.cjs');
      const eventResult = nav.logMemoryEvent(handle, 'room_discard_partial_failure', {
        previous_slug: slug,
        partial_state: {
          fs_removed: result.rolled_back_fs,
          registry_purged: result.rolled_back_registry,
          db_dropped: result.rolled_back_db,
        },
        error_short: error_short,
        source_path: 'system:room-discard-cascade',
        created_by: 'system',
      });
      if (eventResult && eventResult.ok) {
        result.partial_failure_event_id = eventResult.eventId;
      }
      try { closeRoomDb(handle); } catch (_e2) { /* swallow */ }
    }
  } catch (_e) { /* if even the partial-failure emission fails, swallow */ }
}

module.exports = { discardPlaceholderRoom: discardPlaceholderRoom };
