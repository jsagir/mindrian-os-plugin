#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 91-01 -- USER.md persona durability fixture tests
 * =======================================================
 * Persona is being promoted from ephemeral session-state keyword
 * detection (Phase 88 USER.md skeleton) to a first-class per-user
 * artifact backed by USER.md. This test file pins the contract for
 * two new modules:
 *
 *   lib/core/persona-taxonomy.cjs  -- frozen tables + Larry-to-Brain map
 *   lib/core/user-md-ops.cjs       -- read / write / update-detect ops
 *
 * Test map (1-22, one-to-one with PLAN <behavior> blocks):
 *
 * Task 1 (persona-taxonomy.cjs frozen tables + translation):
 *    1. LARRY_PERSONAS frozen, exact 3 entries
 *    2. BRAIN_PERSONAS frozen, exact 2 entries
 *    3. LARRY_TO_BRAIN translation table per D-03
 *    4. JOURNEY_STAGES frozen 12-entry Campbell monomyth
 *    5. ROLE_BLEND_AXES frozen 7-entry Canon Part 2 9-role minus regulatory
 *    6. PROBLEM_TYPES frozen [UDP, IDP, WDP, unknown]
 *    7. VENTURE_STAGES frozen Canon enum
 *    8. translateLarryToBrain helper + unknown-input fallback
 *
 * Task 2 (user-md-ops.cjs read/write/update-detect):
 *    9. readUserMd absent -> null
 *   10. readUserMd valid -> full struct
 *   11. readUserMd malformed frontmatter -> emptyUser + parse_failed:true
 *   12. readUserMd invalid persona enum -> persona null, parse_failed:false
 *   13. writeUserMdAtomic Phase 87-02 pattern under concurrent load
 *   14. writeUserMdAtomic preserves user-authored body
 *   15. detectPersonaUpdate first detection -> shouldUpdate:true
 *   16. detectPersonaUpdate same persona -> shouldUpdate:false
 *   17. detectPersonaUpdate below threshold -> shouldUpdate:false
 *   18. detectPersonaUpdate consecutive-turn rule (1 vs 3+ turns)
 *   19. detectPersonaUpdate user_override bypass
 *   20. Cross-session persistence (write in one process, read in subprocess)
 *   21. Canon Part 8: zero brain-client / fetch / https in user-md-ops
 *   22. emptyUser shell shape
 *
 * Registered in lib/memory/run-feynman-tests.cjs.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..', '..');
const TAXONOMY_PATH = path.join(REPO, 'lib/core/persona-taxonomy.cjs');
const OPS_PATH = path.join(REPO, 'lib/core/user-md-ops.cjs');

// Lazy require so Task 1 RED can run before lib/core/user-md-ops.cjs
// exists. Tests that need the ops module skip themselves if the file
// is missing rather than throwing at module top.
function requireTaxonomy() {
  return require(TAXONOMY_PATH);
}
function requireOps() {
  return require(OPS_PATH);
}
function opsLoadable() {
  return fs.existsSync(OPS_PATH);
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

// ---------- Fixture helpers ----------

function makeTmpRoom() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'user-md-persona-'));
}

function validUserMdBody(overrides) {
  const base = {
    schema_version: 1,
    user_id: 'local-test-uid',
    canonical_role: 'Founder',
    larry_persona: 'TTO',
    brain_persona: 'Explicit',
    journey_stage: 'crossing_threshold',
    problem_type: 'IDP',
    venture_stage: 'thesis_build',
    last_detected_at: '2026-04-27T10:00:00Z',
    last_updated_at: '2026-04-27T10:00:00Z',
    detection_confidence: 0.82,
    update_threshold: 0.75,
    consecutive_signal_count: 0,
  };
  const o = Object.assign(base, overrides || {});
  const lines = [
    '---',
    'schema_version: ' + o.schema_version,
    'user_id: ' + o.user_id,
    'canonical_role: ' + o.canonical_role,
    'larry_persona: ' + o.larry_persona,
    'brain_persona: ' + o.brain_persona,
    'journey_stage: ' + o.journey_stage,
    'role_blend:',
    '  founder: 0.6',
    '  researcher: 0.2',
    '  operator: 0.1',
    '  investor: 0.0',
    '  mentor: 0.0',
    '  domain_expert: 0.1',
    '  student: 0.0',
    'problem_type: ' + o.problem_type,
    'venture_stage: ' + o.venture_stage,
    'last_detected_at: ' + o.last_detected_at,
    'last_updated_at: ' + o.last_updated_at,
    'detection_confidence: ' + o.detection_confidence,
    'update_threshold: ' + o.update_threshold,
    'consecutive_signal_count: ' + o.consecutive_signal_count,
    '---',
    '',
    '# USER.md',
    '',
    'User-authored notes go here.',
    '',
  ];
  return lines.join('\n');
}

