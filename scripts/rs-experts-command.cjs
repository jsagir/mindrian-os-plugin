#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.5 Plan 05 -- /mos:rs-experts CLI wrapper.
 *
 * BUG 2 FIX (routing, 2026-05-22): the former Tier 1 path called
 * brainClient.query(cypher) which routes to the REMOTE Brain
 * (pws-brain-mcp.onrender.com) when MINDRIAN_BRAIN_KEY is set.
 * Author/Paper/Institution nodes do NOT exist in the remote Brain --
 * they live in the user's LOCAL Aura mirror (populated via /mos:rs-fetch).
 * Routing to the remote Brain would always return empty results AND
 * potentially expose topic strings (user-chosen search strings) to the
 * remote server, which is a Canon Part 8 concern.
 *
 * Fix: the remote-Brain Tier 1 path is removed. This command now relies
 * on the Tier 0 graceful-degradation path exclusively. A future phase
 * that ships a LOCAL Aura transport (not brain-client.cjs) can restore
 * an Aura-specific query path.
 *
 * Resolves the expert network for a topic via graceful Tier 0 guidance.
 * Tier 0 surfaces a message pointing the user to /mos:rs-fetch to
 * populate the local mirror first.
 *
 * Usage:
 *   node scripts/rs-experts-command.cjs "<topic>"
 *   node scripts/rs-experts-command.cjs "<topic>" --json
 *   node scripts/rs-experts-command.cjs "<topic>" --limit 50
 *
 * Exit codes:
 *   0  success (including graceful Tier 0 message)
 *   1  invocation error (missing topic, ExternalEgressViolation)
 *   2  prerequisite missing
 *
 * Canon Part 8: topic is parameterized (NO concatenation). Audited via
 * auditQueryString BEFORE use. Remote Brain is never called from this
 * command -- Author/Paper/Institution nodes are LOCAL only.
 */

const path = require('path');

// NOTE: brainClient is intentionally NOT loaded here. rs-experts must never
// call the remote Brain -- Author/Paper/Institution nodes are LOCAL only
// (populated via /mos:rs-fetch into the user's Aura mirror). The former
// Tier 1 path via brainClient has been removed; see comment at top of file.
let egressPrompts = null;

function _lazyLoad() {
  if (!egressPrompts) egressPrompts = require(path.join(__dirname, '..', 'lib', 'core', 'rs-egress-prompts.cjs'));
}

function parseArgs(argv) {
  const args = { topic: null, json: false, limit: 25 };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i += 1) {
    const a = rest[i];
    if (a === '--json') { args.json = true; continue; }
    if (a === '--help' || a === '-h') { args.help = true; continue; }
    if (a === '--limit' && i + 1 < rest.length) {
      const n = parseInt(rest[i + 1], 10);
      if (Number.isFinite(n) && n > 0 && n < 1000) args.limit = n;
      i += 1;
      continue;
    }
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
    'Usage: node scripts/rs-experts-command.cjs "<topic>" [options]',
    '',
    'Resolve the expert network for <topic> from local Aura.',
    'Tier 0 (Aura unreachable) returns a graceful guidance message.',
    '',
    'Options:',
    '  --json          structured JSON output for Desktop MCP',
    '  --limit <n>     cap returned authors (default 25)',
    '',
  ].join('\n'));
}

function renderTranscript(topic, authors) {
  process.stdout.write('\n');
  process.stdout.write('-- rs-experts -- ' + topic + ' -- ' + authors.length + ' authors --\n\n');
  if (authors.length === 0) {
    process.stdout.write('  No experts found for topic.\n');
    process.stdout.write('  -> /mos:rs-fetch ' + JSON.stringify(topic) + '   Populate the mirror with fresh papers\n\n');
    return;
  }
  process.stdout.write('  Rank  Author                      Institution(s)               Papers  Score\n');
  process.stdout.write('  ' + '-'.repeat(78) + '\n');
  authors.forEach(function (a, i) {
    const rank = String(i + 1).padEnd(6);
    const name = String(a.name || 'unknown').padEnd(28).slice(0, 28);
    const insts = (a.institutions || []).slice(0, 2).join(', ').padEnd(28).slice(0, 28);
    const papers = String(a.paper_count || 0).padEnd(8);
    const score = (typeof a.score === 'number') ? a.score.toFixed(2) : 'n/a';
    process.stdout.write('  ' + rank + name + '  ' + insts + '  ' + papers + score + '\n');
  });
  process.stdout.write('\n  -> /mos:persona               Build engagement strategy\n');
  process.stdout.write('  -> /mos:rs-fetch ' + JSON.stringify(topic) + '       Refresh papers and re-resolve\n\n');
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) { printHelp(); process.exit(0); }
  if (!args.topic) {
    printError('No topic provided', 'rs-experts requires a topic argument', '/mos:rs-experts <topic>');
    process.exit(1);
  }

  try {
    _lazyLoad();
  } catch (err) {
    printError('Library module load failed', err && err.message ? err.message : String(err), 'verify lib/core/rs-egress-prompts.cjs exists');
    process.exit(2);
  }

  // Canon Part 8 input audit on the bound parameter BEFORE any use.
  try {
    egressPrompts.auditQueryString(args.topic, 'rs-experts-command-input');
  } catch (err) {
    if (err && err.name === 'ExternalEgressViolation') {
      printError('Canon Part 8 audit failed', 'forbidden bytes in topic (' + (err.meta && err.meta.surface ? err.meta.surface : 'unknown surface') + ')', 'rephrase the topic without user-content placeholders');
      process.exit(1);
    }
    throw err;
  }

  // Tier 0: the remote Brain (brain-client.cjs) is never used here. Author/
  // Paper/Institution nodes live in the user's LOCAL Aura mirror, populated
  // by /mos:rs-fetch. No separate local-Aura transport exists yet, so we
  // surface the guidance message directing the user to /mos:rs-fetch.
  // When a local-only Aura transport ships, the Tier 1 path can be added
  // against that transport (NOT brain-client.cjs).
  if (args.json) {
    process.stdout.write(JSON.stringify({ tier: 'tier0', authors: [], degraded_note: 'local_aura_transport_not_yet_available' }, null, 2) + '\n');
    process.exit(0);
  }
  printError(
    'Aura not connected',
    'rs-experts requires a local Aura mirror; remote Brain is not used for Author/Paper data',
    '/mos:rs-fetch ' + JSON.stringify(args.topic) + ' first to populate the local SQLite mirror, then retry'
  );
  process.exit(0); // Tier 0 fallback is graceful, not an error
}

if (require.main === module) {
  main().catch(function (err) {
    process.stderr.write('rs-experts unhandled: ' + (err && err.message ? err.message : String(err)) + '\n');
    process.exit(1);
  });
}

module.exports = { main, parseArgs, renderTranscript };
