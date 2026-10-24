---
phase: 380-ship-the-m-os-face-panel-mod-inside-the-plugin-target-beta-7
plan: 10
subsystem: real-terminal-proof
tags: [mos-face, screenshots, idle-cpu, opt-out, tui-consult, gaps]
requires: [380-09, 380-16, 380-17, 380-18]
requirements: [MOD380-01, MOD380-05, MOD380-07, MOD380-08, MOD380-09]
status: PARTIAL
completed: 2026-10-24
---

# Phase 380 Plan 10: Real-terminal screenshots, idle CPU, opt-out persistence - Summary

One-liner: the shipped panel (dist of release HEAD d8e135577, plans 16 to 18 included) was captured on a real tmux terminal in 35 images across 6 band scenarios, 5 dashboard scenarios, the room tree, the sent line (denied and answered), the idle gauge, the Job hint, the faces sheet and an installed layout; every image was opened and read against C1 to C14; the result is STATUS PARTIAL with 13 gaps for repair plan 380-19, and the CPU window is an ENV GAP (peer process held the load at 9 to 14).

Statement: Implementation complete; visual verification pending the person's own review of the final images (not blocking).

No source was changed. Nothing pushed. STATE.md and ROADMAP.md not edited.

## Commits (branch tree /home/jsagi/dev/MindrianOS-Plugin, branch feat/eureka-adapter-rebased)

| Task | Commit | What |
|------|--------|------|
| 1 | 4274d8fd0 | screens folder: 6 band scenarios, dashboard and tree captures, sent line, faces sheet, status line line, installed layout, index.json |
| 2 | e3da57f2a | 380-SCREENSHOTS.md and the explore capture of /mos-tree list |
| 3 | ca30b6143 | 380-LIVE-EVIDENCE.md |
| 3 | (this file) | 380-10-SUMMARY.md |

## The six required screenshots

screens/wide.png (band 120x40), screens/std.png (80x24), screens/narrow.png (50x30), screens/nocolor.png (80x24, NO_COLOR), screens/small.png (28x20), screens/chip.png (100x30), each with .txt and .ansi. Plus faces.png, statusline.txt, index.json, installed/wide.png, installed/band.png, and the folder screens/pane/ (dashboard, tree, sent line, Job hint, idle gauge).

## Verdict (380-SCREENSHOTS.md)

Honest and mostly readable on the docked pane at 46 columns, with G1, G3, G4 and G5 fixed on a real screen, but it fails C2, C3 (band), C12 and C13 at the sizes people use, and the inline pane cannot reach the tree at the 80x24 floor.

New fixes seen on a real screen (PROVEN): G1 one line "Theo was not asked: the call was not allowed", no sent row after a denied call; G3 'Theo was sent: "..." (left out: a link, code)'; G4 the new Job hint; G5 "Context gauge: waiting for the first reply"; G7/G2 the tree pages (1-28 of 300, 29-56 of 300, all 16, 2 matches for "legal", the too-small line "needs 9 rows"), with the header and crumb pinned.

## Gaps (for 380-19)

1. C12, C13: Job, Job buttons, THEO, SPEAKS, STANCE, MODE, VERSION, ASK below the fold at 120x40, out of view in the inline pane.
2. C2: the face tile stays under 60 columns (narrow.png, pane-narrow.png); a dashboard button wraps over two lines at 50 columns.
3. C3: the NO_COLOR band is six white bars (nocolor.png); the pane is fine.
4. C5 on the band: 28 columns, no band, no message (the pane gives the message).
5. The inline pane (80x24, 60x24, 50x30) has about 6 rows, so the tree says "needs 9 rows"; plan 18 assumed 76x10.
6. Tree crumb cut inside a word ("~rchive-2000") on the counter row.
7. Tree pager: page 2 of 18 names holds one name and 16 empty rows.
8. /mos-tree list answers with the usage line; plain /mos-tree opens the view (the plan 18 summary says otherwise).
9. After a denied call the chat text still says the words "are sent".
10. Handover face: hollow bar and eyes lost in the block face (PREFERENCE).
11. WRITES TO says not bound beside ROOM demo-room (installed/wide.png).
12. The load notice box overlaps host text at 80 to 100 columns.
13. NOW says Theo is not answering in the scratch captures (cause UNVERIFIED).

## CPU window (MOD380-05): ENV GAP

Raw: panel-1 0.95 s, baseline-1 0.86 s (+0.09 s, load 0.76 to 0.08 and 0.04 to 5.05); panel-2 1.42 s, baseline-2 1.15 s (+0.27 s, load 8.98 to 11.86). Mean difference +0.18 s, limit 3.0 s. Not a verified pass: the second pair ran at load above 6, the retry could not run (load average 11.6 to 14.0 for about 30 minutes from a peer node process at about 1100 percent CPU, not killed), and the end screen was not recorded for the panel windows. Open item: repeat the four windows at load under 6.

## Opt-out persistence

Three separate processes (PROVEN): run 1 /mos-words turns the excerpt off; run 2 in a new process prints the same handles-only text (the off state does not survive); run 3 with MOS_FACE_WORDS=off prints the text that turns the excerpt on (the variable is read at session start). Raw lines in 380-LIVE-EVIDENCE.md.

## Installed layout

PROVEN: npm pack (mindrian_os-cli-2.0.0-beta.74.tgz), extract, npm ci --ignore-scripts (137 packages, 11 s), real engine, dead brain URL. The panel loaded beside the plugin's own status line. Scratch config, not --config real (rule: no write into the real home).

## Deviations from Plan

1. [Rule 3 - plan conflict] The subject folder is named mos and wired like the shipped plugin (lib/mos-face/dist, hooks/mos-face.json, types field), not mos-face with a hooks.json. Root cause: plan 09 rewrote the dist owner to mos, and a plugin named mos-face is refused by the engine. My first layout put the dist under dist/, so the panel could not read its face asset and showed "words only"; I re-captured all six in the shipped layout (first set discarded).
2. [Rule 3] The plan's six scenarios show the band, and C12/C13 live in the dashboard, so I added dashboard captures with a bound room. The harness cannot bind a session; a scratch driver (not product code) reused the harness helpers.
3. [Rule 3] The docked pane is fixed at 46 columns, so plan 18's 56x40 and 44x24 became 46x40 and 46x24.
4. [Rule 2] The installed capture used the scratch config, not --config real, per the task rule.
5. A local stub MCP tool (no network, answer labeled STUB) stands in for Theo to show the sent line; the denied call used --permission-mode dontAsk.
6. context-monitor ran with current_dir set to the fixture rooms folder (as the parity test does), not ".".

## Self-Check

Task 1 verify command printed VERIFY-OK (six valid PNGs, faces.png, statusline.txt, index.json, installed/wide.png, no home path). Home path and real room name greps over all text files: none. Dash fence on 380-SCREENSHOTS.md and 380-LIVE-EVIDENCE.md: 0 hits. Commits 4274d8fd0, e3da57f2a, ca30b6143 found with git log.
