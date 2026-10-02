---
phase: 366-eureka-perspective-in-research-planner-mcp-canvas-tooling
plan: 13
subsystem: research-planner
tags: [perspectives, rs, hsi, local-graph, direction-convention, classifyGraph, exclusion-set]
requires:
  - 366-04 (rs and hsi templates)
  - 366-08 (perspective interface, buildSubstrate eight keys, shared.makeCandidateStore / writeRunFiles / readCandidates)
provides:
  - perspectives/rs-recall.cjs (RS recall from section-level flow and ICM declared feeds)
  - perspectives/hsi-recall.cjs (HSI recall from lexical vs graph co-occurrence divergence)
  - direction-convention.classifyGraph, GRAPH_IDS, GRAPH_PHRASES, hashGraphTable, GRAPH_PHRASE_HASH
affects: [366-16 (ledger rows for the budgets below), 366-20 (spike re-measurement)]
tech-stack:
  added: []
  patterns:
    - section as the RS component, rank-normalized develop score, no absolute floor
    - second hashed phrase table beside FRAMING_*, never inside the confirmed table
key-files:
  created:
    - lib/core/research-planner/perspectives/rs-recall.cjs
    - lib/core/research-planner/perspectives/hsi-recall.cjs
    - tests/test-366-recall-rs.cjs
    - tests/test-366-recall-hsi.cjs
  modified:
    - lib/core/direction-convention.cjs
decisions:
  - "RS flow direction: INFORMS, ENABLES, SUPPLIES_TO point source -> target (source upstream); USES_COMPONENT and DERIVED_FROM point at the thing used or derived from, so the TARGET is upstream"
  - "RS develop(section) = mean of rank-normalized things count and rank-normalized anchored-claims count (ties get the average rank, a lone section reads 0.5); lag = median(develop of the strictly more developed upstream sections) - develop(self); lagging means lag above zero"
  - "RS pair ranking inside a boundary: thinnest lagging thing first (text length), then better-connected upstream thing (degree), then word overlap, then ids"
  - "HSI declared couplings are pseudo-neighbors section:<X> for every X the thing's own section is coupled to, so two things share one only through a common third section (a pair across two coupled sections does not get a free relational score)"
  - "classifyGraph takes lexical first, relational second and returns classifyDiff(relational - lexical), so a tie is semantic_implementation (PATTERNS discrepancy 1)"
metrics:
  tasks: 2
  files: 5
  completed: 2026-10-02
---

# Phase 366 Plan 13: RS and HSI graph recall perspectives Summary

RS and HSI re-derived from the local graph and ICM structure as two perspective recall modules on the shared substrate and exclusion set, plus a graph direction variant with its own hashed phrase table in `direction-convention.cjs`. No embeddings, no model, no network. `rs-engine` and `hsi-engine` are untouched; the spike decides.

## Commits

- c5feb42fd test(366-13): add failing test for the RS graph recall perspective
- 070e36775 feat(366-13): RS perspective recall from local graph flow and ICM declared feeds
- 45f512ac4 test(366-13): add failing test for the HSI graph recall and the graph direction variant
- 352a16604 feat(366-13): HSI graph recall and the graph direction variant (classifyGraph)

## What was built

- **rs-recall.cjs** (lanes `flow_boundary`, `icm_declared`, `support_gap`): one `buildSubstrate` read; section flow from typed edges between things in different sections plus directed feeds parsed by `declaredFeeds(roomDir, sections)` from each section's `CONTEXT.md` `## Inputs` (end anchor is `(?![\s\S])`, JavaScript has no `\Z`; a slug that is not a plain directory name is never read). Lag table (lagging sections only, ordered by lag) is written into the candidates.jsonl header as `lag`. Rows carry the shared keys plus `lag_score` (4 places) and `upstream` (the developed thing's id, used by questionSetFor to orient cause and effect).
- **hsi-recall.cjs** (lanes `relational`, `lexical`): lexical leg = `shared.jaccard` over tokens (body cap from `BUDGETS.body_cap`); relational leg = Jaccard over neighbor sets (DESCRIBES entities, USES_FRAMEWORK framework nodes, `section:<slug>` coupling pseudo-neighbors). Top-K per thing by |relational - lexical|, each pair proposed once so the exclusion counter counts distinct pairs. Rows carry `relational`, `divergence`, `direction`; header carries `phrase_hash`. The module holds no direction literal: `direction` is `classifyGraph(lexical, relational).label`.
- **direction-convention.cjs**: `GRAPH_IDS`, `GRAPH_PHRASES` (own table; `none` equals `NONE_MEANING`), `hashGraphTable(table)` (same shape as `hashFramingTable`; never calls `phraseHash()`), `GRAPH_PHRASE_HASH`, `classifyGraph(lexical, relational)`. Additions only: nothing inside `DIRECTION_MEANING`, `PHRASES_CONFIRMED`, `FRAMING_PHRASES` or `FRAMING_CONFIRMED` changed (0 removed lines in the diff).
- eureka-recall.cjs, shared.cjs, index.cjs: not edited. The 366-08 contract was sufficient; no gap to report.

