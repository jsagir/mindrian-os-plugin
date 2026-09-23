#!/usr/bin/env node
'use strict';
/**
 * tests/test-356-ledger-build.cjs -- Phase 356 Plan 09.
 *
 * Proves scripts/build-command-irreversibility-ledger.cjs's threshold math
 * (D-15 zero-miss T, the degenerate-case refusals), the D-14 appeal gate
 * (a false alarm on a chain-run command fails the build unless accepted),
 * the chain-run set derivation plus its test-time drift guard against
 * CHAIN_SUITE_COMMANDS, every CLI build mode (default live, --jev-fixture,
 * --from-raw, --raw-out), and that every failure path writes nothing to
 * --out. Everything here is proven keyless, in fixture mode, against
 * SYNTHETIC answer keys and fixtures over the REAL registry command set
 * (R356-03, R356-04, D-14, D-15).
 *
 * The real answer key (data/jev-labels/command-irreversibility.json) does
 * not exist yet as of this plan (the navigator is still ruling); every leg
 * below builds its own SYNTHETIC temp answer key over the real registry's
 * command set rather than depending on it. The "shipped-ledger legs" at the
 * bottom activate automatically, without a test edit, once both the real
 * answer key and data/command-irreversibility-ledger.json land.
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
globalThis.fetch = function noNetwork356ledgerBuild() {
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
const SHIPPED_LEDGER_PATH = path.join(REPO, 'data', 'command-irreversibility-ledger.json');
const SHIPPED_LABELS_PATH = path.join(REPO, 'data', 'jev-labels', 'command-irreversibility.json');
const SHIPPED_POLICY_PATH = path.join(REPO, 'data', 'jev-policies', 'command-irreversibility.json');

const b = require(BUILDER_PATH);
const { readRegistryRows } = require(path.join(REPO, 'scripts', 'irreversibility-answer-key.cjs'));

let PASS = 0;
let FAIL = 0;
function check(label, cond) {
  if (cond) { PASS += 1; console.log('PASS: ' + label); }
  else { FAIL += 1; console.log('FAIL: ' + label); }
}

function checkThrows(label, fn, matcher) {
  try {
    fn();
    check(label, false);
  } catch (e) {
    check(label, typeof matcher === 'function' ? matcher(e) : true);
  }
}

function sha256Hex(bufOrString) {
  return crypto.createHash('sha256').update(bufOrString).digest('hex');
}

console.log('test-356-ledger-build');

// ---------------------------------------------------------------------------
// Fake HOME, shared by every CLI leg: an empty temp dir, guaranteed to have
// no ~/.secrets/typesafe.env (356-RESEARCH.md Pitfall 2).
// ---------------------------------------------------------------------------
const FAKE_HOME = fs.mkdtempSync(path.join(os.tmpdir(), '356-ledger-build-home-'));

// ---------------------------------------------------------------------------
// runCli(args, envOverrides) -> spawnSync result. Every spawned child: no
// TYPESAFE_API_KEY, HOME pointed at FAKE_HOME (or an override), and the
// no-network preload required before any other module loads.
// ---------------------------------------------------------------------------
function runCli(args, envOverrides) {
  const childEnv = Object.assign({}, process.env, { HOME: FAKE_HOME }, envOverrides || {});
  delete childEnv.TYPESAFE_API_KEY;
  const existingNodeOptions = childEnv.NODE_OPTIONS || '';
  childEnv.NODE_OPTIONS = (existingNodeOptions + ' --require ' + PRELOAD_PATH).trim();
  const result = spawnSync(process.execPath, [BUILDER_PATH].concat(args), {
    env: childEnv,
    encoding: 'utf8',
  });
  return result;
}

function assertNoNetworkAttempt(label, result) {
  const stderr = (result && result.stderr) || '';
  check(label + ': no NETWORK_ATTEMPT_356 in stderr', stderr.indexOf('NETWORK_ATTEMPT_356') === -1);
}

// ---------------------------------------------------------------------------
// makeWorld({ labelsTrue, fixtureP, appealRulings, registryPath }) -> a temp
// root holding a D-01-shaped SYNTHETIC policy, a SYNTHETIC answer key over
// the REAL registry command set (all false except labelsTrue), and a temp
// fixture file. Never touches the real (not-yet-existing) answer key.
// ---------------------------------------------------------------------------
const REAL_REGISTRY_HASH = sha256Hex(fs.readFileSync(REAL_REGISTRY_PATH));

function makeWorld(opts) {
  const o = opts || {};
  const labelsTrue = o.labelsTrue || [];
  const fixtureP = o.fixtureP || { default_p: 0.05 };
  const appealRulings = o.appealRulings || [];
  const registryPath = o.registryPath || REAL_REGISTRY_PATH;

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), '356-ledger-build-world-'));
  fs.mkdirSync(path.join(tmpRoot, 'data', 'jev-policies'), { recursive: true });
  fs.mkdirSync(path.join(tmpRoot, 'data', 'jev-labels'), { recursive: true });

  const policyObj = {
    policy_id: 'test-command-irreversibility',
    version: '1',
    instructions: 'SYNTHETIC test policy, describing a hypothetical local sandbox vs. an external '
      + 'service, never any real registry command. Irreversible is narrower than material: every '
      + 'irreversible step is material, but not every material step is irreversible.',
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

  const registryRows = readRegistryRows(registryPath);
  const labelRows = registryRows.map((r) => ({
    command: r.command,
    irreversible: labelsTrue.indexOf(r.command) !== -1,
    reason: 'synthetic test reason for ' + r.command,
    label_source: 'navigator-blind',
  }));

  const answerKey = {
    schema: 'jev-answer-key/v1',
    labels_for: 'data/command-registry.json',
    registry_hash: sha256Hex(fs.readFileSync(registryPath)),
    reviewed_by: 'navigator',
    reviewed_at: '2026-09-23',
    method: 'synthetic test fixture for tests/test-356-ledger-build.cjs',
    rows: labelRows,
    appeal_rulings: appealRulings,
  };
  const labelsPath = path.join(tmpRoot, 'data', 'jev-labels', 'command-irreversibility.json');
  fs.writeFileSync(labelsPath, JSON.stringify(answerKey, null, 2) + '\n');

  const fixtureObj = Object.assign({ model: 'jev-fixture-356-ledger-build-test' }, fixtureP);
  const fixturePath = path.join(tmpRoot, 'fixture.json');
  fs.writeFileSync(fixturePath, JSON.stringify(fixtureObj, null, 2) + '\n');

  return {
    tmpRoot: tmpRoot,
    policyPath: policyPath,
    labelsPath: labelsPath,
    fixturePath: fixturePath,
    answerKey: answerKey,
    registryPath: registryPath,
  };
}

function writeAnswerKey(labelsPath, answerKeyObj) {
  fs.writeFileSync(labelsPath, JSON.stringify(answerKeyObj, null, 2) + '\n');
}

// =============================================================================
// Leg 1: computeThreshold (D-15 zero-miss math).
// =============================================================================
console.log('--- leg 1: computeThreshold ---');

(function legComputeThreshold() {
  // Normal case: exact binary-representable p values (no float noise).
  const normalRows = [
    { command: 'a', p: 0.75, irreversible: true },
    { command: 'b', p: 0.5, irreversible: true }, // sets T
    { command: 'c', p: 0.5, irreversible: false }, // tie at T: flagged and counted
    { command: 'd', p: 0.25, irreversible: false }, // below T
    { command: 'e', p: 0.625, irreversible: false }, // above T: flagged
  ];
  const r = b.computeThreshold(normalRows);
  check('normal case: threshold === 0.5', r.threshold === 0.5);
  check('normal case: threshold_set_by === ["b"]', JSON.stringify(r.threshold_set_by) === JSON.stringify(['b']));
  check('normal case: false_alarms sorted === ["c","e"]', JSON.stringify(r.false_alarms) === JSON.stringify(['c', 'e']));
  check('normal case: false_alarm_count === 2', r.false_alarm_count === 2);
  check('normal case: margin === 0.25 (T - highest below-T false p)', r.margin === 0.25);
  check('normal case: labeled_irreversible === 2', r.labeled_irreversible === 2);

  // A labeled-false row with p exactly T is flagged and counted (repeat,
  // isolated): only one true row and one tie-at-T false row.
  const tieRows = [
    { command: 't1', p: 0.5, irreversible: true },
    { command: 't2', p: 0.5, irreversible: false },
    { command: 't3', p: 0.1, irreversible: false },
  ];
  const rt = b.computeThreshold(tieRows);
  check('tie leg: t2 (p === T) is in false_alarms', rt.false_alarms.indexOf('t2') !== -1);
  check('tie leg: false_alarm_count === 1', rt.false_alarm_count === 1);

  // All p equal -> degenerate (every row flags).
  checkThrows('degenerate: all p equal throws THRESHOLD_FAIL', () => {
    b.computeThreshold([
      { command: 'x', p: 0.5, irreversible: true },
      { command: 'y', p: 0.5, irreversible: false },
    ]);
  }, (e) => e.code === 'THRESHOLD_FAIL' && /degenerate/.test(e.message));

  // A labeled-true row with p 0 -> THRESHOLD_FAIL naming it.
  checkThrows('zero-score true row: throws THRESHOLD_FAIL naming the command', () => {
    b.computeThreshold([
      { command: 'zero-cmd', p: 0, irreversible: true },
      { command: 'other', p: 0.5, irreversible: false },
    ]);
  }, (e) => e.code === 'THRESHOLD_FAIL' && e.message.indexOf('zero-cmd') !== -1);

  // Zero labeled-true rows.
  checkThrows('zero labeled-true rows: throws THRESHOLD_FAIL', () => {
    b.computeThreshold([{ command: 'only-false', p: 0.5, irreversible: false }]);
  }, (e) => e.code === 'THRESHOLD_FAIL' && /labeled irreversible/.test(e.message));

  // Missing or NaN p.
  checkThrows('missing p: throws THRESHOLD_FAIL', () => {
    b.computeThreshold([{ command: 'missing-p', irreversible: true }]);
  }, (e) => e.code === 'THRESHOLD_FAIL');
  checkThrows('NaN p: throws THRESHOLD_FAIL', () => {
    b.computeThreshold([{ command: 'nan-p', p: NaN, irreversible: true }]);
  }, (e) => e.code === 'THRESHOLD_FAIL');

  // Non-boolean label.
  checkThrows('non-boolean label: throws THRESHOLD_FAIL', () => {
    b.computeThreshold([{ command: 'bad-label', p: 0.5, irreversible: 'yes' }]);
  }, (e) => e.code === 'THRESHOLD_FAIL');

  // Exact comparison, no rounding drift: 0.41 (a non-binary-exact decimal)
  // compared with === must still work because no re-rounding occurs.
  const exactRows = [
    { command: 'p1', p: 0.41, irreversible: true },
    { command: 'p2', p: 0.41, irreversible: false },
    { command: 'p3', p: 0.4, irreversible: false }, // a distinct double, strictly below 0.41
  ];
  const re = b.computeThreshold(exactRows);
  check('exact comparison: threshold === 0.41 exactly', re.threshold === 0.41);
  check('exact comparison: p2 (p === T) flagged as a false alarm', re.false_alarms.indexOf('p2') !== -1);
})();

// =============================================================================
// Leg 2: appealGate (D-14 final).
// =============================================================================
console.log('--- leg 2: appealGate ---');

(function legAppealGate() {
  const labelsByCommand = new Map([
    ['/mos:find-analogies', { label_source: 'navigator-blind', reason: 'synthetic false-alarm reason' }],
    ['/mos:outside-chain-run', { label_source: 'navigator-blind', reason: 'synthetic false-alarm reason' }],
  ]);
  const pByCommand = new Map([
    ['/mos:find-analogies', 0.9],
    ['/mos:outside-chain-run', 0.9],
  ]);
  const chainRun = new Set(['/mos:find-analogies']);

  const a1 = b.appealGate({
    falseAlarms: ['/mos:find-analogies'],
    chainRun: chainRun,
    appealRulings: [],
    pByCommand: pByCommand,
    threshold: 0.8,
    labelsByCommand: labelsByCommand,
  });
  check('appealGate: a chain-run false alarm with no ruling is returned', a1.length === 1 && a1[0].command === '/mos:find-analogies');

  const a2 = b.appealGate({
    falseAlarms: ['/mos:find-analogies'],
    chainRun: chainRun,
    appealRulings: [{ command: '/mos:find-analogies', ruling: 'accept', reason: 'ok' }],
    pByCommand: pByCommand,
    threshold: 0.8,
    labelsByCommand: labelsByCommand,
  });
  check('appealGate: an accept ruling exempts the same command', a2.length === 0);

  const a3 = b.appealGate({
    falseAlarms: ['/mos:outside-chain-run'],
    chainRun: chainRun,
    appealRulings: [],
    pByCommand: pByCommand,
    threshold: 0.8,
    labelsByCommand: labelsByCommand,
  });
  check('appealGate: a false alarm outside the chain-run set is not returned', a3.length === 0);
})();

// =============================================================================
// Leg 3: chainRunCommands on the real registry.
// =============================================================================
console.log('--- leg 3: chainRunCommands (real registry) ---');

const realRegistry = JSON.parse(fs.readFileSync(REAL_REGISTRY_PATH, 'utf8'));
const chainRunSetReal = b.chainRunCommands(realRegistry);
check('chainRunCommands contains /mos:find-bottlenecks', chainRunSetReal.indexOf('/mos:find-bottlenecks') !== -1);
let allSuiteCommandsPresent = true;
for (const cmd of b.CHAIN_SUITE_COMMANDS) {
  if (chainRunSetReal.indexOf(cmd) === -1) allSuiteCommandsPresent = false;
}
check('chainRunCommands contains every CHAIN_SUITE_COMMANDS entry', allSuiteCommandsPresent);
console.log('  chainRunCommands size on the real registry: ' + chainRunSetReal.length);

// =============================================================================
// Leg 4: drift guard (D-14) -- CHAIN_SUITE_FILES parsed at TEST time only.
// =============================================================================
console.log('--- leg 4: drift guard (CHAIN_SUITE_FILES vs CHAIN_SUITE_COMMANDS) ---');

(function legDriftGuard() {
  const registryByCommand = new Map(realRegistry.commands.map((c) => [c.command, c]));
  const chainSuiteCommandsSet = new Set(b.CHAIN_SUITE_COMMANDS);
  const failures = [];

  for (const relPath of b.CHAIN_SUITE_FILES) {
    const abs = path.join(REPO, relPath);
    if (!fs.existsSync(abs)) continue; // "that exists"
    const content = fs.readFileSync(abs, 'utf8');
    const slugs = new Set(content.match(/\/mos:[a-zA-Z0-9_-]+/g) || []);
    for (const slug of slugs) {
      const row = registryByCommand.get(slug);
      if (row && row.autonomous_safe === true && !chainSuiteCommandsSet.has(slug)) {
        failures.push({ file: relPath, slug: slug });
      }
    }
  }

  if (failures.length > 0) {
    for (const f of failures) {
      console.log('  DRIFT: ' + f.file + ' mentions autonomous_safe command ' + f.slug
        + ' -- fix: add it to CHAIN_SUITE_COMMANDS');
    }
  }
  check('drift guard: every autonomous_safe /mos: mention in CHAIN_SUITE_FILES is in CHAIN_SUITE_COMMANDS',
    failures.length === 0);
})();

// =============================================================================
// Leg 5: CLI fixture build, full flow.
// =============================================================================
console.log('--- leg 5: CLI fixture build ---');

(function legCliFixtureBuild() {
  const world = makeWorld({
    labelsTrue: ['/mos:publish'],
    fixtureP: { default_p: 0.05, p: { '/mos:publish': 0.97 } },
  });
  const outPath = path.join(world.tmpRoot, 'ledger.json');
  const rawPath = path.join(world.tmpRoot, 'raw.json');

  const result = runCli([
    '--root', world.tmpRoot,
    '--registry', REAL_REGISTRY_PATH,
    '--labels', world.labelsPath,
    '--jev-fixture', world.fixturePath,
    '--out', outPath,
    '--raw-out', rawPath,
  ]);

  check('CLI fixture build: exit 0', result.status === 0);
  assertNoNetworkAttempt('CLI fixture build', result);
  check('CLI fixture build: ledger file written', fs.existsSync(outPath));

  if (fs.existsSync(outPath)) {
    const ledger = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    const registryCount = readRegistryRows(REAL_REGISTRY_PATH).length;
    check('ledger: one entry per registry command (count from the registry)', ledger.entries.length === registryCount);

    let everyEntryHasFourFields = true;
    for (const e of ledger.entries) {
      const keys = Object.keys(e).sort();
      if (JSON.stringify(keys) !== JSON.stringify(['command', 'flag', 'p_irreversible', 'text_hash'])) {
        everyEntryHasFourFields = false;
      }
    }
    check('ledger: every entry has exactly the four fields', everyEntryHasFourFields);

    const topFields = [
      'schema', 'built_at', 'build_mode', 'built_from_raw', 'raw_scored_at', 'jev_model',
      'policy_hash', 'answer_key_hash', 'registry_hash', 'text_hash_basis', 'threshold',
      'threshold_set_by', 'margin', 'labeled_irreversible', 'false_alarm_count', 'false_alarms',
      'chain_run_false_alarms_accepted', 'jev_calls', 'input_tokens', 'output_tokens',
      'estimated_cost_usd', 'cost_basis', 'entries',
    ];
    let everyTopFieldPresent = true;
    for (const f of topFields) {
      if (!(f in ledger)) { everyTopFieldPresent = false; console.log('  MISSING top field: ' + f); }
    }
    check('ledger: every context top-level field is present', everyTopFieldPresent);

    check('ledger: build_mode === "jev-fixture"', ledger.build_mode === 'jev-fixture');
    check('ledger: threshold === 0.97', ledger.threshold === 0.97);

    const labelsByCommand = new Map(world.answerKey.rows.map((r) => [r.command, r]));
    const recount = ledger.entries.filter((e) => {
      const label = labelsByCommand.get(e.command);
      return label && label.irreversible === false && e.p_irreversible >= ledger.threshold;
    }).length;
    check('ledger: false_alarm_count equals a recount from entries and labels', ledger.false_alarm_count === recount);

    let everyFlagConsistent = true;
    for (const e of ledger.entries) {
      if (e.flag !== (e.p_irreversible >= ledger.threshold)) everyFlagConsistent = false;
    }
    check('ledger: every flag === (p_irreversible >= threshold)', everyFlagConsistent);

    check('ledger: policy_hash equals sha256 of the temp policy bytes',
      ledger.policy_hash === sha256Hex(fs.readFileSync(world.policyPath)));
    check('ledger: answer_key_hash equals sha256 of the temp label bytes',
      ledger.answer_key_hash === sha256Hex(fs.readFileSync(world.labelsPath)));
  }

  check('CLI fixture build: raw file exists', fs.existsSync(rawPath));
  if (fs.existsSync(rawPath)) {
    const rawText = fs.readFileSync(rawPath, 'utf8');
    check('CLI fixture build: raw file contains no key material', rawText.indexOf('sk-') === -1
      && rawText.indexOf('TYPESAFE_API_KEY') === -1);
  }
})();

// =============================================================================
// Leg 6: failures write nothing.
// =============================================================================
console.log('--- leg 6: failures write nothing ---');

(function legFailuresWriteNothing() {
  // (a) A fixture giving a labeled-true command p 0 -> exit 1, no ledger.
  const worldZero = makeWorld({
    labelsTrue: ['/mos:publish'],
    fixtureP: { default_p: 0.05, p: { '/mos:publish': 0 } },
  });
  const outZero = path.join(worldZero.tmpRoot, 'ledger.json');
  const resultZero = runCli([
    '--root', worldZero.tmpRoot,
    '--registry', REAL_REGISTRY_PATH,
    '--labels', worldZero.labelsPath,
    '--jev-fixture', worldZero.fixturePath,
    '--out', outZero,
  ]);
  check('zero-score failure: exit 1', resultZero.status === 1);
  check('zero-score failure: no ledger file written', !fs.existsSync(outZero));
  assertNoNetworkAttempt('zero-score failure', resultZero);

  // (b) An answer key missing one registry command -> exit 2 naming it, no ledger.
  const worldMissing = makeWorld({ labelsTrue: ['/mos:publish'] });
  const missingKey = JSON.parse(JSON.stringify(worldMissing.answerKey));
  const removedCommand = missingKey.rows[0].command;
  missingKey.rows = missingKey.rows.slice(1);
  writeAnswerKey(worldMissing.labelsPath, missingKey);
  const outMissing = path.join(worldMissing.tmpRoot, 'ledger.json');
  const resultMissing = runCli([
    '--root', worldMissing.tmpRoot,
    '--registry', REAL_REGISTRY_PATH,
    '--labels', worldMissing.labelsPath,
    '--jev-fixture', worldMissing.fixturePath,
    '--out', outMissing,
  ]);
  check('missing-command failure: exit 2', resultMissing.status === 2);
  check('missing-command failure: names the missing command', (resultMissing.stderr || '').indexOf(removedCommand) !== -1);
  check('missing-command failure: no ledger file written', !fs.existsSync(outMissing));
  assertNoNetworkAttempt('missing-command failure', resultMissing);

  // (c) A key without reviewed_at -> exit 2.
  const worldNoReviewedAt = makeWorld({ labelsTrue: ['/mos:publish'] });
  const noReviewedAtKey = JSON.parse(JSON.stringify(worldNoReviewedAt.answerKey));
  delete noReviewedAtKey.reviewed_at;
  writeAnswerKey(worldNoReviewedAt.labelsPath, noReviewedAtKey);
  const outNoReviewedAt = path.join(worldNoReviewedAt.tmpRoot, 'ledger.json');
  const resultNoReviewedAt = runCli([
    '--root', worldNoReviewedAt.tmpRoot,
    '--registry', REAL_REGISTRY_PATH,
    '--labels', worldNoReviewedAt.labelsPath,
    '--jev-fixture', worldNoReviewedAt.fixturePath,
    '--out', outNoReviewedAt,
  ]);
  check('missing reviewed_at: exit 2', resultNoReviewedAt.status === 2);
  check('missing reviewed_at: no ledger file written', !fs.existsSync(outNoReviewedAt));
  assertNoNetworkAttempt('missing reviewed_at', resultNoReviewedAt);
})();

// =============================================================================
// Leg 7: appeal gate end to end (CLI).
// =============================================================================
console.log('--- leg 7: appeal gate end to end ---');

(function legAppealGateEndToEnd() {
  const world = makeWorld({
    labelsTrue: ['/mos:publish'],
    fixtureP: { default_p: 0.05, p: { '/mos:publish': 0.97, '/mos:find-analogies': 0.99 } },
  });
  const outPath = path.join(world.tmpRoot, 'ledger.json');
  const rawPath = path.join(world.tmpRoot, 'raw.json');

  const result = runCli([
    '--root', world.tmpRoot,
    '--registry', REAL_REGISTRY_PATH,
    '--labels', world.labelsPath,
    '--jev-fixture', world.fixturePath,
    '--out', outPath,
    '--raw-out', rawPath,
  ]);

  check('appeal gate: exit 4', result.status === 4);
  const combinedOutput = (result.stdout || '') + (result.stderr || '');
  check('appeal gate: output names the chain-run false alarm', combinedOutput.indexOf('APPEAL: /mos:find-analogies') !== -1);
  check('appeal gate: no ledger file written', !fs.existsSync(outPath));
  check('appeal gate: raw file still written (scored before thresholding)', fs.existsSync(rawPath));
  assertNoNetworkAttempt('appeal gate', result);

  // Add an accept ruling for the same command -> exit 0, ship flagged.
  const acceptedKey = JSON.parse(JSON.stringify(world.answerKey));
  acceptedKey.appeal_rulings = [{ command: '/mos:find-analogies', ruling: 'accept', reason: 'navigator accepted, synthetic test' }];
  writeAnswerKey(world.labelsPath, acceptedKey);

  const result2 = runCli([
    '--root', world.tmpRoot,
    '--registry', REAL_REGISTRY_PATH,
    '--labels', world.labelsPath,
    '--jev-fixture', world.fixturePath,
    '--out', outPath,
  ]);
  check('appeal gate (accepted): exit 0', result2.status === 0);
  assertNoNetworkAttempt('appeal gate (accepted)', result2);

  if (fs.existsSync(outPath)) {
    const ledger = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    check('appeal gate (accepted): false_alarms lists /mos:find-analogies',
      ledger.false_alarms.indexOf('/mos:find-analogies') !== -1);
    check('appeal gate (accepted): chain_run_false_alarms_accepted lists /mos:find-analogies',
      ledger.chain_run_false_alarms_accepted.indexOf('/mos:find-analogies') !== -1);
    const entry = ledger.entries.find((e) => e.command === '/mos:find-analogies');
    check('appeal gate (accepted): the entry ships flagged', !!entry && entry.flag === true);
  } else {
    check('appeal gate (accepted): ledger file written', false);
  }
})();

// =============================================================================
// Leg 8: --from-raw.
// =============================================================================
console.log('--- leg 8: --from-raw ---');

(function legFromRaw() {
  const world = makeWorld({
    labelsTrue: ['/mos:publish'],
    fixtureP: { default_p: 0.05, p: { '/mos:publish': 0.97 } },
  });
  const outPath = path.join(world.tmpRoot, 'ledger.json');
  const rawPath = path.join(world.tmpRoot, 'raw.json');

  const buildResult = runCli([
    '--root', world.tmpRoot,
    '--registry', REAL_REGISTRY_PATH,
    '--labels', world.labelsPath,
    '--jev-fixture', world.fixturePath,
    '--out', outPath,
    '--raw-out', rawPath,
  ]);
  check('from-raw setup build: exit 0', buildResult.status === 0);
  const originalLedger = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  fs.unlinkSync(outPath);

  // Rebuild from the raw file -> identical entries, built_from_raw: true.
  const fromRawOut = path.join(world.tmpRoot, 'ledger-from-raw.json');
  const fromRawResult = runCli([
    '--root', world.tmpRoot,
    '--registry', REAL_REGISTRY_PATH,
    '--labels', world.labelsPath,
    '--from-raw', rawPath,
    '--out', fromRawOut,
  ]);
  check('from-raw rebuild: exit 0', fromRawResult.status === 0);
  assertNoNetworkAttempt('from-raw rebuild', fromRawResult);
  if (fs.existsSync(fromRawOut)) {
    const fromRawLedger = JSON.parse(fs.readFileSync(fromRawOut, 'utf8'));
    check('from-raw rebuild: entries identical to the original build',
      JSON.stringify(fromRawLedger.entries) === JSON.stringify(originalLedger.entries));
    check('from-raw rebuild: built_from_raw === true', fromRawLedger.built_from_raw === true);
  } else {
    check('from-raw rebuild: ledger file written', false);
  }

  // One byte of the policy changes -> exit 2.
  const policyText = fs.readFileSync(world.policyPath, 'utf8');
  fs.writeFileSync(world.policyPath, policyText + ' ');
  const afterPolicyChangeOut = path.join(world.tmpRoot, 'ledger-after-policy-change.json');
  const afterPolicyChangeResult = runCli([
    '--root', world.tmpRoot,
    '--registry', REAL_REGISTRY_PATH,
    '--labels', world.labelsPath,
    '--from-raw', rawPath,
    '--out', afterPolicyChangeOut,
  ]);
  check('from-raw after policy byte change: exit 2', afterPolicyChangeResult.status === 2);
  check('from-raw after policy byte change: no ledger file written', !fs.existsSync(afterPolicyChangeOut));
  assertNoNetworkAttempt('from-raw after policy byte change', afterPolicyChangeResult);
  fs.writeFileSync(world.policyPath, policyText); // restore for cleanliness

  // A registry teaching changes (temp registry via --registry) -> exit 2.
  const tempRegistry = JSON.parse(fs.readFileSync(REAL_REGISTRY_PATH, 'utf8'));
  const targetCommand = tempRegistry.commands.find((c) => c.command === '/mos:publish');
  targetCommand.teaching = (targetCommand.teaching || '') + ' (edited for the from-raw staleness leg)';
  const tempRegistryPath = path.join(world.tmpRoot, 'command-registry-edited.json');
  fs.writeFileSync(tempRegistryPath, JSON.stringify(tempRegistry, null, 2) + '\n');

  const afterTeachingChangeOut = path.join(world.tmpRoot, 'ledger-after-teaching-change.json');
  const afterTeachingChangeResult = runCli([
    '--root', world.tmpRoot,
    '--registry', tempRegistryPath,
    '--labels', world.labelsPath,
    '--from-raw', rawPath,
    '--out', afterTeachingChangeOut,
  ]);
  check('from-raw after a registry teaching change: exit 2', afterTeachingChangeResult.status === 2);
  check('from-raw after a registry teaching change: no ledger file written', !fs.existsSync(afterTeachingChangeOut));
  assertNoNetworkAttempt('from-raw after a registry teaching change', afterTeachingChangeResult);
})();

// =============================================================================
// Leg 9: live mode with no key.
// =============================================================================
console.log('--- leg 9: live mode with no key ---');

(function legLiveNoKey() {
  const world = makeWorld({ labelsTrue: ['/mos:publish'] });
  const outPath = path.join(world.tmpRoot, 'ledger.json');
  const liveHome = fs.mkdtempSync(path.join(os.tmpdir(), '356-ledger-build-livehome-'));

  const result = runCli([
    '--root', world.tmpRoot,
    '--registry', REAL_REGISTRY_PATH,
    '--labels', world.labelsPath,
    '--out', outPath,
  ], { HOME: liveHome });

  check('live no-key: exit 3', result.status === 3);
  check('live no-key: no ledger file written', !fs.existsSync(outPath));
  const combined = (result.stdout || '') + (result.stderr || '');
  check('live no-key: output contains no sk-', combined.indexOf('sk-') === -1);
  assertNoNetworkAttempt('live no-key', result);
})();

// =============================================================================
// Leg 10: shipped-ledger legs (PENDING until the real ledger lands).
// =============================================================================
console.log('--- leg 10: shipped-ledger legs ---');

if (!fs.existsSync(SHIPPED_LEDGER_PATH) || !fs.existsSync(SHIPPED_LABELS_PATH)) {
  console.log('PENDING: shipped ledger not built yet');
  check('shipped-ledger legs: PENDING (recorded, not a failure)', true);
} else {
  const shippedLedger = JSON.parse(fs.readFileSync(SHIPPED_LEDGER_PATH, 'utf8'));
  const shippedLabels = JSON.parse(fs.readFileSync(SHIPPED_LABELS_PATH, 'utf8'));

  check('shipped ledger: build_mode === "jev-live"', shippedLedger.build_mode === 'jev-live');

  const shippedRegistryRows = readRegistryRows(REAL_REGISTRY_PATH);
  const shippedRegistrySet = new Set(shippedRegistryRows.map((r) => r.command));
  const shippedEntrySet = new Set(shippedLedger.entries.map((e) => e.command));
  check('shipped ledger: entry set equals the answer key row set',
    shippedLedger.entries.length === shippedLabels.rows.length
    && shippedLabels.rows.every((r) => shippedEntrySet.has(r.command)));
  check('shipped ledger: entry set equals the current registry command set',
    shippedRegistryRows.every((r) => shippedEntrySet.has(r.command)) && shippedEntrySet.size === shippedRegistrySet.size);

  let shippedEveryEntryFourFields = true;
  for (const e of shippedLedger.entries) {
    const keys = Object.keys(e).sort();
    if (JSON.stringify(keys) !== JSON.stringify(['command', 'flag', 'p_irreversible', 'text_hash'])) {
      shippedEveryEntryFourFields = false;
    }
  }
  check('shipped ledger: every entry has the four fields', shippedEveryEntryFourFields);

  const shippedEntryByCommand = new Map(shippedLedger.entries.map((e) => [e.command, e]));
  let shippedRecallOne = true;
  for (const row of shippedLabels.rows) {
    if (row.irreversible === true) {
      const entry = shippedEntryByCommand.get(row.command);
      if (!entry || entry.p_irreversible < shippedLedger.threshold || entry.flag !== true) {
        shippedRecallOne = false;
      }
    }
  }
  check('shipped ledger: recall 1.0 (every labeled-true row has p >= threshold and flag: true)', shippedRecallOne);

  const shippedLabelByCommand = new Map(shippedLabels.rows.map((r) => [r.command, r]));
  const shippedRecount = shippedLedger.entries.filter((e) => {
    const label = shippedLabelByCommand.get(e.command);
    return label && label.irreversible === false && e.p_irreversible >= shippedLedger.threshold;
  }).length;
  check('shipped ledger: false_alarm_count recount matches', shippedLedger.false_alarm_count === shippedRecount);

  let shippedEveryFlagConsistent = true;
  for (const e of shippedLedger.entries) {
    if (e.flag !== (e.p_irreversible >= shippedLedger.threshold)) shippedEveryFlagConsistent = false;
  }
  check('shipped ledger: every flag consistent with the threshold', shippedEveryFlagConsistent);

  check('shipped ledger: policy_hash equals sha256 of the shipped policy bytes',
    fs.existsSync(SHIPPED_POLICY_PATH) && shippedLedger.policy_hash === sha256Hex(fs.readFileSync(SHIPPED_POLICY_PATH)));
  check('shipped ledger: answer_key_hash equals sha256 of the shipped answer key bytes',
    shippedLedger.answer_key_hash === sha256Hex(fs.readFileSync(SHIPPED_LABELS_PATH)));
}

// =============================================================================
// Final: zero network egress, in-process and across every spawned child.
// =============================================================================
console.log('--- final: NET_ATTEMPTS ---');
check('NET_ATTEMPTS === 0 (no in-process network egress attempted)', NET_ATTEMPTS === 0);

console.log('\ntest-356-ledger-build: ' + (FAIL === 0 ? 'PASS' : 'FAIL') + ' (' + PASS + ' passed, ' + FAIL + ' failed)');
process.exit(FAIL > 0 ? 1 : 0);
