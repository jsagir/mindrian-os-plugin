/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 118-02 Plan 02 Task 2 -- six-hats-red-black agent (Agent 5 of 6 in
 * B1; agent_id 'six_hats_red_black' in lib/agents/mva/index.cjs).
 *
 * This agent is FULLY LOCAL -- zero network calls, zero Brain calls, zero
 * filesystem reads beyond this source file itself. The "intelligence" is a
 * curated registry of 12 questions patterned on Berger 2014's Beautiful
 * Questions framework + de Bono Red/Black hats. Deterministic selection by
 * sha256 modulo so the same sentence always gets the same question pair.
 *
 * Source spec line 67: "One question you haven't asked yourself" is the Red+
 * Black flag voicing, not a separate agent. This module IS that voicing.
 *
 * Graph-native HARD RULES:
 *   1. NEVER write to stdout / stderr (telemetry side-channel rule).
 *   2. NEVER call fetch / network APIs (Test 12 grep regression asserts).
 *   3. NEVER read user-content env vars (Canon Part 8).
 *
 * Pure CJS, node built-ins only, zero new runtime dependencies.
 */
'use strict';

/**
 * The 12 questions. Each carries:
 *   summary -- the "One question you haven't asked yourself: ..." voicing
 *   red     -- the intuitive flag (de Bono Red Hat: gut, emotion, instinct)
 *   black   -- the risk flag (de Bono Black Hat: critique, devil's advocate)
 *
 * Patterned on Berger 2014 ("A More Beautiful Question") + de Bono 1985
 * ("Six Thinking Hats"). These 12 are GENERIC; they apply to any early-stage
 * venture sentence. Canon Part 2 Engine 2: BONO orchestration.
 */
const QUESTION_REGISTRY = [
  {
    summary: "How does the person who currently manages this manually agree to adopt your product?",
    red: "Adoption resistance feels heavier here than the pitch deck suggests.",
    black: "The status-quo workflow has hidden switching costs you have not enumerated.",
  },
  {
    summary: "What does success look like in 90 days, and what evidence proves you got there?",
    red: "You will know whether this is working by feel within 30 days.",
    black: "Without a written 90-day evidence bar, success becomes whatever you want it to be.",
  },
  {
    summary: "If your strongest competitor copied your idea tomorrow, what's left that they can't replicate?",
    red: "Your unique angle is more replicable than you tell yourself.",
    black: "The moat thesis is thinner than the deck claims; identify the irreducible asset.",
  },
  {
    summary: "What single assumption would, if wrong, kill the entire thesis?",
    red: "You already know which assumption is the load-bearing one; you have been avoiding it.",
    black: "The thesis depends on a chain; one weak link voids the rest.",
  },
  {
    summary: "Who would be furious if this worked? Why?",
    red: "The incumbent's reaction will be faster and more political than you expect.",
    black: "Surface the parties whose budgets, status, or careers your success threatens.",
  },
  {
    summary: "What would have to be true for a stranger to pay you within 30 days?",
    red: "Cold-pay is the cleanest signal you can get; warm intros mask the truth.",
    black: "If your only buyers are friends or affiliates, your pricing power is fictional.",
  },
  {
    summary: "Where is the smartest critic you know, and what would they tear apart first?",
    red: "You already know who; the friction is asking.",
    black: "Avoiding the critic is the most expensive form of optimism.",
  },
  {
    summary: "What part of this would you keep building even if no one ever paid you for it?",
    red: "There is a small core you would build anyway; the rest is rationalization.",
    black: "The parts you would not build for free are the parts the market also will not pay for.",
  },
  {
    summary: "If you had to ship in two weeks with one feature, which one would it be?",
    red: "Your gut already picked the one feature; you have been adding the others to feel safer.",
    black: "Multi-feature MVPs hide which feature is actually load-bearing for the value claim.",
  },
  {
    summary: "What is the smallest experiment that would change your mind?",
    red: "If no experiment can change your mind, you have a religion, not a thesis.",
    black: "Define the falsifier in writing before you run the test; otherwise the result will rationalize either outcome.",
  },
  {
    summary: "Whose calendar do you need to be on this month for this to matter in twelve?",
    red: "The right meeting beats the right slide deck.",
    black: "Twelve-month traction requires this-month introductions; deferring the ask compounds the delay.",
  },
  {
    summary: "What does the second version of this idea look like, after the first one fails?",
    red: "You already see V2; you are clinging to V1 because of sunk effort.",
    black: "Without a written V2, every V1 setback feels existential and decisions get reactive.",
  },
];

/**
 * Deterministic index selection from a 64-hex sentence_sha256.
 * Uses the leading 8 hex chars (32-bit window) mod 12 -- uniform-enough for
 * 12 buckets that small biases don't matter, and same hash always picks the
 * same bucket so the test contract holds.
 *
 * @param {string} sha256
 * @returns {number}
 */
function selectIndex(sha256) {
  if (typeof sha256 !== 'string' || sha256.length === 0) return 0;
  const head = sha256.slice(0, 8);
  const n = parseInt(head, 16);
  if (!Number.isFinite(n) || Number.isNaN(n)) return 0;
  return n % QUESTION_REGISTRY.length;
}

/**
 * @param {{ sentence_sha256: string, remaining_budget_ms: number }} context
 * @param {AbortSignal} signal
 * @returns {Promise<{ status:'ok'|'empty', payload:any } | null>}
 */
async function run(context, signal) {
  if (signal && signal.aborted) return null;
  const sha = (context && typeof context.sentence_sha256 === 'string') ? context.sentence_sha256 : '';
  const idx = selectIndex(sha);
  const q = QUESTION_REGISTRY[idx];
  return {
    status: 'ok',
    payload: {
      summary_line: "One question you haven't asked yourself: " + q.summary,
      deck_data: {
        red_flag: q.red,
        black_flag: q.black,
      },
    },
  };
}

module.exports = { run, _test: { QUESTION_REGISTRY, selectIndex } };
