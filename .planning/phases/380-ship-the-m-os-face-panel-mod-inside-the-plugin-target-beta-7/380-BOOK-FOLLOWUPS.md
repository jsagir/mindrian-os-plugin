NEEDS_HUMAN: Do you approve every default in section B, including proposals P1 and P2 and their one-flag veto, or which rows change, and will you take proposals A1 to A7 to the book repo (this phase never edits the book)?
BOOK_STATUS_BEFORE_COUNT=2
?? consumers/pws-book-search.json
?? consumers/pws-practitioner-guide.json

# 380-BOOK-FOLLOWUPS: book proposals, defaults taken, open questions

Plan 380-11. Written 2026-10-24. Plain English. Short entries.

Navigator answer recorded: 2026-10-24, source 380-11-NAVIGATOR-RULINGS.md ("yes that the decisions"). The NEEDS_HUMAN line above is answered for the rows that file lists. Rows that file does not list say so in the Ruling column. Nothing here edits the book.

Book check (PROVEN, 2026-10-24): /home/jsagi/mos-brand is at HEAD 9f4ee34 on branch book-css-capabilities. The canon is cited as mos-brand book e947a5d. e947a5d is an ancestor of HEAD (two newer commits). Those two commits do not touch segments/experience/terminal or skills/mindrian-tui-designer (git diff e947a5d HEAD on both paths prints nothing). The two lines above are two foreign untracked files in consumers/. They are not from this phase. This phase did not change the book.

Ruling already made earlier, not an open question: the reply chip (D-07, Quote the reply as is). It is recorded in section B as ruled.

## Section A: Book proposals (paste-ready text)

Decision on all of A1 to A7: APPROVED to take to the mos-brand book repo as a separate task after the cut. They do not gate the cut. The book is not edited from phase 380.

### A1 (N1) The stale "Canon v5" label, 5 places

The book says e947a5d is the canon. It never defines "Canon v5". The label points to the owner's terminal consult ruling of 2026-10-06. Lines as found today (book HEAD 9f4ee34; same text at e947a5d):

| File | Line | Text as found |
|------|------|---------------|
| segments/experience/terminal/CONTEXT.md | 33 | "...The color roles of the plugin output rules and Canon v5 disagree and wait for an owner decision..." |
| segments/experience/terminal/segment.json | 23 (humanCheck) | the same sentence |
| segments/experience/terminal/entries/2026-10-20/GUIDE.md | 12 | "Priority order, Canon v5 color roles, measured host facts, review method" |
| segments/experience/terminal/entries/2026-10-20/GUIDE.md | 54 | "Claude Code mods and the workspace (Canon v5, newest ruling)" |
| segments/experience/terminal/entries/2026-10-20/GUIDE.md | 65 | "Until the owner rules, new work follows Canon v5, because the consult skill records that the newest owner decision wins." |
| skills/mindrian-tui-designer/SKILL.md | 14 | "The color roles of Canon v5 and the plugin output rules disagree; follow Canon v5 and flag the conflict." |

(The plan said 5 places. The count is 6 lines in 5 files: GUIDE.md holds 3 of them.)

Proposed replacement wording: replace "Canon v5" with "the owner's terminal consult ruling of 6 October 2026". Example for GUIDE.md line 65: "Until the owner rules, new work follows the owner's terminal consult ruling of 6 October 2026, because the consult skill records that the newest owner decision wins." Or drop the label and say "the newer color roles". Either way, the text must not suggest a book-wide Canon v5.

### A2 (N5) New entry: Opt-out and consent controls

Segment: the proposed terminal segment. Entry name: Opt-out and consent controls. Six rules:

1. A feature that sends the person's words says so on screen, before it sends.
2. One slash command switches it on and off.
3. The screen shows what was sent, in full.
4. The screen says how long the setting lasts (this session, or for good).
5. An opt-out that does not persist says so, in plain words.
6. A persistent switch exists for people who want it off for good.

