---
phase: 234-mindrianos-as-infrastructure-skills-mcp-everywhere-open-core
plan: 03
subsystem: skills-catalog
tags: [agent-skills-spec, portability, codemod, frontmatter, licensing]
requires:
  - scripts/check-skill-spec.cjs (234-01)
provides:
  - scripts/migrate-skill-frontmatter.cjs
  - 123 spec-conformant SKILL.md files (name, allowed-tools-as-string, license, compatibility)
affects:
  - skills/**/SKILL.md (123 of 125)
  - tests/run-all-234.sh (check-skill-spec --check leg: 9 hard failures -> 2)
tech-stack:
  added: []
  patterns:
    - "targeted line-level frontmatter splice (never matter.stringify) to preserve hand-written YAML comments"
    - "codemod self-verification: re-parse and diff against the pre-edit parse before writing"
key-files:
  created:
    - scripts/migrate-skill-frontmatter.cjs
  modified:
    - skills/**/SKILL.md (123 files)
decisions:
  - "allowed-tools uses the spec's space separator for 122 of 123 skills, but comma-space for skills/status, whose grant Bash(node scripts/mos-status.cjs:*) contains a space and cannot be space-joined without silently widening the Bash permission scope."
  - "gray-matter is used READ-ONLY; every write is a line-level splice, because matter.stringify() deletes hand-written YAML comments including the Canon Part 8 Brain-egress prohibitions inside rs-experts and rs-thesis allowed-tools blocks."
  - "MOSDeckEngine and value-proposition excluded by explicit list rather than by iteration accident, deferring both to 234-04 as decision tasks."
metrics:
  duration: ~35 min
  completed: 2026-07-28
  tasks: 1
  files: 124
---

# Phase 234 Plan 03: Skill Frontmatter Spec Migration Summary

Migrated 123 of 125 shipped skills onto the Agent Skills specification via a self-verifying codemod that preserves every hand-written YAML comment, dropping check-skill-spec hard failures from 9 to the 2 that plan 234-04 owns.

## What Was Built

`scripts/migrate-skill-frontmatter.cjs`, a one-time CJS codemod, plus its one-time output across 123 `SKILL.md` files. Four transformations:

| Transformation | Scope | Result |
|---|---|---|
| Insert `name: <dirname>` when absent | 7 skills | All 125 skills now carry `name` |
| `allowed-tools` YAML list -> string | 105 skills | 111 of 125 now string-typed (the rest have no `allowed-tools` key) |
| Add `license:` | 123 skills | BSL-1.1 legible at the skill level |
| Add `compatibility:` | 16 skills | 15 `disable-model-invocation` + 1 hook-referencing (`admin`) |

## Before / After (measured, not estimated)

| Metric | Before | After |
|---|---|---|
| check-skill-spec hard failures (required-field breach) | 9 | **2** |
| check-skill-spec `allowed-tools` array deviations | 105 | **1** |
| Total failing skills | 111 | **2** |
| Skills carrying `license:` | 0 | **123** |
| Skills carrying `compatibility:` | 0 | **16** |
| Frontmatter comment lines across the catalog | 331 | **331** (zero lost) |
| Zed catalog budget | 12,860 B (25%) | 12,966 B (25%), exit 0 |

The 2 remaining hard failures are exactly the 2 excluded from this plan's scope:

- `skills/MOSDeckEngine/SKILL.md` - `name` charset violation (needs a directory rename with a grep-and-update of every caller)
- `skills/value-proposition/SKILL.md` - `name: validate-proposition` != dirname (an intentional, comment-documented mismatch with two live consumers)

Both are owned by plan 234-04.

Budget note: the +106 byte change is entirely the 7 newly-added `name` values. `license:` and `compatibility:` do not enter the Zed budget, which counts `name` + `description` only. Confirmed by re-running `--catalog-budget` (exit 0, still 25%).

## Key Decisions

### 1. Targeted text splices, never `matter.stringify()`

`matter.stringify()` re-serializes from the parsed JS object through `js-yaml`, which silently drops every hand-written YAML comment. The plan flagged this; the tree confirmed it is load-bearing. `skills/rs-experts` and `skills/rs-thesis` record a Canon Part 8 prohibition in comments sitting **inside the `allowed-tools` block being rewritten**:

