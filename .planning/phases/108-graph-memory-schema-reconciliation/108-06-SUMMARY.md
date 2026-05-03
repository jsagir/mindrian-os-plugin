---
phase: 108-graph-memory-schema-reconciliation
plan: "06"
subsystem: docs
tags: [canon-part-9, cross-reference-matrix, ratification-path, canon-phase-map, traceability, no-canon-edit-guard]

# Dependency graph
requires:
  - phase: 108-00
    provides: "Wave-0 test stub at tests/test-canon-crossref-completeness.cjs (replaced)"
  - phase: 108-01
    provides: "RECONCILIATION.md - the file the test walks row-by-row to verify Canon Part citations"
  - phase: 108-02
    provides: "PROVENANCE.md - cross-referenced from PART-9-PROPOSAL.md matrix (Part 4 + Part 9 cite)"
  - phase: 108-03
    provides: "TRUTH-STATES.md - cross-referenced from PART-9-PROPOSAL.md matrix (Part 5 + Part 9 cite)"
  - phase: 108-04
    provides: "aliases.yml - cross-referenced from PART-9-PROPOSAL.md matrix (Part 7 cite)"
provides:
  - ".planning/phases/108-graph-memory-schema-reconciliation/PART-9-PROPOSAL.md - cross-reference checklist binding every Phase 108 deliverable (D-01..D-05) to Canon Parts 1, 4, 5, 7, 8, 9; ratification path for Phase 109 release gate"
  - "docs/CANON-PHASE-MAP.md Part 9 (proposed) subsection - 3 rows mapping Phases 108 (proposal) / 109 (implementation + ratification) / 110 (Brain wire enforcement) to the new canon part"
  - "tests/test-canon-crossref-completeness.cjs - 8-assertion harness asserting every reconciliation decision cites at least one Canon Part, with explicit guard that docs/MINDRIAN-CANON.md is NOT edited (Phase 109 release gate ratifies)"
affects: [109-sql-context-memory-navigation-spine, 110-brain-context-packet-contract]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Section-aware Markdown table parsing: skip rows in the '## Resolution Categories' legend section (which defines column-value VOCABULARY) when validating that decision rows carry Canon Part citations - distinguishes definitions from decisions"
    - "Pitfall 7 substrate (proposal-as-canon-source-during-proposal-phase): test treats PART-9-PROPOSAL.md as the valid source for Part 9 references during Phase 108; after Phase 109 ratification, the test reads docs/MINDRIAN-CANON.md instead"
    - "Phase-deferred ratification guard: explicit assertion that docs/MINDRIAN-CANON.md does NOT contain '## Part 9' as a heading - prevents accidental premature canon edits during Phase 108 work"

key-files:
  created:
    - .planning/phases/108-graph-memory-schema-reconciliation/PART-9-PROPOSAL.md
  modified:
    - docs/CANON-PHASE-MAP.md (added "### Part 9 (proposed) - Memory Locality and Interpretation" subsection at lines 121-129; existing Parts 1-8 + Appendices untouched)
    - tests/test-canon-crossref-completeness.cjs (replaced Wave-0 stub with 8-assertion harness; legend-section exemption applied to Tests 4 + 5)

