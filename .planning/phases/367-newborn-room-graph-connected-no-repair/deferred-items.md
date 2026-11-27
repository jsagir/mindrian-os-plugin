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

## D-367-03 (found in plan 367-06): data/harness-manifest.json is stale at the phase base

- `node scripts/build-harness-manifest.cjs --check` reports STALE (the decide_engine surface
  lib/core/navigation-engine.cjs digest drifts) at b0fb5a1ab, before any 367 commit (PROVEN on a
  `git archive b0fb5a1ab` export). It makes tests/test-341-session-start-tier.cjs and
  tests/test-341-version-of-record-source-version.cjs (doctor harness-policies point) base-red.
  Not touched.

## D-367-04 (found in plan 367-06): some hook tests run session-start with the real HOME

- During the 367-06 regression run, a test ran the real scripts/session-start without an isolated
  HOME. The new runner spawn then ran once on the owner's registry active room
  (`~/MindrianRooms/riemann-claim-hats`, trigger session_start, files_indexed 0) and wrote its
  status file and cache there (mode 0600). No Artifact was written. This is the designed product
  behaviour, triggered by a test. A follow-up can set MOS_NO_GRAPH_CATCHUP=1 in such tests or
  isolate their HOME.

## D-367-05 (flake, found in plan 367-06): tests/test-36925-injection.cjs J6

- "J6 two sessions reading the same legacy room get byte-identical answers" fails about 2 of 4 runs
  at BASE dadc5fdfd (PROVEN on a `git archive` export, 3 of 3 failures are this arm) and after
  plan 367-06. PRE-EXISTING flake.
