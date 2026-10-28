---
phase: quick-261028-gmg
plan: 01
status: complete
quick_id: 261028-gmg
date: 2026-10-28
base: 30ff3e8d04575cacd4b4504f949a493b216c395f
branch: quick/section-job-room-declarations
commits:
  - 1c1fe209b (task 1)
  - 5fdcb2158 (task 2)
  - efa35c5f9 (task 3)
requirements: [QUICK-261028-gmg]
---

# Quick 261028-gmg: Room-level section-job declarations Summary

A room now declares a job id for its own custom sections in `<roomDir>/.mindrian/section-jobs.json`. The registry validates the file against the closed job vocabulary and navigator ratification. The doctor lists room-declared sections apart from canon sections. Canon always wins, and `getSectionJob(slug)` with no room is identical to base.

## What changed per task

### Task 1 (1c1fe209b): reader and room-aware getSectionJob

- `lib/core/section-registry.cjs`: added `readRoomSectionJobs(roomDir)`, `ROOM_SECTION_JOBS_REL`, `ROOM_SECTION_JOBS_SCHEMA`, `ROOM_SECTION_JOBS_VALUE_CAP` (64). `getSectionJob(slug, roomDir)` reads a room declaration only inside the existing `if (!row)` branch. The canon lookup line is unedited. Node built-ins only.
- Rules applied (all 22 plan revisions): `lstatSync` on `.mindrian` and on the file (symlink or non-regular is `file_symlink`), 262144-byte cap (`file_too_large`), every slug where `(slug in Object.prototype)` is true plus `prototype`, `.x`, `/`, backslash, NUL, over 128 chars is `invalid_slug`, `ratified_by` at most 64 characters, `ratified_at` starts YYYY-MM-DD, rejected `slug` and `job_id` cut to 64 characters after the checks, null-prototype declarations map, fresh read on each call, rejected sorted with file-level first.
- `tests/test-353-room-section-jobs.cjs` (new): A1-A7.
- `tests/run-all-353.sh`: header line, dated re-open note, one `run_if` leg, three files added to `PHASE_353_SURFACES`.

### Task 2 (5fdcb2158): doctor

- `lib/core/doctor/section-ruling-module.cjs`: one `readRoomSectionJobs(roomPath)` per check, `getSectionJob(slug, roomPath)` per section. A room-declared section goes to `job_sources.room` with no fingerprint check. Fifth drift class `room_declarations_rejected` (counted in `totalDrift`). Detail strings carry `room_declarations_rejected:N`, `job sources: canon:A, room-declared:B` and, when something was rejected, `rejected values cut to 64 chars`. `action_lines` is present only when non-empty. `fix()` logic is unchanged and never writes the declaration file. Header comment rewritten.
- `data/doctor-modules.json`: only the section-ruling `description` changed. Still 7 keys, no `auto_heal`, `introduced_version` unchanged.
- `tests/test-353-doctor-section-ruling.cjs`: stale count fixed to 30; D2-D6 added.

### Task 3 (efa35c5f9): callers

- `lib/core/feyminto/next-move.cjs`: `readJob(sectionPath, section, roomDir)`, `gatherNest` passes `roomDir`.
- `lib/core/navigation-engine.cjs`: ledger fallback passes `ctx.roomDir` when it is a non-empty string; one comment sentence added.
- `lib/core/room-skeleton-scaffold.cjs`: `getSectionJob(slug, roomDir)` plus a one-line comment (behavior-neutral).
- `tests/test-353-room-section-jobs.cjs`: C1-C4 added.
- Unchanged by decision: `scripts/eval-icm-writers.cjs`, `lib/core/navigation/section-gate.cjs`, `lib/core/feyminto/theo-ask.cjs`, `lib/core/room-map.cjs`, `data/section-job-canon.json` (git diff against 30ff3e8d0 is empty for all five).

## Test numbers (exact)

