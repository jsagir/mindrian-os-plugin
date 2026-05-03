#!/usr/bin/env node
'use strict';

/*
 * Phase 108-03 - Truth-state taxonomy test.
 *
 * Implements: RECONCILE-108-04.
 *
 * Asserts that .planning/phases/108-graph-memory-schema-reconciliation/TRUTH-STATES.md:
 *   1. Contains all 8 canonical states (proposed, confirmed, rejected, stale,
 *      superseded, needs_evidence, validated, invalidated).
 *   2. Contains the status_aliases mapping (untested -> proposed, supported ->
 *      validated, contradicted -> invalidated, stale -> stale).
 *   3. Contains the transition table with at least 8 documented transitions.
 *   4. Contains the auto-stale rule (90-day default + staleable node types).
 *   5. Contains the transitionStatus chokepoint contract.
 *   6. Contains the memory_event reference (state transitions are events).
 *   7. Contains zero em-dashes or en-dashes (project hard rule).
 *
 * Exit 0 = PASS. Exit 1 = FAIL with offending element listed.
 *
 * Pattern source: tests/test-cascade-side-channel.cjs.
 */

const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');

const REPO_ROOT = path.resolve(__dirname, '..');
const TRUTH_STATES_PATH = path.join(
  REPO_ROOT,
  '.planning',
  'phases',
  '108-graph-memory-schema-reconciliation',
  'TRUTH-STATES.md'
);

let failures = 0;
function test(name, fn) {
  try {
    fn();
    console.log('PASS:', name);
  } catch (e) {
    console.error('FAIL:', name, '-', e.message);
    failures += 1;
  }
}

if (!fs.existsSync(TRUTH_STATES_PATH)) {
  console.error('FAIL: TRUTH-STATES.md not found at', TRUTH_STATES_PATH);
  process.exit(1);
}
const truthStates = fs.readFileSync(TRUTH_STATES_PATH, 'utf8');

const CANONICAL_STATES = [
  'proposed', 'confirmed', 'rejected', 'stale', 'superseded',
  'needs_evidence', 'validated', 'invalidated'
];

const STATUS_ALIASES = [
  { old: 'untested', new: 'proposed' },
  { old: 'supported', new: 'validated' },
  { old: 'contradicted', new: 'invalidated' },
  { old: 'stale', new: 'stale' }
];

const STALEABLE_NODE_TYPES = ['claim', 'assumption', 'decision', 'opportunity'];

test('all 8 canonical states present', () => {
  const missing = CANONICAL_STATES.filter((s) => !truthStates.includes(s));
  assert.equal(missing.length, 0, 'Missing states: ' + missing.join(', '));
});

test('status_aliases mapping reconciles existing assumptions.validity enum', () => {
  // Each alias mapping must appear; we accept either "old -> new" or both names within a few lines of each other.
  for (const alias of STATUS_ALIASES) {
    const lines = truthStates.split('\n');
    const matchesAlias = lines.some((line) => line.includes(alias.old) && line.includes(alias.new));
    assert.ok(
      matchesAlias,
      'Status alias not found on a single line: ' + alias.old + ' -> ' + alias.new
    );
  }
});

test('transition table is present (at least 8 documented transitions)', () => {
  // A transition row contains both a "from" state and a "to" state; we approximate
  // by counting lines that contain ANY two distinct canonical states.
  const lines = truthStates.split('\n');
  let transitionRowCount = 0;
  for (const line of lines) {
    const statesInLine = CANONICAL_STATES.filter((s) => line.includes(s));
    const distinctStates = Array.from(new Set(statesInLine));
    if (distinctStates.length >= 2) transitionRowCount += 1;
  }
  assert.ok(
    transitionRowCount >= 8,
    'Expected at least 8 lines containing 2+ canonical states (transition rows); found ' + transitionRowCount
  );
});

test('auto-stale rule documented (90-day default)', () => {
  assert.ok(
    /90[- ]days?|90-day/.test(truthStates),
    'Missing 90-day auto-stale rule'
  );
});

test('staleable node types listed (claim, assumption, decision, opportunity)', () => {
  const missing = STALEABLE_NODE_TYPES.filter((t) => !truthStates.includes(t));
  assert.equal(missing.length, 0, 'Missing staleable types: ' + missing.join(', '));
});

test('transitionStatus chokepoint contract specified', () => {
  assert.ok(
    truthStates.includes('transitionStatus'),
    'Missing transitionStatus chokepoint reference'
  );
});

test('memory_event reference (state transitions are events per Canon Part 4)', () => {
  assert.ok(
    truthStates.includes('memory_event'),
    'Missing memory_event reference (transitions must be events, not silent UPDATEs)'
  );
});

test('Canon Part 5 evidence tier referenced', () => {
  assert.ok(
    /Academic|Operational|Practitioner|Part 5/.test(truthStates),
    'Missing Canon Part 5 evidence-tier reference (Academic/Operational/Practitioner/None)'
  );
});

test('explicit framing as a closed set', () => {
  assert.ok(
    /closed (8-state )?(taxonomy|set)|closed[- ]set|closed taxonomy/i.test(truthStates),
    'Document does not explicitly frame the taxonomy as closed (must say so to prevent net-new state additions without canon amendment)'
  );
});

test('zero em-dashes (U+2014) or en-dashes (U+2013)', () => {
  const emdashIdx = truthStates.indexOf('—');
  const endashIdx = truthStates.indexOf('–');
  assert.equal(emdashIdx, -1, 'Em-dash found at character offset ' + emdashIdx);
  assert.equal(endashIdx, -1, 'En-dash found at character offset ' + endashIdx);
});

process.exit(failures > 0 ? 1 : 0);
