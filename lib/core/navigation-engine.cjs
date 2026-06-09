#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 91-00 -- Navigation Engine core (L5 Decision layer)
 * ==========================================================
 * Single export `decide(turn, context) -> decision` composes the five
 * input signals (ICM scope + SQL relations + Feynman-MINTO reasoning +
 * BRAIN.md derivations + intent/persona) through a structured decision
 * function (NOT a weighted score per locked decision D-02) and returns
 * a typed decision struct with full trace.
 *
 * Contract source of truth:
 *   .planning/research/navigation-engine-brain-interface.md (v1, frozen
 *   at Phase 90-09).
 *
 * Canon Part 8 posture (READ THIS FIRST):
 *   This module is a PURE LOCAL READER. It NEVER queries Brain. It
 *   NEVER reads BRAIN.md directly via fs.readFileSync; the only allowed
 *   read path is folder-memory.cjs readQuadruple. It NEVER constructs
 *   Cypher queries. It NEVER embeds BRAIN.md body strings in network
 *   payloads. The two PERMITTED brain-client touches are
 *   brain-client.isAvailable() (boolean, no network when cached) and
 *   brain-client.schema() (scalar, no user content leaves the local
 *   process). Both are optional; the engine works fully offline.
 *
 * Per Section 2.4: a single readQuadruple result MAY be cached for the
 * duration of one decide() call. Cross-call caching is FORBIDDEN.
 *
 * Per locked decision D-02: this engine is NOT a weighted score across
 * the five signals. Brain's section weights (0.35 + 0.20 + 0.15 + ...)
 * stay INSIDE the BRAIN.md contribution block; the staleness multiplier
 * scales that block as a whole. Inter-signal composition is rule-based
 * with explicit precedence, not arithmetic.
 *
 * License: BSL 1.1.
 */

const shared = require('./navigation-engine-shared.cjs');
const folderMemory = require('./folder-memory.cjs'); // for readQuadruple
// CASC-02 (Phase 142): the navigation.cjs chokepoint is the ONLY allowed local
// graph read path (Canon Part 9: SQL is the local mind). decide() reads the
// navigated neighborhood (getRoomContext's Leg C, getNeighborhood-ranked) that the
// caller threaded onto context.roomContext through this same chokepoint. We require
// it here as the Part-8 wiring anchor; the caller owns the db handle, so this module
// never opens room.db and adds ZERO new Brain egress surface (the neighborhood rides
// in via context as scalars/slugs/scores only).
const navigation = require('./navigation.cjs'); // chokepoint anchor (Part 9)
// Phase 144 (NAV-01): the Phase 143 sensor spine. decide() CONSUMES the
// candidate reaches dispatchSensors PRODUCES; a fired reach maps to a CANONICAL
// VERB so the router (READ-ONLY for 144) flips routing_source legacy -> engine as
// a pure consequence (its Precedence Rule 1: validateVerb===true). dispatchSensors
// is pure / sync / LOCAL-first (no Brain, no network), so this require adds ZERO
// Brain egress surface. We never edit the sensor module (Phase 143 fence).
const { dispatchSensors } = require('./insight-sensors.cjs');
// brain-client is OPTIONAL: required only if downstream callers want to
// pass an explicit brainAvailable hint, but isAvailable() is also fine
// from the call site. We do NOT require() it here to keep the dependency
// graph minimal and to make grep-guards trivially passable.

const STALENESS_MULTIPLIERS = shared.STALENESS_MULTIPLIERS;
const SECTION_WEIGHTS = shared.SECTION_WEIGHTS;
const REQUIRED_SECTION_KEYS = shared.REQUIRED_SECTION_KEYS;
const OPTIONAL_SECTION_KEYS = shared.OPTIONAL_SECTION_KEYS;
const CANONICAL_VERBS = shared.CANONICAL_VERBS;

// Wicked-score escalation threshold per Canon Appendix E rule R4.
const WICKED_ESCALATION_THRESHOLD = 8;

// Confidence floor for Section 6 RECOMMENDED gate.
const RECOMMENDED_CONFIDENCE_FLOOR = 0.7;

// ---------- Pattern parsers (tolerant; never throw) ----------

/**
 * Parse pattern_matches body for `confidence: <float>` candidates.
 * Returns the highest confidence found in [0, 1], or null when no
 * candidate is parseable. Tolerant of body whitespace, multi-line, and
 * forward-compat extra fields.
 */
function extractHighestConfidence(body) {
  if (typeof body !== 'string' || body.length === 0) return null;
  const re = /confidence\s*:\s*([01](?:\.\d+)?|0?\.\d+)/gi;
  let best = null;
  let m;
  while ((m = re.exec(body)) !== null) {
    const v = parseFloat(m[1]);
    if (!isNaN(v) && v >= 0.0 && v <= 1.0) {
      if (best === null || v > best) best = v;
    }
  }
  return best;
}

/**
 * Extract the verb associated with the highest-confidence candidate in
 * pattern_matches. Returns null when no candidate is parseable. Verbs
 * MUST appear before the `(confidence: ...)` parenthetical, matching
 * Canon Part 3 vocabulary.
 *
 * Body shape (per Plan 90-01 deriveSection emit):
 *   - Run Methodology (confidence: 0.85, source: SWOT)
 *   - Reformulate (confidence: 0.72, source: 5 Whys)
 */
