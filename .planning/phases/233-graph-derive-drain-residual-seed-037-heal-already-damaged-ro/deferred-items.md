# Phase 233 -- deferred items (out of scope for this plan)

Discovered while executing 233-01. Each was verified PRE-EXISTING on the plan's
base commit, so per the executor scope boundary none was fixed here.

## 1. tests/test-session-start-preflight.sh S2/S3 fail on clean HEAD

- **Status:** PRE-EXISTING, not caused by this plan.
- **Symptom:** scenarios S2 ("missing -> systemMessage says 'missing'") and S3
  ("drifted -> systemMessage says 'drifted'") both get a bare
  `{"continue":true}` envelope instead of a warning envelope. 3/5 pass.
- **Proof it is pre-existing:** the suite was re-run against the unmodified
  `scripts/preflight-doctor.cjs` from HEAD (before the Phase 233 contribute()
  edit) and produced the byte-identical 3/5 result with the same two scenarios
  failing.
- **Likely cause (not investigated, not patched):** the fixture drives the
  legacy `main()` hook path, whose drift branch depends on class A resolving a
  legacy install topology; under the current marketplace-cache topology guard
  `drift.detected` stays false, so `main()` correctly emits an empty envelope.
  The test fixture appears to predate that topology guard. If so the FIXTURE is
  stale, not the code.
- **Next step:** a `/gsd-debug` session against the fixture, or fold into a
  later plan that touches `preflight-doctor.cjs` main() rather than
  `contribute()`.

## 233-02 Task 1: `tests/test-graph-derivation-verdict.cjs` 2/14 checks fail (PRE-EXISTING)

**Status:** OUT OF SCOPE for 233-02. Not caused by the RCA 4b deriveFn gate.

**Proof it is pre-existing:** `lib/core/graph-derivation.cjs` was temporarily restored to its
base-commit bytes (`git checkout -- lib/core/graph-derivation.cjs`), the suite re-run, and the
modified file restored. Base result is byte-identical to the post-change result:
`VERDICT: {"passed":false,"checks":14,"failed":2}` with the same two findings.

**The two failing checks:**
- GDH-09 healed-room full-citizen: "born-like: a FEYNMAN body carries the ## Timeline (auto) section"
- D-169-11 depth>=2: "jonathan-contractor-motj: a FEYNMAN body carries the ## Timeline (auto) section"

Both assert that a per-section FEYNMAN body emitted during room healing contains a
`## Timeline (auto)` section. That is a FEYNMAN-template concern in the room-heal writer, with
no code path through `runDerivation`'s deriveFn resolution. The other 12 checks pass, including
every derivation-composer check.

**Hypothesis for whoever picks this up:** the FEYNMAN section template appears to have lost (or
never gained) the `## Timeline (auto)` block that the Phase-169 verdict suite expects, so the
TEST may encode a contract the writer no longer honors. Worth checking whether the contract or
the writer is the stale side before patching either.
