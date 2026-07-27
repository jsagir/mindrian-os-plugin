'use strict';
/*
 * lib/core/doctor/graph-derive-health-module.cjs -- Phase 233 Plan 01 (RCA 4d).
 *
 * THE ONE SHARED DETECTION SIGNAL. This file owns `detectRoomHealth(roomDir)`,
 * the single function that decides whether a room's semantic-edge derivation
 * ever actually happened. It has TWO consumers and never a second copy:
 *   (1) this file's own check(ctx)/fix(ctx) -- the per-invocation CLI report and
 *       the `--heal-room` re-enqueue (RCA item 4d);
 *   (2) graph-derive-heal-retrofit-module.cjs -- the cadence:'once' automatic
 *       retrofit that repairs every already-damaged room the first time doctor
 *       runs after this ships (RCA item 4c).
 * 4d's detection signal IS 4c's detection signal. One function, two consumers.
 *
 * WHAT "DAMAGED" MEANS, IN PLAIN LANGUAGE. A room.db with BELONGS_TO edges is a
 * filing cabinet: it knows which artifact lives in which section. A room.db with
 * cascade edges (INFORMS / CONTRADICTS / CONVERGES / INVALIDATES / ENABLES /
 * REFINES / ROOT_CAUSES) additionally knows how ideas relate. Before Phase
 * 224-02, a failed derivation silently cleared its own retry signal, so ~16 live
 * rooms ended up with the first and never the second. That exact shape --
 * BELONGS_TO present, cascade count zero -- is what needsHeal detects.
 *
 * Canon Part 8: every read here is LOCAL. room.db is opened through the
 * navigation chokepoint's READ-ONLY door (openRoomDbReadOnlyForCaller, the
 * Phase 232.1 sibling), so a diagnostic can never migrate what it measures. The
 * queue and failure-log reads are LOCAL JSON. The only write is fix()'s LOCAL
 * queue enqueue. Zero network, zero Brain, zero telemetry.
 *
 * Canon Part 7 (reuse before build): the room.db door + countTable idiom +
 * resolveRoomPath come from room-graph-density-module.cjs; the check/fix
 * contract and the per-room try/catch come from cascade-rooms-module.cjs; the
 * active-room resolution comes from cascade-rooms-active-module.cjs; the queue
 * reader and the dedup-by-roomDir enqueue come from gsd-graph-derive-sweep.cjs
 * (never reimplemented); failureLogPath and the 200-char scalar cap come from
 * gsd-graph-derive-drain.cjs; CASCADE_SUBSET comes from graph-derivation.cjs
 * itself, so this file can never drift from the composer's own frozen set.
 *
 * Threat register (Phase 233): T-233-01 (tampering) -- per-room try/catch, so a
 * malformed registry entry soft-fails that ONE room and never aborts the sweep
 * (the T-217-01 self-DoS pattern). T-233-02 (information disclosure) -- every
 * reasons[] string is a short scalar sentence capped at REASON_CAP chars; no
 * artifact body text is ever placed in a reason. T-233-04 (false success) --
 * status is derived MECHANICALLY from counts read off the real db, never
 * asserted; a zero-cascade room cannot report 'ok'. T-233-05 (DoS) -- the
 * failure-log read is bounded and try/catch-wrapped with a default of 0.
 */

const fs = require('node:fs');
const path = require('node:path');

const { readRegistry } = require('./shared.cjs');

// The allow-list-safe substrate reach from inside lib/core/doctor/: this
// directory may never require node:sqlite or room-db.cjs. lib/core/navigation/
// is allow-listed and the read-only door lives there. Same reach
// room-graph-density-module.cjs and umbilical-module.cjs already make.
const {
  openRoomDbReadOnlyForCaller,
  closeRoomDbForCaller,
} = require('../navigation/spine-events.cjs');

