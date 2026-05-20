#!/usr/bin/env node
// scripts/load-embeddings-into-neo4j.cjs
//
// Phase 127.1 Plan 02 -- One-shot Neo4j vector-index loader.
//
// Reads the byte-identical NDJSON dump produced by Plan 127.1-01
// (scripts/export-pinecone-embeddings.cjs) at ~/.mindrian/127.1/embeddings.ndjson,
// MERGEs MethodologyChunk nodes onto the live Neo4j Aura instance, runs the
// vector-index DDL from mcp-server-brain/sql/127.1-vector-index.cypher,
// waits for the index to come ONLINE, performs the Lock 1 SHA256 round-trip
// integrity check, rewrites the manifest's neo4j_sha256 column, and emits the
// SHOW INDEXES snapshot to tests/fixtures/127.1/index-config.fixture.json so
// Surface 2 harness goes GREEN.
//
// Re-scope-corrective (2026-05-20): this loader was originally written under
// the stale 1,427-vector / vector-empty-Neo4j premise. DI-127.1-02 proved the
// live Brain Neo4j ALREADY carries a native 384-dim vector layer (6,007 nodes,
// 7 HNSW indexes). Plan 127.1-01 then shipped the real corpus: a 12,401-record
// NDJSON dump across 6 namespaces. This loader is corrected to that contract.
//
// SCOPE BOUNDARY (G-1 additive / G-3 reserve the routing node family):
//   This loader touches ONLY the MethodologyChunk node family (referenced
//   everywhere below via the NODE_LABEL constant) and the
//   mindrian_methodology_vec index. It never reads, writes, scans, or indexes
//   the reserved command-routing node family or its routing edges (the
//   downstream command-routing stream owns that label and its edge types).
//   It never touches the 7 pre-existing 384-dim HNSW indexes or any node
//   label they index (per DI-127.1-02). Every node-scanning query in this
//   loader is label-scoped via the NODE_LABEL constant -- it never issues a
//   bare graph-wide node scan. The migration is additive: a NEW index + a
//   NEW node family land alongside the existing graph; nothing pre-existing
//   is mutated.
//
// G-1 reversibility: the --rollback flag is the explicit reversibility
//   affordance. It drops ONLY the mindrian_methodology_vec index and detaches
//   ONLY the MethodologyChunk node family. That scoped detach targets exactly
//   the migrated node family -- it is NOT a full-graph reload.
//
// Locked by the CONTEXT.md four-lock protocol (matches Plan 127.1-01
// constants byte-for-byte; the SHA256 protocol is identical so the
// pinecone_sha256 column from the export equals the neo4j_sha256 column
// after a successful round-trip).
//
// Hard rules honored:
//   - No em-dashes (U+2014); hyphens only.
//   - No network calls except to Neo4j Aura via the driver.
//   - No Pinecone calls (manifest already carries pinecone_sha256).
//   - No writes outside the configured dump / manifest / fixture / stdout.
//   - CommonJS; Node 18+; reuses neo4j-driver under mcp-server-brain/node_modules.
//
// CLI surface (process.argv switch-case; no commander):
//   node scripts/load-embeddings-into-neo4j.cjs --dump <path> --manifest <path> --emit-index-config <path>
//   node scripts/load-embeddings-into-neo4j.cjs --dry-run        # connect + count + DDL preview
//   node scripts/load-embeddings-into-neo4j.cjs --ddl-only       # run the DDL, skip the load
//   node scripts/load-embeddings-into-neo4j.cjs --verify-only    # run round-trip SHA256 verification only
//   node scripts/load-embeddings-into-neo4j.cjs --rollback       # G-1 reversibility: drop the index + detach :MethodologyChunk only

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');

