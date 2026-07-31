'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 245-08 Task 2. SPEC Requirement 1, acceptance criterion ONE:
 *
 *   "in one session, two turns with clearly different intent (e.g. a
 *    contradiction-check ask vs. a cross-room ask) produce two DIFFERENT
 *    top-ranked dial items, not the same card both times"
 *
 * WHAT MAKES THIS TEST MEANINGFUL, and why it is shaped the way it is.
 *
 * The two turns share ONE session, so the cortex is IDENTICAL across both and
 * therefore so are the base reach scores. The ONLY thing that differs is which
 * sensor fired. If the top card still changes, the dial is genuinely
 * content-reactive. If it does not, Requirement 1 failed. A test that varied the
 * cortex too would prove nothing: the dial has always reordered on cortex change.
 *
 * WHERE THE ASSERTIONS LIVE, and why that is not negotiable. 245-RESEARCH.md
 * Pitfall 1 names the single most likely way this phase ships a false success:
 * fusing inside the shared hedge ranker's own scored candidate list, watching
 * every unit test go green, and shipping a dial that never moves. F-1 established
 * that the ranker and buildReachList are SIBLING consumers of the same
 * cortex-reach-adapter output, so a fusion confined to the ranker cannot reach the
 * dial at all. Every assertion below therefore runs on the REAL
 * dial-reach-orchestrator.buildReachList output, fed by the REAL production
 * composition helper (scripts/intent-classifier.cjs composeDialReachScores). This
 * test cannot pass without scripts/intent-classifier.cjs having been changed.
 *
 * Pure: in-memory fixtures only. No room.db, no network, no filesystem write.
 * No em-dashes (repo hard rule).
 */

const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const ic = require(path.join(REPO_ROOT, 'scripts', 'intent-classifier.cjs'));
const orchestrator = require(path.join(REPO_ROOT, 'lib', 'hmi', 'dial-reach-orchestrator.cjs'));
const adapter = require(path.join(REPO_ROOT, 'lib', 'hmi', 'cortex-reach-adapter.cjs'));

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
// THE ONE FIXED CORTEX. Reused byte-identically by every fixture below, so the
// base scores can never be the thing that moved.
//
// Node types and property enums are the real ones cortex-reach-adapter reads
// (CORTEX_NODE_TYPES + the CONTRIBUTIONS table); the resulting base map is the
// REAL one that adapter produces, never invented numbers. Deliberately chosen so
// neither of the two fired reaches carries a cortex prior: that is the honest
// worst case for the fusion, because a reach with a LOW cortex prior fuses to a
// LOWER absolute value than one with none (the nudge interpolates toward the
// ceiling from wherever the base sits), so a fixture that handed the fired
// reaches a small prior would be quietly easier to reorder in the wrong
// direction.
// ---------------------------------------------------------------------------
const CORTEX_NODES = Object.freeze([
  { type: 'navigator_persona', id: 'persona:navigator' },
  { type: 'memory_artifact', id: 'artifact:prior-session' },
]);

// A facts[] entry as lib/core/navigation-engine.cjs buildContextAssembly actually
// shapes it: reach_id + posture + a flat scalar evidence bag + the two LOCAL
// temporal scalars. NOT a full reach struct, which is exactly why the fusion is
// contracted to read reach_id off it and nothing else.
function fact(reachId, sensorId) {
  return {
    reach_id: reachId,
    posture: 'offer',
    evidence: { sensor_id: sensorId, hits: 1 },
    first_seen: null,
    last_updated: null,
  };
}

// The two turns. Same session, same cortex, same tier. ONE difference.
const TURN_A_REACH = 'context_block';   // stands in for a contradiction-check ask
const TURN_B_REACH = 'cross_room';      // stands in for a cross-room ask

function decisionFor(firedReachId, brainVerb, tierMode) {
  return {
    fire_skill: 'Run Methodology',
    decision_trace: {
      brain_md_tier_mode: tierMode,
      brain_pattern_verb: brainVerb,
      context_assembly: {
        user_summary: [],
        facts: firedReachId === null ? [] : [fact(firedReachId, 'SENS-10')],
        decision_grounding: firedReachId,
      },
    },
  };
}

