#!/usr/bin/env node
'use strict';

/*
 * Phase 106 Plan 04 -- statusline surface-detect helper test.
 *
 * Tests lib/statusline/surface-detect.cjs detectStatuslineSurface() which
 * returns one of the literal strings 'CLI' | 'DESKTOP' | 'COWORK' for
 * hook-time / doctor-time surface routing. NOT to be confused with
 * lib/mcp/surface-detect.cjs (different consumer, lowercase strings).
 *
 * Strategy: spawn a child node process that requires the helper and
 * prints its return value; parent varies env per test for hermetic
 * isolation from the parent runner's actual env/TTY state.
 *
 * Replaces Wave 0 stub created by Plan 106-00.
 * Registered in lib/memory/run-feynman-tests.cjs.
 */

const assert = require('node:assert');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const HELPER = path.join(REPO_ROOT, 'lib', 'statusline', 'surface-detect.cjs');

// Run the helper in a child process with controlled env.
function run(env, opts) {
  opts = opts || {};
  const code = "process.stdout.write(require(" + JSON.stringify(HELPER) + ").detectStatuslineSurface());";
  // 'inherit' on stdin to inherit TTY when available; 'pipe' makes it non-TTY.
  const stdin = opts.tty ? 'inherit' : 'pipe';
  return spawnSync(process.execPath, ['-e', code], {
    env: Object.assign({}, env),
    encoding: 'utf8',
    stdio: [stdin, 'pipe', 'pipe'],
  });
}

let passed = 0;
let failed = 0;
function pass(n) { passed += 1; console.log('PASS: ' + n); }
function failTest(n, e) { failed += 1; console.log('FAIL: ' + n + '\n    ' + (e && e.message || e)); }

// Test 1: CLAUDE_DESKTOP=1 -> DESKTOP
try {
  const r = run({ CLAUDE_DESKTOP: '1', PATH: process.env.PATH });
  assert.strictEqual(r.status, 0, 'exit 0; stderr=' + r.stderr);
  assert.strictEqual(r.stdout.trim(), 'DESKTOP');
  pass('Test 1 (CLAUDE_DESKTOP=1 -> DESKTOP)');
} catch (e) { failTest('Test 1 (CLAUDE_DESKTOP=1 -> DESKTOP)', e); }

// Test 2: COWORK_SESSION_ID -> COWORK
try {
  const r = run({ COWORK_SESSION_ID: 'abc123', PATH: process.env.PATH });
  assert.strictEqual(r.status, 0);
  assert.strictEqual(r.stdout.trim(), 'COWORK');
  pass('Test 2 (COWORK_SESSION_ID -> COWORK)');
} catch (e) { failTest('Test 2 (COWORK_SESSION_ID -> COWORK)', e); }

// Test 3: TTY-inherited stdin, no env signals -> one of the three literals.
// (Best-effort: CI runners are typically non-TTY. The never-null contract
// means we always land on a literal; in CI, that's DESKTOP.)
try {
  const r = run({ PATH: process.env.PATH }, { tty: true });
  assert.strictEqual(r.status, 0);
  const out = r.stdout.trim();
  assert.ok(['CLI', 'DESKTOP', 'COWORK'].includes(out),
    'one of three literals; got: ' + JSON.stringify(out));
  pass('Test 3 (no env, TTY-inherited -> one of CLI/DESKTOP/COWORK)');
} catch (e) { failTest('Test 3 (no env, TTY-inherited -> one of CLI/DESKTOP/COWORK)', e); }

// Test 4: piped (non-TTY) stdin, no env -> DESKTOP (safe default).
try {
  const r = run({ PATH: process.env.PATH });
  assert.strictEqual(r.status, 0);
  assert.strictEqual(r.stdout.trim(), 'DESKTOP', 'non-TTY no-env defaults to DESKTOP');
  pass('Test 4 (non-TTY no-env -> DESKTOP)');
} catch (e) { failTest('Test 4 (non-TTY no-env -> DESKTOP)', e); }

// Test 5: never-null contract -- repeated invocations always return a literal.
try {
  for (let i = 0; i < 5; i += 1) {
    const r = run({ PATH: process.env.PATH });
    assert.strictEqual(r.status, 0);
    const out = r.stdout.trim();
    assert.ok(['CLI', 'DESKTOP', 'COWORK'].includes(out),
      'iter ' + i + ' got: ' + JSON.stringify(out));
  }
  pass('Test 5 (never-null contract -- 5 invocations all return literal)');
} catch (e) { failTest('Test 5 (never-null contract)', e); }

