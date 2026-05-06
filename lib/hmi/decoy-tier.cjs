/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88.2-06 -- decoy-tier dispatcher (UISEL-88.2-08 part 1).
 *
 * Replaces the 88.2-00 Wave-0 stub with the real implementation per
 * RESEARCH.md DISCRETION-AMEND-02 (verbatim contract) + CONTEXT.md
 * F.6 spec body 2026-04-29 + D-AMEND-05 (Tier 2 persona-aware decoys).
 *
 * Responsibility: given an artifact + an optional comprehension profile +
 * an optional role_blend + Brain reachability, return a deterministically
 * seeded set of calibration decoys for a F.6 plan-review round. The 5
 * perturbation axes (wrong_owner / wrong_dependency / wrong_metric /
 * wrong_scope / wrong_invariant) are applied round-robin across the round
 * so every axis is exercised before any axis repeats.
 *
 * Tier auto-detection (rules verbatim per RESEARCH.md DISCRETION-AMEND-02):
 *   - Tier 2 IF profile.rounds_total >= 100 AND
 *             Array.isArray(profile.weak_spots) AND
 *             Array.isArray(profile.strong_spots) AND
 *             (profile.weak_spots.length + profile.strong_spots.length) >= 3 AND
 *             roleBlend AND Object.values(roleBlend).some(v => v >= 0.3)
 *   - ELSE IF brainAvailable === true OR process.env.MINDRIAN_BRAIN_KEY -> tier-1
 *   - ELSE -> tier-0
 *
 * Topic-coverage backstop: even if rounds_total >= 100, if the union of
 * weak_spots + strong_spots holds < 3 entries, the dispatcher falls back
 * to Tier 1 (or Tier 0 on cold-start) so a thinly-populated profile cannot
 * trigger persona-aware decoys against an unfit corpus. This is the R3
 * mitigation called out in RESEARCH.md (DISCRETION-AMEND-02 final paragraph).
 *
 * Tier 0 (cold-start / Brain unreachable):
 *   Algorithmic perturbation drawn from the artifact's own vocabulary.
 *   Each decoy applies one of 5 axes in round-robin order:
 *     a. wrong_owner       : swap subject (Phase 89 -> Phase 90)
 *     b. wrong_dependency  : swap referenced module (Pinecone -> Neo4j)
 *     c. wrong_metric      : swap a number/threshold (>=0.7 -> >=0.9)
 *     d. wrong_scope       : add/remove qualifier (public -> private)
 *     e. wrong_invariant   : flip an "always" / "never" claim
 *
 * Tier 1 (Brain reachable, profile immature):
 *   Returns Tier-0-style perturbation tagged with tier:'tier-1'. The Brain
 *   teaching-graph integration (framework chaining rules -> plausible-but-
 *   wrong substitutions calibrated against student-grading data) is deferred
 *   to a Phase 91 follow-on; this phase ships the structural placeholder
 *   so downstream consumers can route on tier label without code change.
 *
 * Tier 2 (cross-session, persona-aware):
 *   Reads weak_spots + strong_spots from the comprehension profile. The
 *   bias mechanism preferentially exercises perturbation axes that map to
 *   weak topics; reduces (but does not eliminate) frequency on axes that
 *   map to strong topics. Profile is graph-local per Canon Part 8.
 *
 * Comprehension profile path (per RESEARCH.md):
 *   <roomDir>/.mindrian/comprehension-profile-<sha256(user_id):16>.json
 * Schema (verbatim):
 *   {
 *     schema_version: 1,
 *     rounds_total: number,
 *     weak_spots: [{ topic, miss_rate, n }, ...],
 *     strong_spots: [{ topic, hit_rate, n }, ...],
 *     last_calibration_round: ISO-string,
 *     last_round_seed: 16-hex,
 *     preferences: { decoy_opt_out, tier_pin: null|'tier-0'|'tier-1'|'tier-2' },
 *   }
 *
 * Distribution seed: sha256(artifactPath + '|' + roundSize + '|' + Date.now()).slice(0, 16).
 *
 * Decoy-ethics contract (room/decisions/decision-decoy-ethics.md):
 *   - Decoys NOT disclosed during the round; debrief Shape A discloses at round end.
 *   - profile.preferences.decoy_opt_out === true bypasses decoy injection
 *     (returns { decoys: [], tier_reason: 'decoy_opt_out_user_preference' }).
 *
 * Pure CJS, node built-ins only, zero deps (Phase 87 invariant).
 * Canon Part 8: zero Brain egress; profile read is local only; no network IO.
 */
'use strict';

const fs = require('node:fs');
const crypto = require('node:crypto');

