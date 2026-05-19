#!/usr/bin/env node
// tests/127.1-graphrag-overlap.test.cjs
//
// Phase 127.1 -- Surface 3 harness: non-regression top-5 overlap (BLOCKING).
//
// Contract (per .planning/phases/127.1-.../127.1-VALIDATION.md Surface 3):
//   The Pinecone-to-Neo4j HNSW substrate cutover cannot ship until the
//   aggregate top-5 overlap across all 20 corpus queries is >= 0.80.
//   This is the canonical Lock 4 gate from 127.1-CONTEXT.md.
//
//   For each query Q_i in tests/127.1-graphrag-overlap-corpus.json:
//     overlap_i = |set(pinecone.top_5) intersect set(neo4j.top_5)| / 5.0
//   aggregate_overlap = mean(overlap_i) across 20 queries.
//   Assertion: aggregate_overlap >= 0.80.
//
// Below 0.60 for any individual query, a WARN line is printed (NOT a gate).
// Useful for HNSW tuning telemetry; does not fail the test.
//
// Wave 0 NYQUIST scaffold: this harness lands BEFORE the fixtures it
// consumes. It is RED-by-design until Plan 127.1-03 produces the
// pre-cutover (Pinecone) and post-cutover (Neo4j) top-5 fixtures.
//
// Hard rules honored:
//   - No em-dashes (U+2014); hyphens only.
//   - No live backend calls; no Pinecone client; no Neo4j client.
//   - No writes outside this file.
//   - No real names; no tester PII; corpus uses methodology node IDs only.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CORPUS_PATH = path.join(
  __dirname,
  '127.1-graphrag-overlap-corpus.json'
);

const BASELINE_FIXTURE_PATH = path.join(
  __dirname,
  'fixtures',
  '127.1',
  'overlap-baseline.fixture.json'
);

const NEO4J_FIXTURE_PATH = path.join(
  __dirname,
  'fixtures',
  '127.1',
  'overlap-neo4j.fixture.json'
);

const FIXTURE_MODE = process.env.MINDRIAN_127_1_FIXTURE_MODE === '1';
const OVERLAP_GATE = 0.80; // Lock 4 BLOCKING cutover gate
const PER_QUERY_WARN_THRESHOLD = 0.60;
const EXPECTED_QUERIES = 20;
const TOP_K = 5;
const EXPECTED_MODEL = 'multilingual-e5-large';
const EXPECTED_DIMS = 1024;

// Gate 1: corpus must exist on disk (Plan 127.1-00 produces it).
if (!fs.existsSync(CORPUS_PATH)) {
  process.stdout.write(
    'corpus missing -- Wave 0 Plan 127.1-00 must run first to produce ' +
      path.relative(process.cwd(), CORPUS_PATH) + '\n'
  );
  process.exitCode = 1;
  return;
}

let corpus;
try {
  corpus = JSON.parse(fs.readFileSync(CORPUS_PATH, 'utf8'));
} catch (err) {
  process.stdout.write(
    'corpus corrupt -- Wave 0 Plan 127.1-00 must regenerate ' +
      path.relative(process.cwd(), CORPUS_PATH) +
      ' (parse error: ' + err.message + ')\n'
  );
  process.exitCode = 1;
  return;
}

// Gate 2: both fixtures must exist (Plan 127.1-03 produces both).
const baselineMissing = !FIXTURE_MODE || !fs.existsSync(BASELINE_FIXTURE_PATH);
const neo4jMissing = !FIXTURE_MODE || !fs.existsSync(NEO4J_FIXTURE_PATH);

if (baselineMissing || neo4jMissing) {
  const missing = [];
  if (baselineMissing) {
    missing.push(path.relative(process.cwd(), BASELINE_FIXTURE_PATH));
  }
  if (neo4jMissing) {
    missing.push(path.relative(process.cwd(), NEO4J_FIXTURE_PATH));
  }
  const reason = !FIXTURE_MODE
    ? 'MINDRIAN_127_1_FIXTURE_MODE not set to 1'
    : 'fixture file(s) do not exist on disk';
  process.stdout.write(
    'fixture missing -- Plan 127.1-03 must run before this gate (' +
      reason + '); missing: ' + missing.join(', ') + '\n'
  );
  process.exitCode = 1;
  return;
}

