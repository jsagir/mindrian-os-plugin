# Phase 132 tiny live cleanup -- result (2026-06-02)

Snapshot: 132-LIVE-CLEANUP-SNAPSHOT.json (full reversibility data for all 16 nodes).
All writes carry created_by/curated_by = 'phase-132-curation-batch-1'.
Live read-back BEFORE: scope_total 735, backfilled 721, held 14.

## DONE: dedup 1 pair (6831 / 22816)

Both were name 'The Other Way Round' | :Technique, correlation_id 4210289a0ca1596b, degree 0.
NOT identical: 6831 (former InventivePrinciple, description 'Invert the problem'); 22816 (former
TRIZPrinciple, unique `application`: 'Instead of aligning chips to light, make light self-align to
chips'). Collapse = absorb 22816.application onto 6831, stamp provenance, DELETE 22816.

Read-back AFTER: scope_total 734, backfilled 720, held 14. dup_deleted=true; 6831 carries the
application + curated_by. distinct correlation_ids: now 720 (the shared-id pair collapsed to one).

Rollback (if ever needed): re-create node 22816 with the props in the snapshot file; REMOVE
6831.application, 6831.absorbed_node_former_label, 6831.curated_by, 6831.dedup_absorbed_at.

## DEFERRED (to a deliberate curation pass): the 14 held disposition

The held-14 are GraphRAG-extraction artifacts (file_path: unknown_source, <SEP>-joined chunk
source_ids). The plan assumed a mechanical "rename"; the live collision check proved it is a MIX of
archive-as-duplicate + rename with per-node judgment. Renaming blindly would create 7 duplicates of
existing canonical nodes -- the exact pollution Phase 132 exists to prevent. The held nodes are SAFE
as-is (correlation_status='held-name-not-canonical', excluded from the contract, non-breaking), so
deferring is zero-risk. v1.13.1 ships coherent without this.

Collision table (held id -> would-be canonical name | primary_label -> existing collision):

| held id | canonical name | label | collides with (existing) | recommended disposition |
|---|---|---|---|---|
| 9655 | Scenario Planning | Method | 22551 (multi-facet canonical) | ARCHIVE + REPLACED_BY 22551 |
| 9529 | Validation | Method | 24058 (Stage, curated) | ARCHIVE + REPLACED_BY 24058 |
| 10455 | Problem Exploration Framework | Framework | 10482 (Framework, EXACT cid d6e30a3eef91050d) | ARCHIVE + REPLACED_BY 10482 |
| 9502 | Scenario Analysis Framework | Method | 585 (Framework, curated) | ARCHIVE + REPLACED_BY 585 |
| 9271 | Lateral Thinking | Method | 23289 (Book/Concept, de Bono) | ARCHIVE + REPLACED_BY 23289 |
| 9491 | Innovation Process | Method | 493 (:Person -- itself noise) | REVIEW (target is noise; maybe archive both) |
| 9551 | Graph-Based Logic Visualization | Method | 6191 (:Person -- itself noise) | REVIEW (target is noise; maybe archive both) |
| 9622 | Semantic Decomposition | Method | none | RENAME (clean) |
| 9625 | Sequential Innovation Discovery | Method | none | RENAME (clean) |
| 7841 | (keep name; already canonical, 81 chars) | Framework | none | RENAME/unhold (clear held + backfill cid ceebebef8c8a75d3) |
| 10468 | Problem-Solving Framework | Framework | none | RENAME (clean) |
| 10102 | Anti-Plan | Framework | none | RENAME (canonical-name judgment) |
| 9528 | Research | Method | none found, but generic noise | REVIEW (archive-vs-rename; too generic) |
| 9586 | CIAs approach | Method | none found, typo/noise | REVIEW (archive-vs-rename) |

Recommended pass: archive the 5 clean collisions (9655, 9529, 10455, 9502, 9271) with REPLACED_BY;
rename the 5 clean uniques (9622, 9625, 7841, 10468, 10102); REVIEW the 4 (9491, 9551, 9528, 9586)
with a human eye. All reversible via the snapshot + created_by selector. Tracked as DI-132-LIVE-01.
