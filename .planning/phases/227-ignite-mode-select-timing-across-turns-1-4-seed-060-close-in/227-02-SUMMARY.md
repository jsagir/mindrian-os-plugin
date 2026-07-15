---
phase: 227-ignite-mode-select-timing-across-turns-1-4-seed-060-close-in
plan: 02
subsystem: skills-governance
tags: [cirs, skills, cjs-scanner, description-tightening, sweep-report]

# Dependency graph
requires: []
provides:
  - "scripts/sweep-skill-descriptions.cjs, a reusable CJS scanner over every skills/*/SKILL.md that classifies sensor_triggers + description-tightness against the trending-to-absurd calibration reference"
  - "227-SWEEP-FINDINGS.md, the full 124-skill classification (119 clean, 3 fixed-trivial, 2 deferred-real-work) closing item 2 of ignite-frontdoor-bypassed-methodology-overfire.md's fix_remaining list"
  - "three trivial description tightenings (MOSDeckEngine, client-discovery-interview, mullins-scaffold) that add explicit-intent gates + do-not-use-for exclusions, same shape as trending-to-absurd's own FIX 2"
affects: [227-03, 227-04, future-skill-sweep-follow-up]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Skill-description sweep classifier: fs.readdirSync directory scan + frontmatter regex extraction (folded block scalar and single-line scalar both handled), zero new dependencies, self-test-gated against a known-good calibration reference before trusting the heuristic against the full set."

key-files:
  created:
    - scripts/sweep-skill-descriptions.cjs
    - .planning/phases/227-ignite-mode-select-timing-across-turns-1-4-seed-060-close-in/227-SWEEP-FINDINGS.md
  modified:
    - skills/MOSDeckEngine/SKILL.md
    - skills/client-discovery-interview/SKILL.md
    - skills/mullins-scaffold/SKILL.md

key-decisions:
  - "Description-tightness heuristic uses 5 case-insensitive markers (only when, explicitly, on request, do not use for, never use for); self-tests against trending-to-absurd's live post-fix description before scanning the other 123 files, exits 1 if the self-test fails."
  - "sensor_triggers is recorded as the literal frontmatter value including '(absent)' when the key does not exist at all (36/124 skills), never assumed to be []."
  - "119 of 124 skills classified loose by the marker heuristic were individually reviewed and judged clean-by-inspection (terse command-purpose descriptions, structural state-gated activation, or already-built-in Decision Gate mitigation) rather than mechanically flagged broken -- per D-06's explicit instruction that loose != broken."
  - "conversation-mode and larry-personality deferred per the plan's defensive rule (both touched by concurrent 227-03/227-04), not because a genuine fix was found and skipped."

requirements-completed: [REQ-2]

# Metrics
duration: ~20min
completed: 2026-07-15
---

# Phase 227 Plan 02: Systemic Skill-Description Sweep Summary

