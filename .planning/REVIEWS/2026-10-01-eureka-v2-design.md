---
title: Eureka, rethought from the bottom up: retire the standalone engine, keep the perspective
date: 2026-10-01
status: proposal (navigator decision pending)
repo_head: af53dbcf6 (2.0.0-beta.52)
lenses: icm-architect (system map + pipeline form), architecture-designer (ADRs), Phase 343 counter-metric rule, Phase 355 measured hit rate, Phase 355.1 ambient composition, Phase 363 research planner, the 2026-10-01 architecture review
navigator_steer: "Eureka might be redundant, and the better approach is to do the MCP-based mos:canvas layer properly with Jev and research."
builds_on: [.planning/REVIEWS/2026-10-01-eureka-architecture-review.md, SEED-097 / Phase 363, SEED-099, SEED-100, SEED-101]
---

# Eureka, from the bottom up

## 0. The answer in one paragraph

Eureka the **standalone engine** (all-pairs enumeration, AHP composite, its own report, its own
ambient scorer, its own filing path) is redundant with Phase 363 and should be retired. Eureka
the **question** ("which opportunities in this room deserve exploration now?") is one of the
MOS-CANVAS perspectives Phase 363 already lists, and it stays. What survives from the code is
the part that does one thing well: a bounded local **recall** of cross-domain candidate pairs
from the room's own substrate. Those candidates become **research questions** for the one
plan-and-run engine (`lib/core/research-planner/`), filtered by **Jev** as the calibrated
first-pass judge, answered by **research** (OpenAlex and the other adapters the planner already
routes), explained by Claude, and filed only through the existing human gate. Embeddings become
one optional recall lane. The ONNX runtime leaves the hot path.

## 1. Why the standalone engine is redundant: the measured record

These are the only numbers in this document, and each has a source in the repo.

| Measurement (Phase 355, three fixture rooms, navigator blind labels) | Value | Source |
|---|---|---|
| Engine output judged useful | 43 of 96 (44.8%, 95% Wilson 35.2% to 54.7%) | `355-VERIFICATION.md` |
| `strong`-tier stamp vs that baseline | 7 of 13 (53.8%, 29.1% to 76.8%): "the tier carries no measured information yet" | same |
| Named direction marked right | 16 of 96 (16.7%) | same |
| Theo never asked (`not_called`), a vocabulary gap between room prose and canon names | 80.2% of pairings | same |
| Jev usefulness judge vs the same blind gold | 76.04% agreement (n = 96); 53.85% on `strong` (n = 13); 79.27% on `unverified` (n = 82) | `355-26-SUMMARY.md` |
| Jev `already_known` | 2 of 96, vs the navigator's 45 of 96 | same |
| Cost of that 96-call Jev run | 79,231 input tokens, about $0.0033 | same |
| Largest dogfood room | 11,145 nodes; all-pairs = about 62 million | `room.db` count 2026-10-01 |
| Jev capabilities in this repo | `noul`, `choice`, `score` questions over a small state; **no embedding or similarity endpoint** | `scripts/jev-devtime-client.cjs` |

Read plainly: today's engine shows a person something useful about as often as a coin flip,
its direction label is wrong five times in six, and four times in five it cannot even name its
endpoints in canon vocabulary. The verification stamp, the phase's main deliverable, did not
move the reader (sitting-2 gap: -1.0 point). None of this is fixed by a faster pair loop or a
thread cap. Those fix the laptop. They do not fix the product.

What the record also says: **the navigator marked 45 of 96 pairings "already known".** The
engine's largest failure is not missing connections; it is re-surfacing ones the room already
holds. That is a recall-and-dedupe problem against the room's own graph, and Jev, which said
"already known" twice, will not catch it either. Only the room graph can.

## 2. What Phase 363 already provides (Canon Part 7: reuse before build)

`lib/core/research-planner/CONTEXT.md` is the contract: **one** plan-and-run engine. A command
contributes three things only: the questions worth asking, a lens, and a falsifier template.
The engine emits the plan, composes and audits every search string (Part 8), asks the
navigator to approve (F.6 card), fetches, iterates, writes hash-anchored evidence rows, and
proposes what to file. Quick run = one bounded pass. Deep run = decompose, fan out, iterate,
counterevidence, synthesize. `ambient.cjs` (planned) takes the 355.1 ambient trigger and offers
a run; it never fetches. 20 of 22 plans are executed.

