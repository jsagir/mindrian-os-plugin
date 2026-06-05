'use strict';
// Part-8 gate over CASC-02 (Phase 142) -- adversarial Canon Part 8 source sweep
// across the files the getRoomContext -> decide() wiring touches.
//
// Cloned from tests/test-room-context-part8-invariant.cjs (the Phase 90
// 5-tripwire forbidden-substring + forbidden-require pattern, pulled down to a
// plan gate). TARGET set = the CASC-02 wiring surface:
//   - lib/core/navigation-engine.cjs        (decide() -- the wiring site)
//   - lib/core/navigation-engine-shared.cjs (the trace/struct helpers)
//   - scripts/intent-classifier.cjs         (the CASC-02-adjacent classifier)
//
// The sweep asserts the wiring adds NO Brain egress:
//   (1) ZERO require of any *packet* or *brain-client* module in the targets
//   (2) ZERO use of the forbidden egress-projection tokens
//   (3) ZERO sha256 / createHash call sites introduced by the wiring
//
// Plus the POSITIVE wiring anchor (the loop-fires half, mirrors the room-context
// sweep's "must require the neighborhood reader"): navigation-engine.cjs must
// require the navigation.cjs chokepoint -- the only allowed local graph read path
// (Canon Part 9). That require is the proof CASC-02 navigates THROUGH the
// chokepoint rather than reaching for a stored edge directly.
//
// RED now: navigation-engine.cjs does not yet require the navigation chokepoint
// (CASC-02 unwired), so the positive anchor fails. Once Plan 02 wires
// getRoomContext -> decide() through navigation.cjs, the anchor passes and the
// forbidden sweep continues to fence the wiring clean.
//
// House rule: hyphens only, no em-dashes.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

// All three targets get the egress-require + egress-token sweep (no Brain
// egress surface may be added by the wiring).
const TARGETS = [
  path.join(REPO_ROOT, 'lib', 'core', 'navigation-engine.cjs'),
  path.join(REPO_ROOT, 'lib', 'core', 'navigation-engine-shared.cjs'),
  path.join(REPO_ROOT, 'scripts', 'intent-classifier.cjs'),
];

// The hash-call sweep is scoped to the decide() wiring site only. The risk it
// fences is the CASC-02 wiring hashing prose for a Brain query; that path lives
// in the navigation-engine files. intent-classifier.cjs has a pre-existing,
// in-scope-exempt local createHash for a LOCAL correlation id (roomDir + date),
// which is not Brain egress and is out of this gate's scope (SCOPE BOUNDARY).
const HASH_SWEEP_TARGETS = [
  path.join(REPO_ROOT, 'lib', 'core', 'navigation-engine.cjs'),
  path.join(REPO_ROOT, 'lib', 'core', 'navigation-engine-shared.cjs'),
];

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

// (1)-(3) The forbidden sweep over each CASC-02 target.
(function test_forbiddenSweep() {
  const label = 'Part-8 gate: CASC-02 targets carry zero Brain egress (requires/tokens/hashes)';
  try {
    for (const target of TARGETS) {
      assert.equal(fs.existsSync(target), true, label + ': target must exist: ' + target);
      const src = fs.readFileSync(target, 'utf8');

      for (const rx of FORBIDDEN_REQUIRES) {
        assert.equal(rx.test(src), false,
          label + ': ' + path.basename(target) + ' must not match forbidden require: ' + rx);
      }
      for (const tok of FORBIDDEN_TOKENS) {
        assert.equal(src.indexOf(tok), -1,
          label + ': ' + path.basename(target) + ' must not reference the egress-projection token: ' + tok);
      }
    }
    // Hash-call sweep over the decide() wiring site only (intent-classifier's
    // pre-existing LOCAL correlation hash is out of scope).
    for (const target of HASH_SWEEP_TARGETS) {
      const src = fs.readFileSync(target, 'utf8');
      for (const rx of FORBIDDEN_CALLS) {
        assert.equal(rx.test(src), false,
          label + ': ' + path.basename(target) + ' must not match forbidden hash call: ' + rx);
      }
    }
    ok(label);
  } catch (e) {
    fail(label, e);
  }
})();

// POSITIVE wiring anchor: decide() must read through the navigation.cjs chokepoint.
(function test_chokepointWiringAnchor() {
  const label = 'Part-8 gate: navigation-engine.cjs reads the navigated neighborhood via the navigation chokepoint';
  try {
    const enginePath = path.join(REPO_ROOT, 'lib', 'core', 'navigation-engine.cjs');
    const src = fs.readFileSync(enginePath, 'utf8');
    // The only allowed local graph read is via the navigation.cjs chokepoint
    // (Part 9). CASC-02 wires getRoomContext through it.
    assert.match(
      src,
      /require\s*\(\s*['"]\.\/navigation\.cjs['"]\s*\)/,
      label + ': navigation-engine.cjs must require ./navigation.cjs ' +
      '(RED until Plan 02 wires getRoomContext -> decide() through the chokepoint)'
    );
    ok(label);
  } catch (e) {
    fail(label, e);
  }
})();

process.stdout.write('\n');
process.stdout.write('Part-8 gate over CASC-02 (no new egress + chokepoint wiring): ' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed === 0 ? 0 : 1);
