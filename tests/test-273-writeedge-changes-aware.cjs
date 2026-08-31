'use strict';
// Phase 273 D-01 / D-01a -- defect C1 (writeEdge silent-discard).
//
// Requirements: CHOKE-02, CHOKE-03, CHOKE-07.
//
// RED BY DESIGN until plan 273-03 lands. Today writeEdge returns only
// { ok, edge_id, type, source, target } on success -- there is no `written`
// field at all, so a second write to a confirmed edge reports `ok: true`
// with no signal that the actual row update was suppressed by the
// confirmed-edge guard (lib/core/navigation/edges.cjs:836-837). This file
// pins that defect: it MUST fail today, and MUST pass once 273-03 adds the
// additive `written: boolean` (+ `reason` on suppression) field without
// touching `ok`'s existing meaning (D-01a: 77 call sites across 43 files
// read `.ok`; flipping it is a regression, not a fix).
//
// Discriminator: `run().changes` (a plain number). The row-id field SQLite
// returns alongside it is measured stale on suppression (RESEARCH Pitfall 2)
// and is never asserted on anywhere in this file.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const { openRoomDb, closeRoomDb } = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
const { writeEdge } = require(path.join(REPO, 'lib', 'core', 'navigation', 'edges.cjs'));

// MIGRATED schema (has review_status). openRoomDb runs the full migration
// chain including phase-224-edge-review-status, so review_status is a real
// column here.
function migratedDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p273-mig-'));
  fs.mkdirSync(path.join(dir, '.mindrian'), { recursive: true });
  return { dir, db: openRoomDb(dir) };
}

async function main() {
  const { dir, db } = migratedDb();
  try {
    // --- Assert 1 + 2 + 3: confirmed-guard suppression is visible, ok is
    // NOT flipped, and the stored row is genuinely unchanged.
    const first = writeEdge(db, {
      source_id: 'a', target_id: 'b', edge_type: 'INFORMS',
      properties: { v: 1 }, review_status: 'confirmed', byUser: 'navigator',
    });
    assert.equal(first.ok, true, 'C1: the first (confirmed) write must succeed');

    const second = writeEdge(db, {
      source_id: 'a', target_id: 'b', edge_type: 'INFORMS',
      properties: { v: 2 }, review_status: 'confirmed', byUser: 'navigator',
    });
    assert.equal(
      second.written, false,
      'C1: a write suppressed by the confirmed guard must report written:false, not silence'
    );
    assert.equal(
      second.reason, 'suppressed_by_confirmed',
      'C1: a suppressed write must name the reason as suppressed_by_confirmed'
    );
    // Contract-preservation guard (D-01a): ok must stay true on suppression,
    // never flipped to false, because 8+ sites treat !ok as fatal
    // (room-birth.cjs:948 rolls back an entire room birth).
    assert.equal(
      second.ok, true,
      'C1: ok must stay true on a suppressed write (43-file blast-radius guard, D-01a)'
    );

    const row = db.prepare(
      'SELECT properties, review_status FROM edges WHERE source = ? AND target = ? AND type = ?'
    ).get('a', 'b', 'INFORMS');
    assert.deepEqual(
      JSON.parse(row.properties), { v: 1, confirmed_by: 'navigator' },
      'C1: the stored row must be genuinely unchanged after the suppressed write'
    );

    // --- Assert 4: a fresh insert reports written:true.
    const freshInsert = writeEdge(db, {
      source_id: 'c', target_id: 'd', edge_type: 'INFORMS',
      properties: { v: 1 },
    });
    assert.equal(freshInsert.ok, true, 'C1: a fresh insert must succeed');
    assert.equal(
      freshInsert.written, true,
      'C1: a fresh insert must report written:true'
    );

    // --- Assert 5: an UPDATE on a proposed row reports written:true.
    const proposedFirst = writeEdge(db, {
      source_id: 'p', target_id: 'q', edge_type: 'INFORMS',
      properties: { v: 1 }, review_status: 'proposed',
    });
    assert.equal(proposedFirst.ok, true, 'C1: the first proposed write must succeed');
    const proposedUpdate = writeEdge(db, {
      source_id: 'p', target_id: 'q', edge_type: 'INFORMS',
      properties: { v: 2 }, review_status: 'proposed',
    });
    assert.equal(
      proposedUpdate.written, true,
      'C1: an UPDATE on a proposed row must report written:true'
    );

    // --- Assert 6 (false-negative guard): an UPDATE writing byte-identical
    // properties still reports written:true. changes is 1 on a no-op-looking
    // update; written is not content-diffing.
    const identicalFirst = writeEdge(db, {
      source_id: 'm', target_id: 'n', edge_type: 'INFORMS',
      properties: { v: 1 },
    });
    assert.equal(identicalFirst.ok, true, 'C1: the first identical-props write must succeed');
    const identicalSecond = writeEdge(db, {
      source_id: 'm', target_id: 'n', edge_type: 'INFORMS',
      properties: { v: 1 },
    });
    assert.equal(
      identicalSecond.written, true,
      'C1: an UPDATE writing identical properties must report written:true, NOT false -- written is not content-diffing'
    );

    // --- Assert 7 (blast-radius guard): a re-write of a confirmed
    // NESTED_WITHIN edge does not throw and returns ok:true, mirroring
    // room-birth.cjs:948's !ok fatal branch.
    const nestedFirst = writeEdge(db, {
      source_id: 'room:child', target_id: 'room:parent', edge_type: 'NESTED_WITHIN',
      properties: { v: 1 }, review_status: 'confirmed', byUser: 'navigator',
    });
    assert.equal(nestedFirst.ok, true, 'C1: the first confirmed NESTED_WITHIN write must succeed');
    const nestedSecond = writeEdge(db, {
      source_id: 'room:child', target_id: 'room:parent', edge_type: 'NESTED_WITHIN',
      properties: { v: 2 }, review_status: 'confirmed', byUser: 'navigator',
    });
    assert.equal(
      nestedSecond.ok, true,
      'C1: a re-write of a confirmed NESTED_WITHIN edge must not throw and must keep ok:true'
    );

    console.log('PASS test-273-writeedge-changes-aware');
  } finally {
    closeRoomDb(db);
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
