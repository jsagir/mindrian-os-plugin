/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 117-01 Wave 1 -- explored-materials-store substrate.
 *
 * JSONL append-only state store at ~/.mindrian/explored-materials/<roomSlug>.jsonl.
 * Per CLAUDE.md workspace guard: writes OUTSIDE plugin repo (os.homedir()).
 * Per Canon Part 8: USER_CONTENT_KEY_DENYLIST guards against telemetry leakage.
 *
 * Graph-native HARD RULE (memory feedback_reverse_salient_agent_graph_native.md):
 *   1. NEVER require room-db.cjs (Phase 109 D-06 chokepoint).
 *   2. NEVER require brain-client (Canon Part 8 boundary).
 *   3. NEVER call console.log or process.stdout.write (dual-surface telemetry contract).
 *
 * Pattern: append-only writer + LWW replay (mirrors lib/memory/pending-tension-store.cjs
 * Phase 116-01 verbatim; field substitutions per RESEARCH Section 3 sibling code-clone).
 *
 * DELTA vs Phase 116-01 pending-tension-store.cjs: same 8-export skeleton; field
 * renames (tension_id -> material_id; tension_type -> mtime_seconds; source_node_ids
 * -> relative_file_path). State machine vocabulary differs (queued | in_flight |
 * completed | failed instead of queued | surfaced | resolved | dropped). 2 new
 * exports added (markFailed, sweepStaleInFlight) to handle the in_flight
 * stale-sweep that 116 does not have because tensions have no background-spawn
 * lifecycle.
 *
 * Pure CJS, node built-ins only, zero new runtime dependencies.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

// ---------- Constants ----------

const EXPLORED_MATERIALS_DIR = path.join(os.homedir(), '.mindrian', 'explored-materials');

const VALID_STATES = Object.freeze(new Set(['queued', 'in_flight', 'completed', 'failed']));

const VALID_RESPONSES = Object.freeze(new Set(['EXPLORE', 'SKIP', 'LATER', 'FREE_TEXT']));

const VALID_SUPPRESS_REASONS = Object.freeze(new Set([
  'tier_0',
  'just_talk',
  'dispatcher_load_failed',
  'pickShape_unavailable',
  'all_pipelines_empty',
  'brain_baseline_unavailable',
  'rate_limited',
  'daily_cap_exceeded',
  'room_dir_not_writable',
  'ledger_replay_failed',
  'hybrid_mode_insufficient_corpus',
  'sanitizer_blocked',
  'invalid_args',
]));

// User-content key denylist (Canon Part 8 -- artifact bodies, titles, transcripts
// live in the graph, never in this JSONL). Rejection is fail-fast at
// appendMaterial time so a caller bug never leaks user content to disk.
// NOTE: relative_file_path IS allowed in the ledger (LOCAL-only state file
// outside the plugin repo per workspace guard), but MUST be hashed to
// file_path_sha256 BEFORE any memory_event payload write or telemetry mirror.
const USER_CONTENT_KEY_DENYLIST = Object.freeze(new Set([
  'body_text',
  'source_title',
  'target_title',
  'artifact_body',
  'note_content',
  'transcript_content',
  'meeting_summary',
  'cv_content',
  'file_content',
]));

const MATERIAL_ID_LEN = 32;
const STALE_IN_FLIGHT_MS_DEFAULT = 300000; // 5 minutes per RESEARCH scenario 7

// ---------- Material id (deterministic, second-precision) ----------

/**
 * Compute the deterministic material id for a (roomDir, relativeFilePath, mtimeMs)
 * tuple. Per RESEARCH Section 4.5: mtime is FLOORED to seconds for cross-fs
 * portability (FAT32, NFS, etc. lack ms-precision; risk T1).
 *
 * @param {string} roomDir            absolute path to room (with .room-root)
 * @param {string} relativeFilePath   path relative to roomDir
 * @param {number} mtimeMs            file mtime in ms-epoch
 * @returns {string} 32-char hex sha256 prefix
 */
function computeMaterialId(roomDir, relativeFilePath, mtimeMs) {
  const seconds = Math.floor(Number(mtimeMs) / 1000);
  const basis = String(roomDir) + '|' + String(relativeFilePath) + '|' + String(seconds);
  return crypto.createHash('sha256').update(basis).digest('hex').slice(0, MATERIAL_ID_LEN);
}

// ---------- JSONL path resolution (workspace-guard-clean) ----------

/**
 * Resolve the JSONL path for a given room slug. Always returns a path under
 * os.homedir() per CLAUDE.md workspace guard (OUTSIDE the plugin repo).
 *
 * @param {string} roomSlug
 * @returns {string} absolute path
 */