Worked example: the M:OS panel. The own-words excerpt (240 characters at most) is on by default (owner ruling 2026-10-21). /mos-words turns it off for the session. The environment variable MOS_FACE_WORDS=off turns it off for every session (proposal P2). The panel prints "Theo was sent: ..." with the whole excerpt.

### A3 (N6 and D-11, ruled) Secondary text on ink

This answers the book open question that it has no token for secondary text on ink. No token. A segment text only. Navigator ruling 2026-10-23 (D-11): dimmed paper, no new hex.

Proposed text: "Secondary text on the ink ground is the paper token drawn dim, with the terminal faint attribute. No new color value is added. Floor note: paper (#F7F5EE) at 50 percent over ink (#111111) is #848380, a contrast of 4.98 to 1 (WCAG ratio, computed by the plan 380-11 executor; the plan 380-07 test colors.test.tsx gives the same figure), above the 4.5 floor of segments/experience/accessibility. At 40 percent it is #6D6C69, 3.60 to 1, below the floor, so 50 percent is the lowest dim. Terminal faint rendering varies by host, so verify on a real screen. Soft ink is never text on ink (2.10 to 1)."

### A4 (N7) New segment: Claude Code mods and the non-terminal fallback

Proposed text:
- A mod draws in the Claude Code terminal: a side panel, one status line, buttons in the prompt box.
- Claude Desktop and Cowork show no drawing in this beta. They show the same plain tool reads (text answers from the room tools).
- The engine's type header lists desktop, vscode and mobile as surfaces a mod can mount on. This is ASSUMED to mean nothing draws there today. Nobody has opened the Desktop copy and watched (UNVERIFIED).
- A fallback must say what it is: when a surface cannot draw, the answer in words says so in one plain sentence and names the command that gives the same facts as text (for the M:OS panel, /mos-text).
- A fallback never claims a panel the person cannot see.

### A5 (D-09) New entry: an intent line in a side panel

The book is silent today. Proposed rules for the Job line:
1. One line in the jobs-to-be-done form: when (situation), I want (action), so that (result).
2. A line the panel predicted is labelled a guess. A line the person set says "set by you".
3. Local data only. The guess sends nothing anywhere.
4. One action dismisses it. One action corrects it.
5. Place: after the status words and before the decisions in a short panel (see P19-1); after Next and before Ask where the panel has room (decisions-first order of GUIDE.md line 91).

### A6 (D-08) Status line row and a parity rule

The terminal guide, Side panel template, Status line row (GUIDE.md line 93) says: "Context, stage and version stay on the plugin line." The navigator ruled (D-08) that the M:OS panel carries every status line field too.

Proposed row: "Status line: the 'now' line in one breath, silent when all is quiet. The plugin line keeps context, stage and version, and the panel shows them as well."
Proposed parity rule: "Every field of the plugin status line has a panel field. Each is said once in the panel. A test fails if one is missing."
Width ladder behavior: on a narrow panel the fields fold in this order, last first: the version, the stage, the context bar (the figure stays). Room name and WRITES TO never fold. See README "Status parity" of ui/mos-face for the field map.

### A7 (D-10) The Theo face: 11 states, not seven

The terminal guide, section The Theo face (GUIDE.md line 69), says seven states: rest, listening, searching, found, nothing found, boundary, hand over. The identity asset (segments/identity/theo/entries/2026-10-19/asset-fa8504998f.json) holds 11 states with canon labels (Rest, Listening, Searching, Found, Challenge, Contradiction, Reframe, Nothing found, Your decision, Boundary, Handover). The states table of segments/identity/theo/states spells two of them as Search and Limit, and the asset spells them Searching and Nothing found.

Proposed text: "The canon asset is the source of the terminal faces. The guide names the 11 states with the asset spellings. Tie a state to a real event only where one exists, and list the states with no event."

Event-to-state table (as built in plan 380-13, ui/mos-face/hooks/face-events.ts):

