# Phase 183 - Deferred / Out-of-Scope Items

## DI-183-01: test-158-reach-orchestrator-pure.cjs fails (pre-existing, out of scope)

- **Discovered during:** Plan 02 broad regression sweep (running tests/run-all-158.sh).
- **Status:** PRE-EXISTING. Confirmed failing at commit c9d7c860 (before any Plan-02 work).
- **What:** The purity assertion in `tests/test-158-reach-orchestrator-pure.cjs` requires
  `dial-reach-orchestrator.cjs` to have exactly one require (f-selector-ranker.cjs), but the
  orchestrator now also requires `../core/act-jtbd-blurb.cjs` (line 62).
- **Why out of scope (SCOPE BOUNDARY):** none of the Plan-02 files
  (lib/core/meter/transfer-reader.cjs, lib/core/meter/two-gauge.cjs, lib/core/navigation.cjs,
  tests/test-meter-two-gauge-weld.cjs) is in `dial-reach-orchestrator.cjs`'s require graph.
  The failure is unrelated to METER and was not introduced by this plan.
- **Action:** NOT fixed here. The full Phase-183 gate (tests/run-all-183.sh) is 8/8 green and
  the carried frozen-set drift fences (reach-ids 6, posture-ids 3) are green. A future
  Phase-158 maintenance pass should either re-point the purity assertion to allow the
  act-jtbd-blurb require or exclude it explicitly.
