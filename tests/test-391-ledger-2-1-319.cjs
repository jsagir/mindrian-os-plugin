#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick 261108-ea4: the capability ledger records the screen of Claude Code
 * 2.1.319 from the first live run of the ask-first radar fetch.
 *
 * Arms:
 *   N1 four rows exist once each with exact version, domain, destination, status
 *   N2 text hygiene of leverage and evidence (240 characters, no markup)
 *   N3 each new row has exactly the eight schema keys, date null
 *   N4 each destination path exists in the repo
 *   N5 ledger_covers: to, installed_claude_version, from, fetched_at
 *   N6 fetch_coverage matches the script coverage object, complete true
 *   N7 the highest row version equals ledger_covers.to
 *   N8 coverage_gap names 2.1.319 as screened and keeps the earlier notes
 *   N9 schema and freshness tests pass
 *   N10 the check helper can fail
 *
 * Plain counters. No network. No em dash or en dash (code points are escapes).
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const LEDGER_PATH = path.join(ROOT, 'data', 'capability-ledger.json');

let pass = 0;
let fail = 0;

function check(name, ok, detail) {
  if (ok) {
    pass += 1;
    console.log('  ok   ' + name);
  } else {
    fail += 1;
    console.log('  FAIL ' + name + (detail ? ' :: ' + detail : ''));
  }
  return ok;
}

const ledger = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
const entries = ledger.entries;
const lc = ledger.ledger_covers || {};

const TABLE = [
  ['mcp-legacy-handshake-extension-fix', '2.1.319', 'plugins_mcp', '.mcp.json', 'no-op'],
  ['mcp-tasks-terminal-background', '2.1.319', 'plugins_mcp', 'lib/mcp/capability-registry.cjs', 'dormant'],
  ['posttooluse-runs-after-interrupt', '2.1.319', 'code', 'hooks/hooks.json', 'dormant'],
  ['slash-command-after-leading-whitespace', '2.1.319', 'code', 'scripts/admin-command-gate.cjs', 'dormant'],
];
const KEYS = ['capability', 'version', 'date', 'domain', 'leverage', 'destination', 'status', 'evidence'];

function cmp(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}

console.log('N1 rows');
for (const [cap, ver, dom, dest, st] of TABLE) {
  const hits = entries.filter((e) => e.capability === cap);
  check('N1 ' + cap + ' appears once', hits.length === 1, 'found ' + hits.length);
  const r = hits[0] || {};
  check(
    'N1 ' + cap + ' fields',
    r.version === ver && r.domain === dom && r.destination === dest && r.status === st,
    JSON.stringify([r.version, r.domain, r.destination, r.status])
  );
}

console.log('N2 text hygiene');
const BAD = [
  /`/,
  /\]\(/,
  /[<>]/,
  /https?:/i,
  /[\u0000-\u001f\u007f-\u009f]/,
  new RegExp('[\\u200b-\\u200f\\u2028-\\u202f\\u2060-\\u206f\\ufeff]'),
  new RegExp('[\\u2013\\u2014]'),
];
for (const [cap] of TABLE) {
  const r = entries.find((e) => e.capability === cap);
  for (const f of ['leverage', 'evidence']) {
    const v = r ? r[f] : undefined;
    check('N2 ' + cap + ' ' + f + ' length', typeof v === 'string' && v.length > 0 && v.length <= 240, typeof v === 'string' ? String(v.length) : 'missing');
    check('N2 ' + cap + ' ' + f + ' clean', typeof v === 'string' && !BAD.some((re) => re.test(v)));
  }
}

console.log('N3 keys');
for (const [cap] of TABLE) {
  const r = entries.find((e) => e.capability === cap);
  const ks = r ? Object.keys(r).sort() : [];
  check('N3 ' + cap + ' key set', JSON.stringify(ks) === JSON.stringify(KEYS.slice().sort()), ks.join(','));
  check('N3 ' + cap + ' date null', r && r.date === null);
}

console.log('N4 destination paths exist');
for (const [cap, , , dest] of TABLE) {
  check('N4 ' + cap + ' destination exists', fs.existsSync(path.join(ROOT, dest)), dest);
}

console.log('N5 ledger_covers');
check('N5 to is 2.1.319', lc.to === '2.1.319', String(lc.to));
check('N5 installed_claude_version is 2.1.319', lc.installed_claude_version === '2.1.319', String(lc.installed_claude_version));
check('N5 from is 2.1.128', lc.from === '2.1.128');
check('N5 fetched_at is the audit record time', lc.fetched_at === '2026-11-08T08:16:43Z', String(lc.fetched_at));

console.log('N6 fetch_coverage');
const fc = lc.fetch_coverage;
check('N6 is an object', !!fc && typeof fc === 'object' && !Array.isArray(fc));
if (fc && typeof fc === 'object') {
  check('N6 method is script', fc.method === 'script', String(fc.method));
  check('N6 complete is true', fc.complete === true);
  check('N6 newest_read 2.1.319', fc.newest_read === '2.1.319');
  check('N6 oldest_read 2.1.319', fc.oldest_read === '2.1.319', String(fc.oldest_read));
  check('N6 chars_read 1175667', fc.chars_read === 1175667);
  check('N6 chars_total 1175667', fc.chars_total === 1175667);
  check('N6 checked_at 2026-11-08', fc.checked_at === '2026-11-08');
}

console.log('N7 highest row');
let highest = null;
for (const e of entries) {
  if (typeof e.version === 'string' && /^\d+\.\d+\.\d+$/.test(e.version)) {
    if (highest === null || cmp(e.version, highest) > 0) highest = e.version;
  }
}
check('N7 highest row version equals ledger_covers.to', highest === lc.to, highest + ' vs ' + lc.to);
check('N7 every 2.1.319 row is a real row from the table', entries.filter((e) => e.version === '2.1.319').length === TABLE.length);
check('N7 no screened-through row', !entries.some((e) => String(e.capability).startsWith('screened-through')));

console.log('N8 coverage_gap');
const gap = typeof lc.coverage_gap === 'string' ? lc.coverage_gap : '';
for (const needle of ['2.1.319', 'first live', '2.1.297', '2.1.298', '2.1.313', '2.1.315', 'Closed 2026-10-02']) {
  check('N8 coverage_gap contains ' + needle, gap.includes(needle));
}
check('N8 coverage_gap no longer says 2.1.319 is not screened', !/2\.1\.319[^.]*not screened/.test(gap));

console.log('N9 schema and freshness regression');
for (const t of ['test-265-capability-ledger-schema.cjs', 'test-265-ledger-freshness.cjs']) {
  const sr = spawnSync(process.execPath, [path.join(ROOT, 'tests', t)], { encoding: 'utf8' });
  check('N9 ' + t + ' exits 0', sr.status === 0, 'exit ' + sr.status);
}

console.log('N10 the check helper can fail');
{
  const before = fail;
  const savedLog = console.log;
  console.log = () => {};
  check('N10 inner', false);
  console.log = savedLog;
  const reported = fail === before + 1;
  fail = before;
  check('N10 a wrong expectation is reported as a failure', reported);
}

console.log('\ntests/test-391-ledger-2-1-319.cjs: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail > 0 ? 1 : 0);