| State | Event | 
|-------|-------|
| Rest | quiet 9 seconds after a finished turn; turn aborted |
| Listening | a turn began |
| Searching | a call is running |
| Found | a call returned material |
| Challenge | a reply leads with the red square |
| Contradiction | a reply leads with the yellow square |
| Reframe | UNMAPPED: no event reaches it |
| Nothing found | a call returned nothing or failed; a turn ended on an error |
| Your decision | a reply leads with the black square |
| Boundary | the permission mode refused a call; the model refused |
| Handover | a turn finished with an answer whose lead square is blue, white or none |

### A8 (extra, from plans 380-16 to 380-20) Eleven more proposals

The file 380-19-BOOK-PROPOSALS.md holds P19-1 to P19-11, paste-ready: status words above decisions in a short panel; compact follows the screen, the width ladder follows the panel; the fold under 24 rows; the band under 60 columns, under 30 columns and under NO_COLOR; a button label never wraps; a room shown but not bound says so; a service not checked is not failed; balanced pages; the crumb keeps the root; a pane too short says what to do; a cap note has its own row. The file 380-16-BOOK-PROPOSALS.md also exists. The rulings file lists only A1 to A7 as approved. A8 has no ruling yet. Recommendation: file them in the same book task.

## B0 Ruling summary (2026-10-24)

- APPROVED: N4, N5, N6, N7, N9, python3 removal, P1 (default on), P2 (default on; the veto is /mos-words off).
- CHANGED: the glossary first sentences are NOT approved.
- APPROVED, CONDITIONAL: the "Theo | MindrianOS" badge (confirm public Theo naming before the cut; UNVERIFIED).
- RULED EARLIER: the reply chip (D-07), dimmed paper (D-11), the label Nothing found (D-10).
- NOT LISTED in the rulings file: exact state names, the 600 second reach clock, the crew face style, the 13 job clauses, the Job line placement, status parity placement. Larry's recommendation was accepted as a whole, so no change is made. Confirm if you want a row ruling.
- No flag in ui/mos-face/hooks/proposals.ts changed. No code changed in this plan.

## Section B: Defaults taken, with the ruling of each

Book citation column: mos-brand book e947a5d plus the segment path. The terminal segment is PROPOSED in the book.

