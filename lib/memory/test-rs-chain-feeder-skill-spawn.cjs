#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.4 Plan 03 -- rs-chain-feeder skill-spawn rule table fixture suite.
 *
 * 11 scenarios covering the Wave-3 skill-spawn rule table per kickoff
 * section 6.4 (LOCKED deterministic 5-rule table). Tests are Plan-89.4-03
 * RED-then-GREEN: written against the swapped recommendSkillSpawn body and
 * SKILL_SPAWN_RULES Object.freeze export. Plan 89.4-02 stub MUST fail
 * Tests 1-5 + Test 7 + Test 9 + Test 11 because the stub returns
 * spawn_skill: null for every input.
 *
 *   Test 1 (Rule 1 positive): recommendSkillSpawn(structural_transfer, 8, {})
 *           returns {spawn_skill: /mos:find-analogies, confidence: 0.85,
 *           reasoning includes SAPPhIRE}.
 *
 *   Test 2 (Rule 2 positive): recommendSkillSpawn(semantic_implementation,
 *           7, {industry_signals_count: 3}) returns {spawn_skill:
 *           /mos:lean-canvas, confidence: 0.80, reasoning includes
 *           market signal}.
 *
 *   Test 3 (Rule 3 positive): recommendSkillSpawn(hybrid, 6,
 *           {cross_methodology_substrates: [JTBD, Causal Loop]}) returns
 *           {spawn_skill: /mos:pipeline, confidence: 0.75, reasoning
 *           includes cross-methodology}.
 *
 *   Test 4 (Rule 4 positive): recommendSkillSpawn(semantic_implementation,
 *           5, {resolved_experts_count: 10, resolved_institutions_count: 3})
 *           returns {spawn_skill: /mos:persona, confidence: 0.70,
 *           reasoning includes expert network}.
 *
 *   Test 5 (Rule 5 positive): recommendSkillSpawn(semantic_implementation,
 *           2, {cynefin: complex}) returns {spawn_skill: /mos:think-hats,
 *           confidence: 0.65, reasoning includes perspective diversity}.
 *
 *   Test 6 (no-match fallback): recommendSkillSpawn(semantic_implementation,
 *           5, {}) returns {spawn_skill: null, confidence: 0, reasoning:
 *           no rule matched}.
 *
 *   Test 7 (first-match-wins): recommendSkillSpawn(structural_transfer, 8,
 *           {industry_signals_count: 3, cross_methodology_substrates:
 *           [A, B]}) returns Rule 1 (find-analogies) NOT Rule 2 NOT Rule 3.
 *
 *   Test 8 (Canon Part 8 adversarial): opts.contact carrying an email
 *           string throws ExternalEgressViolation with
 *           err.meta.surface === rs-chain-feeder-recommend-skill-spawn.
 *
 *   Test 9 (integration smoke): emitChainMetadata(structural_transfer, 8,
 *           {}) returns object with spawn_skill === /mos:find-analogies,
 *           confidence: 0.85, recommended_verb: Bank Opportunity,
 *           feeds_into: PWS VP.
 *
 *   Test 10 (regression): emitChainMetadata(structural_transfer, 3, {})
 *           returns spawn_skill === null (no rule matches; Rule 5 needs
 *           cynefin) + recommended_verb === Reformulate (score < 5).
 *
 *   Test 11 (frozen rule table): SKILL_SPAWN_RULES is exported as an
 *           array; Array.isArray true; length 5; Object.isFrozen true;
 *           each rule entry is also frozen.
 *
 * Pure CJS, zero npm deps, node built-ins only (assert).
 */

const assert = require('node:assert/strict');

// ---------- Suite bookkeeping ----------

let passed = 0;
let failed = 0;
const failures = [];
const tests = [];

function record(name, fn) {
  tests.push({ name, fn });
}

async function runAll() {
  for (const t of tests) {
    try {
      const maybe = t.fn();
      if (maybe && typeof maybe.then === 'function') await maybe;
      passed++;
      process.stdout.write('PASS ' + t.name + '\n');
    } catch (err) {
      failed++;
      failures.push({ name: t.name, message: err && err.message ? err.message : String(err) });
      process.stdout.write('FAIL ' + t.name + ': ' + (err && err.message ? err.message : String(err)) + '\n');
    }
  }
}

// ---------- Module under test ----------

const mod = require('../core/rs-chain-feeder.cjs');
const {
  recommendSkillSpawn,
  emitChainMetadata,
  SKILL_SPAWN_RULES,
} = mod;

// ---------- Tests ----------

// Test 1: Rule 1 positive -- structural_transfer + score 8
record('T1 Rule 1 -- structural_transfer + score 8 -> /mos:find-analogies (0.85)', function () {
  const result = recommendSkillSpawn('structural_transfer', 8, {});
  assert.ok(result && typeof result === 'object', 'expected object return');
  assert.equal(result.spawn_skill, '/mos:find-analogies',
    'expected /mos:find-analogies, got ' + JSON.stringify(result.spawn_skill));
  assert.equal(result.confidence, 0.85,
    'expected confidence 0.85, got ' + result.confidence);
  assert.ok(typeof result.reasoning === 'string' && result.reasoning.length > 0,
    'reasoning must be non-empty string');
  assert.ok(result.reasoning.indexOf('SAPPhIRE') !== -1 || result.reasoning.indexOf('TRIZ') !== -1
    || result.reasoning.indexOf('structural') !== -1,
    'reasoning should reference SAPPhIRE / TRIZ / structural; got ' + JSON.stringify(result.reasoning));
});

