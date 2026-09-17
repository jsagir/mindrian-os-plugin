---
spike: 002
name: jev-section-framework-ranker
type: standard
validates: "Given a room section + problem type + stage and Theo's canonical frameworks (name + JTBD statement + glossary line), when one Score per framework is asked, then the ranking tracks a hand-labeled first-move fit set better than graph-degree order and confidence separates clear from unclear cases"
verdict: PARTIAL
related: [001, 003, 004]
tags: [typesafe, jev, ledger, ranking, part8, theo-data-quality]
---

# Spike 002: jev-section-framework-ranker

## What This Validates

Given a section, problem type and stage, and every canonical Framework node in Theo,
when Jev scores each framework as a FIRST move on a three-level rubric, then (a) the
ranking correlates with a hand-labeled fit set written before any call, (b) it beats the
graph-degree baseline (number of `/mos:` commands declaring the framework, the signal the
mentor report called wrong), and (c) confidence is higher on clear cases (label 0 or 2)
than on unclear ones (label 1).

## Research

- TypeSafe `primitives/score.md`: `score` is the probability-weighted level index; levels
  must "describe situations, not degrees"; the model does not see level numbers.
- TypeSafe `cookbooks/rerank_typesafe.md`: one judgment per candidate, sorted by the
  returned number; 1,200 calls cost $0.0645 in their example (vendor figure).
- Theo read contract, measured in this spike: ROW_CAP=100 returns `{text:"ROW_CAP..."}`
  with ZERO rows; `Skip`, `Distinct`, `NodeUniqueIndexSeekByRange` are PLAN_REJECTED;
  `toLower(left(f.name,1)) = 'a'` plans as NodeByLabelScan + Filter and passes
  (allow-list: Theo `src/mcp/content/find-frameworks-for-problem-type.ts`).

| Approach | Shape | Pros | Cons | Status |
|----------|-------|------|------|--------|
| A batched | one call per (scenario, 20 frameworks), one Score each over shared state | 84 calls for 4 x 410; shared context | larger state per call | chosen |
| B per-pair | one call per (scenario, framework), cookbook shape | isolates each judgment | 108 calls for 4 x 27 only | head-to-head |

A and B agree at Spearman 0.78-0.84 across scenarios, so A is safe for the ledger.

## How to Run

```bash
node rank.cjs           # SPIKE_DESC=ruling (default): name + JTBD statement + glossary line
node report.cjs         # renders report.html (De Stijl, 4 tabs)
```

`SPIKE_DESC=none|short|full` changes what crosses to TypeSafe. `full` sends Theo
descriptions and is navigator-run only (IP egress ruling in MANIFEST.md).

## What to Expect

- 410 canonical frameworks pulled in ~48 s (37 bucket queries).
- Per scenario: Spearman for Jev, Jev-B, degree; top-5 hits on label 2; confidence
  clear vs unclear; the full-set top 8 with `*` marking frameworks outside the index.
- `results.json` with every event; `report.html` for the eye.

## Observability

`results.json`: `events[]` (every request: label, status, ms, usage, attempt), per
scenario `ranked` (labeled set), `top_full` (full set top 12 with `in_index` and `stub`
flags), `metrics`, `usage`, `latency` (p50/p95/max). `theo-frameworks.json`: the pulled
working set with `stub`, `jtbd_anchor`, `definition`.

## Investigation Trail

1. First run: `brain.query()` returned 0 frameworks. Root cause: a single LIMIT 600 query
   trips Theo's ROW_CAP=100, and the client receives only a text notice, no rows.
2. Pagination by SKIP: PLAN_REJECTED. Name-range predicate: PLAN_REJECTED
   (`NodeUniqueIndexSeekByRange`). `OR ... IS NULL`: PLAN_REJECTED (`Distinct`).
3. Function-wrapped predicate on the first character passes (label scan + Filter).
   Largest bucket 47 rows. Working set = `alias_of` empty and `canonical <> false`:
   410 of 452 nodes.
4. Auto-mode classifier refused the run that would have posted 452 Theo descriptions to
   a third vendor. Correct on substance. Navigator ruling: name + JTBD statement +
   glossary line cross; descriptions stay home. `jtbd_anchor` turned out to be the Brain's
   closed job vocabulary (`detect_contradiction`, `suggest_next_move`, ...), not a
   sentence; rendered inline as the job a navigator hires the framework for.
5. Field presence on the 410: description stub or empty 305 (74 percent), `jtbd_anchor`
   130, `definition` 10. Most frameworks therefore crossed as a bare name plus a first
   sentence. "Mullins Model" is not canonical under that name (alias "John Mullins
   Framework"), so 26 of 27 labels were usable.
6. Run: 84 batched + 108 per-pair calls, 0 failures, 0 retries.
7. Substrate check refused the first commit: the puller assembled Cypher by string
   concatenation (rule m4). Rewritten as two fixed query texts with `$n`, `$prefix`,
   `$alnum` parameters; Theo accepts parameterized queries through the client.
8. Repeat run (full, unintended, via a `require` in a syntax check): Spearman S1 0.59,
   S2 0.63, S3 0.82, S4 0.19; A vs B 0.78-0.83; p50 320 ms, p95 892 ms, max 1569 ms.
   The ranking is stable run to run; the tail latency is not.

## Results

**Verdict: PARTIAL.** Validated where the section is well described by its name and the
right frameworks have real descriptions; weak where the labels lean on PWS-specific
frameworks whose Theo nodes are stubs.

| Scenario | Jev A | Jev B | Degree | Top-5 hits Jev / degree | Conf clear / unclear |
|---|---|---|---|---|---|
| S1 problem-definition / ill-defined / discovery | 0.59 | 0.63 | 0.06 | 2 / 1 | 0.45 / 0.22 |
| S2 opportunity-bank / undefined / discovery | 0.63 | 0.34 | 0.05 | 3 / 0 | 0.38 / 0.28 |
| S3 team-execution / well-defined / execution | 0.80 | 0.71 | 0.11 | 2 / 1 | 0.61 / 0.17 |
| S4 market-analysis / ill-defined / investment | 0.21 | -0.05 | 0.13 | 2 / 2 | 0.25 / 0.29 |

Full-set top picks (`*` = outside the 27-name index): S1 "The Why, What If and How of
Innovative Questioning*", "Contextual Inquiry*", Problem Definition Transformation,
"PWS-JTBD Innovation Discovery*", Beautiful Question. S3 "Dailies*", "Process Mapping*",
"Surgical Team Model*", "Five-Step Implementation*", "Commander's Intent*". 9-10 of every
scenario's top 12 are outside the index.

Surprises: "Well-Defined Problem Framework" ranked first for S2 and S4 from its name
alone (read as "the framework that produces well-defined problems"); the frameworks the
mentor wanted reachable (Effectuation, Dual-Use) exist in Theo and are rankable, but
their descriptions are stubs too; confidence did NOT drop on stub-description items
(0.42-0.62 vs 0.42-0.51), so stubs are not self-flagging.

Latency: 192 calls, p50 318 ms, p95 713 ms, max 1070 ms. Cost: 430,620 input tokens,
about $0.018 at the vendor-claimed $42 per 1e9 (unverified). A full ledger of ~240
section x type x stage combinations extrapolates to roughly $1 at that rate.

Impact: the ledger seat is real and cheap, precomputable, shippable as data. The
blocking dependency is Theo content: 305 stub descriptions, 280 missing JTBD anchors,
400 missing definitions. Fix the content before trusting the ranking outside
problem-definition and team-execution. Spike 003's latency question is answered by this
run's distribution; 004 stays as scoped.
