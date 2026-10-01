---
phase: 365-verification-rung-earned-not-asserted-b2-gate-floor-b3-unatt
plan: 08
subsystem: human-gate-floor
tags: [b2, gate, floor, meeting, tri-polar, theo-parity]
requires: [365-04, 365-05, 365-06]
provides:
  - approval floor enforced in gate.cjs _promoteCardSubject for claim subjects (below floor -> needs_evidence, at or above -> confirmed, held claim released through unchanged confirmNode)
  - one approval_floor_checked memory_event per claim approve
  - why-line (notice) and relabelled approve composed by ONE composer for gate_render and the meeting file-meeting card
  - floor_prediction on the ledger entry and floor_changed_since_render on the gate_answer reasoning_node
  - honest meeting tool description, approve option description and file-meeting response text
affects: [365-15, 365-16, 365.1]
requirements: [V365-03, V365-04, V365-06, V365-07, V365-08, V365-16, V365-18]
key-files:
  created:
    - tests/test-365-floor-gate.cjs
  modified:
    - lib/mcp/tools/gate.cjs
    - lib/mcp/tool-router.cjs
    - tests/fixtures/267/wire-snapshot-zod3.json
    - tests/test-354-gate-subject-promotion.cjs
    - tests/test-354-concurrency-surfaces.cjs
    - tests/test-355-gate-opportunity-promotion.cjs
    - tests/test-365-baseline.cjs
    - tests/fixtures/365-baseline-red.json
decisions:
  - "The floor check lives in _floorPromoteClaim (called from _promoteCardSubject), never in confirmNode; confirm-node.cjs is not in this plan's diff"
  - "A thrown floor read degrades to NOT confirming (subject_skip_reason floor_check_failed)"
  - "The audit event is not gated by MINDRIAN_DISABLE_MEMORY_EVENT (it is a trust trace, not telemetry)"
  - "floor_changed_since_render is set only on the claim floor path, true when the ledger prediction differs from the landed status"
metrics:
  tasks: 4
  files: 9
  commits: 4
---

# Phase 365 Plan 08: The Approval Floor Is Live at the Human Gate Summary

A model-checked claim can no longer ride a human approve to confirmed: below the room's verification floor an approve files the claim as needs_evidence, at or above it the unchanged confirmNode confirms it, and every claim card (all three renderer rungs and the meeting card) says which before the click.

PLAN_BASE = `95851a302144b00cdff237672a383cec20572d6f`.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | `470b0b84b` | feat(365-08): approval floor enforced for claim subjects at gate_answer |
| 2 | `dba7378aa` | feat(365-08): gate_render composes the why-line; TOCTOU flag; subject_node_id wording |
| 3 | `e456c73d0` | feat(365-08): meeting cards use the one why-line composer; honest meeting contract text |
| 4 | `e8ad2b0c5` | test(365-08): suites updated for the default floor with reasons; one-week status and floor reds healed |

Each used `git add <exact paths>` then `git commit --only -- <exact paths>`; all four pass `git merge-base --is-ancestor <sha> HEAD`. STATE.md and ROADMAP.md untouched; no `state.*` writer, `roadmap.update-plan-progress` or `query commit` ran. The peer's uncommitted 353-FLEET-REPORT.json and Phase 366 hunks were left alone. `lib/core/navigation/confirm-node.cjs` is not in this plan's diff (digest pin in test-365-baseline green).

## What changed

