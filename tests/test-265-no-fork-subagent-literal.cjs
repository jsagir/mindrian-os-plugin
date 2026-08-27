#!/usr/bin/env node
'use strict';
/*
 * tests/test-265-no-fork-subagent-literal.cjs -- Phase 265 Plan 05 Task 2.
 *
 * Carries Phase 138-04's tripwire design forward with its polarity inverted.
 * 138 asserted absence of CLAUDE_CODE_FORK_SUBAGENT because it expected to
 * introduce an opt-in harness that never shipped; 265 asserts absence from
 * shipped code because nothing ever assumed the old opt-in gate existed, and
 * nothing should assume it now that the platform inverted its polarity
 * (opt-in -> opt-out at Claude Code 2.1.232).
 *
 * Two independent walks:
 *
 *   1. lib/, scripts/, agents/, commands/, hooks/ -- the literal must appear
 *      ZERO times. This is shipped/executable surface; no code path should
 *      ever have assumed the gate, and none should reference the env var
 *      name at all (the platform default makes it moot for code).
 *
 *   2. references/capability-radar/ and data/capability-ledger.json -- the
 *      literal MAY appear (these are the curated docs that describe the
 *      capability), but wherever it does, the SAME FILE must also mention
 *      2.1.232 (the version that inverted the polarity) and one of the
 *      polarity markers "opt-OUT" / "opt out" (matched case-insensitively,
 *      since prose casing varies -- "opt-out (0)" in the ledger's evidence
 *      field is exactly as valid a marker as "opt-OUT" in doc prose). A file
 *      carrying the literal without its corrected meaning nearby is exactly
 *      the rot this test exists to prevent.
 *
 * Plain Node script (no node:test), matching this phase's harness contract
 * (tests/run-all-265.sh runs it via bare `node "$t"`).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LITERAL = 'CLAUDE_CODE_FORK_SUBAGENT';

const CODE_DIRS = ['lib', 'scripts', 'agents', 'commands', 'hooks'];
const DOC_DIR = path.join('references', 'capability-radar');
const LEDGER_FILE = path.join('data', 'capability-ledger.json');

let failed = false;
const failures = [];

function fail(file, line, reason) {
  failed = true;
  failures.push(file + (line ? ':' + line : '') + ' -- ' + reason);
}

// Skip binary-ish / huge / irrelevant extensions; this repo's code/docs live
// in these text formats. Anything else is not a plausible carrier of this
// literal and would only slow the walk down.
const TEXT_EXT = new Set(['.md', '.cjs', '.js', '.mjs', '.json', '.sh', '.txt', '.yml', '.yaml']);

function walk(dirAbs, onFile) {
  let entries;
  try {
    entries = fs.readdirSync(dirAbs, { withFileTypes: true });
  } catch (_e) {
    return; // directory does not exist -- nothing to scan, not a failure
  }
  for (const entry of entries) {
    const full = path.join(dirAbs, entry.name);
    if (entry.isDirectory()) {
      // node_modules should never appear under these five dirs, but skip
      // defensively rather than trusting that invariant forever.
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      walk(full, onFile);
    } else if (entry.isFile()) {
      if (TEXT_EXT.has(path.extname(entry.name))) {
        onFile(full);
      }
    }
  }
}

function findLiteralLines(content) {
  const lines = content.split(/\r?\n/);
  const hits = [];
  lines.forEach((line, idx) => {
    if (line.includes(LITERAL)) hits.push(idx + 1);
  });
  return hits;
}

// ---------------------------------------------------------------------------
// Walk 1: shipped/executable surface -- zero occurrences allowed.
// ---------------------------------------------------------------------------
for (const dir of CODE_DIRS) {
  const dirAbs = path.join(ROOT, dir);
  walk(dirAbs, (fileAbs) => {
    let content;
    try {
      content = fs.readFileSync(fileAbs, 'utf8');
    } catch (_e) {
      return;
    }
    const hits = findLiteralLines(content);
    if (hits.length > 0) {
      const rel = path.relative(ROOT, fileAbs);
      hits.forEach((lineNo) => {
        fail(rel, lineNo, 'literal ' + LITERAL + ' present in shipped/executable code');
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Walk 2: reference docs + the ledger -- literal allowed only alongside its
// corrected meaning (2.1.232 + an opt-out/opt-in polarity marker), checked
// per-file (not per-line), matched case-insensitively.
// ---------------------------------------------------------------------------
const docTargets = [];
walk(path.join(ROOT, DOC_DIR), (fileAbs) => docTargets.push(fileAbs));
const ledgerAbs = path.join(ROOT, LEDGER_FILE);
if (fs.existsSync(ledgerAbs)) docTargets.push(ledgerAbs);

for (const fileAbs of docTargets) {
  let content;
  try {
    content = fs.readFileSync(fileAbs, 'utf8');
  } catch (_e) {
    continue;
  }
  const hits = findLiteralLines(content);
  if (hits.length === 0) continue;

  const rel = path.relative(ROOT, fileAbs);
  const lower = content.toLowerCase();
  const hasVersionPin = content.includes('2.1.232');
  const hasPolarityMarker = lower.includes('opt-out') || lower.includes('opt out');

  if (!hasVersionPin) {
    fail(rel, hits[0], 'contains ' + LITERAL + ' but not the 2.1.232 version pin anywhere in the file');
  }
  if (!hasPolarityMarker) {
    fail(rel, hits[0], 'contains ' + LITERAL + ' but no "opt-OUT" / "opt out" polarity marker anywhere in the file');
  }
}

if (failed) {
  console.error('tests/test-265-no-fork-subagent-literal.cjs: FAILED');
  failures.forEach((f) => console.error('  FAIL: ' + f));
  process.exit(1);
}

console.log('tests/test-265-no-fork-subagent-literal.cjs: PASSED');
process.exit(0);
