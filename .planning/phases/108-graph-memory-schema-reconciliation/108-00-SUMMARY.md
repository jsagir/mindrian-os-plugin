---
phase: 108-graph-memory-schema-reconciliation
plan: "00"
subsystem: planning-substrate
tags: [requirements, roadmap, test-stubs, wave-0, graph-memory, reconciliation, schema, canon-part-9, feynman-test-runner]

# Dependency graph
requires:
  - phase: 100-jtbd-router
    provides: Wave-0 test stub pattern (5-line template, exit-0 child-process spawn convention)
  - phase: 104-per-command-jtbd-declarations
    provides: REQUIREMENTS.md insert-before-Traceability anchor pattern + ROADMAP plan-list pattern
  - phase: 105-statusline
    provides: TEST_FILES path.join registry block convention with phase-scoped comment header
  - phase: 106-statusline-self-healing
    provides: Per-phase Wave-0 stub registration block (10 stubs precedent immediately above the Phase 108 block)
provides:
  - 6 RECONCILE-108-NN requirement IDs registered in REQUIREMENTS.md (RECONCILE-108-01..06)
  - 6 traceability rows appended for Phase 108
  - ROADMAP.md Phase 108 entry **Plans:** placeholder replaced with structured 7-plan checklist (108-00..108-06)
  - 7 Wave-0 test stub files on disk in tests/, each exiting 0 with the canonical Wave-0 message
  - run-feynman-tests.cjs registry extended with 7 path.join entries under a Phase 108-00 comment header
  - tests/test-part-9-invariant.cjs documented as a CROSS-PHASE dependency stub (lights up only after Phase 109 ships nodes.review_status column)
affects:
  - 108-01-PLAN.md (consumes RECONCILE-108-01 + RECONCILE-108-02; flips test-reconciliation-table-completeness.cjs RED -> GREEN)
  - 108-02-PLAN.md (consumes RECONCILE-108-03; flips test-provenance-contract-schema.cjs)
  - 108-03-PLAN.md (consumes RECONCILE-108-04; flips test-truth-state-taxonomy.cjs)
  - 108-04-PLAN.md (consumes RECONCILE-108-05; flips test-aliases-yaml-schema.cjs)
  - 108-05-PLAN.md (consumes RECONCILE-108-05 hook half; flips test-precommit-hook-aliases.cjs)
  - 108-06-PLAN.md (consumes RECONCILE-108-06; flips test-canon-crossref-completeness.cjs)
  - Phase 109 (cannot start until Phase 108 ships frozen taxonomy; this plan is the gate that admits Phase 108 work to Wave 1)

# Tech tracking
tech-stack:
  added: []  # zero new runtime dependencies (Phase 87 invariant honored)
  patterns:
    - "Wave-0 test stub: 5-line CJS template (use strict, comment with plan-NN ref, console.log canonical line, process.exit(0))"
    - "Cross-phase dependency stub variant: extra header comment lines documenting the deferred-implementation phase + RESEARCH.md pitfall reference"
    - "Registry insertion at end of TEST_FILES array under a phase-scoped Wave-0 comment header (matches Phase 100 / 104 / 105 / 106 precedent)"
    - "Plan boundary: Wave 0 ships REQ-IDs + ROADMAP plan-list + test stub substrate ONLY; document deliverables (RECONCILIATION.md, PROVENANCE.md, TRUTH-STATES.md, aliases.yml, PART-9-PROPOSAL.md) ship in Wave 1+"

