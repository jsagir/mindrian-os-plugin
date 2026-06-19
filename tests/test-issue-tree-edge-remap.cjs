'use strict';
// Phase 164 Wave 3 -- issue-tree EDGE REMAP + frozen-vocabulary test (Test 4 from
// the 164-03-PLAN.md behavior block; threat T-164-10).
//
// The navigator-LOCKED edge remap (164-ISSUE-TREE.md section 5) rewrites the
// reference engine's two non-frozen emissions onto frozen members:
//   INVALIDATED                       -> INVALIDATES   (frozen Phase 168)
//   RESOLVES_VIA (root-cause leaf)     -> ROOT_CAUSES   (frozen Phase 150.8)
//   RESOLVES_VIA (opportunity-seed)    -> ENABLES       (frozen Phase 168)
//   BELONGS_TO                         -> PART_OF       (frozen Phase 163)
//   INFORMS                            -> INFORMS       (unchanged)
//
// This suite asserts:
//   - a failed-falsification branch yields INVALIDATES (NOT INVALIDATED).
//   - a confirmed leaf root cause yields ROOT_CAUSES (leaf -> governing problem)
//     AND ENABLES (confirmed cause -> opportunity-bank candidate).
//   - a branch yields PART_OF (NOT BELONGS_TO) to the governing problem.
//   - a child cause yields INFORMS to its parent.
//   - EVERY emitted edge_type is a member of the require()'d ALLOWED_EDGE_TYPES.
//   - the dead/non-frozen strings (INVALIDATED / RESOLVES_VIA / BELONGS_TO) are
//     NEVER emitted.
//   - a live writeEdge round-trip accepts every emitted edge (no chokepoint reject).
//
// NO em-dashes (CLAUDE.md HARD RULE). node:sqlite is used for the live round-trip.

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const IssueTree = require(path.join(REPO_ROOT, 'lib', 'core', 'issue-tree.cjs'));
const { ALLOWED_EDGE_TYPES, writeEdge } = require(
  path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'edges.cjs')
);

let pass = 0;
function check(label, fn) {
  fn();
  pass += 1;
  console.log('  ok -', label);
}

function freshEdgesDb() {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(':memory:');
  db.exec(
    "CREATE TABLE edges (source TEXT NOT NULL, target TEXT NOT NULL, type TEXT NOT NULL, " +
    "properties TEXT DEFAULT '{}', PRIMARY KEY(source, target, type));"
  );
  return db;
}

console.log('test-issue-tree-edge-remap');

// A tree exercising every remapped edge: a confirmed leaf root cause (under a
// parent, so INFORMS fires), an invalidated branch, and structural branches.
const tree = {
  keyQuestion: 'why the activation funnel leaks at step 3',
  branches: [
    {
      label: 'The step-3 form asks for data the user does not yet have',
      branches: [
        { label: 'Tax id requested before signup completes', status: 'confirmed', test: 'remove the field; measure step-3 completion' },
      ],
    },
    {
      label: 'A latency spike abandons the session',
      status: 'invalidated',
      test: 'p95 latency under 800ms across the window; no correlation',
    },
  ],
};

const result = IssueTree.build(tree);
const edges = result.graphEdges;
const types = edges.map(e => e.type);

// ---- frozen-vocabulary assertion (every emitted edge is a frozen member) ----
check('Test 4a: EVERY emitted edge_type is a member of the frozen ALLOWED_EDGE_TYPES', () => {
  for (const e of edges) {
    assert.ok(ALLOWED_EDGE_TYPES.has(e.type), `emitted edge type "${e.type}" is not frozen`);
  }
});

check('Test 4b: the non-frozen reference strings are NEVER emitted', () => {
  for (const dead of ['INVALIDATED', 'RESOLVES_VIA', 'BELONGS_TO']) {
    assert.ok(!types.includes(dead), `dead reference edge type "${dead}" leaked into the output`);
  }
});

// ---- per-remap assertions ---------------------------------------------------
check('Test 4c: a failed-falsification branch yields INVALIDATES (not INVALIDATED)', () => {
  assert.ok(types.includes('INVALIDATES'), 'invalidated branch must emit INVALIDATES');
});

check('Test 4d: a confirmed leaf root cause yields ROOT_CAUSES (leaf -> governing problem)', () => {
  const rc = edges.find(e => e.type === 'ROOT_CAUSES');
  assert.ok(rc, 'confirmed leaf must emit ROOT_CAUSES');
  assert.ok(/^issue:/.test(rc.from), 'ROOT_CAUSES source is the leaf node');
  assert.equal(rc.to, 'problem-definition:governing', 'ROOT_CAUSES target is the governing problem');
});

check('Test 4e: a confirmed leaf root cause ALSO yields ENABLES (cause -> opportunity-bank candidate)', () => {
  const en = edges.find(e => e.type === 'ENABLES');
  assert.ok(en, 'confirmed leaf must emit ENABLES');
  assert.ok(/^issue:/.test(en.from), 'ENABLES source is the confirmed cause');
  assert.ok(/^opportunity:/.test(en.to), 'ENABLES target is an opportunity-bank candidate');
});

check('Test 4f: a branch yields PART_OF (not BELONGS_TO) to the governing problem', () => {
  const po = edges.filter(e => e.type === 'PART_OF');
  assert.ok(po.length >= 1, 'branches must emit PART_OF to the governing problem');
  assert.ok(po.every(e => e.to === 'problem-definition:governing'), 'PART_OF targets the governing problem');
});

check('Test 4g: a child cause yields INFORMS to its parent', () => {
  const inf = edges.find(e => e.type === 'INFORMS');
  assert.ok(inf, 'a sub-cause must emit INFORMS to its parent');
  assert.ok(/^issue:/.test(inf.from) && /^issue:/.test(inf.to), 'INFORMS runs child-cause -> parent-cause');
});

// ---- live writeEdge round-trip (the chokepoint accepts every emitted edge) --
check('Test 4h: every emitted edge survives a live navigation.writeEdge round-trip', () => {
  const db = freshEdgesDb();
  for (const e of edges) {
    const res = writeEdge(db, { source_id: e.from, target_id: e.to, edge_type: e.type, properties: { relation: 'issue_tree' } });
    assert.ok(res && res.ok, `writeEdge rejected a remapped edge "${e.type}": ${JSON.stringify(res)}`);
  }
  const count = db.prepare('SELECT COUNT(*) AS n FROM edges').get().n;
  assert.equal(count, edges.length, 'every emitted edge landed in the edges table via the chokepoint');
});

// ---- module-load self-check (every emittable type is frozen) ----------------
check('Test 4i: every EDGE_TYPES value the engine can emit is a frozen member (self-check parity)', () => {
  for (const t of Object.values(IssueTree.EDGE_TYPES)) {
    assert.ok(ALLOWED_EDGE_TYPES.has(t), `engine emittable type "${t}" must be frozen`);
  }
});

console.log(`\ntest-issue-tree-edge-remap: ${pass} checks passed`);