// SDK resolution (Canon Part 7 reuse-before-build: the neo4j-driver client
// already lives under mcp-server-brain/node_modules; the loader resolves it
// by absolute path so this script runs from the project root without
// requiring a separate npm install).
const SDK_PATH = path.resolve(__dirname, '..', 'mcp-server-brain', 'node_modules', 'neo4j-driver');
let neo4j;
try {
  neo4j = require(SDK_PATH);
} catch (err) {
  process.stderr.write(
    'error -- run "cd mcp-server-brain && npm install" first; the Neo4j driver lives there for Canon Part 8 isolation\n' +
      '  (resolution path: ' + SDK_PATH + ')\n' +
      '  (underlying: ' + err.message + ')\n'
  );
  process.exit(2);
}

// Locked constants (grep-able; MUST match Plan 127.1-01's constants byte-for-byte
// where they overlap; Lock 2 / Lock 3 are pinned here as numeric / string
// literals for static-analysis-friendly enforcement).
const EMBEDDING_MODEL = 'multilingual-e5-large';            // Lock 2
const EMBEDDING_DIMS = 1024;                                 // Lock 2
const SIMILARITY_METRIC = 'cosine';                          // Lock 3
const INDEX_NAME = 'mindrian_methodology_vec';
const NODE_LABEL = 'MethodologyChunk';
const EMBEDDING_PROPERTY = 'embedding';
const EXPECTED_VECTOR_COUNT = 12401;
const MIN_NEO4J_VERSION_MAJOR = 5;
const MIN_NEO4J_VERSION_MINOR = 13;
const BATCH_SIZE = 100;
const INDEX_POLL_INTERVAL_MS = 2000;
const INDEX_POLL_TIMEOUT_MS = 60000;

const DDL_PATH = path.resolve(__dirname, '..', 'mcp-server-brain', 'sql', '127.1-vector-index.cypher');
const DEFAULT_DUMP = path.resolve(process.env.HOME || '/tmp', '.mindrian', '127.1', 'embeddings.ndjson');
const DEFAULT_MANIFEST = path.resolve(__dirname, '..', 'tests', 'fixtures', '127.1', 'embedding-manifest.fixture.json');
const DEFAULT_INDEX_CONFIG_FIXTURE = path.resolve(__dirname, '..', 'tests', 'fixtures', '127.1', 'index-config.fixture.json');

// ----------------------------------------------------------------------------
// CLI parsing
// ----------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {
    dump: DEFAULT_DUMP,
    manifest: DEFAULT_MANIFEST,
    indexConfig: DEFAULT_INDEX_CONFIG_FIXTURE,
    dryRun: false,
    ddlOnly: false,
    verifyOnly: false,
    rollback: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dump') { args.dump = argv[++i]; }
    else if (a === '--manifest') { args.manifest = argv[++i]; }
    else if (a === '--emit-index-config') { args.indexConfig = argv[++i]; }
    else if (a === '--dry-run') { args.dryRun = true; }
    else if (a === '--ddl-only') { args.ddlOnly = true; }
    else if (a === '--verify-only') { args.verifyOnly = true; }
    else if (a === '--rollback') { args.rollback = true; }
    else if (a === '--help' || a === '-h') { printHelp(); process.exit(0); }
    else if (a.startsWith('--')) {
      process.stderr.write('unknown flag: ' + a + '\n');
      process.exit(2);
    }
  }
  return args;
}

function printHelp() {
  process.stdout.write([
    'Phase 127.1 Plan 02 -- Neo4j vector-index loader',
    '',
    'Usage:',
    '  node scripts/load-embeddings-into-neo4j.cjs [options]',
    '',
    'Options:',
    '  --dump <path>              NDJSON dump from Plan 127.1-01 (default: ~/.mindrian/127.1/embeddings.ndjson)',
    '  --manifest <path>          Manifest fixture to rewrite (default: tests/fixtures/127.1/embedding-manifest.fixture.json)',
    '  --emit-index-config <path> Where to write the SHOW INDEXES snapshot (default: tests/fixtures/127.1/index-config.fixture.json)',
    '  --dry-run                  Connect + count + show DDL; do not write',
    '  --ddl-only                 Run the DDL, skip the load',
    '  --verify-only              Round-trip SHA256 verification only (idempotency proof: safe no-op re-run)',
    '  --rollback                 G-1 reversibility: drop ONLY mindrian_methodology_vec',
    '                             + detach ONLY :MethodologyChunk nodes (scoped, not a full reload)',
    '',
    'Env vars: NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD must be set.',
    ''
  ].join('\n'));
}

