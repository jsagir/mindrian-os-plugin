---
phase: 355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi
plan: 19
subsystem: eureka-side-channel
tags: [side-channel, schema-bump, sens-13, dedup-ledger, atomic, verification-stamp]

requires:
  - phase: 355-06
    provides: "lib/core/verification-stamp.cjs (Stamp, TIERS, BACKENDS, REASONS) and lib/core/verification-stamp-format.cjs (formatPathText) -- the runner requires the former for its closed enums (not on the hook path); the sensor requires only the latter (zod-free)"
  - phase: 355-10
    provides: "rs-differential-scorer.cjs's scoreMeasured already delegates to direction-convention.cjs classify(), so the pair this plan's SURPRISE_TYPES alias validates is already honestly labeled"
  - phase: 355-12
    provides: "the (moves in 355-19) carve-out entries in tests/test-355-direction-readers.cjs's static sweep, and the D-07 alias pattern (const X = DIRECTIONS;) this plan applies to the last two files"
provides:
  - "lib/core/eureka/eureka-reach-runner.cjs: SIDE_CHANNEL_SCHEMA_VERSION=2, CRITIC_TAGS_SCHEMA_VERSION=1 (decoupled probeGuard check), SURPRISE_TYPES aliasing DIRECTIONS, buildSideChannelPayload/validateClosedSchema carrying the v2 key set (stamp + opportunity_handle), writeStampedSideChannel(roomDir, opts), markEurekaReachSurfaced(roomDir, handle), EUREKA_REACH_LEDGER_RELPATH"
  - "lib/core/sensors/sensor-eureka.cjs: SCHEMA_VERSION=2, FIRING_SURPRISE_TYPES aliasing DIRECTIONS, read-only fire-once ledger dedup, evidence bag gains opportunity_handle + six stamp_* fields (stamp_path via formatPathText)"
  - "tests/test-355-side-channel-v2.cjs: 63 assertions proving the v2 schema, the writer, the dedup ledger and the evidence bag"
  - "tests/fixtures/213/last-eureka.json: valid v2 fixture (stamp null, opportunity_handle null)"
affects: [355-20, 355-22, 355.1]

tech-stack:
  added: []
  patterns:
    - "Decoupled probe version: a producer that probes an unrelated external contract (data/eureka-critic-tags.json's own schema_version) must validate against that contract's OWN version constant, never the producer's own side-channel version -- bumping one must never silently break the other (research C3)"
    - "Flattened closed sub-object, not a nested Stamp: the side channel's own `stamp` key is a hand-flattened rendering of a lib/core/verification-stamp.cjs Stamp (verification/backend/direction/judge/reason/path_nodes/path_edges), stricter-charset-checked (no newline in a path node) than the Stamp's own PathSchema -- the wire fence is allowed to be tighter than the adapter that produces the value"
    - "Read-only ledger replication (sensor-url-ingest.cjs precedent): a sensors/ file that dedups against a producer's ledger replicates the relpath constant locally and never requires the producer module, keeping the sensor's own dependency graph free of the (zod-carrying) writer side"

key-files:
  created:
    - tests/test-355-side-channel-v2.cjs
  modified:
    - lib/core/eureka/eureka-reach-runner.cjs
    - lib/core/sensors/sensor-eureka.cjs
    - tests/fixtures/213/last-eureka.json
    - tests/test-213-sensor-eureka.cjs
    - tests/test-213-part8-boundary.cjs
    - tests/test-355-direction-readers.cjs
    - .planning/phases/355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi/deferred-items.md
    - .planning/ROADMAP.md

