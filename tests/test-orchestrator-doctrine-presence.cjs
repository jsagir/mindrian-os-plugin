'use strict';
/*
 * Phase 143.3-04 Task 2 -- the orchestrator doctrine-presence gate (ORCH-01..04).
 *
 * Mirrors the 143.2 doctrine-presence-gate idiom: load the skill prose and assert
 * each requirement is PRESENT as doctrine. A dropped requirement (Repudiation
 * threat T-143.3-16) fails the gate.
 *
 * The file under test: skills/intelligence-orchestrator/SKILL.md (Plan 03).
 *
 *   ORCH-01: reads data/connector-registry.json AND states it reads the registry,
 *            not a hardcoded table.
 *   ORCH-02: the 5-step loop -- dispatchSensors, the dispatch-framework map / WFL-01
 *            translation, the Intelligence Hierarchy
 *            (Tensions > Bottlenecks > HSI Surprises > Convergences > Blind Spots),
 *            the never-fire Decision Gate, and commandsForFramework.
 *   ORCH-03: filing names fileEvidenceWithReadback, wireAccept (fallback),
 *            surfaceFileEvidenceResult, memory_event, and a cascade edge.
 *   ORCH-04: the tier predicate (tier_0 degrade / mode_a / mode_b), Phase 144
 *            coexistence (engine-side vs prompt-side, one-reach-per-beat), and
 *            room-proactive coexistence.
 *
 * Plus the canonical fence: the frozen 6 reach_ids + the frozen 3 postures appear,
 * and NO 7th reach id string appears (Phase 148 D-09 raised 5 -> 6). Plus zero
 * em-dashes in the skill.
 *
 * Prints per-requirement PASS/FAIL; exits non-zero on any miss.
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills', 'intelligence-orchestrator', 'SKILL.md');

const FROZEN_REACH_IDS = ['context_block', 'contradiction', 'cross_room', 'brain_consult', 'deep_research', 'hats'];
const FROZEN_POSTURE_IDS = ['push_forward', 'hold', 'pull_back'];

const src = fs.readFileSync(SKILL_PATH, 'utf8');
const lc = src.toLowerCase();

let passed = 0;
let failed = 0;
function check(name, fn) {
  try {
    fn();
    passed += 1;
    process.stdout.write('  PASS ' + name + '\n');
  } catch (e) {
    failed += 1;
    process.stdout.write('  FAIL ' + name + '\n');
    process.stdout.write('    ' + (e.message || String(e)) + '\n');
  }
}
function has(needle, msg) { assert.ok(src.indexOf(needle) !== -1, msg); }
function hasLc(needle, msg) { assert.ok(lc.indexOf(needle) !== -1, msg); }

// ---------------------------------------------------------------------------
// ORCH-01 -- registry is the table (not a hardcoded routing table)
// ---------------------------------------------------------------------------
check('ORCH-01 - reads data/connector-registry.json, not a hardcoded table', function () {
  has('data/connector-registry.json',
    'ORCH-01: must reference data/connector-registry.json');
  assert.ok(/never a hardcoded( routing)? table/i.test(src) || /reads the registry; never a hardcoded/i.test(src),
    'ORCH-01: must state it reads the registry, not a hardcoded table');
  hasLc('sensor_index',
    'ORCH-01: must name the sensor_index inverse map the dispatcher keys on');
});

// ---------------------------------------------------------------------------
// ORCH-02 -- the 5-step loop
// ---------------------------------------------------------------------------
check('ORCH-02 - the 5-step loop (dispatchSensors, WFL-01 map, hierarchy, never-fire gate, commandsForFramework)', function () {
  has('dispatchSensors', 'ORCH-02: must name dispatchSensors (STEP 1, read the spine LIVE)');
  has('dispatch-framework-map', 'ORCH-02: must name the dispatch-framework map (STEP 2 translation)');
  has('WFL-01', 'ORCH-02: must name the WFL-01 guard (slug-to-name translation)');
  has('Tensions > Bottlenecks > HSI Surprises > Convergences > Blind Spots',
    'ORCH-02: must carry the Intelligence Hierarchy ordering (STEP 3)');
  assert.ok(/never auto-?fire/i.test(src) || /offer,? never fire/i.test(src),
    'ORCH-02: must state the never-fire Decision Gate (STEP 4 offer never fire)');
  has('Decision Gate', 'ORCH-02: must surface the reach as a Decision Gate (STEP 4)');
  has('commandsForFramework', 'ORCH-02: must resolve via commandsForFramework on APPROVE (STEP 5)');
});

// ---------------------------------------------------------------------------
// ORCH-03 -- filing
// ---------------------------------------------------------------------------
check('ORCH-03 - filing (fileEvidenceWithReadback, wireAccept fallback, surfaceFileEvidenceResult, memory_event, cascade edge)', function () {
  has('fileEvidenceWithReadback', 'ORCH-03: must name fileEvidenceWithReadback (primary filing path)');
  has('wireAccept', 'ORCH-03: must name wireAccept (the filing fallback)');
  has('surfaceFileEvidenceResult', 'ORCH-03: must name surfaceFileEvidenceResult (FILEVAL honesty remind)');
  has('memory_event', 'ORCH-03: must name memory_event (every decision becomes a memory_event)');
  hasLc('cascade edge', 'ORCH-03: must name the typed cascade edge (Part 4 / Part 9)');
});

// ---------------------------------------------------------------------------
// ORCH-04 -- tier predicate + Phase 144 coexistence + room-proactive coexistence
// ---------------------------------------------------------------------------
check('ORCH-04 - tier predicate (tier_0/mode_a/mode_b) + Phase 144 coexistence (engine-side vs prompt-side) + room-proactive', function () {
  has('tier_0', 'ORCH-04: must name the tier_0 degrade floor');
  has('mode_a', 'ORCH-04: must name mode_a (live authoritative tier)');
  has('mode_b', 'ORCH-04: must name mode_b (live authoritative tier)');
  has('Phase 144', 'ORCH-04: must name Phase 144 coexistence');
  assert.ok(/engine-?side/i.test(src) && /prompt-?side/i.test(src),
    'ORCH-04: must distinguish the engine-side (144) from the prompt-side (this skill) consumer');
  has('one-reach-per-beat', 'ORCH-04: must state one-reach-per-beat arbitration');
  has('room-proactive', 'ORCH-04: must state room-proactive coexistence');
});

// ---------------------------------------------------------------------------
// The canonical fence -- frozen 6 reaches + frozen 3 postures + NO 7th reach
// ---------------------------------------------------------------------------
check('FENCE - the frozen 6 reach_ids all appear', function () {
  for (const r of FROZEN_REACH_IDS) {
    has('`' + r + '`', 'FENCE: reach_id `' + r + '` must appear as a code-span token in the doctrine');
  }
});

check('FENCE - the frozen 3 postures all appear', function () {
  for (const p of FROZEN_POSTURE_IDS) {
    has('`' + p + '`', 'FENCE: posture `' + p + '` must appear as a code-span token in the doctrine');
  }
});

check('FENCE - the no-7th-reach rule is stated', function () {
  assert.ok(/(no|never)( a)? 7th reach/i.test(src),
    'FENCE: the doctrine must explicitly forbid a 7th reach_id (the canonical fence; Phase 148 D-09 raised the floor from 6th to 7th)');
});

// ---------------------------------------------------------------------------
// House rule -- zero em-dashes in the skill under test
// ---------------------------------------------------------------------------
check('HYGIENE - zero em-dashes in the orchestrator skill', function () {
  const EM_DASH = String.fromCharCode(0x2014);
  const count = (src.split(EM_DASH).length - 1);
  assert.equal(count, 0, 'HYGIENE: the orchestrator skill must carry zero em-dashes (found ' + count + ')');
});

process.stdout.write('\n');
process.stdout.write('orchestrator doctrine-presence gate: ' + passed + ' passed, ' + failed + ' failed (ORCH-01..04 + fence)\n');
process.exit(failed === 0 ? 0 : 1);
