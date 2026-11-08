#!/usr/bin/env node
// Phase 389 plan 13 (owner card D9 APPROVE): the five surviving MVA-named modules are renamed.
// Pins: the 10 old files are gone and the 10 new files exist; each new file equals the file at
// the base commit with only the old names replaced; the five old names are gone from tracked
// files outside the named exceptions; the label of the reward checker and the sed pattern of
// scripts/verify-release agree; the runners name only files that exist; no new dash character.
// Node built-ins only. Plain counters. Hyphens only. Exit 1 on a failure, 77 on an env gap.
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const PHASE_DIR = path.join(ROOT, '.planning', 'phases', '389-pyramid-seed-and-full-replaces-the-mva-family');
// HEAD at the start of plan 13 (before the first rename commit).
const BASE = '6815f7c4b';

let passed = 0;
let failed = 0;
function check(name, cond, detail) {
  if (cond) {
    passed += 1;
    console.log('ok   ' + name);
  } else {
    failed += 1;
    console.log('FAIL ' + name + (detail ? ' :: ' + detail : ''));
  }
}
const rel = (p) => path.join(ROOT, p);
const exists = (p) => fs.existsSync(rel(p));
function git(args) {
  return cp.spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
}

const PAIRS = [
  ['lib/core/mva-classifier.cjs', 'lib/core/venture-sentence-classifier.cjs'],
  ['lib/core/mva-classifier.test.cjs', 'lib/core/venture-sentence-classifier.test.cjs'],
  ['lib/core/mva-rule-linter.cjs', 'lib/core/reward-rule-linter.cjs'],
  ['lib/core/mva-rule-linter.test.cjs', 'lib/core/reward-rule-linter.test.cjs'],
  ['lib/core/mva-dispatcher.cjs', 'lib/core/pyramid-seed-dispatcher.cjs'],
  ['lib/core/mva-dispatcher.test.cjs', 'lib/core/pyramid-seed-dispatcher.test.cjs'],
  ['lib/core/mva-budget.cjs', 'lib/core/pyramid-seed-budget.cjs'],
  ['lib/core/mva-budget.test.cjs', 'lib/core/pyramid-seed-budget.test.cjs'],
  ['lib/core/mva-agent-contract.cjs', 'lib/core/pyramid-seed-agent-contract.cjs'],
  ['lib/core/mva-agent-contract.test.cjs', 'lib/core/pyramid-seed-agent-contract.test.cjs'],
];
const TOKENS = [
  ['mva-classifier', 'venture-sentence-classifier'],
  ['mva-rule-linter', 'reward-rule-linter'],
  ['mva-dispatcher', 'pyramid-seed-dispatcher'],
  ['mva-budget', 'pyramid-seed-budget'],
  ['mva-agent-contract', 'pyramid-seed-agent-contract'],
];
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
// Same whole-name rule as the rename tool (a longer name is not a hit).
function replaceAllTokens(text) {
  let out = text;
  for (const [o, n] of TOKENS) {
    out = out.replace(new RegExp('(?:(?<![A-Za-z0-9_-])|(?<=\\\\[nrt]))' + esc(o) + '(?![A-Za-z0-9_]|-[A-Za-z0-9])', 'g'), n);
  }
  return out;
}

// ---- Test 1: old files gone, new files present ----
for (const [o, n] of PAIRS) {
  check('Test 1: old file is gone: ' + o, !exists(o));
  check('Test 1: new file exists: ' + n, exists(n));
}

// ---- Test 2: byte parity with the base commit after the token replacement ----
const baseOk = git(['cat-file', '-e', BASE + '^{commit}']).status === 0;
if (!baseOk) {
  console.log('SKIP Test 2: base commit ' + BASE + ' is not in this clone (shallow clone)');
} else {
  for (const [o, n] of PAIRS) {
    const show = git(['show', BASE + ':' + o]);
    if (show.status !== 0) {
      check('Test 2: base file readable: ' + o, false, show.stderr.trim());
      continue;
    }
    const expected = replaceAllTokens(show.stdout);
    const actual = exists(n) ? fs.readFileSync(rel(n), 'utf8') : null;
    check('Test 2: ' + n + ' equals ' + o + ' at base with only the names replaced', actual === expected,
      actual === null ? 'new file missing' : 'content differs');
  }
}

// ---- Test 3: zero old names in tracked files outside the named exceptions ----
{
  const re = TOKENS.map((t) => t[0]).join('|');
  const r = git(['grep', '-I', '-n', '-E', re, '--', '.',
    ':!.planning', ':!CHANGELOG.md', ':!r-and-d', ':!*command-deprecations*', ':!tests/test-389-renames.cjs',
    ':!docs/[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]*', ':!docs/**/[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]*']);
  const hits = r.status === 1 ? [] : r.stdout.split('\n').filter(Boolean);
  check('Test 3: 0 hits of the five old names outside the exceptions', hits.length === 0,
    hits.length + ' hit(s): ' + hits.slice(0, 5).join(' | '));
  const eur = hits.filter((h) => /eureka/i.test(h.split(':')[0]));
  check('Test 3: no Eureka path holds an old name', eur.length === 0, eur.join(' | '));
}

