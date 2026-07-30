'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 125-05 -- F-selector top-K ranker. Pure synchronous function.
 * ====================================================================
 * Implements CONTEXT.md D1-D11. Plan 05 of the 9-plan F-selector ranker
 * phase. The heart of Phase 125 -- turns the packet (Phase 110) + projections
 * (Plan 01) + command registry (Phase 122 + Phase 104.1) into a top-K
 * ranked F-selector list with investment-aware content selection (D9) and
 * decay-weight integration (D7).
 *
 * HARD PRECONDITION: Phase 104.1 ships jtbd_label + jtbd_summary + teaching
 * fields in data/command-registry.json. The ranker fails closed on every
 * command if Phase 104.1 hasn't shipped (returns empty list, no crash).
 * Verified at module load via the contract: every command must have all
 * three fields or it is excluded from F-selector output.
 *
 * Canon Part 7 (reuse over build): extends shipped command-resolver +
 *   chain-recommender + packet without modifying their closed surfaces.
 * Canon Part 8 (Graph Boundary): zero Brain calls (consumes packet, never
 *   issues query); LOCAL only. No network. No db writes. No I/O writes.
 * Canon Part 9 (Memory Locality): this ranker is the "ranks structured
 *   packets" face -- SQL navigates; Brain reasons over packets that have
 *   already been built; this module just ranks what's on the table.
 *
 * Function signatures LOCKED in 125-CONTEXT.md "Function signatures":
 *   rankForSelector({jtbd, problemType, focusNodeId, roomState,
 *                    packetOptional, k=3}) -> Array<RankedItem>
 *   selectWhyContent(jtbd_summary, teaching, investment_level) -> string
 *   renderInvestmentBadge(investment_level) -> string
 *   renderSliceBadge(slice_scope, slice_rationale) -> string
 *
 * Returned RankedItem shape (CONTEXT.md):
 *   {
 *     command:          '/mos:slug',
 *     jtbd_label:       string,                 // from Phase 104.1
 *     jtbd_summary:     string,                 // from Phase 104.1
 *     teaching:         string,                 // from Phase 104.1 (D11)
 *     framework:        string,                 // implementation detail
 *     score:            number,                 // 0..1 (D7 decay applied)
 *     why:              string,                 // shape scales with investment (D9)
 *     source:           'packet'|'chain'|'registry-only',
 *     investment_level: number,                 // 0..1
 *   }
 *
 * D4 scoring formula (CONTEXT.md verbatim):
 *   score = (
 *       brain_confidence    * 0.40                                 // always weighted
 *     + (1 - recency_decay) * 0.30 * investment_level              // grows with use
 *     + problem_type_bind   * 0.30 * investment_level              // grows with use
 *   ) / (0.40 + 0.30*investment_level + 0.30*investment_level)     // normalize 0..1
 *
 * License: BSL 1.1.
 */

const path = require('node:path');
const fs = require('node:fs');
const projections = require('../core/navigation/projections.cjs');
const { ROLE_BLEND_KEYS } = require('../core/persona-override.cjs');
// Phase 205-05 (item 5): the role_level competence axis biases the dial DEFAULT +
// elevation emphasis (NO quotas). decision-axes is required for the hedged-always
// posture the dial default descends from (item 4). Both are pure LOCAL modules.
const { ROLE_LEVELS, detectRoleLevel, resolveElevationLean } = require('../core/persona-taxonomy.cjs');
// decision-axes is required LAZILY inside _applyRoleLevelBias (below): a top-level
// require is captured while the module graph is mid-load (navigation-engine <->
// f-selector-ranker already form a runtime cycle), so decisionAxes.SAFE_MODES
// would read undefined. The lazy require resolves the fully-loaded cached module
// at call time.

const REGISTRY_PATH = path.join(__dirname, '..', '..', 'data', 'command-registry.json');
const TAXONOMY_PATH = path.join(__dirname, '..', 'hmi', 'jtbd-taxonomy.json');

// DEFAULT_SEED is duplicated from lib/brain/chain-recommender.cjs intentionally
// to keep rankForSelector synchronous + module-independent for the cold-start
// path. If chain-recommender ever exports DEFAULT_SEED as a const, switch to
// import. Minor Canon Part 7 (reuse) drift accepted in exchange for zero
// cross-module coupling on the hot ranking path.
const DEFAULT_SEED = 'Beautiful Question Framework';

// Phase 121.5-10 Sub-plan K (audit Section 5.2.3 anti-pattern "More than 3
// lines per option"): the locked Brain-suggestion template renders TWO lines
// per option row (glyph + verb + score line, then meta line). With the
// AskUserQuestion auto-injected "Type something" / "Chat about this" rows
// plus the footer stat-strip, the visual budget caps at 3 user-facing
// options. MAX_K = 3 clamps caller k to fit the locked mockup row budget.
const MAX_K = 3;

// ---------------------------------------------------------------------------
// Phase 244 (TRIG-02) -- the dedicated cross-family fusion k, resolved through
// the SAME env-idiom hybrid-retrieve.cjs::resolveRrfK uses (:68-77), but
// reading a DEDICATED env var, TRIG_RRF_K, never the eureka subsystem's own
// fusion-k env var. The two consumers have different corpus sizes (eureka's
// room-scale corpus vs this ranker's MAX_K=3-bounded dial list), so
// overloading one env var would couple two unrelated tuning dials. Defaults
// to 25 (this repo's own
// researched small-corpus value, hybrid-retrieve.cjs:8-13 -- the 2026-07-04
// WebSearch validation prescribing k in 20-30 for small corpora, NOT the
// textbook k=60); invalid values clamp back to 25.
//
// Honest limitation: at k=25 the rank-1-versus-rank-2 RRF gap is about 3.8%,
// small relative to the frozen 0.15 BEHAVIORAL_CHANNEL_MARGIN detent
// threshold below, so RRF ordering alone will rarely flip that detent on its
// own. The diversity term (Plan 07's MMR pass) is what will actually change
// outcomes; this fusion pass earns its keep mainly when a cross-family
// candidate is buried multiple ranks deep by the D4 score.
function _resolveTrigRrfK() {
  const raw = process.env.TRIG_RRF_K;
  if (typeof raw === 'string' && raw.trim() !== '') {
    const v = Number(raw);
    if (Number.isFinite(v) && v > 0) return v;
  }
  return 25;
}
const TRIG_RRF_K = _resolveTrigRrfK();

