---
phase: 149-gsd-planning-artifacts-as-local-graph-members
plan: 01
subsystem: navigation
tags: [navigation, planning-artifacts, graph-bridge, canon-part-9, canon-part-8, gsd]
requires:
  - lib/core/navigation/edges.cjs (writeEdge + ALLOWED_EDGE_TYPES)
  - lib/core/navigation.cjs (closed chokepoint surface)
provides:
  - writePlanningArtifactNode + writeRequirementNode + writeLineageEdge node/edge-write chokepoint over a caller-owned db handle
  - FEEDS_INTO + VALIDATES added additively to ALLOWED_EDGE_TYPES (completes the FEEDS_INTO/VALIDATES/INFORMS lineage triple)
  - tests/run-all-149.sh Phase 149 scoped aggregator (8 suites, MISSING-tolerant)
affects:
  - Plan 02 (reconcile + requirement-node + backfill) consumes these writers
  - Plan 03 (writer hook) consumes these writers
tech-stack:
  added: []
  patterns:
    - caller-owned db-handle chokepoint (mirrors lens-nodes.cjs / edges.cjs)
    - Canon Part 9 v1.5 audit-node carve-out (created_by=system review_status=confirmed)
    - additive ALLOWED_EDGE_TYPES idiom (floor + named membership, never exact count)
    - stable node id -> ON CONFLICT(id) DO UPDATE upsert for idempotence
key-files:
  created:
    - lib/core/navigation/planning-artifacts.cjs
    - tests/run-all-149.sh
    - tests/test-149-artifact-nodes.cjs
    - tests/test-149-lineage-edges.cjs
    - tests/test-149-idempotent-upsert.cjs
  modified:
    - lib/core/navigation.cjs
    - lib/core/navigation/edges.cjs
decisions:
  - "writeLineageEdge constrains to the LINEAGE subset {FEEDS_INTO, VALIDATES, INFORMS} of ALLOWED_EDGE_TYPES; edges.cjs stays the single taxonomy source of truth"
  - "FEEDS_INTO + VALIDATES were NOT shipped members of the LOCAL ALLOWED_EDGE_TYPES Set; added additively (SPEC sanctions the ALLOWED_EDGE_TYPES idiom for lineage edge types)"
  - "planning_artifact + requirement are system-bookkeeping nodes (Part 9 carve-out), never truth-claims"
metrics:
  duration: ~1 session
  completed: 2026-06-08
  tasks: 2
  files: 7
---

# Phase 149 Plan 01: Planning-Artifact Node + Lineage-Edge Substrate Summary

One-liner: A `planning_artifact` + `requirement` node writer and a typed-lineage-edge writer (`writeLineageEdge` constrained to FEEDS_INTO / VALIDATES / INFORMS) shipped as a new navigation submodule that takes a caller-owned db handle and routes every write through the Phase 109 chokepoint, with zero direct room.db opens.

## What Was Built

**Task 1 (commit 1f2eaadb)** -- Wave 0 RED-by-design scaffold:
- `tests/run-all-149.sh`: cloned from the Phase 124 aggregator shape. 8 CJS suites with per-suite PASS/FAIL/MISSING; tolerates the five not-yet-owned suites (created by Plans 02/03) as MISSING, exactly like run-all-124.sh tolerates an absent file. RED-by-design header documents which plan turns each suite GREEN.
- `tests/test-149-artifact-nodes.cjs` (GAM-01): planning_artifact node lands exactly once with correct `{phase, artifact_type, path, status}`; system-bookkeeping carve-out (`created_by=system`, `review_status=confirmed`); invalid artifactType rejected; substrate-guard grep floor (no room-db require, no node:sqlite require, no openRoomDb/openGraph in the writer source).
- `tests/test-149-lineage-edges.cjs` (GAM-03): FEEDS_INTO + VALIDATES write; BOGUS_LINK rejected; a real-but-non-lineage type (DEFERRED) rejected by the lineage writer; SPEC -> CONTEXT -> PLAN chain traversable; no-em-dash / no-en-dash codepoint sweep over the writer source (em/en dash referenced via String.fromCharCode(0x2014)/(0x2013) so the test file itself stays greppably clean).
- `tests/test-149-idempotent-upsert.cjs` (GAM-04): second write of the same node/edge/requirement yields exactly one row; second node write updates properties in place.

**Task 2 (commit 6728d9a8)** -- the writer submodule + re-export:
- `lib/core/navigation/planning-artifacts.cjs`: `writePlanningArtifactNode`, `writeRequirementNode`, `writeLineageEdge`, plus `ARTIFACT_TYPES` (7 frozen GSD types), `ARTIFACT_NODE_ID`, `REQUIREMENT_NODE_ID`. Mirrors `lens-nodes.cjs` structure exactly: takes a db handle owned by the caller, requires ONLY `./edges.cjs`, never requires node:sqlite, never opens room.db. The INSERT ... ON CONFLICT(id) DO UPDATE upsert + stable ids deliver GAM-04 idempotence. Part 9 v1.5 audit-node carve-out documented in the header.
- `lib/core/navigation.cjs`: additive re-export block for the three writers + the id helpers + ARTIFACT_TYPES.
- `lib/core/navigation/edges.cjs`: FEEDS_INTO + VALIDATES added additively to ALLOWED_EDGE_TYPES (see Deviations).

