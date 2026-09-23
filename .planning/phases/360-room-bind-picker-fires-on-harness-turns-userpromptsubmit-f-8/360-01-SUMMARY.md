---
phase: 360-room-bind-picker-fires-on-harness-turns-userpromptsubmit-f-8
plan: 01
subsystem: testing
tags: [dependency-gate, baseline, plan-base, runner, room-bind, userpromptsubmit, card-fire]

# Dependency graph
requires:
  - phase: 357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re
    plan: 07
    provides: "lib/hmi/turn-text.cjs's 'harness' classification (classifyPrecedingUserContentSource(content, rec), HARNESS_LEADS)"
  - phase: 357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re
    plan: 09
    provides: "tests/fixtures/card-fire-replay/baseline.json, tests/run-all-357.sh, the R4/R5 bar (MET)"
provides:
  - "tests/fixtures/ups-harness-360/pre-phase.json: 357 HALT gate result, PLAN_BASE, A1 stdin recheck, rec field names, lead-only-reduction probe, harness-lead-literal census, the 357 replay reference (60 entries), owned-files clean status, and the recorded 18-suite baseline"
  - "tests/test-360-r3-suites.cjs: --record and default-compare modes over the r3 (6) / mcp (4) / wider (8) suite groups, isolated HOME per suite, one re-run on a mismatch"
  - "tests/run-all-360.sh: the Phase 360 aggregator, written once, 6 pre-declared 360 legs + the 357 compatibility leg + a 360-scoped em-dash guard; --r3-compare runs only the suites leg"
