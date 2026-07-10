/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 213-01 -- the status-quo label judge (SEED-050 Judge 3), verdict-by-code.
 *
 * judgeStatusQuo({ innovationIntentSignalled, statusQuoRejected,
 *                  turnRelitigatesStatusQuo }) -> label string
 *
 * THE SPLIT (the 212 D2 idiom, mirrored not imported): the label is computed BY
 * CODE from boolean item inputs. The LLM pass that reads a transcript and decides
 * whether innovation intent was signalled, whether the status quo was explicitly
 * rejected, and whether THIS turn re-defends it happens OUTSIDE this module; its
 * per-item booleans are the INPUTS here. Raw transcript text never enters this
 * file (T-213-01: judged booleans cross, transcript does not).
 *
 * Judge 3 is MODE-CONDITIONED (SEED-050 "Mode-blindness"): a turn is
 * `status_quo_stuck` ONLY when ALL THREE hold -- the persona signalled innovation
 * intent AND explicitly rejected the status quo AND the turn re-defends it. If
 * intent was never signalled, defending the status quo is a legitimate `redirect_ok`
 * (the persona wanted a solve, not a reframe), so the judge must NOT fire. Any
 * other combination is `redirect_ok`. This label closes StatusQuoGate in
 * lib/core/eureka/compression-meter.cjs when it is `status_quo_stuck`.
 *
 * HOME (flagged Decision-Gate recommendation, RESEARCH Open Question 1): this is
 * the EVAL-SIDE home under lab/eureka-graders/ (mirroring the 202 lab/apo
 * precedent). MCP-servable packaging of the judge family (SEED-050:102-105) is a
 * FUTURE lift for the consolidation arc's critic-MCP step, not built here.
 *
 * Calibration anchor: evals/eureka/ is the gold baseline (211-04).
 *
 * Pure, sync, zero-I/O, never throws. Node built-ins only, CJS, hyphens only.
 */
'use strict';

// Frozen closed enum: the only two status-quo labels. Order is load-bearing
// (stuck first, then the open label); tests pin it exactly.
const STATUS_QUO_LABELS = Object.freeze(['status_quo_stuck', 'redirect_ok']);

// ---------------------------------------------------------------------------
// judgeStatusQuo(item) -> 'status_quo_stuck' | 'redirect_ok'
//
// stuck ONLY when intent was signalled AND the status quo was explicitly rejected
// AND this turn re-defends it. Everything else is redirect_ok (mode-conditioned:
// no signalled intent means no stuck verdict). Inputs coerced to booleans; a
// missing item is false. Never throws.
// ---------------------------------------------------------------------------

function judgeStatusQuo(item) {
  const spec = (item && typeof item === 'object') ? item : {};
  const intent = spec.innovationIntentSignalled === true;
  const rejected = spec.statusQuoRejected === true;
  const relitigates = spec.turnRelitigatesStatusQuo === true;

  if (intent && rejected && relitigates) {
    return 'status_quo_stuck';
  }
  return 'redirect_ok';
}

module.exports = {
  STATUS_QUO_LABELS: STATUS_QUO_LABELS,
  judgeStatusQuo: judgeStatusQuo,
};
