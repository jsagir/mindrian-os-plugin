# Deferred / out-of-scope items -- 20260702-statusline-context-aware

Pre-existing issues surfaced during execution but NOT caused by this task's
changes. Per the scope boundary, they are logged, not fixed.

1. **`tests/test-hmi-compliance-e2e.cjs` Test 11 FAIL (pre-existing).**
   `hooks.json byte-identity for Phase 99/100/103 Stop entries: expected 4 Stop
   entries, got 6`. This asserts a Stop-hook count in `hooks/hooks.json`, a file
   this task never touched (`git diff --name-only` shows 0 hooks.json changes).
   Repo drift from later phases that added Stop entries. 10/11 pass. Needs a
   hooks.json Stop-entry reconciliation in its own task.

2. **`tests/test-statusline-glyph-isolation.cjs` FAIL in THIS working tree only
   (environmental, not a code regression).** The only violations are
   `.mindrian/brain-substrate-cache.json` (a gitignored, untracked RUNTIME cache
   at the repo root) containing 📊 and 🎯. It is absent in a clean checkout / CI,
   so the fence passes there. All source files this task touched are clean of the
   three fenced glyphs (verified by grep). The test's `SKIP_DIRS` could add
   `.mindrian` to avoid scanning runtime caches -- a test-infra tweak for a
   separate task.
