'use strict';
// Phase 163-02 -- typed-domain: the domain / subdomain / focus_area node-write
// chokepoint + the linkDomainToRelated edge-linker test suite (D-163-01 + D-163-04).
//
// WAVE 2 FOUNDATION-B. typed-domain.cjs mints domain/subdomain/focus_area as
// FIRST-CLASS typed nodes (D-163-01) and links a domain hub to related existing
// nodes via the four Wave-1 domain edges (DECOMPOSED_INTO / PART_OF / TAGGED_WITH
// / RELATED_TO) THROUGH the navigation.cjs chokepoint ONLY.
//
// Canon Part 9 role 5: a truth-claim domain (taxonomy absent/false) lands
//   review_status 'proposed' and is NEVER auto-confirmed. A PURE TAXONOMY domain
//   (taxonomy:true) is system-bookkeeping and may carry 'confirmed' via the Part 9
//   v1.5 audit-node carve-out spirit (a taxonomy label asserts no venture truth).
// Canon Part 8: zero network surface; pure LOCAL SQLite over a caller-owned handle;
//   typed-domain.cjs carries zero direct require of room-db.cjs / lazygraph-ops.cjs
//   / node:sqlite (chokepoint-only; behavior 8 grep-scans for the bypass).
//
// NO em-dashes anywhere (CLAUDE.md HARD RULE). node:sqlite builds an in-memory
// migrated-nodes-schema db so there is no SKIP path.

const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const REPO_ROOT = path.resolve(__dirname, '..');
const typedDomainPath = path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'typed-domain.cjs');
const {
  writeDomainNode, linkDomainToRelated, DOMAIN_NODE_TYPES,
} = require(typedDomainPath);
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
// CHECK shape from lib/core/migrations/phase-109-nodes-provenance.cjs:293-307)
// plus the edges table so writeEdge round-trips. No SKIP path.
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

console.log('test-typed-domain');

// ---------------------------------------------------------------------------
// Task 1: writeDomainNode
// ---------------------------------------------------------------------------

// Test 1: a domain node mints with type 'domain' and review_status 'proposed'.
check('Test 1 -- writeDomainNode mints a proposed domain node', () => {
  const db = freshDb();
  const r = writeDomainNode(db, { domainType: 'domain', name: 'Quantum Imaging', sessionId: 's1' });
  assert.equal(r.ok, true, `expected ok:true, got ${JSON.stringify(r)}`);
  assert.ok(typeof r.node_id === 'string' && r.node_id.length > 0, 'node_id present');
  const row = db.prepare('SELECT type, review_status FROM nodes WHERE id = ?').get(r.node_id);
  assert.ok(row, 'node must be queryable');
  assert.equal(row.type, 'domain', "type must be 'domain'");
  assert.equal(row.review_status, 'proposed', "truth-claim domain lands 'proposed'");
  db.close();
});

// Test 2: an invalid domainType is rejected (closed-set gate).
check('Test 2 -- writeDomainNode rejects an invalid domainType', () => {
  const db = freshDb();
  const r = writeDomainNode(db, { domainType: 'not_a_real_type', name: 'X', sessionId: 's1' });
  assert.equal(r.ok, false, 'invalid type must be rejected');
  assert.equal(r.reason, 'invalid_domain_type', 'reason names the domain-type gate');
  db.close();
});

// Test 3: re-writing the same (name, sessionId) UPSERTs (idempotent id), not a dup row.
check('Test 3 -- writeDomainNode UPSERTs idempotently (no duplicate row)', () => {
  const db = freshDb();
  const r1 = writeDomainNode(db, { domainType: 'subdomain', name: 'Cell Therapy', sessionId: 's1' });
  const r2 = writeDomainNode(db, { domainType: 'subdomain', name: 'Cell Therapy', sessionId: 's1' });
  assert.equal(r1.ok, true);
  assert.equal(r2.ok, true);
  assert.equal(r1.node_id, r2.node_id, 'same (name, sessionId) yields the same idempotent id');
  const cnt = db.prepare(
    "SELECT COUNT(*) AS n FROM nodes WHERE type = 'subdomain'"
  ).get();
  assert.equal(cnt.n, 1, 're-write UPSERTs, never duplicates');
  db.close();
});

