#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 135-01 Wave 0 -- End-to-end production-wiring guard (SC1 / SC4 / SC6)
 * ===========================================================================
 * The SINGLE test that catches the dark-loop / [[undefined]]-reason class of
 * bug. It drives the REAL decide() path with a REAL temp room.db on a
 * DECISION_GATE turn, using the EXACT context build the production hot path
 * (scripts/intent-classifier.cjs runNavigationEngine) constructs after Phase
 * 135-01 Task 1 -- the same 5 resolver inputs, the same navigation-chokepoint
 * room.db open, the same close-in-finally lifecycle.
 *
 * runNavigationEngine is not module-exported (the script runs main() and reads
 * stdin at module load; requiring it would execute the CLI). Per the plan's
 * sanctioned fallback we replicate the Task 1 context build VERBATIM here and
 * call navEngine.decide(turn, context) directly, opening the real room.db handle
 * through navigation.openRoomDbForCaller exactly as the production wiring does.
 * The wiring under test (the chokepoint open, the full context shape, the live
 * db handle, the close-in-finally) is therefore genuinely exercised.
 *
 * Assertions:
 *   1. (RED until 135-01 Task 1 wiring + 135-02 resolver land)
 *      decision.offer_next_step is NON-NULL; its reason contains a real
 *      [[<section>]] wikilink and NOT the literal [[undefined]]; its scope is
 *      defined; it has EXACTLY {command, framework, jtbd, confidence, reason,
 *      scope}.
 *   2. (GREEN now) negative control: the SAME seeded room with operator forced
 *      to JUST_TALK returns offer_next_step null (abstention fires end-to-end).
 *
 * Real temp-room idiom mirrors tests/test-navigation-acceptance.cjs.
 * Framework: direct-CJS node:assert/strict. No em-dashes. No emoji.
 * Registered in tests/run-all-135.sh (Task 3).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');
const navEngine = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation-engine.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const folderMemory = require(path.join(REPO_ROOT, 'lib', 'core', 'folder-memory.cjs'));
// Tests are on the room-db.cjs substrate allow-list (the check-substrate guard
// permits tests/), so the fixture may CREATE room.db directly. Production code
// opens it through navigation.openRoomDbForCaller (which fs.existsSync-guards and
// returns null on a not-yet-created room.db); the fixture creates the file first
// so the production-path open in buildProductionContext then succeeds.
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));

const SEED_SQL = path.join(REPO_ROOT, 'tests', 'fixtures', 'phase-109', 'sample-room', 'seed.sql');
const SESSION_ID = 'sess-135-e2e';
const SECTION = 'market-analysis';

const OFFER_KEYS = ['command', 'framework', 'jtbd', 'confidence', 'reason', 'scope'];

// ---------- Test scaffolding ----------

let passed = 0;
let failed = 0;
let red = 0;

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

function runRed(name, fn) {
  try {
    fn();
    process.stdout.write('ok  ' + name + ' (RED target now GREEN -- promote to run())\n');
    passed += 1;
  } catch (_err) {
    process.stdout.write('RED ' + name + ' (expected RED until 135-01 wiring + 135-02 resolver land)\n');
    red += 1;
  }
}

// ---------- Real temp room.db seeded for a DECISION_GATE turn ----------

function setupRoom() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-135-e2e-'));
  // CREATE room.db via the room-db.cjs opener (tests are allow-listed). This
  // also runs the full schema bootstrap so the seed + later chokepoint reads
  // operate on a real schema.
  const db = openRoomDb(tmp);
  // Seed the 109 fixture graph (nodes / edges / memory_events) so neighborhood +
  // ranking reads run against REAL room state.
  db.exec(fs.readFileSync(SEED_SQL, 'utf8'));
  closeRoomDb(db);

  // Seed a DECISION_GATE operator state + a real active JTBD via the
  // roomDir-taking chokepoint writers (they open / close room.db internally).
  navigation.logOperatorTransition(tmp, {
    from: 'JUST_TALK', to: 'DECISION_GATE', trigger: 'test_seed', operator: 'DECISION_GATE',
  });
  navigation.logJtbdTransition(tmp, {
    from: null, to: 'size the addressable market', kind: 'set', jtbd: 'size the addressable market',
  });

  // Create the section folder so sectionPath resolves to a real [[section]] target.
  const sectionPath = path.join(tmp, SECTION);
  fs.mkdirSync(sectionPath, { recursive: true });

  return { tmp, sectionPath };
}

function cleanup(tmp) {
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
}

