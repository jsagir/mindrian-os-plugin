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
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const RUNNER = require('./eureka-portfolio-report.cjs');

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
].join('\n');

// ---------------------------------------------------------------------------
// argv parse: ROOM_DIR SUBCOMMAND [flags].
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const out = { roomDir: null, sub: null, top: 25, offline: false, graph: null, topProvided: false, help: false };
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    switch (a) {
      case '-h':
      case '--help': out.help = true; break;
      case '--offline': out.offline = true; break;
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
