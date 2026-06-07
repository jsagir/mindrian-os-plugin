#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 91-03 -- Skill Activation Router fixture tests
 * =====================================================
 * Exercises lib/core/skill-activation-router.cjs. The router composes
 * navigation-engine.decide() output with the legacy (pre-91) file-state
 * + env activation set into a single declarative activation decision
 * that the UserPromptSubmit hook embeds into additionalContext.
 *
 * Canon Part 3 (Tri-Context Decision Gate): the closed 10-verb
 * vocabulary is enforced on engine outputs. Unknown verbs are rejected
 * with a trace note (canon_part_3_unknown_verb_rejected) instead of
 * silently propagating, preventing a future plan from inventing a
 * net-new verb behind canon review.
 *
 * Canon Part 7 (Reuse Before Build): legacy file-state + env activation
 * is preserved byte-identical when the engine is silent. This module
 * is a precedence layer on top, not a replacement.
 *
 * Test map (Tests 1-15 = router unit tests; Tests 16-17 = end-to-end
 * integration through scripts/intent-classifier.cjs added in Task 2):
 *
 *   1.  engine.fire_skill set + legacy populated -> source='engine'
 *   2.  engine.fire_skill null + suppress_skills set -> source='mixed'
 *   3.  engine null (timeout) + legacy populated -> source='legacy'
 *   4.  engine.fire_skill null + empty suppress -> source='legacy'
 *   5.  validateVerb('Run Methodology') === true (canonical hit)
 *   6.  validateVerb('run methodology') === true (case-insensitive)
 *   7.  validateVerb('Invent New Verb') === false (closed set)
 *   8.  unknown fire_skill -> falls through; trace note recorded
 *   9.  every canonical verb is accepted
 *   10. empty legacy + null engine -> {[], [], 'legacy', ...}
 *   11. contradictory fire vs suppress -> fire wins; trace note recorded
 *   12. case-preservation: canonical casing in output (not user casing)
 *   13. routeActivation(null, null) -> null-safe legacy fallback
 *   14. non-array legacy -> defensive coercion
 *   15. unknown verb + valid suppress -> mixed mode honored
 *   16. integration: spawn intent-classifier with engine returning
 *       'Run Methodology' -> additionalContext contains
 *       'activated_skills: [Run Methodology]' + 'routing_source: engine'
 *   17. integration: spawn intent-classifier with engine null ->
 *       additionalContext contains 'routing_source: legacy'
 *
 * Registered in lib/memory/run-feynman-tests.cjs.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..', '..');
const ROUTER_PATH = path.join(REPO, 'lib/core/skill-activation-router.cjs');
const SHARED_PATH = path.join(REPO, 'lib/core/navigation-engine-shared.cjs');
const CLASSIFIER_PATH = path.join(REPO, 'scripts/intent-classifier.cjs');

function requireRouter() {
  // Lazy require so Task 1 RED can run before the file exists.
  return require(ROUTER_PATH);
}

function requireShared() {
  return require(SHARED_PATH);
}

// ---------- Test scaffolding ----------

let passed = 0;
let failed = 0;
function run(name, fn) {
  try {
    fn();
    process.stdout.write('ok  ' + name + '\n');
    passed += 1;
  } catch (err) {
    process.stderr.write('FAIL ' + name + '\n');
    process.stderr.write(String(err && err.stack ? err.stack : err) + '\n');
    failed += 1;
  }
}

// ---------- Fixture builders ----------

function makeEngineDecision(overrides) {
  const base = {
    fire_skill: null,
    suppress_skills: [],
    persona_updates: null,
    offer_next_step: null,
    decision_trace: {
      icm_scope: null,
      sql_signals: null,
      minto_reasoning: null,
      brain_patterns: null,
      intent_persona: null,
      chosen_rationale: '',
      brain_md_tier_mode: 'mode_a',
      brain_md_staleness: 'fresh',
      brain_md_stale_reason: null,
      brain_md_weight_applied: 1.0,
      brain_md_recommended_confidence: 0.85,
      brain_md_recommended_marker_rendered: true,
      brain_md_sections_consumed: [],
      brain_md_version: 1,
    },
  };
  return Object.assign({}, base, overrides || {});
}

// =========================================================
// Task 1 -- Router unit tests (Tests 1-15)
// =========================================================

run('Test 1: engine.fire_skill set + legacy populated -> source=engine', () => {
  const { routeActivation } = requireRouter();
  const engine = makeEngineDecision({ fire_skill: 'Run Methodology' });
  const legacy = ['room-passive', 'larry-personality'];
  const out = routeActivation(engine, legacy);
  assert.equal(out.source, 'engine');
  assert.deepEqual(out.activated_skills, ['Run Methodology']);
  assert.deepEqual(out.suppressed_skills, []);
  assert.equal(out.reason, 'engine_fire_skill_set');
});

