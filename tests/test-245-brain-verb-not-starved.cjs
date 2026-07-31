'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 245-08 Task 3. SPEC Requirement 1, acceptance criterion TWO, as amended
 * by 245-CONTEXT.md D-24:
 *
 *   "a turn where a fresh Brain pattern_matches verb exists alongside a fired
 *    sensor visibly influences the dial's ranking (not silently discarded by
 *    sensor precedence) - a second, distinct regression test from the first"
 *
 * WHY THIS IS A SECOND TEST AND NOT A SECOND ARM OF THE FIRST ONE.
 *
 * The two criteria fail for different reasons and would be repaired by different
 * code. The first proves the dial moves at all. This one proves WHO gets to move
 * it. Before this phase, resolveFireSkill's precedence returned early on the
 * fired sensor at step 2, step 3 never ran, extractTopCandidateVerb was never
 * called, and Brain's own verb existed nowhere downstream on any turn where a
 * sensor fired, which was essentially every observed turn. Requirements 1 and 2
 * alone would therefore have shipped a dial that is content-reactive to SENSORS
 * and still completely deaf to Brain, while the SPEC's Goal sentence says
 * "Brain-informed". D-24 is the amendment that closed that hole; this test is
 * what keeps it closed.
 *
 * THE SUBJECT IS THE CONDITION, NOT THE ARITHMETIC. Every assertion runs through
 * the production composition helper (scripts/intent-classifier.cjs
 * composeDialReachScores) into the REAL dial-reach-orchestrator.buildReachList.
 * The shared selection layer's fusion function is deliberately NOT called
 * directly anywhere below: doing so would prove the math while proving nothing
 * about the wiring, and the wiring is the entire gap between what Requirement 1
 * asks for and what a unit test can show.
 *
 * Pure: in-memory fixtures only. No room.db, no network, no filesystem write.
 * No em-dashes (repo hard rule).
 */

const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const ic = require(path.join(REPO_ROOT, 'scripts', 'intent-classifier.cjs'));
const orchestrator = require(path.join(REPO_ROOT, 'lib', 'hmi', 'dial-reach-orchestrator.cjs'));
const affinityMod = require(path.join(REPO_ROOT, 'lib', 'core', 'verb-reach-affinity.cjs'));

let failures = 0;
function ok(cond, label, detail) {
  if (cond) {
    process.stdout.write('  PASS: ' + label + '\n');
  } else {
    failures += 1;
    process.stdout.write('  FAIL: ' + label + '\n');
    if (detail !== undefined) {
      process.stdout.write('        ' + detail + '\n');
    }
  }
}

// ---------------------------------------------------------------------------
// The fixed fixture. Cortex, fired sensor and tier are held CONSTANT across the
// two variants; the ONLY thing that varies is brain_pattern_verb.
// ---------------------------------------------------------------------------
const CORTEX_NODES = Object.freeze([
  { type: 'navigator_persona', id: 'persona:navigator' },
  { type: 'memory_artifact', id: 'artifact:prior-session' },
]);

const FIRED_REACH = 'context_block';

// The skill-family slug the fired sensor's reach resolves to. Present on the
// trace exactly as production puts it there, and present precisely so the
// Pitfall 2 mutation (repointing the Brain-verb read at trace.fire_skill) has a
// realistic wrong value to pick up.
const FIRED_SKILL_FAMILY = 'Run Methodology';

// ---------------------------------------------------------------------------
// Pick the Brain verb and its target reach FROM THE COMMITTED TABLE at run time.
// Hardcoding either would let a re-derivation of the 245-04 affinity table
// silently invalidate this fixture while the test kept printing green. The
// requirement: a verb whose affinity entry is non-null and whose targets do NOT
// include the fired reach, so the Brain term and the sensor term are provably
// landing on different reaches.
// ---------------------------------------------------------------------------
function pickBrainVerb() {
  const table = affinityMod.VERB_REACH_AFFINITY;
  for (const verb of Object.keys(table)) {
    const entry = affinityMod.verbReachAffinity(verb);
    if (!entry || typeof entry !== 'object') continue;
    const targets = Object.keys(entry);
    if (targets.length === 0) continue;
    if (targets.indexOf(FIRED_REACH) !== -1) continue; // overlaps the sensor, useless here
    // The heaviest target is the one whose movement we assert on.
    let best = targets[0];
    for (const t of targets) {
      if (Number(entry[t]) > Number(entry[best])) best = t;
    }
    return { verb: verb, target: best, weight: Number(entry[best]) };
  }
  return null;
}

const picked = pickBrainVerb();

