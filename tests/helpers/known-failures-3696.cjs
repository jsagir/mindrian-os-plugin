#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 369.6 Plan 01 Task 3 (D-19; Codex C5). The exact failing-leg comparison of the phase suite.
 *
 * WHY: tests/run-all-3692.sh run_known passes a red test when ONE signature substring appears in its output.
 * A new failing leg that appears beside the known one is then invisible. This helper compares the exact set of
 * failing legs of a test run with the set recorded at the plan base in tests/fixtures/3696-known-failures.json.
 *
 * Verdicts:
 *   PASSED   the run exited 0 (legs the baseline held are named as healed)
 *   KNOWN    the exit code equals the baseline exit code and every failing leg of the run is in the baseline
 *   FAILED   any failing leg is not in the baseline, the exit code differs from the baseline, the run exited
 *            non-zero with no failing-leg line, or the test has no baseline entry
 *   SKIPPED  the run exited 77 (environment gap); never counted as PASSED
 *
 * Pure functions: extractFailingLegs, normalizeLeg, compareFailureSet. CLI: reads the run output on stdin.
 *   node tests/helpers/known-failures-3696.cjs --label <l> --exit <code> --baseline <file> < output
 * It prints one verdict line, exits 0 for PASSED, KNOWN or SKIPPED, and 1 for FAILED.
 *
 * A baseline entry changes only in a reviewed diff with a dated note that names the old and new lines and the
 * reason. A new leg is a new failure (D-19). Never widen an entry by hand to turn a red suite green.
 *
 * House rule: hyphens only.
 */

const fs = require('node:fs');

const DEFAULT_FAIL_PATTERN = '^\\s*(FAIL|not ok)\\b';

// Fixed tokens replace only the parts of a leg line that change from run to run.
const TMP_PATH = /(?:\/private)?(?:\/tmp|\/var\/folders\/[^\s]*?\/T|\/var\/tmp)\/[^\s'")\]},;]+/g;
const ISO_TS = /\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?\b/g;
const MS_DURATION = /\b\d+(?:\.\d+)?\s?ms\b/g;
const PID = /\bpid[ =:#]*\d+\b/gi;

function normalizeLeg(line) {
  return String(line)
    .replace(TMP_PATH, '<TMP>')
    .replace(ISO_TS, '<TS>')
    .replace(MS_DURATION, '<MS>')
    .replace(PID, 'pid <PID>')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractFailingLegs(output, failPattern) {
  const re = new RegExp(failPattern || DEFAULT_FAIL_PATTERN);
  return String(output).split('\n')
    .filter(function (l) { return re.test(l); })
    .map(normalizeLeg);
}

function countMap(list) {
  const m = new Map();
  list.forEach(function (l) { m.set(l, (m.get(l) || 0) + 1); });
  return m;
}

/*
 * compareFailureSet({ output, exitCode, entry }) -> { verdict, new_legs, healed_legs, reason }
 * entry is the baseline entry { exit_code, fail_pattern, failing_legs } or undefined.
 */
function compareFailureSet(args) {
  const output = args.output;
  const exitCode = Number(args.exitCode);
  const entry = args.entry;
  const baselineLegs = entry && Array.isArray(entry.failing_legs) ? entry.failing_legs.map(normalizeLeg) : [];
  if (exitCode === 77) return { verdict: 'SKIPPED', new_legs: [], healed_legs: [], reason: 'exit 77 (environment gap)' };
  if (exitCode === 0) {
    return { verdict: 'PASSED', new_legs: [], healed_legs: Array.from(new Set(baselineLegs)), reason: baselineLegs.length ? 'baseline legs healed' : '' };
  }
  if (!entry) return { verdict: 'FAILED', new_legs: [], healed_legs: [], reason: 'no baseline entry for a failing test' };
  const legs = extractFailingLegs(output, entry.fail_pattern);
  if (legs.length === 0) return { verdict: 'FAILED', new_legs: [], healed_legs: [], reason: 'non-zero exit with no failing-leg line' };
  const have = countMap(legs);
  const want = countMap(baselineLegs);
  const newLegs = [];
  have.forEach(function (n, leg) {
    const extra = n - (want.get(leg) || 0);
    for (let i = 0; i < extra; i += 1) newLegs.push(leg);
  });
  const healed = [];
  want.forEach(function (n, leg) { if (!have.has(leg)) healed.push(leg); });
  if (exitCode !== Number(entry.exit_code)) {
    return { verdict: 'FAILED', new_legs: newLegs, healed_legs: healed, reason: 'exit code ' + exitCode + ' differs from the baseline ' + entry.exit_code };
  }
  if (newLegs.length) return { verdict: 'FAILED', new_legs: newLegs, healed_legs: healed, reason: 'new failing leg' };
  return { verdict: 'KNOWN', new_legs: [], healed_legs: healed, reason: have.size + ' known failing leg(s)' };
}

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) { o[argv[i].slice(2)] = argv[i + 1]; i += 1; }
  }
  return o;
}

function main() {
  const a = parseArgs(process.argv.slice(2));
  const chunks = [];
  process.stdin.on('data', function (d) { chunks.push(d); });
  process.stdin.on('end', function () {
    let baseline = { entries: {} };
    try { baseline = JSON.parse(fs.readFileSync(a.baseline, 'utf8')); } catch (_e) { /* no baseline file: every failing test FAILS */ }
    const entry = baseline.entries ? baseline.entries[a.label] : undefined;
    const r = compareFailureSet({ output: Buffer.concat(chunks).toString('utf8'), exitCode: a.exit, entry: entry });
    let line = 'VERDICT: ' + r.verdict + ' ' + a.label + ' (' + r.reason + ')';
    if (r.new_legs.length) line += '\n  new leg: ' + r.new_legs.join('\n  new leg: ');
    if (r.healed_legs.length && r.verdict !== 'FAILED') line += '\n  healed leg count: ' + r.healed_legs.length;
    process.stdout.write(line + '\n');
    process.exit(r.verdict === 'FAILED' ? 1 : 0);
  });
}

module.exports = { extractFailingLegs, normalizeLeg, compareFailureSet, DEFAULT_FAIL_PATTERN };

if (require.main === module) main();