run('Test 2: engine.fire_skill null + suppress_skills set -> source=mixed', () => {
  const { routeActivation } = requireRouter();
  const engine = makeEngineDecision({
    fire_skill: null,
    suppress_skills: ['room-proactive'],
  });
  const legacy = ['room-passive', 'room-proactive'];
  const out = routeActivation(engine, legacy);
  assert.equal(out.source, 'mixed');
  assert.deepEqual(out.activated_skills, ['room-passive']);
  assert.deepEqual(out.suppressed_skills, ['room-proactive']);
});

run('Test 3: engine null (timeout) + legacy populated -> source=legacy', () => {
  const { routeActivation } = requireRouter();
  const out = routeActivation(null, ['room-passive']);
  assert.equal(out.source, 'legacy');
  assert.deepEqual(out.activated_skills, ['room-passive']);
  assert.deepEqual(out.suppressed_skills, []);
});

run('Test 4: engine silent (fire_skill null + empty suppress) -> source=legacy', () => {
  const { routeActivation } = requireRouter();
  const engine = makeEngineDecision({ fire_skill: null, suppress_skills: [] });
  const legacy = ['room-passive', 'context-engine'];
  const out = routeActivation(engine, legacy);
  assert.equal(out.source, 'legacy');
  assert.deepEqual(out.activated_skills, ['room-passive', 'context-engine']);
  assert.deepEqual(out.suppressed_skills, []);
});

run('Test 5: validateVerb(\'Run Methodology\') === true', () => {
  const { validateVerb } = requireRouter();
  assert.equal(validateVerb('Run Methodology'), true);
});

run('Test 6: validateVerb case-insensitive (\'run methodology\' === true)', () => {
  const { validateVerb } = requireRouter();
  assert.equal(validateVerb('run methodology'), true);
  assert.equal(validateVerb('RUN METHODOLOGY'), true);
  assert.equal(validateVerb('Run METHODOLOGY'), true);
});

run('Test 7: validateVerb(\'Invent New Verb\') === false (closed set)', () => {
  const { validateVerb } = requireRouter();
  assert.equal(validateVerb('Invent New Verb'), false);
  assert.equal(validateVerb('Hack The Planet'), false);
  assert.equal(validateVerb(''), false);
  assert.equal(validateVerb(null), false);
  assert.equal(validateVerb(undefined), false);
  assert.equal(validateVerb(42), false);
});

run('Test 8: unknown fire_skill -> falls through to legacy; trace note recorded', () => {
  const { routeActivation } = requireRouter();
  const engine = makeEngineDecision({ fire_skill: 'Invent New Verb' });
  const legacy = ['room-passive'];
  const out = routeActivation(engine, legacy);
  // Unknown verb is rejected; router falls through to legacy semantics.
  assert.equal(out.source, 'legacy');
  assert.deepEqual(out.activated_skills, ['room-passive']);
  // Trace note must be recorded so /mos:explain-decision can surface
  // the rejection (Canon Part 3 closed-vocab boundary visible).
  assert.equal(Array.isArray(out.trace_notes), true);
  assert.equal(
    out.trace_notes.indexOf('canon_part_3_unknown_verb_rejected') !== -1,
    true,
    'expected canon_part_3_unknown_verb_rejected in trace_notes; got ' +
      JSON.stringify(out.trace_notes)
  );
});

run('Test 9: all 10 canonical verbs accepted as fire_skill', () => {
  const { routeActivation } = requireRouter();
  const { CANONICAL_VERBS } = requireShared();
  for (const verb of CANONICAL_VERBS) {
    const engine = makeEngineDecision({ fire_skill: verb });
    const out = routeActivation(engine, []);
    assert.equal(out.source, 'engine', 'verb ' + verb + ' should fire');
    assert.deepEqual(out.activated_skills, [verb]);
  }
});

run('Test 10: empty legacy + null engine -> {[], [], legacy, ...}', () => {
  const { routeActivation } = requireRouter();
  const out = routeActivation(null, []);
  assert.equal(out.source, 'legacy');
  assert.deepEqual(out.activated_skills, []);
  assert.deepEqual(out.suppressed_skills, []);
});

