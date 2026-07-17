---
created: 2026-07-05T20:41:19.865Z
title: Fix Stop hook forcing irrelevant Decision Gate cards
area: tooling
files:
  - scripts/check-card-fire.cjs
relocated_from: /home/jsagi/.planning/todos/pending/2026-07-05-fix-stop-hook-forcing-irrelevant-decision-gate-cards.md (wrong repo -- mindrian-agno-backend, an unrelated project; the original file landed there because the authoring session had not yet `cd`'d into dev/MindrianOS-Plugin, the WORKSPACE GUARD's own documented failure class. Copied here 2026-07-17 as the canonical location, since Phase 230's CONTEXT.md/AI-SPEC.md/PLAN.md files already reference this exact path per CLAUDE.md's own QA/RCA convention. The /home/jsagi copy was left untouched -- not this session's call to delete content in a different repo.)
---

## Problem

The Stop hook `check-card-fire.cjs` (error id `reached-registry-gate-no-card`) hard-blocks
turn continuation whenever a REACH decision-gate system-reminder (routing_source: engine)
appears in a turn and no `AskUserQuestion` card was fired that turn -- with no relevance
check.

Reproduced live 2026-07-05: the reach fired was `rethinking-mindrianos` /
`governing_thought:solution-design`, while the actual conversation was the user asking
Larry to turn a pasted meeting transcript into intern homework. The gate's subject had
zero connection to the live conversation, but the hook forced Larry to surface the
irrelevant card anyway just to get unblocked, degrading the conversation.

This conflicts with the Larry agent's own instructions (Phase 210 softening): "the trigger
is judgment-gated, not unconditional ... when the gate's subject has zero connection to
the current conversation (a stale artifact), do NOT dispatch it: acknowledge and proceed
in prose instead." The mechanical Stop hook enforces the pre-Phase-210 always-dispatch
rule, overriding the model's judgment.

Same regression class already flagged in memory note
`feedback_1_15_enforcement_regression_watch.md`: "Larry feels less like Larry since
v1.15.beta.x -- hard-fail compliance checks may have replaced judgment calls (Phases
178/182/192/202/205/209). Log instances before fixing." This todo is that logged instance.

### Second instance (2026-07-11) -- different check, same failure class

`check-card-fire.cjs` has more than one hard-fail path. A second one, error id
`ascii-box-backstop-no-card`, fired on a Larry turn (Brain-ingestion conversation) that
ended with a plain prose closing question ("Want me to check that instead?"). The turn
had NOT rendered an ASCII box at all -- no `■ ... [1] [2] [3]` picture, just an ordinary
conversational question in running text.

The hook's feedback text claims: "This turn REACHED a Decision Gate but did NOT fire the
interactive card... Do NOT render a flat ASCII box." But no box was rendered, so the
backstop's stated purpose (SEED-021: kill silent ASCII-box degrade) doesn't match what it
actually fired on here. It reads as pattern-matching on "turn ends in a question" broadly,
which will false-positive on ordinary conversational turns that never degraded to a box in
the first place -- a second, independent over-enforcement path in the same script,
alongside the `reached-registry-gate-no-card` one already logged above.

Per this todo's own instruction below (do not silently auto-fix), this is capture only.

## Solution

TBD -- options to weigh when this gets picked up:
1. Teach `check-card-fire.cjs` the same relevance/staleness check the system prompt grants
   the model (e.g. compare the reach's room/topic against the active room binding before
   requiring a card), OR
2. Give the model a documented "acknowledge and skip" escape hatch (a specific phrase or
   marker) that satisfies the hook without forcing a card fire, for gates it has judged
   irrelevant.
Do not silently auto-fix -- this file is the capture step per the watch note's own
instruction; a human should decide the approach before code changes land.

Whichever approach is picked should cover BOTH check functions in `check-card-fire.cjs`
(`reached-registry-gate-no-card` and `ascii-box-backstop-no-card`) -- they're two
independent hard-fail paths in the same script exhibiting the same root cause.

### Third instance (2026-07-17) -- same `ascii-box-backstop-no-card` path, plain prose again

Fired on a Larry turn (Windows-update-verification testing-prompt conversation, room-bind
handoff) that ended: "Now paste the rest -- steps 5 through 9, including the Phase 227
section. I'll hold the review until it's all in front of me rather than half-grading it."
Not a question, not an ASCII box, not even a binary framing -- a plain declarative request.
The hook's `reason` surfaced as the CR-06 calm phrase ("rendering your choices as a
selectable card") rather than the raw slug, confirming Finding 1 (message-leak) stays
fixed; the diagnostic log presumably still captured `ascii-box-backstop-no-card`
internally. But the false-positive itself (Finding 2 / this todo's core problem) is
unchanged: the backstop is still pattern-matching on "turn ends in prose that isn't a
Larry-signed acknowledgment," not on "turn actually rendered a box of choices." Three
confirmed live instances now, zero fix attempts -- still capture-only per this file's own
instruction.
