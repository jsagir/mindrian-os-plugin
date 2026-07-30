'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 244 Plan 05 -- SENS-16 content-relevance detector: closes the core of
 * TRIG-01. `trigger_tier` was DECORATIVE before this plan (computed once in
 * normalizeTurn and stamped onto a copy of the turn; zero consumers gated,
 * scored, ranked, or filtered on it -- sensor-types.cjs:72's own doctrine
 * comment says so). This is the first sensor that actually queries a corpus:
 * every one of the other 17 sensors matches turn text against its OWN
 * hardcoded keyword vocabulary. This sensor queries the ALREADY-SHIPPED
 * Phase 211-02 `tri-modal-index.lexicalSearch` (FTS5 + bm25) instead.
 *
 * This module carries THREE roles at three different layers, kept separate on
 * purpose, mirroring `sensor-expert-skill.cjs:8-31` clause for clause:
 *
 *   1. sensorContentRelevance(turn, tuple, ctx) -> reach|null  -- the PURE
 *      registered sensor. A sync fn that reads ONLY LOCAL ctx enum/scalars,
 *      makes NO db read and NO Brain call, and returns a SINGLE
 *      makeReach({ reach_id:'context_block', ... }) object or null. It
 *      promotes nothing and emits nothing. It is the piece registered into
 *      SENSOR_REGISTRY so dispatchSensors actually fires it.
 *
 *   2. detectContentRelevance(db, opts) -- the ctx-assembly PRODUCER helper.
 *      THIS is where the db read lives. It runs at ctx-assembly time (inside
 *      the navigation-engine sensorCtx block, mirroring the MED-01 cortex
 *      producer at navigation-engine.cjs:847-865 and the SENS-11 expert
 *      producer at :883-917), consults `ftsIndexState` BEFORE ever touching
 *      `lexicalSearch` so an absent/empty/stale index is a DISTINGUISHABLE
 *      fact from a genuine zero-hit (Pitfall 1 / Correction 4 of
 *      244-RESEARCH.md and 244-PATTERNS.md), and returns closed scalars plus
 *      a LOCAL candidate list. The sensor NEVER touches the db.
 *
 *   3. resolveContentRelevanceDecision(db, nodeIds, decision, opts) -- the
 *      gate action. Minimal and side-effect-free beyond what the gate needs;
 *      it exists so the three-layer contract is complete rather than implied.
 *      The sensor never calls this; only the navigator's Shape-F gate does.
 *
 * FROZEN REACH (Phase 148 lockstep): this sensor mints NO new reach_id. It
 *   rides the existing 'context_block' reach (the SENS-11/SENS-12 precedent:
 *   verified at planning time against `data/connector-registry.json`'s
 *   `sensor_index`, both ride context_block with no connector entry). The
 *   module fails closed at load if context_block ever drifts off the frozen
 *   REACH_IDS bank. WHY the throw is at LOAD time rather than runtime:
 *   `makeReach` returns `null` (never throws) on an invalid reach id
 *   (sensor-types.cjs:243), so WITHOUT the load-time throw a frozen-bank
 *   drift would present as a sensor that silently never fires -- a false
 *   success indistinguishable from "no signal this turn". Do NOT mint a 7th
 *   reach_id; the bank is frozen at exactly 6 with a drift contract.
 *
 * POSTURE 'hold' (the sensor-eureka.cjs:24-27 / SENS-SHOW standing-suggestion
 *   precedent): this sensor offers; it never auto-opens.
 *
 * Canon Part 8 is decisive on the evidence bag, and this plan is deliberate,
 *   not lucky. `makeReach`'s primitive-only filter (sensor-types.cjs:256-267)
 *   already drops non-primitives so a node-id ARRAY cannot ride even by
 *   accident -- that is a belt, not a licence. `sensor-eureka.cjs:38-42`
 *   PERMITS opaque node-id HANDLES on evidence for the eureka bridge; that is
 *   a per-sensor call. THIS sensor's call is NO node ids on the reach at all:
 *   the WHICH is resolved LOCALLY at the gate from `sensorCtx.contentCandidates`,
 *   which is threaded onto sensorCtx by the producer for the gate handler
 *   ONLY and is NEVER read by this pure sensor. The evidence bag carries only
 *   a hit count, a coverage number, `trigger_tier: 'content'`, and a sub_mode
 *   label -- no matched text, no turn prose, no node id, no array.
 *
 * Canon Part 9 role 5: only a human promotes. The sensor promotes nothing.
 *
 * SENSOR ID: SENS-16. Verified LIVE at execution time (2026-07-30) against
 *   lib/core/insight-sensors.cjs's SENSOR_REGISTRY: 17 entries, canonical
 *   order ending at sensorUrlIngest (SENS-15, Phase 220). SENS-16 is free.
 *   No parallel session claimed it between planning and this read.
 *
 * FLOORS (both env-tunable, the hybrid-retrieve.cjs::resolveRrfK idiom shape
 *   -- read once at module load, exported as plain constants so a test can
 *   both read and, for a live mutation proof, temporarily overwrite them):
 *     CONTENT_MIN_HITS      default 2,    env TRIG_CONTENT_MIN_HITS
 *     CONTENT_MIN_COVERAGE  default 0.34, env TRIG_CONTENT_MIN_COVERAGE
 *   Coverage (the fraction of sanitized query tokens present in the top hit's
 *   indexed text), NOT an absolute bm25 threshold: bm25 is NOT comparable
 *   across queries (it moves with query term count and corpus statistics), so
 *   an absolute threshold is meaningless across turns. The measured
 *   separation supports coverage: relevant turns landed at 40 and 100
 *   percent, one weak spurious match landed at 17 percent
 *   (244-RESEARCH.md Pitfall 3). Research assumption A5: this was measured on
 *   ONE room (rethinking-mindrianos); a second room should validate the floor
 *   before it is treated as settled.
 *
 * CONTENT_POOL_K = 6, the DIAL_REACH_K value (lib/hmi/dial-reach-orchestrator.cjs),
 *   REPLICATED as a literal rather than imported: requiring the orchestrator
 *   from a lib/core/sensors/ file would pull in the full f-selector-ranker.cjs
 *   dependency chain for one integer, the same "replicate, do not import"
 *   call sensor-eureka.cjs:43-47 makes for its freshness window (a sensors/
 *   file reaching for a heavy sibling module is the wrong direction of pull).
 *
 * Pure / sync / LOCAL-first for the sensor. Node built-ins + project libs
 * only. House rule: hyphens only, no em-dashes.
 */

