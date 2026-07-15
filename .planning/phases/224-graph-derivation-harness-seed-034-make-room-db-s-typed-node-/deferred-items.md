# Deferred Items - Phase 224

Out-of-scope discoveries logged during execution (scope boundary rule: pre-existing
failures in unrelated files are NOT auto-fixed).

## Pre-existing run-all-169.sh failures (unrelated to Phase 224-02)

Discovered during Plan 224-02 execution. Verified PRE-EXISTING at the true baseline
commit `8300a35b1` (the parent of this plan's first commit) by restoring the
pre-224-02 versions of every file this plan touches and re-running the suite: the
identical 4 tests fail with and without Plan 224-02's changes. Plan 224-02 introduces
ZERO new failures in run-all-169.sh.

| Failing test | Domain (not touched by 224-02) |
|--------------|--------------------------------|
| test-edges-room-lineage-floor.cjs | edge-floor citizen markers |
| test-edges-part4-cascade-floor.cjs | edge-floor citizen markers |
| test-depth2-full-citizen.cjs | FEYNMAN `## Timeline (auto)` full-citizen rendering |
| test-graph-derivation-verdict.cjs | FEYNMAN `## Timeline (auto)` body assertion (GDH-09 / D-169-11) |

Root symptom (from the verdict test findings): a healed/nested room's FEYNMAN body
does not carry the `## Timeline (auto)` section the Phase-124 timeline runner is
expected to render. This is a FEYNMAN-timeline / room-citizen concern, disjoint from
Plan 224-02's derivation drain, cascade Step 2b, and event-type additions.

Disposition: DEFERRED. Not a Phase 224-02 regression. Recommend a dedicated
`/gsd:debug` session (kind: rca) against the FEYNMAN timeline runner if these are not
already environment-specific (the timeline render may depend on a runner/dep absent in
this environment).

## Pre-existing test-futures-cascade-integration.cjs failure (unrelated to 224-02)

`test-futures-cascade-integration.cjs` fails at the true baseline `8300a35b1` too
(verified by reverting all 224-02 files and re-running): `writeCascadeEdges` reports
2 cascade failures where the test expects 0 ("the bug was 4 failures"), so two
ROOT_CAUSES edges do not persist. This exercises the FUTURES orchestrator's
`writeCascadeEdges` / `registerConsequenceArtifacts`, NOT intelligence-cascade's
`runCascade` (where Plan 224-02's Step 2b lives). Disjoint from this plan.

Disposition: DEFERRED. Not a Phase 224-02 regression.
