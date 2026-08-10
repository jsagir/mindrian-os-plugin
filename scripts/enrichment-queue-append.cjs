#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 249-01 Task 1 -- one-line enrichment-queue append CLI.
 * ==============================================================
 * Two modes, both content-free (Part 8: only names, enums, scores,
 * timestamps ever reach the queue file):
 *
 *   Append mode:
 *     node scripts/enrichment-queue-append.cjs --room <dir> \
 *       --framework "<name>" --score N --missing structure,flow \
 *       --source live_reach [--reach-id X --dispatch Y \
 *       --problem-type Z --trigger-tier W]
 *
 *   Seed mode (day-one operator backlog from the census gap table,
 *   research OQ3 -- honest census_seed provenance, never disguised as a
 *   live miss):
 *     node scripts/enrichment-queue-append.cjs --from-census <path> --room <dir>
 *
 * This is the callable-from-a-one-line-Bash-invocation surface the
 * brain-connector skill leg (Desktop/Cowork, Larry-direct MCP path) and
 * Phase 250's refusal rail both need -- see 249-RESEARCH.md "The Larry-direct
 * path (Tri-Polar)".
 *
 * Exit 0 on success with a one-line JSON result on stdout; exit 1 with the
 * error result otherwise. process.argv switch-case router (repo convention;
 * no Commander).
 *
 * Pure CJS, node built-ins only, zero npm deps. No em-dashes.
 */

const fs = require('node:fs');
const path = require('node:path');
const enrichmentQueue = require('../lib/core/enrichment-queue.cjs');

function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      flags[key] = next;
      i++;
    } else {
      flags[key] = true;
    }
  }
  return flags;
}

function printResultAndExit(result, okKey) {
  process.stdout.write(JSON.stringify(result) + '\n');
  process.exit(result[okKey] ? 0 : 1);
}

function runAppendMode(flags) {
  const missing = typeof flags.missing === 'string'
    ? flags.missing.split(',').map(function (s) { return s.trim(); }).filter(Boolean)
    : [];

  const context_class = {};
  if (typeof flags['reach-id'] === 'string') context_class.reach_id = flags['reach-id'];
  if (typeof flags.dispatch === 'string') context_class.dispatch = flags.dispatch;
  if (typeof flags['problem-type'] === 'string') context_class.problem_type = flags['problem-type'];
  if (typeof flags['trigger-tier'] === 'string') context_class.trigger_tier = flags['trigger-tier'];

  const entry = {
    framework: flags.framework,
    normalized: true,
    readiness_score: (flags.score !== undefined && flags.score !== true) ? Number(flags.score) : null,
    missing_dimensions: missing,
    context_class: context_class,
    source: flags.source || 'live_reach',
    probe_provenance: 'cli_append@' + new Date().toISOString(),
  };

  const result = enrichmentQueue.enqueue(flags.room, entry);
  printResultAndExit(result, 'queued');
}

function runSeedMode(flags) {
  const censusPath = flags['from-census'];
  let census;
  try {
    census = JSON.parse(fs.readFileSync(censusPath, 'utf8'));
  } catch (e) {
    printResultAndExit({ ok: false, error: 'unreadable_census: ' + ((e && e.message) || 'unknown') }, 'ok');
    return;
  }

  const censusDate = (census.meta && typeof census.meta.census_date === 'string')
    ? census.meta.census_date
    : 'unknown';
  const gapTable = Array.isArray(census.gap_table) ? census.gap_table : [];

  let seeded = 0;
  const failures = [];
  for (const g of gapTable) {
    const rawScore = (typeof g.readiness_score === 'number' && Number.isFinite(g.readiness_score))
      ? g.readiness_score
      : null;
    const missing_dimensions = enrichmentQueue.inferMissingDimensionsFromScore(rawScore === null ? 0 : rawScore, false);
    const entry = {
      framework: g.framework,
      normalized: true,
      readiness_score: rawScore,
      missing_dimensions: missing_dimensions,
      context_class: {},
      source: 'census_seed',
      hit_count: 0,
      probe_provenance: 'census_seed@' + censusDate,
      dimensions_inferred: true,
    };
    const r = enrichmentQueue.enqueue(flags.room, entry);
    if (r.queued) {
      seeded++;
    } else {
      failures.push({ framework: g.framework, error: r.error });
    }
  }

  printResultAndExit({
    ok: failures.length === 0,
    seeded: seeded,
    total: gapTable.length,
    census_date: censusDate,
    failures: failures,
  }, 'ok');
}

function main() {
  const flags = parseFlags(process.argv.slice(2));

  if (typeof flags.room !== 'string' || flags.room.length === 0) {
    printResultAndExit({ queued: false, ok: false, error: 'missing_--room' }, 'ok');
    return;
  }

  if (typeof flags['from-census'] === 'string' && flags['from-census'].length > 0) {
    runSeedMode(flags);
    return;
  }

  if (typeof flags.framework !== 'string' || flags.framework.length === 0) {
    printResultAndExit({ queued: false, error: 'missing_--framework' }, 'queued');
    return;
  }

  runAppendMode(flags);
}

main();
