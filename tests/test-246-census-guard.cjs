#!/usr/bin/env node
'use strict';

/*
 * Phase 246-02 - Claim (c) extension: every census Cypher string classifies
 * allow under lib/core/part8-egress-guard.cjs classify(), with toolName
 * mcp__plugin_mos_mindrian-brain__brain_query. Mirrors the claim (c) pattern
 * in tests/test-245-brain-envelope-shape.cjs lines 361-382.
 *
 * A future guard-vocabulary regression turns this red: a test that CAN fail.
 * Proven by asserting NOT ONLY verdict === 'allow' but ALSO
 * class !== 'freeform_unmatched' explicitly (never folded into one check).
 *
 * CJS, node assert only. No em-dashes.
 */

const assert = require('assert');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const guard = require(path.join(ROOT, 'lib', 'core', 'part8-egress-guard.cjs'));
const builder = require(path.join(ROOT, 'scripts', 'build-brain-census.cjs'));

const PLUGIN_SCOPED_QUERY = 'mcp__plugin_mos_mindrian-brain__brain_query';

let checks = 0;
function ok(cond, msg) {
  assert.ok(cond, msg);
  checks++;
}

function main() {
  console.log('--- test-246-census-guard: every CENSUS_QUERIES string classifies allow ---');

  const queries = builder.CENSUS_QUERIES;
  ok(Array.isArray(queries) && queries.length > 0, 'CENSUS_QUERIES must be a non-empty array');

  const requiredIds = ['C1', 'C2', 'C2a', 'C2b', 'C2c', 'C2d', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9'];
  const ids = queries.map((q) => q.id);
  for (const id of requiredIds) {
    ok(ids.includes(id), 'CENSUS_QUERIES must include id ' + id + ', got ' + JSON.stringify(ids));
  }

  for (const q of queries) {
    ok(typeof q.cypher === 'string' && q.cypher.length > 0, 'entry ' + q.id + ' must carry a non-empty cypher string');
    const verdict = guard.classify({ cypher: q.cypher }, { toolName: PLUGIN_SCOPED_QUERY });
    ok(
      verdict.verdict === 'allow',
      'entry ' + q.id + ' (' + (q.sub || '') + ') must classify allow, got ' + JSON.stringify(verdict) + ' for cypher: ' + q.cypher
    );
    // Asserted EXPLICITLY, not folded into the verdict check: a future
    // vocabulary regression must redden HERE rather than silently re-gating
    // a content-free census call.
    ok(
      verdict.class !== 'freeform_unmatched',
      'entry ' + q.id + ' (' + (q.sub || '') + ') must not fall back to freeform_unmatched, got ' + JSON.stringify(verdict)
    );
  }

  console.log('PASS: test-246-census-guard (' + checks + ' assertions over ' + queries.length + ' census queries)');
  process.exit(0);
}

try {
  main();
} catch (e) {
  console.error('FAIL: ' + (e && e.stack ? e.stack : e));
  process.exit(1);
}
