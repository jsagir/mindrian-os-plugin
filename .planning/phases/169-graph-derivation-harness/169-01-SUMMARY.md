---
phase: 169-graph-derivation-harness
plan: "01"
subsystem: graph-derivation-harness
tags: [contracts-on-disk, red-stubs, nyquist, phase-gate, shared-iface, fixtures, gdh-08, gdh-09, depth-2]
requires:
  - "169-00 (NESTED_WITHIN minted into the frozen ALLOWED_EDGE_TYPES; run-all-169.sh scaffold + the two floor tests)"
  - "lib/core/room-db.cjs openRoomDb/closeRoomDb (temp room.db substrate the stubs build against)"
  - "lib/core/navigation/edges.cjs writeEdge + NESTED_WITHIN (the chokepoint the lineage/rollup stubs assert through)"
provides:
  - "tests/run-all-169.sh FINALIZED: the single PASS/FAIL phase gate registering all thirteen 169 RED stubs + the two carried floor tests + a Part-8 grep sweep + an em-dash sweep"
  - "the thirteen RED test stubs encoding the GDH-01..09 + depth>=2 contracts against the shared IFACE block (each RED-by-require until Waves 3-6 build the module)"
  - "tests/fixtures/169/stored-method.docx (a method-0 stored zip, two w:t runs, Node built-ins only) + tests/fixtures/169/sample.html"
affects:
  - "Plan 02 (room-root.cjs) turns test-room-root-resolver.cjs GREEN"
  - "Plan 03 (doc-text-extractor.cjs) turns test-doc-text-extractor.cjs GREEN"
  - "Plan 04 (graph-derivation.cjs + graph-candidate-producer.cjs) turns subroom-rollup / candidate-producer / graph-derivation-loop / derive-idempotence / recursive-rollup GREEN"
  - "Plan 05 (graph-backfill.cjs + the sweep hook) turns derive-backfill-acceptance GREEN"
  - "Plan 06 (brain-derive boundary scan) turns 169-brain-boundary GREEN"
  - "Plan 07 (graph-self-heal.cjs) turns sentinel-self-heal / room-lineage-edge / depth2-full-citizen GREEN"
tech-stack:
  added: []
  patterns:
    - "RED-by-require stub: the stub requires its not-yet-built IFACE module so it fails until that module ships (Nyquist: no module ships without a test that preceded it)"
    - "phase-gate aggregator mirroring run-all-167.sh (per-suite invoke + PASS/FAIL accumulate + Part-8 grep sweep + em-dash sweep + final tally + non-zero exit)"
    - "method-0 stored .docx synthesized with Node built-ins (no inflate needed to read) so the extractor fixture is dependency-free"
    - "Part-8 forbidden-substring sweep (Phase 90 5-tripwire) with sharp-regex self-test so the sweep cannot pass vacuously"
key-files:
  created:
    - tests/test-room-root-resolver.cjs
    - tests/test-doc-text-extractor.cjs
    - tests/test-subroom-rollup.cjs
    - tests/test-candidate-producer.cjs
    - tests/test-graph-derivation-loop.cjs
    - tests/test-derive-idempotence.cjs
    - tests/test-derive-backfill-acceptance.cjs
    - tests/test-169-brain-boundary.cjs
    - tests/test-sentinel-self-heal.cjs
    - tests/test-room-lineage-edge.cjs
    - tests/test-recursive-rollup.cjs
    - tests/test-depth2-full-citizen.cjs
    - tests/fixtures/169/stored-method.docx
    - tests/fixtures/169/sample.html
  modified:
    - tests/run-all-169.sh
decisions:
  - "the candidate-producer stub asserts BOTH a CONTRADICTS AND a CONVERGES candidate emit from a stub LLM (D-169-06: not CONTRADICTS-only); every emitted edge_type is in the frozen cascade subset"
  - "the GDH-05 loop stub asserts review_status lands on the NODE, never on the edge (Part 9 Pitfall 1: no edge.properties.review_status)"
  - "the self-heal stub asserts the approvedBy gate BOTH ways (refuse without; full birthRoom-reuse wiring + registry/sentinel parent fields with)"
  - "the Part-8 sweep stub is RED-by-design via a MISSING-surface gate (the swept derivation surfaces ship in Plans 04-06) plus a sharp-regex self-test so it can never pass vacuously"
metrics:
  duration_min: 7
  completed: 2026-06-19
  tasks: 2
  files: 15
  commits: 2
---

# Phase 169 Plan 01: Wave 0 Foundation (Shared IFACE + RED Stubs + Fixtures) Summary

Laid the contracts-on-disk bus for the Graph-Derivation Harness: finalized the single phase-gate
aggregator `tests/run-all-169.sh`, landed the thirteen RED test stubs against the shared IFACE block
(every later wave turns one GREEN), and added the two extractor fixtures, all RED-by-design at this wave
and zero em-dashes.

