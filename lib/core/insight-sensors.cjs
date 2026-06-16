'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 143-01 -- insight-sensors: the 7-row trigger map as code.
 *
 * This module is the net-new spine of the Phase 143 sensor layer. It exposes a
 * single pure dispatch chokepoint -- dispatchSensors(turn, tuple, ctx) -- that
 * runs a SENSOR_REGISTRY of sensor functions in canonical order and collects the
 * non-null candidate reaches they produce.
 *
 * Each sensor has the signature:
 *   sensorFn(turn, tuple, ctx) -> candidate-reach | null
 * where:
 *   turn  -- the conversational/state turn signal bag (e.g. { signals: [...] })
 *   tuple -- the /mos:diagnose classification { problem_type, complexity, stage }
 *   ctx   -- LOCAL context (roomDir, ledger handles, graph state) -- never network
 *
 * HARD FENCES (Canon + downstream-phase boundaries):
 *   - Phase 144 fence: dispatchSensors NEVER mutates trace.routing_source and
 *     NEVER calls decide(). The sensors PRODUCE candidate reaches surfaced at the
 *     Decision Gate (Canon Part 3); decide() (lib/core/navigation-engine.cjs)
 *     CONSUMES them later (Phase 144). No 'engine' routing flip lives here.
 *   - Canon Part 8: the Brain-touching sensors (SENS-01) carry ONLY generic
 *     handles (framework names, problem-type enums, phase ids). No artifact bytes,
 *     meeting content, or user identifiers ever reach a Brain/web companion.
 *     The Part-8 5-tripwire sweep (tests/test-sensors-part8-sweep.cjs) gates this.
 *   - Phase 150.5 seam: dispatchSensors normalizes its input ONCE at entry via
 *     normalizeTurn (text aliased from userText; signals merged additively with
 *     deriveTurnSignals) on a COPY -- the caller's turn object is never mutated.
 *     The two derived signal fuels are the shipped LOCAL side-channels ONLY:
 *     <roomDir>/.mindrian/last-cascade.json -> 'artifact_filed' and the
 *     <roomDir>/.mindrian/auto-explore-*.json fire markers -> 'first_material'.
 *
 * Pure / sync / LOCAL-first. node built-ins + project libs only. No new deps.
 * House rule: hyphens only, no em-dashes.
 */

const fs = require('node:fs');
const path = require('node:path');

const { makeReach, REACH_IDS, POSTURE_IDS } = require('./sensors/sensor-types.cjs');

// Plan-02 detectors (net-new conversation/state-pattern sensors over shipped
// engines). Each lives in its own file under lib/core/sensors/ and is registered
// into the SENSOR_REGISTRY below; the routing fence + Part-8 sweep already span
// every lib/core/sensors/*.cjs so these files are automatically covered.
const { sensorLaggingComponent } = require('./sensors/sensor-lagging-component.cjs');
const { sensorMethodologyDecision } = require('./sensors/sensor-methodology-decision.cjs');
const { sensorGateApproach } = require('./sensors/sensor-gate-approach.cjs');

// Plan-03 (wave 3) detectors -- SENS-04 (external-fact -> hat-scoped WebSearch
// with the MCP-stack-ask gate) + SENS-05 (JTBD set/changed -> re-weight). Both
// live under lib/core/sensors/ so the routing fence + Part-8 sweep span them.
const { sensorExternalFact } = require('./sensors/sensor-external-fact.cjs');
const { sensorJtbdReweight } = require('./sensors/sensor-jtbd-reweight.cjs');

// Phase 150-05 (wave 3) detector -- SENS-08 memory-cortex. Fires the cross-room
// memory-cortex bridge reach when the projected cortex signals (a stale governing
// thought OR a fresh contradiction), reading the LOCAL cortex scalars threaded on
// ctx by the 150-04 producer. Lives under lib/core/sensors/ so the routing fence
// + Part-8 sweep span it.
const { sensorMemoryCortex } = require('./sensors/sensor-memory-cortex.cjs');

