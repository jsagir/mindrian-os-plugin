#!/usr/bin/env node
// tests/127.1-embedding-integrity.test.cjs
//
// Phase 127.1 -- Surface 1 harness: byte-identical embedding integrity.
//
// Contract (per .planning/phases/127.1-.../127.1-VALIDATION.md Surface 1):
//   For each of the 1,427 methodology embeddings, the SHA256 of the float
//   vector stored in Pinecone (pre-cutover) MUST equal the SHA256 of the
//   float vector stored on the corresponding Neo4j MethodologyChunk node
//   (post-cutover). Any drift means re-embedding crept in and must be
//   isolated before the cutover.
//
// This file is the WAVE 0 NYQUIST scaffold: the harness lands BEFORE the
// substrate that produces the fixture. It is RED-by-design until Plan
// 127.1-01 produces tests/fixtures/127.1/embedding-manifest.fixture.json.
//
// Fixture mode is the ONLY supported mode at this surface (Plan 127.1-01
// owns the live capture). Set MINDRIAN_127_1_FIXTURE_MODE=1 to enable.
//
// Hard rules honored:
//   - No em-dashes (U+2014); hyphens only.
//   - No live backend calls; no Pinecone client; no Neo4j client.
//   - No writes outside this file.
//   - No real names; no tester PII.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const FIXTURE_PATH = path.join(
  __dirname,
  'fixtures',
  '127.1',
  'embedding-manifest.fixture.json'
);

const FIXTURE_MODE = process.env.MINDRIAN_127_1_FIXTURE_MODE === '1';
const EXPECTED_VECTOR_COUNT = 1427;
const EXPECTED_DIMS = 1024;
const EXPECTED_METRIC = 'cosine';
const SHA256_HEX_LEN = 64;

// Wave 0 RED-by-design gate: until Plan 127.1-01 produces the fixture, this
// harness exits non-zero with a clear pointer to the producing plan.
if (!FIXTURE_MODE || !fs.existsSync(FIXTURE_PATH)) {
  const reason = !FIXTURE_MODE
    ? 'MINDRIAN_127_1_FIXTURE_MODE not set to 1'
    : 'fixture file does not exist on disk';
  process.stdout.write(
    'fixture missing -- run Plan 127.1-01 to generate ' +
      path.relative(process.cwd(), FIXTURE_PATH) +
      ' (' + reason + ')\n'
  );
  process.exitCode = 1;
  return;
}

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
} catch (err) {
  process.stdout.write(
    'fixture corrupt -- run Plan 127.1-01 to regenerate ' +
      path.relative(process.cwd(), FIXTURE_PATH) +
      ' (parse error: ' + err.message + ')\n'
  );
  process.exitCode = 1;
  return;
}

test('127.1 Surface 1 -- manifest schema is v1', () => {
  assert.equal(manifest.schema_version, 1, 'schema_version must be 1');
});

test('127.1 Surface 1 -- vector_count is exactly 1427', () => {
  assert.equal(
    manifest.vector_count,
    EXPECTED_VECTOR_COUNT,
    'vector_count must be ' + EXPECTED_VECTOR_COUNT
  );
});

test('127.1 Surface 1 -- embedding_dims is exactly 1024', () => {
  assert.equal(
    manifest.embedding_dims,
    EXPECTED_DIMS,
    'embedding_dims must be ' + EXPECTED_DIMS + ' (Lock 2)'
  );
});

test('127.1 Surface 1 -- similarity_metric is cosine', () => {
  assert.equal(
    manifest.similarity_metric,
    EXPECTED_METRIC,
    'similarity_metric must be cosine (Lock 3)'
  );
});

test('127.1 Surface 1 -- checksums is an array of length 1427', () => {
  assert.ok(Array.isArray(manifest.checksums), 'checksums must be an array');
  assert.equal(
    manifest.checksums.length,
    EXPECTED_VECTOR_COUNT,
    'checksums.length must be ' + EXPECTED_VECTOR_COUNT
  );
});

test('127.1 Surface 1 -- every checksum entry has valid shape', () => {
  const drift = [];
  for (let i = 0; i < manifest.checksums.length; i++) {
    const entry = manifest.checksums[i];
    if (typeof entry.node_id !== 'string' || entry.node_id.length === 0) {
      drift.push('idx=' + i + ' (missing or empty node_id)');
      continue;
    }
    if (
      typeof entry.pinecone_sha256 !== 'string' ||
      entry.pinecone_sha256.length !== SHA256_HEX_LEN
    ) {
      drift.push(entry.node_id + ' (pinecone_sha256 not 64 hex chars)');
      continue;
    }
    if (
      typeof entry.neo4j_sha256 !== 'string' ||
      entry.neo4j_sha256.length !== SHA256_HEX_LEN
    ) {
      drift.push(entry.node_id + ' (neo4j_sha256 not 64 hex chars)');
      continue;
    }
  }
  assert.equal(
    drift.length,
    0,
    'shape drift on ' + drift.length + ' entries -- first 5: ' +
      drift.slice(0, 5).join(', ')
  );
});

test('127.1 Surface 1 -- pinecone and neo4j SHA256 are byte-identical (1427 vectors verified)', () => {
  const drift = [];
  for (const entry of manifest.checksums) {
    if (entry.pinecone_sha256 !== entry.neo4j_sha256) {
      drift.push(entry.node_id);
    }
  }
  assert.equal(
    drift.length,
    0,
    'embedding integrity drift on ' + drift.length + ' vectors -- first 5: ' +
      drift.slice(0, 5).join(', ')
  );
});

// Process-level success line so downstream automation can grep for it.
process.on('exit', (code) => {
  if (code === 0) {
    process.stdout.write('OK 127.1-embedding-integrity 1427 vectors verified\n');
  }
});
