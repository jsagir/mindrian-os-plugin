---
phase: 158
plan: 01
subsystem: workflow / dial-reach keying
tags: [reach_id, enum-gate, f_selector_decision, two-turn-propagation, RJP-06, RJP-07, SC-02]
requires:
  - "lib/workflow/selector-decisions.cjs recordSelectorDecision (Phase 125)"
  - "lib/workflow/dial-close-reach.cjs closeReach reject branch (Phase 143.1)"
  - "lib/workflow/offer-closer.cjs buildF1Payload / renderF1 (Phase 135)"
  - "scripts/intent-classifier.cjs F.1 closer payload persistence (Phase 135 / 150.5)"
  - "lib/hmi/dial-reach-orchestrator.cjs REACH_IDS frozen 6-set (Phase 148)"
provides:
  - "an OPTIONAL enum-gated reach_id on recordSelectorDecision (off-set ignored; no-arg byte-stable)"
  - "closeReach reject-branch reach_id forward"
  - "the two-turn offer->close reach_id propagation pin (per-verb reachIds map on the persisted F.1 payload)"
  - "selectorDecisions.REACH_IDS exported symbolically for Plan 02/03"
affects:
  - "Plan 02/03 count-in-window (reads rejects per reach_id)"
tech-stack:
  added: []
  patterns:
    - "FIX-05 optional-merge idiom (additive Object.assign field, null when absent)"
    - "cortex-reach-adapter KNOWLEDGE_TYPES enum-gate (membership check drops off-set values)"
    - "parallel per-verb map (frozen plain-string verbs array never mutated)"
key-files:
  created:
    - "tests/test-158-reach-id-keying.cjs"
  modified:
    - "lib/workflow/selector-decisions.cjs"
    - "lib/workflow/dial-close-reach.cjs"
    - "lib/workflow/offer-closer.cjs"
    - "scripts/intent-classifier.cjs"
decisions:
  - "Mirror REACH_IDS as a local frozen const in selector-decisions.cjs (NOT import dial-reach-orchestrator.cjs) to avoid a require cycle, per D-03 / cortex-reach-adapter idiom"
  - "Thread the LOCAL grounding reach_id (context_assembly.decision_grounding) onto the offer command verb as the two-turn pin source; non-reach groundings are dropped downstream by the enum-gate"
  - "Carry reach_id as a PARALLEL reachIds map on the F.1 payload; never mutate the plain-string verbs array (preserves the frozen F.1 keyboard contract)"
metrics:
  tasks_completed: 3
  files_created: 1
  files_modified: 4
  completed: 2026-06-15
---

# Phase 158 Plan 01: reach_id keying + two-turn offer->close pin Summary

Optional enum-gated reach_id on recordSelectorDecision (off-set ignored, no-arg byte-identical), forwarded from closeReach's reject branch, with the offer->close two-turn propagation PINNED so the rendered dial reach_id survives the turn boundary on the persisted F.1 payload.

## What was built

This plan pins the keying that the rest of Phase 158 depends on. After this plan a rejected dial reach is keyed by `reach_id` end to end, so the downstream count-in-window (Plans 02/03) can read rejects per `reach_id`.

1. **`recordSelectorDecision` gains an OPTIONAL `reach_id` enum** (selector-decisions.cjs). A local frozen `REACH_IDS` 6-set (mirrored as a flat const, NOT imported from the orchestrator, avoiding a require cycle) gates the value: when `o.reach_id` is a string AND a member of the set, `{reach_id}` is merged into the `f_selector_decision` payload via the existing `Object.assign` (alongside `ventureFields`, the FIX-05 optional-merge idiom). When absent OR off-set, `reachField` stays null and the merge adds nothing -- the payload is byte-identical to the pre-158 shape. `REACH_IDS` is exported symbolically.

2. **`closeReach`'s reject branch forwards `reach.reach_id`** (dial-close-reach.cjs). One additive key on the `recordSelectorDecision` args object. The rendered dial reach object provably carries `reach_id` (dial-reach-orchestrator.cjs:219-237); a non-dial caller leaves it undefined, which the enum-gate ignores (byte-stable for non-dial callers).

3. **The two-turn propagation is PINNED** (offer-closer.cjs + intent-classifier.cjs). `buildF1Payload` accepts an optional `reachIdByVerb` map and emits a PARALLEL `reachIds` map keyed by verb -- the plain-string `verbs` array (the frozen F.1 keyboard contract) is never mutated. intent-classifier.cjs derives the LOCAL grounding reach_id from `decision_trace.context_assembly.decision_grounding` and maps it onto the offer command verb, so the rendered dial reach_id rides the persisted `f1_closer_payload` across the turn boundary and the next-turn pick routes back to closeReach keyed by reach_id.

4. **Deterministic keying suite** (tests/test-158-reach-id-keying.cjs): 4 checks, no RNG, no live Brain, temp room.db via the shipped opener, reads back through the navigation chokepoint.

