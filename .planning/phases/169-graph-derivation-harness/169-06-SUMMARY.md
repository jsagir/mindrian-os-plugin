---
phase: 169-graph-derivation-harness
plan: "06"
subsystem: graph-derivation-harness
tags: [verdict, harness-as-code, adversarial-verify, part-8, depth-2, real-b2, medium-4, phase-gate, full-citizen]
requires:
  - "169-01 (the shared IFACE block + the thirteen RED stubs + run-all-169.sh scaffold)"
  - "169-02 (room-root.cjs resolveRoomRoot)"
  - "169-03 (doc-text-extractor.cjs extractDocText)"
  - "169-04 (graph-derivation.cjs runDerivation + rollupSubRooms RECURSIVE + candidateToFinding; graph-candidate-producer.cjs produceCandidates; the MEDIUM-4 cascade-disable in lazygraph-ops _indexArtifactBody)"
  - "169-05 (graph-backfill.cjs runDeriveBackfill HEAL-FIRST; the Stop sweep + SessionStart drain hooks)"
  - "169-07 (graph-self-heal.cjs healRoom + detectUnsentineledArtifactFolder; the NESTED_WITHIN lineage edge + the FEYNMAN ## Timeline (auto) refresh)"
provides:
  - "tests/test-graph-derivation-verdict.cjs: the adversarial {passed, findings[]} verdict (14 checks) proving GDH-01..09 + the canon guards + the MEDIUM-4 sole-cascade-writer check + the REAL-b2 heal-first 0 -> N + the depth>=2 full-citizen + parent-linkage + FEYNMAN-temporal + the NESTED_WITHIN lineage-legality, BY INSTRUMENTATION"
  - "tests/test-169-brain-boundary.cjs FINALIZED GREEN: the Part 8 forbidden-substring sweep over all six surfaces, guarding the Brain host + Brain-write tokens and EXEMPTING api.anthropic.com (the Part-8-legal LOCAL LLM transport), with a sharp-scan self-test"
  - "tests/test-sqlite-battle.cjs MIGRATED to the post-MEDIUM-4 reality (BATTLE-03/04 assert BELONGS_TO yes, INFORMS/CONTRADICTS from the structural index no) + carried in run-all-169.sh as a regression fence"
  - "tests/run-all-169.sh FINALIZED as the single PASS/FAIL phase gate: Total 20, Passed 20, Failed 0, exit 0"
affects:
  - "the phase is COMPLETE: /gsd-verify-work has a single GREEN gate (bash tests/run-all-169.sh)"
tech-stack:
  added: []
  patterns:
    - "adversarial {passed, findings[]} verdict via a record(check, passed, detail) + guard(check, fn) accumulator (mirrors test-harness-167-verdict.cjs / 166 W8 / 163 W6); a thrown AssertionError becomes a FAILED finding so a real defect is surfaced never swallowed"
    - "REAL-fixture heal-first acceptance NON-SKIPPABLE when present: the verdict copies the real b2-journey into a temp parent (never mutating the user room), strips prior state for a true cold start, runs runDeriveBackfill heal-first, and records the actual N + the derived edge types + the healed full-citizen markers in the finding detail (T-169-15 mitigation)"
    - "Part 8 boundary reconciliation: the sweep GUARDS the Brain host (mindrian-brain / brain.mindrian) + the Brain-write tokens and EXEMPTS api.anthropic.com (the llm-name-suggester LOCAL-transport precedent); the candidate-producer's anthropic fetch is LEGAL, the Brain host is the real breach"
    - "MEDIUM-4 sole-cascade-writer instrumentation: slice the _indexArtifactBody function body, comment-strip it, assert NO quoted cascade-type literal (CONTRADICTS/INFORMS/ENABLES/INVALIDATES) remains while BELONGS_TO stays"
key-files:
  created:
    - tests/test-graph-derivation-verdict.cjs
  modified:
    - tests/test-169-brain-boundary.cjs
    - tests/test-sqlite-battle.cjs
    - tests/run-all-169.sh
decisions:
  - "the b2 acceptance works on a COPY of the real fixture (fs.cpSync into a temp parent), never the user's live room; prior .room-root/.mindrian are stripped from the copy so typedEdgesBefore is a true 0 (cold start)"
  - "the Part 8 sweep treats brain-derive-command.cjs as the ONE Brain-touching deriver (Brain READ via brain-client allowed, Brain WRITE forbidden) and exempts api.anthropic.com from the raw-fetch/external-http bans, guarding the Brain host instead -- reconciling the stub rather than removing the transport"
  - "the MEDIUM-4 check scopes its scan to the _indexArtifactBody body (declaration to the next function) and comment-strips it so the disable-comment prose naming the cascade types does not self-trip the gate"
metrics:
  duration_min: 18
  completed: 2026-06-19
  tasks: 3
  files: 4
  commits: 3
