#!/usr/bin/env node
'use strict';

/*
 * Phase 262 Plan 01 Task 2 (D-07, Wave 0) -- answer D-07 with a running
 * assertion (the SEP-projection probe).
 * ==========================================================================
 * D-07 asked: does the orchestration projection surface any `<SEP>`-corrupted
 * node, and therefore do Phases 254 and 255 actually need 28/28? The
 * mechanism that answers it: scripts/build-orchestration-projection.cjs is a
 * Brain-DERIVED LOCAL cache (its own header, BOG-09: "no live Brain read and
 * no live Brain write anywhere in this file"), built from
 * data/connector-registry.json + data/command-registry.json + the local
 * skills/agents walk, so a corrupted `name` property on a Brain :Framework
 * node has no path into this file. The measured answer, dated: 0 `<SEP>`
 * occurrences and 28 framework nodes, measured 2026-09-02 against the
 * committed projection.
 *
 * The scope limit, stated honestly: this probe answers the PROJECTION half
 * of D-07 only. It does NOT prove Phase 255's section-affinity ranking is
 * unaffected, because that path may read the live Brain. That is still open
 * and is routed to the gap ledger (Plan 262-05), not silently generalized.
 *
 * This suite reads the committed data/brain-orchestration-projection.json
 * artifact only. It does NOT run
 * scripts/build-orchestration-projection.cjs and does NOT run it with
 * --check: the suite proves a fact about the committed artifact, regenerating
 * it is a different gate that already exists. Zero network.
 *
 * No em-dashes.
 */

const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const PROJECTION_PATH = path.join(__dirname, '..', 'data', 'brain-orchestration-projection.json');
const FLOOR_SET_PATH = path.join(__dirname, '..', 'data', 'flagship-floor-set.json');

const SEP_MARKER = '<SEP>';
const EXPECTED_MIN_FRAMEWORK_NODES = 28;

const rawText = fs.readFileSync(PROJECTION_PATH, 'utf8');
const projection = JSON.parse(rawText);
const ratifiedFloorSet = JSON.parse(fs.readFileSync(FLOOR_SET_PATH, 'utf8'));

// ---------------------------------------------------------------------------
// Test 1: the raw text carries zero SEP_MARKER occurrences.
// ---------------------------------------------------------------------------
test('the raw projection text contains zero occurrences of the SEP_MARKER literal', () => {
  const occurrences = rawText.split(SEP_MARKER).length - 1;
  assert.equal(occurrences, 0, 'D-07: the orchestration projection must surface zero <SEP>-corrupted content');
});

// ---------------------------------------------------------------------------
// Test 2: no node name or id contains the SEP_MARKER.
// ---------------------------------------------------------------------------
test('no node in projection.nodes has a name or id containing the SEP_MARKER', () => {
  const corrupted = projection.nodes.filter(
    (n) => (typeof n.name === 'string' && n.name.includes(SEP_MARKER)) || (typeof n.id === 'string' && n.id.includes(SEP_MARKER))
  );
  assert.deepStrictEqual(corrupted, [], 'no projection node may carry a <SEP>-corrupted name or id');
});

// ---------------------------------------------------------------------------
// Test 3: at least 28 framework nodes (measured exactly 28 on 2026-09-02).
// ---------------------------------------------------------------------------
test('projection.nodes has at least 28 framework-kind nodes (measured exactly 28 on 2026-09-02)', () => {
  const frameworkNodes = projection.nodes.filter((n) => n.kind === 'framework');
  assert.ok(
    frameworkNodes.length >= EXPECTED_MIN_FRAMEWORK_NODES,
    `expected at least ${EXPECTED_MIN_FRAMEWORK_NODES} framework nodes, found ${frameworkNodes.length}`
  );
});

// ---------------------------------------------------------------------------
// Test 4: every ratified floor name appears as a framework node, byte-exact.
// ---------------------------------------------------------------------------
test('every one of the 28 ratified floor names appears as a framework node with a byte-exact name match', () => {
  const frameworkNames = new Set(projection.nodes.filter((n) => n.kind === 'framework').map((n) => n.name));
  const missing = ratifiedFloorSet.frameworks.filter((name) => !frameworkNames.has(name));
  assert.deepStrictEqual(missing, [], 'every ratified floor name must resolve to a projection framework node');
});

// ---------------------------------------------------------------------------
// Test 5: every framework node carries methodology_tier === 'pws' (Canon
// Part 8: generic machinery metadata only, never a Brain-side blob).
// ---------------------------------------------------------------------------
test("every framework node carries methodology_tier === 'pws'", () => {
  const frameworkNodes = projection.nodes.filter((n) => n.kind === 'framework');
  const offenders = frameworkNodes.filter((n) => n.methodology_tier !== 'pws');
  assert.deepStrictEqual(offenders, [], 'every framework node must carry methodology_tier "pws" (BOG-10, Canon Part 8)');
});
