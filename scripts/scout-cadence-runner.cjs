#!/usr/bin/env node
'use strict';

/**
 * MindrianOS Plugin -- Scout Cadence Runner (Phase 145, SCHED-01 + SCHED-02)
 *
 * The single cadence entry point that composes the full scout suite behind a
 * LOCAL throttle + the Phase-140 safe-auto-fire guard. This is the WIRING layer
 * (Canon Part 7 reuse): it COMPOSES existing Phase-140-hardened scripts and the
 * existing whitespace / reverse-salient / opportunity surfaces. It builds NO new
 * sensor.
 *
 * Composed sensors (canonical scout.md order + the SCHED-02 four):
 *   1. sentinel-snapshot            (SENT-07; HARD-03 backup exclusion)
 *   2. sentinel-health-check        (SENT-01; HARD-01 arithmetic guard; exit CAPTURED)
 *   3. sentinel-deadline-monitor    (SENT-02; reads .planning/STATE.md)
 *   4. competitor-watch             (SCHED-02; emitted as a hat-scoped public-SIGNAL
 *                                    query plan -- the runner itself NEVER fetches)
 *   5. HSI-recompute                (compute-hsi.py -> detect-reverse-salients.py
 *                                    -> hsi-to-graph.cjs; D-03 exit not swallowed)
 *   6. whitespace recompute         (SCHED-02; compute-whitespace-gaps.py -> whitespace-to-graph.cjs)
 *   7. reverse-salient              (SCHED-02; part of the HSI step's detect-reverse-salients)
 *   8. opportunity-bank scan        (SCHED-02; compute-opportunity-state + opportunity-ops.listOpportunities)
 *   9. efficiency telemetry         (scout-telemetry-aggregator.cjs --json)
 *  10. temporal-blindness sentinel  (Phase 160-06 R12; D-04 scheduled backstop --
 *                                    PURE LOCAL room.db scan via sensorTemporalBlindness,
 *                                    NOT a fetch; emits temporal_blindness_surfaced)
 *
 * CANON PART 8 -- ZERO-EGRESS POSTURE (constitutional):
 *   The runner performs NO Brain query and NO web fetch. HSI / whitespace /
 *   reverse-salient / opportunity scans are all LOCAL compute. competitor-watch is
 *   emitted as a hat-scoped public-SIGNAL query plan (PUBLIC competitor names
 *   already present in competitive-analysis/) for the surface layer (LLM / Cowork)
 *   to execute -- no room artifact text enters the query, and the runner never
 *   carries user content to the Brain or the web. The throttle prevents a runaway
 *   that would hammer external APIs every session.
 *
 * Usage:
 *   node scout-cadence-runner.cjs <roomDir> [--interval-hours=N] [--force] [--json]
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const guard = require('./scout-cadence-guard.cjs');

const PLUGIN_ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// argv parsing (process.argv switch; no commander/yargs per CLAUDE.md)
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { roomDir: null, intervalHours: guard.DEFAULT_INTERVAL_HOURS, force: false, json: false };
  for (const raw of argv.slice(2)) {
    if (raw === '--force') { args.force = true; continue; }
    if (raw === '--json') { args.json = true; continue; }
    const m = raw.match(/^--interval-hours=(\d+(?:\.\d+)?)$/);
    if (m) { args.intervalHours = Number(m[1]); continue; }
    if (!raw.startsWith('--') && args.roomDir == null) { args.roomDir = raw; continue; }
  }
  return args;
}

// ---------------------------------------------------------------------------
// step runner: capture exit + stderr WITHOUT swallowing (scout.md D-03)
// ---------------------------------------------------------------------------

/**
 * Run a child step, capturing exit code and stderr. Never throws.
 * @param {string} name
 * @param {string} cmd
 * @param {string[]} cmdArgs
 * @returns {{ name: string, status: string, exit: number, stdout: string, stderr: string }}
 */
