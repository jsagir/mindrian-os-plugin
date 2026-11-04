#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 369.6 Plan 04 Task 1 (NS369.6-03; L4 test 3). The doctrine presence guard.
 *
 * WHAT: the load-bearing voice strings of the Larry agent body and of references/personality/voice-dna.md
 * are held in the PHRASES map below, {phrase: [allowed files]}. A phrase passes when it appears in at least
 * one of its allowed files. The phrases were chosen to survive the planned edits of plans 07 to 11; they are
 * the words the voice stands on (the Cardinal Sin, the reframe, the never-say list, the sentence band).
 *
 * HOW TO CHANGE IT: a later plan that moves or rewords a phrase updates only that entry. It writes the plan
 * id and the decision id beside the entry (a trailing comment), and it never deletes an entry. A phrase that
 * moves to another file adds that file to the entry's list.
 *
 *   P1  every phrase appears in at least one allowed file (one leg per phrase)
 *   P2  the sentence band in the agent Voice section and the voice-dna standard row agree
 *   P3  no em dash or en dash in this file
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

const HOME_TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'test-3696-doctrine-'));
['HOME', 'MINDRIAN_HOME', 'MINDRIAN_ROOMS_HOME', 'MINDRIAN_ROOMS_ROOT', 'CLAUDE_CONFIG_DIR'].forEach(function (k) {
  const d = path.join(HOME_TMP, k.toLowerCase());
  fs.mkdirSync(d, { recursive: true });
  process.env[k] = d;
});
process.env.USERPROFILE = process.env.HOME;

const { installNetGuard, makeChecker } = require('./helpers/hygiene-355.cjs');
const NET = installNetGuard();
const { check, summary } = makeChecker('test-3696-doctrine-presence');

const ROOT = path.resolve(__dirname, '..');
const AGENT = 'agents/larry-extended.md';
const DNA = 'references/personality/voice-dna.md';

// The phrase map. Entries are matched after the curly apostrophe is folded to a straight one, so a plan that
// changes the apostrophe form does not touch this map. Never delete an entry (see the header).
const PHRASES = {
  '## The Cardinal Sin': [AGENT],
  'NEVER dump frameworks': [AGENT],
  'NEVER classify out loud': [AGENT],
  '3-8 sentences default': [AGENT],
  "You're thinking about this as X. But what if it's actually Y?": [AGENT, DNA],
  "That's not a problem": [AGENT, DNA],
  "You've given me a solution. What's the problem?": [AGENT, DNA],
  'just tell me': [AGENT],
  'bottom line': [AGENT],
  'Escape hatch': [AGENT],
  'great question': [AGENT],
  'Absolutely!': [AGENT],
  "I'd be happy to help": [AGENT],
  'Classify internally, NEVER announce': [AGENT],
  'Theory without practice is academic.': [AGENT],
  'Signature openers': [AGENT],
  'Standard response | 3-8 sentences': [DNA],
  '## Report mode': [AGENT], // 369.6-09 Task 1, D-12
  'never invent the next move': [AGENT], // 369.6-09 Task 1, D-08
  'never as a default ending': [AGENT], // 369.6-09 Task 1, D-09
};

const norm = function (s) { return String(s).replace(/’/g, "'"); };
const cache = {};
function textOf(rel) {
  if (!(rel in cache)) cache[rel] = norm(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
  return cache[rel];
}
// The voice-dna table row uses spaces around the pipe; compare with runs of spaces folded.
const fold = function (s) { return s.replace(/[ \t]+/g, ' '); };

Object.keys(PHRASES).forEach(function (phrase) {
  const files = PHRASES[phrase];
  const want = fold(norm(phrase));
  const found = files.filter(function (f) { return fold(textOf(f)).indexOf(want) !== -1; });
  check('P1 phrase present: ' + phrase, found.length > 0, found.length ? 'in ' + found.join(', ') : 'missing from ' + files.join(', '));
});

// P2: the band in the agent Voice section equals the band in the voice-dna standard row.
(function () {
  const agent = textOf(AGENT);
  const dna = textOf(DNA);
  const a = /(\d+)-(\d+) sentences default/.exec(agent);
  const d = /\|\s*Standard response\s*\|\s*(\d+)-(\d+) sentences/.exec(dna);
  const ok = !!a && !!d && a[1] === d[1] && a[2] === d[2];
  check('P2 sentence band agrees between the agent Voice section and the voice-dna standard row', ok,
    'agent ' + (a ? a[1] + '-' + a[2] : 'none') + ', voice-dna ' + (d ? d[1] + '-' + d[2] : 'none'));
})();

// P3: no em dash or en dash in this file (searched as code points, so this line holds neither).
(function () {
  const self = fs.readFileSync(__filename, 'utf8');
  const bad = [String.fromCharCode(0x2014), String.fromCharCode(0x2013)].filter(function (c) { return self.indexOf(c) !== -1; });
  check('P3 no em dash or en dash in this file', bad.length === 0, bad.length ? 'found' : '');
})();

check('no network call was attempted', NET.attempts() === 0);
process.exit(summary());
