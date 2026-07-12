'use strict';
// Phase 218-01 Task 2 -- typed-entity: the company / technology / market
// entity-node write chokepoint + the linkEntityRelations edge-linker test suite
// (D-01). typed-entity.cjs is a verbatim structural clone of typed-domain.cjs,
// minting company/technology/market as FIRST-CLASS typed nodes and linking an
// entity node to related nodes via the three Wave-1 domain-relationship edges
// (COMPETES_WITH / USES_COMPONENT / SUPPLIES_TO) plus the existing DESCRIBES
// artifact-link edge THROUGH the navigation.cjs chokepoint ONLY.
//
// Canon Part 9 role 5: an entity node is a PURE TRUTH-CLAIM. It ALWAYS lands
//   review_status 'proposed' and is NEVER auto-confirmed (the taxonomy ->
//   'confirmed' promotion branch present in typed-domain is deliberately OMITTED;
//   REQ-1 + the CONTEXT HITL constraint). Promotion needs a human confirmNode.
// Canon Part 8: zero network surface; pure LOCAL SQLite over a caller-owned handle;
//   typed-entity.cjs carries zero direct require of room-db.cjs / lazygraph-ops.cjs
//   / node:sqlite (chokepoint-only; a grep-scan asserts no raw INSERT INTO).
//
// NO em-dashes anywhere (CLAUDE.md HARD RULE). node:sqlite builds an in-memory
// migrated-nodes-schema db so there is no SKIP path.

const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const REPO_ROOT = path.resolve(__dirname, '..');
const typedEntityPath = path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'typed-entity.cjs');
const {
  writeEntityNode, linkEntityRelations, ENTITY_NODE_TYPES, ENTITY_EDGE_SUBSET,
} = require(typedEntityPath);
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));

let pass = 0;
let total = 0;
function check(label, fn) {
  total += 1;
  fn();
  pass += 1;
  console.log('  ok -', label);
}

// In-memory db with the Phase-109-migrated nodes schema (the wide NOT-NULL +
// CHECK shape) plus the edges table so writeEdge round-trips. No SKIP path.
function freshDb() {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(':memory:');
  db.exec(
    'CREATE TABLE nodes (' +
    '  id TEXT PRIMARY KEY, ' +
    '  type TEXT NOT NULL, ' +
    "  properties TEXT DEFAULT '{}', " +
    '  source_path TEXT NOT NULL, ' +
    "  created_by TEXT NOT NULL CHECK(created_by IN ('user','larry','import','brain','system')), " +
    '  confidence REAL, ' +
    "  review_status TEXT NOT NULL DEFAULT 'proposed' " +
    "    CHECK(review_status IN ('proposed','confirmed','rejected','stale','superseded','needs_evidence','validated','invalidated')), " +
    '  created_at INTEGER NOT NULL, ' +
    '  last_seen_at INTEGER NOT NULL, ' +
    '  source_section TEXT, ' +
    '  confirmed_by TEXT, ' +
    '  confirmed_at INTEGER' +
    ')'
  );
  db.exec(
    "CREATE TABLE edges (source TEXT NOT NULL, target TEXT NOT NULL, type TEXT NOT NULL, " +
    "properties TEXT DEFAULT '{}', PRIMARY KEY(source, target, type));"
  );
  return db;
}

console.log('test-218-entity-writer');

// ---------------------------------------------------------------------------
// Task 2a: writeEntityNode -- proposed-status for all three entity types
// ---------------------------------------------------------------------------

check('Test 1 -- writeEntityNode mints a proposed company node', () => {
  const db = freshDb();
  const r = writeEntityNode(db, { entityType: 'company', name: 'Prodrive', sessionId: 's1' });
  assert.equal(r.ok, true, `expected ok:true, got ${JSON.stringify(r)}`);
  assert.ok(typeof r.node_id === 'string' && r.node_id.length > 0, 'node_id present');
  const row = db.prepare('SELECT type, review_status FROM nodes WHERE id = ?').get(r.node_id);
  assert.ok(row, 'node must be queryable');
  assert.equal(row.type, 'company', "type must be 'company'");
  assert.equal(row.review_status, 'proposed', "entity node lands 'proposed'");
  db.close();
});

