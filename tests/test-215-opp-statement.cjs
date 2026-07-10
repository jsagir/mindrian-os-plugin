#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 215-03 -- Opportunity Statement emitter offline contract tests (Task 1).
 *
 * All assertions run OFFLINE (Canon Part 8: no Brain, no network, no model,
 * no file egress). buildOpportunityStatement is a pure deterministic template
 * over an already-scored candidate; the ONLY external seam is the SEED-050
 * critic gate, exercised here through the _test.setCriticForTest injection so
 * no critic module load or disk probe happens.
 *
 *   Test 1: canonical clause order -- the byte-exact CLAUSE_LABELS markers
 *           appear in the emitted text, in order.
 *   Test 2: every fields slot round-trips non-empty; unmet_need_a/b derive
 *           deterministically from each side's weak_dimensions + primary_problem.
 *   Test 3: novel_application / gap / audience derive from the edge fields.
 *   Test 4: potential_tier maps from the score quartile; tail flag appends the
 *           WEAK-SIGNAL TAIL suffix (the gem flag survives into the banked shape).
 *   Test 5: critic honesty -- absent -> pending/not-banked; stub pass -> banked;
 *           stub fail -> not-banked, verdict carried verbatim.
 *   Test 6: a candidate missing a required slot throws OPP_STATEMENT_INPUT.
 */
'use strict';

const assert = require('node:assert/strict');

const opp = require('../lib/core/eureka/opportunity-statement.cjs');

let passed = 0;
function ok(name) { passed += 1; console.log('  ok   ' + name); }

// A well-formed, fully-scored candidate (arrhythmias pair, structural shape only,
// tier ENUM output -- no real figures, per T-215-07).
function wellFormed() {
  return {
    a: {
      id: 'C16796',
      title: 'Implantable arrhythmia monitor',
      primary_problem: 'undetected atrial fibrillation',
      section: 'cardiology',
      weak_dimensions: ['validated_demand'],
    },
    b: {
      id: 'C03552',
      title: 'Low-power biosignal ASIC',
      primary_problem: 'continuous cardiac telemetry',
      section: 'microelectronics',
      weak_dimensions: ['strategic_fit'],
    },
    shared_problems: ['long-horizon arrhythmia capture'],
    dims: { strategic_fit: 0.6, validated_demand: 0.3, tech_econ_feasibility: 0.7 },
    score: 0.82,
    rank: 1,
    tail: false,
  };
}

// Reset the critic seam to the real (guarded-require) path between tests.
function resetCritic() { opp._test.setCriticForTest(); }

// ---------- Test 1: canonical clause order ----------
{
  resetCritic();
  opp._test.setCriticForTest(null); // deterministic pending, keeps the text pure
  const r = opp.buildOpportunityStatement(wellFormed());
  assert.ok(Array.isArray(opp.CLAUSE_LABELS), 'Test 1: CLAUSE_LABELS is an array');
  assert.ok(opp.CLAUSE_LABELS.length >= 8, 'Test 1: at least 8 frozen clause markers');
  // every marker appears, in order, in the emitted text
  let cursor = -1;
  for (const label of opp.CLAUSE_LABELS) {
    const at = r.text.indexOf(label, cursor + 1);
    assert.ok(at > cursor, 'Test 1: marker "' + label + '" appears after the previous one');
    cursor = at;
  }
  // the three anchor markers Task-1 acceptance greps for
  assert.ok(r.text.indexOf('Combining ') === 0, 'Test 1: text opens with "Combining "');
  assert.ok(r.text.indexOf('. Key risks: ') > 0, 'Test 1: carries the Key risks clause');
  assert.ok(r.text.indexOf('. Estimated potential: ') > 0, 'Test 1: carries the Estimated potential clause');
  ok('Test 1: canonical clause order emitted byte-stably from CLAUSE_LABELS');
}

// ---------- Test 2: fields round-trip + unmet-need derivation ----------
{
  resetCritic();
  opp._test.setCriticForTest(null);
  const r = opp.buildOpportunityStatement(wellFormed());
  const slots = ['tech_a', 'unmet_need_a', 'tech_b', 'unmet_need_b', 'novel_application',
    'gap', 'audience', 'risks', 'next_steps', 'potential_tier', 'score_label'];
  for (const s of slots) {
    assert.ok(typeof r.fields[s] === 'string' && r.fields[s].length > 0, 'Test 2: slot ' + s + ' non-empty');
  }
  assert.equal(r.fields.tech_a, 'Implantable arrhythmia monitor', 'Test 2: tech_a title');
  assert.equal(r.fields.tech_b, 'Low-power biosignal ASIC', 'Test 2: tech_b title');
  // a weak on validated_demand -> unvalidated demand around <primary_problem>
  assert.equal(r.fields.unmet_need_a, 'unvalidated demand around undetected atrial fibrillation',
    'Test 2: validated_demand weakness -> unvalidated-demand phrasing');
  // b weak on strategic_fit -> no strategic home for <primary_problem>
  assert.equal(r.fields.unmet_need_b, 'no strategic home for continuous cardiac telemetry',
    'Test 2: strategic_fit weakness -> no-strategic-home phrasing');

  // feasibility-weak side
  const cFeas = wellFormed();
  cFeas.a.weak_dimensions = ['tech_econ_feasibility'];
  const rFeas = opp.buildOpportunityStatement(cFeas);
  assert.equal(rFeas.fields.unmet_need_a, 'unproven feasibility path for undetected atrial fibrillation',
    'Test 2: tech_econ_feasibility weakness -> unproven-feasibility phrasing');

  // no weak dimension -> underexploited reach
  const cNone = wellFormed();
  cNone.a.weak_dimensions = [];
  const rNone = opp.buildOpportunityStatement(cNone);
  assert.equal(rNone.fields.unmet_need_a, 'underexploited reach of undetected atrial fibrillation',
    'Test 2: no weakness -> underexploited-reach phrasing');
  ok('Test 2: fields round-trip non-empty; unmet-need derives from weak-dimension reasoning');
}

