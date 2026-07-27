'use strict';
/*
 * lib/core/room-open.cjs -- the ONE "switch the active room" chokepoint.
 *
 * WHY THIS EXISTS (RCA rooms-open-false-success, 2026-07-27).
 *
 * `orchestration({ command: 'rooms-open', room: X })` was a DECLARED-BUT-
 * UNIMPLEMENTED command. It passed Zod validation via its membership in
 * ORCHESTRATION_COMMANDS, missed every explicit branch in the orchestration
 * handler, and landed in the generic reference-echo fallback
 * (lib/mcp/tool-router.cjs), which assembled a response out of three sources
 * that are all structurally independent of any state mutation:
 *
 *   1. commands/rooms.md read off disk        (the INSTRUCTIONS, not a result)
 *   2. STATE.md from the boot-frozen roomDir  (ambient state of some OTHER room)
 *   3. a verbatim echo of the caller's `room` argument under "### Target Room"
 *
 * ...and then appended "Room operation complete - check status". So it emitted a
 * confirmation-shaped payload for an operation it never attempted. Proven live
 * 2026-07-22: `get-active` returned the PRIOR room immediately after a
 * "successful" rooms-open call, and the next Write was blocked with
 * "Active room is <prior room>".
 *
 * A repo-wide grep confirmed the deeper fact: BEFORE this module, zero product
 * .cjs code anywhere called `room-registry set-active`. The entire MCP surface
 * (Desktop, Cowork, and CLI-via-tool-call) advertised "multi-room management"
 * while having no room-switch capability at all.
 *
 * THE CONTRACT THIS MODULE ENFORCES: success is impossible without the write.
 * openRoom() does not return ok:true on the strength of having called
 * set-active. It returns ok:true only after reading `get-active` BACK off disk
 * and finding the requested room there -- the exact ground-truth check the human
 * performed by hand to catch this bug in the first place.
 *
 * Canon Part 7 (reuse before build): `scripts/room-registry` stays the single
 * authoritative writer of registry.json. This module WRAPS it (the repo's
 * documented "Bash scripts in scripts/ stay authoritative; CJS wraps them"
 * convention, same execFileSync pattern already shipped in
 * lib/core/room-discard-cascade.cjs:129-143). Reimplementing the registry write
 * in Node would create a second writer AND silently skip set-active's own side
 * effects: parking the previously-active room, stamping `last_opened`, the
 * statusline `current_room` write, and the STATE.md `current_room` write.
 *
 * Canon Part 8: LOCAL only. Reads registry.json + spawns a local script. Zero
 * network surface, zero Brain egress.
 *
 * Canon Part 9: this does NOT open the per-room SQLite graph. Room-switching is
 * a registry concern; graph reads go through the navigation chokepoint AFTER a
 * room dir is resolved.
 *
 * HUMAN GATE PRESERVED: commands/rooms.md "Subcommand: open" Step 2 requires a
 * confirmation prompt before opening an ARCHIVED room (opening it flips its
 * status back to active). openRoom() refuses an archived room with
 * reason:'archived_needs_confirmation' unless the caller passes
 * confirmArchived:true. Fixing a false-success bug must not introduce a
 * gate-skip bug.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const child_process = require('node:child_process');

const REGISTRY_SCRIPT = path.join(__dirname, '..', '..', 'scripts', 'room-registry');

/**
 * Env-aware rooms-home default. Mirrors resolve-active-room.cjs exactly (the
 * FLAG-3 landmine: bare os.homedir() reads /etc/passwd on Linux and ignores
 * process.env.HOME, which breaks hermetic mkdtempSync fixtures).
 *
 * @param {{home?: string}} [opts]
 * @returns {string}
 */
function resolveRoomsHome(opts) {
  const o = opts || {};
  return o.home || process.env.MINDRIAN_ROOMS_HOME
    || path.join(process.env.HOME || process.env.USERPROFILE || os.homedir(), 'MindrianRooms');
}

/**
 * Read the registry object, or null if unreadable. Never throws.
 * @param {string} roomsHome
 * @returns {Object|null}
 */
function readRegistry(roomsHome) {
  try {
    const p = path.join(roomsHome, '.rooms', 'registry.json');
    if (!fs.existsSync(p)) return null;
    const reg = JSON.parse(fs.readFileSync(p, 'utf8'));
    return (reg && typeof reg === 'object') ? reg : null;
  } catch (_e) {
    return null;
  }
}

/**
 * Run a `scripts/room-registry` subcommand. Returns trimmed stdout on success,
 * or null on any failure (missing script, non-zero exit, timeout, no bash).
 *
 * stdio 'pipe' is mandatory here, not cosmetic: on a stdio MCP transport
 * process.stdout IS the JSON-RPC framing channel, so a child inheriting it
 * would corrupt the session (same reasoning already documented for eureka's
 * status/report paths in tool-router.cjs).
 *
 * @param {string[]} args
 * @param {string} roomsHome
 * @returns {string|null}
 */
function runRegistry(args, roomsHome) {
  try {
    if (!fs.existsSync(REGISTRY_SCRIPT)) return null;
    const out = child_process.execFileSync('bash', [REGISTRY_SCRIPT].concat(args), {
      cwd: process.cwd(),
      env: Object.assign({}, process.env, { MINDRIAN_ROOMS_HOME: roomsHome }),
      stdio: 'pipe',
      timeout: 10000,
      encoding: 'utf8',
    });
    return typeof out === 'string' ? out.trim() : '';
  } catch (_e) {
    return null;
  }
}

