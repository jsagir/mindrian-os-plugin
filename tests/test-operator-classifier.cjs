#!/usr/bin/env node
'use strict';

/**
 * Phase 99-02 -- conversation operator NL classifier test suite.
 * ==============================================================
 * Enforces the gates from RESEARCH.md "Validation Architecture":
 *   1. Corpus accuracy gate: >= 80% (>= 41/50 correct).
 *   2. Frame-budget gate: classify() mean latency < 8ms (5ms target + CI headroom)
 *      on a 200-character message, 1000 iterations.
 *   3. Tier-0 fallback: classifier never throws when classifier-rules.json is
 *      missing/corrupt; returns evidence with stratum='tier0'.
 *   4. Validate-cross-check: every non-null classifier output is operationally
 *      valid against operator.cjs.validate(currentState.current, candidate_op,
 *      suggested_trigger).
 *   5. Boundary conditions: empty input, /mos:operator (target_op:null),
 *      /mos:room beats /mos:[a-z-]+, AskUserQuestion -> DECISION_GATE.
 *
 * Sources hand-labeled corpus from
 *   test/fixtures/conversation-operator/classifier-corpus.json
 * per CONTEXT.md D-25 (Claude's discretion: synthetic Stitzlein onboarding +
 * Lawrence curriculum + Austin research).
 *
 * No new runtime deps. Node built-ins only (fs, path, child_process, assert).
 *
 * Exit code: 0 if all gates pass, 1 otherwise.
 *
 * License: BSL 1.1.
 */

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const CLASSIFIER_PATH = path.join(REPO_ROOT, 'lib', 'conversation', 'classifier.cjs');
const RULES_PATH = path.join(REPO_ROOT, 'lib', 'conversation', 'classifier-rules.json');
const CORPUS_PATH = path.join(
  REPO_ROOT,
  'test',
  'fixtures',
  'conversation-operator',
  'classifier-corpus.json'
);
const OPERATOR_PATH = path.join(REPO_ROOT, 'lib', 'conversation', 'operator.cjs');

let failures = 0;

function pass(label) {
  process.stdout.write('  PASS  ' + label + '\n');
}

function fail(label, detail) {
  failures += 1;
  process.stdout.write('  FAIL  ' + label + (detail ? ' :: ' + detail : '') + '\n');
}

// ----------------------------------------------------------------------------
// Test 1: corpus accuracy gate
// ----------------------------------------------------------------------------

function testCorpusAccuracy() {
  process.stdout.write('\n[T1] Corpus accuracy (gate >= 80%)\n');
  const classifier = require(CLASSIFIER_PATH);
  const corpus = JSON.parse(fs.readFileSync(CORPUS_PATH, 'utf8'));
  assert.strictEqual(corpus.messages.length, 50, 'corpus must have exactly 50 messages');

  let correct = 0;
  const misses = [];
  for (const m of corpus.messages) {
    const input = {
      user_message: m.user_message,
      tool_invocation: m.tool_invocation,
      hook_event: m.hook_event,
    };
    const r = classifier.classify(input, m.current_state);
    const got = r.candidate_op;
    const want = m.expected_op;
    if (got === want) {
      correct += 1;
    } else {
      misses.push({
        id: m.id,
        want,
        got,
        confidence: r.confidence,
        message: m.user_message.slice(0, 80),
      });
    }
  }

  const total = corpus.messages.length;
  const accuracyPct = ((correct / total) * 100).toFixed(1);

  if (misses.length > 0) {
    process.stdout.write('  Misclassifications:\n');
    for (const miss of misses) {
      process.stdout.write(
        '    ' +
          miss.id +
          ' want=' +
          miss.want +
          ' got=' +
          miss.got +
          ' confidence=' +
          miss.confidence +
          ' | ' +
          miss.message +
          '\n'
      );
    }
  }

  if (correct >= 41) {
    pass(
      'Phase 99-02 classifier accuracy: ' +
        correct +
        '/' +
        total +
        ' correct (' +
        accuracyPct +
        '%) -- GATE PASSES (>= 80%)'
    );
  } else {
    fail(
      'Phase 99-02 classifier accuracy: ' +
        correct +
        '/' +
        total +
        ' correct (' +
        accuracyPct +
        '%) -- GATE FAILS (>= 80% required)'
    );
  }
}

// ----------------------------------------------------------------------------
// Test 2: frame-budget gate
// ----------------------------------------------------------------------------

