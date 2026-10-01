---
phase: 365-verification-rung-earned-not-asserted-b2-gate-floor-b3-unatt
verified: 2026-10-01T00:00:00Z
status: human_needed
score: 18/18 requirements verified (2 on honestly narrowed claims); 0 blocker gaps
overrides_applied: 0
re_verification:
  previous_status: none
gaps: []
deferred:
  - truth: "Edge-derived rung (B1 derivation), person node (B1a), B4 split of the unsupported scan, Phase 358 record migration"
    addressed_in: "Phase 365.1"
    evidence: "ROADMAP Phase 365.1 goal: derive a claim's verification rung from its own edges, add the person node, split the unsupported scan, migrate Phase 358 records, all behind the paper author's ratification (data/verification-ladder.json ratified: true)"
human_verification:
  - test: "Send the ladder ratification ask to the paper author (365-LADDER-RATIFICATION-ASK.md) and record the answer"
    expected: "A ratify or amend answer on the six draft rungs; flipping data/verification-ladder.json ratified to true opens Phase 365.1"
    why_human: "Status is drafted, edits applied, not sent. Only the navigator sends it. It is the hard blocker for 365.1 and for freezing STANDING_WORDS and HELD_WORDS."
  - test: "Read the standing words on a real room: the gate card why-line, room home held claims, graph panel row, /mos:status --checks"
    expected: "A model-checked claim reads as 'not yet checked against a source', not as a failure; no score, percent or badge; the closing line 'A count is not a verdict. Only a person confirms a claim.' stays last"
    why_human: "'Legible without punishing' is a judgment about tone. The graph panel row reads awkwardly ('Checked against: recorded as checked only by asking a model', FOLLOW-ONS item 16)."
  - test: "Run the manual two-navigators falsification protocol in 365-BASELINE.md"
    expected: "A recorded outcome for property test 1 (do frames diverge as far as two unguided prompts)"
    why_human: "Manual protocol by design; recorded as NOT RUN."
  - test: "After the tagged release, mirror the Theo schema-parity list (365-FOLLOW-ONS.md, gate_render.subject_node_id description first)"
    expected: "Theo copies carry the new description; wire-snapshot-zod4.json refreshed"
    why_human: "Release-gated cross-repo action; must not happen before the release."
  - test: "Navigator decides the side-door floor bypass (FOLLOW-ONS carry-forward 1)"
    expected: "Either route selector-decisions, futures orchestrator, sensor-expert-skill, qualify-opportunity and goal-gate approvals through composeFloorNotice, or accept the bypass in writing"
    why_human: "A scope decision. Not decided at close."
---

# Phase 365: Verification rung earned, not asserted - Verification Report

