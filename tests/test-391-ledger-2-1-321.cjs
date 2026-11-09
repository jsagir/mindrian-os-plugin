#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick 261109-rdr: the capability ledger records the screen of Claude Code
 * 2.1.321 from the second live run of the ask-first radar fetch (2026-11-09).
 * The CHANGELOG has no 2.1.320 entry, so 2.1.321 is the only version newer than
 * 2.1.319.
 *
 * Arms:
 *   P1 four rows exist once each with exact version, domain, destination, status
 *   P2 text hygiene of leverage and evidence (240 characters, no markup)
 *   P3 each new row has exactly the eight schema keys, date null
 *   P4 each destination path exists in the repo
 *   P5 ledger_covers: to, installed_claude_version, from, fetched_at
 *   P6 fetch_coverage matches the script coverage object, complete true
 *   P7 the highest row version equals ledger_covers.to
 *   P8 coverage_gap names 2.1.321 first and keeps the earlier notes and the no-action items
 *   P9 doctor ledger lag against the installed version stays at or under the limit of 20
 *   P10 schema and freshness tests pass
 *   P11 the check helper can fail
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
  ['mods-tool-calls-no-prompt-and-auto-enable', '2.1.321', 'code', 'hooks/mos-face.json', 'dormant'],
  ['mcp-connected-no-tools-reconnect-fix', '2.1.321', 'plugins_mcp', '.mcp.json', 'dormant'],
  ['desktop-same-name-mcp-disconnect-fix', '2.1.321', 'desktop_cowork', '.mcp.json', 'dormant'],
  ['plugins-update-redownload-and-name-guards', '2.1.321', 'plugins_mcp', '.claude-plugin/plugin.json', 'no-op'],
];
const KEYS = ['capability', 'version', 'date', 'domain', 'leverage', 'destination', 'status', 'evidence'];

function cmp(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}

console.log('P1 rows');
for (const [cap, ver, dom, dest, st] of TABLE) {
  const hits = entries.filter((e) => e.capability === cap);
  check('P1 ' + cap + ' appears once', hits.length === 1, 'found ' + hits.length);
  const r = hits[0] || {};
  check(
    'P1 ' + cap + ' fields',
    r.version === ver && r.domain === dom && r.destination === dest && r.status === st,
    JSON.stringify([r.version, r.domain, r.destination, r.status])
  );
}

console.log('P2 text hygiene');
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
    check('P2 ' + cap + ' ' + f + ' length', typeof v === 'string' && v.length > 0 && v.length <= 240, typeof v === 'string' ? String(v.length) : 'missing');
    check('P2 ' + cap + ' ' + f + ' clean', typeof v === 'string' && !BAD.some((re) => re.test(v)));
  }
}

console.log('P3 keys');
for (const [cap] of TABLE) {
  const r = entries.find((e) => e.capability === cap);
  const ks = r ? Object.keys(r).sort() : [];
  check('P3 ' + cap + ' key set', JSON.stringify(ks) === JSON.stringify(KEYS.slice().sort()), ks.join(','));
  check('P3 ' + cap + ' date null', r && r.date === null);
}

console.log('P4 destination paths exist');
for (const [cap, , , dest] of TABLE) {
  check('P4 ' + cap + ' destination exists', fs.existsSync(path.join(ROOT, dest)), dest);
}

console.log('P5 ledger_covers');
check('P5 to is 2.1.321', lc.to === '2.1.321', String(lc.to));
check('P5 installed_claude_version is 2.1.321', lc.installed_claude_version === '2.1.321', String(lc.installed_claude_version));
check('P5 from is 2.1.128', lc.from === '2.1.128');
check('P5 fetched_at is the audit record time', lc.fetched_at === '2026-11-09T19:51:53Z', String(lc.fetched_at));

