'use strict';
/**
 * research-cache.cjs -- the ONE shared TTL + source-keyed on-disk fetch cache
 * (Phase 130.5 Plan 02).
 *
 * Purpose (build-once): a paper fetched by /mos:research must NOT be re-fetched
 * by rs-discovery-engine. Both surfaces resolve the SAME on-disk path for the
 * same logical (source, query), so the duplicate-API-quota drift the 2026-05-15
 * audit flagged (same paper, two code paths, no shared cache) is closed at the
 * substrate. This is the single local cache path Plan 03 and Phase 131 consume.
 *
 * SCOPE: LOCAL on-disk fetch-result cache ONLY. This module embeds nothing and
 * queries no vector store. It ports the TTL + source-keying semantics of the
 * legacy rs_cache (TTL_DAYS = 30; is_fresh; namespace_slug) to native fs; the
 * semantic-dedup half stays a Brain-side concern via the Phase 110 packet and
 * is OUT OF SCOPE here (no vector-store client lives in this module).
 *
 * Canon Part 8 (LOCAL stays local): the cache stores ONLY SIGNAL data -- the
 * public paper metadata fetchCorpus returns (ids, titles, public abstracts,
 * DOIs). It NEVER stores user/room content, and it NEVER egresses to the Brain.
 * The (source, query) key shape carries no room/user bytes -- a query string is
 * a generic search handle, normalized into a filesystem-safe slug. Nothing in
 * this module writes to or reads from the Brain MCP.
 *
 * Stack: native Node only -- node:fs + node:path + node:crypto. Zero new npm
 * deps, zero Python, zero subprocess. CJS, no build step. No em-dashes.
 *
 * Atomic write: each entry is written to a unique temp file in the SAME
 * directory and then renamed onto the final path via fs.renameSync(2) (a POSIX
 * atomic rename on the same filesystem). Reuses the idiom proven in
 * lib/core/mva-state.cjs and lib/hmi/jtbd-state.cjs. A concurrent reader sees
 * either the old entry or the complete new one, never a partial (T-130.5-02-01).
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// 30-day TTL, mirroring rs_cache.py TTL_DAYS = 30.
const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// Shared cache directory under the room. ONE directory for both surfaces.
const CACHE_SUBDIR = path.join('.mindrian', 'research-cache');

/**
 * slugify(text) -- port of rs_corpus.py topic_slug: lowercase, collapse every
 * non-[a-z0-9] run to a single hyphen, strip leading/trailing hyphens. The
 * result is [a-z0-9-] only, so no path separator or parent-dir traversal can
 * survive (T-130.5-02-03 path-traversal mitigation).
 */
function slugify(text) {
  const s = String(text == null ? '' : text).toLowerCase();
  return s.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * cacheKey(source, query) -- the stable, source-namespaced, filesystem-safe
 * key. Two callers with the same logical (source, query) MUST get the identical
 * key; that identity is what makes the cache shared across /mos:research and
 * rs-discovery-engine. A short content hash of the normalized query is appended
 * so that two distinct queries which happen to slugify to the same stem (or an
 * over-length query) still resolve to distinct, bounded-length keys.
 */
function cacheKey(source, query) {
  const sourceSlug = slugify(source) || 'unknown';
  const querySlug = slugify(query);
  const norm = sourceSlug + ' ' + querySlug;
  const hash = crypto.createHash('sha256').update(norm).digest('hex').slice(0, 12);
  // Bound the query stem so a very long query cannot blow past filename limits.
  const stem = querySlug.slice(0, 80) || 'empty';
  return sourceSlug + '__' + stem + '__' + hash;
}

/**
 * cachePath(roomDir, source, query) -- resolves to
 * <roomDir>/.mindrian/research-cache/<cacheKey>.json and ensures the directory
 * exists. ONE shared directory; both surfaces point here.
 */
function cachePath(roomDir, source, query) {
  const dir = path.join(roomDir, CACHE_SUBDIR);
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, cacheKey(source, query) + '.json');
}

function resolveNow(opts) {
  const now = opts && opts.now;
  return typeof now === 'number' ? now : Date.now();
}

function resolveTtlMs(opts) {
  const ttl = opts && opts.ttlMs;
  return typeof ttl === 'number' && ttl >= 0 ? ttl : DEFAULT_TTL_MS;
}

/**
 * isFresh(fetchedAtIso, opts) -- TTL predicate. True iff the entry's age is
 * known and <= ttlMs. Ports rs_cache.is_fresh semantics (age <= ttl). An
 * unparseable / absent timestamp is NOT fresh (fail toward a re-fetch).
 */