// ----------------------------------------------------------------------------
// Env validation
// ----------------------------------------------------------------------------

function validateEnv() {
  const missing = [];
  if (!process.env.NEO4J_URI) missing.push('NEO4J_URI');
  if (!process.env.NEO4J_PASSWORD) missing.push('NEO4J_PASSWORD');
  if (missing.length > 0) {
    process.stderr.write(
      'error -- missing env var(s): ' + missing.join(', ') + '\n' +
        '  source the mcp-server-brain Render env vars first (the live Brain instance carries them)\n'
    );
    process.exit(2);
  }
}

// ----------------------------------------------------------------------------
// Neo4j version detection
// ----------------------------------------------------------------------------

async function detectVersion(session) {
  const result = await session.run('CALL dbms.components() YIELD versions RETURN versions[0] AS version');
  const version = result.records[0].get('version');
  const m = /^(\d+)\.(\d+)/.exec(version);
  if (!m) {
    throw new Error('could not parse Neo4j version string: ' + version);
  }
  const major = parseInt(m[1], 10);
  const minor = parseInt(m[2], 10);
  // Neo4j calendar versioning: 2025.10+ uses calendar versioning. Anything >= 2025 is well past 5.13 GA.
  const meetsMinimum =
    major >= 2025 ||
    major > MIN_NEO4J_VERSION_MAJOR ||
    (major === MIN_NEO4J_VERSION_MAJOR && minor >= MIN_NEO4J_VERSION_MINOR);
  if (!meetsMinimum) {
    throw new Error(
      'error -- Neo4j version ' + version + ' < 5.13 required for vector indexes; bump Aura instance BEFORE re-running'
    );
  }
  return version;
}

// ----------------------------------------------------------------------------
// DDL execution
// ----------------------------------------------------------------------------

