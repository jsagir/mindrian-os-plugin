#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 121.5-09 -- Coherence Smoke Test wrapper (Sub-plan H acceptance).
 *
 * Wraps scripts/coherence-smoke-test.cjs with node:test assertions. The harness
 * automates STRUCTURE (the 5 steps + tri-polar + tripwires); this wrapper
 * encodes the structural acceptance criteria from CONTEXT.md (1..13). The
 * COHERENCE acceptance is human-verified at the Task 2 checkpoint.
 *
 * Tests 1-5  : step orchestration (cold start, first material, /mos: command,
 *              decision gate, tension re-surface).
 * Tests 6-8  : tri-polar verification (CLI / Desktop / Cowork).
 * Test 9     : all 5 CI tripwires cross-check.
 * Test 10    : four-questions evidence check (Larry / 🎯 or JTBD / 📊 or context
 *              / next move OR action footer).
 *
 * Canon Part 3 (Tri-Context Decision Gate): F frame fixture renders.
 * Canon Part 4 (Every Choice Is Graph Data): selectors emit typed edges.
 * Canon Part 6 (Product-as-Venture): the plugin runs its own canon against itself.
 * Canon Part 7 (Reuse Before Build): no new commands; ONE harness consolidates 5
 *   CI tripwires + 5 walk steps.
 * Canon Part 8 (Graph Boundary): LOCAL only -- subprocess + filesystem only.
 * Canon Part 10 (Conversation as Product): coherence walk is the precondition
 *   citation for v1.13.0 FINAL RELEASE GATE.
 *
 * Pure CJS, node built-ins only.
 */
'use strict';

const { test } = require('node:test');
const { ok, equal } = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const harness = require(path.join(REPO_ROOT, 'scripts', 'coherence-smoke-test.cjs'));

// ---------------------------------------------------------------------------
// Test 1: Step 1 (cold start) -- envelope under budget + version + Larry
// ---------------------------------------------------------------------------

test('Test 1: Step 1 cold start emits envelope under budget with version + Larry', async () => {
  const r = await harness.step1_cold_start();
  ok(r, 'step1 returns a result object');
  equal(r.envelope_under_budget, true, 'envelope <= 2000 chars');
  equal(r.envelope_has_version, true, 'envelope contains "MindrianOS v<n>"');
  equal(r.banner_has_version, true, 'banner stdout contains "MindrianOS v<n>"');
  // envelope_mentions_larry is best-effort (depends on contributor state) -- not
  // hard-asserted here. The four_questions check below catches it.
});

// ---------------------------------------------------------------------------
// Test 2: Step 2 (first material upload) -- single coherent voice
// ---------------------------------------------------------------------------

test('Test 2: Step 2 first material yields one coherent voice (no flood)', async () => {
  const r = await harness.step2_first_material_upload();
  ok(r, 'step2 returns a result object');
  equal(r.single_coherent_voice, true, 'no more than 1 "Larry:" attribution line');
  ok(typeof r.tmp_room === 'string' && r.tmp_room.length > 0, 'tmp_room path returned');
});

// ---------------------------------------------------------------------------
// Test 3: Step 3 (/mos:help) -- 11 group labels across all 3 dispatch modes
// ---------------------------------------------------------------------------

test('Test 3: Step 3 /mos:help renders all 11 group labels in all 3 modes', async () => {
  const r = await harness.step3_mos_command();
  ok(r && Array.isArray(r.modes) && r.modes.length === 3, 'exactly 3 dispatch modes');
  equal(r.all_groups_present, true, 'all 11 group labels present in every mode');
});

// ---------------------------------------------------------------------------
// Test 4: Step 4 (decision gate) -- SKILL.md drift + F frame fixture
// ---------------------------------------------------------------------------

test('Test 4: Step 4 decision gate -- SKILL.md drift GREEN + F frame fixture canonical', async () => {
  const r = await harness.step4_decision_gate();
  equal(r.skill_drift_valid, true, 'check-skill-vs-code-drift.cjs exits 0');
  equal(r.f_frame_has_filled_square, true, 'F frame starts with filled square');
  equal(r.f_frame_has_tri_context, true, 'F frame contains LOCAL / BRAIN / SIGNAL strip');
  equal(r.f_frame_has_free_text_last, true, 'F frame last option is Free-Text');
});

