# Deferred Items -- Phase 78

## Out of scope for Plan 78-02

### Pre-existing: lazygraph-ops.cjs missing module
- **File:** lib/core/lazygraph-ops.cjs:19
- **Issue:** `require(...)` at line 19 throws MODULE_NOT_FOUND when `bin/mindrian-tools.cjs` is loaded at runtime
- **Impact:** Running `node bin/mindrian-tools.cjs` (any command) fails before USAGE can print
- **Status:** Pre-existing failure unrelated to vault/linkify routing. Syntax check passes. New vault + room linkify cases are present and well-formed.
- **Scope:** Not caused by Plan 78-02 changes. Belongs to a separate fix.
