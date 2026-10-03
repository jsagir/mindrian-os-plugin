---
phase: 364-scientific-roadmapping-command-mos-scientific-roadmap-seed-0
plan: 02
subsystem: canon-snapshot
tags: [canon-snapshot, part8, framework-names, checkpoint, wave-0]
requires: []
provides:
  - "data/framework-names.json carries Scientific Roadmapping and a theo_stamp (written by the --live refresh, never by hand)"
  - "Part 8 guard classifies framework_step Scientific Roadmapping as allow / known_tool_shape"
affects: [364-05, 364-06, registry builders, part8-egress-guard]
tech-stack:
  added: []
  patterns: ["RED-first snapshot test", "navigator-reviewed canon diff (NV-3)"]
key-files:
  created:
    - tests/test-364-canon-snapshot.cjs
  modified:
    - data/framework-names.json
key-decisions:
  - "NV-3 ruling: navigator approved the refreshed snapshot with all 4 added names and the emptied stale_review"
requirements-completed: [SRM364-01]
duration: ~25 min
completed: 2026-10-03
---

# Phase 364 Plan 02: Canon snapshot refresh Summary

The canon snapshot now names Scientific Roadmapping with a theo_stamp, written by `node scripts/refresh-framework-names.cjs --live`, and the Part 8 guard allows the `framework_step` read for it. The navigator reviewed and approved the name diff before the snapshot was committed.

## Commits

| Task | Commit | Files |
| ---- | ------ | ----- |
| 1 RED test | 365a3d01a | tests/test-364-canon-snapshot.cjs |
| 3 snapshot | 8676aaa88 | data/framework-names.json (alone) |

Both commits are ancestors of HEAD and were made with `git commit --only`.

## RED proof (commit 365a3d01a)

FAIL on C1 (name absent), C2 (no theo_stamp) and C4 (guard returned `ambiguous / unknown` for `framework_step Scientific Roadmapping`). PASS on C3a, C3b, C5, C6 (x5) and C7: 9 pass, 3 fail. After the refresh the same test passes 12 of 12.

## Name diff (NV-3 checkpoint)

Classification: OTHERS-MOVED (3 names besides Scientific Roadmapping were added).

- framework_names 410 -> 414; curated_extras 1 -> 1; snapshot_date 2026-09-23 -> 2026-10-02.
- Added (4): Scientific Roadmapping, 80/20 Rule, Babson Model (Magical Thinking), Systematic Inventive Thinking (SIT).
- Removed 0; moved to curated_extras 0; dropped 0. No command-referenced name was lost.
- stale_review 19 -> 0. The 19 old entries were all `dropped` ("not a live Framework as of 2026-09-23"); the script regenerates the list per live run and nothing was stale, so it is empty. This explains the 99 deleted lines (diffstat 12 insertions, 99 deletions).
- theo_stamp: mapped_by `command-registry@2.0.0-beta.51`, plugin_version `2.0.0-beta.56`, refreshed_at `2026-10-02T20:10:16.708Z`.
- Names only: 0 `"description"` keys. The read went through the bucketed fallback (normal fallback path, exit 0).

Navigator ruling (relayed by the coordinator): "approved" for all 4 added names (Scientific Roadmapping, 80/20 Rule, Babson Model (Magical Thinking), Systematic Inventive Thinking (SIT)); the emptied stale_review is accepted.

## Verification

- `node scripts/refresh-framework-names.cjs --check`: exit 0 (414 names, hash verified).
- Acceptance one-liner (name present and theo_stamp.plugin_version): exit 0.
- Snapshot-reader baseline vs post-commit (HOME and MINDRIAN_ROOMS_HOME sandboxed): all 18 listed readers exit 0 both before and after, identical. test-364-canon-snapshot went 1 -> 0. test-connector-part8-boundary stays 1 (known red, not owned here: `connector mcp:artifact_file carries off-schema field "layer"`).
- No test pin needed updating.

## Deviations from Plan

None - plan executed as written. The checkpoint (Task 2) was returned to the coordinator and approved; Task 3 then ran as described.

## Auth gates

None. The `--live` refresh used the real HOME Brain token and succeeded.

## Known Stubs

None.

## Threat Flags

None. T-364-04 to T-364-07 mitigated: written only by the refresh script, committed after navigator approval, names only, and the C6 frameworks still resolve.

## Self-Check: PASSED

- tests/test-364-canon-snapshot.cjs: FOUND
- data/framework-names.json contains Scientific Roadmapping and theo_stamp: FOUND
- commits 365a3d01a and 8676aaa88: FOUND, ancestors of HEAD
