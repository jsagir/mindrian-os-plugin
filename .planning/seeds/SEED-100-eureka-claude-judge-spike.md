---
id: SEED-100
status: dormant
priority: high
planted: 2026-09-30
updated: 2026-10-01
superseded_by: "SEED-103 (2026-10-01): the spike is re-framed inside the research planner, section 9 of .planning/REVIEWS/2026-10-01-eureka-v2-design.md; this seed stays for its Jev and Part 8 notes"
planted_during: "follow-up to SEED-099 (background eureka/ambient resource exhaustion), same session"
trigger_when: "when SEED-099's ONNX thread fan-out question is answered by profiling, or before any new Eureka feature work, whichever comes first"
scope: "spike (measure and compare three architectures on real rooms; no production change; output is a decision memo plus a navigator ruling)"
depends_on: [SEED-099 profiling result (A4)]
feeds: [/mos:eureka, Phase 355.1 ambient run, SEED-097 research designer]
canon_parts: [8, 10, 12]
navigator_ruling: "2026-09-30: do not redesign Eureka yet. Seed it as a research spike that compares the options on a real room before deciding."
---

# SEED-100: Spike - should Eureka judge pairs with Claude, Jev, or both, instead of local ONNX?

**Governing thought:** Eureka runs two different jobs through one local ONNX stack.
**Candidate generation** (out of all entry pairs, which few are worth a look) is cheap
lexical-to-semantic recall, and small embeddings suit it. **Pair judgment** (do these two
share a mechanism across domains, or only vocabulary) is structural reasoning. Embeddings are
weakest at that, and it is the part that sets the quality of what the navigator sees. The
spike tests whether the judgment job belongs to a model like Claude, and at what cost.

## Why now

SEED-099 found background eureka children running with unbounded ONNX threads: 360% CPU and
5.9 GB RSS in one observed process. Guards fix the symptom. This spike asks where Eureka's
judgment should live.

## Re-aimed 2026-10-01 by the architecture review

Source: `.planning/REVIEWS/2026-10-01-eureka-architecture-review.md` (section 5, ADR-E4).
- **The original arm A named a stage that does not run.** The FlashRank reranker
  (`hybrid-retrieve.cjs` `rerank`) has no production caller. What actually decides quality today
  is `scoreMeasured` (a lexical/semantic differential) + the AHP composite + tail flags + the
  Stage A critic. Stage A calls no LLM, and its Gate 3 novelty check is always skipped in the
  portfolio run, because no `knnFn` is passed.
- **The judge slot already exists.** Stage B, `eureka-critic.cjs` `runRubric`, is a two-pass
  neutral/adversarial rubric through an injected `judgeFn`. Today only reasoning mode reaches it,
  with the host Claude as judge. The live portfolio run never does. Arms B1-B3 are therefore
  **`judgeFn` implementations plugged into Stage B and turned on for the top-N survivors**, not
  new pipeline stages. The output contract stays identical, which keeps orthogonality.
- **Part 8 question restated.** Eureka is not hermetic today. The entity pre-step escalates to
  `claude-haiku-4-5` over `api.anthropic.com` with room excerpts, even under `--offline`. The
  ruling needed is one declared egress policy for all Eureka traffic (entity escalation, judge,
  Jev, Theo stamp), with `--offline` meaning none of it. The earlier question, "may Eureka talk
  to Claude at all", is already settled in practice.
- **New question: candidate generation.** Today's candidates come from an uncapped all-pairs
  enumeration. The spike should also compare that with ADR-E1 (room edges ∪ top-k vector
  neighbours per node, capped), and measure gold-set recall for each. A better judge on
  candidates chosen by a poor generator is still limited by those candidates.

## Candidate architectures to compare

| Arm | Candidate generation | Pair judgment | When it runs |
|---|---|---|---|
| **A. Current pipeline** (control) | all-pairs enumeration, uncapped, and the ADR-E1 capped variant as sub-arm A' | `scoreMeasured` + AHP + tail + Stage A critic; Stage B off | ambient + on demand (SEED-099 guards applied) |
| **B1. Hybrid + Claude** | ADR-E1 candidates | A, plus Stage B on with a Claude `judgeFn` on the top 10-25 | on demand only (`/mos:eureka`), not in the hourly ambient run |
| **B2. Hybrid + Jev** | same as B1 | Stage B with a Jev `usefulness_judge` `judgeFn` on the same top 10-25 | on demand only |
| **B3. Hybrid + Claude and Jev** | same as B1 | Stage B `judgeFn` = Claude writes the shared-mechanism statement, then Jev scores it. The reverse order (Jev pre-filters, Claude judges the survivors) is a sub-arm. | on demand only |
| **C. Claude-native** | Claude reads the room and proposes pairs | Claude | on demand only |

For the Claude arms, test the judge model in this order: **Claude Opus 5.5** (`claude-opus-5-5`)
first, then **Claude Fable 5.1** (`claude-fable-5-1`) only if Opus misses connections that
Fable finds.

### Jev is already a pair judge in this repo

