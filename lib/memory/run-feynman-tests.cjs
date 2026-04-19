#!/usr/bin/env node
'use strict';

/**
 * Phase 81-01 test runner for the Feynman-MINTO foundation work.
 *
 * Discovers and runs test files that belong to the Feynman-MINTO pipeline:
 *   - lib/memory/feynman-prompts.test.cjs
 *   - lib/memory/narrative-schema.test.cjs
 *   - scripts/vault-section-minto-generator.test.cjs
 *
 * Runs each in a child process so a module-level assertion failure in one
 * file does not short-circuit the rest of the suite. Exits 0 on all pass,
 * 1 on any failure. Mirrors the lib/import/run-all-tests.cjs pattern.
 *
 * Usage:
 *   MINTO_FROZEN_DATE=2026-04-14 node lib/memory/run-feynman-tests.cjs
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// Defense-in-depth against browser-hijack during suite runs. Any test that
// ends up calling platform.openBrowser() will honor this and skip the real
// spawn while still exercising the localhost URL guard. Individual tests
// (e.g. dashboard-server.test.cjs) also set this locally; setting it at
// runner scope protects future tests that forget.
process.env.MINDRIAN_OPEN_BROWSER_DISABLE = '1';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

const TEST_FILES = [
  path.join(REPO_ROOT, 'lib', 'memory', 'feynman-prompts.test.cjs'),
  path.join(REPO_ROOT, 'lib', 'memory', 'narrative-schema.test.cjs'),
  path.join(REPO_ROOT, 'scripts', 'vault-section-minto-generator.test.cjs'),
  // Phase 81-02 additions:
  path.join(REPO_ROOT, 'lib', 'memory', 'feynman-prompts-drift.test.cjs'),
  path.join(
    REPO_ROOT,
    'scripts',
    'vault-section-minto-generator.integration.test.cjs'
  ),
  // Phase 81-04:
  path.join(REPO_ROOT, 'scripts', 'vault-regenerate-all.test.cjs'),
  // Phase 82-04: wiki artifact injection fixture-based tests.
  path.join(REPO_ROOT, 'scripts', 'generate-presentation.test.cjs'),
  // Phase 83-04: cross-session scope injection Tier 1 tests.
  path.join(REPO_ROOT, 'scripts', '83-scope-injection.test.cjs'),
  // Phase 83-05: hook dispatch scaffold smoke tests.
  path.join(REPO_ROOT, 'test', '83-hook-dispatch.test.cjs'),
  // Phase 83-06: filesystem write interception (Tier 1.5) tests.
  path.join(REPO_ROOT, 'test', '83-write-scope-check.test.cjs'),
  // Phase 83-07: mid-session intent classifier (Tier 2) tests.
  path.join(REPO_ROOT, 'test', '83-intent-classifier.test.cjs'),
  // Phase 83-08: honesty layer markdown test.
  path.join(REPO_ROOT, 'test', '83-honesty-layer.test.cjs'),
  // Phase 84-08: smart notebook co-pilot fixture-based test suite (15 live + 3 skip-gated).
  path.join(REPO_ROOT, 'test', '84-smart-notebook-copilot.test.cjs'),
  // Phase 85-04 (WIN-FIX-F-02): run-hook.cmd exit-code propagation regression fence.
  path.join(REPO_ROOT, 'tests', 'test-run-hook-cmd.cjs'),
  // Phase 85-08 (WIN-FIX-I): brain-client param schema regression (Finding I, v1.10.9).
  path.join(REPO_ROOT, 'tests', 'test-brain-client-params.cjs'),
  // Phase 85-09 (Finding J / LASZLO-001): self-update Windows failure family regression fence.
  path.join(REPO_ROOT, 'tests', 'test-self-update-platform.cjs'),
  // Phase 85-06 (WIN-FIX-H-02/H-03): cross-platform banner rendering regression fence.
  path.join(REPO_ROOT, 'tests', 'test-session-start-banner.cjs'),
  // Phase 87-00: cascade e2e acceptance gate fixture (exits 77 when env
  // degraded; the runner below treats 77 as SKIPPED, not FAILED).
  path.join(REPO_ROOT, 'test', 'fixtures', 'cascade-e2e', 'cascade-e2e.test.cjs'),
  // Phase 87-02: atomic write-lock concurrency fence (20 forked workers,
  // exactly 1 winner) -- proves fs.openSync('wx') TOCTOU fix.
  path.join(REPO_ROOT, 'lib', 'memory', 'write-lock-atomic.test.cjs'),
  // Phase 87-01: security trifecta (SEC-01 Cypher sanitization + SEC-02
  // API key file permissions + SEC-03 HSI timeout 5000 -> 30000).
  path.join(REPO_ROOT, 'lib', 'memory', 'security-trifecta.test.cjs'),
  // Phase 87-01a: ROOM.md + MINTO.md pre-commit hook (SEC-04). Worktree-safe
  // installer + .room-root sentinel scoping + symlink-safe walker + Windows
  // .cmd companion + session-start self-heal.
  path.join(REPO_ROOT, 'lib', 'memory', 'room-minto-hook.test.cjs'),
  // Phase 87-08: live dashboard Node server (scripts/serve-dashboard-live).
  // Covers openBrowser localhost guard, Stream-A chat-hide, MOS_BIND_ALL
  // refusal, and /api/room/* endpoint integration.
  path.join(REPO_ROOT, 'lib', 'memory', 'dashboard-server.test.cjs'),
];

// Exit code convention for child tests:
//   0  -> PASS
//   77 -> SKIPPED (POSIX test-infra-broken; e.g. missing python3, missing
//         scripts/classify-insight). Must NOT count as failure.
//   other (including 1) -> FAIL.
let failed = 0;
let skipped = 0;
for (const t of TEST_FILES) {
  const rel = path.relative(REPO_ROOT, t);
  if (!fs.existsSync(t)) {
    process.stderr.write('MISS ' + rel + ' (file does not exist)\n');
    failed += 1;
    continue;
  }
  const res = spawnSync(process.execPath, [t], { stdio: 'inherit' });
  if (res.status === 0) {
    process.stdout.write('PASS ' + rel + '\n');
  } else if (res.status === 77) {
    process.stdout.write('SKIP ' + rel + ' (exit 77, env degraded)\n');
    skipped += 1;
  } else {
    process.stderr.write('FAIL ' + rel + ' (exit ' + res.status + ')\n');
    failed += 1;
  }
}

const total = TEST_FILES.length;
const passed = total - failed - skipped;
process.stdout.write(
  '\nFeynman test runner: ' +
    passed + '/' + total + ' passed, ' +
    skipped + ' skipped, ' +
    failed + ' failed\n'
);
process.exit(failed === 0 ? 0 : 1);
