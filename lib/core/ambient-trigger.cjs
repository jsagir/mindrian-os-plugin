'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355.1 Plan 06 -- the ambient trigger evaluator (AMB-01, AMB-03,
 * AMB-04). NOT a sensor (Phase 144 fence): this is machinery that reads the
 * room delta through the navigation chokepoint, consults the ambient ledger
 * and lock, and starts the ONE existing Phase 117 fire child in ambient
 * mode. Never throws, never writes the stdout channel (MCP stdio safety),
 * bounds its own wall clock (hook timeouts are seconds and async hooks are
 * unbounded, research C5). Canon Part 8: argv and every written file are
 * closed-shape enums, counts and truncated hashes, never room content.
 * Every seam that will call this module (the CLI Stop hook, the MCP
 * close-out, the material-mode child) lands in a later 355.1 plan; this
 * plan wires nothing live.
 *
 * THE SPLIT (355.1-CONTEXT.md "detector, evaluator, card"): this module
 * reads the room delta, computes the delta hash exactly once, consults the
 * ledger and lock, and spawns the child. It is never registered in the
 * sensor registry and it does not live under lib/core/sensors/.
 *
 * THE DECISION LADDER (AMB-04, locked): no change -> stop; same hash ->
 * stop; a run already in flight -> stop; throttled -> stop; locked -> stop;
 * else claim (in_flight plus the runs window) and write the delta-state
 * side channel run_state 'started' BEFORE spawning; a spawn error rewrites
 * run_state 'spawn_failed' so the honest-fallback sensor can offer it.
 *
 * BOUNDARIES (AMB-08 / Pitfall 9): argv carries only [firePath, roomDir, an
 * empty string, a hash-derived ambient id, the session id or an empty
 * string, and one closed flag]; no claim text, no artifact path, no slug
 * beyond roomDir itself. Any diagnostic goes to the error stream only, as a
 * closed decision enum, only when the operator debug env var is set to '1'.
 * The Pitfall 7 rule: the ambient path never shares the Phase 117 daily cap
 * and never emits the Phase 117 fired-telemetry event name.
 *
 * ONE SPAWN SITE: tests/test-3551-one-spawner.cjs pins the pinned spawner
 * set with a planted negative control. This module spawns nothing but the
 * one Phase 117 fire child, through the one module-level spawn seam
 * (_internal.setSpawnImpl swaps it for tests only).
 *
 * House rule: hyphens only, no em-dashes.
 */

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const navigation = require('./navigation.cjs');
const sensorRoomDelta = require('./sensors/sensor-room-delta.cjs');
const cadenceGuard = require('../../scripts/scout-cadence-guard.cjs');

const { SEAMS } = sensorRoomDelta;

// The repo root, resolved from this file's own location (never process.cwd,
// which a caller may have changed) -- lib/core/ambient-trigger.cjs sits two
// directories below the repo root.
const REPO_ROOT = path.resolve(__dirname, '..', '..');

// AMBIENT_EVAL_BUDGET_MS = 1500. Derivation (355.1-BASELINE.md, research
// item 3): a delta read measures under 10 ms and the navigation module load
// itself costs about 55 ms, so 1500 ms leaves roughly 25 times headroom over
// the measured cost, while staying far under a hook's multi-second timeout
// budget (research correction C5: a hook timeout value is SECONDS, not
// milliseconds -- this evaluator bounds its OWN wall clock rather than
// trusting the harness to do it).
const AMBIENT_EVAL_BUDGET_MS = 1500;

// The one Phase 117 fire child this module ever starts, relative to the
// repo root.
const FIRE_SCRIPT_RELPATH = path.join('scripts', 'auto-explore-fire.cjs');

// The closed decision vocabulary. 'due' is evaluateRoomDelta's own verdict
// that a run should start; evaluateAndClaim / evaluateAndMaybeSpawn turn a
// 'due' verdict into 'claimed', 'spawned' or 'spawn_failed'.
const DECISIONS = Object.freeze([
  'no_room', 'no_change', 'same_hash', 'in_flight', 'throttled', 'locked',
  'ledger_corrupt', 'budget_exceeded', 'due', 'claimed', 'spawned', 'spawn_failed',
]);

