#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 216-02 -- the thin /mos:eureka dispatcher. commands/eureka.md (Plan 03)
 * resolves the navigator's active room and shells THIS script; the script runs
 * the shipped portfolio engine against that room and hands back the rendered
 * report as the durable artifact (D-05 fire-and-return, not block-and-wait).
 *
 * ONE governed path. This dispatcher does NOT resolve rooms itself (SEED-034
 * one-door rule): the command body passes ROOM_DIR in. It only resolves the
 * SUBSTRATE per room, runs the engine, and maintains a status file so a detached
 * scan is observable.
 *
 * SUBSTRATE RESOLUTION (the anti-JHU-default rule, 216-RESEARCH.md):
 *   explicit --graph <path>              -> pairs graph against that file
 *   else <ROOM_DIR>/.mindrian/idea-graph.json exists -> pairs graph against it
 *   else                                 -> pairs room (room-native, NO --graph)
 * It NEVER falls through to the runner's DEFAULT_GRAPH: the JHU fixture is
 * someone else's data and must never be the default on a user room.
 *
 * CANON POSTURE:
 *   - Part 8 (Graph Boundary): ZERO network. No URL, no socket, no fetch. The
 *     runner it shells is itself egress-free; this wrapper adds none.
 *   - Part 9 (Memory Locality): report-only v1 (D-03). Writes ONLY under
 *     <ROOM_DIR>/.mindrian/eureka/ (the report .md/.json + status.json) plus the
 *     runner's own derived eureka_* projection tables. ZERO writes to nodes,
 *     edges, or memory_event; banking an Opportunity Statement as a graph node is
 *     a later phase's governed wiring.
 *
 * CJS, node built-ins only, process.argv switch-case router (no Commander/yargs).
 * No em-dashes, no emoji anywhere.
 *
 * Usage:
 *   node scripts/eureka-command.cjs ROOM_DIR SUBCOMMAND [--top <n>] [--offline] [--graph <path>]
 *   node scripts/eureka-command.cjs --help
 *
 * Subcommands:
 *   run       run the scan in-process; write the report + status.json; block until done
 *   start     fire-and-return: spawn the scan detached, print paths, exit 0 immediately
 *   status    print the status.json as one JSON line (or {"state":"none"})
 *   report    print the report JSON to stdout (or a 3-line error if none yet)
 *   help      show usage
 *
 * T-218-VD-5 (the 218-CONTEXT.md D-03 "deferred, not rejected" pre-step, now
 * built): `run` extracts entities first via scripts/entity-extract.cjs when
 * the room has content newer than the last successful extraction -- one
 * command reads the room, not two. Freshness-gated (skips when nothing
 * changed) and best-effort but SURFACED (a failed extraction never blocks
 * ranking, but now lands in the eureka status.json as extraction_error plus
 * one stderr line, so a silent pre-step failure is impossible to miss).
 * entity-extract.cjs itself stays a standalone script with zero new
 * command surface (D-03 unchanged); this is a plain require, not a new
 * /mos: subcommand. Opt out with --no-extract.
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const RUNNER = require('./eureka-portfolio-report.cjs');
// T-218-VD-5: the D-03 deferred idea, now built. entity-extract.cjs stays a
// standalone script (D-03 -- zero new command surface); this is a plain
// require, not a new /mos: subcommand. See the freshness-gate block below.
const ENTITY_EXTRACT = require('./entity-extract.cjs');

// ---------------------------------------------------------------------------
// Path contract: everything this command writes lives under here.
// ---------------------------------------------------------------------------

function reportDir(roomDir) { return path.join(roomDir, '.mindrian', 'eureka'); }
function outMd(roomDir) { return path.join(reportDir(roomDir), 'portfolio-report.md'); }
function outJson(roomDir) { return path.join(reportDir(roomDir), 'portfolio-report.json'); }
function statusPath(roomDir) { return path.join(reportDir(roomDir), 'status.json'); }
function roomGraphPath(roomDir) { return path.join(roomDir, '.mindrian', 'idea-graph.json'); }

