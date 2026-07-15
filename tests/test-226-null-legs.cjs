#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 226-01 -- the D1 null-legs regression guard (written FIRST, Wave 0).
 *
 * WHAT THIS IS (and why it is the phase's single highest-stakes test)
 *   REQ-1 / D1 / G-1, the fabricated-number prohibition. A reasoning-mode result
 *   runs with the embedding encoder ABSENT, so 2 of the critic's 3 numeric legs
 *   (differential_score, semantic_similarity) are structurally unavailable. Only
 *   the free Jaccard lexical anchor (lsa_similarity, jaccard-v1, [0,1]) may carry
 *   a real number. A reasoning result that reports a differential number is lying
 *   about its evidentiary base. This is a DETERMINISTIC code assertion, never a
 *   judge call: a judge can be wrong, an assertion on a null field cannot.
 *
 *   This test is authored BEFORE lib/core/eureka/reasoning-mode.cjs exists, so it
 *   provably FAILS on the require (RED). Once the module lands (Task 2/3) it turns
 *   green. Do not weaken these assertions to make it pass; fix the module.
 *
 * Standalone: node tests/test-226-null-legs.cjs (exit non-zero on any failure).
 * node:assert strict, offline, node built-ins + in-repo requires only.
 * No em-dashes.
 */
'use strict';

const assert = require('node:assert');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
// The module under test. This require THROWS (Cannot find module ... reasoning-mode)
// until Task 2 creates it -- that is the intended RED state of this Wave 0 scaffold.
const rm = require(path.join(REPO_ROOT, 'lib', 'core', 'eureka', 'reasoning-mode.cjs'));
const { lexicalOverlap, LEXICAL_METHOD } = require(path.join(REPO_ROOT, 'lib', 'core', 'eureka', 'lexical-overlap.cjs'));
const { FIXTURE_PAIRS } = require(path.join(REPO_ROOT, 'tests', 'fixtures', '226-reasoning-pairs.cjs'));

// Turn a fixture into the validCandidate shape scoreReasoningPairs consumes
// (the proposeCandidatePairs -> validateMappings output shape). The two texts
// feed the real Jaccard anchor so lsa_similarity is a genuine [0,1] number.
function fixtureToCandidate(f) {
  return {
    id: f.id,
    a: f.id + '-A',
    b: f.id + '-B',
    section_a: 'domain-a',
    section_b: 'domain-b',
    title_a: f.id + ' side A',
    title_b: f.id + ' side B',
    lsa_similarity: lexicalOverlap(f.textA, f.textB),
    lexical_method: LEXICAL_METHOD,
    text_a: f.textA,
    text_b: f.textB,
    mechanismText: f.mechanismText,
    mappingStatement: f.mappingStatement,
  };
}

function buildAnswers() {
  const answers = {};
  for (let i = 0; i < FIXTURE_PAIRS.length; i += 1) {
    const f = FIXTURE_PAIRS[i];
    answers[f.id] = { neutral: f.neutral, adversarial: f.adversarial };
  }
  return answers;
}

// Assert the D1 invariants on ONE emitted statement / ranked row.
function assertNullLegs(x, label) {
  assert.strictEqual(x.differential_score, null, label + ': differential_score must be null (no encoder ran)');
  assert.strictEqual(x.semantic_similarity, null, label + ': semantic_similarity must be null (no encoder ran)');
  assert.ok(
    typeof x.lsa_similarity === 'number' && x.lsa_similarity >= 0 && x.lsa_similarity <= 1,
    label + ': lsa_similarity must be a real [0,1] number (got ' + JSON.stringify(x.lsa_similarity) + ')'
  );
  assert.strictEqual(x.lexical_method, 'jaccard-v1', label + ': lexical_method must be jaccard-v1');
  assert.strictEqual(x.banked, false, label + ': banked must be literal false (Canon Part 9, G-3)');
  assert.strictEqual(x.mode, 'reasoning', label + ": mode must be 'reasoning'");
}

async function main() {
  assert.ok(Array.isArray(FIXTURE_PAIRS) && FIXTURE_PAIRS.length >= 12,
    'fixture set must carry >= 12 pairs (got ' + (FIXTURE_PAIRS ? FIXTURE_PAIRS.length : 'none') + ')');

  const validCandidates = FIXTURE_PAIRS.map(fixtureToCandidate);
  const answers = buildAnswers();

  // Drive the real scoring path over EVERY fixture pair.
  const rows = await rm.scoreReasoningPairs(validCandidates, answers, {});
  assert.strictEqual(rows.length, FIXTURE_PAIRS.length, 'one scored row per fixture');

  // Build a statement for EVERY row (transferable and rejected alike): the null
  // legs and banked:false are unconditional in buildReasoningStatement.
  const statements = rows.map(function (r, i) { return rm.buildReasoningStatement(r, i + 1); });

  // The ranked list is transferable rows only, ascending by lsa_similarity.
  const ranked = rows
    .filter(function (r) { return r.verdict === 'transferable'; })
    .slice()
    .sort(function (x, y) { return x.lsa_similarity - y.lsa_similarity; })
    .map(function (r, i) { return rm.buildReasoningStatement(r, i + 1); });

  assert.ok(ranked.length >= 3, 'at least the >= 3 critical-path fixtures rank transferable (got ' + ranked.length + ')');

  for (let i = 0; i < statements.length; i += 1) {
    assertNullLegs(statements[i], 'statement[' + i + '] (' + rows[i].id + ')');
  }
  for (let i = 0; i < ranked.length; i += 1) {
    assertNullLegs(ranked[i], 'ranked[' + i + ']');
  }

  // assertReasoningInvariants: returns cleanly on the unmutated result...
  const result = { statements: statements, ranked: ranked, provenance: { run_mode: 'reasoning' } };
  assert.doesNotThrow(function () { rm.assertReasoningInvariants(result); },
    'assertReasoningInvariants must pass on a clean reasoning result');

  // ...THROWS when a differential_score is mutated to a real number (G-1 refuse-to-emit).
  const mutatedDiff = JSON.parse(JSON.stringify(result));
  mutatedDiff.statements[0].differential_score = 0.42;
  assert.throws(function () { rm.assertReasoningInvariants(mutatedDiff); },
    'assertReasoningInvariants must THROW when a differential_score is non-null (G-1)');

  // ...THROWS when banked is flipped true (G-3 auto-confirmation guard).
  const mutatedBank = JSON.parse(JSON.stringify(result));
  mutatedBank.statements[0].banked = true;
  assert.throws(function () { rm.assertReasoningInvariants(mutatedBank); },
    'assertReasoningInvariants must THROW when banked is true (G-3)');

  process.stdout.write('test-226-null-legs: PASS (' + statements.length + ' statements, '
    + ranked.length + ' ranked, D1 null legs + G-1/G-3 guards held)\n');
}

main().then(function () { process.exit(0); }, function (err) {
  process.stderr.write('test-226-null-legs: FAIL\n' + String(err && err.stack ? err.stack : err) + '\n');
  process.exit(1);
});
