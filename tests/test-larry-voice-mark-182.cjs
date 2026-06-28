#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 182-02 / 182.1-04 SIGNAL-02 -- the missing-mark + glyph + doctrine-declaration drift test
 * ===============================================================================================
 * Closes SIGNAL-02 by catching the failure it names: a Larry CLI turn that is
 * MISSING its De Stijl voice-color mark. Phase 182.1 moved the PRIMARY mark from
 * a bracketed color-word ([BLUE]) to a colored emoji SQUARE, because the host
 * strips ANSI (and a bracketed word is a WORD, not color) -- so this test now
 * asserts GLYPH detection as primary, keeps the bracketed word working as an
 * additive secondary form, and verifies a non-De-Stijl glyph/word is rejected.
 *
 * Mirrors the proven Phase 121.5 lib/memory/skill-vs-code-drift.test.cjs idiom:
 * the same assert(cond,msg) + test(label,fn) harness, a passed/failed counter,
 * and process.exit(1) on any failure. It does TWO things, so doctrine and code
 * cannot silently diverge:
 *
 *   (1) Exercises the deterministic detector lib/hmi/voice-color-mark.cjs:
 *       markForMove maps the 5 moves; glyphForMove / glyphForColor map to the 5
 *       emoji squares; MARK_COLORS equals the 5 Mondrian primaries read from
 *       references/visual/palette.json (the no-new-color anchor, D2/D4);
 *       detectVoiceMark classifies Larry (one valid glyph) / native-host (no
 *       mark) / missing-or-spoofed; and the EXPLICIT missing-mark catch.
 *
 *   (2) Asserts the Part 12 Voice Signature DOCTRINE is DECLARED at the two voice
 *       SKILL surfaces (skills/larry-personality + skills/ui-system SKILL.md) in
 *       its emoji-glyph form -- a declaration/drift assertion so the doctrine and
 *       the module fail the build together at PR time, not at audit time.
 *
 * HONEST RESIDUAL (D3): this test enforces the DECLARED CONVENTION + the detector
 * predicate, NOT a per-token runtime guarantee that every literal assistant token
 * is recolored. The residual is itself an asserted doctrine line below so it stays
 * named (mirrors Phase 178 R15 / Phase 179 R-1).
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

// The 5 De Stijl Mondrian primaries as emoji squares (built from code points so
// this source is auditable and astral-safe; literal emoji would work too).
const GLYPH = {
  blue: String.fromCodePoint(0x1F7E6),
  red: String.fromCodePoint(0x1F7E5),
  yellow: String.fromCodePoint(0x1F7E8),
  black: String.fromCodePoint(0x2B1B),
  white: String.fromCodePoint(0x2B1C),
};
// Non-De-Stijl colored glyphs (the green square / green circle spoofs).
const GREEN_SQUARE = String.fromCodePoint(0x1F7E9);
const GREEN_CIRCLE = String.fromCodePoint(0x1F7E2);

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
// glyphForMove / glyphForColor map to the matching emoji square; a bogus input
// returns null (never throws, never invents a color or glyph).
// ===========================================================================
test('Test 1: markForMove + glyphForMove + glyphForColor map the 5 moves; bogus -> null', () => {
  const expected = {
    building: 'blue',
    challenging: 'red',
    contradiction: 'yellow',
    gate: 'black',
    invisibility: 'white',
  };
  for (const move of Object.keys(expected)) {
    const color = expected[move];
    assert(mark.markForMove(move) === color,
      move + ' -> ' + color + ' (got ' + mark.markForMove(move) + ')');
    assert(mark.MARK_COLORS.has(color), color + ' is a member of MARK_COLORS');
    // glyphForColor and glyphForMove agree and return the De Stijl square.
    assert(mark.glyphForColor(color) === GLYPH[color],
      'glyphForColor(' + color + ') is the matching emoji square');
    assert(mark.glyphForMove(move) === GLYPH[color],
      'glyphForMove(' + move + ') is the matching emoji square');
  }
  assert(mark.markForMove('teleporting') === null,
    'a bogus move returns null (no color invented)');
  assert(mark.markForMove(undefined) === null,
    'undefined move returns null (never throws)');
  assert(mark.glyphForColor('green') === null,
    'a non-De-Stijl color returns no glyph (no glyph invented)');
});