// Phase 160-03 (wave 2) detector -- SENS-RECENCY (R6). Makes recency a reach
// signal in Engine 1: when the projected cortex shows a recently-touched node
// (its 0.995^(delta-h) decay score inside the recent window), this sensor
// surfaces the context_block reach so a recently-touched node yields a higher
// reach score than an identical stale node. Reuses the SHIPPED recency-decay
// blend (recencyScore); mints NO new reach_id and NO new EVENT_TYPE. Lives under
// lib/core/sensors/ so the routing fence + Part-8 sweep span it.
const { sensorRecency } = require('./sensors/sensor-recency.cjs');

// ---------- LOCAL helpers (sync, soft-fail) ----------

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

/**
 * True if `turn` carries the named signal. A turn is { signals: [...] } where
 * each signal is either a string kind or an object { kind }. Defensive against
 * malformed input -- returns false rather than throwing.
 */
function hasSignal(turn, kind) {
  if (!turn || typeof turn !== 'object') return false;
  const signals = Array.isArray(turn.signals) ? turn.signals : [];
  for (const s of signals) {
    if (typeof s === 'string' && s === kind) return true;
    if (s && typeof s === 'object' && s.kind === kind) return true;
  }
  return false;
}

/**
 * Pull the problem_type enum off the diagnose tuple as a generic handle.
 * Returns 'undefined' (the enum value) when absent -- never user content.
 */
function problemTypeOf(tuple) {
  if (!tuple || typeof tuple !== 'object') return 'undefined';
  const pt = tuple.problem_type;
  return typeof pt === 'string' && pt ? pt : 'undefined';
}

// ---------- Phase 150.5-01: the one-seam turn normalization ----------

/**
 * The side-channel freshness window. A derived signal fires only when the
 * source file's mtime is within this window -- a days-old cascade or
 * auto-explore marker must NOT re-fire the engine arm on every turn of every
 * later session (the stale-refire failure the firability suite's
 * honest-negative arms assert, T-150.5-02).
 */
const SIGNAL_FRESHNESS_MS = 30 * 60 * 1000;

/**
 * True when the file exists and its mtime is within SIGNAL_FRESHNESS_MS.
 * stat-before-parse: the mtime gate runs before any JSON read so the whole
 * derivation stays trivially inside the 1200ms NAV budget (T-150.5-04).
 * Soft-fail to false on any fs fault; never throws.
 * WR-01 (150.5 code review): a FUTURE-dated mtime (WSL2/Windows-mount clock
 * skew, archive extraction, backup restore) must NOT read as fresh forever --
 * age must be non-negative AND within the window.
 */
function isFreshFile(filePath) {
  try {
    const st = fs.statSync(filePath);
    const age = Date.now() - st.mtimeMs;
    return age >= 0 && age <= SIGNAL_FRESHNESS_MS;
  } catch (_e) {
    return false;
  }
}

/**
 * Derive turn signal KINDS from EXACTLY the two CONTEXT-named shipped LOCAL
 * side-channels under ctx.roomDir (Phase 150.5 SENS-FIX-01):
 *
 *   (a) 'artifact_filed'  <- <roomDir>/.mindrian/last-cascade.json exists, is
 *       fresh per SIGNAL_FRESHNESS_MS, parses via readJsonSafe, and
 *       proactive_intelligence.newFindings is a non-empty array (the same gate
 *       sensorArtifactFiled re-checks, so signal and sensor agree).
 *   (b) 'first_material'  <- any <roomDir>/.mindrian/auto-explore-*.json fire
 *       marker (the Phase 117 substrate) exists and is fresh.
 *
 * Returns signal KIND strings only -- closed enums, never file content, never
 * prose (threat T1 / Canon Part 8). Pure-LOCAL, sync, soft-fail-to-[] on any
 * fault; never throws. No third derivation exists: the 150.5 CONTEXT names
 * exactly these two side-channel fuels.
 *
 * @param {object} ctx -- LOCAL context ({ roomDir })
 * @returns {string[]} derived signal kinds (possibly empty)
 */