```yaml
  # mcp__mindrian-brain__read_neo4j_cypher intentionally removed (BUG 2 fix):
  # RSDiscovery is USER DATA (Canon Part 8 -- LOCAL -> BRAIN: NO). The remote
  # Brain must never be called from this command. Always uses Tier 0 SQLite.
```

A naive round-trip would have deleted the written reason a future maintainer needs in order to not re-add the Brain tool. The codemod re-emits in-block comments verbatim beneath the new single-line form. Verified: 3 preserved in `rs-experts`, 3 in `rs-thesis`, catalog-wide comment count unchanged at 331.

### 2. Separator: space by default, comma-space where a space separator is lossy

This is the one deliberate deviation from the plan's literal "space-separated" instruction, and it is a correctness fix, not a style choice.

`skills/status` grants `Bash(node scripts/mos-status.cjs:*)` - a Claude Code scoped permission that narrows Bash to one specific script. That entry contains a space. Space-joining it produces:

```
allowed-tools: Bash(node scripts/mos-status.cjs:*) Read AskUserQuestion
```

which a whitespace-splitting parser re-reads as the separate tokens `Bash(node`, `scripts/mos-status.cjs:*)`, `Read`, `AskUserQuestion` - silently widening a deliberately narrow Bash grant. That is a permission-scope regression (deviation Rule 2: security correctness).

For that one file the separator falls back to comma-space, which is (a) lossless, (b) already the shipping form in 7 other `SKILL.md` files and 9 `commands/*.md` files in this repo, and (c) still a **string**, so it satisfies both the spec's type rule and `check-skill-spec.cjs`. The spec marks `allowed-tools` Experimental with support that "may vary between agent implementations", so preserving the grant's meaning beats separator purity. 122 of 123 skills use the plain space form.

### 3. Already-string values left byte-identical

7 skills (`mva-brief`, `mva-option`, `brain-derive`, `dial-memory-refresh`, `dogfood-flush`, `explain-decision`, `feynman-timeline-refresh`) already carried `allowed-tools` as a comma-separated string. They already satisfy the spec's type rule, so the codemod leaves them untouched and asserts they do not change.

## Measured Findings That Corrected the Plan's Estimates

| Plan / RESEARCH estimate | Measured |
|---|---|
| 112 of 125 skills with `allowed-tools` as a list | **105** are arrays; 7 more were already comma-separated strings (RESEARCH counted both forms together) |
| ~16 hook-referencing skills | **2** (`admin`, `dogfood-flush`), both via `hooks.json`. The literals `Stop gate` and `contradiction push` return **zero** hits catalog-wide, case-sensitive or not. Only 1 (`admin`) was not already covered by the disable-model-invocation list, so `compatibility` landed on 16 skills total, which happens to match RESEARCH's estimate for a different reason. |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Security correctness] Comma-space separator for `skills/status`**
- **Found during:** Task 1, caught by the codemod's own token-identity self-check
- **Issue:** Space-joining `Bash(node scripts/mos-status.cjs:*)` splits one narrow Bash grant into multiple broad tokens
- **Fix:** `toolSeparator()` returns comma-space when any entry contains a space
- **Files modified:** `scripts/migrate-skill-frontmatter.cjs`, `skills/status/SKILL.md`
- **Commit:** a6bd6097

**2. [Rule 1 - Bug] Corrupted separator literal in the codemod's verifier**
- **Found during:** Task 1
- **Issue:** The initial authored payload of `verifyMigration()` emitted a literal NUL byte (U+0000) as the separator argument to `join()` where a space was intended. That made the comparison stricter than designed, and made the line unmatchable by a normal string edit. Root cause was a bad byte in the authored payload, not a logic error.
- **Fix:** NUL bytes replaced, and the comparison deliberately rewritten to explicit array token-identity (`JSON.stringify(aTokens) !== JSON.stringify(bTokens)`), which is the invariant actually wanted. The accidental strictness is what surfaced deviation 1, so the intent was kept rather than loosened.
- **Files modified:** `scripts/migrate-skill-frontmatter.cjs`
- **Commit:** a6bd6097