---

# Phase 169 Plan 06: Wave 6 Verify (The Adversarial Structured Verdict + Phase-Gate Finalization) Summary

Shipped harness-as-code property 6 for the Graph-Derivation Harness: the adversarial structured
{passed, findings[]} verdict that proves GDH-01..09 + the canon guards BY INSTRUMENTATION, finalized the
Part 8 boundary sweep over all six surfaces, migrated the sqlite-battle fence to the post-MEDIUM-4 reality
and carried it, and locked tests/run-all-169.sh GREEN (Total 20, Passed 20, Failed 0). The phase is
complete.

## What Was Built

- **The adversarial verdict (`tests/test-graph-derivation-verdict.cjs`).** A `record(check, passed, detail)`
  + `guard(check, fn)` accumulator returning `{passed, checks, failed, findings}` (mirroring
  `test-harness-167-verdict.cjs`), 14 checks, all driving the SHIPPED surfaces (never mocks):
  - **GDH-01** resolveRoomRoot returns the NEAREST sub-room dir for a sub-room file while the active room is
    the parent (primary sentinel `.room-root`).
  - **GDH-04** extractDocText returns 45 chars on the stored `.docx` fixture and leaves the source bytes
    byte-identical (D-169-03 read-only).
  - **GDH-05 producer** produceCandidates emits BOTH a CONTRADICTS AND a CONVERGES candidate (D-169-06);
    every edge_type is in the frozen cascade subset.
  - **GDH-05 loop** runDerivation lands a PROPOSED node + 2 typed edges through the chokepoint;
    review_status on the NODE never the edge (Pitfall 1); fable-mode drops all low-quality candidates.
  - **GDH-07** a second runDerivation mints 0 duplicate nodes (stable content-hash id; re-run is a no-op).
  - **GDH-08** detect finds the sentinel-less folder; healRoom WITHOUT approvedBy refuses (no_approval, no
    fs write); WITH approvedBy it heals (gains `.room-root`).
  - **GDH-09** a healed room is a FULL CITIZEN (ROOM.md + own room.db + per-section FEYNMAN +
    `## Timeline (auto)` + NESTED_WITHIN room:child -> room:parent).
  - **GDH-03 + recursive** rollupSubRooms sees a sub-room edge AND a sub-sub-room (leaf) edge reaches the
    TOP rollup (arbitrary depth); the parent db edge-row count is unchanged (read-only ATTACH UNION).
  - **D-169-11 depth>=2** builds motj-ecosystem -> jonathan-contractor-motj -> b2-journey, asserts EACH
    nested level is a full citizen + the b2 leaf edge is visible from the top rollup.
  - **GDH-06 + D-169-08/09** the REAL-b2 heal-first 0 -> N moat (see below).
  - **MEDIUM-4** no derivation-owned cascade type is raw-INSERTed in the indexer body; BELONGS_TO stays.
  - **Part 4** every cascade subset member is in the frozen ALLOWED_EDGE_TYPES set; NESTED_WITHIN + PART_OF
    both members (lineage minted, taxonomy untouched).
  - **lineage-legality** a room->room NESTED_WITHIN writes through the chokepoint; BELONGS_TO + an off-set
    type are both rejected (NESTED_WITHIN is the legal lineage edge, NOT PART_OF, NOT BELONGS_TO).
  - **no em-dash** zero U+2014 across the five Phase-169 verify surfaces.

- **The finalized Part 8 boundary sweep (`tests/test-169-brain-boundary.cjs`, the LAST RED stub turned
  GREEN).** Reconciled to the real Canon Part 8 boundary over all six surfaces (graph-derivation +
  graph-candidate-producer + graph-self-heal + the Stop sweep hook + the SessionStart drain hook +
  brain-derive-command): GUARDS the Brain host (`mindrian-brain` / `brain.mindrian`) + the Brain-WRITE
  tokens and EXEMPTS `api.anthropic.com` (the Part-8-legal LOCAL LLM transport, the llm-name-suggester
  precedent). The candidate-producer's `fetch(api.anthropic.com)` is LEGAL; the Brain host is the breach.
  brain-derive-command is the ONE Brain-touching deriver (Brain READ via brain-client allowed, Brain WRITE
  forbidden). Sharp-scan self-test plants an artifact-body Brain-write token + a forbidden Brain-host fetch
  (RED) then proves the comment-filter + the anthropic exemption (GREEN). 6/6.

- **The migrated battle fence (`tests/test-sqlite-battle.cjs`).** BATTLE-03 now asserts indexArtifact
  writes the structural BELONGS_TO edge AND does NOT create an INFORMS edge from the `[[wikilink]]`;
  BATTLE-04 asserts indexArtifact does NOT create a CONTRADICTS edge from a contradiction-near-wikilink
  artifact (derivation via navigation.writeEdge is the sole cascade writer post-D-169-08). The other ten
  battle cases stay unchanged. 16/16, 0 fail. Registered in run-all-169.sh as a carried regression fence so
  the cascade-disable break is no longer invisible.

