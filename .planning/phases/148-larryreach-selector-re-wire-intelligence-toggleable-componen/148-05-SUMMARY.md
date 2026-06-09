---
phase: 148-larryreach-selector-re-wire-intelligence-toggleable-components
plan: 05
subsystem: hmi
tags: [offer-resolver, suggest-next, pickShape, f1-host, brain-review, part-8, hats-persona-cache, irw-05, irw-08, irw-02]

# Dependency graph
requires:
  - phase: 148-01
    provides: "DIAL_REACH_K=6 (hats as the 6th machine reach); test-148-hats-sixth-reach read-then-rebuild assertion (stubbed, awaiting this plan's cache)"
  - phase: 148-03
    provides: "reach-component-map.json + archetype routing in selector-dispatcher.pickShape; the standing-trio; tests/run-all-148.sh aggregator (already lists this plan's 2 suites)"
  - phase: 148-04
    provides: "closeReach resolve+fire (the real-invocation path the unified host feeds)"
  - phase: 135
    provides: "resolveOffer calibration (the ONE offer it computes; untouched here)"
  - phase: 122
    provides: "command-resolver.commandsForFramework (the only framework->command door for the cold-room intent match)"
  - phase: 89.2
    provides: "rs-egress-prompts.auditQueryString (default-deny egress chokepoint)"
  - phase: 117-04
    provides: "brain-response-sanitize (A3 PII redaction, the 6th Part-8 tripwire)"
provides:
  - "offer-resolver + suggest-next + F.1 Next Move unified onto the ONE selector-dispatcher.pickShape F.1 host (IRW-05; single render door, no second bespoke renderer)"
  - "cold-room 'what can I help you with' help lead via the dispatcher text archetype; tier_0 canon fallback + standing trio beneath; six reaches lead once a JTBD signal exists (D-07/D-08)"
  - "brain-review-packet.cjs: typed methodology packet only; auditQueryString-gated outbound handle; brain-response-sanitize on responses; local contradiction COUNT via navigation.cjs; degrades to local-only on Brain-unreachable (IRW-08, D-04, zero egress)"
  - "hats-persona-cache.cjs: per-room read-then-rebuild persona cache (D-06); hardens the Plan 01 IRW-02 cache assertion to HARD"
  - "tests/test-148-unified-host.cjs (IRW-05) + tests/test-148-brain-review-egress.cjs (IRW-08); run-all-148.sh extended with the check-brain-boundary scan over the Brain-review path"
affects: [intelligence-orchestrator, dial-presenter, larry-personality, navigation-engine]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One-render-door: every suggest surface funnels through a single _pickHost() call site so the seam test can prove ONE code path (mirrors research-filing-selector.cjs)"
    - "Audit-the-composed-string: the framework handle is audited AND the composed methodology question is re-audited before it can enter the packet (defense-in-depth at the egress chokepoint)"
    - "Bodyless-by-construction: _localContradictions reads only the navigation.cjs getNeighborhood projection (typed scalars, no properties blob), so there is structurally no finding body to leak -- count-only"
    - "Per-room cache keyed on a normalized room handle; builder runs at most once per room until explicit invalidation (mirrors the dial-memory per-room idiom)"

key-files:
  created:
    - lib/hmi/brain-review-packet.cjs
    - lib/hmi/hats-persona-cache.cjs
    - tests/test-148-unified-host.cjs
    - tests/test-148-brain-review-egress.cjs
  modified:
    - lib/core/navigation-engine-offer.cjs
    - lib/core/navigation-engine.cjs
    - tests/run-all-148.sh

key-decisions:
  - "The render door changes, not the calibration: resolveOffer still computes exactly ONE calibrated offer; this plan adds renderOfferThroughHost / suggestNext / renderColdRoomLead that route that offer through pickShape({requestedShape:'F.1'}). No second bespoke renderer."
  - "getOrBuildPersonas(room, builder) matches the SHIPPED Plan 01 test signature (room id string + builder as 2nd arg), not the plan's prose getOrBuildPersonas(roomDir). The existing falsifiable contract wins; the cache lands at lib/hmi/hats-persona-cache.cjs (one of the Plan 01 CACHE_CANDIDATES)."
  - "framework_handles is driven SOLELY by the audited input.framework. The getNeighborhood projection carries no node body, so no handle is ever derived from a local node's properties -- the safest typed projection (count surfaces; handle only when explicitly passed and clean)."
  - "Brain line surfaces ONLY in mode_a with a provided response, and only after brain-response-sanitize. mode_b/tier_0 degrade to local-only (brain_line null, degraded true) -- never blocks (D-04)."
  - "_sanitizeBrain fails closed: if the sanitizer module is unavailable it returns '' rather than surfacing an unsanitized response."

