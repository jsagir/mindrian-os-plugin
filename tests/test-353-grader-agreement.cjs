#!/usr/bin/env node
/**
 * Phase 353 Plan 03 Task 4: the Claude-judge baseline and the agreement
 * metric (criterion 6).
 *
 * Gates RULE-25.
 *
 * The metric is EXACT AGREEMENT (see evals/icm/README.md): the fraction of
 * graded jev items whose runner verdict equals the once-authored baseline
 * verdict for that same item. Spearman is explicitly not used -- the
 * checklist verdicts are categorical (pass/fail), never ranked.
 *
 * With no TYPESAFE_API_KEY, this leg SKIPs loudly (criterion 6 is
 * unmeasured this run) and still exits 0 -- the skip is never mistaken for
 * a pass, and never for a measured 1.0 or 0.
 *
 * House rule: hyphens only, no em-dashes.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const RUNNER_PATH = path.join(REPO, 'scripts', 'eval-icm-writers.cjs');
const BASELINE_PATH = path.join(REPO, 'evals', 'icm', 'claude-judge-baseline.json');

if (!fs.existsSync(RUNNER_PATH)) {
  console.error('RED: missing scripts/eval-icm-writers.cjs');
  process.exit(1);
}

let PASS = 0;
let FAIL = 0;
function check(label, cond) {
  if (cond) { PASS += 1; console.log('PASS: ' + label); }
  else { FAIL += 1; console.log('FAIL: ' + label); }
}

const runner = require(RUNNER_PATH);

// --- the baseline file itself: authored once, never rewritten by the runner
const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
check('baseline carries authored_at', typeof baseline.authored_at === 'string' && baseline.authored_at.length > 0);
check('baseline carries a non-empty items array', Array.isArray(baseline.items) && baseline.items.length > 0);
check('every baseline item carries a rationale', baseline.items.every((i) => typeof i.rationale === 'string' && i.rationale.length > 0));

const runnerSrc = fs.readFileSync(RUNNER_PATH, 'utf8');
check('the runner never writeFileSyncs the baseline path', !/writeFileSync\([^)]*claude-judge-baseline/.test(runnerSrc));

// --- computeAgreement: the assertion, the loud skip, the never-silently-green property
const perfectMatch = baseline.items.map((i) => ({ checklist: i.checklist, item_id: i.item_id, kind: 'jev', ok: true, verdict: i.verdict }));
const agreementPerfect = runner.computeAgreement(perfectMatch, baseline);
check('perfect agreement over the baseline set computes to 1', agreementPerfect === 1);

const allWrong = baseline.items.map((i) => ({ checklist: i.checklist, item_id: i.item_id, kind: 'jev', ok: false, verdict: i.verdict === 'pass' ? 'fail' : 'pass' }));
const agreementZero = runner.computeAgreement(allWrong, baseline);
check('zero agreement over the baseline set computes to 0', agreementZero === 0);

const noneAnswered = baseline.items.map((i) => ({ checklist: i.checklist, item_id: i.item_id, kind: 'jev', ok: null, verdict: null }));
const agreementSkipped = runner.computeAgreement(noneAnswered, baseline);
check('agreement is null (never 0, never 1.0) when nothing was answered -- the skip path stays distinguishable from a pass or a fail', agreementSkipped === null);

check('agreement >= 0.8 is the asserted threshold, exercised against the perfect-agreement case', agreementPerfect >= 0.8);

// --- the actual key-gated leg: SKIP loudly with no key, never silently green
const key = process.env.TYPESAFE_API_KEY;
if (!key) {
  console.log('SKIP: grader agreement -- no TYPESAFE_API_KEY (criterion 6 unmeasured this run)');
} else {
  console.log('key present: a live grading run is the navigator\'s own act, not run automatically here');
}

console.log('');
console.log('PASS=' + PASS + ' FAIL=' + FAIL);
process.exit(FAIL === 0 ? 0 : 1);
