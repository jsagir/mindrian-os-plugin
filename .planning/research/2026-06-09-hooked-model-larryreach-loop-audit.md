# Hooked Model Audit: The LarryReach Loop (v1.14.0)

> Filed 2026-06-09. Scope: the in-session engagement loop of MindrianOS (reach sensors -> dial -> reward -> investment), audited against Nir Eyal's Hooked Model (Trigger -> Action -> Variable Reward -> Investment). Grounded in the live code on branch chore/canonical-domain-mindrian-os.
>
> Milestone: v1.14.0 "Larry Thinks". Sibling docs: SESSION-HANDOFF-2026-06-08-larryreach-148-149-152.md, research/v1.13.1-larryreach-fanout.

## TL;DR

The LarryReach loop is engineered as a habit loop but behaves as a within-session UTILITY loop, and a strong one. Action, Investment, and Ethics are A-grade. The two phases dragging the score are the External (re-entry) Trigger and Variable Reward. The single most important finding: the loop is NOT instrumented, so we cannot currently know whether a habit forms at all.

The right benchmark here is NOT daily opens (venture work is intrinsically low-frequency, B2B-shaped). It is: "when the navigator sits down to work the venture, they reach for the dial before their own memory."

## Loop map (live as of v1.13.1+)

```
TRIGGER   7 insight sensors (SENS-01..07)  lib/core/insight-sensors.cjs::dispatchSensors
   v      auto-fired by lib/core/skill-activation-router.cjs Precedence Rule 1 (Phase 144)
ACTION    Capability Dial (Shape F.1)       lib/hmi/shape-f1-renderer.cjs, MAX_K=3, 1 numeral + ENTER
   v      ranked + gated                     lib/workflow/f-selector-ranker.cjs (0.70/0.15 gate)
REWARD    Larry-voiced trace                 SKILL.md ("Brain says" / "Reading the Room" / "Done")
   v      real command fires, typed artifact lands via lib/workflow/command-resolver.cjs
INVEST    SELECTED_REACH / PIVOTED edges     lib/workflow/dial-close-reach.cjs -> navigation.cjs
   '----> graph accretion reloads the next trigger (f-selector-ranker re-weights next turn)
```

5 reaches LIVE: context_block, contradiction, cross_room, brain_consult, deep_research.
6th reach (hats): PLANNED, parked behind Phase 148 (D-09 constitutional amendment).

## Score card

| Phase | Score | Critical gap | Priority fix |
|---|---|---|---|
| Trigger (External) | 3/10 | No re-entry trigger. Auto-fire is in-session only; nothing pulls the navigator back across days. | Convert stored investment into a return cue |
| Trigger (Internal) | 7/10 | Sensors are effectively an internal-emotion detector ("we keep stalling on X", gate approach). Well-mapped to "what is my next move?" No proof the user opens MindrianOS because of that emotion yet. | Instrument the internal-trigger proxy |
| Action (B=MAP) | 8/10 | Textbook ability-first: 1 keystroke, MAX_K=3, what-they-get labels, free-text fallback. Only real friction is non-routine (trusting an engine to route you, vs typing /mos: from memory). | Lower the trust cost, not the click cost |
| Variable Reward | 5/10 | Reward is real but predictable and single-type (Hunt). Almost no Self, zero Tribe. No engineered variability, no "satisfied AND still wanting." | Add the anticipatory half + a Self signal |
| Investment | 7/10 | Architecturally excellent (edges reload next trigger; graph = switching cost / IKEA effect). But investment is invisible; the user never feels they are depositing value. | Make accretion visible |
| Loop Closure | 6/10 | In-session loop closes tightly. Cross-session loop does not exist. | Close the across-days loop |
| Ethics | 9/10 | Model Facilitator (improves lives + maker dog-foods it, Canon Part 6). | Protect guardrails as craving is added |
| TOTAL | 45/70 | Band: Emerging hook (45-59), targeted fixes. Floor of band: 3 strong phases, 2 weak. | Three precise additions, not a redesign |

## Roadmap

### Quick wins (high impact, low effort, machinery already exists)

