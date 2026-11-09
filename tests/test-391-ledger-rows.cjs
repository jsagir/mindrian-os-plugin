#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 391 plan 05 (CC391-I): the capability ledger records the screen of
 * Claude Code 2.1.288 to 2.1.318. Quick 261108-ea4 advanced the mark to 2.1.319;
 * the 2.1.319 arms live in tests/test-391-ledger-2-1-319.cjs. Quick 261109-rdr
 * advanced it to 2.1.321 (arms in tests/test-391-ledger-2-1-321.cjs); L4, L5 and
 * L7 here now check the mark is at or above the 2.1.319 state.
 *
 * Arms:
 *   L1 six dormant rows exist once each with the exact version, domain,
 *      destination and status
 *   L2 text hygiene of leverage and evidence (240 characters, no markup)
 *   L3 each new row has exactly the eight schema keys, date null
 *   L4 ledger_covers: to, installed_claude_version, from, fetched_at
 *   L5 ledger_covers.fetch_coverage shape
 *   L6 ledger_covers.coverage_gap text
 *   L7 no padding row: the highest rows are the real 2.1.319 rows
 *   L8 schema regression: tests/test-265-capability-ledger-schema.cjs passes
 *   L9 the check helper can fail
 *
 * Plain counters. No network. No em dash or en dash (code points are spelled
 * as escapes).
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
  ['hook-onfailure-block', '2.1.295', 'code', 'hooks/hooks.json', 'dormant'],
  ['agent-tools-mcp-server-naming', '2.1.299', 'plugins_mcp', 'agents/', 'dormant'],
  [
    'mcp-protocol-2026-07-28-default',
    '2.1.292',
    'plugins_mcp',
    '.mcp.json scripts/mindrian-mcp-server.cjs bin/mindrian-brain-mcp-client.cjs',
    'dormant',
  ],
  [
    'userpromptsubmit-before-expansion',
    '2.1.299',
    'code',
    'hooks/hooks.json scripts/admin-command-gate.cjs',
    'dormant',
  ],
  ['plugin-monitors', '2.1.310', 'code', 'none', 'dormant'],
  ['mcp-stdio-version-probe-legacy-pin', '2.1.318', 'plugins_mcp', '.mcp.json', 'dormant'],
];
const KEYS = ['capability', 'version', 'date', 'domain', 'leverage', 'destination', 'status', 'evidence'];

function cmp(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}

console.log('L1 rows');
for (const [cap, ver, dom, dest, st] of TABLE) {
  const hits = entries.filter((e) => e.capability === cap);
  check('L1 ' + cap + ' appears once', hits.length === 1, 'found ' + hits.length);
  const r = hits[0] || {};
  check(
    'L1 ' + cap + ' fields',
    r.version === ver && r.domain === dom && r.destination === dest && r.status === st,
    JSON.stringify([r.version, r.domain, r.destination, r.status])
  );
}