**Phase Goal:** Make a claim's verification rung earned, not asserted. Record today's failures first, then ship B2 (rung shown in words at the approval gate; a room rung floor lands below-floor approvals at needs_evidence), B3 (a room constraints artifact read before any unattended step; halts recorded), B5 (standing in words on rendered surfaces), and fence the ladder-blocked work (derived rung, person node, B4, migration) to Phase 365.1.
**Verified:** 2026-10-01
**Status:** human_needed (all automated checks pass; five human items remain, none are blockers)
**Re-verification:** No, initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Failing baseline recorded before code (byte, one-week, floor, falsification) | VERIFIED | `tests/fixtures/365-pre-phase.json` base_sha 9ada13b79; `365-baseline-red.json`, `365-falsification-record.json`; `test-365-baseline.cjs` PASS 7/0; the three falsify tests exit 0; two-navigators is a written protocol, honestly marked NOT RUN |
| 2 | Identical-text claims differ in a computed, filterable field (byte test, structural half) | VERIFIED (narrowed, honest) | `verification.cjs` `claimStanding` (lines 369-440) reads only OUTBOUND SOURCED_FROM/DEPENDS_ON/ASSUMES edges to nodes with non-empty `url` and `retrieved_at`; `listClaimsForChecking` carries `standing` and a filter. `test-365-acceptance-byte.cjs` exit 0. Derived-rung half stays red as KNOWN `RED-365-BYTE-DERIVED` (reproduced, exit 1) |
| 3 | One-week test: model-checked claim approved at default floor never reaches confirmed; a fresh process learns what it was checked against | VERIFIED | `test-365-acceptance-one-week.cjs` exit 0 (second spawned process, `claim_read` standing words); `test-365-floor-gate.cjs` 59/0 |
| 4 | Floor test: below-floor approve lands needs_evidence; why-line and relabelled approve show before the click on all three rungs and the meeting card; no confirm-anyway | VERIFIED | `gate.cjs` `_floorPromoteClaim` (lines 66-146) calls `claimStanding` + `standingMeetsFloor`, `holdForEvidence` when not met; `test-365-acceptance-floor.cjs` and `test-365-floor-notice.cjs` exit 0 |
| 5 | Floor configurable in ROOM.md as an id; absent means default `secondary_document`, never written | VERIFIED | `test-365-floor-reader.cjs` exit 0; `FLOOR_IDS` equals the draft ladder ids, `FLOOR_ALIASES` map provisional ids |
| 6 | Floor enforced for claims only; one additive transition; confirmNode body unchanged | VERIFIED | git diff vs base: `transitions.cjs` +`needs_evidence->confirmed` only (human-attribution guard covers 'confirmed'); `confirm-node.cjs` adds `holdForEvidence` and leaves `confirmNode` untouched (digest pinned in `test-365-baseline.cjs`); opportunity path byte-identical (gate.cjs lines 200-221); `test-365-transitions.cjs` 13 assertions |
| 7 | One shared why-line composer; `gate-render.cjs` opens no database | VERIFIED | `test-365-floor-notice.cjs`; gate.cjs line ~389 calls `navigation.composeFloorNotice` once |
| 8 | Floor audit event per claim approve | VERIFIED | `_floorPromoteClaim` writes `approval_floor_checked` through `navigation.logMemoryEvent` with ids/enums/scalars; `test-365-floor-gate.cjs` |
| 9 | Never-do reader fail-shut, fresh each call, closed kind enum, `why` never matched | VERIFIED | `lib/core/room-constraints.cjs`; `test-365-never-do-core.cjs` M1-M11 exit 0 |
| 10 | Writes need an approval trail; production writers are gate resumeFn (MCP) and CLI door | VERIFIED | `lib/mcp/never-do-gate.cjs` wired from `tools/chain.cjs` and `tools/research.cjs`; writer, gate (75 checks) and cli (35 checks) tests exit 0 |
| 11 | chain_run halts at room-named steps right after the irreversible check, add-only, both loop paths | VERIFIED | git diff of `chain-executor.cjs`: `(1b)` block directly after `if (isIrreversibleStep(step)) return 'halt';`, only returns 'halt'; `roomDir` passed at both default-gate sites; `_haltReasonFor` keeps both `forced_material` literals; `test-365-never-do-chain.cjs` E/K legs ok, includes autonomous_safe step halting |
| 12 | Ambient runner halts before grant check, ledger write and any fetch; `halted_constraint` pending card | VERIFIED | `ambient.cjs` step 3b (lines ~425-462) precedes `coverFor` (466) and `grants.recordRun` (491); `test-365-never-do-ambient.cjs` PASS 18/0 (fetch spy and net guard 0) |
| 13 | Growth: pre-filled proposal on each halt; Reject and never do this as one follow-up gate; nothing lands unapproved | VERIFIED | `never-do-gate.cjs` `mintProposalGate` / `mintHaltedConstraintGate` used in research.cjs 593/604 and chain.cjs 674; gate tests N1-N13 |
| 14 | Pulled portrait: `/mos:status --checks` and `claim_read` in words, no scores | VERIFIED | `commands/status.md` documents `--checks`; `claim-verify.cjs` returns `standing_portrait`; `test-365-portrait.cjs` Q1-Q11 exit 0 |
| 15 | Two Zone 3 signals; weekly snapshot per ISO week; stall suppressed below 2 snapshots; N=4 in floor ledger | VERIFIED | `verification-signals.cjs`; wired in `proactive-intelligence.cjs` 297-298; `test-365-signals.cjs` exit 0; `check-floor-ledger --check` 52 rows 0 unresolved |
| 16 | B5: one shared STANDING_WORDS map; every enumerated renderer names standing from it | VERIFIED | `verification.cjs` STANDING_WORDS; `room-home.cjs`, `graph-export.cjs` consume it; `test-365-b5-renders.cjs` B0-B10 exit 0 including label-strings-only-in-verification.cjs and Brain projection byte-unchanged |
| 17 | Ladder fence armed; Phase 365.1 opened with the ask as its blocker | VERIFIED (narrowed, honest) | `data/verification-ladder.json` `ratified:false`; `test-365-ladder-fence.cjs` PASS=9 FAIL=0; `.planning/phases/365.1-edge-derived-rung-after-ladder-ratification/365.1-INPUT.md` BLOCKED; ROADMAP Phase 365.1 entry; ask drafted, not sent |
| 18 | Guardrails: Part 8 sweep, dash fence, gates, regression suites no redder | VERIFIED | Dash and TBD/FIXME/XXX/TODO/HACK scan of base..HEAD added lines in lib, scripts, tests, commands, skills, data: zero hits. `build-harness-manifest --check` OK, `check-floor-ledger` OK, `check-tool-honesty` OK (22 tools, 0 high-risk), `check-cirs-declaration` OK. Regression block recorded in 365-CLOSE-GATE.md (354 1/1, 355 4/4, 356 0/0, 358 6/6, 363 4/4) |

