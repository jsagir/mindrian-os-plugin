# Phase 132 Deferred Items

## DI-132-05-01: Live pseudonymize of the 6 internal-team :Person nodes -> v1.14.0

- **Found during:** 132-05 execution, under the RE_BASELINE_SCOPE_OVERRIDE (Phase 132 = code + a tiny re-baselined live cleanup; the release gate ships, the live pseudonymize write defers).
- **What is deferred:** the LIVE Brain WRITE that pseudonymizes the 6 internal-team `:Person` nodes (replaces each real name with a neutral pseudonym, KEEPS the `mindrian_internal:true` flag, excludes the public Aronhime Larry-persona namesake). The pseudonymize is NOT executed in Phase 132. ZERO live Brain writes landed in this phase.
- **What DID ship in 132-05 (the machinery, fixtures-only):**
  - `scripts/curation-132-05-pseudonymize.cjs` -- the reversible, flag-matched, Part 8-clean pseudonymize BUILDER (`buildPseudonymizeBatch`, `PSEUDONYM_HANDLES`), `--dry-run` default (creds-free, zero writes); `--execute`/`--rollback` refuse with a "DEFERRED to v1.14.0" message.
  - `scripts/verify-phase-132.cjs` -- the Phase 132 release gate that INVOKES the Phase 130.7 dual-graph health gate (`scripts/check-dual-graph-health.cjs` `runCheck`, report-only/baseline mode) + runs the brain-boundary-scan over the phase-132 batch builders; fail-closed (blocked-on-130.7) when the gate is absent.
  - `lib/memory/curation-132-05-pseudonymize.test.cjs` -- the fixture suite (registered in `tests/run-all-132.sh` + the Feynman runner).
- **Canon rationale (why it must eventually happen):** the Brain MCP ships to the testers tier (a shared surface), so the no-real-names-in-shared-Brain hard rule (Canon Part 8 + the no-real-names-in-tracked-surfaces rule) applies to the 6 internal-team `:Person` nodes. They must carry pseudonyms while keeping `mindrian_internal:true`. Until the live write runs, the real names remain in the live graph only (never in the tracked repo -- the builder matches by the `mindrian_internal:true` flag, never a real-name literal).
- **v1.14.0 scope (the bundle this rides with):** run the deferred live pseudonymize write ALONGSIDE the v1.14.0 bulk hypergraph reify (the deferred 132-02 `buildReifyCypher` -> live event-node instances) + the wire-it pass (the deferred 132-04 content wiring), snapshot-first, orchestrator-run, creds-gated through the 132-01 `makeBatch` runner. The pseudonymize batch is `phase-132-curation-batch-5`; its paired rollback restores the pre-batch `:Person` name properties from the in-graph `name_pre_pseudonym` temp property by the `pseudonymized_by` selector.
- **Pre-execute requirement:** the live `--execute` path needs the 6 nodes' canonical pseudonym -> in-graph-node pairing confirmed (the builder pairs each opaque handle to a node by `elementId`-ordered SKIP/LIMIT; the operator confirms the ordering matches the intended 6 before mutating, snapshot-first).
- **Not blocking the phase:** the Phase 132 release gate (the proof-of-coherence deliverable) ships and is green on fixtures; the live content cleanup is the v1.14.0 follow-on.

## DI-132-05-02: Deferred 132-02 (hypergraph reify) + 132-04 (wire-it) live passes -> v1.14.0

- **Context:** under the re-baseline, 132-02 (live hypergraph event-node reify) and 132-04 (live content wire-it) were NOT executed as live writes. 132-01 shipped the frozen 5-event-type schema + the additive `buildReifyCypher` Cypher builder; the live reify + wire-it runs are deferred to the v1.14.0 bulk pass (bundled with DI-132-05-01).
- **Release-gate impact:** `scripts/verify-phase-132.cjs` scans whatever phase-132 batch BUILDERS are present on disk (currently 132-03 + 132-05) and skips absent modules gracefully -- so the boundary scan never silent-passes on the HEALTH gate, and a future 132-02/132-04 builder is picked up automatically when it lands.
