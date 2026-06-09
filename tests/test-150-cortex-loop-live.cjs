'use strict';
// Phase 150 REVIEW-FIX (HIGH-01 + MED-01) -- the memory-intelligence loop LIVE on
// real reconcile output.
// ========================================================================
// THE load-bearing integration test. It proves the cortex intelligence loop is
// live on REAL writer output, NOT on test-fabricated phantom keys. The review
// (HIGH-01) found the writers persisted one property shape while three consumers
// read keys (decision.kind / governing_thought.freshness / memory_artifact.anchors)
// NO writer ever emitted -- the suite was green only because the unit tests
// synthesized those keys. This test reconciles a REAL fixture room through
// navigation.cjs, reads the cortex back via getRoomContext legD, and asserts the
// real consumers fire on the real projected nodes:
//
//   1. hasContradiction(real projected nodes) === true   (a real contradiction
//      decision line is classified kind='contradiction' by the writer).
//   2. deriveBrainAnchors(real projected nodes).length > 0   (a real BRAIN.md
//      derivation yields generic framework-name anchors on the BRAIN node).
//   3. buildReachScoresFromCortex(real) is non-trivial AND carries the fresh
//      governing_thought prior (0.30) + the contradiction prior (0.55) -- the
//      0.55 / 0.30 / 0.20 priors that were DEAD before the fix.
//   4. deriveCortexCtxSignals(real) fires (freshContradictions > 0) AND the
//      MED-01 sensor sensorMemoryCortex fires on a ctx threaded from real output
//      (the sensor had no producer before the fix).
//
// NO SYNTHESIZED PHANTOM KEYS: every cortex node read here is produced by the
// shipped navigation writers via reconcileMemoryArtifacts over a real fixture
// tree on disk. The build-fixture-room-db helper is NOT used (it points at the
// poison-seeded claim-room whose BRAIN.md carries no framework names); this test
// builds its own minimal fixture carrying all three real signals.
//
// Canon Part 8: the new cortex props are closed enums (kind='contradiction',
// freshness='fresh') + generic framework-name handles (anchors) -- never prose.
// They ride the LOCAL routing lane only; the Brain packet builder never reads
// node properties (verified by tests/test-150-brain-egress.cjs + the part-8
// sweep). node:sqlite unavailable -> SKIP 77. NO em-dashes (CLAUDE.md HARD RULE).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let DatabaseSync;
try {
  DatabaseSync = require('node:sqlite').DatabaseSync;
} catch (_) {
  process.stdout.write('SKIP test-150-cortex-loop-live.cjs (node:sqlite unavailable)\n');
  process.exit(77);
}

const REPO_ROOT = path.resolve(__dirname, '..');
const runner = require(path.join(REPO_ROOT, 'lib', 'core', 'memory', 'reconcile-memory-runner.cjs'));
const adapter = require(path.join(REPO_ROOT, 'lib', 'hmi', 'cortex-reach-adapter.cjs'));
const projections = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'projections.cjs'));
const { getRoomContext } = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'room-context.cjs'));
const { sensorMemoryCortex } = require(path.join(REPO_ROOT, 'lib', 'core', 'sensors', 'sensor-memory-cortex.cjs'));

// Full production nodes + edges schema (mirror test-150-reconcile.cjs).
function applySchema(db) {
  db.exec(
    'CREATE TABLE IF NOT EXISTS nodes (' +
    '  id TEXT PRIMARY KEY, type TEXT NOT NULL, ' +
    "  properties TEXT DEFAULT '{}', source_path TEXT NOT NULL, " +
    "  created_by TEXT NOT NULL CHECK(created_by IN ('user','larry','import','brain','system')), " +
    '  confidence REAL, ' +
    "  review_status TEXT NOT NULL DEFAULT 'proposed' " +
    "    CHECK(review_status IN ('proposed','confirmed','rejected','stale','superseded','needs_evidence','validated','invalidated')), " +
    '  created_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL, ' +
    '  source_section TEXT, confirmed_by TEXT, confirmed_at INTEGER' +
    ');'
  );
  db.exec(
    'CREATE TABLE IF NOT EXISTS edges (' +
    '  source TEXT NOT NULL, target TEXT NOT NULL, type TEXT NOT NULL, ' +
    "  properties TEXT DEFAULT '{}', PRIMARY KEY (source, target, type)" +
    ');'
  );
}

