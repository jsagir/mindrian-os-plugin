---
phase: quick-260916-l2g
plan: 01
subsystem: docs
tags: [readme, doctrine-fence, prose-edit]

# Dependency graph
requires: []
provides:
  - "Duration-of-teaching claim class removed from README.md (5 sites) and docs/THE-BRAIN.md (1 site), replaced with qualitative grounding language"
affects: [README.md readers, docs/THE-BRAIN.md readers, future doctrine-fence checks on these two living docs]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - README.md
    - docs/THE-BRAIN.md

key-decisions:
  - "Per the Navigator's ruling, no duration number was chosen to standardize on; the entire duration-of-teaching claim class was removed and replaced with qualitative grounding language"
  - "The unnumbered 'decades of teaching' site (README.md, the four-part 'what a raw model structurally cannot be' sentence) was found during planning beyond the task brief's 5 enumerated sites and folded in by coordinator ruling, because the Navigator's ruling targets the claim class, not two specific numerals"

patterns-established: []

requirements-completed: [QUICK-260916-l2g]

# Metrics
duration: 6min
completed: 2026-09-16
---

# Quick Task 260916-l2g Summary

**Removed all 6 duration-of-teaching claims ("20 years", "30+ years", "decades") from README.md and docs/THE-BRAIN.md, replacing them with qualitative "accumulated academic teaching experience/expertise and pedagogical rigor" language per the Navigator's ruling**

## Performance

- **Duration:** 6 min
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Eliminated the three-way contradiction (README's "20 years" vs "decades" vs THE-BRAIN's "30+ years") about how long the PWS methodology has been taught
- Replaced the claim class rather than picking a winning number, honoring the Navigator's exact ruling: "Neither. Based on academic accumulated expertise and pedagogical rigor."
- All 6 rewritten sentences read naturally in their own distinct grammatical shapes (mid-sentence clause, standalone tagline, appositive, table cell, sentence opener, parenthetical with corrected verb agreement) while preserving the substance that the methodology comes from real academic teaching practice, not theory

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace the duration-of-teaching claim at all 6 sites** - `d4ee05355` (fix)
2. **Task 2: Run the doctrine fence, read the 6 sentences back, write the SUMMARY** - no code changes (verification only, no commit)

**Plan metadata:** handled by orchestrator separately (not committed by this executor per constraints)

## Files Created/Modified
- `README.md` - 5 duration-of-teaching claims replaced with qualitative grounding language
- `docs/THE-BRAIN.md` - 1 duration-of-teaching claim replaced with qualitative grounding language

## The 6 Before/After Pairs

**Navigator's ruling, verbatim (the reason no number was chosen):**
> "Neither. Based on academic accumulated expertise and pedagogical rigor."

**Site 1 - README.md (mid-sentence, "built from ___"):**
- Before: `it consults a methodology graph built from 20 years of teaching, and it files`
- After: `it consults a methodology graph built from accumulated academic teaching experience, and it files`

**Site 2 - README.md (header provenance tagline, "built and tested through ___"):**
- Before: `an innovation methodology built and tested through 20 years of teaching.`
- After: `an innovation methodology built and tested through accumulated academic teaching experience and pedagogical rigor.`
- This is the one site carrying the full ruling phrase, being the standalone provenance sentence with room for it.

**Site 3 - README.md (appositive inside the numbered loop list):**
- Before: `27,951 nodes and 452 frameworks built from 20 years of teaching, holding WHEN`
- After: `27,951 nodes and 452 frameworks built from accumulated academic teaching expertise, holding WHEN`

**Site 4 - README.md (three-layer table cell, comma-separated attribute list):**
- Before: `27,951 nodes, 452 frameworks, 20 years of teaching, served over MCP`
- After: `27,951 nodes, 452 frameworks, accumulated teaching expertise, served over MCP`

