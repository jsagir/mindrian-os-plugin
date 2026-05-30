# Phase 130 Deferred Items

## DI-130-04-01: Pre-existing em-dashes in lib/memory/run-feynman-tests.cjs

- **Found during:** 130-04 Task 3 (Feynman runner Phase 130 registration).
- **Lines:** 1128 (`// Phase 103 - Memory Continuity Layer`) and 1134 (`// Phase 105 - HMI Compliance Polling`) carry a U+2014 em-dash in pre-existing comment text.
- **Scope:** OUT OF SCOPE for 130-04. These em-dashes pre-date this plan and are in unrelated Phase 103/105 registration comments, not in the additive Phase 130 block (which is em-dash clean). Per the executor SCOPE BOUNDARY, pre-existing issues in unrelated lines are not auto-fixed.
- **Recommended fix:** a future docs/style sweep should replace both em-dashes with hyphens to satisfy the CLAUDE.md HARD RULE across the whole runner.
- **Not blocking:** the live substrate guard + the 130-04 verify gates do not check whole-file em-dashes on this runner; the plan's own files carry zero em-dashes.
