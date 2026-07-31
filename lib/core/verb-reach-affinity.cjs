'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 245-04 -- VERB_REACH_AFFINITY: the frozen canonical-verb to reach_id
 * affinity table (D-29, D-30) plus its zero-I/O runtime lookup.
 *
 * WHY THIS FILE EXISTS
 *
 * `reachIdToSkillFamily` (lib/core/navigation-engine.cjs) maps the 6 frozen
 * reach ids onto canonical verbs. Requirement 1's Brain-verb fusion term needs
 * the INVERSE: given a canonical verb, which reach does it key onto. That
 * inverse is NOT a bijection and cannot be obtained by flipping the switch:
 *
 *   - 'Run Methodology' inverts to TWO reach ids (`context_block` AND
 *     `brain_consult`). Picking one arbitrarily is a coin flip dressed as a
 *     mapping.
 *   - 5 of the 10 frozen CANONICAL_VERBS ('Reformulate', 'Scenario Plan',
 *     'Bank Opportunity', 'Defer', 'Free-Text') have NO reach id preimage at
 *     all. A fusion term that silently no-ops on half the vocabulary is not a
 *     fusion input.
 *
 * So the affinity is DERIVED semantically rather than hand-flipped, and the
 * 5 no-preimage verbs are recorded as an explicit `null` (the honest record of
 * a real coverage hole, per 245-RESEARCH.md F-8) instead of being silently
 * absent or papered over by minting a seventh reach.
 *
 * HOW THE TABLE IS PRODUCED (D-30, locked)
 *
 * At BUILD time, by scripts/derive-verb-reach-affinity.cjs, using the
 * already-shipped fully local encoder (lib/core/eureka/embedding-spine.cjs):
 * each canonical verb is embedded, each reach's REACH_EXEMPLARS set is
 * embedded, and the verb takes the MAX cosine against each reach's exemplar
 * set (nearest-neighbor over a curated reference set, exactly the
 * lib/core/eureka/embedding-classifier.cjs pattern at the ~40-term scale its
 * own header names as the design target). The result is committed HERE as a
 * frozen constant and read at runtime as a plain lookup.
 *
 * Zero runtime cost, deterministic across runs (which Requirement 4's
 * "reproducibly across runs" criterion demands), and Canon Part 7 compliant
 * (the encoder and the classifier pattern are reused, not rebuilt).
 *
 * WHAT IS DELIBERATELY NOT HERE
 *
 * No live Pinecone / brain_search leg (D-29, four independent blockers, each
 * sufficient on its own: the SPEC forbids a synchronous Brain call in the
 * per-turn path; the account has a real pinecone_quota_exhausted condition;
 * brain_search is Part-8-blocked today; and `pws-brain` holds the generic
 * teaching corpus, not project-specific reach or verb definitions).
 *
 * CANON PART 8 (Graph Boundary): this module opens NO wire. It requires
 * nothing under lib/core/eureka/, nothing from brain-client, and performs no
 * filesystem read beyond its own require. `verbReachAffinity` is pure and
 * synchronous. The build-time derivation's only network touch is the spine's
 * one-time generic model-weight download by model id; no verb, no reach, no
 * room content ever leaves the machine.
 *
 * CANON PART 3: CANONICAL_VERBS stays a closed 10-verb set and the Phase-148
 * six-reach set stays frozen. This module amends NEITHER. It only records how
 * the two frozen sets relate.
 *
 * No em-dashes anywhere in this file (repo convention).
 */

// ---------------------------------------------------------------------------
// The frozen six-reach id set, mirrored locally as a literal.
//
// Deliberately NOT required from lib/hmi/dial-reach-orchestrator.cjs: that
// module pulls the hedge ranker and its dependency tree, and this file's whole
// contract is that the runtime lookup is a zero-I/O leaf. The literal is kept
// honest by tests/test-245-verb-affinity.cjs, which asserts set equality
// against the orchestrator's own REACH_DEFS.
// ---------------------------------------------------------------------------
const REACH_IDS = Object.freeze([
  'context_block',
  'contradiction',
  'cross_room',
  'brain_consult',
  'deep_research',
  'hats',
]);

