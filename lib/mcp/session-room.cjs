'use strict';
// Phase 248-01 (CTX-01/CTX-02) -- the ONE MCP room resolver.
//
// This module replaces the NINE independent gate-then-fallthrough
// resolveSessionRoomDir/resolveWriteTargetDir copies that used to live one
// per lib/mcp/tools/*.cjs file plus lib/mcp/tool-router.cjs and
// lib/mcp/stop-gate-handler.cjs (research census, verified 2026-08-10).
// Reintroducing a copy anywhere under lib/mcp/ turns
// tests/test-248-resolver-census.cjs red (source-grep tripwire).
//
// THE DOCTRINE CHANGE (named explicitly, never slipped in): binding reads are
// now UNCONDITIONAL. Every retired copy only consulted a session's room_bind
// write inside `if (isMcpFirst(surface))`, and MINDRIAN_MCP_FIRST is unset on
// every install by default (D-07), so room_bind's write was never read. This
// module calls core resolveSessionRoom / resolveWriteRoom WITHOUT any
// isMcpFirst gate on the read path -- the flag and the surface are simply not
// inputs to room resolution anymore. An unbound session still resolves
// byte-identically to legacy (core Leg B IS resolveActiveRoom); a bound
// session is finally honored regardless of flag state. MINDRIAN_MCP_FIRST's
// remaining consumers after this collapse are daemon lifecycle/registration
// concerns (bin/mindrian-mcp-server.cjs) and the write-path PERMISSION gate
// (isWritePathEnabled, lib/mcp/mcp-first-flag.cjs) -- an orthogonal question
// ("may this call write") this module never answers.
//
// Canon Part 7 (reuse before build): this module mints NO new precedence. It
// is a thin, options-object-only wrapper around the SHIPPED, TESTED core
// ladder in lib/core/resolve-active-room.cjs (resolveSessionRoom for reads,
// resolveWriteRoom for writes) -- the SEED-034 four-guessers lesson
// resolve-active-room.cjs already fixed for the rest of the tree.
//
// Canon Part 8/9: LOCAL filesystem reads only (the core ladder's own
// registry.json / session-binding-file reads), zero network egress, zero
// graph-chokepoint token -- this module never opens room.db itself; the room id is
// read through lib/core/navigation/room-identity.cjs readRoomIdentity, the one identity
// reader (369.25 RID-06).
//
// The census contract: tests/test-248-resolver-census.cjs turns red on any
// second `function resolveSessionRoomDir` under lib/mcp/, any executable
// `isMcpFirst(` outside mcp-first-flag.cjs, or any executable
// `resolveWriteRoom(`/`resolveActiveRoom(` outside this file.
//
// RCA desktop-session-binding-fallback (navigator ruling 2026-10-02, process
// key + refuse): this module is ALSO the one place that decides whether an
// MCP call may WRITE into the room it resolved. resolveMcpWriteRoom is the
// write-authority gate every room-writing tool calls: a room the session chose
// (session.primary, or a cwd inside a room root) may be written; the
// machine-wide registry `active` pointer may NOT be, once the session has an
// identity it could have bound under (the D-04 doctrine below, now enforced
// instead of only logged). The read side keeps showing the registry room for an
// unbound session but labels it (describeRoomBinding) so it is never mistaken
// for a binding. Same census contract as above: this file stays the only home
// of the resolver legs.
//
// No em-dashes. CJS only.

const fs = require('node:fs');
const path = require('node:path');
const { resolveSessionRoom, resolveWriteRoom } = require('../core/resolve-active-room.cjs');

// 369.25 RID-06: the room id the adapters report is read from room.db through the ONE identity reader, door
// in_place (live room.db files measure 15-28 MB; no copy on a hot path). Required lazily so a load failure of the
// identity module can never take the resolver down with it. This is a reader, not a resolver: no second resolver
// (tests/test-248-resolver-census.cjs) and nothing is added to resolve-active-room.cjs (rar.12).
let _identityMod = null;
function loadIdentityMod() {
  if (_identityMod !== null) return _identityMod;
  try { _identityMod = require('../core/navigation/room-identity.cjs'); } catch (_e) { _identityMod = false; }
  return _identityMod;
}

