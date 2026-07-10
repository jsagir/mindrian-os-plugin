'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 213-03 -- the RECOMMEND-NEVER-TRIGGER adversarial suite for SENS-13.
 * ========================================================================
 * The LOCKED constraint (Phase 210 doctrine, RESEARCH V2): "the Brain
 * RECOMMENDS, never TRIGGERS." The eureka sensor PRODUCES a candidate reach;
 * decide() (the one selection brain) decides SURFACING; the navigator verb (the
 * sole trigger for runChain) decides ACTING. This suite makes that constraint
 * MECHANICAL -- structurally (source fences), behaviorally (a poisoned chain that
 * must never fire), lexically (the forcing-vocabulary fence), and by posture
 * (the fired reach is a standing 'hold' suggestion, never an auto-open).
 *
 * Why this suite exists (T-213-08, Elevation of Privilege: machine over
 * navigator): a fired sensor that could reach runChain without the navigator
 * would let the Brain TRIGGER. The Stop-hook force-fire incident class
 * (feedback_1_15_enforcement_regression_watch) is exactly the regression a
 * posture drift would reopen. This suite fails closed on any such drift.
 *
 * GREP HYGIENE (the house rule): the forcing vocabulary and the anti-constraint
 * wording ("never TRIGGERS", "no guard = no fire") legitimately appear in the
 * source COMMENTS that document the constraint. Every source scan below strips
 * comment lines FIRST, so the fence asserts over executable CODE only -- a
 * comment quoting the anti-constraint can never trip it, and a real code-line
 * violation can never hide behind a comment.
 *
 * Plain CJS node:assert/strict; PASS line + non-zero exit on failure.
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const nav = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation-engine.cjs'));
const sensors = require(path.join(REPO_ROOT, 'lib', 'core', 'insight-sensors.cjs'));

const SENSOR_EUREKA = path.join(REPO_ROOT, 'lib', 'core', 'sensors', 'sensor-eureka.cjs');
const REACH_RUNNER = path.join(REPO_ROOT, 'lib', 'core', 'eureka', 'eureka-reach-runner.cjs');
const EUREKA_OFFER = path.join(REPO_ROOT, 'lib', 'core', 'eureka', 'eureka-offer.cjs'); // plan 04, may be absent
const CHAIN_EXECUTOR = path.join(REPO_ROOT, 'lib', 'core', 'chain-executor.cjs');
const FIXTURE = path.join(REPO_ROOT, 'tests', 'fixtures', '213', 'last-eureka.json');

// ---------- comment-stripping (the grep-hygiene helper) ----------

/**
 * Return the CODE lines of a source file: line comments (// ...), block-comment
 * body lines (* ... , /* ... , ... *​/), and blank lines removed, and any inline
 * // tail stripped off a code line. Not a full JS parser -- deliberately
 * conservative: it never lets a commented anti-constraint quote trip a fence,
 * and it keeps every executable statement. Mirrors the "grep -v on comment
 * prefixes" house idiom.
 */
function codeLines(src) {
  const out = [];
  let inBlock = false;
  for (const raw of src.split('\n')) {
    let line = raw;
    const trimmed = line.trim();
    if (inBlock) {
      if (trimmed.indexOf('*/') !== -1) { inBlock = false; }
      continue; // whole line is inside a block comment
    }
    if (trimmed.startsWith('/*')) {
      if (trimmed.indexOf('*/') === -1) inBlock = true; // opens a multi-line block
      continue;
    }
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed === '') continue;
    // strip an inline // tail (conservative: no string-literal awareness needed
    // here because the forbidden tokens never appear inside a string on a code line)
    const ix = line.indexOf('//');
    if (ix !== -1) line = line.slice(0, ix);
    if (line.trim() === '') continue;
    out.push(line);
  }
  return out.join('\n');
}

function makeRoom(overrides) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eureka-noforce-'));
  fs.mkdirSync(path.join(dir, '.mindrian'), { recursive: true });
  const base = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  const payload = Object.assign({}, base, overrides || {});
  if (overrides && overrides.guard) payload.guard = Object.assign({}, base.guard, overrides.guard);
  if (overrides && overrides.bridge) payload.bridge = Object.assign({}, base.bridge, overrides.bridge);
  fs.writeFileSync(path.join(dir, '.mindrian', 'last-eureka.json'), JSON.stringify(payload, null, 2));
  return dir;
}

