---
quick_id: 261029-pnl
slug: panel-retired-file
status: executed
---

# Quick 261029-pnl: the panel still reads a file that Phase 341-08 retired

Navigator go: 2026-10-29, main session. Scope: SOURCE only. Generated files in lib/mos-face/dist are out of scope.

Task 1. Point the panel's post_update signal at the session-start verification result (local.ok === false in ~/.mindrian/session-verify/state.json). Keep 8 reads and the 4-second cut-off.
Task 2. Write the failing tests first (tests/test-380-status-parity.cjs, tests/test-380-shots-harness.cjs), then change status.ts, lines.ts, the fixture helper, the panel tests and the README.
Task 3. Run every offline test. Document the dist rebuild.
