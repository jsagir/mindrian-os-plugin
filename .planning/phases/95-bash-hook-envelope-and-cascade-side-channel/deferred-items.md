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
