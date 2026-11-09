#!/usr/bin/env node
// Phase 389 plan 08: the pipeline skill, the option command, the option skill and the
// option router are retired (owner D3 and D4). This test pins that the files are gone,
// that no registry row or live caller still names them, that the deprecation record
// exists, and that the Seed record path resolves the hand-off without the router.
// Node built-ins only. Plain counters. Hyphens only. Exit 1 on a failure.
//
// Scope notes (all stated, none hidden):
// - dist/ copies stay stale by design (carry-over list); no dist leg is asserted here.
// - data/command-irreversibility-ledger.json is add-only and keeps its rows.
// - CHANGELOG.md, data/command-deprecations.json, .planning and the 389 test files may
//   name the retired tokens (history or assertion text).
// - Plan 10 removed scripts/mva-run.cjs and lib/core/mva-orchestrator.cjs (owner D6), so
//   the one comment-only exception that used to be listed here is gone and Test 4 asserts it.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
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
const read = (p) => fs.readFileSync(rel(p), 'utf8');

// Token finder. Hyphenated names only: the telemetry event mva_option_selected stays (plan 13).
const TOKENS = {
  pipeline: /mva-pipeline/,
  option: /mva-option(?!-router)/,
  router: /mva-option-router/,
  anyOption: /mva-option/,
};
function names(text, key) {
  return TOKENS[key].test(text);
}

// ---- Mutation arm: the finder is not vacuous ----
check('Mutation: finder flags skills/mva-pipeline in a synthetic text', names('see skills/mva-pipeline/SKILL.md', 'pipeline'));
check('Mutation: finder flags /mos:mva-option in a synthetic text', names('"/mos:mva-option": {}', 'option'));
check('Mutation: finder flags the router path in a synthetic text', names("require('./mva-option-router.cjs')", 'router'));
check('Mutation: finder passes a clean text', !names('structure-argument and ignite', 'anyOption') && !names('mva_option_selected', 'anyOption'));
{
  // A registry copy with one injected row must be caught by the same finder.
  const mutated = read('data/command-registry.json') + ' "/mos:mva-option" ';
  check('Mutation: an injected row in a copy of the command registry is caught', names(mutated, 'option'));
}

// ---- Test 1 (D3): the pipeline skill ----
check('Test 1: skills/mva-pipeline does not exist', !exists('skills/mva-pipeline'));
{
  const allow = read('data/connector-out-of-spine-allowlist.json');
  check('Test 1: the out-of-spine allowlist has no mva-pipeline row', !names(allow, 'pipeline'));
}
const GENERATED_DATA = [
  'data/brain-orchestration-projection.json',
  'data/command-registry.json',
  'data/connector-coverage-ledger.json',
  'data/connector-registry.json',
  'data/help-groups.json',
  'data/hitl-shape-backfill.json',
  'data/jev-labels/command-irreversibility.json',
  'data/layer-backfill.json',
  'data/orchestration-command-ledger.json',
  'data/render-coverage-registry.json',
  'data/section-command-ledger.json',
  'data/section-command-relevance.json',
  'data/connector-out-of-spine-allowlist.json',
];
for (const f of GENERATED_DATA) {
  check('Test 1: ' + f + ' names no mva-pipeline', !names(read(f), 'pipeline'));
}
for (const f of ['scripts/build-render-coverage.cjs', 'tests/test-209-declared-implies-wired.cjs']) {
  check('Test 1: ' + f + ' does not name mva-pipeline', !names(read(f), 'pipeline'));
}
check('Test 1: skills/vault and commands/vault do not name mva-pipeline', !names(read('commands/vault.md'), 'pipeline') && !names(read('skills/vault/SKILL.md'), 'pipeline'));

// ---- Test 2 (D4): the option command, skill and router ----
for (const f of [
  'commands/mva-option.md',
  'skills/mva-option',
  'lib/core/mva-option-router.cjs',
  'lib/core/mva-option-router.test.cjs',
  'tests/test-mva-from-brief.cjs',
]) {
  check('Test 2: ' + f + ' does not exist', !exists(f));
}
for (const f of GENERATED_DATA.concat([
  'tests/fixtures/341-registry-drift-baseline.json',
  'ui/mindrian-workspace-mod/assets/command-registry.json',
  'ui/mos-face/hooks/commands.ts',
  'lib/mos-face/dist/commands.js',
])) {
  check('Test 2: ' + f + ' names no mva-option', !names(read(f), 'anyOption'));
}
for (const f of [
  'tests/run-all-118.sh',
  'lib/memory/run-feynman-tests.cjs',
  'tests/test-121-01-scaffold.sh',
  'tests/test-383-sourced-number.cjs',
  'lib/conversation/operator.cjs',
  'lib/conversation/operator.test.cjs',
  'commands/vault.md',
  'skills/vault/SKILL.md',
  'commands/ignite.md',
  'commands/new-project.md',
  'skills/ignite/SKILL.md',
  'skills/new-project/SKILL.md',
  'lib/core/pyramid-seed-record.cjs',
]) {
  check('Test 2: ' + f + ' names no mva-option and no router', !names(read(f), 'anyOption'));
}
check('Test 2: lib/conversation/operator.cjs keeps transitionViaMVAOption (Phase 390 candidate, not deleted here)',
  /transitionViaMVAOption/.test(read('lib/conversation/operator.cjs')));