// The material-id shape this module writes into the delta-state side
// channel. Matches scripts/scout-cadence-guard.cjs's own delta-state
// validator (6-64 lowercase hex, an opaque local handle, never room
// content) -- a superset of the pure classifier's own stricter acceptance
// window, so a materialId this module accepts for the side channel may
// still be too short for the classifier to fold into class e.
const MATERIAL_ID_RX = /^[0-9a-f]{6,64}$/;

// The debug env var name (off by default). When set to '1', a one-line
// closed-enum diagnostic goes to the error stream only -- never the
// standard output channel MCP stdio JSON-RPC depends on.
const AMBIENT_DEBUG_ENV = 'MINDRIAN_AMBIENT_DEBUG';

// ---------- The module-level spawn seam (tests only) ------------------

let spawnImpl = childProcess.spawn;

const _internal = Object.freeze({
  setSpawnImpl(fn) {
    spawnImpl = (typeof fn === 'function') ? fn : childProcess.spawn;
  },
  resetSpawnImpl() {
    spawnImpl = childProcess.spawn;
  },
});

// ---------- Small helpers, never throw ---------------------------------

function debugLog(decision) {
  try {
    if (process.env[AMBIENT_DEBUG_ENV] === '1') {
      process.stderr.write('[ambient-trigger] ' + String(decision) + '\n');
    }
  } catch (_e) {
    /* never block on a diagnostic write */
  }
}

// isValidRoomDir(roomDir) -- an absolute, existing directory; never the
// reserved no-room sentinel; never a path carrying a newline, carriage
// return or NUL byte (a crafted or wrong roomDir, T-3551-28).
function isValidRoomDir(roomDir) {
  if (typeof roomDir !== 'string' || roomDir.length === 0) return false;
  if (roomDir === '__no_room__') return false;
  if (roomDir.indexOf('\n') !== -1 || roomDir.indexOf('\r') !== -1 || roomDir.indexOf('\u0000') !== -1) return false;
  if (!path.isAbsolute(roomDir)) return false;
  try {
    const st = fs.statSync(roomDir);
    return st.isDirectory();
  } catch (_e) {
    return false;
  }
}

function normalizeSeam(seam) {
  return (SEAMS.indexOf(seam) !== -1) ? seam : SEAMS[0];
}

function normalizeMaterialId(materialId) {
  return (typeof materialId === 'string' && MATERIAL_ID_RX.test(materialId)) ? materialId : null;
}

function fireScriptAbsPath() {
  return path.join(REPO_ROOT, FIRE_SCRIPT_RELPATH);
}

// ambientIdFor(deltaHash) -> the closed-shape local run id this module puts
// on the child's argv, the first 12 hex characters of the delta hash.
function ambientIdFor(deltaHash) {
  const h = (typeof deltaHash === 'string') ? deltaHash : '';
  return 'ambient-' + h.slice(0, 12);
}

// buildAmbientArgv(firePath, roomDir, deltaHash, sessionId) -- the CLOSED
// argv shape (AMB-08 / Pitfall 9): no claim text, no artifact path, no slug
// beyond roomDir itself.
function buildAmbientArgv(firePath, roomDir, deltaHash, sessionId) {
  return [
    firePath,
    roomDir,
    '',
    ambientIdFor(deltaHash),
    (typeof sessionId === 'string' && sessionId) ? sessionId : '',
    '--ambient',
  ];
}

// ---------- evaluateRoomDelta: read, classify once, decide -------------

/**
 * evaluateRoomDelta(roomDir, opts) -> { decision, delta_hash, classes,
 * next_watermarks }. Never throws. Bounds its own wall clock against
 * opts.budgetMs (default AMBIENT_EVAL_BUDGET_MS), checked between every
 * step; an over-budget evaluation returns 'budget_exceeded' and spawns
 * nothing.
 *
 * @param {string} roomDir
 * @param {{seam?: string, sessionId?: string, materialId?: string,
 *   now?: number, registryHome?: string, readFacts?: Function,
 *   classifyFn?: Function, budgetMs?: number}} [opts]
 */