SEED-097 lists Eureka as a MOS-CANVAS perspective with its own row: *"Which opportunities in
the permitted material deserve exploration now? A ranked portfolio of candidate options with
reasons, novelty-to-room and next actions."* Falsifier: *"Candidates are known duplicates, lack
evidence or relevance, or the ordering adds no value."* And V5: *"The current ambient pair
selector/Eureka guard is not a universal runner. Extend only the seams needed ... no compulsory
re-embedding/index migration."*

So the design question is not "how should Eureka's pipeline look". It is: **what does the
Eureka perspective contribute to the planner, and which of Eureka's 17,600 lines is that
contribution?**

## 3. The contribution, decomposed (one stage, one job)

| Job | Question | Owner in v2 | From today's code | Dropped |
|---|---|---|---|---|
| Substrate | What are the things, which domain, what does the room already connect? | `01_substrate` (Eureka perspective, local) | `room-native-substrate.cjs`, `candidate-exclusion.cjs`, `section-registry.cjs::isIndexableArtifactFile` (the SEED-101 predicate) | entity pre-step (Haiku) inside Eureka |
| Recall | Which cross-domain pairs are worth a look, that the room does **not** already connect? | `02_recall` (Eureka perspective, local, capped) | graph lane (room edges as the **exclusion** set, not the candidate set); lexical lane `tri-modal-index.cjs::lexicalSearch` (FTS5/BM25); optional vector lane `embedding-spine.cjs` + `vector-store.cjs` behind a content hash | all-pairs enumeration; per-pair cohort re-sort; AHP as verdict |
| First-pass judgment | Mechanism or vocabulary? Known or new? | `03_judge`: Stage A regex gates (free), then Jev `usefulness_judge` at its measured band | `eureka-critic.cjs` Stage A; the `usefulness_judge` profile; `confidenceFromBucket` | `scoreMeasured` differential as judgment; Stage B `runRubric` (never reached); the side channel (cannot fire) |
| Question | Turn a surviving pair into a research question with a lens and a falsifier | the planner's `question-templates.cjs` (Eureka template) | the Opportunity-Statement fields | `report-html.cjs`, the separate md/json report as a product |
| Research | Is this connection in the literature, prior art, a competitor, a patent? | the planner (`quick.cjs` / `deep.cjs`, OpenAlex and the other adapters) | `online-pattern-query.cjs` if it survives the reuse check | Theo `find_connections` as the only verifier (80.2% `not_called`) |
| Verdict and prose | What is the opportunity, what transfers, what does not, one falsifier | the planner's `verdict.cjs` + Claude for prose | Stage A regex re-run on prose (no invented numbers) | |
| Decision | Bank, park, drop | the planner's `filing.cjs` through `navigation.writeOpportunityNode` (D-36..D-40), F.8 gate, proposed-only | the 355 filing contract, unchanged | the eureka runner's own `bankStatements` |
| Ambient | When does the room offer this on its own? | the planner's `ambient.cjs` on the 355.1 trigger; an **offer**, never a fetch | 355.1's throttle, lock, budget | `_eurekaAdapter`'s second scorer |

The recall stage is the only genuinely Eureka-specific compute that remains. Everything after
it is the planner. Everything before it is the room graph.

## 4. Where Jev sits, and where it does not

- **Jev is the first-pass judge on recalled pairs**, at the measured band. 76% overall reads as
  `medium` under the D-46 seam rule, so **every verdict is human-routed**: Jev orders and
  prunes the list the navigator sees; it never auto-passes and never auto-drops. It raises the
  navigator's useful rate above 44.8% only if it prunes the `not_useful` majority better than
  chance; the spike below measures exactly that.
- **Jev is the citation checker on research evidence** (95.35% agreement with the rule
  stated; auto-verdict slice 23/23, band `high`). That is the seam Phase 355 D-14 left as a
  comment ("judge: none") and Theo SEED-015 is drafting the ruling for. In v2 it sits in the
  planner's evidence rows, not in Eureka.
