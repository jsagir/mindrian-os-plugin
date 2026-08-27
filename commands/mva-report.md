---
description: Emit a clean structured conversation-flow report of the session so far (not a transcript)
help_jtbd: "Get a clean, forwardable report of how this conversation actually flowed."
body_shape: E
hitl_shape: "none"
hitl_why: "A read-only conversation-flow report that emits a structured artifact and takes no navigator decision, so it reaches no genuine fork."
# Phase 267.3-07, ruled in 267.3-CLASSIFICATION.md (Row 1): first delivery at commands/mva-report.md:34, Larry's judged read-back of the conversation (frames, per-turn moves, conclusion-or-circled verdict), not a rendered transcript.
interactive_first_reward: methodology_reframe
argument-hint: "(no args -- reads the conversation you just had)"
serves_jtbd: ["audit-room"]
teaching: "When you have finished a conversation with Larry and want to see whether it fired the right things at the right time -- did it reach a conclusion or circle, did it elevate across frames, did the gates fire -- run /mos:mva-report. It emits a clean structured report you can forward, not a chat log. The tester-cohort report surface (2026-07-01 standup promise)."
disable-model-invocation: false
allowed-tools: []
# --- Phase 172-06 CIRS R1 exclude (Canon Part 11) ---
connector:
  excluded: true
  reason: "Conversational extraction surface. Reads the session that already happened and emits a structured artifact; it fires no reach, opens no Brain wire, and writes nothing to the graph. LOCAL-only by construction (Part 8). Sibling to the tester-facing docs/testers/REPORT-PROMPT.md paste block."
---

# /mos:mva-report

Emit a clean, structured report of the conversation you just had -- so you (or
Jonathan, from the tester cohort) can see whether it fired the right things at the
right time: did it reach a conclusion or circle, did it connect across frames, did
the Shape-F gates fire when they should have.

This is an ARTIFACT, not a transcript (SEED-046 discipline). Do NOT reproduce
"Larry said X, you said Y" banter. Produce a deliverable a person can forward.

## What Larry does

Read back over THIS conversation and emit the report below verbatim in structure.
Where something is unknown, write a placeholder `TBD: <what is missing>` -- never
guess, never pad. Keep it tight; this is a receipt, not an essay.

### Report structure (emit exactly these sections)

```
# Conversation-flow report

## 1. Frames / topics that were live
- <frame or topic>  (one line each; the distinct problem-frames the talk moved through)
- TBD: <if a frame was implied but never named>

## 2. Per-material-turn moves
For each material Larry turn (skip pure acknowledgements), one row:
| turn | move (ask / tell / grill / reframe / elevate) | Shape-F gate fired? (which) | one-line gist |
|------|-----------------------------------------------|-----------------------------|---------------|
| 1    | reframe                                       | F.1 starting gate           | ...           |

## 3. Conclusion or circle
- Verdict: reached-a-conclusion | circled | still-open
- If reached: state the conclusion in one line. Did Larry LEAD you there, or did you already have it?
- If circled: name the loop (what kept repeating).

## 4. Cross-frame connection
- Offered: yes / no
- If yes: state it in one line, and whether it was HEDGED ("these MIGHT be the same argument")
  or stated with confidence. (Hedged is correct; confident is a tone slip.)
- Missed: TBD: <a connection across the live frames that was there but never offered>

## 5. Open questions (placeholders)
- TBD: <the decisions still unresolved, one per line>
```

## Notes for the tester (why this exists)

Jonathan promised the cohort a prompt that extracts a report from the conversation
so he can see "did it trigger and fire the right things at the right time... the
quality of the conversation flow... if we have the workflow figured out." This is
that prompt. Send the emitted report back. It is LOCAL only -- it runs on your own
machine, reads only the conversation you just had, and sends nothing anywhere.

Provenance: `.planning/briefs/tester-conversation-flow-report-BRIEF.md`;
cohort standup `docs/testers/weekly-cohort/2026-07-01-standup.md`. Lab-side scorer
that grades a returned transcript: `lab/eval/report-from-transcript.cjs`.
