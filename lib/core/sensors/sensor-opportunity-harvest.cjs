'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 219-03 -- SENS-14 opportunity-harvest detector: the REQ-2 sensor half.
 *
 * This detector reads the LOCAL side-channel
 * <roomDir>/.mindrian/last-opportunity-harvest.json that the Phase 219-03
 * producer (lib/core/eureka/opportunity-harvest.cjs) wrote after a READ-ONLY
 * graph-event scan (bridge / whitespace / contradiction / eureka_proposal /
 * meeting_filing scored per the Q1..Q8 rubric), and SURFACES the
 * qualification-card offer the top candidate represents. It PRODUCES a
 * candidate reach; it never routes and never executes (Phase 144 fence).
 *
 * NAMING DE-COLLISION (checker MAJOR, logged): Phase 188's
 * lib/hmi/harvest-scope-state.cjs owns the bare 'harvest' name and writes
 * <roomDir>/.mindrian/harvest-scope-state.json. This sensor's surfaces are
 * namespaced: sensor-opportunity-harvest.cjs / last-opportunity-harvest.json /
 * sensorOpportunityHarvest.
 *
 * SENSOR ID: SENS-14. SENS-13 = eureka (the last registered id, verified free
 * against the live lib/core/insight-sensors.cjs this session, 2026-07-13, per
 * the Brain-mandated build-time re-check). SENS-14 is free.
 *
 * FROZEN REACH (CIRS R3, D-02): this sensor rides the EXISTING context_block
 * reach (the SENS-11 expert-skill precedent) with signal 'harvest'. It mints
 * NO 7th reach id; deep_research stays reserved for the [Explore] verb
 * (planner decision resolving RESEARCH open question 1 / A2). Fail closed at
 * load if the reach ever drifts off the frozen REACH_IDS bank.
 *
 * POSTURE 'hold': a STANDING SUGGESTION at the Decision Gate, never an
 * auto-open. The dispatch slug 'qualify-opportunity' is the born-wired
 * command surface Plan 04 mints (the 213 Plan 03 born-wired-at-feature-time
 * precedent); opportunities are DETECTED and OFFERED, never auto-filed.
 *
 * FIRING PRECONDITION (the Q2 Connection hard gate RESTATED at the sensor):
 * fire ONLY when the fresh side-channel carries at least one candidate whose
 * connection_count >= 1. One dot is noise; the producer already gates, and
 * the sensor re-asserts so a hand-edited side-channel cannot smuggle a
 * zero-connection candidate into a reach (T-219-11).
 *
 * CANON PART 8 (evidence is enum/handle-only): the evidence bag carries a
 * count, an opaque candidate-id handle, and closed enums (lens, band) plus
 * one quantized scalar (score). Zero user prose crosses. The Part-8
 * five-tripwire sweep spans lib/core/sensors/* automatically.
 *
 * FRESHNESS (Spoofing mitigation T-219-11): a stale side-channel never
 * re-fires the sensor. The 30-minute window + the WR-01 future-mtime guard is
 * REPLICATED locally here -- we do NOT import insight-sensors.cjs (that would
 * be a circular require from a sensors/ file, Pitfall 4); only
 * ./sensor-types.cjs is required.
 *
 * Pure / sync / LOCAL-first, soft-fail-to-null on every malformed input;
 * never throws. House rule: hyphens only, no em-dashes.
 */

const fs = require('node:fs');
const path = require('node:path');

const { makeReach, REACH_IDS } = require('./sensor-types.cjs');

// SENS-14: the next free sensor id (13 = eureka is the last registered).
const SENSOR_ID = 'SENS-14';

// FROZEN: rides the existing context_block reach (D-02; the SENS-11
// precedent). Fail closed at load if it ever drifts off the frozen bank.
const REACH_ID = 'context_block';
if (REACH_IDS.indexOf(REACH_ID) === -1) {
  throw new Error('sensor-opportunity-harvest: REACH_ID "' + REACH_ID + '" is not in the frozen REACH_IDS bank');
}

// The closed schema version the producer stamps; a mismatch never fires.
const SCHEMA_VERSION = 1;

// The side-channel freshness window (REPLICATED from insight-sensors.cjs
// SIGNAL_FRESHNESS_MS, NOT imported -- Pitfall 4 circular require). 30 minutes.
const HARVEST_SIGNAL_FRESHNESS_MS = 30 * 60 * 1000;

// ---------- LOCAL helpers (replicated, sync, soft-fail) ----------

