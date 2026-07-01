#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 91-01 -- persona taxonomy frozen tables (pure, zero I/O)
 * ==============================================================
 * Frozen vocabulary tables that codify the Larry / Brain persona
 * boundary plus the Canon Part 2 + Part 2a role-blend and journey-stage
 * enums. These tables are the contract between:
 *
 *   - lib/core/user-md-ops.cjs   (validates USER.md frontmatter values)
 *   - lib/core/navigation-engine.cjs (routes by persona + journey stage)
 *   - lib/core/brain-derivation-prompts.cjs (only generic persona TAGS
 *     ever cross the Canon Part 8 boundary; never role_blend weights or
 *     user_id)
 *
 * Locked decision D-03 (Phase 91 CONTEXT):
 *   Larry detects 3 personas -- TTO / Researcher / Business
 *   Brain knows 2 personas -- Explicit / Implicit
 *   Translation is many-to-one -- TTO + Business -> Explicit;
 *                                Researcher -> Implicit
 *
 * Inverse translation (Brain -> Larry) is intentionally NOT exported
 * because the mapping cannot be inverted deterministically.
 *
 * Pure module: zero I/O, zero requires beyond the (omitted) stdlib. All
 * exports are frozen at module load time. Three-surface compatible
 * (CLI hook, Desktop MCP handler, Cowork shared runner) by construction.
 *
 * License: BSL 1.1.
 */

// ---------- Larry-side detection vocabulary ----------

/**
 * Three Larry personas, in detection-priority order. Frozen.
 * Source: MindrianV2 prompts/larry_skill/* + 89.5-0X discovery engine
 * persona-detection rules.
 */
const LARRY_PERSONAS = Object.freeze([
  'TTO',
  'Researcher',
  'Business',
]);

// ---------- Brain-side classification vocabulary ----------

/**
 * Two Brain personas. The Brain side of the boundary uses a coarser
 * grain than Larry by design: Explicit problems chain to well-defined
 * methodology trees; Implicit problems chain to ill-defined / wicked
 * methodology trees. Frozen.
 */
const BRAIN_PERSONAS = Object.freeze([
  'Explicit',
  'Implicit',
]);

// ---------- D-03 translation table (Larry -> Brain, many-to-one) ----------

/**
 * Many-to-one Larry -> Brain mapping.
 *
 * | Larry      | Brain    | Rationale                                   |
 * |------------|----------|---------------------------------------------|
 * | TTO        | Explicit | Tech-Transfer-Officer asks well-defined     |
 * |            |          | questions about tools.                      |
 * | Researcher | Implicit | Researcher works in undefined / ill-defined |
 * |            |          | problem space.                              |
 * | Business   | Explicit | Business asks well-defined strategic /      |
 * |            |          | operational questions.                      |
 *
 * Frozen.
 */
const LARRY_TO_BRAIN = Object.freeze({
  TTO: 'Explicit',
  Researcher: 'Implicit',
  Business: 'Explicit',
});

// ---------- Campbell journey-stage vocabulary (Canon Part 2a) ----------

/**
 * Twelve-stage Campbell monomyth in canonical order. The user's current
 * journey stage is one axis of persona = role-blend x journey-stage.
 * Frozen.
 */
const JOURNEY_STAGES = Object.freeze([
  'ordinary_world',
  'call_to_adventure',
  'refusal',
  'meeting_the_mentor',
  'crossing_threshold',
  'tests_allies_enemies',
  'approach_inmost_cave',
  'ordeal',
  'reward',
  'road_back',
  'resurrection',
  'return_with_elixir',
]);

// ---------- Role-blend axes (Canon Part 2 9-role minus regulatory) ----------

/**
 * Seven role-blend weight axes per Canon Part 2 9-role taxonomy with
 * regulatory subtypes (Researcher.IND, Founder.grant) excluded -- those
 * are regulatory layers on top of a base role, not first-class blend
 * axes. The two excluded subtypes still appear in Canon Part 8 persona
 * protections but never as role_blend keys. Frozen.
 */
const ROLE_BLEND_AXES = Object.freeze([
  'Founder',
  'Researcher',
  'Operator',
  'Investor',
  'Mentor',
  'Domain Expert',
  'Student',
]);

// ---------- Problem-type vocabulary (Canon Part 3 + Phase 90) ----------

