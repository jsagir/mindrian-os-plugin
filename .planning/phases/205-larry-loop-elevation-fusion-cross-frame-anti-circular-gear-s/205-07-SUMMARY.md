---
phase: 205-larry-loop-elevation
plan: 07
subsystem: fusion-cross-frame-router
tags: [fusion, cross-frame, jtbd, horizontal-elevation, reverse-salient, brain-ask, hedged-always]
requires:
  - lib/core/navigation/typed-frame.cjs (205-02 Frame node + FRAME_NODE_ID)
  - lib/core/navigation/edges.cjs (205-02 SHARES_JOB + ELEVATES_TO)
  - lib/core/directive-envelope.cjs (191 brain_ask DirectiveEnvelope)
  - lib/core/decision-axes.cjs (205-05 0.70 detent, hedged-always)
  - lib/core/navigation.cjs (Part 9 chokepoint)
provides:
  - lib/core/fusion-router.cjs (runFusion, sessionEndQuorum)
  - lib/core/navigation/typed-frame.cjs::readOpenFrames (the FUSION read helper)
  - lateral-path scaffold (BLOCKED-UNTIL-200)
affects:
  - tests/run-all-205.sh (registered the FUSION router test)
tech-stack:
  added: []
  patterns: [router-not-monolith, chokepoint-only-graph-io, hedged-always-by-construction, gated-stub-clean-degradation]
key-files:
  created:
    - lib/core/fusion-router.cjs
    - tests/test-205-fusion-router.cjs
  modified:
    - lib/core/navigation/typed-frame.cjs
    - tests/run-all-205.sh
decisions: [D-Q1, D-Q4, D-Q5, Q2-resolved-invisible-for-peers]
metrics:
  duration: ~40m
  completed: 2026-07-02
  tasks: 2
  tests: 16/16 fusion + 9/9 frozen-six + 13/13 frame-node
---

# Phase 205 Plan 07: FUSION Cross-Frame Router Summary

FUSION cross-frame stage built as a ROUTER (not a monolith): it assembles the live Frame nodes, asks the Brain for a DirectiveEnvelope through the Phase 191 path, runs a JTBD job-test to split HORIZONTAL (same job -> go up, name the containing system) from LATERAL (same structure, divergent surface = reverse-salient), gates on the frozen 0.70 detent, and fires the horizontal move by writing SHARES_JOB + ELEVATES_TO. Hedged-always, mints no reach, Part 8 fenced. The lateral path is a clean-degrading scaffold gated on Phase 200; the D-Q1 session-end quorum forces exactly one offered hypothesis.

## What Was Built

### Task 1 - the router core (assemble -> brain_ask -> job-test -> gate -> horizontal move)
- `lib/core/fusion-router.cjs::runFusion(ctx)`:
  1. ASSEMBLE - `assembleOpenFrames` reads live Frame nodes via the new `typed-frame.readOpenFrames` (Part 9 chokepoint family) and merges the caller's generic frame descriptors (job/structure/surface handles) by frameKey. Two-plus frames is the precondition; below that it returns `insufficient_frames`.
  2. BRAIN_ASK - wraps the decision in a DirectiveEnvelope via `directive-envelope.cjs` (Phase 191). `buildBrainHandles` produces the ONLY payload that would egress: frame node-ids + job handles + structure handles. No prose, no membership prose (Part 8).
  3. JOB-TEST - `jobTest` pairwise-classifies: equal job handle -> horizontal (precedence); equal structure with divergent surface -> lateral (the reverse-salient signature).
  4. GATE - `decision-axes.resolveDecisionMode` with the frozen 0.70 `ACT_TELL_DETENT`. At/above 0.70 with act-first -> `act_and_report`; below -> `offer_as_question`. The confidence axis is always `hedged` (tell-and-confident is structurally unreachable).
  5. HORIZONTAL MOVE - names `system:<job>`, writes SHARES_JOB (frame->frame) + ELEVATES_TO (frame->containing-system) through `navigation.writeEdge`. Offer text is always hedged ("these MIGHT be the same argument ... here is why I think so"), never "these ARE the same".
- `lib/core/navigation/typed-frame.cjs::readOpenFrames(db, params)` - the read counterpart to `writeFrameNode`, in the same navigation submodule, caller-owned handle, no `node:sqlite`/`fetch` require (keeps the 205-02 Test 8 substrate-bypass grep green).
- Q2 resolved: `isJobTestVisible` - visible for student/practitioner, invisible for researcher/professor, learner-default on cold start (documented in-code).

