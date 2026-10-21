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
// Phase 379.1 Plan 05 (CPU379-07): the doctor READS the two job locks and the
// artifact scope. It never acquires a lock; --fix only removes a lock file that
// a fresh reading proves dead or recycled.
const jobLock = require('../job-lock.cjs');
const artifactScope = require('../artifact-scope.cjs');

// The allow-list-safe substrate reach from inside lib/core/doctor/: this
// directory may never require node:sqlite or room-db.cjs. lib/core/navigation/
// is allow-listed and the read-only door lives there. Same reach
// room-graph-density-module.cjs and umbilical-module.cjs already make.
const {
  openRoomDbReadOnlyForCaller,
  closeRoomDbForCaller,
} = require('../navigation/spine-events.cjs');
// Quick 260914-ntk (Finding 1a): the disclosure the health module never read
// before this. findRecentChanges is the read-only door onto memory_event
// nodes; 'derivation_skipped' is already a member of EVENT_TYPES, so no
// vocabulary edit is needed there. Same allow-listed lib/core/navigation/
// reach this file's header already sanctions.
const { findRecentChanges } = require('../navigation/memory-events.cjs');

// How stale a queue entry has to be before it counts as STUCK. Claude's
// Discretion per 233-CONTEXT.md ("entry older than N days"); 3 days is the
// sibling of the existing MAX_DERIVE_ATTEMPTS=5 constant in the drain. The
// reasoning: the drain fires on SessionStart, so a user who opens a session even
// twice a week clears a healthy entry well inside the window; an entry that
// survives three days has outlived several drain opportunities and is a real
// signal, not normal latency.
const QUEUE_STUCK_DAYS = 3;
const QUEUE_STUCK_MS = QUEUE_STUCK_DAYS * 24 * 60 * 60 * 1000;

// Phase 379.1 Plan 05 (CPU379-07): an entry that survives 7 days has outlived a
// whole week of drain opportunities; --fix drops it with a permanent record
// (error 'abandoned_by_doctor') instead of re-enqueueing it forever.
const QUEUE_ABANDONED_DAYS = 7;
const QUEUE_ABANDONED_MS = QUEUE_ABANDONED_DAYS * 24 * 60 * 60 * 1000;

// The two job-lock files, relative to the room. The drain and the scout runner
// own these names (scripts/gsd-graph-derive-drain.cjs drainLockPath,
// scripts/scout-cadence-runner.cjs lockPathFor); a test pins that they agree.
// They are literals here so the doctor never loads the drain just to read a lock.
const DRAIN_LOCK_REL = path.join('.mindrian', 'graph-derive-drain.lock');
const SCOUT_LOCK_REL = path.join('.mindrian', 'scout-cadence.lock');

// A live lock whose heartbeat is older than this is reported (the job-lock
// heartbeat ticks every 30 s by default; 10 min is 20 missed ticks).
const LOCK_HEARTBEAT_WARN_MS = 10 * 60 * 1000;

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

