#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.5 Plan 05 -- /mos:rs-experts local corpus lookup.
 *
 * This command searches Paper/Author/Institution records in the selected
 * room only. It does not query Aura, Brain, or external expert directories.
 *
 * Usage:
 *   node scripts/rs-experts-command.cjs "<topic>"
 *   node scripts/rs-experts-command.cjs "<topic>" --json
 *   node scripts/rs-experts-command.cjs "<topic>" --limit 50
 *
 * Exit codes:
 *   0  local search completed, including a complete empty result
 *   1  invocation or local room error
 *
 * Canon Part 8: audit the topic before local matching. The query stays in
 * process and is never sent to a remote service.
 */

const path = require('path');
const navigation = require('../lib/core/navigation.cjs');
const { searchLocalExperts } = require('../lib/core/rs-local-expert-search.cjs');

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
      if (Number.isFinite(n) && n > 0 && n <= 100) args.limit = n;
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
    'Search stored paper titles and abstracts in the selected local room for <topic>.',
    'This is not an external expert-directory search and does not validate expertise.',
    '',
    'Options:',
    '  --json          emit structured JSON output',
    '  --limit <n>     cap returned authors (default 25)',
    '',
  ].join('\n'));
}

function renderTranscript(topic, authors, result) {
  process.stdout.write('\n');
  process.stdout.write('-- rs-experts -- ' + topic + ' -- ' + authors.length + ' local authors --\n\n');
  if (authors.length === 0) {
    process.stdout.write('  No authors matched the topic in the room’s stored papers.\n');
    process.stdout.write('  -> /mos:rs-fetch ' + JSON.stringify(topic) + '   Fetch approved papers, then search the refreshed room corpus\n\n');
    return;
  }
  process.stdout.write('  Rank  Author                      Institution(s)               Matched papers\n');
  process.stdout.write('  ' + '-'.repeat(78) + '\n');
  authors.forEach(function (a, i) {
    const rank = String(i + 1).padEnd(6);
    const name = String(a.name || 'unknown').padEnd(28).slice(0, 28);
    const insts = (a.institutions || []).slice(0, 2).join(', ').padEnd(28).slice(0, 28);
    process.stdout.write('  ' + rank + name + '  ' + insts + '  ' + String(a.matched_paper_count || 0) + '\n');
  });
  if (result && result.partial) process.stdout.write('\n  ! Partial result: ' + result.omissions.map((item) => item.reason).join(', ') + '\n');
  process.stdout.write('  Matches come from stored room papers; they do not establish current expertise or availability.\n');
  process.stdout.write('\n  -> /mos:persona               Build engagement strategy\n');
  process.stdout.write('  -> /mos:rs-fetch ' + JSON.stringify(topic) + '       Refresh papers and re-resolve\n\n');
}

function searchLocalRoom(topic, roomDir, limit) {
  const db = navigation.openRoomDbReadOnlyForCaller(roomDir);
  if (!db) return { ok: false, reason: 'room_db_unavailable', message: 'No readable room.db was found in the selected local room.' };
  try { return searchLocalExperts(db, topic, limit); }
  finally { navigation.closeRoomDbForCaller(db); }
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

  const roomDir = process.env.MINDRIAN_ROOM || process.cwd();
  let result;
  try { result = searchLocalRoom(args.topic, roomDir, args.limit); }
  catch (_error) {
    result = { ok: false, reason: 'expert_store_unavailable', message: 'The selected room does not expose a readable Paper/Author research graph.' };
  }

  if (args.json) {
    process.stdout.write(JSON.stringify({ ...result, host_service: 'rs_experts_find', local_only: true }, null, 2) + '\n');
    process.exit(result.ok ? 0 : 1);
  }

  if (!result.ok) {
    printError(
      'Local research records unavailable',
      result.message || 'The local expert lookup could not read the selected room.',
      'set MINDRIAN_ROOM to a room containing room.db, then retry'
    );
    process.exit(1);
  }

  renderTranscript(args.topic, result.authors, result);
  process.exit(0);
}

if (require.main === module) {
  main().catch(function (err) {
    process.stderr.write('rs-experts unhandled: ' + (err && err.message ? err.message : String(err)) + '\n');
    process.exit(1);
  });
}

module.exports = { main, parseArgs, renderTranscript, searchLocalRoom };
