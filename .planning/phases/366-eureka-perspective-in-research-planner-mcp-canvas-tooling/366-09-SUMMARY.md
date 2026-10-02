---
phase: 366-eureka-perspective-in-research-planner-mcp-canvas-tooling
plan: 09
subsystem: canon-handles-at-birth
tags: [canon, artifact_file, indexer, uses-framework, part9, part8]
requires:
  - 366-05 (resolverCtxFor, resolveEndpoint, extractCarried, linkThingToFramework)
provides:
  - artifact_file response fields canon_handle, canon_via, canon_edge
  - lazygraph-ops rebuild attaches framework node + USES_FRAMEWORK edge per resolvable Artifact
  - tests/test-366-canon-at-filing.cjs (legs K1-K9, 25 checks)
affects:
  - 366-10 backfill (old rooms), 366-11 gated release, Theo find_connections readiness
tech-stack:
  added: []
  patterns:
    - disjoint canon block after the jtbd anchor block (Pitfall 11, Phase 367 shares the handler)
    - resolver context built once per rebuild, writer called inside the rebuild transaction (node before edge)
key-files:
  created:
    - tests/test-366-canon-at-filing.cjs
  modified:
    - lib/mcp/tools/views.cjs
    - lib/core/lazygraph-ops.cjs
decisions:
  - "artifact_file links the USES_FRAMEWORK edge from the filed claim node (claim:artifact:<id>), the node the handler already mints; the handle is still reported when no node exists (canon_edge no_filed_node)"
  - "Title for resolution mirrors the indexer: first '# ' heading, else the file basename"
  - "INDEXER_OWNED_NODE_TYPES / INDEXER_OWNED_EDGE_TYPES left unchanged: framework nodes and USES_FRAMEWORK edges are shared bookkeeping (artifact_file, backfill also write them) and must survive the scoped wipe; writes are idempotent so a rebuild converges"
metrics:
  tasks: 2
  files: 3
  completed: 2026-10-02
---

# Phase 366 Plan 09: Canon handle at birth Summary

Things now carry a canon Framework handle where they are born: `artifact_file` links the filed claim node to a `framework:<slug>` node by a USES_FRAMEWORK edge, and the indexer does the same for each Artifact on rebuild, both through the single 366-05 resolver and writer. A miss writes nothing; a failure is reported, never thrown.

## What was built

- **views.cjs (artifact_file)**: after the jtbd anchor block, a separate try/catch block reads the artifact's own frontmatter with `extractCarried`, resolves with `resolveEndpoint(carried, resolverCtxFor(roomDir))`, and on a hit calls `navigation.linkThingToFramework(db, nodeId, name, 'artifact_file')`. The response gains `canon_handle` (name or null), `canon_via` (framework / methodology / title / translation or null) and `canon_edge` (null on a miss, `{ok:true,node_id}` or `{ok:false,reason}` on a hit). The old `framework: null` comment was rewritten: the framework is resolved by the exact rule, never guessed. Written against the current v2 `server.registerTool` shape from peer session 267-08; only `fileArtifact` plus a require changed, the register block was not touched.
- **lazygraph-ops.cjs (indexer)**: `rebuildGraph` builds the resolver context once; `_indexArtifactBody` calls a new `_attachCanonHandle` helper right after the BELONGS_TO insert, inside the caller's transaction (node and edge commit together). `indexArtifact` (single file) builds its own context. The helper never throws. Header comment documents the two new literals and why they are not in the owned constants.
- **tests/test-366-canon-at-filing.cjs**: K1-K5 (artifact_file: hit, second artifact reusing the node, methodology via registry, non-canon and no-frontmatter miss, throwing and not-ok writer, no dangling edges) and K6-K9 (rebuild hit, idempotent second rebuild, unchanged Artifact/Section/BELONGS_TO counts, zero framework rows when nothing resolves). Hermetic HOME and MINDRIAN_ROOMS_HOME, net guard, 25 checks.

## Commits

| Step | Commit | Message |
|------|--------|---------|
| RED | c8f66776a | test(366-09): add failing canon-at-filing legs K1-K9 (artifact_file and indexer) |
| Task 1 GREEN | e685db087 | feat(366-09): artifact_file attaches the canon framework handle (node then USES_FRAMEWORK edge) on an exact hit |
| Task 2 GREEN | 5d2284810 | feat(366-09): indexer attaches the canon framework handle on rebuild, idempotently |

## Verification

- `node tests/test-366-canon-at-filing.cjs`: PASS 25 FAIL 0 (zero network attempts)
- `node tests/test-366-canon-handles.cjs`: PASS 53 FAIL 0
- `node tests/test-270-tool-schema-budget.cjs`: 5 passed, 0 failed
- `node scripts/check-tool-honesty.cjs --check`: OK, 0 high-risk. artifact_file's disposition did not change, so `tests/fixtures/tool-honesty/276-dispositions.json` was left alone; `node tests/test-276-tool-honesty-findings-closed.cjs`: 148 passed, 0 failed
- `node scripts/check-substrate.cjs --diff`: exit 0; `node scripts/build-connector-registry.cjs --check`: clean
- `grep -c linkThingToFramework`: views.cjs = 1, lazygraph-ops.cjs = 1
- Every test requiring lazygraph-ops (62 files, hermetic temp HOME, excluding test-section-nodes-birth-and-migration) ran: 53 exit 0. The 236/240/244 rebuild legs, 149, nested-artifact-indexing and graph-export all pass.

## Deviations from Plan

None to the code scope. Notes:

1. **Plan acceptance "every existing lazygraph test still passes"** is not literally true repo-wide: nine tests exit 1 (audit-localhost-workspace-review, test-233-graph-heal-pipeline, test-242-hsi-to-graph-transaction, test-causal-seed, test-futures-edges, test-graph-derivation-verdict, test-sqlite-concurrent, test-sqlite-ops, test-tension-hook-detection). I ran all nine in a detached scratch worktree of HEAD before my lazygraph-ops change (views change only) and all nine fail identically there, so they are pre-existing and unrelated. Logged here rather than fixed (out of scope).
2. **Two pre-existing reds seen while running views-adjacent tests**, not caused by this plan: `tests/test-353-filing-gate.cjs` fails one check ("EVENT_TYPES.size is 102 (untouched)"; the set grew elsewhere), and `tests/test-198-contract-schema.test.cjs` crashes because its stub server lacks `registerTool` (a consequence of the peer 267-08 refactor, owned by jsagi-65).
3. **Known limitation (design, not a bug)**: because the owned-row constants were deliberately not widened, an edited frontmatter that drops or changes a framework does not remove the older USES_FRAMEWORK edge on the next rebuild; the new edge is added. Pruning stale canon edges would need either raw SQL in the indexer (plan says no raw SQL) or a writer-side removal primitive. A follow-up for 366-10 or a later plan; not blocking.

## Known Stubs

None.

## Threat Flags

None. Fully local, no new endpoints or trust boundaries beyond the plan's threat model (T-366-34 exact match only, T-366-35 non-blocking, T-366-36 writer only, T-366-37 local).

## Self-Check: PASSED

- FOUND: tests/test-366-canon-at-filing.cjs, lib/mcp/tools/views.cjs, lib/core/lazygraph-ops.cjs
- FOUND commits: c8f66776a, e685db087, 5d2284810