- **The finalized phase gate (`tests/run-all-169.sh`).** Registers every 169 suite + the verdict + the
  depth2 full-citizen test + the Part 8 sweep + the carried Phase 168 cascade floor + the carried Phase
  169-00 room-lineage floor + the carried migrated sqlite-battle fence + the em-dash sweep. Prints
  Total/Passed/Failed, exits non-zero on any failure. Final: **Total 20, Passed 20, Failed 0, exit 0.**

## The REAL b2-journey moat (D-169-08 + D-169-09 + D-169-11, HIGH-2)

The real fixture (`~/MindrianRooms/motj-ecosystem/sub-rooms/jonathan-contractor-motj/b2-journey`) was
PRESENT (no `.room-root`, no room.db, flat artifacts), so the heal-first acceptance ran NON-SKIPPABLY
against a COPY of it (the verdict never mutates the user's live room). Recorded result:

- **Artifacts:** 35 indexable artifacts in the flat sentinel-less folder.
- **Typed-edge moat:** `0 -> 18` typed cascade edges after the HEAL-FIRST backfill.
- **Derived edge types:** `CONTRADICTS:5, CONVERGES:6, ENABLES:2, INFORMS:5`.
- **Healed full-citizen markers:** ROOM.md + own `.mindrian/room.db` + `.room-root` (the sentinel-less
  folder became a full-citizen child room FIRST, then derived).
- **Depth>=2:** the 3-level topology motj-ecosystem -> jonathan-contractor-motj -> b2-journey was built
  and EACH nested level proven a full citizen (ROOM.md + own db + per-section FEYNMAN +
  `## Timeline (auto)` + NESTED_WITHIN up + visible from the top rollup down); a sub-sub-room edge reached
  the TOP-level rollup (arbitrary-depth transitivity).

This is the wicked-problem substrate self-wiring: the nested folder hierarchy carrying memory + typed edges
at every level, healed-first into citizenship, moat empty to populated at arbitrary depth.

## Deviations from Plan

None - plan executed exactly as written. Three `type="auto"` tasks; no auto-fixes, no authentication gates,
no architectural escalations. The verdict found NO real defect in Waves 1-5 (all 14 checks passed on the
first instrumented run), so there was no in-wave self-defect to report and no Wave-1-5 defect to escalate.
The Part 8 stub reconciliation (guard the Brain host + exempt api.anthropic.com) is the intended
finalization per the plan's `<rules>` (turn the stub GREEN by reconciling the sweep, NOT by removing the
transport), not a deviation.

## Authentication Gates

None.

## Known Stubs

None. This wave turned the LAST RED stub (test-169-brain-boundary.cjs) GREEN. No stub remains: every 169
suite is GREEN in the phase gate (Total 20, Passed 20, Failed 0). No hardcoded empty values flow to a UI;
the verdict + sweep drive real surfaces by instrumentation.

## Threat Flags

None. No new network endpoint, auth path, file-access pattern, or schema change at a trust boundary was
introduced beyond the plan's `<threat_model>`. The verdict drives existing shipped surfaces and works on a
COPY of the real fixture (never the user room); the Part 8 sweep proves zero Brain egress across all six
surfaces (T-169-14); the verdict's MEDIUM-4 check + the carried battle fence prove derivation is the sole
cascade writer (T-169-18 / T-169-19); the depth2 + verdict checks close the original fan-out gap
(T-169-27); the REAL b2 heal-first 0 -> 18 is non-skippable evidence (T-169-15); both carried floor tests
prove the frozen vocabulary is untouched (T-169-16).

## Commits

- `55a6541f` test(169-06): adversarial verdict (GDH-01..09 + real-b2 0->N + depth>=2 + MEDIUM-4) + finalized Part-8 sweep
- `e0762606` test(169-06): migrate sqlite-battle BATTLE-03/04 to post-MEDIUM-4 reality + carry it in the phase gate
- `52e4c950` test(169-06): finalize run-all-169.sh as the single GREEN phase gate

## Self-Check: PASSED

- Created file exists: `tests/test-graph-derivation-verdict.cjs` (FOUND).
- Modified files exist: `tests/test-169-brain-boundary.cjs`, `tests/test-sqlite-battle.cjs`,
  `tests/run-all-169.sh` (all FOUND).
- Commit hashes exist in git: 55a6541f, e0762606, 52e4c950 (all FOUND).
- `bash tests/run-all-169.sh`: Total 20, Passed 20, Failed 0, exit 0 (GREEN).
- `node tests/test-graph-derivation-verdict.cjs`: VERDICT {passed:true, checks:14, failed:0}.
- Em-dash sweep over all modified files + this SUMMARY: zero literal em-dashes.