- **Jev cannot do recall** (no similarity endpoint; 62 million pairs), and **Jev cannot do
  "already known"** (2 of 96). Recall is local. Known-ness is a graph query: a candidate pair
  whose endpoints are already joined by a room edge, or already the two evidence ids of an
  existing `opportunity` node, is excluded before anything is judged. That one rule addresses
  the largest measured failure in the record.
- **Jev at runtime needs a ruling.** The client is dev-time only by tripwire (D-44: nothing
  under `lib/` or `hooks/` references `api.typesafe.ai`). The planner already has the
  `grants.cjs` and `audit-ledger.cjs` shape for governed egress; a runtime Jev call is one more
  grant under the same policy. This is the navigator's decision, not a code detail.

## 5. The shape on disk (ICM pipeline form, inside the planner's run home)

The planner owns the run home. The Eureka perspective adds two folders in front of it.

```
<room>/.mindrian/research/runs/<run-id>/
├── 01_substrate/output/things.jsonl          (Eureka perspective; local; room.db read-only)
├── 02_recall/output/candidates.jsonl         (Eureka perspective; local; capped; known pairs excluded)
├── 03_judge/output/verdicts.jsonl            (Stage A + Jev choice + band; human-routed)
├── 04_plan/PLAN.md                           (the planner: questions, lens, falsifier, every search string) <- F.6 approval
├── 05_evidence/rows/*.jsonl                  (the planner: hash-anchored rows; Jev citation check)
├── 06_verdict/output/statements.md           (the planner + Claude prose; regex re-run)
├── 07_filing/output/decisions.jsonl          (F.8 gate; writeOpportunityNode, proposed-only)
└── STATUS.md                                 (derived from which output files exist; never hand-edited)
```

Every `output/` file is an edit surface. Delete a line in `candidates.jsonl` and stage 03
judges what is left. Replace `verdicts.jsonl` with a gold file and stage 04 plans from it with
no model in the loop. That is also the whole spike harness. Where ICM loses (core.md): the
ambient path has no human between 01-03; that is acceptable because 01-03 write nothing to
`room.db` and stop at an offer.

## 6. Egress, declared once

One policy file, read by the planner's audit ledger. `--offline` sets every line false and the
run still completes (03 = Stage A only; 04 = plan only, not sent).

