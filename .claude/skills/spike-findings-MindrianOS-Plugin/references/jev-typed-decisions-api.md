# Jev Typed Decisions API (TypeSafe)

## Requirements

- Canon Part 8 holds for every call: state carries generic methodology handles only
  (framework names, section slugs, problem-type and stage enums, quantized scalars). Zero
  room content, zero user text, zero artifact ids.
- Users never carry a Jev dependency or key. Finite input spaces are scored at dev time or
  in Theo's re-emission and shipped as data; per-user Part-8-clean payloads route
  plugin -> Theo -> Jev with Theo holding the one key. Jev never runs in a hook on a user
  machine (a second vendor in every turn loop), even though latency alone would allow it.
- Key lives in `~/.secrets/typesafe.env` (mode 600) as `TYPESAFE_API_KEY=`; never
  hardcoded, never printed, never committed.
- Vendor speed and cost figures are labeled vendor-claimed until measured; only measured
  numbers are quoted as facts.

## How to Build It

Contract (measured 2026-09-17 against `jev-1.13.0`):

- `POST https://api.typesafe.ai/v1/systemone`, headers `Authorization: Bearer <key>`,
  `Content-Type: application/json`.
- Body: `{ model: 'jev-latest', state: <string|object|array>, questions: { <id>: Question } }`.
- Question types: `choice` (`criteria: { option: gloss }`, returns `choice`,
  `probabilities`, `confidence`), `score` (`criteria: [level0, level1, ...]` up to 10,
  returns `score` = probability-weighted level index, `legend`, `probabilities`,
  `confidence`), `noul` (returns `noul` 0..1, no confidence).
- Reference nested state with backticked paths in `instructions`, e.g.
  ``'How well does the framework at `candidates.f3` fit ...'``.
- Ask independent questions over the same state in ONE call; they run in parallel and
  cannot see each other. 20 Score questions per call was safe (Spike 002, 84 calls, 0
  failures).
- Always include a `no-match` option in a Choice: on a no-fit state the model put 0.95 on
  it at confidence 0.93 (Spike 001 case E).
- Level descriptions "describe situations, not degrees" (the model does not see level
  numbers).

Minimal client, zero deps (from `sources/001-jev-liveness-cost/liveness.cjs`):

```js
async function jev(key, body) {
  const t0 = Date.now();
  const r = await fetch('https://api.typesafe.ai/v1/systemone', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch (_) {}
  return { status: r.status, ms: Date.now() - t0, json: json };
}
```

Backoff and pooling (from `sources/002-jev-section-framework-ranker/rank.cjs`): retry on
429/529 with `400 * 2 ** attempt` ms, at most 4 attempts; a small `pool(items, n, fn)`
at concurrency 4-6 was enough to score 410 items in 2.2-3.7 s.

Wrapper shape for any per-turn path (from `sources/003-jev-hook-latency-budget/budget.cjs`):
race the call against the budget, drop the loser, never await it in the turn:
`Promise.race([jev(...), new Promise(res => setTimeout(() => res({who:'budget'}), 2000))])`.

Confidence thresholds (vendor doc, to be evaluated per seat): under 0.5 do not act; 0.5-0.9
proceed with caution; over 0.9 act with confirmation. Spike 004 saw 0.90 when a stated
policy was followed; Spike 002 saw 0.42-0.62 on clear ranking cases vs 0.17-0.30 on
unclear ones.

## What to Avoid

- Do not key a validation branch on 422: the live service returns **400** for a malformed
  question (docs say 422). 401 on a bad key is correct and loud.
- Do not treat a cold call as representative: first call in a fresh process costs
  741-893 ms (TLS + route); warm calls sit at 233-320 ms. A hook is always a fresh process.
- Do not assume `noul` carries confidence; only `choice` and `score` do.
- Do not send Theo descriptions or any room bytes as state without a navigator ruling
  (see the ledger reference).
- Do not put Jev in the Part 8 egress guard: a remote model deciding whether bytes may
  leave is itself the bytes leaving.

## Constraints

- Measured latency across 4 spikes (429 successful calls): p50 285-320 ms, p95
  713-1241 ms, max 1569 ms; 0 of 45 hook-shaped calls over 2000 ms; no 429/529 ever
  observed, including a 20-wide burst.
- Tokens: a 3-question call over a 3-field state = 507 in / 105 out. A 20-Score batch over
  20 candidates with name + JTBD + glossary = about 4.5k in / 290 out.
- Cost: vendor-claimed $42 per 1e9 input tokens (unverified; output price unpublished).
  Spike 002's 430k input tokens = about $0.018 at that rate.
- Node 22 native `fetch`; the SDK (`@typesafe-ai/sdk`, ESM+CJS, Node 20+) exists but was
  not used in any spike.

## Origin

Synthesized from spikes: 001, 003.
Source files available in: sources/001-jev-liveness-cost/, sources/003-jev-hook-latency-budget/