// ---------------------------------------------------------------------------
// Small helpers.
// ---------------------------------------------------------------------------

function dirExists(p) {
  try { return fs.statSync(p).isDirectory(); } catch (_e) { return false; }
}

function fileExists(p) {
  try { return fs.statSync(p).isFile(); } catch (_e) { return false; }
}

// The 3-line What / Why / Fix error, to stderr. Never a stack trace: a clean,
// actionable message the command body can surface verbatim.
function printError(what, why, fix) {
  process.stderr.write('eureka: ' + what + '\n');
  process.stderr.write('  Why: ' + why + '\n');
  process.stderr.write('  Fix: ' + fix + '\n');
}

function writeStatus(roomDir, obj) {
  fs.mkdirSync(reportDir(roomDir), { recursive: true });
  fs.writeFileSync(statusPath(roomDir), JSON.stringify(obj) + '\n', 'utf8');
}

// ---------------------------------------------------------------------------
// T-218-VD-5: freshness-gated entity-extraction pre-step (218-CONTEXT.md D-03
// "deferred, not rejected" idea -- built once a real session hit the two-step
// manual-sequencing gap it was watching for). `eureka run` now extracts first
// when the room's content is newer than the last successful extraction, so
// one command reads the room instead of two. Best-effort, never blocking, but
// SURFACED: a failed extraction still lets ranking proceed on whatever
// entities the room already has (the T-218-10 degrade-never-throw precedent),
// while its failure detail is now written into the eureka status.json as
// extraction_error plus one stderr line rather than silently swallowed.
// ---------------------------------------------------------------------------

function entityExtractStatusPath(roomDir) {
  return path.join(roomDir, '.mindrian', 'entity-extract', 'status.json');
}

// The newest mtime among the room's real .md artifact files (every section
// directory, not just the six memory-kinded basenames -- mirrors
// entity-extract.cjs's own extend-to-artifacts coverage, T-218-VD-4). A room
// with no section directories (e.g. a DB-only hermetic test fixture) returns
// 0, which correctly means "nothing to extract" rather than "always stale".
//
// BUGFIX (2026-07-13, live-discovered against a real room, not a fixture):
// the original walk went exactly ONE directory level deep
// (roomDir/section/*.md), which never sees an artifact filed under this
// codebase's OWN standard nested layout -- `section/name/name.md`, one
// folder per artifact (decisions.md #16, "every .mos artifact sits in its
// own folder"). Since that IS the standard filing shape (every navigation.cjs
// write, ingestUrl included, lands there), the one-level walk was
// structurally blind to nearly every real artifact ever filed: the
// freshness gate always read "nothing changed" against a room with real,
// newer content, so `eureka run` silently never re-extracted. Caught live
// on aion-eureka-synergy: a fresh ingestUrl() artifact at
// research/<slug>/<slug>.md never tripped the gate; entity-extract.cjs run
// directly picked it up fine (38->65 artifacts), proving the extractor
// itself was always correct -- only this mtime probe was shallow. Fixed by
// walking to MAX_WALK_DEPTH (generous; a room directory is never
// pathologically deep), still skipping dot-directories (`.mindrian`,
// `.room-graph`, `.git`) at every depth, never just the top one.
var MAX_WALK_DEPTH = 8;
function newestArtifactMtimeMs(roomDir) {
  let newest = 0;
  function walk(dir, depth) {
    if (depth > MAX_WALK_DEPTH) return;
    let dirents = [];
    try { dirents = fs.readdirSync(dir, { withFileTypes: true }); } catch (_e) { return; }
    for (let i = 0; i < dirents.length; i += 1) {
      const d = dirents[i];
      if (d.name.charAt(0) === '.') continue; // skip dot-dirs/files at EVERY depth
      const abs = path.join(dir, d.name);
      if (d.isDirectory()) {
        walk(abs, depth + 1);
      } else if (/\.md$/i.test(d.name)) {
        try {
          const st = fs.statSync(abs);
          if (st.mtimeMs > newest) newest = st.mtimeMs;
        } catch (_e) { /* unreadable file, skip */ }
      }
    }
  }
  walk(roomDir, 0);
  return newest;
}

