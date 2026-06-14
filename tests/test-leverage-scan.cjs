'use strict';
// Phase 150.10-04 Task 3 (RED-first) -- the local leverage-point scanner test.
//
// Asserts lib/core/leverage-scan.cjs scanLeveragePoints(db) runs the 12 Meadows
// signature queries over a scratch room.db fixture and returns candidates tagged
// with their Meadows level, RANKED lower-Meadows-number-first (highest leverage
// first). The fixture carries a KNOWN structure:
//   - an assumption node            -> level 5 (Rules)
//   - a CONVERGES cycle             -> level 7 (Reinforcing loops)
//   - a high-degree hub             -> level 10 (Stock-and-flow structure)
//   - a leaf scalar claim           -> level 12 (Parameters)
//   - a root governing_thought node -> level 3 (Goals)
//   - a REVERSE_SALIENT edge (rs-engine, signed_diff) -> level 6-8 band (ST-17)
//
// The scanner reads room.db ONLY via lib/core/navigation.cjs (no direct sqlite
// open, no fs scan). This test seeds the fixture via lib/core/room-db.cjs
// openRoomDb (tests/ is on the navigation substrate allow-list); the SCANNER
// under test must NOT do that.
//
// Part 8 floor (asserted by the run-all leg + here): the scanner module carries
// zero network surface. No emoji. No em-dashes (hyphens only).

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { openRoomDb, closeRoomDb } = require('../lib/core/room-db.cjs');

let passed = 0;
function check(label, fn) {
  fn();
  passed += 1;
  console.log('  ok - ' + label);
}

// --- Build a scratch room fixture ------------------------------------------
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'leverage-scan-'));
const roomDir = path.join(tmpRoot, 'room');
fs.mkdirSync(roomDir, { recursive: true });

const NOW = Date.now();
let db = openRoomDb(roomDir);

function insertNode(id, type, props) {
  db.prepare(
    'INSERT INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at, source_section) ' +
    "VALUES (?, ?, ?, ?, 'system', 1.0, 'proposed', ?, ?, ?)"
  ).run(id, type, JSON.stringify(props || {}), 'fixture:' + id, NOW, NOW, 'problem-definition');
}
function insertEdge(source, target, type, props) {
  db.prepare(
    'INSERT INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?) ' +
    'ON CONFLICT(source, target, type) DO UPDATE SET properties = excluded.properties'
  ).run(source, target, type, JSON.stringify(props || {}));
}

// Level 3 (Goals): the governing-thought / objective node.
insertNode('gt-root', 'governing_thought', { label: 'Reduce time-to-validated-decision' });

// Level 5 (Rules): an assumption node (the assumption registry).
insertNode('assume-pricing', 'assumption', { label: 'Customers will pay $50/mo' });

// Level 12 (Parameters): a leaf scalar claim with numeric evidence, no outgoing edges.
insertNode('claim-leaf-scalar', 'claim', { label: 'Churn is 4.2 percent', scalar: 4.2 });

// Level 10 (Stock-and-flow / hub): a high (in+out) degree structural hub.
insertNode('hub', 'claim', { label: 'Acquisition funnel' });
insertNode('spoke-a', 'claim', { label: 'Top of funnel' });
insertNode('spoke-b', 'claim', { label: 'Mid funnel' });
insertNode('spoke-c', 'claim', { label: 'Bottom of funnel' });
insertNode('spoke-d', 'claim', { label: 'Retention' });
insertEdge('hub', 'spoke-a', 'INFORMS', {});
insertEdge('hub', 'spoke-b', 'INFORMS', {});
insertEdge('spoke-c', 'hub', 'INFORMS', {});
insertEdge('spoke-d', 'hub', 'ENABLES', {});

// Level 7 (Reinforcing loop): a CONVERGES cycle.
insertNode('loop-x', 'claim', { label: 'More users' });
insertNode('loop-y', 'claim', { label: 'More referrals' });
insertEdge('loop-x', 'loop-y', 'CONVERGES', {});
insertEdge('loop-y', 'loop-x', 'CONVERGES', {});

