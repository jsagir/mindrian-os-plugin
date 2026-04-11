/**
 * MindrianOS Plugin -- SQLite LazyGraph Operations Tests
 * Covers all 21 exports from lib/core/lazygraph-ops.cjs
 * Uses Node.js built-in test runner (node:test + node:assert)
 *
 * Run: node tests/test-sqlite-ops.cjs
 */

'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const lazygraph = require('../lib/core/lazygraph-ops.cjs');

// --- Helpers ---

function createTempRoom() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-test-'));
  // Create a section with a test artifact
  const sectionDir = path.join(tmpDir, 'problem-definition');
  fs.mkdirSync(sectionDir, { recursive: true });
  const marketDir = path.join(tmpDir, 'market-analysis');
  fs.mkdirSync(marketDir, { recursive: true });
  return tmpDir;
}

function writeArtifact(roomDir, relPath, content) {
  const fullPath = path.join(roomDir, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf-8');
  return fullPath;
}

function cleanupRoom(roomDir) {
  try {
    fs.rmSync(roomDir, { recursive: true, force: true });
  } catch (e) {
    // ignore cleanup errors
  }
}

// ============================================================
// SQLITE-01: Database lifecycle tests
// ============================================================

describe('SQLITE-01: Database lifecycle', () => {
  let roomDir;

  before(() => {
    roomDir = createTempRoom();
  });

  after(async () => {
    cleanupRoom(roomDir);
  });

  it('openGraph creates room/.mindrian/room.db file', async () => {
    const { db, conn } = await lazygraph.openGraph(roomDir);
    const dbPath = path.join(roomDir, '.mindrian', 'room.db');
    assert.ok(fs.existsSync(dbPath), 'room.db should exist');
    await lazygraph.closeGraph(db);
  });

  it('openGraph returns { db, conn } where conn is a better-sqlite3 Database', async () => {
    const { db, conn } = await lazygraph.openGraph(roomDir);
    assert.ok(db, 'db should be truthy');
    assert.ok(conn, 'conn should be truthy');
    // In SQLite world, conn === db
    assert.strictEqual(db, conn, 'conn should equal db for SQLite');
    await lazygraph.closeGraph(db);
  });

  it('WAL mode is active', async () => {
    const { db, conn } = await lazygraph.openGraph(roomDir);
    const result = conn.pragma('journal_mode');
    assert.deepStrictEqual(result, [{ journal_mode: 'wal' }]);
    await lazygraph.closeGraph(db);
  });

  it('initSchema creates nodes table', async () => {
    const { db, conn } = await lazygraph.openGraph(roomDir);
    const tables = conn.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='nodes'").all();
    assert.strictEqual(tables.length, 1);
    assert.strictEqual(tables[0].name, 'nodes');
    await lazygraph.closeGraph(db);
  });

  it('initSchema creates edges table', async () => {
    const { db, conn } = await lazygraph.openGraph(roomDir);
    const tables = conn.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='edges'").all();
    assert.strictEqual(tables.length, 1);
    assert.strictEqual(tables[0].name, 'edges');
    await lazygraph.closeGraph(db);
  });

  it('closeGraph does not throw', async () => {
    const { db } = await lazygraph.openGraph(roomDir);
    await assert.doesNotReject(async () => {
      await lazygraph.closeGraph(db);
    });
  });
});

// ============================================================
// SQLITE-02: Core 8 functions
// ============================================================

describe('SQLITE-02: Core functions', () => {
  let roomDir, db, conn;

  before(async () => {
    roomDir = createTempRoom();
    writeArtifact(roomDir, 'problem-definition/test-entry.md',
      '---\nmethodology: test-method\ndate: 2026-01-01\n---\n# Test Entry\n\nSome content with [[market-analysis]] wikilink.\n');
    writeArtifact(roomDir, 'market-analysis/market-trends.md',
      '---\nmethodology: porter\n---\n# Market Trends\n\nMarket analysis content.\n');
    const result = await lazygraph.openGraph(roomDir);
    db = result.db;
    conn = result.conn;
  });

  after(async () => {
    await lazygraph.closeGraph(db);
    cleanupRoom(roomDir);
  });

  it('indexArtifact returns correct shape', async () => {
    const filePath = path.join(roomDir, 'problem-definition', 'test-entry.md');
    const result = await lazygraph.indexArtifact(conn, roomDir, filePath);
    assert.strictEqual(result.id, 'problem-definition/test-entry');
    assert.strictEqual(result.section, 'problem-definition');
    assert.strictEqual(result.title, 'Test Entry');
    assert.ok(typeof result.contentHash === 'string');
    assert.strictEqual(result.contentHash.length, 8);
  });

  it('indexArtifact creates Artifact node in nodes table', async () => {
    const rows = conn.prepare("SELECT * FROM nodes WHERE id = 'problem-definition/test-entry' AND type = 'Artifact'").all();
    assert.strictEqual(rows.length, 1);
    const props = JSON.parse(rows[0].properties);
    assert.strictEqual(props.title, 'Test Entry');
    assert.strictEqual(props.section, 'problem-definition');
    assert.strictEqual(props.methodology, 'test-method');
    assert.ok(props.content_hash);
  });

  it('indexArtifact creates Section node in nodes table', async () => {
    const rows = conn.prepare("SELECT * FROM nodes WHERE id = 'problem-definition' AND type = 'Section'").all();
    assert.strictEqual(rows.length, 1);
  });

  it('indexArtifact creates BELONGS_TO edge', async () => {
    const rows = conn.prepare("SELECT * FROM edges WHERE source = 'problem-definition/test-entry' AND target = 'problem-definition' AND type = 'BELONGS_TO'").all();
    assert.strictEqual(rows.length, 1);
  });

  it('indexArtifact with wikilink creates INFORMS edge when target exists', async () => {
    // First index the market-analysis artifact so it exists as a target
    const marketPath = path.join(roomDir, 'market-analysis', 'market-trends.md');
    await lazygraph.indexArtifact(conn, roomDir, marketPath);

    // Re-index the problem-definition artifact (which has [[market-analysis]] wikilink)
    const pdPath = path.join(roomDir, 'problem-definition', 'test-entry.md');
    await lazygraph.indexArtifact(conn, roomDir, pdPath);

    const rows = conn.prepare("SELECT * FROM edges WHERE source = 'problem-definition/test-entry' AND target = 'market-analysis/market-trends' AND type = 'INFORMS'").all();
    assert.strictEqual(rows.length, 1);
  });

  it('rebuildGraph returns correct shape', async () => {
    const result = await lazygraph.rebuildGraph(conn, roomDir);
    assert.strictEqual(result.success, true);
    assert.ok(typeof result.artifacts === 'number');
    assert.ok(result.artifacts >= 2, `Expected >= 2 artifacts, got ${result.artifacts}`);
    assert.ok(typeof result.sections === 'number');
  });

  it('rebuildGraph clears and re-indexes', async () => {
    // After rebuild, nodes should exist fresh
    const nodeCount = conn.prepare('SELECT COUNT(*) AS cnt FROM nodes').get().cnt;
    assert.ok(nodeCount > 0, 'Should have nodes after rebuild');
  });

  it('queryGraph with valid SQL returns array', async () => {
    const result = await lazygraph.queryGraph(conn, 'SELECT COUNT(*) AS cnt FROM nodes');
    assert.ok(Array.isArray(result));
    assert.ok(result.length > 0);
    assert.ok(typeof result[0].cnt === 'number');
  });

  it('queryGraph with invalid SQL returns empty array', async () => {
    const result = await lazygraph.queryGraph(conn, 'SELECT * FROM nonexistent_table_xyz');
    assert.ok(Array.isArray(result));
    assert.strictEqual(result.length, 0);
  });

  it('graphStats returns correct shape', async () => {
    const stats = await lazygraph.graphStats(conn);
    assert.ok(stats.nodes, 'should have nodes object');
    // Dynamic node counts -- check that at least Artifact and Section exist
    assert.ok(typeof stats.nodes.Artifact === 'number', 'should have Artifact count');
    assert.ok(typeof stats.nodes.Section === 'number', 'should have Section count');
    assert.ok(stats.edges, 'should have edges object');
    assert.ok(stats.total, 'should have total object');
    assert.ok(typeof stats.total.nodes === 'number');
    assert.ok(typeof stats.total.edges === 'number');
    // Verify Artifact count matches
    assert.ok(stats.nodes.Artifact >= 2);
  });

  it('embedArtifact returns stub response', async () => {
    const filePath = path.join(roomDir, 'problem-definition', 'test-entry.md');
    const result = await lazygraph.embedArtifact(roomDir, filePath);
    assert.strictEqual(result.success, false);
    assert.ok(typeof result.reason === 'string');
  });

  it('EDGE_TYPES is an array of 19 strings', () => {
    assert.ok(Array.isArray(lazygraph.EDGE_TYPES));
    assert.strictEqual(lazygraph.EDGE_TYPES.length, 19);
    for (const t of lazygraph.EDGE_TYPES) {
      assert.ok(typeof t === 'string');
    }
  });
});

// ============================================================
// SQLITE-02: 12 edge-creator functions
// ============================================================

describe('SQLITE-02: Edge creator functions', () => {
  let roomDir, db, conn;

  before(async () => {
    roomDir = createTempRoom();
    writeArtifact(roomDir, 'problem-definition/artifact-a.md', '# Artifact A\nContent A.\n');
    writeArtifact(roomDir, 'problem-definition/artifact-b.md', '# Artifact B\nContent B.\n');
    writeArtifact(roomDir, 'market-analysis/artifact-c.md', '# Artifact C\nContent C.\n');
    const result = await lazygraph.openGraph(roomDir);
    db = result.db;
    conn = result.conn;

    // Index artifacts so nodes exist for FK constraints
    await lazygraph.indexArtifact(conn, roomDir, path.join(roomDir, 'problem-definition', 'artifact-a.md'));
    await lazygraph.indexArtifact(conn, roomDir, path.join(roomDir, 'problem-definition', 'artifact-b.md'));
    await lazygraph.indexArtifact(conn, roomDir, path.join(roomDir, 'market-analysis', 'artifact-c.md'));
  });

  after(async () => {
    await lazygraph.closeGraph(db);
    cleanupRoom(roomDir);
  });

  it('createAnalogyEdge returns true and creates edge', async () => {
    const result = await lazygraph.createAnalogyEdge(conn, 'problem-definition/artifact-a', 'problem-definition/artifact-b', {
      analogy_distance: 'far',
      structural_fitness: 0.8,
    });
    assert.strictEqual(result, true);
    const rows = conn.prepare("SELECT * FROM edges WHERE source = 'problem-definition/artifact-a' AND target = 'problem-definition/artifact-b' AND type = 'ANALOGOUS_TO'").all();
    assert.strictEqual(rows.length, 1);
  });

  it('createIsomorphismEdge returns true and creates edge', async () => {
    const result = await lazygraph.createIsomorphismEdge(conn, 'problem-definition', 'market-analysis', {
      isomorphism_score: 0.8,
    });
    assert.strictEqual(result, true);
    const rows = conn.prepare("SELECT * FROM edges WHERE source = 'problem-definition' AND target = 'market-analysis' AND type = 'STRUCTURALLY_ISOMORPHIC'").all();
    assert.strictEqual(rows.length, 1);
  });

  it('createResolutionEdge returns true and creates edge', async () => {
    const result = await lazygraph.createResolutionEdge(conn, 'problem-definition/artifact-a', 'problem-definition/artifact-b', {
      resolution_type: 'triz_principle',
    });
    assert.strictEqual(result, true);
    const rows = conn.prepare("SELECT * FROM edges WHERE source = 'problem-definition/artifact-a' AND target = 'problem-definition/artifact-b' AND type = 'RESOLVES_VIA'").all();
    assert.strictEqual(rows.length, 1);
  });

  it('enrichContradictionWithTRIZ returns expected shape', async () => {
    const result = await lazygraph.enrichContradictionWithTRIZ(
      conn, 'problem-definition/artifact-a', 'problem-definition/artifact-b', 'Weight', 'Speed'
    );
    assert.ok(typeof result === 'object');
    assert.ok(typeof result.success === 'boolean');
    assert.ok(Array.isArray(result.principles));
    if (!result.success) {
      assert.ok(typeof result.reason === 'string');
    }
  });

  it('createCausalClaim returns true and creates CausalClaim node', async () => {
    const result = await lazygraph.createCausalClaim(conn, {
      id: 'cc-1',
      cause: 'Market growth',
      mechanism: 'Increased demand',
      effect: 'Revenue increase',
    });
    assert.strictEqual(result, true);
    const rows = conn.prepare("SELECT * FROM nodes WHERE id = 'cc-1' AND type = 'CausalClaim'").all();
    assert.strictEqual(rows.length, 1);
    const props = JSON.parse(rows[0].properties);
    assert.strictEqual(props.cause, 'Market growth');
  });

  it('createExtractedFromEdge returns true and creates edge', async () => {
    const result = await lazygraph.createExtractedFromEdge(conn, 'cc-1', 'problem-definition/artifact-a');
    assert.strictEqual(result, true);
    const rows = conn.prepare("SELECT * FROM edges WHERE source = 'cc-1' AND target = 'problem-definition/artifact-a' AND type = 'EXTRACTED_FROM'").all();
    assert.strictEqual(rows.length, 1);
  });

  it('createCascadesToEdge returns true and creates edge', async () => {
    // Need a second CausalClaim
    await lazygraph.createCausalClaim(conn, {
      id: 'cc-2',
      cause: 'Revenue increase',
      mechanism: 'Investment',
      effect: 'Expansion',
    });
    const result = await lazygraph.createCascadesToEdge(conn, 'cc-1', 'cc-2', { severity: 'high' });
    assert.strictEqual(result, true);
    const rows = conn.prepare("SELECT * FROM edges WHERE source = 'cc-1' AND target = 'cc-2' AND type = 'CASCADES_TO'").all();
    assert.strictEqual(rows.length, 1);
  });

  it('exportCausalGraph returns correct shape', async () => {
    const result = await lazygraph.exportCausalGraph(roomDir);
    assert.ok(result.metadata);
    assert.ok(typeof result.metadata.exported_at === 'string');
    assert.ok(typeof result.metadata.node_count === 'number');
    assert.ok(typeof result.metadata.edge_count === 'number');
    assert.ok(Array.isArray(result.nodes));
    assert.ok(Array.isArray(result.edges));
  });

  it('addWhitespaceZone returns true and creates WhitespaceZone node', async () => {
    const result = await lazygraph.addWhitespaceZone(conn, {
      id: 'ws-1',
      brain_framework: 'JTBD',
    });
    assert.strictEqual(result, true);
    const rows = conn.prepare("SELECT * FROM nodes WHERE id = 'ws-1' AND type = 'WhitespaceZone'").all();
    assert.strictEqual(rows.length, 1);
  });

  it('linkWhitespaceToArtifact returns true and creates edge', async () => {
    const result = await lazygraph.linkWhitespaceToArtifact(conn, 'ws-1', 'problem-definition/artifact-a', 0.5);
    assert.strictEqual(result, true);
    const rows = conn.prepare("SELECT * FROM edges WHERE source = 'ws-1' AND target = 'problem-definition/artifact-a' AND type = 'WHITESPACE_DETECTED'").all();
    assert.strictEqual(rows.length, 1);
  });

  it('linkWhitespaceToSection returns true and creates edge', async () => {
    const result = await lazygraph.linkWhitespaceToSection(conn, 'ws-1', 'problem-definition', 0.8);
    assert.strictEqual(result, true);
    const rows = conn.prepare("SELECT * FROM edges WHERE source = 'ws-1' AND target = 'problem-definition' AND type = 'WHITESPACE_NEAR'").all();
    assert.strictEqual(rows.length, 1);
  });

  it('linkDiscoveryCycleSource returns true and creates edge', async () => {
    const result = await lazygraph.linkDiscoveryCycleSource(conn, 'ws-1', 'problem-definition/artifact-a', 'hsi');
    assert.strictEqual(result, true);
    const rows = conn.prepare("SELECT * FROM edges WHERE source = 'ws-1' AND target = 'problem-definition/artifact-a' AND type = 'DISCOVERY_CYCLE_SOURCE'").all();
    assert.strictEqual(rows.length, 1);
  });
});

// ============================================================
// All 21 exports exist
// ============================================================

describe('All 21 exports present', () => {
  const expectedExports = [
    'EDGE_TYPES', 'openGraph', 'closeGraph', 'initSchema',
    'indexArtifact', 'rebuildGraph', 'queryGraph', 'graphStats',
    'embedArtifact', 'createAnalogyEdge', 'createIsomorphismEdge',
    'createResolutionEdge', 'enrichContradictionWithTRIZ',
    'createCausalClaim', 'createExtractedFromEdge', 'createCascadesToEdge',
    'exportCausalGraph', 'addWhitespaceZone', 'linkWhitespaceToArtifact',
    'linkWhitespaceToSection', 'linkDiscoveryCycleSource',
  ];

  it('module exports exactly 21 keys', () => {
    assert.strictEqual(Object.keys(lazygraph).length, 21);
  });

  for (const name of expectedExports) {
    it(`exports ${name}`, () => {
      assert.ok(name in lazygraph, `Missing export: ${name}`);
    });
  }
});
