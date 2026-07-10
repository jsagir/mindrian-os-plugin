#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 214-01 -- analogy-fitness two-leg fusion offline contract tests.
 *
 * All seven guards run OFFLINE (Canon Part 8: no Brain, no live model, no
 * network egress, no model download). The heavy encoder dep is NEVER imported
 * by this suite: every embedding is served through the shipped 211 spine's
 * encodeFn injection seam (a hand-built lookup-table stub with exact cosines by
 * construction) or the spine _forceUnavailable hook. Zero fabricated numbers.
 *
 *   Test 1: scoreAnalogyFitness with an injected stub encoder returns
 *           success:true, text.score equal to the stub cosine, provenance.model
 *           'stub'; no model load attempted.
 *   Test 2: structuralFitness band assignment matches the rubric table for four
 *           engineered pairs (deep / structural / behavioral / surface), each
 *           score inside its band range.
 *   Test 3: the restatement invariant (214-B) - a high-text-cosine surface-band
 *           candidate can never outrank a lower-text-cosine structural candidate;
 *           restatementFlag is set on the paraphrase, not on the real transfer.
 *   Test 4: honest degrade - when the encoder is unavailable scoreAnalogyFitness
 *           returns qualitative-only with NO numeric fields.
 *   Test 5: the layer-match threshold is read from env at call time.
 *   Test 6: criticFeatures carries exactly the five forward-compat keys.
 *   Test 7: toRefineProposal emits an analogy_transfer proposal that
 *           graph-refine-loop proposalKey accepts without throwing.
 */
'use strict';

const assert = require('node:assert');

const fit = require('../lib/core/eureka/analogy-fitness.cjs');
const refine = require('../lib/core/graph-refine-loop.cjs');

let passed = 0;
function ok(name) { passed += 1; console.log('  ok   ' + name); }
function approx(a, b, name) {
  assert.ok(Math.abs(a - b) < 1e-9, name + ' (got ' + a + ', want ' + b + ')');
}

// A deterministic unit-vector for any string. Identical strings map to the same
// vector, so cosine of an identical field pair is exactly 1.0 (it corresponds).
function angleVec(s) {
  const str = String(s || '');
  let h = 0;
  for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) % 997;
  const a = (h / 997) * (Math.PI / 2);
  return [Math.cos(a), Math.sin(a)];
}

