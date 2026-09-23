#!/usr/bin/env node
'use strict';
/**
 * tests/test-356-check.cjs -- Phase 356 Plan 10 (R356-06, SPEC R6).
 *
 * Proves scripts/build-command-irreversibility-ledger.cjs's --check mode
 * (and the underlying runCheck): key-free, zero-network, always exits 0,
 * and reports every staleness/drift signal as a WARN line -- stale
 * (text_hash mismatch), unscored (registry command with no ledger entry),
 * removed (ledger entry whose command left the registry), a missing
 * ledger, a flag/threshold inconsistency, a false-alarm recount mismatch,
 * and policy/answer-key drift.
 *
 * Test hygiene contract (every 356 test file): scrub TYPESAFE_API_KEY and
 * replace globalThis.fetch with a counting thrower before any other require
 * of repo code; every spawned child uses tests/fixtures/356-no-network-
 * preload.cjs via NODE_OPTIONS, an env without TYPESAFE_API_KEY, and a temp
 * HOME (so a real ~/.secrets/typesafe.env on the developer machine can
 * never leak a key into a child); assert NET_ATTEMPTS === 0 and that no
 * spawned child ever printed NETWORK_ATTEMPT_356 as the last checks.
 *
 * House rule: hyphens only, no em-dashes.
 */

delete process.env.TYPESAFE_API_KEY;
let NET_ATTEMPTS = 0;
globalThis.fetch = function noNetwork356check() {
  NET_ATTEMPTS += 1;
  throw new Error('no network in 356 tests');
};

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const REPO = path.join(__dirname, '..');
const BUILDER_PATH = path.join(REPO, 'scripts', 'build-command-irreversibility-ledger.cjs');
const REAL_REGISTRY_PATH = path.join(REPO, 'data', 'command-registry.json');
const PRELOAD_PATH = path.join(REPO, 'tests', 'fixtures', '356-no-network-preload.cjs');
const FIXTURE_RESPONSES_PATH = path.join(REPO, 'tests', 'fixtures', '356-jev-noul-responses.json');
const SHIPPED_LEDGER_PATH = path.join(REPO, 'data', 'command-irreversibility-ledger.json');

const b = require(BUILDER_PATH);
const { readRegistryRows } = require(path.join(REPO, 'scripts', 'irreversibility-answer-key.cjs'));
const ledgerLib = require(path.join(REPO, 'lib', 'core', 'irreversibility-ledger.cjs'));
const resolver = require(path.join(REPO, 'lib', 'workflow', 'command-resolver.cjs'));

let PASS = 0;
let FAIL = 0;
function check(label, cond) {
  if (cond) { PASS += 1; console.log('PASS: ' + label); }
  else { FAIL += 1; console.log('FAIL: ' + label); }
}

function sha256Hex(bufOrString) {
  return crypto.createHash('sha256').update(bufOrString).digest('hex');
}

console.log('test-356-check');

// ---------------------------------------------------------------------------
// Fake HOME, shared by every CLI leg: an empty temp dir, guaranteed to have
// no ~/.secrets/typesafe.env (356-RESEARCH.md Pitfall 2).
// ---------------------------------------------------------------------------
const FAKE_HOME = fs.mkdtempSync(path.join(os.tmpdir(), '356-check-home-'));

// ---------------------------------------------------------------------------
// runCheckCli(args, envOverrides) -> spawnSync result. Every spawned child:
// no TYPESAFE_API_KEY, HOME pointed at FAKE_HOME (or an override), and the
// no-network preload required before any other module loads.
// ---------------------------------------------------------------------------
function runCheckCli(args, envOverrides) {
  const childEnv = Object.assign({}, process.env, { HOME: FAKE_HOME }, envOverrides || {});
  delete childEnv.TYPESAFE_API_KEY;
  const existingNodeOptions = childEnv.NODE_OPTIONS || '';
  childEnv.NODE_OPTIONS = (existingNodeOptions + ' --require ' + PRELOAD_PATH).trim();
  return spawnSync(process.execPath, [BUILDER_PATH, '--check'].concat(args), {
    env: childEnv,
    encoding: 'utf8',
  });
}

function assertNoNetworkAttempt(label, result) {
  const stderr = (result && result.stderr) || '';
  check(label + ': no NETWORK_ATTEMPT_356 in stderr', stderr.indexOf('NETWORK_ATTEMPT_356') === -1);
}

function warnLines(result) {
  return ((result && result.stdout) || '').split(/\r?\n/).filter((l) => l.indexOf('WARN:') === 0);
}

