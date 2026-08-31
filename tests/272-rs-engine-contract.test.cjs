#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * tests/272-rs-engine-contract.test.cjs
 *
 * Phase 272, PYPORT-02 (rs-engine.cjs contract). RED by design until
 * lib/core/rs-engine.cjs (plan 272-08) exists and can actually run Mode A
 * internal against a real, disk-backed room.
 *
 * BINDING CONTRACT this test asserts against (272-08 MUST match exactly,
 * per the "pick ONE explicit name" precedent set by plan 272-01):
 *
 *   lib/core/rs-engine.cjs exports an async function
 *
 *     runModeInternal(roomDir, opts) -> Promise<{ metadata, pairs }>
 *
 *   mirroring scripts/rs-engine.py's run_mode_internal (:591-668). Calling
 *   it against a room MUST also write <roomDir>/.rs-engine-results.json
 *   (atomic write -- temp file then rename, matching
 *   _save_embedding_cache's pattern at scripts/rs-engine.py:260-262, per
 *   272-PATTERNS.md convention 11), whose parsed JSON matches the returned
 *   object shape.
 *
 * Result schema (scripts/rs-engine.py run_mode_internal, quoted verbatim in
 * 272-PATTERNS.md file #5):
 *   metadata: { mode, room_dir, artifact_count, topk_requested, threshold,
 *               embedding_model, thesis_generated, no_thesis, edges_written,
 *               timestamp, engine_version }
 *   pairs: [{ source_artifact_id, source_title, source_section,
 *             target_artifact_id, target_title, target_section,
 *             lsa_score, semantic_score, signed_diff, abs_diff, direction }]
 *
 * This is the SAME field set lib/agents/reverse-salient-agent.cjs's
 * normalizePair (:215-227) already expects from .rs-engine-results.json --
 * rs-engine.cjs must satisfy BOTH the Python schema and this existing CJS
 * consumer's field names (272-PATTERNS.md file #5, "Output contract").
 *
 * No em-dashes (CLAUDE.md HARD RULE). Use hyphens.
 */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const RS_ENGINE_MODULE_PATH = path.join(REPO_ROOT, 'lib', 'core', 'rs-engine.cjs');
const ROOM_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', '272', 'room');
const RESULTS_FILENAME = '.rs-engine-results.json';

const REQUIRED_PAIR_FIELDS = [
  'source_artifact_id',
  'source_title',
  'source_section',
  'target_artifact_id',
  'target_title',
  'target_section',
  'lsa_score',
  'semantic_score',
  'signed_diff',
  'abs_diff',
  'direction',
];

const REQUIRED_METADATA_FIELDS = ['mode', 'artifact_count', 'embedding_model', 'engine_version'];

const VALID_DIRECTIONS = new Set(['structural_transfer', 'semantic_implementation']);

let rsEngineModule;
try {
  // eslint-disable-next-line global-require
  rsEngineModule = require(RS_ENGINE_MODULE_PATH);
} catch (_e) {
  rsEngineModule = null;
}

async function main() {
  // Assert 1: the module exists and exports the exact contract name. RED
  // today: lib/core/rs-engine.cjs does not exist until plan 272-08 lands.
  assert.ok(
    rsEngineModule !== null,
    'lib/core/rs-engine.cjs does not exist yet (expected until plan 272-08 lands) -- ' +
      'this test is RED by design for Phase 272 Wave 0'
  );
  assert.ok(
    typeof rsEngineModule.runModeInternal === 'function',
    'lib/core/rs-engine.cjs MUST export an async function named runModeInternal(roomDir, opts) -- ' +
      'see this file header for the exact contract'
  );

  const resultsPath = path.join(ROOM_DIR, RESULTS_FILENAME);
  // Defensive pre-clean so a stray file from a prior failed run cannot make
  // this assertion pass vacuously.
  if (fs.existsSync(resultsPath)) {
    fs.unlinkSync(resultsPath);
  }

  try {
    const result = await rsEngineModule.runModeInternal(ROOM_DIR, {});

    // Assert (a): top-level shape.
    assert.ok(result && typeof result === 'object', 'runModeInternal must return an object');
    assert.ok('metadata' in result, 'result must have a metadata key');
    assert.ok('pairs' in result, 'result must have a pairs key');
    assert.ok(Array.isArray(result.pairs), 'result.pairs must be an array');

    // Assert (b): metadata minimum fields.
    for (const field of REQUIRED_METADATA_FIELDS) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(result.metadata, field),
        `result.metadata is missing required field: ${field}`
      );
    }
    assert.equal(result.metadata.mode, 'internal', 'metadata.mode must be "internal"');

    // Assert (c): every pair has ALL Python fields, asserted on the actual
    // returned object, not a mocked stub.
    assert.ok(result.pairs.length > 0, 'expected at least one pair from a 96-artifact fixture room');
    for (const pair of result.pairs) {
      for (const field of REQUIRED_PAIR_FIELDS) {
        assert.ok(
          Object.prototype.hasOwnProperty.call(pair, field),
          `pair is missing required field: ${field} (pair: ${JSON.stringify(pair)})`
        );
      }
    }

    // Assert (d): .rs-engine-results.json was written (atomic write), and
    // parses to the same shape as the in-memory return value.
    assert.ok(
      fs.existsSync(resultsPath),
      `runModeInternal must write ${RESULTS_FILENAME} to the room directory it was pointed at`
    );
    const onDisk = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
    assert.ok('metadata' in onDisk && 'pairs' in onDisk, 'on-disk results file must match the returned shape');
    assert.equal(onDisk.pairs.length, result.pairs.length, 'on-disk pairs count must match the returned pairs count');

    // Assert (e): direction is only ever one of the two Convention A values
    // (never a third value -- Convention A, per F-3/PATTERNS.md convention 8).
    for (const pair of result.pairs) {
      assert.ok(
        VALID_DIRECTIONS.has(pair.direction),
        `pair.direction must be structural_transfer or semantic_implementation, got: ${pair.direction}`
      );
    }

    console.log('PASS 272-rs-engine-contract');
  } finally {
    // Clean up any .rs-engine-results.json this test caused to be written,
    // so re-running this test does not leave stray state.
    if (fs.existsSync(resultsPath)) {
      fs.unlinkSync(resultsPath);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