affects: [360-02, 360-03, 360-04, 360-05, 360-06, 360-07, 360-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Suite recorder/comparer pattern (357 R-J precedent extended): a frozen suite list, spawnSync under a fresh mkdtemp HOME per suite, --record writes {exit, ok_count, fail_lines} keyed by file path into the shared pre-phase.json, default mode compares (green must stay green, a known red's fail_lines must stay a subset), one re-run on mismatch as a timing-flake guard."
    - "R3_ONLY early-exit in the aggregator: a single shared run_if invocation serves both the full run and --r3-compare, so the suites leg's guard/label text exists exactly once in the file (no duplicated run_if line), and --r3-compare exits with exactly that leg's own status."

key-files:
  created:
    - tests/fixtures/ups-harness-360/pre-phase.json
    - tests/test-360-r3-suites.cjs
    - tests/run-all-360.sh
  modified:
    - .planning/phases/357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re/357-VERIFICATION.md

key-decisions:
  - "PLAN_BASE = 0f7a00cadf4de046bb8cc10a4d33f1e89fd493e4 (HEAD at the moment Task 1 recorded it; a peer session's 358-07 commit landed between this plan's own em-dash-fix commit and the PLAN_BASE read, which is expected on a shared tree - PLAN_BASE only anchors to whatever HEAD was at that instant, not to this plan's own last commit, and git cat-file -e confirms the sha is a real, reachable commit)."
  - "Rule 1 auto-fix (pre-Task-1): tests/run-all-357.sh's own standing em-dash guard failed (exit 1) on 3 em-dashes in 357-VERIFICATION.md, left by the unrelated phase-verification commit 5744ca11e. This directly blocked Task 1's gate check (e) (D-19: bash tests/run-all-357.sh must exit 0 under isolation before any 360 repo file is written). Fixed the 3 em-dashes to hyphens (wording unchanged), verified the file had no peer diff first, and committed it separately before proceeding - see Deviations."
  - "A1 re-checked at claude --version 2.1.281, not the 2.1.280 the plan expected. Per the plan's own A1 protocol this triggered a re-fetch of the raw hooks doc (curl, not WebFetch, per RESEARCH's own warning that a summarizing WebFetch mis-named the prompt field once already). The UserPromptSubmit input section and the common-input-fields table still show no origin, isMeta, or prompt-source field at 2.1.281 - D-02's lead-only reduction still stands, no HALT."
  - "Lead-only reduction probe (classifyPrecedingUserContentSource('<task-notification\\nx', {isMeta:false, originKind:undefined, prevHumanUpstream:true})) returns 'harness' directly - lead_only_reduction:true, lead_only_rec:null. 360-06 can use the plan's own suggested rec shape without a fallback."
  - "Census: the five SPEC leads plus today's HARNESS_LEADS entries appear in exactly one file under lib/ and scripts/ (lib/hmi/turn-text.cjs), matching the plan's expected set. absence_pin_legs is empty - grep of tests/test-357-harness-source.cjs found no leg pinning the absence of <agent-message / <cross-session-message, so 360-06's R5 tag re-add (D-10) needs no companion test-file edit in that file."

requirements-completed: [BIND360-03, BIND360-09]

# Metrics
duration: ~30min
completed: 2026-09-23
---

# Phase 360 Plan 01: 357 HALT Gate, PLAN_BASE, Suite Baseline, Runner Summary

**The 357 dependency gate passed clean after fixing a pre-existing em-dash regression in 357's own verification doc, PLAN_BASE and every pre-phase anchor (A1 recheck at 2.1.281, lead-only-reduction, harness-lead census, the 357 replay reference) landed in pre-phase.json, and the 18-suite R3/MCP/wider baseline plus the Phase 360 test runner (tests/run-all-360.sh) are committed - zero runtime files touched, exactly as the plan requires.**

## Performance

- **Duration:** ~30 min
- **PLAN_BASE:** `0f7a00cadf4de046bb8cc10a4d33f1e89fd493e4`
- **Tasks:** 2/2 completed
- **Files modified:** 4 (3 created: pre-phase.json, test-360-r3-suites.cjs, run-all-360.sh; 1 modified: 357-VERIFICATION.md, a Rule 1 auto-fix)

## Accomplishments

- **357 HALT gate: PASSED (all 7 checks a-g).** `HARNESS_LEADS` is a frozen array; `classifyPrecedingUserContentSource` returns `'harness'` for a peer-shaped rec (`{isMeta:true, originKind:'peer', prevHumanUpstream:false}`) on a stored-peer-shaped text; the 1-arg contract is byte-identical (`typed, tool_result, none, none`); `tests/run-all-357.sh` exits 0 under isolation (PASS=16 FAIL=0 SKIP=0, after the em-dash fix below); `tests/fixtures/card-fire-replay/baseline.json` exists (60 entries, `pre_phase_sha: 973deb32...`); the 357 replay in `--baseline compare --json` mode exits 0 (`entries:60 evaluated:60 false_blocks:0 new_misses:0 parity_mismatches:0`).
- **A1 re-checked at the ACTUAL installed version (2.1.281, not the plan's assumed 2.1.280).** Re-fetched the raw hooks doc (`curl`, per RESEARCH's own warning that a WebFetch summary once mis-named the prompt field) and confirmed the UserPromptSubmit input and common-input-fields sections still carry no `origin`, `isMeta`, or prompt-source field at this version. No HALT; D-02's lead-only reduction stands for 360-06.
- **Lead-only reduction probe: confirmed `'harness'` with no fallback needed** (`lead_only_reduction:true`, `lead_only_rec:null`).
- **Census: exactly `lib/hmi/turn-text.cjs`** carries any of the five SPEC harness leads or today's `HARNESS_LEADS` entries under `lib/` or `scripts/` - the expected single-owner result. `absence_pin_legs` is empty (no 357 leg pins the tags' absence), so 360-06's R5 edit (D-10) needs no companion update in `tests/test-357-harness-source.cjs`.
- **18-suite R3/MCP/wider baseline recorded and self-consistency proven**: `tests/test-360-r3-suites.cjs --record` wrote per-suite `{exit, ok_count, fail_lines}` into `pre-phase.json.suites`; the very next default (compare) run against that same baseline is 18/18 `ok`. The one recorded red is `lib/memory/userpromptsubmit-integration.test.cjs` at 13/14 (`Test 8: tier_0 fallback leaves Phase 83 intent classifier path intact`), matching RESEARCH's own measured baseline exactly (confirms the isolated-HOME env used here does not itself cause or hide Test 8's red, RESEARCH Assumption A4).
- **`tests/run-all-360.sh` written once**: 6 pre-declared 360 legs (all SKIP today, expected mid-phase - their test files land in 360-02 through 360-07), the standing 357 compatibility leg (`PASS`), and a 360-scoped em-dash guard (`PASS`). `--r3-compare` runs only the suites leg via a shared `run_if` call (no duplicated leg text) and exits with exactly that leg's status. Verified the real `~/.mindrian/card-fire-reached.json` mtime is unchanged across a full run (T-360-05).

## Task Commits

Each task was committed atomically:

1. **Task 1: 357 dependency HALT gate, A1 re-check, PLAN_BASE and census into pre-phase.json** - `ae16ec46c` (test), preceded by the Rule 1 auto-fix commit `1cbe6f8c4` (docs) that unblocked the gate
2. **Task 2: suite recorder/comparer, the recorded baseline, and run-all-360.sh written once** - `e9e630a9f` (test)

**Plan metadata:** this commit (docs: complete plan) - per the objective, `.planning/STATE.md` / `ROADMAP.md` / `REQUIREMENTS.md` were intentionally left untouched; the orchestrator applies `requirements-completed` from this file's frontmatter.

