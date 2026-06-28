'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 184 -- READER: the decide-time projection OFFER (READER-01..04)
 * ====================================================================
 * decide() (lib/core/navigation-engine.cjs) gains a READ it currently lacks. This
 * module is that read. It is the THIRD READER in the engine, beside the BRAIN.md
 * reader and the navigated-neighborhood reader: it RANKS the LOCAL orchestration
 * projection's capabilities for the current navigator context and SURFACES them as
 * Shape F Decision-Gate OPTION CONTENT. It calls NEITHER runChain NOR any
 * act-command. It is a reader, never a firer (READER-04, proved structurally).
 *
 *   READER-01  import the LOCAL orchestration projection
 *              (data/brain-orchestration-projection.json, 249 nodes, every node
 *              methodology_tier-tagged) as a LOCAL derived machinery cache.
 *   READER-02  RANK capabilities for the current navigator context (deterministic).
 *   READER-03  SURFACE the ranked capabilities as Shape F OPTION CONTENT.
 *   READER-04  it is a READER, never a FIRER (no runChain / act-command path).
 *
 * The four acceptance guards live here as code:
 *   R2  validateProjection() runs on the projection nodes BEFORE the read; it
 *       FAILS CLOSED on a malformed projection (the read is skipped, decide() still
 *       returns). The 249-node hygiene is already met, so the gate PASSES today; it
 *       is built anyway as the guard against a future malformed projection.
 *   R3  READER_BUDGET_MS (ambient-turn latency) + READER_MAX_OPTIONS (context
 *       weight). _meta.read_ms / _meta.within_budget / _meta.option_count carry the
 *       measurement the R3 test asserts against, so a too-slow / too-heavy read
 *       FAILS THE BUILD.
 *   R4  this module requires ONLY node:fs + node:path. It imports NO chain-executor,
 *       NO act-command, NO framework-runner, NO command invoker. There is no code
 *       path from here to firing a capability. surfaceAsOptionContent stamps every
 *       option `fires: false`.
 *
 * Canon Part 8 (HARD): the projection is a LOCAL derived cache. The read is a LOCAL
 * file read. ZERO live Brain read/write, ZERO network. The surfaced options carry
 * ONLY generic machinery metadata (command slug, reach_id, sub_mode, framework name,
 * methodology_tier, hierarchy_rank, posture) -- never a navigator's artifacts, rooms,
 * meetings, or decisions. methodology_tier is the boundary-keeper: a projection node
 * without one is rejected by the R2 gate.
 *
 * Part 9: this module opens no room.db and writes no memory; it is a pure LOCAL
 * read. Any memory write stays the caller's job through the navigation.cjs chokepoint.
 *
 * Frozen Part 3 contracts are UNTOUCHED. READER surfaces capability OPTIONS as
 * decision-gate CONTENT; it mints no 7th reach, never changes DIAL_REACH_K, MAX_K,
 * the 0.70/0.15 gate, or the render contract. READER_MAX_OPTIONS is a CONTENT cap on
 * how many capability options the read surfaces, NOT a render-contract constant.
 *
 * House rule: hyphens only, no em-dashes. Never throws.
 */

const fs = require('node:fs');
const path = require('node:path');

// The two legal methodology tiers (Canon Part 8 boundary-keeper). A projection node
// must carry exactly one of these or the R2 gate rejects the whole projection.
const VALID_TIERS = Object.freeze(['pws', 'mindrian-operation']);

// R3 ambient-turn latency budget (ms). The read must complete inside this on an
// ambient turn or the R3 test FAILS THE BUILD.
const READER_BUDGET_MS = 50;

// R3 context-weight budget: the maximum number of capability options the read
// surfaces on an ambient turn. Keeps the read light. This is OPTION CONTENT only --
// it is NOT MAX_K (the frozen Part 3 chooser clamp) and NOT DIAL_REACH_K (the frozen
// 6-reach dial cap). READER never touches those frozen contracts.
const READER_MAX_OPTIONS = 5;