const { makeReach, REACH_IDS } = require('./sensor-types.cjs');

// Deviation (Rule 3 -- auto-fixed blocking issue, live-verified): tri-modal-
// index.cjs and fts-index-lifecycle.cjs are loaded LAZILY (function-local),
// NOT at module top level. A top-level require here creates a genuine
// multi-hop require cycle that was not visible from any single file read:
// this sensor is required by insight-sensors.cjs (SENSOR_REGISTRY), which is
// required by navigation-engine.cjs, which is transitively required back by
// tri-modal-index.cjs's OWN dependency chain (tri-modal-index -> vector-store
// -> rs-pinecone-bridge -> rs-egress-prompts -> cross-room-aggregator ->
// folder-memory -> feynman/timeline-runner -> timeline-renderer ->
// navigation.cjs -> navigation/calibration-log.cjs -> f-selector-ranker.cjs
// -> navigation-engine.cjs -> insight-sensors.cjs -> back to this file).
// Live-verified: a top-level require crashed
// tests/test-211-vec0-capability.cjs with "Cannot read properties of
// undefined (reading 'vecToBlob')" because vector-store.cjs's exports object
// was still mid-construction when the cycle re-entered tri-modal-index.cjs.
// Lazy (call-time) requires defer resolution until decide() actually invokes
// the producer, by which point every module's synchronous top-level load has
// already settled -- the same lazyNav() precedent sensor-expert-skill.cjs
// uses to avoid its own navigation.cjs cycle, and the same lazy-require
// idiom navigation-engine.cjs already uses for calibration-gate.cjs.
let _tri = null;
function lazyTri() {
  if (_tri) return _tri;
  _tri = require('../eureka/tri-modal-index.cjs');
  return _tri;
}
let _ftsLifecycle = null;
function lazyFtsLifecycle() {
  if (_ftsLifecycle) return _ftsLifecycle;
  _ftsLifecycle = require('../eureka/fts-index-lifecycle.cjs');
  return _ftsLifecycle;
}

// SENS-16: the next free sensor id (SENS-11 = expert-skill, SENS-12 =
// room-pick, SENS-13 = eureka, SENS-14 = opportunity-harvest, SENS-15 =
// url-ingest, all taken; re-verified live against insight-sensors.cjs at
// execution time 2026-07-30, see header).
const SENSOR_ID = 'SENS-16';

