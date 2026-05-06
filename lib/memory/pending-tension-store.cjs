/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 116-01 Wave 1 -- pending-tension-store substrate.
 *
 * JSONL append-only state store at ~/.mindrian/pending-tensions/<roomSlug>.jsonl.
 * Per CONTEXT.md D-07, D-07a, D-07b: JSONL is the decay state machine ground
 * truth; workspace-guard-clean (OUTSIDE plugin repo via os.homedir()); no user
 * content fields per Canon Part 8.
 *
 * Graph-native HARD RULE (memory feedback_reverse_salient_agent_graph_native):
 *   1. Reads route through lib/core/navigation.cjs only -- the Phase 109 D-06
 *      chokepoint is preserved (no direct DB module imports here).
 *   2. Brain MCP is OUT of this module's surface area -- Canon Part 8 boundary
 *      is preserved (zero outbound network surface, zero remote-graph imports).
 *   3. Telemetry side-channels via stdout / stderr are OUT of this module per
 *      RESEARCH Section 13.9 -- the SessionStart hook owns the stdout envelope.
 *
 * Pattern: append-only writer + LWW replay (RESEARCH Section 6.4).
 *   - Each tension is represented by its LATEST entry in the JSONL.
 *   - State changes are recorded as NEW entries with the same tension_id.
 *   - Reader plays the JSONL forward and keeps only the most-recent entry
 *     per tension_id (last-write-wins on replay).
 *
 * Concurrency: appendFileSync is POSIX-atomic for lines smaller than PIPE_BUF
 * (typically 4096 bytes; tension entries are well under per RESEARCH 6.5).
 *
 * Pure CJS, node built-ins only, zero new runtime dependencies.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

// ---------- Constants ----------

const PENDING_TENSIONS_DIR = path.join(os.homedir(), '.mindrian', 'pending-tensions');
const VALID_STATES = Object.freeze(new Set(['queued', 'surfaced', 'resolved', 'dropped']));
const VALID_TYPES = Object.freeze(new Set([
  'contradiction',
  'convergence',
  'stale_decision',
  'open_question',
]));
const VALID_RESPONSES = Object.freeze(new Set(['RESOLVE', 'LATER', 'SKIP', 'DROPPED']));
const TENSION_ID_LEN = 32;

// User-content key denylist (Canon Part 8 -- artifact bodies live in the graph,
// never in this JSONL). Rejection is fail-fast at appendTension time so a
// caller bug never leaks user content to disk in the canonical state file.
const USER_CONTENT_KEY_DENYLIST = Object.freeze([
  'body_text',
  'source_title',
  'target_title',
  'quoted_text',
  'artifact_body',
]);

// ---------- Tension id (deterministic, idempotent) ----------

/**
 * Compute the deterministic tension id for a (source, target, type) tuple.
 * Order-sensitive per RESEARCH Section 4.3 -- swapping source and target
 * yields a distinct id (so a contradiction edge and its reverse are
 * tracked separately if both ever land in the graph).
 *
 * @param {string} sourceNodeId
 * @param {string} targetNodeId
 * @param {string} tensionType  one of VALID_TYPES
 * @returns {string} 32-char hex sha256 prefix
 */
function computeTensionId(sourceNodeId, targetNodeId, tensionType) {
  const basis = String(sourceNodeId) + '|' + String(targetNodeId) + '|' + String(tensionType);
  return crypto.createHash('sha256').update(basis).digest('hex').slice(0, TENSION_ID_LEN);
}

// ---------- JSONL path resolution (workspace-guard-clean) ----------

/**
 * Resolve the JSONL path for a given room slug. Always returns a path under
 * os.homedir() per D-07b (OUTSIDE the plugin repo).
 *
 * @param {string} roomSlug
 * @returns {string} absolute path
 */
function jsonlPath(roomSlug) {
  const safeSlug = encodeURIComponent(String(roomSlug || 'default-room'));
  return path.join(PENDING_TENSIONS_DIR, safeSlug + '.jsonl');
}

// ---------- Internal helpers ----------

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isHex32(v) {
  return typeof v === 'string' && /^[0-9a-f]{32}$/.test(v);
}

function violatesUserContentBoundary(entry) {
  for (const k of USER_CONTENT_KEY_DENYLIST) {
    if (Object.prototype.hasOwnProperty.call(entry, k)) return k;
  }
  // context_signature is allowed but its sub-fields must also be enum-only.
  if (isPlainObject(entry.context_signature)) {
    for (const k of USER_CONTENT_KEY_DENYLIST) {
      if (Object.prototype.hasOwnProperty.call(entry.context_signature, k)) return 'context_signature.' + k;
    }
  }
  return null;
}

function validateEntryShape(entry) {
  if (!isPlainObject(entry)) return 'entry_not_object';
  if (!isHex32(entry.tension_id)) return 'invalid_tension_id';
  if (!VALID_TYPES.has(entry.type)) return 'invalid_type';
  if (!VALID_STATES.has(entry.state)) return 'invalid_state';
  if (!Number.isInteger(entry.surfacing_count) || entry.surfacing_count < 0) {
    return 'invalid_surfacing_count';
  }
  return null;
}

