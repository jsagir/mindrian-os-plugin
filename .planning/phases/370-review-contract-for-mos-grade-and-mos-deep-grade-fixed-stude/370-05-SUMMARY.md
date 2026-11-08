---
phase: 370-review-contract-for-mos-grade-and-mos-deep-grade-fixed-stude
plan: 05
subsystem: review-contract
tags: [review-contract, mcp, artifact_file, pre-write-refusal, tdd]
requires: [370-04]
provides:
  - artifact_file refuses a review (by frontmatter) that breaks the contract, pre-write
  - tests/test-370-filedoor.cjs (arms W1 to W7)
key-files:
  created:
    - tests/test-370-filedoor.cjs
  modified:
    - lib/mcp/tools/views.cjs
key-decisions:
  - "O8 FRONTMATTER: classify by frontmatter (applies_to), never by path. A review with no frontmatter is a stated limit (arm W6)."
requirements-completed: [REV370-09]
completed: 2026-11-08
---

# Phase 370 Plan 05: Filing door refuses a bad review Summary

`fileArtifact` in lib/mcp/tools/views.cjs now returns `{ ok: false, reason: 'review_contract_violation', violations: [{rule, tier, class, line}], contract_version }` for a review that fails the check. The check runs after the `invalid_filename` refusal and before the filing gate, so no directory, file, memory_event or node is written.

## Gate (PROVEN)

`370-gate.cjs gate-item 370-DECISION.md O8 --need FRONTMATTER`: `RESOLVED O8=FRONTMATTER`, exit 0. `data/review-contract.json` has `enforcement.door` equal to `frontmatter`. The declined branch did not apply. BASE (HEAD at start): 9d1be3bd0688a3d3f9a133929c0d44fb73cd7512. `git status --short lib/mcp/tools/views.cjs tests/test-370-filedoor.cjs` was empty at start.

## Commits

| Commit | Files |
|--------|-------|
| 63ac3a207 | tests/test-370-filedoor.cjs (RED) |
| 0f1a2a6c6 | lib/mcp/tools/views.cjs (GREEN) |

Not pushed. No tag, no version change, no dist regeneration.

## Design

- Helper `reviewContractRefusal(roomDir, content)` above `fileArtifact`. It requires `../../core/review-contract.cjs` lazily inside the function, so MCP start loads no new module.
- Step A (classification): `loadContract`, door must be `frontmatter`, `isReviewArtifact`. Any throw returns null (not a review).
- Step B (check): `collectSourceText(roomDir)` only when `soft_terms.policy` is `exempt_if_in_source`; then `checkReview`. A throw returns `review_contract_unavailable` (never filed unchecked).
- The registerTool block of `artifact_file` is untouched. A diff of the change shows no line with title, description or inputSchema.

## TDD record

RED (before the change, `PASS: 3 FAIL: 4`):

```
FAIL W1 violating review refused before any write: ok must be false (got true, want false)
FAIL W4 swapped sections refused with rule shape_order: ok must be false (got true, want false)
FAIL W5 soft terms follow soft_terms.policy (exempt_if_in_source): no source: must refuse (got true, want false)
FAIL W7 classified review whose check throws is refused as unavailable: ok must be false (got true, want false)
PASS: 3 FAIL: 4
```

W2, W3 and W6 passed in RED by design (they pin behavior that must not change).

GREEN (after the change):

```
ok W1 ... ok W7
PASS: 7 FAIL: 0
```

Arms: W1 refusal, no file, no section dir, no event, no artifact_id, no planted string in the result; W2 clean review files; W3 non-review with Neo4j and a header with no review keys file; W4 swapped sections give `shape_order`; W5 soft term refused with no source, filed when a student section file holds the word (policy `exempt_if_in_source`; the arm branches on the live policy for the other two values); W6 stated limit, no frontmatter is not refused (cover: pre-file wrapper and doctor template lint, plans 370-08 to 370-10); W7 check throw gives `review_contract_unavailable`, classification throw is treated as not a review.

## Verification (PROVEN)

- `node tests/test-370-filedoor.cjs`: PASS 7 FAIL 0.
- `node tests/test-354-room-symlink-containment.cjs`: PASS 10 checks.
- Tests that name fileArtifact or artifact_file, all pass: test-353-filing-gate (24/0), test-i2x-t2-node-write-back (78), test-366-canon-at-filing (25/0), test-36925-an01 (22/0), test-3551-fresh-mtime (38), test-ljj-tool-honesty (16/0).
- `node scripts/check-tool-honesty.cjs --check`: 3 WARN lines before and after (count did not grow).
- Tool budget and parity: `tests/test-270-tool-schema-budget.cjs` 5 passed 0 failed; `tests/test-384-s7-mcp-start.cjs` ALL PASS (registered file list equals the golden, 37 names). No tool description or schema moved, so no pin moved.
- Part 11 gates: `build-connector-registry --check` OK, `build-orchestration-projection --check` OK, `check-render-coverage` 0 gap.
- Non-ASCII bytes in lib/mcp/tools/views.cjs and tests/test-370-filedoor.cjs: none.

## Deviations from Plan

None in code. One note on the shared tree: `bash tests/run-all-370.sh` shows `PASS=9 FAIL=1`. The failing file is `tests/test-370-reference-drift.cjs` (arms D5, D6, D7, D10). It belongs to a peer plan (370-07, agents/grading.md and the reference), it is uncommitted in this tree, and it does not touch views.cjs. It is not caused by this plan.

## Known Stubs

None.

## Threat Flags

None. No new endpoint or file access. The door reads student section text locally through `collectSourceText` (bounded, skips symlinks) and never returns or logs it.

## Self-Check

Files exist: tests/test-370-filedoor.cjs, lib/mcp/tools/views.cjs. Commits 63ac3a207 and 0f1a2a6c6 exist on main. Each commit holds exactly one file.
