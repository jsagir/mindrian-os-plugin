'use strict';
// Phase 210-01 (Wave 0, item 210-B) -- the glyph-preference test stub for the
// stance voice-glyph mapping (lib/core/stance-state.cjs) and its statusline
// consumer (lib/statusline/cockpit-renderer.cjs).
//
// Directions encoded:
//   Leg 1 (PRESERVE FLOOR, green now and after): the stance-state mapping itself
//     is untouched capability -- redteam->red and tell-act->blue stay the DEFAULT
//     (recommended) colors; research/ask/null force nothing.
//   Leg 2 (SOFTENED direction, green as of plan 210-03): the renderer treats
//     the stance color as a PREFERENCE, not an override. When natural voice
//     detection yields a confident DIFFERENT color, natural detection wins
//     (the Phase 210 item B precedence at cockpit-renderer.cjs's stance branch).
//   Leg 3 (SUPERSEDED BY PHASE 243): with NO natural voice signal the stance
//     color must NOT render a glyph -- GLYPH-01 removes the stance-default
//     fabrication (Phase 210 item B's second half dies; natural-detection-wins
//     survives as the only rule).
//   Leg 4 (PRESERVE FLOOR, green now and after): a null stance degrades safely --
//     the rendered line is byte-identical to the no-stance state (the
//     cockpit-signals try/catch degrade floor).
//
// House rule: hyphens only, no em-dashes. CJS, node built-ins only.

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const stanceState = require(path.join(REPO, 'lib', 'core', 'stance-state.cjs'));
const renderer = require(path.join(REPO, 'lib', 'statusline', 'cockpit-renderer.cjs'));
const voiceMark = require(path.join(REPO, 'lib', 'hmi', 'voice-color-mark.cjs'));

console.log('test-voice-glyph-advisory (Phase 210 Wave 0)');

let pass = 0;
let fail = 0;
function leg(desc, fn) {
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

const YELLOW_GLYPH = voiceMark.glyphForColor('yellow');
const RED_GLYPH = voiceMark.glyphForColor('red');

// ---------------------------------------------------------------------------
// Leg 1 -- PRESERVE FLOOR: the default stance->color mapping capability stays.
// ---------------------------------------------------------------------------
leg('leg 1 PRESERVE FLOOR: stance-state still maps redteam->red and tell-act->blue as the DEFAULT', function () {
  assert.equal(stanceState.forcedVoiceColorForStance('redteam'), 'red',
    'redteam keeps red as its default/recommended voice color');
  assert.equal(stanceState.forcedVoiceColorForStance('tell-act'), 'blue',
    'tell-act keeps blue as its default/recommended voice color');
  assert.equal(stanceState.forcedVoiceColorForStance('research'), null,
    'research makes no color claim');
  assert.equal(stanceState.forcedVoiceColorForStance('ask'), null,
    'ask makes no color claim');
  assert.equal(stanceState.forcedVoiceColorForStance(null), null,
    'null stance makes no color claim');
});

// ---------------------------------------------------------------------------
// Leg 2 -- SOFTENED direction (EXPECTED RED until plan 210-03): a confident
// natural voice detection (voice_color yellow) must WIN over the stance
// preference (redteam/red). The stance color is a preference, not an override.
// ---------------------------------------------------------------------------
leg('leg 2 SOFTENED: confident natural voice detection wins over the stance preference (RED until plan 210-03)', function () {
  const line = renderer.renderCockpit({
    room: 'test-room',
    next_move: 'map the fork',
    voice_color: 'yellow',
    stance: 'redteam',
    stance_forced_color: 'red',
  });
  assert.equal(line.indexOf(YELLOW_GLYPH) !== -1, true,
    'SOFTENED direction: the confident natural color (yellow) must render as the voice glyph');
  assert.equal(line.indexOf(RED_GLYPH) === -1, true,
    'SOFTENED direction: the stance color must not OVERRIDE a confident natural detection');
});

// ---------------------------------------------------------------------------
// Leg 3 -- PRESERVE FLOOR: with no natural voice signal, the stance color still
// applies as the default glyph. The capability survives the softening.
// ---------------------------------------------------------------------------
leg('leg 3 SUPERSEDED BY PHASE 243: with no natural signal the stance color must NOT render a glyph', function () {
  const line = renderer.renderCockpit({
    room: 'test-room',
    next_move: 'map the fork',
    stance: 'redteam',
    stance_forced_color: 'red',
  });
  assert.equal(line.indexOf(RED_GLYPH) !== -1, false,
    'GLYPH-01 (Phase 243): the stance default no longer fabricates a glyph when natural detection is silent');
});

// ---------------------------------------------------------------------------
// Leg 4 -- PRESERVE FLOOR: null stance degrades safely (byte-identical to the
// no-stance state; the cockpit-signals try/catch degrade floor holds).
// ---------------------------------------------------------------------------
leg('leg 4 PRESERVE FLOOR: null stance degrades byte-identically to the no-stance state', function () {
  const noStance = renderer.renderCockpit({ room: 'test-room', next_move: 'x', voice_color: 'yellow' });
  const nullStance = renderer.renderCockpit({
    room: 'test-room', next_move: 'x', voice_color: 'yellow',
    stance: null, stance_forced_color: null,
  });
  assert.equal(nullStance, noStance,
    'a null stance renders byte-identical to the no-stance state (degrade floor)');
  assert.equal(noStance.indexOf(YELLOW_GLYPH) !== -1, true,
    'natural detection still governs when no stance is set');
});

console.log('\ntest-voice-glyph-advisory: ' + pass + ' passed, ' + fail + ' failed'
  + (fail > 0 ? ' (softened-direction RED legs are EXPECTED until plan 210-03 lands)' : ''));
process.exit(fail > 0 ? 1 : 0);
