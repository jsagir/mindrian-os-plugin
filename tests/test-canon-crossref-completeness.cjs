#!/usr/bin/env node
'use strict';

/*
 * Phase 108-06 - Canon cross-reference completeness test.
 *
 * Implements: RECONCILE-108-06.
 *
 * Asserts that:
 *   1. PART-9-PROPOSAL.md exists and contains required sections.
 *   2. CANON-PHASE-MAP.md contains the "Part 9 (proposed)" subsection with
 *      rows pointing at Phases 108, 109, 110.
 *   3. Every reconciliation row in RECONCILIATION.md cites at least one
 *      Canon Part (Part 1..Part 9).
 *   4. Every Canon Part cited resolves either to Parts 1-8 in MINDRIAN-CANON.md
 *      OR to Part 9 in PART-9-PROPOSAL.md (per RESEARCH Pitfall 7 - the test
 *      treats PART-9-PROPOSAL.md as a valid Part 9 source DURING Phase 108).
 *   5. docs/MINDRIAN-CANON.md is NOT edited to add Part 9 (per CONTEXT D-06;
 *      Phase 109 release gate ratifies, not Phase 108).
 *   6. Zero em-dashes in PART-9-PROPOSAL.md (project hard rule).
 *
 * Exit 0 = PASS. Exit 1 = FAIL.
 *
 * Pattern source: tests/test-cascade-side-channel.cjs.
 */

const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');

const REPO_ROOT = path.resolve(__dirname, '..');
const PHASE_DIR = path.join(REPO_ROOT, '.planning', 'phases', '108-graph-memory-schema-reconciliation');
const RECONCILIATION_PATH = path.join(PHASE_DIR, 'RECONCILIATION.md');
const PART_9_PROPOSAL_PATH = path.join(PHASE_DIR, 'PART-9-PROPOSAL.md');
const CANON_PATH = path.join(REPO_ROOT, 'docs', 'MINDRIAN-CANON.md');
const CANON_PHASE_MAP_PATH = path.join(REPO_ROOT, 'docs', 'CANON-PHASE-MAP.md');

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

// ----------------------------------------------------------------------------
// Load files.
// ----------------------------------------------------------------------------
function loadOrFail(p) {
  if (!fs.existsSync(p)) {
    console.error('FAIL: required file missing:', p);
    process.exit(1);
  }
  return fs.readFileSync(p, 'utf8');
}

const reconciliation = loadOrFail(RECONCILIATION_PATH);
const part9Proposal = loadOrFail(PART_9_PROPOSAL_PATH);
const canon = loadOrFail(CANON_PATH);
const canonPhaseMap = loadOrFail(CANON_PHASE_MAP_PATH);

// ----------------------------------------------------------------------------
// Tests.
// ----------------------------------------------------------------------------

test('PART-9-PROPOSAL.md contains required sections', () => {
  assert.ok(/Cross-Reference Matrix/i.test(part9Proposal), 'Missing Cross-Reference Matrix section');
  assert.ok(/Ratification Path/i.test(part9Proposal), 'Missing Ratification Path section');
  assert.ok(/Phase 109 release gate/i.test(part9Proposal), 'Missing Phase 109 release gate trigger');
  assert.ok(part9Proposal.includes('2026-05-03-canon-part-9-memory-locality-proposal.md'), 'Missing reference to Part 9 proposal source file');
});

