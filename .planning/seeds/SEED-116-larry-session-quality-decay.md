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
