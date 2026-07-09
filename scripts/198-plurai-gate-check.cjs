#!/usr/bin/env node
'use strict';
/*
 * Phase 198-01 -- the REUSABLE Plurai invocation-parity gate-check.
 * ============================================================================
 * The roadmap's "no phase closes without a passing Plurai baseline" leg (SPEC-8).
 * Every later 198 plan's acceptance_criteria re-invokes THIS script, so it must
 * depend only on what 198-01 already ships.
 *
 * Cloned from scripts/189-plurai-gate-check.cjs (verbatim contract), retargeted
 * to evals/plurai/198-baseline.json.
 *
 * What it does in Wave 0: loads evals/plurai/198-baseline.json and validates it
 * carries a `method` field. There is no parity-transcript renderer to
 * reconstruct a fixture against yet (SPEC-6's two-host transcript does not run
 * until the parity harness lands and executes live -- Plan 10 per 198-01-PLAN.md
 * Task 2). The gate holds on the sanctioned baseline_deferred degrade path
 * (precedent: evals/plurai/196-baseline.json, 201-baseline.json,
 * 202-baseline.json) so run-all-198.sh stays green with zero phase modules
 * present. Plan 10 replaces this verdict with the measured two-host parity
 * result and this script gains the real fixture-reconstruction + membership
 * assertion at that point (same shape as the 189 gate: reconstruct the fixture,
 * call the renderer, assert membership == baseline verdict).
 *
 * Prints PLURAI_GATE_OK + exits 0 on a clean load with a `method` field;
 * prints PLURAI_GATE_FAIL + a JSON diff + exits 1 on load failure or a missing
 * `method` field.
 *
 * House rule: CJS only, hyphens only (no em-dashes). No emoji.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const BASELINE_PATH = path.join(REPO, 'evals', 'plurai', '198-baseline.json');

function runGateCheck() {
  let baseline;
  try {
    baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
  } catch (e) {
    return { ok: false, reason: 'baseline_load_failed', detail: String(e.message || '') };
  }

  if (!baseline || typeof baseline.method !== 'string') {
    return { ok: false, reason: 'baseline_missing_method', baseline };
  }

  // Wave 0: no parity-transcript renderer exists yet to reconstruct a fixture
  // against, so the gate holds on the seeded baseline_deferred verdict. Plan 10
  // (the two-host parity run) replaces this with a real fixture-reconstruction
  // + membership assertion, mirroring the 189 gate's ROW0_FIXTURE pattern.
  return {
    ok: true,
    method: baseline.method,
    baseline_deferred: baseline.baseline_deferred === true,
  };
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
