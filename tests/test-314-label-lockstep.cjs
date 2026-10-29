'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 314-03 Task 3 -- the plain-word dial label for the portfolio movement
 * signal, held in lockstep with composePortfolioOffer (legs L1 to L6).
 * dial-label-composer.cjs is render-only and never requires another module, so
 * this test is the only thing that keeps its sentence equal to the offer's.
 * Hermetic. Hyphens only. No dash characters are typed in this file.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const { composeLabel } = require(path.join(REPO, 'lib', 'hmi', 'dial-label-composer.cjs'));
const { renderDial } = require(path.join(REPO, 'lib', 'hmi', 'dial-presenter.cjs'));
const offer = require(path.join(REPO, 'lib', 'core', 'eureka', 'portfolio-offer.cjs'));
const { classify } = require(path.join(REPO, 'lib', 'core', 'part8-egress-guard.cjs'));
const FIXTURE_B = path.join(REPO, 'tests', 'fixtures', '314', 'movement-live.json');

const SIGNAL = 'eureka_portfolio_movement';

let PASS = 0;
let FAIL = 0;
function ok(label, fn) {
  try {
    fn();
    console.log('ok   ' + label);
    PASS += 1;
  } catch (e) {
    console.log('FAIL ' + label + ' -- ' + (e && e.message ? e.message : e));
    FAIL += 1;
  }
}

function ctx(b, t, r) {
  return { signal: SIGNAL, portfolio_band_cross: b, portfolio_tail_enter: t, portfolio_reshuffle: r };
}

function envFor(b, t, r) {
  const events = [];
  if (b > 0) events.push({ kind: 'band_cross', a_handle: 'n042', b_handle: 'n317', from_band: 'low', to_band: 'high', direction: 'up' });
  if (t > 0) events.push({ kind: 'tail_enter', handle: 'n900' });
  if (r > 0) events.push({ kind: 'top_n_reshuffle', top_n: 5, entered: 1, left: 1, max_shift: 2 });
  return Object.assign(JSON.parse(fs.readFileSync(FIXTURE_B, 'utf8')), {
    counts: { band_cross: b, tail_enter: t, top_n_reshuffle: r },
    events: events,
  });
}

console.log('test-314-label-lockstep.cjs: portfolio movement label and offer in lockstep');

ok('L1 the label for 2 pairs and 1 quiet signal is the fixed plain sentence', () => {
  const r = composeLabel('deep_research', ctx(2, 1, 0));
  assert.equal(r.label, 'Your opportunity portfolio moved since the last run: 2 pairs crossed a level and 1 quiet signal appeared.');
  assert.equal(r.degraded, false);
  assert.equal(r.canonical_verb, composeLabel('deep_research', {}).canonical_verb);
  assert.ok(Object.isFrozen(r));
});

ok('L2 for every count combination the label equals the offer prefix plus summary plus a period, and the offer text starts with it', () => {
  const vals = [0, 1, 2, 5];
  let n = 0;
  vals.forEach(function (b) {
    vals.forEach(function (t) {
      vals.forEach(function (r) {
        if (b + t + r === 0) return;
        const label = composeLabel('deep_research', ctx(b, t, r)).label;
        const want = offer.OFFER_LABEL_PREFIX + offer.composeMovementSummary({ band_cross: b, tail_enter: t, top_n_reshuffle: r }) + '.';
        assert.equal(label, want, 'counts ' + [b, t, r].join(','));
        const o = offer.composePortfolioOffer({ payload: envFor(b, t, r) });
        assert.ok(o, 'offer for ' + [b, t, r].join(','));
        assert.ok(o.text.startsWith(label), 'offer text starts with the label for ' + [b, t, r].join(','));
        n += 1;
      });
    });
  });
  assert.equal(n, 63);
});

ok('L3 the stamped bridge line and the ordinary deep_research line are unchanged', () => {
  const stamped = composeLabel('deep_research', {
    signal: 'eureka_bridge',
    stamp_verification: 'strong',
    stamp_path: 'A -> B',
  });
  assert.equal(stamped.label, 'verified through A -> B');
  const unverified = composeLabel('deep_research', { signal: 'eureka_bridge', stamp_verification: 'unverified' });
  assert.equal(unverified.label, 'unverified - novel or hallucinated, verify with an expert');
  const ordinary = composeLabel('deep_research', { topic: 'pricing' });
  assert.equal(/portfolio/.test(ordinary.label), false);
  assert.equal(ordinary.label.indexOf('{'), -1);
  // a portfolio signal on another reach id does not trigger the variant
  const other = composeLabel('cross_room', ctx(2, 1, 0));
  assert.equal(/portfolio moved/.test(other.label), false);
});

