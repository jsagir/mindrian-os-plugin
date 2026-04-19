#!/usr/bin/env node
'use strict';

/**
 * ROOM.md + MINTO.md pre-commit hook tests (Phase 87-01a, SEC-04).
 *
 * BSL 1.1. Copyright (c) Mindrian 2026.
 *
 * Seven tests, all run in isolated tmp git repos via fs.mkdtempSync:
 *   Test 1 -- idempotent install: setup-hooks.sh twice, second is "no-op".
 *   Test 2 -- Data-Room commit blocks: staged file under `.room-root` subtree
 *             without ROOM.md/MINTO.md must exit non-zero with clear stderr.
 *   Test 3 -- Data-Room commit passes: same subtree with ROOM.md + MINTO.md
 *             must commit successfully.
 *   Test 4 -- session-start self-heal: deleted hook is re-installed by the
 *             session-start re-install snippet (worktree-aware via --git-path).
 *   Test 5 -- plugin-source pass-through (R-C4 regression gate): a bare
 *             lib/core/*.cjs commit with NO `.room-root` ancestor must pass.
 *             If the hook ever reverts to blocking all directories, this test
 *             fails immediately.
 *   Test 6 -- symlink safety (R-87-01a-WIN): commit inside a subtree
 *             containing symlink cycles must terminate within 5s (no hang).
 *   Test 7 -- worktree path resolution (R-87-01a-WIN): grep that both
 *             setup-hooks.sh AND session-start use
 *             `git rev-parse --git-path hooks/pre-commit` (not show-toplevel).
 *
 * Run: node lib/memory/room-minto-hook.test.cjs
 * Exit 0 on pass, 1 on any failure.
 */

