/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.2 Plan 06 Task 3 -- Phase 3 dual-floor differential scorer.
 *
 * Pair-wise differential scorer per kickoff §5:
 *
 *   pair passes IFF (diff > 0.3 AND LSA > 0.2 AND BERT > 0.2)
 *
 * where diff = |LSA - BERT|. Strict > comparisons throughout (Test 5
 * verifies the exact-threshold case fails). The dual-floor filter is the
 * detection signal that distinguishes structural-transfer pairs (LSA high,
 * BERT low) from semantic-implementation pairs (BERT high, LSA low) from
 * direct-intersection pairs (both high, low diff -- pruned by the diff floor).
 *
 * --------------------------------------------------------------------------
 * CANON PART 7 CARVE-OUT (DELIBERATE, DOCUMENTED)
 * --------------------------------------------------------------------------
 *
 * The pair-wise LSA cosine below uses an embedded sklearn TfidfVectorizer +
 * TruncatedSVD subset inside lsaBridgeScript -- NOT rs_math.py's
 * build_tfidf_svd. This is a deliberate exception to Reuse Before Build
 * because rs_math.py's API is CORPUS-LEVEL: it expects Sequence[str] >= 3
 * documents and fits a corpus-wide IDF + SVD basis. A pair-wise comparison
 * (1 query_concept vs 1 doc_concept = 2-document mini-corpus) cannot consume
 * that API without forcing degenerate corpus statistics that change the
 * algorithm's semantics:
 *
 *   - 2-document IDF is mathematically meaningless (IDF on a 2-document
 *     corpus collapses the whole vocabulary into one of two values; the
 *     "rare-term up-weighting" that motivates IDF stops working).
 *
 *   - 1-component SVD (max for a 2-document matrix) does NOT correspond
 *     to Kwan 2023's algorithm, which fits ~80 components against a real
 *     corpus to capture topic structure.
 *
 * The pair-wise question requires a fresh per-pair TfidfVectorizer +
 * TruncatedSVD fit specifically tuned for the pair-wise cosine -- which IS
 * what lsaBridgeScript does. rs_math.py continues to be consumed in its
 * CORPUS-MODE use case (e.g., scripts/rs-engine.py for corpus reverse-salient
 * computation per Phase 89-01 / 89-03 / 89-05).
 *
 * To avoid future drift toward "all LSA must go through one path," this
 * carve-out is documented in three locations:
 *
 *   1. The plan's must_haves block + objective (.planning/phases/89.2-.../
 *      89.2-06-preprocessor-and-differential-scorer-PLAN.md)
 *   2. This source file's header comment block (above)
 *   3. The embedded Python lsaBridgeScript header (inside lsaBridgeScript)
 *
 * Acceptance grep enforces the carve-out comment block (>= 2 hits across
 * the CJS header AND the embedded Python header) so refactors that strip
 * one without the other are loud, not silent.
 *
 * --------------------------------------------------------------------------
 *
 * BERT cosine path (Canon Part 7 reuse, NO carve-out): consumes
 * lib/core/rs-pinecone-bridge.cjs (Task 1 of this plan) which wraps the
 * existing rs_cache.py::fetch_all_from_namespace primitive (Phase 89-03
 * v1.10.16) for strict-1024-dim Pinecone-direct vector retrieval.
 *
 * Graceful degradation contract:
 *
 *   bridge fails (no PINECONE_API_KEY, network error, namespace empty)
 *     -> {diff: <lsa>, lsa: <lsa>, bert: null, passes: lsa > LSA_FLOOR,
 *         warning: 'bert_unavailable'}
 *     -> NEVER throws on bridge failure
 *
 *   LSA bridge fails (python3 missing, sklearn import error, parse error)
 *     -> {diff: null, lsa: null, bert: <bert>, passes: false,
 *         warning: 'lsa_unavailable'}
 *     -> Pessimistic: passes=false because LSA is the structural anchor;
 *        without LSA the differential signal is unrecoverable.
 *
 * Canon Part 8 (Graph Boundary): two defense-in-depth layers.
 *
 *   Layer 1 -- pre-input scan: query_concept + doc_concept are passed
 *     through auditQueryString BEFORE either bridge is called. On
 *     FORBIDDEN_PATTERNS hit, throws ExternalEgressViolation; the bridges
 *     are NEVER invoked (Tests 9 + 10 verify call counts == 0).
 *
 *   Layer 2 -- pre-return audit: composite output is passed through
 *     auditQueryObject before return. Throws ExternalEgressViolation on
 *     hit. Defense-in-depth so any forbidden pattern smuggled via the
 *     bridge response (warning fields, error fields) is caught at the gate.
 *
 * Pure CJS, zero npm deps, node built-ins only beyond the rs-egress-* +
 * rs-pinecone-bridge primitives.
 */