key-decisions:
  - "The runner requires lib/core/verification-stamp.cjs directly for TIERS/BACKENDS/REASONS (rather than hand-copying the enum literals) because the runner is explicitly NOT on the hook path (an async side-channel producer + the filing-layer writer) -- the plan's own read_first names this exact require-not-copy pattern. The sensor never does this; it stays zod-free and only ever requires verification-stamp-format.cjs's pure formatPathText."
  - "writeStampedSideChannel's pair-shape check reuses isPairShape (requires both {handle, text}) unchanged rather than relaxing it for the filing-layer caller -- a stamp writer still needs the measured differential's own text-bearing pair to build score/bridge fields; 355-20 supplies both."
  - "markEurekaReachSurfaced treats a corrupt existing ledger as absent (overwrites with a fresh { schema_version: 1, entries: {} } rather than propagating the parse error) -- the writer's job is to record a fire, not to diagnose a pre-existing corruption; the READ side (sensor) is where corrupt-ledger fail-closed matters for correctness (a corrupt ledger must never look like 'never surfaced', so the sensor treats it as already-surfaced/no-fire, not as an invitation to re-fire)."
  - "Task 3's evidence-bag stamp_reason is '' both when payload.stamp is null AND when a verified stamp legitimately carries reason:null -- the plan's behavior list only specifies 'null on the hook-path scan producer' for the stamp sub-object as a whole; collapsing both no-reason cases to the same empty string keeps the evidence bag's own type contract flat (every value a string or number, matching the Rule 2 differential-only-non-integer assertion in the new test)."

patterns-established:
  - "Wire-fence-stricter-than-adapter: when a closed schema on the wire re-renders a value already validated by a separate zod schema (here, the Stamp adapter's PathSchema), the wire-side validator may add its own stricter charset/length checks (no CR/LF in a path node) rather than trusting the adapter's own looser bounds -- T-355-92."

requirements-completed: [HIPS-06, HIPS-01]

duration: 95min
completed: 2026-09-24
---

# Phase 355 Plan 19: Eureka Side Channel v2 + Fire-Once Ledger Summary

**`eureka-reach-runner.cjs`'s `SIDE_CHANNEL_SCHEMA_VERSION` and `sensor-eureka.cjs`'s `SCHEMA_VERSION` both move 1 to 2 in one atomic commit, with the critic-tags probe decoupled onto its own `CRITIC_TAGS_SCHEMA_VERSION` so `probeGuard` stays `available:true`; the closed schema gains `stamp` and `opportunity_handle`, a new `writeStampedSideChannel`/`markEurekaReachSurfaced` pair gives the filing layer (355-20) and the surfacing seam (355-22) a real writer and an idempotent fire-once ledger, and SENS-13's evidence bag gains `opportunity_handle` plus six `stamp_*` fields while staying zod-free and read-only.**

## Performance

- **Duration:** ~95 min
- **Started:** 2026-09-24 (sequential executor on the shared main tree)
- **Completed:** 2026-09-24
- **Tasks:** 3 completed (Task 1 RED, Task 2 and Task 3 each GREEN)
- **Files modified:** 1 created, 7 modified

## Accomplishments

