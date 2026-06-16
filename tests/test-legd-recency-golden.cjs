'use strict';
// Phase 160-03 Task 2 (R5 / D-03) -- the Leg D recency determinism GOLDEN-FILE guard.
// ========================================================================
// D-03 mandates a FROZEN-OUTPUT golden-file fixture test (fixed node set -> fixed
// ranking) over the spine hot path (getRoomContext Leg D). This test:
//   (1) builds a hermetic room.db from tests/fixtures/legd-recency-golden.json,
//       inserting the cortex nodes in a DELIBERATELY SHUFFLED order (NOT recency
//       order, NOT id order) so a pass proves the app-side decay blend ranks
//       them -- not the insertion order and not the old ORDER BY type, id.
//   (2) runs getRoomContext with the FROZEN referenceMs injected through the
//       options.now clock seam (D-01a), so the ranking is deterministic.
//   (3) asserts the cortexNodes id order BYTE-MATCHES fixture.expectedRankedIds
//       (the determinism guard -- any drift in DECAY_BASE, the tiebreak, or the
//       ORDER BY fails CI).
//   (4) asserts the more-recent of two score-tied nodes (claim:gamma vs
//       decision:beta, both 25h) resolves by the ascending-id tiebreak, and that
//       a recently-touched node outranks an identical stale node (the R5/R6
//       ordering at the spine).
//
// Mirrors the node:sqlite SKIP-on-unavailable guard (exit 77) + the temp-FILE
// DatabaseSync fixture + applySchema shape from tests/test-150-cortex-local-query.cjs.
//
// House rule: hyphens only, no em-dashes (CLAUDE.md HARD RULE).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let DatabaseSync;
try {
  DatabaseSync = require('node:sqlite').DatabaseSync;
} catch (_) {
  process.stdout.write('SKIP test-legd-recency-golden.cjs (node:sqlite unavailable)\n');
  process.exit(77);
}

const REPO_ROOT = path.resolve(__dirname, '..');
const FIXTURE_PATH = path.join(REPO_ROOT, 'tests', 'fixtures', 'legd-recency-golden.json');
const ROOM_CONTEXT_REL = 'lib/core/navigation/room-context.cjs';

const golden = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
const { getRoomContext } = require(path.join(REPO_ROOT, ROOM_CONTEXT_REL));

// ---------- Schema fixture (production nodes column set, see 150-04 test) ----------

function applySchema(db) {
  db.exec(
    'CREATE TABLE IF NOT EXISTS nodes (' +
    '  id TEXT PRIMARY KEY,' +
    '  type TEXT NOT NULL,' +
    "  properties TEXT DEFAULT '{}'," +
    '  source_path TEXT NOT NULL,' +
    "  created_by TEXT NOT NULL CHECK(created_by IN ('user','larry','import','brain','system'))," +
    '  confidence REAL,' +
    "  review_status TEXT NOT NULL DEFAULT 'proposed'" +
    "    CHECK(review_status IN ('proposed','confirmed','rejected','stale','superseded','needs_evidence','validated','invalidated'))," +
    '  created_at INTEGER NOT NULL,' +
    '  last_seen_at INTEGER NOT NULL,' +
    '  source_section TEXT,' +
    '  confirmed_by TEXT,' +
    '  confirmed_at INTEGER' +
    ');'
  );
  db.exec(
    'CREATE TABLE IF NOT EXISTS edges (' +
    '  source TEXT NOT NULL, target TEXT NOT NULL, type TEXT NOT NULL,' +
    "  properties TEXT DEFAULT '{}', PRIMARY KEY (source, target, type)" +
    ');'
  );
}

function tempDbPath() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'phase-160-legd-golden-')), 'room.db');
}

