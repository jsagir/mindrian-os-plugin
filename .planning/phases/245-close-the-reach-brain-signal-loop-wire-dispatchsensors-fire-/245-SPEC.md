# Phase 245: Close the reach/Brain signal loop — Specification

**Created:** 2026-07-31
**Ambiguity score:** 0.21 (gate: ≤ 0.20 — navigator confirmed proceed at this score after 4 interview rounds; see Ambiguity Report)
**Requirements:** 5 locked

## Goal

A navigator in a venture room asking two different things in the same session sees two
different, Brain-informed top-ranked dial items — not the same static card regardless of
input — and Brain re-derivation happens on a defined trigger (governing-thought change or
explicit ask), not implicitly whenever someone remembers to run it by hand.

## Background

Traced live against the working tree (branch `main`) during this session, and independently
corroborated by same-day room research (`rethinking-mindrianos/research/2026-07-31-dial-rethink-decoupled-from-sensor-bank/`,
dev-repo landing at `.planning/quick/260731-35r-phase-244-1-document-dial-render-sensor-/260731-35r-FINDING.md`):

- `dispatchSensors` → `decide()` produces a real, content-reactive `fire_skill` verb every
  turn (one of Canon Part 3's closed 10-verb `CANONICAL_VERBS`), but that verb is, by the
  code's own comment, "the LAST thing Larry sees in additionalContext" — advisory only, never
  rendered.
- The F.7 dial the navigator actually picks from is scored by a completely different,
  deliberately decoupled path: `cortex-reach-adapter.cjs` building reach scores from
  graph-node recency/presence, feeding `dial-reach-orchestrator.cjs`. It never imports the
  sensor-bank orchestrator. Confirmed this session: across 7 conversation turns with wildly
  different intent (greeting, room list, destructive-op request, room switch, meta-questions,
  a trends question), the dial's `claim:derive:xxxx` content and 40/20/10% weights never
  changed while `fire_skill` did vary (`Run Methodology` / `Spawn Sub-Agent`).
- Of the 6 sensor `reach_id`s that CAN map to a verb (`reachIdToSkillFamily` in
  `lib/core/navigation-engine.cjs`), `hats` has zero actual sensor implementation anywhere in
  the 17-file bank — reachable only by manual navigator pick, never proactively, a gap flagged
  as required work in June's Phase 143.2 and still open 7+ weeks later.
- 11 of 17 sensors (65%) can independently fire the identical `context_block` output category;
  today's tie-break is file registration order, not the doctrine's claimed priority hierarchy.
- `rethinking-mindrianos/research/BRAIN.md` (read live this session) is 12 days stale
  (`brain_generated_at: 2026-07-19`), `staleness: "fresh"` per its own hash-match logic despite
  the age, `brain_query_count: 0`, and every one of 9 sections is literally `(no signal)`. Brain
  was queried and legitimately returned nothing — most plausibly because this room is a
  meta-dev-research room outside Brain's generic-methodology corpus scope (Canon Part 8), not a
  connectivity defect. There is no defined trigger today for WHEN `BRAIN.md` re-derives; it
  happens only when a navigator remembers to run `mos:brain-derive`.
- A live `brain_stats` call this session was itself intercepted by the Part 8 egress-guard hook
  (`part8-egress-guard-hook.cjs`), which fired its leak-prevention card on what should be a pure,
  contentless stats read — noted live, not yet root-caused.
- This phase is a follow-on to Phase 244 (Semantic Trigger Tier — CLOSED, independently
  verified, already shipped in the running v1.16.0-beta.1), which built the sensor-side fusion
  work this phase's dial/Brain half was never wired to.

## Requirements

1. **Dial reflects sensor/Brain signal**: The F.7 dial's top-ranked item changes when a turn's
   `fire_skill`/sensor signal changes, instead of being sourced only from static graph-node
   recency.
   - Current: `buildReachList`/`cortex-reach-adapter.cjs` scores the dial from graph-node
     recency only; `dispatchSensors`'/`fire_skill`'s output never reaches it (confirmed:
     `dial-reach-orchestrator.cjs`'s own header comment, "never imports the orchestrator... the
     two stay decoupled").
   - Target: the dial's ranking incorporates the turn's fired sensor/verb signal, so it is
     visibly content-reactive. **Amended during discuss-phase (245-CONTEXT.md D-24):** research
     found `resolveFireSkill`'s precedence (`lib/core/navigation-engine.cjs:596-660`) makes a
     fired sensor reach always win over Brain's own `pattern_matches` verb — Brain only gets a
     say when zero sensors fire that turn, which was true on essentially none of this session's
     observed turns. Left as designed, Req 1+Req 2 alone would NOT make the dial actually
     "Brain-informed" per this SPEC's own Goal statement — Brain's verb would stay starved behind
     sensor precedence. Navigator confirmed: fuse Brain's `pattern_matches` verb into the
     dial-ranking blend as a genuine third input (alongside cortex recency and sensor signal),
     not gated behind sensor silence.
   - Acceptance: in one session, two turns with clearly different intent (e.g. a
     contradiction-check ask vs. a cross-room ask) produce two DIFFERENT top-ranked dial items,
     not the same card both times (automatable as a regression test); AND a turn where a fresh
     Brain `pattern_matches` verb exists alongside a fired sensor visibly influences the dial's
     ranking (not silently discarded by sensor precedence) — a second, distinct regression test
     from the first.

2. **Brain-consult trigger policy**: `BRAIN.md` re-derives on a defined event, not only when a
   navigator remembers to run it by hand.
   - Current: no trigger exists; derivation is fully manual (`mos:brain-derive`), so `BRAIN.md`
     silently goes stale for weeks (12 days observed live this session) while still
     self-reporting `staleness: "fresh"`.
   - Target: `BRAIN.md` auto-re-derives (async, cached, non-blocking — never a synchronous call
     in the turn's hot path) when the room's `governing_thought_hash` changes, when it ages past
     `BRAIN_STALE_AGE_DAYS`, or when a navigator explicitly asks for fresh insight. This extends
     the existing `STALENESS_MULTIPLIERS` cached-read design rather than replacing it with a live
     per-turn call. **Amended during discuss-phase (245-CONTEXT.md D-11):** research found the
     shipped, correct mechanism for this requirement already includes `age_exceeded` staleness as
     a third trigger alongside governing-thought-change; the navigator confirmed this is a
     legitimate trigger, not scope creep, so the target and acceptance below include it.
   - Acceptance: in a test room, changing the governing thought, aging a section's `BRAIN.md`
     past `BRAIN_STALE_AGE_DAYS`, or issuing an explicit re-derive ask each triggers a `BRAIN.md`
     regeneration within the phase's defined window, verified by a changed
     `brain_generated_at`/`governing_thought_hash` pair; a turn with an unchanged governing
     thought, not yet aged past `BRAIN_STALE_AGE_DAYS`, and no explicit ask does NOT trigger a
     live Brain call.

3. **`hats` reach fires proactively**: At least one sensor in the bank can independently
   produce `reach_id: 'hats'`.
   - Current: `hats` is one of 6 frozen reach categories (Phase 148) with a canonical-verb
     mapping (`reachIdToSkillFamily` → `Synthesize`) but zero sensor ever assigns it; reachable
     only via manual navigator pick.
   - Target: a real sensor (new or modified) fires `reach_id: 'hats'` under a defined,
     documented trigger condition.
   - Acceptance: a test turn matching that trigger condition produces `reach_id: 'hats'` from
     `dispatchSensors` without a manual pick.

4. **`context_block` tie-break**: Sensors that collide on the same output category resolve by
   an actual priority rule.
   - Current: 11 of 17 sensors can independently fire `context_block`; today's winner is
     whichever sensor happens to sit first in file-registration order.
   - Target: a documented, code-enforced priority rule (not registration order) decides which
     fired sensor's payload wins when multiple sensors collide on the same `reach_id` in one
     turn.
   - Acceptance: a test firing 2+ colliding sensors in a single turn deterministically selects
     the rule-defined winner, reproducibly across runs, independent of file load order.

5. **Part 8 egress-guard scoping check**: The guard hook's behavior on a pure, contentless read
   is confirmed correct or fixed.
   - Current: `brain_stats` (per its own tool description: no side effects, no user content)
     was intercepted by the Part 8 leak-prevention card this session.
   - Target: root-caused and resolved one of two ways — (a) confirmed correctly conservative
     with the reasoning documented, or (b) the guard's matcher is fixed to stop flagging
     genuinely contentless calls.
   - Acceptance: a call to `brain_stats` (or an equivalent pure-metadata Brain tool) either
     passes the guard without a card, or the guard's block is demonstrated to be intentional
     against a real leak vector, with either outcome documented.

## Boundaries

**In scope:**
- Wiring the dial's ranking to incorporate sensor/`fire_skill` signal (Req 1)
- A defined Brain-consult trigger/cadence policy, implemented (Req 2)
- A real, firing `hats` sensor (Req 3)
- A real `context_block` collision tie-break rule (Req 4)
- Root-causing and resolving the Part 8 guard's stats-call over-fire (Req 5)
- Canon changes ARE on the table if the above genuinely require them (navigator's explicit
  instruction this round: "all can be considered including any needed change in any needed
  canon file... to make this working") — this phase does not pre-declare any of the 5
  requirements above as impossible without amendment; whether an amendment is actually
  necessary is a discuss-phase/plan-phase design question, not foreclosed here.

**Out of scope / explicitly not pre-walled-off, but flagged as high-cost, not-default options
requiring justification if chosen (navigator explicitly declined to protect these as hard
non-goals, so none are forbidden — they are flagged, not excluded):**
- A full sensor-bank rewrite — the same-day dial-rethink research already reached a reasoned
  "do not rewrite" verdict with named flip conditions (a 3rd patch at this seam, or sensor
  count crossing ~25-30 files); neither is true today. A rewrite remains available but starts
  from a documented burden of proof, not a blank slate.
- A live/synchronous Brain call inside the per-turn request hot path — the room's own research
  (arXiv 2605.30152, cited in the 2026-07-31 dial-rethink entry) found a per-turn live consult
  blows the repo's documented 1200ms navigation budget unless the process stays warm, and this
  repo's execution model is fresh-invocation-per-turn. Requirement 2's target is explicitly
  async/cached for this reason. A synchronous call is not forbidden if a future design
  genuinely justifies it, but is not the phase's default target.
- Reopening Phase 244 (Semantic Trigger Tier) — CLOSED, independently verified, already shipped
  in beta.1; this phase builds on top of it.

**Held as a hard invariant regardless of the "everything including canon" instruction above,**
because it is a data-egress/privacy boundary, not an engineering taxonomy choice, and the
navigator's instruction was given in the context of making the routing/dial mechanism work, not
as a review of Part 8 itself:
- Canon Part 8 (Graph Boundary: LOCAL → BRAIN egress stays generic-methodology-only, never
  user-specific bytes) is NOT reopened by this phase. Requirement 5 investigates whether the
  EXISTING guard is correctly scoped, not whether the boundary itself should loosen. If Req 2's
  or Req 1's implementation appears to require weakening this boundary, that is a stop-and-ask
  moment for the navigator, not a default this phase takes.

## Constraints

- No requirement may introduce a synchronous/blocking Brain network call into the per-turn
  request path (see Boundaries) — asynchronous, cached, staleness-weighted only.
- Canon Part 3 (`CANONICAL_VERBS`, closed 10-verb set): may be amended if Requirement 1 or 3
  genuinely requires it, per the navigator's explicit instruction, but any such change is a
  deliberate canon amendment (documented, not a silent runtime addition), not a default path.
- Canon Part 7 (Reuse before build): any new code must be checked against existing primitives
  first (the room's own research names `lib/core/eureka/`'s FTS5+bm25+RRF+MMR primitives as
  already-shipped and reusable for ranking/fusion work relevant to Requirements 1 and 4).
- Canon Part 8 (Graph Boundary): hard invariant, not in scope to loosen (see Boundaries).
- This repo's GSD-workflow-enforcement rule: no direct file edits outside a GSD command; this
  phase proceeds through `/gsd-discuss-phase 245` → `/gsd-plan-phase 245` → `/gsd-execute-phase
  245`, not ad-hoc edits.
- Whether this phase ships inside v1.16.0 (still "executing"; Gate 0 / v1.15.0 stable close-out
  still blocks any release cut) or opens a new milestone is undecided — flagged for the
  navigator, not assumed.

## Acceptance Criteria

- [ ] Two turns with clearly different intent in one session produce two different top-ranked
      dial items (Req 1)
- [ ] A fresh Brain `pattern_matches` verb visibly influences the dial's ranking even on a turn
      where a sensor also fires, not silently discarded by sensor precedence (Req 1, amended per
      245-CONTEXT.md D-24)
- [ ] A governing-thought change, `BRAIN_STALE_AGE_DAYS` age-out, or explicit re-derive ask
      triggers `BRAIN.md` regeneration within the phase's defined window; a turn matching none
      of those three does not trigger a live Brain call (Req 2, amended per 245-CONTEXT.md D-11)
- [ ] A defined trigger condition causes a real sensor to fire `reach_id: 'hats'` without a
      manual pick (Req 3)
- [ ] Two or more sensors colliding on `context_block` in one turn resolve to a deterministic,
      rule-defined winner, independent of file-registration order (Req 4)
- [ ] `brain_stats` (or an equivalent pure-metadata Brain tool) either passes the Part 8 guard
      cleanly, or its block is documented as intentional against a real leak vector (Req 5)
- [ ] No requirement's shipped implementation adds a synchronous Brain call to the per-turn hot
      path
- [ ] Canon Part 8 remains unmodified by this phase's changes

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                                      |
|---------------------|-------|------|--------|--------------------------------------------------------------|
| Goal Clarity        | 0.82  | 0.75 | ✓      | Single measurable outcome: content-reactive, Brain-informed dial in a venture room |
| Boundary Clarity    | 0.75  | 0.70 | ✓      | 5 in-scope items explicit; navigator explicitly declined pre-walled non-goals except the Part 8 invariant |
| Constraint Clarity  | 0.72  | 0.65 | ✓      | Async-only Brain calls, Canon 3/7/8 constraints, GSD-workflow-enforcement all explicit |
| Acceptance Criteria | 0.85  | 0.70 | ✓      | 7 pass/fail checkboxes, each tied to a specific requirement |
| **Ambiguity**       | 0.21  | ≤0.20| ~      | Navigator confirmed "write SPEC.md now" at this score rather than a 5th round |

Status: ✓ = met minimum, ~ = navigator explicitly accepted a score marginally above the
computed gate rather than continue interviewing.

## Interview Log

| Round | Perspective     | Question summary                                                    | Decision locked                                                                 |
|-------|-----------------|-----------------------------------------------------------------------|----------------------------------------------------------------------------------|
| 1     | Researcher      | Primary deliverable: dial-wiring only, Brain-policy only, or both?    | Both, one phase — same underlying reverse salient                                |
| 1     | Researcher      | Which of 3 adjacent findings (hats, collision, Part-8 guard) in scope?| Contradictory multi-select flagged; re-asked                                     |
| 2     | Boundary Keeper | Resolve the contradiction: all 3 in or out?                          | All 3 IN scope                                                                    |
| 2     | Simplifier      | Irreducible core outcome?                                             | Dial-reactivity and Brain-policy are equally load-bearing, neither optional      |
| 3     | Boundary Keeper | Which items should be protected as explicit non-goals?                | Navigator rejected all 4 proposed non-goals, incl. canon changes; only Part 8 held as hard invariant by this document's own judgment, not the navigator's list |
| 3     | Failure Analyst | Pass/fail test for `hats`?                                            | A real sensor fires it proactively (not just documenting the gap)                |
| 3     | Failure Analyst | Pass/fail test for collision + Part-8 guard?                          | Real tie-break rule + real guard fix/confirmation, not just a written finding    |
| 4     | Seed Closer     | Concrete falsifiable dial-reactivity test?                            | 2 different asks → 2 different top cards, automatable                            |
| 4     | Seed Closer     | Concrete Brain-trigger policy?                                        | Re-derive on governing-thought change or explicit ask; extends STALENESS_MULTIPLIERS, never a bare per-turn schedule |
| 5     | Seed Closer     | Gate check at ambiguity ≈0.21 — proceed or one more round?            | Proceed — write SPEC.md now                                                      |

---

*Phase: 245-close-the-reach-brain-signal-loop-wire-dispatchsensors-fire-*
*Spec created: 2026-07-31*
*Next step: /gsd-discuss-phase 245 — implementation decisions (how the dial incorporates sensor signal, the exact re-derive mechanism, the hats sensor's trigger condition, the tie-break rule, and the Part 8 guard's actual matcher fix)*
