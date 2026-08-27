#!/usr/bin/env node
// Phase 265 Plan 21 (RADAR-29) tripwire -- two commands, one file, because they share the
// SAME shape (a hard sequential gate up front, a bounded parallel middle, and a
// reconciliation step that is the whole point). The VAULT arms defend the threshold, the
// single persistence call, and the crossing-reassignment reconcile in commands/vault.md.
// The ANALOGY arms defend the approval-before-dispatch ordering, the never-recompose
// constraint, and the mechanism-identity dedup rule in commands/find-analogies.md.
//
// This test does NOT own subagent_type resolution -- that is
// tests/test-265-dispatch-shape-explicit.cjs arm (b)'s job repo-wide, and this file never
// duplicates it (this file names no agent-definition directory path at all).
//
// Plain Node script, no node:test, no npm deps. Hyphens only (no em-dashes).

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const VAULT_PATH = path.join(ROOT, 'commands', 'vault.md');
const ANALOGIES_PATH = path.join(ROOT, 'commands', 'find-analogies.md');

let failed = false;
let passCount = 0;
let failCount = 0;
const armResults = [];

function pass(arm, label) {
  passCount += 1;
  armResults.push({ arm, ok: true });
  console.log('PASS (arm ' + arm + '): ' + label);
}

function fail(arm, label) {
  failed = true;
  failCount += 1;
  armResults.push({ arm, ok: false });
  console.error('FAIL (arm ' + arm + '): ' + label);
}

function readOrDie(p) {
  if (!fs.existsSync(p)) {
    console.error('FAIL: target file does not exist: ' + p);
    process.exit(1);
  }
  return fs.readFileSync(p, 'utf8');
}

const vaultText = readOrDie(VAULT_PATH);
const analogiesText = readOrDie(ANALOGIES_PATH);

function countOccurrences(text, literal) {
  let count = 0;
  let idx = text.indexOf(literal);
  while (idx !== -1) {
    count += 1;
    idx = text.indexOf(literal, idx + literal.length);
  }
  return count;
}

function allIndices(text, literal) {
  const out = [];
  let idx = text.indexOf(literal);
  while (idx !== -1) {
    out.push(idx);
    idx = text.indexOf(literal, idx + literal.length);
  }
  return out;
}

// ---------------------------------------------------------------------------
// VAULT ARM 1: THRESHOLD PRESENT.
// ---------------------------------------------------------------------------
(function armVault1() {
  const hasEnvVar = vaultText.includes('VAULT_REVIEW_FANOUT_THRESHOLD');
  const hasDefault = /VAULT_REVIEW_FANOUT_THRESHOLD[\s\S]{0,120}\b40\b/.test(vaultText);
  const hasBelowBehavior = /BELOW `VAULT_REVIEW_FANOUT_THRESHOLD`[\s\S]{0,400}single-pass/i.test(vaultText);
  if (hasEnvVar && hasDefault && hasBelowBehavior) {
    pass(1, 'VAULT_REVIEW_FANOUT_THRESHOLD is stated with a numeric default and the below-threshold single-pass behavior');
  } else {
    fail(
      1,
      'commands/vault.md is missing a stated threshold, its numeric default, or the below-threshold single-pass statement -- ' +
        'an unstated threshold is a magic constant and the next reader will change it blind. ' +
        JSON.stringify({ hasEnvVar, hasDefault, hasBelowBehavior })
    );
  }
})();

// ---------------------------------------------------------------------------
// VAULT ARM 2: SINGLE PERSISTENCE.
// ---------------------------------------------------------------------------
(function armVault2() {
  const dispatchIdx = vaultText.indexOf('Dispatching');
  const syncIndices = allIndices(vaultText, 'syncClassificationsToManifest');
  const syncCount = syncIndices.length;
  const hasConstraint =
    /MUST NOT write/i.test(vaultText) &&
    vaultText.includes('classifications.md') &&
    vaultText.includes('MANIFEST.json');
  const boundedCount = syncCount >= 1 && syncCount <= 2;
  const allAfterDispatch = dispatchIdx !== -1 && syncIndices.every((i) => i > dispatchIdx);

  if (boundedCount && hasConstraint && allAfterDispatch) {
    pass(2, 'commands/vault.md persists through exactly one call site (bounded mention count, all after Dispatching) and states the agents-must-not-write constraint');
  } else {
    fail(
      2,
      'commands/vault.md single-persistence property broke -- concurrent manifest writes are a corruption bug. ' +
        JSON.stringify({ syncCount, hasConstraint, dispatchIdx, syncIndices, allAfterDispatch })
    );
  }
})();

