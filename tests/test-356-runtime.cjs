#!/usr/bin/env node
/**
 * Phase 356 Plan 03 -- tests/test-356-runtime.cjs
 * =============================================================================
 * Task 1 (reader legs): proves lib/core/irreversibility-ledger.cjs is a pure,
 * network-free, once-per-process ledger reader against synthetic ledgers,
 * including stale and malformed ones (SPEC R5/R6).
 *
 * Task 2 (integration legs, appended below the reader legs): proves the
 * add-only seam in isIrreversibleStep and the runChain halt behavior it
 * drives (R5 a/b/c, add-only, export-surface-unchanged).
 *
 * Test hygiene contract (every 356 test file, per the plan context block):
 * scrub TYPESAFE_API_KEY and replace globalThis.fetch with a counting
 * thrower before any other require of repo code, assert NET_ATTEMPTS === 0
 * as the last check. This file spawns no children (all legs run in-process).
 *
 * House rule: hyphens only, no em-dashes.
 */

'use strict';

delete process.env.TYPESAFE_API_KEY;
let NET_ATTEMPTS = 0;
globalThis.fetch = function noNetwork356Runtime() {
  NET_ATTEMPTS += 1;
  throw new Error('no network in 356 tests');
};

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const LEDGER_PATH = path.join(REPO, 'lib', 'core', 'irreversibility-ledger.cjs');
const RESOLVER_PATH = path.join(REPO, 'lib', 'workflow', 'command-resolver.cjs');
const CHAIN_EXEC_PATH = path.join(REPO, 'lib', 'core', 'chain-executor.cjs');
const REGISTRY_PATH = path.join(REPO, 'data', 'command-registry.json');

let PASS = 0;
let FAIL = 0;
function check(label, cond) {
  if (cond) { PASS += 1; console.log('PASS: ' + label); }
  else { FAIL += 1; console.log('FAIL: ' + label); }
}

const ledger = require(LEDGER_PATH);
const resolver = require(RESOLVER_PATH);
const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
const REGISTRY_COMMANDS = registry.commands.map(function (c) { return c.command; });

function resetAll() {
  ledger.__reset();
  resolver.__reset();
}

const _tmpFiles = [];
function writeLedger(obj) {
  const p = path.join(
    os.tmpdir(),
    'mos-356-ledger-' + process.pid + '-' + Math.random().toString(36).slice(2) + '.json'
  );
  fs.writeFileSync(p, JSON.stringify(obj), 'utf8');
  _tmpFiles.push(p);
  process.env.MINDRIAN_IRREVERSIBILITY_LEDGER = p;
  return p;
}

function clearLedgerEnv() {
  delete process.env.MINDRIAN_IRREVERSIBILITY_LEDGER;
}

console.log('test-356-runtime');

// =============================================================================
// TASK 1 -- READER LEGS
// =============================================================================

// ---------------------------------------------------------------------------
// Leg: hash. 64-char lowercase hex, deterministic, null normalizes like '',
// every registry command hashes to a distinct value.
// ---------------------------------------------------------------------------
console.log('--- leg: hash ---');
{
  const h = ledger.commandTextHash('/mos:publish', 'teaching text', 'jtbd summary');
  check('commandTextHash returns a 64-char lowercase hex string', /^[0-9a-f]{64}$/.test(h));
  const h2 = ledger.commandTextHash('/mos:publish', 'teaching text', 'jtbd summary');
  check('commandTextHash is deterministic', h === h2);
  check(
    'null teaching normalizes the same as an empty string',
    ledger.commandTextHash('/mos:publish', null, 'x') === ledger.commandTextHash('/mos:publish', '', 'x')
  );

  const hashes = new Set();
  for (const c of registry.commands) {
    const row = resolver.commandRow(c.command);
    hashes.add(ledger.commandTextHash(row.command, row.teaching, row.jtbd_summary));
  }
  check(
    'all ' + registry.commands.length + ' registry commands hash to distinct values',
    hashes.size === registry.commands.length
  );
}

