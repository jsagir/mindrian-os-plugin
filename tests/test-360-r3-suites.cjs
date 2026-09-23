#!/usr/bin/env node
'use strict';

/*
 * Phase 360-01 (D-15, D-17, RESEARCH Pitfall 2): the R3 / MCP / wider suite
 * recorder and comparer.
 *
 * This file measures the SAME 18 suites two ways:
 *   --record   spawns every suite (or the suites in --group), and merges the
 *              per-suite result into tests/fixtures/ups-harness-360/pre-phase.json
 *              under the "suites" key, keyed by file path. Every other key in
 *              pre-phase.json is preserved untouched.
 *   (default)  spawns every suite again and compares against the recorded
 *              baseline: a suite that was green at record time must still be
 *              green; a suite that was already red keeps its known reds (the
 *              357 R-J precedent) as long as no NEW fail line appears. A
 *              single mismatch gets one re-run (a timing-flake guard) before
 *              it is treated as a real regression.
 *
 * Every suite spawns with its own fresh HOME / MINDRIAN_HOME /
 * CARD_FIRE_SIDECHANNEL_PATH / TMPDIR (mktemp-style, via fs.mkdtempSync),
 * and with TYPESAFE_API_KEY / MINDRIAN_BRAIN_KEY stripped from its env, so no
 * suite here can write the real ~/.mindrian/card-fire-reached.json or make a
 * keyed network call (T-360-05, T-360-07).
 *
 * Node built-ins only, CJS, no em-dashes.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const PRE_PHASE_PATH = path.join(REPO_ROOT, 'tests', 'fixtures', 'ups-harness-360', 'pre-phase.json');

// The frozen 18-entry suite list (D-15 action step 1). Order matches the
// plan's own group ordering: r3 (SPEC R3 baseline), mcp (D-18/R9), wider
// (the classifier regression net, R10/R11).
const SUITES = Object.freeze([
  { group: 'r3', file: 'tests/test-209-primary-sidechannel.cjs' },
  { group: 'r3', file: 'tests/test-209-engine-arm-contract.cjs' },
  { group: 'r3', file: 'tests/test-225-answer-narrowing.cjs' },
  { group: 'r3', file: 'tests/test-260917-binding-gate-offscope.cjs' },
  { group: 'r3', file: 'tests/test-251-skeleton-split.cjs' },
  { group: 'r3', file: 'lib/memory/userpromptsubmit-integration.test.cjs' },
  { group: 'mcp', file: 'tests/test-248-room-bind-honest-return.cjs' },
  { group: 'mcp', file: 'tests/test-248-room-bind-session-authoritative.cjs' },
  { group: 'mcp', file: 'tests/test-room-bind-health-signal.cjs' },
  { group: 'mcp', file: 'tests/test-room-bind-stdio-session-fallback.cjs' },
  { group: 'wider', file: 'tests/test-225-zero-score-gate.cjs' },
  { group: 'wider', file: 'tests/test-225-gate-degrade.cjs' },
  { group: 'wider', file: 'tests/test-226-session-binding-key-alignment.cjs' },
  { group: 'wider', file: 'tests/test-260917-rooms-home-precedence.cjs' },
  { group: 'wider', file: 'tests/test-binding-gate-degrade.test.cjs' },
  { group: 'wider', file: 'lib/memory/room-classifier-strict-mode.test.cjs' },
  { group: 'wider', file: 'tests/test-cross-session-room-bleed.cjs' },
  { group: 'wider', file: 'tests/test-reach-gate-stale-turn-input.cjs' },
]);

const OK_RE = /^\s*ok\b/;
const FAIL_RE = /^\s*(FAIL\b|not ok\b)/;

// runSuite(file) -- spawn one suite under a fresh isolated env (T-360-05,
// T-360-07). Returns {group, file, exit, ok_count, fail_lines}. Never throws
// (a spawn error itself becomes exit 1 with a synthetic fail line).
function runSuite(entry) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), '360-r3-suite-'));
  const home = path.join(tmp, 'home');
  const mh = path.join(tmp, 'mh');
  const tmpdir = path.join(tmp, 'tmp');
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(mh, { recursive: true });
  fs.mkdirSync(tmpdir, { recursive: true });

  const env = Object.assign({}, process.env);
  delete env.TYPESAFE_API_KEY;
  delete env.MINDRIAN_BRAIN_KEY;
  env.HOME = home;
  env.MINDRIAN_HOME = mh;
  env.CARD_FIRE_SIDECHANNEL_PATH = path.join(mh, 'card-fire-reached.json');
  env.TMPDIR = tmpdir;

  let res;
  try {
    res = spawnSync(process.execPath, [path.join(REPO_ROOT, entry.file)], {
      cwd: REPO_ROOT,
      input: '',
      encoding: 'utf8',
      timeout: 180000,
      env: env,
    });
  } catch (e) {
    res = { status: 1, stdout: '', stderr: String(e && e.message ? e.message : e) };
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e2) { /* best-effort */ }
  }

  const stdout = res.stdout || '';
  const lines = stdout.split('\n');
  let okCount = 0;
  const failSet = new Set();
  for (const line of lines) {
    if (OK_RE.test(line)) okCount += 1;
    if (FAIL_RE.test(line)) failSet.add(line.trim());
  }
  const exit = (res.status === null || res.status === undefined) ? 1 : res.status;
  return {
    group: entry.group,
    file: entry.file,
    exit: exit,
    ok_count: okCount,
    fail_lines: Array.from(failSet).sort(),
  };
}

