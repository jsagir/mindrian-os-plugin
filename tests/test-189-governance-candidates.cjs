'use strict';
/*
 * Phase 189-02 Task 1 -- findGovernanceCandidates query (HMG-01).
 * ============================================================================
 * Asserts the closed truth-claim candidate SELECT surfaces EXACTLY the narrowed
 * SEED-040 candidate set through the navigation chokepoint re-export:
 *   (a) two proposed claim nodes with NO decided edge both surface,
 *   (b) a proposed node already carrying a REMEMBERED_AS edge does NOT resurface,
 *   (c) a memory_event system-bookkeeping node NEVER surfaces, even at
 *       review_status='confirmed' (Canon Part 9 audit-node carve-out),
 *   (d) a confirmed (non-proposed) claim does NOT surface.
 *
 * Plain node script (node tests/test-*.cjs), no framework. Hyphens only.
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

let DatabaseSync;
try {
  DatabaseSync = require('node:sqlite').DatabaseSync;
} catch (_e) {
  process.stdout.write('SKIP test-189-governance-candidates.cjs (node:sqlite unavailable)\n');
  process.exit(0);
}

const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));

// Production nodes + edges schema (mirrors phase-109-nodes-provenance.cjs).
function applySchema(db) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS nodes (" +
    "  id TEXT PRIMARY KEY, " +
    "  type TEXT NOT NULL, " +
    "  properties TEXT DEFAULT '{}', " +
    "  source_path TEXT NOT NULL, " +
    "  created_by TEXT NOT NULL CHECK(created_by IN ('user','larry','import','brain','system')), " +
    "  confidence REAL, " +
    "  review_status TEXT NOT NULL DEFAULT 'proposed' " +
    "    CHECK(review_status IN ('proposed','confirmed','rejected','stale','superseded','needs_evidence','validated','invalidated')), " +
    "  created_at INTEGER NOT NULL, " +
    "  last_seen_at INTEGER NOT NULL, " +
    "  source_section TEXT, " +
    "  confirmed_by TEXT, " +
    "  confirmed_at INTEGER" +
    ");"
  );
  db.exec(
    "CREATE TABLE IF NOT EXISTS edges (" +
    "  source TEXT NOT NULL, target TEXT NOT NULL, type TEXT NOT NULL, " +
    "  properties TEXT DEFAULT '{}', PRIMARY KEY (source, target, type)" +
    ");"
  );
}

function insertNode(db, node) {
  const now = Date.now();
  db.prepare(
    "INSERT INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at, source_section) " +
    "VALUES (?, ?, '{}', ?, ?, ?, ?, ?, ?, ?)"
  ).run(
    node.id, node.type, node.source_path || node.id, node.created_by || 'user',
    (typeof node.confidence === 'number') ? node.confidence : null,
    node.review_status || 'proposed', now, now, node.source_section || node.source_path || node.id
  );
}

function insertEdge(db, source, target, type) {
  db.prepare("INSERT INTO edges (source, target, type, properties) VALUES (?, ?, ?, '{}')")
    .run(source, target, type);
}

let pass = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ok - ' + name); pass++; }

const db = new DatabaseSync(':memory:');
applySchema(db);

// (a) two proposed claim nodes, no decided edge.
insertNode(db, { id: 'claim:alpha', type: 'claim', confidence: 0.82, review_status: 'proposed', source_path: 'strategy/alpha' });
insertNode(db, { id: 'claim:beta', type: 'claim', confidence: 0.55, review_status: 'proposed', source_path: 'strategy/beta' });

// (b) a proposed node that ALREADY carries a REMEMBERED_AS edge -> must not resurface.
insertNode(db, { id: 'assumption:gamma', type: 'assumption', confidence: 0.9, review_status: 'proposed', source_path: 'risks/gamma' });
insertEdge(db, 'assumption:gamma', 'risks/gamma', 'REMEMBERED_AS');

// also a proposed node with a NOT_REMEMBERED_BECAUSE edge -> already decided, hidden.
insertNode(db, { id: 'opportunity:delta', type: 'opportunity', confidence: 0.75, review_status: 'proposed', source_path: 'opps/delta' });
insertEdge(db, 'opportunity:delta', 'opps/delta', 'NOT_REMEMBERED_BECAUSE');

// (c) a memory_event system-bookkeeping node, even at review_status='confirmed'.
insertNode(db, { id: 'mem:evt1', type: 'memory_event', confidence: null, review_status: 'confirmed', source_path: 'audit/evt1' });

// (d) a confirmed (non-proposed) claim -> not a pending candidate.
insertNode(db, { id: 'claim:settled', type: 'claim', confidence: 0.99, review_status: 'confirmed', source_path: 'strategy/settled' });

const candidates = navigation.findGovernanceCandidates(db, 'test-room', {});
const ids = new Set(candidates.map((c) => c.candidate_id));

// (a)
ok('proposed claim:alpha surfaces', ids.has('claim:alpha'));
ok('proposed claim:beta surfaces', ids.has('claim:beta'));

// (b)
ok('already-REMEMBERED_AS assumption:gamma does NOT resurface', !ids.has('assumption:gamma'));
ok('already-NOT_REMEMBERED_BECAUSE opportunity:delta does NOT resurface', !ids.has('opportunity:delta'));

// (c)
ok('memory_event node NEVER surfaces (Part 9 carve-out)', !ids.has('mem:evt1'));

// (d)
ok('confirmed claim:settled does NOT surface', !ids.has('claim:settled'));

// candidate shape carries the brain_consult confidence signal + structural handles.
const alpha = candidates.find((c) => c.candidate_id === 'claim:alpha');
ok('candidate carries kind', alpha && alpha.kind === 'claim');
ok('candidate carries confidence (existing n.confidence signal)', alpha && alpha.confidence === 0.82);
ok('candidate carries source_path', alpha && alpha.source_path === 'strategy/alpha');

// exactly the two undecided proposed truth-claims surfaced.
ok('exactly two candidates surface', candidates.length === 2);

// defensive: bad handle returns [] and never throws.
ok('null db returns [] (defensive)', Array.isArray(navigation.findGovernanceCandidates(null, 'r', {})) && navigation.findGovernanceCandidates(null, 'r', {}).length === 0);

db.close();

console.log('CANDIDATES_OK (' + pass + ' assertions passed)');
process.exit(0);
