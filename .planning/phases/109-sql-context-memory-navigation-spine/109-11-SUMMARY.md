---
phase: 109-sql-context-memory-navigation-spine
plan: "11"
subsystem: docs
tags: [canon, governance, mindrian-canon, part-9, memory-locality, ratification, structural-test]

# Dependency graph
requires:
  - phase: 109-00
    provides: tests/test-canon-part-9-ratification.cjs Wave-0 stub registered
  - phase: 109-09
    provides: navigation.cjs 13-function chokepoint + memory_event first-class node type (the substance Part 9 ratifies)
  - phase: 109-10
    provides: tests/test-navigation-acceptance.cjs filled and green (the test half of NAV-109-09)
provides:
  - "docs/MINDRIAN-CANON.md v1.4 with Part 9 (Memory Locality and Interpretation) merged between Part 8 and Appendix A"
  - "Appendix D Canonization Provenance entry 12 (Codex external-research input on memory locality, 2026-05-03)"
  - "Part 8 + Appendix A forward-references to Part 9"
  - "docs/CANON-PHASE-MAP.md Part 9 section de-qualified; Phase 108 + 109 rows flipped proposed/planned -> shipped (Phase 110 stays planned); Canon reference bumped to v1.4; Version history v1.4 row"
  - "tests/test-canon-part-9-ratification.cjs filled with 9 real structural assertions (was an 8-line process.exit(1) stub)"
affects: [phase-109-12, phase-110-brain-context-packet-contract, canon-part-10-ratification, drift-detection-engine]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Canon ratification at phase release gate: merge the proposed text (de-quoted + de-em-dashed) from the .planning/research proposal file, bump version header + footer, add Appendix D provenance entry, add forward-references, flip the CANON-PHASE-MAP rows from proposed/planned to shipped, add a Version history row"
    - "Structural canon test: pure file-structure assertions (fs.readFileSync the two docs files; byte-offset ordering + literal-substring + section-block scans); direct-CJS runner pattern (node:assert/strict, no Mocha/Jest, zero new deps), mirrors tests/test-cross-room-memory.cjs"

key-files:
  created:
    - .planning/phases/109-sql-context-memory-navigation-spine/109-11-SUMMARY.md
  modified:
    - docs/MINDRIAN-CANON.md
    - docs/CANON-PHASE-MAP.md
    - tests/test-canon-part-9-ratification.cjs

key-decisions:
  - "The .planning/research/2026-05-03-canon-part-9-memory-locality-proposal.md text is the authoritative Part 9 prose per REQUIREMENTS.md NAV-109-09; .planning/phases/108-.../PART-9-PROPOSAL.md is a cross-reference checklist that explicitly does NOT duplicate the canon text -- the two did NOT diverge on substance, so no reconciliation conflict arose"
  - "The MINDRIAN-CANON.md version header read `Version: 1.0` (stale -- the CANON-PHASE-MAP version-history table tracked v1.3 as live across map-only updates); bumped the header straight to `Version: 1.4` so the canon file and the map now agree on v1.4"
  - "Part 8 forward-reference placed AFTER the Part 8 fenced code block (as a normal paragraph before the `---` that precedes Part 9), keeping the Part 8 fenced block byte-intact"
  - "Em-dashes in the source proposal text and the RESEARCH section 9.3 Appendix-D-entry-12 text were converted to hyphens to satisfy the project NO-em-dashes hard rule; the Part 9 block and the new CANON-PHASE-MAP rows/prose/Version-history row are all em-dash/en-dash-free"

patterns-established:
  - "Canon-amendment ratification commit: feat(PP-NN): ratify Canon Part N -- ... touching only docs/MINDRIAN-CANON.md + docs/CANON-PHASE-MAP.md (release-commit version bumps to CHANGELOG/plugin.json/package.json are a separate release step)"

requirements-completed: [NAV-109-09]

# Metrics
duration: 18min
completed: 2026-05-12
---

# Phase 109 Plan 11: Canon Part 9 Ratification Summary

**Ratified Canon Part 9 (Memory Locality and Interpretation) at the Phase 109 release gate: merged the five-role separation invariant + truth-state taxonomy from the 2026-05-03 proposal into docs/MINDRIAN-CANON.md (v1.0 -> v1.4) between Part 8 and Appendix A, added Appendix D entry 12 (Codex attribution), flipped CANON-PHASE-MAP Part 9 rows to shipped for Phases 108 + 109, and filled the ratification structural test with 9 real assertions.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-05-12T~10:00Z
- **Completed:** 2026-05-12
- **Tasks:** 2
- **Files modified:** 3 (docs/MINDRIAN-CANON.md, docs/CANON-PHASE-MAP.md, tests/test-canon-part-9-ratification.cjs)

