#!/usr/bin/env node
'use strict';

/*
 * Phase 246-02 - Claim (c) extension, re-pinned for D-354-EGR (354-06).
 *
 * WHAT THIS PROVES. Every census Cypher string (scripts/build-brain-census.cjs
 * CENSUS_QUERIES) is content-free at the Part 8 egress boundary:
 *   1. scanForContent() (the default-deny CONTENT-SET scan, the actual
 *      boundary) reports no hit,
 *   2. classify() never returns 'block' and never falls back to
 *      'freeform_unmatched' (the vocabulary-regression tripwire this file has
 *      always carried),
 *   3. the verdict is the documented post-354-06 contract: ambiguous /
 *      freeform_unproven. Since commit 8f87980e5 "generic" means structurally
 *      proven against a closed NATURAL-LANGUAGE vocabulary; Cypher keywords
 *      (MATCH, RETURN, a variable name) are outside it, so no Cypher string
 *      classifies allow. This is intentional (test-239 LEG 4: the template
 *      laundering canary is the same class). Pinning the exact class means a
 *      future change that widens or narrows it turns this red and gets a
 *      conscious review, instead of drifting.
 *   4. the live disposition on the shim-backed scope is unchanged: the
 *      PreToolUse hook exits 0 for every census string (the shim, then
 *      brain-client.cjs, still carries it with an additive egress_disclosure).
 *   5. a NEGATIVE CONTROL: a Cypher string with embedded user content still
 *      classifies block, so this file can fail.
 *
 * The census builder itself never calls classify(): it POSTs through its own
 * brainCall() fetch, so the live census run is independent of this verdict.
 *
 * CJS, node assert only. No em-dashes.
 */

const assert = require('assert');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const guard = require(path.join(ROOT, 'lib', 'core', 'part8-egress-guard.cjs'));
const builder = require(path.join(ROOT, 'scripts', 'build-brain-census.cjs'));
const HOOK = path.join(ROOT, 'scripts', 'part8-egress-guard-hook.cjs');

const PLUGIN_SCOPED_QUERY = 'mcp__plugin_mos_mindrian-brain__brain_query';

let checks = 0;
function ok(cond, msg) {
  assert.ok(cond, msg);
  checks++;
}

function hookExit(cypher) {
  const res = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_name: PLUGIN_SCOPED_QUERY, tool_input: { cypher: cypher }, session_id: 'test-246-census' }),
    encoding: 'utf8',
    timeout: 10000,
    cwd: os.tmpdir(),
    env: Object.assign({}, process.env, { PART8_FORCE_BRAIN_AVAILABLE: '1' }),
  });
  return res.status;
}

function main() {
  console.log('--- test-246-census-guard: every CENSUS_QUERIES string is content-free at the Part 8 boundary ---');

  const queries = builder.CENSUS_QUERIES;
  ok(Array.isArray(queries) && queries.length > 0, 'CENSUS_QUERIES must be a non-empty array');

  const requiredIds = ['C1', 'C2', 'C2a', 'C2b', 'C2c', 'C2d', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9'];
  const ids = queries.map((q) => q.id);
  for (const id of requiredIds) {
    ok(ids.includes(id), 'CENSUS_QUERIES must include id ' + id + ', got ' + JSON.stringify(ids));
  }

  for (const q of queries) {
    const label = 'entry ' + q.id + ' (' + (q.sub || '') + ')';
    ok(typeof q.cypher === 'string' && q.cypher.length > 0, label + ' must carry a non-empty cypher string');

    // 1. The actual boundary: default-deny CONTENT-SET scan.
    const scan = guard.scanForContent({ cypher: q.cypher });
    ok(scan.hit === false, label + ' must carry no CONTENT-SET pattern, got ' + JSON.stringify(scan));

    // 2 + 3. Verdict contract, each asserted EXPLICITLY (never folded).
    const verdict = guard.classify({ cypher: q.cypher }, { toolName: PLUGIN_SCOPED_QUERY });
    ok(verdict.verdict !== 'block', label + ' must never classify block, got ' + JSON.stringify(verdict));
    ok(
      verdict.class !== 'freeform_unmatched',
      label + ' must not fall back to freeform_unmatched (vocabulary regression), got ' + JSON.stringify(verdict)
    );
    ok(
      verdict.verdict === 'ambiguous' && verdict.class === 'freeform_unproven',
      label + ' must classify ambiguous/freeform_unproven under D-354-EGR (354-06), got ' + JSON.stringify(verdict)
    );

    // 4. Live disposition on the shim-backed scope: proceeds (exit 0).
    ok(hookExit(q.cypher) === 0, label + ' must pass the PreToolUse hook on the shim-backed plugin scope (exit 0)');
  }

  // 5. Negative control: embedded user content still blocks.
  const poisoned = guard.classify(
    { cypher: "MATCH (f:Framework) WHERE f.owner = 'someone@example.com' RETURN f" },
    { toolName: PLUGIN_SCOPED_QUERY }
  );
  ok(poisoned.verdict === 'block', 'negative control: Cypher with embedded user content must classify block, got ' + JSON.stringify(poisoned));

  console.log('PASS: test-246-census-guard (' + checks + ' assertions over ' + queries.length + ' census queries)');
  process.exit(0);
}

try {
  main();
} catch (e) {
  console.error('FAIL: ' + (e && e.stack ? e.stack : e));
  process.exit(1);
}
