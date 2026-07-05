---
phase: quick-260705-sy9
plan: 01
subsystem: infra
tags: [git-hooks, pre-commit, doctor-acceptance, verify-release, skill-mirrors, CIRS]

requires:
  - phase: 260705-ob7
    provides: scripts/build-skill-mirrors.cjs write/--check modes, the 106-mirror Windows commands-registration workaround
provides:
  - build-skill-mirrors.cjs --check enforced at pre-commit (tracked + installed hook), verify-release, and doctor --acceptance
  - checkSkipList() hardening: trending-to-absurd cannot silently vanish or be flattened to a plain copy of its command
  - tests/test-skill-mirrors-tripwire.cjs wiring proof + trigger-regex + SKIP_LIST synthetic cases
affects: [pre-commit-hook-family, verify-release, doctor-acceptance, skills-mirroring]

tech-stack:
  added: []
  patterns:
    - "coverage-gate organ fold-in: a new blocker-severity gate joins gates[] as a sibling instead of a new acceptance point (Phase 178-03 render-gate precedent)"
    - "lettered verify-release substep (10b) placed after its thematically related numbered section (260705-jeq 7b precedent)"

key-files:
  created:
    - tests/test-skill-mirrors-tripwire.cjs
  modified:
    - scripts/build-skill-mirrors.cjs
    - scripts/hooks/pre-commit
    - scripts/install-pre-commit.sh
    - scripts/verify-release
    - scripts/doctor.cjs
    - skills/help/SKILL.md
    - skills/ingest-methodology/SKILL.md
    - skills/stance/SKILL.md

key-decisions:
  - "Doctor acceptance: skill-mirrors folds into the existing coverage-gate point as a gates[] sibling, not a new acceptance point -- doctor stays 14/14"
  - "verify-release: new lettered substep 10b (Skill Mirrors) placed immediately after section 10 (Skills), mirroring the 260705-jeq step-7b convention"
  - "Included 3 pre-existing stale mirrors (help, ingest-methodology, stance) in this commit after coordinator-approved Option A -- regenerating via the tool's own write mode is the correct fix, not scope creep, and proves the new gate catches real drift on its first run"

requirements-completed: ["260705-sy9"]

duration: ~25min
completed: 2026-07-05
---

# Quick Task 260705-sy9: Wire build-skill-mirrors --check into pre-commit, verify-release, doctor Summary

**build-skill-mirrors --check is now HARD-FAIL wired into pre-commit (tracked + installed hook + installer), verify-release step 10b, and doctor --acceptance's existing coverage-gate point; SKIP_LIST hardening (checkSkipList) protects the hand-authored trending-to-absurd skill from silent deletion or flattening.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-07-05T21:06:07+03:00
- **Tasks:** 4
- **Files modified:** 8 modified + 1 created = 9 total

## Accomplishments

- `scripts/build-skill-mirrors.cjs` now exports `checkSkipList()` (verifies the SKIP_LIST skill exists AND stays genuinely divergent from its command), wires that into `checkMirrors()`, and exposes `module.exports` + a `require.main` guard so the module is safely requireable by tests without side effects.
- A commands/*.md or skills/*/SKILL.md staged change is rejected at commit time if any mirror is missing/stale or a SKIP_LIST skill was deleted/flattened -- enforced in the tracked hook (exit 2), both installer families (exit 1), and the currently-installed `.git/hooks/pre-commit` (refreshed via `setup-hooks.sh` + `install-pre-commit.sh`).
- `verify-release` gained section 10b (Skill Mirrors); `doctor.cjs`'s coverage-gate acceptance point now runs `build-skill-mirrors.cjs --check` as a fourth blocker-severity gate alongside connector/projection/render, with the label updated -- doctor stays 14/14.
- `tests/test-skill-mirrors-tripwire.cjs` proves wiring across all four surfaces (pre-commit, installer, verify-release, doctor), validates the trigger regex against 2 positive + 3 negative-control paths, and exercises 4 SKIP_LIST synthetic cases via a temp fixture plus a real-tree negative control.
- Regenerated 3 mirrors (`help`, `ingest-methodology`, `stance`) that had drifted after quick task 260705-sd5 edited their source commands without regenerating -- the new gate caught this real, pre-existing drift on its very first `--check` run.

