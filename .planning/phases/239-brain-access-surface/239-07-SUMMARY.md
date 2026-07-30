---
phase: 239-brain-access-surface
plan: 07
subsystem: security
tags: [canon-part-8, verify-release, release-gate, seam-liveness, mcp-tool-liveness, section-collision]

# Dependency graph
requires:
  - phase: 239-03
    provides: "scripts/check-brain-tool-liveness.cjs (the 0/1/2 exit-code liveness gate) and its exported functions"
provides:
  - "scripts/verify-release: new numbered section (landed as 19, not 18) invoking scripts/check-brain-tool-liveness.cjs and branching on all three of its exit states (0 pass, 1 dead-seam fail, other probe-failure fail, never a warn)"
  - "tests/test-239-verify-release-section-18.cjs: the 4-leg proof that the section reaches the real release gate's FAIL counter under a real hooks/hooks.json mutation, with a guaranteed restore and an anti-vacuity clean-tree check"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Numbered-section collision resolution: whichever phase's verify-release section lands SECOND takes the next free integer rather than overwriting the earlier phase's section; the test that proves the new section derives its own number by regex from the file, never a hardcoded literal, so a later renumbering cannot rot the test."
    - "Bite-proof test shape for a release gate: mutate the real gated config on disk, run BOTH the direct check script and the full bash release-gate script, assert both go red with the specific failure text, restore unconditionally in a finally, re-verify byte-identity against a backup held OUTSIDE the repo tree (os.tmpdir()), then re-prove both green."

key-files:
  created:
    - tests/test-239-verify-release-section-18.cjs
  modified:
    - scripts/verify-release

key-decisions:
  - "Section landed as 19, not 18. The plan's own objective flagged this as a live risk: Phase 238 (GATE-01) intended to also author a verify-release section 18. By the time this plan executed, Phase 238 had already landed on main as section 18, \"Gate Ledger Seam Gate\" (invoking scripts/check-gate-seam.cjs via checkMintRatifierLiveness). Per the plan's mandatory Task 1 first-check grep and its stated collision rule (whichever phase executes second renumbers), this plan's section took the next free integer, 19, leaving section 18 completely untouched. The test file is still named test-239-verify-release-section-18.cjs per the plan's own files_modified contract, but every assertion inside it derives the actual section number from the file by regex -- it never hardcodes 18 or 19, so this renumbering (or any future one) cannot rot the test."
  - "tests/run-all-239.sh's Leg B (\"239 test-file completeness\") will NOT show PASSED from inside this isolated worktree alone. The plan text assumed sequential single-worktree execution and states this plan lands \"the fifth and final tests/test-239-*.cjs file.\" In this actual run, execution is parallelized across isolated per-agent worktrees (per the orchestrator's parallel_execution context), and the fifth required file, tests/test-239-pii-sanitizer-liveness.cjs, is 239-04's deliverable, landing concurrently in its OWN separate worktree. From inside this worktree, that file does not exist on disk, so Leg B correctly reports FAILED (missing file), exactly as run-all-239.sh's own header documents for an unmerged sibling plan. This is expected, not a defect in this plan's work, and will resolve once the orchestrator merges both 239-04 and 239-07 back to the shared branch."

patterns-established:
  - "Any future phase adding a new numbered scripts/verify-release section should grep for the highest existing section number immediately before authoring (not trust a stale RESEARCH.md precedent claim) and derive that number in any accompanying test by regex, never a literal, exactly as this plan's Task 1 read_first mandated and Task 2's test enforces."

requirements-completed: [BRAIN-01]

# Metrics
duration: ~30min
completed: 2026-07-30
---

# Phase 239 Plan 07: Brain Tool Liveness Gate Wiring (verify-release) Summary

