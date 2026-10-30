#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 369.6 Plan 03 Task 2 (NS369.6-19; D-41, A-01). The inform-versus-enforce guard.
 * REF-arav: "What code executes can enforce. What an LLM reads can only inform." Prose in the Larry
 * persona is advice. It must not call itself a guarantee, an enforcement or a safeguard. Those words are
 * reserved for a mechanism in the output path (a hook, a guard, a test that fails the build).
 *
 *   H0   the agent file is read and the Voice section exists (the test is not vacuous)
 *   H1   no line of a voice or operation section uses a banned word (an absent section is skipped with a
 *        printed note, never passed silently)
 *   H2   Operating invisibly and Calibration each carry exactly one line that starts "Holds by:" and names
 *        only the words code, advice and measured        (required, flipped by 369.6-09 Task 2)
 *   H3   the Holds by line of Operating invisibly names code, together with the Part 8 egress guard
 *        (scripts/part8-egress-guard-hook.cjs)           (required, flipped by 369.6-09 Task 2)
 *   H4   the guard script named by H3 exists
 *   H5   no em dash or en dash in this file
 *
 * KNOWN table (the KNOWN rule of this phase). A KNOWN leg that fails prints "KNOWN <leg> closes in <plan>" and
 * does not fail the test. A KNOWN leg that passes FAILS the test: flip it to required (the task whose change
 * makes it pass flips it in the same commit and records "KNOWN moved" in its SUMMARY).
 *
 * Banned words: guarantee, guarantees, guaranteed, enforce, enforces, enforced, enforcement, safeguard,
 * safeguards and the phrase "never happens".
 *
 * Read-only. Hermetic: HOME, MINDRIAN_HOME, MINDRIAN_ROOMS_HOME, MINDRIAN_ROOMS_ROOT and CLAUDE_CONFIG_DIR are
 * mkdtemp dirs before any repo require; a net guard counts any fetch.
 *
 * Output: one PASS, FAIL or KNOWN line per leg, then PASS: n FAIL: n. Exit 0 when no required leg fails.
 * House rule: hyphens only.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const HOME_TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'test-3696-holdsby-'));
['HOME', 'MINDRIAN_HOME', 'MINDRIAN_ROOMS_HOME', 'MINDRIAN_ROOMS_ROOT', 'CLAUDE_CONFIG_DIR'].forEach(function (k) {
  const d = path.join(HOME_TMP, k.toLowerCase());
  fs.mkdirSync(d, { recursive: true });
  process.env[k] = d;
});
process.env.USERPROFILE = process.env.HOME;

const { installNetGuard, makeChecker } = require('./helpers/hygiene-355.cjs');
const NET = installNetGuard();
const { check, summary } = makeChecker('test-3696-holds-by');

const ROOT = path.resolve(__dirname, '..');
const AGENT = 'agents/larry-extended.md';
const GUARD = 'scripts/part8-egress-guard-hook.cjs';

const KNOWN = {
};
let knownCount = 0;
function leg(id, name, passes, detail) {
  const k = KNOWN[id];
  const label = id + ' ' + name;
  if (!k) return check(label, passes, detail);
  if (passes) return check(label + ': KNOWN ' + id + ' now passes: flip it to required', false, k.why);
  knownCount += 1;
  console.log('KNOWN ' + id + ' closes in ' + k.closes_in + ': ' + name + ' (' + k.why + ')');
  return true;
}

const norm = function (s) { return String(s).replace(/\u2019/g, "'").trim(); };

// Body of the agent: the frontmatter is metadata and is not read.
const raw = fs.readFileSync(path.join(ROOT, AGENT), 'utf8').split('\n');
let from = 0;
if (raw[0] === '---') { const e = raw.indexOf('---', 1); if (e !== -1) from = e + 1; }
const lines = raw.slice(from);

// sections: level-2 headings; the text of a section runs to the next level-2 heading (subsections included).
const sections = [];
lines.forEach(function (ln) {
  const m = /^## (.*)$/.exec(ln);
  if (m) sections.push({ heading: norm(m[1]), lines: [] });
  else if (sections.length) sections[sections.length - 1].lines.push(ln);
});

function find(names) {
  return sections.find(function (s) {
    return names.some(function (n) { return s.heading === n || s.heading.indexOf(n + ' (') === 0; });
  });
}