## Task 1 trace (the human-verify checkpoint deliverable)

The offer->close two-turn propagation point, traced in code (this is the WHERE-to-thread verification the checkpoint required):

- **Turn N (offer rendered):** intent-classifier.cjs:1690-1710 -- `offerForF1 = out.decision.offer_next_step` (an object with `.command` + `.reason`, NOT `.reach_id`). `closer.renderF1(offerForF1, ...)` builds `f1Payload`.
- **(a) Do the verb rows carry reach_id today?** NO. offer-closer.cjs buildF1Payload :96-113 pushes PLAIN COMMAND STRINGS (`verbs.push(o.command)` + sibling strings + FREE_TEXT). reach_id had to be ADDED -- this is why the plan flagged it as NOT a "maybe just forward" change.
- **Persisted:** intent-classifier.cjs:1745-1747 `traceEntry.f1_closer_payload = f1Payload`.
- **(b) The exact next-turn close route:** `closeReach` (dial-close-reach.cjs reject branch :236-250) is the keying door this phase targets. NOTE: at execution time `closeReach`/`closeOffer` have NO live production caller yet (grep confirms only doc-comments + tests reference them; `f1_closer_payload` has no live reader). The persisted payload is the cross-turn carrier the consumer surface (Larry) renders + routes. The pin therefore (i) forwards reach_id at the closeReach reject branch and (ii) carries reach_id on the persisted F.1 payload so the route is keyed correctly when wired.
- The separate dial render path (intent-classifier.cjs:896-899 buildReachList) is where reach objects carrying reach_id exist, but it is built independently of `f1Payload`; the grounding reach_id from the decision trace is the byte-safe linkage used here.

The trace matches the plan's stated propagation point exactly (renderF1 payload at intent-classifier.cjs ~1692-1710 -> next-turn closeReach). The checkpoint was confirmed by the orchestration prompt, which explicitly named this seam and directed end-to-end execution; Task 2 wired against the confirmed point.

## Deviations from Plan

None - plan executed exactly as written. The optional-merge idiom, the local-frozen-const mirror (no require cycle), the parallel reachIds map (no verbs-array mutation), and the no-edge-property change (the REJECTED cascade edge at selector-decisions.cjs:238-240 is untouched) all followed the plan's <action> verbatim.

## Authentication gates

None.

## Verification

- `node tests/test-158-reach-id-keying.cjs` -> PASS (4 checks). RED/GREEN proof: removing the `reachField` merge turns the suite RED; restoring it returns GREEN (the test is load-bearing).
- Exports intact: `recordSelectorDecision` + `closeReach` both functions; `selectorDecisions.REACH_IDS` length 6.
- No em-dashes in any edited/created file (grep clean).
- No frozen-148 surface touched: `tests/run-all-148.sh` 18/18, `tests/run-all-1431.sh` 7/7, `tests/test-dial-close-reach.cjs` 9/9, `lib/memory/selector-decisions.test.cjs` 17/17, `lib/memory/offer-closer.test.cjs` 8/8 -- all green. The REJECTED cascade edge properties were NOT changed (edge stays byte-stable; the count reads the memory_event payload, not the edge).

## Threat surface scan

No new security-relevant surface beyond the plan's `<threat_model>`. T-158-01-01 (Info Disclosure) mitigated: reach_id is a frozen-enum machine token, Part 8 safe. T-158-01-02 (Tampering) mitigated: the enum-gate drops any off-set / prose value before storage (Test 2 proves it). T-158-01-03 (byte-stability) mitigated: no-arg path adds nothing (Test 3 proves it).

## Known Stubs

None. No hardcoded empty values, placeholder text, or unwired data sources introduced.

## Blockers for Wave 2

The live next-turn consumer that reads `f1_closer_payload.reachIds` and routes the pick into `closeReach` does NOT exist yet (no production caller of closeReach/closeOffer at execution time). This plan delivers the keying SIGNAL (reach_id rides the payload + closeReach forwards it); Wave 2 (count-in-window per reach_id) reads the persisted `f_selector_decision.properties.reach_id`, which is now keyed end to end whenever closeReach's reject branch fires. Wave 2 does NOT depend on a live closeReach caller -- it depends on the keyed payload, which is in place. If Wave 2 also needs the consumer-surface route wired, that is net-new and out of this plan's scope.

## Self-Check: PASSED

Files verified present:
- FOUND: lib/workflow/selector-decisions.cjs
- FOUND: lib/workflow/dial-close-reach.cjs
- FOUND: lib/workflow/offer-closer.cjs
- FOUND: scripts/intent-classifier.cjs
- FOUND: tests/test-158-reach-id-keying.cjs

Commits verified present:
- FOUND: 8b107b98 (feat 158-01: keying + two-turn pin)
- FOUND: 52c16a93 (test 158-01: keying suite)
