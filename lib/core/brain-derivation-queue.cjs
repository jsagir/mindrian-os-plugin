'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 90-02 Task 1 -- Brain derivation queue
 * ============================================
 * Programmatic enqueue + drain API for the BRAIN.md re-derivation pipeline.
 * Pattern copied verbatim from Phase 88-02 minto-debouncer.cjs (atomic
 * read-modify-write tmp + fsync + rename; self-healing reader; safe
 * concurrent writer) per Canon Part 7 (Reuse Before Build).
 *
 * Canon Part 8 invariant (load-bearing):
 *   Queue entries carry ONLY:
 *     - section                          (slug-safe folder name)
 *     - previous_governing_thought_hash  (sha256 hex string OR null)
 *     - new_governing_thought_hash       (sha256 hex string)
 *     - enqueued_at                      (ISO timestamp)
 *     - reason                           (frozen vocabulary string)
 *
 *   Queue entries NEVER contain user prose: no thought_text, no identity
 *   paragraphs, no decision history, no link tables, no artifact bodies,
 *   no person names, no meeting fragments, no currency, no user typing.
 *
 *   Test 12 audits the queue file against forbidden substrings AND
 *   asserts the entry shape matches the allow-list above.
 *
 * Idempotency rule:
 *   `section` is the unique key. Enqueueing the same section twice with
 *   the same new_governing_thought_hash is a no-op (returns queued:true,
 *   queue stays at the same size). Enqueueing the same section with a
 *   DIFFERENT new_hash REPLACES the existing entry (newest enqueue wins).
 *
 * Drain rule:
 *   For each queue entry up to options.maxEntries:
 *     1. Read current triple via folder-memory.readTriple(sectionPath)
 *     2. Compute current governing_thought sha256 hash
 *     3. If current hash !== entry.new_governing_thought_hash, drop entry
 *        (stale-queue-race: triple changed again since enqueue; the next
 *        post-regen hook will re-enqueue with the latest hash)
 *     4. Check brain-client.isAvailable(). If not, RE-ENQUEUE entry
 *        (keep in queue for next drain attempt; never drop)
 *     5. Otherwise, dispatch deriveSection (in dryRun mode the dispatch
 *        is recorded but not actually fired -- caller's responsibility
 *        for real spawning)
 *
 * Removal rule (Phase 245-02):
 *   A dryRun drain is STRICTLY READ-ONLY. It writes nothing; it only
 *   REPORTS what a real drain would do. Removal of a previewed entry
 *   happens through the explicit commitDispatched(roomDir, sections)
 *   door, which the caller invokes with the sections it actually spawned.
 *   Anything it could not spawn stays queued for the next turn.
 *
 * Caps:
 *   SOFT_CAP = 500 -- enqueue returns warning='queue_soft_cap'
 *   HARD_CAP = 1000 -- enqueue rejected with error='queue_hard_cap'
 *
 * Pure CJS, node built-ins only, zero npm deps.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const QUEUE_RELATIVE = path.join('.mindrian', 'brain-derivation-queue.json');
const SCHEMA_VERSION = 1;

const SOFT_CAP = 500;
const HARD_CAP = 1000;

// Frozen allow-list of entry keys (Canon Part 8 invariant).
const ALLOWED_ENTRY_KEYS = Object.freeze([
  'section',
  'previous_governing_thought_hash',
  'new_governing_thought_hash',
  'enqueued_at',
  'reason',
]);

