'use strict';
// Phase 163-03 -- getDomainsForTrendExtrapolation graph-walking reader test suite.
//
// WAVE 3 FOUNDATION-C. This suite proves the reader the Wave-4 trend pipeline
// seeds itself from (D-163-01 + D-163-04):
//   - Tier 2 PRIMARY (built path): with domain nodes + PART_OF/TAGGED_WITH edges,
//     it WALKS each hub via getNeighborhood and returns related node ids, tier:2.
//   - Tier 0 COLD-START fallback ONLY: with no domain nodes, it parses
//     explore-domains artifacts / BRAIN.md concept handles, returns tier:0,
//     never crashing.
//   - Zero Brain egress + zero raw room-db require (chokepoint-only).
//   - navigation.getDomainsForTrendExtrapolation is callable (re-export resolves).
//
// Canon Part 8: Tier 2 is a LOCAL graph walk; Tier 0 is a LOCAL filesystem read
//   of already-derived artifacts; zero Brain calls (behavior 7 grep-scans).
//
// NO em-dashes anywhere (CLAUDE.md HARD RULE). node:sqlite builds an in-memory
// migrated-nodes-schema db so there is no SKIP path.

const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');
const readerPath = path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'get-domains-for-trends.cjs');
const { getDomainsForTrendExtrapolation } = require(readerPath);
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));

let pass = 0;
let total = 0;
function check(label, fn) {
  total += 1;
  fn();
  pass += 1;
  console.log('  ok -', label);
}

// In-memory db with the Phase-109-migrated nodes schema + edges table so
// getNeighborhood round-trips its recursive CTE. No SKIP path.
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
    "  review_status TEXT NOT NULL DEFAULT 'proposed', " +
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

function insertNode(db, id, type, props, section) {
  const now = Date.now();
  db.prepare(
    'INSERT INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at, source_section) ' +
    "VALUES (?, ?, ?, ?, 'system', 0.5, 'confirmed', ?, ?, ?)"
  ).run(id, type, JSON.stringify(props || {}), 'src:' + id, now, now, section || 'problem-definition');
}

function insertEdge(db, source, target, type) {
  db.prepare("INSERT INTO edges (source, target, type, properties) VALUES (?, ?, ?, '{}')").run(source, target, type);
}

console.log('test-get-domains-for-trends');

// ---------------------------------------------------------------------------
// Test 5: Tier 2 -- domain nodes + PART_OF/TAGGED_WITH edges -> walked related ids.
// ---------------------------------------------------------------------------
check('Test 5 -- getDomainsForTrendExtrapolation walks the domain hub (tier 2)', () => {
  const db = freshDb();
  // A domain hub + two related nodes wired by the domain edges (D-163-03 direction:
  // PART_OF / TAGGED_WITH point FROM the member node TO the domain; getNeighborhood
  // walks edges source -> target, so seed the domain as the SOURCE of an edge to a
  // neighbor as well so the walk surfaces it).
  insertNode(db, 'domain:biotech', 'domain', { name: 'Biotech', domainType: 'domain' });
  insertNode(db, 'subdomain:cell-therapy', 'subdomain', { name: 'Cell Therapy', domainType: 'subdomain' });
  insertNode(db, 'opportunity:opp-01', 'opportunity', { name: 'CAR-T platform' });
  // DECOMPOSED_INTO: domain -> subdomain (the walk surfaces the child).
  insertEdge(db, 'domain:biotech', 'subdomain:cell-therapy', 'DECOMPOSED_INTO');
  // RELATED_TO: domain -> opportunity (the walk surfaces the related opportunity).
  insertEdge(db, 'domain:biotech', 'opportunity:opp-01', 'RELATED_TO');

  const out = getDomainsForTrendExtrapolation('/tmp/room-163-tier2', { db });
  assert.equal(out.tier, 2, `expected tier 2, got ${JSON.stringify(out.tier)}`);
  assert.ok(Array.isArray(out.domains), 'domains is an array');
  const biotech = out.domains.find((d) => d.id === 'domain:biotech');
  assert.ok(biotech, 'the domain hub is present');
  assert.equal(biotech.name, 'Biotech', 'the domain name parsed off the properties blob');
  assert.equal(biotech.domainType, 'domain', 'the domainType parsed');
  assert.ok(Array.isArray(biotech.related), 'related is an array');
  const relatedIds = biotech.related.map((r) => r.id);
  assert.ok(relatedIds.includes('subdomain:cell-therapy'), 'walk surfaced the decomposed subdomain');
  assert.ok(relatedIds.includes('opportunity:opp-01'), 'walk surfaced the related opportunity');
  db.close();
});

