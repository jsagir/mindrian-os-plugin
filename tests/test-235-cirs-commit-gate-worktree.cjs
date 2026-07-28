#!/usr/bin/env node
'use strict';

/**
 * tests/test-235-cirs-commit-gate-worktree.cjs -- Phase 235-01 Task 3 (CIRS-01).
 *
 * BSL 1.1. Copyright (c) Mindrian 2026.
 *
 * What this proves, via REAL git commits (never hook-file inspection)
 * -------------------------------------------------------------------
 *   1. PRIMARY REJECTION      -- a commit introducing a born-unwired command
 *      surface is rejected in a primary checkout (nonzero exit, GAP on stderr).
 *   2. SECOND-WORKTREE        -- the identical rejection holds in a second git
 *      worktree that shares the primary checkout's hooks directory.
 *   3. NEGATIVE CONTROL       -- reproduce the C-1 rival-installer overwrite:
 *      replace the shared hook with a narrow stub and show the SAME class of
 *      violation now COMMITS SUCCESSFULLY. Without this leg, legs 1/2/4 could
 *      all pass against a gate that never actually had teeth.
 *   4. SELF-HEAL RESTORES IT  -- re-run the fix's installer (mirroring the
 *      session-start self-heal at scripts/session-start:1667-1685) and show
 *      rejection returns for a fresh violation.
 *
 * Why leg 3 is not optional: the whole Phase 235 bug was a gate that LOOKED
 * installed and was silently overwritten with a narrower body. A test that only
 * asserts "commit was rejected" cannot distinguish a working gate from a gate
 * that rejects for some unrelated reason. Legs 3 and 4 bracket the real one.
 *
 * Isolation (load-bearing)
 * ------------------------
 * Everything runs inside a disposable fixture repo built with fs.mkdtempSync.
 * The real MindrianOS-Plugin .git/hooks/ is NEVER touched. The fixture is
 * populated with REAL FILE COPIES, never symlinks: build-connector-registry.cjs
 * and its siblings resolve their REPO_ROOT from __dirname, so a symlinked
 * scripts/ would resolve back to the real repo and the "isolated" fixture would
 * silently be checking the real tree instead.
 *
 * Canon Part 8: zero Brain, zero network. Every check regenerates in memory from
 * LOCAL fixture files.
 *
 * Run: node tests/test-235-cirs-commit-gate-worktree.cjs
 * Exit 0 on pass, 1 on any failure.
 */

const { execSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

// Top-level trees the guards need in order to run for real inside the fixture.
const FIXTURE_TREES = ['scripts', 'lib', 'data', 'commands', 'skills', 'agents', 'pipelines'];

// Never copied. `.planning`/`docs`/`dist`/`node_modules`/`.git` per the plan.
// `lib/wiki` is excluded purely for speed: it is ~238MB of vendored viewer
// assets and no pre-commit guard reads it (the render-coverage gate scans
// lib/hmi, lib/agents, lib/render, lib/core only). Copying it would add minutes
// per run for zero additional coverage.
const EXCLUDED_DIRS = new Set(['node_modules', '.git', '.planning', 'dist', 'docs']);
const EXCLUDED_PATHS = new Set([path.join(REPO_ROOT, 'lib', 'wiki')]);

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

// ---------------------------------------------------------------------------
// Fixture construction
// ---------------------------------------------------------------------------

function copyTree(src, dst) {
  fs.cpSync(src, dst, {
    recursive: true,
    dereference: true, // REAL file copies; a symlink would defeat the isolation
    filter: (from) => {
      if (EXCLUDED_PATHS.has(from)) return false;
      return !EXCLUDED_DIRS.has(path.basename(from));
    },
  });
}

function buildFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-235-cirs-'));
  for (const tree of FIXTURE_TREES) {
    const src = path.join(REPO_ROOT, tree);
    if (fs.existsSync(src)) copyTree(src, path.join(dir, tree));
  }
  execSync('git init -q', { cwd: dir });
  execSync('git config user.email test@mindrian', { cwd: dir });
  execSync('git config user.name test', { cwd: dir });
  execSync('git add -A', { cwd: dir });
  // No hook is installed yet at seed time, so this needs no bypass.
  execSync('git commit -q -m seed', { cwd: dir });
  return dir;
}

