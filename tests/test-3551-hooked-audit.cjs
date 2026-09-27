#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355.1 Plan 08 Task 1 (AMB-05) -- pins 355.1-HOOKED-AUDIT.md's nine
 * headings, its honest-limit disclosure and Canon Part 12 (no praise/grade/
 * count near "finding"), and 355.1-CHECKPOINT.md's ten-item decision sheet.
 * The approval legs (a filled "## Navigator ruling" section) SKIP with
 * exit 77 until the navigator answers at the 355.1 checkpoint (Task 2);
 * every structural leg above still runs and must pass either way.
 *
 * Bare node script, no framework. hygiene-355 preamble (scrubVendorKey +
 * installNetGuard BEFORE any repo require, attempts() === 0 last).
 * No em-dashes (CLAUDE.md HARD RULE). Hyphens only.
 */

const hygiene = require('./helpers/hygiene-355.cjs');
hygiene.scrubVendorKey();
const netGuard = hygiene.installNetGuard();

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const PHASE_DIR = path.join(
  REPO,
  '.planning',
  'phases',
  '355.1-ambient-trigger-the-room-starts-the-breakthrough-run-sens-20'
);
const AUDIT_PATH = path.join(PHASE_DIR, '355.1-HOOKED-AUDIT.md');
const CHECKPOINT_PATH = path.join(PHASE_DIR, '355.1-CHECKPOINT.md');
const FLOOR_LEDGER_PATH = path.join(REPO, 'data', 'floor-ledger.json');
const DC_PATH = path.join(REPO, 'lib', 'core', 'direction-convention.cjs');

const EXPECTED_HEADINGS = [
  'What changes for the navigator',
  'Trigger',
  'Action',
  'Variable reward',
  'Investment',
  'Framing by problem type',
  'Surfaces',
  'Canon Part 12 check',
  'Open risks',
];

const FORBIDDEN_NEAR_FINDING = ['great', 'amazing', 'excellent', 'brilliant', 'breakthrough', 'validated', 'proven'];

// Built at runtime (never a literal U+2014 in this file's own source) so
// tests/run-all-3551.sh's em-dash leg (emdash_scan), which greps every
// tests/test-3551-*.cjs file whole for the literal character, does not
// false-positive on this comparison literal (deferred-items.md item 2).
const EM_DASH_CHAR = String.fromCharCode(0x2014);

console.log('test-3551-hooked-audit:');

let pass = 0;
let fail = 0;
function check(name, cond, detail) {
  if (cond) {
    pass += 1;
    console.log('PASS: ' + name);
  } else {
    fail += 1;
    console.log('FAIL: ' + name + (detail ? ' (' + detail + ')' : ''));
  }
  return cond;
}

// ---------------------------------------------------------------------------
// Structural legs: the audit
// ---------------------------------------------------------------------------

check('355.1-HOOKED-AUDIT.md exists', fs.existsSync(AUDIT_PATH));
const auditText = fs.existsSync(AUDIT_PATH) ? fs.readFileSync(AUDIT_PATH, 'utf8') : '';

const headingLines = auditText
  .split('\n')
  .filter((l) => l.startsWith('## '))
  .map((l) => l.slice(3).trim());

check('audit has exactly 9 "## " headings', headingLines.length === 9, 'found ' + headingLines.length);
check(
  'audit headings are in the required order',
  JSON.stringify(headingLines) === JSON.stringify(EXPECTED_HEADINGS),
  JSON.stringify(headingLines)
);

check('audit states "14 percent"', auditText.indexOf('14 percent') !== -1);
check('audit states "472"', auditText.indexOf('472') !== -1);
check('audit states "3,333"', auditText.indexOf('3,333') !== -1);

check('audit carries no U+2014 (em-dash)', auditText.indexOf(EM_DASH_CHAR) === -1);

let findingNearForbidden = null;
for (const word of FORBIDDEN_NEAR_FINDING) {
  const forward = new RegExp('\\b' + word + '\\b[^.\\n]{0,40}\\bfinding\\b', 'i');
  const backward = new RegExp('\\bfinding\\b[^.\\n]{0,40}\\b' + word + '\\b', 'i');
  if (forward.test(auditText) || backward.test(auditText)) {
    findingNearForbidden = word;
    break;
  }
}
check(
  'audit never sets a praise/grade/count word beside "finding"',
  findingNearForbidden === null,
  findingNearForbidden ? 'found "' + findingNearForbidden + '" near "finding"' : ''
);

// ---------------------------------------------------------------------------
// Structural legs: the checkpoint decision sheet
// ---------------------------------------------------------------------------

