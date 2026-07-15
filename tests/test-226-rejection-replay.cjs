#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 226-04 -- D3 NEGATIVE-CORPUS REPLAY on the encoder-free path (REQ-2).
 *
 * WHY THIS TEST EXISTS (the failure it forbids)
 *   The critic bar must NOT be relaxed just because the encoder is absent. The
 *   three confirmed-junk classes on record from the Phase 212 negative corpus
 *   (SEED-050) must STAY rejected when driven through reasoning-mode's own
 *   scoreReasoningPairs - proof the analogy bar held at parity and the lower
 *   confidence label comes ONLY from the missing similarity/calibration legs, never
 *   a slacker rubric.
 *
 *   The three classes (byte-copied exemplars from tests/test-212-negative-corpus.cjs,
 *   with attribution - that module does not export them):
 *     1. "Molecular Casino ... $2-5B exit"  -> pseudoscience via the encoder-free
 *        Gate 1 (fabricated-quantity), with ZERO judgeFn calls (Stage A killed it
 *        before any prompt existed - the one gate that survives without the encoder).
 *     2. "tahini x blockchain"              -> general_shallow. In reasoning mode the
 *        embedding domain-swap gate is structurally SKIPPED (no encoder), so the
 *        rejection is EARNED by the rubric from the class's failing items (generic,
 *        no one-to-one mapping) - the bar still rejects it.
 *     3. "wind turbines as living weather algorithms" -> pseudoscience. Survives
 *        Stage A, then the honest-generic rubric answer (no checkable consequence)
 *        forces pseudoscience by code, exactly as in the embedded 212 leg.
 *
 *   None of the three reaches ranked (the ranked filter admits only 'transferable').
 *
 * Zero network, zero model load: the encoder is never touched on this path. Runs
 * under the aggregator NODE_OPTIONS=--require tests/eureka-offline-preload.cjs
 * guard. Standalone: node tests/test-226-rejection-replay.cjs. node:assert strict,
 * node built-ins + in-repo requires only. No em-dashes.
 */

const assert = require('node:assert');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const reasoningMode = require(path.join(REPO_ROOT, 'lib', 'core', 'eureka', 'reasoning-mode.cjs'));

const REJECT_SET = ['pseudoscience', 'general_shallow', 'restatement'];

// A full six-item rubric answer, every item the same value then overridden. The
// coerceBool-compatible 'yes'/'no' string form the real parseRubricResponse takes.
function allYes(overrides) {
  const base = { a: 'yes', b: 'yes', c: 'yes', d: 'yes', e: 'yes', f: 'yes' };
  return Object.assign(base, overrides || {});
}

