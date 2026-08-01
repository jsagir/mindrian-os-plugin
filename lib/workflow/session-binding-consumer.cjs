'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 194-04 -- session-binding-consumer: the F.8 gate SINK + decision (PSB-05/06).
 * ============================================================================
 * The F.8 multi-select binding gate needs ONE thing the shipped fan-out consumer
 * does NOT provide: a SESSION-FILE sink. consumeF8Fanout (f8-fanout-consumer.cjs:174)
 * loops the confirmed set and calls closeOffer PER ITEM writing graph EDGES -- the
 * WRONG sink for a binding decision. This module MIRRORS that loop structure but
 * swaps the sink to session-binding.writeSessionBinding: 1 confirm -> 1 session
 * binding {bound SET, primary, sticky} written to the LOCAL session file. The SHAPE
 * (renderShapeF8) and CAPTURE (captureCliActionSet) are composed VERBATIM upstream by
 * the caller (scripts/intent-classifier.cjs) -- this is the documented Tri-Polar
 * split (f8-action-capture-cli.cjs:7-9): shared shape+capture, NEW sink. Part 11
 * born-wired: NO new selector shape is minted here; the render-coverage predicate
 * stays green.
 *
 * Two exports:
 *   consumeSessionBinding({picks, primaryPick, sticky, sessionId, home}) -- captures
 *     the confirmed F.8 set and WRITES the session binding file. Per NEWLY-bound room
 *     (a slug in the new set that was not in the prior binding) it runs the bind-time
 *     room-health check + presence register, GUARDED so a missing module or a fault is
 *     a clean no-op (never hard-depends on either, never blocks the bind). The reserved
 *     dev-repo/no-room sentinel `__no_room__` is a first-class bindable pick (it fixes
 *     the false plugin-CLAUDE.md write-block, D-03/D-04) and is skipped for the
 *     room-scoped health/presence job because it names no room directory.
 *   runBindingGate({sessionId, topRoom, home, readSessionBinding?}) -- the pure gate
 *     decision the classifier tripwire asks before rendering: on-scope (top room in
 *     bound) -> silence; unbound/off-scope -> fire the F.8 gate. `readSessionBinding`
 *     is an injectable test seam. Every leg FAILS OPEN (PSB-06): any thrown error
 *     returns {degraded:true, blocked:false} so the turn is NEVER hard-blocked -- it
 *     degrades to the pre-194 racy advisory (the 83-07 never-block contract).
 *
 * Canon Part 8 (LOCAL only): this writes a local JSON file and reads local session
 * state ONLY. ZERO Brain egress, zero network token (the Part 8 source-grep floor
 * greps this module first). Pure CJS, node built-ins only, zero new dependencies.
 * No em-dashes. No emoji.
 *
 * License: BSL 1.1.
 */

const path = require('node:path');
const os = require('node:os');

const REPO = path.resolve(__dirname, '..', '..');

// The reserved dev-repo/no-room sentinel. A first-class bindable pick (D-03/D-04):
// a session that chose dev-repo binds this slug and stops re-firing the gate, and
// it does NOT resolve to a real room directory (so the room-scoped bind-time health
// + presence job skips it).
const NO_ROOM = '__no_room__';

// Lazy + tolerant require (mirrors f8-fanout-consumer._safeRequire): a dependency
// load failure degrades to null rather than crashing the turn.
function _safeRequire(p) {
  try {
    return require(p);
  } catch (_e) {
    return null;
  }
}

// Home resolution mirrors session-binding.resolveHome (kept local to avoid coupling
// to a non-exported helper). Used only to compose a roomDir for the bind-time job.
function _resolveHome(home) {
  if (typeof home === 'string' && home.length > 0) return home;
  const env = process.env.MINDRIAN_ROOMS_HOME || process.env.MINDRIAN_ROOMS_ROOT;
  if (typeof env === 'string' && env.length > 0) return env;
  return path.join(os.homedir(), 'MindrianRooms');
}