// ===========================================================================
// Test 2: MARK_COLORS equals the 5 Mondrian primaries read from palette.json
// (base.mondrian_*); MARK_GLYPHS is the frozen 5-member glyph set keyed on the
// same 5 colors. A sixth/non-palette color FAILS -- the no-new-color anchor.
// ===========================================================================
test('Test 2: MARK_COLORS + MARK_GLYPHS == the 5 palette.json primaries (no new color)', () => {
  const pal = JSON.parse(fs.readFileSync(PALETTE_PATH, 'utf8'));
  const base = (pal && pal.base) || {};
  const paletteColors = Object.keys(base)
    .filter((k) => /^mondrian_/.test(k))
    .map((k) => k.replace(/^mondrian_/, ''));
  assert(paletteColors.length === 5,
    'palette.json carries exactly 5 base.mondrian_* primaries (got ' +
    paletteColors.length + ': ' + JSON.stringify(paletteColors) + ')');
  for (const c of paletteColors) {
    assert(mark.MARK_COLORS.has(c), 'palette primary "' + c + '" is in MARK_COLORS');
  }
  for (const c of mark.MARK_COLORS) {
    assert(paletteColors.indexOf(c) !== -1,
      'MARK_COLORS member "' + c + '" is anchored in palette.json (no new color)');
  }
  // MARK_GLYPHS is a 5-member map; its values are exactly the 5 colors.
  const glyphColors = Object.values(mark.MARK_GLYPHS).sort();
  assert(glyphColors.length === 5, 'MARK_GLYPHS has exactly 5 members');
  assert(JSON.stringify(glyphColors) ===
    JSON.stringify(['black', 'blue', 'red', 'white', 'yellow']),
    'MARK_GLYPHS values are the 5 De Stijl colors (no sixth)');
  assert(mark.paletteAnchorOk() === true,
    'paletteAnchorOk() confirms the 5 mondrian_* anchors resolve');
});

// ===========================================================================
// Test 3: each of the 5 emoji squares opening a turn -> the right color, valid
// Larry classification. This is the Phase 182.1 PRIMARY-mark assertion.
// ===========================================================================
test('Test 3: each De Stijl emoji square -> right color, valid Larry turn', () => {
  const cases = [
    [GLYPH.blue, 'blue'],
    [GLYPH.red, 'red'],
    [GLYPH.yellow, 'yellow'],
    [GLYPH.black, 'black'],
    [GLYPH.white, 'white'],
  ];
  for (const [glyph, color] of cases) {
    const v = mark.detectVoiceMark(glyph + ' building the next node with you here.');
    assert(v.hasMark === true, glyph + ' -> hasMark true (got ' + v.hasMark + ')');
    assert(v.count === 1, glyph + ' -> count 1 (got ' + v.count + ')');
    assert(v.color === color, glyph + ' -> color ' + color + ' (got ' + v.color + ')');
    assert(v.isNativeHost === false, glyph + ' -> isNativeHost false');
    assert(v.valid === true, glyph + ' -> valid true (got ' + v.valid + ')');
  }
});

// ===========================================================================
// Test 4: a turn with NO mark -> native host (absence IS the signal).
// ===========================================================================
test('Test 4: a turn with NO mark -> hasMark:false isNativeHost:true (the absence is the signal)', () => {
  const hostTurn = 'Here is the raw answer with no pedagogical framing at all.';
  const v = mark.detectVoiceMark(hostTurn);
  assert(v.hasMark === false, 'hasMark false (got ' + v.hasMark + ')');
  assert(v.isNativeHost === true, 'isNativeHost true (got ' + v.isNativeHost + ')');
  assert(v.color === null, 'color null (got ' + v.color + ')');
});