// ---------------------------------------------------------------------------
// REACH_EXEMPLARS -- what each reach MEANS, in short English phrases.
//
// These are the semantic reference set the build-time derivation embeds. Every
// phrase is sourced from one of THREE in-repo authorities, cited per reach:
//   (A) reachIdToSkillFamily's per-case doc prose, lib/core/navigation-engine.cjs
//   (B) REACH_DEFS' canonical_verb labels, lib/hmi/dial-reach-orchestrator.cjs
//   (C) the Capability Dial table + Reach ids list, skills/larry-personality/SKILL.md
//
// NOT sourced from any sensor's keyword vocabulary. Sourcing sensor trigger
// vocab from canonical docs is a DEFERRED idea and explicitly out of scope for
// this table (245-04-PLAN objective, scope boundary).
// ---------------------------------------------------------------------------
const REACH_EXEMPLARS = Object.freeze({
  // (B) 'Context Block'; (C) dial row 1; (A) context_block -> 'Run Methodology'
  context_block: Object.freeze([
    'context block',
    'retrieve a dated context block from the room',
    'recall what we decided earlier in this room',
    'long-term memory of prior work and dated facts',
    'search the room for facts not in the recent messages',
    'run the methodology step the room already established',
  ]),

  // (B) 'contradiction surface'; (C) dial row 2; (A) contradiction -> "Devil's Advocate"
  contradiction: Object.freeze([
    'contradiction surface',
    'a new claim conflicts with an existing claim',
    'surface the conflicting pair and which fact superseded which',
    'play devil advocate against the claim',
    'a fact has been closed or superseded by a newer one',
  ]),

  // (B) 'cross-room reach'; (C) dial row 3; (A) cross_room -> 'Navigate Graph'
  cross_room: Object.freeze([
    'cross-room reach',
    'navigate the graph into a different room',
    'this thread connects to a different room',
    'read the target room own graph within its own scope',
    'switch rooms once the navigator acknowledges the switch',
  ]),

  // (B) 'Brain consult'; (C) dial row 4; (A) brain_consult -> 'Run Methodology'
  brain_consult: Object.freeze([
    'brain consult',
    'consult the teaching brain for generic methodology',
    'a framework is named and its next move is needed',
    'framework chains phase progressions and problem-type fit',
    'run the methodology the calibrated teaching graph suggests',
  ]),

  // (B) 'framework-led deep research plan'; (C) dial row 5; (A) deep_research -> 'Spawn Sub-Agent'
  deep_research: Object.freeze([
    'framework-led deep research plan',
    'spawn a sub-agent to research an external topic',
    'state of the art competitor or market facts are needed',
    'hat-scoped web research executed under an approved plan',
    'a load-bearing claim near a commit lacks evidence',
  ]),

  // (B) 'research personas hat-spin'; (C) dial row 6; (A) hats -> 'Synthesize'
  hats: Object.freeze([
    'research personas hat-spin',
    'six thinking hats synthesis pass',
    'add the missing perspective the team is not holding',
    'blue hat synthesis that wraps a hats pass',
    'spin several research personas over one question',
  ]),
});

// ---------------------------------------------------------------------------
// AFFINITY_MARGIN -- the top1-minus-top2 cosine margin below which a verb is
// treated as TIED (an even split across the tied reaches) rather than won
// outright, and below which in ABSOLUTE terms a verb is treated as having no
// reach preimage at all (null).
//
// TUNABLE-LATER. Reason: 0.05 is a low-data starting point carried over from
// the sibling embedding classifier's DEFAULT_MARGIN discipline
// (lib/core/eureka/embedding-classifier.cjs), not a value calibrated against a
// verb/reach outcome corpus, because no such corpus exists yet. Revisit once
// the fusion term in 245-07 has produced enough outcome edges to measure
// whether the split verbs actually behave as ties in practice.
//
// Env override MINDRIAN_AFFINITY_MARGIN, parsed defensively: anything
// non-numeric, non-finite, non-positive, or >= 1 silently falls back to the
// default. Same "garbage falls back, never warns, never throws" discipline as
// BRAIN_STALE_AGE_DAYS in lib/core/brain-md-staleness.cjs and updateEta /
// updateN in lib/workflow/reach-hedge-ranker.cjs.
// ---------------------------------------------------------------------------
const DEFAULT_AFFINITY_MARGIN = 0.05;

