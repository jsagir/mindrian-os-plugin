---
phase: 270-memory-and-context-operator-mcp-consolidate-scattered-local-
plan: 12
subsystem: mcp
tags: [phase-close, token-budget, navigator-gate, dev-research-compositing, deduplication]

requires:
  - phase: 270-05
    provides: "the per-read Resource room resolution that made room://state a genuine in-process duplicate of room_state_bound, the precondition for the OQ-6 gate"
  - phase: 270-06
    provides: "the exported measure() function and the frozen BASELINE constant, so this plan could subtract rather than assert"
  - phase: 270-07
    provides: "lib/core/icm-forest.cjs's listRoomRoots(), plus that plan's SUMMARY note recording the room.cjs duplication as temporary and assigning its collapse here"
  - phase: 270-08
    provides: "mos://tree and the mos://room/{slug}/tree template, which depend on listRoomRoots's current return shape and therefore constrained the direction of the delegation"
  - phase: 270-09
    provides: "context_assemble, one of the three added tools the measured token delta accounts for"
  - phase: 270-10
    provides: "graph_reason, another of the three added tools"
  - phase: 270-11
    provides: "identity_write, the third added tool, and the Phase 267.2 W2 hand-off this plan carries into the ROADMAP"
provides:
  - "AFTER and DELTA constants in tests/test-270-tool-schema-budget.cjs: the phase's token effect as arithmetic rather than a claim"
  - "the OQ-6 navigator verdict of record (keep), with Assumption A2 explicitly carried forward as unverified"
  - "lib/mcp/tools/room.cjs's listRooms() collapsed onto lib/core/icm-forest.cjs, closing plan 270-07's recorded follow-up"
  - "MEMOP-01 through MEMOP-15 registered in .planning/REQUIREMENTS.md with the plan-time caveat"
affects: []

tech-stack:
  added: []
  patterns:
    - "Re-baselining a drift alarm is a NAMED, single-plan privilege rather than an ambient allowance. Plan 270-06 wrote the escape into its own failure message ('if this legitimately changed, plan 270-12 is where the baseline is updated, not this file'), and this plan is the only place that exercised it. BASELINE stays exported and byte-untouched as the historical record while the live assertions moved to AFTER, so a future unplanned tool addition trips the alarm again instead of finding it permanently disarmed."
    - "A measurement test whose fifth assertion deliberately checks POPULATION and not DIRECTION. Asserting the delta went down would have converted Pitfall P2 (do not assume a token win) into a build rule that manufactures one, so the check verifies the arithmetic exists and prints it, and the honest direction is stated in prose instead."

key-files:
  created:
    - .planning/phases/270-memory-and-context-operator-mcp-consolidate-scattered-local-/270-12-SUMMARY.md
  modified:
    - lib/mcp/tools/room.cjs
    - tests/test-270-tool-schema-budget.cjs
    - .planning/ROADMAP.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "The OQ-6 verdict was `keep`, so Task 2's Half A (retirement) did not run at all. room_state_bound, its connector descriptor, and its registry rows are byte-untouched. This is the outcome the plan named in advance as valid and complete, and it means the phase's only contemplated removal did not happen and Assumption A2 stays unverified."
    
  - "listRooms() delegates DOWN to lib/core/icm-forest.cjs's listRoomRoots(), never the reverse. A lib/mcp/* module may depend on lib/core/*; the opposite direction would invert the layering. The choice was additionally forced by plan 270-08's mos://room/{slug}/tree template already depending on the core function's current return shape, so adapting inside room.cjs was the only safe direction even if the shapes had differed. They did not differ: listRoomRoots returns the identical { home, rooms } contract with the same env precedence, the same hidden-entry skip, the same sort, and the same empty-array-on-error behaviour."
    
  - "The four surviving MINDRIAN_ROOMS_HOME mentions in room.cjs are prose, not code, and were deliberately kept. Task 2's acceptance criterion asked for a literal grep count of 0, but satisfying it literally would have required editing the shipped room_list tool DESCRIPTION and its connector hitl_why, which would have changed the tool-schema bytes this same task was measuring and risked test-234-tool-description-floor. The criterion's stated PURPOSE ('delete the now-duplicated MINDRIAN_ROOMS_HOME fallback chain') is fully met: zero lines of resolution code remain. See Deviations."
    
  - "The room trail was authored in full but NOT landed, because scripts/write-scope-check blocked the write against a stale active room (launchpad-02). The guard was not bypassed, not worked around via Bash, and the registry was not mutated. Landing it is a one-command navigator action. See Deviations and Open Items."

