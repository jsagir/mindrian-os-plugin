# Phase 119 Deferred Items

## Out-of-scope failures observed during 119-00 execution

### 2026-05-16 (Plan 119-00 Task 3 execution)

- **tests/test-auto-explore-fingerprint.cjs Test 11** ("hooks.json contains preflight-auto-explore.cjs under SessionStart") is PRE-EXISTING RED. Verified by running the test with HEAD stashed: same failure. Not caused by Plan 119-00; the test asserts that a SessionStart hook entry exists for `preflight-auto-explore.cjs` but the current `hooks/hooks.json` does not include that line. This is a Phase 117 substrate hook-registration omission unrelated to Phase 119's sibling-hook insertion. Punt to a Phase 117 / Phase 121 housekeeping plan.