/**
 * Read + parse a JSON file, returning null on any failure. LOCAL only.
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
 * True when the file exists and its mtime is within
 * HARVEST_SIGNAL_FRESHNESS_MS. WR-01 guard: a FUTURE-dated mtime (clock skew,
 * archive restore) must NOT read as fresh forever -- age must be NON-NEGATIVE
 * and within the window. Soft-fail to false; never throws.
 */
function isFreshFile(filePath) {
  try {
    const st = fs.statSync(filePath);
    const age = Date.now() - st.mtimeMs;
    return age >= 0 && age <= HARVEST_SIGNAL_FRESHNESS_MS;
  } catch (_e) {
    return false;
  }
}

// ---------- SENS-14: the opportunity-harvest sensor ----------

/**
 * SENS-14 -- fresh scored opportunity candidates -> the context_block reach
 * carrying the qualification-card offer.
 *
 * Fires (returns a Readonly reach) ONLY when ALL preconditions hold:
 *   - ctx.roomDir is a non-empty string, AND
 *   - <roomDir>/.mindrian/last-opportunity-harvest.json exists and is FRESH
 *     (stat-before-parse; mtime within the 30-minute window, non-negative
 *     age), AND
 *   - it parses and payload.schema_version === 1, AND
 *   - payload.candidates contains at least one candidate whose
 *     connection_count >= 1 (the Q2 Connection hard gate restated here).
 *
 * On any malformed input (bad JSON, missing roomDir, wrong schema_version,
 * stale/future mtime, zero gated candidates) it soft-fails to null and NEVER
 * throws.
 *
 * @param {object} turn   -- the normalized turn (unused for detection here)
 * @param {object} tuple  -- the /mos:diagnose tuple (unused for detection here)
 * @param {object} ctx    -- LOCAL context ({ roomDir })
 * @returns {Readonly<object>|null}
 */
function sensorOpportunityHarvest(turn, tuple, ctx) {
  try {
    const roomDir = (ctx && typeof ctx === 'object' && typeof ctx.roomDir === 'string') ? ctx.roomDir : '';
    if (!roomDir) return null;

    const sideChannel = path.join(roomDir, '.mindrian', 'last-opportunity-harvest.json');

    // Freshness gate BEFORE the parse (stat-before-parse): a stale or
    // future-dated side-channel never re-fires the sensor (T-219-11).
    if (!isFreshFile(sideChannel)) return null;

    const payload = readJsonSafe(sideChannel);
    if (!payload || typeof payload !== 'object') return null;
    if (payload.schema_version !== SCHEMA_VERSION) return null;

    const all = Array.isArray(payload.candidates) ? payload.candidates : [];
    // The Q2 Connection hard gate, re-asserted: only connected candidates
    // count toward the fire decision ("one dot is noise").
    const gated = all.filter(function (c) {
      return c && typeof c === 'object'
        && typeof c.connection_count === 'number' && c.connection_count >= 1;
    });
    if (gated.length === 0) return null;

    // The producer sorted by score desc; re-derive the top defensively so a
    // hand-reordered file cannot promote a weaker candidate.
    let top = gated[0];
    for (const c of gated) {
      if (typeof c.score === 'number' && typeof top.score === 'number' && c.score > top.score) top = c;
    }

    // Evidence: a count, an opaque candidate-id handle, closed enums, and a
    // quantized scalar ONLY -- never titles or artifact text (Canon Part 8).
    return makeReach({
      reach_id: REACH_ID,
      posture: 'hold',
      dispatch: 'qualify-opportunity',
      companions: [],
      signal: 'harvest',
      evidence: {
        candidate_count: gated.length,
        top_candidate_id: (typeof top.candidate_id === 'string') ? top.candidate_id : '',
        top_lens: (typeof top.lens === 'string') ? top.lens : 'unknown',
        top_band: (typeof top.band === 'string') ? top.band : 'unknown',
        top_score: (typeof top.score === 'number') ? top.score : 0,
      },
    });
  } catch (_e) {
    return null; // soft-fail: a malformed input never throws out of the sensor
  }
}

module.exports = {
  sensorOpportunityHarvest: sensorOpportunityHarvest,
  SENSOR_ID: SENSOR_ID,
  REACH_ID: REACH_ID,
  SCHEMA_VERSION: SCHEMA_VERSION,
  HARVEST_SIGNAL_FRESHNESS_MS: HARVEST_SIGNAL_FRESHNESS_MS,
  // Replicated LOCAL helpers (exposed for the Plan 03 suite).
  readJsonSafe: readJsonSafe,
  isFreshFile: isFreshFile,
};
