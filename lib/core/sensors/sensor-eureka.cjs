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
 * PHASE 314-03 -- EVIDENCE SHAPE B (portfolio movement), same sensor (D-06).
 * Canon Part 7: broaden the sensor, mint no second one. SENSOR_REGISTRY gets
 * no new entry and decide() is not edited. SENS-13 now reads TWO evidence
 * shapes and returns the first that fires:
 *   shape A  the pairwise bridge side-channel (above), unchanged, wins a tie.
 *   shape B  the STORED portfolio movement files
 *            <roomDir>/.mindrian/eureka-portfolio/movement-<scope_id>.json
 *            that the portfolio run command wrote (plan 314-04).
 * D-01: the portfolio runs on demand only. This sensor reads the stored diff.
 * D-02: the sensor NEVER starts a portfolio run and never scores a pair. No
 * movement file means silence.
 * Freshness for shape B is 24 hours, not 30 minutes: the movement is made at
 * run time, so it must stay offerable after the run. A movement made from a
 * stub encoder, a seen movement, a stale movement or a malformed file never
 * fires. A corrupt seen file fails closed to silence.
 * Dedup: the fire-once mark that decide() writes is keyed to the signal
 * eureka_bridge only, so shape B dedupes by the 24-hour window plus the seen
 * list that the run command and the Desktop view write (markSeen in
 * portfolio-snapshot.cjs). Movement is stored per scope, so this sensor scans
 * the store folder (at most 8 newest files by mtime) and fires for the unseen
 * valid movement with the newest detected_at.
 * Handles, enums and counts only. This sensor never requires the producer
 * modules (portfolio-snapshot, portfolio-movement); the constants are
 * replicated here and pinned equal by tests/test-314-sensor-shape-b.cjs (B9).
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

// Phase 355.1-11 (AMB-07): the ambient delta-state side channel relpath,
// REPLICATED from lib/core/sensors/sensor-room-delta.cjs's own
// DELTA_STATE_RELPATH (the same sensor-url-ingest.cjs precedent this file
// already follows for EUREKA_REACH_LEDGER_RELPATH above -- a sensors/ file
// never requires a sibling sensor module). This sensor only READS this
// file, to learn the room's confirmed framing; the ambient evaluator
// (scripts/scout-cadence-guard.cjs's writeRoomDeltaState) is the only
// writer. Pinned equal to the sibling's own constant by
// tests/test-3551-surfacing.cjs.
const ROOM_DELTA_STATE_RELPATH = path.join('.mindrian', 'last-room-delta.json');
// The closed schema version the evaluator stamps on the delta-state file
// (mirrors sensor-room-delta.cjs's own DELTA_STATE_SCHEMA_VERSION); a
// mismatch never contributes a framing.
const ROOM_DELTA_STATE_SCHEMA_VERSION = 1;

// ---------- Phase 314-03: evidence shape B constants (REPLICATED) ----------
// Replicated from lib/core/eureka/portfolio-snapshot.cjs (a sensors file never
// requires its producer). Pinned equal by tests/test-314-sensor-shape-b.cjs B9.
const PORTFOLIO_STORE_RELPATH = path.join('.mindrian', 'eureka-portfolio');
const PORTFOLIO_MOVEMENT_PREFIX = 'movement-';
const PORTFOLIO_MOVEMENT_SUFFIX = '.json';
const PORTFOLIO_SCOPE_ID_RE = /^(?:room|s_[0-9a-f]{8})$/;
const PORTFOLIO_MOVEMENT_FILE_RE = /^movement-(room|s_[0-9a-f]{8})\.json$/;
const PORTFOLIO_SEEN_RELPATH = path.join('.mindrian', 'eureka-portfolio', 'movement-seen.json');
const PORTFOLIO_MAX_FILES = 8;
const PORTFOLIO_SCHEMA_VERSION = 1;
// 24 hours: the movement is made at run time, so it must stay offerable after
// the run (the bridge side-channel is 30 minutes because it is made by a scan).
const PORTFOLIO_FRESHNESS_MS = 24 * 60 * 60 * 1000;
const PORTFOLIO_SIGNAL = 'eureka_portfolio_movement';
const PORTFOLIO_HANDLE_RE = /^[A-Za-z0-9_.:-]{1,128}$/;
const MOVEMENT_ID_RE = /^pm_[0-9a-f]{12}$/;
const PORTFOLIO_ENVELOPE_KIND = 'portfolio_movement';
const PORTFOLIO_EVENT_KINDS = Object.freeze(['band_cross', 'tail_enter', 'top_n_reshuffle']);
const PORTFOLIO_BAND_ORDER = Object.freeze(['none', 'low', 'moderate', 'opportunity', 'high', 'breakthrough']);
const PORTFOLIO_MAX_EVENTS = 3;
const PORTFOLIO_MAX_FILE_BYTES = 64 * 1024;
const PORTFOLIO_MAX_SEEN = 64;
const PORTFOLIO_ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

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
 * True when the file exists and its mtime is within EUREKA_SIGNAL_FRESHNESS_MS.
 * WR-01 guard: a FUTURE-dated mtime (WSL2/Windows-mount clock skew, archive
 * extraction, backup restore) must NOT read as fresh forever -- age must be
 * within MTIME_FUTURE_TOLERANCE_MS of non-negative (tolerating the
 * sub-millisecond write-then-stat slop) and within the window. Soft-fail to
 * false; never throws.
 */