function isFresh(fetchedAtIso, opts) {
  const fetchedAt = Date.parse(String(fetchedAtIso || ''));
  if (Number.isNaN(fetchedAt)) return false;
  const ageMs = resolveNow(opts) - fetchedAt;
  if (ageMs < 0) return true; // clock skew: a future stamp is treated as fresh
  return ageMs <= resolveTtlMs(opts);
}

/**
 * sanitizeMeta(meta) -- Phase 363 (D-16): the envelope meta a run needs to
 * answer a count question from cache ({count, cost_usd, remaining_usd,
 * limit_usd, x_query}). Only scalar values (finite number, string, boolean,
 * null) of a plain object survive; nested objects and arrays are dropped so a
 * cache entry can never smuggle structured room content. Returns null when
 * there is nothing to keep.
 */
function sanitizeMeta(meta) {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null;
  const out = {};
  for (const k of Object.keys(meta)) {
    const v = meta[k];
    if (v === null || typeof v === 'string' || typeof v === 'boolean'
      || (typeof v === 'number' && Number.isFinite(v))) {
      out[k] = v;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * putCached(roomDir, source, query, results, opts) -- write an entry
 *   { source, query_key, fetched_at: <ISO now>, results[, meta] }
 * ATOMICALLY (temp file in the same dir -> fs.renameSync onto the final path),
 * and return the final path. opts.now (number, ms) seams the timestamp for
 * deterministic tests. opts.meta (Phase 363, additive) is a plain object of
 * scalars stored beside results; omitted -> no meta key, the pre-363 layout.
 */
function putCached(roomDir, source, query, results, opts) {
  const finalPath = cachePath(roomDir, source, query);
  const entry = {
    source: slugify(source) || 'unknown',
    query_key: cacheKey(source, query),
    fetched_at: new Date(resolveNow(opts)).toISOString(),
    results: results == null ? [] : results,
  };
  const meta = sanitizeMeta(opts && opts.meta);
  if (meta) entry.meta = meta;
  const body = JSON.stringify(entry);
  // Same-dir tmp -> POSIX-atomic rename(2). pid + random suffix = collision-free.
  const suffix = process.pid + '.' + crypto.randomBytes(6).toString('hex');
  const tmpPath = finalPath + '.tmp.' + suffix;
  fs.writeFileSync(tmpPath, body, 'utf8');
  try {
    fs.renameSync(tmpPath, finalPath);
  } catch (err) {
    // Best-effort cleanup so a failed rename never leaves a partial sibling.
    try { fs.unlinkSync(tmpPath); } catch (_) { /* ignore */ }
    throw err;
  }
  return finalPath;
}

/**
 * getCachedEntry(roomDir, source, query, opts) -- read the entry with its meta.
 *   - absent / corrupt / past-TTL -> null (miss; never throws)
 *   - fresh                       -> { results, meta, fetched_at }
 * meta is the stored scalar object, or null for an entry written before Phase
 * 363 (or without opts.meta). A null meta is never a count: a caller treats it
 * as unresolved (T-363-03). opts.ttlMs / opts.now as for getCached.
 */
function getCachedEntry(roomDir, source, query, opts) {
  const finalPath = path.join(roomDir, CACHE_SUBDIR, cacheKey(source, query) + '.json');
  let raw;
  try {
    raw = fs.readFileSync(finalPath, 'utf8');
  } catch (_) {
    return null; // ENOENT or unreadable -> miss
  }
  let entry;
  try {
    entry = JSON.parse(raw);
  } catch (_) {
    return null; // corrupt entry -> miss (tolerate, never throw)
  }
  if (!entry || typeof entry !== 'object') return null;
  if (!isFresh(entry.fetched_at, opts)) return null; // past-TTL -> miss
  return {
    results: entry.results == null ? [] : entry.results,
    meta: sanitizeMeta(entry.meta),
    fetched_at: entry.fetched_at,
  };
}

/**
 * getCached(roomDir, source, query, opts) -- read the entry.
 *   - absent file               -> null (miss)
 *   - corrupt / unparseable JSON -> null (never throw)
 *   - past-TTL (age > ttlMs)     -> null (miss; caller re-fetches)
 *   - fresh                      -> the stored results array
 * opts.ttlMs overrides the 30-day default; opts.now seams the clock. The
 * return shape is UNCHANGED (a plain array) for every pre-363 caller; use
 * getCachedEntry to read the stored meta alongside the results.
 */
function getCached(roomDir, source, query, opts) {
  const entry = getCachedEntry(roomDir, source, query, opts);
  return entry ? entry.results : null;
}

module.exports = { cacheKey, cachePath, getCached, getCachedEntry, putCached, isFresh };