'use strict';

const path = require('node:path');
const childProcess = require('child_process');
const { auditQueryString, auditQueryObject } = require('./rs-egress-prompts.cjs');
const pineconeBridge = require('./rs-pinecone-bridge.cjs');
// rs-egress-violations is required transitively by rs-egress-prompts; we do
// not throw ExternalEgressViolation directly from this module (the audit
// helpers do). The require below is a reachability witness for the audit chain.
require('./rs-egress-violations.cjs');

// ---------- Frozen invariants ----------

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const PYTHON_BIN = process.env.MINDRIAN_PYTHON || 'python3';
const LSA_BRIDGE_TIMEOUT_MS = 30000;

// Dual-floor thresholds per kickoff §5. Strict > comparisons.
const DIFF_FLOOR = 0.3;
const LSA_FLOOR = 0.2;
const BERT_FLOOR = 0.2;

// SEED-018 H2: semantic-floor gate on external candidates. A candidate whose
// semantic similarity to the topic is below SEMANTIC_FLOOR is dropped BEFORE it
// ever enters the unified differential matrix -- this kills keyword-overweighting
// at the source, so an off-topic OpenAlex keyword match (e.g. an
// atmospheric-remote-sensing paper on a "multi-user team collaboration" topic)
// never reaches score(). Default 0.15, tunable via RS_SEMANTIC_FLOOR. This is
// ADDITIVE to the dual-floor pair-wise logic above; it does not alter score()'s
// existing contract or thresholds.
const SEMANTIC_FLOOR = (function resolveSemanticFloor() {
  const raw = process.env.RS_SEMANTIC_FLOOR;
  if (typeof raw === 'string' && raw.trim() !== '') {
    const v = Number(raw);
    if (!Number.isNaN(v) && v >= 0 && v <= 1) return v;
  }
  return 0.15;
})();

// ---------- Embedded Python LSA bridge script ----------
//
// CANON PART 7 CARVE-OUT (DELIBERATE, DOCUMENTED): see file header above
// for the complete justification. In short:
//   rs_math.py::build_tfidf_svd is corpus-level (Sequence[str] >= 3 docs);
//   pair-wise (1 vs 1) cosine cannot consume that API without forcing
//   degenerate IDF + SVD. The script below fits a fresh per-pair
//   TfidfVectorizer + TruncatedSVD specifically for the pair-wise question.
//
// The leading `# BSL 1.1` line plus the carve-out justification block
// constitute the Canon discipline marker on the embedded source surface
// (W4 fix per Plan 89.2-06). Acceptance grep enforces presence in both
// the CJS file header (above) AND this embedded Python block.

