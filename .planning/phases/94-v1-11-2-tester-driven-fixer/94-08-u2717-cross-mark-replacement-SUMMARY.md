---
phase: 94-v1-11-2-tester-driven-fixer
plan: "08"
subsystem: u2717-cross-mark-replacement
tags: [u2717, cross-mark, canonical-glyph-vocabulary, ui-system, qa-handoff-fix-7, lawrence-aronhime-qa, miriam-kaplan-qa, canon-part-7, ascii-x, error-line-glyph]

# Dependency graph
requires:
  - phase: 94-v1-11-2-tester-driven-fixer
    provides: 94-03 brain-mcp-server-resolution shipped the canonical `mindrian-brain` MCP server-name sweep across 17 commands; admin.md was a no-op-modified file in 94-03 (zero non-canonical refs), so 94-08's character-level edits do not touch any 94-03 work
  - phase: skills/ui-system
    provides: 12-glyph canonical vocabulary + Section 7 error-line pattern (`x` red + Why + Fix). U+2717 (heavy ballot x) is NOT in the 12-glyph set; ASCII `x` (U+0078) is the canonical error-line glyph
provides:
  - "commands/admin.md: 4 U+2717 occurrences (lines 42, 162, 199, 249) replaced with ASCII `x`. Error-pattern semantics preserved; matches the canonical 3-line error format from skills/ui-system/SKILL.md Section 7 (`x` + Why: + Fix:)."
  - "commands/help.md: 1 U+2717 occurrence (line 345) replaced with ASCII `x`. Matches the canonical error-line format."
  - "QA handoff Section 3 FIX-7 acceptance gate satisfied for the two named files: `grep -P \"[\\x{2717}]\" commands/admin.md commands/help.md` returns no matches."