// True when extraction has never succeeded, or the room has content newer
// than the last successful run. Defensive on every malformed-input path
// (missing/corrupt status.json) -- when in doubt, extract; a redundant
// extraction is idempotent (UPSERT-keyed), never harmful, only slower.
function needsExtraction(roomDir) {
  let status = null;
  try { status = JSON.parse(fs.readFileSync(entityExtractStatusPath(roomDir), 'utf8')); } catch (_e) { status = null; }
  if (!status || status.state !== 'done' || typeof status.finished_at !== 'string') return true;
  const finishedMs = Date.parse(status.finished_at);
  if (!Number.isFinite(finishedMs)) return true;
  return newestArtifactMtimeMs(roomDir) > finishedMs;
}

// The pre-step itself. Best-effort but SURFACED: failures land in the eureka
// status.json as an extraction_error field plus one stderr line, and ranking
// is STILL never blocked (T-218-10 degrade-never-throw precedent, restated for
// this call site). Returns the failure-detail string on either failure path,
// or null on skip / success. Two failure paths exist and both are surfaced:
//   (a) a throw escaping ENTITY_EXTRACT.main (bare-caught here historically);
//   (b) a non-zero return code -- entity-extract.cjs's own cmdRun catches ALL
//       its internal errors, writes a state 'failed' status.json with the real
//       message, and RETURNS 1 without throwing. Path (b) is the likelier
//       production mechanism (openRoomDb failure, extraction crash), and its
//       diagnostic trail already exists on disk; we now read and surface it.
async function maybeExtractFirst(roomDir, opts) {
  if (opts && opts.noExtract) return null;
  let stale = true;
  try { stale = needsExtraction(roomDir); } catch (_e) { stale = true; }
  if (!stale) return null;
  let detail = null;
  try {
    const code = await ENTITY_EXTRACT.main([roomDir, 'run']);
    if (typeof code === 'number' && code !== 0) {
      let statusErr = null;
      try {
        const st = JSON.parse(fs.readFileSync(entityExtractStatusPath(roomDir), 'utf8'));
        if (st && typeof st.error === 'string' && st.error) statusErr = st.error;
      } catch (_e) { statusErr = null; }
      detail = 'entity extraction exited ' + code + ': ' + (statusErr || ('see ' + entityExtractStatusPath(roomDir)));
    }
  } catch (err) {
    const firstLine = String(err && err.message ? err.message : err).split('\n')[0];
    detail = 'entity extraction threw: ' + firstLine;
  }
  if (detail) {
    // Exactly ONE stderr line. The status.json field is the durable trail on
    // the detached cmdStart path (stdio 'ignore'); stderr is the foreground
    // one. Ranking is never blocked and exit codes are never altered.
    process.stderr.write('eureka: entity-extraction pre-step failed (' + detail + '); ranking proceeds on existing graph data\n');
    return detail;
  }
  return null;
}

const USAGE = [
  '/mos:eureka -- portfolio-scale opportunity scan over the active room.',
  '',
  'Usage:',
  '  node scripts/eureka-command.cjs ROOM_DIR SUBCOMMAND [--top <n>] [--offline] [--graph <path>]',
  '',
  'Subcommands:',
  '  run       run the scan in-process; write the report + status.json; block until done',
  '  start     fire-and-return: spawn the scan detached, print paths, exit 0 immediately',
  '  status    print status.json as one JSON line (or {"state":"none"})',
  '  report    print the report JSON to stdout (or a 3-line error if none yet)',
  '  help      show this usage',
  '',
  'Flags:',
  '  --top <n>       keep the top N ranked pairs (default 25)',
  '  --offline       deterministic stub encoder (no model)',
  '  --graph <path>  explicit idea-graph substrate override',
  '  --no-extract    skip the automatic entity-extraction pre-step on run',
].join('\n');

