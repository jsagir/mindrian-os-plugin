/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88-10 -- decision-capture persistence module
 * ===================================================
 * Per-section decision persistence. Writes APPROVE/REJECT/DEFER
 * decisions to the owning section's Feynman-MINTO.md frontmatter
 * decision_log field. When the log exceeds 20 entries, older entries
 * archive to .mindrian/decision-archive/YYYY-MM/<section>.jsonl
 * (partitioned by the ARCHIVED entry's timestamp, not the current
 * time). Read-optimized path for 88-07 session-start TRIPLE_CONTEXT
 * injection (paired with Phase 88-01 folder-memory.readDecisionLog).
 *
 * Usage example:
 *   const { recordDecision, readDecisionLog } = require('./decision-capture.cjs');
 *   const r = recordDecision(roomPath, 'market-analysis', {
 *     session_id: 'sess-2026-04-19-xyz',
 *     timestamp: new Date().toISOString(),
 *     action: 'flag_tam_staleness',
 *     user_response: 'defer',
 *     reason: 'Q3 refresh required',
 *   });
 *   // r: { success, violations?, archived? }
 *
 * Composes with:
 *   - Phase 87-02 (lib/core/write-lock.cjs) -- acquireLock around the
 *     MINTO mutation so cross-producer renames serialize cleanly.
 *   - Phase 88-00 (lib/memory/narrative-schema.cjs) --
 *     validateDecisionLogEntry is the single chokepoint for per-entry
 *     schema enforcement before we append.
 *   - Phase 88-00-B (lib/core/feynman-minto-invariants.cjs) -- post-write
 *     validation; critical severity aborts and restores the previous
 *     MINTO.md byte-for-byte.
 *   - Phase 88-04-B (scripts/vault-section-minto-generator.cjs) --
 *     atomic openSync 'wx' + fsync + rename pattern reused here.
 *
 * The decision_log field is preserved across regen via the 88-00 schema
 * contract (read-before-write preservation inside the generator). That
 * contract is tested independently in Test 11 of the acceptance suite.
 *
 * Pure CJS, node built-ins only, zero npm dependencies. Three-surface
 * compatible (CLI hook, Desktop MCP handler, Cowork shared runner).
 *
 * License: BSL 1.1.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const narrativeSchema = require('../memory/narrative-schema.cjs');
const writeLock = require('./write-lock.cjs');
const feynmanMintoInvariants = require('./feynman-minto-invariants.cjs');

const MAX_DECISION_LOG = 20;

// ---------- Helpers ----------

function safeReadSync(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch (_e) {
    return null;
  }
}

function stripQuote(s) {
  if (typeof s !== 'string') return s;
  const t = s.trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) return t.slice(1, -1);
  return t;
}

function quote(v) {
  // Minimal safe YAML double-quote: escape backslashes + inner quotes.
  const s = String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return '"' + s + '"';
}

