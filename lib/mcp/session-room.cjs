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
// graph-chokepoint token -- this module never opens room.db.
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
 * @param {{sessionId?: string, ctx?: {fallbackRoomDir?: string, surface?: string},
 *   walkUp?: boolean}} [opts] walkUp: true adds the `.room-root` cwd walk-up leg
 *   (the tool-router write sites have always had it); false keeps the read-side
 *   ladder the nine tool modules have always used.
 * @returns {{ok: true, dir: string, slug: string|null, source: string}
 *   | {ok: false, dir: null, slug: null, source: string,
 *      refusal: {ok: false, reason: string, message: string}}}
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
  return { ok: true, dir: hit.dir, slug: hit.slug, source: hit.source };
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
 * describeRoomBinding(resolution) -- the label a READ response carries so a
 * registry-fallback room is never mistaken for a binding (navigator ruling,
 * point 2). Pure; takes the { dir, slug, source } resolveMcpSessionRoom returns.
 *
 * @param {{dir?: string|null, slug?: string|null, source?: string}} resolution
 * @returns {{bound: boolean, source: string, registry_fallback: boolean,
 *   slug: string|null, operator_pinned?: boolean, note?: string}}
 */
function describeRoomBinding(resolution) {
  const r = (resolution && typeof resolution === 'object') ? resolution : {};
  const source = typeof r.source === 'string' ? r.source : 'none';
  const bound = source === 'session.primary' || source === 'room-root';
  const pinned = isOperatorPinnedRoom(r);
  const label = pinned ? 'the room pinned for this server by CLAUDE_ACTIVE_ROOM' : {
    'reg.active': 'the registry fallback (the registry active room)',
    'boot-fallback': 'the server default room (a fallback)',
    'cwd': 'the working directory (a fallback)',
    'none': 'no room',
  }[source] || 'a fallback room';
  const out = {
    bound: bound,
    source: source,
    registry_fallback: source === 'reg.active' && !pinned,
    slug: typeof r.slug === 'string' ? r.slug : null,
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
};
