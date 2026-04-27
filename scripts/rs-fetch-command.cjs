#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.5 Plan 05 -- /mos:rs-fetch CLI wrapper.
 *
 * Thin CLI dispatch over scripts/rs-discovery-engine.cjs runDiscovery().
 * Surfaces a Phase Gate-style transcript on success (CLI mode) OR JSON
 * on the --json flag (Desktop MCP mode). Honors the MINDRIAN_ROOM env
 * var for active-room scope (Cowork mode).
 *
 * Usage:
 *   node scripts/rs-fetch-command.cjs "<topic>"
 *   node scripts/rs-fetch-command.cjs "<topic>" --json
 *   node scripts/rs-fetch-command.cjs "<topic>" --problem-type IDP --stage market_analysis
 *
 * Exit codes:
 *   0  success (including pause-state which is graceful, not an error)
 *   1  invocation error (missing topic, malformed args, ExternalEgressViolation)
 *   2  prerequisite missing (no library, etc.)
 *
 * Canon Part 8: this CLI wrapper does not touch Brain directly. All Brain
 * RPCs route through scripts/rs-discovery-engine.cjs which itself routes
 * through chain-feeder.lookupUpstream which wraps brainClient.query.
 */

const path = require('path');

const ENGINE_PATH = path.join(__dirname, 'rs-discovery-engine.cjs');

function parseArgs(argv) {
  const args = { topic: null, json: false, problemType: null, stage: null };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i += 1) {
    const a = rest[i];
    if (a === '--json') { args.json = true; continue; }
    if (a === '--help' || a === '-h') { args.help = true; continue; }
    if (a === '--problem-type' && i + 1 < rest.length) { args.problemType = rest[i + 1]; i += 1; continue; }
    if (a === '--stage' && i + 1 < rest.length) { args.stage = rest[i + 1]; i += 1; continue; }
    if (!args.topic) { args.topic = a; continue; }
  }
  return args;
}

function printError(what, why, fix) {
  process.stderr.write('x ' + what + '\n');
  process.stderr.write('  Why: ' + why + '\n');
  process.stderr.write('  Fix: ' + fix + '\n');
}

function printHelp() {
  process.stdout.write([
    '',
    'Usage: node scripts/rs-fetch-command.cjs "<topic>" [options]',
    '',
    'Run the full Reverse Salient discovery pipeline for <topic>.',
    'Options:',
    '  --json                 emit structured JSON instead of Phase Gate transcript',
    '  --problem-type <type>  e.g. IDP, UDP, WDP (passed to chain-feeder.lookupUpstream)',
    '  --stage <stage>        e.g. opportunity_identified, market_analysis',
    '',
    'Exit codes: 0 success or pause | 1 invocation error | 2 prerequisite missing',
    '',
  ].join('\n'));
}

