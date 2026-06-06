'use strict';
/*
 * Phase 143-01 Task 3 -- the Canon Part 8 5-tripwire sweep over the sensor module.
 *
 * Cloned from the Phase 90 / Phase 142 5-tripwire pattern
 * (tests/test-decide-part8-invariant.cjs). SENS-01 is the Brain-touching sensor
 * in this module (it attaches a brain_framework_chain companion); SENS-03/04 land
 * in Plans 02/03 under lib/core/sensors/. The sweep therefore gates the spine
 * module + every lib/core/sensors/*.cjs and is INHERITED by the downstream plans.
 *
 * The fence asserts the sensor surface adds NO Brain egress:
 *   (1) ZERO require of any *packet* or *brain-client* module
 *   (2) ZERO use of the forbidden egress-projection tokens (projectText/etc)
 *   (3) ZERO sha256 / createHash call sites
 *
 * Canon Part 8: the sensors carry only generic handles (framework names,
 * problem-type enums, phase ids). The brain_framework_chain companion carries
 * ONLY the problem_type enum -- a generic handle, never user content. This sweep
 * is the structural guard that no projection/hash egress surface sneaks in.
 *
 * Exits non-zero on any forbidden match. House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const SENSORS_DIR = path.join(REPO_ROOT, 'lib', 'core', 'sensors');

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

const FORBIDDEN_REQUIRES = [
  /require\s*\(\s*['"][^'"]*packet[^'"]*['"]\s*\)/,
  /require\s*\(\s*['"][^'"]*brain-client[^'"]*['"]\s*\)/,
];

const FORBIDDEN_TOKENS = [
  'projectText',
  'shortText',
  'hashText',
  'safeNodeProjection',
  'safeContradictionProjection',
  'safeUnsupportedProjection',
  'resolvePrivacyMode',
  'PRIVACY_MODES',
];

const FORBIDDEN_CALLS = [
  /\bsha256\b/i,
  /createHash\s*\(/,
];

let passed = 0;
let failed = 0;
function ok(name) { passed += 1; process.stdout.write('  ok ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.message || String(err)) + '\n');
}

(function test_forbiddenSweep() {
  const label = 'Part-8 5-tripwire sweep: sensor module carries zero Brain egress (requires/tokens/hashes)';
  try {
    assert.ok(TARGETS.length >= 1, label + ': at least the spine module must exist');
    for (const target of TARGETS) {
      const rel = path.relative(REPO_ROOT, target);
      const src = fs.readFileSync(target, 'utf8');

      for (const rx of FORBIDDEN_REQUIRES) {
        assert.equal(rx.test(src), false,
          label + ': ' + rel + ' must not match forbidden require: ' + rx);
      }
      for (const tok of FORBIDDEN_TOKENS) {
        assert.equal(src.indexOf(tok), -1,
          label + ': ' + rel + ' must not reference the egress-projection token: ' + tok);
      }
      for (const rx of FORBIDDEN_CALLS) {
        assert.equal(rx.test(src), false,
          label + ': ' + rel + ' must not match forbidden hash call: ' + rx);
      }
    }
    ok(label);
  } catch (e) { fail(label, e); }
})();

process.stdout.write('\n');
process.stdout.write('sensors Part-8 5-tripwire sweep: ' + passed + ' passed, ' + failed + ' failed over ' + TARGETS.length + ' file(s)\n');
process.exit(failed === 0 ? 0 : 1);
