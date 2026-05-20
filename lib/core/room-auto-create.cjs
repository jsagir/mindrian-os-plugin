'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 119-00 Wave 1 -- Room Auto-Create entrypoint (D-01 + D-04 binding).
 *
 * Canon Part 10 sub-claim 3 implementing surface: "rooms are receipts, not
 * entry points." When a user's first material upload lands in a no-active-room
 * state, Phase 117's first-material detector calls autoCreatePlaceholderRoom
 * synchronously BEFORE spawning the detached auto-explore-fire child, so the
 * spawned auto-explore output lands in a real room.db from the first byte.
 *
 * Per CONTEXT.md decisions:
 *   D-01: only triggered as a sibling action of Phase 117's existing detector;
 *         never a parallel detector; never blocks the user tool call.
 *   D-04: placeholder slug pattern untitled-{YYYY-MM-DD-HHMM}; UTC timestamp;
 *         second-precision suffix on collision.
 *   D-06: emits room_auto_created memory_event via the navigation.cjs chokepoint
 *         so the cascade event mirror is graph-data per Canon Part 4.
 *
 * Defensive invariants:
 *   Canon Part 8: NEVER require any brain-client / mcp-server-brain module.
 *                 NEVER write user content into the memory_event payload --
 *                 all payload fields are scalars (slug + hash + tier + path-token).
 *   Canon Part 9: writes route through navigation.cjs::logMemoryEvent (the
 *                 chokepoint). Reads of the rooms registry are plain fs reads
 *                 (no graph traversal needed for the no-active-room invariant
 *                 check). The room.db bootstrap (schema + provenance migration
 *                 + session_focus migration) is delegated to
 *                 lib/core/room-db.cjs::openRoomDb because that module is the
 *                 codebase-canonical room.db initializer (the lazygraph-ops
 *                 openGraph factory only applies the lazygraph schema, NOT the
 *                 Phase 109 nodes-provenance + session_focus migrations the
 *                 memory_event log depends on). Production callers
 *                 (scripts/memory-lifecycle.cjs) use this same pattern. Reads
 *                 happen via the navigation surface; openRoomDb is used only
 *                 to acquire the db handle.
 *   Em-dash HARD RULE (memory feedback_no_emdashes.md): zero U+2014 in any
 *                 comment or log line; we use the ASCII double-hyphen marker.
 *
 * Pure CJS, node built-ins + child_process + lib/core/navigation (chokepoint
 * re-export) + lib/core/lazygraph-ops (the openGraph factory). Zero new runtime deps.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

// PLACEHOLDER_SLUG_RE -- the D-04 canonical shape. Frozen; consumers grep this.
// Matches untitled-YYYY-MM-DD-HHMM AND optional -SS collision suffix.
const PLACEHOLDER_SLUG_RE = Object.freeze(/^untitled-\d{4}-\d{2}-\d{2}-\d{4}(?:-\d{2})?(?:-[0-9a-f]{8})?$/);

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/**
 * pad2 -- zero-pad an integer to 2 chars. UTC-safe.
 * @param {number} n
 * @returns {string}
 */
function pad2(n) {
  return n < 10 ? '0' + n : String(n);
}

/**
 * pad4 -- zero-pad an integer to 4 chars (year).
 * @param {number} n
 * @returns {string}
 */
function pad4(n) {
  if (n >= 1000) return String(n);
  if (n >= 100) return '0' + n;
  if (n >= 10) return '00' + n;
  return '000' + n;
}

/**
 * buildPlaceholderSlug -- D-04 slug builder.
 *
 * Returns untitled-YYYY-MM-DD-HHMM in UTC. On collision (when
 * opts.collisionCheckRoomsHome is set and the directory already exists),
 * appends a -SS UTC-seconds suffix; on further collision, appends an
 * 8-char hex random tail (matches the Phase 117 material_id idiom).
 *
 * @param {Date}    [date]       defaults to new Date()
 * @param {object}  [opts]
 * @param {string}  [opts.collisionCheckRoomsHome]  optional roomsHome path to
 *                                                  check for existing slug dirs
 * @returns {string}
 */