// ---- Test 4: checker label and verify-release sed pattern agree ----
{
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'rename389-t4-'));
  try {
    const env = Object.assign({}, process.env, { HOME: scratch, MINDRIAN_BRAIN_URL: 'http://127.0.0.1:9' });
    delete env.MINDRIAN_EUREKA_ROOT;
    const r = cp.spawnSync('node', [rel('scripts/check-reward-before-investment.cjs'), '--surfaces', ROOT], { encoding: 'utf8', env });
    check('Test 4: the checker --surfaces exits 0', r.status === 0, 'exit ' + r.status);
    const outText = (r.stdout || '') + (r.stderr || '');
    check('Test 4: the label starts with reward-rule-linter:', /^reward-rule-linter: scanning \d+ declared surfaces$/m.test(outText), outText.slice(0, 200));
    const vr = fs.readFileSync(rel('scripts/verify-release'), 'utf8');
    const m = vr.match(/SURFACES_COUNT=\$\(echo "\$SURFACES_OUT" \| sed -n '([^']*)' \| head -1\)/);
    check('Test 4: verify-release has the SURFACES_COUNT sed line', !!m);
    if (m) {
      const s = cp.spawnSync('sed', ['-n', m[1]], { input: outText, encoding: 'utf8' });
      check('Test 4: the sed pattern of verify-release reads a number from the checker output', /^\d+$/.test((s.stdout || '').split('\n')[0]), JSON.stringify(s.stdout));
      check('Test 4: the sed pattern names reward-rule-linter', m[1].includes('^reward-rule-linter: scanning'), m[1]);
    }
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

// ---- Test 5: the runners name only files that exist ----
{
  const RUNNERS = [
    ['tests/run-all-118.sh', 'tests'],
    ['tests/run-all-169.sh', '.'],
    ['tests/run-all-218.sh', '.'],
    ['tests/run-all-267.3.sh', '.'],
    ['lib/memory/run-feynman-tests.cjs', '.'],
  ];
  for (const [runner, base] of RUNNERS) {
    const lines = fs.readFileSync(rel(runner), 'utf8').split('\n').filter((l) => !/^\s*(#|\/\/|\*|\/\*)/.test(l));
    const missing = [];
    let seen = 0;
    for (const l of lines) {
      const re = /(?:\.\.\/)?(?:lib|tests|scripts)\/[A-Za-z0-9_.\/-]+\.(?:cjs|sh)/g;
      let mm;
      while ((mm = re.exec(l))) {
        seen += 1;
        const p = mm[0].startsWith('../') ? path.join(ROOT, base, mm[0]) : path.join(ROOT, mm[0]);
        if (!fs.existsSync(p)) missing.push(mm[0]);
      }
      if (runner.endsWith('run-feynman-tests.cjs')) {
        const pj = /path\.join\(REPO_ROOT,((?:\s*'[^']*',?)+)\s*\)/.exec(l);
        if (pj) {
          const parts = pj[1].split(',').map((x) => x.trim().replace(/^'|'$/g, '')).filter(Boolean);
          const p = path.join(ROOT, ...parts);
          if (/\.(cjs|sh)$/.test(p) && !/[\/]lib[\/]|[\/]tests[\/]|[\/]scripts[\/]/.test(l)) {
            seen += 1;
            if (!fs.existsSync(p)) missing.push(parts.join('/'));
          }
        }
      }
    }
    check('Test 5: ' + runner + ' names only files that exist (' + seen + ' names seen)', missing.length === 0 && seen > 0, missing.join(', '));
  }
}

// ---- Test 6: no em dash or en dash in the touched files ----
{
  const DASH = /[\u2013\u2014]/;
  const files = new Set();
  const d = git(['diff', '--name-only', BASE, '--']);
  if (d.status === 0) d.stdout.split('\n').filter(Boolean).forEach((f) => files.add(f));
  files.add('tests/test-389-renames.cjs');
  files.add('.planning/phases/389-pyramid-seed-and-full-replaces-the-mva-family/389-rename.cjs');
  const dirty = [];
  for (const f of files) {
    if (f.startsWith('.planning/') && !f.endsWith('389-rename.cjs')) continue;
    if (!exists(f)) continue;
    // Only lines this plan added count; older text of a touched file is not ours.
    const addedLines = f === 'tests/test-389-renames.cjs' || f.endsWith('389-rename.cjs')
      ? fs.readFileSync(rel(f), 'utf8').split('\n')
      : git(['diff', '-U0', BASE, '--', f]).stdout.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++'));
    if (addedLines.some((l) => DASH.test(l))) dirty.push(f);
  }
  check('Test 6: no em dash or en dash in the lines this plan wrote (' + files.size + ' files)', dirty.length === 0, dirty.join(', '));
}

console.log('test-389-renames: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