function testFrameBudget() {
  process.stdout.write('\n[T2] Frame budget (target 5ms, gate 8ms mean)\n');
  const classifier = require(CLASSIFIER_PATH);

  // Build a ~200-character message that exercises intent + entity matchers.
  const baseMsg =
    "I noticed Sarah Chen mentioned the Q3 deadline; interesting take from David Kim too. " +
    "Worth noting Jane Smith's report is due by EOW Friday. By the way Lawrence Henderson sent us notes about Q1 review.";
  // Pad or trim to exactly 200 characters to keep the benchmark stable.
  let msg = baseMsg;
  if (msg.length < 200) {
    msg = (msg + ' '.repeat(200)).slice(0, 200);
  } else if (msg.length > 200) {
    msg = msg.slice(0, 200);
  }
  assert.strictEqual(msg.length, 200, 'benchmark message must be exactly 200 chars');

  const iterations = 1000;
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < iterations; i += 1) {
    classifier.classify(
      { user_message: msg, tool_invocation: null, hook_event: null },
      { current: 'JUST_TALK' }
    );
  }
  const t1 = process.hrtime.bigint();
  const totalNs = Number(t1 - t0);
  const meanMs = totalNs / iterations / 1e6;

  if (meanMs < 8) {
    pass(
      'Phase 99-02 classifier frame budget: mean ' +
        meanMs.toFixed(3) +
        'ms (target 5ms, budget 8ms) -- GATE PASSES'
    );
  } else {
    fail(
      'Phase 99-02 classifier frame budget: mean ' +
        meanMs.toFixed(3) +
        'ms (budget 8ms) -- GATE FAILS'
    );
  }
}

// ----------------------------------------------------------------------------
// Test 3: tier-0 fallback (rules JSON missing)
// ----------------------------------------------------------------------------

