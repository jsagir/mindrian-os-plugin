#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 215-05 -- the REPRODUCTION acceptance assertion.
 *
 * The single most load-bearing gate of the 212-215 Eureka arc: does the
 * AUTOMATED portfolio pipeline (scripts/eureka-portfolio-report.cjs, run LIVE
 * against the real 2117-tech jhtv-oliver-kuntz room) surface the TWO manually
 * drafted Opportunity Statements as scored, ranked, canonical candidates?
 *
 *   ACCEPTANCE PAIR 1 (arrhythmias):      {C16796, C03552}
 *   ACCEPTANCE PAIR 2 (cerebral aneurysm): {C16742, C05004}
 *
 * The two drafts (evals/eureka/opportunity-drafts/) were hand-built from the
 * CSVs because the automated tri-modal path was blocked when they were written
 * (embedding OOM + vec0 offline fail, jhtv-d15 section 2). Both blockers are
 * fixed on main (c222ff7d, 73698c73). This test proves the fix at 2117 scale by
 * requiring the pipeline to reproduce the two drafts automatically. A failure of
 * assertion 1 or 2 is the acceptance verdict "the pipeline does NOT reproduce the
 * manual drafts" -- it must NOT be papered over by weakening thresholds or
 * switching substrates.
 *
 * It reads the LIVE run's JSON sibling (Plan 05 Task 1 wrote it). Absent -> exit
 * 2 with a clear message so both the run-all-215 run_if guard and a direct
 * invocation stay honest.
 *
 * Pure CJS, node built-ins + the shipped opportunity-statement module (the
 * CLAUSE_LABELS single source of truth). ZERO network (Canon Part 8): this reads
 * a local JSON and a local module, nothing else. No em-dashes.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const JSON_PATH = path.join(REPO_ROOT, 'evals/eureka/215-jhtv-portfolio-report.json');

// The canonical clause markers -- the SINGLE source of truth (commit 360e4826).
// Require the module, never restring the clauses here.
const oppmod = require(path.join(REPO_ROOT, 'lib/core/eureka/opportunity-statement.cjs'));
const CLAUSE_LABELS = oppmod.CLAUSE_LABELS;

let PASS = 0;
let FAIL = 0;
function ok(cond, msg) {
  if (cond) { PASS += 1; } else { FAIL += 1; process.stderr.write('  FAIL: ' + msg + '\n'); }
}

// Unordered id-pair match.
function isPair(obj, x, y) {
  const a = obj && obj.a;
  const b = obj && obj.b;
  return (a === x && b === y) || (a === y && b === x);
}

// Find a candidate for an unordered pair in BOTH the ranked and the statements
// arrays (top-N or tail-ridden, either path counts by design).
function findRanked(j, x, y) {
  return (Array.isArray(j.ranked) ? j.ranked : []).find(function (r) { return isPair(r, x, y); }) || null;
}
function findStatement(j, x, y) {
  return (Array.isArray(j.statements) ? j.statements : []).find(function (s) { return isPair(s, x, y); }) || null;
}

// Extract the substring the assembler placed between two adjacent CLAUSE_LABELS
// markers -- the derived slot value. The text is assembled by interleaving the
// markers with the slots in fixed order, so slot k lives between marker k and
// marker k+1. Returns '' when the shape is broken.
function slotBetween(text, beforeIdx, afterIdx, fromPos) {
  const before = CLAUSE_LABELS[beforeIdx];
  const after = CLAUSE_LABELS[afterIdx];
  const start = text.indexOf(before, fromPos == null ? 0 : fromPos);
  if (start === -1) return { value: '', end: -1 };
  const valStart = start + before.length;
  const end = text.indexOf(after, valStart);
  if (end === -1) return { value: '', end: -1 };
  return { value: text.slice(valStart, end), end: end };
}

function everyMarkerPresent(text) {
  for (let i = 0; i < CLAUSE_LABELS.length; i += 1) {
    if (text.indexOf(CLAUSE_LABELS[i]) === -1) return false;
  }
  return true;
}

function criticHonest(st) {
  const critic = st.critic;
  // Either a real resolved verdict object, or the literal 'pending'.
  const isPending = critic === 'pending';
  const isVerdictObj = critic && typeof critic === 'object';
  if (!isPending && !isVerdictObj) return false;
  // Pitfall 4 invariant: when pending, banked must be false (never bank an
  // unverified Eureka).
  if (isPending && st.banked !== false) return false;
  return true;
}

