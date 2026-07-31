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

const {
  makeReach,
  REACH_IDS,
  POSTURE_IDS,
  // Phase 172-07 (R3 / INV-07): the trigger-tier model -- context problem-state
  // first, keyword fallback. classifyTriggerTier reads the LOCAL problem-state
  // enum (stage / jtbd / graph_gap) off the tuple + ctx the navigation.cjs
  // chokepoint populated; it adds NO filesystem or Brain read.
  TRIGGER_TIERS,
  classifyTriggerTier,
  readProblemStateEnum,
  isContextTier,
} = require('./sensors/sensor-types.cjs');

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

// Phase 170 (dual-use diffusion) detector -- SENS-09 diffusion-adoption. Fires
// the brain_consult reach for Adoption-Capacity Theory (ACE) when the LOCAL
// turn shows a dual-use diffusion/adoption shape (explicit signal OR keyword
// scan over the local turn text OR a fresh side-channel marker). Lives under
// lib/core/sensors/ so the routing fence + Part-8 sweep span it.
const { sensorDiffusionAdoption } = require('./sensors/sensor-diffusion-adoption.cjs');

// Phase 173 (show/share intent) detector -- SENS-SHOW. Surfaces the EXISTING
// context_block reach (no 7th reach minted, D-03) naming the /mos:show JTBD
// need-selector front door when the LOCAL turn shows a show/present/share intent
// (explicit signal OR a show/share problem-state OR a keyword scan over the local
// turn text). posture 'hold' -- a standing suggestion at the Decision Gate, never
// auto-opens UI. Lives under lib/core/sensors/ so the routing fence + Part-8
// sweep span it.
const { sensorShowShare } = require('./sensors/sensor-show-share.cjs');

// Phase 205 detector -- SENS-10 circularity. SENS-09 is taken by Phase 170
// dual-use diffusion. SENS-10 detects when a conversation CIRCLES (the Mordi +
// Eli tester failure) and routes each of four causes (answer-unheard,
// assertion-unvalidated, stuck-cannot-say-where, wrong-frame) to a FROZEN-six
// exit reach (TELL / GRILL / GRILL-via-find-bottlenecks / REFRAME), minting no
// new reach_id. Lives under lib/core/sensors/ so the routing fence + Part-8
// sweep span it.
const { sensorCircularity } = require('./sensors/sensor-circularity.cjs');

// Phase 203-03 detector -- SENS-11 expert-skill. Fires the EXISTING context_block
// reach (no 7th reach minted, Phase 148 lockstep) surfacing "save an expert as a
// project skill?" when the ctx carries the reusable-expert signal (a CONFIRMED
// SyntheticExpert clearing invocation_count >= N OR an Academic/Operational tier),
// threaded onto sensorCtx by the navigation-engine ctx-assembly producer that reads
// room.db (the db read is the producer's job; the sensor stays pure). Lives under
// lib/core/sensors/ so the routing fence + Part-8 sweep span it.
const { sensorExpertSkill } = require('./sensors/sensor-expert-skill.cjs');

// Phase 209-05 (E5) detector -- SENS-12 room-pick. Fires the EXISTING
// context_block reach (no 7th reach minted) when the LOCAL turn text carries
// a mid-dialogue room resume/switch signal (RC-1 verdict 23, the incident's
// actual transport-less fork) and at least one resumable room exists. Mints
// the injected card ONLY via lib/core/room-chooser.cjs::renderRoomChooserCard
// (the SEED-020 pickShape('F.1') door); a registry-read fault degrades to
// null. Lives under lib/core/sensors/ so the routing fence + Part-8 sweep
// span it.
const { sensorRoomPick } = require('./sensors/sensor-room-pick.cjs');

// Phase 213 detector -- SENS-13 eureka. Fires the EXISTING deep_research reach
// (no 7th reach minted, CIRS R3) when the LOCAL side-channel
// <roomDir>/.mindrian/last-eureka.json carries a FRESH, guard-cleared
// (POST-GuardGate: verdict transferable, no guard = no fire) bridge from the 211
// tri-modal substrate. posture 'hold' -- a standing suggestion at the Decision
// Gate; the Brain RECOMMENDS, never TRIGGERS (Phase 210 doctrine). Lives under
// lib/core/sensors/ so the routing fence + Part-8 sweep span it.
const { sensorEureka } = require('./sensors/sensor-eureka.cjs');

// Phase 219 detector -- SENS-14 opportunity-harvest. Fires the EXISTING
// context_block reach (no 7th reach minted, D-02; the SENS-11 precedent) when
// the LOCAL side-channel <roomDir>/.mindrian/last-opportunity-harvest.json
// carries FRESH scored candidates from the 219-03 graph-event producer with
// at least one candidate past the Q2 Connection hard gate. posture 'hold' --
// a standing qualification-card offer, never an auto-open; nothing files
// without the human verb (Part 9 role 5). Lives under lib/core/sensors/ so
// the routing fence + Part-8 sweep span it.
const { sensorOpportunityHarvest } = require('./sensors/sensor-opportunity-harvest.cjs');

