---
phase: 360-room-bind-picker-fires-on-harness-turns-userpromptsubmit-f-8
plan: 07
subsystem: infra
tags: [runtime-fix, userpromptsubmit, room-bind, cwd, session-binding, tri-polar, harness-guard]

# Dependency graph
requires:
  - phase: 360-room-bind-picker-fires-on-harness-turns-userpromptsubmit-f-8
    plan: 04
    provides: "tests/test-360-harness-picker.cjs (45 spawn-level R1/R2/R3/R6 checks, RED until this plan)"
  - phase: 360-room-bind-picker-fires-on-harness-turns-userpromptsubmit-f-8
    plan: 05
    provides: "tests/test-360-picker-policy.cjs (34 unit/r10/r11/fault checks, RED until this plan)"
  - phase: 360-room-bind-picker-fires-on-harness-turns-userpromptsubmit-f-8
    plan: 06
    provides: "lib/hmi/turn-text.cjs classifyUserPromptText + widened HARNESS_LEADS (5 entries)"
provides:
  - "scripts/intent-classifier.cjs: harnessVerdict/TURN_IS_HARNESS (D-06), the main() harness guard (D-07), the consumer guard around consumePriorBindingAnswer (D-08), extractCwd/STDIN_CWD (N-1), unboundPickerSuppressed (N-1/N-2 guard, layered after the harness guard in the same early-guard block)"
  - "lib/core/room-bind-picker-policy.cjs (new): cwdRoomsHomeVerdict(cwd, roomsRoot) -> inside|outside|ancestor|unresolvable; unboundPickerSuppression({binding, cwd, roomsRoot}) -> null|no-room-remembered|cwd-outside-unbound; both never throw, both compose existing modules (realRoomRoot, NO_ROOM_SLUG), no new store, no network"
  - "lib/core/session-binding.cjs: NO_ROOM_SLUG added to module.exports (additive only, 2 changed lines)"