// ---------------------------------------------------------------------------
// makeCheckWorld() -> a temp root with a D-01-shaped SYNTHETIC policy, a
// SYNTHETIC answer key over the REAL registry command set (only
// /mos:publish labeled irreversible: true, matching the shared 356 fixture
// responses' one high-p command), and a fixture-mode ledger built via the
// real 356-09 CLI over a private copy of the real registry. Never touches
// the real (possibly nonexistent) shipped answer key or ledger.
// ---------------------------------------------------------------------------
function makeCheckWorld() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), '356-check-world-'));
  fs.mkdirSync(path.join(tmpRoot, 'data', 'jev-policies'), { recursive: true });
  fs.mkdirSync(path.join(tmpRoot, 'data', 'jev-labels'), { recursive: true });

  const policyObj = {
    policy_id: 'test-command-irreversibility-check',
    version: '1',
    instructions: 'SYNTHETIC test policy for tests/test-356-check.cjs, describing a hypothetical local '
      + 'sandbox vs. an external service, never any real registry command.',
    criteria: {
      true: 'the hypothetical action writes to an external service outside the sandbox',
      false: 'the hypothetical action stays inside the local sandbox',
    },
    boundary_cases: [
      'a hypothetical local sandbox write is reversible',
      'a hypothetical write to an external service is irreversible',
    ],
  };
  const policyPath = path.join(tmpRoot, 'data', 'jev-policies', 'command-irreversibility.json');
  fs.writeFileSync(policyPath, JSON.stringify(policyObj, null, 2) + '\n');

  const registryRows = readRegistryRows(REAL_REGISTRY_PATH);
  const registryPath = path.join(tmpRoot, 'registry.json');
  fs.writeFileSync(registryPath, fs.readFileSync(REAL_REGISTRY_PATH));

  const labelRows = registryRows.map((r) => ({
    command: r.command,
    irreversible: r.command === '/mos:publish',
    reason: 'synthetic test reason for ' + r.command,
    label_source: 'navigator-blind',
  }));
  const answerKey = {
    schema: 'jev-answer-key/v1',
    labels_for: 'data/command-registry.json',
    registry_hash: sha256Hex(fs.readFileSync(REAL_REGISTRY_PATH)),
    reviewed_by: 'navigator',
    reviewed_at: '2026-09-23',
    method: 'synthetic test fixture for tests/test-356-check.cjs',
    rows: labelRows,
    appeal_rulings: [],
  };
  const labelsPath = path.join(tmpRoot, 'data', 'jev-labels', 'command-irreversibility.json');
  fs.writeFileSync(labelsPath, JSON.stringify(answerKey, null, 2) + '\n');

  const ledgerPath = path.join(tmpRoot, 'ledger.json');
  const buildResult = spawnSync(process.execPath, [
    BUILDER_PATH,
    '--jev-fixture', FIXTURE_RESPONSES_PATH,
    '--out', ledgerPath,
    '--root', tmpRoot,
    '--registry', registryPath,
    '--labels', labelsPath,
  ], {
    env: Object.assign({}, process.env, {
      HOME: FAKE_HOME,
      NODE_OPTIONS: ((process.env.NODE_OPTIONS || '') + ' --require ' + PRELOAD_PATH).trim(),
    }),
    encoding: 'utf8',
  });
  delete buildResult.env;

  return {
    tmpRoot: tmpRoot,
    policyPath: policyPath,
    registryPath: registryPath,
    labelsPath: labelsPath,
    ledgerPath: ledgerPath,
    buildResult: buildResult,
    registryRows: registryRows,
  };
}

const WORLD = makeCheckWorld();
check('world setup: fixture ledger build exited 0', WORLD.buildResult.status === 0);
check('world setup: ledger file was written', fs.existsSync(WORLD.ledgerPath));
assertNoNetworkAttempt('world setup', WORLD.buildResult);

function writeRegistryVariant(mutateFn) {
  const registry = JSON.parse(fs.readFileSync(REAL_REGISTRY_PATH, 'utf8'));
  mutateFn(registry);
  const out = path.join(WORLD.tmpRoot, 'registry-' + crypto.randomBytes(4).toString('hex') + '.json');
  fs.writeFileSync(out, JSON.stringify(registry, null, 2) + '\n');
  return out;
}

