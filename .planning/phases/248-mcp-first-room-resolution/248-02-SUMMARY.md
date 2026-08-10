---
phase: 248-mcp-first-room-resolution
plan: 02
subsystem: mcp
tags: [mcp, session-binding, room-resolution, honest-return, surface-probes, checkpoint]
status: checkpoint

# Dependency graph
requires:
  - phase: 248-01
    provides: "lib/mcp/session-room.cjs (resolveMcpSessionRoom, resolveSessionRoomDir), the unconditional session-binding read path, tests/run-all-248.sh with 248-02's legs pre-wired as own-file run_if gates"
provides:
  - "Honest room_bind return: effective, resolved_dir, resolved_source, and (when not effective) reason -- a post-write round-trip through the SAME shared resolver, SAME sessionId"
  - "tests/test-248-room-bind-honest-return.cjs -- 6 behaviors, 27/27 green (honest success, the room-not-on-disk lie is dead, two-bind sequence, two-session isolation, registry-untouched tripwire, ambiguity branch untouched)"
  - "tests/test-248-surface-probes.cjs -- the CTX-03 scripted merge gate, 3 surface-equivalent legs (CLI/Desktop stdio, Cowork HTTP with real per-connection isolation), 25/25 green, 0 skips"
  - "docs/ENV-TUNING.md MINDRIAN_MCP_FIRST entry (net-new -- none existed before this phase)"
  - "docs/CANON-PHASE-MAP.md Phase 248 row (canon_parts 7, 8, 9, 11)"
  - "CHANGELOG.md Fixed entry under the current Unreleased heading"
