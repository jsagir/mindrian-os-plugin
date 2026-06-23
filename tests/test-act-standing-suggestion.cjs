'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 172-09 -- the /mos:act standing-suggestion test fence (INV-19 / D-172-j).
 * ============================================================================
 * Asserts the PINNED additive /mos:act standing suggestion on the dial host:
 *
 *   Test 1  buildReachList output carries a pinned act row as a SEPARATE field
 *           (pinned_suggestion), distinct from the ranked reaches array.
 *   Test 2  the pinned act row does NOT count against offered_count -- the
 *           MAX_K=3 ranked reaches are unchanged whether or not act is pinned
 *           (offered_count + total_count + the ranked reaches are byte-identical
 *           with and without the pinned suggestion present).
 *   Test 3  DIAL_REACH_K is still 6 and REACH_IDS is still length 6 -- act mints
 *           NO 7th reach (the frozen reach bank is untouched).
 *   Test 4  the act row carries a render-only blurb (from buildActBlurb) rendered
 *           through a NON-EGRESS render-only family in the dial-label composer
 *           (no {framework} egress slot, mirroring the hats family) -- composing
 *           the act label never moves the Part-8 egress audit counter.
 *
 * Canon Part 11 INV-19: act is a standing UI suggestion to invoke a command,
 * NOT a reach. The frozen Part-3 contracts (MAX_K=3, DIAL_REACH_K=6, the
 * 0.70/0.15 gate, the F.1 keyboard) are untouched.
 *
 * Pure node assertions. No network. No em-dashes.
 */

const assert = require('node:assert');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

const orchestrator = require(path.join(REPO_ROOT, 'lib/hmi/dial-reach-orchestrator.cjs'));
const composer = require(path.join(REPO_ROOT, 'lib/hmi/dial-label-composer.cjs'));
const blurbGen = require(path.join(REPO_ROOT, 'lib/core/act-jtbd-blurb.cjs'));

let passed = 0;
let failed = 0;
const failures = [];

function check(name, fn) {
  try {
    fn();
    passed++;
    console.log('  PASS: ' + name);
  } catch (e) {
    failed++;
    failures.push(name + ' -- ' + (e && e.message ? e.message : String(e)));
    console.log('  FAIL: ' + name + ' -- ' + (e && e.message ? e.message : String(e)));
  }
}

// A representative mode_a room state (Brain reachable, two reaches near the gate).
const ROOM_STATE = Object.freeze({
  tierMode: 'mode_a',
  brainReachable: true,
  brainMdPresent: true,
  localGraphPresent: true,
  reachScores: { context_block: 0.82, contradiction: 0.74, brain_consult: 0.40 },
  // The blurb inputs the host threads through (LOCAL state only).
  actBlurb: {
    jtbd: { jtbd: 'decide-pursue', one_line: 'Decide if a venture is worth pursuing.' },
    state: { stage: 'problem-definition', problem_type: 'IDP', weakest_section: 'market-analysis' },
    minto: { governing_thought: 'x', open_tensions: 2 },
  },
});

// ---------------------------------------------------------------------------
// Test 1: pinned act row is a SEPARATE field distinct from the ranked reaches.
// ---------------------------------------------------------------------------
check('Test 1: buildReachList carries pinned_suggestion distinct from reaches', () => {
  const out = orchestrator.buildReachList(ROOM_STATE);
  assert.ok(out && typeof out === 'object', 'buildReachList returns an object');
  assert.ok(Array.isArray(out.reaches), 'reaches is an array');
  assert.ok(out.pinned_suggestion && typeof out.pinned_suggestion === 'object',
    'pinned_suggestion is a present object');
  // It is NOT one of the ranked reaches (act is not a reach_id).
  const reachIds = out.reaches.map((r) => r.reach_id);
  assert.ok(!reachIds.includes('act'), 'act is NOT in the ranked reaches');
  assert.ok(!reachIds.includes(out.pinned_suggestion.reach_id || 'act'),
    'the pinned suggestion id is not among the ranked reach ids');
  // It self-identifies as the act command standing suggestion.
  assert.strictEqual(out.pinned_suggestion.command, '/mos:act',
    'pinned_suggestion targets /mos:act');
  assert.strictEqual(out.pinned_suggestion.pinned, true, 'pinned_suggestion.pinned === true');
});