// Level 6-8 band (ST-17): a REVERSE_SALIENT edge from the rs-engine carrying signed_diff.
insertNode('rs-node-1', 'claim', { label: 'Onboarding flow' });
insertNode('rs-node-2', 'claim', { label: 'Support backlog' });
insertEdge('rs-node-1', 'rs-node-2', 'REVERSE_SALIENT', {
  source: 'rs-engine',
  signed_diff: -0.41,
  abs_diff: 0.41,
  direction: 'semantic_implementation',
});

closeRoomDb(db);

// --- Load the scanner (RED: module does not exist yet) ----------------------
const leverageScan = require('../lib/core/leverage-scan.cjs');

// Re-open via the navigation chokepoint exactly as a real caller would.
const navigation = require('../lib/core/navigation.cjs');
db = navigation.openRoomDbForCaller(roomDir);
assert.ok(db, 'fixture room.db should open via navigation.openRoomDbForCaller');

let candidates;
try {
  check('scanLeveragePoints is exported as a function', () => {
    assert.strictEqual(typeof leverageScan.scanLeveragePoints, 'function');
  });

  candidates = leverageScan.scanLeveragePoints(db);

  check('returns a non-empty array of candidates', () => {
    assert.ok(Array.isArray(candidates), 'candidates must be an array');
    assert.ok(candidates.length > 0, 'expected at least one candidate');
  });

  check('every candidate carries nodeId, meadows_level, signature, score', () => {
    for (const c of candidates) {
      assert.ok(typeof c.nodeId === 'string' && c.nodeId.length > 0, 'nodeId');
      assert.ok(Number.isInteger(c.meadows_level), 'meadows_level integer');
      assert.ok(c.meadows_level >= 1 && c.meadows_level <= 12, 'meadows_level in 1..12');
      assert.ok(typeof c.signature === 'string' && c.signature.length > 0, 'signature');
      assert.ok(typeof c.score === 'number', 'score');
    }
  });

  check('candidates are RANKED lower-Meadows-number-first (highest leverage first)', () => {
    for (let i = 1; i < candidates.length; i++) {
      assert.ok(
        candidates[i - 1].meadows_level <= candidates[i].meadows_level,
        'expected non-decreasing meadows_level; got ' +
          candidates[i - 1].meadows_level + ' then ' + candidates[i].meadows_level
      );
    }
  });

  check('the assumption node is flagged as a level-5 (Rules) candidate', () => {
    const hit = candidates.find((c) => c.nodeId === 'assume-pricing');
    assert.ok(hit, 'assumption node should be a candidate');
    assert.strictEqual(hit.meadows_level, 5, 'assumption -> Meadows level 5 (Rules)');
  });

  check('the CONVERGES cycle is flagged as a level-7 (Reinforcing loop) candidate', () => {
    const hit = candidates.find(
      (c) => c.meadows_level === 7 && (c.nodeId === 'loop-x' || c.nodeId === 'loop-y')
    );
    assert.ok(hit, 'a CONVERGES-cycle node should be a level-7 candidate');
  });

  check('the leaf scalar claim is flagged as a level-12 (Parameters) candidate', () => {
    const hit = candidates.find((c) => c.nodeId === 'claim-leaf-scalar');
    assert.ok(hit, 'leaf scalar claim should be a candidate');
    assert.strictEqual(hit.meadows_level, 12, 'leaf scalar -> Meadows level 12 (Parameters)');
  });

  check('the governing_thought is flagged as a level-3 (Goals) candidate', () => {
    const hit = candidates.find((c) => c.nodeId === 'gt-root');
    assert.ok(hit, 'governing_thought should be a candidate');
    assert.strictEqual(hit.meadows_level, 3, 'governing_thought -> Meadows level 3 (Goals)');
  });

  check('the rs-engine REVERSE_SALIENT node is flagged in the level 6-8 band (ST-17)', () => {
    const hit = candidates.find(
      (c) => (c.nodeId === 'rs-node-1' || c.nodeId === 'rs-node-2') &&
        c.meadows_level >= 6 && c.meadows_level <= 8
    );
    assert.ok(hit, 'a REVERSE_SALIENT node should land in the 6-8 leverage band');
  });
} finally {
  navigation.closeRoomDbForCaller(db);
  try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
}

console.log('\nleverage-scan: ' + passed + ' checks passed');