/**
 * readIdentityRaw(dir) -- private. The readRoomIdentity result for a room directory (door in_place), or a synthetic
 * not_ready result when the owner module cannot load or throws; null for an unusable dir. Never throws.
 */
function readIdentityRaw(dir) {
  if (typeof dir !== 'string' || dir.length === 0) return null;
  try {
    const mod = loadIdentityMod();
    if (!mod || typeof mod.readRoomIdentity !== 'function') {
      return { ok: false, state: 'not_ready', reason: 'room_db_unreadable' };
    }
    return mod.readRoomIdentity(dir, { door: 'in_place' });
  } catch (_e) {
    return { ok: false, state: 'not_ready', reason: 'room_db_unreadable' };
  }
}

/**
 * identityFromRaw(raw) -- private. { room_id, room_identity } from a readIdentityRaw result. ready -> the committed
 * room_id and {state:'ready'}; not ready -> room_id from stored.room_id when the row survived (a moved folder still
 * names its id), else null, and {state:'not_ready', reason}. Never throws.
 */
function identityFromRaw(id) {
  if (!id || typeof id !== 'object') return { room_id: null, room_identity: null };
  if (id.ok === true && id.state === 'ready') {
    return { room_id: id.room_id, room_identity: { state: 'ready' } };
  }
  const stored = (id.stored && typeof id.stored === 'object') ? id.stored : null;
  const storedId = stored && typeof stored['room.room_id'] === 'string' && stored['room.room_id'].length > 0
    ? stored['room.room_id'] : null;
  return {
    room_id: storedId,
    room_identity: { state: 'not_ready', reason: (typeof id.reason === 'string') ? id.reason : 'room_db_unreadable' },
  };
}

/** identityFor(dir) -- private. One read, compact view. */
function identityFor(dir) {
  return identityFromRaw(readIdentityRaw(dir));
}

// 369.25 plan 13 (HEAL-02, failure test 1): the per-operation readiness answer and the recovery card. Both are
// required lazily so a load failure of either can never take the resolver down with it (a missing readiness module
// leaves a write as it was before this plan; the module ships in the same commit, so that is a packaging fault, not
// a mode).
let _readinessMod = null;
function loadReadinessMod() {
  if (_readinessMod !== null) return _readinessMod;
  try { _readinessMod = require('../core/room-readiness.cjs'); } catch (_e) { _readinessMod = false; }
  return _readinessMod;
}
let _gateMod = null;
function loadRecoveryGateMod() {
  if (_gateMod !== null) return _gateMod;
  try { _gateMod = require('./room-readiness-gate.cjs'); } catch (_e) { _gateMod = false; }
  return _gateMod;
}

// The typed refusal reason a governed write returns when the room cannot hold it (room.db missing, damaged or not
// writable). Never rename without updating tests/test-36925-readiness-gate.cjs.
const ROOM_NOT_READY = 'room_not_ready';

// The stable stderr token for the D-04 compat-shim deprecation log (SPEC-1
// acceptance, Part 11 threat T-198-08), moved here verbatim from
// tool-router.cjs (its former sole owner). Grepped verbatim by prior
// acceptance criteria (198-02); never rename without updating every
// consumer.
const MCP_FIRST_DEPRECATED_ACTIVE_WRITE = 'MCP_FIRST_DEPRECATED_ACTIVE_WRITE';

// The typed refusal reason an MCP write returns when the session has no room
// bound (RCA desktop-session-binding-fallback). Never rename without updating
// every tool that returns it and tests/test-desktop-stdio-session-binding.cjs.
const NO_BOUND_ROOM = 'no_bound_room';
const NO_BOUND_ROOM_MESSAGE = 'No room is bound to this session, so nothing was written. '
  + 'Bind a room first: call room_list, then room_bind with the room you want, then retry.';