requirements-completed: [MEMOP-10, MEMOP-14]

duration: 55min
completed: 2026-08-27
---

# Phase 270 Plan 12: Phase Close, Measured Delta and the Gated Retirement Summary

**The phase that set out to consolidate a memory surface measured itself spending 1,210 more tokens than it started with, and says so. The one retirement it contemplated was put to a human and came back `keep`, so it did not happen and Assumption A2 stays honestly unverified. The Phase 270 suite went from PASS=10 FAIL=1 to PASS=11 FAIL=0, where the single prior FAIL was this plan's own designed drift alarm waiting to be re-baselined.**

## Performance

- **Duration:** 55 min
- **Tasks:** 3 (Task 1 a blocking human gate, Tasks 2 and 3 auto)
- **Files modified:** 4 (0 new source files; 1 new SUMMARY)

## OQ-6 VERDICT

**The navigator's reply, verbatim: `Keep`.**

Recorded as the plan's `keep` branch. `room_state_bound` is NOT retired. Its `server.tool()`
registration, its `connectors` descriptor, and both generated registry rows are byte-untouched.

**Host tested: NONE.** No foreign, non-Claude-Code MCP host was available to exercise. This is
exactly the condition the plan named as a clean `keep`: "If the host cannot list or read resources
at all, that is a clean NO and the tool stays," and "`keep` is a valid and complete answer if no
foreign host is available to test."

Outcome of each of the three checks, run against the current build (HEAD at `e508fedc` when the legs
were re-run):

| Check | Result | Evidence |
|---|---|---|
| 1. Runtime instructions and prose do not name the tool | **PASS** | `grep -rn "room_state" lib/mcp/runtime-instructions.cjs commands/ skills/ agents/` returned ZERO hits (grep exit 1). Nothing the model reads on every session tells it to call `room_state_bound`, so retiring it would not have broken the instruction loop, and no 2048-byte-cap rewrite would have been needed. |
| 2. In-process Resource/Tool parity holds | **PASS** | `node tests/test-270-resource-session-room.cjs` is 4/4 green, including leg 3 verbatim: "parity (OQ-4 designed invariant): `room://state` and `room_state_bound` return the same room for the same session". |
| 3. Exercise `room://state` from a foreign MCP host | **NOT RUN** | No foreign host available. `270-VALIDATION.md`'s Manual-Only Verifications table (rows MEMOP-11 and MEMOP-12) had already recorded that no automated harness exists for a non-Claude-Code MCP host, which is precisely why this was a human gate rather than a test. |

**Assumption A2 remains UNVERIFIED and is carried forward, not quietly resolved.** Its original
wording stands unchanged: "Cowork and foreign MCP hosts support `resources/list` and `resources/read`
well enough to retire a Tool. Risk if wrong: retiring `room_state_bound` breaks a surface. VERIFY
BEFORE RETIRING." The ROADMAP's carried-forward block was rewritten to state this and to assign the
third check to whoever next proposes retiring a Tool in favour of a Resource.

The reasoning generalizes and is worth preserving: in-process parity is evidence about ONE host. The
Tri-Polar rule (CLI, Desktop, Cowork) makes a same-process proof insufficient for a cross-surface
retirement, and a duplicate costing roughly 250 bytes of schema is cheaper than a silently broken
surface on a host nobody tested.

Task 1 modified no files, as required: `git status --porcelain lib bin scripts data` was empty at
the end of the gate.

## Tool-schema token effect (MEMOP-10, BEFORE and AFTER)

Both constants were produced by the SAME exported `measure()` function in
`tests/test-270-tool-schema-budget.cjs`, against the same live `tools/list` stdio probe, so the
delta below is arithmetic and not two methodologies compared.

**BASELINE (plan 270-06, frozen, still exported byte-untouched):**

| Field | Value |
|---|---|
| `measuredAt` | 2026-08-27 |
| `plan` | 270-06 |
| `toolCount` | 36 |
| `totalDescBytes` | 12724 |
| `totalSchemaBytes` | 15945 |
| `totalBytes` | 28669 |
| `approxTokens` | 7167 |
| router / atomic | 9 / 27 |

**AFTER (plan 270-12, this plan):**

