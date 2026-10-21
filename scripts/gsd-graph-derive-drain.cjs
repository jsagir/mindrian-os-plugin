#!/usr/bin/env node
'use strict';

/*
 * Phase 169-05 (GDH-02 trigger / D-169-01 / D-169-08) -- the SessionStart DRAIN.
 * =============================================================================
 * The EXPENSIVE half of the enqueue-then-drain debounce, and the NAMED drain
 * trigger the SPEC (MEDIUM-5 / T-169-19) demands -- NOT enqueue-and-never-drain.
 * Structured exactly like the SHIPPED scripts/brain-derivation-drain.cjs: on the
 * SessionStart event it READS the room-local derive queue (written by the Stop
 * sweep, scripts/gsd-graph-derive-sweep.cjs), runs runDerivation once per queued
 * ENTRY through the LOCAL score-based producer (lib/core/graph-derive-classifier.cjs
 * scoreBasedDeriveFn), and then RECONCILES the queue: only a SUCCEEDED entry
 * clears, a FAILED entry is KEPT and retried up to MAX_DERIVE_ATTEMPTS, never
 * silently dropped. The per-write structural index hook stays untouched (Pattern 3
 * two-trigger split).
 *
 * DIVISION OF LABOR (RCA graph-derive-silent-clear item 4e -- the header used to
 * overstate the headless role as a blanket "runs once per room and CLEARS"):
 * headless (this file) = enqueue-drain + preserve-on-failure + score LOCALLY;
 * in-session /mos:graph --derive backfill (lib/core/graph-backfill.cjs) = the
 * heal-first UNIVERSAL NET for everything the headless path structurally cannot
 * reach (sentinel-less artifact folders, rooms that never had a Stop-hook fire).
 * Both DEFAULT to the SAME classifier.scoreBasedDeriveFn producer, so the two
 * paths cannot silently derive different edges from the same room; that parity is
 * pinned by tests/test-233-drain-backfill-producer-parity.cjs, not by this comment.
 *
 * Failure discipline: exit-0, never-block, but NEVER SILENT ROT (RCA
 * graph-derive-silent-clear Defect 4a). A SessionStart hook must never block
 * session start, so the exit code is ALWAYS 0 on any non-fatal path. But a room
 * whose derivation THROWS is NO LONGER dropped: its queue entry is KEPT for the
 * next drain (the retry signal survives), a failure record is appended to
 * <room>/.mindrian/graph-derive-failures.json, and only after
 * MAX_DERIVE_ATTEMPTS failed passes is the entry dropped -- with a
 * permanent-failure record so a doctor check can surface it (never a silent
 * drop of a still-recoverable room). Only a SUCCESSFUL derive clears the entry.
 * The encoder-unavailable skip is a DISTINCT, DISCLOSED path (it writes a
 * derivation_skipped memory_event and clears -- a deliberate, visible skip, not
 * a silent rot). The explicit /mos:graph --derive backfill stays the universal
 * net for anything missed.
 *
 * PHASE 379.1 (CPU379-01 to CPU379-05, CPU379-10): the background path never
 * materializes all pairs. One room-scope entry once became 2,338,203 pairs, 2 encoder
 * calls per pair, 11 ONNX threads, no time limit and a lock that expired under a live
 * worker (debug file drain-and-scout-runaway-cpu-wsl-windows, E3 to E5). Now:
 *   - EMBED ONCE: each artifact is embedded at most once per content hash
 *     (classifier.attachVectors, cache file <room>/.mindrian/graph-derive-vectors.json)
 *     and the cached vectors reach scoreMeasured as opts.vectors.
 *   - PRUNER: classifier.buildCandidatePairs keeps the top-k cosine candidates above
 *     the INFORMS floor, at most N x k pairs (k = probe-k.json chosen_k).
 *   - CURSOR: one drain scores at most MINDRIAN_DERIVE_MAX_PAIRS_PER_DRAIN pairs (5000)
 *     from entry.cursor; the entry clears only when the cursor reaches the end.
 *   - CEILING: an entry whose bound min(N x k, N x (N - 1) / 2) is above
 *     MINDRIAN_DERIVE_MAX_PAIRS_PER_ENTRY (50000) clears with a disclosed
 *     derivation_skipped (pair_cap_exceeded). It is never silent.
 *   - ATTEMPT RECORD: attempts, last_attempt_at and worker_pid are written BEFORE the
 *     first pair; progress resets attempts; after MAX_DERIVE_ATTEMPTS drains without
 *     progress the entry drops with a permanent failure record.
 *   - BUDGET: MINDRIAN_DERIVE_BUDGET_MS (240000) is checked inside every loop that
 *     can run long: between embed batches, per row of the cosine pass, between pairs.
 *   - LOCK: lib/core/job-lock.cjs (PID liveness and process identity, never age).
 *   - SCOPE: every completion and skip event carries scope_excluded_dirs,
 *     scope_excluded_artifacts and scope_overbroad, so a shrunken artifact set is
 *     visible in the record (T-379.1-01).
 * pairs_pruned counts candidate pairs the pruner did not score, not edges lost; the
 * edge-loss evidence is the recall in tests/fixtures/379.1/probe-k.json.
 *
 * Canon Part 8: LOCAL only. The drain runs the LOCAL runDerivation composer
 *   (lib/core/graph-derivation.cjs), which reads LOCAL artifact text and writes
 *   LOCAL proposed typed edges through the navigation chokepoint. It opens ZERO
 *   Brain wire (brain-derive is the one Brain-touching deriver, boundary-scanned
 *   in Plan 06).
 * Canon Part 3/9: the derivation lands edges PROPOSED; the drain NEVER
 *   auto-confirms. The human confirms via the existing confirmNode path.
 *
 * CLI modes:
 *   node scripts/gsd-graph-derive-drain.cjs            -- SessionStart hook: drain
 *                                                         the active/resolved room queue.
 *   node scripts/gsd-graph-derive-drain.cjs --room <d> -- drain a specific room's queue
 *                                                         (used by the round-trip test).
 *   node scripts/gsd-graph-derive-drain.cjs --dry-run  -- report the drain plan, do not run.
 *   node scripts/gsd-graph-derive-drain.cjs --worker --room <d> --report-usage
 *                                                      -- the worker; writes ONE JSON usage
 *                                                         line (schema drain-usage-v1) to stderr.
 *   MINDRIAN_DERIVE_SKIP=1                             -- the operator switch: exit 0, no work.
 *
 * What bounds what (Phase 379.1): the worker runs at low priority (os.setPriority), with
 * a backstop timer that ends an idle or async stall, and every synchronous loop it runs
 * is deadline-checked from the inside (see armBackstop below). The hook entry stays the
 * 5 s self-detach and never touches the worker caps.
 *
 * Quick 260917-o1e (R5a), two facts that cost a session to rediscover:
 *   - this script NEVER reads stdin. Piping a room path or a JSON payload into
 *     it does nothing; the invocation simply drains the resolved room's queue.
 *   - the bare entry point (main(), below) RE-SPAWNS itself detached with
 *     --worker and exits immediately, so a foreground run that appears to do
 *     nothing is behaving correctly -- the real drain is running in the
 *     background with no hook budget over it. The manual, in-process run that
 *     actually shows the drain working is:
 *
 *     MOS_NO_DETACHED_DERIVE=1 node scripts/gsd-graph-derive-drain.cjs --room <dir> [--dry-run]
 *
 * Pure CJS, node built-ins only, zero npm deps. No em-dashes (CLAUDE.md).
 */

