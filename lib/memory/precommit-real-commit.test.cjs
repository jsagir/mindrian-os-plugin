#!/usr/bin/env node
'use strict';

/**
 * Phase 241 F-3 -- real-commit proof for the pre-commit guardian demotion.
 *
 * BSL 1.1. Copyright (c) Mindrian 2026.
 *
 * SC3 explicitly demands proof by a REAL `git commit` in a scratch repo, not
 * by calling runPreCommit() as a function (RESEARCH.md Wave 0 Gaps; 241-04-
 * PLAN.md standing_rules). This file drives the actual canonical hook
 * (scripts/hooks/pre-commit-room-minto-guard.sh) installed as a scratch
 * repo's real .git/hooks/pre-commit, and runs `git commit` for real.
 *
 * Fixture note (deviation from the plan's literal fixture wording -- see
 * 241-04-SUMMARY.md "Deviations from Plan" for the full evidence trail):
 * this file does NOT seed a section with a missing MINTO.md. Empirically
 * (git commit against the canonical hook, verified by hand before writing
 * this file), a directory inside a `.room-root` subtree that is missing
 * MINTO.md ALWAYS hard-blocks at the guard script's own Phase 87-01a
 * ROOM.md+MINTO.md existence gate (scripts/hooks/pre-commit-room-minto-
 * guard.sh, unconditional exit 2, no --strict/env opt-out, and unrelated to
 * F-3) BEFORE the script ever reaches the Feynman-MINTO guardian invocation
 * further down the same file. Using that fixture would make every test in
 * this file observe the OLDER, unrelated gate instead of F-3's advisory/
 * strict demotion, and Test 1's "guard actually fires" assertion would only
 * ever see the older gate's text, never the guardian's own. The fixture
 * used here instead seeds a MINTO.md that EXISTS (satisfying the Phase
 * 87-01a gate) but is missing `governing_thought` (Phase 241 F-2: this now
 * aggregates to SEVERITY.CRITICAL), which is the fixture shape that
 * actually exercises runPreCommit's advisory/strict branch through a real
 * commit.
 *
 * Four tests, all driving a real `git` binary against the canonical hook:
 *   1. The guard actually fires (anti-vacuity guard): the guardian's own
 *      violation text reaches the real commit's stderr.
 *   2. Advisory default: real commit exits 0, HEAD resolves (commit
 *      landed), stderr carries both the violation text and a counted WARN.
 *   3. Strict opt-in (MINTO_PRECOMMIT_STRICT=1): real commit is rejected,
 *      no commit lands, stderr carries the blocked header.
 *   4. A clean room (valid MINTO.md) still commits with zero violation
 *      output (false-positive guard).
 *
 * GUARDIAN_PRECOMMIT_STAGED is never assigned a path anywhere in this file
 * -- SC3 requires the staged set to come from a real `git diff --cached` in
 * a real repo, so this file explicitly deletes that variable from every
 * child environment instead.
 *
 * Skip-guard: if `git` is unavailable, every test FAILS with a clear
 * message rather than silently skipping (a skipped test in a repo whose
 * whole milestone is about vacuous gates is worse than no test).
 *
 * Run: node lib/memory/precommit-real-commit.test.cjs
 * Exit 0 on pass, 1 on any failure.
 */

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
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

// ---------------------------------------------------------------------------
// git availability skip-guard: FAIL loudly, never silently skip.
// ---------------------------------------------------------------------------
let GIT_AVAILABLE = false;
try {
  const probe = spawnSync('git', ['--version'], { encoding: 'utf8' });
  GIT_AVAILABLE = probe.status === 0;
} catch (_e) {
  GIT_AVAILABLE = false;
}

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const TMPDIRS = [];
function mkTmp(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  TMPDIRS.push(d);
  return d;
}
process.on('exit', () => {
  for (const d of TMPDIRS) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {}
  }
});

/**
 * Build a scratch git repo whose ROOT is itself the Data Room (.room-root
 * at the repo root), with one section directory (`market-analysis`) holding
 * a ROOM.md. Room root == repo root so getStagedFiles()'s `git diff --cached
 * --name-only` output (repo-root-relative) lines up 1:1 with the guardian's
 * roomDir-relative section computation -- staging anything nested one level
 * inside a subdirectory OTHER than the repo root itself, so the repo root
 * never appears in STAGED_DIRS and the Phase 87-01a top-level ROOM.md/
 * MINTO.md gate never fires for the room root.
 */