| Field | Value |
|---|---|
| `measuredAt` | 2026-08-27 |
| `plan` | 270-12 |
| `toolCount` | 39 |
| `totalDescBytes` | 14136 |
| `totalSchemaBytes` | 19373 |
| `totalBytes` | 33509 |
| `approxTokens` | 8377 |
| router / atomic | 9 / 30 |

**DELTA (derived at module load, exported):**

| Metric | Absolute | Percent |
|---|---|---|
| `toolCount` | +3 | +8.33 |
| `totalBytes` | +4840 | +16.88 |
| `approxTokens` | +1210 | +16.88 |

**Router-versus-atomic split, both sides.** BASELINE 9 router / 27 atomic; AFTER 9 router / 30
atomic. The router count did not move at all: the 9 grouped multi-command dispatchers
`lib/mcp/tool-router.cjs` registers are untouched by this phase. The entire +3 landed on the atomic
side. The partition is derived from the live schema (a grouped dispatcher carries an
`inputSchema.properties.command` enum; an atomic tool does not), not from a hardcoded name list, so
it stays correct as the surface changes.

**The honest net direction, in one sentence: this phase INCREASED the tool-schema token budget by
about 1,210 approximate tokens, roughly 16.88 percent.**

Which additions caused it: the three ADDED atomic tools, `context_assemble` (plan 270-09),
`graph_reason` (plan 270-10) and `identity_write` (plan 270-11), account for the whole increase. The
two tools plan 270-06 MOVED into `lib/mcp/tools/dual-path.cjs` were byte-neutral (same descriptions,
same schemas, verified byte-identical at move time). The one tool the phase contemplated retiring
was kept, so none of its bytes came back.

Whether the Resource migration compensates, stated with its limits: this phase moved real read
surface onto MCP Resources (`room://state` fixed to resolve per read in plan 270-05, plus `mos://tree`
and the `mos://room/{slug}/tree` template in plan 270-08, per RESEARCH.md 4.1 items 1, 4, 5 and 11).
Resources do not appear in `tools/list`, so they cost ZERO against this budget while carrying real
per-turn read capability. **The tool-schema number alone cannot show that**, and this SUMMARY does
not claim it nets out. Judging the trade honestly requires a per-turn context measurement that this
phase did not build. The correct conclusion is "the tool budget grew by 1,210 and some read
capability moved to a channel this metric is blind to," not "the increase is offset."

Two further qualifications: `approxTokens` is a characters-divided-by-four PROXY recorded as
Assumption A1, comparable only against another number this same function produced (which is exactly
how it is used); and RESEARCH.md's Don't Hand-Roll table forbade vendoring a tokenizer, so no more
precise figure was available without a new dependency the phase's Package Legitimacy Audit had
already ruled out.

Pitfall P2 was "assuming fewer tools means fewer tokens." The fifth `check()` this plan added asserts
the delta is POPULATED and deliberately does not assert a DIRECTION, because a test that failed when
the number went up would be the same error wearing a green badge.

## Accomplishments

- **Task 1 (blocking gate):** ran both machine-checkable legs FOR the navigator before asking
  anything, leaving only the genuinely human part. Verdict `keep` recorded above. Zero files touched.
- **Task 2 Half A:** correctly SKIPPED per the verdict.
- **Task 2 Half B:** `lib/mcp/tools/room.cjs`'s `listRooms()` now delegates to
  `require('../../core/icm-forest.cjs').listRoomRoots()`, closing the duplication plan 270-07's
  SUMMARY explicitly assigned to this plan. The local `MINDRIAN_ROOMS_HOME` fallback chain and the
  now-unused `node:os` require are gone. Dependency direction is `lib/mcp` -> `lib/core`, and
  `icm-forest.cjs` was already on the server's load path via `lib/mcp/resources.cjs:36`, so the
  delegation adds no cold-start cost.
- **Task 2 Half C:** `AFTER` and `DELTA` added and exported; a fifth `check()` added; the two
  drift-alarm assertions re-baselined from `BASELINE` to `AFTER` with a comment naming this plan as
  the authorized place; `BASELINE` left byte-untouched. The trailing duplicate `module.exports` (the
  one that actually wins at load time) was also updated, without which every requiring caller would
  have silently received a module with no `AFTER` or `DELTA`.
- **Task 3 Part 2 (ROADMAP):** Phase 270 entry updated to 12/12 PHASE COMPLETE, the 270-12 checkbox
  checked with what it actually delivered, the measured token effect recorded inline, the OQ-6
  carried-forward block rewritten from "verified or explicitly left unverified" to the real verdict
  and the real unverified-A2 status, and the Compositing line corrected to the honest trail status.
