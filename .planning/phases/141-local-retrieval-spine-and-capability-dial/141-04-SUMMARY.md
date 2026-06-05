---
phase: 141-local-retrieval-spine-and-capability-dial
plan: 04
subsystem: database
tags: [sqlite, navigation-chokepoint, evidence-claim, provenance, read-back-validation, canon-part-9]

# Dependency graph
requires:
  - phase: 131-source-lens-research
    provides: writeEvidenceClaim (the LOCKED Phase 136 forward-contract EvidenceClaim node writer)
  - phase: 125-selector-block
    provides: writeEdge + ALLOWED_EDGE_TYPES (INFORMS in the frozen set)
  - phase: 141-01
    provides: tests/test-fileval-readback.cjs RED suite + tests/fixtures/room-141-fixture.cjs
  - phase: 141-03
    provides: getRoomContext + getSessionHistory navigation.cjs re-exports (preserved, not clobbered)
provides:
  - fileEvidenceWithReadback wrapper (writeEvidenceClaim + INFORMS edge + read-back assertion, all transactional)
  - additive artifact_path provenance key inside the EvidenceClaim properties JSON (D-10, no column migration)
  - navigation.cjs chokepoint re-export of fileEvidenceWithReadback
affects: [143-fileval-01, drsch-execution, memdial-render-from-graph]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Read-back-validation honesty layer: write then SELECT-and-assert; a filing that did not land surfaces ok:false rather than being swallowed (FILEVAL honesty rule)"
    - "Thin wrapper over shipped writers (Canon Part 7 reuse): the wrapper owns no node-table insert; it wraps writeEvidenceClaim + writeEdge"
    - "Additive provenance key inside an existing TEXT properties JSON blob (no ALTER TABLE), preserving a locked forward-contract field set"

key-files:
  created:
    - lib/core/navigation/file-evidence-readback.cjs
  modified:
    - lib/core/navigation/evidence-claim.cjs
    - lib/core/navigation.cjs

key-decisions:
  - "artifact_path threaded through writeEvidenceClaim (not appended by the wrapper) as one optional key in the existing properties JSON blob, so the wrapper stays insert-free and the locked 4-field schema is byte-identical when artifact_path is absent"
  - "A closed/dead db handle is caught and surfaced as ok:false reason:transaction_failed rather than propagating, honoring the FILEVAL honesty rule even on the failure path"
  - "INFORMS edge is wired only when informsTargetId is supplied; the read-back asserts node landed proposed, the 4 locked fields round-tripped, and artifact_path round-tripped"

patterns-established:
  - "Pattern 1: BEGIN/COMMIT/ROLLBACK hand-rolled txn around node-write + edge-write (mirrors focus.cjs), then a post-commit read-back SELECT as the net-new honesty layer"
  - "Pattern 2: structured stable reason strings (filing_did_not_land / informs_edge_failed / transaction_failed) for every non-ok exit"

requirements-completed: [FILEVAL-02]

# Metrics
duration: 14min
completed: 2026-06-05
---

# Phase 141 Plan 04: FILEVAL-02 Read-Back-Validation Filing Wrapper Summary

**fileEvidenceWithReadback wraps the shipped writeEvidenceClaim + writeEdge in one transaction, reads the row back to assert it landed (proposed, locked provenance intact, artifact_path round-tripped), and surfaces a failed filing as ok:false instead of swallowing it.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-06-05
- **Completed:** 2026-06-05
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- New `lib/core/navigation/file-evidence-readback.cjs`: a thin read-back-validation wrapper over the shipped writers. Inside one BEGIN/COMMIT/ROLLBACK transaction it calls `writeEvidenceClaim`, wires an `INFORMS` edge via `writeEdge`, then post-commit reads the row back and asserts review_status 'proposed', the 4 locked Phase 136 provenance fields, and artifact_path round-trip. Any mismatch (or a dead handle) returns a structured `ok:false` reason, never a silent fake-recall.
- `evidence-claim.cjs`: `artifact_path` threaded purely additively into the existing properties JSON blob (no column migration), reserving the Phase 143 MEMDIAL render-from-graph path without renaming/dropping any of the 4 locked provenance fields.
- `navigation.cjs`: `fileEvidenceWithReadback` re-exported through the Part 9 chokepoint next to `writeEvidenceClaim`; the Plan 03 `getRoomContext` + `getSessionHistory` re-exports were preserved (no clobber).

