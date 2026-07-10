'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 213-03 -- the BORN-WIRED runtime reachability proof for SENS-13 eureka.
 * =============================================================================
 * THE phase-defining acceptance criterion (RESEARCH V2, 04-synthesis Step 2):
 * Phase 213 is the room's FIRST born-wired-at-feature-time proof. The eureka
 * reach is not merely REGISTERED in SENSOR_REGISTRY -- it is provably REACHABLE
 * through the REAL decide() at runtime, in the same phase that builds it. The
 * disease this suite is the countermeasure for is the M4 placeholder pattern:
 * a surface registered-but-never-surfaced. The reachability arm FAILS the suite
 * if a future edit ever starves the reach (T-213-09).
 *
 * Phase 185 discipline (the lesson this suite deliberately applies): "reachable
 * here means reachable by the REAL read path." We call the SHIPPED
 * navigation-engine.decide() and the SHIPPED insight-sensors.dispatchSensors --
 * NO mock of the engine, NO parallel ranker, NO re-implementation of the
 * canonical order. A green arm here means the production decide() would surface
 * the offer; a red arm names the exact broken link.
 *
 * READ-PATH NOTE (recorded honestly, not fought -- Phase 185 rule): the tier_0
 * sensor path resolves fire_skill to the CANONICAL VERB the reach maps to, via
 * the shipped reachIdToSkillFamily('deep_research') === 'Spawn Sub-Agent'. That
 * verb is what the skill-activation-router validates; the router's
 * verbToSkillFamily layer then maps 'Spawn Sub-Agent' -> the 'subagent-dispatcher'
 * skill family downstream. So the observable born-wired value AT decide()'s
 * output is the verb 'Spawn Sub-Agent' (asserted here against the shipped map,
 * never a hand-typed literal), and the full deep_research -> Spawn Sub-Agent ->
 * subagent-dispatcher chain is proven link-by-link through shipped exports. We
 * assert the value the REAL engine returns, not a value the plan assumed.
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

const FIXTURE = path.join(REPO_ROOT, 'tests', 'fixtures', '213', 'last-eureka.json');

// ---------- LOCAL test seams (temp rooms; never a real room) ----------

/**
 * Build a throwaway room dir carrying <roomDir>/.mindrian/last-eureka.json. The
 * payload defaults to the shipped fixture; overrides deep-merge onto guard/bridge.
 * ageMs sets how far in the PAST the file mtime is stamped (0 = now = fresh).
 * Returns the room dir.
 */
function makeRoom(overrides, ageMs) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eureka-reach-'));
  fs.mkdirSync(path.join(dir, '.mindrian'), { recursive: true });
  const base = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  const payload = Object.assign({}, base, overrides || {});
  if (overrides && overrides.guard) payload.guard = Object.assign({}, base.guard, overrides.guard);
  if (overrides && overrides.bridge) payload.bridge = Object.assign({}, base.bridge, overrides.bridge);
  const target = path.join(dir, '.mindrian', 'last-eureka.json');
  fs.writeFileSync(target, JSON.stringify(payload, null, 2));
  if (typeof ageMs === 'number' && ageMs > 0) {
    const when = (Date.now() - ageMs) / 1000; // seconds for utimesSync
    fs.utimesSync(target, when, when);
  }
  return dir;
}

/** Pull the fired reach_ids out of decide()'s trace.context_assembly.facts. */
function traceReachIds(decision) {
  const ca = decision && decision.decision_trace && decision.decision_trace.context_assembly;
  const facts = ca && Array.isArray(ca.facts) ? ca.facts : [];
  return facts.map((f) => f && f.reach_id).filter((x) => typeof x === 'string');
}

/** The single eureka fact (reach_id deep_research) off the decide() trace, or null. */
function eurekaFact(decision) {
  const ca = decision && decision.decision_trace && decision.decision_trace.context_assembly;
  const facts = ca && Array.isArray(ca.facts) ? ca.facts : [];
  return facts.find((f) => f && f.reach_id === 'deep_research') || null;
}

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ok - ' + name);
}

console.log('test-213-reach-wired.cjs: the born-wired runtime reachability proof (SENS-13 -> decide())');