// Per newly-bound room, run the bind-time room-health check + presence register. Both
// are GUARDED and fire-and-forget by construction. Never throws (the caller already
// runs inside a try/catch, this is defense-in-depth).
function _bindTimeJob(slug, sessionId, home) {
  const roomDir = path.join(_resolveHome(home), slug);

  // Bind-time room-health check (D-10). Phase 194-07 Wave 5 planned this as an
  // exported doctor.bindTimeCheck and that export never shipped, so until now this
  // branch was dead code behind a permanently-false `typeof doctor.bindTimeCheck ===
  // 'function'` guard (RCA statusline-room-health-chip-never-updates). It now calls
  // the SAME in-process job the room_bind MCP tool calls, so there is exactly ONE
  // honest bind-time health path instead of two differently-broken ones. Still fully
  // guarded: a missing module or a fault is a clean no-op and NEVER blocks the bind.
  // Canon Part 8: LOCAL only, zero Brain egress.
  try {
    const roomHealth = _safeRequire(path.join(REPO, 'lib', 'statusline', 'room-health-cache.cjs'));
    if (roomHealth && typeof roomHealth.runBindHealthCheck === 'function') {
      roomHealth.runBindHealthCheck({
        sessionId: sessionId,
        room: slug,
        roomDir: roomDir,
        home: _resolveHome(home),
      });
    }
  } catch (_e) { /* health is advisory -> no-op, never block the bind */ }

  // Presence register (D-10b): mark this session live in the newly-bound room.
  try {
    const presence = _safeRequire(path.join(REPO, 'lib', 'core', 'session-presence.cjs'));
    if (presence && typeof presence.registerPresence === 'function') {
      presence.registerPresence({ sessionId: sessionId, roomDir: roomDir });
    }
  } catch (_e) { /* fire-and-forget */ }
}

// ---------------------------------------------------------------------------
// consumeSessionBinding({ picks, primaryPick, sticky, sessionId, home })
//   -> { ok, degraded, bound?, primary?, sticky?, newlyBound? }
//
// picks:       the CONFIRMED toggle SET (an array of room slugs) captured from the
//              F.8 answer by captureCliActionSet upstream. May include NO_ROOM.
// primaryPick: the single-select default write target (or null).
// sticky:      the "remember for this session" toggle (bool).
// sessionId:   the session file key.
// home:        the rooms home (test seam / explicit override).
//
// Mirrors the consumeF8Fanout loop shape, swaps the sink to writeSessionBinding: ONE
// confirm writes ONE binding. A write / dependency failure is swallowed and returns
// a soft {ok:false, degraded:true} -- it NEVER throws back to the hook (PSB-06).
// ---------------------------------------------------------------------------
function consumeSessionBinding(args) {
  try {
    const a = (args && typeof args === 'object') ? args : {};
    const picks = Array.isArray(a.picks)
      ? a.picks.filter(function (p) { return typeof p === 'string' && p.length > 0; })
      : [];
    const primaryPick = (typeof a.primaryPick === 'string' && a.primaryPick.length > 0)
      ? a.primaryPick
      : null;
    const sticky = a.sticky === true;
    const sessionId = a.sessionId;
    const home = (typeof a.home === 'string' && a.home.length > 0) ? a.home : undefined;

    const sb = _safeRequire(path.join(REPO, 'lib', 'core', 'session-binding.cjs'));
    if (!sb || typeof sb.writeSessionBinding !== 'function') {
      return { ok: false, degraded: true, reason: 'sink_unavailable' };
    }

    // Read the prior binding to compute the NEWLY-bound rooms (for the bind-time job).
    let prior = [];
    try {
      const p = sb.readSessionBinding(sessionId, { home: home });
      prior = (p && Array.isArray(p.bound)) ? p.bound : [];
    } catch (_e) {
      prior = [];
    }
    const priorSet = new Set(prior);

    // THE SINK SWAP: instead of closeOffer(closeArgs) per item (graph edges), write
    // the confirmed SET + primary + sticky to the session file in ONE call. The
    // set-dedupe + traversal-slug drop is owned by writeSessionBinding (Wave 1).
    sb.writeSessionBinding(
      sessionId,
      { bound: picks, primary: primaryPick, sticky: sticky },
      { home: home }
    );

    // Per newly-bound room (in the new set, not in the prior set), fire the guarded
    // bind-time job. NO_ROOM is bindable but names no directory, so it is skipped.
    const newlyBound = [];
    for (const slug of picks) {
      if (slug === NO_ROOM) continue;
      if (priorSet.has(slug)) continue;
      newlyBound.push(slug);
    }
    for (const slug of newlyBound) {
      _bindTimeJob(slug, sessionId, home);
    }

    return {
      ok: true,
      degraded: false,
      bound: picks,
      primary: primaryPick,
      sticky: sticky,
      newlyBound: newlyBound,
    };
  } catch (_e) {
    // Fail OPEN: any unexpected failure returns a soft result and NEVER throws back
    // into the hook (PSB-06 / the 83-07 never-block contract).
    return { ok: false, degraded: true };
  }
}

