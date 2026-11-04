#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 369.6 Plan 04 Task 1 (NS369.6-03; L4 tests 4 and 5; D-06, D-11). The Phase 114 rubric agrees with the glyph.
 *
 * WHY: the Phase 114 rubric and its live test said "no emoji" and required a signature opener, so a correct reply
 * (one leading voice glyph, the label, the identity sentence) failed the only live voice test. This guard keeps
 * the fixture and the shell test in step with the glyph mandate of Canon Part 12.
 *
 *   G1  the fixture no longer says "No emoji" without the glyph carve-out (criterion 4 names the leading glyph)
 *   G2  the fixture criterion 3 names the leading glyph, the label and the identity sentence, and no longer lists
 *       signature openers as the required prefix
 *   G3  the shell test rubric 3 no longer requires a signature opener prefix and checks the label
 *   G4  the shell test rubric 4 names the glyph allowance and reads MARK_GLYPHS
 *   G5  the shell test identity pattern accepts both spellings (PWS and PwS) and the optional model clause
 *   G6  LARRY_VOICE_REQUIRE_LIVE=1 with a skipped live run exits non-zero
 *   G7  the same skip without the variable exits 0
 *   G8  no em dash or en dash in this file
 *
 * G6 and G7 run the shell test with MINDRIAN_SKIP_LIVE_CLAUDE=1 and an isolated HOME, so no live call occurs.
 *
 * Read-only. Hermetic: HOME, MINDRIAN_HOME, MINDRIAN_ROOMS_HOME, MINDRIAN_ROOMS_ROOT and CLAUDE_CONFIG_DIR are
 * mkdtemp dirs before any repo require; a net guard counts any fetch.
 *
 * Output: one PASS or FAIL line per leg, then PASS: n FAIL: n. Exit 0 when no leg fails.
 * House rule: hyphens only.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const HOME_TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'test-3696-rubricglyph-'));
['HOME', 'MINDRIAN_HOME', 'MINDRIAN_ROOMS_HOME', 'MINDRIAN_ROOMS_ROOT', 'CLAUDE_CONFIG_DIR'].forEach(function (k) {
  const d = path.join(HOME_TMP, k.toLowerCase());
  fs.mkdirSync(d, { recursive: true });
  process.env[k] = d;
});
process.env.USERPROFILE = process.env.HOME;

const { installNetGuard, makeChecker } = require('./helpers/hygiene-355.cjs');
const NET = installNetGuard();
const { check, summary } = makeChecker('test-3696-rubric-glyph-consistency');

const ROOT = path.resolve(__dirname, '..');
const FIXTURE = 'tests/fixtures/114-larry-voice-rubric.md';
const SHELL = 'tests/test-114-turn-1-voice.sh';
const fixture = fs.readFileSync(path.join(ROOT, FIXTURE), 'utf8');
const shell = fs.readFileSync(path.join(ROOT, SHELL), 'utf8');

// The text of one numbered criterion in the fixture: from "N. **" to the next numbered criterion or heading.
function criterion(n) {
  const re = new RegExp('^' + n + '\\. \\*\\*[\\s\\S]*?(?=^\\d+\\. \\*\\*|^### |^## )', 'm');
  const m = re.exec(fixture);
  return m ? m[0] : '';
}
// The shell block of one rubric criterion: from its comment line to the next "# Rubric criterion" comment.
function shellBlock(n) {
  const start = shell.indexOf('# Rubric criterion ' + n);
  if (start === -1) return '';
  const next = shell.indexOf('# Rubric criterion ', start + 10);
  return shell.slice(start, next === -1 ? shell.length : next);
}

const c3 = criterion(3);
const c4 = criterion(4);

check('G1 fixture criterion 4 carries the glyph carve-out and no bare "No emoji"',
  /leading/i.test(c4) && /MARK_GLYPHS/.test(c4) && !/\*\*No emoji\.\*\*/.test(c4), c4 ? '' : 'criterion 4 not found');

check('G2 fixture criterion 3 names the glyph, the label and the identity sentence',
  /glyph/i.test(c3) && /Larry \| MindrianOS/.test(c3) && /identity sentence/i.test(c3) && !/Very simply/.test(c3),
  c3 ? '' : 'criterion 3 not found');

const s3 = shellBlock(3);
check('G3 shell rubric 3 checks the label and no longer requires a signature opener prefix',
  s3.length > 0 && /Larry \| MindrianOS/.test(s3) && !/signature opener prefix/i.test(shell) && !/Very simply/.test(s3), s3 ? '' : 'rubric 3 block not found');

const s4 = shellBlock(4);
check('G4 shell rubric 4 names the glyph allowance and reads MARK_GLYPHS',
  s4.length > 0 && /glyph/i.test(s4) && /MARK_GLYPHS/.test(shell) && /voice-color-mark\.cjs/.test(shell), s4 ? '' : 'rubric 4 block not found');

check('G5 shell identity pattern accepts PWS and PwS and the optional model clause',
  /\(PWS\|PwS\)/.test(s3) && /powered by Claude\)\?/.test(s3), '');

function runShell(extraEnv) {
  const env = {};
  ['PATH', 'LANG', 'LC_ALL', 'TMPDIR'].forEach(function (k) { if (process.env[k]) env[k] = process.env[k]; });
  env.HOME = process.env.HOME;
  env.MINDRIAN_SKIP_LIVE_CLAUDE = '1';
  Object.keys(extraEnv).forEach(function (k) { env[k] = extraEnv[k]; });
  return cp.spawnSync('bash', [path.join(ROOT, SHELL)], { cwd: ROOT, env: env, encoding: 'utf8', timeout: 60000 });
}

const required = runShell({ LARRY_VOICE_REQUIRE_LIVE: '1' });
check('G6 LARRY_VOICE_REQUIRE_LIVE=1 with a skipped live run exits non-zero', required.status !== 0 && required.status !== null,
  'exit ' + required.status);

const optional = runShell({});
check('G7 the same skip without the variable exits 0', optional.status === 0, 'exit ' + optional.status);

(function () {
  const self = fs.readFileSync(__filename, 'utf8');
  const bad = [String.fromCharCode(0x2014), String.fromCharCode(0x2013)].filter(function (c) { return self.indexOf(c) !== -1; });
  check('G8 no em dash or en dash in this file', bad.length === 0, bad.length ? 'found' : '');
})();

check('no network call was attempted', NET.attempts() === 0);
process.exit(summary());