### Out of Scope, Not Fixed

- `scripts/check-shape-declaration.cjs --check` emits 55 advisory WARN lines, including one for `skills/visualize` (declares `hitl_shape: F.1` and `connector.excluded: true` simultaneously). Pre-existing and untouched by this plan: the diff for that file only adds `license:` and normalizes `allowed-tools`. Advisory gate, exit 0.
- The `metadata:` migration for the 63 non-spec top-level keys is explicitly out of scope per the plan and RESEARCH ("do not spend a wave on it until a real host is observed complaining").

## Verification (all commands actually run)

| Check | Command | Result |
|---|---|---|
| Task `<verify><automated>` | `check-skill-spec --check \| grep -c <7 skills>` | **0** (passes `grep -qx 0`) |
| AC2 license coverage | `grep -rL "^license:" ... \| wc -l` | **0** |
| AC3 no list form remains | `grep -rlE "^allowed-tools:\s*$" ... \| wc -l` | **0** |
| AC4a comment tripwire | `grep -c "Phase 172-06 CIRS R1 exclude" skills/larry-personality/SKILL.md` | **1** |
| AC4b in-block comment spot-check | `grep -c "^  #" skills/rs-experts/SKILL.md` | **3** |
| AC5 catalog budget | `check-skill-spec --catalog-budget` | exit **0**, 25% |
| Connector registry | `build-connector-registry.cjs --check` | **OK**, exit 0 |
| Render coverage | `check-render-coverage.cjs` | 16 covered / 0 gap, exit 0 |
| Diff is frontmatter-only | `git diff -U0` filtered for body lines | **empty** (no body byte changed) |
| No file deletions | `git diff --diff-filter=D HEAD~1 HEAD` | **0** |

`bash tests/run-all-234.sh` -> `PASS=6 FAIL=1`. The single failing leg is `check-skill-spec --check`, failing on exactly `MOSDeckEngine` + `value-proposition`. This is the expected intermediate state the plan predicted ("the check-skill-spec leg's failure count dropping from 9 to 2"); the leg goes green when 234-04 lands.

## D-01 Compliance

The 123 migrated skills remain plain `SKILL.md` files inside the existing `skills/` package, installable into any Claude-Code-skill-format-compatible host. No host-runtime fork, no new dependency, no build step was introduced. The migration is strictly additive at the frontmatter level plus one type normalization.

## Canon Compliance

- **Part 8 (Graph Boundary):** the codemod reads and writes local `skills/` files only. Zero network reach, zero Brain read or write. The `run-all-234.sh` Part 8 sweep and its negative self-test both pass. Notably, the migration actively *preserved* two hand-written Part 8 prohibitions that a naive rewrite would have deleted.
- **Part 7 (Reuse Before Build):** no new validator was built; the codemod verifies against 234-01's existing `scripts/check-skill-spec.cjs`.
- **Part 11 (CIRS):** every `connector:` block, `hitl_shape`, and CIRS exclusion comment survived byte-for-byte; `build-connector-registry.cjs --check` stays green.

## Notes

Concurrent unrelated sessions had the working tree dirty (statusline work, `.planning/debug/` artifacts). Only the 124 in-scope files were staged and committed; nothing outside `skills/` and `scripts/migrate-skill-frontmatter.cjs` was touched.

`langtalks-graph-expert` MCP (mandated by CLAUDE.md for Claude Code behavior questions) was not connected in this execution context. The separator decision therefore rests on cited primary sources already captured in 234-RESEARCH.md (the agentskills.io spec table) plus in-repo production precedent, not on training-data assumption.

## Commits

- `a6bd6097` feat(234-03): normalize 123 SKILL.md files onto the Agent Skills spec

## Self-Check: PASSED

- `scripts/migrate-skill-frontmatter.cjs` exists on disk
- `234-03-SUMMARY.md` exists on disk
- Commit `a6bd6097` present in git history
- Zero em-dashes in the codemod, the SUMMARY, or the commit message
