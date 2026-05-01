#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 103-05 -- Memory resume nudge (SessionStart hook).
 *
 * Emits a one-line resume proposal in Larry's SessionStart greeting IF AND ONLY IF:
 *   1. Across-session memory is enabled (no .opt-out sentinel).
 *   2. At least one room has an in_flight JTBD with last_seen < 7 days.
 *   3. The current room is NOT the most-recent in_flight room (no nudge needed).
 *
 * Three recency variants per RESEARCH §6 (today / 1-3d / 4-7d).
 * Voice matches references/personality/voice-dna.md cadence (terse, declarative,
 * no I, no apology).
 *
 * Defensive backfill (Pitfall 7 mitigation): walks registry, applies
 * promoteIfEligible to each room's within-session state to catch missed Stop-hook
 * promotions from crashed sessions. Silent on every error path.
 *
 * Graceful degradation: try/catch + exit 0. NEVER blocks Larry's turn.
 *
 * License: BSL 1.1.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

function emitNudge() {
  try {
    let acrossSession;
    try { acrossSession = require('../lib/hmi/across-session-memory.cjs'); }
    catch (_) { return; }

    if (typeof acrossSession.isGlobalOptOut === 'function' && acrossSession.isGlobalOptOut()) {
      return;
    }

    // Defensive backfill (Pitfall 7): scan all rooms in registry, apply
    // promoteIfEligible to each room's current within-session state. Catches
    // promotions missed by crashed Stop hooks.
    backfillFromWithinSession(acrossSession);

    // Get candidates (in_flight, last_seen < 7d).
    if (typeof acrossSession.listInFlight !== 'function') return;
    const candidates = acrossSession.listInFlight(7) || [];
    if (candidates.length === 0) return;

    // Filter out the current room (no cross-room nudge if you're already there).
    const currentRoom = getCurrentRoomSlug();
    const cross = candidates.filter(c => c && c.room && c.room !== currentRoom);
    if (cross.length === 0) return;

    // listInFlight already sorted desc by last_seen.
    const top = cross[0];
    const lastSeenMs = Date.parse(top.last_seen);
    if (!Number.isFinite(lastSeenMs)) return;
    const ageMs = Date.now() - lastSeenMs;
    const ONE_DAY = 24 * 60 * 60 * 1000;
    const ageDays = Math.floor(ageMs / ONE_DAY);

    // Three recency variants per RESEARCH §6 + voice-dna.md (terse, no I, no apology).
    if (ageMs < ONE_DAY) {
      process.stdout.write('Last move: ' + top.jtbd + ' in ' + top.room + ' (yesterday).\n');
      process.stdout.write('▶ /mos:memory resume\n');
    } else if (ageDays <= 3) {
      const dayWord = ageDays === 1 ? 'day' : 'days';
      process.stdout.write('Open job: ' + top.jtbd + ' in ' + top.room +
        ', last touched ' + ageDays + ' ' + dayWord + ' ago.\n');
      process.stdout.write('▶ /mos:memory resume\n');
    } else if (ageDays <= 7) {
      process.stdout.write('Stale job: ' + top.jtbd + ' in ' + top.room +
        ' (' + ageDays + ' days). Park or resume?\n');
      process.stdout.write('▶ /mos:memory resume\n');
      process.stdout.write('▷ /mos:memory park ' + top.jtbd + '\n');
    }
    // > 7 days: silent (per D-11).
  } catch (err) {
    try { process.stderr.write('[memory-resume-nudge] error: ' +
      String(err && err.message ? err.message : err).slice(0, 200) + '\n'); }
    catch (_) { /* swallow logger error */ }
  }
}

// backfillFromWithinSession -- scan every room in the registry; for each,
// read within-session jtbd-state and apply promoteIfEligible. Mitigates
// Pitfall 7 (missed Stop-hook promotions from crashed sessions). Silent.
function backfillFromWithinSession(acrossSession) {
  try {
    if (typeof acrossSession.promoteIfEligible !== 'function') return;
    const home = process.env.MINDRIAN_ROOMS_HOME || path.join(os.homedir(), 'MindrianRooms');
    const registryPath = path.join(home, '.rooms', 'registry.json');
    if (!fs.existsSync(registryPath)) return;
    let registry;
    try { registry = JSON.parse(fs.readFileSync(registryPath, 'utf8')); }
    catch (_) { return; }
    const rooms = (registry && Array.isArray(registry.rooms)) ? registry.rooms : [];
    let jtbdState = null;
    try { jtbdState = require('../lib/hmi/jtbd-state.cjs'); }
    catch (_) { return; }
    if (!jtbdState || typeof jtbdState.getCurrent !== 'function') return;

    for (let i = 0; i < rooms.length; i++) {
      const r = rooms[i];
      if (!r || !r.slug) continue;
      const slug = r.slug;
      // Two registry conventions: prefer abs_path, fall back to path (relative or absolute).
      const candidate = (typeof r.abs_path === 'string' && r.abs_path) ||
                        (typeof r.path === 'string' && r.path) || null;
      if (!candidate) continue;
      const roomDir = path.isAbsolute(candidate) ? candidate : path.join(home, candidate);
      try {
        if (typeof acrossSession.isRoomOptOut === 'function' && acrossSession.isRoomOptOut(slug)) continue;
        const cur = jtbdState.getCurrent(roomDir);
        if (!cur || !cur.jtbd || cur.jtbd === 'explore') continue;
        const hist = (typeof jtbdState.history === 'function') ? jtbdState.history(roomDir, 50) : [];
        acrossSession.promoteIfEligible(slug, { current: cur, history: hist });
      } catch (_) { /* per-room graceful */ }
    }
  } catch (_) { /* graceful */ }
}

function getCurrentRoomSlug() {
  try {
    const home = process.env.MINDRIAN_ROOMS_HOME || path.join(os.homedir(), 'MindrianRooms');
    const regPath = path.join(home, '.rooms', 'registry.json');
    if (!fs.existsSync(regPath)) return null;
    const reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
    if (!reg) return null;
    // Two conventions: across-session uses `active`, jtbd-update uses `active_room`.
    if (typeof reg.active === 'string' && reg.active) return reg.active;
    if (typeof reg.active_room === 'string' && reg.active_room) return reg.active_room;
    return null;
  } catch (_) { return null; }
}

module.exports = { emitNudge: emitNudge };

// CLI entry.
if (require.main === module) {
  emitNudge();
  process.exit(0);
}