check('355.1-CHECKPOINT.md exists', fs.existsSync(CHECKPOINT_PATH));
const checkpointText = fs.existsSync(CHECKPOINT_PATH) ? fs.readFileSync(CHECKPOINT_PATH, 'utf8') : '';

const numberedItems = checkpointText.split('\n').filter((l) => /^[0-9]+\. /.test(l));
check('checkpoint has exactly 10 numbered items', numberedItems.length === 10, 'found ' + numberedItems.length);
check('checkpoint carries no U+2014 (em-dash)', checkpointText.indexOf(EM_DASH_CHAR) === -1);
check('checkpoint has a "## Navigator ruling" heading', checkpointText.indexOf('## Navigator ruling') !== -1);

// ---------------------------------------------------------------------------
// Approval legs: SKIP (exit 77) until the "## Navigator ruling" section is
// filled by the navigator at the 355.1 checkpoint (Task 2), then Task 3
// records the ruling and re-runs this file expecting these legs GREEN.
// ---------------------------------------------------------------------------

let rulingBody = '';
const rulingIdx = checkpointText.indexOf('## Navigator ruling');
if (rulingIdx !== -1) {
  rulingBody = checkpointText.slice(rulingIdx + '## Navigator ruling'.length).trim();
}
const rulingFilled = rulingBody.length > 0;

if (!rulingFilled) {
  console.log('SKIP (awaiting the 355.1 checkpoint): dated **Approved:** line');
  console.log('SKIP (awaiting the 355.1 checkpoint): FRAMING_CONFIRMED frozen by pws-author, framing_hash === framingHash()');
  console.log('SKIP (awaiting the 355.1 checkpoint): phraseHash() === PHRASES_CONFIRMED.phrase_hash');
  console.log('SKIP (awaiting the 355.1 checkpoint): both floor rows approved in data/floor-ledger.json');
} else {
  check('checkpoint has a dated "**Approved:**" line', /\*\*Approved:\*\*\s*\S+/.test(checkpointText));

  let dc = null;
  try {
    // eslint-disable-next-line global-require
    dc = require(DC_PATH);
  } catch (_e) {
    dc = null;
  }
  check('lib/core/direction-convention.cjs loads', !!dc);

  if (dc) {
    check(
      'FRAMING_CONFIRMED is a frozen object confirmed by pws-author, framing_hash === framingHash()',
      !!dc.FRAMING_CONFIRMED &&
        dc.FRAMING_CONFIRMED.by === 'pws-author' &&
        dc.FRAMING_CONFIRMED.framing_hash === dc.framingHash() &&
        Object.isFrozen(dc.FRAMING_CONFIRMED)
    );
    check(
      'phraseHash() still equals PHRASES_CONFIRMED.phrase_hash (355 regression)',
      dc.PHRASES_CONFIRMED && dc.PHRASES_CONFIRMED.phrase_hash === dc.phraseHash()
    );
  }

  let ledger = null;
  try {
    ledger = JSON.parse(fs.readFileSync(FLOOR_LEDGER_PATH, 'utf8'));
  } catch (_e) {
    ledger = null;
  }
  const rows = ledger ? (Array.isArray(ledger) ? ledger : ledger.rows || []) : [];
  const claimFloorRow = rows.find((r) => r.id === 'sensor-room-delta.CLAIM_FLOOR_N');
  const throttleRow = rows.find((r) => r.id === 'scout-cadence-guard.AMBIENT_MAX_RUNS_PER_HOUR');
  check(
    'sensor-room-delta.CLAIM_FLOOR_N row gates text is approved',
    !!claimFloorRow && typeof claimFloorRow.gates === 'string' && claimFloorRow.gates.indexOf('approved') !== -1
  );
  check(
    'scout-cadence-guard.AMBIENT_MAX_RUNS_PER_HOUR row gates text is approved',
    !!throttleRow && typeof throttleRow.gates === 'string' && throttleRow.gates.indexOf('approved') !== -1
  );
}

// ---------------------------------------------------------------------------
// Summary and exit code
// ---------------------------------------------------------------------------

console.log('PASS: ' + pass + ' FAIL: ' + fail);
assert.equal(netGuard.attempts(), 0, 'no network calls in a 355.1 test');

if (fail > 0) {
  process.exit(1);
} else if (!rulingFilled) {
  console.log('SKIP-77: awaiting the 355.1 checkpoint (navigator has not ruled yet)');
  process.exit(77);
} else {
  process.exit(0);
}
