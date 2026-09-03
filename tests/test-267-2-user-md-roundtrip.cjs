'use strict';
// Phase 267.2 W2 (HOOK-10) -- the roundtrip pin, the reward-before-investment ordering
// pin, and the no-second-writer guard for scripts/first-install-router.cjs's investment
// leg. Plain CJS, node:assert/strict, node built-ins only.
//
// Every leg runs inside withIsolatedHome() with keylessEnv(), per tests/test-267-2-
// helpers.cjs's Pitfall 6 mitigation: os.homedir() reads /etc/passwd on POSIX and
// ignores process.env.HOME, so a child process with HOME/USERPROFILE overridden is the
// only way to prove this router never touches the real developer home.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { withIsolatedHome, keylessEnv, assertNoRawText } = require('./test-267-2-helpers.cjs');
const { readUserMd, writeUserMdAtomic } = require('../lib/core/user-md-ops.cjs');

const REPO = path.join(__dirname, '..');
const ROUTER_PATH = path.join(REPO, 'scripts', 'first-install-router.cjs');

// Deliberately NOT `require('../scripts/first-install-router.cjs')` for its exported
// PHASES: that module registers a top-level `process.on('uncaughtException', ...)`
// handler (its own last-resort safety net for when it runs as the hook) that would
// attach to THIS test process the moment it is required in-process, silently converting
// any later assertion failure in this file into a swallowed process.exit(0) instead of a
// loud test failure. Every sibling 267.2 router test (test-267-2-pre-room-reward.cjs,
// test-267-2-router-telemetry.cjs) avoids this the same way: reference the router only by
// PATH and always spawn it as a child process, never require() it in-process. PHASES is
// declared frozen in the router's own header ("The frozen phase sequence... advanced in
// this order and never skipped"), so duplicating the literal array here is safe.
const PHASES = Object.freeze([
  'armed',
  'routed',
  'reward_pending',
  'reward_delivered',
  'investment_asked',
  'done',
]);
const REWARD_DELIVERED_IDX = PHASES.indexOf('reward_delivered');

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

console.log('test-267-2-user-md-roundtrip');

// ---------- shared driving helper ----------

function callRouter(env, prompt) {
  const res = spawnSync(process.execPath, [ROUTER_PATH], {
    input: JSON.stringify({ prompt: prompt }),
    env: env,
    encoding: 'utf8',
    timeout: 10000,
  });
  assert.equal(res.status, 0, 'router exited non-zero: ' + res.status + ' stderr=' + res.stderr);
  let envelope = null;
  try { envelope = JSON.parse(res.stdout); } catch (_e) { /* leave null, caller asserts */ }
  return { raw: res.stdout, envelope: envelope };
}

function readState(home) {
  const p = path.join(home, '.mindrian', 'first-install', 'state.json');
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (_e) {
    return null;
  }
}

function userMdPathFor(home) {
  return path.join(home, '.mindrian-user.md');
}

function walkFiles(dir) {
  let out = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_e) {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walkFiles(full));
    else if (e.isFile()) out.push(full);
  }
  return out;
}

// Drives the router turn by turn from a virgin isolated HOME (no ~/.mindrian-onboarded
// marker) until state.json reads `targetPhase` or `maxTurns` is exhausted. `onTurn`, if
// supplied, is called after every turn with { turnIndex, envelope, state, userMdPath }.
function driveTo(env, home, prompt, targetPhase, maxTurns, onTurn) {
  const userMdPath = userMdPathFor(home);
  let state = null;
  for (let i = 1; i <= maxTurns; i++) {
    const { envelope } = callRouter(env, i === 1 ? prompt : 'irrelevant follow-up turn');
    state = readState(home);
    if (typeof onTurn === 'function') {
      onTurn({ turnIndex: i, envelope: envelope, state: state, userMdPath: userMdPath });
    }
    if (state && state.phase === targetPhase) {
      return { turns: i, state: state, envelope: envelope };
    }
  }
  throw new Error('driveTo: never reached phase ' + targetPhase + ' within ' + maxTurns
    + ' turns; last state=' + JSON.stringify(state));
}

