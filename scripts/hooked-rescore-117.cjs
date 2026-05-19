#!/usr/bin/env node
// Phase 121-01: repointed from per-event JSONL files to unified events-YYYY-WNN.jsonl stream.
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 117-05 Wave 3 -- REQ-117-12 Hooked Variable Reward rescore harness.
 *
 * Per CONTEXT.md AC5: at beta.3 release gate, Variable Reward axis must
 * measure 4/10 -> 7/10 progress. This harness is the infrastructure that
 * makes the rescore trivial: read auto_explore_* JSONL telemetry events,
 * compute Hooked (Eyal 2014) Variable Reward score, output markdown report.
 *
 * Manual invocation only (NEVER auto-fired from a hook):
 *   node scripts/hooked-rescore-117.cjs --since beta.2
 *
 * Outputs: docs/empathy-audit/auto-explore-117-rescore.md
 *
 * Pure CJS; node built-ins only; zero new dependencies.
 *
 * Per Canon Part 8: input is LOCAL JSONL (the unified events-YYYY-WNN.jsonl
 * stream produced by lib/core/telemetry/writer.cjs); output is LOCAL
 * markdown (docs/empathy-audit/); zero network surface.
 *
 * Phase 121-01 read-path repoint: previously read every *.jsonl under the
 * telemetry/v1.13/ directory and filtered by an event_type field (the
 * legacy schema). After Plan 121-01 the unified stream is the single
 * source-of-truth; this harness now globs events-YYYY-WNN.jsonl
 * (regex-anchored filename match) and filters by the canonical 'event'
 * field. Legacy mva.jsonl is retained as a parallel dual-write surface
 * during the migration window but is NOT read here -- the unified stream
 * is authoritative.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const TELEMETRY_DIR = process.env.MINDRIAN_TELEMETRY_OVERRIDE
  ? String(process.env.MINDRIAN_TELEMETRY_OVERRIDE)
  : path.join(os.homedir(), '.mindrian', 'telemetry', 'v1.13');
const OUTPUT_PATH = path.join(__dirname, '..', 'docs', 'empathy-audit', 'auto-explore-117-rescore.md');
// Phase 121-01: relevant events list expanded to cover both the legacy
// auto_explore_* event_type taxonomy (where present in older shards) AND
// the unified Phase 121 event types that Plan 121-02/121-03 will feed.
const RELEVANT_EVENTS = new Set([
  // Legacy auto-explore taxonomy (matched against event_type OR event):
  'auto_explore_fired',
  'auto_explore_finding_surfaced',
  'auto_explore_user_response',
  'auto_explore_skipped',
  // Phase 121 unified event names (matched against event):
  'auto_explore_decision',
  'selector_pick',
  'mva_option_selected',
  'breakthrough_dismissed',
]);

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { since: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--since' && args[i + 1]) { out.since = args[i + 1]; i++; }
  }
  return out;
}

// Phase 121-01: glob events-YYYY-WNN.jsonl filenames specifically. The
// regex anchors the match so unrelated *.jsonl shards (legacy
// per-event-type files like mva.jsonl, selector.jsonl) do not bleed in;
// the unified stream is the sole input.
function readUnifiedStreamEvents() {
  if (!fs.existsSync(TELEMETRY_DIR)) return [];
  let files;
  try {
    files = fs.readdirSync(TELEMETRY_DIR).filter(function(n) {
      return /^events-\d{4}-W\d{2}\.jsonl$/.test(n);
    });
  } catch (_e) {
    return [];
  }
  const events = [];
  for (const file of files) {
    const full = path.join(TELEMETRY_DIR, file);
    try {
      const raw = fs.readFileSync(full, 'utf8');
      const lines = raw.split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const evt = JSON.parse(line);
          // Honor both the legacy event_type field and the unified event field.
          const tag = evt.event || evt.event_type;
          if (tag && RELEVANT_EVENTS.has(tag)) {
            if (!evt.event_type) evt.event_type = tag; // back-compat for downstream consumers below
            events.push(evt);
          }
        } catch (_e) { /* skip corrupt */ }
      }
    } catch (_e) { /* skip unreadable */ }
  }
  return events;
}

// Backwards-compatible alias for any external invocation that may reach
// in via require(). Internal callers below use readUnifiedStreamEvents.
function readJsonlEvents() { return readUnifiedStreamEvents(); }