/**
 * resolveMcpSessionRoom(opts) -- the ONE shared MCP room resolver.
 *
 * @param {{sessionId?: string, ctx?: {fallbackRoomDir?: string, surface?: string},
 *   forWrite?: boolean, noFloor?: boolean, quiet?: boolean}} [opts] quiet: true
 *   suppresses the forWrite reg.active stderr token (resolveMcpWriteRoom logs it
 *   itself, and only when the write is actually allowed).
 * @returns {{dir: string|null, slug: string|null, source: string}}
 *   source is one of 'session.primary', 'room-root' (forWrite only),
 *   'reg.active', 'boot-fallback', 'cwd', 'none'. Never throws.
 */
function resolveMcpSessionRoom(opts) {
  const o = (opts && typeof opts === 'object') ? opts : {};
  const sessionId = o.sessionId;
  const ctx = (o.ctx && typeof o.ctx === 'object') ? o.ctx : {};
  const forWrite = o.forWrite === true;
  const noFloor = o.noFloor === true;
  const home = process.env.MINDRIAN_ROOMS_HOME;

  let hit = null;
  try {
    if (forWrite) {
      // Preserves the `.room-root` cwd walk-up (leg 1) exactly as the
      // flag-ON write path did today. This leg must NEVER leak into reads --
      // resolveSessionRoom exists precisely to exclude it (its own header,
      // lib/core/resolve-active-room.cjs lines 459-464).
      hit = resolveWriteRoom({ sessionId: sessionId, home: home });
    } else {
      hit = resolveSessionRoom({ sessionId: sessionId, home: home });
    }
  } catch (_e) {
    // Never throws: any resolver failure falls to the floor below (mirrors
    // every retired copy's discipline).
    hit = null;
  }

  if (hit && hit.abs_path) {
    if (forWrite && hit.source === 'reg.active' && o.quiet !== true) {
      // D-04: reg.active is a READ-fallback for a binding-less session, not
      // write authority anymore. Log, don't silently authorize.
      try {
        process.stderr.write(
          MCP_FIRST_DEPRECATED_ACTIVE_WRITE + ' session=' + String(sessionId) + ' room=' + hit.slug + '\n'
        );
      } catch (_logErr) { /* stderr write failure never blocks the write */ }
    }
    return { dir: hit.abs_path, slug: hit.slug, source: hit.source };
  }

  if (noFloor) {
    return { dir: null, slug: null, source: 'none' };
  }
  if (ctx.fallbackRoomDir) {
    return { dir: ctx.fallbackRoomDir, slug: null, source: 'boot-fallback' };
  }
  return { dir: process.cwd(), slug: null, source: 'cwd' };
}

/**
 * resolveSessionRoomDir(sessionId, ctx) -- back-compat string wrapper, the
 * drop-in the nine former copies re-export. Floors exactly as they did
 * today.
 *
 * @param {string|undefined} sessionId
 * @param {{fallbackRoomDir?: string, surface?: string}} [ctx]
 * @returns {string}
 */
function resolveSessionRoomDir(sessionId, ctx) {
  return resolveMcpSessionRoom({ sessionId: sessionId, ctx: ctx }).dir;
}

/**
 * isOperatorPinnedRoom(hit) -- true when a resolver hit that reads as
 * 'reg.active' actually came from the CLAUDE_ACTIVE_ROOM env override
 * (resolve-active-room.cjs resolveActiveRoom, step 1) rather than from the
 * machine-wide registry file. That variable is set per PROCESS by whoever
 * configured this server (an MCP env block, a test harness), so it is a room
 * the operator chose, not the shared pointer another session or a manual
 * `rooms open` can move underneath a window. The refusal exists for the shared
 * pointer; an explicit operator pin stays a write target. Pure; never throws.
 *
 * @param {{dir?: string|null, source?: string}} hit
 * @returns {boolean}
 */