// Phase 220 detector (SENS-15 -- pasted URL -> deep_research url-ingest
// offer). Fires the EXISTING deep_research reach (no 7th reach minted, CIRS
// R3) when the normalized turn TEXT carries a bare http(s) URL outside code
// fences / quotes, deduped against the Plan 02 url-ingest ledger
// (<roomDir>/.mindrian/url-ingest-ledger.json). posture 'hold' -- a standing
// F.1 card offer ([Ingest] [Ingest+Explore] [Skip]); nothing files without
// the navigator verb (Part 3). Lives under lib/core/sensors/ so the routing
// fence + Part-8 sweep span it.
const { sensorUrlIngest } = require('./sensors/sensor-url-ingest.cjs');

// Phase 244 Plan 05 detector (SENS-16 -- content-relevance -> context_block
// offer, TRIG-01). Fires the EXISTING context_block reach (no 7th reach
// minted, Phase 148 lockstep) when the ALREADY-SHIPPED
// tri-modal-index.lexicalSearch (bm25 FTS5) finds real lexical relevance
// between the turn text and the room's own curated corpus (never
// `fragments`), threaded onto sensorCtx by the navigation-engine ctx-assembly
// producer that reads room.db (the db read is the producer's job; the sensor
// stays pure). posture 'hold' -- a standing suggestion, never an auto-open.
// Lives under lib/core/sensors/ so the routing fence + Part-8 sweep span it.
const { sensorContentRelevance } = require('./sensors/sensor-content-relevance.cjs');

// Phase 245 Plan 06 detector (SENS-17 -- perspective-lock -> the hats reach,
// REQ-3). The FIRST sensor that can independently assign `hats`, one of the six
// frozen Phase-148 reach ids, which until now was reachable only by a manual
// navigator pick. Fires when the projected cortex carries >= 2 fresh
// contradictions (the D-14 threshold: SENS-08 already fires cross_room at > 0,
// so > 0 here would double-fire on every contradiction, and the higher bar is a
// Canon Part 12 invisibility restraint). Reads the SAME LOCAL ctx scalar the
// MED-01 cortex producer already threads for SENS-08, so it adds no new
// plumbing. posture 'hold' -- a perspective rotation HALTS the current line of
// reasoning. Lives under lib/core/sensors/ so the routing fence + Part-8 sweep
// span it.
const { sensorPerspectiveLock } = require('./sensors/sensor-perspective-lock.cjs');

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
 * isMarkerOwnedByCaller -- REACH-03 fail-OPEN ownership filter (Phase 237-04,
 * T-237-04-01 / T-237-04-02). Answers exactly one question: "may THIS marker
 * fire for THIS caller?"
 *
 * This is a FILTER, not a GATE. A gate fails closed; a filter fails open.
 * Suppress ONLY on a positive mismatch -- both the marker's session id and
 * the caller's session id present AND different. Every other state fires:
 *
 *   marker session id      | caller session id      | verdict
 *   ------------------------|-------------------------|--------
 *   present, differs        | present                 | false (the ONLY suppression -- a positive mismatch)
 *   present, matches         | present                 | true
 *   absent / not a string    | any                      | true (a legacy or pre-fix marker in an existing room must keep firing; suppressing here would silently darken the reach layer in every room on upgrade until the next write)
 *   any                      | absent / not a string    | true (an unknown caller cannot prove ownership either way; resolveEffectiveSessionId genuinely returns null on stdio in real installs, so suppressing here would kill the signal on a common surface)
 *
 * A fix that over-suppresses would be a second silent-failure bug of exactly
 * the class this milestone (v1.16.0) exists to remove, and it would be much
 * harder to notice than the bleed it replaces (T-237-04-02, Denial of
 * Service via over-suppression). No force flag, no options object -- one
 * boolean answer from two inputs, same no-weakening discipline
 * lib/core/seam-liveness.cjs states for itself.
 *
 * @param {*} markerSessionId -- the session_id read off the marker's own
 *   JSON content (absent on a legacy / pre-fix marker)
 * @param {*} callerSessionId -- the calling session's own id (null/undefined
 *   when it did not resolve upstream)
 * @returns {boolean} true when the marker may fire for this caller
 */
function isMarkerOwnedByCaller(markerSessionId, callerSessionId) {
  const markerOk = typeof markerSessionId === 'string' && markerSessionId.length > 0;
  const callerOk = typeof callerSessionId === 'string' && callerSessionId.length > 0;
  if (!markerOk || !callerOk) return true; // fail open: neither side can prove a mismatch
  return markerSessionId === callerSessionId;
}

