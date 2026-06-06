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
 *
 * Pure / sync / LOCAL-first. node built-ins + project libs only. No new deps.
 * House rule: hyphens only, no em-dashes.
 */

const fs = require('node:fs');
const path = require('node:path');

const { makeReach, REACH_IDS, POSTURE_IDS } = require('./sensors/sensor-types.cjs');

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

// ---------- SENS-01: first-material sensor (Task 2 registers it) ----------
//
// Defined in Task 2. Placeholder declaration kept null until Task 2 wires the
// body + registers it in SENSOR_REGISTRY. (Task 1 ships the spine; the two
// shipped-substrate sensors land in Task 2.)
let sensorFirstMaterial = null;
let sensorArtifactFiled = null;

// ---------- The sensor registry (canonical order) ----------
//
// Task 1: empty. Tasks 2-3 register the two shipped-substrate sensors here.
// dispatchSensors iterates this in order; each entry is a sensorFn.
const SENSOR_REGISTRY = [];

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
  const out = [];
  for (const sensor of SENSOR_REGISTRY) {
    if (typeof sensor !== 'function') continue;
    let reach = null;
    try {
      reach = sensor(turn, tuple, ctx);
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
  // Sensor functions (bodies land in Task 2; exported names stable for the
  // must_haves contract + downstream registration).
  sensorFirstMaterial: sensorFirstMaterial,
  sensorArtifactFiled: sensorArtifactFiled,
  // Shared LOCAL helpers (exposed for the Task-2 sensors + tests).
  makeReach: makeReach,
  readJsonSafe: readJsonSafe,
  hasSignal: hasSignal,
  problemTypeOf: problemTypeOf,
};
