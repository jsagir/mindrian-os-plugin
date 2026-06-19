# Phase 169 Deferred Items

Out-of-scope discoveries logged during execution (NOT fixed -- per the SCOPE
BOUNDARY rule, only issues directly caused by the current task's changes are
auto-fixed). No em-dashes.

## DI-169-04-01: test-131-substrate.cjs stale edge/event-type delta assertions (PRE-EXISTING)

- **Found during:** Plan 04 regression sweep.
- **Symptom:** `test1_researchEdgeTypesPresentAdditively` asserts the edge-type
  net-new delta over the pre-131 Set is "exactly 2"; `test2_researchEventTypesPresentAdditively`
  asserts the event-type delta is "exactly 3". Both FAIL because the frozen
  `ALLOWED_EDGE_TYPES` Set has grown far beyond the Phase-131 baseline across
  Phases 139 / 143.1 / 149 / 150 / 150.8 / 163 / 168 / 169 (every one an additive
  amendment). The canonical FLOOR tests assert membership + frozen-Set + a FLOOR,
  never an exact delta, exactly because of this growth.
- **Why out of scope:** this test pins an exact net-new COUNT against a frozen
  set that the canon explicitly grows additively. It is stale relative to the
  shipped vocabulary and fails INDEPENDENT of this plan (it references none of
  the 169 modules). The 169 floor test (`test-edges-part4-cascade-floor.cjs` +
  `test-edges-room-lineage-floor.cjs`) is the correct, additive-safe guard and is
  GREEN.
- **Disposition:** defer. The 131 substrate test should be migrated to a FLOOR +
  membership assertion (the post-150.8 idiom), not an exact delta. Not a 169 task.

## DI-169-04-02: test-sqlite-concurrent.cjs WAL-mode assertion (PRE-EXISTING)

- **Found during:** Plan 04 regression sweep.
- **Symptom:** `SQLITE-03: WAL concurrent access -> WAL mode is active on database`
  fails. The assertion checks `PRAGMA journal_mode` returns `wal` on a freshly
  opened db; the test environment (tmpfs / the WSL2 filesystem) silently falls
  back to a non-WAL journal mode for the test fixture path.
- **Why out of scope:** Plan 04 does not touch the WAL pragma (openRoomDb /
  openGraph still run `PRAGMA journal_mode = WAL` unchanged). The failure is
  environmental (filesystem-dependent WAL availability) and pre-existing.
- **Disposition:** defer. Environmental; needs a fixture-path / pragma-tolerance
  fix in the sqlite-concurrent test, not a 169 code change.

## DI-169-04-03: test-129.5-confirm-node.cjs promoteNodeStatus caller audit (PRE-EXISTING)

- **Found during:** Plan 04 regression sweep.
- **Symptom:** `confirmNode is the ONLY new production caller of promoteNodeStatus
  (source-grep audit)` fails: `unexpected production callers of promoteNodeStatus:
  lib/core/temporal/supersession.cjs`.
- **Why out of scope:** the audit found `lib/core/temporal/supersession.cjs` (a
  Phase 160-04 module -- "non-lossy supersession through the chokepoint", commit
  cdb5d5f6) as a second caller of `promoteNodeStatus`. That module predates this
  plan and is unrelated to the graph-derivation harness (the 129.5 test
  references none of the 169 modules). Plan 04 adds no caller of
  `promoteNodeStatus`.
- **Disposition:** defer. The 129.5 caller-audit allow-list should be updated to
  include the Phase-160 supersession caller, or the audit re-scoped. Not a 169 task.
