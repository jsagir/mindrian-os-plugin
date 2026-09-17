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
    const code = line.replace(/\/\/.*$/, '');
    if (typeof literalOrTest === 'string' ? code.indexOf(literalOrTest) !== -1 : literalOrTest.test(code)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Leg 3: eval-icm-writers.cjs never reaches a real room (lands in Task 2;
// legs 1 and 2 below land in Task 6, per 353-VALIDATION.md's per-task map).
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

leg3();

console.log('');
console.log('PASS=' + PASS + ' FAIL=' + FAIL);
process.exit(FAIL === 0 ? 0 : 1);
