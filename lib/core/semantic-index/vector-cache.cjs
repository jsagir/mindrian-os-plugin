/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 379.1 (graph derive drain and scout runaway CPU) Plan 02 Task 1.
 *
 * The shared vector cache: one embedding per artifact per content hash,
 * keyed by (content_hash, model_id, dim). CPU379-01, D-379.1-06, D-379.1-09.
 *
 * Extracted from lib/core/rs-engine.cjs (_contentHash, _loadEmbeddingCache,
 * _saveEmbeddingCache; Phase 272) so the drain (Plan 04) and the scout
 * (Plan 05) share one loader and one saver. The on-disk payload keeps the
 * byte-shape rs-engine already writes to .rs-engine-cache.json:
 *   { version, updated_at, model, embeddings: { <id>: { hash, model, vector } } }
 * A row is { hash, model, vector } exactly as rs-engine writes it: no dim
 * field, no rounding (D-379.1-09: full precision, no quantization).
 *
 * Validation on load (D-379.1-06): a row is valid only when its model equals
 * the live model and its vector length equals the live dim and every element
 * is a finite number. A failing row is dropped and counted; the caller
 * re-embeds it. A version mismatch drops the whole file. Vectors from two
 * models never meet in one scoring pass.
 *
 * Recorded deviation from D-379.1-07 (checker, revision 1; accepted by the
 * main session 2026-10-21): D-379.1-07 says one SQLite transaction per batch
 * of vectors. This phase stores the vectors in a JSON file in the rs-engine
 * cache format, rewritten atomically (tmp plus rename) as one unit. Reason:
 * Canon Part 7 (reuse before build): the format, its loader and its saver
 * exist and are pinned by the 272 tests; a SQLite table would be a second
 * cache format next to it. Cost control: the caller saves once per
 * SAVE_EVERY_BATCHES encoder batches and at the deadline, at an encoder
 * failure and at the end, never per row and never per batch. A crash loses
 * at most SAVE_EVERY_BATCHES batches of embeds (seconds of work). SQLite is
 * not introduced this phase. The Python Eureka engine keeps its own vec0
 * tables (eureka_vec*) in room.db; this module never reads or writes them.
 *
 * Node built-ins only. Never throws across its boundary. No network.
 * No em-dashes (CLAUDE.md). Hyphens only.
 */

'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

// The save cadence attachVectors (Plan 04) follows: save after every 8th
// encoder batch, at the deadline, at an encoder failure and at the end.
// At batch 32 over about 2,163 artifacts that is about 9 rewrites of a file
// of up to about 16 MB instead of 68 (D-379.1-07 deviation, see the header).
const SAVE_EVERY_BATCHES = 8;

// The row shape rs-engine writes; the _test seam pins it.
const ROW_SCHEMA = ['hash', 'model', 'vector'];

/*
 * contentHash(text) -> string
 * sha256 hex over the exact text, first 16 characters. Verbatim from
 * rs-engine.cjs _contentHash so the two caches agree on the key.
 */
function contentHash(text) {
  const s = typeof text === 'string' ? text : String(text == null ? '' : text);
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 16);
}

function _finiteVector(vec, dim) {
  if (!Array.isArray(vec)) return false;
  if (Number.isInteger(dim) && dim > 0) {
    if (vec.length !== dim) return false;
  } else if (vec.length === 0) {
    return false;
  }
  for (let i = 0; i < vec.length; i += 1) {
    const v = vec[i];
    if (typeof v !== 'number' || !Number.isFinite(v)) return false;
  }
  return true;
}

/*
 * load(file, expect) -> { cache, dropped }
 * expect = { version, model, dim }. A missing file, a corrupt file or a
 * version mismatch gives { cache: {}, dropped: 0 }. A row whose model is not
 * expect.model, whose vector is not an array of expect.dim finite numbers,
 * or whose hash is not a string, is deleted from the returned map and
 * counted in dropped (D-379.1-06: a mismatch is a miss, never a mixed pass).
 * When expect.dim is not a positive integer the length is not pinned, only
 * non-empty and finite (the caller should always pass the live dim).
 */