// How stale a queue entry has to be before it counts as STUCK. Claude's
// Discretion per 233-CONTEXT.md ("entry older than N days"); 3 days is the
// sibling of the existing MAX_DERIVE_ATTEMPTS=5 constant in the drain. The
// reasoning: the drain fires on SessionStart, so a user who opens a session even
// twice a week clears a healthy entry well inside the window; an entry that
// survives three days has outlived several drain opportunities and is a real
// signal, not normal latency.
const QUEUE_STUCK_DAYS = 3;
const QUEUE_STUCK_MS = QUEUE_STUCK_DAYS * 24 * 60 * 60 * 1000;

// The scalar cap for anything that could carry an embedded error string. Same
// 200-char bound as scalarError in scripts/gsd-graph-derive-drain.cjs, applied
// here for the same belt-and-suspenders reason: a reason line is rendered into a
// CLI report and, on Desktop/Cowork, into a conversational nudge. It must stay a
// short sentence, never a payload.
const REASON_CAP = 200;

// The largest failure log we will even attempt to parse. The drain bounds its
// own writes to 200 records; anything an order of magnitude past that is corrupt
// or hostile, and a diagnostic must not spend its budget on it (T-233-05).
const MAX_FAILURE_LOG_BYTES = 1024 * 1024;

// -- Lazy requires -----------------------------------------------------
//
// gsd-graph-derive-sweep.cjs and gsd-graph-derive-drain.cjs are LOADED ON FIRST
// USE, not at module load. The drain pulls in the local scorer/classifier chain;
// doctor.cjs requires this file on every invocation, and a diagnostic must not
// pay for a subsystem it may never touch. Both are wrapped so a missing sibling
// degrades to a skip-shaped default instead of crashing the sweep.

function sweepMod() {
  return require('../../../scripts/gsd-graph-derive-sweep.cjs');
}

function drainMod() {
  return require('../../../scripts/gsd-graph-derive-drain.cjs');
}

// The frozen 7-item cascade edge_type set, read from the COMPOSER itself so this
// file can never drift into a shorter hand-typed list.
function cascadeTypes() {
  const { CASCADE_SUBSET } = require('../graph-derivation.cjs');
  return Array.from(CASCADE_SUBSET);
}

// -- Helpers -----------------------------------------------------------

// resolveRoomPath(roomsHome, info) -> absolute room dir path, honoring the
// canonical abs_path -> path precedence (room-graph-density-module.cjs WR-01:
// a room registered with only abs_path is a real, common registry shape).
function resolveRoomPath(roomsHome, info) {
  if (info && typeof info.abs_path === 'string' && info.abs_path.length > 0) {
    return info.abs_path;
  }
  const relPath = info && info.path;
  if (typeof relPath !== 'string' || relPath.length === 0) return null;
  return path.isAbsolute(relPath) ? relPath : path.join(roomsHome, relPath);
}

// scalar(s) -> a short, capped, single-line string. The T-233-02 mitigation
// applied at the one place reasons are built.
function scalar(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/\s+/g, ' ')
    .slice(0, REASON_CAP);
}

// countEdgesOfTypes(db, types) -> row count, or 0 on any throw. The repo's own
// "a failed query means no rows" idiom (room-graph-density-module.cjs
// countTable): a room.db with no `edges` table yet is the NORMAL Tier 0 state,
// not an error. Placeholders are generated from the ARITY of the frozen set, so
// no caller-, room- or registry-derived value ever reaches the SQL text.
function countEdgesOfTypes(db, types) {
  if (!Array.isArray(types) || types.length === 0) return 0;
  try {
    const placeholders = types.map(() => '?').join(', ');
    const row = db
      .prepare('SELECT count(*) AS c FROM edges WHERE type IN (' + placeholders + ')')
      .get(...types);
    return (row && row.c) || 0;
  } catch (_e) {
    return 0;
  }
}

// readFailureLogCount(roomDir) -> number of recorded derive failures, 0 on any
// absence / oversize / parse error (T-233-05).
function readFailureLogCount(roomDir) {
  try {
    const p = drainMod().failureLogPath(roomDir);
    if (!fs.existsSync(p)) return 0;
    const stat = fs.statSync(p);
    if (!stat.isFile() || stat.size > MAX_FAILURE_LOG_BYTES) return 0;
    const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (Array.isArray(parsed)) return parsed.length;
    if (parsed && Array.isArray(parsed.failures)) return parsed.failures.length;
    return 0;
  } catch (_e) {
    return 0;
  }
}

