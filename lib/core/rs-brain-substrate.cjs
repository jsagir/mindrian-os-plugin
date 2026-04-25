/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.1a Plan 01 + Plan 02 -- Brain methodology substrate loader core.
 *
 * Single chokepoint for pulling the Brain Pinecone methodology
 * substrate into a local cache. Wraps lib/core/brain-client.cjs
 * (Canon Part 7 Reuse Before Build; do NOT fork). Enforces Canon
 * Part 8 at three layers:
 *   (1) validateCtx allow-list from rs-brain-substrate-prompts.cjs
 *   (2) buildBrainSubstrateQuery extracts ONLY slug-safe scalars
 *   (3) preSendAudit JSON.stringify scan against FORBIDDEN_PATTERNS
 *       before any network call
 *
 * loadSubstrate NEVER throws. Every external boundary returns a
 * structured {success, substrate, mode, reason?, warning?} result.
 *
 * Plan 02 adds the cache persistence layer:
 *   readCache + atomicWriteSubstrateCache + isCacheFresh +
 *   getCacheAgeDays + sha256OfString + full 6-mode loadSubstrate
 *   matrix (A1/A2/A3/B1/B2/B3) against real .mindrian/brain-substrate-
 *   cache.json files on disk. Atomic write mirrors Phase 88-04-B
 *   openSync 'wx' + fsync + rename 7-step protocol.
 *
 * Pure CJS, zero npm deps, node built-ins only (fs, path, crypto).
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const brainClient = require('./brain-client.cjs');
const prompts = require('./rs-brain-substrate-prompts.cjs');
const {
  ALLOWED_CTX_KEYS,
  FORBIDDEN_PATTERNS,
  SLUG_REGEX,
  validateCtx,
  PROMPT_VERSION,
} = prompts;

// ---------- BrainBoundaryViolation custom error ----------

class BrainBoundaryViolation extends Error {
  constructor(message, meta) {
    super(message);
    this.name = 'BrainBoundaryViolation';
    this.meta = meta || {};
  }
}

// ---------- RESULT_MODES frozen enum ----------
//
// A1 = Brain reachable + cache fresh (serve cache, no network).
// A2 = Brain reachable + cache stale (re-pull, write cache, serve fresh).
// A3 = Brain reachable + cache missing (pull, write cache, serve fresh).
// B1 = Brain offline + cache fresh (serve cache with offline warning).
// B2 = Brain offline + cache stale (serve stale with warning + cache age).
// B3 = Brain offline + cache missing (tier-0 empty substrate, RS on user corpus only).

const RESULT_MODES = Object.freeze({
  A1: 'A1', A2: 'A2', A3: 'A3',
  B1: 'B1', B2: 'B2', B3: 'B3',
});
const RESULT_MODE_SET = Object.freeze(new Set(Object.values(RESULT_MODES)));

// ---------- Cache schema + TTL constants (Plan 02) ----------
//
// schema_version is locked at 1.0 per CONTEXT.md §Cache Design. Any
// future schema break must bump this string; the reader refuses to
// consume a cache whose schema_version is not '1.0'. The atomic-write
// tmpfile suffix 'substrate' distinguishes this producer's tmpfiles
// from any other .mindrian/*.tmp.* sibling (Phase 90-01 uses '.brain').

const CACHE_SCHEMA_VERSION = '1.0';
const DEFAULT_TTL_DAYS = 30;
const EXPECTED_EMBEDDING_DIM = 1024;
const TMP_SUFFIX = 'substrate';
// Tmpfile naming: brain-substrate-cache.json.tmp.<rand>.substrate.
// The 88-13 guardian can sweep orphans by walking .mindrian/ and matching
// this regex. The rand component is base36 slice + Date.now().toString(36)
// concatenation to guarantee uniqueness under concurrency.
const TMP_FILENAME_REGEX = /^brain-substrate-cache\.json\.tmp\.[a-z0-9]+\.substrate$/;

