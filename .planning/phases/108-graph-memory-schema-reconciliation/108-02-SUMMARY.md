---
phase: 108-graph-memory-schema-reconciliation
plan: "02"
subsystem: graph-memory-schema
tags: [provenance, sqlite, room-db, contract-spec, canon-part-9, phase-109-bridge]

# Dependency graph
requires:
  - phase: 108-00
    provides: Wave-0 substrate (REQ-IDs RECONCILE-108-01..06, 7 test stubs including the test-provenance-contract-schema.cjs stub that this plan fills)
provides:
  - PROVENANCE.md contract specifying 6 required + 3 optional provenance fields for the nodes table (specification only; Phase 109 ships the migration)
  - Closed created_by enum (5 values) with CHECK constraint specification for Phase 109 to copy verbatim
  - Canonical Part 9 invariant SQL query verbatim from CONTEXT D-02 (text only; runtime test stays a Wave-0 stub through all of Phase 108 per RESEARCH Pitfall 6)
  - Index strategy (mandatory idx_nodes_review_status + 5 recommended indices) for Phase 109 to implement
  - Phase 109 two-step migration plan (NULL columns + json_extract backfill, then re-create-table-with-NOT-NULL pattern)
  - Verbatim SQL column-type specification block mirroring CONTEXT D-02 lines 107-120 byte-for-byte
  - tests/test-provenance-contract-schema.cjs filled (10 assertions; Wave-0 stub no longer applies)
affects:
  - 108-03 (TRUTH-STATES.md depends on the review_status field reference; PROVENANCE.md names the 8-state enum)
  - 108-04 (aliases.yml status_aliases section depends on the created_by + review_status enum specifications)
  - 108-05 (pre-commit hook check-schema-aliases.cjs reads PROVENANCE.md as one of the source-of-truth files)
  - 108-06 (Canon Part 9 cross-reference completeness depends on the PROVENANCE.md Part 9 invariant SQL block)
  - 109 (SQL Spine: implementation phase that ships the actual ALTER TABLE migrations PROVENANCE.md specifies)
  - 110 (Brain Context Packet: depends on confirmed_by != 'user' invariant being enforceable via the ratified Part 9 contract)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Document-first contract specification preceding migration: Phase 108 specifies what columns exist; Phase 109 ships the SQL"
    - "Verbatim SQL block in spec doc allows Phase 109 plan-phase to copy-paste column-type definitions byte-identical"
    - "Test asserts spec contains required content + framing language (CONTRACT, not migration) to prevent future-phase misinterpretation"

key-files:
  created:
    - .planning/phases/108-graph-memory-schema-reconciliation/PROVENANCE.md
  modified:
    - tests/test-provenance-contract-schema.cjs (Wave-0 stub -> 133-line 10-assertion harness)

key-decisions:
  - "Frame PROVENANCE.md unambiguously as a CONTRACT specification, not a migration script (Codex tightening 2026-05-03 directive). Every MUST / required wording about provenance fields is scoped to Phase 109 implementation via parenthetical clauses like '(Phase 109 enforces NOT NULL)' and the Anti-Patterns Avoided footer that explicitly states this rule."
  - "Add Verbatim Column-Type Specification block mirroring CONTEXT D-02 lines 107-120 byte-for-byte. Decision rationale: the test harness asserts 'INTEGER NOT NULL' substring presence, AND Phase 109 plan-phase will copy-paste the column types into its migration code. A single block satisfies both needs."
  - "Document the closed created_by enum at two granularities: prose enum block (5 values with semantic documentation) AND verbatim CHECK constraint snippet. Phase 109 migration code can paste the CHECK; Phase 109 plan-phase can read the prose."
  - "Anti-Patterns Avoided footer explicitly forbids Phase 108 from including a CREATE TABLE nodes statement that Phase 109 could blindly db.exec(). Spec prevents the most likely future misinterpretation."
  - "Keep tests/test-part-9-invariant.cjs as a Wave-0 stub even though PROVENANCE.md fully specifies the invariant SQL. Per RESEARCH Pitfall 6: the runtime test cannot meaningfully execute until Phase 109 ships the review_status + confirmed_by columns."

patterns-established:
  - "Parallel-safe Wave-1 plan execution: 108-01 (RECONCILIATION.md) and 108-02 (PROVENANCE.md) ran simultaneously, file-disjoint, both using --no-verify commits"
  - "Contract framing assertion in test harness: a regex check for /CONTRACT specification|contract, not a migration|contract, not a script|spec.*not a migration/i prevents future drift toward 'migration script' language"

requirements-completed: [RECONCILE-108-03]

# Metrics
duration: 17min
completed: 2026-05-03
---

# Phase 108 Plan 02: Provenance Field Contract Summary

