#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 245-02 (deliberate scope addition) -- the reward-before-investment
 * guardian gates STAGED files, not the whole directory
 * ======================================================================
 * The bug this pins, stated plainly: the Phase 118-06 pre-commit guardian's
 * own header says it "exits non-zero if any STAGED commands/*.md change
 * introduces a missing or invalid declaration", but the invocation passed
 * "$REPO_ROOT/commands" and the linter scanned the entire directory. With 103
 * of 112 commands never having declared interactive_first_reward, ONE
 * pre-existing offender anywhere in commands/ blocked EVERY commit that
 * touched ANY command file. The guardian was a permanent forced-bypass
 * (COMMIT_NO_VERIFY=1) rather than a gate. Intent and implementation had
 * diverged; this closes the gap at the root.
 *
 * The two properties that must BOTH hold, and the reason this suite exists:
 * narrowing a gate's input set is exactly the kind of change that
 * accidentally neuters it, so the narrowing and the teeth are asserted
 * together.
 *
 *   1. PASSES when the staged commands/*.md are compliant, EVEN THOUGH the
 *      same directory contains a non-compliant file that was not staged.
 *      (The regression that was blocking Phase 245-02.)
 *
 *   2. STILL FAILS when a non-compliant commands/*.md IS staged, both through
 *      the CLI directly and end to end through the installed hook.
 *      (The teeth. If this ever goes green-when-it-should-be-red, the gate
 *      has been neutered and the fix is wrong.)
 *
 * Plus two supporting fences: the full-audit mode still reports the true
 * repo-wide debt (narrowing the COMMIT gate must not hide the debt from CI),
 * and --staged fails CLOSED (exit 2) when the staged set cannot be determined.
 *
 * Hermetic: every git repo is an fs.mkdtempSync under os.tmpdir(). This suite
 * never touches the real repository index.
 *
 * Pure CJS, node built-ins only, zero npm deps.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const CLI_PATH = path.join(REPO, 'scripts', 'check-reward-before-investment.cjs');
const LINTER_PATH = path.join(REPO, 'lib', 'core', 'mva-rule-linter.cjs');
const HOOK_PATH = path.join(REPO, 'scripts', 'hooks', 'pre-commit-room-minto-guard.sh');

const TMP_REAL = fs.realpathSync(os.tmpdir());

let passed = 0;
let failed = 0;
let skipped = 0;
const tmpDirs = [];

function ok(name) {
  passed += 1;
  process.stdout.write('  ok  ' + name + '\n');
}

function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.message || String(err)) + '\n');
}

function t(name, fn) {
  try {
    fn();
    ok(name);
  } catch (e) {
    fail(name, e);
  }
}

function commandMd(name, reward) {
  const lines = [
    '---',
    'description: ' + name + ' test command',
  ];
  if (reward) lines.push('interactive_first_reward: ' + reward);
  lines.push('---', '', '# ' + name, '');
  return lines.join('\n');
}

// A temp git repo carrying the CLI, the linter library, the canonical hook,
// one compliant command and one non-compliant command.
function makeRepo(prefix) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-245-' + prefix + '-'));
  const real = fs.realpathSync(tmp);
  assert.ok(real === TMP_REAL || real.startsWith(TMP_REAL + path.sep),
    'HERMETIC FENCE BREACH: ' + real + ' is outside ' + TMP_REAL);
  tmpDirs.push(tmp);

  const init = spawnSync('git', ['init', '-q'], { cwd: tmp, encoding: 'utf8' });
  if (init.error || init.status !== 0) return null;
  spawnSync('git', ['config', 'user.email', 'test@example.invalid'], { cwd: tmp });
  spawnSync('git', ['config', 'user.name', 'Test'], { cwd: tmp });
  spawnSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: tmp });

  fs.mkdirSync(path.join(tmp, 'scripts', 'hooks'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'lib', 'core'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'commands'), { recursive: true });

  fs.copyFileSync(CLI_PATH, path.join(tmp, 'scripts', 'check-reward-before-investment.cjs'));
  fs.copyFileSync(LINTER_PATH, path.join(tmp, 'lib', 'core', 'mva-rule-linter.cjs'));
  fs.copyFileSync(HOOK_PATH, path.join(tmp, 'scripts', 'hooks', 'pre-commit'));

  const installedHook = path.join(tmp, '.git', 'hooks', 'pre-commit');
  fs.copyFileSync(HOOK_PATH, installedHook);
  fs.chmodSync(installedHook, 0o755);

  // The pre-existing debt: a command that never declared the field, sitting
  // in the directory, NOT staged.
  fs.writeFileSync(path.join(tmp, 'commands', 'offender.md'),
    commandMd('offender', null), 'utf8');
  // The file a commit actually touches.
  fs.writeFileSync(path.join(tmp, 'commands', 'compliant.md'),
    commandMd('compliant', 'schema_preview'), 'utf8');

  return tmp;
}

function runCli(repoRoot, args) {
  return spawnSync(
    process.execPath,
    [path.join(repoRoot, 'scripts', 'check-reward-before-investment.cjs')].concat(args),
    { cwd: repoRoot, encoding: 'utf8', timeout: 30000 }
  );
}

function main() {
  process.stdout.write('\nPhase 245-02 scope addition: the reward guardian gates STAGED files\n\n');

  const repo = makeRepo('rewardgate');
  if (!repo) {
    skipped += 1;
    process.stdout.write('  SKIP (git unavailable in this environment)\n');
    process.stdout.write('\n245-02 reward-guard-staged: 0 passed, 0 failed, 1 skipped\n');
    process.exit(0);
  }

  try {
    // -----------------------------------------------------------------
    // 1. The regression: directory debt must NOT block a clean commit.
    // -----------------------------------------------------------------
    t('PASSES when only a compliant command is staged, despite unstaged directory debt', function () {
      spawnSync('git', ['add', 'commands/compliant.md'], { cwd: repo });
      const proc = runCli(repo, ['--staged', repo]);
      const combined = (proc.stdout || '') + (proc.stderr || '');
      assert.equal(proc.status, 0,
        'a compliant staged file must pass even though commands/offender.md is '
        + 'non-compliant and present in the directory; output: ' + combined);
      assert.ok(/compliant\.md/.test(combined),
        'the diagnostic must name the file it actually scanned');
      assert.ok(!/offender\.md/.test(combined),
        'an UNSTAGED file must not be scanned by the commit gate; output: ' + combined);
    });

    t('the installed hook lets that commit through', function () {
      const proc = spawnSync('git', ['commit', '-m', 'add compliant command'], {
        cwd: repo, encoding: 'utf8', timeout: 60000,
      });
      const combined = (proc.stdout || '') + (proc.stderr || '');
      assert.equal(proc.status, 0,
        'the hook must not block a commit whose staged commands are compliant; '
        + 'output: ' + combined);
    });

    // -----------------------------------------------------------------
    // 2. The teeth: a staged offender must STILL fail.
    // -----------------------------------------------------------------
    t('STILL FAILS when a non-compliant command IS staged (CLI)', function () {
      spawnSync('git', ['add', 'commands/offender.md'], { cwd: repo });
      const proc = runCli(repo, ['--staged', repo]);
      const combined = (proc.stdout || '') + (proc.stderr || '');
      assert.equal(proc.status, 1,
        'a staged command with no interactive_first_reward must FAIL the gate. '
        + 'If this passes, the narrowing neutered the guardian. Output: ' + combined);
      assert.ok(/offender\.md/.test(combined),
        'the diagnostic must name the offending file; output: ' + combined);
      assert.ok(/missing_field/.test(combined),
        'the diagnostic must name the reason; output: ' + combined);
    });

    t('STILL FAILS end to end through the installed hook', function () {
      const proc = spawnSync('git', ['commit', '-m', 'add offending command'], {
        cwd: repo, encoding: 'utf8', timeout: 60000,
      });
      const combined = (proc.stdout || '') + (proc.stderr || '');
      assert.notEqual(proc.status, 0,
        'the pre-commit hook must block a commit staging a non-compliant command; '
        + 'output: ' + combined);
      assert.ok(/offender\.md/.test(combined),
        'the hook diagnostic must name the offender; output: ' + combined);
    });

    t('STILL FAILS on an INVALID value, not just a missing one', function () {
      spawnSync('git', ['reset', '-q'], { cwd: repo });
      fs.writeFileSync(path.join(repo, 'commands', 'bogus.md'),
        commandMd('bogus', 'not_a_real_reward_type'), 'utf8');
      spawnSync('git', ['add', 'commands/bogus.md'], { cwd: repo });
      const proc = runCli(repo, ['--staged', repo]);
      const combined = (proc.stdout || '') + (proc.stderr || '');
      assert.equal(proc.status, 1, 'an out-of-vocabulary value must FAIL; output: ' + combined);
      assert.ok(/INVALID/.test(combined) && /bogus\.md/.test(combined),
        'the diagnostic must name the invalid value and its file; output: ' + combined);
      spawnSync('git', ['reset', '-q'], { cwd: repo });
    });

    // -----------------------------------------------------------------
    // 3. Nothing staged is not a failure.
    // -----------------------------------------------------------------
    t('nothing staged under commands/ exits 0 with nothing to judge', function () {
      spawnSync('git', ['reset', '-q'], { cwd: repo });
      const proc = runCli(repo, ['--staged', repo]);
      const combined = (proc.stdout || '') + (proc.stderr || '');
      assert.equal(proc.status, 0, 'an empty staged set is not a violation; output: ' + combined);
      assert.ok(/nothing to judge|0 staged/.test(combined),
        'the diagnostic should say so plainly; output: ' + combined);
    });

    // -----------------------------------------------------------------
    // 4. The debt stays visible to the full audit.
    // -----------------------------------------------------------------
    t('full-audit mode still reports the directory debt (CI surface unchanged)', function () {
      const proc = runCli(repo, [path.join(repo, 'commands')]);
      const combined = (proc.stdout || '') + (proc.stderr || '');
      assert.equal(proc.status, 1,
        'narrowing the COMMIT gate must not hide the debt from the full audit; '
        + 'output: ' + combined);
      assert.ok(/offender\.md/.test(combined),
        'the full audit must still name every offender; output: ' + combined);
    });

    // -----------------------------------------------------------------
    // 5. Fail closed when the staged set cannot be determined.
    // -----------------------------------------------------------------
    t('--staged fails CLOSED (exit 2) outside a git repo', function () {
      const notARepo = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-245-notrepo-'));
      tmpDirs.push(notARepo);
      const proc = runCli(repo, ['--staged', notARepo]);
      const combined = (proc.stdout || '') + (proc.stderr || '');
      assert.equal(proc.status, 2,
        'a commit that cannot be gated must not be reported as passing; output: ' + combined);
      assert.ok(/failing closed/i.test(combined),
        'the diagnostic must say it is failing closed; output: ' + combined);
    });

    // -----------------------------------------------------------------
    // 6. The hook copies stay byte-identical (the Phase 125 drift lesson).
    // -----------------------------------------------------------------
    t('both tracked hook copies remain byte-identical', function () {
      const canonical = fs.readFileSync(HOOK_PATH);
      const mirror = fs.readFileSync(path.join(REPO, 'scripts', 'hooks', 'pre-commit'));
      assert.ok(canonical.equals(mirror),
        'scripts/hooks/pre-commit must be a byte copy of '
        + 'scripts/hooks/pre-commit-room-minto-guard.sh; both installers copy the '
        + 'canonical file and a drift between them is exactly the Phase 125 bug');
      assert.ok(/--staged/.test(canonical.toString('utf8')),
        'the canonical hook must invoke the linter in --staged mode');
    });

    t('no em-dash or en-dash in the touched sources', function () {
      const EM = String.fromCharCode(0x2014);
      const EN = String.fromCharCode(0x2013);
      for (const f of [CLI_PATH, LINTER_PATH, HOOK_PATH, __filename]) {
        const src = fs.readFileSync(f, 'utf8');
        assert.ok(src.indexOf(EM) === -1, 'em-dash found in ' + path.basename(f));
        assert.ok(src.indexOf(EN) === -1, 'en-dash found in ' + path.basename(f));
      }
    });
  } finally {
    for (const d of tmpDirs) {
      try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
    }
  }

  process.stdout.write(
    '\n245-02 reward-guard-staged: ' + passed + ' passed, ' + failed + ' failed, '
    + skipped + ' skipped\n'
  );
  process.exit(failed === 0 ? 0 : 1);
}

main();