## Accomplishments

- Canon Part 9 (Memory Locality and Interpretation) is now live canon, not a quoted proposal. It sits as `## Part 9 - Memory Locality and Interpretation` immediately before `## Appendix A - Relationship to MWP` and immediately after Part 8's `### Violations are bugs` fenced block.
- The five-role separation invariant is verbatim in substance: "Files preserve meaning. SQL remembers and navigates. Brain reasons over structured packets. Larry explains and acts. The human confirms truth." -- as the five emphasized blockquote lines, plus "The five roles" numbered list (5 items), "Truth states (canonical)" naming the closed `proposed | confirmed | rejected | stale | superseded | needs_evidence | validated | invalidated` set, and "What this means architecturally" bullets.
- Added an "### Implementing phase" subsection naming Phase 109 (navigation.cjs 13-function chokepoint, memory_event first-class node, tests/test-navigation-acceptance.cjs zero-non-SQLite-reads assertion), Phase 108 (frozen schema/taxonomy contract), and Phase 110 (typed-packet wire hardening).
- Canon version header bumped `Version: 1.0` -> `Version: 1.4`; footer `_Mindrian Canon v1.3 - MindrianOS Plugin_` -> `_Mindrian Canon v1.4 - MindrianOS Plugin_`.
- Appendix D Canonization Provenance gained entry 12 (Codex external-research input -- Part 9 proposed Phase 108, ratified Phase 109; the 108+109+110 implementing cluster), em-dashes converted to hyphens.
- Part 8 gained a one-line forward-reference to Part 9 ("Part 9 ... is the enforcement architecture for this boundary ..."); Appendix A gained "See Part 9 ... for the constitution that binds the folder substrate (Part 1, ICM Layer 0) to the navigable graph (Part 4)."
- docs/CANON-PHASE-MAP.md: `### Part 9 (proposed) - Memory Locality and Interpretation` -> `### Part 9 - Memory Locality and Interpretation`; Phase 108 row -> `shipped` (proposal + frozen taxonomy); Phase 109 row -> `shipped` (implementation + canon ratification at release gate); Phase 110 row UNCHANGED (`planned`); the section prose rewritten to past/perfect tense ("Phase 108 shipped ... Phase 109 ratified ..."); `Canon reference: docs/MINDRIAN-CANON.md (v1.3)` -> `(v1.4)`; a `v1.4` Version history row added with TBD commit hash + 2026-05-12 date.
- tests/test-canon-part-9-ratification.cjs replaced the 8-line `process.exit(1)` Wave-0 stub with 9 real structural assertions; `node tests/test-canon-part-9-ratification.cjs` exits 0 (9/9 passed); the Wave-0 `MISSING - Wave 4 ...` stderr line is gone; file is 103 lines of real assertion code; zero em-dashes/en-dashes.

## Exact Part 9 Insertion Point (line numbers, post-plan)

