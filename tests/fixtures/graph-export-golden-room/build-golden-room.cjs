'use strict';
// SEED-026 W3 (Phase 162-03 Task 2): programmatic builder for the committed
// graph-export golden-room fixture.
//
// Builds tests/fixtures/graph-export-golden-room/.mindrian/room.db deterministically
// via the SAME lazygraph-ops openGraph + INSERT idiom the existing fixture tests
// use (tests/test-graph-export.cjs seedDb) -- NOT hand-crafted raw SQLite. The
// fixture seeds:
//   - one node of EVERY type in NODE_TYPE_RENDER (claim is seeded once per
//     knowledge_type so the color map is exercised), and
//   - one node of EVERY type in EXCLUDE_TYPES (the bookkeeping set), and
//   - a representative set of typed edges between the included nodes
//     (every edge has BOTH endpoints in the included node set, so there are
//     zero dropped edges in the golden snapshot).
//
// The export over this fixture MUST return unmapped_types === [] -- that is the
// completeness invariant the golden-room test and the type-map gate assert.
//
// Run to (re)generate the committed fixture:
//   node tests/fixtures/graph-export-golden-room/build-golden-room.cjs
//
// The test (tests/test-graph-export-golden-room.cjs) reads the committed db
// READ-ONLY and exports the seed set so the snapshot numbers stay in lockstep
// with this builder. Canon Part 8: LOCAL only, no Brain. No em-dashes.

const fs = require('fs');
const path = require('path');

const lgOps = require('../../../lib/core/lazygraph-ops.cjs');
const { NODE_TYPE_RENDER, EXCLUDE_TYPES } = require('../../../lib/core/navigation/graph-export.cjs');

const FIXTURE_DIR = __dirname;
const DB_PATH = path.join(FIXTURE_DIR, '.mindrian', 'room.db');

// The included (knowledge) nodes: one per NODE_TYPE_RENDER type. For `claim`,
// seed one node per knowledge_type so the KNOWLEDGE_TYPE_COLOR map is exercised.
// Order is deterministic so counts are stable.
const CLAIM_KNOWLEDGE_TYPES = ['fact', 'mental_model', 'causal', 'assumption', 'anomaly_cue', 'heuristic'];

function buildIncludedNodes() {
  const nodes = [];
  // claim x each knowledge_type
  for (const kt of CLAIM_KNOWLEDGE_TYPES) {
    nodes.push({ id: 'claim:' + kt, type: 'claim', properties: { knowledge_type: kt, title: 'Claim (' + kt + ')' } });
  }
  // one node per remaining NODE_TYPE_RENDER type (claim already covered above)
  for (const t of Object.keys(NODE_TYPE_RENDER)) {
    if (t === 'claim') continue;
    nodes.push({ id: t.toLowerCase() + ':1', type: t, properties: { title: t + ' node' } });
  }
  return nodes;
}

// One node per EXCLUDE_TYPES bookkeeping type (counted in meta.excluded, never
// rendered). Deterministic order.
function buildExcludedNodes() {
  return Array.from(EXCLUDE_TYPES).map((t) => ({
    id: t + ':bk',
    type: t,
    properties: { note: 'bookkeeping' },
  }));
}

// Representative typed edges, BOTH endpoints in the included set (zero dropped).
function buildEdges() {
  return [
    { source: 'governing_thought:1', target: 'claim:fact', type: 'STATES' },
    { source: 'claim:fact', target: 'claim:mental_model', type: 'INFORMS' },
    { source: 'evidenceclaim:1', target: 'claim:fact', type: 'SUPPORTS' },
    { source: 'causalclaim:1', target: 'claim:causal', type: 'ROOT_CAUSES' },
    { source: 'claim:mental_model', target: 'claim:assumption', type: 'REFINES' },
    { source: 'decision:1', target: 'opportunity:1', type: 'ENABLES' },
    { source: 'claim:fact', target: 'section:1', type: 'BELONGS_TO' },
    { source: 'rsdiscovery:1', target: 'claim:anomaly_cue', type: 'REVERSE_SALIENT' },
    { source: 'breakthrough:1', target: 'claim:heuristic', type: 'INSTANTIATES' },
    { source: 'concept:1', target: 'claim:fact', type: 'DESCRIBES' },
  ];
}

async function build() {
  // Start clean so the fixture is byte-deterministic across regenerations.
  if (fs.existsSync(path.join(FIXTURE_DIR, '.mindrian'))) {
    fs.rmSync(path.join(FIXTURE_DIR, '.mindrian'), { recursive: true, force: true });
  }
  const { db, conn } = await lgOps.openGraph(FIXTURE_DIR);

  const included = buildIncludedNodes();
  const excluded = buildExcludedNodes();
  // Insert all nodes (FK is ON, so nodes before edges).
  for (const n of included.concat(excluded)) {
    conn.prepare('INSERT INTO nodes (id, type, properties) VALUES (?, ?, ?)')
      .run(n.id, n.type, JSON.stringify(n.properties || {}));
  }
  for (const e of buildEdges()) {
    conn.prepare('INSERT INTO edges (source, target, type) VALUES (?, ?, ?)').run(e.source, e.target, e.type);
  }
  await lgOps.closeGraph(db);
  return { includedCount: included.length, excludedCount: excluded.length, edgeCount: buildEdges().length };
}

module.exports = {
  DB_PATH,
  FIXTURE_DIR,
  buildIncludedNodes,
  buildExcludedNodes,
  buildEdges,
  build,
};

if (require.main === module) {
  build().then((c) => {
    process.stdout.write('built golden-room fixture at ' + DB_PATH + ': '
      + c.includedCount + ' included nodes, ' + c.excludedCount + ' excluded nodes, '
      + c.edgeCount + ' edges\n');
    process.exit(0);
  }).catch((err) => {
    process.stderr.write('build-golden-room FAILED: ' + (err && err.message ? err.message : err) + '\n');
    process.exit(1);
  });
}
