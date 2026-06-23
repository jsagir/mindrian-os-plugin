'use strict';
// Phase 172-11 -- the scale-invariant fractal coverage rollup + the
// projection-level coverage/chain-health monitor (CIRS R11 / INV-16 + INV-09).
//
// Task 1 (rollupCoverage): ONE scale-invariant operator over NESTED_WITHIN,
//   depth-3 capped, aggregate-SCALAR-only across room boundaries (Canon Part 11
//   R11 / Appendix D entry 23). It reads each room's LOCAL coverage scalars and
//   walks UP the NESTED_WITHIN lineage, normalizing by subtree size. It reads
//   child coverage SCALARS, NEVER child lineage edges across room.db boundaries.
//
// Task 2 (monitorCoverage): projection-level health report
//   {unwired, unranked, stale, command_gaps, chain_reachability} read from the
//   LOCAL orchestration projection (zero Brain / network; Part 8 / INV-09 / INV-12).
//
// No em-dashes (CLAUDE.md HARD RULE). Pure Node, no package installs.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const { writeEdge } = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'edges.cjs'));
const { rollupCoverage, DEPTH_CAP } = require(path.join(REPO_ROOT, 'lib', 'core', 'coverage-rollup.cjs'));
const { monitorCoverage } = require(path.join(REPO_ROOT, 'lib', 'core', 'coverage-monitor.cjs'));

let pass = 0;
function check(label, fn) { fn(); pass += 1; console.log('  ok -', label); }

// ---------------------------------------------------------------------------
// Fixture: a 4-level nested-room topology root -> a -> b -> c, each level a
// child subdirectory carrying its own room.db + .room-root sentinel + a
// NESTED_WITHIN lineage edge UP to its parent, and a LOCAL coverage scalar file
// (.mindrian/coverage.json) recording wired/excluded/gap counts. The rollup must
// read those scalars, walk the NESTED_WITHIN children down to DEPTH_CAP, and stop.
// ---------------------------------------------------------------------------
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'covroll-172-'));
const root = path.join(tmp, 'root');
const a = path.join(root, 'a');
const b = path.join(a, 'b');
const c = path.join(b, 'c'); // 4th level beyond root (depth 3 from root)
fs.mkdirSync(c, { recursive: true });

function seedRoom(dir, slug, parentSlug, counts) {
  fs.writeFileSync(
    path.join(dir, '.room-root'),
    JSON.stringify(parentSlug ? { slug, parent: parentSlug } : { slug })
  );
  // The LOCAL per-room coverage scalar source (Part 8: counts only, no content).
  const mindrianDir = path.join(dir, '.mindrian');
  fs.mkdirSync(mindrianDir, { recursive: true });
  fs.writeFileSync(path.join(mindrianDir, 'coverage.json'), JSON.stringify({ counts }));
}

// root carries the parent-side NESTED_WITHIN child link to a (source room:a -> target room:root).
seedRoom(root, 'root', null, { wired: 4, excluded: 1, gap: 1 });
seedRoom(a, 'a', 'root', { wired: 2, excluded: 0, gap: 2 });
seedRoom(b, 'b', 'a', { wired: 1, excluded: 0, gap: 1 });
seedRoom(c, 'c', 'b', { wired: 5, excluded: 0, gap: 0 });

// Lineage edges: each PARENT db records its direct child link (source room:<child> -> room:<parent>).
const rootDb = openRoomDb(root);
writeEdge(rootDb, { source_id: 'room:a', target_id: 'room:root', edge_type: 'NESTED_WITHIN', properties: { relation: 'nested', parent: 'root' } });
closeRoomDb(rootDb);

const aDb = openRoomDb(a);
writeEdge(aDb, { source_id: 'room:b', target_id: 'room:a', edge_type: 'NESTED_WITHIN', properties: { relation: 'nested', parent: 'a' } });
// A non-lineage LOCAL edge that MUST NOT cross the room boundary into the parent rollup.
writeEdge(aDb, { source_id: 'artifact:a-secret', target_id: 'section:a-x', edge_type: 'INFORMS', properties: { relation: 'informs' } });
closeRoomDb(aDb);

const bDb = openRoomDb(b);
writeEdge(bDb, { source_id: 'room:c', target_id: 'room:b', edge_type: 'NESTED_WITHIN', properties: { relation: 'nested', parent: 'b' } });
writeEdge(bDb, { source_id: 'artifact:b-secret', target_id: 'section:b-x', edge_type: 'INFORMS', properties: { relation: 'informs' } });
closeRoomDb(bDb);

const cDb = openRoomDb(c);
writeEdge(cDb, { source_id: 'artifact:c-secret', target_id: 'section:c-x', edge_type: 'INFORMS', properties: { relation: 'informs' } });
closeRoomDb(cDb);

