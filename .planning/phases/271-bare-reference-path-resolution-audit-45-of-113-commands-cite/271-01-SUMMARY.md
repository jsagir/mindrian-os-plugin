---
phase: 271-bare-reference-path-resolution-audit
plan: 01
subsystem: repo-gates
tags: [gate, lint, path-resolution, plugin-portability, audit, red-baseline]
requires: []
provides:
  - "scripts/check-plugin-path-anchoring.cjs (the bare-plugin-path detection gate)"
  - "tests/test-271-plugin-path-anchoring.cjs (fixture-driven proof of the gate's verdict logic)"
  - "tests/run-all-271.sh (Phase 271 aggregator)"
  - "271-AUDIT.md (the RED-baseline classification register)"
affects:
  - "plan 271-02 (populates ALLOWLIST, resolves audit section 4)"
  - "plan 271-03 (command sweep, measured by this gate)"
  - "plan 271-04 (skills/agents/pipelines sweep, turns --check green)"
  - "plan 271-05 (wires the gate into the release path)"
tech_stack_added: []
tech_stack_patterns:
  - "CJS check script with a process.argv switch-case router (repo convention, no Commander/yargs)"
  - "Reason-enforced ALLOWLIST validated at module load (throws on an empty reason)"
  - "Fixture-driven gate tests against os.tmpdir(), never the live tree"
key_files_created:
  - scripts/check-plugin-path-anchoring.cjs
  - tests/test-271-plugin-path-anchoring.cjs
  - tests/run-all-271.sh
  - .planning/phases/271-bare-reference-path-resolution-audit-45-of-113-commands-cite/271-AUDIT.md
key_files_modified: []
decisions:
  - "Scan pipelines RECURSIVELY (pipelines/**/*.md), not the flat pipelines/*.md the plan named: the flat glob matches zero files and would have made a whole surface a permanent false negative. Found 9 real violations there."
  - "Exclude generated skill mirrors from the skills surface: a mirror double-counts its command and is reverted by the next generator run. Hand-authored = no matching commands/<name>.md, or on the generator's SKIP_LIST."
  - "Anchor BOTH load-bearing and descriptive-prose classes; a split rule needs per-site judgment the gate cannot enforce, and every cited target exists so anchoring prose makes it accurate."
  - "Tag placeholder/glob targets TEMPLATE-TARGET rather than MISSING-TARGET; a {framework} placeholder is not a dangling citation."
metrics:
  tasks_completed: 3
  duration_minutes: 42
  completed_date: 2026-08-27
  files_created: 4
  shipped_markdown_modified: 0
---

# Phase 271 Plan 01: Build the Measuring Instrument Summary

Built a fail-closed repo gate that names every bare plugin-relative `references/`
citation with file:line precision across four markdown surfaces, proved its verdict
logic against synthetic fixtures rather than live counts, and recorded the RED
baseline at 139 violations, 15 more than the plan-time estimate and on a surface the
estimate could not see at all.

## What Was Built

**`scripts/check-plugin-path-anchoring.cjs`** (544 lines). Four modes: `--report`
(default, always exit 0), `--check` (exit 1 while violations remain), `--json`, and
`--include-scripts` for the advisory tier. The pinned predicate is lexical and
deterministic: a site counts only when the token is backtick-delimited OR immediately
preceded by a citation verb (Read/read/load/loaded/see/See/per/from) or a leading
list number, AND it is not already prefixed by `${CLAUDE_PLUGIN_ROOT}/` or the
fail-closed `${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?...}}/` form, AND it is not
allowlisted. Every quantifier is bounded and none is nested (T-271-01); the full scan
of 160 files runs in 0.17s against the 5s budget.

**`tests/test-271-plugin-path-anchoring.cjs`** (218 lines, 6 arms, 19 assertions).
Every arm drives `scanSurface()` against markdown written into an `os.tmpdir()`
scratch dir. The suite contains zero references to the live command tree, so it stays
green while plans 271-03 and 271-04 drive live counts to zero.

**`tests/run-all-271.sh`**. Four arms; its header states what each of the five plans
has to prove and declares in advance that the `--check` arm is RED by design until
271-04 lands. Wires `tests/test-265-file-meeting-gates.cjs` as a do-not-regress arm.

**`271-AUDIT.md`**. Five required sections, generated from the gate's own `--json`.

## The RED Baseline (live, commit `4618f9e5`)