// ---------------------------------------------------------------------------
// Phase 177-01 -- the BEHAVIORAL-CHANNEL thresholds (BCH-05, BCH-06).
//
// These three numbers govern how a behavioral-channel cue (a later-wave SIGNAL-
// tier observation about the navigator's posture) is allowed to influence the
// ranked selector. They live HERE, in the engine-side ranker, and in NO prompt /
// SKILL.md / larry-server-instructions.md (BCH-05 adversarial grep). The engine
// owns the composed decision; the model emits observations only (the bright line).
//
//   Below floor    < 0.50      cue discarded; engine runs the base curve.
//                              (the discarded cue is STILL LOGGED in a later wave.)
//   Protected band [0.50,0.85] cue fires SIGNAL-tier, OUTRANKS keyword, but
//                              CANNOT override Brain >= 0.70 inside the band.
//   Above ceiling  > 0.85      cue MAY outrank the graph.
//
// The ceiling is COMPUTED, not hand-typed: it is the Brain RECOMMENDED-gate floor
// (navigation-engine.cjs RECOMMENDED_CONFIDENCE_FLOOR == 0.70) PLUS a 0.15 margin,
// so it sits at least 15 points above the Brain floor by construction (BCH-06). If
// the Brain floor ever moves, the channel ceiling tracks it automatically and the
// >= 15-point invariant cannot silently drift. The require is the live source line
// the >= 15-point invariant is derived from -- never a duplicated literal.
const { RECOMMENDED_CONFIDENCE_FLOOR } = require('../core/navigation-engine.cjs');
const BEHAVIORAL_CHANNEL_FLOOR = 0.50;
const BEHAVIORAL_CHANNEL_MARGIN = 0.15;
const BEHAVIORAL_CHANNEL_CEILING = RECOMMENDED_CONFIDENCE_FLOOR + BEHAVIORAL_CHANNEL_MARGIN; // == 0.85
// The protected band is the half-open interval [FLOOR, CEILING]. A cue strictly
// below FLOOR is discarded; a cue strictly above CEILING may outrank the graph.

// ---------------------------------------------------------------------------
// Phase 177-01 -- the IGNITE-PERSONA dial seed (BCH-17, BCH-PERSONA).
//
// A pure, deterministic read of the ignite persona prior off roomState. It seeds
// the dial DEFAULT pre turn-1 so the first turn already leans the right way:
//   - role_blend top=student      -> ASK-leaning LOW seed  (lands in selectWhyContent's
//                                    teaching-density branch, investment_level < 0.4)
//   - role_blend top=founder/investor -> TELL-leaning HIGH seed (lands in the terse
//                                    jtbd_summary branch, investment_level >= 0.7)
//   - any other known role        -> NEUTRAL mid seed (the 0.4-0.7 stitched branch)
// Degrade ladder (never fabricate a blend):
//   role_blend (object of {role:weight}) -> top-weighted role
//   else roomState.canonical_role scalar -> same mapping
//   else                                 -> cold-start NEUTRAL mid seed
// The model emits NO dial; this is engine-side (the bright line). The seed BIASES
// investment_level (the 0.30*investment_level problem_type_bind term, D4) for the
// SAME turn; the Pass-2 prose dial is INJECTED from the composed number, not here.
//
// Seed values are chosen to land squarely inside the three selectWhyContent bands
// (< 0.4 / 0.4-0.7 / >= 0.7) with margin, so the band classification is robust.
const IGNITE_SEED_ASK = 0.20;      // student -> patient, ASK-leaning, teaching density
const IGNITE_SEED_NEUTRAL = 0.55;  // unknown/other known role -> balanced mid
const IGNITE_SEED_TELL = 0.80;     // founder/investor -> terse, TELL-leaning

// role-key (one of ROLE_BLEND_KEYS) -> seed. student is the lone ASK lean; founder
// and investor are the TELL lean; the remaining known roles take the neutral mid.
const _ROLE_SEED = Object.freeze({
  student: IGNITE_SEED_ASK,
  founder: IGNITE_SEED_TELL,
  investor: IGNITE_SEED_TELL,
  researcher: IGNITE_SEED_NEUTRAL,
  operator: IGNITE_SEED_NEUTRAL,
  mentor: IGNITE_SEED_NEUTRAL,
  domain_expert: IGNITE_SEED_NEUTRAL,
});

// Normalize an arbitrary role label to one of the 7 frozen ROLE_BLEND_KEYS, or
// null. Mirrors persona-override.normalizeRoleKey without importing the private
// fn: lowercase, collapse whitespace to underscore, membership-check the frozen set.
function _normalizeRoleKey(k) {
  if (typeof k !== 'string') return null;
  const key = k.trim().toLowerCase().replace(/\s+/g, '_');
  return ROLE_BLEND_KEYS.indexOf(key) >= 0 ? key : null;
}

// Pick the top-weighted role from a role_blend object. Ties (and the all-zero /
// all-equal case) break by ROLE_BLEND_KEYS order for determinism. Returns a
// normalized role key, or null when the blend yields no usable role. NEVER
// fabricates a role: an empty / malformed blend returns null (caller degrades).
function _topRoleFromBlend(roleBlend) {
  if (!roleBlend || typeof roleBlend !== 'object' || Array.isArray(roleBlend)) return null;
  let best = null;
  let bestWeight = -Infinity;
  // Iterate in frozen-set order so ties resolve deterministically.
  for (const key of ROLE_BLEND_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(roleBlend, key)) continue;
    const w = roleBlend[key];
    if (typeof w !== 'number' || !Number.isFinite(w)) continue;
    if (w > bestWeight) {
      bestWeight = w;
      best = key;
    }
  }
  return best;
}

