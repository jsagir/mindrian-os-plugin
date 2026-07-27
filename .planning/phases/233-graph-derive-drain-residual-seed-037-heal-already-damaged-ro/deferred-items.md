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

## 233-03 Task 1: compute-hsi.py Tier 2 sends artifact ids to Pinecone (PRE-EXISTING)

**Status:** OUT OF SCOPE for 233-03. Predates this phase; untouched by it.

`scripts/compute-hsi.py::compute_semantic_similarity_tier2` calls
`index.fetch(ids=artifact_ids)`. Those ids are room-relative artifact paths
(`section/artifact-name`), which is user-content shape, and they leave the device.
Reachable only when BOTH `PINECONE_API_KEY` and `PINECONE_INDEX` are set AND `--tier 2`
is passed, so it is opt-in and it is not a Brain call: Canon Part 8's LOCAL-to-BRAIN
prohibition is not literally breached. But "artifact path names egress to a third-party
vector index behind an opt-in flag" deserves an explicit ruling rather than an implicit one.

`tests/run-all-233.sh` allow-lists this ONE exact line in its Part 8 sweep, with the reason
written into the file header, so any OTHER egress token in that file still fails the gate.

**Next step:** a Part 8 addendum ruling (or a small RCA). No code change until the ruling exists.

## 233-03 Task 2: the JS structural indexer and the Python walkers disagree about sub-rooms

**Status:** OUT OF SCOPE for 233-03. Discovered by this plan's live run, not caused by it.

This plan taught the four Python walkers to skip `.snapshots`, `sub-rooms` and `.context`
through the shared `lib/core/rs_corpus_exclude.py`. The JS side
(`lib/core/lazygraph-ops.cjs::rebuildGraph` plus `discoverSections`) still nodeifies the
scaffold files under the sub-rooms container. The live run on the RCA's evidence room produced
three such nodes: `sub-rooms`, `sub-rooms/MINTO`, `sub-rooms/_ROOM-MAP`.

Consequence today is mild and NOT a correctness break: those nodes simply never receive an HSI
pair, because the scoped corpus excludes that tree. But it is the same defect CLASS this plan
just closed on the Python side (two scanners with independent notions of what an artifact is),
one layer over, and it is the residue of Defect #4/#5 that a node-set-vs-corpus parity check
would catch.

**Next step:** give `discoverSections` the same shared exclude semantics, so the node set and
the HSI corpus are defined once rather than twice.

## 233-03: `scripts/__pycache__/*.pyc` is tracked in git

**Status:** repo hygiene, OUT OF SCOPE.

`scripts/__pycache__/compute-hsi.cpython-312.pyc` is a TRACKED file, so it churns in
`git status` on every test run that loads `compute-hsi.py` through importlib. Compiled bytecode
is a build artifact and belongs in `.gitignore`, not in history.

**Next step:** `git rm --cached` the `__pycache__` trees and add the pattern to `.gitignore`.
Trivial, but its blast radius is repo-wide, so it is not being done inside a scoped plan.