// The canonical verb the deep_research reach maps to, read from the SHIPPED map
// (never a hand-typed literal -- the Phase 185 no-parallel-reimplementation rule).
const EUREKA_VERB = nav.reachIdToSkillFamily('deep_research');
assert.equal(EUREKA_VERB, 'Spawn Sub-Agent',
  'PRECONDITION BREACH: reachIdToSkillFamily("deep_research") drifted off "Spawn Sub-Agent" (got ' +
  EUREKA_VERB + '); the frozen deep_research -> Spawn Sub-Agent -> subagent-dispatcher chain is broken.');

// ---------- ARM 1: REACHABLE (the phase gate; fails if the reach is orphaned) ----------
check('ARM 1 REACHABLE: a fresh guard-cleared side-channel makes the REAL decide() surface the eureka reach', () => {
  const dir = makeRoom(null, 0);

  // The REAL decide() -- no engine mock, no parallel ranker.
  const decision = nav.decide({ text: 'quiet turn', turn_count: 5 }, { roomDir: dir });

  // (a) fire_skill resolves to the canonical verb the frozen deep_research reach
  //     maps to. If this fails, the eureka reach is UNREACHABLE through decide()
  //     -- the exact drift class Phase 185 doctor --drift catches for
  //     commands/agents, asserted here at FEATURE TIME for the sensor plane.
  assert.equal(decision.fire_skill, EUREKA_VERB,
    'BORN-WIRED BREACH: fresh guard-cleared eureka side-channel did NOT surface through decide(): ' +
    'expected fire_skill "' + EUREKA_VERB + '" (deep_research -> Spawn Sub-Agent), got ' +
    JSON.stringify(decision.fire_skill) + '. The reach is registered-but-unreachable (M4 disease).');

  // (b) the eureka reach is on the decision trace with its guard-cleared fingerprint.
  const fact = eurekaFact(decision);
  assert.ok(fact, 'BORN-WIRED BREACH: no deep_research fact on the decide() trace; the reach never reached decide().');
  assert.equal(fact.posture, 'hold', 'the eureka reach must ride posture "hold" (recommend-never-trigger).');
  assert.equal(fact.evidence.guard_verdict, 'transferable',
    'the surfaced reach must carry the POST-GuardGate transferable verdict; got ' + fact.evidence.guard_verdict);
  assert.equal(fact.evidence.band, 'breakthrough',
    'the surfaced reach must carry the fixture band; got ' + fact.evidence.band);

  // (c) decision_grounding names the eureka reach as the justification.
  const grounding = decision.decision_trace.context_assembly.decision_grounding;
  assert.equal(grounding, 'deep_research',
    'the decide() grounding must name deep_research as what drove fire_skill; got ' + grounding);

  // (d) the reach carries signal "eureka_bridge" -- observed through the REAL
  //     dispatch chokepoint decide() itself calls (the real read path, not a
  //     parallel ranker). trace.facts drop reach.signal by Part-8 design, so the
  //     signal is asserted at its source: dispatchSensors.
  const reaches = sensors.dispatchSensors({ text: 'quiet turn', turn_count: 5 }, {}, { roomDir: dir });
  const eureka = reaches.find((r) => r && r.reach_id === 'deep_research');
  assert.ok(eureka, 'dispatchSensors (the chokepoint decide() calls) did not emit the eureka reach.');
  assert.equal(eureka.signal, 'eureka_bridge',
    'the eureka reach must carry signal "eureka_bridge"; got ' + eureka.signal);
});

// ---------- ARM 2: TURN-STAGE HONEST (respects the shipped BCH-S5 gate) ----------
check('ARM 2 TURN-STAGE: the born-wired path honors the shipped deep_research suppression (turns 1-2), unlocks at 3', () => {
  const dir = makeRoom(null, 0);

  // Turns 1-2: deep_research is a TURN_STAGE_GATED_REACH -> suppressed.
  for (const tc of [1, 2]) {
    const reaches = sensors.dispatchSensors({ text: 'quiet turn', turn_count: tc }, {}, { roomDir: dir });
    const ids = reaches.map((r) => r.reach_id);
    assert.ok(ids.indexOf('deep_research') === -1,
      'GATE BYPASS: eureka reach surfaced at turn ' + tc + ' (deep_research must be suppressed in turns 1-2); ' +
      'the born-wired path must NOT bypass BCH-S5. got ' + JSON.stringify(ids));
    // The decide() output agrees: no eureka verb this early.
    const decision = nav.decide({ text: 'quiet turn', turn_count: tc }, { roomDir: dir });
    assert.notEqual(decision.fire_skill, EUREKA_VERB,
      'GATE BYPASS: decide() fired the eureka verb at suppressed turn ' + tc + '.');
  }

  // Turn 3: the transition-band edge -> deep_research eligible again.
  const reaches3 = sensors.dispatchSensors({ text: 'quiet turn', turn_count: 3 }, {}, { roomDir: dir });
  assert.ok(reaches3.map((r) => r.reach_id).indexOf('deep_research') !== -1,
    'UNDER-UNLOCK: eureka reach absent at turn 3; the shipped TURN_STAGE_UNLOCK_AT (3) must let it through.');
});

