// =============================================================================
// 130.7-01 BACKFILL DRY-RUN CAPTURE (CORRECTED -- LOCKED contract of record)
// =============================================================================
// Re-captured 2026-06-01 from `node scripts/backfill-correlation-id.cjs --dry-run`
// AFTER the corrective conformance pass. This replaces the prior capture that
// showed the non-conformant 'c1:'-prefixed full-sha256 ids and the old
// correlation_backfill_version property.
//
// What conforms here (vs the old capture):
//   - correlation_id is the BARE 16-char lowercase hex (no 'c1:' prefix):
//       sha256( utf8( name + '|' + primary_label ) ).hex().slice(0,16)
//     The anchor verifies in-line: The Other Way Round | Technique -> 4210289a0ca1596b.
//   - CLEAN nodes (size(name) <= 80) get the THREE-property write:
//       n.correlation_id, n.correlation_scope='curated-v1', n.correlation_backfilled_at
//     (NO correlation_backfill_version; NO created_by:'phase-132-curation').
//   - HELD nodes (size(name) > 80) get ONLY n.correlation_status='held-name-not-canonical'
//     (NO correlation_id) -- the last node below is the held example.
//   - primary_label resolved by the LOCKED 10-label priority order
//     (Framework > Technique > Method > Tool > CorePrinciple > ProblemType >
//      ValidationTool > WorthinessCriteria > Stage > Phase). 'The Other Way Round'
//     appears under BOTH Technique (the anchor) AND Framework (a genuine
//     cross-label duplicate -> two distinct ids, no fork).
//
// The $ts value below is shown as a placeholder; at --execute time it is the
// ISO timestamp of the run. The dry-run performs ZERO Brain reads and ZERO
// Brain writes; it is built from the local built-in representative set.
// =============================================================================

=== DRY RUN: correlation_id backfill (NO Brain write) ===
Read set source: LOCAL fixture/built-in

--- MERGE/SET Cypher (per-node, $-bound on --execute) ---
// CLEAN node: Beautiful Question Framework :Framework
MATCH (n {name: $name}) WHERE $label IN labels(n) SET n.correlation_id = $cid, n.correlation_scope = $scope, n.correlation_backfilled_at = $ts
// $params = {"name":"Beautiful Question Framework","label":"Framework","cid":"489f01a5417dec3c","scope":"curated-v1","ts":"<ISO-timestamp-at-execute-time>"}

// CLEAN node: Jobs-to-be-Done :Framework
MATCH (n {name: $name}) WHERE $label IN labels(n) SET n.correlation_id = $cid, n.correlation_scope = $scope, n.correlation_backfilled_at = $ts
// $params = {"name":"Jobs-to-be-Done","label":"Framework","cid":"721930ae520f8969","scope":"curated-v1","ts":"<ISO-timestamp-at-execute-time>"}

// CLEAN node: HEART Framework :Framework
MATCH (n {name: $name}) WHERE $label IN labels(n) SET n.correlation_id = $cid, n.correlation_scope = $scope, n.correlation_backfilled_at = $ts
// $params = {"name":"HEART Framework","label":"Framework","cid":"015d060a3720937f","scope":"curated-v1","ts":"<ISO-timestamp-at-execute-time>"}

// CLEAN node: Six Thinking Hats :Framework
MATCH (n {name: $name}) WHERE $label IN labels(n) SET n.correlation_id = $cid, n.correlation_scope = $scope, n.correlation_backfilled_at = $ts
// $params = {"name":"Six Thinking Hats","label":"Framework","cid":"e5dd579df3858000","scope":"curated-v1","ts":"<ISO-timestamp-at-execute-time>"}

// CLEAN node: SWOT Analysis :Framework
MATCH (n {name: $name}) WHERE $label IN labels(n) SET n.correlation_id = $cid, n.correlation_scope = $scope, n.correlation_backfilled_at = $ts
// $params = {"name":"SWOT Analysis","label":"Framework","cid":"4f55bc4826eb5171","scope":"curated-v1","ts":"<ISO-timestamp-at-execute-time>"}

// CLEAN node: Porter Five Forces :Framework
MATCH (n {name: $name}) WHERE $label IN labels(n) SET n.correlation_id = $cid, n.correlation_scope = $scope, n.correlation_backfilled_at = $ts
// $params = {"name":"Porter Five Forces","label":"Framework","cid":"7b7f14df07080f30","scope":"curated-v1","ts":"<ISO-timestamp-at-execute-time>"}

// CLEAN node: Blue Ocean Strategy :Framework
MATCH (n {name: $name}) WHERE $label IN labels(n) SET n.correlation_id = $cid, n.correlation_scope = $scope, n.correlation_backfilled_at = $ts
// $params = {"name":"Blue Ocean Strategy","label":"Framework","cid":"76781c8c606beca9","scope":"curated-v1","ts":"<ISO-timestamp-at-execute-time>"}

// CLEAN node: Lean Canvas :Framework
MATCH (n {name: $name}) WHERE $label IN labels(n) SET n.correlation_id = $cid, n.correlation_scope = $scope, n.correlation_backfilled_at = $ts
// $params = {"name":"Lean Canvas","label":"Framework","cid":"88a990ce52c57d15","scope":"curated-v1","ts":"<ISO-timestamp-at-execute-time>"}

// CLEAN node: The Other Way Round :Technique
MATCH (n {name: $name}) WHERE $label IN labels(n) SET n.correlation_id = $cid, n.correlation_scope = $scope, n.correlation_backfilled_at = $ts
// $params = {"name":"The Other Way Round","label":"Technique","cid":"4210289a0ca1596b","scope":"curated-v1","ts":"<ISO-timestamp-at-execute-time>"}

// CLEAN node: The Other Way Round :Framework
MATCH (n {name: $name}) WHERE $label IN labels(n) SET n.correlation_id = $cid, n.correlation_scope = $scope, n.correlation_backfilled_at = $ts
// $params = {"name":"The Other Way Round","label":"Framework","cid":"6bb7df7ddfd935ef","scope":"curated-v1","ts":"<ISO-timestamp-at-execute-time>"}

// HELD node (name > 80 chars; correlation_status only): A method for inverting the problem statement so the team rea... :Method
MATCH (n {name: $name}) WHERE $label IN labels(n) SET n.correlation_status = $status
// $params = {"name":"A method for inverting the problem statement so the team reasons backward from the undesired outcome instead of forward from the goal, surfacing hidden constraints","label":"Method","status":"held-name-not-canonical"}

--- correlation_labels index (LOCAL artifact; clean rows only; never egresses) ---
Beautiful Question Framework | Framework | 11
Blue Ocean Strategy | Framework | 6
HEART Framework | Framework | 8
Jobs-to-be-Done | Framework | 14
Lean Canvas | Framework | 10
Porter Five Forces | Framework | 7
SWOT Analysis | Framework | 9
Six Thinking Hats | Framework | 12
The Other Way Round | Framework | 9
The Other Way Round | Technique | 5

--- Summary ---
nodes scanned:    11
clean (backfilled): 10 (3-property write: correlation_id + correlation_scope + correlation_backfilled_at)
held (quarantined): 1 (correlation_status=held-name-not-canonical only; NO correlation_id)
writes emitted:   11 (dry-run; none executed)
index rows:       10
correlation_scope: curated-v1

Run with --execute (ADMIN ONLY, write-capable MINDRIAN_BRAIN_KEY) to apply.