- **Task 3 Part 3 (REQUIREMENTS):** MEMOP-01 through MEMOP-15 registered with per-row checkbox state
  and substantive one-line behaviours, the Traceability count updated 55 -> 70, and the "minted at
  plan time" caveat appended in the Phase 266 and 269 precedent wording.

### `room_list` wire-response verification method (recorded per acceptance criterion)

Deep-equality by serialized comparison, not `git stash`. `listRooms()`'s return value was captured to
a scratch file via `JSON.stringify` BEFORE the Half B edit, then re-serialized after and compared for
string identity. Result: **byte-identical, 771 bytes, 37 rooms**. The `MINDRIAN_ROOMS_HOME` override
path was separately re-probed on both sides with a nonexistent directory and returned the identical
`{"home":"/nonexistent-xyz","rooms":[]}`, confirming both the env precedence and the
empty-array-on-error behaviour survived the delegation. `git stash` was deliberately not used.

## Deviations from Plan

### 1. [Rule 3 - Blocking] The room trail could not be written: write-scope guard, stale active room

- **Found during:** Task 3, Part 1
- **Issue:** The `Write` to
  `~/MindrianRooms/rethinking-mindrianos/research/2026-08-27-memory-context-operator/` was blocked by
  the `scripts/write-scope-check` PreToolUse hook: "Blocked: write to rethinking-mindrianos denied.
  Active room is launchpad-02." Confirmed at source: `~/MindrianRooms/.rooms/registry.json` carries
  `active = launchpad-02`, and the hook's `readActiveRoom` reads exactly that field.
- **Why this is not a misfiling:** the destination is mandated three ways over: CLAUDE.md's
  Dev-Research Compositing section, `270-RESEARCH.md`'s closing reminder which names this exact path,
  and this plan's own Task 3. The guard is firing on a stale active-room binding this session never
  established, which is the room-context bleed already recorded as an open WATCH item.
- **Action taken:** the guard was NOT bypassed. Specifically, the trail was NOT written via a Bash
  heredoc to evade the PreToolUse hook, and `.rooms/registry.json` was NOT mutated to flip the active
  room (that file is shared state and this working tree is documented as shared across concurrent
  sessions, so flipping it could disrupt another session). Self-authorizing past a user-installed
  guard is not a deviation an executor gets to make alone.
- **What WAS done:** the trail was authored in full and staged at
  `/tmp/claude-1000/-home-jsagi/ad418367-9bd7-445c-b5dd-f5463dd3d5ec/scratchpad/2026-08-27-memory-context-operator.md`,
  the destination directory was created (a `mkdir`, which the hook does not gate), and the ROADMAP's
  Compositing line was corrected to state the real status instead of asserting a filing that had not
  happened.
- **Files modified:** `.planning/ROADMAP.md` (honest status wording)
- **Resolution:** one navigator action, `/mos:rooms switch rethinking-mindrianos`, then copy the
  staged file into the created directory. Content needs no edits.

### 2. [Rule 1 - Scope correction] Four `MINDRIAN_ROOMS_HOME` mentions kept in `room.cjs`

- **Found during:** Task 2, Half B
- **Issue:** the acceptance criterion reads `grep -c 'MINDRIAN_ROOMS_HOME' lib/mcp/tools/room.cjs`
  returns 0. After the delegation it returns 4.
