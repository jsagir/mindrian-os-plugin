---
phase: 164-bono-research-debate-engine
plan: 02
subsystem: navigation
tags: [SyntheticExpert, navigation-chokepoint, library-first-assembly, anti-ossification, part-8, part-9, part-2, sqlite, bono]

# Dependency graph
requires:
  - phase: 164-01
    provides: SyntheticExpert frozen into TRUTH_CLAIM_TYPES + aliases.yml + the promoteNodeStatus human-confirm gate (the node type this wave writes)
  - phase: 163-02
    provides: lib/core/navigation/typed-domain.cjs writeDomainNode (the writer-chokepoint idiom mirrored verbatim)
  - phase: 140-01
    provides: lib/core/node-insert.cjs insertNode (the both-schema NOT-NULL-safe mint chokepoint)
  - phase: 129.5-02
    provides: lib/core/navigation/confirm-node.cjs confirmNode (the sole proposed->confirmed door)
  - phase: 109-04
    provides: lib/core/navigation/neighborhood.cjs getNeighborhood (the survival-walk chokepoint) + transitions.cjs promoteNodeStatus
provides:
  - writeSyntheticExpertNode chokepoint (lib/core/navigation/synthetic-expert.cjs) -- mints a proposed SyntheticExpert with generic-lens fields only
  - the frozen SYNTHETIC_EXPERT_FIELDS allow-list (the Part 8 forbidden_field gate) + the frozen HAT_COLORS de Bono Set + SYNTHETIC_EXPERT_NODE_ID idempotent id-minter
  - navigation.writeSyntheticExpertNode (the thin additive re-export, mirror writeDomainNode)
  - library-first team assembly (lib/core/expert-library.cjs): rankExpertsForSlot + isExpertStale + assembleTeam + offerExpertsForFiling
  - the three anti-ossification guards (mandatory fresh slot, Black always re-derived, reuse cap K<N with log())
  - tests/test-synthetic-expert-writer.cjs + tests/test-expert-library-assembly.cjs (registered in run-all-164.sh)
affects: [164 issue-tree, 164 debate orchestrator, future cross-room-expert-reuse amendment]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A new typed-node writer is a navigation submodule mirroring typed-domain.cjs writeDomainNode VERBATIM: a frozen field allow-list + a 31-multiplier idempotent id-minter + insertNode (lands review_status proposed by the column DEFAULT, never auto-confirmed) + a thin additive re-export through navigation.cjs"
    - "Part 8 generic-lens-only enforcement at a write chokepoint: a frozen field allow-list rejects forbidden_field BEFORE any insert, so no venture body ever reaches the props bag"
    - "library-first assembly: rank confirmed nodes by match-tier then lifecycle score, with survival_rate computed as a pure navigation.getNeighborhood graph walk (no Brain, no raw room.db, no node:sqlite require)"
    - "anti-ossification guards baked into assembly: mandatory fresh lens + Black always re-derived + reuse cap K<N with a log() when the cap bites"

key-files:
  created:
    - lib/core/navigation/synthetic-expert.cjs
    - lib/core/expert-library.cjs
    - tests/test-synthetic-expert-writer.cjs
    - tests/test-expert-library-assembly.cjs
  modified:
    - lib/core/navigation.cjs
    - tests/run-all-164.sh

key-decisions:
  - "writeSyntheticExpertNode mirrors typed-domain.cjs writeDomainNode in shape verbatim (Part 7 reuse): frozen allow-list + 31-multiplier id-minter + insertNode + additive JSON props; no new write primitive invented"
  - "The Part 8 gate fires FIRST (before hat/name validation): any params key outside SYNTHETIC_EXPERT_FIELDS returns forbidden_field with zero rows inserted, so a venture-body field never reaches any write path"
  - "survival_rate is a pure navigation.getNeighborhood depth-2 walk (REJECTED_BECAUSE sinks, INFORMS/VALIDATES/SUPPORTS to a downstream ruling survives); no-history is a neutral 0.5 prior"
  - "DEFAULT_WEIGHTS w1=0.40 (evidence) w2=0.35 (survival) w3=0.15 (recency) w4=0.50 (staleness penalty): evidence + survival dominate, recency is a tie-breaker, a stale expert is heavily penalized"
  - "offerExpertsForFiling RETURNS the Shape F candidate list (no AskUserQuestion, no promotion); the command surface renders the gate and the caller promotes APPROVE via navigation.confirmNode(byUser) (Part 9 role 5)"