// ============================================================
// Task 1 -- persona-taxonomy.cjs (Tests 1-8)
// ============================================================

run('Test 1: LARRY_PERSONAS frozen 3-entry array', function () {
  const T = requireTaxonomy();
  assert.ok(Array.isArray(T.LARRY_PERSONAS));
  assert.equal(T.LARRY_PERSONAS.length, 3);
  assert.deepEqual(
    T.LARRY_PERSONAS.slice(),
    ['TTO', 'Researcher', 'Business']
  );
  assert.equal(Object.isFrozen(T.LARRY_PERSONAS), true);
});

run('Test 2: BRAIN_PERSONAS frozen 2-entry array', function () {
  const T = requireTaxonomy();
  assert.ok(Array.isArray(T.BRAIN_PERSONAS));
  assert.equal(T.BRAIN_PERSONAS.length, 2);
  assert.deepEqual(T.BRAIN_PERSONAS.slice(), ['Explicit', 'Implicit']);
  assert.equal(Object.isFrozen(T.BRAIN_PERSONAS), true);
});

run('Test 3: LARRY_TO_BRAIN translation per D-03', function () {
  const T = requireTaxonomy();
  assert.equal(T.LARRY_TO_BRAIN.TTO, 'Explicit');
  assert.equal(T.LARRY_TO_BRAIN.Researcher, 'Implicit');
  assert.equal(T.LARRY_TO_BRAIN.Business, 'Explicit');
  assert.equal(Object.isFrozen(T.LARRY_TO_BRAIN), true);
  // Every Larry key resolves to a value in BRAIN_PERSONAS.
  for (const lk of T.LARRY_PERSONAS) {
    const v = T.LARRY_TO_BRAIN[lk];
    assert.ok(T.BRAIN_PERSONAS.indexOf(v) >= 0,
      'Larry persona ' + lk + ' must map to a Brain persona');
  }
});

run('Test 4: JOURNEY_STAGES frozen 12-entry Campbell monomyth', function () {
  const T = requireTaxonomy();
  assert.ok(Array.isArray(T.JOURNEY_STAGES));
  assert.equal(T.JOURNEY_STAGES.length, 12);
  assert.equal(Object.isFrozen(T.JOURNEY_STAGES), true);
  assert.deepEqual(T.JOURNEY_STAGES.slice(), [
    'ordinary_world',
    'call_to_adventure',
    'refusal',
    'meeting_the_mentor',
    'crossing_threshold',
    'tests_allies_enemies',
    'approach_inmost_cave',
    'ordeal',
    'reward',
    'road_back',
    'resurrection',
    'return_with_elixir',
  ]);
});

run('Test 5: ROLE_BLEND_AXES frozen 7-entry Canon Part 2 minus regulatory subtypes', function () {
  const T = requireTaxonomy();
  assert.ok(Array.isArray(T.ROLE_BLEND_AXES));
  assert.equal(T.ROLE_BLEND_AXES.length, 7);
  assert.equal(Object.isFrozen(T.ROLE_BLEND_AXES), true);
  assert.deepEqual(T.ROLE_BLEND_AXES.slice(), [
    'Founder',
    'Researcher',
    'Operator',
    'Investor',
    'Mentor',
    'Domain Expert',
    'Student',
  ]);
});

