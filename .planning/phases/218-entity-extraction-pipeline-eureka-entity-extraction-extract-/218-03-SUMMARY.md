---
phase: 218-entity-extraction-pipeline-eureka-entity-extraction-extract-
plan: 03
subsystem: eureka-pipeline
tags: [dispatcher, sqlite, entity-extraction, eureka-ranking, cohort-percentile, cjs]

# Dependency graph
requires:
  - phase: 218-01
    provides: typed-entity.cjs writeEntityNode/linkEntityRelations + navigation re-export
  - phase: 218-02
    provides: openRoomDb D-05 write-safety + entity-extractor.cjs::extractEntities
  - phase: 216
    provides: eureka-command.cjs dispatcher shape (verb router + detached spawn + status.json)
  - phase: 215-02/215-04
    provides: portfolio-dimensions.cjs + eureka-portfolio-report.cjs (the ranking pipeline this plan's fix touches)
provides:
  - "scripts/entity-extract.cjs: standalone dispatcher (start/status/report/run), D-05 batch transaction, route-a post-commit re-embed"
  - "tests/run-all-218.sh: the phase aggregator (REQ-3/REQ-4 zero-touch git-diff gates, Part 8/9 grep gates, connector-registry check, noise-reduction leg, 211 regression)"
  - "Cohort-stratification fix (T-218-VD) to eureka-portfolio-report.cjs: validated_demand percentile now computed within node-type family, not pooled across scaffold + entity nodes"
  - "Title-resolution fix to room-native-substrate.cjs: ranked-pair titles read props.name (entity nodes) in addition to props.title/props.text"
affects: [eureka-command.cjs, eureka-portfolio-report.cjs, room-native-substrate.cjs, every future room with entity nodes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Live human-verify checkpoint caught a real bug the hermetic fixture test structurally could not: uniform-degree synthetic fixtures cannot exercise accumulated-hub-vs-newcomer skew"
    - "Cohort stratification: percentile-rank populations partitioned by a frozen closed type-set (ENTITY_NODE_TYPES), with a mathematically-guaranteed no-op fallback when the partition is empty (zero-entity-node rooms byte-identical to pre-fix)"

key-files:
  created:
    - scripts/entity-extract.cjs
    - tests/test-218-noise-reduction.cjs
    - tests/run-all-218.sh
    - tests/test-218-cohort-stratification.cjs
  modified:
    - scripts/eureka-portfolio-report.cjs
    - lib/core/eureka/room-native-substrate.cjs

key-decisions:
  - "REQ-5's numeric acceptance criterion (top-25 structural share < 50%) is the phase gate; entity-extraction PRECISION (whether extracted names are real domain content vs noise) is explicitly out of phase scope per 218-SPEC.md ('do not build entity-type disambiguation beyond simple capitalization/heading-context rules'; tier-2 NER 'deferred as a stretch goal only if tier-1 proves insufficient at verification time'). Tier-1 proved insufficient at verification time on real MindrianOS-authored prose (see Second Finding in 218-VERIFICATION.md) - this is the SPEC's own anticipated escape hatch firing, not a phase-218 regression, and is filed as a follow-up rather than blocking this phase."
  - "The checkpoint's own paused executor agent was NOT resumed after the root-cause fix; the orchestrating session finished Task 3's bookkeeping directly, since it held full context (checkpoint result + root-cause trace + fix + re-verification) a fresh continuation agent would have had to reconstruct from disk."
  - "Two logically-separate fixes landed in one commit (912139c9): the cohort-stratification ranking fix and the props.name title-resolution fix. Kept together because the title fix was discovered WHILE diagnosing the ranking fix's output and is a one-line, low-risk, obviously-correct companion change, not because the atomic-commit discipline was relaxed."

patterns-established:
  - "eureka-portfolio-report.cjs's per-node-type cohort stratification is the template for any future node family (e.g. a Phase 218-successor person/regulation type) that would otherwise be floor-pinned against long-lived scaffold degree."

requirements-completed: [REQ-3, REQ-4, REQ-5]

# Metrics
duration: ~3h (2/3 tasks by the sequential executor, ~35min; checkpoint pause; root-cause trace + fix + re-verify by the orchestrating session, ~2h20min)
completed: 2026-07-12
---

# Phase 218 Plan 03: Standalone Dispatcher + Live REQ-5 Proof Summary

**`entity-extract.cjs` wires the Plan 01/02 pieces into a runnable pipeline; the live human-verify checkpoint against `aion-eureka-synergy` found REQ-5's acceptance number had NOT moved (100.0% -> 100.0%), traced the root cause to a ranking-algorithm cohort-pooling bug (not an entity-extraction bug), fixed it, and re-verified live: 100.0% -> 0.0%.**

## What shipped

**Task 1-2 (sequential executor, autonomous):** `scripts/entity-extract.cjs` clones `eureka-command.cjs`'s verb-router/detached-spawn/status.json shape. `run` walks a room's artifacts, calls `extractEntities` per artifact, batches all node+edge writes in one `BEGIN`/`COMMIT`/`ROLLBACK` transaction through `navigation.writeEntityNode`/`linkEntityRelations`, then best-effort re-embeds via `tri-modal-index.indexNodes` after the commit (route-a, REQ-3 Open Question 1, resolved). `tests/run-all-218.sh` aggregates every phase gate: the four unit legs, `git diff --exit-code` zero-touch proofs for REQ-3 (`vector-store.cjs`)/REQ-4 (`insights.cjs`, `graph-ops.cjs`), Part 8/9 grep gates, the connector-registry no-leaked-surface check, the hermetic noise-reduction directional test, and the 211 regression suite.

**Task 3 (human-verify checkpoint, this session):**
1. Baseline captured live on `aion-eureka-synergy`: 647 nodes / 92 edges, top-25 100.0% (25/25) `memory_artifact`-vs-`memory_artifact`.
2. Extraction run live: 149 proposed entity nodes (`company`/`market`), 462 new typed edges, `embedded:true`.
3. Re-ranked: top-25 was STILL 100.0% structural. REQ-5 acceptance criterion NOT met on first live pass.
4. Root cause traced (not guessed): `scripts/eureka-portfolio-report.cjs` pools every indexed node into one cohort array before `portfolio-dimensions.cjs::scoreTechDimensions` computes `validated_demand` as a `pair_count` percentile rank. Long-lived `memory_artifact` nodes carry accumulated degree in the dozens; fresh entity nodes start at degree 1-3. Pooled into one percentile population, entity nodes are floor-pinned regardless of relevance. The existing hermetic fixture test (`test-218-noise-reduction.cjs`) didn't catch this because its 6-node fully-cited `CONVERGES` clique gives every node identical degree - no hub skew to reproduce the bug against.
5. Fixed: stratified the cohort by `ENTITY_NODE_TYPES` membership before percentile-ranking, so entity nodes rank against same-age peers instead of accumulated hub degree. Zero-entity rooms are unaffected by construction. New regression test `tests/test-218-cohort-stratification.cjs` (2 legs: the mechanism against the pure classifier, and a zero-entity-node identity guard against the real runner) wired into `run-all-218.sh`.
6. Companion fix: `room-native-substrate.cjs`'s title resolution didn't know entity nodes carry their name in `props.name` (only checked `props.title`/`props.text`), so ranked-pair output showed raw hashed ids. Fixed to match `tri-modal-index.cjs::nodeText`'s existing `props.name` precedent.
7. Re-verified live: top-25 structural share **100.0% -> 0.0% (0/25)**. Full suite re-run clean: Phase 218 12/12, Phase 215 8/8, Phase 211 10/10.
8. **Second finding, surfaced by the fix:** the now-visible top-25 entity pairs are dominated by tier-1 extraction noise - MindrianOS's own meta-vocabulary (`ROOM.md`, `Canon`, `ICM Layer`, `TAM`, `SAM`, `AAAK Record`) misclassified as `company`/`market` entities, exactly the `218-RESEARCH.md` Pitfall 4 risk. This was invisible before the ranking fix (all entity nodes were floor-pinned regardless of quality) and is a tier-1 extraction PRECISION gap, not a phase-218 REQ-5 regression. Filed as a follow-up per the SPEC's own pre-decided tier-2 escape hatch (see key-decisions).

Full trace, live numbers, and both findings logged in `218-VERIFICATION.md`.

## Requirements verified

- REQ-3 (embedding reuse): `git diff --exit-code lib/core/eureka/vector-store.cjs` clean; route-a re-embed confirmed `embedded:true` live.
- REQ-4 (zero-touch propagation): `git diff --exit-code lib/core/navigation/insights.cjs lib/core/graph-ops.cjs` clean.
- REQ-5 (structural-noise reduction): live before/after on `aion-eureka-synergy`, 100.0% -> 0.0%, logged in `218-VERIFICATION.md`.

## Self-Check: PASSED