// ---- Test 3 (D4): the deprecation record ----
{
  const dep = JSON.parse(read('data/command-deprecations.json'));
  const rows = (dep.deprecations || []).filter((d) => d.command === '/mos:mva-option');
  check('Test 3: exactly one deprecation entry for /mos:mva-option', rows.length === 1, String(rows.length));
  const e = rows[0] || {};
  check('Test 3: replaced_by is /mos:structure-argument', e.replaced_by === '/mos:structure-argument', String(e.replaced_by));
  check('Test 3: decided_by is navigator', e.decided_by === 'navigator');
  check('Test 3: retired_in is 2.0.0-beta.85 (the release that carries this change; releases step by 2: 81, 83, 85; no v prefix)', e.retired_in === '2.0.0-beta.85', String(e.retired_in));
  check('Test 3: date is YYYY-MM-DD', /^\d{4}-\d{2}-\d{2}$/.test(e.date || ''), String(e.date));
  check('Test 3: reason is one sentence', typeof e.reason === 'string' && e.reason.length > 20 && (e.reason.match(/[.!?](\s|$)/g) || []).length === 1, String(e.reason));
  check('Test 3: record names Phase 389 plan 08', /389/.test(e.record || ''), String(e.record));
  const r = cp.spawnSync('node', [rel('scripts/check-registry-drift.cjs'), '--check'], { encoding: 'utf8', cwd: ROOT, env: Object.assign({}, process.env, { HOME: process.env.HOME }) });
  check('Test 3: check-registry-drift --check passes', r.status === 0, (r.stdout + r.stderr).split('\n').slice(-4).join(' | '));
}

// ---- Test 4: no tracked file outside the exceptions names a retired token ----
{
  const ls = cp.spawnSync('git', ['ls-files'], { encoding: 'utf8', cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });
  const files = ls.stdout.split('\n').filter(Boolean);
  const EXEMPT_PREFIX = ['.planning/', 'dist/', 'docs/autopsies/', 'node_modules/'];
  const EXEMPT_FILE = new Set([
    'CHANGELOG.md',
    'data/command-deprecations.json',
    'data/command-irreversibility-ledger.json', // add-only ledger, keeps its rows
    'tests/test-389-retire-option.cjs',
    'tests/test-389-stale-text.cjs',
    'tests/test-389-seed-record.cjs',
  ]);
  // No comment-only exception remains (plan 10 removed scripts/mva-run.cjs).
  const COMMENT_ONLY = new Set();
  const hits = [];
  for (const f of files) {
    if (EXEMPT_FILE.has(f) || COMMENT_ONLY.has(f)) continue;
    if (EXEMPT_PREFIX.some((p) => f.startsWith(p))) continue;
    if (!/\.(cjs|js|mjs|ts|json|sh|md|html|yml|yaml)$/.test(f) && !/^(scripts|hooks)\//.test(f)) continue;
    let t;
    try {
      if (!fs.existsSync(rel(f))) continue; // tracked but deleted in the working tree
      t = fs.readFileSync(rel(f), 'utf8');
    } catch (e) {
      continue;
    }
    if (names(t, 'pipeline') || names(t, 'anyOption')) hits.push(f);
  }
  check('Test 4: zero tracked files outside the exceptions name mva-pipeline, mva-option or the router', hits.length === 0, hits.join(', '));
  check('Test 4: the one old exception (scripts/mva-run.cjs) was removed by plan 10, so no exception is left', !exists('scripts/mva-run.cjs'));
}

// ---- Test 5: no dash characters in the files this plan touches ----
{
  const dashRe = new RegExp('[\\u2013\\u2014]');
  const touched = [
    'tests/test-389-retire-option.cjs',
    'data/command-deprecations.json',
    'commands/vault.md',
    'skills/vault/SKILL.md',
    'lib/conversation/operator.cjs',
    'lib/conversation/operator.test.cjs',
    'lib/core/pyramid-seed-record.cjs',
    'tests/run-all-118.sh',
    'tests/test-121-01-scaffold.sh',
    'tests/test-383-sourced-number.cjs',
    'scripts/build-render-coverage.cjs',
  ];
  const bad = touched.filter((f) => dashRe.test(read(f)));
  check('Test 5: no en dash or em dash in the touched files', bad.length === 0, bad.join(', '));
}

console.log('');
console.log('test-389-retire-option: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
