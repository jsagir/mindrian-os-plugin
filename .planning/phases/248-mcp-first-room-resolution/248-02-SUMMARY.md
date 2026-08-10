---
phase: 248-mcp-first-room-resolution
plan: 02
subsystem: mcp
tags: [mcp, session-binding, room-resolution, honest-return, surface-probes, checkpoint]
status: complete

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

requirements-completed: [CTX-02, CTX-03]
# CTX-02 and CTX-03 marked complete 2026-08-10 after Task 3's checkpoint
# returned "approved" (live CLI before/after, .planning/phases/
# 248-mcp-first-room-resolution/248-02-LIVE-RESULT.md) and Task 4 closed the
# carried defect on the record. CTX-03 carries a stated deferral: real-host
# Desktop/Cowork confirmation is not yet done (scripted surface-equivalents
# stand as the merge evidence), tracked as a release-pickup TODO in the
# resolved RCA file, not implied "done".

# Metrics
duration: 95min
completed: 2026-08-10
---

# Phase 248 Plan 02: Honest room_bind Return + CTX-03 Surface Probes (Tasks 1-2) Summary

**room_bind now round-trips through the shared resolver after every write and reports what the next read will actually see (effective/resolved_dir/resolved_source/reason); the CTX-03 merge gate is scripted and green on all three surface-equivalent transports, including a real two-connection HTTP isolation proof. Task 3's human checkpoint returned "approved" (live CLI before/after, PASS on dev-repo code); Task 4 closed the carried defect on the record. Plan COMPLETE.**

## Performance

- **Duration:** 95 min (Tasks 1-2) + checkpoint + Task 4 close-out
- **Tasks:** 4 of 4 completed
- **Files created:** 2 (both new test files)
- **Files modified:** 8 (6 in Tasks 1-2, plus the RCA file and knowledge-base.md in Task 4)

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
4. **Task 3: live CLI before/after result recorded** - `dbe31beb` (docs)
5. **Task 4: close the carried defect on the record** - see Files Created/Modified below; committed alongside this SUMMARY's plan-metadata commit.

_Plan-metadata commit (this SUMMARY + STATE.md + REQUIREMENTS.md + ROADMAP.md) follows, per protocol._

## Files Created/Modified

- `tests/test-248-room-bind-honest-return.cjs` - the six-behavior honest-return contract test (created)
- `lib/mcp/tool-router.cjs` - `room_bind` handler: added `honestBindResult()`, called from both the explicit-room and cwd-auto-bind success paths
- `tests/test-248-surface-probes.cjs` - the CTX-03 three-leg scripted merge gate (created)
- `tests/run-all-248.sh` - both new test files added to the phase's em-dash sweep target list (their own-file `run_if` gates were already wired in 248-01, so no gating change was needed -- they simply flipped from SKIP to a real run once authored)
- `CHANGELOG.md` - Fixed entry under the current Unreleased heading
- `docs/ENV-TUNING.md` - net-new `MINDRIAN_MCP_FIRST` section
- `docs/CANON-PHASE-MAP.md` - new "v2.0.0 MCP-First Room Resolution addition" section, Phase 248 row
- `.planning/phases/248-mcp-first-room-resolution/deferred-items.md` - appended the `doctor --acceptance` pre-existing-failure entry (see Deviations)
- `.planning/debug/room-bind-mcp-first-off-falls-back-to-stale-global-active-room.md` - Task 4: moved to `.planning/debug/resolved/` via `git mv`, status `diagnosed` -> `resolved`, code-vs-wire preamble added, Resolution block rewritten (nine-copy census correction, rejected write-through named as REJECTED with its tripwire, release-pickup TODO for the two deferred real-host legs)
- `.planning/debug/knowledge-base.md` - Task 4: appended the resolved-session summary block for this slug

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

**APPROVED 2026-08-10.** The live CLI before/after ran in a fresh Claude Code CLI session against this dev repo's `.mcp.json`, executed via fresh processes (sequenced re-run after an initial concurrent probe raced). Full result: `.planning/phases/248-mcp-first-room-resolution/248-02-LIVE-RESULT.md`.

- **BEFORE leg** (shipped beta.13 cache, fresh headless session, plugin-scope tools): reconfirmed the RCA's documented dishonest before-behavior exactly - `room_bind` returned only `{ok,bound,primary,source}` with no `effective`/`resolved_dir`/`reason`; `room_state_bound` followed the GLOBAL active room, ignoring the binding; `room_bind no-such-room-xyz` "succeeded" with no disk validation.
- **AFTER leg** (dev-repo `bin/mindrian-mcp-server.cjs`, fresh process, sequenced): `room_bind mindrianOS` -> `ok:true, effective:true, resolved_dir` the real mindrianOS path, `resolved_source: session.primary`; `room_state_bound` followed the BINDING while the registry's `active` field held the decoy; a rebind took effect for the next read (the first-bind-remnant case is dead); `room_bind no-such-room-xyz` -> `effective:false, reason: room_not_on_disk, resolved_source: reg.active` (honest fallback disclosure).
- **Verdict:** PASS on the dev-repo code. Desktop/Cowork surface-equivalents were already scripted-green in Task 2; real-host confirmation remains a stated deferral to release pickup, per the fix-not-live-until-released rule (NOT yet released as of this close-out).

