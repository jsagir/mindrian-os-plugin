#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick task 20260702-statusline-context-aware -- the navigator-co-designed
 * statusline enhancement pass (Phase 121.5 co-design rule). Asserts the four
 * navigator rulings + bucket-1(d):
 *
 *   Ruling 1: the static "👤 Larry" persona chip is DROPPED (hexagon carries brand).
 *   Ruling 2: the Brain chip is BINARY -- 🧠on when connected, OMITTED when off
 *             (never a bare mystery glyph). The 192-04 stance chip is unaffected.
 *   Ruling 3: "Next:" is context-aware -- resolution order routed -> per-turn
 *             decision cue -> jtbd -> honest "--" (never the lying "continue").
 *             persistFromDecision widens the live sources (fire_skill / offer).
 *   Bucket-1(d): native context percentage parse (used_percentage /
 *             exceeds_200k_tokens) with null-after-/compact guard + estimate
 *             fallback.
 *
 * Canon Part 8: LOCAL only. No Brain, no network, no user data. House rule:
 * hyphens only, no em-dashes (the suite self-checks its own source).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const cockpit = require(path.join(REPO, 'lib', 'statusline', 'cockpit-renderer.cjs'));
const signals = require(path.join(REPO, 'lib', 'statusline', 'cockpit-signals.cjs'));
const nextMoveCache = require(path.join(REPO, 'lib', 'statusline', 'next-move-cache.cjs'));
const ctxWindow = require(path.join(REPO, 'lib', 'statusline', 'ctx-window.cjs'));

const BRAIN = String.fromCodePoint(0x1F9E0); // 🧠
const PERSON = String.fromCodePoint(0x1F464); // 👤
const ROBOT = String.fromCodePoint(0x1F916);  // 🤖
const HEX = '⬡';

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

console.log('test-statusline-context-aware');

// A healthy base state (hero = Next), Larry speaking, brain on.
function base(extra) {
  return Object.assign({
    room: 'demo-room',
    health: 'sound',
    ctx_pct: 30,
    next_move: 'validate edits',
    brain: true,
    who: 'larry',
  }, extra || {});
}

// ---------------------------------------------------------------------------
// Ruling 1: DROP the static persona chip.
// ---------------------------------------------------------------------------
ok('Ruling 1: steady Larry render drops the static "👤 Larry" chip', function () {
  const out = cockpit.renderCockpit(base());
  assert.equal(out.indexOf(PERSON) === -1, true, 'no 👤 glyph anywhere');
  assert.equal(out.indexOf('Larry') === -1, true, 'no static "Larry" label');
  assert.equal(out.indexOf(HEX) !== -1, true, 'the hexagon still carries brand identity');
});

ok('Ruling 1: the DYNAMIC host marker (🤖) is kept on a non-Larry turn', function () {
  const out = cockpit.renderCockpit(base({ who: 'claude', agent_label: 'Claude', brain: false }));
  assert.equal(out.indexOf(ROBOT) !== -1, true, '🤖 host marker present (dynamic, not dropped)');
  assert.equal(out.indexOf('Claude') !== -1, true, 'host label present');
});

ok('Ruling 1: the DYNAMIC voice-switch announcement is kept', function () {
  const out = cockpit.renderCockpit(base({ who: 'larry', voice_switched: true, switch_direction: 'claude-to-larry' }));
  assert.equal(out.indexOf('now: Larry (back)') !== -1, true, 'switch-back announcement present (dynamic)');
});

// ---------------------------------------------------------------------------
// Ruling 2: the Brain chip is BINARY (on / absent), never a bare glyph.
// ---------------------------------------------------------------------------
ok('Ruling 2: Brain connected renders the labeled "🧠on" ON-form', function () {
  const out = cockpit.renderCockpit(base({ brain: true }));
  assert.equal(out.indexOf(BRAIN + 'on') !== -1, true, '🧠on present when connected');
  assert.equal(cockpit.BRAIN_ON, BRAIN + 'on', 'BRAIN_ON constant is 🧠on');
});

ok('Ruling 2: Brain off OMITS the chip (no bare mystery 🧠)', function () {
  const out = cockpit.renderCockpit(base({ brain: false }));
  assert.equal(out.indexOf(BRAIN) === -1, true, 'no 🧠 glyph at all when Brain is off');
});

ok('Ruling 2: brain_tier === "BRAIN" also lights the ON-form (Larry only)', function () {
  const on = cockpit.renderCockpit(base({ brain: false, brain_tier: 'BRAIN' }));
  assert.equal(on.indexOf(BRAIN + 'on') !== -1, true, 'brain_tier BRAIN -> 🧠on');
  const hostTurn = cockpit.renderCockpit(base({ brain: true, who: 'claude', agent_label: 'Claude' }));
  assert.equal(hostTurn.indexOf(BRAIN) === -1, true, 'a host turn never shows the Brain chip');
});

