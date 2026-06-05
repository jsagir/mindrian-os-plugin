#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88.1-16 -- /mos:scout telemetry aggregator.
 * ===================================================
 * Reads the query-efficiency JSONL at ~/.mindrian/telemetry/query-efficiency.jsonl,
 * aggregates events in a configurable window (default: last 7 days), and
 * renders a Shape E (Action Report) summary: median ratio, mean ratio,
 * top-5 commands by ratio, threshold status (PASS >= 40x, RETUNE < 40x).
 *
 * Invoked by the /mos:scout command as a subshell after the sentinel tasks
 * (see commands/scout.md). Also consumable from the CLI directly for debug:
 *
 *   node scripts/scout-telemetry-aggregator.cjs             # last 7 days
 *   node scripts/scout-telemetry-aggregator.cjs --days=30   # last 30 days
 *   node scripts/scout-telemetry-aggregator.cjs --all       # no window filter
 *   node scripts/scout-telemetry-aggregator.cjs --json      # machine-readable
 *   node scripts/scout-telemetry-aggregator.cjs --mos-only  # /mos: turns only
 *
 * D-01a (Phase 140-03): HARD-04 relaxed the telemetry gate to measure ALL
 * turns (not only /mos: command turns). That changes the DENOMINATOR the
 * published "up to 57x" efficiency claim was measured against (the claim was
 * /mos:-command-specific). --mos-only restricts the median/top-5/threshold
 * population to records whose command field starts with '/mos:', so the
 * published number stays measurable on its original population. The default
 * (no flag) reports the new all-turns denominator. Both views coexist; the
 * relaxed gate does not silently redefine the published number.
 *
 * Exit codes:
 *   0 -- rendered summary (even if no events; prints "no events in window")
 *   1 -- unexpected error (soft-fail is still preferred; exit 1 only on
 *         argv parse errors)
 *
 * Canon:
 *   Part 6 Product-as-Venture -- surfaces the release-gate signal. The
 *     threshold (>= 40x) gates v1.10.15 per CONTEXT criterion #15; below
 *     40x tells the release gate (Plan 88.1-11) to RETUNE README copy or
 *     fix the leaking command before shipping.
 *   Part 8 Graph Boundary -- aggregation is LOCAL-only. The JSONL lives
 *     under ~/.mindrian/, never egresses; this renderer adds zero network
 *     surface.
 *
 * Three-surface compatibility: invoked from a /mos:scout CLI shell step on
 * Claude Code; Desktop and Cowork surfaces that run the same command
 * inherit the same aggregation logic without surface-specific branches.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// ---------- Constants ----------

const DEFAULT_WINDOW_DAYS = 7;
const RELEASE_GATE_THRESHOLD_X = 40; // CONTEXT criterion #15 -- PASS bar.
const BELOW_EFFICIENCY_THRESHOLD_X = 10; // classifyRatio threshold.

// ---------- Argv parsing ----------

function parseArgv(argv) {
  const out = { days: DEFAULT_WINDOW_DAYS, all: false, json: false, mosOnly: false };
  for (const a of argv) {
    if (a === '--all') { out.all = true; continue; }
    if (a === '--json') { out.json = true; continue; }
    if (a === '--mos-only') { out.mosOnly = true; continue; }
    if (a.indexOf('--days=') === 0) {
      const n = parseInt(a.slice('--days='.length), 10);
      if (Number.isFinite(n) && n > 0) out.days = n;
      continue;
    }
    if (a === '--days') continue; // silently ignore bare --days
  }
  return out;
}

/**
 * D-01a command-population filter. When mosOnly is true, keep only records
 * whose command field starts with '/mos:' -- the population the published
 * "up to 57x" claim was defined against. The HARD-04 relaxation writes ''
 * (or null) command for non-/mos: turns, so those are excluded here. When
 * mosOnly is false, pass everything through (the relaxed all-turns
 * denominator). This is the only place the two populations diverge.
 */
function filterCommandPopulation(events, mosOnly) {
  if (!mosOnly) return events.slice();
  const out = [];
  for (const e of events) {
    const cmd = e && typeof e.command === 'string' ? e.command : '';
    if (cmd.indexOf('/mos:') === 0) out.push(e);
  }
  return out;
}

// ---------- JSONL reader ----------

function telemetryPath() {
  const home = process.env.HOME || os.homedir();
  if (!home) return null;
  return path.join(home, '.mindrian', 'telemetry', 'query-efficiency.jsonl');
}

/**
 * Parse every line of the JSONL. Each line is one event OR empty (trailing
 * newline). Lines that fail JSON.parse are silently dropped (defensive:
 * a partial write mid-append must not poison the aggregation).
 */
function readEvents(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return [];
  let raw;
  try { raw = fs.readFileSync(filePath, 'utf8'); }
  catch (_e) { return []; }
  const events = [];
  const lines = raw.split('\n');
  for (const line of lines) {
    if (!line || line.length === 0) continue;
    try {
      const obj = JSON.parse(line);
      if (obj && typeof obj === 'object') events.push(obj);
    } catch (_e) { /* skip corrupt line */ }
  }
  return events;
}