// ============================================================
// Assertion 1: ROUNDTRIP
// ============================================================

ok('ROUNDTRIP: driving the router to investment_asked seeds a real, parseable '
  + '~/.mindrian-user.md carrying journey_stage: ordinary_world', function () {
  withIsolatedHome(function (ctx) {
    const env = keylessEnv(ctx.env);
    const result = driveTo(env, ctx.home, 'I want to start a new venture', 'investment_asked', 10);
    const userMdPath = userMdPathFor(ctx.home);

    assert.ok(fs.existsSync(userMdPath),
      'ROUNDTRIP: ~/.mindrian-user.md does not exist after reaching investment_asked '
      + '(turns=' + result.turns + ')');

    const raw = fs.readFileSync(userMdPath, 'utf8');
    assert.ok(/^---\r?\n[\s\S]*?\r?\n---/.test(raw),
      'ROUNDTRIP: ~/.mindrian-user.md does not parse as a frontmatter block');

    const parsed = readUserMd(userMdPath);
    assert.ok(parsed && parsed.parse_failed === false,
      'ROUNDTRIP: readUserMd could not parse the seeded file: ' + JSON.stringify(parsed));
    assert.equal(parsed.journey_stage, 'ordinary_world',
      'ROUNDTRIP: journey_stage was not seeded to ordinary_world, got: ' + JSON.stringify(parsed.journey_stage));
  });
});

// ============================================================
// Assertion 6: PART 8 (no raw prompt bytes reach disk)
// ============================================================

ok('PART 8 (Canon Part 8, Graph Boundary): no 8-or-more character substring of the '
  + 'driving sentence reaches any file under the isolated HOME -- telemetry carries '
  + 'sha256(prompt) only', function () {
  withIsolatedHome(function (ctx) {
    const env = keylessEnv(ctx.env);
    const distinctiveToken = 'distinctiveVentureWord9182';
    const prompt = 'I want to start a new venture, ' + distinctiveToken + ', today';

    driveTo(env, ctx.home, prompt, 'investment_asked', 10);

    const files = walkFiles(ctx.home);
    assert.ok(files.length > 0, 'PART 8 sanity check failed: no files found under the isolated HOME');
    for (const f of files) {
      assertNoRawText(f, distinctiveToken);
    }
  });
});

// ============================================================
// Assertion 2: C-3 FIXED
// ============================================================

ok('C-3 FIXED (research finding, reproduced empirically before this fix): a '
  + 'writeUserMdAtomic write of canonical_role: founder with role_blend.founder = 0.9 '
  + 'no longer reads back as student', function () {
  withIsolatedHome(function (ctx) {
    process.env.HOME = ctx.home;
    process.env.USERPROFILE = ctx.home;
    try {
      const userMdPath = userMdPathFor(ctx.home);
      writeUserMdAtomic(userMdPath, { canonical_role: 'founder', role_blend: { founder: 0.9 } });
      delete require.cache[require.resolve('../lib/core/user-archetype.cjs')];
      const archetype = require('../lib/core/user-archetype.cjs');
      const result = archetype.detectArchetype(ctx.home);
      assert.notEqual(result.archetype, 'student',
        'C-3 REGRESSED: a founder writing canonical_role: founder read back as student again. '
        + 'This is research finding C-3 (267.2-RESEARCH.md), reproduced empirically before this '
        + 'fix landed: buildFrontmatter always emits all seven zero-valued role_blend axis names, '
        + 'and the archetype reader used to regex-scan the raw whole file, so student/researcher/'
        + 'venturist tied 2/2/2 and the first-declared archetype (student) always won. Got: '
        + JSON.stringify(result));
    } finally {
      delete process.env.HOME;
      delete process.env.USERPROFILE;
    }
  });
});

// ============================================================
// Assertion 3: READ-MODIFY-WRITE
// ============================================================