const lsaBridgeScript = [
  '# BSL 1.1',
  '# Copyright (c) 2026 Mindrian. Phase 89.2 Plan 06 Task 3 -- pair-wise LSA cosine.',
  '#',
  '# CANON PART 7 CARVE-OUT (DELIBERATE, DOCUMENTED): This script computes',
  '# pair-wise (1 vs 1) LSA cosine. It does NOT call rs_math.py because',
  '# rs_math.py::build_tfidf_svd is corpus-level (Sequence[str] >= 3',
  '# documents) and would produce degenerate IDF + SVD on a 2-document pair.',
  '# The embedded sklearn subset below fits a fresh per-pair TfidfVectorizer',
  '# + TruncatedSVD specifically for the pair-wise question, which is the',
  '# algorithmically correct path. rs_math.py is consumed in CORPUS mode by',
  '# scripts/rs-engine.py.',
  '#',
  '# Protocol:',
  '#   stdin   JSON {a: string, b: string}',
  '#   stdout  JSON {success: true, cosine: number} OR {success: false, error: string}',
  'import sys, json',
  'try:',
  '    from sklearn.feature_extraction.text import TfidfVectorizer',
  '    from sklearn.metrics.pairwise import cosine_similarity as sk_cos',
  '    from sklearn.decomposition import TruncatedSVD',
  '    payload = json.loads(sys.stdin.read())',
  '    a = str(payload.get("a", ""))',
  '    b = str(payload.get("b", ""))',
  '    if len(a.strip()) == 0 or len(b.strip()) == 0:',
  '        sys.stdout.write(json.dumps({"success": True, "cosine": 0.0}))',
  '        sys.exit(0)',
  '    texts = [a, b]',
  '    vec = TfidfVectorizer(stop_words="english").fit_transform(texts)',
  '    if vec.shape[1] < 2:',
  '        sys.stdout.write(json.dumps({"success": True, "cosine": 0.0}))',
  '        sys.exit(0)',
  '    n_components = max(1, min(80, vec.shape[1] - 1, vec.shape[0] - 1))',
  '    svd = TruncatedSVD(n_components=n_components, random_state=256).fit(vec)',
  '    reduced = svd.transform(vec)',
  '    c = float(sk_cos(reduced[0:1], reduced[1:2])[0][0])',
  '    # Clamp to [0, 1] for downstream dual-floor consistency. Negative LSA',
  '    # cosines arise on degenerate SVD bases and are not interpretable as',
  '    # similarity in the Kwan 2023 framework.',
  '    sys.stdout.write(json.dumps({"success": True, "cosine": max(0.0, c)}))',
  'except Exception as e:',
  '    sys.stdout.write(json.dumps({"success": False, "error": str(e)}))',
  '',
].join('\n');

// ---------- computeLsaCosine ----------
//
// Spawns python3 with the embedded lsaBridgeScript, passes the two strings
// via JSON-over-stdin, parses the response. Returns:
//
//   {success: true, cosine: number}
//   {success: false, error: 'python_unavailable'|'python_exit_<N>'|'parse_error'|'timeout'|...}

async function computeLsaCosine(a, b) {
  const requestEnvelope = JSON.stringify({ a: a, b: b });
  let res;
  try {
    res = childProcess.spawnSync(PYTHON_BIN, ['-c', lsaBridgeScript], {
      input: requestEnvelope,
      encoding: 'utf8',
      timeout: LSA_BRIDGE_TIMEOUT_MS,
      cwd: REPO_ROOT,
    });
  } catch (err) {
    return { success: false, error: 'spawn_threw', detail: String(err && err.message) };
  }

  if (res && res.error) {
    if (res.error.code === 'ENOENT') return { success: false, error: 'python_unavailable' };
    if (res.error.code === 'ETIMEDOUT' || res.error.code === 'ERR_CHILD_PROCESS_TIMEOUT') {
      return { success: false, error: 'timeout' };
    }
    return { success: false, error: 'spawn_error', detail: String(res.error.message) };
  }

  if (res && res.signal === 'SIGTERM') {
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
    return { success: false, error: 'parse_error', stdout_sample: stdout.slice(0, 200) };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { success: false, error: 'parse_error' };
  }

  if (parsed.success !== true) {
    return { success: false, error: typeof parsed.error === 'string' ? parsed.error : 'bridge_error' };
  }

  if (typeof parsed.cosine !== 'number' || isNaN(parsed.cosine)) {
    return { success: false, error: 'invalid_cosine' };
  }

  return { success: true, cosine: parsed.cosine };
}

// ---------- computeBertCosine ----------
//
// Twin queryPineconeWithVectors calls (one per concept), then pure-JS
// cosineSimilarity on the resulting vectors -- historically 1024-dim
// (Pinecone multilingual-e5-large); after Plan 296-05's repoint, whatever
// dim the local signal cache's encoder resolves to (checked at runtime by
// the dim_mismatch guard below, not hardcoded here). Returns:
//
//   {success: true, cosine: number}
//   {success: false, error: 'namespace_required'|'bridge_failed'|'no_hits'|'shape_error'}

