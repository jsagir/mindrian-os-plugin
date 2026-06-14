#!/usr/bin/env node
/**
 * Phase 156 Plan 02 -- unit test for writeCascadeEdges (FW-05).
 *
 * Asserts (node built-in assert, no framework):
 *   - a ROOT_CAUSES edge (source=parent CAUSE, target=child EFFECT) is written
 *     for each parent->child link, via navigation.writeEdge (the chokepoint)
 *   - a SELECT on room.db edges WHERE type='ROOT_CAUSES' returns one row per link
 *   - edge properties carry enum/scalar ONLY (ring + confidence), never body text
 *   - a ring-1 consequence (parent_id null) writes NO edge
 *   - ROOT_CAUSES (frozen) writes succeed; an ENABLES request (NOT frozen, plan
 *     assumption corrected -- Rule 1 deviation) is REPORTED as a failure and
 *     NEVER silently raw-SQL'd (the chokepoint is honored: no ENABLES edge lands)
 *
 * Single run only, no external test framework. No em-dashes (hyphens only).
 */

'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SUITE = 'test-futures-edges';
const REPO = path.join(__dirname, '..');
const orch = require(path.join(REPO, 'lib', 'core', 'futures', 'orchestrator.cjs'));
const lazygraph = require(path.join(REPO, 'lib', 'core', 'lazygraph-ops.cjs'));
const { insertNode } = require(path.join(REPO, 'lib', 'core', 'node-insert.cjs'));
const { writeCascadeEdges } = orch;

(async () => {
  let tmp;
  try {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'futures-edges-'));
    const graph = await lazygraph.openGraph(tmp);
    const db = graph.db;

    // The edges table FK-references nodes(id) with foreign_keys ON, so the
    // endpoints must exist as Artifact nodes first (exactly as the production
    // FW-06 flow registers them before writing cascade edges).
    for (const id of ['cause-1', 'effect-1', 'effect-2', 'enabled-1']) {
      insertNode(db, id, 'Artifact', JSON.stringify({ title: id, section: 'opportunity-bank' }));
    }

    const consequences = [
      // ring 1: no parent_id -> NO edge
      { id: 'cause-1', ring: 1, parent_id: null, confidence: 0.7 },
      // ring 2: ROOT_CAUSES cause-1 -> effect-1
      { id: 'effect-1', ring: 2, parent_id: 'cause-1', confidence: 0.6, body: 'SECRET BODY must not land on edge' },
      // ring 2: ROOT_CAUSES cause-1 -> effect-2
      { id: 'effect-2', ring: 2, parent_id: 'cause-1', confidence: 0.5 },
      // explicit (non-frozen) ENABLES request -- must be reported, never bypassed
      { id: 'enabled-1', ring: 2, parent_id: 'cause-1', confidence: 0.4, edge_type: 'ENABLES' },
    ];

    const res = writeCascadeEdges(db, consequences);
    assert.strictEqual(res.written, 2, 'two frozen ROOT_CAUSES edges write (ring-1 writes none; non-frozen ENABLES does not)');

    // ROOT_CAUSES rows: 2 (effect-1, effect-2)
    const rootCauses = db.prepare("SELECT source, target, properties FROM edges WHERE type = 'ROOT_CAUSES'").all();
    assert.strictEqual(rootCauses.length, 2, 'two ROOT_CAUSES rows, one per parent->child link');
    for (const row of rootCauses) {
      assert.strictEqual(row.source, 'cause-1', 'ROOT_CAUSES source is the parent CAUSE');
      assert.ok(['effect-1', 'effect-2'].includes(row.target), 'ROOT_CAUSES target is the child EFFECT');
      const props = JSON.parse(row.properties || '{}');
      // Part 8: enum/scalar ONLY -- ring + confidence, never body text.
      assert.ok(typeof props.ring === 'number', 'edge properties carry ring scalar');
      assert.ok(typeof props.confidence === 'number', 'edge properties carry confidence scalar');
      assert.ok(!('body' in props), 'edge properties must NOT carry the consequence body (Part 8)');
      const blob = JSON.stringify(props);
      assert.ok(!/SECRET BODY/.test(blob), 'consequence body text must never reach the edge');
    }

    // ENABLES is NOT frozen -> the chokepoint rejects it; it is REPORTED as a
    // failure and NEVER silently raw-SQL'd, so no ENABLES edge lands in room.db.
    assert.strictEqual(res.failures.length, 1, 'the non-frozen ENABLES request is reported as a failure');
    assert.strictEqual(res.failures[0].reason, 'invalid_edge_type', 'ENABLES is rejected by the frozen-set guard');
    const enables = db.prepare("SELECT source, target FROM edges WHERE type = 'ENABLES'").all();
    assert.strictEqual(enables.length, 0, 'NO ENABLES edge lands (chokepoint honored, no raw-SQL bypass)');

    await lazygraph.closeGraph(db);
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
    console.log('PASS ' + SUITE);
    process.exit(0);
  } catch (e) {
    if (tmp) { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* ignore */ } }
    console.error('FAIL ' + SUITE + ': ' + (e && e.message));
    console.error(e && e.stack);
    process.exit(1);
  }
})();
