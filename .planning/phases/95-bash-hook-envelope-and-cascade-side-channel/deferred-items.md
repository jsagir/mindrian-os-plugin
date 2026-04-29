# Phase 95 Deferred Items

Out-of-scope discoveries logged during plan execution. NOT fixed by the plan that found them.

## Plan 95-03 (room-proactive SKILL.md side-channel reader)

### 11 RED tests in tests/test-hook-envelope-shape.cjs

**Found during:** Plan 95-03 Task 2 STEP F regression check (running `node tests/test-hook-envelope-shape.cjs` after the SKILL.md edit).

**Discovery context:** `tests/test-hook-envelope-shape.cjs` was extended by the parallel Plan 95-04 executor (commit `1d2d6ce test(95-04): extend test-hook-envelope-shape with 6 bash hook scenarios (RED)`) to cover the 6 audit-target bash hooks (pre-compact, post-compact, on-file-changed, on-cwd-changed, on-agent-complete, on-task-complete). The extension adds 11 new scenarios that fail RED against the current pre-Plan-95-04-GREEN bash hooks.

**Failing scenarios (Plan 95-04 scope, NOT Plan 95-03 scope):**

1. `pre-compact silent-path` - status=no_room root key
2. `pre-compact message-path` - status=saved root key
3. `post-compact` - hookSpecificOutput not allowed for PostCompact event
4. `on-file-changed silent-diagnostic` - status=no_file root key
5. `on-cwd-changed silent-no-room` - status=no_room root key
6. `on-cwd-changed success-path (no NEW_DIR)` - status=same_room root key
7. `on-cwd-changed success-path with NEW_DIR` - status=same_room root key
8. `on-agent-complete silent-no-room` - status=no_room root key
9. `on-agent-complete cascade-path` - dual-JSON stdout (status + envelope)
10. `on-task-complete silent-no-room` - status=no_room root key
11. `on-task-complete summary-path` - status=ok + venture_stage root keys

**Why deferred:** Per the GSD deviation Rule SCOPE BOUNDARY, Plan 95-03 only auto-fixes issues DIRECTLY caused by the current task's changes. These 11 RED scenarios fail because of UNPATCHED bash hooks owned by Plan 95-04, not because of any change Plan 95-03 made. My Plan 95-03 changes are isolated to:
- `tests/test-room-proactive-side-channel.cjs` (new)
- `lib/memory/run-feynman-tests.cjs` (new entry)
- `skills/room-proactive/SKILL.md` (rewritten lines 80-113)

None of those touch the 6 bash hooks under test.

**Owner:** Plan 95-04 (`95-04-bash-hooks-envelope-fix-batch-PLAN.md`). The plan exists; the GREEN patches have not yet been committed by the parallel executor.

**Verification:** `tests/test-room-proactive-side-channel.cjs` (Plan 95-03 deliverable) is 6/6 GREEN. `tests/test-cascade-side-channel.cjs` (Plan 95-02 deliverable) is 5/5 GREEN. Plan 95-03 success criteria are met.

## Plan 95-05 (release-gate full-suite run)

### 3 pre-existing fixture failures unrelated to Phase 95 envelope work

**Found during:** Plan 95-05 Task 1 full Feynman suite run (`node lib/memory/run-feynman-tests.cjs`) on 2026-04-29.

**Suite result:** 108/111 passed, 0 skipped, **3 failed**. The 3 failures predate Phase 95 by multiple phases (84-smart-notebook + 85-self-update-platform fixtures); none touch any bash hook surface or envelope-shape contract that Phase 95 owns.

**Failing fixtures:**

1. **`test/84-smart-notebook-copilot.test.cjs` -> "phase 83 regression guard"** - assertion `feynman runner exit 0` failing inside Phase 84 fixture; pre-existing since `eac5536 release: v1.10.8 -- Smart Notebook Co-Pilot` (2026-04-14 era). Not touched by Phase 95.
2. **`tests/test-self-update-platform.cjs` -> 5 platform-branch assertions** (win32 copy branch, POSIX rename branch, uname -s fallback, exec bash line count, validation gate reads plugin.json) - pre-existing since `3b0cd9e fix(85-09): self-update Windows failure family`. The fixture asserts presence of specific code blocks in `bin/mindrian-self-update`; the script has since been refactored, leaving the fixture stale. Not touched by Phase 95.
3. **`84-smart-notebook-copilot.test.cjs` (exit 1)** - same root cause as #1; reported as a separate line by the runner.

**Why deferred:** Per the GSD deviation Rule SCOPE BOUNDARY, Plan 95-05 only auto-fixes issues DIRECTLY caused by the current task's changes. Phase 95's deliverables (post-write helper, side-channel writer, room-proactive SKILL.md, 6 audit-target bash hook helpers, 3 new regression test files) are 100% GREEN: 16/16 + 5/5 + 6/6 = 27/27 envelope-related scenarios pass. The 3 failing fixtures live in entirely separate phases of the codebase (Phase 84 + 85 self-update orchestration) and would require independent debugging effort that exceeds Plan 95-05's release-gate scope.

**Phase 95 deliverable verification (re-run for the record):**

```text
$ node tests/test-hook-envelope-shape.cjs
PostToolUse hook envelope shape: 16 passed, 0 failed
$ node tests/test-cascade-side-channel.cjs
bash post-write envelope + side-channel: 5 passed, 0 failed
$ node tests/test-room-proactive-side-channel.cjs
room-proactive side-channel contract: 6 passed, 0 failed
```

**Owner:** Future hotfix phases. Candidates:
- 84-smart-notebook regression guard: file under `phase 96 fixture-realignment` or rebaseline if the underlying behavior is correct.
- self-update-platform: re-run against current `bin/mindrian-self-update`, regenerate fixture against the active code shape, OR remove if the platform-branch logic has been intentionally simplified.

**Release impact:** None. The 3 failures were already present at v1.11.2 (the prior release), so v1.12.0 ships with the same pre-existing fixture deltas as v1.11.2 carried. The Phase 95 envelope work is the strict superset improvement.
