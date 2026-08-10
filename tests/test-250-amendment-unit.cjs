#!/usr/bin/env node
'use strict';

/**
 * Phase 250 Plan 02, Task 2 (HONEST-02) -- the amendment unit test.
 * ==========================================================================
 * Proves docs/AMENDMENT-2026-08-DECISIONS-1-AND-8.md is a complete, ratifiable
 * unit: both replacement rows verbatim, the five causal-record anchors, the
 * STATUS + EFFECTIVE clause, and the amendment-sweep lockstep guard (the
 * negative assertion that .claude/includes/decisions.md rows 1 and 8 are NOT
 * yet rewritten -- Test 4, per the Task 1 navigator ruling recorded in
 * 250-02-SUMMARY.md: doc-now / rows-at-sweep).
 *
 * Run BEFORE the amendment doc exists, this fence demonstrably FAILS (the
 * file is absent) -- that is this test's own can-fail proof (RED recorded in
 * the SUMMARY).
 *
 * node --test, CJS, node:assert/strict + node:fs only. No new deps.
 * No em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const REPO_ROOT = path.resolve(__dirname, '..');
const AMENDMENT_PATH = path.join(REPO_ROOT, 'docs', 'AMENDMENT-2026-08-DECISIONS-1-AND-8.md');
const DECISIONS_PATH = path.join(REPO_ROOT, '.claude', 'includes', 'decisions.md');

const NEW_ROW_1 =
  "One-command install; the Brain is part of what installs. Larry's methodology comes " +
  'from the Brain and says so; a keyless session gets an honest refusal and a visible ' +
  'path to a key, never an imitation.';

const NEW_ROW_8 =
  'Honest refusal everywhere. A Brain failure or readiness miss surfaces in-turn and ' +
  'auto-queues enrichment; no surface conceals a failure or serves methodology the ' +
  'graph did not give.';

function readAmendment() {
  return fs.readFileSync(AMENDMENT_PATH, 'utf8');
}

// Markdown prose wraps at ~78-80 cols in the source file; that is editorial
// formatting, not a change to the verbatim text. Collapse all whitespace runs
// (including the embedded newlines from hard-wrapping) to a single space
// before substring-matching multi-line quotes, so wrapping never falsely
// fails a verbatim assertion.
function normalizeWhitespace(text) {
  const stripped = text
    .split('\n')
    .map((line) => line.replace(/^>\s?/, ''))
    .join('\n');
  return stripped.replace(/\s+/g, ' ');
}

test('Amendment doc exists', () => {
  assert.ok(fs.existsSync(AMENDMENT_PATH), 'docs/AMENDMENT-2026-08-DECISIONS-1-AND-8.md must exist');
});

test('Test 1: contains the new Decision #1 row VERBATIM', () => {
  const text = normalizeWhitespace(readAmendment());
  assert.ok(text.includes(NEW_ROW_1), 'new Decision #1 row not found verbatim');
});

test('Test 1: contains the new Decision #8 row VERBATIM', () => {
  const text = normalizeWhitespace(readAmendment());
  assert.ok(text.includes(NEW_ROW_8), 'new Decision #8 row not found verbatim');
});

test('Test 2: STATUS + EFFECTIVE clause present', () => {
  const text = normalizeWhitespace(readAmendment());
  assert.ok(text.includes('Ratified on merge'), 'missing "Ratified on merge"');
  assert.ok(
    /in force with the release that completes SWEEP-01\.\.03/i.test(text),
    'missing the SWEEP-01..03 effective-clause phrasing'
  );
});

test('Test 3: all five causal-record legs are cited', () => {
  const text = normalizeWhitespace(readAmendment());
  assert.ok(
    text.includes('All fail = silent fallback. Never mention failures to user.'),
    'missing (a) the old clause quote verbatim'
  );
  assert.ok(text.includes('brain-response-sanitize-hook'), 'missing (b) the sanitize-hook citation');
  assert.ok(text.includes('e.reduce is not a function'), 'missing (b) the exact error string');
  assert.ok(text.includes('activation:'), 'missing (c) the inert activation frontmatter mention');
  assert.ok(
    text.includes('2026-08-10') && /stale[- ]plugin[- ]cache|stale cache|plugin cache/i.test(text),
    'missing (e) the 2026-08-10 stale-plugin-cache reproduction reference'
  );
});

test('Test 4 (lockstep guard FLIPPED, Phase 252-03 Task 1: decisions.md rows 1/5/8 applied verbatim from the ratified amendment): decisions.md carries the applied rows, never the pre-amendment text', () => {
  const decisions = fs.readFileSync(DECISIONS_PATH, 'utf8');
  assert.ok(
    decisions.includes('the Brain is part of what installs'),
    'decisions.md row 1 must carry the amendment\'s applied Decision #1 text -- the SWEEP release never ships without it'
  );
  assert.ok(
    decisions.includes('a keyless session gets an honest refusal and a visible path to a key'),
    'decisions.md row 1 rationale must carry the amendment\'s applied text'
  );
  assert.ok(
    decisions.includes('Honest refusal everywhere'),
    'decisions.md row 8 must carry the amendment\'s applied Decision #8 text -- the SWEEP release never ships without it'
  );
  assert.ok(
    decisions.includes('no surface conceals a failure or serves methodology the graph did not give'),
    'decisions.md row 8 rationale must carry the amendment\'s applied text'
  );
  assert.ok(
    decisions.includes('The Brain is remote by design, not optional by default'),
    'decisions.md row 5 rationale must carry the amendment\'s wording touch'
  );
  assert.ok(
    !decisions.includes('Zero config; Larry works immediately.'),
    'decisions.md row 1 must no longer carry the pre-amendment rationale -- regression to the old row'
  );
  assert.ok(
    !decisions.includes('graceful degradation everywhere'),
    'decisions.md row 8 must no longer carry the pre-amendment rationale -- regression to the old row'
  );
});

test('Test 5: amendment doc contains no em-dash (U+2014)', () => {
  const text = readAmendment();
  assert.ok(!/—/.test(text), 'amendment doc contains a forbidden em-dash (U+2014)');
});

test('Consequential-edits ledger cites the 252 coordination item: MINDRIAN-CANON.md line 21 and the drifted CLAUDE.md line numbers', () => {
  const text = readAmendment();
  assert.ok(text.includes('MINDRIAN-CANON.md'), 'ledger missing MINDRIAN-CANON.md citation');
  assert.ok(text.includes(':29') && text.includes(':94'), 'ledger missing the current drifted CLAUDE.md line numbers (:29/:94)');
});

test('Ratification block present (pending until Task 3, then filled)', () => {
  const text = readAmendment();
  assert.ok(/ratif/i.test(text), 'missing a ratification block');
});