// Does roomState carry an ACTUAL ignite persona prior (a usable role_blend or a
// recognized canonical_role scalar)? When false, igniteDialSeed returns the
// cold-start neutral value but the ranker must NOT bias investment_level with it
// (a personaless room keeps its pure runtime gradient, byte-stable with pre-177).
function hasIgnitePrior(roomState) {
  if (!roomState || typeof roomState !== 'object') return false;
  if (_topRoleFromBlend(roomState.role_blend) !== null) return true;
  if (_normalizeRoleKey(roomState.canonical_role) !== null) return true;
  return false;
}

// THE deterministic ignite-persona dial seed. Pure: same roomState -> same seed.
// Returns a number in [0,1]. Degrades real (blend -> canonical_role scalar ->
// cold-start neutral); never fabricates a blend.
function igniteDialSeed(roomState) {
  if (!roomState || typeof roomState !== 'object') return IGNITE_SEED_NEUTRAL;
  // 1. role_blend (the ignite prior, a weighted object).
  const topFromBlend = _topRoleFromBlend(roomState.role_blend);
  if (topFromBlend !== null) {
    return _ROLE_SEED[topFromBlend];
  }
  // 2. degrade to the canonical_role scalar.
  const scalarKey = _normalizeRoleKey(roomState.canonical_role);
  if (scalarKey !== null) {
    return _ROLE_SEED[scalarKey];
  }
  // 3. neither present -> cold-start NEUTRAL. No role invented.
  return IGNITE_SEED_NEUTRAL;
}

// Per-process caches. The registry + taxonomy are generated artifacts that do
// not change during a run; reading each once is the command-resolver.cjs
// precedent. Tests can override the registry via _test._setRegistry.
let _registryCache = null;
let _taxonomyCache = null;

function _loadRegistry() {
  if (_registryCache) return _registryCache;
  try {
    _registryCache = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  } catch (_e) {
    _registryCache = { commands: [] };
  }
  return _registryCache;
}

function _loadTaxonomy() {
  if (_taxonomyCache) return _taxonomyCache;
  try {
    _taxonomyCache = JSON.parse(fs.readFileSync(TAXONOMY_PATH, 'utf8'));
  } catch (_e) {
    _taxonomyCache = { entries: [] };
  }
  return _taxonomyCache;
}

// Test seam. Lets tests reset between cases AND inject a fake registry shape
// so the ranker doesn't have to read disk. NOT exposed via the public API.
function _resetCaches() {
  _registryCache = null;
  _taxonomyCache = null;
}
function _setRegistry(obj) {
  _registryCache = obj || { commands: [] };
}
function _setTaxonomy(obj) {
  _taxonomyCache = obj || { entries: [] };
}

// ---------------------------------------------------------------------------
// D9 implementation -- content selection by investment_level.
// Pure. Same inputs -> same output. No I/O. No state mutation.
//
//   investment_level < 0.4         -> teaching (Larry-voice prose)
//   investment_level >= 0.7        -> jtbd_summary (terse rationale)
//   0.4 <= investment_level < 0.7  -> stitched: teaching + ' -- ' + jtbd_summary
//
// The separator is ' -- ' (double-hyphen with spaces) per the project no-em-
// dash rule + CONTEXT.md D9 (Open question 9 resolution: lean double-hyphen
// over parens or newline).
// ---------------------------------------------------------------------------
function selectWhyContent(jtbd_summary, teaching, investment_level) {
  const hasJtbd = typeof jtbd_summary === 'string' && jtbd_summary.length > 0;
  const hasTeaching = typeof teaching === 'string' && teaching.length > 0;
  if (!hasJtbd && !hasTeaching) return '';
  if (!hasJtbd) return teaching;
  if (!hasTeaching) return jtbd_summary;
  const lvl = (typeof investment_level === 'number') ? investment_level : 0;
  if (lvl < 0.4) return teaching;
  if (lvl >= 0.7) return jtbd_summary;
  // Mid-band: stitch with the ' -- ' separator.
  return teaching + ' -- ' + jtbd_summary;
}

// ---------------------------------------------------------------------------
// D5 visible-investment badge. Single-line, <= 80 chars. The renderer (F-
// selector consumer) drops this string into the intelligence strip.
// ---------------------------------------------------------------------------
function renderInvestmentBadge(investment_level) {
  const lvl = (typeof investment_level === 'number')
    ? Math.max(0, Math.min(1, investment_level))
    : 0;
  const pct = Math.round(lvl * 100);
  const remaining = Math.max(0, 10 - Math.round(lvl * 10));
  let line;
  if (lvl === 0) {
    line = 'Investment: 0% -- Brain priors only (10 invocations to full local)';
  } else if (lvl >= 1.0) {
    line = 'Investment: 100% -- full local scoring with Brain confidence';
  } else {
    line = 'Investment: ' + pct + '% -- Brain + local signal ('
      + remaining + ' invocations to full)';
  }
  return (line.length > 80) ? line.slice(0, 80) : line;
}

// ---------------------------------------------------------------------------
// D5 slice rationale badge. Single-line, <= 80 chars.
// ---------------------------------------------------------------------------
function renderSliceBadge(slice_scope, slice_rationale) {
  const scope = (slice_scope === 1 || slice_scope === 2 || slice_scope === 3)
    ? slice_scope : 3;
  const rationaleStr = (typeof slice_rationale === 'string') ? slice_rationale : '';
  const head = 'Slice: ' + scope + ' hop' + (scope === 1 ? '' : 's') + ' -- ';
  const room = Math.max(0, 80 - head.length);
  const rationaleShort = rationaleStr.slice(0, room);
  return head + rationaleShort;
}

// ---------------------------------------------------------------------------
// Phase 125-07 -- D8 none-fit affordance label. The user-facing string the
// F-selector renderer places alongside F.0/F.1/F.2 affordances when none of
// the top-K fit the user's intent. Per CONTEXT.md Open Question #8 lean
// ("None fit -- tell me what you need"). Larry-voice; clear; <= 80 chars
// for the single-line intelligence strip. Deterministic (idempotent across
// calls -- the renderer can cache freely).
//
// Wave-1 user test of the wording remains an Open Question for v2 (per
// Open Q #8). When that test lands, swap the literal here -- no consumer
// change needed because the renderer treats this as an opaque label string.
//
// The consumer (F-selector renderer) is responsible for the follow-up
// /mos:do call when the user picks this affordance. recordSelectorMiss
// (Plan 07; same Phase 125-07 wave) is the capture writer that pairs with
// this label.
// ---------------------------------------------------------------------------
function renderNoneFitAffordance() {
  return 'None fit -- tell me what you need';
}