**Site 5 - README.md (parenthetical inside the "MindrianOS adds what a raw model structurally cannot be" sentence; found during planning, beyond the task brief's 5 enumerated sites, and folded in by coordinator ruling since the Navigator's ruling targets the claim class, not two specific numerals):**
- Before: `it knows when (decades of teaching calibrate which method fits which stage)`
- After: `it knows when (accumulated teaching experience calibrates which method fits which stage)`
- Verb agreement corrected: plural "decades...calibrate" became singular "experience...calibrates".

**Site 6 - docs/THE-BRAIN.md (sentence opener, "Built from ___."):**
- Before: `Why unreplicable: Built from 30+ years of teaching. Relationships DISCOVERED...`
- After: `Why unreplicable: Built from accumulated academic teaching expertise and pedagogical rigor. Relationships DISCOVERED...`
- The two following sentences ("Relationships DISCOVERED through watching 100+ students apply frameworks. Chaining rules come from real classroom observation, not theory.") were left untouched; they already carry the real-practice-not-theory substance.

## Decisions Made
- No duration number chosen; the claim class itself was removed, per the Navigator's explicit ruling
- Site 5 ("decades of teaching") folded into scope beyond the task brief's 5 enumerated sites, by coordinator ruling, because the ruling targets the claim class rather than specific numerals

## Deviations from Plan

None - plan executed exactly as written. All 6 find strings matched exactly once in their target file as the plan predicted; no site required rewording beyond what the plan specified, and no unplanned issues were encountered.

## Out-of-Scope Follow-Up (named per plan, not modified)

The following 5 internal/historical docs still carry a year-count duration-of-teaching figure and are now inconsistent with the two public-facing files edited here. This is a documented accepted state (threat T-l2g-03, disposition: accept), not an oversight, per the plan's scope fence:

- `references/personality/lexicon.md`
- `docs/METHODOLOGY-SEQUENCE-ANALYSIS.md`
- `docs/INTELLIGENCE-REPORT.md`
- `docs/research/*.md`
- `RESEARCH_16`

## Issues Encountered
None.

## Verification Results

- `! grep -qE '(([0-9]+\+? years)|decades) of teaching' README.md docs/THE-BRAIN.md` -> passes (zero matches in both files)
- `! grep -qP '\x{2014}' README.md docs/THE-BRAIN.md` -> passes (zero em-dashes in both files)
- `git diff --stat README.md docs/THE-BRAIN.md` -> 6 lines changed total (5 in README.md, 1 in docs/THE-BRAIN.md), confirmed by full diff inspection: no line outside the 6 target phrases was touched
- `node --test tests/test-250-doctrine-fence.cjs` -> 6 of 6 tests pass (baseline maintained, both files remain in LIVING_DOCS_FILES set)
- `grep -cE 'accumulated (academic )?teaching (experience|expertise)' README.md` -> 5
- `grep -cE 'accumulated (academic )?teaching (experience|expertise)' docs/THE-BRAIN.md` -> 1
- `grep -c 'calibrates which method fits which stage' README.md` -> 1 (confirms site 5's verb agreement landed)
- Human-check (self-performed read-back): all 6 rewritten sentences read naturally in their own grammatical shape (mid-sentence clause, standalone tagline, appositive, table cell, sentence opener, parenthetical), no doubled "accumulated", no broken appositive, table cell 4 still parses as a comma-separated list, site 5's verb agrees with its new singular subject, and every site still communicates that the methodology comes from real academic teaching practice, not theory

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- README.md and docs/THE-BRAIN.md no longer contradict each other or themselves about methodology provenance
- The 5 out-of-scope internal docs remain a tracked, accepted inconsistency for a future follow-up task, should one be scoped
- No blockers

---
*Phase: quick-260916-l2g*
*Completed: 2026-09-16*

## Self-Check: PASSED

- FOUND: README.md
- FOUND: docs/THE-BRAIN.md
- FOUND: .planning/quick/260916-l2g-resolve-the-20-years-of-teaching-readme-/260916-l2g-SUMMARY.md
- FOUND: commit d4ee05355