// readQueueEntries(roomDir) -> the room's derive queue entries, [] on any
// failure. Reuses the sweep's own reader so the queue shape has ONE owner.
function readQueueEntries(roomDir) {
  try {
    const q = sweepMod().readQueue(roomDir);
    return (q && Array.isArray(q.entries)) ? q.entries : [];
  } catch (_e) {
    return [];
  }
}

// countStuckEntries(entries) -> how many entries were enqueued more than
// QUEUE_STUCK_DAYS ago. An unparseable enqueued_at is NOT counted as stuck (we
// do not fault a room for a timestamp we cannot read).
function countStuckEntries(entries) {
  const cutoff = Date.now() - QUEUE_STUCK_MS;
  let n = 0;
  for (const e of entries) {
    if (!e || typeof e.enqueued_at !== 'string') continue;
    const t = Date.parse(e.enqueued_at);
    if (!Number.isFinite(t)) continue;
    if (t < cutoff) n += 1;
  }
  return n;
}

// -- The shared detection signal ---------------------------------------

/**
 * detectRoomHealth(roomDir) -> {
 *   hasDb, hasBelongsTo, belongsToCount, cascadeEdgeCount,
 *   queueCount, queueStuckCount, failureLogCount,
 *   needsHeal, status: 'ok'|'warn'|'fail'|'skip', reasons: string[]
 * }
 *
 * Pure and read-only: it opens room.db through the read-only door, counts two
 * edge classes, reads two LOCAL JSON files, and returns. It NEVER writes, never
 * throws, and never reaches the network.
 */
function detectRoomHealth(roomDir) {
  const base = {
    hasDb: false,
    hasBelongsTo: false,
    belongsToCount: 0,
    cascadeEdgeCount: 0,
    queueCount: 0,
    queueStuckCount: 0,
    failureLogCount: 0,
    needsHeal: false,
    status: 'skip',
    reasons: [],
  };

  let db = null;
  try {
    db = openRoomDbReadOnlyForCaller(roomDir);
  } catch (_e) {
    db = null;
  }
  if (!db) {
    // D-05 convention: no room.db yet is the NORMAL Tier 0 case, not an error.
    base.reasons = [scalar('no room.db yet (Tier 0 room, nothing to derive)')];
    return base;
  }

  try {
    base.hasDb = true;
    base.belongsToCount = countEdgesOfTypes(db, ['BELONGS_TO']);
    base.hasBelongsTo = base.belongsToCount > 0;
    base.cascadeEdgeCount = countEdgesOfTypes(db, cascadeTypes());
  } finally {
    closeRoomDbForCaller(db);
  }

  const entries = readQueueEntries(roomDir);
  base.queueCount = entries.length;
  base.queueStuckCount = countStuckEntries(entries);
  base.failureLogCount = readFailureLogCount(roomDir);

  // THE SIGNAL (RCA 4c): structural edges exist, semantic edges never landed.
  base.needsHeal = base.hasDb && base.hasBelongsTo && base.cascadeEdgeCount === 0;

  // Status in priority order. Mechanically derived from the counts above -- an
  // 'ok' can never be asserted over a real zero-cascade room (T-233-04).
  const reasons = [];
  if (base.needsHeal) {
    base.status = 'fail';
    reasons.push(scalar(
      'derivation never succeeded: ' + base.belongsToCount
      + ' structural BELONGS_TO edge(s) but 0 semantic cascade edge(s)'
    ));
  } else if (base.queueStuckCount > 0) {
    base.status = 'warn';
  } else if (base.failureLogCount > 0) {
    base.status = 'warn';
  } else {
    base.status = 'ok';
    reasons.push(scalar(
      base.cascadeEdgeCount + ' semantic cascade edge(s) present; derivation has run'
    ));
  }
  // Secondary reasons are additive: a failing room that is ALSO queue-stuck says
  // both, so the operator sees the full picture in one line set.
  if (base.queueStuckCount > 0) {
    reasons.push(scalar(
      base.queueStuckCount + ' derive queue entry(ies) stuck for more than '
      + QUEUE_STUCK_DAYS + ' day(s)'
    ));
  }
  if (base.failureLogCount > 0) {
    reasons.push(scalar(
      base.failureLogCount + ' recorded derive failure(s) in graph-derive-failures.json'
    ));
  }
  base.reasons = reasons;
  return base;
}

