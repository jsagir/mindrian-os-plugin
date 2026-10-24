---
phase: 380-ship-the-m-os-face-panel-mod-inside-the-plugin-target-beta-7
plan: 15
subsystem: ui-mod-status-parity
tags: [mos-face, status-line, parity, local-only, budget, capture-harness, D-08, MOD380-07]
requires: [380-14]
provides:
  - ui/mos-face/hooks/status.ts (STATUS_FIELDS, EXCLUDED, readStatusLocal, pure formatters, roomFacts, pluginFacts)
  - the panel rows ROOM, FILED, STALE, HEALTH, NEXT MOVE, THEO, SPEAKS, STANCE, MODE, VERSION and the NOW corrective for a pending restart
  - tests/test-380-status-parity.cjs (field list from the status line code, real status line on a fixture home)
  - ui/mos-face/tests/status.test.tsx (28 tests) and budget test B9
  - capture-shots.cjs --session-home and the fixture builder in scripts/lib/tmux-session.cjs
affects: [380-10, 380-11]
requirements-completed: [MOD380-07]
completed: 2026-10-23
---

# Phase 380 Plan 15: Status parity (D-08) - Summary

The panel now carries every field the plugin status line can print, plus the room and filing facts, from the status line's own local files. A node test builds the field list from the status line's own code and fails when a field is not mapped. One tick adds 8 small local file reads and nothing else.

Code tree: `/home/jsagi/dev/MindrianOS-Plugin-release`, branch `main`. Nothing pushed. No branch created or switched. `git rev-list --count origin/main..main` is 38 (35 before, plus the 3 below). The 35 earlier commits are untouched. `/home/jsagi/mos-brand` unchanged (read only; canon cited as e947a5d).

## INCIDENT (read first): a mutation run wrote fixture files into the real home folder

Found during the harness mutation run, after Task 3. Root cause (PROVEN): I made a scratch copy of the harness to prove that test P11b catches a removed guard. The mutation removed the guard in `writeStatusFiles` that refuses the real home. P11b (as first written) then called `writeStatusFiles({ homeDir: os.homedir() })` on purpose, so with the guard gone it wrote the fixture into the real home folder. The product code was not wrong: the guard works (the mutation run showed P11b failing, which is how the write was found). The test was wrong: a test that passes the real home as an argument is a hazard when its own guard regresses.

What was written at 21:45:00 (EEST): `~/.mindrian/install-state.json`, `next-move.json`, `room-health.json`, `stance-state.json`, `voice-mark.json`, `update-check.json`, `bridge/brain-health.json`, and a new folder `~/MindrianRooms/demo-room/.mindrian/` with `conversation-operator.json`, `jtbd-state.json`, `minto-stale.json`.

Repaired by me:
- `install-state.json` was a real file (session-start writes it). I regenerated it by running the exact record code of `scripts/session-start` (lines 222 to 354) with the active plugin root (`2.0.0-beta.73`), reading a copy of `~/.mindrian-last-version` so the real one was not touched. The record has all its fields again. Lost for good: `last_acceptance_run` (now null) and `renderer_contract_version` (now "unknown"); `/mos:doctor --acceptance` or the next session start refills them. The pre-incident bytes could not be recovered (not in git, no backup).
- `next-move.json` is gone: a running session's router cleared it (the router deletes it when it abstains). That is the normal state.
- The test P11b is rewritten: the "real home" is now a scratch folder given to a child process through HOME, so a failed guard can only write into scratch.

NOT repaired (the permission system denied my delete commands, so I stopped; I did not work around it). These files are still in the real home and change what the person's own status line and plugin read:
- `~/.mindrian/stance-state.json` = `{"stance":"redteam",...}` (the status line shows a [redteam] chip). `/mos:stance` was never used in `~/.claude/history.jsonl`, so the file almost certainly did not exist before.
- `~/.mindrian/update-check.json` = update 9.9.9 available. No writer for this path exists in the repository, so it almost certainly did not exist before.
- `~/.mindrian/voice-mark.json` = `{"color":"blue","current_who":"larry"}`. No writer exists, so it did not exist before.
- `~/.mindrian/bridge/brain-health.json` = `{"status":"ok"}`. No writer exists (the status line only reads it).
- `~/.mindrian/room-health.json` = sound. A writer exists (room_bind); the value equals the default.
- `~/MindrianRooms/demo-room/` with only the `.mindrian` folder and the 3 files. The folder did not exist before (it holds nothing else and its time stamp is the incident).
Safe cleanup, by the person or the main session: delete exactly those files, then `rmdir` the two empty folders. Do this before the next real status line read matters to the person.

## Commits (release tree)