function isOperatorPinnedRoom(hit) {
  try {
    if (!hit || hit.source !== 'reg.active' || typeof hit.dir !== 'string') return false;
    const pin = String(process.env.CLAUDE_ACTIVE_ROOM || '').trim();
    if (pin.length === 0) return false;
    return path.resolve(pin) === path.resolve(hit.dir);
  } catch (_e) {
    return false;
  }
}

/**
 * resolveMcpWriteRoom(opts) -- the write-authority gate (RCA
 * desktop-session-binding-fallback). Resolves the room exactly as the legacy
 * tool call did, then decides whether that room may be WRITTEN:
 *
 *   - 'session.primary' (the session chose it) and 'room-root' (the cwd sits
 *     inside a room root) are write authority.
 *   - 'reg.active' is the machine-wide pointer another session or a manual
 *     `rooms open` can move at any time (a CLAUDE_ACTIVE_ROOM env pin is the
 *     one exception: see isOperatorPinnedRoom). It is NOT write authority once the
 *     session has an identity to bind under: the call is refused with the typed
 *     reason no_bound_room and the model is told to bind a room first. A caller
 *     with NO session identity at all (a session-less web-transport request,
 *     an in-process caller) cannot bind, so "bind first" would be unanswerable;
 *     it keeps the legacy behavior, with the MCP_FIRST_DEPRECATED_ACTIVE_WRITE
 *     stderr token as its trace.
 *   - 'boot-fallback' (the server's configured MINDRIAN_ROOM / default room) is
 *     the operator's own pin and stays a write target, but only when that
 *     directory exists; a missing one is refused the same typed way instead of
 *     failing later as an opaque no_room_db.
 *   - 'none' is refused.
 *
 * 369.25 plan 13 (HEAL-02, brief failure test 1): after the resolution, the room must also be able to hold the
 * write. lib/core/room-readiness.cjs readinessFor(dir, 'governed_write') is asked once; a room whose room.db is
 * missing (in a folder with .room-root), unreadable or not writable is refused room_not_ready, with not_ready_reason,
 * the failed requirement in plain words, a remediation, and (for recover_room_record, when the session has an
 * identity to answer with) a recovery card whose approval runs the heal net (lib/mcp/room-readiness-gate.cjs). A
 * room that is only missing its identity (a legacy room) is NOT refused: the result's room_identity shows the
 * requirement and carries the same one card. The plugin never changes permissions.
 *
 * @param {{sessionId?: string, ctx?: {fallbackRoomDir?: string, surface?: string},
 *   walkUp?: boolean}} [opts] walkUp: true adds the `.room-root` cwd walk-up leg
 *   (the tool-router write sites have always had it); false keeps the read-side
 *   ladder the nine tool modules have always used.
 * @returns {{ok: true, dir: string, slug: string|null, source: string,
 *      room_id: string|null, room_identity: {state: string, reason?: string, requirement?: string,
 *      recovery_gate_id?: string}|null}
 *   | {ok: false, dir: null, slug: null, source: string,
 *      refusal: {ok: false, reason: string, message: string}}
 *   | {ok: false, dir: string, slug: string|null, source: string, room_id: string|null, room_identity: object|null,
 *      refusal: {ok: false, reason: 'room_not_ready', not_ready_reason: string, requirement: string,
 *      remediation: string, message: string, recovery_gate_id?: string, recovery_card?: object}}}
 */
