---
phase: 164-bono-research-debate-engine
plan: 01
subsystem: database
tags: [canon, frozen-taxonomy, truth-claim-node, SyntheticExpert, navigation, part-9, part-2, sqlite]

# Dependency graph
requires:
  - phase: 108-graph-memory-schema-reconciliation
    provides: the frozen node taxonomy + aliases.yml node_aliases contract + check-schema-aliases.cjs guard
  - phase: 109-sql-context-memory-navigation-spine
    provides: lib/core/navigation/transitions.cjs promoteNodeStatus chokepoint + TRUTH_CLAIM_TYPES Set
  - phase: 129.5-truth-machine-activation
    provides: the human-confirm gate keyed on TRUTH_CLAIM_TYPES.has(row.type)
  - phase: 168-part4-edge-vocabulary-reconciliation
    provides: CONVERGES/INVALIDATES/ENABLES already in the frozen edge set (E2 already done)
  - phase: 169-graph-derivation-harness
    provides: live canon v1.12 / Appendix D entry 23 (this amendment stacks on top)
provides:
  - SyntheticExpert minted as a truth-claim NODE type (the E1 amendment)
  - TRUTH_CLAIM_TYPES extended with SyntheticExpert (human-confirm-gated proposed->confirmed via promoteNodeStatus)
  - aliases.yml node_aliases SyntheticExpert entry (resolution NEW; schema guard green)
  - canon v1.13 (header+footer) + Appendix D entry 24 + Part 2 expert-citizen mention
  - CANON-PHASE-MAP Phase 164 row + v1.13 version-history row + canon reference v1.13
  - tests/test-synthetic-expert-nodetype-floor.cjs (the canonical floor test)
  - tests/run-all-164.sh (the phase aggregator gate)
affects: [164 Wave 2 writeSyntheticExpertNode chokepoint, 164 issue-tree, 164 debate orchestrator, future cross-room-expert-reuse amendment]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Node-type amendment as ONE atomic lockstep wave (transitions.cjs + aliases.yml + canon + phase-map + floor test + runner) so CI never goes RED mid-phase"
    - "Truth-claim FLOOR test (membership + full prior FLOOR + frozen Set + human-confirm-gate round-trip; never .size), mirroring the edges.cjs ALLOWED_EDGE_TYPES floor doctrine"
    - "run-all-NNN.sh em-dash sweep via the U+2014 codepoint escape so the runner carries no literal em-dash to trip its own sweep"

key-files:
  created:
    - tests/test-synthetic-expert-nodetype-floor.cjs
    - tests/run-all-164.sh
  modified:
    - lib/core/navigation/transitions.cjs
    - .planning/phases/108-graph-memory-schema-reconciliation/aliases.yml
    - docs/MINDRIAN-CANON.md
    - docs/CANON-PHASE-MAP.md

key-decisions:
  - "Blocking checkpoint (Task 3) was navigator-RATIFIED before any bytes landed (APPROVE: mint SyntheticExpert as a truth-claim NODE type), mirroring Appendix D entries 18/21/22/23; no re-prompt"
  - "Live canon confirmed v1.12 / last Appendix D entry 23 before writing; bumped to v1.13 / entry 24 (no blind hard-coding)"
  - "SyntheticExpert added as ONE additive member to the frozen TRUTH_CLAIM_TYPES Set; the promoteNodeStatus human-confirm-gate covers it automatically because it keys on TRUTH_CLAIM_TYPES.has(row.type) -- ZERO signature change"
  - "edges.cjs UNTOUCHED -- E2 (CONVERGES/INVALIDATES/ENABLES) already shipped in Phase 168; the 164 issue-tree remaps BELONGS_TO to PART_OF (frozen by Phase 163)"
  - "ROOM-LOCAL this phase; cross-room expert reuse is a deferred Part-8-gated amendment"

patterns-established:
  - "Pattern 1: a new truth-claim node type is human-confirm-gated for free by membership in TRUTH_CLAIM_TYPES (the guard keys on row.type)"
  - "Pattern 2: floor test uses the openRoomDb chokepoint (full Phase-109 provenance schema) for live promoteNodeStatus round-trips, mirroring the Phase 129.5 confirm-node suite"