// ===========================================================================
// Test 5: THE missing-mark catch (the SIGNAL-02 acceptance). A Larry turn that
// SHOULD wear a glyph, with the glyph stripped, is CAUGHT as native-host -- NOT
// waved through as the valid Larry turn it was.
// ===========================================================================
test('Test 5: a Larry turn MISSING its glyph is CAUGHT (SIGNAL-02 acceptance)', () => {
  const body = 'Let us build the next node together. What constraint matters most here?';
  const properLarryTurn = GLYPH.blue + ' ' + body;
  const strippedTurn = body; // the glyph omitted -- the failure SIGNAL-02 catches

  const proper = mark.detectVoiceMark(properLarryTurn);
  const stripped = mark.detectVoiceMark(strippedTurn);

  assert(proper.hasMark === true && proper.valid === true && proper.isNativeHost === false,
    'the WITH-glyph turn is a valid Larry turn (baseline for the catch)');
  assert(proper.color === 'blue', 'the WITH-glyph turn classifies blue');

  assert(stripped.hasMark === false,
    'the missing-mark turn has NO mark (caught -- got hasMark=' + stripped.hasMark + ')');
  assert(stripped.isNativeHost === true,
    'the missing-mark turn is classified native-host (the absence is the catch)');
  assert(!(stripped.hasMark === true && stripped.valid === true && stripped.isNativeHost === false),
    'the missing-mark turn is NOT mistaken for a valid Larry turn');
  assert(proper.color !== stripped.color,
    'the WITH-glyph and MISSING-glyph turns classify differently (blue vs null)');
});

// ===========================================================================
// Test 6: rejection contracts. A non-De-Stijl GLYPH (green square / green
// circle) opening a turn -> rejected (valid:false, not native host); a >1-glyph
// turn -> valid:false (exactly-one broken); a non-De-Stijl WORD ([GREEN]/[PURPLE])
// -> valid:false (the bracketed secondary form still rejects new colors).
// ===========================================================================
test('Test 6: non-De-Stijl glyph, >1 glyph, and non-De-Stijl word -> valid:false', () => {
  for (const spoofGlyph of [GREEN_SQUARE, GREEN_CIRCLE]) {
    const v = mark.detectVoiceMark(spoofGlyph + ' a spoofed non-De-Stijl color block.');
    assert(v.valid === false,
      'a leading non-De-Stijl glyph is rejected (valid:false, got ' + v.valid + ')');
    assert(v.hasMark === false,
      'a leading non-De-Stijl glyph yields no valid mark (got hasMark=' + v.hasMark + ')');
  }
  // Two De Stijl glyphs in one turn breaks the exactly-one contract.
  const twoGlyphs = GLYPH.blue + ' building, then ' + GLYPH.red + ' challenging in one breath.';
  const v2 = mark.detectVoiceMark(twoGlyphs);
  assert(v2.valid === false, 'two De Stijl glyphs break exactly-one (valid:false, got ' + v2.valid + ')');
  assert(v2.count === 2, 'count reflects the two glyphs (got ' + v2.count + ')');
  // The non-De-Stijl word path still rejects (secondary form, no new color).
  for (const spoof of ['[GREEN]', '[PURPLE]']) {
    const v = mark.detectVoiceMark(spoof + ' a spoofed non-De-Stijl color.');
    assert(v.valid === false, spoof + ' is rejected (valid:false, got ' + v.valid + ')');
    assert(v.hasMark === false, spoof + ' yields no valid mark (got hasMark=' + v.hasMark + ')');
  }
  assert(!mark.MARK_COLORS.has('green') && !mark.MARK_COLORS.has('purple'),
    'green / purple are not De Stijl mark colors');
});

