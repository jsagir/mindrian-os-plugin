'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 213-02 -- SENS-13 eureka detector: the KEY's sensor half.
 *
 * SEED-049 THE KEY: "a command-triggered eureka engine is dead on arrival;
 * students do not type commands." The sensor is the key. This detector reads
 * the LOCAL side-channel <roomDir>/.mindrian/last-eureka.json that the Phase
 * 213-02 producer (lib/core/eureka/eureka-reach-runner.cjs) wrote after a
 * guard-cleared bridge scan, and SURFACES the candidate reach the bridge
 * represents. It PRODUCES a candidate reach; it never routes and never
 * executes (Phase 144 fence).
 *
 * SENSOR ID: SENS-13. SENS-11 = expert-skill, SENS-12 = room-pick (both taken,
 * verified against lib/core/insight-sensors.cjs 2026-07-06). SENS-13 is free.
 *
 * SCHEMA v2 (Phase 355 D-53, amended, bumped in the SAME atomic commit as
 * eureka-reach-runner.cjs's own SIDE_CHANNEL_SCHEMA_VERSION bump): the closed
 * side-channel payload gains `stamp` and `opportunity_handle`. The reach id
 * and signal stay unchanged (D-41); see the evidence-bag note below for the
 * stamp_* fields this bump adds.
 *
 * FROZEN REACH (CIRS R3, Phase 148 lockstep): this sensor rides the EXISTING
 * deep_research reach (member 5 of the frozen REACH_IDS six). It mints NO 7th
 * reach id. deep_research maps downstream to Spawn-Sub-Agent -> the
 * subagent-dispatcher (navigation-engine.cjs); the sensor names only the
 * reach, not the route.
 *
 * POSTURE 'hold' (the SENS-SHOW precedent): a standing suggestion at the
 * Decision Gate, never an auto-open. The Brain RECOMMENDS, never TRIGGERS;
 * decide() (not this sensor) decides surfacing and the navigator (not
 * decide()) decides acting.
 *
 * POST-GuardGate (the FLAGGED firing precondition, RESEARCH Open Question 2):
 * a restatement never becomes an offer. The sensor fires ONLY when the
 * side-channel's guard verdict is 'transferable' AND the guard was available;
 * guard.available false or a guard key absent -> no fire (the honest degrade:
 * no guard = no fire, NEVER no guard = unguarded fire). The guard verdict is
 * produced by the runner probing the LIVE eureka-critic module (Pattern 3),
 * never inferred from a file existing on disk.
 *
 * CANON PART 8 (side-channel is enum/handle-only): the evidence bag carries
 * closed enums (band, surprise_type, guard verdict/confidence), opaque room.db
 * node-id HANDLES (a_handle / b_handle -- node ids, NEVER titles or artifact
 * text), a quantized scalar (differential), and (Phase 355 D-41) the stamp
 * enums (stamp_verification, stamp_backend, stamp_direction, stamp_judge,
 * stamp_reason) plus stamp_path (a formatted string over canon Framework
 * names, never room content) and opportunity_handle (an opaque local id).
 * Zero user prose crosses. This evidence stays on the LOCAL decision trace
 * and never egresses.
 *
 * FRESHNESS (Spoofing mitigation T-213-06): a stale side-channel never
 * re-fires the sensor. The 30-minute EUREKA_SIGNAL_FRESHNESS_MS window plus the
 * WR-01 future-mtime guard (clock skew / archive restore) is REPLICATED locally
 * here -- we do NOT import insight-sensors.cjs (that would be a circular require
 * from a sensors/ file).
 *
 * Pure / sync / LOCAL-first, soft-fail-to-null on every malformed input; never
 * throws. The routing fence + Part-8 sweep tests already span every
 * lib/core/sensors/*.cjs so this file is auto-covered.
 *
 * House rule: hyphens only, no em-dashes.
 */

const fs = require('node:fs');
const path = require('node:path');

const { makeReach, REACH_IDS } = require('./sensor-types.cjs');
// Phase 355 D-01/D-07: the two wire ids are DIRECTIONS itself (zod-free,
// crypto-only require -- never verification-stamp.cjs, never zod).
const directionConvention = require('../direction-convention.cjs');
// Phase 355 D-49: formatPathText only (a pure formatter, no zod, no fs) --
// renders a verified stamp's evidence path identically to every other
// surface this phase touches.
const { formatPathText } = require('../verification-stamp-format.cjs');

// SENS-13: the next free sensor id (11 = expert-skill, 12 = room-pick).
const SENSOR_ID = 'SENS-13';

// FROZEN: rides the existing deep_research reach. Fail closed at load if it
// ever drifts off the frozen bank (mirrors sensor-room-pick.cjs).
const REACH_ID = 'deep_research';
if (REACH_IDS.indexOf(REACH_ID) === -1) {
  throw new Error('sensor-eureka: REACH_ID "' + REACH_ID + '" is not in the frozen REACH_IDS bank');
}

// The closed schema version the producer stamps; a mismatch never fires.
// Phase 355 D-53: bumped 1 -> 2 in the SAME atomic commit as the runner's
// own SIDE_CHANNEL_SCHEMA_VERSION bump (see eureka-reach-runner.cjs header).
const SCHEMA_VERSION = 2;

// The FLAGGED POST-GuardGate lock: only a 'transferable' guard verdict fires.
const GUARD_FIRING_VERDICT = 'transferable';

// The strong-gating leg of the Pitfall-2 rank-starvation mitigation: fire only
// on a genuinely surprising band; a low/moderate differential is not an offer.
const FIRING_BANDS = Object.freeze(['opportunity', 'high', 'breakthrough']);

// Phase 355 D-01/D-07: alias of DIRECTIONS, not a second copy of the two
// closed D1 surprise types (structural_transfer | semantic_implementation).
const FIRING_SURPRISE_TYPES = directionConvention.DIRECTIONS;

// The side-channel freshness window (REPLICATED from insight-sensors.cjs
// SIGNAL_FRESHNESS_MS, NOT imported -- a sensors/ file must not require
// insight-sensors.cjs, that is circular). 30 minutes.
const EUREKA_SIGNAL_FRESHNESS_MS = 30 * 60 * 1000;

// Phase 355 D-42: the fire-once dedup ledger relpath, REPLICATED from
// eureka-reach-runner.cjs (the sensor-url-ingest.cjs precedent: a read-only
// detector never requires its producer's own module). The sensor only READS
// this ledger; the runner's markEurekaReachSurfaced is the only writer.
const EUREKA_REACH_LEDGER_RELPATH = path.join('.mindrian', 'eureka-reach-ledger.json');

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

/**
 * True when the file exists and its mtime is within EUREKA_SIGNAL_FRESHNESS_MS.
 * WR-01 guard: a FUTURE-dated mtime (WSL2/Windows-mount clock skew, archive
 * extraction, backup restore) must NOT read as fresh forever -- age must be
 * NON-NEGATIVE and within the window. Soft-fail to false; never throws.
 */
function isFreshFile(filePath) {
  try {
    const st = fs.statSync(filePath);
    const age = Date.now() - st.mtimeMs;
    return age >= 0 && age <= EUREKA_SIGNAL_FRESHNESS_MS;
  } catch (_e) {
    return false;
  }
}

// ---------- SENS-13: the eureka-bridge sensor ----------

/**
 * SENS-13 -- fresh guard-cleared eureka bridge -> the deep_research reach.
 *
 * Fires (returns a Readonly reach) ONLY when ALL preconditions hold:
 *   - ctx.roomDir is a non-empty string, AND
 *   - <roomDir>/.mindrian/last-eureka.json exists and is FRESH (mtime within
 *     the 30-minute window, non-negative age), AND
 *   - it parses and payload.schema_version === 2, AND
 *   - payload.guard.available === true AND payload.guard.verdict ===
 *     'transferable' (the FLAGGED POST-GuardGate lock; a restatement /
 *     pseudoscience / general_shallow verdict, or an absent/unavailable guard,
 *     returns null -- no guard = no fire), AND
 *   - payload.bridge.band is one of {opportunity, high, breakthrough}, AND
 *   - payload.bridge.surprise_type is one of the two closed D1 types, AND
 *   - (Phase 355 D-42) when payload.opportunity_handle is a non-empty
 *     string, the fire-once ledger <roomDir>/.mindrian/eureka-reach-ledger.json
 *     carries NO entry for it -- an absent ledger fires (fresh room), a
 *     present entry returns null (already surfaced), and a ledger that
 *     EXISTS but does not parse fails CLOSED to null (mirrors the
 *     sensor-url-ingest.cjs dedup precedent). No opportunity_handle at all
 *     skips this check entirely.
 *
 * On any malformed input (bad JSON, missing roomDir, wrong schema_version,
 * stale/future mtime, low/moderate band, an already-surfaced or corrupt
 * ledger) it soft-fails to null and NEVER throws.
 *
 * EVIDENCE (Phase 355 D-41, amended): the bag gains opportunity_handle plus
 * six stamp_* fields (stamp_verification, stamp_backend, stamp_direction,
 * stamp_judge, stamp_reason, stamp_path) -- all flat strings, '' when the
 * side channel carries no stamp (payload.stamp === null) or when a field is
 * legitimately absent (e.g. stamp_reason on a verified stamp). stamp_path is
 * formatPathText(nodes, edges) on a verified stamp, '' otherwise. reach_id
 * stays 'deep_research' and signal stays 'eureka_bridge' (no seventh sensor
 * lockstep). Every existing field (band, surprise_type, guard_verdict,
 * guard_confidence, a_handle, b_handle, differential) is byte-unchanged.
 *
 * @param {object} turn   -- the normalized turn (unused for detection here)
 * @param {object} tuple  -- the /mos:diagnose tuple (unused for detection here)
 * @param {object} ctx    -- LOCAL context ({ roomDir })
 * @returns {Readonly<object>|null}
 */
function sensorEureka(turn, tuple, ctx) {
  try {
    const roomDir = (ctx && typeof ctx === 'object' && typeof ctx.roomDir === 'string') ? ctx.roomDir : '';
    if (!roomDir) return null;

    const sideChannel = path.join(roomDir, '.mindrian', 'last-eureka.json');

    // Freshness gate BEFORE the parse (stat-before-parse): a stale or
    // future-dated side-channel never re-fires the sensor (T-213-06).
    if (!isFreshFile(sideChannel)) return null;

    const payload = readJsonSafe(sideChannel);
    if (!payload || typeof payload !== 'object') return null;
    if (payload.schema_version !== SCHEMA_VERSION) return null;

    // POST-GuardGate lock: guard must be present, available, and 'transferable'.
    const guard = payload.guard;
    if (!guard || typeof guard !== 'object') return null;
    if (guard.available !== true) return null;
    if (guard.verdict !== GUARD_FIRING_VERDICT) return null;

    const bridge = payload.bridge;
    if (!bridge || typeof bridge !== 'object') return null;
    if (FIRING_BANDS.indexOf(bridge.band) === -1) return null;
    if (FIRING_SURPRISE_TYPES.indexOf(bridge.surprise_type) === -1) return null;

    // Phase 355 D-42: the read-only fire-once dedup check. Only runs when the
    // payload actually carries a non-empty opportunity_handle -- the
    // hook-path scan producer never sets one, so this is a no-op for it.
    const opportunityHandle = (typeof payload.opportunity_handle === 'string' && payload.opportunity_handle) ? payload.opportunity_handle : '';
    if (opportunityHandle) {
      const ledgerPath = path.join(roomDir, EUREKA_REACH_LEDGER_RELPATH);
      if (fs.existsSync(ledgerPath)) {
        const ledger = readJsonSafe(ledgerPath);
        if (!ledger || typeof ledger !== 'object') return null; // corrupt: fail closed
        const entries = (ledger.entries && typeof ledger.entries === 'object') ? ledger.entries : {};
        if (Object.prototype.hasOwnProperty.call(entries, opportunityHandle)) return null; // already surfaced
      }
    }

    // Phase 355 D-41: the stamp evidence, flat strings only, '' when the side
    // channel carries no stamp or a field is legitimately absent.
    const stamp = (payload.stamp && typeof payload.stamp === 'object') ? payload.stamp : null;
    const stampIsVerified = !!stamp && (stamp.verification === 'strong' || stamp.verification === 'indirect');
    const stampPath = (stampIsVerified && Array.isArray(stamp.path_nodes) && Array.isArray(stamp.path_edges))
      ? formatPathText(stamp.path_nodes, stamp.path_edges)
      : '';

    // Evidence: enums + opaque node-id HANDLES + a quantized scalar + the
    // stamp fields ONLY. The handles a_handle/b_handle are room.db node ids
    // (opaque), NEVER titles or artifact text. This bag stays on the LOCAL
    // decision trace (Canon Part 8).
    return makeReach({
      reach_id: REACH_ID,
      posture: 'hold',
      dispatch: 'eureka-bridge-offer (211 tri-modal substrate)',
      companions: [],
      signal: 'eureka_bridge',
      evidence: {
        band: bridge.band,
        surprise_type: bridge.surprise_type,
        guard_verdict: guard.verdict,
        guard_confidence: (typeof guard.confidence === 'string' && guard.confidence) ? guard.confidence : 'unknown',
        a_handle: (typeof bridge.a_handle === 'string') ? bridge.a_handle : '',
        b_handle: (typeof bridge.b_handle === 'string') ? bridge.b_handle : '',
        differential: (typeof bridge.differential_quantized === 'number') ? bridge.differential_quantized : 0,
        opportunity_handle: opportunityHandle,
        stamp_verification: (stamp && typeof stamp.verification === 'string') ? stamp.verification : '',
        stamp_backend: (stamp && typeof stamp.backend === 'string') ? stamp.backend : '',
        stamp_direction: (stamp && typeof stamp.direction === 'string') ? stamp.direction : '',
        stamp_judge: (stamp && typeof stamp.judge === 'string') ? stamp.judge : '',
        stamp_reason: (stamp && typeof stamp.reason === 'string') ? stamp.reason : '',
        stamp_path: stampPath,
      },
    });
  } catch (_e) {
    return null; // soft-fail: a malformed input never throws out of the sensor
  }
}

module.exports = {
  sensorEureka: sensorEureka,
  SENSOR_ID: SENSOR_ID,
  REACH_ID: REACH_ID,
  SCHEMA_VERSION: SCHEMA_VERSION,
  GUARD_FIRING_VERDICT: GUARD_FIRING_VERDICT,
  FIRING_BANDS: FIRING_BANDS,
  FIRING_SURPRISE_TYPES: FIRING_SURPRISE_TYPES,
  EUREKA_SIGNAL_FRESHNESS_MS: EUREKA_SIGNAL_FRESHNESS_MS,
  // Phase 355 D-42: exposed for the Task-3 suite + the surfacing seam (355-22).
  EUREKA_REACH_LEDGER_RELPATH: EUREKA_REACH_LEDGER_RELPATH,
  // Replicated LOCAL helpers (exposed for the Task-3 suite + plan 03).
  readJsonSafe: readJsonSafe,
  isFreshFile: isFreshFile,
};
