'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 90-03 Task 1 -- BRAIN.md staleness computation
 * =====================================================
 * LOCAL computation of whether a BRAIN.md file is fresh, stale, or absent.
 * Consumed by scripts/session-start (Phase 90-03 injection block) to decide
 * which sections to enqueue for background regeneration via the Phase 90-02
 * brain-derivation-queue. Never queries Brain content. Never walks the graph.
 * Compares local hashes against the local triple and against the local
 * brain_graph_version that was recorded in BRAIN.md frontmatter at the time
 * the derivation was written.
 *
 * Canon Part 8 invariant (load-bearing):
 *   The scan NEVER queries the Brain for user content. It may call:
 *     - brain-client.isAvailable() -> boolean (no network on cache hit)
 *     - brain-client.schema() -> { brain_graph_version: number, ... }
 *   It MUST NOT call:
 *     - brain-client.query / search / smartSearch / enrich*
 *   Test 13 in brain-md-staleness.test.cjs instruments a mock brain-client
 *   and asserts ZERO content queries across 10 sections.
 *
 * Staleness precedence (ordered, first match wins):
 *   1. File missing / non-regular / zero-byte -> absent
 *      (recommended_action=enqueue_when_brain_online)
 *   2. Parse-fail (malformed frontmatter) -> stale, stale_reason=parse_failed
 *      (recommended_action=enqueue_regen, demoted if Brain offline)
 *   3. governing_thought_hash mismatch vs triple -> stale, stale_reason=governing_thought_changed
 *   4. age_days > STALE_AGE_DAYS -> stale, stale_reason=age_exceeded
 *   5. brain_graph_version < current schema().graph_version -> stale,
 *      stale_reason=brain_graph_version_mismatch
 *   6. else -> fresh
 *
 * Brain-offline behavior:
 *   - absent + offline: unchanged (recommended_action=enqueue_when_brain_online)
 *   - stale + offline: stale persists, recommended_action DEMOTED to
 *     enqueue_when_brain_online (we cannot drain without Brain; hold the
 *     intent for when it comes back; next drain or next session-start's
 *     scan will pick it up)
 *   - fresh + offline: unchanged (no action)
 *   - brain_graph_version check SKIPPED when offline (schema() unavailable)
 *
 * Env override:
 *   BRAIN_STALE_AGE_DAYS=3 claude  -- tighter staleness (3-day threshold)
 *   BRAIN_STALE_AGE_DAYS=30 claude -- looser (30-day threshold)
 *   BRAIN_STALE_AGE_DAYS='abc'     -- fallback to 7 (no warning)
 *   BRAIN_STALE_AGE_DAYS=0         -- fallback to 7 (positive integer only)
 *
 * Return shape:
 *   {
 *     exists: boolean,
 *     staleness: 'fresh' | 'stale' | 'absent',
 *     stale_reason: null | 'governing_thought_changed' | 'age_exceeded'
 *                   | 'brain_graph_version_mismatch' | 'brain_offline'
 *                   | 'parse_failed',
 *     brain_generated_at: string | null,
 *     brain_graph_version: number | null,
 *     age_days: number | null,
 *     recommended_action: 'none' | 'enqueue_regen' | 'enqueue_when_brain_online' | 'skip'
 *   }
 *
 * Three-surface pure: CLI + Desktop MCP + Cowork all share this module.
 * Pure CJS, node built-ins only, zero npm deps.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// ---------- Constants ----------

const DEFAULT_STALE_AGE_DAYS = 7;

// ---------- Env override ----------

function getStaleAgeDays() {
  const raw = process.env.BRAIN_STALE_AGE_DAYS;
  if (raw === undefined || raw === null || raw === '') {
    return DEFAULT_STALE_AGE_DAYS;
  }
  const n = parseInt(raw, 10);
  // Positive integer only; garbage (NaN, 0, negative, non-integer) falls back.
  if (Number.isFinite(n) && n > 0 && String(n) === String(raw).trim()) {
    return n;
  }
  return DEFAULT_STALE_AGE_DAYS;
}

// STALE_AGE_DAYS constant for grep discoverability; env override via getter.
const STALE_AGE_DAYS = DEFAULT_STALE_AGE_DAYS;