| Item | Default taken | Why | Where it lives | Book citation | Ruling |
|------|---------------|-----|----------------|---------------|--------|
| N4 two status lines | Keep both: the plugin line and the panel NOW line | The book says an old status line still draws beside a new band | ui/mos-face/README.md N4 | segments/experience/terminal GUIDE.md line 79 (proposed) | APPROVED 2026-10-24 |
| N5 command names | Keep /mos-* with a hyphen; /mos-words is the opt-out | The book does not rule on names | ui/mos-face/hooks/commands.ts | segments/experience/terminal (proposed) | APPROVED 2026-10-24 |
| N6 secondary text | Dimmed paper, no new hex | The book has no token | ui/mos-face/hooks/colors, README N6 | segments/experience/terminal, segments/experience/accessibility | APPROVED 2026-10-24; also ruled 2026-10-23, D-11 |
| N7 surfaces | Terminal only. Desktop and Cowork get plain reads. A deliberate skip | The engine draws panes in the terminal | ui/mos-face/README.md Surfaces | segments/experience/terminal (proposed) | APPROVED 2026-10-24 |
| N9 state map | Map a state only where a real event exists. The rulings file says "seven of eleven". The build now draws 11 and maps 10; Reframe is unmapped (plan 380-13) | A state with no event would be invented | ui/mos-face/hooks/face-events.ts | segments/identity/theo/states | APPROVED 2026-10-24 for "seven of eleven". NOTE: the shipped figure is 10 of 11. The 7 is the older count. Confirm 10 of 11 |
| Badge text | The badge reads "Theo \| MindrianOS" | Theo is the public name (D-04) | ui/mos-face/hooks/register.tsx (3 places) | segments/identity/theo | APPROVED, CONDITIONAL 2026-10-24. Confirm the public Theo naming before the cut. No ruling found. UNVERIFIED |
| Exact state names as labels | The label is the asset spelling (Searching, Nothing found) | D-10; the book holds two spellings | ui/mos-face/hooks/face-events.ts, README N9 | segments/identity/theo/states | Not listed in the rulings file. D-10 (2026-10-23) ruled "Nothing found". Rest: no row ruling |
| Glossary first sentences | The panel shows first sentences of a private PWS glossary, vendored in the public package | The sentences are the owner's own words | ui/mos-face/hooks/glossary.ts; lib/mos-face/dist/glossary.js; read by voice.ts glossaryWords and register.tsx line 1213 | segments/writing/voice | CHANGED 2026-10-24: NOT APPROVED. Ship the panel without them until the glossary is cleared (PWS filing rules: remove institution names, label AI text, keep provenance). OPEN: the release tree at HEAD 7c710db04 still ships them (see C1) |
| python3 removal | The python3 graph query is removed; graph numbers come from room tools or files | python3 is not on a default Windows PATH (SEED-142) | ui/mos-face/hooks/probe.ts, README No python | none (not a book matter) | APPROVED 2026-10-24 |
| 600 second reach clock | Theo health and the website are checked every 600 seconds, 4 second cut-off | Keep prompts from starving | ui/mos-face/README.md Budgets, tests B3 B4 | none | Not listed in the rulings file. No row ruling |
| Reply chip | The chip quotes the reply's own lead as is | The panel never names Larry itself | ui/mos-face/hooks/register.tsx | segments/writing/voice | RULED 2026-10-23, D-07, Quote the reply as is. Not an open question |
| Dimmed paper rule | Same as N6 | | | | RULED 2026-10-23, D-11 |
| Crew face style | Dropped, because the named canon asset has none | D-10 | plan 380-13 | segments/identity/theo | DEFERRED. It could be sourced later from the identity/robots segment. Not listed in the rulings file |
| Face event map | Challenge, Contradiction and Your decision come from the reply lead square. Reframe is unmapped | The reply marker does not say which of reframe or contradiction | ui/mos-face/hooks/face-events.ts | segments/identity/theo/states | Covered by the N9 ruling. No separate row ruling |
| Label "Nothing found" | The label Limit became Nothing found | D-10 | ui/mos-face/hooks/face-events.ts | segments/identity/theo/states (asset) | RULED 2026-10-23, D-10 |
| /mos-job command name | The 14th command is /mos-job | Same pattern as the other /mos-* names | ui/mos-face/hooks/commands.ts | none | Covered by the N5 ruling (keep /mos-* names) |
| 13 job outcome clauses | 13 plain-English outcome clauses, one per job of lib/hmi/jtbd-taxonomy.json | D-09 | ui/mos-face/hooks/jobs.ts (generated) | none | Not listed in the rulings file. No row ruling. One clause is not plain English: "Hughes 1983 reverse salient" (open item of plans 380-19 and 380-20) |
| Job line placement | Plan 380-14 placed it between Next and Ask. Plan 380-19 moved it up, with the status words, above the decisions (owner ruling of gap 1, 2026-10-24) | A docked panel hides what stands low | ui/mos-face/hooks/overview.ts | GUIDE.md lines 91 and 107 (proposed); book proposal P19-1 | Owner ruling of gap 1 stands. No separate row ruling |
| Status parity placement and focus segment exclusion | Every plugin line field has a panel field. The focus segment is left out | D-08 | ui/mos-face/README.md Status parity | GUIDE.md line 93 (proposed); proposal A6 | Covered by the N4 ruling (keep both lines) and D-08. No separate row ruling |
| P1 shimOnlyExcerpt | PROPOSAL. Default on. The excerpt goes only through the guarded shim and never through the raw theo server | The raw server does not pass lib/core/part8-egress-guard.cjs | ui/mos-face/hooks/proposals.ts | Canon Part 8 | APPROVED 2026-10-24. Default on. No veto. Veto if wanted: set the flag to false in ui/mos-face/hooks/proposals.ts, rebuild the dist, re-run the tests; no re-plan |
| P2 envSwitch | PROPOSAL. Default on. MOS_FACE_WORDS=off turns the excerpt off for good | /mos-words does not survive a new session | ui/mos-face/hooks/proposals.ts | Canon Part 8 | APPROVED 2026-10-24. Default on. The navigator veto is /mos-words off. No flag change |