// =============================================================================
// Leg 1: clean -- the only warning is BUILD_MODE_FIXTURE.
// =============================================================================
console.log('--- leg 1: clean (only BUILD_MODE_FIXTURE) ---');
(function legClean() {
  const result = runCheckCli([
    '--ledger', WORLD.ledgerPath,
    '--registry', WORLD.registryPath,
    '--root', WORLD.tmpRoot,
    '--labels', WORLD.labelsPath,
  ]);
  check('clean: exits 0', result.status === 0);
  const warns = warnLines(result);
  check('clean: exactly one warning', warns.length === 1);
  check('clean: the one warning is BUILD_MODE_FIXTURE', warns[0] && warns[0].indexOf('WARN: BUILD_MODE_FIXTURE') === 0);
  check('clean: prints OK or WARN summary line', result.stdout.indexOf('command-irreversibility-ledger --check:') !== -1);
  assertNoNetworkAttempt('clean', result);
})();

// =============================================================================
// Leg 2: stale (R6 acceptance) -- edited teaching makes --check print STALE,
// and makes the runtime ignore a flag:true entry for the same command.
// =============================================================================
console.log('--- leg 2: stale ---');
(function legStale() {
  const staleRegistryPath = writeRegistryVariant((registry) => {
    const row = registry.commands.find((c) => c.command === '/mos:find-analogies');
    row.teaching = row.teaching + ' EDITED FOR THE 356-10 STALE LEG.';
  });

  const result = runCheckCli([
    '--ledger', WORLD.ledgerPath,
    '--registry', staleRegistryPath,
    '--root', WORLD.tmpRoot,
    '--labels', WORLD.labelsPath,
  ]);
  check('stale: exits 0', result.status === 0);
  const warns = warnLines(result);
  check('stale: WARN: STALE /mos:find-analogies', warns.indexOf('WARN: STALE /mos:find-analogies') !== -1);
  assertNoNetworkAttempt('stale', result);

  // Runtime behavior: a copy of the ledger whose /mos:find-analogies entry
  // is forced to flag:true (with its ORIGINAL text_hash, now stale against
  // the edited registry) must NOT force irreversibility at runtime -- the
  // runtime uses the same commandTextHash staleness rule as --check.
  const ledgerObj = JSON.parse(fs.readFileSync(WORLD.ledgerPath, 'utf8'));
  const entry = ledgerObj.entries.find((e) => e.command === '/mos:find-analogies');
  check('stale: fixture ledger has a /mos:find-analogies entry', !!entry);
  const runtimeLedgerObj = JSON.parse(JSON.stringify(ledgerObj));
  const runtimeEntry = runtimeLedgerObj.entries.find((e) => e.command === '/mos:find-analogies');
  runtimeEntry.flag = true;
  const runtimeLedgerPath = path.join(WORLD.tmpRoot, 'runtime-stale-ledger.json');
  fs.writeFileSync(runtimeLedgerPath, JSON.stringify(runtimeLedgerObj, null, 2) + '\n');

  const prevRegistryEnv = process.env.MINDRIAN_COMMAND_REGISTRY;
  const prevLedgerEnv = process.env.MINDRIAN_IRREVERSIBILITY_LEDGER;
  process.env.MINDRIAN_COMMAND_REGISTRY = staleRegistryPath;
  process.env.MINDRIAN_IRREVERSIBILITY_LEDGER = runtimeLedgerPath;
  resolver.__reset();
  ledgerLib.__reset();
  check('stale: forcesIrreversible ignores the stale flag:true entry',
    ledgerLib.forcesIrreversible('/mos:find-analogies') === false);

  if (prevRegistryEnv === undefined) delete process.env.MINDRIAN_COMMAND_REGISTRY;
  else process.env.MINDRIAN_COMMAND_REGISTRY = prevRegistryEnv;
  if (prevLedgerEnv === undefined) delete process.env.MINDRIAN_IRREVERSIBILITY_LEDGER;
  else process.env.MINDRIAN_IRREVERSIBILITY_LEDGER = prevLedgerEnv;
  resolver.__reset();
  ledgerLib.__reset();
})();

