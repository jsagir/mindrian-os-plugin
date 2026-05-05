---
type: rollback-procedure
phase: 115
trigger: D-20 hard threshold (< 4 of 5 testers report vivid recent memory)
pre_committed_at: 2026-05-05 (Wave 0; before validation week begins)
canon: Part 6 (dog-fooding) -- Phase 115 IS a venture decision; rollback IS graph data
---

# Phase 115 Rollback Procedure (D-20 Hard Threshold)

> **Pre-commit principle:** this procedure MUST be on disk and reviewed BEFORE the validation email goes out. Deliberation time during a live failure is forbidden -- the team will feel pressure to ship anyway, and the rule "ship with caveats" violates the pre-commitment. Read this BEFORE the threshold trips.

## Trigger

Per D-20 (verbatim from 115-CONTEXT.md):

> "if FEWER than 4-of-5 testers report a vivid recent memory, revert the copy AND activate one of the 4 fallback emotions from the spec."

This file pre-commits to:
- The threshold (< 4/5 vivid recent memory)
- The ranking of fallback emotions (#1 below)
- The mechanism-vs-copy split (mechanism stays; only copy reverts)

## Rollback steps (DO NOT DELIBERATE; EXECUTE IN ORDER)

### Step 1: Pick the #1 fallback emotion (pre-committed ranking)

Per the-owned-emotion.md `## Fallback candidates`:

**Fallback emotion #1:** "I have a pile of insights and I can't see the shape of them."

Rationale for ranking #1: appeals to information-dense founders, which is the largest segment in our wave-2 tester pool. Recency + frequency are highest probability against this segment.

If fallback #1 also lands < 4/5 in re-validation, escalate to milestone owner BEFORE picking fallback #2. Do not chain fallbacks.

### Step 2: Revert surface copy via git (mechanism stays untouched)

```bash
# Identify the surface-rewrite commit SHAs from 115-01 + 115-02 + 115-03
git log --oneline --grep="^feat(115" | head -10

# Revert ONLY the spec-strings module mutation; mechanism shape stays
git revert --no-commit <115-01 commit SHA>
git revert --no-commit <115-02 commit SHA>
git revert --no-commit <115-03 commit SHA>

# Edit lib/copy/115-spec-strings.cjs to swap in fallback emotion #1 strings
# (do this manually -- the module shape is preserved; only string values change)

git commit -m "rollback(115): D-20 trigger fired (X-of-5); activated fallback emotion #1"
```

### Step 3: Apply fallback emotion #1 to all 8 surfaces via the same import path

Per Pitfall 1 mitigation: surfaces import from `lib/copy/115-spec-strings.cjs`. Mutating the spec-strings module values (not shape) cascades through all 8 surfaces automatically. Rebuild package, no other surface edits needed.

Fallback emotion #1 spec strings (verbatim -- pre-committed):

- SPLASH_COPY -> "Pile of insights and you can't see the shape of them? Let's find the shape."
- NEW_PROJECT_OPENER -> "I'm Larry. What's the pile you're carrying?"
- MARKETING_LINE -> "For founders with a pile of insights they can't see the shape of."
- DROR_TEST_CRITERIA -> "a founder with a pile of unstructured insights right now and no shape for them."
- INITIAL_PROMPT_DEFAULT -> "I'm Larry. What's the pile? (Tell me, or paste a doc/CV.)"
- ONBOARD_OPENING_FRAMING -> "Very simply -- if you're here, you've got a pile of insights and you can't quite see the shape of them. That's the feeling MindrianOS is built for. Let's find the shape together."
- README_HERO_TAGLINE -> same as MARKETING_LINE
- WEBSITE_HERO_TAGLINE -> same as MARKETING_LINE

### Step 4: Mechanism INTEGRITY (per Open Question 5 -- mechanism is independent of emotion)

DO NOT REVERT:
- `agents/larry-extended.md` `persona_variants:` frontmatter shape (the 9-key map; only `default` value changes)
- `lib/core/dual-path-detector.cjs` (5-feature additive score; emotion-agnostic)
- `lib/core/shallow-doc-parser.cjs` (extracts nodes from CV/memo paste; emotion-agnostic)
- `## Persona-Aware Turn 1` body section in larry-extended.md (conditional render logic)
- All test files (`tests/test-115-*.sh`, `lib/core/*.test.cjs`, manual checklists)

Mechanism stays intact. Only emotion copy mutates. This makes a future "try fallback #2 if fallback #1 fails" iteration cheap -- same surfaces, same code path, only strings change.

### Step 5: Re-run 5-tester validation with fallback emotion #1

- Update `tests/fixtures/115-validation-email-template.md` to swap in the new vivid-memory probe question:
  > "Think about the last time you felt like you had a pile of insights about your venture and you couldn't see the shape of them -- when was it? What did you do? What would have helped?"
- Send to same 5-tester cohort (re-priming risk acceptable per D-14 logic)
- New 48-hour reply window
- Synthesize per `tests/fixtures/115-tester-rubric.md` (table re-used; Q1 column reframes to fallback #1)

### Step 6: Ship gate at re-validation

- 4-of-5 vivid recent memory on fallback #1 -> SHIP. v1.13.0-beta.3 release plumbing per 115-04.
- < 4-of-5 on fallback #1 -> ESCALATE to milestone owner. Hold beta.3. Do NOT auto-pick fallback #2; that decision needs explicit milestone-level review.

## What rollback does NOT trigger

Per D-20 + RESEARCH `## Phase 116 Unresolved Tension Hook`:

- 30-day stickiness shortfall (Trigger Internal does NOT reach 8/10) does NOT trigger this rollback. That signal routes to Phase 116 (Unresolved Tension Hook) acceleration. Phase 115's emotion stays validated; the loop hasn't closed.
- D-20 covers ONLY validation-week 4-of-5 hard threshold. 30-day signal is OUT OF SCOPE here.

## Canon Part 4 (Every Choice Is Graph Data)

The rollback decision IS graph data. Whether ship or rollback, file a decision edge in the local room.db documenting:
- threshold_triggered: true | false
- vivid_yes_count: int (0..5)
- chosen_fallback: 'none' | 'fallback_1' | 'fallback_2_escalated' | 'fallback_3_escalated' | 'fallback_4_escalated'
- timestamp: iso8601

This decision edge becomes input for Phase 116 + Phase 121 telemetry.