function runStep(name, cmd, cmdArgs) {
  try {
    const stdout = execFileSync(cmd, cmdArgs, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { name, status: 'ok', exit: 0, stdout: stdout || '', stderr: '' };
  } catch (e) {
    // execFileSync throws on non-zero exit; surface, do not swallow.
    const exit = typeof e.status === 'number' ? e.status : 1;
    const stderr = e.stderr ? String(e.stderr) : (e.message || '');
    const stdout = e.stdout ? String(e.stdout) : '';
    return { name, status: 'degraded', exit, stdout, stderr };
  }
}

// ---------------------------------------------------------------------------
// HSI dependency tier check (reuse scout.md Step 5a contract)
// ---------------------------------------------------------------------------

/**
 * @returns {{ available: boolean, tier: string }}
 */
function hsiDepsAvailable() {
  const script = path.join(PLUGIN_ROOT, 'scripts', 'check-hsi-deps');
  try {
    const out = execFileSync('bash', [script], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const tier = (out || '').trim();
    // check-hsi-deps prints tier:1 / tier:2 when sklearn present (exit 0).
    return { available: true, tier };
  } catch (e) {
    const tier = e.stdout ? String(e.stdout).trim() : 'tier:0';
    return { available: false, tier };
  }
}

// ---------------------------------------------------------------------------
// main cadence flow
// ---------------------------------------------------------------------------

function buildSummary(fields) {
  return {
    fired: false,
    throttled: false,
    interval_hours: null,
    next_eligible: null,
    steps: [],
    violations: [],
    signal_query_plan: null,
    findings_to_graph: [],
    notice: null,
    ...fields,
  };
}

function emit(summary, json) {
  if (json) {
    process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
    return;
  }
  const lines = [];
  lines.push('SCOUT CADENCE RUNNER');
  if (summary.notice) lines.push(`  notice: ${summary.notice}`);
  lines.push(`  fired: ${summary.fired}    throttled: ${summary.throttled}`);
  if (summary.next_eligible) lines.push(`  next eligible: ${summary.next_eligible}`);
  if (summary.steps.length) {
    lines.push('  steps:');
    for (const s of summary.steps) {
      lines.push(`    - ${s.name}: ${s.status} (exit ${s.exit})`);
    }
  }
  if (summary.signal_query_plan && summary.signal_query_plan.queries) {
    lines.push(`  competitor SIGNAL query plan: ${summary.signal_query_plan.queries.length} query(ies) for the surface layer`);
  } else if (summary.signal_query_plan && summary.signal_query_plan.insufficient) {
    lines.push(`  competitor SIGNAL: skipped (${summary.signal_query_plan.reason})`);
  }
  if (summary.violations.length) {
    lines.push('  PHASE-140 VIOLATIONS:');
    for (const v of summary.violations) lines.push(`    ! ${v}`);
  } else if (summary.fired) {
    lines.push('  Phase-140 invariants: clean (no violations)');
  }
  if (summary.findings_to_graph.length) {
    lines.push(`  findings to graph: ${summary.findings_to_graph.length}`);
  }
  process.stdout.write(lines.join('\n') + '\n');
}

function main(argv) {
  const args = parseArgs(argv);

  // (1) Resolve roomDir. Soft-fail when absent / not a dir -- this runs from a
  // hook; it must NEVER crash the host.
  if (!args.roomDir || !fs.existsSync(args.roomDir) || !fs.statSync(args.roomDir).isDirectory()) {
    const summary = buildSummary({
      notice: 'no room directory resolved; cadence skipped (non-fatal)',
      interval_hours: args.intervalHours,
    });
    emit(summary, args.json);
    return 0;
  }
  const roomDir = path.resolve(args.roomDir);
  const bin = (name) => path.join(PLUGIN_ROOT, 'scripts', name);

  // (2) Throttle gate.
  const gate = guard.shouldFire(roomDir, args.intervalHours);
  if (!gate.fire && !args.force) {
    const summary = buildSummary({
      throttled: true,
      interval_hours: gate.intervalHours,
      next_eligible: gate.nextEligible || null,
      notice: 'throttled; within the cadence interval, no sensor ran',
    });
    emit(summary, args.json);
    return 0;
  }

  // (3) Fire the suite in canonical scout.md order. Capture every exit.
  const steps = [];
  const findingsToGraph = [];

  // 1. snapshot (SENT-07)
  steps.push(runStep('sentinel-snapshot', 'bash', [bin('sentinel-snapshot'), roomDir]));

  // 2. health-check (SENT-01) -- exit CAPTURED for HARD-01 (not swallowed).
  const health = runStep('sentinel-health-check', 'bash', [bin('sentinel-health-check'), roomDir]);
  steps.push(health);

  // 3. deadline-monitor (SENT-02)
  steps.push(runStep('sentinel-deadline-monitor', 'bash', [bin('sentinel-deadline-monitor'), roomDir]));

  // 4. competitor-watch -- emit a hat-scoped public-SIGNAL query plan. The runner
  //    does NOT fetch; the surface layer executes the public web search. Zero egress.
  let signalQueryPlan = null;
  try {
    const scanner = require(path.join(PLUGIN_ROOT, 'lib', 'core', 'scheduled-scanner.cjs'));
    const plan = scanner.buildCompetitorQueries(roomDir);
    if (plan && plan.insufficient) {
      signalQueryPlan = { insufficient: true, reason: plan.reason, scope: 'public-signal' };
      steps.push({ name: 'competitor-watch', status: 'skipped', exit: 0, stdout: plan.reason, stderr: '' });
    } else {
      signalQueryPlan = { queries: plan.queries || [], competitors: plan.competitors || [], scope: 'public-signal' };
      steps.push({ name: 'competitor-watch', status: 'query-plan', exit: 0, stdout: `${signalQueryPlan.queries.length} SIGNAL query(ies)`, stderr: '' });
    }
  } catch (e) {
    steps.push({ name: 'competitor-watch', status: 'degraded', exit: 1, stdout: '', stderr: e.message || String(e) });
  }

  // 5 + 6 + 7. HSI-recompute (+ reverse-salient) + whitespace recompute.
  const deps = hsiDepsAvailable();
  if (!deps.available) {
    const note = `scikit-learn unavailable (${deps.tier}); HSI + whitespace Python steps skipped`;
    steps.push({ name: 'hsi-recompute', status: 'skipped', exit: 0, stdout: note, stderr: '' });
    steps.push({ name: 'detect-reverse-salients', status: 'skipped', exit: 0, stdout: note, stderr: '' });
    steps.push({ name: 'whitespace-recompute', status: 'skipped', exit: 0, stdout: note, stderr: '' });
  } else {
    // 5. compute-hsi.py -> output JSON
    steps.push(runStep('compute-hsi', 'python3', [bin('compute-hsi.py'), roomDir, '--output', path.join(roomDir, '.hsi-results.json')]));
    // 7. detect-reverse-salients.py
    steps.push(runStep('detect-reverse-salients', 'python3', [bin('detect-reverse-salients.py'), roomDir]));
    // 5c. hsi-to-graph.cjs -- D-03: surface a degraded advisory non-fatally.
    const hsiGraph = runStep('hsi-to-graph', 'node', [bin('hsi-to-graph.cjs'), roomDir]);
    if (hsiGraph.exit !== 0) {
      hsiGraph.advisory = 'HSI-to-graph step failed (room graph not updated this run); scout continues in degraded mode';
    } else {
      findingsToGraph.push('hsi-edges');
    }
    steps.push(hsiGraph);
    // 6. whitespace recompute: compute-whitespace-gaps.py -> whitespace-to-graph.cjs
    steps.push(runStep('compute-whitespace-gaps', 'python3', [bin('compute-whitespace-gaps.py'), roomDir]));
    const wsGraph = runStep('whitespace-to-graph', 'node', [bin('whitespace-to-graph.cjs'), roomDir]);
    if (wsGraph.exit === 0) findingsToGraph.push('whitespace-zones');
    steps.push(wsGraph);
  }

  // 8. opportunity-bank scan: compute-opportunity-state, then the Phase 219
  //    harvest producer (REQ-2). The old bare-count tally string is REPLACED:
  //    harvestCandidates scans room.db READ-ONLY for graph
  //    events (bridge/whitespace/contradiction/eureka_proposal/meeting_filing),
  //    scores them per the Q1..Q8 rubric, and writes the enum/handle-only
  //    .mindrian/last-opportunity-harvest.json side-channel SENS-14 reads.
  //    A producer failure DEGRADES the step (never kills the cadence, T-219-12).
  steps.push(runStep('compute-opportunity-state', 'bash', [bin('compute-opportunity-state'), roomDir]));
  try {
    const oppHarvest = require(path.join(PLUGIN_ROOT, 'lib', 'core', 'eureka', 'opportunity-harvest.cjs'));
    const harvested = oppHarvest.harvestCandidates(roomDir);
    if (harvested && harvested.ok === true) {
      const count = typeof harvested.count === 'number' ? harvested.count : 0;
      if (count > 0) findingsToGraph.push(`opportunity-harvest:${count}`);
      steps.push({
        name: 'opportunity-bank-scan',
        status: 'ok',
        exit: 0,
        stdout: `${count} scored candidate(s), top band ${harvested.top_band || 'none'}`,
        stderr: '',
      });
    } else {
      steps.push({ name: 'opportunity-bank-scan', status: 'degraded', exit: 1, stdout: '', stderr: (harvested && harvested.reason) || 'harvest failed' });
    }
  } catch (e) {
    steps.push({ name: 'opportunity-bank-scan', status: 'degraded', exit: 1, stdout: '', stderr: e.message || String(e) });
  }

  // 9. efficiency telemetry (LOCAL JSONL aggregation; zero network).
  steps.push(runStep('efficiency-telemetry', 'node', [bin('scout-telemetry-aggregator.cjs'), '--json']));

  // 10. temporal-blindness sentinel (Phase 160-06 R12; D-04 SCHEDULED backstop).
  //     A PURE LOCAL room.db scan -- NOT a fetch. The runner COMPOSES the shipped
  //     sensorTemporalBlindness (Canon Part 7 reuse); it surfaces real-world-event
  //     nodes whose valid_at IS NULL and emits temporal_blindness_surfaced when
  //     any surface (silent when none). The R11 gate is the front line; this is
  //     the standing backstop, fired on the cadence, never per-turn. Zero egress.
  try {
    const { openRoomDb, closeRoomDb } = require(path.join(PLUGIN_ROOT, 'lib', 'core', 'room-db.cjs'));
    const { sensorTemporalBlindness } = require(path.join(PLUGIN_ROOT, 'lib', 'core', 'sensors', 'sensor-temporal-blindness.cjs'));
    const sdb = openRoomDb(roomDir);
    try {
      const sentinel = sensorTemporalBlindness({ db: sdb });
      const c = sentinel && typeof sentinel.count === 'number' ? sentinel.count : 0;
      if (c > 0) findingsToGraph.push(`temporal-blindness:${c}`);
      steps.push({
        name: 'temporal-blindness-sentinel',
        status: 'ok',
        exit: 0,
        stdout: c > 0 ? `${c} undated real-world node(s) surfaced` : 'no undated real-world nodes',
        stderr: '',
      });
    } finally {
      closeRoomDb(sdb);
    }
  } catch (e) {
    steps.push({ name: 'temporal-blindness-sentinel', status: 'degraded', exit: 1, stdout: '', stderr: e.message || String(e) });
  }

  // (4) Phase-140 safe-auto-fire guard. Pass the captured health-check exit so
  //     HARD-01 is asserted from the real exit, not swallowed.
  const safe = guard.safeAutoFireCheck(roomDir, { healthCheckExit: health.exit });

  // (5) Arm the throttle for the next interval.
  guard.recordRun(roomDir);

  // (6) Structured summary.
  const summary = buildSummary({
    fired: true,
    throttled: false,
    interval_hours: gate.intervalHours,
    steps,
    violations: safe.violations,
    signal_query_plan: signalQueryPlan,
    findings_to_graph: findingsToGraph,
  });
  emit(summary, args.json);
  return 0;
}

if (require.main === module) {
  process.exit(main(process.argv));
}

module.exports = { main, parseArgs, runStep, hsiDepsAvailable };