## Task Commits

This plan's Task 4 explicitly specifies ONE atomic commit for all task work (not per-task commits), per the plan's own instruction. All four tasks' changes plus the coordinator-approved mirror regeneration landed in a single commit:

1. **Tasks 1-4 + approved mirror regeneration** - `72480d78` (quick)
   - Task 1: `checkSkipList()` + testable exports + `require.main` guard in `build-skill-mirrors.cjs`
   - Task 2: tracked hook guard + installer (grep-presence + both heredoc families) + installed-hook refresh
   - Task 3: `verify-release` step 10b + `doctor.cjs` coverage-gate fold-in
   - Task 4: `tests/test-skill-mirrors-tripwire.cjs` + full gate sweep + em-dash sweep
   - Plus: regenerated `skills/help/SKILL.md`, `skills/ingest-methodology/SKILL.md`, `skills/stance/SKILL.md` (coordinator-approved Option A)

No separate plan-metadata commit was made per this plan's explicit "one atomic commit" instruction (Task 4, item 4) and the constraint that STATE.md/PLAN.md/SUMMARY.md are handled by the orchestrator separately.

## Files Created/Modified

- `scripts/build-skill-mirrors.cjs` - added `checkSkipList(opts)`, wired it into `checkMirrors()`, added `module.exports` + `require.main === module` guard
- `scripts/hooks/pre-commit` - new guard block (Quick task 260705-sy9 guardian) triggered on staged `commands/*.md` or `skills/*/SKILL.md`, exit 2 on drift
- `scripts/install-pre-commit.sh` - idempotency AND-chain entry, new `HOOK_TRAILER_SKILL_MIRRORS` heredoc block, matching fresh-install `HOOK_BODY` block
- `scripts/verify-release` - new section `10b. SKILL MIRRORS` after section 10 (Skills)
- `scripts/doctor.cjs` - new `{ id: 'skill-mirrors', script: 'build-skill-mirrors.cjs' }` gates[] entry inside the existing `coverage-gate` point; label updated to mention skill-mirrors
- `tests/test-skill-mirrors-tripwire.cjs` (new) - wiring proofs + trigger-regex cases + SKIP_LIST synthetic cases + clean-tree check
- `skills/help/SKILL.md` - regenerated (Card 1 family label `Frame the Problem` -> `Frame & Validate`)
- `skills/ingest-methodology/SKILL.md` - regenerated (added `serves_jtbd: ["build"]`)
- `skills/stance/SKILL.md` - regenerated (added `serves_jtbd: ["navigate"]`)

## Decisions Made

Both explicit decisions from the plan's `decisions_made_during_planning` section were followed verbatim:
1. Doctor acceptance folds into the existing `coverage-gate` point (not a new point) -- doctor stays 14/14.
2. `verify-release` gets lettered substep `10b` immediately after section 10, mirroring the 260705-jeq `7b` precedent.

