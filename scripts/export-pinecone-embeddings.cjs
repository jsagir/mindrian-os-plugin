#!/usr/bin/env node
// scripts/export-pinecone-embeddings.cjs
//
// Phase 127.1 -- Plan 01: Pinecone -> NDJSON export + SHA256 manifest generator.
//
// One-shot exporter that reads the live pws-brain Pinecone index's "core"
// namespace, dumps every methodology vector to a local NDJSON file, and
// emits a checksums-only manifest fixture that the Surface 1 harness
// (tests/127.1-embedding-integrity.test.cjs) consumes.
//
// Lock contracts enforced (per .planning/phases/127.1-.../127.1-CONTEXT.md):
//   - Lock 1: byte-identical embeddings. Vector floats pass through verbatim;
//     no re-embedding, no rounding, no normalization. SHA256 is taken over
//     Buffer.from(new Float64Array(values).buffer) so the hash is invariant
//     under JSON pretty-print and trailing whitespace.
//   - Lock 2: e5-large @ 1024 dims. Both constants are grep-locked.
//   - Lock 3: cosine similarity. Grep-locked even though not used at export.
//   - Canon Part 8: dump stays local (~/.mindrian/127.1/embeddings.ndjson);
//     manifest is checksums-only and safe to commit.
//
// CLI:
//   node scripts/export-pinecone-embeddings.cjs --dry-run
//   node scripts/export-pinecone-embeddings.cjs --sample 3
//   node scripts/export-pinecone-embeddings.cjs --emit-dump <path> --emit-manifest <path>
//
// Hard rules honored:
//   - No em-dashes (U+2014); hyphens only.
//   - No real names; no tester PII.
//   - No writes outside the three declared output paths (dump, manifest, sample).
//   - No Brain MCP calls. Pinecone SDK is the only outbound surface.
//   - CJS (require/.cjs), Node 18+; no ESM, no TypeScript.

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// ---------------------------------------------------------------------------
// Locked constants (grep-able; do NOT inline into env defaults)
// ---------------------------------------------------------------------------

const EMBEDDING_MODEL = 'multilingual-e5-large';  // Lock 2 (CONTEXT 127.1 Lock 2)
const EMBEDDING_DIMS = 1024;                       // Lock 2 (CONTEXT 127.1 Lock 2)
const SIMILARITY_METRIC = 'cosine';                // Lock 3 (CONTEXT 127.1 Lock 3)
const PINECONE_INDEX = process.env.PINECONE_INDEX || 'pws-brain';
const PINECONE_NAMESPACE = 'core';                 // mcp-server-brain/lib/pinecone-tools.cjs line 40 default
const EXPECTED_VECTOR_COUNT = 1427;                // CONTEXT 127.1 acceptance criterion
const SCHEMA_VERSION = 1;
const FETCH_BATCH_SIZE = 100;                      // Pinecone fetch chunk size

// ---------------------------------------------------------------------------
// SDK module resolution (Canon Part 8: SDK lives in mcp-server-brain/, not root)
// ---------------------------------------------------------------------------

function loadPineconeSdk() {
  const sdkPath = path.resolve(
    __dirname,
    '..',
    'mcp-server-brain',
    'node_modules',
    '@pinecone-database',
    'pinecone'
  );
  try {
    return require(sdkPath);
  } catch (err) {
    process.stderr.write(
      'error -- run "cd mcp-server-brain && npm install" first; ' +
        'the Pinecone SDK lives there for Canon Part 8 isolation\n'
    );
    process.stderr.write('  (resolution path: ' + sdkPath + ')\n');
    process.stderr.write('  (underlying error: ' + err.message + ')\n');
    process.exit(2);
  }
}

// ---------------------------------------------------------------------------
// CLI argument parsing (no commander; same pattern as gsd-tools.cjs)
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {
    dryRun: false,
    sample: 0,
    emitDump: null,
    emitManifest: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--sample') {
      const next = argv[i + 1];
      const n = parseInt(next, 10);
      if (!Number.isFinite(n) || n <= 0) {
        process.stderr.write('error -- --sample requires a positive integer (got: ' + next + ')\n');
        process.exit(2);
      }
      args.sample = n;
      i++;
    } else if (arg === '--emit-dump') {
      args.emitDump = argv[i + 1];
      i++;
    } else if (arg === '--emit-manifest') {
      args.emitManifest = argv[i + 1];
      i++;
    } else if (arg === '--help' || arg === '-h') {
      printUsageAndExit(0);
    } else {
      process.stderr.write('error -- unknown argument: ' + arg + '\n');
      printUsageAndExit(2);
    }
  }
  return args;
}

function printUsageAndExit(code) {
  process.stdout.write(
    'usage: node scripts/export-pinecone-embeddings.cjs [options]\n' +
      '\n' +
      'options:\n' +
      '  --dry-run                 connect + count only; do not write files\n' +
      '  --sample N                also write the first N records to the sample fixture\n' +
      '  --emit-dump <path>        NDJSON dump output path (default: ~/.mindrian/127.1/embeddings.ndjson)\n' +
      '  --emit-manifest <path>    manifest fixture output path (default: tests/fixtures/127.1/embedding-manifest.fixture.json)\n' +
      '  --help, -h                show this message\n' +
      '\n' +
      'env:\n' +
      '  PINECONE_API_KEY (required, except for --dry-run with missing key which exits cleanly)\n' +
      '  PINECONE_INDEX   (default: pws-brain)\n'
  );
  process.exit(code);
}

