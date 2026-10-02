---
phase: 364-scientific-roadmapping-command-mos-scientific-roadmap-seed-0
plan: 04
subsystem: research-planner
tags: [entry-check, entry-resolver, navigation, read-only, nr-1, nr-2, nv-1, tdd]
requires:
  - phase: 364-01
    provides: requirements SRM364-01..21, tests/run-all-364.sh
provides:
  - lib/core/research-planner/sr-entry.cjs (ROOTING, ENTRY_RULES, BOUND_KINDS, resolveEntry, renderEntry)
  - tests/helpers/fixture-room-364.cjs (buildEntryRoom over twelve room states, MARKER)
  - tests/test-364-sr-entry.cjs (E1-E18, 37 checks)
affects: [364-05, 364-08, 364-09]
tech-stack:
  added: []
  patterns: [read-only room.db door with close in finally, first-match rule table, not_run provenance, never-throws resolver]
key-files:
  created:
    - lib/core/research-planner/sr-entry.cjs
    - tests/helpers/fixture-room-364.cjs
    - tests/test-364-sr-entry.cjs
  modified: []
key-decisions:
  - "Governing-question text is read through frame-provenance.readGoverningQuestion (read-only), because room.db stores only hashes and a handle for it, never prose."
  - "With --from-hypothesis and no claim on file but another WHAT present, the resolver still enters and discloses context_insufficient no_hypothesis_on_file; only a room with no WHAT at all routes back with reason no_hypothesis_on_file."
  - "A hypothesis in flight means an opportunity at lifecycle explored; a qualified one is only offered via explore_opportunity_offer."
  - "forum_not_on_file and goal_not_quantified follow the plan thresholds literally (entry above 4, entry above 2 with no quantified run), even when a design or futures read is on file."
requirements-completed: [SRM364-08, SRM364-09, SRM364-10, SRM364-18]
duration: ~35 min
completed: 2026-10-02
---

# Phase 364 Plan 04: Entry check and entry resolver Summary

Read-only entry check for Scientific Roadmapping: from local room state alone it decides whether a WHAT exists (else routes back to /mos:analyze-needs), proposes an entry step per the SEED-098 first-match table, records every skipped step as not_run with its stand-in, lists the bound inputs already filed, and writes nothing.

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Entry-room fixture builder and RED resolver legs | 21bbfa2a1 | tests/helpers/fixture-room-364.cjs, tests/test-364-sr-entry.cjs |
| 2 (GREEN) | sr-entry.cjs read-only resolver | c7a1345e2 | lib/core/research-planner/sr-entry.cjs |

Both shas are ancestors of HEAD. No file deletions in either commit.

## Verification

- `node tests/test-364-sr-entry.cjs` exits 0: PASS 37, FAIL 0 (E1-E18 plus contract-constant checks). RED run before the module existed exited non-zero.
- E13: room.db sha256, node and edge counts, opportunity lifecycles and the whole file tree (size and mtime, minus -shm) are identical before and after resolveEntry, for eleven DB-backed states, with and without fromHypothesis.
- E14 static scan: no writer name, no brain-client, no fetch( in non-comment lines; openRoomDbReadOnlyForCaller present (2 hits), grep for write/openRoomDbForCaller/advanceOpportunityStage/setGoal/writeFileSync/mkdirSync prints 0.
- No U+2014 or U+2013 in any of the three files. E18 zero network attempts.
- renderEntry never prints the rung (checked on WellDefined, Wicked and unknown-rung cards).

## Deviations from Plan

### Auto-fixed Issues

None as Rule 1-3 fixes. Two judgment calls inside the plan's latitude:

1. **Governing question text source.** The plan reads `readGoverningQuestionVersions(db)` for the question, but that reader returns hash and handle metadata only (Part 8: no prose in room.db). The resolver takes the node id from it and the text from `frame-provenance.readGoverningQuestion(db, roomDir)`, which reads the handle file read-only. The fixture creates the question through `setGoverningQuestion` (fixture only).
2. **One SELECT is filtered, not full-table.** The single SELECT carries a WHERE (claim, opportunity, EvidenceClaim types plus the four bound path segments) and a LIMIT 5000, to bound cost on a large room (T-364-15). Classification is still in memory.

## Known Stubs

None.

## Threat Flags

None. No new network endpoint, auth path or write path; T-364-13 to T-364-16 mitigations are covered by E13, E14, E15 and E18.

## Notes for downstream plans

- `resolveEntry` goal stand-in ids are `goal:v<goal_version>`; GQ id is the frame node id; claim id is the claim node id.
- Fixture `ids` carry goal, governing_question, claim, reverse_salient, dominant_design, future, opportunity, evidence_old, evidence_new, run. Every planted WHAT text contains `MARKER-364-ROOM` for the 364-09 Part 8 sweep.
- STATE.md and ROADMAP.md were not touched (orchestrator-owned this phase).

## Self-Check: PASSED

- FOUND: lib/core/research-planner/sr-entry.cjs, tests/helpers/fixture-room-364.cjs, tests/test-364-sr-entry.cjs
- FOUND commits: 21bbfa2a1, c7a1345e2
