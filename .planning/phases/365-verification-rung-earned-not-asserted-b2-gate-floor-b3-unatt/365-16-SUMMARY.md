---
phase: 365-verification-rung-earned-not-asserted-b2-gate-floor-b3-unatt
plan: 16
subsystem: phase-close
tags: [phase-close, requirements, canon-phase-map, open-handoffs, phase-365.1, ladder-ratification, theo-parity, research-trail]
requires: [365-01, 365-02, 365-03, 365-04, 365-05, 365-06, 365-07, 365-08, 365-09, 365-10, 365-11, 365-12, 365-13, 365-14, 365-15]
provides:
  - Phase 365.1 opened and BLOCKED (365.1-INPUT.md plus one ROADMAP entry), fenced by data/verification-ladder.json
  - 365-LADDER-RATIFICATION-ASK.md (drafted, not sent)
  - 365-CLOSE-GATE.md (the full gate, doctor comparison, Theo list)
  - V365-01..18 closed [x] with Measured lines
  - Phase 365 rows in docs/CANON-PHASE-MAP.md (Parts 3, 6, 7, 8, 9, 11, 12) and the Phase 365 CLOSED entry in docs/OPEN-HANDOFFS.md
  - 365-FOLLOW-ONS.md (Theo schema-parity sync plus 19 carry-forwards)
  - 365-RESEARCH-TRAIL.md (entry text plus a Routing table for 365-17)
affects: [365-17, 365.1]
requirements: [V365-01, V365-02, V365-03, V365-04, V365-05, V365-06, V365-07, V365-08, V365-09, V365-10, V365-11, V365-12, V365-13, V365-14, V365-15, V365-16, V365-17, V365-18]
key-files:
  created:
    - .planning/phases/365.1-edge-derived-rung-after-ladder-ratification/365.1-INPUT.md
    - .planning/phases/365-verification-rung-earned-not-asserted-b2-gate-floor-b3-unatt/365-LADDER-RATIFICATION-ASK.md
    - .planning/phases/365-verification-rung-earned-not-asserted-b2-gate-floor-b3-unatt/365-CLOSE-GATE.md
    - .planning/phases/365-verification-rung-earned-not-asserted-b2-gate-floor-b3-unatt/365-FOLLOW-ONS.md
    - .planning/phases/365-verification-rung-earned-not-asserted-b2-gate-floor-b3-unatt/365-RESEARCH-TRAIL.md
  modified:
    - .planning/ROADMAP.md
    - .planning/REQUIREMENTS.md
    - docs/CANON-PHASE-MAP.md
    - docs/OPEN-HANDOFFS.md
decisions:
  - "V365-02 is closed on its structural half, as the row's own text defines it; the derived-rung half stays the KNOWN red RED-365-BYTE-DERIVED handed to 365.1"
  - "V365-17 is closed on the fence, 365.1-INPUT.md and the drafted ask; whether the navigator sends the ask is 365-17's record"
  - "A Part 6 row was added to the canon map (the plan lists 3, 7, 8, 9, 11, 12; the plan's canon_parts also names 6, and the Phase 363 precedent has a Part 6 row)"
metrics:
  tasks: 4
  files: 9
  commits: 6
---

# Phase 365 Plan 16: Phase Close Summary