patterns-established:
  - "Pattern 1: a new typed-node writer rides the existing navigation spine (insertNode + additive re-export), never a fork"
  - "Pattern 2: the consumer reader (expert-library) reaches the graph ONLY via the navigation chokepoint over a caller-owned db handle; it requires no room-db.cjs, no node:sqlite, no brain client"

requirements-completed: [E1, D-164-S1]

# Metrics
duration: ~30min
completed: 2026-06-19
---

# Phase 164 Plan 02: E1 SyntheticExpert Writer + Library-First Assembly Summary

**The SyntheticExpert WRITER chokepoint (writeSyntheticExpertNode, generic-lens-only, proposed-mint, human-confirm-gated) plus library-first team assembly (rank by match-tier + lifecycle score via a pure navigation graph walk, freshness gate, three anti-ossification guards), both riding the existing navigation spine with zero new write primitives and zero Brain egress.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-06-19 (post-164-01 main)
- **Completed:** 2026-06-19
- **Tasks:** 2 auto TDD tasks (each RED-then-GREEN)
- **Files modified:** 6 (4 created, 2 modified)

## Accomplishments

### Task 1 -- writeSyntheticExpertNode chokepoint + navigation re-export
- `lib/core/navigation/synthetic-expert.cjs` (172 lines) mirrors `lib/core/navigation/typed-domain.cjs` `writeDomainNode` VERBATIM in shape: a frozen `SYNTHETIC_EXPERT_FIELDS` allow-list (the generic-lens-only Part 8 gate), a frozen `HAT_COLORS` de Bono Set (White/Red/Black/Yellow/Green/Blue), `SYNTHETIC_EXPERT_NODE_ID(sessionId, hat, surname)` a crypto-free 31-multiplier stable hash so re-writing the same (hat, surname, sessionId) is an UPSERT, and `writeSyntheticExpertNode(db, params)` that mints via the shared `insertNode` chokepoint.
- The node lands `review_status 'proposed'` by the column DEFAULT and is NEVER auto-confirmed; `created_by 'system'`; the props bag carries ONLY the 164-SYNTHETIC-EXPERTS.md table keys, snake_cased (hat / name / surname / archetype / beautiful_question / research_approach / evidence_tier / invocation_count / last_used / provenance). `provenance` is coerced to scalars/ids ONLY (runId string + domainNodeIds id-array); a prose-bearing extra key is dropped.
- The Part 8 generic-lens gate fires FIRST: any params key outside `SYNTHETIC_EXPERT_FIELDS` returns `{ok:false, reason:'forbidden_field'}` with zero rows inserted. An invalid hat returns `invalid_hat`; missing name/surname is a defensive failure; a non-object params bag never throws.
- Re-exported through `navigation.cjs` as a thin additive re-export (`writeSyntheticExpertNode` + `HAT_COLORS` + `SYNTHETIC_EXPERT_FIELDS` + `SYNTHETIC_EXPERT_NODE_ID`), exactly like the `writeDomainNode` block.
- `tests/test-synthetic-expert-writer.cjs` (216 lines, 8/8 green): proposed-mint with generic-lens fields, the forbidden_field rejection (with a zero-row assertion), the confirm-gate round-trip (the writer never auto-confirms; an agent-attributed `confirmNode` is rejected `agent_attribution_forbidden`; a human byUser promotes proposed -> confirmed), invalid-hat + defensive-failure, the navigation re-export, idempotent UPSERT, the chokepoint-only source scan, and the frozen-Set sanity.

### Task 2 -- library-first assembly (rank, freshness gate, anti-ossification guards)
- `lib/core/expert-library.cjs` (303 lines) ships the consumer that QUERIES the library FIRST and generates ONLY the gaps:
  - `rankExpertsForSlot(db, {hat, subdomain, domain, archetype})` queries CONFIRMED SyntheticExpert nodes over the caller-owned db handle, buckets by the four match tiers (exact hat+subdomain > exact hat+same domain > exact hat+same archetype > none), and within a tier scores by `w1*evidence_tier_rank + w2*survival_rate + w3*recency_decay(last_used) - w4*staleness_penalty` (weights from `DEFAULT_WEIGHTS`). A proposed expert is never ranked; a miss returns `[]`.
  - `computeSurvivalRate(db, expertId)` is a PURE `navigation.getNeighborhood` depth-2 walk: a reading reaching a downstream ruling via INFORMS/VALIDATES/SUPPORTS survives, a reading carrying a REJECTED_BECAUSE edge is overruled; the fraction that survived is the rate; no ruling history is a neutral 0.5 prior. An overruled expert sinks below a ruling expert (asserted).
  - `isExpertStale(db, expert, currentSubdomainHash)` mirrors the Act 1 source-hash invalidation: the recorded `governing_thought_hash` vs the current subdomain hash; a mismatch is stale. A missing input is NOT stale (do not punish on a missing judge).
  - `assembleTeam(db, {neededSlots, opts})` enforces the three anti-ossification guards (164-EXPERT-LIFECYCLE.md section 3): the Black hat is ALWAYS generate-fresh (adversarial freshness, never a library reuse); at least one slot per run is generate-fresh (the mandatory-fresh rule -- if every slot got reused, the lowest-ranked reuse is forced back to fresh); at most K of N slots are filled from the library (the reuse cap), with a `log()` of the reused-vs-generated summary and a note when the cap bites. Stale hits are skipped (the freshness gate) and fall back to generate-fresh.
  - `offerExpertsForFiling(runHats)` is the mint-at-Decision-Gate helper: it ranks the run's hats by contribution (evidence tier + survival rate) and RETURNS the Shape F candidate list. It does NOT call AskUserQuestion and does NOT promote; the command surface renders the gate and the caller promotes APPROVE via `navigation.confirmNode(byUser)` (Part 9 role 5).
