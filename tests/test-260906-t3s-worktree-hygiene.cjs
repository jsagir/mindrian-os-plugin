#!/usr/bin/env node
'use strict';

/**
 * tests/test-260906-t3s-worktree-hygiene.cjs -- QUICK-260906-t3s Task 1.
 *
 * BSL 1.1. Copyright (c) Mindrian 2026.
 *
 * Hermetic fixture coverage for scripts/check-worktree-hygiene.cjs and
 * lib/core/repo-version.cjs. Every fixture is a disposable git repo built with
 * fs.mkdtempSync; the real MindrianOS-Plugin repo and its real
 * .claude/worktrees/ are NEVER touched -- the script's own `--root` flag
 * exists for exactly this, so the destructive half of this suite (--prune
 * --confirm) is exercised for real against throwaway fixtures, never the live
 * tree.
 *
 * Background: docs/autopsies/2026-09-06-worktree-version-contamination-incident.md.
 * 46 of 59 checkout directories under .claude/worktrees/ turned out to be
 * orphans whose git admin records pointed at a retired workspace path; an
 * unscoped version search walked into one and returned a months-old answer.
 * This suite proves the classifier this repo now trusts to tell an orphan
 * that is safe to delete from one that is not.
 *
 * Run: node tests/test-260906-t3s-worktree-hygiene.cjs
 * Exit 0 on pass, 1 on any failure.
 */

const { execSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(REPO_ROOT, 'scripts', 'check-worktree-hygiene.cjs');
const REPO_VERSION_MODULE = path.join(REPO_ROOT, 'lib', 'core', 'repo-version.cjs');

let passCount = 0;
let failCount = 0;
function record(name, fn) {
  try {
    fn();
    process.stdout.write('  ok  ' + name + '\n');
    passCount += 1;
  } catch (err) {
    process.stdout.write('  FAIL  ' + name + '\n');
    process.stdout.write('        ' + (err && err.stack ? err.stack : err) + '\n');
    failCount += 1;
  }
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error((msg || 'assertion failed') + ' -- expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
  }
}

// ---------------------------------------------------------------------------
// Fixture construction: a disposable git repo with one known committed blob,
// so the classifier has an object database to check against.
// ---------------------------------------------------------------------------
function buildFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-t3s-hygiene-'));
  fs.mkdirSync(path.join(dir, '.claude-plugin'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.claude-plugin', 'plugin.json'), JSON.stringify({ name: 'fixture', version: '9.9.9-fixture' }));
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'fixture', version: '9.9.9-fixture' }));
  fs.writeFileSync(path.join(dir, 'README.md'), 'known committed content\n');
  execSync('git init -q', { cwd: dir });
  execSync('git config user.email test@mindrian', { cwd: dir });
  execSync('git config user.name test', { cwd: dir });
  execSync('git add -A', { cwd: dir });
  execSync('git commit -q -m seed', { cwd: dir });
  return dir;
}

