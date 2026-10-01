#!/usr/bin/env node
'use strict';

// Phase 365 (verification rung earned, not asserted) Plan 02 Task 3 -
// pre-phase baseline test.
//
// Proves that tests/fixtures/365-pre-phase.json and
// tests/fixtures/365-baseline-red.json faithfully pin the state of this repo
// the instant before any Phase 365 product edit landed, and then keeps two
// invariants true for the WHOLE phase:
//
//   D-06  confirmNode stays byte-unchanged (the human APPROVE door is not
//         edited; the floor lives in the gate, not in confirmNode).
//   D-12  the irreversible check stays the FIRST statement of makeGateFn's
//         gateFn (forced-material steps always halt, before anything else).
//
// Legs:
//   1  base_sha is an ancestor of HEAD
//   2  every files_at_base digest equals sha256 of `git show <base_sha>:<path>`
//   3  confirm_node_body_sha256 recomputes from git show AND from the working
//      tree
//   4  gate_fn_first_statement recomputes from git show AND is still the first
//      statement in the working tree
//   5  every red-list signature appears in observed_at_base for the same leg
//      (no red is invented later), the red list and the fixture share one
//      base_sha, and every healed_by_plan is 365-NN or 365.1
//   6  no U+2014 or U+2013 in either fixture
//
// Values are recomputed from git objects, never from the working tree, except
// where leg 3 and 4 deliberately compare the working tree to the pinned value.
//
// exit 0 PASSED, 1 FAILED, 77 SKIPPED (ENV GAP: git unavailable).
// House rule: hyphens only; the two dash characters appear below only as
// JavaScript unicode escapes.

const { scrubVendorKey, installNetGuard } = require('./helpers/hygiene-355.cjs');
scrubVendorKey();
const NET = installNetGuard();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PRE_PATH = path.join(__dirname, 'fixtures', '365-pre-phase.json');
const RED_PATH = path.join(__dirname, 'fixtures', '365-baseline-red.json');

const EM_DASH = String.fromCharCode(0x2014);
const EN_DASH = String.fromCharCode(0x2013);

let pass = 0;
let fail = 0;
function check(label, cond, detail) {
  if (cond) {
    pass += 1;
    console.log('PASS: ' + label);
  } else {
    fail += 1;
    console.log('FAIL: ' + label + (detail ? ' (' + detail + ')' : ''));
  }
  return cond;
}

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function git(args) {
  return execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 64,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function gitShow(sha, filePath) {
  return git(['show', sha + ':' + filePath]);
}

// The text of confirmNode from `function confirmNode(` through the first
// following line that is exactly `}`. Exported shape for later 365 plans.
function extractConfirmNodeBody(text) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l.startsWith('function confirmNode('));
  if (start === -1) return null;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (lines[i] === '}') return lines.slice(start, i + 1).join('\n');
  }
  return null;
}

