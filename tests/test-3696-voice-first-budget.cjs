#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 369.6 Plan 03 Task 3 (NS369.6-10; D-01, D-02, D-03, D-09, D-17). The agent order and budget guard.
 * Every number is measured by the plan 01 functions of scripts/measure-larry-voice.cjs. This file holds no second
 * counter. The base numbers come from the immutable base snapshot tests/fixtures/3696-persona-h/ and the budgets
 * are computed from them in code.
 *
 *   V0   the base snapshot measures as the L2 research says: body 19619 B  (required now)
 *   V1   the only non-blank line between the frontmatter and "## Voice" is the identity line (R-09)   KNOWN 369.6-09
 *   V2   the level-2 headings equal the D-01 order, one for one                                      KNOWN 369.6-09
 *   V3   body at most 65 percent of the base body, which is 12752 B (D-02)                           KNOWN 369.6-09
 *   V4   strict core voice share at least 20 percent (D-02)                                          KNOWN 369.6-09
 *   V5   loose machinery share at most 30 percent, the operation class apart (D-02)                  KNOWN 369.6-09
 *   V6   the body names references/personality/agent-operations.md and the file exists (D-03)       KNOWN 369.6-08
 *   V7   the frontmatter is byte-identical to the base frontmatter                                   (required now)
 *   V8   none of the D-03 sections remains in the body                                               KNOWN 369.6-08
 *   V9   the Decision Gates section text is byte-identical to the base (D-09)                        (required now)
 *   V10  no em dash or en dash in this file
 *
 * Printed on every run: body bytes, the strict core share, and the loose voice, brand, machinery and operation shares.
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

const HOME_TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'test-3696-voicebudget-'));
['HOME', 'MINDRIAN_HOME', 'MINDRIAN_ROOMS_HOME', 'MINDRIAN_ROOMS_ROOT', 'CLAUDE_CONFIG_DIR'].forEach(function (k) {
  const d = path.join(HOME_TMP, k.toLowerCase());
  fs.mkdirSync(d, { recursive: true });
  process.env[k] = d;
});
process.env.USERPROFILE = process.env.HOME;

const { installNetGuard, makeChecker } = require('./helpers/hygiene-355.cjs');
const NET = installNetGuard();
const { check, summary } = makeChecker('test-3696-voice-first-budget');

const ROOT = path.resolve(__dirname, '..');
const M = require(path.join(ROOT, 'scripts', 'measure-larry-voice.cjs'));

const AGENT = 'agents/larry-extended.md';
const OPS_REF = 'references/personality/agent-operations.md';
const BASE = path.join(__dirname, 'fixtures', '3696-persona-h', 'larry-extended.md');

const live = fs.readFileSync(path.join(ROOT, AGENT), 'utf8');
const base = fs.readFileSync(BASE, 'utf8');
const norm = function (s) { return String(s).replace(/\u2019/g, "'").trim(); };

// ---- budgets computed from the base snapshot ------------------------------------------------------------------
const BASE_BODY = M.strictCore(base).body_bytes;
const BODY_MAX = Math.floor(0.65 * BASE_BODY);
const STRICT_MIN = 20;
const MACHINERY_MAX = 30;

// D-01 order, as heading prefixes.
const ORDER = [
  'Voice', 'The Cardinal Sin', 'Conversation Flow', 'Silent Problem Classification', "The practitioner's DNA",
  'Operating invisibly', 'Room Awareness', 'Elevation (Part 12', 'Sourced Claims (Part 12 HARD requirement)', 'Calibration',
  'Never Do', 'Always Do', 'Voice Signature', 'Report mode', 'Decision Gates', 'When a room create or switch fails (SEED-117)',
  'Non-Methodology Questions', 'If asked about Theo by name', 'Operating the machinery (see larry-personality skill)',
];
// D-03: headings that move to the reference. The compact pointer heading "Operating the machinery (see ...)" stays.
const MOVED_HEADINGS = ['Operating policy', 'Post-Gate Handoff', 'Persona-Aware Turn 1', 'Canonical role', 'Dual-Path Detection', 'Why this exists'];

