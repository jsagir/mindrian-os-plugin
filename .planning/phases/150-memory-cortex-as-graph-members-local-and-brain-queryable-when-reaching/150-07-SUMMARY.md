---
phase: 150-memory-cortex-as-graph-members-local-and-brain-queryable-when-reaching
plan: 07
subsystem: folder-memory / feynman
tags: [MEM-08, readQuintuple, feynman, seed-writer, body-freshness, canon-part-9, canon-part-8]
requires:
  - "150-01: memory_event node type + navigation chokepoint write surface"
  - "Phase 124: timeline-runner atomicWrite + bodyOutsideSentinels + sentinels"
  - "Phase 90-04: readQuadruple additive read contract"
provides:
  - "readQuintuple(sectionPath) -> {room, state, reasoning, brain, feynman} (sync + async)"
  - "lib/core/feynman/feynman-seed-writer.cjs (the discover.md:170 seed-writer)"
  - "feynman_body_seeded + feynman_body_stale_flagged memory_event types (the freshness signal)"
affects:
  - "any consumer that wants the FEYNMAN human body in the read contract"
  - "discover.md DISC-10 (the seed-writer it promised now ships)"
tech-stack:
  added: []
  patterns:
    - "additive read-contract extension (readQuintuple composes readQuadruple, byte-preserves it)"
    - "Part 7 reuse of the shipped timeline-runner atomic-write + frontmatter + bodyOutsideSentinels idiom"
    - "system-bookkeeping memory_event projection (Part 9 v1.5 audit-node carve-out)"
key-files:
  created:
    - "tests/test-150-feynman-readback.cjs"
    - "lib/core/feynman/feynman-seed-writer.cjs"
  modified:
    - "lib/core/folder-memory.cjs"
    - "lib/core/folder-memory-async.cjs"
    - "lib/core/navigation/memory-events.cjs"
decisions:
  - "readQuintuple is additive on readQuadruple (never mutates the prior four fields); the test asserts deep-equality of the first four fields against readQuadruple"
  - "the feynman field carries the bodyOutsideSentinels HUMAN body only; the auto Timeline is excluded (Phase 124 owns the renderer; readQuintuple never re-derives the timeline)"
  - "the seed-writer routes the write through the SHIPPED timeline-runner atomicWrite idiom (the same helper the read contract reads back through), fulfilling discover.md:170 'via the shipped writer, never hand-write'"
  - "the body-freshness signal is a memory_event (feynman_body_seeded / _stale_flagged) carrying a freshness scalar / stale-flag ONLY; the FEYNMAN prose never lands in an event or in Brain (Part 8); the nodes are system-bookkeeping under the Part 9 v1.5 carve-out"
  - "the seed-writer is idempotent: it never clobbers an existing human body unless force=true (Phase 124 D-02 human-authorship invariant)"
metrics:
  duration: "~30m"
  completed: "2026-06-09"
  tasks: 3
  files-created: 2
  files-modified: 3
---

# Phase 150 Plan 07: FEYNMAN Read-Back + Seed-Writer + Body-Freshness Signal Summary

readQuintuple folds FEYNMAN.md into the per-folder read contract as an additive fifth field on readQuadruple, the missing discover.md:170 seed-writer ships, and the FEYNMAN write-only sink becomes a navigable graph signal (MEM-08).

## What Shipped

1. **readQuintuple (sync + async)** in `lib/core/folder-memory.cjs` + `lib/core/folder-memory-async.cjs`. Returns `{room, state, reasoning, brain, feynman}`. The first four fields are byte-preserved from readQuadruple (the test deep-equals them); the fifth `feynman` field carries the human-authored body region (`bodyOutsideSentinels`), excluding the auto Timeline. Async twin keeps AsyncFunction discipline and key-set parity with the sync entry point.

2. **The missing seed-writer** `lib/core/feynman/feynman-seed-writer.cjs` (`seedSection`). Fulfils the discover.md:170 promise: it seeds a fresh section's FEYNMAN human body via the SHIPPED Phase 124 timeline-runner atomic-write idiom (the same helpers the read contract reads back through), never a hand-written file. Idempotent: it never clobbers an existing human body unless `force=true`.

3. **The body-freshness graph signal**: two additive `EVENT_TYPES` strings (`feynman_body_seeded`, `feynman_body_stale_flagged`) projected via `navigation.cjs` `logMemoryEvent`. The seed-writer emits a freshness scalar / stale-flag the cortex can read, closing the FEYNMAN write-only sink. These are system-bookkeeping nodes (`created_by=system`, `review_status=confirmed`) under the Part 9 v1.5 audit-node carve-out.