function deriveTurnSignals(ctx) {
  try {
    const roomDir = (ctx && typeof ctx === 'object' && typeof ctx.roomDir === 'string') ? ctx.roomDir : '';
    if (!roomDir) return [];
    const sideDir = path.join(roomDir, '.mindrian');
    const out = [];

    // (a) artifact_filed <- fresh last-cascade.json with non-empty newFindings.
    const cascadePath = path.join(sideDir, 'last-cascade.json');
    if (fs.existsSync(cascadePath) && isFreshFile(cascadePath)) {
      const payload = readJsonSafe(cascadePath);
      const pi = (payload && typeof payload === 'object') ? payload.proactive_intelligence : null;
      if (pi && Array.isArray(pi.newFindings) && pi.newFindings.length > 0) {
        out.push('artifact_filed');
      }
    }

    // (b) first_material <- any fresh auto-explore-*.json fire marker.
    let entries = [];
    try {
      entries = fs.readdirSync(sideDir);
    } catch (_e) {
      entries = [];
    }
    for (const name of entries) {
      if (name.indexOf('auto-explore-') === 0 && name.slice(-5) === '.json') {
        if (isFreshFile(path.join(sideDir, name))) {
          out.push('first_material');
          break;
        }
      }
    }

    return out;
  } catch (_e) {
    return []; // soft-fail: a derivation fault never poisons the dispatch
  }
}

/**
 * Return a SHALLOW ENRICHED COPY of the turn (the D-03a structural guarantee:
 * the enriched text/signals exist ONLY on the copy that lives inside the
 * dispatch -- the caller's turn object, the one that flows around the
 * classifier toward buildBrainPacket, is NEVER mutated and gains zero keys):
 *
 *   text    -- turn.text || turn.utterance || turn.userText || '' (existing
 *              text/utterance always win, so callers that already normalize
 *              are byte-stable).
 *   signals -- the deduplicated union of the caller's turn.signals array
 *              (preserved verbatim, object signals included) and
 *              deriveTurnSignals(ctx) (the additive merge lane).
 *
 * @param {object} turn -- the caller's turn (never mutated)
 * @param {object} ctx  -- LOCAL context threaded to deriveTurnSignals
 * @returns {object} the enriched copy
 */
function normalizeTurn(turn, ctx) {
  const base = (turn && typeof turn === 'object') ? turn : {};
  const copy = Object.assign({}, base);

  // text alias: existing text/utterance always win; userText is the
  // production-hook fallback (scripts/intent-classifier.cjs ~:1351).
  let text = '';
  if (typeof base.text === 'string') text = base.text;
  else if (typeof base.utterance === 'string') text = base.utterance;
  else if (typeof base.userText === 'string') text = base.userText;
  copy.text = text;

  // signals: caller-supplied preserved verbatim, derived kinds merged
  // additively (deduplicated against both string and { kind } shapes).
  const callerSignals = Array.isArray(base.signals) ? base.signals.slice() : [];
  const merged = callerSignals.slice();
  for (const kind of deriveTurnSignals(ctx)) {
    let present = false;
    for (const s of callerSignals) {
      if (s === kind || (s && typeof s === 'object' && s.kind === kind)) {
        present = true;
        break;
      }
    }
    if (!present) merged.push(kind);
  }
  copy.signals = merged;

  return copy;
}

// ---------- SENS-01: first-material sensor (PARTIAL over Phase 117) ----------

/**
 * SENS-01 -- first-material -> explore-domains + whitespace + brain_framework_chain.
 *
 * The first-material signal is the shipped Phase 117 auto-explore path
 * (scripts/auto-explore-fire.cjs runs discovery-cycle + rs-engine and writes
 * room/.mindrian/auto-explore-<material_id>.json). This sensor does NOT re-run
 * that pipeline. It SURFACES the candidate reach the path represents and
 * ATTACHES the brain_framework_chain companion carrying ONLY the problem_type
 * enum (Canon Part 8: generic handle only -- never artifact bytes).
 *
 * Reach: context_block / push_forward. Dispatch names the shipped
 * explore-domains + whitespace path. Soft-fail to null when the signal is
 * absent; never throws.
 *
 * @returns {Readonly<object>|null}
 */