// LOCAL derived machinery cache of the validated projection. Cross-call caching of
// the PROJECTION is sanctioned (Canon Part 8 / Part 11 R7: the projection is a
// derived read-model of generic machinery metadata, consumed LOCAL-only at
// decide/rank time -- it is NOT user memory, so the readQuadruple cross-call-cache
// ban does NOT apply here). The cache holds machinery topology, never a navigator's
// bytes.
let _cache = null; // { ok, projection, source, reason }

function _repoRoot() {
  // __dirname == <repo>/lib/core/reader -> three up is the repo root.
  return path.resolve(__dirname, '..', '..', '..');
}

function _defaultProjectionPath() {
  return path.join(_repoRoot(), 'data', 'brain-orchestration-projection.json');
}

/**
 * loadProjection(opts) -> { ok, projection, source, reason }
 *
 * READER-01. Reads the LOCAL projection file. Never throws. Injection seam:
 *   opts.projection      an in-memory projection object (bypasses disk + cache)
 *   opts.projectionPath  an explicit path (bypasses the default + cache)
 * A missing or unreadable file degrades to { ok:false, projection:null, reason }.
 */
function loadProjection(opts) {
  const o = opts || {};
  if (o.projection !== undefined && o.projection !== null) {
    return { ok: true, projection: o.projection, source: 'injected', reason: 'ok' };
  }
  const p = (typeof o.projectionPath === 'string' && o.projectionPath.length > 0)
    ? o.projectionPath
    : _defaultProjectionPath();
  try {
    if (!fs.existsSync(p)) {
      return { ok: false, projection: null, source: p, reason: 'projection_missing' };
    }
    const raw = fs.readFileSync(p, 'utf8');
    const parsed = JSON.parse(raw);
    return { ok: true, projection: parsed, source: p, reason: 'ok' };
  } catch (_e) {
    return { ok: false, projection: null, source: p, reason: 'projection_unreadable' };
  }
}

/**
 * validateProjection(projection) -> { valid, reason, node_count, checks }
 *
 * R2 -- the projection-correctness gate. Runs on the projection nodes BEFORE the
 * read and FAILS CLOSED on a malformed projection. Validates:
 *   - projection is an object carrying a non-empty `nodes` array
 *   - every node has a string id and a string kind (shape)
 *   - every node carries methodology_tier of exactly 'pws' | 'mindrian-operation'
 *   - no duplicate node ids
 * Never throws. The 249-node hygiene is already met, so this PASSES today; it is the
 * guard for any future malformed projection.
 */
function validateProjection(projection) {
  const checks = {
    is_object: false,
    has_nodes_array: false,
    all_tier_tagged: true,
    no_dupes: true,
    shape_ok: true,
  };
  if (!projection || typeof projection !== 'object' || Array.isArray(projection)) {
    return { valid: false, reason: 'not_an_object', node_count: 0, checks };
  }
  checks.is_object = true;
  const nodes = projection.nodes;
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return { valid: false, reason: 'no_nodes_array', node_count: 0, checks };
  }
  checks.has_nodes_array = true;
  const seen = new Set();
  for (const n of nodes) {
    if (!n || typeof n !== 'object'
        || typeof n.id !== 'string' || n.id.length === 0
        || typeof n.kind !== 'string' || n.kind.length === 0) {
      checks.shape_ok = false;
      return { valid: false, reason: 'malformed_node_shape', node_count: nodes.length, checks };
    }
    if (VALID_TIERS.indexOf(n.methodology_tier) === -1) {
      checks.all_tier_tagged = false;
      return { valid: false, reason: 'missing_or_bad_methodology_tier', node_count: nodes.length, checks };
    }
    if (seen.has(n.id)) {
      checks.no_dupes = false;
      return { valid: false, reason: 'duplicate_node_id', node_count: nodes.length, checks };
    }
    seen.add(n.id);
  }
  return { valid: true, reason: 'ok', node_count: nodes.length, checks };
}

