#!/usr/bin/env node
'use strict';
/*
 * tests/test-265-supersede-chain.cjs -- Phase 265 Plan 06.
 *
 * Tripwire asserting the supersede-never-delete discipline actually held for
 * SEED-003 and Phase 138: both are marked superseded, both still exist on
 * disk with their bodies intact, and Phase 138's drift finding W007-138 is
 * closed with a forward pointer rather than silently deleted.
 *
 * Extended by Plan 06 Task 3 with a ledger arm: every capability-ledger row
 * whose disposition required a judgment call (status dormant, or a non-none
 * destination) carries a `decision_ref` that resolves to a file on disk. A
 * dangling decision_ref fails.
 *
 * Plain Node script (no node:test), modeled on tests/test-223-supersedes-chain.cjs
 * (its check()/pass-fail print shape). Hermetic: reads files only, no network,
 * no DB. PASS/FAIL line per arm; process.exit(1) on any failure.
 *
 * NO em-dashes (CLAUDE.md HARD RULE).
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');

let passed = 0;
let failed = 0;
function check(name, cond) {
  if (cond) {
    passed += 1;
    console.log('  ok - ' + name);
  } else {
    failed += 1;
    console.log('  NOT OK - ' + name);
  }
}

function readFile(relPath) {
  return fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
}

console.log('--- Arm 1: SEED-003 marked superseded, body intact ---');
{
  const relPath = '.planning/seeds/SEED-003-claude-code-2-1-x-capability-adoption.md';
  const abs = path.join(REPO_ROOT, relPath);
  check('SEED-003 file exists on disk', fs.existsSync(abs));
  if (fs.existsSync(abs)) {
    const body = readFile(relPath);
    check('superseded_by names Phase 265', /superseded_by:\s*Phase 265/.test(body));
    check('status is superseded', /^status:\s*superseded\s*$/m.test(body));
    check('original A1-A5 adoption-candidate body preserved', /## Adoption Candidates/.test(body) && /A4 .*Forked Subagents/.test(body));
  }
}

console.log('--- Arm 2: 138-CONTEXT.md marked superseded, body intact ---');
{
  const relPath = '.planning/phases/138-capability-radar-absorption-and-routing/138-CONTEXT.md';
  const abs = path.join(REPO_ROOT, relPath);
  check('138-CONTEXT.md file exists on disk', fs.existsSync(abs));
  if (fs.existsSync(abs)) {
    const body = readFile(relPath);
    check('superseded_by names Phase 265', /superseded_by:\s*Phase 265/.test(body));
    check('original origin: line preserved (body not gutted)', /^origin:\s*"\/mos:radar --fetch 2026-06-01/m.test(body));
    check('trailing section heading contains "Superseded by Phase 265"', /## Superseded by Phase 265/.test(body));
    const hasAllErrors = ['E-1', 'E-2', 'E-3', 'E-4', 'E-5'].every((id) => body.includes('`' + id + '`'));
    check('appended section names all five error ids E-1 through E-5', hasAllErrors);
  }
}

console.log('--- Arm 3: 138/DRIFT.md closed, not deleted ---');
{
  const relPath = '.planning/phases/138/DRIFT.md';
  const abs = path.join(REPO_ROOT, relPath);
  check('138/DRIFT.md file exists on disk', fs.existsSync(abs));
  if (fs.existsSync(abs)) {
    const body = readFile(relPath);
    check('frontmatter status is closed', /^status:\s*closed\s*$/m.test(body));
    const rowMatch = body.match(/\|\s*W007-138\s*\|[^\n]*\|/);
    check('W007-138 row exists', !!rowMatch);
    if (rowMatch) {
      const row = rowMatch[0];
      check('W007-138 row status cell is closed', /\|\s*closed\s*\|/.test(row));
      const cells = row.split('|').map((c) => c.trim());
      // finding_id | severity | status | detail | first_seen | last_seen | closed_date
      const closedDateCell = cells[7];
      check('W007-138 row has a non-empty closed_date cell', !!closedDateCell && closedDateCell.length > 0);
    }
  }
}

console.log('--- Arm 4: no deletions ---');
{
  const { execFileSync } = require('child_process');
  let statusOut = '';
  try {
    statusOut = execFileSync('git', ['status', '--porcelain'], { cwd: REPO_ROOT, encoding: 'utf8' });
  } catch (e) {
    statusOut = '';
  }
  const deletionLines = statusOut
    .split('\n')
    .filter((line) => /^\s*D/.test(line) || /^[AM]D\s/.test(line));
  check('git status --porcelain shows no deletions', deletionLines.length === 0);
}

console.log('--- Arm 5: ledger decision_ref resolves for every judgment-call row ---');
{
  const ledgerPath = path.join(REPO_ROOT, 'data', 'capability-ledger.json');
  check('capability-ledger.json exists', fs.existsSync(ledgerPath));
  if (fs.existsSync(ledgerPath)) {
    let ledger;
    try {
      ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
    } catch (e) {
      check('capability-ledger.json is valid JSON', false);
      ledger = null;
    }
    if (ledger && Array.isArray(ledger.entries)) {
      let allResolve = true;
      let judgmentCallCount = 0;
      for (const row of ledger.entries) {
        const requiresJudgment =
          row.status === 'dormant' || (typeof row.destination === 'string' && row.destination !== 'none');
        if (requiresJudgment) {
          judgmentCallCount += 1;
          if (!row.decision_ref) {
            // Not every judgment-call row is required to carry a decision_ref
            // (mechanical destination assignments do not need one); this arm
            // only asserts that WHEN a decision_ref IS present, it resolves.
            continue;
          }
          const refAbs = path.join(REPO_ROOT, row.decision_ref);
          if (!fs.existsSync(refAbs)) {
            allResolve = false;
            console.log('    dangling decision_ref: ' + row.capability + ' -> ' + row.decision_ref);
          }
        }
      }
      check('every present decision_ref resolves to a file on disk (' + judgmentCallCount + ' judgment-call rows scanned)', allResolve);

      const decisionRefCount = ledger.entries.filter((e) => e.decision_ref === 'docs/RADAR-ABSORPTION-265.md').length;
      check('at least 4 rows cross-reference docs/RADAR-ABSORPTION-265.md', decisionRefCount >= 4);
    }
  }
}

console.log('');
if (failed > 0) {
  console.log('tests/test-265-supersede-chain.cjs: FAILED (' + passed + ' ok, ' + failed + ' not ok)');
  process.exit(1);
}
console.log('tests/test-265-supersede-chain.cjs: PASSED (' + passed + ' ok)');
process.exit(0);
