#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 383 Plan 02 Task 2 (QA383-08, D-04). Wave 0, RED-first.
 *
 * A figure in a sentence that Larry is taught to say needs a named source in the same sentence. This test
 * sweeps the shipped quoted sentences with findUnsourcedNumber and lists every hit. A later plan fixes the
 * strings, or adds an ALLOWLIST entry for a figure that is not a claim (a version, a menu marker, an HTTP
 * status, a year inside a citation, a string pinned by a named test) with a reason.
 *
 * One fixed extraction rule, so the hit list is reproducible:
 *   (1) commands/*.md and agents/*.md (top level, .md only): skip the frontmatter block and fenced code
 *       blocks; on every other line take each match of /"([^"\n]{25,300}?[.?!])"/g whose capture has at
 *       least 5 words;
 *   (2) the single-quoted header, label and description literals of lib/mcp/startup-operations.cjs;
 *   (3) the escaped double-quoted spans inside the MODE_MENU value of scripts/session-start, and the text
 *       after `Say:` up to the next sentence end in the Mode Behavior string.
 *
 *   U1  no hit outside the ALLOWLIST (RED at HEAD); prints every hit and the totals
 *   U2  every ALLOWLIST entry has a reason and still matches a live hit
 *   U3  PENDING: the number from the QA session is not on file
 *   U4  no swept string holds U+2014 or U+2013
 *
 * Hermetic: HOME and the rooms variables point into one mkdtemp dir. Nothing is written.
 * Output: PASS, FAIL or PENDING lines, then PASS: n FAIL: n PENDING: n. House rule: hyphens only.
 */

const fs = require('node:fs');
const path = require('node:path');

const H = require('./helpers/harness-383.cjs');
const { env } = H.hermeticEnv('sourcednum');
H.applyEnv(env);

const ROOT = path.resolve(__dirname, '..');
const R = H.reporter('test-383-sourced-number');
const { findUnsourcedNumber } = require(path.join(ROOT, 'lib', 'hmi', 'larry-reply-checks.cjs'));

// Entries { file, figure, match, reason }. An entry is only for a figure that is not a claim, or a string that a
// named test or file pins. `match` is a substring of the swept string, so one entry never covers a second sentence
// in the same file that holds the same figure.
const ALLOWLIST = [
  // Plan 383-08 Task 1 (agents/ and commands/admin.md to commands/jtbd.md)
  { file: 'commands/admin.md', figure: '401', match: 'The user will get a 401 error', reason: 'an HTTP status code, not a claim about the room' },
  { file: 'commands/graph.md', figure: '3', match: 'What topics appear in 3 or more sections?', reason: 'an example question the navigator may ask; the threshold is the question itself, not a Larry claim' },
  { file: 'commands/graph.md', figure: '3', match: 'What topics appear in 3+ sections?', reason: 'an example question pattern the navigator may ask; the threshold is part of the question, not a Larry claim' },
  { file: 'commands/hat-briefing.md', figure: '6', match: 'a full 6-hat sweep', reason: 'the name of the method (Six Thinking Hats), a fixed definition and not a measured claim' },
  { file: 'commands/ignite.md', figure: '2', match: 'which 2-3 domains pull you?', reason: 'the count of picks the card asks for, a count of the reply\'s own options and not a claim' },
  { file: 'agents/investor.md', figure: '18', match: 'What kills this in 18 months?', reason: 'a probing question whose horizon is part of the question, not a stated fact' },
  // Plan 383-08 Task 2 (commands/mva-option.md to commands/vault.md)
  { file: 'commands/mva-option.md', figure: '60', match: 'within 60 seconds of brief rendering', reason: 'a success threshold quoted from the Plan 118-06 Dror 2.0 harness, a design criterion and not a claim to the navigator' },
  { file: 'commands/onboard.md', figure: '30', match: 'detects contamination in 30 seconds', reason: 'a sample sentence the navigator might say (the TTO persona), not a Larry claim' },
  { file: 'commands/pipeline.md', figure: '1', match: 'Stage {N+1}', reason: 'the 1 sits inside the placeholder {N+1}, an index step and not a figure' },
  { file: 'commands/setup.md', figure: '2', match: 'Tier 2 uses Pinecone embeddings', reason: 'a tier name (HSI Tier 2), a label and not a count' },
  { file: 'commands/trending-to-absurd.md', figure: '10', match: 'return 10x?', reason: 'the Investor persona beautiful question, mirrored from lib/core/trending-to-absurd/variance.cjs PERSONA_FRAMING; a question and not a claim' },
  { file: 'commands/update.md', figure: '1', match: 'Native update failed', reason: 'the step marker (1) in a numbered recovery list' },
  { file: 'commands/update.md', figure: '2', match: 'Native update failed', reason: 'the step marker (2) in a numbered recovery list' },
];

// The number the QA session reported. Plan 383-11 adds it from the full report.
const SESSION_STRING = null;

const DASH_RE = new RegExp('[' + String.fromCharCode(0x2013) + String.fromCharCode(0x2014) + ']');

function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

// ---- extraction: [{ file, line, text }]
const swept = [];