// Derive the LOCAL context signals the ranker keys on (enum/scalar/slug only; Part 8).
function _contextSignals(context) {
  const c = context || {};
  const firing = new Set();
  if (Array.isArray(c.firingSensors)) {
    for (const s of c.firingSensors) if (typeof s === 'string') firing.add(s);
  }
  let preferredReach = typeof c.reach_id === 'string' ? c.reach_id : null;
  if (!preferredReach && Array.isArray(c.sensorReaches)) {
    for (const r of c.sensorReaches) {
      if (r && typeof r === 'object' && typeof r.reach_id === 'string') {
        preferredReach = r.reach_id;
        break;
      }
    }
  }
  return { firing, preferredReach };
}

/**
 * rankCapabilities(projection, context, opts) -> [ ranked... ]
 *
 * READER-02. DETERMINISTIC ranking of the projection's invocable capabilities (the
 * nodes carrying a `ranking` block) for the current navigator context:
 *   base score      1000 - hierarchy_rank   (a lower rank ranks higher)
 *   context bonus   +10000 when a node's sensor_triggers intersect the firing
 *                   sensors; +5000 when the node's reach_id matches the preferred
 *                   reach from the fired top sensor reach
 *   tie-break       node id ascending (a total order -> deterministic output)
 * Returns scalars/slugs only (Part 8). Capped at opts.limit || READER_MAX_OPTIONS.
 */
function rankCapabilities(projection, context, opts) {
  const o = opts || {};
  const limit = (typeof o.limit === 'number' && o.limit > 0) ? o.limit : READER_MAX_OPTIONS;
  const out = [];
  if (!projection || !Array.isArray(projection.nodes)) return out;
  const { firing, preferredReach } = _contextSignals(context);

  const candidates = [];
  for (const n of projection.nodes) {
    if (!n || typeof n !== 'object') continue;
    const ranking = n.ranking;
    if (!ranking || typeof ranking !== 'object') continue; // only invocable capabilities

    const hier = (typeof ranking.hierarchy_rank === 'number')
      ? ranking.hierarchy_rank
      : (typeof n.hierarchy_rank === 'number' ? n.hierarchy_rank : 9999);
    let score = 1000 - hier;

    const triggers = Array.isArray(n.sensor_triggers)
      ? n.sensor_triggers
      : (Array.isArray(ranking.sensor_triggers) ? ranking.sensor_triggers : []);
    let ctxMatched = false;
    if (firing.size > 0) {
      for (const t of triggers) {
        if (firing.has(t)) { score += 10000; ctxMatched = true; break; }
      }
    }
    const reachId = typeof n.reach_id === 'string'
      ? n.reach_id
      : (typeof ranking.reach_id === 'string' ? ranking.reach_id : null);
    if (preferredReach && reachId === preferredReach) { score += 5000; ctxMatched = true; }

    candidates.push({
      id: n.id,
      name: typeof n.name === 'string' ? n.name : n.id,
      kind: typeof n.kind === 'string' ? n.kind : null,
      methodology_tier: n.methodology_tier,
      reach_id: reachId,
      sub_mode: typeof n.sub_mode === 'string'
        ? n.sub_mode
        : (typeof ranking.sub_mode === 'string' ? ranking.sub_mode : null),
      framework: typeof n.framework === 'string'
        ? n.framework
        : (typeof ranking.framework === 'string' ? ranking.framework : null),
      hierarchy_rank: hier,
      posture: typeof n.posture === 'string'
        ? n.posture
        : (typeof ranking.posture === 'string' ? ranking.posture : null),
      score: score,
      context_matched: ctxMatched,
    });
  }

  candidates.sort(function (a, b) {
    if (b.score !== a.score) return b.score - a.score;
    return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0);
  });
  return candidates.slice(0, limit);
}

