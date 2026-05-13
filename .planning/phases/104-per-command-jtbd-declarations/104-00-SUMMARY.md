---
phase: 104-per-command-jtbd-declarations
plan: "00"
subsystem: substrate
tags: [wave-0, jtbd, requirements-registration, roadmap-entry, test-stubs, feynman-runner, recovery]

# Dependency graph
requires:
  - phase: 100-jtbd-inference-engine
    provides: jtbd-taxonomy.json (13 canonical JTBD ids the declarations must resolve against)
  - phase: 101-selector-library-jtbd-aware
    provides: selector-dispatcher.cjs (consumer of serves_jtbd; routes F.6 vs F.1)
provides:
  - JTBDCONS-104-01..05 requirement IDs in REQUIREMENTS.md (5 IDs + 5 traceability rows)
  - Phase 104 entry in ROADMAP.md (Goal + Requirements + 4-plan list)
  - 3 Wave-0 test stubs at tests/test-command-jtbd-{declarations,coverage,backward-compat}.cjs
  - Feynman runner registration for the 3 stubs in lib/memory/run-feynman-tests.cjs
  - Test substrate plans 104-01/02/03 can flip RED -> GREEN against without scaffolding invention
affects: [phase-104-01, phase-104-02, phase-104-03, phase-106-release-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wave-0 stub pattern: BSL 1.1 header + 'use strict' IIFE + canonical 'Phase NN Wave 0 stub - to be implemented by plan NN-NN' line + exit 0; cloned from Phase 100-00 / 105-00 precedent (Canon Part 7 reuse-before-build)"
    - "REQUIREMENTS.md anchor: insert new H2 block immediately BEFORE the trailing '## Traceability' H2 (preserves chronological phase ordering)"
    - "ROADMAP.md anchor: append-only after the last existing phase entry (no reordering, no overwrite of prior text)"
    - "Run-Feynman-Tests registry: append new path.join entries immediately before the trailing '];' close of TEST_FILES; existing entries preserved byte-identical"
    - "Retroactive SUMMARY filing for substrate plans whose deliverables landed via in-line fix-up commits rather than a single dedicated plan commit (mirrors Phases 109-00/01/07/09)"

key-files:
  created:
    - tests/test-command-jtbd-declarations.cjs (Wave-0 stub; filled by 104-02)
    - tests/test-command-jtbd-coverage.cjs (Wave-0 stub; filled by 104-02)
    - tests/test-command-jtbd-backward-compat.cjs (Wave-0 stub; filled by 104-03)
    - .planning/phases/104-per-command-jtbd-declarations/104-00-SUMMARY.md (this file)
  modified:
    - .planning/REQUIREMENTS.md (JTBDCONS-104 H2 block + 5 traceability rows; later flipped to Complete in 77acc38)
    - .planning/ROADMAP.md (Phase 104 entry appended; later flipped to 4/4 in 77acc38)
    - lib/memory/run-feynman-tests.cjs (3 new entries in TEST_FILES + Phase 104-00 Wave-0 comment block)
    - commands/auto-explore.md (serves_jtbd: added during retroactive close-out; see Deviations section)

key-decisions:
  - "REQ-IDs scoped to JTBDCONS-104-01..05 to match the five Phase 104 deliverables (sweep + decision matrix + every-command-declares test + every-JTBD-has-1-command test + Wave-0 substrate). Decision sourced from CONTEXT D-05 + Phase 104 plan-tree."
  - "Wave-0 stubs use HYPHEN, not em-dash, per project hard rule (~/.claude/projects/-home-jsagi/memory/feedback_no_emdashes.md). Stub canonical line: 'Phase 104 Wave 0 stub - to be implemented by plan 104-NN'."
  - "Zero new runtime dependencies introduced (Phase 87 invariant). Node built-ins only across the 3 stubs and the registry comment block."
  - "Retroactive SUMMARY filing pattern (this commit): substrate plans whose deliverables landed via small in-line commits on main (a7f4950 / 451deb8 / 37545ec) rather than a single docs(104-00) complete commit get their SUMMARY filed after the downstream plans (104-01/02/03) have already shipped. Mirrors Phases 109-00/01/07/09 archived-worktree pattern."

patterns-established:
  - "Substrate-plan-retroactive-SUMMARY: when a Wave-0 substrate plan's deliverables land in-line on main rather than via a single dedicated commit, the SUMMARY is filed retroactively (after the downstream plans close) and documents (a) the in-line commits, (b) any regression fixes that close out the remaining substrate gap, (c) all 3 test-substrate paths going green at the moment the SUMMARY lands."
  - "Out-of-band-frontmatter-recovery: when a new command file is added by a downstream phase AFTER the per-command convention sweep, the convention is reapplied to the new file as a recovery commit scoped to the substrate plan (here: fix(104-00) on commands/auto-explore.md). The downstream plan that added the file is referenced in the commit message for traceability."

requirements-completed: [JTBDCONS-104-01, JTBDCONS-104-02, JTBDCONS-104-03, JTBDCONS-104-04, JTBDCONS-104-05]

# Metrics
duration: ~25min (recovery session; original substrate work landed across the prior week of 104-00..03 plan execution)
completed: 2026-05-13
---

# Phase 104 Plan 00: Wave-0 Substrate (Recovery) Summary

**Filed the JTBDCONS-104-01..05 REQ-IDs in REQUIREMENTS.md, added the Phase 104 entry to ROADMAP.md, landed 3 Wave-0 test stubs in tests/, registered them in lib/memory/run-feynman-tests.cjs, AND closed the last regression in commands/auto-explore.md so all 3 jtbd tests go green at the moment Phase 104-00 finalizes.**

## What this plan owns

Phase 104-00 is the Wave-0 substrate for the per-command JTBD declarations cluster. Its job is NOT the sweep (that's 104-01), NOT the verification tests (that's 104-02), and NOT the backward-compat fence (that's 104-03). Its job is to land the foundation so the three downstream plans can flip RED -> GREEN against an already-registered substrate:

1. REQ-IDs registered in `.planning/REQUIREMENTS.md` so downstream plans' frontmatter `requirements:` fields resolve.
2. ROADMAP entry in `.planning/ROADMAP.md` so the phase is visible in the milestone view.
3. 3 Wave-0 test stubs on disk at `tests/test-command-jtbd-{declarations,coverage,backward-compat}.cjs`, each exiting 0 with the canonical "Phase 104 Wave 0 stub" line.
4. Registry extension in `lib/memory/run-feynman-tests.cjs` so the Feynman runner picks the 3 stubs up immediately and the runner stays GREEN while 104-01/02/03 land.

## Why this is a retroactive SUMMARY

The 104-00 deliverables shipped on main in the week of 2026-05-01..02 but never got a single `docs(104-00): complete` commit + SUMMARY pair. The work landed in three independent in-line commits:

- `451deb8 feat(104-00): register JTBDCONS-104-01..05 requirement IDs` (REQUIREMENTS.md, 2026-05-02)
- `37545ec feat(104-00): append Phase 104 entry to ROADMAP.md` (ROADMAP.md, 2026-05-02)
- `a7f4950 feat(104-00): land 3 Wave-0 stubs + register in Feynman runner` (3 stubs + lib/memory/run-feynman-tests.cjs, 2026-05-02)

The downstream plans then filled the stubs:

- `911b9af docs(104-01): complete per-command JTBD declarations plan` (sweep + 81/84 new declarations + 104-01-SUMMARY.md)
- `5d176a5 docs(104-02): complete verification harness plan` (real tests at declarations + coverage; 104-02-SUMMARY.md)
- `9fd2203 docs(104-03): complete backward-compat regression fence + v1.12.4 CHANGELOG plan` (real backward-compat test + CHANGELOG bundled entry; 104-03-SUMMARY.md)

This SUMMARY is filed 2026-05-13 as part of the Phase 104 close-out sweep. Mirrors the archived-worktree pattern used for Phases 109-00/01/07/09 (substrate plans whose SUMMARYs landed after the downstream plans had already closed).

## The remaining regression that gates Phase 104 close

When the substrate was filed in early May the convention was: every `commands/*.md` declares `serves_jtbd:`. The 104-01 sweep landed that convention across all then-84 commands. On 2026-05-07, Phase 117-03 added a new file -- `commands/auto-explore.md` (the Desktop fallback for the triple-filter auto-explore pipeline) -- in commit `8c86a8f`. Because 117-03 predated the convention being recognized as part of the post-add checklist, the new file went out WITHOUT `serves_jtbd:` declared.

Result: from 2026-05-07 forward, `node tests/test-command-jtbd-declarations.cjs` FAILED on main with `commands/auto-explore.md -> missing required serves_jtbd: field in frontmatter`. The other two jtbd tests stayed green (coverage doesn't notice an undeclared command; backward-compat doesn't read commands/ at all), but the declarations test was RED.

This SUMMARY's filing session closes that regression as part of the substrate close-out:

- `1821833 fix(104-00): add missing serves_jtbd to auto-explore.md (regression from Phase 117-03 post-sweep add)` -- adds `serves_jtbd: ["find-problem", "understand-market", "explore"]` to the frontmatter of `commands/auto-explore.md`. Body unchanged byte-for-byte. The triple matches `/mos:explore-domains` (the closest canonical analogue per the 104-CONTEXT.md mapping matrix and per the Phase 117-03 RESEARCH.md note at line 144 -- Phase 117's own research cites the same triple as the canonical declaration shape for the auto-explore class).

After this commit:

- `node tests/test-command-jtbd-declarations.cjs` -> `85/85 ok, exit 0` (was: 1 violation, exit 1)
- `node tests/test-command-jtbd-coverage.cjs` -> `13/13 ok, exit 0; explore served by 23 commands` (was: 22 commands)
- `node tests/test-command-jtbd-backward-compat.cjs` -> `8/8 PASS, exit 0` (unchanged)
- `node scripts/build-command-registry.cjs --check` -> `OK, exit 0` (auto-explore.md is a utility command; frameworks/kind defaults are handled by the generator)
- `bash tests/run-all-110.sh` -> `4/4 PASS, 0 FAIL` (Phase 110 sanity)

## Task Commits

The original substrate work (May 2026):

1. **Task 1: Append JTBDCONS-104 block + 5 traceability rows to REQUIREMENTS.md** -- `451deb8` (feat) -- 5 IDs registered, anchored immediately before `## Traceability`.
2. **Task 2: Append Phase 104 header to ROADMAP.md** -- `37545ec` (feat) -- Phase 104 entry with Goal + Requirements + 4-plan list, appended after the prior last entry.
3. **Task 3 + Task 4: Create 3 Wave-0 stubs + register in Feynman runner** -- `a7f4950` (feat) -- 3 stubs at `tests/test-command-jtbd-{declarations,coverage,backward-compat}.cjs` + Phase 104-00 Wave-0 comment block in `lib/memory/run-feynman-tests.cjs`. Single commit because the original 104-00 spawning agent returned mid-task with Tasks 1+2 done and Tasks 3+4 not done; the in-line fix-up filed both atomically.

The recovery work (this session, 2026-05-13):

4. **Recovery: fix auto-explore.md frontmatter regression** -- `1821833` (fix) -- added `serves_jtbd: ["find-problem", "understand-market", "explore"]` to `commands/auto-explore.md` frontmatter. Body unchanged. Closes the declarations-test regression that had been live since 2026-05-07.
5. **Recovery: flip JTBDCONS-104 ledger to Complete + ROADMAP plan progress 4/4** -- `77acc38` (docs) -- all 5 JTBDCONS-104-NN entries in REQUIREMENTS.md flipped from `[ ]` to `[x]` (checklist + traceability table); ROADMAP.md Phase 104 flipped from `3/4 plans complete` to `4/4 plans complete`; all 4 plan checkboxes flipped.

**Plan metadata commit:** filed with this SUMMARY commit (`docs(104-00): complete plan 00 -- retroactive Wave-0 substrate SUMMARY`).

## Files Created/Modified (cumulative across original + recovery)

- `.planning/REQUIREMENTS.md` -- JTBDCONS-104 H2 block (5 IDs as `[x]`) + 5 traceability rows (all Complete).
- `.planning/ROADMAP.md` -- Phase 104 entry (Goal + Requirements + 4/4 plan list, all `[x]`).
- `tests/test-command-jtbd-declarations.cjs` -- Wave-0 stub on disk; 104-02 swapped body in to a real every-command-declares test that asserts 85/85 commands carry valid serves_jtbd against the 13-id closed vocabulary.
- `tests/test-command-jtbd-coverage.cjs` -- Wave-0 stub on disk; 104-02 swapped body in to a real every-JTBD-has-1-command coverage test that asserts all 13 canonical IDs appear in at least one command.
- `tests/test-command-jtbd-backward-compat.cjs` -- Wave-0 stub on disk; 104-03 swapped body in to a real backward-compat regression fence that asserts the selector-dispatcher falls through to F.1 (not F.6, not crash) when no serves_jtbd is declared.
- `lib/memory/run-feynman-tests.cjs` -- 3 entries in TEST_FILES + Phase 104-00 Wave-0 comment block documenting the JTBDCONS-104-NN mapping.
- `commands/auto-explore.md` -- frontmatter gains `serves_jtbd:` line; body unchanged byte-for-byte.
- `.planning/phases/104-per-command-jtbd-declarations/104-00-SUMMARY.md` -- this file.

## Decisions Made

- **REQ-ID scoping to 5 IDs.** Phase 104 has five first-class deliverables per CONTEXT D-05 (sweep + decision matrix + every-command-declares test + every-JTBD-has-1-command test + Wave-0 substrate). One ID per deliverable. The mapping to downstream plans is documented in REQUIREMENTS.md's JTBDCONS-104 block.
- **Stub canonical line uses hyphen, not em-dash.** Project hard rule per `~/.claude/projects/-home-jsagi/memory/feedback_no_emdashes.md`: NEVER use em-dashes. The three stubs each print `Phase 104 Wave 0 stub - to be implemented by plan 104-NN`.
- **Zero new runtime deps.** Phase 87 invariant. The 3 stubs use only built-ins (process, console). Feynman-runner registry comment block adds prose, not a require.
- **auto-explore.md serves_jtbd choice.** `["find-problem", "understand-market", "explore"]` -- mirrors `/mos:explore-domains` (the closest canonical analogue per 104-CONTEXT.md mapping matrix line 96 and per Phase 117-03 RESEARCH.md line 144). auto-explore.md is the Desktop fallback for the same triple-filter auto-explore pipeline that explore-domains conversationally fronts; surfacing material findings before any specific JTBD is known places it in the explore-class steady state.
- **Retroactive SUMMARY pattern.** Mirrors Phases 109-00/01/07/09. When substrate work lands via in-line fix-up commits rather than a single dedicated plan commit, the SUMMARY is filed after the downstream plans close, documents the chronology, and lists the post-hoc regression fixes that close the substrate gap.

## Deviations from Plan

**1. [Rule 2 - Auto-add missing critical functionality] auto-explore.md frontmatter regression closed**

- **Found during:** Pre-execution check before filing the retroactive SUMMARY -- `node tests/test-command-jtbd-declarations.cjs` failed on main with 1 violation on `commands/auto-explore.md`.
- **Issue:** Phase 117-03 (commit 8c86a8f, 2026-05-07) added `commands/auto-explore.md` AFTER Phase 104-01's mass sweep. The new file went out without a `serves_jtbd:` declaration, which is a violation of the convention 104-01 established (every commands/*.md MUST declare). The declarations test had been RED on main from 2026-05-07 forward.
- **Fix:** Added one line to the frontmatter: `serves_jtbd: ["find-problem", "understand-market", "explore"]`. Body unchanged byte-for-byte. Closed in commit `1821833`.
- **Files modified:** `commands/auto-explore.md`
- **Verification:** All 3 jtbd tests now exit 0; coverage shows `explore served by 23 commands` (was 22 -- delta is auto-explore.md). Build-command-registry `--check` still OK (utility commands default to frameworks=[] which the generator handles).

**2. [Scope Boundary] Pre-existing Phase 88.7 ROADMAP "1/1 plans complete" lie NOT auto-fixed**

- **Found during:** Reading STATE.md for context (line 301 references Phase 121.5 sub-plan G which calls out this lie).
- **Issue:** ROADMAP.md Phase 88.7 entry claims "1/1 plans complete" but only `scripts/power-demo-prompt.md` exists and `commands/power-demo.md` does not. This is unrelated to Phase 104 close-out.
- **Resolution:** Per deviation rules SCOPE BOUNDARY (Only auto-fix issues DIRECTLY caused by the current task's changes), this is out of scope for Plan 104-00. Phase 121.5 sub-plan G owns this fix.
- **Files modified:** None.

---

**Total deviations:** 1 in-scope auto-fix (Rule 2) + 1 out-of-scope observation logged for visibility.
**Impact on plan:** Zero scope creep. Substrate plan close-out completes cleanly with all 5 REQ-IDs Complete and the 3 jtbd tests green.

## Issues Encountered

- The original 104-00 spawning agent (2026-05-02) returned mid-task after committing REQUIREMENTS.md + ROADMAP.md (Tasks 1+2) but before Task 3 (stubs) + Task 4 (registry registration). Recovery was filed in-line at commit `a7f4950` -- the substrate landed but never got a docs(104-00) complete commit + SUMMARY pair. This SUMMARY closes that gap retroactively.
- Phase 117-03's add of `commands/auto-explore.md` on 2026-05-07 was the second slippage: the new file went out without honoring the convention established by Phase 104-01's sweep. The declarations test had been RED on main from 2026-05-07 until this session's `1821833` recovery commit.

## User Setup Required

None. Substrate + recovery is a pure local edit.

## Next Phase Readiness

- Phase 104 substrate work fully closed: 5/5 REQ-IDs Complete, 4/4 plans Complete, all 3 jtbd tests green, build-command-registry --check OK.
- The orchestrator will run `gsd-tools phase complete 104` after this SUMMARY commit lands. After that, Phase 104 is fully closed.
- Phase 122 (workflow-layer) introduced new frontmatter fields (`kind`, `frameworks`, `produces`, `inputs`, `autonomous_safe`) on top of `serves_jtbd`. The auto-explore.md fix in `1821833` did NOT add those Phase 122 fields because they are not required by the registry generator's `--check` mode (utility commands default to `frameworks: []` cleanly). If a future phase mandates that ALL commands declare the Phase 122 quintuple, a follow-up sweep (analogous to 104-01 but for Phase 122's new fields) will be required. That sweep is out of scope for Plan 104-00.
- Future convention drift on `commands/*.md` (new files added without `serves_jtbd:`) will fail `node tests/test-command-jtbd-declarations.cjs` at commit time via the Feynman runner. The 2026-05-07..2026-05-13 window was uncaught only because the Feynman runner does not run in pre-commit; running it explicitly before every release gate is the recommended mitigation.

## Cross-references

- **Substrate commits:** `451deb8` (REQUIREMENTS.md), `37545ec` (ROADMAP.md), `a7f4950` (3 stubs + Feynman runner registry).
- **Recovery commits (this session):** `1821833` (auto-explore.md frontmatter), `77acc38` (REQUIREMENTS.md + ROADMAP.md flipped to Complete).
- **Downstream Plan SUMMARYs:** `.planning/phases/104-per-command-jtbd-declarations/104-01-SUMMARY.md` (sweep), `.planning/phases/104-per-command-jtbd-declarations/104-02-SUMMARY.md` (verification harness), `.planning/phases/104-per-command-jtbd-declarations/104-03-SUMMARY.md` (backward-compat fence + v1.12.4 CHANGELOG).
- **Canon ties:** Canon Part 3 (Tri-Context Decision Gate, JTBD-aware dispatch); Canon Part 7 (Reuse Before Build, stub-pattern reused from Phase 100-00 / 105-00); Canon Part 8 (Graph Boundary, declarations are LOCAL frontmatter and never queried against Brain).
- **Predecessor substrate pattern:** Phases 109-00/01/07/09 -- substrate plans whose SUMMARYs landed after the downstream plans had already closed.

---
*Phase: 104-per-command-jtbd-declarations*
*Plan: 00*
*Completed: 2026-05-13 (retroactive)*

## Self-Check: PASSED

- `.planning/REQUIREMENTS.md` (JTBDCONS-104 block + 5 [x] entries + 5 Complete traceability rows): FOUND
- `.planning/ROADMAP.md` (Phase 104 entry, 4/4 plans complete, all 4 plan rows [x]): FOUND
- `tests/test-command-jtbd-declarations.cjs`: FOUND (real test from 104-02; passes 85/85 today)
- `tests/test-command-jtbd-coverage.cjs`: FOUND (real test from 104-02; passes 13/13 today)
- `tests/test-command-jtbd-backward-compat.cjs`: FOUND (real test from 104-03; passes 8/8 today)
- `lib/memory/run-feynman-tests.cjs` registry entries: FOUND (3 path.join entries present)
- `commands/auto-explore.md` serves_jtbd: FOUND (line 4: `serves_jtbd: ["find-problem", "understand-market", "explore"]`)
- Commit a7f4950 (substrate stubs + Feynman runner registry): FOUND in git log
- Commit 451deb8 (REQUIREMENTS.md JTBDCONS-104 block): FOUND in git log
- Commit 37545ec (ROADMAP.md Phase 104 entry): FOUND in git log
- Commit 1821833 (auto-explore.md frontmatter recovery): FOUND in git log
- Commit 77acc38 (ledger flip to Complete): FOUND in git log
- Zero em-dashes in this SUMMARY: VERIFIED (grep for U+2014 in file body returns 0; this self-check line uses the codepoint name to avoid embedding the character)
- Zero new runtime deps: VERIFIED (no package.json change in any of the cited commits)
