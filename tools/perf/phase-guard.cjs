#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 384 plan 01: the check that the commits of phase 384 stay inside tools/perf, tests/test-384-*
 * and the phase folder, and never touch a product path.
 *
 * Use: node tools/perf/phase-guard.cjs <BASE_SHA> [--repo <dir>] [--head <ref>]
 * It reads the history BASE_SHA..HEAD with git. Exit 0 when all rules hold, 1 otherwise, 2 on bad usage.
 *
 *   Rule a  A commit that touches a phase path touches no path outside the phase paths. The three GSD
 *           tracking files (.planning/STATE.md, .planning/ROADMAP.md, .planning/REQUIREMENTS.md) are ignored.
 *           Exception: a sha in KNOWN_PLANNING_ONLY_COMMITS is exempt when all its files are .planning/ markdown files.
 *   Rule b  No commit that touches a product path has the phase tag (384) in its subject.
 *   Rule c  No commit with the agent trailer (Claude Sonnet 5.5) touches a product path unless its subject
 *           carries a tag of another phase or of a quick task. A tagged peer commit is counted and noted, not failed.
 *
 * phase-guard sees commits only. It cannot see an uncommitted edit; the plan constraint C10 (a status check at the
 * start and the end of the plan) and review cover that. Node built-ins only. Hyphens only.
 */
const cp = require('node:child_process');

const PHASE_PATHS = ['tools/perf/', 'tests/test-384-', '.planning/phases/384-'];
const TRACKING = ['.planning/STATE.md', '.planning/ROADMAP.md', '.planning/REQUIREMENTS.md'];
// product paths for rules a and b
const PRODUCT = ['hooks/', 'scripts/', 'lib/', 'bin/', 'commands/', 'skills/', 'agents/', 'data/', 'ui/', 'package.json', 'npm-shrinkwrap.json'];
// product paths for rule c (agent commits)
const PRODUCT_C = ['hooks/', 'scripts/', 'lib/', 'bin/', 'data/', 'package.json', 'npm-shrinkwrap.json'];
// Explicit exception list for rule a ONLY (rules b and c never read it).
// 5d58018aa02cc432235fe892745a66b2ab566744: a main-session planning-document commit that carried a 384 note
// (384-LEADS.md) together with other planning files (a handoff and a 390 PRD). It touches only .planning/ markdown
// and no product path. History is not rewritten, so the commit is named here. The exemption is checked at run time
// (see isPlanningOnly): every file of the commit must be under .planning/ and end in .md, otherwise it does not apply.
// Add a sha only with the same kind of reason and a full 40-character sha.
const KNOWN_PLANNING_ONLY_COMMITS = [
  '5d58018aa02cc432235fe892745a66b2ab566744',
];
const PHASE_TAG = /\((384(\.[0-9]+)?[-)]|phase-384\b)/;
const OTHER_TAG = /\(([0-9][0-9A-Za-z.]*-[0-9A-Za-z]+|phase-[0-9][0-9.]*|quick[^)]*)\)/;
const AGENT_TRAILER = /Claude Sonnet 5\.5/;

function startsWithAny(file, prefixes) { return prefixes.some((p) => file === p || file.startsWith(p)); }

function git(repo, args) {
  const r = cp.spawnSync('git', args, { cwd: repo, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error('git ' + args.join(' ') + ' failed: ' + String(r.stderr).trim().slice(0, 200));
  return r.stdout;
}

// True only when every file of the commit is a markdown file under .planning/ (so the list cannot hide a product change).
function isPlanningOnly(files) {
  return files.length > 0 && files.every((f) => f.startsWith('.planning/') && f.endsWith('.md'));
}

function checkHistory(repo, base, head, exempt) {
  const exemptList = Array.isArray(exempt) ? exempt : KNOWN_PLANNING_ONLY_COMMITS;
  const shas = git(repo, ['rev-list', '--reverse', base + '..' + head]).split('\n').filter(Boolean);
  const violations = [];
  const notes = [];
  let peers = 0;
  for (const sha of shas) {
    const subject = git(repo, ['show', '-s', '--format=%s', sha]).trim();
    const body = git(repo, ['show', '-s', '--format=%B', sha]);
    const files = git(repo, ['diff-tree', '--no-commit-id', '--name-only', '-r', '-m', '--root', sha]).split('\n').filter(Boolean);
    const short = sha.slice(0, 9);
    const touchesPhase = files.some((f) => startsWithAny(f, PHASE_PATHS));
    const productFiles = files.filter((f) => startsWithAny(f, PRODUCT));
    if (touchesPhase) {
      const outside = files.filter((f) => !startsWithAny(f, PHASE_PATHS) && TRACKING.indexOf(f) === -1);
      if (outside.length && exemptList.indexOf(sha) !== -1 && isPlanningOnly(files)) {
        notes.push('known planning-only commit exempt from rule a: ' + short);
      } else if (outside.length) violations.push('rule a: ' + short + ' touches a phase path and also ' + outside.slice(0, 3).join(', ') + (outside.length > 3 ? ' (+' + (outside.length - 3) + ')' : ''));
    }
    if (productFiles.length && PHASE_TAG.test(subject)) {
      violations.push('rule b: ' + short + ' has the phase tag and touches ' + productFiles.slice(0, 3).join(', '));
      continue;
    }
    const agentProduct = files.filter((f) => startsWithAny(f, PRODUCT_C));
    if (agentProduct.length && AGENT_TRAILER.test(body)) {
      if (!OTHER_TAG.test(subject)) violations.push('rule c: ' + short + ' has the agent trailer, an untagged subject and touches ' + agentProduct.slice(0, 3).join(', '));
    }
    if (productFiles.length && !touchesPhase) peers += 1;
  }
  return { commits: shas.length, violations, notes, peers };
}

function main(argv) {
  let base = null;
  let repo = process.cwd();
  let head = 'HEAD';
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--repo') { repo = argv[i + 1]; i += 1; } else if (a === '--head') { head = argv[i + 1]; i += 1; } else if (a.startsWith('--')) { process.stderr.write('unknown argument: ' + a + '\n'); return 2; } else if (!base) base = a;
  }
  if (!base || !repo || !head) { process.stderr.write('usage: phase-guard.cjs <BASE_SHA> [--repo <dir>] [--head <ref>]\n'); return 2; }
  let res;
  try { res = checkHistory(repo, base, head); } catch (e) { process.stderr.write(String(e.message) + '\n'); return 2; }
  process.stdout.write('phase-guard: ' + res.commits + ' commit(s) checked\n');
  process.stdout.write('note: peer commits touching product paths: ' + res.peers + '\n');
  res.notes.forEach((n) => process.stdout.write('note: ' + n + '\n'));
  if (res.violations.length) {
    res.violations.forEach((v) => process.stderr.write('phase-guard: ' + v + '\n'));
    process.stdout.write('phase-guard: FAIL\n');
    return 1;
  }
  process.stdout.write('phase-guard: OK\n');
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { checkHistory, isPlanningOnly, KNOWN_PLANNING_ONLY_COMMITS,PHASE_PATHS, PRODUCT, PRODUCT_C, PHASE_TAG, OTHER_TAG };
