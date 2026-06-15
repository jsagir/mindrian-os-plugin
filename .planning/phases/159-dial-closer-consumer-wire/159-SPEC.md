# Phase 159: dial-closer-consumer-wire -- Specification

**Created:** 2026-06-15
**Ambiguity score:** 0.14 (gate: <= 0.20)
**Requirements:** 10 locked
**Milestone:** v1.13.1 (LOCAL-only; no Brain dependency; UNBLOCKS Phase 158 in production; sequence BEFORE Phase 157)
**canon_parts:** Part 4 (every dial choice becomes graph data -- the loop this closes), Part 8 (the pick read path stays enum/scalar; user pick text never crosses to Brain), Part 9 (consumer reads/writes via the navigation.cjs chokepoint only)

## Goal

Wire the turn-N+1 consumer that reads the prior turn's persisted F.1 closer payload, matches the navigator's pick, and routes it into `closeReach`/`closeOffer` -> `recordSelectorDecision` with `reach_id` forwarded -- so the dial decision loop (accept / defer / reject) records to `room.db` in production. Today the producer half is wired (`renderF1` persists `decision_trace.f1_closer_payload` with per-verb `reachIds`, `scripts/intent-classifier.cjs:1835,1890`) but NOTHING reads it back next turn, so no `f_selector_decision` row is ever written from the dial in a real room. Closing this input segment makes Canon Decision 13 ("rejection is data") true at the dial AND makes Phase 158's `computeReachPenalties` read a real signal (today it structurally always reads 0 -> `countPenalty=0` -> suppression never fires).

## Background

Two independent read-only traces (2026-06-15) converged on the same finding: the 158 penalty circuit has three segments -- render+persist reach_id (WIRED, turn N), read+fold+suppress (WIRED, live engine arm, `intent-classifier.cjs:1547,1582`), and **pick->record (BROKEN, turn N+1)**. The only writers of an `f_selector_decision` row keyed by `reach_id` are `closeReach` (`lib/workflow/dial-close-reach.cjs:222`, already forwards `reach_id` at :251) and `closeOffer` (`lib/workflow/offer-closer.cjs:286`, currently omits `reach_id` from `decisionArgs` at :329-336). Neither has a production caller: the only reference is prose in `commands/ignite.md:102`. The persisted `f1_closer_payload` (`intent-classifier.cjs:1890`) is dead bytes -- written, never read. This phase wires the consumer.

## Requirements

1. **DCW-01 -- Turn-N+1 consumer exists and routes the pick.** A consumer reads the prior turn's `decision_trace.f1_closer_payload` (verbs + per-verb `reachIds`), matches the navigator's pick to a verb, and invokes the canonical closer for that outcome.
   - Current: `f1_closer_payload` is persisted (`intent-classifier.cjs:1890`) but never read back; no production code calls `closeReach`/`closeOffer`.
   - Target: on a turn that follows a rendered F.1 dial offer, the navigator's pick is routed into the closer, which writes the decision via `recordSelectorDecision`.
   - Acceptance: a 2-turn driver (turn N persists the payload, turn N+1 feeds a pick) results in exactly one `f_selector_decision` row in `room.db` for the picked verb; with no prior payload, zero rows are written and no error is raised.

2. **DCW-02 -- reach_id is forwarded on the write.** When the offer was reach-grounded, the decision row carries the frozen `reach_id`.
   - Current: `closeReach` forwards `reach_id` (:251) but has no caller; `closeOffer` does not include `reach_id` in `decisionArgs` (:329-336).
   - Target: the consumer forwards the payload's `reachIds[verb]` into the write; `closeOffer` is extended to carry `reach_id` into `decisionArgs` (enum-gated by the Phase 158-01 `recordSelectorDecision` REACH_IDS gate -- off-set values ignored).
   - Acceptance: a reach-grounded pick produces an `f_selector_decision` row whose `properties.reach_id` equals the frozen reach_id that grounded the offer; a non-reach-grounded pick produces a row with NO `reach_id` (unchanged byte-shape from a no-reach write).

3. **DCW-03 -- Full loop: accept, defer, reject, and Free-Text miss are all recorded.** Not reject-only.
   - Current: none of the four dial outcomes record in production.
   - Target: accept -> typed decision edge (SELECTED_REACH/accept), defer -> DEFERRED (+expiry), reject -> REJECTED, Free-Text -> a `recordSelectorMiss` memory_event. All via the existing closer outcomes (no new edge types).
   - Acceptance: a driver exercising each of the four picks writes the correct outcome row/event for each; the reject path is the one Phase 158 consumes.

4. **DCW-04 -- Graceful no-op on non-dial / unmatched / cold turns.** The consumer never crashes and never writes a spurious row.
   - Current: n/a (no consumer).
   - Target: when the prior turn persisted no `f1_closer_payload`, or the pick matches no verb, or `room.db` is absent, the consumer returns a no-op result and writes nothing; every non-dial turn is byte-unchanged from today.
   - Acceptance: turns with no prior payload, an unmatched pick, and a missing `room.db` each write zero `f_selector_decision` rows and raise no error; a regression run of the existing intent-classifier path stays green.