// ---------- Narrow-dialect frontmatter parser ----------
//
// Scoped to BRAIN.md fields (flat scalars only). Mirrors the same narrow
// dialect shipped in Phase 90-00 brain-md-schema.cjs. Kept local to this
// module so we do not cross-import (keeps lib/core dependency graph flat
// per Phase 88-01 key decision). Parse failure returns { ok: false } and
// the caller maps to stale_reason='parse_failed'.

function unquote(raw) {
  const s = raw.trim();
  if (s.length === 0) return '';
  if (s[0] === '"') {
    if (s.length < 2 || s[s.length - 1] !== '"') return null;
    return s.slice(1, -1);
  }
  if (s[0] === "'") {
    if (s.length < 2 || s[s.length - 1] !== "'") return null;
    return s.slice(1, -1);
  }
  return s;
}

function castScalar(s) {
  if (s === 'null' || s === '~') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^-?\d+$/.test(s)) {
    const n = parseInt(s, 10);
    if (Number.isSafeInteger(n)) return n;
  }
  if (/^-?\d+\.\d+$/.test(s)) {
    const f = parseFloat(s);
    if (Number.isFinite(f)) return f;
  }
  return s;
}

function parseFrontmatter(raw) {
  if (typeof raw !== 'string' || raw.length === 0) {
    return { ok: false, error: 'empty' };
  }
  const fmRe = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
  const m = raw.match(fmRe);
  if (!m) {
    return { ok: false, error: 'missing_delimiters' };
  }
  const src = m[1];
  const lines = src.split(/\r?\n/);
  const root = {};
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length === 0 || /^\s*$/.test(line) || /^\s*#/.test(line)) continue;
    const m2 = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):(.*)$/);
    if (!m2) {
      return { ok: false, error: 'unrecognized_line_' + (i + 1) };
    }
    const key = m2[1];
    const rest = m2[2];
    if (rest.trim().length === 0) {
      root[key] = '';
      continue;
    }
    const vStr = unquote(rest);
    if (vStr === null) {
      return { ok: false, error: 'unterminated_quote_' + key };
    }
    root[key] = castScalar(vStr);
  }
  return { ok: true, data: root };
}

// ---------- Hash helper ----------

function sha256OfGoverningThought(gt) {
  const s = gt == null ? '' : String(gt);
  return 'sha256:' + crypto.createHash('sha256')
    .update(s.normalize('NFC'))
    .digest('hex');
}

// ---------- Age helper ----------

function computeAgeDays(isoTs) {
  if (typeof isoTs !== 'string' || isoTs.length === 0) return null;
  const t = Date.parse(isoTs);
  if (!Number.isFinite(t)) return null;
  const ageMs = Date.now() - t;
  if (ageMs < 0) return 0; // clock-skew guard: future timestamps treated as fresh-now
  return ageMs / (24 * 60 * 60 * 1000);
}

// ---------- Result helpers ----------

function emptyResult() {
  return {
    exists: false,
    staleness: 'fresh',
    stale_reason: null,
    brain_generated_at: null,
    brain_graph_version: null,
    age_days: null,
    recommended_action: 'none',
  };
}

// Demote recommended_action when Brain offline. Stale cases become "hold
// for when Brain comes back"; absent unchanged; fresh unchanged.
function demoteWhenOffline(result, offline) {
  if (!offline) return result;
  if (result.staleness === 'stale' && result.recommended_action === 'enqueue_regen') {
    result.recommended_action = 'enqueue_when_brain_online';
  }
  return result;
}

// ---------- Main entry ----------

/**
 * computeBrainStaleness(sectionPath, triple) -> Promise<result>
 *
 * Never throws. Every failure mode returns a structured result object.
 * The caller (scripts/session-start Phase 90-03 block) uses the result
 * to decide whether to enqueue a regeneration and how to annotate the
 * TRIPLE_CONTEXT block.
 */
