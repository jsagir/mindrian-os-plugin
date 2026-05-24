---
phase: 127.3
plan: 06
created: 2026-05-24
purpose: Track items observed during execution but DELIBERATELY out of scope for this plan, per the executor scope-boundary rule.
---

# Phase 127.3 Plan 06 -- Deferred Items

## DI-127.3-06-01: Pre-existing em-dashes in lib/memory/run-feynman-tests.cjs

**Observed during:** Task 3 (Feynman runner registration acceptance criteria check).

**Symptom:** `grep -c "—" lib/memory/run-feynman-tests.cjs` returns 2 (the criterion in
Task 3's `<acceptance_criteria>` expected 0).

**Locations (pre-existing; confirmed via `git blame`):**
- line 1128: `// Phase 103 — Memory Continuity Layer (...)`
- line 1134: `// Phase 105 — HMI Compliance Polling`

Both em-dashes were introduced in commit `9e82cfb1c` by Jonathan Sagir on
2026-05-02, well before Phase 127.3 was scoped (2026-05-24). Phase 127.3
Plan 06 Task 3 adds ZERO em-dashes (verified via
`git diff lib/memory/run-feynman-tests.cjs | grep "^+" | grep "—" | wc -l`
= 0).

**Why deferred:** Per the executor's scope-boundary rule (only auto-fix issues
DIRECTLY caused by the current task's changes), pre-existing comment-style
violations in unrelated phase blocks are not in this plan's `files_modified`
scope. The acceptance criterion is reading the global file count rather than
the per-task diff; the task's net-zero em-dash contribution satisfies the
underlying intent.

**Recommended venue:** A future em-dash sweep of `lib/memory/run-feynman-tests.cjs`
(low-risk comment-only edit; can be folded into Phase 129 spine-repair-memory-event
since that phase already touches this file when it absorbs the remaining 6
spine scripts onto `lib/core/resolve-active-room.cjs`).

**No code action this plan.**
