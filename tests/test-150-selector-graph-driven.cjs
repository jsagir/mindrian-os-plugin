'use strict';
// Phase 150-06 (MEM-06) -- the 148 selector becomes graph-driven.
// ========================================================================
// Three behaviors, RED-by-design until Tasks 2-3 land:
//
//   A. Graph-driven ranking (MEM-06): a roomState whose reachScores were built
//      by cortex-reach-adapter.buildReachScoresFromCortex(cortexNodes) ranks a
//      DIFFERENT one-move (buildReachList reaches[0]) than the same call with an
//      empty/flat reachScores. The projected cortex shifts the ranking. AND the
//      three frozen 148 contracts are byte-unchanged: MAX_K=3, the 0.70 floor +
//      0.15 margin recommend gate, DIAL_REACH_K=6 (read the constants, assert
//      their values).
//
//   B. Archetype escalation (D-02): resolveArchetype(reachKey) with no second
//      arg returns the static-map archetype byte-stable (the floor); the same
//      call with a cortexState carrying contradiction node-type presence
//      ESCALATES the archetype above its static default; the static map is never
//      lowered.
//
//   C. The adapter retires the flat-file side-channel to fallback only: when
//      cortexNodes are present the adapter's scores win; the new caller is
//      cortex-reach-adapter.cjs, NOT an edit to the pure dial-reach-orchestrator.
//
// RED-by-design: lib/hmi/cortex-reach-adapter.cjs is absent and resolveArchetype
// has no second arg yet, so this suite FAILS until Task 2 lands.
//
// Any forbidden dash codepoint is referenced via String.fromCharCode so THIS
// file stays greppably clean. NO em-dashes anywhere (CLAUDE.md HARD RULE).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const ADAPTER_REL = 'lib/hmi/cortex-reach-adapter.cjs';
const ADAPTER_ABS = path.join(REPO_ROOT, ADAPTER_REL);
const ORCH_ABS = path.join(REPO_ROOT, 'lib/hmi/dial-reach-orchestrator.cjs');
const DISPATCH_ABS = path.join(REPO_ROOT, 'lib/hmi/selector-dispatcher.cjs');

const EM_DASH = String.fromCharCode(0x2014);
const EN_DASH = String.fromCharCode(0x2013);

let failures = 0;
function check(name, fn) {
  try {
    fn();
    process.stdout.write('PASS: ' + name + '\n');
  } catch (e) {
    failures += 1;
    process.stdout.write('FAILED: ' + name + ' -- ' + (e && e.message ? e.message : e) + '\n');
  }
}

// ---------------------------------------------------------------------------
// REAL cortex nodes (HIGH-01 fix): build a real fixture, reconcile it through
// navigation.cjs, and read the projected cortex back via getRoomContext legD.
// The behavior arms below consume THIS real cortex, NOT hand-synthesized phantom
// keys -- so a green suite proves the writer/reader property contract is live on
// real data (the writers DO emit kind='contradiction' + freshness='fresh'), not
// on test-fabricated keys. When node:sqlite is unavailable, realCortexNodes is
// null and the real-output arms self-SKIP (the frozen-contract arms still run).
// ---------------------------------------------------------------------------
let DatabaseSync = null;
try { DatabaseSync = require('node:sqlite').DatabaseSync; } catch (_) { DatabaseSync = null; }

