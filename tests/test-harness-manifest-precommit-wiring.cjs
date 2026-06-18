'use strict';
/*
 * Phase 167-02 Task 2 (D-167-03) - assert the harness-manifest drift guard is
 * wired into the INSTALLABLE pre-commit template.
 *
 * The live .git/hooks/pre-commit copy is NOT git-tracked (standard git
 * convention; both the shipped command-registry and brain-packet-schema guards
 * document this). The tracked source of the live hook is
 * scripts/install-pre-commit.sh -- the template a fresh dev clone runs to
 * inherit every guard. So this test asserts on the TEMPLATE: if the template
 * carries the manifest guard, a fresh clone gets it.
 *
 * This is the regression fence behind D-167-03's "BOTH" requirement: the
 * manifest --check fires at commit time (the live hook + the template here) AND
 * in CI (the run-all-167.sh leg). The connector/projection precedent wired its
 * --check ONLY into a test aggregator; D-167-03 is STRONGER -- it closes that
 * drift gap for the manifest by also wiring the live pre-commit.
 *
 * The test asserts (each failure exits non-zero):
 *
 *   CHECK 1 -- PATH TRIGGER: the template carries a path-scoped
 *     git diff --cached --name-only | grep -qE trigger matching ALL FIVE paths
 *     (the manifest + its generator + the three named source maps:
 *     command-registry / connector-registry / brain-orchestration-projection),
 *     since a change to any source map can stale the manifest digests.
 *
 *   CHECK 2 -- THE --check INVOCATION: the template runs
 *     node ... build-harness-manifest.cjs --check.
 *
 *   CHECK 3 -- RECOVERY LINE: a drift recovery line names
 *     "node scripts/build-harness-manifest.cjs" so the failing committer knows
 *     how to regenerate.
 *
 *   CHECK 4 -- PRECONDITIONS: the manifest guard is guarded by the
 *     command -v node + -f generator preconditions (degrade gracefully when
 *     node or the generator is absent), mirroring the shipped guards.
 *
 *   CHECK 5 -- ADDITIVE (regression guard): the template STILL carries the
 *     command-registry guard and the brain-packet-schema guard. The manifest
 *     block is ADDITIVE; it must not displace the shipped guards.
 *
 *   CHECK 6 -- NO EM-DASH: neither the template nor this test contains the
 *     U+2014 codepoint (referenced by escape, never as a literal).
 *
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const TEMPLATE_PATH = path.join(REPO_ROOT, 'scripts', 'install-pre-commit.sh');
const SELF_PATH = __filename;

let passed = 0;
let failed = 0;
function check(name, fn) {
  try {
    fn();
    passed++;
    console.log('  PASS - ' + name);
  } catch (err) {
    failed++;
    console.error('  FAIL - ' + name);
    console.error('         ' + err.message);
  }
}

const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');

// ---------------------------------------------------------------------------
// CHECK 1 -- PATH TRIGGER: path-scoped trigger naming all five paths.
// ---------------------------------------------------------------------------
check('CHECK 1 - path-scoped trigger matches the manifest + generator + three maps', () => {
  assert.ok(
    /git diff --cached --name-only\s*\|\s*grep -qE/.test(template),
    'template missing a git diff --cached --name-only | grep -qE path-scoped trigger'
  );
  const requiredPaths = [
    'scripts/build-harness-manifest\\.cjs',
    'data/harness-manifest\\.json',
    'data/command-registry\\.json',
    'data/connector-registry\\.json',
    'data/brain-orchestration-projection\\.json',
  ];
  for (const p of requiredPaths) {
    assert.ok(
      template.includes(p),
      'manifest guard path trigger missing path: ' + p
    );
  }
});

// ---------------------------------------------------------------------------
// CHECK 2 -- THE --check INVOCATION.
// ---------------------------------------------------------------------------
check('CHECK 2 - runs node ... build-harness-manifest.cjs --check', () => {
  assert.ok(
    /build-harness-manifest\.cjs"?\s+--check/.test(template),
    'template missing the build-harness-manifest.cjs --check invocation'
  );
});

// ---------------------------------------------------------------------------
// CHECK 3 -- RECOVERY LINE naming the regenerate command.
// ---------------------------------------------------------------------------
check('CHECK 3 - drift recovery line names node scripts/build-harness-manifest.cjs', () => {
  assert.ok(
    template.includes('harness-manifest drift'),
    'template missing the "harness-manifest drift" recovery message'
  );
  assert.ok(
    template.includes('node scripts/build-harness-manifest.cjs'),
    'template recovery line missing the regenerate command node scripts/build-harness-manifest.cjs'
  );
});

// ---------------------------------------------------------------------------
// CHECK 4 -- PRECONDITIONS: command -v node + -f generator before the --check.
// ---------------------------------------------------------------------------
check('CHECK 4 - node-present + generator-present preconditions guard the --check', () => {
  assert.ok(
    /command -v node/.test(template),
    'manifest guard missing the command -v node precondition'
  );
  // The generator-present precondition appears for the manifest generator path.
  assert.ok(
    /\[ -f "[^"]*scripts\/build-harness-manifest\.cjs" \]/.test(template),
    'manifest guard missing the -f generator-present precondition'
  );
});

// ---------------------------------------------------------------------------
// CHECK 5 -- ADDITIVE: the shipped guards are still present (not displaced).
// ---------------------------------------------------------------------------
check('CHECK 5 - additive: command-registry + brain-packet-schema guards still present', () => {
  // The template historically wires check-schema-aliases + check-substrate.
  // The two harness-registry precedents the manifest sits beside live in the
  // LIVE hook; the template additively wires schema-aliases + substrate +
  // (now) the manifest guard. Assert the template did not lose its prior
  // guards when the manifest block was added.
  assert.ok(
    template.includes('check-schema-aliases.cjs'),
    'template lost the schema-aliases guard (manifest block must be additive)'
  );
  assert.ok(
    template.includes('check-substrate.cjs'),
    'template lost the substrate guard (manifest block must be additive)'
  );
});

// ---------------------------------------------------------------------------
// CHECK 6 -- NO EM-DASH in the template or this test (U+2014 via escape).
// ---------------------------------------------------------------------------
check('CHECK 6 - no em-dash (U+2014) in the template or this test', () => {
  const emDash = String.fromCharCode(0x2014);
  assert.ok(
    !template.includes(emDash),
    'template contains a forbidden em-dash (U+2014); use hyphens'
  );
  const self = fs.readFileSync(SELF_PATH, 'utf8');
  assert.ok(
    !self.includes(emDash),
    'this test contains a forbidden em-dash (U+2014); use hyphens'
  );
});

console.log('');
console.log(passed + ' passed, ' + failed + ' failed');
if (failed > 0) {
  process.exit(1);
}