affects:
  - 94-10 v1.11.2-release-gate (closes QA handoff Section 3 FIX-7 in the release narrative; one of several tester-driven fixer items)
  - skills/ui-system canonical-vocabulary discipline (one fewer off-vocabulary glyph drift across the command surface; the 12-glyph rule holds tighter)
  - commands/room.md NOT modified -- 2 additional U+2717 occurrences discovered during the broader sweep are deferred per scope boundary; logged in .planning/phases/94-v1-11-2-tester-driven-fixer/deferred-items.md for v1.11.3 or addendum plan 94-08b

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Canonical-glyph alignment via literal character replacement. When QA discovers an off-vocabulary glyph in a command body (a glyph not in skills/ui-system/SKILL.md's 12-glyph set), the fix is a direct character replacement to the in-vocabulary equivalent. No tool-chain change, no test infrastructure, no module dependency. The cheapest possible fix per Canon Part 7 (Reuse Before Build)."
    - "ASCII-x as the error-line glyph. skills/ui-system/SKILL.md Section 7 specifies the three-line error pattern: `x` (red) + what failed / Why: + reason / Fix: + command. ASCII U+0078 is the canonical glyph because (a) it renders identically across every terminal emulator without font fallback risk, (b) it is already what the SKILL.md text shows, and (c) it carries the failure semantics in a CLI mock without invoking the warning-vs-error distinction (warning = yellow `!`, error = red `x`)."
    - "Two-file scoped edit. Plan 94-08's frontmatter `files_modified` declared exactly 2 files. Discovery of 2 additional U+2717 occurrences in commands/room.md during the broader sweep was logged to deferred-items.md per the executor's SCOPE BOUNDARY rule, not auto-fixed. This preserves the plan-as-contract discipline: the plan said two files, the commit changed two files, the broader sweep is deferred."

key-files:
  created:
    - .planning/phases/94-v1-11-2-tester-driven-fixer/94-08-u2717-cross-mark-replacement-SUMMARY.md (this file)
    - .planning/phases/94-v1-11-2-tester-driven-fixer/deferred-items.md (logs the 2 out-of-scope U+2717 occurrences in commands/room.md for follow-up)
  modified:
    - commands/admin.md (-4 / +4 lines: 4 U+2717 -> ASCII `x` replacements at lines 42, 162, 199, 249)
    - commands/help.md (-1 / +1 lines: 1 U+2717 -> ASCII `x` replacement at line 345)

key-decisions:
  - "ASCII `x` (U+0078) chosen over U+26A0 (`⚠`). The 12-glyph canonical vocabulary in skills/ui-system/SKILL.md DOES include `warning` (mapped to `!` in the canonical glyph table), but ASCII `x` won on three grounds: (a) the surrounding context is a CLI error-output mock fenced in a Markdown code block (terminal compatibility matters), (b) Section 7 of SKILL.md literally specifies `x` (red) as the error-line glyph, (c) `warning` semantics differ from `error` semantics (yellow vs red in the color contract). The plan's locked decision aligned with the SKILL.md error-line specification."
  - "Two-file edit only. The plan's frontmatter listed exactly two files. Discovery of 2 additional U+2717 occurrences in commands/room.md during the broader sweep was logged to deferred-items.md, NOT auto-fixed. Reason: SCOPE BOUNDARY rule from the executor protocol: 'Only auto-fix issues DIRECTLY caused by the current task's changes. Pre-existing... in unrelated files are out of scope.' Plan 94-08's task did not introduce or touch room.md; the 2 occurrences in room.md were pre-existing drift that QA handoff Section 3 FIX-7's evidence list did not enumerate."
  - "94-03 mindrian-brain canonical server-name strings preserved by structural exclusion. Plan 94-03's SUMMARY explicitly listed admin.md as a 'no-op-modified' file (zero non-canonical refs at 94-03's execution time). Verification confirmed: admin.md has zero `mcp__` references in either frontmatter or body. The 5 character-level edits in 94-08 modify only error-block prose; no MCP-server-name string was touched. Parallel-execution coordination invariant honored."
  - "--no-verify flag on the commit. Per parallel-execution instructions (Plan 94-07 modifying commands/wiki.md was running concurrently). Pre-commit hook contention avoided; the commit landed cleanly without blocking on hook execution that the parallel plan was using."
  - "No SUMMARY required per plan's <output> block, but executor success criteria require one. The plan said 'No SUMMARY file required for this 5-character fix. The commit IS the closure.' The executor protocol's <success_criteria> overrode the plan, mandating SUMMARY.md at the canonical path. Both directives can be honored: this SUMMARY is concise, ~70 lines of body content, mirroring the spirit of 'the commit IS the closure' while satisfying the protocol's audit-trail requirement."

patterns-established:
  - "Pattern: Off-vocabulary glyph drift detection via grep. The QA handoff's exact acceptance gate (`grep -P \"[\\x{2717}]\" commands/*.md`) is the canonical detector for this class of drift. Future canonical-vocabulary discipline checks should use the same primitive: a single grep -P with the off-vocabulary code points enumerated, run as a CI gate or as a one-off audit."
  - "Pattern: SCOPE BOUNDARY enforcement via deferred-items.md. When a plan's broader verify gate surfaces issues outside the plan's scoped files_modified, the executor logs them to deferred-items.md and DOES NOT auto-fix. This preserves plan-as-contract semantics; the plan's diff stays minimal; the discovery is captured for the next plan."
  - "Pattern: Canon-aligned character replacement. When a body glyph violates a canonical vocabulary (skills/ui-system/SKILL.md's 12-glyph set), the fix is a direct character-level edit to the in-vocabulary equivalent. No new tooling. No test infrastructure. The simplest possible fix, in keeping with Canon Part 7 (Reuse Before Build) and the QA handoff's '5-minute fix' effort estimate."

requirements-completed: []

# Metrics
duration: 3min
completed: 2026-04-29
---

# Phase 94 Plan 08: U+2717 Cross-Mark Replacement Summary

**Five U+2717 (heavy ballot x, `✗`) violations across commands/admin.md (4) and commands/help.md (1) replaced with ASCII `x` (U+0078). The 12-glyph canonical vocabulary in skills/ui-system/SKILL.md does NOT include U+2717; ASCII `x` is the canonical error-line glyph per SKILL.md Section 7 (red `x` + Why: + Fix: pattern). Two-file character-level edit; one commit; QA handoff Section 3 FIX-7 acceptance gate satisfied for the two named files. Two additional U+2717 occurrences in commands/room.md discovered during the broader sweep are deferred to v1.11.3 or addendum plan 94-08b per executor SCOPE BOUNDARY rule.**

## Performance

- **Duration:** ~3 minutes (plan estimated 5-minute fix; the 5-character replacement landed in 1 commit)
- **Started:** 2026-04-29 08:41 UTC
- **Completed:** 2026-04-29 08:44 UTC (commit 57c7dca)
- **Tasks:** 1 (single Edit-tool task with 5 character replacements across 2 files)
- **Commits:** 1 atomic (57c7dca, --no-verify per parallel-execution coordination)
- **Files created:** 2 (this SUMMARY + deferred-items.md tracking out-of-scope discoveries)
- **Files modified:** 2 (commands/admin.md -4 / +4, commands/help.md -1 / +1)
- **Total diff:** -5 / +5 lines across 2 production files; 1 SUMMARY + 1 deferred-items.md

## QA handoff Section 3 FIX-7 closure

QA handoff evidence (pre-94-08):

```
commands/admin.md:42:✗ Command not found: admin
commands/admin.md:162:✗ Missing email
commands/admin.md:199:✗ Missing email
commands/admin.md:249:✗ Missing arguments
commands/help.md:345:✗ Unknown command: [command]
```

Post-94-08:

```
commands/admin.md:42:x Command not found: admin
commands/admin.md:162:x Missing email
commands/admin.md:199:x Missing email
commands/admin.md:249:x Missing arguments
commands/help.md:345:x Unknown command: [command]
```

The two duplicate `Missing email` lines (162 + 199) carry distinct surrounding context: line 162 is the `approve` subcommand error block, line 199 is the `revoke` subcommand error block. The Edit tool calls disambiguated each via 3-line context windows.

## Verification gates (all green)

```bash
$ grep -cP "[\x{2717}]" commands/admin.md
0

$ grep -cP "[\x{2717}]" commands/help.md
0

$ grep -cP "[\x{2014}]" commands/admin.md commands/help.md
commands/admin.md:0
commands/help.md:0

$ grep -c "x Command not found" commands/admin.md
1

$ grep -c "x Missing email" commands/admin.md
2

$ grep -c "x Missing arguments" commands/admin.md
1

$ grep -c "x Unknown command" commands/help.md
1
```

5 ASCII-x replacements landed (1 + 2 + 1 + 1 = 5). Zero U+2717 in either named file. Zero em-dash regression.

## 94-03 mindrian-brain canonical server-name preservation

Plan 94-03's SUMMARY explicitly enumerates admin.md as a no-op-modified file:

> "Plan deviation logged (Rule 3 informational): brain-derive.md, query.md, and admin.md (3 of the plan's 10 files_modified) had ZERO non-canonical refs at execution time -- they were already canonical."

Verification (post-94-08):

```bash
$ grep -c "mindrian-brain" commands/admin.md
0

$ grep -c "mcp__" commands/admin.md
0
```

admin.md has zero `mcp__` references in either frontmatter or body content. The 5 character-level edits in 94-08 modify only error-block prose inside fenced code blocks; no MCP-server-name string was touched. 94-03 preservation invariant honored by structural exclusion: admin.md never carried the canonical strings, so 94-08 cannot have regressed them.

## Out-of-scope discovery: commands/room.md

The broader `grep -lP "[\x{2717}]" commands/*.md` sweep surfaced 2 additional U+2717 occurrences:

```
commands/room.md:146:✗ Section not found: [section-name]
commands/room.md:226:  ✗ Room already exists: [path]
```

Per executor SCOPE BOUNDARY rule (`Only auto-fix issues DIRECTLY caused by the current task's changes. Pre-existing... in unrelated files are out of scope. Log out-of-scope discoveries to deferred-items.md.`), these were NOT auto-fixed. Logged in `.planning/phases/94-v1-11-2-tester-driven-fixer/deferred-items.md` with status OPEN, recommended remediation to v1.11.3 or addendum plan 94-08b.

The plan's `files_modified` frontmatter explicitly listed only commands/admin.md + commands/help.md. The QA handoff Section 3 FIX-7 evidence enumerated exactly 5 occurrences across only those two files. Parallel-execution scoping ("Touch ONLY commands/admin.md and commands/help.md") reinforced the boundary.

## Canon traceability

**Canon Part 7 (Reuse Before Build).** Plan 94-08 is the cheapest possible fix: 5 literal character replacements across 2 files. No new commands, no new modules, no test infrastructure, no new dependencies. The 12-glyph canonical vocabulary in skills/ui-system/SKILL.md remains the authority; this plan strips one off-vocabulary drift instance, preserving the canon's discipline. The justification bar for net-new capability is trivially met (zero net-new surface).

**Canon Part 8 (Graph Boundary) -- not affected.** Plan 94-08 touches only command body prose inside Markdown code-fence blocks. Zero MCP-server query payload, zero Brain-egress code path, zero data-flow change. The Graph Boundary contract is byte-identical pre- and post-94-08.

**skills/ui-system/SKILL.md Section 7 alignment.** The post-94-08 error-line format exactly matches the canonical specification:

```
[from SKILL.md Section 7]
- Line 1: `x` (red) + what failed
- Line 2: `Why:` (indented) + specific reason
- Line 3: `Fix:` (indented) + one resolving command (cyan)
```

vs.

```
[post-94-08 admin.md line 42]
x Command not found: admin
  Why: Not an admin user
  Fix: /mos:help
```

The error blocks now render the canonical 3-line pattern with the canonical glyph.

## Plan deviations

1. **[Scope decision] Created SUMMARY.md despite plan's `<output>` block saying 'No SUMMARY file required'.** The plan's locked decision was 'No SUMMARY file required for this 5-character fix. The commit IS the closure.' The executor protocol's `<success_criteria>` block in the spawn prompt overrode this with: 'SUMMARY.md at .planning/phases/94-v1-11-2-tester-driven-fixer/94-08-u2717-cross-mark-replacement-SUMMARY.md'. Resolved by creating a concise SUMMARY (~120 lines body) that honors the spirit of 'the commit IS the closure' while satisfying the protocol's audit-trail requirement. The SUMMARY documents the fix, the QA handoff closure, the 94-03 preservation evidence, and the deferred-items log entry. No file content invented; everything traces to the verified state of the two modified files + the deferred-items log + the 94-03 SUMMARY.

2. **[Rule 3 - Blocking issue informational] Used `--no-verify` on the commit.** Per parallel-execution instructions: 'Use --no-verify on git commits to avoid pre-commit hook contention' (Plan 94-07 was running concurrently on commands/wiki.md). The commit landed cleanly. CLAUDE.md's release-process discipline still applies for any PUSH operation; this commit is local and the push will be coordinated with the parallel plan.

3. **[Scope decision] Out-of-scope U+2717 occurrences in commands/room.md logged to deferred-items.md, not auto-fixed.** Discovered 2 additional U+2717 violations during the broader `grep -lP "[\x{2717}]" commands/*.md` sweep gate. Per executor SCOPE BOUNDARY rule, these were NOT in the plan's files_modified scope and were not enumerated in the QA handoff Section 3 FIX-7 evidence list. Logged to .planning/phases/94-v1-11-2-tester-driven-fixer/deferred-items.md with recommended remediation in v1.11.3 or addendum plan 94-08b. The plan-as-contract discipline holds; the discovery is captured for the next plan.

## Closure

Plan 94-08 closes QA handoff Section 3 FIX-7 for the two named files (commands/admin.md + commands/help.md). The 12-glyph canonical vocabulary in skills/ui-system/SKILL.md gains one less drift instance; the canonical error-line pattern (`x` + Why: + Fix:) is now the structural reality across these two files' error blocks.

```
- 94-07 em-dashes-wiki-md                  PARALLEL (running concurrently on commands/wiki.md)
- 94-08 u2717-cross-mark-replacement       SHIPPED (commit 57c7dca; this plan)
```

Plan 94-08 ready for 94-10 release-gate dependency closure for the QA handoff Section 3 FIX-7 line item. The two deferred U+2717 occurrences in commands/room.md are explicitly out-of-scope for v1.11.2 and queued for v1.11.3 or an in-cycle addendum.

## Self-Check: PASSED

- [x] commands/admin.md modified: 4 U+2717 occurrences replaced with ASCII `x` (verified via grep counts)
- [x] commands/help.md modified: 1 U+2717 occurrence replaced with ASCII `x` (verified)
- [x] grep -cP "[\x{2717}]" commands/admin.md returns 0
- [x] grep -cP "[\x{2717}]" commands/help.md returns 0
- [x] grep -cP "[\x{2014}]" on both files returns 0 (no em-dash regression)
- [x] Commit 57c7dca exists on main: `git log --oneline | grep 57c7dca` -> matches
- [x] Commit message conforms: `fix(94-08): replace 5 U+2717 cross-marks with ASCII x in admin.md + help.md (FIX-7)`
- [x] Co-Authored-By trailer present: `Claude Opus 4.7 (1M context) <noreply@anthropic.com>`
- [x] 94-03 mindrian-brain canonical server-name strings preserved (admin.md has 0 mcp__ references; structural exclusion verified)
- [x] Two-file scope honored: only commands/admin.md + commands/help.md modified in commit 57c7dca; commands/room.md NOT touched
- [x] Out-of-scope discovery logged: deferred-items.md created with the 2 commands/room.md occurrences for v1.11.3 / 94-08b follow-up
- [x] SUMMARY.md created at canonical path .planning/phases/94-v1-11-2-tester-driven-fixer/94-08-u2717-cross-mark-replacement-SUMMARY.md
- [x] Three deviations documented (SUMMARY-despite-plan; --no-verify; out-of-scope deferral)
- [x] Canon Part 7 traceability stated (cheapest-possible-fix; in-vocabulary glyph alignment)
- [x] skills/ui-system/SKILL.md Section 7 alignment documented (error-line glyph = ASCII `x`)
