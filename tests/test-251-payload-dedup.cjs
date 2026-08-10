#!/usr/bin/env node
'use strict';

/**
 * Phase 251 Plan 01, Task 3 (CACHE-02c) -- kill the verb-line duplication in
 * the [AskUserQuestion payload: ...] line.
 * ==========================================================================
 * Proves the injected payload line stops repeating the verb labels already
 * printed in the option rows above it (~300 B/block of pure duplication,
 * 251-CACHE-MEASUREMENT.md section 2):
 *
 *   1. The payload carries EXACTLY shape/mode/verb_count/recommended -- no
 *      verbs array; verb_count is a positive integer matching the byte-frozen
 *      marker's verbs=N; recommended survives when the contract carries one.
 *   2. None of the non-recommended verb label strings appear inside the
 *      payload JSON substring (the recommended verb IS allowed to appear,
 *      by design: it is the differentiator, not a duplicate list).
 *   3. The persisted f1_closer_payload (next-turn consumer) is UNTOUCHED:
 *      the traceEntry assignment still guards on Array.isArray(f1Payload.verbs).
 *   4. The deduped payload line is at least 150 bytes smaller than the
 *      pre-dedup (verbs-array) shape for the 3-verb fixture.
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
const ic = require(IC_PATH);
const presenter = require(path.join(REPO_ROOT, 'lib', 'hmi', 'dial-presenter.cjs'));

function engineDecisionFixture() {
  return {
    fire_skill: 'discover',
    suppress_skills: [],
    decision_trace: { brain_md_tier_mode: 'tier_0' },
  };
}

function extractPayloadLine(block) {
  const m = block.match(/\[AskUserQuestion payload: (\{.*\})\]/);
  if (!m) return null;
  return { line: '[AskUserQuestion payload: ' + m[1] + ']', json: m[1] };
}

// A stubbed dial render with a KNOWN recommended verb, so Test 1/2 can prove
// the dedup + the recommended-only exception without depending on the live
// dial's mode-selection logic to happen to pick a recommended verb.
function withStubbedRecommendedRender(fn) {
  const orig = presenter.renderDial;
  presenter.renderDial = function () {
    return {
      text: '■ header\n▷ Verb Alpha\n▷ Verb Beta\n▷ Verb Gamma',
      zones: { header: 'h', body: 'b', footer: '' },
      contract: { shape: 'F.1', mode: 'A', verbs: ['Verb Alpha', 'Verb Beta', 'Verb Gamma'], recommended: 'Verb Alpha' },
    };
  };
  try {
    return fn();
  } finally {
    presenter.renderDial = orig;
  }
}

// ---------------------------------------------------------------------------
// Test 1 (shape): the payload carries exactly shape/mode/verb_count/recommended.
// ---------------------------------------------------------------------------
test('Test 1 (shape): payload carries shape/mode/verb_count/recommended, no verbs array', () => {
  const block = withStubbedRecommendedRender(function () {
    return ic.renderEngineDecisionWithDial(engineDecisionFixture(), { source: 'engine' }, '', { cortexNodes: [] });
  });
  const payload = extractPayloadLine(block);
  assert.ok(payload, 'block carries an [AskUserQuestion payload: {...}] contract line');
  const parsed = JSON.parse(payload.json);

  const keys = Object.keys(parsed).sort();
  assert.deepEqual(keys, ['mode', 'recommended', 'shape', 'verb_count'], 'payload keys are exactly shape/mode/verb_count/recommended');
  assert.equal('verbs' in parsed, false, 'no verbs key');

  const markerMatch = block.match(/\[AskUserQuestion contract: shape=F\.\d+ verbs=(\d+)\]/);
  assert.ok(markerMatch, 'the byte-frozen marker is present');
  assert.equal(typeof parsed.verb_count, 'number', 'verb_count is a number');
  assert.ok(Number.isInteger(parsed.verb_count) && parsed.verb_count > 0, 'verb_count is a positive integer');
  assert.equal(parsed.verb_count, Number(markerMatch[1]), 'verb_count matches the marker verbs=N (the number of option rows rendered above)');

  assert.equal(parsed.recommended, 'Verb Alpha', 'recommended survives when the contract carries one');
});

// ---------------------------------------------------------------------------
// Test 2 (no label duplication): non-recommended verb labels never appear in
// the payload JSON substring; the recommended verb IS allowed (design exception).
// ---------------------------------------------------------------------------
test('Test 2 (no label duplication): non-recommended verb labels are dead weight, dropped', () => {
  const block = withStubbedRecommendedRender(function () {
    return ic.renderEngineDecisionWithDial(engineDecisionFixture(), { source: 'engine' }, '', { cortexNodes: [] });
  });
  const payload = extractPayloadLine(block);
  assert.ok(payload, 'block carries a payload line');

  assert.equal(payload.json.indexOf('Verb Beta'), -1, 'a non-recommended verb label does not appear in the payload');
  assert.equal(payload.json.indexOf('Verb Gamma'), -1, 'a non-recommended verb label does not appear in the payload');
  // The recommended verb IS allowed to appear (the differentiator, not a
  // duplicate list) -- assert it is present exactly where recommended lives.
  assert.ok(payload.json.indexOf('Verb Alpha') !== -1, 'the recommended verb is allowed to appear (design exception)');
});

// ---------------------------------------------------------------------------
// Test 3 (f1_closer_payload fence): the persisted next-turn payload path is
// UNTOUCHED -- the traceEntry.f1_closer_payload assignment still guards on
// Array.isArray(f1Payload.verbs), and the dedup applies ONLY to the injected
// display line.
// ---------------------------------------------------------------------------
test('Test 3 (f1_closer_payload fence): the persisted next-turn payload keeps its full verbs array', () => {
  const source = fs.readFileSync(IC_PATH, 'utf8');
  const idx = source.indexOf('traceEntry.f1_closer_payload = f1Payload;');
  assert.ok(idx !== -1, 'the f1_closer_payload assignment must still exist');
  const window = source.slice(Math.max(0, idx - 400), idx + 60);
  assert.ok(
    window.indexOf('Array.isArray(f1Payload.verbs)') !== -1,
    'the guard immediately above the assignment still tests Array.isArray(f1Payload.verbs) -- the persisted contract is untouched by the display-line dedup'
  );
});

// ---------------------------------------------------------------------------
// Test 4 (bytes): the deduped payload line is at least 150 bytes smaller than
// the pre-dedup (verbs-array) shape for the 3-verb fixture.
// ---------------------------------------------------------------------------
test('Test 4 (bytes): the deduped payload line saves at least 150 bytes vs the verbs-array shape', () => {
  const decision = engineDecisionFixture();
  const block = ic.renderEngineDecisionWithDial(decision, { source: 'engine' }, '', { cortexNodes: [] });
  const payload = extractPayloadLine(block);
  assert.ok(payload, 'block carries a payload line');
  const actualBytes = Buffer.byteLength(payload.line, 'utf8');
  process.stdout.write('  [251-01c] payload line bytes (after, deduped): ' + actualBytes + '\n');

  // Reconstruct the PRE-DEDUP (verbs-array) shape from the SAME parsed
  // fields plus the live block's option-row labels (visible above the
  // marker), so the "before" number is derived from this run's own fixture
  // rather than a hardcoded literal.
  const parsed = JSON.parse(payload.json);
  const rowLabels = [];
  const lines = block.split('\n');
  for (const line of lines) {
    const rowMatch = line.match(/^▷ (.+)$/);
    if (rowMatch) rowLabels.push(rowMatch[1]);
  }
  rowLabels.push('Free-Text');
  const preDedupShape = { shape: parsed.shape, mode: parsed.mode, verbs: rowLabels, recommended: parsed.recommended };
  const preDedupLine = '[AskUserQuestion payload: ' + JSON.stringify(preDedupShape) + ']';
  const beforeBytes = Buffer.byteLength(preDedupLine, 'utf8');
  process.stdout.write('  [251-01c] payload line bytes (before, reconstructed verbs-array shape): ' + beforeBytes + '\n');

  assert.ok(beforeBytes - actualBytes >= 150, 'the deduped line saves at least 150 bytes; saved ' + (beforeBytes - actualBytes));
});
