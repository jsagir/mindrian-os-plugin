#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 121-00 -- frozen v1 telemetry schema acceptance tests.
 *
 * Verifies EVENT_TYPES + ALLOWED_FIELDS contracts from
 * lib/core/telemetry/schema.cjs. The schema is the source of truth that
 * lib/core/telemetry/validator.cjs and lib/core/telemetry/writer.cjs
 * consume. Per Canon Part 8 + D-10 (frozen v1 schema), this contract is
 * locked for the v1 wire forever; future evolution lives in v2 events
 * that coexist in the same JSONL stream (per-row schema_version).
 *
 * Test map (2 cases, one-to-one with the PLAN <behavior> block for Task 1):
 *   1.  EVENT_TYPES is Object.freeze'd array of exactly 15 strings
 *       (6 inherited mva.* + 9 net-new; superset of mva-telemetry.cjs).
 *   2.  ALLOWED_FIELDS keys === EVENT_TYPES set; every value is frozen array.
 *
 * Registered in lib/memory/run-feynman-tests.cjs.
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..', '..', '..');
const SCHEMA_PATH = path.join(REPO, 'lib/core/telemetry/schema.cjs');

try { delete require.cache[require.resolve(SCHEMA_PATH)]; } catch (_) {}
const schema = require(SCHEMA_PATH);

assert.equal(typeof schema, 'object', 'schema module must export an object');
assert.ok(Array.isArray(schema.EVENT_TYPES), 'schema must export EVENT_TYPES array');
assert.equal(typeof schema.ALLOWED_FIELDS, 'object', 'schema must export ALLOWED_FIELDS object');
assert.equal(typeof schema.SCHEMA_VERSION, 'number', 'schema must export numeric SCHEMA_VERSION');

// ---------- Test 1: EVENT_TYPES frozen + exactly 15 entries ----------

(function test1EventTypesFrozen() {
  const expected = [
    'mva_pipeline_started',
    'mva_agent_returned',
    'mva_brief_rendered',
    'mva_option_selected',
    'mva_brief_deployed',
    'mva_pipeline_failed',
    'selector_pick',
    'tension_engagement',
    'auto_explore_decision',
    'breakthrough_dismissed',
    'hooked_axis_score',
    'empathy_observation',
    'room_receipt_written',
    'command_invocation',
    'nav_bypass',
  ];

  assert.equal(schema.EVENT_TYPES.length, 15,
    'EVENT_TYPES must contain exactly 15 entries (6 mva.* + 9 net-new), got ' + schema.EVENT_TYPES.length);
  assert.equal(Object.isFrozen(schema.EVENT_TYPES), true,
    'EVENT_TYPES must be Object.freeze\'d');

  for (const name of expected) {
    assert.ok(schema.EVENT_TYPES.includes(name),
      'EVENT_TYPES missing required event: ' + name);
  }

  // SCHEMA_VERSION must be the literal Number 1 (Canon D-10).
  assert.equal(schema.SCHEMA_VERSION, 1,
    'SCHEMA_VERSION must be Number 1, got ' + schema.SCHEMA_VERSION + ' (typeof=' + typeof schema.SCHEMA_VERSION + ')');

  console.log('PASS test 1: EVENT_TYPES frozen array of 15 strings + SCHEMA_VERSION === 1');
})();

// ---------- Test 2: ALLOWED_FIELDS shape ----------

(function test2AllowedFieldsShape() {
  const keys = Object.keys(schema.ALLOWED_FIELDS);

  // Key parity with EVENT_TYPES.
  assert.equal(keys.length, schema.EVENT_TYPES.length,
    'ALLOWED_FIELDS key count must equal EVENT_TYPES length');
  for (const evt of schema.EVENT_TYPES) {
    assert.ok(keys.includes(evt),
      'ALLOWED_FIELDS missing key for event type: ' + evt);
  }

  // Every value must be a frozen array.
  for (const evt of schema.EVENT_TYPES) {
    const allowed = schema.ALLOWED_FIELDS[evt];
    assert.ok(Array.isArray(allowed),
      'ALLOWED_FIELDS[' + evt + '] must be an array');
    assert.equal(Object.isFrozen(allowed), true,
      'ALLOWED_FIELDS[' + evt + '] must be frozen');
    assert.ok(allowed.length >= 1,
      'ALLOWED_FIELDS[' + evt + '] must have at least 1 allowed field');
  }

  // Spot-check the 9 net-new event types per the plan (D-04 through D-09).
  assert.ok(schema.ALLOWED_FIELDS.selector_pick.includes('sub_shape'));
  assert.ok(schema.ALLOWED_FIELDS.selector_pick.includes('ranker_confidence'));
  assert.ok(schema.ALLOWED_FIELDS.selector_pick.includes('room_slug_sha256'));
  assert.ok(schema.ALLOWED_FIELDS.tension_engagement.includes('ttr_seconds'));
  assert.ok(schema.ALLOWED_FIELDS.auto_explore_decision.includes('domain_match_score'));
  assert.ok(schema.ALLOWED_FIELDS.breakthrough_dismissed.includes('ethics_tier'));
  assert.ok(schema.ALLOWED_FIELDS.hooked_axis_score.includes('axis_name'));
  assert.ok(schema.ALLOWED_FIELDS.empathy_observation.includes('engaged_past_15m'));
  assert.ok(schema.ALLOWED_FIELDS.room_receipt_written.includes('conversation_id_hash'));
  assert.ok(schema.ALLOWED_FIELDS.command_invocation.includes('command'));
  assert.ok(schema.ALLOWED_FIELDS.nav_bypass.includes('caller_hash'));

  // 6 inherited mva.* event types (must mirror lib/core/mva-telemetry.cjs ALLOWED_FIELDS).
  assert.ok(schema.ALLOWED_FIELDS.mva_pipeline_started.includes('sentence_sha256'));
  assert.ok(schema.ALLOWED_FIELDS.mva_agent_returned.includes('duration_ms'));
  assert.ok(schema.ALLOWED_FIELDS.mva_brief_rendered.includes('total_duration_ms'));
  assert.ok(schema.ALLOWED_FIELDS.mva_option_selected.includes('option_id'));
  assert.ok(schema.ALLOWED_FIELDS.mva_brief_deployed.includes('vercel_subdomain_hash'));
  assert.ok(schema.ALLOWED_FIELDS.mva_pipeline_failed.includes('error_short'));

  console.log('PASS test 2: ALLOWED_FIELDS shape (15 frozen arrays; mva.* + 9 net-new spot-checks pass)');
})();

console.log('\nschema.test.cjs: 2/2 tests passed');
