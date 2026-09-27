'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355.1 Plan 03 -- SENS-21 room-delta detector: the honest fallback
 * offer when the room changed but the ambient breakthrough run could not
 * start on this surface.
 *
 * ID CORRECTION (355.1-CONTEXT.md "Research corrections applied", the same
 * correction Phase 345 recorded for its own sensor): the PRD and the phase
 * ROADMAP title say SENS-20. Phase 345 already holds SENS-20 as
 * sensorStrategyReach (registered in lib/core/insight-sensors.cjs and
 * lib/core/sensors/sensor-priority.cjs). The next free id, re-grepped
 * immediately before this registration commit, is SENS-21. Every constant
 * and comment in this file uses SENS-21.
 *
 * THE SPLIT (355.1-CONTEXT.md "detector, evaluator, card"): this module is a
 * PURE DETECTOR. It reads the LOCAL side-channel
 * <roomDir>/.mindrian/last-room-delta.json that plan 355.1-05's evaluator
 * writes after it evaluates a room delta and attempts to spawn the ambient
 * child, and it SURFACES the fallback offer the failed attempt represents.
 * It produces a candidate reach only; it NEVER routes and NEVER executes
 * (Phase 144 fence), NEVER writes a file, and is NEVER async (an async
 * sensor is silently dropped by dispatchSensors).
 *
 * FROZEN REACH (CIRS R3, the 345/213 lockstep precedent): this sensor rides
 * the EXISTING context_block reach at posture 'hold'. It mints NO 7th reach.
 * deep_research was considered and REJECTED (355.1-CONTEXT.md, AMB-02
 * locked): deep_research is suppressed in turns 1-2
 * (isReachEligibleForTurn), which would hide the fallback offer right after
 * a change that happened BETWEEN sessions -- exactly the moment the offer
 * matters most. context_block is never turn-gated.
 *
 * POSTURE 'hold' (AMB-02 reading, locked): posture 'hold' is the REACH
 * posture (POSTURE_IDS has no 'autonomous_safe' value). The unrelated phrase
 * "autonomous_safe joined from recipe-maps" in 355.1-CONTEXT.md applies to
 * the ambient run's own producer steps (plan 355.1-07's spawned child), it
 * NEVER applies to this sensor's reach.
 *
 * THE FALLBACK-ONLY FIRING RULE (355.1-CONTEXT.md "The split", locked): this
 * sensor fires ONLY when the side-channel is fresh, schema_version matches,
 * AND run_state is one of DEGRADE_STATES (spawn_failed | deps_missing).
 * started / running / completed are SILENT because SENS-13 carries the card
 * in the normal path (Group B neighbor, immediately preceding this record in
 * SENS_PRIORITY) -- the navigator sees ONE card per delta, never two.
 *
 * CANON PART 8 (evidence is enum/handle-only): the evidence bag carries only
 * the closed run_state enum and a sorted, pipe-joined DELTA_CLASSES string
 * (e.g. 'a' or 'a|b'). Zero room content, zero slug, zero path separator
 * ever crosses into evidence -- tests/test-sensors-part8-sweep.cjs and
 * tests/test-3551-sensor-fires.cjs's evidence-clean leg both span this file.
 *
 * FRESHNESS (replicated, not imported -- a sensors/ file must not require
 * insight-sensors.cjs, that is circular; the sensor-eureka.cjs precedent):
 * ROOM_DELTA_FRESHNESS_MS mirrors EUREKA_SIGNAL_FRESHNESS_MS's 30-minute
 * window plus the WR-01 non-negative-age (future-mtime) guard.
 *
 * Pure / sync / LOCAL-first, soft-fail-to-null on every malformed input;
 * never throws. tests/test-sensors-routing-fence.cjs and
 * tests/test-sensors-part8-sweep.cjs already span every lib/core/sensors/*.cjs
 * so this file is auto-covered.
 *
 * House rule: hyphens only, no em-dashes.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const { makeReach, REACH_IDS } = require('./sensor-types.cjs');

// SENS-21: the next free sensor id at registration time (SENS-20 is Phase
// 345's sensorStrategyReach; see the ID CORRECTION note above).
const SENSOR_ID = 'SENS-21';

// FROZEN: rides the EXISTING context_block reach. Fail closed at load if it
// ever drifts off the frozen bank (mirrors sensor-eureka.cjs).
const REACH_ID = 'context_block';
if (REACH_IDS.indexOf(REACH_ID) === -1) {
  throw new Error('sensor-room-delta: REACH_ID "' + REACH_ID + '" is not in the frozen REACH_IDS bank');
}

// The reach posture (AMB-02 reading: a REACH posture, never a run posture).
const POSTURE = 'hold';

// The signal + dispatch names this reach carries.
const SIGNAL = 'room_delta';
const DISPATCH = 'auto-explore';

// AMB-01 (locked): the claim floor N, the minimum count of claim nodes added
// since the last ambient run that counts as delta class (a). Disclosed as a
// data/floor-ledger.json row (kind 'floor', status 'disclosed'); its
// approval is recorded at the single 355.1 checkpoint.
const CLAIM_FLOOR_N = 5;

// The five closed delta classes (AMB-01), frozen and ordered.
const DELTA_CLASSES = Object.freeze(['a', 'b', 'c', 'd', 'e']);

// The three closed seam kinds the evaluator (plan 355.1-05+) may run the
// child on. Not read by this sensor; frozen here so the vocabulary this
// plan's classifier and evidence shape are built against is named once, in
// the one module every later 355.1 plan requires for it.
const SEAMS = Object.freeze(['stop_hook', 'closeout', 'material']);

// The closed run_state enum the side-channel payload carries.
const RUN_STATES = Object.freeze(['started', 'running', 'completed', 'spawn_failed', 'deps_missing']);

// The subset of RUN_STATES this sensor fires on: the honest fallback offer,
// made only when the ambient run could not start on this surface.
const DEGRADE_STATES = Object.freeze(['spawn_failed', 'deps_missing']);

// The closed surfaced-via enum a downstream reader may consult (not read by
// this sensor; named here so the vocabulary is declared once).
const SURFACED_VIA = Object.freeze(['sens13', 'none']);

// The side-channel relpath this sensor reads. Plan 355.1-05's evaluator is
// the sole writer; this sensor only reads it.
const DELTA_STATE_RELPATH = path.join('.mindrian', 'last-room-delta.json');

// The closed schema version the writer stamps; a mismatch never fires.
const DELTA_STATE_SCHEMA_VERSION = 1;

// The side-channel freshness window (REPLICATED from sensor-eureka.cjs's
// EUREKA_SIGNAL_FRESHNESS_MS, NOT imported -- a sensors/ file must not
// require insight-sensors.cjs, that is circular). 30 minutes.
const ROOM_DELTA_FRESHNESS_MS = 30 * 60 * 1000;

// The materialId format a caller of classifyRoomDelta may supply: an 8-64
// char lowercase-hex opaque local handle, never room content.
const MATERIAL_ID_RX = /^[0-9a-f]{8,64}$/;

// ---------- LOCAL helpers (replicated, sync, soft-fail) ----------

/**
 * Read + parse a JSON file, returning null on any failure. LOCAL only -- the
 * caller threads a room-local path; there is no network surface here.
 */
