#!/usr/bin/env node
'use strict';

/**
 * Phase 251 Plan 01, Task 2 (CACHE-02b) -- skeleton-to-SessionStart.
 * ==========================================================================
 * Proves the FIRE-IF-FORK imperative moved OFF the per-turn engine block and
 * onto scripts/session-start's SessionStart additionalContext (re-seeded on
 * startup/clear/compact by the existing hooks.json matcher):
 *
 *   1. The per-turn engine-arm block no longer carries [FIRE-IF-FORK: ...],
 *      but the byte-frozen [AskUserQuestion contract: ...] marker still does.
 *   2. scripts/session-start carries ONE doctrine block with the FIRE-IF-FORK
 *      rule, the SEED-021 clause, the marker legend, the unchanged-marker
 *      legend, and the payload legend (verb_count) -- under 900 bytes.
 *   3. lib/hmi/selector-dispatcher.cjs's appendAskUserQuestionTrailer is
 *      BYTE-UNTOUCHED: it still mints askuserquestion_marker,
 *      askuserquestion_binding, and the zones.footer trailer for every OTHER
 *      consumer (the pickShape door, renderRoomChooserCard). Only the
 *      intent-classifier engine-arm concatenation stopped appending it.
 *   4. emitBindingGate's additionalContext surface is untouched (source
 *      assertion; the full behavioral proof lives in test-209 Test 5).
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
const SESSION_START_PATH = path.join(REPO_ROOT, 'scripts', 'session-start');
const ic = require(IC_PATH);
const dispatcher = require(path.join(REPO_ROOT, 'lib', 'hmi', 'selector-dispatcher.cjs'));

function engineDecisionFixture() {
  return {
    fire_skill: 'discover',
    suppress_skills: [],
    decision_trace: { brain_md_tier_mode: 'tier_0' },
  };
}

// ---------------------------------------------------------------------------
// Test 1 (binding gone from per-turn block): the engine-arm block no longer
// carries [FIRE-IF-FORK: ...], but the byte-frozen marker still does.
// ---------------------------------------------------------------------------
test('Test 1: [FIRE-IF-FORK: absent from the per-turn block, marker still present', () => {
  const block = ic.renderEngineDecisionWithDial(
    engineDecisionFixture(),
    { source: 'engine' },
    '',
    { cortexNodes: [] }
  );
  // Record the item-(b) fixture byte count FIRST, unconditionally, so the RED
  // run (binding still present) captures the "before" number regardless of
  // whether the assertions below pass or fail.
  process.stdout.write('  [251-01b] fixture block bytes (RED=before w/ binding, GREEN=after w/o): ' + Buffer.byteLength(block, 'utf8') + '\n');
  assert.equal(block.indexOf('[FIRE-IF-FORK:'), -1, '251-01: imperative moved to SessionStart doctrine, per-turn block no longer carries it');
  assert.match(block, /\[AskUserQuestion contract: shape=F\.\d+ verbs=\d+\]/, 'the byte-frozen per-turn gate marker is still present');
});

// ---------------------------------------------------------------------------
// Test 2 (doctrine in session-start): ONE doctrine block carries the
// FIRE-IF-FORK rule, SEED-021, the marker legend, the unchanged-marker
// legend, and the payload legend (verb_count) -- under 900 bytes.
// ---------------------------------------------------------------------------
test('Test 2: session-start carries the sub-900-byte NAVIGATION CARD-FIRE CONTRACT doctrine', () => {
  const source = fs.readFileSync(SESSION_START_PATH, 'utf8');
  const m = source.match(/NAV_CARD_FIRE_DOCTRINE="([^\n]*)"/);
  assert.ok(m, 'scripts/session-start must define a NAV_CARD_FIRE_DOCTRINE string');
  const doctrine = m[1];

  assert.ok(doctrine.indexOf('[FIRE-IF-FORK') !== -1, 'doctrine carries the FIRE-IF-FORK rule');
  assert.ok(doctrine.indexOf('AskUserQuestion') !== -1, 'doctrine names the AskUserQuestion tool');
  assert.ok(doctrine.indexOf('SEED-021') !== -1, 'doctrine keeps the SEED-021 no-reproduce clause');
  assert.ok(doctrine.indexOf('NAV DECISION unchanged') !== -1, 'doctrine carries the unchanged-marker legend');
  assert.ok(doctrine.indexOf('verb_count') !== -1, 'doctrine carries the payload legend (forward-written for Task 3)');

  const bytes = Buffer.byteLength(doctrine, 'utf8');
  process.stdout.write('  [251-01b] session-start doctrine bytes (one-time, paid once per session): ' + bytes + '\n');
  assert.ok(bytes < 900, 'the doctrine block is under 900 bytes; got ' + bytes);

  // The doctrine must actually be threaded into $context before the JSON
  // escape point, or it never reaches additionalContext.
  assert.ok(source.indexOf('${NAV_CARD_FIRE_DOCTRINE}') !== -1, 'the doctrine variable is appended into $context');
});

// ---------------------------------------------------------------------------
// Test 3 (dispatcher untouched): appendAskUserQuestionTrailer still mints
// askuserquestion_marker, askuserquestion_binding, and zones.footer for
// every OTHER consumer.
// ---------------------------------------------------------------------------
test('Test 3: appendAskUserQuestionTrailer still mints marker + binding + footer', () => {
  const rendered = {
    contract: { shape: 'F.1', verbs: ['Investigate', 'Blend', 'Insight'] },
    zones: { header: 'H', body: 'B', footer: '' },
  };
  const out = dispatcher.appendAskUserQuestionTrailer(rendered, 'F.1');
  assert.equal(typeof out.askuserquestion_marker, 'string', 'the marker field is still minted');
  assert.match(out.askuserquestion_marker, /^\[AskUserQuestion contract: shape=F\.1 verbs=3\]$/, 'the marker is byte-frozen');
  assert.equal(typeof out.askuserquestion_binding, 'string', 'the binding field is still minted');
  assert.ok(out.askuserquestion_binding.indexOf('[FIRE-IF-FORK:') !== -1, 'the binding still carries the FIRE-IF-FORK imperative');
  assert.ok(out.zones.footer.indexOf(out.askuserquestion_marker) !== -1, 'zones.footer still carries the marker');
  assert.ok(out.zones.footer.indexOf('[FIRE-IF-FORK:') !== -1, 'zones.footer still carries the binding for non-injection consumers (pickShape door, renderRoomChooserCard)');
});

// ---------------------------------------------------------------------------
// Test 4 (binding-gate surface untouched): emitBindingGate's body still
// references the binding append (the full behavioral proof lives in
// test-209-engine-arm-contract.cjs Test 5, byte-unmodified by this plan).
// ---------------------------------------------------------------------------
test('Test 4: emitBindingGate source still carries the trailer append', () => {
  const source = fs.readFileSync(IC_PATH, 'utf8');
  const emitBindingGateStart = source.indexOf('function emitBindingGate(');
  assert.ok(emitBindingGateStart !== -1, 'emitBindingGate must exist');
  const nextFn = source.indexOf('\nfunction ', emitBindingGateStart + 1);
  const body = source.slice(emitBindingGateStart, nextFn === -1 ? undefined : nextFn);
  assert.ok(body.indexOf('appendAskUserQuestionTrailer') !== -1, 'emitBindingGate still composes via appendAskUserQuestionTrailer (out of hygiene scope by measurement)');
});