function getTtlDays() {
  const env = process.env.MINDRIAN_BRAIN_SUBSTRATE_TTL_DAYS;
  const n = env ? parseInt(env, 10) : DEFAULT_TTL_DAYS;
  // Bound-check: [1, 3650] days is a sensible range. Anything outside
  // falls back to the 30d default rather than crashing. Out-of-range
  // values are silently clamped because the env var is user-tunable
  // and a bad value should degrade gracefully, not break session-start.
  if (!Number.isFinite(n) || n < 1 || n > 3650) return DEFAULT_TTL_DAYS;
  return n;
}

function cachePath(roomDir) {
  return path.join(roomDir, '.mindrian', 'brain-substrate-cache.json');
}

function cacheExists(roomDir) {
  try { return fs.existsSync(cachePath(roomDir)); } catch (_e) { return false; }
}

function sha256OfString(s) {
  return 'sha256:' + crypto.createHash('sha256').update(String(s)).digest('hex');
}

// ---------- Audit log writer (append-only JSONL, Canon Part 8 tripwire #3) ----------
//
// Local-only. Generic handles only. JSON-Lines format so grep -c outcome:reject
// answers "how many adversarial queries blocked" at a glance (per CONTEXT.md).

function getAuditPath(roomDir) {
  return path.join(roomDir, '.mindrian', 'brain-substrate-audit.jsonl');
}

function appendAudit(roomDir, entry) {
  try {
    const auditDir = path.join(roomDir, '.mindrian');
    fs.mkdirSync(auditDir, { recursive: true });
    const line = JSON.stringify({
      timestamp: new Date().toISOString(),
      ...entry,
    }) + '\n';
    fs.appendFileSync(getAuditPath(roomDir), line);
  } catch (_e) {
    // Audit log failure must not crash loadSubstrate; log to stderr only.
    process.stderr.write(
      'rs-brain-substrate: audit append failed: ' +
      String(_e && _e.message) + '\n'
    );
  }
}

// ---------- preSendAudit (THE third tripwire; runs before every brainClient call) ----------
//
// JSON.stringify(payload) + FORBIDDEN_PATTERNS scan. Any match -> throw
// BrainBoundaryViolation BEFORE the payload leaves the process. This is the
// last line of defense if validateCtx and buildBrainSubstrateQuery both fail
// to catch a user-specific byte.

function preSendAudit(roomDir, payload, caller) {
  const s = JSON.stringify(payload);
  for (const re of FORBIDDEN_PATTERNS) {
    if (re.test(s)) {
      appendAudit(roomDir, {
        caller: caller || 'unknown',
        outcome: 'reject',
        reason: 'forbidden_regex',
        pattern: re.source,
      });
      throw new BrainBoundaryViolation(
        'forbidden regex match in outbound payload: ' + re.source,
        { caller, pattern: re.source }
      );
    }
  }
  appendAudit(roomDir, {
    caller: caller || 'unknown',
    outcome: 'pass',
    handles: Object.keys(payload || {}),
  });
}

// ---------- buildBrainSubstrateQuery (THE Canon Part 8 chokepoint) ----------
//
// Every outbound Brain methodology query MUST pass through this function.
// validateCtx is called as the FIRST statement so no non-allow-list key
// can produce a searchParams descriptor.

function buildBrainSubstrateQuery(ctx) {
  validateCtx(ctx || {});
  const handles = Object.keys(ctx || {}).sort();
  // Return a descriptor that pullFromBrain consumes. We do NOT build a
  // Cypher string here; brain-client.search takes (queryText, {namespace, topK}).
  // We return the SEARCH param shape derived from allow-list scalars only.
  const searchParams = {
    namespace: ctx.namespace || 'tools',
    topK: ctx.limit || 100,
  };
  const audit_meta = {
    handles,
    prompt_version: PROMPT_VERSION,
    built_at: new Date().toISOString(),
  };
  return { searchParams, audit_meta };
}