ok('L4 bad or empty counts fall through to the ordinary degrade ladder', () => {
  const plain = composeLabel('deep_research', {});
  const cases = [
    ctx(0, 0, 0),
    ctx(-1, 2, 0),
    ctx(1.5, 0, 0),
    ctx('2', 0, 0),
    ctx(NaN, 1, 0),
    { signal: SIGNAL },
    { signal: SIGNAL, portfolio_band_cross: 2 },
    { signal: 'something_else', portfolio_band_cross: 2, portfolio_tail_enter: 1, portfolio_reshuffle: 0 },
  ];
  cases.forEach(function (c, i) {
    const r = composeLabel('deep_research', c);
    assert.equal(/portfolio moved/.test(r.label), false, 'case ' + i + ' must not use the variant');
    assert.equal(r.label.indexOf('{'), -1, 'case ' + i + ' has no raw slot');
    assert.equal(r.label, plain.label, 'case ' + i + ' equals the ordinary label');
  });
});

ok('L5 dial-presenter threads the counts only for the portfolio signal', () => {
  const portfolioReach = {
    reach_id: 'deep_research',
    score: 0.5,
    recommended: false,
    signal: SIGNAL,
    evidence: { movement_id: 'pm_0123456789ab', scope: 'room', band_cross_count: 2, tail_enter_count: 1, reshuffle_count: 0, first_kind: 'band_cross' },
  };
  const rl = { reaches: [portfolioReach], tier_mode: 'tier_0', total_count: 1 };
  const dial = renderDial(rl, { slotContext: {} });
  assert.equal(dial.rows[0].label, 'Your opportunity portfolio moved since the last run: 2 pairs crossed a level and 1 quiet signal appeared.');
  assert.equal(dial.rows[0].degraded, false);

  // the same evidence under another signal is not threaded: byte-identical to a reach without it
  const noSignal = { reach_id: 'deep_research', score: 0.5, recommended: false, evidence: portfolioReach.evidence };
  const bare = { reach_id: 'deep_research', score: 0.5, recommended: false };
  const a = renderDial({ reaches: [noSignal], tier_mode: 'tier_0', total_count: 1 }, { slotContext: {} });
  const b = renderDial({ reaches: [bare], tier_mode: 'tier_0', total_count: 1 }, { slotContext: {} });
  assert.equal(a.rows[0].label, b.rows[0].label);
  assert.equal(a.text, b.text);

  // the bridge row is unchanged by the new code path
  const bridge = { reach_id: 'deep_research', score: 0.5, recommended: false, signal: 'eureka_bridge', evidence: { band_cross_count: 9, stamp_verification: 'strong', stamp_path: 'X -> Y' } };
  const c = renderDial({ reaches: [bridge], tier_mode: 'tier_0', total_count: 1 }, { slotContext: {} });
  assert.equal(c.rows[0].label, 'verified through X -> Y');
});

ok('L6 the label has no jargon and passes classify()', () => {
  const banned = ['band', 'tail', 'quadrant', 'ahp', 'handle', 'sensor', 'percentile', 'delta', 'envelope', 'sens'];
  [ctx(1, 0, 0), ctx(2, 1, 1), ctx(0, 3, 0), ctx(0, 0, 2)].forEach(function (c) {
    const label = composeLabel('deep_research', c).label;
    banned.forEach(function (w) {
      assert.equal(new RegExp('\\b' + w).test(label.toLowerCase()), false, 'banned word ' + w + ' in: ' + label);
    });
    assert.notEqual(classify(label, { toolName: 'brain_ask' }).verdict, 'block');
    assert.equal(label.indexOf(String.fromCharCode(0x2014)), -1);
    assert.equal(label.indexOf(String.fromCharCode(0x2013)), -1);
  });
});

console.log('\n' + PASS + ' passed, ' + FAIL + ' failed');
process.exit(FAIL === 0 ? 0 : 1);
