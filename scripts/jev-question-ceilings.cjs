'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * scripts/jev-question-ceilings.cjs -- Phase 355 Plan 07 (HIPS-08, HIPS-09,
 * D-44, D-46, D-55). Dev-time only. Never required from lib/ or hooks/
 * (tripwire: tests/test-353-tripwires.cjs leg 2, this file's own name is
 * appended to HOOKS_BANNED_LEDGER_SCRIPTS in the same commit that creates
 * it, per the Phase 356 peer contract).
 *
 * Owns the pinned model, the three frozen questions (thinking mode,
 * citation check, usefulness judge), and one per-question closure ceiling
 * composed on top of the matching scripts/jev-devtime-client.cjs
 * EGRESS_PROFILES entry: composeGuard(makeEgressGuard(EGRESS_PROFILES.<id>),
 * closure). The profile guard enforces shape (top-level keys, model,
 * state/question key sets, string lengths); the closure adds the
 * membership/equality check a bare shape guard cannot express (a sentence
 * really is a fixture member, a claim really is the template, a path
 * really is what Theo returned, an excerpt really is byte-equal to a known
 * pairing).
 *
 * D-01 / D-46: direction ids and phrases come from
 * lib/core/direction-convention.cjs, the ONE module that owns them
 * (structural_transfer / semantic_implementation). The AI-SPEC's Section 3
 * illustrative code used two placeholder direction ids, written before that
 * module existed; this file supersedes both placeholders with the real,
 * already-wired ids and their confirmed DIRECTION_MEANING phrases.
 *
 * T-355-29 (non-Framework nodes render by label class, never by internal
 * id): hopsFromTheoPath mirrors lib/core/verification-stamp.cjs's own
 * `_renderNodes` -- any path node whose pathLabels entry is not
 * 'Framework' renders as '[' + label + ']', never the raw node name (which
 * can be an internal Theo record id for a BrainRecord/DomainConcept node).
 *
 * No em-dashes (CLAUDE.md HARD RULE). Hyphens only.
 */

const crypto = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const { makeEgressGuard, EGRESS_PROFILES } = require('./jev-devtime-client.cjs');
const { DIRECTIONS, DIRECTION_MEANING, NONE } = require('../lib/core/direction-convention.cjs');

// Finding 2: pin the version, never the alias (docs.typesafe.ai/models.md
// "Listing models" / "Aliases").
const PINNED_MODEL = 'jev-1.13.0';

// ---------------------------------------------------------------------------
// composeGuard(profileGuard, closure): runs the profile shape guard first
// (so an obviously-wrong payload is refused before the closure ever reads
// it), then the closure's own membership/equality check. Both must return
// true; either may throw. Used with jev() as { guard: composeGuard(...) }.
// ---------------------------------------------------------------------------
function composeGuard(profileGuard, closure) {
  return function composedGuard(payload) {
    profileGuard(payload);
    closure(payload);
    return true;
  };
}

// ---------------------------------------------------------------------------
// renderClaim(from, to, direction): the citation claim is TEMPLATED from
// two canon Framework names and the confirmed DIRECTION_MEANING phrase
// only. No free text exists to leak (D-46).
// ---------------------------------------------------------------------------
function renderClaim(from, to, direction) {
  if (direction === NONE || !DIRECTIONS.includes(direction)) {
    throw new Error('renderClaim: unknown direction "' + direction + '"');
  }
  return from + ' and ' + to + ': ' + DIRECTION_MEANING[direction] + '.';
}

