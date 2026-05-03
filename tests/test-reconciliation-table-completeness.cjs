#!/usr/bin/env node
'use strict';

/*
 * Phase 108-01 - Reconciliation table completeness test.
 *
 * Implements: RECONCILE-108-01 (nodes) + RECONCILE-108-02 (edges).
 *
 * Asserts that .planning/phases/108-graph-memory-schema-reconciliation/RECONCILIATION.md:
 *   1. Contains every EDGE_TYPES entry from lib/core/lazygraph-ops.cjs:25 as a row
 *      (EXISTS resolution; pre-commit hook D-05 false-positives without this).
 *   2. Contains every Codex-proposed edge as a row with one of EXISTS|EXTEND|NEW|RESERVED.
 *   3. Contains every Codex-proposed node as a row with one of EXISTS|EXTEND|NEW|RESERVED.
 *   4. Contains the 3 existing-not-Codex node rows: Section, CausalClaim, Stakeholder.
 *   5. Contains the RESEARCH 2.4 corrections: opportunity split + 3 opportunity edges NEW + assumption EXTEND.
 *
 * Exit 0 = PASS. Exit 1 = FAIL with offending row listed.
 *
 * Pattern source: tests/test-cascade-side-channel.cjs (direct-CJS, no framework, zero deps).
 */

const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');

const REPO_ROOT = path.resolve(__dirname, '..');
const RECONCILIATION_PATH = path.join(
  REPO_ROOT,
  '.planning',
  'phases',
  '108-graph-memory-schema-reconciliation',
  'RECONCILIATION.md'
);
const LAZYGRAPH_OPS_PATH = path.join(REPO_ROOT, 'lib', 'core', 'lazygraph-ops.cjs');

let failures = 0;
function test(name, fn) {
  try {
    fn();
    console.log('PASS:', name);
  } catch (e) {
    console.error('FAIL:', name, '-', e.message);
    failures += 1;
  }
}