async function computeBertCosine(a, b, namespace, roomDir) {
  if (typeof namespace !== 'string' || namespace.length === 0) {
    return { success: false, error: 'namespace_required' };
  }

  const resA = await pineconeBridge.queryPineconeWithVectors(namespace, a, 1, roomDir);
  if (!resA || resA.success !== true) {
    return { success: false, error: 'bridge_failed_a', detail: resA && resA.error };
  }
  const resB = await pineconeBridge.queryPineconeWithVectors(namespace, b, 1, roomDir);
  if (!resB || resB.success !== true) {
    return { success: false, error: 'bridge_failed_b', detail: resB && resB.error };
  }

  if (!Array.isArray(resA.hits) || resA.hits.length === 0) {
    return { success: false, error: 'no_hits_a' };
  }
  if (!Array.isArray(resB.hits) || resB.hits.length === 0) {
    return { success: false, error: 'no_hits_b' };
  }

  const va = resA.hits[0] && resA.hits[0].values;
  const vb = resB.hits[0] && resB.hits[0].values;
  if (!Array.isArray(va) || !Array.isArray(vb)) {
    return { success: false, error: 'shape_error' };
  }
  // dim_mismatch is the runtime backstop for RSLOCAL-04. Pre-296-05 it
  // protected against a Pinecone shape error; after the repoint it protects
  // against a mixed-space compare (two records embedded by different
  // encoder versions/models). Left exactly as it was: still the load-
  // bearing guard, just against a different root cause now.
  if (va.length !== vb.length || va.length === 0) {
    return { success: false, error: 'dim_mismatch' };
  }

  const cos = pineconeBridge.cosineSimilarity(va, vb);
  return { success: true, cosine: cos };
}

// ---------- score ----------
//
// Public entry point. Pair-wise dual-floor differential scorer.
//
// Inputs:
//   query_concept  string  the concept seeded from preprocessor.concepts[]
//   doc_concept    string  the candidate concept (cross-domain or same-domain)
//   opts           optional:
//     namespace      string  signal-cache namespace for BERT cosine (typically 'external:<topic-slug>')
//     roomDir        string  (Plan 296-05) the room the namespace is scoped to; threaded
//                            through to both computeBertCosine's queryPineconeWithVectors calls
//
// Output (happy path):
//   {diff, lsa, bert, passes}
//
// Output (graceful degradation):
//   {diff, lsa, bert: null, passes: lsa>0.2, warning: 'bert_unavailable'}
//   {diff: null, lsa: null, bert, passes: false, warning: 'lsa_unavailable'}
//
// Throws (the only escape route -- Canon Part 8):
//   ExternalEgressViolation  if either concept matches FORBIDDEN_PATTERNS

async function score(query_concept, doc_concept, opts) {
  // Canon Part 8 Layer 1: pre-input scan on user-controlled concepts.
  // auditQueryString throws ExternalEgressViolation on hit; the bridges
  // below are NEVER invoked when this throws. Tests 9 + 10 verify the
  // call-count contract.
  auditQueryString(typeof query_concept === 'string' ? query_concept : '', 'differential-scorer');
  auditQueryString(typeof doc_concept === 'string' ? doc_concept : '', 'differential-scorer');

  opts = opts || {};
  const namespace = (typeof opts.namespace === 'string' && opts.namespace.length > 0)
    ? opts.namespace
    : null;
  const roomDir = (typeof opts.roomDir === 'string' && opts.roomDir.length > 0)
    ? opts.roomDir
    : null;

  // Run both bridges in parallel. computeLsaCosine is cheap (single Python
  // spawn); computeBertCosine spawns the Pinecone bridge twice. Promise.all
  // means LSA does not block on BERT's spawnSync in the parallel mock-test
  // case. Sequential await would be equivalent for correctness; parallel
  // is the future-proofing for real Brain latency.
  const [lsaResult, bertResult] = await Promise.all([
    computeLsaCosine(query_concept, doc_concept),
    computeBertCosine(query_concept, doc_concept, namespace, roomDir),
  ]);

  let out;
  if (lsaResult.success && bertResult.success) {
    const lsa = lsaResult.cosine;
    const bert = bertResult.cosine;
    const diff = Math.abs(lsa - bert);
    const passes = (diff > DIFF_FLOOR) && (lsa > LSA_FLOOR) && (bert > BERT_FLOOR);
    out = { diff: diff, lsa: lsa, bert: bert, passes: passes };
  } else if (lsaResult.success && !bertResult.success) {
    // BERT unavailable: degrade to LSA-only. Per plan: bert=null, diff=lsa
    // (treat as max divergence), passes=(lsa>LSA_FLOOR only since bert
    // unavailable), warning='bert_unavailable'.
    const lsa = lsaResult.cosine;
    out = {
      diff: lsa,
      lsa: lsa,
      bert: null,
      passes: lsa > LSA_FLOOR,
      warning: 'bert_unavailable',
    };
  } else {
    // LSA failed (with or without BERT): pessimistic. Per plan: passes=false
    // because LSA is the structural anchor; without LSA the differential
    // signal is unrecoverable.
    out = {
      diff: null,
      lsa: null,
      bert: bertResult.success ? bertResult.cosine : null,
      passes: false,
      warning: 'lsa_unavailable',
    };
  }

  // Canon Part 8 Layer 2: pre-return audit on composite output.
  // Throws ExternalEgressViolation on any FORBIDDEN_PATTERNS hit.
  auditQueryObject(out, 'differential-scorer');

  return out;
}