**PROVENANCE.md contract spec ships 6 required + 3 optional provenance fields, closed created_by enum, Part 9 invariant SQL verbatim, mandatory idx_nodes_review_status, and Phase 109 two-step migration plan, with tests/test-provenance-contract-schema.cjs filled to 10-assertion harness; Phase 108 itself ships zero migration code.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-05-03T10:55:00Z
- **Completed:** 2026-05-03T11:12:30Z
- **Tasks:** 2 of 2 (both committed atomically)
- **Files modified:** 2 (1 created, 1 filled from Wave-0 stub)

## Accomplishments

- PROVENANCE.md created at .planning/phases/108-graph-memory-schema-reconciliation/PROVENANCE.md with 153 lines of contract spec covering: 6 required fields, 3 optional fields, closed created_by enum (5 values), Verbatim Column-Type Specification block, CHECK constraint specification, Canon Part 9 invariant SQL query verbatim, 6-row index strategy table, Phase 109 two-step migration plan (Step 1: NULL columns + json_extract backfill; Step 2: re-create-table-with-NOT-NULL), cross-references to TRUTH-STATES.md (108-03) and aliases.yml (108-04), and Anti-Patterns Avoided footer.
- tests/test-provenance-contract-schema.cjs filled from 5-line Wave-0 stub to 133-line 10-assertion test harness verifying every contract obligation. All 10 assertions PASS (exit 0). Tests catch: missing fields, missing enum values, missing Part 9 SQL fragments, missing index, missing CHECK, missing json_extract, missing column types, missing contract framing language, em-dash / en-dash presence.
- Codex tightening (2026-05-03) directive applied: every "MUST" / "required" wording about provenance fields is scoped to Phase 109 implementation. Future planners reading PROVENANCE.md cannot misinterpret it as authorizing Phase 108 to modify room.db schema. The Anti-Patterns Avoided footer explicitly enforces this rule.

## Task Commits

Each task was committed atomically (with --no-verify per parallel wave protocol):

1. **Task 1: Author PROVENANCE.md** - `c142788` (feat)
2. **Task 2: Fill test harness + add Verbatim Column-Type Specification block** - `0a6f0d3` (test)

_Task 2 absorbed an in-task amendment to PROVENANCE.md (the Verbatim Column-Type Specification block). The amendment was driven by Task 2's test harness asserting on substring "INTEGER NOT NULL" — adding the verbatim block both made the test pass AND mirrored CONTEXT D-02 byte-for-byte for Phase 109 to copy. Single commit on Task 2 captures both the test fill and the spec amendment as one logical unit._

## Files Created/Modified

- `.planning/phases/108-graph-memory-schema-reconciliation/PROVENANCE.md` (created) - 153 lines. Provenance field contract for Phase 109 to implement.
- `tests/test-provenance-contract-schema.cjs` (filled from stub) - 133 lines. 10-assertion harness verifying PROVENANCE.md content + framing.

## Decisions Made

- **Verbatim Column-Type Specification block placement.** Decided to add the block immediately after the Required Fields markdown table rather than replace the table. The table is human-readable for plan-phase reviewers; the verbatim block is machine-pasteable for Phase 109 implementation code. Both audiences served by both representations.
- **Test framing assertion regex breadth.** Decided to make the contract-framing assertion regex tolerant of four phrasings (CONTRACT specification | contract, not a migration | contract, not a script | spec.*not a migration). Rationale: future amendments to PROVENANCE.md should not have to match a single phrase verbatim; the underlying intent (this is a spec, not a script) is what matters.
- **Wave-0 stub for tests/test-part-9-invariant.cjs left in place.** Decided NOT to fill the runtime Part 9 invariant test even though PROVENANCE.md fully specifies the SQL. Rationale per RESEARCH Pitfall 6: the test cannot meaningfully execute until Phase 109 ships the review_status + confirmed_by columns. Filling it as a runtime test now would either error out (no columns) or pass spuriously (no rows = no violations because no nodes exist with the expected schema). The stub flips RED to GREEN at Phase 109; this is the correct lifecycle.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Initial Required Fields markdown table did not contain literal substring "INTEGER NOT NULL"**
- **Found during:** Task 2 (running `node tests/test-provenance-contract-schema.cjs`)
- **Issue:** The test harness asserts `provenance.includes('INTEGER NOT NULL')` to verify the spec specifies timestamp column types verbatim. The initial Task 1 PROVENANCE.md split "INTEGER" and "NOT NULL" across separate columns of the markdown table (`| created_at | INTEGER | NOT NULL | ...`). The substring assertion failed because no contiguous "INTEGER NOT NULL" string existed in the document. Pure correctness bug: the spec WAS internally consistent (column types were named correctly) but did not match the contract format that Phase 109 would copy verbatim.
- **Fix:** Added a Verbatim Column-Type Specification block after the Required Fields markdown table, mirroring CONTEXT D-02 lines 107-120 byte-for-byte (modulo en-dash to hyphen conversion per project hard rule). The block contains all 6 required fields with their full SQL declarations on single lines, satisfying the substring assertion AND giving Phase 109 a copy-pasteable specification reference. Documented the rationale inline ("This block matches CONTEXT.md D-02 lines 107-120 verbatim") so future readers understand why both the table and the block exist.
- **Files modified:** .planning/phases/108-graph-memory-schema-reconciliation/PROVENANCE.md (15 insertions)
- **Verification:** All 10 test assertions PASS (exit 0). Em-dash/en-dash audit clean. Contract framing assertion still passes.
- **Committed in:** 0a6f0d3 (Task 2 commit, alongside the test harness fill)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** The deviation strengthened the spec rather than diluting it. The added verbatim block is doubly useful (test compliance AND Phase 109 copy-paste reference), and is itself a contract specification (not a migration). No scope creep; PROVENANCE.md still ships as a CONTRACT only, and Phase 108 still modifies zero room.db schema.