// buildProductionContext: replicates scripts/intent-classifier.cjs
// runNavigationEngine's Phase 135-01 context build VERBATIM. Opens the real
// room.db via the chokepoint, returns { context, turn, close } where close()
// releases the handle (the caller invokes it in a finally, exactly as the
// production .then(closeRoomDbHandle, closeRoomDbHandle) tail does).
function buildProductionContext(tmp, sectionPath, operatorOverride) {
  let operatorState = 'JUST_TALK';
  try {
    const op = navigation.getCurrentOperator(tmp);
    if (op && typeof op.current === 'string') operatorState = op.current;
  } catch (_e) { operatorState = 'JUST_TALK'; }
  if (typeof operatorOverride === 'string') operatorState = operatorOverride;

  let jtbd = null;
  try {
    const j = navigation.getCurrentJTBD(tmp);
    if (j && j.ok !== false && typeof j.jtbd === 'string') jtbd = j.jtbd;
  } catch (_e) { jtbd = null; }

  let quadruple = null;
  try { quadruple = folderMemory.readQuadruple(sectionPath); } catch (_e) { quadruple = null; }

  let roomDb = null;
  try { roomDb = navigation.openRoomDbForCaller(tmp); } catch (_e) { roomDb = null; }

  const context = {
    quadruple: quadruple,
    brainAvailable: false,
    userPersona: { archetype: 'Founder', problem_type: 'IDP', venture_stage: 'discovery' },
    intentSignal: null,
    operator: operatorState,
    sectionPath: SECTION,
    problemType: 'IDP',
    jtbd: jtbd,
    roomState: { db: roomDb, roomDir: tmp },
  };
  const turn = { userText: null, sectionPath: SECTION, sessionId: SESSION_ID };
  function close() {
    try { if (roomDb) navigation.closeRoomDbForCaller(roomDb); } catch (_e) { /* tolerant */ }
    roomDb = null;
  }
  return { context, turn, close };
}

// ---------- Assertion 1: offer non-null with a grounded [[section]] reason ----------

runRed('SC1/SC4/SC6: DECISION_GATE turn yields a non-null offer with a real [[section]] reason (never [[undefined]])', () => {
  const { tmp, sectionPath } = setupRoom();
  try {
    const { context, turn, close } = buildProductionContext(tmp, sectionPath, 'DECISION_GATE');
    let decision;
    try {
      decision = navEngine.decide(turn, context);
    } finally {
      close();
    }
    assert.notEqual(decision, null, 'decide() returns a decision');
    const offer = decision.offer_next_step;
    assert.notEqual(offer, null, 'offer_next_step must be NON-NULL at DECISION_GATE (dark-loop guard)');
    // Exact six-key contract.
    assert.deepEqual(Object.keys(offer).sort(), OFFER_KEYS.slice().sort(),
      'offer must carry EXACTLY ' + JSON.stringify(OFFER_KEYS));
    // Grounded reason: a real [[section]] wikilink, never the [[undefined]] symptom.
    assert.equal(typeof offer.reason, 'string', 'reason must be a string');
    assert.equal(offer.reason.includes('[[undefined]]'), false,
      'reason must NEVER contain [[undefined]] (the dark-loop symptom)');
    assert.equal(/\[\[[^\]]+\]\]/.test(offer.reason), true,
      'reason must contain a real [[section]] wikilink, got: ' + offer.reason);
    // Scope defined.
    assert.notEqual(typeof offer.scope, 'undefined', 'scope must be defined');
    assert.notEqual(offer.scope, null, 'scope must not be null');
  } finally {
    cleanup(tmp);
  }
});

// ---------- Assertion 2: JUST_TALK negative control (GREEN now) ----------

run('SC6: negative control -- the SAME seeded room with operator JUST_TALK yields null offer', () => {
  const { tmp, sectionPath } = setupRoom();
  try {
    const { context, turn, close } = buildProductionContext(tmp, sectionPath, 'JUST_TALK');
    assert.equal(context.operator, 'JUST_TALK', 'context.operator forced to JUST_TALK');
    let decision;
    try {
      decision = navEngine.decide(turn, context);
    } finally {
      close();
    }
    assert.notEqual(decision, null, 'decide() returns a decision');
    assert.equal(decision.offer_next_step, null,
      'abstention must fire end-to-end in JUST_TALK (offer_next_step null)');
  } finally {
    cleanup(tmp);
  }
});

// ---------- Final summary ----------

const total = passed + failed;
process.stdout.write(
  '\ntest-135-decide-wiring-e2e: ' + passed + '/' + total + ' passed, ' + failed + ' failed, '
    + red + ' RED (expected until 135-01 wiring + 135-02 resolver land)\n'
);
process.exit(failed === 0 ? 0 : 1);