Phase 365 is closed on the record: the ladder-blocked remainder has a gated home (Phase 365.1, BLOCKED on the paper author's ratification), the ask is drafted, the full gate is green, all 18 V365 rows are `[x]` with measured proof, the canon map and handoff log are updated, and the follow-ons (including the Theo schema-parity sync and 19 carry-forwards) and the research-trail draft with its routing table are committed. Nothing was filed to any room.

PLAN_BASE = `e46359566cfa2777311f1bf18d5517e1b566407f`.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | `35f942f1c` | docs(365-16): open Phase 365.1 behind the ladder ratification; draft the ratification ask |
| 2 | `2d029c0e1` | docs(365-16): phase gate run recorded |
| 3a | `aa8b1ef61` | docs(365-16): close V365 rows with measured proof |
| 3b | `4237ae434` | docs(365-16): canon map rows and the close handoff |
| 3c | `cf734c1ff` | docs(365-16): follow-ons including the Theo schema-parity sync |
| 4 | `e67bedaaf` | docs(365-16): research-trail draft with routing |

Every sha passes `git merge-base --is-ancestor <sha> HEAD`. The three shared-doc commits (35f942f1c for ROADMAP.md, aa8b1ef61 for REQUIREMENTS.md, 4237ae434 for CANON-PHASE-MAP.md and OPEN-HANDOFFS.md) used the trimmed-patch procedure: index confirmed clean, `git diff -- <file>` to a scratch patch, `git apply --cached`, `git diff --cached --name-only` checked, plain `git commit -m`. All four shared files were clean before this plan's first edit (the peer's Phase 366 hunks had already been committed), so each patch held only this plan's hunks; `git show --stat` of each commit lists only the intended files (ROADMAP: +11 lines; REQUIREMENTS: +137 / -18, the 18 flipped checkboxes; CANON-PHASE-MAP: +7; OPEN-HANDOFFS: +2). STATE.md and ROADMAP progress were not touched; no `state.*` writer, `roadmap.update-plan-progress` or `query commit` ran. The peer's uncommitted `353-FLEET-REPORT.json` was left alone.

## Verification (HEAD `e67bedaaf156db60392db5cb39ec08e339515784`)