const KNOWN = {
  V1: { closes_in: '369.6-09', why: 'the identity line and the voice-first order are written by plan 09' },
  V2: { closes_in: '369.6-09', why: 'the D-01 order is written by plan 09' },
  V3: { closes_in: '369.6-09', why: 'the body is 19619 B at the base; plans 08 and 09 cut it' },
  V4: { closes_in: '369.6-09', why: 'the strict core share is 12.5 percent at the base' },
  V5: { closes_in: '369.6-09', why: 'the machinery share is 58.0 percent at the base' },
  V6: { closes_in: '369.6-08', why: 'agent-operations.md is created by plan 08' },
  V8: { closes_in: '369.6-08', why: 'the operating sections move in plan 08' },
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

// ---- helpers ---------------------------------------------------------------------------------------------------
function frontmatterOf(text) {
  const p = text.split('\n');
  if (p[0] !== '---') return '';
  const e = p.indexOf('---', 1);
  return e === -1 ? '' : p.slice(0, e + 1).join('\n');
}
function bodyLinesOf(text) {
  return M.bodyOf(text).split('\n');
}
function level2(text) {
  return bodyLinesOf(text).map(function (ln) { return /^## (.*)$/.exec(ln); }).filter(Boolean).map(function (m) { return norm(m[1]); });
}
// The text of a level-2 section, from its heading to the line before the next level-2 heading.
function sectionText(text, prefix) {
  const lines = bodyLinesOf(text);
  const start = lines.findIndex(function (ln) { return norm(ln).indexOf('## ' + prefix) === 0; });
  if (start === -1) return '';
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) { if (/^## /.test(lines[i])) { end = i; break; } }
  return lines.slice(start, end).join('\n');
}

// ---- measurements printed on every run ------------------------------------------------------------------------
const strict = M.strictCore(live);
const loose = M.measureFile(live, { agent: true });
console.log('MEASURE ' + AGENT + ': body ' + strict.body_bytes + ' B (max ' + BODY_MAX + '); strict core ' + strict.core_bytes + ' B = ' + strict.share + ' percent (min ' + STRICT_MIN + ')');
console.log('MEASURE loose shares: voice ' + loose.share.voice + ' / brand ' + loose.share.brand + ' / machinery ' + loose.share.machinery + ' (max ' + MACHINERY_MAX + ') / operation ' + loose.share.operation);

// V0: the base snapshot is the L2 base.
check('V0 the base snapshot body is 19619 B and its strict core share is 12.5 percent (L2)', BASE_BODY === 19619 && M.strictCore(base).share === 12.5,
  'body ' + BASE_BODY + ', share ' + M.strictCore(base).share);

// V1
{
  const lines = bodyLinesOf(live);
  const h = lines.findIndex(function (ln) { return /^## Voice\s*$/.test(ln); });
  const between = h === -1 ? [] : lines.slice(0, h).filter(function (ln) { return ln.trim() !== ''; });
  const ok = h !== -1 && between.length === 1 && between[0].indexOf('You are Larry, a PwS practitioner and thinking partner.') === 0;
  leg('V1', 'the identity line, then "## Voice" first', ok, 'non-blank lines before Voice: ' + between.length);
}
// V2
{
  const heads = level2(live);
  const want = ORDER.map(norm);
  let first = -1;
  for (let i = 0; i < Math.max(heads.length, want.length); i += 1) {
    if (heads[i] === undefined || want[i] === undefined || heads[i].indexOf(want[i]) !== 0) { first = i; break; }
  }
  leg('V2', 'the level-2 headings equal the D-01 order', first === -1,
    first === -1 ? '' : 'first difference at position ' + (first + 1) + ': have "' + (heads[first] || '(none)').slice(0, 40) + '", want "' + (want[first] || '(none)') + '"');
}
leg('V3', 'body at most ' + BODY_MAX + ' B (65 percent of ' + BASE_BODY + ' B)', strict.body_bytes <= BODY_MAX, 'body ' + strict.body_bytes);
leg('V4', 'strict core share at least ' + STRICT_MIN + ' percent', strict.share >= STRICT_MIN, 'share ' + strict.share);
leg('V5', 'loose machinery share at most ' + MACHINERY_MAX + ' percent, operation apart', loose.share.machinery <= MACHINERY_MAX, 'share ' + loose.share.machinery);
leg('V6', 'the body names ' + OPS_REF + ' and the file exists', live.indexOf(OPS_REF) !== -1 && fs.existsSync(path.join(ROOT, OPS_REF)));
check('V7 the frontmatter is byte-identical to the base frontmatter', frontmatterOf(live) !== '' && frontmatterOf(live) === frontmatterOf(base));
{
  const present = level2(live).concat(bodyLinesOf(live).map(function (ln) { return /^###+ (.*)$/.exec(ln); }).filter(Boolean).map(function (m) { return norm(m[1]); }))
    .filter(function (h) { return MOVED_HEADINGS.some(function (n) { return h.indexOf(n) === 0; }); });
  leg('V8', 'none of the D-03 sections remains in the body', present.length === 0, 'still present: ' + present.join(', '));
}
{
  const a = sectionText(live, 'Decision Gates');
  const b = sectionText(base, 'Decision Gates');
  check('V9 the Decision Gates section text is byte-identical to the base (D-09)', a !== '' && a === b, 'live ' + a.length + ' B, base ' + b.length + ' B');
}
{
  const own = fs.readFileSync(__filename, 'utf8');
  check('V10 no em dash or en dash in this file', own.indexOf(String.fromCharCode(0x2014)) === -1 && own.indexOf(String.fromCharCode(0x2013)) === -1);
}
check('no network call was attempted', NET.attempts() === 0);
console.log('KNOWN legs: ' + knownCount);
process.exit(summary());