/**
 * Derive turn signal KINDS from EXACTLY the two CONTEXT-named shipped LOCAL
 * side-channels under ctx.roomDir (Phase 150.5 SENS-FIX-01):
 *
 *   (a) 'artifact_filed'  <- <roomDir>/.mindrian/last-cascade.json exists, is
 *       fresh per SIGNAL_FRESHNESS_MS, parses via readJsonSafe,
 *       proactive_intelligence.newFindings is a non-empty array (the same gate
 *       sensorArtifactFiled re-checks, so signal and sensor agree), AND the
 *       marker's own session_id passes isMarkerOwnedByCaller against the
 *       caller session id (Phase 237-04, REACH-03).
 *   (b) 'first_material'  <- any <roomDir>/.mindrian/auto-explore-*.json fire
 *       marker (the Phase 117 substrate) exists, is fresh, AND passes the
 *       same ownership check.
 *
 * Returns signal KIND strings only -- closed enums, never file content, never
 * prose (threat T1 / Canon Part 8). Pure-LOCAL, sync, soft-fail-to-[] on any
 * fault; never throws. No third derivation exists: the 150.5 CONTEXT names
 * exactly these two side-channel fuels.
 *
 * The sessionId parameter is OPTIONAL (Phase 237-04): deriveTurnSignals(ctx)
 * with one argument behaves exactly as deriveTurnSignals(ctx, null) does,
 * which by the isMarkerOwnedByCaller degrade rule means every marker still
 * fires -- no existing single-argument caller breaks.
 *
 * @param {object} ctx -- LOCAL context ({ roomDir })
 * @param {string|null} [sessionId] -- the CALLER's own session id, threaded
 *   in by the caller (normalizeTurn), never re-resolved here
 * @returns {string[]} derived signal kinds (possibly empty)
 */
