#!/usr/bin/env node
/**
 * check-worktree-hygiene.cjs
 *
 * QUICK-260906-t3s. Diffs the checkout directories physically present under
 * `.claude/worktrees/` against what `git worktree list` actually registers,
 * classifies every unregistered one, and is the ONLY governed path allowed to
 * delete one. There is no other place in this repo that types `rm -rf` against
 * `.claude/worktrees/` -- the script that finds the orphans is the script that
 * is allowed to remove them (docs/autopsies/2026-09-06-worktree-version-contamination-incident.md,
 * design decision DD-1).
 *
 * WHY THIS EXISTS. On 2026-09-06 this repo moved from `~/MindrianOS-Plugin/` to
 * `~/dev/MindrianOS-Plugin/`. 59 agent-session worktree checkouts under
 * `.claude/worktrees/` came along as plain directories, but their linked-worktree
 * admin records (`.git/worktrees/agent-<hash>` under the OLD repo root) did not.
 * `git worktree prune` cannot see them any more -- from git's point of view there
 * is nothing there to prune -- so they were never going to be reclaimed on their
 * own. 46 of the 59 were stale fossils, some from May 2026, together 3.9GB. An
 * unscoped find/grep for "the current plugin version" walked into one of them
 * and returned a months-old version as if it were current. This script is the
 * fix: a governed classify-then-prune path, plus (via lib/core/repo-version.cjs)
 * a canonical version answer that refuses to be fooled the same way again.
 *
 * CLASSIFICATION. For each directory on disk under `.claude/worktrees/` that is
 * NOT in `git worktree list`'s output:
 *   - `live-gitdir`   its `.git` file's gitdir target still exists somewhere.
 *                     Git has not forgotten it even though the registry did not
 *                     name it (a registry that is mid-write, or a worktree of a
 *                     different repo). Never deleted.
 *   - `safe-orphan`   every file it holds, minus a skip set (node_modules, .git,
 *                     build output, caches), hashes to a git blob this repo's
 *                     object database already has. Its content exists nowhere
 *                     else. Eligible for `--prune --confirm`.
 *   - `review`        it holds at least one file (outside `.planning/`, which is
 *                     gitignored and reported separately as non-blocking) whose
 *                     content is not in the object database -- either a tracked
 *                     repo-source path with real uncommitted edits, or a file
 *                     that was never committed anywhere. Never auto-deleted by
 *                     any flag.
 * Registered directories are counted but never printed per-line or touched.
 *
 * EPHEMERAL RUNTIME STATE (human-ratified 2026-09-06, QUICK-260906-t3s Task 2
 * checkpoint). A first live run against this repo's real 46 orphans found
 * every single one held SOME content missing from the object database, almost
 * all of it recognizable local runtime/session-cache noise: `.claude/settings.local.json`
 * (all 46), `room/.mindrian/statusline-cache.json`, `room/.analytics.json`,
 * `dashboard/graph.json`, and `.mindrian/`-scoped test-fixture scratch state
 * (`brain-derivation-queue.json`, `auto-commit-throttle.json`,
 * `last-cascade.json`, `pending-stamps/.mindrian.json`). None of that is
 * something a human authored or would grieve losing; it regenerates on the
 * next run. The navigator ratified treating it as non-blocking, the same way
 * `.planning/` already is, via an explicit Decision Gate rather than a silent
 * widening (DD-2's own caution: growing what counts as "safe" must be a
 * deliberate, reviewed act). `--strict-ephemeral` restores it to a blocker for
 * anyone who disagrees, mirroring `--strict-planning`.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO. It does not trust commit reachability as
 * the safety signal: once a linked worktree's admin record is gone, git has
 * already forgotten any commits it made (they are gc-able), so the only thing
 * genuinely at risk is file content that exists nowhere else. That is exactly
 * what the blob-presence check tests.
 *
 * Exit codes (--check, the default action):
 *   0 -- no unregistered directories found, or --advisory was passed
 *   1 -- at least one unregistered directory found (safe-orphan, review, or
 *        live-gitdir all count -- the gate cares about drift existing at all,
 *        not just about what is deletable)
 *   2 -- scanner failure (git worktree list / git ls-files failed, root
 *        missing, or an internal error)
 * Exit codes (--prune): 0 on a completed run (dry-run or real), 2 on failure.
 *
 * Canon Part 8: every operation here is a local filesystem read/write or a
 * local `git` plumbing call. Zero network.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const { readRepoVersion } = require('../lib/core/repo-version.cjs');

// Directories never walked inside a candidate checkout, each for a stated
// reason: none of these can hold content that exists nowhere else in any way
// that matters to this gate.
//   node_modules -- reinstallable dependency output, not source
//   .git         -- the checkout's own git admin data, not tracked content
//   dist/build   -- build output, reproducible from source
//   coverage     -- test-run output, reproducible
//   .next        -- framework build cache
//   __pycache__  -- Python bytecode cache
//   .venv        -- Python virtualenv, reinstallable
//   .cache       -- generic tool cache
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '__pycache__', '.venv', '.cache']);

// A directory with more files than this after the skip set is not walked file
// by file; it is reported for a human to look at rather than churned over.
const MAX_FILES = 20000;

// Ephemeral local runtime/session-cache paths (human-ratified 2026-09-06, see
// the top-of-file note): unique content confined to these never blocks
// safe-orphan classification unless --strict-ephemeral is passed. Any path
// carrying a `.mindrian` directory segment anywhere (MindrianOS's own
// runtime-state convention, analogous to `.git/` or `node_modules/`) plus
// three named exact paths sampled from the live incident.
const EPHEMERAL_SEGMENT = '.mindrian';
const EPHEMERAL_EXACT_PATHS = new Set(['.claude/settings.local.json', 'room/.analytics.json', 'dashboard/graph.json']);

function isEphemeralPath(rel) {
  if (EPHEMERAL_EXACT_PATHS.has(rel)) return true;
  return rel.split('/').includes(EPHEMERAL_SEGMENT);
}

function usage() {
  return [
    'check-worktree-hygiene.cjs -- classify and (optionally) prune orphaned',
    '.claude/worktrees/* checkout directories.',
    '',
    'Flags:',
    '  --check              classify and report (default action)',
    '  --prune              propose deleting the safe-orphan set (dry-run unless --confirm)',
    '  --confirm            actually delete under --prune (without it, --prune only prints DRY-RUN lines)',
    '  --exclude <basename> exclude one directory (repeatable) from the safe-orphan delete set',
    '  --json               emit the report as one JSON object instead of prose',
    '  --advisory           report only; always exit 0 regardless of findings',
    '  --strict-planning    treat unique content under .planning/ as a blocker too',
    '  --strict-ephemeral   treat unique content in known runtime-cache paths (.mindrian/, settings.local.json, etc.) as a blocker too',
    '  --root <dir>         operate against <dir> instead of the live repo root (tests use this)',
    '  --help               show this message',
  ].join('\n');
}

// listOnDisk(root): absolute paths of immediate subdirectories of
// <root>/.claude/worktrees/. A repo with no agent worktrees at all is healthy,
// not broken, so a missing directory returns an empty list, not an error.
function listOnDisk(root) {
  const dir = path.join(root, '.claude', 'worktrees');
  if (!fs.existsSync(dir)) return [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.filter((e) => e.isDirectory()).map((e) => path.resolve(path.join(dir, e.name)));
}

// listRegistered(root): the Set of absolute paths `git worktree list` actually
// knows about. A non-zero git exit aborts loudly rather than being read as
// "nothing is registered" -- that failure mode would propose deleting live
// checkouts, so it must be impossible.
function listRegistered(root) {
  const r = cp.spawnSync('git', ['-C', root, 'worktree', 'list', '--porcelain'], { encoding: 'utf8', timeout: 15000 });
  if (r.status !== 0) {
    throw new Error('git worktree list --porcelain failed (exit ' + r.status + '): ' + (r.stderr || '').slice(0, 500));
  }
  const set = new Set();
  for (const line of (r.stdout || '').split('\n')) {
    if (line.startsWith('worktree ')) {
      set.add(path.resolve(line.slice('worktree '.length).trim()));
    }
  }
  return set;
}

// listTracked(root): the Set of repo-tracked file paths, built once and passed
// down rather than re-shelling per directory.
function listTracked(root) {
  const r = cp.spawnSync('git', ['-C', root, 'ls-files'], { encoding: 'utf8', timeout: 15000, maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) {
    throw new Error('git ls-files failed (exit ' + r.status + '): ' + (r.stderr || '').slice(0, 500));
  }
  return new Set((r.stdout || '').split('\n').filter(Boolean));
}

// hashFiles(root, absPaths): one batched `git hash-object --stdin-paths` call.
// Output SHAs are positional, one per input line in the same order.
function hashFiles(root, absPaths) {
  if (absPaths.length === 0) return [];
  const input = absPaths.join('\n') + '\n';
  const r = cp.spawnSync('git', ['-C', root, 'hash-object', '--stdin-paths'], { input, encoding: 'utf8', timeout: 120000, maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) {
    throw new Error('git hash-object --stdin-paths failed (exit ' + r.status + '): ' + (r.stderr || '').slice(0, 500));
  }
  return (r.stdout || '').split('\n').filter(Boolean);
}

// batchCheckMissing(root, shas): one batched `git cat-file --batch-check`
// call. Returns the Set of SHAs the repo's object database does NOT have.
function batchCheckMissing(root, shas) {
  if (shas.length === 0) return new Set();
  const input = shas.join('\n') + '\n';
  const r = cp.spawnSync('git', ['-C', root, 'cat-file', '--batch-check'], { input, encoding: 'utf8', timeout: 120000, maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) {
    throw new Error('git cat-file --batch-check failed (exit ' + r.status + '): ' + (r.stderr || '').slice(0, 500));
  }
  const missing = new Set();
  for (const line of (r.stdout || '').split('\n')) {
    if (!line) continue;
    const parts = line.split(' ');
    if (parts[1] === 'missing') missing.add(parts[0]);
  }
  return missing;
}

// walkDir(dirAbs): explicit-stack walk skipping SKIP_DIRS, capped at
// MAX_FILES. Returns relative (posix-joined) + absolute path + size per file.
function walkDir(dirAbs) {
  const files = [];
  const stack = [dirAbs];
  while (stack.length > 0) {
    const cur = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const abs = path.join(cur, entry.name);
      // A top-level `.git` entry is the checkout's OWN git admin data -- for a
      // linked worktree that is a FILE (`gitdir: <path>`), not a directory, so
      // the SKIP_DIRS directory-only check below cannot catch it. Its content
      // is a path string unique to this checkout's location, never anything a
      // human authored, so it must never count toward tracked_modified /
      // untracked_unique regardless of which shape it takes.
      if (entry.name === '.git') continue;
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        stack.push(abs);
        continue;
      }
      if (!entry.isFile()) continue; // symlinks and other special files are skipped, not followed
      let size = 0;
      try {
        size = fs.statSync(abs).size;
      } catch {
        /* unreadable file; size stays 0, still hashed below */
      }
      files.push({ rel: path.relative(dirAbs, abs).split(path.sep).join('/'), abs, size });
      if (files.length > MAX_FILES) return { overCap: true, files };
    }
  }
  return { overCap: false, files };
}

