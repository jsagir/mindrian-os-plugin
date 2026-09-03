#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * tests/fixtures/296/stub-embed-bridge.cjs -- deterministic embed-op stub
 * for lib/core/rs_cache.py's _embed_via_bridge (Phase 296 Plan 04).
 *
 * This exists so tests/296-signal-corpus-local.test.cjs never loads a real
 * ONNX model. The real bridge (scripts/rs-vector-bridge.cjs) routes through
 * embedding-spine.cjs, which lazy-loads @huggingface/transformers and pays
 * a first-run download/model-load cost on every process -- that is what
 * would blow past 296-VALIDATION.md's 15-second feedback-latency budget if
 * eight tests each spawned a real embed. This stub protocol-matches the
 * real bridge's `embed` op exactly (same request field, same success/
 * failure envelope shape) so lib/core/rs_cache.py cannot tell the
 * difference from the wire.
 *
 * Lives under tests/fixtures/296/, NOT under tests/, so
 * tests/run-all-296.sh's tests/296-*.test.cjs glob can never pick this file
 * up and try to execute it as a test.
 *
 * Protocol (must match scripts/rs-vector-bridge.cjs's embed op):
 *   request  {"texts": string[]}
 *   success  {"success":true,"vectors":number[][],"provenance":object,"dim":number}
 *   failure  {"success":false,"error":"encoder_unavailable"}
 *
 * Determinism: each vector is a pure function of its input text (the first
 * four character codes, normalized to [0,1]), so a round-trip test can
 * assert on specific values rather than merely on shape.
 *
 * Failure mode: when STUB_296_FAIL is set (any non-empty value), always
 * responds {success:false, error:'encoder_unavailable'} regardless of op or
 * input, and still exits 0 -- this is what tests/296-signal-corpus-local.
 * test.cjs's Test 7 (no partial writes on embed failure) drives.
 *
 * Always exits 0. Never throws across the process boundary.
 *
 * No em-dashes (CLAUDE.md HARD RULE). Use hyphens.
 */

const STUB_MODEL = 'stub-296';
const STUB_DTYPE = 'q8';
const STUB_DIM = 4;

function embedOne(text) {
  const s = String(text === undefined || text === null ? '' : text);
  const vec = [];
  for (let i = 0; i < STUB_DIM; i += 1) {
    const code = i < s.length ? s.charCodeAt(i) : 0;
    vec.push(Number((code / 255).toFixed(6)));
  }
  return vec;
}

function readStdin() {
  return new Promise(function (resolve) {
    let data = '';
    try {
      process.stdin.setEncoding('utf8');
    } catch (_e) { /* non-tty stdin without setEncoding support; tolerate */ }
    process.stdin.on('data', function (chunk) { data += chunk; });
    process.stdin.on('end', function () { resolve(data); });
    process.stdin.on('error', function () { resolve(data); });
  });
}

async function main() {
  const raw = await readStdin();

  if (process.env.STUB_296_FAIL) {
    process.stdout.write(JSON.stringify({ success: false, error: 'encoder_unavailable' }));
    process.exitCode = 0;
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (_e) {
    parsed = null;
  }

  const texts = (parsed && Array.isArray(parsed.texts)) ? parsed.texts : [];
  const vectors = texts.map(embedOne);

  process.stdout.write(JSON.stringify({
    success: true,
    vectors: vectors,
    provenance: { model: STUB_MODEL, dtype: STUB_DTYPE, dim: STUB_DIM },
    dim: STUB_DIM,
  }));
  process.exitCode = 0;
}

main().catch(function () {
  // Never throw across the process boundary -- match the real bridge's
  // never-throw contract even in this stub.
  try {
    process.stdout.write(JSON.stringify({ success: false, error: 'encoder_unavailable' }));
  } catch (_e) { /* stdout itself failed; nothing left to do */ }
  process.exitCode = 0;
});