// ---------------------------------------------------------------------------
// D7 decay-weight integration. When opts._applyDecayWeight is provided
// (typically by the F-selector renderer that wires Plan 05 + Plan 06), apply
// it. When absent, default no-op (returns base score untouched). Plan 06
// ships the actual decay function; Plan 05 stays callable in its absence.
// ---------------------------------------------------------------------------
function _applyDecay(applyDecayWeight, baseScore, commandId, roomState) {
  if (typeof applyDecayWeight !== 'function') return baseScore;
  try {
    const adjusted = applyDecayWeight(baseScore, commandId, roomState);
    return (typeof adjusted === 'number' && isFinite(adjusted)) ? adjusted : baseScore;
  } catch (_e) {
    return baseScore;
  }
}

// JTBD selection per RESEARCH G-01: lean roomState.activeJtbd if it matches
// one of the command's serves_jtbd entries; otherwise fall back to serves_jtbd[0].
function _resolveJtbdForCommand(cmd, roomState) {
  const serves = Array.isArray(cmd.serves_jtbd) ? cmd.serves_jtbd : [];
  if (serves.length === 0) return null;
  const activeJtbd =
    (roomState && typeof roomState.activeJtbd === 'string') ? roomState.activeJtbd : null;
  if (activeJtbd && serves.indexOf(activeJtbd) !== -1) return activeJtbd;
  return serves[0];
}

// Extract brain_confidence for this command's framework from the packet's
// framework_chain_hint. The highest confidence edge that touches the
// framework (as source or target) wins. Returns null when no signal.
function _brainConfidenceFromPacket(packetOptional, framework) {
  if (!packetOptional || !packetOptional.local_graph_summary) return null;
  const hint = packetOptional.local_graph_summary.framework_chain_hint;
  if (!hint || !Array.isArray(hint.edges)) return null;
  let best = null;
  for (const e of hint.edges) {
    if (!e) continue;
    const touches = (e.from === framework) || (e.to === framework);
    if (touches && typeof e.confidence === 'number') {
      if (best === null || e.confidence > best) best = e.confidence;
    }
  }
  return best;
}

// D4 recency_decay term: 1.0 = fully decayed (old); 0.0 = fresh.
// Computed from roomState.lastInvokedAt[command] if available (ms epoch),
// else 0.5 default. Linear ramp: 0..30 days -> 0..1.
function _recencyDecay(cmd, roomState) {
  if (!roomState || !roomState.lastInvokedAt) return 0.5;
  const last = roomState.lastInvokedAt[cmd.command];
  if (typeof last !== 'number' || !isFinite(last)) return 0.5;
  const ageDays = (Date.now() - last) / (24 * 3600 * 1000);
  if (ageDays <= 0) return 0;
  return Math.min(1.0, ageDays / 30);
}

// D4 problem_type_bind term: 1.0 if the command's frameworks align with
// roomState.problemType's preferred shape; 0.0 otherwise; 0.5 default when
// problemType is absent.
// Simple proxy (Plan 05 v1; Plan 06+ may refine via Brain chain weight):
//   WDP        + kind=methodology                                  -> 1.0
//   UDP/IDP    + frameworks includes 'Beautiful Question Framework'-> 1.0
//   else                                                           -> 0.5
function _problemTypeBind(cmd, roomState) {
  if (!roomState || typeof roomState.problemType !== 'string') return 0.5;
  const pt = roomState.problemType.toUpperCase();
  const fws = Array.isArray(cmd.frameworks) ? cmd.frameworks : [];
  if (pt === 'WDP' && cmd.kind === 'methodology') return 1.0;
  if ((pt === 'UDP' || pt === 'IDP') && fws.indexOf('Beautiful Question Framework') !== -1) {
    return 1.0;
  }
  return 0.5;
}

// D4 scoring formula. Numerator + denominator coded with the exact 0.40 /
// 0.30 / 0.30 weights from CONTEXT.md. Normalizes to 0..1 at every
// investment_level; investment_level=0 reduces to pure brain_confidence
// (no discontinuity).
function _scoreCommand({ cmd, packetOptional, roomState, investment_level }) {
  const fw = (Array.isArray(cmd.frameworks) && cmd.frameworks.length > 0)
    ? cmd.frameworks[0] : DEFAULT_SEED;
  const bc = _brainConfidenceFromPacket(packetOptional, fw);
  const brain_confidence = (typeof bc === 'number') ? bc : 0.5;
  const recency_decay = _recencyDecay(cmd, roomState);
  const problem_type_bind = _problemTypeBind(cmd, roomState);
  const inv = investment_level;
  const numerator =
      brain_confidence * 0.40
    + (1 - recency_decay) * 0.30 * inv
    + problem_type_bind * 0.30 * inv;
  const denominator = 0.40 + 0.30 * inv + 0.30 * inv;
  if (denominator <= 0) return 0;
  return numerator / denominator;
}

// Phase 121.5-10 Sub-plan K: derive optional `category` field for the locked
// Brain-suggestion template meta row. Sourced from packetOptional's
// local_graph_summary.category_hint when present, falling back to the
// command's registry-declared `kind` field, falling back to '' (empty string
// is acceptable per the locked template -- the meta row renders blank).
function _categoryFromPacket(packetOptional, cmd) {
  if (packetOptional && packetOptional.local_graph_summary
      && typeof packetOptional.local_graph_summary.category_hint === 'string'
      && packetOptional.local_graph_summary.category_hint.length > 0) {
    return packetOptional.local_graph_summary.category_hint;
  }
  if (cmd && typeof cmd.kind === 'string' && cmd.kind.length > 0) return cmd.kind;
  return '';
}