function evaluateRoomDelta(roomDir, opts) {
  const o = (opts && typeof opts === 'object') ? opts : {};
  const budgetMs = (typeof o.budgetMs === 'number' && o.budgetMs > 0) ? o.budgetMs : AMBIENT_EVAL_BUDGET_MS;
  const wallStart = Date.now();
  const overBudget = () => (Date.now() - wallStart) > budgetMs;
  const empty = (decision) => ({ decision, delta_hash: null, classes: [], next_watermarks: null });

  try {
    if (!isValidRoomDir(roomDir)) return empty('no_room');

    // -- read the ledger (the prior watermarks this evaluation diffs against) --
    let ledgerRead;
    try {
      ledgerRead = cadenceGuard.readAmbientLedger(roomDir);
    } catch (_e) {
      ledgerRead = { ledger: null, corrupt: true };
    }
    if (overBudget()) return empty('budget_exceeded');
    const watermarks = (!ledgerRead.corrupt && ledgerRead.ledger && ledgerRead.ledger.watermarks
      && typeof ledgerRead.ledger.watermarks === 'object') ? ledgerRead.ledger.watermarks : {};

    // -- open the read-only handle, read the delta facts, close in finally --
    let db = null;
    let facts = null;
    try {
      db = navigation.openRoomDbReadOnlyForCaller(roomDir);
      const readFactsFn = (typeof o.readFacts === 'function') ? o.readFacts : navigation.readRoomDeltaFacts;
      facts = readFactsFn(db, roomDir, {
        since: {
          claims_created_at: watermarks.claims_created_at,
          artifacts_created_at: watermarks.artifacts_created_at,
        },
        registryHome: o.registryHome,
      });
    } catch (_e) {
      facts = null;
    } finally {
      try { navigation.closeRoomDbForCaller(db); } catch (_e2) { /* tolerant close */ }
    }
    if (overBudget()) return empty('budget_exceeded');

    // -- classify exactly once --
    const classifyFn = (typeof o.classifyFn === 'function') ? o.classifyFn : sensorRoomDelta.classifyRoomDelta;
    let classified;
    try {
      classified = classifyFn(facts, watermarks, { materialId: o.materialId });
    } catch (_e) {
      classified = null;
    }
    if (overBudget()) return empty('budget_exceeded');

    if (!classified || !classified.changed) {
      const nextWatermarks = (classified && classified.next_watermarks) ? classified.next_watermarks : null;
      if (nextWatermarks) {
        try { cadenceGuard.recordAmbientBaseline(roomDir, { watermarks: nextWatermarks }); } catch (_e) { /* best effort */ }
      }
      return { decision: 'no_change', delta_hash: null, classes: [], next_watermarks: nextWatermarks };
    }

    // -- consult the ledger + lock ladder --
    let ladder;
    try {
      ladder = cadenceGuard.shouldRunAmbient(roomDir, classified.delta_hash, { now: o.now });
    } catch (_e) {
      ladder = { run: false, reason: 'ledger_corrupt' };
    }
    if (overBudget()) return empty('budget_exceeded');

    const decision = ladder.run ? 'due' : ladder.reason;
    return {
      decision,
      delta_hash: classified.delta_hash,
      classes: classified.classes,
      next_watermarks: classified.next_watermarks,
    };
  } catch (_e) {
    return empty('no_room');
  }
}

// ---------- evaluateAndClaim: due -> claim, never spawns ---------------

/**
 * evaluateAndClaim(roomDir, opts) -> { decision, delta_hash, classes }.
 * When due and within budget: claims the run (in_flight + the runs window)
 * then writes the delta-state side channel run_state 'started'. Never
 * spawns.
 */
function evaluateAndClaim(roomDir, opts) {
  const o = (opts && typeof opts === 'object') ? opts : {};
  try {
    const evalResult = evaluateRoomDelta(roomDir, o);
    if (evalResult.decision !== 'due') {
      return { decision: evalResult.decision, delta_hash: evalResult.delta_hash, classes: evalResult.classes };
    }

    let claim;
    try {
      claim = cadenceGuard.claimAmbientRun(roomDir, {
        deltaHash: evalResult.delta_hash,
        watermarks: evalResult.next_watermarks,
        seam: o.seam,
        now: o.now,
      });
    } catch (_e) {
      claim = { claimed: false };
    }
    if (!claim.claimed) {
      return { decision: 'ledger_corrupt', delta_hash: evalResult.delta_hash, classes: evalResult.classes };
    }

    const nowMs = (typeof o.now === 'number') ? o.now : Date.now();
    try {
      cadenceGuard.writeRoomDeltaState(roomDir, {
        schema_version: 1,
        evaluated_at: new Date(nowMs).toISOString(),
        seam: normalizeSeam(o.seam),
        classes: evalResult.classes,
        delta_hash: evalResult.delta_hash,
        run_state: 'started',
        material_id: normalizeMaterialId(o.materialId),
        opportunity_handle: null,
        surfaced_via: null,
        framing: null,
      });
    } catch (_e) {
      /* the claim already landed; a side-channel write fault never blocks it */
    }

    return { decision: 'claimed', delta_hash: evalResult.delta_hash, classes: evalResult.classes };
  } catch (_e) {
    return { decision: 'no_room', delta_hash: null, classes: [] };
  }
}