console.log('test-coverage-rollup (CIRS R11 / INV-16 + INV-09)');

// --- Task 1: rollupCoverage ---

check('DEPTH_CAP is the frozen depth-3 constant (SEED-022 memory contract)', () => {
  assert.equal(DEPTH_CAP, 3, 'the rollup recursion cap is the frozen constant 3');
});

check('Test 1: rollupCoverage(room) returns an aggregate summary normalized by subtree size', () => {
  const res = rollupCoverage(root);
  assert.ok(res && typeof res === 'object', 'rollupCoverage must return an object');
  assert.ok(res.aggregate && typeof res.aggregate === 'object', 'must carry an aggregate scalar block');
  const { wired, excluded, gap, total } = res.aggregate;
  // root(6) + a(4) + b(2) + c(5) = 17 surfaces across the depth-3 subtree.
  assert.equal(total, 17, 'aggregate total is the sum of subtree coverage scalars');
  assert.equal(wired, 4 + 2 + 1 + 5, 'aggregate wired is the subtree sum');
  assert.equal(excluded, 1 + 0 + 0 + 0, 'aggregate excluded is the subtree sum');
  assert.equal(gap, 1 + 2 + 1 + 0, 'aggregate gap is the subtree sum');
  assert.equal(typeof res.subtree_size, 'number', 'subtree_size (number of rooms aggregated) is reported');
  assert.equal(res.subtree_size, 4, 'root + 3 descendants within the depth cap');
  // normalized coverage ratio in [0,1].
  assert.ok(res.coverage_ratio >= 0 && res.coverage_ratio <= 1, 'coverage_ratio normalized to [0,1]');
});

check('Test 2: the rollup walks UP NESTED_WITHIN to depth 3 and STOPS (4th-level ancestor not walked)', () => {
  // From root, depth-3 reaches root(0) -> a(1) -> b(2) -> c(3). A hypothetical
  // 5th level beyond c would NOT be aggregated. Build one and prove it is excluded.
  const d = path.join(c, 'd');
  fs.mkdirSync(d, { recursive: true });
  seedRoom(d, 'd', 'c', { wired: 99, excluded: 0, gap: 0 });
  const cDb2 = openRoomDb(c);
  writeEdge(cDb2, { source_id: 'room:d', target_id: 'room:c', edge_type: 'NESTED_WITHIN', properties: { relation: 'nested', parent: 'c' } });
  closeRoomDb(cDb2);

  const res = rollupCoverage(root);
  // d's wired:99 must NOT leak in -- depth-3 cap stops at c.
  assert.equal(res.aggregate.wired, 4 + 2 + 1 + 5, 'depth-4 room (d) is beyond the depth-3 cap and is not aggregated');
  assert.equal(res.subtree_size, 4, 'still only 4 rooms (root,a,b,c); d excluded by the cap');
  assert.ok(res.depth_capped === true || res.depth_cap === DEPTH_CAP, 'rollup reports the depth cap');
});

check('Test 3: across a room boundary only aggregate SCALARS travel (no child lineage edge is read)', () => {
  const res = rollupCoverage(root);
  // The whole serialized rollup must carry NONE of the child LOCAL lineage edge
  // bytes (entry 23: cross-room aggregation of NESTED_WITHIN / child edges is forbidden).
  const blob = JSON.stringify(res);
  assert.ok(!blob.includes('a-secret'), 'child INFORMS edge content must not cross the room boundary');
  assert.ok(!blob.includes('b-secret'), 'grandchild edge content must not cross the boundary');
  assert.ok(!blob.includes('c-secret'), 'great-grandchild edge content must not cross the boundary');
  assert.ok(!blob.includes('INFORMS'), 'no child lineage edge type travels; scalars only');
  // It MUST carry the scalar aggregate.
  assert.ok(typeof res.aggregate.total === 'number', 'only scalar aggregates travel across the boundary');
});

check('Test 4: the operator is scale-invariant (same function applies at every level)', () => {
  const atRoot = rollupCoverage(root);
  const atA = rollupCoverage(a);
  const atB = rollupCoverage(b);
  const atC = rollupCoverage(c);
  // Same shape at every level.
  for (const r of [atRoot, atA, atB, atC]) {
    assert.ok(r.aggregate && typeof r.aggregate.total === 'number', 'same aggregate shape at every level');
    assert.equal(typeof r.subtree_size, 'number', 'same subtree_size field at every level');
    assert.ok(r.coverage_ratio >= 0 && r.coverage_ratio <= 1, 'same normalized ratio at every level');
  }
  // A leaf room rolls up only itself.
  assert.equal(atC.aggregate.total, 5, 'a leaf room (c) aggregates only its own 5 surfaces');
  assert.equal(atC.subtree_size, 1, 'a leaf room has subtree_size 1');
  // c reached from b includes c only (b->c is one hop; d is beyond b at depth 2 -> ok, but
  // b's subtree b(2)+c(5)... plus d would be depth-2 from b). atB stays within b's own cap.
  assert.ok(atB.subtree_size >= 2, 'b aggregates itself + its descendants within b cap');
});

