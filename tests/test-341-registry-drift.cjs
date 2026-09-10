#!/usr/bin/env node
'use strict';

/*
 * tests/test-341-registry-drift.cjs -- Phase 341 Plan 04 (D-08), the folded
 * registry-drift todo.
 *
 * Arms:
 *   1. diffRegistries is pure and correct: a 3-command baseline vs a
 *      2-command current yields removed=[the missing one], added=[].
 *   2. A command whose visibility changed appears in visibilityChanged and
 *      NOT in removed.
 *   3. check() against the real repo (baseline = the committed fixture,
 *      forced via the env seam) exits 0 today.
 *   4. check() with CHECK_REGISTRY_DRIFT_BASELINE pointed at a temp baseline
 *      containing an invented command exits non-zero and names it.
 *   5. The policy validates: run-harness.cjs --check exits 0 and names
 *      registry-drift.
 *   6. The policy is on `logged` and therefore does NOT fail the tier:
 *      run-harness.cjs --tier pre-tag still exits 0 even when the runner
 *      would exit non-zero (driven via the env seam pointed at the
 *      invented-command baseline).
 *   7. promotion_rule was authored before evidence: the policy's
 *      evidence_log path does not exist yet on this machine, or is empty if
 *      it does. Reported, never failed -- the point is to record the
 *      starting state honestly.
 *
 * House rule: hyphens only, no em-dashes.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const RUNNER_PATH = path.join(REPO_ROOT, 'scripts', 'check-registry-drift.cjs');
const RUN_HARNESS_PATH = path.join(REPO_ROOT, 'scripts', 'run-harness.cjs');
const FIXTURE_PATH = path.join(REPO_ROOT, 'tests', 'fixtures', '341-registry-drift-baseline.json');
const POLICY_PATH = path.join(REPO_ROOT, 'data', 'harness-policies', 'registry-drift.json');
const runner = require(RUNNER_PATH);

let PASS = 0;
let FAIL = 0;

function check(name, cond, detail) {
  if (cond) {
    PASS++;
    console.log('  PASS: ' + name);
  } else {
    FAIL++;
    console.log('  FAIL: ' + name + (detail ? ' -- ' + detail : ''));
  }
}

function writeTempBaseline(commands) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-341-registry-drift-'));
  const file = path.join(dir, 'baseline.json');
  fs.writeFileSync(file, JSON.stringify({ commands: commands }, null, 2));
  return file;
}

function main() {
  console.log('test-341-registry-drift.cjs');

  // Arm 1: diffRegistries is pure and correct.
  const baseline1 = { commands: [{ command: '/mos:a' }, { command: '/mos:b' }, { command: '/mos:c' }] };
  const current1 = { commands: [{ command: '/mos:a' }, { command: '/mos:c' }] };
  const diff1 = runner.diffRegistries(baseline1, current1);
  check(
    'arm 1: diffRegistries reports the one missing command',
    JSON.stringify(diff1.removed) === JSON.stringify(['/mos:b']) && diff1.added.length === 0,
    JSON.stringify(diff1)
  );

  // Arm 2: visibility change is separate from removal.
  const baseline2 = { commands: [{ command: '/mos:v', visibility: 'public' }] };
  const current2 = { commands: [{ command: '/mos:v', visibility: 'hidden' }] };
  const diff2 = runner.diffRegistries(baseline2, current2);
  check(
    'arm 2: visibility change appears in visibilityChanged, not removed',
    diff2.removed.length === 0 &&
      diff2.visibilityChanged.length === 1 &&
      diff2.visibilityChanged[0].command === '/mos:v',
    JSON.stringify(diff2)
  );

  // Arm 3: check() against the real repo, baseline forced to the committed
  // fixture via the env seam, exits ok today.
  const realResult = withEnv({ CHECK_REGISTRY_DRIFT_BASELINE: FIXTURE_PATH }, function () {
    return runner.check();
  });
  check(
    'arm 3: check() against the real repo (fixture baseline) is ok today',
    realResult.ok === true && realResult.baselineSource === 'env',
    JSON.stringify(realResult.findings)
  );

  // Arm 4: an invented command in the baseline is reported as removed.
  const invented = writeTempBaseline([{ command: '/mos:invented-341-test-command' }, { command: '/mos:act' }]);
  const inventedResult = withEnv({ CHECK_REGISTRY_DRIFT_BASELINE: invented }, function () {
    return runner.check();
  });
  check(
    'arm 4: an invented baseline command is reported as removed',
    inventedResult.ok === false &&
      inventedResult.findings.some(function (f) { return f.indexOf('/mos:invented-341-test-command') !== -1; }),
    JSON.stringify(inventedResult.findings)
  );

  // Arm 5: the policy validates via run-harness --check.
  const harnessCheck = spawnSync('node', [RUN_HARNESS_PATH, '--check'], {
    encoding: 'utf8',
    cwd: REPO_ROOT,
    timeout: 120000,
  });
  check(
    'arm 5: run-harness.cjs --check exits 0 and names registry-drift',
    harnessCheck.status === 0 && (harnessCheck.stdout || '').includes('registry-drift'),
    'exit=' + harnessCheck.status
  );

  // Arm 6: a logged policy does not fail the tier, even pointed at a
  // violating baseline.
  const tierResult = spawnSync('node', [RUN_HARNESS_PATH, '--tier', 'pre-tag'], {
    encoding: 'utf8',
    cwd: REPO_ROOT,
    timeout: 120000,
    env: Object.assign({}, process.env, { CHECK_REGISTRY_DRIFT_BASELINE: invented }),
  });
  check(
    'arm 6: run-harness.cjs --tier pre-tag still exits 0 with a logged policy pointed at a violating baseline',
    tierResult.status === 0 && (tierResult.stdout || '').includes('registry-drift'),
    'exit=' + tierResult.status + ' stdout=' + (tierResult.stdout || '').slice(0, 500)
  );

  // Arm 7: promotion_rule authored before evidence -- report the starting
  // state honestly, never fail on it.
  const policy = JSON.parse(fs.readFileSync(POLICY_PATH, 'utf8'));
  const evidenceLogPath = String(policy.evidence_log || '').replace(
    '$MINDRIAN_HOME',
    process.env.MINDRIAN_HOME || path.join(os.homedir(), '.mindrian')
  );
  const exists = fs.existsSync(evidenceLogPath);
  const isEmpty = exists ? fs.statSync(evidenceLogPath).size === 0 : true;
  console.log('  INFO: evidence_log ' + evidenceLogPath + ' exists=' + exists + ' empty=' + isEmpty);
  check(
    'arm 7: evidence_log does not exist yet, or is empty (starting state honestly recorded)',
    !exists || isEmpty,
    'evidence_log already has content; not a failure, just recorded for the record'
  );

  console.log('RESULT: PASS=' + PASS + ' FAIL=' + FAIL);
  process.exit(FAIL === 0 ? 0 : 1);
}

function withEnv(vars, fn) {
  const prior = {};
  for (const k of Object.keys(vars)) {
    prior[k] = process.env[k];
    process.env[k] = vars[k];
  }
  try {
    return fn();
  } finally {
    for (const k of Object.keys(vars)) {
      if (prior[k] === undefined) delete process.env[k];
      else process.env[k] = prior[k];
    }
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