/**
 * Closed problem-type enum: Undefined, Ill-Defined, Well-Defined, plus
 * an explicit unknown sentinel for cold starts. Matches BONO axis 1
 * (definition clarity) per Canon Part 3 + Phase 90 ProblemType
 * classification. Frozen.
 */
const PROBLEM_TYPES = Object.freeze([
  'UDP',
  'IDP',
  'WDP',
  'unknown',
]);

// ---------- Venture-stage vocabulary (Canon) ----------

/**
 * Closed venture-stage enum tracking the user's stage in the venture
 * lifecycle. unknown sentinel allowed for cold-start sessions. Frozen.
 */
const VENTURE_STAGES = Object.freeze([
  'pre_opportunity',
  'thesis_build',
  'validation',
  'execution',
  'scale',
  'unknown',
]);

// ---------- Role-level axis (Phase 205-05 item 5, Canon Part 2 / Phase 115) ----------

/**
 * The COMPETENCE-LEVEL axis, orthogonal to ROLE_BLEND_AXES. role_blend is the
 * user's FUNCTIONAL role (Founder / Operator / Investor ...); role_level is the
 * user's COMPETENCE level in the current conversation. They are independent: a
 * Founder can be a student of a topic; a Researcher can be a professor of one.
 *
 * Lawrence Test-6 ratio (205-CONTEXT item 5 / (10)): students skew VERTICAL
 * (depth), non-students skew HORIZONTAL/LATERAL (connect + import). The level
 * biases the dial DEFAULT and elevation emphasis WITHOUT quotas -- gate on the
 * signal, never on a count. Frozen.
 */
const ROLE_LEVELS = Object.freeze([
  'student',
  'practitioner',
  'researcher',
  'professor',
]);

/**
 * LOCAL keyword signals per role_level. Same soft keyword discipline the insight
 * sensors use: a match is a SIGNAL, not proof; cold start soft-fails to null.
 * Detection order (professor -> researcher -> practitioner -> student) resolves
 * ties toward the higher competence level (a professor phrase outranks a stray
 * "learning"). Part 8: only the resolved role_level enum is ever used downstream;
 * the turn prose never egresses. Frozen.
 */
const _ROLE_LEVEL_SIGNALS = Object.freeze({
  professor: Object.freeze([
    'my students', 'i teach', 'i lecture', 'i am a professor', "i'm a professor",
    'my course', 'my syllabus', 'tenure', 'my lab', 'my research group',
    'when i teach', 'in my class', 'peer review', 'i supervise',
  ]),
  researcher: Object.freeze([
    'my research', 'my dissertation', 'my thesis', 'my phd', 'my postdoc',
    'my hypothesis', 'peer-reviewed', 'my experiment', 'i study', 'my paper',
    'my findings', 'literature review', 'my grant',
  ]),
  practitioner: Object.freeze([
    'my company', 'my startup', 'my clients', 'my customers', 'my team',
    'our product', 'we ship', 'in production', 'my roadmap', 'our revenue',
    'my business', 'go to market', 'our users',
  ]),
  student: Object.freeze([
    "i'm learning", 'i am learning', 'help me understand', 'new to this',
    'my homework', 'my assignment', 'i am a student', "i'm a student",
    'my class', 'my course work', 'can you explain', 'i do not understand',
    "i don't understand", 'just starting',
  ]),
});

/**
 * The elevation LEAN each role_level biases the default toward (Lawrence ratio).
 * This is a SOFT ORDERING, never a quota: `primary` is the direction the default
 * leans, `secondary` is the fallback order. student -> vertical (depth); every
 * non-student -> horizontal (connect the ideas they already hold) with lateral
 * emphasized. Frozen. The three directions are the Canon Part 12 elevation
 * taxonomy (vertical/horizontal/lateral).
 */
const ROLE_LEVEL_ELEVATION_LEAN = Object.freeze({
  student: Object.freeze({ primary: 'vertical', secondary: Object.freeze(['horizontal', 'lateral']) }),
  practitioner: Object.freeze({ primary: 'horizontal', secondary: Object.freeze(['lateral', 'vertical']) }),
  researcher: Object.freeze({ primary: 'horizontal', secondary: Object.freeze(['lateral', 'vertical']) }),
  professor: Object.freeze({ primary: 'horizontal', secondary: Object.freeze(['lateral', 'vertical']) }),
});

