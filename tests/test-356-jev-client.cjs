#!/usr/bin/env node
/**
 * Phase 356 Plan 02 Task 2: proves scripts/jev-devtime-client.cjs is
 * interface-complete, parity-equivalent to the pre-extraction 353 guard,
 * refuses-before-fetch, retries per the 353 contract, and that the two
 * optional profile fields (max_len_by_key, must_equal_file) refuse and
 * never strip, naming the offending key (D-07..D-09).
 *
 * Also proves the R8 "no local copies" property against
 * scripts/build-section-command-ledger.cjs: either it re-exports the
 * shared client (REFACTOR branch) or the deferral is written down
 * (DEFER branch), never a silent third state.
 *
 * Test hygiene contract (every 356 test file, per the plan context block):
 * scrub TYPESAFE_API_KEY and replace globalThis.fetch with a counting
 * thrower before any other require of repo code, assert NET_ATTEMPTS === 0
 * as the last check. This file spawns no children.
 *
 * House rule: hyphens only, no em-dashes.
 */

'use strict';

delete process.env.TYPESAFE_API_KEY;
let NET_ATTEMPTS = 0;
globalThis.fetch = function noNetwork356() {
  NET_ATTEMPTS += 1;
  throw new Error('no network in 356 tests');
};

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO = path.join(__dirname, '..');
const CLIENT_PATH = path.join(REPO, 'scripts', 'jev-devtime-client.cjs');
const BUILDER_PATH = path.join(REPO, 'scripts', 'build-section-command-ledger.cjs');
const PARITY_FIXTURE_PATH = path.join(REPO, 'tests', 'fixtures', '356-section-guard-parity.json');
const DEFERRED_ITEMS_PATH = path.join(
  REPO, '.planning', 'phases',
  '356-chain-executor-material-step-ledger-jev-noul-seat-scored-at-',
  'deferred-items.md'
);
const IRREVERSIBILITY_LEDGER_BUILDER_PATH = path.join(REPO, 'scripts', 'build-command-irreversibility-ledger.cjs');

let PASS = 0;
let FAIL = 0;
function check(label, cond) {
  if (cond) { PASS += 1; console.log('PASS: ' + label); }
  else { FAIL += 1; console.log('FAIL: ' + label); }
}

async function checkRejects(label, promise, matcher) {
  try {
    await promise;
    check(label, false);
  } catch (e) {
    check(label, matcher(e));
  }
}

const client = require(CLIENT_PATH);
const builder = require(BUILDER_PATH);
const parityFixture = JSON.parse(fs.readFileSync(PARITY_FIXTURE_PATH, 'utf8'));