function sweepMarkdown(rel) {
  const lines = read(rel).split('\n');
  let i = 0;
  if (lines[0] === '---') {
    const end = lines.indexOf('---', 1);
    i = end < 0 ? 0 : end + 1;
  }
  let fenced = false;
  const re = /"([^"\n]{25,300}?[.?!])"/g;
  for (; i < lines.length; i++) {
    const l = lines[i];
    if (/^\s*```/.test(l)) { fenced = !fenced; continue; }
    if (fenced) continue;
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(l)) !== null) {
      if (m[1].trim().split(/\s+/).length >= 5) swept.push({ file: rel, line: i + 1, text: m[1] });
    }
  }
}

for (const dir of ['commands', 'agents']) {
  const names = fs.readdirSync(path.join(ROOT, dir)).filter(function (f) { return f.endsWith('.md'); }).sort();
  for (const f of names) {
    if (!fs.statSync(path.join(ROOT, dir, f)).isFile()) continue;
    sweepMarkdown(dir + '/' + f);
  }
}

(function () {
  const rel = 'lib/mcp/startup-operations.cjs';
  const re = /\b(?:header|label|description):\s*'((?:[^'\\]|\\.)*)'/g;
  read(rel).split('\n').forEach(function (l, i) {
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(l)) !== null) swept.push({ file: rel, line: i + 1, text: m[1] });
  });
})();

(function () {
  const rel = 'scripts/session-start';
  const lines = read(rel).split('\n');
  const menuIdx = lines.findIndex(function (l) { return /^\s*MODE_MENU="/.test(l); });
  if (menuIdx >= 0) {
    const re = /\\"([^"\\]+)\\"/g;
    let m;
    while ((m = re.exec(lines[menuIdx])) !== null) swept.push({ file: rel, line: menuIdx + 1, text: m[1] });
  }
  const modeIdx = lines.findIndex(function (l) { return l.indexOf('## Mode Behavior Instructions') !== -1; });
  if (modeIdx >= 0) {
    const re = /Say:\s*(.*?[.?!])(?=\s|\\n|$)/g;
    let m;
    while ((m = re.exec(lines[modeIdx])) !== null) swept.push({ file: rel, line: modeIdx + 1, text: m[1] });
  }
})();

// ---- run the check
const hits = [];
for (const s of swept) {
  const v = findUnsourcedNumber(s.text, { userText: '' });
  if (v && v.ok === false) {
    for (const h of (v.hits || [])) hits.push({ file: s.file, line: s.line, figure: String(h.term), text: s.text });
  }
}

function allowlisted(h) {
  return ALLOWLIST.some(function (a) { return a.file === h.file && a.figure === h.figure && h.text.indexOf(a.match) !== -1; });
}
const open = hits.filter(function (h) { return !allowlisted(h); });
const allowCount = hits.length - open.length;
const hitFiles = Array.from(new Set(hits.map(function (h) { return h.file; })));

// ---- U1
for (const h of open) console.log('HIT ' + h.file + ':' + h.line + ' ' + h.figure + ' | ' + h.text.slice(0, 90));
console.log('SWEEP strings=' + swept.length + ' hits=' + hits.length + ' allowlisted=' + allowCount + ' files=' + hitFiles.length);
if (open.length === 0) R.pass('U1 no unsourced figure outside the allowlist');
else R.fail('U1 no unsourced figure outside the allowlist', open.length + ' hit(s) in ' + Array.from(new Set(open.map(function (h) { return h.file; }))).length + ' file(s)');

// ---- U2
(function () {
  const faults = [];
  ALLOWLIST.forEach(function (a, i) {
    if (!a || typeof a.reason !== 'string' || !a.reason.trim()) faults.push('entry ' + i + ' has no reason');
    if (!a || typeof a.match !== 'string' || !a.match) faults.push('entry ' + i + ' has no match substring');
    if (!hits.some(function (h) { return a && h.file === a.file && h.figure === a.figure && h.text.indexOf(a.match) !== -1; })) {
      faults.push('entry ' + i + ' (' + (a && a.file) + ' ' + (a && a.figure) + ') matches no live hit');
    }
  });
  if (faults.length === 0) R.pass('U2 every allowlist entry has a reason and a live hit (entries=' + ALLOWLIST.length + ')');
  else R.fail('U2 every allowlist entry has a reason and a live hit', faults.join('; '));
})();

// ---- U3
if (SESSION_STRING === null) R.pending('U3', 'the number from the QA session is not on file; plan 383-11 adds it from the full report');
else {
  const v = findUnsourcedNumber(String(SESSION_STRING), { userText: '' });
  if (v && v.ok === true) R.pass('U3 the QA session string is sourced or fixed');
  else R.fail('U3 the QA session string is sourced or fixed', JSON.stringify(v && v.hits));
}

// ---- U4
(function () {
  const bad = swept.filter(function (s) { return DASH_RE.test(s.text); });
  if (bad.length === 0) R.pass('U4 no swept string holds an em dash or an en dash');
  else R.fail('U4 no swept string holds an em dash or an en dash', bad.map(function (s) { return s.file + ':' + s.line; }).join(', '));
})();

R.done();
