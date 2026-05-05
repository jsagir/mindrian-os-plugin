'use strict';
// Phase 109 Wave 0 perf-room generator.
// Generates a 10K-node room programmatically for tests/test-navigation-perf-10k.cjs (Plan 109-04).
// Targets per RESEARCH section 10.5: cold neighborhood query <200ms p95; warm <50ms p95.
// Edge density: 3-5 edges per node weighted toward CONTRADICTS / SUPPORTS / DEPENDS_ON / ASSUMES.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const NODE_TYPE_MIX = [
  { type: 'claim', weight: 0.30 },
  { type: 'assumption', weight: 0.20 },
  { type: 'evidence', weight: 0.15 },
  { type: 'decision', weight: 0.10 },
  { type: 'opportunity', weight: 0.05 },
  { type: 'open_question', weight: 0.05 },
  { type: 'memory_event', weight: 0.10 },
  { type: 'entity', weight: 0.05 },
];

const HIGH_WEIGHT_EDGE_TYPES = ['CONTRADICTS', 'SUPPORTS', 'DEPENDS_ON', 'ASSUMES'];
const FILL_EDGE_TYPES = ['INFORMS', 'ENABLES', 'CONVERGES', 'MENTIONS_ENTITY', 'BELONGS_TO'];

function pickType(rng) {
  let r = rng();
  for (const entry of NODE_TYPE_MIX) {
    r -= entry.weight;
    if (r <= 0) return entry.type;
  }
  return NODE_TYPE_MIX[0].type;
}

function generatePerfRoom(targetNodeCount, dbPath) {
  const db = new DatabaseSync(dbPath);

  // Apply Phase 109 schema (caller is responsible for running the migration first;
  // this helper assumes nodes plus edges exist).
  // Verify schema. If nodes table missing OR missing the source_path column, throw.
  const cols = db.prepare("PRAGMA table_info(nodes)").all();
  const colNames = cols.map((c) => c.name);
  const required = ['id', 'type', 'properties', 'source_path', 'created_by', 'confidence', 'review_status', 'created_at', 'last_seen_at'];
  for (const c of required) {
    if (!colNames.includes(c)) {
      db.close();
      throw new Error('[generate-perf-room] missing column on nodes: ' + c + '. Run Plan 109-01 migration first.');
    }
  }

  // Deterministic RNG for reproducible perf rooms.
  let seed = 0x09109109;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xFFFFFFFF;
  };

  const insertNode = db.prepare('INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const insertEdge = db.prepare('INSERT OR IGNORE INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?)');

  db.exec('BEGIN');
  try {
    const baseTime = Date.now() - (90 * 24 * 60 * 60 * 1000);
    const nodeIds = [];
    for (let i = 0; i < targetNodeCount; i++) {
      const type = pickType(rng);
      const id = type + ':perf-' + i.toString().padStart(6, '0');
      nodeIds.push(id);
      const confidence = 0.3 + rng() * 0.6;
      const reviewStatus = ['proposed', 'confirmed', 'validated', 'needs_evidence'][Math.floor(rng() * 4)];
      const createdAt = baseTime + Math.floor(rng() * 90 * 24 * 60 * 60 * 1000);
      insertNode.run(id, type, '{}', 'perf-room/' + id, 'system', confidence, reviewStatus, createdAt, createdAt);
    }

    // 3-5 edges per node; 70% from HIGH_WEIGHT_EDGE_TYPES; 30% from FILL_EDGE_TYPES.
    for (let i = 0; i < targetNodeCount; i++) {
      const sourceId = nodeIds[i];
      const edgeCount = 3 + Math.floor(rng() * 3);
      for (let e = 0; e < edgeCount; e++) {
        const targetIdx = Math.floor(rng() * targetNodeCount);
        if (targetIdx === i) continue;
        const targetId = nodeIds[targetIdx];
        const isHigh = rng() < 0.7;
        const pool = isHigh ? HIGH_WEIGHT_EDGE_TYPES : FILL_EDGE_TYPES;
        const edgeType = pool[Math.floor(rng() * pool.length)];
        insertEdge.run(sourceId, targetId, edgeType, '{}');
      }
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    db.close();
    throw err;
  }

  db.close();
  return { nodeCount: targetNodeCount, dbPath };
}

module.exports = { generatePerfRoom };

// CLI entry: node tests/fixtures/phase-109/generate-perf-room.cjs <count> <dbPath>
if (require.main === module) {
  const count = parseInt(process.argv[2] || '10000', 10);
  const out = process.argv[3] || path.join('/tmp', 'phase-109-perf-' + Date.now() + '.db');
  const result = generatePerfRoom(count, out);
  process.stdout.write(JSON.stringify(result) + '\n');
}
