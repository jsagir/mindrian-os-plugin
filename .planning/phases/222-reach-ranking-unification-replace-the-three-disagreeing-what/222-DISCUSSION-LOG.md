# Phase 222: Reach ranking unification - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-07-14
**Phase:** 222-reach-ranking-unification-replace-the-three-disagreeing-what
**Areas discussed:** Wiring point, Weight-state persistence, Update cadence, Test harness structure
**Mode:** --auto (single-pass, no interactive AskUserQuestion; recommended options auto-selected and logged per the workflow's auto-mode contract)

---

## Wiring point for the shared scored selection (Req 1-2)

| Option | Description | Selected |
|--------|-------------|----------|
| New pure function (`rankFiredCandidates`) ranking only the turn-fired subset | Reuses D4 blend inputs, respects the "detection stays untouched" boundary, no parallel code path inside `dial-reach-orchestrator.cjs` | ✓ |
| Extend `dial-reach-orchestrator.cjs` to accept a filtered candidate list | Would need to relax its fixed 6-canonical-reach assumption, risking the CLI dial's existing contract and tests | |
| Have `resolveFireSkill` call `dial-reach-orchestrator.cjs` directly and filter its output | Computes scores for all 6 reaches every turn even when only 1-2 fired; wasteful and conflates two different consumers' needs | |

**Selected:** New pure function, a thin ranking layer over the D4 blend, called by both `resolveFireSkill` and `dispatchCandidateReaches`.
**Notes:** Grounded in direct file reads this session (`f-selector-ranker.cjs`, `insight-sensors.cjs`, `dial-reach-orchestrator.cjs`, `navigation-engine.cjs`, `lib/mcp/tools/sensors.cjs`), not a blind default.

---

## Weight-state persistence (Req 3)

| Option | Description | Selected |
|--------|-------------|----------|
| room.db side-table (`ranker_weights`-style), atomic tmp+rename | Matches SEED-009's own already-reviewed proposal for this exact problem class | ✓ |
| A new JSON side-file in `.mindrian/` | Works, but diverges from SEED-009's precedent and the room.db-table convention this repo already leans toward for adaptive scalar state | |
| Extend room.db's typed-node graph with a `weight` node type | Over-engineered for scalar weight state; Part 9 reserves the graph for typed claims/edges, not tuning parameters | |

**Selected:** room.db side-table, per SEED-009's precedent.
**Notes:** Directly reuses reasoning already reviewed by this repo's own adversarial-review process (SEED-009's 2026-05-16 dual-graph verdict), not freshly invented.

---

## Hedge weight update cadence (Req 3)

| Option | Description | Selected |
|--------|-------------|----------|
| Bounded update, N=50 events (env-tunable) | Matches SEED-009's own stated bound and Phase 158's existing debounce discipline | ✓ |
| Update on every outcome event | Thrash risk with no accuracy benefit at this data scale | |
| Fixed wall-clock interval (e.g. daily) instead of event count | Decouples cadence from actual usage; a quiet room would never update, a busy one would update too rarely relative to its own volume | |

**Selected:** Event-count-bounded update, N=50 default, env-tunable.
**Notes:** N=50 is SEED-009's own number, reused rather than re-derived from nothing.

---

## Test harness structure (Req 5-6)

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror `run-all-209.sh`/`run-all-158.sh` structure, add reachability + frozen-scalar legs | Consistent with existing test-harness conventions; reachability legs follow the Phase 213-03 born-wired proof pattern | ✓ |
| Unit tests only, no dedicated `run-all-222.sh` | Would not satisfy the navigator's explicit "strong infrastructure, relevant harness" requirement, and misses the reachability-proof discipline this codebase specifically needs after the Phase 150.5 dead-sensor incident | |

**Selected:** `run-all-222.sh`, mirroring existing harness shape, with reachability legs proving the real MCP tools and the real engine call are on the new path (not a bypassed internal function call).
**Notes:** Direct response to a documented failure class in this codebase, not a generic best-practice gesture.

---

## Claude's Discretion

None -- all four areas had a single evidence-backed recommendation, auto-selected and logged with the rejected alternatives above. Exact room.db column names and the precise numeric default for N (beyond "matches SEED-009's N=50 precedent") are left to `/gsd-plan-phase 222`.

## Deferred Ideas

- Periodic Shapley-value attribution reporting (fast-follow, not required for this phase).
- `strategic_rank` fix and the synthesis-triggering expert -- SEED-057, deliberately deferred.
- SEED-034/SEED-058 eureka-engine reliability -- unrelated to this phase directly, but SEED-057 (which depends on this phase) is blocked on at least SEED-058.
- Three todos reviewed via `todo.match-phase`, none folded (keyword-score matches only, not topically relevant to reach ranking): the F7/212-213 rescope todo, the ignite persona-card display todo, the registry-drift-gate todo.
