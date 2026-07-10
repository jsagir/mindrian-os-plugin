#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 214-04 -- the archimedes-darkmatter Type-3 gold gate (214-D) plus the
 * rank-order-vs-qualitative-label consistency gate (214-F).
 *
 * This suite formalizes the Phase 211 hand-scored 0.95 baseline
 * (evals/eureka/211-manual-baseline.md line 78) into a PERMANENT executable
 * gate. It runs entirely OFFLINE (Canon Part 8): no Brain, no live model, no
 * network, no model download. Every cosine is exact BY CONSTRUCTION through the
 * shipped 211 spine's encodeFn injection seam (the same lookup-table stub idiom
 * as tests/test-214-analogy-fitness.cjs). These are DIRECTIONAL truths, not
 * live-model numbers: the live-model calibration reading belongs to the 215-era
 * lens re-point, never to CI.
 *
 * The stub has two legs, one per fitness leg:
 *   Leg 1 (text cosine): the source vector is [1,0]; each candidate text maps to
 *     [c, sqrt(1-c^2)] where c is the fixture's engineered stub_text_cosine, so
 *     cosine(source, candidate) is EXACTLY c. This is how the fixture engineers
 *     the restatement trap: the paraphrase reads at c=0.97 while the real bridge
 *     reads at only c=0.70 (high text cosine is NECESSARY, never SUFFICIENT).
 *   Leg 2 (SAPPhIRE fields): each distinct field string maps to a distinct
 *     orthonormal basis vector, so two IDENTICAL field strings cosine to exactly
 *     1.0 (the layer corresponds) and any two DISTINCT strings cosine to exactly
 *     0.0 (it does not). No 2-dim angle collision, no accidental correspondence.
 *
 *   Test 1: leak guard (Pitfall 6) - the seed carries the abstracted pattern and
 *           NOT the answer tokens.
 *   Test 2: 214-D bridge - the real bridge ranks first at band structural/deep.
 *   Test 3: 214-D restatement - the paraphrase out-reads the bridge on text
 *           cosine yet is flagged, banded surface/none, and ranks strictly worse.
 *   Test 4: 214-D pseudoscience floor - the drift ranks last at band surface/none
 *           (honest boundary: full REFUSAL is the 212 critic; 214 asserts the
 *           rank floor plus criticFeatures carried for the later one-line wire).
 *   Test 5: 214-F rank-order - measured band equals the qualitative label for all
 *           four labeled candidates and fused strictly increases with label rank.
 */
'use strict';

const assert = require('node:assert');
const path = require('node:path');

const fit = require('../lib/core/eureka/analogy-fitness.cjs');

const DARKMATTER = require('./fixtures/eureka/214-darkmatter.json');
const RANKORDER = require('./fixtures/eureka/214-rank-order.json');

let passed = 0;
function ok(name) { passed += 1; console.log('  ok   ' + name); }

// ---- The two-leg stub encoder (offline, exact cosines by construction) ----
//
// textVec: exact vectors for the full candidate/source TEXT bodies (Leg 1).
// Every other string (a SAPPhIRE field) gets a distinct orthonormal basis
// vector, so identical fields cosine to 1.0 and distinct fields cosine to 0.0.
function makeStub(textVec) {
  const DIM = 256;
  const basis = new Map();
  let next = 0;
  function orth(s) {
    if (!basis.has(s)) { basis.set(s, next); next += 1; }
    const idx = basis.get(s);
    const v = new Array(DIM).fill(0);
    v[idx] = 1;
    return v;
  }
  return function stub(texts) {
    return texts.map(function (t) {
      if (Object.prototype.hasOwnProperty.call(textVec, t)) return textVec[t].slice();
      return orth(t);
    });
  };
}

// Build the Leg-1 text lookup from a fixture: source.text -> [1,0]; each
// candidate.text -> [c, sqrt(1-c^2)] so its cosine with the source is exactly
// the fixture's engineered stub_text_cosine.
function textVecFor(fixture) {
  const tv = {};
  tv[fixture.source.text] = [1, 0];
  fixture.candidates.forEach(function (cand) {
    const c = Number(cand.stub_text_cosine);
    const y = Math.sqrt(Math.max(0, 1 - c * c));
    tv[cand.text] = [c, y];
  });
  return tv;
}

function byId(rows, id) {
  return rows.filter(function (r) { return r._id === id; })[0];
}

async function scoreAll(fixture) {
  const stub = makeStub(textVecFor(fixture));
  const out = [];
  for (let i = 0; i < fixture.candidates.length; i += 1) {
    const cand = fixture.candidates[i];
    const r = await fit.scoreAnalogyFitness(fixture.source, cand, { encodeFn: stub });
    r._id = cand.id;
    r._label = cand.qualitative_label || cand.label || null;
    r._stubTextCosine = Number(cand.stub_text_cosine);
    out.push(r);
  }
  return out;
}

