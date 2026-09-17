#!/usr/bin/env node
/**
 * Phase 353 Plan 03 Task 3: the paired top-3 hit-rate measurement
 * (criterion 4, R-353-N).
 *
 * Gates RULE-24.
 *
 * The labeled turns at evals/icm/cases/turns.json were authored in Plan 01,
 * BEFORE data/section-command-ledger.json or any Jev-scored ranking existed
 * (see the file's own `_labeling_note`). Re-labeling them here, after the
 * ledger exists, would let a labeler unconsciously pick expected_commands
 * that flatter whichever ranking they had already seen -- the measurement
 * would no longer be honest evidence that the ledger helps. This test reads
 * the file; it never writes it.
 *
 * The shipped ledger at HEAD is the offline seed (`build_mode:
 * "offline-seed"`, every candidate `confidence: null`): this run is a
 * ground-truth-ordering measurement (does the ledger's contract-derived
 * candidate list beat the sensor's neutral base order), not a vendor-scored
 * one. Criterion 4 asks for both numbers, not for a vendor call, so this leg
 * runs unconditionally rather than skipping.
 *
 * No vendor call, no db write, no network.
 *
 * House rule: hyphens only, no em-dashes.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const PRODUCER_PATH = path.join(REPO, 'lib', 'core', 'section-ruling-candidates.cjs');
const TURNS_PATH = path.join(REPO, 'evals', 'icm', 'cases', 'turns.json');
const LEDGER_PATH = path.join(REPO, 'data', 'section-command-ledger.json');

if (!fs.existsSync(PRODUCER_PATH)) {
  console.error('RED: missing lib/core/section-ruling-candidates.cjs');
  process.exit(1);
}

let producer; let ranker; let sectionRegistry;
try {
  producer = require(PRODUCER_PATH);
  ranker = require(path.join(REPO, 'lib', 'workflow', 'f-selector-ranker.cjs'));
  sectionRegistry = require(path.join(REPO, 'lib', 'core', 'section-registry.cjs'));
} catch (e) {
  console.error('RED: a required module failed to load -- ' + (e && e.message));
  process.exit(1);
}

let PASS = 0;
let FAIL = 0;
function check(label, cond) {
  if (cond) { PASS += 1; console.log('PASS: ' + label); }
  else { FAIL += 1; console.log('FAIL: ' + label); }
}

const turnsRaw = JSON.parse(fs.readFileSync(TURNS_PATH, 'utf8'));
check('turns.json carries the _labeling_note honesty condition', typeof turnsRaw._labeling_note === 'string' && turnsRaw._labeling_note.length > 0);

let ledger = null;
try { ledger = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8')); } catch (_e) { ledger = null; }
console.log('build_mode: ' + (ledger && ledger.build_mode) + ' (offline-seed = a ground-truth-ordering measurement, not vendor-scored)');

const turns = Array.isArray(turnsRaw.turns) ? turnsRaw.turns : [];
check('at least one labeled turn to measure', turns.length > 0);

function topCommandSet(rankResult) {
  return new Set((rankResult || []).map((r) => r.command));
}

function isHit(turn, resultSet) {
  return turn.expected_commands.some((ec) => resultSet.has('/' + ec));
}

producer.__resetLedgerCache();
ranker._test._resetCaches();

let baselineHits = 0;
let withLedgerHits = 0;
let measured = 0;

for (const turn of turns) {
  const canonRow = sectionRegistry.getSectionJob(turn.section);
  const jobId = canonRow && canonRow.job_id ? canonRow.job_id : null;
  if (!jobId) { console.log('skip (no canon job for section ' + turn.section + '): ' + turn.id); continue; }
  measured += 1;

  const baselineResult = ranker.rankForSelector({ k: 3 });
  const baselineTop = topCommandSet(baselineResult);
  if (isHit(turn, baselineTop)) baselineHits += 1;

  const candidates = producer.buildLedgerCandidates({ jobId: jobId, problemType: turn.problem_type, stage: turn.stage });
  const withLedgerResult = ranker.rankForSelector(candidates ? { k: 3, tierCandidates: candidates } : { k: 3 });
  const withLedgerTop = topCommandSet(withLedgerResult);
  if (isHit(turn, withLedgerTop)) withLedgerHits += 1;
}

check('every turn resolved to a known canon job', measured === turns.length);

const baselineRate = measured > 0 ? baselineHits / measured : 0;
const withLedgerRate = measured > 0 ? withLedgerHits / measured : 0;
const delta = withLedgerRate - baselineRate;

console.log('baseline top-3 hit rate: ' + baselineRate.toFixed(3));
console.log('with-ledger top-3 hit rate: ' + withLedgerRate.toFixed(3));
console.log('delta: ' + delta.toFixed(3));

// R-353-N / T-353-24: a regression is a finding, never tuned away by
// loosening this assertion or re-labeling a turn.
check('withLedger >= baseline (a regression would be reported, never tuned away)', withLedgerRate >= baselineRate - 1e-9);

console.log('');
console.log('PASS=' + PASS + ' FAIL=' + FAIL);
process.exit(FAIL === 0 ? 0 : 1);
