---
phase: 177-larry-behavioral-channel
plan: 09
subsystem: behavioral-channel / navigation-engine SEAM 3
tags: [bch-07, bch-08, seam-3, wired-but-shadowed, dormant-modifier, byte-identical, part-8, tier-ordering]
requires:
  - "177-08 (BEHAVIORAL_CHANNEL_ARMED flag, default LOCKED, calibration-gate.cjs)"
  - "177-01 (engine-owned BEHAVIORAL_CHANNEL_FLOOR/CEILING in f-selector-ranker.cjs)"
  - "144 (resolveFireSkill sensor-reach branch + the routing_source legacy->engine flip spine)"
provides:
  - "behavioralChannelModifier() -- the SEAM 3 modifier in navigation-engine.cjs, gated by BEHAVIORAL_CHANNEL_ARMED, returns null UNCONDITIONALLY when unarmed (byte-identical dormant path)"
  - "rankBehavioralCue() + bandCueLosesToBrain() -- pure tier-ordering helpers (signal>keyword; band cue loses to Brain>=0.70), thresholds read via require idiom"
  - "test-bch-07-seam3-insertion GREEN (null defers byte-identical; routing_source stays legacy)"
  - "test-bch-08-signal-tier GREEN (signal>keyword in band; signal loses to Brain>=0.70; 15-point margin)"
affects:
  - "Wave 5 (bch-09): the seam mechanism is dormant until a real calibration PASS arms the flag (data-gated + Canon-Custodian-gated)"
tech-stack:
  added: []
  patterns:
    - "WIRED-BUT-SHADOWED: a constitutional kill-switch (armed !== true -> null) makes the seam provably inert; the legacy fall-through is byte-identical when unarmed"
    - "thresholds read via the require idiom (RECOMMENDED_CONFIDENCE_FLOOR from nav-engine; FLOOR/CEILING from f-selector-ranker) -- no threshold literal in code or test (BCH-05)"
    - "lazy require of calibration-gate (readBehavioralChannelArmed) to avoid the pre-existing f-selector-ranker <-> navigation-engine load-time cycle"
    - "pure separately-testable ordering helpers so BCH-08 asserts tier precedence WITHOUT arming the live flag"
key-files:
  created: []
  modified:
    - "lib/core/navigation-engine.cjs (behavioralChannelModifier + rankBehavioralCue + bandCueLosesToBrain + the seam insertion + readBehavioralChannelArmed + 3 exports)"
    - "tests/test-bch-07-seam3-insertion.cjs (RED scaffold -> real asserts)"
    - "tests/test-bch-08-signal-tier.cjs (RED scaffold -> real asserts)"
decisions:
  - "The whole contract is the SAFETY INVARIANT: unarmed -> null -> byte-identical legacy. The test asserts it both at resolveFireSkill (the seam host) and at the decide() boundary (sensor-fire determinism + the legacy verb)."
  - "BCH-08 tier ordering is factored into pure helpers (rankBehavioralCue / bandCueLosesToBrain) so precedence is provable WITHOUT arming the flag (the gated runtime call returns null today)."
  - "The f-selector-ranker NaN-ceiling import-cycle quirk is PRE-EXISTING (verified on HEAD~2); worked around via lazy require + test require order, NOT fixed in the ranker (not owned)."
metrics:
  duration: "~25 min"
  completed: 2026-06-24
  tasks: 3
  commits: 3
  files: 3
---

# Phase 177 Plan 09: SEAM 3 Behavioral-Channel Modifier (WIRED-BUT-SHADOWED) Summary

The SEAM 3 modifier shipped dormant inside resolveFireSkill(): a constitutional kill-switch that returns null unconditionally while BEHAVIORAL_CHANNEL_ARMED is false, leaving the legacy decide() output byte-identical and routing_source legacy.

## What was built

**`lib/core/navigation-engine.cjs`** -- the SEAM 3 modifier plus its two pure ordering helpers, co-located with resolveFireSkill():

