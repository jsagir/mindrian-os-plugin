---
phase: 236
plan: 01
subsystem: room.db graph substrate
tags: [graphdb-01, data-loss, ownership-allowlist, transaction, mutation-proof, canon-part-9]
requires:
  - lib/core/lazygraph-ops.cjs (rebuildGraph, _indexArtifactBody)
  - lib/core/navigation.cjs (logMemoryEvent, writeClaimNode, confirmNode, writeOpportunityNode, advanceOpportunityStage, writeEdge)
  - lib/core/node-insert.cjs (insertNode, the NOT-NULL-safe chokepoint)
  - lib/core/room-db.cjs (openRoomDb, closeRoomDb)
provides:
  - INDEXER_OWNED_NODE_TYPES (exported const, lib/core/lazygraph-ops.cjs)
  - INDEXER_OWNED_EDGE_TYPES (exported const, lib/core/lazygraph-ops.cjs)
  - clearIndexerOwnedRows (exported fn, lib/core/lazygraph-ops.cjs)
  - ECOSYSTEM_OWNED_EDGE_TYPES (script-local const, scripts/build-ecosystem-graph.cjs)
  - buildFixtureRoom236 / countPopulations / readStageHistory / readNodeRow (tests/helpers/fixture-room-236.cjs)
affects:
  - Phase 236-02 (consumes buildFixtureRoom236 with a large artifactCount for the WAL test)
  - Phase 242 (may consume the exported allowlist; no code coupling created)
tech-stack:
  added: []
  patterns: [ownership-allowlist-as-data, endpoint-ownership-scoped-delete, manual-BEGIN-COMMIT-ROLLBACK, mutation-proof-both-directions]
key-files:
  created:
    - tests/helpers/fixture-room-236.cjs
    - tests/test-236-rebuild-preserves-journal.cjs
    - tests/test-236-ecosystem-graph-preserves-journal.cjs
  modified:
    - lib/core/lazygraph-ops.cjs
    - scripts/build-ecosystem-graph.cjs
decisions:
  - The ownership contract ships as exported frozen DATA, not an assumption inside a SQL string
  - The scoped-DELETE SQL lives in lazygraph-ops.cjs (one implementation, two callers) rather than being duplicated into the script, which also avoids widening the Canon Part 9 chokepoint exemption allowlist
  - Derived edges are scoped by ENDPOINT OWNERSHIP, never by edge type alone
  - rebuildGraph's pre-existing transaction wrap is byte-unchanged; the defect was DELETE scope, not atomicity
metrics:
  tasks_completed: 4
  commits: 4
  tests_added: 2
  scenarios: 12
  mutation_proofs: 4
  completed: 2026-07-29
---

# Phase 236 Plan 01: room.db Data-Loss Fixes (GRAPHDB-01) Summary

Closed the GRAPHDB-01 data-loss hole at BOTH of its source sites with an exported ownership
allowlist driving a scoped DELETE, proven by two mutation-provable survival tests that were
observed RED against the real defect before either fix landed.

## What Shipped

| Artifact | What it does |
|---|---|
| `INDEXER_OWNED_NODE_TYPES` / `INDEXER_OWNED_EDGE_TYPES` | The ownership contract as readable, frozen, exported DATA |
| `clearIndexerOwnedRows(conn, extraDerivedEdgeTypes)` | THE single ownership-scoped wipe, called by both destructive reindex paths |
| `ECOSYSTEM_OWNED_EDGE_TYPES` (script-local) | The ecosystem builder's wider regenerable edge set, built FROM the shared import |
| `tests/helpers/fixture-room-236.cjs` | Seeds the three irreplaceable populations through production writers only |
| `tests/test-236-rebuild-preserves-journal.cjs` | 5-scenario survival gate for `rebuildGraph` (RCA Test 1) |
| `tests/test-236-ecosystem-graph-preserves-journal.cjs` | 7-scenario survival gate for the ecosystem builder, including its atomicity leg |

## The Final Allowlist Values

```javascript
// lib/core/lazygraph-ops.cjs (exported, frozen)
const INDEXER_OWNED_NODE_TYPES = Object.freeze(['Artifact', 'Section']);
const INDEXER_OWNED_EDGE_TYPES = Object.freeze(['BELONGS_TO']);

// scripts/build-ecosystem-graph.cjs (script-local, built FROM the import)
ECOSYSTEM_OWNED_EDGE_TYPES   = ['BELONGS_TO', 'INFORMS', 'CONTRADICTS', 'CONVERGES']
ECOSYSTEM_DERIVED_EDGE_TYPES = ['INFORMS', 'CONTRADICTS', 'CONVERGES']   // union minus import
```

