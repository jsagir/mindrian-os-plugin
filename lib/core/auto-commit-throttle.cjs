/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88.1-08 -- async artifact auto-commit throttle
 * ======================================================
 * Pure throttle bookkeeping for the async artifact auto-commit hook. The
 * hook fires PostToolUse on Write|Edit|MultiEdit and must avoid commit
 * storms under rapid-write sequences (MultiEdit, tool chains). This module
 * is the decision layer: given a file path, a wall-clock timestamp, and a
 * ledger of per-path last-commit timestamps, it answers:
 *   - should this write be throttled (drop the auto-commit this time)?
 *   - what is the ledger after recording a fresh commit for this path?
 *   - which stale entries can be pruned to keep the ledger bounded?
 *
 * Pure CJS, zero fs imports, zero network. The hook script wraps this
 * module with openSync('wx') + rename atomic writes (Phase 87-02 pattern)
 * for ledger persistence. This file is LOCAL-by-construction per Canon
 * Part 8: it has no I/O surface at all.
 *
 * Canon references:
 *   Part 4 Every Choice Is Graph Data -- auto-commits preserve the
 *     provenance trail of every artifact write (filesystem IS the graph).
 *   Part 6 Product-as-Venture -- our own rooms get auto-commits too.
 *   Part 8 Graph Boundary -- auto-commit is LOCAL; this pure module has no
 *     exfiltration surface.
 *
 * API:
 *   THROTTLE_WINDOW_MS                          -- number, fixed at 5000ms.
 *   shouldThrottle(filePath, now, ledger)       -> boolean
 *   updateLedger(filePath, now, ledger)         -> new ledger object
 *   pruneOldEntries(ledger, now)                -> new ledger object with
 *                                                   entries older than 1 day
 *                                                   dropped.
 *
 * Ledger shape:
 *   { [absolutePath:string]: lastCommitTsMs:number }
 */

'use strict';

// ---------- Tunables (frozen invariants) ----------

// 1 commit / 5 seconds per path. Matches PLAN spec and prevents commit
// storms during rapid-write sequences (MultiEdit, chained tools).
const THROTTLE_WINDOW_MS = 5000;

// 1 day retention on ledger entries. Anything older is irrelevant because
// the 5s throttle window is vastly smaller; old entries only exist because
// the hook has not re-fired recently. Pruning keeps the ledger bounded.
const LEDGER_RETENTION_MS = 24 * 60 * 60 * 1000; // 86400000

// ---------- Core functions ----------

/**
 * shouldThrottle
 *   Decide whether an auto-commit for filePath at wall-clock now should be
 *   suppressed because a prior commit landed inside the throttle window.
 *
 *   Semantics:
 *     - No ledger entry for filePath   -> not throttled.
 *     - now - lastTs <  WINDOW_MS      -> throttled (drop the commit).
 *     - now - lastTs >= WINDOW_MS      -> not throttled (allow commit).
 *
 *   Boundary behavior: exactly WINDOW_MS old is allowed (matches the
 *   user-visible contract "1 commit per 5 seconds": the 5-second tick
 *   unlocks the next commit).
 */
function shouldThrottle(filePath, now, ledger) {
  if (!ledger || typeof ledger !== 'object') return false;
  const lastTs = ledger[filePath];
  if (typeof lastTs !== 'number') return false;
  const age = now - lastTs;
  if (!Number.isFinite(age)) return false;
  return age < THROTTLE_WINDOW_MS;
}

/**
 * updateLedger
 *   Return a NEW ledger object with filePath's timestamp set to now. The
 *   input ledger is never mutated (pure function). Pre-existing entries
 *   for other paths are preserved.
 */
function updateLedger(filePath, now, ledger) {
  const base = (ledger && typeof ledger === 'object') ? ledger : {};
  // Object spread yields a fresh object; assignment to filePath sets the
  // new timestamp without mutating the input.
  const next = Object.assign({}, base);
  next[filePath] = now;
  return next;
}

/**
 * pruneOldEntries
 *   Return a NEW ledger object containing only entries with timestamps
 *   within LEDGER_RETENTION_MS of now. Entries exactly at the boundary
 *   (now - ts === LEDGER_RETENTION_MS) are dropped -- this matches the
 *   "older than 1 day" wording in the PLAN: strictly older is pruned.
 *
 *   Non-number or non-finite timestamps are treated as stale and pruned
 *   defensively so a corrupt ledger entry cannot survive forever.
 */
function pruneOldEntries(ledger, now) {
  const out = {};
  if (!ledger || typeof ledger !== 'object') return out;
  const keys = Object.keys(ledger);
  for (let i = 0; i < keys.length; i += 1) {
    const k = keys[i];
    const ts = ledger[k];
    if (typeof ts !== 'number' || !Number.isFinite(ts)) continue;
    const age = now - ts;
    // Keep entries strictly newer than the retention window.
    // age < LEDGER_RETENTION_MS -> keep.
    // age >= LEDGER_RETENTION_MS -> prune.
    if (age < LEDGER_RETENTION_MS) {
      out[k] = ts;
    }
  }
  return out;
}

// ---------- Exports ----------

module.exports = {
  THROTTLE_WINDOW_MS: THROTTLE_WINDOW_MS,
  LEDGER_RETENTION_MS: LEDGER_RETENTION_MS,
  shouldThrottle: shouldThrottle,
  updateLedger: updateLedger,
  pruneOldEntries: pruneOldEntries,
};
