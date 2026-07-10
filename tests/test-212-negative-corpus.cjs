#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 212-02 Task 3 -- the D6 negative-corpus ACCEPTANCE test: the minimum
 * shipping bar. The three confirmed-junk generator outputs already ON RECORD in
 * SEED-050 must NEVER be blessed as transferable or restatement.
 *
 *   1. "Molecular Casino ... $2-5B exit"  (differential metadata, unsourced figure)
 *        -> pseudoscience via the fabricated-quantity gate; judgeFn call-count 0.
 *   2. "tahini x blockchain" 0.825        (survives a domain-noun swap)
 *        -> general_shallow via domain_swap_invariant (crafted noun-stripping stub
 *           encoder makes noun swaps produce ~zero embedding shift); call-count 0.
 *   3. "wind turbines as living weather algorithms" 0.985  (unfalsifiable metaphor)
 *        -> if it survives Stage A, the honest-generic judge (no checkable
 *           consequence, no one-to-one mapping) forces pseudoscience by code.
 *
 * These are synthetic/recorded generator outputs (SEED-050), NOT room content.
 * Zero network, zero model load: every embedding is a crafted stub encodeFn and
 * every judge is a stub judgeFn. The suite exits non-zero if ANY junk candidate
 * is classified transferable or restatement.
 */
'use strict';

const assert = require('node:assert');
const critic = require('../lib/core/eureka-critic.cjs');

let passed = 0;
function ok(name) { passed += 1; console.log('  ok   ' + name); }

const REJECT_SET = ['pseudoscience', 'general_shallow'];

// distinctEncode: near-orthogonal vector per unique string -> noun swaps move the
// embedding far (a REAL mechanism's signature). Used where we want Stage A to pass.
function distinctEncode(texts) {
  return texts.map(function (t) {
    let h = 2166136261 >>> 0;
    const s = String(t == null ? '' : t);
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return [(h & 255) - 128, ((h >>> 8) & 255) - 128, ((h >>> 16) & 255) - 128, ((h >>> 24) & 255) - 128];
  });
}

