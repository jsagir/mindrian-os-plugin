#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 95.1-02 -- RED skeleton for /mos:doctor self-retrofit verification
 * (the doctor command itself complies with skills/ui-system/SKILL.md).
 *
 * Covers: DOCTOR-95.1-06.
 *
 * Behavior asserted (Wave 1 Plan 95.1-08 will retrofit
 * commands/doctor.md + scripts/doctor.cjs renderHumanReport):
 *   1. commands/doctor.md frontmatter contains
 *      `body_shape: E (Action Report)` (exact string match)
 *   2. scripts/doctor.cjs source code contains zero matches for the regex
 *      [╭╮╰╯┌┐└┘│─━]
 *      (box-drawing chars) AND zero matches for `✗` (cross-mark)
 *   3. scripts/doctor.cjs renderHumanReport source contains the literal
 *      string '-- MindrianOS -- doctor' (Zone 1 header)
 *   4. scripts/doctor.cjs renderHumanReport source contains '▶ /mos:'
 *      (Zone 4 action footer primary action glyph)
 *
 * Note: this is a SOURCE-CODE scan, not a runtime test; uses fs.readFileSync
 * + regex against committed files. Some scenarios may pass today (file
 * existence) but the renderer-string-match scenarios will FAIL until the
 * Wave 1 retrofit lands.
 *
 * IIFE harness pattern from tests/test-cascade-side-channel.cjs.
 * Registered in lib/memory/run-feynman-tests.cjs.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const DOCTOR_MD = path.join(REPO, 'commands', 'doctor.md');
const DOCTOR_CJS = path.join(REPO, 'scripts', 'doctor.cjs');

// Box-drawing chars per skills/ui-system/SKILL.md §3 anti-list:
// U+256D, U+256E, U+2570, U+256F, U+250C, U+2510, U+2514, U+2518,
// U+2502, U+2500, U+2501.
const BOX_CHAR_RE = /[╭╮╰╯┌┐└┘│─━]/;
// Cross-mark not in 12-glyph vocabulary.
const CROSS_MARK_RE = /✗/;

let passed = 0;
let failed = 0;

function ok(name) {
  passed += 1;
  process.stdout.write('  ok ' + name + '\n');
}

function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) {
    process.stdout.write('    ' + (err.message || String(err)) + '\n');
  }
}

// ---------- Helpers ----------

function readSafe(p) {
  return fs.readFileSync(p, 'utf8');
}

// ---------- Scenarios ----------

(function test1_doctorMdBodyShapeFrontmatter() {
  // RED: asserts commands/doctor.md frontmatter retrofit which Wave 1 Plan 95.1-08 will implement
  const label = 'doctor self: commands/doctor.md frontmatter has body_shape: E (Action Report)';
  try {
    assert.equal(fs.existsSync(DOCTOR_MD), true,
      label + ': commands/doctor.md must exist at ' + DOCTOR_MD);
    const md = readSafe(DOCTOR_MD);
    // Frontmatter sits between the first two --- fences. We do a literal
    // string scan because the canonical form per CONTEXT D-10 is the
    // exact phrase 'body_shape: E (Action Report)' (matches 31+ shipped
    // commands incl. heal.md and act.md per 95.1-RESEARCH.md Pitfall 6).
    assert.equal(md.indexOf('body_shape: E (Action Report)') !== -1, true,
      label + ': commands/doctor.md frontmatter must contain literal "body_shape: E (Action Report)"');
    ok(label);
  } catch (e) {
    fail(label, e);
  }
})();

(function test2_doctorCjsNoBoxCharsNoCrossMark() {
  // RED: asserts scripts/doctor.cjs glyph cleanup which Wave 1 Plan 95.1-08 will implement
  const label = 'doctor self: scripts/doctor.cjs has zero box-chars + zero cross-marks';
  try {
    assert.equal(fs.existsSync(DOCTOR_CJS), true,
      label + ': scripts/doctor.cjs must exist at ' + DOCTOR_CJS);
    const src = readSafe(DOCTOR_CJS);
    const boxMatch = src.match(BOX_CHAR_RE);
    if (boxMatch) {
      throw new Error(label + ': scripts/doctor.cjs contains box-drawing char ' +
        JSON.stringify(boxMatch[0]) + ' at index ' + boxMatch.index +
        '. Per SKILL.md §3, alignment IS the punctuation; remove all box chars.');
    }
    const crossMatch = src.match(CROSS_MARK_RE);
    if (crossMatch) {
      throw new Error(label + ': scripts/doctor.cjs contains cross-mark U+2717 at index ' +
        crossMatch.index + '. Cross-mark is NOT in the 12-glyph vocabulary; ' +
        'use U+26A0 (warning) or U+2B1C (gap) instead.');
    }
    ok(label);
  } catch (e) {
    fail(label, e);
  }
})();

(function test3_doctorCjsZone1Header() {
  // RED: asserts scripts/doctor.cjs Zone 1 header retrofit which Wave 1 Plan 95.1-08 will implement
  const label = 'doctor self: scripts/doctor.cjs renderHumanReport carries Zone 1 header';
  try {
    const src = readSafe(DOCTOR_CJS);
    // The Zone 1 header per CONTEXT D-12 is the literal substring
    // '-- MindrianOS -- doctor' (the {stage} suffix may vary at runtime;
    // we match the prefix only).
    assert.equal(src.indexOf('-- MindrianOS -- doctor') !== -1, true,
      label + ': scripts/doctor.cjs must contain the Zone 1 header prefix ' +
        '"-- MindrianOS -- doctor" (literal string)');
    ok(label);
  } catch (e) {
    fail(label, e);
  }
})();

(function test4_doctorCjsZone4ActionFooter() {
  // RED: asserts scripts/doctor.cjs Zone 4 action footer retrofit which Wave 1 Plan 95.1-08 will implement
  const label = 'doctor self: scripts/doctor.cjs renderHumanReport carries Zone 4 action glyph';
  try {
    const src = readSafe(DOCTOR_CJS);
    // The Zone 4 action footer per CONTEXT D-12 leads with the primary-
    // action glyph U+25B6 (BLACK RIGHT-POINTING TRIANGLE) followed by
    // ' /mos:'. We scan for that combination.
    assert.equal(src.indexOf('▶ /mos:') !== -1, true,
      label + ': scripts/doctor.cjs must contain the Zone 4 action footer ' +
        'primary action pattern "▶ /mos:" (U+25B6 + space + /mos:)');
    ok(label);
  } catch (e) {
    fail(label, e);
  }
})();

// ---------- Report ----------

process.stdout.write('\n');
process.stdout.write(
  'doctor self-compliance (UI Ruling System): ' + passed + ' passed, ' + failed + ' failed\n'
);
process.exit(failed === 0 ? 0 : 1);
