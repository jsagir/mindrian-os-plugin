'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 222-03 -- the BORN-WIRED reachability proof for the shared scored pick.
 * =============================================================================
 * Prevents the Phase 150.5 disease: registered-but-unreachable. NO mock of the
 * engine, NO parallel ranker, NO re-implementation of the canonical order. Both
 * live surfaces are driven through their REAL entry points: navigation-engine's
 * REAL decide() (the per-turn engine arm) and sensors.cjs's REAL register()
 * handlers captured off a fake MCP server (the suggest_next / reach_candidates
 * arm). A fixture is built where the shared SCORED selection (deep_research) and
 * the registry-ORDER-first fired candidate (context_block) DISAGREE, so the
 * positive arms are load-bearing rather than tautological (proved by the ARM 2
 * negative arm, the 213 ARM-4 discipline).
 *
 * The score split is achieved without threading cortex priors: the seeded
 * ranker_weights heavily favor the d4_blend expert, and the registry-first
 * reach (context_block) carries a Phase 158 reject history in room.db so its
 * composed D4 discount sinks it below deep_research on the flat 0.5 floor. Every
 * assertion reads the SHIPPED reachIdToSkillFamily map, never a hand-typed verb.
 *
 * ARM 5 (Wicked precedence) and ARM 6 (dead-Brain degrade) regression-pin the
 * two resolveFireSkill guards the insertion must leave byte-untouched.
 *
 * Plain CJS node:assert/strict; PASS line + non-zero exit on failure.
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
// REQUIRE BOTH live surfaces (the anti-vacuous-green signature): the real engine
// AND the real MCP tool module, never a direct rankFiredCandidates-only call.
const nav = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation-engine.cjs'));
const insight = require(path.join(REPO_ROOT, 'lib', 'core', 'insight-sensors.cjs'));
const sensorsTool = require(path.join(REPO_ROOT, 'lib', 'mcp', 'tools', 'sensors.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const ranker = require(path.join(REPO_ROOT, 'lib', 'workflow', 'reach-hedge-ranker.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));

const FIXTURE = path.join(REPO_ROOT, 'tests', 'fixtures', '213', 'last-eureka.json');

// The co-fire turn (from test-213 ARM 3): text fires a context_block sensor AND
// the fresh eureka side-channel fires deep_research, so >= 2 reaches co-fire.
const COFIRE_TEXT = 'the data pipeline is the bottleneck';
const REGISTRY_FIRST_REACH = 'context_block'; // earliest in SENSOR_REGISTRY order
const SCORE_FIRST_REACH = 'deep_research';     // the intended scored winner

// The canonical verbs, read from the SHIPPED map (never a hand-typed literal --
// the Phase 185 no-parallel-reimplementation rule).
const REGISTRY_FIRST_VERB = nav.reachIdToSkillFamily(REGISTRY_FIRST_REACH);
const SCORE_FIRST_VERB = nav.reachIdToSkillFamily(SCORE_FIRST_REACH);

assert.equal(REGISTRY_FIRST_VERB, 'Run Methodology',
  'PRECONDITION: reachIdToSkillFamily("context_block") drifted off "Run Methodology"; got ' + REGISTRY_FIRST_VERB);
assert.equal(SCORE_FIRST_VERB, 'Spawn Sub-Agent',
  'PRECONDITION: reachIdToSkillFamily("deep_research") drifted off "Spawn Sub-Agent"; got ' + SCORE_FIRST_VERB);
assert.notEqual(REGISTRY_FIRST_VERB, SCORE_FIRST_VERB,
  'PRECONDITION: the two verbs must differ for the split to be observable.');

// ---------- LOCAL test seams (temp rooms; never a real room) ----------

// Build a throwaway room carrying <dir>/.mindrian/last-eureka.json (fresh mtime
// so the eureka side-channel is within its freshness window and deep_research
// fires). Returns the room dir.
function makeRoom() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reach222-'));
  fs.mkdirSync(path.join(dir, '.mindrian'), { recursive: true });
  fs.copyFileSync(FIXTURE, path.join(dir, '.mindrian', 'last-eureka.json'));
  return dir;
}