const PERTURBATION_AXES = [
  'wrong_owner',
  'wrong_dependency',
  'wrong_metric',
  'wrong_scope',
  'wrong_invariant',
];

// Topic-coverage backstop: profile weak + strong spots must total at least
// this many entries before Tier 2 persona-aware bias kicks in. Below this,
// the profile is too thin to safely steer decoy selection.
const TOPIC_COVERAGE_MIN = 3;

// Profile maturity gate: rounds_total below this falls back to Tier 1 or 0.
const PROFILE_MATURITY_MIN = 100;

// Persona signal threshold: at least one role_blend axis must clear this
// before Tier 2 activates. Below this, the navigator lacks a strong
// enough lens to bias decoy generation against.
const PERSONA_AXIS_MIN = 0.3;

/**
 * Determine which tier the round will run at, given the inputs.
 * Pure function -- no IO. The reason string is surfaced back to callers
 * (and the renderer's debrief Shape A) so the choice is auditable.
 */
function detectTier(args) {
  const a = (args && typeof args === 'object') ? args : {};
  const tierOverride = a.tierOverride;
  if (tierOverride === 'tier-0' || tierOverride === 'tier-1' || tierOverride === 'tier-2') {
    return { tier: tierOverride, reason: 'override' };
  }

  const profile = a.profile || null;
  const roleBlend = a.roleBlend || null;
  // Caller-supplied brainAvailable wins (boolean explicit). Env var only
  // observed when caller leaves the field undefined. This protects test
  // harnesses (and CI runs that ship MINDRIAN_BRAIN_KEY for unrelated
  // commands) from accidentally promoting cold-start scenarios to Tier 1.
  let brainAvailable;
  if (a.brainAvailable === true) brainAvailable = true;
  else if (a.brainAvailable === false) brainAvailable = false;
  else brainAvailable = process.env.MINDRIAN_BRAIN_KEY ? true : false;

  // Tier 2 gate: profile maturity + topic coverage + persona signal.
  // All three must hold; any miss falls through to the Tier 1 / Tier 0 ladder.
  if (profile
      && typeof profile.rounds_total === 'number'
      && profile.rounds_total >= PROFILE_MATURITY_MIN
      && Array.isArray(profile.weak_spots)
      && Array.isArray(profile.strong_spots)
      && (profile.weak_spots.length + profile.strong_spots.length) >= TOPIC_COVERAGE_MIN
      && roleBlend
      && typeof roleBlend === 'object'
      && Object.values(roleBlend).some(v => typeof v === 'number' && v >= PERSONA_AXIS_MIN)) {
    return { tier: 'tier-2', reason: 'profile_mature_persona_signal' };
  }

  // Topic-coverage backstop / persona-signal backstop: profile may be
  // mature but coverage or signal too thin -- prefer Tier 1 over Tier 2.
  if (brainAvailable) {
    return { tier: 'tier-1', reason: 'brain_reachable_profile_immature' };
  }

  return { tier: 'tier-0', reason: 'brain_unreachable_or_cold_start' };
}

/**
 * Pull other phase-IDs / module names / numbers from the artifact for
 * plausible swaps. Used by perturbReal() to keep wrong-X variants drawn
 * from the artifact's own vocabulary (per RESEARCH.md DISCRETION-AMEND-02
 * "Perturbation MUST stay plausible: drawn from artifact's own vocabulary,
 * still parses as grammatical user-story, detectable on careful read but
 * invisible on skim").
 */
function extractVocab(line, fullArtifact) {
  const phaseIdsAll = fullArtifact.match(/Phase\s+\d+(?:\.\d+)?/g) || [];
  const moduleNamesAll = fullArtifact.match(/[a-z][a-z-]+\.cjs|[A-Z][a-zA-Z]+\b/g) || [];
  const numbersAll = fullArtifact.match(/\d+(?:\.\d+)?/g) || [];
  return {
    phase_ids: Array.from(new Set(phaseIdsAll)),
    module_names: Array.from(new Set(moduleNamesAll)),
    numbers: Array.from(new Set(numbersAll)),
  };
}

/**
 * Parse the artifact for "load-bearing claims" -- bullet lines and lines
 * with a colon, since those most often state user-story-style assertions
 * in PLAN.md / CONTEXT.md / SUMMARY.md format.
 */
function loadArtifactClaims(artifactPath) {
  try {
    if (typeof artifactPath !== 'string' || artifactPath.length === 0) return [];
    const raw = fs.readFileSync(artifactPath, 'utf8');
    const lines = raw.split('\n').filter(L => /^[-*]\s|:\s/.test(L) && L.length > 30 && L.length < 280);
    return lines.map(L => ({ text: L.trim(), vocabulary_pool: extractVocab(L, raw) }));
  } catch (_e) {
    return [];
  }
}