function effectiveHookPath(repoDir) {
  const rel = execSync('git rev-parse --git-path hooks/pre-commit', {
    cwd: repoDir,
    encoding: 'utf8',
  }).trim();
  return path.isAbsolute(rel) ? rel : path.join(repoDir, rel);
}

// ---------------------------------------------------------------------------
// The born-unwired ("gap") surface. Shape is derived from commands/agentshield.md
// with the `connector:` block DELETED, which is exactly what makes
// classifySurface() in scripts/build-connector-registry.cjs return state 'gap':
// neither WIRED (connects_to_spine) nor EXCLUDED (excluded + reason).
// ---------------------------------------------------------------------------
function gapSurfaceBody(name) {
  return [
    '---',
    'name: ' + name,
    'description: "Phase 235 fixture surface, deliberately born unwired"',
    'help_jtbd: "Phase 235 fixture surface used to prove the born-wired commit gate has teeth."',
    'body_shape: E (Action Report)',
    'hitl_shape: "none"',
    'hitl_why: "A disposable test fixture surface that reaches no navigator fork."',
    'serves_jtbd: ["audit-room"]',
    'teaching: "A Phase 235 test fixture surface. It exists only inside a disposable fixture repo and is never shipped."',
    'allowed-tools: [Read]',
    '# NOTE: no `connector:` block on purpose. That absence is the violation.',
    '---',
    '',
    '# /mos:' + name,
    '',
    'Fixture body.',
    '',
  ].join('\n');
}

/**
 * Stage a fresh born-unwired command in `dir` and attempt a real commit.
 *
 * data/command-registry.json is regenerated and staged alongside it. That is
 * deliberate, not incidental: the command-registry drift guard sits EARLIER in
 * the hook than the connector born-wired gate, so leaving the registry stale
 * would abort the commit on registry drift and the born-wired gate under test
 * would never be reached. Regenerating it removes the earlier, unrelated
 * failure so the assertion is genuinely about the CIRS gap gate.
 */
function attemptGapCommit(dir, name) {
  const rel = path.join('commands', name + '.md');
  fs.writeFileSync(path.join(dir, rel), gapSurfaceBody(name), 'utf8');
  spawnSync(process.execPath, [path.join(dir, 'scripts', 'build-command-registry.cjs')], {
    cwd: dir,
    encoding: 'utf8',
  });
  const add = spawnSync('git', ['add', rel, 'data/command-registry.json'], {
    cwd: dir,
    encoding: 'utf8',
  });
  if (add.status !== 0) {
    throw new Error('git add failed in ' + dir + ': ' + (add.stderr || ''));
  }
  const res = spawnSync('git', ['commit', '-m', 'x'], { cwd: dir, encoding: 'utf8' });
  return {
    status: res.status,
    stdout: res.stdout || '',
    stderr: res.stderr || '',
    combined: (res.stdout || '') + (res.stderr || ''),
  };
}

function assertGapRejection(res, where) {
  if (res.status === 0) {
    throw new Error(
      'expected the commit to be REJECTED in ' + where + ', but it succeeded (exit 0).\n' +
        '        The born-wired commit gate is not live.\n' +
        '        output: ' + res.combined.trim()
    );
  }
  if (!/GAP:|connector-registry drift/.test(res.combined)) {
    throw new Error(
      'commit was rejected in ' + where + ' but NOT by the born-wired gate.\n' +
        '        Expected "GAP:" or "connector-registry drift" on the output.\n' +
        '        output: ' + res.combined.trim()
    );
  }
}

// ---------------------------------------------------------------------------
console.log('');
console.log('Phase 235-01 Task 3 -- CIRS commit gate, worktree + rival-overwrite (CIRS-01)');
console.log('');

let fixture = null;
let worktree = null;

