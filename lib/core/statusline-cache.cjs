/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88.1-04 -- statusline MINTO segment cache + format helpers
 * =================================================================
 * Pure, disk-backed, 5-second TTL cache for the Claude Code statusline
 * MINTO segment. The statusline fires once per turn via scripts/context-monitor
 * and must stay within a 300ms render budget (CONTEXT R1 mitigation).
 *
 * Cold path (no cache):  readTriple + cache write. Target < 200ms on fresh WSL2.
 * Warm path (cache hit): JSON parse + string format. Target < 10ms.
 *
 * The cache is LOCAL by construction per Canon Part 8: all writes land at
 * roomRoot/.mindrian/statusline-cache.json and never egress. No Brain calls,
 * no fetch, no external endpoints.
 *
 * Canon references:
 *   Part 2  UI glyph vocabulary -- classifyHealth emits check / warn / low / --
 *     for the MINTO reasoning_health_score (shared with
 *     lib/memory/triple-context-formatter.cjs + Phase 88.1-03 hook sysmsg
 *     retrofit so rendering is byte-identical across surfaces).
 *   Part 3  Tri-Context Decision Gate -- statusline renders LOCAL only.
 *     Never BRAIN (BRAIN payloads are generic methodology only), never SIGNAL
 *     (SIGNAL belongs to scheduled sweeps, not per-turn UI).
 *   Part 8  Graph Boundary -- all cached bytes describe this specific user's
 *     room state. They stay in this room. The boundary is architectural.
 *
 * Composes with:
 *   Phase 87-02  atomic write pattern (openSync('wx') + fsync + rename) for
 *     concurrent-safe cache persistence under rapid-statusline-fire.
 *   Phase 88-01  folder-memory.readTriple(sectionPath) is the read contract;
 *     cached 'triple' values are the shape readTriple returns.
 *   Phase 88-07 / 88.1-03  classifyHealth shared vocabulary so every L3
 *     surface (session-start sysmsg, guardian, statusline, /mos:status) uses
 *     the same glyph classifier.
 *
 * Pure CJS, node built-ins only, zero npm dependencies. Three-surface
 * compatible by construction (CLI + Desktop MCP + Cowork).
 *
 * API:
 *   TTL_MS                                       -- number, fixed at 5000ms.
 *   getCached(roomRoot, sectionPath)             -> {value, fresh}
 *   setCached(roomRoot, sectionPath, triple)     -> void (graceful on error)
 *   truncateGoverningThought(str)                -> string (60-char budget)
 *   classifyHealth(score)                        -> 'check'|'warn'|'low'|'--'
 *
 * Cache file shape:
 *   { ts: number, sectionPath: string, triple: object }
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

// ---------- Tunables (frozen invariants) ----------

// 5-second TTL per CONTEXT R1 mitigation. Short enough that users perceive
// freshness (a change to MINTO.md shows up on the next statusline tick after
// 5s), long enough that 12 statusline fires/min all hit the warm path.
const TTL_MS = 5000;

// 60-char budget for the governing_thought segment. Matches the description-
// discipline budget from Plan 88.1-01 so the statusline honors the same
// text-economy contract the rest of L3 uses.
const GOVERNING_THOUGHT_BUDGET = 60;

// Cache filename under roomRoot/.mindrian/. Named separately from the Phase
// 88-06 session-snapshot.json to avoid any cross-purpose coupling.
const CACHE_FILENAME = 'statusline-cache.json';

// ---------- Path helpers ----------

function cacheDir(roomRoot) {
  return path.join(roomRoot, '.mindrian');
}

function cacheFile(roomRoot) {
  return path.join(cacheDir(roomRoot), CACHE_FILENAME);
}

// ---------- classifyHealth (shared with triple-context-formatter) ----------
//
// Canon Part 2 glyph vocabulary: check / warn / low / --. Byte-identical to
// the classifier extracted in Phase 88.1-03 so the statusline, the hook
// systemMessage retrofit, and the TRIPLE_CONTEXT formatter all render the
// same glyph for the same score. See lib/memory/triple-context-formatter.cjs
// lines 80-101 for the canonical source; this copy mirrors it for zero-cost
// import from lib/core/ consumers that should not reach into lib/memory/.
//
// Signature: classifyHealth(score: number | null | undefined)
//   -> 'check' | 'warn' | 'low' | '--'

function classifyHealth(score) {
  if (typeof score !== 'number' || !Number.isFinite(score)) return '--';
  if (score >= 0.7) return 'check';
  if (score >= 0.4) return 'warn';
  return 'low';
}

// ---------- truncateGoverningThought ----------

/**
 * truncateGoverningThought
 *   Enforce the 60-char statusline budget on a governing_thought string.
 *   Short inputs (<= 60 chars) pass through byte-identical. Long inputs are
 *   truncated to 59 chars plus a Unicode ellipsis (U+2026) for a total of
 *   exactly 60 chars. Non-string / empty inputs return the empty string.
 */
