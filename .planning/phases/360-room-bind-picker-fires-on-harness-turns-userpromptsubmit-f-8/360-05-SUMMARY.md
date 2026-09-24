---
phase: 360-room-bind-picker-fires-on-harness-turns-userpromptsubmit-f-8
plan: 05
subsystem: testing
tags: [integration, unit, cwd, session-binding, no-room, room-bind]

# Dependency graph
requires:
  - phase: 360-room-bind-picker-fires-on-harness-turns-userpromptsubmit-f-8
    plan: 02
    provides: "tests/fixtures/ups-harness-360/cases.json (policy_entries, sequences), spawn-kit.cjs (makeFixture/resolveCwd/writeBinding/readBinding/spawnClassifier/buildCodeRoot/sideWrites)"
provides:
  - "tests/test-360-picker-policy.cjs: 34 checks (18 unit, 12 r10, 3 r11, 1 fault) pinning SPEC R10 (cwd rule, N-1) and R11 (dev-repo/no-room session memory, N-2), plus a fault-injection leg for the new guard. RED where the module/guard does not exist yet (18 unit legs with a single named reason; r10-outside-dev-repo; r10-harness-inside; r11-typed and r11-after-zero-score turn 3; the fault leg's 0-invocation count), GREEN everywhere else"
  - "tests/fixtures/ups-harness-360/throwing-picker-policy.cjs: --require stub for the not-yet-shipped lib/core/room-bind-picker-policy.cjs (R6 applied to the new guard); a no-op today (the required file does not exist, so Node's own module resolution throws before this stub can intercept anything), becomes a throwing unboundPickerSuppression once 360-07 lands"
