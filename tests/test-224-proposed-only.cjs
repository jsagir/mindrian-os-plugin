'use strict';
/*
 * Phase 224-03 Task 2 -- phase-wide proposed-only proof (Req 4).
 * =============================================================
 * Proves the ENTIRE Phase-224 derivation surface is proposal-only, end to end:
 *
 *   Test 4: runDerivation driven with a stub deriveFn emitting one CONVERGES and
 *     one INFORMS candidate lands edges rows whose review_status column reads
 *     'proposed' AND claim nodes whose review_status reads 'proposed' (Req 4 at
 *     BOTH layers -- edge column + claim node).
 *   Test 5 (no-confirm sweep): a comment-stripped grep across every phase-224
 *     module finds ZERO confirmNode and ZERO review_status promotion to
 *     'confirmed' in write position -- this phase's code NEVER confirms, with or
 *     without byUser (strictly stronger than the SPEC's no-confirm-without-byUser
 *     wording). The migration header docs (comments) and edges.cjs's own
 *     validation enum are excluded by construction (comments stripped; edges.cjs
 *     is not a phase-224 module in this list).
 *
 * No em-dashes (CLAUDE.md HARD RULE). CJS only.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const { runDerivation } = require(path.join(REPO_ROOT, 'lib', 'core', 'graph-derivation.cjs'));
const { buildFixtureRoom224 } = require(path.join(REPO_ROOT, 'tests', 'helpers', 'fixture-room-224.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));

let pass = 0;
function check(label, cond) {
  assert.ok(cond, label);
  pass += 1;
  console.log('  ok -', label);
}

function stripComments(src) {
  const noBlock = src.replace(/\/\*[\s\S]*?\*\//g, '');
  return noBlock
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');
}

async function main() {
  console.log('test-224-proposed-only (Req 4 proposed-only + no-confirm sweep)');

  // --- Test 4: proposed-only at BOTH layers (edge column + claim node). ---
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'proposed-224-'));
  const fixture = await buildFixtureRoom224(tmp, { artifactCount: 3 });
  const roomDir = fixture.roomDir;

  // A stub producer emitting exactly one CONVERGES and one INFORMS candidate.
  const stubDeriveFn = () => ([
    { source: 'artifact:alpha', target: 'artifact:beta', edge_type: 'CONVERGES', reason: 'stub high band' },
    { source: 'artifact:gamma', target: 'artifact:delta', edge_type: 'INFORMS', reason: 'stub moderate band' },
  ]);

  const res = runDerivation({ roomDir: roomDir, deriveFn: stubDeriveFn, artifactPairs: [{ a: { id: 'x' }, b: { id: 'y' } }] });
  check('runDerivation reported at least two derived edges', res.edges.length >= 2);
  check('runDerivation reported at least two proposed nodes', res.proposedNodes.length >= 2);

  const db = openRoomDb(roomDir);
  try {
    // Edge layer: every derived cascade edge row reads 'proposed'.
    const edgeRows = db.prepare(
      "SELECT review_status FROM edges WHERE type IN ('CONVERGES','INFORMS')"
    ).all();
    check('at least two cascade edge rows exist', edgeRows.length >= 2);
    check("EVERY derived edge row review_status column reads 'proposed'",
      edgeRows.every((r) => r.review_status === 'proposed'));

    // Node layer: every derived claim node reads 'proposed'.
    const nodeIds = res.proposedNodes.map((n) => n.id);
    const placeholders = nodeIds.map(() => '?').join(',');
    const nodeRows = db.prepare(
      'SELECT review_status FROM nodes WHERE id IN (' + placeholders + ')'
    ).all(...nodeIds);
    check('the derived claim nodes are present in the db', nodeRows.length >= 2);
    check("EVERY derived claim node review_status reads 'proposed'",
      nodeRows.every((r) => r.review_status === 'proposed'));
  } finally {
    closeRoomDb(db);
  }

  // --- Test 5: the no-confirm source sweep over every phase-224 module. ---
  const cascadePath = path.join(REPO_ROOT, 'lib', 'core', 'intelligence-cascade.cjs');
  const cascadeSrc = fs.readFileSync(cascadePath, 'utf8');
  // Scope to the Step 2b region (the ONLY phase-224 surface in this file).
  const step2bIdx = cascadeSrc.indexOf('Step 2b');
  assert.ok(step2bIdx !== -1, 'could not locate the Step 2b region in intelligence-cascade.cjs');
  const step2bRegion = cascadeSrc.slice(step2bIdx, step2bIdx + 3000);

  const modules = [
    ['graph-derive-classifier.cjs', fs.readFileSync(path.join(REPO_ROOT, 'lib', 'core', 'graph-derive-classifier.cjs'), 'utf8')],
    ['phase-224-edge-review-status.cjs', fs.readFileSync(path.join(REPO_ROOT, 'lib', 'core', 'migrations', 'phase-224-edge-review-status.cjs'), 'utf8')],
    ['graph-backfill.cjs', fs.readFileSync(path.join(REPO_ROOT, 'lib', 'core', 'graph-backfill.cjs'), 'utf8')],
    ['gsd-graph-derive-drain.cjs', fs.readFileSync(path.join(REPO_ROOT, 'scripts', 'gsd-graph-derive-drain.cjs'), 'utf8')],
    ['gsd-graph-derive-sweep.cjs', fs.readFileSync(path.join(REPO_ROOT, 'scripts', 'gsd-graph-derive-sweep.cjs'), 'utf8')],
    ['intelligence-cascade.cjs (Step 2b region)', step2bRegion],
  ];

  const CONFIRMED_LITERAL = /['"]confirmed['"]/;
  for (const [name, src] of modules) {
    const stripped = stripComments(src);
    check('no confirmNode call in ' + name, stripped.indexOf('confirmNode') === -1);
    check("no 'confirmed' review_status promotion in " + name, !CONFIRMED_LITERAL.test(stripped));
  }

  console.log(`\nPASS (${pass}/${pass})`);
}

main().catch((e) => {
  console.error('FAIL', e && e.stack ? e.stack : e);
  process.exit(1);
});
