#!/usr/bin/env node
'use strict';

/*
 * Phase 164 Plan 04 -- fable-mode layer 1 (the swarm-side self-critique).
 *
 * Test 4 (164-04-PLAN.md <behavior>): a cell whose self-critique verdict is
 * low-quality (confidence below a floor, or the critique flags the evidence) is
 * down-weighted or dropped BEFORE collection, so it cannot fold into the debate;
 * a clean cell passes through unchanged. The self-critique runs per cell
 * pre-collection (the swarm-side half of two-layered fable-mode, D-164-S3).
 *
 * Pure Node built-ins. No emoji. No em-dashes (hyphens only).
 */

const assert = require('node:assert');
const path = require('node:path');

const fanout = require(path.join(__dirname, '..', 'lib', 'core', 'bono', 'cell-fanout.cjs'));

let passed = 0;
function ok(name) { passed++; console.log('  ok - ' + name); }

(async function main() {
  // -------------------------------------------------------------------------
  // Test 4a: a low-quality cell (the critique flags it) is DROPPED pre-collection.
  // -------------------------------------------------------------------------
  {
    // Two cells: the Black cell returns a garbage low-confidence reading with no
    // evidence; the White cell returns a clean high-confidence reading.
    function dispatchCell(cell) {
      if (cell.hat === 'Black') {
        return Promise.resolve({ stance: 'challenges', evidence: [], confidence: 0.05 });
      }
      return Promise.resolve({ stance: 'supports', evidence: [{ id: 'e1' }], confidence: 0.8 });
    }

    // The self-critique: drop a reading whose confidence is below a floor OR
    // whose evidence is empty while it makes a non-neutral claim.
    function selfCritique(cell) {
      const flaggedThin = cell.confidence < 0.3;
      const flaggedNoEvidence = cell.stance !== 'neutral' && (!cell.evidence || cell.evidence.length === 0);
      if (flaggedThin || flaggedNoEvidence) {
        return { keep: false, reason: flaggedThin ? 'below_confidence_floor' : 'no_evidence', cell };
      }
      return { keep: true, cell };
    }

    const res = await fanout.runCellFanout({
      subdomains: ['sd-1'],
      hats: ['White', 'Black'],
      dispatchCell,
      researchFn: async () => [],
      cap: 10,
      selfCritique,
    });

    // The Black cell was dropped before collection; only the clean White cell survived.
    assert.strictEqual(res.cells.length, 1, 'only the clean cell folded into the collection');
    assert.strictEqual(res.cells[0].hat, 'White', 'the surviving cell is the clean White reading');
    assert.ok(Array.isArray(res.dropped), 'the result carries a dropped list');
    assert.strictEqual(res.dropped.length, 1, 'exactly one cell was dropped pre-collection');
    assert.strictEqual(res.dropped[0].hat, 'Black', 'the dropped cell is the bad Black reading');
    assert.ok(typeof res.dropped[0].reason === 'string' && res.dropped[0].reason.length > 0,
      'the drop records a reason (graph-data-ready): ' + res.dropped[0].reason);
    ok('Test 4a: a bad cell reading is dropped pre-collection (fable-mode layer 1)');
  }

  // -------------------------------------------------------------------------
  // Test 4b: a clean cell passes through UNCHANGED.
  // -------------------------------------------------------------------------
  {
    function dispatchCell() {
      return Promise.resolve({ stance: 'refines', evidence: [{ id: 'e9' }], confidence: 0.72 });
    }
    function selfCritique(cell) {
      return cell.confidence >= 0.3 ? { keep: true, cell } : { keep: false, reason: 'below_floor', cell };
    }

    const res = await fanout.runCellFanout({
      subdomains: ['sd-2'],
      hats: ['Green'],
      dispatchCell,
      researchFn: async () => [],
      cap: 10,
      selfCritique,
    });

    assert.strictEqual(res.cells.length, 1, 'the clean cell survives');
    assert.strictEqual(res.dropped.length, 0, 'nothing dropped for a clean reading');
    assert.strictEqual(res.cells[0].stance, 'refines', 'stance preserved unchanged');
    assert.strictEqual(res.cells[0].confidence, 0.72, 'confidence preserved unchanged');
    assert.strictEqual(res.cells[0].evidence.length, 1, 'evidence preserved unchanged');
    ok('Test 4b: a clean cell passes through self-critique unchanged');
  }

  // -------------------------------------------------------------------------
  // Test 4c: the DEFAULT self-critique (no injected fn) still gates low-confidence.
  // -------------------------------------------------------------------------
  {
    function dispatchCell(cell) {
      // Both cells low confidence; the default critique should drop the worst.
      if (cell.hat === 'Yellow') return Promise.resolve({ stance: 'supports', evidence: [], confidence: 0.02 });
      return Promise.resolve({ stance: 'supports', evidence: [{ id: 'e1' }], confidence: 0.9 });
    }

    const res = await fanout.runCellFanout({
      subdomains: ['sd-3'],
      hats: ['White', 'Yellow'],
      dispatchCell,
      researchFn: async () => [],
      cap: 10,
      // no selfCritique -> exercise the module default
    });

    // The default critique must at least drop the 0.02-confidence Yellow cell.
    const yellow = res.cells.find((c) => c.hat === 'Yellow');
    assert.ok(!yellow, 'the default self-critique dropped the 0.02-confidence cell');
    assert.ok(res.cells.find((c) => c.hat === 'White'), 'the clean White cell survived the default critique');
    ok('Test 4c: the DEFAULT self-critique gates a below-floor reading');
  }

  console.log('\n' + passed + ' assertions/blocks passed (test-bono-cell-selfcritique.cjs)');
})().catch((e) => {
  console.error('FAIL:', e && e.message);
  console.error(e && e.stack);
  process.exit(1);
});