/**
 * Apply ONE perturbation axis to a claim. The output stays plausible:
 * it must still parse as a grammatical user-story so a skim reader cannot
 * easily separate it from the real claims. The 5 axes match the RESEARCH.md
 * verbatim list and are applied round-robin by selectDecoys().
 */
function perturbReal(claim, axis) {
  const v = (claim && claim.vocabulary_pool) || {};
  const text = (claim && typeof claim.text === 'string') ? claim.text : '';
  let perturbed = text;
  switch (axis) {
    case 'wrong_owner': {
      if (v.phase_ids && v.phase_ids.length >= 2) {
        const a = v.phase_ids[0];
        const b = v.phase_ids[1];
        if (text.indexOf(a) !== -1) perturbed = text.replace(a, b);
        else if (text.indexOf(b) !== -1) perturbed = text.replace(b, a);
        else perturbed = text + ' (re-attributed to ' + b + ')';
      } else {
        perturbed = text.replace(/\bPhase\s+\d+(?:\.\d+)?/, 'Phase 0');
      }
      break;
    }
    case 'wrong_dependency': {
      if (v.module_names && v.module_names.length >= 2) {
        const a = v.module_names[0];
        const b = v.module_names[1];
        if (text.indexOf(a) !== -1) perturbed = text.replace(a, b);
        else if (text.indexOf(b) !== -1) perturbed = text.replace(b, a);
        else perturbed = text + ' (via ' + b + ')';
      } else {
        perturbed = text.replace(/Pinecone/, 'Neo4j');
      }
      break;
    }
    case 'wrong_metric': {
      if (v.numbers && v.numbers.length >= 1) {
        const original = v.numbers[0];
        const n = parseFloat(original);
        if (Number.isFinite(n)) {
          const swap = (n < 1) ? (n + 0.2).toFixed(1) : String(n + 5);
          perturbed = text.replace(original, swap);
        }
      } else {
        perturbed = text.replace(/\b\d+\b/, '99');
      }
      break;
    }
    case 'wrong_scope': {
      if (text.indexOf('public') !== -1) perturbed = text.replace('public', 'private');
      else if (text.indexOf('private') !== -1) perturbed = text.replace('private', 'public');
      else if (text.indexOf('only ') !== -1) perturbed = text.replace('only ', '');
      else perturbed = text + ' (under restricted scope)';
      break;
    }
    case 'wrong_invariant': {
      if (text.indexOf('always') !== -1) perturbed = text.replace('always', 'never');
      else if (text.indexOf('never') !== -1) perturbed = text.replace('never', 'always');
      else if (/\bis\b/.test(text)) perturbed = text.replace(/\bis\b/, 'is not');
      else if (/\bwill\b/.test(text)) perturbed = text.replace(/\bwill\b/, 'will not');
      else perturbed = text + ' (assumption inverted)';
      break;
    }
    default:
      perturbed = text;
  }
  return perturbed;
}

/**
 * Tier 2 axis bias: re-order PERTURBATION_AXES so axes that match weak_spots
 * topics are exercised first, axes that match strong_spots topics are pushed
 * later. The ordering is stable -- if no topic mappings hit, the canonical
 * round-robin order is preserved (no surprises in the cold-start slice of
 * a Tier 2 round). The mapping uses simple substring containment, not a
 * graph lookup; the topic vocabulary is closed (framework + relationship
 * handles per Canon Part 8).
 */
function tier2BiasedAxes(weakSpots, strongSpots) {
  const weakTopics = (Array.isArray(weakSpots) ? weakSpots : [])
    .map(s => (s && typeof s.topic === 'string') ? s.topic.toLowerCase() : '')
    .filter(s => s.length > 0);
  const strongTopics = (Array.isArray(strongSpots) ? strongSpots : [])
    .map(s => (s && typeof s.topic === 'string') ? s.topic.toLowerCase() : '')
    .filter(s => s.length > 0);

  // Heuristic mapping: each axis has affinity keywords. Score axes by
  // weak-topic match (positive) minus strong-topic match (negative).
  const axisAffinity = {
    wrong_owner: ['owner', 'phase', 'subject', 'attribution'],
    wrong_dependency: ['dependency', 'module', 'pinecone', 'neo4j', 'cascade'],
    wrong_metric: ['metric', 'threshold', 'number', 'score'],
    wrong_scope: ['scope', 'public', 'private', 'metadata'],
    wrong_invariant: ['invariant', 'always', 'never', 'edges'],
  };

  function score(axis) {
    const keys = axisAffinity[axis] || [];
    let s = 0;
    for (const k of keys) {
      for (const t of weakTopics) if (t.indexOf(k) !== -1) s += 1;
      for (const t of strongTopics) if (t.indexOf(k) !== -1) s -= 1;
    }
    return s;
  }

  // Stable sort by score descending; ties keep canonical order.
  const indexed = PERTURBATION_AXES.map((axis, i) => ({ axis, i, s: score(axis) }));
  indexed.sort((a, b) => (b.s - a.s) || (a.i - b.i));
  return indexed.map(e => e.axis);
}