/**
 * surfaceAsOptionContent(ranked) -> [ option-content... ]
 *
 * READER-03. Renders the ranked capabilities as Shape F Decision-Gate OPTION
 * CONTENT. This is CONTENT, not a fire: every option carries `fires: false`. The
 * caller (the decision gate) decides; READER never runs the capability (READER-04).
 */
function surfaceAsOptionContent(ranked) {
  const options = [];
  if (!Array.isArray(ranked)) return options;
  for (const r of ranked) {
    if (!r || typeof r !== 'object') continue;
    const isCommand = typeof r.name === 'string' && r.name.indexOf('/mos:') === 0;
    options.push({
      label: r.name,
      command: isCommand ? r.name : null,
      reach_id: r.reach_id,
      sub_mode: r.sub_mode,
      framework: r.framework,
      methodology_tier: r.methodology_tier,
      why: r.context_matched
        ? 'context-matched capability (projection-ranked)'
        : 'projection-ranked capability',
      // READER-04 structural marker: READER surfaces options; it NEVER fires one.
      fires: false,
    });
  }
  return options;
}

function _result(options, info) {
  const readMs = Date.now() - info.startMs;
  return {
    options: options, // null when skipped
    skipped: info.skipped === true,
    reason: info.reason,
    ranked: info.ranked || null,
    gate: info.gate || null,
    projection_node_count: info.gate ? info.gate.node_count : 0,
    _meta: {
      read_ms: readMs,
      budget_ms: READER_BUDGET_MS,
      within_budget: readMs <= READER_BUDGET_MS,
      max_options: READER_MAX_OPTIONS,
      option_count: Array.isArray(options) ? options.length : 0,
    },
  };
}

/**
 * offerProjectionCapabilities(context, opts) -> result
 *
 * The single decide()-facing entry. Loads the projection (cached for the default
 * file), runs the R2 gate BEFORE the read, ranks, surfaces, and returns the option
 * content plus the R3 budget telemetry. Never throws. On any skip (missing /
 * unreadable / R2-rejected projection) it returns { options:null, skipped:true,
 * reason } so decide() degrades gracefully and still returns.
 */
function offerProjectionCapabilities(context, opts) {
  const o = opts || {};
  const startMs = Date.now();

  const useCache = (o.projection === undefined || o.projection === null)
    && !o.projectionPath
    && o.noCache !== true;

  let loaded;
  if (useCache && _cache) {
    loaded = _cache;
  } else {
    loaded = loadProjection(o);
    if (useCache) _cache = loaded;
  }

  if (!loaded.ok || !loaded.projection) {
    return _result(null, { skipped: true, reason: loaded.reason || 'projection_unavailable', gate: null, startMs });
  }

  // R2 gate BEFORE the read. Fails CLOSED.
  const gate = validateProjection(loaded.projection);
  if (!gate.valid) {
    return _result(null, { skipped: true, reason: 'r2_gate_failed:' + gate.reason, gate, startMs });
  }

  const ranked = rankCapabilities(loaded.projection, context, o);
  const options = surfaceAsOptionContent(ranked);
  return _result(options, { skipped: false, reason: 'ok', gate, ranked, startMs });
}

// Test seam: drop the LOCAL projection cache so an injected fixture is honored.
function __resetCache() { _cache = null; }

module.exports = {
  offerProjectionCapabilities: offerProjectionCapabilities,
  loadProjection: loadProjection,
  validateProjection: validateProjection,
  rankCapabilities: rankCapabilities,
  surfaceAsOptionContent: surfaceAsOptionContent,
  READER_BUDGET_MS: READER_BUDGET_MS,
  READER_MAX_OPTIONS: READER_MAX_OPTIONS,
  VALID_TIERS: VALID_TIERS,
  __resetCache: __resetCache,
};
