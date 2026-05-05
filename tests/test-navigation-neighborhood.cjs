'use strict';
// Phase 109-04 test: getNeighborhood recursive CTE correctness. NAV-109-02.

const { ok, equal, deepEqual } = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');
const { openRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));

function makeRoom() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-109-neigh-'));
  fs.mkdirSync(path.join(tmp, '.mindrian'), { recursive: true });
  const db = openRoomDb(tmp);
  const nowMs = Date.now();
  const insN = db.prepare("INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at, source_section) VALUES (?, ?, '{}', ?, 'user', ?, 'confirmed', ?, ?, ?)");
  // Focus + 3 neighbors at depth 1 + 1 neighbor at depth 2 + isolated node + cycle pair.
  const seeds = [
    ['focus:001', 'decision', 'fixture/focus.md', 0.8, 'design'],
    ['claim:contra', 'claim', 'fixture/contra.md', 0.6, 'design'],
    ['claim:supp', 'claim', 'fixture/supp.md', 0.6, 'design'],
    ['claim:info', 'claim', 'fixture/info.md', 0.5, 'other-section'],
    ['evidence:e1', 'evidence', 'fixture/e1.md', 0.9, 'design'],
    ['claim:isolated', 'claim', 'fixture/iso.md', 0.5, 'other-section'],
    ['claim:cycle-a', 'claim', 'fixture/ca.md', 0.5, 'design'],
    ['claim:cycle-b', 'claim', 'fixture/cb.md', 0.5, 'design'],
  ];
  for (const s of seeds) insN.run(s[0], s[1], s[2], s[3], nowMs, nowMs, s[4]);
  const insE = db.prepare("INSERT OR IGNORE INTO edges (source, target, type, properties) VALUES (?, ?, ?, '{}')");
  // Depth 1 from focus.
  insE.run('focus:001', 'claim:contra', 'CONTRADICTS');
  insE.run('focus:001', 'claim:supp', 'SUPPORTS');
  insE.run('focus:001', 'claim:info', 'INFORMS');
  // Depth 2 (claim:supp -> evidence:e1).
  insE.run('claim:supp', 'evidence:e1', 'SUPPORTS');
  // Cycle pair.
  insE.run('claim:cycle-a', 'claim:cycle-b', 'INFORMS');
  insE.run('claim:cycle-b', 'claim:cycle-a', 'INFORMS');
  return { tmp, db };
}

function makeIsolatedRoom() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-109-neigh-iso-'));
  fs.mkdirSync(path.join(tmp, '.mindrian'), { recursive: true });
  const db = openRoomDb(tmp);
  const nowMs = Date.now();
  db.prepare("INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at) VALUES (?, ?, '{}', ?, 'user', ?, 'confirmed', ?, ?)")
    .run('lonely:001', 'claim', 'fixture/lonely.md', 0.5, nowMs, nowMs);
  return { tmp, db };
}

function cleanup(tmp) {
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* ignore */ }
}

function test1_emptyCase() {
  const { tmp, db } = makeIsolatedRoom();
  try {
    const r = navigation.getNeighborhood(db, 'lonely:001');
    deepEqual(r, [], 'no neighbors returns []');
    // Unknown node also returns [].
    deepEqual(navigation.getNeighborhood(db, 'does:not:exist'), []);
    db.close();
  } finally { cleanup(tmp); }
}

function test2_depth1() {
  const { tmp, db } = makeRoom();
  try {
    const r = navigation.getNeighborhood(db, 'focus:001', { maxDepth: 1, topK: 50 });
    const ids = r.map((n) => n.id).sort();
    deepEqual(ids, ['claim:contra', 'claim:info', 'claim:supp']);
    for (const n of r) equal(n.depth, 1);
    db.close();
  } finally { cleanup(tmp); }
}

function test3_depth2() {
  const { tmp, db } = makeRoom();
  try {
    const r = navigation.getNeighborhood(db, 'focus:001', { maxDepth: 2, topK: 50 });
    const ids = r.map((n) => n.id);
    ok(ids.includes('evidence:e1'), 'depth-2 neighbor included');
    const e1 = r.find((n) => n.id === 'evidence:e1');
    equal(e1.depth, 2);
    db.close();
  } finally { cleanup(tmp); }
}

