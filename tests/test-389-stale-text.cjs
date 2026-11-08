#!/usr/bin/env node
// Phase 389 plan 01: stale "option 2 is a stub" text and stale router asserts.
// Node built-ins only. Plain counters. Hyphens only. Exit 1 on a failure.
//
// Why: lib/core/mva-option-router.cjs returns ignite_from_brief for option 2
// (Phase 155-04) and STUB_MESSAGE_119 is null. Five family files and five router
// asserts still say phase_119_stub. This test fails while that text is stale.
//
// Test 4 compares against pinned sha256 hashes (not against HEAD) so it stays
// meaningful after the edit is committed.
//   node tests/test-389-stale-text.cjs --print-pins   prints the pin table for the 5 files
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
// Plan 08 (owner D3, D4) retired commands/mva-option.md, skills/mva-option, skills/mva-pipeline and
// lib/core/mva-option-router.test.cjs. Their legs (stale text, option 2 text, router asserts, pins) went
// with them; the files that stay are checked as before.
const FILES = [
  'commands/mva-brief.md',
  'skills/mva-brief/SKILL.md',
];
const KEYS = ['teaching', 'help_jtbd'];

// sha256 of the frontmatter block of each key, taken from the files before plan 389-01 edited them.
// The value 'absent' means the file has no such key.
const PINS = {
  'commands/mva-brief.md': {
    teaching: '2820680b41608983e79076fde84163949e290a3a5526ea8a00d92cad242872cf',
    help_jtbd: '3661db80cac7fe319d25bdf033b4fc1447fb9d8bbdc0b1ede80f33a1ba06e527',
  },
  'skills/mva-brief/SKILL.md': {
    teaching: '2820680b41608983e79076fde84163949e290a3a5526ea8a00d92cad242872cf',
    help_jtbd: '3661db80cac7fe319d25bdf033b4fc1447fb9d8bbdc0b1ede80f33a1ba06e527',
  },
};

let passed = 0;
let failed = 0;
function ok(name) {
  passed += 1;
  console.log('ok   ' + name);
}
function fail(name, detail) {
  failed += 1;
  console.log('FAIL ' + name + (detail ? ' :: ' + detail : ''));
}
function check(name, cond, detail) {
  if (cond) ok(name);
  else fail(name, detail);
}
function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

// Text of the frontmatter block of one top-level key: the key line plus every
// following line that is indented, blank, or a list item, up to the next top-level key.
function keyBlock(text, key) {
  if (!text.startsWith('---\n')) return null;
  const end = text.indexOf('\n---', 4);
  if (end === -1) return null;
  const lines = text.slice(4, end).split('\n');
  const re = new RegExp('^' + key + ':');
  let i = lines.findIndex((l) => re.test(l));
  if (i === -1) return null;
  const out = [lines[i]];
  for (i = i + 1; i < lines.length; i++) {
    const l = lines[i];
    if (/^[A-Za-z_][A-Za-z0-9_-]*:/.test(l)) break;
    out.push(l);
  }
  return out.join('\n');
}
function pin(text, key) {
  const b = keyBlock(text, key);
  return b === null ? 'absent' : crypto.createHash('sha256').update(b, 'utf8').digest('hex');
}

if (process.argv.includes('--print-pins')) {
  const o = {};
  for (const f of FILES) {
    o[f] = {};
    for (const k of KEYS) o[f][k] = pin(read(f), k);
  }
  console.log(JSON.stringify(o, null, 2));
  process.exit(0);
}

// ---- Test 1: no stale stub text in the two family files ----
const STALE = [
  'phase_119_stub',
  'stub for v1.13.0',
  'stubbed for v1.13.0',
  'option 2 is stubbed',
  'option 2 is a stub',
  'Phase 119 wires fully',
  'shipping in beta.18',
  'lands in Phase 119',
  'stub message',
];
for (const f of FILES) {
  const lines = read(f).split('\n');
  const bad = [];
  lines.forEach((l, i) => {
    for (const s of STALE) {
      if (l.toLowerCase().includes(s.toLowerCase())) bad.push('L' + (i + 1) + ' "' + s + '"');
    }
    if (l.includes('STUB_MESSAGE_119') && !/\bnull\b/.test(l)) bad.push('L' + (i + 1) + ' STUB_MESSAGE_119 as a live message');
  });
  check('Test 1: ' + f + ' holds no stale stub text', bad.length === 0, bad.join('; '));
}