function readJsonSafe(filePath) {
  try {
    if (typeof filePath !== 'string' || !filePath) return null;
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_e) {
    return null;
  }
}

// 355.1-12 (orchestrator-assigned root-cause fix): Date.now() is an integer
// millisecond value while fs.Stats#mtimeMs carries sub-millisecond
// fractions, so a file written and then stat'ed within the same
// millisecond can yield a small NEGATIVE age (measured: 336 of 20,000
// immediate write-then-stat pairs, minimum -0.41 ms) -- not clock skew,
// not a test bug. MTIME_FUTURE_TOLERANCE_MS tolerates that sub-millisecond
// slop while keeping the WR-01 intent: a GENUINELY future-dated mtime
// (seconds to years ahead) must still never read as fresh.
const MTIME_FUTURE_TOLERANCE_MS = 1000;

/**
 * True when the file exists and its mtime is within
 * ROOM_DELTA_FRESHNESS_MS. WR-01 guard: a FUTURE-dated mtime (clock skew,
 * archive extraction, backup restore) must NOT read as fresh forever -- age
 * must be within MTIME_FUTURE_TOLERANCE_MS of non-negative (tolerating the
 * sub-millisecond write-then-stat slop) and within the window. Soft-fail to
 * false; never throws.
 */
function isFreshFile(filePath) {
  try {
    const st = fs.statSync(filePath);
    const age = Date.now() - st.mtimeMs;
    return age >= -MTIME_FUTURE_TOLERANCE_MS && age <= ROOM_DELTA_FRESHNESS_MS;
  } catch (_e) {
    return false;
  }
}

// ---------- computeDeltaHash: pure, order-free ----------

