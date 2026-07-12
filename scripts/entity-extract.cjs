#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 218-03 (D-03) -- the standalone entity-extraction pipeline dispatcher.
 *
 * This is a verbatim SHAPE-CLONE of scripts/eureka-command.cjs: a process.argv
 * switch-case router (no Commander/yargs -- CLAUDE.md convention) with the verbs
 * run | start | status | report | help, a positional ROOM_DIR SUBCOMMAND, the
 * 3-line What/Why/Fix error (never a stack trace), a status.json for observable
 * detached runs, and a main(argv) that returns a numeric exit code (the testable
 * seam via module.exports = { main }).
 *
 * WHY a standalone script and NOT a /mos: command (D-03): this adds ZERO Canon
 * Part 11 CIRS surface. There is no new command, agent, pipeline, or skill to
 * govern -- build-connector-registry.cjs --check must stay green as proof no
 * surface leaked. The pipeline is a plain script the navigator (or a future
 * governed command) shells.
 *
 * WHAT it does (the vertical wiring that makes Phase 218 real):
 *   1. openRoomDb(roomDir, { allowExtension: true }) -- single-writer,
 *      open-work-close, with the Plan 218-02 D-05 busy-wait window.
 *   2. Walk the room's artifact .md files via the memory_artifact provenance map
 *      (each memory_artifact node carries props.path -> its .md file), reading the
 *      real prose off disk.
 *   3. extractEntities(text, { sourceArtifactId }) (Plan 218-02) per artifact ->
 *      bounded, typed {entities, relations} candidates, zero egress.
 *   4. ONE explicit D-05 BEGIN/COMMIT/ROLLBACK transaction (node:sqlite has NO
 *      .transaction() helper, RESEARCH Pitfall 3) around the whole batch:
 *      navigation.writeEntityNode per entity, navigation.writeEdge per
 *      entity->artifact DESCRIBES link and per entity->entity relation. A
 *      mid-batch error rolls back ALL of it (T-218-09).
 *   5. AFTER commit, a route-a best-effort re-embed via the EXISTING
 *      tri-modal-index.indexNodes path (REQ-3), in its OWN try/catch that degrades
 *      to lexical-only and NEVER throws or rolls back the entity writes (T-218-10,
 *      the degrade-never-throw contract).
 *
 * CANON POSTURE:
 *   - Part 8 (Graph Boundary): ZERO network. No URL, no socket, no fetch. Both the
 *     extractor and the re-embed use the already-vendored local paths only.
 *   - Part 9 (Memory Locality): every entity node is born review_status='proposed'
 *     via navigation.writeEntityNode; only a human confirmNode promotes it. This
 *     script writes ONLY through the navigation chokepoint -- NO raw INSERT INTO
 *     nodes/edges anywhere (the aggregator greps for this).
 *
 * CJS, node built-ins only, process.argv switch-case router. No em-dashes, no
 * emoji anywhere.
 *
 * Usage:
 *   node scripts/entity-extract.cjs ROOM_DIR SUBCOMMAND [--session <id>] [--max <n>]
 *   node scripts/entity-extract.cjs --help
 *
 * Subcommands:
 *   run       run the extraction in-process; write nodes+edges + status.json; block until done
 *   start     fire-and-return: spawn the run detached, print paths, exit 0 immediately
 *   status    print status.json as one JSON line (or {"state":"none"})
 *   report    print a one-line human summary of the last run (or a 3-line error)
 *   help      show usage
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const { openRoomDb, closeRoomDb } = require('../lib/core/room-db.cjs');
const navigation = require('../lib/core/navigation.cjs');
const { extractEntities } = require('../lib/core/eureka/entity-extractor.cjs');
const triModal = require('../lib/core/eureka/tri-modal-index.cjs');

// ---------------------------------------------------------------------------
// Path contract: everything this command writes lives under here. The subdir is
// .mindrian/entity-extract/ -- it NEVER collides with .mindrian/eureka/ (Pitfall
// 5: two independent pipelines must not share a status.json).
// ---------------------------------------------------------------------------

function reportDir(roomDir) { return path.join(roomDir, '.mindrian', 'entity-extract'); }
function statusPath(roomDir) { return path.join(reportDir(roomDir), 'status.json'); }

// ---------------------------------------------------------------------------
// Small helpers (verbatim from eureka-command.cjs).
// ---------------------------------------------------------------------------

function dirExists(p) {
  try { return fs.statSync(p).isDirectory(); } catch (_e) { return false; }
}

function fileExists(p) {
  try { return fs.statSync(p).isFile(); } catch (_e) { return false; }
}

// The 3-line What / Why / Fix error, to stderr. Never a stack trace.
function printError(what, why, fix) {
  process.stderr.write('entity-extract: ' + what + '\n');
  process.stderr.write('  Why: ' + why + '\n');
  process.stderr.write('  Fix: ' + fix + '\n');
}