// Test 2: Rule 2 positive -- score 7 + industry signals
record('T2 Rule 2 -- score 7 + industry_signals_count 3 -> /mos:lean-canvas (0.80)', function () {
  const result = recommendSkillSpawn('semantic_implementation', 7, { industry_signals_count: 3 });
  assert.equal(result.spawn_skill, '/mos:lean-canvas',
    'expected /mos:lean-canvas, got ' + JSON.stringify(result.spawn_skill));
  assert.equal(result.confidence, 0.80,
    'expected confidence 0.80, got ' + result.confidence);
  assert.ok(result.reasoning.indexOf('market signal') !== -1
    || result.reasoning.indexOf('business model') !== -1,
    'reasoning should reference market signal / business model; got ' + JSON.stringify(result.reasoning));
});

// Test 3: Rule 3 positive -- cross-methodology substrates
record('T3 Rule 3 -- cross_methodology_substrates length > 1 -> /mos:pipeline (0.75)', function () {
  const result = recommendSkillSpawn('hybrid', 6, {
    cross_methodology_substrates: ['JTBD', 'Causal Loop'],
  });
  assert.equal(result.spawn_skill, '/mos:pipeline',
    'expected /mos:pipeline, got ' + JSON.stringify(result.spawn_skill));
  assert.equal(result.confidence, 0.75,
    'expected confidence 0.75, got ' + result.confidence);
  assert.ok(result.reasoning.indexOf('cross-methodology') !== -1
    || result.reasoning.indexOf('chained pipeline') !== -1,
    'reasoning should reference cross-methodology / chained pipeline; got '
    + JSON.stringify(result.reasoning));
});

// Test 4: Rule 4 positive -- expert network dense
record('T4 Rule 4 -- experts > 5 + institutions > 1 -> /mos:persona (0.70)', function () {
  const result = recommendSkillSpawn('semantic_implementation', 5, {
    resolved_experts_count: 10,
    resolved_institutions_count: 3,
  });
  assert.equal(result.spawn_skill, '/mos:persona',
    'expected /mos:persona, got ' + JSON.stringify(result.spawn_skill));
  assert.equal(result.confidence, 0.70,
    'expected confidence 0.70, got ' + result.confidence);
  assert.ok(result.reasoning.indexOf('expert network') !== -1
    || result.reasoning.indexOf('team composition') !== -1,
    'reasoning should reference expert network / team composition; got '
    + JSON.stringify(result.reasoning));
});

// Test 5: Rule 5 positive -- low breakthrough + Cynefin complex
record('T5 Rule 5 -- score 2 + cynefin complex -> /mos:think-hats (0.65)', function () {
  const result = recommendSkillSpawn('semantic_implementation', 2, { cynefin: 'complex' });
  assert.equal(result.spawn_skill, '/mos:think-hats',
    'expected /mos:think-hats, got ' + JSON.stringify(result.spawn_skill));
  assert.equal(result.confidence, 0.65,
    'expected confidence 0.65, got ' + result.confidence);
  assert.ok(result.reasoning.indexOf('perspective diversity') !== -1
    || result.reasoning.indexOf('Cynefin') !== -1,
    'reasoning should reference perspective diversity / Cynefin; got '
    + JSON.stringify(result.reasoning));
});

// Test 6: no-match fallback
record('T6 no-match -- score 5 + empty opts -> {spawn_skill: null, confidence: 0, reasoning: no rule matched}', function () {
  const result = recommendSkillSpawn('semantic_implementation', 5, {});
  assert.equal(result.spawn_skill, null,
    'expected null spawn_skill, got ' + JSON.stringify(result.spawn_skill));
  assert.equal(result.confidence, 0,
    'expected confidence 0, got ' + result.confidence);
  assert.equal(result.reasoning, 'no rule matched',
    'expected reasoning "no rule matched", got ' + JSON.stringify(result.reasoning));
});

// Test 7: first-match-wins -- Rule 1 wins over Rule 2 + Rule 3
record('T7 first-match-wins -- Rule 1 inputs + Rule 2 + Rule 3 inputs -> Rule 1 wins (find-analogies)', function () {
  const result = recommendSkillSpawn('structural_transfer', 8, {
    industry_signals_count: 3,
    cross_methodology_substrates: ['A', 'B'],
  });
  assert.equal(result.spawn_skill, '/mos:find-analogies',
    'first-match-wins violated: expected /mos:find-analogies (Rule 1), got '
    + JSON.stringify(result.spawn_skill));
  assert.equal(result.confidence, 0.85,
    'expected Rule 1 confidence 0.85, got ' + result.confidence);
});