/**
 * computeDeltaHash(lines) -> a 64-hex sha256 string over the sorted,
 * newline-joined delta-fact lines. Order-free: computeDeltaHash(['b:x',
 * 'a:1']) === computeDeltaHash(['a:1', 'b:x']). Pure, sync, zero I/O.
 *
 * PART8-SAFE-HASH: hashes CLOSED delta-fact lines only (class-prefixed
 * enums, counts and opaque node-id/handle strings this module's own
 * classifyRoomDelta produces) into a LOCAL dedup/comparison handle -- never
 * room prose, never crosses the Brain boundary. See
 * tests/test-sensors-part8-sweep.cjs for the documented exception.
 *
 * @param {string[]} lines
 * @returns {string} 64 lowercase hex chars
 */
function computeDeltaHash(lines) {
  const arr = Array.isArray(lines) ? lines.slice() : [];
  arr.sort();
  // PART8-SAFE-HASH: see the doc-comment above -- closed delta-fact lines
  // only, a LOCAL dedup/comparison handle, never room prose.
  return crypto.createHash('sha256').update(arr.join('\n'), 'utf8').digest('hex');
}

// ---------- classifyRoomDelta: pure, no I/O, no clock ----------

/**
 * classifyRoomDelta(facts, watermarks, opts) -> { changed, classes,
 * delta_hash, lines, next_watermarks }.
 *
 * Pure: no I/O, no Date.now, no Math.random. facts is the closed-shape bag
 * lib/core/navigation/room-delta-facts.cjs's readRoomDeltaFacts returns
 * (claims { count, max_created_at }, artifacts { count, max_created_at } |
 * null, contradicts_keys[], stage_hash|null, children[]). watermarks is the
 * PRIOR next_watermarks this same function returned on the last evaluation
 * (or {} on a first evaluation). opts.claimFloor defaults to CLAIM_FLOOR_N;
 * opts.materialId is accepted only when it matches MATERIAL_ID_RX.
 *
 * CLASS RULES (AMB-01). facts.claims and facts.artifacts are ALREADY
 * since-bound counts (the caller passes the prior watermark as
 * readRoomDeltaFacts's opts.since; the SQL filters at the source), so
 * classes (a) and (e) are absolute thresholds that CAN fire on a first
 * evaluation. facts.contradicts_keys and facts.children are FULL CURRENT
 * snapshots (no source-side since-filter is possible), so classes (b) and
 * (d) require a PRIOR watermark array to diff against -- a first evaluation
 * (no prior array at all) only sets the baseline, it never fires:
 *   a: facts.claims.count >= claimFloor AND facts.claims.max_created_at is
 *      non-null. Line: 'a:' + facts.claims.max_created_at.
 *   b: watermarks.contradicts_keys must already be an array (else baseline
 *      only, no fire); any key in facts.contradicts_keys absent from it
 *      fires class b. One line per new key: 'b:' + key.
 *   c: facts.stage_hash is a non-null string, differs from watermarks.stage
 *      (which must also be present), and watermarks.stage itself is
 *      non-null (a first evaluation sets the baseline only). Line: 'c:' +
 *      facts.stage_hash. A null facts.stage_hash (unreadable STATE.md) never
 *      yields class c.
 *   d: watermarks.children must already be an array (else baseline only, no
 *      fire); any key in facts.children absent from it fires class d. One
 *      line per new key: 'd:' + key.
 *   e: facts.artifacts && facts.artifacts.count > 0 AND
 *      facts.artifacts.max_created_at is non-null, OR opts.materialId is
 *      present (fires class e unconditionally, even when artifacts is null
 *      -- the Phase 117 class, kept). materialId adds an EXTRA line 'e:m:'
 *      + opts.materialId.
 *
 * next_watermarks carries every current fact forward
 * (claims_created_at, artifacts_created_at, contradicts_keys, stage,
 * children), keeping the PRIOR value where the current fact is null (a
 * transient read fault must never erase a good watermark).
 *
 * @param {object} facts
 * @param {object} watermarks
 * @param {{claimFloor?: number, materialId?: string}} [opts]
 * @returns {{changed: boolean, classes: string[], delta_hash: string|null, lines: string[], next_watermarks: object}}
 */