// Quick 260917-o1e (R3b): the default LIVE presence probe fix() resolves when
// the caller supplies neither ctx.probeEncoderPresence nor ctx.encoderPresent.
// Lazily requires class-s-eureka-smoke.cjs for the same reason the sweep and
// drain are lazy-required above: a diagnostic must not pay for a subsystem it
// may never touch. Degrades to false (today's warn) on any throw -- a missing
// sibling must never crash the fix.
function defaultProbeEncoderPresence() {
  try {
    const { encoderPresentSync } = require('./class-s-eureka-smoke.cjs');
    return !!encoderPresentSync().present;
  } catch (_e) {
    return false;
  }
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

// countAbandonedEntries(entries) -> how many entries were enqueued more than
// QUEUE_ABANDONED_DAYS ago. Same unparseable-timestamp rule as countStuckEntries.
function countAbandonedEntries(entries) {
  const cutoff = Date.now() - QUEUE_ABANDONED_MS;
  let n = 0;
  for (const e of entries) {
    if (!e || typeof e.enqueued_at !== 'string') continue;
    const t = Date.parse(e.enqueued_at);
    if (!Number.isFinite(t)) continue;
    if (t < cutoff) n += 1;
  }
  return n;
}

function isAbandonedEntry(e) {
  if (!e || typeof e.enqueued_at !== 'string') return false;
  const t = Date.parse(e.enqueued_at);
  return Number.isFinite(t) && t < Date.now() - QUEUE_ABANDONED_MS;
}

// lockPathsFor(roomDir) -> { drain, scout } absolute lock file paths.
function lockPathsFor(roomDir) {
  return {
    drain: path.join(roomDir, DRAIN_LOCK_REL),
    scout: path.join(roomDir, SCOUT_LOCK_REL),
  };
}

// readLocks(roomDir) -> { drain, scout } job-lock.read() readings. Read only.
function readLocks(roomDir) {
  const p = lockPathsFor(roomDir);
  return { drain: jobLock.read(p.drain), scout: jobLock.read(p.scout) };
}

// lockIsRemovable(reading) -> true when --fix may delete the file: the owner is
// dead, the file is corrupt, the machine rebooted since it was written, or the
// pid is alive but the heartbeat is past the ceiling and the process identity
// differs (a recycled pid). A live owner with a fresh heartbeat, or a stale
// heartbeat with a MATCHING identity (a runaway worker a human must stop), is
// never removable.
function lockIsRemovable(r) {
  if (!r || !r.present) return false;
  if (r.corrupt) return true;
  if (!r.alive) return true;
  if (r.boot_mismatch) return true;
  if (r.stale_heartbeat === true && r.pid_start_match !== true) return true;
  return false;
}

// lockReasons(label, r) -> short scalar sentences for one lock reading.
function lockReasons(label, r) {
  const out = [];
  if (!r || !r.present) return out;
  if (r.corrupt) {
    out.push(label + ' lock file is corrupt (--fix removes it)');
    return out;
  }
  if (r.legacy_bare_pid) out.push(label + ' lock is a legacy bare pid file');
  if (!r.alive) {
    out.push(label + ' lock held by dead pid ' + r.pid);
    return out;
  }
  if (r.boot_mismatch) {
    out.push(label + ' lock was written before the last reboot (--fix removes it)');
    return out;
  }
  if (r.stale_heartbeat === true) {
    if (r.pid_start_match !== true) {
      out.push(label + ' lock held by live pid ' + r.pid
        + ' with heartbeat older than 6 h and a different process identity (recycled pid; --fix removes it)');
    } else {
      out.push(label + ' lock held by live pid ' + r.pid
        + ' with heartbeat older than 6 h: a runaway worker; stop it by hand');
    }
  } else if (Number.isFinite(r.heartbeat_age_ms) && r.heartbeat_age_ms > LOCK_HEARTBEAT_WARN_MS) {
    out.push(label + ' lock held by live pid ' + r.pid + ' with heartbeat older than 10 min');
  }
  return out;
}

// artifactScopeSummary(scope) -> the scalar block the report carries.
function artifactScopeSummary(scope) {
  const st = scope && scope.stats ? scope.stats : {};
  return {
    declared: !!(scope && scope.declared),
    patterns: scope && Array.isArray(scope.patterns) ? scope.patterns.length : 0,
    invalid_patterns: (scope && scope.invalid_patterns) || 0,
    overbroad_patterns: (scope && scope.overbroad_patterns) || 0,
    parse_error: !!(scope && scope.parse_error),
    overbroad: !!(scope && scope.overbroad),
    excluded_dirs: Number.isInteger(st.excluded_dirs) ? st.excluded_dirs : 0,
    excluded_artifacts: Number.isInteger(st.excluded_md) ? st.excluded_md : 0,
    generated_dirs_detected: Number.isInteger(st.marker_pruned_dirs) ? st.marker_pruned_dirs : 0,
  };
}

// readLastSkipDisclosure(db) -> { createdAt, reason } | null. Reads the most
// recent 'derivation_skipped' memory_event through the read-only door. A
// room.db with no `nodes` table yet is the normal Tier 0 state, exactly like
// the countEdgesOfTypes idiom above -- so any throw here defaults to null,
// never an error (Quick 260914-ntk, Finding 1a).
function readLastSkipDisclosure(db) {
  try {
    const rows = findRecentChanges(db, 0, { eventType: 'derivation_skipped', limit: 1 });
    if (!rows || rows.length === 0) return null;
    const row = rows[0];
    return { createdAt: row.createdAt, reason: row.properties && row.properties.reason };
  } catch (_e) {
    return null;
  }
}

// Quick 260917-o1e (R2): the success-side sibling of readLastSkipDisclosure,
// same shape, same T-233-01 tolerant-default idiom (a room.db with no `nodes`
// table yet is the normal Tier 0 state, so any throw defaults to null rather
// than an error).
function readLastDeriveCompletion(db) {
  try {
    const rows = findRecentChanges(db, 0, { eventType: 'derivation_completed', limit: 1 });
    if (!rows || rows.length === 0) return null;
    const row = rows[0];
    return { createdAt: row.createdAt };
  } catch (_e) {
    return null;
  }
}

// healAttemptPath(roomDir) -> the LOCAL heal-attempt marker, sibling of the
// queue and failure-log files. Written by this module's own fix(), not by the
// drain -- keeps the blast radius at one file and keeps lib/core/doctor/'s
// no-write-door constraint intact (Quick 260914-ntk, Finding 5c).
function healAttemptPath(roomDir) {
  return path.join(roomDir, '.mindrian', 'graph-derive-heal-attempts.json');
}

// readHealAttempt(roomDir) -> { lastAttemptAt: number|null }. Bounded by the
// same MAX_FAILURE_LOG_BYTES guard and try/catch-defaulted, the T-233-05
// idiom already used by readFailureLogCount above.
function readHealAttempt(roomDir) {
  try {
    const p = healAttemptPath(roomDir);
    if (!fs.existsSync(p)) return { lastAttemptAt: null };
    const stat = fs.statSync(p);
    if (!stat.isFile() || stat.size > MAX_FAILURE_LOG_BYTES) return { lastAttemptAt: null };
    const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
    const v = (parsed && typeof parsed.last_attempt_at === 'number') ? parsed.last_attempt_at : null;
    return { lastAttemptAt: v };
  } catch (_e) {
    return { lastAttemptAt: null };
  }
}

// writeHealAttemptMarker(roomDir, cascadeEdgeCountAtAttempt) -> void. Atomic
// tmp-file-plus-rename write, mirroring enqueueDerive's own writeQueue idiom
// in gsd-graph-derive-sweep.cjs. A marker-write failure degrades to today's
// behavior (one more re-enqueue next pass); it must never break the heal.
function writeHealAttemptMarker(roomDir, cascadeEdgeCountAtAttempt) {
  try {
    const p = healAttemptPath(roomDir);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    const tmp = p + '.tmp-' + process.pid + '-' + Date.now().toString(36);
    fs.writeFileSync(tmp, JSON.stringify({
      last_attempt_at: Date.now(),
      cascade_edge_count_at_attempt: cascadeEdgeCountAtAttempt || 0,
    }, null, 2));
    fs.renameSync(tmp, p);
  } catch (_e) {
    // Advisory only (T-ntk-02): degrade silently, never throw out of fix().
  }
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
    queueAbandonedCount: 0,
    failureLogCount: 0,
    locks: null,
    artifact_scope: null,
    lockFixable: false,
    healthFindings: false,
    // Quick 260914-ntk (Findings 1a, 5c): an ATTEMPT-gap signal, distinct from
    // the pure RESULT-based needsHeal below.
    encoderUnavailable: false,
    deriveAttemptCompleted: false,
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

  let skipDisclosure = null;
  let completionDisclosure = null;
  try {
    base.hasDb = true;
    base.belongsToCount = countEdgesOfTypes(db, ['BELONGS_TO']);
    base.hasBelongsTo = base.belongsToCount > 0;
    base.cascadeEdgeCount = countEdgesOfTypes(db, cascadeTypes());
    skipDisclosure = readLastSkipDisclosure(db);
    // Quick 260917-o1e (R2): read inside the SAME try/finally that already
    // holds the open db handle, so no second handle is opened.
    completionDisclosure = readLastDeriveCompletion(db);
  } finally {
    closeRoomDbForCaller(db);
  }

  const entries = readQueueEntries(roomDir);
  base.queueCount = entries.length;
  base.queueStuckCount = countStuckEntries(entries);
  base.queueAbandonedCount = countAbandonedEntries(entries);
  base.failureLogCount = readFailureLogCount(roomDir);

  // Phase 379.1 Plan 05 (CPU379-07): the two job locks and the artifact scope.
  // Read only; one loadScope call (its pre-walk already counts the marked
  // directories, so there is no second walk).
  const extraReasons = [];
  try {
    base.locks = readLocks(roomDir);
    for (const r of lockReasons('drain', base.locks.drain)) extraReasons.push(r);
    for (const r of lockReasons('scout', base.locks.scout)) extraReasons.push(r);
    base.lockFixable = lockIsRemovable(base.locks.drain) || lockIsRemovable(base.locks.scout);
  } catch (_e) {
    base.locks = null;
  }
  try {
    const scope = artifactScope.loadScope(roomDir);
    base.artifact_scope = artifactScopeSummary(scope);
    if (scope.parse_error || scope.invalid_patterns > 0) {
      extraReasons.push('artifact scope declaration is invalid');
    }
    if (scope.overbroad_patterns > 0 || scope.overbroad) {
      const os = scope.overbroad_stats || {};
      const p = Number.isInteger(os.pattern_pruned_dirs) ? os.pattern_pruned_dirs : 0;
      const d = Number.isInteger(os.dirs_seen) ? os.dirs_seen : 0;
      extraReasons.push('artifact scope declaration is overbroad and was ignored ('
        + scope.overbroad_patterns + ' wildcard-only pattern(s); ' + p + ' of ' + d + ' directories matched)');
    }
  } catch (_e) {
    base.artifact_scope = null;
  }
  if (base.queueAbandonedCount > 0) {
    extraReasons.unshift(base.queueAbandonedCount + ' derive queue entry(ies) abandoned for more than '
      + QUEUE_ABANDONED_DAYS + ' day(s)');
  }

  // Finding 1a: the last skip disclosure, when it names encoder_unavailable.
  const skipAt = (skipDisclosure && skipDisclosure.reason === 'encoder_unavailable')
    ? skipDisclosure.createdAt
    : null;
  const attemptAt = readHealAttempt(roomDir).lastAttemptAt;
  // Quick 260917-o1e (R2): the completion event, when one exists.
  const completedAt = completionDisclosure ? completionDisclosure.createdAt : null;
  // A stale skip event from before a successful heal cannot masquerade as a
  // current encoder gap. Quick 260917-o1e (R2) extends this with a THIRD
  // disjunct: a stale skip event from before a derivation_completed disclosure
  // cannot masquerade as a current encoder gap either -- this is the fix for
  // the self-locking verdict (a room with an old skip and no marker file could
  // never reach a marker before this; a live derivation_completed now breaks
  // the lock without a hand-written file). Strict `>` against completedAt is
  // deliberate: a completion and a skip are mutually exclusive for one pass
  // (R1b writes them via an `else`, never both), so a same-millisecond tie can
  // only mean the completion is the later word, and the whole defect being
  // closed is a stale skip outliving live evidence.
  base.encoderUnavailable = skipAt !== null
    && (attemptAt === null || skipAt >= attemptAt)
    && (completedAt === null || skipAt > completedAt);
  // An empty queue after a recorded attempt is proof the drain ran to
  // completion, because reconcileQueue keeps failed entries and only clears
  // succeeded ones (Finding 5c). Quick 260917-o1e (R2) extends this with a
  // SECOND disjunct: a derivation_completed event is DIRECT evidence an
  // attempt happened, distinct from the marker-file INFERENCE the first
  // disjunct makes. Without this arm a room that honestly derived zero edges
  // and has no marker would be re-enqueued on every pass for nothing. Nothing
  // is removed; the existing semantics are a strict subset.
  base.deriveAttemptCompleted = !base.encoderUnavailable
    && ((attemptAt !== null && base.queueCount === 0) || completedAt !== null);

  // THE SIGNAL (RCA 4c), reworked by Quick 260914-ntk: needsHeal now answers
  // "is there an ATTEMPT gap", not "is the RESULT zero". A room that ran a
  // real derive and honestly found nothing to connect is working exactly as
  // intended, and re-enqueuing it can never converge.
  base.needsHeal = base.hasDb && base.hasBelongsTo && base.cascadeEdgeCount === 0
    && !base.encoderUnavailable && !base.deriveAttemptCompleted;

  // Status in priority order. Mechanically derived from the counts above -- an
  // 'ok' can never be asserted over a real zero-cascade room (T-233-04). The
  // two new branches are ordered FIRST so they win over the generic needsHeal
  // branch below.
  const reasons = [];
  if (base.encoderUnavailable) {
    base.status = 'warn';
    reasons.push(scalar(
      'semantic encoder not installed; the last derive skipped every pair - run /mos:doctor --fix eureka'
    ));
  } else if (base.deriveAttemptCompleted && base.cascadeEdgeCount === 0) {
    base.status = 'ok';
    reasons.push(scalar(
      'derive ran to completion and found no qualifying semantic relationships; 0 cascade edges is the correct result here'
    ));
  } else if (base.needsHeal) {
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
  // Phase 379.1 Plan 05: the new findings are additive reasons. They raise an
  // 'ok' room to 'warn' and never lower a worse status (the ladder is kept).
  if (extraReasons.length > 0) {
    base.healthFindings = true;
    for (const r of extraReasons) reasons.push(scalar(r));
    if (base.status === 'ok') base.status = 'warn';
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
  // Quick 260914-ntk (Finding 1a): rooms whose last derive skipped every pair
  // for lack of the semantic encoder. Distinct from `needing` -- these rooms
  // must never receive the generic re-enqueue advice.
  const encoderBlocked = out.filter((r) => r.encoderUnavailable).length;

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
  } else if (encoderBlocked > 0) {
    detail = encoderBlocked + ' of ' + out.length + ' room(s) cannot derive: the semantic'
      + ' encoder is not installed; run /mos:doctor --fix eureka'
      + (needing > 0 ? '; ' + needing + ' room(s) also need a derive re-enqueue' : '');
  } else if (needing > 0) {
    detail = needing + ' of ' + out.length + ' room(s) need a derive re-enqueue'
      + (damaged > 0 ? ' (' + damaged + ' with zero semantic cascade edges)' : '')
      + '; run /mos:doctor --heal-room';
  } else if (out.some((r) => r.healthFindings) && flaggedNotNeeding > 0
    && out.filter((r) => (r.status === 'warn' || r.status === 'fail') && !r.healthFindings
      && !(r.needsHeal || (r.queueStuckCount || 0) > 0)).length === 0) {
    detail = out.length + ' room(s) checked; semantic derive has run, but '
      + out.filter((r) => r.healthFindings).length
      + ' room(s) have an abandoned queue entry, a stuck job lock or an artifact scope declaration to review'
      + ' (see the reasons; --heal-room removes dead locks and drops abandoned entries)';
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

// appendAbandonedRecord(roomDir, entry) -> void. Appends one permanent record
// to the drain's failure log (drainMod().failureLogPath, the same file and the
// same { failures: [...] } shape the drain writes, bounded to 200 rows, atomic
// tmp + rename). Advisory: a failed write never blocks the fix.
function appendAbandonedRecord(roomDir, entry) {
  const MAX_LOG = 200;
  try {
    const p = drainMod().failureLogPath(roomDir);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    let log = [];
    try {
      const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (Array.isArray(parsed)) log = parsed;
      else if (parsed && Array.isArray(parsed.failures)) log = parsed.failures;
    } catch (_e) { log = []; }
    log.push({
      roomDir: path.resolve((entry && entry.roomDir) || roomDir),
      filePath: (entry && typeof entry.filePath === 'string' && entry.filePath.length > 0)
        ? path.basename(entry.filePath) : null,
      enqueued_at: (entry && entry.enqueued_at) || null,
      failures: (entry && Number.isFinite(entry.failures)) ? entry.failures : 0,
      error: 'abandoned_by_doctor',
      last_attempt: new Date().toISOString(),
      permanent: true,
    });
    if (log.length > MAX_LOG) log = log.slice(log.length - MAX_LOG);
    const tmp = p + '.tmp-' + process.pid + '-' + Date.now().toString(36);
    fs.writeFileSync(tmp, JSON.stringify({ failures: log }, null, 2));
    fs.renameSync(tmp, p);
  } catch (_e) {
    /* advisory */
  }
}

// healLocks(entry, dryRun, recoveries) -> number of lock files removed (or that
// would be). Decides on a FRESH reading, never on the possibly stale check
// result, so a lock a live job took in the meantime is never removed.
function healLocks(entry, dryRun, recoveries) {
  let n = 0;
  const paths = lockPathsFor(entry.roomPath);
  for (const name of ['drain', 'scout']) {
    const reading = jobLock.read(paths[name]);
    if (!lockIsRemovable(reading)) continue;
    if (dryRun) {
      n += 1;
      recoveries.push({
        room: entry.room,
        status: 'projected',
        detail: 'would remove the ' + name + ' lock for ' + entry.room + ' (dead or recycled owner)',
      });
      continue;
    }
    try {
      fs.unlinkSync(paths[name]);
      n += 1;
      recoveries.push({
        room: entry.room,
        status: 'ok',
        detail: 'removed the ' + name + ' lock for ' + entry.room + ' (dead or recycled owner)',
      });
    } catch (e) {
      if (!e || e.code !== 'ENOENT') {
        recoveries.push({
          room: entry.room,
          status: 'warn',
          detail: 'could not remove the ' + name + ' lock for ' + entry.room,
        });
      }
    }
  }
  return n;
}

// healAbandoned(entry, dryRun, recoveries) -> number of entries dropped (or that
// would be). Skipped while a live drain with a fresh heartbeat holds the drain
// lock, because that drain patches the same queue file.
function healAbandoned(entry, dryRun, recoveries) {
  let q;
  try {
    q = sweepMod().readQueue(entry.roomPath);
  } catch (_e) {
    return 0;
  }
  const list = (q && Array.isArray(q.entries)) ? q.entries : [];
  const dropped = list.filter(isAbandonedEntry);
  if (dropped.length === 0) return 0;
  const drainLock = jobLock.read(lockPathsFor(entry.roomPath).drain);
  if (drainLock.present && drainLock.alive && !drainLock.stale_heartbeat && !drainLock.boot_mismatch) {
    recoveries.push({
      room: entry.room,
      status: 'warn',
      detail: 'abandoned queue entry drop deferred for ' + entry.room + ': a drain is running',
    });
    return 0;
  }
  if (dryRun) {
    recoveries.push({
      room: entry.room,
      status: 'projected',
      detail: 'would drop ' + dropped.length + ' abandoned queue entry(ies) for ' + entry.room,
    });
    return dropped.length;
  }
  for (const e of dropped) appendAbandonedRecord(entry.roomPath, e);
  const kept = list.filter((e) => !isAbandonedEntry(e));
  try {
    sweepMod().writeQueue(entry.roomPath, Object.assign({}, q, { entries: kept }));
    recoveries.push({
      room: entry.room,
      status: 'ok',
      detail: 'dropped ' + dropped.length + ' abandoned queue entry(ies) for ' + entry.room
        + ' (permanent record: abandoned_by_doctor)',
    });
    return dropped.length;
  } catch (_e) {
    recoveries.push({
      room: entry.room,
      status: 'warn',
      detail: 'could not drop the abandoned queue entry(ies) for ' + entry.room,
    });
    return 0;
  }
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
  let locksHandled = 0;
  let abandonedHandled = 0;

  // Quick 260917-o1e (R3b): resolve the probe ONCE before the room loop, never
  // per room, so a 30-room --cascade-rooms sweep does one filesystem probe.
  // Precedence: an injected function wins, then an injected boolean, then the
  // real default probe.
  let encoderPresent;
  if (typeof c.probeEncoderPresence === 'function') {
    encoderPresent = !!c.probeEncoderPresence();
  } else if (typeof c.encoderPresent === 'boolean') {
    encoderPresent = c.encoderPresent;
  } else {
    encoderPresent = defaultProbeEncoderPresence();
  }

  for (const entry of rooms) {
    if (!entry || !entry.roomPath) continue;
    // Phase 379.1 Plan 05 (CPU379-07): dead or recycled locks and abandoned
    // entries are handled first. Neither touches a live job with a fresh
    // heartbeat.
    try {
      const lockCount = healLocks(entry, dryRun, recoveries);
      const dropCount = healAbandoned(entry, dryRun, recoveries);
      locksHandled += lockCount;
      abandonedHandled += dropCount;
    } catch (e) {
      errors.push({ room: entry.room, reason: scalar((e && e.message) || 'lock or queue heal threw') });
    }
    // Quick 260914-ntk (Finding 1a/5c), reworked by Quick 260917-o1e (R3b): a
    // room whose last derive skipped for lack of the semantic encoder is no
    // longer an unconditional skip. The memoized LIVE presence probe above
    // decides: absent keeps today's behavior; present clears the stale skip.
    if (entry.encoderUnavailable) {
      if (!encoderPresent) {
        // ABSENT: today's behaviour verbatim, unchanged warn text.
        recoveries.push({
          room: entry.room,
          status: 'warn',
          detail: 'derive re-enqueue skipped for ' + entry.room
            + ': the semantic encoder is not installed - run /mos:doctor --fix eureka',
        });
        continue;
      }
      if (dryRun) {
        projected += 1;
        recoveries.push({
          room: entry.room,
          status: 'projected',
          detail: 'would clear the stale encoder skip for ' + entry.room + ' and re-enqueue a derive',
        });
        continue;
      }
      // PRESENT and not dryRun: the requirement pairs the marker and the
      // enqueue without pinning an order; enqueue-then-marker is chosen
      // because it mirrors the existing non-encoder branch below (Part 7) and
      // because a marker written ahead of a failed enqueue would itself
      // become the next stale verdict -- the exact failure class this task
      // exists to close (T-o1e-06).
      try {
        const res = sweepMod().enqueueDerive(entry.roomPath);
        if (res && res.ok) {
          healed += 1;
          projected += 1;
          recoveries.push({
            room: entry.room,
            status: 'ok',
            detail: 'stale encoder skip cleared for ' + entry.room
              + ': encoder present now, derive re-enqueued',
          });
          writeHealAttemptMarker(entry.roomPath, entry.cascadeEdgeCount || 0);
        } else {
          errors.push({ room: entry.room, reason: scalar((res && res.reason) || 'enqueue_failed') });
        }
      } catch (e) {
        errors.push({ room: entry.room, reason: scalar((e && e.message) || 'enqueue threw') });
      }
      continue;
    }
    // An abandoned entry was dropped above by decision; only stuck entries that
    // are younger than the abandon age (or a zero-cascade room) re-enqueue.
    const wants = entry.needsHeal
      || ((entry.queueStuckCount || 0) - (entry.queueAbandonedCount || 0)) > 0;
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
        // Finding 5c: record the heal-attempt marker so a later
        // detectRoomHealth call can tell an ATTEMPT happened, not just infer
        // it from the current edge count.
        writeHealAttemptMarker(entry.roomPath, entry.cascadeEdgeCount || 0);
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
    locks_removed: dryRun ? 0 : locksHandled,
    abandoned_dropped: dryRun ? 0 : abandonedHandled,
    recoveries,
    errors,
    detail: 'graph-derive-health fix: ' + projected + ' room(s) '
      + (dryRun ? 'would be re-enqueued' : 're-enqueued') + '; '
      + (locksHandled + abandonedHandled > 0
        ? locksHandled + ' lock(s) and ' + abandonedHandled + ' abandoned entry(ies) '
          + (dryRun ? 'would be handled; ' : 'handled; ')
        : '')
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
  QUEUE_ABANDONED_DAYS,
  countAbandonedEntries,
  _test: { lockPathsFor, lockIsRemovable, lockReasons, DRAIN_LOCK_REL, SCOUT_LOCK_REL },
};
