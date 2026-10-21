---
id: SEED-141
title: "Raise the scout artifact cap (DEFAULT_MAX_ARTIFACTS) now that the randomized solver shipped"
status: open
priority: medium
filed: 2026-10-21
planted_during: "Phase 379.1 plan 06 (graph derive drain and scout runaway CPU)"
origin: "Phase 379.1, decision D-379.1-14 (main-session ruling in plan revision 1)"
trigger_when: "379.1-03-SUMMARY.md says GATE PASSED (it does) and the next scout or HSI work starts"
scope: small
surfaces: [MindrianOS-Plugin]
promotes_to: "a quick: probe, then raise DEFAULT_MAX_ARTIFACTS in lib/core/rs-engine.cjs and update the large room leg"
---

# SEED-141: Raise the scout artifact cap

## The problem

`DEFAULT_MAX_ARTIFACTS` in `lib/core/rs-engine.cjs` is 400. It comes from `rs_max_artifacts_default` in `tests/fixtures/379.1/probe-svd-parity.json`, which was derived from the Jacobi solver: `jacobi_ms_n400` = 50,663 ms. Plan 03 shipped a randomized solver and its gate passed (Spearman 0.9965 against Jacobi; a 2,105 x 2,000 solve took 304 ms). The cap did not move. The solver therefore gives no gain in production until the cap rises, and a room above 400 artifacts still gets the degraded `artifact_cap_exceeded` result.

## Evidence

- 379.1-05-SUMMARY.md: the cap stays at 400 although the randomized solver shipped; this seed is the follow-up.
- 379.1-03-SUMMARY.md: GATE PASSED, randomized SVD shipped, auto rule when the smaller side is above 300.
- The large room leg (scripts/release-lib/large-room-leg.cjs) expects the scout to return `artifact_cap_exceeded` on the 2,105-artifact room. When the cap rises above that size, the leg needs a new expectation (or a larger fixture).

## Proposed next step

1. On the large fixture and on a real room, probe `runModeInternal` at n = 1,000 and n = 2,163 with `MINDRIAN_SVD_SOLVER=randomized`. Record the clock and the peak RSS of each.
2. Raise `DEFAULT_MAX_ARTIFACTS` to the largest n whose clock is under the scout step timeout (MINDRIAN_SCOUT_STEP_TIMEOUT_MS, 300 s) with a margin.
3. Update the large room leg so it still proves a bound: a fixture larger than the new cap, or a measured clock for the LSA path.
4. Measure edge loss at the new cap. `pairs_pruned` counts pairs, not edges lost. The probe-k large sample (300 artifacts) is the only edge-loss measurement above N = 44, so an edge-loss probe at the new cap belongs to this follow-up.

## Trigger

379.1-03-SUMMARY.md says GATE PASSED. The follow-up is ready now.
