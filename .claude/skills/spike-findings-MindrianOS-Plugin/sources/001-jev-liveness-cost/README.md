---
spike: 001
name: jev-liveness-cost
type: standard
validates: "Given the TypeSafe key, when one systemOne call with 3 mixed questions (choice/noul/score) over generic methodology handles fires, then HTTP 200, typed answers, measured wall time and token usage; plus auth failure, validation failure, repeatability and no-match mass"
verdict: VALIDATED
related: [002, 003, 004]
tags: [typesafe, jev, liveness, cost, part8]
---

# Spike 001: jev-liveness-cost

## What This Validates

Given the key in `~/.secrets/typesafe.env`, when `POST https://api.typesafe.ai/v1/systemone`
(`model: jev-latest`) fires with a state of generic handles only
(`{problem_type, stage, section}`) and three mixed questions, then the endpoint answers 200
with typed answers, and the edges behave: bad key fails loud, malformed question fails loud,
identical calls repeat, and a no-fit state puts its mass on `no-match`.

## Research

Docs read (2026-09-17): `docs.typesafe.ai/api.md`, `sdk/javascript.md`, `confidence.md`,
`primitives.md`, and the installed skill `typesafe@typesafe-ai` 0.5.7 (`SKILL.md`).

| Approach | Tool | Pros | Cons | Status |
|----------|------|------|------|--------|
| Raw HTTP | native `fetch` (Node 22) | zero deps, inspectable, matches the plugin's CJS rule | hand-rolled backoff | chosen |
| SDK | `@typesafe-ai/sdk` (ESM+CJS, Node 20+) | typed helpers, built-in 429/529 backoff | npm dep in a spike; a real-build choice | deferred |

Chosen: raw HTTP. The spike's job is to see the wire, not the wrapper.

Gotcha found: docs list 422 for request validation failure; the live service returns **400**
(`{"detail":"Choice question must have at least one choice: broken"}`). Any client that keys
its validation branch on 422 misclassifies this. Backoff codes (429/529) unaffected.

## How to Run

```bash
node .planning/spikes/001-jev-liveness-cost/liveness.cjs
```

Key resolution: `TYPESAFE_API_KEY` in env, else `~/.secrets/typesafe.env` read in-process.
The key is never printed; the runner also redacts `apikey_*` from stdout.

## What to Expect

- A: `http=200`, three typed answers, `usage` with input/output tokens, `model=jev-1.x`.
- B: three identical choices, probability drift under 0.05.
- C: `http=401` with `authentication_error`.
- D: `http=400` (docs say 422) with a validation message.
- E: `choice=no-match` with most of the mass on it.

## Observability

`results.json` next to this file: every request as an event (`ts`, `cat`, `label`, `status`,
`ms`, `usage`, `model`), the per-case answers, and a summary (`calls`, `min_ms`, `median_ms`,
`max_ms`). Regenerated on every run.

## Investigation Trail

1. First datapoint came from the navigator's own terminal via the scratchpad probe:
   `http=200 wall_ms=843 usage={507,105} model=jev-1.13.0`, choice `jobs-to-be-done` at 0.85
   (confidence 0.81), `is_well_defined` noul 0.06, red-teaming fit score 0.1 (0.91 on "poor
   fit: premature"). For an ill-defined, discovery-stage problem-definition section that is the
   right instinct on all three questions.
2. Spike runner reproduced it: `wall_ms=893`, same tokens, same choice, probabilities within
   0.01 of the terminal run.
3. Repeatability (B): choices `[jtbd, jtbd, jtbd]`, `max_abs_prob_drift=0.010`. Wall times
   `[731, 305, 290]` ms: the FIRST call in a process is slow (~730-900 ms), subsequent calls
   settle near 290 ms. Consistent with TLS/connection setup plus a cold route; native fetch
   keeps the connection alive. Cold-vs-warm becomes Spike 003's p50/p95 question.
4. Auth (C): 401, `error_type: authentication_error`, 266 ms. Fails loud, never a silent 200.
5. Validation (D): 400 in 233 ms, not the documented 422. Filed as a contract gotcha above.
6. No-fit (E): with `legal-ip / well-defined / execution` and the same four frameworks plus a
   `no-match` option, the answer is `no-match` at 0.95, confidence 0.93. The model abstains
   when the list does not fit, which is the property the section ledger needs most.

## Results

**Verdict: VALIDATED.**

Evidence (2026-09-17, `jev-1.13.0`, 7 calls): liveness 200; warm wall time 233-305 ms, cold
731-893 ms; 507 input / 105 output tokens for a 3-question call; probability drift 0.01 across
identical calls; 401 on a bad key; 400 on a malformed question; `no-match` 0.95 on a no-fit
state.

Cost: at the vendor-claimed $42 per 1e9 input tokens (typesafe.ai landing page, unverified;
output price not published there) the 507-token call is about $2.1e-5 on input. No
independent price source exists yet.

Surprises: the 400-vs-422 contract drift; the ~3x cold-vs-warm gap; how decisively the model
abstains (0.95 on `no-match`) rather than spreading mass.

Impact on remaining spikes: 002 can rely on abstention and on stable probabilities; 003 must
separate cold from warm and treat 400 as a validation class alongside 422.
