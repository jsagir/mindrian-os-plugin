'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 314-03 -- the portfolio movement OFFER composer.
 *
 * WHAT THIS IS
 *   A sibling of composeEurekaOffer (lib/core/eureka/eureka-offer.cjs), kept in
 *   its own file per D-06. It turns one stored portfolio movement envelope
 *   (plan 314-01 closed schema) into ONE offer object, or null. It never
 *   returns a list and never executes anything.
 *
 * THE OFFER
 *   { text, scope, counts, command, next: { command } }
 *   text is one fixed template filled with digits and fixed words only:
 *     'Your opportunity portfolio moved since the last run: <summary>. Want to
 *      look at the full read?'
 *   No handle, no label and no id enters the text. An opaque node id means
 *   nothing to a navigator, and nothing from the room may leave through here
 *   (Canon Part 8). The token-whitelist test arm is the fence.
 *
 * GATE
 *   The payload must pass validateEnvelope from portfolio-movement.cjs (the one
 *   closed-schema check; no second validator is written here), its encoder_kind
 *   must be 'live' and its counts must sum above 0. Any other payload is an
 *   abstention: a wrong offer trains the ignore reflex.
 *
 * NO BRAIN LEG, NO CHAIN
 *   composeEurekaOffer asks the chain recommender for a next segue because a
 *   bridge needs a method. A portfolio movement has one obvious next step, the
 *   command that shows the full read, so the offer names that command directly.
 *   This module requires no Brain client, no chain runner and no network. It
 *   composes content and stops (recommend, never trigger).
 *
 * LOCKSTEP
 *   lib/hmi/dial-label-composer.cjs is render-only and never requires another
 *   module, so it carries the same sentence written out literally. The test
 *   tests/test-314-label-lockstep.cjs holds the two in step.
 *
 * VOICE (Canon Part 12)
 *   An observation plus a question. No grade, no praise, no imperative.
 *
 * House rule: hyphens only, no em-dashes. CJS only. Synchronous.
 */

const { validateEnvelope } = require('./portfolio-movement.cjs');

const NEXT_COMMAND = '/mos:eureka-portfolio';

const OFFER_LABEL_PREFIX = 'Your opportunity portfolio moved since the last run: ';
const OFFER_QUESTION = ' Want to look at the full read?';

// Every word the fixed text can hold besides digit strings. The O4 test checks
// each token of an offer against this list. Lower case.
const OFFER_VOCABULARY = Object.freeze([
  'your', 'opportunity', 'portfolio', 'moved', 'since', 'the', 'last', 'run',
  'pair', 'pairs', 'crossed', 'a', 'level',
  'quiet', 'signal', 'signals', 'appeared',
  'and', 'top', 'of', 'list', 'changed', 'order',
  'want', 'to', 'look', 'at', 'full', 'read',
]);

function isCount(v) {
  return Number.isInteger(v) && v >= 0;
}

/**
 * composeMovementSummary(counts) -> string
 *
 * Fixed phrases in a fixed order: pairs that crossed a level, quiet signals,
 * then the top of the list. One part has no 'and'. Two parts join with ' and '.
 * Three parts use commas and 'and' before the last. Returns '' when no part
 * applies or when a count is not a non-negative integer.
 */
function composeMovementSummary(counts) {
  if (!counts || typeof counts !== 'object') return '';
  const b = counts.band_cross;
  const t = counts.tail_enter;
  const r = counts.top_n_reshuffle;
  if (!isCount(b) || !isCount(t) || !isCount(r)) return '';
  const parts = [];
  if (b > 0) parts.push(b === 1 ? '1 pair crossed a level' : b + ' pairs crossed a level');
  if (t > 0) parts.push(t === 1 ? '1 quiet signal appeared' : t + ' quiet signals appeared');
  if (r > 0) parts.push('the top of the list changed order');
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts[0] + ' and ' + parts[1];
  return parts[0] + ', ' + parts[1] + ', and ' + parts[2];
}

/**
 * composePortfolioOffer({ payload }) -> offer | null
 *
 * @param {{ payload?: object }} [args]
 * @returns {{ text: string, scope: string, counts: object, command: string, next: { command: string } }|null}
 */
function composePortfolioOffer(args) {
  try {
    const a = (args && typeof args === 'object') ? args : {};
    const env = a.payload;
    if (!validateEnvelope(env)) return null;
    if (env.encoder_kind !== 'live') return null;
    const counts = {
      band_cross: env.counts.band_cross,
      tail_enter: env.counts.tail_enter,
      top_n_reshuffle: env.counts.top_n_reshuffle,
    };
    const summary = composeMovementSummary(counts);
    if (!summary) return null;
    return {
      text: OFFER_LABEL_PREFIX + summary + '.' + OFFER_QUESTION,
      scope: env.scope,
      counts: counts,
      command: NEXT_COMMAND,
      next: { command: NEXT_COMMAND },
    };
  } catch (_e) {
    // Any internal failure is an abstention; the composer never throws.
    return null;
  }
}

module.exports = {
  composePortfolioOffer: composePortfolioOffer,
  composeMovementSummary: composeMovementSummary,
  OFFER_VOCABULARY: OFFER_VOCABULARY,
  OFFER_LABEL_PREFIX: OFFER_LABEL_PREFIX,
  OFFER_QUESTION: OFFER_QUESTION,
  NEXT_COMMAND: NEXT_COMMAND,
};
