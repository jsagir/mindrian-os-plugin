/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.2 Plan 06 Task 1 -- Pinecone-direct bridge for 1024-dim
 * vector retrieval (CJS->Python shim).
 *
 * The bridge wraps the existing rs_cache.py::fetch_all_from_namespace
 * primitive (Phase 89-03, v1.10.16) without modifying it. This is a
 * Canon Part 7 (Reuse Before Build) consumer: zero new Python code,
 * zero new index, zero new field schema. The strict-1024-dim deferred
 * item from 89.1 (substrate carries _score not embedding on the live
 * Brain wire path) is resolved here by going Pinecone-direct against
 * the rs-external index used for external corpora.
 *
 * Architecture:
 *
 *   queryPineconeWithVectors(namespace, queryText, topK)
 *     -> spawnSync python3 -c bridgeScript
 *     -> bridgeScript reads JSON from stdin
 *     -> bridgeScript invokes rs_cache.fetch_all_from_namespace
 *     -> bridgeScript writes JSON {success, hits[]} to stdout
 *     -> CJS parses + returns
 *
 * Graceful degradation contract (Phase 89.2-01 / 02 / 03 / 04 pattern):
 *
 *   missing PINECONE_API_KEY -> {success: false, error: 'pinecone_api_key_missing'}
 *   python3 not on PATH      -> {success: false, error: 'python_unavailable'}
 *   non-zero exit            -> {success: false, error: 'python_exit_<N>'}
 *   stdout parse failure     -> {success: false, error: 'parse_error'}
 *   timeout                  -> {success: false, error: 'timeout'}
 *
 * NEVER throws. Every external boundary returns a structured envelope.
 *
 * Canon Part 8 (Graph Boundary): two defense-in-depth layers.
 *
 *   Layer 1 -- pre-egress: auditQueryString runs on the queryText
 *     parameter before spawnSync. Throws ExternalEgressViolation on
 *     FORBIDDEN_PATTERNS hit. Adversarial input never reaches Pinecone.
 *
 *   Layer 2 -- post-receive: auditQueryObject runs on the parsed hits[]
 *     payload before return. Throws ExternalEgressViolation if a hit's
 *     metadata smuggles a forbidden pattern through. The rs-external
 *     namespace is supposed to hold only public OpenAlex/arXiv metadata
 *     (Phase 89-03 Canon attestation), but we re-audit on the receive
 *     side because trust is not a security property -- enforcement is.
 *
 * Additionally exposes:
 *
 *   cosineSimilarity(a, b) -- pure JS dot(a,b)/(norm(a)*norm(b)).
 *     Both inputs MUST be Number arrays of identical length (typically
 *     1024 for Pinecone multilingual-e5-large). Returns 0 on degenerate
 *     zero-vectors. Differential scorer uses this on the two query
 *     vectors returned by twin queryPineconeWithVectors calls.
 *
 * Pure CJS, zero npm deps, node built-ins only beyond the three
 * rs-egress-* primitives shipped in Wave 1 (Plan 89.2-01).
 */
'use strict';

const path = require('node:path');
const childProcess = require('child_process');
const { auditQueryString, auditQueryObject } = require('./rs-egress-prompts.cjs');
// rs-egress-violations is required transitively by rs-egress-prompts; we do
// not throw ExternalEgressViolation directly from this module (the audit
// helpers do). The require below is a reachability witness for the Canon
// Part 8 audit chain at module-load time.
require('./rs-egress-violations.cjs');

// ---------- Constants ----------

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const PYTHON_BIN = process.env.MINDRIAN_PYTHON || 'python3';
const BRIDGE_TIMEOUT_MS = 30000;
const DEFAULT_LIMIT = 1000;

// ---------- Embedded Python bridge script ----------
//
// This script is spawned as `python3 -c <script>`. It MUST be valid Python.
// The leading `# BSL 1.1` line is a deliberate Canon discipline marker so
// the embedded Python source is licensed identically to the surrounding
// CJS file (W4 fix per Plan 89.2-06).
//
// Protocol:
//
//   stdin   : JSON {namespace: string, limit?: integer}
//   stdout  : JSON {success: boolean, hits?: array, error?: string}
//
// The script imports rs_cache from lib.core (REPO_ROOT must be on
// sys.path). On any exception, returns success:false with the exception
// message. Never raises to the parent process.