check('Test 2 -- technology and market nodes also land proposed', () => {
  const db = freshDb();
  const tech = writeEntityNode(db, { entityType: 'technology', name: 'CRISPR', sessionId: 's1' });
  const market = writeEntityNode(db, { entityType: 'market', name: 'Gene Therapy', sessionId: 's1' });
  assert.equal(tech.ok, true);
  assert.equal(market.ok, true);
  const techRow = db.prepare('SELECT type, review_status FROM nodes WHERE id = ?').get(tech.node_id);
  const marketRow = db.prepare('SELECT type, review_status FROM nodes WHERE id = ?').get(market.node_id);
  assert.equal(techRow.type, 'technology');
  assert.equal(techRow.review_status, 'proposed', 'technology stays proposed (never auto-confirmed)');
  assert.equal(marketRow.type, 'market');
  assert.equal(marketRow.review_status, 'proposed', 'market stays proposed (never auto-confirmed)');
  db.close();
});

// Even a taxonomy:true param MUST NOT promote an entity node (the promotion
// branch is deliberately omitted; REQ-1).
check('Test 3 -- taxonomy:true never confirms an entity node (branch omitted)', () => {
  const db = freshDb();
  const r = writeEntityNode(db, {
    entityType: 'company', name: 'NeverConfirmed', sessionId: 's1', taxonomy: true,
  });
  assert.equal(r.ok, true);
  const row = db.prepare('SELECT review_status FROM nodes WHERE id = ?').get(r.node_id);
  assert.equal(row.review_status, 'proposed', 'entity nodes stay proposed forever, even with taxonomy:true');
  db.close();
});

// ---------------------------------------------------------------------------
// Task 2b: writeEntityNode -- rejection contract (defensive, never throws)
// ---------------------------------------------------------------------------

check('Test 4 -- an invalid entityType is rejected and writes NO row', () => {
  const db = freshDb();
  const before = db.prepare('SELECT COUNT(*) AS n FROM nodes').get().n;
  const r = writeEntityNode(db, { entityType: 'person', name: 'X', sessionId: 's1' });
  assert.equal(r.ok, false, 'invalid type must be rejected');
  assert.equal(r.reason, 'invalid_entity_type', 'reason names the entity-type gate');
  const after = db.prepare('SELECT COUNT(*) AS n FROM nodes').get().n;
  assert.equal(after, before, 'no row written for an invalid type');
  db.close();
});

check('Test 5 -- an empty name is rejected', () => {
  const db = freshDb();
  const r = writeEntityNode(db, { entityType: 'company', name: '', sessionId: 's1' });
  assert.equal(r.ok, false, 'empty name must be rejected');
  assert.equal(r.reason, 'invalid_name', 'reason names the name gate');
  db.close();
});

check('Test 6 -- non-object params are rejected without a throw', () => {
  const db = freshDb();
  const r = writeEntityNode(db, null);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'invalid_params');
  db.close();
});

// ---------------------------------------------------------------------------
// Task 2c: linkEntityRelations + navigation.cjs re-export
// ---------------------------------------------------------------------------

// An entity node links to a memory_artifact node via DESCRIBES; an off-subset
// type is a failure entry, never a throw.
check('Test 7 -- linkEntityRelations links to an artifact (DESCRIBES) and rejects off-subset', () => {
  const db = freshDb();
  // Seed a memory_artifact node to link to.
  const { insertNode } = require(path.join(REPO_ROOT, 'lib', 'core', 'node-insert.cjs'));
  insertNode(db, 'artifact:sec-01', 'memory_artifact', '{}', {
    source_path: 'section:overview', created_by: 'system',
  });
  const ent = writeEntityNode(db, { entityType: 'company', name: 'Prodrive', sessionId: 's1' });
  assert.equal(ent.ok, true);
  const r = linkEntityRelations(db, {
    entityId: ent.node_id,
    relations: [
      { targetId: 'artifact:sec-01', edge: 'DESCRIBES' },
      { targetId: 'entity:s1:rival', edge: 'COMPETES_WITH' },
      { targetId: 'claim:c-1', edge: 'INFORMS' },
    ],
  });
  assert.equal(r.written, 2, `expected written:2 (DESCRIBES + COMPETES_WITH), got ${JSON.stringify(r)}`);
  assert.ok(Array.isArray(r.failures), 'failures is an array');
  assert.equal(r.failures.length, 1, 'the off-subset INFORMS edge is a failure entry');
  assert.equal(r.failures[0].edge, 'INFORMS', 'the rejected edge is named');
  const cnt = db.prepare('SELECT COUNT(*) AS n FROM edges').get().n;
  assert.equal(cnt, 2, 'both accepted edges landed in room.db');
  db.close();
});