## Tasks + Commits

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | RED suite (readback + seed + freshness) | 8c45636c |
| 2 | readQuintuple sync + async (additive) | 88d157e7 |
| 3 | seed-writer + body-freshness signal | 1f751996 |

## Verification

- `node tests/test-150-feynman-readback.cjs` -> PASS (5 assertions): readQuintuple shape + byte-preservation of the prior four fields + async parity/AsyncFunction discipline + seed-writer body round-trip + freshness signal projection + no dashes.
- `node -e` sync + async readQuintuple presence + AsyncFunction key-set parity -> PASS.
- `lib/memory/folder-memory.test.cjs` 15/15 + `lib/memory/folder-memory-quadruple.test.cjs` 17/17 -> readTriple + readQuadruple bytes UNCHANGED.
- `tests/test-feynman-timeline-canon-part-9-invariant.cjs` 5/5 -> Part 9 invariant intact.
- `tests/test-feynman-timeline-runner.cjs` 8/8, `tests/test-navigation-memory-events.cjs` 10/10, `tests/test-breakthrough-event-types.cjs` 7/7 -> EVENT_TYPES floors (`>=`) all hold with +2.
- `bash tests/run-all-150.sh` -> 11 passed, 0 failed; the 150-07 surface (test-150-feynman-readback.cjs) is GREEN.

## Canon Gates

- **Part 8 (zero egress):** readQuintuple is a LOCAL read with no Brain MCP call. The freshness memory_event carries the section slug + a freshness scalar / stale-flag only; the FEYNMAN prose body never lands in an event and never crosses to Brain.
- **Part 9 (memory locality):** the body-freshness rows are system-bookkeeping nodes (memory_event / created_by=system) per the v1.5 audit-node carve-out -- they record what the system DID, never a venture truth-claim; role 5 (human-confirms-truth) is untouched, no truth-claim node is minted. All graph writes route through `navigation.cjs`, never a direct room.db open.
- **Part 7 (reuse):** the seed-writer + the read-back both reuse the SHIPPED Phase 124 timeline-runner `atomicWrite` + `parseFrontmatter` + `bodyOutsideSentinels` helpers; net-new is only the seed sequencing + the freshness projection + the additive read field.
- **Frozen contracts:** MAX_K=3, the 0.70/0.15 recommend gate, and DIAL_REACH_K=6 were NOT touched (this plan is a read-contract + write-back plan, not a selector plan); run-all-150 re-asserts them green.
- **No em-dash / no en-dash:** scanned across all created/modified files via String.fromCharCode codepoint check; clean.

## Deviations from Plan

None - plan executed exactly as written. The plan's "via the shipped lib/core/folder-memory.cjs writer" is interpreted as the canon-legal shared write idiom: folder-memory.cjs is read-only (it has no write export), so the seed-writer routes through the SHIPPED timeline-runner atomic-write helpers that the folder-memory read contract itself reuses (`extractFeynmanBody` reads back through the same `parseFrontmatter` + `bodyOutsideSentinels`). This honors the discover.md:170 "never hand-write FEYNMAN.md" intent while reusing the one shipped atomic-write path.

## Known Stubs

None. The seed-writer writes a real body, routes through the shipped writer, and the freshness signal lands as a real queryable memory_event.

## Deferred Issues (out of 150-07 scope)

- `bash tests/run-all-150.sh` reports 3 MISSING suites (`test-150-trigger.cjs`, `test-150-navigation-only-invariant.cjs`, `test-150-claim-harness.cjs`). Per the runner header these are owned by Plans 03 and 08; their absence is pre-existing and outside Plan 07's surface (Plan 07 owns only `test-150-feynman-readback.cjs`, which is GREEN). Not a regression introduced by this plan.

## Self-Check: PASSED

- FOUND: lib/core/feynman/feynman-seed-writer.cjs
- FOUND: tests/test-150-feynman-readback.cjs
- FOUND: lib/core/folder-memory.cjs (readQuintuple added)
- FOUND: lib/core/folder-memory-async.cjs (readQuintuple added)
- FOUND commit 8c45636c (Task 1 RED)
- FOUND commit 88d157e7 (Task 2 readQuintuple)
- FOUND commit 1f751996 (Task 3 seed-writer + freshness)
