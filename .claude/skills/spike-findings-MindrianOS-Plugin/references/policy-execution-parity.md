# Policy Execution Parity (stated rule vs inferred rule)

## Requirements

- Any Jev seat whose answer must follow a written policy MUST carry that policy in the
  question `instructions`. An implicit policy is a guess.
- The seat's inputs stay Part-8-clean: the `eureka_critic` payload (quantized scalars +
  closed enums + a `[01x]{6}` rubric pattern) is the reference shape.

## How to Build It

From `sources/004-jev-eureka-critic-parity/parity.cjs`: put the rubric items and their
yes/no answers in state, the four verdicts with one-line glosses in `criteria`, and the
decision rule verbatim in `instructions.rule`:

```js
const RULE = 'Decision rule, apply in this order: if item f is no OR item c is no -> pseudoscience; else if item e is no -> restatement; else if item d is no -> general_shallow; else if items a, b and c are all yes -> transferable; else general_shallow.';
questions.verdict = { type: 'choice', instructions: { judge: '...', rule: RULE }, criteria: { transferable: '...', restatement: '...', pseudoscience: '...', general_shallow: '...' } };
```

Result over all 64 rubric patterns: 64/64 agreement with `verdictFromRubric`, confidence
0.90 when agreeing. Withhold the rule: 40/64, every miss a priority-order miss
(pseudoscience -> general_shallow x18, restatement -> general_shallow x6), confidence
0.61 vs 0.51 (weak separation).

Use this when a Theo-side judgment has a policy you can write down but inputs that are
semantic (a framework's fit to a section, an option's order in a next_gate slate). Use
code, not Jev, when the inputs are already booleans: `eureka_critic`'s rule is code and
code is free.

## What to Avoid

- Do not rely on Jev to infer an ordering among competing failure classes; state it.
- Do not read a 0.5-0.6 confidence on a policy question as "moderately sure"; on
  Choice it means the mass is spread across options.

## Constraints

- 128 calls, about 100k input tokens, roughly $0.004 at the vendor-claimed rate.
- Verdict enum and reasoning tags come from `data/eureka-critic-tags.json`; rubric items
  from `lib/core/eureka-critic.cjs` `RUBRIC_ITEMS`. The critic's own rule is untouched.

## Origin

Synthesized from spikes: 004.
Source files available in: sources/004-jev-eureka-critic-parity/