const bridgeScript = [
  '# BSL 1.1',
  '# Copyright (c) 2026 Mindrian. Phase 89.2 Plan 06 Task 1 -- pinecone bridge embedded Python.',
  '# This script wraps rs_cache.py::fetch_all_from_namespace to retrieve',
  '# 1024-dim Pinecone-direct vectors. JSON over stdio: parent writes a',
  '# request envelope to stdin; child writes a response envelope to stdout.',
  '# Errors are reported via the response envelope (success:false), never',
  '# raised to the parent process. The child exits 0 on graceful failure.',
  'import sys, os, json',
  '# Ensure REPO_ROOT is on sys.path so `from lib.core.rs_cache import ...` resolves.',
  'sys.path.insert(0, os.environ.get("MINDRIAN_REPO_ROOT", os.getcwd()))',
  'try:',
  '    from lib.core.rs_cache import fetch_all_from_namespace',
  '    payload = json.loads(sys.stdin.read())',
  '    ns = payload["namespace"]',
  '    limit = int(payload.get("limit", 1000))',
  '    records = fetch_all_from_namespace(ns, limit=limit)',
  '    # Map rs_cache.py output {id, values, metadata} to bridge hits[].',
  '    hits = []',
  '    for r in records:',
  '        hits.append({',
  '            "id": r.get("id", ""),',
  '            "score": float(r.get("score", 0.0)) if "score" in r else 0.0,',
  '            "values": list(r.get("values") or []),',
  '            "metadata": dict(r.get("metadata") or {}),',
  '        })',
  '    sys.stdout.write(json.dumps({"success": True, "hits": hits}))',
  'except Exception as e:',
  '    sys.stdout.write(json.dumps({"success": False, "error": str(e)}))',
  '',
].join('\n');

// ---------- queryPineconeWithVectors ----------
//
// Public entry point. Spawns python3 with the embedded bridgeScript,
// passes the namespace + limit via stdin, parses the JSON response,
// audits, and returns the structured envelope.
//
// Inputs:
//   namespace  string   the Pinecone namespace, typically 'external:<topic-slug>'
//   queryText  string   the original user query (audited pre-egress; not used by the
//                       bridge call itself since fetch_all_from_namespace pulls all
//                       cached vectors -- the BERT cosine is computed downstream).
//                       The query text is included in the audit triple so the
//                       caller's intent is checked at the gate.
//   topK       integer  result cap (default 1000; bounded by rs_cache.MAX_NAMESPACE_VECTORS)
//
// Returns Promise resolving to:
//   { success: true,  hits: [{id, score, values: number[], metadata}] }
//   { success: false, error: 'pinecone_api_key_missing'|'python_unavailable'
//                          |'python_exit_<N>'|'parse_error'|'timeout'
//                          |'invalid_namespace'|'invalid_top_k', stderr?: string }
//
// Throws (the only escape route -- Canon Part 8):
//   ExternalEgressViolation  if queryText matches FORBIDDEN_PATTERNS
//                            OR if returned hits[] metadata smuggles a forbidden
//                            pattern through.