check('Test 8 -- the three domain-relationship edges are all accepted', () => {
  const db = freshDb();
  const r = linkEntityRelations(db, {
    entityId: 'entity:s1:acme',
    relations: [
      { targetId: 'entity:s1:rival', edge: 'COMPETES_WITH' },
      { targetId: 'entity:s1:chip', edge: 'USES_COMPONENT' },
      { targetId: 'entity:s1:customer', edge: 'SUPPLIES_TO' },
    ],
  });
  assert.equal(r.written, 3, `expected written:3, got ${JSON.stringify(r)}`);
  assert.equal(r.failures.length, 0, 'no failures');
  db.close();
});

check('Test 9 -- navigation.cjs re-exports writeEntityNode + linkEntityRelations', () => {
  assert.equal(typeof navigation.writeEntityNode, 'function', 'writeEntityNode re-exported');
  assert.equal(typeof navigation.linkEntityRelations, 'function', 'linkEntityRelations re-exported');
  assert.ok(navigation.ENTITY_NODE_TYPES instanceof Set, 'ENTITY_NODE_TYPES re-exported as a Set');
});

// ---------------------------------------------------------------------------
// Frozen-set sanity + substrate-bypass guard
// ---------------------------------------------------------------------------

check('ENTITY_NODE_TYPES is a frozen Set {company, technology, market}', () => {
  assert.equal(ENTITY_NODE_TYPES instanceof Set, true);
  assert.equal(Object.isFrozen(ENTITY_NODE_TYPES), true);
  assert.equal(ENTITY_NODE_TYPES.has('company'), true);
  assert.equal(ENTITY_NODE_TYPES.has('technology'), true);
  assert.equal(ENTITY_NODE_TYPES.has('market'), true);
  assert.equal(ENTITY_NODE_TYPES.has('person'), false);
});

check('ENTITY_EDGE_SUBSET is a frozen Set {COMPETES_WITH, USES_COMPONENT, SUPPLIES_TO}', () => {
  assert.equal(ENTITY_EDGE_SUBSET instanceof Set, true);
  assert.equal(Object.isFrozen(ENTITY_EDGE_SUBSET), true);
  assert.equal(ENTITY_EDGE_SUBSET.has('COMPETES_WITH'), true);
  assert.equal(ENTITY_EDGE_SUBSET.has('USES_COMPONENT'), true);
  assert.equal(ENTITY_EDGE_SUBSET.has('SUPPLIES_TO'), true);
});

check('typed-entity.cjs carries no forbidden substrate require and no raw INSERT', () => {
  const src = fs.readFileSync(typedEntityPath, 'utf8');
  assert.equal(/require\(['"][^'"]*room-db\.cjs['"]\)/.test(src), false, 'no room-db.cjs require');
  assert.equal(/require\(['"][^'"]*lazygraph-ops\.cjs['"]\)/.test(src), false, 'no lazygraph-ops.cjs require');
  assert.equal(/require\(['"]node:sqlite['"]\)/.test(src), false, 'no node:sqlite require');
  assert.equal(/INSERT\s+INTO\s+(nodes|edges)/i.test(src), false, 'no raw INSERT INTO nodes/edges');
});

console.log(`\nPASS (${pass}/${total})`);
