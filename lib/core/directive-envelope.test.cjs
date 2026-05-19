#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 127-00 (Task 1 RED) -- DirectiveEnvelope wrapper tests.
 *
 * 9 behavior tests covering:
 *   - Tier-0 sentinel (null brainResponse)
 *   - Default GUIDED mode for ordinary responses
 *   - Explicit AUTONOMOUS via "just tell me" / "bottom line"
 *   - HYBRID for mature-room commit-phase signals
 *   - Cold-start FORCES GUIDED (never autonomous)
 *   - user_override map present + the 3 documented keys
 *   - next_gate sub_shape regex + options array
 *   - selectMode default invariant
 *   - DEFAULT_MODE constant exported and locked
 *
 * Canon parts: 2 (Larry pedagogy), 3 (Decision Gate F-shape next_gate),
 *   7 (Reuse Before Build: pure data shaping, zero network surface).
 *
 * Constraints (Phase 87 invariant):
 *   - Node built-ins only (node:assert/strict).
 *   - CJS only.
 *   - Zero new runtime dependencies.
 *
 * HARD RULE: no em-dashes (hyphens only).
 */

const assert = require('node:assert/strict');

let passed = 0;
let failed = 0;

function ok(name) {
  passed += 1;
  process.stdout.write('  ok ' + name + '\n');
}

function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.message || String(err)) + '\n');
}

const mod = require('./directive-envelope.cjs');
const { wrapDirective, selectMode, DEFAULT_MODE } = mod;

// ---------------------------------------------------------------------------
// Test 1: wrapDirective(null, {}) returns Tier-0 sentinel envelope.
// ---------------------------------------------------------------------------
(function test1_tier0Sentinel() {
  const label = 'wrapDirective(null, {}) returns Tier-0 sentinel envelope';
  try {
    const env = wrapDirective(null, {});
    assert.equal(env.packet_version, '1.0', 'packet_version must be "1.0"');
    assert.equal(env.packet_type, 'DirectiveEnvelope', 'packet_type must be "DirectiveEnvelope"');
    assert.equal(env.mode, 'GUIDED', 'Tier-0 mode must be GUIDED');
    assert.equal(env.mode_rationale, 'brain_unreachable',
      'Tier-0 mode_rationale must be "brain_unreachable"; got ' + env.mode_rationale);
    assert.ok(env.directive && typeof env.directive === 'object', 'directive must be an object');
    assert.ok(env.directive.guided && typeof env.directive.guided === 'object',
      'Tier-0 directive.guided must be present');
    assert.ok(Array.isArray(env.directive.guided.questions),
      'Tier-0 directive.guided.questions must be an array');
    ok(label);
  } catch (err) { fail(label, err); }
})();

// ---------------------------------------------------------------------------
// Test 2: ordinary brainResponse with empty signals defaults to GUIDED.
// ---------------------------------------------------------------------------
(function test2_defaultGuided() {
  const label = 'wrapDirective({text:"..."}, {}) defaults to mode=GUIDED';
  try {
    const env = wrapDirective({ text: 'raw brain response' }, {});
    assert.equal(env.mode, 'GUIDED', 'default mode must be GUIDED');
    assert.ok(typeof env.mode_rationale === 'string' && env.mode_rationale.length > 0,
      'mode_rationale must be a non-empty string');
    assert.ok(env.mode_rationale.includes('guided') || env.mode_rationale.includes('pedagogical')
      || env.mode_rationale.includes('default'),
      'mode_rationale for default GUIDED should reference guided/pedagogical/default; got ' + env.mode_rationale);
    ok(label);
  } catch (err) { fail(label, err); }
})();

// ---------------------------------------------------------------------------
// Test 3: explicit AUTONOMOUS via "just tell me" signal.
// ---------------------------------------------------------------------------
(function test3_explicitAutonomous() {
  const label = 'wrapDirective(resp, {user_said_just_tell_me:true}) returns AUTONOMOUS';
  try {
    const env = wrapDirective({ text: 'r' }, { user_said_just_tell_me: true });
    assert.equal(env.mode, 'AUTONOMOUS', 'mode must be AUTONOMOUS');
    assert.equal(env.mode_rationale, 'explicit_user_invitation',
      'mode_rationale must be "explicit_user_invitation"; got ' + env.mode_rationale);
    ok(label);
  } catch (err) { fail(label, err); }
})();

// ---------------------------------------------------------------------------
// Test 4: HYBRID for mature-room commit-phase.
// ---------------------------------------------------------------------------
(function test4_hybridMatureCommit() {
  const label = 'wrapDirective(resp, {session_count:9, room_mature:true, in_commit_phase:true}) returns HYBRID';
  try {
    const env = wrapDirective({ text: 'r' }, {
      session_count: 9,
      room_mature: true,
      in_commit_phase: true,
    });
    assert.equal(env.mode, 'HYBRID', 'mode must be HYBRID; got ' + env.mode);
    assert.equal(env.mode_rationale, 'mature_room_commit_gate',
      'mode_rationale must be "mature_room_commit_gate"; got ' + env.mode_rationale);
    ok(label);
  } catch (err) { fail(label, err); }
})();

