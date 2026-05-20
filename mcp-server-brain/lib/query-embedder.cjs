'use strict';

// mcp-server-brain/lib/query-embedder.cjs
//
// Phase 127.1 Plan 03 -- server-side query-embedding helper.
//
// WHY THIS EXISTS
//   Pinecone's brain_search used INTEGRATED INFERENCE: the Pinecone index
//   embedded the query text server-side, so the MCP tool accepted a plain
//   string. Neo4j has NO integrated inference. After Pinecone is retired
//   (Plan 127.1-05) there is nothing left to embed query text. The
//   re-scoped 127.1-CONTEXT.md states it plainly: "the rewired path MUST
//   embed the query text with e5-large server-side before the Neo4j
//   vector search. This is a real new step, not a rename."
//
//   This module IS that step. It converts a query string into a 1024-dim
//   multilingual-e5-large vector that lands in the SAME embedding space as
//   the 12,401 migrated passage vectors in the `mindrian_methodology_vec`
//   Neo4j HNSW index.
//
// THE e5 PREFIX CONVENTION (Lock 2 -- the single most likely correctness bug)
//   e5-family models REQUIRE an asymmetric prefix:
//     - documents are embedded with the `passage: ` prefix
//     - search queries are embedded with the `query: ` prefix
//   The 12,401-vector corpus was embedded by Pinecone's hosted
//   multilingual-e5-large integrated inference with the `passage: ` prefix.
//   This module MUST apply the `query: ` prefix so the query vector lands
//   in the same e5 space. A prefix mismatch does not error -- it silently
//   degrades recall. That is why QUERY_PREFIX is a grep-locked constant and
//   the harness asserts the sent payload begins with `query: `.
//
// EMBEDDING STRATEGY (D-03; path A primary, path B fallback)
//   Path A (IMPLEMENTED): a hosted multilingual-e5-large HTTPS endpoint.
//   Zero local model weight, modest latency, an API key in Render env vars.
//   This matches what Pinecone itself did (hosted e5-large inference) and
//   keeps the Render free-tier footprint small. The endpoint URL + API key
//   come from the Render env vars EMBEDDING_API_URL and EMBEDDING_API_KEY.
//
//   Path B (FALLBACK, not implemented here): a quantized multilingual-
//   e5-large ONNX model via a JS runtime. Heavier cold-start + memory on
//   the Render free tier; viable only if no hosted endpoint is available.
//   The transport call below is a small swappable internal function
//   (`httpEmbedTransport`) so a future ONNX-local path B can replace it
//   WITHOUT changing the `embedQuery` signature.
//
// CANON PART 8 (Graph Boundary)
//   This module embeds the QUERY STRING the caller passes. The Brain server
//   only ever receives generic methodology query handles per the typed-
//   packet contract; this embedder does not log query text, does not
//   persist it, and adds no new egress surface beyond the single hosted-
//   embedding HTTPS call to EMBEDDING_API_URL. The query text leaves the
//   Brain server only to reach the embedding backend that converts it to a
//   vector -- it is never written to disk, never logged, never forwarded.
//
// Hard rules honored:
//   - No em-dashes (U+2014); hyphens only.
//   - CommonJS; Node 18+ (global fetch, AbortController).
//   - No new runtime dependency: path A uses Node 18+ global `fetch`.

// ----------------------------------------------------------------------------
// Locked constants -- grep-locked, matching the migrated corpus exactly.
// ----------------------------------------------------------------------------

// Lock 2: the model the 12,401-vector corpus was embedded with. Grep-able.
const MODEL = 'multilingual-e5-large';

// Lock 2: the dimension of every vector in `mindrian_methodology_vec`.
const EMBEDDING_DIMS = 1024;

// The e5 query-side prefix. Mandatory for space-alignment with the migrated
// `passage: `-prefixed corpus. Grep-able.
const QUERY_PREFIX = 'query: ';

// Render free tier: do not hang a Brain request waiting on the embedding
// backend. 5-second hard ceiling on the transport call.
const FETCH_TIMEOUT_MS = 5000;

// ----------------------------------------------------------------------------
// Embedding transport (path A: hosted multilingual-e5-large HTTPS endpoint).
//
// This is the swappable strategy seam. A future ONNX-local path B replaces
// `httpEmbedTransport` with an in-process call; `embedQuery` does not change.
// ----------------------------------------------------------------------------

/**
 * Path A transport: POST the prefixed text to a hosted multilingual-e5-large
 * endpoint and return the raw embedding array.
 *
 * On ANY transport failure (network error, non-2xx, timeout) this throws.
 * `embedQuery` catches and re-frames every such failure as
 * `embedding backend unavailable` so the cutover (Plan 127.1-04) can fall
 * back deterministically.
 *
 * @param {string} prefixedText - the `query: `-prefixed query string.
 * @returns {Promise<number[]>} the raw vector returned by the backend.
 */
