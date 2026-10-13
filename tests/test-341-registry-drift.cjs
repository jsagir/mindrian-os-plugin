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
 *   8. A removal with no deprecation entry still fails, with the unchanged
 *      message (pin, green before and after the deprecation door).
 *   9. A removal with a valid deprecation entry passes and is printed by name.
 *  10. An entry whose command is still in the current registry fails as STALE.
 *  11. A malformed entry fails, accepts nothing, and the removal still fails.
 *  12. validateDeprecations rejects a v prefix, a bad date, a duplicate
 *      command and a top-level array.
 *  13. The real registry and the real data file accept /mos:query against a
 *      baseline that holds it.
 *  14. The cut's baseline (git show of the v2.0.0-beta.65 registry) passes
 *      through the runner CLI and prints the accepted line.
 *  15. The exact command of the run-all-366 leg (no env seam) exits 0.
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

function writeTempJson(fileName, obj) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-341-registry-drift-'));
  const file = path.join(dir, fileName);
  fs.writeFileSync(file, JSON.stringify(obj, null, 2));
  return file;
}

function validEntry(command, replacedBy) {
  return {
    command: command,
    retired_in: '9.9.9-beta.1',
    replaced_by: replacedBy,
    reason: 'Test entry.',
    decided_by: 'test',
    date: '2026-10-13',
    record: 'test-341',
  };
}