## Numeric budgets and floors (for the 366-16 ledger rows)

| Perspective | Key | Value |
|-------------|-----|-------|
| rs | `BUDGETS.max_candidates` | 200 |
| rs | `BUDGETS.max_leaves` | 8 (pair leaves; the `rs-known` leaf is added on top, so 9 leaves at most) |
| rs | `BUDGETS.pairs_per_boundary` | 10 (also the per-side cap: at most 10 upstream things x 10 lagging things examined per boundary) |
| rs | lag floor | none (rank-normalized within the room, 355 D-46); lagging = lag above 0 |
| hsi | `BUDGETS.max_candidates` | 200 |
| hsi | `BUDGETS.max_leaves` | 8 (including the `hsi-known` leaf: 7 pair leaves at most) |
| hsi | `BUDGETS.per_thing_top_k` | 5 |
| hsi | `BUDGETS.body_cap` | 2000 |
| hsi | divergence floor | none; a pair needs relational above 0 or lexical above 0, ranked by |divergence| |
| hsi | `GRAPH_PHRASE_HASH` | `hashGraphTable(GRAPH_PHRASES)`, computed at load; a changed phrase changes it |

Counter metrics are not declared here (plan 366-16 declares them per stage once).

## Verification

- `node tests/test-366-recall-rs.cjs`: PASS 8, FAIL 0 (RS1-RS7 plus zero network)
- `node tests/test-366-recall-hsi.cjs`: PASS 8, FAIL 0 (H1-H7 plus zero network)
- `node tests/test-366-perspective-interface.cjs`: PASS 17, FAIL 0 (shared contract unaffected)
- Legacy 355 tests (run with HOME and MINDRIAN_ROOMS_HOME in temp dirs): direction-convention 31/0, direction-readers 28/0, floor-sweep 109/0, eureka-ranking-pin 45/0. direction-agreement is 187 pass, 1 fail: leg H lists exactly `lib/core/rs-chain-feeder.cjs` and `lib/memory/test-rs-discovery-engine.cjs`, the known baseline red that run-all-366.sh already tolerates through `run_known_if`; it was identical before this plan's edit and no new offender appeared.
- Acceptance greps: `classifyGraph` 3 occurrences in direction-convention.cjs; `function hashGraphTable` 1; `phraseHash(GRAPH` 0; rs-recall `embedding|vector|rs-engine|rs-math` 0; `makeCandidateStore` in rs-recall 2; `index.available('rs')` and `available('hsi')` true; no em-dash or en-dash in any touched file.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Plan expectation vs fixture] The planted rs pair cannot itself be a candidate**
- **Found during:** Task 1
- **Issue:** The plan says the planted rs pair `[pd/P1, pd/P2]` is among the candidates. Both are in the same section (the store never admits a same-section pair) and each already INFORMS the thin target `sd/S1`, so (P1, S1) and (P2, S1) are in the exclusion set by design.
- **Fix:** RS2 asserts the intended behavior instead: the lagging boundary problem-definition -> solution-design surfaces, `sd/S1` is paired with problem-definition things not yet connected to it, every such row carries `flow_boundary`, `icm_declared` and `support_gap` with `lag_score` above 0, and the lag table leads with solution-design. RS3 asserts (P1,S1) and (P2,S1) are excluded and `excluded_known` is at least 1.
- **Files modified:** tests/test-366-recall-rs.cjs
- **Commit:** c5feb42fd

**2. [Rule 2 - Honesty of truncation] Pairs never examined by the per-side cap are reported**
- **Found during:** Task 1 (RS4 caught it)
- **Issue:** The side cap that bounds pair explosion (T-366-56) silently dropped pairs when `pairs_per_boundary` was small, so `pairs_truncated` under-reported.
- **Fix:** `pairs_truncated` now also counts upstream x lagging pairs the side caps never examined.
- **Commit:** 070e36775

No other deviations. Task 2 was committed in the RED test then GREEN feature order, as was Task 1.

## Known Stubs

None.

## Threat Flags

None. No new network, auth or schema surface: read-only room.db door, run files only under `.mindrian/perspectives/<id>/` through `shared.writeRunFiles`, slugs from the graph are never turned into a path unless they are plain directory names.

## Notes for downstream plans

- `index.available('rs')` and `available('hsi')` are now true; the MCP and CLI doors (366-09 onward) can dispatch to them.
- `hsi` keeps `COMMAND = '/mos:scout hsi'` (explicit_only); the module sets `template_id` itself.
- Spike (366-20) should compare RS and HSI against the legacy engines on the 355 rooms; the direction labels use their own `GRAPH_PHRASE_HASH`, so direction agreement for new pairs needs new labels (RESEARCH Pattern 5).

## Self-Check: PASSED

Files exist: rs-recall.cjs, hsi-recall.cjs, test-366-recall-rs.cjs, test-366-recall-hsi.cjs, direction-convention.cjs (modified). Commits c5feb42fd, 070e36775, 45f512ac4, 352a16604 are in `git log`.
