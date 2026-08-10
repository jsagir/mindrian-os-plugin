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
// No em-dashes. CJS only.

const { resolveSessionRoom, resolveWriteRoom } = require('../core/resolve-active-room.cjs');

// The stable stderr token for the D-04 compat-shim deprecation log (SPEC-1
// acceptance, Part 11 threat T-198-08), moved here verbatim from
// tool-router.cjs (its former sole owner). Grepped verbatim by prior
// acceptance criteria (198-02); never rename without updating every
// consumer.
const MCP_FIRST_DEPRECATED_ACTIVE_WRITE = 'MCP_FIRST_DEPRECATED_ACTIVE_WRITE';

/**
 * resolveMcpSessionRoom(opts) -- the ONE shared MCP room resolver.
 *
 * @param {{sessionId?: string, ctx?: {fallbackRoomDir?: string, surface?: string},
 *   forWrite?: boolean, noFloor?: boolean}} [opts]
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
    if (forWrite && hit.source === 'reg.active') {
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

module.exports = {
  resolveMcpSessionRoom,
  resolveSessionRoomDir,
  MCP_FIRST_DEPRECATED_ACTIVE_WRITE,
};
