---
phase: 235-cirs-commit-gate-seam-liveness-helper
plan: 01
subsystem: infra
tags: [git-hooks, pre-commit, cirs, born-wired, release-gate, worktree, mutation-testing]

# Dependency graph
requires:
  - phase: 172-13
    provides: the connector born-wired HARD-FAIL (--check exits nonzero on a GAP surface), which is the gate this plan makes actually live at commit time
  - phase: 190-04
    provides: scripts/check-shape-declaration.cjs and its --check / --strict exit contract, used unchanged
  - phase: 210
    provides: the decision that the shape-declaration gate is advisory at release, preserved as the default here
  - phase: 87-01a
    provides: scripts/setup-hooks.sh cmp-then-copy install + --git-path worktree resolution, the pattern install-pre-commit.sh now adopts
provides:
  - One canonical git pre-commit hook body carrying all 11 known guard blocks, copied verbatim by both installers
  - scripts/install-pre-commit.sh reduced to a cmp-then-copy installer with no hand-authored hook content
  - A real --strict-shape flag on scripts/release.sh whose exit-code effect is proven against the live script text
  - tests/test-235-cirs-commit-gate-worktree.cjs (primary + worktree rejection, rival-overwrite negative control, self-heal restore)
  - tests/test-235-release-shape-gate.cjs (sentinel-extraction test, never a hand-copied snippet)
  - tests/run-all-235.sh (glob-discovering phase aggregator + the CIRS-01 byte-identity invariant)
affects: [235-02, release-process, session-start, any phase adding a commands/agents/skills surface]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single canonical source + verbatim copy: divergence prevented by construction, not by discipline"
    - "Sentinel-extraction testing: a test reads the live shipped script between load-bearing sentinel comments instead of hand-copying it"
    - "Negative control in a gate test: reproduce the bypass and assert the violation SUCCEEDS, so the positive legs cannot pass vacuously"
    - "Greppable seam: name the canonical filename literally at each use site so a verifier can confirm the wiring by inspection"

key-files:
  created:
    - tests/test-235-cirs-commit-gate-worktree.cjs
    - tests/test-235-release-shape-gate.cjs
    - tests/run-all-235.sh
  modified:
    - scripts/hooks/pre-commit
    - scripts/hooks/pre-commit-room-minto-guard.sh
    - scripts/install-pre-commit.sh
    - scripts/release.sh

key-decisions:
  - "Collapsed three hand-authored pre-commit bodies into one canonical file both installers byte-copy, rather than trying to keep three copies in sync"
  - "Normalized the 8 ported guard blocks to exit 2 to match the canonical file's existing convention, not install-pre-commit.sh's exit 1"
  - "install-pre-commit.sh now resolves the hooks path via git rev-parse --git-path, matching setup-hooks.sh, because in a worktree the two installers would otherwise write to different files and the convergence guarantee would be void"
  - "Guarded the two ported unconditional invocations with the existence check every other block uses: the retired heredoc baked in an install-time absolute REPO_ROOT, the canonical hook resolves it at run time and installs into arbitrary repos"
  - "The release shape gate keeps the Phase 210 advisory default; --strict-shape is opt-in and does not change any current release behavior"
  - "Task 3's fixture regenerates and stages data/command-registry.json so the earlier command-registry drift guard passes and the born-wired gate is genuinely what is under test"

patterns-established:
  - "Canonical-source hook install: scripts/hooks/pre-commit and pre-commit-room-minto-guard.sh must stay byte-identical, enforced by tests/run-all-235.sh"
  - "Sentinel-wrapped release sub-blocks (SHAPE-GATE-BEGIN / SHAPE-GATE-END) are extracted and executed by their tests"

requirements-completed: [CIRS-01, CIRS-03]

# Metrics
duration: 42min
completed: 2026-07-28
---

# Phase 235 Plan 01: CIRS Commit Gate Seam Summary

