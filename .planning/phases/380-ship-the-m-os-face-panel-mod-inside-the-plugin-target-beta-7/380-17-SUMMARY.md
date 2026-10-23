---
phase: 380-ship-the-m-os-face-panel-mod-inside-the-plugin-target-beta-7
plan: 17
subsystem: face-panel-context-gauge-and-g6-diagnosis
tags: [mos-face, G5, G6, clutter-audit, gauge, name-rule, D-04, D-08, D-11]
requirements: [MOD380-07, MOD380-01]
completed: 2026-10-24
---

# Plan 380-17 Summary: the idle context gauge (G5), the clutter audit, and the G6 cause

One-liner: the idle Context row now says "Context gauge: waiting for the first reply" next to the unchanged eight boxes (a discriminated union with an exhaustive switch), the panel is counted for clutter with exact cuts left for a ruling, and G6 is diagnosed as the documented --plugin-dir name rule, reproduced with fixture plugins.

Statement: Implementation complete; visual verification pending (plan 10 captures the gauge on a real screen).

## Commits

Release tree /home/jsagi/dev/MindrianOS-Plugin-release, branch main, not pushed:

| Step | Commit | Subject |
|------|--------|---------|
| RED | cd47824cf | test(380-17): RED tests for the idle context gauge words |
| GREEN | 0600eb0f7 | feat(380-17): the idle context gauge says it is a gauge and waits for the first reply |
| Dist | 28e8429f8 | build(380-17): dist rebuilt for the context gauge words |
| Docs | 45428df5b | docs(380-17): how to try the panel from a checkout, the name rule |
| Review test | 058af2f0e | test(380-17): the idle gauge at the standard width |

Branch tree /home/jsagi/dev/MindrianOS-Plugin: aa3c2b378 (clutter audit), 81b60a028 (gauge evidence and proposals), 43f385fbc (G6 facts), and the commit of the review and this summary.

## The audit verdict (380-17-CLUTTER-AUDIT.md)

Verdict: usable and honest in the main, but tall and said twice. The overview is 40 rows with 9 rows of data (real-6, PROVEN), and the key action sits below the fold on every small screen. The five worst problems:

1. The overview is 34 to 40 rows and every open list grows it, so the face, header and gauge scroll away (real-7, real-8, real-10, PROVEN); at 80 by 24 or in a 60 column split NOW and its Fix button are hidden (UNVERIFIED on screen). Fix: cap the lists (plan 18).
2. Same state said 3 or 4 times, and two disagreements: ROOM names a room under "nothing - this session is not bound", and the panel says "NEXT MOVE none yet" beside a line that says "Next: ship-native-fire" (PROVEN real-6; cause of the second UNVERIFIED).
3. The idle gauge: 10 of 40 rows are bright planes that carry no information while Context is waiting (PROVEN). Labelled in this plan; cutting the canvas rows needs a ruling.
4. 8 blank rows and 3 hint rows are 11 of 40 rows (UNVERIFIED on screen).
5. A mark on every row (the cobalt bar 4 of 4 headings, the triangle on 15 of 15 lights and section rows) (PREFERENCE).

Cut list status: only G-fixes of plans 16, 17 and 18 are applied. Every other cut (drop the idle canvas rows, drop the STALE row when NOW says it, say ROOM is the last used room when not bound, find why NEXT MOVE disagrees with the plugin line, drop blank separators in the short path, fold the three hints, drop the two duplicate click hints, drop the heading bar, one signal for a new file) is listed as "applies: needs a ruling" and was not applied. The full rubric score is left to plan 10.

## G5: RED and GREEN

- Book consult: 380-17-evidence/G5-BOOK-CONSULT.md. Choice: label, do not dim (the book has no secondary-on-ink token, D-11; the 18 pins of tests/meter-pin.test.ts fix the idle pixels). The book's own review of the strings (scratch consumer, CLI from an export of e947a5d): exit 2, REVIEW-REQUIRED, findings empty (G5-BOOK-REVIEW-RAW.md). The book repository is unchanged (2 status lines before and after, HEAD 9f4ee34).
- RED (380-17-evidence/red-gauge.txt): 215 pass, 6 fail. G-1 to G-4 and G-7 fail with "Expected length 1, Received length 0" (the idle words are not drawn); G-8 fails with "not implemented". G-5, G-6 and G-9 pass before the change, and so does every earlier test.
- GREEN (380-17-evidence/green-gauge.txt): 221 pass, 0 fail; later 222 pass with the standard width case. panel.test.tsx still declares 34 tests; tests/meter-pin.test.ts passes unedited; typecheck exit 0; test-380-copy 37 passed; test-380-budget 11 passed.
- Strings: idle with boxes "Context gauge: waiting for the first reply"; idle without boxes (narrow, plain, short) "Context: waiting for the first reply"; reading unchanged ("Context 62% - watch"). Zero is a reading. NaN is idle (it used to print "NaN%").
- Proposals P17-1 (the idle state of a gauge) and P17-2 (white as the color of a blank cell, PREFERENCE, a question for the navigator) are appended to 380-16-BOOK-PROPOSALS.md. The book is not edited.

## G6: root cause (380-17-G6-FACTS.md)

Root cause in one sentence: the dev package ui/mos-face was named mos (commit bfc7cd798), the name of the installed plugin, so claude --plugin-dir on it silently replaced the installed plugin; the session then held only the mod, with no /mos:* commands and no shim tool for brain_ask. PROVEN by run R1b (13 mod commands, mos:rooms gone, brain_ask tool gone, debug line "Plugin "mos" from --plugin-dir overrides installed version") and the quoted rule of https://code.claude.com/docs/en/plugins/loading.md, section Name conflicts.