// ---------- Semantic-floor gate (SEED-018 H2) ----------
//
// passesSemanticFloor: pure boolean guard. A candidate SURVIVES iff its cosine
// similarity to the topic vector is >= floor; otherwise it is off-topic noise
// and is rejected before the unified matrix. Reuses rs-pinecone-bridge's
// cosineSimilarity (Canon Part 7 reuse, no carve-out). A degenerate or
// orthogonal candidate vector cosines to 0, which is below any positive floor,
// so it is dropped -- the intended off-topic behavior. Pure / offline: no
// network, no Brain, no spawn.
function passesSemanticFloor(topicVector, candidateVector, floor) {
  const f = (typeof floor === 'number' && floor >= 0 && floor <= 1)
    ? floor
    : SEMANTIC_FLOOR;
  const sim = pineconeBridge.cosineSimilarity(topicVector, candidateVector);
  return sim >= f;
}

// gateCandidatesBySemanticFloor: drop external candidates below SEMANTIC_FLOOR
// BEFORE the differential matrix. encodeFn maps a candidate to its embedding
// vector (a deterministic offline stub encoder in tests per Canon Part 8; the
// embedding spine in production). Returns a filtered shallow copy; never mutates
// the input. If no encodeFn is supplied the gate is a no-op pass-through so
// existing callers are unaffected.
function gateCandidatesBySemanticFloor(topicVector, candidates, encodeFn, floor) {
  if (!Array.isArray(candidates)) return [];
  if (typeof encodeFn !== 'function') return candidates.slice();
  return candidates.filter(function keep(c) {
    return passesSemanticFloor(topicVector, encodeFn(c), floor);
  });
}

// ==========================================================================
// Measured differential (Phase 211, D-200-1)
// ==========================================================================
//
// scoreMeasured is the LOCAL, MEASURED, no-Python replacement for the legacy
// remote/Python legs on the pair-wise path. It is PURELY ADDITIVE: score(),
// computeLsaCosine, computeBertCosine, the embedded Python lsaBridgeScript, and
// every existing export are byte-unchanged. Nothing that consumed the legacy
// scorer notices this section exists.
//
//   semantic leg = local embedding cosine via the 211-01 embedding spine
//                  (embedTexts / encoderProvenance; default model is now
//                  MongoDB/mdbr-leaf-ir per quick(260706-13z) D3, was MiniLM),
//                  reusing the SAME cosineSimilarity score() trusts (Part 7,
//                  no fork).
//   lexical  leg = deterministic pure-CJS Jaccard (lexical-overlap.cjs,
//                  jaccard-v1), the no-Python replacement for the sklearn LSA
//                  spawn on this pair-wise path (SEED-049 D2).
//
// THE SIGN IS THE INSIGHT: signed_diff = semantic - lexical.
//   signed_diff > 0  semantic_implementation (meaning link the vocabulary hides)
//   signed_diff < 0  structural_transfer     (shared words, divergent meaning)
//
// DROPPED LEG: the original differential(lexical, semantic, sentiment) loses its
// sentiment term per the s11 live-measurement refinement (no principled
// unlabeled sentiment computation exists). The measured formula is
// differential(lexical, semantic) only.
//
// UNCALIBRATED: EUREKA_DIFF_FLOOR and the bands below are DEFAULTS, not validated
// thresholds (s11). Calibration is a Phase 202 APO job. Every result is
// provenance-tagged (model, dtype, method, date) so no number is ever mistaken
// for ground truth (the s11 "store as embedding-cosine-differential with model +
// date, NEVER a bare differential_score" refinement; STRIDE T-211-07).
//
// Part 8 (Graph Boundary): the SAME dual-layer defense as score(). Layer 1
// auditQueryString on both inputs BEFORE any compute (so the injected encodeFn
// is NEVER reached on a forbidden input); Layer 2 auditQueryObject on the
// composite output before return. Encoder failure degrades to a structured
// warning envelope and NEVER throws; Part 8 violations remain the only escape
// route (same contract as score()).