| Run | Result |
|-----|--------|
| `RUN_365_REGRESSIONS=1 bash tests/run-all-365.sh` (full, at `35f942f1c`, before the later docs commits) | exit 0, `PASSED=66 FAILED=0 SKIPPED=0 KNOWN=6`; regression block 354 1/1, 355 4/4, 356 0/0, 358 6/6, 363 4/4 (now/base), all PASSED |
| `RUN_365_REGRESSIONS=1 bash tests/run-all-365.sh` (full, re-run at the final HEAD `e67bedaaf`, so the dash fence also covered the new docs) | exit 0, `PASSED=66 FAILED=0 SKIPPED=0 KNOWN=6`, same five regression suites PASSED |
| `node scripts/build-harness-manifest.cjs --check` | OK at both HEADs |
| `node scripts/doctor.cjs --acceptance` | 21/22; the one failing point is `verify-release-clean-tree` ("tracked-file drift: 1 file(s)"), the same point recorded in the base `doctor_failing_points` (the drifting file is the peer's `353-FLEET-REPORT.json`); no new point |
| `node scripts/check-cirs-declaration.cjs --check` over the 365 plans | OK (17 plans) |
| `node tests/test-365-ladder-fence.cjs` | PASS=9 FAIL=0, fence armed |
| `node tests/test-canon-part-9-ratification.cjs`, `node tests/test-250-doctrine-fence.cjs` (tests that read CANON-PHASE-MAP.md) | exit 0 |

The six KNOWN legs are `RED-365-BYTE-DERIVED` (the one 365 leg, owned by 365.1) and five pre-existing neighbor reds (test-238, test-237, test-345, test-267 checks b and d, test-198 flag off). Counts equal the baseline recorded at `603e5cba6` (66 / 0 / 0 / 6).

## V365 rows

All 18 flipped to `[x]` with a `**Measured:**` line naming its tests and the gate result: V365-01..V365-18. None left open. Two are closed on a narrowed claim, stated in the row: V365-02 (structural half only; the derived half is the KNOWN red `RED-365-BYTE-DERIVED`, 365.1) and V365-17 (fence, 365.1-INPUT.md and the drafted ask; the send status is for 365-17 to record). Only the V365 section of REQUIREMENTS.md changed (the diff hunks span lines 3956 to 4052 of the file as committed, nothing in the Traceability counts or any other family).

## Doctor comparison

Base set: `verify-release-clean-tree`. Close set: `verify-release-clean-tree`. New point caused by 365: none. This point flips with peer activity in the shared tree; it is recorded as pre-existing with the evidence above.

## Theo schema-parity items

Recorded in 365-CLOSE-GATE.md, 365-FOLLOW-ONS.md (heading "Theo schema-parity sync needed after the tagged release") and the Phase 365 CLOSED handoff entry: (1) the changed `gate_render.subject_node_id` description (365-08, old and new strings in 365-08-SUMMARY); (2) refresh candidates not made: `chain_run`, `gate_answer`, `research_run`; (3) response-only additions; (4) `wire-snapshot-zod4.json` still holds the old strings; Theo mirrors only after the release's `theo-resync` dispatch.

## Deviations from Plan

**1. [Scope note] Part 6 row added to the canon map.** The plan lists Parts 3, 7, 8, 9, 11 and 12; the plan's own `canon_parts` includes 6 and the Phase 363 precedent carries a Part 6 row, so one was added. Part 12 has no table of its own, so its row sits in the v1.15.0 milestone table (the one carrying the "Canon Parts" column and the Phase 363 Part 12 row).

**2. [Scope note] Follow-ons expanded from the coordinator's list.** The plan lists 13 items; the follow-ons carry 19 carry-forwards, adding the coordinator's collected items (side-door floor bypass, the SUPERSESSION-CONTRACT dated note, `_executeResumedEntry` and `targetSection`, the stale test-353 EVENT_TYPES pin, the `readGraphFindings` Part 9 bypass, the process recommendation that the aggregator default to the regression block, the pre-existing reds observed, and the wording ratification note). The Theo section also carries the `wire-snapshot-zod4.json` observation.

**3. [Scope note] No separate Theo item for graph_write, room_bind.** No 365 plan touched either; recorded as "not touched".

**4. [Process] Row-flip tooling.** A first pass of the Measured wrapping touched a Phase 363 `Measured:` block (it ran on a line range, not on the V365 section). It was caught in the diff before staging; the file was rebuilt from `HEAD` and the pass redone restricted to the V365 section. The committed diff (`aa8b1ef61`) shows deletions only on the 18 flipped checkbox lines.

No authentication gates. No checkpoints in this plan (365-17 owns the navigator-gated routing and filing and was not started).

## Known Stubs

None.

## Threat Flags

None new. T-365-11 (peer hunks swept) mitigated: all four shared files were clean at the start, trimmed-patch staging, `git diff --cached --name-only` checked before each commit, ROADMAP got one hunk (366, 367, 368 byte-unchanged); T-365-27 (a row closed without proof) mitigated: every flip carries a Measured line; T-365-15 (Theo drift forgotten) mitigated: the exact Theo item is in the follow-ons and the handoff; T-365-28 (real names) mitigated: roles only, no signature in the ask, no dash characters in any new file (`grep -nP '[\x{2013}\x{2014}]'` clean on all of them).

## Hand-offs for 365-17

- `365-RESEARCH-TRAIL.md` holds the entry text (in a fenced block, to be filed verbatim) and a Routing table: row 1 `~/MindrianRooms/rethinking-mindrianos/research/2026-10-01-verification-rung-365-close-out.md`; rows 2a (`~/MindrianRooms/mindrianOS/research/`, the Phase 363 precedent) and 2b (`~/MindrianOS/research/`, the later Eureka precedent) are alternatives, the navigator picks one. Nothing is filed; the check `ls ~/MindrianRooms/rethinking-mindrianos/research/*-verification-rung-365-close-out.md` finds no file.
- `365-LADDER-RATIFICATION-ASK.md` is drafted and not sent; 365.1-INPUT.md says "drafted, not yet sent, updated by 365-17".
- The orchestrator owns ROADMAP progress and the Phase 365 entry status; STATE.md was not written.

## Self-Check: PASSED

- FOUND: 365.1-INPUT.md, 365-LADDER-RATIFICATION-ASK.md, 365-CLOSE-GATE.md, 365-FOLLOW-ONS.md, 365-RESEARCH-TRAIL.md; the Phase 365.1 entry in ROADMAP.md; 18 `- [x] **V365-` rows; seven Phase 365 rows in CANON-PHASE-MAP.md; "Phase 365 CLOSED" in OPEN-HANDOFFS.md
- FOUND commits 35f942f1c, 2d029c0e1, aa8b1ef61, 4237ae434, cf734c1ff, e67bedaaf (all ancestors of HEAD)
