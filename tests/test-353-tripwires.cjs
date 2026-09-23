#!/usr/bin/env node
/**
 * Phase 353 Plan 03 Task 2 (leg 3 lands here) / Task 6 (legs 1 and 2 land
 * here): the three tripwires proving the vendor never reached lib/, hooks/
 * or a real room.
 *
 * Gates RULE-23, RULE-27.
 *
 * Each leg is a source scan with comment lines excluded (a `//` or `*`
 * comment line never counts, per the isPureLineComment discipline in
 * scripts/check-substrate.cjs) and prints its own scanned-file count so a
 * silent zero-file scan can never pass as green.
 *
 * House rule: hyphens only, no em-dashes.
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const REPO = path.join(__dirname, '..');
const RUNNER_PATH = path.join(REPO, 'scripts', 'eval-icm-writers.cjs');

let PASS = 0;
let FAIL = 0;
function check(label, cond) {
  if (cond) { PASS += 1; console.log('PASS: ' + label); }
  else { FAIL += 1; console.log('FAIL: ' + label); }
}

if (!fs.existsSync(RUNNER_PATH)) {
  console.error('RED: missing scripts/eval-icm-writers.cjs');
  process.exit(1);
}

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
    // one (a naive `/\/\/.*$/` strip would chop `https://api.typesafe.ai...`
    // off a real violation line entirely -- the exact false-negative this
    // gate exists to avoid). A `//` immediately preceded by `:` is left
    // alone; only a genuine standalone `//` starts a stripped comment.
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

// ---------------------------------------------------------------------------
// Leg 1 (Task 6): no non-comment line under lib/ contains the literal
// api.typesafe.ai (the vendor is dev-time only, never in the turn path).
// ---------------------------------------------------------------------------
function leg1() {
  console.log('--- leg 1: no api.typesafe.ai literal under lib/ (non-comment lines) ---');
  const libFiles = listFilesRecursive(path.join(REPO, 'lib'));
  console.log('files scanned: ' + libFiles.length);
  const hit = libFiles.find((f) => nonCommentContains(f, 'api.typesafe.ai'));
  check('no non-comment lib/ line contains api.typesafe.ai', !hit);
  if (hit) console.log('  hit: ' + path.relative(REPO, hit));

  // Negative control (T-353-19/20 proof the gate actually scans, not a
  // vacuous zero-file pass): write a scratch file under lib/core/ carrying
  // the literal on a non-comment line, confirm the SAME scan logic catches
  // it, then remove the scratch file before this leg returns -- in the same
  // task, never left behind.
  const scratchPath = path.join(REPO, 'lib', 'core', '__scratch-353-tripwire-negctl.cjs');
  fs.writeFileSync(scratchPath, "'use strict';\nconst ENDPOINT = 'https://api.typesafe.ai/v1/systemone';\nmodule.exports = { ENDPOINT };\n");
  let negControlCaught = false;
  try {
    negControlCaught = nonCommentContains(scratchPath, 'api.typesafe.ai');
  } finally {
    try { fs.unlinkSync(scratchPath); } catch (_e) { /* tolerant */ }
  }
  check('negative control: a scratch lib/ file carrying the literal on a non-comment line is caught by the same scan', negControlCaught);
  console.log('  negative control recorded: scratch file written under lib/core/, scanned, caught=' + negControlCaught + ', removed in this same task');

  return !hit && negControlCaught;
}

// ---------------------------------------------------------------------------
// Leg 2 (Task 6): no non-comment line under hooks/ references any dev-time
// ledger-builder script (a vendor-touching script must never reach a user
// machine's hook budget).
//
// HOOKS_BANNED_LEDGER_SCRIPTS is an append-only list agreed across 356, 357
// and 354-17 (D-19): one entry per dev-time Jev ledger script. Never fold it
// back into a hand-edited regex; a later phase appends its own script name
// to this list instead.
// ---------------------------------------------------------------------------
const HOOKS_BANNED_LEDGER_SCRIPTS = Object.freeze([
  'eval-icm-writers',
  'build-section-command-ledger',
  'jev-devtime-client',
  'build-command-irreversibility-ledger',
  'irreversibility-answer-key',
  'build-framework-command-ledger',
  'label-card-fire-replay',
  'jev-question-ceilings',
  'jev-response-schema',
]);

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function leg2() {
  console.log('--- leg 2: no hooks/ reference to any HOOKS_BANNED_LEDGER_SCRIPTS entry (' + HOOKS_BANNED_LEDGER_SCRIPTS.length + ' names) ---');
  const hooksFiles = listFilesRecursive(path.join(REPO, 'hooks'));
  console.log('files scanned: ' + hooksFiles.length);
  const bannedRe = new RegExp(HOOKS_BANNED_LEDGER_SCRIPTS.map(escapeRe).join('|'));
  const hit = hooksFiles.find((f) => nonCommentContains(f, bannedRe));
  check('no non-comment hooks/ line references any HOOKS_BANNED_LEDGER_SCRIPTS entry (' + HOOKS_BANNED_LEDGER_SCRIPTS.length + ' names)', !hit);
  if (hit) console.log('  hit: ' + path.relative(REPO, hit));
  return !hit;
}

// ---------------------------------------------------------------------------
// Leg 3 (Task 2): eval-icm-writers.cjs never reaches a real room.
// ---------------------------------------------------------------------------
function leg3() {
  console.log('--- leg 3: eval-icm-writers.cjs never reaches a real room ---');
  console.log('files scanned: 1');
  const noLiteral = !nonCommentContains(RUNNER_PATH, /MindrianRooms|os\.homedir\(\)/);
  check('no MindrianRooms literal, no os.homedir() room resolution in eval-icm-writers.cjs (non-comment lines)', noLiteral);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), '353-tripwire-refuse-'));
  let refused = false;
  try {
    const result = cp.spawnSync('node', [RUNNER_PATH, '--room', tmp], { encoding: 'utf8' });
    refused = result.status !== 0 && /refused/.test(String(result.stderr || ''));
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* tolerant */ }
  }
  check('a --room outside tests/fixtures/icm-rooms is refused with a non-zero exit', refused);
  return noLiteral && refused;
}

leg1();
console.log('');
leg2();
console.log('');
leg3();

console.log('');
console.log('PASS=' + PASS + ' FAIL=' + FAIL);
process.exit(FAIL === 0 ? 0 : 1);
