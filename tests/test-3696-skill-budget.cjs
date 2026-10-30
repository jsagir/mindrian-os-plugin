#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 369.6 Plan 03 Task 3 (NS369.6-10; D-04, D-17, D-21). The larry-personality skill budget guard.
 * Every number is measured by the plan 01 functions of scripts/measure-larry-voice.cjs. This file holds no second
 * counter. The base numbers come from the immutable base snapshot tests/fixtures/3696-persona-h/SKILL.md and the
 * budgets are computed from them in code.
 *
 *   S0   the base snapshot is 73369 B and its machinery share is 72.0 percent (L2)                   (required now)
 *   S1   SKILL.md at most 40 percent of the base size, which is 29347 B (D-04)                       (required, 369.6-10 Task 2)
 *   S2   loose machinery share at most 15 percent (D-04)                                             (required, 369.6-10 Task 2)
 *   S3   the frontmatter is byte-identical to the base frontmatter                                   (required now)
 *   S4   the heading "## The Three Directions of Elevation (Part 12)" is present                     (required now)
 *   S5   the three references exist and are named under "## References" (D-04)                       (required, 369.6-10 Task 2)
 *   S6   the item-5 line is present exactly once and byte-identical to the base                      (required now)
 *   S7   the trigger words for deep research, Eureka, Dominant Design and contradiction are present
 *        outside the References section (the WHEN-to-reach triggers stay inline)                     (required now)
 *   S8   no Provoked every-3-to-5-turns cadence in SKILL.md or references/personality/onboarding.md  (required since 369.6-11 Task 2)
 *   S9   no em dash or en dash in this file
 *
 * Printed on every run: SKILL.md bytes and the loose voice, brand, machinery and operation shares.
 *
 * KNOWN table (the KNOWN rule of this phase). A KNOWN leg that fails prints "KNOWN <leg> closes in <plan>" and does
 * not fail the test. A KNOWN leg that passes FAILS the test: flip it to required. Transition rule (Codex C6): the task
 * whose change makes a KNOWN leg pass flips it to required in the same commit, whichever plan the table names, and
 * its SUMMARY records "KNOWN moved: <leg>, owner <plan>, closed by <plan> Task <n>".
 *
 * Read-only. Hermetic: HOME, MINDRIAN_HOME, MINDRIAN_ROOMS_HOME, MINDRIAN_ROOMS_ROOT and CLAUDE_CONFIG_DIR are mkdtemp
 * dirs before any repo require; a net guard counts any fetch.
 *
 * Output: one PASS, FAIL or KNOWN line per leg, then PASS: n FAIL: n. Exit 0 when no required leg fails.
 * House rule: hyphens only.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const HOME_TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'test-3696-skillbudget-'));
['HOME', 'MINDRIAN_HOME', 'MINDRIAN_ROOMS_HOME', 'MINDRIAN_ROOMS_ROOT', 'CLAUDE_CONFIG_DIR'].forEach(function (k) {
  const d = path.join(HOME_TMP, k.toLowerCase());
  fs.mkdirSync(d, { recursive: true });
  process.env[k] = d;
});
process.env.USERPROFILE = process.env.HOME;

const { installNetGuard, makeChecker } = require('./helpers/hygiene-355.cjs');
const NET = installNetGuard();
const { check, summary } = makeChecker('test-3696-skill-budget');

const ROOT = path.resolve(__dirname, '..');
const M = require(path.join(ROOT, 'scripts', 'measure-larry-voice.cjs'));

const SKILL = 'skills/larry-personality/SKILL.md';
const REF_DIR = 'references/personality';
const REFS = ['reach-and-dial.md', 'memory-and-findings.md', 'onboarding.md'];
const ITEM5_PREFIX = '5. Never hand-draw the dial glyphs';

const live = fs.readFileSync(path.join(ROOT, SKILL), 'utf8');
const base = fs.readFileSync(path.join(__dirname, 'fixtures', '3696-persona-h', 'SKILL.md'), 'utf8');

const BASE_BYTES = Buffer.byteLength(base, 'utf8');
const SIZE_MAX = Math.floor(0.4 * BASE_BYTES);
const MACHINERY_MAX = 15;

// 369.6-10 Task 2: S1, S2 and S5 are required now (the operator manual moved to three references; SKILL.md is inside the D-04 budget).
// 369.6-11 Task 2 (2026-10-30): S8 is required now (the Provoked cadence is retired from onboarding.md), closed by 369.6-11 Task 2.
const KNOWN = {
};
let knownCount = 0;
function leg(id, name, passes, detail) {
  const k = KNOWN[id];
  const label = id + ' ' + name;
  if (!k) return check(label, passes, detail);
  if (passes) return check(label + ': KNOWN ' + id + ' now passes: flip it to required', false, k.why);
  knownCount += 1;
  console.log('KNOWN ' + id + ' closes in ' + k.closes_in + ': ' + name + ' (' + k.why + (detail ? '; ' + detail : '') + ')');
  return true;
}

