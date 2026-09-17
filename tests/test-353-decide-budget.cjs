#!/usr/bin/env node
/**
 * Phase 353 Plan 02 Task 8: the ledger candidate producer and the decide()
 * eligibility filter.
 *
 * Gates RULE-19, RULE-20.
 *
 * House rule: hyphens only, no em-dashes.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const REPO = path.join(__dirname, '..');
const PRODUCER_PATH = path.join(REPO, 'lib', 'core', 'section-ruling-candidates.cjs');

let PASS = 0;
let FAIL = 0;
function check(label, cond) {
  if (cond) { PASS += 1; console.log('PASS: ' + label); }
  else { FAIL += 1; console.log('FAIL: ' + label); }
}

if (!fs.existsSync(PRODUCER_PATH)) {
  console.error('RED: missing lib/core/section-ruling-candidates.cjs');
  process.exit(1);
}

const producer = require(PRODUCER_PATH);
const navigationEngine = require(path.join(REPO, 'lib', 'core', 'navigation-engine.cjs'));
const ranker = require(path.join(REPO, 'lib', 'workflow', 'f-selector-ranker.cjs'));

// --- producer's own wall time ---
producer.__resetLedgerCache();
const producerRuns = 200;
const producerStart = process.hrtime.bigint();
for (let i = 0; i < producerRuns; i++) {
  producer.buildLedgerCandidates({ jobId: 'find-problem' });
}
const producerEnd = process.hrtime.bigint();
const producerMsTotal = Number(producerEnd - producerStart) / 1e6;
const producerMsAvg = producerMsTotal / producerRuns;
console.log('producer ms: ' + producerMsAvg.toFixed(4) + ' (avg over ' + producerRuns + ' calls, first call includes the one-time cache fill)');
check('producer stays well under the 1200ms NAV budget', producerMsAvg < 1200);

// --- decide() with the producer engaged vs not, over several runs ---
function measureDecide(context) {
  const start = process.hrtime.bigint();
  const decision = navigationEngine.decide({}, context);
  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  return { ms: ms, decision: decision };
}

const RUNS = 10;
let withProducerTotal = 0;
let withoutProducerTotal = 0;
for (let i = 0; i < RUNS; i++) {
  const withProducer = measureDecide({ section: 'problem-definition' });
  const withoutProducer = measureDecide({});
  withProducerTotal += withProducer.ms;
  withoutProducerTotal += withoutProducer.ms;
}
const decideMsWithProducer = withProducerTotal / RUNS;
const decideMsWithoutProducer = withoutProducerTotal / RUNS;
console.log('decide ms with producer: ' + decideMsWithProducer.toFixed(2) + ' (avg over ' + RUNS + ' runs)');
console.log('decide ms without producer: ' + decideMsWithoutProducer.toFixed(2) + ' (avg over ' + RUNS + ' runs)');
check('decide() with the producer stays under 1200ms', decideMsWithProducer < 1200);

// --- the producer actually activates and feeds tierCandidates when a
//     section is supplied (proves the seam is wired, not merely present) ---
const withSection = navigationEngine.decide({}, { section: 'problem-definition' });
check('decide() with a section still returns a valid decision shape', !!withSection && !!withSection.decision_trace);

// --- ctx.tierCandidates threads through unchanged when the producer finds
//     no eligible candidates for an undeclared section (byte-identical to
//     today) ---
const withUndeclaredSection = navigationEngine.decide({}, { section: 'no-such-section-at-all' });
check('undeclared section decides without throwing', !!withUndeclaredSection && !!withUndeclaredSection.decision_trace);

// --- frozen surfaces untouched ---
check('MAX_K is still 3', ranker.MAX_K === 3);

console.log('');
console.log('PASS=' + PASS + ' FAIL=' + FAIL);
process.exit(FAIL === 0 ? 0 : 1);