function isFreshFile(filePath) {
  try {
    const st = fs.statSync(filePath);
    const age = Date.now() - st.mtimeMs;
    return age >= -MTIME_FUTURE_TOLERANCE_MS && age <= EUREKA_SIGNAL_FRESHNESS_MS;
  } catch (_e) {
    return false;
  }
}

/**
 * Phase 314-03: the same stat-before-parse and future-mtime guard as
 * isFreshFile, with the window passed in. isFreshFile itself is untouched.
 * Soft-fail to false; never throws.
 */
function isFreshWithin(filePath, windowMs) {
  try {
    const st = fs.statSync(filePath);
    const age = Date.now() - st.mtimeMs;
    return age >= -MTIME_FUTURE_TOLERANCE_MS && age <= windowMs;
  } catch (_e) {
    return false;
  }
}

/**
 * Phase 355.1-11 (AMB-07): read-only framing lookup. Returns the confirmed
 * framing id for a given opportunity_handle, or '' when no match is found.
 * Fires ONLY when opportunityHandle is a non-empty string; stats then
 * parses <roomDir>/.mindrian/last-room-delta.json (readJsonSafe already
 * stats-before-parse via fs.existsSync); the framing counts ONLY when the
 * file's schema_version is ROOM_DELTA_STATE_SCHEMA_VERSION, its own
 * opportunity_handle equals opportunityHandle (the handle-matched read --
 * a stale or unrelated delta state never lends its framing to a different
 * opportunity), and framing is a member of the frozen FRAMING_IDS bank.
 * Never throws; soft-fails to ''.
 */