key-decisions:
  - "PART-9-PROPOSAL.md does NOT duplicate the Part 9 canon text. The canonical source is .planning/research/2026-05-03-canon-part-9-memory-locality-proposal.md; this file holds the cross-reference matrix + ratification path + citation index only. Per RESEARCH Anti-Pattern #2 (do not duplicate authoritative artifacts)."
  - "docs/MINDRIAN-CANON.md is NOT edited during Phase 108. Part 9 ratification is the Phase 109 release-gate trigger. The test asserts the absence of '## Part 9' as a heading to enforce this constitutionally per CONTEXT D-06."
  - "Test exempts the '## Resolution Categories' legend section from the Canon-Part-citation requirement. The 4 rows at lines 12-15 of RECONCILIATION.md (EXISTS / EXTEND / NEW / RESERVED) define what those VALUES MEAN - they are vocabulary definitions, not reconciliation decisions, and therefore carry no Canon Part citation by design. The test enforces the citation requirement against actual decision rows in subsequent sections (Edge Reconciliation, Node Reconciliation, etc.)."
  - "Per RESEARCH Pitfall 7, the test treats PART-9-PROPOSAL.md as the valid source for Part 9 citation resolution during Phase 108. After Phase 109 ratification, this resolution shifts to docs/MINDRIAN-CANON.md. The test as written hard-codes the Phase 108 behavior; updating it to read the canon for Part 9 is a Phase 109 follow-up."
  - "PART-9-PROPOSAL.md cites Canon Parts 1, 4, 5, 7, 8 explicitly per RESEARCH section 7 traceability matrix. The test asserts each of those 5 citations exists, providing a regression guard against future edits that drop a citation."

patterns-established:
  - "Section-aware reconciliation parsing: legend tables (column-value vocabulary definitions) are recognized via the '## Resolution Categories' H2 boundary and excluded from decision-citation enforcement"
  - "Proposal cross-reference document pattern: when a canon amendment is in flight, the in-progress phase ships a cross-reference checklist (PART-N-PROPOSAL.md) that holds the matrix + ratification path WITHOUT duplicating the canon text - the canon source-of-truth lives in research/, the canon merge lives in docs/MINDRIAN-CANON.md, and the in-flight phase holds only the bridge"
  - "Phase-deferred ratification test guard: explicit absence assertions ('## Part N' heading does NOT yet exist) protect canon parts that are in flight from accidental premature ratification during the proposal phase"

requirements-completed:
  - RECONCILE-108-06

# Metrics
duration: ~16min
started: "2026-05-03T11:50:00Z"
completed: "2026-05-03T12:06:51Z"
---

# Phase 108 Plan 06: Canon Part 9 Cross-Reference Checklist Summary

**Shipped PART-9-PROPOSAL.md (cross-reference matrix binding Phase 108 D-01 through D-05 deliverables to Canon Parts 1, 4, 5, 7, 8, 9 + ratification path through Phase 109 release gate + citation index by canon part) + docs/CANON-PHASE-MAP.md "Part 9 (proposed)" subsection (3 rows mapping Phases 108 / 109 / 110 to the implementing cluster) + 8-assertion canon-crossref-completeness test harness with constitutional guard that docs/MINDRIAN-CANON.md is NOT edited prematurely. Phase 108 acceptance test #4 satisfied (CANON-PHASE-MAP.md has Part 9 (proposed) row pointing at Phases 108/109/110).**

## Performance

- **Duration:** ~16 min
- **Started:** 2026-05-03T11:50:00Z
- **Completed:** 2026-05-03T12:06:51Z
- **Tasks:** 3
- **Files modified:** 3 (1 created + 2 modified)

## Accomplishments

- `PART-9-PROPOSAL.md` ships the complete cross-reference matrix (RESEARCH section 7 traceability matrix verbatim) + ratification path (6-step Phase 108 -> Phase 109 release-gate -> canon merge sequence) + citation index (which Canon Part each Phase 108 deliverable cites) + risks-acknowledged section (3 risks per Canon Part 9 proposal) + recommended-decision section (verbatim "approve in principle now, ratify at Phase 109 release gate") + anti-patterns-avoided section. Cites Canon Parts 1, 4, 5, 7, 8, 9. References the Part 9 proposal source file at `.planning/research/2026-05-03-canon-part-9-memory-locality-proposal.md` without duplicating its contents.
- `docs/CANON-PHASE-MAP.md` gains the "### Part 9 (proposed) - Memory Locality and Interpretation" subsection (3-row table: Phase 108 proposed, Phase 109 planned, Phase 110 planned). Existing Parts 1-8 rows untouched; existing Appendices A-E untouched; existing Version-history table untouched.
- `tests/test-canon-crossref-completeness.cjs` replaces the Plan 108-00 Wave-0 stub with an 8-assertion harness: PART-9-PROPOSAL.md required-sections check, CANON-PHASE-MAP.md Part 9 (proposed) subsection check, MINDRIAN-CANON.md NOT-edited guard, every reconciliation row cites a Canon Part check (with legend-section exemption), every cited Canon Part resolves check (Parts 1-8 in MINDRIAN-CANON, Part 9 in PROPOSAL per Pitfall 7), PART-9-PROPOSAL.md cites Parts 1/4/5/7/8 check, zero em-dashes check, zero en-dashes check. All 8 PASS; exit 0.

