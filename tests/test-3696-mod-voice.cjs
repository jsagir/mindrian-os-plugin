#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 369.6 Plan 04 Task 2 (D-48; R-24). The panel thought pool runs through the same offline reply checks as Larry.
 *
 * WHAT: ui/mos-face/hooks/voice.ts holds the lines the /m:os panel says as Theo: THOUGHTS (a pool for each face),
 * THEO_CALL_THOUGHTS, THEO_EMPTY and THEO_FAILED. Each line is run through four checks of lib/hmi/larry-reply-checks.cjs,
 * the same module Larry's replies pass:
 *   dash        findDashes          (hyphens only: no em dash, no en dash, no spaced double hyphen)
 *   number      findUnsourcedNumber (no figure without a source)
 *   questions   countQuestions      (at most one question; "X, and Y?" counts two)
 *   never_say   findMachineryNarration and findBannedPhrases (the never-say list; the name Theo is allowed, R-20)
 *
 * No mod source line changes in this phase (D-48). A line that fails today is a frozen KNOWN entry below: the exact
 * line text, the failing check names and the route. The route is a quick task on voice.ts, owned outside this phase.
 *
 *   V1  voice.ts imports natively (type imports only) and the four arrays are non-empty; an import failure is a FAIL
 *       with the reason, never a skip
 *   V2  every line passes the four checks, or is a KNOWN entry whose failing check names equal the recorded ones
 *   V3  every KNOWN entry still fails: a KNOWN line that now passes fails the test ("remove the entry")
 *   V4  every KNOWN entry names a line that exists in voice.ts (an entry never outlives its line)
 *   V5  no em dash or en dash in this file
 *
 * Read-only. The mod file is imported in this test process only. Hermetic: HOME, MINDRIAN_HOME, MINDRIAN_ROOMS_HOME,
 * MINDRIAN_ROOMS_ROOT and CLAUDE_CONFIG_DIR are mkdtemp dirs before any repo require; a net guard counts any fetch.
 *
 * Output: the count of checked lines per array, every KNOWN entry with its route, then PASS: n FAIL: n.
 * House rule: hyphens only.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const HOME_TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'test-3696-modvoice-'));
['HOME', 'MINDRIAN_HOME', 'MINDRIAN_ROOMS_HOME', 'MINDRIAN_ROOMS_ROOT', 'CLAUDE_CONFIG_DIR'].forEach(function (k) {
  const d = path.join(HOME_TMP, k.toLowerCase());
  fs.mkdirSync(d, { recursive: true });
  process.env[k] = d;
});
process.env.USERPROFILE = process.env.HOME;

const { installNetGuard, makeChecker } = require('./helpers/hygiene-355.cjs');
const NET = installNetGuard();
const { check, summary } = makeChecker('test-3696-mod-voice');
const R = require('../lib/hmi/larry-reply-checks.cjs');

const ROOT = path.resolve(__dirname, '..');
const VOICE = 'ui/mos-face/hooks/voice.ts';
const ROUTE = 'a /gsd-quick on ui/mos-face/hooks/voice.ts (D-48): split the line into one question';

// Frozen at the plan 04 commit. Each entry is the exact line text and the names of the checks it fails.
// Never add an entry for a new failing line: fix the line in the quick task. Remove an entry when its line passes.
const KNOWN_LINES = Object.freeze([
  { line: 'Who is this for, and what progress do they want?', fails: ['questions'], route: ROUTE },
  { line: 'What do you already know, and what are you guessing?', fails: ['questions'], route: ROUTE },
  { line: 'Which part of this is a fact, and which part a hope?', fails: ['questions'], route: ROUTE },
  { line: 'Looking. What do I know, and what am I only assuming?', fails: ['questions'], route: ROUTE },
  { line: 'Which claim here carries the most weight, and what holds it up?', fails: ['questions'], route: ROUTE },
  { line: 'What would make you say yes, and what would make you say no?', fails: ['questions'], route: ROUTE },
]);

// The failing check names of one line, in a fixed order.
function failingChecks(line) {
  const out = [];
  if (!R.findDashes(line).ok) out.push('dash');
  if (!R.findUnsourcedNumber(line, { userText: '' }).ok) out.push('number');
  if (R.countQuestions(line) > 1) out.push('questions');
  if (!R.findMachineryNarration(line, { userText: '' }).ok || !R.findBannedPhrases(line).ok) out.push('never_say');
  return out;
}

