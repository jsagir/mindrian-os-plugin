'use strict';
/*
 * Phase 167-02 Task 2 (D-167-03) - assert the harness-manifest drift guard is
 * wired into the LIVE canonical pre-commit hook.
 *
 * Phase 298-14 repoint (read this before changing TEMPLATE_PATH again):
 * this test originally asserted against scripts/install-pre-commit.sh, on the
 * theory that the live .git/hooks/pre-commit copy is not git-tracked and
 * install-pre-commit.sh was the tracked source a fresh clone inherits its
 * guards from. Phase 235-01 (commits 7409a69f and 43565da3) rewrote
 * install-pre-commit.sh to byte-copy scripts/hooks/pre-commit-room-minto-guard.sh
 * and to author no hook content of its own, so from that point on
 * install-pre-commit.sh carries none of the guard lines this test looks for --
 * the guard is live and correct, the test pointed at the wrong file, and every
 * check below went red. TEMPLATE_PATH now names the canonical guard file
 * directly: scripts/hooks/pre-commit-room-minto-guard.sh, which
 * scripts/hooks/pre-commit is byte-identical to and which install-pre-commit.sh
 * copies verbatim.
 *
 * This is the regression fence behind D-167-03's "BOTH" requirement: the
 * manifest --check fires at commit time (the live hook here) AND in CI (the
 * run-all-167.sh leg). The connector/projection precedent wired its --check
 * ONLY into a test aggregator; D-167-03 is STRONGER -- it closes that drift gap
 * for the manifest by also wiring the live pre-commit.
 *
 * The test asserts (each failure exits non-zero):
 *
 *   CHECK 1 -- PATH TRIGGER: the hook carries a path-scoped
 *     git diff --cached --name-only | grep -qE trigger matching ALL FIVE paths
 *     (the manifest + its generator + the three named source maps:
 *     command-registry / connector-registry / brain-orchestration-projection),
 *     since a change to any source map can stale the manifest digests.
 *
 *   CHECK 2 -- THE --check INVOCATION: the hook runs
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
 *   CHECK 5 -- ADDITIVE (regression guard): the hook STILL carries the
 *     command-registry guard and the brain-packet-schema guard. The manifest
 *     block is ADDITIVE; it must not displace the shipped guards.
 *
 *   CHECK 6 -- NO EM-DASH: neither the hook nor this test contains the
 *     U+2014 codepoint (referenced by escape, never as a literal).
 *
 *   CHECK 7 (Phase 298-14) -- BYTE-IDENTICAL TWIN: scripts/hooks/pre-commit and
 *     scripts/hooks/pre-commit-room-minto-guard.sh stay byte-identical, since a
 *     reinstall via setup-hooks.sh's cmp-then-copy idiom would silently
 *     overwrite whichever file diverged.
 *
 *   CHECK 8 (Phase 298-14) -- TRIGGER WIDENING (Pitfall 6): the drift trigger
 *     fires on data/harness-policies/ and data/harness-fixtures/ so a policy or
 *     fixture edit cannot land with a stale manifest digest. Pinned by
 *     extracting the trigger line and testing it with grep -qE against a
 *     sample staged-path list, not merely asserting the substring is present.
 *
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const TEMPLATE_PATH = path.join(REPO_ROOT, 'scripts', 'hooks', 'pre-commit-room-minto-guard.sh');
const TWIN_PATH = path.join(REPO_ROOT, 'scripts', 'hooks', 'pre-commit');
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

// ---------------------------------------------------------------------------
// CHECK 7 (Phase 298-14) -- BYTE-IDENTICAL TWIN: the two hook files stay
// byte-identical, or a setup-hooks.sh reinstall would overwrite the divergent
// one and silently drop whichever edit was not applied to both.
// ---------------------------------------------------------------------------
check('CHECK 7 - scripts/hooks/pre-commit and scripts/hooks/pre-commit-room-minto-guard.sh stay byte-identical', () => {
  execSync('cmp -s ' + JSON.stringify(TWIN_PATH) + ' ' + JSON.stringify(TEMPLATE_PATH));
});

// ---------------------------------------------------------------------------
// CHECK 8 (Phase 298-14, Pitfall 6) -- TRIGGER WIDENING: the drift trigger
// fires on data/harness-policies/ and data/harness-fixtures/, pinned by
// extracting the trigger line and testing it with grep -qE against a sample
// staged-path list -- would fail if the widening were reverted.
// ---------------------------------------------------------------------------
check('CHECK 8 - drift trigger fires on data/harness-policies/ and data/harness-fixtures/ (Pitfall 6 widening)', () => {
  const lines = template.split('\n');
  const triggerLine = lines.find((l) => /grep -qE '.*build-harness-manifest/.test(l));
  assert.ok(triggerLine, 'could not find the manifest drift trigger line in the hook');
  const match = triggerLine.match(/grep -qE '([^']+)'/);
  assert.ok(match, 'could not extract the trigger regex from the drift trigger line');
  const regex = new RegExp(match[1]);

  const positives = [
    'scripts/build-harness-manifest.cjs',
    'data/harness-manifest.json',
    'data/command-registry.json',
    'data/connector-registry.json',
    'data/brain-orchestration-projection.json',
    'data/harness-policies/gate-card-fire.json',
    'data/harness-fixtures/converged-room/STATE.md',
  ];
  for (const p of positives) {
    assert.ok(regex.test(p), 'widened trigger does not match expected positive path: ' + p);
  }
  const negatives = [
    'data/doctor-modules.json',
    'data/harness-policies/CONTEXT.md.bak',
  ];
  for (const n of negatives) {
    assert.ok(!regex.test(n), 'widened trigger over-matches negative path: ' + n);
  }
});

console.log('');
console.log(passed + ' passed, ' + failed + ' failed');
if (failed > 0) {
  process.exit(1);
}