function resolveAffinityMargin() {
  const raw = process.env.MINDRIAN_AFFINITY_MARGIN;
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return DEFAULT_AFFINITY_MARGIN;
  }
  const n = Number(String(raw).trim());
  if (Number.isFinite(n) && n > 0 && n < 1) return n;
  return DEFAULT_AFFINITY_MARGIN;
}

const AFFINITY_MARGIN = resolveAffinityMargin();

// ---------------------------------------------------------------------------
// VERB_REACH_AFFINITY -- the frozen 10-verb table.
//
// Key set is EXACTLY the 10 entries of CANONICAL_VERBS
// (lib/core/navigation-engine-shared.cjs). Each value is either:
//   null  -- no reach preimage; the documented no-op for that verb, OR
//   a frozen { reach_id: weight } map whose weights are in (0, 1] and sum to 1.
//
// GENERATED BLOCK. scripts/derive-verb-reach-affinity.cjs rewrites everything
// between the sentinel comments below and leaves the rest of this file
// untouched. The values currently between the sentinels are the hand-authored
// fallback committed by 245-04 Task 1: the inversion of reachIdToSkillFamily,
// with 'Run Methodology' resolved to the principled even split across its two
// genuine preimages rather than an arbitrary pick, and the 5 no-preimage verbs
// as explicit null. 245-RESEARCH.md states this fallback is fully sufficient
// for the SPEC's acceptance criteria on its own, so the phase is NEVER blocked
// on the encoder being available.
// ---------------------------------------------------------------------------
// <<< GENERATED:VERB_REACH_AFFINITY >>>
const VERB_REACH_AFFINITY = Object.freeze({
  'Run Methodology': Object.freeze({ context_block: 0.5, brain_consult: 0.5 }),
  'Reformulate': null,
  'Spawn Sub-Agent': Object.freeze({ deep_research: 1 }),
  'Navigate Graph': Object.freeze({ cross_room: 1 }),
  "Devil's Advocate": Object.freeze({ contradiction: 1 }),
  'Scenario Plan': null,
  'Synthesize': Object.freeze({ hats: 1 }),
  'Bank Opportunity': null,
  'Defer': null,
  'Free-Text': null,
});
// <<< END GENERATED:VERB_REACH_AFFINITY >>>

/**
 * verbReachAffinity(verb) -> frozen { reach_id: weight } | null
 *
 * The ONLY thing the runtime ever calls. Pure, synchronous, zero I/O.
 *
 * Returns null (never throws, never partially applies) for:
 *   - a non-string input (null, undefined, 0, {}, [])
 *   - an empty or whitespace-only string
 *   - a string outside the frozen CANONICAL_VERBS set
 *   - a canonical verb whose committed entry is null (no reach preimage)
 *
 * A null return is the documented no-op: the caller contributes no verb term
 * for that turn rather than guessing one.
 */
function verbReachAffinity(verb) {
  if (typeof verb !== 'string') return null;
  if (verb.trim() === '') return null;
  if (!Object.prototype.hasOwnProperty.call(VERB_REACH_AFFINITY, verb)) return null;
  const entry = VERB_REACH_AFFINITY[verb];
  return entry === null ? null : entry;
}

module.exports = {
  VERB_REACH_AFFINITY: VERB_REACH_AFFINITY,
  verbReachAffinity: verbReachAffinity,
  REACH_EXEMPLARS: REACH_EXEMPLARS,
  REACH_IDS: REACH_IDS,
  AFFINITY_MARGIN: AFFINITY_MARGIN,
  DEFAULT_AFFINITY_MARGIN: DEFAULT_AFFINITY_MARGIN,
  resolveAffinityMargin: resolveAffinityMargin,
};
