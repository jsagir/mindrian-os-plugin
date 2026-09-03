#!/usr/bin/env node
'use strict';

/*
 * Phase 276 Plan 04, Task 1 -- TOOLHON-02, the two-directional ledger diff.
 *
 * D-276-2 is the binding definition this file enforces: "close all findings"
 * means every one of them gets a written disposition in
 * tests/fixtures/tool-honesty/276-dispositions.json, verified by re-running
 * scripts/check-tool-honesty.cjs's own scanAll(), never by assertion alone.
 *
 * WAVE 0 IS RED BY DESIGN for this file. The ledger does not exist yet; it is
 * minted by plan 276-06 (see 276-01-PLAN.md's artifacts_this_phase_produces
 * section for the exact schema this test enforces). An absent ledger is the
 * undispositioned state this test exists to forbid, so a missing file is a
 * genuine FAIL, never a skip -- the first failure line names the absent path
 * and plan 276-06 as its owner. Group C (the progress meter) stays RED for
 * every plan between 276-06 and the end of wave 2 by design: it counts how
 * many ledger entries expecting an eventual OK verdict are still open in the
 * live scan today, and that count IS this phase's own progress meter.
 *
 * Never calls scripts/check-tool-honesty.cjs as a subprocess and never calls
 * process.exit on the checker's behalf -- this file requires the checker's
 * module.exports and calls its exported scanAll() directly, matching the
 * discipline every other 276 unit test already follows.
 *
 * Canon Part 8: LOCAL only. node:fs, node:path, node:assert/strict only. No
 * network, no Brain call, no room.db write. No em-dashes.
 *
 * Run: node tests/test-276-tool-honesty-findings-closed.cjs
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const checker = require(path.join(REPO_ROOT, 'scripts', 'check-tool-honesty.cjs'));
const LEDGER_PATH = path.join(REPO_ROOT, 'tests', 'fixtures', 'tool-honesty', '276-dispositions.json');
const LEDGER_REL = 'tests/fixtures/tool-honesty/276-dispositions.json';

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
// Load the ledger. Absent is a FAIL, never a skip.
// ---------------------------------------------------------------------------
process.stdout.write('-- LEDGER LOAD --\n');
let ledger = null;
const ledgerExists = fs.existsSync(LEDGER_PATH);
check(
  'disposition ledger exists at ' + LEDGER_REL,
  ledgerExists,
  ledgerExists
    ? undefined
    : 'ABSENT. Owner: plan 276-06 must create this file (schema in 276-01-PLAN.md '
      + 'artifacts_this_phase_produces). An absent ledger is the undispositioned state '
      + 'this test exists to forbid; this is NOT a skip.'
);
if (ledgerExists) {
  try {
    ledger = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
    check(LEDGER_REL + ' parses as JSON', true);
  } catch (e) {
    check(LEDGER_REL + ' parses as JSON', false, String(e && e.message));
  }
}

const dispositions = (ledger && Array.isArray(ledger.dispositions)) ? ledger.dispositions : [];

// ---------------------------------------------------------------------------
// Live scan.
// ---------------------------------------------------------------------------
const liveScan = checker.scanAll();
const liveRows = liveScan.rows;
const nonOkRows = liveRows.filter((r) => r.verdict !== 'OK');

function rowKey(tool, command) {
  return tool + '::' + command;
}

const dispByKey = new Map();
for (const d of dispositions) {
  dispByKey.set(rowKey(d.tool, d.command), d);
}

// ---------------------------------------------------------------------------
// GROUP A -- no undispositioned finding. Closure by silence is impossible:
// every live non-OK row must carry a ledger entry keyed on tool+command.
// ---------------------------------------------------------------------------
process.stdout.write('\n-- GROUP A: no undispositioned finding (closure by silence is impossible) --\n');
for (const row of nonOkRows) {
  const entry = dispByKey.get(rowKey(row.tool, row.command));
  check(
    'live non-OK row ' + row.tool + '.' + row.command + ' has a ledger disposition',
    !!entry,
    'tool=' + row.tool + ' command=' + row.command + ' verdict=' + row.verdict + ' reason=' + row.reason
  );
}
if (nonOkRows.length === 0) {
  info('live scan reports zero non-OK rows today; Group A has nothing to check against');
} else {
  info('live scan reports ' + nonOkRows.length + ' non-OK row(s) today');
}

// ---------------------------------------------------------------------------
// GROUP B -- no stale ledger entry. Every entry's own shape is validated
// structurally, independent of whether the ledger exists yet.
// ---------------------------------------------------------------------------
process.stdout.write('\n-- GROUP B: no stale ledger entry (structural contract per entry) --\n');
const CLOSED_VOCAB = new Set(['real-bug-fix', 'detector-fix', 'description-correction', 'documented-no-action']);
const VERDICT_VOCAB = new Set(['OK', 'MEDIUM', 'UNKNOWN']);
for (const d of dispositions) {
  const label = (d && d.tool) + '.' + (d && d.command);
  check(
    label + ' disposition is one of the closed vocabulary',
    !!d && CLOSED_VOCAB.has(d.disposition),
    'disposition=' + (d && d.disposition)
  );
  const reasonLen = (d && typeof d.reason === 'string') ? d.reason.length : -1;
  const reasonHasCitation = (d && typeof d.reason === 'string') ? /:\d/.test(d.reason) : false;
  check(
    label + ' reason is a string of at least 40 characters carrying a file:line citation',
    reasonLen >= 40 && reasonHasCitation,
    'reason=' + JSON.stringify(d && d.reason)
      + '. A disposition recorded without a file:line citation is the Pitfall 3 warning sign.'
  );
  check(
    label + ' owner_plan matches the pattern 276-NN',
    !!d && typeof d.owner_plan === 'string' && /^276-\d{2}$/.test(d.owner_plan),
    'owner_plan=' + (d && d.owner_plan)
  );
  check(
    label + ' expected_final_verdict is one of OK, MEDIUM, UNKNOWN',
    !!d && VERDICT_VOCAB.has(d.expected_final_verdict),
    'expected_final_verdict=' + (d && d.expected_final_verdict)
  );
}
if (dispositions.length === 0) {
  info('ledger carries zero disposition entries today (either absent or not yet populated); Group B has nothing to iterate');
}

// ---------------------------------------------------------------------------
// GROUP C -- the progress meter. For every ledger entry expecting an
// eventual OK, the live row must already be absent from the non-OK set.
// RED between plan 276-06 and the end of wave 2 by design: the count of
// still-open entries printed below IS this phase's own progress meter, not
// a defect in this test file.
// ---------------------------------------------------------------------------
process.stdout.write('\n-- GROUP C: progress meter (RED between 276-06 and end of wave 2, by design) --\n');
let stillOpen = 0;
for (const d of dispositions) {
  if (!d || d.expected_final_verdict !== 'OK') continue;
  const stillNonOk = nonOkRows.some((r) => r.tool === d.tool && r.command === d.command);
  if (stillNonOk) stillOpen += 1;
  check(
    d.tool + '.' + d.command + ' (expects eventual OK) is absent from the live non-OK set',
    !stillNonOk,
    stillNonOk
      ? 'still present in the live non-OK set; this is the phase progress meter counting down, '
        + 'not a defect of this test file'
      : undefined
  );
}
info('PROGRESS METER: ' + stillOpen + ' ledger entr' + (stillOpen === 1 ? 'y' : 'ies')
  + ' expecting an eventual OK verdict remain open (non-OK) in the live scan right now');

// ---------------------------------------------------------------------------
// GROUP D -- honest non-OK entries never rot. MEDIUM/UNKNOWN entries stay
// permanently visible under D-276-2 (never suppressible); the live row must
// still exist and still carry exactly that verdict, or the ledger is stale.
// ---------------------------------------------------------------------------
process.stdout.write('\n-- GROUP D: honest non-OK entries never rot (D-276-2: MEDIUM/UNKNOWN never suppressible) --\n');
for (const d of dispositions) {
  if (!d || d.expected_final_verdict === 'OK') continue;
  const liveRow = liveRows.find((r) => r.tool === d.tool && r.command === d.command);
  check(
    d.tool + '.' + d.command + ' (expects permanent ' + d.expected_final_verdict + ') still exists live with that exact verdict',
    !!liveRow && liveRow.verdict === d.expected_final_verdict,
    'live=' + (liveRow ? liveRow.verdict : 'MISSING FROM LIVE SCAN')
  );
}

// ---------------------------------------------------------------------------
// GROUP E -- no frozen totals in this file's own source. Neither 10 nor 24
// may appear as a compared literal, comments stripped. The digit pairs this
// check searches FOR are built from character codes rather than written as
// contiguous digits, so this assertion's own implementation cannot trip
// itself: a frozen count is exactly how a gate silently stops matching
// reality, and that includes this gate.
// ---------------------------------------------------------------------------
process.stdout.write('\n-- GROUP E: no frozen totals in this file\'s own source --\n');
{
  const src = fs.readFileSync(__filename, 'utf8');
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line) && !/^\s*\*/.test(line))
    .join('\n');

  // The two forbidden digit pairs (ten and twenty-four, spelled out here in
  // words rather than numerals for exactly this reason) are built from
  // character codes, and every label below spells them in words too, so this
  // assertion's own implementation cannot trip itself: a frozen count is
  // exactly how a gate silently stops matching reality, and that includes
  // this gate checking its own source.
  const digitChar = (n) => String.fromCharCode(48 + n);
  const TEN = digitChar(1) + digitChar(0);
  const TWENTY_FOUR = digitChar(2) + digitChar(4);
  const frozenCountRe = new RegExp('(^|[^0-9])(' + TEN + '|' + TWENTY_FOUR + ')([^0-9]|$)');
  const hasFrozenCount = frozenCountRe.test(stripped);
  check(
    'this file\'s own source (comments stripped) carries no hard-coded ten-or-twenty-four comparison literal',
    !hasFrozenCount,
    'a frozen finding-count literal was found; counts must come from the live scan and the ledger\'s own length'
  );

  // Unicode escape, not a literal em-dash character, so THIS file's own
  // source stays clean under the repo-wide no-em-dash fence.
  const hasEmDash = src.indexOf('\u2014') !== -1;
  check('this file contains no em-dash', !hasEmDash);
}

