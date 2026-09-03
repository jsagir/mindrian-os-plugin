'use strict';

/*
 * Phase 267.2 W1a/W1c -- Greeting intent classifier (HOOK-05, HOOK-06)
 *
 * Local, LLM-free, network-free additive-score classifier for a first-install
 * user's opening free-text sentence. Same shape as Phase 115's
 * lib/core/dual-path-detector.cjs (the named precedent CONTEXT.md D-01
 * cites): pure function, node built-ins only, no npm dependency, no I/O.
 *
 * Buckets (real scored classes, three of them) plus one derived class:
 *   new_venture  -- starting something new, no prior material referenced
 *   prior_work   -- continuing or curating existing work, prior material
 *                   referenced
 *   just_talk    -- wants a thinking partner, no build intent
 *   ambiguous    -- derived: signal margin below threshold, or a scoring tie
 *                   (never a scored class of its own -- see the decision
 *                   rule below)
 *
 * Named signal constants and their weights (fixed by decision D-C):
 *   NEW_INTENT             -> new_venture           +3
 *   PRIOR_WORK_INTENT      -> prior_work             +3
 *   JUST_TALK_INTENT       -> just_talk              +3
 *   ARTIFACT_REFERENCE     -> prior_work             +2
 *   FIRST_TIME_ORIENTATION -> just_talk              +2
 *   HESITATION             -> new_venture            -3 (NEGATIVE WEIGHT)
 *
 * HESITATION is the mandatory negative-weight feature, the same role
 * dual-path-detector's STUCK_LANGUAGE (-3) plays: a deliberate safety net
 * pulling AWAY from the most aggressive outcome. Here the aggressive outcome
 * is firing /mos:ignite on someone who is thinking out loud -- without this
 * feature a hesitant sentence containing a build verb like "start" would
 * route a browsing user straight into room creation.
 *
 * Decision rule (deliberately NOT the lib/core/user-archetype.cjs tie-break,
 * per decision D-G -- that module's `score > maxScore` loop silently
 * resolves a tie to the first-declared key, which is research finding C-3's
 * wrong answer):
 *   margin     = highest score minus second-highest score, over the three
 *                real scored buckets.
 *   confidence = 'high' when margin >= 3, 'medium' when margin >= 2,
 *                otherwise 'low'.
 *   bucket     = the highest-scoring bucket ONLY when its score >= 3 AND
 *                margin >= 2. Otherwise 'ambiguous'. A tie (margin 0) always
 *                falls through to 'ambiguous', never the first-declared key.
 *
 * Canon Part 8 contract: classify()'s return value is an enum plus integers
 * plus booleans, with NO matched substring of the input ever appearing in
 * `features` or anywhere else in the return value. This is what makes the
 * payload safe to carry in telemetry (plan 267.2-06's routing instrumentation,
 * HOOK-08) without a second review of what leaves the classifier.
 *
 * Bounded input: every regex below uses explicit alternations and word
 * boundaries only, never a nested unbounded quantifier, so a hostile or
 * degenerate opening sentence cannot trigger catastrophic backtracking
 * inside a hook budget (a self-inflicted denial of service on session start).
 * The input is also truncated to the first 2000 characters before any regex
 * runs; `features.char_count` still records the untruncated length.
 *
 * Absolutely forbidden in this file, per decisions D-07 and D-K: any
 * require of the shared Brain client chokepoint or its lower-level MCP
 * client, any built-in HTTP/HTTPS transport module, and any browser-style
 * network call primitive; any Brain-specific or Theo-specific query shape;
 * any filesystem read or write; any read of the process environment. The
 * classifier decides, and nothing else -- Theo's cutover requires zero
 * changes to this file. (The exact forbidden tokens are enforced by a
 * source grep in tests/test-267-2-greeting-classifier.cjs, deliberately not
 * spelled out verbatim here so this comment cannot trip its own guard.)
 */

const MAX_SCORE_CHARS = 2000;

const NEW_INTENT = /\b(start(?:ing)?\s+(?:a\s+|something\s+|my\s+own\s+)?new|new\s+(?:venture|project|idea|business|company|startup)|launch(?:ing)?\s+(?:a\s+)?(?:new\s+)?(?:venture|project|idea|business|startup)|build(?:ing)?\s+something\s+new|kick(?:ing)?\s+off\s+(?:a\s+)?new|found(?:ing)?\s+a\s+(?:company|startup))\b/i;

const PRIOR_WORK_INTENT = /\b(continu(?:e|ing)\s+(?:my|our|the|work(?:ing)?)|pick(?:ing)?\s+(?:(?:this|it|that)\s+)?(?:back\s+)?up|where\s+(?:i|we)\s+left\s+off|already\s+(?:working|have)\s+(?:on|a)|existing\s+(?:project|venture|work)|resum(?:e|ing)\s+(?:my|our|work)|curat(?:e|ing)\s+(?:my|our)|review(?:ing)?\s+(?:my|our|some)\s+(?:notes|work|progress|deck))\b/i;

