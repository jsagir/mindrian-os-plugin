#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 392 plan 04, bypass 4 (CONTEXT F6 item 4): a paragraph glued with
 * hyphens, underscores or zero width spaces counted as ONE word in
 * lib/core/part8-sprout-shape.cjs (countWords split on whitespace only, no
 * character cap), so a room paragraph passed as a 1-word sprout.
 *
 * Arms:
 *   G1 a 40-word paragraph joined by hyphens is not a sprout
 *   G2 the same paragraph joined by underscores is not a sprout
 *   G3 the same paragraph joined by U+200B (zero width space) is not a sprout
 *   G4 one token of 81 characters is not a sprout (WORD_MAX_CHARS 80), and
 *      carries reason word_too_long; a 79 character token keeps its class
 *   G5 12 short words of 241 characters in total are not a sprout
 *      (STRING_MAX_CHARS 240), reason string_too_long; 12 words under 240
 *      characters stay a sprout
 *   G6 the caps are exported named constants
 *   G7 every case of tests/test-386-sprout-body-shape.cjs keeps its kind
 *      (that test runs in-process and must exit 0)
 *
 * Every string is invented and built at run time (synthetic terms, no room
 * word, no room file name, no Brain identifier). No network. No em dash or
 * en dash.
 */

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'lib', 'core', 'part8-sprout-shape.cjs');

let failures = 0;
function ok(label, detail) { console.log('ok - ' + label + (detail ? ' ' + detail : '')); }
function fail(label, detail) { failures += 1; console.log('FAIL - ' + label + (detail ? ': ' + detail : '')); }

let mod = null;
let loadError = null;
try {
  mod = require(MODULE_PATH);
  if (typeof mod.classifyShape !== 'function') throw new Error('classifyShape is not a function');
} catch (e) {
  loadError = e && e.message ? e.message : String(e);
}

function arm(label, fn) {
  if (loadError) { fail(label, 'module did not load: ' + loadError); return; }
  try { fn(); } catch (e) { fail(label, 'threw ' + (e && e.message ? e.message : String(e))); }
}

// 40 invented terms, about 300 characters when joined by one joiner.
function terms(n) {
  const w = [];
  for (let i = 0; i < n; i += 1) w.push('glued' + String.fromCharCode(97 + (i % 26)) + (i % 7));
  return w;
}
const ZWSP = String.fromCharCode(0x200b);

function gluedArm(label, joiner, joinerName) {
  arm(label, function () {
    const text = terms(40).join(joiner);
    if (text.length < 240) throw new Error('fixture too short: ' + text.length);
    const r = mod.classifyShape(text);
    if (r.kind === 'sprout') {
      fail(label, 'glued paragraph counted as one word (' + joinerName + ' join, ' + text.length + ' characters, words=' + r.words + ', kind=sprout)');
    } else {
      ok(label, joinerName + ' join of 40 terms is ' + r.kind + ' (words=' + r.words + (r.reason ? ', reason=' + r.reason : '') + ')');
    }
  });
}

// ---- G1 to G3 ---------------------------------------------------------------
gluedArm('G1', '-', 'hyphen');
gluedArm('G2', '_', 'underscore');
gluedArm('G3', ZWSP, 'U+200B');

// ---- G4 ---------------------------------------------------------------------
arm('G4', function () {
  const problems = [];
  const long81 = 'x'.repeat(81);
  const r81 = mod.classifyShape(long81);
  if (r81.kind === 'sprout') problems.push('an 81 character token is a sprout');
  if (r81.reason !== 'word_too_long') problems.push('81 character token reason is ' + JSON.stringify(r81.reason) + ', expected word_too_long');
  const inSentence = mod.classifyShape('which framework fits ' + long81 + ' pricing');
  if (inSentence.kind === 'sprout') problems.push('a sprout that holds an 81 character token is still a sprout');
  if (inSentence.reason !== 'word_too_long') problems.push('sentence with the long token has reason ' + JSON.stringify(inSentence.reason));
  const r79 = mod.classifyShape('x'.repeat(79));
  if (r79.kind !== 'sprout') problems.push('a 79 character token is ' + r79.kind + ', expected sprout (one word, no cap)');
  if (r79.reason) problems.push('a 79 character token carries reason ' + r79.reason);
  const r80 = mod.classifyShape('x'.repeat(80));
  if (r80.kind !== 'sprout') problems.push('an 80 character token is ' + r80.kind + ', expected sprout (at the cap)');
  if (problems.length) fail('G4', problems.join('; '));
  else ok('G4', '81 characters not sprout (word_too_long); 79 and 80 characters sprout');
});

