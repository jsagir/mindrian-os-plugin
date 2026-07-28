'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick task 260728-8av -- the production-trigger proof for the Phase 222 Hedge
 * outcome-learning fold, per RCA .planning/debug/resolved/hedge-fold-has-no-
 * production-trigger.md.
 * ============================================================================
 * The RCA found that maybeUpdateHedgeWeights had never fired in production:
 * ctx.roomDb was threaded into decide() from exactly one place repo-wide, and
 * that place was a test. This file is the RCA's own Test 1 (a production
 * call-site census, or a reachable explicit entry point) and Test 2 (an
 * end-to-end refit proof), plus the debounce and write-free controls that make
 * both non-vacuous.
 *
 * ARM 1's exclusion of tests/ from the census is the load-bearing part: the
 * RCA's own note documents that a test-only honorer makes such a gate
 * vacuous, which is exactly the failure mode that let this ship for a whole
 * phase lifetime. PRECONDITION B proves the exclusion actually removes a real
 * hit rather than being decorative.
 *
 * Plain CJS node:assert/strict; PASS line + non-zero exit on failure.
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const ranker = require(path.join(REPO_ROOT, 'lib', 'workflow', 'reach-hedge-ranker.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const { runHedgeRefit } = require(path.join(REPO_ROOT, 'scripts', 'hedge-refit-pipeline.cjs'));

// Deterministic N: prove the SHIPPED default boundary, never an ambient env.
delete process.env.MINDRIAN_HEDGE_UPDATE_N;
delete process.env.MINDRIAN_HEDGE_ETA;

const N = ranker.HEDGE_UPDATE_N_DEFAULT;
const REACH_IDS = ranker.REACH_IDS;

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ok - ' + name);
}

console.log('test-222-fold-wired.cjs: production trigger for the Hedge outcome-learning fold (RCA hedge-fold-has-no-production-trigger)');

// ---------------------------------------------------------------------------
// Shared source-census machinery for ARM 1.
// ---------------------------------------------------------------------------

// Strip whole-line comments the same grep-gate-hygiene idiom run-all-222.sh
// uses, so header prose can never trip or mask an assertion.
function stripComments(src) {
  return src
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join('\n');
}

const CENSUS_ROOTS = ['lib', 'scripts', 'hooks', 'bin', 'commands', 'agents'];
const EXCLUDE_SEGMENTS = ['node_modules', 'tests', '.git', 'editor-dist', 'editor-src'];

function pathHasExcludedSegment(relPath) {
  const segs = relPath.split(path.sep);
  return segs.some((s) => EXCLUDE_SEGMENTS.indexOf(s) !== -1);
}

function walk(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_e) {
    return; // a listed root that does not exist in this checkout is skipped, not fatal
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(REPO_ROOT, full);
    if (pathHasExcludedSegment(rel)) continue;
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (entry.isFile() && (full.endsWith('.cjs') || full.endsWith('.js'))) {
      out.push(full);
    }
  }
}