**Score:** 18/18 verified.

### Judgment on the two narrowed rows

**V365-02 (byte test, structural half): honest.** The narrowing is in the requirement text itself (D-03, D-24), written at plan time, not retrofitted at close. The INPUT acceptance wording is "differ in a filterable field", and `standing` is that field. It is computed from edges and records, never from caller input. The derived-rung half is not hidden: it is a live red test I reproduced (`RED-365-BYTE-DERIVED`, exit 1), listed as KNOWN with `healed_by_plan: 365.1`, and the aggregator fails if it turns green or changes signature. The ROADMAP goal makes the rung derivation explicitly conditional on ratification. Residual caveat, already disclosed (FOLLOW-ONS 13): the predicate proves a provenance edge to a node with `url` and `retrieved_at` exists, not that the source was read, and `model_only` still rests on caller-recorded `method: ask` records.

**V365-17 (ladder fence): honest.** The row asserts only the fence, the opened phase and the ask recorded as the blocker, all of which exist. It states "drafted, not yet sent" in its own Measured line, and 365-17 records the same in `365.1-INPUT.md`. Fence legs F1-F7 are real checks, though F3's regex matches export key names only (`deriv*rung`), so a derivation shipped under a different name would pass. That is a weakness in the fence, not in the claim.

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `lib/core/navigation/verification.cjs` (claimStanding, STANDING_WORDS, FLOOR_IDS, standingMeetsFloor) | VERIFIED | Substantive, wired into gate.cjs, claim-verify.cjs, room-home, graph-export, signals |
| `lib/core/navigation/verification-floor.cjs` | VERIFIED | Floor reader and composer, exercised by gate_render and meeting |
| `lib/core/navigation/verification-signals.cjs` | VERIFIED | Wired via proactive-intelligence.cjs |
| `lib/core/room-constraints.cjs` | VERIFIED | Used by chain-executor and ambient |
| `lib/mcp/never-do-gate.cjs` | VERIFIED | Used by chain.cjs and research.cjs |
| `data/verification-ladder.json` | VERIFIED | Draft 0-5, `ratified:false` |
| 23 `tests/test-365-*.cjs` plus `tests/run-all-365.sh` | VERIFIED | I ran each file individually: 22 exit 0, 1 exit 1 (the KNOWN `RED-365-BYTE-DERIVED`) |
| Research trail, both homes | VERIFIED | `cmp` identical; commit e6a589579 is an ancestor of HEAD |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
|----------|------|--------|-----------|--------|
| gate card notice | standing and floor | room.db edges via `claimStanding`, ROOM.md head-read | Yes (tests read landed status through a fresh db handle) | FLOWING |
| Zone 3 signals | distribution snapshots | `memory_event` rows in room.db | Yes | FLOWING |
| room home / graph panel rows | standing | `claimStanding` | Yes | FLOWING |

