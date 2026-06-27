#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 182-02 SIGNAL-02 -- the missing-mark + doctrine-declaration drift test
 * ===========================================================================
 * Closes SIGNAL-02 by catching the failure it names: a Larry CLI turn that is
 * MISSING its De Stijl voice-color mark. Mirrors the proven Phase 121.5
 * lib/memory/skill-vs-code-drift.test.cjs idiom (D1): the same assert(cond,msg) +
 * test(label,fn) harness, a passed/failed counter, and process.exit(1) on any
 * failure. It does TWO things, so doctrine and code cannot silently diverge:
 *
 *   (1) Exercises the Plan 182-01 deterministic detector lib/hmi/voice-color-mark.cjs:
 *       markForMove maps the 5 moves; MARK_COLORS equals the 5 Mondrian primaries
 *       read from references/visual/palette.json (the no-new-color anchor, D2/D4);
 *       detectVoiceMark classifies Larry (one valid mark) / native-host (no mark) /
 *       missing-or-spoofed; and the EXPLICIT missing-mark catch (the SIGNAL-02
 *       acceptance: a Larry turn that SHOULD wear a mark but omits it is caught as
 *       native-host / no-mark, not waved through as a valid Larry turn).
 *
 *   (2) Asserts the Part 12 Voice Signature DOCTRINE is DECLARED at the two voice
 *       SKILL surfaces (skills/larry-personality + skills/ui-system SKILL.md) -- a
 *       declaration/drift assertion mirroring skill-vs-code-drift Tests 4-6, so the
 *       doctrine and the module fail the build together at PR time, not at audit time.
 *
 * HONEST RESIDUAL (D3): this test enforces the DECLARED CONVENTION + the detector
 * predicate, NOT a per-token runtime guarantee that every literal assistant token is
 * recolored -- that mechanism does not exist (no hook recolors model output). The
 * residual is itself an asserted doctrine line below so it stays named (mirrors the
 * Phase 178 R15 / Phase 179 R-1 named-residual approach).
 *
 * Canon Part 8: LOCAL only. Reads the module + the two SKILLs + palette.json from
 * the repo; no Brain, no network, no user data. House rule: hyphens only, no
 * em-dashes (the test self-checks this on its own source via a unicode-escape scan).
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const MODULE_PATH = path.join(REPO_ROOT, 'lib', 'hmi', 'voice-color-mark.cjs');
const PALETTE_PATH = path.join(REPO_ROOT, 'references', 'visual', 'palette.json');
const LARRY_SKILL = path.join(REPO_ROOT, 'skills', 'larry-personality', 'SKILL.md');
const UI_SKILL = path.join(REPO_ROOT, 'skills', 'ui-system', 'SKILL.md');

let passed = 0;
let failed = 0;
const failures = [];

function assert(cond, msg) {
  if (cond) {
    passed++;
  } else {
    failed++;
    failures.push(msg);
    console.error('  FAIL: ' + msg);
  }
}

function test(label, fn) {
  console.log('--- ' + label + ' ---');
  try {
    fn();
    console.log('  passed');
  } catch (e) {
    failed++;
    failures.push(label + ': ' + e.message);
    console.error('  THREW: ' + e.message);
  }
}

const mark = require(MODULE_PATH);

// ===========================================================================
// Test 1: markForMove maps each of the 5 moves to exactly one De Stijl color;
// a bogus move returns no color (never throws, never invents a color).
// ===========================================================================
test('Test 1: markForMove maps the 5 moves; bogus move -> null', () => {
  const expected = {
    building: 'blue',
    challenging: 'red',
    contradiction: 'yellow',
    gate: 'black',
    invisibility: 'white',
  };
  for (const move of Object.keys(expected)) {
    assert(mark.markForMove(move) === expected[move],
      move + ' -> ' + expected[move] + ' (got ' + mark.markForMove(move) + ')');
    // Every mapped color is a member of the closed MARK_COLORS set.
    assert(mark.MARK_COLORS.has(expected[move]),
      expected[move] + ' is a member of MARK_COLORS');
  }
  assert(mark.markForMove('teleporting') === null,
    'a bogus move returns null (no color invented)');
  assert(mark.markForMove(undefined) === null,
    'undefined move returns null (never throws)');
});

