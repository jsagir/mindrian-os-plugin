#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 132 release-gate runner -- verify-phase-132.cjs (RE-BASELINED).
 * ====================================================================
 * This is the Phase 132 RELEASE GATE. It MEASURES the dual-graph reformat by
 * INVOKING the Phase 130.7 CI dual-graph health gate -- it does NOT rebuild the
 * 4-metric health check (the CONTEXT scope fence: the gate is 130.7's; 132 is
 * MEASURED by it). The runner:
 *
 *   (1) Locates the Phase 130.7 health gate (scripts/check-dual-graph-health.cjs)
 *       and INVOKES its runCheck() -- parsing PASS/FAIL + the metric outcome.
 *       If the gate is NOT on disk, the runner returns a clear blocked-on-130.7
 *       status and FAILS CLOSED. It NEVER silently passes when the gate is absent.
 *       The metric thresholds + Cypher live ONLY in the 130.7 module; this runner
 *       carries none of them (grep-gated by the test).
 *
 *   (2) Runs the brain-boundary-scan over the new Phase 132 code paths (Canon
 *       Part 8). The repo-level check-brain-boundary tool is not yet scaffolded
 *       (CANON-PHASE-MAP Part 8 marks it pending), so the runner uses the
 *       structural-equivalent fallback the CONTEXT names: it requires every
 *       Phase 132 batch BUILDER present on disk and asserts
 *       scanBatchForUserContent returns [] for each. A new user-content egress in
 *       any phase-132 batch fails the gate.
 *
 *   (3) Prints a PASS/FAIL summary; main() exits non-zero on FAIL or blocked.
 *
 * FIXTURE MODE (the test path): the 130.7 gate is driven with a planted,
 * conclusive, no-regression metric reader + an in-memory baseline store, so the
 * gate logic is exercised without a live Brain. The default CLI path runs the
 * gate's own live reader (which fails-closed to inconclusive until its async
 * wiring lands, exactly as 130.7-03 shipped it) -- so a standalone run reports
 * blocked/inconclusive rather than fabricating a green.
 *
 * Zero new deps. CJS only. ZERO live Brain writes. No em-dashes.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

// The Phase 130.7 health gate this runner INVOKES (never rebuilds).
const HEALTH_GATE_PATH = path.join(REPO_ROOT, 'scripts', 'check-dual-graph-health.cjs');

// The curation-batch lib (the Part 8 scan chokepoint).
const batchLib = require('../lib/brain/curation-batch.cjs');

// The set of Phase 132 batch-BUILDER modules + the export names that return a
// makeBatch batch. The boundary scan requires each module PRESENT on disk and
// scans every builder it exports. Modules absent on disk (e.g. 132-02/132-04
// deferred in the re-baseline) are skipped gracefully -- the scan asserts over
// what the phase actually shipped, never silent-passing on the HEALTH gate.
const PHASE_132_BATCH_BUILDERS = [
  {
    module: path.join(REPO_ROOT, 'scripts', 'curation-132-03-dedup-held-rename.cjs'),
    builders: [
      { fn: 'buildDedupCollapsePass', args: function (m) { return [m.LIVE_DEDUP_GROUPS && m.LIVE_DEDUP_GROUPS.length ? withDegrees(m.LIVE_DEDUP_GROUPS) : DEFAULT_DEDUP_GROUPS, 1]; } },
      { fn: 'buildHeldRenamePass', args: function () { return [DEFAULT_HELD_NODES, 2]; } },
    ],
  },
  {
    module: path.join(REPO_ROOT, 'scripts', 'curation-132-05-pseudonymize.cjs'),
    builders: [
      { fn: 'buildPseudonymizeBatch', args: function () { return []; } },
    ],
  },
];

// Fixture group inputs for the dedup builder scan (the LIVE_DEDUP_GROUPS carry
// null edge_degree; pickCanonical needs a number, so supply degrees here -- the
// scan only cares the builder PRODUCES a Part 8-clean batch, not the live ids).
const DEFAULT_DEDUP_GROUPS = [
  {
    name: 'Boundary Scan Fixture', label: 'Technique',
    nodes: [
      { id: 1, name: 'Boundary Scan Fixture', labels: ['Technique'], edge_degree: 3 },
      { id: 2, name: 'Boundary Scan Fixture', labels: ['Technique'], edge_degree: 1 },
    ],
  },
];

const DEFAULT_HELD_NODES = [
  { id: 9001, label: 'Method', canonical_name: 'Boundary Scan Method' },
];

function withDegrees(groups) {
  return groups.map(function (g) {
    return Object.assign({}, g, {
      nodes: (g.nodes || []).map(function (n, i) {
        return Object.assign({}, n, { edge_degree: Number.isFinite(n.edge_degree) ? n.edge_degree : (g.nodes.length - i) });
      }),
    });
  });
}