// Phase 121.5-10 Sub-plan K: derive optional `graph_relationship` field for
// the locked Brain-suggestion template meta row. Sourced from
// packetOptional's framework_chain_hint -- the highest-confidence edge that
// touches the framework gets its relationship rendered (e.g. "feeds Porter
// Five Forces"). Falls back to '' when no edge data exists.
function _graphRelationshipFromPacket(packetOptional, framework) {
  if (!packetOptional || !packetOptional.local_graph_summary) return '';
  const hint = packetOptional.local_graph_summary.framework_chain_hint;
  if (!hint || !Array.isArray(hint.edges)) return '';
  let bestEdge = null;
  let bestConf = -1;
  for (const e of hint.edges) {
    if (!e) continue;
    const touches = (e.from === framework) || (e.to === framework);
    if (touches && typeof e.confidence === 'number' && e.confidence > bestConf) {
      bestConf = e.confidence;
      bestEdge = e;
    }
  }
  if (!bestEdge) return '';
  const rel = (typeof bestEdge.relationship === 'string' && bestEdge.relationship.length > 0)
    ? bestEdge.relationship : 'feeds';
  const target = (bestEdge.from === framework)
    ? (typeof bestEdge.to === 'string' ? bestEdge.to : '')
    : (typeof bestEdge.from === 'string' ? bestEdge.from : '');
  if (target.length === 0) return rel;
  return rel + ' ' + target;
}

// Per-command source attribution per Test 5 (CONTEXT.md acceptance):
//   packet has framework_chain_hint with edges            -> 'packet'
//   command has frameworks[] (chain-recommender-derivable)-> 'chain'
//   neither                                               -> 'registry-only'
function _sourceFor(packetOptional, cmd) {
  if (packetOptional
      && packetOptional.local_graph_summary
      && packetOptional.local_graph_summary.framework_chain_hint) {
    const hint = packetOptional.local_graph_summary.framework_chain_hint;
    if (Array.isArray(hint.edges) && hint.edges.length > 0) return 'packet';
  }
  if (Array.isArray(cmd.frameworks) && cmd.frameworks.length > 0) return 'chain';
  return 'registry-only';
}

// ---------------------------------------------------------------------------
// Phase 205-03 -- the SENS-10 anti-circular RANKER FLIP (clarify-vs-reframe).
//
// When the SENS-10 circularity sensor fires this turn, a clarifying ASK (asking
// the SAME question again, within the current frame) PERPETUATES the circle and
// must NEVER be the recommended detent. A REFRAME ASK (a NEW question that
// changes the frame -- the beautiful-question exit) is the allowed ASK. This is
// the clarify-vs-reframe rule (205-CONTEXT.md item 2).
//
// This is a RANKING SUPPRESSION, not a bank edit (mirrors the Phase 158
// discount-touches-runtime-only discipline): no command is removed from the
// registry; the flip only reorders the already-scored list for THIS turn.
// It runs ONLY when sens10.fired === true, so a turn with no SENS-10 signal
// returns byte-identical to the pre-205 behavior (the no-op guard).
//
// The frozen Shape-F scalars are untouched: MAX_K, the 0.70/0.15 detent, and the
// D4 weights are NOT changed here. The 0.70 act-vs-offer line (D-Q4) is governed
// downstream; this task only governs the clarify-vs-reframe recommendation.
//
// Detent classification over the scored rows (each row is a command):
//   exit               the SENS-10 exit command (sens10.exit_command) -> TOP
//   ask_reframe        the reframe path (sens10.reframe_command, default
//                      /mos:beautiful-question, or framework 'Beautiful Question
//                      Framework') -> kept ELIGIBLE (a reserved slot)
//   ask_clarification  a re-ask-within-frame command (sens10.clarify_commands)
//                      -> demoted BELOW every non-clarification row (never top)
//   other              everything else -> score order
//
// Ordering: [exit(s)] then [one reframe] then [remaining reframe + other by
// score] then [clarification last], sliced to k.
const SENS10_DEFAULT_REFRAME_COMMAND = '/mos:beautiful-question';
const SENS10_REFRAME_FRAMEWORK = 'Beautiful Question Framework';

function _applySens10Flip(scored, sens10, k) {
  const exitCmd = (typeof sens10.exit_command === 'string') ? sens10.exit_command : '';
  const reframeCmd = (typeof sens10.reframe_command === 'string' && sens10.reframe_command)
    ? sens10.reframe_command : SENS10_DEFAULT_REFRAME_COMMAND;
  const clarify = Array.isArray(sens10.clarify_commands)
    ? sens10.clarify_commands.filter(function (c) { return typeof c === 'string'; })
    : [];
  const cause = (typeof sens10.cause === 'string') ? sens10.cause : '';

  function detentOf(item) {
    if (exitCmd && item.command === exitCmd) return 'exit';
    if (item.command === reframeCmd || item.framework === SENS10_REFRAME_FRAMEWORK) return 'ask_reframe';
    if (clarify.indexOf(item.command) !== -1) return 'ask_clarification';
    return 'other';
  }

  // Tag on a COPY so the base rows stay clean (the sens10 fields appear only on
  // the flipped output). scored is already sorted score-desc, so partitioning
  // preserves score order within each detent bucket.
  const tagged = scored.map(function (it) {
    return Object.assign({}, it, {
      detent: detentOf(it),
      sens10_applied: true,
      sens10_cause: cause,
    });
  });

  const exit = tagged.filter(function (t) { return t.detent === 'exit'; });
  const reframe = tagged.filter(function (t) { return t.detent === 'ask_reframe'; });
  const others = tagged.filter(function (t) { return t.detent === 'other'; });
  const clarification = tagged.filter(function (t) { return t.detent === 'ask_clarification'; });

  const ordered = [];
  for (const e of exit) ordered.push(e);              // exit(s) recommended (top)
  if (reframe.length) ordered.push(reframe[0]);       // reserve a reframe slot (eligible)
  const middle = reframe.slice(1).concat(others).sort(function (a, b) { return b.score - a.score; });
  for (const m of middle) ordered.push(m);            // remaining reframe + others by score
  for (const c of clarification) ordered.push(c);     // clarification always last (never recommended)

  return ordered.slice(0, k);
}

