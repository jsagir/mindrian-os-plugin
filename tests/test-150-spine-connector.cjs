'use strict';
/*
 * Phase 150-05 (MEM-05, D-05) -- the spine connector + memory-cortex sensor.
 * ========================================================================
 * Wave-0 RED suite. Asserts the four behaviors the plan contracts:
 *
 *   (1) REGISTRY: data/connector-registry.json (after regeneration) carries an
 *       entry whose surface is the new memory-cortex reach command; its reach_id
 *       is in the FROZEN 6 (cross_room or context_block), its framework is null,
 *       and its filing is memory_event_only.
 *
 *   (2) SENSOR MEMBERSHIP: lib/core/insight-sensors.cjs exposes sensorMemoryCortex
 *       in SENSOR_REGISTRY (by function name) so dispatchSensors fires it.
 *
 *   (3) SENSOR FIRE: sensorMemoryCortex(turn, tuple, ctx) returns a candidate
 *       reach (reach_id in the frozen 6, posture in the frozen 3) when ctx carries
 *       a stale-governing-thought signal AND, separately, a fresh-contradiction
 *       signal; a malformed ctx ({}) returns null (soft-fail, never throws).
 *
 *   (4) NO em-dash / en-dash in the new command .md or the sensor source.
 *
 * RED-by-design: the sensor module + the command .md do not exist yet, and the
 * registry has not been regenerated, so the suite FAILS until Tasks 2-3 land. A
 * missing connector-registry.json is guarded with a clear FAIL message, not a
 * crash.
 *
 * Plain CJS node:assert/strict; PASS line + non-zero exit on failure.
 *
 * Any asserted forbidden dash codepoint is referenced via String.fromCharCode so
 * THIS file stays greppably clean. NO em-dashes anywhere (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

// The frozen-6 reach ids + the frozen-3 postures, loaded from the SINGLE source
// of truth so this test can never drift from the dial doctrine.
const { REACH_IDS, POSTURE_IDS } = require(
  path.join(REPO_ROOT, 'lib', 'core', 'sensors', 'sensor-types.cjs')
);

// The em-dash + en-dash codepoints, referenced indirectly so this file stays
// greppably clean of the literal glyphs.
const EM_DASH = String.fromCharCode(0x2014);
const EN_DASH = String.fromCharCode(0x2013);

// The new command surface + sensor module the plan ships.
const COMMAND_MD = path.join(REPO_ROOT, 'commands', 'memory-cortex-reach.md');
const SENSOR_SRC = path.join(REPO_ROOT, 'lib', 'core', 'sensors', 'sensor-memory-cortex.cjs');
const REGISTRY_PATH = path.join(REPO_ROOT, 'data', 'connector-registry.json');

let failures = 0;
function check(name, fn) {
  try {
    fn();
    process.stdout.write('  ok   ' + name + '\n');
  } catch (e) {
    failures++;
    process.stdout.write('  FAIL ' + name + '\n       ' + String(e && e.message) + '\n');
  }
}

process.stdout.write('test-150-spine-connector.cjs\n');

// ========================================================================
// (1) REGISTRY: the memory-cortex connector entry
// ========================================================================

check('(1) connector-registry.json carries the memory-cortex reach surface (frozen-6 reach, framework null, memory_event_only)', () => {
  assert.ok(fs.existsSync(REGISTRY_PATH),
    'data/connector-registry.json is missing -- run: node scripts/build-connector-registry.cjs');

  const reg = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  const connectors = Array.isArray(reg && reg.connectors) ? reg.connectors : [];

  // Find the connector whose surface is the new memory-cortex reach command.
  const entry = connectors.find(
    (c) => c && typeof c.surface === 'string' && /memory-cortex/.test(c.surface)
  );
  assert.ok(entry, 'a connector whose surface mentions memory-cortex must exist in the registry');

  // reach_id is one of the frozen 6, and specifically cross_room or context_block
  // (the minimal Part-8-safe LOCAL/memory-bridge reaches).
  assert.ok(REACH_IDS.indexOf(entry.reach_id) !== -1,
    'reach_id ' + entry.reach_id + ' must be in the frozen 6');
  assert.ok(entry.reach_id === 'cross_room' || entry.reach_id === 'context_block',
    'reach_id must be cross_room or context_block (no 7th reach minted), got ' + entry.reach_id);

  // framework is null (avoids the framework-resolution path -- minimal shape).
  assert.equal(entry.framework, null, 'framework must be null');

  // filing is memory_event_only (the Part-8-safe minimal write hook).
  assert.equal(entry.filing, 'memory_event_only', 'filing must be memory_event_only');
});

// ========================================================================
// (2) SENSOR MEMBERSHIP: sensorMemoryCortex is in SENSOR_REGISTRY
// ========================================================================

check('(2) sensorMemoryCortex is registered in SENSOR_REGISTRY (dispatchSensors will fire it)', () => {
  const mod = require(path.join(REPO_ROOT, 'lib', 'core', 'insight-sensors.cjs'));
  assert.ok(Array.isArray(mod.SENSOR_REGISTRY), 'SENSOR_REGISTRY must be an array');
  const names = mod.SENSOR_REGISTRY.map((fn) => (typeof fn === 'function' ? fn.name : ''));
  assert.ok(names.indexOf('sensorMemoryCortex') !== -1,
    'sensorMemoryCortex must be present in SENSOR_REGISTRY by function name; found: ' + names.join(', '));
  assert.equal(typeof mod.sensorMemoryCortex, 'function',
    'insight-sensors must export sensorMemoryCortex');
});

// ========================================================================
// (3) SENSOR FIRE: stale governing thought OR fresh contradiction
// ========================================================================

check('(3) sensorMemoryCortex FIRES on a stale governing thought (frozen-6 reach + frozen-3 posture)', () => {
  const mod = require(path.join(REPO_ROOT, 'lib', 'core', 'insight-sensors.cjs'));
  const turn = { text: '', signals: [] };
  const tuple = { problem_type: 'WDP' };
  const ctx = { staleGoverningThought: true };
  const reach = mod.sensorMemoryCortex(turn, tuple, ctx);
  assert.ok(reach && typeof reach === 'object', 'a stale governing thought must produce a candidate reach');
  assert.ok(REACH_IDS.indexOf(reach.reach_id) !== -1, 'reach_id must be in the frozen 6');
  assert.ok(POSTURE_IDS.indexOf(reach.posture) !== -1, 'posture must be in the frozen 3');
});

check('(3) sensorMemoryCortex FIRES on a fresh contradiction (frozen-6 reach + frozen-3 posture)', () => {
  const mod = require(path.join(REPO_ROOT, 'lib', 'core', 'insight-sensors.cjs'));
  const turn = { text: '', signals: [] };
  const tuple = { problem_type: 'IDP' };
  const ctx = { freshContradictions: 2 };
  const reach = mod.sensorMemoryCortex(turn, tuple, ctx);
  assert.ok(reach && typeof reach === 'object', 'a fresh contradiction must produce a candidate reach');
  assert.ok(REACH_IDS.indexOf(reach.reach_id) !== -1, 'reach_id must be in the frozen 6');
  assert.ok(POSTURE_IDS.indexOf(reach.posture) !== -1, 'posture must be in the frozen 3');
});

check('(3) sensorMemoryCortex SOFT-FAILS to null on a malformed/empty ctx (never throws)', () => {
  const mod = require(path.join(REPO_ROOT, 'lib', 'core', 'insight-sensors.cjs'));
  const turn = { text: '', signals: [] };
  assert.equal(mod.sensorMemoryCortex(turn, {}, {}), null, 'empty ctx -> null');
  assert.equal(mod.sensorMemoryCortex(turn, {}, null), null, 'null ctx -> null');
  assert.equal(mod.sensorMemoryCortex(null, null, undefined), null, 'all-null -> null');
});

check('(3) the new sensor is wired into dispatchSensors (fires through the chokepoint)', () => {
  const mod = require(path.join(REPO_ROOT, 'lib', 'core', 'insight-sensors.cjs'));
  const turn = { text: '', signals: [] };
  const reaches = mod.dispatchSensors(turn, { problem_type: 'WDP' }, { staleGoverningThought: true });
  const signals = reaches.map((r) => r && r.signal);
  assert.ok(signals.indexOf('memory_cortex') !== -1,
    'dispatchSensors must surface the memory_cortex signal when the cortex signals; got: ' + signals.join(', '));
});

// ========================================================================
// (4) NO em-dash / en-dash in the new command .md or sensor source
// ========================================================================

check('(4) no em-dash / en-dash in commands/memory-cortex-reach.md', () => {
  assert.ok(fs.existsSync(COMMAND_MD), 'commands/memory-cortex-reach.md must exist');
  const src = fs.readFileSync(COMMAND_MD, 'utf8');
  assert.equal(src.indexOf(EM_DASH), -1, 'no em-dash allowed in the command .md');
  assert.equal(src.indexOf(EN_DASH), -1, 'no en-dash allowed in the command .md');
});

check('(4) no em-dash / en-dash in lib/core/sensors/sensor-memory-cortex.cjs', () => {
  assert.ok(fs.existsSync(SENSOR_SRC), 'sensor-memory-cortex.cjs must exist');
  const src = fs.readFileSync(SENSOR_SRC, 'utf8');
  assert.equal(src.indexOf(EM_DASH), -1, 'no em-dash allowed in the sensor source');
  assert.equal(src.indexOf(EN_DASH), -1, 'no en-dash allowed in the sensor source');
});

// ---------- Summary ----------

if (failures > 0) {
  process.stdout.write('\n  ' + failures + ' check(s) FAILED\n');
  process.exit(1);
}
process.stdout.write('\n  all checks passed\n');
process.exit(0);
