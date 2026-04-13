#!/usr/bin/env node
'use strict';

/**
 * Phase 81-02: Drift-check test for Feynman prompt constants.
 *
 * The four prompt templates in lib/memory/feynman-prompts.cjs are ALSO
 * inlined verbatim into commands/mos-reason.md between named HTML comment
 * sentinels. This test enforces byte equality between the two copies so
 * the slash command body never silently drifts from the library source
 * of truth.
 *
 * Extraction strategy: the slash command body wraps each prompt between
 * sentinels of the form
 *
 *   <!-- STAGE_1_ESSENCE start -->
 *   <prompt body>
 *   <!-- STAGE_1_ESSENCE end -->
 *
 * We locate the start and end markers, slice, trim one leading and one
 * trailing newline (the markers sit on their own lines), and compare
 * character-for-character against the constant exported from
 * feynman-prompts.cjs.
 *
 * If an edit is made to either copy without matching the other, this
 * test fails with a character-index diff report.
 *
 * Run via:
 *   node lib/memory/feynman-prompts-drift.test.cjs
 *
 * Registered in lib/memory/run-feynman-tests.cjs.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MOS_REASON_PATH = path.join(REPO_ROOT, 'commands', 'mos-reason.md');
const prompts = require('./feynman-prompts.cjs');

const PAIRS = [
  { name: 'STAGE_1_ESSENCE', library: prompts.STAGE_1_ESSENCE },
  { name: 'STAGE_2_PLAIN_LANGUAGE', library: prompts.STAGE_2_PLAIN_LANGUAGE },
  { name: 'STAGE_4_MENTAL_MODEL', library: prompts.STAGE_4_MENTAL_MODEL },
  { name: 'STAGE_5_SWEET_SPOT', library: prompts.STAGE_5_SWEET_SPOT },
];

function extractInlinedPrompt(body, name) {
  const startMarker = '<!-- ' + name + ' start -->';
  const endMarker = '<!-- ' + name + ' end -->';
  const startIdx = body.indexOf(startMarker);
  const endIdx = body.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1) {
    throw new Error(
      'missing sentinel for ' + name + ' in commands/mos-reason.md'
    );
  }
  if (endIdx < startIdx) {
    throw new Error('sentinel order inverted for ' + name);
  }
  let slice = body.slice(startIdx + startMarker.length, endIdx);
  // Strip one leading newline and one trailing newline; the markers sit
  // on their own lines so the slice always begins and ends with \n.
  if (slice.startsWith('\n')) slice = slice.slice(1);
  if (slice.endsWith('\n')) slice = slice.slice(0, -1);
  return slice;
}

function firstDiffIndex(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a.charCodeAt(i) !== b.charCodeAt(i)) return i;
  }
  if (a.length !== b.length) return n;
  return -1;
}

function reportDiff(name, inlined, library) {
  const i = firstDiffIndex(inlined, library);
  const ctxStart = Math.max(0, i - 20);
  const ctxEnd = Math.min(Math.max(inlined.length, library.length), i + 40);
  return (
    name +
    ' drift at char ' +
    i +
    '\n  inlined[' +
    ctxStart +
    ':' +
    ctxEnd +
    '] = ' +
    JSON.stringify(inlined.slice(ctxStart, ctxEnd)) +
    '\n  library[' +
    ctxStart +
    ':' +
    ctxEnd +
    '] = ' +
    JSON.stringify(library.slice(ctxStart, ctxEnd)) +
    '\n  inlined.length = ' +
    inlined.length +
    ', library.length = ' +
    library.length
  );
}

function run() {
  const body = fs.readFileSync(MOS_REASON_PATH, 'utf-8');
  let passed = 0;
  for (const pair of PAIRS) {
    const inlined = extractInlinedPrompt(body, pair.name);
    if (inlined !== pair.library) {
      throw new Error(reportDiff(pair.name, inlined, pair.library));
    }
    // Sanity: library prompt should be non-trivially long.
    assert.ok(
      pair.library.length > 200,
      pair.name + ' library constant suspiciously short'
    );
    passed += 1;
  }
  // Additional guard: the slash command body must contain zero em/en dashes.
  for (let i = 0; i < body.length; i++) {
    const cp = body.codePointAt(i);
    assert.ok(
      cp !== 8212 && cp !== 8211,
      'commands/mos-reason.md contains forbidden dash at char ' + i
    );
  }
  process.stdout.write(
    'feynman-prompts-drift.test.cjs: ' +
      passed +
      '/' +
      PAIRS.length +
      ' prompts match library + no dashes in slash command body\n'
  );
}

try {
  run();
  process.exit(0);
} catch (e) {
  process.stderr.write('FAIL feynman-prompts-drift: ' + e.message + '\n');
  process.exit(1);
}
