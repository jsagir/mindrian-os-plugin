NEEDS_HUMAN: Will a person run the Windows and Desktop checks below and sign the real-room receipt (RULE 10) for the cut that carries the panel?

# Windows and Desktop checks for the M:OS face panel (plan 380-11)

Status of this sheet: written by an agent on 2026-10-24. The agent ran nothing on Windows and nothing on Desktop. Every number comes from the person who runs the sheet. A missing value is written "not given".

## Navigator rulings recorded (2026-10-24, source 380-11-NAVIGATOR-RULINGS.md)

- Gate 2 (Windows and Desktop checks): DEFERRED. The reason given: "terminal-only cut, Windows and Desktop observed after release." The statement "no panel on Desktop" stays ASSUMED.
- Gate 3 (real-room receipt): OPEN. A person reads the real-room report and signs the receipt at the cut. MOD380-06 stays incomplete until then.
- Cowork is not covered by this sheet. Nobody measured Cowork.

So this sheet is run after release, not before the cut. The cut does not wait for Check W or Check D.

## Before you start

For a person with a Windows machine and a checkout or install of the cut that carries the panel.

1. Write down the Windows version (run `winver`), the memory in GB, and the output of `node lib/core/repo-version.cjs` in the plugin folder.
2. Use a test room. Do not use a room with private content.
3. Do not send room content. Do not send a path with a user name. Replace a home path with HOME before you send.

## Check W: the panel on Windows (Claude Code CLI)

1. Open Claude Code in a folder with a bound test room.
2. Confirm the panel draws. You should see: the side panel titled /m:os, the badge "Theo | MindrianOS", and the NOW line. Write yes or no for each of the three.
3. Run /mos-text. Paste the line it prints (it starts `mos: /m:os state`).
4. Run /mos-words. Paste the line it prints.
5. Open Task Manager, Details tab. Start a new session. Write yes or no: did a python process (python.exe or python3.exe) start at session start? Run /mos-refresh. Write yes or no: did a python process start then?
6. Write the time from the start of the session until the prompt box is ready. Write yes or no: did any line say a hook timed out?
7. Set the variable MINDRIAN_ROOMS_HOME to a folder that holds a test room. Run /mos-refresh. Write which room the panel names. Then remove the variable, run /mos-refresh again and write which room the panel names.
8. Check the panel with USERPROFILE only. A native Windows process may not set HOME. Start a session in a shell where HOME is not set (in PowerShell: `Remove-Item Env:HOME -ErrorAction SilentlyContinue`, then start Claude Code in the same shell). Write yes or no: does the panel find the rooms folder and name the room?

## Check D: the panel on the cut's Desktop copy (observation only)

On Mac or Windows, open the cut's Desktop copy and start a session. Write one sentence: does anything of the panel appear? The engine lists desktop, vscode and mobile as surfaces a mod can mount on. The phase assumed nothing appears. This check is an observation. It is not a pass or a fail.

## Pass rules

- Check W: the panel draws and answers /mos-text on Windows.
- Check W: no python process starts at session start or at /mos-refresh.
- Check W: no hook is slower than its declared timeout, and no line says a hook timed out.
- Check W: with MINDRIAN_ROOMS_HOME set, the panel names the room of that folder. With USERPROFILE only, the panel still finds the rooms folder.
- Check D: an observation. Any answer is recorded as given.

A failed rule is recorded as a gap with the failing rule and the pasted line. No limit and no default changes because of this sheet.

## What to paste back

1. The lines from steps 3 and 4 of Check W.
2. The yes or no answers and the room names from Check W.
3. The one sentence of Check D.
4. The Windows version, the memory, and the version output of step 1 of "Before you start".
5. For any item you could not read, write "not read". Do not guess a number.

Do not send room content or a path with a user name.

## Rules for the agent that records the result

- Copy each pasted value exactly. Do not round, convert or infer. Write "not given" for a missing value.
- The agent measures nothing on Windows or Desktop.
- A result file is not the receipt. See the next section.

## At the cut

The real-room receipt is written only by `node scripts/real-room-run.cjs --read-by NAME`, run after a person reads the report (RULE 10, docs/RELEASE-CEREMONY-RULING-SYSTEM.md; the bullet "The face panel"). The flag `--desktop-verified mac` or `--desktop-verified win` records the Desktop leg. MOD380-06 is complete only after that receipt exists for the HEAD of the cut that carries the panel. Until then MOD380-06 stays open. This phase runs no cut, no push and no npm deprecate, and signs nothing.
