#!/usr/bin/env node
/**
 * Phase 356 (chain-executor irreversibility ledger) Plan 01 Task 3: the D-12
 * Larry post-gate contract check. Reads agents/larry-extended.md and
 * skills/larry-personality/SKILL.md WITHOUT editing them, and proves the
 * handoff seam still passes with and without a ledger.
 *
 * D-12: the contract in agents/larry-extended.md ("## Post-Gate Handoff")
 * holds unchanged: runChain halts at the first material step. 356 only
 * makes more steps count as irreversible, and therefore as material.
 * Nothing in larry-extended.md or the larry-personality SKILL may redefine
 * "material" as "irreversible" (or vice versa).
 *
 * Test hygiene contract (every 356 test file): scrub TYPESAFE_API_KEY and
 * replace globalThis.fetch with a counting thrower before any other require
 * of repo code, assert NET_ATTEMPTS === 0 as the last check.
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
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const REPO = path.join(__dirname, '..');
const LARRY_EXTENDED = path.join(REPO, 'agents', 'larry-extended.md');
const LARRY_SKILL = path.join(REPO, 'skills', 'larry-personality', 'SKILL.md');
const PRELOAD = path.join(REPO, 'tests', 'fixtures', '356-no-network-preload.cjs');
const HANDOFF_SEAM_TEST = path.join(REPO, 'tests', 'test-larry-handoff-seam.cjs');

let PASS = 0;
let FAIL = 0;
function check(label, cond) {
  if (cond) { PASS += 1; console.log('PASS: ' + label); }
  else { FAIL += 1; console.log('FAIL: ' + label); }
}

// ---------------------------------------------------------------------------
// Leg 1: section extraction. Find "## Post-Gate Handoff", take every line up
// to (not including) the next "## " heading. FAIL if the heading is missing
// (a missing heading means the contract moved and must be re-checked by
// hand, per 357 D-16 which keeps it verbatim).
// ---------------------------------------------------------------------------
function extractPostGateHandoff(text) {
  const lines = text.split(/\r?\n/);
  let start = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].startsWith('## Post-Gate Handoff')) { start = i; break; }
  }
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (lines[i].startsWith('## ')) { end = i; break; }
  }
  return lines.slice(start, end).join('\n');
}

function leg1() {
  console.log('--- leg 1: Post-Gate Handoff section extraction ---');
  const text = fs.readFileSync(LARRY_EXTENDED, 'utf8');
  const section = extractPostGateHandoff(text);
  check('agents/larry-extended.md has a "## Post-Gate Handoff" heading', section !== null);
  if (section === null) return false;
  check('the Post-Gate Handoff section matches /halts at the first material/i', /halts at the first material/i.test(section));
  check('the Post-Gate Handoff section contains "runChain"', section.indexOf('runChain') !== -1);
  return true;
}

// ---------------------------------------------------------------------------
// Leg 2: no redefinition (D-12). Neither larry-extended.md nor the
// larry-personality SKILL may redefine "material" as "irreversible" or vice
// versa.
// ---------------------------------------------------------------------------
const REDEFINE_MATERIAL_RE = /\bmaterial\b[^.\n]{0,40}\b(means|is defined as|equals|only means)\b[^.\n]{0,40}\birreversible\b/i;
const REDEFINE_IRREVERSIBLE_RE = /\birreversible\b[^.\n]{0,20}\b(means|is defined as|equals)\b[^.\n]{0,20}\bmaterial\b/i;

function leg2() {
  console.log('--- leg 2: no redefinition of material as irreversible (D-12) ---');
  let clean = true;
  for (const filePath of [LARRY_EXTENDED, LARRY_SKILL]) {
    const rel = path.relative(REPO, filePath);
    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
    lines.forEach((line, idx) => {
      if (line.trim().length === 0) return;
      if (REDEFINE_MATERIAL_RE.test(line) || REDEFINE_IRREVERSIBLE_RE.test(line)) {
        clean = false;
        console.log('  hit: ' + rel + ':' + (idx + 1) + ': ' + line.trim());
      }
    });
  }
  check('no line in larry-extended.md or larry-personality SKILL.md redefines material as irreversible', clean);
  return clean;
}

// ---------------------------------------------------------------------------
// Leg 3: reason-code consistency. chain-executor.cjs's two halt-reason sites
// carry the literal 'forced_material' at least twice. Print (without
// asserting) whether larry-extended.md mentions forced_material.
// ---------------------------------------------------------------------------
function leg3() {
  console.log('--- leg 3: forced_material reason-code consistency ---');
  const target = path.join(REPO, 'lib', 'core', 'chain-executor.cjs');
  const raw = fs.readFileSync(target, 'utf8');
  let count = 0;
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) continue;
    if (line.indexOf("'forced_material'") !== -1) count += 1;
  }
  check('lib/core/chain-executor.cjs carries the literal \'forced_material\' at least 2 times (non-comment lines)', count >= 2);
  const extended = fs.readFileSync(LARRY_EXTENDED, 'utf8');
  console.log('  informational (not asserted): larry-extended.md mentions forced_material = ' + (extended.indexOf('forced_material') !== -1));
  return count >= 2;
}

// ---------------------------------------------------------------------------
// Leg 4: D-03 independence. Only runs when the policy file exists.
// ---------------------------------------------------------------------------
function leg4() {
  console.log('--- leg 4: D-03 policy independence from larry-extended ---');
  const policyPath = path.join(REPO, 'data', 'jev-policies', 'command-irreversibility.json');
  if (!fs.existsSync(policyPath)) {
    console.log('PENDING: policy not drafted yet');
    check('leg 4: pending (policy file not landed), counted as passing', true);
    return true;
  }
  const rawText = fs.readFileSync(policyPath, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (e) {
    check('data/jev-policies/command-irreversibility.json parses as JSON', false);
    return false;
  }
  const instructions = String(parsed.instructions || '');
  check('the policy instructions state irreversible is narrower than material', /irreversible is narrower than material/i.test(instructions));
  check('the policy file text contains no "larry-extended" substring', rawText.indexOf('larry-extended') === -1);
  return true;
}

// ---------------------------------------------------------------------------
// Leg 5: handoff seam runs twice: (a) default env, (b) plus a missing-ledger
// env var. Both must exit 0 and neither child's stderr may contain
// NETWORK_ATTEMPT_356.
// ---------------------------------------------------------------------------
function spawnHandoffSeam(extraEnv) {
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), '356-larry-contract-home-'));
  const childEnv = Object.assign({}, process.env, {
    HOME: tmpHome,
    NODE_OPTIONS: '--require ' + PRELOAD,
  }, extraEnv || {});
  delete childEnv.TYPESAFE_API_KEY;
  let result;
  try {
    result = cp.spawnSync(process.execPath, [HANDOFF_SEAM_TEST], { encoding: 'utf8', env: childEnv });
  } finally {
    try { fs.rmSync(tmpHome, { recursive: true, force: true }); } catch (_e) { /* tolerant */ }
  }
  return result;
}