// ---- G5 ---------------------------------------------------------------------
arm('G5', function () {
  const problems = [];
  // 12 words of 20 characters plus 11 spaces = 251 characters; trim to 241.
  const twelve = [];
  for (let i = 0; i < 12; i += 1) twelve.push(('cap' + String.fromCharCode(97 + i)).padEnd(20, 'z'));
  let s241 = twelve.join(' ');
  s241 = s241.slice(0, 241);
  if (s241.length !== 241) throw new Error('fixture length ' + s241.length);
  const r241 = mod.classifyShape(s241);
  if (r241.words !== 12) problems.push('241 character fixture counts ' + r241.words + ' words, expected 12');
  if (r241.kind === 'sprout') problems.push('12 words of 241 characters are a sprout');
  if (r241.reason !== 'string_too_long') problems.push('241 character string reason is ' + JSON.stringify(r241.reason) + ', expected string_too_long');
  const s239 = s241.slice(0, 239);
  const r239 = mod.classifyShape(s239);
  if (r239.kind !== 'sprout') problems.push('12 words of 239 characters are ' + r239.kind + ', expected sprout');
  if (r239.reason) problems.push('239 character string carries reason ' + r239.reason);
  const r240 = mod.classifyShape(s241.slice(0, 240));
  if (r240.kind !== 'sprout') problems.push('12 words of 240 characters are ' + r240.kind + ', expected sprout (at the cap)');
  if (problems.length) fail('G5', problems.join('; '));
  else ok('G5', '241 characters not sprout (string_too_long); 239 and 240 characters sprout');
});

// ---- G6 ---------------------------------------------------------------------
arm('G6', function () {
  const problems = [];
  if (mod.WORD_MAX_CHARS !== 80) problems.push('WORD_MAX_CHARS is ' + mod.WORD_MAX_CHARS + ', expected 80');
  if (typeof mod.STRING_MAX_CHARS !== 'number' || mod.STRING_MAX_CHARS < 240 || mod.STRING_MAX_CHARS > 320) {
    problems.push('STRING_MAX_CHARS is ' + mod.STRING_MAX_CHARS + ', expected 240 to 320');
  }
  if (mod.SPROUT_MAX_WORDS !== 12) problems.push('SPROUT_MAX_WORDS changed to ' + mod.SPROUT_MAX_WORDS);
  if (problems.length) fail('G6', problems.join('; '));
  else ok('G6', 'WORD_MAX_CHARS ' + mod.WORD_MAX_CHARS + ', STRING_MAX_CHARS ' + mod.STRING_MAX_CHARS + ', SPROUT_MAX_WORDS ' + mod.SPROUT_MAX_WORDS);
});

// ---- G7 ---------------------------------------------------------------------
arm('G7', function () {
  const res = spawnSync(process.execPath, [path.join(__dirname, 'test-386-sprout-body-shape.cjs')], { encoding: 'utf8', timeout: 60000 });
  if (res.status !== 0) {
    const lines = String(res.stdout || '').split('\n').filter(function (l) { return l.indexOf('FAIL') === 0; });
    fail('G7', 'test-386-sprout-body-shape.cjs exit ' + res.status + ': ' + lines.join(' | ').slice(0, 300));
  } else {
    ok('G7', 'test-386-sprout-body-shape.cjs exit 0 (every existing case keeps its kind)');
  }
});

if (failures > 0) {
  console.log('\n' + failures + ' arm(s) failed');
  process.exit(1);
}
console.log('\nAll bypass 4 glued paragraph arms passed');