// Narrow-dialect frontmatter parser scoped to this module: pulls every
// top-level key + the decision_log block-style object array. Copy of the
// 88-00 generator readPreservedV88Fields() approach with enough surface
// to rebuild the full frontmatter back (we need to preserve unknown
// keys byte-for-byte when we re-emit). Zero new deps.
function parseFrontmatter(fmText) {
  const lines = fmText.split(/\r?\n/);
  // We return an ordered list of "items": either {kind:'scalar', key, raw}
  // or {kind:'emptyArray', key} or {kind:'decisionLog', entries} or
  // {kind:'blockList', key, items[]} or {kind:'blank', raw}.
  // On re-emit we preserve the exact raw line for scalar items so unknown
  // keys (schema_version, status, etc.) survive mutation byte-for-byte.
  const items = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*$/.test(line)) {
      items.push({ kind: 'blank', raw: line });
      i += 1;
      continue;
    }
    const scalarM = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!scalarM) {
      // Non-conforming line -- preserve verbatim.
      items.push({ kind: 'blank', raw: line });
      i += 1;
      continue;
    }
    const key = scalarM[1];
    const rest = scalarM[2];

    if (rest.trim().length > 0) {
      // Inline scalar or flow-style array.
      items.push({ kind: 'scalar', key: key, raw: line });
      i += 1;
      continue;
    }

    // Block follows -- either string-list or object-list.
    // Look ahead: peek at next non-blank line.
    let j = i + 1;
    while (j < lines.length && /^\s*$/.test(lines[j])) j += 1;
    if (j >= lines.length) {
      items.push({ kind: 'emptyBlock', key: key, raw: line });
      i = j;
      continue;
    }
    const peek = lines[j];
    if (!/^\s+-\s/.test(peek)) {
      // Not a list -- treat as orphan empty.
      items.push({ kind: 'emptyBlock', key: key, raw: line });
      i = j;
      continue;
    }

    // Block list. Determine string-list vs object-list from first item.
    const objHead = peek.match(
      /^\s+-\s+([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/
    );
    const strItem = peek.match(/^\s+-\s+(.*)$/);
    const isObjectList = !!objHead;
    if (isObjectList) {
      // Consume object list.
      const entries = [];
      i = j;
      let current = null;
      while (i < lines.length) {
        const row = lines[i];
        if (/^\s*$/.test(row)) { i += 1; continue; }
        if (/^[A-Za-z_]/.test(row)) break;
        const head = row.match(
          /^\s+-\s+([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/
        );
        if (head) {
          if (current) entries.push(current);
          current = {};
          current[head[1]] = stripQuote(head[2]);
          i += 1;
          continue;
        }
        const cont = row.match(
          /^\s+([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/
        );
        if (cont && current) {
          current[cont[1]] = stripQuote(cont[2]);
          i += 1;
          continue;
        }
        break;
      }
      if (current) entries.push(current);
      items.push({ kind: 'objectList', key: key, entries: entries });
      continue;
    }
    // String list.
    const strItems = [];
    i = j;
    while (i < lines.length) {
      const row = lines[i];
      if (/^\s*$/.test(row)) { i += 1; continue; }
      if (/^[A-Za-z_]/.test(row)) break;
      const s = row.match(/^\s+-\s+(.*)$/);
      if (s) {
        strItems.push(stripQuote(s[1]));
        i += 1;
        continue;
      }
      break;
    }
    items.push({ kind: 'stringList', key: key, items: strItems });
  }
  return items;
}

function emitFrontmatter(items) {
  const out = [];
  for (const it of items) {
    if (it.kind === 'blank') {
      out.push(it.raw);
      continue;
    }
    if (it.kind === 'scalar' || it.kind === 'emptyBlock') {
      out.push(it.raw);
      continue;
    }
    if (it.kind === 'stringList') {
      if (it.items.length === 0) {
        out.push(it.key + ': []');
      } else {
        out.push(it.key + ':');
        for (const v of it.items) out.push('  - ' + quote(v));
      }
      continue;
    }
    if (it.kind === 'objectList') {
      if (it.entries.length === 0) {
        out.push(it.key + ': []');
      } else {
        out.push(it.key + ':');
        for (const entry of it.entries) {
          const keys = Object.keys(entry);
          if (keys.length === 0) continue;
          // session_id first if present (canonical ordering mirrors the
          // 88-00 generator renderV88FrontmatterLines decision_log shape).
          const ordered = [];
          if ('session_id' in entry) ordered.push('session_id');
          for (const k of keys) {
            if (k !== 'session_id') ordered.push(k);
          }
          ordered.forEach(function (k, idx) {
            const prefix = idx === 0 ? '  - ' : '    ';
            out.push(prefix + k + ': ' + quote(entry[k]));
          });
        }
      }
      continue;
    }
  }
  return out.join('\n');
}

// Extract the decision_log entries from a parsed frontmatter items array.
// Returns the current array + index (so we can replace it in place).
function findDecisionLog(items) {
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if ((it.kind === 'objectList' || it.kind === 'stringList') && it.key === 'decision_log') {
      return { idx: i, entries: Array.isArray(it.entries) ? it.entries.slice() : [] };
    }
    if ((it.kind === 'scalar' || it.kind === 'emptyBlock') && it.key === 'decision_log') {
      // Inline empty array: `decision_log: []`
      return { idx: i, entries: [] };
    }
  }
  return { idx: -1, entries: [] };
}

// Replace (or insert) the decision_log block in the items array.
function setDecisionLog(items, idx, entries) {
  const newItem = { kind: 'objectList', key: 'decision_log', entries: entries };
  if (idx === -1) {
    // Not present: insert before the last blank-at-end (if any) so the
    // output trails cleanly. Simplest: append.
    items.push(newItem);
  } else {
    items[idx] = newItem;
  }
  return items;
}

// ---------- Archive helpers ----------

// Derive YYYY-MM partition from an ISO-8601 timestamp. Returns null if the
// timestamp is malformed (should never happen: entries are validated
// before they enter the decision_log).
function archiveMonth(isoTimestamp) {
  if (typeof isoTimestamp !== 'string' || isoTimestamp.length < 7) return null;
  return isoTimestamp.slice(0, 7);
}

// Archive filename from a section. URL-encode every character that is
// unsafe across Linux, macOS, Windows filesystems so special-char
// sections (spaces, unicode, slashes) still work. We keep it simple:
// encodeURIComponent covers all known hazards.
function archiveBasename(section) {
  // Preserve dashes, which are filesystem-safe and readable.
  return encodeURIComponent(section).replace(/%2D/gi, '-') + '.jsonl';
}

function archiveEntry(roomPath, section, entry) {
  const yyyyMM = archiveMonth(entry.timestamp);
  if (!yyyyMM) {
    throw new Error(
      'decision-capture: cannot derive archive partition from timestamp ' +
        JSON.stringify(entry.timestamp)
    );
  }
  const archiveDir = path.join(
    roomPath,
    '.mindrian',
    'decision-archive',
    yyyyMM
  );
  fs.mkdirSync(archiveDir, { recursive: true });
  const archivePath = path.join(archiveDir, archiveBasename(section));
  // appendFileSync is atomic for small lines per POSIX for O_APPEND writes;
  // we still wrap in try/catch to surface filesystem errors cleanly.
  fs.appendFileSync(archivePath, JSON.stringify(entry) + '\n');
  return archivePath;
}

// ---------- Atomic MINTO mutation ----------

// Rewrite MINTO.md with the updated decision_log, preserving all other
// frontmatter keys and the body byte-for-byte. Uses the openSync('wx') +
// fsync + rename pattern from Phase 88-04-B (same atomic-write contract,
// scoped locally to this module to avoid cross-requiring the generator).
function atomicRewriteMintoWithDecisionLog(mintoPath, updatedEntries, roomPath) {
  const raw = safeReadSync(mintoPath);
  if (raw === null) {
    return {
      success: false,
      violations: [{
        category: 'existence',
        severity: 'error',
        message: 'no_minto',
      }],
    };
  }
  const fm = raw.match(/^(---\r?\n)([\s\S]*?)(\r?\n---\r?\n)([\s\S]*)$/);
  if (!fm) {
    return {
      success: false,
      violations: [{
        category: 'schema',
        severity: 'error',
        message: 'frontmatter-parse-failed',
      }],
    };
  }
  const header = fm[1];
  const fmText = fm[2];
  const tail = fm[3];
  const body = fm[4];

  const items = parseFrontmatter(fmText);
  const cur = findDecisionLog(items);
  setDecisionLog(items, cur.idx, updatedEntries);
  const newFmText = emitFrontmatter(items);
  const newContent = header + newFmText + tail + body;

  // Atomic write sequence (Phase 88-04-B pattern):
  //   openSync('wx') + writeSync + fsyncSync + closeSync
  //   + invariants.validate(tmp) (warning-tolerant, critical-blocks)
  //   + acquireLock + renameSync + releaseLock
  const tmpPath = mintoPath + '.tmp.' + process.pid + '.minto';
  let fd;
  try {
    fd = fs.openSync(tmpPath, 'wx');
  } catch (e) {
    if (e.code === 'EEXIST') {
      // Stale tmp from a prior mid-write crash owned by the same pid
      // slot. Clean and retry once.
      try { fs.unlinkSync(tmpPath); } catch (_) {}
      fd = fs.openSync(tmpPath, 'wx');
    } else {
      throw e;
    }
  }
  try {
    fs.writeSync(fd, newContent);
    fs.fsyncSync(fd);
  } finally {
    try { fs.closeSync(fd); } catch (_) {}
  }

  // Post-write invariants validation. Critical severity aborts and
  // restores the previous MINTO.md byte-for-byte (by unlinking the tmp).
  let validation;
  try {
    validation = feynmanMintoInvariants.validate(tmpPath);
  } catch (_e) {
    validation = { valid: true, violations: [], severity: null };
  }
  const SEV = feynmanMintoInvariants.SEVERITY;
  const isCritical = validation.violations.some(function (v) {
    return v.severity === SEV.CRITICAL;
  });
  if (isCritical) {
    try { fs.unlinkSync(tmpPath); } catch (_) {}
    return {
      success: false,
      violations: validation.violations,
    };
  }

  // Atomic publish under the Phase 87-02 write-lock. Retry on contention
  // with exponential backoff + half-jitter (mirrors 88-04-B pattern).
  const LOCK_RETRIES = 12;
  const LOCK_BASE_MS = 25;
  const LOCK_CAP_MS = 1600;
  let locked = false;
  let lockErr = null;
  for (let attempt = 0; attempt < LOCK_RETRIES; attempt++) {
    try {
      writeLock.acquireLock(roomPath);
      locked = true;
      lockErr = null;
      break;
    } catch (e) {
      lockErr = e;
      const backoff = Math.min(
        LOCK_CAP_MS,
        LOCK_BASE_MS * Math.pow(2, attempt)
      );
      const sleep = Math.floor(backoff / 2 + Math.random() * (backoff / 2));
      const end = Date.now() + sleep;
      while (Date.now() < end) { /* busy-wait */ }
    }
  }
  if (!locked) {
    try { fs.unlinkSync(tmpPath); } catch (_) {}
    return {
      success: false,
      violations: [{
        category: 'atomicity',
        severity: 'error',
        message: 'write-lock acquire failed after ' + LOCK_RETRIES +
          ' retries: ' + (lockErr && lockErr.message || lockErr),
      }],
    };
  }

  try {
    fs.renameSync(tmpPath, mintoPath);
  } finally {
    try { writeLock.releaseLock(roomPath); } catch (_) {}
  }

  return { success: true, violations: validation.violations };
}

// ---------- Public API ----------

/**
 * recordDecision(roomPath, section, decision)
 *
 * Append a decision to the section's MINTO.md frontmatter decision_log.
 * Enforces the 20-entry cap; older entries archive to
 * `<roomPath>/.mindrian/decision-archive/YYYY-MM/<section>.jsonl`
 * partitioned by the ARCHIVED entry's timestamp (not the current time).
 *
 * Returns:
 *   { success: true, violations: [], archived: {count, archivePaths[]} | null }
 *   { success: false, violations: [...] }
 */
function recordDecision(roomPath, section, decision) {
  // --- Validate entry shape ---
  const v = narrativeSchema.validateDecisionLogEntry(decision);
  if (!v.valid) {
    return {
      success: false,
      violations: v.errors.map(function (msg) {
        return { category: 'schema', severity: 'error', message: msg };
      }),
    };
  }

  const mintoPath = path.join(roomPath, section, 'MINTO.md');
  if (!fs.existsSync(mintoPath)) {
    // This plan does NOT create MINTO.md from scratch. 88-13 guardian
    // will enqueue regen when it sees an empty section with a decision
    // request. Surface the gap so the caller can route to the debouncer.
    return {
      success: false,
      violations: [{
        category: 'existence',
        severity: 'error',
        message: 'no_minto',
      }],
    };
  }

  // --- Acquire write-lock around the read-modify-write cycle ---
  // The atomic rewriter acquires its own lock around the rename. We also
  // hold a SEPARATE lock around the read-modify-write so two processes
  // cannot both read the same decision_log, append disjoint entries, and
  // then race their writes (last-writer-wins would lose one entry).
  //
  // Retry with exponential backoff so concurrent producers converge
  // without starvation (Phase 88-02/88-04-B backoff pattern).
  const LOCK_RETRIES = 12;
  const LOCK_BASE_MS = 25;
  const LOCK_CAP_MS = 1600;
  let outerLocked = false;
  let outerErr = null;
  for (let attempt = 0; attempt < LOCK_RETRIES; attempt++) {
    try {
      writeLock.acquireLock(roomPath);
      outerLocked = true;
      outerErr = null;
      break;
    } catch (e) {
      outerErr = e;
      const backoff = Math.min(
        LOCK_CAP_MS,
        LOCK_BASE_MS * Math.pow(2, attempt)
      );
      const sleep = Math.floor(backoff / 2 + Math.random() * (backoff / 2));
      const end = Date.now() + sleep;
      while (Date.now() < end) { /* busy-wait */ }
    }
  }
  if (!outerLocked) {
    return {
      success: false,
      violations: [{
        category: 'atomicity',
        severity: 'error',
        message: 'decision-capture: outer write-lock acquire failed: ' +
          (outerErr && outerErr.message || outerErr),
      }],
    };
  }

  try {
    // --- Read current decision_log ---
    const currentLog = readDecisionLogInternal(mintoPath);
    const newLog = currentLog.concat([decision]);

    // --- Cap + archive ---
    let archivedCount = 0;
    const archivePaths = [];
    while (newLog.length > MAX_DECISION_LOG) {
      const oldest = newLog.shift();
      try {
        const ap = archiveEntry(roomPath, section, oldest);
        archivedCount += 1;
        archivePaths.push(ap);
      } catch (e) {
        return {
          success: false,
          violations: [{
            category: 'atomicity',
            severity: 'error',
            message: 'archive write failed: ' + (e && e.message || e),
          }],
        };
      }
    }

    // --- Atomic MINTO rewrite ---
    // The rewriter acquires its OWN lock around the rename; our outer
    // lock guarantees atomic read-modify-write but the acquireLock call
    // inside atomicRewriteMintoWithDecisionLog sees we already own the
    // lock (same PID) and re-acquires cleanly (write-lock.cjs same-pid
    // re-acquire is an overwrite, not a throw).
    const writeResult = atomicRewriteMintoWithDecisionLog(
      mintoPath,
      newLog,
      roomPath
    );
    if (!writeResult.success) {
      // Atomic rewrite failed -- the archived entries are already on
      // disk. That is acceptable: archival is append-only (JSONL) and
      // the caller retries the write. The MINTO decision_log will
      // re-converge on next successful call.
      return writeResult;
    }

    return {
      success: true,
      violations: writeResult.violations || [],
      archived: archivedCount > 0
        ? { count: archivedCount, archivePaths: archivePaths }
        : null,
    };
  } finally {
    try { writeLock.releaseLock(roomPath); } catch (_) {}
  }
}

// Internal helper: read decision_log directly from a MINTO path without
// going through folder-memory (avoids cross-require + lets us parse the
// exact block-style dialect we emit).
function readDecisionLogInternal(mintoPath) {
  const raw = safeReadSync(mintoPath);
  if (raw === null) return [];
  const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!fm) return [];
  const items = parseFrontmatter(fm[1]);
  const found = findDecisionLog(items);
  return found.entries;
}

/**
 * readDecisionLog(roomPath, section)
 *
 * Returns the current decision_log (Array) from the section's MINTO.md
 * frontmatter. Never throws. Returns [] when MINTO is missing or lacks
 * the field (pre-88-00 file not yet migrated).
 *
 * Does NOT read the archive. The archive is for dedicated full-history
 * consumers (not needed for 88-07 session-start injection, which only
 * consumes the current-section window).
 */
function readDecisionLog(roomPath, section) {
  const mintoPath = path.join(roomPath, section, 'MINTO.md');
  return readDecisionLogInternal(mintoPath);
}

module.exports = {
  recordDecision: recordDecision,
  readDecisionLog: readDecisionLog,
};