// ---------------------------------------------------------------------------
// argv parse: ROOM_DIR SUBCOMMAND [flags].
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const out = { roomDir: null, sub: null, top: 25, offline: false, graph: null, topProvided: false, help: false, noExtract: false };
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    switch (a) {
      case '-h':
      case '--help': out.help = true; break;
      case '--offline': out.offline = true; break;
      case '--no-extract': out.noExtract = true; break;
      case '--top': out.top = parseInt(argv[i += 1], 10); out.topProvided = true; break;
      case '--graph': out.graph = argv[i += 1]; break;
      default: positional.push(a); break;
    }
  }
  if (!Number.isFinite(out.top) || out.top <= 0) out.top = 25;
  out.roomDir = positional[0] || null;
  out.sub = (positional[1] || '').toLowerCase();
  return out;
}

// Resolve the substrate for this room per the anti-JHU-default rule. Returns
// { mode: 'graph'|'room', graph: <path>|null } or { error: {what,why,fix} }.
function resolveSubstrate(roomDir, explicitGraph) {
  if (explicitGraph) {
    const g = path.isAbsolute(explicitGraph) ? explicitGraph : path.resolve(explicitGraph);
    if (!fileExists(g)) {
      return { error: { what: 'idea-graph not found', why: g + ' does not exist', fix: 'pass an existing --graph path, or omit it to use the room-native substrate' } };
    }
    return { mode: 'graph', graph: g };
  }
  const local = roomGraphPath(roomDir);
  if (fileExists(local)) return { mode: 'graph', graph: local };
  return { mode: 'room', graph: null };
}

// Build the runner argv for a resolved substrate.
function runnerArgv(roomDir, sub, top, offline) {
  const args = ['--db', roomDir, '--pairs', sub.mode, '--top', String(top), '--out', outMd(roomDir), '--json', outJson(roomDir)];
  if (sub.mode === 'graph' && sub.graph) { args.push('--graph', sub.graph); }
  if (offline) { args.push('--offline'); }
  return args;
}

// ---------------------------------------------------------------------------
// Subcommands.
// ---------------------------------------------------------------------------

async function cmdRun(opts) {
  const roomDir = opts.roomDir;
  if (!dirExists(roomDir)) {
    printError('room directory not found', String(roomDir) + ' is not a directory', 'pass a valid room path, or run /mos:new-project');
    return 1;
  }

  // T-218-VD-5: extract first when the room has content newer than the last
  // successful extraction (or has never been extracted). Best-effort but
  // SURFACED -- never blocks ranking on failure, but a failure detail is
  // threaded into every status.json payload below as extraction_error (and a
  // one-line stderr note was already written by maybeExtractFirst). Opt out
  // with --no-extract. Null when the pre-step skipped or succeeded.
  const extractionError = await maybeExtractFirst(roomDir, opts);

  const sub = resolveSubstrate(roomDir, opts.graph);
  if (sub.error) {
    printError(sub.error.what, sub.error.why, sub.error.fix);
    return 1;
  }

  const startedAt = new Date().toISOString();
  writeStatus(roomDir, {
    state: 'running',
    started_at: startedAt,
    pid: process.pid,
    out: outMd(roomDir),
    json: outJson(roomDir),
    ...(extractionError ? { extraction_error: extractionError } : {}),
  });

  try {
    const code = await RUNNER.main(runnerArgv(roomDir, sub, opts.top, opts.offline));
    if (code === 0) {
      writeStatus(roomDir, {
        state: 'done',
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        pid: process.pid,
        out: outMd(roomDir),
        json: outJson(roomDir),
        ...(extractionError ? { extraction_error: extractionError } : {}),
      });
      return 0;
    }
    writeStatus(roomDir, {
      state: 'failed',
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      pid: process.pid,
      out: outMd(roomDir),
      json: outJson(roomDir),
      error: 'runner exited with code ' + code,
      ...(extractionError ? { extraction_error: extractionError } : {}),
    });
    printError('eureka scan failed', 'the portfolio runner exited with code ' + code, 'inspect ' + statusPath(roomDir) + ' then re-run /mos:eureka');
    return 1;
  } catch (err) {
    const msg = String(err && err.message ? err.message : err).split('\n')[0];
    writeStatus(roomDir, {
      state: 'failed',
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      pid: process.pid,
      out: outMd(roomDir),
      json: outJson(roomDir),
      error: msg,
      ...(extractionError ? { extraction_error: extractionError } : {}),
    });
    printError('eureka scan failed', msg, 'inspect ' + statusPath(roomDir) + ' then re-run /mos:eureka');
    return 1;
  }
}

