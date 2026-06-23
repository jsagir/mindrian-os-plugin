---
phase: 172-contextual-invocation-coverage
plan: 15
subsystem: orchestration
tags: [cirs, curated-chains, feeds-into, transform, multiplicative-composition, orchestration-projection, local-chain-recommender, part-8, part-11]

# Dependency graph
requires:
  - phase: 172-08
    provides: cross-class FEEDS_INTO (command/counterpart -> framework) curated_chains entries + the curatedChainEdges throw-on-dangling-endpoint contract
  - phase: 172-10
    provides: curated_chains {kind, from, to, confidence} entries + lib/workflow/local-chain-recommender.cjs (single-edge ranker) + the projection FEEDS_INTO chain layer
provides:
  - "curated_chains entries + projection FEEDS_INTO edges carry a `transform` handoff descriptor (mirrors the verified Brain {confidence, transform} edge schema)"
  - "recommendMultiHopChains(): multiplicative multi-hop chain-confidence composition (SPFO reduce formula) in the LOCAL recommender, Brain-off mirror of the Brain-on model"
  - "DI-172-09-01 cleared: the orchestration projection regen picked up the 172-12 ingest-methodology counterpart; --check exits 0"
affects: [172-13, suggest-next, /mos:act chain surfacing, orchestration projection]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Optional Part-8-legal scalar edge properties (confidence, transform) on the PROJECTION FEEDS_INTO edge via an EDGE_FIELD_ALLOWLIST extension + addEdge props arg, NEVER on the frozen navigation ALLOWED_EDGE_TYPES"
    - "Multiplicative multi-hop confidence composition (reduce c*=coalesce(r.confidence,0.5)) as the Brain-off mirror of the verified Brain chain model"

key-files:
  created:
    - tests/test-chain-transform-composition.cjs
  modified:
    - data/command-registry.json
    - scripts/build-orchestration-projection.cjs
    - data/brain-orchestration-projection.json
    - data/orchestration-command-ledger.json
    - data/harness-manifest.json
    - docs/ORCHESTRATION-PROJECTION-CONTRACT.md
    - lib/workflow/local-chain-recommender.cjs
    - tests/run-all-172.sh

key-decisions:
  - "transform is a SHORT generic handoff descriptor (enum/scalar machinery string, e.g. diverge-to-scenario), backfilled on all 15 curated_chains entries; never user content (Part 8)"
  - "Carried BOTH confidence and transform onto the materialized projection edge (not just transform) so the LOCAL projection is a faithful mirror of the verified Brain FEEDS_INTO {confidence, transform} edge"
  - "Added recommendMultiHopChains() as a NEW export; left recommendChainCandidates() (single-edge) byte-unchanged so 172-10 callers + the existing ranking test do not regress"
  - "A missing hop transform is positionally null in the surfaced transforms array, never silently dropped (the chain stays positionally faithful)"

patterns-established:
  - "Pattern 1: optional earned-chain scalars ride the PROJECTION FEEDS_INTO edge (EDGE_FIELD_ALLOWLIST + addEdge props), the navigation frozen edge set untouched (Part 11 R6 constraint C3)"
  - "Pattern 2: the local recommender composes multi-hop confidence with the verified SPFO reduce formula, deferring final surfaced ordering to the Part-3 MAX_K ranker (R6 ranking-deferral)"

requirements-completed: [INV-08]

# Metrics
duration: 38min
completed: 2026-06-23
---

# Phase 172 Plan 15: Align the LOCAL chain model to the verified Brain schema Summary

**curated_chains + projection FEEDS_INTO edges now carry a `transform` handoff descriptor mirroring the verified Brain {confidence, transform} edge, and the local recommender composes multi-hop chain confidence multiplicatively (SPFO reduce formula) so the Brain-off ranker matches the Brain-on model; the DI-172-09-01 projection STALE is cleared.**

## Performance

- **Duration:** 38 min
- **Started:** 2026-06-23T00:00:00Z (approx)
- **Completed:** 2026-06-23
- **Tasks:** 2
- **Files modified:** 8 (1 created, 7 modified)

## Accomplishments
- Added `transform` (a SHORT generic handoff descriptor) to all 15 `curated_chains` entries and materialized it (alongside `confidence`) onto the projection FEEDS_INTO / CHAINS / PREREQUISITE edges, mirroring the verified Brain edge schema. 13 FEEDS_INTO + 1 CHAINS + 1 PREREQUISITE = 15 chain edges now carry `transform`; 13 FEEDS_INTO carry `confidence`.
- Implemented `recommendMultiHopChains()` in the local recommender: walks acyclic chain paths from a seed framework up to maxHops, composing confidence MULTIPLICATIVELY with the verified SPFO formula `reduce(c=1.0, r | c * coalesce(r.confidence, 0.5))`, ordered by hops then composed-confidence DESC, carrying per-hop transform descriptors positionally. Brain-off mirror of the Brain-on model; zero Brain/network at rank time.
- Cleared DI-172-09-01: regenerating the projection picked up the 172-12 ingest-methodology counterpart (`/mos:ingest-methodology` moved from `excluded` to `ranked`, reach `brain_consult` / sub_mode `methodology-ingest`, SENS-09 trigger). `node scripts/build-orchestration-projection.cjs --check` now exits 0.
- Extended the Part-8 boundary `EDGE_FIELD_ALLOWLIST` with `confidence` + `transform`; the boundary scan (`test-orchestration-projection-part8-boundary.cjs`) passes 6/6 with the new fields (forbidden-value heuristic still fences any room/ path, email, or over-cap body).

## Task Commits

Each task was committed atomically:

1. **Task 1: Carry `transform` on curated_chains + the projection FEEDS_INTO** - `8149ed0c` (feat) - includes the sanctioned harness-manifest lockstep regen
2. **Task 2 (RED): failing test for multiplicative multi-hop composition** - `2c53b155` (test)
3. **Task 2 (GREEN): multiplicative multi-hop confidence composition** - `3d9f5cbb` (feat)

_Note: Task 2 was TDD (test -> feat)._

## Files Created/Modified
- `data/command-registry.json` - `transform` added to all 15 curated_chains entries (enum/scalar machinery descriptors)
- `scripts/build-orchestration-projection.cjs` - `addEdge` gains an optional `props` arg (copies only confidence/transform); `curatedChainEdges` passes `{confidence, transform}`; `EDGE_FIELD_ALLOWLIST` extended
- `data/brain-orchestration-projection.json` - REGENERATED: FEEDS_INTO/CHAINS/PREREQUISITE edges carry transform where sourced; ingest-methodology counterpart materialized (STALE cleared)
- `data/orchestration-command-ledger.json` - REGENERATED: /mos:ingest-methodology flips excluded -> ranked (69 ranked / 17 excluded / 15 gap)
- `data/harness-manifest.json` - REGENERATED (sanctioned pre-commit harness-manifest lockstep)
- `docs/ORCHESTRATION-PROJECTION-CONTRACT.md` - section 3 documents the optional `{confidence, transform}` edge scalars
- `lib/workflow/local-chain-recommender.cjs` - new `recommendMultiHopChains()` + `_buildChainAdjacency()`; single-edge `recommendChainCandidates()` unchanged
- `tests/test-chain-transform-composition.cjs` - NEW: 4-behavior composition test
- `tests/run-all-172.sh` - registers the new test

## Decisions Made
- `transform` carries BOTH on the curated_chains entry AND on the materialized projection edge, and the projection edge also carries `confidence`, so the LOCAL projection is a faithful mirror of the verified Brain `FEEDS_INTO {confidence, transform}` edge (not just the curated source).
- Multi-hop composition added as a NEW function (`recommendMultiHopChains`) rather than rewriting the single-edge ranker, so 172-10's `recommendChainCandidates` callers and the carried `test-curated-chains-ranking.cjs` (4/4) do not regress.
- A missing per-edge confidence coalesces to 0.5 (the SPFO default); a missing hop transform is positionally `null` in the surfaced `transforms` array, never dropped.
- `transform` rides the PROJECTION FEEDS_INTO only; `lib/core/navigation/edges.cjs` `ALLOWED_EDGE_TYPES` is UNTOUCHED (Part 11 R6 constraint C3; confirmed by diff + grep).

## Deviations from Plan

None - plan executed exactly as written.

The plan's Task 1 verify text says "alongside confidence" implying confidence was already on the projection edge. In fact, before this plan the projection edges carried NEITHER confidence NOR transform (confidence lived only in curated_chains, joined at rank time). This is not a deviation: the plan's explicit acceptance criteria (curated_chains carry transform; the generator copies transform onto the materialized edge; FEEDS_INTO edges carry transform where sourced; navigation ALLOWED_EDGE_TYPES untouched) are all met, and I additionally carried `confidence` onto the edge to fulfill the SPFO "faithful {confidence, transform} mirror" intent stated in the objective and the must_haves.

## Issues Encountered
- The pre-commit hook tripped the harness-manifest STALE tripwire on the Task 1 commit (a known sanctioned lockstep, called out in the plan prompt). Resolved by running `node scripts/build-harness-manifest.cjs` and staging `data/harness-manifest.json` into the same commit. CI never went RED mid-plan.

## Verification Outcomes
- `node scripts/build-orchestration-projection.cjs --check` exits 0 (DI-172-09-01 projection STALE cleared; remaining output is WARN-only COMMAND-GAPs that hard-flip in Plan 172-13, not failures).
- Task 1 verify assertion: 15 curated transforms, 13 FEEDS_INTO with transform, 13 FEEDS_INTO with confidence, 15 chain edges with transform.
- `node tests/test-chain-transform-composition.cjs` - 4/4 behaviors green.
- `node tests/test-curated-chains-ranking.cjs` - 4/4 (no single-edge regression).
- `node tests/test-orchestration-projection-part8-boundary.cjs` - 6/6 (Part-8 boundary scan green with the new edge fields).
- `bash tests/run-all-172.sh` - 16/16 green.
- `lib/core/navigation/edges.cjs` not in the plan diff (navigation frozen edge set untouched).

## Threat Flags

None - no new network endpoint, auth path, file-access pattern, or schema change at a trust boundary. `transform` is generic machinery metadata fenced by the existing EDGE_FIELD_ALLOWLIST + forbidden-value heuristic (T-172-40 accept; T-172-41/42 mitigations held: zero Brain at rank time, navigation edge untouched).

## Next Phase Readiness
- The projection is clean and not STALE; Plan 172-13's hard-flip (command-gap WARN -> hard-FAIL) can proceed on a green `--check`.
- The LOCAL chain model now carries transform + composes multiplicatively, a faithful Brain-off mirror; suggest-next / /mos:act chain surfacing can consume `recommendMultiHopChains` when wired.

## Self-Check: PASSED

- FOUND: .planning/phases/172-contextual-invocation-coverage/172-15-SUMMARY.md
- FOUND: tests/test-chain-transform-composition.cjs
- FOUND commit: 8149ed0c (Task 1 feat)
- FOUND commit: 2c53b155 (Task 2 test/RED)
- FOUND commit: 3d9f5cbb (Task 2 feat/GREEN)

---
*Phase: 172-contextual-invocation-coverage*
*Completed: 2026-06-23*