function buildPlaceholderSlug(date, opts) {
  const d = (date instanceof Date && !isNaN(date.getTime())) ? date : new Date();
  const options = opts || {};
  const yyyy = pad4(d.getUTCFullYear());
  const mm = pad2(d.getUTCMonth() + 1);
  const dd = pad2(d.getUTCDate());
  const hh = pad2(d.getUTCHours());
  const min = pad2(d.getUTCMinutes());
  const base = 'untitled-' + yyyy + '-' + mm + '-' + dd + '-' + hh + min;

  if (!options.collisionCheckRoomsHome) return base;

  const roomsHome = options.collisionCheckRoomsHome;
  if (!fs.existsSync(path.join(roomsHome, base))) return base;

  // First collision: append UTC seconds.
  const ss = pad2(d.getUTCSeconds());
  const withSeconds = base + '-' + ss;
  if (!fs.existsSync(path.join(roomsHome, withSeconds))) return withSeconds;

  // Second collision: append 8-char random hex (Phase 117 material_id idiom).
  const hex = crypto.randomBytes(4).toString('hex');
  return withSeconds + '-' + hex;
}

/**
 * readRegistrySafe -- read $roomsHome/.rooms/registry.json or return null.
 * @param {string} roomsHome
 * @returns {object|null}
 */
function readRegistrySafe(roomsHome) {
  try {
    const registryPath = path.join(roomsHome, '.rooms', 'registry.json');
    if (!fs.existsSync(registryPath)) return null;
    const raw = fs.readFileSync(registryPath, 'utf8');
    return JSON.parse(raw);
  } catch (_e) {
    return null;
  }
}

/**
 * autoCreatePlaceholderRoom -- D-01 + D-04 entrypoint.
 *
 * Synthesizes an untitled-{TS} slug, scaffolds the minimal room shell
 * (.room-root sentinel + .mindrian/room.db via lazygraph-ops.openGraph),
 * registers the room in $roomsHome/.rooms/registry.json via
 * bash scripts/room-registry create, and emits the room_auto_created
 * memory_event via the navigation.cjs chokepoint (Canon Part 9 D-06).
 *
 * Plan 119-00 ships only the MINIMAL shell (sentinel + .mindrian/room.db);
 * Plan 119-02 fills in the 8 ICM sections + ROOM.md identity files +
 * USER.md + STATE.md + MINTO.md via lib/core/room-skeleton-scaffold.cjs.
 *
 * Per Canon Part 10 sub-claim 3: NEVER blocks the caller. Every failure
 * mode degrades to {ok: false, reason} and the caller continues with the
 * original roomDir.
 *
 * @param {string} roomsHome  absolute path to $MINDRIAN_ROOMS_HOME
 * @param {object} [opts]
 * @param {string} [opts.source_material_id]  Phase 117 material_id (32-hex)
 * @param {string} [opts.source_relative_path] relative path inside room (path-token)
 * @param {number} [opts.source_mtime_ms]     mtime in ms
 * @param {number} [opts.tier]                Phase 117 tier (default 1)
 * @returns {object} { ok, room_dir?, slug?, registry_path?, reason? }
 */