// Seed the room.db so the SCORED pick (deep_research) beats the registry-first
// pick (context_block): weights favor the d4_blend expert, and context_block
// carries a Phase 158 reject history (2 presentations + 2 rejects -> the M fence
// is cleared, n=2 < N=3 so it is NOT hard-dropped, cp = 0.5). Returns the OPEN
// db handle (caller closes).
function seedRoomDb(roomDir) {
  const db = openRoomDb(roomDir);
  // updatedAt:0 keeps the fold debounce inert (2 reject rows << N=50, no refit).
  navigation.upsertHedgeWeightState(db, { d4_blend: 0.9, registry_order: 0.1 }, { updatedAt: 0 });
  for (let i = 0; i < 2; i += 1) {
    navigation.logMemoryEvent(db, 'reach_presented', { reach_id: REGISTRY_FIRST_REACH });
  }
  for (let i = 0; i < 2; i += 1) {
    navigation.logMemoryEvent(db, 'f_selector_decision', {
      reach_id: REGISTRY_FIRST_REACH,
      decision: 'reject',
    });
  }
  return db;
}

let passed = 0;
async function check(name, fn) {
  await fn();
  passed += 1;
  console.log('  ok - ' + name);
}

async function main() {
  console.log('test-222-reach-wired.cjs: born-wired reachability proof (real decide() + real MCP register)');

  // ---------- ARM 1: FIXTURE (>= 2 sensors co-fire in registry order) ----------
  await check('ARM 1 FIXTURE: the co-fire turn surfaces >= 2 reaches with context_block first (registry order)', () => {
    const dir = makeRoom();
    try {
      const fired = insight.dispatchSensors({ text: COFIRE_TEXT, turn_count: 5 }, {}, { roomDir: dir });
      const ids = fired.map((r) => r.reach_id);
      assert.ok(fired.length >= 2,
        'the fixture must co-fire >= 2 reaches; got ' + JSON.stringify(ids));
      assert.equal(fired[0].reach_id, REGISTRY_FIRST_REACH,
        'the registry-order-first fired reach must be context_block; got ' + fired[0].reach_id);
      assert.ok(ids.indexOf(SCORE_FIRST_REACH) !== -1,
        'the intended scored winner deep_research must be present in the fired set; got ' + JSON.stringify(ids));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  // ---------- ARM 2: NEGATIVE (load-bearing -- proves the arms are not tautological) ----------
  await check('ARM 2 NEGATIVE: registry-order-first reach !== the expected score-first reach for this fixture', () => {
    const dir = makeRoom();
    try {
      const fired = insight.dispatchSensors({ text: COFIRE_TEXT, turn_count: 5 }, {}, { roomDir: dir });
      assert.notEqual(fired[0].reach_id, SCORE_FIRST_REACH,
        'VACUOUS-GREEN RISK: registry-first already equals the score-first reach; the positive arms would pass ' +
        'trivially. registry-first=' + fired[0].reach_id + ' score-first=' + SCORE_FIRST_REACH);
      assert.equal(fired[0].reach_id, REGISTRY_FIRST_REACH,
        'the negative arm pins registry-first as context_block; got ' + fired[0].reach_id);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  // ---------- ARM 3: ENGINE REACHABILITY (Req 2, real decide()) ----------
  await check('ARM 3 ENGINE: the REAL decide() fires the SCORE-first verb, not the registry-first verb', () => {
    const dir = makeRoom();
    let db = null;
    try {
      db = seedRoomDb(dir);
      // The REAL decide() -- no engine mock, ctx.roomDb threaded so the ranker
      // reads the seeded weights + reject history.
      const decision = nav.decide({ text: COFIRE_TEXT, turn_count: 5 }, { roomDir: dir, roomDb: db });
      assert.equal(decision.fire_skill, SCORE_FIRST_VERB,
        'BORN-WIRED BREACH: decide() did not surface the scored winner. expected "' + SCORE_FIRST_VERB +
        '" (deep_research), got ' + JSON.stringify(decision.fire_skill) + '. The shared ranked pick is unreachable.');
      assert.notEqual(decision.fire_skill, REGISTRY_FIRST_VERB,
        'REGISTRY-ORDER LEAK: decide() surfaced the registry-first verb "' + REGISTRY_FIRST_VERB +
        '"; the scored re-order did not take effect on the engine arm.');
    } finally {
      if (db) { try { closeRoomDb(db); } catch (_e) { /* ignore */ } }
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  // ---------- ARM 4: MCP REACHABILITY (Req 6, real sensors.register handlers) ----------
  await check('ARM 4 MCP: real suggest_next / reach_candidates handlers return the scored (not registry) order', async () => {
    const dir = makeRoom();
    const priorActive = process.env.CLAUDE_ACTIVE_ROOM;
    try {
      const seedDb = seedRoomDb(dir);
      closeRoomDb(seedDb); // the MCP path re-opens the room.db via openRoomDbForCaller
      // Bind this session's room to the fixture (env override beats the registry).
      process.env.CLAUDE_ACTIVE_ROOM = dir;

      // Capture handlers off a fake MCP server from the REAL register(server, ctx).
      const registered = [];
      const fakeServer = {
        tool(name, _desc, schemaOrHandler, maybeHandler) {
          const handler = typeof maybeHandler === 'function' ? maybeHandler : schemaOrHandler;
          registered.push({ name: name, handler: handler });
        },
        server: { getClientCapabilities() { return {}; } },
      };
      sensorsTool.register(fakeServer, { fallbackRoomDir: dir });

      const suggestNext = registered.find((r) => r.name === 'suggest_next');
      const reachCandidates = registered.find((r) => r.name === 'reach_candidates');
      assert.ok(suggestNext && reachCandidates,
        'both suggest_next and reach_candidates must register through the REAL register().');

      const snPayload = JSON.parse(
        (await suggestNext.handler({ user_text: COFIRE_TEXT }, { sessionId: 's222' })).content[0].text);
      assert.ok(snPayload.suggestion && snPayload.suggestion.reach_id === SCORE_FIRST_REACH,
        'suggest_next must return the SCORED top (deep_research); got ' +
        JSON.stringify(snPayload.suggestion && snPayload.suggestion.reach_id));

      const rcPayload = JSON.parse(
        (await reachCandidates.handler({ user_text: COFIRE_TEXT }, { sessionId: 's222' })).content[0].text);
      const order = rcPayload.candidates.map((r) => r.reach_id);
      assert.ok(order.length >= 2, 'reach_candidates must return the full co-fire set; got ' + JSON.stringify(order));
      assert.equal(order[0], SCORE_FIRST_REACH,
        'reach_candidates must be in combined-SCORE order (deep_research first), not SENSOR_REGISTRY order; got ' +
        JSON.stringify(order));
      // Registry order would have context_block first (ARM 2) -- prove the flip.
      assert.notEqual(order[0], REGISTRY_FIRST_REACH,
        'REGISTRY-ORDER LEAK: reach_candidates led with the registry-first reach; the MCP arm did not rank.');
    } finally {
      if (priorActive === undefined) { delete process.env.CLAUDE_ACTIVE_ROOM; }
      else { process.env.CLAUDE_ACTIVE_ROOM = priorActive; }
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  // ---------- ARM 5: WICKED PRECEDENCE REGRESSION (resolveFireSkill :591-597 untouched) ----------
  await check('ARM 5 WICKED: escalation still outranks ANY fired sensor reach after the re-order', () => {
    const wickedBrain = { sections: { wicked_indicators: { body: 'wicked_score: 9' } } };
    // >= 2 fired reaches, deep_research on top (the re-ordered shape) -- the wicked
    // branch must STILL win, proving the insertion changed nothing at :591-597.
    const sensorReaches = [{ reach_id: SCORE_FIRST_REACH }, { reach_id: REGISTRY_FIRST_REACH }];
    const verb = nav.resolveFireSkill(wickedBrain, 0.0, 'tier_0', sensorReaches);
    assert.equal(verb, 'soft-systems',
      'WICKED PRECEDENCE BREACH: a wicked_score >= 8 turn must return "soft-systems" ahead of any sensor reach; got ' +
      JSON.stringify(verb));
  });

  // ---------- ARM 6: DEAD-BRAIN / EMPTY DEGRADE REGRESSION (invisible when nothing fires) ----------
  await check('ARM 6 DEGRADE: the zero-fired path is byte-identical (ranker passthrough + null fire_skill)', () => {
    // (a) the ranker is invisible on an empty fired subset: same reference back.
    const empty = [];
    assert.strictEqual(ranker.rankFiredCandidates(empty, { db: null }), empty,
      'the 0-candidate re-order must return the SAME array reference (byte-identical passthrough).');
    // (b) resolveFireSkill with no brain, no mode, no reaches degrades to null --
    //     the exact pre-insertion dead-Brain output (:582-585 path).
    const verb = nav.resolveFireSkill(null, 0.0, 'tier_0', []);
    assert.strictEqual(verb, null,
      'DEAD-BRAIN DEGRADE BREACH: a zero-fired, no-Brain turn must return null; got ' + JSON.stringify(verb));
  });

  console.log('');
  console.log('PASS test-222-reach-wired.cjs (' + passed + ' arms; the born-wired scored-pick proof is on disk)');
}

main().catch((err) => {
  console.error('FAIL test-222-reach-wired.cjs');
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