function testTier0Fallback() {
  process.stdout.write('\n[T3] Tier-0 fallback (rules JSON missing)\n');

  const tmpRulesPath = RULES_PATH + '.t3-bak';

  // Move rules aside.
  fs.renameSync(RULES_PATH, tmpRulesPath);
  try {
    // Spawn fresh node process so module cache does not reuse our already-loaded
    // classifier with COMPILED already populated.
    const script =
      'try{ const c=require(' +
      JSON.stringify(CLASSIFIER_PATH) +
      "); const r=c.classify({user_message:'/mos:explore-domains'},{current:'BUILD_ROOM'}); process.stdout.write(JSON.stringify(r)); } catch(e){ process.stderr.write('THREW:'+e.message); process.exit(2); }";
    const res = spawnSync(process.execPath, ['-e', script], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    if (res.status !== 0) {
      fail(
        'Tier-0 fallback should not throw; classifier exited with status ' +
          res.status +
          ' stderr=' +
          (res.stderr || '<none>')
      );
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(res.stdout);
    } catch (e) {
      fail('Tier-0 fallback returned non-JSON stdout: ' + JSON.stringify(res.stdout));
      return;
    }

    if (parsed.candidate_op !== null) {
      fail(
        'Tier-0 fallback should return candidate_op=null; got ' + JSON.stringify(parsed.candidate_op)
      );
      return;
    }
    if (
      !Array.isArray(parsed.evidence) ||
      parsed.evidence.length === 0 ||
      parsed.evidence[0].stratum !== 'tier0'
    ) {
      fail(
        'Tier-0 fallback should include evidence[0].stratum==="tier0"; got ' +
          JSON.stringify(parsed.evidence)
      );
      return;
    }
    pass('Tier-0 fallback returns null result with stratum=tier0; never throws');
  } finally {
    // Restore rules JSON regardless of test outcome.
    if (fs.existsSync(tmpRulesPath)) {
      fs.renameSync(tmpRulesPath, RULES_PATH);
    }
  }
}

// ----------------------------------------------------------------------------
// Test 4: validate-cross-check
// ----------------------------------------------------------------------------

function testValidateCrossCheck() {
  process.stdout.write('\n[T4] validate-cross-check (classifier output vs operator.validate)\n');
  const classifier = require(CLASSIFIER_PATH);
  const operator = require(OPERATOR_PATH);
  const corpus = JSON.parse(fs.readFileSync(CORPUS_PATH, 'utf8'));

  let crossPass = 0;
  let crossFail = 0;
  const violations = [];

  for (const m of corpus.messages) {
    if (m.expected_op === null) continue; // null entries are not transitions
    const r = classifier.classify(
      {
        user_message: m.user_message,
        tool_invocation: m.tool_invocation,
        hook_event: m.hook_event,
      },
      m.current_state
    );
    if (r.candidate_op === null) continue; // classifier may return null on misclassification; that's a T1 issue
    const v = operator.validate(m.current_state.current, r.candidate_op, r.suggested_trigger);
    if (v.valid) {
      crossPass += 1;
    } else {
      crossFail += 1;
      violations.push({
        id: m.id,
        from: m.current_state.current,
        to: r.candidate_op,
        trigger: r.suggested_trigger,
        reason: v.reason,
      });
    }
  }

  if (violations.length > 0) {
    process.stdout.write('  Validate violations:\n');
    for (const vio of violations) {
      process.stdout.write(
        '    ' +
          vio.id +
          ' ' +
          vio.from +
          '->' +
          vio.to +
          ' trigger=' +
          vio.trigger +
          ' :: ' +
          vio.reason +
          '\n'
      );
    }
  }

  if (crossFail === 0) {
    pass(
      'Phase 99-02 classifier validate-cross-check: ' +
        crossPass +
        '/' +
        crossPass +
        ' passes (every classifier output is operationally valid)'
    );
  } else {
    fail(
      'Phase 99-02 classifier validate-cross-check: ' +
        crossPass +
        ' passes, ' +
        crossFail +
        ' fail (transitions returned by classifier rejected by operator.validate)'
    );
  }
}

// ----------------------------------------------------------------------------
// Test 5: boundary conditions
// ----------------------------------------------------------------------------

function testBoundaryConditions() {
  process.stdout.write('\n[T5] Boundary conditions\n');
  const classifier = require(CLASSIFIER_PATH);

  // Empty user_message -> null
  let r = classifier.classify({ user_message: '' }, { current: 'JUST_TALK' });
  if (r.candidate_op === null) {
    pass('Empty user_message returns candidate_op=null');
  } else {
    fail('Empty user_message should return null; got ' + r.candidate_op);
  }

  // /mos:operator -> target_op:null marker, no transition
  r = classifier.classify({ user_message: '/mos:operator' }, { current: 'BUILD_ROOM' });
  if (r.candidate_op === null) {
    pass('/mos:operator returns candidate_op=null (target_op:null marker)');
  } else {
    fail('/mos:operator should return null; got ' + r.candidate_op);
  }

  // /mos:status -> target_op:null marker, no transition
  r = classifier.classify({ user_message: '/mos:status' }, { current: 'BUILD_ROOM' });
  if (r.candidate_op === null) {
    pass('/mos:status returns candidate_op=null (target_op:null marker)');
  } else {
    fail('/mos:status should return null; got ' + r.candidate_op);
  }

  // /mos:room market-analysis -> BUILD_ROOM (specific marker beats general /mos:[a-z-]+)
  r = classifier.classify(
    { user_message: '/mos:room market-analysis' },
    { current: 'JUST_TALK' }
  );
  if (r.candidate_op === 'BUILD_ROOM' && r.confidence >= 0.95) {
    pass('/mos:room beats general /mos: METHODOLOGY marker due to JSON ordering');
  } else {
    fail(
      '/mos:room should classify to BUILD_ROOM 0.95; got ' +
        r.candidate_op +
        ' confidence=' +
        r.confidence
    );
  }

  // AskUserQuestion hook_event -> DECISION_GATE 1.0
  r = classifier.classify(
    { hook_event: 'AskUserQuestion' },
    { current: 'METHODOLOGY' }
  );
  if (r.candidate_op === 'DECISION_GATE' && r.confidence === 1.0) {
    pass('AskUserQuestion hook_event returns DECISION_GATE confidence=1.0');
  } else {
    fail(
      'AskUserQuestion hook_event should return DECISION_GATE 1.0; got ' +
        r.candidate_op +
        ' confidence=' +
        r.confidence
    );
  }

  // EXPLORE_CAPTURE current + "let's file this" -> BUILD_ROOM (D-08 transition rule)
  r = classifier.classify(
    { user_message: "Let's file this insight." },
    { current: 'EXPLORE_CAPTURE' }
  );
  if (r.candidate_op === 'BUILD_ROOM') {
    pass("EXPLORE_CAPTURE + 'let\\'s file this' -> BUILD_ROOM (D-08 rule)");
  } else {
    fail(
      "EXPLORE_CAPTURE + 'let\\'s file this' should classify to BUILD_ROOM; got " +
        r.candidate_op
    );
  }

  // null input -> tier0
  r = classifier.classify(null, { current: 'JUST_TALK' });
  if (r.candidate_op === null && r.evidence[0] && r.evidence[0].stratum === 'tier0') {
    pass('null input returns tier-0 result');
  } else {
    fail('null input should return tier-0; got ' + JSON.stringify(r));
  }
}

// ----------------------------------------------------------------------------
// Run all
// ----------------------------------------------------------------------------

testCorpusAccuracy();
testFrameBudget();
testTier0Fallback();
testValidateCrossCheck();
testBoundaryConditions();

if (failures > 0) {
  process.stdout.write('\nPhase 99-02 classifier tests: ' + failures + ' failure(s)\n');
  process.exit(1);
}

process.stdout.write('\nPhase 99-02 classifier tests: all gates pass\n');
process.exit(0);
