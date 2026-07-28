#!/usr/bin/env node
/**
 * tests/test-235-release-shape-gate.cjs -- Phase 235-01 Task 2 (CIRS-03).
 *
 * BSL 1.1. Copyright (c) Mindrian 2026.
 *
 * What this proves
 * ----------------
 * scripts/release.sh's `--strict-shape` flag genuinely controls the exit code of
 * the Step 2.4 shape-declaration sub-block:
 *
 *   1. STRICT_SHAPE=1 + a violating checker  -> the block ABORTS (nonzero exit)
 *   2. STRICT_SHAPE=0 + the SAME violating checker -> warn-and-continue (exit 0)
 *   3. STRICT_SHAPE=1 + a clean checker      -> passes (exit 0)
 *
 * Before Phase 235 the block ran `check-shape-declaration.cjs --check || true`
 * unconditionally and never passed --strict at all, so the documented
 * "--strict restores hard-fail" contract was false: the exit code was always
 * swallowed. Case 1 is the regression that would have caught that.
 *
 * Why it EXTRACTS instead of hand-copying
 * ---------------------------------------
 * The block under test is pulled out of the LIVE scripts/release.sh at run time,
 * sliced between the `# SHAPE-GATE-BEGIN` and `# SHAPE-GATE-END` sentinels. A
 * hand-copied snippet in a test file is exactly the dead-seam drift this whole
 * phase exists to eliminate: the copy keeps passing while the shipped script
 * rots. Extracting means the only way to make this test pass is to change the
 * real release path. If the sentinels ever go missing, the test FAILS loudly
 * rather than silently testing nothing.
 *
 * Isolation: the real check-shape-declaration.cjs is never invoked. PLUGIN_DIR
 * is pointed at a temp dir holding a stub .cjs whose exit code the test chooses,
 * so the assertions are about the release script's control flow only.
 * Canon Part 8: zero Brain, zero network, temp dirs only.
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const RELEASE_SH = path.join(REPO_ROOT, 'scripts', 'release.sh');
const BEGIN_SENTINEL = '# SHAPE-GATE-BEGIN';
const END_SENTINEL = '# SHAPE-GATE-END';

let passed = 0;
let failed = 0;

function record(name, fn) {
  try {
    fn();
    passed += 1;
    console.log('  ok  ' + name);
  } catch (err) {
    failed += 1;
    console.log('  FAIL  ' + name);
    console.log('        ' + (err && err.message ? err.message : String(err)));
  }
}

// ---------------------------------------------------------------------------
// Extract the live block from scripts/release.sh (never a hand-copied snippet).
// ---------------------------------------------------------------------------
function extractShapeGateBlock() {
  const src = fs.readFileSync(RELEASE_SH, 'utf8');
  const lines = src.split('\n');
  const beginIdx = lines.findIndex((l) => l.startsWith(BEGIN_SENTINEL));
  const endIdx = lines.findIndex((l) => l.trim() === END_SENTINEL);
  if (beginIdx === -1) {
    throw new Error(
      'sentinel "' + BEGIN_SENTINEL + '" not found in ' + RELEASE_SH +
        ' -- the extraction seam is broken, this test would otherwise silently test nothing'
    );
  }
  if (endIdx === -1) {
    throw new Error(
      'sentinel "' + END_SENTINEL + '" not found in ' + RELEASE_SH +
        ' -- the extraction seam is broken, this test would otherwise silently test nothing'
    );
  }
  if (endIdx <= beginIdx) {
    throw new Error(END_SENTINEL + ' appears before ' + BEGIN_SENTINEL + ' in ' + RELEASE_SH);
  }
  const block = lines.slice(beginIdx + 1, endIdx).join('\n');
  if (!block.trim()) {
    throw new Error('the extracted SHAPE-GATE block is empty');
  }
  return block;
}

// ---------------------------------------------------------------------------
// Run the extracted block with a mocked environment + a stub checker.
//   strictShape : "1" (strict) or "0" (advisory default)
//   stubExit    : the exit code the stub check-shape-declaration.cjs returns
// Returns { status, stdout, stderr }.
// ---------------------------------------------------------------------------
function runBlock(block, strictShape, stubExit) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-235-shape-'));
  try {
    const pluginScripts = path.join(tmp, 'scripts');
    fs.mkdirSync(pluginScripts, { recursive: true });
    fs.writeFileSync(
      path.join(pluginScripts, 'check-shape-declaration.cjs'),
      '#!/usr/bin/env node\n' +
        "// Stub for tests/test-235-release-shape-gate.cjs. Simulates a " +
        (stubExit === 0 ? 'clean tree' : 'seeded violation') + '.\n' +
        "console.error('stub check-shape-declaration: exiting " + stubExit + "');\n" +
        'process.exit(' + stubExit + ');\n',
      'utf8'
    );

    // The prelude supplies exactly the variables the live block references, and
    // reproduces release.sh's own `set -euo pipefail` so the extracted block runs
    // under the same shell strictness it ships under.
    const prelude = [
      '#!/usr/bin/env bash',
      'set -euo pipefail',
      'PLUGIN_DIR="' + tmp + '"',
      'RED=""',
      'GREEN=""',
      'NC=""',
      'STRICT_SHAPE="' + strictShape + '"',
      '',
    ].join('\n');

    const scriptPath = path.join(tmp, 'shape-gate-block.sh');
    fs.writeFileSync(scriptPath, prelude + block + '\n', 'utf8');

    const res = spawnSync('bash', [scriptPath], { encoding: 'utf8' });
    return {
      status: res.status,
      stdout: res.stdout || '',
      stderr: res.stderr || '',
    };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

console.log('');
console.log('Phase 235-01 Task 2 -- release.sh --strict-shape gate (CIRS-03)');
console.log('Source under test: ' + RELEASE_SH + ' (extracted live, not copied)');
console.log('');

const block = extractShapeGateBlock();
console.log('  extracted ' + block.split('\n').length + ' lines between the sentinels');
console.log('');

record('Sub-case 1: --strict-shape + seeded violation ABORTS (nonzero exit)', () => {
  const res = runBlock(block, '1', 1);
  if (res.status === 0) {
    throw new Error(
      'expected a nonzero exit in strict mode with a violating checker, got 0.\n' +
        '        This is the CIRS-03 regression: the exit code is being swallowed.\n' +
        '        stdout: ' + res.stdout.trim()
    );
  }
  if (!/ABORT: shape-declaration gate failed/.test(res.stdout + res.stderr)) {
    throw new Error(
      'expected the ABORT line on the output, got:\n        stdout: ' +
        res.stdout.trim() + '\n        stderr: ' + res.stderr.trim()
    );
  }
});

record('Sub-case 2: default (advisory) + SAME violation warns and continues (exit 0)', () => {
  const res = runBlock(block, '0', 1);
  if (res.status !== 0) {
    throw new Error(
      'expected exit 0 in advisory mode (the Phase 210 contract: WARN, never abort), got ' +
        res.status + '.\n        stdout: ' + res.stdout.trim()
    );
  }
  if (!/advisory as of Phase 210/.test(res.stdout)) {
    throw new Error(
      'expected the advisory note on stdout, got: ' + res.stdout.trim()
    );
  }
});

record('Sub-case 3: --strict-shape + clean tree passes (exit 0)', () => {
  const res = runBlock(block, '1', 0);
  if (res.status !== 0) {
    throw new Error(
      'expected exit 0 in strict mode with a clean checker, got ' + res.status +
        '.\n        stdout: ' + res.stdout.trim() + '\n        stderr: ' + res.stderr.trim()
    );
  }
  if (!/shape-declaration gate passed/.test(res.stdout)) {
    throw new Error('expected the strict-pass line on stdout, got: ' + res.stdout.trim());
  }
});

record('Sentinel integrity: exactly one BEGIN and one END in scripts/release.sh', () => {
  const lines = fs.readFileSync(RELEASE_SH, 'utf8').split('\n');
  const begins = lines.filter((l) => l.startsWith(BEGIN_SENTINEL)).length;
  const ends = lines.filter((l) => l.trim() === END_SENTINEL).length;
  if (begins !== 1) throw new Error('expected exactly 1 ' + BEGIN_SENTINEL + ', found ' + begins);
  if (ends !== 1) throw new Error('expected exactly 1 ' + END_SENTINEL + ', found ' + ends);
});

record('Flag wiring: --strict-shape is parsed and documented in USAGE_BLOCK', () => {
  const src = fs.readFileSync(RELEASE_SH, 'utf8');
  if (!/--strict-shape\)\s+STRICT_SHAPE=1/.test(src)) {
    throw new Error('scripts/release.sh does not parse --strict-shape into STRICT_SHAPE=1');
  }
  if (!/USAGE_BLOCK=.*\[--strict-shape\]/.test(src)) {
    throw new Error('USAGE_BLOCK does not advertise [--strict-shape]');
  }
  if (!/STRICT_SHAPE=0/.test(src)) {
    throw new Error('STRICT_SHAPE is not defaulted to 0 (advisory must stay the default)');
  }
});

console.log('');
console.log('release-shape-gate tests: ' + passed + ' passed, ' + failed + ' failed (of ' + (passed + failed) + ')');
console.log('');

process.exit(failed === 0 ? 0 : 1);