| Line | Endpoint | Default |
|---|---|---|
| recall vector lane model download | huggingface.co (model id only) | off |
| judge | api.typesafe.ai, `usefulness_judge` profile | on, pending the runtime ruling |
| research | OpenAlex and the planner's registered adapters, audited strings | on, per grant |
| citation check | api.typesafe.ai, `citation_check` profile | on, pending the runtime ruling |
| prose | host Claude session (user's plan) or api.anthropic.com (key) | host by default |
| Theo | `find_connections` via brain-client (canon handles only) | on |
| entity extraction | api.anthropic.com, `claude-haiku-4-5` | **off inside this pipeline**; its own producer with its own line |

## 7. What retires

| Retired | Why |
|---|---|
| `scripts/eureka-portfolio-report.cjs` as the runner (2,570 lines) | the planner is the runner; recall and Stage A move to two small stage modules |
| all-pairs enumeration, per-pair cohort re-sort, AHP-as-verdict | replaced by capped lanes; AHP survives only as the ordering of candidates inside the cap |
| the separate Eureka report (md, json, html) | the planner's run home is the report |
| `_eurekaAdapter`'s title-only scorer | the planner's `ambient.cjs` offer |
| Stage B `runRubric`, the side channel, `runEurekaScan`, `hybridRetrieve()`/`rerank()` | ghosts (never reached or cannot fire) |
| the entity pre-step inside Eureka | its own producer; `--offline` today does not stop it |
| `commands/eureka.md` "report-only, ZERO writes" | false today; `/mos:eureka` becomes an alias for a quick run with the Eureka template |

What does **not** retire: `embedding-spine`, `vector-store`, `tri-modal-index`,
`fts-index-lifecycle`, `rrfFuse`. About 40 files outside the folder import them (`hsi-engine`,
`rs-engine`, `lazygraph-ops`, `navigation-engine`). They are the shared semantic index, not
Eureka, and they move to `lib/core/semantic-index/` under a reference-integrity gate
(ADR-E12), with a thread cap and a content-hash incremental index (SEED-099 A3/F3) applied
there, once, for every consumer.

## 8. Counter-metrics (Phase 343 rule)

| Stage optimizes | Watched by (counts only, never a health word) |
|---|---|
| 02 recall within cap | pairs the navigator later banks that came from outside the cap |
| 02 known-pair exclusion | banked opportunities later found to duplicate an existing node |
| 03 Jev `useful` | `useful` verdicts the navigator declines; `already_known` the navigator marks that Jev missed |
| 05 evidence rows | rows whose hash no longer resolves; citation checks contradicted |
| whole run | CPU-seconds, peak RSS, runs on battery (SEED-099) |

## 9. The spike that decides it (replaces SEED-100 as planted)

Same three fixture rooms as Phase 355, same blind-label protocol (`label-355-gold.cjs`), so
every number is comparable to the 44.8% baseline.

| Question | Arms | Decides |
|---|---|---|
| Q1 recall | graph-exclusion + lexical vs + vector lane, same cap | whether the vector lane stays |
| Q2 known-ness | with vs without the room-edge and existing-opportunity exclusion | expected to move the 45-of-96 "already known" count; if it does not, the failure is elsewhere |
| Q3 judge | Stage A only / Jev / Claude / Claude-then-Jev over the **same** `candidates.jsonl` | the default judge and its band |
| Q4 research | pairs that reached a quick run: useful rate with evidence vs without | whether the research step, not the judge, is what lifts the rate |
| Q5 cost and laptop | tokens, dollars, CPU-s, RSS, wall time per arm | ambient budget |

The bar, fixed before the run (the D-45 habit): a candidate arm is adopted only if its
navigator-judged useful rate sits **above** 44.8% with a Wilson interval that clears it, on
three repeats. Nothing in this design assumes the answer.

## 10. ADRs (proposed)

- **ADR-E13: Eureka is a perspective, not an engine.** It contributes substrate + recall + a
  question template to the one research planner. Alternatives: fix the engine in place
  (SEED-099/100 as first planted; keeps two runners, two filers, two ambient scorers); delete
  Eureka outright (loses the one measured-useful thing, cross-domain recall). Consequence: one
  runner, one egress policy, one filing gate; the Eureka-specific code shrinks to two stage
  modules.
- **ADR-E14: Recall is local and lane-based with the room graph as the exclusion set.** The
  largest measured failure is re-surfacing known pairs; the room already knows what it knows.
- **ADR-E15: Jev is the first-pass judge and the citation checker, human-routed at the
  measured band; it never does recall and never decides.** Requires the runtime egress ruling.
- **ADR-E16: One declared egress policy; `--offline` means none of it.** Carried from the review.
- **ADR-E12 (carried): the semantic index splits out of `lib/core/eureka/` behind a
  reference-integrity gate.**

## 11. Order of work

1. **Stop the bleeding, no design needed:** SEED-099 spawner guards; `--offline` disables the
   Haiku pre-step; `--no-extract` forwarded. (Hours.)
2. **Land the two stage modules** (`substrate`, `recall` with the known-pair exclusion and the
   cap) writing files into a run folder, behind a flag, with the old runner untouched. The spike
   harness appears. (A plan.)
3. **The spike** (section 9), navigator labels. (A sitting, plus a plan.)
4. **Wire the Eureka question template into the planner** and retire the standalone runner per
   the spike's answer; `/mos:eureka` becomes the alias. (A phase, inside 363's successor.)
5. **Runtime Jev ruling and the egress policy file.** (Navigator decision, then a plan.)
6. **Semantic-index split** (ADR-E12), last, its own phase.

## 12. Decisions the navigator owns

1. Retire Eureka as a standalone engine in favour of the perspective inside the planner? (This document's premise; SEED-099 and SEED-100 narrow accordingly if yes.)
2. May Jev run at runtime under the planner's grant and audit ledger, or stay dev-time only?
3. Is the entity pre-step a declared egress line of the research planner, or a separate producer?
4. Will you label the spike's three rooms so the 44.8% baseline has a comparison?
