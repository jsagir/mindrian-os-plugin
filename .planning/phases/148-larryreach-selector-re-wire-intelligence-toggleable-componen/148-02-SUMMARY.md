---
phase: 148-larryreach-selector-re-wire-intelligence-toggleable-components
plan: 02
subsystem: docs
tags: [canon, dog-fooding, reach-count, constitutional-amendment, six-hats]

# Dependency graph
requires:
  - phase: 148-01
    provides: "hats minted as a REAL 6th machine reach_id in code (REACH_IDS length 6, DIAL_REACH_K 6, both SKILL fences + connector registry at 6)"
provides:
  - "MINDRIAN-CANON.md Appendix D entry 15 records the 5->6 reach-count amendment (D-09), version bumped 1.5 -> 1.6"
  - "CANON-PHASE-MAP.md Phase 148 row with canon_parts Part 2/3/4/7/8/9/10 + a v1.6 version-history row"
affects: [148-03, 148-04, 148-05, future canon drift-detection]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Canon-amendment-on-itself: a phase that changes a frozen constitutional count records the change via the canon's own Appendix D provenance mechanism + version bump (Part 6 dog-fooding), mirroring the entry-14 format"

key-files:
  created: []
  modified:
    - docs/MINDRIAN-CANON.md
    - docs/CANON-PHASE-MAP.md

key-decisions:
  - "Used the canon's own Appendix D provenance format (entry 15 mirrors entry 14) rather than inventing a new section style"
  - "Version history lives only in CANON-PHASE-MAP.md; MINDRIAN-CANON.md carries a one-line pointer per the plan's instruction"
  - "Did NOT touch Part 8 (boundary), Part 9 (memory locality), or any frozen doctrine other than recording the reach count"

requirements-completed: [IRW-02]

# Metrics
duration: 7min
completed: 2026-06-09
---

# Phase 148 Plan 02: Canon Amendment for the 5 to 6 Reach-Count (D-09 Dog-Fooding) Summary

**Recorded the D-09 constitutional change in the canon documents themselves: MINDRIAN-CANON.md Appendix D gains entry 15 (the frozen reach bank moved 5 to 6, hats minted as the 6th machine reach, cited to Part 3 tier-awareness + Part 6 dog-fooding) with the version bumped 1.5 to 1.6, and CANON-PHASE-MAP.md gains a Phase 148 row carrying seven canon_parts plus a v1.6 version-history row.**

## Performance

- **Duration:** ~7 min
- **Completed:** 2026-06-09
- **Tasks:** 2 (both plan tasks, no deviations)
- **Files modified:** 2 (docs-only; zero code)

## Accomplishments
- MINDRIAN-CANON.md header `Version: 1.5` -> `Version: 1.6`, date 2026-06-09.
- Appendix D entry 15 records the amendment per D-09: `hats` minted as a REAL 6th machine reach_id (resolving researcher open-question A1 toward a true machine token, NOT a sub_mode render label), moving the frozen reach bank 5 -> 6. The entry enumerates the lockstep surfaces that moved together (sensor-types.REACH_IDS, DIAL_REACH_K 5->6, dial-label-composer render-only hats family, think-hats connector repoint, both SKILL fences no-6th->no-7th, the carried drift suite, the connector --check) and notes MAX_K=3 and the 0.70/0.15 recommend gate stayed UNCHANGED. Framed as a navigator-confirmed LOCKED decision (D-09, 2026-06-08) applied via the Part 6 dog-fooding canon-amendment-on-itself mechanism, mirroring entry 14.
- Canon footer updated to v1.6 with a pointer to the inline version history in CANON-PHASE-MAP.md.
- CANON-PHASE-MAP.md canon reference bumped to (v1.6).
- Phase 148 row added to the "v1.13.1 Larry Reaches connector spine + engine flip" section with canon_parts Part 2 (reaches arm the team), Part 3 (Shape F selector + reach-count change), Part 4 (typed edge per reach), Part 7 (repoint shipped reaches), Part 8 (zero Brain egress), Part 9 (Brain external cortex / writes through navigation.cjs), Part 10 (conversation as product). The row names the reach-count amendment (DIAL_REACH_K 5->6; hats as the 6th machine reach_id) and the new reach-component-map.json.
- A v1.6 version-history row records the 5->6 amendment, MAX_K + gate unchanged, the toggleable-component routing, the unified F.1 host, and the real engine invocation on commit.

## Task Commits

1. **Task 1: Add the 5->6 reach-count amendment to MINDRIAN-CANON.md (provenance + version)** - `a7e2798d` (docs)
2. **Task 2: Add the Phase 148 row to CANON-PHASE-MAP.md with canon_parts** - `af18851b` (docs)

## Files Created/Modified
- `docs/MINDRIAN-CANON.md` - header version 1.5 -> 1.6; Appendix D entry 15 (the 5->6 reach amendment, D-09, citing Part 3 + Part 6); footer to v1.6 + version-history pointer.
- `docs/CANON-PHASE-MAP.md` - canon reference (v1.6); Phase 148 row in the Larry Reaches section with seven canon_parts; v1.6 version-history row.

## Decisions Made
- Matched the canon's existing Appendix D provenance format (entry 15 mirrors entry 14's "LOCKED human decision + canon-amendment-on-itself + version bumped" structure) rather than inventing a new amendment section.
- Kept the version history in CANON-PHASE-MAP.md only (where it has lived since v1.0) and left a one-line pointer in MINDRIAN-CANON.md, per the plan's "if the version history lives only in CANON-PHASE-MAP.md, leave a one-line pointer" instruction.
- Touched only the reach count; Part 8, Part 9, and all other frozen doctrine left byte-unchanged except the header/footer version strings.

## Deviations from Plan
None - plan executed exactly as written. Both verify gates passed on first run.

## Issues Encountered
- **Per-commit pre-commit hook:** ran normally (no `--no-verify`). The documented `check-sendpacket` false-positive on `lib/core/mindrian-brain-shim.test.cjs` did NOT trip - this plan is docs-only and never touched that file. Both commits passed all hooks clean.

## Known Stubs
None - docs-only plan; no code, no data sources, no placeholders.

## Threat Flags
None - no new network endpoints, auth paths, file-access patterns, or schema changes. Pure documentation edits recording an already-LOCKED decision. T-148-02-01 (repudiation) is mitigated as planned: the Appendix D entry attributes the change to the LOCKED D-09 decision with date, and the version-history row timestamps it. T-148-02-SC (install tampering) is mitigated: zero installs, no package surface.

## Self-Check: PASSED

- FOUND: docs/MINDRIAN-CANON.md (Version: 1.6, Appendix D entry 15, "hats", "6th machine reach")
- FOUND: docs/CANON-PHASE-MAP.md (Phase 148 row, DIAL_REACH_K, v1.6 version-history row)
- FOUND commit: a7e2798d (Task 1)
- FOUND commit: af18851b (Task 2)
- No em-dashes in either doc (grep -P "\xE2\x80\x94" returns empty)

---
*Phase: 148-larryreach-selector-re-wire-intelligence-toggleable-components*
*Completed: 2026-06-09*