const fs = require('node:fs');
const path = require('node:path');

const sweep = require('./gsd-graph-derive-sweep.cjs');

// The score-based producer swap that RESEARCH names as the ACTUAL fix (Part 7:
// reuse the Phase-169 runDerivation COMPOSER; only the producer changes). Required
// on the DEFAULT path only. NO require of graph-candidate-producer here (D-03
// amended): the classifier's scoreBasedDeriveFn replaces the LLM producer.
const classifier = require('../lib/core/graph-derive-classifier.cjs');
const { scoreMeasured } = require('../lib/core/rs-differential-scorer.cjs');
// Phase 379.1 (CPU379-05): the PID-checked, heartbeating job lock replaces the mtime lock.
const jobLock = require('../lib/core/job-lock.cjs');
const { resolveMaxPairsPerEntry } = classifier;

// Phase 379.1 caps, each env-validated (a positive integer, else the default).
const DEFAULT_MAX_PAIRS_PER_DRAIN = 5000;
const DEFAULT_BUDGET_MS = 240000;

function resolvePositiveInt(envName, def) {
  const raw = process.env[envName];
  if (typeof raw === 'string' && /^\d+$/.test(raw.trim())) {
    const v = Number(raw.trim());
    if (Number.isSafeInteger(v) && v > 0) return v;
  }
  return def;
}

// Pairs one drain may score (D-379.1-01 safety net behind the top-k pruner).
function resolveMaxPairsPerDrain() {
  return resolvePositiveInt('MINDRIAN_DERIVE_MAX_PAIRS_PER_DRAIN', DEFAULT_MAX_PAIRS_PER_DRAIN);
}

// Wall-clock budget of one drain, checked inside every loop that can run long.
function resolveBudgetMs() {
  return resolvePositiveInt('MINDRIAN_DERIVE_BUDGET_MS', DEFAULT_BUDGET_MS);
}