function frontmatterOf(text) {
  const p = text.split('\n');
  if (p[0] !== '---') return '';
  const e = p.indexOf('---', 1);
  return e === -1 ? '' : p.slice(0, e + 1).join('\n');
}
// The text of the level-2 section that starts with the prefix, to the line before the next level-2 heading or the end.
function section(text, prefix) {
  const lines = text.split('\n');
  const start = lines.findIndex(function (ln) { return ln.indexOf('## ' + prefix) === 0; });
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) { if (/^## /.test(lines[i])) { end = i; break; } }
  return { start: start, end: end, text: lines.slice(start, end).join('\n') };
}

// ---- measurements printed on every run ------------------------------------------------------------------------
const bytes = Buffer.byteLength(live, 'utf8');
const loose = M.measureFile(live, { agent: false });
console.log('MEASURE ' + SKILL + ': ' + bytes + ' B (max ' + SIZE_MAX + ')');
console.log('MEASURE loose shares: voice ' + loose.share.voice + ' / brand ' + loose.share.brand + ' / machinery ' + loose.share.machinery + ' (max ' + MACHINERY_MAX + ') / operation ' + loose.share.operation);

check('S0 the base snapshot is 73369 B and its machinery share is 72.0 percent (L2)', BASE_BYTES === 73369 && M.measureFile(base, { agent: false }).share.machinery === 72,
  'bytes ' + BASE_BYTES + ', machinery ' + M.measureFile(base, { agent: false }).share.machinery);
leg('S1', 'SKILL.md at most ' + SIZE_MAX + ' B (40 percent of ' + BASE_BYTES + ' B)', bytes <= SIZE_MAX, 'bytes ' + bytes);
leg('S2', 'loose machinery share at most ' + MACHINERY_MAX + ' percent', loose.share.machinery <= MACHINERY_MAX, 'share ' + loose.share.machinery);
check('S3 the frontmatter is byte-identical to the base frontmatter', frontmatterOf(live) !== '' && frontmatterOf(live) === frontmatterOf(base));
check('S4 the heading "## The Three Directions of Elevation (Part 12)" is present', live.split('\n').indexOf('## The Three Directions of Elevation (Part 12)') !== -1);
{
  const refSec = section(live, 'References');
  const missingFiles = REFS.filter(function (r) { return !fs.existsSync(path.join(ROOT, REF_DIR, r)); });
  const unnamed = REFS.filter(function (r) { return !refSec || refSec.text.indexOf(r) === -1; });
  leg('S5', 'the three references exist and are named under "## References"', missingFiles.length === 0 && unnamed.length === 0,
    'missing files: ' + missingFiles.length + ', unnamed: ' + unnamed.length);
}
{
  const l = live.split('\n').filter(function (x) { return x.indexOf(ITEM5_PREFIX) === 0; });
  const b = base.split('\n').filter(function (x) { return x.indexOf(ITEM5_PREFIX) === 0; });
  check('S6 the item-5 line is present exactly once and byte-identical to the base', l.length === 1 && b.length === 1 && l[0] === b[0], 'live ' + l.length + ', base ' + b.length);
}
{
  const refSec = section(live, 'References');
  const outside = refSec ? live.split('\n').slice(0, refSec.start).concat(live.split('\n').slice(refSec.end)).join('\n') : live;
  // Eureka is matched without regard to case: the base text writes it as "eureka" (the eureka_bridge reach), never capitalised.
  const triggers = [['deep research', /deep research/i], ['Eureka', /eureka/i], ['Dominant Design', /Dominant Design/], ['contradiction', /contradiction/i]];
  const lost = triggers.filter(function (t) { return !t[1].test(outside); }).map(function (t) { return t[0]; });
  check('S7 the reach trigger words (deep research, Eureka, Dominant Design, contradiction) are present outside the References section', lost.length === 0, 'lost: ' + lost.join(', '));
}
{
  const CADENCE = /Every 3-5 Turns|every 3[- ]to[- ]5 turns|every 3-5 turns/i;
  const onboarding = path.join(ROOT, REF_DIR, 'onboarding.md');
  const hits = [];
  if (CADENCE.test(live)) hits.push(SKILL);
  if (fs.existsSync(onboarding) && CADENCE.test(fs.readFileSync(onboarding, 'utf8'))) hits.push(REF_DIR + '/onboarding.md');
  leg('S8', 'no Provoked every-3-to-5-turns cadence in SKILL.md or onboarding.md', hits.length === 0, 'found in: ' + hits.join(', '));
}
{
  const own = fs.readFileSync(__filename, 'utf8');
  check('S9 no em dash or en dash in this file', own.indexOf(String.fromCharCode(0x2014)) === -1 && own.indexOf(String.fromCharCode(0x2013)) === -1);
}
check('no network call was attempted', NET.attempts() === 0);
console.log('KNOWN legs: ' + knownCount);
process.exit(summary());