Additionally, during execution the hardened `--check` immediately surfaced 3 pre-existing stale mirrors (`help`, `ingest-methodology`, `stance`). This was reported as a decision-point checkpoint per plan constraints (touching files beyond the 6 listed). The coordinator approved Option A: regenerate via `node scripts/build-skill-mirrors.cjs` (the tool's own write mode) and include the 3 regenerated files in the atomic commit. This is not scope creep -- it is the gate's documented recovery path, and it is direct proof the new gate catches real drift on its first production run.

## Deviations from Plan

### Auto-fixed Issues

**1. [Coordinator-approved, not a Rule 1-3 auto-fix] Regenerated 3 stale skill mirrors found by the new --check**
- **Found during:** Task 1 verification (`node scripts/build-skill-mirrors.cjs --check`)
- **Issue:** `skills/help/SKILL.md`, `skills/ingest-methodology/SKILL.md`, `skills/stance/SKILL.md` had drifted from their source commands (quick task 260705-sd5 edited the command bodies/frontmatter without regenerating mirrors)
- **Fix:** Ran `node scripts/build-skill-mirrors.cjs` (write mode) to regenerate the 3 mirrors from `commands/`, the single source of truth
- **Files modified:** `skills/help/SKILL.md`, `skills/ingest-methodology/SKILL.md`, `skills/stance/SKILL.md`
- **Verification:** `build-skill-mirrors --check` now reports `OK (106 mirrors match expected content; skip-list verified: trending-to-absurd)`
- **Committed in:** `72480d78` (this plan's single atomic commit)
- **Note:** this touches files outside the plan's originally-listed 6 `files_modified`; per constraints, this was raised as a decision-point checkpoint rather than silently expanded, and the coordinator explicitly approved Option A before proceeding.

---

**Total deviations:** 1 (coordinator-approved scope addition, not an auto-fix under Rules 1-3)
**Impact on plan:** Necessary to reach a green gate sweep; no unrelated scope was touched.

## Issues Encountered

`setup-hooks.sh` reported "already installed -- no-op" for its own room-minto-guard portion of the hook (that portion was already byte-identical); the actual staleness was in the trailer guards previously spliced by `install-pre-commit.sh` (command-registry, connector-registry, etc. were present, but the new skill-mirrors guard was missing). `install-pre-commit.sh`'s splice-before-terminal-`exit 0` logic landed the new guard correctly, confirmed via `awk` check that the trigger appears before the terminal `exit 0`. This matches the plan's own contingency note ("If setup-hooks.sh declines to overwrite for any reason, install-pre-commit.sh's splice alone still lands the new guard").

During the full gate sweep mid-execution (before the final commit), `doctor --acceptance` reported 13/14 with `verify-release-clean-tree` failing due to uncommitted WIP -- this was a working-tree-state artifact, not a coverage-gate regression (the `coverage-gate` point itself passed throughout). It resolved to 14/14 immediately after the atomic commit.

## Reported Inline (per constraints)

- **Doctor 14/14:** Confirmed. `Acceptance full: 14/14 points passed.` after the atomic commit, with `coverage-gate` label reading `connector + orchestration-projection + render-coverage + skill-mirrors gates pass (no dark surface); shape-declaration advisory as of Phase 210 (WARNs inline, never blocks)`.
- **Installed hook refresh:** Confirmed. `setup-hooks.sh` was a no-op for its own guard (already byte-identical); `install-pre-commit.sh` spliced the new `build-skill-mirrors.cjs --check` guard into `.git/hooks/pre-commit` before the terminal `exit 0` (verified via `awk` line-order check).
- **Tripwire test pass/fail counts:** 19/19 assertions passed in `tests/test-skill-mirrors-tripwire.cjs` (0 failures) -- wiring proofs (4 surfaces), trigger-regex (2 positive + 3 negative-control), and SKIP_LIST cases (a, b, c, d all correct).
- **Full gate sweep results:** All green -- `build-connector-registry.cjs --check` OK, `check-shape-declaration.cjs --check` OK (234 declared, 5 skill-exempt), `check-render-coverage.cjs --check` OK, `check-help-coverage.cjs` valid:true, `build-orchestration-projection.cjs --check` OK, `build-skill-mirrors.cjs --check` OK (106 mirrors + skip-list verified), `doctor --acceptance` 14/14, `test-skill-mirrors-tripwire.cjs` PASS (19/19), `test-connector-tripwire.cjs` PASS (regression control, unaffected), `test-render-gate-wiring.cjs` PASS (regression control, unaffected).

## User Setup Required

None -- no external service configuration required. Contributors on a fresh clone get the new guard automatically via the existing `bash scripts/install-pre-commit.sh` onboarding step (Task 2 covers both the fresh-install `HOOK_BODY` heredoc and the existing-hook splice path).

## Next Phase Readiness

The 106-mirror Windows commands-registration workaround (260705-ob7) is now fully enforcement-closed: a stranded mirror can no longer reach `main` via any of the three surfaces (commit, release, doctor acceptance), and the hand-authored `trending-to-absurd` skill cannot silently vanish or be flattened. No blockers for future phases; `scripts/build-skill-mirrors.cjs`'s exports (`SKIP_LIST`, `computeExpectedMirror`, `checkMirrors`, `checkSkipList`) are now available for any future test or tooling that needs to reason about the mirror set programmatically.

## Self-Check: PASSED

All 9 created/modified files verified present on disk; commit `72480d78` verified present in `git log --oneline --all`.

---
*Phase: quick-260705-sy9*
*Completed: 2026-07-05*
