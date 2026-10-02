#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 366 Plan 21 (EPV366-25, D-02): the static retirement gate for the
 * standalone Eureka runner. The navigator ruled `runner: retire` at plan 366-20
 * (366-SPIKE-RULINGS.md). This gate is written RED on purpose: RR1 and RR2 fail
 * while the runner files exist, and plan 366-22 deletes them and turns it green.
 *
 *   RR1  none of RUNNER_FILES exists on disk.
 *   RR2  no file under lib/, scripts/, hooks/, bin/ or tests/ requires or
 *        spawns a RUNNER_FILES path (a require of it, or a quoted path literal
 *        ending in its file name, the form a spawn argv or a path.join takes).
 *        In a shell file any non-comment mention counts (path lists, argv).
 *        Comment lines never count.
 *   RR3  commands/eureka.md and skills/eureka/SKILL.md carry no `--legacy`.
 *   RR4  lib/mcp/tool-router.cjs has no `flags.legacy` branch.
 *   RR5  every runner-inventory test that has been retired (deleted) is no
 *        longer named on any non-comment line of a tests/run-all-*.sh. Scoped to
 *        the frozen inventory: older aggregators carry unrelated guarded legs
 *        for files retired by other phases, which this gate does not own.
 *
 * RUNNER_FILES (computed at 366-21 Task 1): the two runner scripts. Every script
 * they require is also required outside the runner set (scripts/entity-extract.cjs
 * by research-filing, spike-366-prepare and rs-vector-bridge;
 * scripts/eureka-room-report.cjs by intel-pipeline), so neither is in the set.
 * lib/core/eureka/* stays (the semantic index, plan 366-23).
 *
 * Read-only: no repo module is loaded, no network, no write.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const SELF = path.relative(REPO, __filename).split(path.sep).join('/');

const RUNNER_FILES = Object.freeze([
  'scripts/eureka-command.cjs',
  'scripts/eureka-portfolio-report.cjs',
]);

// The frozen 366-21 inventory of tests that referenced RUNNER_FILES (the
// SUMMARY table carries the slice and decision per row).
const RUNNER_TESTS = Object.freeze([
  'tests/live-363.1-room-check.cjs',
  'tests/test-215-field-contract.cjs',
  'tests/test-215-portfolio-report.cjs',
  'tests/test-215-reproduction.cjs',
  'tests/test-216-eureka-command.cjs',
  'tests/test-216-field-contract.cjs',
  'tests/test-218-cohort-stratification.cjs',
  'tests/test-218-eureka-auto-extract.cjs',
  'tests/test-218-low-trust-exclusion.cjs',
  'tests/test-218-noise-reduction.cjs',
  'tests/test-218-scaffold-pair-filter.cjs',
  'tests/test-219-banking.cjs',
  'tests/test-226-degrade-cause.cjs',
  'tests/test-226-field-contract.cjs',
  'tests/test-226-mode-disclosure.cjs',
  'tests/test-226-pair-cap.cjs',
  'tests/test-226-posture.cjs',
  'tests/test-341-eureka-no-brain-reach.cjs',
  'tests/test-343-path-hygiene.cjs',
  'tests/test-355-eureka-ranking-pin.cjs',
  'tests/test-355-filing.cjs',
  'tests/test-355-floor-sweep.cjs',
  'tests/test-355-no-decimal.cjs',
  'tests/test-355-part8-egress.cjs',
  'tests/test-355-producer-eureka.cjs',
  'tests/test-355-stamp-coverage.cjs',
  'tests/test-3551-ambient-run.cjs',
  'tests/test-363.1-eureka-exclusion.cjs',
  'tests/test-363.1-eureka-status-race.cjs',
  'tests/test-363.1-eureka-tail.cjs',
  'tests/test-363.1-opp-statement.cjs',
  'tests/test-366-eureka-alias.cjs',
  'tests/test-366-eureka-filing.cjs',
  'tests/test-eureka-mcp-tools.cjs',
]);

const SCAN_DIRS = ['lib', 'scripts', 'hooks', 'bin', 'tests'];
const SKIP_DIRS = new Set(['node_modules', '.git', 'fixtures']);
const CODE_EXT = /\.(cjs|js|mjs|sh)$/;

let pass = 0;
let fail = 0;
function check(label, ok, detail) {
  if (ok) { pass += 1; console.log('PASS: ' + label); }
  else { fail += 1; console.log('FAIL: ' + label + (detail ? ' -- ' + detail : '')); }
}

function walk(dir, out) {
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (_e) { return out; }
  ents.forEach(function (e) {
    if (SKIP_DIRS.has(e.name)) return;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile() && CODE_EXT.test(e.name)) out.push(p);
  });
  return out;
}

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// A quoted string literal whose value ends in the runner file name: require
// paths, spawn argv entries and path.join segments all take this form.
const BASENAMES = RUNNER_FILES.map(function (f) { return path.basename(f); });
const REF_RE = new RegExp('[\'"`](?:[^\'"`\\n]*/)?(?:' + BASENAMES.map(escapeRe).join('|') + ')[\'"`]');
// In a shell file any non-comment mention is a reference (a path list, an argv).
const SH_REF_RE = new RegExp('(?:^|[\\s/\'"=])(?:' + BASENAMES.map(escapeRe).join('|') + ')', 'm');