// ---------------------------------------------------------------------------
// Test 5: cold start FORCES GUIDED (never autonomous on first material).
// ---------------------------------------------------------------------------
(function test5_coldStartForcesGuided() {
  const label = 'wrapDirective(resp, {is_first_material:true}) returns GUIDED (never autonomous on cold start)';
  try {
    const env = wrapDirective({ text: 'r' }, { is_first_material: true });
    assert.equal(env.mode, 'GUIDED', 'cold-start mode must be GUIDED; got ' + env.mode);
    assert.ok(env.mode_rationale.includes('cold_start'),
      'cold-start mode_rationale must include "cold_start"; got ' + env.mode_rationale);
    ok(label);
  } catch (err) { fail(label, err); }
})();

// ---------------------------------------------------------------------------
// Test 6: every envelope contains user_override with the 3 documented keys.
// ---------------------------------------------------------------------------
(function test6_userOverrideMap() {
  const label = 'every envelope contains user_override map with the 3 documented overrides';
  try {
    const envs = [
      wrapDirective(null, {}),
      wrapDirective({ text: 'r' }, {}),
      wrapDirective({ text: 'r' }, { user_said_just_tell_me: true }),
      wrapDirective({ text: 'r' }, { is_first_material: true }),
    ];
    for (const env of envs) {
      assert.ok(env.user_override && typeof env.user_override === 'object',
        'user_override must be an object');
      assert.ok(Object.prototype.hasOwnProperty.call(env.user_override, 'just tell me'),
        'user_override must have "just tell me" key');
      assert.ok(Object.prototype.hasOwnProperty.call(env.user_override, 'let me think'),
        'user_override must have "let me think" key');
      assert.ok(Object.prototype.hasOwnProperty.call(env.user_override, 'stop'),
        'user_override must have "stop" key');
    }
    ok(label);
  } catch (err) { fail(label, err); }
})();

// ---------------------------------------------------------------------------
// Test 7: every envelope contains next_gate.sub_shape F.[1-5] + options array.
// ---------------------------------------------------------------------------
(function test7_nextGateShape() {
  const label = 'every envelope contains next_gate.sub_shape matching /^F\\.[1-5]$/ and options array';
  try {
    const re = /^F\.[1-5]$/;
    const envs = [
      wrapDirective(null, {}),
      wrapDirective({ text: 'r' }, {}),
      wrapDirective({ text: 'r' }, { user_said_just_tell_me: true }),
      wrapDirective({ text: 'r' }, { session_count: 9, room_mature: true, in_commit_phase: true }),
    ];
    for (const env of envs) {
      assert.ok(env.next_gate && typeof env.next_gate === 'object', 'next_gate must be an object');
      assert.ok(re.test(env.next_gate.sub_shape),
        'next_gate.sub_shape must match F.[1-5]; got ' + env.next_gate.sub_shape);
      assert.ok(Array.isArray(env.next_gate.options),
        'next_gate.options must be an array');
    }
    ok(label);
  } catch (err) { fail(label, err); }
})();

// ---------------------------------------------------------------------------
// Test 8: selectMode returns GUIDED by default with no signals.
// ---------------------------------------------------------------------------
(function test8_selectModeDefault() {
  const label = 'selectMode({}) returns mode=GUIDED by default (DEFAULT_MODE invariant)';
  try {
    const r = selectMode({});
    assert.ok(r && typeof r === 'object', 'selectMode must return an object');
    assert.equal(r.mode, 'GUIDED', 'default selectMode mode must be GUIDED; got ' + r.mode);
    assert.ok(typeof r.rationale === 'string' && r.rationale.length > 0,
      'rationale must be a non-empty string');
    // Non-object input must be treated as empty signals (closed vocabulary).
    const r2 = selectMode(null);
    assert.equal(r2.mode, 'GUIDED', 'selectMode(null) must default to GUIDED');
    const r3 = selectMode(undefined);
    assert.equal(r3.mode, 'GUIDED', 'selectMode(undefined) must default to GUIDED');
    const r4 = selectMode('string');
    assert.equal(r4.mode, 'GUIDED', 'selectMode(non-object) must default to GUIDED');
    ok(label);
  } catch (err) { fail(label, err); }
})();

// ---------------------------------------------------------------------------
// Test 9: DEFAULT_MODE constant exported and locked to 'GUIDED'.
// ---------------------------------------------------------------------------
(function test9_defaultModeConstant() {
  const label = 'DEFAULT_MODE constant exported and === "GUIDED" (Larry pedagogical canon lock)';
  try {
    assert.equal(DEFAULT_MODE, 'GUIDED',
      'DEFAULT_MODE must be exported and equal "GUIDED"; got ' + DEFAULT_MODE);
    assert.equal(typeof DEFAULT_MODE, 'string', 'DEFAULT_MODE must be a string');
    ok(label);
  } catch (err) { fail(label, err); }
})();

// ---------------------------------------------------------------------------
// Summary.
// ---------------------------------------------------------------------------
process.stdout.write('\n');
process.stdout.write('PASSED: ' + passed + '\n');
process.stdout.write('FAILED: ' + failed + '\n');
process.exit(failed === 0 ? 0 : 1);