/**
 * Window-filter by ts (ISO-8601). Events with missing/unparseable ts
 * pass through if `all` is true; otherwise they are dropped (defensive:
 * an event without a timestamp cannot be placed in the window).
 */
function filterWindow(events, days, all) {
  if (all) return events.slice();
  const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
  const out = [];
  for (const e of events) {
    const ts = e && e.ts ? new Date(e.ts).getTime() : NaN;
    if (Number.isFinite(ts) && ts >= cutoff) out.push(e);
  }
  return out;
}

// ---------- Rendering ----------

function formatX(n) {
  if (n === null || n === undefined) return '--';
  if (!Number.isFinite(n)) return '--';
  // Use 2 decimals for clarity (aggregated ratios can be fractional).
  return n.toFixed(2) + 'x';
}

function thresholdStatus(median) {
  if (median === null || median === undefined || !Number.isFinite(median)) {
    return 'NO_DATA';
  }
  if (median >= RELEASE_GATE_THRESHOLD_X) return 'PASS';
  return 'RETUNE';
}

function renderHuman(agg, opts) {
  const windowLabel = opts.all
    ? 'all-time'
    : 'last ' + opts.days + ' day' + (opts.days === 1 ? '' : 's');

  const populationLabel = opts.mosOnly
    ? '/mos: turns only'
    : 'all turns';

  const lines = [];
  lines.push('query efficiency telemetry summary (' + windowLabel +
    ', ' + populationLabel + ')');

  if (agg.count === 0) {
    lines.push('  events: 0');
    lines.push('  no events in window yet. Run a /mos:* query first.');
    lines.push('  threshold status: NO_DATA');
    return lines.join('\n');
  }

  lines.push('  events: ' + agg.count);
  lines.push('  median ratio: ' + formatX(agg.median));
  lines.push('  mean ratio:   ' + formatX(agg.mean));
  lines.push('  top 5 commands by ratio:');
  if (agg.top5.length === 0) {
    lines.push('    (no commands with valid ratio)');
  } else {
    for (let i = 0; i < agg.top5.length; i += 1) {
      const row = agg.top5[i];
      lines.push('    ' + (i + 1) + '. ' + row.command + ' -- ' + formatX(row.ratio));
    }
  }

  const status = thresholdStatus(agg.median);
  const statusLabel = status === 'PASS'
    ? 'PASS (median >= ' + RELEASE_GATE_THRESHOLD_X + 'x)'
    : status === 'RETUNE'
      ? 'RETUNE (median < ' + RELEASE_GATE_THRESHOLD_X + 'x)'
      : 'NO_DATA';
  lines.push('  threshold status: ' + statusLabel);

  // Surface below-efficiency-threshold leakage count for release visibility.
  const leakers = agg.top5.filter(function (r) {
    return r.ratio < BELOW_EFFICIENCY_THRESHOLD_X;
  }).length;
  if (leakers > 0) {
    lines.push('  NOTE: ' + leakers + ' top-5 command' + (leakers === 1 ? '' : 's') +
      ' below ' + BELOW_EFFICIENCY_THRESHOLD_X + 'x (leakage); consider retuning.');
  }

  // Release-gate threshold signal for Plan 88.1-11 (auto-consumable).
  lines.push('  (release-gate signal for v1.10.15: ' + status + ')');

  return lines.join('\n');
}

function renderJson(agg, opts) {
  const status = thresholdStatus(agg.median);
  return JSON.stringify({
    window_days: opts.all ? null : opts.days,
    all_time: !!opts.all,
    population: opts.mosOnly ? 'mos-only' : 'all-turns',
    release_gate_threshold_x: RELEASE_GATE_THRESHOLD_X,
    below_efficiency_threshold_x: BELOW_EFFICIENCY_THRESHOLD_X,
    count: agg.count,
    median: agg.median,
    mean: agg.mean,
    top5: agg.top5,
    threshold_status: status,
  });
}

// ---------- Main ----------

function main() {
  const opts = parseArgv(process.argv.slice(2));

  const filePath = telemetryPath();
  const events = readEvents(filePath);
  const windowed = filterWindow(events, opts.days, opts.all);
  // D-01a: restrict to the /mos: population when --mos-only is set so the
  // published "up to 57x" claim stays measured on its original denominator.
  const filtered = filterCommandPopulation(windowed, opts.mosOnly);

  let estimator;
  try {
    estimator = require(path.resolve(__dirname, '..', 'lib', 'core', 'token-estimator.cjs'));
  } catch (_e) {
    process.stderr.write('scout-telemetry-aggregator: token-estimator module unavailable\n');
    process.exit(1);
    return;
  }

  const agg = estimator.aggregateEvents(filtered);

  if (opts.json) {
    process.stdout.write(renderJson(agg, opts) + '\n');
  } else {
    process.stdout.write(renderHuman(agg, opts) + '\n');
  }
  process.exit(0);
}

try { main(); }
catch (_e) {
  process.stderr.write('scout-telemetry-aggregator: soft-fail: ' +
    (_e && _e.message ? _e.message : 'unknown') + '\n');
  process.exit(0); // advisory: never fail the scout surface
}
