#!/usr/bin/env node
'use strict';
/*
 * tests/test-265-radar-writes-ledger.cjs -- Phase 265 Plan 05 Task 1.
 *
 * The fetch itself is not runnable in a test (it WebFetches a live remote
 * URL and depends on Claude's own extraction), so this tripwire asserts the
 * write-back CONTRACT is present in commands/radar.md's prose instead: that
 * --fetch writes the machine-readable ledger under an explicit injection
 * fence, self-validates against the schema tripwire, and renders the human
 * cache as a view rather than the other way around (the exact bug this
 * plan fixes -- see Pitfall 5 in 265-RESEARCH.md).
 *
 * Plain Node script (no node:test), matching this phase's harness contract
 * (tests/run-all-265.sh runs it via bare `node "$t"`).
 */

const fs = require('fs');
const path = require('path');

const RADAR_PATH = path.join(__dirname, '..', 'commands', 'radar.md');

let failed = false;
const failures = [];

function fail(arm, detail) {
  failed = true;
  failures.push(arm + (detail ? ': ' + detail : ''));
}

let raw;
try {
  raw = fs.readFileSync(RADAR_PATH, 'utf8');
} catch (e) {
  console.error('FAIL: could not read ' + RADAR_PATH + ': ' + e.message);
  process.exit(1);
}

// Arm 1: commands/radar.md contains the ledger path (both the read and the write steps).
if (!raw.includes('data/capability-ledger.json')) {
  fail('ledger-path-present');
}

// Arm 2: contains ledger_covers (the freshness anchor the write-back step must update).
if (!raw.includes('ledger_covers')) {
  fail('ledger-covers-present');
}

// Arm 3: the injection fence sentence, verbatim substring.
if (!raw.includes('Never write raw fetched markdown')) {
  fail('injection-fence-sentence-present');
}

// Arm 4: names the schema tripwire so a malformed write is caught at fetch time.
if (!raw.includes('test-265-capability-ledger-schema.cjs')) {
  fail('schema-tripwire-named');
}

// Arm 5: describes the cache write as a view, ledger as source of record.
if (!raw.includes('source of record')) {
  fail('cache-described-as-view');
}

// Arm 6: allowed-tools set equals exactly {Read, Write, WebFetch, Glob, AskUserQuestion}.
// No entry added, none removed -- Task 1 must not widen the command's tool grant.
const EXPECTED_TOOLS = ['Read', 'Write', 'WebFetch', 'Glob', 'AskUserQuestion'];
const atMatch = /allowed-tools:\s*\n((?:\s*-\s*.+\n?)+)/.exec(raw);
if (!atMatch) {
  fail('allowed-tools-block-found', 'no allowed-tools YAML block located');
} else {
  const found = atMatch[1]
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('-'))
    .map((l) => l.replace(/^-\s*/, '').trim());
  const foundSet = new Set(found);
  const expectedSet = new Set(EXPECTED_TOOLS);
  const missing = EXPECTED_TOOLS.filter((t) => !foundSet.has(t));
  const extra = found.filter((t) => !expectedSet.has(t));
  if (missing.length > 0 || extra.length > 0) {
    fail(
      'allowed-tools-set-equality',
      'missing=' + JSON.stringify(missing) + ' extra=' + JSON.stringify(extra)
    );
  }
}

if (failed) {
  console.error('tests/test-265-radar-writes-ledger.cjs: FAILED');
  failures.forEach((f) => console.error('  FAIL: ' + f));
  process.exit(1);
}

console.log('tests/test-265-radar-writes-ledger.cjs: PASSED (6 arms)');
process.exit(0);
