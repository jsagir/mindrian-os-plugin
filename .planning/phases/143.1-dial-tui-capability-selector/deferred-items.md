# Phase 143.1 Deferred Items


## From Plan 143.1-03 execution (2026-06-06)

- **tests/test-auto-explore-event-types.cjs** asserts an EXACT EVENT_TYPES size
  (`== 32`). This is the anti-pattern the additive idiom forbids (floor-not-count).
  It has been failing since Phase 119+ (set was already 73 before this plan; now
  75). NOT caused by 143.1-03; out of scope. Fix: rewrite the assertion as a floor
  + named-membership check (mirror tests/test-breakthrough-edge-types.cjs).
- **lib/memory/brain-cypher-chain-slice.test.cjs** (run-all-125) fails with a
  hardcoded legacy workspace path `/home/jsagi/MindrianOS-Plugin/lib/brain/
  framework-chain-slice.cjs` (MODULE_NOT_FOUND). Pre-existing path bug unrelated
  to 143.1-03; out of scope.