5. **DCW-05 -- Part 8: the pick text never egresses.** The consumer reads enum/scalar + reach_id only.
   - Current: the FIX-05 LOCAL sentence lane (`intent-classifier.cjs:1851`) already keeps the conversation seed off any Brain packet.
   - Target: the consumer path reads the matched verb (enum), the outcome (enum), and `reach_id` (enum); the navigator's raw pick text / sentence stays in the LOCAL routing lane and is classified to a scalar boolean + source enum at the write seam, never entering any packet or edge body.
   - Acceptance: a Part 8 source + behavioral sweep over the new consumer code finds zero reads that forward pick text toward `buildBrainPacket`; a seeded secret in the pick never appears in any written row value (mirrors the Phase 158 SECRETREASON123 tripwire idiom).

6. **DCW-06 -- Part 9: reads/writes via the navigation.cjs chokepoint only.**
   - Current: Canon Part 9 mandates SQL-as-local-mind through `lib/core/navigation.cjs`.
   - Target: the consumer reaches `room.db` only through `navigation.cjs` (and the existing closer modules, which themselves route through it); no direct `better-sqlite3` / `node:sqlite` open, no `fs` read of room data in the consumer path.
   - Acceptance: a Part 9 source sweep over the new consumer code shows reads/writes only through `navigation.cjs` / the closer modules; no direct DB/fs handle.

7. **DCW-07 -- CLI live + tested; Desktop/Cowork seam defined, capture deferred.** Tri-Polar with explicit deferral.
   - Current: the dial loop is fully dark on all three surfaces.
   - Target: the CLI AskUserQuestion F.1 pick-capture path is fully wired and tested; the consumer is shared core, with a documented capture-adapter seam (how a surface hands the matched pick + prior payload to the consumer) so Desktop/Cowork can attach later; their LIVE conversational capture is explicitly OUT of this phase.
   - Acceptance: the CLI path is exercised by the integration test; a documented seam (function signature + contract) for Desktop/Cowork capture exists; the deferral is recorded in the phase deferred-items.

8. **DCW-08 -- Wire 2 precondition: grounding resolves to a frozen reach_id or degrades cleanly.** Keying is correct or absent, never wrong.
   - Current: `decision_trace.context_assembly.decision_grounding` (`intent-classifier.cjs:1825-1832`) maps a grounding onto the offer verb; non-reach groundings ('wicked'/'brain_verb'/'neighborhood'/null) are forwarded as-is.
   - Target: for dial-driven offers, when the grounding is a frozen REACH_IDS member it is keyed; when it is a non-reach grounding the write is unkeyed (no `reach_id`), never mis-keyed. The enum-gate at `recordSelectorDecision` is the final guard.
   - Acceptance: a reach-grounded fixture yields a keyed row; a non-reach-grounded fixture yields an unkeyed row; no fixture yields a `reach_id` that is not a frozen REACH_IDS member.

9. **DCW-09 -- Scripted 2-turn integration test proves 158 fires live.** The headline acceptance gate.
   - Current: Phase 158 is green only via seeded reach_id-keyed rows; no test drives the producer->consumer->penalty loop end to end.
   - Target: a deterministic 2-turn (repeated) integration test drives turn N (render + persist `f1_closer_payload` with a reach_id) then turn N+1 (feed a reject pick) against a real `room.db`, asserts the keyed `f_selector_decision` reject row lands, repeats to N=3 rejects of one reach, and asserts that reach is ABSENT from `buildReachList`'s rendered output -- proving suppression fires from REAL recorded rejections, not injected ones.
   - Acceptance: the integration test is part of a one-command phase gate (`tests/run-all-159.sh`) that exits 0; it fails RED if the consumer is removed.

10. **DCW-10 -- Frozen contracts + 158 stay green.** No regression to the spine.
    - Current: frozen-148 (REACH_IDS=6, DIAL_REACH_K=6, MAX_K=3, 0.70/0.15 gate, 3 postures) and `tests/run-all-158.sh` (14/14) are green.
    - Target: this phase adds only the consumer + the `closeOffer` reach_id forward + tests; it does NOT change any frozen constant, the `0.40/0.30/0.30` weights, or any closer outcome semantics.
    - Acceptance: `tests/run-all-158.sh` and `tests/run-all-148.sh` stay green inside `tests/run-all-159.sh`; no frozen constant is edited.

## Boundaries