/**
 * Read the CURRENT active room slug straight off the registry script -- the
 * same ground truth `bash scripts/room-registry get-active` gives a human.
 *
 * @param {string} roomsHome
 * @returns {string} slug, or '' when unset/unreadable
 */
function getActive(roomsHome) {
  const out = runRegistry(['get-active'], roomsHome);
  return typeof out === 'string' ? out.trim() : '';
}

/**
 * Switch the active room, and PROVE it switched.
 *
 * Returns a plain result object. The ONLY path to `ok: true` runs through a
 * post-write `get-active` read-back that equals `room`. Every other path
 * returns ok:false with a machine-readable `reason`, so a caller can never
 * mistake "I asked" for "it happened".
 *
 * @param {Object} opts
 * @param {string} opts.room - target room slug
 * @param {string} [opts.sessionId] - this session's id; when present, the
 *   per-session binding is also written so write-scope-check.cjs Leg A
 *   (set-membership) authorizes this session immediately and unraceably.
 * @param {boolean} [opts.confirmArchived] - caller has obtained the human's
 *   confirmation to reopen an archived room (commands/rooms.md open, Step 2).
 * @param {string} [opts.home] - rooms-home override (test seam).
 * @returns {{ok:boolean, reason?:string, room?:string, active?:string,
 *   previous?:string, status?:string, session_bound?:boolean, abs_path?:string}}
 */
function openRoom(opts) {
  const o = opts || {};
  const room = typeof o.room === 'string' ? o.room.trim() : '';
  const roomsHome = resolveRoomsHome(o);

  if (!room) {
    return { ok: false, reason: 'no_room_specified' };
  }
  // Reuse the shared slug validator rather than minting a second one; it is the
  // same guard writeSessionBinding applies to the value we are about to store.
  let isSafeSlug = null;
  try {
    ({ isSafeSlug } = require('./session-binding.cjs'));
  } catch (_e) { /* validator unavailable -- fall through to registry validation */ }
  if (isSafeSlug && !isSafeSlug(room)) {
    return { ok: false, reason: 'invalid_room_slug', room: room };
  }

  const reg = readRegistry(roomsHome);
  if (!reg) {
    return { ok: false, reason: 'no_registry', room: room };
  }
  const rooms = (reg && typeof reg.rooms === 'object' && reg.rooms) || {};
  const entry = rooms[room];
  if (!entry) {
    return { ok: false, reason: 'room_not_found', room: room };
  }

  // commands/rooms.md "Subcommand: open" Step 2 -- opening an archived room
  // flips its status back to active, so it needs the human's confirmation
  // first. Refusing here keeps that gate intact on the MCP surface.
  const status = (entry && typeof entry.status === 'string') ? entry.status : '';
  if (status === 'archived' && o.confirmArchived !== true) {
    return { ok: false, reason: 'archived_needs_confirmation', room: room, status: status };
  }

  // Informational only, so it reads from the registry object already in hand
  // rather than spending another subprocess. The VERIFY read below deliberately
  // does NOT take this shortcut -- it must come from the script, off disk,
  // after the write.
  const previous = (typeof reg.active === 'string' ? reg.active : '');

  // The one authoritative write. Its own stdout contract is the bare room name.
  const wrote = runRegistry(['set-active', room], roomsHome);
  if (wrote === null) {
    return { ok: false, reason: 'set_active_failed', room: room, previous: previous };
  }

  // THE GATE. Read the ground truth back off disk. This is what makes a
  // success-shaped response impossible without the write actually landing --
  // the precise property whose absence was this bug.
  const active = getActive(roomsHome);
  if (active !== room) {
    return {
      ok: false,
      reason: 'verify_failed',
      room: room,
      active: active,
      previous: previous,
    };
  }

  // Also bind THIS session. write-scope-check.cjs authorizes a write via Leg A
  // (session bound-set membership) before falling back to Leg B (global
  // reg.active equality). Writing only reg.active would leave this session at
  // the mercy of the cross-process last-writer-wins race documented in
  // .planning/debug/resolved/registry-active-room-concurrent-session-collision.md.
  // Best-effort: a binding failure must not turn a verified, successful switch
  // into a reported failure.
  let sessionBound = false;
  try {
    const sb = require('./session-binding.cjs');
    const sid = o.sessionId || process.env.CLAUDE_CODE_SESSION_ID || '';
    if (sid) {
      // Pass the SAME roomsHome the registry write used. session-binding.cjs
      // resolves its own home independently (opts.home > MINDRIAN_ROOMS_HOME >
      // os.homedir()), so omitting it would write the binding into the ambient
      // default home while the registry flip landed somewhere else -- a
      // half-switched machine, and in tests a write straight through the
      // hermetic fixture into the developer's real ~/MindrianRooms.
      sb.writeSessionBinding(sid, { primary: room, bound: [room] }, { home: roomsHome });
      sessionBound = true;
    }
  } catch (_e) { /* binding is an enhancement to a switch that already verified */ }

  let absPath = '';
  try {
    const rar = require('./resolve-active-room.cjs');
    const r = rar.resolveActiveRoom({ home: roomsHome });
    if (r && r.slug === room) absPath = r.abs_path;
  } catch (_e) { /* abs_path is informational only */ }

  return {
    ok: true,
    room: room,
    active: active,
    previous: previous,
    status: 'active',
    session_bound: sessionBound,
    abs_path: absPath,
  };
}

module.exports = { openRoom, getActive, resolveRoomsHome };
