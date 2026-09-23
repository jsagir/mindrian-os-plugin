#!/usr/bin/env node
/**
 * Phase 356 (chain-executor irreversibility ledger) Plan 01 Task 2: proves
 * the Jev vendor never reaches lib/ or hooks/, with a planted negative
 * control so a silent zero-hit scan can never pass as green (T-356-02).
 *
 * Test hygiene contract (every 356 test file, per the plan context block):
 * scrub TYPESAFE_API_KEY and replace globalThis.fetch with a counting
 * thrower before any other require of repo code, assert NET_ATTEMPTS === 0
 * as the last check.
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

const REPO = path.join(__dirname, '..');

let PASS = 0;
let FAIL = 0;
function check(label, cond) {
  if (cond) { PASS += 1; console.log('PASS: ' + label); }
  else { FAIL += 1; console.log('FAIL: ' + label); }
}

// Copied (not required) from tests/test-353-tripwires.cjs: test helpers,
// not the Jev client, so this file has no dependency on the 353 test.
function isPureLineComment(line) {
  const t = line.trim();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
}

function nonCommentContains(fileAbs, literalOrTest) {
  let raw;
  try { raw = fs.readFileSync(fileAbs, 'utf8'); } catch (_e) { return false; }
  for (const line of raw.split(/\r?\n/)) {
    if (isPureLineComment(line)) continue;
    // Strip a trailing `//` line comment WITHOUT treating a URL's `://` as
    // one (see test-353-tripwires.cjs for the reasoning behind this guard).
    const code = line.replace(/(^|[^:])\/\/.*$/, '$1');
    if (typeof literalOrTest === 'string' ? code.indexOf(literalOrTest) !== -1 : literalOrTest.test(code)) return true;
  }
  return false;
}

function listFilesRecursive(dirAbs) {
  const out = [];
  let entries;
  try { entries = fs.readdirSync(dirAbs, { withFileTypes: true }); } catch (_e) { return out; }
  for (const e of entries) {
    const abs = path.join(dirAbs, e.name);
    if (e.isDirectory()) out.push(...listFilesRecursive(abs));
    else if (e.isFile()) out.push(abs);
  }
  return out;
}

const BANNED_356 = [
  'api.typesafe.ai',
  'TYPESAFE_API_KEY',
  'jev-devtime-client',
  'build-command-irreversibility-ledger',
  'irreversibility-answer-key',
];

// Mirrors run-all-156.sh BRAIN_WRITE / RAW_FETCH / EXTERNAL_HTTP, copied
// verbatim in shape from tests/test-chain-executor-part8-leak.cjs.
const RAW_FETCH = /[^a-zA-Z_]fetch[\s]*\(/;
const EXTERNAL_HTTP = /https?:\/\//;
const BRAIN_WRITE = /mcp__brain_(write|store|upsert|ingest)|writeBrain|sendToBrain|ingestToBrain/;

// ---------------------------------------------------------------------------
// Leg A: no non-comment line under lib/ or hooks/ references any BANNED_356
// token (R356-05 d).
// ---------------------------------------------------------------------------
function legA() {
  console.log('--- leg A: no lib/ or hooks/ line references a BANNED_356 token ---');
  const files = [
    ...listFilesRecursive(path.join(REPO, 'lib')),
    ...listFilesRecursive(path.join(REPO, 'hooks')),
  ];
  console.log('files scanned: ' + files.length);
  check('at least one file scanned', files.length > 0);

  let hit = null;
  let hitToken = null;
  outer:
  for (const f of files) {
    for (const token of BANNED_356) {
      if (nonCommentContains(f, token)) { hit = f; hitToken = token; break outer; }
    }
  }
  check('no non-comment lib/ or hooks/ line references any of: ' + BANNED_356.join(', '), !hit);
  if (hit) console.log('  hit: ' + path.relative(REPO, hit) + ' token=' + hitToken);
  return !hit && files.length > 0;
}

// ---------------------------------------------------------------------------
// Leg B: negative control. A planted scratch file carrying a banned token on
// a non-comment line must be caught by the same scan, proving leg A is not a
// vacuous zero-hit pass.
// ---------------------------------------------------------------------------
function legB() {
  console.log('--- leg B: negative control (planted vendor-token file is caught) ---');
  const scratchPath = path.join(REPO, 'lib', 'core', '__scratch-356-tripwire-negctl.cjs');
  fs.writeFileSync(scratchPath, "'use strict';\nconst KEY = process.env.TYPESAFE_API_KEY;\nmodule.exports = { KEY };\n");
  let caught = false;
  try {
    caught = nonCommentContains(scratchPath, 'TYPESAFE_API_KEY');
  } finally {
    try { fs.unlinkSync(scratchPath); } catch (_e) { /* tolerant */ }
  }
  check('negative control: a scratch lib/ file naming TYPESAFE_API_KEY is caught by the same scan', caught);
  check('negative control scratch file removed', !fs.existsSync(scratchPath));
  return caught;
}

