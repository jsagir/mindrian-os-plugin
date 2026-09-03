'use strict';
// Phase 267.2 W0 -- phase-owned pin for the navigator-ordered scope revert of commit f39f24d9
// (the 267.1-06 Task 2 checkpoint). This is a NEGATIVE pin and must stay one: this phase
// deliberately removes a mandate a prior phase added, so a future well-meaning session that
// re-adds it must fail loudly rather than quietly reintroduce the scope error the navigator
// reversed. Anchored on literals via readRegion (tests/test-267-2-helpers.cjs), never on line
// numbers -- the FIRST_INSTALL payload in scripts/session-start is one ~3000-char physical line
// whose line number moves across edits.

const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const { readRegion } = require('./test-267-2-helpers.cjs');

const REPO = path.join(__dirname, '..');
const SESSION_START = path.join(REPO, 'scripts', 'session-start');
const FIRST_INSTALL_ANCHOR = '[MindrianOS Onboarding] First install detected.';
const COLD_START_MENU_ANCHOR = 'COLD_START_MENU="---\\nGet started:';

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

console.log('test-267-2-w0-revert');

ok('The FIRST_INSTALL region does not carry AskUserQuestion (W0 revert of commit f39f24d9, '
  + 'per the 267.1-06 Task 2 navigator ruling)', function () {
  const fi = readRegion(SESSION_START, FIRST_INSTALL_ANCHOR);
  assert.equal(fi.indexOf('AskUserQuestion'), -1,
    'W0 regressed: FIRST_INSTALL regained the AskUserQuestion mandate that commit f39f24d9 added '
    + 'and that the 267.1-06 Task 2 navigator ruling ordered reverted in this phase');
});

ok('The FIRST_INSTALL region does not carry the SEED-021 citation (W0 revert of commit f39f24d9, '
  + 'per the 267.1-06 Task 2 navigator ruling)', function () {
  const fi = readRegion(SESSION_START, FIRST_INSTALL_ANCHOR);
  assert.equal(fi.indexOf('SEED-021'), -1,
    'W0 regressed: FIRST_INSTALL regained the SEED-021 citation that commit f39f24d9 added and '
    + 'that the 267.1-06 Task 2 navigator ruling ordered reverted in this phase');
});

ok('The FIRST_INSTALL region no longer carries the bare pre-f39f24d9 "Offer three approaches:" '
  + 'wording (superseded by 267.2-08\'s prose rewrite, per D-N item 6: "W0\'s revert is partly '
  + 'superseded by W1\'s own prose rewrite two waves later")', function () {
  // W0 (this file's original job) restored the bare pre-f39f24d9 three-approach wording as the
  // literal evidence that the SEED-021 AskUserQuestion mandate had been cleanly reverted, not
  // rewritten into something else. Decision D-N item 6 named in advance that this literal would
  // not survive 267.2-08's own prose rewrite (D-B: one open question replaces the three-approach
  // menu entirely), and ordered the two changes to ship as separate recorded acts rather than be
  // collapsed into one edit. This assertion is therefore now a NEGATIVE pin matching that plan:
  // if a future session reintroduces a three-approach menu, it has regressed BOTH W0's revert
  // intent (no model-facing multi-option menu on this turn) and 267.2-08's repair (D-B).
  const fi = readRegion(SESSION_START, FIRST_INSTALL_ANCHOR);
  assert.equal(fi.indexOf('Offer three approaches:'), -1,
    '267.2-08 regressed: FIRST_INSTALL regained the pre-f39f24d9 "Offer three approaches:" menu '
    + 'wording that plan 267.2-08 (D-B) deliberately replaced with one open question');
});

ok('Sanity guard: the sliced FIRST_INSTALL region is longer than 1200 characters (a bad slice '
  + 'cannot make the negative assertions above pass vacuously)', function () {
  // Threshold lowered from 2000 to 1200 by 267.2-08, which deliberately shrank this payload
  // (removed the unbacked domain-intelligence promise, the eight-field ~/.mindrian-user.md
  // capture instruction, and the three-option menu). See the matching note in
  // tests/test-267-1-first-install-hooked-audit.cjs.
  const fi = readRegion(SESSION_START, FIRST_INSTALL_ANCHOR);
  assert.ok(fi.length > 1200,
    'sanity check failed: the FIRST_INSTALL slice looks truncated (length ' + fi.length + ')');
});

ok('The COLD_START_MENU anchor literal is still present (decision D-F: this phase does not '
  + 'modify the COLD_START_MENU variable)', function () {
  const src = fs.readFileSync(SESSION_START, 'utf8');
  assert.notEqual(src.indexOf(COLD_START_MENU_ANCHOR), -1,
    'D-F regressed: the COLD_START_MENU="---\\nGet started: anchor literal changed or is missing - '
    + 'this protects tests/test-267.3-session-start-declaration.cjs from a silent break');
});

ok('scripts/session-start still parses (bash -n)', function () {
  execFileSync('bash', ['-n', SESSION_START], { cwd: REPO, stdio: 'pipe' });
});

console.log('\nPASS test-267-2-w0-revert (' + n + ' assertions)');