function classifyRoomDelta(facts, watermarks, opts) {
  const f = (facts && typeof facts === 'object') ? facts : {};
  const w = (watermarks && typeof watermarks === 'object') ? watermarks : {};
  const o = (opts && typeof opts === 'object') ? opts : {};
  const claimFloor = (typeof o.claimFloor === 'number' && o.claimFloor >= 0) ? o.claimFloor : CLAIM_FLOOR_N;
  const materialId = (typeof o.materialId === 'string' && MATERIAL_ID_RX.test(o.materialId)) ? o.materialId : '';

  const classesSet = new Set();
  const lines = [];

  // ---- class a: claim floor crossed ----
  // facts.claims.count is ALREADY a since-bound count (the caller, plan
  // 355.1-05's evaluator, passes the prior watermark as readRoomDeltaFacts's
  // opts.since; room-delta-facts.cjs's SQL_CLAIMS_SINCE filters at the
  // source). No prior-watermark PRESENCE check is needed here -- an absolute
  // threshold on an already-filtered count, so class a can fire on a first
  // evaluation.
  const claims = (f.claims && typeof f.claims === 'object') ? f.claims : {};
  const claimsCount = (typeof claims.count === 'number') ? claims.count : 0;
  const claimsMaxCreatedAt = (typeof claims.max_created_at === 'number') ? claims.max_created_at : null;
  if (claimsCount >= claimFloor && claimsMaxCreatedAt !== null) {
    classesSet.add('a');
    lines.push('a:' + claimsMaxCreatedAt);
  }

  // ---- class b: a new CONTRADICTS key surfaced ----
  // Unlike (a), facts.contradicts_keys is a FULL CURRENT snapshot (edges
  // carry no timestamp column), so a diff against the PRIOR watermark set is
  // required to know what is new. On a first evaluation (no prior watermark
  // array at all) this only sets the baseline; it never fires.
  const contradictsKeys = Array.isArray(f.contradicts_keys) ? f.contradicts_keys : [];
  const hadContradictsWatermark = Array.isArray(w.contradicts_keys);
  if (hadContradictsWatermark) {
    const priorContradictsKeys = new Set(w.contradicts_keys);
    const newContradictsKeys = contradictsKeys.filter((k) => typeof k === 'string' && !priorContradictsKeys.has(k));
    if (newContradictsKeys.length > 0) {
      classesSet.add('b');
      for (const k of newContradictsKeys) lines.push('b:' + k);
    }
  }

  // ---- class c: a venture-stage change since the last watermark ----
  const stageHash = (typeof f.stage_hash === 'string' && f.stage_hash) ? f.stage_hash : null;
  const priorStage = (typeof w.stage === 'string' && w.stage) ? w.stage : null;
  if (stageHash !== null && priorStage !== null && stageHash !== priorStage) {
    classesSet.add('c');
    lines.push('c:' + stageHash);
  }

  // ---- class d: a new sub-room created ----
  // Same reasoning as (b): the registry read is a FULL CURRENT snapshot, so
  // a first evaluation (no prior watermark array) only sets the baseline.
  const children = Array.isArray(f.children) ? f.children : [];
  const hadChildrenWatermark = Array.isArray(w.children);
  if (hadChildrenWatermark) {
    const priorChildren = new Set(w.children);
    const newChildren = children.filter((k) => typeof k === 'string' && !priorChildren.has(k));
    if (newChildren.length > 0) {
      classesSet.add('d');
      for (const k of newChildren) lines.push('d:' + k);
    }
  }

  // ---- class e: a new artifact filed (or an explicit materialId) ----
  // Same since-bound shape as (a): facts.artifacts.count is already filtered
  // at the source by the caller's watermark, so no prior-watermark PRESENCE
  // check is needed here either.
  const artifacts = (f.artifacts && typeof f.artifacts === 'object') ? f.artifacts : null;
  const artifactsCount = (artifacts && typeof artifacts.count === 'number') ? artifacts.count : 0;
  const artifactsMaxCreatedAt = (artifacts && typeof artifacts.max_created_at === 'number') ? artifacts.max_created_at : null;
  if (artifactsCount > 0 && artifactsMaxCreatedAt !== null) {
    classesSet.add('e');
    lines.push('e:' + artifactsMaxCreatedAt);
  }
  if (materialId) {
    classesSet.add('e');
    lines.push('e:m:' + materialId);
  }

  const classes = Array.from(classesSet).filter((c) => DELTA_CLASSES.indexOf(c) !== -1).sort();
  lines.sort();
  const changed = classes.length > 0;
  const deltaHash = changed ? computeDeltaHash(lines) : null;

  const nextWatermarks = {
    claims_created_at: (claimsMaxCreatedAt !== null) ? claimsMaxCreatedAt : (Object.prototype.hasOwnProperty.call(w, 'claims_created_at') ? w.claims_created_at : null),
    artifacts_created_at: (artifactsMaxCreatedAt !== null) ? artifactsMaxCreatedAt : (Object.prototype.hasOwnProperty.call(w, 'artifacts_created_at') ? w.artifacts_created_at : null),
    contradicts_keys: contradictsKeys.length > 0 ? contradictsKeys.slice() : (Array.isArray(w.contradicts_keys) ? w.contradicts_keys.slice() : []),
    stage: (stageHash !== null) ? stageHash : (Object.prototype.hasOwnProperty.call(w, 'stage') ? w.stage : null),
    children: children.length > 0 ? children.slice() : (Array.isArray(w.children) ? w.children.slice() : []),
  };

  return {
    changed: changed,
    classes: classes,
    delta_hash: deltaHash,
    lines: lines,
    next_watermarks: nextWatermarks,
  };
}