// Frozen reason vocabulary (extend only via canon amendment).
const ALLOWED_REASONS = Object.freeze({
  GOVERNING_THOUGHT_CHANGED: 'governing_thought_changed',
  SESSION_START_STALE: 'session_start_stale',
  MANUAL_INVOCATION: 'manual_invocation',
  CROSS_ROOM_AGGREGATION: 'cross_room_aggregation',
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function queuePath(roomDir) {
  return path.join(roomDir, QUEUE_RELATIVE);
}

function emptyQueue() {
  return { version: SCHEMA_VERSION, entries: [] };
}

function nowIso() {
  // Seconds precision keeps byte diffs clean in the queue file.
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function sha256OfString(s) {
  return 'sha256:' + crypto.createHash('sha256')
    .update(String(s == null ? '' : s).normalize('NFC'))
    .digest('hex');
}

function isSlugSafe(s) {
  if (typeof s !== 'string' || s.length === 0 || s.length > 64) return false;
  return /^[a-z0-9][a-z0-9_-]*$/.test(s);
}

function isHashOrNull(s) {
  if (s === null) return true;
  if (typeof s !== 'string') return false;
  return /^sha256:[a-f0-9]{6,}$/i.test(s);
}

// ---------------------------------------------------------------------------
// readQueue (self-healing; never throws)
// ---------------------------------------------------------------------------

function readQueue(roomDir) {
  const qp = queuePath(roomDir);
  if (!fs.existsSync(qp)) return emptyQueue();
  let raw;
  try {
    raw = fs.readFileSync(qp, 'utf-8');
  } catch (e) {
    process.stderr.write(
      '[brain-derivation-queue] warn: failed to read queue (' +
      (e && e.code || 'unknown') + '); resetting to empty\n'
    );
    return emptyQueue();
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (_parseErr) {
    process.stderr.write(
      '[brain-derivation-queue] warn: corrupt queue JSON detected; healing to empty\n'
    );
    return emptyQueue();
  }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.entries)) {
    process.stderr.write(
      '[brain-derivation-queue] warn: queue file invalid shape; resetting\n'
    );
    return emptyQueue();
  }
  if (parsed.version !== SCHEMA_VERSION) {
    process.stderr.write(
      '[brain-derivation-queue] warn: unexpected version ' + parsed.version + '; resetting\n'
    );
    return emptyQueue();
  }
  // Filter entries to allow-list shape. Defense in depth against tampering.
  const clean = [];
  for (const e of parsed.entries) {
    if (!e || typeof e !== 'object') continue;
    if (!isSlugSafe(e.section)) continue;
    if (!isHashOrNull(e.previous_governing_thought_hash)) continue;
    if (!isHashOrNull(e.new_governing_thought_hash) || e.new_governing_thought_hash === null) continue;
    if (typeof e.enqueued_at !== 'string' || e.enqueued_at.length === 0) continue;
    if (typeof e.reason !== 'string' || e.reason.length === 0) continue;
    // Keep ONLY allow-list keys.
    const trimmed = {};
    for (const k of ALLOWED_ENTRY_KEYS) trimmed[k] = e[k];
    clean.push(trimmed);
  }
  return { version: SCHEMA_VERSION, entries: clean };
}

// ---------------------------------------------------------------------------
// writeQueueAtomic (tmp + fsync + rename)
// ---------------------------------------------------------------------------

function writeQueueAtomic(roomDir, queueObj) {
  if (!queueObj || typeof queueObj !== 'object' || !Array.isArray(queueObj.entries)) {
    return false;
  }
  const qp = queuePath(roomDir);
  const dir = path.dirname(qp);
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (_) { /* best effort */ }

  // Random suffix prevents tmpfile collisions across concurrent writers.
  const tmp = qp + '.tmp.' + process.pid + '.' + Math.random().toString(36).slice(2);
  let fd;
  try {
    fd = fs.openSync(tmp, 'w');
    const body = JSON.stringify(queueObj, null, 2);
    fs.writeSync(fd, body);
    try { fs.fsyncSync(fd); } catch (_) { /* fsync best-effort on some FS */ }
    fs.closeSync(fd);
    fd = null;
    fs.renameSync(tmp, qp);
    return true;
  } catch (_e) {
    try { if (fd != null) fs.closeSync(fd); } catch (_) {}
    try { fs.unlinkSync(tmp); } catch (_) {}
    return false;
  }
}

// ---------------------------------------------------------------------------
// enqueue
// ---------------------------------------------------------------------------

/**
 * enqueue(roomDir, section, previous_hash, new_hash, reason)
 *
 * Adds or replaces an entry for `section`. Idempotent on (section, new_hash):
 * enqueueing the same pair twice does not grow the queue. Replaces the
 * prior entry when the new_hash differs (newest enqueue wins).
 *
 * Returns: { queued: boolean, queue_size: number, error?: string, warning?: string }
 */
function enqueue(roomDir, section, previous_hash, new_hash, reason) {
  if (typeof roomDir !== 'string' || roomDir.length === 0) {
    return { queued: false, queue_size: 0, error: 'invalid_room_dir' };
  }
  if (!isSlugSafe(section)) {
    return { queued: false, queue_size: 0, error: 'invalid_section' };
  }
  if (!isHashOrNull(new_hash) || new_hash === null) {
    return { queued: false, queue_size: 0, error: 'invalid_new_hash' };
  }
  if (!isHashOrNull(previous_hash)) {
    return { queued: false, queue_size: 0, error: 'invalid_previous_hash' };
  }
  if (typeof reason !== 'string' || reason.length === 0 || reason.length > 64) {
    return { queued: false, queue_size: 0, error: 'invalid_reason' };
  }

  const queue = readQueue(roomDir);

  // Find existing entry for this section.
  const existingIdx = queue.entries.findIndex(function (e) { return e.section === section; });

  if (existingIdx !== -1 && queue.entries[existingIdx].new_governing_thought_hash === new_hash) {
    // Idempotent: same section + same new_hash. Already queued.
    return { queued: true, queue_size: queue.entries.length };
  }

  const newEntry = {
    section: section,
    previous_governing_thought_hash: previous_hash,
    new_governing_thought_hash: new_hash,
    enqueued_at: nowIso(),
    reason: reason,
  };

  let nextEntries;
  if (existingIdx !== -1) {
    // Replace existing entry (section is unique key).
    nextEntries = queue.entries.slice();
    nextEntries[existingIdx] = newEntry;
  } else {
    // Append. Enforce HARD_CAP first.
    if (queue.entries.length >= HARD_CAP) {
      return { queued: false, queue_size: queue.entries.length, error: 'queue_hard_cap' };
    }
    nextEntries = queue.entries.concat([newEntry]);
  }

  const ok = writeQueueAtomic(roomDir, { version: SCHEMA_VERSION, entries: nextEntries });
  if (!ok) {
    return { queued: false, queue_size: queue.entries.length, error: 'write_failed' };
  }

  const result = { queued: true, queue_size: nextEntries.length };
  if (nextEntries.length > SOFT_CAP) {
    result.warning = 'queue_soft_cap';
  }
  return result;
}

// ---------------------------------------------------------------------------
// drain
// ---------------------------------------------------------------------------

/**
 * drain(roomDir, options) -> async result
 *
 * Walks queue entries (up to options.maxEntries; default 5). For each:
 *   - Reads current triple via folder-memory.readTriple
 *   - Compares current governing_thought sha256 against entry.new_hash
 *   - If mismatch: drops entry as stale (skipped++)
 *   - If brain-client.isAvailable() === false: re-enqueues (kept in queue)
 *   - Otherwise: marks entry as processed (caller dispatches deriveSection
 *     via detached child spawn; in dryRun the dispatch is recorded only)
 *
 * Returns: { processed, skipped, re_enqueued, errors }
 *
 * dryRun=true: STRICTLY READ-ONLY as of Phase 245-02. No spawn, no counts
 * consumed, and ZERO queue writes: every entry (dispatched, skipped, stale,
 * re-enqueued, over-budget) is left on disk exactly as it was found. The
 * caller MUST call commitDispatched(roomDir, sections) with the sections it
 * ACTUALLY acted on to remove them.
 *
 * Why: scripts/brain-derivation-drain.cjs is the only production caller and
 * it passes dryRun:true because it does the spawning itself. The old code
 * rewrote the queue file at the end of a dry run, so every entry the caller
 * had not yet spawned was deleted before the caller ever saw it. When the
 * caller's parent budget tripped before the first spawn, the whole queue
 * vanished and nothing derived. A dry run that mutates state is the defect.
 *
 * dryRun=false keeps the original committing behavior verbatim: skipped
 * (stale-hash / unreadable-triple) entries are dropped, re-enqueued
 * (Brain-offline) entries are kept, dispatched entries are removed.
 */
async function drain(roomDir, options) {
  options = options || {};
  const maxEntries = Number.isFinite(options.maxEntries) && options.maxEntries > 0
    ? Math.floor(options.maxEntries)
    : 5;
  const dryRun = options.dryRun === true;

  const result = {
    processed: 0,
    skipped: 0,
    re_enqueued: 0,
    errors: 0,
    dispatched: [],
  };

  if (typeof roomDir !== 'string' || roomDir.length === 0) {
    result.errors += 1;
    return result;
  }

  // Lazy require so the test mock cache is consulted at drain-time.
  let folderMemory;
  let brainClient;
  try {
    folderMemory = require('./folder-memory.cjs');
    brainClient = require('./brain-client.cjs');
  } catch (_e) {
    result.errors += 1;
    return result;
  }

  const queue = readQueue(roomDir);
  if (queue.entries.length === 0) return result;

  const remaining = [];
  let processedCount = 0;

  for (let i = 0; i < queue.entries.length; i++) {
    const entry = queue.entries[i];

    // Process at most maxEntries on this drain. Anything past the budget
    // stays in the queue verbatim (no skip / re-enqueue tracking).
    if (processedCount >= maxEntries) {
      remaining.push(entry);
      continue;
    }

    // Read current triple to compare hashes (stale-queue-race guard).
    const sectionPath = path.join(roomDir, entry.section);
    let triple;
    try {
      triple = folderMemory.readTriple(sectionPath);
    } catch (_e) {
      // Triple read failure: drop entry (next post-regen hook will re-fire).
      result.skipped += 1;
      processedCount += 1;
      continue;
    }

    if (!triple || !triple.reasoning || triple.reasoning.exists !== true) {
      // No triple to derive against. Drop.
      result.skipped += 1;
      processedCount += 1;
      continue;
    }

    const currentGt = triple.reasoning.governing_thought == null
      ? ''
      : String(triple.reasoning.governing_thought);
    const currentHash = sha256OfString(currentGt);

    if (currentHash !== entry.new_governing_thought_hash) {
      // Stale-queue-race: triple changed again since enqueue. Drop the
      // stale entry; the post-regen hook re-enqueued (or will re-enqueue)
      // with the latest hash.
      result.skipped += 1;
      processedCount += 1;
      continue;
    }

    // Brain availability gate.
    let available = false;
    try {
      available = brainClient.isAvailable() === true;
    } catch (_e) {
      available = false;
    }

    if (!available) {
      // Brain offline: keep entry in queue for next drain attempt.
      remaining.push(entry);
      result.re_enqueued += 1;
      processedCount += 1;
      continue;
    }

    // Dispatch deriveSection. In dryRun, just record. The real script
    // (scripts/brain-derivation-drain.cjs) spawns a detached child so the
    // user turn never waits.
    result.dispatched.push({ section: entry.section, hash: entry.new_governing_thought_hash });
    result.processed += 1;
    processedCount += 1;
    // Drained entry is removed from queue (do NOT push to remaining).
  }

  // Rewrite queue with remaining entries.
  //
  // Phase 245-02: a dry run performs ZERO writes. It is a read-only PREVIEW
  // of what a drain would do; the caller owns removal through
  // commitDispatched() once it has actually spawned something. Writing here
  // on a dry run is what silently vacuumed the queue on every turn since
  // v1.16.0-beta.1.
  if (!dryRun && remaining.length !== queue.entries.length) {
    writeQueueAtomic(roomDir, { version: SCHEMA_VERSION, entries: remaining });
  }

  if (dryRun) result.dry_run = true;
  return result;
}

// ---------------------------------------------------------------------------
// commitDispatched
// ---------------------------------------------------------------------------

/**
 * commitDispatched(roomDir, sections) -> { removed, remaining }
 *
 * The explicit removal door. `sections` is an array of section slug strings:
 * the ones the caller ACTUALLY acted on (spawned a derive child for). Every
 * entry whose `section` is a member of that list is removed; everything else
 * survives verbatim, including entries a dry run reported as dispatched but
 * that the caller never got to.
 *
 * Idempotent: committing the same section twice removes it once and reports
 * removed:0 (with no write at all) the second time.
 *
 * Defensive and NON-THROWING: the caller is a UserPromptSubmit hook and must
 * stay fail-silent. A non-string roomDir, a non-array `sections`, an empty
 * `sections`, or a list that matches nothing is a no-op that performs no
 * write.
 *
 * Assumption A5, asserted rather than assumed: `enqueue` above dedupes on
 * `section` (it findIndex()es the existing entry and REPLACES it rather than
 * appending; same section + same new_hash is an outright no-op). So an
 * un-spawned remainder that stays in the queue and is re-enqueued by the next
 * turn's trigger cannot grow the queue: the section key collapses it back to
 * one entry. Graceful degradation here is bounded, not a leak.
 */
function commitDispatched(roomDir, sections) {
  try {
    if (typeof roomDir !== 'string' || roomDir.length === 0) {
      return { removed: 0, remaining: 0 };
    }

    const queue = readQueue(roomDir);
    const currentLen = queue.entries.length;

    if (!Array.isArray(sections) || sections.length === 0) {
      return { removed: 0, remaining: currentLen };
    }

    const wanted = new Set();
    for (const s of sections) {
      if (typeof s === 'string' && s.length > 0) wanted.add(s);
    }
    if (wanted.size === 0) {
      return { removed: 0, remaining: currentLen };
    }

    const survivors = queue.entries.filter(function (e) {
      return !wanted.has(e.section);
    });
    const removed = currentLen - survivors.length;

    // Nothing matched: no write at all (idempotent second commit lands here).
    if (removed === 0) {
      return { removed: 0, remaining: currentLen };
    }

    const ok = writeQueueAtomic(roomDir, {
      version: SCHEMA_VERSION,
      entries: survivors,
    });
    if (!ok) {
      // Write failed: the queue is untouched, so report nothing removed. The
      // next drain retries the same entries, which is the safe direction.
      return { removed: 0, remaining: currentLen };
    }

    return { removed: removed, remaining: survivors.length };
  } catch (_e) {
    // Never throw: the caller is a fail-silent hook.
    return { removed: 0, remaining: 0 };
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  enqueue: enqueue,
  drain: drain,
  commitDispatched: commitDispatched,
  readQueue: readQueue,
  writeQueueAtomic: writeQueueAtomic,
  SOFT_CAP: SOFT_CAP,
  HARD_CAP: HARD_CAP,
  ALLOWED_ENTRY_KEYS: ALLOWED_ENTRY_KEYS,
  ALLOWED_REASONS: ALLOWED_REASONS,
  SCHEMA_VERSION: SCHEMA_VERSION,
  // Test surface (not part of public API):
  _test: Object.freeze({
    sha256OfString: sha256OfString,
    isSlugSafe: isSlugSafe,
    isHashOrNull: isHashOrNull,
    queuePath: queuePath,
  }),
};