- `behavioralChannelModifier(topReach, cue, armed)` -- the modifier. FIRST statement is the kill-switch: `if (armed !== true) return null`. When BEHAVIORAL_CHANNEL_ARMED is false (ALWAYS today) the function is provably inert. The armed-true body (which never runs today) maps the fired reach to its canonical verb via the existing `reachIdToSkillFamily`, returns `{ verb, confidence, reason }`, and defers (null) when the reach does not map or the cue is below `BEHAVIORAL_CHANNEL_FLOOR`. It reads ONLY enum/scalar handles (reach_id, posture, tier, confidence) plus the armed boolean -- never user prose.
- The seam INSERTION: a `(2.5)` block inside `resolveFireSkill()`, AFTER the sensor-reach branch (ends :466) and BEFORE the mode_a Brain path (:468). It computes `behavioralChannelModifier(top, { tier, confidence }, readBehavioralChannelArmed())`; a non-null seam returns `seam.verb`, otherwise it falls through unchanged. Because the modifier is null today, the fall-through is byte-identical to the pre-seam engine.
- `rankBehavioralCue(cueA, cueB)` -- orders two cues by TRIGGER_TIERS precedence first (signal above keyword, read from sensor-types -- never a re-typed order), confidence second.
- `bandCueLosesToBrain(cue, brainConfidence)` -- pure predicate: a protected-band cue ([BEHAVIORAL_CHANNEL_FLOOR, BEHAVIORAL_CHANNEL_CEILING)) loses to a Brain RECOMMENDED confidence >= RECOMMENDED_CONFIDENCE_FLOOR (0.70). All three thresholds read via the require idiom; no literal lands in code.
- `readBehavioralChannelArmed()` -- a LAZY require of calibration-gate.cjs (the require idiom; no re-typed `false`), placed inside a function to avoid the pre-existing f-selector-ranker import cycle.

**`tests/test-bch-07-seam3-insertion.cjs`** -- RED scaffold replaced with 14 real asserts: the modifier exists + is exported; null-defers for every input when unarmed (false / undefined / truthy-but-not-true / the gate flag itself); the byte-identical legacy proof at resolveFireSkill (mode_a Brain path unintercepted; sensor branch precedes the dormant seam) AND at the decide() boundary (sensor-fire determinism across two calls + the legacy verb 'Run Methodology'); routing_source stays legacy in the dormant tier_0 path.

**`tests/test-bch-08-signal-tier.cjs`** -- RED scaffold replaced with 14 real asserts: Test A signal>keyword in band (order-independent; tier precedes confidence even when keyword has higher confidence); Test B signal loses to Brain>=0.70 (both directions, plus the above-ceiling defensive case); Test C the 15-point margin (ceiling - Brain-floor == 0.15, computed from the engine constants, never re-typed). Requires f-selector-ranker before navigation-engine to dodge the cycle quirk.

## Verification

- `node tests/test-bch-07-seam3-insertion.cjs` exits 0 (14/14 asserts green).
- `node tests/test-bch-08-signal-tier.cjs` exits 0 (14/14 asserts green).
- `bash tests/run-all-177.sh`: **13 pass / 3 fail -> 15 pass / 1 fail**. bch-07 + bch-08 flipped GREEN; only bch-09 (Wave 5, out of scope) stays RED. The carried frozen-set fences PASSED: reach-ids-drift (frozen 6, no 7th reach), posture-ids-drift (frozen 3, no 4th posture). The cross-cutting Part 8 tripwire bch-14 PASSED.
- Nav-engine regression `bash tests/run-all-144.sh`: 5/5 GREEN (the routing spine held; the byte-identical dormant path is the invariant).
- Part 8 brain-boundary scan over the modifier path: ZERO new user-data egress. The plan's grep (`fetch|http|buildBrainPacket|sendPacket` filtered to behavioral) returns no matches (scan-exit:1); a broader modifier-body scan (`fetch|https?:|buildBrainPacket|sendPacket|brain_write|writePacket|.write(`) also returns nothing on the seam path. The modifier reads enum/scalar only and opens no Brain wire.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Lazy-required calibration-gate to dodge a pre-existing import cycle**
- **Found during:** Task 2
- **Issue:** A top-level `require('./navigation/calibration-gate.cjs')` (as the plan literally suggested) forced f-selector-ranker to load during navigation-engine's own load, before navigation-engine finished exporting RECOMMENDED_CONFIDENCE_FLOOR. The ranker then computed BEHAVIORAL_CHANNEL_CEILING = undefined + 0.15 = NaN and froze that NaN into its module const, breaking the BCH-08 band assertions.
- **Fix:** Replaced the top-level require with `readBehavioralChannelArmed()`, a lazy require called from resolveFireSkill. navigation-engine now finishes loading before f-selector-ranker is pulled in. Also ordered the BCH-08 test to require f-selector-ranker before navigation-engine (the cycle-safe order, mirroring 177-08 calibration-gate).
- **Files modified:** lib/core/navigation-engine.cjs, tests/test-bch-08-signal-tier.cjs
- **Commit:** dabe5ad6
- **Note:** The underlying NaN-ceiling cycle is PRE-EXISTING (verified failing identically on the true pre-177-09 baseline HEAD~2). The proper fix belongs in f-selector-ranker (a lazy/getter floor read), which this plan does not own. Logged as DI-177-09-01.