// classify(root, dirAbs, opts): the per-directory verdict. Order matters --
// cheapest, cheapest-to-trust checks first (DD-2).
function classify(root, dirAbs, opts) {
  const basename = path.basename(dirAbs);
  const resolvedDir = path.resolve(dirAbs);
  const zeroCounts = { tracked_modified: 0, untracked_unique: 0, planning_unique: 0, ephemeral_unique: 0 };

  if (opts.registeredSet.has(resolvedDir)) {
    return { dir: dirAbs, basename, status: 'registered', reason: 'registered worktree, never touched', counts: zeroCounts, bytes: 0 };
  }

  // A linked worktree's checkout carries a `.git` FILE (not a directory)
  // whose content is `gitdir: <path to the admin record>`. If that target
  // still exists, git has not forgotten this checkout even though the
  // registry did not name it -- belt and braces against a registry that is
  // mid-write.
  try {
    const gitPath = path.join(dirAbs, '.git');
    const st = fs.lstatSync(gitPath);
    if (st.isFile()) {
      const content = fs.readFileSync(gitPath, 'utf8');
      const m = content.match(/^gitdir:\s*(.+)$/m);
      if (m && fs.existsSync(m[1].trim())) {
        return {
          dir: dirAbs,
          basename,
          status: 'live-gitdir',
          reason: 'linked worktree gitdir still exists at ' + m[1].trim() + '; never deleted',
          counts: zeroCounts,
          bytes: 0,
        };
      }
    }
  } catch {
    /* no .git file (or unreadable): not a linked worktree, fall through to the walk */
  }

  const walked = walkDir(dirAbs);
  if (walked.overCap) {
    return { dir: dirAbs, basename, status: 'review', reason: 'file count over cap (' + MAX_FILES + '), not classified', counts: zeroCounts, bytes: 0 };
  }

  const files = walked.files;
  const bytes = files.reduce((sum, f) => sum + f.size, 0);
  const shas = hashFiles(root, files.map((f) => f.abs));
  const missing = batchCheckMissing(root, shas);

  let tracked_modified = 0;
  let untracked_unique = 0;
  let planning_unique = 0;
  let ephemeral_unique = 0;
  for (let i = 0; i < files.length; i++) {
    if (!missing.has(shas[i])) continue; // content already in the object database either way
    const rel = files[i].rel;
    if (rel === '.planning' || rel.startsWith('.planning/')) {
      planning_unique++;
    } else if (isEphemeralPath(rel)) {
      ephemeral_unique++;
    } else if (opts.trackedSet.has(rel)) {
      tracked_modified++;
    } else {
      untracked_unique++;
    }
  }

  const counts = { tracked_modified, untracked_unique, planning_unique, ephemeral_unique };
  const blockingPlanning = opts.strictPlanning ? planning_unique : 0;
  const blockingEphemeral = opts.strictEphemeral ? ephemeral_unique : 0;
  const isSafe = tracked_modified === 0 && untracked_unique === 0 && blockingPlanning === 0 && blockingEphemeral === 0;

  if (isSafe) {
    const notes = [];
    if (planning_unique > 0) notes.push('planning_unique=' + planning_unique + ' non-blocking');
    if (ephemeral_unique > 0) notes.push('ephemeral_unique=' + ephemeral_unique + ' non-blocking');
    const note = notes.length > 0 ? ' (' + notes.join(', ') + ')' : '';
    return { dir: dirAbs, basename, status: 'safe-orphan', reason: 'all content already in the object database' + note, counts, bytes };
  }
  const reasonBits = [];
  if (tracked_modified > 0) reasonBits.push(tracked_modified + ' tracked_modified');
  if (untracked_unique > 0) reasonBits.push(untracked_unique + ' untracked_unique');
  if (opts.strictPlanning && planning_unique > 0) reasonBits.push(planning_unique + ' planning_unique (--strict-planning)');
  if (opts.strictEphemeral && ephemeral_unique > 0) reasonBits.push(ephemeral_unique + ' ephemeral_unique (--strict-ephemeral)');
  return { dir: dirAbs, basename, status: 'review', reason: reasonBits.join(', ') + ' file(s) with content not in the object database', counts, bytes };
}

