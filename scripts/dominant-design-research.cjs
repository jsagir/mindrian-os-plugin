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
 * never requires the room-database substrate module directly. Every filed EvidenceClaim
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

const { composeLaneQueries, auditEditedQuery, LANE_IDS, LANES } = laneQueries;
const { validateLaneResult, renderLaneArtifact, toEvidenceClaimParams, laneArtifactName } = evidencePack;
const { readDominantDesignStructure } = theoStructure;

const SUBCOMMANDS = Object.freeze(['compose-queries', 'audit-query', 'theo-structure', 'validate-lane', 'file-pack']);

const USAGE = 'usage: dominant-design-research.cjs <' + SUBCOMMANDS.join('|') + '> ...';

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_JSON_SUFFIX = '.valid.json';

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
// file-pack: lane artifacts, EvidenceClaim filing with readback, 4-zone
// report (Task 2).
// ---------------------------------------------------------------------------

function isExistingDir(p) {
  try {
    return typeof p === 'string' && p.length > 0 && fs.statSync(p).isDirectory();
  } catch (_e) {
    return false;
  }
}

function laneDisplayLabel(laneId) {
  const lane = LANES.find(function (l) { return l.id === laneId; });
  return lane ? lane.label : laneId;
}

function pad(value, width) {
  const s = String(value);
  return s.length >= width ? s + ' ' : s + ' '.repeat(width - s.length);
}

// fileLane(db, valid, opts) -- writes ONE lane's artifact under
// <roomDir>/competitive-analysis/dominant-designs/, then (when db is
// non-null) files each toEvidenceClaimParams entry through
// navigation.fileEvidenceWithReadback with readback. `valid` is a
// validateLaneResult({ok:true}) envelope. opts = { roomDir, slug, date,
// sessionId, retrievedAt }. Never opens or closes db (the caller owns the
// handle across every lane in a pack); never writes outside roomDir.
function fileLane(db, valid, opts) {
  const o = opts || {};
  const roomDir = o.roomDir;
  const slug = o.slug;
  const date = o.date;
  const sessionId = o.sessionId;
  const retrievedAt = o.retrievedAt;

  const artifactText = renderLaneArtifact(valid, {
    domain_slug: slug,
    date: date,
    retrieved_at: retrievedAt,
  });

  const roomAbs = path.resolve(roomDir);
  const packDirAbs = path.join(roomAbs, 'competitive-analysis', 'dominant-designs');
  const filename = laneArtifactName(slug, date, valid.lane);
  const targetAbs = path.resolve(path.join(packDirAbs, filename));

  if (targetAbs !== roomAbs && targetAbs.indexOf(roomAbs + path.sep) !== 0) {
    throw new Error('fileLane: computed artifact path escapes the room directory: ' + targetAbs);
  }

  fs.mkdirSync(packDirAbs, { recursive: true });
  fs.writeFileSync(targetAbs, artifactText, 'utf8');

  const relPath = path.relative(roomAbs, targetAbs).split(path.sep).join('/');

  const result = {
    lane: valid.lane,
    ok: true,
    reason: null,
    artifact_path: relPath,
    rows: valid.rows.length,
    counts: valid.counts,
    not_found_count: Array.isArray(valid.searched_not_found) ? valid.searched_not_found.length : 0,
    filed: 0,
    landed: 0,
    not_landed: [],
    message: '',
  };

  if (!db) {
    result.message = 'wrote ' + relPath + '; no evidence nodes were filed because room.db was not found';
    return result;
  }

  const params = toEvidenceClaimParams(valid, { sessionId: sessionId, artifact_path: relPath });
  result.filed = params.length;

  params.forEach(function (p) {
    const res = navigation.fileEvidenceWithReadback(db, p);
    navigation.surfaceFileEvidenceResult(res);
    if (res && res.ok === true) {
      result.landed += 1;
    } else {
      result.not_landed.push({ url: p.url, reason: (res && res.reason) || 'unknown' });
    }
  });

  if (params.length === 0) {
    result.message = 'wrote ' + relPath + '; no sourced evidence to file for this lane';
  } else if (result.not_landed.length === 0) {
    result.message = 'wrote ' + relPath + '; filed and confirmed ' + result.landed + ' evidence claim(s)';
  } else {
    result.message = 'wrote ' + relPath + '; ' + result.landed + ' landed, ' + result.not_landed.length + ' not landed';
  }

  return result;
}

