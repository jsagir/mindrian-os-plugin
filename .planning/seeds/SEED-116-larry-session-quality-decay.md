---
id: SEED-116
title: "Larry decays over a long session: framework dumps return, em-dashes return, the Stop trailer leaks a session summary into every turn"
status: seeded
priority: high
filed: 2026-10-04
source: navigator paste of a live session, 2026-10-04 ("started well but then decayed in quality")
promotes_to: a quick or a short phase after 369.2; the detector half may ride the existing voice-mark and dash guards
---

# SEED-116: Larry session quality decay

## What the transcript shows

- Turn 1 ("what's new in version 55"): correct, sourced, in voice.
- Turn 2 ("breakthrough ideas, which commands"): a framework dump. Seven numbered categories, fifteen commands, one line each. The Cardinal Sin in the agent body ("NEVER dump frameworks") broken on a direct question that invited it; the right answer was two or three commands in sequence with the reframe, and the list offered as a filed artifact.
- Turn 2 also carries real em-dashes ("an act of assembly — existing elements"), against the hyphen-only rule that every other turn kept.
- Turns 3 and 4 (the idea, the research plan): strong, sourced, honest about memory; length grows (46 s, 1 m 14 s, 1 m 8 s of generation) while the question stayed the same size.
- Every turn ends with a "Stop says: session snapshot saved, 7 sections scanned, 7 regen pending, health low | SESSION SUMMARY: ... | <the first 120 characters of the reply repeated>" line. That is the Stop hook's business close-out leaking its internal summary into the chat, plus a repeat of the reply. One quiet line at most, or nothing, is the contract (Canon Part 10: conversation is the product).
- "health low" is shown on every turn with no path to act on it.

## Direction

1. A session-level guard on the framework-dump pattern: more than N `/mos:` commands in one reply outside an explicit "list the commands" request is a dump; the reply offers a filed artifact instead. Reuse the existing voice-mark detector (`lib/hmi/voice-color-mark.cjs`) and the dash guard as the detection seam.
2. The Stop hook's chat output is capped to one line, never repeats the reply, and never prints "health low" without the one command that raises it.
3. Measure before fixing: the paste is one session; the decay should be measured on three recorded sessions before a fix claims to have removed it.

## Addendum 2026-10-04 (navigator, verbatim: "i want you to notice the way mindrianOS interacts not as larry !!!")

Beyond turn-level decay, the product's own surfaces speak as machinery, in the chat, between
Larry's lines. Seen in the same transcripts and in this session's own start:
- "Called plugin:mos:mindrian-os 12 times, ran 31 shell commands" for one room creation, because
  the MCP `rooms-new` (and `new-project`, `setup`, `update`) return INSTRUCTIONS for the model to
  carry out by hand instead of doing the thing or refusing. A tool that hands back a recipe makes
  the agent narrate the recipe.
- "Stop says: session snapshot saved, 7 sections scanned, 7 regen pending, health low | SESSION
  SUMMARY ..." after every turn, plus the reply's first line repeated.
- Session-start banners in the host voice: "MindrianOS release drift -- ... Push: cd ... && git
  push", "First-session check: Look at the bottom of your terminal ...", "What are you trying to
  do here? Use /mos:jtbd set <id>", a failed-connector notice selling an upgrade (SEED-119).
- "SendFeedback(...)" bug dialogs and "Interrupted - What should Claude do instead?" are the host;
  fine. But everything the PLUGIN prints is either Larry (glyph first, in voice, one line) or
  silent. Canon Part 10 (conversation is the product) and Part 12 (the glyph exists so the user can
  SEE who is talking) already say this; the hooks and the instruction-returning tools do not obey it.

Direction added: an inventory of every line the plugin can print into the chat (hooks, Stop
close-out, tool results that are prose, session-start notices), each either moved under Larry's
voice contract (glyph, one line, an action) or made silent; the instruction-returning MCP tools
either execute through the CLI command they describe or refuse with one reason.

## Addendum 2 (navigator, verbatim: "th l1 l2 l3 is a non JTBD way of inteacting, somtbim mindrian shoud be an experit in coveying the stratigic way to inteact with a user. not a tecnial way nobody undesatands")

The research planner talks to the user in its own identifiers: leaves L1, L3, L7, L9; lanes A to D;
K1 "has candidates"; run ids `rp-2026-10-04-32664e65`; shape codes F.6 and F.8; step names
`dispatch_lanes`; verdict codes `term_not_composed`, `grant_scope_cannot_cover_plan`, `wrong_step`,
`thin`. None of that is a job the user is trying to get done. The same session report that filed
twelve defects was itself written in that register, and the navigator's own review standard for
anything that reaches a reader (short, executive summary first, only taught terms, no internal
names) is already a HARD RULE for Lawrence-facing writing. It applies to Larry's turns.

The rule for the fix: every line Larry says about a run names the JOB and the MOVE, never the id.
"The two walls this plan exists to test were not searched" is the sentence; "L7 and L9 untouched,
cap 3 spent on lanes A and B" is the filed artifact. Ids, codes and lane letters live in the
room's filed record and in the audit ledger, where a reader who needs them goes on purpose. The
JTBD layer (the room's active job, already carried on the release envelope since 366 D-13) is what
the turn is phrased against: what you were trying to settle, what moved, what did not, and the one
next move. Phase 369.2 owns this for the research planner's cards and answer lines; SEED-116 owns
it for every other surface.

## Addendum 3 (2026-10-05): the calibration half, from the developer annex

`.planning/phases/369.2-research-searches-online-for-real/369.2-LARRY-ANNEX.md` (filed verbatim)
adds the half of this seed that is not voice but CALIBRATION: Larry presents an interpretation
with more certainty than the evidence or the executed tools justify (twenty claims C01-C20, four
attitude items A01-A04). The mechanism it names: a plausible frame becomes a premise; incomplete
execution hands back clean-looking returns; the assistant reads them too strongly; the stronger
claim changes a plan or enters an artifact; the correction arrives after the premise already did
its damage. The agent body's Sourced Claims section gains a Calibration section from annex
section 6: hypotheses before research are stated as hypotheses; "every", "only", "proven",
"confirmed", "kills", "decisive" require a cited executed operation or canonical state; an empty
query is "these executed queries returned no records", never corpus absence; a capability is
promised only from a preflight result, never from a label; internal convergence is consistency,
not independent support; a changed objective is a new hypothesis, not a stronger solution; a
correction repairs the artifact, records the rule and is checked on the next output, it never ends
in an apology. Annex section 5 is the fixture list. The annex itself says what tone cannot fix:
provider mappings, dispatch, state transitions, persistence (the brief's Phase 0 and 1 come first).
