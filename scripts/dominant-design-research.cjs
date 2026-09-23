#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 361-06 -- dominant-design-research: the ONE CLI door the
 * /mos:dominant-designs command body calls for every deterministic step of
 * the research path: compose-queries, audit-query, theo-structure,
 * validate-lane, and file-pack. Keeping every deterministic step in one CLI
 * keeps Larry from improvising query strings, row ids, tiers or paths
 * (361-RESEARCH finding 1: there was no CLI door to fileEvidenceWithReadback).
 *
 * CANON PART 8 (Graph Boundary): compose-queries and audit-query read their
 * input from a JSON FILE PATH, never from argv text -- navigator text never
 * rides a shell command line. Every outbound string is audited by
 * lib/core/dominant-design/lane-queries.cjs (D-03/D-04) before it can be
 * returned; a violation degrades honestly and echoes nothing.
 * CANON PART 9 (Memory Locality): file-pack (D-07/D-08) opens room.db ONLY
 * through navigation.openRoomDbForCaller / closeRoomDbForCaller and files
 * evidence ONLY through navigation.fileEvidenceWithReadback -- this script
 * never requires lib/core/room-db.cjs directly. Every filed EvidenceClaim
 * lands review_status 'proposed', never auto-confirmed.
 *
 * Subcommands:
 *   compose-queries <domain.json>
 *     domain.json = {"domain": "<phrase>"}. Prints the composeLaneQueries
 *     envelope (an ok:false local-only degrade is a successful honest
 *     answer, exit 0).
 *   audit-query <query.json>
 *     query.json = {"lane": "<id>", "q": "<string>"}. Prints
 *     {ok, lane, q} or {ok:false, lane, reason} -- never echoes a refused
 *     string.
 *   theo-structure [--reference <path>]
 *     Prints the readDominantDesignStructure result (source 'theo' or
 *     'reference', reason named).
 *   validate-lane <raw.json> --approved <gate.json> [--out <path>]
 *     gate.json = {"domain_slug": "...", "lanes": [{"id": "...",
 *     "queries": ["..."]}]} -- the approved lanes after the navigator's
 *     edits and drops. Looks up the raw lane's approved queries by its lane
 *     id (a lane id not in gate.json -> {ok:false, reason:'lane_not_approved'}).
 *     Prints the validateLaneResult output and writes it to --out when
 *     given (--out must end in .valid.json).
 *   file-pack --pack <dir> --room <roomDir> --domain-slug <slug>
 *              --date <YYYY-MM-DD> [--session <id>] [--room-label <text>]
 *              [--stage <text>] [--json]
 *     Processes every *.valid.json in the pack dir in LANE_IDS order,
 *     writes lane artifacts, files sourced evidence through the Part 9
 *     door with readback, and prints a 4-zone report (JSON with --json).
 *
 * Exit codes: 0 for any well-formed run (including honest degrades and
 * not-landed filings, which are data), 2 for usage errors (unknown
 * subcommand, missing file, bad flag values).
 *
 * No em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');

const laneQueries = require(path.join(REPO_ROOT, 'lib', 'core', 'dominant-design', 'lane-queries.cjs'));
const evidencePack = require(path.join(REPO_ROOT, 'lib', 'core', 'dominant-design', 'evidence-pack.cjs'));
const theoStructure = require(path.join(REPO_ROOT, 'lib', 'core', 'dominant-design', 'theo-structure.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));

const { composeLaneQueries, auditEditedQuery, LANE_IDS } = laneQueries;
const { validateLaneResult, renderLaneArtifact, toEvidenceClaimParams, laneArtifactName } = evidencePack;
const { readDominantDesignStructure } = theoStructure;

const SUBCOMMANDS = Object.freeze(['compose-queries', 'audit-query', 'theo-structure', 'validate-lane', 'file-pack']);

const USAGE = 'usage: dominant-design-research.cjs <' + SUBCOMMANDS.join('|') + '> ...';

// ---------------------------------------------------------------------------
// argv parsing -- a tiny flag parser (the gsd-tools switch-case idiom, no
// dependency). `--name value` pairs plus the boolean `--json`; everything
// else is positional, in order.
// ---------------------------------------------------------------------------

function parseFlags(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--json') {
      flags.json = true;
    } else if (typeof a === 'string' && a.indexOf('--') === 0) {
      const name = a.slice(2);
      flags[name] = argv[i + 1];
      i += 1;
    } else {
      positional.push(a);
    }
  }
  return { flags: flags, positional: positional };
}

function readJsonFile(p) {
  const raw = fs.readFileSync(p, 'utf8');
  return JSON.parse(raw);
}

// ---------------------------------------------------------------------------
// compose-queries <domain.json>
// ---------------------------------------------------------------------------

function cmdComposeQueries(positional) {
  const file = positional[0];
  if (typeof file !== 'string' || file.length === 0) {
    return { code: 2, err: 'compose-queries requires a domain.json path' };
  }
  let input;
  try {
    input = readJsonFile(file);
  } catch (_e) {
    return { code: 2, err: 'compose-queries: cannot read or parse ' + file };
  }
  const envelope = composeLaneQueries(input);
  return { code: 0, out: envelope };
}

// ---------------------------------------------------------------------------
// audit-query <query.json>
// ---------------------------------------------------------------------------