key-files:
  created:
    - tests/test-aliases-yaml-schema.cjs (Wave-0 stub for D-04, filled by 108-04)
    - tests/test-reconciliation-table-completeness.cjs (Wave-0 stub for D-01, filled by 108-01)
    - tests/test-provenance-contract-schema.cjs (Wave-0 stub for D-02, filled by 108-02)
    - tests/test-truth-state-taxonomy.cjs (Wave-0 stub for D-03, filled by 108-03)
    - tests/test-precommit-hook-aliases.cjs (Wave-0 stub for D-05, filled by 108-05)
    - tests/test-part-9-invariant.cjs (Wave-0 stub; remains a stub through ALL of Phase 108; lights up only after Phase 109 ships nodes.review_status column)
    - tests/test-canon-crossref-completeness.cjs (Wave-0 stub for D-06, filled by 108-06)
  modified:
    - .planning/REQUIREMENTS.md (added RECONCILE-108 H2 block with 6 IDs + 6 traceability rows; committed in Task 1 commit 2cb0bbf)
    - .planning/ROADMAP.md (replaced Phase 108 **Plans:** placeholder line with structured 7-plan checklist matching the Phase 106 pattern)
    - lib/memory/run-feynman-tests.cjs (registered 7 path.join entries under a "Phase 108-00: Wave 0" comment header at end of TEST_FILES array; preserves prior 100/104/105/106 blocks unchanged)

key-decisions:
  - "Wave 0 ships substrate only (REQ-IDs + ROADMAP entry + 7 test stubs + registry); zero document deliverables in this plan. RECONCILIATION.md / PROVENANCE.md / TRUTH-STATES.md / aliases.yml / PART-9-PROPOSAL.md are Wave 1/2/3 deliverables per CONTEXT Phase Boundary."
  - "test-part-9-invariant.cjs is a CROSS-PHASE dependency stub by design (per RESEARCH Pitfall 6). It documents in its header that it remains a stub through all of Phase 108 and only lights up when Phase 109 ships the nodes.review_status column. This avoids false-positive test failures during the 108-01..108-06 fill-in waves."
  - "ROADMAP.md Phase 108 Plans line was edited (not appended below) to replace the TBD placeholder. This preserves the surrounding entry structure (Goal / Requirements / Depends on / Canon parts / Plans / Authority) instead of leaving the placeholder line stranded."
  - "Registry insertion appended to end of TEST_FILES array (not interleaved with prior phases). Matches the chronological-append precedent set by Phase 100 / 104 / 105 / 106 blocks. New phases never reorder existing entries."
  - "Em-dash audit applied to ALL inserted text (zero matches in stubs, zero matches in our diff to run-feynman-tests.cjs, zero matches in REQUIREMENTS.md insert, zero matches in ROADMAP.md insert). Pre-existing em-dashes in older Phase 103/105 comments inside run-feynman-tests.cjs are out of scope per the plan's verification rule."

patterns-established:
  - "Wave-0 substrate plan structure: REQ-IDs first (Task 1) -> ROADMAP plans line + stub files (Task 2) -> registry registration (Task 3) -> document deliverables follow in subsequent waves"
  - "Cross-phase dependency stub variant: extra header comment lines naming the deferred-implementation phase and pointing at the RESEARCH.md pitfall that explains why the stub stays a stub. Pattern for Phase 109/110 to reuse if they need similar deferred-impl tests."

requirements-completed:
  - RECONCILE-108-01
  - RECONCILE-108-02
  - RECONCILE-108-03
  - RECONCILE-108-04
  - RECONCILE-108-05
  - RECONCILE-108-06
# Note: requirements are REGISTERED (filed in REQUIREMENTS.md + traceability) by this Wave-0 plan.
# Each ID transitions from "Pending" to "Complete" only when its owning Wave 1+ plan ships.
# Per CONTEXT D-01..D-06 -> 108-01..108-06 mapping. This plan delivers the substrate that admits
# the IDs into the system; downstream plans deliver against them.

# Metrics
duration: ~11 min (across two executor agents - resumed from continuation after Task 1 commit + partial Task 2)
completed: 2026-05-03
---

# Phase 108 Plan 00: Wave-0 Substrate Summary

**Phase 108 Wave-0 substrate registered: 6 RECONCILE-108 REQ-IDs in REQUIREMENTS.md + 7 test stubs on disk + registry binding + ROADMAP plans line populated. Plans 108-01..108-06 can begin immediately because their REQ-IDs exist and their test substrate is on disk and PASSING.**

## Performance

