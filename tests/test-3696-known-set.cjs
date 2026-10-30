#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 369.6 Plan 01 Task 3 (D-19; Codex C5). The exact failing-leg comparison of the phase suite.
 *
 *   K1  a run that fails with only its known legs and its known exit code is KNOWN
 *   K2  the same run plus one extra failing leg is FAILED, and the verdict names the extra leg
 *   K3  a non-zero exit with no failing-leg line is FAILED
 *   K4  exit 0 is PASSED and names the healed baseline legs
 *   K5  the same legs with a different exit code are FAILED
 *   K6  normalizeLeg replaces temporary paths, ISO timestamps, millisecond durations and pids, and nothing else
 *   K7  exit 77 is SKIPPED, never PASSED
 *   K8  a known leg that appears more often than the baseline holds is FAILED (the count is part of the set)
 *   K9  the CLI prints one verdict line and exits 0 for KNOWN and 1 for FAILED
 *   K10 bash tests/run-all-3696.sh --self-test exits 0: the aggregator's own run_baseline counts a known leg
 *       as KNOWN and the same leg plus one extra failing leg as FAILED
 *   K11 the recorded baseline: every entry has an exit code and a non-empty failing_legs list; every label is a file
 *   K12 the aggregator names at least 17 plain run legs for the phase test files (369.6-13: every planned leg landed, so the run_if
 *       legs are plain run legs) and has no run_known leg
 *   K13 no em dash or en dash in this file, the helper or the aggregator
 *
 * Hermetic: HOME, MINDRIAN_HOME, MINDRIAN_ROOMS_HOME, MINDRIAN_ROOMS_ROOT and CLAUDE_CONFIG_DIR are mkdtemp
 * dirs before any repo require.
 *
 * Output: one PASS or FAIL line per leg, then PASS: n FAIL: n. Exit 0 pass, 1 fail.
 * House rule: hyphens only.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const HOME_TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'test-3696-known-'));
['HOME', 'MINDRIAN_HOME', 'MINDRIAN_ROOMS_HOME', 'MINDRIAN_ROOMS_ROOT', 'CLAUDE_CONFIG_DIR'].forEach(function (k) {
  const d = path.join(HOME_TMP, k.toLowerCase());
  fs.mkdirSync(d, { recursive: true });
  process.env[k] = d;
});
process.env.USERPROFILE = process.env.HOME;

const { installNetGuard, makeChecker } = require('./helpers/hygiene-355.cjs');
const NET = installNetGuard();
const { check, summary } = makeChecker('test-3696-known-set');

const ROOT = path.resolve(__dirname, '..');
const HELPER = path.join(ROOT, 'tests', 'helpers', 'known-failures-3696.cjs');
const AGG = path.join(ROOT, 'tests', 'run-all-3696.sh');
const BASELINE = path.join(ROOT, 'tests', 'fixtures', '3696-known-failures.json');
const h = require(HELPER);

const entry = { exit_code: 1, fail_pattern: '^\\s*(FAIL|not ok)\\b', failing_legs: ['FAIL: leg one', '  FAIL  leg two'] };
const knownOut = 'ok  leg zero\nFAIL: leg one\n  FAIL  leg two\n1 failed\n';

// K1
const k1 = h.compareFailureSet({ output: knownOut, exitCode: 1, entry: entry });
check('K1 known legs and known exit code are KNOWN', k1.verdict === 'KNOWN' && k1.new_legs.length === 0, JSON.stringify(k1));

// K2
const k2 = h.compareFailureSet({ output: knownOut + 'FAIL: leg three\n', exitCode: 1, entry: entry });
check('K2 a known leg plus one extra failing leg is FAILED and names the extra leg',
  k2.verdict === 'FAILED' && k2.new_legs.length === 1 && k2.new_legs[0] === 'FAIL: leg three', JSON.stringify(k2));

// K3
const k3 = h.compareFailureSet({ output: 'something went wrong\nstack trace\n', exitCode: 1, entry: entry });
check('K3 non-zero exit with no failing-leg line is FAILED', k3.verdict === 'FAILED' && /no failing-leg line/.test(k3.reason), JSON.stringify(k3));

// K4
const k4 = h.compareFailureSet({ output: 'ok  all\n', exitCode: 0, entry: entry });
check('K4 exit 0 is PASSED and names the healed baseline legs', k4.verdict === 'PASSED' && k4.healed_legs.length === 2, JSON.stringify(k4));
const k4b = h.compareFailureSet({ output: 'ok  all\n', exitCode: 0, entry: undefined });
check('K4b exit 0 with no baseline entry is PASSED', k4b.verdict === 'PASSED' && k4b.healed_legs.length === 0);

// K5
const k5 = h.compareFailureSet({ output: knownOut, exitCode: 2, entry: entry });
check('K5 a different exit code is FAILED', k5.verdict === 'FAILED' && /differs from the baseline/.test(k5.reason), JSON.stringify(k5));

// K6
const a = h.normalizeLeg('  FAIL: wrote /tmp/tmp.Ab12Cd/out.json at 2026-10-29T10:00:00.123Z in 123ms pid 4242  ');
const b = h.normalizeLeg('FAIL: wrote /tmp/test-3696-zzzz99/out.json at 2027-01-01T01:02:03Z in 9ms pid 77');
check('K6 temporary paths, ISO timestamps, durations and pids normalize to fixed tokens', a === b && a.indexOf('<TMP>') !== -1 && a.indexOf('<TS>') !== -1 && a.indexOf('<MS>') !== -1, a + ' | ' + b);
check('K6b every other character is compared exactly', h.normalizeLeg('FAIL: x') !== h.normalizeLeg('FAIL: y') && h.normalizeLeg('FAIL:  x') === h.normalizeLeg('FAIL: x'));
const k6c = h.compareFailureSet({ output: 'FAIL: wrote /tmp/tmp.QQ99/out.json at 2030-01-01T00:00:00Z\n', exitCode: 1,
  entry: { exit_code: 1, failing_legs: ['FAIL: wrote /tmp/tmp.ZZ11/out.json at 2026-10-29T10:00:00Z'] } });