- All reads go through the navigation chokepoint / the caller-owned handle. The module requires NO `room-db.cjs`, NO `node:sqlite`, NO brain client, and NEVER opens room.db itself (Part 8: zero Brain calls, no raw room.db open, no network surface) -- asserted by a source scan in the test.
- `tests/test-expert-library-assembly.cjs` (255 lines, 7/7 green): tier+score ranking with the proposed exclusion + the miss-returns-[], the survival-rate graph walk, the freshness gate (predicate + assembleTeam skip), the anti-ossification trio (Black re-derived + mandatory-fresh + reuse cap with log + the reused/generated summary), the filing candidate list, the Part 8 source scan, and the DEFAULT_WEIGHTS sanity.

### Phase gate
- `tests/run-all-164.sh` updated: both Wave-2 suites appended to `CJS_SUITES`, both source files + both tests added to the em-dash sweep targets. The aggregator is GREEN at 6/6 (3 CJS suites + the schema-alias guard + the frozen-set assertion + the em-dash sweep).
- The carried Wave-1 floor (`test-synthetic-expert-nodetype-floor.cjs` 5/5) stays green; the Waves 3-5 stubs are untouched (RED-by-absence: not registered in this runner). `typed-domain.cjs` regression green; `navigation.cjs` loads with `writeSyntheticExpertNode` reachable.

## Task Commits

Each task was committed atomically (TDD RED then GREEN):

1. **Task 1 RED** -- `a72b62ba` (test): failing writer test (module not yet created).
2. **Task 1 GREEN** -- `b8ab0ccf` (feat): `synthetic-expert.cjs` + the `navigation.cjs` re-export; writer test 8/8.
3. **Task 2 RED** -- `4643402c` (test): failing assembly test (module not yet created).
4. **Task 2 GREEN** -- `d4b9cb6d` (feat): `expert-library.cjs` + both Wave-2 suites registered in `run-all-164.sh`; assembly test 7/7, full gate 6/6.

**Plan metadata:** this SUMMARY + STATE.md + ROADMAP.md committed in the final docs commit.

## Files Created/Modified
- `lib/core/navigation/synthetic-expert.cjs` (created) -- writeSyntheticExpertNode + SYNTHETIC_EXPERT_FIELDS + HAT_COLORS + SYNTHETIC_EXPERT_NODE_ID
- `lib/core/expert-library.cjs` (created) -- rankExpertsForSlot + isExpertStale + assembleTeam + offerExpertsForFiling + computeSurvivalRate + DEFAULT_WEIGHTS
- `tests/test-synthetic-expert-writer.cjs` (created) -- the writer chokepoint suite
- `tests/test-expert-library-assembly.cjs` (created) -- the library-first assembly suite
- `lib/core/navigation.cjs` (modified) -- the thin additive writeSyntheticExpertNode re-export block (mirror writeDomainNode)
- `tests/run-all-164.sh` (modified) -- both Wave-2 suites registered + added to the em-dash sweep

## Decisions Made
- Mirrored `typed-domain.cjs writeDomainNode` verbatim in shape (Part 7 reuse-before-build); no new write primitive invented, the SyntheticExpert rides the existing navigation spine via `insertNode`.
- The Part 8 forbidden_field gate fires before any other validation so a venture-body key cannot reach any write path; the props bag copies ONLY the allow-listed generic-lens fields and a scalar-coerced provenance.
- `survival_rate` is a pure `getNeighborhood` graph walk (not raw SQL), satisfying the plan's "pure navigation.cjs graph walk" key-link; no-history returns a neutral 0.5 rather than 0 so an unused-but-confirmed expert is not punished.
- `assembleTeam` derives the mandatory-fresh guarantee structurally: Black always forces a fresh slot when a Black hat is present, and the no-Black-run path forces the lowest-ranked reuse back to fresh, so at least one fresh slot is guaranteed in every run.