// =============================================================================
// Leg 3: unscored -- a new registry command with no ledger entry.
// =============================================================================
console.log('--- leg 3: unscored ---');
(function legUnscored() {
  const unscoredRegistryPath = writeRegistryVariant((registry) => {
    registry.commands.push({
      command: '/mos:zz-356-new',
      teaching: 'A brand-new test-only command with no ledger entry and no answer-key row.',
      jtbd_summary: 'Exercise the UNSCORED and LABEL_SET_MISMATCH --check legs.',
      autonomous_safe: true,
    });
  });

  const result = runCheckCli([
    '--ledger', WORLD.ledgerPath,
    '--registry', unscoredRegistryPath,
    '--root', WORLD.tmpRoot,
    '--labels', WORLD.labelsPath,
  ]);
  check('unscored: exits 0', result.status === 0);
  const warns = warnLines(result);
  check('unscored: WARN: UNSCORED /mos:zz-356-new', warns.indexOf('WARN: UNSCORED /mos:zz-356-new') !== -1);
  check('unscored: WARN: LABEL_SET_MISMATCH present',
    warns.some((w) => w.indexOf('WARN: LABEL_SET_MISMATCH') === 0 && w.indexOf('/mos:zz-356-new') !== -1));
  assertNoNetworkAttempt('unscored', result);
})();

// =============================================================================
// Leg 4: removed -- a command dropped from the registry but still scored.
// =============================================================================
console.log('--- leg 4: removed ---');
(function legRemoved() {
  const removedCommand = WORLD.registryRows[0].command;
  const removedRegistryPath = writeRegistryVariant((registry) => {
    registry.commands = registry.commands.filter((c) => c.command !== removedCommand);
  });

  const result = runCheckCli([
    '--ledger', WORLD.ledgerPath,
    '--registry', removedRegistryPath,
    '--root', WORLD.tmpRoot,
    '--labels', WORLD.labelsPath,
  ]);
  check('removed: exits 0', result.status === 0);
  const warns = warnLines(result);
  check('removed: WARN: REMOVED ' + removedCommand, warns.indexOf('WARN: REMOVED ' + removedCommand) !== -1);
  assertNoNetworkAttempt('removed', result);
})();

// =============================================================================
// Leg 5: flag inconsistency -- an entry's flag disagrees with p vs threshold.
// =============================================================================
console.log('--- leg 5: flag inconsistency ---');
(function legFlagInconsistent() {
  const ledgerObj = JSON.parse(fs.readFileSync(WORLD.ledgerPath, 'utf8'));
  const target = ledgerObj.entries.find((e) => e.flag === false);
  check('flag-inconsistent: found a currently-unflagged entry to flip', !!target);
  target.flag = true;
  const flippedPath = path.join(WORLD.tmpRoot, 'ledger-flag-flip.json');
  fs.writeFileSync(flippedPath, JSON.stringify(ledgerObj, null, 2) + '\n');

  const result = runCheckCli([
    '--ledger', flippedPath,
    '--registry', WORLD.registryPath,
    '--root', WORLD.tmpRoot,
    '--labels', WORLD.labelsPath,
  ]);
  check('flag-inconsistent: exits 0', result.status === 0);
  const warns = warnLines(result);
  check('flag-inconsistent: WARN: FLAG_INCONSISTENT ' + target.command,
    warns.indexOf('WARN: FLAG_INCONSISTENT ' + target.command) !== -1);
  assertNoNetworkAttempt('flag-inconsistent', result);
})();

// =============================================================================
// Leg 6: false-alarm recount mismatch -- false_alarm_count edited directly.
// =============================================================================
console.log('--- leg 6: false-alarm recount mismatch ---');
(function legFalseAlarmMismatch() {
  const ledgerObj = JSON.parse(fs.readFileSync(WORLD.ledgerPath, 'utf8'));
  ledgerObj.false_alarm_count = ledgerObj.false_alarm_count + 1;
  const mismatchPath = path.join(WORLD.tmpRoot, 'ledger-false-alarm-mismatch.json');
  fs.writeFileSync(mismatchPath, JSON.stringify(ledgerObj, null, 2) + '\n');

  const result = runCheckCli([
    '--ledger', mismatchPath,
    '--registry', WORLD.registryPath,
    '--root', WORLD.tmpRoot,
    '--labels', WORLD.labelsPath,
  ]);
  check('false-alarm mismatch: exits 0', result.status === 0);
  const warns = warnLines(result);
  check('false-alarm mismatch: WARN: FALSE_ALARM_COUNT_MISMATCH',
    warns.some((w) => w.indexOf('WARN: FALSE_ALARM_COUNT_MISMATCH') === 0));
  assertNoNetworkAttempt('false-alarm mismatch', result);
})();

