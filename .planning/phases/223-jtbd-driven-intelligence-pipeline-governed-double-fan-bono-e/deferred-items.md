# Phase 223 Deferred Items

## Pre-existing run-all-164.sh baseline failures (NOT 223-01 regressions)

Confirmed baseline at `git diff --name-status HEAD~4 HEAD`: Plan 223-01 is
ADDED-ONLY (5 new files, zero shipped files modified). The Part 7 hard rule held
(cell-fanout.cjs / debate-composition.cjs / graph-derivation.cjs untouched).

`bash tests/run-all-164.sh` reports 17 PASSED / 3 FAILED at this tree. All three
failures import ZERO 223 files and are driven by Phase 224 schema drift landing
after Phase 164's tests were written:

- `test-issue-tree-edge-remap.cjs` -- `writeEdge rejected ... "table edges has no
  column named review_status"`. Phase 224 added a `review_status` column to the
  edge-write path; this Phase-164 test builds a room.db without the Phase-224
  migration, so writeEdge rejects. Same family as the STATE.md Phase-224
  documented baseline (`run-all-169.sh` 4-leg + `test-futures-cascade-integration`).
- `test-bono-verdict.cjs` -- pre-existing, unrelated to 223 files.
- `canon-version assertion` -- pre-existing version-map assertion, unrelated.

Not fixed here: out of scope (Phase 224 migration wiring in shipped test paths,
not this plan's files). The plan's own two legs are green:
`node tests/test-223-hat-governance.cjs` (10 checks) and
`node tests/test-223-part8-egress.cjs` (4 checks).

## 223-02 (close-loop-writer)

- **run-all-164.sh 17/3 (pre-existing):** stale canon-version assertion + test-issue-tree-edge-remap + test-bono-verdict. Phase-224 review_status schema drift; import ZERO 223-02 files. Confirmed unchanged by 223-02 (additive-only). Not ours (additional_notes explicit).
- **test-219-banking.cjs Test 4 (pre-existing):** linkOpportunityEvidence DERIVED_FROM edge assertion fails on the fresh edges schema (Phase-224 review_status drift, same class as run-all-219 11/2 documented in 226-02). Verified pre-existing by running the test against the HEAD (pre-223-02) opportunity-ops.cjs -- it fails identically. My bankOpportunity change is additive frontmatter emit ONLY; it cannot touch linkOpportunityEvidence/writeEdge.
- **opportunity-ops.cjs:769 em-dash (pre-existing):** `// Source may not exist — proceed with defaults` from commit eb59231b (Phase 13-03), far from the 223-02 additive block. My additions are em-dash clean (git diff verified).
