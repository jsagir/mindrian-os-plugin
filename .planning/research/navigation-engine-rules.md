---
status: PRD-stub
phase: 91
created: 2026-04-19
owner: Phase 91 research during planning (or during Phase 87/88 execution window)
purpose: Spec the decision rules navigation-engine.cjs uses; NOT a weighted score, a structured rule table
---

# Navigation Engine Decision Rules (PRD stub)

## Why this document exists

Phase 91 CONTEXT says the engine is "a structured decision function, not a weighted score" and "every decision has a trace." The actual rules are not enumerated. Without this document, the Phase 91 planner has to invent the decision logic. That's risky because the rules are the product.

This doc enumerates: given the five signals (ICM, SQL, Feynman-MINTO, BRAIN, intent/persona), what skill fires? What gets suppressed? What gets offered as next step?

## Five-signal inputs

From Phase 88 folder-memory readTriple + Phase 90 readQuadruple + live hook signals:

| Signal | Type | Source |
|---|---|---|
| icm_scope | `{section_name, parent_section}` | ROOM.md identity |
| sql_signals | `{contradictions, convergences, gaps, invalidations}` | room.db LazyGraph query |
| minto_reasoning | `{governing_thought, reasoning_health_score (0-1), flagged_weaknesses[]}` | Feynman-MINTO.md |
| brain_patterns | `{problem_type, wicked_indicators, framework_predictions, cross_room_contradictions}` | BRAIN.md if present, else null |
| intent_persona | `{intent_keywords, detected_problem_type, persona (Explicit/Implicit), turn_count}` | UserPromptSubmit + USER.md |

## Decision output

```javascript
{
  fire_skill: string | null,           // which skill must activate this turn
  suppress_skills: string[],           // skills that must NOT activate (overrides file-state)
  offer_next_step: { command, reason } | null,  // grounded next-step suggestion
  persona_updates: { archetype?, problem_type?, venture_stage? } | null,
  dial_position: "investigate" | "blend" | "insight",  // for statusline
  decision_trace: {                    // always populated, explainable
    icm_scope,
    sql_signals,
    minto_reasoning,
    brain_patterns,
    intent_persona,
    matching_rules: string[],          // which rules from below fired
    chosen_rationale: string
  }
}
```

## Rule table (to be completed during Phase 91 planning)

Format: `IF condition THEN action`

### Persona rules (run first, affects other rules)

- `IF user_message_matches_TTO_signals AND turn_count <= 3 THEN persona = TTO (-> Brain: Implicit)`
- `IF user_message_matches_researcher_signals THEN persona = Researcher (-> Brain: Explicit or Implicit depending on framing)`
- `IF user_message_matches_business_signals THEN persona = Business (-> Brain: Explicit)`
- `IF USER.md persona exists AND signal does not strongly override THEN preserve USER.md persona`

### Suppression rules (prevent wrong skill from firing)

- `IF minto_reasoning.reasoning_health_score < 0.3 THEN suppress "framework-routing" skills (don't pile more frameworks on broken reasoning)`
- `IF brain_patterns.problem_type == "Wicked" AND fire_skill was going to be Well-Defined tool (Mullins, Issue Trees) THEN suppress`
- `IF persona == "Researcher" AND intent matches "identity crisis" phrases THEN suppress methodology offers (affirm first)`
- `IF session scope violation risk (prior cross-room flag in decision_log) THEN suppress all cross-room operations`

### Fire rules (activate the right skill)

- `IF sql_signals.contradictions.length > 0 AND high_confidence THEN fire room-proactive "contradiction surfacing"`
- `IF sql_signals.convergences.length >= 3 THEN fire room-proactive "convergence detection"`
- `IF minto_reasoning.reasoning_health_score < 0.4 AND section has > 5 artifacts THEN fire structure-argument skill`
- `IF brain_patterns.problem_type == "Wicked" AND (WickedIndicators >= 3) THEN fire soft-systems / rich-pictures family`
- `IF brain_patterns.framework_predictions[0].confidence > 0.7 THEN fire pws-methodology with next framework`

### Offer rules (next-step suggestions, max 1 per turn)

- `IF gap_detected AND persona == TTO THEN offer "portfolio triage" commands first`
- `IF gap_detected AND persona == Researcher THEN offer "bridge framing" (lab -> market) commands first`
- `IF reasoning_health_score < 0.5 THEN offer /mos:challenge-assumptions or /mos:validate`
- `IF brain_patterns.unfilled_opportunity matches section THEN offer opportunity-related command (e.g., /mos:find-analogies)`
- `IF framework_chain_prediction available AND confidence > 0.7 THEN offer next framework`

### Dial position rules (for visible statusline)

- `IF turn_count <= 2 THEN dial = "investigate"` (default curve)
- `IF user_message matches "just tell me" / "bottom line" / "your take" THEN dial = "insight" (escape hatch, respected immediately)`
- `IF minto_reasoning strong AND brain_patterns strong AND turn_count >= 5 THEN dial = "insight"`
- `IF minto_reasoning weak THEN dial = "investigate" regardless of turn (don't deliver insight on broken reasoning)`
- `IF problem_type == "Undefined" THEN dial = "investigate" (no matter turn)`
- `IF problem_type == "Wicked" THEN dial = "blend" (push back, open possibilities, don't converge early)`

## Research tasks before Phase 91 planning

1. Stress-test each rule against real session transcripts (Tyler + Adam from 2026-04-19 meetings audit are natural test cases)
2. Identify rule conflicts (two fire rules matching same turn) and order resolution
3. Define confidence thresholds per rule (the numbers above are placeholders)
4. Enumerate edge cases: engine timeout, all signals null, Brain offline, USER.md missing
5. Design rule trace format for /mos:explain-decision

## Deliverable shape

Before `/gsd:plan-phase 91`, this doc should contain:
- Complete rule table (~30-50 rules)
- Confidence thresholds
- Rule conflict resolution order
- Edge case handling
- Test cases mapped to rule coverage

Then Phase 91 planner generates PLAN.md files against a concrete rule set, not speculation.