try {
  fixture = buildFixture();
  worktree = fixture + '-wt';
  console.log('  fixture: ' + fixture);

  // Install the canonical (Task 1) hook exactly the way session-start does.
  execSync('bash ' + JSON.stringify(path.join(fixture, 'scripts', 'setup-hooks.sh')), {
    cwd: fixture,
    stdio: 'pipe',
  });

  record('Setup: installed hook is byte-identical to the canonical guard source', () => {
    const installed = fs.readFileSync(effectiveHookPath(fixture));
    const canonical = fs.readFileSync(
      path.join(fixture, 'scripts', 'hooks', 'pre-commit-room-minto-guard.sh')
    );
    if (!installed.equals(canonical)) {
      throw new Error('installed hook differs from scripts/hooks/pre-commit-room-minto-guard.sh');
    }
  });

  execSync(
    'git -C ' + JSON.stringify(fixture) + ' worktree add ' + JSON.stringify(worktree) +
      ' HEAD --detach',
    { stdio: 'pipe' }
  );

  record('Setup: the second worktree shares the primary checkout hooks directory', () => {
    const a = effectiveHookPath(fixture);
    const b = effectiveHookPath(worktree);
    if (path.resolve(a) !== path.resolve(b)) {
      throw new Error(
        'worktree resolves a DIFFERENT hooks path (' + b + ') than the primary (' + a + ');\n' +
          '        the shared-hook premise of this test does not hold'
      );
    }
  });

  // -------------------------------------------------------------------------
  // Leg 1: primary-checkout rejection.
  // -------------------------------------------------------------------------
  record('Leg 1: primary-checkout rejection of a born-unwired surface', () => {
    const res = attemptGapCommit(fixture, 'zz-scratch-235-a');
    assertGapRejection(res, 'the primary checkout');
  });

  // -------------------------------------------------------------------------
  // Leg 2: the identical rejection in a second worktree.
  // -------------------------------------------------------------------------
  record('Leg 2: second-worktree rejection (same shared hook)', () => {
    const res = attemptGapCommit(worktree, 'zz-scratch-235-b');
    assertGapRejection(res, 'the second worktree');
  });

  // -------------------------------------------------------------------------
  // Leg 3: NEGATIVE CONTROL. Reproduce the C-1 rival-installer overwrite and
  // prove it genuinely defeats the gate. If this leg ever starts FAILING
  // (i.e. the commit gets rejected anyway), legs 1/2/4 stop meaning anything,
  // because the rejection would be coming from somewhere other than the hook.
  // -------------------------------------------------------------------------
  record('Leg 3: rival-installer overwrite defeats the gate (negative control: commit SUCCEEDS)', () => {
    const hookPath = effectiveHookPath(fixture);
    fs.writeFileSync(hookPath, '#!/usr/bin/env bash\nexit 0\n', 'utf8');
    fs.chmodSync(hookPath, 0o755);
    const res = attemptGapCommit(fixture, 'zz-scratch-235-c');
    if (res.status !== 0) {
      throw new Error(
        'the negative control did NOT reproduce: with the hook overwritten by a\n' +
          '        narrow stub, the violating commit should SUCCEED, but it exited ' +
          res.status + '.\n' +
          '        Legs 1/2/4 cannot be trusted until this reproduces.\n' +
          '        output: ' + res.combined.trim()
      );
    }
  });

  // -------------------------------------------------------------------------
  // Leg 4: the fix's self-heal restores rejection. This mirrors the real
  // session-start snippet at scripts/session-start:1667-1685, which re-runs
  // setup-hooks.sh whenever the installed hook differs from the guard source.
  // -------------------------------------------------------------------------
  record('Leg 4: post-self-heal rejection restored (setup-hooks.sh re-run)', () => {
    execSync('bash ' + JSON.stringify(path.join(fixture, 'scripts', 'setup-hooks.sh')), {
      cwd: fixture,
      stdio: 'pipe',
    });
    const installed = fs.readFileSync(effectiveHookPath(fixture));
    const canonical = fs.readFileSync(
      path.join(fixture, 'scripts', 'hooks', 'pre-commit-room-minto-guard.sh')
    );
    if (!installed.equals(canonical)) {
      throw new Error('self-heal did not restore the canonical hook bytes');
    }
    const res = attemptGapCommit(fixture, 'zz-scratch-235-d');
    assertGapRejection(res, 'the primary checkout after self-heal');
  });
} finally {
  if (fixture && worktree) {
    spawnSync('git', ['-C', fixture, 'worktree', 'remove', '--force', worktree], {
      encoding: 'utf8',
    });
  }
  if (worktree) fs.rmSync(worktree, { recursive: true, force: true });
  if (fixture) fs.rmSync(fixture, { recursive: true, force: true });
}

console.log('');
console.log(
  'cirs-commit-gate tests: ' + passCount + ' passed, ' + failCount + ' failed (of ' +
    (passCount + failCount) + ')'
);
console.log('');

process.exit(failCount === 0 ? 0 : 1);
