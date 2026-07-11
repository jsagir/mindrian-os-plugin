'use strict';
/*
 * lib/core/doctor/verify-surface-module.cjs -- Phase 217 Plan 05 (D-01/D-02).
 *
 * The class-D "verify-surface" doctor check, migrated out of the doctor CLI
 * inline main() block into a registry-driven cadence:always runner. This is the
 * one event-driven check of the phase: check() SPAWNS the repo-local end-to-end
 * cascade-surface test (tests/test-cascade-surface-e2e.cjs) with a 30s timeout
 * and asserts the 8-key side-channel shape (Plan 95.1-02, D-06).
 *
 * WHAT check() DOES (moved checkSurfaceVerification verbatim, path re-based):
 * spawnSync of tests/test-cascade-surface-e2e.cjs. The harness-absent branch and
 * the bash-absent (Windows-without-git-bash) branch both return status 'skip' --
 * an install is NEVER faulted for a missing dev harness. exit 0 -> ok; nonzero
 * -> warn. exitCode + runner payload keys preserved for downstream consumers.
 *
 * No fix export (fix_supported false): a live-cascade regression is diagnostic
 * only; there is nothing for the doctor to auto-repair.
 *
 * Canon Part 8: pure LOCAL spawn of a repo-root-resolved constant path -- zero
 * network, zero Brain, zero telemetry. Never back-requires the doctor CLI
 * (circular). Requires only node built-ins + ./shared.cjs (PLUGIN_ROOT).
 *
 * Threat register (Phase 217 Plan 05): T-217-03 (elevation via child spawn) --
 * the child path is a repo-root-resolved CONSTANT (never caller input); the 30s
 * timeout is preserved; an absent harness self-skips (never a fault).
 */

const fs = require('node:fs');
const path = require('node:path');

const { PLUGIN_ROOT } = require('./shared.cjs');

// check(ctx) -- spawns the class-D e2e harness and asserts the 8-key shape.
// Re-based from the doctor CLI (repoRoot = path.resolve(__dirname, '..'),
// one level below root) to lib/core/doctor/ via shared.PLUGIN_ROOT (three '..'
// hops). Cross-platform: bash required for the post-write hook spawn inside the
// test; on Windows-without-git-bash the test self-skips, so we mirror by
// skipping here. Never fault an install for a missing dev harness.
function check(_ctx) {
  const { spawnSync } = require('node:child_process');
  const repoRoot = PLUGIN_ROOT;
  const testPath = path.join(repoRoot, 'tests', 'test-cascade-surface-e2e.cjs');
  if (!fs.existsSync(testPath)) {
    return {
      status: 'skip',
      detail: 'class D test runner not found at ' + path.relative(repoRoot, testPath),
      runner: testPath,
    };
  }
  // Cross-platform: bash required for the post-write hook spawn inside the test.
  // On Windows-without-git-bash, the test will skip itself; we mirror by skipping here.
  if (process.platform === 'win32') {
    const bashCheck = spawnSync('bash', ['--version'], { encoding: 'utf8' });
    if (bashCheck.status !== 0) {
      return {
        status: 'skip',
        detail: 'class D requires bash; not found on Windows host',
        runner: path.relative(repoRoot, testPath),
      };
    }
  }
  const res = spawnSync('node', [testPath], {
    encoding: 'utf8',
    timeout: 30000,
    cwd: repoRoot,
  });
  return {
    status: res.status === 0 ? 'ok' : 'warn',
    detail: res.status === 0
      ? 'side-channel 8-key shape verified end-to-end'
      : 'live cascade test failed (exit ' + res.status + ')',
    exitCode: res.status,
    runner: path.relative(repoRoot, testPath),
    stdout: (res.stdout || '').slice(-500),
    stderr: (res.stderr || '').slice(-500),
  };
}

module.exports = {
  check,
};