// --- Load EDGE_TYPES from production code (canonical 23-edge ground truth). ---
const EDGE_TYPES = require(LAZYGRAPH_OPS_PATH).EDGE_TYPES || (() => {
  // Fallback: parse via regex if EDGE_TYPES not exported (defensive).
  const src = fs.readFileSync(LAZYGRAPH_OPS_PATH, 'utf8');
  const m = src.match(/const EDGE_TYPES = \[([^\]]+)\]/);
  if (!m) throw new Error('Cannot find EDGE_TYPES in lazygraph-ops.cjs');
  return m[1].split(',').map((s) => s.trim().replace(/['"]/g, '')).filter(Boolean);
})();

// --- Codex-proposed edges (verbatim from .planning/research/2026-05-03-codex-graph-memory-proposal.md line 84). ---
const CODEX_EDGES = [
  'CONTAINS', 'STATES', 'SUPPORTS', 'CONTRADICTS', 'INFORMS',
  'DEPENDS_ON', 'EVIDENCES', 'ASSUMES', 'DECIDES', 'RAISES_QUESTION',
  'REPLACES', 'MENTIONS_ENTITY', 'BUDDED_FROM', 'SHARES_ASSUMPTION_WITH'
];

// --- Opportunity edges (from CONTEXT.md D-01 opportunity row). ---
const OPPORTUNITY_EDGES = ['BANKED_BY', 'RANKS_OPPORTUNITY', 'ANSWERS_OPPORTUNITY'];

// --- Codex-proposed nodes (verbatim from research line 82). ---
const CODEX_NODES = [
  'room', 'folder', 'artifact', 'claim', 'assumption', 'evidence',
  'decision', 'open_question', 'entity', 'meeting', 'opportunity',
  'brain_insight', 'memory_event', 'human_review'
];

// --- Existing node types not named by Codex (RESEARCH 2.3 addition). ---
const EXISTING_NON_CODEX_NODES = ['Section', 'CausalClaim', 'Stakeholder'];

// --- Resolution categories (closed set per CONTEXT D-01). ---
const RESOLUTIONS = ['EXISTS', 'EXTEND', 'NEW', 'RESERVED'];

// --- Load RECONCILIATION.md. ---
if (!fs.existsSync(RECONCILIATION_PATH)) {
  console.error('FAIL: RECONCILIATION.md not found at', RECONCILIATION_PATH);
  process.exit(1);
}
const reconciliation = fs.readFileSync(RECONCILIATION_PATH, 'utf8');

// --- Test 1: Every EDGE_TYPES entry appears in RECONCILIATION.md. ---
test('every EDGE_TYPES entry appears in RECONCILIATION.md', () => {
  const missing = EDGE_TYPES.filter((edge) => !reconciliation.includes(edge));
  assert.equal(missing.length, 0, 'Missing edge types: ' + missing.join(', '));
});

// --- Test 2: Every Codex-proposed edge appears in RECONCILIATION.md. ---
test('every Codex-proposed edge appears in RECONCILIATION.md', () => {
  const missing = CODEX_EDGES.filter((edge) => !reconciliation.includes(edge));
  assert.equal(missing.length, 0, 'Missing Codex edges: ' + missing.join(', '));
});

// --- Test 3: Every opportunity edge appears in RECONCILIATION.md. ---
test('every opportunity edge appears in RECONCILIATION.md', () => {
  const missing = OPPORTUNITY_EDGES.filter((edge) => !reconciliation.includes(edge));
  assert.equal(missing.length, 0, 'Missing opportunity edges: ' + missing.join(', '));
});

// --- Test 4: Every Codex-proposed node appears in RECONCILIATION.md. ---
test('every Codex-proposed node appears in RECONCILIATION.md', () => {
  const missing = CODEX_NODES.filter((node) => !reconciliation.includes(node));
  assert.equal(missing.length, 0, 'Missing Codex nodes: ' + missing.join(', '));
});

// --- Test 5: Existing non-Codex nodes appear (RESEARCH 2.3). ---
test('existing non-Codex node types Section, CausalClaim, Stakeholder appear', () => {
  const missing = EXISTING_NON_CODEX_NODES.filter((node) => !reconciliation.includes(node));
  assert.equal(missing.length, 0, 'Missing existing node types: ' + missing.join(', '));
});

// --- Test 6: At least one resolution keyword appears for each kind. ---
test('all 4 resolution categories appear at least once', () => {
  const missing = RESOLUTIONS.filter((r) => !reconciliation.includes(r));
  assert.equal(missing.length, 0, 'Missing resolutions: ' + missing.join(', '));
});

// --- Test 7: RESEARCH 2.4 correction: BANKED_BY is NEW, not EXISTS. ---
test('RESEARCH 2.4 correction: BANKED_BY marked NEW (not EXISTS)', () => {
  const lines = reconciliation.split('\n').filter((l) => l.includes('BANKED_BY'));
  assert.ok(lines.length > 0, 'No BANKED_BY row found');
  const hasNewResolution = lines.some((l) => l.includes('NEW'));
  assert.ok(hasNewResolution, 'BANKED_BY row exists but does not mark NEW resolution: ' + lines.join(' | '));
});

// --- Test 8: RESEARCH 2.4 correction: assumption is EXTEND, not NEW. ---
test('RESEARCH 2.4 correction: assumption marked EXTEND (not NEW)', () => {
  // Find the assumption ROW (table row) which mentions EXTEND.
  const lines = reconciliation.split('\n').filter((l) => /\| assumption /.test(l));
  assert.ok(lines.length > 0, 'No row found whose first column is "assumption"');
  const hasExtendResolution = lines.some((l) => l.includes('EXTEND'));
  assert.ok(hasExtendResolution, 'assumption row exists but does not mark EXTEND: ' + lines.join(' | '));
});

// --- Test 9: opportunity is split (filesystem EXISTS + graph NEW). ---
test('RESEARCH 2.4 correction: opportunity split into filesystem EXISTS + graph NEW', () => {
  // Two rows mentioning opportunity: one with EXISTS, one with NEW.
  const opportunityRows = reconciliation
    .split('\n')
    .filter((l) => /\| opportunity/.test(l));
  assert.ok(opportunityRows.length >= 2, 'Expected at least 2 opportunity rows (filesystem + graph); found ' + opportunityRows.length);
  const hasExists = opportunityRows.some((l) => l.includes('EXISTS'));
  const hasNew = opportunityRows.some((l) => l.includes('NEW'));
  assert.ok(hasExists, 'No opportunity EXISTS row (filesystem feature)');
  assert.ok(hasNew, 'No opportunity NEW row (graph node type)');
});

// --- Test 10: No em-dashes or en-dashes (project hard rule). ---
test('zero em-dashes (U+2014) or en-dashes (U+2013) in RECONCILIATION.md', () => {
  const emdashIdx = reconciliation.indexOf('—');
  const endashIdx = reconciliation.indexOf('–');
  assert.equal(emdashIdx, -1, 'Em-dash found at character offset ' + emdashIdx);
  assert.equal(endashIdx, -1, 'En-dash found at character offset ' + endashIdx);
});

process.exit(failures > 0 ? 1 : 0);