These are exactly the three type literals `_indexArtifactBody` writes and nothing wider. The four
cascade types are deliberately absent: Phase 169 D-169-08 disabled the indexer's raw-SQL cascade
writes and `navigation.writeEdge` is now their sole writer, so the indexer can no longer restore
them and therefore must not delete them. `CausalClaim` / `WhitespaceZone` are likewise absent
because `rebuildGraph` never calls their writers. The shared edge constant still contains only
`BELONGS_TO`, verified at runtime after both tasks.

## Observed RED Output (the defect reproducing under test)

### Task 2, site 1, against unmodified `lib/core/lazygraph-ops.cjs` (exit 1)

```
FAIL 1. memory_event survives the rebuild with a byte-identical properties blob
  memory_event memory_event:node_created:1785282621099:372f72f2 was DESTROYED by the
  rebuild (the append-only audit journal exists nowhere else and cannot be re-derived)
FAIL 2. confirmed truth-claim survives the rebuild with review_status confirmed
  confirmed truth-claim claim:fixture-236:403adedb was DESTROYED by the rebuild
FAIL 3. opportunity stage_history survives the rebuild unchanged in length and entries
  opportunity opportunity:fixture-236:8e25637f or its stage_history was DESTROYED
ok 4. rebuild still regenerates Artifact/Section nodes and BELONGS_TO edges
ok 5. rebuild still reclaims the Artifact node of a file deleted from disk

passed: 2  failed: 3
```

Scenarios 4 and 5 passing against the unmodified source is the evidence the harness is sound:
the three red legs are the defect, not a broken test.

### Task 4, site 2, against unmodified `scripts/build-ecosystem-graph.cjs` (exit 1)

```
FAIL 1/2/3/4/5/6  build-ecosystem-graph.cjs must exit 0, got 1
  --- stderr --- FATAL: NOT NULL constraint failed: nodes.source_path
FAIL 7. a mid-run failure rolls back: node and edge counts exactly unchanged
  ATOMICITY VIOLATION: node and edge counts must be EXACTLY equal after a failed run.
    before: {"Artifact":4,"Section":1,"claim":1,"memory_event":2,"opportunity":1,
             "_edges":{"BELONGS_TO":4},"_nodesTotal":9,"_edgesTotal":4}
    after:  {"_edges":{},"_nodesTotal":0,"_edgesTotal":0}

passed: 0  failed: 7
```

Scenario 7 is the clearest statement of the whole phase: the room went from 9 nodes and 4 edges
to **zero of each**. The unscoped wipe committed as a bare autocommit statement, then the script
crashed before restoring anything. Nothing was recoverable.

## Mutation Proofs (all four demonstrated, then reverted)

Each mutation isolates a different guard, so no leg of either fix is decorative. The site-2
mutations were re-run against the FINAL shipped code after the Task 4 refactor.

| # | Mutation | Result |
|---|---|---|
| 1 | Restore unscoped DELETE in `rebuildGraph` | site-1 scenarios 1-3 red (`passed 2 failed 3`) |
| 2 | Restore unscoped DELETE in the ecosystem builder | site-2 scenarios 1,2,3,6 red (`passed 3 failed 4`) |
| 3 | Drop the endpoint subqueries (type-only derived predicate) | **ONLY** scenario 6 red (`passed 6 failed 1`) |
| 4 | Remove the ecosystem builder's new transaction wrap | **ONLY** scenario 7 red (`passed 6 failed 1`) |
| - | All reverted | site 1 `5/5`, site 2 `7/7` |

Mutations 3 and 4 are the important ones: each turns exactly one scenario red and leaves the
other six green, which is what proves the endpoint-ownership scoping and the new transaction are
independently load-bearing rather than incidentally covered.

## The Scenario 7 Failure Seam (what actually worked)

`chmod 000` on one seeded `.md` artifact, so the script's own `fs.readFileSync` throws `EACCES`
from inside Phase 1, inside the wrapped region.

Two seams were tried and **rejected** first, because `walkDir` swallows both before any read
happens:

1. Replacing the `.md` with a **directory** of the same name. `walkDir` sees `isDirectory()` and
   recurses into it rather than listing it as a file, so nothing ever throws.
2. Replacing it with a **dangling symlink**. `walkDir` sees `isSymbolicLink()`, `statSync`s it,
   catches, and `continue`s.