// =============================================================================
// Leg 7: policy drift.
// =============================================================================
console.log('--- leg 7: policy drift ---');
(function legPolicyDrift() {
  const driftRoot = fs.mkdtempSync(path.join(os.tmpdir(), '356-check-policy-drift-'));
  fs.mkdirSync(path.join(driftRoot, 'data', 'jev-policies'), { recursive: true });
  const original = fs.readFileSync(WORLD.policyPath, 'utf8');
  fs.writeFileSync(path.join(driftRoot, 'data', 'jev-policies', 'command-irreversibility.json'), original + '\n');

  const result = runCheckCli([
    '--ledger', WORLD.ledgerPath,
    '--registry', WORLD.registryPath,
    '--root', driftRoot,
    '--labels', WORLD.labelsPath,
  ]);
  check('policy drift: exits 0', result.status === 0);
  const warns = warnLines(result);
  check('policy drift: WARN: POLICY_DRIFT', warns.some((w) => w.indexOf('WARN: POLICY_DRIFT') === 0));
  assertNoNetworkAttempt('policy drift', result);
})();

// =============================================================================
// Leg 8: answer-key drift.
// =============================================================================
console.log('--- leg 8: answer-key drift ---');
(function legAnswerKeyDrift() {
  const original = fs.readFileSync(WORLD.labelsPath, 'utf8');
  const driftedLabelsPath = path.join(WORLD.tmpRoot, 'labels-drifted.json');
  fs.writeFileSync(driftedLabelsPath, original + '\n');

  const result = runCheckCli([
    '--ledger', WORLD.ledgerPath,
    '--registry', WORLD.registryPath,
    '--root', WORLD.tmpRoot,
    '--labels', driftedLabelsPath,
  ]);
  check('answer-key drift: exits 0', result.status === 0);
  const warns = warnLines(result);
  check('answer-key drift: WARN: ANSWER_KEY_DRIFT', warns.some((w) => w.indexOf('WARN: ANSWER_KEY_DRIFT') === 0));
  assertNoNetworkAttempt('answer-key drift', result);
})();

// =============================================================================
// Leg 9: missing ledger.
// =============================================================================
console.log('--- leg 9: missing ledger ---');
(function legMissingLedger() {
  const result = runCheckCli(['--ledger', '/nonexistent/356.json']);
  check('missing ledger: exits 0', result.status === 0);
  const warns = warnLines(result);
  check('missing ledger: WARN: LEDGER_MISSING', warns.some((w) => w.indexOf('WARN: LEDGER_MISSING') === 0));
  assertNoNetworkAttempt('missing ledger', result);
})();

// =============================================================================
// Leg 10: zero network and key-free.
// =============================================================================
console.log('--- leg 10: zero network and key-free ---');
(function legZeroNetworkKeyFree() {
  const before = NET_ATTEMPTS;
  const inProcessResult = b.runCheck({
    ledgerPath: WORLD.ledgerPath,
    registryPath: WORLD.registryPath,
    root: WORLD.tmpRoot,
    labelsPath: WORLD.labelsPath,
  });
  check('in-process runCheck: returns a warnings array', Array.isArray(inProcessResult.warnings));
  check('in-process runCheck: leaves NET_ATTEMPTS unchanged', NET_ATTEMPTS === before);

  const freshHome = fs.mkdtempSync(path.join(os.tmpdir(), '356-check-fresh-home-'));
  const keyFreeResult = runCheckCli([
    '--ledger', WORLD.ledgerPath,
    '--registry', WORLD.registryPath,
    '--root', WORLD.tmpRoot,
    '--labels', WORLD.labelsPath,
  ], { HOME: freshHome });
  check('key-free: fresh HOME, no key in env, still exits 0', keyFreeResult.status === 0);
  assertNoNetworkAttempt('key-free', keyFreeResult);
})();

// =============================================================================
// Leg 11: the real shipped state, only when the shipped ledger exists.
// =============================================================================
console.log('--- leg 11: shipped state ---');
(function legShipped() {
  if (!fs.existsSync(SHIPPED_LEDGER_PATH)) {
    console.log('PENDING: shipped ledger not built yet (data/command-irreversibility-ledger.json absent)');
    return;
  }
  const result = runCheckCli([]);
  check('shipped: --check with default paths exits 0', result.status === 0);
  console.log('shipped --check output:\n' + result.stdout);
  assertNoNetworkAttempt('shipped', result);
})();

// =============================================================================
// Final: zero network egress, in-process and across every spawned child.
// =============================================================================
console.log('--- final: NET_ATTEMPTS ---');
check('NET_ATTEMPTS === 0 (no in-process network egress attempted)', NET_ATTEMPTS === 0);

console.log('\ntest-356-check: ' + (FAIL === 0 ? 'PASS' : 'FAIL') + ' (' + PASS + ' passed, ' + FAIL + ' failed)');
process.exit(FAIL > 0 ? 1 : 0);