1. Re-entry trigger from investment. Biggest gap, cheapest close. SELECTED_REACH and DEFER edges already exist in room.db. On return, the dial's first surface fires from the loaded trigger: "Last session you deferred the market contradiction - resolve it now?" Completes the Investment-reloads-Trigger arc across sessions, not just turns.
   - COLLISION NOTE: touches the dial selector surface. This is squarely Phase 148 (LarryReach selector re-wire) territory. Fold into Phase 148, do NOT do standalone.

2. Instrument the loop (THE UNLOCK). Zero loop-health metrics exist today. The data is already written: f_selector_sync_confirmed / f_selector_pivot / f_selector_miss memory events (lib/core/navigation/memory-events.cjs) plus SELECTED_REACH / PIVOTED / DEFERRED / REJECTED edges. Read via navigation.findRecentChanges (the chokepoint). Pure aggregation, additive, read-only, no collision with parked Phase 148. Minimum set: acceptance rate (sync+pivot), in-sync rate, pivot rate, miss rate, per-reach breakdown.
   - STATUS: shipped as the v1.14.0 quick win (see "Shipped" below).

3. Anticipatory reward half. The "Done" trace exists; append one line loading the next trigger: "Done. That opened a new question: X." Variable reward is not just unpredictable content (we have that) but wanting-more. One string; closes the craving gap without slot-machine mechanics.
   - COLLISION NOTE: modifies the reward rendering contract (SKILL.md / renderer) that Phase 148 re-wires. Fold into Phase 148.

### Medium-term

- Diversify reward type: add a light Self signal (mastery/progress, e.g. "4 of 6 load-bearing claims grounded"); where a cohort exists, a careful Tribe reward (Part 8 clean, no user content).
- Ship the 6th reach (hats): a multi-perspective reframe is a genuinely different reward shape - the cheapest variability injection, already planned.
- Sensor recall tuning: the prompt (P in B=MAP) only fires when a sensor fires. Track false-negatives (turns where the user typed a /mos: command the dial should have surfaced) = prompt-coverage gap. Depends on quick win 2.

## Ethics: Facilitator (9/10)

Ideal quadrant: improves the navigator's thinking AND the maker uses it (Canon Part 6 dog-fooding). Deliberate anti-dark-pattern choices: the honesty floor ("let me search", never "I'm thinking"); contradiction reach never silently picks a winner (surfaces both, asks); confirm-gated dial; free-text fallback always open; legacy /mos: path never removed; internal trigger targets a productive emotion (decision uncertainty), not loneliness/FOMO.

Watch-item: quick wins 1 and 3 both add pull. Re-entry cue + anticipatory reward are the mechanics that, pushed too hard, slide Facilitator toward Dealer. Hard constraints to preserve: the re-entry trigger must carry utility every time (frequency without utility = annoyance, trains the user to ignore it); the honesty floor never bends to manufacture delight.

## Loop-health metrics (tie to B2B benchmark)

- Reach acceptance rate (picked / surfaced), per reach_id
- In-sync rate (sync / committed) vs pivot rate (pivot / committed)
- Miss rate (none-fit / surfaced)
- Internal-trigger proxy: % of sessions where the navigator engaged a reach without it being auto-fired
- Investment depth: SELECTED_REACH edges per room over time
- WAU/MAU per active room (B2B: >0.6 strong; venture work runs lower, weight retention over daily use)
- D30/D90 room-return without external nudge
- Eyal benchmark: 5%+ unprompted daily habit is healthy; most B2B sits below 2%

## Shipped (v1.14.0 quick win)

Quick win 2 (instrumentation) shipped 2026-06-09 as lib/core/metrics/larryreach-loop-health.cjs::computeLoopHealth(db, opts) over a caller-owned room.db handle, reading exclusively via the navigation chokepoint (findRecentChanges). Returns committed / sync / pivot / miss counts, in_sync_rate, pivot_rate, miss_rate, acceptance signal, and a per-reach breakdown. Read-only, zero Brain egress (Part 8), zero direct room.db opens (Part 9 substrate guard). See tests/test-149* sibling style; covered by tests/test-larryreach-loop-health.cjs.

Quick wins 1 and 3 deferred to Phase 148 by collision (both touch the parked selector/reward surface). Documented here so Phase 148 picks them up.
