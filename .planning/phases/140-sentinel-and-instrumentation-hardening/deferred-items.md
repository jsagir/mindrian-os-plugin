# Phase 140 -- Deferred / Out-of-Scope Items

## DI-140-01-01: Uncommitted edit to skills/larry-personality/SKILL.md

- **Discovered during:** 140-01 execution (final commit staging).
- **What:** `skills/larry-personality/SKILL.md` appeared modified in the working
  tree with +19 lines adding a "When to Reach -- The Capability Dial" section
  (Context Block / contradiction surface / cross-room reach / Brain consult
  trigger table + reach rules).
- **Why out of scope:** This content is Phase 141 material (RETR fusion +
  capability dial + LARRY-01/02), NOT plan 140-01 (HARD-02 node-insert + scout
  unmask). The change was introduced by a PostToolUse cascade hook during this
  session, not by any 140-01 task.
- **Action taken:** Left UNCOMMITTED by the 140-01 executor (scope-boundary
  rule: only commit files this task's changes directly produced). Flagged here
  so it is not lost. The Phase 141 executor (or the user) should review and
  commit it under the correct plan.