// ---------- SENS-21: the room-delta sensor ----------

/**
 * SENS-21 -- a fresh, degraded ambient-run side-channel -> the context_block
 * reach at posture 'hold'.
 *
 * Fires (returns a Readonly reach) ONLY when ALL preconditions hold:
 *   - ctx.roomDir is a non-empty string, AND
 *   - <roomDir>/.mindrian/last-room-delta.json exists and is FRESH (mtime
 *     within the 30-minute window, non-negative age), AND
 *   - it parses and payload.schema_version === DELTA_STATE_SCHEMA_VERSION,
 *     AND
 *   - payload.run_state is one of DEGRADE_STATES (spawn_failed |
 *     deps_missing) -- started / running / completed silently do not fire
 *     (SENS-13 carries the card in the normal path).
 *
 * On any malformed input (bad JSON, missing roomDir, wrong schema_version,
 * stale/future mtime, a run_state outside DEGRADE_STATES) it soft-fails to
 * null and NEVER throws.
 *
 * EVIDENCE: { run_state, classes } only -- the closed run_state enum plus
 * the sorted, pipe-joined DELTA_CLASSES string from payload.classes. No room
 * content, no slug, no path.
 *
 * @param {object} turn   -- the normalized turn (unused for detection here)
 * @param {object} tuple  -- the /mos:diagnose tuple (unused for detection here)
 * @param {object} ctx    -- LOCAL context ({ roomDir })
 * @returns {Readonly<object>|null}
 */
function sensorRoomDelta(turn, tuple, ctx) {
  try {
    const roomDir = (ctx && typeof ctx === 'object' && typeof ctx.roomDir === 'string') ? ctx.roomDir : '';
    if (!roomDir) return null;

    const sideChannel = path.join(roomDir, DELTA_STATE_RELPATH);

    // Freshness gate BEFORE the parse (stat-before-parse): a stale or
    // future-dated side-channel never fires the sensor.
    if (!isFreshFile(sideChannel)) return null;

    const payload = readJsonSafe(sideChannel);
    if (!payload || typeof payload !== 'object') return null;
    if (payload.schema_version !== DELTA_STATE_SCHEMA_VERSION) return null;

    const runState = payload.run_state;
    if (DEGRADE_STATES.indexOf(runState) === -1) return null;

    const rawClasses = Array.isArray(payload.classes) ? payload.classes : [];
    const classesStr = rawClasses
      .filter((c) => typeof c === 'string' && DELTA_CLASSES.indexOf(c) !== -1)
      .sort()
      .join('|');

    return makeReach({
      reach_id: REACH_ID,
      posture: POSTURE,
      dispatch: DISPATCH,
      companions: [],
      signal: SIGNAL,
      evidence: {
        run_state: runState,
        classes: classesStr,
      },
    });
  } catch (_e) {
    return null; // soft-fail: a malformed input never throws out of the sensor
  }
}

// The ambient run ledger relpath (REPLICATED from
// scripts/scout-cadence-guard.cjs's own AMBIENT_LEDGER_RELPATH -- the
// sensor module never requires scripts/; pinned equal by
// tests/test-3551-double-card.cjs's drift-pin leg, the sensor-url-ingest.cjs
// replicated-relpath precedent).
const AMBIENT_LEDGER_RELPATH_REPLICA = path.join('.mindrian', 'ambient-run-ledger.json');

// ---------- isMaterialHeldForStampedCard: Navigator Ruling 5 ----------

