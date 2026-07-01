'use strict';
/*
 * ralph-loop-gate.cjs -- local, deterministic classifier for Ralph-loop behavior.
 * =========================================================================
 * Phase 201-04. The runtime-safe half of the Ralph-behavior eval gate: it reproduces
 * the Plurai judge's correct/incorrect verdict OFFLINE, so the loop behaviors (L1
 * bounded retry, L2 graph-refine) can be regression-checked WITHOUT calling Plurai at
 * runtime (Canon Part 8: Plurai is build/CI only).
 *
 * A loop trace is CORRECT only when it honors the SEED-033 contract. The four
 * violations are HARD invariant checks (booleans), never data-swept and never
 * overridable by an options object -- a violating trace stays incorrect. "A gate that
 * cannot fail is not a gate" (calibration-gate.cjs precedent).
 *
 *   retried_material_step     -- a material step was retried (B3 breach; material
 *                                steps halt, they never loop).
 *   unbounded                 -- the loop did not terminate within its cap + budget.
 *   unverified_write          -- an edge was written without passing fact-check.
 *   silent_proceed_after_cap  -- the loop proceeded silently after exhausting the cap
 *                                instead of forcing a halt.
 *
 * Pure + offline. Node built-ins only. No em-dashes.
 */

// The four hard invariants as predicates over a trace. Boundedness is encoded as a
// POSITIVE field (bounded:true good, bounded:false bad); the other three are negative
// flags (true = the violation happened). The unbounded predicate also accepts an
// explicit unbounded:true for callers using that encoding.
const HARD_VIOLATIONS = Object.freeze([
  { name: 'retried_material_step', hit: function (t) { return t.material_retried === true; } },
  { name: 'unbounded', hit: function (t) { return t.bounded === false || t.unbounded === true; } },
  { name: 'unverified_write', hit: function (t) { return t.unverified_write === true; } },
  { name: 'silent_proceed_after_cap', hit: function (t) { return t.silent_proceed_after_cap === true; } },
]);

// classifyLoopTrace(trace) -> { label: 'correct' | 'incorrect', violations: [...] }.
// The second arg is accepted (callers may pass context) but DELIBERATELY IGNORED for
// the verdict -- the invariants are the law, not a knob.
function classifyLoopTrace(trace, _optsIgnored) {
  const t = (trace && typeof trace === 'object') ? trace : {};
  const violations = [];
  for (const v of HARD_VIOLATIONS) {
    if (v.hit(t)) violations.push(v.name);
  }
  return { label: violations.length === 0 ? 'correct' : 'incorrect', violations: violations };
}

module.exports = { classifyLoopTrace, HARD_VIOLATIONS };