**The born-wired commit gate is actually live again: three divergent hand-authored pre-commit bodies collapsed into one canonical file both installers byte-copy, plus a real `--strict-shape` flag on release.sh, both proven by mutation-tested harnesses that fail red against the pre-fix code.**

## Performance

- **Duration:** ~42 min
- **Started:** 2026-07-28
- **Completed:** 2026-07-28
- **Tasks:** 3
- **Files modified:** 7 (4 modified, 3 created)

## What was actually broken (root cause, in plain terms)

A git pre-commit hook is just a script sitting at `.git/hooks/pre-commit`. It is not tracked by git, so something has to install it. This repo had **three** hand-written copies of what that script should say:

1. `scripts/hooks/pre-commit` (335 lines, the file docs called "the tracked hook")
2. `scripts/hooks/pre-commit-room-minto-guard.sh` (234 lines, what `setup-hooks.sh` installs)
3. a heredoc template inside `scripts/install-pre-commit.sh` (the only place 8 guards existed)

None was a superset of the others. `scripts/session-start` runs **both** installers every session: `install-pre-commit.sh` first (on a dev-clone version change, line 1377-1384), then `setup-hooks.sh` unconditionally (line 1667-1685). `setup-hooks.sh` reinstalls whenever `cmp -s` says the installed hook differs from its source. So whatever `install-pre-commit.sh` wrote was immediately overwritten by the **narrower** body seconds later.

Net effect: the connector born-wired gate, the orchestration-projection gate, and the shape-declaration gate were **never live** in the hook that actually ran. A new command with no `connector:` block committed cleanly. That is the exact "one governed path" failure Canon Part 11 exists to prevent, and it is now proven, not asserted: legs 1, 2 and 4 of the new test all go RED against the genuine pre-235 guard body (see Verification below).

Separately, `release.sh` ran `check-shape-declaration.cjs --check || true` unconditionally and **never passed `--strict` at all**, so the documented "one flag away from hard-fail" contract was simply false.

## Accomplishments

- `scripts/hooks/pre-commit` is now the ONE canonical body carrying all 11 known guard blocks: the 3 it already had plus the 8 that existed only inside `install-pre-commit.sh`'s heredoc (schema-aliases, substrate `--diff`, harness-manifest, render-coverage, corpus-stats, shape-declaration, help-coverage, command-registration).
- `scripts/hooks/pre-commit-room-minto-guard.sh` is byte-identical to it, and `tests/run-all-235.sh` fails loudly the moment they diverge.
- `scripts/install-pre-commit.sh` dropped from 364 lines of splice/heredoc content-generation to ~105 lines of cmp-then-copy. It no longer authors hook content at all.
- Both installers now converge on the same destination and the same bytes **in either order** (verified against a scratch repo, both orders, both matching the canonical source).
- `scripts/release.sh` has a real `--strict-shape` flag; the Step 2.4 sub-block is sentinel-wrapped and its behavior is proven by extracting the live text at test run time.
- Phase aggregator `tests/run-all-235.sh` glob-discovers `tests/test-235-*` so 235-02 needs no edit to this file.

## Task Commits

1. **Task 1: Consolidate the pre-commit hook to one canonical source** - `7409a69f` (fix)
2. **Task 2: Fix release.sh's --strict-shape swallow (CIRS-03)** - `41afe142` (fix)
3. **Task 3: Mutation-proof the commit-gate fix end to end** - `43565da3` (test)

## Files Created/Modified