### Behavioral Spot-Checks (individual test files only; no aggregator run)

| Behavior | Result | Status |
|----------|--------|--------|
| 22 of 23 365 test files | exit 0 | PASS |
| `test-365-acceptance-byte-derived.cjs` | exit 1 with `RED-365-BYTE-DERIVED` as designed | PASS (KNOWN red) |
| harness-manifest, floor-ledger, tool-honesty, cirs checks | all OK | PASS |

### Requirements Coverage

All V365-01..18 appear in plan frontmatter (union across 365-01..17) and in REQUIREMENTS.md as `[x]` rows with Measured lines. No orphaned IDs. Coverage map: 01 (01,02,03,16), 02 (02,04), 03 (08,15,16), 04 (04,06,08), 05 (04), 06 (05,08), 07 (04,06,08), 08 (04,08), 09 (07), 10 (07,13,14), 11 (09), 12 (10,13,14), 13 (07,09,10,13,14), 14 (15), 15 (11), 16 (04,08,12,15), 17 (01,16,17), 18 (01,08,16). Every ID is claimed by at least one plan and has passing evidence.

### Anti-Patterns Found

None blocking. No debt markers, no dashes, no stubs in added lines.

### Warnings (not blockers)

1. **Side-door floor bypass (FOLLOW-ONS 1, undecided).** The floor sits in `gate.cjs`, not `confirmNode`, so selector-decisions, futures orchestrator, sensor-expert-skill, qualify-opportunity and goal-gate approvals can release a held claim with no floor check. The phase's "gate" floor holds; D-04's "no confirm anyway" promise does not reach those doors. Human approval is still required (Part 9).
2. **Never-do `section` kind misses a halt in a resumed tail** (FOLLOW-ONS 3): `_executeResumedEntry` does not forward `targetSection`. Command and path kinds still match.
3. **Process gap (FOLLOW-ONS 17):** the plain aggregator skips the regression block; three plans shipped regressions only caught by the opt-in block (repaired in 365-REPAIR-01 and 365-14). Closed at the gate; the default is not changed.
4. **Stale doc:** `docs/SUPERSESSION-CONTRACT.md` Ruling 3 still says eight transitions (FOLLOW-ONS 2).
5. **Close-gate doctor point `verify-release-clean-tree` fails** on a peer-owned uncommitted file; recorded in the base, so not caused by 365.

### Test run note

Per instruction I ran no full aggregator. PASSED=66 FAILED=0 KNOWN=6 and the regression block figures are taken from 365-CLOSE-GATE.md and 365-17-SUMMARY.md (the latter reports the same figures at a later HEAD); I did not re-measure them. The orchestrator's concurrent run is the independent confirmation.

### Gaps Summary

No gaps. The phase delivers B2, B3, B5 and the fence in code, the tests exercise real behavior (fresh db handles, second process, fetch spies), and the deferred ladder-blocked work is covered by Phase 365.1 by name. Status is human_needed only because of the five human items in the frontmatter.

---

_Verified: 2026-10-01_
_Verifier: Claude (gsd-verifier)_