async function run() {
  // ---------- Test 1: leak guard (Pitfall 6) ----------
  {
    const seed = DARKMATTER.seed;
    assert.strictEqual(typeof seed, 'string', 'Test 1: seed is a string');
    assert.strictEqual(DARKMATTER.source.text, seed, 'Test 1: source.text is the seed verbatim');
    assert.ok(seed.indexOf('rare-signal-in-vast-background') !== -1,
      'Test 1: seed carries the abstracted pattern');
    // The answer never rides in the seed - not dark-matter, not the chemistry
    // mechanism, not the mechanism phrase itself.
    ['dark-matter', 'implicit-solvent', 'background subtraction'].forEach(function (tok) {
      assert.ok(seed.indexOf(tok) === -1, 'Test 1: seed free of leak token "' + tok + '"');
    });
    ok('Test 1: the seed is the abstracted pattern, free of every answer token');
  }

  const rows = await scoreAll(DARKMATTER);
  const ranked = fit.rankCandidates(rows);
  const bridge = byId(rows, 'DM-bridge');
  const restatement = byId(rows, 'DM-restatement');
  const pseudo = byId(rows, 'DM-pseudoscience');

  // ---------- Test 2: 214-D bridge ranks first, structural/deep ----------
  {
    assert.ok(bridge && bridge.success, 'Test 2: bridge scored');
    assert.strictEqual(ranked[0]._id, 'DM-bridge', 'Test 2: bridge is rank 1');
    assert.ok(bridge.structural.band === 'structural' || bridge.structural.band === 'deep',
      'Test 2: bridge band is structural or deep (got ' + bridge.structural.band + ')');
    ok('Test 2 (214-D): the real dark-matter bridge ranks first at a structural band');
  }

  // ---------- Test 3: 214-D restatement trap ----------
  {
    // The raw-text-cosine spike is REAL in the fixture: the paraphrase reads
    // MORE like the seed than the true bridge does. That is the trap.
    assert.ok(restatement._stubTextCosine >= 0.95,
      'Test 3: restatement stub text cosine engineered >= 0.95');
    assert.ok(restatement._stubTextCosine > bridge._stubTextCosine,
      'Test 3: restatement out-reads the bridge on raw text cosine');
    assert.ok(Math.abs(restatement.text.score - restatement._stubTextCosine) < 1e-9,
      'Test 3: measured text cosine equals the engineered value');
    // Yet the structural leg gates it: flagged, thin band, and ranked worse.
    assert.strictEqual(restatement.restatementFlag, true, 'Test 3: restatement flagged');
    assert.ok(restatement.structural.band === 'surface' || restatement.structural.band === 'none',
      'Test 3: restatement band surface or none (got ' + restatement.structural.band + ')');
    const rankOfBridge = ranked.findIndex(function (r) { return r._id === 'DM-bridge'; });
    const rankOfRestate = ranked.findIndex(function (r) { return r._id === 'DM-restatement'; });
    assert.ok(rankOfRestate > rankOfBridge,
      'Test 3: restatement ranks strictly worse than the bridge despite the higher text cosine');
    ok('Test 3 (214-D): the paraphrase out-reads the bridge yet is flagged and floored below it');
  }

  // ---------- Test 4: 214-D pseudoscience floor ----------
  {
    // HONEST BOUNDARY: full pseudoscience REFUSAL (the GuardGate zero) is Phase
    // 212's Grounding Guard - planned-not-executed on disk today. What Phase 214
    // guarantees MECHANICALLY is the rank floor: with no falsifiable layer
    // correspondence the drift can never band above surface, so it can never
    // outrank the bridge. criticFeatures is carried on every result so the 212
    // critic wires in later as a one-line consumer (RESEARCH Open Question 2).
    assert.ok(pseudo && pseudo.success, 'Test 4: pseudoscience scored');
    assert.strictEqual(ranked[ranked.length - 1]._id, 'DM-pseudoscience',
      'Test 4: pseudoscience ranks last');
    assert.ok(pseudo.structural.band === 'surface' || pseudo.structural.band === 'none',
      'Test 4: pseudoscience band surface or none (got ' + pseudo.structural.band + ')');
    assert.ok(pseudo.criticFeatures && typeof pseudo.criticFeatures.band === 'string',
      'Test 4: criticFeatures carried for the future 212 critic wire');
    ok('Test 4 (214-D): the pseudoscience drift is floored last (full refusal = 212 critic)');
  }

  // ---------- Test 5: 214-F rank-order-vs-label consistency ----------
  {
    const roRows = await scoreAll(RANKORDER);
    const ORDER = { surface: 1, behavioral: 2, structural: 3, deep: 4 };
    // Every measured band equals the qualitative label a domain-competent
    // reasoner assigned.
    roRows.forEach(function (r) {
      assert.ok(r.success, 'Test 5: ' + r._id + ' scored');
      assert.strictEqual(r.structural.band, r._label,
        'Test 5: measured band equals label for ' + r._id +
        ' (label ' + r._label + ', band ' + r.structural.band + ')');
    });
    // Fused strictly increases with label rank: surface < behavioral < structural < deep.
    const sorted = roRows.slice().sort(function (a, b) {
      return ORDER[a._label] - ORDER[b._label];
    });
    for (let i = 1; i < sorted.length; i += 1) {
      assert.ok(sorted[i].fused > sorted[i - 1].fused,
        'Test 5: fused strictly increases ' + sorted[i - 1]._label + ' -> ' + sorted[i]._label +
        ' (' + sorted[i - 1].fused + ' vs ' + sorted[i].fused + ')');
    }
    // And rankCandidates lands the deep candidate first, surface last.
    const roRanked = fit.rankCandidates(roRows);
    assert.strictEqual(roRanked[0]._label, 'deep', 'Test 5: deep ranks first');
    assert.strictEqual(roRanked[roRanked.length - 1]._label, 'surface', 'Test 5: surface ranks last');
    ok('Test 5 (214-F): measured bands match the qualitative labels, fused rises with label rank');
  }

  console.log('\n' + passed + ' passed');
}

run().catch(function fail(err) {
  console.error('FAIL:', err && err.message);
  process.exit(1);
});