- `scripts/hooks/pre-commit` - the canonical hook body; +8 guard blocks, +the consultation confirmation and canonical-source header
- `scripts/hooks/pre-commit-room-minto-guard.sh` - byte-identical twin (the filename `setup-hooks.sh`, its `.cmd` companion, and `room-minto-hook.test.cjs` already reference)
- `scripts/install-pre-commit.sh` - now a cmp-then-copy installer using `--git-path`; heredoc/splice retired
- `scripts/release.sh` - `--strict-shape` flag, `STRICT_SHAPE=0` default, sentinel-wrapped Step 2.4 shape block
- `tests/test-235-release-shape-gate.cjs` - extracts the live sentinel block and proves strict-aborts / advisory-warns / strict-clean-passes
- `tests/test-235-cirs-commit-gate-worktree.cjs` - isolated fixture repo + real second worktree + 4 real-git-commit legs
- `tests/run-all-235.sh` - phase aggregator plus the CIRS-01 byte-identity + required-guard invariant

## Consultation performed (Task 1 requirement)

The plan bound a consultation before touching installer logic, to confirm that Claude Code's `hooks/hooks.json` is a different system from the git `.git/hooks/pre-commit` script.

**Method note (honest reporting):** the `claude-api` skill and the `claude-code-guide` agent were **not invocable** in this executor context (no Skill or Task tool was exposed to the agent; the `ctx7` CLI fallback is also not installed on this machine). Rather than assert the conclusion from training data, the question was answered from **direct artifact evidence in this repo**, which is strictly more authoritative for this specific claim than either source would have been:

- `hooks/hooks.json` declares only Claude-Code-internal lifecycle events: `SessionStart, PreCompact, PostCompact, Stop, SessionEnd, PreToolUse, PostToolUse, UserPromptSubmit, FileChanged, CwdChanged, SubagentStop, TaskCompleted`. There is no git lifecycle event among them.
- Its serialized contents contain **zero** occurrences of `.git/hooks`, `pre-commit`, or `git commit`.
- The hook this plan changes is invoked by the **git binary** from `$(git rev-parse --git-path hooks/pre-commit)`, entirely outside Claude Code's hook loader and its matchers.

Conclusion recorded as a comment near the top of `scripts/hooks/pre-commit`: *git pre-commit hooks and Claude Code's hooks/hooks.json are separate systems; this change touches only the former.* Zero interaction with `hooks.json` matchers.

## Verification (mutation-proofed, not asserted)

The plan's full `<verification>` block, run in order, all exit 0:

| # | Command | Exit |
|---|---------|------|
| 1 | `bash -n scripts/hooks/pre-commit` | 0 |
| 2 | `bash -n scripts/install-pre-commit.sh` | 0 |
| 3 | `bash -n scripts/release.sh` | 0 |
| 4 | `cmp scripts/hooks/pre-commit scripts/hooks/pre-commit-room-minto-guard.sh` | 0 |
| 5 | `node tests/test-235-release-shape-gate.cjs` | 0 (5/5) |
| 6 | `node tests/test-235-cirs-commit-gate-worktree.cjs` | 0 (6/6) |
| 7 | `node lib/memory/room-minto-hook.test.cjs` | 0 (7/7, unchanged) |

### Task 3 harness output, in the order the acceptance criteria require

```
  ok  Setup: installed hook is byte-identical to the canonical guard source
  ok  Setup: the second worktree shares the primary checkout hooks directory
  ok  Leg 1: primary-checkout rejection of a born-unwired surface
  ok  Leg 2: second-worktree rejection (same shared hook)
  ok  Leg 3: rival-installer overwrite defeats the gate (negative control: commit SUCCEEDS)
  ok  Leg 4: post-self-heal rejection restored (setup-hooks.sh re-run)
cirs-commit-gate tests: 6 passed, 0 failed (of 6)
```

Leg 3 is the negative control and it is load-bearing: it reproduces the C-1 rival-installer overwrite (the shared hook replaced by `#!/usr/bin/env bash` / `exit 0`) and asserts the violating commit **SUCCEEDS**. Without it, legs 1/2/4 could pass against a gate that never had teeth. Leg 4 then re-runs `setup-hooks.sh` (the same self-heal `session-start:1667-1685` performs) and shows rejection return. The red-to-green transition is demonstrated **inside a single run**, by the harness itself.