// -- check(ctx) --------------------------------------------------------

const STATUS_RANK = { fail: 3, warn: 2, ok: 1, skip: 0 };

function worstStatus(statuses) {
  let worst = 'skip';
  for (const s of statuses) {
    if ((STATUS_RANK[s] || 0) > (STATUS_RANK[worst] || 0)) worst = s;
  }
  return worst;
}

/**
 * check(ctx) -> { status, detail, scope, rooms[] }
 *
 * Default scope is the registry's ACTIVE room (the class-C precedent). With
 * ctx.flags.cascadeRooms the scope widens to every registered room, matching how
 * classes B and C already share that flag.
 *
 * NOTE on the reported class status: 'fail' is NOT in the doctor engine's
 * status vocabulary (ok|warn|error|skip), so the per-room status stays 'fail'
 * (that is the RCA's own PASS/WARN/FAIL language and what the tests assert)
 * while the CLASS status maps fail -> 'warn'. A damaged room is a repairable
 * drift signal with a wired --fix, not a doctor-level error.
 */
function check(ctx) {
  const c = ctx || {};
  const allRooms = !!(c.flags && c.flags.cascadeRooms);

  const reg = readRegistry();
  if (!reg) {
    return {
      status: 'skip',
      detail: 'no registry at ~/MindrianRooms/.rooms/registry.json (or MINDRIAN_ROOMS_HOME)',
      scope: allRooms ? 'all' : 'active',
      rooms: [],
    };
  }
  const roomsHome = reg.roomsHome;
  const rooms = (reg.registry && reg.registry.rooms) || {};
  const activeName = (reg.registry && reg.registry.active) || null;

  let names;
  if (allRooms) {
    names = Object.keys(rooms);
  } else if (activeName && rooms[activeName]) {
    names = [activeName];
  } else {
    return {
      status: 'skip',
      detail: 'no active room in the registry; nothing in scope for graph-derive-health',
      scope: 'active',
      rooms: [],
    };
  }

  const out = [];
  for (const name of names) {
    try {
      // Inside the try on purpose (T-233-01): a malformed registry entry must
      // soft-fail this room, not throw out of the sweep.
      const roomPath = resolveRoomPath(roomsHome, rooms[name]);
      if (!roomPath) continue;
      const h = detectRoomHealth(roomPath);
      out.push(Object.assign({ room: name, roomPath }, h));
    } catch (e) {
      // T-233-01 / T-217-01 self-DoS guard: one bad room never aborts the sweep.
      out.push({
        room: name,
        roomPath: null,
        unreadable: true,
        status: 'skip',
        needsHeal: false,
        reasons: [scalar('room unreadable: ' + ((e && e.message) || 'unknown error'))],
      });
    }
  }

  const perRoomWorst = worstStatus(out.map((r) => r.status));
  const needing = out.filter((r) => r.needsHeal || (r.queueStuckCount || 0) > 0).length;
  const damaged = out.filter((r) => r.needsHeal).length;

  // CR-01: `needing` counts what --heal-room will ACT on (needsHeal or
  // queue-stuck), and that is the right predicate for the re-enqueue sentence
  // and for fix() itself. But the per-room status vocabulary is WIDER than that:
  // detectRoomHealth also returns 'warn' for a room whose failure log carries old
  // records while its cascade edges are now present and its queue is clear. That
  // is a room that failed a few derives and then RECOVERED, which is the normal,
  // desired outcome of the keep-on-failure retry design, and re-enqueuing it
  // would be wrong (there is nothing left to derive).
  //
  // The bug this closes: reusing `needing` to gate the "every one has run its
  // semantic derive" sentence let that plain-language success claim ship NEXT TO
  // a class status of 'warn' driven by exactly such a room. A caller reading only
  // `detail` (the Desktop/Cowork nudge in preflight-doctor.cjs, or a human
  // reading the CLI row) saw the summary contradict the status field beside it --
  // the same false-success shape this phase exists to close (T-233-04). The
  // success sentence is now gated on there being nothing flagged at all.
  const flaggedNotNeeding = out.filter(
    (r) => (r.status === 'warn' || r.status === 'fail')
      && !(r.needsHeal || (r.queueStuckCount || 0) > 0)
  ).length;

  let detail;
  if (out.length === 0) {
    detail = 'no rooms in scope for graph-derive-health';
  } else if (needing > 0) {
    detail = needing + ' of ' + out.length + ' room(s) need a derive re-enqueue'
      + (damaged > 0 ? ' (' + damaged + ' with zero semantic cascade edges)' : '')
      + '; run /mos:doctor --heal-room';
  } else if (flaggedNotNeeding > 0) {
    detail = out.length + ' room(s) checked; semantic derive has run everywhere, but '
      + flaggedNotNeeding + ' room(s) still carry recorded derive failure(s) from an'
      + ' earlier run (already recovered; no re-enqueue needed)';
  } else {
    detail = out.length + ' room(s) checked; every one has run its semantic derive';
  }

  return {
    // fail -> warn at the CLASS level: the engine's vocabulary is ok|warn|error|
    // skip, and a repairable room is drift, not a doctor error.
    status: perRoomWorst === 'fail' ? 'warn' : perRoomWorst,
    detail,
    scope: allRooms ? 'all' : 'active',
    rooms: out,
  };
}

