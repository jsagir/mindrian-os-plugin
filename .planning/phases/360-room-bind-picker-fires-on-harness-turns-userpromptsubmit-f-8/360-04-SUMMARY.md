---
phase: 360-room-bind-picker-fires-on-harness-turns-userpromptsubmit-f-8
plan: 04
subsystem: testing
tags: [integration, spawn, preload, fault-injection, byte-identical, room-bind, call-spy]

# Dependency graph
requires:
  - phase: 360-room-bind-picker-fires-on-harness-turns-userpromptsubmit-f-8
    plan: 01
    provides: "tests/fixtures/ups-harness-360/pre-phase.json (plan_base_sha, the recorded R3/MCP/wider suite baseline)"
  - phase: 360-room-bind-picker-fires-on-harness-turns-userpromptsubmit-f-8
    plan: 02
    provides: "tests/fixtures/ups-harness-360/cases.json (entries, sequences), spawn-kit.cjs (makeFixture/spawnClassifier/buildCodeRoot/sideWrites), the R4/R8/R9 tripwire"
provides:
  - "tests/test-360-harness-picker.cjs: 45 spawn-level checks -- r1 (suppression + controls A/B + fire entries + the accepted-limit entry), r2 (the call-spy sequence), r3 (byte-identical human legs), r6 (fault-injection legs). RED where 360-07 has not landed (10 r1 checks, r2, 2 r6 human checks), GREEN everywhere else (all controls, all fire entries, all 6 r3 legs, both r6 harness fail-toward legs)"
  - "tests/fixtures/ups-harness-360/capture-spy.cjs: --require call-spy on f8-action-capture-cli.cjs's captureCliActionSet (D-16, RESEARCH Finding 6)"
  - "tests/fixtures/ups-harness-360/throwing-turn-text.cjs, missing-export-turn-text.cjs: R6 fault-injection preloads for the not-yet-shipped classifyUserPromptText export (throw / missing, each recording reach via SPY_OUT_360)"
affects: [360-05, 360-06, 360-07, 360-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Call-spy preload (D-16, RESEARCH Finding 6): a --require stub requires the SAME real module by the SAME absolute path the production lazy-require will use, wraps one exported function with a call-recording line appended to a temp file (process.env.SPY_OUT_360), then delegates to the original. Proves a code path was REACHED even when the ultimate outcome is a no-op -- exactly what R2 needs, since today's bug is reach (spy count 1), not a corrupted bind (the harness body's leading tag breaks the verbatim label match, so the eventual bind still fails on its own)."
    - "Room-resolution segment extraction for cross-version R3 comparisons: main() writes at most one JSON envelope per turn via a single process.stdout.write(JSON.stringify(envelope) + '\\n') call, and JSON.stringify never emits a raw newline byte, so the segment R1/R3 actually govern is reliably 'first byte is { -> everything up to the first \\n; otherwise empty' (roomResolutionSegment helper). The trailing navigation-engine block (D-09, explicitly out of 360's scope) is excluded by this same rule, not by normalizing any byte within the compared segment."
    - "Fixture-rebuild-per-run for byte-identity legs: R3's self-consistency and cross-version comparisons each call makeFixture({at: fixedPath}) immediately before every spawn (never two spawns sharing one un-rebuilt on-disk state), because Phase 251's NAV_UNCHANGED_MARKER cache (an unrelated, legitimate feature) makes a second turn at the same UN-rebuilt fixture path print a short 'unchanged' marker instead of re-rendering -- a real behavior, but orthogonal to what this leg proves."

key-files:
  created:
    - tests/test-360-harness-picker.cjs
    - tests/fixtures/ups-harness-360/capture-spy.cjs
    - tests/fixtures/ups-harness-360/throwing-turn-text.cjs
    - tests/fixtures/ups-harness-360/missing-export-turn-text.cjs
  modified: []