function writeStatus(roomDir, obj) {
  fs.mkdirSync(reportDir(roomDir), { recursive: true });
  fs.writeFileSync(statusPath(roomDir), JSON.stringify(obj) + '\n', 'utf8');
}

const USAGE = [
  'entity-extract -- tier-1 entity extraction over a room, writing proposed',
  'company/technology/market nodes + typed edges through navigation.',
  '',
  'Usage:',
  '  node scripts/entity-extract.cjs ROOM_DIR SUBCOMMAND [--session <id>] [--max <n>]',
  '',
  'Subcommands:',
  '  run       run the extraction in-process; write nodes+edges + status.json; block until done',
  '  start     fire-and-return: spawn the run detached, print paths, exit 0 immediately',
  '  status    print status.json as one JSON line (or {"state":"none"})',
  '  report    print a one-line human summary of the last run (or a 3-line error)',
  '  help      show this usage',
  '',
  'Flags:',
  '  --session <id>  the session id every extracted node is minted under (default entity-extract)',
  '  --max <n>       maxPerArtifact extraction cap forwarded to the extractor (default 25)',
].join('\n');

// ---------------------------------------------------------------------------
// argv parse: ROOM_DIR SUBCOMMAND [flags].
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const out = { roomDir: null, sub: null, session: 'entity-extract', max: 25, sessionProvided: false, maxProvided: false, help: false };
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    switch (a) {
      case '-h':
      case '--help': out.help = true; break;
      case '--session': out.session = String(argv[i += 1] || ''); out.sessionProvided = true; break;
      case '--max': out.max = parseInt(argv[i += 1], 10); out.maxProvided = true; break;
      default: positional.push(a); break;
    }
  }
  if (!out.session) out.session = 'entity-extract';
  if (!Number.isFinite(out.max) || out.max <= 0) out.max = 25;
  out.roomDir = positional[0] || null;
  out.sub = (positional[1] || '').toLowerCase();
  return out;
}

// ---------------------------------------------------------------------------
// The extraction core: walk artifacts, extract, batch-write through navigation.
// Returns { artifacts, entitiesWritten, edgesWritten, embedded }.
// ---------------------------------------------------------------------------

// Collect the room's artifact prose keyed by its memory_artifact node id. Each
// memory_artifact node carries props.path (its .md file relative to roomDir); we
// read the real file off disk. Using the node table as the artifact index (a) is
// the same source of truth eureka reads and (b) guarantees every DESCRIBES edge
// targets a materialized memory_artifact node.
function collectArtifacts(db, roomDir) {
  const rows = db.prepare("SELECT id, properties FROM nodes WHERE type = 'memory_artifact'").all();
  const artifacts = [];
  for (const row of rows) {
    let props = {};
    try { props = JSON.parse(row.properties || '{}'); } catch (_e) { props = {}; }
    const rel = props && typeof props.path === 'string' ? props.path : null;
    if (!rel) continue;
    const abs = path.join(roomDir, rel);
    let text = null;
    try { text = fs.readFileSync(abs, 'utf8'); } catch (_e) { text = null; }
    if (!text) continue;
    artifacts.push({ artifactId: row.id, text: text });
  }
  return artifacts;
}