// -- fix(ctx) ----------------------------------------------------------

/**
 * fix(ctx) -> { status, healed, projected, recoveries, errors, detail }
 *
 * The `--heal-room` action. For every room the just-run check surfaced as
 * needsHeal or queue-stuck, call the EXISTING sweep enqueue (dedup-by-roomDir
 * since Phase 169/224, so re-running never duplicates an entry -- this is why
 * idempotence is free rather than reimplemented here). The real semantic edges
 * land the next time an in-session derive runs; restoring the retry signal is
 * this fix's whole job.
 */
function fix(ctx) {
  const c = ctx || {};
  const dryRun = !!c.dryRun;
  const checkResult = c.check_result || {};
  const rooms = Array.isArray(checkResult.rooms) ? checkResult.rooms : [];

  const recoveries = [];
  const errors = [];
  let healed = 0;
  let projected = 0;

  for (const entry of rooms) {
    if (!entry || !entry.roomPath) continue;
    const wants = entry.needsHeal || (entry.queueStuckCount || 0) > 0;
    if (!wants) continue;
    try {
      if (dryRun) {
        projected += 1;
        recoveries.push({
          room: entry.room,
          status: 'projected',
          detail: 'would re-enqueue a derive for ' + entry.room,
        });
        continue;
      }
      const res = sweepMod().enqueueDerive(entry.roomPath);
      if (res && res.ok) {
        healed += 1;
        projected += 1;
        recoveries.push({
          room: entry.room,
          status: 'ok',
          queued: !!res.queued,
          detail: res.queued
            ? 'derive re-enqueued for ' + entry.room
            : 'derive already queued for ' + entry.room + ' (dedup, no duplicate written)',
        });
      } else {
        errors.push({ room: entry.room, reason: scalar((res && res.reason) || 'enqueue_failed') });
      }
    } catch (e) {
      errors.push({ room: entry.room, reason: scalar((e && e.message) || 'enqueue threw') });
    }
  }

  return {
    status: errors.length > 0 ? 'warn' : 'ok',
    healed,
    projected,
    recoveries,
    errors,
    detail: 'graph-derive-health fix: ' + projected + ' room(s) '
      + (dryRun ? 'would be re-enqueued' : 're-enqueued') + '; '
      + errors.length + ' error(s)' + (dryRun ? ' (dry-run)' : ''),
  };
}

module.exports = {
  detectRoomHealth,
  check,
  fix,
  // exported for hermetic unit tests + the retrofit sibling:
  resolveRoomPath,
  QUEUE_STUCK_DAYS,
};
