'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 314-03 Task 2 -- composePortfolioOffer contract suite (O1 to O10).
 * Sibling of tests/test-213-eureka-offer.cjs. Hermetic: no Brain, no network.
 * Hyphens only. No dash characters are typed in this file; the dash scan uses
 * String.fromCharCode.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const OFFER_PATH = path.join(REPO, 'lib', 'core', 'eureka', 'portfolio-offer.cjs');
const offerMod = require(OFFER_PATH);
const { composePortfolioOffer, composeMovementSummary, OFFER_VOCABULARY, OFFER_LABEL_PREFIX, OFFER_QUESTION, NEXT_COMMAND } = offerMod;
const { classify } = require(path.join(REPO, 'lib', 'core', 'part8-egress-guard.cjs'));
const FIXTURE_B = path.join(REPO, 'tests', 'fixtures', '314', 'movement-live.json');

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

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

function env(over) {
  return Object.assign(JSON.parse(fs.readFileSync(FIXTURE_B, 'utf8')), over || {});
}

function threeEnv() {
  return env({
    counts: { band_cross: 2, tail_enter: 1, top_n_reshuffle: 1 },
    events: [
      { kind: 'band_cross', a_handle: 'n042', b_handle: 'n317', from_band: 'moderate', to_band: 'high', direction: 'up' },
      { kind: 'tail_enter', handle: 'n900' },
      { kind: 'top_n_reshuffle', top_n: 5, entered: 1, left: 1, max_shift: 2 },
    ],
  });
}

console.log('test-314-offer.cjs: composePortfolioOffer (sibling of composeEurekaOffer)');

ok('O1 a valid live envelope yields exactly one offer object with the five keys', () => {
  const o = composePortfolioOffer({ payload: env() });
  assert.ok(o && typeof o === 'object' && !Array.isArray(o));
  assert.deepEqual(Object.keys(o).sort(), ['command', 'counts', 'next', 'scope', 'text']);
  assert.equal(o.scope, 'room');
  assert.deepEqual(o.counts, { band_cross: 1, tail_enter: 0, top_n_reshuffle: 0 });
  assert.equal(o.command, NEXT_COMMAND);
});

ok('O2 text is the fixed template and ends with a question mark', () => {
  const o = composePortfolioOffer({ payload: threeEnv() });
  assert.equal(OFFER_LABEL_PREFIX, 'Your opportunity portfolio moved since the last run: ');
  assert.equal(OFFER_QUESTION, ' Want to look at the full read?');
  assert.equal(o.text, OFFER_LABEL_PREFIX + composeMovementSummary(o.counts) + '.' + OFFER_QUESTION);
  assert.ok(o.text.endsWith('?'));
});

ok('O3 summary phrases: three parts, one part, singular and plural', () => {
  assert.equal(
    composeMovementSummary({ band_cross: 2, tail_enter: 1, top_n_reshuffle: 1 }),
    '2 pairs crossed a level, 1 quiet signal appeared, and the top of the list changed order');
  assert.equal(composeMovementSummary({ band_cross: 1, tail_enter: 0, top_n_reshuffle: 0 }), '1 pair crossed a level');
  assert.equal(composeMovementSummary({ band_cross: 0, tail_enter: 3, top_n_reshuffle: 0 }), '3 quiet signals appeared');
  assert.equal(composeMovementSummary({ band_cross: 0, tail_enter: 0, top_n_reshuffle: 2 }), 'the top of the list changed order');
  assert.equal(
    composeMovementSummary({ band_cross: 2, tail_enter: 1, top_n_reshuffle: 0 }),
    '2 pairs crossed a level and 1 quiet signal appeared');
  assert.equal(
    composeMovementSummary({ band_cross: 0, tail_enter: 2, top_n_reshuffle: 1 }),
    '2 quiet signals appeared and the top of the list changed order');
});

ok('O4 token whitelist: only digits and fixed words; no handle, no sentinel', () => {
  assert.ok(Object.isFrozen(OFFER_VOCABULARY));
  const sentinel = env({
    events: [{ kind: 'band_cross', a_handle: 'SENTINELAAA', b_handle: 'SENTINELBBB', from_band: 'low', to_band: 'high', direction: 'up' }],
  });
  [env(), threeEnv(), sentinel].forEach(function (payload) {
    const o = composePortfolioOffer({ payload: payload });
    assert.ok(o);
    const words = o.text.replace(/[.,:?]/g, ' ').split(/\s+/).filter(Boolean);
    words.forEach(function (w) {
      const lw = w.toLowerCase();
      assert.ok(/^\d+$/.test(w) || OFFER_VOCABULARY.indexOf(lw) !== -1, 'token not allowed: ' + w);
    });
    assert.equal(/SENTINEL|n042|n317|n900|pm_/.test(o.text), false);
  });
});

