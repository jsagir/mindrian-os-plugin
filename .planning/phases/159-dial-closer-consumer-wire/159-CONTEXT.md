# Phase 159: dial-closer-consumer-wire -- Context

**Gathered:** 2026-06-15
**Status:** Ready for planning
**Note:** discuss-phase was SKIPPED (navigator-chosen, ambiguity already 0.14); the implementation "how" decisions below were made inline with documented rationale and are LOCKED inputs for the planner.

<domain>
## Phase Boundary

Close the input segment of the dial decision circuit: a turn-N+1 consumer reads the prior turn's persisted `decision_trace.f1_closer_payload`, matches the navigator's pick, and routes it into the existing F.1 closer with `reach_id` forwarded -- so accept/defer/reject/Free-Text record to `room.db` in production and Phase 158's penalty reads a real signal. CLI live + tested; Desktop/Cowork seam-defined-and-deferred. LOCAL-only; no Brain. Sequence BEFORE Phase 157.
</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

10 requirements (DCW-01..10) locked in `159-SPEC.md`. Downstream agents MUST read `159-SPEC.md` before planning. Not duplicated here.

**Navigator locks (spec interview):** FULL dial loop (accept/defer/reject + Free-Text miss), CLI live + tested with Desktop/Cowork capture-adapter SEAM only (live capture deferred), and a scripted 2-turn integration test proving 3 REAL rejects -> reach suppressed live (RED on consumer removal).
</spec_lock>

<decisions>
## Implementation Decisions (made inline; discuss skipped)

### HOW-1 (canonical closer) -- ride offer-closer.cjs closeOffer (co-locate consumer with producer)
The producer that runs in production is `offer-closer.cjs::renderF1` (`scripts/intent-classifier.cjs:1835`), and its persisted `f1_closer_payload` carries the per-verb `reachIds` map. The consumer therefore rides the SAME module: `offer-closer.cjs::closeOffer` is the canonical F.1 pick closer. EXTEND `closeOffer` to carry `reach_id` into `decisionArgs` (the omission at `offer-closer.cjs:329-336`), enum-gated downstream by the Phase 158-01 `recordSelectorDecision` REACH_IDS gate (off-set ignored). `dial-close-reach.cjs::closeReach` (the 143.1 ignite/B3 dial-commit transaction, already forwards `reach_id` at :251) is a SIBLING surface and is NOT re-routed in this phase -- keeping producer + consumer co-located in one module is the smaller, lower-risk wire (Part 7). If planning's seam trace shows the ignite path also needs the consumer, that is an additive note, not a re-scope.

### HOW-2 (CLI pick-match mechanism) -- deterministic verb-match over the persisted payload
On CLI the F.1 dial renders via the AskUserQuestion Shape F.1 trailer; the navigator's pick arrives as the NEXT user turn. At turn start, the consumer reads the prior turn's `f1_closer_payload` (verbs[] + reachIds{verb}) from the persisted decision trace, and matches the current turn's selected option / classified verb against `payload.verbs`. A match yields `{verb, outcome, reach_id}`; the outcome (accept/defer/reject/Free-Text) is derived from which F.1 option was picked. No fuzzy NLP -- a deterministic option/verb match (the AskUserQuestion answer is a known enum from the rendered card). No match -> no-op (DCW-04).

### HOW-3 (capture-adapter seam) -- shared-core consumer + per-surface capture
The consumer core is a pure-ish function: `consumeF1Pick({ priorPayload, pick, roomDir })` that validates, resolves `{verb, outcome, reach_id}`, and calls `closeOffer`. The SURFACE-specific part is a thin capture adapter that produces `pick` from the surface's turn input: CLI adapter (AskUserQuestion answer -> pick) is built + tested now; Desktop/Cowork adapters are documented seam contracts only (signature + expected shape), live capture deferred. This is the Tri-Polar split: shared core, surface capture.