// ---------------------------------------------------------------------------
// Leg: fresh flag:true entry forces the flagged command only.
// ---------------------------------------------------------------------------
console.log('--- leg: fresh flag:true entry ---');
resetAll();
{
  const rowFA = resolver.commandRow('/mos:find-analogies');
  const th = ledger.commandTextHash('/mos:find-analogies', rowFA.teaching, rowFA.jtbd_summary);
  writeLedger({ entries: [{ command: '/mos:find-analogies', flag: true, text_hash: th, p_irreversible: 0.9 }] });
  resetAll();
  check('fresh flag:true entry forces /mos:find-analogies', ledger.forcesIrreversible('/mos:find-analogies') === true);
  check(
    '/mos:find-connections (no entry) stays false',
    ledger.forcesIrreversible('/mos:find-connections') === false
  );
  clearLedgerEnv();
}

// ---------------------------------------------------------------------------
// Leg: stale entry (text_hash computed over an edited teaching) -> false.
// ---------------------------------------------------------------------------
console.log('--- leg: stale entry ---');
resetAll();
{
  const rowFA = resolver.commandRow('/mos:find-analogies');
  const staleHash = ledger.commandTextHash('/mos:find-analogies', 'an edited teaching that no longer matches the registry', rowFA.jtbd_summary);
  writeLedger({ entries: [{ command: '/mos:find-analogies', flag: true, text_hash: staleHash }] });
  resetAll();
  check(
    'stale entry (hash computed over edited teaching) is ignored',
    ledger.forcesIrreversible('/mos:find-analogies') === false
  );
  clearLedgerEnv();
}

// ---------------------------------------------------------------------------
// Leg: flag:false, unknown command, non-64-hex text_hash -> all false.
// ---------------------------------------------------------------------------
console.log('--- leg: flag:false / unknown command / bad hash format ---');
resetAll();
{
  const rowPub = resolver.commandRow('/mos:publish');
  const th = ledger.commandTextHash('/mos:publish', rowPub.teaching, rowPub.jtbd_summary);
  writeLedger({
    entries: [
      { command: '/mos:publish', flag: false, text_hash: th },
      { command: '/mos:zz-356-unknown', flag: true, text_hash: th },
      { command: '/mos:find-analogies', flag: true, text_hash: 'not-64-hex' },
    ],
  });
  resetAll();
  check('flag:false entry never forces', ledger.forcesIrreversible('/mos:publish') === false);
  check('unknown-to-registry command entry never forces', ledger.forcesIrreversible('/mos:zz-356-unknown') === false);
  check('non-64-hex text_hash entry never forces', ledger.forcesIrreversible('/mos:find-analogies') === false);
  clearLedgerEnv();
}

// ---------------------------------------------------------------------------
// Leg: malformed JSON file, missing file, entries not an array, non-string
// argument -> false for every registry command / every call.
// ---------------------------------------------------------------------------
console.log('--- leg: malformed / missing / non-string ---');
resetAll();
{
  const p = path.join(os.tmpdir(), 'mos-356-malformed-' + process.pid + '.json');
  fs.writeFileSync(p, '{not valid json', 'utf8');
  _tmpFiles.push(p);
  process.env.MINDRIAN_IRREVERSIBILITY_LEDGER = p;
  resetAll();
  let allFalse = true;
  for (const c of REGISTRY_COMMANDS) { if (ledger.forcesIrreversible(c)) allFalse = false; }
  check('malformed JSON file: false for every registry command', allFalse);
  clearLedgerEnv();
}
resetAll();
{
  process.env.MINDRIAN_IRREVERSIBILITY_LEDGER = '/nonexistent/356-missing-ledger.json';
  resetAll();
  let allFalse = true;
  for (const c of REGISTRY_COMMANDS) { if (ledger.forcesIrreversible(c)) allFalse = false; }
  check('missing file: false for every registry command', allFalse);
  clearLedgerEnv();
}
resetAll();
{
  writeLedger({ entries: 'not-an-array' });
  resetAll();
  let allFalse = true;
  for (const c of REGISTRY_COMMANDS) { if (ledger.forcesIrreversible(c)) allFalse = false; }
  check('entries not an array: false for every registry command', allFalse);
  clearLedgerEnv();
}
resetAll();
{
  check(
    'non-string argument returns false (null / undefined / number)',
    ledger.forcesIrreversible(null) === false
    && ledger.forcesIrreversible(undefined) === false
    && ledger.forcesIrreversible(42) === false
  );
}