| Surface | Files scanned | Files with violations | Sites | Anchored | VIOLATIONS |
|---|---|---|---|---|---|
| `commands/*.md` | 113 | 46 | 124 | 25 | 99 |
| hand-authored `skills/*/SKILL.md` | 14 | 5 | 14 | 0 | 14 |
| `agents/*.md` | 14 | 7 | 17 | 0 | 17 |
| `pipelines/**/*.md` | 19 | 5 | 9 | 0 | 9 |
| **TOTAL** | **160** | **63** | **164** | **25** | **139** |

0 MISSING-TARGET. 1 TEMPLATE-TARGET (`agents/framework-runner.md:65`, a `{framework}`
placeholder). 57 unique cited paths, 56 of which resolve on disk.

Advisory tier: 34 bare `scripts/` invocations, 1 permission-matcher exclusion
(`commands/status.md:13`, exactly as the plan predicted). Never affects exit code.

## Acceptance Criteria: PASSED with one recorded count deviation

The plan's Task 1 criteria expected 98 / 11 / 15 / 0 = 124. The gate measures
99 / 14 / 17 / 9 = 139. Per the plan's own instruction ("If any number differs, STOP
and record the actual number rather than adjusting the gate to match a stale
expectation"), the gate was NOT adjusted. All four deltas were traced and every one
is the gate finding MORE than a backtick-only grep, never a false positive:

| Surface | Expected | Live | Cause |
|---|---|---|---|
| commands | 98 | 99 | `commands/doctor.md:262` cites bare after "See", no backticks |
| skills | 11 | 14 | per-LINE vs per-SITE counting; `skills/pws-methodology/SKILL.md:62` alone carries 3 tokens |
| agents | 15 | 17 | same per-site effect plus `agents/larry-extended.md:121`, bare after "see" |
| pipelines | 0 | 9 | the expected glob `pipelines/*.md` matches ZERO files; stage files live under `pipelines/<chain>/` |

Only 2 of 139 sites come from the non-backtick citation-verb arm, and both were
hand-verified as genuine citations, so the widened predicate introduced no noise.

All other criteria passed exactly: `--report` exit 0, `--check` exit 1,
`grep -c 'MISSING-TARGET'` returns 0, the module exports check passes with an empty
`ALLOWLIST`, zero em-dashes, `test -x tests/run-all-271.sh`, `test-265` wired,
`grep -c 'commands/'` in the test file returns 0, and `271-AUDIT.md` carries all five
headings plus `LOAD-BEARING`, `DESCRIPTIVE PROSE`, `PENDING`, `file-meeting.md`, and
`commands/radar.md:77`.

## Deviations from Plan

**1. [Rule 2 - missing critical functionality] Pipelines scanned recursively.**
- **Found during:** Task 1
- **Issue:** The plan named `pipelines/*.md` as the surface. That glob matches zero
  files: every pipeline stage file lives one level down under `pipelines/<chain>/`.
  Shipping it would have made an entire surface a permanent false negative, which is
  threat T-271-02 (a false-negative verdict lets the defect class through) realised in
  the gate's own enumeration.
- **Fix:** `listMdRecursive()` walks `pipelines/` recursively. Found 9 real violations
  across 5 files.
- **Commit:** `e5855e5e`

**2. [Rule 2] Generated skill mirrors excluded from the skills surface.**
- **Found during:** Task 1
- **Issue:** 112 of the 126 `skills/*/SKILL.md` files are byte-for-byte mirrors
  generated from `commands/*.md` by `scripts/build-skill-mirrors.cjs`. Counting them
  would double-count every command citation, and hand-fixing one would be reverted by
  the next generator run.
- **Fix:** A skill counts as hand-authored when `commands/<name>.md` does not exist,
  or when `<name>` is on the generator's SKIP_LIST (`trending-to-absurd`). 14
  hand-authored skills scanned. This matches the phase's own wave split: mirrors are
  fixed by 271-03 plus regeneration, hand-authored skills by 271-04.
- **Commit:** `e5855e5e`

**3. [Rule 1] `TEMPLATE-TARGET` tag added alongside `MISSING-TARGET`.**
- **Found during:** Task 1
- **Issue:** `agents/framework-runner.md:65` cites
  `references/methodology/{framework}.md`, a runtime placeholder. Calling that
  MISSING-TARGET would be a false alarm; calling it OK would be a lie.
- **Fix:** A token containing `{` or `*` is tagged `TEMPLATE-TARGET`, still counted as
  a violation, never counted as missing. The totals line uses lowercase
  `of which missing-target:` so the UPPERCASE tag appears only on actual tagged sites
  and `grep -c 'MISSING-TARGET'` stays an honest count.