// ---------------------------------------------------------------------------
// Test 2: the pinned act row does NOT count against offered_count/total_count;
//         the ranked reaches are unchanged with vs without the blurb present.
// ---------------------------------------------------------------------------
check('Test 2: pinned act row does not consume an offered_count slot', () => {
  const withBlurb = orchestrator.buildReachList(ROOM_STATE);
  // Same room state but WITHOUT the actBlurb inputs (host degrades the blurb).
  const noBlurbState = Object.assign({}, ROOM_STATE);
  delete noBlurbState.actBlurb;
  const withoutBlurb = orchestrator.buildReachList(noBlurbState);

  // The ranked-reach accounting is identical regardless of the pinned act row.
  assert.strictEqual(withBlurb.offered_count, withoutBlurb.offered_count,
    'offered_count is unaffected by the pinned act row');
  assert.strictEqual(withBlurb.total_count, withoutBlurb.total_count,
    'total_count is unaffected by the pinned act row');
  assert.deepStrictEqual(
    withBlurb.reaches.map((r) => r.reach_id),
    withoutBlurb.reaches.map((r) => r.reach_id),
    'the ranked reach order/membership is unaffected by the pinned act row');

  // offered_count clamps to MAX_K=3 and never grows because of the pinned row.
  assert.ok(withBlurb.offered_count <= 3, 'offered_count never exceeds MAX_K=3');
  // pinned_suggestion is present in BOTH (always-on), independent of offered_count.
  assert.ok(withBlurb.pinned_suggestion, 'pinned present with blurb');
  assert.ok(withoutBlurb.pinned_suggestion, 'pinned present even without blurb inputs (always-on)');
});

// ---------------------------------------------------------------------------
// Test 3: DIAL_REACH_K === 6 and REACH_IDS length 6 -- no 7th reach minted.
// ---------------------------------------------------------------------------
check('Test 3: DIAL_REACH_K === 6 and REACH_IDS length 6 (no 7th reach)', () => {
  assert.strictEqual(orchestrator.DIAL_REACH_K, 6, 'DIAL_REACH_K is still 6');
  assert.ok(Array.isArray(orchestrator.REACH_IDS), 'REACH_IDS is an array');
  assert.strictEqual(orchestrator.REACH_IDS.length, 6, 'REACH_IDS is still length 6');
  assert.ok(!orchestrator.REACH_IDS.includes('act'),
    'act is NOT a reach_id in the frozen bank');
});

// ---------------------------------------------------------------------------
// Test 4: the act row renders via a NON-EGRESS render-only family (no
//         {framework} egress slot); composing it never moves the egress audit.
// ---------------------------------------------------------------------------
check('Test 4: act blurb renders via a non-egress family (no {framework} egress)', () => {
  // The composer must expose an act family that is NOT an egress family.
  const fam = composer.TEMPLATE_FAMILIES && composer.TEMPLATE_FAMILIES.act;
  assert.ok(fam && typeof fam === 'object', 'composer exposes an act template family');
  assert.strictEqual(fam.egress, false, 'the act family is non-egress (no Brain egress)');
  assert.ok(Array.isArray(fam.slots), 'the act family declares slots');
  assert.ok(!fam.slots.includes('framework'),
    'the act family has NO {framework} egress slot (like hats)');

  // Composing the act label never moves the Part-8 egress audit counter.
  const before = composer._auditCallCount();
  const blurb = blurbGen.buildActBlurb(ROOM_STATE.actBlurb);
  const rendered = composer.composeLabel('act', {
    what: blurb.what, helps_with: blurb.helps_with, how: blurb.how,
  });
  const after = composer._auditCallCount();
  assert.strictEqual(after, before, 'composing the act label invokes the egress audit ZERO times');
  assert.ok(rendered && typeof rendered.label === 'string' && rendered.label.length > 0,
    'the act label renders a non-empty string');
  // The rendered label must not leak a raw {slot} placeholder.
  assert.ok(rendered.label.indexOf('{') === -1, 'no raw {slot} placeholder leaks into the label');
});

console.log('');
console.log('test-act-standing-suggestion: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) {
  console.log('Failures:');
  for (const f of failures) console.log('  - ' + f);
  process.exit(1);
}
process.exit(0);