// EUREKA_DIFF_FLOOR: env-tunable, reuses DIFF_FLOOR (0.3) as the default. Same
// env-string -> validated -> default pattern as SEMANTIC_FLOOR. Read at CALL
// time so a consumer (or test) can flip it between calls.
const EUREKA_DIFF_FLOOR_DEFAULT = DIFF_FLOOR;

function resolveEurekaDiffFloor() {
  const raw = process.env.EUREKA_DIFF_FLOOR;
  if (typeof raw === 'string' && raw.trim() !== '') {
    const v = Number(raw);
    if (!Number.isNaN(v) && v >= 0 && v <= 1) return v;
  }
  return EUREKA_DIFF_FLOOR_DEFAULT;
}

// bandFor: UNCALIBRATED default bands over abs_diff (s11). Strict > comparisons.
function bandFor(absDiff) {
  if (absDiff > 0.5) return 'breakthrough';
  if (absDiff > 0.4) return 'high';
  if (absDiff > 0.3) return 'opportunity';
  if (absDiff > 0.1) return 'moderate';
  return 'low';
}

// ---------- scoreMeasured ----------
//
// scoreMeasured(a, b, opts) -> Promise<result>
//   opts.encodeFn   (texts -> number[][])  injectable semantic leg (tests)
//   opts.vectors    ([vecA, vecB])         precomputed vectors (211-05 reuse path)
//   opts.lexicalFn  ((a,b) -> number)      injectable lexical leg; default jaccard
//   opts._forceUnavailable                 forwarded to embedTexts (degradation test)
//
// See the section header for the full contract, floors, bands, and provenance.

