#!/usr/bin/env node
/**
 * Phase 156 Plan 03 -- unit test for opportunity banking with edge provenance
 * (FW-08 / FW-09).
 *
 * Asserts (node built-in assert, no framework):
 *   - bankCandidateWithProvenance writes a banked .md under opportunity-bank/
 *     whose frontmatter carries a provenance field naming the source edge
 *     (HSI_CONNECTION / REVERSE_SALIENT / ROOT_CAUSES)
 *   - banking the same problem twice dedups (problem_hash) and updates
 *     confidence if higher, rather than creating a duplicate
 *   - a candidate with no source-edge provenance is REFUSED (returns an error;
 *     nothing is banked)
 *   - banking goes through opportunity-ops.bankOpportunity (source grep), not a
 *     hand-rolled file writer
 *
 * Single run only, no external test framework. No em-dashes (hyphens only).
 */

'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SUITE = 'test-futures-bank';
const REPO = path.join(__dirname, '..');
const ORCH_PATH = path.join(REPO, 'lib', 'core', 'futures', 'orchestrator.cjs');
const orch = require(ORCH_PATH);
const { bankCandidateWithProvenance } = orch;

// Minimal frontmatter field reader (parseFrontmatter is not on the
// opportunity-ops export surface). Returns the scalar value for `key:`.
function fmField(content, key) {
  const re = new RegExp('^' + key + ':\\s*(.*)$', 'm');
  const m = content.match(re);
  if (!m) return undefined;
  return m[1].trim().replace(/^"|"$/g, '');
}

function bankFiles(roomDir) {
  const dir = path.join(roomDir, 'opportunity-bank');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'STATE.md');
}

try {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'futures-bank-'));

  // --- 1. Bank a candidate WITH a traceable source edge (HSI_CONNECTION). ---
  const res1 = bankCandidateWithProvenance(tmp, {
    problem: 'Suburban commute time will balloon as the automobile reshapes cities',
    confidence: 0.6,
    evidence: 'HSI bridge automobile-r1 <-> middle-manager-r3',
    domain: 'Social',
    provenance: { edge_type: 'HSI_CONNECTION', source: 'automobile-r1', target: 'middle-manager-r3' },
  });
  assert.strictEqual(res1.banked, true, 'first bank succeeds');
  assert.ok(res1.path && fs.existsSync(res1.path), 'banked .md exists on disk');

  // Frontmatter carries the provenance field naming the source edge.
  const content1 = fs.readFileSync(res1.path, 'utf8');
  const prov1 = fmField(content1, 'provenance');
  assert.ok(typeof prov1 === 'string' && prov1.length > 0, 'provenance frontmatter present');
  assert.ok(prov1.indexOf('HSI_CONNECTION') >= 0, 'provenance names the HSI_CONNECTION edge type');
  assert.ok(prov1.indexOf('automobile-r1') >= 0, 'provenance names the source endpoint');
  assert.strictEqual(bankFiles(tmp).length, 1, 'exactly one banked file');

  // --- 2. Bank the SAME problem again with higher confidence -> dedup. ---
  const res2 = bankCandidateWithProvenance(tmp, {
    problem: 'Suburban commute time will balloon as the automobile reshapes cities',
    confidence: 0.85,
    evidence: 'Reinforced by a second ripple',
    provenance: { edge_type: 'ROOT_CAUSES', source: 'automobile-r1', target: 'suburbanization-r3' },
  });
  assert.strictEqual(res2.banked, false, 'dedup: not banked as new');
  assert.strictEqual(res2.updated, true, 'dedup: existing file updated');
  assert.strictEqual(bankFiles(tmp).length, 1, 'still exactly one banked file (no duplicate)');
  const content2 = fs.readFileSync(res1.path, 'utf8');
  assert.strictEqual(parseFloat(fmField(content2, 'confidence')), 0.85, 'confidence updated to the higher value');

  // --- 3. A candidate with NO traceable source edge is REFUSED. ---
  const res3 = bankCandidateWithProvenance(tmp, {
    problem: 'A fabricated opportunity with no lineage',
    confidence: 0.9,
    evidence: 'none',
    // no provenance at all
  });
  assert.strictEqual(res3.banked, false, 'un-traceable candidate is refused');
  assert.ok(/no traceable source edge/i.test(res3.error || ''), 'refusal error names the missing provenance');
  assert.strictEqual(bankFiles(tmp).length, 1, 'nothing banked for the un-traceable candidate');

  // A candidate naming an edge type OUTSIDE the allowed set is also refused.
  const res4 = bankCandidateWithProvenance(tmp, {
    problem: 'Another candidate tracing to a non-provenance edge',
    confidence: 0.5,
    provenance: { edge_type: 'INFORMS', source: 'x', target: 'y' },
  });
  assert.strictEqual(res4.banked, false, 'non-provenance edge type refused');
  assert.strictEqual(bankFiles(tmp).length, 1, 'still one banked file');

  // --- 4. A candidate missing the required problem is refused. ---
  const res5 = bankCandidateWithProvenance(tmp, {
    confidence: 0.5,
    provenance: { edge_type: 'REVERSE_SALIENT', source: 'a', target: 'b' },
  });
  assert.strictEqual(res5.banked, false, 'missing problem refused');
  assert.ok(/problem/i.test(res5.error || ''), 'error names the missing problem');

  // --- SOURCE gate: banking routes through opportunity-ops.bankOpportunity. ---
  const src = fs.readFileSync(ORCH_PATH, 'utf8');
  assert.ok(/opportunity-ops/.test(src), 'orchestrator requires opportunity-ops');
  assert.ok(/bankOpportunity\(/.test(src), 'orchestrator calls bankOpportunity (not a hand-rolled writer)');

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('PASS ' + SUITE);
  process.exit(0);
} catch (e) {
  console.error('FAIL ' + SUITE + ': ' + (e && e.message));
  console.error(e && e.stack);
  process.exit(1);
}