run('Test 11: contradictory fire vs suppress -> fire wins; trace note recorded', () => {
  const { routeActivation } = requireRouter();
  // engine fires Run Methodology AND lists Run Methodology in suppress.
  // Router resolves: fire_skill wins; suppress entry for the fired skill
  // is dropped; trace note records the contradiction.
  const engine = makeEngineDecision({
    fire_skill: 'Run Methodology',
    suppress_skills: ['Run Methodology', 'room-proactive'],
  });
  const out = routeActivation(engine, []);
  assert.equal(out.source, 'engine');
  assert.deepEqual(out.activated_skills, ['Run Methodology']);
  // Run Methodology is dropped from suppress; room-proactive remains.
  assert.deepEqual(out.suppressed_skills, ['room-proactive']);
  assert.equal(Array.isArray(out.trace_notes), true);
  assert.equal(
    out.trace_notes.indexOf('engine_contradictory_fire_vs_suppress_resolved') !== -1,
    true,
    'expected engine_contradictory_fire_vs_suppress_resolved in trace_notes; got ' +
      JSON.stringify(out.trace_notes)
  );
});

run('Test 12: case-preservation in output uses canonical casing', () => {
  const { routeActivation } = requireRouter();
  // User-supplied casing 'devil\'s advocate' must be canonicalized to
  // "Devil's Advocate" (the CANONICAL_VERBS entry).
  const engine = makeEngineDecision({ fire_skill: "devil's advocate" });
  const out = routeActivation(engine, []);
  assert.equal(out.source, 'engine');
  assert.deepEqual(out.activated_skills, ["Devil's Advocate"]);
});

run('Test 13: routeActivation(null, null) -> null-safe legacy fallback', () => {
  const { routeActivation } = requireRouter();
  const out = routeActivation(null, null);
  assert.equal(out.source, 'legacy');
  assert.deepEqual(out.activated_skills, []);
  assert.deepEqual(out.suppressed_skills, []);
  assert.equal(out.reason, 'null_inputs');
});

run('Test 14: non-array legacy -> defensive coercion to []', () => {
  const { routeActivation } = requireRouter();
  const out = routeActivation(null, 'not-an-array');
  assert.equal(out.source, 'legacy');
  assert.deepEqual(out.activated_skills, []);
});

run('Test 15: unknown verb + valid suppress -> mixed honored', () => {
  const { routeActivation } = requireRouter();
  const engine = makeEngineDecision({
    fire_skill: 'Bogus Verb',
    suppress_skills: ['room-proactive'],
  });
  const legacy = ['room-passive', 'room-proactive'];
  const out = routeActivation(engine, legacy);
  // Unknown fire_skill rejected; suppress still honored -> mixed mode.
  assert.equal(out.source, 'mixed');
  assert.deepEqual(out.activated_skills, ['room-passive']);
  assert.deepEqual(out.suppressed_skills, ['room-proactive']);
  assert.equal(Array.isArray(out.trace_notes), true);
  assert.equal(
    out.trace_notes.indexOf('canon_part_3_unknown_verb_rejected') !== -1,
    true
  );
});

// =========================================================
// Task 2 -- Integration tests (Tests 16-17)
// =========================================================
//
// These tests spawn scripts/intent-classifier.cjs end-to-end with a
// minimal Mindrian rooms fixture and verify the router output lands in
// the NAVIGATION DECISION block as 'activated_skills' + 'routing_source'
// lines. They use the existing MOS_NAV_TEST_* env-var stub mechanism
// for engine behavior simulation.
//
// Stub mechanism (Plan 91-02 patterns):
//   - MOS_NAV_TEST_FIRE_SKILL=<verb>    -> override engine fire_skill output
//   - MOS_NAV_TEST_SUPPRESS_SKILLS=...  -> override suppress_skills (csv)
//   - When unset, engine runs normally.
//
// We cannot mock the engine via require.cache in a spawned subprocess,
// so the integration tests rely on env-var stubs that the classifier
// honors when present. Plan 91-02 already documented this pattern.

