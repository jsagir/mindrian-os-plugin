#!/usr/bin/env node
'use strict';

/*
 * Phase 276 Plan 04, Task 2 -- TOOLHON-06, the suppression contract made
 * structural.
 *
 * D-276-2 is the ruling this file exists to enforce as a test rather than a
 * comment: MEDIUM and UNKNOWN are never suppressible. This phase adds NO new
 * suppression path -- a proven false positive is a detector fix, not an
 * allowlist entry. scripts/check-tool-honesty.cjs:1162 gates
 * ALLOWED_UNVERIFIED on HIGH_RISK only, and Group B below proves that guard
 * holds behaviorally, against the REAL live scanAll() and the REAL exported
 * ALLOWED_UNVERIFIED array (the same array instance the consumption-site
 * loop reads from -- verified live before this assertion was written).
 *
 * Analog: scripts/check-substrate.cjs:53-140's ALLOWED_DIRECT_IMPORT copied
 * the same discipline as STRUCTURE (regex entries, a justification comment
 * each, a documented membership rule); check-tool-honesty.cjs:76-82 copied
 * it as prose only. This file is the structural half that was missing.
 *
 * Groups A, B and C exercise the CURRENT tree (array ships empty, the
 * HIGH_RISK-only guard is intact) and pass today. Group D requires the
 * declaration-site field documentation (tool, command, reason, triaged)
 * that plan 276-06 adds, and is the one assertion expected to fail today --
 * a future contributor should read the entry contract at the declaration
 * site, not infer it from the consumption site the way this phase's own
 * research had to.
 *
 * Canon Part 8: LOCAL only. node:fs, node:path, node:assert/strict only. No
 * network, no Brain call, no room.db write. No em-dashes.
 *
 * Run: node tests/test-276-allowed-unverified-contract.cjs
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const SCRIPT_PATH = path.join(REPO_ROOT, 'scripts', 'check-tool-honesty.cjs');
const checker = require(SCRIPT_PATH);

let passed = 0;
let failed = 0;
const failMessages = [];

function check(label, cond, detail) {
  try {
    assert.ok(cond, label);
    passed += 1;
    process.stdout.write('  ok - ' + label + '\n');
  } catch (e) {
    failed += 1;
    failMessages.push(label + (detail ? ' :: ' + detail : ''));
    process.stdout.write('  FAIL - ' + label + '\n');
    if (detail) process.stdout.write('    ' + String(detail) + '\n');
  }
}

function info(label) {
  process.stdout.write('  INFO - ' + label + '\n');
}

function finish() {
  process.stdout.write('\n  ' + passed + ' passed, ' + failed + ' failed\n');
  if (failed > 0) {
    process.stdout.write('\nFailures:\n');
    for (const m of failMessages) process.stdout.write('  - ' + m + '\n');
  }
  process.exit(failed === 0 ? 0 : 1);
}

// ---------------------------------------------------------------------------
// GROUP A -- per-entry contract. Empty today: assert that fact explicitly so
// the run is informative rather than vacuously green.
// ---------------------------------------------------------------------------
process.stdout.write('-- GROUP A: ALLOWED_UNVERIFIED per-entry contract --\n');
{
  const entries = checker.ALLOWED_UNVERIFIED;
  if (entries.length === 0) {
    info('ALLOWED_UNVERIFIED ships EMPTY today (matches scripts/check-tool-honesty.cjs:82); '
      + 'this is the correct pre-triage state, stated explicitly rather than passed vacuously.');
    check('ALLOWED_UNVERIFIED ships empty (stated explicitly, not a vacuous pass)', entries.length === 0);
  }
  const liveRows = checker.scanAll().rows;
  const now = Date.now();
  for (const entry of entries) {
    const label = (entry && entry.tool) + '.' + (entry && entry.command);
    const resolvesToLiveRow = !!entry && liveRows.some((r) => r.tool === entry.tool && r.command === entry.command);
    check(
      label + ' names a tool+command pair that resolves to a live scanAll() row',
      resolvesToLiveRow,
      'a stale entry naming a tool or command that no longer exists must turn this suite red, not rot silently'
    );
    check(
      label + ' carries a reason of at least sixty characters',
      !!entry && typeof entry.reason === 'string' && entry.reason.length >= 60,
      'reason=' + JSON.stringify(entry && entry.reason)
    );
    const triagedDate = entry && entry.triaged ? new Date(entry.triaged) : null;
    const triagedValid = !!triagedDate && !Number.isNaN(triagedDate.getTime()) && triagedDate.getTime() <= now;
    check(
      label + ' carries a triaged field parseable as an ISO date, not in the future',
      triagedValid,
      'triaged=' + (entry && entry.triaged)
    );
  }
}

// ---------------------------------------------------------------------------
// GROUP B -- the never-suppressible tiers (D-276-2), proven behaviorally
// against the REAL running scanAll() and the REAL exported ALLOWED_UNVERIFIED
// array. This phase adds no new suppression path; attempting to allowlist a
// MEDIUM or UNKNOWN row is mechanically a no-op that LOOKS like it worked,
// which is itself a false success -- exactly the disease this whole phase
// exists to close.
// ---------------------------------------------------------------------------
process.stdout.write('\n-- GROUP B: MEDIUM and UNKNOWN are never suppressible by design (D-276-2) --\n');
{
  const baseline = checker.scanAll();
  const mediumRow = baseline.rows.find((r) => r.verdict === 'MEDIUM');
  const highRiskRow = baseline.rows.find((r) => r.verdict === 'HIGH_RISK');

  // UNKNOWN, phase 276-07: sourced from a dedicated synthetic fixture
  // (tests/fixtures/tool-honesty/unresolvable.cjs), NOT the live tree.
  // The live tree's only UNKNOWN row (context_assemble.(default)) was
  // closed by plan 276-07's own Task 1 (negation demotion) and Task 2 (the
  // barrel re-export hop) -- both root-cause fixes. A test whose precondition
  // requires the live tree to STAY broken is fragile by construction: this
  // whole phase's goal is closing findings, so the live-tree UNKNOWN count
  // trending toward zero is success, not a test failure. The fixture pins
  // the probe permanently, the same way POSITIVE_SYNTHETIC/NEGATED_SYNTHETIC
  // already decouple test-ljj-tool-honesty.cjs from live-tree drift.
  const unknownFixturePath = path.join(REPO_ROOT, 'tests', 'fixtures', 'tool-honesty', 'unresolvable.cjs');
  const unknownScan = checker.scanAll({
    files: [{ absPath: unknownFixturePath, relPath: 'tests/fixtures/tool-honesty/unresolvable.cjs' }],
  });
  const unknownRow = unknownScan.rows.find((r) => r.verdict === 'UNKNOWN');

  check('a live MEDIUM row exists today to exercise the never-suppressible guard against',
    !!mediumRow, mediumRow ? undefined : 'no MEDIUM row found in the current tree');
  check('the synthetic unresolvable fixture produces an UNKNOWN row to exercise the never-suppressible guard against',
    !!unknownRow, unknownRow ? undefined : 'fixture_unresolvable did not resolve to UNKNOWN -- fixture shape drifted');
  check('a live HIGH_RISK row exists today as the suppression path\'s positive control',
    !!highRiskRow, highRiskRow ? undefined : 'no HIGH_RISK row found in the current tree');

  // checker.ALLOWED_UNVERIFIED is the SAME array instance scanAll()'s
  // consumption-site loop (check-tool-honesty.cjs:1161-1168) reads from --
  // module.exports copies the reference, not the contents, so mutating it
  // here mutates exactly what the real running code sees. Snapshot and
  // restore around the probe so this file leaves the array exactly as it
  // found it (empty, per Group A).
  const restore = checker.ALLOWED_UNVERIFIED.slice();
  try {
    if (mediumRow) {
      checker.ALLOWED_UNVERIFIED.length = 0;
      checker.ALLOWED_UNVERIFIED.push({
        tool: mediumRow.tool,
        command: mediumRow.command,
        reason: 'D-276-2 test probe: MEDIUM must never be suppressible; this synthetic entry must have zero effect on the live verdict.',
        triaged: '2026-09-03',
      });
      const afterMedium = checker.scanAll();
      const row = afterMedium.rows.find((r) => r.tool === mediumRow.tool && r.command === mediumRow.command);
      check(
        'D-276-2: an ALLOWED_UNVERIFIED entry naming a live MEDIUM row (' + mediumRow.tool + '.' + mediumRow.command
          + ') has zero effect -- the row stays MEDIUM',
        !!row && row.verdict === 'MEDIUM',
        'live verdict after synthetic allowlist entry: ' + (row ? row.verdict : 'MISSING')
      );
    }

    if (unknownRow) {
      checker.ALLOWED_UNVERIFIED.length = 0;
      checker.ALLOWED_UNVERIFIED.push({
        tool: unknownRow.tool,
        command: unknownRow.command,
        reason: 'D-276-2 test probe: UNKNOWN must never be suppressible; this synthetic entry must have zero effect on the live verdict.',
        triaged: '2026-09-03',
      });
      const afterUnknown = checker.scanAll({
        files: [{ absPath: unknownFixturePath, relPath: 'tests/fixtures/tool-honesty/unresolvable.cjs' }],
      });
      const row = afterUnknown.rows.find((r) => r.tool === unknownRow.tool && r.command === unknownRow.command);
      check(
        'D-276-2: an ALLOWED_UNVERIFIED entry naming a live UNKNOWN row (' + unknownRow.tool + '.' + unknownRow.command
          + ') has zero effect -- the row stays UNKNOWN',
        !!row && row.verdict === 'UNKNOWN',
        'live verdict after synthetic allowlist entry: ' + (row ? row.verdict : 'MISSING')
      );
    }

    if (highRiskRow) {
      checker.ALLOWED_UNVERIFIED.length = 0;
      checker.ALLOWED_UNVERIFIED.push({
        tool: highRiskRow.tool,
        command: highRiskRow.command,
        reason: 'D-276-2 test probe: positive control, HIGH_RISK IS the one tier the mechanism suppresses once triaged.',
        triaged: '2026-09-03',
      });
      const afterHigh = checker.scanAll();
      const row = afterHigh.rows.find((r) => r.tool === highRiskRow.tool && r.command === highRiskRow.command);
      check(
        'positive control: an ALLOWED_UNVERIFIED entry naming a live HIGH_RISK row (' + highRiskRow.tool + '.' + highRiskRow.command
          + ') DOES suppress to OK -- proves the mechanism itself works, so Group B is not vacuous',
        !!row && row.verdict === 'OK' && /^allow-listed \(triaged\)/.test(row.reason || ''),
        'live verdict after synthetic allowlist entry: ' + (row ? row.verdict + ' / ' + row.reason : 'MISSING')
      );
    }
  } finally {
    checker.ALLOWED_UNVERIFIED.length = 0;
    for (const e of restore) checker.ALLOWED_UNVERIFIED.push(e);
  }
  check('ALLOWED_UNVERIFIED restored to its pre-probe state after Group B', checker.ALLOWED_UNVERIFIED.length === restore.length);
}

// ---------------------------------------------------------------------------
// GROUP C -- no widening. The verdict-to-OK rewrite must appear exactly once
// in the non-comment source, so a future second suppression mechanism cannot
// be added quietly.
// ---------------------------------------------------------------------------
process.stdout.write('\n-- GROUP C: no second suppression mechanism (no widening) --\n');
{
  const src = fs.readFileSync(SCRIPT_PATH, 'utf8');
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line) && !/^\s*\*/.test(line))
    .join('\n');
  const rewriteRe = /verdict\s*=\s*'OK'/g;
  const hits = stripped.match(rewriteRe) || [];
  check(
    'the literal verdict = \'OK\' assignment appears exactly once in the non-comment checker source',
    hits.length === 1,
    'found ' + hits.length + ' occurrence(s); a second suppression mechanism would be a Tampering finding (T-276-13)'
  );

  const hasEmDash = src.indexOf('\u2014') !== -1;
  check('scripts/check-tool-honesty.cjs source contains no em-dash', !hasEmDash);
}