**The SC1 Brain-tool liveness check is now load-bearing: `scripts/verify-release` carries a new section (landed as 19, since Phase 238 claimed 18 first) that invokes `scripts/check-brain-tool-liveness.cjs` and branches on all three of its exit states, and a 4-leg test proves the gate reaches the release script's real FAIL counter under a real `hooks/hooks.json` mutation, restored unconditionally with a byte-identity check against a backup held outside the repo tree.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-07-30T12:10:00Z (approx, first file read)
- **Completed:** 2026-07-30T12:42:00Z
- **Tasks:** 2
- **Files modified:** 2 (1 modified, 1 new)

## Accomplishments

- `scripts/verify-release` gained a new numbered section that delegates to `scripts/check-brain-tool-liveness.cjs`, capturing stdout and exit code into `BRAIN_LIVENESS_OUT` / `BRAIN_LIVENESS_CODE`, mirroring the section 16/17 shape exactly (banner comment, `echo` header, capture, branch).
- The section has THREE branches, not two: exit 0 -> `pass`, exit 1 -> `fail` naming the dead-seam cause, any other exit -> `fail` naming a probe failure. No `warn` arm exists anywhere in the section, so a liveness probe that cannot run is treated as a failure, never a soft signal (Phase 235 Decision (c)).
- The insertion is additive only: `git diff --stat scripts/verify-release` showed `36 insertions(+)`, zero deletions, zero modifications to any of sections 1-18 or the SUMMARY block.
- `tests/test-239-verify-release-section-18.cjs` proves the section bites: LEG 3 rewrote the live hook-matcher literal in the real `hooks/hooks.json` to the superseded `mcp__brain_.*` form, observed both `node scripts/check-brain-tool-liveness.cjs` (exit 1) and the FULL `bash scripts/verify-release` (non-zero exit, stdout containing both the section header and the exact `Brain tool liveness gate FAILED` line) go red, then restored the file unconditionally in a `finally` and re-verified byte-identity against a backup held in `os.tmpdir()` (outside the repo tree), then re-proved both green.
- LEG 4 proved the section is not vacuously red-or-green: a clean-tree `bash scripts/verify-release` run shows the exact pass text, `Every Brain hook matcher and agent allowed-tools entry names a live MCP tool`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Author the verify-release Brain Tool Liveness Gate section** - `a75ca98a` (feat)
2. **Task 2: Author tests/test-239-verify-release-section-18.cjs and prove the gate bites end to end** - `0eb737ac` (test)

_No TDD tasks in this plan; both are `type="auto"` per the plan frontmatter._

## Files Created/Modified

- `scripts/verify-release` - New section (36 lines) invoking `scripts/check-brain-tool-liveness.cjs`, inserted after section 18 (Kuzu... no, after section 18 "Gate Ledger Seam Gate") and before the unnumbered PACKAGE-LOCK SYNC section. Landed as section **19**.
- `tests/test-239-verify-release-section-18.cjs` - New, 267 lines, 4 legs, all passing. Filename retained per the plan's `files_modified` contract even though the section itself landed as 19; every assertion derives the actual section number by regex.

## Mandatory First-Check Grep Results (Task 1 read_first requirement)

Run BEFORE writing anything, per the plan's mandatory first check:

```
$ grep -n "^# 1[89]\.\|^# 2[0-9]\." scripts/verify-release
477:# 18. GATE LEDGER SEAM GATE

$ grep -n "MintRatifier\|seam-liveness" scripts/verify-release
482:# the dead-seam shape lib/core/seam-liveness.cjs (Phase 235) was built to
484:# a seam-liveness call living only inside a test file is the exact "wired
488:# frozen ratifiable-kinds list via checkMintRatifierLiveness -- exit 1 on a
```

**Result: Phase 238 HAD already landed section 18** ("Gate Ledger Seam Gate", invoking `scripts/check-gate-seam.cjs` via `checkMintRatifierLiveness`) by the time this plan executed, contradicting the plan's own objective text which described Phase 238 as "PLANNED but NOT EXECUTED" at research time. Per the plan's stated collision rule (whichever phase executes second renumbers, never overwrites), this plan's new section took the next free integer: **19**. Section 18 was left completely untouched (confirmed: `git diff scripts/verify-release` shows zero changes to any line before the insertion point).