## Deferred Issues (pre-existing, out of scope -- see deferred-items.md)

- **DI-177-09-01:** f-selector-ranker <-> navigation-engine load-time cycle leaves BEHAVIORAL_CHANNEL_CEILING NaN when navigation-engine is required first. Worked around (lazy require + test order); proper fix is in the ranker. Inert today because the dormant modifier returns null; the future arming review (Canon Custodian) must resolve the load order before live arming.
- **DI-177-09-02:** run-all-1441 connector suites (test-connector-filing-sweep, test-connector-exhaustive-coverage) fail on the baseline, unrelated to the routing spine. Not fixed.

## Known Stubs

None introduced by this plan. bch-09 remains a Wave 5 scaffold stub (out of scope, intentionally RED until Wave 5 lands).

## Commits

- b4dee841: 177-09 add failing test for SEAM 3 dormant modifier (BCH-07 RED)
- c321157c: 177-09 implement SEAM 3 dormant modifier (BCH-07 GREEN)
- dabe5ad6: 177-09 SIGNAL-tier ordering in the protected band (BCH-08 GREEN)

## TDD Gate Compliance

Both tdd tasks honored RED -> GREEN: Task 1 committed a failing test (b4dee841, `behavioralChannelModifier is not a function`) BEFORE the implementation (c321157c). Task 2's pure helpers shipped with Task 1; its test (dabe5ad6) was authored against the already-exported helpers and flipped GREEN after the import-cycle workaround. The gate sequence (test commit, then feat commit) is satisfied.

## Self-Check: PASSED

- lib/core/navigation-engine.cjs: FOUND
- tests/test-bch-07-seam3-insertion.cjs: FOUND
- tests/test-bch-08-signal-tier.cjs: FOUND
- b4dee841: FOUND
- c321157c: FOUND
- dabe5ad6: FOUND
- Modifier-path egress scan: NO egress (Part 8 clean)

## EXECUTION COMPLETE

Wave 4 shipped the SEAM 3 behavioral-channel modifier WIRED-BUT-SHADOWED inside `lib/core/navigation-engine.cjs` (the `behavioralChannelModifier` function gated by `BEHAVIORAL_CHANNEL_ARMED`, inserted between the sensor-reach branch :466 and the mode_a Brain path :468, plus the pure `rankBehavioralCue` / `bandCueLosesToBrain` helpers), turning `tests/test-bch-07-seam3-insertion.cjs` and `tests/test-bch-08-signal-tier.cjs` GREEN; `bash tests/run-all-177.sh` moved 13 pass / 3 fail -> 15 pass / 1 fail with only bch-09 (Wave 5) remaining RED. The byte-identical-dormant-path invariant is PROVEN: the kill-switch returns null unconditionally while the flag is false, so resolveFireSkill falls through to the legacy path unchanged (asserted at both the resolveFireSkill host and the decide() boundary across two deterministic calls), and routing_source stays legacy in the dormant path (decide() never flips it without a fired non-null verb). Part 8 holds: the modifier ROUTES only, reads enum/scalar handles (reach_id, posture, tier, confidence) plus the armed boolean, and a source scan finds zero new user-data egress on the modifier path (no fetch/http/buildBrainPacket/sendPacket). The nav-engine regression (run-all-144) held 5/5 and the frozen-set fences (6 reaches, 3 postures) stayed green -- no 7th reach minted. One deviation: a Rule-3 lazy-require workaround for a PRE-EXISTING f-selector-ranker import-cycle NaN-ceiling quirk (verified on HEAD~2, logged as DI-177-09-01, not fixed in the unowned ranker); the live flip stays data-gated and Canon-Custodian-gated and was NOT armed.