/**
 * Generate the decoy set for a F.6 plan-review round.
 *
 * Signature (verbatim per RESEARCH.md DISCRETION-AMEND-02):
 *   selectDecoys({ artifactPath, roundSize=20, realCount, profile,
 *                  roleBlend, brainAvailable, tierOverride })
 *     -> { decoys, tier, tier_reason, distribution_seed }
 *
 * decoys: Array<{ position, content, was_decoy: true, perturbation_axis,
 *                 source_real_index }>
 *   position: -1 placeholder; the renderer assigns interleaved 1..N positions
 *             when composing the round (not this module's responsibility).
 *
 * Never throws. On any read error or malformed artifact, returns an empty
 * decoy set with the detected tier label preserved so the renderer can
 * still surface the round-state node.
 */
function selectDecoys(args) {
  const a = (args && typeof args === 'object') ? args : {};
  const artifactPath = a.artifactPath;
  const roundSize = (typeof a.roundSize === 'number' && a.roundSize >= 15 && a.roundSize <= 30)
    ? a.roundSize : 20;
  const realCount = (typeof a.realCount === 'number' && a.realCount >= 0 && a.realCount <= roundSize)
    ? a.realCount : Math.ceil(roundSize * 0.8);
  const decoyCount = roundSize - realCount;
  const profile = a.profile || null;
  const roleBlend = a.roleBlend || null;

  // decoy_opt_out preference -> empty decoy set. Tier label retained for
  // debrief telemetry; tier_reason explicitly states the user opt-out.
  if (profile && profile.preferences && profile.preferences.decoy_opt_out === true) {
    return {
      decoys: [],
      tier: 'tier-0',
      tier_reason: 'decoy_opt_out_user_preference',
      distribution_seed: '0000000000000000',
    };
  }

  const detected = detectTier({
    profile: profile,
    roleBlend: roleBlend,
    brainAvailable: a.brainAvailable,
    tierOverride: a.tierOverride,
  });

  const claims = loadArtifactClaims(artifactPath);

  // Distribution seed: deterministic-ish hash of inputs + wall-clock so
  // a re-run on the same artifact produces a different round, but the
  // shape is auditable (16 hex chars, never variable-length).
  const seed = crypto.createHash('sha256')
    .update(String(artifactPath || '') + '|' + String(roundSize) + '|' + String(Date.now()))
    .digest('hex').slice(0, 16);

  // Choose the axis ordering. Tier 2 biases by weak/strong spots; Tier 1
  // and Tier 0 use the canonical round-robin order verbatim from PERTURBATION_AXES.
  const axisOrder = (detected.tier === 'tier-2')
    ? tier2BiasedAxes(profile.weak_spots, profile.strong_spots)
    : PERTURBATION_AXES.slice();

  const decoys = [];
  for (let i = 0; i < decoyCount; i++) {
    const claim = claims[i % Math.max(1, claims.length)] || {
      text: 'placeholder claim ' + i,
      vocabulary_pool: {},
    };
    const axis = axisOrder[i % axisOrder.length];
    const content = perturbReal(claim, axis);
    decoys.push({
      position: -1,                  // renderer assigns interleaved position
      content: content,
      was_decoy: true,
      perturbation_axis: axis,
      source_real_index: i,
    });
  }

  return {
    decoys: decoys,
    tier: detected.tier,
    tier_reason: detected.reason,
    distribution_seed: seed,
  };
}

module.exports = {
  selectDecoys: selectDecoys,
  _internal: {
    detectTier: detectTier,
    perturbReal: perturbReal,
    loadArtifactClaims: loadArtifactClaims,
    extractVocab: extractVocab,
    tier2BiasedAxes: tier2BiasedAxes,
    PERTURBATION_AXES: PERTURBATION_AXES.slice(),
    TOPIC_COVERAGE_MIN: TOPIC_COVERAGE_MIN,
    PROFILE_MATURITY_MIN: PROFILE_MATURITY_MIN,
    PERSONA_AXIS_MIN: PERSONA_AXIS_MIN,
  },
};
