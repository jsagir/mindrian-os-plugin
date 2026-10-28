#!/usr/bin/env node
'use strict';

/*
 * scripts/check-eureka-optin-once.cjs -- Phase 341 plan 08 (D-07b f).
 *
 * WHAT: the offline runner for the eureka-optin-once policy. It drives the SIX
 * named fixture states D-07b (f) lists through the ONE decision function,
 * shouldAskEurekaOptin in lib/core/session-verify-state.cjs, and asserts the
 * exact fire or no-fire for each, including the defer flag and the reason. It is
 * a caller of that function and never a second implementation of the rule.
 *
 * The six fixtures: fresh, installed, declined-same-version,
 * declined-older-version, never, first-install-reward-pending.
 *
 * Two structural facts keep the rule single-sourced:
 *   - the state module exports shouldAskEurekaOptin, recordEurekaOptin and
 *     EUREKA_OPTIN_COPY (a missing export is a violation naming the export);
 *   - EUREKA_OPTIN_COPY is non-empty and contains the literal "380 MB", so a
 *     silent re-wording of the locked copy is a reported violation.
 *
 * THIS RUNNER READS NO RUNTIME STATE. That is deliberate and it is the
 * difference from check-session-start-verification.cjs: a navigator who answered
 * "never" is not in violation of anything, so there is nothing about their
 * machine for this policy to judge. What it judges is the RULE. That is why it is
 * green on every machine, and why it can be a blocking leg on the dev side
 * (tests/run-all-341.sh) while the policy stays at rung logged at runtime.
 *
 * Test seams:
 *   CHECK_SESSION_START_ROOT   overrides the repo root whose state module is
 *                              driven (the check-shape-declaration idiom).
 *   MOS_SESSION_VERIFY_HOME    the state root; unused here, named for symmetry
 *                              with the state module.
 *
 * Canon Part 7: reuses the decision function as it is.
 * Canon Part 8: local only. Zero network, and this runner starts no process at
 * all. It requires the state module and calls it.
 *
 * CLI: --check runs and prints a report; --json emits the result object. An
 * unknown flag prints usage and exits 2. Exit 0 with no violations, 1 otherwise.
 *
 * House rule: hyphens only, no em-dashes, no emoji. CJS, process.argv routing.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const V = '2.0.0-beta.31';
const OLDER = '2.0.0-beta.30';

// FIXTURES-BEGIN
const FIXTURES = Object.freeze([
  Object.freeze({
    name: 'fresh',
    input: { installedNow: false, state: null, currentVersion: V, firstInstallRewardPending: false },
    expect: { ask: true, defer: false },
  }),
  Object.freeze({
    name: 'installed',
    input: { installedNow: true, state: null, currentVersion: V, firstInstallRewardPending: false },
    expect: { ask: false, defer: false, reason: 'already_installed' },
  }),
  Object.freeze({
    name: 'declined-same-version',
    input: { installedNow: false, state: { eureka_optin: { choice: 'declined', version: V } }, currentVersion: V, firstInstallRewardPending: false },
    expect: { ask: false, defer: false },
  }),
  Object.freeze({
    name: 'declined-older-version',
    input: { installedNow: false, state: { eureka_optin: { choice: 'declined', version: OLDER } }, currentVersion: V, firstInstallRewardPending: false },
    expect: { ask: true, defer: false },
  }),
  Object.freeze({
    name: 'never',
    input: { installedNow: false, state: { eureka_optin: { choice: 'never', version: OLDER } }, currentVersion: V, firstInstallRewardPending: false },
    expect: { ask: false, defer: false },
  }),
  Object.freeze({
    name: 'first-install-reward-pending',
    input: { installedNow: false, state: null, currentVersion: V, firstInstallRewardPending: true },
    expect: { ask: false, defer: true },
  }),
]);
// FIXTURES-END

const REQUIRED_EXPORTS = Object.freeze(['shouldAskEurekaOptin', 'recordEurekaOptin', 'EUREKA_OPTIN_COPY']);

function usage() {
  return 'usage: node scripts/check-eureka-optin-once.cjs [--check] [--json]';
}

function violation(id, message, remedy) {
  return { id: id, message: message, remedy: remedy };
}

function loadModule(rootDir) {
  const file = path.join(rootDir, 'lib', 'core', 'session-verify-state.cjs');
  if (!fs.existsSync(file)) return { error: 'lib/core/session-verify-state.cjs is missing' };
  try { return { mod: require(file) }; } catch (e) { return { error: 'lib/core/session-verify-state.cjs does not load: ' + e.message }; }
}

function runChecks(rootDir) {
  const root = rootDir || process.env.CHECK_SESSION_START_ROOT || REPO_ROOT;
  const violations = [];
  const loaded = loadModule(root);
  if (loaded.error) {
    violations.push(violation('state-module', loaded.error, 'restore lib/core/session-verify-state.cjs'));
    return { ok: false, violations: violations };
  }
  const mod = loaded.mod;

  for (const name of REQUIRED_EXPORTS) {
    if (mod[name] === undefined) {
      violations.push(violation('missing-export-' + name, 'session-verify-state.cjs does not export ' + name,
        'restore the export ' + name + '; the opt-in rule lives only in that module'));
    }
  }
  if (typeof mod.EUREKA_OPTIN_COPY !== 'string' || mod.EUREKA_OPTIN_COPY.length === 0
    || mod.EUREKA_OPTIN_COPY.indexOf('380 MB') === -1) {
    violations.push(violation('locked-copy',
      'EUREKA_OPTIN_COPY is empty or no longer contains the literal 380 MB',
      'restore the D-07b (c) locked copy verbatim; it is not paraphrasable'));
  }

  if (typeof mod.shouldAskEurekaOptin === 'function') {
    for (const fx of FIXTURES) {
      let got;
      try { got = mod.shouldAskEurekaOptin(fx.input); } catch (e) { got = { threw: e.message }; }
      if (!got || got.threw) {
        violations.push(violation('fixture-' + fx.name, 'fixture ' + fx.name + ' threw: ' + (got && got.threw),
          'shouldAskEurekaOptin must never throw; guard the null state'));
        continue;
      }
      if (got.ask !== fx.expect.ask) {
        violations.push(violation('fixture-' + fx.name,
          'fixture ' + fx.name + ': expected ask=' + fx.expect.ask + ' got ask=' + got.ask,
          fx.expect.ask ? 'the card must fire for this state' : 'the card must NOT fire for this state'));
      }
      if (got.defer !== fx.expect.defer) {
        violations.push(violation('fixture-' + fx.name + '-defer',
          'fixture ' + fx.name + ': expected defer=' + fx.expect.defer + ' got defer=' + got.defer,
          fx.expect.defer ? 'a pending first-install reward must DEFER, not drop, the card' : 'only a pending first-install reward may defer'));
      }
      if (fx.expect.reason !== undefined && got.reason !== fx.expect.reason) {
        violations.push(violation('fixture-' + fx.name + '-reason',
          'fixture ' + fx.name + ': expected reason ' + fx.expect.reason + ' got ' + got.reason,
          'a right verdict for the wrong reason is a defect; restore the rule order'));
      }
    }
  }
  return { ok: violations.length === 0, violations: violations };
}

function main() {
  const argv = process.argv.slice(2);
  const known = new Set(['--check', '--json']);
  for (const a of argv) {
    if (!known.has(a)) {
      console.error(usage());
      process.exit(2);
      return;
    }
  }
  const result = runChecks();
  if (argv.indexOf('--json') !== -1) {
    console.log(JSON.stringify(result, null, 2));
  } else if (result.ok) {
    console.log('check-eureka-optin-once: OK (' + FIXTURES.length + ' fixtures, 0 violations)');
  } else {
    for (const v of result.violations) {
      console.log('FAIL: [' + v.id + '] ' + v.message + ' -- remedy: ' + v.remedy);
    }
  }
  process.exit(result.ok ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = { FIXTURES, runChecks };
