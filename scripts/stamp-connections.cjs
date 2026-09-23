#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355 (Hidden in Plain Sight: Jev-through-Theo cross-connection
 * engines) Plan 17 (HIPS-04, HIPS-05, D-18). find-connections CLI stamp
 * entry: not an MCP tool (the Phase 268 ruling stands), never registers a
 * tool, never calls fetch or any URL directly. Theo only through
 * verification-stamp.cjs -> brain-client.cjs (the one wire door); canon
 * Framework names only, never room or user content.
 *
 * Usage:
 *   node scripts/stamp-connections.cjs --pair "<Framework A>|<Framework B>"
 *   node scripts/stamp-connections.cjs --pairs-json <path>
 *   node scripts/stamp-connections.cjs --pair "<A>|<B>" --json
 *
 * Every pair's two sides are resolved EXACTLY (verification-stamp.cjs's
 * resolveEndpoint, framework-name lookup only, D-10/D-48) -- an unresolved
 * side stamps unverified/not_called/handle_unresolved and zero Theo calls
 * happen for that pair, but it still prints under its ORIGINAL typed name
 * (never dropped, never silently hidden). direction is always 'none' (D-49):
 * find-connections has no (lsa, semantic) pair to compare, so this producer
 * never carries a wording-direction signal.
 *
 * No em-dashes (CLAUDE.md HARD RULE). Hyphens only.
 */

'use strict';

const fs = require('fs');
const verificationStamp = require('../lib/core/verification-stamp.cjs');
const verificationStampFormat = require('../lib/core/verification-stamp-format.cjs');
const floorDisclosure = require('../lib/core/floor-disclosure.cjs');
const directionConvention = require('../lib/core/direction-convention.cjs');

const HELP_TEXT = [
  'Usage: node scripts/stamp-connections.cjs --pair "<Framework A>|<Framework B>" [--pair ...]',
  '       node scripts/stamp-connections.cjs --pairs-json <path>',
  '',
  'Options:',
  '  --pair "<A>|<B>"     A framework name pair to verify (repeatable)',
  '  --pairs-json <path>  A JSON file: [{ "from": "<A>", "to": "<B>" }, ...]',
  '  --json               Print the stamp objects (JSON) instead of formatted lines',
  '  --help                Show this help text',
].join('\n');

/*
 * parsePairs(argv) -> [{ from, to }]. Exact typed strings only -- no
 * resolution happens here (that is resolveEndpoint's job, in main()).
 * --pair may repeat; --pairs-json is read from disk (a JSON array of
 * { from, to } entries). A malformed --pairs-json file yields zero
 * additional pairs rather than throwing -- any --pair entries still run.
 */
function parsePairs(argv) {
  const args = Array.isArray(argv) ? argv : [];
  const pairs = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--pair') {
      const raw = args[i + 1];
      i += 1;
      if (typeof raw !== 'string') continue;
      const sepIdx = raw.indexOf('|');
      if (sepIdx === -1) continue;
      const from = raw.slice(0, sepIdx).trim();
      const to = raw.slice(sepIdx + 1).trim();
      if (from.length > 0 && to.length > 0) pairs.push({ from, to });
    }
  }

  const jsonIdx = args.indexOf('--pairs-json');
  if (jsonIdx !== -1 && typeof args[jsonIdx + 1] === 'string') {
    try {
      const raw = fs.readFileSync(args[jsonIdx + 1], 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const entry of parsed) {
          if (entry && typeof entry.from === 'string' && typeof entry.to === 'string'
            && entry.from.length > 0 && entry.to.length > 0) {
            pairs.push({ from: entry.from, to: entry.to });
          }
        }
      }
    } catch (_e) {
      // Missing or malformed file: degrade to zero additional pairs.
    }
  }

  return pairs;
}

/*
 * main(argv, deps) -> Promise<number> (exit code). deps.callTool drives
 * every test offline (tests/helpers/theo-replay-355.cjs); production runs
 * pass no deps.callTool, so verification-stamp.cjs lazily requires
 * brain-client.cjs itself, only inside the Theo-call path.
 */
async function main(argv, deps) {
  const args = Array.isArray(argv) ? argv : process.argv.slice(2);
  const d = deps || {};

  if (args.indexOf('--help') !== -1) {
    process.stdout.write(HELP_TEXT + '\n');
    return 0;
  }

  const pairs = parsePairs(args);
  if (pairs.length === 0) {
    process.stderr.write('stamp-connections: no pairs given -- use --pair "<A>|<B>" or --pairs-json <path> (--help for usage)\n');
    return 1;
  }

  const findings = pairs.map((p) => {
    const from = verificationStamp.resolveEndpoint({ framework: p.from });
    const to = verificationStamp.resolveEndpoint({ framework: p.to });
    return {
      fromHandle: from.name,
      toHandle: to.name,
      fromVia: from.via,
      toVia: to.via,
      // D-49: find-connections has no (lsa, semantic) pair to compare, so
      // every finding here carries the NONE direction sentinel.
      direction: directionConvention.NONE,
    };
  });

  const stamps = await verificationStamp.stampFindings(findings, d);

  if (args.indexOf('--json') !== -1) {
    process.stdout.write(JSON.stringify(stamps, null, 2) + '\n');
    return 0;
  }

  const lines = [];
  pairs.forEach((p, i) => {
    lines.push(p.from + ' and ' + p.to);
    lines.push.apply(lines, verificationStampFormat.formatStampLines(stamps[i], 'cli'));
  });
  lines.push(floorDisclosure.disclosureLine('find-connections'));
  const clean = verificationStampFormat.assertNoScalar(lines).lines;
  for (const line of clean) process.stdout.write(line + '\n');
  return 0;
}

if (require.main === module) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((e) => {
      process.stderr.write('stamp-connections: ' + String((e && e.message) || e) + '\n');
      process.exit(1);
    });
}

module.exports = { main, parsePairs };
