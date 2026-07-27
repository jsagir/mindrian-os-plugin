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

// ---------------------------------------------------------------------------
// CLI parser
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const out = { roomDir: null, dryRun: false, worker: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--room' && argv[i + 1]) { out.roomDir = argv[i + 1]; i += 1; }
    else if (argv[i] === '--dry-run') { out.dryRun = true; }
    else if (argv[i] === '--worker') { out.worker = true; }
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
// that ALL read the queue before any finished -- 10 concurrent encoder loads
// scoring the same entries against the same room.db. The lock makes the first
// drain the owner; the rest return immediately and leave the queue to it (any
// entry the loser would have handled is in the queue the owner snapshots, or
// survives the snapshot-scoped clear for the next drain). A stale lock (a
// killed worker) is reclaimed after LOCK_STALE_MS. fs open 'wx' is the repo's
// existing write-lock idiom.
const LOCK_STALE_MS = 10 * 60 * 1000;

function drainLockPath(resolved) {
  return path.join(resolved, '.mindrian', 'graph-derive-drain.lock');
}

function acquireDrainLock(resolved) {
  const lockPath = drainLockPath(resolved);
  try { fs.mkdirSync(path.dirname(lockPath), { recursive: true }); } catch (_e) { /* best effort */ }
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const fd = fs.openSync(lockPath, 'wx');
      try { fs.writeSync(fd, String(process.pid)); } catch (_we) { /* advisory */ }
      fs.closeSync(fd);
      return lockPath;
    } catch (_e) {
      // Held. Reclaim ONLY when stale (older than LOCK_STALE_MS), then retry once.
      try {
        const st = fs.statSync(lockPath);
        if (Date.now() - st.mtimeMs > LOCK_STALE_MS) {
          fs.rmSync(lockPath, { force: true });
          continue;
        }
        return null;
      } catch (_se) {
        // The holder released between our open and stat: retry once.
        continue;
      }
    }
  }
  return null;
}

function releaseDrainLock(lockPath) {
  if (!lockPath) return;
  try { fs.rmSync(lockPath, { force: true }); } catch (_e) { /* best effort */ }
}

// Count the pairs a target/entry WOULD score (for the disclosure marker's
// pairs_skipped scalar). Pure enumeration; never throws.
function pairCountFor(target, entry) {
  try {
    const hasFile = entry && typeof entry.filePath === 'string' && entry.filePath.length > 0;
    return hasFile
      ? classifier.buildNewArtifactPairs(target, entry.filePath).length
      : classifier.buildAllPairs(target).length;
  } catch (_e) {
    return 0;
  }
}

// D-04 probe: ONE score over two short literal probe strings to learn whether
// the semantic encoder is available. opts.probeOpts is merged so a test can
// force _forceUnavailable:true (skip path) or inject an encodeFn (available
// path). Returns { available: boolean }. Never throws.
async function probeEncoder(probeOpts) {
  try {
    const opts = (probeOpts && typeof probeOpts === 'object') ? Object.assign({}, probeOpts) : {};
    const res = await scoreMeasured('probe alpha reference', 'probe beta reference', opts);
    if (!res || res.semantic === null || res.semantic === undefined || res.warning === 'encoder_unavailable') {
      return { available: false };
    }
    return { available: true };
  } catch (_e) {
    return { available: false };
  }
}

// D-04 disclosure: mark the skip at the point of occurrence (SEED-059). Opens the
// room db, logs ONE derivation_skipped memory_event with SCALAR-only fields
// (Part 8), closes. dedupe_key rides the logEvent 60s idempotency so a repeat
// forced-unavailable drain does NOT write a second marker. Soft-fail: any error
// is swallowed (advisory, never blocking).
function discloseSkip(target, entry, pairsSkippedOverride) {
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
    navigation.logMemoryEvent(db, 'derivation_skipped', {
      reason: 'encoder_unavailable',
      trigger: trigger,
      pairs_skipped: (typeof pairsSkippedOverride === 'number')
        ? pairsSkippedOverride
        : pairCountFor(target, entry),
      dedupe_key: 'derivation_skipped:' + path.resolve(target),
      source_path: 'derivation:skip',
      created_by: 'system',
    });
  } catch (_e) {
    /* advisory: never block the write path (Phase 210 caution). */
  } finally {
    if (db) { try { closeRoomDb(db); } catch (_ce) { /* ignore */ } }
  }
}