// Test 4: a system-bookkeeping taxonomy domain (taxonomy:true) lands 'confirmed';
//         a truth-claim domain (taxonomy absent/false) stays 'proposed'.
check('Test 4 -- taxonomy:true is confirmed; truth-claim stays proposed', () => {
  const db = freshDb();
  const taxo = writeDomainNode(db, {
    domainType: 'focus_area', name: 'Taxonomy Label', sessionId: 's1', taxonomy: true,
  });
  const claim = writeDomainNode(db, {
    domainType: 'domain', name: 'Truth Claim Domain', sessionId: 's1',
  });
  assert.equal(taxo.ok, true);
  assert.equal(claim.ok, true);
  const taxoRow = db.prepare('SELECT review_status, created_by FROM nodes WHERE id = ?').get(taxo.node_id);
  const claimRow = db.prepare('SELECT review_status FROM nodes WHERE id = ?').get(claim.node_id);
  assert.equal(taxoRow.review_status, 'confirmed', 'pure-taxonomy domain is system-confirmed');
  assert.equal(taxoRow.created_by, 'system', 'taxonomy node created_by system');
  assert.equal(claimRow.review_status, 'proposed', 'truth-claim domain stays proposed (never auto-confirmed)');
  db.close();
});

// ---------------------------------------------------------------------------
// Task 2: linkDomainToRelated + navigation.cjs re-export
// ---------------------------------------------------------------------------

// Test 5: linkDomainToRelated writes both edges via navigation.writeEdge -> {written:2}.
check('Test 5 -- linkDomainToRelated writes two domain edges via the chokepoint', () => {
  const db = freshDb();
  const r = linkDomainToRelated(db, {
    domainId: 'domain:biotech',
    relations: [
      { targetId: 'opportunity:opp-01', edge: 'PART_OF' },
      { targetId: 'domain:biotech', edge: 'TAGGED_WITH' },
    ],
  });
  assert.equal(r.written, 2, `expected written:2, got ${JSON.stringify(r)}`);
  const cnt = db.prepare('SELECT COUNT(*) AS n FROM edges').get();
  assert.equal(cnt.n, 2, 'both edges landed in room.db edges table');
  db.close();
});

// Test 6: a DECOMPOSED_INTO relation is accepted; a non-domain edge type is a
//         failure entry, not a throw.
check('Test 6 -- DECOMPOSED_INTO accepted; non-domain edge rejected (failure entry)', () => {
  const db = freshDb();
  const r = linkDomainToRelated(db, {
    domainId: 'subdomain:cell-therapy',
    relations: [
      { targetId: 'focus_area:car-t', edge: 'DECOMPOSED_INTO' },
      { targetId: 'claim:c-1', edge: 'INFORMS' },
    ],
  });
  assert.equal(r.written, 1, 'only the DECOMPOSED_INTO edge writes');
  assert.ok(Array.isArray(r.failures), 'failures is an array');
  assert.equal(r.failures.length, 1, 'the non-domain edge is a failure entry');
  assert.equal(r.failures[0].edge, 'INFORMS', 'the rejected edge is named');
  assert.equal(r.failures[0].reason, 'edge_not_in_domain_subset', 'rejected for being outside the domain subset');
  db.close();
});

// Test 7: navigation.writeDomainNode + navigation.linkDomainToRelated are callable.
check('Test 7 -- navigation.cjs re-exports both domain writers', () => {
  assert.equal(typeof navigation.writeDomainNode, 'function', 'writeDomainNode re-exported');
  assert.equal(typeof navigation.linkDomainToRelated, 'function', 'linkDomainToRelated re-exported');
  assert.ok(navigation.DOMAIN_NODE_TYPES instanceof Set, 'DOMAIN_NODE_TYPES re-exported as a Set');
});

// Test 8: typed-domain.cjs has zero direct require of room-db.cjs /
//         lazygraph-ops.cjs / node:sqlite (chokepoint-only).
check('Test 8 -- typed-domain.cjs carries no forbidden substrate require', () => {
  const src = fs.readFileSync(typedDomainPath, 'utf8');
  assert.equal(/require\(['"][^'"]*room-db\.cjs['"]\)/.test(src), false, 'no room-db.cjs require');
  assert.equal(/require\(['"][^'"]*lazygraph-ops\.cjs['"]\)/.test(src), false, 'no lazygraph-ops.cjs require');
  assert.equal(/require\(['"]node:sqlite['"]\)/.test(src), false, 'no node:sqlite require');
});

// DOMAIN_NODE_TYPES frozen Set sanity (D-163-01: the three first-class types).
check('DOMAIN_NODE_TYPES is a frozen Set {domain, subdomain, focus_area}', () => {
  assert.equal(DOMAIN_NODE_TYPES instanceof Set, true);
  assert.equal(Object.isFrozen(DOMAIN_NODE_TYPES), true);
  assert.equal(DOMAIN_NODE_TYPES.has('domain'), true);
  assert.equal(DOMAIN_NODE_TYPES.has('subdomain'), true);
  assert.equal(DOMAIN_NODE_TYPES.has('focus_area'), true);
});

console.log(`\nPASS (${pass}/${total})`);