The stderr substring the rejection legs assert on, observed live:

```
GAP: surface "/mos:zz-scratch-235-a" (command) is neither WIRED (a connector: block)
nor EXCLUDED (connector:{excluded:true,reason}). Wire it or exclude it with a reason.
connector-registry drift / dark surface -- run: node scripts/build-connector-registry.cjs
```

### Independent mutation runs (deliberately breaking the fix)

Both harnesses were run against the pre-fix code to confirm they are not vacuous.

**A. `tests/test-235-cirs-commit-gate-worktree.cjs` vs the genuine pre-235 narrow guard** (`git show 7409a69f~1:scripts/hooks/pre-commit-room-minto-guard.sh`, 234 lines, **0** `build-connector-registry` references) temporarily restored into the working tree:

```
  FAIL  Leg 1: primary-checkout rejection of a born-unwired surface
        Error: expected the commit to be REJECTED in the primary checkout, but it succeeded (exit 0).
  FAIL  Leg 2: second-worktree rejection (same shared hook)
        Error: expected the commit to be REJECTED in the second worktree, but it succeeded (exit 0).
  ok    Leg 3: rival-installer overwrite defeats the gate (negative control: commit SUCCEEDS)
  FAIL  Leg 4: post-self-heal rejection restored (setup-hooks.sh re-run)
        Error: expected the commit to be REJECTED in the primary checkout after self-heal, but it succeeded (exit 0).
cirs-commit-gate tests: 3 passed, 3 failed (of 6)
```

That is the CIRS-01 bug reproduced exactly: the born-unwired command commits cleanly in **both** the primary checkout and the worktree. File restored via `git checkout -- <path>`; `cmp` re-confirmed identical afterward.

**B. `tests/test-235-release-shape-gate.cjs` vs the pre-235 swallow** (`... --check || true` spliced back between the sentinels):

```
  FAIL  Sub-case 1: --strict-shape + seeded violation ABORTS (nonzero exit)
        expected a nonzero exit in strict mode with a violating checker, got 0.
        This is the CIRS-03 regression: the exit code is being swallowed.
  ok    Sub-case 2: default (advisory) + SAME violation warns and continues (exit 0)
  FAIL  Sub-case 3: --strict-shape + clean tree passes (exit 0)
release-shape-gate tests: 3 passed, 2 failed (of 5)
```

Restored from a byte backup; re-ran green 5/5.

### Aggregator

`bash tests/run-all-235.sh` -> `Phase 235: PASS=4 FAIL=0 SKIP=1`, exit 0.

**Partial-green as expected:** the single SKIP is `lib/core/seam-liveness.test.cjs`, which lands in Plan 235-02 and has not landed yet. The aggregator names it explicitly rather than leaving it to the `tests/test-235-*` glob, so it cannot silently never run. Re-run this aggregator after 235-02 lands to get a full-green reading.

### Installer convergence (Task 1 acceptance criterion)

Against a scratch temp git repo, `install-pre-commit.sh` then `setup-hooks.sh`, and the reverse order, both produce a hook byte-identical to each other **and** to `scripts/hooks/pre-commit-room-minto-guard.sh`.

### Plan key_link patterns

| From | Pattern | Matches |
|------|---------|---------|
| `scripts/setup-hooks.sh` | `GUARD_SRC=.*pre-commit-room-minto-guard\.sh` | 1 |
| `scripts/install-pre-commit.sh` | `cmp -s.*pre-commit-room-minto-guard\.sh` | 1 |
| `scripts/release.sh` | `check-shape-declaration\.cjs.*--strict` | 1 |

## Decisions Made