function jsonlPath(roomSlug) {
  const safeSlug = encodeURIComponent(String(roomSlug || 'default-room'));
  return path.join(EXPLORED_MATERIALS_DIR, safeSlug + '.jsonl');
}

// ---------- Internal helpers ----------

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isHex32(v) {
  return typeof v === 'string' && /^[0-9a-f]{32}$/.test(v);
}

function violatesUserContentBoundary(entry) {
  for (const k of Object.keys(entry)) {
    if (USER_CONTENT_KEY_DENYLIST.has(k)) return k;
  }
  return null;
}

// ---------- Validation ----------

/**
 * Validate the shape of an entry. Returns { ok: true } on success, or
 * { ok: false, reason, offending_key? } on rejection.
 *
 * Canon Part 8 enforcement: any USER_CONTENT_KEY_DENYLIST key in the entry
 * triggers a canon_part_8_violation rejection (fail-fast before disk write).
 *
 * @param {object} entry
 * @returns {{ok: true} | {ok: false, reason: string, offending_key?: string}}
 */
function validateEntryShape(entry) {
  if (!isPlainObject(entry)) {
    return { ok: false, reason: 'entry_not_object' };
  }
  // Canon Part 8 boundary -- check FIRST so a payload with denylist keys is
  // rejected even if other shape checks would also fail.
  const violator = violatesUserContentBoundary(entry);
  if (violator) {
    return { ok: false, reason: 'canon_part_8_violation', offending_key: violator };
  }
  if (!isHex32(entry.material_id)) {
    return { ok: false, reason: 'invalid_material_id' };
  }
  if (!VALID_STATES.has(entry.state)) {
    return { ok: false, reason: 'invalid_state' };
  }
  if (!Number.isInteger(entry.mtime_seconds) || entry.mtime_seconds < 0) {
    return { ok: false, reason: 'invalid_mtime_seconds' };
  }
  if (!Number.isInteger(entry.fired_at) || entry.fired_at < 0) {
    return { ok: false, reason: 'invalid_fired_at' };
  }
  return { ok: true };
}

// ---------- Public API ----------

/**
 * Append a material entry to the room's JSONL file. Creates the directory if
 * missing. Validates shape + Canon Part 8 boundary; rejects user-content
 * fields.
 *
 * @param {string} roomSlug
 * @param {object} entry  conforming to RESEARCH Section 4.5 schema
 * @returns {{ok: true, path: string} | {ok: false, reason: string, offending_key?: string}}
 */
function appendMaterial(roomSlug, entry) {
  const validation = validateEntryShape(entry);
  if (!validation.ok) return validation;
  try {
    fs.mkdirSync(EXPLORED_MATERIALS_DIR, { recursive: true });
    const file = jsonlPath(roomSlug);
    fs.appendFileSync(file, JSON.stringify(entry) + '\n');
    return { ok: true, path: file };
  } catch (err) {
    const msg = (err && err.message) ? String(err.message) : 'append_failed';
    return { ok: false, reason: msg.slice(0, 80) };
  }
}

/**
 * Read all materials for a room, applying LWW replay (last entry per
 * material_id wins). Returns [] when the file is missing. Tolerates corrupt
 * lines by skipping them silently.
 *
 * @param {string} roomSlug
 * @returns {Array<object>}
 */
function readMaterials(roomSlug) {
  const file = jsonlPath(roomSlug);
  if (!fs.existsSync(file)) return [];
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (_e) {
    return [];
  }
  const lines = raw.split('\n').filter(Boolean);
  const byId = new Map();
  for (const line of lines) {
    let entry;
    try {
      entry = JSON.parse(line);
    } catch (_e) {
      continue; // corrupt line tolerated per RESEARCH Section 4.5 LWW replay tolerance
    }
    if (!isPlainObject(entry) || !isHex32(entry.material_id)) continue;
    byId.set(entry.material_id, entry);
  }
  return Array.from(byId.values());
}

/**
 * Find the latest entry for a single material_id. Returns null when missing.
 * Sorts by fired_at descending so the most-recent entry wins regardless of
 * append order.
 *
 * @param {string} roomSlug
 * @param {string} materialId   32-char hex
 * @returns {object|null}
 */
function findLatest(roomSlug, materialId) {
  if (!isHex32(materialId)) return null;
  const file = jsonlPath(roomSlug);
  if (!fs.existsSync(file)) return null;
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (_e) {
    return null;
  }
  const lines = raw.split('\n').filter(Boolean);
  let latest = null;
  for (const line of lines) {
    let entry;
    try {
      entry = JSON.parse(line);
    } catch (_e) {
      continue;
    }
    if (!isPlainObject(entry)) continue;
    if (entry.material_id !== materialId) continue;
    if (latest === null) {
      latest = entry;
      continue;
    }
    const a = Number.isInteger(entry.fired_at) ? entry.fired_at : 0;
    const b = Number.isInteger(latest.fired_at) ? latest.fired_at : 0;
    if (a >= b) latest = entry;
  }
  return latest;
}