## Task Commits

1. **Task 1: Author PART-9-PROPOSAL.md** - `30ef53b` (feat: feat(108-06): author PART-9-PROPOSAL.md cross-reference checklist)
2. **Task 2: Add Part 9 (proposed) subsection to docs/CANON-PHASE-MAP.md** - `fd83c12` (docs: docs(108-06): add Part 9 (proposed) subsection to CANON-PHASE-MAP.md)
3. **Task 3: Fill tests/test-canon-crossref-completeness.cjs** - `bf8232d` (test: test(108-06): fill canon-crossref-completeness harness with legend exemption)

**Plan metadata commit:** (this commit) `docs(108-06): complete canon Part 9 cross-reference plan`

## Files Created/Modified

- `.planning/phases/108-graph-memory-schema-reconciliation/PART-9-PROPOSAL.md` (10149 bytes) - Cross-reference checklist; Phase 108 D-06 deliverable; cited by the cross-ref test as the Part 9 source during Phase 108 (Pitfall 7 substrate)
- `docs/CANON-PHASE-MAP.md` - "### Part 9 (proposed) - Memory Locality and Interpretation" subsection added (lines 121-129); Parts 1-8 + Appendices untouched
- `tests/test-canon-crossref-completeness.cjs` (~210 LOC) - 8-assertion harness; legend-section exemption applied to Tests 4 + 5

## Decisions Made

1. **Cross-reference document, not canon duplication.** PART-9-PROPOSAL.md REFERENCES `.planning/research/2026-05-03-canon-part-9-memory-locality-proposal.md` as the source-of-truth for Part 9 text; it does not duplicate the proposal contents. The matrix + ratification path + citation index are the load-bearing additions; the Part 9 text itself stays in research/ until Phase 109 merges it into docs/MINDRIAN-CANON.md. Per RESEARCH Anti-Pattern #2 (no duplicate authoritative artifacts).

2. **Constitutional non-edit guard on docs/MINDRIAN-CANON.md.** The test asserts `^##\s+Part 9\s` does NOT match in MINDRIAN-CANON.md. This makes the Phase-108-does-not-ratify-Part-9 contract enforceable in CI rather than relying on reviewer discipline. Per CONTEXT D-06 + RESEARCH Anti-Pattern #2.

3. **Pitfall 7 substrate: PART-9-PROPOSAL.md is the Part 9 citation source DURING Phase 108.** The cross-ref test resolves Part 9 citations against PART-9-PROPOSAL.md (not MINDRIAN-CANON.md, which does not yet contain Part 9). After Phase 109 ratification, the test must be updated to read MINDRIAN-CANON.md for Part 9 - this is documented in the test header comments and tracked as a Phase 109 follow-up.

4. **Legend-section exemption (deviation - see below).** The test originally treated EVERY row matching `| EXISTS | EXTEND | NEW | RESERVED |` as a reconciliation decision requiring a Canon Part citation. The "## Resolution Categories" section at the top of RECONCILIATION.md is the LEGEND TABLE that defines what those values MEAN as column vocabulary - those rows are not decisions, they are definitions. The test now skips rows inside that section.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test harness false-positived on the legend table**