| Command | Result |
|---------|--------|
| node tests/test-353-room-section-jobs.cjs | PASS=77 FAIL=0 |
| node tests/test-353-doctor-section-ruling.cjs | PASS=49 FAIL=0 |
| node tests/test-doctor-module-contract-parity.cjs | ALL PASS (2 assertions), 30 modules |
| node tests/test-doctor-doc-parity.cjs | ALL PASS (3 assertions) |
| node tests/test-353-section-canon.cjs | PASS=11 FAIL=0 |
| node tests/test-353-ruling-doc.cjs | PASS=19 FAIL=0 |
| node tests/test-353-filing-gate.cjs | PASS=24 FAIL=0 |
| node tests/test-353-decide-budget.cjs | PASS=5 FAIL=0 |
| node tests/test-36925-next-move.cjs | 8 passed, 0 failed |
| node tests/test-36925-brief.cjs | 19 passed, 0 failed |
| node tests/test-36925-feyminto-contract.cjs | 7 passed, 0 failed |
| node tests/test-369-hook-require-graph.cjs | 5 passed, 0 failed |
| bash tests/run-all-353.sh | PASS=22 FAIL=1 SKIP=0; the only FAILED leg is `353: ledger shape (plan 02)` (baseline ENV GAP: repo-version.cjs refuses a .claude/worktrees checkout) |

Also: `git diff --exit-code 30ff3e8d0 -- <5 protected files>` clean; `git diff --check 30ff3e8d0` clean; em-dash and en-dash count 0 in every touched file; fleet report restored with `git checkout -- <file>` after the sweep; working tree clean after the three commits.

## TDD notes

- Task 1 RED: test failed on the four missing exports before any code (PASS=0 FAIL=4), then green at 64 checks (later 77 with C-cases).
- Task 2 RED: D2/D3 failed (job_sources undefined) before the module change.
- Task 3: the caller edits were made before the C1-C4 tests were appended (order slip). RED was then proven after the fact: I saved the caller diff to the scratchpad, ran `git checkout --` on the three caller files only, ran the test (C1, C2, C3 FAIL; C4 passes as designed), and re-applied the patch with `git apply`. No stash was used.

## Deviations from the plan

1. **C3 used its full form; the stated fallback was NOT needed.** The face path produced `tierCandidates` for the declared custom section `homepage` with no edit beyond the line-1189 change. No relaxation recorded.
2. **Task 3 TDD order** (see above): edits preceded tests; RED proven retroactively. Not a behavior deviation.
3. **Run-all leg placement:** the new `run_if` leg sits directly after the `doctor section-ruling` leg (before `release wiring`), as the plan states.
4. **`action_lines` on the ok path:** when a room declares sections and no drift exists, the ok result also carries `action_lines` (the `room-declared:` lines). The plan says "ok and warn paths only", "only when non-empty"; this follows it.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. T-gmg-01 to T-gmg-09 mitigations are all implemented and tested (symlink A6, prototype names A5/A7, size cap A6, 64-char cut A5/D3, unratified A5/D3, fix never writes D4).

## UNVERIFIED

- The two symlink cases (A6) ran and passed on this Linux/WSL host. They were not run on Windows, where the test prints SKIP on EPERM.
- No run against a real room under /home/jsagi/MindrianRooms (forbidden by the task).
- The `ledger shape` leg could not be made green in a worktree (pre-existing ENV GAP). It is unverified from the main checkout.
- The live Cowork and Desktop MCP paths (`suggest_next`, sensors) were not exercised; only `gatherNest`/`decide()` were tested directly.
- Nothing pushed, released, or version-bumped.

## Self-Check: PASSED

- Files exist: section-registry.cjs, section-ruling-module.cjs, test-353-room-section-jobs.cjs, this SUMMARY.
- Commits 1c1fe209b, 5fdcb2158, efa35c5f9 are in `git log 30ff3e8d0..HEAD`.
