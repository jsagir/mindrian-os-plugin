---
phase: 159-dial-closer-consumer-wire
plan: 01
subsystem: dial-decision-loop
tags: [dial, f-selector, reach-id, consumer, part4, part8, part9, tri-polar]
requires:
  - "lib/workflow/offer-closer.cjs::closeOffer (Phase 135-03)"
  - "lib/workflow/selector-decisions.cjs::recordSelectorDecision REACH_IDS enum-gate (Phase 158-01)"
  - "lib/core/navigation.cjs chokepoint (Phase 109)"
  - "decision_trace.f1_closer_payload producer (scripts/intent-classifier.cjs:1890)"
provides:
  - "closeOffer optional reach_id forward into decisionArgs (DCW-02/DCW-08)"
  - "lib/workflow/f1-pick-consumer.cjs::consumeF1Pick (the turn-N+1 shared-core consumer)"
  - "lib/hmi/f1-pick-capture-cli.cjs::captureCliPick (CLI capture adapter)"
  - "CAPTURE_ADAPTER_CONTRACT (Desktop/Cowork seam contract for Wave-3 doc)"
affects:
  - "Wave 2 (turn-start wiring in intent-classifier) consumes consumeF1Pick"
  - "Phase 158 computeReachPenalties finally reads a real recorded-reject signal"
tech-stack:
  added: []
  patterns:
    - "FIX-05 optional-sentence merge idiom cloned for the reach_id key"
    - "MEDIUM-2 two-channel split (outcome keyword as {pick} vs matched verb for reach lookup)"
    - "SECRETREASON tripwire (Phase 158 idiom) for the Part 8 LOCAL-lane proof"
    - "lazy-require + try/catch best-effort no-op degradation"
key-files:
  created:
    - "lib/workflow/f1-pick-consumer.cjs"
    - "lib/hmi/f1-pick-capture-cli.cjs"
    - "tests/test-159-closeoffer-reachid-forward.cjs"
    - "tests/test-159-consume-f1-pick.cjs"
    - "tests/test-159-cli-capture-adapter.cjs"
  modified:
    - "lib/workflow/offer-closer.cjs"
decisions:
  - "consumer lives in a NEW module lib/workflow/f1-pick-consumer.cjs (Claude's-discretion: keeps offer-closer focused; Part 9 chokepoint-only preserved)"
  - "the pick shape is {verb, outcome}; the CLI adapter produces it; the consumer passes the OUTCOME keyword as closeOffer({pick}) and the verb only for reachIds[verb] + offer.command (MEDIUM-2)"
metrics:
  duration: "~25m"
  completed: "2026-06-15"
  tasks: 3
  files: 6
---

# Phase 159 Plan 01: dial-closer-consumer-wire Wave 1 Summary

The reach_id forward gap is closed and the turn-N+1 dial-pick consumer exists: `closeOffer` now carries an optional frozen `reach_id` into `decisionArgs`, `consumeF1Pick` is the shared-core consumer that reads a prior `f1_closer_payload`, deterministically matches the navigator's pick to a verb, resolves the two independent channels (outcome + reach_id), and delegates all persistence to `closeOffer` over a caller-owned `roomState.db`; the CLI capture adapter turns an AskUserQuestion F.1 answer into the `{pick}` shape and keeps the navigator's pick text on the FIX-05 LOCAL lane.

## What shipped

| Task | What | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | closeOffer forwards optional reach_id into decisionArgs (enum-gated downstream) | `d794d866` | lib/workflow/offer-closer.cjs, tests/test-159-closeoffer-reachid-forward.cjs |
| 2 | consumeF1Pick turn-N+1 shared-core consumer (MEDIUM-2 two-channel split) | `7f2fc6b7` | lib/workflow/f1-pick-consumer.cjs, tests/test-159-consume-f1-pick.cjs |
| 3 | CLI F.1 pick-capture adapter + Part 8 LOCAL-lane proof + Desktop/Cowork seam contract | `571ba860` | lib/hmi/f1-pick-capture-cli.cjs, tests/test-159-cli-capture-adapter.cjs |

## The MEDIUM-2 load-bearing guard (do NOT regress)

`consumeF1Pick` resolves TWO independent channels from the pick:

- **OUTCOME channel** = the decision keyword `accept|defer|reject|Free-Text`, passed as `closeOffer({pick:<outcome-keyword>})`. The OUTCOME keyword is passed, NEVER the matched verb. `offer-closer.cjs::_normalizePick` falls through ANY non-keyword string to `'accept'`, so passing the verb as `{pick}` would silently coerce every reject to accept and break the whole phase.
- **REACH channel** = the matched verb, used ONLY to look up `payload.reachIds[verb]` (forwarded as `reach_id`) and to populate `offer.command`.

Test 1 of `test-159-consume-f1-pick.cjs` explicitly asserts the reject row has `properties.decision === 'reject'` (NOT coerced to `'accept'`) AND `properties.reach_id === 'deep_research'`. This is the single highest-leverage correctness assertion in Wave 1.

## Test results

| Suite | Result |
| ----- | ------ |
| tests/test-159-closeoffer-reachid-forward.cjs | PASS (4 checks) |
| tests/test-159-consume-f1-pick.cjs | PASS (6 checks) |
| tests/test-159-cli-capture-adapter.cjs | PASS (4 checks) |
| lib/memory/offer-closer.test.cjs (regression, additive change) | PASS (8/8) |
| tests/test-158-reach-id-keying.cjs (regression) | PASS (4 checks) |
| tests/run-all-158.sh (regression) | PASS (14/14) |
| tests/run-all-148.sh (frozen-148 regression) | PASS (18/18) |

## must_have truths satisfied

