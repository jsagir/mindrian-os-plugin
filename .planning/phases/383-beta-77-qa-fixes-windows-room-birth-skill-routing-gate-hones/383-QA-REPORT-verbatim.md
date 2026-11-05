# 383-QA-REPORT: the owner's account, as given

**Status:** This is NOT the full QA report. The full report text was not supplied to the repo as of 2026-11-05. This file carries the owner's own words exactly as given in two messages on 2026-11-05 (the phase request and a follow-up summary). When the full report lands, paste it below the line "## Full report" and keep these two sections unchanged.

Two findings stay blocked on the full report: QA383-08 (which number was unsourced) and the folder name for QA383-10 (the research found a strong candidate: the doubled-path junk tree that room-registry seeds on every birth).

## Message 1: the phase request (2026-11-05)

> Cover ten findings from the owner's beta.77 QA report. P0: room creation fails on Windows (bash resolves to the WSL launcher, python3 to the Store stub; the bash calls are at room-birth.cjs lines 1439 and 1447, room-auto-create.cjs 240, graph-backfill.cjs 446; see also open SEED-142). P1: no /mos command fired in 19 turns, and no context_assemble or memory_event. P2: the card shows before the environment check, no card at a real fork, and a raw error shown to a beginner. P3: card copy in the third person, one unsourced number, over-long replies, and a folder written without a card. Mark every claim "reported, not yet reproduced". Waves: 1 Windows resolution and the preview check, 2 why no skills fired, 3 card, voice and write fixes, 4 a retest on your Windows machine.

## Message 2: the owner's summary of the report (2026-11-05)

> It covers a test of beta.77 where a pretend first-time user, a physicist on a Windows laptop, talked to Larry for 19 turns. The talk went well. But some things around it broke.
>
> The two big problems:
> 1. A Windows user cannot create a room. The code runs a script through bash. On that laptop, bash points to a different program, and the file path loses its backslashes. Python was also not found. So the room is never made, and Larry has no memory and no room features. A real Windows user is stuck on day one. I checked the code: the risky bash calls exist at the lines the report names. I have not reproduced the failure.
> 2. No /mos command ran in 19 turns. The user's words matched several commands exactly. One example was "I know what I want, I need the how", which is the trigger for the new roadmap command. Larry answered by hand each time, so nothing was filed. The report's guess is that this happens when no room exists. That guess is not verified.
>
> The smaller ones:
> - The approval card appeared before the machine could do the job, so the user approved a room that was then undone.
> - Larry showed a raw error with a file path to a beginner.
> - A decision card did not appear at a real fork.
> - Card wording talked about the user in the third person.
> - One number was stated without a source.
> - Some replies ran 15 to 25 sentences.
> - A folder was created without asking.
>
> What the phase would do:
> - Fix the Windows room creation first. Chec appears.
> - Find out why no commands fired.
> - Fix the card, voice, and write-permission
> - You retest on your Windows machine, because I can't run Windows here.

## Full report

(not yet supplied)