function leg5() {
  console.log('--- leg 5: handoff seam runs with and without a ledger ---');
  const resultDefault = spawnHandoffSeam({});
  const okDefault = resultDefault.status === 0 && String(resultDefault.stderr || '').indexOf('NETWORK_ATTEMPT_356') === -1;
  check('handoff seam (default env) exits 0 with no NETWORK_ATTEMPT_356 in stderr', okDefault);
  if (!okDefault) {
    console.log('  status=' + resultDefault.status);
    console.log('  stderr=' + String(resultDefault.stderr || '').slice(0, 2000));
  }

  const resultNoLedger = spawnHandoffSeam({ MINDRIAN_IRREVERSIBILITY_LEDGER: '/nonexistent/356-no-ledger.json' });
  const okNoLedger = resultNoLedger.status === 0 && String(resultNoLedger.stderr || '').indexOf('NETWORK_ATTEMPT_356') === -1;
  check('handoff seam (ledger absent) exits 0 with no NETWORK_ATTEMPT_356 in stderr', okNoLedger);
  if (!okNoLedger) {
    console.log('  status=' + resultNoLedger.status);
    console.log('  stderr=' + String(resultNoLedger.stderr || '').slice(0, 2000));
  }

  const ledgerPath = path.join(REPO, 'data', 'command-irreversibility-ledger.json');
  if (fs.existsSync(ledgerPath) && okDefault) {
    console.log('handoff seam with shipped ledger: PASS');
  } else {
    console.log('handoff seam with shipped ledger: PENDING (ledger not shipped yet)');
  }

  return okDefault && okNoLedger;
}

// ---------------------------------------------------------------------------
// Leg 6: no 356 edit of the contract file. agents/larry-extended.md's commit
// history must carry no subject naming this phase's plans.
// ---------------------------------------------------------------------------
function leg6() {
  console.log('--- leg 6: agents/larry-extended.md carries no 356 commit ---');
  const result = cp.spawnSync('git', ['log', '--format=%s', '--', 'agents/larry-extended.md'], { encoding: 'utf8', cwd: REPO });
  const subjects = String(result.stdout || '').split(/\r?\n/).filter(Boolean);
  const bad = subjects.find((s) => /\(356-\d\d\)|phase-356|\b356-\d\d\b/.test(s));
  check('no agents/larry-extended.md commit subject names phase 356', !bad);
  if (bad) console.log('  hit: ' + bad);
  return !bad;
}

leg1();
console.log('');
leg2();
console.log('');
leg3();
console.log('');
leg4();
console.log('');
leg5();
console.log('');
leg6();
console.log('');

check('NET_ATTEMPTS === 0 (no network egress attempted by this test)', NET_ATTEMPTS === 0);

console.log('');
if (FAIL === 0) {
  console.log('test-356-larry-contract: PASS (' + PASS + ' checks)');
} else {
  console.log('test-356-larry-contract: FAIL (' + FAIL + ' of ' + (PASS + FAIL) + ' checks failed)');
}
process.exit(FAIL === 0 ? 0 : 1);
