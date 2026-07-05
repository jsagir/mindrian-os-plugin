#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 211-05 -- the judge-gate test: the deployed Cross-Topic Connection judge
 * wired on the PSEUDONYMOUS gold-card texts, plus the offline directional
 * contract on scoreMeasured.
 *
 * --------------------------------------------------------------------------
 * PART 8 EGRESS RULE (stated once, enforced structurally):
 * Real-room content NEVER reaches the Plurai endpoint. This test scores ONLY
 * the synthetic-by-construction gold-card texts from evals/eureka/cases/ (the
 * run-all-200.sh precedent: Plurai is BUILD/CI only, synthetic data only, never
 * on the runtime path). It NEVER opens the live room database under the room
 * directory -- grep this source for that local database filename and you find
 * zero hits. The real-room output is verified by the HUMAN spot-check in
 * evals/eureka/211-room-report.md, not by a network judge.
 * --------------------------------------------------------------------------
 *
 * Test A (offline, ALWAYS runs): scoreMeasured directional contract over gold-card
 *   pairs with a deterministic stub encoder. Asserts DIRECTIONAL truths only,
 *   never magnitudes.
 * Test B (network, KEY-GATED): when a Plurai key resolves, POST the darkmatter
 *   transferable connection statement and one unrelated pairing to the
 *   cross-topic-connection endpoint; assert transferable -> Hedged|Confident and
 *   unrelated -> No Connection. On missing key: SKIP and refresh
 *   evals/plurai/211-baseline.json with the baseline_deferred house shape.
 *
 * Pure CJS, node built-ins + gray-matter (house frontmatter parser) + the shipped
 * lib modules. Offline path makes zero network calls.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const matter = require('gray-matter');

const REPO = path.resolve(__dirname, '..');
const CASES_DIR = path.join(REPO, 'evals', 'eureka', 'cases');
const BASELINE_PATH = path.join(REPO, 'evals', 'plurai', '211-baseline.json');

const { scoreMeasured } = require(path.join(REPO, 'lib/core/rs-differential-scorer.cjs'));
const rft = require(path.join(REPO, 'lab/eval/report-from-transcript.cjs'));

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

// ---------------------------------------------------------------------------
// Plurai key resolution (loadApiKey is not exported by report-from-transcript;
// replicate its contract: env var, then ~/.config/evals/credentials.json).
// ---------------------------------------------------------------------------

function resolvePluraiKey() {
  if (process.env.PLURAI_API_KEY) return process.env.PLURAI_API_KEY;
  try {
    const p = path.join(require('node:os').homedir(), '.config', 'evals', 'credentials.json');
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    return j.api_key || null;
  } catch (_e) {
    return null;
  }
}

function writeDeferredBaseline(reason, detail) {
  const payload = {
    schema_version: '1.0',
    artifact_kind: 'ci-baseline',
    baseline_deferred: true,
    reason: reason,
    detail: detail || null,
    date: new Date().toISOString().slice(0, 10),
    legs: ['cross-topic-connection'],
    judge_slug: rft.JUDGES.elevation.slug,
    judge_labels: rft.JUDGES.elevation.labels,
    synthetic_only: true,
    deferred_note: 'The deployed Cross-Topic Connection judge (elevation slug '
      + rft.JUDGES.elevation.slug + ') scores ONLY the pseudonymous gold-card connection '
      + 'texts, never real-room content (Part 8 egress rule). '
      + (reason === 'no_plurai_key'
        ? 'No Plurai key resolved at build time, so this is an honest deferral in the '
          + '201-baseline.json house pattern. Re-run with PLURAI_API_KEY (or '
          + '~/.config/evals/credentials.json) to replace this with a hosted Plurai baseline.'
        : 'A key resolved but the judge endpoint was unreachable (see detail). The '
          + 'cross-topic-connection route is not deployed at the expected URL as of build '
          + 'time; deferred honestly per the 201-baseline.json house pattern. Deploy or '
          + 'correct the endpoint, then re-run to replace this with a hosted Plurai baseline.'),
    endpoint: rft.endpointUrl(rft.JUDGES.elevation.slug),
  };
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  return payload;
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

  // -------------------------------------------------------------------------
  // TEST B -- deployed judge (key-gated). Only synthetic gold-card text egresses.
  // -------------------------------------------------------------------------

  await ok('Test B: Cross-Topic Connection judge scores the gold-card connection texts (or deferred baseline)', async function () {
    const key = resolvePluraiKey();
    if (!key) {
      const payload = writeDeferredBaseline('no_plurai_key');
      assert(payload.baseline_deferred === true, 'deferred baseline must be written');
      console.log('     (no Plurai key -> wrote deferred baseline ' + path.relative(REPO, BASELINE_PATH) + ')');
      return 'SKIP';
    }

    // Build the two judge inputs from SYNTHETIC gold-card text ONLY.
    const dm = card('archimedes-darkmatter');
    const nf = card('nichefoods-null');
    const ll = card('lovelace-lean');

    const transferable = 'Statement A: ' + dm.hypothesis_in + '\nStatement B: ' + dm.destination
      + '\nClaim: these connect because they share the mechanism of statistical background subtraction.';
    const unrelated = 'Statement A: ' + nf.hypothesis_in + '\nStatement B: ' + ll.destination
      + '\nClaim: a specialty-foods growth move and a strong-induction proof restatement are the same insight.';

    const good = await rft.callJudge(rft.JUDGES.elevation.slug, key, transferable, {});
    const bad = await rft.callJudge(rft.JUDGES.elevation.slug, key, unrelated, {});

    // Network gap tolerance: if either call errored, record deferred, do not red-fail CI.
    if (good.error || bad.error) {
      const detail = 'transferable_call=' + (good.reason || good.label) + ' | unrelated_call=' + (bad.reason || bad.label);
      writeDeferredBaseline('plurai_endpoint_unreachable', detail);
      console.log('     (judge endpoint unreachable -> wrote deferred baseline; ' + detail + ')');
      return 'SKIP';
    }

    assert(good.label === 'Hedged' || good.label === 'Confident',
      'the transferable darkmatter connection must judge Hedged or Confident (got ' + good.label + ')');
    assert(bad.label === 'No Connection',
      'the unrelated pairing must judge No Connection (got ' + bad.label + ')');

    // Persist a live baseline record.
    const live = {
      schema_version: '1.0',
      artifact_kind: 'ci-baseline',
      baseline_deferred: false,
      method: 'hosted-plurai',
      date: new Date().toISOString().slice(0, 10),
      legs: ['cross-topic-connection'],
      judge_slug: rft.JUDGES.elevation.slug,
      synthetic_only: true,
      results: {
        transferable_darkmatter: good.label,
        unrelated_pairing: bad.label,
      },
    };
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(live, null, 2) + '\n', 'utf8');
  });

  console.log('\nPhase 211 judge-gate: PASS=' + PASS + ' FAIL=' + FAIL + ' SKIP=' + SKIP);
  process.exit(FAIL === 0 ? 0 : 1);
}

run();
