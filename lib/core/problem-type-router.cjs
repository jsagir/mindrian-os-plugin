#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 91-07 -- Problem-Type Router (canonical 4-type routing layer)
 * ====================================================================
 * Pure module. Parses BRAIN.md problemtype_classification +
 * wicked_indicators section bodies (already-parsed shape from
 * readQuadruple.brain.sections) and returns canonical 4-type routing
 * recommendations:
 *
 *   UDP (Undefined Problem)    -> Exploration skills family
 *   IDP (Ill-Defined Problem)  -> Problem-Definition-Seeking family
 *   WDP (Well-Defined Problem) -> Execution + Validation family
 *   unknown / null             -> No routing opinion (engine falls
 *                                 through to five-signal triangulation)
 *
 * Wicked escalation per Canon Appendix E rule R4: when
 * wicked_indicators.wicked_score >= 8, the router applies a wicked
 * override that replaces the base routing with the soft-systems family
 * (Founder/Yellow + Investor/Black + Researcher/White + Student/Green
 * + Mentor/Blue team composition is encoded as the verb / skill set
 * here; the team-composition implementation lands in Plan 91-08 or a
 * later phase).
 *
 * Per locked decision D-08 (Plan 91-CONTEXT): problem-type is one
 * signal among five in the navigation-engine triangulation. It biases
 * routing; it never forces a fire_skill in the face of higher-priority
 * signals.
 *
 * Canon Part 3 (10-verb closed vocabulary):
 *   Every recommended skill maps to one of the canonical 10 verbs from
 *   navigation-engine-shared.CANONICAL_VERBS. The verb mapping is
 *   exposed via TYPE_VERB_MAPPING + WICKED_VERB_MAPPING for downstream
 *   consumers (navigation-engine.cjs decide(), /mos:explain-decision).
 *
 * Canon Part 7 (Reuse Before Build):
 *   The recommended_skills strings reference EXISTING /mos:* commands
 *   (explore-domains, beautiful-question, whitespace, find-analogies,
 *   find-connections, structure-argument, mullins, lean-canvas,
 *   map-unknowns, grade, deep-grade, score-innovation, build-thesis,
 *   challenge-assumptions, find-bottlenecks, scenario-plan,
 *   explore-futures). NO net-new commands invented here.
 *
 * Canon Part 8 (Graph Boundary):
 *   ProblemType is a generic enum (UDP / IDP / WDP / unknown), not user
 *   content. The router NEVER reads BRAIN.md directly; it only consumes
 *   already-parsed section bodies passed in by callers. Zero I/O. Zero
 *   network. Zero brain-client touches.
 *
 * Pure module: zero I/O, zero side effects, zero throws.
 *
 * License: BSL 1.1.
 */

// ---------- Frozen routing tables ----------

// Each entry pairs a /mos:* command name (without the /mos: prefix)
// with one of the 10 Canon Part 3 canonical verbs. Verbs are the
// closed-set source of truth from navigation-engine-shared.CANONICAL_VERBS.

const UDP_SKILLS = Object.freeze([
  Object.freeze({ skill: 'explore-domains',     verb: 'Run Methodology' }),
  Object.freeze({ skill: 'beautiful-question',  verb: 'Reformulate' }),
  Object.freeze({ skill: 'whitespace',          verb: 'Navigate Graph' }),
  Object.freeze({ skill: 'find-analogies',      verb: 'Navigate Graph' }),
  Object.freeze({ skill: 'find-connections',    verb: 'Navigate Graph' }),
]);

const IDP_SKILLS = Object.freeze([
  Object.freeze({ skill: 'beautiful-question',  verb: 'Reformulate' }),
  Object.freeze({ skill: 'structure-argument',  verb: 'Run Methodology' }),
  Object.freeze({ skill: 'mullins',             verb: 'Run Methodology' }),
  Object.freeze({ skill: 'lean-canvas',         verb: 'Run Methodology' }),
  Object.freeze({ skill: 'map-unknowns',        verb: 'Synthesize' }),
]);

const WDP_SKILLS = Object.freeze([
  Object.freeze({ skill: 'grade',                 verb: 'Run Methodology' }),
  Object.freeze({ skill: 'deep-grade',            verb: 'Spawn Sub-Agent' }),
  Object.freeze({ skill: 'score-innovation',      verb: 'Synthesize' }),
  Object.freeze({ skill: 'build-thesis',          verb: 'Synthesize' }),
  Object.freeze({ skill: 'challenge-assumptions', verb: "Devil's Advocate" }),
]);