// A REAL fixture room tree carrying all three live signals:
//   <root>/ROOM.md                            (the persona DESCRIBES target)
//   <root>/USER.md                            (role_blend + journey_stage -> persona)
//   problem-definition/MINTO.md               (fresh governing_thought + a contradiction decision)
//   market-analysis/BRAIN.md                  (a derivation naming SWOT + Porter -> anchors)
function buildFixture() {
  const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-150-loop-live-'));

  fs.writeFileSync(path.join(roomDir, 'ROOM.md'), '# Room\n\nIdentity prose.\n', 'utf8');
  fs.writeFileSync(
    path.join(roomDir, 'USER.md'),
    '---\ncanonical_role: founder\njourney_stage: ordeal\nrole_blend:\n  founder: 0.7\n  researcher: 0.3\n---\n\nPersona prose.\n',
    'utf8'
  );

  const pd = path.join(roomDir, 'problem-definition');
  fs.mkdirSync(pd, { recursive: true });
  fs.writeFileSync(
    path.join(pd, 'MINTO.md'),
    '---\ngoverning_thought: "Ship the scheduler that users actually want"\n---\n\n' +
    '## Governing Thought\n\nShip the scheduler that users actually want.\n\n' +
    '## Decisions\n\n' +
    '- DEC-PD-100: ship the meeting-scheduling feature in the first release.\n' +
    '- DEC-PD-101: never ship the standalone tea timer; users reject it outright.\n',
    'utf8'
  );

  const ma = path.join(roomDir, 'market-analysis');
  fs.mkdirSync(ma, { recursive: true });
  fs.writeFileSync(
    path.join(ma, 'BRAIN.md'),
    '---\nbrain_offline: false\n---\n\n## Derivation\n\n' +
    'Framework chain: SWOT then Porter Five Forces. These are the generic\n' +
    'methodology anchors the Brain derivation names.\n',
    'utf8'
  );

  return roomDir;
}

let failures = 0;
function check(name, fn) {
  try { fn(); process.stdout.write('  ok   ' + name + '\n'); }
  catch (e) { failures++; process.stdout.write('  FAIL ' + name + '\n       ' + String(e && e.message) + '\n'); }
}