// ---------------------------------------------------------------------------
// Phase 205-05 (item 5) -- the role_level DIAL-DEFAULT + elevation-emphasis bias.
//
// role_level (student|practitioner|researcher|professor) biases which elevation
// direction the default leans toward, per Lawrence's Test-6 ratio: a student
// skews VERTICAL (depth), every non-student skews HORIZONTAL/LATERAL (connect
// their own separate ideas + import from outside). This is a BIAS on the seed /
// default only -- it must NOT force a fixed count of any elevation type (Non-goal:
// no elevation quotas; gate on signal). There is NO count/quota gate here: the
// helper stamps a lean descriptor and NEVER filters, caps, or requires N of any
// direction. The hedged-always decision posture (item 4) rides alongside: the
// default is offered as an ASK unless the confidence detent permits act-report,
// and it is ALWAYS hedged (decision-axes clamps the confidence axis off).
//
// Runs ONLY when a role_level resolves (explicit arg, roomState, or detection off
// opening turns). Absent role_level => this is a no-op and the returned list is
// byte-identical to the pre-205-05 shape (so the 205-03 / 205-04 suites, which
// pass no role_level, stay green).
function _resolveRoleLevel(o, roomState) {
  // Precedence: explicit arg -> roomState scalar -> detection off opening turns.
  if (typeof o.role_level === 'string' && ROLE_LEVELS.indexOf(o.role_level) !== -1) {
    return o.role_level;
  }
  if (roomState && typeof roomState.role_level === 'string'
      && ROLE_LEVELS.indexOf(roomState.role_level) !== -1) {
    return roomState.role_level;
  }
  const turns = (o.openingTurns !== undefined) ? o.openingTurns
    : (roomState ? roomState.openingTurns : undefined);
  const detected = detectRoleLevel(turns);
  return (detected !== null) ? detected : null;
}

function _applyRoleLevelBias(list, role_level) {
  const lean = resolveElevationLean(role_level);
  if (lean === null) return list; // no bias resolvable -> no-op.
  // The dial default is ALWAYS hedged (item 4): stamp the hedged-always posture
  // so the default cannot descend into a confident tell. This reads decision-axes
  // as the single source of the confidence-axis clamp; the exact mode still
  // resolves per turn downstream from the live confidence scalar.
  const decisionAxes = require('../core/decision-axes.cjs');
  const hedgedAlways = decisionAxes.SAFE_MODES.indexOf('tell_and_confident') === -1;
  return list.map(function (it) {
    return Object.assign({}, it, {
      role_level: role_level,
      // The elevation the default LEANS toward (bias, not a quota).
      elevation_lean: lean.primary,
      elevation_secondary: lean.secondary,
      // The confidence axis is clamped to hedged for the default (never confident).
      dial_default_hedged: hedgedAlways,
    });
  });
}

// ---------------------------------------------------------------------------
// Phase 244 (TRIG-02) -- the optional cross-family RANK FUSION pass.
//
// Closes RESEARCH BLOCKER B-1: the `scored` rows here carry no trigger-tier
// field (they are read from data/command-registry.json, not sensor candidate
// reaches -- 244-RESEARCH.md Q3). Rather than making this function depend on
// sensor output, the caller (lib/core/orchestration-candidate-lift.cjs, Task
// 2 of this plan) builds tier-tagged command-slug lists from data ALREADY in
// its own scope and threads them in as o.tierCandidates. This keeps
// rankForSelector pure/sync/registry-only while still closing the seam at
// both ends (a production caller genuinely supplies the argument).
//
// Fusion calls the ALREADY-SHIPPED rrfFuse (hybrid-retrieve.cjs:90-118) --
// writing a second fusion implementation here would be a Canon Part 7
// violation. rrfFuse reads array POSITION, never item.score/item.rank, so it
// is immune to bm25's negative-score sign convention: both the `command_d4`
// list built below (already sorted score-desc, see the sort above) and any
// caller-supplied list are assumed pre-sorted best-first; no normalization,
// no sign flip, no min-max scaling happens anywhere in this pass.
//
// No-op guard + copy-on-write, mirroring _applyRoleLevelBias immediately
// above: absent/empty tierCandidates, or a tierCandidates array that
// contributes zero usable items (a string, a number, an array of nulls, a
// list whose items lack `id`), returns the INPUT ARRAY BY REFERENCE
// untouched -- byte-identical to the pre-244 shape. Every base row is copied
// via Object.assign before any field is added; base rows are never mutated.
// Wrapped in a try/catch that degrades to the untouched input on any fault.
function _applyTierFusion(scored, tierCandidates, k) {
  if (!Array.isArray(tierCandidates) || tierCandidates.length === 0) return scored;
  try {
    // Function-local require (the navigation-engine.cjs:510 idiom) to avoid a
    // module-load cycle: hybrid-retrieve.cjs sits under lib/core/eureka/, and
    // a top-level require here would be evaluated while this module's own
    // graph may still be mid-load.
    const { rrfFuse } = require('../core/eureka/hybrid-retrieve.cjs');

    // Count usable items across every supplied list (id != null). A
    // malformed tierCandidates array (garbage entries, items without id)
    // contributes zero usable items, in which case fusion is a no-op even
    // though the top-level Array.isArray/length guard above passed.
    function usableItems(entry) {
      const arr = Array.isArray(entry)
        ? entry
        : (entry && Array.isArray(entry.items) ? entry.items : []);
      return arr.filter(function (it) { return it && typeof it === 'object' && it.id != null; });
    }
    let suppliedCount = 0;
    const suppliedIds = new Set();
    for (const entry of tierCandidates) {
      for (const item of usableItems(entry)) {
        suppliedCount += 1;
        suppliedIds.add(item.id);
      }
    }
    if (suppliedCount === 0) return scored;

    // The D4 registry list, already sorted score-desc by the caller (the
    // sort above this composition). This is list index 0 so command_d4 wins
    // ties over caller-supplied sources in rrfFuse's DEFAULT_SOURCE_NAMES
    // fallback (irrelevant here since every list is explicitly tagged).
    const commandD4 = {
      source: 'command_d4',
      items: scored.map(function (r) { return { id: r.command }; }),
    };
    const fused = rrfFuse([commandD4].concat(tierCandidates), TRIG_RRF_K);

    const byCommand = new Map();
    for (const row of scored) byCommand.set(row.command, row);

    const seen = new Set();
    const out = [];
    for (const f of fused) {
      const row = byCommand.get(f.node_id);
      if (!row || seen.has(row.command)) continue;
      seen.add(row.command);
      // Tag on a COPY (never mutate the base row). tier_family is stamped on
      // every returned row so the field is never undefined on some rows.
      const tagged = Object.assign({}, row, { tier_family: 'command' });
      // Only rows that appeared in a CALLER-SUPPLIED list (not merely the
      // internal command_d4 list) additionally carry the fusion evidence.
      if (suppliedIds.has(row.command)) {
        tagged.rrf_score = f.rrf_score;
        tagged.tier_sources = f.sources.slice();
      }
      out.push(tagged);
    }
    // Defensive append: every scored row is already present in command_d4,
    // so this loop should be a no-op in practice, but it guarantees fusion
    // can only REORDER, never DROP, a row -- even if a future edit narrows
    // the command_d4 list.
    for (const row of scored) {
      if (!seen.has(row.command)) {
        seen.add(row.command);
        out.push(Object.assign({}, row, { tier_family: 'command' }));
      }
    }
    return out;
  } catch (_e) {
    return scored;
  }
}