// ---------- Test 3: edge-derived slots ----------
{
  resetCritic();
  opp._test.setCriticForTest(null);
  const r = opp.buildOpportunityStatement(wellFormed());
  assert.equal(r.fields.novel_application, 'cardiology x microelectronics approach to long-horizon arrhythmia capture',
    'Test 3: novel_application = section_a x section_b approach to first shared_problem');
  assert.equal(r.fields.gap, 'the long-horizon arrhythmia capture gap neither side closes alone',
    'Test 3: gap phrasing over the first shared_problem');
  assert.equal(r.fields.audience, 'tech-transfer / portfolio operators triaging long-horizon arrhythmia capture assets',
    'Test 3: audience phrasing over the first shared_problem');
  ok('Test 3: novel_application / gap / audience derive from the CONVERGES edge');
}

// ---------- Test 4: potential_tier quartile map + tail suffix ----------
{
  resetCritic();
  opp._test.setCriticForTest(null);
  function tierAt(score, tail) {
    const c = wellFormed();
    c.score = score;
    c.tail = !!tail;
    return opp.buildOpportunityStatement(c).fields.potential_tier;
  }
  assert.equal(tierAt(0.80), 'tier-1 (portfolio-lead)', 'Test 4: >=0.75 -> tier-1');
  assert.equal(tierAt(0.60), 'tier-2 (develop)', 'Test 4: >=0.5 -> tier-2');
  assert.equal(tierAt(0.30), 'tier-3 (watch)', 'Test 4: >=0.25 -> tier-3');
  assert.equal(tierAt(0.10), 'tier-4 (park)', 'Test 4: <0.25 -> tier-4');
  assert.equal(tierAt(0.30, true), 'tier-3 (watch) - WEAK-SIGNAL TAIL',
    'Test 4: tail flag appends the WEAK-SIGNAL TAIL suffix');
  ok('Test 4: potential_tier quartile map + the gem-flag tail suffix');
}

// ---------- Test 5: critic honesty (pending / pass / fail) ----------
{
  resetCritic();
  // (a) absent critic -> pending, never banked
  opp._test.setCriticForTest(null);
  const rPending = opp.buildOpportunityStatement(wellFormed());
  assert.equal(rPending.critic, 'pending', 'Test 5: absent critic -> critic pending');
  assert.equal(rPending.banked, false, 'Test 5: pending is NEVER banked (Pitfall 4)');

  // (b) stub PASS verdict -> banked, verdict carried
  const passVerdict = { pass: true, verdict: 'transferable', reasoning_tag: 'passes_all_gates' };
  opp._test.setCriticForTest(function () { return passVerdict; });
  const rPass = opp.buildOpportunityStatement(wellFormed());
  assert.equal(rPass.banked, true, 'Test 5: a passing critic verdict banks the statement');
  assert.deepEqual(rPass.critic, passVerdict, 'Test 5: the pass verdict is carried verbatim');

  // (c) stub FAIL verdict -> not banked, verdict carried
  const failVerdict = { pass: false, verdict: 'restatement', reasoning_tag: 'low_novelty_delta' };
  opp._test.setCriticForTest(function () { return failVerdict; });
  const rFail = opp.buildOpportunityStatement(wellFormed());
  assert.equal(rFail.banked, false, 'Test 5: a failing critic verdict does NOT bank');
  assert.deepEqual(rFail.critic, failVerdict, 'Test 5: the fail verdict is carried verbatim');
  resetCritic();
  ok('Test 5: critic gate provably honest in all three states (pending / pass / fail)');
}

// ---------- Test 6: malformed input throws OPP_STATEMENT_INPUT ----------
{
  resetCritic();
  opp._test.setCriticForTest(null);
  const bad = wellFormed();
  delete bad.a.title;
  assert.throws(
    () => opp.buildOpportunityStatement(bad),
    /OPP_STATEMENT_INPUT/,
    'Test 6: missing a required slot throws OPP_STATEMENT_INPUT'
  );
  ok('Test 6: a candidate missing a required slot throws OPP_STATEMENT_INPUT');
}

console.log('\ntest-215-opp-statement: ' + passed + ' assertions passed');
