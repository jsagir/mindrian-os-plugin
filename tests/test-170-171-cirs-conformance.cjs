'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 172-12 -- the 170/171 CIRS-conformance test (Canon Part 11 INV-11/17).
 *
 * Proves the FIRST CIRS conformance on real shipped surfaces:
 *   Task 1 (Phase 170 / SENS-09): the diffusion/adoption sensor gained a CONTEXT
 *     branch keyed on the navigator problem-state (tuple.problem_type), with the
 *     keyword lexicon DEMOTED to fallback, while still firing the FROZEN
 *     brain_consult reach (no 7th reach minted) and carrying enum-only evidence.
 *   Task 2 (Phase 171 / methodology-ingest): ingestPlan step-5 is a THIN CALLER
 *     of the CIRS born-wired wiring rules -- it emits a connector-block
 *     recommendation (frozen reach + the framework name + a sensor trigger) that
 *     would PASS the coverage gate at ingest, while the step-2 Part-8 boundary
 *     audit (auditSpecPart8) is behaviorally UNCHANGED (still fail-closed).
 *
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert');

const { REACH_IDS, POSTURE_IDS } = require('../lib/core/sensors/sensor-types.cjs');
const { sensorDiffusionAdoption } = require('../lib/core/sensors/sensor-diffusion-adoption.cjs');
const ingest = require('../lib/core/methodology-ingest.cjs');

let pass = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ok - ' + name); pass++; }

console.log('Phase 172-12 -- 170/171 CIRS conformance\n');

// =========================================================================
// Task 1 -- SENS-09 context branch (Phase 170 reconciliation)
// =========================================================================
console.log('Task 1 -- SENS-09 context branch (problem_type primary, keyword fallback)');

// Behavior 1: a diffusion-shaped problem_type (the LOCAL navigator problem-state)
// fires the CONTEXT tier even with NO diffusion lexicon in the turn text.
const ctxFire = sensorDiffusionAdoption(
  { text: 'will the market take this up?', signals: [] },
  { problem_type: 'adoption' }, {});
ok('context branch fires on diffusion problem_type (no keyword present)', ctxFire !== null);
ok('mode recorded is context (not keyword)', ctxFire.evidence.mode === 'context');

// Behavior 2: with NO diffusion problem-state, a bare lexicon hit fires the
// DEMOTED keyword fallback tier (proves keyword is reachable but secondary).
const kwFire = sensorDiffusionAdoption(
  { text: 'a dual-use drone swarm for the navy', signals: [] },
  { problem_type: 'WDP' }, {});
ok('keyword fallback fires when no diffusion context', kwFire !== null);
ok('mode recorded is keyword (the demoted fallback)', kwFire.evidence.mode === 'keyword');

// Behavior 3: SENS-09 still fires the FROZEN brain_consult reach (no 7th reach).
ok('context branch reach is brain_consult', ctxFire.reach_id === 'brain_consult');
ok('keyword branch reach is brain_consult', kwFire.reach_id === 'brain_consult');
ok('reach_id is in the frozen REACH_IDS', REACH_IDS.indexOf(ctxFire.reach_id) !== -1);
ok('posture is in the frozen POSTURE_IDS', POSTURE_IDS.indexOf(ctxFire.posture) !== -1);

// Behavior 4: the evidence carries only enums (mode + trigger_tier + problem_type),
// never matched user text (Part 8).
for (const k of Object.keys(ctxFire.evidence)) {
  const v = ctxFire.evidence[k];
  ok('evidence "' + k + '" is enum/scalar',
    v === null || ['string', 'number', 'boolean'].indexOf(typeof v) !== -1);
}
ok('evidence carries no user prose',
  !Object.values(ctxFire.evidence).some(function (v) {
    return typeof v === 'string' && v.split(' ').length > 3;
  }));
ok('evidence records the trigger_tier enum', 'trigger_tier' in ctxFire.evidence);

// =========================================================================
// Task 2 -- methodology-ingest step-5 as a thin CIRS caller (Phase 171)
// =========================================================================
console.log('\nTask 2 -- methodology-ingest step-5 thin CIRS caller (born-wired)');

const spec = {
  name: 'Demo Diffusion Framework',
  description: 'A generic teaching framework for testing the born-wired path.',
  methodology_tier: 'pws',
  chains_in: ['S-Curve Analysis'],
  chains_out: ['Scenario Planning'],
};

const plan = ingest.ingestPlan(spec);
const step5 = plan.steps.find(function (s) { return s.n === 5; });

// Behavior 1: step-5 references the CIRS born-wired wiring (a connector block +
// the coverage gate), not a free-text hand-wiring checklist.
ok('step-5 id is born-wired (not the legacy trigger checklist)', step5 && step5.id === 'born-wired');
ok('step-5 carries a connector block', step5 && step5.connector && typeof step5.connector === 'object');
ok('step-5 carries a coverage_gate result', step5 && step5.coverage_gate && typeof step5.coverage_gate === 'object');
ok('step-5 detail references CIRS born-wired (R2)', /born-wired|connector|coverage gate/i.test(step5.detail));

// Behavior 2: an ingest spec yields a connector-block recommendation with a
// frozen-6 reach_id + the ingested framework name (born-wired).
const conn = step5.connector;
ok('connector connects_to_spine', conn.connects_to_spine === true);
ok('connector reach_id is in the frozen 6', REACH_IDS.indexOf(conn.reach_id) !== -1);
ok('connector reach_id is brain_consult (SENS-09 precedent, no 7th reach)', conn.reach_id === 'brain_consult');
ok('connector posture is in the frozen 3', POSTURE_IDS.indexOf(conn.posture) !== -1);
ok('connector carries the ingested framework name', conn.framework === 'Demo Diffusion Framework');
ok('connector carries a sensor trigger (context-triggered by default)',
  Array.isArray(conn.sensor_triggers) && conn.sensor_triggers.length >= 1);

// Behavior 3: the step-2 Part-8 boundary audit (auditSpecPart8) is unchanged
// (still fail-closed on user/venture data).
ok('clean spec passes auditSpecPart8', ingest.auditSpecPart8(spec).clean === true);
const dirty = ingest.auditSpecPart8({ name: 'X', description: 'contact me at a@b.com' });
ok('auditSpecPart8 still fails closed on an email (unchanged)', dirty.clean === false);
ok('auditSpecPart8 still fails closed on a room id',
  ingest.auditSpecPart8({ name: 'X', description: 'see room:acme-corp' }).clean === false);
ok('auditSpecPart8 still fails closed on a currency figure',
  ingest.auditSpecPart8({ name: 'X', description: 'raised $1,200,000' }).clean === false);

// Behavior 4: a methodology ingested via this path would PASS the coverage gate
// at ingest (born-wired, not dark).
ok('born-wired connector would PASS the coverage gate', step5.coverage_gate.gate_pass === true);
ok('born-wired connector is WIRED', step5.coverage_gate.wired === true);
ok('gate reasons empty when born-wired', step5.coverage_gate.reasons.length === 0);

// Negative: a spec naming a non-frozen reach is rejected to a frozen reach (R3:
// the thin caller can NEVER recommend a 7th reach).
const conn7 = ingest.bornWiredConnector({ name: 'Y', reach_id: 'made_up_reach' });
ok('bornWiredConnector rejects a non-frozen reach', REACH_IDS.indexOf(conn7.reach_id) !== -1);
ok('wouldPassCoverageGate FAILS a deliberately-broken connector',
  ingest.wouldPassCoverageGate({ connects_to_spine: false }).gate_pass === false);

console.log('\nPASS ' + pass + ' assertions');