function mkOrphanDir(fixture, name) {
  const dir = path.join(fixture, '.claude', 'worktrees', name);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function runScript(fixture, args) {
  return spawnSync(process.execPath, [SCRIPT, '--root', fixture, ...(args || [])], { encoding: 'utf8' });
}

function parseJsonReport(res) {
  return JSON.parse(res.stdout);
}

// ---------------------------------------------------------------------------
// lib/core/repo-version.cjs
// ---------------------------------------------------------------------------

record('repo-version: readRepoVersion resolves a clean fixture root with no mismatch', () => {
  const fixture = buildFixture();
  try {
    const { readRepoVersion } = require(REPO_VERSION_MODULE);
    const info = readRepoVersion(fixture);
    assertEqual(info.version, '9.9.9-fixture', 'version');
    assertEqual(path.resolve(info.root), path.resolve(fixture), 'root');
    assertEqual(info.mismatch, null, 'mismatch');
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

record('repo-version: resolveRepoRoot refuses a path under .claude/worktrees/', () => {
  const fixture = buildFixture();
  try {
    const contaminated = mkOrphanDir(fixture, 'agent-zz');
    fs.mkdirSync(path.join(contaminated, '.claude-plugin'), { recursive: true });
    fs.writeFileSync(path.join(contaminated, '.claude-plugin', 'plugin.json'), JSON.stringify({ version: '1.0.0-stale' }));
    fs.writeFileSync(path.join(contaminated, 'package.json'), JSON.stringify({ version: '1.0.0-stale' }));
    const { resolveRepoRoot } = require(REPO_VERSION_MODULE);
    let threw = null;
    try {
      resolveRepoRoot(path.join(contaminated, 'lib'));
    } catch (e) {
      threw = e;
    }
    if (!threw) throw new Error('expected resolveRepoRoot to refuse a worktree-contaminated path; it returned instead');
    if (!/worktree checkout/i.test(threw.message)) throw new Error('error message did not name worktree contamination: ' + threw.message);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

record('repo-version: resolveRepoRoot refuses a worktrees/agent-* segment even without a leading .claude', () => {
  const fixture = buildFixture();
  try {
    const contaminated = path.join(fixture, 'worktrees', 'agent-yy');
    fs.mkdirSync(path.join(contaminated, '.claude-plugin'), { recursive: true });
    fs.writeFileSync(path.join(contaminated, '.claude-plugin', 'plugin.json'), JSON.stringify({ version: '1.0.0-stale' }));
    fs.writeFileSync(path.join(contaminated, 'package.json'), JSON.stringify({ version: '1.0.0-stale' }));
    const { resolveRepoRoot } = require(REPO_VERSION_MODULE);
    let threw = null;
    try {
      resolveRepoRoot(contaminated);
    } catch (e) {
      threw = e;
    }
    if (!threw) throw new Error('expected resolveRepoRoot to refuse a worktrees/agent-* path; it returned instead');
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

record('repo-version CLI: exits 0 and prints the bare version against the real repo', () => {
  const res = spawnSync(process.execPath, [REPO_VERSION_MODULE], { encoding: 'utf8' });
  assertEqual(res.status, 0, 'exit code');
  if (!/^\S+\n$/.test(res.stdout)) throw new Error('expected a single bare version line, got: ' + JSON.stringify(res.stdout));
});

record('repo-version CLI: --json reports root + mismatch:null against the real repo', () => {
  const res = spawnSync(process.execPath, [REPO_VERSION_MODULE, '--json'], { encoding: 'utf8' });
  assertEqual(res.status, 0, 'exit code');
  const parsed = JSON.parse(res.stdout);
  assertEqual(parsed.mismatch, null, 'mismatch');
  if (!parsed.root || !parsed.version) throw new Error('expected root and version in --json output, got: ' + res.stdout);
});

record('repo-version CLI: exits 1 with a named error when its own file sits under a worktree-checkout path', () => {
  const fixture = buildFixture();
  try {
    const fakeWorktreeLibCore = path.join(fixture, '.claude', 'worktrees', 'agent-cli-contaminated', 'lib', 'core');
    fs.mkdirSync(fakeWorktreeLibCore, { recursive: true });
    const copiedModule = path.join(fakeWorktreeLibCore, 'repo-version.cjs');
    fs.copyFileSync(REPO_VERSION_MODULE, copiedModule);
    const worktreeRoot = path.join(fixture, '.claude', 'worktrees', 'agent-cli-contaminated');
    fs.mkdirSync(path.join(worktreeRoot, '.claude-plugin'), { recursive: true });
    fs.writeFileSync(path.join(worktreeRoot, '.claude-plugin', 'plugin.json'), JSON.stringify({ version: '1.0.0-stale' }));
    fs.writeFileSync(path.join(worktreeRoot, 'package.json'), JSON.stringify({ version: '1.0.0-stale' }));
    const res = spawnSync(process.execPath, [copiedModule], { encoding: 'utf8' });
    assertEqual(res.status, 1, 'exit code');
    if (!/worktree checkout/i.test(res.stderr)) throw new Error('stderr did not name worktree contamination: ' + res.stderr);
    if (/1\.0\.0-stale/.test(res.stdout)) throw new Error('CLI printed the stale version on stdout instead of refusing');
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// scripts/check-worktree-hygiene.cjs
// ---------------------------------------------------------------------------

record('hygiene: a fixture with no .claude/worktrees/ directory exits 0 with zero orphans', () => {
  const fixture = buildFixture();
  try {
    const res = runScript(fixture, ['--json']);
    assertEqual(res.status, 0, 'exit code');
    const report = parseJsonReport(res);
    assertEqual(report.total, 0, 'total on disk');
    assertEqual(report.registeredCount, 0, 'registered count');
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

record('hygiene: a git-worktree-add checkout is classified registered and untouched by --prune --confirm', () => {
  const fixture = buildFixture();
  let wtPath = null;
  try {
    wtPath = path.join(fixture, '.claude', 'worktrees', 'agent-registered');
    execSync('git worktree add -q ' + JSON.stringify(wtPath) + ' -b wt-registered-branch', { cwd: fixture });
    const res = runScript(fixture, ['--json']);
    const report = parseJsonReport(res);
    assertEqual(report.registeredCount, 1, 'registered count');
    assertEqual(report.nonRegistered.length, 0, 'no non-registered entries');
    const pruneRes = runScript(fixture, ['--prune', '--confirm']);
    assertEqual(pruneRes.status, 0, 'prune exit code');
    if (!fs.existsSync(wtPath)) throw new Error('a registered worktree was deleted by --prune --confirm');
  } finally {
    if (wtPath) {
      try {
        execSync('git worktree remove --force ' + JSON.stringify(wtPath), { cwd: fixture });
      } catch {
        /* best effort; the fixture is about to be nuked wholesale anyway */
      }
    }
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

record('hygiene: an unregistered directory whose content is already committed is classified safe-orphan', () => {
  const fixture = buildFixture();
  try {
    const orphan = mkOrphanDir(fixture, 'agent-safe');
    fs.writeFileSync(path.join(orphan, 'README.md'), 'known committed content\n');
    const res = runScript(fixture, ['--json']);
    assertEqual(res.status, 1, 'check exits 1 (an orphan exists)');
    const report = parseJsonReport(res);
    const entry = report.nonRegistered.find((r) => r.basename === 'agent-safe');
    if (!entry) throw new Error('agent-safe missing from report');
    assertEqual(entry.status, 'safe-orphan', 'status');
    assertEqual(entry.counts.tracked_modified, 0, 'tracked_modified');
    assertEqual(entry.counts.untracked_unique, 0, 'untracked_unique');
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

record('hygiene: an unregistered directory holding unique content is classified review and survives --prune --confirm', () => {
  const fixture = buildFixture();
  try {
    const orphan = mkOrphanDir(fixture, 'agent-review');
    fs.writeFileSync(path.join(orphan, 'unique-notes.txt'), 'this content was never committed anywhere ' + Date.now());
    const before = runScript(fixture, ['--json']);
    const beforeReport = parseJsonReport(before);
    const entry = beforeReport.nonRegistered.find((r) => r.basename === 'agent-review');
    if (!entry) throw new Error('agent-review missing from report');
    assertEqual(entry.status, 'review', 'status');
    if (entry.counts.untracked_unique < 1) throw new Error('expected untracked_unique >= 1, got ' + entry.counts.untracked_unique);

    const pruneRes = runScript(fixture, ['--prune', '--confirm']);
    assertEqual(pruneRes.status, 0, 'prune exit code');
    if (!fs.existsSync(orphan)) throw new Error('a review directory was deleted by --prune --confirm');
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

record('hygiene: unique content confined to .planning/ is safe-orphan (non-blocking) but review under --strict-planning', () => {
  const fixture = buildFixture();
  try {
    const orphan = mkOrphanDir(fixture, 'agent-planning-only');
    fs.mkdirSync(path.join(orphan, '.planning'), { recursive: true });
    fs.writeFileSync(path.join(orphan, '.planning', 'notes.md'), 'stale planning bytes ' + Date.now());

    const res = runScript(fixture, ['--json']);
    const report = parseJsonReport(res);
    const entry = report.nonRegistered.find((r) => r.basename === 'agent-planning-only');
    if (!entry) throw new Error('agent-planning-only missing from report');
    assertEqual(entry.status, 'safe-orphan', 'status (default)');
    if (entry.counts.planning_unique < 1) throw new Error('expected planning_unique >= 1, got ' + entry.counts.planning_unique);

    const strictRes = runScript(fixture, ['--json', '--strict-planning']);
    const strictReport = parseJsonReport(strictRes);
    const strictEntry = strictReport.nonRegistered.find((r) => r.basename === 'agent-planning-only');
    assertEqual(strictEntry.status, 'review', 'status (--strict-planning)');
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

record('hygiene: unique content in a known ephemeral runtime-cache path is safe-orphan (non-blocking) but review under --strict-ephemeral', () => {
  const fixture = buildFixture();
  try {
    const orphan = mkOrphanDir(fixture, 'agent-ephemeral-only');
    fs.mkdirSync(path.join(orphan, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(orphan, '.claude', 'settings.local.json'), JSON.stringify({ someLocalSetting: Date.now() }));
    fs.mkdirSync(path.join(orphan, 'room', '.mindrian'), { recursive: true });
    fs.writeFileSync(path.join(orphan, 'room', '.mindrian', 'statusline-cache.json'), JSON.stringify({ cached: Date.now() }));

    const res = runScript(fixture, ['--json']);
    const report = parseJsonReport(res);
    const entry = report.nonRegistered.find((r) => r.basename === 'agent-ephemeral-only');
    if (!entry) throw new Error('agent-ephemeral-only missing from report');
    assertEqual(entry.status, 'safe-orphan', 'status (default)');
    if (entry.counts.ephemeral_unique < 2) throw new Error('expected ephemeral_unique >= 2, got ' + entry.counts.ephemeral_unique);
    assertEqual(entry.counts.untracked_unique, 0, 'these two paths must not also count as untracked_unique');

    const strictRes = runScript(fixture, ['--json', '--strict-ephemeral']);
    const strictReport = parseJsonReport(strictRes);
    const strictEntry = strictReport.nonRegistered.find((r) => r.basename === 'agent-ephemeral-only');
    assertEqual(strictEntry.status, 'review', 'status (--strict-ephemeral)');

    const pruneRes = runScript(fixture, ['--prune', '--confirm']);
    assertEqual(pruneRes.status, 0, 'prune exit code');
    if (fs.existsSync(orphan)) throw new Error('a pure-ephemeral safe-orphan survived --prune --confirm under the default (non-strict) mode');
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

record('hygiene: a directory whose .git gitdir target still exists is classified live-gitdir and survives --prune --confirm', () => {
  const fixture = buildFixture();
  try {
    const orphan = mkOrphanDir(fixture, 'agent-live-gitdir');
    const gitdirTarget = path.join(fixture, '.git', 'worktrees', 'agent-live-gitdir-fake');
    fs.mkdirSync(gitdirTarget, { recursive: true });
    fs.writeFileSync(path.join(orphan, '.git'), 'gitdir: ' + gitdirTarget + '\n');

    const res = runScript(fixture, ['--json']);
    const report = parseJsonReport(res);
    const entry = report.nonRegistered.find((r) => r.basename === 'agent-live-gitdir');
    if (!entry) throw new Error('agent-live-gitdir missing from report');
    assertEqual(entry.status, 'live-gitdir', 'status');

    const pruneRes = runScript(fixture, ['--prune', '--confirm']);
    assertEqual(pruneRes.status, 0, 'prune exit code');
    if (!fs.existsSync(orphan)) throw new Error('a live-gitdir directory was deleted by --prune --confirm');
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

record('hygiene: a dead-gitdir .git pointer FILE is never itself counted as unique content (regression)', () => {
  const fixture = buildFixture();
  try {
    const orphan = mkOrphanDir(fixture, 'agent-dead-gitdir-safe');
    fs.writeFileSync(path.join(orphan, 'README.md'), 'known committed content\n');
    // A .git pointer file whose gitdir target does NOT exist: not live-gitdir
    // (falls through to the walk), and its own bytes must never be scanned as
    // content -- it is git plumbing, not something a human authored.
    fs.writeFileSync(path.join(orphan, '.git'), 'gitdir: /this/path/does/not/exist-should-be-skipped\n');
    const res = runScript(fixture, ['--json']);
    const report = parseJsonReport(res);
    const entry = report.nonRegistered.find((r) => r.basename === 'agent-dead-gitdir-safe');
    if (!entry) throw new Error('agent-dead-gitdir-safe missing from report');
    assertEqual(entry.status, 'safe-orphan', 'status (the dead .git pointer file must not block this)');
    assertEqual(entry.counts.untracked_unique, 0, 'untracked_unique (the .git file itself must not be counted)');
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

record('hygiene: --check exit codes -- 1 with an orphan, 0 with none, 0 under --advisory with the finding still printed', () => {
  const fixtureClean = buildFixture();
  try {
    const cleanRes = runScript(fixtureClean, []);
    assertEqual(cleanRes.status, 0, 'clean fixture exits 0');
  } finally {
    fs.rmSync(fixtureClean, { recursive: true, force: true });
  }

  const fixtureDirty = buildFixture();
  try {
    mkOrphanDir(fixtureDirty, 'agent-dirty');
    const dirtyRes = runScript(fixtureDirty, []);
    assertEqual(dirtyRes.status, 1, 'dirty fixture exits 1');

    const advisoryRes = runScript(fixtureDirty, ['--advisory']);
    assertEqual(advisoryRes.status, 0, 'advisory downgrades to 0');
    if (!/agent-dirty/.test(advisoryRes.stdout)) throw new Error('advisory mode must still print the finding');
  } finally {
    fs.rmSync(fixtureDirty, { recursive: true, force: true });
  }
});

record('hygiene: --prune without --confirm deletes nothing and reports DRY-RUN', () => {
  const fixture = buildFixture();
  try {
    const orphan = mkOrphanDir(fixture, 'agent-dryrun');
    fs.writeFileSync(path.join(orphan, 'README.md'), 'known committed content\n');
    const res = runScript(fixture, ['--prune']);
    if (!/DRY-RUN/.test(res.stdout)) throw new Error('expected a DRY-RUN line in stdout, got:\n' + res.stdout);
    if (!fs.existsSync(orphan)) throw new Error('directory was deleted despite --prune without --confirm');
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

record('hygiene: --prune --confirm actually deletes a genuine safe-orphan (positive control)', () => {
  const fixture = buildFixture();
  try {
    const orphan = mkOrphanDir(fixture, 'agent-delete-me');
    fs.writeFileSync(path.join(orphan, 'README.md'), 'known committed content\n');
    const res = runScript(fixture, ['--prune', '--confirm']);
    assertEqual(res.status, 0, 'exit code');
    if (fs.existsSync(orphan)) throw new Error('a safe-orphan directory survived --prune --confirm');
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

record('hygiene: --exclude <basename> keeps a safe-orphan directory out of the delete set', () => {
  const fixture = buildFixture();
  try {
    const orphan = mkOrphanDir(fixture, 'agent-excluded');
    fs.writeFileSync(path.join(orphan, 'README.md'), 'known committed content\n');
    const res = runScript(fixture, ['--prune', '--confirm', '--exclude', 'agent-excluded']);
    assertEqual(res.status, 0, 'exit code');
    if (!fs.existsSync(orphan)) throw new Error('an excluded safe-orphan directory was deleted anyway');
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

console.log('');
console.log(
  'worktree-hygiene tests: ' + passCount + ' passed, ' + failCount + ' failed (of ' + (passCount + failCount) + ')'
);
console.log('');

process.exit(failCount === 0 ? 0 : 1);
