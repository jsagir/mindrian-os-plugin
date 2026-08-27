#!/usr/bin/env node
'use strict';
/*
 * tests/test-265-ledger-freshness.cjs -- Phase 265 Plan 01 Task 3.
 *
 * Exercises lib/core/doctor/capability-ledger-module.cjs's version-lag
 * tripwire through the ctx.installed_version test seam. Plain Node script
 * (no node:test), matching the phase harness contract.
 *
 * Three seeded arms (must never skip):
 *   1. fresh ledger  -> status 'ok'
 *   2. stale ledger  -> status 'warn', detail names the /mos:radar --fetch remediation
 *   3. unreadable version -> status is NOT 'ok'
 *
 * Plus one best-effort real no-seam arm: if the claude binary is absent this
 * prints a single loud "SKIP" line for that arm ONLY and still exits 0. The
 * three seeded arms above must never be skipped.
 */

const path = require('path');

const modulePath = path.join(__dirname, '..', 'lib', 'core', 'doctor', 'capability-ledger-module.cjs');
const ledgerPath = path.join(__dirname, '..', 'data', 'capability-ledger.json');

const capabilityLedgerModule = require(modulePath);
const ledger = require(ledgerPath);

let failed = false;

function fail(msg) {
  console.error('FAIL: ' + msg);
  failed = true;
}

function pass(msg) {
  console.log('PASS: ' + msg);
}

// -----------------------------------------------------------------------
// Arm 1: fresh ledger (ctx.installed_version === ledger_covers.to) -> 'ok'
// -----------------------------------------------------------------------
{
  const freshVersion = ledger.ledger_covers.to;
  const result = capabilityLedgerModule.check({ installed_version: freshVersion });
  if (result.status === 'ok') {
    pass('fresh ledger arm: status ok (installed_version=' + freshVersion + ')');
  } else {
    fail('fresh ledger arm expected status ok, got: ' + JSON.stringify(result));
  }
}

// -----------------------------------------------------------------------
// Arm 2: stale ledger (patch = ledger_covers.to patch + 200) -> 'warn' with
// remediation string containing "/mos:radar --fetch"
// -----------------------------------------------------------------------
{
  const toParts = ledger.ledger_covers.to.split('.').map(Number);
  const staleVersion = toParts[0] + '.' + toParts[1] + '.' + (toParts[2] + 200);
  const result = capabilityLedgerModule.check({ installed_version: staleVersion });
  if (result.status === 'warn' && /\/mos:radar --fetch/.test(result.detail)) {
    pass('stale ledger arm: status warn with /mos:radar --fetch remediation (installed_version=' + staleVersion + ')');
  } else {
    fail('stale ledger arm expected status warn with /mos:radar --fetch detail, got: ' + JSON.stringify(result));
  }
}

// -----------------------------------------------------------------------
// Arm 3: unreadable version (installed_version explicitly null) -> status
// is NOT 'ok'
// -----------------------------------------------------------------------
{
  const result = capabilityLedgerModule.check({ installed_version: null });
  if (result.status !== 'ok') {
    pass('unreadable version arm: status is not ok (' + result.status + ')');
  } else {
    fail('unreadable version arm expected status !== ok, got: ' + JSON.stringify(result));
  }
}

// -----------------------------------------------------------------------
// Best-effort real no-seam path: exercises the production default (shells
// out to `claude --version`). If the binary is absent this arm alone
// prints a loud SKIP line and does not affect the exit code; it must never
// silently swallow a real failure in the three seeded arms above.
// -----------------------------------------------------------------------
{
  const result = capabilityLedgerModule.check({});
  if (result.status === 'warn' && /could not be read/.test(result.detail)) {
    console.log('SKIP: real no-seam arm (claude binary unavailable in this environment): ' + result.detail);
  } else {
    pass('real no-seam arm: status ' + result.status + ' (' + result.detail + ')');
  }
}

if (failed) {
  console.error('tests/test-265-ledger-freshness.cjs: FAILED');
  process.exit(1);
}

console.log('tests/test-265-ledger-freshness.cjs: PASSED');
process.exit(0);