function cmdAuditQuery(positional) {
  const file = positional[0];
  if (typeof file !== 'string' || file.length === 0) {
    return { code: 2, err: 'audit-query requires a query.json path' };
  }
  let input;
  try {
    input = readJsonFile(file);
  } catch (_e) {
    return { code: 2, err: 'audit-query: cannot read or parse ' + file };
  }
  const lane = (input && typeof input.lane === 'string') ? input.lane : '';
  const q = (input && typeof input.q === 'string') ? input.q : '';

  if (LANE_IDS.indexOf(lane) === -1) {
    return { code: 0, out: { ok: false, lane: lane, reason: 'unknown_lane' } };
  }

  const res = auditEditedQuery(q);
  if (res.ok) {
    return { code: 0, out: { ok: true, lane: lane, q: res.q } };
  }
  return { code: 0, out: { ok: false, lane: lane, reason: res.reason } };
}

// ---------------------------------------------------------------------------
// theo-structure [--reference <path>]
// ---------------------------------------------------------------------------

async function cmdTheoStructure(flags) {
  const opts = {};
  if (typeof flags.reference === 'string') {
    opts.referencePath = flags.reference;
  }
  const result = await readDominantDesignStructure(opts);
  return { code: 0, out: result };
}

// ---------------------------------------------------------------------------
// validate-lane <raw.json> --approved <gate.json> [--out <path>]
// ---------------------------------------------------------------------------

function cmdValidateLane(positional, flags) {
  const rawFile = positional[0];
  const approvedFile = flags.approved;
  const outFile = flags.out;

  if (typeof rawFile !== 'string' || rawFile.length === 0) {
    return { code: 2, err: 'validate-lane requires a <raw.json> path' };
  }
  if (typeof approvedFile !== 'string' || approvedFile.length === 0) {
    return { code: 2, err: 'validate-lane requires --approved <gate.json>' };
  }
  if (typeof outFile === 'string' && !/\.valid\.json$/.test(outFile)) {
    return { code: 2, err: 'validate-lane: --out must end in .valid.json' };
  }

  let raw;
  let gate;
  try {
    raw = readJsonFile(rawFile);
  } catch (_e) {
    return { code: 2, err: 'validate-lane: cannot read or parse ' + rawFile };
  }
  try {
    gate = readJsonFile(approvedFile);
  } catch (_e) {
    return { code: 2, err: 'validate-lane: cannot read or parse ' + approvedFile };
  }

  const laneId = (raw && typeof raw.lane === 'string') ? raw.lane : '';
  const gateLanes = (gate && Array.isArray(gate.lanes)) ? gate.lanes : [];
  const gateLane = gateLanes.find(function (l) { return l && l.id === laneId; });

  if (!gateLane) {
    return { code: 0, out: { ok: false, reason: 'lane_not_approved', lane: laneId } };
  }

  const approvedQueries = Array.isArray(gateLane.queries) ? gateLane.queries : [];
  const result = validateLaneResult(raw, { approvedQueries: approvedQueries });

  if (typeof outFile === 'string') {
    try {
      const outPath = path.isAbsolute(outFile) ? outFile : path.join(REPO_ROOT, outFile);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n', 'utf8');
    } catch (_e) {
      return { code: 2, err: 'validate-lane: cannot write ' + outFile };
    }
  }

  return { code: 0, out: result };
}

// ---------------------------------------------------------------------------
// file-pack -- filled in by Task 2. Task 1 leaves a stub so the router and
// the other four legs are fully testable before filing lands.
// ---------------------------------------------------------------------------

function cmdFilePack(_flags) {
  return { code: 2, err: 'file-pack: not implemented in this task' };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main(argv) {
  const args = Array.isArray(argv) ? argv : [];
  const sub = args[0];
  const rest = args.slice(1);

  if (SUBCOMMANDS.indexOf(sub) === -1) {
    process.stderr.write(USAGE + '\n');
    process.exitCode = 2;
    return;
  }

  const { flags, positional } = parseFlags(rest);
  let result;

  switch (sub) {
    case 'compose-queries':
      result = cmdComposeQueries(positional);
      break;
    case 'audit-query':
      result = cmdAuditQuery(positional);
      break;
    case 'theo-structure':
      result = await cmdTheoStructure(flags);
      break;
    case 'validate-lane':
      result = cmdValidateLane(positional, flags);
      break;
    case 'file-pack':
      result = await cmdFilePack(flags);
      break;
    default:
      result = { code: 2, err: USAGE };
      break;
  }

  if (result && typeof result.text === 'string') {
    process.stdout.write(result.text + (result.text.endsWith('\n') ? '' : '\n'));
  } else if (result && Object.prototype.hasOwnProperty.call(result, 'out')) {
    process.stdout.write(JSON.stringify(result.out, null, 2) + '\n');
  }
  if (result && typeof result.err === 'string') {
    process.stderr.write(result.err + '\n');
  }
  process.exitCode = (result && typeof result.code === 'number') ? result.code : 2;
}

if (require.main === module) {
  main(process.argv.slice(2));
}

module.exports = {
  main: main,
  parseFlags: parseFlags,
  cmdComposeQueries: cmdComposeQueries,
  cmdAuditQuery: cmdAuditQuery,
  cmdTheoStructure: cmdTheoStructure,
  cmdValidateLane: cmdValidateLane,
  cmdFilePack: cmdFilePack,
};