function readFramingForHandle(roomDir, opportunityHandle) {
  if (typeof opportunityHandle !== 'string' || !opportunityHandle) return '';
  try {
    const deltaStatePath = path.join(roomDir, ROOM_DELTA_STATE_RELPATH);
    const payload = readJsonSafe(deltaStatePath);
    if (!payload || typeof payload !== 'object') return '';
    if (payload.schema_version !== ROOM_DELTA_STATE_SCHEMA_VERSION) return '';
    if (payload.opportunity_handle !== opportunityHandle) return '';
    if (typeof payload.framing !== 'string' || directionConvention.FRAMING_IDS.indexOf(payload.framing) === -1) return '';
    return payload.framing;
  } catch (_e) {
    return '';
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
 * EVIDENCE (Phase 355 D-41, amended; Phase 355.1-11 AMB-07 amended again):
 * the bag gains opportunity_handle plus six stamp_* fields
 * (stamp_verification, stamp_backend, stamp_direction, stamp_judge,
 * stamp_reason, stamp_path) -- all flat strings, '' when the side channel
 * carries no stamp (payload.stamp === null) or when a field is legitimately
 * absent (e.g. stamp_reason on a verified stamp). stamp_path is
 * formatPathText(nodes, edges) on a verified stamp, '' otherwise. The bag
 * also gains one more flat string, `framing`: a FRAMING_IDS member read from
 * <roomDir>/.mindrian/last-room-delta.json ONLY when opportunity_handle is
 * non-empty and that file's own opportunity_handle equals it (the
 * handle-matched read), '' otherwise (readFramingForHandle, read-only, this
 * sensor writes nothing). reach_id stays 'deep_research' and signal stays
 * 'eureka_bridge' (no seventh sensor lockstep). Every existing field (band,
 * surprise_type, guard_verdict, guard_confidence, a_handle, b_handle,
 * differential) is byte-unchanged.
 *
 * (Phase 314-03: this is evidence shape A. The body is unchanged; it was
 * renamed from sensorEureka to readBridgeShape so sensorEureka can try shape B
 * after it.)
 *
 * @param {object} turn   -- the normalized turn (unused for detection here)
 * @param {object} tuple  -- the /mos:diagnose tuple (unused for detection here)
 * @param {object} ctx    -- LOCAL context ({ roomDir })
 * @returns {Readonly<object>|null}
 */
function readBridgeShape(turn, tuple, ctx) {
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
        // Phase 355.1-11 (AMB-07): the room's confirmed framing, read only
        // when opportunityHandle is non-empty and the delta state's own
        // handle matches; '' otherwise (a command-path scan with no
        // opportunity_handle, or no matching/fresh delta state at all).
        framing: opportunityHandle ? readFramingForHandle(roomDir, opportunityHandle) : '',
      },
    });
  } catch (_e) {
    return null; // soft-fail: a malformed input never throws out of the sensor
  }
}

// ---------- Phase 314-03: evidence shape B (portfolio movement) ----------

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function sortedKeysEqual(obj, keys) {
  if (!isPlainObject(obj)) return false;
  const have = Object.keys(obj).slice().sort();
  const want = keys.slice().sort();
  if (have.length !== want.length) return false;
  for (let i = 0; i < have.length; i += 1) {
    if (have[i] !== want[i]) return false;
  }
  return true;
}

function isPortfolioHandle(v) {
  return typeof v === 'string' && PORTFOLIO_HANDLE_RE.test(v);
}

function isCountValue(v) {
  return Number.isInteger(v) && v >= 0 && v <= Number.MAX_SAFE_INTEGER;
}

function validPortfolioEvent(e) {
  if (!isPlainObject(e)) return false;
  if (e.kind === 'band_cross') {
    if (!sortedKeysEqual(e, ['kind', 'a_handle', 'b_handle', 'from_band', 'to_band', 'direction'])) return false;
    return isPortfolioHandle(e.a_handle) && isPortfolioHandle(e.b_handle) &&
      PORTFOLIO_BAND_ORDER.indexOf(e.from_band) !== -1 && PORTFOLIO_BAND_ORDER.indexOf(e.to_band) !== -1 &&
      (e.direction === 'up' || e.direction === 'down');
  }
  if (e.kind === 'tail_enter') {
    return sortedKeysEqual(e, ['kind', 'handle']) && isPortfolioHandle(e.handle);
  }
  if (e.kind === 'top_n_reshuffle') {
    if (!sortedKeysEqual(e, ['kind', 'top_n', 'entered', 'left', 'max_shift'])) return false;
    return Number.isInteger(e.top_n) && e.top_n >= 2 && isCountValue(e.entered) && isCountValue(e.left) && isCountValue(e.max_shift);
  }
  return false;
}

/**
 * The closed-schema check for one stored movement, written here because this
 * file never requires the producer. It mirrors validateEnvelope in
 * lib/core/eureka/portfolio-movement.cjs and adds the sensor-only rules: the
 * encoder must be 'live', the counts must sum above 0 and the scope_id must
 * equal the one in the file name.
 */
