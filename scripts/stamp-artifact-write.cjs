#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88-04 Task 1 -- stamp-artifact-write
 * ===========================================
 * Stamps `last_artifact_write_seen_at` into the section's MINTO.md
 * frontmatter, or falls back to `.mindrian/pending-stamps/<section>.json`
 * when MINTO.md is absent or malformed.
 *
 * Contract:
 *   - Soft-fail channel: always exits 0. A failed stamp never breaks the
 *     PostToolUse hook pipeline.
 *   - Composes with Phase 87-02 write-lock (acquireLock/releaseLock) so
 *     concurrent stamps from a burst of Write/Edit/MultiEdit operations
 *     serialize correctly and do not corrupt the MINTO frontmatter.
 *   - Atomic write (tmp + rename) so a crash mid-write cannot leave the
 *     file with partial content.
 *   - Designed to be spawned BACKGROUNDED from scripts/post-write; the
 *     stamp acquires the room's write-lock briefly (few ms) and releases.
 *
 * Usage:
 *   node scripts/stamp-artifact-write.cjs <sectionPath>
 *
 * sectionPath is the absolute path to a section directory (the section
 * contains MINTO.md). The script walks UP from sectionPath looking for a
 * .room-root sentinel to locate the room directory for lock scoping.
 *
 * Three-surface by construction: pure CJS, node built-ins, zero new deps.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { acquireLock, releaseLock } = require('../lib/core/write-lock.cjs');

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function nowIso() {
  // Seconds precision; byte-clean frontmatter diffs.
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

// Walk up from sectionPath looking for .room-root sentinel. Falls back to the
// parent of sectionPath when no sentinel is found (best-effort lock scoping).
function findRoomRoot(sectionPath) {
  let dir = path.resolve(sectionPath);
  // Section is a directory under room root; start the walk at dir itself.
  let cur = dir;
  for (let hops = 0; hops < 12; hops++) {
    const sentinel = path.join(cur, '.room-root');
    try {
      if (fs.existsSync(sentinel)) return cur;
    } catch (_) { /* ignore */ }
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  // Fallback: parent directory of sectionPath.
  return path.dirname(dir);
}

// Sync sleep (Atomics.wait + SharedArrayBuffer) for lock-retry backoff.
function sleepSync(ms) {
  if (ms <= 0) return;
  try {
    const sab = new SharedArrayBuffer(4);
    const view = new Int32Array(sab);
    Atomics.wait(view, 0, 0, ms);
  } catch (_) {
    // Busy-wait fallback when SharedArrayBuffer is disabled.
    const until = Date.now() + ms;
    while (Date.now() < until) { /* spin */ }
  }
}

// Acquire lock with exponential backoff + half-jitter (mirrors 88-02/88-03).
// Returns true on success, false after exhausting attempts.
function tryAcquireWithBackoff(roomDir) {
  const MAX_ATTEMPTS = 12;
  let delay = 25;
  const CAP = 1600;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      acquireLock(roomDir);
      return true;
    } catch (e) {
      if (attempt === MAX_ATTEMPTS - 1) return false;
      // Half-jitter: sleep delay/2 + random(0..delay/2).
      const base = Math.floor(delay / 2);
      const jit = Math.floor(Math.random() * (delay - base + 1));
      sleepSync(base + jit);
      delay = Math.min(delay * 2, CAP);
    }
  }
  return false;
}

