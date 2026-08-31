'use strict';
// Phase 273 D-03 / D-03a -- defect C3 (Brain edge-type allowlist bypass).
//
// Requirements: CHOKE-04.
//
// RED BY DESIGN until plan 273-04 lands. Today
// lib/core/navigation/ingestion.cjs:56's raw `INSERT OR IGNORE` writes any
// Brain-supplied edge `type` string with zero allowlist check -- including an
// adversarial string like 'DROP TABLE nodes' (stored as an inert parameterized
// value, not executed SQL, per 273-RESEARCH.md's C3 repro). This file pins
// that defect: it MUST fail today, and MUST pass once the inline
// ALLOWED_EDGE_TYPES guard (mirroring edges.cjs's own allowlist, D-03a: no
// routing through writeEdge -- that would silently upgrade INSERT OR IGNORE
// to ON CONFLICT DO UPDATE, a Canon Part 9 regression) lands.
//
// Canon Part 8: no live Brain call anywhere in this file -- packetResult is
// hand-constructed.
//
// Part 9 non-cannibalization guard: this file also proves the fix must
// preserve INSERT OR IGNORE semantics. A routing-through-writeEdge
// implementation would go RED here even after "fixing" C3, because writeEdge
// uses ON CONFLICT DO UPDATE.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const { openRoomDb, closeRoomDb } = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
const { storeBrainSuggestions } = require(path.join(REPO, 'lib', 'core', 'navigation', 'ingestion.cjs'));

function migratedDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p273-ingest-'));
  fs.mkdirSync(path.join(dir, '.mindrian'), { recursive: true });
  return { dir, db: openRoomDb(dir) };
}

async function main() {
  const { dir, db } = migratedDb();
  try {
    const packetResult = {
      job_id: 'j1',
      suggestions: [{
        summary: 's', suggestion_index: 0,
        graph_updates_proposed: [
          { source: 'n1', target: 'n2', type: 'TOTALLY_MADE_UP_TYPE' },
          { source: 'n3', target: 'n4', type: 'DROP TABLE nodes' },
          { source: 'n5', target: 'n6', type: 'INFORMS' },
        ],
      }],
    };

    const res = storeBrainSuggestions(db, packetResult, 'sess1');
    assert.equal(res.ok, true, 'C3: one bad suggestion type must not fail the whole batch');
    assert.equal(res.insightIds.length, 1, 'C3: the brain_insight node must still land');

    const rows = db.prepare('SELECT type FROM edges').all().map((r) => r.type);
    assert.ok(!rows.includes('TOTALLY_MADE_UP_TYPE'), 'C3: an out-of-allowlist type must not land');
    assert.ok(!rows.includes('DROP TABLE nodes'), 'C3: an adversarial type string must not land');
    assert.ok(rows.includes('INFORMS'), 'C3: an allowlisted type must still land');

    assert.ok(Array.isArray(res.rejectedEdgeTypes), 'C3: rejections must be observable, not silent, via rejectedEdgeTypes');
    assert.ok(res.rejectedEdgeTypes.includes('TOTALLY_MADE_UP_TYPE'), 'C3: rejectedEdgeTypes must name TOTALLY_MADE_UP_TYPE');
    assert.ok(res.rejectedEdgeTypes.includes('DROP TABLE nodes'), 'C3: rejectedEdgeTypes must name DROP TABLE nodes');

    // Part 9 guard: INSERT OR IGNORE semantics preserved (re-ingesting the
    // same suggestion does not overwrite the landed edge's properties). A
    // routing-through-writeEdge fix would use ON CONFLICT DO UPDATE instead
    // and go RED right here.
    const before = db.prepare(
      'SELECT properties FROM edges WHERE source = ? AND target = ? AND type = ?'
    ).get('n5', 'n6', 'INFORMS').properties;
    storeBrainSuggestions(db, packetResult, 'sess2');
    const after = db.prepare(
      'SELECT properties FROM edges WHERE source = ? AND target = ? AND type = ?'
    ).get('n5', 'n6', 'INFORMS').properties;
    assert.equal(after, before, 'C3: INSERT OR IGNORE semantics must be preserved (no writeEdge routing)');

    console.log('PASS test-273-ingestion-allowlist');
  } finally {
    closeRoomDb(db);
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