// The DEFAULT (score-based) worker path. ASYNC because the score-based producer
// is async and runDerivation's synchronous loop treats a Promise return as [] (the
// Wave-1 note): candidates are PRE-RESOLVED per pair, then fed to runDerivation via
// a synchronous deriveFn wrapper so the Phase-169 composer stays untouched.
async function drainScoreBased(resolved, entries, options, result) {
  // Single-flight: only one drain may own this room's queue at a time (the
  // per-write spawn stampede otherwise scores the same entries concurrently).
  const lockPath = acquireDrainLock(resolved);
  if (!lockPath) {
    result.remaining = entries.length;
    result.locked = true;
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
    const probe = await probeEncoder(options.probeOpts);
    if (!probe.available) {
      for (const entry of entries) {
        const target = entry && typeof entry.roomDir === 'string' ? entry.roomDir : '';
        if (!target) { continue; }
        discloseSkip(target, entry);
        result.drained.push(target);
      }
      result.remaining = clearQueue(resolved, entries);
      return result;
    }

    // Defect 4a: partition the snapshot into SUCCEEDED (clear) vs FAILED (keep +
    // log + cap). The old code pushed a thrown room to `drained` and cleared it.
    const succeeded = [];
    const failed = [];
    for (const entry of entries) {
      const target = entry && typeof entry.roomDir === 'string' ? entry.roomDir : '';
      if (!target) { continue; }
      try {
        const hasFile = typeof entry.filePath === 'string' && entry.filePath.length > 0;
        const artifactPairs = hasFile
          ? classifier.buildNewArtifactPairs(target, entry.filePath) // Req 6: O(n)
          : classifier.buildAllPairs(target); // room-scoped Stop-sweep entry
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
          scoreOpts: options.probeOpts,
          onOutcome: (o) => {
            if (o && o.outcome === 'encoder_unavailable') encoderFailedPairs += 1;
          },
        };
        const candidatesByPair = new Map();
        for (const pair of artifactPairs) {
          // eslint-disable-next-line no-await-in-loop
          const cands = await deriveFn({ roomDir: target, artifactPair: pair }, producerOpts);
          candidatesByPair.set(pair, Array.isArray(cands) ? cands : []);
        }
        const syncDeriveFn = (step) => candidatesByPair.get(step && step.artifactPair) || [];
        if (typeof runDerivation === 'function') {
          runDerivation({ roomDir: target, deriveFn: syncDeriveFn, artifactPairs: artifactPairs });
        }
        if (encoderFailedPairs > 0) {
          discloseSkip(target, entry, encoderFailedPairs);
        }
        result.drained.push(target);
        succeeded.push(entry);
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
    releaseDrainLock(lockPath);
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
    result.remaining = entries.length;
    result.plan = entries.map((e) => e && e.roomDir).filter(Boolean);
    return result;
  }

  // LEGACY seam: deriveRunner injected -> byte-compatible Phase-169 path (sync,
  // legacy call shape, NO encoder probe). This is the ONLY path the Phase-169
  // round-trip test (tests/test-graph-derive-sweep.cjs) exercises.
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
// Entry point (SessionStart hook): drain and exit 0 always.
// ---------------------------------------------------------------------------

async function main() {
  try {
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

module.exports = { drainDerive, MAX_DERIVE_ATTEMPTS, failureLogPath };

if (require.main === module) {
  main();
}