- **Found during:** Task 3 (cross-ref test execution)
- **Issue:** Test 4 ("every reconciliation row in RECONCILIATION.md cites at least one Canon Part") and Test 5 ("every Canon Part cited in RECONCILIATION.md resolves") parsed all rows matching `| EXISTS | EXTEND | NEW | RESERVED |` regardless of section. RECONCILIATION.md lines 12-15 contain a legend table that defines those four words as the resolution-class VOCABULARY (e.g., `| EXISTS | Already shipped; reuse as-is. No new code or schema in Phase 109. |`). Those legend rows are not reconciliation decisions; they are column-value definitions and therefore carry no Canon Part citation by design. The unmodified test reported 3 of those legend rows as orphans.
- **Fix:** Added section-aware parsing in both Test 4 and Test 5. The parsers now track an `inLegendSection` / `pastLegend` flag while iterating lines: rows inside `## Resolution Categories` are skipped; rows in subsequent H2 sections (Edge Reconciliation, Node Reconciliation, etc.) are parsed normally. The Canon-Part-citation requirement now applies to actual decision rows only.
- **Files modified:** tests/test-canon-crossref-completeness.cjs (Tests 4 + 5; ~30 LOC added per test)
- **Verification:** `node tests/test-canon-crossref-completeness.cjs` exits 0 with 8 of 8 assertions PASS, including "every reconciliation row in RECONCILIATION.md cites at least one Canon Part" and "every Canon Part cited in RECONCILIATION.md resolves".
- **Committed in:** `bf8232d`

**Why Path A (test exemption) over Path B (add citations to legend rows):** Path B (adding Canon Part citations to legend definitions) would be semantically incorrect: the legend rows define what `EXISTS` means as a column value across the whole table; they are not THEMSELVES reconciliation decisions about a specific node or edge. Adding e.g. "Part 4" to "Already shipped; reuse as-is" would be a category error - what does Part 4 cite for the WORD "EXISTS"? Path A correctly distinguishes vocabulary definitions from decisions, and matches the test's intent (verify decisions, not vocabulary).

---

**Total deviations:** 1 auto-fixed (1 bug - test harness section-awareness).
**Impact on plan:** No scope change. The test logic is now semantically correct (validates decisions, not vocabulary). The deviation pattern (section-aware Markdown parsing) is documented as a reusable pattern for future tests that walk RECONCILIATION-style documents.

## Issues Encountered

- None. Tasks 1 + 2 executed cleanly per the plan spec; Task 3's deviation was caught at first test run and fixed in a single edit.

## User Setup Required

None - no external service configuration required. Phase 108 ships zero runtime infrastructure.

## Phase 108 Acceptance Test Status (after Plan 108-06)

Per CONTEXT acceptance criteria:

