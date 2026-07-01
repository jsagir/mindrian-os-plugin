'use strict';
/*
 * Phase 195-01 Wave 0 -- the canon 7-kind FLOOR test (FCM-08 guard).
 * =========================================================================
 * GREEN-AS-GUARD. This test is GREEN NOW and MUST STAY GREEN across the whole
 * phase. It is the guard the Wave-4 FCM-08 canon amendment writes AGAINST:
 *
 *   - RIGHT NOW (Waves 0-3) the Part 9 memory complement is SIX kinds
 *     (ROOM / STATE / MINTO / FEYNMAN / BRAIN / USER). This test asserts all six
 *     are byte-present in the canon and that the frozen-scalar membrane substring
 *     in CLAUDE.md is intact. It does NOT yet require DRIFT.
 *   - In Wave 5 (after the navigator-gated Part-9 amendment lands) this file is
 *     FLIPPED to additionally require the 7th kind, DRIFT, while every prior kind
 *     stays present. The flip is a one-line change: set REQUIRE_DRIFT = true.
 *
 * FLOOR discipline (never a count): we assert MEMBERSHIP of each named kind, never
 * an exact list length, so an additive amendment (six -> seven) cannot regress the
 * baseline. The frozen scalars (MAX_K=3, DIAL_REACH_K=6, 0.70/0.15) are asserted
 * UNTOUCHED here too, because the amendment must never re-tune them.
 *
 * Read-only: never mutates a tracked file (Part 8: zero Brain/network).
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const CANON = path.join(REPO_ROOT, 'docs', 'MINDRIAN-CANON.md');
const CLAUDE_MD = path.join(REPO_ROOT, 'CLAUDE.md');

// Wave-5 flip switch. Wave 0-3: false (six-kind complement is the floor). After
// the FCM-08 amendment ratifies DRIFT as the 7th kind, set this to true.
const REQUIRE_DRIFT = false;

// The Part 9 memory complement. The first six are the CURRENT canon; DRIFT is the
// gated 7th (asserted only once REQUIRE_DRIFT flips).
const CURRENT_SIX = ['ROOM.md', 'STATE.md', 'MINTO.md', 'FEYNMAN.md', 'BRAIN.md', 'USER.md'];
const SEVENTH = 'DRIFT.md';

// The frozen-scalar membrane substring both this floor and the run-all grep leg
// guard (CLAUDE.md); the FCM-08 amendment must leave it byte-identical.
const MEMBRANE_SUBSTRING = 'MAX_K=3, DIAL_REACH_K=6, 0.70/0.15 frozen';

let pass = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ok - ' + name); pass++; }

const canon = fs.readFileSync(CANON, 'utf8');
const claudeMd = fs.readFileSync(CLAUDE_MD, 'utf8');

// ---- every CURRENT memory kind is byte-present in the canon (FLOOR, not a count) ----
for (const kind of CURRENT_SIX) {
  ok('canon Part 9 lists ' + kind + ' (six-kind floor)', canon.indexOf(kind) !== -1);
}

// ---- the frozen-scalar membrane substring is intact in CLAUDE.md ----
ok('CLAUDE.md frozen-scalar membrane substring intact',
  claudeMd.indexOf(MEMBRANE_SUBSTRING) !== -1);

// ---- frozen scalars remain UNTOUCHED in the canon (the amendment may not re-tune) ----
ok('MAX_K=3 present (byte-identical)', canon.indexOf('MAX_K=3') !== -1);
ok('DIAL_REACH_K=6 present (byte-identical)', canon.indexOf('DIAL_REACH_K=6') !== -1);
ok('0.70/0.15 gate present (byte-identical)', canon.indexOf('0.70/0.15') !== -1);

// ---- the gated 7th kind: guarded now, required after the Wave-5 flip ----
if (REQUIRE_DRIFT) {
  ok('canon Part 9 lists ' + SEVENTH + ' (7th kind, post-amendment)',
    canon.indexOf(SEVENTH) !== -1);
} else {
  console.log('  -- DRIFT (7th kind) NOT yet required: canon amendment is Wave 4 (REQUIRE_DRIFT=false)');
}

console.log('\nPASS test-195-canon-7-kind-floor (' + pass + ' assertions)');
console.log('>>> test-195-canon-7-kind-floor.cjs: PASSED');