// Normalize an opening-turns argument to a single lowercased haystack string.
// Accepts an array of strings, an array of {text} turn objects, or a single
// string. Anything else -> '' (cold start). Pure, no I/O.
function _openingTurnsToText(openingTurns) {
  if (typeof openingTurns === 'string') return openingTurns.toLowerCase();
  if (!Array.isArray(openingTurns)) return '';
  const parts = [];
  for (const t of openingTurns) {
    if (typeof t === 'string') parts.push(t);
    else if (t && typeof t === 'object' && typeof t.text === 'string') parts.push(t.text);
  }
  return parts.join(' \n ').toLowerCase();
}

/**
 * Detect role_level from the opening turns using the LOCAL keyword pass.
 *
 * Returns a member of ROLE_LEVELS when a signal is found, or null on cold start
 * (no turns / no matching signal) -- the caller decides how to handle "no
 * detection yet" (a personaless default is byte-stable). Never throws on
 * malformed input. Detection is highest-competence-wins: the first role_level in
 * declaration order (professor -> researcher -> practitioner -> student) that has
 * the STRICT-MAX signal count wins; ties break toward the higher level.
 *
 * @param {Array<string|{text:string}>|string} openingTurns
 * @returns {string|null} a ROLE_LEVELS member, or null.
 */
function detectRoleLevel(openingTurns) {
  const hay = _openingTurnsToText(openingTurns);
  if (hay.length === 0) return null;
  let best = null;
  let bestCount = 0;
  // Iterate in declaration order so ties resolve toward the higher competence.
  for (const level of ROLE_LEVELS) {
    const signals = _ROLE_LEVEL_SIGNALS[level];
    let count = 0;
    for (const kw of signals) {
      if (hay.indexOf(kw) !== -1) count++;
    }
    if (count > bestCount) {
      bestCount = count;
      best = level;
    }
  }
  return bestCount > 0 ? best : null;
}

/**
 * Resolve the elevation lean for a role_level (the dial-default bias). Returns
 * the frozen {primary, secondary} lean for a known role_level, or null when the
 * level is unknown / null (cold start -> no bias, keep the base default). This is
 * a bias, NOT a quota: it declares which direction the default leans, never a
 * fixed count of any elevation type.
 *
 * @param {string|null} role_level
 * @returns {{primary:string, secondary:string[]}|null}
 */
function resolveElevationLean(role_level) {
  if (typeof role_level !== 'string') return null;
  if (!Object.prototype.hasOwnProperty.call(ROLE_LEVEL_ELEVATION_LEAN, role_level)) {
    return null;
  }
  return ROLE_LEVEL_ELEVATION_LEAN[role_level];
}

// ---------- Translation helper ----------

/**
 * Translate a Larry persona to its Brain counterpart per D-03.
 *
 * Returns the corresponding Brain persona string when the input is a
 * known Larry persona; returns null otherwise. Graceful fallback: never
 * throws on unknown / non-string input. The null sentinel lets callers
 * decide how to handle a cold-start "no persona detected yet" condition
 * without a try/catch.
 *
 * No inverse function is exported: the mapping is many-to-one (TTO +
 * Business both map to Explicit) and therefore not deterministically
 * invertible. Callers that need Brain -> Larry must consult full
 * USER.md context.
 *
 * @param {string} larryPersona One of LARRY_PERSONAS (case-sensitive).
 * @returns {string|null} Brain persona string or null when unknown.
 */
function translateLarryToBrain(larryPersona) {
  if (typeof larryPersona !== 'string') return null;
  if (!Object.prototype.hasOwnProperty.call(LARRY_TO_BRAIN, larryPersona)) {
    return null;
  }
  return LARRY_TO_BRAIN[larryPersona];
}

module.exports = {
  LARRY_PERSONAS,
  BRAIN_PERSONAS,
  LARRY_TO_BRAIN,
  JOURNEY_STAGES,
  ROLE_BLEND_AXES,
  PROBLEM_TYPES,
  VENTURE_STAGES,
  translateLarryToBrain,
  // Phase 205-05 (item 5): the role_level competence axis + auto-detection +
  // the elevation-lean dial-default bias (no quotas).
  ROLE_LEVELS,
  ROLE_LEVEL_ELEVATION_LEAN,
  detectRoleLevel,
  resolveElevationLean,
};