function computeVariableReward(events) {
  const fired = events.filter(function(e) { return e.event_type === 'auto_explore_fired'; }).length;
  const surfaced = events.filter(function(e) { return e.event_type === 'auto_explore_finding_surfaced'; }).length;
  const responses = events.filter(function(e) { return e.event_type === 'auto_explore_user_response'; });
  const respCounts = { EXPLORE: 0, SKIP: 0, LATER: 0, FREE_TEXT: 0 };
  const latencies = [];
  for (const r of responses) {
    if (respCounts[r.response] !== undefined) respCounts[r.response] += 1;
    if (Number.isFinite(r.latency_ms)) latencies.push(Number(r.latency_ms));
  }
  const totalResponses = responses.length || 1;
  const distributionWeight =
    (respCounts.EXPLORE * 1.0 + respCounts.LATER * 0.5 + respCounts.SKIP * 0.0) / totalResponses;
  latencies.sort(function(a, b) { return a - b; });
  const medianLatency = latencies.length > 0
    ? latencies[Math.floor(latencies.length / 2)]
    : 30000;
  const timeFactor = medianLatency < 30000 ? 1.0 : 0.7;
  // Variable Reward formula per Hooked (Eyal 2014) methodology:
  //   VR = surfaced * distribution_weight * time_factor
  // Map raw count to 0-10 axis: heuristic 5+ engaged surfaces = 7/10 baseline.
  const raw = surfaced * distributionWeight * timeFactor;
  const score = Math.min(10, Math.round(raw * 1.4 * 10) / 10);
  return {
    fired: fired,
    surfaced: surfaced,
    responses: respCounts,
    totalResponses: responses.length,
    medianLatency: medianLatency,
    distributionWeight: distributionWeight,
    timeFactor: timeFactor,
    score: score,
  };
}

function renderReport(metrics, since) {
  const lines = [
    '# Phase 117 Hooked Variable Reward Rescore',
    '',
    '> Generated: ' + new Date().toISOString(),
    '> Source: ' + TELEMETRY_DIR + '/*.jsonl' + (since ? ' (since ' + since + ')' : ''),
    '',
    '## Methodology',
    '',
    'Per Hooked (Eyal 2014) Variable Reward axis: surface novel findings with',
    'unpredictable user-engagement payoff. Phase 117 baseline 4/10; target 7/10',
    'measurable from auto_explore_* JSONL telemetry. Formula:',
    '',
    '    VR = surfaced * distribution_weight * time_factor',
    '    distribution_weight = (P(EXPLORE) * 1.0 + P(LATER) * 0.5 + P(SKIP) * 0.0)',
    '    time_factor = 1.0 if median_latency < 30s else 0.7',
    '',
    '## Aggregates',
    '',
    '| Metric | Value |',
    '|--------|-------|',
    '| Auto-fires | ' + metrics.fired + ' |',
    '| Findings surfaced | ' + metrics.surfaced + ' |',
    '| User responses (total) | ' + metrics.totalResponses + ' |',
    '| EXPLORE | ' + metrics.responses.EXPLORE + ' |',
    '| SKIP | ' + metrics.responses.SKIP + ' |',
    '| LATER | ' + metrics.responses.LATER + ' |',
    '| FREE_TEXT | ' + metrics.responses.FREE_TEXT + ' |',
    '| Median response latency (ms) | ' + metrics.medianLatency + ' |',
    '| Distribution weight | ' + metrics.distributionWeight.toFixed(3) + ' |',
    '| Time factor | ' + metrics.timeFactor.toFixed(2) + ' |',
    '',
    '## Variable Reward Score',
    '',
    '**' + metrics.score.toFixed(1) + ' / 10**',
    '',
    metrics.score >= 7.0
      ? 'TARGET MET (>= 7/10).'
      : 'TARGET NOT MET (< 7/10). Continue beta tuning.',
    '',
    '## Per-Event Counts',
    '',
    '- auto_explore_fired: ' + metrics.fired,
    '- auto_explore_finding_surfaced: ' + metrics.surfaced,
    '- auto_explore_user_response: ' + metrics.totalResponses,
    '',
    '## Recommendations',
    '',
  ];
  if (metrics.surfaced === 0) {
    lines.push('- Zero surfaces detected. Verify auto-explore-fingerprint hook fires on first-material upload.');
  }
  if (metrics.responses.SKIP > metrics.responses.EXPLORE) {
    lines.push('- SKIP rate exceeds EXPLORE rate; review BQ template tuning per Brain Section 8.5.');
  }
  if (metrics.medianLatency >= 30000) {
    lines.push('- Median response latency >= 30s; investigate F.1 surface friction (RECOMMENDED gate, copy length, persona suffix).');
  }
  if (metrics.surfaced > 0 && metrics.responses.EXPLORE > 0 && metrics.medianLatency < 30000) {
    lines.push('- Engagement healthy: surfaced findings receiving timely EXPLORE responses.');
  }
  lines.push('');
  return lines.join('\n');
}

function main() {
  const args = parseArgs();
  const events = readUnifiedStreamEvents();
  const metrics = computeVariableReward(events);
  const report = renderReport(metrics, args.since);
  try {
    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, report, 'utf8');
    process.stdout.write('Wrote ' + OUTPUT_PATH + ' (VR score ' + metrics.score.toFixed(1) + '/10)\n');
    process.exit(0);
  } catch (err) {
    process.stderr.write('FAIL: ' + ((err && err.message) || err) + '\n');
    process.exit(1);
  }
}

main();