function validPortfolioMovement(env, fileScopeId) {
  try {
    if (!sortedKeysEqual(env, ['schema_version', 'kind', 'movement_id', 'detected_at', 'scope', 'scope_id', 'encoder_kind', 'counts', 'events'])) return false;
    if (env.schema_version !== PORTFOLIO_SCHEMA_VERSION || env.kind !== PORTFOLIO_ENVELOPE_KIND) return false;
    if (typeof env.movement_id !== 'string' || !MOVEMENT_ID_RE.test(env.movement_id)) return false;
    if (typeof env.detected_at !== 'string' || !PORTFOLIO_ISO_RE.test(env.detected_at) || !Number.isFinite(Date.parse(env.detected_at))) return false;
    if (env.scope !== 'room' && env.scope !== 'subset') return false;
    if (typeof env.scope_id !== 'string' || !PORTFOLIO_SCOPE_ID_RE.test(env.scope_id)) return false;
    if ((env.scope === 'room') !== (env.scope_id === 'room')) return false;
    if (env.scope_id !== fileScopeId) return false;
    if (env.encoder_kind !== 'live') return false; // a stub encoder never fires
    if (!sortedKeysEqual(env.counts, PORTFOLIO_EVENT_KINDS.slice())) return false;
    let total = 0;
    for (let i = 0; i < PORTFOLIO_EVENT_KINDS.length; i += 1) {
      const c = env.counts[PORTFOLIO_EVENT_KINDS[i]];
      if (!isCountValue(c)) return false;
      total += c;
    }
    if (total <= 0) return false;
    if (!Array.isArray(env.events) || env.events.length < 1 || env.events.length > PORTFOLIO_MAX_EVENTS) return false;
    for (let i = 0; i < env.events.length; i += 1) {
      if (!validPortfolioEvent(env.events[i])) return false;
    }
    return true;
  } catch (_e) {
    return false;
  }
}

/** Read the seen list. Returns null when the file is corrupt (fail closed), else an array of ids. */
function readPortfolioSeen(roomDir) {
  const seenPath = path.join(roomDir, PORTFOLIO_SEEN_RELPATH);
  if (!fs.existsSync(seenPath)) return [];
  try {
    if (fs.statSync(seenPath).size > 16 * 1024) return null;
    const doc = JSON.parse(fs.readFileSync(seenPath, 'utf8'));
    if (!sortedKeysEqual(doc, ['schema_version', 'seen'])) return null;
    if (doc.schema_version !== PORTFOLIO_SCHEMA_VERSION || !Array.isArray(doc.seen) || doc.seen.length > PORTFOLIO_MAX_SEEN) return null;
    for (let i = 0; i < doc.seen.length; i += 1) {
      if (typeof doc.seen[i] !== 'string' || !MOVEMENT_ID_RE.test(doc.seen[i])) return null;
    }
    return doc.seen.slice();
  } catch (_e) {
    return null;
  }
}

/**
 * Evidence shape B. Scans the store folder, keeps the PORTFOLIO_MAX_FILES
 * newest movement files by mtime, and returns the reach for the unseen, fresh,
 * valid, live movement with the newest detected_at (ties: file name ascending).
 * Returns null when nothing qualifies. Never starts a run (D-02). Soft-fails to
 * null; never throws.
 */