function report(data, opts) {
  const { versionInfo, root, registeredCount, nonRegistered, safeOrphans, reviewNeeded, total } = data;

  if (opts.asJson) {
    console.log(
      JSON.stringify(
        {
          version: versionInfo.version,
          root,
          registeredCount,
          total,
          nonRegistered: nonRegistered.map((r) => ({
            dir: r.dir,
            basename: r.basename,
            status: r.status,
            reason: r.reason,
            counts: r.counts,
            walked_bytes: r.bytes,
          })),
          safeOrphanCount: safeOrphans.length,
          reviewCount: reviewNeeded.length,
        },
        null,
        2
      )
    );
    return;
  }

  console.log('check-worktree-hygiene: repo version ' + versionInfo.version + ' at ' + root);
  console.log('registered worktrees: ' + registeredCount);
  console.log('directories on disk under .claude/worktrees/: ' + total);
  console.log('');
  for (const r of nonRegistered) {
    console.log(
      r.status +
        '  ' +
        r.basename +
        '  tracked_modified=' +
        r.counts.tracked_modified +
        ' untracked_unique=' +
        r.counts.untracked_unique +
        ' planning_unique=' +
        r.counts.planning_unique +
        ' ephemeral_unique=' +
        r.counts.ephemeral_unique +
        '  ' +
        r.reason
    );
  }
  if (reviewNeeded.length > 0) {
    console.log('');
    console.log('Needs human decision (never auto-deleted by any flag):');
    for (const r of reviewNeeded) {
      console.log('  ' + r.basename + ': ' + r.reason);
    }
  }
  console.log('');
  console.log(
    'Totals: ' + registeredCount + ' registered, ' + safeOrphans.length + ' safe-orphan, ' + reviewNeeded.length + ' needing review, ' + total + ' total on disk.'
  );
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help')) {
    console.log(usage());
    process.exit(0);
  }

  let root = path.resolve(__dirname, '..');
  const excludes = new Set();
  let doPrune = false;
  let doConfirm = false;
  let asJson = false;
  let advisory = false;
  let strictPlanning = false;
  let strictEphemeral = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--root') {
      const value = argv[i + 1];
      if (!value) {
        console.error('check-worktree-hygiene: --root was given with no directory argument');
        process.exit(2);
      }
      root = path.resolve(value);
      i++;
    } else if (a === '--exclude') {
      const value = argv[i + 1];
      if (!value) {
        console.error('check-worktree-hygiene: --exclude was given with no basename argument');
        process.exit(2);
      }
      excludes.add(value);
      i++;
    } else if (a === '--prune') {
      doPrune = true;
    } else if (a === '--confirm') {
      doConfirm = true;
    } else if (a === '--json') {
      asJson = true;
    } else if (a === '--advisory') {
      advisory = true;
    } else if (a === '--strict-planning') {
      strictPlanning = true;
    } else if (a === '--strict-ephemeral') {
      strictEphemeral = true;
    } else if (a === '--check') {
      /* default action, accepted explicitly as a no-op */
    } else {
      console.error('check-worktree-hygiene: unknown flag ' + a + ' (see --help)');
      process.exit(2);
    }
  }

  let versionInfo;
  try {
    versionInfo = readRepoVersion(root);
  } catch (e) {
    console.error('check-worktree-hygiene: could not read canonical repo version: ' + (e && e.message ? e.message : e));
    process.exit(2);
    return;
  }

  let registeredSet;
  let trackedSet;
  try {
    registeredSet = listRegistered(root);
    trackedSet = listTracked(root);
  } catch (e) {
    console.error('check-worktree-hygiene: ' + (e && e.message ? e.message : e));
    process.exit(2);
    return;
  }

  const onDisk = listOnDisk(root);
  const opts = { registeredSet, trackedSet, strictPlanning, strictEphemeral };

  let results;
  try {
    results = onDisk.map((d) => classify(root, d, opts));
  } catch (e) {
    console.error('check-worktree-hygiene: classification failed: ' + (e && e.message ? e.message : e));
    process.exit(2);
    return;
  }

  const registeredCount = results.filter((r) => r.status === 'registered').length;
  const nonRegistered = results.filter((r) => r.status !== 'registered');
  const safeOrphans = nonRegistered.filter((r) => r.status === 'safe-orphan');
  const reviewNeeded = nonRegistered.filter((r) => r.status === 'review' || r.status === 'live-gitdir');

  report({ versionInfo, root, registeredCount, nonRegistered, safeOrphans, reviewNeeded, total: onDisk.length }, { asJson });

  if (doPrune) {
    const toDelete = safeOrphans.filter((r) => !excludes.has(r.basename));
    const worktreesDir = path.resolve(path.join(root, '.claude', 'worktrees'));
    let deleted = 0;
    for (const entry of toDelete) {
      const rel = path.relative(worktreesDir, entry.dir);
      if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
        console.error('check-worktree-hygiene: refusing to delete a path outside .claude/worktrees/: ' + entry.dir);
        continue;
      }
      if (doConfirm) {
        console.log('DELETE ' + entry.dir + ' (' + entry.reason + ')');
        fs.rmSync(entry.dir, { recursive: true, force: true });
        deleted++;
      } else {
        console.log('DRY-RUN ' + entry.dir + ' (' + entry.reason + ')');
      }
    }
    if (doConfirm) {
      console.log('Deleted ' + deleted + ' directory(ies).');
    } else {
      console.log('Dry run only: ' + toDelete.length + ' directory(ies) would be deleted. Re-run with --confirm to actually delete.');
    }
    if (excludes.size > 0) {
      console.log('Excluded from the delete set: ' + Array.from(excludes).join(', '));
    }
    process.exit(0);
    return;
  }

  if (advisory) {
    process.exit(0);
    return;
  }
  process.exit(nonRegistered.length > 0 ? 1 : 0);
}

module.exports = { listOnDisk, listRegistered, listTracked, hashFiles, batchCheckMissing, classify, walkDir };

if (require.main === module) {
  main();
}
