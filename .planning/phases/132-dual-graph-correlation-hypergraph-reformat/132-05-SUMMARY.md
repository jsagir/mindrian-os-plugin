---
phase: 132-dual-graph-correlation-hypergraph-reformat
plan: 05
subsystem: brain-curation-machinery + phase-release-gate
tags: [pseudonymize, release-gate, dual-graph-health, brain-boundary-scan, canon-part-7, canon-part-8, re-baseline, deferred-v1.14.0]
requires:
  - 132-01    # the curation-batch runner (makeBatch + assertRollbackPath + scanBatchForUserContent) every write routes through
  - 132-03    # the dedup/held-rename batch builders the brain-boundary-scan also covers
  - 130.7-03  # the dual-graph health gate (scripts/check-dual-graph-health.cjs runCheck) this release gate INVOKES (never rebuilds)
provides:
  - scripts/curation-132-05-pseudonymize.cjs        # reversible flag-matched pseudonymize BUILDER (machinery; live write DEFERRED to v1.14.0)
  - scripts/verify-phase-132.cjs                     # the Phase 132 RELEASE GATE: invokes the 130.7 health gate + brain-boundary-scan
  - lib/memory/curation-132-05-pseudonymize.test.cjs # 10 fixture assertions (builder + release-gate invocation)
affects:
  - "v1.14.0 bulk pass: runs the deferred live pseudonymize (batch-5) alongside the deferred 132-02 reify + 132-04 wire-it, snapshot-first, orchestrator-run (see deferred-items.md)"
  - "Release pipeline: scripts/verify-phase-132.cjs is the phase release gate that MEASURES the reformat via the 130.7 health metrics"
tech-stack:
  added: []   # ZERO new deps -- reuses makeBatch (132-01) + check-dual-graph-health runCheck (130.7) + Node built-ins
  patterns:
    - "the release gate INVOKES the 130.7 gate (require + runCheck), never reimplements the 4 metrics (grep-gated by the test)"
    - "fixtureMode drives the 130.7 gate via a planted conclusive reader + an in-memory store -- no live Brain, no on-disk baseline mutation"
    - "fail-closed: blocked-on-130.7 when the gate module is absent; inconclusive (no live Brain) on the default standalone path -- never silent-pass"
    - "brain-boundary-scan fallback (Part 8): scanBatchForUserContent over every phase-132 batch builder present on disk; absent (deferred) modules skipped gracefully"
    - "pseudonymize matches by the mindrian_internal:true FLAG, never a real-name literal; the only person-name string the repo binds is the neutral pseudonym"
    - "name_pre_pseudonym stored in-graph BEFORE the name overwrite so the created_by=batch-5 rollback restores the pre-batch name from graph state, never from the repo"
key-files:
  created:
    - scripts/curation-132-05-pseudonymize.cjs
    - scripts/verify-phase-132.cjs
    - lib/memory/curation-132-05-pseudonymize.test.cjs
    - .planning/phases/132-dual-graph-correlation-hypergraph-reformat/deferred-items.md
  modified:
    - tests/run-all-132.sh                 # additive: +1 CJS suite (now 4)
    - lib/memory/run-feynman-tests.cjs     # additive Phase 132-05 block (diff is additions only)
decisions:
  - "RE-BASELINE applied per the prompt scope override: BUILT the Phase 132 release gate (invoke the 130.7 health check report-only + brain-boundary-scan + coverage floors) and DEFERRED the live pseudonymize write of the 6 internal-team :Person nodes to v1.14.0 (recorded in deferred-items.md DI-132-05-01)"
  - "ZERO live Brain writes: the pseudonymize ships as a --dry-run-default BUILDER; --execute/--rollback refuse with a DEFERRED-to-v1.14.0 message"
  - "the release gate REUSES the 130.7 check-dual-graph-health.cjs runCheck (Canon Part 7) -- it carries NONE of the 4-metric thresholds (a grep over the source confirms; the test asserts it)"
  - "the repo-level check-brain-boundary.cjs is still pending (CANON-PHASE-MAP Part 8), so the gate uses the CONTEXT-named structural fallback: scanBatchForUserContent over the phase batch builders"
  - "the pseudonym map is keyed by 6 stable opaque handles (internal-person-1..6) + neutral pseudonyms; ZERO real internal-team names enter the tracked repo -- the match is the mindrian_internal:true flag, the real-name->pseudonym binding is purely in-graph at execute time"
  - "the Aronhime public Larry-persona namesake is excluded from pseudonymization (WHERE p.name <> Aronhime AND not is_public_persona); its AUTHORED edges to the 7 PWS variants stay intact"