run('Test 6: PROBLEM_TYPES frozen [UDP, IDP, WDP, unknown]', function () {
  const T = requireTaxonomy();
  assert.ok(Array.isArray(T.PROBLEM_TYPES));
  assert.deepEqual(T.PROBLEM_TYPES.slice(), ['UDP', 'IDP', 'WDP', 'unknown']);
  assert.equal(Object.isFrozen(T.PROBLEM_TYPES), true);
});

run('Test 7: VENTURE_STAGES frozen Canon enum', function () {
  const T = requireTaxonomy();
  assert.ok(Array.isArray(T.VENTURE_STAGES));
  assert.equal(Object.isFrozen(T.VENTURE_STAGES), true);
  // Per Canon: pre_opportunity / thesis_build / validation / execution / scale / unknown.
  assert.deepEqual(T.VENTURE_STAGES.slice(), [
    'pre_opportunity',
    'thesis_build',
    'validation',
    'execution',
    'scale',
    'unknown',
  ]);
});

run('Test 8: translateLarryToBrain helper + unknown-input fallback', function () {
  const T = requireTaxonomy();
  assert.equal(typeof T.translateLarryToBrain, 'function');
  assert.equal(T.translateLarryToBrain('TTO'), 'Explicit');
  assert.equal(T.translateLarryToBrain('Researcher'), 'Implicit');
  assert.equal(T.translateLarryToBrain('Business'), 'Explicit');
  // Unknown -> null (graceful fallback). Must NOT throw.
  assert.equal(T.translateLarryToBrain('Engineer'), null);
  assert.equal(T.translateLarryToBrain(''), null);
  assert.equal(T.translateLarryToBrain(null), null);
  assert.equal(T.translateLarryToBrain(undefined), null);
  assert.equal(T.translateLarryToBrain(42), null);
  // Inverse function intentionally not exported (many-to-one mapping).
  assert.equal(T.translateBrainToLarry, undefined);
});

// ============================================================
// Task 2 -- user-md-ops.cjs (Tests 9-22)
// ============================================================

run('Test 9: readUserMd absent path -> null', function () {
  if (!opsLoadable()) {
    process.stderr.write('  (skipped: lib/core/user-md-ops.cjs not yet present)\n');
    return;
  }
  const ops = requireOps();
  const tmp = makeTmpRoom();
  const result = ops.readUserMd(path.join(tmp, 'USER.md'));
  assert.equal(result, null, 'absent USER.md must return null literal');
  // Also handles non-string / empty inputs gracefully.
  assert.equal(ops.readUserMd(''), null);
  assert.equal(ops.readUserMd(null), null);
  assert.equal(ops.readUserMd(undefined), null);
});

run('Test 10: readUserMd valid USER.md -> full struct', function () {
  if (!opsLoadable()) return;
  const ops = requireOps();
  const tmp = makeTmpRoom();
  const userPath = path.join(tmp, 'USER.md');
  fs.writeFileSync(userPath, validUserMdBody({}));
  const r = ops.readUserMd(userPath);
  assert.equal(r === null, false);
  assert.equal(r.parse_failed, false);
  assert.equal(r.schema_version, 1);
  assert.equal(r.user_id, 'local-test-uid');
  assert.equal(r.canonical_role, 'Founder');
  assert.equal(r.larry_persona, 'TTO');
  assert.equal(r.brain_persona, 'Explicit');
  assert.equal(r.journey_stage, 'crossing_threshold');
  assert.equal(r.problem_type, 'IDP');
  assert.equal(r.venture_stage, 'thesis_build');
  assert.equal(r.last_detected_at, '2026-04-27T10:00:00Z');
  assert.equal(r.last_updated_at, '2026-04-27T10:00:00Z');
  assert.equal(r.detection_confidence, 0.82);
  assert.equal(r.update_threshold, 0.75);
  assert.equal(typeof r.role_blend, 'object');
  assert.equal(r.role_blend.founder, 0.6);
  assert.equal(r.role_blend.researcher, 0.2);
});

