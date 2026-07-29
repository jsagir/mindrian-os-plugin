# Phase 236 - Deferred Items (out of scope, discovered during execution)

Logged per the executor scope boundary: only issues DIRECTLY caused by this
phase's changes are auto-fixed. Everything below is PRE-EXISTING and was
confirmed red against the baseline commit before any Phase 236 edit landed.

## Pre-existing failures in `tests/test-sqlite-ops.cjs`

Confirmed pre-existing by checking out `HEAD:lib/core/lazygraph-ops.cjs` (the
state before Plan 236-01 Task 3) and re-running: the SAME four subtests fail.
Not caused by, and not fixed by, Phase 236.

| Failing subtest | Why it is stale |
|---|---|
| `SQLITE-01 / WAL mode is active` | environment/journal-mode assertion, unrelated to the DELETE scope |
| `SQLITE-02 / indexArtifact with wikilink creates INFORMS edge when target exists` | Phase 169 D-169-08 DISABLED the indexer's raw-SQL cascade writes; `navigation.writeEdge` is now the sole writer. The test still asserts the pre-169 behavior. |
| `SQLITE-02 / EDGE_TYPES is an array of 19 strings` | `EDGE_TYPES` has grown to 23 members across later phases; the test pins a frozen literal count instead of a floor. |
| `All 21 exports present / module exports exactly 21 keys` | `lib/core/lazygraph-ops.cjs` `module.exports` has grown well past 21 keys across later phases; same frozen-literal-count anti-pattern. |

Recommended follow-up (NOT done here): convert the two count assertions to
FLOOR + named-membership checks, the convention `memory-events.cjs` already
documents ("tests assert a FLOOR + named membership, not an exact count, so a
future phase adding a type cannot regress baseline"), and retire or rewrite the
wikilink-INFORMS assertion against the post-169 contract.
