---
phase: 360-room-bind-picker-fires-on-harness-turns-userpromptsubmit-f-8
plan: 06
subsystem: testing
tags: [turn-text, harness-leads, shared-classifier, runtime-fix, 357-compat]

# Dependency graph
requires:
  - phase: 360-room-bind-picker-fires-on-harness-turns-userpromptsubmit-f-8
    plan: 01
    provides: "tests/fixtures/ups-harness-360/pre-phase.json (PLAN_BASE, lead_only_rec, lead_literal_files, absence_pin_legs, replay_357_reference)"
  - phase: 360-room-bind-picker-fires-on-harness-turns-userpromptsubmit-f-8
    plan: 03
    provides: "tests/test-360-leads.cjs (RED until this plan), tests/test-360-snapshot-replay.cjs layer h (RED until this plan)"
provides:
  - "lib/hmi/turn-text.cjs: HARNESS_LEADS widened to 5 frozen entries (adds the 37-char peer stem, <agent-message, <cross-session-message)"
  - "lib/hmi/turn-text.cjs: classifyUserPromptText(text), the UserPromptSubmit hook's entry point into the shared 357 rule body, exported"
affects: [360-07, 360-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "LEAD_ONLY_REC module constant: {isMeta:false, originKind:undefined, prevHumanUpstream:true} reduces classifyPrecedingUserContentSource to a lead-only startsWith test with zero file reads, shared by any future 1-arg-text caller."

key-files:
  created: []
  modified:
    - lib/hmi/turn-text.cjs

key-decisions:
  - "tests/test-357-harness-source.cjs needed no edit: pre-phase.json's absence_pin_legs is empty (recorded by 360-01), so no 357 leg pins the absence of the two re-added tags."
  - "Task 2's R4 one-definition closure was not needed: pre-phase.json's lead_literal_files is exactly ['lib/hmi/turn-text.cjs']; removing that entry leaves an empty remainder, so no scripts/extract-dogfood-stop-events.cjs or scripts/replay-card-fire.cjs edit was made (both already reference no harness lead literal, confirmed by direct grep before editing)."
  - "The plan's rule-body-identity acceptance check compares classifyPrecedingUserContentSource's toString() against PLAN_BASE (0f7a00cadf4de046bb8cc10a4d33f1e89fd493e4, recorded 2026-09-23 by 360-01). That comparison now fails (962 vs 1259 chars) because a LEGITIMATE, unrelated 357-review fix (commit 15b1febba, 'CR-01 gate harness-promotion on base typed, not isMeta alone') landed on main after PLAN_BASE was captured and before this plan ran -- exactly the drift the sequential_execution briefing flagged ('357 review fix 15b1febba - preserve it'). The correct, scoped check is against the file this plan actually started from: classifyPrecedingUserContentSource's toString() is byte-identical to HEAD (commit 6077f94d7, immediately before this plan's own commit) -- verified directly, see Verification Results. This plan changed nothing in that function's body; it only added a new function and widened the exported array. No STOP was warranted (D-11's own proof is the replay, not this stale-baseline grep, and the replay is clean -- see below)."
  - "classifyUserPromptText is intentionally NOT a byte-identical reduction of the plan's suggested rec through pre-phase.json's lead_only_rec field (recorded null there): the plan's own fallback shape ({isMeta:false, originKind:undefined, prevHumanUpstream:true}) was used directly as LEAD_ONLY_REC, matching what tests/test-360-leads.cjs and tests/test-360-snapshot-replay.cjs already assume."

requirements-completed: [BIND360-04, BIND360-05, BIND360-07]

# Metrics
duration: ~50min
completed: 2026-09-24
---

# Phase 360 Plan 06: HARNESS_LEADS Widened, classifyUserPromptText Added

**lib/hmi/turn-text.cjs's HARNESS_LEADS grows from 3 to 5 frozen entries (the 37-char peer stem plus the two queued-peer tags `<agent-message` and `<cross-session-message`), and a new exported `classifyUserPromptText(text)` gives the UserPromptSubmit hook a one-line entry point into the same 357 rule body -- the 357 replay (60 entries, both before and after) shows 0 changed Stop-hook outcomes.**

## Performance

- **Duration:** ~50 min
- **Tasks:** 2/2 completed (Task 2 required no file edits; both its conditional steps resolved to "not needed")
- **Files modified:** 1 (`lib/hmi/turn-text.cjs`)

## Accomplishments

- **HARNESS_LEADS widened to exactly 5 frozen entries**: `<task-notification`, `[Cross-session idle notice]` (unchanged from 357-07), the 37-char stem `Another Claude session sent a message` (replacing 357-07's 40-char embedded-newline LCP -- a strict prefix, so every prior stored-peer match still matches, plus it now also covers the "while you were working" framing variant and a CRLF line ending), `<agent-message`, `<cross-session-message` (the two tags 357-07's R-A pass dropped for 0 Stop-path occurrences, now re-added because the 360 replay shows they lead 15 queued peer deliveries at UserPromptSubmit, 7 of which fired the room-bind picker).
- **classifyUserPromptText(text) added and exported**: the UserPromptSubmit hook's entry point, calling `classifyPrecedingUserContentSource(text, LEAD_ONLY_REC)` with `LEAD_ONLY_REC = {isMeta:false, originKind:undefined, prevHumanUpstream:true}` -- lead-only, zero new file reads, never throws (non-string input returns `'none'` directly).
- **classifyPrecedingUserContentSource's own body is untouched**: verified byte-identical against the actual pre-edit HEAD (see Deviations for why the plan's PLAN_BASE-anchored check reports a mismatch, and why that mismatch is a stale-baseline artifact, not a real change).
- **357 replay proof (D-11)**: `scripts/replay-card-fire.cjs --surface both --baseline compare --json` reports identical counts before and after (60 entries, 0 false_blocks, 0 new_misses, 0 parity_mismatches) and 0 changed per-entry outcomes across all 60 ids (captured to scratch files and diffed programmatically).
- **`tests/run-all-357.sh` unchanged**: PASS=16 FAIL=0 SKIP=0, identical before and after (only PID numbers differ in the raw log).
- **360-side tests flip GREEN**: `tests/test-360-leads.cjs` (26/26 checks), `tests/test-360-tripwire.cjs --only r4d` (harness lead list defined in exactly one file), `tests/test-360-snapshot-replay.cjs --layer h` (harness unbound fires 33 -> 0, human unbound fires 2 -> 2, 0 human-attributed runs ever carry a harness verdict).

