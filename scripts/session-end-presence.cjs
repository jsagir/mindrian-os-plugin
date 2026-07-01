#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 194-07 (PSB-13 / D-08) -- SessionEnd presence deregister (clean-on-end).
 * =========================================================================
 * D-08 mandates BOTH teardown paths: this is the GRACEFUL half. On SessionEnd,
 * for each room in THIS session's bound SET, unlink the session's presence file
 * so the per-room presence ledger self-cleans on a clean exit. The other half
 * (crash coverage) is the doctor-cadence stale-reap (scripts/doctor.cjs
 * --bind-check -> session-presence.reap), which drops a dead-pid or aged entry a
 * crashed session could never remove itself.
 *
 * Contract:
 *   - idempotent: a presence file already gone is a no-op (deregisterPresence
 *     swallows ENOENT).
 *   - never throws: a parse or enumeration error is swallowed; the SessionEnd
 *     hook must never crash a session teardown.
 *   - LOCAL only (Part 8): reads the session binding file and unlinks presence
 *     files. ZERO Brain egress, zero network token.
 *
 * No em-dashes. No emoji. No Brain call.
 * License: BSL 1.1.
 */

const path = require('node:path');
const sessionBinding = require(path.join(__dirname, '..', 'lib', 'core', 'session-binding.cjs'));
const sessionPresence = require(path.join(__dirname, '..', 'lib', 'core', 'session-presence.cjs'));

// The reserved dev-repo / no-room sentinel. A session bound to it writes nowhere
// room-scoped, so there is no presence file to remove for it.
const NO_ROOM_SLUG = '__no_room__';

// deregisterAll({ sessionId, home }) -> { deregistered: [slug, ...] }.
// Reads readSessionBinding(sessionId).bound and, for each bound room (skipping
// the __no_room__ sentinel), removes the session's presence file. Wrapped so it
// NEVER throws out of the hook.
function deregisterAll(opts) {
  const out = { deregistered: [] };
  try {
    const sessionId = opts && opts.sessionId;
    if (typeof sessionId !== 'string' || sessionId.length === 0) return out;
    const home = (opts && typeof opts.home === 'string' && opts.home.length > 0) ? opts.home : undefined;

    const binding = sessionBinding.readSessionBinding(sessionId, { home: home });
    const bound = Array.isArray(binding.bound) ? binding.bound : [];
    for (const slug of bound) {
      if (typeof slug !== 'string' || slug.length === 0) continue;
      if (slug === NO_ROOM_SLUG) continue;
      try {
        sessionPresence.deregisterPresence({ room: slug, home: home, sessionId: sessionId });
        out.deregistered.push(slug);
      } catch (_) {
        // Idempotent per room; a single-room failure never aborts the sweep.
      }
    }
  } catch (_) {
    // Never throw out of the SessionEnd hook (fail-silent teardown).
  }
  return out;
}

// Born WIRED (Part 11): invoked as the SessionEnd hook. Resolve the session id
// and rooms-home from the environment (the shipped CLAUDE_SESSION_ID convention
// mirrored across the 194 session surfaces); home falls through to the
// session-binding / session-presence resolveHome default when absent.
if (require.main === module) {
  try {
    const sessionId = process.env.CLAUDE_SESSION_ID || '';
    const home = process.env.MINDRIAN_ROOMS_HOME || process.env.MINDRIAN_ROOMS_ROOT || undefined;
    if (sessionId) deregisterAll({ sessionId: sessionId, home: home });
  } catch (_) {
    // Fail-silent: a teardown hook never crashes the session.
  }
  process.exit(0);
}

module.exports = { deregisterAll: deregisterAll };