- **Duration:** ~11 min (resumed continuation; Task 1 + partial Task 2 from prior agent + Tasks 2-completion + Task 3 + SUMMARY here)
- **Started:** 2026-05-03T10:04:28Z (Task 1 commit 2cb0bbf)
- **Completed:** 2026-05-03T10:15:03Z (Task 3 commit 5f13836; SUMMARY commit follows)
- **Tasks:** 3
- **Files created:** 7 stubs + 1 SUMMARY = 8
- **Files modified:** 3 (REQUIREMENTS.md, ROADMAP.md, run-feynman-tests.cjs)

## Accomplishments

- 6 first-class requirement IDs filed (RECONCILE-108-01..06) covering all 6 CONTEXT.md document deliverables (D-01 through D-06) plus 6 matching traceability rows
- ROADMAP.md Phase 108 entry **Plans:** placeholder line replaced with the structured 7-plan checklist (108-00 through 108-06) using the exact Phase 106 pattern
- 7 Wave-0 test stub files created in tests/, each PASSING (exit 0) with the canonical Wave-0 message. test-part-9-invariant.cjs has the special cross-phase header documenting the Phase 109 dependency
- run-feynman-tests.cjs registry extended with 7 path.join entries under a "Phase 108-00: Wave 0" comment block that documents the stub-to-plan mapping inline
- Zero net-new runtime dependencies introduced (Phase 87 invariant preserved)
- Zero em-dashes in any added content (project hard rule honored)
- Plans 108-01 + 108-02 can now begin in parallel as Wave 1 (file-disjoint sets per CONTEXT)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add RECONCILE-108-01..06 requirements + traceability rows** - `2cb0bbf` (feat) - filed by previous executor agent
2. **Task 2: Populate ROADMAP plans block + create 7 Wave-0 test stubs** - `12fae30` (feat) - resumed and completed by this agent
3. **Task 3: Register 7 Phase 108 stubs in feynman test runner** - `5f13836` (feat) - this agent

**Plan metadata commit:** _follows this SUMMARY_ (will include SUMMARY.md + STATE.md + ROADMAP.md plan-progress)

## Files Created/Modified

**Created:**

- `tests/test-aliases-yaml-schema.cjs` - Wave-0 stub for D-04 alias YAML schema test; filled in 108-04
- `tests/test-reconciliation-table-completeness.cjs` - Wave-0 stub for D-01 reconciliation completeness; filled in 108-01
- `tests/test-provenance-contract-schema.cjs` - Wave-0 stub for D-02 provenance contract; filled in 108-02
- `tests/test-truth-state-taxonomy.cjs` - Wave-0 stub for D-03 truth-state taxonomy; filled in 108-03
- `tests/test-precommit-hook-aliases.cjs` - Wave-0 stub for D-05 pre-commit hook fixture; filled in 108-05
- `tests/test-part-9-invariant.cjs` - Wave-0 stub for D-02 Part 9 invariant SQL query; CROSS-PHASE stub (Phase 109 dependency on nodes.review_status column)
- `tests/test-canon-crossref-completeness.cjs` - Wave-0 stub for D-06 cross-reference completeness; filled in 108-06
- `.planning/phases/108-graph-memory-schema-reconciliation/108-00-SUMMARY.md` - this file

**Modified:**

- `.planning/REQUIREMENTS.md` - added `## Graph Memory Schema Reconciliation (RECONCILE-108)` H2 block with 6 IDs (12 RECONCILE-108-NN appearances total: 6 in spec block, 6 in Traceability table)
- `.planning/ROADMAP.md` - replaced the Phase 108 entry's TBD placeholder line with the structured 7-plan checklist (108-00 through 108-06)
- `lib/memory/run-feynman-tests.cjs` - appended 7 path.join entries to TEST_FILES under a Phase 108-00 comment block that documents stub-to-plan mapping inline

## Decisions Made