- **What the 4 actually are:** all prose, zero code. Two are documentation comments (one pre-existing
  on `listRooms`, one added by this plan describing the delegation's resolution precedence), one is
  inside the shipped `room_list` TOOL DESCRIPTION ("List every room directory under
  MINDRIAN_ROOMS_HOME..."), and one is inside that tool's connector `hitl_why`.
- **Why the literal criterion was not met:** meeting it would have required editing the shipped tool
  description, which (a) changes the tool-schema byte count that this very same task was measuring,
  making the AFTER number a measurement of my own edit rather than of the phase, (b) risks
  `tests/test-234-tool-description-floor.cjs`, and (c) would delete an accurate, useful statement
  about the env var the tool genuinely honors, degrading the description for no benefit.
- **Why the criterion's PURPOSE is met:** the action text states the intent plainly, "Delete the
  now-duplicated `MINDRIAN_ROOMS_HOME` fallback chain from `room.cjs`." Zero lines of resolution code
  remain; the fallback chain and the `node:os` require it needed are both gone. `grep -c 'icm-forest'`
  returns 3 (at least 1 required).

### 3. [Rule 3 - Blocking, self-resolving] Acceptance `bash tests/run-all-270.sh` reports FAIL=0

Not a deviation in outcome, but worth recording because the starting state looked like a failure.
The suite was `PASS=10 FAIL=1` before this plan, and the single FAIL was
`test-270-tool-schema-budget.cjs`'s own drift alarm correctly reporting `measured=39 baseline=36`.
That alarm was DESIGNED to fail until this plan re-baselined it, and 270-06 wrote the instruction
into its own failure message. Half C is that re-baseline. Final: `PASS=11 FAIL=0 SKIP=0`.

## Authentication Gates

None.

## Verification

| Gate | Result |
|---|---|
| `bash tests/run-all-270.sh` | **PASS=11 FAIL=0 SKIP=0** (was PASS=10 FAIL=1) |
| `bash tests/run-all-266.sh` | PASS=9 FAIL=0 SKIP=0 |
| `node tests/test-270-tool-schema-budget.cjs` | 5 passed, 0 failed (five green checks) |
| `BASELINE` / `AFTER` / `DELTA` export probe | ok, `AFTER.plan === '270-12'`, `toolCount` 39 |
| `grep -Ec 'TODO\|FIXME\|<n>\|XXX'` on the budget test | 0 |
| `node scripts/build-connector-registry.cjs --check` | exit 0 |
| `node scripts/build-orchestration-projection.cjs --check` | exit 0 |
| `node scripts/check-render-coverage.cjs` | exit 0 |
| `node tests/test-270-connector-coverage.cjs` | exit 0 |
| `node tests/test-234-tool-description-floor.cjs` | exit 0 |
| `node lib/mcp/no-instructions.test.cjs` | exit 0 (untouched; no instructions edit was needed) |
| `node scripts/doctor.cjs --acceptance` | 17/18, only `verify-release-clean-tree` failing on this plan's own uncommitted files mid-run. NO new failure versus baseline |
| Registry regeneration | `build-connector-registry.cjs` re-run produced NO diff under `data/`, correct given the `keep` verdict left every connector unchanged |
| `.planning/STATE.md` frontmatter | byte-unchanged; the file was never opened for edit and no `state.*` or `phase.*` mutation verb was called |
| Em-dashes | 0 in every file written, repo and staged trail alike |

## Known Stubs

None.

## Open Items

1. **The `rethinking-mindrianos` trail is written but not landed.** This is the one thing keeping
   Phase 270 from being fully closed. Blocked on `/mos:rooms switch rethinking-mindrianos`, then a
   copy of the staged file. Until then the Compositing mandate's "same finding, two homes,
   cross-linked" is half-satisfied: the repo half is complete and points at the room path, the room
   half exists as content but not at its address.
2. **Assumption A2 stays unverified** (OQ-6), carried on the ROADMAP with the third check assigned to
   whoever next proposes a Tool-to-Resource retirement.
3. **OQ-2's identity-write TRIGGER** remains Phase 267.2 W2's, which must not build a second writer.
4. **OQ-3's constitutional question** (is `hitl_shape` R16-mandated for MCP tools) remains open, with
   plan 270-11's empirical observation recorded.
5. **OQ-7's two sub-points** remain surfaced only, deliberately kept separate on the ROADMAP: the five
   candidate missing sections, and the `team-execution` within-section structure gap.
6. **Three boot-bound MCP call sites** (`registerPrompts`, `registerCapabilities`, and the `roomDir`
   at `bin/mindrian-mcp-server.cjs:119`) remain as plan 270-05 left them.

## Self-Check: PASSED

- `lib/mcp/tools/room.cjs` FOUND, modified, delegation in place
- `tests/test-270-tool-schema-budget.cjs` FOUND, exports `BASELINE` / `AFTER` / `DELTA` / `measure`
- `.planning/ROADMAP.md` FOUND, Phase 270 marked 12/12 PHASE COMPLETE
- `.planning/REQUIREMENTS.md` FOUND, MEMOP-01..15 registered, Traceability updated to 70
- `.planning/phases/270-.../270-12-SUMMARY.md` FOUND (this file)
- Commit `de8df7b8` FOUND in `git log`
- Staged trail file FOUND at the scratchpad path named above
- Room trail destination directory FOUND (created, empty, awaiting the navigator's room switch)