function loadPrePhase() {
  const raw = fs.readFileSync(PRE_PHASE_PATH, 'utf8');
  return JSON.parse(raw);
}

function writePrePhase(obj) {
  fs.writeFileSync(PRE_PHASE_PATH, JSON.stringify(obj, null, 2) + '\n');
}

// isSubset(a, b) -- true when every element of array a is present in array b.
function isSubset(a, b) {
  const bSet = new Set(b);
  return a.every(function (x) { return bSet.has(x); });
}

function main() {
  const argv = process.argv.slice(2);
  const recordMode = argv.includes('--record');
  const groupIdx = argv.indexOf('--group');
  const groupFilter = groupIdx !== -1 ? argv[groupIdx + 1] : null;
  const VALID_GROUPS = ['r3', 'mcp', 'wider'];
  if (groupFilter && !VALID_GROUPS.includes(groupFilter)) {
    process.stderr.write('unknown --group value: ' + groupFilter + '\n');
    process.exit(2);
  }

  const suitesToRun = SUITES.filter(function (s) {
    return !groupFilter || s.group === groupFilter;
  });

  if (recordMode) {
    const pre = loadPrePhase();
    pre.suites = pre.suites || {};
    let anyFail = false;
    for (const entry of suitesToRun) {
      const result = runSuite(entry);
      pre.suites[entry.file] = result;
      if (result.exit === 0) {
        process.stdout.write('  ok - ' + entry.file + ' (recorded)\n');
      } else {
        anyFail = true;
        process.stdout.write('  FAIL ' + entry.file + ': recorded a known red, exit ' + result.exit + ', ' + result.fail_lines.length + ' fail line(s)\n');
      }
    }
    writePrePhase(pre);
    process.stdout.write('\nPASS test-360-r3-suites.cjs --record (' + suitesToRun.length + ' suites)\n');
    // --record never fails the process: a red suite is captured as a known
    // baseline, not a defect in the recorder itself (357 R-J precedent).
    process.exit(0);
  }

  // Default (compare) mode.
  let pre;
  try {
    pre = loadPrePhase();
  } catch (e) {
    process.stderr.write('cannot read pre-phase.json baseline: ' + (e && e.message ? e.message : e) + '\n');
    process.exit(1);
  }
  const baseline = pre.suites || {};
  let mismatchCount = 0;

  for (const entry of suitesToRun) {
    const base = baseline[entry.file];
    if (!base) {
      process.stdout.write('  FAIL ' + entry.file + ': no recorded baseline (run --record first)\n');
      mismatchCount += 1;
      continue;
    }

    function judge(result) {
      if (base.exit === 0) {
        return result.exit === 0;
      }
      return isSubset(result.fail_lines, base.fail_lines);
    }

    let result = runSuite(entry);
    let ok = judge(result);
    if (!ok) {
      // Timing-flake guard: re-run once and judge the second run instead.
      const first = result;
      const retryResult = runSuite(entry);
      const retryOk = judge(retryResult);
      process.stdout.write('  retry - ' + entry.file + ': first attempt exit ' + first.exit + ' (' + first.fail_lines.length + ' fail lines), second attempt exit ' + retryResult.exit + ' (' + retryResult.fail_lines.length + ' fail lines)\n');
      result = retryResult;
      ok = retryOk;
    }

    if (ok) {
      process.stdout.write('  ok - ' + entry.file + '\n');
    } else {
      mismatchCount += 1;
      const reason = base.exit === 0
        ? ('baseline was green (exit 0), now exit ' + result.exit)
        : ('new fail line(s) not in the recorded baseline: ' + JSON.stringify(result.fail_lines.filter(function (l) { return !(base.fail_lines || []).includes(l); })));
      process.stdout.write('  FAIL ' + entry.file + ': ' + reason + '\n');
    }
  }

  if (mismatchCount > 0) {
    process.stdout.write('\nFAIL test-360-r3-suites.cjs (' + mismatchCount + '/' + suitesToRun.length + ' mismatched)\n');
    process.exit(1);
  }
  process.stdout.write('\nPASS test-360-r3-suites.cjs (' + suitesToRun.length + ' suites)\n');
  process.exit(0);
}

main();