// ---------------------------------------------------------------------------
// Test 6: Tier 0 -- no domain nodes -> cold-start artifact/BRAIN.md parse, tier 0.
// ---------------------------------------------------------------------------
check('Test 6 -- cold start falls back to artifacts/BRAIN.md (tier 0), never crashes', () => {
  // A real temp room with a domain-decomposition artifact + a BRAIN.md.
  const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'room-163-tier0-'));
  const decompDir = path.join(roomDir, 'problem-definition', 'domain-decomposition', 'quantum-imaging');
  fs.mkdirSync(decompDir, { recursive: true });
  fs.writeFileSync(
    path.join(decompDir, 'quantum-imaging.md'),
    '---\ndomain: Quantum Imaging\nsubdomains:\n  - Quantum Sensing\n  - Clinical Adoption\n---\nbody\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(roomDir, 'problem-definition', 'BRAIN.md'),
    '---\ndomain: Imaging Physics\n---\nbrain cache body\n',
    'utf8'
  );

  // Case A: with a db handle but NO domain nodes -> still cold start (tier 0).
  const db = freshDb();
  const outWithDb = getDomainsForTrendExtrapolation(roomDir, { db });
  assert.equal(outWithDb.tier, 0, 'no domain nodes -> tier 0 even with a db handle');
  db.close();

  // Case B: no db handle at all -> tier 0.
  const out = getDomainsForTrendExtrapolation(roomDir, {});
  assert.equal(out.tier, 0, 'no db -> tier 0');
  assert.ok(Array.isArray(out.domains), 'domains is an array');
  const names = out.domains.map((d) => d.name);
  assert.ok(names.includes('Quantum Imaging'), 'artifact domain parsed');
  assert.ok(names.includes('Quantum Sensing'), 'artifact subdomain parsed');
  assert.ok(names.includes('Imaging Physics'), 'BRAIN.md concept handle parsed (local cache read)');

  // Defensive: a totally missing room never throws.
  const empty = getDomainsForTrendExtrapolation('/tmp/does-not-exist-163-xyz', {});
  assert.equal(empty.tier, 0, 'missing room -> tier 0');
  assert.deepEqual(empty.domains, [], 'missing room -> empty domains, no crash');

  fs.rmSync(roomDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Test 7: zero Brain calls + zero raw room-db / sqlite require (chokepoint-only).
// ---------------------------------------------------------------------------
check('Test 7 -- reader makes zero Brain calls + zero substrate bypass', () => {
  const src = fs.readFileSync(readerPath, 'utf8');
  assert.equal(/require\(['"][^'"]*room-db\.cjs['"]\)/.test(src), false, 'no room-db.cjs require');
  assert.equal(/require\(['"][^'"]*lazygraph-ops\.cjs['"]\)/.test(src), false, 'no lazygraph-ops.cjs require');
  assert.equal(/require\(['"]node:sqlite['"]\)/.test(src), false, 'no node:sqlite require');
  assert.equal(/require\(['"][^'"]*brain-client\.cjs['"]\)/.test(src), false, 'no brain-client.cjs require');
  // Zero live Brain egress surface: no fetch / http / brain MCP / network token.
  assert.equal(/\bfetch\s*\(/.test(src), false, 'no fetch(');
  assert.equal(/require\(['"]https?['"]\)/.test(src), false, 'no http/https require');
  assert.equal(/mindrian-brain|brain_query|brain\.query/.test(src), false, 'no live Brain call token');
});

// ---------------------------------------------------------------------------
// Test 8: navigation.getDomainsForTrendExtrapolation is callable (re-export).
// ---------------------------------------------------------------------------
check('Test 8 -- navigation.cjs re-exports getDomainsForTrendExtrapolation', () => {
  assert.equal(typeof navigation.getDomainsForTrendExtrapolation, 'function', 're-exported as a function');
  // Smoke: a no-arg-ish call degrades to tier 0, never throws.
  const out = navigation.getDomainsForTrendExtrapolation('/tmp/nope-163', {});
  assert.equal(out.tier, 0, 'degrades to tier 0');
});

console.log(`\nPASS (${pass}/${total})`);
if (pass !== total) process.exit(1);