| Step | Commit | Subject |
|------|--------|---------|
| Task 1 | c520e5aa6 | test(380-15): RED parity tests, every status line field maps to a panel field, local sources only (D-08) |
| Task 2 | 9b93ee61f | feat(380-15): the panel carries every status line field and the room and filing facts from the same local files (D-08) |
| Task 3 | f36ffbbb6 | feat(380-15): capture harness session home, README status parity map (D-08) |

## RED list (c520e5aa6, PROVEN)

Per-file runs (the full parallel run times out under load on this machine): 153 original tests pass (34 panel, 119 others); new failures: B9 (the 8 status files are not read), and `tests/status.test.tsx` fails to load ("cannot import ../hooks/status"). `node tests/test-380-status-parity.cjs` in RED: P3 passes alone (the real status line on a fixture home), P11 passes, P1 fails only on the missing `hooks/status.ts`.

## GREEN run (PROVEN)

| Command | Result |
|---------|--------|
| each test file alone through `claude plugin test` in a scratch copy | 182 pass, 0 fail (34 panel, 119 earlier, 28 status, B9 in budget 11) |
| `claude plugin test .` whole, 3 runs under load (load average 13 to 18) | 178 pass 2 fail (C1 timed out at 5004 ms, load only), then 179 and 179, 0 fail (before P16 was added) |
| `node tests/test-380-status-parity.cjs` | 46 passed, 0 failed |
| `node tests/test-380-budget.cjs` | 11 passed (G3: env reads unchanged) |
| `node tests/test-380-copy.cjs` | 37 passed |
| `node tests/test-380-shots-harness.cjs` | 24 passed (P11 to P11d, S2 new) |
| `node ui/mos-face/scripts/typecheck.cjs` | exit 0 |
| `bash tests/run-all-380.sh` | PASSED=15 FAILED=0 SKIPPED=3 (the same 3 skips as plan 14: build, installed layout, gate wiring) |
| `panel.test.tsx` declarations | 34 |
| `claude plugin validate --json ui/mos-face` | hooks line unchanged (24 entries); fs.read gains one caller (readStatusLocal); no new tool, http, process, timer or env read |

Mutations (scratch copies, no git checkout), each caught: health row dropped (P4 x3, P6, P7, P8); health word made up when unread (P6, P15, formatters); routed move ignored (P4, P7, P11, P12); band 50 to 60 (P9); stance row hidden (P4, P7, P8, P11); a read in turn.start (B2, B9); a second read of one file (B9); NOW says the word drift (P7); a name of the persona in the voice words (P4 x3, P11, P12, P13); a fetch of a status value (B3, B9, P14); node side: a new rowState field, a new collectSignals key, a map entry dropped, an exclusion with a short reason, an exclusion for a field that is gone, a label over 14 characters, a new printed segment (each fails P1, P2 or P3 with the name). Harness: guard removed (P11b fails; this is the run that caused the incident above).

## The real status line on the fixture home (scrubbed, PROVEN)

Home built by `buildStatusFixture` (formats the plugin's own readers accept; P11 reads them back with the plugin's own readers). Stdin `used_percentage`:

```
A healthy, 62:   ⬡ 🟦 · [redteam] · 📂 demo-room ✅ · 🧠on · Next: map unknowns · 📊 ██████░░░░ 62% · 🟠 save soon · 🎯 find-bottleneck · ⚙️ BUILD_ROOM · v2.0.0-beta.74
B drift+restart: ⬡ 📂 demo-room ⚠ · -> run /mos:doctor --fix · 📊 ██████░░░░ 62% · 🟠 save soon · 🎯 find-bottleneck · ⚙️ BUILD_ROOM · v2.0.0-beta.74
C cliff, 85:     🔴 file this insight to the room before it compacts · 📊 █████████░ 85% · 📂 demo-room · 🎯 find-bottleneck · ⚙️ BUILD_ROOM · v2.0.0-beta.74
```

Root cause of a plan note (the plan said one run with drift would hold Next and the Theo chip): at drift, a pending restart or the cliff the status line REPLACES Next, the Theo chip and the stance chip with one fix. So P3 runs three lines. The panel keeps all of them in every state, so it shows more than the line does in B and C. The status line never prints an available update in this line (only the old two-row fallback does); the panel does.

## The field map

Built from the code: 13 `collectSignals` keys, 13 `rowState` keys, 5 segment names (3 printed: jtbdSeg, operatorSeg, verSuffix; mintoSeg and dialSeg are built into `roomInfo`, which is never written, so dormant and not fields; P1 checks that), and `focus_segment` of statusline-mos.