## Files Created/Modified

- `tests/fixtures/ups-harness-360/pre-phase.json` - new; `schema_version`, `gate` (7 checks, status passed), `plan_base_sha`, `recorded_at`, `a1_check`, `rec_field_names`, `lead_only_reduction`/`lead_only_rec`, `harness_leads_at_plan_base`, `lead_literal_files`, `absence_pin_legs`, `replay_357_reference` (counts + sanitized per-id outcomes, 60 entries), `owned_files_status` (4 files, all clean), `suites` (18 entries, populated by Task 2)
- `tests/test-360-r3-suites.cjs` - new; frozen 18-entry `SUITES` list, `runSuite` (isolated spawn per suite), `--record` and default-compare modes, `--group` filter, one re-run on mismatch
- `tests/run-all-360.sh` - new; the Phase 360 aggregator (`chmod +x`), isolation setup, `--r3-compare` early-exit, 6 pre-declared 360 legs + 1 357 leg + the em-dash guard
- `.planning/phases/357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re/357-VERIFICATION.md` - 3 em-dashes replaced with hyphens (Rule 1 auto-fix, wording otherwise unchanged)

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed 3 em-dashes in 357-VERIFICATION.md that were failing tests/run-all-357.sh's own standing em-dash guard**
- **Found during:** Task 1, gate check (e)
- **Issue:** `bash tests/run-all-357.sh </dev/null` exited 1 under isolation because its own em-dash guard leg scans `357-VERIFICATION.md` (one of the files named in `PHASE_357_SURFACES`) and found 3 em-dash characters, left by the unrelated `docs(357): phase verification` commit (`5744ca11e`). This directly blocked D-19's HALT gate, which requires `tests/run-all-357.sh` to exit 0 before any 360 repo file is written.
- **Fix:** Replaced the 3 em-dashes with hyphens in `357-VERIFICATION.md` (no wording change). Confirmed the file had no peer diff first (`git status --short`), then committed it alone before Task 1's own commit.
- **Files modified:** `.planning/phases/357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re/357-VERIFICATION.md`
- **Verification:** `grep -c em-dash` on the file is now 0; `bash tests/run-all-357.sh </dev/null` re-run under isolation now exits 0 (PASS=16 FAIL=0 SKIP=0).
- **Commit:** `1cbe6f8c4` (docs, separate from and before the Task 1 test commit)

---

**Total deviations:** 1 auto-fixed (Rule 1, house-rule bug in a file outside this plan's declared `files_modified`, directly blocking the plan's own HALT gate)
**Impact on plan:** Necessary to proceed at all - the gate check is a hard HALT condition in the plan's own `<action>` steps. No scope creep: the fix is a byte-for-byte character substitution in a doc file, not a behavior change, and it was committed as its own atomic, explicit-path commit citing (360-01) per D-20.

## Issues Encountered

None beyond the deviation above. The `--r3-compare` early-exit initially duplicated the shared `run_if "360: R3, MCP and wider suites..."` leg (once inside the `--r3-compare` branch, once in the main sequence), which pushed the `run_if "360:` grep count to 7 instead of the plan's required 6. Restructured with an `R3_ONLY` guard variable so the leg's `run_if` call exists exactly once in the file and serves both paths; re-verified the count is 6 and `--r3-compare` still exits with exactly that leg's own status.

## Stub Tracking

None. `pre-phase.json` is fully populated (no placeholder values); `test-360-r3-suites.cjs` and `run-all-360.sh` are complete, load-bearing tooling with no stubbed logic. The 6 SKIPped legs in `run-all-360.sh` are an intentional, documented mid-phase state (their guard files land in later 360 plans), not stubs.

## Threat Flags

None new. Both threats this plan's own `<threat_model>` targets are directly addressed and verified:
- **T-360-05** (real side-channel write): `~/.mindrian/card-fire-reached.json` mtime measured identical before and after a full `bash tests/run-all-360.sh` run.
- **T-360-07** (keyed network call): every suite spawn in `test-360-r3-suites.cjs` strips `TYPESAFE_API_KEY` / `MINDRIAN_BRAIN_KEY` from its env; `run-all-360.sh` unsets both before any leg.
- **T-360-11** (building on an unshipped 357 API): the D-19 HALT gate ran all 7 checks against the actually-shipped 357-07/357-09 API and passed; rec field names, lead-only reduction, and the census are recorded for later plans to adapt to, never fork.
- **T-360-04** (pre-phase.json leaking snapshot ids or text): `grep -cE` for a UUID-shaped token on the file is 0; only shas, structural tags, corpus ids (e.g. `dogfood-0f86dd63-092046`, already the sanitized 357 corpus id scheme) and counts are recorded.

