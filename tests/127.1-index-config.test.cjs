#!/usr/bin/env node
// tests/127.1-index-config.test.cjs
//
// Phase 127.1 -- Surface 2 harness: Neo4j vector index DDL config assertion.
//
// Contract (per .planning/phases/127.1-.../127.1-VALIDATION.md Surface 2):
//   The Neo4j vector index named `mindrian_methodology_vec` MUST be ONLINE,
//   of type VECTOR, configured with vector.dimensions=1024 and
//   vector.similarity_function=cosine, and indexed on the `embedding`
//   property of MethodologyChunk nodes. Wrong dim or wrong metric means
//   all ranking is silently broken (Lock 3 enforcement).
//
// This file is the WAVE 0 NYQUIST scaffold: the harness lands BEFORE the
// substrate that produces the fixture. It is RED-by-design until Plan
// 127.1-02 produces tests/fixtures/127.1/index-config.fixture.json by
// capturing the canonical SHOW INDEXES YIELD row from the live Neo4j
// instance.
//
// Hard rules honored:
//   - No em-dashes (U+2014); hyphens only.
//   - No live Neo4j call; fixture only.
//   - No writes outside this file.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const FIXTURE_PATH = path.join(
  __dirname,
  'fixtures',
  '127.1',
  'index-config.fixture.json'
);

const FIXTURE_MODE = process.env.MINDRIAN_127_1_FIXTURE_MODE === '1';
const LOCKED_INDEX_NAME = 'mindrian_methodology_vec';
const LOCKED_PROPERTY = 'embedding';
const EXPECTED_DIMS = 1024;
const EXPECTED_METRIC = 'cosine';

if (!FIXTURE_MODE || !fs.existsSync(FIXTURE_PATH)) {
  const reason = !FIXTURE_MODE
    ? 'MINDRIAN_127_1_FIXTURE_MODE not set to 1'
    : 'fixture file does not exist on disk';
  process.stdout.write(
    'fixture missing -- run Plan 127.1-02 to generate ' +
      path.relative(process.cwd(), FIXTURE_PATH) +
      ' (' + reason + ')\n'
  );
  process.exitCode = 1;
  return;
}

let fixture;
try {
  fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
} catch (err) {
  process.stdout.write(
    'fixture corrupt -- run Plan 127.1-02 to regenerate ' +
      path.relative(process.cwd(), FIXTURE_PATH) +
      ' (parse error: ' + err.message + ')\n'
  );
  process.exitCode = 1;
  return;
}

test('127.1 Surface 2 -- fixture has non-empty rows array', () => {
  assert.ok(Array.isArray(fixture.rows), 'rows must be an array');
  assert.ok(fixture.rows.length > 0, 'rows must be non-empty');
});

test('127.1 Surface 2 -- locked index name is present in rows', () => {
  const row = fixture.rows.find((r) => r && r.name === LOCKED_INDEX_NAME);
  assert.ok(
    row,
    'no row with name=' + LOCKED_INDEX_NAME +
      ' found (planners renaming the index requires CONTEXT amendment)'
  );
});

test('127.1 Surface 2 -- index state is ONLINE', () => {
  const row = fixture.rows.find((r) => r && r.name === LOCKED_INDEX_NAME);
  assert.equal(row.state, 'ONLINE', 'index state must be ONLINE');
});

test('127.1 Surface 2 -- index type is VECTOR', () => {
  const row = fixture.rows.find((r) => r && r.name === LOCKED_INDEX_NAME);
  assert.equal(row.type, 'VECTOR', 'index type must be VECTOR');
});

test('127.1 Surface 2 -- dim=1024', () => {
  const row = fixture.rows.find((r) => r && r.name === LOCKED_INDEX_NAME);
  assert.ok(row.indexConfig, 'indexConfig must exist on the row');
  assert.equal(
    row.indexConfig['vector.dimensions'],
    EXPECTED_DIMS,
    'vector.dimensions must be ' + EXPECTED_DIMS + ' (Lock 2)'
  );
});

test('127.1 Surface 2 -- similarity_function=cosine', () => {
  const row = fixture.rows.find((r) => r && r.name === LOCKED_INDEX_NAME);
  assert.equal(
    row.indexConfig['vector.similarity_function'],
    EXPECTED_METRIC,
    'vector.similarity_function must be cosine (Lock 3 -- defensive even though Neo4j 5.13+ defaults to cosine)'
  );
});

test('127.1 Surface 2 -- properties array contains embedding', () => {
  const row = fixture.rows.find((r) => r && r.name === LOCKED_INDEX_NAME);
  assert.ok(Array.isArray(row.properties), 'properties must be an array');
  assert.ok(
    row.properties.includes(LOCKED_PROPERTY),
    'properties must include ' + LOCKED_PROPERTY +
      ' (vectors live on the embedding property of MethodologyChunk nodes)'
  );
});

process.on('exit', (code) => {
  if (code === 0) {
    process.stdout.write(
      'OK 127.1-index-config dim=1024 similarity=cosine state=ONLINE\n'
    );
  }
});