function load(file, expect) {
  const want = expect && typeof expect === 'object' ? expect : {};
  const out = { cache: {}, dropped: 0 };
  let raw = null;
  try {
    if (typeof file !== 'string' || !fs.existsSync(file)) return out;
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_e) {
    return out;
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  if (raw.version !== want.version) return out;
  const embeddings = raw.embeddings;
  if (!embeddings || typeof embeddings !== 'object' || Array.isArray(embeddings)) return out;
  const cache = {};
  let dropped = 0;
  for (const id of Object.keys(embeddings)) {
    const row = embeddings[id];
    const ok = row
      && typeof row === 'object'
      && typeof row.hash === 'string'
      && row.model === want.model
      && _finiteVector(row.vector, want.dim);
    if (ok) {
      cache[id] = row;
    } else {
      dropped += 1;
    }
  }
  out.cache = cache;
  out.dropped = dropped;
  return out;
}

/*
 * save(file, cache, model, version) -> boolean
 * Writes { version, updated_at, model, embeddings: cache } through a tmp file
 * and one rename, so a concurrent reader sees the old file or the new file
 * and never a half-written one. Returns false on any error; never throws.
 * The tmp name carries the pid and a time stamp (the sweep's writeQueue
 * idiom) so two writers never share one tmp file; a failed write removes it.
 */
function save(file, cache, model, version) {
  if (typeof file !== 'string' || file.length === 0) return false;
  const payload = {
    version: version,
    updated_at: new Date().toISOString(),
    model: model,
    embeddings: cache && typeof cache === 'object' ? cache : {},
  };
  const tmp = file + '.tmp-' + process.pid + '-' + Date.now().toString(36);
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf8');
    fs.renameSync(tmp, file);
    return true;
  } catch (_e) {
    try { fs.unlinkSync(tmp); } catch (_e2) { /* nothing to remove */ }
    return false;
  }
}

/*
 * prune(cache, liveIds) -> number
 * Deletes the ids absent from liveIds (a Set or an array) and returns the
 * count removed. A non-object cache or a missing liveIds removes nothing.
 */
function prune(cache, liveIds) {
  if (!cache || typeof cache !== 'object') return 0;
  let live;
  if (liveIds instanceof Set) live = liveIds;
  else if (Array.isArray(liveIds)) live = new Set(liveIds);
  else return 0;
  let removed = 0;
  for (const id of Object.keys(cache)) {
    if (!live.has(id)) {
      delete cache[id];
      removed += 1;
    }
  }
  return removed;
}

/*
 * scopeHash(entries) -> string
 * sha256 over the sorted "id:hash" lines joined by "\n", first 16 hex.
 * entries may be an array of { id, hash }, an array of [id, hash] pairs, or
 * a map id -> { hash } (the cache itself) or id -> hash string. The order of
 * the input never changes the result.
 */
function scopeHash(entries) {
  const lines = [];
  if (Array.isArray(entries)) {
    for (const e of entries) {
      if (Array.isArray(e)) lines.push(String(e[0]) + ':' + String(e[1]));
      else if (e && typeof e === 'object') lines.push(String(e.id) + ':' + String(e.hash));
      else if (typeof e === 'string') lines.push(e);
    }
  } else if (entries && typeof entries === 'object') {
    for (const id of Object.keys(entries)) {
      const v = entries[id];
      if (typeof v === 'string') lines.push(id + ':' + v);
      else if (v && typeof v === 'object') lines.push(id + ':' + String(v.hash));
    }
  }
  lines.sort();
  return crypto.createHash('sha256').update(lines.join('\n'), 'utf8').digest('hex').slice(0, 16);
}

module.exports = {
  contentHash,
  load,
  save,
  prune,
  scopeHash,
  SAVE_EVERY_BATCHES,
  _test: { ROW_SCHEMA: ROW_SCHEMA },
};
