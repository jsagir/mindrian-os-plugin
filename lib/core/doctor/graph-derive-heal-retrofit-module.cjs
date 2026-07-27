'use strict';
/*
 * lib/core/doctor/graph-derive-heal-retrofit-module.cjs -- Phase 233 Plan 01 (RCA 4c).
 *
 * THE ONE-TIME AUTOMATIC REPAIR. Phase 224-02 stopped NEW rot: a derivation that
 * fails now KEEPS its queue entry instead of silently deleting it, so the retry
 * signal survives. That fix is forward-only. Roughly 16 rooms were already
 * damaged before it shipped -- their queues had been cleared, so there was
 * nothing left to retry, and they still carry zero semantic cascade edges today
 * (independently corroborated 2026-07-25 by SEED-074's spot-check of two live
 * rooms). This module is their repair.
 *
 * WHY IT IS cadence:'once' AND NOT BEHIND --fix. A user should not have to know
 * their graph was damaged in order to get it repaired. The doctor engine's ONCE
 * pass runs a selected module's check() UNCONDITIONALLY inside its
 * (applied_through, running] version window, regardless of the --fix flag, and
 * then advances the persisted watermark (scripts/doctor.cjs runAccumulativeEngine
 * step 4-6). That is why the real work lives in check() here and never waits for
 * an external --fix: umbilical-module.cjs is the shipped precedent for exactly
 * this shape. Once the watermark passes this version the window is empty and the
 * module never runs again, so "once" is enforced by the engine, not by a flag.
 *
 * WHY IT EXPORTS NO fix(). It is registered fix_supported:false, and the
 * contract-parity gate (tests/test-doctor-module-contract-parity.cjs rule 8)
 * hard-fails a fix_supported:false module that exports a fix. There is nothing
 * to declare: the heal already happened in check().
 *
 * IDEMPOTENCE IS INHERITED, NOT REBUILT (Canon Part 7). The enqueue is
 * scripts/gsd-graph-derive-sweep.cjs's own enqueueDerive, which has been
 * dedup-by-roomDir since Phase 169 and stayed so through 224. Calling it twice
 * for the same room writes one entry. This module adds no second dedup rule of
 * its own, so the two can never drift apart.
 *
 * DETECTION IS NOT RE-DERIVED. detectRoomHealth comes from
 * graph-derive-health-module.cjs. 4d's detection signal IS 4c's detection
 * signal: one function, two consumers. A second copy here is exactly how the two
 * would silently disagree later.
 *
 * WHAT THIS DOES NOT DO. It does not run a derivation. It restores the retry
 * SIGNAL; the real cascade edges land the next time an in-session derive runs.
 * Forcing a derive here would put an expensive scoring pass inside a doctor
 * invocation, which is the cost split the whole enqueue-then-drain design exists
 * to avoid.
 *
 * Canon Part 8: LOCAL only. Read-only room.db reads through the navigation door
 * (inside detectRoomHealth) plus LOCAL JSON queue writes. Zero network, zero
 * Brain, zero telemetry.
 *
 * Threat register (Phase 233): T-233-01 -- per-room try/catch, so a malformed
 * registry entry soft-fails that ONE room and never aborts the sweep across the
 * other 15 (the T-217-01 self-DoS pattern). A retrofit that crashes halfway
 * would leave an arbitrary subset repaired with the watermark unadvanced.
 */

const { readRegistry } = require('./shared.cjs');
const { detectRoomHealth, resolveRoomPath } = require('./graph-derive-health-module.cjs');

// Lazy require: the sweep is loaded on first use, not at module load, matching
// the sibling module's discipline (a doctor run that heals nothing pays nothing).
function sweepMod() {
  return require('../../../scripts/gsd-graph-derive-sweep.cjs');
}

/**
 * check(ctx) -> { status, healed, rooms_scanned, detail }
 *
 * Walks every registered room, and for each one whose semantic derive never
 * succeeded (BELONGS_TO edges present, zero cascade edges), re-enqueues a derive
 * request. Honors ctx.dryRun by counting without writing.
 */
function check(ctx) {
  const c = ctx || {};
  const dryRun = !!c.dryRun;

  const reg = readRegistry();
  if (!reg) {
    return {
      status: 'skip',
      healed: 0,
      rooms_scanned: 0,
      detail: 'no registry at ~/MindrianRooms/.rooms/registry.json (or MINDRIAN_ROOMS_HOME); nothing to retrofit',
    };
  }
  const roomsHome = reg.roomsHome;
  const rooms = (reg.registry && reg.registry.rooms) || {};

  let healed = 0;
  let scanned = 0;
  let errors = 0;

  for (const name of Object.keys(rooms)) {
    try {
      // Inside the try on purpose (T-233-01): a malformed registry entry must
      // soft-fail this room, not throw out of the retrofit.
      const roomPath = resolveRoomPath(roomsHome, rooms[name]);
      if (!roomPath) continue;
      scanned += 1;
      const health = detectRoomHealth(roomPath);
      if (!health.needsHeal) continue;
      if (dryRun) {
        healed += 1;
        continue;
      }
      const res = sweepMod().enqueueDerive(roomPath);
      if (res && res.ok) healed += 1;
      else errors += 1;
    } catch (_e) {
      errors += 1;
    }
  }

  // Status stays 'ok' even when a room soft-failed: the retrofit COMPLETED, and
  // a room it could not reach is reported in the detail rather than escalated
  // into a doctor-level warn the user cannot act on (the next run retries it).
  return {
    status: 'ok',
    healed,
    rooms_scanned: scanned,
    detail: healed + ' of ' + scanned + ' registered room(s) '
      + (dryRun ? 'would be re-enqueued' : 're-enqueued')
      + ' for semantic derive'
      + (errors > 0 ? '; ' + errors + ' room(s) unreadable, retried next run' : '')
      + (dryRun ? ' (dry-run)' : ''),
  };
}

// NO fix export. fix_supported:false, and the contract-parity gate fails a
// fix_supported:false module that exports one. See the header for why.
module.exports = { check };
