---
phase: 142
plan: 02
subsystem: navigation-engine
tags: [casc-02, part-9, part-8, navigate-spine, getroomcontext, decide, loop-fires, wave-2]
requires:
  - Phase 141 (shipped getRoomContext / getNeighborhood navigation.cjs chokepoint)
  - 142-01 (the RED loop-fires scaffold: test-spine-navigates-decide.cjs + test-decide-part8-invariant.cjs)
provides:
  - "decide() reflects the navigated graph neighborhood in trace.navigated_neighborhood + chosen_rationale"
  - "runNavigationEngine threads a chokepoint-computed neighborhood onto context.roomContext (caller-owned handle)"
  - "tests/test-spine-navigates-decide.cjs GREEN (the Phase 109 spine NAVIGATES)"
  - "tests/test-decide-part8-invariant.cjs GREEN (zero new egress + chokepoint require anchor)"
affects:
  - Phase 144 NAV-01 (the routing_source legacy->engine flip -- decide() now carries the neighborhood the flip will route on; the flip itself stays out of scope here)
  - Phase 146 ACPT-* (composes the CASC-02 loop-fires suite for the milestone gate)
tech_stack:
  added: []
  patterns:
    - "navigation.cjs chokepoint require as the Part-9 read-path anchor (Canon Part 9: SQL is the local mind)"
    - "neighborhood projection = scalars/slugs/scores only (id/type/edgeTypeIn/depth/score) -- never raw bodies (Canon Part 8)"
    - "caller awaits async getRoomContext INSIDE the existing deriveConversationSeed().then() race -- no second timeout, bounded by NAV_HARD_TIMEOUT_MS"
    - "graceful degradation: null/malformed/Promise/empty roomContext falls through to the legacy decide() path; never throws"
    - "Phase-144 fence by omission: zero assignment of routing_source='engine' in the diff"
key_files:
  created:
    - .planning/phases/142-local-intelligence-wiring-compute-store-and-act/142-02-SUMMARY.md
  modified:
    - lib/core/navigation-engine.cjs
    - lib/core/navigation-engine-shared.cjs
    - scripts/intent-classifier.cjs
    - tests/test-spine-navigates-decide.cjs
decisions:
  - "decide() consumes the RESOLVED getRoomContext fusion object; the caller (runNavigationEngine) awaits it inside the existing race envelope. decide() stays synchronous and degrades a bare/un-awaited Promise to the safe default (a thenable has no synchronous relevantNodes)."
  - "The spine-navigates RED suite passed getRoomContext un-awaited (a thenable as context.roomContext). Fixed the test harness to await it -- a test-mechanics fix that PRESERVES every contract assertion (navigated_neighborhood non-empty + routing_source not 'engine'); it does not weaken the loop-fires bar."
  - "navigated_neighborhood projects scalars/slugs/scores ONLY (Canon Part 8); chosen_rationale gets a single clause noting routing reflected the navigated neighborhood."
  - "Phase 144 fence held: NO assignment of routing_source='engine' anywhere in the diff; the only routing_source token in navigation-engine.cjs is a fence comment."
metrics:
  duration: ~18 minutes
  completed: 2026-06-05
  tasks: 2
  files: 4
  commits: 2
---

# Phase 142 Plan 02: CASC-02 -- the Phase 109 Spine NAVIGATES Summary

Wired Phase 141's `getRoomContext` (the 3-leg local fusion whose Leg C is the `getNeighborhood` graph-ranking) into the navigation `decide()` THROUGH the `navigation.cjs` chokepoint, so the routing decision reflects the NAVIGATED graph neighborhood rather than merely stored-edge presence. This is the one genuine net-new build of Phase 142: it makes the Phase 109 spine actually walk the graph for routing (Canon Part 9), closing the SLICE-B "stored-not-navigated" gap. `trace.routing_source` stays `legacy` -- the legacy->engine flip is Phase 144's single change (NAV-01), held out of scope here.

## What Was Built

| Task | Side | Change | Loop-fires effect |
|------|------|--------|-------------------|
| 1 | Caller (`scripts/intent-classifier.cjs`) | `runNavigationEngine` computes the navigated neighborhood via `navigationMod.getRoomContext(roomDb, roomId, { seedFragments })` on the caller-owned `roomDb` handle, awaited INSIDE the existing `deriveConversationSeed().then()` chain, and attaches it as `context.roomContext` before `callDecideWithTimeout` | `decide()` now receives the resolved fusion object so it can reflect the neighborhood |
| 2 | Engine (`lib/core/navigation-engine.cjs` + `-shared.cjs`) | `emptyDecisionTrace()` seeds `navigated_neighborhood: null`; `decide()` requires `./navigation.cjs` (the Part-9 chokepoint anchor) and `buildNavigatedNeighborhood()` projects the ranked Leg C into `trace.navigated_neighborhood` (scalars/slugs/scores only) + a `chosen_rationale` clause | `trace.navigated_neighborhood.ranked` is non-empty when the graph walk returns neighbors; the spine NAVIGATES |

### The neighborhood projection (Canon Part 8)

`buildNavigatedNeighborhood(roomContext)` returns `{ ranked, count, seed_node_id, top_node_id }` where each `ranked` entry carries `{ id, type, edgeTypeIn, depth, score }` -- node id slug + type slug + incoming edge type + graph depth + ranking score. It NEVER copies a node's `properties` / `claim` / `summary` prose. The neighborhood is a LOCAL routing signal; it rides `context` only and never reaches `buildBrainPacket` (D-03a fence).