// filePack(opts) -- validates flags, reads every *.valid.json in opts.pack
// (in LANE_IDS order), opens navigation.openRoomDbForCaller(roomDir) ONCE,
// runs fileLane per lane, and closes the handle in finally. Returns
// {usageError} on a bad flag (nothing written), otherwise the full pack
// result {ok, room_db, reason, filed, lanes}.
function filePack(opts) {
  const o = opts || {};
  const packDir = o.pack;
  const roomDir = o.room;
  const slug = o.domainSlug;
  const date = o.date;

  if (typeof slug !== 'string' || slug.length === 0 || slug.length > 60 || !SLUG_RE.test(slug)) {
    return { usageError: 'file-pack: --domain-slug must be lowercase, hyphenated, at most 60 chars' };
  }
  if (typeof date !== 'string' || !DATE_RE.test(date)) {
    return { usageError: 'file-pack: --date must be YYYY-MM-DD' };
  }
  if (!isExistingDir(roomDir)) {
    return { usageError: 'file-pack: --room must be an existing directory' };
  }
  if (!isExistingDir(packDir)) {
    return { usageError: 'file-pack: --pack must be an existing directory' };
  }

  const sessionId = (typeof o.sessionId === 'string' && o.sessionId.length > 0)
    ? o.sessionId
    : 'dominant-designs:' + slug + ':' + date;
  const retrievedAt = (typeof o.retrievedAt === 'string' && o.retrievedAt.length > 0) ? o.retrievedAt : date;

  let entries;
  try {
    entries = fs.readdirSync(packDir).filter(function (f) { return f.endsWith(VALID_JSON_SUFFIX); });
  } catch (_e) {
    return { usageError: 'file-pack: cannot read --pack directory' };
  }

  const laneFiles = [];
  entries.forEach(function (f) {
    const laneId = f.slice(0, -VALID_JSON_SUFFIX.length);
    if (LANE_IDS.indexOf(laneId) !== -1) {
      laneFiles.push({ laneId: laneId, file: path.join(packDir, f) });
    }
  });
  laneFiles.sort(function (a, b) { return LANE_IDS.indexOf(a.laneId) - LANE_IDS.indexOf(b.laneId); });

  const db = navigation.openRoomDbForCaller(roomDir);
  const roomDbPresent = !!db;
  const lanes = [];
  let totalFiled = 0;

  try {
    laneFiles.forEach(function (entry) {
      let parsed;
      try {
        parsed = JSON.parse(fs.readFileSync(entry.file, 'utf8'));
      } catch (_e) {
        lanes.push({
          lane: entry.laneId,
          ok: false,
          reason: 'unreadable_valid_json',
          artifact_path: null,
          rows: 0,
          filed: 0,
          landed: 0,
          not_landed: [],
          message: 'lane not run: could not read or parse ' + entry.file,
        });
        return;
      }
      if (!parsed || parsed.ok !== true) {
        const reason = (parsed && typeof parsed.reason === 'string') ? parsed.reason : 'invalid';
        lanes.push({
          lane: entry.laneId,
          ok: false,
          reason: reason,
          artifact_path: null,
          rows: 0,
          filed: 0,
          landed: 0,
          not_landed: [],
          message: 'lane not run: ' + reason,
        });
        return;
      }
      let laneResult;
      try {
        laneResult = fileLane(db, parsed, {
          roomDir: roomDir,
          slug: slug,
          date: date,
          sessionId: sessionId,
          retrievedAt: retrievedAt,
        });
      } catch (e) {
        laneResult = {
          lane: entry.laneId,
          ok: false,
          reason: 'file_lane_failed',
          artifact_path: null,
          rows: 0,
          filed: 0,
          landed: 0,
          not_landed: [],
          message: 'lane not run: ' + String(e && e.message ? e.message : e).slice(0, 120),
        };
      }
      totalFiled += laneResult.filed;
      lanes.push(laneResult);
    });
  } finally {
    navigation.closeRoomDbForCaller(db);
  }

  return {
    ok: roomDbPresent,
    room_db: roomDbPresent,
    reason: roomDbPresent ? null : 'no_room_db',
    filed: totalFiled,
    lanes: lanes,
  };
}