function sensorFirstMaterial(turn, tuple, _ctx) {
  if (!hasSignal(turn, 'first_material')) return null;

  // Generic-handle companion: problem_type enum ONLY. This is the Part-8 seam --
  // problemTypeOf returns the enum value (or 'undefined'), never user content.
  const pt = problemTypeOf(tuple);
  const companions = [
    // The explore-domains/whitespace reach already fires via Phase 117; the
    // brain_framework_chain($problem_type) companion is the generic Brain handle
    // SENS-01 attaches. Format: '<handle>:<enum>' -- enum is the ONLY payload.
    'brain_framework_chain:' + pt,
    'whitespace',
  ];

  return makeReach({
    reach_id: 'context_block',
    posture: 'push_forward',
    // Dispatch names the shipped Phase 117 surface (explore-domains + whitespace);
    // it is a handle, not user content.
    dispatch: 'explore-domains+whitespace',
    companions: companions,
    signal: 'first_material',
    evidence: { problem_type: pt, source: 'auto-explore-117' },
  });
}

// ---------- SENS-06: artifact-filed sensor (VERIFY over CASC-01) ----------

/**
 * SENS-06 -- artifact-filed -> the shipped CASC-01 cross-relationship cascade.
 *
 * VERIFY, not BUILD. This sensor reads the room-local side-channel
 * (<roomDir>/.mindrian/last-cascade.json) that scripts/post-write writes, and
 * surfaces the candidate reach when proactive_intelligence.newFindings is
 * non-empty. It mirrors skills/room-proactive/SKILL.md's read contract exactly
 * and does NOT re-implement the Phase 95/142 cascade. LOCAL only (Canon Part 8):
 * no network, no Brain query -- the read is in-process fs only.
 *
 * The finding edge type chooses the reach: a CONTRADICT finding surfaces
 * reach_id 'contradiction' with posture 'pull_back' (Part 5: a contradiction
 * near a claim pulls back to re-set the stage); any other finding edge surfaces
 * 'cross_room' with posture 'push_forward'.
 *
 * Soft-fail to null when the signal is absent, the side-channel is missing/
 * unparseable, or newFindings is empty; never throws.
 *
 * @returns {Readonly<object>|null}
 */
function sensorArtifactFiled(turn, _tuple, ctx) {
  if (!hasSignal(turn, 'artifact_filed')) return null;

  const roomDir = (ctx && typeof ctx === 'object' && typeof ctx.roomDir === 'string') ? ctx.roomDir : '';
  if (!roomDir) return null;

  // The shipped CASC-01 side-channel path (mirrors room-proactive + post-write).
  const sideChannel = path.join(roomDir, '.mindrian', 'last-cascade.json');
  const payload = readJsonSafe(sideChannel);
  if (!payload || typeof payload !== 'object') return null;

  const pi = payload.proactive_intelligence;
  const newFindings = (pi && Array.isArray(pi.newFindings)) ? pi.newFindings : [];
  if (newFindings.length === 0) return null; // soft-fail: cascade ran, nothing new

  // Pick the edge type off the first finding (highest-confidence first per the
  // cascade producer). A CONTRADICT edge -> contradiction reach; else cross_room.
  const first = newFindings[0] || {};
  const findingType = typeof first.type === 'string' ? first.type.toUpperCase() : '';
  const isContradiction = findingType.indexOf('CONTRADICT') !== -1;

  const reach_id = isContradiction ? 'contradiction' : 'cross_room';
  const posture = isContradiction ? 'pull_back' : 'push_forward';

  return makeReach({
    reach_id: reach_id,
    posture: posture,
    // Dispatch names the shipped cascade surface (the cross-relationship
    // proactive-intelligence finding render). Handle, not user content.
    dispatch: 'cascade-cross-relationship-surface',
    companions: [],
    signal: 'artifact_filed',
    // LOCAL scalars only: the finding count + the edge-type enum. No message
    // body, no section names that could carry user content beyond the enum.
    evidence: { finding_count: newFindings.length, edge_type: findingType || 'unknown' },
  });
}