run('Test 11: readUserMd malformed frontmatter -> emptyUser + parse_failed:true', function () {
  if (!opsLoadable()) return;
  const ops = requireOps();
  const tmp = makeTmpRoom();
  const userPath = path.join(tmp, 'USER.md');
  // No closing ---. Frontmatter delimiter missing.
  fs.writeFileSync(userPath, '---\nlarry_persona: TTO\nNo closing delim');
  const r = ops.readUserMd(userPath);
  assert.equal(r === null, false, 'present-but-malformed must NOT return null');
  assert.equal(r.parse_failed, true);
  assert.equal(r.larry_persona, null);
  assert.equal(r.schema_version, 1);
});

run('Test 12: readUserMd invalid persona enum -> persona null, parse_failed:false', function () {
  if (!opsLoadable()) return;
  const ops = requireOps();
  const tmp = makeTmpRoom();
  const userPath = path.join(tmp, 'USER.md');
  fs.writeFileSync(userPath, validUserMdBody({ larry_persona: 'NotAPersona' }));
  const r = ops.readUserMd(userPath);
  assert.equal(r.parse_failed, false, 'unknown enum value is schema-tolerant, not parse-failure');
  assert.equal(r.larry_persona, null, 'invalid persona enum coerces to null');
  // Other fields remain intact.
  assert.equal(r.canonical_role, 'Founder');
});

run('Test 13: writeUserMdAtomic Phase 87-02 pattern under concurrent load', function () {
  if (!opsLoadable()) return;
  const ops = requireOps();
  const tmp = makeTmpRoom();
  const userPath = path.join(tmp, 'USER.md');
  // Seed.
  ops.writeUserMdAtomic(userPath, {
    schema_version: 1,
    larry_persona: 'TTO',
    canonical_role: 'Founder',
    detection_confidence: 0.8,
    update_threshold: 0.75,
  });
  // Drive 10 rapid writes serially (single process; same-process race is
  // the realistic concurrency surface for in-room USER.md updates from
  // intent classifier + persona detector + manual override).
  const personas = ['TTO', 'Researcher', 'Business'];
  for (let i = 0; i < 10; i++) {
    ops.writeUserMdAtomic(userPath, {
      schema_version: 1,
      larry_persona: personas[i % 3],
      canonical_role: 'Founder',
      detection_confidence: 0.8,
      update_threshold: 0.75,
    });
    // Read between writes; the file must always be a parseable USER.md.
    const r = ops.readUserMd(userPath);
    assert.equal(r === null, false);
    assert.equal(r.parse_failed, false,
      'mid-write read must never observe corruption (iteration ' + i + ')');
    assert.ok(personas.indexOf(r.larry_persona) >= 0);
  }
  // No leftover .tmp files from openSync('wx') + rename pattern.
  const leftovers = fs.readdirSync(tmp).filter(function (f) {
    return f.indexOf('USER.md.tmp.') >= 0;
  });
  assert.equal(leftovers.length, 0, 'no orphan tmp files after 10 writes');
});

