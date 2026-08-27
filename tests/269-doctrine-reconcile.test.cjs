#!/usr/bin/env node
'use strict';

/**
 * Phase 269 Plan 01, Task 1 -- the doctrine reconciliation fence.
 * ==========================================================================
 * Proves MOAT-01 through MOAT-05, one sentence per requirement:
 *   MOAT-01: decisions.md row 1 names install/update as the enforcement
 *     point and drops the per-query key-check framing, while the two
 *     substrings tests/test-250-amendment-unit.cjs already pins survive.
 *   MOAT-02: decisions.md row 5 keeps "The Brain is remote by design, not
 *     optional by default" verbatim and adds the per-query-keys-are-gone
 *     clause alongside it.
 *   MOAT-03: moat.md carries a commercial-boundary paragraph naming
 *     install/update time, while the existing "served via MCP, never
 *     distributed" sentence survives verbatim.
 *   MOAT-04: the dated amendment doc records all four cross-cutting flags
 *     this phase surfaced.
 *   MOAT-05: zero entitlement-check code ships this phase, and the CLI key
 *     ceremony has not moved yet.
 *
 * Run BEFORE the doctrine edits land, this test demonstrably FAILS -- that
 * RED run is filed in 269-01-SUMMARY.md (the can-fail proof convention).
 *
 * node --test, CJS, node:assert/strict + node:fs + node:path only. No new
 * deps. No em-dashes.
 *
 * Two deliberate divergences from the repo's usual test shape, written down
 * here because .planning/ is gitignored and this tracked file is the only
 * place the reasoning survives across a machine switch:
 *   1. This file keeps the name `269-doctrine-reconcile.test.cjs` from
 *      269-RESEARCH.md and 269-VALIDATION.md rather than the repo's usual
 *      `test-<phase>-<slug>.cjs` shape. tests/run-all-269.sh therefore
 *      reaches it through an explicit anchor leg instead of the
 *      tests/test-269- glob, which cannot see this filename.
 *   2. The no-em-dash scan is NOT duplicated here. tests/run-all-269.sh owns
 *      it as a fence over the full target list (this file, the aggregator,
 *      and both doctrine markdown files), so a single fence covers every
 *      Phase 269 surface instead of two fences drifting apart.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const REPO_ROOT = path.resolve(__dirname, '..');

const DECISIONS_PATH = path.join(REPO_ROOT, '.claude', 'includes', 'decisions.md');
const MOAT_PATH = path.join(REPO_ROOT, '.claude', 'includes', 'moat.md');
const AMENDMENT_PATH = path.join(
  REPO_ROOT,
  'docs',
  'AMENDMENT-2026-08-27-DECISIONS-1-AND-5-MOAT-SHIFT.md'
);
const CLI_PATH = path.join(REPO_ROOT, 'bin', 'cli.js');

// The exact pre-phase row 1, byte for byte. Its continued presence after
// the doctrine edit means row 1 was never reconciled.
const OLD_ROW_1 =
  '| 1 | One-command install; the Brain is part of what installs. | ' +
  "Larry's methodology comes from the Brain and says so; a keyless session " +
  'gets an honest refusal and a visible path to a key, never an imitation. |';

// The two substrings tests/test-250-amendment-unit.cjs already pins in row
// 1. These must survive the reconciliation, ADDED-alongside rather than
// replaced, or that existing test goes RED.
const PRESERVED_ROW_1_SUBSTRINGS = [
  'the Brain is part of what installs',
  'a keyless session gets an honest refusal and a visible path to a key',
];

// The exact substring tests/test-250-amendment-unit.cjs pins in row 5. The
// moat shift moves the enforcement point; it must never delete this
// remote-by-design principle.
const PRESERVED_ROW_5_SUBSTRING = 'The Brain is remote by design, not optional by default';

// The closed four-flag set this phase surfaces but does not resolve.
const FLAG_ANCHORS = [
  'FLAG 1: docs/BUSINESS-MODEL-AND-MOAT.md',
  'FLAG 2: project_mindrianos_business_model.md',
  'FLAG 3: LICENSE BSL 1.1 Additional Use Grant (d)',
  'FLAG 4: Gaurav Thorat double sign-in RCA gap',
];

// Locate by content, anchored on a fixed string unchanged by the edit, so
// the extraction survives the edit it guards (cloned from the
// tests/test-250-doctrine-fence.cjs content-anchored shape).
function extractParagraph(text, anchor) {
  const anchorIdx = text.indexOf(anchor);
  if (anchorIdx === -1) return null;
  const afterAnchor = text.slice(anchorIdx);
  const firstBreak = afterAnchor.indexOf('\n\n');
  if (firstBreak === -1) return afterAnchor;
  return afterAnchor.slice(0, firstBreak);
}

// ---------------------------------------------------------------------------
// MOAT-01: decisions.md row 1 states the install/update enforcement point.
// ---------------------------------------------------------------------------
test('MOAT-01: decisions.md row 1 names install/update as the enforcement point, drops per-query key-check framing', () => {
  const decisions = fs.readFileSync(DECISIONS_PATH, 'utf8');

  assert.ok(
    decisions.includes('checked at install and update time'),
    'row 1 must state the entitlement is checked at install and update time, the new enforcement point'
  );
  assert.ok(
    decisions.includes('no separate per-query key check'),
    'row 1 must explicitly say there is no separate per-query key check, the moat shift this phase records'
  );

  for (const substr of PRESERVED_ROW_1_SUBSTRINGS) {
    assert.ok(
      decisions.includes(substr),
      'row 1 must still carry "' +
        substr +
        '" -- tests/test-250-amendment-unit.cjs pins this substring and reds if it is deleted rather than added-alongside'
    );
  }

  assert.ok(
    !decisions.includes(OLD_ROW_1),
    'an unreconciled row 1 (the exact pre-phase text) must red this test -- the doctrine edit has not landed'
  );
  assert.ok(
    !decisions.includes('Zero config; Larry works immediately.'),
    'row 1 must not carry the pre-amendment rationale carried over from Phase 250 -- a regression to the old row'
  );
});

// ---------------------------------------------------------------------------
// MOAT-02: decisions.md row 5 keeps remote-by-design verbatim, adds the
// per-query-keys-are-gone clause.
// ---------------------------------------------------------------------------
test('MOAT-02: decisions.md row 5 preserves remote-by-design verbatim and adds the per-query-keys-are-gone clause', () => {
  const decisions = fs.readFileSync(DECISIONS_PATH, 'utf8');

  assert.ok(
    decisions.includes(PRESERVED_ROW_5_SUBSTRING),
    'row 5 must keep "' +
      PRESERVED_ROW_5_SUBSTRING +
      '" verbatim -- the moat shift moves the enforcement point and must never delete the remote-by-design principle'
  );
  assert.ok(
    decisions.includes('Per-query Brain keys are gone'),
    'row 5 must state per-query Brain keys are gone, the moat shift this phase records'
  );
  assert.ok(
    decisions.includes('the entitlement moved to install and update time'),
    'row 5 must state the entitlement moved to install and update time'
  );
});

// ---------------------------------------------------------------------------
// MOAT-03: moat.md carries a commercial-boundary paragraph.
// ---------------------------------------------------------------------------
test('MOAT-03: moat.md carries a commercial-boundary paragraph naming install/update as the paid gate', () => {
  const moat = fs.readFileSync(MOAT_PATH, 'utf8');

  const para = extractParagraph(moat, 'Commercial boundary:');
  assert.ok(
    para !== null,
    'moat.md must contain a paragraph starting "Commercial boundary:" -- the commercial-boundary clause this phase adds'
  );
  assert.ok(
    para.includes('INSTALLING and UPDATING'),
    'the commercial-boundary paragraph must name INSTALLING and UPDATING as the enforcement point'
  );
  assert.ok(
    para.includes('never checked per query'),
    'the commercial-boundary paragraph must state the entitlement is never checked per query'
  );

  assert.ok(
    moat.includes('served via MCP, never distributed'),
    'the existing moat sentence must survive verbatim -- the boundary clause is an ADD, not a replace'
  );

  const nonEmptyLines = moat.split('\n').filter((line) => line.trim().length > 0);
  const lastLine = nonEmptyLines[nonEmptyLines.length - 1];
  assert.ok(
    lastLine.startsWith('Deep dive:'),
    'the file must still end with a "Deep dive:" line -- the new clause must be inserted before it, not after'
  );
});

// ---------------------------------------------------------------------------
// MOAT-04: the amendment doc records all four cross-cutting flags.
// ---------------------------------------------------------------------------
test('MOAT-04: the amendment doc records all four cross-cutting flags', () => {
  assert.ok(
    fs.existsSync(AMENDMENT_PATH),
    'docs/AMENDMENT-2026-08-27-DECISIONS-1-AND-5-MOAT-SHIFT.md must exist -- plan 02 is its producer'
  );

  const text = fs.readFileSync(AMENDMENT_PATH, 'utf8');
  for (const anchor of FLAG_ANCHORS) {
    assert.ok(
      text.includes(anchor),
      'the amendment doc must include "' + anchor + '" so a missing flag names itself in this failure output'
    );
  }
});

// ---------------------------------------------------------------------------
// MOAT-05: zero entitlement-check code ships this phase.
// ---------------------------------------------------------------------------
test('MOAT-05: zero entitlement-check code ships this phase, CLI key ceremony unmoved', () => {
  assert.ok(
    !fs.existsSync(path.join(REPO_ROOT, 'lib', 'core', 'entitlement.cjs')),
    'Phase 269 ships zero entitlement-check code -- lib/core/entitlement.cjs existing means the deferred engineering family was executed against an interim Theo cutover state'
  );

  const cli = fs.readFileSync(CLI_PATH, 'utf8');
  assert.ok(
    cli.includes('Optional -- connect the Brain for enriched intelligence:'),
    'bin/cli.js must still contain this verbatim string -- the CLI key ceremony has not moved yet and its wording is the anchor that proves it'
  );
});

// ---------------------------------------------------------------------------
// Self-check: the closed four-flag set cannot be silently widened or
// narrowed.
// ---------------------------------------------------------------------------
test('Self-check: FLAG_ANCHORS is exactly the closed four-flag set', () => {
  assert.equal(FLAG_ANCHORS.length, 4, 'the flag set must carry exactly four anchors');
  assert.equal(FLAG_ANCHORS[0], 'FLAG 1: docs/BUSINESS-MODEL-AND-MOAT.md');
});
