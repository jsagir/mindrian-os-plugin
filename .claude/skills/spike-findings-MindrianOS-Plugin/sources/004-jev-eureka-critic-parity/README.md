---
spike: 004
name: jev-eureka-critic-parity
type: standard
validates: "Given eureka_critic's quantized-scalar + closed-enum payload for all 64 rubric patterns, when Jev picks one of the 4 verdicts with and without the decision rule stated, then agreement with criticRule and confidence per case are known"
verdict: VALIDATED
related: [001, 002]
tags: [typesafe, jev, eureka, parity, part8, policy]
---

# Spike 004: jev-eureka-critic-parity

## What This Validates

`lib/core/eureka-critic.cjs` computes the verdict BY CODE from six rubric booleans
(`verdictFromRubric`): f or c false -> pseudoscience; e false -> restatement; d false ->
general_shallow; a, b, c all true -> transferable; else general_shallow. Given that same
payload (the Part-8-clean packet the `eureka_critic` MCP tool already accepts), when Jev
is asked for the verdict as a Choice over the four classes, then agreement with the code
rule over all 64 `[01]^6` patterns is measured twice: rule stated (R) and rule withheld (N).

## Research

None external. Rule and rubric items read from `eureka-critic.cjs` (RUBRIC_ITEMS a-f,
verdictFromRubric); verdict and domain enums from `data/eureka-critic-tags.json`.

## How to Run

```bash
node parity.cjs
```

## What to Expect

Code distribution over 64 patterns: pseudoscience 48, restatement 8, general_shallow 7,
transferable 1. Variant R near-perfect; Variant N well below, with priority-order misses.

## Observability

`results.json`: per-variant agreement, per-verdict agree counts, confusion map,
confidence when agreeing vs disagreeing, token usage, p50 ms, and every row (pattern,
expected, got, confidence, probability mass on the expected class).

## Investigation Trail

1. Variant R (rule in the instructions): 64/64 agreement, confidence 0.90 when agreeing;
   no confusions; 52.7k input tokens for 64 calls.
2. Variant N (rule withheld, only the four verdict glosses): 40/64 (63 percent).
   Per verdict: transferable 1/1, general_shallow 7/7, pseudoscience 30/48, restatement
   2/8. Confusions: pseudoscience -> general_shallow x18, restatement -> general_shallow
   x6. Confidence 0.61 when agreeing vs 0.51 when disagreeing: weak separation.
3. Reading: every N miss is a PRIORITY miss. Given "f is no" plus other failures, the
   model prefers the vaguer class. It does not invent the ordering the code imposes; it
   reproduces it exactly once told.

## Results

**Verdict: VALIDATED** for the property, not for a seat. Jev executes a stated
closed-enum policy over typed state with code-like reliability (100 percent, confidence
0.90) and cannot be relied on to infer an unstated priority order (63 percent). For
`eureka_critic` this changes nothing: the rule is already code and code is free. Where it
matters is any Theo-side judgment seat whose policy can be written down but whose inputs
are semantic (a framework's fit to a section, an option's order in a next_gate slate):
state the policy in the question and the confidence becomes a usable gate.

Cost: about 100k input tokens for 128 calls, roughly $0.004 at the vendor-claimed rate
(unverified). Latency consistent with Spikes 001-003.