// ---------- categorizeError (mirror Phase 90-01 shape) ----------

function categorizeError(err) {
  if (!err) return 'unknown';
  const msg = String(err.message || err);
  if (/timeout|ETIMEDOUT/i.test(msg)) return 'timeout';
  if (/rate.?limit|quota/i.test(msg)) return 'rate_limited';
  if (/401|auth|unauthorized/i.test(msg)) return 'auth_failed';
  if (/ECONNREFUSED|ENETUNREACH|network/i.test(msg)) return 'network_error';
  return 'unknown';
}

// ---------- adaptBrainSearchResponse (Phase 89.1 Plan 01; live MCP shape adapter) ----------
//
// brain-client.search returns one of TWO shapes depending on Pinecone path:
//   LIVE (post-89.1a smoke):  { result: { hits: [{_id, _score, fields}] }, usage }
//   LEGACY (mocked 89.1a-03): { matches: [{id, values, metadata}] }
//
// This adapter normalizes both into the {matches:[{id, score?, embedding?, metadata}]}
// shape pullFromBrain returns to loadSubstrate. The adapter NEVER throws; on any
// unexpected shape it returns null which pullFromBrain converts to malformed_response.
//
// Field renames (live -> normalized):
//   _id              -> id
//   _score           -> score
//   fields           -> metadata
//   fields.framework -> metadata.framework_name (per 89.1a smoke direct-probe finding)
//
// Score is preserved because the live brain_search MCP path (Pinecone searchRecords
// integrated inference) does NOT return embedding vectors. Downstream uses score
// directly until a separate raw-Pinecone fetch path is added (deferred to 89.2/89.5).
// Validator Check E is relaxed to "embedding-or-score required" in lockstep.

function adaptBrainSearchResponse(result) {
  if (!result || typeof result !== 'object') return null;
  // Legacy / mocked shape: already normalized.
  if (Array.isArray(result.matches)) {
    return { matches: result.matches };
  }
  // Live shape: { result: { hits: [...] } }
  if (result.result && typeof result.result === 'object' &&
      Array.isArray(result.result.hits)) {
    const matches = result.result.hits.map(function (hit) {
      const fields = (hit && hit.fields && typeof hit.fields === 'object') ? hit.fields : {};
      const metadata = {};
      // Rename framework -> framework_name; copy every other field as-is.
      for (const k of Object.keys(fields)) {
        if (k === 'framework') metadata.framework_name = fields[k];
        else metadata[k] = fields[k];
      }
      const out = {
        id: (hit && typeof hit._id === 'string') ? hit._id : '',
        metadata: metadata,
      };
      if (typeof hit._score === 'number' && Number.isFinite(hit._score)) {
        out.score = hit._score;
      }
      return out;
    });
    return { matches: matches };
  }
  return null;
}

// ---------- pullFromBrain (thin wrapper; preSendAudit before every network call) ----------
//
// Pitfall 1: detect pinecone_quota_exhausted AND _source === 'neo4j_fallback';
// do NOT treat Neo4j keyword-match fallback as substrate-quality embeddings.
//
// Phase 89.1 Plan 01: adaptBrainSearchResponse called immediately after
// await brainClient.search to translate the live MCP {result:{hits:[]}}
// shape into the legacy {matches:[]} shape. Adapter is fully localized
// here; brain-client.cjs surface unchanged (Canon Part 7 Reuse Before Build).

async function pullFromBrain(roomDir, ctx) {
  const built = buildBrainSubstrateQuery(ctx);
  const outboundPayload = { query: '*', ...built.searchParams };
  preSendAudit(roomDir, outboundPayload, 'pullFromBrain');
  try {
    const raw = await brainClient.search('*', built.searchParams);
    // Pitfall 1: Pinecone quota fallback must NOT be cached as substrate.
    if (raw && (raw.error === 'pinecone_quota_exhausted' || raw._source === 'neo4j_fallback')) {
      return { ok: false, reason: 'brain_quota_exhausted', err_category: 'rate_limited' };
    }
    let adapted;
    try {
      adapted = adaptBrainSearchResponse(raw);
    } catch (_adapterErr) {
      return { ok: false, reason: 'adapter_error', err_category: 'unknown' };
    }
    if (!adapted || !Array.isArray(adapted.matches)) {
      return { ok: false, reason: 'malformed_response', err_category: 'unknown' };
    }
    return { ok: true, matches: adapted.matches };
  } catch (err) {
    return { ok: false, reason: 'brain_error', err_category: categorizeError(err) };
  }
}