metrics:
  duration: ~12m
  completed: 2026-06-02
  tasks: 2
  files_created: 4
  files_modified: 2
  live_brain_writes: 0
  new_dependencies: 0
---

# Phase 132 Plan 05: Pseudonymize Machinery + Phase 132 Release Gate Summary

The Phase 132 RELEASE GATE (`scripts/verify-phase-132.cjs`) that MEASURES the dual-graph reformat by INVOKING the Phase 130.7 dual-graph health gate in its report-only/baseline mode plus a brain-boundary-scan over the phase-132 batch builders, alongside the reversible flag-matched pseudonymize BUILDER for the 6 internal-team `:Person` nodes -- with the live pseudonymize WRITE DEFERRED to v1.14.0, ZERO live Brain writes, and ZERO new dependencies.

## Re-baseline note (load-bearing)

Per the RE_BASELINE_SCOPE_OVERRIDE (Phase 132 = code + a tiny re-baselined live cleanup), this plan:

- **BUILT** the Phase 132 release gate: `scripts/verify-phase-132.cjs` invokes the 130.7-shipped `check-dual-graph-health.cjs` `runCheck` (the 4-metric health check, report-only/baseline mode -- the gate proves the reformat machinery is coherent) and runs the brain-boundary-scan. This is the phase proof-of-coherence deliverable.
- **DEFERRED** the live pseudonymize of the 6 internal-team `:Person` nodes to v1.14.0, recorded in `deferred-items.md` (DI-132-05-01): pseudonymize 6 internal-team `:Person` nodes, keep `mindrian_internal:true`, Canon no-real-names-in-shared-Brain rationale, deferred to v1.14.0 with the bulk reify (deferred 132-02) + wire-it (deferred 132-04).
- **ZERO live Brain writes.** The pseudonymize ships as a `--dry-run`-default builder; the release gate runs on FIXTURES (and fails-closed/inconclusive without a live connection on the default path, exactly as 130.7-03 built it).

## What shipped

### Task 1 (TDD) -- the pseudonymize builder (`scripts/curation-132-05-pseudonymize.cjs`)

- `PSEUDONYM_HANDLES`: a frozen array of exactly 6 `{ handle, pseudonym }` objects -- opaque positional handles (`internal-person-1..6`) + neutral pseudonym strings. ZERO real internal-team names in the script or its test.
- `buildPseudonymizeBatch()`: one forward write per handle. Each MATCHes `(p:Person {mindrian_internal:true})` EXCLUDING the Aronhime public persona, ordered deterministically by `elementId` (SKIP/LIMIT ordinal so re-runs are idempotent), SETs `name_pre_pseudonym = p.name` BEFORE overwriting `p.name = $pseudonym`, stamps `pseudonymized_by = phase-132-curation-batch-5`, and KEEPS `mindrian_internal:true`. The paired rollback (audit Section 17 shape) restores `name` from `name_pre_pseudonym` and REMOVEs the temp markers by the `pseudonymized_by` selector.
- Routes through the 132-01 `makeBatch` runner; `assertRollbackPath` passes; `scanBatchForUserContent` returns `[]`.
- CLI: `--dry-run` default (creds-free, prints the Cypher, zero writes); `--execute`/`--rollback` refuse with a "DEFERRED to v1.14.0" message.

### Task 2 -- the phase release gate (`scripts/verify-phase-132.cjs`)

- `runPhase132ReleaseGate()`: (1) locates `scripts/check-dual-graph-health.cjs`, requires it, and calls its `runCheck` -- parsing the PASS/FAIL outcome. If the gate module is absent it returns `blocked-on-130.7` and FAILS CLOSED (never silent-pass). (2) Runs the brain-boundary-scan over every phase-132 batch builder present on disk (132-03 `buildDedupCollapsePass`/`buildHeldRenamePass` + 132-05 `buildPseudonymizeBatch`); 132-02/132-04 are deferred and skipped gracefully. (3) PASSES iff the health gate reached a conclusive PASS AND the boundary scan is clean.
- The runner carries NONE of the 4-metric thresholds (the test greps the source to confirm it INVOKES, never reimplements, the 130.7 gate).
- `fixtureMode` drives the 130.7 gate with a planted conclusive reader + an in-memory store (no live Brain, no on-disk baseline mutation). The default CLI path uses the gate's own live reader, which fails-closed to inconclusive until its async wiring lands.

