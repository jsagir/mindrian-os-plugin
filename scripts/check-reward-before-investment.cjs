#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 118-06 Plan 06 -- check-reward-before-investment CLI.
 *
 * Wraps lib/core/mva-rule-linter.cjs. Prints a table of compliant / missing /
 * invalid counts + a Larry-voice summary line, exits 1 on any missing or
 * invalid.
 *
 * Three modes:
 *
 *   node scripts/check-reward-before-investment.cjs [commandsDir]
 *     -- FULL AUDIT. Scans every *.md in commandsDir (default: commands/).
 *        This is the CI / manual-sweep surface and reports the true repo-wide
 *        debt.
 *
 *   node scripts/check-reward-before-investment.cjs --staged [repoRoot]
 *     -- COMMIT GATE. Lints ONLY the commands/*.md files this commit is
 *        staging, discovered via `git diff --cached --name-only
 *        --diff-filter=ACM`. Nothing staged means nothing to judge: exit 0.
 *
 *   node scripts/check-reward-before-investment.cjs --surfaces [repoRoot]
 *     -- REGISTRY AUDIT (Phase 267.3, ruling D-A). Lints every record in
 *        data/first-reward-surfaces.json, the declarations for first-touch
 *        surfaces that have no frontmatter block to declare in (the motivating
 *        case is scripts/session-start, a bash hook). Same three buckets, same
 *        renderer, same exit contract as the other two modes. Plan 267.3-03
 *        wires this mode fail-closed into scripts/verify-release: the registry
 *        is authored complete, so it starts green and stays green, which is
 *        why this gate can be promoted immediately while the whole-tree
 *        commands/ audit waits for the backfill (plan 267.3-08).
 *
 * Phase 245-02 root-cause fix. The pre-commit hook's own comment has always
 * stated its contract as "exits non-zero if any STAGED commands/*.md change
 * introduces a missing or invalid declaration", but the invocation passed the
 * whole commands/ directory. So a single pre-existing offender anywhere in
 * commands/ blocked EVERY commit that touched ANY command file, and the repo
 * had 103 of them: the guardian was a permanent forced-bypass rather than a
 * gate. `--staged` closes the gap between the stated contract and the
 * implementation. It does NOT relax the per-file verdict: a staged file
 * missing or carrying an invalid interactive_first_reward still fails the
 * commit, exactly as before.
 *
 * Used by:
 *   - scripts/hooks/pre-commit-room-minto-guard.sh (--staged; the commit gate)
 *   - CI (the Feynman test runner; full audit)
 *   - manual invocation by contributors (full audit)
 *
 * Per Canon Part 8: zero network, zero Brain calls, zero user-content egress.
 * `git diff --cached` is a LOCAL index read.
 *
 * Exit codes:
 *   0  -- every scanned command compliant (or nothing staged); the rule holds.
 *   1  -- one or more scanned commands missing/invalid; commit is blocked.
 *   2  -- the commands directory could not be read at all, OR (in --staged
 *         mode) the staged set could not be determined, OR (in --surfaces
 *         mode) the registry could not be read or parsed. Fail closed: an
 *         ungateable commit is not a passing commit.
 */
'use strict';

const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const {
  scanCommands,
  scanFiles,
  scanDeclaredSurfaces,
  REWARD_TYPES,
} = require('../lib/core/mva-rule-linter.cjs');

const REPO_ROOT_DEFAULT = path.join(__dirname, '..');

// ---------------------------------------------------------------------------
// stagedCommandFiles(repoRoot) -> { ok: true, files: [...] } | { ok: false, error }
//
// Reads the index, not the working tree: `--cached` is what the commit is
// actually about to record. --diff-filter=ACM drops deletions, because a
// deleted command file has no frontmatter left to declare anything.
// ---------------------------------------------------------------------------
function stagedCommandFiles(repoRoot) {
  const proc = spawnSync(
    'git',
    ['-C', repoRoot, 'diff', '--cached', '--name-only', '--diff-filter=ACM'],
    { encoding: 'utf8' }
  );
  if (proc.error || proc.status !== 0) {
    return {
      ok: false,
      error: proc.error
        ? proc.error.message
        : 'git exited ' + proc.status + ': ' + String(proc.stderr || '').trim(),
    };
  }
  const files = String(proc.stdout || '')
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => /^commands\/[^/]+\.md$/.test(s))
    .map((s) => path.join(repoRoot, s))
    // A staged path can be absent from the working tree in exotic states
    // (for example a partially-applied rebase). Skip what cannot be read
    // rather than reporting it as a rule violation.
    .filter((p) => {
      try { return fs.statSync(p).isFile(); } catch (_e) { return false; }
    })
    .sort();
  return { ok: true, files };
}