- **Substrate-only Wave 0.** Per CONTEXT Phase Boundary: this plan ships REQ-IDs + ROADMAP entry + 7 test stubs + registry registration ONLY. Document deliverables (RECONCILIATION.md, PROVENANCE.md, TRUTH-STATES.md, aliases.yml, PART-9-PROPOSAL.md) are explicitly Wave 1/2/3 work. This separation lets Wave 1+ plans run in parallel against a stable REQ-ID + test-stub substrate.
- **Cross-phase stub for test-part-9-invariant.cjs.** Per RESEARCH Pitfall 6: this stub remains a stub through ALL of Phase 108. The real SQL execution lights up only when Phase 109 ships the `nodes.review_status` column. The stub's header comment documents this dependency in-place so a future reader of the file (without the plan in hand) understands why it stays a stub.
- **Append-only registry insertion.** New 7 path.join entries appended to the END of TEST_FILES, not interleaved. Matches the chronological-append precedent set by Phase 100 / 104 / 105 / 106 blocks. New phases never reorder existing entries.
- **Em-dash hard rule extended to all inserted content.** Zero em-dashes in any text added by this plan, even though Phase 103/105 comments above us in run-feynman-tests.cjs contain pre-existing em-dashes (out of scope per plan verify rule).

## Deviations from Plan

None - plan executed exactly as written. The previous executor agent partially completed Task 1 (committed at 2cb0bbf) and started Task 2 (created tests/test-aliases-yaml-schema.cjs without committing) before stopping. This continuation agent verified the existing aliases-yaml-schema stub matched the plan's prescribed 5-line content byte-for-byte (it did), created the 6 missing stubs, committed Task 2 (ROADMAP plans line + all 7 stubs together at 12fae30 since the prior agent had also written the ROADMAP changes uncommitted), then completed Task 3 (registry) at 5f13836.

## Issues Encountered

- The full `node lib/memory/run-feynman-tests.cjs` invocation took longer than the synchronous Bash timeout (180s) because the suite spawns 130+ child processes. Verification was performed by directly spawning the 7 new stubs through the same `spawnSync(process.execPath, [stub])` pattern the runner uses; all 7 returned status 0 (PASS). Registry membership was verified via grep (15 matches across 7 path.join entries + 7 mapping comments + 1 cross-phase comment). The slow-suite wall-clock is unrelated to Phase 108 stubs - they are 5-line files that exit immediately.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Plans 108-01 + 108-02 ready to execute as Wave 1 (parallel-safe file-disjoint sets).** Both have their REQ-IDs registered (RECONCILE-108-01/02 + RECONCILE-108-03 respectively) and their test substrate on disk.
- **Plans 108-03 + 108-04 ready to execute as Wave 2** after Wave 1 lands the canonical edge taxonomy from RECONCILIATION.md (D-02) which TRUTH-STATES.md (D-03) and aliases.yml (D-04) reference.
- **Plans 108-05 + 108-06 ready to execute as Wave 3** after Wave 2 lands aliases.yml (the pre-commit hook in 108-05 reads it) and TRUTH-STATES.md (the cross-reference checklist in 108-06 references it).
- **Phase 109 unblocked** at the moment Phase 108 ships its 6 documents (target: end of Wave 3). Phase 109 is the canonical consumer of the frozen taxonomy and is the release gate where Canon Part 9 ratifies.

## Self-Check: PASSED

- All 7 stub files exist on disk
- SUMMARY.md exists at the correct path
- All 3 task commits (2cb0bbf, 12fae30, 5f13836) verified in git log
- REQUIREMENTS.md contains 12 RECONCILE-108-NN matches (6 in spec block + 6 in Traceability table)
- ROADMAP.md Phase 108 entry contains 7 plan filename references (108-00 through 108-06)
- All 7 stubs PASS individually via spawnSync (mirrors the runner's child-process pattern)
- Em-dash audit: zero matches in stubs, zero matches in our diff to run-feynman-tests.cjs, zero matches in Task 1 / Task 2 inserts to REQUIREMENTS.md / ROADMAP.md

---
*Phase: 108-graph-memory-schema-reconciliation*
*Completed: 2026-05-03*
