# F.1 Next Move Selector — Deferred to Phase 88.2

**Phase:** 95.1
**Decision:** D-18 (CONTEXT.md)
**Open Question:** OQ2 (RESEARCH.md)
**Filed:** 2026-04-30

## What ships in 95.1

`scripts/doctor.cjs renderHumanReport` emits a STRUCTURAL marker block when drift is detected without `--fix`:

```
  [F.1 Next Move]
   ▶ Run /mos:doctor --fix
   ▷ Defer
   ▷ Free-Text
```

This is rendered as plain stdout. Larry interprets the user's natural-language response per D-19 (renderer is structural; voice-dna patterns apply when Larry surfaces conversationally).

## What's deferred to Phase 88.2

The canonical Shape F.1 implementation per `skills/ui-system/SKILL.md` §2 Shape F.1:

- AskUserQuestion primitive with up/down/J/K navigation
- Three-context strip below header (LOCAL / BRAIN / SIGNAL per Canon Part 3)
- RECOMMENDED marker (only at Brain confidence ≥ 0.7)
- State-update hook: append to STATE.md Decisions section + add typed edge `(navigator) -[CHOSE {verb}]-> (current-artifact)` to local graph

## Why deferred (not built in 95.1)

Per `docs/CANON-PHASE-MAP.md`, Phase 88.2 (`uiux-selector-block`) is the canonical Shape F implementer. It's marked `planned` as of 2026-04-30. Building Shape F inline in 95.1 would:

1. Duplicate work that Phase 88.2 owns
2. Create a second F.1 implementation that Phase 88.2 must later supersede or migrate
3. Couple `/mos:doctor` to a primitive (AskUserQuestion) that has not yet shipped its canonical wrapper

The structural marker is a stepping stone. Phase 88.2 replaces it without changing `/mos:doctor`'s contract — the marker block is replaced by the AskUserQuestion call, the verbs (Run / Defer / Free-Text) stay identical, the state-update hook lands.

## Re-trigger condition

When Phase 88.2 ships, replace the F.1 marker block in `scripts/doctor.cjs renderHumanReport` with the canonical AskUserQuestion call. Update this file with the link to the 88.2 plan that did the work.

## References

- `skills/ui-system/SKILL.md` §2 Shape F.1 (canonical contract)
- `docs/MINDRIAN-CANON.md` Part 3 (Tri-Context Decision Gate; the 10 verbs)
- `references/personality/voice-dna.md` (Larry's conversational handling per D-19)
- `.planning/phases/95.1-.../95.1-CONTEXT.md` D-18 (lock that this is Shape F.1)
- `.planning/phases/95.1-.../95.1-RESEARCH.md` Open Question 2 (deferral rationale)