function dialFor(decision, reachPenalties) {
  const composed = ic.composeDialReachScores({
    cortexNodes: CORTEX_NODES,
    reachPenalties: reachPenalties === undefined ? null : reachPenalties,
    decision: decision,
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

function markerSet(reachList) {
  return reachList.reaches
    .filter(function (r) { return r.recommended === true; })
    .map(function (r) { return r.reach_id; })
    .sort()
    .join(',');
}

function rankOf(reachList, reachId) {
  for (let i = 0; i < reachList.reaches.length; i += 1) {
    if (reachList.reaches[i].reach_id === reachId) return i;
  }
  return -1;
}

process.stdout.write('\nPhase 245-08 / Requirement 1 acceptance 1: the dial is content-reactive\n\n');

// ---------------------------------------------------------------------------
// Arm 0: the production helper is actually reachable and actually composes.
// ---------------------------------------------------------------------------
ok(typeof ic.composeDialReachScores === 'function',
  'scripts/intent-classifier.cjs exports composeDialReachScores (the production composition path)');

const turnA = dialFor(decisionFor(TURN_A_REACH, null, 'mode_a'));
const turnB = dialFor(decisionFor(TURN_B_REACH, null, 'mode_a'));
const control = dialFor(decisionFor(null, null, 'mode_a'));

ok(turnA !== null && turnB !== null && control !== null,
  'all three fixtures compose without a catastrophic fault');

// ---------------------------------------------------------------------------
// Arm 1: THE HEADLINE. Two turns, one session, two different top cards.
// ---------------------------------------------------------------------------
const topA = turnA.list.reaches[0].reach_id;
const topB = turnB.list.reaches[0].reach_id;

ok(topA !== topB,
  'two turns with different fired sensors over an IDENTICAL cortex produce DIFFERENT top-ranked dial items',
  'turn A top: ' + topA + ' / turn B top: ' + topB);

// ---------------------------------------------------------------------------
// Arm 2: DIRECTION, not merely difference. A test that only asserted inequality
// would pass on a coin flip, and would keep passing if the fusion wired the
// sensor signal to the wrong reach.
// ---------------------------------------------------------------------------
ok(topA === TURN_A_REACH,
  "turn A's top card IS the reach turn A's own sensor fired",
  'expected ' + TURN_A_REACH + ', got ' + topA);
ok(topB === TURN_B_REACH,
  "turn B's top card IS the reach turn B's own sensor fired",
  'expected ' + TURN_B_REACH + ', got ' + topB);

// ---------------------------------------------------------------------------
// Arm 3: the NO-SIGNAL control. With no fired sensor and no Brain verb the
// rendered dial must be JSON-identical to the un-fused path (the raw adapter map
// straight into buildReachList). This is the byte-stability discipline the Phase
// 158-03 reject-discount precedent encodes: an absent signal is a no-op, never a
// "small" change.
// ---------------------------------------------------------------------------
const rawScores = adapter.buildReachScoresFromCortex(CORTEX_NODES);
const unfusedList = orchestrator.buildReachList({
  tierMode: 'mode_a',
  reachScores: rawScores,
});

ok(JSON.stringify(control.composed.reachScores) === JSON.stringify(rawScores),
  'no-signal control: the composed score map is JSON-identical to the raw adapter map',
  JSON.stringify(control.composed.reachScores) + ' vs ' + JSON.stringify(rawScores));

ok(JSON.stringify(control.list) === JSON.stringify(unfusedList),
  'no-signal control: the rendered dial is JSON-identical to the un-fused buildReachList output');

// ---------------------------------------------------------------------------
// Arm 4: the MARKER control. The fusion changes ORDER, never marker state. The
// frozen 0.70 / 0.15 gate is Canon Part 3 and this phase has no authority over
// it, so the set of recommended reaches must be the same across all three
// fixtures.
// ---------------------------------------------------------------------------
const mA = markerSet(turnA.list);
const mB = markerSet(turnB.list);
const mC = markerSet(control.list);

ok(mA === mB && mB === mC,
  'the recommended marker set is IDENTICAL across turn A, turn B and the no-signal control',
  'A=[' + mA + '] B=[' + mB + '] control=[' + mC + ']');

// Every fused score stays strictly below the frozen floor, read off the shipped
// orchestrator rather than hand-typed, so a future gate change reddens this
// instead of silently invalidating it.
const FLOOR = orchestrator.RECOMMEND_FLOOR;
let maxFused = 0;
for (const key of Object.keys(turnA.composed.reachScores)) {
  if (turnA.composed.reachScores[key] > maxFused) maxFused = turnA.composed.reachScores[key];
}
for (const key of Object.keys(turnB.composed.reachScores)) {
  if (turnB.composed.reachScores[key] > maxFused) maxFused = turnB.composed.reachScores[key];
}
ok(maxFused < FLOOR,
  'no fused score reaches the frozen RECOMMEND_FLOOR (' + FLOOR + ')',
  'max fused observed: ' + maxFused);

// ---------------------------------------------------------------------------
// Arm 5: a NON-EMPTY marker set, preserved. Arm 4 on its own proves only that an
// empty set stayed empty, which is a weak claim. A cortex can never legitimately
// lift a reach to 0.70 (cortex-reach-adapter's CONTRIBUTIONS table is explicitly
// built so no single signal solo-crosses the floor), so the already-RECOMMENDED
// prior is injected through the REAL step-2 seam this helper already has: the
// Phase 158-03 discountedScores merge, which is an absolute-score Object.assign
// by contract. The claim under test is that the fusion neither creates nor
// destroys a marker when one already exists.
// ---------------------------------------------------------------------------
const PRIOR_PENALTIES = {
  discountedScores: { contradiction: 0.82, brain_consult: 0.74 },
  suppressedReachIds: [],
};
const markedFused = dialFor(decisionFor(TURN_A_REACH, null, 'mode_a'), PRIOR_PENALTIES);
const markedUnfused = dialFor(decisionFor(null, null, 'mode_a'), PRIOR_PENALTIES);

ok(markerSet(markedFused.list) !== '',
  'the marker-preservation fixture actually carries a NON-EMPTY recommended set',
  'set: [' + markerSet(markedFused.list) + ']');
ok(markerSet(markedFused.list) === markerSet(markedUnfused.list),
  'on a fixture with an already-RECOMMENDED prior, the fusion leaves the marker set UNCHANGED',
  'fused=[' + markerSet(markedFused.list) + '] unfused=[' + markerSet(markedUnfused.list) + ']');
ok(rankOf(markedFused.list, TURN_A_REACH) < rankOf(markedUnfused.list, TURN_A_REACH),
  'on that same fixture the fired reach still IMPROVES its rank (the arm cannot pass on a no-op fusion)',
  'fused rank ' + rankOf(markedFused.list, TURN_A_REACH)
    + ' vs unfused rank ' + rankOf(markedUnfused.list, TURN_A_REACH));

// ---------------------------------------------------------------------------
process.stdout.write('\nobserved top card: turn A -> ' + topA + ' | turn B -> ' + topB
  + ' | no-signal control -> ' + control.list.reaches[0].reach_id + '\n');
process.stdout.write(failures === 0
  ? '\nAll checks passed.\n\n'
  : '\n' + failures + ' check(s) FAILED.\n\n');
process.exit(failures === 0 ? 0 : 1);
