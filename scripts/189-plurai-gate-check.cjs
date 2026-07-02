#!/usr/bin/env node
'use strict';
/*
 * Phase 189-02 -- the REUSABLE Plurai baseline parity gate-check.
 * ============================================================================
 * The roadmap's "no phase closes without a passing Plurai baseline" leg. Every
 * later 189 plan's acceptance_criteria re-invokes THIS script (the phase-wide
 * Plurai eval GATE leg), so it must depend only on what 189-01/189-02 already ship.
 *
 * What it does: loads evals/plurai/189-baseline.json, reconstructs the SAME
 * candidate_set the baseline's row 0 encodes (two fixture candidates -- one >= 0.70
 * and one below), calls governance-candidate-raiser.renderGovernanceBasket on that
 * fixture set, and asserts the returned contract's PRE-CHECKED membership matches
 * the baseline verdict for that row (calibrated: the high-confidence candidate is
 * pre-checked, the low-confidence one is not). Prints PLURAI_GATE_OK + exits 0 on
 * match; prints a diff + exits 1 on mismatch.
 *
 * House rule: CJS only, hyphens only (no em-dashes). No emoji.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const BASELINE_PATH = path.join(REPO, 'evals', 'plurai', '189-baseline.json');

// The row-0 fixture the baseline CSV encodes (09-hitl-memory-governance-ranking.csv
// row 0): a claim at confidence 0.82 (>= 0.70) pre-checked, an assumption at 0.41
// (below 0.70) left off -> "calibrated". The candidate_id is a structural handle
// (Part-8-safe), never prose.
const ROW0_FIXTURE = [
  { candidate_id: 'claim:plurai-row0-a', kind: 'claim', confidence: 0.82 },
  { candidate_id: 'assumption:plurai-row0-b', kind: 'assumption', confidence: 0.41 },
];
const ROW0_HIGH = 'claim:plurai-row0-a';
const ROW0_LOW = 'assumption:plurai-row0-b';

function runGateCheck() {
  let baseline;
  try {
    baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
  } catch (e) {
    return { ok: false, reason: 'baseline_load_failed', detail: String(e.message || '') };
  }

  const verdictMap = (baseline && baseline.verdict_map) ? baseline.verdict_map : {};
  const row0Verdict = verdictMap['0'];
  if (row0Verdict !== 'calibrated') {
    return { ok: false, reason: 'unexpected_baseline_verdict', expected: 'calibrated', got: row0Verdict };
  }

  const raiser = require(path.join(REPO, 'lib', 'core', 'memory', 'governance-candidate-raiser.cjs'));
  const rendered = raiser.renderGovernanceBasket(ROW0_FIXTURE, {});
  const preChecked = (rendered && rendered.contract && Array.isArray(rendered.contract.preChecked))
    ? rendered.contract.preChecked
    : [];
  const preSet = new Set(preChecked);

  // Calibrated == the >=0.70 candidate is pre-checked AND the sub-0.70 one is not.
  const highChecked = preSet.has(ROW0_HIGH);
  const lowChecked = preSet.has(ROW0_LOW);
  const computedCalibrated = highChecked && !lowChecked;

  if (!computedCalibrated) {
    return {
      ok: false,
      reason: 'parity_mismatch',
      baseline_verdict: row0Verdict,
      high_pre_checked: highChecked,
      low_pre_checked: lowChecked,
      pre_checked: preChecked,
    };
  }

  return { ok: true, method: baseline.method || 'unknown', pre_checked: preChecked };
}

if (require.main === module) {
  const res = runGateCheck();
  if (res.ok) {
    process.stdout.write('PLURAI_GATE_OK method=' + res.method + '\n');
    process.exit(0);
  }
  process.stderr.write('PLURAI_GATE_FAIL ' + JSON.stringify(res) + '\n');
  process.exit(1);
}

module.exports = { runGateCheck: runGateCheck };
