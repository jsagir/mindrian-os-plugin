#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 160-01 Task 2 -- SessionStart reference-now seeder.
 * ========================================================
 *
 * On SessionStart this seeds the LOCAL reference-now seam
 * (~/.mindrian/reference-now.json) with a Date.now() FLOOR if the seam is
 * absent or stale-by-session (D-01). It OPTIONALLY kicks the NTP-style skew
 * corrector (fetchTimeOffsetOnce, fire-once-per-session) which degrades
 * silently when offline.
 *
 * This is the FLOOR half of the D-01 hybrid: the hook seeds Date.now() because
 * hook subprocesses may not receive Claude Code's injected `currentDate` in
 * stdin. Larry corrects the calendar DATE via /mos:correct-reference-now when
 * the model-known date diverges from the seeded floor (the other half).
 *
 * Canon Part 8 (Graph Boundary): pure LOCAL bookkeeping. ZERO Brain query,
 * ZERO room-data read. The only network surface is the OPTIONAL skew corrector
 * (a bare GET reading only the HTTP Date header, zero user bytes), which is
 * non-blocking and degrades to null on any failure -- it never blocks the hook
 * (T-160-03). Canon Part 9: the seam is a LOCAL file, not a memory_event; this
 * seeder writes no graph nodes.
 *
 * Canon Part 7 (Reuse Before Build): all seam logic lives in
 * lib/core/temporal/reference-now.cjs; this seeder is a thin SessionStart shell
 * over readSeam/writeSeam/fetchTimeOffsetOnce.
 *
 * House rule: hyphens only, no em-dashes. Pure CJS, node built-ins only.
 */

const crypto = require('node:crypto');

// Lazy/tolerant require so a missing core module never crashes SessionStart.
let refNow = null;
try {
  refNow = require('../lib/core/temporal/reference-now.cjs');
} catch (_err) {
  refNow = null;
}

// A per-session id. Claude Code does not hand the seeder a stable session token
// in stdin, so we derive a coarse session key from the current UTC hour. This
// gives the "fire-once-per-session" skew fetch a natural debounce (at most once
// per hour) without a network call every session boundary.
function deriveSessionId() {
  const envSession = process.env.CLAUDE_SESSION_ID || process.env.MINDRIAN_SESSION_ID;
  if (typeof envSession === 'string' && envSession.length > 0) return envSession;
  const hourBucket = Math.floor(Date.now() / (60 * 60 * 1000));
  return 'auto-' + hourBucket;
}

/*
 * seedReferenceNow(opts) -> { seeded, source, offsetTried }.
 * Pure LOCAL. opts.seamPath / opts.now / opts.fetchImpl / opts.sessionId are
 * test seams; production uses the defaults.
 */
function seedReferenceNow(opts) {
  const o = opts && typeof opts === 'object' ? opts : {};
  if (!refNow) return { seeded: false, source: 'unavailable', offsetTried: false };

  const nowFn = typeof o.now === 'function' ? o.now : Date.now;
  const seamPath = typeof o.seamPath === 'string' ? o.seamPath : undefined;
  const sessionId = typeof o.sessionId === 'string' ? o.sessionId : deriveSessionId();

  let seeded = false;
  let source = 'existing';
  try {
    const existing = refNow.readSeam(seamPath);
    const stale = !existing
      || typeof existing.floorMs !== 'number'
      || existing.lastFetchSession !== sessionId;
    if (stale) {
      // Seed the Date.now() floor (D-01). Preserve any existing offset so a
      // prior skew correction is not lost across the re-seed.
      const floorMs = nowFn();
      const partial = { floorMs: floorMs, source: 'date_now', lastFetchSession: sessionId };
      if (existing && typeof existing.offsetMs === 'number') partial.offsetMs = existing.offsetMs;
      const w = refNow.writeSeam(seamPath, partial);
      seeded = !!(w && w.ok);
      source = 'date_now';
    }
  } catch (_err) {
    // Tolerant: a seam write failure must never crash SessionStart.
    seeded = false;
  }

  return { seeded, source, offsetTried: false, sessionId };
}

/*
 * kickSkewCorrector(opts) -> Promise<number|null>. OPTIONAL, non-blocking.
 * Fires fetchTimeOffsetOnce (fire-once-per-session) and swallows everything.
 * The caller does NOT await this in the hot path (T-160-03 DoS mitigation).
 */
async function kickSkewCorrector(opts) {
  const o = opts && typeof opts === 'object' ? opts : {};
  if (!refNow || typeof refNow.fetchTimeOffsetOnce !== 'function') return null;
  try {
    return await refNow.fetchTimeOffsetOnce({
      seamPath: typeof o.seamPath === 'string' ? o.seamPath : undefined,
      now: typeof o.now === 'function' ? o.now : undefined,
      fetchImpl: typeof o.fetchImpl === 'function' ? o.fetchImpl : undefined,
      sessionId: typeof o.sessionId === 'string' ? o.sessionId : deriveSessionId(),
    });
  } catch (_err) {
    return null;
  }
}

// ---------- CLI / hook entry ----------
// SessionStart invokes this script directly. It must NEVER throw and must NEVER
// block on the network. Seed synchronously (LOCAL), then fire-and-forget the
// optional skew corrector without awaiting it in a way that delays exit.
if (require.main === module) {
  try {
    seedReferenceNow();
    // Fire-and-forget the skew corrector. We do not await it; the process exits
    // naturally and the offset (if it lands) is persisted to the seam for the
    // next session. Any rejection is swallowed.
    const p = kickSkewCorrector();
    if (p && typeof p.then === 'function') {
      p.catch(() => {});
    }
  } catch (_err) {
    // Absolute non-fatal: SessionStart must not be blocked by seeding.
  }
  // Emit nothing to stdout (no SessionStart additionalContext from the seeder).
}

module.exports = {
  seedReferenceNow,
  kickSkewCorrector,
  deriveSessionId,
};