function truncateGoverningThought(str) {
  if (typeof str !== 'string') return '';
  if (str.length <= GOVERNING_THOUGHT_BUDGET) return str;
  // 59 chars + 1 ellipsis = exactly 60 chars, matching the budget.
  return str.slice(0, GOVERNING_THOUGHT_BUDGET - 1) + '\u2026';
}

// ---------- Disk read ----------

function safeReadSync(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch (_e) {
    return null;
  }
}

/**
 * getCached(roomRoot, sectionPath) -> {value, fresh}
 *
 * Returns {value: null, fresh: false} when:
 *   - cache file does not exist
 *   - cache file is malformed JSON
 *   - cache entry belongs to a different sectionPath
 *   - cache entry is older than TTL_MS
 *
 * Returns {value: triple, fresh: true} on a warm hit. The statusline reads
 * the triple fields directly (reasoning.governing_thought,
 * reasoning.reasoning_health_score, reasoning.is_stale).
 *
 * Never throws. Graceful fallback on every error path.
 */
function getCached(roomRoot, sectionPath) {
  const miss = { value: null, fresh: false };
  if (!roomRoot || !sectionPath) return miss;

  const file = cacheFile(roomRoot);
  const raw = safeReadSync(file);
  if (raw === null) return miss;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (_e) {
    return miss;
  }

  if (!parsed || typeof parsed !== 'object') return miss;
  if (parsed.sectionPath !== sectionPath) return miss;
  if (typeof parsed.ts !== 'number' || !Number.isFinite(parsed.ts)) return miss;

  const age = Date.now() - parsed.ts;
  if (age < 0 || age >= TTL_MS) {
    return { value: null, fresh: false };
  }
  if (!parsed.triple || typeof parsed.triple !== 'object') return miss;

  return { value: parsed.triple, fresh: true };
}

// ---------- Disk write (atomic) ----------

/**
 * setCached(roomRoot, sectionPath, triple) -> void
 *
 * Atomic write sequence (Phase 87-02 pattern):
 *   - mkdir -p roomRoot/.mindrian/ (idempotent)
 *   - openSync('wx') on a pid-scoped tmp file
 *   - writeSync + fsyncSync + closeSync
 *   - renameSync over the real cache file
 *
 * Graceful fallback: any filesystem error (EEXIST on tmp, EACCES on mkdir,
 * ENOENT on rename, disk full, etc.) is swallowed silently. The cache is
 * a performance optimization; a failed write must NEVER bubble up to
 * context-monitor because the statusline has to render regardless.
 *
 * Never throws. This is the Part 8-by-construction guarantee: a pure
 * persistence side-effect that cannot leak state anywhere except the
 * LOCAL roomRoot/.mindrian/ directory.
 */
function setCached(roomRoot, sectionPath, triple) {
  if (!roomRoot || !sectionPath) return;

  const dir = cacheDir(roomRoot);
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (_e) {
    // If mkdir fails (e.g. .mindrian is a regular file, not a directory),
    // bail out silently. Graceful-fallback invariant.
    return;
  }

  const payload = {
    ts: Date.now(),
    sectionPath: sectionPath,
    triple: triple,
  };

  let serialized;
  try {
    serialized = JSON.stringify(payload);
  } catch (_e) {
    // Cyclic references in triple -> serialization failure. Bail.
    return;
  }

  const finalPath = cacheFile(roomRoot);
  const tmpPath = finalPath + '.tmp.' + process.pid + '.statusline';

  let fd;
  try {
    fd = fs.openSync(tmpPath, 'wx');
  } catch (e) {
    if (e && e.code === 'EEXIST') {
      // Stale tmp from a prior crash owned by the same pid slot. Clean and
      // retry once. Any second failure is swallowed.
      try { fs.unlinkSync(tmpPath); } catch (_) {}
      try {
        fd = fs.openSync(tmpPath, 'wx');
      } catch (_e2) {
        return;
      }
    } else {
      return;
    }
  }

  try {
    fs.writeSync(fd, serialized);
    try { fs.fsyncSync(fd); } catch (_) { /* fsync best-effort */ }
  } catch (_e) {
    try { fs.closeSync(fd); } catch (_) {}
    try { fs.unlinkSync(tmpPath); } catch (_) {}
    return;
  } finally {
    try { fs.closeSync(fd); } catch (_) {}
  }

  try {
    fs.renameSync(tmpPath, finalPath);
  } catch (_e) {
    // Rename failed. Clean up tmp and bail.
    try { fs.unlinkSync(tmpPath); } catch (_) {}
    return;
  }
}

// ---------- Exports ----------

module.exports = {
  TTL_MS: TTL_MS,
  GOVERNING_THOUGHT_BUDGET: GOVERNING_THOUGHT_BUDGET,
  getCached: getCached,
  setCached: setCached,
  truncateGoverningThought: truncateGoverningThought,
  classifyHealth: classifyHealth,
};
