'use strict';

/*
 * Phase 104.1 Plan 01 -- per-command-teaching presence + length + no-em-dash
 * test. Mirrors the Phase 104 per-command-serves_jtbd test pattern: read
 * data/command-registry.json, assert content invariants on every command.
 *
 * Initial state (Plan 01 RED): no command frontmatter has `teaching:` yet.
 *   - Test 1 (presence) FAILS by design -- Plan 02 fills 86 teaching strings.
 *   - Tests 2-4 (length / no-em-dash / sentence-count) PASS vacuously
 *     because they filter on `c.teaching` (null short-circuits to empty).
 *
 * GREEN state (after Plan 02 lands content): all 4 tests pass.
 *
 * Registered in:
 *   - tests/run-all-104.1.sh (Phase 104.1 scoped aggregator)
 *   - lib/memory/run-feynman-tests.cjs TEST_FILES[]
 *
 * Constraints enforced (from .planning/phases/104.1-per-command-teaching-content/104.1-CONTEXT.md D2):
 *   - non-empty teaching field on every command
 *   - 50-300 characters
 *   - no em-dashes (U+2014); double-hyphens `--` and hyphens `-` are fine
 *   - 1-2 sentences (terminal `.` / `!` / `?` count)
 *
 * Canon Part 8 boundary: this test reads ONLY the local plugin registry
 * (data/command-registry.json). Zero network surface, zero Brain calls.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

const registryPath = path.join(__dirname, '..', '..', 'data', 'command-registry.json');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

test('every command has a non-empty teaching field', () => {
  const missing = registry.commands.filter(
    (c) => !c.teaching || c.teaching.length === 0
  );
  if (missing.length > 0) {
    // RED until Plan 02 fills content. Print which commands are missing
    // teaching field for diagnostic visibility (the WARNING tripwire in
    // scripts/build-command-registry.cjs --check uses the same shape).
    console.log(
      'Missing teaching field on ' +
        missing.length +
        ' commands: ' +
        missing.map((c) => c.command).join(', ')
    );
  }
  assert.equal(
    missing.length,
    0,
    missing.length +
      ' of ' +
      registry.commands.length +
      ' commands missing teaching field'
  );
});

test('every teaching string is 50-300 characters', () => {
  const offenders = registry.commands.filter(
    (c) => c.teaching && (c.teaching.length < 50 || c.teaching.length > 300)
  );
  assert.equal(
    offenders.length,
    0,
    offenders.length +
      ' teaching strings outside 50-300 char range: ' +
      offenders
        .slice(0, 3)
        .map((c) => c.command + '(' + c.teaching.length + ')')
        .join(', ')
  );
});

test('no teaching string contains em-dashes (project no-em-dash rule)', () => {
  // U+2014 EM DASH only. Allowed: U+002D HYPHEN-MINUS (single or doubled).
  const emDashRegex = /—/;
  const offenders = registry.commands.filter(
    (c) => c.teaching && emDashRegex.test(c.teaching)
  );
  assert.equal(
    offenders.length,
    0,
    offenders.length +
      ' teaching strings contain em-dashes: ' +
      offenders.slice(0, 3).map((c) => c.command).join(', ')
  );
});

test('every teaching string is 1-2 sentences', () => {
  // Heuristic: count terminal punctuation (. ! ?) followed by whitespace or
  // end-of-string. Common abbreviations may double-count -- worth refining if
  // false positives surface during Plan 02 content review.
  const sentenceCountRegex = /[.!?](?:\s|$)/g;
  const offenders = registry.commands.filter((c) => {
    if (!c.teaching) return false;
    const count = (c.teaching.match(sentenceCountRegex) || []).length;
    return count > 2 || count < 1;
  });
  assert.equal(
    offenders.length,
    0,
    offenders.length +
      ' teaching strings not 1-2 sentences: ' +
      offenders.slice(0, 3).map((c) => c.command).join(', ')
  );
});
