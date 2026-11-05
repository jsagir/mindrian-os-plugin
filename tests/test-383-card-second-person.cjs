#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 383 Plan 02 Task 2 (QA383-07). Wave 0, RED-first.
 *
 * Static card copy and menus speak to the person ("you", "your"), never about them ("the navigator",
 * "the user", "the founder"). Plan 07 adds the detector findThirdPersonNavigator to
 * lib/hmi/larry-reply-checks.cjs and fixes the strings.
 *
 *   C1  findThirdPersonNavigator is exported (RED)
 *   C2  MODE_MENU and the cold-start context line do not say `the navigator starts talking` (RED)
 *   C3  no static card string holds the third-person pattern (GREEN at HEAD per RESEARCH; a hit is a finding)
 *   C4  agents/larry-extended.md holds `to the navigator as you` (RED)
 *   C5  the detector separates second person from third person (PENDING until C1 can run)
 *
 * Static card strings: (a) header, label and description single-quoted literals of
 * lib/mcp/startup-operations.cjs; (b) the MODE_MENU value and the cold-start context line of
 * scripts/session-start; (c) on each `Options:` line of the commands and the skills (SKILL.md files), every
 * backtick span and the text after `description:` up to the next `)`.
 *
 * Hermetic: HOME and the rooms variables point into one mkdtemp dir. Nothing is written.
 * Output: PASS, FAIL or PENDING lines, then PASS: n FAIL: n PENDING: n. House rule: hyphens only.
 */

const fs = require('node:fs');
const path = require('node:path');

const H = require('./helpers/harness-383.cjs');
const { env } = H.hermeticEnv('cardsecond');
H.applyEnv(env);

const ROOT = path.resolve(__dirname, '..');
const R = H.reporter('test-383-card-second-person');
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

const checks = require(path.join(ROOT, 'lib', 'hmi', 'larry-reply-checks.cjs'));
const THIRD = /\bthe (?:navigator|user|founder)(?:'s)?\b/i;

// ---- collect the static strings: [{ file, line, text }]
const cardStrings = [];

(function collectA() {
  const rel = 'lib/mcp/startup-operations.cjs';
  const lines = read(rel).split('\n');
  const re = /\b(?:header|label|description):\s*'((?:[^'\\]|\\.)*)'/g;
  lines.forEach(function (l, i) {
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(l)) !== null) cardStrings.push({ file: rel, line: i + 1, text: m[1] });
  });
})();

(function collectC() {
  const files = [];
  const cmdDir = path.join(ROOT, 'commands');
  for (const f of fs.readdirSync(cmdDir)) if (f.endsWith('.md')) files.push('commands/' + f);
  const skDir = path.join(ROOT, 'skills');
  for (const d of fs.readdirSync(skDir)) {
    if (fs.existsSync(path.join(skDir, d, 'SKILL.md'))) files.push('skills/' + d + '/SKILL.md');
  }
  for (const rel of files) {
    read(rel).split('\n').forEach(function (l, i) {
      if (l.indexOf('Options:') === -1) return;
      let m;
      const spans = /`([^`]+)`/g;
      while ((m = spans.exec(l)) !== null) cardStrings.push({ file: rel, line: i + 1, text: m[1] });
      const d = /description:\s*([^)]*)\)/g;
      while ((m = d.exec(l)) !== null) cardStrings.push({ file: rel, line: i + 1, text: m[1] });
    });
  }
})();

// (b) MODE_MENU value and the cold-start context line
const ssLines = read('scripts/session-start').split('\n');
const menuIdx = ssLines.findIndex(function (l) { return /^\s*MODE_MENU="/.test(l); });
const menuLine = menuIdx >= 0 ? ssLines[menuIdx] : '';
const ctxLine = menuIdx >= 0 ? (ssLines.slice(menuIdx + 1).find(function (l) { return /^\s*context="/.test(l); }) || '') : '';

// ---- C1
const hasDetector = typeof checks.findThirdPersonNavigator === 'function';
if (hasDetector) R.pass('C1 findThirdPersonNavigator is exported');
else R.fail('C1 findThirdPersonNavigator is exported', 'lib/hmi/larry-reply-checks.cjs exports no findThirdPersonNavigator (plan 07 adds it)');

// ---- C2
(function () {
  const phrase = 'the navigator starts talking';
  const faults = [];
  if (!menuLine) faults.push('MODE_MENU line not found');
  if (!ctxLine) faults.push('cold-start context line not found');
  if (menuLine.indexOf(phrase) !== -1) faults.push('MODE_MENU still says `' + phrase + '`');
  if (ctxLine.indexOf(phrase) !== -1) faults.push('cold-start context line still says `' + phrase + '`');
  if (faults.length === 0) R.pass('C2 MODE_MENU and the cold-start line speak to the person');
  else R.fail('C2 MODE_MENU and the cold-start line speak to the person', faults.join('; '));
})();

// ---- C3
(function () {
  const hits = cardStrings.filter(function (s) { return THIRD.test(s.text); });
  console.log('C3 scanned ' + cardStrings.length + ' static card strings');
  if (hits.length === 0) { R.pass('C3 no static card string speaks about the person in the third person'); return; }
  hits.forEach(function (s) { console.log('  HIT ' + s.file + ':' + s.line + ' | ' + s.text.slice(0, 100)); });
  R.fail('C3 no static card string speaks about the person in the third person', hits.length + ' hit(s)');
})();

// ---- C4
(function () {
  const t = read('agents/larry-extended.md');
  if (t.indexOf('to the navigator as you') !== -1) R.pass('C4 larry-extended says to address the navigator as you');
  else R.fail('C4 larry-extended says to address the navigator as you', 'phrase `to the navigator as you` absent from agents/larry-extended.md');
})();

// ---- C5
(function () {
  if (!hasDetector) { R.pending('C5 detector separates second and third person', 'waits for C1: findThirdPersonNavigator is not exported yet'); return; }
  const good = checks.findThirdPersonNavigator('Approve and create your room');
  const bad = checks.findThirdPersonNavigator('Let the navigator decide');
  if (good && good.ok === true && bad && bad.ok === false) R.pass('C5 detector separates second and third person');
  else R.fail('C5 detector separates second and third person', 'second person ok=' + (good && good.ok) + ' (want true); third person ok=' + (bad && bad.ok) + ' (want false)');
})();

R.done();