// Wicked override per Canon Appendix E rule R4 (wicked_score >= 8).
// Soft-systems family: emphasize stress-testing, bottleneck discovery,
// scenario planning, and futures exploration. Team composition for
// this override (Founder/Yellow + Investor/Black + Researcher/White +
// Student/Green + Mentor/Blue) is implemented in Plan 91-08 or later;
// this plan only emits the verb / skill set.
const WICKED_SKILLS = Object.freeze([
  Object.freeze({ skill: 'challenge-assumptions', verb: "Devil's Advocate" }),
  Object.freeze({ skill: 'find-bottlenecks',      verb: 'Navigate Graph' }),
  Object.freeze({ skill: 'scenario-plan',         verb: 'Scenario Plan' }),
  Object.freeze({ skill: 'explore-futures',       verb: 'Scenario Plan' }),
]);

const TYPE_VERB_MAPPING = Object.freeze({
  UDP: UDP_SKILLS,
  IDP: IDP_SKILLS,
  WDP: WDP_SKILLS,
});

const WICKED_VERB_MAPPING = WICKED_SKILLS;

const WICKED_ESCALATION_THRESHOLD = 8;
const LOW_CONFIDENCE_FLOOR = 0.5;

// Canonical type set (closed). Anything else (including 'wicked' as a
// type literal) becomes 'unknown' so wicked escalation is driven only
// by wicked_indicators score, not by the type label.
const CANONICAL_TYPES = Object.freeze(new Set(['UDP', 'IDP', 'WDP']));

// ---------- Helpers ----------

function extractTypeLabel(body) {
  // Permissive: match `type: <token>` on any line. Tolerant of leading
  // whitespace, list markers, and case variation. Returns the raw
  // token (uppercased to match canonical set).
  const m = /(?:^|\n)\s*[\-\*]?\s*type\s*:\s*([A-Za-z][A-Za-z0-9_-]*)/i.exec(body);
  if (!m) return null;
  return m[1].toUpperCase();
}

function extractConfidenceValue(body) {
  // Permissive: match `confidence: <float>` on any line. Returns null
  // when missing OR out-of-range (clamped to [0, 1] via null sentinel
  // so callers see "no usable confidence" rather than a silent clamp).
  const m = /(?:^|\n)\s*[\-\*]?\s*confidence\s*:\s*([0-9]*\.?[0-9]+)/i.exec(body);
  if (!m) return null;
  const v = parseFloat(m[1]);
  if (!Number.isFinite(v)) return null;
  if (v < 0.0 || v > 1.0) return null;
  return v;
}

function isNoSignal(body) {
  // Body is the literal "(no signal)" string (with optional whitespace).
  return /^\s*\(no\s*signal\)\s*$/i.test(body);
}

function extractWickedScore(body) {
  // Returns 0 when no score parses (matches navigation-engine.cjs
  // extractWickedScore semantics so callers get the same behavior
  // whether they go through this module or the engine directly).
  if (typeof body !== 'string' || body.length === 0) return 0;
  const m = /wicked_score\s*:\s*(\d+)/i.exec(body);
  if (!m) return 0;
  const v = parseInt(m[1], 10);
  if (!Number.isFinite(v) || v < 0) return 0;
  return v;
}

// ---------- Public API ----------

/**
 * parseProblemTypeSection(section) -> {type, confidence} | null
 *
 * Tolerantly extracts a (type, confidence) pair from the brain.sections.
 * problemtype_classification body. Returns null when the body is the
 * canonical "(no signal)" placeholder OR when nothing parses. Never
 * throws.
 *
 * Output shape:
 *   { type: 'UDP' | 'IDP' | 'WDP' | 'unknown', confidence: number | null }
 *
 * @param {object|null} section  -- {body, tokens_estimate} or null
 * @returns {{type:string, confidence:number|null}|null}
 */
function parseProblemTypeSection(section) {
  if (section === null || section === undefined) return null;
  if (typeof section !== 'object') return null;
  const body = section.body;
  if (typeof body !== 'string' || body.length === 0) return null;
  if (isNoSignal(body)) return null;

  const typeLabel = extractTypeLabel(body);
  if (typeLabel === null) return null;

  const confidence = extractConfidenceValue(body);
  const type = CANONICAL_TYPES.has(typeLabel) ? typeLabel : 'unknown';
  return { type: type, confidence: confidence };
}

/**
 * routeByProblemType(type, confidence) -> routing object
 *
 * Returns the recommended_skills + suppressed_skills + reason for a
 * given (type, confidence) pair. confidence is informational; the same
 * skills surface for low-confidence calls but the reason is annotated
 * with "low confidence" so callers can decide to weight down.
 *
 * Output shape:
 *   {
 *     recommended_skills: string[],   // /mos:* command names (no prefix)
 *     suppressed_skills:  string[],
 *     reason:             string,
 *     wicked_override:    boolean,    // always false from this function
 *   }
 *
 * Never throws.
 *
 * @param {string|null} type
 * @param {number|null} confidence
 * @returns {{recommended_skills:string[], suppressed_skills:string[], reason:string, wicked_override:boolean}}
 */