function autoCreatePlaceholderRoom(roomsHome, opts) {
  const options = opts || {};

  // Guard 0: roomsHome is a non-empty string.
  if (!roomsHome || typeof roomsHome !== 'string') {
    return { ok: false, reason: 'rooms_home_invalid' };
  }
  const absRoomsHome = path.resolve(roomsHome);

  // Guard 1: no-active-room invariant. If an active room already exists,
  // never overwrite -- the user is already in a room. D-01 invariant.
  const registry = readRegistrySafe(absRoomsHome);
  if (registry && typeof registry.active === 'string' && registry.active.length > 0) {
    return { ok: false, reason: 'active_room_exists' };
  }

  // Guard 2: writable check. If roomsHome is not writable, attempt mkdir,
  // then fail-soft. Per Canon Part 10 sub-claim 3: NEVER blocks.
  try {
    if (!fs.existsSync(absRoomsHome)) {
      fs.mkdirSync(absRoomsHome, { recursive: true, mode: 0o755 });
    } else {
      fs.accessSync(absRoomsHome, fs.constants.W_OK);
    }
  } catch (_e) {
    return { ok: false, reason: 'rooms_home_not_writable' };
  }

  // Step 3: build the slug with collision check.
  const slug = buildPlaceholderSlug(new Date(), { collisionCheckRoomsHome: absRoomsHome });
  const roomPath = path.join(absRoomsHome, slug);

  // Step 4: minimal directory scaffold. Plan 119-02 fills the rest via
  // lib/core/room-skeleton-scaffold.cjs (sections + STATE.md + MINTO.md + USER.md).
  // We create here only what Phase 117 needs to find via detectRoomSection:
  //   .room-root sentinel + .mindrian/ dir + .mindrian/room.db bootstrap.
  let bootstrapped = false;
  try {
    fs.mkdirSync(roomPath, { recursive: true, mode: 0o755 });
    fs.writeFileSync(path.join(roomPath, '.room-root'), '', { mode: 0o644 });
    fs.mkdirSync(path.join(roomPath, '.mindrian'), { recursive: true, mode: 0o755 });

    // Bootstrap room.db via the codebase-canonical room.db initializer
    // (room-db.cjs::openRoomDb). This applies the lazygraph schema PLUS the
    // Phase 109 nodes-provenance migration (adds source_path / created_by /
    // confidence / review_status columns) + session_focus migration. Without
    // these migrations, memory_event INSERTs fail at the SQL layer. The
    // pre-commit hook (scripts/check-schema-aliases.cjs) is a CREATE TABLE
    // schema-drift guard, not a require-graph allow-list; the runtime
    // soft-defense audit log in openRoomDb itself records out-of-allow-list
    // callers to ~/.mindrian/telemetry/navigation-bypass.jsonl. Production
    // callers (scripts/memory-lifecycle.cjs) use this same pattern.
    const roomDb = require('./room-db.cjs');
    const initDb = roomDb.openRoomDb(roomPath);
    try {
      bootstrapped = true;
    } finally {
      try { initDb.close(); } catch (_e) { /* graceful */ }
    }
  } catch (_e) {
    // Cleanup: best-effort rm the partially-created room dir.
    try {
      if (fs.existsSync(roomPath)) {
        fs.rmSync(roomPath, { recursive: true, force: true });
      }
    } catch (_ignore) { /* graceful */ }
    return { ok: false, reason: 'room_dir_scaffold_failed' };
  }

  if (!bootstrapped) {
    return { ok: false, reason: 'room_db_bootstrap_failed' };
  }

  // Step 5: register in $roomsHome/.rooms/registry.json via bash scripts/room-registry.
  // The script's `create` subcommand parks the previous active room (none here),
  // creates registry entry with status=active + venture_name=untitled +
  // venture_stage=Pre-Opportunity. We pass the slug as RPATH so the script's
  // mkdir -p $ROOMS_HOME/$RPATH idempotently matches the directory we just created.
  //
  // Phase 128.1 (session-scoped binding, D-02/D-03): the `create` subcommand is
  // a session-scoped write -- it binds sessions[sessionId] to the new room under
  // the registry lockfile. The write is owned by scripts/room-registry; this
  // caller's only job is to make sure the canonical session id reaches that
  // child process. We resolve it through the one canonical resolver in
  // lib/core/session-binding.cjs (the same module bindSessionRoom lives in) and
  // pass it explicitly as CLAUDE_SESSION_ID so the create write keys into the
  // resolving session's sessions[] slot rather than a stale env value.
  let autoCreateSessionId = '';
  try {
    const sessionBinding = require('./session-binding.cjs');
    autoCreateSessionId = sessionBinding.resolveSessionId();
  } catch (_e) {
    // session-binding unavailable -- room-registry still resolves the session
    // id itself (CLAUDE_SESSION_ID / session_id / sess-<ts> fallback chain).
    autoCreateSessionId = '';
  }
  const registryScript = path.join(REPO_ROOT, 'scripts', 'room-registry');
  let registryOk = false;
  try {
    const childEnv = Object.assign({}, process.env, { MINDRIAN_ROOMS_HOME: absRoomsHome });
    if (autoCreateSessionId) {
      childEnv.CLAUDE_SESSION_ID = autoCreateSessionId;
    }
    execFileSync('bash', [registryScript, absRoomsHome, 'create', slug, slug, 'untitled', 'Pre-Opportunity'], {
      cwd: REPO_ROOT,
      env: childEnv,
      stdio: 'pipe',
      timeout: 5000,
    });
    registryOk = true;
  } catch (err) {
    // Cleanup: rm the partial room dir; never leave a half-registered room.
    try {
      fs.rmSync(roomPath, { recursive: true, force: true });
    } catch (_ignore) { /* graceful */ }
    const errMsg = (err && err.message) ? String(err.message).slice(0, 80) : 'unknown';
    return { ok: false, reason: 'registry_create_failed:' + errMsg };
  }

  if (!registryOk) {
    return { ok: false, reason: 'registry_create_failed' };
  }

  // Step 6: emit room_auto_created memory_event via the navigation.cjs chokepoint.
  // Canon Part 9 D-06: ALL writes route through navigation.logMemoryEvent.
  // Canon Part 8: payload is scalar-only (slug + 32-hex material_id +
  // path-token relative_path + tier + mtime_seconds). No raw filenames,
  // no user content.
  try {
    const roomDb = require('./room-db.cjs');
    const navigation = require('./navigation.cjs');
    const db = roomDb.openRoomDb(roomPath);
    try {
      navigation.logMemoryEvent(db, 'room_auto_created', {
        placeholder_slug: slug,
        source_material_id: options.source_material_id || null,
        source_relative_path: options.source_relative_path || null,
        source_mtime_seconds: typeof options.source_mtime_ms === 'number'
          ? Math.floor(options.source_mtime_ms / 1000)
          : null,
        tier: typeof options.tier === 'number' ? options.tier : 1,
        source_path: 'system:room-auto-create',
        created_by: 'system',
      });
    } finally {
      try { db.close(); } catch (_e) { /* graceful */ }
    }
  } catch (_e) {
    // memory_event emission failure is NOT a rollback trigger. Per Canon Part 9
    // invariant: SQL writes are best-effort within the chokepoint; the file
    // system is the source of truth. The room directory + registry entry are
    // durable side-effects. A missing memory_event is recoverable via the
    // Phase 124 timeline re-render. Write a stderr warning for telemetry.
    try {
      process.stderr.write('[room-auto-create] memory_event emission failed for slug=' + slug + '; room is durable\n');
    } catch (_ignore) { /* graceful */ }
  }

  // Phase 121-03 D-09: emit room_receipt_written for trajectory telemetry.
  // Per Canon Part 10 sub-claim 3 ("rooms are receipts, not entry points"),
  // every room creation IS a receipt of conversation work. The helper is
  // non-throwing by contract; failure is silent so the receipt-write surface
  // is never blocked by telemetry. Routed through writer.emit() chokepoint
  // (Canon Part 9) so SEED-002 can correlate receipt cadence to engagement.
  try {
    const { emitReceiptWritten } = require('./room-receipt-emit.cjs');
    emitReceiptWritten(slug, options.source_material_id || null);
  } catch (_e) { /* graceful */ }

  return {
    ok: true,
    room_dir: roomPath,
    slug: slug,
    registry_path: path.join(absRoomsHome, '.rooms', 'registry.json'),
  };
}

module.exports = {
  autoCreatePlaceholderRoom: autoCreatePlaceholderRoom,
  buildPlaceholderSlug: buildPlaceholderSlug,
  PLACEHOLDER_SLUG_RE: PLACEHOLDER_SLUG_RE,
};