## Issues Encountered

- Initial commit attempt for Task 1 hit `.gitignore: .planning/` rule because newly-created files in `.planning/` are ignored by default (existing tracked files like STATE.md were added pre-gitignore). Resolved by using `git add -f` to force-add PROVENANCE.md, matching the pattern used for 108-00-SUMMARY.md and other Phase 108 docs.
- Background Feynman test runner output was buffered through `tail -10`, hiding the full pass/fail summary. Resolved by re-running directly and extracting the summary line: `Feynman test runner: 172/176 passed, 0 skipped, 4 failed`. The 4 failures are pre-existing (NOT introduced by this plan); both Plan 108-02 tests pass: `tests/test-provenance-contract-schema.cjs PASS` (alongside `tests/test-reconciliation-table-completeness.cjs PASS` from parallel Plan 108-01). Per scope-boundary rule, the 4 pre-existing failures remain out-of-scope for this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Wave 2 (Plans 108-03 + 108-04) can now begin in parallel:**

- **Plan 108-03 (TRUTH-STATES.md):** Reads PROVENANCE.md `review_status` field reference + the 8-state enum names (`proposed | confirmed | rejected | stale | superseded | needs_evidence | validated | invalidated`). 108-03 ships the full taxonomy with state transitions, triggers, evidence requirements, and the status_aliases mapping for the existing `assumptions.validity` enum. PROVENANCE.md only names the field; 108-03 defines the semantics.
- **Plan 108-04 (aliases.yml):** Reads PROVENANCE.md created_by enum (5 values) + review_status enum reference + field names. 108-04 ships the machine-readable companion file (status_aliases section + node_aliases + edge_aliases per CONTEXT D-04). Plans 108-03 and 108-04 are file-disjoint and parallel-safe.

**Wave 3 dependencies (Plans 108-05 + 108-06):**

- 108-05 (pre-commit hook check-schema-aliases.cjs): reads PROVENANCE.md as a source-of-truth file when validating that new SQL DDL in room.db migrations stays inside the contract.
- 108-06 (Canon Part 9 amendment cross-references): reads PROVENANCE.md Part 9 invariant SQL block to anchor the cross-reference completeness test.

**No blockers identified.** Phase 108 wave-execution remains on track. Phase 109 (SQL Spine) cannot begin until Phase 108 completes, but the contract is now stable enough that Phase 109 plan-phase can begin scaffolding against PROVENANCE.md as the authoritative spec.

## Self-Check: PASSED

Verification of all claims in this SUMMARY before final commit:

- `.planning/phases/108-graph-memory-schema-reconciliation/PROVENANCE.md` exists: FOUND (153 lines, contains all 9 fields, Part 9 SQL, idx_nodes_review_status, CHECK constraint, json_extract reference, contract framing language, zero em/en-dashes)
- `tests/test-provenance-contract-schema.cjs` exists and is 133 lines: FOUND (no longer Wave-0 stub; runs `node tests/test-provenance-contract-schema.cjs` exit 0 with 10 PASS / 0 FAIL)
- Commit `c142788` exists in `git log`: FOUND (`feat(108-02): author PROVENANCE.md provenance field contract spec`)
- Commit `0a6f0d3` exists in `git log`: FOUND (`test(108-02): fill provenance contract schema test + verbatim SQL block`)
- All success criteria from plan: PASS — PROVENANCE.md exists; test passes; no em/en dashes; no `CREATE TABLE nodes` statement; every "MUST"/"required" scoped to Phase 109; framing language present.

---
*Phase: 108-graph-memory-schema-reconciliation, Plan 02*
*Completed: 2026-05-03*
