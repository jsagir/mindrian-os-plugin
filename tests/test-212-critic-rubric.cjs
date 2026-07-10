#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 212-02 -- Eureka Critic Stage B (rubric) + criticRule offline suite.
 *
 * Every judge is a stub judgeFn (the 211 encodeFn seam precedent): zero network,
 * zero model load. The two-pass rubric protocol, the verdict-by-code mapping, the
 * composed classifyCandidate pipeline, and the calibration ruling are all exercised
 * without a single real LLM or embedder call.
 *
 *   Test 1:  verdictFromRubric is a pure total function over the 6-item pattern.
 *   Test 2:  runRubric calls the injected judgeFn EXACTLY twice (neutral + adversarial).
 *   Test 3:  identical answers across both passes -> agreed pattern -> verdictFromRubric.
 *   Test 4:  ANY per-item disagreement -> general_shallow / rubric_disagreement, 'x' recorded.
 *   Test 5:  the built prompts never carry the differential score / band / framing.
 *   Test 6:  classifyCandidate short-circuits: a Stage-A fail never invokes judgeFn.
 *   Test 7:  criticRule with a KNOWN bucket returns coarse confidence (never a float).
 *   Test 8:  an unseen rubric_pattern -> confidence 'unknown' + reasoning_tag calibration_unknown.
 *   Test 9:  criticRule enforces the closed-key discipline; no cwd / roomDir reads.
 *   Test 10: a payload whose schema_version mismatches the tags file -> confidence 'unknown'.
 */
'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const critic = require('../lib/core/eureka-critic.cjs');

let passed = 0;
function ok(name) { passed += 1; console.log('  ok   ' + name); }

// ---------- stub encoders (no model, fully deterministic) ----------

function constantEncode(texts) {
  return texts.map(function () { return [1, 0, 0, 0]; });
}
function distinctEncode(texts) {
  return texts.map(function (t) {
    let h = 2166136261 >>> 0;
    const s = String(t == null ? '' : t);
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return [
      (h & 255) - 128,
      ((h >>> 8) & 255) - 128,
      ((h >>> 16) & 255) - 128,
      ((h >>> 24) & 255) - 128,
    ];
  });
}

// A full-pass Stage-A candidate (entity-rich mechanism, distinct embeddings).
const PASSING_CANDIDATE = {
  text: 'A superconducting quantum junction.',
  mechanismText: 'The Josephson junction couples Niobium electrodes across a 2nm oxide barrier.',
  mappingStatement: 'The barrier tunneling maps to a controlled gate in a computing element.',
  sourceDomainTag: 'materials',
  targetDomainTag: 'computing',
};

// A canonical valid D1 payload (all 8 closed keys) for the criticRule tests.
function makePayload(overrides) {
  return Object.assign({
    differential_score: 0.42,
    semantic_similarity: 0.61,
    lsa_similarity: 0.19,
    surprise_type: 'structural_transfer',
    source_domain_tag: 'materials',
    target_domain_tag: 'computing',
    rubric_pattern: '111111',
    schema_version: 1,
  }, overrides || {});
}