- **Commit:** `e5855e5e`

**4. [Rule 1] Scan root threaded through target classification.**
- **Found during:** Task 2
- **Issue:** `classifyTarget()` resolved every cited path against `REPO_ROOT` even when
  `scanSurface()` was given a different `root`, so fixture targets resolved against the
  real repo.
- **Fix:** `root` threaded through `scanSurface -> scanLine -> classifyTarget`.
- **Commit:** `4618f9e5`

**5. [Scope boundary] STATE.md and ROADMAP.md NOT updated. Deferred, with reason.**
- Neither file is in this plan's `files_modified`, and both are being actively mutated
  right now by the concurrent Phase 270-12 agent in this same working tree
  (`git status` shows uncommitted `.planning/ROADMAP.md` and `.planning/REQUIREMENTS.md`
  edits that are theirs, not mine). `.planning/STATE.md`'s own frontmatter documents the
  resync-clobber bug at 9+ occurrences this session and names a concurrent session
  mutating the exact `progress:` block that `state.record-metric` writes.
- Running `state.record-metric` / `roadmap.update-plan-progress` now would either
  reproduce that clobber or pull the sibling agent's uncommitted 270 work into a 271
  commit. Neither is acceptable, so both were skipped and reported instead of forced.
- **Action for the next pass:** after the 270-12 agent lands its commit, record the
  Phase 271 plan-01 row in ROADMAP.md and the metric in STATE.md.

## TDD Gate Compliance

Task 2 is marked `tdd="true"` but is a pure test-authoring task: its implementation
(the gate) is Task 1 of the same plan, committed first as `feat(271-01)`. There is
therefore no independent RED gate for Task 2 and no `feat` commit after its `test`
commit. This is recorded rather than papered over. The RED baseline the phase actually
cares about is at the PLAN level and is real: `tests/run-all-271.sh` exits non-zero
today (`PASS=3 FAIL=1`) because the live tree genuinely carries 139 unanchored
citations, and the aggregator's header states in advance that this is the intended
state until plan 271-04 lands.

## Decisions Recorded for Later Waves

**Navigator pre-ruling for plan 271-02's checkpoint: option-d.** Recorded verbatim in
`271-AUDIT.md` section 4 under "NAVIGATOR PRE-RULING". Exclude all 5
`commands/radar.md` sites via a reasoned `ALLOWLIST` entry (the option-a base), AND
register the residual read-side defect at lines 51/52/95/99 as its own follow-up with
an explicit owner. Plan 271-01 did NOT act on it: `ALLOWLIST` ships empty and section
4's disposition stays `PENDING`, which is what 271-02's own acceptance criteria
require it to flip.

**One number 271-02 must correct.** `271-02-PLAN.md` asserts a post-ruling total of
119 under option-a/d. That was derived from the plan-time estimate of 124. Against the
live 139, the post-ruling non-allowlisted total is **134**. Noted in audit section 4.

**Out of scope, recorded so it is not lost:** Phase 270-12's OQ-6 navigator ruling is
"Keep" `room_state_bound`. That belongs to Phase 270 and is being executed by a
separate agent. Filed in `271-AUDIT.md` Appendix A. No action taken here.

## Verification Run

| Check | Result |
|---|---|
| `check-plugin-path-anchoring.cjs --report` | exit 0, 139 violations, 0 MISSING-TARGET |
| `check-plugin-path-anchoring.cjs --check` | exit 1 (intended RED baseline) |
| `tests/test-271-plugin-path-anchoring.cjs` | exit 0, 6 arms / 19 assertions PASS |
| `tests/test-265-file-meeting-gates.cjs` | exit 0, 4/4 (do-not-regress) |
| `bash tests/run-all-271.sh` | PASS=3 FAIL=1 (the FAIL is arm 2, RED by design) |
| `build-skill-mirrors.cjs --check` | OK 112/112, skip-list verified |
| `build-connector-registry.cjs --check` | exit 0 |
| `check-shape-declaration.cjs --check` | exit 0 |
| `check-render-coverage.cjs` | exit 0 |
| gate runtime | 0.17s against a 5s budget (T-271-01) |
| shipped markdown modified | 0 files |

## Commits

| Commit | Type | Scope |
|---|---|---|
| `e5855e5e` | feat | the gate |
| `4618f9e5` | test | fixture suite, aggregator, root-threading fix |
| `b935cddb` | docs | the audit register |

## Self-Check: PASSED

All four created files verified present on disk; all three commit hashes verified
present in `git log`.