check('K6c a run-specific path and timestamp do not make a known leg new', k6c.verdict === 'KNOWN', JSON.stringify(k6c));

// K7
check('K7 exit 77 is SKIPPED, never PASSED', h.compareFailureSet({ output: '', exitCode: 77, entry: entry }).verdict === 'SKIPPED');

// K8
const k8 = h.compareFailureSet({ output: 'FAIL: leg one\nFAIL: leg one\n', exitCode: 1, entry: { exit_code: 1, failing_legs: ['FAIL: leg one'] } });
check('K8 a known leg repeated beyond the baseline count is FAILED', k8.verdict === 'FAILED' && k8.new_legs.length === 1, JSON.stringify(k8));

// K9
const tmpBase = path.join(HOME_TMP, 'fake-baseline.json');
fs.writeFileSync(tmpBase, JSON.stringify({ recorded_at: 'test', entries: { fake: entry } }));
function cli(out, code) {
  return cp.spawnSync(process.execPath, [HELPER, '--label', 'fake', '--exit', String(code), '--baseline', tmpBase], { input: out, encoding: 'utf8', env: process.env });
}
const c1 = cli(knownOut, 1);
check('K9 CLI: known output prints a KNOWN verdict line and exits 0', c1.status === 0 && /^VERDICT: KNOWN fake/.test(c1.stdout), c1.stdout);
const c2 = cli(knownOut + 'FAIL: leg three\n', 1);
check('K9b CLI: an extra leg prints FAILED, names the leg and exits 1', c2.status === 1 && /^VERDICT: FAILED fake/.test(c2.stdout) && c2.stdout.indexOf('new leg: FAIL: leg three') !== -1, c2.stdout);
const c3 = cp.spawnSync(process.execPath, [HELPER, '--label', 'absent', '--exit', '1', '--baseline', tmpBase], { input: 'FAIL: x\n', encoding: 'utf8', env: process.env });
check('K9c CLI: a failing test with no baseline entry is FAILED', c3.status === 1 && /no baseline entry/.test(c3.stdout), c3.stdout);

// K10
const st = cp.spawnSync('bash', [AGG, '--self-test'], { cwd: ROOT, encoding: 'utf8', env: process.env, timeout: 120000 });
check('K10 bash tests/run-all-3696.sh --self-test exits 0 (the aggregator counts known as KNOWN and known plus extra as FAILED)',
  st.status === 0, String(st.stdout).split('\n').slice(-8).join(' | ') + String(st.stderr).slice(0, 200));

// K11
const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
const labels = Object.keys(baseline.entries || {});
check('K11 the baseline records the plan base', typeof baseline.recorded_at === 'string' && baseline.recorded_at.length > 0);
check('K11b every entry has a numeric exit code, a command and a non-empty failing_legs list',
  labels.length > 0 && labels.every(function (l) {
    const e = baseline.entries[l];
    return typeof e.exit_code === 'number' && e.exit_code !== 0 && typeof e.command === 'string' && Array.isArray(e.failing_legs) && e.failing_legs.length > 0;
  }));
check('K11c every baseline label names an existing test file', labels.every(function (l) { return fs.existsSync(path.join(ROOT, l)); }));
const named = ['tests/test-card-fire-relevance-gate.cjs', 'tests/test-hmi-compliance-e2e.cjs', 'tests/test-mux-card-before-answer.cjs'];
check('K11d the three pre-existing reds named by the plan are in the baseline', named.every(function (n) { return labels.indexOf(n) !== -1; }), labels.join(','));

// K12
const aggText = fs.readFileSync(AGG, 'utf8');
const phaseLegCount = (aggText.match(/^run "[^"]*" +node tests\/test-3696-[a-z-]+\.cjs$/gm) || []).length;
check('K12 the aggregator names at least 17 plain run legs for the phase test files, and no run_if leg is left', phaseLegCount >= 17 && !/^run_if "/m.test(aggText), String(phaseLegCount));
check('K12b the aggregator has no run_known leg', !/run_known/.test(aggText));
const planned = ['measure-voice', 'reply-checks', 'isolation', 'rubric-eval', 'identity-parity', 'persona-drift', 'holds-by', 'voice-first-budget',
  'skill-budget', 'doctrine-presence', 'rubric-glyph-consistency', 'mod-voice', 'one-next-move', 'operation-doctrine', 'operation-probe',
  'voice-log-denominator', 'voice-reminder'];
check('K12c every planned 3696 test file is named by a run leg',
  planned.every(function (p) { return aggText.indexOf('tests/test-3696-' + p + '.cjs') !== -1; }));

// K13
const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);
[__filename, HELPER, AGG].forEach(function (f) {
  const t = fs.readFileSync(f, 'utf8');
  check('K13 no em dash or en dash in ' + path.basename(f), t.indexOf(EM) === -1 && t.indexOf(EN) === -1);
});
check('K14 no network call', NET.attempts() === 0);

try { fs.rmSync(HOME_TMP, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
process.exit(summary());
