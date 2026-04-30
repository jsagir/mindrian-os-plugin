# Deferred Items (logged from Plan 95.1-07 execution)

## Pre-existing test failures (out of scope for Plan 95.1)

Discovered during Task 2 broader test sweep on 2026-04-30. These failures are NOT caused by Plan 95.1 changes (no files modified by Plan 95.1 touch these test paths' subjects):

- `tests/test-causal-seed.cjs` — exits 1 because it requires a path argument; not a true failure, just CLI usage.
- `tests/test-self-update-platform.cjs` — 19 passed / 5 failed (platform-specific). Pre-existing.
- `tests/test-sqlite-concurrent.cjs` — 1 fail. Pre-existing sqlite environment issue.
- `tests/test-sqlite-ops.cjs` — 3 fail. Pre-existing sqlite environment issue.

These are out of scope per Plan 95.1-07's deviation rule scope-boundary. Worth investigating in a future bug-fix sweep but NOT a Plan 95.1 regression.
