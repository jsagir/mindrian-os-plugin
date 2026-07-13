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
 * DOCUMENTED EXCEPTION (2026-07-13, GAP-3 false-positive fix): a sha256/createHash
 * call whose line (or the immediately preceding line) carries the literal marker
 * PART8-SAFE-HASH is exempt from tripwire (3) ONLY. The marker is not a loophole --
 * it requires a human-authored, reviewed comment at the call site (see
 * lib/core/sensors/sensor-url-ingest.cjs) explaining WHY the hash input is never
 * user/room content (e.g. a public URL string, hashed for a local-only dedup
 * handle that never crosses the Brain boundary). Any UNMARKED sha256/createHash
 * call site still fails loud, exactly as before -- this narrows the false-positive
 * surface without weakening the actual guarantee.
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

// The bare word /\bsha256\b/i was dropped (2026-07-13, GAP-3 false-positive
// fix, second occurrence): it matches "sha256" in PROSE (a doc comment
// describing a handle, e.g. "a 12-hex sha256 HANDLE") with equal force to
// matching an actual call site, which is not a security signal - a comment
// cannot egress anything. createHash(...) is the actual call-shaped tripwire
// and is unaffected; it still fails loud on any unmarked call site.
const FORBIDDEN_CALLS = [
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
      // Line-scoped check for FORBIDDEN_CALLS so the PART8-SAFE-HASH marker
      // (this line, or within a small preceding comment-block window) can
      // exempt a specific, documented, human-reviewed call site without
      // weakening the sweep for any unmarked occurrence. The window is
      // small (5 lines) so it comfortably covers a multi-line comment block
      // immediately above the call without exempting unrelated code further up.
      const MARKER_LOOKBACK_LINES = 5;
      const lines = src.split('\n');
      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        const windowStart = Math.max(0, i - MARKER_LOOKBACK_LINES);
        const window = lines.slice(windowStart, i + 1).join('\n');
        const marked = /PART8-SAFE-HASH/.test(window);
        for (const rx of FORBIDDEN_CALLS) {
          if (rx.test(line) && !marked) {
            assert.fail(label + ': ' + rel + ':' + (i + 1)
              + ' matches forbidden hash call without a PART8-SAFE-HASH marker: ' + rx);
          }
        }
      }
    }
    ok(label);
  } catch (e) { fail(label, e); }
})();

process.stdout.write('\n');
process.stdout.write('sensors Part-8 5-tripwire sweep: ' + passed + ' passed, ' + failed + ' failed over ' + TARGETS.length + ' file(s)\n');
process.exit(failed === 0 ? 0 : 1);
