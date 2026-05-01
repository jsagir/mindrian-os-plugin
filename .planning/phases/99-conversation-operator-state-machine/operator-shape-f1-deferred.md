# /mos:operator Shape F.1 + F.4 Selectors -- Deferred to Phase 88.2

**Phase:** 99
**Decision:** D-14 (Shape F.1 picker), D-15 (Shape F.4 reset confirm)
**Filed:** 2026-05-01
**Reference precedent:** `.planning/phases/95.1-mos-doctor-drift-detection-and-self-heal/f1-selector-deferred.md`

## What ships in Phase 99

`scripts/operator-command.cjs` emits STRUCTURAL marker blocks for the F.1 picker and F.4 confirmation. These render as plain stdout. Larry interprets the user's natural-language response per Phase 95.1-04 D-19 (renderer is structural; voice-dna patterns apply when Larry surfaces conversationally).

The F.1 picker block looks like:

```
[F.1 Next Move]
 ▶ JUST_TALK
 ▷ EXPLORE_CAPTURE
 ▷ BUILD_ROOM         (current -- selecting this is a no-op)
 ▷ METHODOLOGY
 ▷ DECISION_GATE
 ▷ Free-Text
```

The F.4 confirmation block looks like:

```
[F.4 Confirm Reset]
 ▶ Confirm reset to JUST_TALK (re-run with --confirm)
 ▷ Cancel
```

Both render with the 12-glyph approved vocabulary and 5-color contract (cyan for primary action, gray for alternatives). The user can either:

1. Re-invoke the command with the explicit verb (`/mos:operator set BUILD_ROOM` or `/mos:operator reset --confirm`), bypassing the marker block entirely.
2. Tell Larry conversationally ("set to METHODOLOGY", "yes, reset"). Larry interprets and re-invokes the command with the explicit verb.

## What's deferred to Phase 88.2

The canonical Shape F.1 / F.4 implementation per `skills/ui-system/SKILL.md` Section 2:

- AskUserQuestion primitive with up-arrow / down-arrow (or J / K) navigation
- Three-context strip below header (LOCAL / BRAIN / SIGNAL per Canon Part 3)
- RECOMMENDED marker (only at Brain confidence >= 0.7 per Phase 88.2 invariant)
- State-update hook on selection: append to STATE.md Decisions section + add typed edge `(navigator) -[CHOSE {operator}]-> (operator-state)` to local graph (Canon Part 4)
- F.4 collapse: 2-option binary confirm with stable keyboard shortcut + Esc to cancel

## Why deferred (not built in 99)

Per `docs/CANON-PHASE-MAP.md`, Phase 88.2 (`uiux-selector-block`) is the canonical Shape F implementer. Building Shape F inline in Phase 99 would:

1. Duplicate work that Phase 88.2 owns
2. Create a second F.1 implementation that Phase 88.2 must later supersede or migrate
3. Couple `/mos:operator` to a primitive (AskUserQuestion) that has not yet shipped its canonical wrapper

Same rationale as Phase 95.1-04's `/mos:doctor` F.1 deferral. The structural marker is a stepping stone. Phase 88.2 replaces it without changing `/mos:operator`'s contract -- the marker block is replaced by the AskUserQuestion call, the verbs (the 5 operators + Free-Text for set; Confirm + Cancel for reset) stay identical, the state-update hook lands.

## Re-trigger condition

When Phase 88.2 ships, replace the F.1 + F.4 marker blocks in `scripts/operator-command.cjs` (functions `renderShapeF1` and `renderShapeF4`) with the canonical AskUserQuestion calls. Update this file with the link to the 88.2 plan that did the work. Concrete tasks for the 88.2 follow-up:

1. Replace `renderShapeF1(state, room)` body with an AskUserQuestion call that yields the same 6-option slate (5 operators + Free-Text) but routes the user's selection through the canonical state-update hook.
2. Replace `renderShapeF4(state, room)` body with an AskUserQuestion call that yields the binary confirm/cancel slate.
3. Drop the `[F.1 Next Move]` and `[F.4 Confirm Reset]` literal marker strings from the renderer and from `commands/operator.md` examples.
4. Update `tests/test-operator-command.cjs` Test 3 (set picker) and Test 8 (reset confirm) to assert the AskUserQuestion contract instead of the marker-string scan.

## What about manual override path?

The `set <op>` and `reset --confirm` shell paths in `scripts/operator-command.cjs` are EXPLICIT-VERB paths. They bypass the F.1 / F.4 selector entirely and perform the transition directly via 99-01's `transition()`. These remain stable across the Phase 88.2 migration -- only the SELECTOR rendering moves to AskUserQuestion. The transition logic (`operator.cjs.transition`) is unchanged.

This means tests Test 4 (set BUILD_ROOM with explicit op), Test 5 (set NOT_REAL invalid), Test 6 (set current is no-op), Test 7 (set rejected by validate), Test 9 (reset --confirm), Test 11 (--json set) all stay GREEN through the Phase 88.2 migration without modification.

## References

- `skills/ui-system/SKILL.md` Section 2 (Shape F.1 + Shape F.4 canonical contracts)
- `docs/MINDRIAN-CANON.md` Part 3 (Tri-Context Decision Gate; the 10 verbs; the 5 sub-shapes)
- `references/personality/voice-dna.md` (Larry's conversational handling per D-19)
- `.planning/phases/99-conversation-operator-state-machine/99-CONTEXT.md` D-14, D-15
- `.planning/phases/95.1-mos-doctor-drift-detection-and-self-heal/f1-selector-deferred.md` (precedent)
- `docs/CANON-PHASE-MAP.md` (Phase 88.2 status row)