(async function run() {
  const roomDir = buildFixture();
  const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-150-loop-db-'));
  const dbPath = path.join(dbDir, 'room.db');
  let db;
  let cortexNodes = [];
  try {
    db = new DatabaseSync(dbPath);
    applySchema(db);

    // REAL reconcile: project the fixture memory files through navigation.cjs.
    const report = runner.reconcileMemoryArtifacts(roomDir, { db: db });
    assert.ok(report && typeof report === 'object', 'reconcile returns a report');

    // Read the cortex back the SAME way the dial does: getRoomContext legD.
    const rc = await getRoomContext(db, 'loop-live', {});
    cortexNodes = Array.isArray(rc.cortexNodes) ? rc.cortexNodes : [];
    assert.ok(cortexNodes.length > 0, 'legD surfaces the projected cortex nodes');

    // --- 1. hasContradiction fires on REAL projected output (NOT synthesized) ---
    check('hasContradiction(real projected cortex) === true (writer mints kind=contradiction)', () => {
      // Sanity: a real decision node carries kind='contradiction' (no test fabricated it).
      const contradictionDecisions = cortexNodes.filter(
        (n) => n.type === 'decision' && n.properties && n.properties.kind === 'contradiction'
      );
      assert.ok(contradictionDecisions.length > 0,
        'a real decision node must carry kind=contradiction from the writer; got ' +
        JSON.stringify(cortexNodes.filter((n) => n.type === 'decision').map((n) => n.properties)));
      assert.equal(adapter.hasContradiction(cortexNodes), true,
        'hasContradiction must be true on real reconcile output');
    });

    // --- 2. deriveBrainAnchors fires on REAL projected output ---
    check('deriveBrainAnchors(real projected cortex).length > 0 (BRAIN node carries anchors)', () => {
      const brainNode = cortexNodes.find(
        (n) => n.type === 'memory_artifact' && n.properties && n.properties.kind === 'BRAIN'
      );
      assert.ok(brainNode, 'a real BRAIN memory_artifact node must exist');
      assert.ok(Array.isArray(brainNode.properties.anchors) && brainNode.properties.anchors.length > 0,
        'the BRAIN node must carry generic framework-name anchors; got ' +
        JSON.stringify(brainNode.properties));
      const anchors = projections.deriveBrainAnchors(cortexNodes);
      assert.ok(Array.isArray(anchors) && anchors.length > 0,
        'deriveBrainAnchors must return a non-empty handle set on real output; got ' + JSON.stringify(anchors));
      assert.ok(anchors.indexOf('SWOT') !== -1, 'SWOT anchor must be produced from the real BRAIN.md');
      // End-to-end: the produced anchors feed the weight-0.5 brain_md signal.
      const frameworks = projections.resolveActiveFrameworks({ brainAnchors: anchors });
      assert.ok(frameworks.some((f) => f.source === 'brain_md'),
        'the produced anchors must feed the weight-0.5 brain_md signal');
    });

    // --- 3. buildReachScoresFromCortex is non-trivial on REAL output ---
    check('buildReachScoresFromCortex(real) carries the fresh-thought + contradiction priors (were dead)', () => {
      const scores = adapter.buildReachScoresFromCortex(cortexNodes);
      assert.ok(scores && typeof scores === 'object', 'scores is an object map');
      // The contradiction prior (0.55) -- DEAD before the fix (hasContradiction false).
      assert.equal(scores.contradiction, adapter.CONTRIBUTIONS.contradiction_present,
        'contradiction prior must fire on real output; got ' + JSON.stringify(scores));
      // The FRESH governing_thought prior (0.30) -- DEAD before the fix (no freshness key).
      assert.equal(scores.context_block, adapter.CONTRIBUTIONS.governing_thought_fresh,
        'fresh governing_thought prior must fire on real output; got ' + JSON.stringify(scores));
    });

    // --- 4. deriveCortexCtxSignals + the MED-01 sensor fire on REAL output ---
    check('deriveCortexCtxSignals(real) fires + sensorMemoryCortex fires from real-derived ctx (MED-01)', () => {
      const ctx = adapter.deriveCortexCtxSignals(cortexNodes);
      assert.ok(ctx.freshContradictions > 0,
        'a real contradiction must surface freshContradictions > 0; got ' + JSON.stringify(ctx));
      // The sensor consumes the SAME ctx the engine threads -- a real fire, no synthetic ctx.
      const reach = sensorMemoryCortex({}, {}, ctx);
      assert.ok(reach, 'sensorMemoryCortex must FIRE on the real-derived ctx (was a no-op before MED-01)');
      assert.equal(reach.signal, 'memory_cortex', 'the fired reach is the memory-cortex bridge');
    });

    db.close();
  } finally {
    try { fs.rmSync(roomDir, { recursive: true, force: true }); } catch (_) {}
    try { fs.rmSync(dbDir, { recursive: true, force: true }); } catch (_) {}
  }

  if (failures > 0) {
    process.stdout.write('\ntest-150-cortex-loop-live.cjs: ' + failures + ' failure(s)\n');
    process.exit(1);
  }
  process.stdout.write('\ntest-150-cortex-loop-live.cjs: the memory-intelligence loop is LIVE on real data\n');
  process.exit(0);
})();
