#!/usr/bin/env node
'use strict';
// Phase 177 - The Behavioral Channel
// BCH-16 keypress CONTROL path is synchronous + pre-compose; AUDIT deferred.
// See .planning/phases/177-larry-behavioral-channel/177-SPEC.md
//
// Real asserts (replaces the scaffold stub). Per 177-RESEARCH.md sec 5b Q3 there
// is NO existing runtime escape-hatch parse site -- this CONTROL path is
// GREENFIELD. This suite proves the SYNCHRONOUS WRITE of the register_override
// scratch (the structural pre-Pass-1 slot the compose step will read at turn
// top) and the pure keystroke -> {investment_level, posture} mapping. It does
// NOT assert a "compose reads it" consumer -- that lands in a later wave (the
// plan-checker WARNING 2: keep the <done> honest, no phantom consumer).

const assert = require('assert');
const dial = require('../lib/hmi/dial-selector.cjs');
const dispatcher = require('../lib/hmi/selector-dispatcher.cjs');

console.log('--- test-bch-16-keypress-latency ---');

let n = 0;
function check(label, fn) { fn(); n++; console.log('  ok ' + n + ' - ' + label); }

// 1. applyControlKeypress returns SYNCHRONOUSLY (not a Promise) -- the same-turn,
//    same-latency control seam. No async hop.
check('applyControlKeypress returns synchronously (not a Promise)', () => {
  const out = dial.applyControlKeypress({ investment_level: 0.4, posture: 'hold' }, 'up');
  assert.ok(out && typeof out === 'object', 'control path returned non-object');
  assert.strictEqual(typeof out.then, 'undefined', 'control path returned a thenable (async)');
});

// 2. an Up keypress applied BEFORE compose raises investment_level in the
//    register_override (proving it changes THIS turn's composed dial input).
check("Up keypress writes a register_override with raised investment_level", () => {
  const before = 0.4;
  const out = dial.applyControlKeypress({ investment_level: before, posture: 'hold' }, 'up');
  assert.ok(out.register_override, 'no register_override slot written');
  assert.ok(out.register_override.investment_level > before, 'override did not raise investment_level');
});

// 3. the override carries source:'keypress'.
check("register_override carries source:'keypress'", () => {
  const out = dial.applyControlKeypress({ investment_level: 0.4, posture: 'hold' }, 'up');
  assert.strictEqual(out.register_override.source, 'keypress', 'override missing source:keypress');
});

// 4. the control path mutates ONLY the keyed axis (Up -> investment_level only).
check('Up mutates investment_level only (posture untouched)', () => {
  const out = dial.applyControlKeypress({ investment_level: 0.4, posture: 'hold' }, 'up');
  assert.strictEqual(out.register_override.posture, 'hold', 'Up keypress changed posture');
});
check('Left mutates posture only (investment_level untouched)', () => {
  const out = dial.applyControlKeypress({ investment_level: 0.4, posture: 'hold' }, 'left');
  assert.strictEqual(out.register_override.investment_level, 0.4, 'Left keypress changed investment_level');
  assert.strictEqual(out.register_override.posture, 'push_forward', 'Left keypress did not move posture');
});

// 5. writeRegisterOverride writes the slot onto a scratch object synchronously,
//    in-place -- the structural pre-Pass-1 slot a compose entry would read.
check('writeRegisterOverride writes the scratch slot synchronously, in-place', () => {
  const scratch = { investment_level: 0.4, posture: 'hold' };
  const ret = dial.writeRegisterOverride(scratch, 'up');
  assert.strictEqual(ret, scratch, 'writeRegisterOverride must return the same scratch object');
  assert.ok(scratch.register_override, 'scratch slot not written');
  assert.ok(scratch.register_override.investment_level > 0.4, 'scratch override did not raise investment_level');
  assert.strictEqual(scratch.register_override.source, 'keypress');
});

// 6. the CONTROL path writes NO audit row / no manual_override @1.0 (deferred to
//    Wave 2). The returned shape carries ONLY register_override -- nothing that
//    looks like an audit write (no manual_override, no @1.0 marker, no audit key).
check('CONTROL path writes NO audit row (manual_override @1.0 is Wave 2)', () => {
  const out = dial.applyControlKeypress({ investment_level: 0.4, posture: 'hold' }, 'up');
  const keys = Object.keys(out);
  assert.deepStrictEqual(keys, ['register_override'], 'control path emitted more than the override slot');
  assert.strictEqual(out.manual_override, undefined, 'control path wrote a manual_override (Wave 2 leak)');
  assert.strictEqual(out.audit, undefined, 'control path wrote an audit key (Wave 2 leak)');
  // The override value itself must NOT be the AUDIT sentinel 1.0 unless the
  // navigator stepped there; from 0.4 a single Up step cannot reach 1.0.
  assert.notStrictEqual(out.register_override.investment_level, 1.0, 'override jumped to the @1.0 audit sentinel');
});

// 7. the dispatcher's new dial branch returns a { shape, rendered } envelope
//    (NOT the error envelope) when dial-selector is present.
check("dispatcher pickShape('F.7-dial') returns a { shape, rendered } envelope", () => {
  const res = dispatcher.pickShape({
    requestedShape: 'F.7-dial',
    tier: 1,
    payload: { investment_level: 0.5, posture: 'hold', tty: false },
  });
  assert.ok(res && typeof res === 'object', 'pickShape returned non-object');
  assert.notStrictEqual(res.shape, 'error', 'dial branch fell through to the error envelope');
  assert.strictEqual(res.shape, 'F.7-dial', 'dial branch did not return the F.7-dial shape');
  assert.ok(res.rendered && typeof res.rendered === 'object', 'dial branch missing rendered envelope');
  // The HUD string is carried on the rendered envelope and contains the arrows.
  const hud = res.rendered.hud || (res.rendered.zones && res.rendered.zones.header) || '';
  for (const a of ['↑', '↓', '←', '→']) {
    assert.ok(hud.indexOf(a) !== -1, 'dispatched dial HUD missing arrow ' + a);
  }
});

console.log('  PASS - ' + n + ' assertions (BCH-16 synchronous control path + dial branch)');
process.exit(0);