process.stdout.write('\nPhase 245-08 / Requirement 1 acceptance 2: the Brain verb is not starved\n\n');

if (picked === null) {
  // Deliberately a FAILURE, never a skip. If the committed affinity table no
  // longer contains a verb that targets a reach away from the fired one, this
  // acceptance criterion has become untestable and someone must know.
  process.stdout.write(
    '  FAIL: the committed VERB_REACH_AFFINITY table has no verb whose non-null affinity\n'
    + '        targets a reach other than "' + FIRED_REACH + '". Acceptance criterion 2 cannot\n'
    + '        be exercised. Re-check lib/core/verb-reach-affinity.cjs before touching this test.\n');
  process.exit(1);
}

const BRAIN_VERB = picked.verb;
const BRAIN_TARGET = picked.target;

process.stdout.write('  fixture: fired sensor reach "' + FIRED_REACH + '", Brain verb "'
  + BRAIN_VERB + '" -> target reach "' + BRAIN_TARGET + '" (weight ' + picked.weight + ')\n\n');

// ---------------------------------------------------------------------------

function fact(reachId) {
  return {
    reach_id: reachId,
    posture: 'offer',
    evidence: { sensor_id: 'SENS-10', hits: 1 },
    first_seen: null,
    last_updated: null,
  };
}

function decisionFor(opts) {
  return {
    fire_skill: FIRED_SKILL_FAMILY,
    decision_trace: {
      brain_md_tier_mode: opts.tierMode,
      brain_pattern_verb: opts.brainVerb,
      // Present on the trace exactly as production leaves it. NOT a permitted
      // Brain-verb source (245-RESEARCH.md Pitfall 2): on a sensor-fires turn it
      // holds the SENSOR's skill family, so reading the Brain term from here
      // measures the sensor twice.
      fire_skill: FIRED_SKILL_FAMILY,
      context_assembly: {
        user_summary: [],
        facts: opts.fired ? [fact(FIRED_REACH)] : [],
        decision_grounding: opts.fired ? FIRED_REACH : null,
      },
    },
  };
}

function dialFor(opts) {
  const composed = ic.composeDialReachScores({
    cortexNodes: CORTEX_NODES,
    reachPenalties: null,
    decision: decisionFor(opts),
  });
  if (composed === null) return null;
  return {
    composed: composed,
    list: orchestrator.buildReachList({
      tierMode: composed.tierMode,
      reachScores: composed.reachScores,
      suppressedReachIds: composed.suppressedReachIds,
    }),
  };
}

function scoreOf(reachList, reachId) {
  for (const r of reachList.reaches) {
    if (r.reach_id === reachId) return r.score;
  }
  return null;
}

function rankOf(reachList, reachId) {
  for (let i = 0; i < reachList.reaches.length; i += 1) {
    if (reachList.reaches[i].reach_id === reachId) return i;
  }
  return -1;
}

function markerSet(reachList) {
  return reachList.reaches
    .filter(function (r) { return r.recommended === true; })
    .map(function (r) { return r.reach_id; });
}

// ---------------------------------------------------------------------------
// The three fixtures. Cortex, fired sensor and tier constant; verb varies.
// ---------------------------------------------------------------------------
const v1 = dialFor({ tierMode: 'mode_a', brainVerb: null, fired: true });
const v2 = dialFor({ tierMode: 'mode_a', brainVerb: BRAIN_VERB, fired: true });
// The silent baseline: no sensor, no verb. Used to prove the sensor term is
// genuinely present in v2 rather than merely equal to v1 by both being absent.
const silent = dialFor({ tierMode: 'mode_a', brainVerb: null, fired: false });

ok(v1 !== null && v2 !== null && silent !== null,
  'all three fixtures compose without a catastrophic fault');

// ---------------------------------------------------------------------------
// Arm 1: the Brain verb raises its target reach's SCORE.
// ---------------------------------------------------------------------------
const s1 = scoreOf(v1.list, BRAIN_TARGET);
const s2 = scoreOf(v2.list, BRAIN_TARGET);

ok(s2 > s1,
  'a fresh Brain verb strictly RAISES its affinity reach\'s score on a turn where a sensor also fired',
  BRAIN_TARGET + ': ' + s1 + ' (no verb) -> ' + s2 + ' (verb "' + BRAIN_VERB + '")');

// ---------------------------------------------------------------------------
// Arm 2: it moves the RANK, which is what "visibly influences the dial's
// ranking" actually means. A score change nobody can see on the card is not a
// dial that is Brain-informed.
// ---------------------------------------------------------------------------
const r1 = rankOf(v1.list, BRAIN_TARGET);
const r2 = rankOf(v2.list, BRAIN_TARGET);

