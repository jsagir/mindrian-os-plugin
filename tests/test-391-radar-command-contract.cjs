#!/usr/bin/env node
'use strict';
/*
 * tests/test-391-radar-command-contract.cjs -- Phase 391 plan 06 Task 1 (CC391-H).
 *
 * Prose tripwire for commands/radar.md. The fetch itself cannot run in a test
 * (it needs the network), so this test pins the procedure that the command
 * text gives to the model:
 *   - the ask-first script path is the preferred path (plugin root variable)
 *   - the WebFetch fallback pages with offsets until it reaches the mark
 *   - the mark never advances over unread versions (no-advance rule)
 *   - fetch_coverage is recorded
 *   - the allowed-tools set is exactly the 5 tools plus the one narrow Bash entry
 *     for the slicer script (owner card C3, answer APPLY-NARROW-BASH, plan 391-08)
 *
 * Plain Node script, plain counters, no network. ASCII only.
 */

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.join(__dirname, '..');
const RADAR = path.join(ROOT, 'commands', 'radar.md');

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

const raw = fs.readFileSync(RADAR, 'utf8');
const has = (s) => raw.includes(s);

// P1 script path with the plugin root variable, --list and --approve
{
  const scriptRe = /node\s+"\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/radar-changelog-slice\.cjs"/;
  check(
    'P1 script path, --list and --approve',
    scriptRe.test(raw) && has('--list') && has('--approve'),
    'script path with plugin root: ' + scriptRe.test(raw) + ', --list: ' + has('--list') + ', --approve: ' + has('--approve')
  );
}

// P2 no-advance rule
{
  const sentence = /Do not advance[^.\n]*ledger_covers\.to/.test(raw);
  check(
    'P2 no-advance rule',
    has('coverage.complete') && /incomplete/i.test(raw) && sentence,
    'coverage.complete: ' + has('coverage.complete') + ', incomplete: ' + /incomplete/i.test(raw) + ', Do not advance sentence: ' + sentence
  );
}

// P3 fallback paging
{
  const fallback = /fallback/i.test(raw) && has('WebFetch');
  const untilHeader = /until a header[^.\n]*(at or below|at or older than)[^.\n]*(mark|ledger_covers\.to)/i.test(raw);
  check(
    'P3 WebFetch fallback paging',
    fallback && has('offset') && has('100000') && untilHeader && /every/.test(raw) && /newer/.test(raw) && has('covered range'),
    'fallback: ' + fallback + ', offset: ' + has('offset') + ', 100000: ' + has('100000') + ', until-header: ' + untilHeader +
      ', every: ' + /every/.test(raw) + ', newer: ' + /newer/.test(raw) + ', covered range: ' + has('covered range')
  );
}

// P4 old cap gone
check('P4 old cap of 10 entries is gone', !has('10 most recent') && !has('Extract the 10'));

// P5 fetch_coverage keys and highest row version
{
  const keys = ['method', 'complete', 'newest_read', 'oldest_read', 'chars_read', 'chars_total', 'checked_at'];
  const missing = keys.filter((k) => !has(k));
  check(
    'P5 fetch_coverage keys and highest row version',
    has('fetch_coverage') && missing.length === 0 && /highest (row )?version/.test(raw),
    'missing keys: ' + JSON.stringify(missing) + ', highest version rule: ' + /highest (row )?version/.test(raw)
  );
}

// P6 ask first and Part 8 statement
{
  const part8 = /public GET of one fixed URL/.test(raw) && /no room data/.test(raw) && /no credential/.test(raw);
  check(
    'P6 ask first and Part 8 statement',
    /approval/.test(raw) && /token/.test(raw) && part8,
    'approval: ' + /approval/.test(raw) + ', token: ' + /token/.test(raw) + ', part 8 sentence: ' + part8
  );
}

// P7 the existing 265 tripwire still passes
{
  const r = cp.spawnSync(process.execPath, [path.join(ROOT, 'tests', 'test-265-radar-writes-ledger.cjs')], { encoding: 'utf8' });
  check('P7 test-265-radar-writes-ledger.cjs passes', r.status === 0, 'exit ' + r.status + ' ' + (r.stderr || '').trim());
}

// P8 allowed-tools: the five tools plus the one narrow Bash entry (owner card C3)
{
  const m = /allowed-tools:\s*\n((?:\s*-\s*.+\n?)+)/.exec(raw);
  const found = m
    ? m[1].split('\n').map((l) => l.trim()).filter((l) => l.startsWith('-')).map((l) => l.replace(/^-\s*/, '').trim())
    : [];
  const want = ['Read', 'Write', 'WebFetch', 'Glob', 'AskUserQuestion', 'Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/radar-changelog-slice.cjs" *)'];
  check(
    'P8 allowed-tools is the five tools plus the one narrow Bash entry',
    found.length === want.length && want.every((t, i) => found[i] === t),
    JSON.stringify(found)
  );
}

// P9 no em dash and no en dash
{
  const re = new RegExp('[' + String.fromCharCode(0x2013) + String.fromCharCode(0x2014) + ']');
  check('P9 no em dash or en dash in the command', !re.test(raw));
}

// P10 the generated mirror is current
{
  const r = cp.spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'build-skill-mirrors.cjs'), '--check'], { encoding: 'utf8', cwd: ROOT });
  check('P10 skill mirrors are current', r.status === 0, 'exit ' + r.status + ' ' + ((r.stdout || '') + (r.stderr || '')).trim().split('\n').slice(-3).join(' | '));
}

// P11 the helper can fail
{
  const before = failures;
  const beforeChecks = checks;
  const realLog = console.log;
  console.log = function () {};
  check('P11-inner (expected to fail)', false, 'deliberate');
  console.log = realLog;
  const failedAsExpected = failures === before + 1;
  // undo the deliberate failure so the run result stays honest
  failures = before;
  checks = beforeChecks;
  check('P11 the check helper reports a wrong expectation', failedAsExpected);
}

console.log('');
console.log(checks + ' check(s), ' + failures + ' failure(s)');
process.exit(failures === 0 ? 0 : 1);
