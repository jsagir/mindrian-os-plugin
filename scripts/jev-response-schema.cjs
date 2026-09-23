'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * scripts/jev-response-schema.cjs -- Phase 355 Plan 07 (HIPS-08, HIPS-09,
 * AI-SPEC Section 4b). Dev-time only. Never required from lib/ or hooks/
 * (tripwire: tests/test-353-tripwires.cjs leg 2, this file's own name is
 * appended to HOOKS_BANNED_LEDGER_SCRIPTS in the same commit that creates
 * it, per the Phase 356 peer contract).
 *
 * Mirrors docs.typesafe.ai/api.md "Answer types". `JevResponse` (zod)
 * catches three things: a vendor contract change, a `choice` outside our
 * criteria, and model drift (Finding 2 -- the response `model` field
 * "reports the versioned ID that answered"; a run mixing model ids is a
 * silent bug, not a warning).
 *
 * `parseJevResponse(res, expected)` never throws: every failure path
 * returns `{ ok: false, reason }` naming the failure, so a caller can log
 * per-item status without a try/catch and never silently shrink a
 * denominator (pitfall 9).
 *
 * No em-dashes (CLAUDE.md HARD RULE). Hyphens only.
 */

const { isDeepStrictEqual } = require('node:util');
const { z } = require('zod');
const { PINNED_MODEL } = require('./jev-question-ceilings.cjs');

const ChoiceAnswer = z.object({
  type: z.literal('choice'),
  choice: z.string(),
  probabilities: z.record(z.number().min(0).max(1)),
  confidence: z.number().min(0).max(1),
});
const NoulAnswer = z.object({ type: z.literal('noul'), noul: z.number().min(0).max(1) });
const JevResponse = z.object({
  model: z.string().regex(/^jev-\d+\.\d+\.\d+$/),
  answers: z.record(z.discriminatedUnion('type', [ChoiceAnswer, NoulAnswer])),
  usage: z.object({
    input_tokens: z.number().int().nonnegative(),
    output_tokens: z.number().int().nonnegative(),
  }),
});

// ---------------------------------------------------------------------------
// parseJevResponse(res, expected): expected is { questionId: [option, ...] }
// taken from a frozen question's own criteria keys. Rejects (in order): a
// non-200 status, a schema miss, a missing/non-choice answer for any
// expected question, a choice outside that question's criteria,
// probability keys that differ from the criteria set, probabilities not
// summing to 1 within 0.02, and any model other than PINNED_MODEL.
// ---------------------------------------------------------------------------
function parseJevResponse(res, expected) {
  if (!res || res.status !== 200) {
    return { ok: false, reason: 'http_' + (res ? res.status : 'none') };
  }
  const parsed = JevResponse.safeParse(res.json);
  if (!parsed.success) {
    return { ok: false, reason: 'schema: ' + parsed.error.issues.map((i) => i.path.join('.') + ' ' + i.message).join('; ') };
  }
  const out = parsed.data;
  const expectedIds = expected && typeof expected === 'object' ? Object.keys(expected) : [];
  for (const qid of expectedIds) {
    const a = out.answers[qid];
    const options = expected[qid];
    if (!a || a.type !== 'choice') return { ok: false, reason: 'missing choice answer ' + qid };
    if (!options.includes(a.choice)) return { ok: false, reason: qid + ': choice outside criteria' };
    if (!isDeepStrictEqual(Object.keys(a.probabilities).sort(), [...options].sort())) {
      return { ok: false, reason: qid + ': probability keys differ from criteria' };
    }
    const sum = Object.values(a.probabilities).reduce((x, y) => x + y, 0);
    if (Math.abs(sum - 1) > 0.02) return { ok: false, reason: qid + ': probabilities sum to ' + sum.toFixed(3) };
  }
  if (out.model !== PINNED_MODEL) return { ok: false, reason: 'model drift: answered by ' + out.model };
  return { ok: true, model: out.model, answers: out.answers, usage: out.usage };
}

module.exports = { JevResponse, parseJevResponse };