affects: ["248-02 Task 4 (defect close-out, runs post-checkpoint-approval only)", "the release-pickup checklist (real-host Desktop/Cowork confirmation, a stated deferral)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Post-write round-trip through the SAME shared resolver as the honesty mechanism: a handler that writes state re-reads it through the identical read path before reporting success, so the write end and the read end are verified against each other on every call (in-process seam-liveness proof, not just a write confirmation)"
    - "MCP SDK Client + StdioClientTransport / StreamableHTTPClientTransport as the standard live-drive harness for CJS tests (reused verbatim from lib/mcp/adapter-client.cjs's own usage, Canon Part 7) -- preferred over hand-rolled JSON-RPC framing for anything beyond a single stdio round trip"
    - "A daemon-lifecycle env flag (MINDRIAN_MCP_FIRST) and a room-resolution flag can share one name but govern entirely different concerns after a collapse; the doc fix is to name the SURVIVING consumers explicitly (grep-verified) rather than describe the flag's effect in the abstract"

key-files:
  created:
    - tests/test-248-room-bind-honest-return.cjs
    - tests/test-248-surface-probes.cjs
  modified:
    - lib/mcp/tool-router.cjs
    - tests/run-all-248.sh
    - CHANGELOG.md
    - docs/ENV-TUNING.md
    - docs/CANON-PHASE-MAP.md
    - .planning/phases/248-mcp-first-room-resolution/deferred-items.md

key-decisions:
  - "honestBindResult() lives as a closure-local helper inside the room_bind handler (both the explicit-room and cwd-auto-bind success paths call it), not a new lib/mcp/ module -- the round-trip is a two-line call into the ALREADY-SHARED session-room.cjs, so a third module would be reuse-before-build friction, not reuse"
  - "reason discriminates room_not_on_disk (the write succeeded, the safe slug has no directory on disk, the resolver's existsSync gate failed leg A) from binding_not_effective (the honest catch-all -- e.g. an unsafe slug writeSessionBinding silently rejected) -- both are legitimate 'effective:false' causes and the plan's own spec asked for both to be distinguishable"
  - "the needs_binding_card ambiguity branch and the F.8 connector descriptor are BYTE-UNCHANGED -- confirmed by Test 6's exact-keys assertion (ok/bound/needs_binding_card only, no new fields leaked onto that branch) and by build-connector-registry.cjs --check staying green with zero descriptor diff"
  - "the Cowork-equivalent surface probe sets MINDRIAN_MCP_FIRST=cowork in ONLY that leg's spawned child env -- a daemon-lifecycle prerequisite (per-connection extra.sessionId requires the per-session HTTP transport map, itself flag-gated in bin/mindrian-mcp-server.cjs), not a room-resolution dependency; this is the same doctrine documented in the new ENV-TUNING.md entry, so the test and the doc do not contradict each other"
  - "CHANGELOG's Fixed entry landed under the CURRENT '[Unreleased] -- v1.16.0-beta.12 (in progress)' heading, not a 'v2.0.0-beta' heading (the plan's literal text) -- no such heading exists in the file, and the phase constraint is explicit: no version bumps. Relabeling the heading would itself be a version-identifier change"
  - "docs/ENV-TUNING.md's MINDRIAN_MCP_FIRST section is NET-NEW, not an amendment -- grepped docs/ tree-wide before writing; no prior entry existed anywhere. 'Amend' became 'add'; the outcome (an accurate, current entry) is what the plan's must_have actually asked for"

requirements-completed: []
# NOTE: this plan's frontmatter declares [CTX-02, CTX-03]. Marking them
# complete is deferred until Task 4 closes the carried defect post-checkpoint
# (CTX-03's own must_have names the live CLI before/after as part of the bar;
# that leg has not run yet -- see "Checkpoint Outcome" below). Do not mark
# complete from a mid-plan checkpoint state.

# Metrics
duration: 95min
completed: 2026-08-10
---

# Phase 248 Plan 02: Honest room_bind Return + CTX-03 Surface Probes (Tasks 1-2) Summary

**room_bind now round-trips through the shared resolver after every write and reports what the next read will actually see (effective/resolved_dir/resolved_source/reason); the CTX-03 merge gate is scripted and green on all three surface-equivalent transports, including a real two-connection HTTP isolation proof. STOPPED at Task 3's human checkpoint -- the live CLI before/after has not run yet.**

## Performance

- **Duration:** 95 min (Tasks 1-2 only; Task 3/4 not started)
- **Tasks:** 2 of 4 completed (Task 3 is the checkpoint this plan stops at; Task 4 runs only after approval)
- **Files created:** 2 (both new test files)
- **Files modified:** 6

## Accomplishments

- **The room_bind lie is closed.** Before this plan, `room_bind` returned an unconditional `{ok:true, bound:true}` even when the bound slug had no directory on disk. It now round-trips through `lib/mcp/session-room.cjs`'s `resolveMcpSessionRoom`, with the SAME sessionId, right after the write, and reports `effective`, `resolved_dir`, `resolved_source`, and (only when not effective) `reason`. The round-trip is additive -- the `needs_binding_card` ambiguity branch and the F.8 connector descriptor are byte-unchanged.
- **27/27 green** on `tests/test-248-room-bind-honest-return.cjs`'s six behaviors: honest success, the room-not-on-disk lie is dead, the two-bind sequence (the 2026-07-29 first-bind-remnant repro, now dead), two-session isolation, the registry-untouched tripwire (T-248-04), and the ambiguity branch untouched.
- **25/25 green, 0 skips** on `tests/test-248-surface-probes.cjs`'s CTX-03 scripted merge gate: CLI-equivalent and Desktop-equivalent (stdio, fresh spawn per session), and Cowork-equivalent (HTTP, ONE daemon spawn, TWO concurrent client connections proving real per-connection isolation -- the one proof stdio structurally cannot give). No leg needed to SKIP in this sandbox.
- **Pre-existing regression suites (`test-room-bind-stdio-session-fallback.cjs`, `test-room-bind-health-signal.cjs`) stayed green with zero re-pointing** -- the new fields are genuinely additive.
- **Doc discipline closed a real gap, not just a phase-local one:** `docs/ENV-TUNING.md` had NO `MINDRIAN_MCP_FIRST` entry anywhere before this plan (grep-confirmed tree-wide). It now names the flag's two surviving live consumers explicitly (the write-PERMISSION gate in `isWritePathEnabled`; the HTTP daemon-lifecycle branch in `bin/mindrian-mcp-server.cjs`), re-verified via `grep -rn "isMcpFirst(" lib/ bin/ --include=*.cjs` at execution time.

## Task Commits

1. **Task 1a (RED): red for honest room_bind return** - `f3bbdaa5` (test)
2. **Task 1b (GREEN): honest room_bind return via post-write round-trip** - `da0cc1af` (feat)
3. **Task 2: CTX-03 scripted surface-equivalent probes + doc updates** - `907b1708` (feat)

_Plan-metadata commit (this SUMMARY + STATE.md + ROADMAP.md) follows, per protocol, once the checkpoint's outcome is recorded._

## Files Created/Modified

- `tests/test-248-room-bind-honest-return.cjs` - the six-behavior honest-return contract test (created)
- `lib/mcp/tool-router.cjs` - `room_bind` handler: added `honestBindResult()`, called from both the explicit-room and cwd-auto-bind success paths
- `tests/test-248-surface-probes.cjs` - the CTX-03 three-leg scripted merge gate (created)
- `tests/run-all-248.sh` - both new test files added to the phase's em-dash sweep target list (their own-file `run_if` gates were already wired in 248-01, so no gating change was needed -- they simply flipped from SKIP to a real run once authored)
- `CHANGELOG.md` - Fixed entry under the current Unreleased heading
- `docs/ENV-TUNING.md` - net-new `MINDRIAN_MCP_FIRST` section
- `docs/CANON-PHASE-MAP.md` - new "v2.0.0 MCP-First Room Resolution addition" section, Phase 248 row
- `.planning/phases/248-mcp-first-room-resolution/deferred-items.md` - appended the `doctor --acceptance` pre-existing-failure entry (see Deviations)

## Decisions Made

See frontmatter `key-decisions`. The two worth restating in prose: (1) the `reason` field's two values (`room_not_on_disk` vs `binding_not_effective`) are both legitimate honest outcomes, not one "real" reason and one placeholder -- the test suite exercises only `room_not_on_disk` because that is the only reachable case through the public handler surface (an unsafe slug never reaches `honestBindResult` with a mismatched `boundSlug`, since `writeSessionBinding` silently drops it and the round-trip then reads whatever the session's PRIOR `primary` was, or nothing); `binding_not_effective` is documented as the honest catch-all for completeness, not independently proven live in this plan. (2) `MINDRIAN_MCP_FIRST=cowork` in the HTTP probe leg's own spawn env does not reintroduce a room-resolution dependency on the flag -- it is documented, in both the test file's header comment and `docs/ENV-TUNING.md`, as the flag's OWN remaining daemon-lifecycle concern.