async function computeBrainStaleness(sectionPath, triple) {
  const result = emptyResult();

  // --- Check Brain availability (non-throwing) ---
  let brainClient;
  let offline = false;
  try {
    brainClient = require('./brain-client.cjs');
  } catch (_e) {
    brainClient = null;
  }
  try {
    if (brainClient && typeof brainClient.isAvailable === 'function') {
      offline = brainClient.isAvailable() !== true;
    } else {
      offline = true;
    }
  } catch (_e) {
    offline = true;
  }

  // --- Check BRAIN.md existence ---
  const brainMdPath = path.join(sectionPath, 'BRAIN.md');
  let stat;
  try {
    stat = fs.statSync(brainMdPath);
  } catch (_e) {
    // Absent.
    result.exists = false;
    result.staleness = 'absent';
    result.stale_reason = offline ? 'brain_offline' : null;
    result.recommended_action = 'enqueue_when_brain_online';
    return result;
  }
  if (!stat.isFile() || stat.size === 0) {
    result.exists = false;
    result.staleness = 'absent';
    result.stale_reason = offline ? 'brain_offline' : null;
    result.recommended_action = 'enqueue_when_brain_online';
    return result;
  }

  result.exists = true;

  // --- Read + parse frontmatter ---
  let raw;
  try {
    raw = fs.readFileSync(brainMdPath, 'utf8');
  } catch (_e) {
    result.staleness = 'stale';
    result.stale_reason = 'parse_failed';
    result.recommended_action = 'enqueue_regen';
    return demoteWhenOffline(result, offline);
  }

  const parsed = parseFrontmatter(raw);
  if (!parsed.ok) {
    result.staleness = 'stale';
    result.stale_reason = 'parse_failed';
    result.recommended_action = 'enqueue_regen';
    return demoteWhenOffline(result, offline);
  }
  const fm = parsed.data;

  // Populate metadata.
  result.brain_generated_at = typeof fm.brain_generated_at === 'string'
    ? fm.brain_generated_at
    : null;
  result.brain_graph_version = typeof fm.brain_graph_version === 'number'
    ? fm.brain_graph_version
    : null;
  result.age_days = computeAgeDays(result.brain_generated_at);

  // --- Precedence 3: governing_thought_hash mismatch vs triple ---
  const tripleReasoning = (triple && triple.reasoning) || {};
  const tripleGt = tripleReasoning.governing_thought;
  const currentHash = sha256OfGoverningThought(tripleGt);
  const recordedHash = typeof fm.governing_thought_hash === 'string'
    ? fm.governing_thought_hash
    : null;

  if (recordedHash && recordedHash !== currentHash) {
    result.staleness = 'stale';
    result.stale_reason = 'governing_thought_changed';
    result.recommended_action = 'enqueue_regen';
    return demoteWhenOffline(result, offline);
  }

  // --- Precedence 4: age > STALE_AGE_DAYS ---
  const threshold = getStaleAgeDays();
  if (result.age_days != null && result.age_days > threshold) {
    result.staleness = 'stale';
    result.stale_reason = 'age_exceeded';
    result.recommended_action = 'enqueue_regen';
    return demoteWhenOffline(result, offline);
  }

  // --- Precedence 5: brain_graph_version mismatch ---
  // Skip when offline; we cannot call schema() without Brain. An offline
  // run keeps the file as 'fresh' for the version axis; the next online
  // session-start will re-evaluate.
  if (!offline && result.brain_graph_version != null && brainClient && typeof brainClient.schema === 'function') {
    let currentSchema = null;
    try {
      currentSchema = await brainClient.schema();
    } catch (_e) {
      currentSchema = null;
    }
    if (currentSchema && typeof currentSchema.brain_graph_version === 'number') {
      if (result.brain_graph_version < currentSchema.brain_graph_version) {
        result.staleness = 'stale';
        result.stale_reason = 'brain_graph_version_mismatch';
        result.recommended_action = 'enqueue_regen';
        return result;
      }
    }
  }

  // --- Precedence 6: fresh ---
  result.staleness = 'fresh';
  result.stale_reason = null;
  result.recommended_action = 'none';
  return result;
}

// ---------- Exports ----------

module.exports = {
  computeBrainStaleness: computeBrainStaleness,
  STALE_AGE_DAYS: STALE_AGE_DAYS,
  DEFAULT_STALE_AGE_DAYS: DEFAULT_STALE_AGE_DAYS,
  // Test surface (not public API)
  _test: Object.freeze({
    sha256OfGoverningThought: sha256OfGoverningThought,
    parseFrontmatter: parseFrontmatter,
    computeAgeDays: computeAgeDays,
    getStaleAgeDays: getStaleAgeDays,
  }),
};