function initRoomRepo(prefix) {
  const repoDir = mkTmp(prefix);
  run('git', ['init', '-q'], repoDir);
  run('git', ['config', 'user.email', 'test@mindrian'], repoDir);
  run('git', ['config', 'user.name', 'test'], repoDir);
  fs.mkdirSync(path.join(repoDir, '.mindrian'), { recursive: true });
  fs.writeFileSync(path.join(repoDir, '.room-root'), '');
  const sectionDir = path.join(repoDir, 'market-analysis');
  fs.mkdirSync(sectionDir, { recursive: true });
  fs.writeFileSync(path.join(sectionDir, 'ROOM.md'), '# Market Analysis\n\nIdentity.\n');
  return { repoDir, sectionDir };
}

function writeMintoMissingGoverningThought(sectionDir) {
  fs.writeFileSync(
    path.join(sectionDir, 'MINTO.md'),
    '---\nschema_version: "1.0"\n---\n\n# Body\n\nContent.\n'
  );
}

function writeMintoValid(sectionDir) {
  const now = new Date().toISOString();
  const frontmatter = [
    '---',
    'schema_version: "1.0"',
    'governing_thought: "All clear."',
    'last_generated_at: "' + now + '"',
    'last_artifact_write_seen_at: "' + now + '"',
    'reasoning_health_score: 0.9',
    '---',
    '',
    '# Body',
    '',
    'Content.',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(sectionDir, 'MINTO.md'), frontmatter);
}