// ---------------------------------------------------------------------------
// runBindingGate({ sessionId, topRoom, home, readSessionBinding? })
//   -> { degraded, blocked, onScope, fire, bound }
//
// The pure gate decision the intent-classifier tripwire asks BEFORE rendering:
//   - on-scope (topRoom is a MEMBER of the session's bound SET) -> onScope:true,
//     fire:false: the classifier stays SILENT (the spurious-warning fix).
//   - unbound / off-scope -> onScope:false, fire:true: the classifier renders the
//     F.8 binding gate instead of the legacy single-active-room warning.
//   - any thrown error -> degraded:true, blocked:false, fire:false: FAIL OPEN. The
//     turn is never hard-blocked; the classifier falls back to the legacy advisory
//     (PSB-06 / the 83-07 never-block contract).
//
// `readSessionBinding` is an injectable test seam. When absent, the decision routes
// through the shipped resolve-active-room.resolveSessionScope (the ONE on-scope test,
// D-02) so session precedence lives in exactly one place.
// ---------------------------------------------------------------------------
function runBindingGate(args) {
  const a = (args && typeof args === 'object') ? args : {};
  const sessionId = a.sessionId;
  const topRoom = a.topRoom;
  const home = (typeof a.home === 'string' && a.home.length > 0) ? a.home : undefined;

  try {
    // Test seam: an injected reader short-circuits the shipped resolver path so a
    // poisoned reader can prove the fail-open contract WITHOUT a live session file.
    if (typeof a.readSessionBinding === 'function') {
      const b = a.readSessionBinding(sessionId, { home: home });
      const bound = (b && Array.isArray(b.bound)) ? b.bound : [];
      const onScope = bound.indexOf(topRoom) !== -1;
      return { degraded: false, blocked: false, onScope: onScope, fire: !onScope, bound: bound };
    }

    // Production path: the ONE session-scope test (D-02). Never mints a second
    // single-active-room brain.
    const rar = _safeRequire(path.join(REPO, 'lib', 'core', 'resolve-active-room.cjs'));
    if (rar && typeof rar.resolveSessionScope === 'function') {
      const scope = rar.resolveSessionScope({ sessionId: sessionId, topRoom: topRoom, home: home });
      const onScope = scope && scope.onScope === true;
      const bound = (scope && Array.isArray(scope.bound)) ? scope.bound : [];
      return { degraded: false, blocked: false, onScope: onScope, fire: !onScope, bound: bound };
    }

    // Fallback: read the binding directly if the resolver is unavailable.
    const sb = _safeRequire(path.join(REPO, 'lib', 'core', 'session-binding.cjs'));
    const b = (sb && typeof sb.readSessionBinding === 'function')
      ? sb.readSessionBinding(sessionId, { home: home })
      : null;
    const bound = (b && Array.isArray(b.bound)) ? b.bound : [];
    const onScope = bound.indexOf(topRoom) !== -1;
    return { degraded: false, blocked: false, onScope: onScope, fire: !onScope, bound: bound };
  } catch (_e) {
    // FAIL OPEN: an unreadable / poisoned session state NEVER blocks the turn. The
    // classifier degrades to the pre-194 racy advisory instead of a lockout.
    return { degraded: true, blocked: false, onScope: false, fire: false, bound: [] };
  }
}

module.exports = {
  consumeSessionBinding: consumeSessionBinding,
  runBindingGate: runBindingGate,
  NO_ROOM: NO_ROOM,
};