// --- Task 2: monitorCoverage ---

const projection = require(path.join(REPO_ROOT, 'data', 'brain-orchestration-projection.json'));

check('Test 1: monitorCoverage(projection) returns a health report with the five categories', () => {
  const r = monitorCoverage(projection);
  assert.ok(r && typeof r === 'object', 'monitorCoverage returns a report object');
  for (const key of ['unwired', 'unranked', 'stale', 'command_gaps', 'chain_reachability']) {
    assert.ok(key in r, 'report carries category: ' + key);
  }
  assert.ok(Array.isArray(r.unwired), 'unwired is an array');
  assert.ok(Array.isArray(r.unranked), 'unranked is an array');
  assert.ok(Array.isArray(r.stale), 'stale is an array');
  assert.ok(Array.isArray(r.command_gaps), 'command_gaps is an array');
  assert.ok(r.chain_reachability && typeof r.chain_reachability === 'object', 'chain_reachability is a report block');
});

check('Test 2: chain_reachability flags a FEEDS_INTO chain whose target framework is absent/unreachable', () => {
  // Synthesize a projection with a dangling FEEDS_INTO (target node not present).
  const synthetic = {
    nodes: [
      { id: 'framework:Source', kind: 'framework', methodology_tier: 'pws', name: 'Source' },
    ],
    edges: [
      { type: 'FEEDS_INTO', from: 'framework:Source', to: 'framework:GhostTarget' },
    ],
  };
  const r = monitorCoverage(synthetic);
  assert.ok(r.chain_reachability.unreachable.length >= 1, 'a dangling FEEDS_INTO target is flagged unreachable');
  const flagged = JSON.stringify(r.chain_reachability.unreachable);
  assert.ok(flagged.includes('GhostTarget'), 'the unreachable target is named in the flag');

  // A well-formed chain (both endpoints present) is NOT flagged.
  const ok = {
    nodes: [
      { id: 'framework:Source', kind: 'framework', methodology_tier: 'pws', name: 'Source' },
      { id: 'framework:Target', kind: 'framework', methodology_tier: 'pws', name: 'Target' },
    ],
    edges: [{ type: 'FEEDS_INTO', from: 'framework:Source', to: 'framework:Target' }],
  };
  const r2 = monitorCoverage(ok);
  assert.equal(r2.chain_reachability.unreachable.length, 0, 'a reachable chain is not flagged');
});

check('Test 3: the monitor reads only the LOCAL projection (zero Brain/network)', () => {
  // Static source scan: the monitor module carries no Brain-host / raw-fetch egress.
  const src = fs.readFileSync(path.join(REPO_ROOT, 'lib', 'core', 'coverage-monitor.cjs'), 'utf8');
  assert.ok(!/mindrian-brain|brain\.mindrian|brain-client|brainClient/.test(src), 'no Brain-host token in the monitor');
  assert.ok(!/mcp__brain_(write|store|upsert|ingest|query|search|ask|schema|stats)/.test(src), 'no Brain MCP call in the monitor');
  // No raw network transport.
  assert.ok(!/[^a-zA-Z_.]fetch\s*\(/.test(src.replace(/\/\/.*$/gm, '')), 'no raw fetch( in the monitor');
  assert.ok(!/require\(['"]node:https?['"]\)|require\(['"]https?['"]\)/.test(src), 'no http/https require in the monitor');
});

check('Test 4: the report carries only generic machinery shape (counts + names), never user content', () => {
  const r = monitorCoverage(projection);
  // The report is fully serializable and carries only the projection node names
  // (framework/command/reach names) + counts -- generic machinery metadata.
  const blob = JSON.stringify(r);
  // counts present.
  assert.equal(typeof r.counts.unwired, 'number', 'report exposes scalar counts');
  assert.equal(typeof r.counts.unranked, 'number', 'report exposes scalar counts');
  assert.equal(typeof r.counts.command_gaps, 'number', 'report exposes scalar counts');
  // No room.db / user-content markers (the monitor never touches a room.db).
  assert.ok(!/room\.db|\.mindrian\/coverage|artifact:|meeting:|assumption:/.test(blob), 'no user-room content in the report');
});

console.log(`\nPASS (${pass}/12)`);