// ---------- Cache reader (Plan 02; never throws, always structured result) ----------
//
// readCache returns {ok, payload} on success, or {ok:false, reason, ...} on
// any failure. Reasons: 'missing', 'read_error', 'malformed_root',
// 'schema_version_mismatch', 'malformed_substrate_array', 'partial_cache'.
//
// Pitfall 5 completeness guard (partial_cache): if the payload declares
// embedding_count and the substrate array length disagrees, the cache is
// treated as invalid at the reader. The validator at lib/memory/validators/
// brain-substrate-invariants.cjs ALSO catches this case at session-start
// and pre-commit. Defense-in-depth: either layer alone blocks a partial
// cache from polluting downstream RS runs.

function readCache(roomDir) {
  const p = cachePath(roomDir);
  try {
    if (!fs.existsSync(p)) return { ok: false, reason: 'missing' };
    const raw = fs.readFileSync(p, 'utf8');
    const payload = JSON.parse(raw);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return { ok: false, reason: 'malformed_root' };
    }
    if (payload.schema_version !== CACHE_SCHEMA_VERSION) {
      return {
        ok: false,
        reason: 'schema_version_mismatch',
        got: payload.schema_version,
      };
    }
    if (!Array.isArray(payload.substrate)) {
      return { ok: false, reason: 'malformed_substrate_array' };
    }
    // Pitfall 5 completeness guard.
    if (typeof payload.embedding_count === 'number' &&
        payload.substrate.length !== payload.embedding_count) {
      return {
        ok: false,
        reason: 'partial_cache',
        declared: payload.embedding_count,
        actual: payload.substrate.length,
      };
    }
    return { ok: true, payload };
  } catch (err) {
    return {
      ok: false,
      reason: 'read_error',
      err_message: String(err && err.message),
    };
  }
}

// ---------- TTL math (Plan 02; Invariant I6) ----------
//
// getCacheAgeDays: (now - pulled_at) in days. Returns Infinity if
// pulled_at is missing or unparseable so a degenerate cache always
// sorts as stale. isCacheFresh: strictly less-than comparison against
// the payload-local ttl_days (falls back to env-driven default).

function getCacheAgeDays(payload) {
  if (!payload || !payload.pulled_at) return Infinity;
  const pulledMs = Date.parse(payload.pulled_at);
  if (!Number.isFinite(pulledMs)) return Infinity;
  return (Date.now() - pulledMs) / 86400000;
}

function isCacheFresh(payload) {
  const ttl = (payload && typeof payload.ttl_days === 'number')
    ? payload.ttl_days
    : getTtlDays();
  return getCacheAgeDays(payload) < ttl;
}

// ---------- Atomic write (Plan 02; Phase 88-04-B 7-step protocol) ----------
//
// Pattern mirrors lib/core/brain-derivation.cjs atomicWriteBrainMd
// byte-for-byte. Seven steps:
//   1. mkdirSync parent (recursive)
//   2. openSync(tmpPath, 'wx')  -- exclusive create, EEXIST on collision
//   3. writeFileSync(fd, body)
//   4. fsyncSync(fd)            -- durability: flush OS + disk buffers
//   5. closeSync(fd)
//   6. renameSync(tmpPath, finalPath)  -- atomic publish
//   7. return {success, path}
// On ANY failure: closeSync (if fd open) + unlinkSync (best-effort) +
// return structured {success:false, fs_error}. loadSubstrate wraps this
// so a cache write failure never throws to the caller; it emits a
// warning on the result object instead.