// FROZEN: the sensor rides the existing context_block reach (the LOCAL
// in-process context surface). Fail closed at load if it ever drifts off the
// frozen bank. See header for WHY this is a load-time throw, not a runtime
// check (makeReach returns null rather than throwing on an invalid id).
const REACH_ID = 'context_block';
if (REACH_IDS.indexOf(REACH_ID) === -1) {
  throw new Error('sensor-content-relevance: REACH_ID "' + REACH_ID + '" is not in the frozen REACH_IDS bank');
}

// The closed set of distinguishable index states the producer may report.
// 'ok' is the ONLY state the pure sensor may fire on.
const CONTENT_INDEX_STATES = Object.freeze(['index_absent', 'index_empty', 'index_stale', 'ok', 'unavailable']);

// DIAL_REACH_K, replicated (see header) so the pool never exceeds what the
// dial can surface.
const CONTENT_POOL_K = 6;

function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

// ---------- Floor resolution (the resolveRrfK idiom shape, hybrid-retrieve.cjs:68-77) ----------

function resolveContentMinHits() {
  const raw = process.env.TRIG_CONTENT_MIN_HITS;
  if (typeof raw === 'string' && raw.trim() !== '') {
    const v = Number(raw);
    if (Number.isFinite(v) && v >= 0) return v;
  }
  return 2;
}

function resolveContentMinCoverage() {
  const raw = process.env.TRIG_CONTENT_MIN_COVERAGE;
  if (typeof raw === 'string' && raw.trim() !== '') {
    const v = Number(raw);
    if (Number.isFinite(v) && v >= 0 && v <= 1) return v;
  }
  return 0.34;
}

// Resolved once at module load, exported as plain constants (Task 1
// acceptance criteria MUTATION PROOF 5 mutates these directly and reverts).
const CONTENT_MIN_HITS = resolveContentMinHits();
const CONTENT_MIN_COVERAGE = resolveContentMinCoverage();

// ---------- Layer 1: the PURE registered sensor ----------

/**
 * SENS-16 -- the PURE registered sensor. Fires the context_block reach when
 * the ctx carries a content-relevance signal at or above both floors, on an
 * index the producer confirmed is 'ok' (never on index_absent / index_empty /
 * index_stale / unavailable, even if a hit count is somehow present). Reads
 * ONLY LOCAL ctx scalars; makes NO db read and NO Brain call; promotes
 * nothing. Never throws on any input, including null, undefined, a string,
 * or an object with hostile keys.
 *
 * @param {*} _turn  -- unused; the signal is ctx-driven (mirrors sensorExpertSkill)
 * @param {*} _tuple -- unused for detection
 * @param {object} ctx -- LOCAL context carrying contentHitCount / contentCoverage /
 *                        contentIndexState (never contentCandidates -- that stays
 *                        LOCAL on sensorCtx for the gate handler only)
 * @returns {Readonly<object>|null}
 */
function sensorContentRelevance(_turn, _tuple, ctx) {
  if (!ctx || typeof ctx !== 'object') return null;

  // An absent/empty/stale/unavailable index must NEVER fire, even if a hit
  // count somehow rides on ctx (Pitfall 1 / 244-RESEARCH.md: a distinguishable
  // absent-index state must never masquerade as a legitimate match).
  if (ctx.contentIndexState !== 'ok') return null;

  const hitCount = isFiniteNumber(ctx.contentHitCount) ? ctx.contentHitCount : 0;
  const coverage = isFiniteNumber(ctx.contentCoverage) ? ctx.contentCoverage : 0;

  if (hitCount < CONTENT_MIN_HITS) return null;
  if (coverage < CONTENT_MIN_COVERAGE) return null;

  return makeReach({
    // FROZEN: rides the existing context_block reach. Mints NO new reach_id.
    reach_id: REACH_ID,
    // hold: a standing suggestion, never an auto-open (sensor-eureka.cjs precedent).
    posture: 'hold',
    // Dispatch names the LOCAL content-relevance surface. A handle, not a call.
    dispatch: 'content-relevance surface (bm25 lexical match against room corpus)',
    companions: [],
    signal: 'content_relevance',
    // LOCAL closed scalars only (Canon Part 8). No matched text, no turn
    // prose, no node id, no array. The WHICH is resolved LOCALLY at the gate
    // from sensorCtx.contentCandidates, never ridden here.
    evidence: {
      hit_count: hitCount,
      coverage: coverage,
      trigger_tier: 'content',
      sub_mode: 'content_relevance_surface',
    },
  });
}