## Task 1 Acceptance Criteria (all confirmed)

- `bash -n scripts/verify-release` exits 0.
- `grep -c "check-brain-tool-liveness.cjs" scripts/verify-release` returns exactly 1.
- Section ordering: `17. Kuzu Reintroduction Gate` at line 466, `19. Brain Tool Liveness Gate` echo header at line 524, `PACKAGE-LOCK SYNC` at line 538. Section 19 sits after 17 (and after 18, at line ~491) and before PACKAGE-LOCK SYNC, as required.
- `grep -c "BRAIN_LIVENESS_CODE" scripts/verify-release` returns 3 (capture + 2 branch conditionals); both `fail "` arms present.
- `git diff --stat scripts/verify-release` -> `1 file changed, 36 insertions(+)` -- insertion only, zero deletions.
- `node scripts/check-brain-tool-liveness.cjs` exits 0 on the current tree, unchanged by this task.
- `grep -cP '\x{2014}' scripts/verify-release` returns 0 (no em-dashes).

## Task 2 Acceptance Criteria (all confirmed)

- `node tests/test-239-verify-release-section-18.cjs` exits 0, all four legs PASSED.
- `git diff --stat hooks/hooks.json` is EMPTY at the end of the plan (confirmed via `git status --porcelain` showing no hooks.json entry after the full test run).
- `grep -cE "'18'|\"18\"|== *18" tests/test-239-verify-release-section-18.cjs` returns 0 (no hardcoded section-number literal).
- `grep -cP '\x{2014}' tests/test-239-verify-release-section-18.cjs` returns 0.

## LEG 3 Transcript (the bite proof, as required by the plan's acceptance criteria)

```
check-brain-tool-liveness.cjs status under mutation = 1 (expected 1)
verify-release exit status under mutation = 1 (expected non-zero)
post-restore byte-identity confirmed (in-memory copy AND outside-repo backup)
post-restore check-brain-tool-liveness.cjs status = 0 (expected 0)
```

The exact `verify-release` stdout line observed under mutation: `Brain tool liveness gate FAILED (a hook matcher or agent allowed-tools entry names a Brain tool that does not exist):` -- confirmed present via a direct `indexOf` assertion on the captured stdout+stderr.

## LEG 4 Transcript (anti-vacuity, clean tree)

```
clean-tree verify-release exit status = 0
note: no other section failures observed on the clean-tree run
```

A full clean-tree `bash scripts/verify-release` run outside the test harness (captured separately as acceptance evidence) reported `31 passed, 0 failed, 3 warnings (34 checks)` -- `CLEAR TO RELEASE`. The 3 pre-existing warnings are unrelated to this plan and predate it:

| Warning | Section | Why pre-existing / unrelated |
|---------|---------|-------------------------------|
| "Command-registration preconditions clean; 37 render-quality warning(s)" | 7b | Command-frontmatter render-quality lint, unrelated to Brain-access or release-gate wiring; a standing repo-wide count independent of this plan's two touched files |
| "1 uncommitted changes in plugin repo" | 12 (Git State) | Reflects this session's own in-progress worktree state during verification, not a defect this plan introduced |
| "CHANGELOG.md has no entry for v1.15.3-beta.51" | 13 (Changelog) | This plan does not bump versions or touch CHANGELOG.md; release-version bookkeeping is out of this plan's scope (`scripts/release.sh` owns it) |

No `FAIL` was observed on any section other than the intentional LEG 3 mutation of the new section itself; every other check passed on both the pre-task and post-task clean-tree runs.

## Decisions Made

See frontmatter `key-decisions`. Two are load-bearing enough to restate:

1. **Section collision resolved: landed as 19, not 18.** Phase 238 had already claimed section 18 on `main` by the time this plan executed (contradicting the plan's own research-time assumption that Phase 238 was "PLANNED but NOT EXECUTED"). The plan's own Task 1 mandatory first-check grep and stated collision-resolution rule handled this cleanly: renumber to the next free integer, leave the earlier section untouched. The test file's name (`test-239-verify-release-section-18.cjs`) was kept as specified in `files_modified`, but its internal assertions derive the section's real number (19) by regex, so this or any future renumbering cannot rot the test.
2. **Leg B of `tests/run-all-239.sh` will not show green from inside this worktree alone.** The plan text (written under a single-worktree sequential-execution assumption) states this plan "lands the fifth and final `tests/test-239-*.cjs` file," implying `run-all-239.sh`'s "239 test-file completeness" leg would flip to PASSED. In the actual parallel-worktree execution model used for this wave, `tests/test-239-pii-sanitizer-liveness.cjs` is plan 239-04's deliverable and lands in 239-04's own separate worktree, concurrently with this plan. From inside this worktree that file does not exist, so Leg B correctly reports FAILED with "missing: tests/test-239-pii-sanitizer-liveness.cjs" -- exactly the behavior `run-all-239.sh`'s own header comments document for an unmerged sibling plan. This resolves once the orchestrator merges both worktrees back to the shared branch; it is not a defect introduced by this plan's work, and every one of this plan's OWN acceptance criteria (all listed above) passed cleanly in isolation.

## Deviations from Plan

### Auto-fixed Issues

None. Both tasks executed exactly as specified once the section-number collision (already anticipated and handled by the plan's own Task 1 instructions) was resolved.

### Verification-mechanics notes (not code deviations)

**1. Transient npm self-heal artifact reverted before any task commit.** Before starting Task 1, `git status --porcelain` showed a stray `M package-lock.json` diff (a version-stamp bump from `1.15.3-beta.11` to a later beta and an `engines.node` floor change) matching the exact transient npm self-heal pattern documented in 239-03-SUMMARY.md. This file is not in this plan's `files_modified`; it was reverted with `git checkout -- package-lock.json` before any edit, per the 239-03 precedent, and did not recur during this plan's execution.

**2. Mutation-serialization fence rules assumed a shared working tree; actual execution is worktree-isolated.** The plan's objective text carries an extensive "MUTATION SERIALIZATION FENCE" section predicated on `.planning/config.json`'s `workflow.use_worktrees: false`, assuming this plan and sibling 239-04 would share one physical working tree and could observe each other's in-flight mutations via `git status --porcelain`. The actual orchestrator context for this execution states plainly that this plan and 239-04 each run in their OWN separate git worktree. This makes the plan's five numbered serialization rules (checking for a dirty sibling file before every mutation, holding the mutation window short, restoring in a `finally`, recording `git status --porcelain` before each `verify-release` run, re-running once on a red before reporting) moot as written -- there is no shared filesystem for a sibling's mutation to appear on. The underlying safety property (never leave a mutation on disk, always restore, always verify byte-identity) was still fully honored for LEG 3's `hooks/hooks.json` mutation, using worktree isolation as the actual serialization mechanism instead of the git-status-polling protocol the plan text described. `git status --porcelain` was checked immediately before and after every mutation and every `verify-release` invocation in this worktree; it showed only this plan's own intended changes at every checkpoint.

## Issues Encountered

None blocking.

## User Setup Required

None. No external service configuration required. This plan touches only `scripts/verify-release` and a new test file; the mutation leg operates entirely on the already-tracked `hooks/hooks.json` and restores it unconditionally.

## Known Stubs

None. No hardcoded empty values, placeholder text, or unwired data sources were introduced.

## Threat Flags

None. This plan's `<threat_model>` in `239-07-PLAN.md` is fully addressed by the delivered artifacts:

- T-239-T1 (hook matchers surviving a future rename): mitigated -- the new section calls `scripts/check-brain-tool-liveness.cjs` and the `fail` helper, which increments `FAIL`, which makes the SUMMARY block exit 1. LEG 3 proved this live.
- T-239-07-A (a gate that degrades to a warning when it cannot measure): mitigated -- the exit-2 probe-failure arm calls `fail`, not `warn`; confirmed by LEG 2's assertion that no `warn "Brain tool liveness` call exists anywhere in the section.
- T-239-07-B (a gate that fails unconditionally): mitigated -- LEG 4 proved the clean tree produces the `pass` text.
- T-239-07-C (a mutation left behind on a shared working tree): mitigated -- LEG 3's mutation is wrapped in `try/finally` with an unconditional restore from a backup held outside the repo tree (`os.tmpdir()`), followed by a byte-identity assertion against BOTH the in-memory original and the outside-repo backup, and `git diff --stat hooks/hooks.json` is empty at the end of the plan.
- T-239-07-D (section-number collision with Phase 238): mitigated -- Task 1's mandatory first-check grep found Phase 238's section 18 already on disk and this plan's section took the next free integer (19); LEG 1 derives the section number by regex rather than asserting a literal, so the renumbering (or a future one) cannot rot the test.
- T-239-SC (npm/pip/cargo installs): accepted, correctly -- zero packages installed by this plan.

No new network endpoints, auth paths, or schema changes were introduced. `scripts/verify-release`'s new section reads existing repo files via the already-shipped `scripts/check-brain-tool-liveness.cjs`; it makes zero outbound network calls of its own (the Brain MCP handshake it drives is local stdio, offline).

## Next Phase Readiness

- This is the final plan of the final wave of Phase 239. Once this plan and sibling 239-04 both land and are merged back to the shared branch, `bash tests/run-all-239.sh` should report all legs PASSED (Leg B included, since `tests/test-239-pii-sanitizer-liveness.cjs` will then exist alongside this plan's `tests/test-239-verify-release-section-18.cjs`).
- No blockers. This plan's cross-phase scope fence held: zero files claimed by Phase 237 or Phase 238 were touched (`scripts/check-gate-seam.cjs` and section 18 were read but never modified). Its cross-plan scope fence also held: only `scripts/verify-release` and `tests/test-239-verify-release-section-18.cjs` were touched, matching this plan's own `files_modified` exactly.

## Release Liveness (standing hard rule, restated per plan instruction)

`scripts/verify-release` and `tests/test-239-verify-release-section-18.cjs` are dev-time/CI/release-gate artifacts; the new section changes what a release-cutter sees when running `scripts/verify-release` locally, but it carries no user-facing runtime behavior change on its own and is not something an installed user's plugin cache picks up. As with every other Phase 239 plan, none of Phase 239's fixes are live for any installed user until a release ships AND that user runs `/plugin marketplace update` followed by `claude plugin update mos@mindrian-marketplace`. `~/.claude/plugins/mos/` install caches and `dist/` still carry pre-Phase-239 state until then.

## Cross-Phase Reconciliation Note (restated per plan instruction)

Phase 238 plan 238-06 landed a `verify-release` section 18 ("Gate Ledger Seam Gate") before this plan executed. This plan's own section took the next free integer, 19, per the plan's stated collision-resolution rule. No file or line belonging to Phase 238's section was touched; `git diff scripts/verify-release` for this plan's commits shows insertions only, all located strictly after section 18's closing block.

---
*Phase: 239-brain-access-surface*
*Completed: 2026-07-30*

## Self-Check: PASSED

- FOUND: scripts/verify-release
- FOUND: tests/test-239-verify-release-section-18.cjs
- FOUND: .planning/phases/239-brain-access-surface/239-07-SUMMARY.md
- FOUND: commit a75ca98a (Task 1)
- FOUND: commit 0eb737ac (Task 2)
