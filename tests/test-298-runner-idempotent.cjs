#!/usr/bin/env node
'use strict';

/**
 * tests/test-298-runner-idempotent.cjs -- Phase 298 (harness-as-code) Plan
 * 01 (stub) / Plan 10 (tier/rung-exit/ghost/never-promote/D-03a) / Plan 11
 * (convergence + idempotence, this task).
 *
 * Proves R-04 (tiered check, rung exit contract, converged no-op), R-05
 * (ghost refusal) and R-03 (never promotes) for scripts/run-harness.cjs.
 * Carries the VALIDATION.md T-298-06 through T-298-09 and T-298-11 rows:
 *   T-298-06 R-04 tiered check: --tier filters strictly by applies_to
 *   T-298-07 R-04 rung exit contract: blocking failure exits 1; logged
 *     failure exits 0 with one JSONL line
 *   T-298-08 R-04 converged no-op: runner writes only
 *     <room>/.mindrian/harness-run.json; second run is byte-identical
 *   T-298-09 R-04 read-only door (D-03a): runner never opens the write path
 *   T-298-11 R-05 ghost refusal: a ghosted gate-graph-derive-health policy
 *     is the missing-information error class -- refuse converged:true,
 *     name the ghost, never retry
 *
 * SUBJECT: scripts/run-harness.cjs
 *
 * D-03a is encoded here as a source grep so the read-only-door rule cannot
 * be forgotten later.
 *
 * Anti-vacuous-pass contract (T-233-04 false-success class): while SUBJECT is
 * absent this test SKIPs and exits 0. The moment SUBJECT lands, this test
 * FAILs (exit 1) until ASSERTIONS_IMPLEMENTED is flipped to true and every
 * PENDING entry is actually implemented -- it can never pass vacuously in
 * between. Plan 298-10 flipped ASSERTIONS_IMPLEMENTED to true and
 * implemented the tier/rung-exit/ghost-in-`--check`/never-promote/D-03a
 * entries; plan 298-11 (this task) implements the remaining convergence,
 * idempotence and `--room` ghost-refusal entries, leaving PENDING empty.
 *
 * DISPOSABLE-FIXTURE CONVENTION AND ITS ONE STATED EXCEPTION: every OTHER
 * fixture in this file is a disposable directory built with
 * fs.mkdtempSync, passed to the runner through its --root or --room flag
 * (and, where a spawned policy needs its own MINDRIAN_HOME, through a
 * disposable MINDRIAN_HOME too) -- the real data/harness-policies/ and the
 * real ~/.mindrian are NEVER touched or mutated by this suite. The
 * convergence-and-idempotence block below is the ONE deliberate exception:
 * it runs `--room` against the COMMITTED data/harness-fixtures/converged-
 * room fixture rather than a temp copy, because the requirement it proves
 * (R-04's headline truth) is specifically that `git status --porcelain` on
 * the REAL, COMMITTED fixture stays empty after a run -- a disposable temp
 * copy could never prove that, since a temp directory is never tracked by
 * git in the first place. The ghost-refusal block copies the real policy
 * files into a temp directory precisely so the rewritten ghost policy
 * never touches the real data/harness-policies/, and asserts that
 * separately.
 *
 * Run: node tests/test-298-runner-idempotent.cjs
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const SUBJECT = path.join(REPO_ROOT, 'scripts', 'run-harness.cjs');
const TEST_NAME = 'test-298-runner-idempotent.cjs';
const FIXTURE_ROOM_RELATIVE = path.join('data', 'harness-fixtures', 'converged-room');
const FIXTURE_ROOM_ABS = path.join(REPO_ROOT, FIXTURE_ROOM_RELATIVE);
const REAL_POLICIES_DIR = path.join(REPO_ROOT, 'data', 'harness-policies');

const ASSERTIONS_IMPLEMENTED = true;

// PENDING: every entry plan 298-11 owned has been implemented below. Kept
// as an empty array (rather than deleted) so the anti-vacuous-pass shape
// (SKIP while absent, FAIL while PENDING non-empty, PASS once implemented)
// stays visible for the next plan that touches this SUBJECT.
const PENDING = [];

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
// Fixture construction: a disposable root carrying its own data/harness-
// policies/ and scripts/ directories, so the runner's --root flag can point
// at it instead of the real repository root.
// ---------------------------------------------------------------------------
function buildFixtureRoot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-298-runner-'));
  fs.mkdirSync(path.join(dir, 'data', 'harness-policies'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'data', 'harness-policies', '_schema.json'),
    JSON.stringify(
      {
        _doc: {
          rung_vocabulary: ['declared', 'logged', 'blocking'],
          kind_vocabulary: ['gate', 'voice', 'memory', 'contract'],
          applies_to_vocabulary: ['pre-flight', 'pre-tag', 'full', 'stop-hook', 'room'],
        },
      },
      null,
      2
    )
  );
  return dir;
}

function writePolicy(root, id, overrides) {
  const base = {
    id,
    kind: 'gate',
    runner: null,
    args: [],
    rung: 'declared',
    evidence_log: null,
    promotion_rule: { window_runs: 10, max_false_positive_rate: 0.1, min_true_positives: 1 },
    owner: 'test',
    pinned_by: [],
    applies_to: ['full'],
    notes: 'fixture policy for tests/test-298-runner-idempotent.cjs',
  };
  const policy = Object.assign({}, base, overrides || {}, { id });
  fs.writeFileSync(path.join(root, 'data', 'harness-policies', id + '.json'), JSON.stringify(policy, null, 2));
  return policy;
}

function runRunner(root, args, extraEnv) {
  return spawnSync(process.execPath, [SUBJECT, '--root', root].concat(args || []), {
    encoding: 'utf8',
    env: Object.assign({}, process.env, extraEnv || {}),
  });
}

function rmDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// runRoomCommand: unlike runRunner (which always injects --root), the
// --room block needs full control over whether --root is present at all
// (the convergence/idempotence cases omit it entirely, so the runner's
// default root resolves to the live repo; the ghost-refusal case supplies
// a temp --root). cwd is pinned to REPO_ROOT so a relative --room path and
// a relative `git status --porcelain` invocation agree on what "relative"
// means.
function runRoomCommand(args) {
  return spawnSync(process.execPath, [SUBJECT].concat(args), { encoding: 'utf8', cwd: REPO_ROOT });
}

function gitPorcelain(relativePath) {
  return spawnSync('git', ['status', '--porcelain', relativePath], { encoding: 'utf8', cwd: REPO_ROOT }).stdout;
}

function writeLines(filePath, lines) {
  fs.writeFileSync(filePath, lines.join('\n') + '\n');
}

function main() {
  if (!fs.existsSync(SUBJECT)) {
    process.stdout.write('SKIP ' + TEST_NAME + ' (missing ' + SUBJECT + ')\n');
    process.exit(0);
  }

  if (!ASSERTIONS_IMPLEMENTED) {
    process.stdout.write('FAIL ' + TEST_NAME + ': subject landed but assertions are still a stub\n');
    process.stdout.write('PENDING:\n');
    PENDING.forEach((line) => process.stdout.write('  - ' + line + '\n'));
    process.exit(1);
  }

  // -------------------------------------------------------------------------
  // T-298-06: tier filtering.
  // -------------------------------------------------------------------------
  record('tier filtering: --check --tier pre-tag --json reports only policies whose applies_to contains pre-tag', () => {
    const root = buildFixtureRoot();
    try {
      writePolicy(root, 'in-tier', { applies_to: ['pre-tag'] });
      writePolicy(root, 'out-of-tier', { applies_to: ['stop-hook'] });
      const res = runRunner(root, ['--check', '--tier', 'pre-tag', '--json']);
      assertEqual(res.status, 0, 'exit code');
      const report = JSON.parse(res.stdout);
      assertEqual(report.tier, 'pre-tag', 'reported tier');
      const ids = report.policies.map((p) => p.id);
      if (!ids.includes('in-tier')) throw new Error('expected in-tier to be included, got: ' + ids.join(','));
      if (ids.includes('out-of-tier')) throw new Error('expected out-of-tier to be excluded, got: ' + ids.join(','));
    } finally {
      rmDir(root);
    }
  });

  // -------------------------------------------------------------------------
  // T-298-07: rung exit contract.
  // -------------------------------------------------------------------------
  record('rung exit contract: a logged failing policy exits 0 and appends exactly one JSONL row', () => {
    const root = buildFixtureRoot();
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-298-home-'));
    try {
      fs.writeFileSync(path.join(root, 'scripts', 'fails.cjs'), 'process.exit(1);\n');
      writePolicy(root, 'temp-logged-fails', { runner: 'scripts/fails.cjs', rung: 'logged', applies_to: ['full'] });
      const res = runRunner(root, ['--check', '--json'], { MINDRIAN_HOME: home });
      assertEqual(res.status, 0, 'a logged failure must not fail the tier');
      const report = JSON.parse(res.stdout);
      const entry = report.policies.find((p) => p.id === 'temp-logged-fails');
      if (!entry) throw new Error('temp-logged-fails missing from report');
      assertEqual(entry.verdict, 'fail', 'verdict (the spawn failed; the tier still passes)');
      const logPath = path.join(home, 'voice-style.jsonl');
      const rows = fs.readFileSync(logPath, 'utf8').trim().split('\n').filter(Boolean);
      assertEqual(rows.length, 1, 'exactly one JSONL row appended');
      const row = JSON.parse(rows[0]);
      assertEqual(row.policy_id, 'temp-logged-fails', 'appended row policy_id');
    } finally {
      rmDir(root);
      rmDir(home);
    }
  });

  record('rung exit contract: the same policy at rung blocking exits 1', () => {
    const root = buildFixtureRoot();
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-298-home-'));
    try {
      fs.writeFileSync(path.join(root, 'scripts', 'fails.cjs'), 'process.exit(1);\n');
      writePolicy(root, 'temp-blocking-fails', { runner: 'scripts/fails.cjs', rung: 'blocking', applies_to: ['full'] });
      const res = runRunner(root, ['--check', '--json'], { MINDRIAN_HOME: home });
      assertEqual(res.status, 1, 'a blocking failure must fail the tier');
      const report = JSON.parse(res.stdout);
      const entry = report.policies.find((p) => p.id === 'temp-blocking-fails');
      if (!entry) throw new Error('temp-blocking-fails missing from report');
      assertEqual(entry.verdict, 'fail', 'verdict');
      assertEqual(entry.exit_status, 1, 'exit_status');
    } finally {
      rmDir(root);
      rmDir(home);
    }
  });

  // -------------------------------------------------------------------------
  // Ghost handling.
  // -------------------------------------------------------------------------
  record('ghost handling: a null-runner policy and a missing-file-runner policy both report ghost and never change exit status', () => {
    const root = buildFixtureRoot();
    try {
      writePolicy(root, 'ghost-null', { runner: null, rung: 'blocking', applies_to: ['full'] });
      writePolicy(root, 'ghost-missing', { runner: 'scripts/does-not-exist.cjs', rung: 'blocking', applies_to: ['full'] });
      const res = runRunner(root, ['--check', '--json']);
      assertEqual(res.status, 0, 'ghosts never block the tier');
      const report = JSON.parse(res.stdout);
      const g1 = report.policies.find((p) => p.id === 'ghost-null');
      const g2 = report.policies.find((p) => p.id === 'ghost-missing');
      if (!g1 || !g2) throw new Error('expected both ghost fixtures in the report, got: ' + report.policies.map((p) => p.id).join(','));
      assertEqual(g1.verdict, 'ghost', 'ghost-null verdict');
      assertEqual(g2.verdict, 'ghost', 'ghost-missing verdict');
    } finally {
      rmDir(root);
    }
  });

  // -------------------------------------------------------------------------
  // R-03: never promotes.
  // -------------------------------------------------------------------------
  record('never promotes: zero rung assignments in the runner source', () => {
    const src = fs.readFileSync(SUBJECT, 'utf8');
    const rungAssignments = (src.match(/\brung\s*=[^=]/g) || []).length;
    assertEqual(rungAssignments, 0, 'zero rung assignments in scripts/run-harness.cjs');
  });

  record('never promotes: two --policy runs never change the temp policy file mtime', () => {
    const root = buildFixtureRoot();
    try {
      writePolicy(root, 'never-promote-me', { runner: null, rung: 'declared', applies_to: ['full'] });
      const policyFile = path.join(root, 'data', 'harness-policies', 'never-promote-me.json');
      const before = fs.statSync(policyFile).mtimeMs;
      const r1 = runRunner(root, ['--policy', 'never-promote-me']);
      const r2 = runRunner(root, ['--policy', 'never-promote-me']);
      assertEqual(r1.status, 0, 'first --policy run exit code');
      assertEqual(r2.status, 0, 'second --policy run exit code');
      const after = fs.statSync(policyFile).mtimeMs;
      assertEqual(after, before, 'mtime of the policy file must not change across two --policy runs');
    } finally {
      rmDir(root);
    }
  });

  // -------------------------------------------------------------------------
  // T-298-09 / D-03a: read-only door source grep.
  // -------------------------------------------------------------------------
  record('D-03a: source grep for openGraph / openRoomDbForCaller / room-db.cjs returns zero matches', () => {
    const src = fs.readFileSync(SUBJECT, 'utf8');
    const matches = (src.match(/openGraph|openRoomDbForCaller|room-db\.cjs/g) || []).length;
    assertEqual(matches, 0, 'zero D-03a write-path references in scripts/run-harness.cjs');
  });

  // -------------------------------------------------------------------------
  // T-298-08 / R-04: convergence and idempotence against the COMMITTED
  // fixture. See the file header for why this block runs against the real,
  // tracked data/harness-fixtures/converged-room rather than a temp copy.
  // -------------------------------------------------------------------------
  record('convergence + idempotence: two --room runs against the committed fixture both exit 0 with converged: true, and stdout is byte-identical', () => {
    const r1 = runRoomCommand(['--room', FIXTURE_ROOM_RELATIVE, '--json']);
    const r2 = runRoomCommand(['--room', FIXTURE_ROOM_RELATIVE, '--json']);
    assertEqual(r1.status, 0, 'first run exit code');
    assertEqual(r2.status, 0, 'second run exit code');
    const report1 = JSON.parse(r1.stdout);
    const report2 = JSON.parse(r2.stdout);
    assertEqual(report1.converged, true, 'first run converged verdict');
    assertEqual(report2.converged, true, 'second run converged verdict');
    if (r1.stdout !== r2.stdout) {
      throw new Error('the two runs produced different stdout -- a non-deterministic (likely clock-derived) field leaked into the report');
    }
  });

  // Kept as its own record entry, independent of the converged-verdict
  // assertion above, so a ghost-ordering regression (Pitfall 10) fails
  // exactly one assertion instead of masking the other.
  record('convergence + idempotence: zero writes -- .mindrian is never created under the fixture and git status --porcelain stays empty', () => {
    if (fs.existsSync(path.join(FIXTURE_ROOM_ABS, '.mindrian'))) {
      throw new Error('.mindrian was created under the committed fixture -- the runner must never create it (D-03a sibling rule)');
    }
    const status = gitPorcelain(FIXTURE_ROOM_RELATIVE);
    assertEqual(status, '', 'git status --porcelain on the fixture must be empty after two runs');
  });

  record('convergence + idempotence: exported countEntries returns 13 against the fixture (in-process)', () => {
    const { countEntries } = require(SUBJECT);
    assertEqual(countEntries(FIXTURE_ROOM_ABS), 13, 'countEntries(fixture)');
  });

  // -------------------------------------------------------------------------
  // T-298-11 / R-05: ghost refusal. A copy of the real policy set, never
  // the real data/harness-policies/ itself, carries the rewritten ghost.
  // -------------------------------------------------------------------------
  record('ghost refusal: a ghosted gate-graph-derive-health policy refuses converged:true and names the ghost', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-298-ghost-policies-'));
    const destDir = path.join(tempRoot, 'data', 'harness-policies');
    fs.mkdirSync(destDir, { recursive: true });
    try {
      const files = fs.readdirSync(REAL_POLICIES_DIR).filter((f) => f.endsWith('.json'));
      for (const f of files) {
        const raw = fs.readFileSync(path.join(REAL_POLICIES_DIR, f), 'utf8');
        if (f === 'gate-graph-derive-health.json') {
          const policy = JSON.parse(raw);
          policy.runner = null;
          fs.writeFileSync(path.join(destDir, f), JSON.stringify(policy, null, 2));
        } else {
          fs.writeFileSync(path.join(destDir, f), raw);
        }
      }
      const res = runRoomCommand(['--root', tempRoot, '--room', FIXTURE_ROOM_RELATIVE, '--json']);
      assertEqual(res.status, 1, 'a ghosted health gate must refuse converged:true (exit 1)');
      const report = JSON.parse(res.stdout);
      assertEqual(report.converged, false, 'converged verdict');
      assertEqual(report.checks.derive_health_declared, false, 'derive_health_declared check');
      const namesTheGhost = report.findings.some(
        (line) => line.indexOf('gate-graph-derive-health') !== -1 && line.indexOf('ghost') !== -1
      );
      if (!namesTheGhost) {
        throw new Error('report findings do not name gate-graph-derive-health as a ghost: ' + JSON.stringify(report.findings));
      }
    } finally {
      rmDir(tempRoot);
    }
  });

  record('ghost refusal: the real data/harness-policies/ directory is never touched', () => {
    assertEqual(gitPorcelain('data/harness-policies'), '', 'git status --porcelain on the real policy directory must be empty');
  });

  // -------------------------------------------------------------------------
  // Non-converged rooms: a missing ROOM.md, and a dirty derive queue with an
  // existing .mindrian (the report-write case). Both are disposable
  // fs.mkdtempSync rooms.
  // -------------------------------------------------------------------------
  record('non-converged: a room missing one section ROOM.md exits 1 and names room_md_present', () => {
    const room = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-298-missing-room-'));
    try {
      fs.mkdirSync(path.join(room, 'section-a'));
      fs.writeFileSync(path.join(room, 'section-a', 'ROOM.md'), '# section-a\n');
      fs.writeFileSync(path.join(room, 'section-a', 'entry1.md'), '# entry\n');
      fs.mkdirSync(path.join(room, 'section-b')); // deliberately no ROOM.md
      writeLines(path.join(room, 'STATE.md'), [
        '---',
        'computed: 2026-01-01T00:00:00Z',
        'venture_stage: Investment',
        'total_entries: 1',
        '---',
        '# Data Room State',
      ]);
      const res = runRoomCommand(['--room', room, '--json']);
      assertEqual(res.status, 1, 'missing ROOM.md must not converge (exit 1)');
      const report = JSON.parse(res.stdout);
      assertEqual(report.converged, false, 'converged verdict');
      assertEqual(report.checks.room_md_present, false, 'room_md_present check');
    } finally {
      rmDir(room);
    }
  });

  record('non-converged: a room with an existing .mindrian and a non-empty derive queue gets a written report and converged:false', () => {
    const room = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-298-dirty-queue-'));
    try {
      fs.mkdirSync(path.join(room, 'section-a'));
      fs.writeFileSync(path.join(room, 'section-a', 'ROOM.md'), '# section-a\n');
      fs.writeFileSync(path.join(room, 'section-a', 'entry1.md'), '# entry\n');
      writeLines(path.join(room, 'STATE.md'), [
        '---',
        'computed: 2026-01-01T00:00:00Z',
        'venture_stage: Investment',
        'total_entries: 1',
        '---',
        '# Data Room State',
      ]);
      fs.mkdirSync(path.join(room, '.mindrian'));
      fs.writeFileSync(
        path.join(room, '.mindrian', 'graph-derive-queue.json'),
        JSON.stringify({ entries: [{ roomDir: room, enqueued_at: '2026-01-01T00:00:00Z' }] }, null, 2)
      );
      const res = runRoomCommand(['--room', room, '--json']);
      const reportPath = path.join(room, '.mindrian', 'harness-run.json');
      if (!fs.existsSync(reportPath)) {
        throw new Error('expected ' + reportPath + ' to be written when .mindrian already exists in the room');
      }
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
      assertEqual(report.converged, false, 'converged verdict (non-empty derive queue)');
      assertEqual(report.checks.derive_queue_empty, false, 'derive_queue_empty check');
      assertEqual(res.status, 1, 'exit code');
    } finally {
      rmDir(room);
    }
  });

  if (PENDING.length > 0) {
    console.log('');
    console.log('PENDING:');
    PENDING.forEach((line) => console.log('  - ' + line));
    console.log('');
  }

  if (failCount > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main();