function runExtraction(db, roomDir, sessionId, maxPerArtifact) {
  const artifacts = collectArtifacts(db, roomDir);

  // Aggregate all candidates first (pure, no writes yet).
  const entities = [];   // { entityType, name, sourceArtifactId }
  const relations = [];  // { source, target, edge_type }
  for (const art of artifacts) {
    const res = extractEntities(art.text, { sourceArtifactId: art.artifactId, maxPerArtifact: maxPerArtifact });
    for (const e of res.entities) entities.push(e);
    for (const r of res.relations) relations.push(r);
  }

  let entitiesWritten = 0;
  let edgesWritten = 0;

  // D-05 batch: ONE explicit transaction around the whole node+edge batch.
  // node:sqlite has NO .transaction() helper (Pitfall 3) -- BEGIN/COMMIT/ROLLBACK
  // via db.exec. A mid-batch error rolls back ALL of it (T-218-09).
  db.exec('BEGIN');
  try {
    // 1. Entity nodes -- born review_status='proposed' via the chokepoint.
    for (const e of entities) {
      const r = navigation.writeEntityNode(db, {
        entityType: e.entityType,
        name: e.name,
        sessionId: sessionId,
      });
      if (r && r.ok) entitiesWritten += 1;
    }
    // 2. entity -> artifact DESCRIBES links (provenance). Direction source=entity
    //    target=memory_artifact. Routed through navigation.writeEdge (never raw
    //    SQL). The target is a real memory_artifact node (collectArtifacts).
    for (const e of entities) {
      const entityId = navigation.ENTITY_NODE_ID(sessionId, e.name);
      const r = navigation.writeEdge(db, {
        source_id: entityId,
        target_id: e.sourceArtifactId,
        edge_type: 'DESCRIBES',
        properties: { relation: 'describes', entity_node: entityId },
      });
      if (r && r.ok) edgesWritten += 1;
    }
    // 3. entity -> entity domain-relationship edges. The extractor names the
    //    endpoints; ENTITY_NODE_ID resolves each name to the same node id
    //    writeEntityNode minted under this sessionId.
    for (const rel of relations) {
      const srcId = navigation.ENTITY_NODE_ID(sessionId, rel.source);
      const tgtId = navigation.ENTITY_NODE_ID(sessionId, rel.target);
      const r = navigation.writeEdge(db, {
        source_id: srcId,
        target_id: tgtId,
        edge_type: rel.edge_type,
        properties: { relation: String(rel.edge_type).toLowerCase() },
      });
      if (r && r.ok) edgesWritten += 1;
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  // Route-a best-effort re-embed (REQ-3, Open Q2). AFTER commit, in its OWN
  // try/catch: a slow/absent encoder degrades to lexical-only and must NEVER
  // throw or roll back the entity writes (T-218-10). indexNodes is idempotent
  // (per-node DELETE-then-INSERT), so re-running is safe.
  let embedded = false;
  return triModal.indexNodes(db, { roomDir: roomDir })
    .then(function (idx) {
      embedded = !!(idx && idx.embedded);
      return { artifacts: artifacts.length, entitiesWritten: entitiesWritten, edgesWritten: edgesWritten, embedded: embedded };
    })
    .catch(function () {
      // Degrade-never-throw: the entity writes are already committed.
      return { artifacts: artifacts.length, entitiesWritten: entitiesWritten, edgesWritten: edgesWritten, embedded: false };
    });
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

  const startedAt = new Date().toISOString();
  writeStatus(roomDir, { state: 'running', started_at: startedAt, pid: process.pid });

  let db = null;
  try {
    db = openRoomDb(roomDir, { allowExtension: true });
    const result = await runExtraction(db, roomDir, opts.session, opts.max);
    writeStatus(roomDir, {
      state: 'done',
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      pid: process.pid,
      artifacts: result.artifacts,
      entities: result.entitiesWritten,
      edges: result.edgesWritten,
      embedded: result.embedded,
      session: opts.session,
    });
    return 0;
  } catch (err) {
    const msg = String(err && err.message ? err.message : err).split('\n')[0];
    writeStatus(roomDir, {
      state: 'failed',
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      pid: process.pid,
      error: msg,
    });
    printError('entity extraction failed', msg, 'inspect ' + statusPath(roomDir) + ' then re-run entity-extract');
    return 1;
  } finally {
    if (db) { try { closeRoomDb(db); } catch (_e) { /* already closed */ } }
  }
}

function cmdStart(opts) {
  const roomDir = opts.roomDir;
  if (!dirExists(roomDir)) {
    printError('room directory not found', String(roomDir) + ' is not a directory', 'pass a valid room path, or run /mos:new-project');
    return 1;
  }
  fs.mkdirSync(reportDir(roomDir), { recursive: true });

  const forwarded = [];
  if (opts.sessionProvided) forwarded.push('--session', String(opts.session));
  if (opts.maxProvided) forwarded.push('--max', String(opts.max));

  const child = spawn(process.execPath, [__filename, roomDir, 'run'].concat(forwarded), {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();

  process.stdout.write('entity extraction started (background)\n');
  process.stdout.write('status: ' + statusPath(roomDir) + '\n');
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
  const sp = statusPath(roomDir);
  if (!fileExists(sp)) {
    printError('no extraction run yet', 'no status.json for this room', 'run entity-extract ROOM_DIR run');
    return 1;
  }
  let parsed = null;
  try { parsed = JSON.parse(fs.readFileSync(sp, 'utf8')); } catch (_e) { parsed = null; }
  if (!parsed) {
    printError('unreadable status', statusPath(roomDir) + ' is not valid JSON', 're-run entity-extract ROOM_DIR run');
    return 1;
  }
  if (parsed.state === 'done') {
    process.stdout.write(
      'entity-extract done: ' + (parsed.entities || 0) + ' entities, ' + (parsed.edges || 0) +
      ' edges from ' + (parsed.artifacts || 0) + ' artifacts (embedded=' + (parsed.embedded ? 'yes' : 'no') + ')\n'
    );
  } else if (parsed.state === 'running') {
    process.stdout.write('entity-extract running (started ' + (parsed.started_at || '?') + ')\n');
  } else if (parsed.state === 'failed') {
    process.stdout.write('entity-extract failed: ' + (parsed.error || 'unknown error') + '\n');
  } else {
    process.stdout.write(JSON.stringify(parsed) + '\n');
  }
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