// Test 6: explicit MINDRIAN_STATUSLINE_SURFACE override beats CLAUDE_DESKTOP.
try {
  const r = run({
    MINDRIAN_STATUSLINE_SURFACE: 'CLI',
    CLAUDE_DESKTOP: '1',
    PATH: process.env.PATH,
  });
  assert.strictEqual(r.status, 0);
  assert.strictEqual(r.stdout.trim(), 'CLI', 'explicit override beats CLAUDE_DESKTOP env');
  pass('Test 6 (explicit override beats env)');
} catch (e) { failTest('Test 6 (explicit override beats env)', e); }

// Test 7: CLAUDE_CODE_ENTRYPOINT='cli' + non-TTY stdin -> CLI.
// This is the regression guard for the v1.12.5 bug where CC-CLI Bash-tool
// invocations (always non-TTY) fell through to default DESKTOP, suppressing
// the D-02 statusline broadcast and the D-03 visibility check.
try {
  const r = run({ CLAUDE_CODE_ENTRYPOINT: 'cli', PATH: process.env.PATH });
  assert.strictEqual(r.status, 0, 'exit 0; stderr=' + r.stderr);
  assert.strictEqual(r.stdout.trim(), 'CLI',
    'non-TTY child with CLAUDE_CODE_ENTRYPOINT=cli must classify as CLI');
  pass('Test 7 (CLAUDE_CODE_ENTRYPOINT=cli + non-TTY -> CLI; regression guard)');
} catch (e) { failTest('Test 7 (CLAUDE_CODE_ENTRYPOINT=cli + non-TTY -> CLI)', e); }

// Test 8: CLAUDE_DESKTOP=1 wins over CLAUDE_CODE_ENTRYPOINT=cli.
// Defensive ordering: if Anthropic ever ships a Desktop build that also
// exports CLAUDE_CODE_ENTRYPOINT=cli, the explicit Desktop flag overrides.
try {
  const r = run({
    CLAUDE_DESKTOP: '1',
    CLAUDE_CODE_ENTRYPOINT: 'cli',
    PATH: process.env.PATH,
  });
  assert.strictEqual(r.status, 0);
  assert.strictEqual(r.stdout.trim(), 'DESKTOP',
    'CLAUDE_DESKTOP must outrank CLAUDE_CODE_ENTRYPOINT');
  pass('Test 8 (CLAUDE_DESKTOP=1 outranks CLAUDE_CODE_ENTRYPOINT=cli)');
} catch (e) { failTest('Test 8 (CLAUDE_DESKTOP outranks entrypoint)', e); }

// Test 9: COWORK_SESSION_ID wins over CLAUDE_CODE_ENTRYPOINT=cli.
// Never misclassify a Cowork session as CLI just because someone runs
// `claude` inside it.
try {
  const r = run({
    COWORK_SESSION_ID: 'abc123',
    CLAUDE_CODE_ENTRYPOINT: 'cli',
    PATH: process.env.PATH,
  });
  assert.strictEqual(r.status, 0);
  assert.strictEqual(r.stdout.trim(), 'COWORK',
    'COWORK_SESSION_ID must outrank CLAUDE_CODE_ENTRYPOINT');
  pass('Test 9 (COWORK_SESSION_ID outranks CLAUDE_CODE_ENTRYPOINT=cli)');
} catch (e) { failTest('Test 9 (COWORK outranks entrypoint)', e); }

// Test 10: strict-equality on the entrypoint literal -- only 'cli' triggers.
// Future CC entrypoints (e.g. 'mcp', 'ide') must NOT silently classify as CLI.
try {
  const r = run({ CLAUDE_CODE_ENTRYPOINT: 'mcp', PATH: process.env.PATH });
  assert.strictEqual(r.status, 0);
  assert.strictEqual(r.stdout.trim(), 'DESKTOP',
    'unrecognized entrypoint value must fall through to default');
  pass('Test 10 (CLAUDE_CODE_ENTRYPOINT=mcp does not trigger CLI)');
} catch (e) { failTest('Test 10 (entrypoint strict-equality)', e); }

if (failed > 0) {
  console.log('\n' + failed + ' test(s) FAILED');
  process.exit(1);
}
console.log('\nAll 10 tests PASS');
process.exit(0);
