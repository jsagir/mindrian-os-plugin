---
phase: 240
plan: 02
created: 2026-07-30
purpose: Track items observed during execution but DELIBERATELY out of scope for this plan, per the executor scope-boundary rule.
---

# Phase 240 Plan 02 -- Deferred Items

## DI-240-02-01: tests/test-127.3-sibling-sweep.sh FAILS, pre-existing, unrelated to MEM-03

**Observed during:** Task 1 acceptance criteria verification (`bash tests/run-all-127.3.sh` must run green).

**Symptom:** `tests/run-all-127.3.sh` reports `2/3 green`; `tests/test-127.3-sibling-sweep.sh`
fails with:

```
FAIL: broken registry-resolution pattern found outside the chokepoint + deferral allow-list:

lib/core/resolve-umbilical-target.cjs:192, :264, :265
lib/core/navigation/room-birth.cjs:393, :418
lib/core/doctor/umbilical-module.cjs:134, :343
```

**Confirmed pre-existing and unrelated to this plan:** `git status --short` before and after
Task 1's edit shows only `tests/test-jtbd-auto-anchor-empirical.sh` changed. None of the three
flagged files (`resolve-umbilical-target.cjs`, `room-birth.cjs`, `doctor/umbilical-module.cjs`)
is in this plan's `files_modified` list, and none was touched by any commit in this plan. This
is a structural registry-pattern tripwire (Phase 127.3 Plan 03) that has drifted independently
of MEM-03.

**Scope boundary:** Fixing the 7 flagged call sites (rerouting them through
`lib/core/resolve-active-room.cjs` or adding them to the sibling-sweep's allow-list) is out of
scope for a hermeticity fix and is not one of this plan's three named files. Per the executor
scope-boundary rule, this is logged, not fixed.

**Hermeticity impact:** none. The `$HOME/MindrianRooms/.memory` and `.rooms` subtrees (the only
paths a leak could touch) were confirmed byte-identical before and after this same
`run-all-127.3.sh` invocation, and no `test-jtbd-127.3-empirical` artifact exists anywhere
under the real store post-run. The sibling-sweep failure is orthogonal to the acceptance
criterion's hermeticity claim.

**Recommended owner:** whichever phase or quick-task next touches
`lib/core/resolve-umbilical-target.cjs` / `lib/core/navigation/room-birth.cjs` /
`lib/core/doctor/umbilical-module.cjs`, or a dedicated Phase 129 follow-up per the sweep's own
header note ("Phase-129-deferral allow-list").

## DI-240-02-02: whole-tree `$HOME/MindrianRooms` digest is NOT stable in this dev environment

**Observed during:** Task 1 hermeticity verification.

**Symptom:** Two back-to-back whole-tree recursive digests of the real `$HOME/MindrianRooms`
(16,853 files), taken seconds apart with NO test suite running in between, differed. The single
differing file was `/home/jsagi/MindrianRooms/mindrianOS/STATE.md`, which is this very GSD
session's own live GSD state file (Phase 240 execution is actively writing STATE.md updates as
plans complete, per the standard GSD state-update flow) -- not touched by anything this plan's
test files write to.

**Resolution used instead:** verification was rescoped to the two subtrees where the leak
could actually land -- `$HOME/MindrianRooms/.memory` and `$HOME/MindrianRooms/.rooms` -- which
were confirmed byte-identical before and after both the standalone run and the
`run-all-127.3.sh` aggregator run. This is a stronger, not weaker, proof: it isolates the
measurement from known environmental noise (live GSD STATE.md writes from concurrent phase
execution) rather than papering over a real difference.

**Not a MEM-03 concern:** `tests/test-240-memory-store-hermetic-fence.sh` (240-02 Task 3) hashes
only `.memory/` and `.rooms/`-scoped roots inside sandboxed test HOMEs, never the real
`$HOME/MindrianRooms` whole tree in a way that would be sensitive to this noise; its Leg 2
fingerprints `<real-root>/.memory` and `<real-root>/.rooms` specifically, matching the scoping
used here.