ok('READ-MODIFY-WRITE (decision D-E): the router\'s seed write preserves a pre-existing '
  + 'canonical_role while adding journey_stage: ordinary_world -- a bare write would have '
  + 'clobbered canonical_role back to null (buildFrontmatter does not merge with the '
  + 'existing file)', function () {
  withIsolatedHome(function (ctx) {
    const env = keylessEnv(ctx.env);
    const userMdPath = userMdPathFor(ctx.home);

    // Pre-seed a record as if identity_write (or a prior session) had already captured
    // canonical_role, BEFORE the router ever runs.
    writeUserMdAtomic(userMdPath, { canonical_role: 'founder' });

    driveTo(env, ctx.home, 'just want to talk today', 'investment_asked', 10);

    const after = readUserMd(userMdPath);
    assert.ok(after && after.parse_failed === false,
      'READ-MODIFY-WRITE: post-seed file did not parse: ' + JSON.stringify(after));
    assert.equal(after.canonical_role, 'founder',
      'READ-MODIFY-WRITE regressed: canonical_role was clobbered to '
      + JSON.stringify(after.canonical_role) + ' instead of staying founder -- decision D-E\'s '
      + 'read-modify-write requirement (D-N item 1) is broken');
    assert.equal(after.journey_stage, 'ordinary_world',
      'READ-MODIFY-WRITE: journey_stage was not set to ordinary_world by the router\'s seed write');
  });
});

// ============================================================
// Assertion 4: ORDERING (decision D-L)
// ============================================================

ok('ORDERING (decision D-L): no ~/.mindrian-user.md exists and no additionalContext '
  + 'mentions identity_write on any turn before reward_delivered; both become true only '
  + 'once the phase reaches investment_asked', function () {
  withIsolatedHome(function (ctx) {
    const env = keylessEnv(ctx.env);
    const userMdPath = userMdPathFor(ctx.home);
    let sawInvestmentAsked = false;

    driveTo(env, ctx.home, 'just want to talk today', 'investment_asked', 10, function (turn) {
      const phase = turn.state && turn.state.phase;
      const phaseIdx = PHASES.indexOf(phase);
      const additionalContext = (turn.envelope && turn.envelope.hookSpecificOutput
        && turn.envelope.hookSpecificOutput.additionalContext) || '';

      if (phase && phaseIdx !== -1 && phaseIdx < REWARD_DELIVERED_IDX) {
        assert.ok(!fs.existsSync(turn.userMdPath),
          'ORDERING (D-L) VIOLATED: ~/.mindrian-user.md exists at turn ' + turn.turnIndex
          + ' while phase is still "' + phase + '" (earlier than reward_delivered) -- this '
          + 'reproduces the exact defect this phase exists to fix');
        assert.equal(additionalContext.indexOf('identity_write'), -1,
          'ORDERING (D-L) VIOLATED: additionalContext names identity_write at turn '
          + turn.turnIndex + ' while phase is still "' + phase + '" (earlier than '
          + 'reward_delivered)');
      }

      if (phase === 'investment_asked') {
        sawInvestmentAsked = true;
        assert.ok(fs.existsSync(turn.userMdPath),
          'ORDERING: phase reached investment_asked at turn ' + turn.turnIndex
          + ' but ~/.mindrian-user.md still does not exist');
        assert.notEqual(additionalContext.indexOf('identity_write'), -1,
          'ORDERING: phase reached investment_asked at turn ' + turn.turnIndex
          + ' but additionalContext does not name identity_write');
      }
    });

    assert.ok(sawInvestmentAsked, 'ORDERING: the drive never observed phase investment_asked');
    assert.ok(fs.existsSync(userMdPath), 'ORDERING: ~/.mindrian-user.md missing after the full drive');
  });
});

// ============================================================
// Assertion 5: NO SECOND WRITER (MEMOP-08)
// ============================================================