// ---------- Layer 2: the ctx-assembly PRODUCER (the db read lives HERE) ----------

// Mirror the sanitizer's tokenization shape (tri-modal-index.cjs::toFtsMatch)
// WITHOUT calling it directly -- toFtsMatch (and its STOPWORDS set) live
// under `_test` (Correction 1, 244-PATTERNS.md), and production code
// reaching into a test seam would import a test path into the runtime. This
// stopword list is REPLICATED (not imported), verbatim from
// tri-modal-index.cjs's own STOPWORDS, for the SAME reason sensor-eureka.cjs
// replicates its freshness window rather than importing it. This is a
// coverage-measurement tokenizer only; it never builds a MATCH expression
// and never touches the db.
const COVERAGE_STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'is', 'are', 'was', 'were',
  'be', 'on', 'for', 'with', 'as', 'at', 'by', 'it', 'this', 'that', 'from',
  'but', 'not', 'no', 'so', 'if', 'then', 'than', 'into', 'out', 'up', 'down',
]);

function tokenizeForCoverage(text) {
  if (typeof text !== 'string') return [];
  return (text.toLowerCase().match(/[a-z0-9]+/g) || [])
    .filter(function (t) { return t.length > 0 && !COVERAGE_STOPWORDS.has(t); });
}

// Coverage = the fraction of sanitized query tokens present in the top hit's
// indexed text. See header for why coverage, not an absolute bm25 threshold.
function computeCoverage(queryText, hitText) {
  const qTokens = tokenizeForCoverage(queryText);
  if (qTokens.length === 0) return 0;
  const hitSet = new Set(tokenizeForCoverage(hitText));
  let present = 0;
  for (let i = 0; i < qTokens.length; i += 1) {
    if (hitSet.has(qTokens[i])) present += 1;
  }
  return present / qTokens.length;
}

const ZERO_SIGNAL = Object.freeze({ state: 'unavailable', hits: 0, coverage: 0, candidates: [] });

/**
 * detectContentRelevance(db, opts) -- the ctx-assembly PRODUCER. Reads a
 * caller-owned room.db handle (never opens room.db itself, mirroring
 * sensor-expert-skill.cjs:146-148's caller-owned-handle contract), consults
 * ftsIndexState(db) BEFORE ever calling the FTS5 retrieval primitive so an
 * absent/empty/stale index is DISTINGUISHABLE from a genuine zero-hit, and --
 * because ftsIndexState only classifies the TABLE's structural presence and
 * has no opinion on whether the FTS5 extension itself is loadable this
 * process (244-PATTERNS.md Correction 4) -- separately checks the runtime
 * capability probe (ensureFtsAvailable) so a forced/genuinely-absent FTS5
 * build on a room whose index was built earlier does not present as a false
 * 'ok' zero-hit (the exact silent-swallow bug Pitfall 1 documents). On a
 * non-ok structural state, enqueues its own repair via requestFtsBuild +
 * spawnFtsBuildDrain (the lazy build-on-first-miss, RESEARCH BLOCKER B-2's
 * resolution) -- never awaited, both lifecycle calls are sync by contract.
 * The whole read sits inside one try/catch that soft-fails to the
 * zero-signal default; never a rethrow. decide() runs on every turn on all
 * three surfaces, so an exception escaping here would break Larry's turn.
 *
 * @param {object} db   -- a caller-owned room.db handle (opened upstream)
 * @param {object} opts -- { turnText?: string, roomDir?: string }
 * @returns {{ state: string, hits: number, coverage: number,
 *             candidates: Array<{ nodeId: string, rank: number }> }}
 */