// ---------------------------------------------------------------------------
// Leg (a): interface. Six exports exist; EGRESS_PROFILES and every profile
// object and its arrays are frozen.
// ---------------------------------------------------------------------------
function legA() {
  console.log('--- leg (a): interface ---');
  for (const k of ['DEFAULT_ENDPOINT', 'loadKey', 'makeEgressGuard', 'jev', 'pool', 'EGRESS_PROFILES']) {
    check('client exports ' + k, k in client);
  }
  check('EGRESS_PROFILES is frozen', Object.isFrozen(client.EGRESS_PROFILES));
  const profileNames = Object.keys(client.EGRESS_PROFILES);
  check('at least one profile exists', profileNames.length > 0);
  for (const name of profileNames) {
    const profile = client.EGRESS_PROFILES[name];
    check('profile ' + name + ' is frozen', Object.isFrozen(profile));
    for (const k of Object.keys(profile)) {
      if (Array.isArray(profile[k])) {
        check('profile ' + name + '.' + k + ' array is frozen', Object.isFrozen(profile[k]));
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Leg (b): parity. Every fixture case replayed against the extracted
// section_command_ledger guard AND the 353 builder's own assertEgressCeiling
// export must give the identical outcome (holds in both REFACTOR and DEFER
// branches, since DEFER leaves the builder's own implementation untouched).
// ---------------------------------------------------------------------------
function legB() {
  console.log('--- leg (b): parity against ' + parityFixture.cases.length + ' recorded cases ---');
  const guard = client.makeEgressGuard(client.EGRESS_PROFILES.section_command_ledger);
  for (const c of parityFixture.cases) {
    // extracted client guard
    let clientOutcome;
    try {
      const r = guard(c.payload);
      clientOutcome = r === true ? 'ok' : { unexpected_return: r };
    } catch (e) {
      clientOutcome = { throws: e.message };
    }
    if (c.expect === 'ok') {
      check('client: ' + c.name + ' returns true', clientOutcome === 'ok');
    } else {
      check('client: ' + c.name + ' throws "' + c.expect.throws + '"',
        typeof clientOutcome === 'object' && clientOutcome.throws === c.expect.throws);
    }

    // the 353 builder's own export (byte-identical outcome expected)
    let builderOutcome;
    try {
      const r = builder.assertEgressCeiling(c.payload);
      builderOutcome = r === true ? 'ok' : { unexpected_return: r };
    } catch (e) {
      builderOutcome = { throws: e.message };
    }
    if (c.expect === 'ok') {
      check('builder: ' + c.name + ' returns true', builderOutcome === 'ok');
    } else {
      check('builder: ' + c.name + ' throws "' + c.expect.throws + '"',
        typeof builderOutcome === 'object' && builderOutcome.throws === c.expect.throws);
    }
  }
}

// ---------------------------------------------------------------------------
// Leg (c): guard required. jev({}, {key, fetchImpl}) rejects, fake never
// called.
// ---------------------------------------------------------------------------
async function legC() {
  console.log('--- leg (c): guard required ---');
  let fakeCalls = 0;
  const fetchImpl = async () => { fakeCalls += 1; return { status: 200, text: async () => '{}' }; };
  await checkRejects(
    'jev without a guard function rejects with /guard is required/',
    client.jev({}, { key: 'k', fetchImpl }),
    (e) => /guard is required/.test(e.message)
  );
  check('the fake fetchImpl was never called', fakeCalls === 0);
}

// ---------------------------------------------------------------------------
// Leg (d): guard before fetch. A throwing guard means fetchImpl is never
// called, and the rejection is the guard's own error.
// ---------------------------------------------------------------------------
async function legD() {
  console.log('--- leg (d): guard runs before fetch ---');
  let fakeCalls = 0;
  const fetchImpl = async () => { fakeCalls += 1; return { status: 200, text: async () => '{}' }; };
  const guard = () => { throw new Error('leg-d-guard-refusal'); };
  await checkRejects(
    'a throwing guard rejects jev() with the guard error',
    client.jev({}, { key: 'k', guard, fetchImpl }),
    (e) => e.message === 'leg-d-guard-refusal'
  );
  check('fetchImpl was never called when the guard throws', fakeCalls === 0);
}

// ---------------------------------------------------------------------------
// Leg (e): retry semantics, with a counting fetchImpl and a recording
// sleepImpl (no real sleeps).
// ---------------------------------------------------------------------------
async function legE() {
  console.log('--- leg (e): retry semantics ---');
  const passGuard = () => true;

  // always-throwing fetch: 4 calls, sleeps [1000, 2000, 4000], status 0 / json null
  {
    let calls = 0;
    const sleeps = [];
    const fetchImpl = async () => { calls += 1; throw new Error('network down'); };
    const sleepImpl = async (ms) => { sleeps.push(ms); };
    const result = await client.jev({}, { key: 'k', guard: passGuard, fetchImpl, sleepImpl });
    check('always-throwing fetch: 4 calls', calls === 4);
    check('always-throwing fetch: sleeps [1000,2000,4000]', JSON.stringify(sleeps) === JSON.stringify([1000, 2000, 4000]));
    check('always-throwing fetch: status === 0', result.status === 0);
    check('always-throwing fetch: json === null', result.json === null);
  }

  // always-429: 5 calls, sleeps [800, 1600, 3200, 6400], status 429
  {
    let calls = 0;
    const sleeps = [];
    const fetchImpl = async () => { calls += 1; return { status: 429, text: async () => '{}' }; };
    const sleepImpl = async (ms) => { sleeps.push(ms); };
    const result = await client.jev({}, { key: 'k', guard: passGuard, fetchImpl, sleepImpl });
    check('always-429: 5 calls', calls === 5);
    check('always-429: sleeps [800,1600,3200,6400]', JSON.stringify(sleeps) === JSON.stringify([800, 1600, 3200, 6400]));
    check('always-429: status === 429', result.status === 429);
  }

  // 200 JSON body: 1 call, parsed json, text.length <= 200
  {
    let calls = 0;
    const fetchImpl = async () => { calls += 1; return { status: 200, text: async () => JSON.stringify({ noul: 0.42 }) }; };
    const result = await client.jev({}, { key: 'k', guard: passGuard, fetchImpl });
    check('200 JSON body: 1 call', calls === 1);
    check('200 JSON body: parsed json', result.json && result.json.noul === 0.42);
    check('200 JSON body: text.length <= 200', result.text.length <= 200);
  }
}

// ---------------------------------------------------------------------------
// Leg (f): call-time fetch. fetchImpl resolves at CALL time, not at module
// load: swap globalThis.fetch AFTER requiring the client, call jev() with no
// fetchImpl, assert the fake fired, then restore the top-level thrower.
// ---------------------------------------------------------------------------
async function legF() {
  console.log('--- leg (f): fetchImpl resolves at call time ---');
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return { status: 200, text: async () => '{}' }; };
  try {
    const passGuard = () => true;
    await client.jev({}, { key: 'k', guard: passGuard, sleepImpl: async () => {} });
    check('globalThis.fetch was used and called once', calls === 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// ---------------------------------------------------------------------------
// Leg (g): loadKey. env wins over file; quotes stripped; missing yields
// null; never writes to console or stdout.
// ---------------------------------------------------------------------------
function legG() {
  console.log('--- leg (g): loadKey ---');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-356-loadkey-'));
  const secretsPath = path.join(tmpDir, 'typesafe.env');
  fs.writeFileSync(secretsPath, 'TYPESAFE_API_KEY="sk-356-TEST"\n');

  const writes = [];
  const originalLog = console.log;
  const originalError = console.error;
  const originalWrite = process.stdout.write;
  console.log = (...a) => { writes.push(a); };
  console.error = (...a) => { writes.push(a); };
  process.stdout.write = (...a) => { writes.push(a); return true; };
  let envWins, fileValue, missingValue;
  try {
    envWins = client.loadKey({ env: { TYPESAFE_API_KEY: 'sk-env-wins' }, secretsPath });
    fileValue = client.loadKey({ env: {}, secretsPath });
    missingValue = client.loadKey({ env: {}, secretsPath: path.join(tmpDir, 'does-not-exist.env') });
  } finally {
    console.log = originalLog;
    console.error = originalError;
    process.stdout.write = originalWrite;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
  check('env value wins over the file', envWins === 'sk-env-wins');
  check('file value has quotes stripped', fileValue === 'sk-356-TEST');
  check('missing env and missing file yields null', missingValue === null);
  check('loadKey never writes to console.log/error or stdout', writes.length === 0);
}

// ---------------------------------------------------------------------------
// Leg (h): pool keeps input order and never runs more than n tasks at once.
// ---------------------------------------------------------------------------
async function legH() {
  console.log('--- leg (h): pool ---');
  const items = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  let inFlight = 0;
  let maxInFlight = 0;
  const results = await client.pool(items, 3, async (item) => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((r) => setTimeout(r, 1));
    inFlight -= 1;
    return item * 10;
  });
  check('pool preserves input order', JSON.stringify(results) === JSON.stringify(items.map((i) => i * 10)));
  check('pool never exceeds concurrency n=3', maxInFlight <= 3);
}

// ---------------------------------------------------------------------------
// Leg (i): max_len_by_key. Synthetic exact_state_v1 profile, not added to
// EGRESS_PROFILES.
// ---------------------------------------------------------------------------
function legI() {
  console.log('--- leg (i): max_len_by_key ---');
  const profile = Object.freeze({
    id: 'test_max_len_356',
    kind: 'exact_state_v1',
    top_keys: Object.freeze(['state']),
    state_keys: Object.freeze(['a', 'b']),
    max_len_by_key: Object.freeze({ a: 5 }),
  });
  const guard = client.makeEgressGuard(profile);
  check('5-char a passes', guard({ state: { a: 'aaaaa', b: 'anything long goes here fine' } }) === true);
  try {
    guard({ state: { a: 'aaaaaa', b: 'x' } });
    check('6-char a throws', false);
  } catch (e) {
    check('6-char a throws EGRESS_REFUSED naming key a', e.code === 'EGRESS_REFUSED' && e.key === 'a' && e.message.indexOf('state.a') !== -1);
  }
  check('b has no cap (very long value passes)', guard({ state: { a: 'a', b: 'x'.repeat(500) } }) === true);
}

// ---------------------------------------------------------------------------
// Leg (j): must_equal_file. Byte identity, opts.root required, path escape
// refused at construction, bytes read once (not re-read per call).
// ---------------------------------------------------------------------------
function legJ() {
  console.log('--- leg (j): must_equal_file ---');
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-356-mustequal-'));
  const policyDir = path.join(tmpRoot, 'data', 'jev-policies');
  fs.mkdirSync(policyDir, { recursive: true });
  const relPath = 'data/jev-policies/test-policy.json';
  const absPath = path.join(tmpRoot, relPath);
  const originalText = '{"policy_id":"test"}';
  fs.writeFileSync(absPath, originalText);

  const profile = Object.freeze({
    id: 'test_must_equal_356',
    kind: 'exact_state_v1',
    top_keys: Object.freeze(['state']),
    state_keys: Object.freeze(['p']),
    must_equal_file: Object.freeze({ p: relPath }),
  });

  try {
    const guard = client.makeEgressGuard(profile, { root: tmpRoot });
    check('exact file text passes', guard({ state: { p: originalText } }) === true);

    try {
      guard({ state: { p: originalText.slice(0, -1) + 'X' } });
      check('one changed byte throws', false);
    } catch (e) {
      check('one changed byte throws naming key p', e.code === 'EGRESS_REFUSED' && e.key === 'p' && e.message.indexOf(relPath) !== -1);
    }

    try {
      guard({ state: { p: originalText + '\n' } });
      check('trailing newline difference throws (byte identity, not trimmed)', false);
    } catch (e) {
      check('trailing newline difference throws (byte identity, not trimmed)', e.code === 'EGRESS_REFUSED' && e.key === 'p');
    }

    try {
      guard({ state: {} });
      check('missing p throws', false);
    } catch (e) {
      check('missing p throws', e.code === 'EGRESS_REFUSED' && e.key === 'p');
    }

    // Bytes are read ONCE at construction: editing the file after
    // construction must not change what this already-built guard compares.
    fs.writeFileSync(absPath, originalText + '\n');
    check('editing the file after construction does not change the guard result',
      guard({ state: { p: originalText } }) === true);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }

  try {
    client.makeEgressGuard(profile);
    check('makeEgressGuard without opts.root throws at construction', false);
  } catch (e) {
    check('makeEgressGuard without opts.root throws at construction', /opts\.root/.test(e.message));
  }

  const escapingProfile = Object.freeze({
    id: 'test_must_equal_escape_356',
    kind: 'exact_state_v1',
    top_keys: Object.freeze(['state']),
    state_keys: Object.freeze(['p']),
    must_equal_file: Object.freeze({ p: '../outside.json' }),
  });
  const escapeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-356-escape-'));
  try {
    client.makeEgressGuard(escapingProfile, { root: escapeRoot });
    check('a rel path escaping opts.root throws at construction', false);
  } catch (e) {
    check('a rel path escaping opts.root throws at construction', /escapes opts\.root/.test(e.message));
  } finally {
    fs.rmSync(escapeRoot, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Leg (k): additivity. Adding the two optional fields to a copy of the
// section profile with NEITHER field present changes no parity outcome.
// ---------------------------------------------------------------------------
function legK() {
  console.log('--- leg (k): additivity ---');
  const base = client.EGRESS_PROFILES.section_command_ledger;
  const copy = Object.assign({}, base); // neither optional field present
  const baseGuard = client.makeEgressGuard(base);
  const copyGuard = client.makeEgressGuard(copy);
  let allMatch = true;
  for (const c of parityFixture.cases) {
    let baseOutcome;
    try { baseOutcome = baseGuard(c.payload) === true ? 'ok' : 'unexpected'; } catch (e) { baseOutcome = { throws: e.message }; }
    let copyOutcome;
    try { copyOutcome = copyGuard(c.payload) === true ? 'ok' : 'unexpected'; } catch (e) { copyOutcome = { throws: e.message }; }
    if (JSON.stringify(baseOutcome) !== JSON.stringify(copyOutcome)) allMatch = false;
  }
  check('a profile copy with neither optional field present matches the base profile on every parity case', allMatch);
}

// ---------------------------------------------------------------------------
// Leg (l): refuse, never strip. After a refusal, the caller's payload is
// deep-equal to its pre-call snapshot.
// ---------------------------------------------------------------------------
function legL() {
  console.log('--- leg (l): refuse never strip ---');
  const guard = client.makeEgressGuard(client.EGRESS_PROFILES.section_command_ledger);
  const payload = { model: 'jev-latest', state: { room_path: '/tmp/x' }, questions: {} };
  const snapshot = JSON.parse(JSON.stringify(payload));
  try {
    guard(payload);
  } catch (_e) { /* expected */ }
  check('payload is unchanged after a refusal (deep-equal to its pre-call snapshot)',
    JSON.stringify(payload) === JSON.stringify(snapshot));
}

// ---------------------------------------------------------------------------
// Leg (m): no local copies (R8).
// ---------------------------------------------------------------------------
function isPureLineComment(line) {
  const t = line.trim();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
}
function nonCommentContains(fileAbs, literalOrTest) {
  let raw;
  try { raw = fs.readFileSync(fileAbs, 'utf8'); } catch (_e) { return false; }
  for (const line of raw.split(/\r?\n/)) {
    if (isPureLineComment(line)) continue;
    const code = line.replace(/(^|[^:])\/\/.*$/, '$1');
    if (typeof literalOrTest === 'string' ? code.indexOf(literalOrTest) !== -1 : literalOrTest.test(code)) return true;
  }
  return false;
}

function legM() {
  console.log('--- leg (m): no local copies (R8) ---');
  const builderRefactored = nonCommentContains(BUILDER_PATH, 'jev-devtime-client');
  if (builderRefactored) {
    check('build-section-command-ledger.cjs has no local fetch(', !nonCommentContains(BUILDER_PATH, /fetch\(/));
    check('build-section-command-ledger.cjs has no local function assertEgressCeiling', !nonCommentContains(BUILDER_PATH, 'function assertEgressCeiling'));
    check('build-section-command-ledger.cjs has no local EGRESS_ALLOWED_ set', !nonCommentContains(BUILDER_PATH, 'EGRESS_ALLOWED_'));
  } else {
    const deferredText = fs.existsSync(DEFERRED_ITEMS_PATH) ? fs.readFileSync(DEFERRED_ITEMS_PATH, 'utf8') : '';
    check('deferred-items.md documents the build-section-command-ledger.cjs refactor deferral',
      deferredText.indexOf('build-section-command-ledger.cjs refactor DEFERRED') !== -1);
    console.log('353 builder refactor: DEFERRED (see deferred-items.md)');
  }

  if (fs.existsSync(IRREVERSIBILITY_LEDGER_BUILDER_PATH)) {
    check('build-command-irreversibility-ledger.cjs has no local fetch(', !nonCommentContains(IRREVERSIBILITY_LEDGER_BUILDER_PATH, /fetch\(/));
    check('build-command-irreversibility-ledger.cjs has no local function assertEgressCeiling', !nonCommentContains(IRREVERSIBILITY_LEDGER_BUILDER_PATH, 'function assertEgressCeiling'));
    check('build-command-irreversibility-ledger.cjs has no local EGRESS_ALLOWED_ set', !nonCommentContains(IRREVERSIBILITY_LEDGER_BUILDER_PATH, 'EGRESS_ALLOWED_'));
    check('build-command-irreversibility-ledger.cjs imports the shared client', nonCommentContains(IRREVERSIBILITY_LEDGER_BUILDER_PATH, 'jev-devtime-client'));
  } else {
    console.log('PENDING: scripts/build-command-irreversibility-ledger.cjs not landed yet');
    check('leg (m) irreversibility-ledger builder: pending (file not landed), counted as passing', true);
  }
}

async function main() {
  legA();
  legB();
  await legC();
  await legD();
  await legE();
  await legF();
  legG();
  await legH();
  legI();
  legJ();
  legK();
  legL();
  legM();

  console.log('--- leg (n): zero network egress ---');
  check('NET_ATTEMPTS === 0 (no network egress attempted by this test)', NET_ATTEMPTS === 0);

  console.log('');
  if (FAIL === 0) {
    console.log('test-356-jev-client: PASS (' + PASS + ' checks)');
  } else {
    console.log('test-356-jev-client: FAIL (' + FAIL + ' of ' + (PASS + FAIL) + ' checks failed)');
  }
  process.exit(FAIL === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('test-356-jev-client: uncaught error: ' + (e && e.stack || e));
  process.exit(1);
});
