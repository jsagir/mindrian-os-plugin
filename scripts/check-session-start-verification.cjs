#!/usr/bin/env node
'use strict';

/*
 * scripts/check-session-start-verification.cjs -- Phase 341 plan 08 (D-07a f).
 *
 * WHAT: the offline harness-policy runner for the session-start tier. It asserts
 * that the machinery behind "the first session after an install or update
 * verifies itself" is still wired the way D-07a says, and that the last recorded
 * verification on this machine, if any, did not fail.
 *
 * Each assertion is reported as its own violation with a one-line remedy:
 *   1. hooks/hooks.json parses and registers the preflight host exactly once
 *      under hooks.SessionStart.
 *   2. that hook entry carries a timeout and the timeout is at most 12000 ms,
 *      the budget D-07a (b) binds the verification to.
 *   3. the SessionStart entry count is 9 (D-07a: no tenth hook).
 *   4. scripts/doctor.cjs declares the session-start tier: the --session-start
 *      flag is present and EXACTLY the expected set of point ids carries the
 *      session-start tier in applies_to. The set is asserted in both
 *      directions, so adding a point silently is a violation and dropping one is
 *      too. (The set is four points: the plan said five, and
 *      mcp-surface-tool-count was measured at 15.4 s and moved to the detached
 *      leg. See the comment at that point in scripts/doctor.cjs.)
 *   5. lib/core/session-verify-state.cjs exists, requires cleanly, and exports
 *      the seven functions of its contract.
 *   6. scripts/session-verify-probe.cjs exists.
 *   7. the last recorded verification, if any, did not fail (state.local.ok is
 *      not false). An ABSENT state is NOT a violation: a machine that has not
 *      verified yet has nothing to answer for. This is the only assertion that
 *      reads runtime state, and it is the reason the policy sits at rung
 *      `logged` and not `blocking`: on a navigator's machine a failed
 *      verification is surfaced, never blocking (D-07a f).
 *
 * Test seams:
 *   CHECK_SESSION_START_ROOT   overrides the repo root that is inspected
 *                              (the check-shape-declaration idiom).
 *   MOS_SESSION_VERIFY_HOME    the state root, the same seam
 *                              lib/core/session-verify-state.cjs uses.
 *
 * Canon Part 7: reuses the state module, the hook registry and the doctor tier
 * list as they are; no second copy of any of them.
 * Canon Part 8: local files only. Zero network. Spawns nothing at all.
 *
 * CLI: --check runs and prints a report; --json emits the result object. An
 * unknown flag prints usage and exits 2. Exit 0 with no violations, 1 otherwise.
 *
 * House rule: hyphens only, no em-dashes, no emoji. CJS, process.argv routing.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

const PREFLIGHT_SCRIPT = 'sessionstart-post-update-preflight.cjs';
const HOOK_BUDGET_MS = 12000;
const EXPECTED_SESSION_START_HOOKS = 9;
const EXPECTED_TIER_POINTS = Object.freeze([
  'eureka-optin-state',
  'harness-policies',
  'install-state',
  'session-start-active-version',
]);
const STATE_MODULE_FUNCTIONS = Object.freeze([
  'readVerifyState',
  'writeVerifyState',
  'mergeVerifyState',
  'detectVersionChange',
  'buildStatuslineSegment',
  'shortVersionLabel',
  'verifyDir',
]);

function usage() {
  return 'usage: node scripts/check-session-start-verification.cjs [--check] [--json]';
}

function readText(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch (_e) { return null; }
}

function violation(id, message, remedy) {
  return { id: id, message: message, remedy: remedy };
}

// Hook entries (objects with a .hooks array) under hooks.SessionStart whose
// command mentions the preflight script.
function findHooks(rootDir) {
  const raw = readText(path.join(rootDir, 'hooks', 'hooks.json'));
  if (raw === null) return { error: 'hooks/hooks.json is missing' };
  let parsed;
  try { parsed = JSON.parse(raw); } catch (e) { return { error: 'hooks/hooks.json does not parse: ' + e.message }; }
  const list = parsed && parsed.hooks && parsed.hooks.SessionStart;
  if (!Array.isArray(list)) return { error: 'hooks/hooks.json has no hooks.SessionStart array' };
  return { list: list };
}

function checkHooks(rootDir) {
  const out = [];
  const found = findHooks(rootDir);
  if (found.error) {
    out.push(violation('hooks-parse', found.error, 'restore hooks/hooks.json so it parses and lists SessionStart'));
    return out;
  }
  const preflight = found.list.filter(function (e) { return JSON.stringify(e).indexOf(PREFLIGHT_SCRIPT) !== -1; });
  if (preflight.length !== 1) {
    out.push(violation('preflight-registered-once',
      'the preflight host is registered ' + preflight.length + ' times under hooks.SessionStart (expected exactly 1)',
      'register scripts/' + PREFLIGHT_SCRIPT + ' exactly once in hooks/hooks.json'));
  } else {
    const inner = Array.isArray(preflight[0].hooks) ? preflight[0].hooks[0] : null;
    const timeout = inner && inner.timeout;
    if (typeof timeout !== 'number') {
      out.push(violation('preflight-timeout-present',
        'the preflight hook entry carries no numeric timeout',
        'set "timeout": ' + HOOK_BUDGET_MS + ' on the preflight entry in hooks/hooks.json'));
    } else if (timeout > HOOK_BUDGET_MS) {
      out.push(violation('preflight-timeout-budget',
        'the preflight hook timeout is ' + timeout + ' ms (budget ' + HOOK_BUDGET_MS + ' ms)',
        'lower the preflight timeout to at most ' + HOOK_BUDGET_MS + ' ms; do not raise the hook budget'));
    }
  }
  if (found.list.length !== EXPECTED_SESSION_START_HOOKS) {
    out.push(violation('session-start-hook-count',
      'hooks.SessionStart has ' + found.list.length + ' entries (expected ' + EXPECTED_SESSION_START_HOOKS + ')',
      'D-07a: do not add or remove a SessionStart hook; convert the preflight host instead'));
  }
  return out;
}

// Parse scripts/doctor.cjs for the ids whose applies_to carries 'session-start'.
// The points sit at six-space indentation as `id: '<id>',`; each applies_to array
// belongs to the nearest preceding id.
function tierPointsFromSource(src) {
  const marks = [];
  const idRe = /^ {6}id: '([^']+)',/gm;
  let m;
  while ((m = idRe.exec(src)) !== null) marks.push({ id: m[1], at: m.index });
  const ids = [];
  for (let i = 0; i < marks.length; i += 1) {
    const end = i + 1 < marks.length ? marks[i + 1].at : src.length;
    const block = src.slice(marks[i].at, end);
    const ap = /applies_to:\s*\[([^\]]*)\]/.exec(block);
    if (ap && ap[1].indexOf("'session-start'") !== -1) ids.push(marks[i].id);
  }
  return ids.sort();
}

function checkDoctorTier(rootDir) {
  const out = [];
  const src = readText(path.join(rootDir, 'scripts', 'doctor.cjs'));
  if (src === null) {
    out.push(violation('doctor-missing', 'scripts/doctor.cjs is missing', 'restore scripts/doctor.cjs'));
    return out;
  }
  if (src.indexOf("'--session-start'") === -1) {
    out.push(violation('doctor-flag', "scripts/doctor.cjs does not declare the '--session-start' flag",
      'restore the --session-start argv branch in scripts/doctor.cjs'));
  }
  const got = tierPointsFromSource(src);
  const want = EXPECTED_TIER_POINTS.slice().sort();
  const missing = want.filter(function (id) { return got.indexOf(id) === -1; });
  const extra = got.filter(function (id) { return want.indexOf(id) === -1; });
  if (missing.length || extra.length) {
    out.push(violation('doctor-tier-set',
      'the session-start tier differs from the expected set' +
        (missing.length ? ' (missing: ' + missing.join(', ') + ')' : '') +
        (extra.length ? ' (unexpected: ' + extra.join(', ') + ')' : ''),
      'make exactly these points carry session-start in applies_to: ' + want.join(', ')));
  }
  return out;
}

function loadStateModule(rootDir) {
  const file = path.join(rootDir, 'lib', 'core', 'session-verify-state.cjs');
  if (!fs.existsSync(file)) return { error: 'lib/core/session-verify-state.cjs is missing' };
  try { return { mod: require(file) }; } catch (e) { return { error: 'lib/core/session-verify-state.cjs does not load: ' + e.message }; }
}

function checkStateModule(rootDir) {
  const out = [];
  const loaded = loadStateModule(rootDir);
  if (loaded.error) {
    out.push(violation('state-module', loaded.error, 'restore lib/core/session-verify-state.cjs'));
    return out;
  }
  const absent = STATE_MODULE_FUNCTIONS.filter(function (f) { return typeof loaded.mod[f] !== 'function'; });
  if (absent.length) {
    out.push(violation('state-module-exports', 'session-verify-state.cjs does not export: ' + absent.join(', '),
      'restore the missing exports; the contract is the seven functions named in this runner'));
  }
  return out;
}

function checkProbe(rootDir) {
  if (fs.existsSync(path.join(rootDir, 'scripts', 'session-verify-probe.cjs'))) return [];
  return [violation('probe-missing', 'scripts/session-verify-probe.cjs is missing',
    'restore the detached session probe (D-07a d)')];
}

// The only arm that reads runtime state. Absent state is not a violation.
function checkLastVerification(rootDir) {
  const loaded = loadStateModule(rootDir);
  if (loaded.error || typeof loaded.mod.readVerifyState !== 'function') return [];
  let state = null;
  try { state = loaded.mod.readVerifyState(); } catch (_e) { state = null; }
  if (state && state.local && state.local.ok === false) {
    const pts = Array.isArray(state.local.failed_points) ? state.local.failed_points.join(', ') : 'unnamed';
    return [violation('last-verification-failed',
      'the last session-start verification failed (' + pts + ')',
      'run: node scripts/doctor.cjs --acceptance --session-start and fix the named points')];
  }
  return [];
}

function runChecks(rootDir) {
  const root = rootDir || process.env.CHECK_SESSION_START_ROOT || REPO_ROOT;
  const violations = []
    .concat(checkHooks(root))
    .concat(checkDoctorTier(root))
    .concat(checkStateModule(root))
    .concat(checkProbe(root))
    .concat(checkLastVerification(root));
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
    console.log('check-session-start-verification: OK (0 violations)');
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

module.exports = {
  runChecks,
  checkHooks,
  checkDoctorTier,
  checkStateModule,
  checkProbe,
  checkLastVerification,
  tierPointsFromSource,
  EXPECTED_TIER_POINTS,
};