const FORBIDDEN_REQUIRE = /require\s*\(\s*['"][^'"]*(chain-executor|command-resolver|navigation-engine)[^'"]*['"]\s*\)/;
// The PRODUCER files (sensor + runner) must name no command at all, so they are
// fenced off command-resolver too. The OFFER file (plan 04) is different: its
// whole job is attaching the recommended next command from the registry, so it
// is WIRED into command-resolver by design (213-04 key_link + threat model
// T-213-12, which forbids only chain-executor for this file). The offer fence
// therefore bars only the EXECUTION + ROUTING surfaces; command-resolver, the
// pure read-only registry door (zero network, never executes), is permitted.
const FORBIDDEN_REQUIRE_OFFER = /require\s*\(\s*['"][^'"]*(chain-executor|navigation-engine)[^'"]*['"]\s*\)/;
const FORCING_VOCAB = /\b(auto[-_]?fire|must[-_]?answer|disqualif|force[-_]?fire)\b/i;

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ok - ' + name);
}

console.log('test-213-no-force.cjs: the recommend-never-trigger adversarial suite (SENS-13)');

// ---------- ARM 1: STRUCTURAL FENCES (producers never route/execute) ----------
check('ARM 1 STRUCTURAL: the eureka producer files require no chain-executor / command-resolver / navigation-engine', () => {
  // The two ALWAYS-PRESENT producers (built in 213-02).
  for (const target of [SENSOR_EUREKA, REACH_RUNNER]) {
    const code = codeLines(fs.readFileSync(target, 'utf8'));
    assert.equal(FORBIDDEN_REQUIRE.test(code), false,
      'FENCE BREACH: ' + path.relative(REPO_ROOT, target) +
      ' requires a router/executor in CODE -- a producer must never route or execute (Phase 144 fence).');
  }
  // The plan-04 offer file: guard with fs.existsSync so wave order cannot break
  // this suite. SKIP-log (never fail) when absent.
  if (fs.existsSync(EUREKA_OFFER)) {
    const code = codeLines(fs.readFileSync(EUREKA_OFFER, 'utf8'));
    assert.equal(FORBIDDEN_REQUIRE_OFFER.test(code), false,
      'FENCE BREACH: ' + path.relative(REPO_ROOT, EUREKA_OFFER) +
      ' requires chain-executor / navigation-engine in CODE -- the offer file may wire into command-resolver (its mandated registry door) but never the executor or router.');
    console.log('    (eureka-offer.cjs present: execution+routing fence applied; command-resolver permitted by design)');
  } else {
    console.log('    SKIP: lib/core/eureka/eureka-offer.cjs absent (plan 04 not yet landed) - fence deferred, not failed');
  }
});

// ---------- ARM 2: BEHAVIORAL (a fired reach surfaces an offer, executes nothing) ----------
check('ARM 2 BEHAVIORAL: decide() with a fresh eureka fixture returns a decision and invokes NO chain', () => {
  const dir = makeRoom(null);

  // Poison runChain: if the sensor plane EVER reached the executor, decide()
  // would throw. It must not -- the fired reach is an OFFER, not an execution.
  const chain = require(CHAIN_EXECUTOR);
  const origRunChain = chain.runChain;
  chain.runChain = function poisonedRunChain() {
    throw new Error('FORCED: the sensor plane invoked runChain -- recommend-never-trigger BREACH (T-213-08).');
  };
  try {
    let decision;
    assert.doesNotThrow(() => {
      decision = nav.decide({ text: 'quiet turn', turn_count: 5 }, { roomDir: dir });
    }, 'decide() threw with a poisoned runChain -- the fired eureka reach must NOT execute a chain.');
    assert.ok(decision && typeof decision === 'object', 'decide() must return a decision object.');
    assert.equal(decision.fire_skill, nav.reachIdToSkillFamily('deep_research'),
      'the fired reach must surface as an OFFER (fire_skill = the canonical verb), while the chain stayed untouched.');
  } finally {
    chain.runChain = origRunChain; // restore the real executor no matter what
  }
});

// ---------- ARM 3: VOCABULARY FENCE (the plan-language lock, made mechanical) ----------
check('ARM 3 VOCABULARY: the eureka producers carry zero forcing vocabulary in CODE (auto-fire / must-answer / disqualif / force-fire)', () => {
  for (const target of [SENSOR_EUREKA, REACH_RUNNER]) {
    const code = codeLines(fs.readFileSync(target, 'utf8'));
    const m = code.match(FORCING_VOCAB);
    assert.equal(m, null,
      'VOCABULARY BREACH: ' + path.relative(REPO_ROOT, target) + ' uses forcing vocabulary in CODE: "' +
      (m ? m[0] : '') + '". The Brain RECOMMENDS, never TRIGGERS.');
  }
});

// ---------- ARM 4: POSTURE PIN (the standing-suggestion invariant) ----------
check('ARM 4 POSTURE: the fired eureka reach carries posture "hold" exactly (a regression is the force-fire incident class)', () => {
  const dir = makeRoom(null);
  const reaches = sensors.dispatchSensors({ text: 'quiet turn', turn_count: 5 }, {}, { roomDir: dir });
  const eureka = reaches.find((r) => r && r.reach_id === 'deep_research');
  assert.ok(eureka, 'the eureka reach must fire on the fresh guard-cleared fixture.');
  assert.equal(eureka.posture, 'hold',
    'POSTURE BREACH: the eureka reach posture drifted off "hold" to "' + eureka.posture +
    '" -- a standing suggestion must never become an auto-open (feedback_1_15_enforcement_regression_watch).');
});

console.log('');
console.log('PASS test-213-no-force.cjs (' + passed + ' invariants; recommend-never-trigger is mechanical)');
