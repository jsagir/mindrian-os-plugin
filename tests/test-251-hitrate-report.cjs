#!/usr/bin/env node
'use strict';

/**
 * Phase 251 Plan 02, Task 2 (CACHE-03 analyzer) -- read-only cache hit-rate
 * analyzer correctness against a synthetic fixture JSONL with known counts.
 * ==========================================================================
 * Proves scripts/cache-hitrate-report.cjs, run against
 * tests/fixtures/cache-hitrate-fixture.jsonl (a fully synthetic, invented
 * transcript -- Part 8 / no-real-content discipline):
 *
 *   1. hit_rate matches the hand-computed fixture value (0.87, two decimals).
 *   2. zero_cache_read_requests === 1; api_requests === 5 (deduped by
 *      requestId -- the fixture repeats req_synthetic_1 once).
 *   3. nav_blocks === 3, consecutive_identical === 1, suppressed_markers === 1.
 *   4. Aggregates only: the JSON report contains no attachment content and
 *      no user text.
 *   5. A nonexistent path exits non-zero with a one-line stderr error; a
 *      directory argument likewise.
 *
 * Black-box CLI tests only (spawnScript), never an in-process require of
 * scripts/cache-hitrate-report.cjs: that script requires
 * scripts/intent-classifier.cjs at module load (for the single-sourced
 * NAV_UNCHANGED_MARKER literal), which reads fd 0 synchronously at load
 * time. Spawning a child with stdio stdin set to 'ignore' gives the child an
 * immediately-EOF stdin (no hang) without this test process ever having to
 * close its OWN fd 0 -- closing fd 0 in-process was tried first and crashed
 * node's child_process spawn path with a libuv assertion
 * (`uv__close: Assertion 'fd > STDERR_FILENO' failed`), so the black-box
 * subprocess design is the correct fix, not a workaround of it. This also
 * tests the real CLI contract end to end, not a reimplementation of it.
 *
 * node --test, CJS, node:assert/strict. No new deps. No em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { test } = require('node:test');

const REPO_ROOT = path.resolve(__dirname, '..');
const SCRIPT_PATH = path.join(REPO_ROOT, 'scripts', 'cache-hitrate-report.cjs');
const FIXTURE_PATH = path.join(REPO_ROOT, 'tests', 'fixtures', 'cache-hitrate-fixture.jsonl');
const FIXTURE_RAW = fs.readFileSync(FIXTURE_PATH, 'utf8');

function spawnScript(args) {
  try {
    const stdout = execFileSync(process.execPath, [SCRIPT_PATH].concat(args), {
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
    });
    return { status: 0, stdout: stdout, stderr: '' };
  } catch (e) {
    return { status: typeof e.status === 'number' ? e.status : 1, stdout: e.stdout || '', stderr: e.stderr || '' };
  }
}

function runReport() {
  assert.ok(fs.existsSync(SCRIPT_PATH), 'scripts/cache-hitrate-report.cjs must exist');
  const result = spawnScript([FIXTURE_PATH, '--json']);
  assert.equal(result.status, 0, 'the analyzer must exit 0 on a valid fixture; stderr: ' + result.stderr);
  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch (_e) {
    assert.fail('the --json output must parse as JSON; got: ' + result.stdout);
  }
  return report;
}

// ---------------------------------------------------------------------------
// Test 1: hit_rate matches the hand-computed fixture value.
// ---------------------------------------------------------------------------
test('Test 1: report.hit_rate matches the hand-computed fixture value (0.87)', () => {
  const report = runReport();
  // Hand-computed from the fixture (see tests/fixtures/cache-hitrate-fixture.jsonl):
  // reads 200+180+190+0+300=870, writes 0+0+40+60+0=100, uncached 0+0+0+30+0=30
  // (req_synthetic_1's SECOND occurrence, reads=555/writes=555/uncached=555,
  // is dropped by requestId dedup and must NOT enter this sum).
  // hit_rate = 870 / (870+100+30) = 870/1000 = 0.87
  assert.equal(report.hit_rate, 0.87, 'hit_rate must equal the hand-computed fixture value');
});

// ---------------------------------------------------------------------------
// Test 2: zero_cache_read_requests === 1; api_requests === 5 (deduped).
// ---------------------------------------------------------------------------
test('Test 2: zero_cache_read_requests === 1; api_requests === 5 (deduped)', () => {
  const report = runReport();
  assert.equal(report.zero_cache_read_requests, 1, 'exactly one deduped record has zero cache reads (req_synthetic_4)');
  assert.equal(report.api_requests, 5, 'api_requests counts 5 UNIQUE requestIds, not the 6 raw usage records');
});

// ---------------------------------------------------------------------------
// Test 3: nav_blocks === 3, consecutive_identical === 1, suppressed_markers === 1.
// ---------------------------------------------------------------------------
test('Test 3: nav_blocks === 3, consecutive_identical === 1, suppressed_markers === 1', () => {
  const report = runReport();
  assert.equal(report.nav_blocks, 3, 'nav_blocks counts every UserPromptSubmit attachment entry');
  assert.equal(report.consecutive_identical, 1, 'the second attachment is byte-identical to the first (one consecutive duplicate)');
  assert.equal(report.suppressed_markers, 1, 'the third attachment equals the exported NAV_UNCHANGED_MARKER (one suppressed marker)');
});

// ---------------------------------------------------------------------------
// Test 4 (aggregates only): the JSON report never leaks attachment content
// or user text.
// ---------------------------------------------------------------------------
test('Test 4 (aggregates only): the report leaks no attachment content and no user text', () => {
  const report = runReport();
  const serialized = JSON.stringify(report);

  assert.equal(serialized.indexOf('SYNTHETIC NAV FIXTURE BLOCK'), -1, 'the fixture NAV block content must not appear in the report');
  assert.equal(serialized.indexOf('fixture_field'), -1, 'NAV block field content must not appear in the report');
  assert.equal(serialized.indexOf('synthetic fixture turn'), -1, 'user turn text must not appear in the report');
  assert.equal(serialized.indexOf('NAV DECISION unchanged'), -1, 'even the marker literal must not appear in the report (aggregates only)');

  // Belt-and-suspenders: no line of the raw fixture, in full, appears in the
  // serialized report.
  for (const line of FIXTURE_RAW.split('\n')) {
    if (!line.trim()) continue;
    assert.equal(serialized.indexOf(line), -1, 'no raw fixture line may appear verbatim in the report');
  }
});

// ---------------------------------------------------------------------------
// Test 5 (defensive CLI): nonexistent path and directory path both exit
// non-zero with a one-line stderr error.
// ---------------------------------------------------------------------------
test('Test 5: nonexistent path and directory argument both exit non-zero with a one-line stderr error', () => {
  assert.ok(fs.existsSync(SCRIPT_PATH), 'scripts/cache-hitrate-report.cjs must exist');

  const nonexistentPath = path.join(os.tmpdir(), 'mindrian-test251b-does-not-exist-' + Date.now() + '.jsonl');
  const resultMissing = spawnScript([nonexistentPath]);
  assert.notEqual(resultMissing.status, 0, 'a nonexistent path must exit non-zero');
  assert.ok(resultMissing.stderr.trim().length > 0, 'a nonexistent path must print a stderr error');
  assert.equal(resultMissing.stderr.trim().split('\n').length, 1, 'the stderr error is exactly one line');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-test251b-dir-'));
  try {
    const resultDir = spawnScript([tmpDir]);
    assert.notEqual(resultDir.status, 0, 'a directory argument must exit non-zero');
    assert.ok(resultDir.stderr.trim().length > 0, 'a directory argument must print a stderr error');
    assert.equal(resultDir.stderr.trim().split('\n').length, 1, 'the stderr error is exactly one line');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