## Task Commits

Tasks 1 and 2 are tightly coupled (the test only passes with both the wrapper and its chokepoint re-export), so they landed as one atomic feature commit:

1. **Task 1 + Task 2: wrapper + additive artifact_path + chokepoint re-export** - `446584c1` (feat)

**Plan metadata:** committed separately with this SUMMARY.

_Note: the RED test (test-fileval-readback.cjs) was shipped by Plan 01 and went GREEN with this commit; no separate test commit needed in this plan._

## Files Created/Modified
- `lib/core/navigation/file-evidence-readback.cjs` - The fileEvidenceWithReadback read-back-validation wrapper (writeEvidenceClaim + INFORMS edge + post-commit read-back assertion; caller-owned handle; no node-table insert of its own)
- `lib/core/navigation/evidence-claim.cjs` - Additive optional artifact_path key in the properties JSON blob (D-10); 4 locked provenance fields untouched
- `lib/core/navigation.cjs` - Re-export of fileEvidenceWithReadback through the chokepoint; 141-03 re-exports preserved

## Decisions Made
- Threaded `artifact_path` through `writeEvidenceClaim` rather than having the wrapper append it. This keeps the wrapper free of any node-table insert (the wrap-not-rebuild contract) and keeps the locked 4-field schema byte-identical when artifact_path is absent.
- A closed db handle (the test's failure driver) is caught at `db.exec('BEGIN')` and surfaced as `ok:false reason:transaction_failed`, satisfying the honesty rule on the failure path.

## Deviations from Plan

None - plan executed exactly as written. The artifact_path threading touched evidence-claim.cjs (not in the plan's `files_modified` list), but this was the plan-directed approach ("pass through ... plus the optional artifact_path") implemented additively; it is the cleanest way to keep the wrapper insert-free, so it is not a scope deviation.

## Issues Encountered
- Initial acceptance greps (`grep -c "INSERT INTO nodes"` and `grep -c "node:sqlite"`) returned 2 each because the wrapper's doc-comments mentioned those literal tokens in prose. Reworded the comments to "node-table insert" / "sqlite built-in" so the literal acceptance greps now return 0 while preserving the documentation's meaning.

## Deferred Issues

- **DI-141-04-01:** `tests/test-retrieval-seed.cjs` (RETR-02) is RED in `run-all-141.sh` (8/9 passing). It asserts `scripts/intent-classifier.cjs` no longer hard-codes `userText: null` (the D-03 seam). This is owned by a different plan; Plan 141-04's contract explicitly forbids touching `scripts/intent-classifier.cjs`, and the failing test references none of this plan's surfaces. It was already RED at HEAD. Logged to `deferred-items.md`.

## Known Stubs
None - the wrapper is fully wired against shipped writers. The "unused consumer" status (no live producer in Phase 141) is expected per D-02a; first consumers are deferred (DRSCH execution + Phase 143 FILEVAL-01).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- FILEVAL-02 substrate is reachable through the Part 9 chokepoint as `navigation.fileEvidenceWithReadback`, ready for the deferred DRSCH execution producer and Phase 143 FILEVAL-01.
- artifact_path is reserved additively, keeping the deferred Phase 143 MEMDIAL render-from-graph projection (D-09) possible.
- Blocker note for the phase orchestrator: RETR-02 (`test-retrieval-seed.cjs`) remains RED pending its own D-03 seam edit in `scripts/intent-classifier.cjs`.

## Self-Check: PASSED

- FOUND: lib/core/navigation/file-evidence-readback.cjs
- FOUND: .planning/phases/141-local-retrieval-spine-and-capability-dial/141-04-SUMMARY.md
- FOUND: commit 446584c1

---
*Phase: 141-local-retrieval-spine-and-capability-dial*
*Completed: 2026-06-05*