function readDDLStatements() {
  const raw = fs.readFileSync(DDL_PATH, 'utf8');
  // Strip line comments + blank lines, then split on semicolons.
  const stripped = raw
    .split('\n')
    .map(l => l.replace(/^\s*\/\/.*$/, ''))
    .join('\n');
  return stripped
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

async function runDDL(session) {
  const statements = readDDLStatements();
  for (const stmt of statements) {
    await session.run(stmt);
  }
  return statements.length;
}

// ----------------------------------------------------------------------------
// Index ONLINE polling
// ----------------------------------------------------------------------------

async function waitForIndexOnline(session) {
  const start = Date.now();
  let lastState = 'UNKNOWN';
  while (Date.now() - start < INDEX_POLL_TIMEOUT_MS) {
    const result = await session.run(
      'SHOW INDEXES YIELD name, state WHERE name = $name RETURN state',
      { name: INDEX_NAME }
    );
    if (result.records.length === 0) {
      lastState = 'NOT_FOUND';
    } else {
      lastState = result.records[0].get('state');
      if (lastState === 'ONLINE') return lastState;
    }
    await new Promise(r => setTimeout(r, INDEX_POLL_INTERVAL_MS));
  }
  throw new Error(
    'error -- index ' + INDEX_NAME + ' did not reach ONLINE state within ' +
      (INDEX_POLL_TIMEOUT_MS / 1000) + 's; observed state ' + lastState
  );
}

// ----------------------------------------------------------------------------
// SHA256 protocol -- IDENTICAL to Plan 127.1-01
// ----------------------------------------------------------------------------

function sha256OfFloat64Array(values) {
  // Lock 1: hash the bytes of the IEEE 754 float64 encoding so the hash is
  // invariant under JSON pretty-print, trailing-newline, and ASCII drift.
  // This protocol is byte-for-byte identical to Plan 127.1-01's exporter
  // so pinecone_sha256 (from the export) and neo4j_sha256 (from the
  // post-load round-trip read) are directly comparable.
  return crypto.createHash('sha256').update(Buffer.from(new Float64Array(values).buffer)).digest('hex');
}

// ----------------------------------------------------------------------------
// NDJSON streaming + batched MERGE
// ----------------------------------------------------------------------------

async function loadFromNDJSON(session, dumpPath) {
  if (!fs.existsSync(dumpPath)) {
    throw new Error('error -- dump file not found: ' + dumpPath + '\n  run Plan 127.1-01 first to produce the NDJSON export');
  }
  const stream = fs.createReadStream(dumpPath);
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  const loadCypher =
    'UNWIND $rows AS row\n' +
    'MERGE (n:' + NODE_LABEL + ' { id: row.id })\n' +
    'SET n.embedding = row.values,\n' +
    '    n.namespace = row.namespace,\n' +
    '    n.metadata = row.metadata_json';

  let batch = [];
  let totalLoaded = 0;
  let lineNum = 0;
  let batchIdx = 0;

  async function flushBatch() {
    if (batch.length === 0) return;
    try {
      await session.run(loadCypher, { rows: batch });
      totalLoaded += batch.length;
    } catch (err) {
      throw new Error('error -- during batch i=' + batchIdx + ': ' + err.message);
    }
    batchIdx++;
    batch = [];
  }

  for await (const line of rl) {
    lineNum++;
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    let record;
    try {
      record = JSON.parse(trimmed);
    } catch (err) {
      throw new Error('error -- malformed NDJSON line ' + lineNum + ': ' + err.message);
    }
    if (!record.id || typeof record.id !== 'string') {
      throw new Error('error -- line ' + lineNum + ' missing id field');
    }
    if (!Array.isArray(record.values) || record.values.length !== EMBEDDING_DIMS) {
      throw new Error(
        'error -- dim drift on id=' + record.id + ': expected ' + EMBEDDING_DIMS +
          ' observed ' + (record.values ? record.values.length : 'null')
      );
    }
    batch.push({
      id: record.id,
      values: record.values,
      namespace: record.namespace || 'core',
      metadata_json: record.metadata ? JSON.stringify(record.metadata) : null,
    });
    if (batch.length >= BATCH_SIZE) {
      await flushBatch();
    }
  }
  await flushBatch();

  return totalLoaded;
}

// ----------------------------------------------------------------------------
// Post-load count + round-trip SHA256 verification
// ----------------------------------------------------------------------------

async function countLoadedNodes(session) {
  const result = await session.run(
    'MATCH (n:' + NODE_LABEL + ') WHERE n.' + EMBEDDING_PROPERTY + ' IS NOT NULL RETURN count(n) AS c'
  );
  const c = result.records[0].get('c');
  // neo4j-driver returns integer-like objects; coerce.
  return typeof c === 'object' && c.toNumber ? c.toNumber() : Number(c);
}

async function roundTripVerify(session, manifestPath) {
  const result = await session.run(
    'MATCH (n:' + NODE_LABEL + ') WHERE n.' + EMBEDDING_PROPERTY + ' IS NOT NULL ' +
      'RETURN n.id AS id, n.' + EMBEDDING_PROPERTY + ' AS values'
  );
  const liveHashes = new Map();
  for (const rec of result.records) {
    const id = rec.get('id');
    const values = rec.get('values');
    liveHashes.set(id, sha256OfFloat64Array(values));
  }

  // Read manifest, rewrite neo4j_sha256 column with live values.
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  let drift = 0;
  const firstDrifters = [];
  for (const entry of manifest.checksums) {
    const liveHash = liveHashes.get(entry.node_id);
    if (!liveHash) {
      drift++;
      if (firstDrifters.length < 5) firstDrifters.push(entry.node_id + ' (not loaded)');
      continue;
    }
    entry.neo4j_sha256 = liveHash;
    if (entry.pinecone_sha256 !== liveHash) {
      drift++;
      if (firstDrifters.length < 5) firstDrifters.push(entry.node_id);
    }
  }
  manifest.produced_at = new Date().toISOString();
  manifest.neo4j_round_trip_completed_at = new Date().toISOString();
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  return { drift, firstDrifters };
}

// ----------------------------------------------------------------------------
// Index-config fixture capture
// ----------------------------------------------------------------------------

async function captureIndexConfig(session, fixturePath) {
  // Neo4j 5.27-aura's `SHOW INDEXES` does not expose an `indexConfig` YIELD
  // column directly; the config nests inside `options.indexConfig`. Use
  // `SHOW VECTOR INDEXES` and read the nested object so the loader works
  // against the live Aura instance regardless of how the SHOW projection
  // surfaces the config.
  const result = await session.run(
    'SHOW VECTOR INDEXES YIELD name, state, type, entityType, labelsOrTypes, properties, options ' +
      'WHERE name = $name ' +
      'RETURN name, state, type, entityType, labelsOrTypes, properties, options',
    { name: INDEX_NAME }
  );
  if (result.records.length === 0) {
    throw new Error('error -- SHOW VECTOR INDEXES returned no row for ' + INDEX_NAME + ' after load');
  }
  const rec = result.records[0];
  const options = rec.get('options') || {};
  const indexConfig = options.indexConfig || {};
  // neo4j-driver returns indexConfig as a plain object on modern drivers; copy keys.
  const indexConfigPlain = {};
  for (const k of Object.keys(indexConfig || {})) {
    const v = indexConfig[k];
    indexConfigPlain[k] = typeof v === 'object' && v && v.toNumber ? v.toNumber() : v;
  }
  const row = {
    name: rec.get('name'),
    state: rec.get('state'),
    type: rec.get('type'),
    entityType: rec.get('entityType'),
    labelsOrTypes: rec.get('labelsOrTypes'),
    properties: rec.get('properties'),
    indexConfig: indexConfigPlain,
  };
  const fixture = {
    schema_version: 1,
    captured_at: new Date().toISOString(),
    produced_by: 'scripts/load-embeddings-into-neo4j.cjs',
    index_name: INDEX_NAME,
    rows: [row],
  };
  fs.writeFileSync(fixturePath, JSON.stringify(fixture, null, 2));
  return fixture;
}

// ----------------------------------------------------------------------------
// G-1 reversibility -- scoped rollback of the migrated node family ONLY
// ----------------------------------------------------------------------------
//
// This is the ONE place in the loader where a scoped detach is permitted. It
// is label-scoped via the NODE_LABEL constant -- it targets exactly the node
// family this loader created and nothing else. It is NOT a full-graph reload:
// the 384-dim layer, the reserved routing node family, and every other node
// label are untouched. The --rollback flag is the explicit G-1 reversibility
// affordance the command-routing stream's additive-and-reversible guarantee
// requires.

async function rollbackMigration(session) {
  // Drop ONLY the 1024-dim index this loader created. The 7 pre-existing
  // 384-dim indexes are never named here, so they cannot be dropped.
  await session.run('DROP INDEX ' + INDEX_NAME + ' IF EXISTS');
  process.stdout.write('Dropped index ' + INDEX_NAME + ' (if it existed)\n');

  // Detach ONLY the migrated node family. Label-scoped via NODE_LABEL: a bare
  // graph-wide node scan is never used. This removes the migrated nodes and
  // only those.
  const result = await session.run('MATCH (n:' + NODE_LABEL + ') DETACH DELETE n RETURN count(n) AS c');
  const c = result.records[0].get('c');
  const removed = typeof c === 'object' && c.toNumber ? c.toNumber() : Number(c);
  process.stdout.write('Detached ' + removed + ' :' + NODE_LABEL + ' node(s)\n');
  return removed;
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv);
  validateEnv();

  // Dry-run short-circuit: do not even connect; print the DDL and exit.
  if (args.dryRun) {
    process.stdout.write('OK 127.1-load dry-run mode\n');
    process.stdout.write('  DDL path: ' + DDL_PATH + '\n');
    process.stdout.write('  dump path: ' + args.dump + '\n');
    process.stdout.write('  manifest path: ' + args.manifest + '\n');
    process.stdout.write('  index-config fixture: ' + args.indexConfig + '\n');
    process.stdout.write('  expected vectors: ' + EXPECTED_VECTOR_COUNT + '\n');
    process.stdout.write('  expected dim: ' + EMBEDDING_DIMS + '\n');
    process.stdout.write('  expected metric: ' + SIMILARITY_METRIC + '\n');
    process.stdout.write('  DDL preview:\n');
    const stmts = readDDLStatements();
    for (const s of stmts) {
      process.stdout.write('    ' + s.replace(/\n/g, '\n    ') + ';\n');
    }
    return;
  }

  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER || 'neo4j', process.env.NEO4J_PASSWORD)
  );
  const session = driver.session({ defaultAccessMode: neo4j.session.WRITE });

  try {
    const version = await detectVersion(session);
    process.stdout.write('Neo4j version detected: ' + version + '\n');

    // G-1 reversibility path: scoped rollback of the migrated family only.
    if (args.rollback) {
      const removed = await rollbackMigration(session);
      process.stdout.write(
        'OK 127.1-load rollback index=' + INDEX_NAME + ' dropped ' +
          NODE_LABEL + '_detached=' + removed + '\n'
      );
      return;
    }

    if (!args.verifyOnly) {
      const stmtCount = await runDDL(session);
      process.stdout.write('DDL applied (' + stmtCount + ' statement(s))\n');
      const state = await waitForIndexOnline(session);
      process.stdout.write('Index ' + INDEX_NAME + ' state: ' + state + '\n');
    }

    if (args.ddlOnly) {
      process.stdout.write('OK 127.1-load ddl-only index=' + INDEX_NAME + ' (skipping vector load)\n');
      return;
    }

    if (!args.verifyOnly) {
      const loaded = await loadFromNDJSON(session, args.dump);
      process.stdout.write('Loaded ' + loaded + ' vectors\n');
    }

    const count = await countLoadedNodes(session);
    if (count !== EXPECTED_VECTOR_COUNT) {
      throw new Error('error -- count drift: expected ' + EXPECTED_VECTOR_COUNT + ' observed ' + count);
    }
    process.stdout.write('Node count check passed: ' + count + '\n');

    const verify = await roundTripVerify(session, args.manifest);
    if (verify.drift > 0) {
      throw new Error(
        'error -- SHA256 round-trip drift on ' + verify.drift + ' vector(s); first 5: ' +
          verify.firstDrifters.join(', ') + '\n' +
          '  the loader corrupted bytes; do NOT proceed with the cutover'
      );
    }
    process.stdout.write('SHA256 round-trip: zero drift across ' + EXPECTED_VECTOR_COUNT + ' vectors\n');

    await captureIndexConfig(session, args.indexConfig);
    process.stdout.write('Index-config fixture written: ' + args.indexConfig + '\n');

    process.stdout.write(
      'OK 127.1-load index=' + INDEX_NAME + ' ONLINE dim=' + EMBEDDING_DIMS +
        ' ' + SIMILARITY_METRIC + ' vectors_loaded=' + EXPECTED_VECTOR_COUNT +
        ' round_trip_drift=0\n'
    );
  } catch (err) {
    process.stderr.write(err.message + '\n');
    process.exitCode = 4;
  } finally {
    await session.close();
    await driver.close();
  }
}

if (require.main === module) {
  main().catch(err => {
    process.stderr.write('error -- fatal: ' + (err && err.message ? err.message : String(err)) + '\n');
    process.exit(4);
  });
}

module.exports = {
  EMBEDDING_MODEL,
  EMBEDDING_DIMS,
  SIMILARITY_METRIC,
  INDEX_NAME,
  NODE_LABEL,
  EMBEDDING_PROPERTY,
  EXPECTED_VECTOR_COUNT,
  sha256OfFloat64Array,
};