key-decisions:
  - "R1 control A exception for harness-strict-mode: 360-02-SUMMARY's own strict-mode reachability finding holds -- the harness lead's '<task-notification>\\n' prefix means the whole trimmed message is no longer the bare quoted span detectStrictMode's Pattern 3 requires, so the EXACT harness-prefixed prompt falls through to the generic unbound header on PLAN_BASE, not the strict-mode marker (only the bare control_prompt, control B, reaches strict-mode). Control A for this one entry asserts 'fires some marker' rather than the specific 'strict-mode override' marker; every other entry's marker IS reachable through the harness-prefixed exact prompt (scoring is prefix-insensitive) and is asserted directly."
  - "R3 root cause 1 (self-consistency): running the second of two HEAD spawns at the SAME un-rebuilt fixture path is not byte-identical, but the cause is Phase 251's CACHE-02a navigation-engine cache (NAV_UNCHANGED_MARKER / navBlockHashPath), not R1/R2/R3/R6 -- a second turn with an unchanged decision hash legitimately prints a short '[NAV DECISION unchanged - prior block stands]' marker instead of re-rendering. Fixed by rebuilding the fixture (makeFixture({at: fixedPath})) immediately before EACH of the two self-consistency spawns, matching the pattern the cross-version comparison already used."
  - "R3 root cause 2 (cross-version): comparing FULL stdout between the PLAN_BASE code root and HEAD is also not byte-identical, and `git diff PLAN_BASE HEAD -- scripts/intent-classifier.cjs` is EMPTY (the emitter itself has not changed). The divergence is entirely in the OUT-OF-SCOPE navigation-engine block (D-09): dozens of unrelated same-day commits landed on this shared tree between PLAN_BASE and HEAD and touch its dependencies, most visibly a 454-line rewrite of data/framework-names.json plus lib/core/navigation-engine.cjs, lib/hmi/dial-label-composer.cjs and several lib/core/rs-*.cjs / lib/core/eureka/*.cjs files -- none on any 360 requirement or file list, none a 360 commit (verified: git log PLAN_BASE..HEAD -- scripts/intent-classifier.cjs lib/ lists 21 commits, none matching '(360-'). Fixed by scoping the cross-version comparison to the room-resolution segment main() itself writes (a single JSON line, gated on the leading '{' byte so a genuinely silent main() -- e.g. human-terse -- correctly compares as empty against empty rather than accidentally picking up the nav block's own header line). This is a scope decision under the plan's own diagnose-before-touching instruction (Task 2 action step 3), not byte normalization: no byte within the compared segment is altered, and the boundary is main()'s own single-JSON-line write contract, not a value picked to make the leg pass."

requirements-completed: [BIND360-01, BIND360-02, BIND360-03, BIND360-06]

# Metrics
duration: ~70min
completed: 2026-09-24
---

# Phase 360 Plan 04: Harness Picker Spawn-Level Legs (R1/R2/R3/R6, RED until 360-07)

**45 spawn-level checks over the shared spawn-kit prove R1 suppression (every harness entry, with PLAN_BASE and control_prompt controls), R2's call-spy (captureCliActionSet reached once today on a harness turn that should never reach it), R3 byte-identity for every human entry (GREEN today, with a diagnosed and fixed root cause in the comparison method itself), and R6 fault-injection fail-toward-today's-behavior for a throwing and a missing classifyUserPromptText export.**

## Performance