const VOICE_SECTIONS = [
  { label: 'Voice', names: ['Voice'] },
  { label: 'The Cardinal Sin', names: ['The Cardinal Sin'] },
  { label: 'Conversation Flow', names: ['Conversation Flow'] },
  { label: 'Silent Problem Classification', names: ['Silent Problem Classification'] },
  { label: 'the DNA section', names: ['The Aronhime DNA', "The practitioner's DNA"] },
  { label: 'Never Do', names: ['Never Do'] },
  { label: 'Always Do', names: ['Always Do'] },
  { label: 'Operating invisibly', names: ['Operating invisibly'] },
  { label: 'Calibration', names: ['Calibration'] },
  { label: 'Report mode', names: ['Report mode'] },
];
const BANNED = /\b(guarantee|guarantees|guaranteed|enforce|enforces|enforced|enforcement|safeguard|safeguards)\b|never happens/i;

check('H0 the agent file is read and the Voice section exists', sections.length > 0 && !!find(['Voice']), 'sections: ' + sections.length);

VOICE_SECTIONS.forEach(function (v) {
  const sec = find(v.names);
  if (!sec) {
    console.log('NOTE H1 ' + v.label + ': section absent at this commit, skipped (not passed)');
    return;
  }
  const bad = sec.lines.map(function (ln, i) { return { ln: ln, i: i }; }).filter(function (x) { return BANNED.test(x.ln); })
    .map(function (x) { return '"' + x.ln.trim().slice(0, 80) + '"'; });
  check('H1 ' + v.label + ': no line calls itself a guarantee, an enforcement or a safeguard', bad.length === 0, bad.join(' | '));
});

// H2 and H3
function holdsByLines(sec) { return sec ? sec.lines.filter(function (ln) { return /^Holds by:/.test(ln.trim()); }).map(function (ln) { return ln.trim(); }) : []; }
function classesOf(line) {
  const head = line.replace(/^Holds by:\s*/, '').split('(')[0];
  const toks = head.split(/[\s,;/]+/).map(function (t) { return t.toLowerCase(); }).filter(Boolean);
  const classes = toks.filter(function (t) { return ['code', 'advice', 'measured'].indexOf(t) !== -1; });
  const stray = toks.filter(function (t) { return ['code', 'advice', 'measured', 'and', 'or', 'plus'].indexOf(t) === -1; });
  return { classes: classes, stray: stray };
}
{
  const inv = find(['Operating invisibly']);
  const cal = find(['Calibration']);
  const problems = [];
  [['Operating invisibly', inv], ['Calibration', cal]].forEach(function (pair) {
    if (!pair[1]) { problems.push(pair[0] + ' section absent'); return; }
    const hb = holdsByLines(pair[1]);
    if (hb.length !== 1) { problems.push(pair[0] + ' has ' + hb.length + ' Holds by lines'); return; }
    const c = classesOf(hb[0]);
    if (c.classes.length === 0 || c.stray.length > 0) problems.push(pair[0] + ' Holds by line names ' + (c.stray.join(',') || 'no class'));
  });
  leg('H2', 'Operating invisibly and Calibration each carry one Holds by line naming only code, advice or measured', problems.length === 0, problems.join('; '));

  let h3 = false;
  let h3detail = 'Operating invisibly section absent';
  if (inv) {
    const hb = holdsByLines(inv);
    if (hb.length === 1) {
      const c = classesOf(hb[0]);
      h3 = c.classes.length === 1 && c.classes[0] === 'code' && hb[0].indexOf(GUARD) !== -1;
      h3detail = 'line: ' + hb[0].slice(0, 100);
    } else h3detail = 'Holds by lines: ' + hb.length;
  }
  leg('H3', 'the Holds by line of Operating invisibly names code, together with the Part 8 egress guard script', h3, h3detail);
}
check('H4 the Part 8 egress guard script named by H3 exists', fs.existsSync(path.join(ROOT, GUARD)));

{
  const own = fs.readFileSync(__filename, 'utf8');
  check('H5 no em dash or en dash in this file', own.indexOf(String.fromCharCode(0x2014)) === -1 && own.indexOf(String.fromCharCode(0x2013)) === -1);
}
check('no network call was attempted', NET.attempts() === 0);
console.log('KNOWN legs: ' + knownCount);
process.exit(summary());