1. **RECONCILIATION.md resolves every Codex term** (Plan 108-01) - **YES** (shipped)
2. **aliases.yml ships and is loaded by pre-commit hook** (Plans 108-04 + 108-05) - **YES** (shipped)
3. **Part 9 invariant SQL query specified** (Plan 108-02 PROVENANCE.md) - **YES** (specified; runtime test stays a stub per RESEARCH Pitfall 6 - lights up after Phase 109 ships nodes.review_status column)
4. **CANON-PHASE-MAP.md has Part 9 (proposed) row pointing at Phases 108/109/110** (this plan) - **YES** (shipped in Task 2)
5. **CHANGELOG entry for v1.13.0 documenting reconciliation** - **DEFERRED** to release commit (per CONTEXT acceptance test #5; CHANGELOG is a release-time artifact, not a Phase 108 plan deliverable)

Phase 108 plan deliverables 1-4 are now satisfied. Phase 108 is complete from a plan-execution standpoint; the v1.13.0 release commit (when scheduled) will close acceptance test #5.

## Cross-Reference Test Status

`node tests/test-canon-crossref-completeness.cjs` (after Plan 108-06):
```
PASS: PART-9-PROPOSAL.md contains required sections
PASS: CANON-PHASE-MAP.md contains Part 9 (proposed) subsection
PASS: docs/MINDRIAN-CANON.md is NOT edited to add Part 9 (deferred to Phase 109 release gate)
PASS: every reconciliation row in RECONCILIATION.md cites at least one Canon Part
PASS: every Canon Part cited in RECONCILIATION.md resolves (Parts 1-8 in CANON, Part 9 in PROPOSAL)
PASS: PART-9-PROPOSAL.md cites Canon Parts 1, 4, 5, 7, 8 (per RESEARCH §7 traceability matrix)
PASS: zero em-dashes (U+2014) in PART-9-PROPOSAL.md
PASS: zero en-dashes (U+2013) in PART-9-PROPOSAL.md
EXIT: 0
```

## Wave-0 Stub Fill Status (after Plan 108-06)

Per Plan 108-00 stub manifest, the 7 Phase 108 stubs ship through this plan as follows:

| # | Stub | Filled In | Status |
|---|------|-----------|--------|
| 1 | tests/test-reconciliation-completeness.cjs | Plan 108-01 | filled |
| 2 | tests/test-provenance-contract.cjs | Plan 108-02 | filled |
| 3 | tests/test-truth-state-taxonomy.cjs | Plan 108-03 | filled |
| 4 | tests/test-aliases-yaml-schema.cjs | Plan 108-04 | filled |
| 5 | tests/test-precommit-hook-aliases.cjs | Plan 108-05 | filled |
| 6 | tests/test-canon-crossref-completeness.cjs | Plan 108-06 (this plan) | filled |
| 7 | tests/test-part-9-invariant.cjs | Phase 109 | INTENTIONAL stub - lights up only after Phase 109 ships nodes.review_status column (RESEARCH Pitfall 6) |

6 of 7 stubs are now filled. Stub #7 remains a stub through all of Phase 108 by design.

## Next Phase Readiness

- Phase 108 graph-memory-schema-reconciliation complete from a plan-execution standpoint.
- Phase 108 ships zero new runtime code, zero new dependencies, zero edits to docs/MINDRIAN-CANON.md, zero edits to lib/core/*.cjs. The phase is purely contract + reconciliation + test substrate.
- Phase 109 sql-context-memory-navigation-spine is unblocked: it can now consume RECONCILIATION.md (D-01), PROVENANCE.md (D-02), TRUTH-STATES.md (D-03), aliases.yml (D-04), the pre-commit hook (D-05), and PART-9-PROPOSAL.md (D-06) as its load-bearing inputs.
- The Phase 109 release gate carries the Part 9 ratification trigger: at the v1.13.0 (or wherever Phase 109 ships) release commit, Part 9 merges into docs/MINDRIAN-CANON.md and Appendix D gains the Codex provenance attribution. This is documented in PART-9-PROPOSAL.md "Ratification Path" section.
- Phase 110 brain-context-packet-contract carries the structural-enforcement closure of Part 8 + Part 9 (Brain wire boundary becomes structurally hard, not just procedurally audited).

## Self-Check: PASSED

- File `.planning/phases/108-graph-memory-schema-reconciliation/PART-9-PROPOSAL.md`: FOUND
- File `docs/CANON-PHASE-MAP.md` (with Part 9 (proposed) subsection at lines 121-129): FOUND
- File `tests/test-canon-crossref-completeness.cjs`: FOUND
- Commit `30ef53b` (Task 1): FOUND
- Commit `fd83c12` (Task 2): FOUND
- Commit `bf8232d` (Task 3): FOUND
- `node tests/test-canon-crossref-completeness.cjs` exits 0 with 8/8 PASS: VERIFIED
- `git diff docs/MINDRIAN-CANON.md` returns empty (Phase 108 did not edit the canon): VERIFIED

---
*Phase: 108-graph-memory-schema-reconciliation*
*Plan: 06*
*Completed: 2026-05-03*
