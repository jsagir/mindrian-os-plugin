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