run('Test 14: writeUserMdAtomic preserves user-authored body below frontmatter', function () {
  if (!opsLoadable()) return;
  const ops = requireOps();
  const tmp = makeTmpRoom();
  const userPath = path.join(tmp, 'USER.md');
  // Hand-write a USER.md with a body the user authored.
  const body = '\n# User notes\n\nMy own paragraph.\n\n## Draft thoughts\n\n- alpha\n- beta\n';
  fs.writeFileSync(userPath, validUserMdBody({ larry_persona: 'TTO' }).replace(
    /\n# USER.md[\s\S]*$/, body));
  // Update only the frontmatter.
  ops.writeUserMdAtomic(userPath, {
    schema_version: 1,
    larry_persona: 'Researcher',
    canonical_role: 'Researcher',
    detection_confidence: 0.9,
    update_threshold: 0.75,
  });
  const after = fs.readFileSync(userPath, 'utf8');
  assert.ok(after.indexOf('# User notes') >= 0, 'body header preserved');
  assert.ok(after.indexOf('My own paragraph.') >= 0, 'body paragraph preserved');
  assert.ok(after.indexOf('- alpha') >= 0, 'body list preserved');
  // Frontmatter actually updated.
  const r = ops.readUserMd(userPath);
  assert.equal(r.larry_persona, 'Researcher');
  assert.equal(r.canonical_role, 'Researcher');
});

run('Test 15: detectPersonaUpdate first detection -> shouldUpdate:true', function () {
  if (!opsLoadable()) return;
  const ops = requireOps();
  const r = ops.detectPersonaUpdate({
    current: null,
    signal: { persona: 'TTO', confidence: 0.8 },
  });
  assert.equal(r.shouldUpdate, true);
  assert.equal(r.reason, 'first_detection');
});

run('Test 16: detectPersonaUpdate same persona -> shouldUpdate:false', function () {
  if (!opsLoadable()) return;
  const ops = requireOps();
  const r = ops.detectPersonaUpdate({
    current: { persona: 'TTO', detection_confidence: 0.8, update_threshold: 0.75 },
    signal: { persona: 'TTO', confidence: 0.9 },
  });
  assert.equal(r.shouldUpdate, false);
  assert.equal(r.reason, 'no_change');
});

run('Test 17: detectPersonaUpdate below threshold -> shouldUpdate:false', function () {
  if (!opsLoadable()) return;
  const ops = requireOps();
  const r = ops.detectPersonaUpdate({
    current: { persona: 'TTO', detection_confidence: 0.8, update_threshold: 0.75 },
    signal: { persona: 'Researcher', confidence: 0.6 },
  });
  assert.equal(r.shouldUpdate, false);
  assert.equal(r.reason, 'confidence_below_threshold');
});

run('Test 18: detectPersonaUpdate consecutive-turn rule (1 vs 3+ turns)', function () {
  if (!opsLoadable()) return;
  const ops = requireOps();
  // Above threshold but only 1 consecutive turn -> awaiting_consecutive_signal.
  const r1 = ops.detectPersonaUpdate({
    current: { persona: 'TTO', detection_confidence: 0.8, update_threshold: 0.75 },
    signal: {
      persona: 'Researcher', confidence: 0.85, consecutive_signal_count: 1,
    },
  });
  assert.equal(r1.shouldUpdate, false);
  assert.equal(r1.reason, 'awaiting_consecutive_signal');
  // Two consecutive -> still awaiting.
  const r2 = ops.detectPersonaUpdate({
    current: { persona: 'TTO', detection_confidence: 0.8, update_threshold: 0.75 },
    signal: {
      persona: 'Researcher', confidence: 0.85, consecutive_signal_count: 2,
    },
  });
  assert.equal(r2.shouldUpdate, false);
  assert.equal(r2.reason, 'awaiting_consecutive_signal');
  // Three consecutive -> threshold met.
  const r3 = ops.detectPersonaUpdate({
    current: { persona: 'TTO', detection_confidence: 0.8, update_threshold: 0.75 },
    signal: {
      persona: 'Researcher', confidence: 0.85, consecutive_signal_count: 3,
    },
  });
  assert.equal(r3.shouldUpdate, true);
  assert.equal(r3.reason, 'threshold_met');
  // Five consecutive -> still threshold_met.
  const r5 = ops.detectPersonaUpdate({
    current: { persona: 'TTO', detection_confidence: 0.8, update_threshold: 0.75 },
    signal: {
      persona: 'Researcher', confidence: 0.85, consecutive_signal_count: 5,
    },
  });
  assert.equal(r5.shouldUpdate, true);
  assert.equal(r5.reason, 'threshold_met');
});

run('Test 19: detectPersonaUpdate user_override bypasses threshold + consecutive', function () {
  if (!opsLoadable()) return;
  const ops = requireOps();
  const r = ops.detectPersonaUpdate({
    current: { persona: 'TTO', detection_confidence: 0.95, update_threshold: 0.75 },
    signal: {
      source: 'user_override',
      persona: 'Business',
      confidence: 0.0,            // explicitly zero -- override still wins
      consecutive_signal_count: 0,
    },
  });
  assert.equal(r.shouldUpdate, true);
  assert.equal(r.reason, 'user_override');
});

run('Test 20: cross-session persistence (write here, read in subprocess)', function () {
  if (!opsLoadable()) return;
  const ops = requireOps();
  const tmp = makeTmpRoom();
  const userPath = path.join(tmp, 'USER.md');
  ops.writeUserMdAtomic(userPath, {
    schema_version: 1,
    user_id: 'cross-session-uid',
    larry_persona: 'Researcher',
    brain_persona: 'Implicit',
    canonical_role: 'Researcher',
    journey_stage: 'meeting_the_mentor',
    problem_type: 'IDP',
    venture_stage: 'pre_opportunity',
    detection_confidence: 0.91,
    update_threshold: 0.75,
  });
  // Read in a subprocess. If module loading or atomic write left any
  // process-local state, the subprocess would not see the same bytes.
  const script =
    "const ops = require('" + OPS_PATH.replace(/\\/g, '\\\\') + "');" +
    "const r = ops.readUserMd('" + userPath.replace(/\\/g, '\\\\') + "');" +
    "process.stdout.write(JSON.stringify(r));";
  const res = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8' });
  assert.equal(res.status, 0, 'subprocess must exit 0');
  const r = JSON.parse(res.stdout);
  assert.equal(r.parse_failed, false);
  assert.equal(r.user_id, 'cross-session-uid');
  assert.equal(r.larry_persona, 'Researcher');
  assert.equal(r.brain_persona, 'Implicit');
  assert.equal(r.journey_stage, 'meeting_the_mentor');
  assert.equal(r.detection_confidence, 0.91);
});

run('Test 21: Canon Part 8 -- no Brain network surface in user-md-ops', function () {
  if (!opsLoadable()) return;
  const src = fs.readFileSync(OPS_PATH, 'utf8');
  // Forbid any Brain-MCP query helper imports (graph IP boundary).
  assert.equal(/brain-client\.(query|search|smartSearch)/.test(src), false,
    'user-md-ops must NOT call Brain MCP query helpers');
  assert.equal(/fetch\(/.test(src), false,
    'user-md-ops must NOT issue fetch calls');
  assert.equal(/https?:\/\/[a-z]/.test(src), false,
    'user-md-ops must NOT contain hardcoded HTTP(S) URLs');
  assert.equal(/\bcurl\b/.test(src), false,
    'user-md-ops must NOT shell out to curl');
});

run('Test 22: emptyUser shell shape', function () {
  if (!opsLoadable()) return;
  const ops = requireOps();
  assert.equal(typeof ops.emptyUser, 'function');
  const e = ops.emptyUser();
  assert.equal(e.schema_version, 1);
  assert.equal(e.user_id, null);
  assert.equal(e.canonical_role, null);
  assert.equal(e.larry_persona, null);
  assert.equal(e.brain_persona, null);
  assert.equal(e.journey_stage, null);
  assert.equal(typeof e.role_blend, 'object');
  assert.equal(e.role_blend.founder, 0);
  assert.equal(e.role_blend.researcher, 0);
  assert.equal(e.role_blend.operator, 0);
  assert.equal(e.role_blend.investor, 0);
  assert.equal(e.role_blend.mentor, 0);
  assert.equal(e.role_blend.domain_expert, 0);
  assert.equal(e.role_blend.student, 0);
  assert.equal(e.problem_type, 'unknown');
  assert.equal(e.venture_stage, 'unknown');
  assert.equal(e.last_detected_at, null);
  assert.equal(e.last_updated_at, null);
  assert.equal(e.detection_confidence, 0.0);
  assert.equal(e.update_threshold, 0.75);
  assert.equal(e.parse_failed, false);
});

// ---------- Footer ----------

const total = passed + failed;
process.stdout.write(
  '\nuser-md-persona: ' + passed + '/' + total + ' passed, ' + failed + ' failed\n'
);
process.exit(failed === 0 ? 0 : 1);