## C0 Open items after the rulings

1. The glossary still ships in the release tree (C1).
2. The badge naming is not confirmed (C5).
3. The state count wording, 7 against 10 (C4).
4. Gate 3, the real-room receipt, is OPEN.

## Section C: Open owner questions

C1. May the glossary first sentences ship in the public package? Recommendation: no, until the glossary is cleared. ANSWERED 2026-10-24: NOT APPROVED. Status: OPEN item for the release. PROVEN: the release tree (/home/jsagi/dev/MindrianOS-Plugin-release, HEAD 7c710db04) still holds ui/mos-face/hooks/glossary.ts and lib/mos-face/dist/glossary.js, and voice.ts glossaryWords feeds the pane. This plan changes no code. A gap-closure plan must remove or empty the glossary lines before the cut.

C2. Should the excerpt default be off in the released product? Recommendation: no. The 2026-10-21 ruling says on, and N3 kept it. SETTLED. The navigator approved P1 and P2 with default on on 2026-10-24. The person turns it off with /mos-words.

C3. May the dist ship to the Desktop copy before the Desktop observation is made? Recommendation: yes, it is a terminal-only cut and Desktop is observed after release. ANSWERED in effect by gate 2 (2026-10-24): DEFERRED, "terminal-only cut, Windows and Desktop observed after release." The statement "no panel on Desktop" stays ASSUMED.

C4. (new) Which state count is true: seven of eleven (the rulings file) or ten of eleven (the build)? Recommendation: ten of eleven, since plan 380-13 draws all 11 and maps every state except Reframe. Needs the navigator to confirm the wording. Not blocking.

C5. (new) Confirm the public Theo naming for the "Theo | MindrianOS" badge before the cut. Recommendation: confirm in the book segments/identity/theo. UNVERIFIED.

## Final images for the person's review

The person reviews these in the phase review. The review does not block. Folder: /home/jsagi/dev/MindrianOS-Plugin/.planning/phases/380-ship-the-m-os-face-panel-mod-inside-the-plugin-target-beta-7/screens-19/ (35 PNG; index.json lists them). Judgments are in 380-20-SCREENSHOTS.md.

Top level: chip.png, narrow.png, nocolor.png, small.png, std.png, wide.png.
installed/: band.png, wide.png.
pane/: explore-list-before.png, explore-mos-tree-list.png, job-hint.png, pane-inline-60x24.png, pane-narrow.png, pane-nocolor.png, pane-small.png, pane-std.png, pane-wide.png, sent-answered.png, sent-denied.png, tree-2000-p1-big.png, tree-2000-p1-small.png, tree-2000-p2-big.png, tree-cleared-big.png, tree-find-legal-big.png, tree-find-legal-small.png, tree-folder16-big.png, tree-folder16-small.png, tree-inline-50x30.png, tree-inline-60x24.png, tree-inline-80x24.png, tree-inline-nocolor-80x24.png, tree-sections-big.png, tree-sections-p1-small.png, tree-sections-p2-small.png, tree-toosmall-120x13.png.

Owner list from plan 380-20 that is still open (no ruling): Handover face at 12 cells (gap 10); the load notice box covering host text under 60 columns (gap 12); the plugin status line room name (scripts/context-monitor); "none yet" beside the host line; Job wording "Hughes 1983 reverse salient" and "1 section have"; the idle Context canvas; a grey block beside the dashboard button at 50 columns.