function renderTranscript(bundle) {
  if (bundle && bundle.state === 'pause') {
    process.stdout.write('\n');
    process.stdout.write('-- rs-fetch -- PAUSED --\n\n');
    process.stdout.write('  Pause state: missing upstream framework(s)\n');
    process.stdout.write('  Missing: ' + (bundle.missing_upstream || []).join(', ') + '\n');
    process.stdout.write('  Suggested action: ' + (bundle.suggested_action || 'Run Methodology') + '\n\n');
    process.stdout.write('  Run the upstream methodology first, then re-run /mos:rs-fetch.\n\n');
    return;
  }

  const breakthroughs = bundle.breakthroughs || [];
  const theses = bundle.theses || [];
  const fetched = bundle.fetched_results || {};
  const output = bundle.output || {};
  const chainMeta = bundle.chain_metadata || [];
  const written = output.written || {};
  const tier = written.tier || 'tier0';
  const fallback = written.fallback_reason ? (' (fallback: ' + written.fallback_reason + ')') : '';

  const academicCount = (fetched.academic && Array.isArray(fetched.academic.papers)) ? fetched.academic.papers.length : 0;
  const patentsCount = (fetched.patents && Array.isArray(fetched.patents.patents)) ? fetched.patents.patents.length : 0;
  const industryCount = (fetched.industry && Array.isArray(fetched.industry.signals)) ? fetched.industry.signals.length : 0;
  const expertsRaw = fetched.experts || [];
  const expertsCount = Array.isArray(expertsRaw) ? expertsRaw.length : 0;

  process.stdout.write('\n');
  process.stdout.write('-- rs-fetch -- ' + bundle.topic + ' -- Tier: ' + tier + fallback + ' --\n\n');
  process.stdout.write('  Phase                     Status      Key Output\n');
  process.stdout.write('  ' + '-'.repeat(72) + '\n');
  process.stdout.write('  Phase 1 Domain Analysis    OK          ' + ((bundle.domain_analysis && bundle.domain_analysis.primary_domain) || '(no signal)') + '\n');
  process.stdout.write('  Phase 1.5 Fetchers         OK          academic=' + academicCount + ' patents=' + patentsCount + ' industry=' + industryCount + ' experts=' + expertsCount + '\n');
  process.stdout.write('  Phase 2 Preprocessing      OK          ' + ((bundle.preprocessed || []).length) + ' items\n');
  process.stdout.write('  Phase 3 Scoring            OK          ' + ((bundle.classified || []).length) + ' classified pairs\n');
  process.stdout.write('  Phase 4 Synthesis          OK          ' + breakthroughs.length + ' breakthroughs / ' + theses.length + ' theses\n');
  process.stdout.write('  Output Layer               OK          tier=' + tier + ' written.id=' + (written.id || 'n/a') + '\n');
  process.stdout.write('  Chain Downstream           OK          ' + chainMeta.length + ' chain metadata block(s)\n');

  if (chainMeta.length > 0) {
    const top = chainMeta[0];
    process.stdout.write('\n  Top chain metadata:\n');
    process.stdout.write('    recommended_verb: ' + (top.recommended_verb || 'n/a') + '\n');
    process.stdout.write('    feeds_into:       ' + (top.feeds_into || 'n/a') + '\n');
    process.stdout.write('    spawn_skill:      ' + (top.spawn_skill || 'null') + '\n');
    process.stdout.write('    confidence:       ' + (typeof top.confidence === 'number' ? top.confidence.toFixed(2) : 'n/a') + '\n');
  }

  process.stdout.write('\n  -> /mos:rs-thesis <id>     Read a specific thesis\n');
  process.stdout.write('  -> /mos:rs-experts ' + JSON.stringify(bundle.topic) + '   Resolve expert network\n');
  process.stdout.write('  -> /mos:rs-explain "..."   Ask follow-up questions in NL\n\n');
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) { printHelp(); process.exit(0); }
  if (!args.topic) {
    printError('No topic provided', 'rs-fetch requires a topic argument', '/mos:rs-fetch <topic>');
    process.exit(1);
  }

  let engine;
  try {
    engine = require(ENGINE_PATH);
  } catch (err) {
    printError('Engine module load failed', err && err.message ? err.message : String(err), 'verify scripts/rs-discovery-engine.cjs exists');
    process.exit(2);
  }

  const opts = {
    room_dir: process.env.MINDRIAN_ROOM || process.cwd(),
  };
  if (args.problemType) opts.problem_type = args.problemType;
  if (args.stage) opts.stage = args.stage;

  let bundle;
  try {
    bundle = await engine.runDiscovery(args.topic, opts);
  } catch (err) {
    if (err && err.name === 'ExternalEgressViolation') {
      printError('Canon Part 8 audit failed', 'forbidden bytes in topic or opts (' + (err.meta && err.meta.surface ? err.meta.surface : 'unknown surface') + ')', 'rephrase the topic without user-content placeholders');
      process.exit(1);
    }
    process.stderr.write('rs-fetch error: ' + (err && err.message ? err.message : String(err)) + '\n');
    process.exit(1);
  }

  if (args.json) {
    process.stdout.write(JSON.stringify(bundle, null, 2) + '\n');
    process.exit(0);
  }

  renderTranscript(bundle);
  process.exit(0);
}

if (require.main === module) {
  main().catch(function (err) {
    process.stderr.write('rs-fetch unhandled: ' + (err && err.message ? err.message : String(err)) + '\n');
    process.exit(1);
  });
}

module.exports = { main, parseArgs, renderTranscript };