async function queryPineconeWithVectors(namespace, queryText, topK) {
  // Argument validation (graceful, never throws on shape errors).
  if (typeof namespace !== 'string' || namespace.length === 0) {
    return { success: false, error: 'invalid_namespace' };
  }
  if (typeof queryText !== 'string') {
    return { success: false, error: 'invalid_query_text' };
  }
  const limit = (typeof topK === 'number' && topK > 0) ? Math.floor(topK) : DEFAULT_LIMIT;

  // Canon Part 8 Layer 1: pre-egress audit on user-controlled queryText.
  // auditQueryString throws ExternalEgressViolation on hit -- this is the
  // single intentional escape route from this module.
  auditQueryString(queryText, 'pinecone-bridge');
  // Audit the namespace too (defense-in-depth; namespaces are typically
  // 'external:<topic-slug>' so the topic-slug carries the user's domain).
  auditQueryString(namespace, 'pinecone-bridge');

  // Env-var gate. Pinecone SDK requires PINECONE_API_KEY; if absent the
  // child process raises a RuntimeError. Short-circuit here so the user
  // sees the canonical 'pinecone_api_key_missing' tag and not a stack trace.
  if (!process.env.PINECONE_API_KEY) {
    return { success: false, error: 'pinecone_api_key_missing' };
  }

  const requestEnvelope = JSON.stringify({ namespace: namespace, limit: limit });
  const childEnv = Object.assign({}, process.env, {
    MINDRIAN_REPO_ROOT: REPO_ROOT,
  });

  let res;
  try {
    res = childProcess.spawnSync(PYTHON_BIN, ['-c', bridgeScript], {
      input: requestEnvelope,
      encoding: 'utf8',
      timeout: BRIDGE_TIMEOUT_MS,
      env: childEnv,
      cwd: REPO_ROOT,
    });
  } catch (err) {
    // spawnSync itself does not normally throw; this is defense-in-depth.
    return { success: false, error: 'spawn_threw', detail: String(err && err.message) };
  }

  // Honor per-error-code graceful degradation.
  if (res && res.error) {
    if (res.error.code === 'ENOENT') {
      return { success: false, error: 'python_unavailable' };
    }
    if (res.error.code === 'ETIMEDOUT' || res.error.code === 'ERR_CHILD_PROCESS_TIMEOUT') {
      return { success: false, error: 'timeout' };
    }
    return { success: false, error: 'spawn_error', detail: String(res.error.message) };
  }

  if (res && res.signal === 'SIGTERM') {
    // Node delivers SIGTERM on timeout; covers the case when the child was
    // killed without the error object being populated.
    return { success: false, error: 'timeout' };
  }

  const stdout = (res && typeof res.stdout === 'string') ? res.stdout : '';
  const stderr = (res && typeof res.stderr === 'string') ? res.stderr : '';

  if (res && res.status !== 0) {
    return {
      success: false,
      error: 'python_exit_' + res.status,
      stderr: stderr.slice(0, 500),
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch (_e) {
    return {
      success: false,
      error: 'parse_error',
      stderr: stderr.slice(0, 500),
      stdout_sample: stdout.slice(0, 200),
    };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { success: false, error: 'parse_error', stdout_sample: stdout.slice(0, 200) };
  }

  // Bridge-internal failure: child returned {success:false, error:'...'} envelope.
  if (parsed.success !== true) {
    return {
      success: false,
      error: typeof parsed.error === 'string' ? parsed.error : 'bridge_error',
    };
  }

  // Canon Part 8 Layer 2: post-receive audit. The rs-external namespace is
  // supposed to hold only public metadata, but trust is not a security
  // property. Re-audit the hits[] payload before returning to the caller.
  // Throws ExternalEgressViolation on hit (intentional escape route).
  auditQueryObject(parsed, 'pinecone-bridge');

  return parsed;
}

// ---------- cosineSimilarity ----------
//
// Pure JS pair-wise cosine similarity on equal-length numeric arrays.
// Used by the differential scorer to compute BERT cosine between the two
// vectors returned by twin queryPineconeWithVectors calls (one per concept).
//
// Inputs:
//   a, b   number[] of equal length (typically 1024 for multilingual-e5-large)
//
// Returns:
//   number in [-1, 1]  -- Pinecone vectors are typically L2-normalized,
//                         so the result is usually in [0, 1].
//   0                  -- if either vector is degenerate (norm == 0) OR
//                         lengths differ. Caller treats 0 as no signal.
//
// Throws:
//   never. Returns 0 on shape errors so the caller's downstream logic
//   stays in graceful-degradation territory.

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return 0;
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i];
    const y = b[i];
    if (typeof x !== 'number' || typeof y !== 'number') return 0;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ---------- Exports ----------

module.exports = {
  queryPineconeWithVectors: queryPineconeWithVectors,
  cosineSimilarity: cosineSimilarity,
  _test: {
    PYTHON_BIN: PYTHON_BIN,
    BRIDGE_TIMEOUT_MS: BRIDGE_TIMEOUT_MS,
    DEFAULT_LIMIT: DEFAULT_LIMIT,
    REPO_ROOT: REPO_ROOT,
    bridgeScript: bridgeScript,
  },
};