function routeByProblemType(type, confidence) {
  // Normalize: null / unknown / non-canonical -> fallback.
  if (type === null || type === undefined || type === 'unknown' || !CANONICAL_TYPES.has(type)) {
    return {
      recommended_skills: [],
      suppressed_skills: [],
      reason: 'ProblemType classification unavailable; using fallback triangulation.',
      wicked_override: false,
    };
  }

  const table = TYPE_VERB_MAPPING[type];
  const skills = table.map(function (e) { return e.skill; });

  let reason;
  if (type === 'UDP') {
    reason = 'Problem is Undefined (UDP confidence ' + formatConf(confidence) + '). Surfacing exploration tools.';
  } else if (type === 'IDP') {
    reason = 'Problem is Ill-Defined (IDP confidence ' + formatConf(confidence) + '). Surfacing definition-seeking tools.';
  } else { // WDP
    reason = 'Problem is Well-Defined (WDP confidence ' + formatConf(confidence) + '). Surfacing execution/validation tools.';
  }

  if (typeof confidence === 'number' && confidence < LOW_CONFIDENCE_FLOOR) {
    reason += ' (low confidence; caller may weight down.)';
  }

  return {
    recommended_skills: skills,
    suppressed_skills: [],
    reason: reason,
    wicked_override: false,
  };
}

function formatConf(c) {
  if (typeof c !== 'number' || !Number.isFinite(c)) return 'n/a';
  return c.toFixed(2);
}

/**
 * detectWickedEscalation(wickedSection) -> boolean
 *
 * Returns true when wicked_indicators.wicked_score >= 8 per Canon
 * Appendix E rule R4. Returns false when the section is null, empty,
 * unparseable, or below threshold.
 *
 * Never throws.
 *
 * @param {object|null} wickedSection -- {body, tokens_estimate} or null
 * @returns {boolean}
 */
function detectWickedEscalation(wickedSection) {
  if (wickedSection === null || wickedSection === undefined) return false;
  if (typeof wickedSection !== 'object') return false;
  const body = wickedSection.body;
  if (typeof body !== 'string') return false;
  const score = extractWickedScore(body);
  return score >= WICKED_ESCALATION_THRESHOLD;
}

/**
 * applyWickedOverride(baseRouting) -> overridden routing
 *
 * Replaces baseRouting.recommended_skills with the WICKED_SKILLS
 * soft-systems family per Canon Appendix E rule R4. The reason cites
 * Canon Appendix E R4 explicitly so /mos:explain-decision can surface
 * the override path.
 *
 * Never throws. Returns a new object (does not mutate baseRouting).
 *
 * @param {object} baseRouting -- output of routeByProblemType
 * @returns {{recommended_skills:string[], suppressed_skills:string[], reason:string, wicked_override:boolean}}
 */
function applyWickedOverride(baseRouting) {
  const skills = WICKED_SKILLS.map(function (e) { return e.skill; });
  const baseReason = (baseRouting && typeof baseRouting.reason === 'string')
    ? baseRouting.reason
    : '';
  const reason = 'Wicked indicators detected (wicked_score >= ' + WICKED_ESCALATION_THRESHOLD +
    '). Escalating to soft-systems family per Canon Appendix E R4. ' +
    (baseReason.length > 0 ? '(Base: ' + baseReason + ')' : '');
  return {
    recommended_skills: skills,
    suppressed_skills: (baseRouting && Array.isArray(baseRouting.suppressed_skills))
      ? baseRouting.suppressed_skills.slice()
      : [],
    reason: reason,
    wicked_override: true,
  };
}

// ---------- Exports ----------

module.exports = {
  parseProblemTypeSection: parseProblemTypeSection,
  routeByProblemType: routeByProblemType,
  detectWickedEscalation: detectWickedEscalation,
  applyWickedOverride: applyWickedOverride,
  // Frozen tables (Test 16 asserts every entry maps to a canonical verb).
  TYPE_VERB_MAPPING: TYPE_VERB_MAPPING,
  WICKED_VERB_MAPPING: WICKED_VERB_MAPPING,
  // Constants exposed for invariant tests.
  WICKED_ESCALATION_THRESHOLD: WICKED_ESCALATION_THRESHOLD,
  LOW_CONFIDENCE_FLOOR: LOW_CONFIDENCE_FLOOR,
};