## What Was Built

- **The phase-gate aggregator (finalized).** `tests/run-all-169.sh` was EXTENDED (not clobbered) from the
  Wave 1 scaffold: it now registers all thirteen 169 RED stubs alongside the two carried floor tests
  (`test-edges-room-lineage-floor.cjs` from 169-00 + `test-edges-part4-cascade-floor.cjs` from Phase 168),
  runs a Part-8 grep sweep over the 169 lib/script surfaces (BRAIN_WRITE + RAW_FETCH + external-http
  regexes, comment-filtered, skip-until-built so the boundary is guarded the instant a surface lands),
  keeps the frozen-edge-set assertion (NESTED_WITHIN minted, PART_OF untouched), and extends the em-dash
  sweep to cover every stub. It mirrors the `run-all-167.sh` shape (per-suite invoke + PASS/FAIL
  accumulate + final Total/Passed/Failed + non-zero exit on any failure) and runs to completion even when
  every stub is RED. The runner's own em-dash sweep glyph is a bash codepoint escape (the U+2014 form) so the
  runner carries no literal em-dash to trip its own sweep.
- **The thirteen RED stubs (the contracts-on-disk).** Each stub `require`s its not-yet-built IFACE module
  so it fails RED until that module ships (Nyquist):
  - THE NINE ORIGINAL: `test-room-root-resolver.cjs` (GDH-01, the sub-room resolves while the registry
    active room is the parent), `test-doc-text-extractor.cjs` (GDH-04, >0 runs for the synthetic
    stored-method fixture + the live b2 skip-if-absent, .html via cheerio, source bytes UNCHANGED per
    D-169-03), `test-subroom-rollup.cjs` (GDH-03, one-hop read-side ATTACH, parent rows unchanged),
    `test-candidate-producer.cjs` (GDH-05 producer, asserts BOTH CONTRADICTS AND CONVERGES from a stub
    LLM per D-169-06, frozen cascade subset, no Brain), `test-graph-derivation-loop.cjs` (GDH-05 loop,
    candidateToFinding -> proposed-NODE-with-review_status pattern + NO edge.properties.review_status +
    fable-mode rejects the unjustified CONTRADICTS), `test-derive-idempotence.cjs` (GDH-07, stable
    content-hash id so a re-run is a no-op + confirmed node untouched),
    `test-derive-backfill-acceptance.cjs` (GDH-06, heal-first then typed-edge 0 -> N, synthetic fallback +
    real-b2 skip-if-absent), `test-169-brain-boundary.cjs` (Part 8 5-tripwire forbidden-substring sweep
    with a sharp-regex self-test).
  - THE FOUR NEW (GDH-08/09 + depth): `test-sentinel-self-heal.cjs` (detect finds the sentinel-less
    folder; healRoom WITHOUT approvedBy refuses no_approval; WITH approvedBy writes .room-root +
    bootstraps room.db + birthRoom reuse ROOM.md/STATE.md/MINTO.md + registry parent + sentinel parent
    field), `test-room-lineage-edge.cjs` (the heal writes a NESTED_WITHIN edge room:child -> room:parent
    via writeEdge, walkable, enum/scalar props only), `test-recursive-rollup.cjs` (rollupSubRooms recurses
    TRANSITIVELY across a 3-level top->mid->leaf topology so a sub-sub-room edge reaches the TOP; top rows
    unchanged), `test-depth2-full-citizen.cjs` (the motj-ecosystem -> jonathan-contractor-motj ->
    b2-journey shape; EACH nested level a full citizen: ROOM.md + own room.db + per-section FEYNMAN +
    `## Timeline (auto)` + NESTED_WITHIN up + visible from the parent rollup down).
- **The fixtures.** `tests/fixtures/169/stored-method.docx` is a valid compression-method-0 (stored) zip
  carrying `word/document.xml` with two `w:t` runs, synthesized with Node built-ins only (a hand-rolled
  local-file-header + central-directory + EOCD writer with a CRC32) so no inflate is needed to read it and
  the extractor test does not depend on the live b2 fixture. `tests/fixtures/169/sample.html` carries a
  body paragraph for the cheerio branch.

## The Shared IFACE Block

The plan's `shared_iface_contract` is the single source of the signatures Plans 02-07 cite verbatim:
`resolveRoomRoot(filePath)` + `findRoomRootSentinels()` (room-root.cjs, Plan 02), `extractDocText(absPath)`
(doc-text-extractor.cjs, Plan 03), `produceCandidates({roomDir, artifactPair, llm})` (the LLM candidate
PRODUCER, graph-candidate-producer.cjs, Plan 04), `runDerivation({roomDir, runChain, selfCritiqueFn,
deriveFn})` + `candidateToFinding(candidate)` + `rollupSubRooms(parentRoomDir)` RECURSIVE
(graph-derivation.cjs, Plan 04), `detectUnsentineledArtifactFolder(roomDir)` + `healRoom({folder,
parentRoomDir, slug, approvedBy, runTimeline})` (graph-self-heal.cjs, Plan 07), the lazygraph-ops
ROOT-FILES pass + sub-room recursion (Plan 04), the `/mos:graph --derive` HEAL-FIRST backfill entry
(Plan 05), the Stop-enqueue / SessionStart-drain sweep hook (Plan 05), and the NESTED_WITHIN lineage edge
(Plan 00, already minted). Each of the thirteen stubs names the exact IFACE signature it tests and is
RED-by-require until that signature's module ships.