function stripLineComments(text, isShell) {
  return text.split('\n').filter(function (line) {
    const t = line.trim();
    if (isShell) return t.indexOf('#') !== 0;
    return t.indexOf('//') !== 0 && t.indexOf('*') !== 0 && t.indexOf('/*') !== 0;
  }).join('\n');
}

// RR1
const present = RUNNER_FILES.filter(function (f) { return fs.existsSync(path.join(REPO, f)); });
check('RR1 none of RUNNER_FILES exists (' + RUNNER_FILES.join(', ') + ')', present.length === 0, 'still present: ' + present.join(', '));

// RR2
const offenders = [];
SCAN_DIRS.forEach(function (d) {
  walk(path.join(REPO, d), []).forEach(function (abs) {
    const rel = path.relative(REPO, abs).split(path.sep).join('/');
    if (rel === SELF) return;
    if (RUNNER_FILES.indexOf(rel) !== -1) return; // the runner files themselves are RR1's business
    const isShell = /\.sh$/.test(rel);
    const body = stripLineComments(fs.readFileSync(abs, 'utf8'), isShell);
    if ((isShell ? SH_REF_RE : REF_RE).test(body)) offenders.push(rel);
  });
});
check('RR2 no file under ' + SCAN_DIRS.join(', ') + ' requires or spawns a RUNNER_FILES path', offenders.length === 0, offenders.length + ' file(s): ' + offenders.join(', '));

// RR3
const legacyDocs = ['commands/eureka.md', 'skills/eureka/SKILL.md'].filter(function (f) {
  const p = path.join(REPO, f);
  return fs.existsSync(p) && fs.readFileSync(p, 'utf8').indexOf('--legacy') !== -1;
});
check('RR3 commands/eureka.md and skills/eureka/SKILL.md carry no --legacy', legacyDocs.length === 0, 'found in: ' + legacyDocs.join(', '));

// RR4
const routerPath = path.join(REPO, 'lib', 'mcp', 'tool-router.cjs');
const routerHit = fs.existsSync(routerPath) && fs.readFileSync(routerPath, 'utf8').indexOf('flags.legacy') !== -1;
check('RR4 lib/mcp/tool-router.cjs has no flags.legacy branch', !routerHit, 'flags.legacy still present');

// RR5
const aggregators = fs.readdirSync(path.join(REPO, 'tests')).filter(function (f) { return /^run-all-.*\.sh$/.test(f); });
const dangling = [];
RUNNER_TESTS.forEach(function (t) {
  if (fs.existsSync(path.join(REPO, t))) return;
  const name = path.basename(t);
  aggregators.forEach(function (a) {
    const body = stripLineComments(fs.readFileSync(path.join(REPO, 'tests', a), 'utf8'), true);
    if (body.indexOf(name) !== -1) dangling.push(a + ' -> ' + name);
  });
});
check('RR5 no run-all-*.sh names a retired runner-inventory test on a non-comment line', dangling.length === 0, dangling.join(', '));

console.log('--- test-366-runner-retired ---');
console.log('PASS: ' + pass + ' FAIL: ' + fail);
process.exitCode = fail === 0 ? 0 : 1;
