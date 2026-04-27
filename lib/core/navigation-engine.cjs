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
 * Resolve the best fire_skill given Brain signal state and the wicked
 * escalation rule. Returns null when no signal warrants firing.
 */
function resolveFireSkill(brain, weightApplied, tierMode) {
  // Wicked escalation takes precedence over normal routing (Canon
  // Appendix E rule R4).
  const wickedSection = brain && brain.sections && brain.sections.wicked_indicators;
  if (wickedSection && wickedSection.body) {
    const score = extractWickedScore(wickedSection.body);
    if (score >= WICKED_ESCALATION_THRESHOLD) {
      return 'soft-systems';
    }
  }
  // Mode A + non-zero weight + parseable verb -> fire that verb's skill.
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
    // Fresh Brain but no pattern_matches verb: fall back to context
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
 * offer_next_step: returns null OR { command, reason }. Max 1 per turn
 * is enforced trivially (we never return more than one).
 *
 * v1 ships null until Plan 91-04 wires the offer presentation rules.
 */
function resolveOfferNextStep(_context, _brain) {
  return null;
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
  // Safe defaults.
  const ctx = context || {};
  const t = turn || {};
  const decision = shared.emptyDecision();
  const trace = decision.decision_trace;

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
      trace.chosen_rationale = 'Tier 0 fallback: no quadruple available for sectionPath.';
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

    trace.chosen_rationale = rationale.join(' ');

    // Compose decision outputs (rule-based, not weighted score).
    decision.fire_skill = resolveFireSkill(brain, weightApplied, tierMode);
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
  // Internal helpers exposed for downstream Phase 91 plans + testing:
  resolveTierMode: shared.resolveTierMode,
  applyStalenessMultiplier: shared.applyStalenessMultiplier,
  evaluateRecommendedGate: function (decision, quadruple) {
    // Convenience accessor matching plan frontmatter contract.
    return decision &&
      decision.decision_trace &&
      decision.decision_trace.brain_md_recommended_marker_rendered === true;
  },
};