- gate.cjs `_promoteCardSubject`: a claim in proposed or needs_evidence goes to the new `_floorPromoteClaim`. It reads `readVerificationFloor` and `claimStanding` (the claim's own outbound provenance edges only, so card `evidence_node_ids` never count, T-365-01), then: met -> `navigation.confirmNode`; not met and proposed -> `navigation.holdForEvidence`; not met and already needs_evidence -> no write but the event. Then one `approval_floor_checked` memory_event (target_node_id, floor_id, floor_source, standing, floor_met, from_status, landed_status, declared_max_rung, created_by) with landed_status read back from the row. Opportunity subjects and every non-claim return are byte-identical (G6). The `reasoning_node` gains `subject_held`, `landed_status`, `floor_id`, `floor_source`, `standing`, `floor_changed_since_render` on the claim path only.
- gate.cjs `gate_render` handler: for kind general (or absent) with a subject, opens the room db through `navigation.openRoomDbForCaller`, calls `navigation.composeFloorNotice`, closes in finally, sets `card.notice` and `card.approve_label`, and mints the ledger entry with `floor_prediction` (fourth argument of `_mintLiveGate`, merged before the three fixed fields so it cannot override card, sessionId or kind). Any error skips the notice silently.
- tool-router.cjs meeting `file-meeting`: same composer before `renderGate`, notice and relabel on the card, `floor_prediction` on the mint entry. The approve option description, the response line and the tool description now say the floor decides confirmed versus needs evidence.
- tests/test-365-floor-gate.cjs (59 checks): G1..G9, H1, H2, H3, H4, H5, H6a/H6b, H7, H8.

## Theo schema-parity

This plan changed exactly ONE input-schema field description on a Theo-mirrored tool: `gate_render.subject_node_id`. No field added, no requiredness changed, no top-level description changed, nothing changed on gate_answer, chain_run, graph_write or room_bind. The why-line rides in card DATA (`notice`), never in an input schema. 365-16 carries it to the Theo follow-ons as a sync item after the tagged release (T-365-15).

Old string:

> Opaque LOCAL room-graph node id, the card's subject. On an approve verdict for a kind 'general' card whose subject is a proposed claim node, gate_answer promotes that claim to confirmed through navigation.confirmNode; evidence nodes are never promoted. Canon Part 8: must never be a Brain identifier or room content.

New string:

> Opaque LOCAL room-graph node id, the card's subject. On an approve verdict for a kind 'general' card whose subject is a proposed claim node, gate_answer confirms that claim through navigation.confirmNode when the room's verification floor is met, and otherwise files it as needs_evidence; the card says which before the click. Evidence nodes are never promoted. Canon Part 8: must never be a Brain identifier or room content.

The `meeting` tool is not Theo-mirrored; its description was extended (the existing sentences kept, the end of "since only a human approval promotes a claim to confirmed" extended with ", and only when the room's verification floor is met; below it an approval files the claim as needs evidence and the card says why first"). `git diff 95851a302 -- tests/fixtures/267/wire-snapshot-zod3.json` changes exactly those two strings (4 changed lines, 2 removed and 2 added), each copied from a live tools/list capture. Observation: `tests/fixtures/267/wire-snapshot-zod4.json` still carries the old strings; no test reads descriptions from it (brain-shim reads its brain section, registration-api reads only a tool count), so I left it.

## Per-assertion test changes (each with its reason; no fixture sets verification_floor)

| File | Assertion | Kind | Reason |
|------|-----------|------|--------|
| tests/test-354-gate-subject-promotion.cjs | Case A: exact claim id reads confirmed after approve; subject_confirmed true | (a) promotion test | The case is about the promotion door itself, so the claim is seeded with a source edge (`seedSourceEdge`, url + retrieved_at) that meets the default floor. The card is minted before the edge exists, so this case also exercises floor_changed_since_render. |
| tests/test-354-gate-subject-promotion.cjs | Case D: subject claim (second) reads confirmed; evidence claim (first) stays proposed | (a) promotion test | The SUBJECT gets its own source edge; the card's `evidence_node_ids` (first claim) stay a deliberate decoy because card evidence never satisfies the floor. |
| tests/test-354-concurrency-surfaces.cjs | K3: correct session approving its own fresh gate confirms the exact claim | (a) promotion test | This check is about session-keyed ratification, not the floor; the claim is seeded with a source edge first. |
| tests/test-355-gate-opportunity-promotion.cjs (not in the plan's files list; its own verify command named it) | Case E: plain claim reads confirmed after approve, no gate-outcome event | (a) | Same reason: seed a source edge so the claim meets the default floor; the no-outcome-event assertion is the point of the case. |
| tests/test-276-meeting-gate-wiring.cjs | none | no change | Its confirmed assertions count the decision node (count >= 1), not the claim; it stays green (14 passed). |
| tests/test-i2x-t2-node-write-back.cjs | none | no change | Its confirmed assertions are on the decision node; it stays green. |

Every changed spot carries a `// Phase 365 (D-01, D-03)` comment. No assertion was deleted.

## Deviations from Plan

**1. [Rule 3 - Blocking] test-355-gate-opportunity-promotion.cjs went red** (Case E pinned approve-to-confirmed on a bare claim). The plan did not list it but its Task 1 verify command requires it green. Updated as category (a) in the Task 1 commit.

**2. [Rule 3 - Blocking] tests/test-365-baseline.cjs leg 5 failed** after dropping RED-365-ONEWEEK-STATUS from the one-week leg (it still carries RED-365-ONEWEEK-STANDING): the converse loop flagged the dropped signature as `unlisted`. The converse only worked when a whole leg left the list (the 365-04 case). Removed the converse loop (a comment says why) and renamed the check label; an unlisted red is still caught by run-all-365 (unlisted red -> FAILED). Committed with Task 4 (outside the plan's files list; same precedent as 365-04 deviation 1).

**3. [Scope note] test-276-meeting-gate-wiring and test-i2x-t2-node-write-back did not go red** as the plan predicted, so they were not edited.

**4. [Scope note] Extra option-description edit.** The meeting card's approve option description read "Confirm this claim through gate_answer." which became false below the floor; reworded (no test pinned it).

No auth gates. No checkpoints (the navigator ruling was supplied by the orchestrator: "proceed (Recommended)" for 365-05 D-20).

## Test results (HEAD `e8ad2b0c5460e1553c865a50d3d6a4d4317b0a72`)

| Run | Result |
|-----|--------|
| `bash tests/run-all-365.sh` | exit 0, `PASSED=57 FAILED=0 SKIPPED=1 KNOWN=7` (was 55/0/1/8 at 95851a302; KNOWN now: BYTE-DERIVED, ONEWEEK-STANDING plus the five recorded neighbor reds) |
| `node tests/test-365-floor-gate.cjs` | 59 PASS, 0 FAIL |
| `node tests/test-365-acceptance-floor.cjs` | exit 0 (RED-365-FLOOR and RED-365-FLOOR-NOTICE healed) |
| `node tests/test-365-acceptance-one-week.cjs` | prints only RED-365-ONEWEEK-STANDING |
| test-365-baseline, test-365-floor-notice, test-355-gate-opportunity-promotion, test-354-gate-subject-promotion, test-354-concurrency-surfaces, test-276-meeting-gate-wiring, test-i2x-t2-node-write-back | all exit 0 |
| test-270-tool-schema-budget, test-234-tool-description-floor, test-265-mcp-description-hygiene, test-276-theo-description-parity, `check-tool-honesty --check`, test-198-gate-renderers, test-265-gate-render-elicit-schema | all exit 0 |
| test-267-mcpv2-zod4-contract | check (a) PASS; output (checks b and d lines) identical to the pre-edit capture (b: extras `tool:research_run:membership`; d: `scripts/fork359-permission-probe.cjs`) |

### Pre-existing gate-path reds, compared before and after (no stash; before-captures taken at PLAN_BASE code, same failing lines after)

| Test | Failing line before | After |
|------|---------------------|-------|
| test-238-chosen-validation | `expected memory_event count to increase by exactly 1 (before=0, after=2)` | identical |
| test-237-approve-executes | `7: MUTATION -- could not build the mutated copy (dispatcher-call needle not found ...` | identical |
| test-345-gate-ratify | `FAIL: test-345-gate-ratify` | identical |

### Aggregator comparison (`RUN_365_REGRESSIONS=1 bash tests/run-all-365.sh`, run on HEAD `e456c73d0` with the Task 4 edits already on disk, so the tree equals `e8ad2b0c5`)

run-all-354 PASSED (same single base failing leg). run-all-355, 356, 358, 363 are REDDER THAN BASE. NONE is caused by 365-08; each traces to an earlier plan's committed files that this plan did not touch (`git diff 95851a302 HEAD --stat` shows only my five paths plus the Task 4 test files):

- 356 "Larry post-gate contract (D-12)" (check: lib/core/chain-executor.cjs carries 'forced_material' at least twice) and 356 "existing 264 frozen pins" (makeGateFn sha256 vs the base pin), and the nested run-all-355 leg "no-regression: run-all-356.sh": caused by 365-09 (`8c0004f3f` feat(365-09): chain gate halts at room-named steps) editing `lib/core/chain-executor.cjs`.
- 363 "harness-manifest generator --check": `data/harness-manifest.json` is stale against the on-disk `lib/core/chain-executor.cjs` digest, same 365-09 cause (recovery: `node scripts/build-harness-manifest.cjs`).
- 358 "one supersession door": `tests/test-348-one-supersession-door.cjs` finds `lib/core/navigation/verification-signals.cjs` outside the single door, from 365-11.

These need an owner (365-09 and 365-11 or the orchestrator); I did not fix them (out of scope, not caused by this plan).

## Known Stubs

None.

## Threat Flags

None new. T-365-01 (card evidence never satisfies the floor) mitigated and tested (G7); T-365-03 (floor id and source recorded on every claim approve) mitigated (G2, G4); T-365-09 unchanged ledger; T-365-15 recorded above; T-365-11 mitigated by `--only` commits and ancestor checks.

## Hand-offs

- **365-16:** carry the `gate_render.subject_node_id` describe-string change (Theo schema-parity section above) to the Theo follow-ons as a post-release sync item; the zod4 snapshot's stale strings are a non-load-bearing observation.
- **Open from 365-05 (still undecided, not in this plan's scope):** the non-gate human approve paths (selector-decisions, futures orchestrator, sensor-expert-skill, qualify-opportunity / goal-gate on a held anchor) can still release a held claim through `confirmNode` with no floor check. Either route them through `composeFloorNotice` or accept the bypass in writing.
- **365-15:** RED-365-ONEWEEK-STANDING is the only one-week signature left; `navigation.STANDING_WORDS.model_only.label` is available for the claim_read render.
- Regression owners: see the aggregator comparison above (365-09 chain-executor pin and manifest digest; 365-11 supersession door).

## Self-Check: PASSED

- FOUND: tests/test-365-floor-gate.cjs; the edits in lib/mcp/tools/gate.cjs and lib/mcp/tool-router.cjs; commits 470b0b84b, dba7378aa, e456c73d0, e8ad2b0c5 are ancestors of HEAD
- `grep -nP '[\x{2013}\x{2014}]'` over every file this plan touched: no hits