async function run() {
  // ---------- Test 1: injected stub encoder, measured text cosine ----------
  {
    // 'S' -> [1,0], 'C' -> [0.8,0.6] so cosine('S','C') is exactly 0.8.
    function stub1(texts) {
      return texts.map(function (t) {
        if (t === 'S') return [1, 0];
        if (t === 'C') return [0.8, 0.6];
        return angleVec(t);
      });
    }
    const source = { text: 'S', sapphire: { state_change: 'k1' } };
    const cand = { text: 'C', sapphire: { state_change: 'k1' } };
    const r = await fit.scoreAnalogyFitness(source, cand, { encodeFn: stub1 });
    assert.strictEqual(r.success, true, 'Test 1: success true');
    approx(r.text.score, 0.8, 'Test 1: text.score is the stub cosine');
    assert.ok(r.provenance && r.provenance.model === 'stub', 'Test 1: provenance.model stub');
    ok('Test 1: scoreAnalogyFitness returns a measured stub cosine + stub provenance');
  }

  // ---------- Test 2: band assignment matches the rubric table ----------
  {
    const L = fit.SAPPHIRE_LAYERS;
    function full() {
      const o = {};
      L.forEach(function (l) { o[l] = 'v_' + l; });
      return o;
    }
    // deep: all 7 fields identical.
    {
      const s = await fit.structuralFitness(full(), full(), { encodeFn: function (t) { return t.map(angleVec); } });
      assert.strictEqual(s.success, true, 'Test 2 deep: success');
      assert.strictEqual(s.band, 'deep', 'Test 2 deep: band');
      assert.ok(s.score >= 0.8 && s.score <= 1.0, 'Test 2 deep: score in [0.8,1.0]');
    }
    // structural: state_change + action + phenomenon + real_effect identical, rest empty.
    {
      const src = { state_change: 'a', action: 'b', parts: '', phenomenon: 'c', input: '', real_effect: 'd', effect: '' };
      const s = await fit.structuralFitness(src, src, { encodeFn: function (t) { return t.map(angleVec); } });
      assert.strictEqual(s.band, 'structural', 'Test 2 structural: band');
      assert.ok(s.score >= 0.6 && s.score <= 0.8, 'Test 2 structural: score in [0.6,0.8]');
    }
    // behavioral: state_change + action + phenomenon identical, rest empty.
    {
      const src = { state_change: 'a', action: 'b', parts: '', phenomenon: 'c', input: '', real_effect: '', effect: '' };
      const s = await fit.structuralFitness(src, src, { encodeFn: function (t) { return t.map(angleVec); } });
      assert.strictEqual(s.band, 'behavioral', 'Test 2 behavioral: band');
      assert.ok(s.score >= 0.3 && s.score <= 0.5, 'Test 2 behavioral: score in [0.3,0.5]');
    }
    // surface: state_change only.
    {
      const src = { state_change: 'a', action: '', parts: '', phenomenon: '', input: '', real_effect: '', effect: '' };
      const s = await fit.structuralFitness(src, src, { encodeFn: function (t) { return t.map(angleVec); } });
      assert.strictEqual(s.band, 'surface', 'Test 2 surface: band');
      assert.ok(s.score >= 0.1 && s.score <= 0.2, 'Test 2 surface: score in [0.1,0.2]');
    }
    ok('Test 2: structuralFitness bands match the rubric table, scores inside range');
  }

  // ---------- Test 3: the restatement invariant (214-B) ----------
  {
    // Text cosines: SRC.A = 0.95 (paraphrase), SRC.B = 0.60 (real transfer).
    const TEXTVEC = {
      SRC: [1, 0],
      A_TEXT: [0.95, Math.sqrt(1 - 0.95 * 0.95)],
      B_TEXT: [0.6, 0.8],
    };
    function stub(texts) {
      return texts.map(function (t) { return TEXTVEC[t] || angleVec(t); });
    }
    const source = {
      text: 'SRC',
      sapphire: { state_change: 'sc', action: 'ac', parts: '', phenomenon: 'ph', input: '', real_effect: 're', effect: '' },
    };
    // A: high text cosine but only state_change corresponds -> surface (a paraphrase).
    const candA = {
      text: 'A_TEXT',
      sapphire: { state_change: 'sc', action: '', parts: '', phenomenon: '', input: '', real_effect: '', effect: '' },
    };
    // B: lower text cosine but state_change+action+phenomenon+real_effect correspond -> structural.
    const candB = {
      text: 'B_TEXT',
      sapphire: { state_change: 'sc', action: 'ac', parts: '', phenomenon: 'ph', input: '', real_effect: 're', effect: '' },
    };
    const rA = await fit.scoreAnalogyFitness(source, candA, { encodeFn: stub });
    const rB = await fit.scoreAnalogyFitness(source, candB, { encodeFn: stub });
    assert.strictEqual(rA.structural.band, 'surface', 'Test 3: A is surface');
    assert.strictEqual(rB.structural.band, 'structural', 'Test 3: B is structural');
    assert.strictEqual(rA.restatementFlag, true, 'Test 3: A flagged restatement');
    assert.strictEqual(rB.restatementFlag, false, 'Test 3: B not flagged');
    const ranked = fit.rankCandidates([rA, rB]);
    assert.strictEqual(ranked[0], rB, 'Test 3: B ranks before A (band-first gate)');
    assert.strictEqual(ranked[1], rA, 'Test 3: A ranks last despite higher text cosine');
    ok('Test 3: restatement gate - structural B outranks paraphrase A, flag set on A only');
  }

  // ---------- Test 4: honest degrade, no fabricated numbers ----------
  {
    const source = { text: 'anything', sapphire: { state_change: 'x' } };
    const cand = { text: 'else', sapphire: { state_change: 'x' } };
    let threw = false;
    let r;
    try {
      r = await fit.scoreAnalogyFitness(source, cand, { _forceUnavailable: true });
    } catch (_e) {
      threw = true;
    }
    assert.strictEqual(threw, false, 'Test 4: never throws');
    assert.strictEqual(r.success, false, 'Test 4: success false');
    assert.strictEqual(r.degrade, 'qualitative-only', 'Test 4: qualitative-only');
    assert.strictEqual(r.reason, 'encoder_unavailable', 'Test 4: reason');
    assert.strictEqual(r.text, undefined, 'Test 4: no numeric text field');
    assert.strictEqual(r.structural, undefined, 'Test 4: no numeric structural field');
    assert.strictEqual(r.fused, undefined, 'Test 4: no fused field');
    ok('Test 4: unavailable encoder degrades to qualitative-only with zero numbers');
  }

  // ---------- Test 5: layer threshold read from env at call time ----------
  {
    // 'x' -> [1,0], 'y' -> [0.7, sqrt(0.51)] so cosine('x','y') is exactly 0.7.
    function stub(texts) {
      return texts.map(function (t) {
        if (t === 'x') return [1, 0];
        if (t === 'y') return [0.7, Math.sqrt(1 - 0.49)];
        return angleVec(t);
      });
    }
    const src = { state_change: 'x', action: '', parts: '', phenomenon: '', input: '', real_effect: '', effect: '' };
    const cnd = { state_change: 'y', action: '', parts: '', phenomenon: '', input: '', real_effect: '', effect: '' };
    const saved = process.env.MINDRIAN_ANALOGY_LAYER_THRESHOLD;
    try {
      delete process.env.MINDRIAN_ANALOGY_LAYER_THRESHOLD; // default 0.5
      const low = await fit.structuralFitness(src, cnd, { encodeFn: stub });
      assert.ok(low.corresponding.indexOf('state_change') !== -1, 'Test 5: corresponds at default 0.5');
      assert.strictEqual(low.band, 'surface', 'Test 5: surface at default');

      process.env.MINDRIAN_ANALOGY_LAYER_THRESHOLD = '0.9';
      const high = await fit.structuralFitness(src, cnd, { encodeFn: stub });
      assert.strictEqual(high.corresponding.indexOf('state_change'), -1, 'Test 5: no longer corresponds at 0.9');
      assert.strictEqual(high.band, 'none', 'Test 5: none at 0.9');
      approx(high.score, 0, 'Test 5: score 0 at none');
    } finally {
      if (saved === undefined) delete process.env.MINDRIAN_ANALOGY_LAYER_THRESHOLD;
      else process.env.MINDRIAN_ANALOGY_LAYER_THRESHOLD = saved;
    }
    ok('Test 5: MINDRIAN_ANALOGY_LAYER_THRESHOLD resolves at call time');
  }

  // ---------- Test 6: criticFeatures has exactly the five keys ----------
  {
    function stub(texts) { return texts.map(angleVec); }
    const source = { text: 'p', sapphire: { state_change: 'a', action: 'b', parts: '', phenomenon: 'c', input: '', real_effect: 'd', effect: '' } };
    const r = await fit.scoreAnalogyFitness(source, source, { encodeFn: stub });
    assert.strictEqual(r.success, true, 'Test 6: success');
    const keys = Object.keys(r.criticFeatures).sort();
    assert.deepStrictEqual(
      keys,
      ['band', 'layerCosines', 'restatementFlag', 'structuralScore', 'textCosine'],
      'Test 6: exactly the five critic feature keys'
    );
    ok('Test 6: criticFeatures carries the five forward-compat keys');
  }

  // ---------- Test 7: toRefineProposal shape, proposalKey accepts it ----------
  {
    function stub(texts) { return texts.map(angleVec); }
    const source = { text: 'p', sapphire: { state_change: 'a', action: 'b', parts: '', phenomenon: 'c', input: '', real_effect: 'd', effect: '' } };
    const r = await fit.scoreAnalogyFitness(source, source, { encodeFn: stub });
    const withDate = fit.toRefineProposal(r, { statement: 'A bridges to B', sourceDate: '2019-06-01' });
    assert.strictEqual(withDate.kind, 'analogy_transfer', 'Test 7: kind');
    assert.strictEqual(withDate.valid_at, '2019-06-01', 'Test 7: valid_at from sourceDate');
    assert.strictEqual(withDate.statement, 'A bridges to B', 'Test 7: statement passthrough');
    let threw = false;
    try { refine.proposalKey(withDate); } catch (_e) { threw = true; }
    assert.strictEqual(threw, false, 'Test 7: proposalKey accepts without throwing');

    const noDate = fit.toRefineProposal(r, { statement: 'x' });
    assert.strictEqual(noDate.valid_at, null, 'Test 7: valid_at null when no sourceDate');
    ok('Test 7: toRefineProposal emits an analogy_transfer proposal proposalKey accepts');
  }

  console.log('\n' + passed + ' passed');
}

run().catch(function fail(err) {
  console.error('FAIL:', err && err.message);
  process.exit(1);
});
