#!/usr/bin/env node
'use strict';

/**
 * tests/test-298-runner-idempotent.cjs -- Phase 298 (harness-as-code) Plan
 * 01 (stub) / Plan 10 (this task) / Plan 11 (convergence + idempotence).
 *
 * Proves R-04 (tiered check, rung exit contract) and R-03 (never promotes)
 * for the half of scripts/run-harness.cjs plan 298-10 builds. Carries the
 * VALIDATION.md T-298-06 through T-298-09 rows:
 *   T-298-06 R-04 tiered check: --tier filters strictly by applies_to
 *   T-298-07 R-04 rung exit contract: blocking failure exits 1; logged
 *     failure exits 0 with one JSONL line
 *   T-298-08 R-04 converged no-op: runner writes only
 *     <room>/.mindrian/harness-run.json; second run is byte-identical
 *     (PLAN 298-11 -- the --room branch does not exist yet, left PENDING)
 *   T-298-09 R-04 read-only door (D-03a): runner never opens the write path
 *
 * SUBJECT: scripts/run-harness.cjs
 *
 * D-03a is encoded here as a source grep so the read-only-door rule cannot
 * be forgotten later, and it is proved TRUE from plan 298-10's first commit
 * even though the --room branch that would need a read-only door lands in
 * plan 298-11.
 *
 * Anti-vacuous-pass contract (T-233-04 false-success class): while SUBJECT is
 * absent this test SKIPs and exits 0. The moment SUBJECT lands, this test
 * FAILs (exit 1) until ASSERTIONS_IMPLEMENTED is flipped to true and the
 * PENDING checklist below is actually implemented -- it can never pass
 * vacuously in between. Plan 298-10 flips ASSERTIONS_IMPLEMENTED to true and
 * implements the tier/rung-exit/ghost/never-promote/D-03a entries below; the
 * convergence and idempotence entries stay PENDING for plan 298-11.
 *
 * Every fixture below is a disposable directory built with fs.mkdtempSync,
 * passed to the runner through its --root flag (and, where a spawned policy
 * needs its own MINDRIAN_HOME, through a disposable MINDRIAN_HOME too) --
 * the real data/harness-policies/ and the real ~/.mindrian are NEVER
 * touched or mutated by this suite.
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

const ASSERTIONS_IMPLEMENTED = true;

// PENDING: owned by plan 298-11 (the --room convergence branch lands there,
// on the same SUBJECT file). Not implemented here.
const PENDING = [
  '298-11: two consecutive --room data/harness-fixtures/converged-room runs both exit 0 with converged: true and leave git status --porcelain empty',
  '298-11: the two reports are byte-identical',
  '298-11: data/harness-fixtures/converged-room/.mindrian does not exist afterwards',
];

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

  console.log('');
  console.log('PENDING (owned by plan 298-11):');
  PENDING.forEach((line) => console.log('  - ' + line));
  console.log('');

  if (failCount > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main();