function extractTopCandidateVerb(body) {
  if (typeof body !== 'string' || body.length === 0) return null;
  const lines = body.split(/\r?\n/);
  let bestConf = -1;
  let bestVerb = null;
  for (const line of lines) {
    // Match `<prefix> <verb> (confidence: 0.NN ...)`
    const m = /^[\s\-*]*(.+?)\s*\(\s*confidence\s*:\s*([01](?:\.\d+)?|0?\.\d+)/i.exec(line);
    if (!m) continue;
    const verb = m[1].trim();
    const conf = parseFloat(m[2]);
    if (isNaN(conf)) continue;
    // Resolve verb against canonical vocabulary (case-insensitive
    // contains-match; closed set).
    let resolved = null;
    for (const v of CANONICAL_VERBS) {
      if (verb.toLowerCase() === v.toLowerCase()) {
        resolved = v;
        break;
      }
    }
    if (resolved !== null && conf > bestConf) {
      bestConf = conf;
      bestVerb = resolved;
    }
  }
  return bestVerb;
}

/**
 * Parse wicked_indicators body for `wicked_score: <int>`. Returns 0 when
 * no score is parseable.
 */
function extractWickedScore(body) {
  if (typeof body !== 'string' || body.length === 0) return 0;
  const m = /wicked_score\s*:\s*(\d+)/i.exec(body);
  if (!m) return 0;
  const v = parseInt(m[1], 10);
  if (isNaN(v) || v < 0) return 0;
  return v;
}

// ---------- Trace builders ----------

function buildIcmScope(quadruple, turn) {
  const room = quadruple && quadruple.room;
  return {
    section_path: turn && turn.sectionPath ? turn.sectionPath : null,
    room_exists: room && room.exists ? true : false,
    artifact_count: quadruple && quadruple.state ? (quadruple.state.artifact_count || 0) : 0,
  };
}

function buildSqlSignals(_quadruple, _turn) {
  // Phase 91-00 ships the engine surface; the SQL signal is consumed
  // from a future plan that wires room.db edge counts. For this plan
  // the slot is structural (so /mos:explain-decision can render it) but
  // contributes no rules. Returning an object (not null) keeps the
  // five-signal capture invariant met (Test 20).
  return { edges_consulted: 0, contradictions_detected: 0 };
}

function buildMintoReasoning(quadruple) {
  const r = quadruple && quadruple.reasoning;
  if (!r) {
    return { exists: false, reasoning_health_score: 0, governing_thought: null, is_stale: true };
  }
  return {
    exists: r.exists === true,
    reasoning_health_score:
      typeof r.reasoning_health_score === 'number' ? r.reasoning_health_score : 0,
    governing_thought: typeof r.governing_thought === 'string' ? r.governing_thought : null,
    is_stale: r.is_stale === true,
  };
}

function buildIntentPersona(context) {
  const persona = context && context.userPersona ? context.userPersona : null;
  const intent = context && context.intentSignal ? context.intentSignal : null;
  return {
    archetype: persona && persona.archetype ? persona.archetype : null,
    problem_type: persona && persona.problem_type ? persona.problem_type : null,
    venture_stage: persona && persona.venture_stage ? persona.venture_stage : null,
    intent: intent && intent.intent ? intent.intent : null,
    intent_confidence: intent && typeof intent.confidence === 'number' ? intent.confidence : null,
  };
}

// ---------- CASC-02: navigated-neighborhood trace builder ----------

/**
 * buildNavigatedNeighborhood(roomContext) -> { ranked: [...] } | null
 *
 * CASC-02 (Phase 142): reflect the getNeighborhood-ranked Leg C of a getRoomContext
 * fusion (threaded onto context.roomContext by the caller through the navigation.cjs
 * chokepoint) into the decision trace. This is what makes the Phase 109 spine
 * NAVIGATE: routing reflects the ranked graph neighborhood, not merely stored-edge
 * presence.
 *
 * Canon Part 8 (HARD): the projection carries SCALARS / SLUGS / SCORES ONLY -- node
 * id, type, incoming edge type, depth, and ranking score. It NEVER copies a node's
 * raw body / prose / properties. The neighborhood is a LOCAL routing signal; it never
 * rides toward the Brain.
 *
 * Defensive: a null / malformed / Promise / empty roomContext returns null so decide()
 * falls through to the legacy behavior with the trace field at its safe default. Never
 * throws. A thenable (un-awaited getRoomContext Promise) has no synchronous
 * relevantNodes, so it degrades to null -- the caller is expected to await and pass the
 * RESOLVED fusion object (the Task-1 contract).
 */
function buildNavigatedNeighborhood(roomContext) {
  if (!roomContext || typeof roomContext !== 'object') return null;
  // A bare Promise / thenable cannot be read synchronously here; degrade to null.
  if (typeof roomContext.then === 'function' && !Array.isArray(roomContext.relevantNodes)) {
    return null;
  }
  const nodes = roomContext.relevantNodes;
  if (!Array.isArray(nodes) || nodes.length === 0) return null;

  const ranked = [];
  for (const n of nodes) {
    if (!n || typeof n !== 'object') continue;
    // Scalars / slugs / scores ONLY (Part 8). No properties, no claim/summary prose.
    ranked.push({
      id: typeof n.id === 'string' ? n.id : null,
      type: typeof n.type === 'string' ? n.type : null,
      edgeTypeIn: typeof n.edgeTypeIn === 'string' ? n.edgeTypeIn : null,
      depth: typeof n.depth === 'number' ? n.depth : null,
      score: typeof n.score === 'number' ? n.score : null,
    });
  }
  if (ranked.length === 0) return null;

  const seedNodeId = roomContext._meta && typeof roomContext._meta.seedNodeId === 'string'
    ? roomContext._meta.seedNodeId
    : null;

  return {
    ranked: ranked,
    count: ranked.length,
    seed_node_id: seedNodeId,
    // top_node_id is the highest-ranked neighbor slug -- a scalar routing handle.
    top_node_id: ranked[0].id,
  };
}

// ---------- Phase 144 Task 2: Zep-shaped LOCAL trace.context_assembly ----------

/**
 * buildContextAssembly(navigatedNeighborhood, sensorReaches, decisionGrounding)
 *   -> { user_summary, facts, decision_grounding }
 *
 * Phase 144 (Task 2): adopt Zep's Smart-Context-Assembly OUTPUT SHAPE inside the
 * decision TRACE ONLY. Every byte is LOCAL trace JSON; NOTHING reaches the Brain.
 *
 *   user_summary  top-3 navigatedNeighborhood node SCALARS (id / type / score)
 *                 each carrying LOCAL temporal scalars { first_seen, last_updated }
 *                 read ONLY from the neighborhood scalars (null when the source
 *                 did not supply them -- never a fabricated value).
 *   facts         the fired sensor reach_ids + evidence SCALARS
 *                 (counts / enums / phase ids only -- makeReach already froze
 *                 evidence to a flat primitive bag), each with the same LOCAL
 *                 temporal scalars (null when the reach did not supply them).
 *   decision_grounding  which fact (reach_id | 'brain_verb' | 'wicked' |
 *                 'neighborhood' | null) justified the chosen fire_skill.
 *
 * Part 8 (HARD): user_summary + facts carry SCALARS / SLUGS / ENUMS only. No
 * node body, no reach.signal user value, no reach.dispatch beyond the handle, no
 * prose. This mirrors buildNavigatedNeighborhood's projection discipline.
 */
function buildContextAssembly(navigatedNeighborhood, sensorReaches, decisionGrounding) {
  const userSummary = [];
  if (navigatedNeighborhood && Array.isArray(navigatedNeighborhood.ranked)) {
    const top = navigatedNeighborhood.ranked.slice(0, 3);
    for (const n of top) {
      if (!n || typeof n !== 'object') continue;
      userSummary.push({
        id: typeof n.id === 'string' ? n.id : null,
        type: typeof n.type === 'string' ? n.type : null,
        score: typeof n.score === 'number' ? n.score : null,
        // LOCAL temporal scalars read ONLY from the neighborhood scalars; null
        // when the source did not supply them (never fabricated).
        first_seen: typeof n.first_seen === 'number' || typeof n.first_seen === 'string' ? n.first_seen : null,
        last_updated: typeof n.last_updated === 'number' || typeof n.last_updated === 'string' ? n.last_updated : null,
      });
    }
  }

  const facts = [];
  if (Array.isArray(sensorReaches)) {
    for (const r of sensorReaches) {
      if (!r || typeof r !== 'object') continue;
      const ev = (r.evidence && typeof r.evidence === 'object') ? r.evidence : {};
      // evidence is already a frozen flat scalar bag (makeReach guarantees it).
      facts.push({
        reach_id: typeof r.reach_id === 'string' ? r.reach_id : null,
        posture: typeof r.posture === 'string' ? r.posture : null,
        evidence: ev,
        // LOCAL temporal scalars sourced ONLY from the reach evidence scalars;
        // null when the reach did not supply them (never fabricated).
        first_seen: typeof ev.first_seen === 'number' || typeof ev.first_seen === 'string' ? ev.first_seen : null,
        last_updated: typeof ev.last_updated === 'number' || typeof ev.last_updated === 'string' ? ev.last_updated : null,
      });
    }
  }

  return {
    user_summary: userSummary,
    facts: facts,
    decision_grounding: decisionGrounding !== undefined ? decisionGrounding : null,
  };
}

/**
 * groundingForFireSkill(fireSkill, sensorReaches, brain, navigatedNeighborhood)
 *   -> reach_id | 'wicked' | 'brain_verb' | 'neighborhood' | null
 *
 * Phase 144 (Task 2): name which LOCAL fact justified the chosen fire_skill, for
 * trace.context_assembly.decision_grounding. Mirrors the resolveFireSkill
 * precedence order (wicked > sensor reach > brain verb > fallback). Pure scalar
 * reasoning; reads no prose.
 */
function groundingForFireSkill(fireSkill, sensorReaches, brain, navigatedNeighborhood) {
  if (fireSkill === null || fireSkill === undefined) return null;
  // Wicked soft-systems return is the only family-slug the sensor/verb paths
  // never produce, so a 'soft-systems' fire_skill is grounded in wicked.
  if (fireSkill === 'soft-systems') return 'wicked';
  // A fired sensor reach grounds the canonical-verb fire_skill: the top reach
  // (canonical REACH_IDS order) drove it per resolveFireSkill step (2).
  if (Array.isArray(sensorReaches) && sensorReaches.length > 0) {
    const top = sensorReaches[0];
    if (top && typeof top === 'object' && reachIdToSkillFamily(top.reach_id) === fireSkill) {
      return typeof top.reach_id === 'string' ? top.reach_id : null;
    }
  }
  // Otherwise the BRAIN.md pattern_matches / context-engine path set it.
  if (brain && brain.sections) return 'brain_verb';
  // Last resort: a neighborhood-only contribution.
  if (navigatedNeighborhood !== null) return 'neighborhood';
  return null;
}

// ---------- Section consumption ----------

function consumedSections(brain) {
  if (!brain || typeof brain !== 'object' || !brain.sections) return [];
  const out = [];
  // Required first (canonical order), then optional.
  for (const k of REQUIRED_SECTION_KEYS) {
    const v = brain.sections[k];
    if (v !== null && v !== undefined && typeof v === 'object' && typeof v.body === 'string' && v.body.length > 0 && !/^\s*\(no signal\)\s*$/i.test(v.body)) {
      out.push(k);
    }
  }
  for (const k of OPTIONAL_SECTION_KEYS) {
    const v = brain.sections[k];
    if (v !== null && v !== undefined && typeof v === 'object' && typeof v.body === 'string' && v.body.length > 0 && !/^\s*\(no signal\)\s*$/i.test(v.body)) {
      out.push(k);
    }
  }
  return out;
}

// ---------- Five-signal composition (rule-based per D-02) ----------

/**
 * reachIdToSkillFamily(reachId) -> canonical-verb | null
 *
 * Phase 144 (NAV-01): map the 5 FROZEN reach_ids
 * (lib/core/sensors/sensor-types.cjs REACH_IDS) to one of the closed 10
 * CANONICAL_VERBS. This is the keystone of the legacy -> engine flip: the router
 * (lib/core/skill-activation-router.cjs::validateVerb) validates fire_skill
 * against CANONICAL_VERBS, NOT against skill-family slugs. So a sensor reach must
 * resolve to a CANONICAL VERB for the router's Precedence Rule 1
 * (validateVerb===true) to flip routing_source to engine. (Mirrors the
 * verbToSkillFamily switch shape; the table is closed -- a non-member key returns
 * null and the engine never invents a reach.)
 *
 *   context_block   -> 'Run Methodology'
 *   contradiction   -> "Devil's Advocate"
 *   cross_room      -> 'Navigate Graph'
 *   brain_consult   -> 'Run Methodology'
 *   deep_research   -> 'Spawn Sub-Agent'
 */
function reachIdToSkillFamily(reachId) {
  switch (reachId) {
    case 'context_block': return 'Run Methodology';
    case 'contradiction': return "Devil's Advocate";
    case 'cross_room': return 'Navigate Graph';
    case 'brain_consult': return 'Run Methodology';
    case 'deep_research': return 'Spawn Sub-Agent';
    default: return null;
  }
}

/**
 * Resolve the best fire_skill given Brain signal state, the wicked escalation
 * rule, and the Phase 143 sensor candidate reaches.
 *
 * Multi-signal precedence (Phase 144 -- the core design decision, documented):
 *
 *   1. wicked_escalation   wicked_score >= WICKED_ESCALATION_THRESHOLD (8)
 *                          returns the soft-systems family FIRST (Canon
 *                          Appendix E rule R4). Outranks everything.
 *   2. sensor reach        the TOP reach by canonical REACH_IDS order maps via
 *                          reachIdToSkillFamily to a CANONICAL VERB and fires in
 *                          ANY TIER (tier_0 / mode_b included). This is the
 *                          legacy -> engine flip: a non-null canonical verb makes
 *                          the router validate true. NOT gated on mode_a.
 *   3. BRAIN.md verb       the existing mode_a pattern_matches top verb path
 *                          (unchanged; family-slug return, pre-144 behavior).
 *   4. weightApplied>=0.9  the existing context-engine fresh-Brain fallback
 *                          (unchanged).
 *
 * The sensor branch runs BEFORE the mode_a BRAIN gate so sensors fire even in
 * tier_0/mode_b (the legacy-on-every-turn behavior is gone when a reach fires).
 * dispatchSensors returning [] (or throwing -> caught upstream -> []) degrades
 * resolveFireSkill EXACTLY to the pre-144 engine: no sensor contribution.
 *
 * Returns null when no signal warrants firing.
 */
function resolveFireSkill(brain, weightApplied, tierMode, sensorReaches) {
  // (1) Wicked escalation takes precedence over normal routing (Canon
  // Appendix E rule R4) -- it even outranks a fired sensor reach.
  const wickedSection = brain && brain.sections && brain.sections.wicked_indicators;
  if (wickedSection && wickedSection.body) {
    const score = extractWickedScore(wickedSection.body);
    if (score >= WICKED_ESCALATION_THRESHOLD) {
      return 'soft-systems';
    }
  }

  // (2) Sensor reach -> canonical verb (ANY tier). The top reach is already in
  // canonical REACH_IDS order: dispatchSensors iterates SENSOR_REGISTRY in
  // canonical order and the registry mirrors REACH_IDS, so sensorReaches[0] is
  // the top reach by the documented tie-break. Map it to a canonical verb; a
  // non-mapping reach falls through to the BRAIN path.
  if (Array.isArray(sensorReaches) && sensorReaches.length > 0) {
    const top = sensorReaches[0];
    if (top && typeof top === 'object') {
      const verb = reachIdToSkillFamily(top.reach_id);
      if (verb !== null) {
        return verb;
      }
    }
  }

  // (3) Mode A + non-zero weight + parseable verb -> fire that verb's skill.
  if (tierMode === 'mode_a' && weightApplied > 0) {
    const pm = brain && brain.sections && brain.sections.pattern_matches;
    if (pm && pm.body) {
      const verb = extractTopCandidateVerb(pm.body);
      if (verb !== null) {
        // Map canonical verb to skill family. v1 ships a minimal mapping
        // sufficient to satisfy "fire_skill non-null when fresh" (Test 20).
        return verbToSkillFamily(verb);
      }
    }
    // (4) Fresh Brain but no pattern_matches verb: fall back to context
    // skill so Test 20 still has a non-null fire_skill.
    if (weightApplied >= 0.9) {
      return 'context-engine';
    }
  }
  return null;
}

function verbToSkillFamily(verb) {
  // Closed mapping. Future plans can extend the table; the engine
  // never invents skill names from prose.
  switch (verb) {
    case 'Run Methodology': return 'methodology-router';
    case 'Reformulate': return 'beautiful-question';
    case 'Spawn Sub-Agent': return 'subagent-dispatcher';
    case 'Navigate Graph': return 'graph-navigator';
    case "Devil's Advocate": return 'red-team';
    case 'Scenario Plan': return 'scenario-planner';
    case 'Synthesize': return 'blue-hat';
    case 'Bank Opportunity': return 'opportunity-bank';
    case 'Defer': return 'defer';
    case 'Free-Text': return 'larry-default';
    default: return null;
  }
}

/**
 * Compose suppress_skills based on intent and persona signals. v1
 * ships an empty array; future plans will populate from intent
 * heuristics. Returning [] keeps Test 31 honoring the array invariant.
 */
function resolveSuppressSkills(_context, _brain) {
  return [];
}

/**
 * persona_updates: returns null when no threshold crossed; otherwise an
 * object with allowed keys archetype/problem_type/venture_stage.
 *
 * v1 ships null (no auto-update). Plan 91-01 owns the durability layer.
 */
function resolvePersonaUpdates(_context, _brain) {
  return null;
}

/**
 * offer_next_step: returns null OR a six-key offer
 * { command, framework, jtbd, confidence, reason, scope }. Max 1 per turn
 * is enforced trivially (we never return more than one).
 *
 * v1 behavior is now LIVE (Phase 135): delegates to the abstention-gated
 * resolver in lib/core/navigation-engine-offer.cjs, which returns exactly one
 * calibrated offer or null computed from real local memory (operator-state x
 * confidence-margin x rejection-backoff, plus SC2 graph neighborhood / SC4
 * FEYNMAN temporal + MINTO governing thought + active JTBD). The resolver is
 * LOCAL-ONLY and SYNCHRONOUS (A3): no awaited Brain packet here; _brain stays
 * unused. Wrapped in try/catch so the engine never throws and the
 * framework-chain-composer fallback (which fires only when offer_next_step is
 * null) still applies on any failure.
 */
function resolveOfferNextStep(context, _brain) {
  try {
    const offerHelper = require('./navigation-engine-offer.cjs');
    return offerHelper.resolveOffer(context);
  } catch (_e) {
    return null;
  }
}

/**
 * Phase 148-05 Task 1 (IRW-05): render the offer-resolver output through the ONE
 * F.1 host. The offer is computed by resolveOfferNextStep (the calibration that
 * stays untouched); the RENDER door is selector-dispatcher.pickShape via
 * navigation-engine-offer.renderOfferThroughHost -- the IDENTICAL host the
 * suggest-next surface uses. There is no second bespoke renderer on the engine
 * side; both surfaces converge on pickShape. Never throws.
 */
function renderOfferNextStep(context, _brain) {
  try {
    const offerHelper = require('./navigation-engine-offer.cjs');
    const offer = resolveOfferNextStep(context, _brain);
    return offerHelper.renderOfferThroughHost(offer, context);
  } catch (_e) {
    return { shape: 'error', rendered: { error: 'render_offer_next_step_failed' } };
  }
}

/**
 * Phase 148-05 Task 1 (IRW-05): the suggest-next surface, unified onto the SAME
 * F.1 host as the offer-resolver. Delegates to
 * navigation-engine-offer.suggestNext so suggest-next and offer-resolver share
 * one ranking and one render path (no divergent renderer). Never throws.
 */
function suggestNext(context, _brain) {
  try {
    const offerHelper = require('./navigation-engine-offer.cjs');
    return offerHelper.suggestNext(context);
  } catch (_e) {
    return { shape: 'error', rendered: { error: 'suggest_next_failed' } };
  }
}

// ---------- decide() main entry ----------

/**
 * decide(turn, context) -> decision
 *
 * Inputs:
 *   turn = { userText, sectionPath, sessionId }
 *   context = {
 *     quadruple,        // pre-read quadruple (caller responsibility)
 *     brainAvailable,   // boolean from brain-client.isAvailable()
 *     userPersona,      // { archetype, problem_type, venture_stage }
 *     intentSignal      // { intent, confidence }
 *   }
 *
 * Returns: typed decision struct with complete trace.
 *
 * Never throws. Every internal failure falls through to a safe
 * emptyDecision() with chosen_rationale noting the fault.
 *
 * Per-turn cache: a single quadruple lookup may be cached within this
 * call only. This implementation expects context.quadruple to be
 * pre-read (the standard Phase 91-02 hook integration pattern), so the
 * cache is implicit. If context.quadruple is absent, decide() falls
 * back to readQuadruple(turn.sectionPath) once and caches the result
 * for the duration of THIS call only. Cross-call caching FORBIDDEN per
 * Section 2.4.
 */
function decide(turn, context) {
  // Phase 144 (Task 2): LOCAL monotonic clock for the decide()-body latency
  // budget telemetry. Date.now() is LOCAL and never transmitted; the resulting
  // _meta.latencies_ms is LOCAL trace JSON only (guards the 1200ms NAV budget).
  const decideStartMs = Date.now();

  // Safe defaults.
  const ctx = context || {};
  const t = turn || {};
  const decision = shared.emptyDecision();
  const trace = decision.decision_trace;

  // Phase 144 (NAV-01): consume the Phase 143 sensors ONCE, before any return
  // path, so EVERY decision (tier_0 / legacy / mode_a) sees the same candidate
  // reaches and the legacy-on-every-turn behavior is gone when a reach fires.
  // tuple = the /mos:diagnose classification { problem_type, complexity, stage }
  // read from context (defaulting to {} per field when absent). ctx handles are
  // LOCAL ({ roomDir, lowFillSections }). dispatchSensors is pure / sync /
  // LOCAL-first; wrapped in try/catch so a sensor fault degrades to [] and
  // resolveFireSkill behaves exactly like the pre-144 engine. Never throws.
  const sensorTuple = {
    problem_type: ctx.problem_type !== undefined ? ctx.problem_type : undefined,
    complexity: ctx.complexity !== undefined ? ctx.complexity : undefined,
    stage: ctx.stage !== undefined ? ctx.stage : undefined,
  };
  const sensorCtx = {
    roomDir: typeof ctx.roomDir === 'string' ? ctx.roomDir : null,
    lowFillSections: Array.isArray(ctx.lowFillSections) ? ctx.lowFillSections : null,
  };
  let sensorReaches = [];
  let dispatchSensorsMs = 0;
  {
    const dispatchStartMs = Date.now();
    try {
      const reaches = dispatchSensors(t, sensorTuple, sensorCtx);
      sensorReaches = Array.isArray(reaches) ? reaches : [];
    } catch (_e) {
      sensorReaches = []; // soft-fail: degrade to pre-144 behavior
    }
    dispatchSensorsMs = Date.now() - dispatchStartMs;
  }

  // CASC-02 (Phase 142): reflect the navigated neighborhood (getRoomContext Leg C,
  // getNeighborhood-ranked) the caller threaded onto context.roomContext through the
  // navigation.cjs chokepoint. Computed once, before any return path, so EVERY
  // decision (Tier 0 / legacy / mode_a) carries it when present and the safe-default
  // null when absent. Scalars/slugs/scores only (Part 8). Never throws.
  let navigatedNeighborhood = null;
  try {
    navigatedNeighborhood = buildNavigatedNeighborhood(ctx.roomContext);
  } catch (_e) {
    navigatedNeighborhood = null;
  }
  // Reference the chokepoint export so the Part-8 anchor require is load-bearing
  // (the navigated neighborhood ARRIVES through navigation.cjs's getRoomContext leg).
  void navigation.getRoomContext;

  try {
    // Per-turn cache scope: read quadruple if not provided. The local
    // `quadruple` binding is the cache; it never escapes this function.
    let quadruple = ctx.quadruple;
    if (!quadruple) {
      const sectionPath = t.sectionPath;
      if (typeof sectionPath === 'string' && sectionPath.length > 0) {
        quadruple = folderMemory.readQuadruple(sectionPath);
      }
    }

    // If we still have no quadruple, return empty decision in tier_0.
    if (!quadruple) {
      trace.brain_md_tier_mode = 'tier_0';
      trace.brain_md_staleness = 'absent';
      trace.brain_md_weight_applied = 0.0;
      trace.icm_scope = buildIcmScope(null, t);
      trace.sql_signals = buildSqlSignals(null, t);
      trace.minto_reasoning = buildMintoReasoning(null);
      trace.intent_persona = buildIntentPersona(ctx);
      trace.navigated_neighborhood = navigatedNeighborhood;
      trace.chosen_rationale = 'Tier 0 fallback: no quadruple available for sectionPath.';
      if (navigatedNeighborhood !== null) {
        trace.chosen_rationale +=
          ' Routing reflected the navigated neighborhood (' +
          navigatedNeighborhood.count + ' ranked neighbor' +
          (navigatedNeighborhood.count === 1 ? '' : 's') + ', top ' +
          navigatedNeighborhood.top_node_id + ').';
      }

      // Phase 144 (NAV-01): sensors fire in ANY tier -- including this tier_0
      // early-return path. A fired reach -> a CANONICAL VERB so the router flips
      // routing_source to engine even with no quadruple.
      decision.fire_skill = resolveFireSkill(null, 0.0, 'tier_0', sensorReaches);
      if (sensorReaches.length > 0) {
        const top = sensorReaches[0];
        if (top && typeof top === 'object' && reachIdToSkillFamily(top.reach_id) !== null) {
          // Part 8: name reach_id + posture ONLY. Never reach.signal's
          // user-derived value, evidence bodies, or the dispatch handle.
          trace.chosen_rationale +=
            ' Sensor reach fired: ' + top.reach_id + '/' + top.posture + '.';
        }
      }

      // Phase 144 (Task 2): LOCAL trace.context_assembly + latency telemetry on
      // the tier_0 early-return path too (both return paths carry the shape).
      trace.context_assembly = buildContextAssembly(
        navigatedNeighborhood,
        sensorReaches,
        groundingForFireSkill(decision.fire_skill, sensorReaches, null, navigatedNeighborhood)
      );
      trace._meta = {
        latencies_ms: {
          dispatchSensors_ms: dispatchSensorsMs,
          decide_total_ms: Date.now() - decideStartMs,
        },
      };
      return decision;
    }

    const brainAvailable = ctx.brainAvailable === true;
    const brain = quadruple.brain || null;

    // Section 5 tier-mode resolver (re-evaluated every turn; no cache).
    const tierMode = shared.resolveTierMode(quadruple, brainAvailable);
    trace.brain_md_tier_mode = tierMode;

    // Section 4 staleness multiplier (BRAIN.md contribution scaler).
    // The result is later assigned to trace.brain_md_weight_applied per
    // Section 8.1. Multiplier source rows:
    //   null brain                                -> 0.0
    //   staleness:fresh                           -> 1.0
    //   stale_reason:brain_offline                -> 0.9 (EXEMPT)
    //   stale_reason:age_exceeded                 -> 0.7
    //   stale_reason:brain_graph_version_mismatch -> 0.5
    //   stale_reason:governing_thought_changed    -> 0.3
    //   stale_reason:derivation_timeout           -> 0.2
    //   stale_reason:parse_failed                 -> 0.0
    //   staleness:unavailable                     -> 0.0
    let weightApplied = shared.applyStalenessMultiplier(brain);

    // Section 3.1 attribution guard. brain.author MUST equal 'brain';
    // any other value indicates a Canon Part 2 attribution breach and
    // demotes the BRAIN.md weight to 0.0 with a trace note. The
    // resulting brain_md_weight_applied is observable in the decision
    // trace by /mos:explain-decision (Plan 91-05).
    let attributionBreach = false;
    if (brain !== null && brain.author !== undefined && brain.author !== 'brain') {
      attributionBreach = true;
      weightApplied = 0.0; // brain_md_weight_applied demotion target
    }
    // Section 8.1 trace.brain_md_weight_applied final assignment.
    trace.brain_md_weight_applied = weightApplied;

    // Section 8 trace fields (always emitted, even with brain null).
    if (brain === null) {
      trace.brain_md_version = null;
      trace.brain_md_staleness = 'absent';
      trace.brain_md_stale_reason = null;
    } else {
      trace.brain_md_version = typeof brain.brain_graph_version === 'number'
        ? brain.brain_graph_version
        : null;
      trace.brain_md_staleness = typeof brain.staleness === 'string'
        ? brain.staleness
        : 'absent';
      trace.brain_md_stale_reason = typeof brain.stale_reason === 'string'
        ? brain.stale_reason
        : null;
    }

    // Section 3.2 sections_consumed list (non-null bodies only).
    trace.brain_md_sections_consumed = consumedSections(brain);

    // Section 6 RECOMMENDED gate evaluation (record confidence even
    // when gate fails; render marker only when ALL conditions hold).
    let recommendedConfidence = null;
    let recommendedRendered = false;
    if (brain !== null && brain.sections) {
      const pm = brain.sections.pattern_matches;
      if (pm && typeof pm.body === 'string') {
        recommendedConfidence = extractHighestConfidence(pm.body);
      }
    }
    trace.brain_md_recommended_confidence = recommendedConfidence;

    if (
      tierMode === 'mode_a' &&
      !attributionBreach &&
      recommendedConfidence !== null &&
      recommendedConfidence >= RECOMMENDED_CONFIDENCE_FLOOR
    ) {
      // Section 6 condition 4: candidate verb must match a Canon Part 3
      // vocabulary entry. extractTopCandidateVerb returns the resolved
      // canonical verb or null.
      const pm = brain.sections.pattern_matches;
      const verb = extractTopCandidateVerb(pm.body);
      if (verb !== null) {
        recommendedRendered = true;
      }
    }
    trace.brain_md_recommended_marker_rendered = recommendedRendered;

    // Five-signal triangulation (structural; rule-based per D-02).
    trace.icm_scope = buildIcmScope(quadruple, t);
    trace.sql_signals = buildSqlSignals(quadruple, t);
    trace.minto_reasoning = buildMintoReasoning(quadruple);
    trace.intent_persona = buildIntentPersona(ctx);

    // CASC-02: reflect the navigated neighborhood (computed once above). When a
    // non-empty getNeighborhood-ranked neighborhood arrived via context.roomContext,
    // the spine NAVIGATED -- the field carries the ranked neighbor scalars and the
    // rationale notes it (below). routing_source is NOT assigned here; flipped at
    // the router layer when fire_skill is non-null (Phase 144).
    trace.navigated_neighborhood = navigatedNeighborhood;

    // Compose chosen_rationale from active rules.
    const rationale = [];
    if (tierMode === 'tier_0') {
      if (brain === null) {
        rationale.push('Tier 0 fallback: BRAIN.md absent.');
      } else if (brain.parse_failed === true) {
        rationale.push('brain_parse_failed fell through to tier_0.');
      } else if (brain.staleness === 'unavailable') {
        rationale.push('Tier 0 fallback: BRAIN.md staleness unavailable.');
      } else {
        rationale.push('Tier 0 fallback: brain unreachable and not offline-exempt.');
      }
    } else if (tierMode === 'mode_b') {
      rationale.push('Mode B local-only: brain unreachable; brain_offline exemption applied (weight 0.9).');
      rationale.push('mode_b suppresses RECOMMENDED per Canon Part 3.');
    } else {
      // mode_a
      if (recommendedRendered) {
        rationale.push('Mode A: RECOMMENDED rendered (confidence >= 0.7).');
      } else if (recommendedConfidence !== null) {
        rationale.push('Mode A: pattern_matches confidence ' + recommendedConfidence + ' below 0.7 floor; RECOMMENDED suppressed.');
      } else {
        rationale.push('Mode A: no pattern_matches candidate available.');
      }
    }
    if (attributionBreach) {
      rationale.unshift('canon_part_2_attribution_breach: brain.author is not "brain"; weight demoted to 0.0.');
    }

    // Wicked escalation note (added to rationale when triggered).
    const wickedSection = brain && brain.sections && brain.sections.wicked_indicators;
    if (wickedSection && wickedSection.body) {
      const score = extractWickedScore(wickedSection.body);
      if (score >= WICKED_ESCALATION_THRESHOLD) {
        rationale.push('wicked_escalation: wicked_score >= ' + WICKED_ESCALATION_THRESHOLD + ' triggers soft-systems family.');
      }
    }

    // CASC-02: append the navigated-neighborhood clause so /mos:explain-decision
    // surfaces that routing reflected the graph walk (not just stored edges).
    if (navigatedNeighborhood !== null) {
      rationale.push(
        'Routing reflected the navigated neighborhood (' +
        navigatedNeighborhood.count + ' ranked neighbor' +
        (navigatedNeighborhood.count === 1 ? '' : 's') + ', top ' +
        navigatedNeighborhood.top_node_id + ').'
      );
    }

    // Phase 144 (NAV-01): when a sensor reach drives fire_skill, append a clause
    // naming reach_id + posture ONLY (Part 8: never reach.signal's user-derived
    // value, evidence bodies, the dispatch handle, or any user content).
    if (sensorReaches.length > 0) {
      const topReach = sensorReaches[0];
      if (topReach && typeof topReach === 'object' && reachIdToSkillFamily(topReach.reach_id) !== null) {
        rationale.push('Sensor reach fired: ' + topReach.reach_id + '/' + topReach.posture + '.');
      }
    }

    trace.chosen_rationale = rationale.join(' ');

    // Compose decision outputs (rule-based, not weighted score). Phase 144: the
    // sensor reaches are threaded in so a fired reach -> a CANONICAL VERB (ANY
    // tier), flipping routing_source legacy -> engine at the router as a
    // consequence.
    decision.fire_skill = resolveFireSkill(brain, weightApplied, tierMode, sensorReaches);
    decision.suppress_skills = resolveSuppressSkills(ctx, brain);
    decision.persona_updates = resolvePersonaUpdates(ctx, brain);
    decision.offer_next_step = resolveOfferNextStep(ctx, brain);

    // Phase 91-07: problem-type routing contribution. Lazy-require so a
    // missing module does not crash the engine -- problem-type routing
    // BIASES the rationale (and may inform fire_skill when no
    // higher-priority signal has set one), but is never load-bearing.
    // Per locked decision D-08 + Canon Appendix E rule R4.
    try {
      if (brain !== null && brain.sections) {
        const ptRouter = require('./problem-type-router.cjs');
        const ptSection = brain.sections.problemtype_classification;
        const wkSection = brain.sections.wicked_indicators;
        const parsed = ptRouter.parseProblemTypeSection(ptSection);
        let routing = null;
        if (parsed !== null) {
          routing = ptRouter.routeByProblemType(parsed.type, parsed.confidence);
        }
        const wickedEscalate = ptRouter.detectWickedEscalation(wkSection);
        if (wickedEscalate) {
          // Wicked override applies regardless of base type. If we have
          // no base routing, synthesize a stub so applyWickedOverride
          // has a baseline to overlay.
          if (routing === null) {
            routing = {
              recommended_skills: [],
              suppressed_skills: [],
              reason: '',
              wicked_override: false,
            };
          }
          routing = ptRouter.applyWickedOverride(routing);
        }

        if (routing !== null && routing.reason && routing.reason.length > 0) {
          // Append routing reason to chosen_rationale so /mos:explain-
          // decision can surface the contribution.
          const existing = trace.chosen_rationale || '';
          const sep = existing.length > 0 ? ' ' : '';
          trace.chosen_rationale = existing + sep + 'ProblemType routing: ' + routing.reason;

          // If no higher-priority signal set fire_skill AND routing
          // recommends a primary skill AND confidence is usable, set
          // fire_skill to the primary recommendation. Wicked override
          // always wins when present (its first skill is the soft-
          // systems entry point).
          const conf = parsed && typeof parsed.confidence === 'number' ? parsed.confidence : null;
          const confOk = routing.wicked_override || (typeof conf === 'number' && conf >= 0.5);
          if (
            decision.fire_skill === null &&
            confOk &&
            Array.isArray(routing.recommended_skills) &&
            routing.recommended_skills.length > 0
          ) {
            decision.fire_skill = routing.recommended_skills[0];
          }
        }
      }
    } catch (_e) {
      // Routing is biasing-only; never block the decision on a routing
      // module fault. Leave decision + trace untouched.
    }

    // Phase 91-08: framework-chain-composer contribution. Lazy-require
    // so a missing module never crashes the engine -- chain composition
    // is one signal among five and biases offer_next_step when no higher-
    // priority signal has populated it. Per locked decision D-09 + Canon
    // Part 2 Engine 1 + Appendix E. Reads BRAIN.md framework_chain_
    // predictions section (FEEDS_INTO edges authored by Phase 90-01).
    // Canon Part 8: zero Brain queries at engine time -- composer reads
    // only the LOCAL section body passed in via quadruple.
    try {
      if (brain !== null && brain.sections) {
        const chainComposer = require('./framework-chain-composer.cjs');
        const chainSection = brain.sections.framework_chain_predictions;
        if (chainSection !== null && chainSection !== undefined) {
          const edges = chainComposer.parseFrameworkChainSection(chainSection);
          if (edges.length > 0) {
            const completed = chainComposer.detectCompletedFramework(
              null, // roomDir is not needed when reasoning carries the signal
              t.sectionPath || null,
              quadruple.reasoning || null
            );
            if (completed !== null) {
              const proposal = chainComposer.proposeNextFramework(completed, edges);
              if (proposal !== null) {
                // User override detection: if lastTurnOffer was the chain
                // proposal AND current turn invokes a DIFFERENT /mos:
                // command, record REJECTED chain suggestion as graph data
                // per Canon Part 4. The override check runs BEFORE we
                // overwrite offer_next_step so the user's intent (in
                // userText) gets recorded against the prior offer.
                const lastOffer = ctx.lastTurnOffer;
                const userText = typeof t.userText === 'string' ? t.userText : '';
                if (
                  lastOffer &&
                  typeof lastOffer === 'object' &&
                  typeof lastOffer.command === 'string' &&
                  lastOffer.command.length > 0 &&
                  userText.length > 0
                ) {
                  // Match a /mos: command in the user text.
                  const userCmdMatch = /\/mos:[a-z][a-z0-9-]*/i.exec(userText);
                  if (userCmdMatch !== null) {
                    const userCmd = userCmdMatch[0];
                    if (userCmd !== lastOffer.command) {
                      // Override recorded as graph data per Canon Part 4.
                      const existing = trace.chosen_rationale || '';
                      const sep = existing.length > 0 ? ' ' : '';
                      trace.chosen_rationale =
                        existing + sep +
                        'REJECTED chain suggestion: user invoked ' + userCmd +
                        ' instead of ' + lastOffer.command + '.';
                      trace.chain_override_recorded = true;
                    }
                  }
                }

                // Set offer_next_step ONLY when no higher-priority signal
                // has already populated it. Chain composition is one
                // signal among five; it never overwrites a stronger one.
                if (decision.offer_next_step === null) {
                  decision.offer_next_step = {
                    command: proposal.command,
                    reason: proposal.reason,
                  };
                  // Surface chain-specific eligibility flag in trace so
                  // offer-presenter (Plan 91-04) can render the
                  // RECOMMENDED marker per Canon Part 3 Section 6 when
                  // Mode A holds AND chain confidence >= 0.7.
                  trace.chain_recommended_eligible = proposal.recommended_eligible === true;
                  // When the engine's RECOMMENDED gate already fired
                  // (e.g. via pattern_matches), the chain proposal piggy-
                  // backs on the existing marker. When pattern_matches
                  // had no candidate (the common case in Wave 3 fixtures)
                  // and Mode A holds and the chain proposal is eligible,
                  // promote the marker so the presenter renders it.
                  if (
                    tierMode === 'mode_a' &&
                    proposal.recommended_eligible === true &&
                    trace.brain_md_recommended_marker_rendered === false
                  ) {
                    trace.brain_md_recommended_marker_rendered = true;
                    trace.brain_md_recommended_confidence =
                      typeof trace.brain_md_recommended_confidence === 'number' &&
                      trace.brain_md_recommended_confidence > proposal.confidence
                        ? trace.brain_md_recommended_confidence
                        : proposal.confidence;
                  }
                  // Append chain rationale for /mos:explain-decision.
                  const existing2 = trace.chosen_rationale || '';
                  const sep2 = existing2.length > 0 ? ' ' : '';
                  trace.chosen_rationale =
                    existing2 + sep2 +
                    'Framework chain: ' + completed + ' FEEDS_INTO ' + proposal.next +
                    ' (Brain confidence ' + proposal.confidence.toFixed(2) + ').';
                }
              }
            }
          }
        }
      }
    } catch (_e) {
      // Chain composition is biasing-only; never block the decision on
      // a composer fault. Leave decision + trace untouched.
    }

    // Phase 144 (Task 2): the Zep-shaped LOCAL trace.context_assembly + LOCAL
    // latency telemetry on the populated return path. Computed AFTER all
    // fire_skill contributions (sensor / brain / problem-type / chain) so
    // decision_grounding names the FINAL justification. LOCAL trace JSON only;
    // nothing reaches the Brain. No await / I/O (pure scalar shaping) -- the
    // 1200ms NAV budget is untouched.
    trace.context_assembly = buildContextAssembly(
      navigatedNeighborhood,
      sensorReaches,
      groundingForFireSkill(decision.fire_skill, sensorReaches, brain, navigatedNeighborhood)
    );
    trace._meta = {
      latencies_ms: {
        dispatchSensors_ms: dispatchSensorsMs,
        decide_total_ms: Date.now() - decideStartMs,
      },
    };

    return decision;
  } catch (err) {
    // Graceful degradation: never throw out of decide().
    const safe = shared.emptyDecision();
    safe.decision_trace.chosen_rationale =
      'engine_fault: ' + (err && err.message ? err.message : String(err));
    safe.decision_trace.brain_md_tier_mode = 'tier_0';
    safe.decision_trace.brain_md_staleness = 'absent';
    return safe;
  }
}

module.exports = {
  decide: decide,
  // Phase 148-05 (IRW-05): offer-resolver + suggest-next unified onto the ONE
  // selector-dispatcher.pickShape F.1 host (single render path, no bespoke
  // renderer).
  resolveOfferNextStep: resolveOfferNextStep,
  renderOfferNextStep: renderOfferNextStep,
  suggestNext: suggestNext,
  // Internal helpers exposed for downstream Phase 91 plans + testing:
  reachIdToSkillFamily: reachIdToSkillFamily,
  resolveTierMode: shared.resolveTierMode,
  applyStalenessMultiplier: shared.applyStalenessMultiplier,
  evaluateRecommendedGate: function (decision, quadruple) {
    // Convenience accessor matching plan frontmatter contract.
    return decision &&
      decision.decision_trace &&
      decision.decision_trace.brain_md_recommended_marker_rendered === true;
  },
};