console.log('P6 fetch_coverage');
const fc = lc.fetch_coverage;
check('P6 is an object', !!fc && typeof fc === 'object' && !Array.isArray(fc));
if (fc && typeof fc === 'object') {
  check('P6 method is script', fc.method === 'script', String(fc.method));
  check('P6 complete is true', fc.complete === true);
  check('P6 newest_read 2.1.321', fc.newest_read === '2.1.321', String(fc.newest_read));
  check('P6 oldest_read 2.1.321', fc.oldest_read === '2.1.321', String(fc.oldest_read));
  check('P6 chars_read 1192343', fc.chars_read === 1192343, String(fc.chars_read));
  check('P6 chars_total 1192343', fc.chars_total === 1192343, String(fc.chars_total));
  check('P6 checked_at 2026-11-09', fc.checked_at === '2026-11-09', String(fc.checked_at));
}

console.log('P7 highest row');
let highest = null;
for (const e of entries) {
  if (typeof e.version === 'string' && /^\d+\.\d+\.\d+$/.test(e.version)) {
    if (highest === null || cmp(e.version, highest) > 0) highest = e.version;
  }
}
check('P7 highest row version equals ledger_covers.to', highest === lc.to, highest + ' vs ' + lc.to);
check('P7 every 2.1.321 row is a real row from the table', entries.filter((e) => e.version === '2.1.321').length === TABLE.length);
check('P7 no 2.1.320 row (the file has no such entry)', !entries.some((e) => e.version === '2.1.320'));
check('P7 no screened-through row', !entries.some((e) => String(e.capability).startsWith('screened-through')));
const ids = entries.map((e) => e.capability);
check('P7 no duplicate capability ids', new Set(ids).size === ids.length);

console.log('P8 coverage_gap');
const gap = typeof lc.coverage_gap === 'string' ? lc.coverage_gap : '';
check('P8 coverage_gap starts with the 2.1.321 sentence', /^2026-11-09: Claude Code 2\.1\.321 /.test(gap), gap.slice(0, 60));
for (const needle of [
  '2.1.320',
  '1192343',
  'Fable 5.2',
  'AskUserQuestion',
  'no-action',
  '2.1.319',
  'first live',
  '2.1.297',
  '2.1.298',
  '2.1.313',
  '2.1.315',
  'Closed 2026-10-02',
]) {
  check('P8 coverage_gap contains ' + needle, gap.includes(needle));
}

console.log('P9 doctor lag');
{
  const mod = require(path.join(ROOT, 'lib', 'core', 'doctor', 'capability-ledger-module.cjs'));
  const LIMIT = 20;
  const parts = (s) => String(s).split('.').map(Number);
  const lag = parts(lc.installed_claude_version)[2] - parts(lc.to)[2];
  console.log('  lag ' + lag + ' (limit ' + LIMIT + ')');
  check('P9 ledger lag against the installed version is within the limit of 20', lag >= 0 && lag <= LIMIT, 'lag ' + lag);
  const saved = process.env.MINDRIAN_LEDGER_MAX_VERSION_LAG;
  delete process.env.MINDRIAN_LEDGER_MAX_VERSION_LAG;
  const res = mod.check({ installed_version: '2.1.321' });
  if (saved !== undefined) process.env.MINDRIAN_LEDGER_MAX_VERSION_LAG = saved;
  check('P9 the doctor organ reads ok at installed 2.1.321', res && res.status === 'ok', JSON.stringify(res));
}

console.log('P10 schema and freshness regression');
for (const t of ['test-265-capability-ledger-schema.cjs', 'test-265-ledger-freshness.cjs']) {
  const sr = spawnSync(process.execPath, [path.join(ROOT, 'tests', t)], { encoding: 'utf8' });
  check('P10 ' + t + ' exits 0', sr.status === 0, 'exit ' + sr.status);
}

console.log('P11 the check helper can fail');
{
  const before = fail;
  const savedLog = console.log;
  console.log = () => {};
  check('P11 inner', false);
  console.log = savedLog;
  const reported = fail === before + 1;
  fail = before;
  check('P11 a wrong expectation is reported as a failure', reported);
}

console.log('\ntests/test-391-ledger-2-1-321.cjs: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail > 0 ? 1 : 0);