function deriveTurnSignals(ctx, sessionId) {
  try {
    const roomDir = (ctx && typeof ctx === 'object' && typeof ctx.roomDir === 'string') ? ctx.roomDir : '';
    if (!roomDir) return [];
    const sideDir = path.join(roomDir, '.mindrian');
    const out = [];
    const callerSessionId = (typeof sessionId === 'string' && sessionId) ? sessionId : null;

    // (a) artifact_filed <- fresh last-cascade.json with non-empty
    // newFindings, scoped to the caller (Phase 237-04, T-237-04-01).
    const cascadePath = path.join(sideDir, 'last-cascade.json');
    if (fs.existsSync(cascadePath) && isFreshFile(cascadePath)) {
      const payload = readJsonSafe(cascadePath);
      const pi = (payload && typeof payload === 'object') ? payload.proactive_intelligence : null;
      const markerSessionId = (payload && typeof payload === 'object') ? payload.session_id : undefined;
      if (pi && Array.isArray(pi.newFindings) && pi.newFindings.length > 0
          && isMarkerOwnedByCaller(markerSessionId, callerSessionId)) {
        out.push('artifact_filed');
      }
    }

    // (b) first_material <- any fresh + owned auto-explore-*.json fire marker.
    let entries = [];
    try {
      entries = fs.readdirSync(sideDir);
    } catch (_e) {
      entries = [];
    }
    for (const name of entries) {
      if (name.indexOf('auto-explore-') === 0 && name.slice(-5) === '.json') {
        const candidatePath = path.join(sideDir, name);
        if (isFreshFile(candidatePath)) {
          const candidatePayload = readJsonSafe(candidatePath);
          const candidateSessionId = (candidatePayload && typeof candidatePayload === 'object') ? candidatePayload.session_id : undefined;
          if (isMarkerOwnedByCaller(candidateSessionId, callerSessionId)) {
            out.push('first_material');
            break;
          }
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
 *   trigger_tier -- (Phase 172-07, R3/INV-07) the recorded TIER classification
 *              of this turn: 'signal'/'context' (problem-state, preferred) or
 *              'keyword' (the fallback). An ENUM hint only -- it records that
 *              the dispatch path PREFERS the LOCAL problem-state over keyword;
 *              it does NOT itself fire or suppress any sensor. Member of
 *              sensor-types.TRIGGER_TIERS, or null when nothing is triggerable.
 *
 * @param {object} turn -- the caller's turn (never mutated)
 * @param {object} ctx  -- LOCAL context threaded to deriveTurnSignals
 * @param {object} tuple -- the /mos:diagnose tuple (read enum/scalar for the tier)
 * @returns {object} the enriched copy
 */
function normalizeTurn(turn, ctx, tuple) {
  const base = (turn && typeof turn === 'object') ? turn : {};
  const copy = Object.assign({}, base);

  // text alias: existing text/utterance always win; userText is the
  // production-hook fallback (scripts/intent-classifier.cjs ~:1351).
  let text = '';
  if (typeof base.text === 'string') text = base.text;
  else if (typeof base.utterance === 'string') text = base.utterance;
  else if (typeof base.userText === 'string') text = base.userText;
  copy.text = text;

  // REACH-03 (Phase 237-04, T-237-04-01): thread the CALLER-ASSERTED session
  // id from what is already in scope here -- never re-resolved, never read
  // from process.env.CLAUDE_CODE_SESSION_ID. The MCP path already resolves
  // it upstream (lib/mcp/tools/sensors.cjs's session-id resolver) and hands
  // it in on turn.sessionId; the CLI path carries it on decide()'s turn
  // (lib/core/navigation-engine.cjs). Adding a resolver in THIS module would
  // be a fourth guesser -- Canon Part 7 and the ONE session-id resolver
  // (lib/core/session-binding.cjs) exist to prevent exactly that.
  const callerSessionId = (typeof base.sessionId === 'string' && base.sessionId)
    ? base.sessionId
    : ((ctx && typeof ctx === 'object' && typeof ctx.sessionId === 'string' && ctx.sessionId) ? ctx.sessionId : null);

  // signals: caller-supplied preserved verbatim, derived kinds merged
  // additively (deduplicated against both string and { kind } shapes).
  const callerSignals = Array.isArray(base.signals) ? base.signals.slice() : [];
  const merged = callerSignals.slice();
  for (const kind of deriveTurnSignals(ctx, callerSessionId)) {
    let present = false;
    for (const s of callerSignals) {
      if (s === kind || (s && typeof s === 'object' && s.kind === kind)) {
        present = true;
        break;
      }
    }
    if (!present) merged.push(kind);
  }

  // Phase 177-04 (BCH-S4a): surface saturation as a DERIVED signal on the COPY
  // only. When isSaturated fires on the turn-count + node-delta scalars carried
  // on the turn/ctx ("turn 8+, no new nodes"), push a 'saturation' signal kind
  // into the merged lane (deduplicated). This is a deterministic SIGNAL only --
  // it does NOT fire a reach, compose a dial, or emit a model cue (the cue
  // wiring is BCH-S4b, Wave 4). The caller's turn object is never mutated (the
  // enrichment lives only on this copy -- the D-03a structural guarantee).
  const satTurnCount = (typeof base.turn_count === 'number') ? base.turn_count
    : (ctx && typeof ctx === 'object' && typeof ctx.turn_count === 'number') ? ctx.turn_count
    : undefined;
  const satNodeDelta = (typeof base.node_delta === 'number') ? base.node_delta
    : (ctx && typeof ctx === 'object' && typeof ctx.node_delta === 'number') ? ctx.node_delta
    : undefined;
  if (isSaturated({ turn_count: satTurnCount, node_delta: satNodeDelta })) {
    let present = false;
    for (const s of merged) {
      if (s === 'saturation' || (s && typeof s === 'object' && s.kind === 'saturation')) {
        present = true;
        break;
      }
    }
    if (!present) merged.push('saturation');
  }

  copy.signals = merged;

  // Phase 172-07 (R3/INV-07): record the trigger TIER on the normalized copy.
  // classifyTriggerTier reads the LOCAL problem-state enum (stage/jtbd/graph_gap)
  // off tuple+ctx (navigation.cjs populated) and applies the context-first /
  // keyword-fallback precedence. Soft-fail to null so a classifier fault never
  // poisons the dispatch. ENUM only -- never user content (Part 8).
  let tier = null;
  try {
    tier = classifyTriggerTier(copy, tuple, ctx);
  } catch (_e) {
    tier = null;
  }
  copy.trigger_tier = tier;

  return copy;
}

// ---------- Phase 177-04: turn-stage reach-eligibility (BCH-S5) ----------

/**
 * The two DEEP reaches suppressed in early turns (BCH-S5). These are members 4
 * and 5 of the frozen REACH_IDS bank (brain_consult, deep_research) -- the deep
 * tooling a fresh navigator should not be dropped into before the problem is
 * framed. The OTHER four reaches (context_block, contradiction, cross_room,
 * hats) are NEVER turn-stage-suppressed. This list does NOT mint a 7th reach --
 * it names two existing members the gate suppresses in turns 1-2.
 */
const TURN_STAGE_GATED_REACHES = Object.freeze(['brain_consult', 'deep_research']);

/**
 * The early-turn suppression boundary (BCH-S5). turn_count BELOW this value
 * (turns 1-2, i.e. turn_count < 3) suppresses the two deep reaches; turn_count
 * AT OR ABOVE it unlocks them. The 3-4 transition band is INTENTIONAL and
 * documented: turns 1-2 are pure framing (deep reaches suppressed), turns 3-4
 * are the early transition where the two deep reaches are already eligible (the
 * inclusive lower boundary is 3), and turn 5 -- the SPEC's named unlock turn --
 * is comfortably inside the eligible band. The CONTEXT line ("suppress in turns
 * 1-2, unlock at turn 5") is honored: suppressed for 1-2, eligible by 5; the
 * test pins the 3-4 boundary explicitly so the chosen inclusive edge cannot
 * drift silently.
 */
const TURN_STAGE_UNLOCK_AT = 3;

/**
 * BCH-S5 -- is the given reach eligible to fire at this turn stage?
 *
 * Deterministic engine math over the runtime turn_count BCH-S1 established
 * (lib/core/navigation/projections.cjs computeInvestmentLevel reads the same
 * roomState.turn_count). The gate suppresses ONLY brain_consult and deep_research
 * in the early framing turns (turn_count < TURN_STAGE_UNLOCK_AT, i.e. turns 1-2);
 * every other reach is always eligible. When turn_count is absent or non-number
 * the gate is a NO-OP (returns true) so every legacy caller that threads no
 * turn_count stays byte-stable.
 *
 *   isReachEligibleForTurn('brain_consult', 1) === false  (turn 1, suppressed)
 *   isReachEligibleForTurn('deep_research', 2) === false  (turn 2, suppressed)
 *   isReachEligibleForTurn('brain_consult', 3) === true   (transition band edge)
 *   isReachEligibleForTurn('deep_research', 5) === true   (unlocked at turn 5)
 *   isReachEligibleForTurn('context_block', 1) === true   (never suppressed)
 *   isReachEligibleForTurn('deep_research', undefined) === true (no-op)
 *
 * @param {string} reachId   -- a member of REACH_IDS
 * @param {number} turnCount -- the per-turn runtime counter (BCH-S1)
 * @returns {boolean} true when the reach may fire this turn
 */
function isReachEligibleForTurn(reachId, turnCount) {
  // Not one of the two gated deep reaches -> always eligible.
  if (TURN_STAGE_GATED_REACHES.indexOf(reachId) === -1) return true;
  // Absent / non-number / non-finite turn_count -> no-op (eligible). Mirrors the
  // defensive read in computeInvestmentLevel: a missing counter never suppresses.
  if (typeof turnCount !== 'number' || !Number.isFinite(turnCount)) return true;
  // The deep reaches are suppressed only in the early framing band (turns 1-2).
  return turnCount >= TURN_STAGE_UNLOCK_AT;
}

/**
 * Read the runtime turn_count off the normalized turn / LOCAL ctx (the same
 * counter BCH-S1 established on roomState). Prefers turn.turn_count, then
 * ctx.turn_count. Returns undefined when neither is a finite number, so
 * isReachEligibleForTurn treats it as a no-op. Pure; never throws.
 */
function turnCountOf(turn, ctx) {
  if (turn && typeof turn === 'object' && typeof turn.turn_count === 'number' && Number.isFinite(turn.turn_count)) {
    return turn.turn_count;
  }
  if (ctx && typeof ctx === 'object' && typeof ctx.turn_count === 'number' && Number.isFinite(ctx.turn_count)) {
    return ctx.turn_count;
  }
  return undefined;
}

// ---------- Phase 177-04: saturation by turn-count + node-delta (BCH-S4a) ----------

/**
 * The saturation turn-count floor (BCH-S4a). turn_count AT OR ABOVE this value
 * is "deep into the conversation". Combined with node_delta === 0 ("no new
 * nodes") this is the "turn 8+, no new nodes" condition.
 */
const SATURATION_TURN_FLOOR = 8;

/**
 * Pull a finite number off an object key, returning null when absent / non-number
 * / non-finite. Pure; never throws.
 */
function _finiteNum(obj, key) {
  if (!obj || typeof obj !== 'object') return null;
  const v = obj[key];
  return (typeof v === 'number' && Number.isFinite(v)) ? v : null;
}

/**
 * BCH-S4a -- is the conversation saturated? True when turn_count >= 8 AND
 * node_delta === 0 (the "turn 8+, no new nodes" condition) -- pure deterministic
 * engine math over the runtime turn_count BCH-S1 established and the node_delta
 * scalar the navigation.cjs chokepoint computed (a created_at window count of
 * nodes created since the prior turn).
 *
 * This helper does NOT itself open a db read -- node_delta is passed in as an
 * already-computed scalar, keeping dispatchSensors pure per the :8 chokepoint
 * contract. Defensive: absent / non-number turn_count or node_delta -> false; a
 * negative node_delta (malformed) -> false; never throws.
 *
 *   isSaturated({ turn_count: 8, node_delta: 0 }) === true
 *   isSaturated({ turn_count: 8, node_delta: 3 }) === false  (new nodes)
 *   isSaturated({ turn_count: 5, node_delta: 0 }) === false  (too early)
 *   isSaturated({})                               === false  (defensive)
 *
 * @param {object} opts -- { turn_count, node_delta }
 * @returns {boolean}
 */
function isSaturated(opts) {
  const turnCount = _finiteNum(opts, 'turn_count');
  const nodeDelta = _finiteNum(opts, 'node_delta');
  if (turnCount === null || nodeDelta === null) return false;
  if (nodeDelta < 0) return false; // malformed count -> not saturated
  return turnCount >= SATURATION_TURN_FLOOR && nodeDelta === 0;
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
 * REACH-03 (Phase 237-04, T-237-04-01/T-237-04-05): this is the SECOND
 * independent reader of last-cascade.json (the module header at :31-33
 * documents the duplication as deliberate, "so signal and sensor agree").
 * It applies the SAME isMarkerOwnedByCaller check deriveTurnSignals uses --
 * both readers must be scoped or neither is, or a foreign marker fires here
 * even when the derived signal correctly suppressed it.
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

  // The caller session id sourced from the NORMALIZED turn this sensor
  // already receives -- never re-resolved, never a fourth guesser.
  const callerSessionId = (turn && typeof turn === 'object' && typeof turn.sessionId === 'string' && turn.sessionId) ? turn.sessionId : null;
  if (!isMarkerOwnedByCaller(payload.session_id, callerSessionId)) return null;

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
  // Phase 170 detector (SENS-09 -- dual-use diffusion/adoption -> ACE):
  sensorDiffusionAdoption,
  // Phase 173 detector (SENS-SHOW -- show/share intent -> /mos:show selector):
  sensorShowShare,
  // Phase 205 detector (SENS-10 -- circularity -> four-cause/four-exit gear-shift):
  sensorCircularity,
  // Phase 203 detector (SENS-11 -- reusable-expert -> save-as-skill offer on context_block):
  sensorExpertSkill,
  // Phase 209-05 detector (SENS-12 -- room-pick fork -> room-chooser card on context_block):
  sensorRoomPick,
  // Phase 213 detector (SENS-13 -- eureka bridge -> deep_research offer):
  sensorEureka,
  // Phase 219 detector (SENS-14 -- opportunity-harvest -> qualification-card offer on context_block):
  sensorOpportunityHarvest,
  // Phase 220 detector (SENS-15 -- pasted URL -> deep_research url-ingest offer):
  sensorUrlIngest,
  // Phase 244 Plan 05 detector (SENS-16 -- content-relevance -> context_block offer, TRIG-01):
  sensorContentRelevance,
  // Phase 245 Plan 06 detector (SENS-17 -- perspective-lock -> the hats reach, REQ-3):
  sensorPerspectiveLock,
];

// ---------- Phase 245-01 (D-21): the parallel sensor IDENTITY array ----------
//
// SENSOR_REGISTRY_IDS[i] is the self-declared sensor id of SENSOR_REGISTRY[i].
// The two arrays are INDEX-PARALLEL: element for element, same order, same
// length. Registering a new sensor means appending to BOTH arrays, in the same
// position, in the same commit.
//
// LOCKSTEP IS ENFORCED, NOT REQUESTED. Two independent gates fail closed the
// moment these arrays (or this array and the SENS_PRIORITY doctrine table)
// diverge:
//   - `node scripts/build-connector-registry.cjs --check` (the build gate)
//   - `node tests/test-245-priority-complete.cjs` (the test-time pin)
// So a sensor added to SENSOR_REGISTRY alone, or added here without a
// SENS_PRIORITY entry, reddens the build rather than silently degrading to
// file order (Canon Part 11 R1/R2: born wired or born excluded, never dark).
//
// NON-NUMERIC IDS ARE REAL: 'SENS-RECENCY' (sensor-recency.cjs, Phase 160-03)
// and 'SENS-SHOW' (sensor-show-share.cjs, Phase 173) are the ids those two
// sensors actually self-declare. They are not placeholders; do not renumber.
//
// Canon Part 8: every element is a literal in-repo constant. Nothing here is
// derived from turn text, room content, or any user-suppliable value.
const SENSOR_REGISTRY_IDS = Object.freeze([
  'SENS-01',        // sensorFirstMaterial
  'SENS-06',        // sensorArtifactFiled
  'SENS-02',        // sensorLaggingComponent
  'SENS-03',        // sensorMethodologyDecision
  'SENS-07',        // sensorGateApproach
  'SENS-04',        // sensorExternalFact
  'SENS-05',        // sensorJtbdReweight
  'SENS-08',        // sensorMemoryCortex
  'SENS-RECENCY',   // sensorRecency
  'SENS-09',        // sensorDiffusionAdoption
  'SENS-SHOW',      // sensorShowShare
  'SENS-10',        // sensorCircularity
  'SENS-11',        // sensorExpertSkill
  'SENS-12',        // sensorRoomPick
  'SENS-13',        // sensorEureka
  'SENS-14',        // sensorOpportunityHarvest
  'SENS-15',        // sensorUrlIngest
  'SENS-16',        // sensorContentRelevance
  'SENS-17',        // sensorPerspectiveLock
]);

// ---------- Phase 245-01 (D-21): the central sensor_id stamp ----------

/**
 * Rebuild a fired reach with `evidence.sensor_id` set to the registry identity
 * of the sensor that produced it. Returns the ORIGINAL reach unchanged on any
 * fault (soft-fail discipline: a stamp failure must never drop a reach that
 * already passed the membership and turn-stage gates).
 *
 * WHY ONE CENTRAL STAMP RATHER THAN 18 PER-SENSOR EDITS. D-21 describes the
 * stamp as "a Part-8-safe one-line add per sensor". This delivers the identical
 * OBSERVABLE outcome through a single seam, deliberately. This repo has already
 * been bitten twice by hand-maintained parallel sensor declarations drifting
 * out of sync with reality: D-15 found three commands falsely declaring SENS-05
 * for the `hats` reach, and 245-RESEARCH.md F-3 found `sensor_index` missing
 * four real sensors because it only ever read the command side. A per-sensor
 * stamp is eighteen more places to forget. A central stamp makes it
 * STRUCTURALLY IMPOSSIBLE for a newly registered sensor to ship unstamped,
 * which is exactly the invariant the Task 3 fail-closed gate needs to be able
 * to assume. Canon Part 7: one mechanism, not eighteen.
 *
 * Canon Part 8: the stamped value is read from the frozen in-repo
 * SENSOR_REGISTRY_IDS literal only. It is never derived from turn text, room
 * content, or any user-suppliable value. The rebuild goes through makeReach, so
 * the result stays a deeply frozen flat scalar bag (makeReach drops
 * non-primitives and re-freezes); the frozen input reach is never mutated.
 *
 * @param {object} reach -- a frozen candidate reach that already passed the gates
 * @param {number} i     -- its producing sensor's SENSOR_REGISTRY index
 * @returns {object} the stamped reach, or the original on any fault
 */
function stampSensorId(reach, i) {
  const sensorId = SENSOR_REGISTRY_IDS[i];
  if (typeof sensorId !== 'string' || sensorId === '') return reach;

  const evidence = {};
  if (reach.evidence && typeof reach.evidence === 'object' && !Array.isArray(reach.evidence)) {
    for (const k of Object.keys(reach.evidence)) evidence[k] = reach.evidence[k];
  }
  evidence.sensor_id = sensorId;

  const stamped = makeReach({
    reach_id: reach.reach_id,
    posture: reach.posture,
    dispatch: reach.dispatch,
    companions: reach.companions,
    signal: reach.signal,
    evidence: evidence,
  });
  // A null rebuild (should be unreachable -- the reach already validated) must
  // not cost us a reach that legitimately fired.
  return stamped || reach;
}

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
    // Phase 172-07: tuple is threaded so normalizeTurn can record the trigger
    // TIER (context problem-state first, keyword fallback) on the copy.
    normalized = normalizeTurn(turn, ctx, tuple);
  } catch (_e) {
    normalized = turn; // soft-fail: degrade to the raw turn
  }

  // BCH-S5 turn-stage eligibility: read the runtime turn_count once (off the
  // normalized turn / ctx -- the same counter BCH-S1 established). A reach whose
  // id is turn-stage-ineligible this turn is FILTERED out of the dispatch result
  // (the emitted reaches only -- trace.routing_source is NEVER mutated here, the
  // Phase 144 fence at :20 holds). When turn_count is absent the gate is a no-op
  // (isReachEligibleForTurn returns true), so legacy callers stay byte-stable.
  const turnCount = turnCountOf(normalized, ctx);

  const out = [];
  for (let i = 0; i < SENSOR_REGISTRY.length; i++) {
    const sensor = SENSOR_REGISTRY[i];
    if (typeof sensor !== 'function') continue;
    let reach = null;
    try {
      reach = sensor(normalized, tuple, ctx);
    } catch (_e) {
      reach = null; // soft-fail: a throwing sensor did not fire
    }
    if (reach && typeof reach === 'object' && REACH_IDS.indexOf(reach.reach_id) !== -1) {
      // Drop a turn-stage-ineligible reach (brain_consult / deep_research in
      // turns 1-2). Eligibility-gating over the frozen set -- NOT removing a
      // reach from the bank.
      if (!isReachEligibleForTurn(reach.reach_id, turnCount)) continue;
      out.push(stampSensorId(reach, i));
    }
  }
  return out;
}

module.exports = {
  dispatchSensors: dispatchSensors,
  SENSOR_REGISTRY: SENSOR_REGISTRY,
  // Phase 245-01 (D-21): the index-parallel sensor identity array. Exported so
  // the fail-closed --check gate and the phase tests can enumerate the SENSOR
  // side of the registry (245-RESEARCH.md F-3: sensor_index is built from
  // command frontmatter and cannot stand in for this).
  SENSOR_REGISTRY_IDS: SENSOR_REGISTRY_IDS,
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
  // Phase 170 detector (SENS-09 -- dual-use diffusion/adoption):
  sensorDiffusionAdoption: sensorDiffusionAdoption,
  // Phase 173 detector (SENS-SHOW -- show/share intent -> /mos:show selector):
  sensorShowShare: sensorShowShare,
  // Phase 205 detector (SENS-10 -- circularity -> four-cause/four-exit gear-shift):
  sensorCircularity: sensorCircularity,
  // Phase 203-03 detector (SENS-11 -- reusable-expert -> save-as-skill offer):
  sensorExpertSkill: sensorExpertSkill,
  // Phase 209-05 detector (SENS-12 -- room-pick fork -> room-chooser card).
  // Phase 245-01: it was registered in SENSOR_REGISTRY but absent from this
  // exports block, a pre-existing gap that made the registry harder to reason
  // about from the outside. Exported now so every registry member is reachable
  // by name, matching what the identity array above claims.
  sensorRoomPick: sensorRoomPick,
  // Phase 213 detector (SENS-13 -- eureka bridge -> deep_research offer):
  sensorEureka: sensorEureka,
  // Phase 219 detector (SENS-14 -- opportunity-harvest -> qualification-card offer on context_block):
  sensorOpportunityHarvest: sensorOpportunityHarvest,
  // Phase 220 detector (SENS-15 -- pasted URL -> deep_research url-ingest offer):
  sensorUrlIngest: sensorUrlIngest,
  // Phase 244 Plan 05 detector (SENS-16 -- content-relevance -> context_block offer, TRIG-01):
  sensorContentRelevance: sensorContentRelevance,
  // Phase 245 Plan 06 detector (SENS-17 -- perspective-lock -> the hats reach, REQ-3):
  sensorPerspectiveLock: sensorPerspectiveLock,
  // Shared LOCAL helpers (exposed for the Task-2 sensors + tests).
  makeReach: makeReach,
  readJsonSafe: readJsonSafe,
  hasSignal: hasSignal,
  problemTypeOf: problemTypeOf,
  // Phase 150.5 one-seam normalization (SENS-FIX-01):
  normalizeTurn: normalizeTurn,
  deriveTurnSignals: deriveTurnSignals,
  SIGNAL_FRESHNESS_MS: SIGNAL_FRESHNESS_MS,
  // Phase 237-04 (REACH-03): the shared fail-open ownership filter both
  // last-cascade.json readers (deriveTurnSignals + sensorArtifactFiled) use.
  // Exported so the four known-unscoped markers (last-eureka.json,
  // last-opportunity-harvest.json, url-ingest-ledger.json, the diffusion
  // marker scan) can adopt it later without a second mechanism.
  isMarkerOwnedByCaller: isMarkerOwnedByCaller,
  // Phase 177-04 (BCH-S5): turn-stage reach-eligibility -- suppress
  // brain_consult / deep_research in turns 1-2, unlock at turn 5. No 7th reach.
  isReachEligibleForTurn: isReachEligibleForTurn,
  TURN_STAGE_GATED_REACHES: TURN_STAGE_GATED_REACHES,
  TURN_STAGE_UNLOCK_AT: TURN_STAGE_UNLOCK_AT,
  // Phase 177-04 (BCH-S4a): saturation by turn-count + node-delta -- the
  // "turn 8+, no new nodes" deterministic signal (no reach, no cue).
  isSaturated: isSaturated,
  SATURATION_TURN_FLOOR: SATURATION_TURN_FLOOR,
  // Phase 172-07 (R3 / INV-07): the trigger-tier model -- context problem-state
  // first, keyword fallback. Re-exported so the dispatch surface exposes the
  // tiering classifiers + the closed ordered tier vocabulary.
  TRIGGER_TIERS: TRIGGER_TIERS,
  classifyTriggerTier: classifyTriggerTier,
  readProblemStateEnum: readProblemStateEnum,
  isContextTier: isContextTier,
};
