'use strict';
/*
 * Phase 118-06 Plan 06 -- mva-rule-linter unit tests.
 *
 * Tests 1-7: linter library + CLI baseline (Task 1).
 * Tests 8-11: pre-commit hook wire + WARN-5 rule-doc parity audit (Task 2).
 * Tests 12-14: Phase 267.3-02 vocabulary parity. The 267.3 amendment added two
 *   REWARD_TYPES members under navigator ruling D-B, and a vocabulary lives in
 *   three places at once (the frozen Set, the rule doc's allowed-values list,
 *   and data/first-reward-surfaces.json's _doc.reward_vocabulary). These three
 *   tests hold all three in lockstep, so a term added to one and forgotten in
 *   another reds the suite instead of drifting quietly.
 *
 * Test 3 reads LD1 from 118-CONTEXT.md (CRITICAL-1+5 -- not in this file;
 * lives in tests/test-mva-dror-harness.cjs).
 *
 * Pure CJS, node built-ins only. Mirrors the Phase 118-00 in-tree runner
 * pattern from lib/core/mva-classifier.test.cjs.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const LINTER_PATH = path.resolve(__dirname, 'mva-rule-linter.cjs');
const CLI_PATH = path.resolve(REPO_ROOT, 'scripts', 'check-reward-before-investment.cjs');
const HOOK_PATH = path.resolve(REPO_ROOT, 'scripts', 'hooks', 'pre-commit');

let passed = 0;
let failed = 0;

function run(name, fn) {
  try {
    fn();
    process.stdout.write('ok  ' + name + '\n');
    passed += 1;
  } catch (err) {
    process.stderr.write('FAIL ' + name + '\n' + (err && err.stack ? err.stack : String(err)) + '\n');
    failed += 1;
  }
}

function freshLinter() {
  delete require.cache[LINTER_PATH];
  return require(LINTER_PATH);
}

// Create a temp dir + write fixture files there. Cleanup is best-effort
// (left in place if a test throws so a human can inspect).
function mkTempCommandsDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mva-rule-linter-'));
  return dir;
}

function writeFixture(dir, filename, body) {
  fs.writeFileSync(path.join(dir, filename), body, 'utf8');
}

// ---------- T1: compliant command passes ----------

run('T1 compliant command: interactive_first_reward present + valid -> compliant', () => {
  const { scanCommands } = freshLinter();
  const dir = mkTempCommandsDir();
  writeFixture(dir, 'good.md', [
    '---',
    'name: good',
    'description: A command that follows the rule',
    'interactive_first_reward: reframe_question',
    '---',
    '',
    '# good',
  ].join('\n'));
  const result = scanCommands(dir);
  assert.equal(result.compliant.length, 1, 'expected 1 compliant, got ' + JSON.stringify(result));
  assert.equal(result.missing.length, 0);
  assert.equal(result.invalid.length, 0);
  assert.equal(result.ok, true);
  assert.equal(result.compliant[0].value, 'reframe_question');
});

// ---------- T2: missing field fails ----------

run('T2 missing field: frontmatter present but no interactive_first_reward -> missing', () => {
  const { scanCommands } = freshLinter();
  const dir = mkTempCommandsDir();
  writeFixture(dir, 'forgot.md', [
    '---',
    'name: forgot',
    'description: A command that forgot the field',
    '---',
    '',
    '# forgot',
  ].join('\n'));
  const result = scanCommands(dir);
  assert.equal(result.compliant.length, 0);
  assert.equal(result.missing.length, 1);
  assert.equal(result.invalid.length, 0);
  assert.equal(result.ok, false);
  assert.equal(result.missing[0].reason, 'missing_field');
});

// ---------- T3: invalid value fails ----------

run('T3 invalid value: typo / unknown reward type -> invalid', () => {
  const { scanCommands } = freshLinter();
  const dir = mkTempCommandsDir();
  writeFixture(dir, 'typo.md', [
    '---',
    'name: typo',
    'description: A command with a typo in the reward field',
    'interactive_first_reward: gibberish',
    '---',
  ].join('\n'));
  const result = scanCommands(dir);
  assert.equal(result.invalid.length, 1);
  assert.equal(result.invalid[0].reason, 'invalid_value');
  assert.equal(result.invalid[0].value, 'gibberish');
  assert.equal(result.ok, false);
});

// ---------- T4: --none (scripting only) accepted verbatim ----------

run('T4 --none (scripting only) verbatim accepted per rule doc line 81', () => {
  const { validateFrontmatter } = freshLinter();
  const r = validateFrontmatter({
    name: 'cron-job',
    interactive_first_reward: '--none (scripting only)',
  });
  assert.equal(r.ok, true, 'expected --none (scripting only) to validate; got ' + JSON.stringify(r));
  assert.equal(r.value, '--none (scripting only)');
});

// ---------- T5: every REWARD_TYPES enum value accepted ----------

run('T5 every REWARD_TYPES enum value accepted', () => {
  const { validateFrontmatter, REWARD_TYPES } = freshLinter();
  // Convert frozen Set to array for iteration -- check every entry.
  for (const v of REWARD_TYPES) {
    const r = validateFrontmatter({ interactive_first_reward: v });
    assert.equal(r.ok, true, 'expected ' + JSON.stringify(v) + ' to validate; got ' + JSON.stringify(r));
  }
  // And spot-check the 5 named ones (plus the scripting opt-out = 6 total).
  const expected = [
    'reframe_question',
    'instant_brief',
    'schema_preview',
    'calibration_distribution_preview',
    'paragraph_preview',
    '--none (scripting only)',
  ];
  for (const v of expected) {
    assert.ok(REWARD_TYPES.has(v), 'REWARD_TYPES missing canonical entry: ' + v);
  }
});

// ---------- T6: no-frontmatter file degrades gracefully ----------

run('T6 file without ANY frontmatter: degrades to missing (does NOT crash)', () => {
  const { scanCommands } = freshLinter();
  const dir = mkTempCommandsDir();
  writeFixture(dir, 'legacy.md', '# legacy command\n\nNo frontmatter at all.\n');
  const result = scanCommands(dir);
  assert.equal(result.missing.length, 1);
  assert.equal(result.missing[0].reason, 'no_frontmatter');
  assert.equal(result.invalid.length, 0);
});

// ---------- T7: CLI spawn -- compliant -> exit 0; missing -> exit 1 ----------

run('T7 CLI spawn: compliant dir exits 0; missing-field dir exits 1 with offender on stderr', () => {
  // Subtest A: all compliant -> exit 0.
  const dirGood = mkTempCommandsDir();
  writeFixture(dirGood, 'one.md', [
    '---',
    'name: one',
    'interactive_first_reward: instant_brief',
    '---',
  ].join('\n'));
  const okResult = spawnSync(process.execPath, [CLI_PATH, dirGood], { encoding: 'utf8' });
  assert.equal(okResult.status, 0, 'expected exit 0 on compliant; got ' + okResult.status + '\nstdout: ' + okResult.stdout + '\nstderr: ' + okResult.stderr);
  assert.ok(/the rule holds/.test(okResult.stdout), 'expected Larry-voice success on stdout; got: ' + okResult.stdout);

  // Subtest B: missing field -> exit 1, offender named on stderr.
  const dirBad = mkTempCommandsDir();
  writeFixture(dirBad, 'broken.md', [
    '---',
    'name: broken',
    'description: A command that forgot the field',
    '---',
  ].join('\n'));
  const badResult = spawnSync(process.execPath, [CLI_PATH, dirBad], { encoding: 'utf8' });
  assert.equal(badResult.status, 1, 'expected exit 1 on missing; got ' + badResult.status);
  assert.ok(/broken\.md/.test(badResult.stderr), 'expected stderr to name broken.md; got: ' + badResult.stderr);
  assert.ok(/missing_field/.test(badResult.stderr), 'expected stderr to mention missing_field reason; got: ' + badResult.stderr);
});

// ---------- T8: hook is wired (CRITICAL-4 invariant) ----------

run('T8 hook wired (CRITICAL-4): scripts/hooks/pre-commit references check-reward-before-investment.cjs', () => {
  const hook = fs.readFileSync(HOOK_PATH, 'utf8');
  assert.ok(
    hook.includes('check-reward-before-investment.cjs'),
    'hooks/pre-commit must reference check-reward-before-investment.cjs (CRITICAL-4); got hook of length ' + hook.length
  );
});

// ---------- T9: scaffold E2E (CRITICAL-4) -- temp git repo, staged offender, hook blocks ----------

run('T9 scaffold E2E (CRITICAL-4): hook blocks a staged commands/foo.md that lacks the field', () => {
  // Create an isolated temp git repo with a copy of our hook + scripts + lib.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mva-precommit-e2e-'));

  // Initialize bare git repo
  const init = spawnSync('git', ['init', '-q'], { cwd: tmp, encoding: 'utf8' });
  if (init.status !== 0) {
    // Skip if git is unavailable in this environment (exit 77 = POSIX skip).
    process.stderr.write('T9 skipped: git init failed; env=' + init.stderr + '\n');
    return;
  }
  // Local identity so commit (if ever attempted) wouldn't fail on identity --
  // we never actually commit; the hook is run directly via bash.
  spawnSync('git', ['config', 'user.email', 'test@example.invalid'], { cwd: tmp });
  spawnSync('git', ['config', 'user.name', 'Test'], { cwd: tmp });

  // Recreate the relevant directory structure inside the temp repo so the
  // hook can resolve paths the same way it does in the real repo. We mirror:
  //   <tmp>/scripts/hooks/pre-commit
  //   <tmp>/scripts/check-reward-before-investment.cjs
  //   <tmp>/lib/core/mva-rule-linter.cjs
  //   <tmp>/commands/foo.md  (the offender)
  fs.mkdirSync(path.join(tmp, 'scripts', 'hooks'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'lib', 'core'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'commands'), { recursive: true });

  fs.copyFileSync(HOOK_PATH, path.join(tmp, 'scripts', 'hooks', 'pre-commit'));
  fs.copyFileSync(CLI_PATH, path.join(tmp, 'scripts', 'check-reward-before-investment.cjs'));
  fs.copyFileSync(LINTER_PATH, path.join(tmp, 'lib', 'core', 'mva-rule-linter.cjs'));

  // Install the hook into .git/hooks/
  const installedHook = path.join(tmp, '.git', 'hooks', 'pre-commit');
  fs.copyFileSync(HOOK_PATH, installedHook);
  fs.chmodSync(installedHook, 0o755);

  // The offender: commands/foo.md with NO interactive_first_reward field.
  const offenderPath = path.join(tmp, 'commands', 'foo.md');
  fs.writeFileSync(offenderPath, [
    '---',
    'name: foo',
    'description: test command without the rule field',
    '---',
    '',
    '# foo',
  ].join('\n'), 'utf8');

  // Stage the offender
  spawnSync('git', ['add', 'commands/foo.md'], { cwd: tmp });

  // Run the hook directly. The Phase 87-01a guard runs BEFORE the linter
  // block; commands/ has no .room-root sentinel so the ROOM.md/MINTO.md
  // invariant skips (per the find_room_root scoping). The Phase 122
  // build-command-registry --check guard would run if scripts/build-command
  // -registry.cjs exists in the temp repo -- we did NOT copy it, so that
  // block is a no-op. That leaves OUR linter block as the gating check.
  //
  // The linter block must:
  //   1. detect that commands/foo.md is staged
  //   2. invoke node scripts/check-reward-before-investment.cjs
  //   3. propagate the non-zero exit
  //
  // We invoke the hook with `bash` so the BASH_SOURCE machinery works.
  const hookResult = spawnSync('bash', [installedHook], { cwd: tmp, encoding: 'utf8' });

  // The hook should exit non-zero. The stderr should mention foo.md.
  assert.notEqual(
    hookResult.status, 0,
    'expected non-zero exit from pre-commit hook with missing-field commands/foo.md staged; got ' + hookResult.status +
    '\nstdout: ' + hookResult.stdout + '\nstderr: ' + hookResult.stderr
  );
  // The hook should mention foo.md somewhere in its diagnostic output (either
  // stdout or stderr is fine -- the linter writes the offender to stderr;
  // the hook's wrapper line is on stderr too).
  const combined = (hookResult.stdout || '') + (hookResult.stderr || '');
  assert.ok(
    /foo\.md/.test(combined),
    'expected hook diagnostic to name foo.md; combined output: ' + combined
  );
});

// ---------- T10: WARN-5 -- new-project.md carries `instant_brief` (NOT reframe_question) ----------

run('T10 WARN-5: commands/new-project.md declares interactive_first_reward: instant_brief', () => {
  const { parseFrontmatter } = freshLinter();
  const npPath = path.resolve(REPO_ROOT, 'commands', 'new-project.md');
  const fm = parseFrontmatter(fs.readFileSync(npPath, 'utf8'));
  assert.ok(fm, 'commands/new-project.md must have parseable frontmatter');
  assert.equal(
    fm.interactive_first_reward,
    'instant_brief',
    'commands/new-project.md must carry interactive_first_reward: instant_brief (WARN-5; rule doc line 56-58 prescribes Instant Brief, NOT reframe_question); got: ' + JSON.stringify(fm.interactive_first_reward)
  );
});

// ---------- T11: WARN-5 audit -- 4-command rule-doc parity ----------

run('T11 WARN-5 audit: 4 named commands match rule-doc remediation column', () => {
  const { parseFrontmatter } = freshLinter();
  // Per docs/reward-before-investment-rule.md (the canonical in-repo copy
  // shipped by Plan 06 Task 2; the prescriptions live at lines 56-70 of the
  // source ~/MindrianRooms/.../reward-before-investment-rule.md):
  //   new-project   -> instant_brief                    (line 56-58)
  //   file-meeting  -> paragraph_preview                (line 60-62)
  //   grade         -> calibration_distribution_preview (line 64-66)
  //   onboard       -> reframe_question                 (line 68-70)
  const prescribed = {
    'new-project.md': 'instant_brief',
    'file-meeting.md': 'paragraph_preview',
    'grade.md': 'calibration_distribution_preview',
    'onboard.md': 'reframe_question',
  };
  for (const [filename, expected] of Object.entries(prescribed)) {
    const fpath = path.resolve(REPO_ROOT, 'commands', filename);
    const fm = parseFrontmatter(fs.readFileSync(fpath, 'utf8'));
    assert.ok(fm, 'commands/' + filename + ' must have parseable frontmatter');
    assert.equal(
      fm.interactive_first_reward,
      expected,
      'commands/' + filename + ' declares ' + JSON.stringify(fm.interactive_first_reward) +
      ' but rule doc prescribes ' + JSON.stringify(expected) + ' (WARN-5 4-command parity audit)'
    );
  }
});

// ---------- T12: 267.3 -- the original six survived the amendment ----------

run('T12 267.3 amendment: all six v1.13.0 members intact and the Set still frozen', () => {
  const { REWARD_TYPES } = freshLinter();
  const original = [
    'reframe_question',
    'instant_brief',
    'schema_preview',
    'calibration_distribution_preview',
    'paragraph_preview',
    '--none (scripting only)',
  ];
  for (const v of original) {
    assert.ok(
      REWARD_TYPES.has(v),
      'the 267.3 amendment must not drop or respell a v1.13.0 member; missing: ' + v
    );
  }
  assert.ok(
    Object.isFrozen(REWARD_TYPES),
    'REWARD_TYPES must stay frozen so no caller can mutate the vocabulary at runtime'
  );
  assert.ok(
    REWARD_TYPES.size >= original.length,
    'REWARD_TYPES shrank below the original six: ' + REWARD_TYPES.size
  );
});

// ---------- T13: 267.3 -- rule-doc allowed-values list is set-equal to the Set ----------

run('T13 267.3 parity: the rule doc allowed-values list names exactly the REWARD_TYPES members', () => {
  const { REWARD_TYPES } = freshLinter();
  const docPath = path.resolve(REPO_ROOT, 'docs', 'reward-before-investment-rule.md');
  const doc = fs.readFileSync(docPath, 'utf8');

  // The allowed-values list is the bullet block directly under the bold
  // vocabulary header. Tokens are the backtick-quoted leader of each bullet.
  const lines = doc.split(/\r?\n/);
  const headerIdx = lines.findIndex((l) => /REWARD_TYPES closed vocabulary/.test(l));
  assert.ok(headerIdx >= 0, 'rule doc must carry a REWARD_TYPES closed vocabulary list');

  const tokens = [];
  for (let i = headerIdx + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === '') continue;
    const m = /^-\s+`([^`]+)`/.exec(line);
    if (!m) break;
    tokens.push(m[1]);
  }

  assert.equal(
    tokens.length,
    REWARD_TYPES.size,
    'rule doc lists ' + tokens.length + ' allowed values but REWARD_TYPES has ' +
    REWARD_TYPES.size + '; doc and code have drifted. doc list: ' + JSON.stringify(tokens)
  );
  for (const t of tokens) {
    assert.ok(REWARD_TYPES.has(t), 'rule doc names a value REWARD_TYPES does not have: ' + t);
  }
  for (const v of REWARD_TYPES) {
    assert.ok(tokens.includes(v), 'REWARD_TYPES member absent from the rule-doc list: ' + v);
  }
});

// ---------- T14: 267.3 -- registry _doc.reward_vocabulary is set-equal to the Set ----------

run('T14 267.3 parity: data/first-reward-surfaces.json mirrors REWARD_TYPES exactly', () => {
  const { REWARD_TYPES } = freshLinter();
  const regPath = path.resolve(REPO_ROOT, 'data', 'first-reward-surfaces.json');
  const registry = JSON.parse(fs.readFileSync(regPath, 'utf8'));
  const vocab = registry._doc && registry._doc.reward_vocabulary;

  assert.ok(Array.isArray(vocab), 'registry _doc.reward_vocabulary must be an array');
  assert.equal(
    vocab.length,
    REWARD_TYPES.size,
    'registry mirrors ' + vocab.length + ' terms but REWARD_TYPES has ' + REWARD_TYPES.size +
    '; the registry must never mint a term of its own'
  );
  for (const v of vocab) {
    assert.ok(REWARD_TYPES.has(v), 'registry declares a term REWARD_TYPES does not have: ' + v);
  }
  for (const v of REWARD_TYPES) {
    assert.ok(vocab.includes(v), 'REWARD_TYPES member absent from the registry mirror: ' + v);
  }
});

// ---------- summary ----------

process.stdout.write('\nmva-rule-linter tests: ' + passed + '/' + (passed + failed) + ' passed\n');
if (failed > 0) {
  process.exit(1);
}
process.exit(0);
