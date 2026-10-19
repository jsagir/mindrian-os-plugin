---
phase: 371
plan: "03"
status: human_needed
local_tasks_complete: 2
checkpoint_tasks_pending: 1
requirements_completed: [STARTUI371-01, STARTUI371-02, STARTUI371-03, STARTUI371-04, STARTUI371-05, STARTUI371-06, STARTUI371-07]
requirements_pending: [STARTUI371-08]
canon_parts: [3, 7, 8, 9, 11, 12]
---
# Plan 03 - local acceptance complete, real host checkpoint pending

Added tests/test-371-startup-ui.cjs and tests/run-all-371.sh, using actual server
snapshots and the real Apps SDK in a sandboxed browser. Final local runner passes
all matrix/regression/contract checks. Source-review fixes for refresh overlap and
missing-font fallback passed targeted tests and the final consolidated rerun.
Captured/inspected synthetic narrow/wide screens; updated the plugin UI guide.

Wrote code review, implementation UI audit, validation matrix, requirement-based
VERIFICATION.md and UAT checkpoint. Kept the earlier contract-checker review under
a distinct name. Recorded the original quick-task commits as prerequisite
provenance rather than presenting them as newly executed phase plans.

GSD mechanical validation initially found narrative-only plan metadata incomplete.
Added required must_haves and task structures without changing scope; all three
plans validate, with seven tasks and zero warnings. Plan 03 is autonomous:false
because its final task is a blocking real ChatGPT verification checkpoint.

Local work is complete; the final task is not. No live plugin/connection update,
release, tunnel, publication or account write was performed. Do not mark this
phase passed or requirement 08 complete until observed host evidence is recorded
or the navigator makes an explicit scope/deferral ruling.