function runStaged() {
  const repoRoot = path.resolve(process.argv[3] || REPO_ROOT_DEFAULT);
  const staged = stagedCommandFiles(repoRoot);

  if (!staged.ok) {
    process.stderr.write(
      'mva-rule-linter: could not determine the staged file set (' + staged.error + ').\n'
      + 'Failing closed: a commit that cannot be gated is not a passing commit.\n'
    );
    process.exit(2);
  }

  process.stdout.write(
    'mva-rule-linter: scanning ' + staged.files.length + ' staged commands/*.md file(s)\n'
  );

  if (staged.files.length === 0) {
    process.stdout.write('  nothing staged under commands/ -- the rule has nothing to judge.\n');
    process.exit(0);
  }

  for (const f of staged.files) {
    process.stdout.write('    ' + path.relative(repoRoot, f) + '\n');
  }

  report(scanFiles(staged.files), repoRoot);
}

// ---------------------------------------------------------------------------
// runSurfaces() -- the registry audit (Phase 267.3, ruling D-A).
//
// The count printed is the registry's OWN surfaces.length, read at check time,
// never a literal: the registry is the table, so the table decides how many
// rows there are (data/first-reward-surfaces.json _doc.surface_count_principle).
// ---------------------------------------------------------------------------
function runSurfaces() {
  const repoRoot = path.resolve(process.argv[3] || REPO_ROOT_DEFAULT);
  const registryPath = path.join(repoRoot, 'data', 'first-reward-surfaces.json');

  const result = scanDeclaredSurfaces(registryPath, repoRoot);

  if (
    result.missing.length === 1 &&
    result.missing[0].reason === 'registry_read_error'
  ) {
    process.stderr.write(
      'mva-rule-linter: could not read the first-reward registry at '
      + registryPath + ' (' + (result.missing[0].error || 'unknown error') + ').\n'
      + 'Failing closed: a registry that cannot be read is not a passing registry.\n'
    );
    process.exit(2);
  }

  // Re-read for the count only. scanDeclaredSurfaces already proved the file
  // parses, so this cannot throw past the guard above.
  let declaredCount = 0;
  try {
    declaredCount = JSON.parse(fs.readFileSync(registryPath, 'utf8')).surfaces.length;
  } catch (_e) {
    declaredCount = result.compliant.length + result.missing.length + result.invalid.length;
  }

  process.stdout.write(
    'mva-rule-linter: scanning ' + declaredCount + ' declared surfaces\n'
  );
  process.stdout.write('  registry: ' + path.relative(repoRoot, registryPath) + '\n');

  for (const bucket of [result.compliant, result.missing, result.invalid]) {
    for (const e of bucket) {
      process.stdout.write(
        '    ' + (e.id || '(no id)') + '  ' + path.relative(repoRoot, e.path) + '\n'
      );
    }
  }

  if (declaredCount === 0) {
    process.stdout.write(
      '  the registry declares no surfaces yet -- the rule has nothing to judge here.\n'
    );
  }

  report(result, repoRoot);
}

function main() {
  if (process.argv[2] === '--staged') {
    runStaged();
    return;
  }
  if (process.argv[2] === '--surfaces') {
    runSurfaces();
    return;
  }
  const target = process.argv[2] || path.join(__dirname, '..', 'commands');
  const abs = path.resolve(target);

  const result = scanCommands(abs);
  process.stdout.write('mva-rule-linter: scanning ' + abs + '\n');
  report(result, abs);
}

function report(result, abs) {
  const cn = result.compliant.length;
  const mn = result.missing.length;
  const inn = result.invalid.length;

  process.stdout.write('  compliant: ' + cn + '\n');
  process.stdout.write('  missing:   ' + mn + '\n');
  process.stdout.write('  invalid:   ' + inn + '\n');

  // Catastrophic case: commands dir unreadable
  if (mn === 1 && result.missing[0].reason === 'commands_dir_read_error') {
    process.stderr.write('commands directory unreadable: ' + abs + '\n');
    process.exit(2);
  }

  if (mn > 0) {
    process.stderr.write('\nMISSING interactive_first_reward field:\n');
    for (const m of result.missing) {
      process.stderr.write('  ' + path.relative(abs, m.path) + ' (' + m.reason + ')\n');
    }
  }
  if (inn > 0) {
    process.stderr.write('\nINVALID interactive_first_reward value:\n');
    for (const v of result.invalid) {
      process.stderr.write('  ' + path.relative(abs, v.path) + ' (value="' + v.value + '")\n');
    }
  }

  if (result.ok) {
    // Larry-voice success line. Plain hyphens, no em-dashes (project hard rule).
    process.stdout.write(
      '\nAll ' + cn + ' interactive commands declare their first reward -- the rule holds.\n'
    );
    process.exit(0);
  }

  // The allowed-values line is DERIVED from REWARD_TYPES, never retyped. Phase
  // 267.3 amended the vocabulary, and a hand-maintained copy here would have
  // told a contributor to fix a violation using a stale list.
  process.stderr.write(
    '\nReward-before-investment rule violated. ' +
    'See docs/reward-before-investment-rule.md.\n' +
    'Fix: declare interactive_first_reward in the frontmatter of each missing/invalid command, ' +
    'or in data/first-reward-surfaces.json for a surface with no frontmatter.\n' +
    'Allowed values: ' + [...REWARD_TYPES].join(', ') + '.\n'
  );
  process.exit(1);
}

main();
