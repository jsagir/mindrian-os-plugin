/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 272 -- the D-01 Pinecone hosted-inference /embed fetch module.
 *
 * Ports scripts/rs-engine.py:1098-1130 (_embed_topic_via_pinecone) to a
 * small CJS fetch module. This is the ENTIRE in-scope Pinecone surface for
 * this phase (D-10): the external corpus control/data-plane SDK surface in
 * lib/core/rs_cache.py (create_index_for_model, has_index, describe_index,
 * upsert_records, list(), query) is explicitly descoped to a follow-up
 * phase. Do not extend this module toward that surface.
 *
 * REST contract (RESEARCH.md Finding F-12, cited docs.pinecone.io/reference/
 * api/2025-01/inference/generate-embeddings):
 *   POST https://api.pinecone.io/embed
 *   headers: Api-Key, Content-Type: application/json,
 *            X-Pinecone-Api-Version: 2025-01
 *   body: {model, parameters:{input_type, truncate}, inputs:[{text}, ...]}
 *   response: {model, vector_type, data:[{values, vector_type}], usage}
 *
 * Canon Part 8 (Graph Boundary): reuses the SAME dual-layer audit contract
 * lib/core/rs-pinecone-bridge.cjs already implements -- do not drop it in
 * this "clean-slate" rewrite (RESEARCH.md flags this exact risk).
 *   Layer 1 (pre-egress): auditQueryString on every element of `texts`,
 *     BEFORE the fetch. Throws ExternalEgressViolation on a forbidden-
 *     pattern hit. The one intentional escape route -- never caught here.
 *   Layer 2 (post-receive): auditQueryObject on the parsed response,
 *     BEFORE returning success to the caller.
 *
 * Secret hygiene (Security Domain finding, T-272-11): PINECONE_API_KEY
 * must never appear in a returned envelope's `detail` field. The catch
 * branch scrubs any occurrence of the live key value out of the forwarded
 * error message rather than forwarding err.message verbatim.
 *
 * Never throws across this module's boundary, except the intentional
 * ExternalEgressViolation escape route (Canon Part 8).
 *
 * Injectable seams (offline test pattern, matches embedTexts's encodeFn
 * seam in embedding-spine.cjs):
 *   opts.fetchFn             -- defaults to global fetch (Node 22 built-in)
 *   opts.auditQueryStringFn  -- defaults to auditQueryString
 *   opts.auditQueryObjectFn  -- defaults to auditQueryObject
 *
 * Pure CJS, node built-ins only + one lightweight local require
 * (rs-egress-prompts.cjs -- an already-vetted local module, not the heavy
 * ML dependency the lazy-require convention targets).
 */
'use strict';

const { auditQueryString, auditQueryObject } = require('./rs-egress-prompts.cjs');

const PINECONE_EMBED_URL = 'https://api.pinecone.io/embed';
const PINECONE_MODEL = 'multilingual-e5-large';
const PINECONE_API_VERSION = '2025-01';
const SURFACE = 'pinecone-inference';

// ---------- scrubSecret ----------
//
// Removes any occurrence of the live PINECONE_API_KEY value from an
// error message before it is forwarded in a returned envelope. Bounds the
// message length too, so a pathological error string cannot balloon the
// envelope.

function scrubSecret(message) {
  const apiKey = process.env.PINECONE_API_KEY;
  let out = String(message == null ? '' : message);
  if (typeof apiKey === 'string' && apiKey.length > 0 && out.indexOf(apiKey) !== -1) {
    out = out.split(apiKey).join('[REDACTED]');
  }
  return out.slice(0, 500);
}

// ---------- embedViaPineconeInference ----------
//
// texts: string[] -- the topic-gate text(s) to embed via Pinecone's hosted
//   multilingual-e5-large inference endpoint (1024-dim, external space --
//   never mixed with the 384-dim local embedding-spine.cjs space, D-01).
// opts: {
//   inputType?: string          -- default 'query' (e5 is asymmetric)
//   fetchFn?: function          -- injectable fetch seam, default global fetch
//   auditQueryStringFn?: function -- injectable pre-egress audit seam
//   auditQueryObjectFn?: function -- injectable post-receive audit seam
// }
//
// Returns:
//   {success:true, vectors: number[][], provenance:{model, dim}}
//   {success:false, error:'pinecone_api_key_missing'}
//   {success:false, error:'pinecone_http_<status>'}
//   {success:false, error:'shape_mismatch'}
//   {success:false, error:'network_error', detail: <bounded, key-scrubbed>}
//
// Throws:
//   ExternalEgressViolation -- the one intentional Canon Part 8 escape
//   route, never caught here.

async function embedViaPineconeInference(texts, opts) {
  const options = opts || {};
  const list = Array.isArray(texts) ? texts : [];
  const inputType = (typeof options.inputType === 'string' && options.inputType.length > 0)
    ? options.inputType
    : 'query';
  const fetchFn = (typeof options.fetchFn === 'function') ? options.fetchFn : fetch;
  const auditString = (typeof options.auditQueryStringFn === 'function')
    ? options.auditQueryStringFn
    : auditQueryString;
  const auditObject = (typeof options.auditQueryObjectFn === 'function')
    ? options.auditQueryObjectFn
    : auditQueryObject;

  // --- Env-var gate FIRST: never audit or fetch when the key is absent. ---
  const apiKey = process.env.PINECONE_API_KEY;
  if (typeof apiKey !== 'string' || apiKey.length === 0) {
    return { success: false, error: 'pinecone_api_key_missing' };
  }

  // --- Canon Part 8 Layer 1: pre-egress audit on EVERY input text, BEFORE ---
  // --- the fetch. Throws ExternalEgressViolation on hit -- the intentional ---
  // --- escape route, never caught by this module. ---
  for (let i = 0; i < list.length; i += 1) {
    auditString(list[i], SURFACE);
  }

  try {
    const res = await fetchFn(PINECONE_EMBED_URL, {
      method: 'POST',
      headers: {
        'Api-Key': apiKey,
        'Content-Type': 'application/json',
        'X-Pinecone-Api-Version': PINECONE_API_VERSION,
      },
      body: JSON.stringify({
        model: PINECONE_MODEL,
        parameters: { input_type: inputType, truncate: 'END' },
        inputs: list.map(function toInput(t) { return { text: t }; }),
      }),
    });

    if (!res || !res.ok) {
      const status = res && typeof res.status === 'number' ? res.status : 'unknown';
      return { success: false, error: 'pinecone_http_' + status };
    }

    const json = await res.json();
    const data = Array.isArray(json && json.data) ? json.data : [];
    const vectors = data.map(function toValues(d) { return d && d.values; });

    if (vectors.length !== list.length) {
      return { success: false, error: 'shape_mismatch' };
    }

    // --- Canon Part 8 Layer 2: post-receive audit on the parsed response, ---
    // --- BEFORE returning success. Throws ExternalEgressViolation on hit -- ---
    // --- must propagate, not be swallowed by the catch below. ---
    auditObject(json, SURFACE);

    return {
      success: true,
      vectors: vectors,
      provenance: { model: json.model, dim: (vectors[0] && vectors[0].length) || 0 },
    };
  } catch (err) {
    // The intentional Part 8 escape route must propagate, never be wrapped
    // into a network_error envelope.
    if (err && err.name === 'ExternalEgressViolation') {
      throw err;
    }
    return {
      success: false,
      error: 'network_error',
      detail: scrubSecret(err && err.message),
    };
  }
}

module.exports = {
  embedViaPineconeInference: embedViaPineconeInference,
};
