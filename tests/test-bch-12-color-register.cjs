#!/usr/bin/env node
'use strict';
// Phase 177 - The Behavioral Channel
// BCH-12: the per-turn color badge, painted AT COMPOSITION so it cannot lie.
//
// The headline assert (the pedagogy made mechanical, directly relevant to a live
// tester compliment complaint): POSTURE_CLI_COLOR has NO 'praise' key and NO
// 'grade' key. There is no engine state for a compliment, so there is no color
// to paint one -- invisibility by absence. You cannot color what the map does
// not name.
//
// The other asserts: the 3 frozen postures map into the 5-color CLI set (no
// blue/black/white); the Zone 1 badge color is DRIVEN from the composed posture
// (a different posture -> a different color, painted at composition); render with
// no posture + no jtbd adds no badge (byte-stable no-op); the statusline second
// surface (renderRow2) carries the badge when state.posture is set.
//
// Pure node asserts, no deps. Mirrors the ok(cond,msg) + failed-counter idiom
// from test-bch-14-part8-egress.cjs.

const r = require('../lib/render/render-v2.cjs');
const t = require('../lib/statusline/two-row-renderer.cjs');

let failed = 0;
function ok(cond, msg) {
  console.log((cond ? '  ok   - ' : '  FAIL - ') + msg);
  if (!cond) failed++;
}

console.log('--- test-bch-12-color-register ---');

const P = r.POSTURE_CLI_COLOR;
ok(!!P, 'render-v2 exports POSTURE_CLI_COLOR');

// (1) Exactly the 3 frozen posture keys -- no more, no less.
const keys = Object.keys(P || {}).sort();
const expected = ['hold', 'pull_back', 'push_forward'].sort();
ok(
  JSON.stringify(keys) === JSON.stringify(expected),
  'POSTURE_CLI_COLOR keys are EXACTLY {pull_back,hold,push_forward}; got [' + keys.join(', ') + ']'
);

// (2) THE BCH-12 HEADLINE: no praise key and no grade key. Invisibility by
//     absence -- the channel structurally cannot flatter.
ok(!('praise' in (P || {})), "POSTURE_CLI_COLOR has NO 'praise' key (invisibility by absence -- the channel cannot flatter)");
ok(!('grade' in (P || {})), "POSTURE_CLI_COLOR has NO 'grade' key (there is no engine state for a compliment, so no color names one)");

// (3) Every posture color value is a member of the 5-color CLI set
//     (red/yellow/cyan/green/gray) -- no blue/black/white (HTML/Mondrian only).
const FIVE = new Set(['red', 'yellow', 'cyan', 'green', 'gray']);
const offenders = Object.values(P || {}).filter((v) => !FIVE.has(v));
ok(offenders.length === 0, 'every posture color is in the 5-color CLI set {red,yellow,cyan,green,gray}; offenders: [' + offenders.join(', ') + ']');

// (3b) The frozen map is genuinely frozen (cannot grow a praise key at runtime).
ok(Object.isFrozen(P), 'POSTURE_CLI_COLOR is Object.freeze-d (no runtime praise/grade key can be added)');

// (4) Painted at composition: a different composed posture drives a different
//     Zone 1 color. The ANSI SGR bytes are TTY-gated, so we force isTTY for this
//     assertion to observe the color difference (non-TTY strips ANSI by design).
const savedTTY = process.stdout.isTTY;
try {
  process.stdout.isTTY = true;
  const push = r.render({ zones: { header: 'hi' }, posture: 'push_forward' }).rendered;
  const pull = r.render({ zones: { header: 'hi' }, posture: 'pull_back' }).rendered;
  ok(push !== pull, 'two different postures yield two different rendered headers (color tracks the composed posture -- painted at composition)');
  ok(push.indexOf(r.ANSI[P.push_forward]) !== -1, 'push_forward header carries the green SGR bytes from the composed posture');
  ok(pull.indexOf(r.ANSI[P.pull_back]) !== -1, 'pull_back header carries the red SGR bytes from the composed posture');
} finally {
  process.stdout.isTTY = savedTTY;
}

// (5) render() with neither posture nor jtbd adds NO badge (byte-stable no-op).
const noBadge = r.render({ zones: { header: 'hi' } }).rendered;
ok(noBadge.indexOf('■') === -1, 'no posture + no jtbd -> no Zone 1 badge glyph (byte-stable no-op path)');

// (5b) jtbd remains the fallback color source when no posture is present.
{
  const savedTTY2 = process.stdout.isTTY;
  try {
    process.stdout.isTTY = true;
    const jtbdOnly = r.render({ zones: { header: 'hi' }, jtbd: 'find-problem' }).rendered;
    ok(jtbdOnly.indexOf('■') !== -1, 'jtbd is the fallback color source when no posture is present (badge still painted)');
  } finally {
    process.stdout.isTTY = savedTTY2;
  }
}

// (6) The statusline second surface (renderRow2) carries the badge.
const row2Base = t.renderRow2({ room: 'r', section: 's', operator: 'BUILD_ROOM' }, 120);
const row2WithP = t.renderRow2({ room: 'r', section: 's', operator: 'BUILD_ROOM', posture: 'push_forward' }, 120);
ok(row2WithP !== row2Base, 'renderRow2 with state.posture differs from renderRow2 without it (the second surface carries the badge)');
ok(row2WithP.indexOf('PUSH_FORWARD') !== -1, 'renderRow2 posture badge carries the composed-posture enum handle as a plain tag');
ok(row2Base === t.renderRow2({ room: 'r', section: 's', operator: 'BUILD_ROOM' }, 120), 'the no-posture renderRow2 path is byte-stable');

console.log(failed ? ('  ' + failed + ' assertion(s) FAILED') : '  all assertions passed');
process.exit(failed ? 1 : 0);