**In scope:**
- A turn-N+1 consumer (shared core) that reads `f1_closer_payload`, matches the pick, and routes accept/defer/reject/Free-Text into the existing closers
- Forwarding `reach_id` on the write (incl. adding `reach_id` to `closeOffer`'s `decisionArgs`)
- The full dial decision loop (all four outcomes), CLI live + tested
- A documented capture-adapter seam for Desktop/Cowork (contract only)
- The Wire 2 grounding-resolves-to-frozen-reach_id precondition (keyed-or-unkeyed, never mis-keyed)
- A scripted 2-turn integration test + `tests/run-all-159.sh` one-command gate proving 158 suppresses live
- Part 8 (pick text never egresses) + Part 9 (chokepoint-only) discipline for the new path

**Out of scope:**
- LIVE Desktop/Cowork conversational pick-capture (seam defined; capture deferred to a follow-up)
- Any change to the closer outcome semantics, the typed-edge vocabulary, or new edge types
- Any change to frozen-148 constants, the `0.40/0.30/0.30` weights, or Phase 158's penalty math
- The dormant `_applyDecayWeight` command-rail (SC-04 / BLOCKER 2) -- a separate latent follow-up, untouched here
- Phase 157 (the Brain orchestration projection) -- independent; runs after this
- Any Brain read/write

## Constraints

- Reuse the SHIPPED closers (`closeReach` / `closeOffer` / `recordSelectorDecision` / `recordSelectorMiss`); the consumer is thin glue, not a reimplementation (Canon Part 7).
- Canon Part 8: only enum/scalar + reach_id reach any row or packet; the navigator's pick text stays in the LOCAL routing lane (FIX-05 idiom) and never egresses.
- Canon Part 9: the consumer reaches `room.db` only through `navigation.cjs` / the closer modules.
- Tri-Polar: the consumer is shared core; surface-specific capture adapters feed it (CLI now; Desktop/Cowork seam only).
- HARD RULE: no em-dashes (hyphens only). CJS.
- Wire 3 validation (not a build req): confirm the Phase 144 engine flip (`lib/core/navigation-engine.cjs decide()`) reliably fires in real rooms, since `reach_presented` (and thus the M-floor + parole fences) only emit on the active engine arm. If engine activation proves rare in practice, record it as a finding -- it does not block this phase's wire, but it bounds how often the live loop runs.

## Acceptance Criteria

- [ ] A 2-turn driver writes exactly one `f_selector_decision` row for the picked verb; no prior payload writes zero rows and raises no error (DCW-01, DCW-04)
- [ ] A reach-grounded pick writes a row with `properties.reach_id` = the frozen grounding reach_id; a non-reach pick writes an unkeyed row (DCW-02, DCW-08)
- [ ] Each of accept / defer / reject / Free-Text writes its correct outcome row/event (DCW-03)
- [ ] A Part 8 sweep finds zero pick-text egress paths; a seeded secret in the pick never lands in any row value (DCW-05)
- [ ] A Part 9 sweep shows the consumer reads/writes only via `navigation.cjs` / the closers; no direct DB/fs (DCW-06)
- [ ] The CLI F.1 pick path is wired + tested; a documented Desktop/Cowork capture-adapter seam exists; deferral recorded (DCW-07)
- [ ] The integration test drives producer->consumer->penalty and asserts 3 REAL rejects of one reach -> that reach ABSENT from `buildReachList`; it goes RED if the consumer is removed (DCW-09)
- [ ] `tests/run-all-159.sh` exits 0 and includes `run-all-158.sh` + `run-all-148.sh` passthroughs; no frozen constant edited (DCW-10)

## Ambiguity Report

| Dimension          | Score | Min   | Status | Notes                                                                 |
|--------------------|-------|-------|--------|-----------------------------------------------------------------------|
| Goal Clarity       | 0.90  | 0.75  | OK     | Wire the turn-N+1 consumer; "3 real rejects -> suppressed live" is measurable |
| Boundary Clarity   | 0.85  | 0.70  | OK     | Full loop locked; CLI-now / Desktop-Cowork seam-deferred; dormant rail + 157 fenced |
| Constraint Clarity | 0.80  | 0.65  | OK     | Part 8 pick-text-LOCAL, Part 9 chokepoint, Tri-Polar shared-core, reuse closers |
| Acceptance Criteria| 0.85  | 0.70  | OK     | Scripted 2-turn integration test + one-command gate, RED-on-removal     |
| **Ambiguity**      | 0.14  | <=0.20| OK     | Gate passed; all minimums met                                          |

## Interview Log

| Round | Perspective    | Question summary                                          | Decision locked                                                        |
|-------|----------------|-----------------------------------------------------------|------------------------------------------------------------------------|
| 0     | Scout (2 traces)| What is the exact gap; where does the consumer attach?    | Producer wired (renderF1 persists payload); consumer (turn N+1) absent; attach by the producer at intent-classifier.cjs:1806-1842 |
| 1     | Boundary Keeper | Reject-only or the full dial decision loop?               | FULL loop (accept/defer/reject + Free-Text miss) -- closeReach is already a 4-outcome transaction; whole loop is dark, not just reject |
| 1     | Simplifier/Tri-Polar | Which surfaces must work this phase?                | CLI live + tested NOW; Desktop/Cowork capture-adapter SEAM defined, live capture deferred |
| 1     | Failure Analyst | How do we prove it works live, not just seeded?          | Scripted 2-turn integration test: turn N persist -> turn N+1 feed pick -> assert keyed row + 3 rejects -> reach absent from buildReachList |

---

*Phase: 159-dial-closer-consumer-wire*
*Spec created: 2026-06-15*
*Next step: /gsd:discuss-phase 159 -- lock the HOW (canonical closer choice, the CLI pick-match mechanism, the capture-adapter seam signature), then /gsd:plan-phase 159*