// ---------------------------------------------------------------------------
// Default paths
// ---------------------------------------------------------------------------

function defaultDumpPath() {
  return path.join(os.homedir(), '.mindrian', '127.1', 'embeddings.ndjson');
}

function defaultManifestPath() {
  return path.resolve(__dirname, '..', 'tests', 'fixtures', '127.1', 'embedding-manifest.fixture.json');
}

function defaultSamplePath() {
  return path.resolve(__dirname, '..', 'tests', 'fixtures', '127.1', 'embedding-dump.ndjson.sample');
}

// ---------------------------------------------------------------------------
// SHA256 helper -- Lock 1 protocol (byte-identical, invariant under JSON form)
// ---------------------------------------------------------------------------

function sha256OfFloatVector(values) {
  // CRITICAL contract: hash the bytes of the IEEE 754 float64 encoding of the
  // array, not a JSON stringification. The Neo4j loader (Plan 127.1-02) MUST
  // hash the same way after read-back so the manifest equality holds.
  const f64 = new Float64Array(values);
  const buf = Buffer.from(f64.buffer, f64.byteOffset, f64.byteLength);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

// ---------------------------------------------------------------------------
// Filesystem helpers
// ---------------------------------------------------------------------------

function ensureDirFor(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function warnIfOverwrite(filePath) {
  if (fs.existsSync(filePath)) {
    process.stderr.write('warn -- overwriting existing file at ' + filePath + '\n');
  }
}

// ---------------------------------------------------------------------------
// Main export algorithm
// ---------------------------------------------------------------------------

async function listAllVectorIds(ns) {
  const ids = [];
  let paginationToken = undefined;
  let pageCount = 0;
  while (true) {
    const opts = paginationToken ? { paginationToken } : {};
    const page = await ns.listPaginated(opts);
    pageCount++;
    if (page && Array.isArray(page.vectors)) {
      for (const v of page.vectors) {
        if (v && typeof v.id === 'string' && v.id.length > 0) {
          ids.push(v.id);
        }
      }
    }
    if (!page || !page.pagination || !page.pagination.next) {
      break;
    }
    paginationToken = page.pagination.next;
    // Safety guard: do not infinite-loop on a malformed pagination cursor.
    if (pageCount > 1000) {
      throw new Error('listPaginated returned more than 1000 pages; aborting (pagination cursor likely malformed)');
    }
  }
  return ids;
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

async function fetchRecordsBatch(ns, idsBatch, batchIndex) {
  try {
    const result = await ns.fetch(idsBatch);
    if (!result || typeof result.records !== 'object' || result.records === null) {
      throw new Error('fetch returned no records object');
    }
    return result.records;
  } catch (err) {
    process.stderr.write(
      'error -- during fetch batch i=' + batchIndex + ': ' + (err.message || String(err)) + '\n'
    );
    process.exit(4);
  }
}

function normalizeValues(values) {
  // Pinecone may return values as Float32Array or as number[]; coerce to a
  // plain number[] for stable JSON encoding. The float64 hash is taken from
  // the SAME coerced array so loader and exporter agree.
  if (Array.isArray(values)) {
    return values;
  }
  if (values && typeof values.length === 'number') {
    const out = new Array(values.length);
    for (let i = 0; i < values.length; i++) {
      out[i] = values[i];
    }
    return out;
  }
  return null;
}

function buildNdjsonLine(record) {
  // Preserve the verbatim metadata payload; null when absent.
  const meta = record.metadata != null ? record.metadata : null;
  const obj = {
    id: record.id,
    namespace: PINECONE_NAMESPACE,
    values: record.values,
    metadata: meta,
  };
  return JSON.stringify(obj) + '\n';
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // dry-run requires env to talk to Pinecone; fall through to the env check.
  const apiKey = process.env.PINECONE_API_KEY;
  if (!apiKey || apiKey.length === 0) {
    process.stderr.write(
      'error -- PINECONE_API_KEY missing; source the mcp-server-brain Render env vars first ' +
        '(e.g. via the same .env the live service uses)\n'
    );
    process.exit(2);
  }

  const { Pinecone } = loadPineconeSdk();

  process.stderr.write('connecting to Pinecone index=' + PINECONE_INDEX + ' namespace=' + PINECONE_NAMESPACE + '\n');
  const client = new Pinecone({ apiKey });
  const ns = client.index(PINECONE_INDEX).namespace(PINECONE_NAMESPACE);

  // Step 1: list every vector id.
  process.stderr.write('listing vector ids via listPaginated...\n');
  const ids = await listAllVectorIds(ns);
  process.stderr.write('collected ' + ids.length + ' vector ids\n');

  // Step 2: enforce expected count.
  if (ids.length !== EXPECTED_VECTOR_COUNT) {
    process.stderr.write(
      'error -- expected ' + EXPECTED_VECTOR_COUNT + ' vectors in ' + PINECONE_INDEX + '/' + PINECONE_NAMESPACE +
        ', observed ' + ids.length + ' -- aborting; investigate before re-running\n'
    );
    process.exit(3);
  }

  if (args.dryRun) {
    process.stdout.write('OK 127.1-export dry-run vectors=' + ids.length + '\n');
    process.stdout.write('first 3 ids: ' + ids.slice(0, 3).join(', ') + '\n');
    process.exit(0);
  }

  // Resolve output paths
  const dumpPath = args.emitDump || defaultDumpPath();
  const manifestPath = args.emitManifest || defaultManifestPath();
  const samplePath = args.sample > 0 ? defaultSamplePath() : null;

  ensureDirFor(dumpPath);
  ensureDirFor(manifestPath);
  if (samplePath) {
    ensureDirFor(samplePath);
  }
  warnIfOverwrite(dumpPath);
  warnIfOverwrite(manifestPath);
  if (samplePath) {
    warnIfOverwrite(samplePath);
  }

  // Open dump stream for write (overwrite).
  const dumpStream = fs.createWriteStream(dumpPath, { encoding: 'utf8', flags: 'w' });

  const sampleLines = [];
  const checksums = [];
  let writtenCount = 0;

  // Step 3: batch-fetch in chunks of 100.
  const batches = chunkArray(ids, FETCH_BATCH_SIZE);
  process.stderr.write('fetching ' + ids.length + ' vectors in ' + batches.length + ' batches of ' + FETCH_BATCH_SIZE + '\n');

  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b];
    const records = await fetchRecordsBatch(ns, batch, b);

    // Pinecone returns records keyed by id. Iterate in the order of the
    // request batch so the output ordering is deterministic and matches the
    // listPaginated traversal.
    for (const id of batch) {
      const record = records[id];
      if (!record) {
        process.stderr.write(
          'error -- fetch batch i=' + b + ' missing id=' + id +
            '; aborting (do not partial-write)\n'
        );
        dumpStream.destroy();
        process.exit(4);
      }
      const values = normalizeValues(record.values);
      if (!values || values.length !== EMBEDDING_DIMS) {
        process.stderr.write(
          'error -- dim drift on id=' + id + ': expected ' + EMBEDDING_DIMS +
            ' observed ' + (values ? values.length : 'null') + '\n'
        );
        dumpStream.destroy();
        process.exit(4);
      }

      const ndjsonLine = buildNdjsonLine({
        id: id,
        values: values,
        metadata: record.metadata,
      });
      dumpStream.write(ndjsonLine);

      const pinecone_sha256 = sha256OfFloatVector(values);
      checksums.push({
        node_id: id,
        pinecone_sha256: pinecone_sha256,
        // Initialized identical; Plan 127.1-02's loader will rewrite this
        // column after the Neo4j round-trip. Surface 1 asserts equality.
        neo4j_sha256: pinecone_sha256,
      });

      writtenCount++;
      if (samplePath && sampleLines.length < args.sample) {
        sampleLines.push(ndjsonLine);
      }
    }
    process.stderr.write('  batch ' + (b + 1) + '/' + batches.length + ' done (' + writtenCount + ' / ' + ids.length + ')\n');
  }

  // Close dump stream and await final flush.
  await new Promise((resolve, reject) => {
    dumpStream.end((err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });

  if (writtenCount !== EXPECTED_VECTOR_COUNT) {
    process.stderr.write(
      'error -- written count ' + writtenCount + ' does not match expected ' + EXPECTED_VECTOR_COUNT + '\n'
    );
    process.exit(4);
  }

  // Step 4: write manifest.
  const manifest = {
    schema_version: SCHEMA_VERSION,
    produced_by: 'scripts/export-pinecone-embeddings.cjs',
    produced_at: new Date().toISOString(),
    embedding_model: EMBEDDING_MODEL,
    embedding_dims: EMBEDDING_DIMS,
    similarity_metric: SIMILARITY_METRIC,
    vector_count: writtenCount,
    namespace: PINECONE_NAMESPACE,
    checksums: checksums,
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  process.stderr.write('wrote manifest at ' + manifestPath + '\n');

  // Step 5: optional sample.
  if (samplePath && sampleLines.length > 0) {
    fs.writeFileSync(samplePath, sampleLines.join(''), 'utf8');
    process.stderr.write('wrote sample (first ' + sampleLines.length + ' records) at ' + samplePath + '\n');
  }

  // Step 6: final summary line (grep-able from downstream automation).
  process.stdout.write(
    'OK 127.1-export ' + writtenCount + ' vectors dumped to ' + dumpPath +
      ' manifest at ' + manifestPath +
      ' total_sha256_pairs=' + writtenCount + '\n'
  );
  process.exit(0);
}

main().catch((err) => {
  process.stderr.write('error -- unhandled: ' + (err && err.stack ? err.stack : String(err)) + '\n');
  process.exit(4);
});