function resolveMcpWriteRoom(opts) {
  const o = (opts && typeof opts === 'object') ? opts : {};
  const sessionId = o.sessionId;
  const walkUp = o.walkUp === true;
  const hit = resolveMcpSessionRoom({ sessionId: sessionId, ctx: o.ctx, forWrite: walkUp, quiet: true });
  const hasIdentity = typeof sessionId === 'string' && sessionId.length > 0;

  let refuse = false;
  if (hit.source === 'reg.active' && hasIdentity && !isOperatorPinnedRoom(hit)) {
    refuse = true;
  } else if (hit.source === 'boot-fallback') {
    let exists = false;
    try { exists = !!hit.dir && fs.existsSync(hit.dir); } catch (_e) { exists = false; }
    refuse = !exists;
  } else if (hit.source === 'none') {
    refuse = true;
  }

  if (refuse) {
    return {
      ok: false,
      dir: null,
      slug: null,
      source: hit.source,
      refusal: { ok: false, reason: NO_BOUND_ROOM, message: NO_BOUND_ROOM_MESSAGE },
    };
  }

  if (hit.source === 'reg.active') {
    // Reached only for a carve-out: a session-less caller (it cannot bind) or an
    // operator-pinned room still lands via the 'reg.active' leg. Trace it, as the
    // forWrite leg always did.
    try {
      process.stderr.write(
        MCP_FIRST_DEPRECATED_ACTIVE_WRITE + ' session=' + String(sessionId) + ' room=' + hit.slug + '\n'
      );
    } catch (_logErr) { /* stderr write failure never blocks the write */ }
  }
  const raw = readIdentityRaw(hit.dir);
  const ident = identityFromRaw(raw);
  const rdMod = loadReadinessMod();
  const readiness = (rdMod && typeof rdMod.readinessFor === 'function')
    ? rdMod.readinessFor(hit.dir, 'governed_write', { identity: raw })
    : null;
  if (readiness && readiness.state === 'not_ready') {
    // The recovery card is offered only to a session that can answer it (it has an identity), and only for a
    // reason the heal net repairs; restore_write_permission is a person's action and never gets a card.
    let card = null;
    if (readiness.remediation === 'recover_room_record' && hasIdentity && readiness.reason !== 'identity_path_mismatch') {
      const gm = loadRecoveryGateMod();
      if (gm && typeof gm.mintRecoveryGate === 'function') {
        const minted = gm.mintRecoveryGate({ roomDir: hit.dir, sessionId: sessionId, readiness: readiness });
        if (minted && minted.ok === true) card = minted;
      }
    }
    if (readiness.blocking) {
      const refusal = {
        ok: false,
        reason: ROOM_NOT_READY,
        not_ready_reason: readiness.reason,
        requirement: readiness.requirement,
        remediation: readiness.remediation,
        message: readiness.requirement + '. Nothing was written. ' + (
          readiness.remediation === 'restore_write_permission'
            ? 'Restore write permission on the room folder, then retry.'
            : (card
              ? 'Answer the recovery card to rebuild the room record, then retry.'
              : 'Rebuild the room record with /mos:graph --derive (it asks first), then retry.')),
      };
      if (card) { refusal.recovery_gate_id = card.gate_id; refusal.recovery_card = card.card; }
      return {
        ok: false, dir: hit.dir, slug: hit.slug, source: hit.source,
        room_id: ident.room_id, room_identity: ident.room_identity,
        refusal: refusal,
      };
    }
    // Not ready but this operation does not need the missing piece (a legacy room whose identity is absent): the
    // write goes ahead and its result shows the gap, with the one card for the session when it can be offered.
    const shown = Object.assign({}, ident.room_identity, { requirement: readiness.requirement });
    if (card) shown.recovery_gate_id = card.gate_id;
    return {
      ok: true, dir: hit.dir, slug: hit.slug, source: hit.source,
      room_id: ident.room_id, room_identity: shown,
    };
  }
  return {
    ok: true, dir: hit.dir, slug: hit.slug, source: hit.source,
    room_id: ident.room_id, room_identity: ident.room_identity,
  };
}

/**
 * claimSessionRefusal() -- the typed refusal a CLAIM write returns when the
 * connection has no session identity at all (navigator ruling point 4: the id
 * prefix `claim:nosession:` must not be producible for a write that lands in a
 * room). A claim node id is keyed by session; an anonymous one would collide
 * across every session that files the same segment. A fresh object each call.
 *
 * @returns {{ok: false, reason: string, message: string}}
 */