patterns-established:
  - "Pattern: a single private _pickHost() funnel makes 'one render path' a structurally provable property (the IRW-05 spy asserts every call carries requestedShape F.1)"
  - "Pattern: re-audit the COMPOSED outbound string (not just the input handle) at the egress chokepoint, since the composed form is the actual payload"

metrics:
  duration: ~30 min
  completed: 2026-06-09
  tasks: 3
  files_created: 4
  files_modified: 3
---

# Phase 148 Plan 05: LarryReach Selector Re-wire (Unified Host + Brain-Review Egress + Hats Cache) Summary

The final plan of Phase 148. It unifies the three suggest surfaces onto the one component-routed F.1 host, makes the Brain-review standing option boundary-safe (a typed methodology packet with zero user-content egress), wires the cold-room "what can I help you with" help lead, and lands the per-room Hats persona cache that hardens the Plan 01 read-then-rebuild assertion. The full `run-all-148.sh` aggregator went 16/18 -> 18/18, closing the phase gate green.

## What Was Built

### Task 1: Unified offer-resolver + suggest-next onto the one pickShape F.1 host (IRW-05, D-07/D-08)

`lib/core/navigation-engine-offer.cjs` gained the render door: `renderOfferThroughHost(offer, context)`, `suggestNext(context)`, and `renderColdRoomLead(context)` all funnel through a single private `_pickHost()` call site that invokes `selector-dispatcher.pickShape({ requestedShape: 'F.1', ... })` -- the identical pattern `research-filing-selector.cjs` uses, not a second bespoke renderer. `resolveOffer`'s calibration (the ONE offer it computes) is untouched; only the rendering door is added.

The cold-room help lead (D-07): when the tier is `tier_0` or the room has no JTBD signal, the host leads with the "What can I help you with?" free-text capture row (the dispatcher `text` archetype via `reachKey: 'free_text'`), with the tier_0 canon fallback (Run Methodology / Reformulate / Free-Text) and the standing trio beneath it. Once a JTBD signal is present the six intelligence reaches lead. D-08 intent matching passes ONLY the resolved generic framework name to `command-resolver.commandsForFramework`; the raw intent text never crosses to a Brain/web query.

`lib/core/navigation-engine.cjs` exposes `resolveOfferNextStep` + `renderOfferNextStep` + `suggestNext` so the engine-side callers converge on the same host.

### Task 2: Typed Brain-review packet + per-room Hats persona cache (IRW-08, D-04, D-06)

`lib/hmi/brain-review-packet.cjs` builds a TYPED methodology packet only. Contradictions are surfaced LOCALLY from `room.db` via `navigation.cjs` `getNeighborhood` (filtered to CONTRADICTS edges) as a COUNT -- the projection carries no node body, so there is structurally nothing to leak. The outbound framework handle is gated through `rs-egress-prompts.auditQueryString` (default-deny), and the composed methodology question ("what chains from `<framework>` at phase `<N>`?") is re-audited before it can enter the packet. Any Brain response passes through `brain-response-sanitize`. On Brain-unreachable (mode_b / tier_0) the packet degrades to local-only (omits the Brain line, marks `degraded: true`) and never blocks.

`lib/hmi/hats-persona-cache.cjs` is the per-room cache mirroring the dial-memory idiom. `getOrBuildPersonas(room, builder)` builds-then-reads: a cache miss runs the builder once and stores; a hit reads from cache without rebuilding. `invalidatePersonas(room)` is the on-demand rebuild entry. It carries the existing "go deep" lightning glyph and the D-06 confirm copy as frozen constants (no new glyph). This made the Plan 01 `test-148-hats-sixth-reach` persona-cache assertion go HARD (it was a documented Wave-dependency stub until this plan).

### Task 3: IRW-05 unified-host seam test + IRW-08 adversarial Brain-review egress test