/**
 * Mark a material as completed. Appends a transition entry where state is
 * 'completed' and finding_count is set from fields.
 *
 * @param {string} roomSlug
 * @param {string} materialId
 * @param {object} fields  { finding_count: number }
 * @returns {{ok: true} | {ok: false, reason: string}}
 */
function markCompleted(roomSlug, materialId, fields) {
  const prev = findLatest(roomSlug, materialId);
  if (!prev) return { ok: false, reason: 'material_not_found' };
  const fc = (fields && Number.isInteger(fields.finding_count)) ? fields.finding_count : null;
  const next = Object.assign({}, prev, {
    state: 'completed',
    finding_count: fc,
    in_flight_since: null,
  });
  const r = appendMaterial(roomSlug, next);
  if (!r.ok) return r;
  return { ok: true };
}

/**
 * Mark a material as failed with a suppression reason. If the material is
 * not yet in the ledger, append a fresh 'failed' entry (suppression on the
 * very first detection event).
 *
 * @param {string} roomSlug
 * @param {string} materialId
 * @param {string} suppressReason  one of VALID_SUPPRESS_REASONS
 * @returns {{ok: true} | {ok: false, reason: string}}
 */
function markFailed(roomSlug, materialId, suppressReason) {
  if (!VALID_SUPPRESS_REASONS.has(suppressReason)) {
    return { ok: false, reason: 'invalid_suppress_reason' };
  }
  if (!isHex32(materialId)) {
    return { ok: false, reason: 'invalid_material_id' };
  }
  const prev = findLatest(roomSlug, materialId);
  let next;
  if (prev) {
    next = Object.assign({}, prev, {
      state: 'failed',
      suppress_reason: suppressReason,
      in_flight_since: null,
    });
  } else {
    // Suppression on first event -- caller has not yet appended a queued entry.
    next = {
      material_id: materialId,
      file_path_sha256: null,
      relative_file_path: null,
      mtime_seconds: 0,
      fired_at: Date.now(),
      state: 'failed',
      finding_count: null,
      surfaced: false,
      user_response: null,
      responded_at: null,
      suppress_reason: suppressReason,
      in_flight_since: null,
    };
  }
  const r = appendMaterial(roomSlug, next);
  if (!r.ok) return r;
  return { ok: true };
}

/**
 * Sweep stale in_flight entries. Per RESEARCH scenario 7 (5min stale
 * recovery): an entry with state==='in_flight' AND
 * (now - in_flight_since) > staleMs is transitioned to 'failed' with
 * suppress_reason='rate_limited' (benign reason; the spawn child likely
 * crashed or timed out, and the next detection of the same material_id
 * will be free to fire fresh).
 *
 * Idempotent: re-running on the same JSONL is a no-op when no entries are
 * stale (terminal states 'completed' and 'failed' are excluded from the scan).
 *
 * Sync. Never throws. On any error returns { ok: true, swept: 0 } so the
 * SessionStart hook can never be derailed by a sweep failure.
 *
 * @param {string} roomSlug
 * @param {object} opts  { staleMs: number }
 * @returns {{ok: true, swept: number}}
 */
function sweepStaleInFlight(roomSlug, opts) {
  try {
    const staleMs = (opts && Number.isInteger(opts.staleMs) && opts.staleMs > 0)
      ? opts.staleMs
      : STALE_IN_FLIGHT_MS_DEFAULT;
    const now = Date.now();
    const entries = readMaterials(roomSlug);
    let swept = 0;
    for (const e of entries) {
      if (!isPlainObject(e)) continue;
      if (e.state !== 'in_flight') continue;
      if (!Number.isInteger(e.in_flight_since)) continue;
      if ((now - e.in_flight_since) <= staleMs) continue;
      const r = markFailed(roomSlug, e.material_id, 'rate_limited');
      if (r && r.ok) swept += 1;
    }
    return { ok: true, swept: swept };
  } catch (_e) {
    return { ok: true, swept: 0 };
  }
}

// ---------- Module exports ----------

module.exports = {
  computeMaterialId,
  jsonlPath,
  validateEntryShape,
  appendMaterial,
  readMaterials,
  findLatest,
  markCompleted,
  markFailed,
  sweepStaleInFlight,
  EXPLORED_MATERIALS_DIR,
  MATERIAL_ID_LEN,
  VALID_STATES,
  VALID_RESPONSES,
  VALID_SUPPRESS_REASONS,
  USER_CONTENT_KEY_DENYLIST,
};