// ---------- Public API ----------

/**
 * Append a tension entry to the room's JSONL file. Creates the directory if
 * missing. Validates shape + Canon Part 8 boundary; rejects user-content
 * fields.
 *
 * @param {string} roomSlug
 * @param {object} entry  conforming to D-07 schema
 * @returns {{ok:true, path:string} | {ok:false, reason:string}}
 */
function appendTension(roomSlug, entry) {
  if (!isPlainObject(entry)) {
    return { ok: false, reason: 'entry_not_object' };
  }
  const violator = violatesUserContentBoundary(entry);
  if (violator) {
    return { ok: false, reason: 'canon_part_8_violation:' + violator };
  }
  const shapeErr = validateEntryShape(entry);
  if (shapeErr) {
    return { ok: false, reason: shapeErr };
  }
  try {
    fs.mkdirSync(PENDING_TENSIONS_DIR, { recursive: true });
    const file = jsonlPath(roomSlug);
    fs.appendFileSync(file, JSON.stringify(entry) + '\n');
    return { ok: true, path: file };
  } catch (err) {
    const msg = (err && err.message) ? String(err.message) : 'append_failed';
    return { ok: false, reason: msg.slice(0, 80) };
  }
}

/**
 * Read all tensions for a room, applying LWW replay (last entry per
 * tension_id wins). Returns [] when the file is missing. Tolerates corrupt
 * lines by skipping them silently.
 *
 * @param {string} roomSlug
 * @returns {Array<object>}
 */
function readTensions(roomSlug) {
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
      continue; // corrupt line tolerated
    }
    if (!isPlainObject(entry) || !isHex32(entry.tension_id)) continue;
    byId.set(entry.tension_id, entry);
  }
  return Array.from(byId.values());
}

/**
 * Find the latest entry for a single tension_id. Returns null when missing.
 * Internal helper for the state-transition functions.
 */
function findLatest(roomSlug, tension_id) {
  if (!isHex32(tension_id)) return null;
  const all = readTensions(roomSlug);
  for (const e of all) {
    if (e.tension_id === tension_id) return e;
  }
  return null;
}

/**
 * Mark a tension as surfaced -- increments surfacing_count and sets
 * last_surfaced_at to now. State transitions to 'surfaced'.
 */
function markSurfaced(roomSlug, tension_id) {
  const prev = findLatest(roomSlug, tension_id);
  if (!prev) return { ok: false, reason: 'tension_not_found' };
  const next = Object.assign({}, prev, {
    state: 'surfaced',
    surfacing_count: (Number.isInteger(prev.surfacing_count) ? prev.surfacing_count : 0) + 1,
    last_surfaced_at: Date.now(),
  });
  const r = appendTension(roomSlug, next);
  if (!r.ok) return r;
  return { ok: true, surfacing_count: next.surfacing_count };
}

/**
 * Mark a tension as resolved with a user response. State -> 'resolved'.
 *
 * @param {string} roomSlug
 * @param {string} tension_id
 * @param {string} response  one of VALID_RESPONSES (RESOLVE / LATER / SKIP / DROPPED)
 */
function markResolved(roomSlug, tension_id, response) {
  if (!VALID_RESPONSES.has(response)) {
    return { ok: false, reason: 'invalid_response' };
  }
  const prev = findLatest(roomSlug, tension_id);
  if (!prev) return { ok: false, reason: 'tension_not_found' };
  const next = Object.assign({}, prev, {
    state: 'resolved',
    last_response: response,
  });
  const r = appendTension(roomSlug, next);
  if (!r.ok) return r;
  return { ok: true };
}

/**
 * Mark a tension as dropped (3-strikes decay or explicit drop). Terminal.
 */
function markDropped(roomSlug, tension_id) {
  const prev = findLatest(roomSlug, tension_id);
  if (!prev) return { ok: false, reason: 'tension_not_found' };
  const next = Object.assign({}, prev, {
    state: 'dropped',
    last_response: 'DROPPED',
  });
  const r = appendTension(roomSlug, next);
  if (!r.ok) return r;
  return { ok: true };
}

/**
 * Re-queue a tension after the user picked LATER. State -> 'queued'.
 * Per RESEARCH Section 11.2: surfacing_count is NOT decremented (LATER does
 * not reset the 3-strikes budget).
 */
function requeue(roomSlug, tension_id) {
  const prev = findLatest(roomSlug, tension_id);
  if (!prev) return { ok: false, reason: 'tension_not_found' };
  const next = Object.assign({}, prev, {
    state: 'queued',
  });
  const r = appendTension(roomSlug, next);
  if (!r.ok) return r;
  return { ok: true };
}

// ---------- Module exports ----------

module.exports = {
  computeTensionId,
  jsonlPath,
  appendTension,
  readTensions,
  markSurfaced,
  markResolved,
  markDropped,
  requeue,
  PENDING_TENSIONS_DIR,
  VALID_STATES,
  VALID_TYPES,
  VALID_RESPONSES,
};