ok(r2 < r1,
  'the Brain verb IMPROVES its affinity reach\'s rank position on the rendered dial',
  BRAIN_TARGET + ' rank: ' + r1 + ' (no verb) -> ' + r2 + ' (verb)');

// ---------------------------------------------------------------------------
// Arm 3: the Brain term is ADDITIVE alongside the sensor term, not a
// replacement for it. This is the "genuine third input, not gated behind sensor
// silence" property D-24 requires, asserted from both sides: the fired reach is
// still lifted above the silent baseline, and it is lifted by exactly the same
// amount it was before the Brain verb arrived.
// ---------------------------------------------------------------------------
const firedSilent = scoreOf(silent.list, FIRED_REACH);
const firedV1 = scoreOf(v1.list, FIRED_REACH);
const firedV2 = scoreOf(v2.list, FIRED_REACH);

ok(firedV2 > firedSilent,
  'the fired sensor\'s reach is STILL nudged on the Brain-verb turn (the sensor term did not get displaced)',
  FIRED_REACH + ': ' + firedSilent + ' (silent) -> ' + firedV2 + ' (sensor + verb)');
ok(firedV2 === firedV1,
  'the fired sensor\'s reach is nudged by the SAME amount with and without the Brain verb',
  FIRED_REACH + ': ' + firedV1 + ' (sensor only) vs ' + firedV2 + ' (sensor + verb)');

// ---------------------------------------------------------------------------
// Arm 4: the bound holds. No reach may acquire a recommended marker it did not
// already have. The frozen 0.70 / 0.15 gate is Canon Part 3 and this phase has
// no authority over it.
// ---------------------------------------------------------------------------
const m1 = markerSet(v1.list);
const m2 = markerSet(v2.list);
const newMarkers = m2.filter(function (id) { return m1.indexOf(id) === -1; });

ok(newMarkers.length === 0,
  'no reach acquires a recommended marker because of the Brain verb',
  'new markers: [' + newMarkers.join(',') + ']');
ok(scoreOf(v2.list, BRAIN_TARGET) < orchestrator.RECOMMEND_FLOOR,
  'the Brain-lifted reach stays strictly below the frozen RECOMMEND_FLOOR ('
    + orchestrator.RECOMMEND_FLOOR + ')',
  BRAIN_TARGET + ' = ' + scoreOf(v2.list, BRAIN_TARGET));

// ---------------------------------------------------------------------------
// Arm 5: the TIER control. 245-07's Canon Part 3 tier policy: the Brain term
// applies in mode_a only, because mode_b is local-only and tier_0 is the
// Brain-absent fallback. The SENSOR term applies in every tier, matching
// resolveFireSkill step 2's any-tier behavior. Both halves are asserted, because
// a mode_b arm that only checked the Brain term would also pass if the whole
// fusion had been switched off in mode_b.
// ---------------------------------------------------------------------------
const bV1 = dialFor({ tierMode: 'mode_b', brainVerb: null, fired: true });
const bV2 = dialFor({ tierMode: 'mode_b', brainVerb: BRAIN_VERB, fired: true });
const bSilent = dialFor({ tierMode: 'mode_b', brainVerb: null, fired: false });

ok(scoreOf(bV2.list, BRAIN_TARGET) === scoreOf(bV1.list, BRAIN_TARGET),
  'mode_b: the Brain term does NOT apply (Canon Part 3 tier policy)',
  BRAIN_TARGET + ': ' + scoreOf(bV1.list, BRAIN_TARGET) + ' (no verb) vs '
    + scoreOf(bV2.list, BRAIN_TARGET) + ' (verb)');
ok(scoreOf(bV2.list, FIRED_REACH) > scoreOf(bSilent.list, FIRED_REACH),
  'mode_b: the SENSOR term still applies (the tier gate is on the Brain term only)',
  FIRED_REACH + ': ' + scoreOf(bSilent.list, FIRED_REACH) + ' (silent) -> '
    + scoreOf(bV2.list, FIRED_REACH) + ' (sensor)');

// ---------------------------------------------------------------------------
process.stdout.write('\nobserved: ' + BRAIN_TARGET + ' score ' + s1 + ' -> ' + s2
  + ', rank ' + r1 + ' -> ' + r2 + '; ' + FIRED_REACH + ' held at ' + firedV2 + '\n');
process.stdout.write(failures === 0
  ? '\nAll checks passed.\n\n'
  : '\n' + failures + ' check(s) FAILED.\n\n');
process.exit(failures === 0 ? 0 : 1);