// nounStripEncode: the crafted "content-ignoring" embedder. It drops every token
// of length >= 4 (the same length gate nounSwap perturbs) BEFORE hashing, so the
// original mechanism and all of its noun-swapped variants collapse to the SAME
// skeleton -> embedding shift ~0 -> the domain_swap_invariant signature. This is
// exactly the "swap the nouns, text unchanged = generic filler" failure made
// mechanical (SEED-050).
function nounStripEncode(texts) {
  return texts.map(function (t) {
    const stripped = String(t == null ? '' : t)
      .split(/\s+/)
      .filter(function (tok) { return tok.replace(/[^A-Za-z]/g, '').length < 4; })
      .join(' ');
    let h = 2166136261 >>> 0;
    for (let i = 0; i < stripped.length; i += 1) {
      h ^= stripped.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return [(h & 255) - 128, ((h >>> 8) & 255) - 128, ((h >>> 16) & 255) - 128, ((h >>> 24) & 255) - 128];
  });
}

async function run() {
  // ---------- Candidate 1: Molecular Casino, $2-5B exit ----------
  {
    let calls = 0;
    const judge = function () { calls += 1; return { a: true, b: true, c: true, d: true, e: true, f: true }; };
    const candidate = {
      text: 'Molecular Casino: a self-assembling drug-discovery platform with a $2-5B exit.',
      mechanismText: 'A generic high-throughput synergy play that scales to a billion outcomes.',
      differential_score: 0.90,
      sourceDomainTag: 'finance',
      targetDomainTag: 'medicine',
    };
    const r = await critic.classifyCandidate(candidate, { judgeFn: judge, encodeFn: distinctEncode });
    assert.strictEqual(calls, 0, 'Casino: fabricated-quantity gate precedes any judge call');
    assert.strictEqual(r.verdict, 'pseudoscience', 'Casino: routes pseudoscience via the unsourced-figure gate');
    assert.notStrictEqual(r.verdict, 'transferable', 'Casino: NEVER transferable');
    assert.ok(REJECT_SET.indexOf(r.verdict) !== -1, 'Casino: verdict in the reject set');
    console.log('  candidate 1 "Molecular Casino $2-5B" -> ' + r.verdict + ' / ' + r.reasoning_tag);
    ok('Candidate 1 (Molecular Casino $2-5B exit) rejected as pseudoscience, judge call-count 0');
  }

  // ---------- Candidate 2: tahini x blockchain, 0.825 ----------
  {
    let calls = 0;
    const judge = function () { calls += 1; return { a: true, b: true, c: true, d: true, e: true, f: true }; };
    const candidate = {
      text: 'Tahini manufacturing shares a trustless distributed-ledger structure with blockchain.',
      mechanismText: 'Sesame grinding batches propagate through nodes exactly as blockchain transactions settle.',
      differential_score: 0.825,
      sourceDomainTag: 'food',
      targetDomainTag: 'computing',
    };
    const r = await critic.classifyCandidate(candidate, { judgeFn: judge, encodeFn: nounStripEncode, knnFn: function () { return [{ similarity: 0.20 }]; } });
    assert.strictEqual(calls, 0, 'tahini: domain-swap gate precedes any judge call');
    assert.strictEqual(r.verdict, 'general_shallow', 'tahini: routes general_shallow via domain_swap_invariant');
    assert.strictEqual(r.reasoning_tag, 'domain_swap_invariant', 'tahini: the swap-invariance signature');
    assert.notStrictEqual(r.verdict, 'transferable', 'tahini: NEVER transferable');
    assert.ok(REJECT_SET.indexOf(r.verdict) !== -1, 'tahini: verdict in the reject set');
    console.log('  candidate 2 "tahini x blockchain 0.825" -> ' + r.verdict + ' / ' + r.reasoning_tag);
    ok('Candidate 2 (tahini x blockchain 0.825) rejected as general_shallow via domain_swap_invariant');
  }

  // ---------- Candidate 3: wind turbines as living weather algorithms, 0.985 ----------
  {
    // Crafted to SURVIVE Stage A (distinct embeddings, entity-rich mechanism, novel
    // vs the graph) so the RUBRIC has to earn the rejection. The honest-generic judge
    // answers c=false (no checkable consequence) and b=false (no one-to-one mapping),
    // which verdictFromRubric maps to pseudoscience -- never transferable.
    const judge = function () { return { a: false, b: false, c: false, d: true, e: true, f: true }; };
    const candidate = {
      text: 'Wind turbines behave as living weather algorithms that think.',
      mechanismText: 'Wind turbines convert Kinetic airflow into Electrical current through a Faraday induction rotor.',
      mappingStatement: 'A spinning rotor is metaphorically a living mind reading the weather.',
      differential_score: 0.985,
      sourceDomainTag: 'energy',
      targetDomainTag: 'biology',
    };
    const r = await critic.classifyCandidate(candidate, { judgeFn: judge, encodeFn: distinctEncode, knnFn: function () { return [{ similarity: 0.30 }]; } });
    assert.notStrictEqual(r.verdict, 'transferable', 'turbines: NEVER transferable');
    assert.notStrictEqual(r.verdict, 'restatement', 'turbines: not a restatement either');
    assert.ok(REJECT_SET.indexOf(r.verdict) !== -1, 'turbines: verdict in the reject set {pseudoscience, general_shallow}');
    console.log('  candidate 3 "wind turbines as living weather algorithms 0.985" -> ' + r.verdict + ' / ' + r.reasoning_tag + ' (stage ' + r.stage + ')');
    ok('Candidate 3 (wind turbines living weather 0.985) rejected, never transferable');
  }

  console.log('\nD6 shipping bar: all three recorded junk outputs rejected.');
  console.log(passed + ' passed');
}

run().catch(function fail(err) {
  console.error('FAIL:', err && err.message);
  process.exit(1);
});