/** Install the canonical hook at this scratch repo's real hooks/pre-commit. */
function installHook(repoDir) {
  const rel = run('git', ['rev-parse', '--git-path', 'hooks/pre-commit'], repoDir).stdout.trim();
  const dst = path.isAbsolute(rel) ? rel : path.join(repoDir, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(GUARD_SRC, dst);
  fs.chmodSync(dst, 0o755);
  return dst;
}

/** Environment for a real commit: PLUGIN_ROOT resolves the guardian's real
 * scripts/feynman-minto-guardian.cjs (a fresh scratch repo has no such
 * file), and GUARDIAN_PRECOMMIT_STAGED is explicitly deleted so the staged
 * set can only come from a real `git diff --cached`. */
function commitEnv(extra) {
  const env = Object.assign({}, process.env, { PLUGIN_ROOT: REPO_ROOT }, extra || {});
  delete env.GUARDIAN_PRECOMMIT_STAGED;
  return env;
}

function run(cmd, args, cwd, env) {
  const res = spawnSync(cmd, args, {
    cwd: cwd,
    env: env || process.env,
    encoding: 'utf8',
    timeout: 15000,
  });
  return res;
}

// ---------------------------------------------------------------------------
// Test registration + runner
// ---------------------------------------------------------------------------

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

if (!GIT_AVAILABLE) {
  test('Test 1: the guard actually fires (anti-vacuity)', () => {
    throw new Error('git is unavailable in this environment; cannot prove SC3 by a real commit. FAILING rather than skipping.');
  });
  test('Test 2: advisory default -- commit lands, violations enumerated + counted WARN', () => {
    throw new Error('git is unavailable; see Test 1.');
  });
  test('Test 3: strict opt-in -- commit rejected, nothing lands', () => {
    throw new Error('git is unavailable; see Test 1.');
  });
  test('Test 4: a clean room still commits with zero violation output', () => {
    throw new Error('git is unavailable; see Test 1.');
  });
} else {

// ---------------------------------------------------------------------------
// Test 1: the guard actually fires. Anti-vacuity guard -- without this,
// tests 2 and 3 would pass identically on a fixture where the hook silently
// skipped, which is the exact false-green this milestone is named after.
// ---------------------------------------------------------------------------
test('Test 1: the guard actually fires (anti-vacuity)', () => {
  const fx = initRoomRepo('mos-precommit-t1-');
  installHook(fx.repoDir);
  writeMintoMissingGoverningThought(fx.sectionDir);
  run('git', ['add', 'market-analysis'], fx.repoDir);
  const res = run('git', ['commit', '-m', 'test 1: seeded breach, advisory default'], fx.repoDir, commitEnv());
  const combined = (res.stderr || '') + (res.stdout || '');
  assert.ok(
    combined.indexOf('[guardian]') !== -1,
    'the guardian\'s own text must reach the real commit\'s output; got: ' + combined
  );
  assert.ok(
    /governing_thought/.test(combined),
    'the guardian\'s violation text must name the seeded breach; got: ' + combined
  );
});

// ---------------------------------------------------------------------------
// Test 2: advisory default. Real commit exits 0, HEAD resolves (the commit
// genuinely landed), and stderr carries BOTH the per-violation text and the
// counted WARN line. Exit 0 alone is not sufficient -- a silent pass would
// satisfy the exit code while failing the honesty requirement (T-241-15).
// ---------------------------------------------------------------------------
test('Test 2: advisory default -- commit lands, violations enumerated + counted WARN', () => {
  const fx = initRoomRepo('mos-precommit-t2-');
  installHook(fx.repoDir);
  writeMintoMissingGoverningThought(fx.sectionDir);
  run('git', ['add', 'market-analysis'], fx.repoDir);
  const res = run('git', ['commit', '-m', 'test 2: seeded breach, advisory default lands'], fx.repoDir, commitEnv());
  assert.equal(res.status, 0, 'advisory default: commit must exit 0; stderr=' + res.stderr);
  const head = run('git', ['rev-parse', 'HEAD'], fx.repoDir);
  assert.equal(head.status, 0, 'HEAD must resolve: the commit must have genuinely landed');
  const stderr = res.stderr || '';
  assert.ok(/governing_thought/.test(stderr), 'stderr must carry the per-violation text; got: ' + stderr);
  assert.match(stderr, /\d+ violation/, 'stderr must carry a counted WARN line; got: ' + stderr);
  assert.match(stderr, /MINTO_PRECOMMIT_STRICT/, 'stderr must name the env restore path; got: ' + stderr);
  assert.match(stderr, /--strict/, 'stderr must name the --strict restore path; got: ' + stderr);
});

// ---------------------------------------------------------------------------
// Test 3: strict opt-in. Real commit with MINTO_PRECOMMIT_STRICT=1 exits
// non-zero, and NO commit lands (HEAD does not resolve in this brand-new
// repo). Not only the exit code -- the absence of a landed commit is the
// load-bearing assertion.
// ---------------------------------------------------------------------------
test('Test 3: strict opt-in -- commit rejected, nothing lands', () => {
  const fx = initRoomRepo('mos-precommit-t3-');
  installHook(fx.repoDir);
  writeMintoMissingGoverningThought(fx.sectionDir);
  run('git', ['add', 'market-analysis'], fx.repoDir);
  const res = run('git', ['commit', '-m', 'test 3: seeded breach, strict opt-in rejected'], fx.repoDir, commitEnv({ MINTO_PRECOMMIT_STRICT: '1' }));
  assert.notEqual(res.status, 0, 'strict opt-in: commit must be rejected (nonzero exit)');
  const head = run('git', ['rev-parse', 'HEAD'], fx.repoDir);
  assert.notEqual(head.status, 0, 'no commit must have landed: HEAD must not resolve in this fresh repo');
  const combined = (res.stderr || '') + (res.stdout || '');
  assert.ok(
    combined.indexOf('[guardian] pre-commit blocked') !== -1,
    'stderr must carry the blocked header; got: ' + combined
  );
});

// ---------------------------------------------------------------------------
// Test 4: a clean room still commits. False-positive guard -- without this,
// a bug that made everything advisory (or that broke the guardian entirely)
// would look identical to a correct demotion.
// ---------------------------------------------------------------------------
test('Test 4: a clean room still commits with zero violation output', () => {
  const fx = initRoomRepo('mos-precommit-t4-');
  installHook(fx.repoDir);
  writeMintoValid(fx.sectionDir);
  run('git', ['add', 'market-analysis'], fx.repoDir);
  const res = run('git', ['commit', '-m', 'test 4: clean room, no violations'], fx.repoDir, commitEnv());
  assert.equal(res.status, 0, 'clean room: commit must exit 0; stderr=' + res.stderr);
  const head = run('git', ['rev-parse', 'HEAD'], fx.repoDir);
  assert.equal(head.status, 0, 'HEAD must resolve: the commit must have genuinely landed');
  const stderr = res.stderr || '';
  assert.ok(
    stderr.indexOf('[guardian]') === -1,
    'stderr must carry NO guardian violation lines for a clean room; got: ' + stderr
  );
});

} // end GIT_AVAILABLE branch

let failed = 0;
for (const t of tests) {
  try {
    t.fn();
    process.stdout.write('PASS ' + t.name + '\n');
  } catch (e) {
    failed += 1;
    process.stderr.write('FAIL ' + t.name + '\n  ' + (e && e.stack || e) + '\n');
  }
}
process.stdout.write(
  '\nprecommit-real-commit tests: ' + (tests.length - failed) + '/' + tests.length + ' passed\n'
);
process.exit(failed === 0 ? 0 : 1);