test('CANON-PHASE-MAP.md contains Part 9 (proposed) subsection', () => {
  assert.ok(/### Part 9 \(proposed\)/i.test(canonPhaseMap), 'Missing "### Part 9 (proposed)" H3 heading');
  assert.ok(canonPhaseMap.includes('Phase 108 graph-memory-schema-reconciliation'), 'Missing Phase 108 row');
  assert.ok(canonPhaseMap.includes('Phase 109 sql-context-memory-navigation-spine'), 'Missing Phase 109 row');
  assert.ok(canonPhaseMap.includes('Phase 110 brain-context-packet-contract'), 'Missing Phase 110 row');
  assert.ok(canonPhaseMap.includes('PART-9-PROPOSAL.md'), 'CANON-PHASE-MAP.md missing reference to PART-9-PROPOSAL.md');
});

test('docs/MINDRIAN-CANON.md is NOT edited to add Part 9 (deferred to Phase 109 release gate)', () => {
  // Per CONTEXT D-06 + RESEARCH Anti-Pattern #2: Phase 108 does NOT edit MINDRIAN-CANON.md.
  // The canon currently has Parts 1-8 (verified by grep for known Part headings).
  // It should NOT yet contain "## Part 9" as a heading (Phase 109 ratifies).
  const hasPart9Heading = /^##\s+Part 9\s/m.test(canon);
  assert.equal(hasPart9Heading, false, 'MINDRIAN-CANON.md was edited to add Part 9 - this is a Phase 108 violation. Part 9 ratification is Phase 109 release gate (CONTEXT D-06).');
});

test('every reconciliation row in RECONCILIATION.md cites at least one Canon Part', () => {
  // Heuristic: every row in a Markdown table with the resolution column needs at least one "Part N" mention.
  // We approximate by parsing rows that contain | EXISTS | EXTEND | NEW | RESERVED |
  //
  // Exclusion: the "## Resolution Categories" section at the top of RECONCILIATION.md
  // is the LEGEND TABLE that defines what EXISTS / EXTEND / NEW / RESERVED MEAN as
  // column values. Those rows are vocabulary definitions, not reconciliation decisions,
  // and therefore carry no Canon Part citation. The Canon-citation requirement applies
  // to ACTUAL reconciliation decisions (rows in the Edge Reconciliation, Node
  // Reconciliation, etc. sections that follow the legend).
  //
  // We skip any row that appears before the FIRST section that is NOT the legend.
  // The legend section header is "## Resolution Categories"; the first decision
  // section header begins with "## " and is not the legend. We track a flag.
  const lines = reconciliation.split('\n');
  let inLegendSection = false;
  let pastLegend = false;
  const reconciliationRows = [];
  for (const line of lines) {
    if (/^##\s+Resolution Categories/i.test(line)) {
      inLegendSection = true;
      continue;
    }
    if (/^##\s+/.test(line)) {
      // Any other H2 ends the legend and starts decision sections.
      if (inLegendSection) {
        inLegendSection = false;
        pastLegend = true;
      }
      continue;
    }
    if (inLegendSection) continue;
    if (!pastLegend) continue;
    if (/\|\s*(EXISTS|EXTEND|NEW|RESERVED)\s*\|/.test(line)) {
      reconciliationRows.push(line);
    }
  }
  assert.ok(reconciliationRows.length > 0, 'No reconciliation rows found in RECONCILIATION.md (after excluding legend section)');

  const orphanRows = reconciliationRows.filter((row) => !/Part\s+\d+/.test(row));
  assert.equal(
    orphanRows.length, 0,
    'Found ' + orphanRows.length + ' reconciliation rows missing Canon Part citation. First offender: ' + (orphanRows[0] || '').slice(0, 120)
  );
});

test('every Canon Part cited in RECONCILIATION.md resolves (Parts 1-8 in CANON, Part 9 in PROPOSAL)', () => {
  // Extract all "Part N" mentions from reconciliation rows.
  // Apply the same legend-exclusion logic as the prior test - the "## Resolution Categories"
  // section defines column-value vocabulary, not reconciliation decisions.
  const lines = reconciliation.split('\n');
  let inLegendSection = false;
  let pastLegend = false;
  const reconciliationRows = [];
  for (const line of lines) {
    if (/^##\s+Resolution Categories/i.test(line)) {
      inLegendSection = true;
      continue;
    }
    if (/^##\s+/.test(line)) {
      if (inLegendSection) {
        inLegendSection = false;
        pastLegend = true;
      }
      continue;
    }
    if (inLegendSection) continue;
    if (!pastLegend) continue;
    if (/\|\s*(EXISTS|EXTEND|NEW|RESERVED)\s*\|/.test(line)) {
      reconciliationRows.push(line);
    }
  }
  const partsFound = new Set();
  for (const row of reconciliationRows) {
    const matches = row.match(/Part\s+(\d+)/g) || [];
    for (const m of matches) {
      const n = parseInt(m.match(/\d+/)[0], 10);
      partsFound.add(n);
    }
  }

  // Canon Parts 1-8 should resolve in MINDRIAN-CANON.md.
  // Part 9 should resolve in PART-9-PROPOSAL.md (per Pitfall 7).
  // Any other part number is an error.
  const orphans = [];
  for (const n of partsFound) {
    if (n >= 1 && n <= 8) {
      // Must appear as a "## Part N" heading in MINDRIAN-CANON.md.
      const re = new RegExp('##\\s+Part\\s+' + n + '\\s', 'm');
      if (!re.test(canon)) orphans.push('Part ' + n + ' (not found in MINDRIAN-CANON.md)');
    } else if (n === 9) {
      // Must appear in PART-9-PROPOSAL.md.
      if (!part9Proposal.includes('Part 9')) orphans.push('Part 9 (not found in PART-9-PROPOSAL.md)');
    } else {
      orphans.push('Part ' + n + ' (no such canon part exists)');
    }
  }
  assert.equal(orphans.length, 0, 'Orphan canon citations: ' + orphans.join(', '));
});

test('PART-9-PROPOSAL.md cites Canon Parts 1, 4, 5, 7, 8 (per RESEARCH §7 traceability matrix)', () => {
  const requiredCitations = [1, 4, 5, 7, 8];
  const missing = [];
  for (const n of requiredCitations) {
    if (!new RegExp('Part\\s+' + n + '\\b').test(part9Proposal)) missing.push('Part ' + n);
  }
  assert.equal(missing.length, 0, 'PART-9-PROPOSAL.md missing required citations: ' + missing.join(', '));
});

test('zero em-dashes (U+2014) in PART-9-PROPOSAL.md', () => {
  const idx = part9Proposal.indexOf('—');
  assert.equal(idx, -1, 'Em-dash found at character offset ' + idx);
});

test('zero en-dashes (U+2013) in PART-9-PROPOSAL.md', () => {
  const idx = part9Proposal.indexOf('–');
  assert.equal(idx, -1, 'En-dash found at character offset ' + idx);
});

process.exit(failures > 0 ? 1 : 0);