ok('NO SECOND WRITER (MEMOP-08): exactly the three-file reference set for '
  + '~/.mindrian-user.md exists repo-wide, and none of those three files implements its '
  + 'own renameSync-based atomic write for that path', function () {
  const expectedFiles = [
    'lib/core/user-archetype.cjs',
    'lib/mcp/tools/identity.cjs',
    'scripts/first-install-router.cjs',
  ];

  const grep = spawnSync('grep', ['-rn', 'mindrian-user\\.md', 'lib/', 'scripts/', 'hooks/'],
    { cwd: REPO, encoding: 'utf8' });
  assert.ok(grep.status === 0 || grep.status === 1, 'grep exited unexpectedly: ' + grep.status + ' ' + grep.stderr);
  const lines = (grep.stdout || '').split('\n').filter(Boolean);
  const fileSet = new Set(lines.map(function (l) { return l.split(':')[0]; }));

  assert.equal(fileSet.size, expectedFiles.length,
    'MEMOP-08: expected exactly the three-file reference set ' + JSON.stringify(expectedFiles)
    + ' for ~/.mindrian-user.md, found ' + JSON.stringify(Array.from(fileSet))
    + ' -- a fourth file here means either a new writer (MEMOP-08 violation) or a scope '
    + 'change that needs re-auditing. All matches: ' + JSON.stringify(lines));
  for (const f of expectedFiles) {
    assert.ok(fileSet.has(f),
      'MEMOP-08: expected file ' + f + ' missing from the ~/.mindrian-user.md reference set. '
      + 'Found set: ' + JSON.stringify(Array.from(fileSet)));
  }

  // For each of the three referencing files, confirm no renameSync call in that file is
  // wired to the identity-file path (a proximity heuristic: no `renameSync` line has
  // `userMdPath` / `USER_MD_PATH` / `mindrian-user` within the surrounding 12 lines).
  // scripts/first-install-router.cjs legitimately contains ONE renameSync call for its
  // OWN, unrelated ~/.mindrian/first-install/state.json bookkeeping (shipped by plan
  // 267.2-06/07, pre-dating this plan) -- that is not a second ~/.mindrian-user.md
  // writer, and this proximity check is what tells the two apart instead of a blunt
  // whole-file substring ban that would false-positive against it.
  for (const f of expectedFiles) {
    const src = fs.readFileSync(path.join(REPO, f), 'utf8');
    const srcLines = src.split('\n');
    srcLines.forEach(function (line, idx) {
      if (line.indexOf('renameSync') === -1) return;
      const windowStart = Math.max(0, idx - 12);
      const windowEnd = Math.min(srcLines.length, idx + 1);
      const windowText = srcLines.slice(windowStart, windowEnd).join('\n');
      assert.ok(
        windowText.indexOf('userMdPath') === -1
          && windowText.indexOf('USER_MD_PATH') === -1
          && windowText.indexOf('mindrian-user') === -1,
        'MEMOP-08 VIOLATED: ' + f + ':' + (idx + 1) + ' contains a renameSync call whose '
        + 'surrounding context references the ~/.mindrian-user.md path -- this is a second '
        + 'atomic-write implementation for the identity file, forbidden by MEMOP-08. Line: '
        + line
      );
    });
  }

  // Sanity: the ONE canonical implementation still exists and is still the only thing
  // identity.cjs and first-install-router.cjs delegate to.
  const userMdOpsSrc = fs.readFileSync(path.join(REPO, 'lib', 'core', 'user-md-ops.cjs'), 'utf8');
  assert.ok(userMdOpsSrc.indexOf('renameSync') !== -1,
    'MEMOP-08: lib/core/user-md-ops.cjs no longer contains the canonical atomic-write '
    + 'implementation -- writeUserMdAtomic may have been removed or rewritten');
  for (const f of ['lib/mcp/tools/identity.cjs', 'scripts/first-install-router.cjs']) {
    const src = fs.readFileSync(path.join(REPO, f), 'utf8');
    assert.notEqual(src.indexOf('writeUserMdAtomic'), -1,
      'MEMOP-08: ' + f + ' no longer calls writeUserMdAtomic -- it may have grown its own '
      + 'write implementation, which MEMOP-08 forbids');
  }
});

console.log('\nPASS test-267-2-user-md-roundtrip (' + n + ' assertions)');