// ---------- ARM 3: CO-FIRE PINNED (Pitfall 2, empirical -- not assumed) ----------
//
// CO-FIRE VERDICT (recorded for the SUMMARY): on a turn that ALSO fires a
// context_block sensor (SENS-03 lagging-component on "bottleneck"), the eureka
// offer YIELDS -- context_block outranks it by canonical SENSOR_REGISTRY order
// (context_block sensors sit earlier than SENS-13). deep_research is STILL in the
// full reach list, so the offer is present-but-not-top: it surfaces on a QUIET
// turn and defers to a same-turn context sensor. This is the CORRECT posture for
// a posture-'hold' standing suggestion. If a future run ever showed the reach
// NEVER surfaces in realistic mixes, the fix belongs in SENS-13's FIRING
// CONDITION (tighten the band/guard gate), NEVER in reordering the frozen
// REACH_IDS and NEVER in bypassing decide() (RESEARCH Pitfall 2 doctrine).
check('ARM 3 CO-FIRE: a same-turn context_block sensor outranks the eureka offer; deep_research still present', () => {
  const dir = makeRoom(null, 0);
  const reaches = sensors.dispatchSensors(
    { text: 'the data pipeline is the bottleneck', turn_count: 5 }, {}, { roomDir: dir });
  const ids = reaches.map((r) => r.reach_id);

  assert.ok(reaches.length >= 2,
    'CO-FIRE arm needs both sensors firing; got ' + JSON.stringify(ids) + ' (if <2 the test text stopped firing SENS-03).');
  assert.equal(reaches[0].reach_id, 'context_block',
    'CANONICAL-ORDER BREACH: the top reach on a co-fire turn must be context_block (earlier in SENSOR_REGISTRY); got ' +
    reaches[0].reach_id);
  assert.ok(ids.indexOf('deep_research') !== -1,
    'the eureka reach must still be PRESENT in the full co-fire reach list (present-but-not-top); got ' + JSON.stringify(ids));

  // decide() surfaces the TOP reach's verb, not the eureka verb, on this turn.
  const decision = nav.decide({ text: 'the data pipeline is the bottleneck', turn_count: 5 }, { roomDir: dir });
  assert.notEqual(decision.fire_skill, EUREKA_VERB,
    'on a co-fire turn decide() must surface the top (context_block) reach, not the eureka verb.');
});

// ---------- ARM 4: STALE / UNGUARDED NEGATIVE (proves arm 1 is load-bearing) ----------
check('ARM 4a STALE: a stale side-channel does NOT surface the eureka reach through decide()', () => {
  const dir = makeRoom(null, 40 * 60 * 1000); // 40 min old > the 30-min window
  const decision = nav.decide({ text: 'quiet turn', turn_count: 5 }, { roomDir: dir });
  assert.notEqual(decision.fire_skill, EUREKA_VERB,
    'VACUOUS-GREEN RISK: a stale side-channel STILL surfaced the eureka verb; the freshness gate is not load-bearing.');
  assert.ok(traceReachIds(decision).indexOf('deep_research') === -1,
    'a stale side-channel must NOT put deep_research on the decide() trace.');
});

check('ARM 4b UNGUARDED: a restatement guard verdict does NOT surface the eureka reach (no guard = no fire)', () => {
  const dir = makeRoom({ guard: { verdict: 'restatement' } }, 0);
  const decision = nav.decide({ text: 'quiet turn', turn_count: 5 }, { roomDir: dir });
  assert.notEqual(decision.fire_skill, EUREKA_VERB,
    'POST-GuardGate BREACH: a "restatement" verdict surfaced the eureka verb; a restatement must NEVER become an offer.');
  assert.ok(traceReachIds(decision).indexOf('deep_research') === -1,
    'a restatement verdict must NOT put deep_research on the decide() trace.');
});

console.log('');
console.log('PASS test-213-reach-wired.cjs (' + passed + ' arms; the born-wired reachability proof is on disk)');