// ---- Test 4 (Tests 2 and 3 retired with the option files in plan 08): teaching and help_jtbd are untouched (ledger hash stays valid) ----
if (Object.values(PINS).some((p) => p.teaching === 'PIN')) {
  fail('Test 4: pins are filled in', 'run --print-pins on the unedited files');
} else {
  for (const f of FILES) {
    for (const k of KEYS) {
      check('Test 4: ' + f + ' ' + k + ' unchanged', pin(read(f), k) === PINS[f][k]);
    }
  }
}

// ---- Test 5: fixtures ----
{
  const fx = path.join(ROOT, 'tests', 'fixtures', '389');
  let arr = null;
  try {
    arr = JSON.parse(fs.readFileSync(path.join(fx, 'sentences.json'), 'utf8'));
  } catch (e) {
    fail('Test 5: sentences.json parses', String(e.message));
  }
  if (arr) {
    check('Test 5: sentences.json holds exactly 3 objects', Array.isArray(arr) && arr.length === 3);
    for (const o of arr) {
      const keys = Object.keys(o).sort().join(',');
      check('Test 5: object ' + (o.id || '?') + ' has keys id and sentence only', keys === 'id,sentence', keys);
      const s = typeof o.sentence === 'string' ? o.sentence : '';
      check('Test 5: ' + o.id + ' sentence is 12 to 600 characters', s.length >= 12 && s.length <= 600, String(s.length));
      check('Test 5: ' + o.id + ' sentence holds no digit run that looks like a phone or an id', !/\d{3,}/.test(s) && !/@/.test(s) && !/https?:/.test(s));
      check('Test 5: ' + o.id + ' sentence holds no capitalised name after the first word', !/(?<=[a-z,] )[A-Z][a-z]+/.test(s), 'a capitalised word inside the sentence');
    }
  }
  const must = [
    'room/ROOM.md',
    'room/STATE.md',
    'room/problem-definition/ROOM.md',
    'room/problem-definition/interview-notes.md',
    'room/market-analysis/ROOM.md',
    'room/market-analysis/competitor-table.md',
  ];
  for (const m of must) check('Test 5: fixture ' + m + ' exists', fs.existsSync(path.join(fx, m)));
  // A ROOM.md in every directory of the fixture room.
  const dirs = [];
  (function walk(d) {
    dirs.push(d);
    for (const e of fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }) : []) {
      if (e.isDirectory()) walk(path.join(d, e.name));
    }
  })(path.join(fx, 'room'));
  for (const d of dirs) check('Test 5: ' + path.relative(ROOT, d) + ' has a ROOM.md', fs.existsSync(path.join(d, 'ROOM.md')));
}

// ---- Test 6: no en dash or em dash in the files this plan owns ----
{
  const targets = [];
  const walk = (d) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else targets.push(p);
    }
  };
  walk(path.join(ROOT, 'tests', 'fixtures', '389'));
  for (const f of fs.readdirSync(path.join(ROOT, 'tests'))) {
    if (f.startsWith('test-389-') || f === 'run-all-389.sh') targets.push(path.join(ROOT, 'tests', f));
  }
  const dashRe = new RegExp('[\\u2013\\u2014]');
  const hits = targets.filter((p) => dashRe.test(fs.readFileSync(p, 'utf8'))).map((p) => path.relative(ROOT, p));
  check('Test 6: no en dash or em dash in ' + targets.length + ' files', hits.length === 0, hits.join(', '));
}

console.log('');
console.log('test-389-stale-text: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