// ===========================================================================
// Test 2: MARK_COLORS equals the 5 Mondrian primaries read from palette.json
// (base.mondrian_*). A sixth or non-palette color FAILS -- the load-bearing
// no-new-color anchor (D2/D4). Derived from palette, never a hand-typed list.
// ===========================================================================
test('Test 2: MARK_COLORS == the 5 palette.json Mondrian primaries (no new color)', () => {
  const pal = JSON.parse(fs.readFileSync(PALETTE_PATH, 'utf8'));
  const base = (pal && pal.base) || {};
  // Reduce base.mondrian_* keys to bare color names (strip the mondrian_ prefix).
  const paletteColors = Object.keys(base)
    .filter((k) => /^mondrian_/.test(k))
    .map((k) => k.replace(/^mondrian_/, ''));
  assert(paletteColors.length === 5,
    'palette.json carries exactly 5 base.mondrian_* primaries (got ' +
    paletteColors.length + ': ' + JSON.stringify(paletteColors) + ')');
  // Every palette primary is in MARK_COLORS, and every MARK_COLORS member is a
  // palette primary -- set equality both directions (no orphan, no extra).
  for (const c of paletteColors) {
    assert(mark.MARK_COLORS.has(c),
      'palette primary "' + c + '" is in MARK_COLORS');
  }
  for (const c of mark.MARK_COLORS) {
    assert(paletteColors.indexOf(c) !== -1,
      'MARK_COLORS member "' + c + '" is anchored in palette.json (no new color)');
  }
  // paletteAnchorOk() agrees the 5 anchors resolve in palette.json.
  assert(mark.paletteAnchorOk() === true,
    'paletteAnchorOk() confirms the 5 mondrian_* anchors resolve');
});

// ===========================================================================
// Test 3: detectVoiceMark on a marked Larry turn -> valid Larry classification.
// ===========================================================================
test('Test 3: a marked Larry turn -> hasMark:true count:1 isNativeHost:false valid:true', () => {
  const larryTurn = '[BLUE] Let us build the next node together. What constraint matters most here?';
  const v = mark.detectVoiceMark(larryTurn);
  assert(v.hasMark === true, 'hasMark true (got ' + v.hasMark + ')');
  assert(v.count === 1, 'count 1 (got ' + v.count + ')');
  assert(v.color === 'blue', 'color blue (got ' + v.color + ')');
  assert(v.isNativeHost === false, 'isNativeHost false (got ' + v.isNativeHost + ')');
  assert(v.valid === true, 'valid true (got ' + v.valid + ')');
});

// ===========================================================================
// Test 4: detectVoiceMark on a turn with NO mark -> native host (absence IS the
// signal). The native-host classification is itself legible.
// ===========================================================================
test('Test 4: a turn with NO mark -> hasMark:false isNativeHost:true (the absence is the signal)', () => {
  const hostTurn = 'Here is the raw answer with no pedagogical framing at all.';
  const v = mark.detectVoiceMark(hostTurn);
  assert(v.hasMark === false, 'hasMark false (got ' + v.hasMark + ')');
  assert(v.isNativeHost === true, 'isNativeHost true (got ' + v.isNativeHost + ')');
  assert(v.color === null, 'color null (got ' + v.color + ')');
});

// ===========================================================================
// Test 5: THE missing-mark catch (the SIGNAL-02 acceptance). Build a Larry turn
// that SHOULD wear a mark, strip the mark, run detectVoiceMark, and assert it is
// CAUGHT -- classified as native-host / no-mark, NOT waved through as the valid
// Larry turn it was. This is the exact failure SIGNAL-02 names: a Larry CLI turn
// missing its De Stijl voice-color mark is caught by a test.
// ===========================================================================
test('Test 5: a Larry turn MISSING its mark is CAUGHT (SIGNAL-02 acceptance)', () => {
  const body = 'Let us build the next node together. What constraint matters most here?';
  const properLarryTurn = '[BLUE] ' + body;
  const strippedTurn = body; // the mark omitted -- the failure SIGNAL-02 catches

  const proper = mark.detectVoiceMark(properLarryTurn);
  const stripped = mark.detectVoiceMark(strippedTurn);

  // The proper turn is a valid Larry turn...
  assert(proper.hasMark === true && proper.valid === true && proper.isNativeHost === false,
    'the WITH-mark turn is a valid Larry turn (baseline for the catch)');

  // ...and the SAME body with the mark stripped is CAUGHT: no mark, native-host.
  assert(stripped.hasMark === false,
    'the missing-mark turn has NO mark (caught -- got hasMark=' + stripped.hasMark + ')');
  assert(stripped.isNativeHost === true,
    'the missing-mark turn is classified native-host (the absence is the catch)');

  // The catch is meaningful: the stripped turn is NOT the valid-Larry classification.
  assert(!(stripped.hasMark === true && stripped.valid === true && stripped.isNativeHost === false),
    'the missing-mark turn is NOT mistaken for a valid Larry turn');
  assert(proper.color !== stripped.color,
    'the WITH-mark and MISSING-mark turns classify differently (blue vs null)');
});