The scenario therefore PRE-VERIFIES in-process that `readFileSync` actually throws on the prepared
seam before it asserts anything about the script. A seam that stopped biting (for example under
uid 0, where `chmod 000` does not block a read) reports as an explicit seam failure, never as a
false green.

## Mandatory Grounding: node:sqlite Transaction Semantics

Context7 MCP tools were NOT present in this executor's tool set (the documented upstream
tool-stripping bug) and `ctx7` is not on PATH. Rather than assume from training data, the claim
was discharged by direct live verification against the actual runtime, Node v22.23.1:

```
proto: open, close, prepare, exec, function, location, aggregate, createSession,
       applyChangeset, enableLoadExtension, loadExtension, constructor
has .transaction?              undefined
isTransaction (before)         false
isTransaction (after BEGIN)    true
isTransaction (after ROLLBACK) false
```

Confirms the third independent verification this session: `DatabaseSync` has **no**
`.transaction(fn)` convenience helper (that is a better-sqlite3 API), manual
`BEGIN` / `COMMIT` / `ROLLBACK` is the only idiom, and `isTransaction` is available. Both fixes
use the manual idiom.

## Deviations from Plan

### 1. [Rule 1 - Bug] Two writer names in the plan do not exist

- **Found during:** Task 1
- **Issue:** 236-PATTERNS.md and the RCA both name a `record`-prefixed memory-event writer that
  does not exist anywhere in the tree. Separately, 236-01-PLAN.md instructs
  `advanceOpportunityStage` to be called with `axis: 'opportunity_stage'` /
  `'opportunity_outcome'`; those are the PROPS FIELD names the axes write to
  (`typed-opportunity.cjs` `AXIS_FIELDS`), not axis names. Passing them returns
  `{ok:false, reason:'invalid_axis'}`.
- **Fix:** Used `navigation.logMemoryEvent` (the real re-export of `memory-events.cjs` `logEvent`)
  and `axis: 'stage'`. Both corrections are documented in the fixture's header so the next reader
  does not chase the wrong names.
- **Commit:** `b3932c23`

### 2. [Rule 3 - Blocking] The ecosystem builder could not run at all on a modern room.db

- **Found during:** Task 4 RED observation
- **Issue:** The script's two bare 3-column `INSERT INTO nodes (id, type, properties)` upserts
  throw `NOT NULL constraint failed: nodes.source_path` (SQLite errcode 1299) against ANY room.db
  carrying the Phase-109 provenance migration, which is every room opened through
  `room-db.cjs openRoomDb`. Combined with the unscoped, un-transacted wipe, the script emptied the
  room and then crashed before restoring a single node. Without fixing this the ownership fix
  would be untestable and the script unusable.
- **Fix:** Both upserts route through `lib/core/node-insert.cjs insertNode`, the shared
  NOT-NULL-safe chokepoint `_indexArtifactBody` and `hsi-to-graph.cjs` already use (Canon Part 7
  reuse). It detects both schema generations, so legacy 3-column dbs keep working unchanged.
- **Commit:** `10ee83c2`

### 3. [Plan deviation - CLAUDE.md precedence] Scoped DELETE SQL lives in lazygraph-ops.cjs, not the script

- **Found during:** Task 4 commit
- **Issue:** The plan put the scoped DELETE SQL inside `scripts/build-ecosystem-graph.cjs` and its
  acceptance criterion asked for `DELETE FROM nodes WHERE type IN` in the comment-stripped SCRIPT.
  That trips `scripts/check-substrate.cjs --diff`, the Canon Part 9 guard that blocks NET-NEW raw
  graph SQL in files outside `ALLOWED_DIRECT_IMPORT`; that script is not allow-listed.
- **Decision:** The hook offers widening `ALLOWED_DIRECT_IMPORT` as a resolution. That is a
  governance change to a Canon Part 9 trust boundary and was **not** taken unilaterally. Instead
  the SQL moved into `lib/core/lazygraph-ops.cjs`, which is already allow-listed, already owns both
  constants, and already held the sibling DELETE, exported as `clearIndexerOwnedRows`.
- **Net effect:** strictly better than the plan. One implementation, two callers, zero drift
  surface, and no allowlist edit. `check-substrate --diff` exits 0. The equivalent grep gate now
  holds on `lazygraph-ops.cjs` (`DELETE FROM nodes WHERE type IN` present, unscoped statement
  absent) rather than on the script. CLAUDE.md directives take precedence over plan text.
- **Commit:** `10ee83c2`