// The first code statement (trimmed; blank lines and line comments skipped)
// inside the function returned by makeGateFn, i.e. after
// `return function gateFn(`.
function extractGateFnFirstStatement(text) {
  const lines = text.split('\n');
  const mk = lines.findIndex((l) => l.startsWith('function makeGateFn('));
  if (mk === -1) return null;
  const g = lines.findIndex((l, i) => i > mk && /return function gateFn\(/.test(l));
  if (g === -1) return null;
  for (let i = g + 1; i < lines.length; i += 1) {
    const t = lines[i].trim();
    if (t === '' || t.startsWith('//')) continue;
    return t;
  }
  return null;
}

function main() {
  try {
    git(['rev-parse', '--git-dir']);
  } catch (_e) {
    console.log('SKIP: git is unavailable (ENV GAP)');
    return 77;
  }

  const preText = fs.readFileSync(PRE_PATH, 'utf8');
  const redText = fs.readFileSync(RED_PATH, 'utf8');
  const pre = JSON.parse(preText);
  const red = JSON.parse(redText);
  const base = pre.base_sha;

  // 1. base_sha is an ancestor of HEAD.
  let ancestor = false;
  try {
    git(['merge-base', '--is-ancestor', base, 'HEAD']);
    ancestor = true;
  } catch (_e) {
    ancestor = false;
  }
  check('1 base_sha is an ancestor of HEAD', typeof base === 'string' && /^[0-9a-f]{40}$/.test(base) && ancestor,
    String(base));

  // 2. files_at_base digests recompute from git objects.
  const fileKeys = Object.keys(pre.files_at_base || {});
  let filesOk = fileKeys.length === 9;
  const filesBad = [];
  for (const f of fileKeys) {
    let digest = null;
    try { digest = sha256(gitShow(base, f)); } catch (_e) { digest = null; }
    if (digest !== pre.files_at_base[f]) { filesOk = false; filesBad.push(f); }
  }
  check('2 every files_at_base digest equals sha256 of git show <base_sha>:<path>', filesOk,
    'count=' + fileKeys.length + (filesBad.length ? ' bad=' + filesBad.join(',') : ''));

  // 3. confirmNode: pinned digest from git AND from the working tree (D-06).
  const confirmPath = 'lib/core/navigation/confirm-node.cjs';
  const confirmBase = extractConfirmNodeBody(gitShow(base, confirmPath));
  const confirmWork = extractConfirmNodeBody(fs.readFileSync(path.join(ROOT, confirmPath), 'utf8'));
  check('3 confirmNode body is byte-unchanged from the base (git object and working tree)',
    !!confirmBase && !!confirmWork
      && sha256(confirmBase) === pre.confirm_node_body_sha256
      && sha256(confirmWork) === pre.confirm_node_body_sha256,
    'git=' + (confirmBase ? sha256(confirmBase).slice(0, 12) : 'none')
      + ' work=' + (confirmWork ? sha256(confirmWork).slice(0, 12) : 'none')
      + ' pinned=' + String(pre.confirm_node_body_sha256).slice(0, 12));

  // 4. gateFn's first statement: pinned from git AND still first in the tree (D-12).
  const chainPath = 'lib/core/chain-executor.cjs';
  const gateBase = extractGateFnFirstStatement(gitShow(base, chainPath));
  const gateWork = extractGateFnFirstStatement(fs.readFileSync(path.join(ROOT, chainPath), 'utf8'));
  check('4 gateFn first statement is still the irreversible check (git object and working tree)',
    gateBase === pre.gate_fn_first_statement && gateWork === pre.gate_fn_first_statement
      && /^if \(isIrreversibleStep\(step\)\) return 'halt';$/.test(String(gateWork)),
    'git=' + JSON.stringify(gateBase) + ' work=' + JSON.stringify(gateWork));

  // 5. the red list is a subset of what was observed at base, with valid healers.
  let redOk = red.schema === 'mos.365-baseline-red/1' && red.base_sha === base && Array.isArray(red.legs);
  const redBad = [];
  let sigCount = 0;
  const healRe = /^(365-\d{2}|365\.1)$/;
  for (const leg of (red.legs || [])) {
    const observed = (pre.observed_at_base && pre.observed_at_base[leg.leg]) || [];
    for (const s of (leg.signatures || [])) {
      sigCount += 1;
      if (observed.indexOf(s.id) === -1) { redOk = false; redBad.push('not-observed:' + leg.leg + ':' + s.id); }
      if (!healRe.test(String(s.healed_by_plan))) { redOk = false; redBad.push('bad-healer:' + s.id); }
    }
    // Plan 365-08: the converse (no observed signature left out of a listed leg)
    // is gone because a healing plan may drop ONE signature from a leg that still
    // carries another (the one-week leg keeps RED-365-ONEWEEK-STANDING after its
    // status half heals). A signature that is red but unlisted is still caught,
    // louder, by tests/run-all-365.sh (unlisted red -> FAILED).
  }
  check('5 every red-list signature was observed at base and has a healing plan (the list only shrinks)',
    // The list may only SHRINK as healing plans land (each drops what it heals); it never grows past the 6 seen at base.
    redOk && sigCount <= 6, 'signatures=' + sigCount + ' ' + redBad.join(' '));

  // 6. no dash characters in either fixture.
  check('6 no U+2014 or U+2013 in either fixture',
    preText.indexOf(EM_DASH) === -1 && preText.indexOf(EN_DASH) === -1
      && redText.indexOf(EM_DASH) === -1 && redText.indexOf(EN_DASH) === -1);

  check('no network attempted', NET.attempts() === 0, String(NET.attempts()));
  NET.restore();
  console.log('PASS: ' + pass + ' FAIL: ' + fail);
  return fail === 0 ? 0 : 1;
}

module.exports = { extractConfirmNodeBody, extractGateFnFirstStatement, sha256 };

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (e) {
    console.log('UNCAUGHT: ' + String((e && e.stack) || e));
    process.exitCode = 1;
  }
}