async function main() {
  // V1: a native dynamic import; voice.ts holds type imports only, so Node strips them.
  let mod = null;
  let importError = '';
  try {
    mod = await import(pathToFileURL(path.join(ROOT, VOICE)).href);
  } catch (err) {
    importError = err && err.message ? err.message : String(err);
  }
  check('V1 voice.ts imports natively', mod !== null, importError);

  const pools = {};
  if (mod) {
    Object.keys(mod.THOUGHTS || {}).forEach(function (face) { pools['THOUGHTS.' + face] = mod.THOUGHTS[face]; });
    pools.THEO_CALL_THOUGHTS = mod.THEO_CALL_THOUGHTS;
    pools.THEO_EMPTY = mod.THEO_EMPTY;
    pools.THEO_FAILED = mod.THEO_FAILED;
  }
  const names = Object.keys(pools);
  const fourPresent = mod !== null && Array.isArray(mod.THEO_CALL_THOUGHTS) && Array.isArray(mod.THEO_EMPTY)
    && Array.isArray(mod.THEO_FAILED) && Object.keys(mod.THOUGHTS || {}).length > 0;
  check('V1 the four arrays exist (THOUGHTS, THEO_CALL_THOUGHTS, THEO_EMPTY, THEO_FAILED)', fourPresent, '');
  names.forEach(function (n) {
    check('V1 ' + n + ' is a non-empty array of strings',
      Array.isArray(pools[n]) && pools[n].length > 0 && pools[n].every(function (l) { return typeof l === 'string' && l.length > 0; }),
      'length ' + (Array.isArray(pools[n]) ? pools[n].length : 'n/a'));
  });

  // V2 and V3
  const known = new Map(KNOWN_LINES.map(function (k) { return [k.line, k]; }));
  const seenKnown = new Set();
  let total = 0;
  const perArray = {};
  names.forEach(function (n) {
    const arr = Array.isArray(pools[n]) ? pools[n] : [];
    perArray[n] = arr.length;
    arr.forEach(function (line) {
      total += 1;
      const failed = failingChecks(line);
      const k = known.get(line);
      if (!k) {
        check('V2 ' + n + ': ' + line, failed.length === 0, 'fails ' + failed.join(', ') + ' (a new failing line is fixed in voice.ts, not listed)');
        return;
      }
      seenKnown.add(line);
      if (failed.length === 0) {
        check('V3 KNOWN line now passes: remove the entry: ' + line, false, '');
      } else {
        check('V3 KNOWN line still fails exactly as recorded: ' + line, failed.join(',') === k.fails.join(','),
          'recorded ' + k.fails.join(',') + ', now ' + failed.join(','));
      }
    });
  });
  KNOWN_LINES.forEach(function (k) {
    check('V4 KNOWN entry names a line that exists in voice.ts: ' + k.line, seenKnown.has(k.line), 'not found in any pool');
  });

  console.log('--- checked lines per array ---');
  names.forEach(function (n) { console.log('checked ' + perArray[n] + ' lines: ' + n); });
  console.log('checked ' + total + ' lines in total through findDashes, findUnsourcedNumber, countQuestions, findMachineryNarration and findBannedPhrases');
  console.log('--- KNOWN entries (' + KNOWN_LINES.length + ') ---');
  KNOWN_LINES.forEach(function (k) {
    console.log('KNOWN [' + k.fails.join(',') + '] "' + k.line + '" -> route: ' + k.route);
  });

  const self = fs.readFileSync(__filename, 'utf8');
  const bad = [String.fromCharCode(0x2014), String.fromCharCode(0x2013)].filter(function (c) { return self.indexOf(c) !== -1; });
  check('V5 no em dash or en dash in this file', bad.length === 0, bad.length ? 'found' : '');
  check('no network call was attempted', NET.attempts() === 0);
  process.exit(summary());
}

main().catch(function (err) {
  console.log('FAIL: test crashed (' + (err && err.stack ? err.stack : String(err)) + ')');
  process.exit(1);
});