- **Duration:** ~70 min (includes live root-cause diagnosis of two R3 byte-mismatches, per the plan's own diagnose-before-touching instruction)
- **Tasks:** 2/2 completed
- **Files created:** 4 (test-360-harness-picker.cjs, capture-spy.cjs, throwing-turn-text.cjs, missing-export-turn-text.cjs)

## Accomplishments

- **`tests/test-360-harness-picker.cjs` (45 checks).** r1: 9 `r1-suppress-*` legs (every SPEC R5 lead shape plus the bound off-scope, bound zero-score and strict-mode controls) each asserting zero markers AND zero side writes (F.8 side channel, binding_gate_payload, zero_score_gate, strict_mode trace, offered-marker files); 10 `r1-controlA-*` legs (the exact harness-prefixed prompt fires on the PLAN_BASE code root); 9 `r1-controlB-*` legs (the control_prompt fires on HEAD); 5 `r1-fire-*` legs (the carve-out, human-direct, human-queued, mid-text quote, image lead all still fire, R1 never touches a non-harness turn); 1 `r1-acceptedlimit-*` leg (the pasted-lead entry, 0 observed cases). r2: 1 `r2-sequence` leg driving the full 3-turn CASES.sequences['r2-pending-answer'] flow with a real option label read back from the persisted decision trace. r3: 6 `r3-*` legs, one per human-origin entry. r6: 4 legs (`r6-throwing-human`, `r6-missing-human`, `r6-throwing-harness`, `r6-missing-harness`).
- **RED exactly where the plan requires, GREEN everywhere else.** `--only r1` fails with 10 named entries (9 suppress + 1 accepted-limit), every control and fire leg passing. `--only r2` fails with the literal message naming the spy count: "turn 2 (harness) must not reach captureCliActionSet (0 calls expected), got 1" -- satisfying the acceptance criterion verbatim. `--only r3` exits 0 (6/6 GREEN) after the root-cause fix below. `--only r6` fails on both human legs ("got 0 lines", the stub is never reached because nothing calls classifyUserPromptText yet) while both harness fail-toward legs pass.
- **Two R3 mismatches diagnosed live and fixed at the comparison-method level, not by touching production code or normalizing bytes** (full detail in Deviations and key-decisions): (1) two HEAD spawns at an un-rebuilt shared fixture path collide with Phase 251's unrelated NAV_UNCHANGED_MARKER cache; (2) full-stdout PLAN_BASE-vs-HEAD comparison picks up an out-of-scope (D-09) navigation-engine block that has genuinely drifted via ~21 unrelated same-day commits (most visibly a 454-line data/framework-names.json rewrite), none of them 360 commits.
- **`capture-spy.cjs`, `throwing-turn-text.cjs`, `missing-export-turn-text.cjs`**: each requires its target module by the SAME absolute path the production lazy-require will resolve to (RESEARCH Pattern 3, D-16), mutates one export, and records every call/access to a `SPY_OUT_360` temp file when set. No production env seam added.
- **Real side channel untouched (T-360-05, verified directly):** `~/.mindrian/card-fire-reached.json` mtime identical before and after a full `node tests/test-360-harness-picker.cjs` run.
- **`tests/run-all-360.sh` re-run:** `Phase 360: PASS=3 FAIL=4 SKIP=1` -- the harness-picker leg is now wired in and correctly reports FAIL (RED, as this plan's own `<verification>` predicts before 360-07), joining the pre-existing leads/snapshot-replay/tripwire RED legs from 360-02/03; the R3/MCP/wider suites leg, the 357 compatibility leg and the em-dash guard all still PASS; only the 360-05 picker-policy leg (not yet landed) SKIPs.
- **`tests/test-360-tripwire.cjs --only r8` re-run:** still exits 0 with the four new fixture files present (no leak, no false positive).

## Task Commits

Both tasks landed in one commit, per this plan's own Task 2 step 4 instruction (Task 1's capture-spy and the r1/r2 legs ship in the same commit as Task 2's r3/r6 legs and stubs):

1. **Task 1 (capture-spy.cjs, r1/r2 legs) + Task 2 (throwing/missing-export stubs, r3/r6 legs)** - `2eac2a3a6` (test)

**Plan metadata:** this commit (docs: complete plan) - per the objective, `.planning/STATE.md` / `ROADMAP.md` / `REQUIREMENTS.md` were intentionally left untouched; the orchestrator applies `requirements-completed` from this file's frontmatter.

## Files Created/Modified

- `tests/test-360-harness-picker.cjs` - new; 45 checks (r1: 34, r2: 1, r3: 6, r6: 4), the `leg()`/`--only` harness shared with `tests/test-360-tripwire.cjs`, `roomResolutionSegment`/`assertBytesEqual`/`readLatestGatePayload`/`readSpyLines` helpers
- `tests/fixtures/ups-harness-360/capture-spy.cjs` - new; R2's call-spy preload on `lib/hmi/f8-action-capture-cli.cjs`'s `captureCliActionSet`
- `tests/fixtures/ups-harness-360/throwing-turn-text.cjs` - new; R6 throwing preload on `lib/hmi/turn-text.cjs`'s (not-yet-shipped) `classifyUserPromptText`
- `tests/fixtures/ups-harness-360/missing-export-turn-text.cjs` - new; R6 missing-export (accessor-returns-undefined) preload on the same target

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] R1 control A for harness-strict-mode initially asserted the wrong marker**
- **Found during:** Task 1, first `--only r1` run
- **Issue:** My first implementation asserted every suppress-entry's `entry.marker` (when present) on control A (the exact harness-prefixed prompt on PLAN_BASE). For `harness-strict-mode` this failed: the harness lead's `<task-notification>\n` prefix means the whole trimmed message is no longer the bare quoted span `detectStrictMode`'s Pattern 3 requires, so the exact harness-prefixed prompt falls through to the generic unbound header on PLAN_BASE (`bind session`/`session unbound`), not `strict-mode override` -- exactly what 360-02-SUMMARY's own "Strict-mode reachability" section already documented.
- **Fix:** Control A for `harness-strict-mode` now asserts only "some marker fires" (the default-header fallback the plan's own behavior text names: "or the unbound header by default"); every other entry's marker is still asserted directly on control A, since scoring (unlike the strict-mode exact-quote pattern) is prefix-insensitive. Control B (the bare `control_prompt`) still asserts the specific `strict-mode override` marker for this entry, and does so successfully.
- **Files modified:** `tests/test-360-harness-picker.cjs` (the same file, before its single commit -- no separate commit needed)
- **Verification:** `node tests/test-360-harness-picker.cjs --only r1` -- `r1-controlA-harness-strict-mode` and `r1-controlB-harness-strict-mode` both `ok`.

**2. [Rule 1 - Bug] R3 self-consistency false mismatch (Phase 251's unrelated navigation cache)**
- **Found during:** Task 2, first `--only r3` run (all 6 legs FAILED with `HEAD self-consistency (two runs, same path)`)
- **Issue:** Running two HEAD spawns back-to-back at the same un-rebuilt fixture path is not byte-identical. Root cause diagnosed live (no code touched until identified): the trailing navigation-engine block is a SEPARATE, always-runs-last emitter (Phase 91-02/251) that hashes its own rendered decision and, on a second turn with the SAME hash, prints the short `[NAV DECISION unchanged - prior block stands]` marker (CACHE-02a, `NAV_UNCHANGED_MARKER`/`navBlockHashPath`, both exported by `scripts/intent-classifier.cjs`) instead of re-rendering the full block -- a real, working, unrelated feature, not an R1/R2/R3/R6 defect.
- **Fix:** Each of the two self-consistency spawns now gets its own freshly rebuilt copy of the fixture (`makeFixture({at: fixedPath})` called immediately before each spawn), matching the pattern the cross-version comparison already used. Full stdout is still compared (no scoping needed here, since a truly fresh, identical state on both sides IS byte-identical).
- **Files modified:** `tests/test-360-harness-picker.cjs`
- **Verification:** `node tests/test-360-harness-picker.cjs --only r3` -- all 6 `HEAD self-consistency` assertions `ok`.

**3. [Rule 1 - Bug] R3 cross-version false mismatch (out-of-scope nav-engine drift on the shared tree)**
- **Found during:** Task 2, same `--only r3` run, after fixing Deviation 2 (5 of 6 legs still FAILED, now on the `PLAN_BASE vs HEAD` assertion)
- **Issue:** Per this plan's own diagnostic instruction (Task 2 action step 3: "diagnose before touching anything... report non-360 commits that could explain it"), I ran `git diff PLAN_BASE HEAD -- scripts/intent-classifier.cjs` (empty -- the emitter itself is unchanged) and `git log --format='%h %s' PLAN_BASE..HEAD -- scripts/intent-classifier.cjs lib/` (21 commits, none matching `(360-`, since 360-06/07 have not landed). Direct inspection (a scratchpad-only, never-committed debug copy of the archived PLAN_BASE classifier, deleted before committing) showed PLAN_BASE's navigation-engine `decide()` call returns a falsy `out.decision` for this fixture's tier_0/no-quadruple path, while HEAD's returns a real tier_0-fallback decision object that renders a full block -- a genuine behavior difference in the navigation-engine dependency chain, most plausibly explained by the 454-line rewrite of `data/framework-names.json` (plus `lib/core/navigation-engine.cjs`, `lib/hmi/dial-label-composer.cjs` and several `lib/core/rs-*.cjs`/`lib/core/eureka/*.cjs` files) landed by unrelated same-day phases (355.x) between PLAN_BASE and HEAD. This block is explicitly out of 360's scope (CONTEXT.md D-09: "Leave these untouched on harness turns... the engine NAV block keeps running on harness turns in this phase"), so a full-stdout comparison was never the right experiment for R1/R3's actual concern.
- **Fix:** Added `roomResolutionSegment(stdout)`, gated on the leading `{` byte (main()'s own single-JSON-line write contract; JSON.stringify never emits a raw newline byte) so it correctly returns an empty string when main() itself wrote nothing (e.g. `human-terse`) rather than accidentally picking up the nav block's own header text. The cross-version assertion now compares `roomResolutionSegment(runPlanBase.stdout)` against `roomResolutionSegment(runHead.stdout)` -- the exact region R1/R3 govern, no byte within it altered or normalized.
- **Files modified:** `tests/test-360-harness-picker.cjs`
- **Verification:** `node tests/test-360-harness-picker.cjs --only r3` -- all 6 legs `ok`, exit 0.

---

**Total deviations:** 3 auto-fixed (1 Rule 1 assertion-target bug caught by the first `--only r1` run, 2 Rule 1 root-caused comparison-method bugs caught by the first `--only r3` run and diagnosed per the plan's own instructed procedure before any fix was applied).
**Impact on plan:** All three fixes are inside this plan's own new test file; none touch production code, none touch another plan's file, and none normalize a compared byte. The two R3 fixes make the leg's actual claim ("does R1/R3's own region behave identically") correct and provable on a fast-moving shared tree, rather than accidentally asserting an unrelated, independently-evolving subsystem is frozen. No scope creep.

## Issues Encountered

None beyond the two root-cause investigations documented above as deviations. Both used only read-only `git log`/`git diff` and a scratchpad-only (never committed, deleted before commit) debug copy of the archived PLAN_BASE classifier to confirm the mechanism -- no repo file was touched during diagnosis.

## Stub Tracking

None. All four new files are complete, load-bearing test/fixture logic; no placeholder assertions, no hardcoded pass. The RED legs (10 in r1, 1 in r2, 2 in r6) are the plan's own intended pre-360-07 state, each failing with a specific, named reason (never a vacuous pass).

## Threat Flags

None new. This plan's own `<threat_model>` targets are directly addressed and verified:
- **T-360-01** (a harness turn consumed as the binding answer): the `r2-sequence` leg's call-spy pins the exact reach count (1 today, RED; 0 required post-360-07), plus the binding-file-unchanged and no-`binding_gate_consumed` assertions, plus the turn-3 exact-label human follow-up still binding correctly.
- **T-360-02** (a harness turn minting an F.8 force-block): every `r1-suppress-*` leg asserts 0 F.8 side-channel records and 0 `binding_gate_payload`/`zero_score_gate`/`strict_mode` traces.
- **T-360-06** (a classifier fault blocking or crashing the prompt): the `r6-*-harness` legs assert exit 0 and the unbound header still fires under both fault shapes (fail toward today's behavior); the `r6-*-human` legs assert the human path's stdout is byte-unchanged by the same faults.
- **T-360-05** (test writes touching the real side channel): verified directly, `~/.mindrian/card-fire-reached.json` mtime identical before/after a full run.

## Verification Results

- `node tests/test-360-harness-picker.cjs --only r1 </dev/null` - exit 1; 25 `ok`, 10 `FAIL` (9 `r1-suppress-*` + `r1-acceptedlimit-accepted-limit-pasted-lead`), each naming the entry id and the markers it wrongly fired.
- `node tests/test-360-harness-picker.cjs --only r2 </dev/null` - exit 1; the failure message reads "turn 2 (harness) must not reach captureCliActionSet (0 calls expected), got 1" (the plan's own required verify command, and the acceptance criterion's literal spy-count-1 requirement).
- `node tests/test-360-harness-picker.cjs --only r3 </dev/null` - exit 0; 6/6 `ok`.
- `node tests/test-360-harness-picker.cjs --only r6 </dev/null` - exit 1; `r6-throwing-human`/`r6-missing-human` FAIL ("got 0 lines"), `r6-throwing-harness`/`r6-missing-harness` `ok`.
- `node tests/test-360-harness-picker.cjs </dev/null` (full file) - exit 1; `PASS test-360-harness-picker.cjs (45 checks)` printed, 13 FAIL lines (10 r1 + 1 r2 + 2 r6), 32 `ok` lines.
- `grep -c "buildCodeRoot" tests/test-360-harness-picker.cjs` - 4 (>= 1).
- `grep -c "SPY_OUT_360" tests/fixtures/ups-harness-360/capture-spy.cjs` - 2 (>= 1).
- `grep -cE "spawnSync|execSync" tests/test-360-harness-picker.cjs` - 0.
- `stat -c %Y ~/.mindrian/card-fire-reached.json` before/after a full run - identical.
- `! grep -l "$(printf '\xe2\x80\x94')" tests/test-360-harness-picker.cjs tests/fixtures/ups-harness-360/{capture-spy,throwing-turn-text,missing-export-turn-text}.cjs` - passes (no em-dash).
- `grep -c "injected fault (R6)" tests/fixtures/ups-harness-360/throwing-turn-text.cjs` - 1.
- `grep -c "defineProperty" tests/fixtures/ups-harness-360/missing-export-turn-text.cjs` - 1.
- `grep -c "non-deterministic output" tests/test-360-harness-picker.cjs` - 1 (no silent normalization).
- `node tests/test-360-tripwire.cjs --only r8 </dev/null` - exit 0 with the four new fixture files present.
- `bash tests/run-all-360.sh </dev/null` - `Phase 360: PASS=3 FAIL=4 SKIP=1` (harness-picker now correctly reports FAIL/RED, joining leads/snapshot-replay/tripwire's pre-existing RED legs; suites/357-compat/em-dash guard all PASS; only the not-yet-landed 360-05 picker-policy leg SKIPs).
- `git log --format=%s -10 | grep -c '(360-04)'` - 1.
- `git diff --diff-filter=D --name-only HEAD~1 HEAD` (this plan's own commit) - empty (no deletions).

## User Setup Required

None - no external service configuration, no secrets, no network egress (every spawn goes through the hermetic `spawn-kit.cjs` env allowlist; the diagnostic scratchpad debug copy was local-only and deleted before commit).

## Next Phase Readiness

- **360-05** can build `tests/test-360-picker-policy.cjs` against the same `spawn-kit.cjs`/`cases.json` (`policy_entries`) with no dependency on this plan's own file.
- **360-06/07** are the flip point for every RED leg this plan pins: landing `lib/hmi/turn-text.cjs`'s `classifyUserPromptText` (+ the widened `HARNESS_LEADS`) should flip `r6-throwing-human`/`r6-missing-human` green (the stub becomes reachable); landing `scripts/intent-classifier.cjs`'s D-06/D-07/D-08 guard should flip the 9 `r1-suppress-*` legs, `r1-acceptedlimit-*`, and `r2-sequence` green, with NO other leg in this file expected to regress (every control, fire, r3 and r6-harness leg is designed to hold steady across that change).
- **`roomResolutionSegment`'s leading-`{`-byte gate is a reusable pattern** for any future 360 plan that needs to compare only what `main()` itself writes against a process stdout that also carries the out-of-scope nav-engine block.
- Per this plan's own scope contract (peers share this tree), no `STATE.md` / `ROADMAP.md` / `REQUIREMENTS.md` write was made; `requirements-completed: [BIND360-01, BIND360-02, BIND360-03, BIND360-06]` is recorded in this file's frontmatter for the orchestrator to apply.
- No blockers.

---
*Phase: 360-room-bind-picker-fires-on-harness-turns-userpromptsubmit-f-8*
*Plan: 04*
*Completed: 2026-09-24*
