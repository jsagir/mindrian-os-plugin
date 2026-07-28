#!/usr/bin/env node
'use strict';

/*
 * Phase 243 (GLYPH-01) -- the honest voice-glyph fixture suite + mutation gate.
 * ===========================================================================
 * Block 1 (15 rows): every one of the 5 De Stijl glyphs renders through all 3
 * input shapes (voice_glyph, voice_color, voice_move). This proves the READ
 * path (resolveVoiceGlyph) was never the defect (RESEARCH.md Pitfall 5).
 *
 * Block 2 (3 rows, the mutation-gate rows): the HONEST EMPTY state. A turn
 * with no natural voice signal renders NO glyph, even with an active stance
 * (redteam/tell-act). Restoring the deleted stanceDefaultGlyph branch in
 * lib/statusline/cockpit-renderer.cjs turns exactly rows 2b/2c red -- row 2a
 * (no stance at all) stays green under that mutation because the fabrication
 * only fires when stance_forced_color is set.
 *
 * Never hard-code a glyph literal -- every glyph is resolved via
 * voiceMark.glyphForColor / voiceMark.COLOR_GLYPHS / voiceMark.VOICE_COLOR_MARKS
 * so a re-pointed palette would be caught, not silently missed.
 *
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const renderer = require(path.join(REPO, 'lib', 'statusline', 'cockpit-renderer.cjs'));
const voiceMark = require(path.join(REPO, 'lib', 'hmi', 'voice-color-mark.cjs'));

console.log('test-243-voice-glyph-honest (Phase 243, GLYPH-01)');

let pass = 0;
let fail = 0;
function row(desc, fn) {
  try {
    fn();
    pass += 1;
    console.log('  ok   (' + desc + ')');
  } catch (e) {
    fail += 1;
    if (e && (e.code === 'ERR_ASSERTION' || e.name === 'AssertionError')) {
      console.error('  RED  (' + desc + '): ' + e.message);
    } else {
      console.error('  ERROR(' + desc + '): harness error, NOT an assertion failure: ' + (e && e.stack ? e.stack : e));
    }
  }
}

// A fresh base state every call so Object.assign mutation in one row cannot
// leak into the next.
function base() {
  return { who: 'larry', room: 'Demo', ctx_pct: 10, next_move: 'x' };
}

// ---------------------------------------------------------------------------
// Block 1 -- the vocabulary, 15 rows: 5 De Stijl glyphs x 3 input shapes.
// ---------------------------------------------------------------------------
for (const [move, color] of Object.entries(voiceMark.VOICE_COLOR_MARKS)) {
  const glyph = voiceMark.glyphForColor(color);
  const shapes = [
    { voice_glyph: glyph },
    { voice_color: color },
    { voice_move: move },
  ];
  for (const shape of shapes) {
    const shapeKey = Object.keys(shape)[0];
    row(move + ' (' + color + ') via ' + shapeKey + ' renders ' + glyph, function () {
      const line = renderer.renderCockpit(Object.assign(base(), shape));
      assert.ok(line.includes(glyph),
        move + ' via ' + shapeKey + ' must render ' + glyph + ' (got: ' + line + ')');
    });
  }
}

// ---------------------------------------------------------------------------
// Block 2 -- the honest empty state, 3 rows. THESE ARE THE MUTATION-GATE ROWS.
// ---------------------------------------------------------------------------

// Row 2a: no voice field, no stance at all -- the plain honest-empty floor.
row('2a: no voice mark, no stance -> NO glyph renders', function () {
  const line = renderer.renderCockpit(base());
  for (const g of Object.values(voiceMark.COLOR_GLYPHS)) {
    assert.ok(!line.includes(g),
      'no voice mark and no stance must render NO De Stijl glyph (got: ' + line + ')');
  }
});

// Row 2b: redteam stance active, no natural signal -- the fabrication site.
row('2b: redteam stance, no natural voice mark -> NO glyph fabricated; [redteam] chip stays', function () {
  const line = renderer.renderCockpit(Object.assign(base(), { stance: 'redteam', stance_forced_color: 'red' }));
  for (const g of Object.values(voiceMark.COLOR_GLYPHS)) {
    assert.ok(!line.includes(g),
      'GLYPH-01: redteam with no natural voice mark must render NO glyph (got: ' + line + ')');
  }
  assert.ok(line.includes('[redteam]'),
    'the [redteam] chip must still render -- it is a different segment, not the defect (got: ' + line + ')');
});

// Row 2c: tell-act stance active, no natural signal -- the fabrication site.
row('2c: tell-act stance, no natural voice mark -> NO glyph fabricated; [tell-act] chip stays', function () {
  const line = renderer.renderCockpit(Object.assign(base(), { stance: 'tell-act', stance_forced_color: 'blue' }));
  for (const g of Object.values(voiceMark.COLOR_GLYPHS)) {
    assert.ok(!line.includes(g),
      'GLYPH-01: tell-act with no natural voice mark must render NO glyph (got: ' + line + ')');
  }
  assert.ok(line.includes('[tell-act]'),
    'the [tell-act] chip must still render -- it is a different segment, not the defect (got: ' + line + ')');
});

console.log('\ntest-243-voice-glyph-honest: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail > 0 ? 1 : 0);