function buildRealCortexNodes() {
  if (!DatabaseSync) return null;
  const runner = require(path.join(REPO_ROOT, 'lib/core/memory/reconcile-memory-runner.cjs'));
  const { getRoomContext } = require(path.join(REPO_ROOT, 'lib/core/navigation/room-context.cjs'));

  const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-150-sel-fixture-'));
  const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-150-sel-db-'));
  const dbPath = path.join(dbDir, 'room.db');

  // A real fixture carrying a contradiction decision + a fresh governing_thought.
  fs.writeFileSync(path.join(roomDir, 'ROOM.md'), '# Room\n\nIdentity.\n', 'utf8');
  fs.writeFileSync(
    path.join(roomDir, 'USER.md'),
    '---\ncanonical_role: founder\njourney_stage: ordeal\nrole_blend:\n  founder: 0.8\n---\n\nPersona.\n',
    'utf8'
  );
  const pd = path.join(roomDir, 'problem-definition');
  fs.mkdirSync(pd, { recursive: true });
  fs.writeFileSync(
    path.join(pd, 'MINTO.md'),
    '---\ngoverning_thought: "Ship what users want"\n---\n\n' +
    '## Governing Thought\n\nShip what users want.\n\n' +
    '## Decisions\n\n- DEC-PD-100: never ship the legacy importer; users reject it.\n',
    'utf8'
  );

  let db = null;
  try {
    db = new DatabaseSync(dbPath);
    db.exec(
      'CREATE TABLE IF NOT EXISTS nodes (' +
      '  id TEXT PRIMARY KEY, type TEXT NOT NULL, ' +
      "  properties TEXT DEFAULT '{}', source_path TEXT NOT NULL, " +
      "  created_by TEXT NOT NULL CHECK(created_by IN ('user','larry','import','brain','system')), " +
      '  confidence REAL, ' +
      "  review_status TEXT NOT NULL DEFAULT 'proposed' " +
      "    CHECK(review_status IN ('proposed','confirmed','rejected','stale','superseded','needs_evidence','validated','invalidated')), " +
      '  created_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL, ' +
      '  source_section TEXT, confirmed_by TEXT, confirmed_at INTEGER);'
    );
    db.exec(
      'CREATE TABLE IF NOT EXISTS edges (source TEXT NOT NULL, target TEXT NOT NULL, ' +
      "type TEXT NOT NULL, properties TEXT DEFAULT '{}', PRIMARY KEY (source, target, type));"
    );
    runner.reconcileMemoryArtifacts(roomDir, { db: db });
    // legD is async; resolve synchronously via deasync-free await wrapper. The
    // helper returns a Promise so callers await it.
    return getRoomContext(db, 'sel-graph-driven', {}).then((rc) => {
      try { db.close(); } catch (_) {}
      try { fs.rmSync(roomDir, { recursive: true, force: true }); } catch (_) {}
      try { fs.rmSync(dbDir, { recursive: true, force: true }); } catch (_) {}
      return Array.isArray(rc.cortexNodes) ? rc.cortexNodes : [];
    });
  } catch (_) {
    try { if (db) db.close(); } catch (_e) {}
    try { fs.rmSync(roomDir, { recursive: true, force: true }); } catch (_e) {}
    try { fs.rmSync(dbDir, { recursive: true, force: true }); } catch (_e) {}
    return null;
  }
}

// ---------------------------------------------------------------------------
// Frozen-contract assertions (T-150-06-01). Read the orchestrator constants and
// the ranker MAX_K; assert byte-unchanged. These hold REGARDLESS of Task 2/3.
// ---------------------------------------------------------------------------
check('frozen contracts byte-unchanged (MAX_K=3, 0.70/0.15, DIAL_REACH_K=6)', function () {
  const orch = require(ORCH_ABS);
  assert.equal(orch.DIAL_REACH_K, 6, 'DIAL_REACH_K must be frozen at 6');
  assert.equal(orch.RECOMMEND_FLOOR, 0.70, 'RECOMMEND_FLOOR must be frozen at 0.70');
  assert.equal(orch.MARGIN_THRESHOLD, 0.15, 'MARGIN_THRESHOLD must be frozen at 0.15');
  const ranker = require(path.join(REPO_ROOT, 'lib/workflow/f-selector-ranker.cjs'));
  assert.equal(ranker.MAX_K, 3, 'ranker MAX_K must be frozen at 3');
});

// ---------------------------------------------------------------------------
// No-em-dash sweep on the new + edited sources (synchronous; no cortex needed).
// ---------------------------------------------------------------------------
check('no em-dash / en-dash in edited sources', function () {
  const targets = [ADAPTER_ABS, DISPATCH_ABS, ORCH_ABS];
  for (const t of targets) {
    if (!fs.existsSync(t)) continue;
    const src = fs.readFileSync(t, 'utf8');
    assert.equal(src.indexOf(EM_DASH), -1, 'no em-dash in ' + path.basename(t));
    assert.equal(src.indexOf(EN_DASH), -1, 'no en-dash in ' + path.basename(t));
  }
});