// ---------- evaluateAndMaybeSpawn: claimed -> start the one child ------

/**
 * evaluateAndMaybeSpawn(roomDir, opts) -> { decision, delta_hash, classes }.
 * When claimed: spawns the ONE Phase 117 fire child in ambient mode,
 * detached, stdio ignored, windows-hidden, unref'd. A throw or a missing
 * fire script rewrites the delta-state side channel run_state
 * 'spawn_failed' (the honest-fallback sensor's input) and never blocks.
 */
function evaluateAndMaybeSpawn(roomDir, opts) {
  const o = (opts && typeof opts === 'object') ? opts : {};
  try {
    const claimResult = evaluateAndClaim(roomDir, o);
    if (claimResult.decision !== 'claimed') {
      debugLog(claimResult.decision);
      return claimResult;
    }

    const firePath = fireScriptAbsPath();
    const argv = buildAmbientArgv(firePath, roomDir, claimResult.delta_hash, o.sessionId);

    let spawned = false;
    try {
      if (!fs.existsSync(firePath)) {
        throw new Error('ambient-trigger: fire script missing at ' + firePath);
      }
      const child = spawnImpl(process.execPath, argv, {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
        env: process.env,
      });
      if (child && typeof child.unref === 'function') child.unref();
      spawned = true;
    } catch (_e) {
      spawned = false;
    }

    if (!spawned) {
      const nowMs = (typeof o.now === 'number') ? o.now : Date.now();
      try {
        cadenceGuard.writeRoomDeltaState(roomDir, {
          schema_version: 1,
          evaluated_at: new Date(nowMs).toISOString(),
          seam: normalizeSeam(o.seam),
          classes: claimResult.classes,
          delta_hash: claimResult.delta_hash,
          run_state: 'spawn_failed',
          material_id: normalizeMaterialId(o.materialId),
          opportunity_handle: null,
          surfaced_via: null,
          framing: null,
        });
      } catch (_e2) { /* best effort */ }
      // CR-02 fix (355.1 review): evaluateAndClaim just above already set
      // ledger.in_flight. A spawn failure (missing fire script, EAGAIN/
      // ENOMEM, a transient fork failure) never spawns a child that could
      // ever call releaseAmbientClaim -- without this, in_flight stays set
      // for up to AMBIENT_LOCK_STALE_MS (8 minutes) and every subsequent
      // evaluation reports in_flight even though nothing is running. This
      // releases in_flight ONLY; ledger.runs_window.count (the hourly-cap
      // counter claimAmbientRun already bumped) is deliberately left alone
      // -- refunding/not-counting a phantom claim is WR-03, a separate
      // warning-tier finding out of scope for this critical-only fix.
      try { cadenceGuard.releaseAmbientClaim(roomDir, claimResult.delta_hash); } catch (_e3) { /* best effort */ }
      debugLog('spawn_failed');
      return { decision: 'spawn_failed', delta_hash: claimResult.delta_hash, classes: claimResult.classes };
    }

    debugLog('spawned');
    return { decision: 'spawned', delta_hash: claimResult.delta_hash, classes: claimResult.classes };
  } catch (_e) {
    debugLog('spawn_failed');
    return { decision: 'spawn_failed', delta_hash: null, classes: [] };
  }
}

module.exports = {
  evaluateRoomDelta,
  evaluateAndClaim,
  evaluateAndMaybeSpawn,
  buildAmbientArgv,
  ambientIdFor,
  DECISIONS,
  AMBIENT_EVAL_BUDGET_MS,
  FIRE_SCRIPT_RELPATH,
  _internal,
};
