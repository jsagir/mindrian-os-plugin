'use strict';
// Phase 177 - The Behavioral Channel
// BCH-01 / BCH-02: the frozen model OBSERVATION block schema + the emit-boundary validator.
//
// THE BRIGHT LINE (177-RESEARCH.md sec 2, 177-SPEC.md:14-23):
//   The engine owns the composed decision; the model emits OBSERVATIONS only.
//   ALLOWED (model emits):    reframe_cue, confidence, escape_hatch, problem_type, pushback, saturation
//   FORBIDDEN (model emits):  dial, investment_level, reach, fire  <- engine-composed, never model-emitted
//
// This module is the cheapest, hardest enforcement of that line: a STRICT Zod object
// rejects unknown keys structurally, and an explicit FORBIDDEN_COMPOSED_KEYS guard names
// the offending key so the rejection reason is unambiguous. A rejected key cannot be
// composed from. computeInvestmentLevel (projections.cjs) remains the SOLE dial source.
//
// PURE module: no I/O, no network, no db. Per Canon Part 8 the validated observation
// carries only enum handles + scalars; it never carries the composed decision.

const { z } = require('zod'); // match the in-repo idiom (lib/mcp/app-views.cjs:24, tool-router.cjs:31)

// The composed-state keys the model is STRUCTURALLY forbidden from emitting. These are
// engine-owned outputs: the engine composes the dial (investment_level), picks the reach,
// and decides what fires. A model that emits any of these is attempting to usurp the
// engine's decision (threat T-177-06-01). Frozen + exported for the test and future callers.
const FORBIDDEN_COMPOSED_KEYS = Object.freeze(new Set(['dial', 'investment_level', 'reach', 'fire']));

// The ALLOWED observation block. STRICT so any unknown key (including every forbidden
// composed key) is rejected by construction. Every field is optional: the model emits
// only what it observed this turn. All fields are pure-observation enum handles or scalars,
// NONE of dial / investment_level / reach / fire.
const ObservationSchema = z
  .object({
    // What reframe the model noticed it could offer (an enum-ish handle, not a decision).
    reframe_cue: z.string().optional(),
    // The model's self-reported confidence in its observation. Bounded to [0,1].
    confidence: z.number().min(0).max(1).optional(),
    // The model observed an escape-hatch request ("just tell me" / "bottom line").
    escape_hatch: z.boolean().optional(),
    // The model's silent problem-type observation (an enum handle, not the composed dial).
    problem_type: z.string().optional(),
    // The model observed pushback / misfire this turn.
    pushback: z.boolean().optional(),
    // The model observed conversational saturation (repeating, short answers, circular).
    saturation: z.boolean().optional(),
  })
  .strict();

/**
 * validateObservation(obj) -- the emit-boundary validator.
 *
 * Returns { ok:true, value } on a clean ALLOWED observation, or { ok:false, errors } on
 * any failure. Before the Zod parse, an explicit forbidden-key guard names the offending
 * composed key so the rejection reason is unambiguous even though strict() would also
 * reject it as an unknown key.
 *
 * @param {unknown} obj
 * @returns {{ok:true, value:object}|{ok:false, errors:string[]}}
 */
function validateObservation(obj) {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return { ok: false, errors: ['observation must be a plain object'] };
  }
  // Explicit bright-line guard: an own-property that is a forbidden composed key is rejected
  // with a message naming the key (the FORBIDDEN bright-line assert; threat T-177-06-01).
  for (const key of FORBIDDEN_COMPOSED_KEYS) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      return {
        ok: false,
        errors: [
          'forbidden composed key "' +
            key +
            '" is engine-owned and cannot be emitted by the model (the bright line)',
        ],
      };
    }
  }
  const parsed = ObservationSchema.safeParse(obj);
  if (parsed.success) {
    return { ok: true, value: parsed.data };
  }
  return {
    ok: false,
    errors: parsed.error.issues.map((i) => i.path.join('.') + ': ' + i.message),
  };
}

module.exports = { validateObservation, ObservationSchema, FORBIDDEN_COMPOSED_KEYS };