// ---------------------------------------------------------------------------
// Leg C: if the runtime ledger reader has landed, sweep it for raw fetch,
// external HTTP, Brain-write tokens, and case-insensitive jev/typesafe.
// Absent = PENDING, counts as passing (this plan lays scaffolding only).
// ---------------------------------------------------------------------------
function legC() {
  console.log('--- leg C: lib/core/irreversibility-ledger.cjs runtime sweep ---');
  const target = path.join(REPO, 'lib', 'core', 'irreversibility-ledger.cjs');
  if (!fs.existsSync(target)) {
    console.log('PENDING: lib/core/irreversibility-ledger.cjs not landed yet');
    check('leg C: pending (file not landed), counted as passing', true);
    return true;
  }
  const raw = fs.readFileSync(target, 'utf8');
  let clean = true;
  for (const line of raw.split(/\r?\n/)) {
    if (isPureLineComment(line)) continue;
    const code = line.replace(/(^|[^:])\/\/.*$/, '$1');
    if (RAW_FETCH.test(code) || EXTERNAL_HTTP.test(code) || BRAIN_WRITE.test(code)) { clean = false; break; }
    if (/jev/i.test(code) || /typesafe/i.test(code)) { clean = false; break; }
  }
  check('lib/core/irreversibility-ledger.cjs has no raw fetch, external HTTP, Brain-write, jev or typesafe token (non-comment lines)', clean);
  return clean;
}

// ---------------------------------------------------------------------------
// Leg D: lib/core/chain-executor.cjs never names the vendor.
// ---------------------------------------------------------------------------
function legD() {
  console.log('--- leg D: lib/core/chain-executor.cjs has no jev or typesafe token ---');
  const target = path.join(REPO, 'lib', 'core', 'chain-executor.cjs');
  if (!fs.existsSync(target)) {
    console.log('PENDING: lib/core/chain-executor.cjs not found');
    check('leg D: pending (file not found), counted as passing', true);
    return true;
  }
  const raw = fs.readFileSync(target, 'utf8');
  let clean = true;
  for (const line of raw.split(/\r?\n/)) {
    if (isPureLineComment(line)) continue;
    const code = line.replace(/(^|[^:])\/\/.*$/, '$1');
    if (/\bjev\b/i.test(code) || /typesafe/i.test(code)) { clean = false; break; }
  }
  check('lib/core/chain-executor.cjs has no whole-word jev or typesafe token (non-comment lines)', clean);
  return clean;
}

legA();
console.log('');
legB();
console.log('');
legC();
console.log('');
legD();
console.log('');

check('NET_ATTEMPTS === 0 (no network egress attempted by this test)', NET_ATTEMPTS === 0);

console.log('');
if (FAIL === 0) {
  console.log('test-356-tripwires: PASS (' + PASS + ' checks)');
} else {
  console.log('test-356-tripwires: FAIL (' + FAIL + ' of ' + (PASS + FAIL) + ' checks failed)');
}
process.exit(FAIL === 0 ? 0 : 1);