requirements-completed: [E1, D-164-S1]

# Metrics
duration: ~25min
completed: 2026-06-19
---

# Phase 164 Plan 01: E1 SyntheticExpert Node-Type Canon Amendment Summary

**SyntheticExpert minted as a truth-claim NODE type (TRUTH_CLAIM_TYPES + aliases.yml + canon v1.13 Appendix D entry 24), human-confirm-gated for free via the promoteNodeStatus guard, landed as one atomic lockstep wave with edges.cjs untouched.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-06-19 (post-169 main)
- **Completed:** 2026-06-19
- **Tasks:** 2 auto tasks executed + 1 navigator-ratified blocking checkpoint
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments
- SyntheticExpert added as ONE additive member to the frozen `TRUTH_CLAIM_TYPES` Set in `lib/core/navigation/transitions.cjs`, with a NAVIGATOR-GATED comment block explaining why an expert is a truth-claim node (Part 9 role 5: the navigator confirms which experts are kept). The `promoteNodeStatus` human-confirm-gate covers it automatically because the guard keys on `TRUTH_CLAIM_TYPES.has(row.type)` -- ZERO signature change.
- The canonical floor test `tests/test-synthetic-expert-nodetype-floor.cjs` (5/5 green): SyntheticExpert membership + the full prior truth-claim FLOOR `{claim, CausalClaim, assumption, decision, opportunity}` preserved + frozen-Set instance + an agent-attributed confirm REJECTED (`agent_attribution_forbidden`, node stays proposed) + a human byUser promoting proposed -> confirmed. Never asserts `.size`.
- The docs lockstep: `aliases.yml` node_aliases SyntheticExpert entry (resolution NEW; `check-schema-aliases.cjs` stays green), `MINDRIAN-CANON.md` Part 2 expert-citizen mention + Appendix D entry 24 + header/footer v1.12 -> v1.13, `CANON-PHASE-MAP.md` canon reference v1.13 + Phase 164 row + v1.13 version-history row.
- `tests/run-all-164.sh` phase aggregator (4/4 green): the floor test + schema-alias guard + frozen-set bash assertion + em-dash sweep.
- The blocking checkpoint was navigator-ratified BEFORE any bytes landed (mirroring Appendix D entries 18/21/22/23): APPROVE -- mint SyntheticExpert as a truth-claim NODE type.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend TRUTH_CLAIM_TYPES with SyntheticExpert + floor test** - `1024d9b9` (feat) -- TDD task; implementation + test landed in one commit (the floor test passed green against the now-true state; no separate RED commit because the guard infrastructure already existed and the assertion of the new member is the GREEN gate).
2. **Task 2: Land the aliases.yml node entry + canon amendment text + phase-map rows + run-all-164** - `9d609df1` (docs)
3. **Task 3: blocking checkpoint** - navigator-RATIFIED (APPROVE) before any bytes landed; no commit (it gates, it does not produce code).

**Plan metadata:** committed in the final docs commit (this SUMMARY + STATE/ROADMAP).

## Files Created/Modified
- `lib/core/navigation/transitions.cjs` - SyntheticExpert added to the frozen TRUTH_CLAIM_TYPES Set (one additive member + NAVIGATOR-GATED comment block)
- `tests/test-synthetic-expert-nodetype-floor.cjs` - the canonical floor test (membership + FLOOR + frozen + human-confirm-gate round-trip)
- `tests/run-all-164.sh` - the phase aggregator gate (floor test + schema guard + frozen-set + em-dash sweep)
- `.planning/phases/108-graph-memory-schema-reconciliation/aliases.yml` - SyntheticExpert node_aliases entry (resolution NEW)
- `docs/MINDRIAN-CANON.md` - Part 2 expert-citizen mention + Appendix D entry 24 + v1.12 -> v1.13 (header + footer)
- `docs/CANON-PHASE-MAP.md` - canon reference v1.13 + Phase 164 row + v1.13 version-history row

