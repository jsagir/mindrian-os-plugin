# Phase 100-04: Shape F.1 Selector Deferral Note

**Authored:** 2026-05-01 during Phase 100-04 execution.
**Status:** Active deferral; canonical implementation tracked under Phase 88.2 (`uiux-selector-block`).
**Mirrors:** Phase 99-05's `operator-shape-f1-deferred.md`; Phase 95.1-04 D-19 deferral pattern.

---

## What was deferred

The canonical implementation of Shape F.1 (Next Move) for `/mos:jtbd set` (no-arg). The "canonical" form per `skills/ui-system/SKILL.md` §2 is the AskUserQuestion primitive: a true interactive selector with up-arrow / down-arrow keyboard navigation, Enter to select, `?` to inspect, Esc to cancel, and the RECOMMENDED marker conditional on Brain confidence >= 0.7 (Phase 88.2 invariant).

Phase 100-04 ships the **structural marker block** form instead -- a stdout block that:

- Carries the Zone 1 header (`-- {slug} -- jtbd -- set --`)
- Carries the F.1 marker label (`[F.1 Next Move]`)
- Lists 12 first-class JTBDs as rows (each prefixed with `right-triangle-filled` (primary) or `right-triangle-empty` (alternative))
- Marks the current JTBD with `(current)` so the user is not nudged to no-op
- Lists `Free-Text` as the always-last row (Shape F invariant per SKILL.md §2)
- Carries a Zone 4 action footer

Larry handles the conversational selection: when the user types natural language ("set to find-bottleneck", "let's pitch", "what's the second one?"), Larry interprets and re-invokes the command with the explicit id (e.g., `/mos:jtbd set find-bottleneck`). The structural marker block is the contract Larry reads to know what the legal selections are.

## Why this is correct (not a hack)

This is the documented Phase 95.1-04 D-19 pattern, applied identically to:

- Phase 95.1's `/mos:doctor` (Shape F.1 for `--fix` decision)
- Phase 99-05's `/mos:operator set` (Shape F.1 for operator picker)
- Phase 99-05's `/mos:operator reset` (Shape F.4 for confirmation)

In each case, the stdout block IS the F.x contract; the canonical AskUserQuestion implementation lands in Phase 88.2 as a single coordinated rollout across every command that uses Shape F. Building bespoke AskUserQuestion plumbing per command would duplicate the keyboard-handling logic 5+ times and create maintenance drift between commands.

By deferring uniformly, we get a single canonical implementation in 88.2 that retrofits all callers (operator, doctor, jtbd, and any command added between now and 88.2) in one commit.

## Re-trigger condition

When Phase 88.2 lands the AskUserQuestion canonical primitive:

1. Replace `renderShapeF1Set()` in `scripts/jtbd-command.cjs` with a call to the canonical `lib/render/ask-user-question.cjs` (or whatever Phase 88.2 names the API).
2. Update `tests/test-jtbd-ui-self-compliant.cjs` Test 8 to assert the new canonical contract (keyboard hooks, RECOMMENDED marker conditional on Brain confidence).
3. Update `commands/jtbd.md` "Note on Shape F.1 deferral" section to point at the now-shipped canonical implementation rather than this deferral note.
4. Delete this file.

The trigger is **Phase 88.2 ships, not before**. Phase 100-04 must NOT block on 88.2; the structural marker block is the working contract until then.

## What 100-04 does NOT defer

- **F.1 row vocabulary:** The 12 first-class JTBDs + Free-Text are already in the marker block. Phase 88.2 does NOT change the vocabulary; it only changes the rendering surface.
- **State writes on selection:** When the user picks via Larry's interpretation (e.g., `/mos:jtbd set find-bottleneck`), the state write happens via `lib/hmi/jtbd-state.cjs.setCurrent` with `manual: true`. This is the same write path the canonical AskUserQuestion will trigger; only the *front-end UI* differs.
- **Zone 1 + Zone 4 compliance:** Both zones are present in the marker block and the canonical form will preserve them. Phase 95.1 class F detector validates this contract identically against both forms.

## Cross-references

- Phase 95.1-04 D-19 (the deferral pattern itself).
- Phase 99-05's `operator-shape-f1-deferred.md` (sibling deferral).
- `skills/ui-system/SKILL.md` §2 Shape F.1 contract (the canonical spec).
- `commands/jtbd.md` Note on Shape F.1 deferral section.
- `scripts/jtbd-command.cjs` `renderShapeF1Set()` function (the deferred implementation).
- `tests/test-jtbd-ui-self-compliant.cjs` Test 8 (asserts the deferred contract still satisfies the F.1 invariants -- Free-Text last, 12 jobs visible, F.1 marker block present).