// Insert the fixture nodes in a DELIBERATELY SHUFFLED order (neither recency nor
// id order) so a pass proves Leg D ranks them, not the insertion order.
function seedNodes(db, nodes) {
  const insert = db.prepare(
    'INSERT INTO nodes (id, type, properties, source_path, created_by, review_status, created_at, last_seen_at) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  // Reverse the fixture order, then rotate, to ensure it is not the expected order.
  const shuffled = nodes.slice().reverse();
  for (const n of shuffled) {
    insert.run(
      n.id,
      n.type,
      '{}',
      'fixture://legd-recency-golden',
      'system',
      n.review_status || 'proposed',
      n.created_at,
      typeof n.last_seen_at === 'number' ? n.last_seen_at : n.created_at
    );
  }
}

let failures = 0;
async function check(name, fn) {
  try {
    await fn();
    process.stdout.write('  ok   ' + name + '\n');
  } catch (e) {
    failures++;
    process.stdout.write('  FAIL ' + name + '\n       ' + String(e && e.message) + '\n');
  }
}

(async function main() {
  process.stdout.write('test-legd-recency-golden.cjs\n');

  await check('fixture is well-formed (frozen reference + node set + expected order)', async () => {
    assert.ok(Number.isFinite(golden.referenceMs), 'referenceMs must be a finite number');
    assert.equal(golden.decayBase, 0.995, 'fixture decayBase must be the visible 0.995 constant');
    assert.ok(Array.isArray(golden.nodes) && golden.nodes.length > 0, 'nodes must be a non-empty array');
    assert.ok(
      Array.isArray(golden.expectedRankedIds) && golden.expectedRankedIds.length === golden.nodes.length,
      'expectedRankedIds must cover every node'
    );
  });

  await check('Leg D cortexNodes id order BYTE-MATCHES the frozen golden ranking (D-03 determinism guard)', async () => {
    const dbPath = tempDbPath();
    const db = new DatabaseSync(dbPath);
    applySchema(db);
    seedNodes(db, golden.nodes);

    // Inject the FROZEN reference via the options.now seam (D-01a). getRoomContext
    // threads options into legD -> resolveReferenceMs, so this fixes the clock.
    const ctx = await getRoomContext(db, 'legd-golden-room', { now: golden.referenceMs });
    db.close();

    assert.ok(Array.isArray(ctx.cortexNodes), 'cortexNodes must be an array');
    const ids = ctx.cortexNodes.map((n) => n && n.id);
    assert.deepEqual(
      ids,
      golden.expectedRankedIds,
      'the Leg D ranked id order must byte-match the frozen golden fixture'
    );
  });

  await check('determinism: shuffled re-insertion yields the identical ranked order (run twice)', async () => {
    async function run() {
      const dbPath = tempDbPath();
      const db = new DatabaseSync(dbPath);
      applySchema(db);
      // Insert in fixture-forward order this run (vs reversed in seedNodes) to
      // prove the output is insertion-order-independent.
      const insert = db.prepare(
        'INSERT INTO nodes (id, type, properties, source_path, created_by, review_status, created_at, last_seen_at) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      );
      for (const n of golden.nodes) {
        insert.run(n.id, n.type, '{}', 'fixture://x', 'system', n.review_status || 'proposed', n.created_at, n.created_at);
      }
      const ctx = await getRoomContext(db, 'legd-golden-room', { now: golden.referenceMs });
      db.close();
      return ctx.cortexNodes.map((n) => n && n.id);
    }
    const a = await run();
    const b = await run();
    assert.deepEqual(a, b, 'two runs produce the identical ranked order (deterministic)');
    assert.deepEqual(a, golden.expectedRankedIds, 'forward-insertion run also matches the golden order');
  });

  await check('R5/R6 ordering: a recently-touched node outranks an identical stale node', async () => {
    // Build a minimal two-node room: identical but for created_at.
    const dbPath = tempDbPath();
    const db = new DatabaseSync(dbPath);
    applySchema(db);
    const ref = golden.referenceMs;
    const H = 3600000;
    const insert = db.prepare(
      'INSERT INTO nodes (id, type, properties, source_path, created_by, review_status, created_at, last_seen_at) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    // Insert stale first so insertion order would put it first if ranking failed.
    insert.run('claim:stale', 'claim', '{}', 'fixture://x', 'system', 'confirmed', ref - 500 * H, ref - 500 * H);
    insert.run('claim:fresh', 'claim', '{}', 'fixture://x', 'system', 'confirmed', ref - 1 * H, ref - 1 * H);
    const ctx = await getRoomContext(db, 'legd-pair-room', { now: ref });
    db.close();
    const ids = ctx.cortexNodes.map((n) => n && n.id);
    assert.equal(ids[0], 'claim:fresh', 'the recently-touched node ranks above the identical stale node (R5/R6)');
    assert.equal(ids[1], 'claim:stale', 'the stale node ranks last');
  });

  await check('score-tied nodes resolve by the deterministic ascending-id tiebreak', async () => {
    // claim:gamma and decision:beta are both 25h old (score-tied); claim:gamma
    // ranks first by ascending-id tiebreak ('c' < 'd').
    const gi = golden.expectedRankedIds.indexOf('claim:gamma');
    const bi = golden.expectedRankedIds.indexOf('decision:beta');
    assert.ok(gi !== -1 && bi !== -1, 'both tie nodes present in the golden order');
    assert.ok(gi < bi, 'claim:gamma (ascending-id tiebreak) ranks before the score-tied decision:beta');
  });

  if (failures > 0) {
    process.stdout.write('\n  ' + failures + ' check(s) FAILED\n');
    process.exit(1);
  }
  process.stdout.write('\n  all checks passed\n');
  process.exit(0);
})();