// ---------------------------------------------------------------------------
// MAIN SIGNATURE -- rankForSelector. Pure synchronous function. No Promise.
// No await. No Brain calls. No db writes. No memory_event writes. No event
// subscriptions (D10 invariant). Phase 244 (TRIG-02): the optional
// o.tierCandidates input is caller-supplied LOCAL data (pre-ranked tier-
// tagged command-slug lists a production caller builds from its OWN scope,
// e.g. orchestration-candidate-lift.cjs::buildTierCandidates) -- it widens
// what this function ACCEPTS, not what it DOES. Every clause above stays
// literally true: still sync, still no Promise/await, still no Brain calls,
// still no db writes, still no memory_event writes, still no event
// subscriptions.
// ---------------------------------------------------------------------------
function rankForSelector(args) {
  const o = args || {};
  // jtbd, problemType, focusNodeId are intentionally read off args even when
  // we don't immediately use them here (the LOCKED CONTEXT.md signature
  // preserves them as ranker inputs; consumers may surface them via roomState
  // patching for future tuning passes).
  const jtbd = (typeof o.jtbd === 'string') ? o.jtbd : null;
  const problemType = (typeof o.problemType === 'string') ? o.problemType : null;
  const focusNodeId = (typeof o.focusNodeId === 'string') ? o.focusNodeId : null;
  const roomState = (o.roomState && typeof o.roomState === 'object') ? o.roomState : {};
  const packetOptional = (o.packetOptional && typeof o.packetOptional === 'object')
    ? o.packetOptional : null;
  // Phase 121.5-10 Sub-plan K: clamp k at MAX_K (3) per audit Section 5.2.3
  // anti-pattern -- more than 3 option rows pushes the auto-injected
  // AskUserQuestion "Type something" / "Chat about this" rows off-screen
  // and breaks the locked template visual budget. Caller asking k=20
  // receives k=MAX_K silently. Existing default k=3 unchanged.
  const requestedK = (typeof o.k === 'number' && o.k > 0) ? Math.floor(o.k) : 3;
  const k = Math.min(requestedK, MAX_K);
  const applyDecayWeight = (typeof o._applyDecayWeight === 'function')
    ? o._applyDecayWeight : null;
  // Phase 205-03: the optional SENS-10 circularity signal. When fired, the
  // clarify-vs-reframe flip suppresses ASK-as-clarification as the recommended
  // detent. Absent or not-fired => the flip never runs (byte-identical no-op).
  const sens10 = (o.sens10 && typeof o.sens10 === 'object') ? o.sens10 : null;
  // Phase 244 (TRIG-02): the optional cross-family tier-candidate lists.
  // Absent or not-an-array => the fusion pass never runs (byte-identical
  // no-op).
  const tierCandidates = Array.isArray(o.tierCandidates) ? o.tierCandidates : null;

  // Patch roomState with jtbd / problemType if caller supplied them at the
  // top level but not on roomState. Non-destructive: tests that pass
  // roomState verbatim should see no mutation.
  let effectiveRoomState = roomState;
  if (jtbd && !roomState.activeJtbd) {
    effectiveRoomState = Object.assign({}, roomState, { activeJtbd: jtbd });
  }
  if (problemType && !effectiveRoomState.problemType) {
    effectiveRoomState = Object.assign({}, effectiveRoomState, { problemType });
  }

  // Snapshot investment level at rank time (D9 invariant: all returned items
  // see the same investment_level).
  //
  // Phase 177-01 (BCH-17): seed the dial DEFAULT from the ignite persona prior
  // before the snapshot. The seed is the floor the dial starts from pre turn-1
  // (a student leans ASK / low, a founder or investor leans TELL / high). The
  // runtime computeInvestmentLevel gradient (framework_invocations + turn_count)
  // can rise ABOVE the seed as the room warms up, but never falls below the
  // persona-default lean -- so the FIRST turn already descends from the right
  // posture. max() biases without erasing accumulated runtime signal. Pure +
  // deterministic; the seed is engine-owned (the model emits no dial).
  const { level: computedLevel } = projections.computeInvestmentLevel(effectiveRoomState);
  // Bias ONLY when an actual persona prior is present. A personaless room keeps
  // its pure runtime gradient (byte-stable with pre-177 behavior); the cold-start
  // neutral seed is never silently injected into a room that declared no role.
  const investment_level = hasIgnitePrior(effectiveRoomState)
    ? Math.max(computedLevel, igniteDialSeed(effectiveRoomState))
    : computedLevel;

  const reg = _loadRegistry();
  const commands = Array.isArray(reg.commands) ? reg.commands : [];
  const scored = [];

  for (const cmd of commands) {
    if (!cmd || typeof cmd.command !== 'string') continue;

    // D6 fail-closed: jtbd_summary required.
    const jtbd_summary = (typeof cmd.jtbd_summary === 'string' && cmd.jtbd_summary.length > 0)
      ? cmd.jtbd_summary : null;
    if (jtbd_summary === null) continue;

    // D11 fail-closed: teaching required.
    const teaching = (typeof cmd.teaching === 'string' && cmd.teaching.length > 0)
      ? cmd.teaching : null;
    if (teaching === null) continue;

    const jtbd_label = (typeof cmd.jtbd_label === 'string') ? cmd.jtbd_label : '';
    const framework = (Array.isArray(cmd.frameworks) && cmd.frameworks.length > 0)
      ? cmd.frameworks[0] : DEFAULT_SEED;

    const baseScore = _scoreCommand({
      cmd, packetOptional, roomState: effectiveRoomState, investment_level,
    });
    const adjustedScore = _applyDecay(
      applyDecayWeight, baseScore, cmd.command, effectiveRoomState,
    );

    const why = selectWhyContent(jtbd_summary, teaching, investment_level);
    const source = _sourceFor(packetOptional, cmd);

    // Phase 121.5-10 Sub-plan K: optional category + graph_relationship
    // fields for the locked Brain-suggestion template meta row (audit
    // Section 5.2.1 Row 2). Non-breaking -- consumers that ignore them get
    // the same shape they had before; consumers wiring the locked template
    // (suggest-next, act --chain) read them to compose optionRows[].meta.
    const category = _categoryFromPacket(packetOptional, cmd);
    const graph_relationship = _graphRelationshipFromPacket(packetOptional, framework);

    scored.push({
      command: cmd.command,
      jtbd_label,
      jtbd_summary,
      teaching,
      framework,
      score: Math.max(0, Math.min(1, adjustedScore)),
      why,
      source,
      investment_level,
      category,
      graph_relationship,
    });
  }

  // Sort score desc. Stable on ties.
  scored.sort((a, b) => b.score - a.score);

  // Tier 0 cold-start fallback: when zero eligible commands but k > 0, the
  // ranker degrades gracefully to []. The HARD PRECONDITION (Phase 104.1
  // shipped) makes this branch effectively unreachable in production --
  // every command has the required content. Kept for future-proofing
  // against registry regressions.
  if (scored.length === 0) return [];

  // Reference focusNodeId so static linters don't flag it as unused. It is
  // part of the LOCKED signature for downstream tuning (Phase 117 may pass
  // it through for hop-depth selection).
  if (focusNodeId) { /* reserved for future hop-relative scoring */ }

  // Phase 205-05 (item 5): resolve role_level once for the dial-default bias.
  // null when no signal (cold start) -> the bias is a no-op below.
  const role_level = _resolveRoleLevel(o, effectiveRoomState);

  // Phase 244 (TRIG-02): fuse cross-family tier candidates against the FULL
  // pre-slice `scored` list, BEFORE the sens10/slice cut. Fusing after the
  // slice could never promote a cross-family hit the D4 score buried past
  // position k. Absent/empty tierCandidates => fused is scored BY REFERENCE
  // (byte-identical no-op), so the sens10-or-slice branch below lands on
  // scored.slice(0, k) exactly as it did pre-244.
  const fused = _applyTierFusion(scored, tierCandidates, k);

  // Phase 205-03: the SENS-10 anti-circular flip. Runs ONLY when the sensor
  // fired this turn; otherwise the base slice below is byte-identical to pre-205.
  // Phase 205-05: the role_level bias is layered ON TOP of whichever list wins
  // (it does not undo the 205-03 flip; it only stamps the elevation lean).
  const finalList = (sens10 && sens10.fired === true)
    ? _applySens10Flip(fused, sens10, k)
    : fused.slice(0, k);

  return _applyRoleLevelBias(finalList, role_level);
}