## Deviations from Plan

### Auto-fixed Issues

None this plan carried no red-caused-by-a-bug auto-fixes -- both tasks landed clean on the planned design (RED confirmed for the right reason at Task 1, GREEN on the first implementation pass).

### Plan-text Adjustments (documented, not silently absorbed)

**1. [Rule 2-adjacent -- filled a genuine doc gap] `docs/ENV-TUNING.md` had no MINDRIAN_MCP_FIRST entry to "amend"**
- **Found during:** Task 2 (doc updates)
- **Issue:** The plan's action text says "amend the MINDRIAN_MCP_FIRST entry"; grepping `docs/` tree-wide found zero prior mentions of the flag anywhere in documentation.
- **Fix:** Added a new section instead of amending a non-existent one. Content matches the plan's intent (room resolution no longer consults the flag; enumerate the two surviving live consumers, re-grepped at execution time).
- **Files modified:** `docs/ENV-TUNING.md`
- **Verification:** `grep -qi "no longer" docs/ENV-TUNING.md` (the plan's own acceptance grep) passes.
- **Committed in:** `907b1708`

**2. [Rule 1-adjacent -- the plan named a heading that does not exist] CHANGELOG.md has no "v2.0.0-beta Unreleased heading"**
- **Found during:** Task 2 (doc updates)
- **Issue:** The plan's action text says "Fixed entry under the v2.0.0-beta Unreleased heading"; the file's actual current heading is `## [Unreleased] -- v1.16.0-beta.12 (in progress)`.
- **Fix:** Added the Fixed entry under the ACTUAL current Unreleased heading. Renaming the heading itself would be a version-identifier change, forbidden by this plan's own explicit constraint ("no version bumps").
- **Files modified:** `CHANGELOG.md`
- **Verification:** Entry present, em-dash-free, under `[Unreleased]`.
- **Committed in:** `907b1708`

### Scope-boundary items (logged, not fixed)

**`doctor --acceptance` pre-existing failures (install-state, version-of-record-published).** Ran `node scripts/doctor.cjs --acceptance` after Task 2: 14/16 points pass (up from 13/16 measured mid-task, purely because `verify-release-clean-tree` flipped PASS once this plan's own in-progress changes were committed). The two remaining failures are release-lockstep version drift (`install-state.json` stale at beta.7 vs beta.13; marketplace `source.ref` pinned to beta.13 vs an expected beta.11) -- neither file was touched by any 248-01/248-02 task, and both predate this plan (confirmed identical across the 13/16 and 14/16 runs). Logged to `.planning/phases/248-mcp-first-room-resolution/deferred-items.md` per the executor scope boundary; not fixed here.

---

**Total deviations:** 2 plan-text adjustments (both doc-only, both preserve the plan's stated intent), 0 auto-fixed bugs, 1 scope-boundary item logged and deferred.
**Impact on plan:** None of these affect CTX-02's or CTX-03's must_haves or verification commands. No scope creep.

## Issues Encountered

None blocking. The `doctor --acceptance` mid-task run surfaced a false-looking "tracked-file drift" failure that was simply this plan's own uncommitted work in progress -- resolved itself once Task 2 was committed (confirmed by re-running the same command before/after).

## User Setup Required

None - no external service configuration required. Pure local code + doc changes, zero new dependencies (the MCP SDK's `Client`/`StdioClientTransport`/`StreamableHTTPClientTransport` classes used in the new surface-probe test are already a direct dependency, already used the same way by `lib/mcp/adapter-client.cjs`).

## Checkpoint Outcome

**STOPPED at Task 3 (`checkpoint:human-verify`, gate=blocking) -- not yet run.**

Task 3 requires a FRESH Claude Code CLI session in this repo (the current session's MCP server predates this plan's fix and will not show it -- per the release-liveness hard rule, a running session never hot-reloads). It is operator-only: only a human can start a genuinely fresh CLI session against this dev repo's `.mcp.json`. The checkpoint text, verbatim, as it will be presented to the operator:

> **What was built:** Plans 248-01 + 248-02 tasks 1-2: the nine-copy collapse, unconditional binding reads, honest room_bind return, and scripted probes green on CLI-, Desktop-, and Cowork-equivalent transports. The BEFORE leg is already on the record in the RCA (Evidence 2026-07-28 03:40-03:55: bind reported success, reads resolved /home/jsagi/room; plus the 2026-07-29 two-bind remnant repro) - you do not need to re-run broken code.
>
> **How to verify:**
> 1. Start a FRESH Claude Code CLI session in /home/jsagi/dev/MindrianOS-Plugin (fresh session = the MCP server spawns fresh from the fixed dev-repo code via .mcp.json; this satisfies the release-liveness rule without waiting on the v2.0.0-beta train. Your CURRENT session's server predates the fix and will NOT show it - do not test here).
> 2. Fixture: `bash scripts/room-registry set-active <some-room-that-is-NOT-mindrianOS>` (a real room, e.g. jonathan-sagir), so the global pointer is deliberately stale relative to the bind target.
> 3. In the fresh session call room_bind({room: "mindrianOS"}) -> expect ok:true AND effective:true AND resolved_dir "/home/jsagi/MindrianRooms/mindrianOS".
> 4. Call room_state_bound (or suggest_next / reach_candidates for the sensor-spine leg) in the SAME session -> expect room_dir "/home/jsagi/MindrianRooms/mindrianOS", NOT the room you set active in step 2 (the before-behavior).
> 5. Re-bind: room_bind({room: "jonathan-sagir"}), then room_state_bound -> expect jonathan-sagir's path (the 2026-07-29 first-bind-remnant case, now dead).
> 6. Optional negative: room_bind({room: "no-such-room"}) -> expect effective:false, reason "room_not_on_disk".
>
> If STATE.md content looks corrupted (null bytes) during step 4, that is the separate UNCONFIRMED state-ops wrinkle - report it, it gets its OWN debug file, it does not block this checkpoint.
>
> **Resume signal:** Type "approved" (all steps matched) or describe exactly which step diverged and what you saw.

Task 4 (closing the carried defect on the record: RCA file to `resolved/`, knowledge-base append, room-side compositing handoff) runs ONLY after this checkpoint returns "approved". It has not started.

## Next Phase Readiness

Tasks 1-2's automated surface is fully proven (52 assertions across the two new test files, both phase-runner-wired, zero skips). What remains before this plan can close is entirely the human leg: approve the live CLI before/after, then Task 4's paperwork. No blockers, no architectural concerns -- both tasks landed on the researched design without a Rule 4 escalation.

---
*Phase: 248-mcp-first-room-resolution*
*Completed: 2026-08-10 (Tasks 1-2 only; plan not yet complete)*

## Self-Check: PASSED

All created files verified present on disk (`tests/test-248-room-bind-honest-return.cjs`,
`tests/test-248-surface-probes.cjs`, this SUMMARY). All three task commit hashes
(`f3bbdaa5`, `da0cc1af`, `907b1708`) confirmed present in `git log --oneline --all`.