function makeRoomsFixture(label) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), '91-03-' + label + '-'));
  const root = path.join(tmp, 'MindrianRooms');
  fs.mkdirSync(root, { recursive: true });
  const roomDir = path.join(root, 'fixture-room');
  fs.mkdirSync(roomDir, { recursive: true });
  // Minimal STATE.md so tokenizer has something to fingerprint.
  fs.writeFileSync(
    path.join(roomDir, 'STATE.md'),
    '---\nproject: fixture room\n---\n\n# Fixture Room\n'
  );
  // Section directory with a MINTO.md so resolveActiveSection finds one.
  const sectionDir = path.join(roomDir, 'market-analysis');
  fs.mkdirSync(sectionDir, { recursive: true });
  fs.writeFileSync(
    path.join(sectionDir, 'MINTO.md'),
    '---\ngoverning_thought: Customers will pay\nreasoning_health_score: 0.6\n---\n\n# Market analysis\n'
  );
  fs.writeFileSync(
    path.join(sectionDir, 'ROOM.md'),
    '# market-analysis section\n'
  );
  // Registry. resolve-active-room.cjs (the resolver the spine routes through
  // since Phase 127.3) reads MINDRIAN_ROOMS_HOME/.rooms/registry.json, picks
  // the active slug, then resolves the room ENTRY: the Object branch is
  // reg.rooms[slug]; the Array branch matches r.slug===slug || r.name===slug.
  // A bare string 'fixture-room' has neither .slug nor .name, so the legacy
  // rooms:['fixture-room'] shape made resolveActiveRoom return null -- the
  // engine block at intent-classifier.cjs:1369 (if (roomDir)) was skipped and
  // stdout stayed empty (the Tests 16/17 RED cause). Write the {slug, abs_path}
  // OBJECT shape so reg.rooms['fixture-room'].abs_path is the on-disk roomDir
  // that the resolver's final fs.existsSync gate accepts.
  const regDir = path.join(root, '.rooms');
  fs.mkdirSync(regDir, { recursive: true });
  fs.writeFileSync(
    path.join(regDir, 'registry.json'),
    JSON.stringify(
      {
        active: 'fixture-room',
        rooms: { 'fixture-room': { slug: 'fixture-room', abs_path: roomDir } },
      },
      null,
      2
    )
  );
  return { tmp: tmp, root: root, roomDir: roomDir, sectionDir: sectionDir };
}

function runHook(rootEnv, extraEnv, prompt) {
  const env = Object.assign({}, process.env, {
    MINDRIAN_ROOMS_ROOT: rootEnv,
    MINDRIAN_ROOMS_HOME: rootEnv,
    MINDRIAN_COPILOT_INJECT_FINDINGS: '0',
  }, extraEnv || {});
  return spawnSync(process.execPath, [CLASSIFIER_PATH], {
    input: JSON.stringify({ user_message: prompt || 'analyze market sizing' }),
    env: env,
    encoding: 'utf8',
    timeout: 5000,
  });
}

function classifierIntegrated() {
  // Gate Tests 16-17 on the integration block being wired into
  // intent-classifier.cjs (Task 2). Until then, skip them so RED of
  // Task 1 only shows 15 unit tests.
  const src = fs.readFileSync(CLASSIFIER_PATH, 'utf8');
  return src.indexOf('skill-activation-router') !== -1;
}

if (classifierIntegrated()) {
  run('Test 16: integration -- engine fire_skill -> activated_skills + routing_source=engine', () => {
    const fix = makeRoomsFixture('t16');
    try {
      const res = runHook(fix.root, {
        MOS_NAV_TEST_FIRE_SKILL: 'Run Methodology',
      });
      assert.equal(
        res.status === 0,
        true,
        'classifier exited non-zero: ' + res.status + '\nstderr: ' + (res.stderr || '')
      );
      const out = res.stdout || '';
      // Engine block carries activated_skills line.
      assert.equal(
        out.indexOf('activated_skills: [Run Methodology]') !== -1,
        true,
        'expected activated_skills line in stdout; got: ' + out
      );
      assert.equal(
        out.indexOf('routing_source: engine') !== -1,
        true,
        'expected routing_source: engine; got: ' + out
      );
    } finally {
      fs.rmSync(fix.tmp, { recursive: true, force: true });
    }
  });

  run('Test 17: integration -- engine null/silent -> routing_source=legacy', () => {
    const fix = makeRoomsFixture('t17');
    try {
      const res = runHook(fix.root, {
        // Force engine to return null fire_skill + empty suppress.
        MOS_NAV_TEST_FIRE_SKILL: '__NULL__',
      });
      assert.equal(res.status === 0, true, 'classifier exit ' + res.status);
      const out = res.stdout || '';
      assert.equal(
        out.indexOf('routing_source: legacy') !== -1,
        true,
        'expected routing_source: legacy; got: ' + out
      );
    } finally {
      fs.rmSync(fix.tmp, { recursive: true, force: true });
    }
  });
} else {
  process.stdout.write(
    'skip Tests 16-17 (intent-classifier.cjs not yet integrated with router; gate clears in Task 2)\n'
  );
}

// ---------- Summary ----------

const total = passed + failed;
process.stdout.write('\nskill-activation-router.test: ' + passed + '/' + total + ' passed\n');
process.exit(failed === 0 ? 0 : 1);