## Task 4: Close the Carried Defect on the Record

Ran after the checkpoint's "approved" per plan sequencing.

- **RCA file:** `.planning/debug/room-bind-mcp-first-off-falls-back-to-stale-global-active-room.md` moved via `git mv` to `.planning/debug/resolved/`. Frontmatter `status: diagnosed` -> `resolved`, `updated` timestamp bumped. Added a Source-of-Truth (code-vs-wire) preamble at resolve time. `Resolution` block rewritten: root cause stands as originally diagnosed; fix = Phase 248 plans 01+02 combined (the nine-copy collapse into `lib/mcp/session-room.cjs` with unconditional session-binding reads, plus `room_bind`'s honest post-write round-trip return); census correction recorded (nine copies, not eight - `lib/mcp/stop-gate-handler.cjs:78` was the missed ninth; `tools/stop-gate.cjs` has no copy of its own); the RCA's own short-term registry write-through patch is named REJECTED (would reintroduce the machine-wide race fixed by `0bec81b9`/PSB; `tests/test-248-room-bind-honest-return.cjs` Test 5 is the standing tripwire). Verification cites the code-vs-wire split: CODE = dev-repo local HEAD at the fix commits; WIRE = the scripted surface probes (`tests/test-248-surface-probes.cjs`) plus the live CLI after-leg above. A "release pickup TODO" line names the two deferred real-host legs (Desktop, Cowork) explicitly so the release checklist can find them.
- **Knowledge base:** `.planning/debug/knowledge-base.md` gained a new summary block for this slug (root cause, fix, verification, files changed, the nine-copy census lesson: count function definitions, not the `fallbackRoomDir` token).
- **Room-side compositing handoff (Dev-Research Compositing rule):** attempted to correct `~/MindrianRooms/rethinking-mindrianos/research/2026-07-28-room-bind-session-scope-ignored-mcp-first-off/2026-07-28-room-bind-session-scope-ignored-mcp-first-off.md`, which still says Phase 237 owns the structural fix. **BLOCKED**: this session's `write-scope-check` hook refused the write - session is bound to `jonathan-sagir`, not `rethinking-mindrianos` (`Blocked: write to rethinking-mindrianos denied... To authorize, run: /mos:rooms switch rethinking-mindrianos`). Per the plan's own out-of-repo-follow-up clause ("recorded in the SUMMARY as a handoff note rather than done here if the directory is unavailable"), this is handed off rather than force-bypassed. **HANDOFF: a follow-up session bound to (or including) `rethinking-mindrianos` must update that file's "Disposition" section to state that Phase 248 (not Phase 237) landed the structural fix, resolved 2026-08-10, dev-repo record at `.planning/debug/resolved/room-bind-mcp-first-off-falls-back-to-stale-global-active-room.md`.** Not yet done.

## Next Phase Readiness

Plan COMPLETE: all 4 tasks done, checkpoint approved, defect closed on the record. CTX-02 and CTX-03 are checked in `.planning/REQUIREMENTS.md` (CTX-03 carries the named release-pickup deferral for real-host Desktop/Cowork confirmation). Two items remain open outside this plan's own commit boundary: (1) the room-side compositing handoff above, blocked by session scope, needs a `rethinking-mindrianos`-bound session to finish; (2) the release-pickup TODO itself (real-host Desktop/Cowork verification) waits on v2.0.0-beta shipping and being picked up. No blockers, no architectural concerns on the code side - both tasks landed on the researched design without a Rule 4 escalation.

---
*Phase: 248-mcp-first-room-resolution*
*Completed: 2026-08-10 (all 4 tasks, checkpoint approved, plan complete)*

## Self-Check: PASSED

All created files verified present on disk (`tests/test-248-room-bind-honest-return.cjs`,
`tests/test-248-surface-probes.cjs`, this SUMMARY). All task commit hashes
(`f3bbdaa5`, `da0cc1af`, `907b1708`, `dbe31beb`) confirmed present in `git log --oneline --all`.
RCA file confirmed present at `.planning/debug/resolved/room-bind-mcp-first-off-falls-back-to-stale-global-active-room.md`
and absent from its old location.