### 4. [Rule 1 - Bug] Self-inflicted schema-drift guard trip, fixed at source

- **Found during:** Task 3 commit
- **Issue:** The Phase 108 schema-drift guard regexes the raw `git diff --cached` blob. A PROSE
  mention of the if-not-exists DDL clause inside a new comment was parsed as real DDL: the trailing
  comma defeated the optional `IF NOT EXISTS` group, so the guard captured `IF` as a new table name.
- **Fix:** Reworded my own comment. The guard exits 0. Not bypassed.
- **Commit:** `28ad709b`

## Hooks

**No hook was bypassed. `COMMIT_NO_VERIFY` was never used.** Two hooks fired during this plan
(the Phase 108 schema-drift guard and `check-substrate --diff`); both were diagnosed to root cause
and fixed properly, as documented in deviations 3 and 4. The pre-existing
`interactive_first_reward` guardian gap described in the execution brief was never encountered,
because this plan stages no `commands/*.md` file.

## Verification

| Gate | Result |
|---|---|
| `node tests/test-236-rebuild-preserves-journal.cjs` | 5 ok, 0 failed, exit 0 |
| `node tests/test-236-ecosystem-graph-preserves-journal.cjs` | 7 ok, 0 failed, exit 0 |
| Comment-stripped `DELETE FROM edges; DELETE FROM nodes;` in both files | 0 occurrences each |
| Comment-stripped `DELETE FROM nodes WHERE type IN` in lazygraph-ops.cjs | 1 occurrence |
| `rebuildGraph` BEGIN/COMMIT/ROLLBACK counts | 2/2/2, unchanged; `git diff` touches no transaction line |
| Ecosystem builder BEGIN/COMMIT/ROLLBACK | 1/1/1, all three absent before this plan |
| `INDEXER_OWNED_NODE_TYPES` in the script | 1 use, 0 local declarations (imported) |
| `ECOSYSTEM_OWNED_EDGE_TYPES` under `lib/` | 0 occurrences (script-local as required) |
| Shared `INDEXER_OWNED_EDGE_TYPES` at runtime | `["BELONGS_TO"]`, unwidened |
| `git diff --quiet scripts/hsi-to-graph.cjs` | passes (Phase 242 territory, untouched) |
| `node scripts/check-substrate.cjs` | exit 0 |
| `node scripts/check-substrate.cjs --diff` | exit 0 |
| `node scripts/check-schema-aliases.cjs` | exit 0 |
| Em-dashes across all 5 files | 0 each |

## Deferred Issues

`tests/test-sqlite-ops.cjs` has 4 failing subtests. All 4 were confirmed PRE-EXISTING by checking
out `HEAD:lib/core/lazygraph-ops.cjs` (the state before this plan's first source edit) and
re-running: the same four fail. They are stale frozen-literal-count assertions and a pre-Phase-169
cascade-edge expectation, logged with recommended follow-up in
`.planning/phases/236-room-db-data-loss-fixes/deferred-items.md`. Not caused by, and out of scope
for, this plan.

## Confirmation: scripts/hsi-to-graph.cjs was NOT touched

`git diff --quiet scripts/hsi-to-graph.cjs` passes across the whole plan. That file is Phase 242's
territory. Note that the edge types it deletes (`HSI_CONNECTION`, `REVERSE_SALIENT`) are
deliberately absent from this plan's allowlists, so Phase 236's scoped rebuild now stops destroying
Phase 242's scoring layer as a side effect. That is a one-way benefit and creates no code coupling.

## Commits

| Hash | Task | Message |
|---|---|---|
| `b3932c23` | 1 | `test(236-01): add shared phase fixture seeding the three irreplaceable populations` |
| `2f304995` | 2 | `test(236-01): add rebuildGraph survival gate, observed RED against the unscoped DELETE` |
| `28ad709b` | 3 | `fix(236-01): scope rebuildGraph's DELETE to the indexer ownership allowlist` |
| `10ee83c2` | 4 | `fix(236-01): scope and transact the SECOND unscoped wipe in build-ecosystem-graph.cjs` |

## Self-Check: PASSED

All 7 claimed files verified present on disk (3 created tests/helpers, 2 modified sources,
SUMMARY.md, deferred-items.md). All 4 claimed commit hashes verified present in `git log`
(`b3932c23`, `2f304995`, `28ad709b`, `10ee83c2`). Both survival tests re-run at self-check time:
site 1 `5 passed / 0 failed`, site 2 `7 passed / 0 failed`.