// ---------------------------------------------------------------------------
// VAULT ARM 3: CROSSING RECONCILE PRESENT.
// ---------------------------------------------------------------------------
(function armVault3() {
  const requiredMarkers = [
    'CROSSING REASSIGNMENTS',
    'business-model',
    'financial-model',
    'either-or choice',
  ];
  const missing = requiredMarkers.filter((m) => !vaultText.includes(m));
  if (missing.length === 0) {
    pass(3, 'commands/vault.md describes crossing reassignments with the worked example and a stated resolution rule');
  } else {
    fail(3, 'commands/vault.md crossing-reassignment description is missing marker(s): ' + missing.join(', '));
  }
})();

// ---------------------------------------------------------------------------
// ANALOGY ARM 4: APPROVAL BEFORE DISPATCH.
// ---------------------------------------------------------------------------
(function armAnalogy4() {
  const approveIdx = analogiesText.indexOf('Do not fetch until they approve');
  const dispatchIdx = analogiesText.indexOf('Dispatching');
  const hasApprove1 = countOccurrences(analogiesText, 'Do not fetch until they approve') >= 1;
  const hasApprove2 = countOccurrences(analogiesText, 'There is no send-anyway path') >= 1;
  const orderedOk = approveIdx !== -1 && dispatchIdx !== -1 && approveIdx < dispatchIdx;

  if (hasApprove1 && hasApprove2 && orderedOk) {
    pass(4, 'commands/find-analogies.md approval card precedes any Dispatching block, both verbatim rules intact');
  } else {
    fail(
      4,
      'commands/find-analogies.md approval-before-dispatch property broke -- there is no send-anyway path and a fan-out must not create one. ' +
        JSON.stringify({ approveIdx, dispatchIdx, hasApprove1, hasApprove2 })
    );
  }
})();

// ---------------------------------------------------------------------------
// ANALOGY ARM 5: NEVER RECOMPOSE.
// ---------------------------------------------------------------------------
(function armAnalogy5() {
  const hasVerbatim = analogiesText.includes('verbatim');
  const hasNeverRecompose = analogiesText.includes('never re-compose');
  // Deliberately excludes "hand-compose a query" (a NEGATIVE instruction the file already
  // carries verbatim from the shipped Part-8 composer rule -- "Never hand-compose a query").
  // The forbidden phrases below are the POSITIVE, permissive form that would let an agent
  // reinvent query composition; the negative lookbehind keeps the existing prohibition from
  // tripping its own tripwire.
  const forbiddenPatterns = [
    /(?<!hand-)compose a query/i,
    /build a query/i,
    /search for analogies about/i,
  ];
  const foundForbidden = forbiddenPatterns.filter((re) => re.test(analogiesText)).map((re) => re.source);

  if (hasVerbatim && hasNeverRecompose && foundForbidden.length === 0) {
    pass(5, 'commands/find-analogies.md agent contract states verbatim + never re-compose, with no query-building language');
  } else {
    fail(
      5,
      'commands/find-analogies.md never-recompose constraint broke. ' +
        JSON.stringify({ hasVerbatim, hasNeverRecompose, foundForbidden })
    );
  }
})();

// ---------------------------------------------------------------------------
// ANALOGY ARM 6: DEDUP RULE.
// ---------------------------------------------------------------------------
(function armAnalogy6() {
  const hasMechanismDedup = /mechanism[\s-]identity/i.test(analogiesText);
  const hasOnceStatement = /RUN THE FITNESS ENGINE ONCE/i.test(analogiesText) || /fitness engine\s+once/i.test(analogiesText);
  const lowerText = analogiesText.toLowerCase();
  const hasUrlDedup = lowerText.includes('dedup on url') || lowerText.includes('deduplicate by url');

  if (hasMechanismDedup && hasOnceStatement && !hasUrlDedup) {
    pass(6, 'commands/find-analogies.md dedups on mechanism identity, scores once, and never instructs URL-based dedup');
  } else {
    fail(
      6,
      'commands/find-analogies.md dedup rule broke. ' +
        JSON.stringify({ hasMechanismDedup, hasOnceStatement, hasUrlDedup })
    );
  }
})();

// ---------------------------------------------------------------------------
// Summary and exit.
// ---------------------------------------------------------------------------
console.log('');
console.log('test-265-threshold-fanouts: ' + passCount + ' passed, ' + failCount + ' failed (6 arms total)');

if (failed) {
  process.exit(1);
}

console.log('PASS: test-265-threshold-fanouts (all 6 arms green)');
process.exit(0);
