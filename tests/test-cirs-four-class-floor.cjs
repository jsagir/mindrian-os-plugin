'use strict';
/*
 * Phase 172-13 - the CIRS four-class FLOOR test (Task 4, Canon Part 11 R1
 * four-class amendment, navigator-LOCKED 2026-06-23).
 *
 * The canonical FLOOR test for the four governed surface classes (mechanical /
 * framework / intelligence / pipeline) + the utility-excluded slot. Mirrors the
 * frozen-set FLOOR idiom of the edge-vocabulary floor tests (entries 18/21/22/23):
 * membership + the full FLOOR preserved + one-class-per-surface + the byte-stable
 * wired/excluded/gap counting contract. NEVER asserts a `.size` / total class
 * count (so a future ADDITIVE class member never false-fails this floor).
 *
 *   Test 1: the four governance classes are all members of the class enum.
 *   Test 2: the utility-excluded slot is present + distinct from the four.
 *   Test 3: every surface in the coverage ledger carries EXACTLY ONE class, and
 *           that class is a member of the enum.
 *   Test 4: the wired/excluded/gap counting contract is UNCHANGED by the class
 *           field (counts === a class-blind recount; class is purely additive).
 *   Test 5: an EXCLUDED surface always carries the utility-excluded class; a
 *           wired/gap surface NEVER does (the slot is exclusive to excluded).
 *
 * House rule: hyphens only, no em-dashes. Canon Part 8: zero Brain / network.
 */

const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const REPO_ROOT = path.resolve(__dirname, '..');
const gen = require(path.join(REPO_ROOT, 'scripts', 'build-connector-registry.cjs'));
const LEDGER_PATH = path.join(REPO_ROOT, 'data', 'connector-coverage-ledger.json');

const FOUR = ['mechanical', 'framework', 'intelligence', 'pipeline'];

let pass = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ok - ' + name); pass++; }

// ---------------------------------------------------------------------------
// Test 1: the four governance classes are all members of the enum (FLOOR).
// ---------------------------------------------------------------------------
ok('FOUR_CLASSES export exists + is an array', Array.isArray(gen.FOUR_CLASSES));
for (const c of FOUR) {
  ok('class "' + c + '" is in FOUR_CLASSES', gen.FOUR_CLASSES.indexOf(c) !== -1);
  ok('class "' + c + '" is in SURFACE_CLASS_ENUM', gen.SURFACE_CLASS_ENUM.indexOf(c) !== -1);
}

// ---------------------------------------------------------------------------
// Test 2: the utility-excluded slot is present + distinct from the four.
// ---------------------------------------------------------------------------
ok('CLASS_UTILITY_EXCLUDED export === "utility-excluded"', gen.CLASS_UTILITY_EXCLUDED === 'utility-excluded');
ok('utility-excluded is in SURFACE_CLASS_ENUM', gen.SURFACE_CLASS_ENUM.indexOf('utility-excluded') !== -1);
ok('utility-excluded is NOT one of the four governance classes', gen.FOUR_CLASSES.indexOf('utility-excluded') === -1);

// ---------------------------------------------------------------------------
// Test 3: every ledger surface carries EXACTLY ONE class, a member of the enum.
// ---------------------------------------------------------------------------
const ledger = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
ok('ledger has a surfaces array', Array.isArray(ledger.surfaces));
let allClassed = true;
let allInEnum = true;
for (const s of ledger.surfaces) {
  if (typeof s.class !== 'string' || !s.class) allClassed = false;
  else if (gen.SURFACE_CLASS_ENUM.indexOf(s.class) === -1) allInEnum = false;
}
ok('every ledger surface carries exactly one class string', allClassed);
ok('every ledger surface class is a member of SURFACE_CLASS_ENUM', allInEnum);

// ---------------------------------------------------------------------------
// Test 4: the wired/excluded/gap counting contract is UNCHANGED by the class
// field. Recompute the counts class-blind and assert byte-equality with the
// ledger counts. The class is purely additive metadata; it moves no count.
// ---------------------------------------------------------------------------
const report = gen.coverageReport();
ok('coverageReport counts match the ledger counts (wired)', report.counts.wired === ledger.counts.wired);
ok('coverageReport counts match the ledger counts (excluded)', report.counts.excluded === ledger.counts.excluded);
ok('coverageReport counts match the ledger counts (gap)', report.counts.gap === ledger.counts.gap);

// Class-blind recount from the ledger surfaces (state field only) MUST equal counts.
const recount = { wired: 0, excluded: 0, gap: 0 };
for (const s of ledger.surfaces) { if (recount[s.state] !== undefined) recount[s.state] += 1; }
ok('class-blind state recount === ledger counts (wired)', recount.wired === ledger.counts.wired);
ok('class-blind state recount === ledger counts (excluded)', recount.excluded === ledger.counts.excluded);
ok('class-blind state recount === ledger counts (gap)', recount.gap === ledger.counts.gap);
ok('surfaces.length === wired + excluded + gap (XOR partition)',
  ledger.surfaces.length === (ledger.counts.wired + ledger.counts.excluded + ledger.counts.gap));

// ---------------------------------------------------------------------------
// Test 5: the utility-excluded slot is EXCLUSIVE to excluded surfaces.
// ---------------------------------------------------------------------------
let exclusiveOk = true;
for (const s of ledger.surfaces) {
  if (s.state === 'excluded' && s.class !== 'utility-excluded') exclusiveOk = false;
  if (s.state !== 'excluded' && s.class === 'utility-excluded') exclusiveOk = false;
}
ok('excluded <=> utility-excluded (the slot is exclusive to excluded surfaces)', exclusiveOk);

console.log('');
console.log('PASS ' + pass + ' assertions');
console.log('>>> test-cirs-four-class-floor.cjs: PASSED');