let baseline;
let neo4j;
try {
  baseline = JSON.parse(fs.readFileSync(BASELINE_FIXTURE_PATH, 'utf8'));
  neo4j = JSON.parse(fs.readFileSync(NEO4J_FIXTURE_PATH, 'utf8'));
} catch (err) {
  process.stdout.write(
    'fixture corrupt -- Plan 127.1-03 must regenerate (parse error: ' +
      err.message + ')\n'
  );
  process.exitCode = 1;
  return;
}

// Helper: compute |a intersect b| / k for two top-k arrays.
function setOverlap(a, b, k) {
  if (!Array.isArray(a) || !Array.isArray(b)) {
    return 0;
  }
  const setA = new Set(a.slice(0, k));
  let hits = 0;
  for (const item of b.slice(0, k)) {
    if (setA.has(item)) {
      hits += 1;
    }
  }
  return hits / k;
}

// Index fixture results by query_id for O(1) lookup.
function indexByQueryId(fixture) {
  const out = new Map();
  if (!fixture || !Array.isArray(fixture.results)) {
    return out;
  }
  for (const row of fixture.results) {
    if (row && typeof row.query_id === 'string') {
      out.set(row.query_id, row);
    }
  }
  return out;
}

test('127.1 Surface 3 -- corpus has 20 queries', () => {
  assert.ok(Array.isArray(corpus.queries), 'corpus.queries must be an array');
  assert.equal(
    corpus.queries.length,
    EXPECTED_QUERIES,
    'corpus.queries.length must be ' + EXPECTED_QUERIES
  );
});

test('127.1 Surface 3 -- embedding model lock (Lock 2)', () => {
  assert.equal(
    baseline.embedding_model,
    EXPECTED_MODEL,
    'baseline.embedding_model must be ' + EXPECTED_MODEL
  );
  assert.equal(
    neo4j.embedding_model,
    EXPECTED_MODEL,
    'neo4j.embedding_model must be ' + EXPECTED_MODEL
  );
});

test('127.1 Surface 3 -- embedding dims lock (Lock 2)', () => {
  assert.equal(
    baseline.embedding_dims,
    EXPECTED_DIMS,
    'baseline.embedding_dims must be ' + EXPECTED_DIMS
  );
  assert.equal(
    neo4j.embedding_dims,
    EXPECTED_DIMS,
    'neo4j.embedding_dims must be ' + EXPECTED_DIMS
  );
});

test('127.1 Surface 3 -- aggregate top-5 overlap >= 0.80 (BLOCKING gate>=0.80)', () => {
  const baselineByQid = indexByQueryId(baseline);
  const neo4jByQid = indexByQueryId(neo4j);

  const overlaps = [];
  for (const q of corpus.queries) {
    const baselineRow = baselineByQid.get(q.id);
    const neo4jRow = neo4jByQid.get(q.id);
    if (!baselineRow || !neo4jRow) {
      // Missing per-query result is a hard fail at this gate.
      process.stdout.write(
        q.id + ': MISSING (baseline=' + Boolean(baselineRow) +
          ' neo4j=' + Boolean(neo4jRow) + ')\n'
      );
      overlaps.push(0);
      continue;
    }
    const overlap_i = setOverlap(baselineRow.top_5, neo4jRow.top_5, TOP_K);
    const hits = Math.round(overlap_i * TOP_K);
    process.stdout.write(
      q.id + ': ' + hits + '/' + TOP_K +
        ' (' + overlap_i.toFixed(2) + ')\n'
    );
    if (overlap_i < PER_QUERY_WARN_THRESHOLD) {
      process.stdout.write(
        'warn ' + q.id + ' below ' +
          PER_QUERY_WARN_THRESHOLD.toFixed(2) +
          ' (' + overlap_i.toFixed(2) +
          ') -- consider HNSW tuning\n'
      );
    }
    overlaps.push(overlap_i);
  }

  const aggregate_overlap =
    overlaps.reduce((acc, x) => acc + x, 0) / overlaps.length;
  const aggregateStr = aggregate_overlap.toFixed(2);
  process.stdout.write(
    'OK 127.1-graphrag-overlap aggregate_top5_overlap=' +
      aggregateStr + ' (gate>=0.80)\n'
  );

  assert.ok(
    aggregate_overlap >= OVERLAP_GATE,
    'aggregate top-5 overlap ' + aggregateStr +
      ' is below the BLOCKING cutover gate ' +
      OVERLAP_GATE.toFixed(2) +
      ' -- tune HNSW m / ef_construction OR document divergence in 127.1 summary'
  );
});