module.exports = {
  rankForSelector,
  selectWhyContent,
  renderInvestmentBadge,
  renderSliceBadge,
  renderNoneFitAffordance,
  // Phase 121.5-10 Sub-plan K: MAX_K constant exported so consumers wiring
  // the locked Brain-suggestion template know the row-budget cap (audit
  // Section 5.2.3 anti-pattern enforcement).
  MAX_K,
  // Phase 177-01 (BCH-05/06): the behavioral-channel thresholds. Exported so the
  // test and later-wave seams read the engine-owned numbers; they appear in NO
  // prompt. CEILING is computed from the Brain floor (>= 15 points above).
  BEHAVIORAL_CHANNEL_FLOOR,
  BEHAVIORAL_CHANNEL_CEILING,
  BEHAVIORAL_CHANNEL_MARGIN,
  // Phase 177-01 (BCH-17): the deterministic ignite-persona dial seed + its
  // prior predicate. Exported so the test (and the later-wave Pass-2 prose
  // injection) read the engine-owned seed. The model emits no dial.
  igniteDialSeed,
  hasIgnitePrior,
  // Phase 205-05 (item 5): the role_level dial-default + elevation-emphasis bias
  // (no quotas). Exported so consumers + the test read the engine-owned bias.
  _resolveRoleLevel,
  _applyRoleLevelBias,
  // Phase 244 (TRIG-02): the optional cross-family rank-fusion pass + its
  // dedicated k. Exported (not _test-only, mirroring _applyRoleLevelBias
  // above) so consumers and tests read the engine-owned values directly.
  _applyTierFusion,
  TRIG_RRF_K,
  // Test seam (private; consumed only by lib/memory/f-selector-ranker.test.cjs).
  _test: {
    _resetCaches,
    _setRegistry,
    _setTaxonomy,
    _scoreCommand,
    _brainConfidenceFromPacket,
    _resolveJtbdForCommand,
    _sourceFor,
    _applyDecay,
    _recencyDecay,
    _problemTypeBind,
    _categoryFromPacket,
    _graphRelationshipFromPacket,
    // Phase 205-03: the SENS-10 anti-circular flip (clarify-vs-reframe).
    _applySens10Flip,
    SENS10_DEFAULT_REFRAME_COMMAND,
    SENS10_REFRAME_FRAMEWORK,
    DEFAULT_SEED,
    MAX_K,
    // Phase 177-01 (BCH-17) ignite-persona seed internals.
    _topRoleFromBlend,
    _normalizeRoleKey,
    igniteDialSeed,
    hasIgnitePrior,
    IGNITE_SEED_ASK,
    IGNITE_SEED_NEUTRAL,
    IGNITE_SEED_TELL,
    BEHAVIORAL_CHANNEL_FLOOR,
    BEHAVIORAL_CHANNEL_CEILING,
  },
};