- closeOffer forwards a frozen reach_id into recordSelectorDecision; an off-set reach_id is dropped by the existing enum-gate (unkeyed row); no reach_id yields the byte-identical pre-159 write shape. (Task 1 Tests 1-3)
- consumeF1Pick reads a prior-turn f1_closer_payload, matches the pick to a verb deterministically, resolves {verb, outcome, reach_id}, and calls closeOffer over a caller-owned roomState.db. (Task 2 Test 1)
- consumeF1Pick is a graceful no-op (writes nothing, raises nothing) on cold / unmatched / absent-db turns. (Task 2 Tests 3-5)
- All four dial outcomes route correctly: accept / defer / reject -> recordSelectorDecision (node-less accept signals offer_acted, no edge); Free-Text -> recordSelectorMiss. (Task 2 Test 2)
- The CLI capture adapter turns an AskUserQuestion answer into the {pick} shape; the navigator's raw pick text never enters a stored row value or a Brain packet (Part 8 LOCAL lane). (Task 3 Tests 1-3)
- consumeF1Pick reaches room.db only through navigation.cjs / the closer modules; no direct better-sqlite3 / node:sqlite / fs read (Part 9). (Task 2 Test 6, comment-stripped source sweep)

## Deviations from Plan

None - plan executed exactly as written.

The two plan-check fixes were honored, not regressed:
- MEDIUM-2 (the two-channel split): implemented as the explicit `_resolvePick` -> `closeArgs.pick = outcome` (never the verb) seam; Test 1 asserts reject-stays-reject + keyed.
- DCW-08 (never mis-keyed): closeOffer adds NO membership check; the off-set reach_id is dropped by the downstream `recordSelectorDecision` REACH_IDS enum-gate (Task 1 Test 2).

Claude's-discretion decision (left to plan): the consumer core lives in a NEW module `lib/workflow/f1-pick-consumer.cjs` rather than as a function added to `offer-closer.cjs`, keeping the producer module focused while staying Part 9 chokepoint-only (the consumer never opens room.db; it delegates to closeOffer over the caller-owned handle).

## Frozen-contract / sibling integrity

- `lib/workflow/dial-close-reach.cjs` (closeReach) UNTOUCHED this phase (HOW-1 sibling-not-re-routed); last touched by 158-01. Task 1 Test 4 asserts its exports/arity are unchanged.
- No frozen-148 constant, the 0.40/0.30/0.30 weights, closer outcome semantics, or edge-type vocabulary touched. run-all-148 (18/18) + run-all-158 (14/14) green.
- Zero new dependencies (Phase 87 invariant). CJS, no em-dashes.

## What Wave 2 (turn-start wiring in intent-classifier) must know

**consumeF1Pick signature:**
```
consumeF1Pick({ priorPayload, pick, roomState }) -> { ok, recorded?, reason?, outcome?, reach_id? }
```
- `priorPayload`: the prior turn's `decision_trace.f1_closer_payload` ({ verbs:[...], reachIds?:{verb:reach_id}, sentence? }). Wave 2 reads this back from the persisted trace at turn START (before the new turn's dial render).
- `pick`: the surface-captured pick. Accepts `{verb, outcome}` (the CLI adapter shape) OR a bare string (a verb OR an outcome keyword).
- `roomState`: MUST carry a populated `roomState.db` (the consumer NEVER opens room.db; Wave 2 opens the handle via `navigation.openRoomDbForCaller` per Part 9). An optional `roomState.offer` scaffold ({ framework, confidence, reason }) completes the matched verb's offer so the decision edge `framework:<...>` target resolves; the matched verb always wins as `offer.command`.
- Returns a structured no-op `{ ok:false, reason }` on any cold (`no_prior_payload`), unmatched (`unmatched`), absent-db (`invalid_db` surfaced), or load-failure (`closer_unavailable` / `closer_threw`) turn. Wave 2 wraps the call best-effort (try/catch) so non-dial turns are byte-unchanged (DCW-04).
- On success returns `{ ok:true, recorded:true, outcome, reach_id? }`.

**CLI adapter contract:**
```
captureCliPick(answer, priorPayload) -> { pick: { verb, outcome }, sentence? }
```
- `answer`: `{ selectedOption: <verb label>, outcome?: <decision keyword>, text?: <raw navigator text> }`.
- Returns `pick.verb` = the deterministic enum matched against `priorPayload.verbs` (null when no match -> consumer no-ops), `pick.outcome` = the chosen decision keyword.
- The raw `answer.text` rides ONLY the optional `sentence` field (FIX-05 LOCAL lane). Wave 2 should forward `captured.sentence` onto the priorPayload it hands to `consumeF1Pick` (or rely on the persisted `payload.sentence`), which forwards it to `closeOffer({sentence})` for classification-to-scalar at the write seam. The raw text NEVER becomes a pick value, an edge body, or a Brain packet.
- The Desktop/Cowork seam is documented in `CAPTURE_ADAPTER_CONTRACT` (exported from `lib/hmi/f1-pick-capture-cli.cjs`); live capture for those surfaces is deferred (DCW-07).

**Wave 3 hand-off note:** the integration test (DCW-09) and `tests/run-all-159.sh` one-command gate are Wave 3; this wave's three suites are stand-alone and should be listed in that aggregator alongside the run-all-158 / run-all-148 passthroughs.

## Self-Check: PASSED

- Created files: all 5 FOUND on disk.
- Commits: d794d866, 7f2fc6b7, 571ba860 all FOUND in git log.
- dial-close-reach.cjs: untouched this phase (last commit 158-01).
- Part 9 source sweep (comments stripped): clean.
- No em-dashes in any new file.