**Every skills/*/SKILL.md in the repo (124 live, one more than the 123 confirmed at planning time) is now classified for the CIRS R4 loose-description bypass pattern; 3 genuinely loose, heavyweight-methodology skills got the same explicit-intent-gate fix trending-to-absurd received on 2026-06-24, the other 119 loose flags were judged clean-by-inspection with a recorded reason, and 2 (conversation-mode, larry-personality) were explicitly deferred to avoid a cross-plan file conflict with 227-03/227-04.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-15
- **Tasks:** 2/2 completed
- **Files modified:** 5 (1 new script, 1 new report, 3 skill description edits)

## Accomplishments

- Built `scripts/sweep-skill-descriptions.cjs`: a standalone, zero-dependency CJS scanner that extracts `sensor_triggers` and `description` (handling both folded block-scalar and single-line frontmatter shapes) from every `skills/*/SKILL.md`, classifies description-tightness, and self-tests against `trending-to-absurd`'s live post-fix description before trusting the heuristic against the other 123 files.
- Ran the sweep: confirmed `sensor_triggers` is `[]` or entirely absent for all 124 skills (zero non-empty arrays live in the repo today) -- the entire live risk surface is description text, exactly as 227-CONTEXT.md's planning-time grep predicted.
- Found and fixed 3 genuinely loose descriptions belonging to heavyweight-methodology skills (a "Use when X" / "Relevant when X" broad invitation with casual-sounding trigger phrases, the same shape as trending-to-absurd's pre-fix defect): `MOSDeckEngine`, `client-discovery-interview`, `mullins-scaffold`. Each got a one-line explicit-intent qualifier plus a do-not-use-for exclusion, mirroring trending-to-absurd's own FIX 2 exactly.
- Reviewed the remaining 120 loose-flagged skills individually and recorded a clean-by-inspection reason for each: terse command-purpose descriptions for the majority, plus 8 skills (`room-passive`, `room-proactive`, `brain-connector`, `context-engine`, `intelligence-orchestrator`, `pws-methodology`, `ui-system`, `mva-pipeline`) whose activation is a structural state/config/hook gate rather than casual-language matching, so the CIRS R4 bypass pattern does not apply.
- Wrote `227-SWEEP-FINDINGS.md`: one row per skill (124 rows), verdict counts (119 clean / 3 fixed-trivial / 2 deferred-real-work) summing to the total, every fixed-trivial row citing a real commit hash.

## Task Commits

Each task was committed atomically (Task 2 required 4 commits per its own explicit instruction to cite a real per-fix commit hash in the report -- one commit per trivial fix, plus one for the report itself):

1. **Task 1: Build and run the sweep classifier** - `0621f36f` (feat)
2. **Task 2a: MOSDeckEngine trivial fix** - `f6dda07d` (fix)
2. **Task 2b: client-discovery-interview trivial fix** - `ae822e84` (fix)
2. **Task 2c: mullins-scaffold trivial fix** - `af0bac54` (fix)
2. **Task 2d: write 227-SWEEP-FINDINGS.md** - `39fc72f3` (docs -- see Deviations below for why this landed inside a concurrent session's commit, not a clean standalone one)

STATE.md's dated log entry for this plan landed the same way as the report (see Deviations):
committed inside `7034189a` (`docs(229-04): update state, roadmap after PWS_grading plan`) on
`main`, verified byte-correct. This SUMMARY.md itself is committed separately via an isolated
git worktree (see Deviations) to avoid a third instance of the same race.

## Files Created/Modified

- `scripts/sweep-skill-descriptions.cjs` - reusable CJS classifier (263 lines); reads every `skills/*/SKILL.md`, extracts `sensor_triggers` + `description`, classifies tightness, self-tests against `trending-to-absurd`, writes a raw JSON classification for report generation.
- `.planning/phases/227-ignite-mode-select-timing-across-turns-1-4-seed-060-close-in/227-SWEEP-FINDINGS.md` - the full 124-row findings report (196 lines).
- `skills/MOSDeckEngine/SKILL.md` - description tightened to an explicit-intent gate + do-not-use-for exclusion.
- `skills/client-discovery-interview/SKILL.md` - description tightened to an explicit-intent gate + do-not-use-for exclusion.
- `skills/mullins-scaffold/SKILL.md` - description tightened to an explicit-intent gate + do-not-use-for exclusion.

## Decisions Made

- Treated "loose" as a candidate for human review, not an automatic defect, per D-06's explicit instruction -- the majority of the 124 skills are terse command-purpose descriptions (e.g. "Score customer jobs with importance and satisfaction") that do not read as casual conversational invitations and were judged clean rather than mechanically flagged.
- Limited trivial fixes to skills carrying BOTH a broad "Use when / Relevant when" framing AND casual-sounding trigger language capable of matching ordinary conversation (the exact trending-to-absurd pre-fix shape) -- found in exactly 3 of 124 skills via a targeted grep for `Use when|Relevant when|Relevant for|Active when` plus a `Triggers` phrase check, cross-checked against the full sensor_triggers/loose-flagged set.
- Applied the plan's defensive rule verbatim for `conversation-mode` and `larry-personality`: both flagged loose, neither fixed inline, both marked `deferred-real-work` with the cross-plan-conflict reason, even though on inspection neither is genuinely invocation-shaped in the CIRS R4 sense (`conversation-mode` is `connector.excluded: true` ambient infra; `larry-personality` is core personality doctrine).

## Deviations from Plan

### Auto-fixed Issues

None beyond the plan's own Task 2 scope (the 3 trivial fixes were the plan's explicit deliverable, not an out-of-scope auto-fix).

### Concurrent-session commit race (documented, not a Rule 1-3 fix)

**1. [Process note, not a code defect] 227-SWEEP-FINDINGS.md's commit landed inside a concurrent session's commit**
- **Found during:** Task 2, after staging the report with `git add -f` and running `git commit -m "..." -- <path>`.
- **What happened:** This repo has another Claude Code session actively committing in the same working directory (confirmed live throughout this plan's execution -- `git log` advanced by several unrelated commits, including a large vendored-`node_modules` staging area and a `v1.15.3-beta.21` version bump, while this plan ran). Between my `git add -f` of `227-SWEEP-FINDINGS.md` and my own `git commit -- <path>` call, the concurrent session ran a commit of its own (intended message: `feat(229-04): register PWS_grading recipe + shipped pipeline definition`). At the moment that commit executed, its own actual file changes (`lib/core/recipe-maps.cjs`, `pipelines/PWS_grading/*`) had already been captured in ITS OWN prior commit (`ae315779`, the version-bump commit, which unusually bundled feature files alongside the version bump). So when the `feat(229-04)` commit ran, the only thing left staged in the shared index was my freshly force-added `227-SWEEP-FINDINGS.md`, which got swept into that commit instead of landing in my own atomic `docs(227-02)` commit.
- **Verification that no harm was done:** `git show --stat 39fc72f3` confirms the commit contains exactly and only `227-SWEEP-FINDINGS.md` (196 insertions, 1 file). `md5sum` of the committed file matches the intended content byte-for-byte. `git diff HEAD -- 227-SWEEP-FINDINGS.md` is empty (clean, nothing pending). None of this plan's other 4 commits (`0621f36f`, `f6dda07d`, `ae822e84`, `af0bac54`) were affected -- each is a clean, single-file, pathspec-limited commit made before this race occurred.
- **Why no corrective action was taken:** Amending, reverting, or rebasing commit `39fc72f3` to "fix" its message/attribution would rewrite a concurrent session's live history mid-flight -- exactly the destructive-git-in-shared-index scenario this executor's instructions prohibit. The file's content is correct, verifiable, and permanently committed; only its commit-message attribution is foreign. T-227-08 (repudiation mitigation: every fixed-trivial row cites a real commit) is still satisfied by the 3 fix commits (`f6dda07d`/`ae822e84`/`af0bac54`), which are unaffected and cleanly attributed to this plan.
- **Files affected:** `.planning/phases/227-ignite-mode-select-timing-across-turns-1-4-seed-060-close-in/227-SWEEP-FINDINGS.md` (content correct; commit `39fc72f3` instead of a standalone `docs(227-02)` commit).

### Concurrent-session branch switch mid-plan (documented, not a Rule 1-3 fix)

**2. [Process note, not a code defect] the shared working directory's checked-out branch changed under this plan's own commits**
- **Found during:** the STATE.md update step, immediately after a `git commit -- .planning/STATE.md` call reported landing on branch `release-fix-beta20` instead of `main`.
- **What happened:** `git reflog` confirms a concurrent session ran `git checkout release-fix-beta20` (a pre-existing branch last built at commit `0621f36f`, this plan's own Task 1 commit) in this same shared working directory, between this plan's `af0bac54` commit and its STATE.md commit. My STATE.md commit (`dfb37a53`) landed on `release-fix-beta20` on top of stale pre-plan content, and the checkout itself reverted the working tree's `skills/MOSDeckEngine/SKILL.md` / `client-discovery-interview/SKILL.md` / `mullins-scaffold/SKILL.md` to their pre-fix state and removed `227-SWEEP-FINDINGS.md` from disk (neither file exists in `release-fix-beta20`'s history). `main` was NOT affected -- verified via `git log --oneline main` and `git show main:.planning/STATE.md`, both fully intact with every one of this plan's commits present (`0621f36f`, `f6dda07d`, `ae822e84`, `af0bac54`, `39fc72f3`) plus the dated STATE.md section (independently confirmed swept into the concurrent session's own `7034189a` commit, same mechanism as the `227-SWEEP-FINDINGS.md` race above).
- **Why no corrective action was taken on `release-fix-beta20`:** the shared working directory had a concurrent, unrelated staged change (`CHANGELOG.md`) at the time this was discovered; running `git checkout main` in that same shared index risked interacting with that staged change or the concurrent session's in-progress work on `release-fix-beta20`. The orphan commit `dfb37a53` on `release-fix-beta20` is inert (duplicate content on a side branch nobody in this plan uses) and was left untouched rather than force-moved or deleted.
- **Recovery method:** rather than touching the shared working directory's branch/index further, an isolated `git worktree add` pointed at `main` was used to commit this SUMMARY.md safely, with zero risk to the concurrent session's checked-out branch or staged files.
- **Files affected:** none of this plan's tracked deliverables were lost; `main` (the branch this repo's CLAUDE.md workspace guard designates as canonical) has the complete, correct history.

## Known Stubs

None. This plan produces a report and a scanner script, no UI or data-flow stubs.

## Threat Flags

None. No new network endpoints, auth paths, file access patterns, or schema changes at a trust boundary were introduced; the sweep script only reads repo-controlled `skills/*/SKILL.md` files (matching the threat model's T-227-06/07/08 dispositions exactly).

## Self-Check

- `scripts/sweep-skill-descriptions.cjs` exists and runs to exit 0 with the self-test passing: FOUND
- `.planning/phases/227-ignite-mode-select-timing-across-turns-1-4-seed-060-close-in/227-SWEEP-FINDINGS.md` exists, 124 data rows, verdict counts sum to 124: FOUND
- `skills/MOSDeckEngine/SKILL.md`, `skills/client-discovery-interview/SKILL.md`, `skills/mullins-scaffold/SKILL.md` all classify `tight` under the sweep script post-fix: FOUND
- Commit `0621f36f` (scanner): FOUND in `git log --oneline --all`
- Commit `f6dda07d` (MOSDeckEngine fix): FOUND in `git log --oneline --all`
- Commit `ae822e84` (client-discovery-interview fix): FOUND in `git log --oneline --all`
- Commit `af0bac54` (mullins-scaffold fix): FOUND in `git log --oneline --all`
- Commit `39fc72f3` (227-SWEEP-FINDINGS.md, landed in a concurrent session's commit per the deviation above): FOUND in `git log --oneline --all`
- Zero em-dashes in any touched file: verified via a grep for the em-dash character returning 0 on all 5 touched files.

## Self-Check: PASSED

## Next Steps

- 227-03 and 227-04 (concurrent/upcoming plans in this phase) should re-run `node scripts/sweep-skill-descriptions.cjs` against `conversation-mode` and `larry-personality` after their own edits land, since both were deferred here specifically because they are in-flight elsewhere in this phase.
- No further sweep-driven follow-up work is queued; the SPEC boundary (fix only trivial instances, defer the rest with a reason) is fully satisfied by this plan's 3 fixes + 2 named defers.
