---
id: SEED-100
status: dormant
priority: high
planted: 2026-09-30
updated: 2026-09-30
planted_during: "follow-up to SEED-099 (background eureka/ambient resource exhaustion), same session"
trigger_when: "when SEED-099's ONNX thread fan-out question is answered by profiling, or before any new Eureka feature work, whichever comes first"
scope: "spike (measure and compare three architectures on real rooms; no production change; output is a decision memo plus a navigator ruling)"
depends_on: [SEED-099 profiling result (A4)]
feeds: [/mos:eureka, Phase 355.1 ambient run, SEED-097 research designer]
canon_parts: [8, 10, 12]
navigator_ruling: "2026-09-30: do not redesign Eureka yet. Seed it as a research spike that compares the options on a real room before deciding."
---

# SEED-100: Spike - should Eureka do its judging with Claude instead of local ONNX?

**Governing thought:** Eureka runs two different jobs through one local ONNX stack.
**Candidate generation** (out of all entry pairs, which few are worth a look) is cheap
lexical-to-semantic recall, and small embeddings suit it. **Pair judgment** (do these two
share a mechanism across domains, or only vocabulary) is structural reasoning. Embeddings are
weakest at that, and it is the part that sets the quality of what the navigator sees. The
spike tests whether the judgment job belongs to a model like Claude, and at what cost.

## Why now

SEED-099 found background eureka children running with unbounded ONNX threads: 360% CPU and
5.9 GB RSS in one observed process. Guards fix the symptom. This spike asks whether the local
reranker should exist at all.

## Candidate architectures to compare

| Arm | Candidate generation | Pair judgment | When it runs |
|---|---|---|---|
| **A. Guarded local** (control) | local embeddings | local FlashRank rerank + existing scoring | ambient + on demand (SEED-099 guards applied) |
| **B. Hybrid** | small local encoder, bounded threads | Claude judges the top 10-25 pairs; local reranker removed | on demand only (`/mos:eureka`), not in the hourly ambient run |
| **C. Claude-native** | Claude reads the room and proposes pairs | Claude | on demand only |

For arms B and C, test the judge model in this order: **Claude Opus 5.5** (`claude-opus-5-5`)
first, then **Claude Fable 5.1** (`claude-fable-5-1`) only if Opus misses connections that
Fable finds.

## Facts that constrain the design (from the claude-api reference, cached 2026-09-25)

- Anthropic's API reference lists **no embeddings endpoint**. Claude can judge pairs; it cannot replace the vector step.
- Fable 5.1: 1M context, 128K output, $10 / $50 per MTok. Thinking is always on. Single hard turns can run many minutes. It needs 30-day data retention (not available under ZDR unless authorized). Forced `tool_choice` returns a 400, so use structured outputs.
- Opus 5.5: 1M context, $4 / $20 per MTok, effort defaults to `medium`.
- There is no measured per-run token figure yet. Producing one is part of this spike; do not estimate it.

## Questions the spike must answer

1. **Quality.** On 2-3 real rooms, do the arms differ in the findings a navigator would act on?
   Use a blind navigator ranking of the top-N findings per arm. Record which cross-domain
   structural matches each arm catches or misses.
2. **Cost per run.** Measured `usage` tokens and dollars for B and C, at Opus 5.5 and Fable 5.1,
   on each test room.
3. **Laptop cost.** Peak RSS, CPU-seconds and wall time per arm, on battery and on AC.
4. **Latency.** Time until the navigator sees the first finding.
5. **Billing path.** Inside Claude Code, a judge subagent (`Agent` with `model: opus|fable`) runs
   on the user's own plan with no API key. A background API call needs a key and a budget.
   Which one does each arm need, and does arm B work with the subagent path alone?
6. **Canon Part 8 ruling.** Eureka is currently specified as hermetic (ZERO network). Arms B and C
   send room pairs to Claude. Larry's own turns already send room conversation to Claude, but
   the navigator must rule explicitly whether Eureka judgment may do the same. Theo/Brain stays
   out of scope either way.

## Deliverables

- `.planning/spikes/eureka-claude-judge/`: a harness that runs the three arms on the same fixture
  rooms, plus the raw measurements.
- A decision memo: one table per question above, and a recommendation with its falsifier.
- A navigator ruling recorded back on this seed: pick an arm, the judge model, and the Part 8 decision.

## Out of scope

- Shipping any arm to production. That becomes its own phase after the ruling.
- Changing the ambient run's producer set (find-bottlenecks, hsi, whitespace, find-connections).