async function httpEmbedTransport(prefixedText) {
  const url = process.env.EMBEDDING_API_URL;
  const apiKey = process.env.EMBEDDING_API_KEY;
  if (!url) {
    const e = new Error('EMBEDDING_API_URL is not set');
    e.isConfigError = true;
    throw e;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let resp;
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers.Authorization = 'Bearer ' + apiKey;
    resp = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ model: MODEL, input: prefixedText }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!resp.ok) {
    const e = new Error('embedding endpoint returned HTTP ' + resp.status);
    e.isHttpError = true;
    throw e;
  }

  const body = await resp.json();
  // Accept the common hosted-inference response shapes:
  //   { embedding: [...] }                    (single-vector form)
  //   { data: [ { embedding: [...] } ] }       (OpenAI-style form)
  //   { embeddings: [ [...] ] }                (batch form)
  let vector = null;
  if (Array.isArray(body && body.embedding)) {
    vector = body.embedding;
  } else if (body && Array.isArray(body.data) && body.data[0] && Array.isArray(body.data[0].embedding)) {
    vector = body.data[0].embedding;
  } else if (body && Array.isArray(body.embeddings) && Array.isArray(body.embeddings[0])) {
    vector = body.embeddings[0];
  }
  if (!Array.isArray(vector)) {
    const e = new Error('embedding endpoint returned an unrecognized response shape');
    e.isShapeError = true;
    throw e;
  }
  return vector;
}

// The active transport. Default is path A (hosted HTTPS). The test seam
// below can swap it for a hermetic mock; a future path B can swap it for an
// in-process ONNX call.
let activeTransport = httpEmbedTransport;

// ----------------------------------------------------------------------------
// embedQuery -- the public contract.
// ----------------------------------------------------------------------------

/**
 * Convert a query string into a 1024-dim multilingual-e5-large vector.
 *
 * @param {string} text - the raw query text (NOT prefixed; this function
 *                         prepends the e5 `query: ` prefix).
 * @returns {Promise<number[]>} a 1024-element array of finite numbers.
 * @throws {Error} if `text` is not a non-empty string.
 * @throws {Error} if the backend vector is not exactly 1024 numeric elements
 *                 (the error names the observed length).
 * @throws {Error} whose message contains `embedding backend unavailable` on
 *                 any transport failure (network error, non-2xx, timeout).
 */
async function embedQuery(text) {
  // 1. Validate the input is a non-empty string.
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new Error(
      'embedQuery requires a non-empty string; received ' +
        (typeof text === 'string' ? 'an empty or whitespace-only string' : typeof text)
    );
  }

  // 2. Prepend the e5 `query: ` prefix (mandatory space-alignment with the
  //    migrated `passage: `-prefixed corpus -- Lock 2).
  const prefixed = QUERY_PREFIX + text;

  // 3. Call the embedding backend. Any transport failure becomes a single
  //    deterministic `embedding backend unavailable` error.
  let vector;
  try {
    vector = await activeTransport(prefixed);
  } catch (err) {
    const e = new Error(
      'embedding backend unavailable: ' + (err && err.message ? err.message : String(err))
    );
    e.cause = err;
    throw e;
  }

  // 4. Validate the returned vector: exactly 1024 finite numeric elements.
  if (!Array.isArray(vector) || vector.length !== EMBEDDING_DIMS) {
    throw new Error(
      'embedding dimension mismatch: expected ' + EMBEDDING_DIMS +
        ', observed ' + (Array.isArray(vector) ? vector.length : 'a non-array response')
    );
  }
  for (let i = 0; i < vector.length; i += 1) {
    if (typeof vector[i] !== 'number' || !Number.isFinite(vector[i])) {
      throw new Error(
        'embedding vector contains a non-numeric element at index ' + i +
          '; every element must be a finite number'
      );
    }
  }

  return vector;
}

// ----------------------------------------------------------------------------
// Test seam -- lets a hermetic harness inject a fake transport so the
// harness runs with NO live network call. Mirrors the project's existing
// `module.exports._test` test-seam idiom.
// ----------------------------------------------------------------------------

const _test = {
  // Swap the embedding transport for a fake. The fake receives the
  // `query: `-prefixed text and returns (a Promise of) a vector.
  _setTransport(fn) {
    activeTransport = fn;
  },
  // Restore the production path-A transport.
  _resetTransport() {
    activeTransport = httpEmbedTransport;
  },
  // Exposed for direct inspection in tests.
  _httpEmbedTransport: httpEmbedTransport,
};

module.exports = {
  embedQuery: embedQuery,
  MODEL: MODEL,
  EMBEDDING_DIMS: EMBEDDING_DIMS,
  QUERY_PREFIX: QUERY_PREFIX,
  FETCH_TIMEOUT_MS: FETCH_TIMEOUT_MS,
  _test: _test,
};