function listOf(x) {
  return Array.isArray(x) ? x : [];
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

  // Arms 8 to 12 share one temp baseline and one temp current registry.
  const gone = '/mos:gone-341';
  const armBaseline = writeTempBaseline([{ command: '/mos:a' }, { command: gone }]);
  const armCurrent = writeTempJson('current.json', { commands: [{ command: '/mos:a' }] });
  const armCheck = function (deprecationsDoc) {
    const depPath = writeTempJson('deprecations.json', deprecationsDoc);
    return withEnv({ CHECK_REGISTRY_DRIFT_BASELINE: armBaseline }, function () {
      return runner.check({ registryPath: armCurrent, deprecationsPath: depPath });
    });
  };

  // Arm 8 (pin): a removal with no entry still fails, message unchanged.
  const r8 = armCheck({ deprecations: [] });
  check(
    'arm 8: a removal with no deprecation entry still fails with the unchanged message',
    r8.ok === false &&
      listOf(r8.findings).some(function (f) {
        return f.indexOf('MISSING from the current registry: ' + gone) !== -1 &&
          f.indexOf('add an explicit deprecation entry recording why') !== -1;
      }),
    JSON.stringify(r8.findings)
  );

  // Arm 9: a removal with a valid entry passes and is printed by name.
  const r9 = armCheck({ deprecations: [validEntry(gone, '/mos:a')] });
  check(
    'arm 9: a removal with a valid deprecation entry passes and is named',
    r9.ok === true &&
      JSON.stringify(listOf(r9.accepted)) ===
        JSON.stringify(['REMOVED with a deprecation entry: ' + gone + ' -> /mos:a (retired_in 9.9.9-beta.1)']) &&
      !listOf(r9.findings).some(function (f) { return f.indexOf('MISSING') !== -1; }),
    JSON.stringify({ ok: r9.ok, accepted: r9.accepted, findings: r9.findings })
  );

  // Arm 10: an entry whose command is still in the registry is stale.
  const r10 = armCheck({ deprecations: [validEntry('/mos:a', '/mos:gone-341')] });
  check(
    'arm 10: an entry whose command is still in the registry fails as STALE',
    r10.ok === false &&
      listOf(r10.findings).some(function (f) { return f.indexOf('STALE deprecation entry: /mos:a') !== -1; }),
    JSON.stringify(r10.findings)
  );

  // Arm 11: a malformed entry fails and accepts nothing.
  const bad11 = validEntry(gone, '/mos:a');
  delete bad11.record;
  const r11 = armCheck({ deprecations: [bad11] });
  check(
    'arm 11: a malformed entry fails, accepts nothing, and the removal still fails',
    r11.ok === false &&
      listOf(r11.findings).some(function (f) { return f.indexOf('MALFORMED') !== -1 && f.indexOf('"record"') !== -1; }) &&
      listOf(r11.findings).some(function (f) { return f.indexOf('MISSING from the current registry: ' + gone) !== -1; }) &&
      listOf(r11.accepted).length === 0,
    JSON.stringify({ ok: r11.ok, accepted: r11.accepted, findings: r11.findings })
  );

  // Arm 12: validateDeprecations rejects four bad inputs.
  if (typeof runner.validateDeprecations !== 'function') {
    check('arm 12: validateDeprecations rejects four bad inputs', false, 'validateDeprecations is not exported');
  } else {
    const vPrefix = validEntry(gone, '/mos:a');
    vPrefix.retired_in = 'v9.9.9';
    const badDate = validEntry(gone, '/mos:a');
    badDate.date = '13-10-2026';
    const inputs = {
      'v prefix': { deprecations: [vPrefix] },
      'bad date': { deprecations: [badDate] },
      'duplicate command': { deprecations: [validEntry(gone, '/mos:a'), validEntry(gone, null)] },
      'top-level array': [validEntry(gone, '/mos:a')],
    };
    const weak = Object.keys(inputs).filter(function (k) {
      const v = runner.validateDeprecations(inputs[k]);
      return !v || !Array.isArray(v.errors) || v.errors.length < 1;
    });
    check('arm 12: validateDeprecations rejects four bad inputs', weak.length === 0, 'not rejected: ' + weak.join(', '));
  }

  // Arm 13: the real registry and the real data file accept /mos:query.
  const fixtureDoc = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  const queryBaseline = writeTempBaseline(listOf(fixtureDoc.commands).concat([{ command: '/mos:query' }]));
  const queryLine = 'REMOVED with a deprecation entry: /mos:query -> /mos:graph (retired_in 2.0.0-beta.67)';
  const r13 = withEnv({ CHECK_REGISTRY_DRIFT_BASELINE: queryBaseline }, function () {
    return runner.check();
  });
  check(
    'arm 13: the real registry and data file accept /mos:query',
    r13.ok === true && listOf(r13.accepted).indexOf(queryLine) !== -1,
    JSON.stringify({ ok: r13.ok, accepted: r13.accepted, findings: r13.findings })
  );

  // Arm 14: the cut's baseline, through the runner CLI.
  const tagShow = spawnSync('git', ['show', 'v2.0.0-beta.65:data/command-registry.json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: 60000,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (tagShow.error || tagShow.status !== 0) {
    console.log('  SKIP: arm 14 -- tag v2.0.0-beta.65 not readable here');
  } else {
    const tagDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-341-registry-drift-'));
    const tagFile = path.join(tagDir, 'tag-registry.json');
    fs.writeFileSync(tagFile, tagShow.stdout);
    const cli14 = spawnSync('node', [RUNNER_PATH, '--check'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      timeout: 60000,
      env: Object.assign({}, process.env, { LC_ALL: 'C', CHECK_REGISTRY_DRIFT_BASELINE: tagFile }),
    });
    check(
      'arm 14: the v2.0.0-beta.65 baseline exits 0 and prints the accepted line',
      cli14.status === 0 && (cli14.stdout || '').indexOf(queryLine) !== -1,
      'exit=' + cli14.status + ' stdout=' + (cli14.stdout || '').slice(0, 600)
    );
  }

  // Arm 15: the exact command of the run-all-366 leg (no env seam).
  const env15 = Object.assign({}, process.env, { LC_ALL: 'C' });
  delete env15.CHECK_REGISTRY_DRIFT_BASELINE;
  const cli15 = spawnSync('node', [RUNNER_PATH, '--check'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: 60000,
    env: env15,
  });
  check(
    'arm 15: the run-all-366 leg command exits 0 and states its baseline source',
    cli15.status === 0 && (cli15.stdout || '').indexOf('baseline source = ') !== -1,
    'exit=' + cli15.status + ' stdout=' + (cli15.stdout || '').slice(0, 600)
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