// ---------------------------------------------------------------------------
// GROUP F -- the ledger's declared sweep versus the live sweep. If the
// scanned surface itself has changed (more/fewer tools or branches) since
// the ledger was frozen, that is a real drift, not a tolerance to paper over.
// ---------------------------------------------------------------------------
process.stdout.write('\n-- GROUP F: ledger declared sweep vs live sweep --\n');
if (ledger && ledger.frozen_sweep) {
  info('ledger frozen_sweep.tools=' + ledger.frozen_sweep.tools + ' branches=' + ledger.frozen_sweep.branches);
  info('live scanAll toolCount=' + liveScan.toolCount + ' branchCount=' + liveScan.branchCount);
  check(
    'ledger frozen_sweep.tools matches live scanAll toolCount',
    ledger.frozen_sweep.tools === liveScan.toolCount,
    'ledger=' + ledger.frozen_sweep.tools + ' live=' + liveScan.toolCount
      + '. The scan surface itself changed since the freeze; the ledger needs re-freezing, not silent tolerance.'
  );
  check(
    'ledger frozen_sweep.branches matches live scanAll branchCount',
    ledger.frozen_sweep.branches === liveScan.branchCount,
    'ledger=' + ledger.frozen_sweep.branches + ' live=' + liveScan.branchCount
      + '. The scan surface itself changed since the freeze; the ledger needs re-freezing, not silent tolerance.'
  );
} else {
  info('GROUP F skipped: no ledger loaded, or ledger carries no frozen_sweep block yet');
}

finish();
