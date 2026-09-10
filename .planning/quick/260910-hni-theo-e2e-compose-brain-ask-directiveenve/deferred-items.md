# Deferred Items -- quick/260910-hni

Out-of-scope discoveries logged per the executor's scope-boundary rule
(pre-existing failures in files this task did not touch are not auto-fixed).

## 1. `tests/test-339-update-path-single-source.cjs` Arm 5 FAILs on `scripts/collect-cold-install-evidence.cjs:365`

- **Discovered during:** Task 3 verification (`bash tests/run-all-339.sh`).
- **Symptom:** Arm 5 asserts `lib/` and `scripts/` carry exactly one
  non-comment occurrence of the FLIP-04 update-path literal (in
  `lib/core/update-path.cjs` itself). It finds a second occurrence at
  `scripts/collect-cold-install-evidence.cjs:365`.
- **Root cause (not investigated further, out of scope):** `scripts/collect-cold-install-evidence.cjs`
  was added by commit `960a7a2e` (`feat(341-06): build scripts/collect-cold-install-evidence.cjs (D-13 step 2)`),
  which apparently duplicated the update-path string literal instead of
  importing it from `lib/core/update-path.cjs`.
- **Confirmed pre-existing:** `tests/test-339-update-path-single-source.cjs`
  is byte-identical to the pre-quick-task baseline (commit `978be5fa`, this
  task's starting HEAD); `960a7a2e` and the file it added both predate this
  session and are untouched by quick/260910-hni's three tasks. Verified by
  running the test in isolation against the untouched baseline file.
- **Action taken:** None (Rule: scope boundary -- only auto-fix issues
  directly caused by the current task's changes). Recorded here per the
  executor's deferred-items protocol.
- **Suggested owner:** whichever phase or quick task next touches
  `scripts/collect-cold-install-evidence.cjs` or `lib/core/update-path.cjs`.
