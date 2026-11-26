# Phase 367 deferred items (out of scope, found during execution)

## D-367-01 (found in plan 367-01, 2026-11-26): a room root file loses its Artifact type

- Fact (PROVEN on a scratch room): `lazygraph-ops.cjs` `_indexArtifactBody` writes a room root file
  `root-note.md` as node `root-note` type `Artifact`, then upserts the Section node of
  `section = id.split('/')[0]`, which is the same id `root-note`. The Section upsert overwrites the
  node type, so the node reads `type = 'Section'`. Its `BELONGS_TO` edge `root-note -> root-note`
  stays.
- Effect: every room root file has no Artifact-typed node after `rebuildGraph` or `indexArtifact`.
  A doctor count of "room files without an Artifact node" (plan 367-10) and the catch-up runner
  (plan 367-05, it goes through `_indexArtifactBody`) see every root file as not indexed.
- Not fixed here: plan 367-01 does not change `rebuildGraph` or `_indexArtifactBody`. The test
  `tests/test-367-artifact-set.cjs` W1 reads the rebuild Artifact ids from the Artifact nodes plus
  the `BELONGS_TO` sources, so it does not pin this defect.
- Owner of the fix: a planner decision (367-05 or 367-10 read the id set; a `/gsd-quick` can give
  root files a non-colliding section id).

## D-367-02 (base-red, found in plan 367-01): tests/test-233-graph-heal-pipeline.cjs

- FAIL at BASE b0fb5a1ab and after plan 367-01 with the same assertion (G3 CONTROL: "the unguarded
  call ... DOES wipe the edge"). PRE-EXISTING; not touched.
