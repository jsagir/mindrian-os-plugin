#!/usr/bin/env node
'use strict';
// Phase 177 - The Behavioral Channel
// BCH-10 four-arrow HUD renders (TTY + degraded plain-text); arrows mutate
// investment_level (up/down) and posture (left/right) ONLY, clamped/within the
// frozen 3 postures. See .planning/phases/177-larry-behavioral-channel/177-SPEC.md
//
// Real asserts (replaces the scaffold stub). Pure module under test:
// lib/hmi/dial-selector.cjs. No I/O, no Brain call.

const assert = require('assert');
const dial = require('../lib/hmi/dial-selector.cjs');
const { POSTURE_IDS } = require('../lib/core/sensors/sensor-types.cjs');

console.log('--- test-bch-10-register-hud ---');

let n = 0;
function check(label, fn) { fn(); n++; console.log('  ok ' + n + ' - ' + label); }

// The four arrow glyphs the HUD must render in BOTH modes.
const ARROWS = ['↑', '↓', '←', '→'];

// 1. renderDialHud returns a string containing the four arrows in TTY mode.
check('renderDialHud(tty:true) contains the four arrows', () => {
  const out = dial.renderDialHud({ investment_level: 0.5, posture: 'hold', tty: true });
  assert.strictEqual(typeof out, 'string', 'HUD must be a string');
  for (const a of ARROWS) {
    assert.ok(out.indexOf(a) !== -1, 'TTY HUD missing arrow ' + a);
  }
});

// 2. renderDialHud returns a string containing the four arrows in NON-TTY
//    (degraded plain-text) mode -- the HUD still renders on Desktop/Cowork.
check('renderDialHud(tty:false) contains the four arrows (degraded)', () => {
  const out = dial.renderDialHud({ investment_level: 0.5, posture: 'hold', tty: false });
  assert.strictEqual(typeof out, 'string', 'degraded HUD must be a string');
  for (const a of ARROWS) {
    assert.ok(out.indexOf(a) !== -1, 'degraded HUD missing arrow ' + a);
  }
});

// 3. The non-TTY string is ANSI-byte-clean (no SGR escape bytes). Only the
//    TTY string may carry color; the degraded string must be clean (mirrors
//    the render-v2.cjs strip-ANSI(TTY) === non-TTY invariant).
check('degraded (non-TTY) HUD carries no ANSI SGR bytes', () => {
  const plain = dial.renderDialHud({ investment_level: 0.5, posture: 'hold', tty: false });
  // ESC (0x1b) must not appear in the degraded string.
  assert.ok(plain.indexOf('') === -1, 'degraded HUD leaked an ANSI escape byte');
});

// 4. an 'up' key raises investment_level and leaves posture unchanged.
check("'up' raises investment_level, posture unchanged", () => {
  const r = dial.reduceKeystroke({ investment_level: 0.5, posture: 'hold' }, 'up');
  assert.ok(r.investment_level > 0.5, 'up did not raise investment_level');
  assert.strictEqual(r.posture, 'hold', 'up changed posture');
});

// 5. a 'down' key lowers investment_level and leaves posture unchanged.
check("'down' lowers investment_level, posture unchanged", () => {
  const r = dial.reduceKeystroke({ investment_level: 0.5, posture: 'hold' }, 'down');
  assert.ok(r.investment_level < 0.5, 'down did not lower investment_level');
  assert.strictEqual(r.posture, 'hold', 'down changed posture');
});

// 6. a 'left'/'right' key changes posture to a member of POSTURE_IDS and leaves
//    investment_level unchanged.
check("'left' moves posture within the frozen 3, investment_level unchanged", () => {
  const r = dial.reduceKeystroke({ investment_level: 0.5, posture: 'hold' }, 'left');
  assert.ok(POSTURE_IDS.includes(r.posture), 'left produced a non-frozen posture');
  assert.strictEqual(r.posture, 'push_forward', 'left from hold should reach push_forward');
  assert.strictEqual(r.investment_level, 0.5, 'left changed investment_level');
});
check("'right' moves posture within the frozen 3, investment_level unchanged", () => {
  const r = dial.reduceKeystroke({ investment_level: 0.5, posture: 'hold' }, 'right');
  assert.ok(POSTURE_IDS.includes(r.posture), 'right produced a non-frozen posture');
  assert.strictEqual(r.posture, 'pull_back', 'right from hold should reach pull_back');
  assert.strictEqual(r.investment_level, 0.5, 'right changed investment_level');
});

// 7. investment_level stays clamped in [0,1] at the extremes.
check("'up' at 1.0 stays clamped at 1.0", () => {
  const r = dial.reduceKeystroke({ investment_level: 1.0, posture: 'hold' }, 'up');
  assert.strictEqual(r.investment_level, 1.0, 'up at ceiling did not clamp');
});
check("'down' at 0.0 stays clamped at 0.0", () => {
  const r = dial.reduceKeystroke({ investment_level: 0.0, posture: 'hold' }, 'down');
  assert.strictEqual(r.investment_level, 0.0, 'down at floor did not clamp');
});

// 8. posture never leaves the frozen 3, even at the extremes (clamp, no wrap).
check('posture clamps at push_forward (left does not wrap)', () => {
  const r = dial.reduceKeystroke({ investment_level: 0.5, posture: 'push_forward' }, 'left');
  assert.strictEqual(r.posture, 'push_forward', 'left wrapped past the first posture');
  assert.ok(POSTURE_IDS.includes(r.posture));
});
check('posture clamps at pull_back (right does not wrap)', () => {
  const r = dial.reduceKeystroke({ investment_level: 0.5, posture: 'pull_back' }, 'right');
  assert.strictEqual(r.posture, 'pull_back', 'right wrapped past the last posture');
  assert.ok(POSTURE_IDS.includes(r.posture));
});

// 9. purity: same (register, key) -> same output (no hidden state, no I/O).
check('reduceKeystroke is pure (same input -> same output)', () => {
  const a = dial.reduceKeystroke({ investment_level: 0.4, posture: 'hold' }, 'up');
  const b = dial.reduceKeystroke({ investment_level: 0.4, posture: 'hold' }, 'up');
  assert.deepStrictEqual(a, b, 'reducer is not pure');
});

console.log('  PASS - ' + n + ' assertions (BCH-10 four-arrow HUD + reducer)');
process.exit(0);