// ---------------------------------------------------------------------------
// GROUP D -- the entry-shape documentation. Expected to fail today: the
// declaration-site comment states the "never pre-populate" rule but does not
// name the required fields (tool, command, reason, triaged). Plan 276-06
// adds that documentation.
// ---------------------------------------------------------------------------
process.stdout.write('\n-- GROUP D: entry-shape documented at the declaration site --\n');
{
  const src = fs.readFileSync(SCRIPT_PATH, 'utf8');
  const declStart = src.indexOf('ALLOWED_UNVERIFIED -- self-allowlist');
  const declEnd = src.indexOf('const ALLOWED_UNVERIFIED = [];');
  const declWindow = (declStart !== -1 && declEnd !== -1) ? src.slice(declStart, declEnd + 32) : '';
  const requiredFields = ['tool', 'command', 'reason', 'triaged'];
  const missingFields = requiredFields.filter((f) => declWindow.indexOf(f) === -1);
  check(
    'the ALLOWED_UNVERIFIED declaration-site comment documents its required entry fields (tool, command, reason, triaged)',
    missingFields.length === 0,
    'missing from the declaration-site comment: ' + (missingFields.join(', ') || 'none')
      + '. A future contributor should read the contract here, not infer it from the consumption site at :1155-1175 '
      + '(exactly the way this phase\'s own 276-RESEARCH.md ALLOWED_UNVERIFIED Mechanism section had to).'
  );
}

finish();