affects: [360-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Layered early-guard block: the harness guard (D-07) and the N-1/N-2 cwd/no-room guard sit back to back in main(), directly after root resolution, both returning 0 on suppression and both failing toward today's picker on any fault. A harness-lead prompt with a cwd inside the rooms home still suppresses (the harness guard wins independently of the cwd rule) -- pinned by r10-harness-inside."
    - "Composed identity, not re-derived: unboundPickerSuppressed reads the SAME sessionId key (resolveSessionId(resolveActiveRoomDir())) and the same lib/core/session-binding.cjs reader the F.8/zero-score paths already use, so the guard can never diverge from what the gate itself would resolve."
    - "Sentinel reused, never re-typed: lib/core/room-bind-picker-policy.cjs imports NO_ROOM_SLUG from lib/core/session-binding.cjs rather than hard-coding the literal; a tripwire unit leg (unit-no-sentinel-literal-in-policy-module) pins 0 occurrences of the quoted string in the new file."
    - "Compact diff discipline: the plan's own acceptance ceiling on the hook diff (at most 45 non-comment, non-blank changed lines against the plan's own base commit) required trimming both new helpers to single-line try/catch bodies after the first draft measured 54 -- functionally identical, no behavior change, verified by a full re-run of every 360 leg after compaction."

key-files:
  created:
    - lib/core/room-bind-picker-policy.cjs
  modified:
    - scripts/intent-classifier.cjs
    - lib/core/session-binding.cjs

key-decisions:
  - "P-1 (ancestor is ambiguous, fires) shipped exactly as specified: cwdRoomsHomeVerdict returns 'ancestor' (not 'outside') when the cwd's realpath is a strict ancestor of the rooms home's realpath, and unboundPickerSuppression never suppresses on 'ancestor' -- pinned at unit level (unit-cwd-verdict-ancestor) and spawn level (r10-ancestor, must still fire)."
  - "P-2 (a real primary always wins) shipped exactly as specified: unboundPickerSuppression checks 'no realPrimary' before either suppression branch, so a session with any real bound primary is untouched by N-1 or N-2 even when the reserved sentinel also rides in bound -- pinned by unit-suppress-real-primary-with-sentinel-also-bound and exercised end-to-end by r11-explicit-rebind-restores-gating."
  - "P-3 (the single guard also silences strict-mode and the legacy advisory) shipped by construction: unboundPickerSuppressed sits in the SAME early-guard block as the harness guard, both before the strict-mode branch, the zero-score gate, the F.8 gate and the legacy advisory, so one early return covers all four room-resolution outputs for both session classes it targets -- same single-guard rationale as D-07, documented inline at the guard site."
  - "Diff-budget compaction (Task 2 acceptance criterion, at most 45 changed lines against this plan's own base commit 6ebdfffb3): the first draft of harnessVerdict/extractCwd/unboundPickerSuppressed measured 54 non-comment non-blank changed lines. Compacted multi-line try/catch bodies and a two-step require into single lines (no logic change) to bring the total to 40. Re-ran every 360 leg after compaction to confirm behavior was unaffected."

requirements-completed: [BIND360-01, BIND360-02, BIND360-03, BIND360-04, BIND360-06, BIND360-10, BIND360-11]

# Metrics
duration: ~65min
completed: 2026-09-24
---

# Phase 360 Plan 07: Harness Guard + Cwd/No-Room Guard Wired Into intent-classifier.cjs

**scripts/intent-classifier.cjs gains two layered early guards in main() (D-06/D-07/D-08's harness verdict, and N-1/N-2's cwd-outside/no-room-remembered policy from a new lib/core/room-bind-picker-policy.cjs), flipping all previously-RED legs from 360-02 through 360-05 to GREEN: harness-triggered picker fires go from 33 to 0 and human-triggered fires stay at 2 in the local snapshot replay.**

## Performance

- **Duration:** ~65 min
- **Tasks:** 2/2 completed
- **Files created:** 1 (lib/core/room-bind-picker-policy.cjs)
- **Files modified:** 2 (scripts/intent-classifier.cjs, lib/core/session-binding.cjs)

## Accomplishments

- **Task 1 (D-06, D-07, D-08):** added `harnessVerdict(text)` and the module-init constant `TURN_IS_HARNESS`, computed once from `STDIN_MESSAGE` through a lazy require of `lib/hmi/turn-text.cjs`'s `classifyUserPromptText` (empty stdin never loads turn-text -- verified directly). Added the single early guard `if (TURN_IS_HARNESS) return 0;` directly after `if (!message) return 0;` in `main()`, and wrapped the `consumePriorBindingAnswer` call in `if (!TURN_IS_HARNESS)`. `consumePriorF1Pick` and `emitEngineDecisionBlock` call counts are unchanged (2 and 2, matching the pre-edit HEAD). All 45 checks in `tests/test-360-harness-picker.cjs` pass, `tests/test-360-tripwire.cjs --only r4` passes (4/4), `tests/test-360-leads.cjs` passes (26/26), `tests/test-360-r3-suites.cjs --group r3` passes (6/6), `tests/test-209-engine-arm-contract.cjs` passes.
- **Task 2 (N-1, N-2):** created `lib/core/room-bind-picker-policy.cjs` exporting `cwdRoomsHomeVerdict` and `unboundPickerSuppression`, both pure, both never-throwing, both composing existing modules (`lib/core/room-path-containment.cjs`'s `realRoomRoot`, `lib/core/session-binding.cjs`'s `NO_ROOM_SLUG`). Added `NO_ROOM_SLUG` to `session-binding.cjs`'s `module.exports` (additive only, 2 changed lines). Wired `extractCwd`/`STDIN_CWD` and `unboundPickerSuppressed(root)` into `intent-classifier.cjs`, with the new guard `if (unboundPickerSuppressed(root)) return 0;` added directly after root resolution, in the same early-guard block as the harness guard. All 34 checks in `tests/test-360-picker-policy.cjs` pass on first run; no auto-fix needed for logic correctness (only the diff-budget compaction documented in Decisions).
- **Full local snapshot replay** (`tests/test-360-snapshot-replay.cjs`, no `--layer` flag, both layers): layer h (harness guard only) confirms harness unbound fires 33 -> 0, human unbound fires 2 -> 2, 0 human-attributed runs ever carry a harness verdict. Layer c (cwd rule, N-1) confirms both human unbound pre-fires resolve to cwd class `outside`, human post-fires after the cwd rule is 0, and the anchor session (56924067, a dev repo) has 0 human post-fires -- matching the SPEC's stated target for that session. Human fires under cwd class inside/ancestor/unresolvable are unchanged at 0 (nothing in that class fired pre-change either, so there is nothing to preserve there, but the rule's non-interference is directly pinned).
- **`bash tests/run-all-360.sh`:** `Phase 360: PASS=8 FAIL=0 SKIP=0` -- every leg GREEN (harness-picker, picker-policy, leads, snapshot-replay, tripwire, r3-suites/mcp/wider, the 357 compatibility leg via `run-all-357.sh`, and the em-dash guard).
- **`bash tests/run-all-357.sh`:** `Phase 357: PASS=16 FAIL=0 SKIP=0`, unchanged.
- **`tests/test-360-r3-suites.cjs`** (no `--group` filter, full run): 18 suites GREEN, including the four MCP room-bind suites (`test-248-room-bind-honest-return`, `test-248-room-bind-session-authoritative`, `test-room-bind-health-signal`, `test-room-bind-stdio-session-fallback`) named in D-18 -- no `lib/mcp/` file was touched (`test-360-tripwire.cjs --only r9` passes), and R9's Tri-Polar parity claim holds by construction.