## Deviations from Plan

None - plan executed exactly as written.

Two minor in-run corrections were self-caught defects in files I authored this run (not deviations from the plan):
1. The first draft of `test-expert-library-assembly.cjs` carried a stray `db.close && null;` line in Test 5 (which has no db handle), throwing a ReferenceError. Removed; Test 5 is db-free.
2. The first draft of `expert-library.cjs` header comment used the literal token `openRoomDb` while describing the caller-owns-the-handle contract; the test's Part 8 source scan correctly flagged the literal token even though the module never calls it. Reworded the comment to "obtained through the room-db chokepoint" so the scan passes honestly. Both were caught and fixed before the Task 2 GREEN commit.

## Issues Encountered
- `.planning/` is gitignored, so staging this SUMMARY requires `git add -f` (the established Phase-169 / 164-01 fallback). `gsd-tools` was unavailable, so STATE.md / ROADMAP.md were updated directly and committed.

## User Setup Required
None - no external service configuration required. Zero new dependencies (pure Node built-ins + the existing navigation spine). Zero Brain egress (Part 8): the SyntheticExpert node carries generic-lens metadata only, the library reader makes zero Brain calls and never opens room.db; cross-room expert reuse remains a deferred Part-8-gated amendment.

## Next Phase Readiness
- The writer + the library-first assembler are live: the BONO team-assembly path can now QUERY confirmed experts FIRST (rank + freshness + anti-ossification) and MINT new high-value team members as proposed SyntheticExpert nodes for the navigator to confirm at the Decision Gate.
- Waves 3-5 (the issue-tree surface, the debate orchestrator, the Part 8 leak scan) remain RED-by-absence (unregistered in run-all-164.sh); they append their suites as they land.
- `edges.cjs` is untouched; E2 remains satisfied by Phase 168.

## Known Stubs
None introduced. No hardcoded empty values flowing to UI, no placeholder text, no unwired data sources. `offerExpertsForFiling` intentionally returns the candidate list and defers promotion to the command surface + `confirmNode` (Part 9 role 5) -- this is the documented contract, not a stub.

## Threat Flags
None. The files introduce no new network surface, no new auth path, no schema change at a trust boundary. The threat register dispositions are all honored: T-164-05 (the SYNTHETIC_EXPERT_FIELDS allow-list rejects forbidden_field; provenance is scalars/ids only -- asserted by the writer test), T-164-06 (proposed-only mint + confirmNode the sole promotion door + agent confirm rejected -- asserted), T-164-07 (isExpertStale hash-gate + assembleTeam skips stale -- asserted), T-164-08 (anti-ossification guards -- asserted), T-164-09 (reads via navigation only, zero Brain calls -- source-scanned), T-164-SC (zero new packages).

## TDD Gate Compliance
Both tasks carried `tdd="true"`. Each followed RED-then-GREEN with separate commits: a `test(...)` commit landing a failing test (the module not yet created -> module-not-found / assertion failure), then a `feat(...)` commit landing the implementation that turns it green. Git log shows the sequence `a72b62ba test -> b8ab0ccf feat` (Task 1) and `4643402c test -> d4b9cb6d feat` (Task 2). The RED commits failed for the right reason (missing module, then the asserted behaviors), so the GREEN gate is behaviorally meaningful.

## Self-Check: PASSED

- All created/modified files exist on disk: synthetic-expert.cjs, expert-library.cjs, test-synthetic-expert-writer.cjs, test-expert-library-assembly.cjs, navigation.cjs (re-export), run-all-164.sh (registration), this SUMMARY.
- All four task commits exist in git history: a72b62ba, b8ab0ccf, 4643402c, d4b9cb6d.
- `node tests/test-synthetic-expert-writer.cjs` 8/8 green; `node tests/test-expert-library-assembly.cjs` 7/7 green; `bash tests/run-all-164.sh` 6/6 green; the carried Wave-1 floor 5/5 green.
- No em-dashes in any created or modified file (the run-all-164.sh em-dash sweep covers all six artifacts + passes).
- min_lines satisfied: synthetic-expert.cjs 172 (>=90), expert-library.cjs 303 (>=90), test-synthetic-expert-writer.cjs 216 (>=50), test-expert-library-assembly.cjs 255 (>=60).

---
*Phase: 164-bono-research-debate-engine*
*Completed: 2026-06-19*
