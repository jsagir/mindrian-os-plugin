#!/usr/bin/env node
'use strict';

/**
 * Phase 143.3-01 -- connector-registry generator + drift-tripwire tests.
 *
 * The bash-runner entrypoint tests/test-connector-registry.cjs re-requires this
 * file (no duplication), mirroring the Phase 122 command-registry split so the
 * bash suite and the Feynman suite share one implementation.
 * Run: node lib/memory/connector-registry.test.cjs
 * Exit 0 on pass, throws (assert) on any fail.
 *
 * Assertion groups:
 *   1. `node scripts/build-connector-registry.cjs --check` exits 0 -- the
 *      committed registry is non-stale AND every framework resolves.
 *   2. data/connector-registry.json shape: ontology_ref, generated_note,
 *      connectors[], sensor_index, framework_index.
 *   3. Frozen-bank conformance: every connector reach_id is in REACH_IDS and
 *      posture in POSTURE_IDS (requiring lib/core/sensors/sensor-types.cjs).
 *      Vacuously true until Plan 02 retrofits the cohort -- the moment a
 *      connector lands, a drift reach_id/posture fails here.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const REGISTRY_PATH = path.join(REPO_ROOT, 'data', 'connector-registry.json');
const GENERATOR = path.join(REPO_ROOT, 'scripts', 'build-connector-registry.cjs');
const { REACH_IDS, POSTURE_IDS } = require(path.join(
  REPO_ROOT,
  'lib',
  'core',
  'sensors',
  'sensor-types.cjs'
));

let passed = 0;
function test(name, fn) {
  fn();
  process.stdout.write('  ok  ' + name + '\n');
  passed += 1;
}

// ---------------------------------------------------------------------------
// 1. --check exits 0
// ---------------------------------------------------------------------------
test('build-connector-registry.cjs --check exits 0 (non-stale, all frameworks resolve)', () => {
  const r = spawnSync('node', [GENERATOR, '--check'], { cwd: REPO_ROOT, encoding: 'utf8' });
  assert.strictEqual(
    r.status,
    0,
    'connector-registry must not be stale and must have no unresolvable framework. stderr: ' +
      (r.stderr || '').trim()
  );
});

// ---------------------------------------------------------------------------
// 2. registry shape
// ---------------------------------------------------------------------------
test('registry shape: ontology_ref + generated_note + connectors + sensor_index + framework_index', () => {
  const reg = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  assert.strictEqual(reg.ontology_ref, 'data/framework-names.json', 'ontology_ref points at the snapshot');
  assert.ok(typeof reg.generated_note === 'string' && reg.generated_note.length > 0, 'generated_note present');
  assert.ok(Array.isArray(reg.connectors), 'connectors is an array');
  assert.ok(reg.sensor_index && typeof reg.sensor_index === 'object', 'sensor_index is an object');
  assert.ok(reg.framework_index && typeof reg.framework_index === 'object', 'framework_index is an object');
});

// ---------------------------------------------------------------------------
// 3. frozen-bank conformance (reach_id in REACH_IDS, posture in POSTURE_IDS)
// ---------------------------------------------------------------------------
test('every connector reach_id is in REACH_IDS and posture in POSTURE_IDS (frozen banks)', () => {
  const reg = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  for (const c of reg.connectors) {
    if (c.reach_id !== null && c.reach_id !== undefined) {
      assert.ok(
        REACH_IDS.includes(c.reach_id),
        'connector reach_id is one of the frozen 6: ' + c.surface + ' -> ' + c.reach_id
      );
    }
    if (c.posture !== null && c.posture !== undefined) {
      assert.ok(
        POSTURE_IDS.includes(c.posture),
        'connector posture is one of the frozen 3: ' + c.surface + ' -> ' + c.posture
      );
    }
  }
});

process.stdout.write('connector-registry.test.cjs: ' + passed + ' assertion group(s) PASSED\n');
process.exit(0);