## Verification Results

- Gate checks a-g (Task 1): all pass, see Accomplishments.
- `node -e` pre-phase.json required-keys/gate-status/plan_base_sha-format/replay-outcomes check - prints `ok`.
- `git cat-file -e "$(node -p "...plan_base_sha")^{commit}"` - exits 0.
- `node -p "...lead_literal_files.includes('lib/hmi/turn-text.cjs')"` - `true`.
- UUID-shaped-token grep on pre-phase.json - 0.
- Em-dash grep on pre-phase.json, test-360-r3-suites.cjs, run-all-360.sh - 0/0/0.
- `node tests/test-360-r3-suites.cjs --record </dev/null` then default compare - both exit 0; self-consistency 18/18 `ok`.
- `node -e` suites-length-18 + all-3-groups-present check - prints `ok`.
- `grep -v '^\s*#' tests/run-all-360.sh | grep -c 'run_if "360:'` - 6; `... 'run_if "357:'` - 1.
- `grep -c 'MOS360_SNAPSHOT_DIR' tests/run-all-360.sh` - 2 (>= 1); `grep -c 'unset TYPESAFE_API_KEY'` - 1.
- `bash tests/run-all-360.sh --r3-compare </dev/null` - exits 0, prints only the suites leg's label.
- `stat -c %Y ~/.mindrian/card-fire-reached.json` before/after a full `bash tests/run-all-360.sh </dev/null` run - identical.
- `bash tests/run-all-360.sh </dev/null` - exits 0, `Phase 360: PASS=3 FAIL=0 SKIP=5` (the 6 not-yet-landed 360 legs SKIP, the suites leg and the 357 leg and the em-dash guard PASS).
- `git log --format=%s -30 | grep -c '(360-01)'` - 3 (>= 1).
- `git diff --name-only HEAD~1..HEAD -- lib/ scripts/` (this plan's own last commit) - empty; per-commit `git diff-tree --no-commit-id --name-only -r` across all 3 of this plan's commits touches only `357-VERIFICATION.md`, `pre-phase.json`, `run-all-360.sh`, `test-360-r3-suites.cjs` - no runtime file.

## User Setup Required

None - no external service configuration, no secrets, no network egress (every suite spawn and the 357 replay run local-only, under isolated HOME).

## Next Phase Readiness

- **357 dependency is proven on main.** 360-02 through 360-07 can build against the actual shipped API (`classifyPrecedingUserContentSource(content, rec)` with `rec: {isMeta, originKind, prevHumanUpstream}`, `HARNESS_LEADS` frozen array) with no further adaptation needed - `rec_field_names` in `pre-phase.json` matches the plan's own assumed shape exactly (A2 in RESEARCH resolved: no drift).
- **360-06's R5 tag re-add (D-10) has a clear runway**: `lead_literal_files` confirms `HARNESS_LEADS` is defined in exactly one place, and `absence_pin_legs` is empty, so adding `<agent-message` / `<cross-session-message` to the list needs no companion edit to `tests/test-357-harness-source.cjs`.
- **The R3/MCP/wider suite baseline is committed and self-consistent**, ready for later plans' `node tests/test-360-r3-suites.cjs` (or `bash tests/run-all-360.sh --r3-compare`) regression checks as runtime changes land in 360-06/360-07.
- **`tests/run-all-360.sh` is live with 6 SKIPping legs** that activate automatically as `tests/test-360-leads.cjs`, `tests/test-360-harness-picker.cjs`, `tests/test-360-picker-policy.cjs`, `tests/test-360-tripwire.cjs`, and `tests/test-360-snapshot-replay.cjs` land in 360-02 through 360-05/360-07 - no further edits to this file are needed or permitted (D-15).
- Per this plan's own scope contract (orchestrator owns shared state), no `STATE.md` / `ROADMAP.md` / `REQUIREMENTS.md` write was made; `requirements-completed: [BIND360-03, BIND360-09]` is recorded in this file's frontmatter for the orchestrator to apply.
- No blockers.

---
*Phase: 360-room-bind-picker-fires-on-harness-turns-userpromptsubmit-f-8*
*Plan: 01*
*Completed: 2026-09-23*

## Self-Check: PASSED

All 4 files created/modified this plan verified present on disk (`tests/fixtures/ups-harness-360/pre-phase.json`, `tests/test-360-r3-suites.cjs`, `tests/run-all-360.sh`, `357-VERIFICATION.md`), plus this SUMMARY itself. All 3 commits (`1cbe6f8c4`, `ae16ec46c`, `e9e630a9f`) verified present in `git log --oneline --all`. No missing items.