| Status line field | Source | Panel field | Wide label | Narrow label |
|-------------------|--------|-------------|------------|--------------|
| room, stage | STATE.md of the room read | ROOM | ROOM | ROOM |
| section | STATE.md sections table | FILED | FILED | FILED |
| health | ~/.mindrian/room-health.json | HEALTH | HEALTH | HEALTH |
| post_update | ~/.mindrian/post-update-restart-pending | NOW (restart pending, /mos:doctor --fix) | NOW | NOW |
| ctx_pct | host usage | Context (ok, watch, cliff + text bar) | Context | CTX |
| next_move | ~/.mindrian/next-move.json, then job | NEXT MOVE | NEXT MOVE | MOVE |
| brain | ~/.mindrian/bridge/brain-health.json, then reach | THEO | THEO | THEO |
| voice_glyph, who, agent_label, voice_switched, switch_direction | ~/.mindrian/voice-mark.json | SPEAKS | SPEAKS | VOICE |
| stance, stance_forced_color | ~/.mindrian/stance-state.json | STANCE | STANCE | STANCE |
| jtbd | room jtbd-state.json (plan 14 block) | JOB | JOB | JOB |
| operator | room conversation-operator.json | MODE | MODE | MODE |
| version, update_available | install-state.json, update-check.json | VERSION | VERSION | VER |

Panel-only: STALE (stale reasoning sections), WRITES TO (plan 5). Excluded, each with its checked reason:
- focus: dormant (P11: the wrapper needs a bash variable `session_id`; no script in scripts/ sets it). Re-verified in this plan.
- governing_thought: SECOND EXCLUSION, not in the plan. Found when the field list was built from the code (it is `rowState.governing_thought`). It is the last leg of Next and needs the active section's reasoning file, a second read tree that would pass the budget of 8 reads.
- agent_label is mapped but cannot be read by a mod (host stdin); SPEAKS uses the voice file's own `who`. Recorded in the map source.

Voice words call the persona Theo (D-04, D-07): no panel string names Larry. The voice file's persona name is never compared as a literal; any name that is not `claude` is the persona.

## Read count per tick (B9, PROVEN)

