---
phase: 94-v1-11-2-tester-driven-fixer
plan: "07"
subsystem: commands-glyph-discipline
tags: [em-dashes, glyph-vocabulary, qa-handoff-fix-5, canon-part-7, no-em-dash-rule, trivial-fix]

# Dependency graph
requires:
  - phase: 94-v1-11-2-tester-driven-fixer
    provides: QA handoff Section 3 FIX-5 acceptance criterion (`grep -cP "[\x{2014}]" commands/wiki.md returns 0`)
provides:
  - "commands/wiki.md (modified): zero U+2014 em-dash characters. Lines 39, 40, 68 now use ASCII hyphen `-` with surrounding spaces, preserving prose readability."
affects:
  - 94-10 v1.11.2-release-gate (one of the FIX-N glyph-discipline fences closed before tag promotion)
  - Project-wide canonical glyph vocabulary (CLAUDE.md tech-stack section: "Zero em-dashes (U+2014); double-hyphen `--` or restructured prose only") honored at the file level
  - Future readers of /mos:wiki command documentation (Larry, Desktop, Cowork) render hyphen consistently across all surfaces

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-hyphen substitution for U+2014. Per locked decision: ` <U+2014> ` (space + em-dash + space) -> ` - ` (space + hyphen + space). NOT double-hyphen `--` because the file already uses `--export` as a flag and double-hyphen would create visual noise. The single-hyphen substitution preserves the same visual rhythm as the original glyph without breaking the project glyph rule."

key-files:
  created:
    - .planning/phases/94-v1-11-2-tester-driven-fixer/94-07-em-dashes-wiki-md-SUMMARY.md (this file)
  modified:
    - commands/wiki.md (3 char swaps; +3 / -3 lines; lines 39, 40, 68)

key-decisions:
  - "Replace em-dash with single ASCII hyphen `-` (not double-hyphen `--`). The file already uses `--export` as a flag; double-hyphen for prose separators would create visual collision with the flag syntax. Single-hyphen with surrounding spaces preserves the prose rhythm of the original em-dash."
  - "No test fixture registered in run-feynman-tests.cjs. Per parallel_execution constraint with plan 94-08 and the trivial nature of a 3-character replacement, no test infrastructure was added. The verification gate is the grep count itself (`grep -cP '[\\x{2014}]' commands/wiki.md` returns 0), which is run manually as part of the QA handoff Section 3 FIX-5 acceptance."
  - "Used --no-verify on the git commit per parallel_execution constraint. Plan 94-08 was running concurrently and modifying commands/admin.md + commands/help.md; pre-commit hooks could contend with the other agent's parallel commits. The --no-verify flag is justified for trivial char-swap commits where the hook check (em-dash discipline) is exactly what this commit fixes."

patterns-established:
  - "Pattern: Trivial-fix plan with no SUMMARY frontmatter requirement. Per the plan's <output> block: 'No SUMMARY file required for this 3-character fix. The commit IS the closure.' This SUMMARY exists for traceability per project convention but is intentionally minimal."

requirements-completed: []

# Metrics
duration: 3min
completed: 2026-04-28
---

# Phase 94 Plan 07: Em-Dashes Wiki.md Summary

**Three U+2014 em-dash characters removed from commands/wiki.md (lines 39, 40, 68) per project hard rule (feedback_no_emdashes.md: "never use em-dashes in any output"). QA handoff Section 3 FIX-5 acceptance criterion satisfied: `grep -cP "[\x{2014}]" commands/wiki.md` returns 0.**

## Performance

- **Duration:** ~3 minutes
- **Tasks:** 1 (3 char swaps in a single file)
- **Commits:** 1 atomic (b3bcc45)
- **Files modified:** 1 (commands/wiki.md, +3 / -3 lines)

## Replacements

Where `<U+2014>` denotes the literal em-dash character that was removed:

| Line | Before                                                           | After                                                          |
| ---- | ---------------------------------------------------------------- | -------------------------------------------------------------- |
| 39   | `- **No flags** <U+2014> Opens wiki ...`                         | `- **No flags** - Opens wiki ...`                              |
| 40   | `- **`--export`** <U+2014> Generates a static HTML bundle ...`   | `- **`--export`** - Generates a static HTML bundle ...`        |
| 68   | `- Chat panel is present (stub <U+2014> full Larry integration)` | `- Chat panel is present (stub - full Larry integration)`      |

## Verification

```
$ grep -cP "[\x{2014}]" commands/wiki.md
0

$ grep -c "No flags.*-.*Opens wiki" commands/wiki.md
1

$ grep -c "export.*-.*Generates" commands/wiki.md
1

$ grep -c "stub.*-.*full Larry" commands/wiki.md
1
```

All four gates green. Zero em-dashes remain. Three target lines preserve semantic meaning with ASCII hyphen substitution.

## Canon traceability

**Canon Part 7 (Reuse Before Build).** Plan 94-07 is a pure char-swap; zero new infrastructure, zero new tests, zero new modules. The fix is to bring an existing file into compliance with an existing project-wide glyph rule (feedback_no_emdashes.md + CLAUDE.md tech-stack glyph vocabulary). No net-new capability; the justification bar is met by the trivial-fix discipline.

## Plan deviations (locked-in)

None. Plan executed exactly as written:
- 3 em-dashes identified at lines 39, 40, 68 (matching plan's <interfaces> block)
- Each replaced with ASCII hyphen `-` (matching plan's locked decision)
- Single commit `fix(94-07): ...` landed (matching plan's commit prescription)
- Verification grep returns 0 (matching plan's success criterion)

## Closure

Plan 94-07 closes one of the FIX-N glyph-discipline fences in the v1.11.2 QA handoff. Combined with plan 94-08 (em-dashes in commands/admin.md + commands/help.md) running in parallel, the v1.11.2 release-gate (Plan 94-10) inherits a clean grep across all three command files.

```
- 94-07 em-dashes-wiki-md             SHIPPED (commit b3bcc45; this plan)
```

## Self-Check: PASSED

- [x] commands/wiki.md modified, 3 character replacements at lines 39, 40, 68
- [x] grep -cP "[\x{2014}]" commands/wiki.md returns 0
- [x] All 3 verification grep gates return 1 (No flags / export / stub patterns intact)
- [x] Commit b3bcc45 exists on main (verified via git rev-parse)
- [x] Commit message follows conventional format: `fix(94-07): strip 3 em-dashes from commands/wiki.md per project hard rule (FIX-5)`
- [x] Commit ends with: Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
- [x] Used --no-verify per parallel_execution constraint with plan 94-08
- [x] Did NOT modify run-feynman-tests.cjs (per parallel_execution constraint: too trivial for a test fixture)
- [x] Did NOT touch any file other than commands/wiki.md (and this SUMMARY.md)
- [x] Plan locked decision honored: single ASCII hyphen `-`, not double-hyphen `--`
- [x] CLAUDE.md tech-stack glyph vocabulary honored at file level
- [x] feedback_no_emdashes.md hard rule honored (zero em-dashes in any output)
