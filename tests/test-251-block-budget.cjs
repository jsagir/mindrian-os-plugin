#!/usr/bin/env node
'use strict';

/**
 * Phase 251 Plan 02, Task 1 (CACHE-03 budget + CACHE-02 doctrine leg) --
 * block-size budget fence + first-party cache doctrine.
 * ==========================================================================
 * Proves:
 *
 *   1. scripts/intent-classifier.cjs exports NAV_BLOCK_BUDGET_BYTES, a
 *      positive integer <= 1200 (the ceiling below the measured 1,275 B
 *      pre-hygiene average).
 *   2. The composed engine-arm fixture block's Buffer.byteLength fits inside
 *      NAV_BLOCK_BUDGET_BYTES (the post-251-01 block fits with headroom --
 *      the headroom IS the Brain-reach allowance).
 *   3. docs/HOOK-INJECTION-CACHE-DOCTRINE.md exists and carries the required
 *      content fence (mechanism, refuted hypothesis, three levers, do-not
 *      list, the measurement citation, the budget name) with ZERO em-dash
 *      codepoints (U+2014).
 *   4. The constant's adjacent source comment names CACHE-03 within 10 lines
 *      of NAV_BLOCK_BUDGET_BYTES (the rider-rule binding).
 *
 * node --test, CJS, node:assert/strict. No new deps. No em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

// See tests/test-251-suppress-unchanged.cjs for the full rationale: node
// --test isolates this file in a child process whose fd 0 stays an open,
// unclosed pipe, and scripts/intent-classifier.cjs reads fd 0 synchronously
// at module-load time. Closing fd 0 first makes that read fail fast (EBADF,
// caught, degrades to ''). Test-only; the module itself is untouched.
try { fs.closeSync(0); } catch (_e) { /* already closed or unavailable */ }

const REPO_ROOT = path.resolve(__dirname, '..');
const IC_PATH = path.join(REPO_ROOT, 'scripts', 'intent-classifier.cjs');
const DOCTRINE_PATH = path.join(REPO_ROOT, 'docs', 'HOOK-INJECTION-CACHE-DOCTRINE.md');
const ic = require(IC_PATH);

// The engine-arm fixture harness, reused verbatim from
// tests/test-251-suppress-unchanged.cjs (the shared fixture across the whole
// 251 suite -- the same fixture that produced the 816 B "Combined" number in
// the 251-01 SUMMARY's before/after byte table).
function engineDecisionFixture() {
  return {
    fire_skill: 'discover',
    suppress_skills: [],
    decision_trace: { brain_md_tier_mode: 'tier_0', chosen_rationale: 'first reason' },
  };
}

// ---------------------------------------------------------------------------
// Test 1 (constant): NAV_BLOCK_BUDGET_BYTES exported, positive integer, <= 1200.
// ---------------------------------------------------------------------------
test('Test 1 (constant): NAV_BLOCK_BUDGET_BYTES exists, positive integer, <= 1200', () => {
  assert.equal(typeof ic.NAV_BLOCK_BUDGET_BYTES, 'number', 'NAV_BLOCK_BUDGET_BYTES must be exported as a number');
  assert.ok(Number.isInteger(ic.NAV_BLOCK_BUDGET_BYTES), 'NAV_BLOCK_BUDGET_BYTES must be an integer');
  assert.ok(ic.NAV_BLOCK_BUDGET_BYTES > 0, 'NAV_BLOCK_BUDGET_BYTES must be positive');
  assert.ok(
    ic.NAV_BLOCK_BUDGET_BYTES <= 1200,
    'NAV_BLOCK_BUDGET_BYTES must stay at or below 1200 (the ceiling below the measured 1,275 B pre-hygiene average); got ' + ic.NAV_BLOCK_BUDGET_BYTES
  );
  process.stdout.write('  [251-02a] NAV_BLOCK_BUDGET_BYTES: ' + ic.NAV_BLOCK_BUDGET_BYTES + '\n');
});

// ---------------------------------------------------------------------------
// Test 2 (fixture within budget): the composed engine-arm fixture block fits
// inside NAV_BLOCK_BUDGET_BYTES with headroom.
// ---------------------------------------------------------------------------
test('Test 2 (fixture within budget): the fixture block fits inside NAV_BLOCK_BUDGET_BYTES', () => {
  const block = ic.renderEngineDecisionWithDial(
    engineDecisionFixture(),
    { source: 'engine' },
    '',
    { cortexNodes: [] }
  );
  const bytes = Buffer.byteLength(block, 'utf8');
  process.stdout.write('  [251-02a] fixture block bytes (post-251-01): ' + bytes + '\n');
  assert.ok(
    bytes <= ic.NAV_BLOCK_BUDGET_BYTES,
    'the post-251-01 fixture block (' + bytes + ' B) must fit inside NAV_BLOCK_BUDGET_BYTES (' + ic.NAV_BLOCK_BUDGET_BYTES + ' B)'
  );
  const headroom = ic.NAV_BLOCK_BUDGET_BYTES - bytes;
  process.stdout.write('  [251-02a] headroom (the Brain-reach allowance): ' + headroom + ' B\n');
  assert.ok(headroom > 0, 'there must be positive headroom for the future Brain reach');
});

// ---------------------------------------------------------------------------
// Test 3 (doctrine doc content fence): the doc exists and carries every
// required phrase, plus zero em-dash codepoints (U+2014).
// ---------------------------------------------------------------------------
test('Test 3 (doctrine doc content fence): required content present, zero em-dashes', () => {
  assert.ok(fs.existsSync(DOCTRINE_PATH), 'docs/HOOK-INJECTION-CACHE-DOCTRINE.md must exist');
  const doc = fs.readFileSync(DOCTRINE_PATH, 'utf8');

  const required = [
    'append-accumulation',
    'cache-safe by construction',
    '251-CACHE-MEASUREMENT',
    'NAV_BLOCK_BUDGET_BYTES',
    'cache_control',
    'prefix pinning',
    'size',
    'dedup',
    'emission discipline',
  ];
  for (const phrase of required) {
    assert.ok(doc.indexOf(phrase) !== -1, 'doctrine doc must contain: ' + phrase);
  }

  // U+2014 codepoint escape, never a literal em-dash character in this test
  // source (mirrors tests/run-all-251.sh's grep -P '\x{2014}' fence).
  const EM_DASH = String.fromCodePoint(0x2014);
  assert.equal(doc.indexOf(EM_DASH), -1, 'doctrine doc must carry zero em-dash (U+2014) codepoints');
});

// ---------------------------------------------------------------------------
// Test 4 (budget names the rider rule): the constant's adjacent comment
// names CACHE-03 within 10 lines of NAV_BLOCK_BUDGET_BYTES.
// ---------------------------------------------------------------------------
test('Test 4 (budget names the rider rule): CACHE-03 named within 10 lines of the constant', () => {
  const source = fs.readFileSync(IC_PATH, 'utf8');
  const lines = source.split('\n');
  const declIdx = lines.findIndex(function (l) { return /NAV_BLOCK_BUDGET_BYTES\s*=/.test(l); });
  assert.ok(declIdx !== -1, 'NAV_BLOCK_BUDGET_BYTES declaration must exist in scripts/intent-classifier.cjs');

  const windowStart = Math.max(0, declIdx - 10);
  const window = lines.slice(windowStart, declIdx + 1).join('\n');
  assert.match(window, /CACHE-03/, 'the adjacent comment block must name CACHE-03 within 10 lines of the declaration');
});