`scripts/jev-devtime-client.cjs` (the Typesafe `systemone` endpoint) already declares a
`usefulness_judge` egress profile (model `jev-1.13.0`). Its state is `a_excerpt`, `b_excerpt`
(max 2400 chars each), `direction_phrase` and `verification`. It asks one `choice` question
with the criteria `useful` / `not_useful` / `already_known` / `none`. That is the Eureka pair
judgment in its current form. `eureka-critic.cjs::confidenceFromBucket` is already the one
function that turns measured gold-set accuracy into a calibration band for Jev records.

What makes this a spike question rather than an obvious swap:
- **Jev is dev-time only by rule.** Tripwires forbid any `lib/` or `hooks/` file from requiring
  the client. Arms B2 and B3 run in the spike harness only. Using Jev in production needs a
  runtime client, a per-profile egress guard carried over from the dev client, and a navigator
  ruling.
- **Part 8 covers Jev as well as Claude.** Room excerpts would leave the machine for a third-party
  endpoint. The existing guards refuse any payload field outside the profile and never strip
  it; keep that.
- **Jev scores; Claude explains.** Jev returns a category or a level. Claude can also write the
  Opportunity-Statement prose. B3 tests whether combining them beats either one alone.
- **One gold set for every judge.** Score all arms against the same navigator-labelled gold pairs,
  and derive each judge's band through `confidenceFromBucket`. Never use a model's
  self-reported confidence (D-46).

## Facts that constrain the design (from the claude-api reference, cached 2026-09-25)

- Anthropic's API reference lists **no embeddings endpoint**. Claude can judge pairs; it cannot replace the vector step.
- Fable 5.1: 1M context, 128K output, $10 / $50 per MTok. Thinking is always on. Single hard turns can run many minutes. It needs 30-day data retention (not available under ZDR unless authorized). Forced `tool_choice` returns a 400, so use structured outputs.
- Opus 5.5: 1M context, $4 / $20 per MTok, effort defaults to `medium`.
- There is no measured per-run token figure yet. Producing one is part of this spike; do not estimate it.

## Questions the spike must answer

1. **Quality.** On 2-3 real rooms, do the arms differ in the findings a navigator would act on?
   Use a blind navigator ranking of the top-N findings per arm. Record which cross-domain
   structural matches each arm catches or misses.
2. **Cost per run.** Measured `usage` tokens and dollars for the Claude arms at Opus 5.5 and
   Fable 5.1, and measured Jev calls and cost for B2 and B3, on each test room.
   **Agreement:** how often Claude and Jev agree on the same pairs, and which of the two is
   right when they disagree, checked against the gold set.
3. **Laptop cost.** Peak RSS, CPU-seconds and wall time per arm, on battery and on AC.
4. **Latency.** Time until the navigator sees the first finding.
5. **Billing path.** Inside Claude Code, a judge subagent (`Agent` with `model: opus|fable`) runs
   on the user's own plan with no API key. A background API call needs a key and a budget.
   Which one does each arm need, and does arm B work with the subagent path alone?
6. **Canon Part 8 ruling** (see the re-aim above: Eureka already egresses to Haiku, so the ruling now covers one declared policy for all Eureka egress). Eureka is currently *documented* as hermetic (ZERO network). Arms B and C
   send room pairs to Claude. Larry's own turns already send room conversation to Claude, but
   the navigator must rule explicitly whether Eureka judgment may do the same. Theo/Brain stays
   out of scope either way.

## ICM and layer-contract reading

Source: `docs/2026-09-14-LAYER-CONTRACT-AND-ICM-MAP.md`.
- **Who verifies (section 2.6).** When Claude judges pairs it proposed itself, a loop is checking
  its own output. When Jev scores a statement Claude wrote, an independent reviewer node does
  the checking. That gives arm B3 an architectural reason, not only an empirical one. The spike
  should report whether that independence shows up as better gold-set accuracy.
- **Orthogonality (section 3).** The judge belongs to the upper, execution layer and must be
  swappable. Every arm writes the same output: typed, `proposed` claims with `SOURCED_FROM`
  provenance into `room.db`, through `node-insert.cjs`. If the arms produce different kinds of
  output, the arms cannot be compared, and the room's graph would change depending on which
  judge ran.
- **Counter-metric rule (Phase 343):** whichever arm wins ships with a declared watcher, for
  example judged-useful pairs the navigator later declines.

## Corpus grounding (langtalks-graph-expert, citations only)

- LLM-as-a-judge: Vanishing Gradients Ep. 57, "AI Agents and LLM Judges" (Shreya Shankar);
  LangTalks #61 (Voice Agents, Lemonade); Lex Fridman #490 "State of AI in 2026"; and the
  navigator's own note "Agent Factory: Deep Dive into Agent Evaluation". Read Ep. 57 before
  designing the gold set and the judge rubric.
- reranker: LangTalks #25 "Reranking". This is the baseline case for arm A's FlashRank stage.

## Deliverables

- `.planning/spikes/eureka-claude-judge/`: a harness that runs the three arms on the same fixture
  rooms, plus the raw measurements.
- A decision memo: one table per question above, and a recommendation with its falsifier.
- A navigator ruling recorded back on this seed: pick an arm, the judge model, and the Part 8 decision.

## Out of scope

- Shipping any arm to production. That becomes its own phase after the ruling.
- Changing the ambient run's producer set (find-bottlenecks, hsi, whitespace, find-connections).
