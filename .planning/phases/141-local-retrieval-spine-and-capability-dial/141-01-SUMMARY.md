---
phase: 141
plan: 01
subsystem: test-scaffold
tags: [nyquist, wave-0, retrieval-spine, capability-dial, tdd-red, fixture]
requires: []
provides:
  - tests/run-all-141.sh (Phase 141 scoped runner over 9 CJS suites)
  - tests/fixtures/room-141-fixture.cjs (buildFixtureDb: populated in-memory room.db)
  - 9 RED test suites (one per requirement cluster)
affects:
  - All later Phase 141 plans verify against a suite created here
tech_stack:
  added: []
  patterns:
    - "node:sqlite DatabaseSync in-memory fixture (caller-owned handle)"
    - "git show HEAD:... committed-tree drift assertion"
    - "backtick code-span hygiene for exact-set id drift tests"
    - "child_process spawn-script-assert-exit regression"
key_files:
  created:
    - tests/run-all-141.sh
    - tests/fixtures/room-141-fixture.cjs
    - tests/test-get-room-context.cjs
    - tests/test-retrieval-seed.cjs
    - tests/test-room-context-part8-invariant.cjs
    - tests/test-room-context-latency.cjs
    - tests/test-build-graph-guard.cjs
    - tests/test-capability-dial-committed.cjs
    - tests/test-reach-ids-drift.cjs
    - tests/test-posture-ids-drift.cjs
    - tests/test-fileval-readback.cjs
  modified: []
decisions:
  - "Drift tests assert against the COMMITTED tree (git show HEAD:...) so the working-tree-only SKILL.md edit stays untouched and the test goes green only once the doctrine is committed"
  - "Exact-set id drift uses backtick code-span extraction (not bare word count) so prose words (contradiction, hold) do not self-invalidate the set"
  - "Fixture is in-memory + caller-owned; never opens a real room.db (Canon Part 8/9)"
metrics:
  duration: ~9 minutes
  completed: 2026-06-05
  tasks: 3
  files: 11
  commits: 3
---

# Phase 141 Plan 01: Local Retrieval Spine + Capability Dial Wave-0 Scaffold Summary

Stood up the complete Nyquist test floor for Phase 141: a scoped runner, a populated in-memory fixture room.db builder, and all nine CJS suites in their RED state -- one automated check per requirement cluster, every one failing before its implementation lands in Waves 1-2.

## What Was Built

| Artifact | Requirement(s) | RED reason (current tree) |
|----------|----------------|---------------------------|
| `tests/run-all-141.sh` | runner | aggregates all 9 suites, exits non-zero while any is RED |
| `tests/fixtures/room-141-fixture.cjs` | fixture | `buildFixtureDb()` seeds 4 nodes (section + 2 contradicting claims + 1 EvidenceClaim slot), 3 edges (2 INFORMS + 1 CONTRADICTS), 1 session, 6 fragments |
| `tests/test-get-room-context.cjs` | RETR-01 | `navigation.getRoomContext` undefined |
| `tests/test-retrieval-seed.cjs` | RETR-02 | `userText: null` seam still present in intent-classifier.cjs |
| `tests/test-room-context-part8-invariant.cjs` | RETR-03 / D-03a | `lib/core/navigation/room-context.cjs` does not exist |
| `tests/test-room-context-latency.cjs` | RETR-04 | `navigation.getRoomContext` undefined |
| `tests/test-build-graph-guard.cjs` | BUG-01 | `lazygraphPath is not defined` ReferenceError -> exit 1 |
| `tests/test-capability-dial-committed.cjs` | LARRY-01/02 + DRSCH-01..04 | HEAD SKILL.md lacks "Capability Dial"; versions at beta.6 |
| `tests/test-reach-ids-drift.cjs` | LARRY-03 | committed reach-id code-span set is `[]`, not the canonical 5 |
| `tests/test-posture-ids-drift.cjs` | LARRY-04 / D-12 | committed Hierarchical Navigator section absent |
| `tests/test-fileval-readback.cjs` | FILEVAL-02 / D-02a | `navigation.fileEvidenceWithReadback` undefined |

## Verification

- `bash tests/run-all-141.sh` runs to completion (no crash): Total 9, Passed 0, Failed 9 -- RED as designed for a Wave-0 scaffold.
- `node -e "...buildFixtureDb()"` builds the fixture (nodes=4, edges=3, sessions=1, fragments=6); `getNeighborhood(db,'section:market-analysis',...)` returns 3 ranked nodes with a top-weighted CONTRADICTS edge, proving Leg C has real data to surface.
- Each suite is valid Node (requires without syntax error) and fails for its named RED reason or skips with exit 77 when node:sqlite is unavailable -- none falsely passes.
- Em-dash byte scan (grep for the U+2014 byte) returns 0 across all 11 created files (CLAUDE.md HARD rule).
- The working-tree `M skills/larry-personality/SKILL.md` edit was never staged or touched; it remains uncommitted and dirty as required by the sequential-execution constraint.

## Design Notes

- **Drift tests key off the committed tree.** `test-capability-dial-committed.cjs`, `test-reach-ids-drift.cjs`, and `test-posture-ids-drift.cjs` read `git show HEAD:skills/larry-personality/SKILL.md`, not the working tree. This is deliberate: the dial doctrine currently lives only as an uncommitted working-tree edit, so the suites stay RED until the implementation plan COMMITS the doctrine (D-06 ordering), and they cannot be falsely satisfied by the dirty file.
- **Code-span hygiene for exact-set drift.** The reach-id and posture-id sets are extracted only from backtick code spans inside the relevant section, so prose occurrences of "contradiction" or "hold" do not pollute the count. The implementation must add grep-able machine tokens (`context_block`, `contradiction`, `cross_room`, `brain_consult`, `deep_research`; `push_forward`, `hold`, `pull_back`) as code spans.
- **Fixture schema mirrors the Phase 109 migrated shape.** The nodes table carries `source_path NOT NULL`, the `created_by` CHECK set, `review_status` CHECK set, and `source_section`, so both the neighborhood CTE and the EvidenceClaim writer find every column they read.

## Deviations from Plan

None. Plan executed exactly as written. No Rule 1-4 deviations were required; this is a pure test-scaffold plan that installs zero packages (threat T-141-SC: no package surface) and reads only synthetic in-memory data (threat T-141-01: accepted).

## Known Stubs

None. The RED suites are intentional Wave-0 failing checks, not stubs -- each asserts real behavior that the Wave-1/2 implementation plans will satisfy. This is the Nyquist floor: every later task verifies against a suite created here.

## Self-Check: PASSED

- All 11 created files verified present on disk.
- All 3 task commits (3241bb35, 4d256ade, d9027ace) verified in git log.
- Em-dash byte scan returns 0 across all created files including this SUMMARY.