## Task Commits

1. **Task 1: widen HARNESS_LEADS and add classifyUserPromptText** - `3816c294b` (fix)
2. **Task 2: R4 one-definition closure and 357 compatibility proof** - no commit (nothing to stage; both conditional steps resolved to "not needed", see Decisions Made). The compatibility proof itself is verification-only, recorded in this SUMMARY.

**Plan metadata:** this commit (docs: complete plan) -- per the objective, `.planning/STATE.md` / `ROADMAP.md` / `REQUIREMENTS.md` were intentionally left untouched; the orchestrator applies `requirements-completed` from this file's frontmatter.

## Files Created/Modified

- `lib/hmi/turn-text.cjs` -- `HARNESS_LEADS` widened from 3 to 5 frozen entries; new exported `LEAD_ONLY_REC` constant and `classifyUserPromptText(text)` function added between `classifyPrecedingUserContentSource` and `scanContentForAskUserQuestion`; `classifyUserPromptText` added to `module.exports`.

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

### Not a deviation, but disclosed in full (per the debugging directive: root cause before patching)

**The plan's own acceptance check "rule body unchanged vs PLAN_BASE" reports a mismatch, but the fix (widening HARNESS_LEADS, adding classifyUserPromptText) never touched that function.**

- **Found during:** Task 1, running the acceptance-criteria commands verbatim.
- **What the check does:** `git show $PLAN_BASE:lib/hmi/turn-text.cjs`, then compares `classifyPrecedingUserContentSource.toString()` between that PLAN_BASE snapshot and the current file.
- **Root cause:** `PLAN_BASE` (`0f7a00cadf4de046bb8cc10a4d33f1e89fd493e4`) was recorded by 360-01 on 2026-09-23. Since then, an UNRELATED 357-review fix landed on `main` in commit `15b1febba` ("fix(357-review): CR-01 gate harness-promotion on base 'typed', not isMeta alone") -- exactly the fix the sequential_execution briefing for this plan names explicitly ("Current harness rule: harness only when base==='typed' (357 review fix 15b1febba) - preserve it"). That commit changed `classifyPrecedingUserContentSource`'s body (adding the `base === 'typed'` guard on rule 1) on a shared tree, independent of this plan, after PLAN_BASE was captured. This is expected drift on a 5+-session shared tree, not a defect in this plan's own edit.
- **Verification the function body is actually untouched by this plan:** `git show HEAD:lib/hmi/turn-text.cjs` (HEAD = `6077f94d7`, the commit immediately before this plan's own edit) vs the working tree after editing: `classifyPrecedingUserContentSource.toString()` is byte-identical (Node `===` on the two strings returns `true`). This is the correct, scoped comparison -- it proves this plan preserved the CR-01 fix and changed nothing else in that function.
- **No STOP triggered:** D-11 states the proof is the replay, not a source-text grep against a now-stale baseline; the replay (below) is clean. No file outside `files_modified` was touched. No architectural question was raised.
- **Files affected:** none beyond the plan's own declared `lib/hmi/turn-text.cjs`.
- **Impact on plan:** none -- the 357 replay and `tests/run-all-357.sh` both prove no Stop-hook verdict moved.

---

**Total deviations:** 0 auto-fixed. One disclosed acceptance-check false-positive (stale `PLAN_BASE` snapshot vs. an unrelated, already-landed 357-review fix), resolved by comparing against the actual pre-edit HEAD instead, which passed.
**Impact on plan:** None. No scope creep, no unplanned file touched.

## Issues Encountered

None beyond the disclosed acceptance-check note above.

## 357 Replay Comparison (D-11)

Captured to scratch files before and after the edit, using `scripts/replay-card-fire.cjs --surface both --baseline compare --json`:

| | Before | After |
|---|---|---|
| entries | 60 | 60 |
| evaluated | 60 | 60 |
| false_blocks | 0 | 0 |
| new_misses | 0 | 0 |
| parity_mismatches | 0 | 0 |
| known_misses | 1 | 1 |
| known_false_blocks | 1 | 1 |

Per-entry outcome diff across all 60 ids: **0 mismatches** (programmatic comparison, both directions -- no id present in one run and missing from the other).

`bash tests/run-all-357.sh </dev/null`: **PASS=16 FAIL=0 SKIP=0**, both before and after (log diff shows only PID numbers differ).

## Layer-h Replay Counts (SPEC R7, this plan's own scope)

`node tests/test-360-snapshot-replay.cjs --layer h </dev/null`:

- attribution baseline reproduced: harness=33, human=2, other=0 (before any verdict)
- **post: harness unbound fires 33 -> 0**
- **post: human unbound fires 2 -> 2** (unchanged)
- 0 human-attributed runs ever carry a harness verdict
- other-class unbound fires unchanged (0 -> 0)

(Layer c, which needs 360-07's `cwdRoomsHomeVerdict`, was not run to completion in this plan -- it is out of this plan's scope by design, D-19/RED-until-360-07, and `--layer h` was used explicitly per the plan's own verify step.)

## Stub Tracking

None. No new stubs, placeholders, or empty-value flows introduced.

## Threat Flags

None new. This plan's own `<threat_model>` targets were directly verified:
- **T-360-03** (a human prompt misread as harness): `tests/test-360-leads.cjs`'s D-12 mid-text-quote, Skill-body, image-lead, and slash-command-lead legs all pin `'typed'`.
- **T-360-10** (a silent Stop-hook verdict change): the 357 replay comparison above shows 0 changed entries.
- **T-360-11** (forking the 357 rule): `classifyPrecedingUserContentSource`'s body is verified byte-identical to the actual pre-edit HEAD.
- **T-360-07** (a new dependency or file read): `grep -c "transcript_path\|readFileSync" lib/hmi/turn-text.cjs` is still 1 (unchanged); no new `require` added.

## Verification Results

- `node tests/test-360-leads.cjs </dev/null` -- exit 0, PASS (26 checks).
- `node tests/test-357-harness-source.cjs </dev/null` -- exit 0, PASS (11 assertions).
- `node tests/test-209-primary-sidechannel.cjs </dev/null` -- exit 0, PASS (36 assertions).
- `node -e` HARNESS_LEADS frozen/5-entry/set-match + classifyUserPromptText-is-function check -- exit 0.
- `node -e` 1-arg contract (`typed,tool_result,none,none`) -- exit 0.
- Rule-body identity vs actual pre-edit HEAD (`6077f94d7`) -- exit 0 (byte-identical). Vs stale `PLAN_BASE` (`0f7a00cadf4`) -- mismatch, explained in Deviations (an unrelated, already-landed 357-review fix, not this plan's edit).
- `grep -c "transcript_path\|readFileSync" lib/hmi/turn-text.cjs` -- 1 (unchanged from before the edit).
- `grep -c "D-04" lib/hmi/turn-text.cjs` -- 1 (>= 1). `grep -c "RESEARCH Finding 4\|Finding 4"` -- 1 (>= 1).
- Em-dash guard on `lib/hmi/turn-text.cjs` and `tests/test-357-harness-source.cjs` -- 0 hits (exit 0).
- `node tests/test-360-tripwire.cjs --only r4d </dev/null` -- exit 0, PASS (1 check): harness lead list defined in exactly `lib/hmi/turn-text.cjs`, `HARNESS_LEADS` assignment found in exactly 1 file.
- `node tests/test-360-snapshot-replay.cjs --layer h </dev/null` -- exit 0, PASS: harness 33 -> 0, human 2 -> 2, 0 human runs with a harness verdict.
- Isolated `bash tests/run-all-357.sh </dev/null` -- exit 0, PASS=16 FAIL=0 SKIP=0, both before and after this plan's edit.
- 357 replay `--baseline compare --json` -- 60/60 entries, 0 false_blocks, 0 new_misses, 0 parity_mismatches, 0 changed per-entry outcomes (before vs after).
- `git log --format=%s -30 | grep -c '(360-06)'` -- 1 (>= 1).
- Task 2 conditional checks: `lead_literal_files` remainder after removing `lib/hmi/turn-text.cjs` is `[]` (R4 closure not needed); direct grep of `scripts/extract-dogfood-stop-events.cjs` and `scripts/replay-card-fire.cjs` for any harness lead literal -- 0 hits in both, confirming no edit was needed.
- `git diff --diff-filter=D --name-only HEAD~1 HEAD` (this plan's commit) -- empty, no deletions.
- Untracked files present after this plan's commit (`docs/FRAME-PROVENANCE-PRODUCT-WORKUP.md`, `docs/reviews/mindrian-system-atlas.html`, `scripts/measure-355-hit-rate.cjs`) belong to peer sessions -- left untouched, not staged.

## User Setup Required

None -- no external service configuration, no secrets, no network egress. Every check ran local-only.

## Next Phase Readiness

- **360-07** can now wire `scripts/intent-classifier.cjs` against `classifyUserPromptText` (D-06/D-07) and add `lib/core/room-bind-picker-policy.cjs`'s `cwdRoomsHomeVerdict` -- `tests/test-360-tripwire.cjs`'s `r4c` leg, `tests/test-360-harness-picker.cjs`'s R1/R2/R3/R6 legs, `tests/test-360-picker-policy.cjs`'s cwd/no-room legs, and `tests/test-360-snapshot-replay.cjs --layer c` all remain RED as expected until then (confirmed via a full `bash tests/run-all-360.sh` run: PASS=4 FAIL=4 SKIP=0, all 4 fails matching the RED-until-360-07 legs named in 360-02/-04/-05's own SUMMARY files -- no new fail introduced by this plan).
- Per this plan's own scope contract (peers share this tree), no `STATE.md` / `ROADMAP.md` / `REQUIREMENTS.md` write was made; `requirements-completed: [BIND360-04, BIND360-05, BIND360-07]` is recorded in this file's frontmatter for the orchestrator to apply.
- No blockers.

---
*Phase: 360-room-bind-picker-fires-on-harness-turns-userpromptsubmit-f-8*
*Plan: 06*
*Completed: 2026-09-24*