const assert = require('node:assert/strict');
const { execSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const GUARD_SRC = path.join(
  REPO_ROOT,
  'scripts',
  'hooks',
  'pre-commit-room-minto-guard.sh'
);
const SETUP_HOOKS = path.join(REPO_ROOT, 'scripts', 'setup-hooks.sh');
const SESSION_START = path.join(REPO_ROOT, 'scripts', 'session-start');

// Resolve the effective hooks/pre-commit path for a given repo dir using
// `git rev-parse --git-path hooks/pre-commit` (worktree-safe). Returns an
// absolute path; git may return relative when CWD is inside the repo.
function effectiveHookPath(repoDir) {
  const rel = execSync('git rev-parse --git-path hooks/pre-commit', {
    cwd: repoDir,
    encoding: 'utf8',
  }).trim();
  return path.isAbsolute(rel) ? rel : path.join(repoDir, rel);
}

// Initialize a throwaway git repo with minimal identity. Returns the repo dir.
function initRepo(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  execSync('git init -q', { cwd: dir });
  execSync('git config user.email test@mindrian', { cwd: dir });
  execSync('git config user.name test', { cwd: dir });
  return dir;
}

// Install the guard at the repo's effective hooks/pre-commit path.
function installHookInto(repoDir) {
  const dst = effectiveHookPath(repoDir);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(GUARD_SRC, dst);
  fs.chmodSync(dst, 0o755);
  return dst;
}

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
// Test 1: idempotency -- setup-hooks.sh twice; second run prints "no-op".
// ---------------------------------------------------------------------------
record('Test 1: setup-hooks.sh is idempotent', () => {
  const repo = initRepo('mos-hook-idem-');
  try {
    const first = spawnSync('bash', [SETUP_HOOKS], {
      cwd: repo,
      encoding: 'utf8',
    });
    assert.equal(first.status, 0, 'first run must exit 0');
    const hookDst = effectiveHookPath(repo);
    assert.ok(fs.existsSync(hookDst), 'hook must exist after first run');

    const second = spawnSync('bash', [SETUP_HOOKS], {
      cwd: repo,
      encoding: 'utf8',
    });
    assert.equal(second.status, 0, 'second run must exit 0');
    assert.match(
      second.stdout || '',
      /no-op/,
      'second run must print "no-op" idempotency marker'
    );
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 2: Data-Room commit BLOCKS when ROOM.md/MINTO.md missing.
// ---------------------------------------------------------------------------
record('Test 2: Data-Room commit blocks without ROOM.md/MINTO.md', () => {
  const repo = initRepo('mos-hook-block-');
  try {
    installHookInto(repo);
    // Mark myroom/ as a Data Room root via .room-root sentinel.
    fs.mkdirSync(path.join(repo, 'myroom', 'section-a'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'myroom', '.room-root'), '');
    fs.writeFileSync(path.join(repo, 'myroom', 'ROOM.md'), '# Room\n');
    fs.writeFileSync(path.join(repo, 'myroom', 'MINTO.md'), '# Minto\n');
    // section-a deliberately has NO ROOM.md or MINTO.md
    fs.writeFileSync(
      path.join(repo, 'myroom', 'section-a', 'entry.md'),
      '# Entry\n'
    );

    execSync('git add myroom', { cwd: repo });
    const res = spawnSync(
      'git',
      ['commit', '-m', 'test missing ROOM/MINTO in section-a'],
      { cwd: repo, encoding: 'utf8' }
    );
    // Note: `git commit` wraps hook non-zero exit codes into its own status 1
    // (see git-hooks documentation). We therefore assert the commit is blocked
    // (status !== 0), and separately invoke the hook directly below to prove
    // the guard itself exits with code 2 on violation.
    assert.notEqual(res.status, 0, 'commit must fail when ROOM/MINTO missing');
    const stderr = (res.stderr || '') + (res.stdout || '');
    assert.match(stderr, /MISSING ROOM.md/, 'stderr must mention MISSING ROOM.md');
    assert.match(stderr, /MISSING MINTO.md/, 'stderr must mention MISSING MINTO.md');

    // Invoke the hook directly on the staged index and assert exit 2.
    const hookRes = spawnSync(
      'bash',
      [effectiveHookPath(repo)],
      { cwd: repo, encoding: 'utf8' }
    );
    assert.equal(
      hookRes.status,
      2,
      'guard script itself must exit 2 on violation (got ' + hookRes.status + ')'
    );
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 3: Data-Room commit PASSES when ROOM.md + MINTO.md present.
// ---------------------------------------------------------------------------
record('Test 3: Data-Room commit passes with ROOM.md + MINTO.md', () => {
  const repo = initRepo('mos-hook-pass-');
  try {
    installHookInto(repo);
    fs.mkdirSync(path.join(repo, 'myroom', 'section-b'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'myroom', '.room-root'), '');
    fs.writeFileSync(path.join(repo, 'myroom', 'ROOM.md'), '# Room\n');
    fs.writeFileSync(path.join(repo, 'myroom', 'MINTO.md'), '# Minto\n');
    fs.writeFileSync(
      path.join(repo, 'myroom', 'section-b', 'ROOM.md'),
      '# Section B\n'
    );
    fs.writeFileSync(
      path.join(repo, 'myroom', 'section-b', 'MINTO.md'),
      '# Minto B\n'
    );
    fs.writeFileSync(
      path.join(repo, 'myroom', 'section-b', 'entry.md'),
      '# Entry\n'
    );

    execSync('git add myroom', { cwd: repo });
    const res = spawnSync(
      'git',
      ['commit', '-m', 'test data-room with ROOM/MINTO'],
      { cwd: repo, encoding: 'utf8' }
    );
    assert.equal(
      res.status,
      0,
      'commit must succeed when ROOM/MINTO present (got ' +
        res.status +
        ': ' +
        (res.stderr || '').slice(0, 400) +
        ')'
    );
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 4: session-start self-heal re-installs a deleted hook.
// We run the re-install snippet as a small inline bash script in isolation
// (not the full session-start) to exercise the core logic deterministically.
// ---------------------------------------------------------------------------
record('Test 4: session-start re-install self-heals deleted hook', () => {
  const repo = initRepo('mos-hook-heal-');
  try {
    const hookDst = installHookInto(repo);
    assert.ok(fs.existsSync(hookDst), 'hook exists pre-deletion');
    fs.unlinkSync(hookDst);
    assert.ok(!fs.existsSync(hookDst), 'hook absent after manual delete');

    // Inline the exact re-install snippet from session-start.
    // We must run this with cwd inside the repo so `git rev-parse` resolves.
    const snippet = `
if command -v git >/dev/null 2>&1; then
  SETUP_HOOKS_REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo "")
  if [ -n "$SETUP_HOOKS_REPO_ROOT" ] && [ -x "${REPO_ROOT}/scripts/setup-hooks.sh" ]; then
    GUARD_SRC="${REPO_ROOT}/scripts/hooks/pre-commit-room-minto-guard.sh"
    HOOK_REL=$(git rev-parse --git-path hooks/pre-commit 2>/dev/null || echo "")
    if [ -n "$HOOK_REL" ]; then
      case "$HOOK_REL" in
        /*) HOOK_DST="$HOOK_REL" ;;
        *)  HOOK_DST="$SETUP_HOOKS_REPO_ROOT/$HOOK_REL" ;;
      esac
    else
      HOOK_DST="$SETUP_HOOKS_REPO_ROOT/.git/hooks/pre-commit"
    fi
    if [ ! -f "$HOOK_DST" ] || ! cmp -s "$GUARD_SRC" "$HOOK_DST" 2>/dev/null; then
      bash "${REPO_ROOT}/scripts/setup-hooks.sh" >/dev/null 2>&1 || true
    fi
  fi
fi
`;
    const res = spawnSync('bash', ['-c', snippet], { cwd: repo, encoding: 'utf8' });
    assert.equal(res.status, 0, 're-install snippet must exit 0');
    assert.ok(fs.existsSync(hookDst), 'hook re-created by self-heal');
    // Content must match source
    assert.equal(
      fs.readFileSync(hookDst, 'utf8'),
      fs.readFileSync(GUARD_SRC, 'utf8'),
      'self-healed hook contents match source'
    );
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 5 (R-C4 regression gate): plugin-source commit must NOT be blocked.
// No `.room-root` anywhere in the repo -- decision #15 does not apply.
// ---------------------------------------------------------------------------
record('Test 5: plugin-source commit (no .room-root) MUST NOT be blocked', () => {
  const repo = initRepo('mos-plugin-src-');
  try {
    installHookInto(repo);
    // Create a deeply-nested plugin-source file; NO .room-root anywhere.
    fs.mkdirSync(path.join(repo, 'lib', 'core'), { recursive: true });
    fs.writeFileSync(
      path.join(repo, 'lib', 'core', 'sentinel.cjs'),
      '// plugin source\n'
    );

    execSync('git add lib/core/sentinel.cjs', { cwd: repo });
    let commitOk = false;
    try {
      execSync('git commit -m "test plugin source"', {
        cwd: repo,
        stdio: 'pipe',
      });
      commitOk = true;
    } catch (e) {
      commitOk = false;
    }
    assert.ok(
      commitOk,
      'plugin source commit (no .room-root ancestor) MUST NOT be blocked by the ROOM/MINTO guard'
    );
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 6 (R-87-01a-WIN): symlink safety. A subtree with symlink cycles
// (link-back -> .., self-ref -> .) must not hang the walker. Commit must
// terminate within 5000ms, exit 0 or 2, never by SIGKILL/timeout.
// ---------------------------------------------------------------------------
record('Test 6: symlink subtree does not hang the walker', () => {
  const repo = initRepo('mos-hook-symlink-');
  try {
    installHookInto(repo);
    // myroom/ is the Data Room with proper ROOM/MINTO at root + real-section
    fs.mkdirSync(path.join(repo, 'myroom', 'real-section'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'myroom', '.room-root'), '');
    fs.writeFileSync(path.join(repo, 'myroom', 'ROOM.md'), '# Root\n');
    fs.writeFileSync(path.join(repo, 'myroom', 'MINTO.md'), '# Minto\n');
    fs.writeFileSync(
      path.join(repo, 'myroom', 'real-section', 'ROOM.md'),
      '# Real\n'
    );
    fs.writeFileSync(
      path.join(repo, 'myroom', 'real-section', 'MINTO.md'),
      '# Minto\n'
    );
    fs.writeFileSync(
      path.join(repo, 'myroom', 'real-section', 'entry.md'),
      '# Entry\n'
    );

    // Two symlinks that would loop a naive walker:
    //   myroom/link-back -> ..      (up one level, into repo root)
    //   myroom/self-ref  -> .       (into myroom itself)
    try {
      fs.symlinkSync('..', path.join(repo, 'myroom', 'link-back'));
      fs.symlinkSync('.', path.join(repo, 'myroom', 'self-ref'));
    } catch (e) {
      // Some filesystems (e.g. Windows without admin) reject symlinks. Skip
      // softly by asserting ok and moving on.
      process.stdout.write(
        '        (symlink creation rejected by FS: ' + e.message + ')\n'
      );
      return;
    }

    // Stage a file under the real (non-symlinked) path; the staged dir list
    // will also include the symlink paths if git tracks them. 5-second
    // timeout; assert the spawn returns (not SIGKILL).
    execSync('git add myroom', { cwd: repo });
    const start = Date.now();
    const res = spawnSync(
      'git',
      ['commit', '-m', 'test symlink subtree'],
      { cwd: repo, encoding: 'utf8', timeout: 5000, killSignal: 'SIGKILL' }
    );
    const elapsed = Date.now() - start;
    // signal !== null means the spawn was killed by timeout; that's a hang.
    assert.equal(
      res.signal,
      null,
      'commit must NOT be killed by 5000ms timeout (elapsed=' + elapsed + 'ms)'
    );
    // Exit code 0 (pass) or 2 (blocked) are both acceptable; anything else
    // (e.g. 137 SIGKILL) would indicate the walker looped.
    assert.ok(
      res.status === 0 || res.status === 2,
      'exit status must be 0 (pass) or 2 (blocked), got ' + res.status
    );
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 7 (R-87-01a-WIN): worktree-safe path resolution. Both setup-hooks.sh
// AND session-start must use `git rev-parse --git-path hooks/pre-commit`
// (not `--show-toplevel/.git/hooks/`). Grep is sufficient evidence -- no
// need to spin up a real worktree fixture.
// ---------------------------------------------------------------------------
record('Test 7: setup-hooks.sh and session-start use --git-path hooks/pre-commit', () => {
  const setupSrc = fs.readFileSync(SETUP_HOOKS, 'utf8');
  const sessionSrc = fs.readFileSync(SESSION_START, 'utf8');
  const marker = 'git rev-parse --git-path hooks/pre-commit';
  assert.ok(
    setupSrc.indexOf(marker) !== -1,
    'setup-hooks.sh must use --git-path hooks/pre-commit'
  );
  assert.ok(
    sessionSrc.indexOf(marker) !== -1,
    'session-start must use --git-path hooks/pre-commit'
  );
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
process.stdout.write(
  '\nroom-minto-hook tests: ' +
    passCount +
    ' passed, ' +
    failCount +
    ' failed (of ' +
    (passCount + failCount) +
    ')\n'
);
process.exit(failCount === 0 ? 0 : 1);