/**
 * isMaterialHeldForStampedCard(roomDir, materialId, opts) -> boolean.
 *
 * Navigator Ruling 5 (Phase 355.1 checkpoint): the stamped card wins on
 * delta class (e). One read-only helper decides, for BOTH Phase 117
 * surfaces (the UserPromptSubmit drain and SENS-01's first_material scan),
 * whether a given material's OLD unstamped card must stand down:
 *
 *   - true while the ambient run for this exact material is IN FLIGHT: the
 *     SENS-21 side-channel (<roomDir>/.mindrian/last-room-delta.json) is
 *     FRESH, its material_id equals materialId, and its run_state is
 *     'started' or 'running' (the card is DEFERRED this turn, not dropped).
 *   - true once the ambient run ledger
 *     (<roomDir>/.mindrian/ambient-run-ledger.json) lists materialId in its
 *     stamped_materials array (a sens13 win) -- checked regardless of the
 *     delta-state's own age or presence: the stamped card wins for good.
 *   - false in every other case, INCLUDING a corrupt or unreadable ledger
 *     (fail OPEN for this branch only: a bad file must never hide a card),
 *     a run_state outside started/running, a different material_id, or a
 *     malformed materialId.
 *
 * Sync, read-only (never writes), never throws. A sensors/ file must not
 * require insight-sensors.cjs or scripts/ (circular / layering); this
 * module replicates the ledger relpath instead (AMBIENT_LEDGER_RELPATH_REPLICA
 * above), the same precedent sensor-url-ingest.cjs's LEDGER_RELPATH sets.
 *
 * @param {string} roomDir
 * @param {string} materialId -- an 8-64 char lowercase-hex opaque handle
 * @param {{now?: number}} [opts] -- unused today; reserved for a future
 *   caller-supplied clock (never read here beyond isFreshFile's own Date.now)
 * @returns {boolean}
 */
function isMaterialHeldForStampedCard(roomDir, materialId, _opts) {
  try {
    const room = (typeof roomDir === 'string' && roomDir) ? roomDir : '';
    if (!room) return false;
    if (typeof materialId !== 'string' || !MATERIAL_ID_RX.test(materialId)) return false;

    // Branch 1: a fresh delta state naming this material as in flight.
    const sideChannel = path.join(room, DELTA_STATE_RELPATH);
    if (isFreshFile(sideChannel)) {
      const payload = readJsonSafe(sideChannel);
      if (payload && typeof payload === 'object' && payload.material_id === materialId) {
        const runState = payload.run_state;
        if (runState === 'started' || runState === 'running') return true;
      }
    }

    // Branch 2: the ambient ledger's stamped_materials list, AGE-INDEPENDENT.
    // A corrupt/unreadable ledger fails CLOSED for this branch only (returns
    // false here, never suppressing branch 1's fresh-running hold above) --
    // the 117 card shows rather than being hidden by a bad file.
    const ledgerPath = path.join(room, AMBIENT_LEDGER_RELPATH_REPLICA);
    const ledger = readJsonSafe(ledgerPath);
    if (ledger && typeof ledger === 'object' && Array.isArray(ledger.stamped_materials)
        && ledger.stamped_materials.indexOf(materialId) !== -1) {
      return true;
    }

    return false;
  } catch (_e) {
    return false; // soft-fail: never throws out of the helper
  }
}

module.exports = {
  sensorRoomDelta: sensorRoomDelta,
  classifyRoomDelta: classifyRoomDelta,
  computeDeltaHash: computeDeltaHash,
  isMaterialHeldForStampedCard: isMaterialHeldForStampedCard,
  SENSOR_ID: SENSOR_ID,
  REACH_ID: REACH_ID,
  POSTURE: POSTURE,
  SIGNAL: SIGNAL,
  DISPATCH: DISPATCH,
  CLAIM_FLOOR_N: CLAIM_FLOOR_N,
  DELTA_CLASSES: DELTA_CLASSES,
  SEAMS: SEAMS,
  RUN_STATES: RUN_STATES,
  DEGRADE_STATES: DEGRADE_STATES,
  SURFACED_VIA: SURFACED_VIA,
  DELTA_STATE_RELPATH: DELTA_STATE_RELPATH,
  DELTA_STATE_SCHEMA_VERSION: DELTA_STATE_SCHEMA_VERSION,
  ROOM_DELTA_FRESHNESS_MS: ROOM_DELTA_FRESHNESS_MS,
  AMBIENT_LEDGER_RELPATH_REPLICA: AMBIENT_LEDGER_RELPATH_REPLICA,
};
