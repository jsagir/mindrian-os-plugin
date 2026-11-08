#!/usr/bin/env node
'use strict';
/*
 * tests/test-391-doctor-ledger-gap.cjs -- Phase 391 plan 06 Task 1 (CC391-H).
 *
 * The capability-ledger doctor organ must name a gap and warn on an incomplete
 * recorded fetch. Fixture ledgers are built in a temp folder and passed through
 * the ctx.ledger_path seam. The arms set MINDRIAN_LEDGER_MAX_VERSION_LAG
 * themselves, so they pass before and after owner card C6 changes the default.
 * This test does NOT pin the default value (arm D10 of plan 391-08 does that).
 *
 * Plain Node script, plain counters, no network. ASCII only.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

const ROOT = path.join(__dirname, '..');
const mod = require(path.join(ROOT, 'lib', 'core', 'doctor', 'capability-ledger-module.cjs'));

const ENV = 'MINDRIAN_LEDGER_MAX_VERSION_LAG';
const savedEnv = process.env[ENV];

let failures = 0;
let checks = 0;

function check(name, ok, detail) {
  checks += 1;
  if (ok) {
    console.log('ok - ' + name);
  } else {
    failures += 1;
    console.log('FAIL - ' + name + (detail ? ': ' + detail : ''));
  }
}

function setEnv(v) {
  if (v === undefined) delete process.env[ENV];
  else process.env[ENV] = String(v);
}

function restoreEnv() {
  setEnv(savedEnv);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-391-gap-'));
let n = 0;
function fixture(to, fetchCoverage) {
  n += 1;
  const lc = { from: '2.1.128', to: to };
  if (fetchCoverage) lc.fetch_coverage = fetchCoverage;
  const p = path.join(tmp, 'ledger-' + n + '.json');
  fs.writeFileSync(p, JSON.stringify({ ledger_covers: lc, entries: [] }));
  return p;
}

function run(to, installed, fetchCoverage) {
  return mod.check({ ledger_path: fixture(to, fetchCoverage), installed_version: installed });
}

try {
  // D1 gap of 32 is named (threshold set by the arm)
  {
    setEnv(10);
    const r = run('2.1.287', '2.1.319');
    restoreEnv();
    const d = r.detail || '';
    check(
      'D1 gap of 32 warns and names the range',
      r.status === 'warn' && d.includes('32') && d.includes('2.1.288') && d.includes('2.1.319') && d.includes('/mos:radar --fetch'),
      r.status + ' ' + d
    );
  }

  // D2 gap of 1 is ok
  {
    setEnv(undefined);
    const r = run('2.1.318', '2.1.319');
    restoreEnv();
    check('D2 gap of 1 is ok', r.status === 'ok', r.status + ' ' + r.detail);
  }

  // D3 threshold by environment variable
  {
    setEnv(10);
    const ok10 = run('2.1.300', '2.1.310');
    const warn11 = run('2.1.300', '2.1.311');
    setEnv(40);
    const ok32 = run('2.1.287', '2.1.319');
    restoreEnv();
    check(
      'D3 threshold follows MINDRIAN_LEDGER_MAX_VERSION_LAG',
      ok10.status === 'ok' && warn11.status === 'warn' && ok32.status === 'ok',
      'lag10=' + ok10.status + ' lag11=' + warn11.status + ' lag32@40=' + ok32.status
    );
  }

  // D4 incomplete fetch warns even at zero lag
  {
    setEnv(undefined);
    const r = run('2.1.319', '2.1.319', {
      method: 'webfetch-paged',
      complete: false,
      newest_read: '2.1.319',
      oldest_read: '2.1.309',
      chars_read: 100000,
      chars_total: 1175667,
      checked_at: '2026-11-08',
    });
    restoreEnv();
    const d = r.detail || '';
    check(
      'D4 incomplete fetch warns at zero lag',
      r.status === 'warn' && /incomplete/.test(d) && d.includes('2.1.309') && d.includes('2.1.319'),
      r.status + ' ' + d
    );
  }

  // D5 compatibility with older ledgers and with a complete fetch
  {
    setEnv(undefined);
    const a = run('2.1.319', '2.1.319');
    const b = run('2.1.319', '2.1.319', {
      method: 'script',
      complete: true,
      newest_read: '2.1.319',
      oldest_read: '2.1.287',
      chars_read: 1,
      chars_total: 1,
      checked_at: '2026-11-08',
    });
    restoreEnv();
    check('D5 no fetch_coverage and complete true are ok at lag 0', a.status === 'ok' && b.status === 'ok', a.status + ' / ' + b.status);
  }

  // D6 regressions
  {
    setEnv(undefined);
    const mismatch = run('2.0.318', '2.1.319');
    const unreadable = mod.check({ ledger_path: fixture('2.1.318'), installed_version: null });
    const missing = mod.check({ ledger_path: path.join(tmp, 'no-such-ledger.json'), installed_version: '2.1.319' });
    restoreEnv();
    check(
      'D6 mismatch warns, unreadable version is not ok, missing ledger errors',
      mismatch.status === 'warn' && unreadable.status !== 'ok' && missing.status === 'error',
      mismatch.status + ' / ' + unreadable.status + ' / ' + missing.status
    );
  }

  // D7 the existing freshness test
  {
    const r = cp.spawnSync(process.execPath, [path.join(ROOT, 'tests', 'test-265-ledger-freshness.cjs')], { encoding: 'utf8' });
    check('D7 test-265-ledger-freshness.cjs passes', r.status === 0, 'exit ' + r.status + ' ' + (r.stderr || '').trim());
  }

  // D8 the real ledger is ok when installed equals the mark
  {
    const ledger = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'capability-ledger.json'), 'utf8'));
    const to = ledger.ledger_covers.to;
    setEnv(undefined);
    const r = mod.check({ installed_version: to });
    restoreEnv();
    check('D8 real ledger is ok at lag 0', r.status === 'ok', to + ' -> ' + r.status + ' ' + r.detail);
  }

  // D9 the helper can fail
  {
    const before = failures;
    const beforeChecks = checks;
    const realLog = console.log;
  console.log = function () {};
  check('D9-inner (expected to fail)', false, 'deliberate');
  console.log = realLog;
    const failedAsExpected = failures === before + 1;
    failures = before;
    checks = beforeChecks;
    check('D9 the check helper reports a wrong expectation', failedAsExpected);
  }
} finally {
  restoreEnv();
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log('');
console.log(checks + ' check(s), ' + failures + ' failure(s)');
process.exit(failures === 0 ? 0 : 1);
