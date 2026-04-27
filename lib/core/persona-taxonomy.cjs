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
};
