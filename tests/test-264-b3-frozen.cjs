#!/usr/bin/env node
'use strict';

/*
 * Phase 264 Plan 04, Task 2 -- tests/test-264-b3-frozen.cjs
 * =============================================================
 * Behaviors covered:
 *   1. Six named chain-executor.cjs symbols that carry the gate / stop-
 *      condition surface (_defaultPostureFn, isIrreversibleStep,
 *      _isMaterialStep, _critiqueFailed, _ralphSafeRetry, makeGateFn) are
 *      sha256-pinned against the phase base commit
 *      (c7c33eea449f6f227c4cfbb86f220acaac9b5ab8). A rename, deletion, or any
 *      byte edit inside one of these six functions reddens this suite.
 *   2. The Canon Part 3 / B3 doctrine sentence in chain-executor.cjs's own
 *      header (the SEED-032 "loop until all PASSING" convergence branch is
 *      REJECTED; the stop condition is posture, quality, and maxSteps ONLY)
 *      survives verbatim.
 *   3. The two frozen constants driving the retry bound
 *      (RALPH_RETRY_CAP_DEFAULT = 2, LOW_QUALITY = 'low') are pinned by their
 *      declaration lines.
 *   4. _ralphSafeRetry's loop bound is structurally pinned: it contains the
 *      literal Math.min(cap, budgetRemaining) and contains neither await nor
 *      async (the loop must stay synchronous -- a Promise verdict would make
 *      _critiqueFailed silently return false, per salient-governance.cjs's
 *      own header rationale).
 *   5. makeGateFn and _isMaterialStep carry NO new convergence-stop surface
 *      (none of the tokens converge / allPassing / all_passing / loopUntil).
 *
 * Phase 264 is a CALLER of lib/core/chain-executor.cjs, never an editor of
 * it. This file changes ZERO production code; it is a read-only pin over
 * source text already on disk.
 *
 * SCOPE NOTE: this pin covers the gate and stop-condition surface ONLY,
 * deliberately NOT the whole file. A whole-file hash would redden this suite
 * on any legitimate future edit elsewhere in chain-executor.cjs and become a
 * maintenance landmine -- SPEC Requirement 5's acceptance names exactly
 * these six functions. The COMPANION whole-file zero-diff arm (strictly
 * stronger than this scoped pin, since Phase 264 makes zero edits to the
 * file at all) lives in tests/run-all-264.sh and in this task's own
 * <verify> block: `git diff --quiet c7c33eea449f6f227c4cfbb86f220acaac9b5ab8
 * -- lib/core/chain-executor.cjs`.
 *
 * An extraction that returns an empty string for any of the six symbols is a
 * FAILURE, not a skip: a renamed or deleted function must redden this test,
 * never silently pass it.
 *
 * House rule: hyphens only, no em-dashes.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..');
const CHAIN_EXEC_PATH = path.join(REPO_ROOT, 'lib', 'core', 'chain-executor.cjs');
const BASE_SHA = 'c7c33eea449f6f227c4cfbb86f220acaac9b5ab8';

let checks = 0;
let failures = 0;
function check(cond, msg) {
  checks += 1;
  if (cond) {
    process.stdout.write('  ok   ' + msg + '\n');
  } else {
    process.stderr.write('  FAIL ' + msg + '\n');
    failures += 1;
  }
}

const src = fs.readFileSync(CHAIN_EXEC_PATH, 'utf8');
const lines = src.split('\n');

// Extract a function's source text: slice from the line matching
// ^function <NAME>\( up to and including the next line that is exactly "}"
// at column 0. Returns '' when the symbol cannot be found (a FAILURE
// condition at the call site, never silently skipped).
function extractFunction(name) {
  const startRe = new RegExp('^function ' + name + '\\(');
  let startIdx = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (startRe.test(lines[i])) { startIdx = i; break; }
  }
  if (startIdx === -1) return '';
  let endIdx = -1;
  for (let i = startIdx + 1; i < lines.length; i += 1) {
    if (lines[i] === '}') { endIdx = i; break; }
  }
  if (endIdx === -1) return '';
  return lines.slice(startIdx, endIdx + 1).join('\n');
}

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

console.log('test-264-b3-frozen');

// ---------------------------------------------------------------------------
// ARM 1 -- SCOPED SOURCE PIN. Six symbols, extracted and sha256-hashed. The
// six recorded constants below were computed ONCE against the base commit
// c7c33eea449f6f227c4cfbb86f220acaac9b5ab8 (both the working-tree HEAD and
// the base commit were confirmed byte-identical for this file before these
// literals were recorded -- see 264-04-SUMMARY.md for the recorded
// `git diff --quiet` proof).
// ---------------------------------------------------------------------------
const PINNED_HASHES = {
  _defaultPostureFn: '43a27cb8c87e781f309a0a2c409fd2ff28f27ed759ca2c33280ff7f5076ef116',
  isIrreversibleStep: '037f9515aeff1b5123956b4dfda515ee3076f20fd4423f5cc0e92f65b4c3bc3d',
  _isMaterialStep: 'c644e445d27d31390e8abf561108213a02a641635906bba8cba3d23734308a9b',
  _critiqueFailed: '6f356837ac5229a5fce69ea0e27ae9db17412aff625c7e8a67165fbbdc3a664d',
  _ralphSafeRetry: 'da7cbfedb260924bd88f1a3cc031b2c7db3e964976429e84587c5da3480314d7',
  makeGateFn: '381924999134538d049cb7f214e5d49016936372c9e8dbb690c83ed23022eaa2',
};

const extracted = {};
for (const name of Object.keys(PINNED_HASHES)) {
  const s = extractFunction(name);
  extracted[name] = s;
  check(s.length > 0, 'Arm 1: ' + name + ' extraction is non-empty (renamed/deleted symbols must FAIL, never skip)');
  check(
    s.length > 0 && sha256(s) === PINNED_HASHES[name],
    'Arm 1: ' + name + ' sha256 matches the base-commit pin'
  );
}

// ---------------------------------------------------------------------------
// ARM 2 -- DOCTRINE TEXT PIN. The B3 doctrine sentence in chain-executor.cjs's
// own file header, located verbatim (not paraphrased) and checked as four
// substrings, each wholly contained within a single source line.
// ---------------------------------------------------------------------------
check(
  src.indexOf('the SEED-032 / imported-harness "loop until all PASSING"') !== -1,
  'Arm 2: header names the SEED-032 / imported-harness convergence branch verbatim'
);
check(
  src.indexOf('convergence branch is REJECTED.') !== -1,
  'Arm 2: header states the convergence branch is REJECTED verbatim'
);
check(
  src.indexOf('The stop condition is posture / quality / maxSteps') !== -1,
  'Arm 2: header names the stop condition (posture / quality / maxSteps) verbatim'
);
check(
  src.indexOf('ONLY -- the chain halts at the first material step per Canon Part 3.') !== -1,
  'Arm 2: header states the ONLY / Canon Part 3 halt clause verbatim'
);

// ---------------------------------------------------------------------------
// ARM 3 -- CONSTANT PIN. Module-private constants (not exported), asserted by
// matching their declaration lines.
// ---------------------------------------------------------------------------
check(
  lines.indexOf("const LOW_QUALITY = 'low';") !== -1,
  "Arm 3: LOW_QUALITY declaration line is exactly const LOW_QUALITY = 'low';"
);
check(
  lines.indexOf('const RALPH_RETRY_CAP_DEFAULT = 2;') !== -1,
  'Arm 3: RALPH_RETRY_CAP_DEFAULT declaration line is exactly const RALPH_RETRY_CAP_DEFAULT = 2;'
);

// ---------------------------------------------------------------------------
// ARM 4 -- STRUCTURAL PIN on _ralphSafeRetry's bound. The loop stays
// synchronous (no await, no async) and its retry count is bounded by
// Math.min(cap, budgetRemaining) -- the literal SPEC Requirement 5 names as
// untouchable.
// ---------------------------------------------------------------------------
const ralphSrc = extracted._ralphSafeRetry;
check(
  ralphSrc.indexOf('Math.min(cap, budgetRemaining)') !== -1,
  'Arm 4: _ralphSafeRetry contains the literal Math.min(cap, budgetRemaining) bound'
);
check(
  !/\bawait\b/.test(ralphSrc),
  'Arm 4: _ralphSafeRetry contains no await (the retry loop stays synchronous)'
);
check(
  !/\basync\b/.test(ralphSrc),
  'Arm 4: _ralphSafeRetry contains no async (the retry loop stays synchronous)'
);

// ---------------------------------------------------------------------------
// ARM 5 -- NO NEW CONVERGENCE SURFACE. makeGateFn and _isMaterialStep carry
// none of the forbidden convergence tokens.
// ---------------------------------------------------------------------------
const FORBIDDEN_TOKENS = ['converge', 'allPassing', 'all_passing', 'loopUntil'];
for (const symbol of ['makeGateFn', '_isMaterialStep']) {
  const symbolSrc = extracted[symbol];
  for (const token of FORBIDDEN_TOKENS) {
    check(
      symbolSrc.indexOf(token) === -1,
      'Arm 5: ' + symbol + ' does not contain the forbidden convergence token "' + token + '"'
    );
  }
}

if (failures > 0) {
  process.stderr.write('264 B3 frozen pin: FAIL (' + failures + ' of ' + checks + ' checks failed, base ' + BASE_SHA + ')\n');
  process.exit(1);
}
process.stdout.write('264 B3 frozen pin: PASS (' + checks + ' checks)\n');
process.exit(0);