function writeFileAtomic(targetPath, content) {
  const tmp = targetPath + '.tmp.' + process.pid;
  let fd;
  try {
    fd = fs.openSync(tmp, 'w');
    fs.writeSync(fd, content);
    try { fs.fsyncSync(fd); } catch (_) { /* tmpfs best-effort */ }
    fs.closeSync(fd);
    fs.renameSync(tmp, targetPath);
  } catch (e) {
    // Cleanup tmp on failure.
    try { fs.unlinkSync(tmp); } catch (_) {}
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Pending-stamps fallback
// ---------------------------------------------------------------------------

function writePendingStamp(roomDir, sectionName, iso) {
  const pendingDir = path.join(roomDir, '.mindrian', 'pending-stamps');
  try {
    fs.mkdirSync(pendingDir, { recursive: true });
  } catch (_) { /* best-effort */ }
  const target = path.join(pendingDir, sectionName + '.json');
  const payload = JSON.stringify({
    section: sectionName,
    last_artifact_write_seen_at: iso,
  }, null, 2) + '\n';
  try {
    writeFileAtomic(target, payload);
  } catch (e) {
    process.stderr.write(
      '[stamp-artifact-write] pending-stamps write failed: ' +
      (e && e.message || String(e)) + '\n'
    );
  }
}

// ---------------------------------------------------------------------------
// MINTO.md frontmatter update
// ---------------------------------------------------------------------------

// Attempts to rewrite MINTO.md frontmatter with the new
// last_artifact_write_seen_at value. Returns true on success, false if the
// file is missing or the frontmatter is malformed (caller falls back to
// pending-stamps).
function stampMintoInPlace(mintoPath, iso) {
  let raw;
  try {
    raw = fs.readFileSync(mintoPath, 'utf8');
  } catch (_) {
    return false;
  }

  // Frontmatter regex: opening ---, content, closing ---.
  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!fmMatch) {
    process.stderr.write(
      '[stamp-artifact-write] malformed MINTO frontmatter at ' +
      mintoPath + ', falling back to pending-stamps\n'
    );
    return false;
  }

  const fmText = fmMatch[1];
  const body = fmMatch[2];
  const lines = fmText.split(/\r?\n/);

  let foundKey = false;
  let insertAfterIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^last_artifact_write_seen_at:/.test(line)) {
      // Preserve prefix (key + colon + space), rewrite the quoted ISO.
      lines[i] = 'last_artifact_write_seen_at: "' + iso + '"';
      foundKey = true;
      break;
    }
    if (/^last_generated_at:/.test(line)) {
      insertAfterIdx = i;
    }
  }
  if (!foundKey) {
    // Insert immediately after last_generated_at for canonical ordering;
    // fall back to end of frontmatter if the key is absent.
    const newLine = 'last_artifact_write_seen_at: "' + iso + '"';
    if (insertAfterIdx >= 0) {
      lines.splice(insertAfterIdx + 1, 0, newLine);
    } else {
      lines.push(newLine);
    }
  }

  const next =
    '---\n' + lines.join('\n') + '\n---\n' + body;
  if (next === raw) return true; // no-op
  try {
    writeFileAtomic(mintoPath, next);
    return true;
  } catch (e) {
    process.stderr.write(
      '[stamp-artifact-write] atomic write failed: ' +
      (e && e.message || String(e)) + '\n'
    );
    return false;
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function stamp(sectionPath) {
  const iso = nowIso();
  let secAbs;
  try {
    secAbs = path.resolve(sectionPath);
  } catch (_) {
    return;
  }

  // Locate room root for lock scoping and pending-stamps placement.
  const roomDir = findRoomRoot(secAbs);
  const sectionName = path.basename(secAbs);

  // Acquire lock with backoff. If we cannot acquire, we still attempt a
  // best-effort pending-stamps write (it is a soft-fail channel).
  const locked = tryAcquireWithBackoff(roomDir);
  try {
    const mintoPath = path.join(secAbs, 'MINTO.md');
    let mintoExists = false;
    try { mintoExists = fs.existsSync(mintoPath); } catch (_) {}

    if (mintoExists) {
      const ok = stampMintoInPlace(mintoPath, iso);
      if (!ok) {
        writePendingStamp(roomDir, sectionName, iso);
      }
    } else {
      writePendingStamp(roomDir, sectionName, iso);
    }
  } finally {
    if (locked) {
      try { releaseLock(roomDir); } catch (_) { /* ignore */ }
    }
  }
}

module.exports = { stamp };

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

if (require.main === module) {
  const sectionPath = process.argv[2];
  if (!sectionPath) {
    process.stderr.write('usage: stamp-artifact-write <sectionPath>\n');
    // Still exit 0 -- soft-fail channel.
    process.exit(0);
  }
  try {
    stamp(sectionPath);
  } catch (e) {
    // Never propagate; log and exit 0.
    process.stderr.write(
      '[stamp-artifact-write] unexpected error: ' +
      (e && e.stack || String(e)) + '\n'
    );
  }
  process.exit(0);
}
