#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 392 plan 04: the obfuscated-email pattern of
 * lib/core/cross-room-aggregator.cjs (_P_EMAIL_OBFUSCATED, inside
 * ALWAYS_PATTERNS and FORBIDDEN_PATTERNS) must run in linear time. On
 * beta.81 the pattern took seconds on a 40,000 character string against the
 * 5 s hook timeout (PLAN.md section 3 P1 measured 5.7 s on the plan author's
 * string; this test's string is measured and printed here).
 *
 * Root cause on beta.81: both alternatives open with an unanchored local part
 * `[A-Za-z0-9._%+-]+` (the second after a `\b`, which sits at every letter
 * next to a dot), so inside a long run of local-part characters every
 * position is a match start that eats the rest of the run and backtracks:
 * O(n^2). A run of "a." fragments (an obfuscated local part that never
 * reaches its at marker) is the trigger. The plan's "aaaa at " and "dot "
 * fragments break the run with spaces and run in milliseconds.
 *
 * Arms:
 *   E1 the exported credential and prose set (ALWAYS_PATTERNS plus
 *      PROSE_PATTERNS, which hold CREDENTIAL_SHAPES and the email pattern)
 *      scans 40,000 adversarial characters in under 1,000 ms; the time is
 *      printed
 *   E2 400,000 characters scan in under 10 times the 40,000 character time
 *      (tolerance 2x, so under 20 times, with a 20 ms floor on the base time);
 *      not run when E1 is already over budget (quadratic growth would take
 *      minutes)
 *   E3 positives still hit any ALWAYS pattern: "[at] ... [dot]", plain
 *      "at ... dot", "(at)...", upper case, two labels; negatives still miss
 *      every ALWAYS pattern: "look at the dot com bubble", "3 + 2", "+30%"
 *      and the other ordinary at, dot and plus-sign questions
 *   E4 the exported names are unchanged and lib/core/rs-egress-prompts.cjs
 *      re-exports the same arrays
 *   E5 scripts/part8-egress-guard-hook.cjs on the 40,000 character payload
 *      (spawnSync, pattern tests/test-386-guard-fails-closed.cjs:117) ends in
 *      under 2,000 ms wall time
 *
 * Every string is invented and built at run time (an invented obfuscated
 * address; no room word, no room file name, no Brain identifier). No network.
 * No em dash or en dash.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const AGG_PATH = path.join(ROOT, 'lib', 'core', 'cross-room-aggregator.cjs');
const RS_PATH = path.join(ROOT, 'lib', 'core', 'rs-egress-prompts.cjs');
const HOOK = path.join(ROOT, 'scripts', 'part8-egress-guard-hook.cjs');
const TOOL = 'mcp__plugin_mos_mindrian-brain__brain_ask';

const BUDGET_40K_MS = 1000;
const HOOK_BUDGET_MS = 2000;
const LINEAR_FACTOR = 20; // 10x growth, tolerance 2x
const BASE_FLOOR_MS = 20;

let failures = 0;
function ok(label, detail) { console.log('ok - ' + label + (detail ? ' ' + detail : '')); }
function fail(label, detail) { failures += 1; console.log('FAIL - ' + label + (detail ? ': ' + detail : '')); }

let agg = null;
let loadError = null;
try {
  agg = require(AGG_PATH);
  if (!Array.isArray(agg.ALWAYS_PATTERNS) || !Array.isArray(agg.PROSE_PATTERNS)) throw new Error('ALWAYS_PATTERNS or PROSE_PATTERNS missing');
} catch (e) {
  loadError = e && e.message ? e.message : String(e);
}

function arm(label, fn) {
  if (loadError) { fail(label, 'module did not load: ' + loadError); return; }
  try { fn(); } catch (e) { fail(label, 'threw ' + (e && e.message ? e.message : String(e))); }
}

// The adversarial string: a run of local-part characters with dots that
// never reaches an at marker, then the plan's fragments, no match anywhere.
function adversarial(n) {
  const tail = ' aaaa at dot dot';
  let s = '';
  while (s.length < n - tail.length) s += 'a.';
  return (s + tail).slice(0, n);
}

function scanAll(s) {
  const sets = [agg.ALWAYS_PATTERNS, agg.PROSE_PATTERNS];
  let hits = 0;
  const t0 = process.hrtime.bigint();
  for (let k = 0; k < sets.length; k += 1) {
    for (let i = 0; i < sets[k].length; i += 1) {
      if (sets[k][i].test(s)) hits += 1;
    }
  }
  return { ms: Number(process.hrtime.bigint() - t0) / 1e6, hits: hits };
}

function anyAlways(s) {
  for (let i = 0; i < agg.ALWAYS_PATTERNS.length; i += 1) {
    if (agg.ALWAYS_PATTERNS[i].test(s)) return true;
  }
  return false;
}

// ---- E1 ---------------------------------------------------------------------
let ms40k = null;
arm('E1', function () {
  const s = adversarial(40000);
  if (s.length !== 40000) throw new Error('fixture length ' + s.length);
  const r = scanAll(s);
  ms40k = r.ms;
  const seconds = (r.ms / 1000).toFixed(3);
  if (r.hits !== 0) fail('E1', 'the adversarial string matched ' + r.hits + ' pattern(s); it must never complete a match');
  else if (r.ms >= BUDGET_40K_MS) fail('E1', '40,000 characters took ' + seconds + ' s (' + r.ms.toFixed(0) + ' ms), budget ' + BUDGET_40K_MS + ' ms: super-linear email pattern');
  else ok('E1', '40,000 characters scanned in ' + seconds + ' s (' + r.ms.toFixed(0) + ' ms), 0 hits');
});

// ---- E2 ---------------------------------------------------------------------
arm('E2', function () {
  if (ms40k === null || ms40k >= BUDGET_40K_MS) {
    fail('E2', 'not run: the 40,000 character scan is already over budget (quadratic growth would take minutes)');
    return;
  }
  const r = scanAll(adversarial(400000));
  const base = Math.max(ms40k, BASE_FLOOR_MS);
  const limit = base * LINEAR_FACTOR;
  if (r.hits !== 0) fail('E2', 'the 400,000 character string matched ' + r.hits + ' pattern(s)');
  else if (r.ms >= limit) fail('E2', '400,000 characters took ' + r.ms.toFixed(0) + ' ms, limit ' + limit.toFixed(0) + ' ms (' + LINEAR_FACTOR + ' x max(' + ms40k.toFixed(0) + ', ' + BASE_FLOOR_MS + ') ms): not linear');
  else ok('E2', '400,000 characters in ' + r.ms.toFixed(0) + ' ms, limit ' + limit.toFixed(0) + ' ms (linear)');
});

// ---- E3 ---------------------------------------------------------------------
arm('E3', function () {
  const LOCAL = ['alina', 'mor'].join('.');
  const LOCAL2 = ['dov', 'tal'].join('');
  const DOM = ['fake', 'example'].join('-');
  const TLD = 'test';
  const positives = {
    square: LOCAL + ' [at] ' + DOM + ' [dot] ' + TLD,
    round: LOCAL + ' (at) ' + DOM + ' (dot) ' + TLD,
    words: LOCAL2 + ' at fake dot ' + TLD,
    round_real_dot: LOCAL2 + '(at)' + DOM + '.' + TLD,
    upper: (LOCAL + ' [at] ' + DOM + ' [dot] ' + TLD).toUpperCase(),
    upper_words: (LOCAL2 + ' at fake dot ' + TLD).toUpperCase(),
    two_labels: LOCAL2 + ' at fake dot example dot ' + TLD,
    in_sentence: 'please write to ' + LOCAL2 + ' at fake dot ' + TLD + ' about the pilot',
    // Plan 392-09 (carried from 392-04 and 392-05): a gap of 4 to 8 ordinary
    // whitespace characters between the tokens. The normaliser strips format
    // characters but never collapses spaces, so the bound itself must reach.
    wide_gap_words: LOCAL2 + '      at      fake      dot      ' + TLD,
    wide_gap_marker: LOCAL + '     [at]     ' + DOM + '     [dot]     ' + TLD,
    tab_gap_words: LOCAL2 + ' \t\t at \t\t fake \t\t dot \t\t ' + TLD,
  };
  const negatives = [
    'look at the dot com bubble as a teaching case',
    'what happens at the dot com stage of a startup',
    'use the 3 + 2 rule for 30 days',
    'which framework helps when growth is +30% over 12 months',
    'what do I do at scale dot com companies use',
    'the team looks at launch dot com metrics',
    'what is the porter five forces framework',
  ];
  const problems = [];
  Object.keys(positives).forEach(function (k) {
    if (!anyAlways(positives[k])) problems.push('positive ' + k + ' missed');
  });
  negatives.forEach(function (s) {
    if (anyAlways(s)) problems.push('negative matched: ' + JSON.stringify(s).slice(0, 60));
  });
  if (problems.length) fail('E3', problems.join('; '));
  else ok('E3', Object.keys(positives).length + ' positives hit, ' + negatives.length + ' negatives miss');
});

// ---- E4 ---------------------------------------------------------------------
arm('E4', function () {
  const problems = [];
  ['ALWAYS_PATTERNS', 'PROSE_PATTERNS', 'FORBIDDEN_PATTERNS', 'CREDENTIAL_SHAPES'].forEach(function (name) {
    if (!Array.isArray(agg[name])) problems.push(name + ' is not exported as an array');
    else if (!Object.isFrozen(agg[name])) problems.push(name + ' is not frozen');
  });
  const a = agg.ALWAYS_PATTERNS, f = agg.FORBIDDEN_PATTERNS;
  if (a.length >= 2 && f.length >= 2) {
    if (a[a.length - 2] !== f[f.length - 2]) problems.push('the email pattern object differs between ALWAYS_PATTERNS and FORBIDDEN_PATTERNS');
    if (a[a.length - 1] !== f[f.length - 1]) problems.push('the phone pattern object differs between ALWAYS_PATTERNS and FORBIDDEN_PATTERNS');
    if (!(a[a.length - 2] instanceof RegExp)) problems.push('the email entry is not a RegExp');
  }
  const rs = require(RS_PATH);
  if (rs.FORBIDDEN_PATTERNS !== agg.FORBIDDEN_PATTERNS) problems.push('rs-egress-prompts FORBIDDEN_PATTERNS is not the same array');
  if (rs.ALWAYS_PATTERNS !== agg.ALWAYS_PATTERNS) problems.push('rs-egress-prompts ALWAYS_PATTERNS is not the same array');
  if (rs.PROSE_PATTERNS !== agg.PROSE_PATTERNS) problems.push('rs-egress-prompts PROSE_PATTERNS is not the same array');
  if (rs.CREDENTIAL_SHAPES !== agg.CREDENTIAL_SHAPES) problems.push('rs-egress-prompts CREDENTIAL_SHAPES is not the same array');
  if (problems.length) fail('E4', problems.join('; '));
  else ok('E4', 'ALWAYS ' + a.length + ', PROSE ' + agg.PROSE_PATTERNS.length + ', FORBIDDEN ' + f.length + ' patterns; rs-egress-prompts re-exports the same arrays');
});

// ---- E5 ---------------------------------------------------------------------
arm('E5', function () {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 't392el-'));
  try {
    const env = Object.assign({}, process.env, { HOME: home, USERPROFILE: home });
    delete env.PART8_FORCE_BRAIN_AVAILABLE;
    const payload = JSON.stringify({ tool_name: TOOL, tool_input: { question: adversarial(40000) }, session_id: 't392el' });
    const t0 = process.hrtime.bigint();
    const res = spawnSync(process.execPath, [HOOK], { input: payload, encoding: 'utf8', env: env, timeout: 30000 });
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    const killed = res.status === null;
    if (killed) fail('E5', 'the hook did not end inside 30,000 ms (killed), wall ' + ms.toFixed(0) + ' ms');
    else if (ms >= HOOK_BUDGET_MS) fail('E5', 'hook wall time ' + (ms / 1000).toFixed(3) + ' s (' + ms.toFixed(0) + ' ms), budget ' + HOOK_BUDGET_MS + ' ms, exit ' + res.status);
    else ok('E5', 'hook wall time ' + ms.toFixed(0) + ' ms on the 40,000 character payload, exit ' + res.status);
  } finally {
    try { fs.rmSync(home, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
});

if (failures > 0) {
  console.log('\n' + failures + ' arm(s) failed');
  process.exit(1);
}
console.log('\nAll email regex linear arms passed');