## Verification Results

- `node tests/test-149-artifact-nodes.cjs` -- 5/5 GREEN
- `node tests/test-149-lineage-edges.cjs` -- 6/6 GREEN
- `node tests/test-149-idempotent-upsert.cjs` -- 4/4 GREEN
- `bash tests/run-all-149.sh` -- 3 passed, 0 failed, 5 MISSING (owned by Plans 02/03 as designed); runner exits 1 only because of the intentional MISSING suites
- `node scripts/check-substrate.cjs --diff` (staged) -- exit 0 (no navigation bypass added)
- `node lib/memory/navigation-write-edge.test.cjs` -- 9/9 (no writeEdge regression from the additive edge types)
- `node tests/test-edges-affiliated-with-floor.cjs` -- 4/4 (ALLOWED_EDGE_TYPES floor preserved, still a frozen Set)
- `node -e require('./lib/core/navigation.cjs')` -- all 6 re-exports resolve (3 functions + 2 id helpers + ARTIFACT_TYPES of length 7)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] FEEDS_INTO and VALIDATES were not shipped members of the LOCAL edge taxonomy**
- **Found during:** Task 2 (and confirmed pre-flight before Task 1 test design)
- **Issue:** The plan instructed `writeLineageEdge` to delegate to `edges.writeEdge` for `FEEDS_INTO / VALIDATES / INFORMS` and stated these were already in the shipped `ALLOWED_EDGE_TYPES` taxonomy. In fact only `INFORMS` was a member of the LOCAL `ALLOWED_EDGE_TYPES` Set in `lib/core/navigation/edges.cjs`. `FEEDS_INTO` and `VALIDATES` exist only in the Brain-side framework graph code (`lib/brain/`), never in the LOCAL room.db edge taxonomy (`edges.cjs` ALLOWED_EDGE_TYPES nor `lazygraph-ops.cjs` EDGE_TYPES). Without them, `writeEdge` rejects FEEDS_INTO/VALIDATES, so the Task 1 tests (which assert FEEDS_INTO + VALIDATES write) and the plan must_haves (lineage edges resolve from the taxonomy) cannot pass.
- **Fix:** Added `FEEDS_INTO` and `VALIDATES` to `ALLOWED_EDGE_TYPES` additively, using the documented additive idiom (verbatim mirror of the Phase 143.1-03 PIVOTED / SELECTED_REACH block). This is exactly the path the SPEC sanctions: requirement 3 says "all edge types resolve from the existing taxonomy or are added additively per the ALLOWED_EDGE_TYPES idiom." The plan task's "add NO new taxonomy member" constraint is honored at the `writeLineageEdge` layer (it constrains to a subset, inventing nothing); the additive edge-type members live in the single-source-of-truth Set in edges.cjs, not in the new submodule.
- **Files modified:** lib/core/navigation/edges.cjs
- **Commit:** 6728d9a8
- **Regression guard:** the edge floor tests assert FLOOR membership + frozen-Set shape, never an exact count, so the two additions cannot regress baseline (verified: navigation-write-edge.test 9/9, edges-affiliated-with-floor 4/4).

## Canon / Project-Rule Compliance

- Canon Part 9 (navigation chokepoint): every write routes through the navigation allow-listed submodule; zero direct room.db opens (substrate --diff exit 0; grep-floor test GREEN).
- Canon Part 9 v1.5 (audit-node carve-out): planning_artifact + requirement are system-bookkeeping nodes; created_by=system review_status=confirmed is canon-legal, never a truth-claim promotion.
- Canon Part 8 (zero Brain egress): the module has no network surface; requires only ./edges.cjs; the artifact body never lands on a node or edge (properties are phase id + artifact-type enum + path handle + status enum).
- Canon Part 7 (reuse before build): reuses navigation.cjs + edges.writeEdge + the shipped ALLOWED_EDGE_TYPES idiom; the only net-new is the node-type writer.
- No em-dashes: confirmed by the no-em-dash codepoint sweep test over the writer source.
- check-sendpacket pre-commit hook: did NOT block either commit (the documented mindrian-brain-shim.test.cjs false-positive was not triggered; no flag on any new file).

## Known Stubs

None. The three writers are fully wired and tested. The five MISSING suites (requirement-nodes, navigable, brain-egress, backfill, navigation-only-invariant) are owned by Plans 02/03 by design and are tolerated as MISSING by the aggregator; they are not stubs in this plan's surface.

## Self-Check: PASSED

Created files verified present:
- lib/core/navigation/planning-artifacts.cjs FOUND
- tests/run-all-149.sh FOUND
- tests/test-149-artifact-nodes.cjs FOUND
- tests/test-149-lineage-edges.cjs FOUND
- tests/test-149-idempotent-upsert.cjs FOUND

Commits verified in git log:
- 1f2eaadb FOUND (Task 1)
- 6728d9a8 FOUND (Task 2)