`tests/test-148-unified-host.cjs` (IRW-05) seams `selector-dispatcher.pickShape` with a spy and asserts the offer-resolver render path, the suggest-next path, both engine surfaces, and the cold-room lead ALL route through the F.1 host -- every recorded call carries `requestedShape === 'F.1'`, proving no second bespoke renderer is invoked.

`tests/test-148-brain-review-egress.cjs` (IRW-08) mirrors the 9-tripwire `test-navigation-packet-part8-leak.cjs` pattern: it builds an adversarial room with CONTRADICTS neighbors whose bodies are stuffed with a SECRET token, an email, a money figure, a name, a large number, and an absolute path; then asserts NONE reach the serialized packet, the local contradiction COUNT is detected (2), `auditQueryString` default-denies a smuggled body (null question), and mode_b degrades to local-only.

`tests/run-all-148.sh` was extended (the aggregator already listed both suites): the Part-8 sweep now also targets the two new lib files, and a check-brain-boundary scan over the Brain-review path asserts the `auditQueryString` gate + `brain-response-sanitize` are present and that no raw network egress bypasses the gate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Correctness] _localContradictions reads a non-existent node field**
- **Found during:** Task 2 (writing brain-review-packet) and confirmed against `lib/core/navigation/neighborhood.cjs`
- **Issue:** The first draft read `n.framework` and `n.edgeTypeOut` off the `getNeighborhood` return. That projection exposes only typed scalars (id / type / edgeTypeIn / score / review_status / timestamps) -- there is no `framework` field and no `edgeTypeOut`. Reading them would have silently produced empty handles and a half-wrong filter.
- **Fix:** `_localContradictions` is now count-only (filters on `edgeTypeIn === 'CONTRADICTS'`), and `framework_handles` is driven solely by the audited `input.framework` at the call site. This is also the SAFEST Part-8 outcome: no handle is ever derived from a local node body.
- **Files modified:** lib/hmi/brain-review-packet.cjs
- **Commit:** 5390ef31 (the count-only adjustment rode the Task 3 commit after the test fixture confirmed the real projection shape)

### Signature reconciliation (not a deviation, a contract-honor)

The plan's prose names `getOrBuildPersonas(roomDir)`, but the SHIPPED Plan 01 falsifiable test calls `getOrBuildPersonas(room, builder)` (a room-id string + a builder as the 2nd arg). The existing test is the binding contract, so the cache implements that signature and lands at `lib/hmi/hats-persona-cache.cjs` (one of the Plan 01 `CACHE_CANDIDATES`). No plan intent was changed; the read-then-rebuild behavior is exactly what D-06 specifies.

## TDD Gate Compliance

Task 3 is marked `tdd="true"`. The two test files were authored AFTER their implementation (Tasks 1 and 2), so they were GREEN on first run rather than going through a RED phase. This is correct-by-construction for this plan: Tasks 1 and 2 ARE the implementation the IRW-05/IRW-08 tests verify, and the plan sequences them before the test task. The tests are genuine falsifiable contracts (they seam on pickShape and feed adversarial forbidden content); they pass because the behavior they assert was built in the preceding tasks of the same plan. No test was weakened to pass.

## Verification Results

- `node tests/test-148-unified-host.cjs` -> PASS (IRW-05: single pickShape F.1 path across all four surfaces)
- `node tests/test-148-brain-review-egress.cjs` -> PASS (IRW-08: 9 tripwires; zero user-content egress; auditQueryString default-deny; local-degrade)
- `node tests/test-148-hats-sixth-reach.cjs` -> PASS (IRW-02 persona-cache read-then-rebuild now HARD, no longer stubbed)
- `bash tests/run-all-148.sh` -> **18/18 PASS** (full phase gate green, including the check-brain-boundary scan over the new Brain-review path)
- No em-dashes or en-dashes in any new or edited file (verified by grep over the seven changed files).

## Known Stubs

None. The one prior stub (the Plan 01 persona-cache Wave-dependency stub) is now resolved -- the cache module landed and the assertion is HARD.

## Self-Check: PASSED

- Created files: lib/hmi/brain-review-packet.cjs, lib/hmi/hats-persona-cache.cjs, tests/test-148-unified-host.cjs, tests/test-148-brain-review-egress.cjs -- all FOUND on disk.
- Commits 21ec78c5 (Task 1), 674436d5 (Task 2), 5390ef31 (Task 3) -- all FOUND in git log.