Before this plan, one tick: 2 file reads (stale list, job file), 4 tool reads, 0 fetch, 0 process. After: 10 file reads = the 2 old + 8 new (next-move, brain-health, post-update flag, voice-mark, stance-state, update-check, room-health, and the room's operator file), each exactly once, started together under one cut-off of 4 seconds. Tool reads still 4, fetches 0, processes 0. prompt.submit and turn.start: 0 reads, 0 calls. No new timer (B8 passes). B1 to B9 all pass.

## Panel height at the three widths (for plan 380-10)

Computed from the draw tree with each text's wrap counted. The computation matched the real capture at 46 columns row for row (JOB heading on row 33 of the real screen). It is an estimate (about 2 rows either way) for 56 and 35 columns; the real dock is 46 columns wide. Plan 14 said the Job line is 5 to 6 rows in the worst case; at these widths its sentence is 3, 4 and 3 rows.

| Panel width | Rows, every optional row set | Rows, no optional row set |
|-------------|------------------------------|---------------------------|
| 56 (wide, tile 12) | about 52 | about 47 |
| 44 (standard, tile 8) | about 54 | about 48 |
| 35 (narrow, words and text bar) | about 50 | about 44 |

This plan adds 5 to 10 rows. On a 40 row terminal the first screen ends at the JOB heading, so THEO, SPEAKS, STANCE, MODE and VERSION sit below the fold. Plan 10 should judge that, and the canon order that puts them after JOB.

## Real-terminal evidence (PROVEN, my own look)

Two scratch runs of `capture-shots.cjs --session-home --keys /mos-state` (wide 120x40, std 80x24, nocolor) with PNGs opened and read: in the wide PNG the panel shows `ROOM demo-room, Discovery stage`, `FILED 3 entries in 2 sections`, `STALE market-analysis`, `HEALTH sound`, `NOW Theo is not answering its health check` with its Fix button, `NEXT MOVE map unknowns (routed)`, and the Job heading; the labels are bold. The std 80x24 PNG shows only the short overlay (face and "Context: waiting"; the panel needs height). NOW says Theo is not answering because the fixture has no Theo host record (no outbound Theo call is made in a capture); that is the panel's existing rule for an unknown host. The shots are in the scratchpad, not in the phase folder: plan 10 makes the formal set. The run without `--keys` showed the dashboard closed (the band above the prompt only), as before this plan.

## Edits to existing tests and gates (all listed)

- `ui/mos-face/tests/budget.test.ts`: one test added (B9), no existing test changed.
- `ui/mos-face/tests/support.ts` (plan 04 helper): one additive option, `percent` (default 62; null gives no usage yet), used by P6 and P9.
- `tests/test-380-copy.cjs`: two entries added to ALLOWED for the file name of the Theo health file in status.ts (`~/.mindrian/bridge/brain-health.json`, `/bridge/brain-health.json`). It is not in the plan file list (Rule 3: the copy gate reads the file name as the word Brain, the same case as probe.ts).
- `tests/run-all-380.sh`: one run_if leg appended (the plan's controlled exception).
- `tests/test-380-shots-harness.cjs`: legs P11, P11b, P11c, P11d, S2 added; no existing leg changed.
- `ui/mos-face/hooks/lines.ts`: PaneInput gets optional `local` and `jobId`; `nowLine` gets three branches (pending restart first; Theo error file joins the not-answering branch; a room check problem); `stateText` prints the new lines. Behavior without `local` is unchanged (the existing tests pass untouched).
- `ui/mos-face/hooks/register.tsx`: the Context row is now `Context N% - ok|watch|cliff...` (the old three words room to think, filling up, nearly full are gone; `contextWord` in meter.ts is now unused, left in place because meter.ts is not in the plan file list); the compact button moved to its own row (a long cliff sentence would squeeze it); the soft "reading X" text beside Bind a room is replaced by the ROOM row (which also says when the room read is not the room bound).
- No test of `panel.test.tsx` was edited; it still declares 34.

## Deviations from Plan

**1. [Plan wording] P8 order: Context stays at the top.** The plan lists context with the plugin facts. The canon width ladder puts the face tile and the context canvas first, and a colored plane always carries its words beside it, so the Context row stays under its canvas. Test P8 pins this. For the navigator in plan 11.

**2. [Rule 1 - plan wording] P3 asserted the Next move and the Theo chip on a drifting room.** The real status line drops them at drift (see above). P3 now runs three states.

**3. [Rule 2 - correctness] Second exclusion (governing_thought).** See the map.

**4. [Rule 3] Test declaration count.** The engine wrapper counts `test(` declarations at line start; my first P4 and P13 were loops (179 passes against 174 declarations, so the wrapper failed). Each is declared one by one now (28 declarations, 28 tests).

**5. [Rule 3] copy gate file names**, **6. support.ts option**: see the edit list.

**7. [Design] Facts that appear only when set.** STANCE, MODE, SPEAKS and the restart line are absent when the file is absent or holds the default, as on the status line (absence of a touch file or of an override is its false value, not an unread file). P6 pins that the always-shown fields say "not read"/"none yet". THEO with no Theo health file uses the reach check, and says "not read" when that has no answer.

**8. [Rule 4 avoided] Row labels in bold.** Not in the plan; a visual hierarchy fix after I read the PNG (label bold, value plain). No new color.

## Known Stubs

None. `contextWord` in meter.ts is dead code (kept, see above).

## Threat Flags

None new beyond the incident. T-380-59: B9 and P14 (no value of a status file in any outbound call). T-380-60: B9 caps 8 reads, none at prompt time. T-380-61: P6, P15. T-380-62: P1 (7 node mutations). T-380-63: the builder refuses the real home and rooms outside the scratch home (P11b), HOME goes to the session only (S2); the incident above shows why P11b is now written with a scratch "real home".

## Canon (mos-brand book e947a5d, read only)

Cited: segments/experience/terminal (proposed): Side panel template rows Order, One signal, Status line, Width ladder; segments/writing/voice (plain English, Theo not Brain). Where the canon is silent, for plan 11 (book follow-ups, nothing written to the book):
- A6: the Status line row says "context, stage and version stay on the plugin line"; D-08 overrides it for this panel. The template has no row for a panel that carries the status line's fields. Proposed text: a fact row is one line, a bold label then a plain value, one row for each field, shown in the order decisions, then facts, then ask; a field that was not read says "not read" in words.
- The template says nothing on where the context meter sits relative to the plugin facts (this plan keeps it beside its canvas).
- The template has no rule for a panel taller than the terminal (here 44 to 54 rows against a 24 to 40 row screen): what must be above the fold.
- No segment for a mode, stance or voice row (D-08 fields with no canon name); the panel used the plugin's own words.
- The exclusion rule: the canon has none for "a status line field the panel cannot carry"; this plan lists two.

## Self-Check

Files found: ui/mos-face/hooks/status.ts, tests/test-380-status-parity.cjs, ui/mos-face/tests/status.test.tsx, ui/mos-face/scripts/lib/tmux-session.cjs (release tree). Commits c520e5aa6, 9b93ee61f and f36ffbbb6 are ancestors of HEAD (f36ffbbb6). No file was deleted in the 3 commits. Self-check PASSED for the code; the incident cleanup (real home) is OPEN.