function test4_edgeWeightRanking() {
  const { tmp, db } = makeRoom();
  try {
    const r = navigation.getNeighborhood(db, 'focus:001', { maxDepth: 1, topK: 10 });
    // CONTRADICTS (1.0) outranks SUPPORTS (0.8) outranks INFORMS (0.6) at same depth + same recency + same confidence.
    const idsByScore = r.map((n) => n.id);
    const contraIdx = idsByScore.indexOf('claim:contra');
    const suppIdx = idsByScore.indexOf('claim:supp');
    const infoIdx = idsByScore.indexOf('claim:info');
    ok(contraIdx < suppIdx, 'CONTRADICTS ranks before SUPPORTS');
    ok(suppIdx < infoIdx, 'SUPPORTS ranks before INFORMS');
    db.close();
  } finally { cleanup(tmp); }
}

function test5_cycleGuard() {
  const { tmp, db } = makeRoom();
  try {
    // Run with depth 5; the cycle-a/cycle-b pair must not produce infinite results.
    const r = navigation.getNeighborhood(db, 'claim:cycle-a', { maxDepth: 5, topK: 100 });
    // With depth 5 and a 2-cycle, expect only cycle-b (and re-walks bounded by cycle guard).
    const cycleCount = r.filter((n) => n.id === 'claim:cycle-a' || n.id === 'claim:cycle-b').length;
    ok(cycleCount <= 6, 'cycle guard bounds re-walks; got ' + cycleCount + ' cycle entries');
    db.close();
  } finally { cleanup(tmp); }
}

function test6_focusExcluded() {
  const { tmp, db } = makeRoom();
  try {
    const r = navigation.getNeighborhood(db, 'focus:001', { maxDepth: 2, topK: 50 });
    ok(!r.some((n) => n.id === 'focus:001'), 'focus node excluded from results');
    db.close();
  } finally { cleanup(tmp); }
}

function test7_edgePathParsed() {
  const { tmp, db } = makeRoom();
  try {
    const r = navigation.getNeighborhood(db, 'focus:001', { maxDepth: 2, topK: 10 });
    for (const n of r) {
      ok(Array.isArray(n.edgePath), 'edgePath is array for ' + n.id);
      for (const id of n.edgePath) ok(typeof id === 'string', 'edgePath entry is string');
    }
    db.close();
  } finally { cleanup(tmp); }
}

function test8_provenanceFields() {
  const { tmp, db } = makeRoom();
  try {
    const r = navigation.getNeighborhood(db, 'focus:001', { maxDepth: 1, topK: 10 });
    for (const n of r) {
      ok(typeof n.sourcePath === 'string', 'sourcePath set: ' + n.id);
      ok(['proposed', 'confirmed', 'rejected', 'stale', 'superseded', 'needs_evidence', 'validated', 'invalidated'].includes(n.reviewStatus));
      ok(['user', 'larry', 'import', 'brain', 'system'].includes(n.createdBy));
      ok(n.confidence === null || (typeof n.confidence === 'number' && n.confidence >= 0 && n.confidence <= 1));
      ok(typeof n.lastSeenAt === 'number');
    }
    db.close();
  } finally { cleanup(tmp); }
}

function run() {
  const tests = [test1_emptyCase, test2_depth1, test3_depth2, test4_edgeWeightRanking, test5_cycleGuard, test6_focusExcluded, test7_edgePathParsed, test8_provenanceFields];
  let pass = 0; let fail = 0;
  for (const t of tests) {
    try { t(); pass++; process.stdout.write('PASS ' + t.name + '\n'); }
    catch (err) { fail++; process.stderr.write('FAIL ' + t.name + ': ' + err.message + '\n' + err.stack + '\n'); }
  }
  process.stdout.write('test-navigation-neighborhood: ' + pass + '/' + tests.length + ' passed\n');
  process.exit(fail === 0 ? 0 : 1);
}

run();