// renderFilingReport(packResult, opts) -- the 4-zone text report. Zone 1
// header, Zone 2 body table, no Zone 3 (methodology session), Zone 4 footer
// with one primary and two alternative real /mos: commands (skills/ui-system
// SKILL.md section 1). Plain ASCII, no ANSI color, no em-dashes.
function renderFilingReport(packResult, opts) {
  const o = opts || {};
  const roomLabel = (typeof o.roomLabel === 'string' && o.roomLabel.length > 0)
    ? o.roomLabel
    : ((typeof o.roomDirBasename === 'string' && o.roomDirBasename.length > 0) ? o.roomDirBasename : 'no room');
  const stage = (typeof o.stage === 'string' && o.stage.length > 0) ? o.stage : 'unknown stage';

  const lines = [];
  lines.push('-- ' + roomLabel + ' -- competitive-analysis -- ' + stage + ' --');
  lines.push('');
  lines.push(pad('Lane', 24) + pad('Kept', 6) + pad('Dropped', 9) + pad('NotFound', 10) + 'Result');
  lines.push(pad('----', 24) + pad('----', 6) + pad('-------', 9) + pad('--------', 10) + '------');

  (packResult.lanes || []).forEach(function (lane) {
    const label = laneDisplayLabel(lane.lane);
    const counts = lane.counts || { dropped_unsourced: 0, dropped_scored: 0, dropped_over_cap: 0 };
    const dropped = (counts.dropped_unsourced || 0) + (counts.dropped_scored || 0) + (counts.dropped_over_cap || 0);
    const notFound = lane.not_found_count || 0;

    let resultCell;
    if (lane.ok === false) {
      resultCell = 'NOT RUN (' + lane.reason + ')';
    } else if (!packResult.room_db) {
      resultCell = 'NOT LANDED (room.db not found)';
    } else if (lane.not_landed && lane.not_landed.length > 0) {
      resultCell = 'NOT LANDED (' + lane.landed + '/' + lane.filed + ')';
    } else {
      resultCell = lane.filed + ' filed';
    }

    lines.push(pad(label, 24) + pad(String(lane.rows || 0), 6) + pad(String(dropped), 9) + pad(String(notFound), 10) + resultCell);
  });

  lines.push('');
  if (!packResult.room_db) {
    lines.push('The lane files were written; no evidence nodes were filed because room.db was not found.');
    lines.push('');
  }

  lines.push('> /mos:find-bottlenecks - surface the gaps and contradictions this evidence pack raises');
  lines.push('> /mos:macro-trends - zoom out to the macro forces shaping this domain');
  lines.push('> /mos:explore-trends - branch into an adjacent trend worth tracking');

  return lines.join('\n');
}

function cmdFilePack(flags) {
  const opts = {
    pack: flags.pack,
    room: flags.room,
    domainSlug: flags['domain-slug'],
    date: flags.date,
    sessionId: flags.session,
  };
  const result = filePack(opts);
  if (result && typeof result.usageError === 'string') {
    return { code: 2, err: result.usageError };
  }
  if (flags.json) {
    return { code: 0, out: result };
  }
  const roomDirBasename = (typeof flags.room === 'string' && flags.room.length > 0) ? path.basename(flags.room) : 'no room';
  const text = renderFilingReport(result, {
    roomLabel: flags['room-label'],
    stage: flags.stage,
    roomDirBasename: roomDirBasename,
  });
  return { code: 0, text: text };
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
  fileLane: fileLane,
  filePack: filePack,
  renderFilingReport: renderFilingReport,
};