- **One canonical body, copied verbatim, over three synced copies.** Discipline had already failed here three times over; the fix has to be structural. The byte-identity invariant is machine-checked in the aggregator.
- **`exit 2`, not `exit 1`, for the ported blocks.** Git only needs nonzero. Internal consistency with the file the blocks now live in matters more than matching the retired heredoc's literal code.
- **`install-pre-commit.sh` adopts `--git-path`.** Its old `$REPO_ROOT/.git/hooks/pre-commit` is wrong inside a linked worktree, where `.git` is a file. Two installers writing different destinations would void the whole convergence guarantee.
- **`--strict-shape` stays opt-in.** Phase 210 deliberately made the shape gate advisory at release. This plan makes the switch real; it does not flip the default.
- **The fixture excludes `lib/wiki`.** 238MB of vendored viewer assets that no pre-commit guard reads. Documented in the test header with the reason, so the exclusion is a stated call rather than a silent one.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The two ported unconditional guards hard-failed every commit outside the plugin repo**

- **Found during:** Task 1 (immediately after porting, caught by the pre-existing suite)
- **Issue:** The plan said to copy blocks 1 and 2 verbatim from `install-pre-commit.sh`'s `HOOK_BODY` heredoc, where they read `node "$REPO_ROOT/scripts/check-schema-aliases.cjs" || exit 1` with no existence guard. That was safe **there** because the heredoc was unquoted, so the plugin's absolute `$REPO_ROOT` was baked in at install time. The canonical hook resolves `$REPO_ROOT` at **run** time via `git rev-parse --show-toplevel` and is installed into arbitrary repos (a user's room repo, a test fixture). Copied literally, the hook ran `node /some/other/repo/scripts/check-schema-aliases.cjs`, node exited 1 with `Cannot find module`, and **every commit in every non-plugin repo was rejected**. `node lib/memory/room-minto-hook.test.cjs` went from 7/7 to 4/7 (Tests 3, 5, 6 failing with `Cannot find module '/tmp/mos-hook-pass-.../scripts/check-schema-aliases.cjs'`).
- **Fix:** Wrapped both invocations in the same `command -v node >/dev/null 2>&1 && [ -f "$REPO_ROOT/..." ]` existence guard that all 9 other blocks in the file already use. Behavior in the plugin repo is unchanged (the files always exist there); outside it, the hook correctly no-ops instead of blocking. The reason is written into the block's comment so the next person does not "restore" the verbatim form.
- **Files modified:** `scripts/hooks/pre-commit`, `scripts/hooks/pre-commit-room-minto-guard.sh`
- **Verification:** `room-minto-hook.test.cjs` back to 7/7; Test 4 (the self-heal content byte-compare the plan explicitly required to keep passing) green and unmodified.
- **Committed in:** `7409a69f` (Task 1 commit)

**2. [Rule 3 - Blocking] The fixture's born-unwired commit was rejected by the wrong gate**

- **Found during:** Task 3 (fixture prototyping, before writing the test file)
- **Issue:** The plan specified staging only `commands/zz-scratch-235-a.md`. But the command-registry drift guard sits **earlier** in the hook (line ~143) than the connector born-wired gate (line ~166). Adding any new command file stales `data/command-registry.json`, so the commit aborted with `command-registry drift` and the born-wired gate was never reached. The test would have asserted a rejection that had nothing to do with CIRS-01. First observed output: `[build-command-registry] ERROR: 1 commands missing teaching field: /mos:zz-scratch-235-a`.
- **Fix:** The fixture surface carries a `teaching:` field (the registry builder requires one), and `attemptGapCommit()` regenerates `data/command-registry.json` and stages it alongside the `.md`. The earlier, unrelated gate then passes and the connector gate is genuinely what fails. The rationale is written into the helper's docstring.
- **Files modified:** `tests/test-235-cirs-commit-gate-worktree.cjs`
- **Verification:** rejection stderr now carries the real `GAP: surface "/mos:zz-scratch-235-a" ... is neither WIRED ... nor EXCLUDED` string, and mutation run A confirms the leg goes red without the Task 1 fix.
- **Committed in:** `43565da3` (Task 3 commit)

**3. [Rule 3 - Blocking] The installer's cmp seam was not greppable, failing the plan's own key_link**

- **Found during:** Task 3 (the new aggregator's CIRS-01 invariant leg caught it on first run)
- **Issue:** The first version of the simplified installer hid the canonical filename behind a `GUARD_SRC` variable, so `cmp -s "$GUARD_SRC" "$HOOK_PATH"` did not match the plan's declared key_link pattern `cmp -s.*pre-commit-room-minto-guard\.sh`. A verifier grepping that pattern would have reported the wiring missing.
- **Fix:** Kept only the directory in a variable (`HOOKS_SRC_DIR`) and wrote the canonical filename literally at each use site (the `cmp`, the `cp`, the missing-source check, the success message). Notably this also removes a second definition of the path that could drift, which is the exact failure mode this phase exists to close. Not satisfied with a comment, since a gate that header prose can satisfy is no gate.
- **Files modified:** `scripts/install-pre-commit.sh`
- **Verification:** all three key_link patterns now return exactly 1; installer convergence re-verified in both orders after the change; `bash tests/run-all-235.sh` exit 0.
- **Committed in:** `43565da3` (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking)
**Impact on plan:** All three were necessary for correctness. Deviation 1 prevented shipping a hook that would break commits in every user's own repo, which would have been a far worse regression than the bug being fixed. Deviations 2 and 3 were the difference between a test/gate that looks green and one that means something. No scope creep; no file outside the plan's `files_modified` was touched.

## Issues Encountered

- **Pre-existing shape-declaration violations in the tree (out of scope, logged).** `node scripts/check-shape-declaration.cjs --check --strict` exits 1 today: `skills/stance`, `skills/update`, `skills/vault`, and `skills/visualize` each declare a real `hitl_shape` **and** `connector.excluded: true` at the same time, which Canon Part 11 forbids. This pre-dates the plan; no skill frontmatter and no line of `check-shape-declaration.cjs` was touched here. It does not affect any release today because the default path stays advisory. It does mean `release.sh <version> --strict-shape` would abort until reconciled, which is the flag working as designed. Logged in full, with recovery guidance, at `.planning/phases/235-cirs-commit-gate-seam-liveness-helper/deferred-items.md` (D-235-01-a).
- **Consultation sources unavailable in this executor context.** No Skill/Task tool and no `ctx7` CLI. Answered from direct artifact evidence instead of guessing; see the Consultation section above for the method and the evidence.

## Known Stubs

None. Every surface this plan touches is wired and exercised by a real test.

## Threat Flags

None. This plan adds no network endpoint, no auth path, no new file-access pattern, and no schema change. The three threats in the plan's register are addressed as declared: T-235-01 (mitigated, single canonical source proven by the worktree test), T-235-02 (accepted, unchanged), T-235-03 (mitigated, extraction-based release test).

## User Setup Required

None. Both installers are already invoked by `scripts/session-start`; the next session self-heals the installed hook to the canonical body automatically.

**One thing worth knowing:** because the born-wired gate is now genuinely live, the next commit that adds a `commands/*.md`, `agents/*.md`, or `skills/*/SKILL.md` surface without a `connector:` block **will be rejected**. That is the intended behavior returning after being dead, not a new restriction.

## Next Phase Readiness

- 235-02 (seam-liveness helper) is unblocked. `tests/run-all-235.sh` already glob-discovers `tests/test-235-*` and names `lib/core/seam-liveness.test.cjs` explicitly, so 235-02 needs no edit to the aggregator.
- Re-run `bash tests/run-all-235.sh` after 235-02 lands for a full-green reading (today: PASS=4 FAIL=0 SKIP=1).
- Open item for a future phase: D-235-01-a in `deferred-items.md`, the four skills blocking `--strict-shape`.

---
*Phase: 235-cirs-commit-gate-seam-liveness-helper*
*Completed: 2026-07-28*
