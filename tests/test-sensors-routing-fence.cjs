'use strict';
/*
 * Phase 143-01 Task 3 -- the Phase 144 routing fence over the sensor module.
 *
 * HARD FENCE (Canon + Phase 144 boundary): the sensors PRODUCE candidate
 * reaches; they must NOT CONSUME the routing decision. The single change of
 * flipping trace.routing_source 'legacy' -> 'engine' and rewriting decide()'s
 * file-presence routing is Phase 144's whole job (NAV-01). No file in the Phase
 * 143 sensor module may do it.
 *
 * This suite greps lib/core/insight-sensors.cjs + every file under
 * lib/core/sensors/ and asserts:
 *   (1) ZERO assignment of routing_source to 'engine'
 *       (regex: routing_source\s*[:=]\s*['"]engine['"])
 *   (2) ZERO rewrite of decide()'s file-presence routing: the sensor module
 *       must not require ./navigation-engine.cjs nor define/call decide().
 *
 * Exits non-zero on any match. Loop-fires discipline: this gate stays in
 * run-all-143.sh so Plans 02/03 inherit it as they add detectors under
 * lib/core/sensors/.
 *
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const SENSORS_DIR = path.join(REPO_ROOT, 'lib', 'core', 'sensors');

// Build the target set: the spine module + every .cjs under lib/core/sensors/.
function collectTargets() {
  const targets = [path.join(REPO_ROOT, 'lib', 'core', 'insight-sensors.cjs')];
  if (fs.existsSync(SENSORS_DIR)) {
    for (const name of fs.readdirSync(SENSORS_DIR)) {
      if (name.endsWith('.cjs')) targets.push(path.join(SENSORS_DIR, name));
    }
  }
  return targets;
}

const TARGETS = collectTargets();

// (1) The routing_source='engine' assignment fence. Matches both object-literal
// (routing_source: 'engine') and assignment (routing_source = 'engine') forms,
// single or double quotes.
const ENGINE_FLIP_RX = /routing_source\s*[:=]\s*['"]engine['"]/;

// (2) decide() routing-rewrite fences: the sensor module must not pull in the
// navigation engine nor define/call decide() (that is Phase 144's surface).
const FORBIDDEN_ENGINE_REQUIRE = /require\s*\(\s*['"][^'"]*navigation-engine[^'"]*['"]\s*\)/;
const FORBIDDEN_DECIDE_DEF = /function\s+decide\s*\(|(^|[^.\w])decide\s*=/m;

let passed = 0;
let failed = 0;
function ok(name) { passed += 1; process.stdout.write('  ok ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.message || String(err)) + '\n');
}

(function test_noEngineFlip() {
  const label = 'Phase 144 fence: no sensor file assigns routing_source = "engine"';
  try {
    assert.ok(TARGETS.length >= 1, label + ': at least the spine module must exist');
    for (const target of TARGETS) {
      const src = fs.readFileSync(target, 'utf8');
      assert.equal(ENGINE_FLIP_RX.test(src), false,
        label + ': ' + path.relative(REPO_ROOT, target) + ' must NOT flip routing_source to engine');
    }
    ok(label);
  } catch (e) { fail(label, e); }
})();

(function test_noDecideRewrite() {
  const label = 'Phase 144 fence: no sensor file requires the navigation engine or defines decide()';
  try {
    for (const target of TARGETS) {
      const src = fs.readFileSync(target, 'utf8');
      assert.equal(FORBIDDEN_ENGINE_REQUIRE.test(src), false,
        label + ': ' + path.relative(REPO_ROOT, target) + ' must NOT require navigation-engine (Phase 144 owns the consumer)');
      assert.equal(FORBIDDEN_DECIDE_DEF.test(src), false,
        label + ': ' + path.relative(REPO_ROOT, target) + ' must NOT define or assign decide() (file-presence routing is Phase 144)');
    }
    ok(label);
  } catch (e) { fail(label, e); }
})();

process.stdout.write('\n');
process.stdout.write('sensors routing fence (Phase 144): ' + passed + ' passed, ' + failed + ' failed over ' + TARGETS.length + ' file(s)\n');
process.exit(failed === 0 ? 0 : 1);