// ===========================================================================
// Test 6b: the bracketed color-WORD still classifies as the additive SECONDARY
// form (progressive-enhancement hosts / older fixtures), so the move was a
// delivery change, not a behavior removal.
// ===========================================================================
test('Test 6b: a leading bracketed De Stijl word still classifies (additive secondary)', () => {
  const v = mark.detectVoiceMark('[BLUE] building the next node with you.');
  assert(v.hasMark === true && v.valid === true && v.color === 'blue',
    'the bracketed [BLUE] secondary form still classifies as a valid blue Larry turn');
});

// ===========================================================================
// Test 7: doctrine DECLARED on the larry-personality SKILL surface (drift fence),
// in its Phase 182.1 emoji-glyph form.
// ===========================================================================
test('Test 7: larry-personality SKILL.md declares the emoji-glyph Voice Signature doctrine', () => {
  const txt = fs.readFileSync(LARRY_SKILL, 'utf8');
  assert(txt.indexOf('Voice Signature') !== -1, 'larry-personality declares "Voice Signature"');
  // The 5 color -> move mappings (verbatim table cells, preserved across the glyph rewrite).
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
  // Each of the 5 emoji squares is present in the doctrine (the glyph IS the mark).
  for (const color of Object.keys(GLYPH)) {
    assert(txt.indexOf(GLYPH[color]) !== -1,
      'larry-personality declares the ' + color + ' emoji square glyph');
  }
  // The absence-is-native-host rule + the honest residual stay named.
  assert(/native host/i.test(txt), 'larry-personality declares the native-host rule');
  assert(txt.indexOf('absence is itself the signal') !== -1,
    'larry-personality declares "absence is itself the signal" (the missing-mark rule)');
  assert(/ANSI/.test(txt) && /enhancement/i.test(txt),
    'larry-personality declares ANSI is progressive-enhancement only (the host strips it)');
  assert(txt.indexOf('DECLARED CONVENTION') !== -1,
    'larry-personality names the DECLARED CONVENTION residual');
  assert(txt.indexOf('not a per-token runtime guarantee') !== -1,
    'larry-personality names the honest residual (not a per-token runtime guarantee)');
});

// ===========================================================================
// Test 8: doctrine DECLARED on the ui-system SKILL surface (render-contract side),
// in its Phase 182.1 emoji-glyph form.
// ===========================================================================
test('Test 8: ui-system SKILL.md declares the emoji-glyph voice-color mark render contract', () => {
  const txt = fs.readFileSync(UI_SKILL, 'utf8');
  assert(/voice-color mark/i.test(txt), 'ui-system declares the "voice-color mark"');
  assert(/no new color/i.test(txt), 'ui-system declares "no new color" (the D2/D4 anchor)');
  assert(/frozen render contract/i.test(txt),
    'ui-system declares it alters no frozen render contract (frozen Part 3 contracts untouched)');
  assert(/native host/i.test(txt), 'ui-system declares the native-host rule (no mark = native host)');
  // The emoji squares are present on the render-contract surface too.
  assert(txt.indexOf(GLYPH.blue) !== -1 && txt.indexOf(GLYPH.white) !== -1,
    'ui-system declares the emoji-square glyphs (the glyph carries the color)');
  assert(/ANSI/.test(txt) && /enhancement/i.test(txt),
    'ui-system declares ANSI is progressive-enhancement only');
});

// ===========================================================================
// Test 9: self-consistency -- this test file is itself em-dash-free (the Phase
// 175/179 unicode-escape dash-detection idiom). A forbidden em-dash FAILS.
// ===========================================================================
test('Test 9: this test file contains zero em-dash characters (self-check)', () => {
  const src = fs.readFileSync(__filename, 'utf8');
  const emDash = String.fromCharCode(0x2014);
  const idx = src.indexOf(emDash);
  assert(idx === -1, 'the test file is em-dash-free (first em-dash at index ' + idx + ')');
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
