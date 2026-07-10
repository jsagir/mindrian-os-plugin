#!/usr/bin/env node
'use strict';
/*
 * Phase 198 -- the REUSABLE Plurai invocation-parity gate-check (SPEC-8).
 * ============================================================================
 * The roadmap's "no phase closes without a passing Plurai baseline" leg. Every
 * later 198 plan's acceptance_criteria re-invokes THIS script.
 *
 * Cloned from scripts/189-plurai-gate-check.cjs (same contract shape: reconstruct
 * the fixture, call the renderer, assert membership == baseline verdict).
 *
 * Wave 0 (198-01) seeded this on the sanctioned baseline_deferred degrade path
 * because the two-host parity transcript did not run until the harness landed.
 * Plan 198-10 (this) replaces that with the MEASURED baseline: it reconstructs
 * the CLI-leg governed transcript through tests/capture-198-parity-leg.cjs (the
 * same shipped MCP tool spine the daemon calls), normalizes it host-invariantly,
 * and asserts the produced (node label-set + edge set + gate sequence) matches
 * evals/plurai/198-baseline.json's expected_transcript -> verdict parity ==
 * baseline verdict_map["0"].
 *
 * Back-compat: if the loaded baseline still carries baseline_deferred:true (an
 * un-upgraded seed), the gate holds on the seeded verdict exactly as Wave 0 did,
 * so an older baseline never hard-fails this script.
 *
 * Prints PLURAI_GATE_OK + exits 0 on a matching verdict; prints PLURAI_GATE_FAIL
 * + a JSON diff + exits 1 on load failure or a parity mismatch.
 *
 * House rule: CJS only, hyphens only (no em-dashes). No emoji.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const BASELINE_PATH = path.join(REPO, 'evals', 'plurai', '198-baseline.json');

function normalizeSet(list, keyFn) {
  return (list || []).map(keyFn).sort();
}
function nodeKey(n) { return n.type + '|' + n.label; }
function edgeKey(e) { return e.source + '|' + e.target + '|' + e.type; }

async function runGateCheck() {
  let baseline;
  try {
    baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
  } catch (e) {
    return { ok: false, reason: 'baseline_load_failed', detail: String(e.message || '') };
  }

  if (!baseline || typeof baseline.method !== 'string') {
    return { ok: false, reason: 'baseline_missing_method', baseline };
  }

  // Back-compat: an un-upgraded baseline_deferred seed holds exactly as Wave 0.
  if (baseline.baseline_deferred === true) {
    return { ok: true, method: baseline.method, baseline_deferred: true };
  }

  // Measured path: reconstruct the CLI-leg governed transcript and assert it
  // matches the baseline's expected_transcript (membership == "parity").
  const expected = baseline.expected_transcript;
  if (!expected || !Array.isArray(expected.gate_sequence)) {
    return { ok: false, reason: 'baseline_missing_expected_transcript', baseline_method: baseline.method };
  }
  const verdictMap = baseline.verdict_map || {};
  const row0Verdict = verdictMap['0'];
  if (row0Verdict !== 'parity') {
    return { ok: false, reason: 'unexpected_baseline_verdict', expected: 'parity', got: row0Verdict };
  }

  const { captureLeg } = require(path.join(REPO, 'tests', 'capture-198-parity-leg.cjs'));
  const measured = await captureLeg('cli');

  const expNodes = normalizeSet(expected.nodes, nodeKey);
  const gotNodes = normalizeSet(measured.nodes, nodeKey);
  const expEdges = normalizeSet(expected.edges, edgeKey);
  const gotEdges = normalizeSet(measured.edges, edgeKey);
  const nodesMatch = JSON.stringify(expNodes) === JSON.stringify(gotNodes);
  const edgesMatch = JSON.stringify(expEdges) === JSON.stringify(gotEdges);
  const gatesMatch = JSON.stringify(expected.gate_sequence) === JSON.stringify(measured.gate_sequence);

  const computedParity = nodesMatch && edgesMatch && gatesMatch;
  if (!computedParity) {
    return {
      ok: false,
      reason: 'parity_mismatch',
      baseline_verdict: row0Verdict,
      nodes_match: nodesMatch,
      edges_match: edgesMatch,
      gates_match: gatesMatch,
      expected_gate_sequence: expected.gate_sequence,
      measured_gate_sequence: measured.gate_sequence,
      expected_nodes: expNodes,
      measured_nodes: gotNodes,
      expected_edges: expEdges,
      measured_edges: gotEdges,
    };
  }

  return { ok: true, method: baseline.method, verdict: 'parity', gate_sequence: measured.gate_sequence };
}

if (require.main === module) {
  runGateCheck().then((res) => {
    if (res.ok) {
      process.stdout.write('PLURAI_GATE_OK method=' + res.method + (res.verdict ? ' verdict=' + res.verdict : '') + '\n');
      process.exit(0);
    }
    process.stderr.write('PLURAI_GATE_FAIL ' + JSON.stringify(res) + '\n');
    process.exit(1);
  }).catch((e) => {
    process.stderr.write('PLURAI_GATE_FAIL ' + JSON.stringify({ ok: false, reason: 'exception', detail: String(e && e.stack || e) }) + '\n');
    process.exit(1);
  });
}

module.exports = { runGateCheck: runGateCheck };