function assertAcceptancePair(j, label, x, y) {
  process.stdout.write('\n=== ' + label + ': {' + x + ', ' + y + '} ===\n');
  const ranked = findRanked(j, x, y);
  const st = findStatement(j, x, y);

  // Assertion 1/2: the pair must appear as a STATEMENT candidate (top-N or tail).
  ok(st !== null, label + ' has an emitted Opportunity Statement candidate (found in j.statements)');
  if (ranked) {
    process.stdout.write('  ranked: rank ' + ranked.rank + ', score ' + Number(ranked.score).toFixed(3)
      + ', tail_flag ' + ranked.tail_flag + '\n');
  } else {
    process.stdout.write('  (not in the top-' + (j.ranked ? j.ranked.length : '?') + ' ranked slice; rides via the tail-candidate path)\n');
  }
  if (!st) return;

  // Assertion 3: EVERY CLAUSE_LABELS marker present (byte parity with canonical).
  ok(typeof st.text === 'string' && st.text.length > 0, label + ' statement carries non-empty text');
  ok(everyMarkerPresent(st.text || ''), label + ' statement text contains EVERY CLAUSE_LABELS marker');

  // Assertion 4a: unmet_need_a (slot 1, between markers 1 and 2) + unmet_need_b
  // (slot 3, between markers 3 and 4) are both non-empty. Extracted from the
  // canonical text via the single-source-of-truth markers, not restrung.
  const un1 = slotBetween(st.text || '', 1, 2, 0);
  const un2 = slotBetween(st.text || '', 3, 4, un1.end === -1 ? 0 : un1.end);
  ok(un1.value.trim().length > 0, label + ' fields.unmet_need_a is non-empty (' + JSON.stringify(un1.value.slice(0, 60)) + ')');
  ok(un2.value.trim().length > 0, label + ' fields.unmet_need_b is non-empty (' + JSON.stringify(un2.value.slice(0, 60)) + ')');

  // Assertion 4b: critic honesty invariant (Pitfall 4).
  ok(criticHonest(st), label + " critic is a real verdict object or 'pending' (and pending => banked false)");

  // Assertion 6: print the reproduced statement text for the navigator transcript.
  process.stdout.write('  --- reproduced statement text ---\n');
  process.stdout.write('  ' + String(st.text).replace(/\n/g, ' ') + '\n');
  process.stdout.write('  --- (banked: ' + st.banked + ', critic: '
    + (typeof st.critic === 'object' ? JSON.stringify(st.critic) : st.critic)
    + ', potential: ' + st.potential_tier + ') ---\n');
}

function main() {
  if (!fs.existsSync(JSON_PATH)) {
    process.stderr.write('reproduction: real-run JSON missing - run Plan 05 Task 1 first (' + JSON_PATH + ')\n');
    process.exit(2);
  }
  let j;
  try {
    j = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  } catch (e) {
    process.stderr.write('reproduction: real-run JSON is not parseable: ' + String(e && e.message ? e.message : e) + '\n');
    process.exit(2);
  }

  // Assertion 5: provenance -- LIVE run, full pairs mode, AHP CR <= 0.1.
  const p = j.provenance || {};
  ok(typeof p.run_mode === 'string' && /live/i.test(p.run_mode) && !/offline|stub/i.test(p.run_mode),
    "provenance run_mode is LIVE (got " + JSON.stringify(p.run_mode) + ")");
  ok(p.pairs_mode === 'full', "provenance pairs_mode is 'full' (got " + JSON.stringify(p.pairs_mode) + ")");
  ok(typeof p.ahp_cr === 'number' && p.ahp_cr <= 0.1, 'provenance AHP CR <= 0.1 (got ' + p.ahp_cr + ')');
  ok(p.encoder_unavailable !== true, 'provenance encoder_unavailable is not true (the live encoder ran)');

  // Assertions 1-4, 6 per acceptance pair.
  assertAcceptancePair(j, 'ACCEPTANCE PAIR 1 (arrhythmias)', 'C16796', 'C03552');
  assertAcceptancePair(j, 'ACCEPTANCE PAIR 2 (cerebral aneurysm)', 'C16742', 'C05004');

  process.stdout.write('\n');
  if (FAIL > 0) {
    process.stderr.write('test-215-reproduction: ' + FAIL + ' FAILED, ' + PASS + ' passed\n');
    process.stderr.write('ACCEPTANCE VERDICT: the automated pipeline did NOT fully reproduce the manual drafts.\n');
    process.exit(1);
  }
  process.stdout.write('test-215-reproduction: ' + PASS + ' assertions passed - both manual Opportunity Statements reproduced automatically.\n');
}

main();