function atomicWriteSubstrateCache(roomDir, payload) {
  const finalPath = cachePath(roomDir);
  const rand = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const tmpPath = finalPath + '.tmp.' + rand + '.' + TMP_SUFFIX;
  let fd = null;
  try {
    fs.mkdirSync(path.dirname(finalPath), { recursive: true });
    fd = fs.openSync(tmpPath, 'wx');             // exclusive create
    fs.writeFileSync(fd, JSON.stringify(payload, null, 2));
    fs.fsyncSync(fd);                             // durability fence
    fs.closeSync(fd);
    fd = null;
    fs.renameSync(tmpPath, finalPath);            // atomic publish
    return { success: true, path: finalPath };
  } catch (err) {
    try { if (fd !== null) fs.closeSync(fd); } catch (_e) { /* ignore */ }
    try { fs.unlinkSync(tmpPath); } catch (_e) { /* ignore */ }
    return { success: false, fs_error: String(err && err.message) };
  }
}

// ---------- loadSubstrate (top-level entry; NEVER throws; full 6-mode matrix) ----------
//
// Plan 02 behavior: implements all six graceful-degradation modes
// against real cache files on disk per CONTEXT.md §Graceful Degradation
// Contract. The mode matrix below names each RESULT_MODES value so a
// future reader can grep for RESULT_MODES.<mode> and find both its
// return site AND its documented contract in one place.
//
//   RESULT_MODES.A1 : Brain reachable + cache fresh    -> cached substrate, no network
//   RESULT_MODES.A2 : Brain reachable + cache stale    -> re-pull, write cache, return fresh
//   RESULT_MODES.A3 : Brain reachable + cache missing  -> pull, write cache, return fresh
//   RESULT_MODES.B1 : Brain offline   + cache fresh    -> cached + offline warning
//   RESULT_MODES.B2 : Brain offline   + cache stale    -> cached + stale warning (stale_days)
//   RESULT_MODES.B3 : Brain offline   + cache missing  -> tier-0 empty substrate + warning
//
// Additional options:
//   opts.forceRefresh = true  -> skip Mode A1, always attempt pull when Brain up
//   opts.roomDir              -> override MINDRIAN_ROOM / process.cwd()
//   opts.limit                -> topK for pullFromBrain (default 100)

