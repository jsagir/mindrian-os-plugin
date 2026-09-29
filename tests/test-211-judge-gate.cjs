#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 211-05 -- the judge-gate test: the offline directional contract on
 * scoreMeasured over the synthetic gold-card texts.
 *
 * MOVED (quick 260929-obr): the old Test B (the deployed Cross-Topic Connection
 * judge) now lives in tests/test-211-jev-judge-leg.cjs. The live judge is Jev
 * (usefulness_judge) because Plurai was retired 2026-09-29 (hosted endpoint
 * returns HTTP 404). This file is offline only: zero network, writes nothing.
 *
 * --------------------------------------------------------------------------
 * PART 8 EGRESS RULE (stated once, enforced structurally):
 * Real-room content NEVER reaches any vendor endpoint. The tests here and in the
 * live Jev leg use ONLY the synthetic-by-construction gold-card texts from
 * evals/eureka/cases/ (the run-all-200.sh precedent: vendor judges are BUILD/CI
 * only, synthetic data only, never on the runtime path). This test NEVER opens
 * the live room database under the room directory -- grep this source for that
 * local database filename and you find zero hits. The real-room output is
 * verified by the HUMAN spot-check in evals/eureka/211-room-report.md, not by a
 * network judge.
 * --------------------------------------------------------------------------
 *
 * Test A (offline, ALWAYS runs): scoreMeasured directional contract over gold-card
 *   pairs with a deterministic stub encoder. Asserts DIRECTIONAL truths only,
 *   never magnitudes.
 *
 * Pure CJS, node built-ins + gray-matter (house frontmatter parser) + the shipped
 * lib modules. Makes zero network calls and writes no file.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const matter = require('gray-matter');

const REPO = path.resolve(__dirname, '..');
const CASES_DIR = path.join(REPO, 'evals', 'eureka', 'cases');

const { scoreMeasured } = require(path.join(REPO, 'lib/core/rs-differential-scorer.cjs'));

// ---------------------------------------------------------------------------
// Tiny async test harness (matches the house test-211-*.cjs shape).
// ---------------------------------------------------------------------------

let PASS = 0;
let FAIL = 0;
let SKIP = 0;

async function ok(label, fn) {
  try {
    const r = await fn();
    if (r === 'SKIP') { console.log('SKIP ' + label); SKIP += 1; return; }
    console.log('ok   ' + label);
    PASS += 1;
  } catch (e) {
    console.log('FAIL ' + label + ' -- ' + (e && e.message ? e.message : e));
    FAIL += 1;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

// ---------------------------------------------------------------------------
// Deterministic stub encoder (offline). Hashed bag-of-tokens -> 24-dim unit
// vector. Enough for a well-formed cosine; magnitudes are NOT asserted.
// ---------------------------------------------------------------------------

const STUB_DIM = 24;

function stubEncode(texts) {
  return texts.map(function (t) {
    const vec = new Array(STUB_DIM).fill(0);
    const toks = String(t || '').toLowerCase().match(/[a-z0-9]+/g) || [];
    for (let i = 0; i < toks.length; i += 1) {
      const h = crypto.createHash('sha1').update(toks[i]).digest();
      vec[h[0] % STUB_DIM] += (h[1] & 1) ? 1 : -1;
    }
    let n = 0;
    for (let i = 0; i < STUB_DIM; i += 1) n += vec[i] * vec[i];
    n = Math.sqrt(n) || 1;
    for (let i = 0; i < STUB_DIM; i += 1) vec[i] /= n;
    return vec;
  });
}

// ---------------------------------------------------------------------------
// Gold-card loading (synthetic texts only -- the sole content that may egress).
// ---------------------------------------------------------------------------

function card(stem) {
  const raw = fs.readFileSync(path.join(CASES_DIR, stem + '.md'), 'utf8');
  return matter(raw).data;
}

// ===========================================================================

async function run() {
  // -------------------------------------------------------------------------
  // TEST A -- offline directional contract (always runs, zero network).
  // -------------------------------------------------------------------------

  await ok('Test A1: darkmatter hypothesis vs destination yields a valid signed result with full provenance', async function () {
    const c = card('archimedes-darkmatter');
    const r = await scoreMeasured(c.hypothesis_in, c.destination, { encodeFn: stubEncode });
    assert(typeof r.signed_diff === 'number' && !Number.isNaN(r.signed_diff), 'signed_diff must be a finite number');
    assert(r.direction === 'semantic_implementation' || r.direction === 'structural_transfer', 'direction must be one of the two signed labels');
    assert(r.provenance && r.provenance.lexical_method === 'jaccard-v1', 'provenance.lexical_method must be jaccard-v1');
    assert(typeof r.provenance.measured_at === 'string' && r.provenance.measured_at.length >= 10, 'provenance.measured_at must be stamped');
    assert(typeof r.band === 'string' && r.band.length > 0, 'band must be present');
  });

  await ok('Test A2: restatement distractor pair has lexical LOWER than a verbatim self-pair', async function () {
    const c = card('archimedes-darkmatter');
    const restatement = (c.distractors || []).find(function (d) { return d.label === 'restatement'; });
    assert(restatement && restatement.text, 'darkmatter must carry a restatement distractor');
    const selfPair = await scoreMeasured(c.hypothesis_in, c.hypothesis_in, { encodeFn: stubEncode });
    const paraPair = await scoreMeasured(c.hypothesis_in, restatement.text, { encodeFn: stubEncode });
    assert(selfPair.lexical > 0.99, 'a verbatim self-pair must have lexical ~1.0 (got ' + selfPair.lexical + ')');
    assert(paraPair.lexical < selfPair.lexical, 'the paraphrase-trap pair must have lexical below the verbatim self-pair (para=' + paraPair.lexical + ' self=' + selfPair.lexical + ')');
  });

  await ok('Test A3: an unrelated cross-card pair produces a well-formed result (no NaN, no throw)', async function () {
    // davinci hypothesis vs lovelace destination: two unrelated cards, neither
    // carrying a K/M/B figure (the nichefoods card does, which correctly trips
    // the Part 8 egress guard -- see the judge-gate SUMMARY finding).
    const dv = card('davinci-salient');
    const ll = card('lovelace-lean');
    const r = await scoreMeasured(dv.hypothesis_in, ll.destination, { encodeFn: stubEncode });
    assert(typeof r.semantic === 'number' && !Number.isNaN(r.semantic), 'semantic must be finite');
    assert(typeof r.lexical === 'number' && !Number.isNaN(r.lexical), 'lexical must be finite');
    assert(typeof r.abs_diff === 'number' && !Number.isNaN(r.abs_diff), 'abs_diff must be finite');
    assert(typeof r.passes === 'boolean', 'passes must be a boolean');
  });

  console.log('\nPhase 211 judge-gate: PASS=' + PASS + ' FAIL=' + FAIL + ' SKIP=' + SKIP);
  process.exit(FAIL === 0 ? 0 : 1);
}

run();