### HOW-4 (where it attaches) -- turn-start, before the engine arm, in intent-classifier
The consumer fires at TURN START (before the new turn's dial render), reading the prior turn's persisted trace. Attach in `scripts/intent-classifier.cjs` on the same arm that later persists the next payload (near the producer block 1806-1842, but at the READ side of the turn). It must be best-effort (try/catch; a missing/old payload degrades to no-op) so non-dial turns are byte-unchanged (DCW-04).

### HOW-5 (Part 8 lane) -- pick text stays LOCAL, reuse the FIX-05 sentence lane
The navigator's raw pick text / conversation seed rides the existing FIX-05 LOCAL routing lane (`intent-classifier.cjs:1851`), classified to a scalar boolean + source enum at the write seam; it NEVER enters a row body, an edge, or a Brain packet. The consumer forwards only {verb enum, outcome enum, reach_id enum}. The Part 8 sweep (DCW-05) mirrors the Phase 158 SECRETREASON123 tripwire.

### Claude's Discretion (left to plan)
- The exact module home for the consumer core (a new `lib/workflow/f1-pick-consumer.cjs` vs a function added to `offer-closer.cjs`) -- planner decides; must stay Part 9 chokepoint-only.
- The integration-test harness shape (a 2-turn driver invoking the real intent-classifier arm vs a focused producer->consumer->penalty harness) -- planner decides; must assert the LIVE suppression (DCW-09), RED on consumer removal.
- Wave/plan structure -- planner decides (likely: W1 closeOffer reach_id forward + consumer core + CLI adapter; W2 turn-start wiring in intent-classifier; W3 integration test + run-all-159.sh gate + Part 8/9 sweeps).
</decisions>

<canonical_refs>
## Canonical References (downstream agents MUST read before planning)

### Locked requirements
- `.planning/phases/159-dial-closer-consumer-wire/159-SPEC.md` -- DCW-01..10, boundaries, acceptance

### The producer + closers (the seam to wire)
- `scripts/intent-classifier.cjs:1806-1855` -- the renderF1 producer block (persists `f1_closer_payload` with `reachIdByVerb`); `:1890` the persist site; `:1825-1832` the grounding->verb map (Wire 2); `:1851` the FIX-05 LOCAL sentence lane (Part 8)
- `lib/workflow/offer-closer.cjs` -- `renderF1` (:~138 builds the payload), `closeOffer` (:286, the consumer target), `decisionArgs` (:329-336, where reach_id must be added)
- `lib/workflow/dial-close-reach.cjs` -- `closeReach` (:222, forwards reach_id at :251) -- SIBLING, not re-routed this phase
- `lib/workflow/selector-decisions.cjs` -- `recordSelectorDecision` (the enum-gated writer; Phase 158-01 added the REACH_IDS gate), `recordSelectorMiss`
- `lib/workflow/reach-reject-reader.cjs` -- `computeReachPenalties` (the 158 consumer this phase finally feeds)
- `lib/core/navigation.cjs` -- the Part 9 chokepoint (sole read/write path)

### The live arm + frozen contracts
- `scripts/intent-classifier.cjs:1522-1582` -- the live engine arm (reach_presented emit + computeReachPenalties fold); the engine-activation gate (Wire 3 validation)
- `lib/core/navigation-engine.cjs` -- `decide()` (the legacy->engine flip; Wire 3)
- `tests/run-all-158.sh` (14/14), `tests/run-all-148.sh` (18/18, frozen-148) -- both must stay green inside `tests/run-all-159.sh`

### Canon
- `docs/MINDRIAN-CANON.md` Part 4 (every dial choice -> graph data), Part 8 (pick text never egresses), Part 9 (navigation.cjs chokepoint)
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (Part 7)
- `closeOffer` / `closeReach` / `recordSelectorDecision` / `recordSelectorMiss` -- the 4-outcome write surface already exists; the consumer is thin glue.
- The persisted `f1_closer_payload` (verbs + reachIds) already carries everything the consumer needs; it is just never read.
- The Phase 158-01 REACH_IDS enum-gate on `recordSelectorDecision` is the final keying guard -- off-set reach_ids are dropped, so forwarding a non-frozen grounding is safe (degrades to unkeyed).

### Established Patterns
- Best-effort lazy-require + try/catch (the producer block at :1806-1855 is the idiom to mirror on the consumer side).
- FIX-05 LOCAL sentence lane (Part 8 pick-text isolation).
- Phase 158 SECRETREASON123 Part 8 tripwire + the run-all-15x.sh one-command gate idiom.

### Integration Points
- One read seam (turn-start consumer) + one write extension (`closeOffer` reach_id) + one test gate. No schema change, no new edge type, no frozen-constant touch.
</code_context>

<specifics>
## Specific Ideas
- The concrete behavior to deliver: a navigator who picks "reject" on a dial reach three turns running causes that reach to drop out of the rendered top-K on the next turn -- driven by REAL recorded rejections, the exact loop Phase 158 built but could not feed.
- Wire 3 is a VALIDATION, not a build: confirm `decide()` fires the engine arm in real rooms; if engine activation is rare, the live loop runs rarely (record as a finding, does not block the wire).
</specifics>

<deferred>
## Deferred Ideas
- LIVE Desktop/Cowork conversational pick-capture (seam defined here; capture is a follow-up).
- Re-routing the ignite/B3 `closeReach` path through the shared consumer (additive; only if a later phase needs it).
- The dormant `_applyDecayWeight` command-rail (SC-04 / BLOCKER 2) -- separate latent follow-up.
</deferred>

---

*Phase: 159-dial-closer-consumer-wire*
*Context gathered: 2026-06-15 (discuss skipped; how-decisions locked inline)*
*Next step: /gsd:plan-phase 159*