// ---------------------------------------------------------------------------
// (2) brain-boundary-scan over the phase-132 batch builders (Part 8 fallback).
// ---------------------------------------------------------------------------

/**
 * runBrainBoundaryScan() -> { clean, scanned, violations }
 *
 * Requires each Phase 132 batch-builder module present on disk and runs
 * scanBatchForUserContent over every batch it builds. clean=true iff every
 * scanned batch returned []. Absent modules are skipped (not a failure: the
 * re-baseline deferred 132-02 + 132-04).
 *
 * @returns {{clean: boolean, scanned: Array, violations: Array}}
 */
function runBrainBoundaryScan() {
  const scanned = [];
  const violations = [];

  PHASE_132_BATCH_BUILDERS.forEach(function (spec) {
    if (!fs.existsSync(spec.module)) return; // deferred / not shipped -- skip.
    let mod;
    try { mod = require(spec.module); }
    catch (e) {
      violations.push({ module: spec.module, error: 'require_failed: ' + (e && e.message) });
      return;
    }
    spec.builders.forEach(function (b) {
      const fn = mod[b.fn];
      if (typeof fn !== 'function') return; // builder not exported -- skip.
      let batch;
      try { batch = fn.apply(null, b.args(mod)); }
      catch (e) {
        violations.push({ module: spec.module, builder: b.fn, error: 'build_failed: ' + (e && e.message) });
        return;
      }
      const found = batchLib.scanBatchForUserContent(batch);
      scanned.push({ module: path.basename(spec.module), builder: b.fn, clean: found.length === 0 });
      if (found.length > 0) {
        violations.push({ module: spec.module, builder: b.fn, found: found });
      }
    });
  });

  return { clean: violations.length === 0, scanned: scanned, violations: violations };
}

// ---------------------------------------------------------------------------
// (1) Invoke the Phase 130.7 health gate (never rebuild it).
// ---------------------------------------------------------------------------

// A planted, conclusive, no-regression metric set for the fixture path. The
// VALUES are illustrative fixtures; the THRESHOLDS + comparison logic live ONLY
// in the 130.7 gate (this runner just hands the gate a reader + a store).
function fixtureMetrics() {
  return {
    m1_min_cohort: 5,
    m2_review_required: 6,
    m3_no_fork: true,
    m3_raw_cross_label_dups: 1,
    m4_max_orphan_rate: 0.02,
  };
}

function fixtureReader(metrics) {
  return function () { return metrics; };
}

// An in-memory baseline store so the fixture run never touches the on-disk
// baseline (no LOCAL state mutation from a verification run).
function memStore(initial) {
  let cur = initial || null;
  return {
    load: function () { return cur; },
    save: function (obj) { cur = obj; return true; },
    _peek: function () { return cur; },
  };
}

/**
 * invokeHealthGate({ fixtureMode, gatePathOverride }) ->
 *   { invoked, outcome, pass, blockedReason }
 *
 * Requires the 130.7 gate module and calls its runCheck(). In fixtureMode the
 * gate is driven with a planted conclusive reader + an in-memory store seeded so
 * the outcome is a conclusive PASS (no_regression). When the gate module is
 * absent, returns invoked=false with a blocked-on-130.7 reason (fail-closed).
 *
 * @param {{fixtureMode?: boolean, gatePathOverride?: string}} [opts]
 */
function invokeHealthGate(opts) {
  const o = opts || {};
  const gatePath = o.gatePathOverride || HEALTH_GATE_PATH;

  if (!fs.existsSync(gatePath)) {
    return {
      invoked: false,
      outcome: 'blocked-on-130.7',
      pass: false,
      blockedReason: 'blocked-on-130.7: the health gate is not present at ' + gatePath,
    };
  }

  let gate;
  try { gate = require(gatePath); }
  catch (e) {
    return {
      invoked: false,
      outcome: 'blocked-on-130.7',
      pass: false,
      blockedReason: 'blocked-on-130.7: failed to load the health gate (' + (e && e.message) + ')',
    };
  }
  if (typeof gate.runCheck !== 'function') {
    return {
      invoked: false,
      outcome: 'blocked-on-130.7',
      pass: false,
      blockedReason: 'blocked-on-130.7: the health gate does not export runCheck',
    };
  }

  if (o.fixtureMode) {
    // Seed the in-memory store with the same metrics so the gate's baseline
    // comparison yields a conclusive no_regression PASS on the planted fixture.
    const seeded = { metrics: fixtureMetrics(), recorded_at: new Date().toISOString(), mode: 'baseline', version: 1 };
    const res = gate.runCheck({ reader: fixtureReader(fixtureMetrics()), store: memStore(seeded) });
    return {
      invoked: true,
      outcome: res.outcome,
      pass: res.exitCode === 0,
      regressions: res.regressions || [],
      metrics: res.metrics || null,
    };
  }

  // The default (non-fixture) path uses the gate's own live reader + file store.
  // It fails-closed to inconclusive until the gate's live async reader lands, so
  // a standalone verification never fabricates a green.
  let brainClient = null;
  try { brainClient = require('../lib/core/brain-client.cjs'); } catch (_e) { brainClient = null; }
  const res = gate.runCheck({ reader: gate.makeBrainReader(brainClient), store: gate.fileStore() });
  return {
    invoked: true,
    outcome: res.outcome,
    pass: res.exitCode === 0,
    regressions: res.regressions || [],
    metrics: res.metrics || null,
  };
}