Classification: unknown commands = WORKING AS DESIGNED by the host rule (and already removed from the source by the follow-up 01ed3f929: run R1 shows the source folder, now named mos-face, keeps the installed commands and the tool). The denied brain_ask = ENV (the host's auto mode and its classifier, outside the mod). Neither is a NEW FAILURE. The link to G1 is the missing shim tool that led the panel to the raw server (fixed in plan 16). Decision rule applied: the name must stay mos in the dist (plan 09), so no code change; documentation only (README section "How to try the panel from a checkout").

## Deviations from Plan

1. [Rule 3 - plan conflict] Test P6 of tests/status.test.tsx asserted `^Context: waiting$` at the wide size. The plan's G-1 requires that no row says that at the wide size, and the plan says not to edit earlier test bodies. One regular expression of P6 was changed to the new words, in the GREEN commit (0600eb0f7). Root cause: the plan text said P6 stays green while its behavior list changes the words P6 reads. Asked in the review as a question.
2. [Rule 3 - fixture need] tests/support.ts gained the percentNow option (backward compatible) because the test engine registers session.usage once and has no invalidate call, so G-7 could not change the host figure between renders. G-7 re-mounts the pane for the "next render" (the test says so).
3. [Rule 1 - test bug] The first canvas row finder used keys, but the test engine does not expose Text keys. The finder uses the row structure (a Text whose children are all runs and whose text is 32 block cells). Found at RED time, before any production code.
4. [Task 3 - premise changed] The plan assumed the source folder is named mos. After the plan 09 follow-up it is named mos-face, so R1 (the folder as it is) shows no override. The old state was reproduced from commit bfc7cd798 with git archive (R1b). The facts file and README say both.
5. [Task 3 - safety choice] The real plugin root was not run as --plugin-dir (its hooks run real session code). R2 and R3 use a stand-in "whole plugin" folder named mos (a fixture command, a fixture tool server, the built dist as the mod). So whether the real root plus the mod loads is UNVERIFIED here.
6. [Task 3 - rig bug, fixed] The first R4 attempt overwrote the settings file that the install wrote and removed the installed fixture; the rig now merges the setting. A first R1b used a copy without the engine declarations or with the new atom owner and showed no mod commands; it was replaced by the git archive export of the old commit. Neither attempt is kept.
7. [Task 1] The mounted pane counts use a scratch copy with a throwaway test; wrap counts are estimates (UNVERIFIED, no paint). The copy was deleted after the run.
8. [Review] One test was added after GREEN (the standard width case, 058af2f0e) because the review found no case at 44 columns. It passed on first run, so it is a characterization test, not a RED test.

Auto-fix attempts per task were at most 2. No push; STATE.md and ROADMAP.md not edited.

## Authentication gates

None. The scratch config used a symlink to the login file; the login file's modification time was unchanged after the runs.

## Verification

- node ui/mos-face/scripts/typecheck.cjs: exit 0 (alone).
- claude plugin test in ui/mos-face: 222 pass, 0 fail (alone, after the last commit). Under load (other sessions, load average above 6) three runs hit the 5000 ms timeout on unrelated tests; each was rerun alone and passed. No timeout was raised.
- bash tests/run-all-380.sh: PASSED=19 FAILED=0 SKIPPED=0 KNOWN=0 (alone).
- node scripts/build-mos-face.cjs --check: fresh (source hash ce278dc654423efc, 23 dist files verified); node tests/test-380-build.cjs: 115 passed.
- Evidence and audit files hold no em-dash or en-dash; the g6-runs evidence holds no path of the real config folder, the real rooms folder or the login file.

## Claims

- PROVEN: the audit counts of the four shots; the mounted row lists; RED and GREEN outputs; the idle and reading strings on the pane at 35, 44 and 56 columns, plain and short; the G6 run matrix R0 to R4 and the quoted host rule; the book repository unchanged.
- UNVERIFIED: the idle gauge on a real screen; wrap counts of the mounted panes; the inline pane height at 80 by 24 and in a 60 column split; the real plugin root plus the mod; the launch line of the navigator's session; why NEXT MOVE says none yet beside "Next: ship-native-fire".
- PREFERENCE: P17-2 (white for a blank cell); cuts 5 of the audit list.

## Canon

mos-brand book e947a5d (read with git show; the checkout is at 9f4ee34): segments/experience/terminal/entries/2026-10-20/GUIDE.md (status proposed: Rules that hold everywhere, Priority order, Side panel template States and One signal, Ground and color), segments/writing/voice, segments/foundations/color, references/brand-rules.md. Skills applied: typescript-pro (strict, no enum, no explicit any, union with exhaustive switch, type predicate), test-master (RED first and watched, exact assertions, edge paths), code-reviewer (380-17-REVIEW.md: Approve), tui-design (clutter audit and floor test), mindrian-tui-consult (labels, usability then brand, honesty above both).

## Review verdict

380-17-REVIEW.md: Approve. No critical or major finding. Six minor items and two questions (the P6 assertion edit and the percentNow option).

## Known Stubs

None.

## Threat Flags

None. The module is pure; no tool call, http call, process or read was added. The probe runs used a scratch HOME and config folder (T-380-69), the book was read with git show and a scratch consumer (T-380-70), the idle words appear only when the host gives no figure and zero is a reading (T-380-71), the host rule is quoted with its section and reproduced (T-380-72).