## Verification results

- `node lib/memory/curation-132-05-pseudonymize.test.cjs` -> 10/10 passed (6 builder asserts + 4 release-gate asserts).
- `bash tests/run-all-132.sh` -> 4/4 suites GREEN (132-01 curation-batch + hypergraph-schema, 132-03 dedup/held-rename, 132-05 pseudonymize).
- `node scripts/verify-phase-132.cjs --fixture` -> RELEASE GATE PASS (130.7 invoked, outcome `no_regression`, brain-boundary-scan clean over 3 builders).
- `node scripts/verify-phase-132.cjs` (default, no live Brain) -> RELEASE GATE FAIL with outcome `inconclusive` (correct fail-closed behavior; never a false-green).
- Zero regression: `bash tests/run-all-130.sh` 4/4, `node tests/test-navigation-acceptance.cjs` 1/1, `node lib/memory/dual-graph-health.test.cjs` 11 groups -- all GREEN.
- `git diff package.json` empty (ZERO new dependencies); the Feynman runner diff is additions-only.

## Deviations from Plan

The PLAN.md as-written (Task 1) executes the live pseudonymize via the curation-batch runner and (Task 2) measures the reformat against the live graph. Both are reshaped by the RE_BASELINE_SCOPE_OVERRIDE in the execution prompt, not by an in-flight discovery:

**1. [Scope override -- not a Rule deviation] Live pseudonymize DEFERRED to v1.14.0.** Per the prompt's RE_BASELINE_SCOPE_OVERRIDE and HARD_GATES (ZERO live Brain writes), the live pseudonymize write was NOT executed. It ships as a `--dry-run`-default builder and is recorded in `deferred-items.md` (DI-132-05-01). The plan's frontmatter requirement PSEUDO-08 (the live write) is therefore partially satisfied (machinery built + tested; live write deferred); VERIFY-09, VERIFY-10, REVERSE-01, REVERSE-02 are fully satisfied by the shipped gate + builder.

**2. [Rule 3 - blocking-issue / CONTEXT-named fallback] brain-boundary-scan structural fallback.** The repo-level `check-brain-boundary.cjs` is still pending (CANON-PHASE-MAP Part 8 marks it "pending"). The CONTEXT explicitly names the fallback: `scanBatchForUserContent` over the phase batch builders. The runner uses that fallback and scans every phase-132 builder present on disk.

**3. [Rule 3 - blocking-issue] 132-02 + 132-04 batch builders absent.** The plan's boundary-scan lists four builders (`buildHypergraphBatch`/`buildDedupBatch`/`buildWireItBatch`/`buildPseudonymizeBatch`). Only the 132-03 (`buildDedupCollapsePass`/`buildHeldRenamePass`) and 132-05 (`buildPseudonymizeBatch`) builders exist (132-02/132-04 live passes are deferred in the re-baseline; 132-01 ships `buildReifyCypher`, a raw-Cypher builder, not a makeBatch builder). The runner scans whatever phase-132 builders are present and skips absent modules gracefully, so it picks up a future 132-02/132-04 builder automatically without silent-passing on the HEALTH gate. Recorded in deferred-items.md DI-132-05-02.

No authentication gates occurred. No architectural (Rule 4) changes were needed.

## Known Stubs

None. The pseudonymize builder is fully wired (the only "stub" is the intentional v1.14.0 deferral of the live `--execute` path, documented in deferred-items.md and refused at the CLI). The 130.7 gate's live async reader remains a documented fail-closed stub owned by 130.7, not by this plan.

## Threat Flags

None. No new network endpoint, auth path, file-access pattern, or schema change at a trust boundary was introduced. The pseudonymize batch's only write surface (the live `:Person` name overwrite) is deferred and creds-gated through the 132-01 runner; the release gate is read-only.

## Self-Check: PASSED

- Files: all 5 created files present on disk (the 3 code/test files + SUMMARY.md + deferred-items.md).
- Commits: all 3 per-task commits found in `git log` (19f79d0c RED, 87bfa96c pseudonymize driver, 851ba2e4 release gate + registrations).