// ---------------------------------------------------------------------------
// CLI parser
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const out = { roomDir: null, dryRun: false, worker: false, reportUsage: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--room' && argv[i + 1]) { out.roomDir = argv[i + 1]; i += 1; }
    else if (argv[i] === '--dry-run') { out.dryRun = true; }
    else if (argv[i] === '--worker') { out.worker = true; }
    else if (argv[i] === '--report-usage') { out.reportUsage = true; }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Drain (the expensive runDerivation pass)
// ---------------------------------------------------------------------------

// Remove ONLY the drained snapshot entries from the queue. The drain snapshots
// the queue, spends seconds-to-minutes scoring, then clears -- a blanket
// {entries: []} rewrite here used to erase any entry a live session enqueued
// AFTER the snapshot (a silently lost derive request). So: re-read the queue,
// drop the entries matching the drained snapshot by the (roomDir, filePath,
// enqueued_at) tuple, keep everything else, and write ATOMICALLY via
// sweep.writeQueue (tmp + rename). Best-effort: a failed clear means the next
// drain re-attempts (idempotent).
function clearQueue(resolved, drainedEntries) {
  try {
    const entryKey = (e) => [
      path.resolve((e && e.roomDir) || ''),
      (e && typeof e.filePath === 'string' && e.filePath.length > 0) ? path.resolve(e.filePath) : '',
      (e && e.enqueued_at) || '',
    ].join('|');
    let kept = [];
    if (Array.isArray(drainedEntries)) {
      const drainedKeys = new Set(drainedEntries.map(entryKey));
      const current = sweep.readQueue(resolved);
      const currentEntries = Array.isArray(current.entries) ? current.entries : [];
      kept = currentEntries.filter((e) => !drainedKeys.has(entryKey(e)));
    }
    sweep.writeQueue(resolved, { entries: kept });
    return kept.length;
  } catch (_e) {
    return 0;
  }
}

// RCA graph-derive-silent-clear Defect 4a: keep-on-failure + a visible failure
// log + a retry cap. The old drain pushed a THROWN room to `drained` and then
// blanket-cleared its queue entry with NO trace -- so a transient failure (a
// cold encoder, a locked db, a producer bug) destroyed the retry signal AND was
// invisible. reconcileQueue is the success-vs-failure-aware replacement for the
// derive loops' clearQueue: SUCCEEDED entries are cleared (the existing
// round-trip contract), FAILED entries are KEPT with a bumped `failures`
// counter, and only after MAX_DERIVE_ATTEMPTS is a failed entry dropped -- each
// failure appended to a room-local JSON log so a human / doctor can see it.
const MAX_DERIVE_ATTEMPTS = 5;

function failureLogPath(resolved) {
  return path.join(resolved, '.mindrian', 'graph-derive-failures.json');
}

// Truncate an error to a short SCALAR string. These are producer / composer /
// sqlite error messages (fixed strings, not artifact body), but the cap is a
// belt-and-suspenders guard: the log is LOCAL-disk only (never egresses; Part 8
// is not even in play), yet a bounded scalar keeps it honest and small.
function scalarError(err) {
  const msg = (err && typeof err.message === 'string') ? err.message : String(err || 'unknown_error');
  return msg.slice(0, 200);
}

// Append a failure record to <room>/.mindrian/graph-derive-failures.json. The
// log is a { failures: [...] } object, bounded to the most-recent MAX_LOG rows
// so a permanently-broken room never grows it unbounded. Atomic tmp+rename write
// (the sweep idiom). Advisory: a failed log write NEVER blocks the drain.
function appendFailureLog(resolved, record) {
  const MAX_LOG = 200;
  try {
    const p = failureLogPath(resolved);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    let log = [];
    try {
      const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (Array.isArray(parsed)) log = parsed;
      else if (parsed && Array.isArray(parsed.failures)) log = parsed.failures;
    } catch (_e) { log = []; }
    log.push(record);
    if (log.length > MAX_LOG) log = log.slice(log.length - MAX_LOG);
    const tmp = p + '.tmp-' + process.pid + '-' + Date.now().toString(36);
    fs.writeFileSync(tmp, JSON.stringify({ failures: log }, null, 2));
    fs.renameSync(tmp, p);
  } catch (_e) {
    /* advisory: a failed log write must never block the drain. */
  }
}

// The success-vs-failure-aware queue reconciler (Defect 4a). Re-reads the queue
// (so entries a live session enqueued DURING the drain window are preserved),
// then per current entry:
//   - matches a SUCCEEDED snapshot entry  -> DROP (drained OK; the existing
//     round-trip clear contract).
//   - matches a FAILED snapshot entry     -> bump `failures`; if it hit
//     MAX_DERIVE_ATTEMPTS, DROP it with a permanent-failure log record, else
//     KEEP it (retry next drain) with the bumped counter; either way append a
//     failure record.
//   - matches neither (live-enqueued in the window) -> KEEP untouched.
// Written ATOMICALLY via sweep.writeQueue. Returns the kept count. Best-effort:
// a failed reconcile means the next drain re-attempts (idempotent, keys stable).
function reconcileQueue(resolved, succeededEntries, failedEntries) {
  try {
    const entryKey = (e) => [
      path.resolve((e && e.roomDir) || ''),
      (e && typeof e.filePath === 'string' && e.filePath.length > 0) ? path.resolve(e.filePath) : '',
      (e && e.enqueued_at) || '',
    ].join('|');

    const succeededKeys = new Set(
      (Array.isArray(succeededEntries) ? succeededEntries : []).map(entryKey)
    );
    const failedByKey = new Map();
    for (const f of (Array.isArray(failedEntries) ? failedEntries : [])) {
      if (f && f.entry) failedByKey.set(entryKey(f.entry), f);
    }

    const current = sweep.readQueue(resolved);
    const currentEntries = Array.isArray(current.entries) ? current.entries : [];
    const kept = [];
    const nowIso = new Date().toISOString();

    for (const e of currentEntries) {
      const k = entryKey(e);
      if (succeededKeys.has(k)) { continue; } // drained OK -> clear.
      if (failedByKey.has(k)) {
        const f = failedByKey.get(k);
        const priorFailures = (e && Number.isFinite(e.failures)) ? e.failures : 0;
        const failures = priorFailures + 1;
        const permanent = failures >= MAX_DERIVE_ATTEMPTS;
        appendFailureLog(resolved, {
          roomDir: path.resolve((e && e.roomDir) || resolved),
          filePath: (e && typeof e.filePath === 'string' && e.filePath.length > 0)
            ? path.basename(e.filePath) : null,
          enqueued_at: (e && e.enqueued_at) || null,
          failures: failures,
          error: scalarError(f && f.error),
          last_attempt: nowIso,
          permanent: permanent,
        });
        if (permanent) { continue; } // capped -> give up; the log carries the signal.
        kept.push(Object.assign({}, e, { failures: failures, last_failure_at: nowIso }));
        continue;
      }
      kept.push(e); // live-enqueued during the window -> keep untouched.
    }

    sweep.writeQueue(resolved, { entries: kept });
    return kept.length;
  } catch (_e) {
    return 0;
  }
}

// Single-flight guard (one drain at a time per room). Step 2b spawns one
// detached drain per markdown write; a 10-file batch used to spawn 10 drains
// that ALL read the queue before any finished. The lock makes the first drain
// the owner; the rest return immediately and leave the queue to it.
// Phase 379.1 (CPU379-05): the owner is decided by PID liveness and process
// identity (lib/core/job-lock.cjs), never by lock-file age. The old 10-minute
// mtime reclaim displaced a live worker (debug file E5) and let two workers
// score the same entries. A live holder is never displaced inside the 6 h hard
// ceiling; a dead or recycled one is reclaimed; release is owner-checked.
function drainLockPath(resolved) {
  return path.join(resolved, '.mindrian', 'graph-derive-drain.lock');
}

// The artifact scope of a target (stats feed the disclosure). Never throws.
function scopeOf(target) {
  try {
    return require('../lib/core/artifact-scope.cjs').loadScope(target);
  } catch (_e) {
    return null;
  }
}

// The three scalar scope fields every completion and skip event carries
// (T-379.1-01): a reader sees how much the declaration and the markers removed.
function scopeFields(scope) {
  const st = (scope && scope.stats && typeof scope.stats === 'object') ? scope.stats : {};
  const num = (v) => (Number.isFinite(v) ? v : 0);
  return {
    scope_excluded_dirs: num(st.excluded_dirs),
    scope_excluded_artifacts: num(st.excluded_md),
    scope_overbroad: !!(scope && scope.overbroad === true),
    scope_prewalk_truncated: !!(st.truncated === true),
  };
}

// Entry identity: the (roomDir, filePath, enqueued_at) tuple. Never changed by a patch.
function entryKey(e) {
  return [
    path.resolve((e && e.roomDir) || ''),
    (e && typeof e.filePath === 'string' && e.filePath.length > 0) ? path.resolve(e.filePath) : '',
    (e && e.enqueued_at) || '',
  ].join('|');
}

// Patch ONE queue entry in place: re-read the queue (entries a live session
// enqueued during the drain survive), find the entry by key, merge the fields,
// write atomically through sweep.writeQueue. The key tuple is never changed.
// Best-effort: a failed patch means the next drain re-attempts. (CPU379-04)
function patchEntry(resolved, entry, fields) {
  try {
    const key = entryKey(entry);
    const q = sweep.readQueue(resolved);
    const list = Array.isArray(q.entries) ? q.entries : [];
    let hit = false;
    const next = list.map((e) => {
      if (entryKey(e) !== key) return e;
      hit = true;
      const merged = Object.assign({}, e, fields);
      merged.roomDir = e.roomDir;
      if (e.filePath !== undefined) merged.filePath = e.filePath;
      merged.enqueued_at = e.enqueued_at;
      return merged;
    });
    if (hit) sweep.writeQueue(resolved, { entries: next });
    return hit;
  } catch (_e) {
    return false;
  }
}

// A cursor read from the queue file is untrusted (T-379.1-07): it is an integer
// in [0, pairs_total] or it reads as 0.
function clampCursor(entry) {
  const c = entry && entry.cursor;
  const total = entry && entry.pairs_total;
  if (Number.isInteger(c) && Number.isInteger(total) && c >= 0 && c <= total) return c;
  return 0;
}

// Count the pairs a target/entry WOULD score (for the disclosure marker's
// pairs_skipped scalar). Pure enumeration; builds no pair objects for a room
// entry (D-379.1-11); never throws.
function pairCountFor(target, entry) {
  try {
    const hasFile = entry && typeof entry.filePath === 'string' && entry.filePath.length > 0;
    return hasFile
      ? classifier.buildNewArtifactPairs(target, entry.filePath).length
      : classifier.countAllPairs(target);
  } catch (_e) {
    return 0;
  }
}

// D-379.1-08: the probe sentences. Two about the same subject, two about unrelated
// subjects. A working encoder scores the similar pair clearly above the unrelated pair.
const PROBE_SIMILAR = [
  'The cat sat on the warm mat by the window.',
  'A cat was sitting on a warm mat near the window.',
];
const PROBE_UNRELATED = [
  'Quarterly tax filings are due every April.',
  'Volcanic ash clouds disrupt transatlantic flights.',
];

// D-04 probe: ONE score over two short literal probe strings to learn whether
// the semantic encoder is available. opts.probeOpts is merged so a test can
// force _forceUnavailable:true (skip path) or inject an encodeFn (available
// path). D-379.1-08: when no encodeFn is injected, or probeOpts.strictProbe is
// true, the probe ALSO scores a known-similar pair and an unrelated pair; the
// encoder counts as available only when the similar pair scores clearly above
// the unrelated pair, below identity, and the results are not all zero.
// Returns { available: boolean }. Never throws.
async function probeEncoder(probeOpts) {
  try {
    const opts = (probeOpts && typeof probeOpts === 'object') ? Object.assign({}, probeOpts) : {};
    const strict = opts.strictProbe === true || typeof opts.encodeFn !== 'function';
    delete opts.strictProbe;
    const res = await scoreMeasured('probe alpha reference', 'probe beta reference', opts);
    if (!res || res.semantic === null || res.semantic === undefined || res.warning === 'encoder_unavailable') {
      return { available: false };
    }
    if (!strict) return { available: true };
    const sim = await scoreMeasured(PROBE_SIMILAR[0], PROBE_SIMILAR[1], opts);
    const unrel = await scoreMeasured(PROBE_UNRELATED[0], PROBE_UNRELATED[1], opts);
    const s = sim && sim.semantic;
    const u = unrel && unrel.semantic;
    if (typeof s !== 'number' || typeof u !== 'number' || !Number.isFinite(s) || !Number.isFinite(u)) {
      return { available: false };
    }
    if (s === 0 && u === 0) return { available: false };
    if (!(s > u + 0.05) || !(s < 0.9999)) return { available: false };
    return { available: true };
  } catch (_e) {
    return { available: false };
  }
}

// D-04 disclosure: mark the skip at the point of occurrence (SEED-059). Opens the
// room db, logs ONE derivation_skipped memory_event with SCALAR-only fields
// (Part 8), closes. dedupe_key rides the logEvent 60s idempotency so a repeat
// forced-unavailable drain does NOT write a second marker. Soft-fail: any error
// is swallowed (advisory, never blocking). Phase 379.1: `reason` defaults to
// 'encoder_unavailable' (also 'pair_cap_exceeded', 'attempts_exhausted') and the
// scope fields say what the artifact scope removed.
function discloseSkip(target, entry, pairsSkippedOverride, reason, scope) {
  let openRoomDb;
  let closeRoomDb;
  let navigation;
  try {
    ({ openRoomDb, closeRoomDb } = require('../lib/core/room-db.cjs'));
    navigation = require('../lib/core/navigation.cjs');
  } catch (_e) {
    return;
  }
  let db = null;
  try {
    db = openRoomDb(target);
    const hasFile = entry && typeof entry.filePath === 'string' && entry.filePath.length > 0;
    const trigger = hasFile ? path.basename(entry.filePath) : 'room-sweep';
    const why = (typeof reason === 'string' && reason.length > 0) ? reason : 'encoder_unavailable';
    navigation.logMemoryEvent(db, 'derivation_skipped', Object.assign({
      reason: why,
      trigger: trigger,
      pairs_skipped: (typeof pairsSkippedOverride === 'number')
        ? pairsSkippedOverride
        : pairCountFor(target, entry),
      dedupe_key: 'derivation_skipped:'
        + (why === 'encoder_unavailable' ? '' : why + ':') + path.resolve(target),
      source_path: 'derivation:skip',
      created_by: 'system',
    }, scopeFields(scope)));
  } catch (_e) {
    /* advisory: never block the write path (Phase 210 caution). */
  } finally {
    if (db) { try { closeRoomDb(db); } catch (_ce) { /* ignore */ } }
  }
}

// Quick 260917-o1e (R1b): the SUCCESS-side mirror of discloseSkip above. Marks
// completion at the point of occurrence when a derive pass finishes WITH the
// encoder available: same lazy require pair, same openRoomDb/finally
// closeRoomDb, same try/catch that swallows every error (advisory, never
// blocking), same trigger computation. `reason` is deliberately NOT part of
// this payload -- there is nothing to explain about a success.
// Phase 379.1: pairs_pruned counts the candidate pairs the pruner did NOT score
// (not edges lost; the recall in tests/fixtures/379.1/probe-k.json is the
// edge-loss evidence), and the scope fields say what the scope removed.
function discloseCompletion(target, entry, pairsScored, edgesWritten, scope, pairsPruned) {
  let openRoomDb;
  let closeRoomDb;
  let navigation;
  try {
    ({ openRoomDb, closeRoomDb } = require('../lib/core/room-db.cjs'));
    navigation = require('../lib/core/navigation.cjs');
  } catch (_e) {
    return;
  }
  let db = null;
  try {
    db = openRoomDb(target);
    const hasFile = entry && typeof entry.filePath === 'string' && entry.filePath.length > 0;
    const trigger = hasFile ? path.basename(entry.filePath) : 'room-sweep';
    navigation.logMemoryEvent(db, 'derivation_completed', Object.assign({
      pairs_scored: pairsScored,
      edges_written: edgesWritten,
      pairs_pruned: (Number.isFinite(pairsPruned) ? pairsPruned : 0),
      trigger: trigger,
      dedupe_key: 'derivation_completed:' + path.resolve(target),
      source_path: 'derivation:complete',
      created_by: 'system',
    }, scopeFields(scope)));
  } catch (_e) {
    /* advisory: never block the write path (Phase 210 caution). */
  } finally {
    if (db) { try { closeRoomDb(db); } catch (_ce) { /* ignore */ } }
  }
}

// The plain pair sequence, used ONLY when a caller injected its own deriveFn or
// a probeOpts encoder seam (tests, and the 224 and 233 parity suites). It never
// builds more than cursor + limit pair objects. The production path never calls it.
function legacyPairsFor(target, cursor, limit) {
  // LEGACY_INJECTED_PAIRS
  return classifier.buildAllPairs(target, { limit: cursor + limit }).slice(cursor);
}

// The DEFAULT (score-based) worker path. ASYNC because the score-based producer
// is async and runDerivation's synchronous loop treats a Promise return as [] (the
// Wave-1 note): candidates are PRE-RESOLVED per pair, then fed to runDerivation via
// a synchronous deriveFn wrapper so the Phase-169 composer stays untouched.
//
// Phase 379.1: a room-scope entry is processed in slices. Per entry: (a) the attempt
// is recorded BEFORE any pair; (b) the artifacts get cached vectors (embed once per
// content hash); (c) the top-k pruner picks the candidate pairs (at most N x k);
// (d) one drain scores at most resolveMaxPairsPerDrain() of them, from the cursor;
// (e) the entry clears only when the cursor reaches the end, or by a disclosed skip.
async function drainScoreBased(resolved, entries, options, result) {
  const startedAt = Date.now();
  // Single-flight: only one drain may own this room's queue at a time (the
  // per-write spawn stampede otherwise scores the same entries concurrently).
  const lock = jobLock.acquire(drainLockPath(resolved), { job: 'graph-derive-drain' });
  if (!lock || lock.ok !== true) {
    result.remaining = entries.length;
    result.locked = true;
    result.lock_reason = (lock && lock.reason) || 'held';
    result.lock_stale_heartbeat = !!(lock && lock.stale_heartbeat);
    return result;
  }
  try {
    let runDerivation;
    try {
      runDerivation = require('../lib/core/graph-derivation.cjs').runDerivation;
    } catch (_e) {
      runDerivation = null;
    }

    const injectedDerive = (typeof options.deriveFn === 'function');
    const deriveFn = injectedDerive ? options.deriveFn : classifier.scoreBasedDeriveFn;

    // D-04: probe the encoder ONCE before touching any pair. Unavailable means skip
    // EVERY entry, disclose per entry, clear the queue, and return ok:true. There is
    // NO similarity-only degrade path (a symmetric score cannot honestly type edges).
    // Quick 260917-o1e (R1b): this IS the skip path -- it must never also write a
    // derivation_completed disclosure, since the encoder was never available here.
    const probe = await probeEncoder(options.probeOpts);
    if (!probe.available) {
      for (const entry of entries) {
        const target = entry && typeof entry.roomDir === 'string' ? entry.roomDir : '';
        if (!target) { continue; }
        discloseSkip(target, entry, undefined, 'encoder_unavailable', scopeOf(target));
        result.drained.push(target);
      }
      result.remaining = clearQueue(resolved, entries);
      return result;
    }

    const deadline = startedAt + resolveBudgetMs();
    const maxPerDrain = resolveMaxPairsPerDrain();
    const probeOpts = options.probeOpts;
    // A caller-injected encoder seam owns the semantic leg: no cached vectors then,
    // unless the caller also injected a batch embedFn (the 379.1 tests do).
    const seam = !!(probeOpts && (typeof probeOpts.encodeFn === 'function' || probeOpts._forceUnavailable));
    const useVectors = !injectedDerive && (typeof options.embedFn === 'function' || !seam);

    // Defect 4a: partition the snapshot into SUCCEEDED (clear) vs FAILED (keep +
    // log + cap). The old code pushed a thrown room to `drained` and cleared it.
    const succeeded = [];
    const failed = [];
    let processed = 0;
    for (const entry of entries) {
      const target = entry && typeof entry.roomDir === 'string' ? entry.roomDir : '';
      if (!target) { continue; }
      // The budget guards the whole drain; the first entry always runs so a tiny
      // budget still makes progress.
      if (processed > 0 && Date.now() > deadline) { break; }
      processed += 1;
      try {
        const hasFile = typeof entry.filePath === 'string' && entry.filePath.length > 0;
        let scope = null;

        // (a) CPU379-04: record the attempt BEFORE any pair, so a crash is counted.
        const priorAttempts = (Number.isInteger(entry.attempts) && entry.attempts >= 0) ? entry.attempts : 0;
        const attempts = priorAttempts + 1;
        if (attempts > MAX_DERIVE_ATTEMPTS) {
          scope = scopeOf(target);
          appendFailureLog(resolved, {
            roomDir: path.resolve(target),
            filePath: hasFile ? path.basename(entry.filePath) : null,
            enqueued_at: entry.enqueued_at || null,
            failures: priorAttempts,
            error: 'attempts_exhausted_without_progress',
            last_attempt: new Date().toISOString(),
            permanent: true,
          });
          discloseSkip(target, entry, pairCountFor(target, entry), 'attempts_exhausted', scope);
          result.drained.push(target);
          succeeded.push(entry);
          continue;
        }
        patchEntry(resolved, entry, {
          attempts: attempts,
          last_attempt_at: new Date().toISOString(),
          worker_pid: process.pid,
        });

        // Pre-resolve the async producer per pair, then feed a SYNC deriveFn to the
        // untouched Phase-169 composer (producer swap; runDerivation's sync loop
        // rejects a Promise return).
        //
        // D-04 TOCTOU closure: the one-time probe does not prove the encoder
        // survives the whole pass. On the DEFAULT path the producer receives (a)
        // the SAME seam the probe used (scoreOpts = options.probeOpts, so probe
        // and scoring can never diverge onto different encoders) and (b) an
        // onOutcome counter; when any pair came back encoder_unavailable AFTER
        // the passing probe, the derivation_skipped disclosure is still written
        // with the affected pair count instead of reporting a silent success.
        let encoderFailedPairs = 0;
        const producerOpts = injectedDerive ? undefined : {
          scoreOpts: probeOpts,
          onOutcome: (o) => {
            if (o && o.outcome === 'encoder_unavailable') encoderFailedPairs += 1;
          },
        };

        // (b) to (d): decide the slice of pairs this drain scores.
        let slice = [];
        let pairsTotal = 0;
        let pairsPruned = 0;
        let artifactCount = 0;
        let scopeHash = null;
        let cursorStart = 0;
        let vectorsReady = false;

        if (!useVectors) {
          scope = scopeOf(target);
          if (hasFile) {
            slice = classifier.buildNewArtifactPairs(target, entry.filePath); // Req 6: O(n)
            pairsTotal = slice.length;
          } else {
            pairsTotal = classifier.countAllPairs(target);
            const c = clampCursor(entry);
            cursorStart = (entry.pairs_total === pairsTotal) ? c : 0;
            slice = legacyPairsFor(target, cursorStart, maxPerDrain);
          }
        } else {
          const ws = classifier.enumerateArtifactsWithScope(target);
          const artifacts = ws.artifacts;
          scope = ws.scope;
          artifactCount = artifacts.length;
          const n = artifacts.length;
          const k = classifier.resolvePruneK();
          const allPairs = (n * (n - 1)) / 2;
          if (!hasFile) {
            // D-379.1-01 ceiling: the most pairs this entry could ever score.
            const bound = Math.min(n * k, allPairs);
            if (bound > resolveMaxPairsPerEntry()) {
              discloseSkip(target, entry, bound, 'pair_cap_exceeded', scope);
              result.drained.push(target);
              succeeded.push(entry);
              continue;
            }
          }
          // eslint-disable-next-line no-await-in-loop
          const att = await classifier.attachVectors(target, artifacts, {
            embedFn: options.embedFn,
            deadlineMs: deadline,
          });
          if (att.encoderUnavailable) {
            // The probe passed and the encoder then failed: a mid-run death. Disclose,
            // keep the entry for the next drain (the attempt count caps the retries).
            discloseSkip(target, entry, Math.max(att.misses_left, 1), 'encoder_unavailable', scope);
            continue;
          }
          if (att.misses_left > 0) {
            // Budget hit while embedding. The vectors saved so far are not lost.
            patchEntry(resolved, entry, {
              vectors_ready: false,
              artifact_count: artifactCount,
              attempts: att.embedded > 0 ? 0 : attempts,
            });
            break;
          }
          vectorsReady = true;
          let candidatePairs;
          if (hasFile) {
            const newId = classifier._test.artifactId(target, entry.filePath);
            const newArt = artifacts.find((x) => x.id === newId);
            if (newArt) {
              candidatePairs = artifacts.filter((x) => x.id !== newId).map((ex) => ({ a: newArt, b: ex }));
            } else {
              candidatePairs = classifier.buildNewArtifactPairs(target, entry.filePath);
            }
            pairsTotal = candidatePairs.length;
            scopeHash = null;
          } else {
            const cand = classifier.buildCandidatePairs(artifacts, {
              k: k,
              floor: classifier._test.resolveFloors().informs,
              deadlineMs: deadline,
            });
            if (cand.deadline_hit) {
              // The vectors are cached; only the cosine pass is lost. Keep the entry.
              patchEntry(resolved, entry, { vectors_ready: true, artifact_count: artifactCount });
              break;
            }
            candidatePairs = cand.pairs;
            pairsTotal = cand.total;
            pairsPruned = cand.pruned;
            scopeHash = cand.scopeHash;
          }
          const c = clampCursor(entry);
          const sameScope = (entry.pairs_total === pairsTotal)
            && (hasFile || entry.scope_hash === scopeHash);
          cursorStart = sameScope ? c : 0;
          slice = hasFile
            ? candidatePairs.slice(cursorStart)
            : candidatePairs.slice(cursorStart, cursorStart + maxPerDrain);
        }

        // (e) Score the slice. scoreMeasured is async, so the event loop turns between
        // pairs and the worker backstop timer can fire here. The deadline is checked
        // between pairs; at least one pair runs so a drain always makes progress.
        const candidatesByPair = new Map();
        const scoredPairs = [];
        for (const pair of slice) {
          if (scoredPairs.length > 0 && Date.now() > deadline) { break; }
          // eslint-disable-next-line no-await-in-loop
          const cands = await deriveFn({ roomDir: target, artifactPair: pair }, producerOpts);
          candidatesByPair.set(pair, Array.isArray(cands) ? cands : []);
          scoredPairs.push(pair);
        }
        const syncDeriveFn = (step) => candidatesByPair.get(step && step.artifactPair) || [];
        // (f) The untouched composer, bounded by the slice.
        let runRes = null;
        if (typeof runDerivation === 'function') {
          runRes = runDerivation({ roomDir: target, deriveFn: syncDeriveFn, artifactPairs: scoredPairs });
        }
        const edgesNow = (runRes && Array.isArray(runRes.edges)) ? runRes.edges.length : 0;
        const priorEdges = (cursorStart > 0 && Number.isInteger(entry.edges_written)) ? entry.edges_written : 0;
        const edgesTotal = priorEdges + edgesNow;
        const newCursor = cursorStart + scoredPairs.length;
        const done = newCursor >= pairsTotal;

        if (encoderFailedPairs > 0) {
          discloseSkip(target, entry, encoderFailedPairs, 'encoder_unavailable', scope);
        } else if (done) {
          // Quick 260917-o1e (R1b): the `else` arm, not a second independent
          // `if` -- a pass that degraded mid-run (encoderFailedPairs > 0) is a
          // skip, never a completion, and the two must never both fire for one
          // pass (T-o1e-05).
          discloseCompletion(target, entry, pairsTotal, edgesTotal, scope, pairsPruned);
        }
        if (encoderFailedPairs > 0 || done) {
          result.drained.push(target);
          succeeded.push(entry);
        } else {
          // (g) Progress: the entry stays, with the cursor and the counters.
          patchEntry(resolved, entry, {
            cursor: newCursor,
            pairs_total: pairsTotal,
            pairs_pruned: pairsPruned,
            artifact_count: artifactCount,
            scope_hash: scopeHash,
            vectors_ready: vectorsReady,
            edges_written: edgesTotal,
            attempts: scoredPairs.length > 0 ? 0 : attempts,
          });
        }
        // (h) The budget is spent: stop after this entry's patch.
        if (Date.now() > deadline) { break; }
      } catch (e) {
        // Defect 4a: a faulting room is KEPT for the next drain (retry signal
        // survives) and the failure is LOGGED -- never a silent drop.
        if (!Array.isArray(result.failed)) result.failed = [];
        result.failed.push(target);
        failed.push({ entry: entry, error: e });
      }
    }

    result.remaining = reconcileQueue(resolved, succeeded, failed);
    return result;
  } finally {
    jobLock.release(lock.handle);
  }
}

/**
 * drainDerive(roomDir, opts) -> { ok, drained, remaining }  (LEGACY: sync object)
 *                            -> Promise<{ ok, drained, remaining }>  (DEFAULT path)
 *
 * The real score-based derivation worker (Phase 224-02, Req 1 + Req 6 + D-04),
 * built to preserve every Phase-169 seam:
 *
 *   LEGACY seam: when opts.deriveRunner IS injected, the round-trip test spy path
 *   is preserved BYTE-FOR-BYTE -- the drain keeps the legacy call shape
 *   runDerivation({roomDir: target}) and SKIPS the encoder probe entirely (so the
 *   spy that only reads argObj.roomDir keeps working). This path stays SYNCHRONOUS
 *   and returns the result object directly (the Phase-169 test consumes it sync).
 *
 *   DEFAULT path: builds O(n) new-artifact pairs (per-write) or the full backfill
 *   pairing (room-scoped), injects the classifier scoreBasedDeriveFn producer into
 *   the untouched runDerivation composer, and implements D-04 (encoder-unavailable
 *   skip + disclosure). This path is ASYNC and returns a Promise.
 *
 * Never throws. Every failure path stays soft (advisory; the explicit backfill is
 * the universal net).
 */
function drainDerive(roomDir, opts) {
  const options = opts || {};
  const result = { ok: true, drained: [], remaining: 0, failed: [] };
  if (typeof roomDir !== 'string' || roomDir.length === 0) {
    result.ok = false;
    return result;
  }
  const resolved = path.resolve(roomDir);

  const q = sweep.readQueue(resolved);
  const entries = Array.isArray(q.entries) ? q.entries : [];
  if (entries.length === 0) { return result; }

  if (options.dryRun) {
    // Quick 260917-o1e (R1b): nothing was derived, so this must never write a
    // derivation_completed disclosure -- a dry-run reports a plan, not a result.
    result.remaining = entries.length;
    result.plan = entries.map((e) => e && e.roomDir).filter(Boolean);
    return result;
  }

  // LEGACY seam: deriveRunner injected -> byte-compatible Phase-169 path (sync,
  // legacy call shape, NO encoder probe). This is the ONLY path the Phase-169
  // round-trip test (tests/test-graph-derive-sweep.cjs) exercises. Quick
  // 260917-o1e (R1b): this seam deliberately skips the encoder probe entirely,
  // so it has no basis for claiming the encoder was available -- it must never
  // write a derivation_completed disclosure. The Phase-169 round-trip test owns
  // this path byte-for-byte.
  if (typeof options.deriveRunner === 'function') {
    // Defect 4a: SUCCEEDED entries clear; a THROWN entry is kept + logged.
    const succeeded = [];
    const failed = [];
    for (const entry of entries) {
      const target = entry && typeof entry.roomDir === 'string' ? entry.roomDir : '';
      if (!target) { continue; }
      try {
        options.deriveRunner({ roomDir: target });
        result.drained.push(target);
        succeeded.push(entry);
      } catch (e) {
        if (!Array.isArray(result.failed)) result.failed = [];
        result.failed.push(target);
        failed.push({ entry: entry, error: e });
      }
    }
    // Success-vs-failure-aware reconcile (never a blanket wipe): succeeded entries
    // clear, failed entries are kept for retry (capped), and entries enqueued
    // during the drain window survive.
    result.remaining = reconcileQueue(resolved, succeeded, failed);
    return result;
  }

  // DEFAULT path: the async score-based worker (returns a Promise).
  return drainScoreBased(resolved, entries, options, result);
}

// ---------------------------------------------------------------------------
// Worker caps (Phase 379.1, CPU379-03, D-379.1-13)
// ---------------------------------------------------------------------------

// Lower the worker's scheduling priority so a drain yields to the user's hooks and
// editor. Never raises it back; a failure (EACCES, an unsupported platform) is
// ignored, because the thread cap and the budget are the real controls.
function lowerWorkerPriority() {
  try {
    const os = require('node:os');
    const prio = process.platform === 'win32'
      ? os.constants.priority.PRIORITY_BELOW_NORMAL
      : os.constants.priority.PRIORITY_LOW;
    os.setPriority(0, prio);
    return true;
  } catch (_e) {
    return false;
  }
}

// The backstop ends an idle or async stall (an await that never resolves, a hung
// encoder promise). It CANNOT interrupt a synchronous loop on the same thread.
// Every synchronous loop the worker runs is therefore deadline-checked from the
// inside: the cosine pass in buildCandidatePairs checks the deadline per row, the
// scoring loop checks it between pairs and yields on every await, the embed loop
// checks it between batches, and runDerivation is bounded by the slice (at most
// resolveMaxPairsPerDrain() pairs). A parent-side kill timeout on the per-write
// spawn is not added: that spawn is detached, stdio ignored and unref'd
// (intelligence-cascade.cjs), so the parent exits without waiting and holds no timer;
// the release leg (Plan 06) has a parent-side spawnSync timeout as the hard limit.
function armBackstop(ms) {
  const t = setTimeout(() => { process.exit(0); }, ms);
  if (t && typeof t.unref === 'function') t.unref();
  return t;
}

// ONE JSON line of numbers (schema drain-usage-v1). No path, no id, no text.
function usageLine() {
  const cpu = process.cpuUsage();
  let maxRss = 0;
  try { maxRss = process.resourceUsage().maxRSS; } catch (_e) { maxRss = 0; }
  if (!Number.isFinite(maxRss) || maxRss <= 0) maxRss = Math.round(process.memoryUsage().rss / 1024);
  return JSON.stringify({
    schema: 'drain-usage-v1',
    cpu_user_us: cpu.user,
    cpu_system_us: cpu.system,
    max_rss_kb: maxRss,
    rss_kb: Math.round(process.memoryUsage().rss / 1024),
    clock_ms: Math.round(process.uptime() * 1000),
    pid: process.pid,
  });
}

function registerUsageReporter() {
  process.on('exit', () => {
    try { process.stderr.write(usageLine() + '\n'); } catch (_e) { /* advisory */ }
  });
}

// ---------------------------------------------------------------------------
// Entry point (SessionStart hook): drain and exit 0 always.
// ---------------------------------------------------------------------------

async function main() {
  try {
    // The operator switch (debug file E6): MINDRIAN_DERIVE_SKIP=1 ends the hook entry
    // and the worker before any work, before the self-detach, with no output.
    if (process.env.MINDRIAN_DERIVE_SKIP === '1') { process.exit(0); }

    const args = parseArgs(process.argv.slice(2));

    // The SessionStart hook budget (hooks.json: timeout 5000, async false) cannot
    // cover a cold encoder load plus a room-scoped scoring pass -- and a drain
    // killed at the hook timeout used to leave its queue entry in place, so the
    // SAME doomed drain re-ran (and re-stalled) at EVERY session start. The hook
    // entry point therefore does NOT drain in-process: it re-spawns itself
    // DETACHED with --worker (the Step 2b spawnDetachedWorker idiom: detached,
    // stdio ignore, unref, never awaited) and exits immediately. The worker does
    // the real drain in the background with no hook budget over it. --dry-run
    // stays in-process (it only prints a plan). The MOS_NO_DETACHED_DERIVE test
    // seam suppresses the re-spawn so an in-process drain owns the timing.
    if (!args.worker && !args.dryRun && process.env.MOS_NO_DETACHED_DERIVE !== '1') {
      try {
        const { spawn } = require('node:child_process');
        const child = spawn(
          process.execPath,
          [__filename, '--worker'].concat(process.argv.slice(2)),
          { detached: true, stdio: 'ignore', env: process.env }
        );
        child.unref();
      } catch (_spawnErr) {
        // Soft-fail: the Stop sweep + the explicit /mos:graph --derive backfill
        // remain the universal net.
      }
      process.exit(0);
    }

    // The worker (CPU379-03): low priority, a backstop timer past the time budget, and
    // an optional usage report. The hook entry above never reaches this code.
    if (args.worker) {
      lowerWorkerPriority();
      armBackstop(resolveBudgetMs() + 60000);
      if (args.reportUsage) registerUsageReporter();
    }

    const roomDir = sweep.resolveRoomDir(args.roomDir);
    if (roomDir) {
      // The default path returns a Promise; the dry-run / empty-queue path returns
      // an object. `await` normalizes both.
      const res = await drainDerive(roomDir, { dryRun: args.dryRun });
      if (args.dryRun && res) {
        process.stderr.write('[gsd-graph-derive-drain] plan: ' + JSON.stringify(res.plan || []) + '\n');
      }
    }
  } catch (_e) {
    // Silent: a SessionStart hook must never block session start.
  }
  process.exit(0);
}

module.exports = {
  drainDerive,
  MAX_DERIVE_ATTEMPTS,
  failureLogPath,
  _test: {
    probeEncoder,
    patchEntry,
    clampCursor,
    drainLockPath,
    resolveBudgetMs,
    resolveMaxPairsPerDrain,
    resolveMaxPairsPerEntry,
    MAX_DERIVE_ATTEMPTS,
    PROBE_SIMILAR,
    PROBE_UNRELATED,
    lowerWorkerPriority,
    armBackstop,
    usageLine,
  },
};

if (require.main === module) {
  main();
}