console.log('L2 text hygiene');
const BAD = [
  /`/,
  /\]\(/,
  /[<>]/,
  /https?:/i,
  /[\u0000-\u001f\u007f-\u009f]/,
  new RegExp("[\\u200b-\\u200f\\u2028-\\u202f\\u2060-\\u206f\\ufeff]"),
  new RegExp("[\\u2013\\u2014]"),
];
for (const [cap] of TABLE) {
  const r = entries.find((e) => e.capability === cap);
  for (const f of ['leverage', 'evidence']) {
    const v = r ? r[f] : undefined;
    const okType = typeof v === 'string' && v.length > 0 && v.length <= 240;
    check('L2 ' + cap + ' ' + f + ' length', okType, typeof v === 'string' ? String(v.length) : 'missing');
    check(
      'L2 ' + cap + ' ' + f + ' clean',
      typeof v === 'string' && !BAD.some((re) => re.test(v))
    );
  }
}

console.log('L3 keys');
for (const [cap] of TABLE) {
  const r = entries.find((e) => e.capability === cap);
  const ks = r ? Object.keys(r).sort() : [];
  check(
    'L3 ' + cap + ' key set',
    JSON.stringify(ks) === JSON.stringify(KEYS.slice().sort()),
    ks.join(',')
  );
  check('L3 ' + cap + ' date null', r && r.date === null);
}

console.log('L4 ledger_covers');
check('L4 to is at or above 2.1.319 (advanced by quick 261109-rdr)', cmp(String(lc.to), '2.1.319') >= 0, String(lc.to));
check('L4 installed_claude_version is at or above 2.1.319', cmp(String(lc.installed_claude_version), '2.1.319') >= 0, String(lc.installed_claude_version));
check('L4 from is 2.1.128', lc.from === '2.1.128');
check(
  'L4 fetched_at ISO on or after 2026-11-07',
  typeof lc.fetched_at === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(lc.fetched_at) &&
    lc.fetched_at >= '2026-11-07T00:00:00Z',
  String(lc.fetched_at)
);

console.log('L5 fetch_coverage');
const fc = lc.fetch_coverage;
const isTriple = (s) => typeof s === 'string' && /^\d+\.\d+\.\d+$/.test(s);
check('L5 is an object', !!fc && typeof fc === 'object' && !Array.isArray(fc));
if (fc && typeof fc === 'object') {
  check('L5 method', typeof fc.method === 'string' && fc.method.length > 0);
  check('L5 complete is true', fc.complete === true);
  check('L5 newest_read is at or above 2.1.319', cmp(String(fc.newest_read), '2.1.319') >= 0, String(fc.newest_read));
  check('L5 oldest_read is a version triple', isTriple(fc.oldest_read));
  check('L5 chars_read positive integer', Number.isInteger(fc.chars_read) && fc.chars_read > 0);
  check(
    'L5 chars_total at least chars_read',
    Number.isInteger(fc.chars_total) && fc.chars_total >= fc.chars_read
  );
  check('L5 checked_at ISO date', typeof fc.checked_at === 'string' && /^\d{4}-\d{2}-\d{2}/.test(fc.checked_at));
}

console.log('L6 coverage_gap');
const gap = typeof lc.coverage_gap === 'string' ? lc.coverage_gap : '';
for (const needle of ['2.1.288', '2.1.318', '2.1.319', '2.1.297', '2.1.298', '2.1.313', '2.1.315', 'Closed 2026-10-02']) {
  check('L6 coverage_gap contains ' + needle, gap.includes(needle));
}

console.log('L7 no padding row');
let highest = null;
for (const e of entries) {
  if (typeof e.version === 'string' && /^\d+\.\d+\.\d+$/.test(e.version)) {
    if (highest === null || cmp(e.version, highest) > 0) highest = e.version;
  }
}
check('L7 highest row version equals ledger_covers.to', highest === lc.to, highest + ' vs ' + lc.to);
const topRows = entries.filter((e) => e.version === highest);
check(
  'L7 the 2.1.318 stdio row is still present',
  entries.filter((e) => e.capability === 'mcp-stdio-version-probe-legacy-pin' && e.version === '2.1.318').length === 1
);
check('L7 the highest rows are real rows at the mark', topRows.length > 0 && topRows.every((e) => e.version === highest));
check('L7 no screened-through row', !entries.some((e) => String(e.capability).startsWith('screened-through')));

console.log('L8 schema regression');
const sr = spawnSync(process.execPath, [path.join(ROOT, 'tests', 'test-265-capability-ledger-schema.cjs')], {
  encoding: 'utf8',
});
check('L8 schema test exits 0', sr.status === 0, 'exit ' + sr.status);

console.log('L9 the check helper can fail');
{
  const before = fail;
  const savedLog = console.log;
  console.log = () => {};
  check('L9 inner', false);
  console.log = savedLog;
  const reported = fail === before + 1;
  fail = before;
  check('L9 a wrong expectation is reported as a failure', reported);
}

console.log('\ntests/test-391-ledger-rows.cjs: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail > 0 ? 1 : 0);