// ---------------------------------------------------------------------------
// hopsFromTheoPath({ path, pathLabels, edges }): named {from, relation, to}
// hops so Jev never has to line up two parallel arrays (jaggedness #4,
// "Indirection: point to the relevant state by name"). Edge types render
// as plain lower-cased words. A non-Framework node renders by label class
// only, mirroring lib/core/verification-stamp.cjs's `_renderNodes`
// (T-355-29): never a BrainRecord/DomainConcept internal id.
// ---------------------------------------------------------------------------
function hopsFromTheoPath(theoPath) {
  const path = theoPath.path;
  const pathLabels = theoPath.pathLabels;
  const edges = theoPath.edges;
  const renderNode = (i) => {
    const label = pathLabels ? pathLabels[i] : undefined;
    if (label === 'Framework') return path[i];
    return '[' + (label !== undefined ? label : path[i]) + ']';
  };
  const hops = [];
  for (let i = 0; i < edges.length; i += 1) {
    hops.push({
      from: renderNode(i),
      relation: String(edges[i]).toLowerCase().replace(/_/g, ' '),
      to: renderNode(i + 1),
    });
  }
  return hops;
}

// ---------------------------------------------------------------------------
// questionSha256(questions): a stable 64-hex sha256 of the canonical JSON
// (keys sorted at every level), so criteria drift is detectable by a
// changed hash rather than silent scope creep.
// ---------------------------------------------------------------------------
function _canonicalize(value) {
  if (Array.isArray(value)) return value.map(_canonicalize);
  if (value && typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value).sort()) out[k] = _canonicalize(value[k]);
    return out;
  }
  return value;
}
function questionSha256(questions) {
  const canonical = JSON.stringify(_canonicalize(questions));
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

// =============================================================================
// Thinking-mode Choice: five modes + none (Finding 3, Reference Dataset ii).
// Boundary cases live in criteria as {what, not_for, examples}
// (primitives/choice.md "Structured instructions and criteria"). Examples
// are written fresh for the criteria and must NEVER be drawn from the gold
// fixture or the tuning set (train/test leak) -- proved by a test leg
// against tests/fixtures/355-hsi-thinking-mode-sentences.items.json and
// tests/fixtures/355-hsi-tuning-sentences.json when both exist.
// =============================================================================
const THINKING_MODE_LABELS = Object.freeze(['analytical', 'integrative', 'descriptive', 'evaluative', 'creative', 'none']);

const THINKING_MODE_QUESTIONS = Object.freeze({
  mode: Object.freeze({
    type: 'choice',
    instructions: Object.freeze({
      question: 'Which thinking mode does `sentence` express?',
      rule: 'Judge what the sentence does, not which words it uses. Pick none when no mode applies.',
    }),
    criteria: Object.freeze({
      analytical: Object.freeze({
        what: 'Reasons from evidence, causes or measurement to a conclusion',
        not_for: 'A recommendation or value judgment that merely mentions data',
        examples: Object.freeze(['Churn rose after onboarding stretched past three weeks.']),
      }),
      integrative: Object.freeze({
        what: 'Connects ideas, methods or domains that were separate',
        not_for: 'Proposing a brand-new possibility with no existing link named',
        examples: Object.freeze(['The kitchen expediter role maps onto how we triage support tickets.']),
      }),
      descriptive: Object.freeze({
        what: 'States what something is, has or contains, without judging or reasoning',
        not_for: 'A sentence that uses "is" to deliver a judgment, such as "this is a risk"',
        examples: Object.freeze(['The clinic runs two shifts and one on-call rotation.']),
      }),
      evaluative: Object.freeze({
        what: 'Judges value, risk, priority or what should be done',
        not_for: 'A neutral description that happens to contain the word important',
        examples: Object.freeze(['We should retire the legacy intake form before the next cycle.']),
      }),
      creative: Object.freeze({
        what: 'Proposes a new possibility, reframe or what-if',
        not_for: 'Naming an existing connection between two fields',
        examples: Object.freeze(['What if the waiting area were treated as part of the treatment?']),
      }),
      none: Object.freeze({
        what: 'Expresses no thinking mode: a greeting, logistics, a fragment or a heading',
        examples: Object.freeze(['Thanks, talk Thursday.', 'Section 4: Timeline']),
      }),
    }),
  }),
});

// ---------------------------------------------------------------------------
// makeSentenceCeiling(fixtureSentences: Set<string>): membership in the
// dev-time fixture is the proof a sentence is not user text.
// ---------------------------------------------------------------------------
function makeSentenceCeiling(fixtureSentences) {
  const closure = function sentenceClosure(payload) {
    const state = payload.state || {};
    if (!(fixtureSentences instanceof Set) || !fixtureSentences.has(state.sentence)) {
      throw new Error('sentenceCeiling: not a dev-time fixture sentence; refusing to send');
    }
    if (!isDeepStrictEqual(payload.questions, THINKING_MODE_QUESTIONS)) {
      throw new Error('sentenceCeiling: questions are not the frozen thinking-mode question');
    }
    return true;
  };
  return composeGuard(makeEgressGuard(EGRESS_PROFILES.hsi_thinking_mode), closure);
}

// =============================================================================
// Citation-check Choice. Option glosses adapted from
// cookbooks/citation_check.md ("How does the section relate to the
// claim?"). The RULE is a DRAFT the calibration run (355-26) tests stated
// vs withheld (Finding 7); a stated rule is the default here (the spike's
// 64/64 vs 40/64 result, policy-execution-parity.md).
// =============================================================================
const CITATION_CRITERIA = Object.freeze({
  supports: 'The hops in `path` state the relation in `claim` or directly imply that it is true',
  contradicts: 'A hop in `path` states the opposite of the relation in `claim` or implies it is false',
  says_nothing: 'The hops in `path` do not address the relation `claim` asserts, either way',
});
const CITATION_RULE =
  'Apply in this order. (1) If a hop in `path` states a relation opposite to the one `claim` asserts, answer contradicts. ' +
  '(2) Else if the hops, read in order, directly show the relation `claim` asserts, answer supports. ' +
  '(3) Else answer says_nothing. A path that joins the two frameworks only through a broad shared node ' +
  '(a problem type, a stage, a general category) says nothing.';
const CITATION_QUESTIONS_STATED = Object.freeze({
  relation: Object.freeze({
    type: 'choice',
    instructions: Object.freeze({ question: 'How does `path` relate to `claim`?', rule: CITATION_RULE }),
    criteria: CITATION_CRITERIA,
  }),
});
const CITATION_QUESTIONS_WITHHELD = Object.freeze({
  relation: Object.freeze({
    type: 'choice',
    instructions: Object.freeze({ question: 'How does `path` relate to `claim`?' }),
    criteria: CITATION_CRITERIA,
  }),
});

// ---------------------------------------------------------------------------
// makeCitationCeiling({ from, to, direction, theoPath }): closes over the
// exact Theo answer, so only Framework names Theo itself returned, one
// enum phrase, and Theo's edge types can cross. Anything else throws
// before fetch().
// ---------------------------------------------------------------------------
function makeCitationCeiling({ from, to, direction, theoPath }) {
  const claim = renderClaim(from, to, direction);
  const hops = hopsFromTheoPath(theoPath);
  const closure = function citationClosure(payload) {
    const state = payload.state || {};
    if (state.claim !== claim) throw new Error('citationCeiling: claim is not the templated name + direction string');
    if (!isDeepStrictEqual(state.path, hops)) throw new Error('citationCeiling: path is not the hop list Theo returned');
    if (!isDeepStrictEqual(payload.questions, CITATION_QUESTIONS_STATED) && !isDeepStrictEqual(payload.questions, CITATION_QUESTIONS_WITHHELD)) {
      throw new Error('citationCeiling: questions are not a frozen citation-check set');
    }
    return true;
  };
  return composeGuard(makeEgressGuard(EGRESS_PROFILES.citation_check), closure);
}

// =============================================================================
// Usefulness-judge Choice: would a domain reader act on this pairing to
// extend the opportunity? Priority order stated in instructions.rule
// (already_known first, since a standard-practice link is the most common
// false positive; then useful; then not_useful; escape to none when the
// excerpts are not actually a pairing).
// =============================================================================
const USEFULNESS_CRITERIA = Object.freeze({
  useful: Object.freeze({
    what: "One side offers a mechanism the other side's problem could borrow",
    not_for: 'A pairing that only shares vocabulary, not a transferable mechanism',
  }),
  not_useful: Object.freeze({
    what: 'The two excerpts only share vocabulary, or the pairing suggests no concrete action',
    not_for: 'A pairing where one excerpt genuinely offers the other a borrowable mechanism',
  }),
  already_known: Object.freeze({
    what: 'The link is standard practice in both fields already',
    not_for: 'A link that is novel to at least one field',
  }),
  none: Object.freeze({
    what: 'The excerpts are not actually a pairing (no shared subject)',
    not_for: 'A pairing that is merely weak or already known',
  }),
});
const USEFULNESS_RULE =
  'Apply in this order. (1) If the link is standard practice in both fields, answer already_known. ' +
  "(2) Else if one side offers a mechanism the other side's problem could borrow, answer useful. " +
  '(3) Else if the two excerpts only share vocabulary or the pairing suggests no action, answer not_useful. ' +
  '(4) Else, when the excerpts are not a pairing at all, answer none.';
const USEFULNESS_QUESTIONS = Object.freeze({
  usefulness: Object.freeze({
    type: 'choice',
    instructions: Object.freeze({
      question: 'Would a domain reader act on this pairing to extend the opportunity?',
      rule: USEFULNESS_RULE,
    }),
    criteria: USEFULNESS_CRITERIA,
  }),
});

// ---------------------------------------------------------------------------
// makeUsefulnessCeiling(pairMap: Map<pair_id, {a_excerpt, b_excerpt,
// direction_phrase}>): the profile's state_keys carry no pair_id, so the
// closure proves membership by content -- the sent a_excerpt/b_excerpt/
// direction_phrase must be byte-equal to SOME known pairing in the map.
// verification must be one of the three real Stamp tiers (D-54).
// ---------------------------------------------------------------------------
const _VALID_VERIFICATIONS = Object.freeze(['strong', 'indirect', 'unverified']);
function makeUsefulnessCeiling(pairMap) {
  const closure = function usefulnessClosure(payload) {
    const state = payload.state || {};
    if (!_VALID_VERIFICATIONS.includes(state.verification)) {
      throw new Error('usefulnessCeiling: verification must be one of strong/indirect/unverified');
    }
    let matched = false;
    if (pairMap && typeof pairMap.values === 'function') {
      for (const item of pairMap.values()) {
        if (item.a_excerpt === state.a_excerpt && item.b_excerpt === state.b_excerpt && item.direction_phrase === state.direction_phrase) {
          matched = true;
          break;
        }
      }
    }
    if (!matched) throw new Error('usefulnessCeiling: a_excerpt/b_excerpt/direction_phrase are not byte-equal to any known pairing');
    if (!isDeepStrictEqual(payload.questions, USEFULNESS_QUESTIONS)) {
      throw new Error('usefulnessCeiling: questions are not the frozen usefulness question');
    }
    return true;
  };
  return composeGuard(makeEgressGuard(EGRESS_PROFILES.usefulness_judge), closure);
}

module.exports = {
  PINNED_MODEL,
  THINKING_MODE_LABELS,
  THINKING_MODE_QUESTIONS,
  CITATION_RULE,
  CITATION_QUESTIONS_STATED,
  CITATION_QUESTIONS_WITHHELD,
  USEFULNESS_QUESTIONS,
  renderClaim,
  hopsFromTheoPath,
  makeSentenceCeiling,
  makeCitationCeiling,
  makeUsefulnessCeiling,
  composeGuard,
  questionSha256,
};