// ---------------------------------------------------------------------------
// Test 5: Step 5 (tension re-surface) -- envelope under budget with tension
// ---------------------------------------------------------------------------

test('Test 5: Step 5 tension re-surface keeps envelope under budget', async () => {
  const r = await harness.step5_tension_resurface();
  ok(r, 'step5 returns a result object');
  equal(r.envelope_under_budget, true, 'envelope <= 2000 chars under synthetic worst case');
});

// ---------------------------------------------------------------------------
// Test 5b: Synthetic worst case via direct coordinator runAll -- D-15 invariant
// ---------------------------------------------------------------------------

test('Test 5b: Synthetic worst case via runAll() honors precedence (top-3 stay full)', async () => {
  const r = await harness.synthetic_worst_case_runAll();
  ok(r, 'synthetic worst case returns a result object');
  ok(r.body_length <= 2000, 'body <= 2000 chars after compression');
  equal(r.install_drift_full, true, 'install-drift (priority 1) stays at full_payload');
  equal(r.sealed_room_full, true, 'sealed-room (priority 2) stays at full_payload');
  equal(r.tension_hook_full, true, 'tension-hook (priority 3) stays at full_payload');
  equal(r.operator_compressed_or_dropped, true, 'operator (priority 9) compressed or dropped');
});

// ---------------------------------------------------------------------------
// Test 6: Tri-polar CLI -- truecolor branch fires
// ---------------------------------------------------------------------------

test('Test 6: CLI dispatch emits truecolor ANSI codes', () => {
  const r = harness.tri_polar_checks();
  equal(r.cli_has_truecolor, true, 'CLI with COLORTERM=truecolor emits 24-bit ANSI');
});

// ---------------------------------------------------------------------------
// Test 7: Tri-polar Desktop -- ASCII branch fires (zero \x1b codes)
// ---------------------------------------------------------------------------

test('Test 7: Desktop dispatch (CLAUDE_DESKTOP=1) emits ASCII without ANSI codes', () => {
  const r = harness.tri_polar_checks();
  equal(r.desktop_is_ascii, true, 'Desktop output contains zero ANSI escape sequences');
});

// ---------------------------------------------------------------------------
// Test 8: Tri-polar Cowork -- matches CLI byte-identical
// ---------------------------------------------------------------------------

test('Test 8: Cowork dispatch matches CLI byte-identical (no surface divergence)', () => {
  const r = harness.tri_polar_checks();
  equal(r.cowork_matches_cli, true, 'Cowork (COWORK_SESSION_ID set) byte-identical to CLI');
});

// ---------------------------------------------------------------------------
// Test 9: Cross-check ALL 5 CI tripwires exit 0
// ---------------------------------------------------------------------------

test('Test 9: All 5 CI tripwires exit 0 in the cross-check', () => {
  const r = harness.cross_check_all_tripwires();
  const expected = [
    'audit-body-shape-coverage.cjs',
    'check-skill-vs-code-drift.cjs',
    'check-palette-consistency.cjs',
    'disposition-render-v2.cjs',
    'check-help-coverage.cjs',
  ];
  for (const t of expected) {
    ok(r[t], 'tripwire result block exists for ' + t);
    equal(r[t].ok, true, 'tripwire ' + t + ' exit 0');
  }
});

// ---------------------------------------------------------------------------
// Test 10: Four-questions evidence in captured outputs
// ---------------------------------------------------------------------------

test('Test 10: Four canonical questions have grep-verifiable evidence', async () => {
  const r = await harness.runAll();
  ok(r && r.four_questions, 'runAll produces four_questions block');
  // The four canonical questions per CONTEXT.md Sub-plan H:
  //   1. Who am I talking to?   Larry by name
  //   2. What job am I in?      JTBD marker (🎯 or "JTBD")
  //   3. How much runway?       Context bar (📊 or "context")
  //   4. What is next?          Next move / Action / F selector marker
  equal(r.four_questions.who_am_i_talking_to, true, 'Larry named in evidence corpus');
  equal(r.four_questions.what_job_am_i_in, true, 'JTBD marker present in evidence corpus');
  equal(r.four_questions.how_much_runway, true, 'context marker present in evidence corpus');
  equal(r.four_questions.whats_next, true, 'next-move / Action / F selector marker present');
});