function detectContentRelevance(db, opts) {
  const options = (opts && typeof opts === 'object') ? opts : {};
  const turnText = typeof options.turnText === 'string' ? options.turnText : '';
  const roomDir = typeof options.roomDir === 'string' ? options.roomDir : '';

  if (!db || typeof db.prepare !== 'function') return Object.assign({}, ZERO_SIGNAL);

  try {
    const lifecycle = lazyFtsLifecycle();
    const idxState = lifecycle.ftsIndexState(db);

    // Structural defect (index_absent / index_empty / index_stale): enqueue
    // the miss's own repair, then return early -- never touch the retrieval
    // call on a table that is not there or is known-stale.
    if (idxState.reason !== 'ok' && idxState.reason !== 'unavailable') {
      if (roomDir) {
        const req = lifecycle.requestFtsBuild(roomDir, { reason: idxState.reason });
        if (req && req.ok === true) {
          lifecycle.spawnFtsBuildDrain(roomDir, { queued: req.queued === true });
        }
      }
      return { state: idxState.reason, hits: 0, coverage: 0, candidates: [] };
    }

    // A genuinely invalid/closed handle (ftsIndexState's own 'unavailable').
    if (idxState.reason === 'unavailable') {
      return { state: 'unavailable', hits: 0, coverage: 0, candidates: [] };
    }

    // idxState.reason === 'ok' here: the TABLE is structurally sound. Now
    // confirm the runtime CAPABILITY separately (Correction 4) so a
    // forced/genuinely-absent FTS5 extension cannot masquerade as a
    // legitimate zero-hit on a room whose index was built before the
    // capability went away.
    const tri = lazyTri();
    const capability = tri.ensureFtsAvailable();
    if (!capability.ok) {
      return { state: 'unavailable', hits: 0, coverage: 0, candidates: [] };
    }

    const rows = tri.lexicalSearch(db, turnText, CONTENT_POOL_K);
    if (!Array.isArray(rows) || rows.length === 0) {
      return { state: 'ok', hits: 0, coverage: 0, candidates: [] };
    }

    // Coverage measured against the TOP hit's indexed text only (the
    // strongest match sets the floor comparison; measuring the whole pool
    // would dilute the signal a single strong hit already carries).
    let coverage = 0;
    try {
      const topRow = db.prepare('SELECT text FROM eureka_fts WHERE node_id = ?').get(rows[0].node_id);
      coverage = computeCoverage(turnText, topRow && topRow.text);
    } catch (_e) {
      coverage = 0;
    }

    // LOCAL candidate list for the gate handler ONLY -- never ridden on the
    // reach (Canon Part 8, mirroring sensor-expert-skill.cjs:184-189).
    const candidates = rows.map(function (r, i) { return { nodeId: r.node_id, rank: i }; });

    return { state: 'ok', hits: rows.length, coverage: coverage, candidates: candidates };
  } catch (_e) {
    return Object.assign({}, ZERO_SIGNAL); // soft-fail: no signal when the read fails
  }
}

// ---------- Layer 3: the gate action ----------

/**
 * resolveContentRelevanceDecision(db, nodeIds, decision, opts) -- the Shape-F
 * gate action. Reads the LOCAL candidate list threaded by the producer and
 * resolves the specific node(s) the navigator's Decision Gate chose. Kept
 * minimal and side-effect-free beyond what the gate needs; it exists so the
 * three-layer contract is complete rather than implied (this sensor mints no
 * new node and confirms nothing -- there is no promotable artifact here, only
 * a surfaced relevance offer, so the gate action's job is bookkeeping the
 * decision, not writing a typed edge or confirming a node). Defensive; never
 * throws on caller input.
 *
 * @param {object} db        -- a caller-owned room.db handle (unused today;
 *                               kept on the signature for contract parity
 *                               with resolveExpertSkillDecision and so a
 *                               future edge-write need not change the shape)
 * @param {Array<string>} nodeIds -- the LOCAL candidate node ids offered
 * @param {string} decision  -- one of 'APPROVE' | 'REJECT' | 'DEFER'
 * @param {object} opts      -- reserved for future use
 * @returns {object} a plain result bag (never throws)
 */
function resolveContentRelevanceDecision(db, nodeIds, decision, opts) {
  const ids = Array.isArray(nodeIds) ? nodeIds.filter(function (id) { return typeof id === 'string'; }) : [];
  if (decision !== 'APPROVE' && decision !== 'REJECT' && decision !== 'DEFER') {
    return { ok: false, decision: decision, reason: 'unknown_decision', node_ids: ids };
  }
  return { ok: true, decision: decision, node_ids: ids, sub_mode: 'content_relevance_surface' };
}

module.exports = {
  sensorContentRelevance: sensorContentRelevance,
  detectContentRelevance: detectContentRelevance,
  resolveContentRelevanceDecision: resolveContentRelevanceDecision,
  SENSOR_ID: SENSOR_ID,
  REACH_ID: REACH_ID,
  CONTENT_MIN_HITS: CONTENT_MIN_HITS,
  CONTENT_MIN_COVERAGE: CONTENT_MIN_COVERAGE,
  CONTENT_POOL_K: CONTENT_POOL_K,
  CONTENT_INDEX_STATES: CONTENT_INDEX_STATES,
};