// Test 8: Canon Part 8 adversarial -- email in opts
record('T8 Canon Part 8 adversarial -- opts.contact carries email -> ExternalEgressViolation', function () {
  let caught = null;
  try {
    recommendSkillSpawn('structural_transfer', 8, {
      industry_signals_count: 3,
      contact: 'john@acme.com',
    });
  } catch (e) {
    caught = e;
  }
  assert.ok(caught !== null, 'expected throw');
  assert.equal(caught.name, 'ExternalEgressViolation',
    'expected ExternalEgressViolation, got ' + caught.name);
  assert.equal(caught.meta.surface, 'rs-chain-feeder-recommend-skill-spawn',
    'expected meta.surface rs-chain-feeder-recommend-skill-spawn, got '
    + caught.meta.surface);
});

// Test 9: integration smoke -- rule propagates through emitChainMetadata
record('T9 integration smoke -- emitChainMetadata(structural_transfer, 8) carries Rule 1 fields', function () {
  const block = emitChainMetadata('structural_transfer', 8, {});
  assert.equal(block.spawn_skill, '/mos:find-analogies',
    'expected spawn_skill /mos:find-analogies in chain metadata, got '
    + JSON.stringify(block.spawn_skill));
  assert.equal(block.confidence, 0.85,
    'expected confidence 0.85 in chain metadata, got ' + block.confidence);
  assert.equal(block.recommended_verb, 'Bank Opportunity',
    'expected recommended_verb Bank Opportunity, got '
    + JSON.stringify(block.recommended_verb));
  assert.equal(block.feeds_into, 'PWS VP',
    'expected feeds_into PWS VP, got ' + JSON.stringify(block.feeds_into));
  assert.ok(typeof block.reasoning === 'string' && block.reasoning.length > 0,
    'reasoning must be non-empty string in chain metadata');
});

// Test 10: regression -- score 3 + structural_transfer -> no rule matches
record('T10 regression -- emitChainMetadata(structural_transfer, 3) -> spawn_skill null + Reformulate verb', function () {
  const block = emitChainMetadata('structural_transfer', 3, {});
  assert.equal(block.spawn_skill, null,
    'expected null spawn_skill (no rule matches at score 3), got '
    + JSON.stringify(block.spawn_skill));
  assert.equal(block.recommended_verb, 'Reformulate',
    'expected recommended_verb Reformulate (score < 5), got '
    + JSON.stringify(block.recommended_verb));
  assert.equal(block.feeds_into, 'PWS VP',
    'expected feeds_into PWS VP (structural_transfer), got '
    + JSON.stringify(block.feeds_into));
  assert.equal(block.confidence, 0,
    'expected confidence 0 (no rule matched), got ' + block.confidence);
});

// Test 11: SKILL_SPAWN_RULES is frozen + exported with correct shape
record('T11 SKILL_SPAWN_RULES exported + frozen + length 5 + each entry frozen', function () {
  assert.ok(Array.isArray(SKILL_SPAWN_RULES),
    'SKILL_SPAWN_RULES must be an array, got ' + typeof SKILL_SPAWN_RULES);
  assert.equal(SKILL_SPAWN_RULES.length, 5,
    'expected 5 rules per kickoff section 6.4, got ' + SKILL_SPAWN_RULES.length);
  assert.equal(Object.isFrozen(SKILL_SPAWN_RULES), true,
    'SKILL_SPAWN_RULES must be Object.freeze\'d');
  for (let i = 0; i < SKILL_SPAWN_RULES.length; i++) {
    const rule = SKILL_SPAWN_RULES[i];
    assert.ok(rule && typeof rule === 'object',
      'rule ' + i + ' must be object');
    assert.equal(typeof rule.match, 'function',
      'rule ' + i + ' must have match() function');
    assert.equal(typeof rule.spawn, 'string',
      'rule ' + i + ' must have spawn string');
    assert.ok(rule.spawn.indexOf('/mos:') === 0,
      'rule ' + i + ' spawn must start with /mos:, got ' + rule.spawn);
    assert.equal(typeof rule.confidence, 'number',
      'rule ' + i + ' must have numeric confidence');
    assert.ok(rule.confidence > 0 && rule.confidence <= 1,
      'rule ' + i + ' confidence must be (0, 1], got ' + rule.confidence);
    assert.equal(typeof rule.reasoning, 'string',
      'rule ' + i + ' must have reasoning string');
    assert.equal(Object.isFrozen(rule), true,
      'rule ' + i + ' entry must also be Object.freeze\'d');
  }
});

// ---------- Suite report ----------

(async function main() {
  await runAll();
  const total = passed + failed;
  process.stdout.write('\n');
  if (failed === 0) {
    process.stdout.write('=== 89.4-03 rs-chain-feeder-skill-spawn suite: ' + passed + '/' + total + ' passed ===\n');
    process.exit(0);
  } else {
    process.stdout.write('=== 89.4-03 rs-chain-feeder-skill-spawn suite: ' + passed + '/' + total + ' passed (' + failed + ' failed) ===\n');
    for (const f of failures) {
      process.stdout.write('  FAIL ' + f.name + ': ' + f.message + '\n');
    }
    process.exit(1);
  }
})();