function collectSourceFiles() {
  const out = [];
  for (const root of CENSUS_ROOTS) {
    walk(path.join(REPO_ROOT, root), out);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Fixture helpers (throwaway temp rooms; never a real room).
// ---------------------------------------------------------------------------

const tempDirs = [];
function newRoomDir(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

// Cleanup on 'exit' rather than only after the last check: an assertion
// failure throws synchronously and skips any cleanup written after the
// checks, but the process still fires 'exit' before it terminates, so temp
// rooms are removed on both the pass and the fail path.
process.on('exit', () => {
  for (const dir of tempDirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch (_e) {
      /* best effort */
    }
  }
});

function seedFoldableRoom(db, count) {
  const n = typeof count === 'number' ? count : N;
  for (let i = 0; i < n; i += 1) {
    const res = navigation.logMemoryEvent(db, 'f_selector_decision', {
      reach_id: REACH_IDS[0],
      decision: 'reject',
    });
    assert.ok(res && res.ok, 'seed row must log, got ' + JSON.stringify(res));
  }
}

// ---------------------------------------------------------------------------
// ARM 1: THE CENSUS (RCA Test 1). At least one production (non-tests/) site
// threads ctx.roomDb into decide(), OR the explicit refit entry point exists
// and is reachable. Either half discharges the "has a production trigger"
// requirement; a future Option-A-style change that threads the handle must
// still be allowed to satisfy this gate without editing it.
// ---------------------------------------------------------------------------
check('ARM 1 CENSUS: a production roomDb threader exists, OR the explicit refit entry point is reachable', () => {
  const files = collectSourceFiles();
  assert.ok(files.length > 0, 'PRECONDITION: the source walk must find at least one file under ' + CENSUS_ROOTS.join(', '));

  const decideReachers = [];
  const roomDbThreaders = [];
  for (const file of files) {
    let src;
    try {
      src = fs.readFileSync(file, 'utf8');
    } catch (_e) {
      continue;
    }
    const stripped = stripComments(src);
    if (/\bdecideFn\s*\(|\.decide\s*\(|_loadDecide\s*\(/.test(stripped)) {
      decideReachers.push(file);
    }
    if (/(?:^|[{,(\s])roomDb\s*:/.test(stripped)) {
      roomDbThreaders.push(file);
    }
  }

  // PRECONDITION A: the walker must actually find the indirect decide() reach
  // (scripts/intent-classifier.cjs's decideFn seam, lib/core/chain-executor.cjs).
  // A literal `.decide(` census over production source finds ZERO hits (every
  // one is inside a comment), so this precondition fails loudly if the walker
  // itself is broken, rather than passing vacuously on an empty set.
  assert.ok(decideReachers.length >= 1,
    'PRECONDITION A FAILED: the walker found no decide()-reaching file at all; the census machinery itself is broken. ' +
    'Checked roots: ' + CENSUS_ROOTS.join(', '));

  // PRECONDITION B, the RCA-mandated anti-vacuous guard. tests/test-222-reach-
  // wired.cjs threads ctx.roomDb (read directly, not via the walk, since tests/
  // is excluded from the walk by design) and it must match the SAME pattern the
  // census uses, proving the pattern itself is not miswritten.
  const reachWiredPath = path.join(REPO_ROOT, 'tests', 'test-222-reach-wired.cjs');
  const reachWiredSrc = stripComments(fs.readFileSync(reachWiredPath, 'utf8'));
  assert.ok(/(?:^|[{,(\s])roomDb\s*:/.test(reachWiredSrc),
    'PRECONDITION B FAILED: tests/test-222-reach-wired.cjs no longer matches the roomDb: pattern the census uses; ' +
    'the pattern itself may have drifted.');

  // And no entry in the actual census (which excludes tests/) has a tests/ path.
  // This proves the exclusion actually removed a real hit rather than being
  // decorative: without it, the existing test-only honorer would satisfy the
  // gate by itself, which is the exact failure mode that let the fold ship
  // silently unreachable for a whole phase lifetime.
  const testPathsInCensus = roomDbThreaders.filter((f) => pathHasExcludedSegment(path.relative(REPO_ROOT, f)));
  assert.strictEqual(testPathsInCensus.length, 0,
    'PRECONDITION B FAILED: a tests/ path entered the production census: ' + JSON.stringify(testPathsInCensus) +
    '. The census exclusion is not load-bearing.');

  // entryPointReachable: the explicit navigator-triggered refit entry point
  // exists, exports a callable runHedgeRefit, actually calls the shipped fold,
  // and carries a CLI.
  let entryPointReachable = false;
  const entryPath = path.join(REPO_ROOT, 'scripts', 'hedge-refit-pipeline.cjs');
  if (fs.existsSync(entryPath)) {
    const mod = require(entryPath);
    const entrySrc = stripComments(fs.readFileSync(entryPath, 'utf8'));
    entryPointReachable = typeof mod.runHedgeRefit === 'function'
      && /maybeUpdateHedgeWeights\s*\(/.test(entrySrc)
      && /require\.main\s*===\s*module/.test(entrySrc);
  }

  // Log both sides so a future reader sees which half of the disjunction is
  // actually carrying the gate.
  console.log('    [census] production roomDb threaders (tests/ excluded): ' + roomDbThreaders.length +
    (roomDbThreaders.length ? ' -> ' + roomDbThreaders.map((f) => path.relative(REPO_ROOT, f)).join(', ') : ''));
  console.log('    [census] explicit refit entry point reachable: ' + entryPointReachable);

  // MAIN assertion. Deliberately NOT roomDbThreaders.length === 0: a future
  // Option-A-style change that threads the handle into a production caller
  // must be allowed to satisfy this gate without editing this test.
  assert.ok(roomDbThreaders.length >= 1 || entryPointReachable,
    'BORN-UNWIRED BREACH: neither a production roomDb threader nor a reachable explicit refit entry point exists. ' +
    'roomDbThreaders=' + roomDbThreaders.length + ' entryPointReachable=' + entryPointReachable);
});

// ---------------------------------------------------------------------------
// ARM 2: END-TO-END REFIT (RCA Test 2). The PRODUCTION path, not a direct call.
// ---------------------------------------------------------------------------
check('ARM 2 END-TO-END: runHedgeRefit against a room with >= N qualifying rows folds and persists', () => {
  const roomDir = newRoomDir('fold-wired-e2e-');
  const seedDb = openRoomDb(roomDir);
  try {
    seedFoldableRoom(seedDb, N);
  } finally {
    closeRoomDb(seedDb);
  }

  // The PRODUCTION path: runHedgeRefit opens its OWN handle through the
  // chokepoint. maybeUpdateHedgeWeights is never called directly in this arm,
  // that is already covered by tests/test-222-hedge-update.cjs behavior 3;
  // calling it here would prove nothing about the wiring.
  const out = runHedgeRefit(roomDir);
  assert.strictEqual(out.ok, true, 'runHedgeRefit must report ok:true, got ' + JSON.stringify(out));
  assert.strictEqual(out.updated, true, 'a >= N seeded room must report updated:true, got ' + JSON.stringify(out));

  const probeDb = openRoomDb(roomDir);
  try {
    const state = navigation.readHedgeWeightState(probeDb);
    assert.ok(state, 'weight state must exist on disk after the production refit');
    assert.strictEqual(state.updateCount, 1, 'updateCount must advance to 1, got ' + state.updateCount);
    assert.ok(state.weights.registry_order < state.weights.d4_blend,
      'the consistently-wrong registry expert must lose weight; got ' + JSON.stringify(state.weights));
  } finally {
    closeRoomDb(probeDb);
  }
});

// ---------------------------------------------------------------------------
// ARM 3: DEBOUNCE CONTROL. Makes ARM 2 non-vacuous: N-1 rows must not fold.
// ---------------------------------------------------------------------------
check('ARM 3 DEBOUNCE CONTROL: runHedgeRefit against N-1 rows reports updated:false and persists nothing', () => {
  const roomDir = newRoomDir('fold-wired-debounce-');
  const seedDb = openRoomDb(roomDir);
  try {
    seedFoldableRoom(seedDb, N - 1);
  } finally {
    closeRoomDb(seedDb);
  }

  const out = runHedgeRefit(roomDir);
  assert.strictEqual(out.ok, true, 'below-debounce must still report ok:true, got ' + JSON.stringify(out));
  assert.strictEqual(out.updated, false,
    'VACUOUS-GREEN RISK: N-1 rows must NOT fold, or ARM 2 proves nothing; got ' + JSON.stringify(out));

  const probeDb = openRoomDb(roomDir);
  try {
    assert.strictEqual(navigation.readHedgeWeightState(probeDb), null,
      'below-debounce must persist nothing, got a weight state');
  } finally {
    closeRoomDb(probeDb);
  }
});

// ---------------------------------------------------------------------------
// ARM 4: THE HOT PATH IS WRITE-FREE. Pins the "never on the write path"
// discipline: a ranking call, in ANY mode, must never persist a weight state,
// even on a genuinely foldable room. The control (runHedgeRefit on the SAME
// room afterward DOES fold) proves the room was foldable and the ranking call
// simply declined, rather than the fixture having nothing to fold.
// ---------------------------------------------------------------------------
check('ARM 4 WRITE-FREE HOT PATH: rankFiredCandidates writes nothing even on a foldable room; runHedgeRefit still can', () => {
  const roomDir = newRoomDir('fold-wired-hotpath-');
  const db = openRoomDb(roomDir);
  let closed = false;
  try {
    seedFoldableRoom(db, N);

    // NO readOnly flag: this is the default (and only remaining) ranking mode
    // now that step (i) is removed. It must not fold regardless.
    const pair = [{ reach_id: REACH_IDS[0] }, { reach_id: REACH_IDS[1] }];
    const out = ranker.rankFiredCandidates(pair, { db: db });
    assert.ok(Array.isArray(out) && out.length === 2,
      'the ranking call must still return both candidates; got ' + JSON.stringify(out));
    assert.strictEqual(navigation.readHedgeWeightState(db), null,
      'WRITE LEAK: rankFiredCandidates persisted a Hedge weight state on the hot path');
  } finally {
    closeRoomDb(db);
    closed = true;
  }
  assert.ok(closed, 'the ranking-call handle must be closed before the control runs');

  // CONTROL: the same room, through the production refit entry point, DOES
  // fold. Without this control, ARM 4 would pass on an unfoldable fixture too.
  const controlOut = runHedgeRefit(roomDir);
  assert.strictEqual(controlOut.updated, true,
    'VACUOUS-GREEN RISK: the control refit did not fold, so ARM 4 proves nothing about the fixture; got ' +
    JSON.stringify(controlOut));
});

// ---------------------------------------------------------------------------
// ARM 5: NO ROOM DB. A Tier 0 room reports skipped, never throws, never
// creates .mindrian/. The whole point of openRoomDbForCaller over openRoomDb
// is that it refuses to create.
// ---------------------------------------------------------------------------
check('ARM 5 NO ROOM DB: an empty directory reports skipped:no_room_db and never creates .mindrian/', () => {
  const dir = newRoomDir('fold-wired-empty-');
  const out = runHedgeRefit(dir);
  assert.strictEqual(out.ok, true, 'a Tier 0 room is an environment fact, not a failure; got ' + JSON.stringify(out));
  assert.strictEqual(out.updated, false, 'a Tier 0 room cannot have updated anything; got ' + JSON.stringify(out));
  assert.strictEqual(out.skipped, 'no_room_db', 'a Tier 0 room must report skipped:no_room_db; got ' + JSON.stringify(out));
  assert.strictEqual(fs.existsSync(path.join(dir, '.mindrian')), false,
    'SCHEMA-MIGRATION LEAK: runHedgeRefit created .mindrian/ on a room with no room.db');
});

console.log('');
console.log('PASS test-222-fold-wired.cjs (' + passed + ' arms)');