## Task Commits

1. **Task 1: harness verdict constant, the main() harness guard and the consumer guard (D-06, D-07, D-08)** - `8a1dfa1cb` (fix)
2. **Task 2: picker-policy module, NO_ROOM_SLUG export, and the cwd / no-room guard (N-1, N-2)** - `59b2cccd2` (feat)

**Plan metadata:** this commit (docs: complete plan) - per the executor's objective, `.planning/STATE.md` / `ROADMAP.md` / `REQUIREMENTS.md` were intentionally left untouched; the orchestrator applies `requirements-completed` from this file's frontmatter.

## Files Created/Modified

- `scripts/intent-classifier.cjs` - `harnessVerdict`, `TURN_IS_HARNESS`, `extractCwd`, `STDIN_CWD`, `unboundPickerSuppressed`, the two early-guard `return 0` lines in `main()`, and the `if (!TURN_IS_HARNESS)` wrap around `consumePriorBindingAnswer`. Net diff against this plan's own base commit (`6ebdfffb3`): 40 non-comment, non-blank changed lines (at or under the plan's own 45-line ceiling).
- `lib/core/room-bind-picker-policy.cjs` - new; `cwdRoomsHomeVerdict(cwd, roomsRoot)` and `unboundPickerSuppression({binding, cwd, roomsRoot})`, 149 lines (over the plan's 60-line floor), zero network requires, zero re-typed sentinel literals, `realRoomRoot` referenced 3 times.
- `lib/core/session-binding.cjs` - `NO_ROOM_SLUG` added to `module.exports` only; 2 changed lines against the plan's base commit (additive, no other line touched).

## Decisions Made

See `key-decisions` in the frontmatter (P-1, P-2, P-3 as shipped, and the diff-budget compaction).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking, acceptance-criterion-driven] Trimmed the hook diff from 54 to 40 changed lines**
- **Found during:** Task 2, running the acceptance-criteria commands verbatim after both tasks landed.
- **Issue:** The plan's own Task 2 acceptance criterion caps the non-comment, non-blank diff against this plan's base commit at 45 lines ("Minimal hook diff"). The first working draft of `harnessVerdict`, `extractCwd`, and `unboundPickerSuppressed` (each with a multi-line try/catch and a two-step lazy-require) measured 54 lines by the exact acceptance-criterion grep.
- **Fix:** Compacted each function's try/catch and require calls onto fewer lines with no logic change (for example, `} catch (_e) {\n  return false;\n}` became `} catch (_e) { return false; }`; a two-statement `const sb = require(...); const binding = sb.readSessionBinding(...)` replaced two separate multi-line `require(path.join(...))` calls). Re-ran the full `bash tests/run-all-360.sh` and `bash tests/run-all-357.sh` after compaction to confirm no behavior changed.
- **Files modified:** `scripts/intent-classifier.cjs` (the same file, before its Task 2 commit -- no separate commit needed).
- **Verification:** `git diff 6ebdfffb3 -- scripts/intent-classifier.cjs | grep '^[-+]' | grep -v '^[-+][-+]' | grep -v '^[-+]\s*//' | grep -vc '^[-+]\s*$'` reports 40; full `bash tests/run-all-360.sh` and `bash tests/run-all-357.sh` both still fully green after the edit.