// ---------- The sensor registry (canonical order) ----------
//
// Canonical order: SENS-01 (first-material) then SENS-06 (artifact-filed).
// Tasks/plans 02-03 append their detectors here. dispatchSensors iterates this
// in order; each entry is a sensorFn(turn, tuple, ctx) -> candidate-reach|null.
const SENSOR_REGISTRY = [
  sensorFirstMaterial,
  sensorArtifactFiled,
  // Plan 02 (wave 2) detectors:
  sensorLaggingComponent,
  sensorMethodologyDecision,
  sensorGateApproach,
  // Plan 03 (wave 3) detectors:
  sensorExternalFact,
  sensorJtbdReweight,
  // Phase 150-05 detector:
  sensorMemoryCortex,
  // Phase 160-03 detector (R6 -- recency as a reach signal):
  sensorRecency,
];

// ---------- dispatchSensors: the pure chokepoint ----------

/**
 * Run every registered sensor in canonical order and collect the non-null
 * candidate reaches. Pure / sync / LOCAL-first. Never throws on malformed
 * input -- a sensor that throws is treated as "did not fire" (soft-fail to
 * null), so one bad sensor cannot poison the dispatch.
 *
 * This function NEVER mutates routing_source and NEVER calls decide()
 * (Phase 144 fence). It only PRODUCES candidate reaches.
 *
 * @param {object} turn  -- the turn signal bag
 * @param {object} tuple -- the /mos:diagnose { problem_type, complexity, stage }
 * @param {object} ctx   -- LOCAL context
 * @returns {Array<object>} candidate reaches (possibly empty)
 */
function dispatchSensors(turn, tuple, ctx) {
  // Phase 150.5 one-seam normalization: normalize ONCE at entry so EVERY
  // sensor sees the production turn shape repaired (text aliased from
  // userText; signals derived from the two shipped side-channels and merged
  // additively). A normalization fault degrades to the raw turn (soft-fail
  // discipline). normalizeTurn returns a copy -- the caller's turn is never
  // mutated (the D-03a structural guarantee).
  let normalized = turn;
  try {
    normalized = normalizeTurn(turn, ctx);
  } catch (_e) {
    normalized = turn; // soft-fail: degrade to the raw turn
  }

  const out = [];
  for (const sensor of SENSOR_REGISTRY) {
    if (typeof sensor !== 'function') continue;
    let reach = null;
    try {
      reach = sensor(normalized, tuple, ctx);
    } catch (_e) {
      reach = null; // soft-fail: a throwing sensor did not fire
    }
    if (reach && typeof reach === 'object' && REACH_IDS.indexOf(reach.reach_id) !== -1) {
      out.push(reach);
    }
  }
  return out;
}

module.exports = {
  dispatchSensors: dispatchSensors,
  SENSOR_REGISTRY: SENSOR_REGISTRY,
  REACH_IDS: REACH_IDS,
  POSTURE_IDS: POSTURE_IDS,
  // Sensor functions (the two shipped-substrate sensors; exported for the
  // must_haves contract + downstream registration).
  sensorFirstMaterial: sensorFirstMaterial,
  sensorArtifactFiled: sensorArtifactFiled,
  // Plan 02 detectors:
  sensorLaggingComponent: sensorLaggingComponent,
  sensorMethodologyDecision: sensorMethodologyDecision,
  sensorGateApproach: sensorGateApproach,
  // Plan 03 detectors:
  sensorExternalFact: sensorExternalFact,
  sensorJtbdReweight: sensorJtbdReweight,
  // Phase 150-05 detector:
  sensorMemoryCortex: sensorMemoryCortex,
  // Phase 160-03 detector (R6):
  sensorRecency: sensorRecency,
  // Shared LOCAL helpers (exposed for the Task-2 sensors + tests).
  makeReach: makeReach,
  readJsonSafe: readJsonSafe,
  hasSignal: hasSignal,
  problemTypeOf: problemTypeOf,
  // Phase 150.5 one-seam normalization (SENS-FIX-01):
  normalizeTurn: normalizeTurn,
  deriveTurnSignals: deriveTurnSignals,
  SIGNAL_FRESHNESS_MS: SIGNAL_FRESHNESS_MS,
};