// ---------------------------------------------------------------------------
// Ruling 3: "Next:" resolution order + the honest "--" fallback.
// persistFromDecision widens the live sources (offer_next_step / fire_skill).
// ---------------------------------------------------------------------------
const savedHome = process.env.HOME;
const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-ctx-aware-'));
process.env.HOME = tmpHome;
try {
  ok('Ruling 3c: the honest "--" is the last-resort default (never "continue")', function () {
    assert.equal(signals.deriveNextMove({}), '--', 'empty -> "--"');
    const out = cockpit.renderCockpit(base({ next_move: undefined }));
    assert.equal(out.indexOf('Next: --') !== -1, true, 'renderer default is "Next: --"');
    assert.equal(out.indexOf('continue') === -1, true, 'the lying "continue" never renders');
  });

  ok('Ruling 3 order: routed offer > jtbd > "--"', function () {
    // Clean slate.
    nextMoveCache.persistNextMove(null);
    assert.equal(signals.deriveNextMove({ jtbd: 'validate' }), 'validate', 'jtbd wins over "--" when no routed step');
    // A routed offer beats the jtbd.
    nextMoveCache.persistNextMove({ command: '/mos:map-unknowns' });
    assert.equal(signals.deriveNextMove({ jtbd: 'validate' }), 'map unknowns', 'routed offer wins over jtbd');
  });

  ok('Ruling 3a: persistFromDecision persists offer_next_step.command (preferred)', function () {
    nextMoveCache.persistNextMove(null);
    const wrote = nextMoveCache.persistFromDecision({
      offer_next_step: { command: '/mos:mullins', jtbd: 'assess-opportunity' },
      fire_skill: 'soft-systems',
    });
    assert.equal(wrote, true, 'persistFromDecision returned true');
    assert.equal(signals.readRoutedNextMove(), 'mullins', 'offer command persisted (preferred over fire_skill)');
  });

  ok('Ruling 3a: persistFromDecision falls back to fire_skill when no offer', function () {
    nextMoveCache.persistNextMove(null);
    nextMoveCache.persistFromDecision({ offer_next_step: null, fire_skill: 'map-unknowns' });
    assert.equal(signals.readRoutedNextMove(), 'map unknowns', 'fire_skill persisted as the suggested command');
  });

  ok('Ruling 3a: a decision with neither cue CLEARS the cache (honest default, no stale pin)', function () {
    nextMoveCache.persistNextMove({ command: '/mos:mullins' });
    nextMoveCache.persistFromDecision({ offer_next_step: null, fire_skill: null });
    assert.equal(signals.readRoutedNextMove(), null, 'cache cleared -> reader falls back to jtbd / "--"');
    assert.equal(signals.deriveNextMove({}), '--', 'and the honest "--" shows');
  });

  ok('Ruling 3a: persistFromDecision never throws on junk', function () {
    assert.equal(nextMoveCache.persistFromDecision(null), true, 'null decision -> clears (true)');
    assert.equal(nextMoveCache.persistFromDecision(undefined), true, 'undefined -> clears (true)');
    assert.equal(nextMoveCache.persistFromDecision(42), true, 'non-object -> clears (true)');
  });
} finally {
  if (savedHome === undefined) delete process.env.HOME; else process.env.HOME = savedHome;
  fs.rmSync(tmpHome, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Bucket-1(d): native context percentage parse.
// ---------------------------------------------------------------------------
ok('bucket-1d: native used_percentage is preferred', function () {
  const r = ctxWindow.resolveCtxPct({ used_percentage: 42, remaining_percentage: 90 });
  assert.equal(r.pct, 42, 'reads the native used_percentage directly');
  assert.equal(r.source, 'native', 'source is native');
});

ok('bucket-1d: exceeds_200k_tokens forces the hard cliff (100)', function () {
  const r = ctxWindow.resolveCtxPct({ exceeds_200k_tokens: true, used_percentage: 5 });
  assert.equal(r.pct, 100, 'the exceeds flag pins the cliff regardless of a stale pct');
  assert.equal(r.source, 'native', 'source is native');
});

ok('bucket-1d: null-after-/compact used_percentage falls through to the estimate', function () {
  // current_usage null -> used_percentage null; remaining still present -> estimate.
  const r = ctxWindow.resolveCtxPct({ used_percentage: null, remaining_percentage: 100 });
  assert.equal(r.source, 'estimate', 'falls back to the estimate, not a wrong native 0');
  assert.equal(r.pct, 0, 'remaining 100 -> 0% used');
});

ok('bucket-1d: no native + no remaining -> null (renderer suppresses the bar)', function () {
  assert.equal(ctxWindow.resolveCtxPct({}).pct, null, 'empty context_window -> null pct');
  assert.equal(ctxWindow.resolveCtxPct(null).pct, null, 'null context_window -> null pct');
  assert.equal(ctxWindow.resolveCtxPct(undefined).source, 'none', 'source none when no data');
});

// ---------------------------------------------------------------------------
// RCA statusline-context-pct-stale-post-compact (2026-07-28) -- THE SCALE RULE.
//
// The fallback branch is a SUBSTITUTE for the native branch, so it must answer
// the same question on the same scale. It previously rescaled remaining through
// the AUTO_COMPACT_BUFFER (a different question: percent-of-the-way-to-auto-
// compact), inflating the gauge by up to +16.5 points. Because the fallback is
// reached exactly when used_percentage is null -- the turn right after /compact --
// the gauge jumped UP after a compact, reading as a stale/frozen number.
//
// Grounding: 787/787 real captured host payloads across 11 model ids have
// used_percentage + remaining_percentage === 100 EXACTLY, so 100 - remaining is an
// exact recovery of used_percentage, needing no compact-detection heuristic and no
// stdin field the host does not send.
// ---------------------------------------------------------------------------
ok('RCA scale rule: the remaining-derived branch equals the native branch', function () {
  // For every plausible host state, both branches MUST agree. This is the
  // regression fence: any reintroduced rescale breaks it immediately.
  for (const used of [0, 1, 10, 25, 40, 50, 60, 70, 75, 78, 80, 90, 99, 100]) {
    const remaining = 100 - used;
    const native = ctxWindow.resolveCtxPct({ used_percentage: used, remaining_percentage: remaining });
    const fallback = ctxWindow.resolveCtxPct({ used_percentage: null, remaining_percentage: remaining });
    assert.equal(native.pct, used, 'native branch reports raw used% at used=' + used);
    assert.equal(
      fallback.pct, native.pct,
      'fallback must equal native at used=' + used + ' (got ' + fallback.pct + ' vs ' + native.pct + ')'
    );
    assert.equal(fallback.source, 'estimate', 'source still reports provenance at used=' + used);
  }
});

ok('RCA scale rule: the exact reported symptom (true 78 rendered as 93) is gone', function () {
  // The navigator saw "📊 █████████░ 93%". Under the old buffer rescale a true
  // used_percentage of 78 produced exactly 93 through the post-/compact fallback.
  const r = ctxWindow.resolveCtxPct({ used_percentage: null, remaining_percentage: 22 });
  assert.notEqual(r.pct, 93, 'the inflated 93 must not come back');
  assert.equal(r.pct, 78, 'renders the true 78% used');
});

ok('RCA scale rule: estimateFromRemaining is the exact complement', function () {
  assert.equal(ctxWindow.estimateFromRemaining(50), 50, 'remaining 50 -> 50% used');
  assert.equal(ctxWindow.estimateFromRemaining(100), 0, 'remaining 100 -> 0% used');
  assert.equal(ctxWindow.estimateFromRemaining(0), 100, 'remaining 0 -> 100% used');
  assert.equal(ctxWindow.estimateFromRemaining(16.5), 84, 'the buffer value is not a scale factor');
  assert.equal(ctxWindow.estimateFromRemaining(null), null, 'non-finite -> null');
  assert.equal(ctxWindow.estimateFromRemaining(undefined), null, 'undefined -> null');
});

ok('RCA scale rule: AUTO_COMPACT_BUFFER survives as documentation only', function () {
  // Retained so the real host threshold stays discoverable, but it must no longer
  // participate in any percentage the gauge renders.
  assert.equal(ctxWindow.AUTO_COMPACT_BUFFER, 16.5, 'constant still exported');
  // Under the old rescale, remaining 16.5 saturated the gauge to 100. It is now
  // simply 83.5% used, and remaining 83.5 is simply ~17% used.
  assert.equal(ctxWindow.estimateFromRemaining(16.5), 84, 'remaining 16.5 -> 84% used, not 100');
  assert.equal(ctxWindow.estimateFromRemaining(83.5), 17, 'remaining 83.5 -> 17% used');
});

ok('bucket-1d: used_percentage is clamped to [0,100] and rounded', function () {
  assert.equal(ctxWindow.resolveCtxPct({ used_percentage: 123.6 }).pct, 100, 'clamped high');
  assert.equal(ctxWindow.resolveCtxPct({ used_percentage: -5 }).pct, 0, 'clamped low');
  assert.equal(ctxWindow.resolveCtxPct({ used_percentage: 36.4 }).pct, 36, 'rounded');
});

// ---------------------------------------------------------------------------
// House rule: this suite is em-dash-free.
// ---------------------------------------------------------------------------
ok('this test file is em-dash-free', function () {
  const self = fs.readFileSync(__filename, 'utf8');
  const emDash = String.fromCharCode(0x2014);
  assert.equal(self.indexOf(emDash), -1, 'no em-dash in the test file');
});

console.log('  ' + n + ' checks passed');