async function main() {
  // -- Class 1: Molecular Casino, $2-5B exit (byte-copied exemplar, 212 corpus). --
  // The unsourced $-figure lives in the mappingStatement so the encoder-free Gate 1
  // (critic._gate1 DOLLAR_FIGURE) trips before any prompt is built. A counting
  // judgeFn proves ZERO judge calls: Stage A killed it.
  let casinoJudgeCalls = 0;
  const casino = {
    id: 'NEG-casino',
    mechanismText: 'A generic high-throughput synergy play that scales to a billion outcomes.',
    mappingStatement: 'Molecular casino self-assembly maps to a drug-discovery platform with a $2-5B exit.',
    lsa_similarity: 0.1,
  };
  const casinoAnswers = {
    'NEG-casino': { judgeFn: function () { casinoJudgeCalls += 1; return allYes(); } },
  };
  const casinoRows = await reasoningMode.scoreReasoningPairs([casino], casinoAnswers, {});
  assert.strictEqual(casinoRows.length, 1, 'casino: one row scored');
  assert.strictEqual(casinoRows[0].verdict, 'pseudoscience',
    'casino: routes pseudoscience via the encoder-free Gate 1 fabricated-quantity gate');
  assert.strictEqual(casinoRows[0].reasoning_tag, 'unsourced_quantity', 'casino: unsourced_quantity tag');
  assert.strictEqual(casinoRows[0].stage_a_pass, false, 'casino: Stage A did not pass (Gate 1 tripped)');
  assert.strictEqual(casinoJudgeCalls, 0,
    'casino: ZERO judgeFn calls - Gate 1 killed it before any prompt existed (got ' + casinoJudgeCalls + ')');

  // -- Class 2: tahini x blockchain (byte-copied exemplar). Encoder swap-gate is --
  // structurally absent here; the rubric EARNS the rejection from the failing items
  // (generic, no one-to-one mapping): a=no, b=no -> general_shallow by code.
  const tahini = {
    id: 'NEG-tahini',
    mechanismText: 'Sesame grinding batches propagate through nodes exactly as blockchain transactions settle.',
    mappingStatement: 'Tahini manufacturing shares a trustless distributed-ledger structure with blockchain.',
    lsa_similarity: 0.2,
  };
  const tahiniAnswers = {
    'NEG-tahini': { neutral: allYes({ a: 'no', b: 'no' }), adversarial: allYes({ a: 'no', b: 'no' }) },
  };
  const tahiniRows = await reasoningMode.scoreReasoningPairs([tahini], tahiniAnswers, {});
  assert.strictEqual(tahiniRows[0].verdict, 'general_shallow',
    'tahini: the encoder-free rubric earns general_shallow from the failing items');
  assert.notStrictEqual(tahiniRows[0].verdict, 'transferable', 'tahini: NEVER transferable');
  assert.ok(REJECT_SET.indexOf(tahiniRows[0].verdict) !== -1, 'tahini: verdict in the reject set');

  // -- Class 3: wind turbines as living weather algorithms (byte-copied exemplar). --
  // Passes Stage A; the honest-generic answer (c=no, no checkable consequence)
  // forces pseudoscience by code, mirroring the embedded 212 leg.
  const turbines = {
    id: 'NEG-turbines',
    mechanismText: 'Wind turbines convert kinetic airflow into electrical current through a Faraday induction rotor.',
    mappingStatement: 'A spinning rotor is metaphorically a living mind reading the weather.',
    lsa_similarity: 0.15,
  };
  const turbineAnswers = {
    'NEG-turbines': { neutral: allYes({ c: 'no' }), adversarial: allYes({ c: 'no' }) },
  };
  const turbineRows = await reasoningMode.scoreReasoningPairs([turbines], turbineAnswers, {});
  assert.strictEqual(turbineRows[0].verdict, 'pseudoscience',
    'turbines: the honest-generic rubric forces pseudoscience (no checkable consequence)');
  assert.strictEqual(turbineRows[0].stage_a_pass, true, 'turbines: passed Stage A, rejection earned by the rubric');
  assert.notStrictEqual(turbineRows[0].verdict, 'transferable', 'turbines: NEVER transferable');

  // -- NONE of the three reaches ranked: the ranked filter admits only 'transferable'. --
  const allRows = casinoRows.concat(tahiniRows, turbineRows);
  const transferable = allRows.filter(function (r) { return r.verdict === 'transferable'; });
  assert.strictEqual(transferable.length, 0,
    'no junk class reaches ranked (the transferable-only filter excludes all three encoder-free)');
  for (let i = 0; i < allRows.length; i += 1) {
    assert.ok(REJECT_SET.indexOf(allRows[i].verdict) !== -1,
      'row ' + allRows[i].id + " verdict '" + allRows[i].verdict + "' stays in the reject set");
  }

  process.stdout.write('test-226-rejection-replay: PASS (casino->pseudoscience 0 judge calls, '
    + 'tahini->general_shallow earned by rubric, turbines->pseudoscience; 0 of 3 reach ranked)\n');
}

main().then(function () { process.exit(0); }, function (err) {
  process.stderr.write('test-226-rejection-replay: FAIL\n' + String(err && err.stack ? err.stack : err) + '\n');
  process.exit(1);
});