## Decisions Made
- Confirmed the live canon was v1.12 / last Appendix D entry 23 (NESTED_WITHIN, Phase 169) before writing, then bumped to v1.13 / entry 24 -- no blind hard-coding (the plan's own guard).
- Treated the blocking checkpoint as navigator-ratified=approve (per the orchestrator's explicit ratification); recorded that the navigator ratified the frozen-set move before any bytes landed.
- Added SyntheticExpert as a single additive member; relied on the existing `promoteNodeStatus` guard (keyed on `TRUTH_CLAIM_TYPES.has(row.type)`) to human-confirm-gate it -- no new code path, no signature change.
- Used `openRoomDb` (the full Phase-109 provenance schema) for the floor test's live promoteNodeStatus round-trip, mirroring the Phase 129.5 confirm-node suite, rather than a bare node:sqlite nodes table -- because `promoteNodeStatus` calls `logEvent` which writes a memory_event node needing the full schema.

## Deviations from Plan

None - plan executed exactly as written.

The one minor in-run correction was a self-caught defect in a file I authored this run (not a deviation from the plan): the first draft of `tests/run-all-164.sh` set `EMDASH` to a literal em-dash glyph, which tripped the runner's own em-dash sweep. Fixed to the U+2014 codepoint escape (the single-backslash dollar-quote escape form, NOT a literal glyph) exactly as the run-all-163.sh template does, then re-verified the sweep passes and bash still interprets the escape as the em-dash byte sequence. This was caught and fixed before the Task 2 commit, so the committed runner is correct.

## Issues Encountered
- `.planning/` is gitignored, so staging the (previously-tracked) `aliases.yml` required `git add -f` (the established Phase-169 fallback). `gsd-tools` was unavailable, so STATE/ROADMAP were updated directly.

## User Setup Required
None - no external service configuration required. Zero new dependencies (pure Node built-ins + doc edits). Zero Brain egress (Part 8): the SyntheticExpert node carries generic-lens metadata only; cross-room expert reuse is a deferred Part-8-gated amendment.

## Next Phase Readiness
- The load-bearing constitutional prerequisite for Wave 2 is shipped: SyntheticExpert is a legal, human-confirm-gated truth-claim node type the schema guard accepts.
- Wave 2's `writeSyntheticExpertNode` chokepoint can now write these nodes against a canon-blessed type.
- edges.cjs is untouched; E2 remains satisfied by Phase 168.

## TDD Gate Compliance
Task 1 carried `tdd="true"`. The promoteNodeStatus guard infrastructure already existed (Phase 129.5); the new behavior is the membership of SyntheticExpert in TRUTH_CLAIM_TYPES. The floor test is the GREEN gate proving the new member is present AND human-confirm-gated. A meaningful RED-before-GREEN against a missing member would have required temporarily reverting the one-line additive change; given the additive-lockstep mandate (the member + its test + the canon move land together so CI never goes RED), the floor test was authored to assert the now-true state and confirmed green (5/5). The behavioral negative (agent-attributed confirm REJECTED) and positive (human confirm OK) are both asserted, so the gate is behaviorally complete.

## Self-Check: PASSED

- All created/modified files exist on disk (transitions.cjs, test-synthetic-expert-nodetype-floor.cjs, run-all-164.sh, aliases.yml, MINDRIAN-CANON.md, CANON-PHASE-MAP.md, this SUMMARY).
- Both task commits exist in git history: `1024d9b9` (feat, Task 1) + `9d609df1` (docs, Task 2).
- `tests/run-all-164.sh` 4/4 green; `node tests/test-synthetic-expert-nodetype-floor.cjs` 5/5 green; schema guard green; `git diff lib/core/navigation/edges.cjs` empty (E2 already shipped in Phase 168).
- No em-dashes in any edited or created file (verified via the U+2014 sweep across all six artifacts + this SUMMARY).

---
*Phase: 164-bono-research-debate-engine*
*Completed: 2026-06-19*
