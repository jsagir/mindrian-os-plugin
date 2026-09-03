#!/usr/bin/env node
'use strict';

/**
 * Phase 339 Plan 02 (FLIP-05) -- brain_schema memo keyed by resolved origin,
 * STRUCTURAL proof.
 * ==========================================================================
 * A STRUCTURAL source scan over lib/core/brain-client.cjs, copying the
 * tests/test-254-normalize-roundtrip-probe.cjs Arm 4 idiom, never a
 * behavioral test: a behavioral test would need a test-only setter for
 * BRAIN_URL, which permanently widens the module's public surface for no
 * gain (339-RESEARCH.md "Don't Hand-Roll", last row).
 *
 * Five structural assertions inside async function schema()'s body, in
 * order:
 *   1. `_schemaCacheOrigin` appears at least once.
 *   2. indexOf('_schemaCacheOrigin') is LESS THAN indexOf('return
 *      _schemaCache;') -- the structural proof that the origin is compared
 *      BEFORE the cached value is served.
 *   3. The assignment `_schemaCacheOrigin =` occurs in the SAME statement
 *      block as `_schemaCacheAt = Date.now()`, proven by asserting both
 *      appear between the same `if (result != null` guard and its closing
 *      brace -- the origin is recorded whenever the timestamp is, never in
 *      a separate, driftable step.
 *   4. `SCHEMA_CACHE_TTL_MS = 30 * 60 * 1000` is still present and
 *      unmodified (regression).
 *   5. The Phase 247-02 sentinel guard string `result.error` still appears
 *      inside schema() (regression).
 *
 * Outside the function body: `let _schemaCacheOrigin` is declared adjacent
 * to `let _schemaCacheAt` (within three lines of it).
 *
 * A NEGATIVE assertion, with its reason written here rather than only in
 * 339-CONTEXT.md: `flushSchemaMemo` must NOT appear anywhere in
 * lib/core/brain-client.cjs. D-13 as originally written (before research)
 * asked for a flush mechanism on the flip cut. Research corrected the
 * premise: BRAIN_URL is a module-scope const and _schemaCache is
 * process-local, so no process can ever observe an origin change mid-run,
 * and an exported flushSchemaMemo() would therefore have zero callers.
 * Key-by-origin is defense in depth that makes the invariant explicit and
 * testable; a flush function would be dead code the moment it shipped.
 * Adding one later without revisiting this decision is the exact drift
 * this negative assertion exists to catch.
 *
 * THIS TEST IS RED ON THIS PLAN'S OWN RUN. _schemaCacheOrigin does not
 * exist until plan 339-04 adds it; assertion 1 fails first, everything
 * downstream that depends on its index also fails or is skipped by the
 * record() harness's per-arm isolation.
 *
 * No em-dashes (hyphens only).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const BRAIN_CLIENT_PATH = path.join(REPO_ROOT, 'lib', 'core', 'brain-client.cjs');

// ---------------------------------------------------------------------------
// Brace-matching extraction, copied verbatim from
// tests/test-254-normalize-roundtrip-probe.cjs (its own extractBraceBlock /
// extractFunctionBody precedent, Canon Part 7 Reuse Before Build). Real
// source text sliced by brace-matching, read as text only -- never executed,
// never imported live.
// ---------------------------------------------------------------------------
function extractBraceBlock(src, marker) {
  const startIdx = src.indexOf(marker);
  assert.ok(startIdx !== -1, 'marker not found in source: ' + marker);
  const braceStart = src.indexOf('{', startIdx);
  assert.ok(braceStart !== -1, 'no opening brace after marker: ' + marker);
  let depth = 0;
  let i = braceStart;
  for (; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) { i += 1; break; }
    }
  }
  assert.strictEqual(depth, 0, 'unbalanced braces extracting: ' + marker);
  return { full: src.slice(startIdx, i), braceOnly: src.slice(braceStart, i) };
}

function extractFunctionBody(src, fnSignaturePrefix) {
  return extractBraceBlock(src, fnSignaturePrefix).full;
}

async function main() {
  let failed = 0;
  const record = (name, fn) => {
    try {
      fn();
      process.stdout.write('  ok  ' + name + '\n');
    } catch (err) {
      failed += 1;
      process.stderr.write('  FAIL ' + name + '\n    ' + (err && err.stack ? err.stack : String(err)) + '\n');
    }
  };

  process.stdout.write('Phase 339-02 (FLIP-05) schema memo origin-keyed structural scan -- HERMETIC\n');

  const fullSrc = fs.readFileSync(BRAIN_CLIENT_PATH, 'utf8');
  const schemaBody = extractFunctionBody(fullSrc, 'async function schema() {');

  // -------------------------------------------------------------------------
  // Arm 1: _schemaCacheOrigin is referenced at least once inside schema().
  // -------------------------------------------------------------------------
  record('Arm 1: schema() body references _schemaCacheOrigin at least once', () => {
    assert.ok(
      schemaBody.indexOf('_schemaCacheOrigin') !== -1,
      'schema() must reference _schemaCacheOrigin (not present yet in wave 1; plan 339-04 adds it)'
    );
  });

  // -------------------------------------------------------------------------
  // Arm 2: the origin reference comes BEFORE the early memo-serving return.
  // -------------------------------------------------------------------------
  record('Arm 2: the _schemaCacheOrigin comparison precedes the early "return _schemaCache;" (origin checked before the memo is served)', () => {
    const originIdx = schemaBody.indexOf('_schemaCacheOrigin');
    const earlyReturnIdx = schemaBody.indexOf('return _schemaCache;');
    assert.ok(originIdx !== -1, '_schemaCacheOrigin must be present to compare its index (see Arm 1)');
    assert.ok(earlyReturnIdx !== -1, 'schema() must still carry its early "return _schemaCache;" memo-serving line');
    assert.ok(
      originIdx < earlyReturnIdx,
      'index of _schemaCacheOrigin (' + originIdx + ') must be LESS THAN index of "return _schemaCache;" (' + earlyReturnIdx + ') -- ' +
        'the origin must be compared before the cached value can ever be served'
    );
  });

  // -------------------------------------------------------------------------
  // Arm 3: the origin assignment lives in the SAME block as the timestamp
  // assignment -- the origin is recorded whenever the timestamp is.
  // -------------------------------------------------------------------------
  record('Arm 3: "_schemaCacheOrigin =" is assigned in the same if (result != null ...) block as "_schemaCacheAt = Date.now();"', () => {
    const guardBlock = extractBraceBlock(schemaBody, 'if (result != null').braceOnly;
    assert.ok(
      guardBlock.indexOf('_schemaCacheAt = Date.now();') !== -1,
      'the existing "_schemaCacheAt = Date.now();" assignment must still be inside the if (result != null ...) guard block'
    );
    assert.ok(
      guardBlock.indexOf('_schemaCacheOrigin =') !== -1,
      '"_schemaCacheOrigin =" must be assigned inside the SAME if (result != null ...) guard block as _schemaCacheAt ' +
        '(not present yet in wave 1; plan 339-04 adds it)'
    );
  });

  // -------------------------------------------------------------------------
  // Arm 4: declaration adjacency, module scope (outside the function).
  // -------------------------------------------------------------------------
  record('Arm 4: "let _schemaCacheOrigin" is declared within three lines of "let _schemaCacheAt" (module scope)', () => {
    const lines = fullSrc.split('\n');
    const atLineIdx = lines.findIndex((l) => l.indexOf('let _schemaCacheAt') !== -1);
    assert.ok(atLineIdx !== -1, 'let _schemaCacheAt must still be declared at module scope');
    const windowStart = Math.max(0, atLineIdx - 3);
    const windowEnd = Math.min(lines.length, atLineIdx + 4);
    const nearby = lines.slice(windowStart, windowEnd).join('\n');
    assert.ok(
      nearby.indexOf('let _schemaCacheOrigin') !== -1,
      'let _schemaCacheOrigin must be declared within three lines of let _schemaCacheAt ' +
        '(not present yet in wave 1; plan 339-04 adds it). Nearby source:\n' + nearby
    );
  });

  // -------------------------------------------------------------------------
  // Arm 5 (regression): the 30-minute TTL constant survives unmodified.
  // -------------------------------------------------------------------------
  record('Arm 5 (regression): SCHEMA_CACHE_TTL_MS = 30 * 60 * 1000 is still present, unmodified', () => {
    assert.ok(
      fullSrc.indexOf('SCHEMA_CACHE_TTL_MS = 30 * 60 * 1000') !== -1,
      'the 30-minute TTL constant must survive this phase unmodified'
    );
  });

  // -------------------------------------------------------------------------
  // Arm 6 (regression): the Phase 247-02 sentinel guard survives.
  // -------------------------------------------------------------------------
  record('Arm 6 (regression): the Phase 247-02 sentinel guard string result.error still appears inside schema()', () => {
    assert.ok(
      schemaBody.indexOf('result.error') !== -1,
      'the Phase 247-02 audit-fix sentinel guard (never cache a tier_denied/invalid_key result) must survive this phase'
    );
  });

  // -------------------------------------------------------------------------
  // Arm 7 (negative): flushSchemaMemo must never exist anywhere in the file.
  // Reason recorded here, not only in 339-CONTEXT.md D-13: BRAIN_URL is a
  // module-scope const and _schemaCache is process-local, so no process can
  // ever observe an origin change mid-run. An exported flushSchemaMemo()
  // would have zero callers the day it shipped. Key-by-origin (Arms 1-4
  // above) is the defense-in-depth mechanism that makes this invariant
  // explicit and testable without ever needing a flush.
  // -------------------------------------------------------------------------
  record('Arm 7 (negative): flushSchemaMemo does not exist anywhere in lib/core/brain-client.cjs (D-13 corrected, no flush is needed)', () => {
    assert.ok(
      fullSrc.indexOf('flushSchemaMemo') === -1,
      'flushSchemaMemo must never be introduced: BRAIN_URL is a module-scope const, _schemaCache is process-local, ' +
        'no process can observe an origin change mid-run, so a flush function would have zero callers (D-13 corrected)'
    );
  });

  process.stdout.write(
    '\nPhase 339-02 (FLIP-05) schema memo origin-keyed structural scan: ' + (failed === 0 ? 'PASS' : 'FAIL') + ' (' + failed + ' failures)\n'
  );
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  process.stderr.write('UNEXPECTED ERROR: ' + (err && err.stack ? err.stack : String(err)) + '\n');
  process.exit(1);
});

// No em-dashes.