### Task 2 - session-end quorum (D-Q1) + lateral scaffold (BLOCKED-UNTIL-200)
- `sessionEndQuorum(ctx)` - D-Q1 boundary-pass-first: when 2+ frames are live and no horizontal move fired this session, forces EXACTLY ONE offered, hedged, never-committed cross-frame hypothesis (T-205-07-E: no edge/decision is written). Forces zero when a horizontal move already fired.
- `CONTINUOUS_CADENCE_ENABLED = false` - the continuous per-turn seam is present but OFF (add only if the Bruce catch-rate is low).
- `runLateralPath(ctx, pair, structure)` - gated stub. With no injected `ctx.lateralEngine`, degrades cleanly to `{ available:false, reason:'blocked_until_phase_200_rs', differential_score:null }` - never fabricates a score (T-205-07-R), never throws. With a live RS discriminator injected, routes to `rs_sideways_engine` (score computed downstream, not fabricated here).

## Horizontal vs Lateral split (how it is implemented)
- The split is the `jobTest` classifier. HORIZONTAL = two frames whose `job` handle is equal -> the highest-value move, fully built: it names the containing system and writes the two horizontal-connection edges against the 205-02 Frame node + edge vocabulary.
- LATERAL = two frames whose `structure` handle is equal but whose `surface` diverges (the reverse-salient signature) -> routed to `runLateralPath`. This is a distinct, gated path: it does NOT auto-fire a horizontal move (`fired:false`) and hands off to the Phase 200 RS engine. Phase 200 is shipped, so injecting a live discriminator satisfies the gate; absent it, the path degrades cleanly rather than faking an RS score.

## No new reach + Part 8 fence (verified)
- `FUSION_REACH_ID = 'deep_research'` (a frozen-six member). Every `reach_id` reference in the router uses this const; grep confirms no net-new reach literal. FUSION is a nav-dial POSITION routing an existing reach, not a reach - the frozen-six guard passes with FUSION exercised.
- Brain path requires `./directive-envelope.cjs` only; grep confirms zero `fetch(`, zero `node:http(s)` require, no direct brain-client call. Only generic handles cross (`brain_handles`), never prose.

## Verification (actual output)
```
test-205-fusion-router (item 1): FUSION cross-frame ROUTER
  ok - Test 1 .. Test 16 (all pass)
PASS test-205-fusion-router (16/16)

test-205-frozen-six-guard.cjs (item 7): the frozen six + scalars hold after 205
PASS test-205-frozen-six-guard.cjs (9 checks)

test-205-frame-node  PASS (13/13)   # no regression from readOpenFrames edit

bash tests/run-all-205.sh -> ALL 205 TESTS PASS   # FUSION now registered
```
grep verifications:
- `grep reach_id lib/core/fusion-router.cjs` -> all references are `FUSION_REACH_ID`; only reach literal present is `'deep_research'`.
- `grep -E "directive-envelope|fetch\(|node:https?" lib/core/fusion-router.cjs` -> requires `directive-envelope.cjs`; no fetch, no http.

## Deviations from Plan
- **[Rule 2 - born-wired] Registered the FUSION test in `tests/run-all-205.sh`.** The plan `files_modified` listed only the three core files, but Canon Part 11 requires a new invocable surface to be exercised by its suite. Added one aggregator line. Commit 9cccb6c9.
- **Lateral path is scaffold-only (as planned, stated explicitly).** The heavy async Phase 200 RS differential-scorer (Python/Pinecone/Neo4j bridges) is NOT wired into the synchronous router. `runLateralPath` is a dependency-injection seam (`ctx.lateralEngine`) that degrades cleanly when absent. This matches the plan's "SCAFFOLD it and gate on Phase 200" directive; the lateral move is not a fully-landed horizontal-equivalent engine.

## Known Stubs
- `runLateralPath` is a BLOCKED-UNTIL-200 gated stub (documented in-code and in-test). Intentional per the plan; the lateral sideways engine (reverse-salient + find-analogies + web fetch) is a follow-on that wires the injected `ctx.lateralEngine` to `rs-differential-scorer.cjs`. It fabricates no data when RS is absent.

## Commits (on workspace/phase-205-evals)
- `39d4ff14` test(205-07): failing spec for the FUSION cross-frame router
- `9cccb6c9` feat(205-07): FUSION cross-frame router (item 1) - horizontal move + quorum + lateral scaffold

## Self-Check: PASSED
- lib/core/fusion-router.cjs - FOUND
- lib/core/navigation/typed-frame.cjs (readOpenFrames) - FOUND
- tests/test-205-fusion-router.cjs - FOUND
- commit 39d4ff14 - FOUND
- commit 9cccb6c9 - FOUND