async function run() {
  // ---------- Test 1: verdictFromRubric pure total function ----------
  {
    assert.strictEqual(critic.RUBRIC_ITEMS.length, 6, 'Test 1: exactly 6 rubric items');
    const V = critic.verdictFromRubric;
    assert.strictEqual(V({ a: 1, b: 1, c: 1, d: 1, e: 1, f: 1 }), 'transferable', 'all true -> transferable');
    assert.strictEqual(V({ a: 1, b: 1, c: 1, d: 1, e: 1, f: 0 }), 'pseudoscience', '!f -> pseudoscience');
    assert.strictEqual(V({ a: 1, b: 1, c: 0, d: 1, e: 1, f: 1 }), 'pseudoscience', '!c -> pseudoscience');
    assert.strictEqual(V({ a: 1, b: 1, c: 1, d: 1, e: 0, f: 1 }), 'restatement', '!e -> restatement');
    assert.strictEqual(V({ a: 1, b: 1, c: 1, d: 0, e: 1, f: 1 }), 'general_shallow', '!d -> general_shallow');
    assert.strictEqual(V({ a: 0, b: 1, c: 1, d: 1, e: 1, f: 1 }), 'general_shallow', '!a fallthrough -> general_shallow');
    assert.strictEqual(V({ a: 1, b: 0, c: 1, d: 1, e: 1, f: 1 }), 'general_shallow', '!b fallthrough -> general_shallow');
    ok('Test 1: verdictFromRubric is the pure Pattern-2 mapping (bias-to-reject default)');
  }

  // ---------- Test 2: runRubric makes EXACTLY two judge calls ----------
  {
    let calls = 0;
    const judge = function () { calls += 1; return { a: true, b: true, c: true, d: true, e: true, f: true }; };
    await critic.runRubric(PASSING_CANDIDATE, { judgeFn: judge });
    assert.strictEqual(calls, 2, 'Test 2: exactly two judge calls (neutral + adversarial), never a panel');
    ok('Test 2: runRubric invokes judgeFn exactly twice');
  }

  // ---------- Test 3: agreement -> agreed pattern flows to verdictFromRubric ----------
  {
    const judge = function () { return { a: true, b: true, c: true, d: true, e: true, f: true }; };
    const r = await critic.runRubric(PASSING_CANDIDATE, { judgeFn: judge });
    assert.strictEqual(r.disagreement, false, 'Test 3: no disagreement');
    assert.strictEqual(r.rubric_pattern, '111111', 'Test 3: pattern is the agreed 01 string');
    assert.strictEqual(r.verdict, 'transferable', 'Test 3: agreed pattern maps to transferable');
    ok('Test 3: identical passes flow the agreed pattern to verdictFromRubric');
  }

  // ---------- Test 4: per-item disagreement -> general_shallow / rubric_disagreement ----------
  {
    let calls = 0;
    const judge = function (prompt) {
      calls += 1;
      // The adversarial pass (only it names a COUNTER-mapping / generic filler) flips item e.
      if (/COUNTER-mapping|generic filler/i.test(prompt)) {
        return { a: true, b: true, c: true, d: true, e: false, f: true };
      }
      return { a: true, b: true, c: true, d: true, e: true, f: true };
    };
    const r = await critic.runRubric(PASSING_CANDIDATE, { judgeFn: judge });
    assert.strictEqual(calls, 2, 'Test 4: still exactly two calls');
    assert.strictEqual(r.disagreement, true, 'Test 4: disagreement detected');
    assert.strictEqual(r.verdict, 'general_shallow', 'Test 4: disagreement routes general_shallow');
    assert.strictEqual(r.reasoning_tag, 'rubric_disagreement', 'Test 4: reasoning_tag rubric_disagreement');
    assert.strictEqual(r.rubric_pattern[4], 'x', "Test 4: 'x' recorded at the disagreed position (e = index 4)");
    ok('Test 4: any per-item disagreement routes general_shallow with an x-marked pattern');
  }

  // ---------- Test 5: prompt hygiene (no score / band / framing leak, D2 item 5) ----------
  {
    const candidate = {
      mechanismText: 'The Helmholtz resonator couples ultrasound into a fluid microchannel.',
      mappingStatement: 'A tuned acoustic cavity maps to a selective signal filter.',
      differential_score: 0.825,
      band: 'high-excitement',
      provenance: 'generator-run-7',
    };
    let neutralPrompt = null;
    let adversarialPrompt = null;
    const judge = function (prompt) {
      if (neutralPrompt === null) neutralPrompt = prompt;
      else adversarialPrompt = prompt;
      return { a: true, b: true, c: true, d: true, e: true, f: true };
    };
    await critic.runRubric(candidate, { judgeFn: judge });
    assert.ok(neutralPrompt.indexOf('0.825') === -1, 'Test 5: neutral prompt omits the raw differential');
    assert.ok(neutralPrompt.indexOf('825') === -1, 'Test 5: neutral prompt omits the differential digits');
    assert.ok(neutralPrompt.indexOf('high-excitement') === -1, 'Test 5: neutral prompt omits the band/framing');
    assert.ok(adversarialPrompt.indexOf('825') === -1, 'Test 5: adversarial prompt omits the differential digits too');
    assert.ok(neutralPrompt.indexOf('Helmholtz') !== -1, 'Test 5: mechanism material IS present (the judge needs content)');
    ok('Test 5: prompts carry mechanism/mapping only, never the score/band/framing');
  }

  // ---------- Test 6: classifyCandidate short-circuits on Stage A fail ----------
  {
    let calls = 0;
    const judge = function () { calls += 1; return { a: true, b: true, c: true, d: true, e: true, f: true }; };
    const r = await critic.classifyCandidate(
      { text: 'A Molecular Casino with a $2-5B exit is imminent.', mechanismText: 'A generic scalable synergy play.', sourceDomainTag: 'finance', targetDomainTag: 'computing' },
      { judgeFn: judge, encodeFn: distinctEncode }
    );
    assert.strictEqual(calls, 0, 'Test 6: judge never invoked when Stage A rejects');
    assert.strictEqual(r.stage, 'A', 'Test 6: stage A');
    assert.strictEqual(r.verdict, 'pseudoscience', 'Test 6: fabricated-quantity routes pseudoscience');
    assert.strictEqual(r.rubric_pattern, 'xxxxxx', "Test 6: rubric_pattern is the 'xxxxxx' judge-never-reached sentinel");
    ok('Test 6: classifyCandidate short-circuits Stage A with judge call-count 0');
  }

  // ---------- Test 7: criticRule with a KNOWN bucket -> coarse confidence ----------
  {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'critic-baseline-'));
    const fixture = path.join(dir, 'baseline.json');
    fs.writeFileSync(fixture, JSON.stringify({
      schema_version: 1,
      status: 'calibrated',
      embedding_model: 'MongoDB/mdbr-leaf-ir',
      rubric_version: 1,
      buckets: { '111111': { n: 10, correct: 10, verdict_observed: 'transferable' } },
    }), 'utf8');
    try {
      const r = critic.criticRule(makePayload({ rubric_pattern: '111111' }), { baselinePath: fixture });
      assert.strictEqual(r.verdict, 'transferable', 'Test 7: verdict recomputed from the pattern');
      assert.strictEqual(typeof r.confidence, 'string', 'Test 7: confidence is a COARSE string, never a float');
      assert.ok(['low', 'medium', 'high'].indexOf(r.confidence) !== -1, 'Test 7: confidence in the coarse band set');
      assert.strictEqual(r.confidence, 'high', 'Test 7: a 10/10 bucket bands to high');
      assert.strictEqual(typeof r.reasoning_tag, 'string', 'Test 7: reasoning_tag present');
      ok('Test 7: criticRule returns calibration-derived coarse confidence for a known bucket');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  // ---------- Test 8: unseen rubric_pattern -> confidence 'unknown' + human review ----------
  {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'critic-baseline-'));
    const fixture = path.join(dir, 'baseline.json');
    fs.writeFileSync(fixture, JSON.stringify({
      schema_version: 1,
      status: 'calibrated',
      embedding_model: 'MongoDB/mdbr-leaf-ir',
      rubric_version: 1,
      buckets: { '111111': { n: 10, correct: 9, verdict_observed: 'transferable' } },
    }), 'utf8');
    try {
      const r = critic.criticRule(makePayload({ rubric_pattern: '101011' }), { baselinePath: fixture });
      assert.strictEqual(r.confidence, 'unknown', "Test 8: unseen pattern -> confidence 'unknown'");
      assert.strictEqual(r.reasoning_tag, 'calibration_unknown', 'Test 8: routes to human review');
      ok('Test 8: an unseen rubric pattern returns unknown/calibration_unknown');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  // ---------- Test 9: closed-key discipline + no cwd/roomDir reads ----------
  {
    assert.throws(function () {
      critic.criticRule(makePayload({ smuggled_field: 'oops' }));
    }, /TypeError|unknown payload key/i, 'Test 9: an unknown payload key is rejected');

    assert.throws(function () {
      critic.criticRule(makePayload({ source_domain_tag: 'not-a-real-domain' }));
    }, /TypeError|closed enum/i, 'Test 9: an off-enum domain tag is rejected');

    assert.throws(function () {
      critic.criticRule(makePayload({ surprise_type: 'hype' }));
    }, /TypeError|closed enum/i, 'Test 9: an off-enum surprise_type is rejected');

    // Static source guarantee: the ruling never reaches for cwd or a roomDir closure.
    const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'core', 'eureka-critic.cjs'), 'utf8');
    assert.ok(src.indexOf('process.cwd') === -1, 'Test 9: no process.cwd() anywhere in the critic core');
    assert.ok(src.indexOf('roomDir') === -1, 'Test 9: no roomDir coupling anywhere in the critic core');
    ok('Test 9: criticRule enforces the closed-key discipline and stays cwd/roomDir-free');
  }

  // ---------- Test 10: schema_version mismatch -> confidence 'unknown' ----------
  {
    const r = critic.criticRule(makePayload({ schema_version: 999 }));
    assert.strictEqual(r.confidence, 'unknown', 'Test 10: a stale schema_version returns unknown');
    ok('Test 10: a payload schema_version that mismatches the tags file returns unknown');
  }

  console.log('\n' + passed + ' passed');
}

run().catch(function fail(err) {
  console.error('FAIL:', err && err.message);
  process.exit(1);
});
