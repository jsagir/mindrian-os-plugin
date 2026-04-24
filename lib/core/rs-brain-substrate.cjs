/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.1a Plan 01 -- Brain methodology substrate loader core.
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
 * Cache I/O is stubbed in Plan 01. Plan 02 lands readCache +
 * atomicWriteSubstrateCache + TTL math. Plan 01 returns Mode B3
 * (tier-0 empty substrate) whenever cache I/O would be required.
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

// ---------- pullFromBrain (thin wrapper; preSendAudit before every network call) ----------
//
// Pitfall 1: detect pinecone_quota_exhausted AND _source === 'neo4j_fallback';
// do NOT treat Neo4j keyword-match fallback as substrate-quality embeddings.

async function pullFromBrain(roomDir, ctx) {
  const built = buildBrainSubstrateQuery(ctx);
  const outboundPayload = { query: '*', ...built.searchParams };
  preSendAudit(roomDir, outboundPayload, 'pullFromBrain');
  try {
    const result = await brainClient.search('*', built.searchParams);
    // Pitfall 1: Pinecone quota fallback must NOT be cached as substrate.
    if (result && (result.error === 'pinecone_quota_exhausted' || result._source === 'neo4j_fallback')) {
      return { ok: false, reason: 'brain_quota_exhausted', err_category: 'rate_limited' };
    }
    if (!result || !Array.isArray(result.matches)) {
      return { ok: false, reason: 'malformed_response', err_category: 'unknown' };
    }
    return { ok: true, matches: result.matches };
  } catch (err) {
    return { ok: false, reason: 'brain_error', err_category: categorizeError(err) };
  }
}

// ---------- loadSubstrate (top-level entry; NEVER throws) ----------
//
// Plan 01 behavior: if Brain reachable, attempt fresh pull into memory only.
// Plan 02 TODO: cache read path (Mode A1), TTL math + Mode A2 re-pull on
// stale, Mode B1/B2 on Brain offline with cache present.

async function loadSubstrate(options) {
  const opts = options || {};
  // roomDir resolution: prefer options.roomDir, fall back to MINDRIAN_ROOM env.
  const roomDir = opts.roomDir || process.env.MINDRIAN_ROOM || process.cwd();
  try {
    // Plan 02 TODO: cache read path (Mode A1).
    // Plan 02 TODO: TTL math + Mode A2 re-pull on stale.
    // Plan 02 TODO: Mode B1/B2 on Brain offline with cache present.
    if (brainClient.isAvailable()) {
      const res = await pullFromBrain(roomDir, {
        namespace: 'tools',
        limit: opts.limit || 100,
      });
      if (res.ok) {
        return {
          success: true,
          substrate: res.matches.slice(),
          mode: RESULT_MODES.A3,
          warning: 'Plan 01 stub: cache not yet persisted (Plan 02 will persist)',
        };
      }
      // Brain reachable but pull failed -> fall through to B3 graceful degradation.
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
    appendAudit,
    getAuditPath,
    RESULT_MODE_SET,
  },
};