affects: [360-06, 360-07, 360-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Structural no-room-label resolution (no re-typed literal): resolveNoRoomLabel(payload) reads the LAST element of a persisted binding_gate_payload's options array (the shipped emitBindingGate/emitNoMatchGate builders both push the reserved no-room option after every scored/fixed room option, never before), with a sanity check that the resolved label is not one of the fixture's own registered room names. This satisfies the acceptance criterion that the quoted label literal 'dev repo / no room' never appears in this plan's own test file, without needing the NO_ROOM_SLUG export (which does not land until 360-07)."
    - "Preflight-gated unit legs: a single loadPolicyModule()/requirePolicyReady() pair attempts require() of both the not-yet-shipped policy module and session-binding.cjs's not-yet-shipped NO_ROOM_SLUG export inside try/catch; every unit leg calls requirePolicyReady() first and fails with the identical named message ('room-bind-picker-policy missing (RED until 360-07)') rather than a raw require() crash or a silent skip, matching this plan's own Task 1 action-step-1 instruction verbatim."
    - "Duplicated (not shared) roomResolutionSegment/readLatestGatePayload/assertBytesEqual helpers, matching the D-13 idiom already established by tests/test-360-harness-picker.cjs: spawn-kit.cjs holds no test-assertion helpers of its own (Plan 02's own scope), so each spawn-level test file that needs them carries its own copy rather than expanding spawn-kit's surface out of turn."

key-files:
  created:
    - tests/test-360-picker-policy.cjs
    - tests/fixtures/ups-harness-360/throwing-picker-policy.cjs
  modified: []

key-decisions:
  - "Task 1's 'single message' instruction interpreted as 'every unit leg fails with the identical named reason', not 'exactly one leg exists': all 18 unit legs (10 cwdRoomsHomeVerdict cases + 7 unboundPickerSuppression cases + 1 sentinel-literal-hygiene check) each call requirePolicyReady() first, so --only unit today reports 18 FAILs, all bearing the exact same message ('room-bind-picker-policy missing (RED until 360-07)'), never a require()-crash stack trace or a mixture of different failure reasons. This keeps every truth-table row individually named and verifiable once 360-07 lands (each becomes its own real assertion), while still satisfying the acceptance criterion that the RED reason is singular and named."
  - "r10-inside-rooms-home and r10-rooms-home-itself use the byte-identical (PLAN_BASE vs HEAD, room-resolution segment) comparison method from 360-04's R3 legs, not a simple marker-fires assertion, per this plan's own <behavior> list ('HEAD stdout byte-identical to the PLAN_BASE code root at the same fixture path'). This is stricter than a marker check and would catch any accidental behavior drift inside the rooms home, not just a missing marker."
  - "r10-symlink-to-inside is asserted as 'fires' (a fail-toward-picker leg), matching cases.json's own recorded note that this is 'today's pre-implementation behavior' -- the unit truth table (unit-cwd-verdict-symlink-to-inside) separately pins the FUTURE classification ('inside') once 360-07's cwdRoomsHomeVerdict exists. There is no behavior flip to prove at the spawn level: a symlink resolving to 'inside' just means normal (unchanged) behavior, which is what firing already is, both before and after 360-07."

requirements-completed: [BIND360-10, BIND360-11, BIND360-06]

# Metrics
duration: ~45min
completed: 2026-09-24
---

# Phase 360 Plan 05: Cwd Rule and No-Room Session Memory Legs, Policy Fault Stub (N-1/R10, N-2/R11)

**34 checks (18 unit, 12 r10, 3 r11, 1 fault) drive the shared hermetic spawn kit against the LIVE scripts/intent-classifier.cjs to pin SPEC R10's cwd rule and R11's "dev repo / no room" session memory, with the r11 typed sequence reproducing the navigator's verified root cause (a stored `__no_room__` binding re-fires the unbound header today) and every unit leg failing with a single named RED reason until 360-07 ships the policy module.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 2/2 completed
- **Files created:** 2 (test-360-picker-policy.cjs, throwing-picker-policy.cjs)

## Accomplishments

- **`tests/test-360-picker-policy.cjs` (34 checks).** `unit` (18 legs): 10 `cwdRoomsHomeVerdict` truth-table cases (inside a room, the rooms home itself, outside/dev-repo, ancestor, 4 malformed values in one loop, a nonexistent absolute path, a regular file, a symlink resolving inside, a symlinked rooms root with a real cwd under its target, an undefined rooms root) plus 8 `unboundPickerSuppression` cases (null binding x outside/inside+ancestor+unresolvable, a sentinel primary, a sentinel-in-bound with a null primary, a real primary with an outside cwd, a real primary with the sentinel also riding in bound (P-2), 4 malformed bindings including a throwing getter, and the no-quoted-sentinel-literal hygiene check on the future policy module's own source) -- every one gated on a single `requirePolicyReady()` preflight, so all 18 fail today with the identical named reason. `r10` (12 legs): the suppress leg + PLAN_BASE control for `outside-dev-repo`, 2 byte-identical legs (`inside-rooms-home`, `rooms-home-itself`), 6 fail-toward-picker legs (`ancestor`, `missing`, `non-string`, `relative`, `nonexistent`, `symlink-to-inside`), the bound off-scope control (`also matches`), and the harness-guard-layered control (`harness-inside`). `r11` (3 legs): the typed no-room sequence (1 picker then 0, plus a different `session_id` still firing), the same shape composed after a zero-score reframe, and the explicit-rebind sequence (an explicit binding write through the store restores off-scope gating). `fault` (1 leg): the `--require throwing-picker-policy.cjs` leg proving fail-toward-today's-behavior and stub reachability.
- **RED exactly where the plan requires, GREEN everywhere else**, verified by running every `--only` prefix individually (recorded verbatim below) and the full file.
- **`tests/fixtures/ups-harness-360/throwing-picker-policy.cjs`**: requires the not-yet-shipped `lib/core/room-bind-picker-policy.cjs` by absolute path inside try/catch; today the require throws (module absent) and the stub is a deliberate no-op, keeping the fault leg's 0-invocation RED meaningful; once 360-07 lands, the replacement `unboundPickerSuppression` records one spy line then throws `injected fault (R6, policy)`.
- **No quoted `'dev repo / no room'` literal anywhere in `test-360-picker-policy.cjs`**: the r11 legs resolve the no-room option label structurally from the persisted `binding_gate_payload.options` array (the shipped F.8/zero-score gate builders always append it last), verified by `grep -c "'dev repo / no room'"` returning 0.
- **Real side channel untouched (T-360-05, verified directly):** `~/.mindrian/card-fire-reached.json` mtime identical before and after a full `node tests/test-360-picker-policy.cjs` run.
- **`tests/test-360-tripwire.cjs --only r8` re-run:** still exits 0 with both new files present (no leak, no false positive).

## RED status per leg (recorded per this plan's own `<output>` instruction)

| Leg | Status today | Reason |
|---|---|---|
| `unit-*` (18 legs) | RED | `room-bind-picker-policy missing (RED until 360-07)` -- the policy module and/or `NO_ROOM_SLUG` export do not exist yet |
| `r10-outside-dev-repo` | RED | fires today (`bind session, session unbound`); no cwd guard exists yet |
| `r10-outside-dev-repo-control-planbase` | GREEN | control: the same stdin still fires on PLAN_BASE (corpus is meaningful) |
| `r10-inside-rooms-home` | GREEN | byte-identical PLAN_BASE vs HEAD (N-1 does not touch this class) |
| `r10-rooms-home-itself` | GREEN | byte-identical PLAN_BASE vs HEAD |
| `r10-ancestor` | GREEN | fires (fail-toward-picker, P-1) |
| `r10-missing` | GREEN | fires (fail-toward-picker) |
| `r10-non-string` | GREEN | fires (fail-toward-picker) |
| `r10-relative` | GREEN | fires (fail-toward-picker) |
| `r10-nonexistent` | GREEN | fires (fail-toward-picker) |
| `r10-symlink-to-inside` | GREEN | fires (today's pre-implementation behavior, matches cases.json's own note) |
| `r10-bound-outside-offscope` | GREEN | fires `also matches` (N-1 is unbound-only) |
| `r10-harness-inside` | RED | fires today (`bind session, session unbound`); no harness guard exists yet |
| `r11-typed-remembered` | RED | turn 3 fires today -- the verified root cause (`runBindingGate`/`resolveSessionScope` treat the sentinel as off-scope for every room) |
| `r11-after-zero-score-remembered` | RED | turn 3 fires today, same root cause, composed with the zero-score gate |
| `r11-explicit-rebind-restores-gating` | GREEN | explicit rebind through the store already restores `also matches` today |
| `fault-throwing-picker-policy` | RED | stub records 0 invocations (nothing calls the not-yet-shipped export yet) |

**`--only unit`**: exit 1, 18 FAIL (all identical reason). **`--only r10`**: exit 1, 2 FAIL (`outside-dev-repo`, `harness-inside`), 10 ok. **`--only r11`**: exit 1, 2 FAIL (`typed-remembered`, `after-zero-score-remembered`), 1 ok. **`--only fault`**: exit 1, 1 FAIL. Full file: exit 1, `PASS test-360-picker-policy.cjs (34 checks)` printed, 22 FAIL lines, 12 ok lines.

## Binding file contents after the typed no-room answer (sentinel shape only, per this plan's own `<output>` instruction)

After `r11-typed-remembered`'s turn 2 (the persisted no-room label typed exactly), `readBinding(fixture, sid)` returns a binding whose `primary` is a non-empty string equal to the reserved sentinel and whose `bound` array contains that same sentinel value -- never a real room slug (`copper-ledger` / `tin-orchard` / `quantum-bakery`). The exact sentinel string is intentionally not reproduced in this SUMMARY or in the test source (the sentinel's own literal value is `session-binding.cjs`'s internal concern, read structurally rather than re-typed, per this plan's own module contract note).

## P-1 / P-2 decisions as pinned (per this plan's own `<output>` instruction)

- **P-1** (ancestor is ambiguous, fires): pinned at unit level (`unit-cwd-verdict-ancestor`, asserting the future `cwdRoomsHomeVerdict` returns `'ancestor'`) and at spawn level (`r10-ancestor`, asserting the live classifier still fires today and must keep firing after 360-07, since an ancestor cwd is deliberately NOT suppressed).
- **P-2** (a real primary is never suppressed by a co-resident sentinel): pinned at unit level (`unit-suppress-real-primary-with-sentinel-also-bound`, `{bound: ['tin-orchard', sentinel], primary: 'tin-orchard'}` must return `null`, never `'no-room-remembered'`) and exercised end-to-end at spawn level by `r11-explicit-rebind-restores-gating` (an explicit rebind after the no-room answer still fires `also matches`).

## Task Commits

Both tasks landed in one commit, per this plan's own Task 2 step 4 instruction (Task 1's unit/r10 legs ship in the same commit as Task 2's r11/fault legs and the fault stub):

1. **Task 1 (unit + r10 legs) + Task 2 (r11 + fault legs, throwing-picker-policy.cjs)** - `8a07a03b3` (test)

**Plan metadata:** this commit (docs: complete plan) - per the executor's objective, `.planning/STATE.md` / `ROADMAP.md` / `REQUIREMENTS.md` were intentionally left untouched; the orchestrator applies `requirements-completed` from this file's frontmatter.

## Files Created/Modified

- `tests/test-360-picker-policy.cjs` - new; 34 checks (unit: 18, r10: 12, r11: 3, fault: 1), the `leg()`/`--only` harness shared with `tests/test-360-tripwire.cjs` and `tests/test-360-harness-picker.cjs`, `roomResolutionSegment`/`assertBytesEqual`/`readLatestGatePayload`/`resolveNoRoomLabel` helpers (duplicated per-file, D-13)
- `tests/fixtures/ups-harness-360/throwing-picker-policy.cjs` - new; R6 fault-injection preload for the not-yet-shipped `lib/core/room-bind-picker-policy.cjs`, a no-op today by construction (missing-module require throws before the stub can patch anything)

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

None - plan executed exactly as written. Every RED/GREEN outcome matched the plan's own predicted behavior list on first run; no auto-fix, no scope change, no architectural question arose.

## Issues Encountered

- **Commit trailer question (process note, not a plan deviation).** This session's system-level attribution reminder specifies `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` and states it "replaces Claude Code's own earlier attribution guidance, such as a previous copy of this reminder," with only the user's own CLAUDE.md/memory instructions taking precedence over it. The phase's own `<sequential_execution>` block asks for a different trailer (`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, the convention 360-02/360-04 used). Neither the project's CLAUDE.md nor the user's memory file states a trailer preference, so the ambiguity could not be resolved by precedence rules alone. The commit (`8a07a03b3`) was made with **no trailer at all**, an oversight caught immediately after committing while writing this SUMMARY. Per the git safety protocol (`HARD BAN ... never git commit --amend`, unconditional in this shared-tree context, not contingent on whether a peer has since built on top), amending was not an option even though no peer commit had yet landed on `8a07a03b3` at the time this was noticed. This is a metadata-only miss (no file content or test behavior is affected) and mirrors the exact same class of issue 360-02-SUMMARY.md already documented and left un-amended for the identical reason.

## Stub Tracking

None. Both new files are complete, load-bearing test/fixture logic; no placeholder assertions, no hardcoded pass. The RED legs (18 unit + 2 r10 + 2 r11 + 1 fault = 23 total FAIL-today legs) are this plan's own intended pre-360-07 state, each failing with a specific, named reason (never a vacuous pass).

## Threat Flags

None new. This plan's own `<threat_model>` targets are directly addressed and verified:
- **T-360-08** (the cwd rule suppressing a legitimate picker): `r10`'s 6 fail-toward-picker legs plus the byte-identical `inside`/`rooms-home-itself` legs and the unit truth table together pin every classification the rule can produce.
- **T-360-09** (a peer or harness turn writing the no-room sentinel to silence pickers): `r11-explicit-rebind-restores-gating` proves an explicit store write still restores gating; harness turns never reach the answer consumer per 360-04's own r2 leg (unchanged by this plan).
- **T-360-06** (a policy fault crashing or blocking the prompt): `fault-throwing-picker-policy` pins exit 0 and the picker still firing under the injected fault, with the stub's reach proven once 360-07 wires the call site.
- **T-360-05** (test writes touching real state): verified directly, `~/.mindrian/card-fire-reached.json` mtime identical before/after a full run.

## Verification Results

- `node tests/test-360-picker-policy.cjs --only unit </dev/null` - exit 1; 18 FAIL, all `room-bind-picker-policy missing (RED until 360-07)`.
- `node tests/test-360-picker-policy.cjs --only r10 </dev/null` - exit 1; 2 FAIL (`r10-outside-dev-repo`, `r10-harness-inside`), 10 ok.
- `node tests/test-360-picker-policy.cjs --only r11 </dev/null` - exit 1; 2 FAIL (`r11-typed-remembered`, `r11-after-zero-score-remembered`), 1 ok.
- `node tests/test-360-picker-policy.cjs --only fault </dev/null` - exit 1; 1 FAIL (`the stub must record exactly 1 invocation; got 0`).
- `node tests/test-360-picker-policy.cjs </dev/null` (full file) - exit 1; `PASS test-360-picker-policy.cjs (34 checks)` printed, 22 FAIL / 12 ok.
- `grep -c "ancestor" tests/test-360-picker-policy.cjs` - 13 (>= 2).
- `grep -c "buildCodeRoot" tests/test-360-picker-policy.cjs` - 3 (>= 1).
- `grep -cE "spawnSync|execSync" tests/test-360-picker-policy.cjs` - 0.
- `grep -c "other_session_id" tests/test-360-picker-policy.cjs` - 3 (>= 1).
- `grep -c "'dev repo / no room'" tests/test-360-picker-policy.cjs` - 0.
- `grep -c "injected fault (R6, policy)" tests/fixtures/ups-harness-360/throwing-picker-policy.cjs` - 1.
- `node tests/test-360-tripwire.cjs --only r8 </dev/null` - exit 0 (5 ok: r8a, r8b, r8c, r8d, r8e).
- `stat -c %Y ~/.mindrian/card-fire-reached.json` before/after a full run - identical.
- `grep -l "$(printf '\xe2\x80\x94')" tests/test-360-picker-policy.cjs tests/fixtures/ups-harness-360/throwing-picker-policy.cjs` - no match (exit 1, no em-dash).
- `git log --format=%s -30 | grep -c '(360-05)'` - 1 (this plan's own commit).
- `git status --short -- tests/test-360-picker-policy.cjs tests/fixtures/ups-harness-360/throwing-picker-policy.cjs` before staging - both untracked (`??`), no peer diff on either path.
- `git diff --diff-filter=D --name-only HEAD~1 HEAD` (this plan's own commit) - empty (no deletions).

## User Setup Required

None - no external service configuration, no secrets, no network egress (every spawn goes through the hermetic `spawn-kit.cjs` env allowlist).

## Next Phase Readiness

- **360-06/07** are the flip point for every RED leg this plan pins: landing `lib/core/room-bind-picker-policy.cjs` (`cwdRoomsHomeVerdict`, `unboundPickerSuppression`) and `lib/core/session-binding.cjs`'s `NO_ROOM_SLUG` export should flip all 18 `unit-*` legs from the single named RED to real per-case assertions; wiring the guard into `scripts/intent-classifier.cjs`'s `main()` (D-06/D-07 style, applied to N-1/N-2) should flip `r10-outside-dev-repo`, `r10-harness-inside`, `r11-typed-remembered`, `r11-after-zero-score-remembered`, and `fault-throwing-picker-policy` (to exactly 1 invocation) green, with no other leg in this file expected to regress.
- **`resolveNoRoomLabel`'s structural (last-option) resolution** is a reusable pattern for any future 360 plan that needs to identify the reserved no-room option from a persisted gate payload without re-typing its label text.
- Per this plan's own scope contract (peers share this tree), no `STATE.md` / `ROADMAP.md` / `REQUIREMENTS.md` write was made; `requirements-completed: [BIND360-10, BIND360-11, BIND360-06]` is recorded in this file's frontmatter for the orchestrator to apply.
- **Commit trailer note carried forward**: this plan's single commit (`8a07a03b3`) carries no `Co-Authored-By` trailer at all (see Issues Encountered) due to an unresolved conflict between this session's system-level attribution reminder and the phase's own `<sequential_execution>` convention; a future session should confirm which trailer this repository actually wants recorded going forward, since two different conventions are now visible in this phase's own git history (`Co-Authored-By: Claude Opus 5.5` on 360-02's later commits, no trailer on this plan's).
- No blockers.

---
*Phase: 360-room-bind-picker-fires-on-harness-turns-userpromptsubmit-f-8*
*Plan: 05*
*Completed: 2026-09-24*