function cmdStart(opts) {
  const roomDir = opts.roomDir;
  if (!dirExists(roomDir)) {
    printError('room directory not found', String(roomDir) + ' is not a directory', 'pass a valid room path, or run /mos:new-project');
    return 1;
  }
  // Pre-resolve so an obviously bad explicit --graph fails BEFORE we detach.
  const sub = resolveSubstrate(roomDir, opts.graph);
  if (sub.error) {
    printError(sub.error.what, sub.error.why, sub.error.fix);
    return 1;
  }
  fs.mkdirSync(reportDir(roomDir), { recursive: true });

  const forwarded = [];
  if (opts.topProvided) forwarded.push('--top', String(opts.top));
  if (opts.offline) forwarded.push('--offline');
  if (opts.graph) forwarded.push('--graph', opts.graph);

  const child = spawn(process.execPath, [__filename, roomDir, 'run'].concat(forwarded), {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();

  process.stdout.write('eureka scan started (background)\n');
  process.stdout.write('report: ' + outMd(roomDir) + '  status: ' + statusPath(roomDir) + '\n');
  return 0;
}

function cmdStatus(opts) {
  const roomDir = opts.roomDir;
  const sp = statusPath(roomDir);
  if (fileExists(sp)) {
    let parsed = null;
    try { parsed = JSON.parse(fs.readFileSync(sp, 'utf8')); } catch (_e) { parsed = null; }
    if (parsed) {
      process.stdout.write(JSON.stringify(parsed) + '\n');
      return 0;
    }
  }
  process.stdout.write(JSON.stringify({ state: 'none' }) + '\n');
  return 0;
}

function cmdReport(opts) {
  const roomDir = opts.roomDir;
  const jp = outJson(roomDir);
  if (!fileExists(jp)) {
    printError('no eureka report yet', 'no completed scan for this room', 'run /mos:eureka');
    return 1;
  }
  process.stdout.write(fs.readFileSync(jp, 'utf8'));
  return 0;
}

// ---------------------------------------------------------------------------
// main -- the testable seam. Returns a numeric exit code (async for run).
// ---------------------------------------------------------------------------

async function main(argv) {
  const opts = parseArgs(argv);

  if (opts.help || !opts.roomDir) {
    process.stdout.write(USAGE + '\n');
    return 0;
  }

  switch (opts.sub) {
    case 'run': return cmdRun(opts);
    case 'start': return cmdStart(opts);
    case 'status': return cmdStatus(opts);
    case 'report': return cmdReport(opts);
    case 'help': process.stdout.write(USAGE + '\n'); return 0;
    default:
      printError('unknown subcommand', 'no subcommand "' + opts.sub + '"', 'run one of: run | start | status | report | help');
      return 1;
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).then(function (code) { process.exit(code); });
}

module.exports = { main: main };
