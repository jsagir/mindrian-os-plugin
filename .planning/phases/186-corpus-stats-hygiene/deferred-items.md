# Phase 186 - Deferred Items

## DI-186-01: install-pre-commit.sh idempotency duplicates guards on re-run

- **Found during:** Phase 186-02 Task 2 (wiring the corpus-stats --check guard).
- **Scope:** PRE-EXISTING, affects ALL guards (schema-aliases, connector, projection,
  render-coverage, corpus-stats) equally - NOT introduced by this plan.
- **Issue:** The top-level idempotency check at scripts/install-pre-commit.sh:37 (and
  each per-guard `if ! grep -q "<script>.cjs --check" "$HOOK_PATH"`) greps for the
  CONTIGUOUS literal `<script>.cjs --check`. The INSTALLED hook line is
  `node "<abs-path>/<script>.cjs" --check` - a double-quote sits between `.cjs` and
  ` --check`, so the contiguous grep NEVER matches the installed hook. Result: every
  re-run of `bash scripts/install-pre-commit.sh` re-splices every guard, accumulating
  duplicate guard blocks in `.git/hooks/pre-commit`.
- **Impact:** Harmless to correctness (the duplicated guards are idempotent local
  byte-compares; they just run more than once). The `.git/hooks/pre-commit` file is
  not tracked by git, so the repo is unaffected.
- **Why deferred:** Out of scope for CORPUS-02. The fix is a change to the shared
  idempotency mechanism (match the quoted installed form, or grep on the script
  basename only) that touches every sibling guard - a separate hardening task, not a
  corpus-stats change. The corpus-stats guard was wired to MIRROR the siblings exactly
  (the plan's explicit instruction), so it inherits their behavior by design.
- **Suggested fix (future):** change the idempotency greps to match the basename only,
  e.g. `grep -q "build-corpus-stats.cjs" "$HOOK_PATH"`, or to the quoted installed form
  `'build-corpus-stats.cjs" --check'`.
