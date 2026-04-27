#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.5 Plan 05 -- /mos:rs-experts CLI wrapper.
 *
 * Resolves the expert network for a topic via parameterized Aura Cypher
 * MATCH on AUTHORED_BY + AFFILIATED_WITH edges. Tier 0 (Aura unreachable)
 * surfaces a graceful guidance message pointing the user to /mos:rs-fetch
 * to populate the local mirror first.
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
 * Canon Part 8: topic is parameterized as $topic (NO concatenation).
 * Audited via auditQueryString BEFORE binding. The Aura is a LOCAL Brain
 * mirror per Canon Part 8; this command does NOT query the remote Brain
 * methodology graph.
 */

const path = require('path');

let brainClient = null;
let egressPrompts = null;

function _lazyLoad() {
  if (!brainClient) brainClient = require(path.join(__dirname, '..', 'lib', 'core', 'brain-client.cjs'));
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
    printError('Library module load failed', err && err.message ? err.message : String(err), 'verify lib/core/brain-client.cjs and lib/core/rs-egress-prompts.cjs exist');
    process.exit(2);
  }

  // Canon Part 8 input audit on the bound parameter BEFORE Cypher binding.
  try {
    egressPrompts.auditQueryString(args.topic, 'rs-experts-command-input');
  } catch (err) {
    if (err && err.name === 'ExternalEgressViolation') {
      printError('Canon Part 8 audit failed', 'forbidden bytes in topic (' + (err.meta && err.meta.surface ? err.meta.surface : 'unknown surface') + ')', 'rephrase the topic without user-content placeholders');
      process.exit(1);
    }
    throw err;
  }

  // Tier 0 graceful: Aura unreachable -> guidance message.
  if (typeof brainClient.isAvailable !== 'function' || !brainClient.isAvailable()) {
    if (args.json) {
      process.stdout.write(JSON.stringify({ tier: 'tier0', authors: [], degraded_note: 'aura_unreachable' }, null, 2) + '\n');
      process.exit(0);
    }
    printError(
      'Aura not connected',
      'brainClient.isAvailable() returned false; expert network requires Aura',
      '/mos:rs-fetch ' + JSON.stringify(args.topic) + ' first to populate the local SQLite mirror, then retry'
    );
    process.exit(0); // Tier 0 fallback is graceful, not an error
  }

  // Tier 1 path: parameterized Cypher MATCH on AUTHORED_BY + AFFILIATED_WITH.
  const cypher =
    'MATCH (a:Author)-[:AUTHORED_BY]->(p:Paper) ' +
    'WHERE p.topic = $topic ' +
    'OPTIONAL MATCH (a)-[:AFFILIATED_WITH]->(i:Institution) ' +
    'WITH a, collect(DISTINCT i.name) AS institutions, count(p) AS paper_count ' +
    'RETURN a.name AS name, institutions, paper_count ' +
    'ORDER BY paper_count DESC LIMIT $limit';

  let result;
  try {
    result = await brainClient.query(cypher, { topic: args.topic, limit: args.limit });
  } catch (err) {
    if (err && (err.name === 'AuraUnreachableError' || /unreachable|connect|ECONNREFUSED/i.test(err.message || ''))) {
      if (args.json) {
        process.stdout.write(JSON.stringify({ tier: 'tier0', authors: [], degraded_note: 'aura_unreachable_at_query' }, null, 2) + '\n');
        process.exit(0);
      }
      printError('Aura unreachable mid-query', 'Aura session dropped during MATCH', '/mos:rs-fetch ' + JSON.stringify(args.topic) + ' first');
      process.exit(0);
    }
    throw err;
  }

  const records = (result && Array.isArray(result.records)) ? result.records : [];
  const authors = records.map(function (r, i) {
    const total = records.length;
    return {
      name: r.name,
      institutions: Array.isArray(r.institutions) ? r.institutions : [],
      paper_count: r.paper_count,
      score: total === 0 ? 0 : (1 - (i / total)),
    };
  });

  if (args.json) {
    process.stdout.write(JSON.stringify({ tier: 'tier1', topic: args.topic, authors: authors }, null, 2) + '\n');
    process.exit(0);
  }

  renderTranscript(args.topic, authors);
  process.exit(0);
}

if (require.main === module) {
  main().catch(function (err) {
    process.stderr.write('rs-experts unhandled: ' + (err && err.message ? err.message : String(err)) + '\n');
    process.exit(1);
  });
}

module.exports = { main, parseArgs, renderTranscript };