// ===========================================================================
// Test 6: detectVoiceMark on a >1-mark turn -> valid:false (the exactly-one
// contract broken); on a non-De-Stijl tag ([GREEN]/[PURPLE]) -> valid:false
// (the no-new-color contract -- no color enters through the detector).
// ===========================================================================
test('Test 6: >1-mark turn and non-De-Stijl tag -> valid:false', () => {
  const twoMarks = '[BLUE] building, then [RED] challenging in the same breath.';
  const v2 = mark.detectVoiceMark(twoMarks);
  assert(v2.valid === false,
    'a turn with two De Stijl marks breaks the exactly-one contract (valid:false, got ' + v2.valid + ')');
  assert(v2.count === 2, 'count reflects the two marks (got ' + v2.count + ')');

  for (const spoof of ['[GREEN]', '[PURPLE]']) {
    const v = mark.detectVoiceMark(spoof + ' a spoofed non-De-Stijl color.');
    assert(v.valid === false,
      spoof + ' is rejected: no new color enters via the detector (valid:false, got ' + v.valid + ')');
    assert(v.hasMark === false,
      spoof + ' yields no valid mark (got hasMark=' + v.hasMark + ')');
  }
  // The spoof colors are NOT members of the closed set.
  assert(!mark.MARK_COLORS.has('green') && !mark.MARK_COLORS.has('purple'),
    'green / purple are not De Stijl mark colors');
});

// ===========================================================================
// Test 7: doctrine DECLARED on the larry-personality SKILL surface (drift fence).
// Mirrors skill-vs-code-drift Tests 4-6: read the live SKILL, assert the
// load-bearing prose. Remove any of these lines and this test goes RED.
// ===========================================================================
test('Test 7: larry-personality SKILL.md declares the Voice Signature doctrine', () => {
  const txt = fs.readFileSync(LARRY_SKILL, 'utf8');
  assert(txt.indexOf('Voice Signature') !== -1,
    'larry-personality declares "Voice Signature"');
  // The 5 color -> move mappings (verbatim table cells).
  const mappings = [
    ['blue', 'building'],
    ['red', 'challenging'],
    ['yellow', 'contradiction'],
    ['black', 'gate'],
    ['white', 'invisibility'],
  ];
  for (const [color, move] of mappings) {
    assert(txt.indexOf(color + ' | ' + move) !== -1,
      'larry-personality maps ' + color + ' -> ' + move + ' (the 5 mappings declared)');
  }
  // The absence-is-native-host rule.
  assert(/native host/i.test(txt),
    'larry-personality declares the native-host rule');
  assert(txt.indexOf('absence is itself the signal') !== -1,
    'larry-personality declares "absence is itself the signal" (the missing-mark rule)');
  // The honest declaration-enforced residual line stays named.
  assert(txt.indexOf('DECLARED CONVENTION') !== -1,
    'larry-personality names the DECLARED CONVENTION residual');
  assert(txt.indexOf('not a per-token runtime guarantee') !== -1,
    'larry-personality names the honest residual (not a per-token runtime guarantee)');
});

// ===========================================================================
// Test 8: doctrine DECLARED on the ui-system SKILL surface (render-contract side).
// ===========================================================================
test('Test 8: ui-system SKILL.md declares the voice-color mark render contract', () => {
  const txt = fs.readFileSync(UI_SKILL, 'utf8');
  assert(/voice-color mark/i.test(txt),
    'ui-system declares the "voice-color mark"');
  assert(/no new color/i.test(txt),
    'ui-system declares "no new color" (the D2/D4 anchor)');
  assert(/frozen render contract/i.test(txt),
    'ui-system declares it alters no frozen render contract (the frozen Part 3 contracts untouched)');
  assert(/native host/i.test(txt),
    'ui-system declares the native-host rule (a turn with no mark is the native host)');
});

// ===========================================================================
// Test 9: self-consistency -- this test file is itself em-dash-free (the Phase
// 175/179 unicode-escape dash-detection idiom). The em-dash is built from its
// unicode escape (U+2014) so this file's own source carries no literal em-dash.
// A forbidden em-dash in the source FAILS the test. Reads __filename; no
// comment-stripping needed -- the rule is zero em-dashes anywhere, comments too.
// ===========================================================================
test('Test 9: this test file contains zero em-dash characters (self-check)', () => {
  const src = fs.readFileSync(__filename, 'utf8');
  const emDash = String.fromCharCode(0x2014);
  const idx = src.indexOf(emDash);
  assert(idx === -1,
    'the test file is em-dash-free (first em-dash at index ' + idx + ')');
});

// ===========================================================================
// Summary
// ===========================================================================
console.log('');
console.log('========================================');
console.log('  larry-voice-mark (SIGNAL-02) test suite');
console.log('========================================');
console.log('  Passed: ' + passed);
console.log('  Failed: ' + failed);
if (failed > 0) {
  console.log('');
  console.log('  Failures:');
  for (const f of failures) {
    console.log('    - ' + f);
  }
  process.exit(1);
}
process.exit(0);