function readPortfolioShape(roomDir) {
  try {
    const store = path.join(roomDir, PORTFOLIO_STORE_RELPATH);
    if (!fs.existsSync(store)) return null;
    const names = fs.readdirSync(store).filter(function (n) { return PORTFOLIO_MOVEMENT_FILE_RE.test(n); });
    if (names.length === 0) return null;

    const seen = readPortfolioSeen(roomDir);
    if (seen === null) return null; // corrupt seen file: fail closed

    const dated = names.map(function (n) {
      let m = 0;
      try { m = fs.statSync(path.join(store, n)).mtimeMs; } catch (_e) { m = 0; }
      return { n: n, m: m };
    });
    dated.sort(function (x, y) { return y.m - x.m || (x.n < y.n ? -1 : 1); });

    const candidates = [];
    dated.slice(0, PORTFOLIO_MAX_FILES).forEach(function (d) {
      const file = path.join(store, d.n);
      // Freshness gate BEFORE the parse (stat-before-parse).
      if (!isFreshWithin(file, PORTFOLIO_FRESHNESS_MS)) return;
      try {
        if (fs.statSync(file).size > PORTFOLIO_MAX_FILE_BYTES) return;
      } catch (_e) { return; }
      const fileScopeId = PORTFOLIO_MOVEMENT_FILE_RE.exec(d.n)[1];
      const env = readJsonSafe(file);
      if (!validPortfolioMovement(env, fileScopeId)) return;
      if (seen.indexOf(env.movement_id) !== -1) return;
      candidates.push({ n: d.n, env: env, t: Date.parse(env.detected_at) });
    });
    if (candidates.length === 0) return null;
    candidates.sort(function (x, y) { return y.t - x.t || (x.n < y.n ? -1 : 1); });

    const env = candidates[0].env;
    const first = env.events[0];
    return makeReach({
      reach_id: REACH_ID,
      posture: 'hold',
      dispatch: 'eureka-portfolio-movement-offer (stored portfolio diff)',
      companions: [],
      signal: PORTFOLIO_SIGNAL,
      evidence: {
        movement_id: env.movement_id,
        scope: env.scope,
        band_cross_count: env.counts.band_cross,
        tail_enter_count: env.counts.tail_enter,
        reshuffle_count: env.counts.top_n_reshuffle,
        first_kind: first.kind,
        first_a_handle: (first.kind === 'band_cross') ? first.a_handle : ((first.kind === 'tail_enter') ? first.handle : ''),
        first_b_handle: (first.kind === 'band_cross') ? first.b_handle : '',
        first_to_band: (first.kind === 'band_cross') ? first.to_band : '',
        first_direction: (first.kind === 'band_cross') ? first.direction : '',
      },
    });
  } catch (_e) {
    return null;
  }
}

/**
 * SENS-13 entry point. Tries shape A (the pairwise bridge) first; when that
 * yields no reach, tries shape B (stored portfolio movement). The bridge wins
 * when both are present. Never throws.
 */
function sensorEureka(turn, tuple, ctx) {
  try {
    const bridge = readBridgeShape(turn, tuple, ctx);
    if (bridge) return bridge;
    const roomDir = (ctx && typeof ctx === 'object' && typeof ctx.roomDir === 'string') ? ctx.roomDir : '';
    if (!roomDir) return null;
    return readPortfolioShape(roomDir);
  } catch (_e) {
    return null;
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
  // Phase 355.1-11 (AMB-07): exposed for tests/test-3551-surfacing.cjs's
  // drift-pin leg (pinned equal to sensor-room-delta.cjs's own
  // DELTA_STATE_RELPATH / DELTA_STATE_SCHEMA_VERSION) and the framing helper
  // itself (a direct-unit leg, never room-content bearing).
  ROOM_DELTA_STATE_RELPATH: ROOM_DELTA_STATE_RELPATH,
  ROOM_DELTA_STATE_SCHEMA_VERSION: ROOM_DELTA_STATE_SCHEMA_VERSION,
  readFramingForHandle: readFramingForHandle,
  // Phase 314-03: evidence shape B constants (replicated; pinned by B9).
  PORTFOLIO_SIGNAL: PORTFOLIO_SIGNAL,
  PORTFOLIO_STORE_RELPATH: PORTFOLIO_STORE_RELPATH,
  PORTFOLIO_MOVEMENT_PREFIX: PORTFOLIO_MOVEMENT_PREFIX,
  PORTFOLIO_MOVEMENT_SUFFIX: PORTFOLIO_MOVEMENT_SUFFIX,
  PORTFOLIO_MOVEMENT_FILE_RE: PORTFOLIO_MOVEMENT_FILE_RE,
  PORTFOLIO_SCOPE_ID_RE: PORTFOLIO_SCOPE_ID_RE,
  PORTFOLIO_SEEN_RELPATH: PORTFOLIO_SEEN_RELPATH,
  PORTFOLIO_MAX_FILES: PORTFOLIO_MAX_FILES,
  PORTFOLIO_SCHEMA_VERSION: PORTFOLIO_SCHEMA_VERSION,
  PORTFOLIO_FRESHNESS_MS: PORTFOLIO_FRESHNESS_MS,
  PORTFOLIO_HANDLE_RE: PORTFOLIO_HANDLE_RE,
  MOVEMENT_ID_RE: MOVEMENT_ID_RE,
  isFreshWithin: isFreshWithin,
};