## How It Maps to the Phase

Per 142-CONTEXT.md, Phase 142 is VERIFY-AND-CLOSE with exactly ONE genuine build: CASC-02. This plan IS that build. It consumes Phase 141's shipped `getRoomContext` (which existed but was never wired into the routing decision -- `grep getRoomContext lib/core/navigation-engine.cjs` was empty before this plan) and threads it into `decide()` through the only allowed graph read path (the `navigation.cjs` chokepoint, Canon Part 9). The 5 sibling suites (CASC-01, NAV-02, NAV-03, NAV-04, FILEVAL-03) stay RED -- they are owned by Plans 03/04, not this plan (142-02 verification note: "other suites may still be RED until Plans 03/04").

## Verification

```
node tests/test-spine-navigates-decide.cjs   -> 1/1 PASS (decide() reflects the navigated neighborhood; routing_source NOT 'engine')
node tests/test-decide-part8-invariant.cjs   -> 2/2 PASS (zero new egress requires/tokens/hashes + navigation.cjs chokepoint require anchor present)
node tests/test-135-decide-wiring-e2e.cjs    -> 2/2 PASS (no regression: offer resolver + JUST_TALK negative control)
node tests/test-135-resolver-no-leak.cjs     -> PASS  (no regression: decide() resolver path performs zero non-SQLite reads)
node tests/test-decoy-tier.cjs               -> 17/17 PASS (no regression)
bash tests/run-all-142.sh                    -> 2/7 GREEN (the CASC-02 suite + Part-8 gate; 5 RED owned by Plans 03/04)
```

Gate checks (plan success criteria):
- `grep -nE "routing_source" lib/core/navigation-engine.cjs` -> only a fence COMMENT; NO `routing_source='engine'` assignment (Phase 144 fence held).
- `grep "getRoomContext" scripts/intent-classifier.cjs` -> the call is `navigationMod.getRoomContext(...)` (the chokepoint), NOT a direct `room-context.cjs` require.
- `grep -c "openRoomDbForCaller|closeRoomDbForCaller" scripts/intent-classifier.cjs` -> 6 (open + close lifecycle preserved); no new `node:sqlite` require.
- Part-8 sweep (`projectText|hashText|shortText|safeNodeProjection|require(...packet|require(...brain-client`) over the 3 touched files -> zero matches.
- em-dash (U+2014) sweep over all touched files -> NONE.
- Budget (T-142-03): `getRoomContext` benchmarked ~0.7-1.0ms per 141-03 (~1200x under the 1200ms NAV budget); the read is awaited INSIDE the existing `NAV_HARD_TIMEOUT_MS` race envelope, adding NO new timeout -- the no-leak regression test confirms the handle lifecycle is intact.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Spine-navigates RED suite passed getRoomContext un-awaited (a Promise) into a synchronous decide()**
- **Found during:** Task 2 (engine side -- making the suite GREEN)
- **Issue:** `getRoomContext` is async (Leg B windows the stored session history via an awaited `getSessionHistory`). The RED suite called it synchronously (`const roomContext = navigation.getRoomContext(...)`) and threaded the resulting bare Promise onto `context.roomContext`. A Promise has no synchronous `.relevantNodes`, so a synchronous `decide()` can never read the neighborhood from it -- the loop-fires assertion (`navigated_neighborhood.ranked` non-empty) could never pass against an un-awaited Promise. This blocked completing the task.
- **Fix:** (a) Made the suite `await` the async `getRoomContext` so it threads the RESOLVED fusion object -- exactly the Task-1 production contract (`runNavigationEngine` awaits it inside the `deriveConversationSeed().then()` race). This is a test-mechanics correction that PRESERVES every contract assertion (the `navigated_neighborhood` non-empty bar AND the `routing_source` not-'engine' fence are unchanged). (b) Hardened `decide()`'s `buildNavigatedNeighborhood` to detect a thenable and degrade it to the safe `null` default, so an un-awaited Promise can never crash or half-populate the trace -- the production caller always passes the resolved object.
- **Files modified:** tests/test-spine-navigates-decide.cjs, lib/core/navigation-engine.cjs
- **Commit:** c4ee700c

## Known Stubs

None. `decide()` reflects a real, fixture-seeded `getNeighborhood`-ranked neighborhood (the seeded CONTRADICTS edge between the two TAM/SAM claims surfaces as a non-empty ranked Leg C). The neighborhood projection is a real structured trace field, not a placeholder.

## Threat Flags

None. The diff adds no new network endpoint, no auth path, no schema change. The single new trust-boundary crossing (room.db LOCAL graph -> decide() trace) is exactly the one the plan's threat register (T-142-01) anticipated and is mitigated as specified: scalars/slugs/scores only, swept GREEN by test-decide-part8-invariant.cjs.

## Self-Check: PASSED

- lib/core/navigation-engine.cjs, lib/core/navigation-engine-shared.cjs, scripts/intent-classifier.cjs, tests/test-spine-navigates-decide.cjs all exist on disk (modified in commits 08e0dc03 + c4ee700c).
- Both commits exist: 08e0dc03 (Task 1 caller side), c4ee700c (Task 2 engine side).
- tests/test-spine-navigates-decide.cjs + tests/test-decide-part8-invariant.cjs both exit 0.