function claimSessionRefusal() {
  return {
    ok: false,
    reason: 'no_session_id',
    message: 'This connection has no session identity, so the claim was not filed: a claim id is keyed by '
      + 'session, and an anonymous one would collide across sessions. Use a connection that carries a '
      + 'session (a stdio server mints one per window).',
  };
}

/**
 * describeRoomBinding(resolution, opts) -- the label a READ response carries so a
 * registry-fallback room is never mistaken for a binding (navigator ruling,
 * point 2). Takes the { dir, slug, source } resolveMcpSessionRoom returns (a
 * resolveMcpWriteRoom result also works: its room_id and room_identity are used
 * as given). 369.25 RID-06: it also reports the room id and the identity state,
 * read through readRoomIdentity (door in_place); a fallback note names the
 * fallback room and, when known, its id. opts.identity ({room_id, room_identity})
 * overrides the read. dir null -> room_id null, identity null. Never throws.
 *
 * @param {{dir?: string|null, slug?: string|null, source?: string,
 *   room_id?: string|null, room_identity?: object|null}} resolution
 * @param {{identity?: {room_id: string|null, room_identity: object|null}}} [opts]
 * @returns {{bound: boolean, source: string, registry_fallback: boolean,
 *   slug: string|null, room_id: string|null, identity: object|null,
 *   operator_pinned?: boolean, note?: string}}
 */
function describeRoomBinding(resolution, opts) {
  const r = (resolution && typeof resolution === 'object') ? resolution : {};
  const o = (opts && typeof opts === 'object') ? opts : {};
  const source = typeof r.source === 'string' ? r.source : 'none';
  const bound = source === 'session.primary' || source === 'room-root';
  const pinned = isOperatorPinnedRoom(r);
  const hasDir = typeof r.dir === 'string' && r.dir.length > 0;
  let ident;
  if (o.identity && typeof o.identity === 'object') {
    ident = {
      room_id: typeof o.identity.room_id === 'string' ? o.identity.room_id : null,
      room_identity: (o.identity.room_identity && typeof o.identity.room_identity === 'object') ? o.identity.room_identity : null,
    };
  } else if (!hasDir) {
    ident = { room_id: null, room_identity: null };
  } else if (Object.prototype.hasOwnProperty.call(r, 'room_identity') && r.room_identity) {
    ident = { room_id: typeof r.room_id === 'string' ? r.room_id : null, room_identity: r.room_identity };
  } else {
    ident = identityFor(r.dir);
  }
  const slug = typeof r.slug === 'string' ? r.slug : null;
  const roomWords = slug
    ? ' (room ' + slug + (ident.room_id ? ', id ' + ident.room_id : '') + ')'
    : (ident.room_id ? ' (id ' + ident.room_id + ')' : '');
  const label = pinned ? 'the room pinned for this server by CLAUDE_ACTIVE_ROOM' + roomWords : {
    'reg.active': 'the registry fallback' + (roomWords || ' (the registry active room)'),
    'boot-fallback': 'the server default room (a fallback)' + roomWords,
    'cwd': 'the working directory (a fallback)' + roomWords,
    'none': 'no room',
  }[source] || 'a fallback room' + roomWords;
  const out = {
    bound: bound,
    source: source,
    registry_fallback: source === 'reg.active' && !pinned,
    slug: slug,
    room_id: ident.room_id,
    identity: ident.room_identity,
  };
  if (pinned) out.operator_pinned = true;
  if (!bound) {
    out.note = 'No room is bound to this session. Showing ' + label + ', not a binding. '
      + 'Call room_bind to bind a room.';
  }
  return out;
}

module.exports = {
  resolveMcpSessionRoom,
  resolveSessionRoomDir,
  resolveMcpWriteRoom,
  describeRoomBinding,
  claimSessionRefusal,
  MCP_FIRST_DEPRECATED_ACTIVE_WRITE,
  NO_BOUND_ROOM,
  NO_BOUND_ROOM_MESSAGE,
  ROOM_NOT_READY,
};