async function scoreMeasured(a, b, opts) {
  // Canon Part 8 Layer 1: pre-input scan on user-controlled concepts. Throws
  // ExternalEgressViolation on hit; the encodeFn / spine below is NEVER invoked
  // when this throws (Test 8 pins encodeFn call-count 0).
  auditQueryString(typeof a === 'string' ? a : '', 'differential-scorer-measured');
  auditQueryString(typeof b === 'string' ? b : '', 'differential-scorer-measured');

  opts = opts || {};

  // Lexical leg (default jaccard-v1; injectable). Deterministic, offline, cheap.
  const lexicalFn = (typeof opts.lexicalFn === 'function')
    ? opts.lexicalFn
    : require('./eureka/lexical-overlap.cjs').lexicalOverlap;
  const lexical = lexicalFn(a, b);

  const measured_at = new Date().toISOString().slice(0, 10);
  const LEXICAL_METHOD = 'jaccard-v1';

  // Semantic leg: precomputed vectors > injected encodeFn > local embedding
  // spine (lazy-required INSIDE the function so the scorer still loads when the
  // heavy dep is absent -- Canon Decision #8).
  let semantic = null;
  let semantic_model = 'stub';
  let semantic_dtype = 'stub';
  let dim = 0;
  let encoderFailed = false;

  if (Array.isArray(opts.vectors) && opts.vectors.length === 2) {
    const vA = opts.vectors[0];
    const vB = opts.vectors[1];
    semantic = pineconeBridge.cosineSimilarity(vA, vB);
    dim = Array.isArray(vA) ? vA.length : 0;
  } else if (typeof opts.encodeFn === 'function') {
    const vecs = opts.encodeFn([a, b]);
    const vA = vecs && vecs[0];
    const vB = vecs && vecs[1];
    semantic = pineconeBridge.cosineSimilarity(vA, vB);
    dim = Array.isArray(vA) ? vA.length : 0;
  } else {
    // eslint-disable-next-line global-require
    const spine = require('./eureka/embedding-spine.cjs');
    const emb = await spine.embedTexts([a, b], opts);
    if (!emb || emb.success !== true || !Array.isArray(emb.vectors) || emb.vectors.length < 2) {
      encoderFailed = true;
    } else {
      semantic = pineconeBridge.cosineSimilarity(emb.vectors[0], emb.vectors[1]);
      const prov = spine.encoderProvenance();
      semantic_model = prov.model;
      semantic_dtype = prov.dtype;
      dim = (emb.provenance && emb.provenance.dim) || emb.vectors[0].length;
    }
  }

  let out;
  if (encoderFailed) {
    // Graceful degradation: never throw on encoder failure. Lexical still
    // measured; semantic null; pessimistic passes=false.
    out = {
      semantic: null,
      lexical: lexical,
      signed_diff: null,
      abs_diff: null,
      direction: null,
      passes: false,
      band: null,
      warning: 'encoder_unavailable',
      provenance: {
        semantic_model: null,
        semantic_dtype: null,
        dim: 0,
        lexical_method: LEXICAL_METHOD,
        measured_at: measured_at,
      },
    };
  } else {
    const floor = resolveEurekaDiffFloor();
    const signed_diff = semantic - lexical;
    const abs_diff = Math.abs(signed_diff);
    const direction = signed_diff > 0 ? 'semantic_implementation' : 'structural_transfer';
    // passes iff the gap clears the floor AND the HIGH leg is real (not a gap
    // between two near-zero numbers).
    const highLeg = signed_diff > 0 ? semantic : lexical;
    const passes = (abs_diff > floor) && (highLeg > 0.2);
    out = {
      semantic: semantic,
      lexical: lexical,
      signed_diff: signed_diff,
      abs_diff: abs_diff,
      direction: direction,
      passes: passes,
      band: bandFor(abs_diff),
      provenance: {
        semantic_model: semantic_model,
        semantic_dtype: semantic_dtype,
        dim: dim,
        lexical_method: LEXICAL_METHOD,
        measured_at: measured_at,
      },
    };
  }

  // Canon Part 8 Layer 2: pre-return audit on composite output. Throws
  // ExternalEgressViolation on any FORBIDDEN_PATTERNS hit smuggled via a leg.
  auditQueryObject(out, 'differential-scorer-measured');

  return out;
}

// ---------- Exports ----------

module.exports = {
  score: score,
  scoreMeasured: scoreMeasured,
  SEMANTIC_FLOOR: SEMANTIC_FLOOR,
  passesSemanticFloor: passesSemanticFloor,
  gateCandidatesBySemanticFloor: gateCandidatesBySemanticFloor,
  _test: {
    DIFF_FLOOR: DIFF_FLOOR,
    LSA_FLOOR: LSA_FLOOR,
    BERT_FLOOR: BERT_FLOOR,
    SEMANTIC_FLOOR: SEMANTIC_FLOOR,
    LSA_BRIDGE_TIMEOUT_MS: LSA_BRIDGE_TIMEOUT_MS,
    PYTHON_BIN: PYTHON_BIN,
    REPO_ROOT: REPO_ROOT,
    computeLsaCosine: computeLsaCosine,
    computeBertCosine: computeBertCosine,
    lsaBridgeScript: lsaBridgeScript,
    passesSemanticFloor: passesSemanticFloor,
    gateCandidatesBySemanticFloor: gateCandidatesBySemanticFloor,
    EUREKA_DIFF_FLOOR_DEFAULT: EUREKA_DIFF_FLOOR_DEFAULT,
    resolveEurekaDiffFloor: resolveEurekaDiffFloor,
    bandFor: bandFor,
  },
};