## Wave 1 Preservation

The Wave 1 (169-00) work was PRESERVED, not clobbered: the two carried floor tests stay registered FIRST
in `run-all-169.sh` (so the frozen-vocabulary proof runs before the RED stubs), the frozen-edge-set
assertion (NESTED_WITHIN minted, PART_OF untouched) and the em-dash sweep carry over, and NESTED_WITHIN in
`edges.cjs` is untouched. Both floor suites stay GREEN at this wave (6/6 + 5/5 in their own runs;
PASSED in the aggregator).

## Verification

- `bash tests/run-all-169.sh` runs to completion, exit 1 (overall RED expected at this wave): Total 17,
  Passed 5, Failed 12. The 5 GREEN are the two carried floor tests + the frozen-edge-set assertion + the
  Part-8 grep sweep + the em-dash sweep. The 12 FAILED are the thirteen stubs minus
  `test-edges-room-lineage-floor` (which is one of the two GREEN floor tests counted above) -- i.e. all
  thirteen 169 stubs EXECUTE and report RED.
- Task 1 `<verify>` automated check returned `FIXTURES_OK` (both fixtures present + the room-lineage floor
  registered); the .docx local-file-header method field reads 0 (stored) and the two `w:t` runs appear
  uncompressed in the zip bytes.
- Task 2 `<verify>` automated check returned `STUBS_PRESENT` + `ALL_NEW_ASSERTS_PRESENT` (candidate-producer
  asserts both CONTRADICTS and CONVERGES; sentinel-self-heal asserts approvedBy; room-lineage-edge asserts
  NESTED_WITHIN; depth2-full-citizen asserts `## Timeline (auto)`).
- Each stub's RED is a `Cannot find module .../lib/core/<iface-module>.cjs` require failure (verified on
  graph-candidate-producer.cjs + graph-self-heal.cjs), NOT a syntax error -- confirming the stubs are RED
  because the IFACE modules are not built yet (Nyquist), exactly as the contracts-on-disk design requires.
- Em-dash sweep over all thirteen stubs + the aggregator + the fixtures: zero literal em-dashes.

## Deviations from Plan

None - plan executed exactly as written. Two `type="auto"` tasks; no auto-fixes, authentication gates, or
architectural escalations. The .html cheerio branch of `test-doc-text-extractor.cjs` is written
skip-if-cheerio-unavailable because `node_modules` is `git rm -r --cached`'d on `main` per the vendored
node_modules release rule; the RED-by-require on the not-yet-built extractor module is the real gate, so
the skip does not weaken the contract.

## Authentication Gates

None.

## Known Stubs

This entire plan is RED stubs by design (the contracts-on-disk bus). The thirteen RED stubs are SUPPOSED
to FAIL at this wave: they encode the GDH-01..09 + depth>=2 contracts that Waves 2-7 turn GREEN, one stub
per downstream module (Nyquist: no module ships without a test that preceded it). This is NOT a stub that
prevents the plan's goal -- the plan's goal IS to land the failing tests + the aggregator that executes
them. The mapping of each stub to the wave that turns it GREEN is recorded in the `affects` frontmatter.

## Threat Flags

None. No new network endpoint, auth path, file-access pattern, or schema change at a trust boundary was
introduced beyond the plan's `<threat_model>`. The stubs synthesize temp room.db + fixtures + temp room
topologies; no network. The Part-8 sweep stub + the aggregator's Part-8 grep sweep BOTH guard the
not-yet-built derivation surfaces for zero Brain egress the instant they land (T-169-01 / T-169-01b
mitigations: each stub requires its real module so it is RED until that module ships, and the self-heal +
producer + GDH-05 stubs assert their gates by instrumentation rather than passing vacuously).

## Commits

- `3a64f040` test(169-01): finalize phase-gate aggregator + add 169 fixtures
- `57450f37` test(169-01): add the thirteen RED stubs against the shared IFACE

## Self-Check: PASSED

- Created files exist: all twelve `tests/test-*.cjs` stubs + `tests/test-169-brain-boundary.cjs` +
  `tests/fixtures/169/stored-method.docx` + `tests/fixtures/169/sample.html` (all FOUND).
- Commit hashes exist in git: 3a64f040, 57450f37 (both FOUND).
- Em-dash sweep over all created files including this SUMMARY: zero literal em-dashes.
