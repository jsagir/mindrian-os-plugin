# Phase 156 Deferred Items

Out-of-scope discoveries logged during execution (not fixed; not caused by the current task's changes).

## DI-156-03-01: pre-existing em-dash in opportunity-ops.cjs

- **Found during:** Wave 3 Task 3 (banking with provenance)
- **File / line:** `lib/core/opportunity-ops.cjs:765` -- a code comment `// Source may not exist - proceed with defaults` uses a literal em-dash.
- **Scope:** Pre-existing; NOT introduced by the Wave-3 additive `provenance` field (my added lines are em-dash clean, verified by `git diff | grep "^+" | grep emdash` returning nothing).
- **Disposition:** Deferred. Out of scope for this plan per the executor SCOPE BOUNDARY rule (only auto-fix issues directly caused by the current task). A future docs/lint sweep should hyphenate it.