// ---------------------------------------------------------------------------
// The release gate: health gate PASS + boundary-scan clean.
// ---------------------------------------------------------------------------

/**
 * runPhase132ReleaseGate({ fixtureMode, gatePathOverride }) -> result
 *
 * Combines (1) the invoked 130.7 health-gate outcome and (2) the brain-boundary
 * scan over the phase-132 batch builders. The release gate PASSES iff the health
 * gate reached a conclusive PASS (improvement / no-regression / baseline) AND the
 * boundary scan is clean. Any blocked / inconclusive / regression / boundary
 * violation FAILS the gate.
 *
 * @param {{fixtureMode?: boolean, gatePathOverride?: string}} [opts]
 * @returns {{pass:boolean, healthOutcome:string, healthInvoked:boolean,
 *            boundaryClean:boolean, blockedReason?:string, boundary:object}}
 */
function runPhase132ReleaseGate(opts) {
  const o = opts || {};
  const health = invokeHealthGate(o);
  const boundary = runBrainBoundaryScan();

  const pass = Boolean(health.pass) && boundary.clean === true;

  return {
    pass: pass,
    healthInvoked: health.invoked,
    healthOutcome: health.outcome,
    healthPass: Boolean(health.pass),
    healthRegressions: health.regressions || [],
    healthMetrics: health.metrics || null,
    boundaryClean: boundary.clean,
    boundary: boundary,
    blockedReason: health.blockedReason || null,
  };
}

// ---------------------------------------------------------------------------
// Report + CLI.
// ---------------------------------------------------------------------------

function renderReport(res) {
  const lines = [];
  lines.push('');
  lines.push('  PHASE 132 RELEASE GATE (invokes the 130.7 dual-graph health gate)');
  lines.push('  ' + '-'.repeat(64));
  lines.push('  130.7 health gate invoked: ' + res.healthInvoked);
  lines.push('  130.7 outcome:             ' + res.healthOutcome + (res.healthPass ? ' (PASS)' : ' (FAIL)'));
  if (res.blockedReason) lines.push('  ' + res.blockedReason);
  if ((res.healthRegressions || []).length > 0) {
    lines.push('  Regressions:');
    res.healthRegressions.forEach(function (r) {
      lines.push('    ' + r.metric + ': baseline=' + r.baseline + ' current=' + r.current);
    });
  }
  lines.push('  brain-boundary-scan clean: ' + res.boundaryClean +
    ' (' + (res.boundary.scanned || []).length + ' phase-132 batch builders scanned)');
  (res.boundary.scanned || []).forEach(function (s) {
    lines.push('    ' + s.module + '::' + s.builder + ' -> ' + (s.clean ? 'clean' : 'VIOLATION'));
  });
  (res.boundary.violations || []).forEach(function (v) {
    lines.push('    VIOLATION: ' + JSON.stringify(v));
  });
  lines.push('  ' + '-'.repeat(64));
  lines.push('  RELEASE GATE: ' + (res.pass ? 'PASS' : 'FAIL'));
  lines.push('');
  return lines.join('\n');
}

function main(argv) {
  const args = Array.isArray(argv) ? argv.slice(2) : [];
  const fixtureMode = args.indexOf('--fixture') !== -1;
  const res = runPhase132ReleaseGate({ fixtureMode: fixtureMode });
  process.stdout.write(renderReport(res) + '\n');
  process.exit(res.pass ? 0 : 1);
}

module.exports = {
  runPhase132ReleaseGate: runPhase132ReleaseGate,
  invokeHealthGate: invokeHealthGate,
  runBrainBoundaryScan: runBrainBoundaryScan,
  renderReport: renderReport,
  main: main,
  HEALTH_GATE_PATH: HEALTH_GATE_PATH,
};

if (require.main === module) {
  main(process.argv);
}