In `docs/MINDRIAN-CANON.md`:
- `## Part 8 - The Graph Boundary (Security Constitution)` at line 245; `### Violations are bugs` at line 288 (Part 8's fenced block closes shortly after); the Part 8 -> Part 9 forward-reference paragraph and the `---` separator follow.
- `## Part 9 - Memory Locality and Interpretation` at line 297; `### Implementing phase` subsection at line 330; the `---` separator after Part 9 follows.
- `## Appendix A - Relationship to MWP` at line 336 (followed by the existing Appendix A paragraph + the new "See Part 9 ..." forward-reference sentence).

Section order is now: ... Part 8, Part 9, Appendix A, Appendix B, ... -- as required.

## Source Reconciliation

The authoritative Part 9 prose is `.planning/research/2026-05-03-canon-part-9-memory-locality-proposal.md` lines 20-52 (the block under `## The proposed canon text`), per REQUIREMENTS.md NAV-109-09. `.planning/phases/108-graph-memory-schema-reconciliation/PART-9-PROPOSAL.md` is a cross-reference checklist that explicitly states "this file does NOT duplicate the canon text" -- it contains no competing prose. **The two did NOT diverge on substance**; no reconciliation conflict arose. The proposal text was de-quoted (leading `> ` blockquote markers stripped, since it becomes live canon), de-em-dashed (every U+2014 -> hyphen), and an "### Implementing phase" forward-reference to Phase 109 was appended per RESEARCH section 9.1.

## Canon Version Transition

The MINDRIAN-CANON.md header literally read `Version: 1.0` before this plan (stale -- prior canon edits v1.1/v1.2/v1.3 updated the CANON-PHASE-MAP Version-history table but not the canon file header during the map-only "kept" updates). Bumped straight to `Version: 1.4`. The footer read `_Mindrian Canon v1.3 - MindrianOS Plugin_` -> `_Mindrian Canon v1.4 - MindrianOS Plugin_`. The canon file and the map now agree on v1.4.

## Appendix D Entry 12 (as merged, em-dashes -> hyphens)

> 12. **Codex external research input - Part 9 proposed (Phase 108) and ratified (Phase 109).** External research input from Codex (via Jonathan Sagir, 2026-05-03 sessions) framed `room.db` as Mindrian's "local mind" - the navigator's working memory made queryable as graph paths, never as folder scans. Phase 108 ships the schema reconciliation contract (RECONCILIATION.md, PROVENANCE.md, TRUTH-STATES.md, aliases.yml, PART-9-PROPOSAL.md, scripts/check-schema-aliases.cjs); Phase 109 ships the SQL navigation spine (lib/core/navigation.cjs single chokepoint with 13 functions; first-class memory_event nodes; instrumented acceptance test asserting zero non-SQLite reads during the navigation flow); Phase 109 release commit ratifies Part 9 by merging the proposal text into this canon. Brain wire schema enforcement (Phase 110) hardens Part 8 from procedural audit to structural prevention. The trio (108 + 109 + 110) is the Part 9 implementing cluster.

## CANON-PHASE-MAP Row Flips

| Row | Before | After |
| --- | --- | --- |
| Section heading | `### Part 9 (proposed) - Memory Locality and Interpretation` | `### Part 9 - Memory Locality and Interpretation` |
| Phase 108 | `proposed` -- "(proposal)" | `shipped` -- "(proposal + frozen taxonomy)" |
| Phase 109 | `planned` -- "(implementation + ratification at release gate)" | `shipped` -- "(implementation + canon ratification at release gate)" |
| Phase 110 | `planned` | `planned` (UNCHANGED) |
| `Canon reference:` header | `(v1.3)` | `(v1.4)` |
| `## Version history` table | (no v1.4 row) | `v1.4` row added (commit hash TBD, date 2026-05-12) |
| Section prose | future tense ("Phase 109 ratifies Part 9 at its release gate") | past/perfect ("Phase 108 shipped ... Phase 109 ratified ...") |

No Phase 109 row exists in the "v1.13.0 The Closed Loop milestone phases" table (only Phases 88.2, 89-07, 114, 115, 110, 116-121, 121.5, 122 are listed there) -- nothing to flip there. The recently-added Phase 122 rows and the Phase 122 entries elsewhere in the map were read fresh and left untouched.

## The 9 Test Assertions (all PASS)

1. `t1_part9HeaderPresent` -- canon contains `## Part 9 - Memory Locality and Interpretation`
2. `t2_fiveRoleInvariant` -- canon contains all five phrases: "Files preserve meaning", "SQL remembers and navigates", "Brain reasons over structured packets", "Larry explains and acts", "The human confirms truth"
3. `t3_part9BetweenPart8AndAppendixA` -- byte offset of `## Part 8` < `## Part 9` < `## Appendix A`
4. `t4_canonVersionBumped` -- canon contains `Version: 1.4` and `_Mindrian Canon v1.4`, and NOT `Version: 1.3`
5. `t5_appendixDEntry12` -- Appendix D section block has a numbered entry `12.` mentioning "Codex" and "Part 9"
6. `t6_mapPart9HeadingDeQualified` -- map has `### Part 9 - Memory Locality and Interpretation`, NOT `### Part 9 (proposed)`
7. `t7_mapPart9RowsShipped` -- within the Part 9 section block, the Phase 108 + Phase 109 rows say `shipped` and not `proposed`
8. `t8_mapCanonReferenceV14` -- map `Canon reference: docs/MINDRIAN-CANON.md (v1.4)`
9. `t9_mapVersionHistoryHasV14` -- map `## Version history` table has a `v1.4` row

`node tests/test-canon-part-9-ratification.cjs` -> `test-canon-part-9-ratification: 9/9 passed`, exit 0.

## Task Commits

Each task was committed atomically (all with `--no-verify` per the parallel-execution directive -- a concurrent session is committing install/npm/release work to `main`; the orchestrator validates hooks after):

1. **Task 1: Merge Canon Part 9 into docs/MINDRIAN-CANON.md and flip docs/CANON-PHASE-MAP.md rows to shipped** -- `12ee3a1` (feat)
2. **Task 2: Replace tests/test-canon-part-9-ratification.cjs Wave 0 stub with real structural assertions** -- `1a7b166` (test)

**Plan metadata:** (final commit -- docs: complete plan; includes this SUMMARY + STATE.md + ROADMAP.md)

## Files Created/Modified

- `docs/MINDRIAN-CANON.md` -- v1.4: Part 9 merged between Part 8 and Appendix A; Appendix D entry 12; version header + footer bumped; Part 8 + Appendix A forward-references to Part 9
- `docs/CANON-PHASE-MAP.md` -- Part 9 section de-qualified; Phase 108 + 109 rows flipped to shipped; Phase 110 unchanged; Canon reference bumped to v1.4; Version history v1.4 row added; section prose to past tense
- `tests/test-canon-part-9-ratification.cjs` -- 8-line Wave-0 `process.exit(1)` stub replaced with 9 real structural assertions (direct-CJS pattern)

## Decisions Made

See `key-decisions` frontmatter. Summary: research-file proposal text is authoritative (no divergence with the 108 checklist); canon header was stale at `Version: 1.0` and bumped straight to `Version: 1.4`; Part 8 forward-reference placed after the fenced block to keep it byte-intact; all em-dashes converted to hyphens.

## Deviations from Plan

None - plan executed exactly as written. The "stale `Version: 1.0` header" case was explicitly anticipated by the plan ("if the header reads `Version: 1.0` change it to `1.4`") so it is not a deviation.

## Issues Encountered

None. The 15 sibling Phase-109 test suites all still pass (no regression): test-navigation-acceptance, test-navigation-migration-{idempotent,backfill,coexistence,views}, test-navigation-{focus,memory-events,neighborhood,insights,chokepoint-hook,packet-builder,packet-part8-leak,perf-10k}, test-brain-ingestion-part-9-invariant, test-room-home-vs-brain-derivation-regression.

## Scope Confirmation

- Exactly 3 files were modified by this plan: docs/MINDRIAN-CANON.md, docs/CANON-PHASE-MAP.md, tests/test-canon-part-9-ratification.cjs. `git diff --stat HEAD~2..HEAD` confirms only these three. Per CONTEXT D-09 line 274 ("NO other Phase 109 plan touches the canon files"), this plan owns these three exclusively.
- `lib/memory/run-feynman-tests.cjs` was **NOT** modified by this plan. `tests/test-canon-part-9-ratification.cjs` was already registered there as a Plan 109-00 Wave-0 stub; this plan only filled the assertions, it did not re-register. (Per Plan 109-10's note: Plan 109-12 must reconcile the Feynman test registry to include `tests/test-navigation-acceptance.cjs` and the other Phase-109 suites that 109-00 did not register -- that bookkeeping is out of scope here.)
- The release-commit version bumps (CHANGELOG.md / .claude-plugin/plugin.json / package.json) per the CLAUDE.md release process are a SEPARATE release step, not part of this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- NAV-109-09 is now fully covered: Plan 109-10 shipped the test-flow half (tests/test-navigation-acceptance.cjs filled + green, zero-non-SQLite-reads release-gate assertion) and this plan (109-11) shipped the canon half (Part 9 merged, CANON-PHASE-MAP rows shipped, ratification test filled).
- Plan 109-12 (recreate the 4 missing SUMMARYs for 109-00/01/07/09 + flip NAV-109-06/07/08 to Complete in REQUIREMENTS.md + reconcile the Feynman test registry) can proceed -- it does not depend on any file this plan touched.
- The Phase 109 release commit (a separate release step) will fill the `v1.4` Version history row's commit hash and add the CHANGELOG / plugin.json / package.json version bumps.

## Self-Check: PASSED

- FOUND: .planning/phases/109-sql-context-memory-navigation-spine/109-11-SUMMARY.md
- FOUND: tests/test-canon-part-9-ratification.cjs
- FOUND: commit 12ee3a1 (Task 1)
- FOUND: commit 1a7b166 (Task 2)
- FOUND: `## Part 9 - Memory Locality and Interpretation` in docs/MINDRIAN-CANON.md

---
*Phase: 109-sql-context-memory-navigation-spine*
*Completed: 2026-05-12*