// ---------------------------------------------------------------------------
// Leg: registry override. A fresh entry scored against the REAL registry
// text is ignored once MINDRIAN_COMMAND_REGISTRY points at a copy whose
// teaching differs (staleness holds even when the ledger itself is fresh).
// ---------------------------------------------------------------------------
console.log('--- leg: registry override ---');
resetAll();
{
  const rowFA = resolver.commandRow('/mos:find-analogies');
  const th = ledger.commandTextHash('/mos:find-analogies', rowFA.teaching, rowFA.jtbd_summary);
  writeLedger({ entries: [{ command: '/mos:find-analogies', flag: true, text_hash: th }] });
  resetAll();
  check('sanity: fresh entry forces before the registry override', ledger.forcesIrreversible('/mos:find-analogies') === true);

  const registryCopy = JSON.parse(JSON.stringify(registry));
  const idx = registryCopy.commands.findIndex(function (c) { return c.command === '/mos:find-analogies'; });
  registryCopy.commands[idx].teaching = registryCopy.commands[idx].teaching + ' (edited for the registry-override test)';
  const regPath = path.join(os.tmpdir(), 'mos-356-registry-override-' + process.pid + '.json');
  fs.writeFileSync(regPath, JSON.stringify(registryCopy), 'utf8');
  _tmpFiles.push(regPath);
  process.env.MINDRIAN_COMMAND_REGISTRY = regPath;
  resetAll();
  check(
    'registry override makes the real-registry-scored fresh entry stale (ignored)',
    ledger.forcesIrreversible('/mos:find-analogies') === false
  );

  delete process.env.MINDRIAN_COMMAND_REGISTRY;
  clearLedgerEnv();
  resetAll();
}

// ---------------------------------------------------------------------------
// Leg: one read per process. 200 calls across registry commands cause
// exactly one fs.readFileSync(ledgerPath) call; __reset() forces a second.
// ---------------------------------------------------------------------------
console.log('--- leg: one read per process ---');
resetAll();
{
  const rowFA = resolver.commandRow('/mos:find-analogies');
  const th = ledger.commandTextHash('/mos:find-analogies', rowFA.teaching, rowFA.jtbd_summary);
  const ledgerPath = writeLedger({ entries: [{ command: '/mos:find-analogies', flag: true, text_hash: th }] });
  resetAll();

  const origReadFileSync = fs.readFileSync;
  let readCount = 0;
  fs.readFileSync = function (p, enc) {
    if (p === ledgerPath) readCount += 1;
    return origReadFileSync.call(fs, p, enc);
  };
  try {
    for (let i = 0; i < 200; i += 1) {
      ledger.forcesIrreversible(REGISTRY_COMMANDS[i % REGISTRY_COMMANDS.length]);
    }
    check('one read per process: exactly 1 ledger read across 200 calls', readCount === 1);
    ledger.__reset();
    ledger.forcesIrreversible('/mos:find-analogies');
    check('after __reset(), one more ledger read (count 2)', readCount === 2);
  } finally {
    fs.readFileSync = origReadFileSync;
  }
  clearLedgerEnv();
  resetAll();
}

// =============================================================================
// TASK 2 -- INTEGRATION LEGS (runChain / isIrreversibleStep)
// =============================================================================
// gsd:write-continue -- Task 2 appends its legs here, right before the final
// zero-network-egress leg below. CHAIN_EXEC_PATH is already declared above.

// ---------------------------------------------------------------------------
// Final leg: zero network egress across every leg above.
// ---------------------------------------------------------------------------
console.log('--- leg: zero network egress ---');
check('NET_ATTEMPTS === 0 across the whole file', NET_ATTEMPTS === 0);

for (const f of _tmpFiles) {
  try { fs.unlinkSync(f); } catch (_e) { /* best-effort cleanup */ }
}

console.log('');
console.log('test-356-runtime: ' + (FAIL > 0 ? 'FAIL' : 'PASS') + ' (' + PASS + '/' + (PASS + FAIL) + ' checks)');
process.exit(FAIL > 0 ? 1 : 0);