---

**Total deviations:** 1 auto-fixed (Rule 3, blocking an acceptance criterion; a mechanical compaction with no logic change, verified by a full re-run of every 360 and 357 leg).
**Impact on plan:** None on behavior. No scope creep; no file outside this plan's declared `files_modified` was touched.

## Issues Encountered

None beyond the diff-budget compaction documented above.

## Stub Tracking

None. Both new/modified production files are complete, load-bearing logic; no placeholder assertions, no hardcoded pass, no empty-value flow.

## Threat Flags

None new. This plan's own `<threat_model>` targets are directly addressed and verified by the existing 360-04/05 test suites, now GREEN:
- **T-360-01** (harness text consumed as the binding answer): `r2-sequence` in `test-360-harness-picker.cjs` confirms `captureCliActionSet` is reached 0 times on the harness turn.
- **T-360-02** (a harness turn minting an F.8 force-block): every `r1-suppress-*` leg confirms 0 side writes.
- **T-360-03** (a human turn misclassified): `r3-*` byte-identical legs and the full `test-360-leads.cjs` suite confirm 0 false positives.
- **T-360-06** (a guard fault crashing or blocking the prompt): `r6-*` legs (harness picker) and `fault-throwing-picker-policy` (picker policy) both confirm exit 0 and fail-toward-today's-behavior.
- **T-360-08** (the cwd rule silencing legitimate room work): `r10`'s fail-toward-picker legs (ancestor, missing, non-string, relative, nonexistent, symlink-to-inside) and the byte-identical inside/rooms-home-itself legs all pass.
- **T-360-09** (a harness turn writing the no-room sentinel): the harness guard runs before the N-1/N-2 guard in the same early block, and harness turns never reach `consumePriorBindingAnswer` (T-360-01's own leg), so a harness turn cannot write the sentinel through that path either.
- **T-360-11** (editing MCP or the shared scope resolver): `test-360-tripwire.cjs --only r9` passes; `git diff --name-only 6ebdfffb3..HEAD -- lib/mcp lib/core/resolve-active-room.cjs lib/workflow/session-binding-consumer.cjs` is empty.

## Verification Results

- `node tests/test-360-harness-picker.cjs </dev/null` - exit 0, PASS (45 checks).
- `node tests/test-360-picker-policy.cjs </dev/null` - exit 0, PASS (34 checks).
- `node tests/test-360-tripwire.cjs </dev/null` - exit 0, PASS (11 checks: r4a-d, r8a-e, r9, em).
- `node tests/test-360-leads.cjs </dev/null` - exit 0, PASS (26 checks).
- `node tests/test-360-r3-suites.cjs </dev/null` (no group filter) - exit 0, PASS (18 suites, includes the 4 MCP room-bind suites).
- `node tests/test-209-engine-arm-contract.cjs </dev/null` - exit 0, all assertions passed.
- `node tests/test-360-snapshot-replay.cjs </dev/null` (both layers) - exit 0. Layer h: harness unbound fires 33 -> 0, human unbound fires 2 -> 2, 0 human runs carry a harness verdict, other-class unchanged (0 -> 0). Layer c: both human unbound pre-fires resolve cwd class `outside`, human post fires after the cwd rule = 0, anchor session (56924067) has 0 human post fires, human fires under cwd class inside/ancestor/unresolvable unchanged at 0.
- `bash tests/run-all-360.sh </dev/null` - `Phase 360: PASS=8 FAIL=0 SKIP=0`.
- `bash tests/run-all-357.sh </dev/null` - `Phase 357: PASS=16 FAIL=0 SKIP=0`, unchanged.
- `grep -v '^\s*//' scripts/intent-classifier.cjs | grep -c "if (TURN_IS_HARNESS) return 0;"` - 1.
- `grep -v '^\s*//' scripts/intent-classifier.cjs | grep -c "if (!TURN_IS_HARNESS)"` - 1.
- `grep -c "isMeta\|originKind\|origin\.kind\|transcript_path" scripts/intent-classifier.cjs` - 0.
- `grep -c "consumePriorF1Pick(roomDir, sessionId" scripts/intent-classifier.cjs` and `grep -c "emitEngineDecisionBlock(roomDir, sessionId)" scripts/intent-classifier.cjs` - both 2, matching the pre-edit HEAD (`6ebdfffb3`).
- `node -e "require('./scripts/intent-classifier.cjs');..."` (empty-stdin no-turn-text-load check) - exit 0.
- `node -e "const s=require('./lib/core/session-binding.cjs');process.exit(s.NO_ROOM_SLUG==='__no_room__'?0:1)"` - exit 0.
- `grep -c "'__no_room__'\|\"__no_room__\"" lib/core/room-bind-picker-policy.cjs` - 0.
- `grep -c "realRoomRoot" lib/core/room-bind-picker-policy.cjs` - 3 (>= 1).
- `grep -cE "require\(['\"](node:)?(https?|net|http2|dgram)['\"]\)|fetch\(" lib/core/room-bind-picker-policy.cjs` - 0.
- `git diff 6ebdfffb3 -- lib/core/session-binding.cjs | grep '^[-+]' | grep -v '^[-+][-+]' | grep -vc '^[-+]\s*//'` - 2 (at most 2, additive export only).
- `git diff 6ebdfffb3 -- scripts/intent-classifier.cjs | grep '^[-+]' | grep -v '^[-+][-+]' | grep -v '^[-+]\s*//' | grep -vc '^[-+]\s*$'` - 40 (at most 45).
- `git diff --name-only 6ebdfffb3..HEAD -- lib/mcp lib/core/resolve-active-room.cjs lib/workflow/session-binding-consumer.cjs` - empty; `node tests/test-360-tripwire.cjs --only r9 </dev/null` - exit 0.
- `grep -l "$(printf '\xe2\x80\x94')" scripts/intent-classifier.cjs lib/core/room-bind-picker-policy.cjs lib/core/session-binding.cjs` - no match (em-dash guard passes).
- `git log --format=%s -30 | grep -c '(360-07)'` - 2 (>= 2).
- `git diff --diff-filter=D --name-only HEAD~1 HEAD` (both this plan's commits) - empty (no deletions).

## User Setup Required

None - no external service configuration, no secrets, no network egress. Every check ran local-only through the hermetic `spawn-kit.cjs` env allowlist.

## Next Phase Readiness

- **360-08** can now close the BIND360 requirement register and file the VALIDATION sign-off: every RED leg from 360-02 through 360-05 is GREEN, `bash tests/run-all-360.sh` and `bash tests/run-all-357.sh` are both fully clean, and the local snapshot replay reproduces the SPEC's stated target on both metrics (unbound-header fires and the cwd-rule's dev-repo-session outcome).
- No `lib/mcp/` file was touched in this plan; Tri-Polar parity (R9) holds by construction and by the four MCP room-bind suites passing unchanged.
- Per this plan's own scope contract (peers share this tree), no `STATE.md` / `ROADMAP.md` / `REQUIREMENTS.md` write was made; `requirements-completed: [BIND360-01, BIND360-02, BIND360-03, BIND360-04, BIND360-06, BIND360-10, BIND360-11]` is recorded in this file's frontmatter for the orchestrator to apply.
- No blockers.

---
*Phase: 360-room-bind-picker-fires-on-harness-turns-userpromptsubmit-f-8*
*Plan: 07*
*Completed: 2026-09-24*

## Self-Check: PASSED

- FOUND: lib/core/room-bind-picker-policy.cjs
- FOUND: this SUMMARY.md file
- FOUND: commit 8a1dfa1cb (Task 1)
- FOUND: commit 59b2cccd2 (Task 2)
- 0 em-dash characters in this file