async function loadSubstrate(options) {
  const opts = options || {};
  const roomDir = opts.roomDir || process.env.MINDRIAN_ROOM || process.cwd();
  try {
    const cacheRead = readCache(roomDir);
    const cacheOk = cacheRead.ok;
    const fresh = cacheOk && isCacheFresh(cacheRead.payload);
    const ageDays = cacheOk ? getCacheAgeDays(cacheRead.payload) : null;
    const brainUp = brainClient.isAvailable();

    const forceRefresh = opts.forceRefresh === true;

    // Mode A1: Brain reachable + fresh cache + not forced -> serve cache,
    // no network. Also covers Mode B1 when Brain is offline but cache is
    // fresh (offline warning attached).
    if (!forceRefresh && cacheOk && fresh) {
      const mode = brainUp ? RESULT_MODES.A1 : RESULT_MODES.B1;
      return {
        success: true,
        substrate: cacheRead.payload.substrate,
        mode,
        cache_age_days: ageDays,
        warning: brainUp ? undefined : 'Brain offline; using cached methodology',
      };
    }

    // Paths that need a pull (A2, A3, or forced refresh). If Brain up,
    // attempt pull; on success, overwrite cache atomically and return.
    if (brainUp) {
      const pull = await pullFromBrain(roomDir, {
        namespace: 'tools',
        limit: opts.limit || 100,
      });
      if (pull.ok) {
        const substrate = pull.matches.slice();
        // Phase 89.1 Plan 01: cache _completeness reflects whether entries
        // carry 1024-dim embedding vectors (legacy/mocked path) or only
        // a Pinecone score (live brain_search path; no values returned by
        // searchRecords today). Backward-compatible: pre-89.1 caches without
        // this field are treated as 'full-vectors' by downstream readers.
        let completeness = 'partial';
        if (substrate.length === 0) {
          completeness = 'partial';
        } else {
          const hasAnyEmbedding = substrate.some(function (e) {
            return e && Array.isArray(e.embedding);
          });
          const hasAnyScore = substrate.some(function (e) {
            return e && typeof e.score === 'number';
          });
          const allEmbedding = substrate.every(function (e) {
            return e && Array.isArray(e.embedding);
          });
          const allScore = substrate.every(function (e) {
            return e && typeof e.score === 'number';
          });
          if (allEmbedding) completeness = 'full-vectors';
          else if (allScore && !hasAnyEmbedding) completeness = 'score-only';
          else if (hasAnyEmbedding || hasAnyScore) completeness = 'partial';
        }
        const newPayload = {
          schema_version: CACHE_SCHEMA_VERSION,
          pulled_at: new Date().toISOString(),
          ttl_days: getTtlDays(),
          source_index: 'pws-brain',
          source_namespaces: ['tools'],
          embedding_count: substrate.length,
          content_hash: sha256OfString(JSON.stringify(substrate)),
          _completeness: completeness,
          substrate,
        };
        const write = atomicWriteSubstrateCache(roomDir, newPayload);
        const mode = cacheOk ? RESULT_MODES.A2 : RESULT_MODES.A3;
        return {
          success: true,
          substrate,
          mode,
          cache_age_days: 0,
          warning: write.success
            ? undefined
            : 'Cache write failed: ' + write.fs_error,
        };
      }
      // Brain up but pull failed (including Pitfall 1 quota fallback)
      // -> fall through to cache-present (B1/B2) or B3.
    }

    // Mode B1/B2: Brain unreachable (or pull failed) with cache present.
    // Serve existing cache with appropriate warning. Fresh -> B1, stale -> B2.
    if (cacheOk) {
      const mode = fresh ? RESULT_MODES.B1 : RESULT_MODES.B2;
      const warning = fresh
        ? 'Brain offline; using cached methodology'
        : 'Brain offline; using stale methodology (cache age ' +
          Math.floor(ageDays) + ' days)';
      return {
        success: true,
        substrate: cacheRead.payload.substrate,
        mode,
        cache_age_days: ageDays,
        stale_days: fresh ? 0 : Math.floor(ageDays),
        warning,
      };
    }

    // Mode B3: tier-0 empty substrate, graceful degradation.
    return {
      success: true,
      substrate: [],
      mode: RESULT_MODES.B3,
      warning: 'Brain offline and no cache; RS will run on user corpus only',
    };
  } catch (err) {
    // Catch-all: loadSubstrate NEVER throws.
    return {
      success: true,
      substrate: [],
      mode: RESULT_MODES.B3,
      warning: 'loadSubstrate caught: ' + String(err && err.message),
      reason: categorizeError(err),
    };
  }
}

// ---------- Exports ----------

module.exports = {
  loadSubstrate,
  buildBrainSubstrateQuery,
  preSendAudit,
  categorizeError,
  BrainBoundaryViolation,
  RESULT_MODES,
  _test: {
    pullFromBrain,
    adaptBrainSearchResponse,
    appendAudit,
    getAuditPath,
    RESULT_MODE_SET,
    // Plan 02 cache I/O surface (test-only; production callers use loadSubstrate).
    readCache,
    atomicWriteSubstrateCache,
    isCacheFresh,
    getCacheAgeDays,
    cachePath,
    cacheExists,
    sha256OfString,
    getTtlDays,
    CACHE_SCHEMA_VERSION,
    DEFAULT_TTL_DAYS,
    EXPECTED_EMBEDDING_DIM,
    TMP_FILENAME_REGEX,
  },
};