ok('O5 plain-words fence', () => {
  const banned = ['band', 'tail', 'quadrant', 'ahp', 'handle', 'sensor', 'percentile', 'delta', 'envelope', 'sens'];
  [env(), threeEnv()].forEach(function (payload) {
    const text = composePortfolioOffer({ payload: payload }).text.toLowerCase();
    banned.forEach(function (b) {
      assert.equal(new RegExp('\\b' + b).test(text), false, 'banned word: ' + b);
    });
  });
  OFFER_VOCABULARY.forEach(function (w) {
    assert.equal(/^(band|tail|quadrant|ahp|handle|sensor|percentile|delta|envelope|sens)/.test(w), false, 'vocabulary word: ' + w);
  });
});

ok('O6 voice fence: no dash characters, no grading words, no imperative, ends with ?', () => {
  [env(), threeEnv()].forEach(function (payload) {
    const text = composePortfolioOffer({ payload: payload }).text;
    assert.equal(text.indexOf(EM), -1);
    assert.equal(text.indexOf(EN), -1);
    assert.equal(/\b(good|great|best|score|rank|win)/i.test(text), false);
    assert.equal(/^(do|run|go|click|type|use|open|start)\b/i.test(text), false);
    assert.ok(text.endsWith('?'));
  });
});

ok('O7 abstains on every bad payload', () => {
  const bad = {
    null_payload: null,
    undefined_payload: undefined,
    string_payload: 'text',
    stub_encoder: env({ encoder_kind: 'stub' }),
    extra_key: env({ title: 'room text' }),
    unknown_event_kind: env({ events: [{ kind: 'mystery', handle: 'n1' }] }),
    zero_counts: env({ counts: { band_cross: 0, tail_enter: 0, top_n_reshuffle: 0 } }),
    bad_movement_id: env({ movement_id: 'pm_nothex' }),
    wrong_schema: env({ schema_version: 2 }),
  };
  Object.keys(bad).forEach(function (k) {
    assert.equal(composePortfolioOffer({ payload: bad[k] }), null, k + ' must abstain');
  });
  assert.equal(composePortfolioOffer(), null);
  assert.equal(composePortfolioOffer(null), null);
});

ok('O8 next.command is /mos:eureka-portfolio; registry leg runs once the command file exists', () => {
  assert.equal(NEXT_COMMAND, '/mos:eureka-portfolio');
  const o = composePortfolioOffer({ payload: env() });
  assert.equal(o.next.command, '/mos:eureka-portfolio');
  const cmdFile = path.join(REPO, 'commands', 'eureka-portfolio.md');
  if (!fs.existsSync(cmdFile)) {
    console.log('     SKIP O8 registry leg -- commands/eureka-portfolio.md absent (plan 314-05)');
    return;
  }
  const reg = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'command-registry.json'), 'utf8'));
  assert.ok(reg.commands.some(function (c) { return c && c.command === NEXT_COMMAND; }), 'command is in the registry');
});

ok('O9 the module requires no Brain client, no chain runner, no network, and executes nothing', () => {
  const src = fs.readFileSync(OFFER_PATH, 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const requires = (code.match(/require\([^)]*\)/g) || []);
  requires.forEach(function (r) {
    assert.equal(/brain|chain|runner|http|https|net|child_process|fetch/i.test(r), false, 'forbidden require: ' + r);
  });
  assert.equal(/\bfetch\(|child_process|\bexec\w*\(|spawn|http:|https:/.test(code), false);
  assert.equal(/writeFile|appendFile|mkdirSync|rmSync/.test(code), false);
});

ok('O10 classify() does not block the offer', () => {
  const o = composePortfolioOffer({ payload: threeEnv() });
  const v = classify(o, { toolName: 'brain_ask' });
  assert.notEqual(v.verdict, 'block');
  const v2 = classify(o.text, { toolName: 'brain_ask' });
  assert.notEqual(v2.verdict, 'block');
});

console.log('\n' + PASS + ' passed, ' + FAIL + ' failed');
process.exit(FAIL === 0 ? 0 : 1);