const JUST_TALK_INTENT = /\b(just\s+want(?:ed)?\s+to\s+talk|think(?:ing)?\s+out\s+loud|just\s+(?:chat|talk|browsing|exploring)|sounding\s+board|pick\s+your\s+brain|kick\s+(?:some\s+)?ideas\s+around|no\s+agenda)\b/i;

const ARTIFACT_REFERENCE = /\b(my\s+(?:cv|resume|deck|pitch\s+deck|notes|repo|repository|codebase|draft|manuscript|slides))\b/i;

const FIRST_TIME_ORIENTATION = /\b(first\s+time\s+(?:here|using|trying)|new\s+(?:here|to\s+this)|never\s+used\s+this\s+before|not\s+sure\s+(?:how|what)\s+(?:this|to)|how\s+does\s+this\s+work|what\s+is\s+this\s+(?:thing|tool|app))\b/i;

const HESITATION = /\b(i'?m\s+not\s+sure|i\s+don'?t\s+know\s+(?:if|yet|where)|maybe\s+(?:i|we)|just\s+thinking\s+about\s+it|haven'?t\s+decided|still\s+figuring\s+out|not\s+ready\s+(?:yet|to))\b/i;

const BUCKETS = Object.freeze(['new_venture', 'prior_work', 'just_talk', 'ambiguous']);

const OUTCOMES = Object.freeze(['ignite', 'larry', 'clarify']);

// Decision D-C's fixed routing table. `ambiguous -> larry`, not `clarify`:
// a clarifying question on an ambiguous FIRST sentence is a user-input ask
// before any reward has landed, the exact ordering
// docs/reward-before-investment-rule.md exists to prevent. `clarify` is
// reached by exactly one bucket, `prior_work`.
const ROUTING_TABLE = Object.freeze({
  new_venture: 'ignite',
  prior_work: 'clarify',
  just_talk: 'larry',
  ambiguous: 'larry',
});

/**
 * Returns the outcome for a bucket. Returns the 'larry' outcome for an
 * unknown or missing bucket rather than throwing, because this is called
 * from a hook that must never block the session on a bad input.
 * @param {string} bucket
 * @returns {string}
 */
function route(bucket) {
  return ROUTING_TABLE[bucket] || 'larry';
}

/**
 * Classifies a first-install user's opening free-text sentence into one of
 * BUCKETS. Pure, synchronous, no I/O, no network.
 * @param {string} text
 * @returns {{ bucket: string, scores: object, margin: number, confidence: string, features: object }}
 */
function classify(text) {
  if (!text || typeof text !== 'string') {
    return {
      bucket: 'ambiguous',
      scores: { new_venture: 0, prior_work: 0, just_talk: 0 },
      margin: 0,
      confidence: 'low',
      features: {},
    };
  }

  const trimmed = text.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const charCount = text.length;
  const truncated = text.length > MAX_SCORE_CHARS ? text.slice(0, MAX_SCORE_CHARS) : text;

  const scores = { new_venture: 0, prior_work: 0, just_talk: 0 };
  const features = {
    word_count: wordCount,
    char_count: charCount,
    new_intent: false,
    prior_work_intent: false,
    just_talk_intent: false,
    artifact_reference: false,
    first_time_orientation: false,
    hesitation: false,
  };

  features.new_intent = NEW_INTENT.test(truncated);
  if (features.new_intent) scores.new_venture += 3;

  features.prior_work_intent = PRIOR_WORK_INTENT.test(truncated);
  if (features.prior_work_intent) scores.prior_work += 3;

  features.just_talk_intent = JUST_TALK_INTENT.test(truncated);
  if (features.just_talk_intent) scores.just_talk += 3;

  features.artifact_reference = ARTIFACT_REFERENCE.test(truncated);
  if (features.artifact_reference) scores.prior_work += 2;

  features.first_time_orientation = FIRST_TIME_ORIENTATION.test(truncated);
  if (features.first_time_orientation) scores.just_talk += 2;

  features.hesitation = HESITATION.test(truncated);
  if (features.hesitation) scores.new_venture -= 3; // NEGATIVE WEIGHT safety net

  const ranked = Object.entries(scores).sort(function (a, b) { return b[1] - a[1]; });
  const topBucket = ranked[0][0];
  const topScore = ranked[0][1];
  const secondScore = ranked[1] ? ranked[1][1] : 0;
  const margin = topScore - secondScore;

  let confidence = 'low';
  if (margin >= 3) confidence = 'high';
  else if (margin >= 2) confidence = 'medium';

  // Never inherit user-archetype.cjs's `score > maxScore` construct: a tie
  // (margin 0) or a thin margin (< 2) both fall through to 'ambiguous',
  // regardless of which bucket the stable sort happened to rank first.
  let bucket = 'ambiguous';
  if (topScore >= 3 && margin >= 2) bucket = topBucket;

  return { bucket, scores, margin, confidence, features };
}

module.exports = {
  classify,
  route,
  BUCKETS,
  OUTCOMES,
  ROUTING_TABLE,
  NEW_INTENT,
  PRIOR_WORK_INTENT,
  JUST_TALK_INTENT,
  ARTIFACT_REFERENCE,
  FIRST_TIME_ORIENTATION,
  HESITATION,
};