- `lib/core/eureka/eureka-reach-runner.cjs`: `CRITIC_TAGS_SCHEMA_VERSION = 1` now gates `probeGuard`'s critic-tags comparison (decoupled from the side-channel's own version, closing the research-C3 "partial bump silently degrades to guard_unavailable" trap); `SIDE_CHANNEL_SCHEMA_VERSION = 2`; `SURPRISE_TYPES` is now `directionConvention.DIRECTIONS` (an alias, not a second copy, D-01/D-07); `buildSideChannelPayload` gained `opts.stamp` (mapped through `buildStampSubObject` to the closed, flattened `{ verification, backend, direction, judge, reason, path_nodes, path_edges }` shape, `null` when absent) and `opts.opportunityHandle` (a bounded opaque-id string or `null`); `validateClosedSchema` extended with `validateStampSub` (TIERS/BACKENDS/REASONS enum checks pulled from `verification-stamp.cjs`, a stricter-than-`PathSchema` charset/length fence on `path_nodes`/`path_edges`) and the top-level v2 key set.
- `writeStampedSideChannel(roomDir, { score, guard, a, b, stamp, opportunityHandle, now })` builds via `buildSideChannelPayload`, validates via `validateClosedSchema`, writes atomically (temp-then-rename), and returns `{ ok:false, reason }` writing nothing on any invalid input -- the writer 355-20's filing layer calls, since the existing `runEurekaScan` producer never completes in production (no live pair-derivation seam yet).
- `markEurekaReachSurfaced(roomDir, handle)` is an idempotent atomic read-modify-write of the new `<room>/.mindrian/eureka-reach-ledger.json` (`EUREKA_REACH_LEDGER_RELPATH`, `{ schema_version: 1, entries: { <handle>: { at } } }`) for the surfacing seam (355-22) to call; a corrupt existing ledger is overwritten fresh rather than propagated. SENS-14's own, unrelated ledger is untouched.
- `lib/core/sensors/sensor-eureka.cjs`: `SCHEMA_VERSION = 2`; `FIRING_SURPRISE_TYPES` aliases `DIRECTIONS`; after the existing guard/band/surprise_type gates, a non-empty `payload.opportunity_handle` triggers a **read-only** check against the replicated `EUREKA_REACH_LEDGER_RELPATH` (never requiring the runner module, mirroring the `sensor-url-ingest.cjs` precedent) -- a present entry or a corrupt ledger returns `null` (fail closed), an absent ledger or absent handle fires normally; the evidence bag gains `opportunity_handle` and `stamp_verification`/`stamp_backend`/`stamp_direction`/`stamp_judge`/`stamp_reason`/`stamp_path` (the last via `formatPathText` from `verification-stamp-format.cjs` on a verified stamp, `''` otherwise). The sensor's source still requires neither `zod` nor `verification-stamp.cjs`, and writes no file during a call.
- `tests/fixtures/213/last-eureka.json` rewritten as a valid v2 payload (`stamp: null, opportunity_handle: null`); `tests/test-213-sensor-eureka.cjs`'s mismatch arm moves 2 -> 3 and its closed-schema-writer arm asserts the new key set / `schema_version: 2` / `stamp`/`opportunity_handle` both `null`; `tests/test-213-part8-boundary.cjs`'s `validOfferPayload()` is v2-shaped.
- `tests/test-355-direction-readers.cjs`: the two `(moves in 355-19)` static-sweep exceptions for `eureka-reach-runner.cjs`/`sensor-eureka.cjs` are removed (both files now alias `DIRECTIONS`, closing the last two carve-outs from 355-12's own sweep) -- confirmed via `tests/test-355-direction-agreement.cjs` leg H, which still shows exactly the same pre-existing two hits (`rs-chain-feeder.cjs`, `test-rs-discovery-engine.cjs`), zero new.
- `tests/test-355-side-channel-v2.cjs`: 63/63 assertions across probeGuard availability, `buildSideChannelPayload`/`validateClosedSchema` v2 acceptance and every poisoned-shape rejection (v1 payload, extra top-level key, extra stamp key, a tier outside TIERS, a numeric stamp field, an over-length/newline-bearing path node, a malformed path edge), `writeStampedSideChannel`'s atomic-write-only-when-valid contract, the sensor's stamp evidence bag (verified and unverified legs, `stamp_path` truth), the fire-once dedup ledger (present/corrupt/absent/other-handle), `markEurekaReachSurfaced`'s idempotent create/update, and the static leg (no `zod`, no `verification-stamp.cjs`, no write during a call).
- Full `bash tests/run-all-213.sh`: `PASS=8 FAIL=0 SKIP=0` (unchanged pass count, confirming no regression to any existing 213 surface).

## Task Commits

Each task was committed atomically (`git commit --only`, sequential executor on the shared main tree):

1. **Task 1: RED test for the v2 side channel, the probe, the writer, the dedup ledger and the evidence bag** - `7ca368479` (test)
2. **Task 2: ATOMIC schema bump across the runner, the sensor, the 213 fixture and the two 213 tests (D-53)** - `a2413cc1a` (feat)
3. **Task 3: writeStampedSideChannel, markEurekaReachSurfaced, read-only dedup and the stamp evidence bag (D-41, D-42)** - `b56f7ee97` (feat)

**Plan metadata:**
- `ccc3542fb` (docs: deferred-items.md -- a pre-existing `tests/test-237-session-scope.cjs` Leg 4 gap logged, `git add -f` since `.planning/phases/**` is gitignored-but-force-tracked)
- `5e4d4f004` (docs: ROADMAP checkbox + Plans counter 15/28 -> 16/28, staged via `git apply --cached` against a hand-built patch to avoid sweeping a peer session's concurrent unrelated blank-line hunk near Phase 267, exactly as the 355-10/11/12/16/17/18 precedent)

## Files Created/Modified

- `tests/test-355-side-channel-v2.cjs` - the v2 schema/probe/writer/dedup/evidence-bag RED-then-GREEN suite (63 assertions)
- `lib/core/eureka/eureka-reach-runner.cjs` - `CRITIC_TAGS_SCHEMA_VERSION`, `SIDE_CHANNEL_SCHEMA_VERSION=2`, `SURPRISE_TYPES` alias, v2 `buildSideChannelPayload`/`validateClosedSchema`, `writeStampedSideChannel`, `markEurekaReachSurfaced`, `EUREKA_REACH_LEDGER_RELPATH`
- `lib/core/sensors/sensor-eureka.cjs` - `SCHEMA_VERSION=2`, `FIRING_SURPRISE_TYPES` alias, read-only ledger dedup, stamp evidence fields
- `tests/fixtures/213/last-eureka.json` - valid v2 fixture
- `tests/test-213-sensor-eureka.cjs` - mismatch arm 2->3, writer arm key-set/version amended
- `tests/test-213-part8-boundary.cjs` - `validOfferPayload()` v2-shaped
- `tests/test-355-direction-readers.cjs` - the two `(moves in 355-19)` carve-outs removed
- `.planning/phases/355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi/deferred-items.md` - the `test-237-session-scope.cjs` Leg 4 pre-existing gap logged
- `.planning/ROADMAP.md` - 355-19 row checked, Plans counter 15/28 -> 16/28

## Decisions Made

See key-decisions in frontmatter: requiring the Stamp adapter's enums directly in the runner (never on the hook path), keeping `isPairShape`'s `{handle, text}` contract unchanged for the writer, treating a corrupt ledger as absent on the write side vs. fail-closed on the read side, and collapsing both "no stamp at all" and "verified stamp with no reason" to the same `''` evidence value.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - test bug] `writeStampedSideChannel`'s own RED-test call sites were missing the pair's required `text` field**
- **Found during:** Task 3, running `tests/test-355-side-channel-v2.cjs` after landing the writer
- **Issue:** Task 1's own test called `writeStampedSideChannel` with `a: { handle: 'n042' }` / `b: { handle: 'n317' }` (no `text`), so `isPairShape` (which requires both `handle` and `text` to be strings, reused unchanged from the existing producer path) correctly rejected the pair as malformed, returning `{ ok:false, reason:'schema_violation' }` instead of the expected `ok:true`. The writer's own logic was correct; the test fixture was under-specified.
- **Fix:** Added `text: 'alpha'` / `text: 'omega'` to both the valid-input and invalid-stamp writer test cases.
- **Files modified:** `tests/test-355-side-channel-v2.cjs`
- **Verification:** re-ran the suite; all 63 assertions pass
- **Committed in:** `b56f7ee97` (Task 3 commit; caught and fixed before the commit landed, no separate fix commit needed)

### Scope-boundary items (documented, not auto-fixed)

**2. [Scope Boundary] `tests/test-237-session-scope.cjs` Leg 4 (MUTATION) pre-existing failure, confirmed unrelated**
- **Found during:** The regression sweep over every file that `require`s `eureka-reach-runner.cjs` or `sensor-eureka.cjs`
- **Issue:** Leg 4 fails with `Cannot find module './sensors/sensor-content-relevance.cjs'` inside the test's own tmp-dir mutated copy of `insight-sensors.cjs`.
- **Why not fixed:** The test's own hardcoded `SENSOR_REQUIRE_FILES` allow-list (authored in Phase 237-04) was never updated when Phase 244-05 added `sensor-content-relevance.cjs` (nor for three later sensors); `sensor-eureka.cjs` is already correctly present in that list, confirming this plan's own files are not the gap. `git status --short` on both files shows zero diff from this plan.
- **Files modified:** none; logged to `deferred-items.md`
- **Verification:** `node tests/test-237-session-scope.cjs` -- Legs 1-3 pass, Leg 4 fails identically regardless of this plan's changes (the missing entries predate this session)
- **Committed in:** `ccc3542fb` (deferred-items.md addition)

---

**Total deviations:** 1 auto-fixed (Rule 1, a test-fixture bug caught before commit); 1 documented scope-boundary item (pre-existing, unrelated). No functional impact on this plan's own deliverables -- both tasks' automated verify commands and acceptance_criteria greps pass exactly as specified.

## Issues Encountered

- `git commit --only -m "<msg>" -- <paths>` requires `-m` before `--`; an initial attempt placed `--` before `-m` and git parsed the heredoc message as a second pathspec (harmless: the commit simply failed with "pathspec did not match", nothing was committed). Corrected the argument order for every subsequent commit.
- `.planning/ROADMAP.md` on disk carried the same peer-session concurrent unrelated hunk flagged in the shared-tree briefing (a blank-line removal near Phase 267). Resolved via the established precedent: built a patch from `git show HEAD:.planning/ROADMAP.md` plus my own two edits applied to that clean copy, applied it to the index only with `git apply --cached`, confirmed via `git diff --cached` that exactly my two hunks were staged, committed the index directly (no `--only`, no `-a`), then hand-applied the identical two edits to the on-disk working-tree file via `Edit` so it matches the new `HEAD` for my rows while leaving the peer's hunk untouched and still unstaged (`git diff` after confirms only the peer's hunk remains).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `writeStampedSideChannel` and `markEurekaReachSurfaced` are ready for 355-20 (the filing layer) and 355-22 (the surfacing seam) to call; neither is called from within this plan (the must_haves' own D-53 C4 phrasing names 355-20 as the real producer).
- SENS-13's evidence bag now carries everything a downstream consumer needs to render a stamped eureka offer (`opportunity_handle`, the six `stamp_*` fields including a pre-rendered `stamp_path`) without touching `verification-stamp.cjs` itself.
- Phase 355.1 (already planned, executes after 355) builds directly on these two exported seam names (`writeStampedSideChannel`, `markEurekaReachSurfaced`) and the closed v2 schema, per the orchestrator's own briefing -- both names and the schema shape are stable now.
- Blocker/concern carried forward: none blocking any other 355 plan. `tests/test-237-session-scope.cjs`'s own `SENSOR_REQUIRE_FILES` gap (deviation 2 above) is carried forward in `deferred-items.md` for the navigator/a future phase.
- STATE.md intentionally NOT touched this run, per the shared-tree briefing (concurrent Phase 357/358/360/361 sessions in the same working tree; STATE.md writes are unsafe here, per the 355-06..18 precedent). `.planning/ROADMAP.md`'s phase-355 checklist row (355-19 checked, Plans counter 16/28) is the durable progress record instead.

---
*Phase: 355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi*
*Completed: 2026-09-24*

## Self-Check: PASSED

All 8 created/modified files verified present on disk (`tests/test-355-side-channel-v2.cjs`,
`lib/core/eureka/eureka-reach-runner.cjs`, `lib/core/sensors/sensor-eureka.cjs`,
`tests/fixtures/213/last-eureka.json`, `tests/test-213-sensor-eureka.cjs`,
`tests/test-213-part8-boundary.cjs`, `tests/test-355-direction-readers.cjs`,
`deferred-items.md`); all five commits (`7ca368479`, `a2413cc1a`, `b56f7ee97`,
`ccc3542fb`, `5e4d4f004`) verified present in `git log`.