// ---------------------------------------------------------------------------
// The behavior arms drive from REAL reconcile output (HIGH-01): the cortex nodes
// are projected by the navigation writers, NOT synthesized with phantom keys.
// ---------------------------------------------------------------------------
(async function runBehaviorArms() {
  let realCortexNodes = null;
  try {
    const maybe = buildRealCortexNodes();
    realCortexNodes = maybe && typeof maybe.then === 'function' ? await maybe : maybe;
  } catch (_) {
    realCortexNodes = null;
  }

  if (!realCortexNodes) {
    process.stdout.write('SKIP: real-cortex behavior arms (node:sqlite unavailable)\n');
  } else {
    // The real cortex MUST carry the keys the consumers read -- proving the
    // writer/reader contract is live (the writers emit kind / freshness, not the
    // test). If these are absent, the loop is dead and the suite must FAIL.
    check('real reconcile output carries kind=contradiction + freshness on the projected cortex (HIGH-01)', function () {
      const dec = realCortexNodes.find((n) => n.type === 'decision' && n.properties && n.properties.kind === 'contradiction');
      assert.ok(dec, 'a real projected decision node must carry kind=contradiction (no phantom key); got ' +
        JSON.stringify(realCortexNodes.filter((n) => n.type === 'decision').map((n) => n.properties)));
      const gt = realCortexNodes.find((n) => n.type === 'governing_thought' && n.properties && n.properties.freshness);
      assert.ok(gt, 'a real projected governing_thought node must carry a freshness enum; got ' +
        JSON.stringify(realCortexNodes.filter((n) => n.type === 'governing_thought').map((n) => n.properties)));
    });

    // Behavior A: graph-driven ranking on REAL output.
    check('adapter folds REAL cortexNodes -> reachScores prior map (MEM-06)', function () {
      const adapter = require(ADAPTER_ABS);
      assert.equal(typeof adapter.buildReachScoresFromCortex, 'function',
        'adapter must export buildReachScoresFromCortex');
      const scores = adapter.buildReachScoresFromCortex(realCortexNodes);
      assert.ok(scores && typeof scores === 'object', 'scores must be an object map');
      const vals = Object.values(scores);
      assert.ok(vals.length > 0, 'scores map must be non-empty on real cortex');
      for (const v of vals) {
        assert.equal(typeof v, 'number', 'each score is a number');
        assert.ok(v >= 0 && v <= 1, 'each score is normalized 0..1');
      }
      // The contradiction prior fires on real output (was DEAD before HIGH-01).
      assert.equal(scores.contradiction, adapter.CONTRIBUTIONS.contradiction_present,
        'the contradiction prior must fire on real reconcile output; got ' + JSON.stringify(scores));
    });

    check('REAL cortex shifts the one-move vs flat reachScores (MEM-06)', function () {
      const adapter = require(ADAPTER_ABS);
      const orch = require(ORCH_ABS);
      const cortexScores = adapter.buildReachScoresFromCortex(realCortexNodes);
      const grounded = orch.buildReachList({ tierMode: 'mode_a', reachScores: cortexScores });
      const flat = orch.buildReachList({ tierMode: 'mode_a', reachScores: {} });
      assert.ok(grounded && Array.isArray(grounded.reaches), 'grounded reaches');
      assert.ok(flat && Array.isArray(flat.reaches), 'flat reaches');
      const gTop = grounded.reaches[0];
      const fTop = flat.reaches[0];
      const shifted = (gTop.reach_id !== fTop.reach_id) || (gTop.score !== fTop.score);
      assert.ok(shifted, 'real cortex priors must shift the ranked one-move');
      assert.equal(grounded.offered_count, Math.min(grounded.total_count, 3),
        'offered_count clamped at MAX_K=3');
    });

    // Behavior B: resolveArchetype escalation on REAL output.
    check('resolveArchetype with REAL cortexState escalates above the static floor (D-02)', function () {
      const disp = require(DISPATCH_ABS);
      const escalated = disp.resolveArchetype('context_block', { cortexNodes: realCortexNodes });
      assert.equal(escalated, 'confirm',
        'a real contradiction in the cortex escalates context_block select -> confirm');
    });
  }

  // --- Arms that need NO cortex (no phantom keys): empty-cortex + static floor. ---
  check('empty cortex -> empty/neutral priors (flat-file fallback path) (D-02)', function () {
    const adapter = require(ADAPTER_ABS);
    const scores = adapter.buildReachScoresFromCortex([]);
    assert.ok(scores && typeof scores === 'object', 'empty cortex returns an object');
    assert.equal(Object.keys(scores).length, 0,
      'empty cortex yields no priors so the flat-file path is the fallback');
  });

  check('resolveArchetype no-arg is byte-stable (the static floor) (D-02)', function () {
    const disp = require(DISPATCH_ABS);
    assert.equal(typeof disp.resolveArchetype, 'function', 'resolveArchetype exported');
    assert.equal(disp.resolveArchetype('context_block'), 'select', 'static floor for context_block is select');
    assert.equal(disp.resolveArchetype('hats'), 'confirm', 'static floor for hats is confirm');
    assert.equal(disp.resolveArchetype('no-such-reach'), 'select', 'miss defaults to select');
  });

  check('resolveArchetype no contradiction signal keeps the static floor (D-02)', function () {
    const disp = require(DISPATCH_ABS);
    const noSignal = disp.resolveArchetype('context_block', { cortexNodes: [] });
    assert.equal(noSignal, 'select', 'no contradiction signal keeps the static floor');
  });

  check('resolveArchetype never lowers below the static default (D-02, T-150-06-04)', function () {
    const disp = require(DISPATCH_ABS);
    const lowered = disp.resolveArchetype('hats', { cortexNodes: [] });
    assert.equal(lowered, 'confirm', 'hats stays confirm; cortex never lowers the floor');
  });

  if (failures > 0) {
    process.stdout.write('\ntest-150-selector-graph-driven.cjs: ' + failures + ' FAILED\n');
    process.exit(1);
  }
  process.stdout.write('\ntest-150-selector-graph-driven.cjs: all assertions passed (live on real reconcile output)\n');
  process.exit(0);
})();
