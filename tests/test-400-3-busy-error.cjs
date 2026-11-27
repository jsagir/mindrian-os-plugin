#!/usr/bin/env node
'use strict';
/*
 * Phase 400.3 wave 2 Goldfish W2-CD-03 (Canon Part 7, reuse): one SQLite busy test for the whole plugin.
 *
 * lib/core/hook-busy-cap.cjs exports isBusyError(err). It is true for a SQLite primary result code of 5 (SQLITE_BUSY)
 * or 6 (SQLITE_LOCKED), also inside an extended code (517 = SQLITE_BUSY_SNAPSHOT), and for the message forms
 * "database is locked", "database table is locked", "SQLITE_BUSY" and "SQLITE_LOCKED". hook-busy-cap.cjs keeps zero
 * requires. The 6 old copies (memory-events, spine-events, the memory hook, session-start-reconcile and the 2 refresh
 * commands) call it and keep no own busy test.
 *
 * Arms: B1 (codes), B2 (message forms), B3 (not busy), B4 (zero requires), B5 (the 6 sites use the one helper).
 * Usage: node tests/test-400-3-busy-error.cjs
 *
 * Node built-ins only. Hyphens only. No network, no room.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CAP = path.join(ROOT, 'lib', 'core', 'hook-busy-cap.cjs');

let passed = 0;
let failed = 0;
function check(label, cond, detail) {
  if (cond) { passed += 1; console.log('PASS: ' + label); }
  else { failed += 1; console.log('FAIL: ' + label + (detail !== undefined ? ' :: ' + detail : '')); }
}
const J = (x) => JSON.stringify(x);

const cap = require(CAP);
const isBusyError = typeof cap.isBusyError === 'function' ? cap.isBusyError : () => { throw new Error('isBusyError is not exported'); };
function safe(err) { try { return isBusyError(err); } catch (e) { return 'threw: ' + e.message; } }
function sqliteErr(errcode, message) { const e = new Error(message || 'x'); e.code = 'ERR_SQLITE_ERROR'; e.errcode = errcode; return e; }

// B1: the codes.
{
  const got = { 5: safe(sqliteErr(5, 'a')), 6: safe(sqliteErr(6, 'b')), 517: safe(sqliteErr(517, 'c')), 262: safe(sqliteErr(262, 'd')) };
  check('B1 errcode 5, 6, 517 (BUSY_SNAPSHOT) and 262 (LOCKED_SHAREDCACHE) are busy', got[5] === true && got[6] === true && got[517] === true && got[262] === true, J(got));
}
// B2: the message forms, with no errcode.
{
  const forms = ['database is locked', 'database table is locked', 'SQLITE_BUSY: database is locked', 'SQLITE_LOCKED', 'Database Is Locked'];
  const got = forms.map((m) => safe(new Error(m)));
  check('B2 the message forms are busy without an errcode', got.every((x) => x === true), J(forms.map((m, i) => [m, got[i]])));
  const errstr = new Error('step failed');
  errstr.errstr = 'database is locked';
  check('B2 a node:sqlite errstr of "database is locked" is busy', safe(errstr) === true, J(safe(errstr)));
}
// B3: not busy.
{
  const cases = [sqliteErr(1, 'no such table: x'), sqliteErr(10, 'disk I/O error'), sqliteErr(11, 'database disk image is malformed'), sqliteErr(13, 'database or disk is full'), new Error('ENOENT'), null, undefined, 'database is locked', {}, { errcode: '5' }];
  const got = cases.map(safe);
  check('B3 codes 1, 10, 11, 13, plain errors, null, undefined, a string and a string errcode are not busy', got.every((x) => x === false), J(got));
}
// B4: zero requires.
{
  const src = fs.readFileSync(CAP, 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  check('B4 lib/core/hook-busy-cap.cjs keeps zero requires', !/\brequire\s*\(/.test(src), (src.match(/require\s*\([^)]*\)/g) || []).join(', '));
}
// B5: the 6 sites call the one helper and keep no own busy test.
{
  const sites = [
    'lib/core/navigation/memory-events.cjs',
    'lib/core/navigation/spine-events.cjs',
    'scripts/memory-artifact-graph-hook.cjs',
    'scripts/session-start-reconcile.cjs',
    'scripts/feynman-timeline-refresh-command.cjs',
    'scripts/dial-memory-refresh-command.cjs',
  ];
  const bad = [];
  for (const rel of sites) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
    const ownTest = /is locked/.test(src) || /function\s+_?isBusyError\s*\(/.test(src);
    const usesHelper = /\.isBusyError\s*\(/.test(src) && /hook-busy-cap/.test(src);
    if (ownTest || !usesHelper) bad.push({ rel, ownTest, usesHelper });
  }
  check('B5 the 6 sites call hook-busy-cap isBusyError and keep no own busy test', bad.length === 0, J(bad));
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
