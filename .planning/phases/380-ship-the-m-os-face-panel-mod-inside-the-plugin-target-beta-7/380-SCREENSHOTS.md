# 380-SCREENSHOTS: inspection record of the real-terminal captures (plan 380-10)

## Gaps (read first)

STATUS PARTIAL. Failing checks: C2 (narrow.png, pane-narrow.png), C3 for the band (nocolor.png), C5 for the band (small.png; the pane passes), C12 and C13 at 120x40 and at the inline sizes (pane-wide.png, pane-std.png, pane-narrow.png). The numbered list of 13 gaps for repair plan 380-19 is in the section "Gaps for the main session" below. No source was changed in this plan.

Mode: protocol Rule 5. Every image named below was opened with the Read tool by the executor. A result is PROVEN only for what the opened image (or a test that ran) shows. The text and ANSI captures were used only to confirm what I saw.

Book: mos-brand book e947a5d (the checkout I read sits at 9f4ee34, a descendant). The terminal segment segments/experience/terminal (entries/2026-10-20/GUIDE.md) has status proposed, so every ruling taken from it is a proposal, not canon.

Tools (from screens/index.json): Claude Code 2.1.310 (the host updated from 2.1.309 between plan 03 and this run), tmux 3.7, Playwright CLI 1.58.2 (chromium), Node v22.23.1. Colors: truecolor sequences (38;2 or 48;2) are present in every capture except nocolor (index.json colorNote, per scenario truecolor flag). The capture draws the tmux screen in DejaVu Sans Mono on a #2b2b2b ground. That is the harness font, not the person's.

Subject: a byte copy of lib/mos-face/dist (24 files, every sha256 equal to dist/manifest.json, 0 mismatches) laid out like the shipped wiring: lib/mos-face/dist, hooks/mos-face.json, plugin name mos, types field. Source HEAD of the release tree: d8e135577 (plans 16, 17 and 18 included). The panel ran in a scratch HOME and a scratch config folder (login by symlink). No prompt was submitted and no model was called.

## Deviations from the plan text (root causes)

1. The plan describes a subject named mos-face with a hooks.json. The dist owner is rewritten to mos at build time (plan 09 follow-up), so a plugin named mos-face is refused by the engine (state.set denied). Subject name is mos. The first subject put the dist under dist/, and the panel then said "The Theo face drawings could not be read, so the panel shows words only", because theo-face.ts reads plugin.root + lib/mos-face/dist/assets/. I re-laid the subject in the shipped path and re-captured all six (the first set is discarded and not committed). That was a layout error of mine and the panel's fallback text was honest.
2. Step 4 asks for --config real for the installed capture. The task rules forbid any write into the real home, so I used the scratch config with a settings file that sets the plugin's own status line. This shows the status line beside the panel (N4), but not the person's own plugins or theme.
3. The six band scenarios show the band (the host's own band above the prompt) with no /mos-state. The checks C12 and C13 live in the dashboard, so I added dashboard captures (pane-*.png, under screens/pane/) at the same sizes, with a bound throwaway room of 18 sections. The harness cannot bind a session, so a scratch driver (scratchpad s10/drive.cjs, not product code) reuses the harness helpers: it writes a resumed synthetic transcript, records the session in the registry, and sends only registered /mos-state, /mos-tree and /mos-advice commands after reading the prompt line.
4. The docked pane is 46 columns wide at every terminal width from 120 to 140 (measured: divider at column 73 of 120 and column 93 of 140). Its height is the terminal height minus 5 (35 rows at 120x40, 40 at 140x45, 24 at 120x29, 8 at 120x13). So the plan 18 sizes 56x40 and 44x24 could not be set. I used 46x40 (140x45) and 46x24 (120x29). The inline pane (below 110 columns) has about 6 rows.
5. The sent line captures use a local stub MCP tool (no network; its answer says STUB). For the denied call the stub is named theo and the session runs with --permission-mode dontAsk, so the host denies the raw call and the shim tool is absent (the pair seen in the user shots). For the answered call the stub carries the shim name and is allowed. It stands in for Theo. The panel's sent line is the thing under test, not Theo's answer.
6. context-monitor was run with current_dir set to the fixture rooms folder (as tests/test-380-status-parity.cjs does), not ".", so the line names demo-room.

## Per image checks C1 to C14

Result words: pass, fail, partial, not shown. A row that reads "not shown" is UNVERIFIED for that image, not a pass.

### Band, wide 120x40 (no dashboard open) (wide.png)

| Check | Result | What I saw | Label |
|---|---|---|---|
| C1 fits at 80x24, readable status words | not shown | not visible in this image | UNVERIFIED |
| C2 under 60 columns: words and text bar, actions kept | not shown | not visible in this image | UNVERIFIED |
| C3 NO_COLOR: meaning in words or shapes | not shown | not visible in this image | UNVERIFIED |
| C4 canon colors, badge Theo | MindrianOS, no panel text names Larry | pass | the badge reads Theo | MindrianOS on a grey chip; the Rest tile is cream and black only, so blue, red and yellow moves are not drawn in this image; no panel text names Larry | PROVEN |
| C5 too small: plain message names the width | not shown | not visible in this image | UNVERIFIED |
| C6 every Button-looking element has a mechanism, hints name working slash commands | pass (mechanism UNVERIFIED) | [ Hide ] and [ /m:os dashboard ] are drawn; the notice names /mos-state and /mos-face; I did not press them (tmux cannot click); the unit tests press them | UNVERIFIED |
| C7 no em-dash, no ICM, Brain or MCP in the panel area | pass | no dash, no ICM, Brain or MCP word in the panel area (also grep on the text capture) | PROVEN |
| C8 yellow never text on paper, text on colored blocks readable | pass | the panel draws no paper ground; white words on the ink band are readable; the bottom line is orange text on the dark ground | PROVEN |
| C9 state name is one of the book names | pass | the state line reads Rest | Theo 0 this turn, 0 in all | PROVEN |
| C10 no real room name, home path or person name | pass | only the scratch folder name /tmp/mos-face-shots-XXXX and the fixture room demo-room show; grep of the files finds no home path and no real room name | PROVEN |
| C11 chip quotes the reply lead as written | not shown | not visible in this image | UNVERIFIED |
| C12 status parity fields with label and value | not shown | the band holds only the turn counts; the status fields sit in the dashboard (see pane-wide.png) | PROVEN |
| C13 Job line form, guess label, buttons | not shown | no Job line in the band; see pane-wide.png and sent-answered.png | PROVEN |
| C14 canon faces from the asset | pass (partial) | a Rest face is drawn as two cream planes with black bars and eyes; the words only fallback text is absent, so the asset was read from the shipped layout | PROVEN |

### Band, 80x24 floor (std.png)

| Check | Result | What I saw | Label |
|---|---|---|---|
| C1 fits at 80x24, readable status words | pass, with one defect | the band fits in 5 rows with no half drawn row and the words Rest | Theo 0 this turn, 0 in all are readable. Defect: the grey load notice box (mos /m:os face loaded...) sits over the host text, which reads "Auto mode is now Claude Code's def" and stops | PROVEN |
| C2 under 60 columns: words and text bar, actions kept | not shown | not visible in this image | UNVERIFIED |
| C3 NO_COLOR: meaning in words or shapes | not shown | not visible in this image | UNVERIFIED |
| C4 canon colors, badge Theo | MindrianOS, no panel text names Larry | pass | badge Theo | MindrianOS; tile cream and black; no panel text names Larry | PROVEN |
| C5 too small: plain message names the width | not shown | not visible in this image | UNVERIFIED |
| C6 every Button-looking element has a mechanism, hints name working slash commands | pass (mechanism UNVERIFIED) | [ Hide ] and [ /m:os dashboard ] drawn; not pressed here | UNVERIFIED |
| C7 no em-dash, no ICM, Brain or MCP in the panel area | pass | no dash, no ICM, Brain or MCP word in the panel area (also grep on the text capture) | PROVEN |
| C8 yellow never text on paper, text on colored blocks readable | pass | readable | PROVEN |
| C9 state name is one of the book names | pass | Rest | PROVEN |
| C10 no real room name, home path or person name | pass | only the scratch folder name /tmp/mos-face-shots-XXXX and the fixture room demo-room show; grep of the files finds no home path and no real room name | PROVEN |
| C11 chip quotes the reply lead as written | not shown | not visible in this image | UNVERIFIED |
| C12 status parity fields with label and value | not shown | not visible in this image | UNVERIFIED |
| C13 Job line form, guess label, buttons | not shown | not visible in this image | UNVERIFIED |
| C14 canon faces from the asset | pass (partial) | the Rest face is drawn | PROVEN |

### Band, 50x30 (under 60 columns) (narrow.png)

| Check | Result | What I saw | Label |
|---|---|---|---|
| C1 fits at 80x24, readable status words | not applicable (50 columns) | the bottom line wraps; "not bound to a room, nothing wi" is cut | PROVEN |
| C2 under 60 columns: words and text bar, actions kept | FAIL | at 50 columns the band still draws the two plane face tile at full size beside the words; the plan asks for words and a text bar instead of the tile. The actions [ Hide ] and [ /m:os dashboard ] are there, but the dashboard button wraps over two lines ("[ /m:os" and "dashboard ]") | PROVEN |
| C3 NO_COLOR: meaning in words or shapes | not shown | not visible in this image | UNVERIFIED |
| C4 canon colors, badge Theo | MindrianOS, no panel text names Larry | pass | badge, no Larry in panel text | PROVEN |
| C5 too small: plain message names the width | not shown | not visible in this image | UNVERIFIED |
| C6 every Button-looking element has a mechanism, hints name working slash commands | pass (mechanism UNVERIFIED), with a layout defect | the dashboard button label is split over two lines (the tui consult skill names this as a layout bug: label wrapped away from its brackets) | PROVEN |
| C7 no em-dash, no ICM, Brain or MCP in the panel area | pass | no dash, no ICM, Brain or MCP word in the panel area (also grep on the text capture) | PROVEN |
| C8 yellow never text on paper, text on colored blocks readable | pass | readable | PROVEN |
| C9 state name is one of the book names | pass | Rest | Theo 0 this turn, 0 in~ (the line is cut with a tilde) | PROVEN |
| C10 no real room name, home path or person name | pass | only the scratch folder name /tmp/mos-face-shots-XXXX and the fixture room demo-room show; grep of the files finds no home path and no real room name | PROVEN |
| C11 chip quotes the reply lead as written | not shown | not visible in this image | UNVERIFIED |
| C12 status parity fields with label and value | not shown | not visible in this image | UNVERIFIED |
| C13 Job line form, guess label, buttons | not shown | not visible in this image | UNVERIFIED |
| C14 canon faces from the asset | pass (partial) | Rest face drawn | PROVEN |

### Band, 80x24, NO_COLOR set (nocolor.png)

| Check | Result | What I saw | Label |
|---|---|---|---|
| C1 fits at 80x24, readable status words | pass | fits; words readable | PROVEN |
| C2 under 60 columns: words and text bar, actions kept | not shown | not visible in this image | UNVERIFIED |
| C3 NO_COLOR: meaning in words or shapes | FAIL for the band | no color appears (the capture holds no 48;2 sequence). The state is also in words (Rest | Theo 0 this turn, 0 in all), so no meaning is lost, but the face tile is drawn as six rows of plain white half block bars that show no face and no shape: noise with no meaning. The dashboard pane in the same mode is fine (see pane-nocolor.png) | PROVEN |
| C4 canon colors, badge Theo | MindrianOS, no panel text names Larry | not shown | not visible in this image | UNVERIFIED |
| C5 too small: plain message names the width | not shown | not visible in this image | UNVERIFIED |
| C6 every Button-looking element has a mechanism, hints name working slash commands | pass (mechanism UNVERIFIED) | [ Hide ] and [ /m:os dashboard ] drawn as plain text | UNVERIFIED |
| C7 no em-dash, no ICM, Brain or MCP in the panel area | pass | no dash, no ICM, Brain or MCP word in the panel area (also grep on the text capture) | PROVEN |
| C8 yellow never text on paper, text on colored blocks readable | not shown | not visible in this image | UNVERIFIED |
| C9 state name is one of the book names | pass | Rest | PROVEN |
| C10 no real room name, home path or person name | pass | only the scratch folder name /tmp/mos-face-shots-XXXX and the fixture room demo-room show; grep of the files finds no home path and no real room name | PROVEN |
| C11 chip quotes the reply lead as written | not shown | not visible in this image | UNVERIFIED |
| C12 status parity fields with label and value | not shown | not visible in this image | UNVERIFIED |
| C13 Job line form, guess label, buttons | not shown | not visible in this image | UNVERIFIED |
| C14 canon faces from the asset | not shown | not visible in this image | UNVERIFIED |

### Band, 28x20 (under the 30 column floor) (small.png)

| Check | Result | What I saw | Label |
|---|---|---|---|
| C1 fits at 80x24, readable status words | not applicable (28 columns) | the band is not drawn at all | PROVEN |
| C2 under 60 columns: words and text bar, actions kept | not shown | not visible in this image | UNVERIFIED |
| C3 NO_COLOR: meaning in words or shapes | not shown | not visible in this image | UNVERIFIED |
| C4 canon colors, badge Theo | MindrianOS, no panel text names Larry | not shown | not visible in this image | UNVERIFIED |
| C5 too small: plain message names the width | FAIL for the band (the pane passes) | no band and no message at 28 columns: only the host notice box and a cut status line show. The plain message that names the width is drawn only after /mos-state (pane-small.png) | PROVEN |
| C6 every Button-looking element has a mechanism, hints name working slash commands | not shown | not visible in this image | UNVERIFIED |
| C7 no em-dash, no ICM, Brain or MCP in the panel area | pass | no dash, no ICM, Brain or MCP word in the panel area (also grep on the text capture) | PROVEN |
| C8 yellow never text on paper, text on colored blocks readable | not shown | not visible in this image | UNVERIFIED |
| C9 state name is one of the book names | not shown | not visible in this image | UNVERIFIED |
| C10 no real room name, home path or person name | pass | only the scratch folder name /tmp/mos-face-shots-XXXX and the fixture room demo-room show; grep of the files finds no home path and no real room name | PROVEN |
| C11 chip quotes the reply lead as written | not shown | not visible in this image | UNVERIFIED |
| C12 status parity fields with label and value | not shown | not visible in this image | UNVERIFIED |
| C13 Job line form, guess label, buttons | not shown | not visible in this image | UNVERIFIED |
| C14 canon faces from the asset | not shown | not visible in this image | UNVERIFIED |

### Reply chip, 100x30 (synthetic reply, no model call) (chip.png)

| Check | Result | What I saw | Label |
|---|---|---|---|
| C1 fits at 80x24, readable status words | not shown | not visible in this image | UNVERIFIED |
| C2 under 60 columns: words and text bar, actions kept | not shown | not visible in this image | UNVERIFIED |
| C3 NO_COLOR: meaning in words or shapes | not shown | not visible in this image | UNVERIFIED |
| C4 canon colors, badge Theo | MindrianOS, no panel text names Larry | pass | band badge Theo | MindrianOS; the word Larry in the chip is the reply's own, see C11 | PROVEN |
| C5 too small: plain message names the width | not shown | not visible in this image | UNVERIFIED |
| C6 every Button-looking element has a mechanism, hints name working slash commands | not shown | not visible in this image | UNVERIFIED |
| C7 no em-dash, no ICM, Brain or MCP in the panel area | pass | no dash, no ICM, Brain or MCP word in the panel area (also grep on the text capture) | PROVEN |
| C8 yellow never text on paper, text on colored blocks readable | pass | the chip is white bold text on a cobalt block and is readable | PROVEN |
| C9 state name is one of the book names | pass | Rest | PROVEN |
| C10 no real room name, home path or person name | pass | only the scratch folder name /tmp/mos-face-shots-XXXX and the fixture room demo-room show; grep of the files finds no home path and no real room name | PROVEN |
| C11 chip quotes the reply lead as written | pass | the chip reads "Larry | MindrianOS", which is the bold lead of the synthetic reply as written ("blue square, **Larry | MindrianOS**, then the sentence"); the sentence below it is unchanged: "Market sizing is the first claim to test. What would change your mind?". The blue square glyph is not drawn as text: the blue color of the chip stands for it (judgment: PREFERENCE on whether that counts as removal). The word Larry is quoted: the panel wrote nothing there | PROVEN |
| C12 status parity fields with label and value | not shown | not visible in this image | UNVERIFIED |
| C13 Job line form, guess label, buttons | not shown | not visible in this image | UNVERIFIED |
| C14 canon faces from the asset | not shown | not visible in this image | UNVERIFIED |

### Dashboard docked, 120x40 (pane 46 columns by 35 rows) (pane-wide.png)

| Check | Result | What I saw | Label |
|---|---|---|---|
| C1 fits at 80x24, readable status words | not shown | not visible in this image | UNVERIFIED |
| C2 under 60 columns: words and text bar, actions kept | not shown | not visible in this image | UNVERIFIED |
| C3 NO_COLOR: meaning in words or shapes | not shown | not visible in this image | UNVERIFIED |
| C4 canon colors, badge Theo | MindrianOS, no panel text names Larry | pass | badge Theo | MindrianOS, Rest tile, no Larry in panel text (the only Larry on the screen is the chat chip, quoted) | PROVEN |
| C5 too small: plain message names the width | not shown | not visible in this image | UNVERIFIED |
| C6 every Button-looking element has a mechanism, hints name working slash commands | pass (mechanism UNVERIFIED) | Switch room, Fix: /mos:doctor, Ask Theo now and Words: shared are drawn; each names a slash command that exists in the panel or the plugin | UNVERIFIED |
| C7 no em-dash, no ICM, Brain or MCP in the panel area | pass | no dash, no ICM, Brain or MCP word in the panel area (also grep on the text capture) | PROVEN |
| C8 yellow never text on paper, text on colored blocks readable | pass | white and cream text on ink; the Words: shared and Switch room buttons are grey with white text | PROVEN |
| C9 state name is one of the book names | pass | Rest | PROVEN |
| C10 no real room name, home path or person name | pass | only the scratch folder name /tmp/mos-face-shots-XXXX and the fixture room demo-room show; grep of the files finds no home path and no real room name | PROVEN |
| C11 chip quotes the reply lead as written | not shown | not visible in this image | UNVERIFIED |
| C12 status parity fields with label and value | FAIL at this size | visible with label and value: WRITES TO demo-room, ROOM demo-room Discovery stage, FILED 3 entries in 18 sections, STALE market-analysis, HEALTH sound, NOW, NEXT MOVE map unknowns (routed), and the idle context row. NOT visible: THEO, SPEAKS, STANCE, MODE, VERSION, ASK: they fall below the bottom of the 35 row pane (they show at 140x45, see sent-answered.png). Context says "Context gauge: waiting for the first reply", which is honest because no model call was made. The focus field is excluded by plan 15 | PROVEN |
| C13 Job line form, guess label, buttons | FAIL at this size | the Job heading reads "JOB a guess, is this it?" and the statement starts "When I am in the Discovery stage, I want to" then the pane ends. The Not this and Fix buttons are not drawn in view. At 140x45 the three clause form is whole (sent-answered.png) | PROVEN |
| C14 canon faces from the asset | pass (partial) | the Rest face is drawn at 6 rows by 8 cells from the asset | PROVEN |

### Dashboard inline, 80x24 (pane-std.png)

| Check | Result | What I saw | Label |
|---|---|---|---|
| C1 fits at 80x24, readable status words | pass for fit, content gap | the inline box holds the face tile, Theo | MindrianOS, Rest, the quote and "Context: waiting for the first reply" in 7 rows inside the host border; no row is half drawn. Everything below the Context row (room, NOW, NEXT, Job) is out of view | PROVEN |
| C2 under 60 columns: words and text bar, actions kept | not shown | not visible in this image | UNVERIFIED |
| C3 NO_COLOR: meaning in words or shapes | not shown | not visible in this image | UNVERIFIED |
| C4 canon colors, badge Theo | MindrianOS, no panel text names Larry | pass | badge, no Larry in panel text | PROVEN |
| C5 too small: plain message names the width | not shown | not visible in this image | UNVERIFIED |
| C6 every Button-looking element has a mechanism, hints name working slash commands | not shown | not visible in this image | UNVERIFIED |
| C7 no em-dash, no ICM, Brain or MCP in the panel area | pass | no dash, no ICM, Brain or MCP word in the panel area (also grep on the text capture) | PROVEN |
| C8 yellow never text on paper, text on colored blocks readable | pass | readable | PROVEN |
| C9 state name is one of the book names | pass | Rest | PROVEN |
| C10 no real room name, home path or person name | pass | only the scratch folder name /tmp/mos-face-shots-XXXX and the fixture room demo-room show; grep of the files finds no home path and no real room name | PROVEN |
| C11 chip quotes the reply lead as written | not shown | not visible in this image | UNVERIFIED |
| C12 status parity fields with label and value | FAIL at this size | only the context row is visible; ROOM, FILED, STALE, HEALTH, NOW, NEXT MOVE and the rest are out of view | PROVEN |
| C13 Job line form, guess label, buttons | FAIL at this size | no Job line in view | PROVEN |
| C14 canon faces from the asset | pass (partial) | Rest face drawn | PROVEN |

### Dashboard inline, 50x30 (pane-narrow.png)

| Check | Result | What I saw | Label |
|---|---|---|---|
| C1 fits at 80x24, readable status words | not shown | not visible in this image | UNVERIFIED |
| C2 under 60 columns: words and text bar, actions kept | FAIL | the face tile is drawn at 50 columns beside the words (no text bar instead); the visible rows are the tile, Rest, the quote cut with a tilde, the context row and the first row of WRITES TO demo-room | PROVEN |
| C3 NO_COLOR: meaning in words or shapes | not shown | not visible in this image | UNVERIFIED |
| C4 canon colors, badge Theo | MindrianOS, no panel text names Larry | not shown | not visible in this image | UNVERIFIED |
| C5 too small: plain message names the width | not shown | not visible in this image | UNVERIFIED |
| C6 every Button-looking element has a mechanism, hints name working slash commands | not shown | not visible in this image | UNVERIFIED |
| C7 no em-dash, no ICM, Brain or MCP in the panel area | pass | no dash, no ICM, Brain or MCP word in the panel area (also grep on the text capture) | PROVEN |
| C8 yellow never text on paper, text on colored blocks readable | not shown | not visible in this image | UNVERIFIED |
| C9 state name is one of the book names | pass | Rest | PROVEN |
| C10 no real room name, home path or person name | pass | only the scratch folder name /tmp/mos-face-shots-XXXX and the fixture room demo-room show; grep of the files finds no home path and no real room name | PROVEN |
| C11 chip quotes the reply lead as written | not shown | not visible in this image | UNVERIFIED |
| C12 status parity fields with label and value | FAIL at this size | only WRITES TO and the context row are visible | PROVEN |
| C13 Job line form, guess label, buttons | FAIL at this size | no Job line in view | PROVEN |
| C14 canon faces from the asset | not shown | not visible in this image | UNVERIFIED |

### Dashboard inline, 80x24, NO_COLOR set (pane-nocolor.png)

| Check | Result | What I saw | Label |
|---|---|---|---|
| C1 fits at 80x24, readable status words | not shown | not visible in this image | UNVERIFIED |
| C2 under 60 columns: words and text bar, actions kept | not shown | not visible in this image | UNVERIFIED |
| C3 NO_COLOR: meaning in words or shapes | pass | the pane switches to plain words: [o|o] Rest, "Theo | MindrianOS", the quote, the context row, in a single line frame; no meaning rests on color | PROVEN |
| C4 canon colors, badge Theo | MindrianOS, no panel text names Larry | not shown | not visible in this image | UNVERIFIED |
| C5 too small: plain message names the width | not shown | not visible in this image | UNVERIFIED |
| C6 every Button-looking element has a mechanism, hints name working slash commands | not shown | not visible in this image | UNVERIFIED |
| C7 no em-dash, no ICM, Brain or MCP in the panel area | pass | no dash, no ICM, Brain or MCP word in the panel area (also grep on the text capture) | PROVEN |
| C8 yellow never text on paper, text on colored blocks readable | not shown | not visible in this image | UNVERIFIED |
| C9 state name is one of the book names | pass | Rest | PROVEN |
| C10 no real room name, home path or person name | pass | only the scratch folder name /tmp/mos-face-shots-XXXX and the fixture room demo-room show; grep of the files finds no home path and no real room name | PROVEN |
| C11 chip quotes the reply lead as written | not shown | not visible in this image | UNVERIFIED |
| C12 status parity fields with label and value | not shown | not visible in this image | UNVERIFIED |
| C13 Job line form, guess label, buttons | not shown | not visible in this image | UNVERIFIED |
| C14 canon faces from the asset | not shown | not visible in this image | UNVERIFIED |

### Dashboard inline, 28x20 (pane-small.png)

| Check | Result | What I saw | Label |
|---|---|---|---|
| C1 fits at 80x24, readable status words | not shown | not visible in this image | UNVERIFIED |
| C2 under 60 columns: words and text bar, actions kept | not shown | not visible in this image | UNVERIFIED |
| C3 NO_COLOR: meaning in words or shapes | not shown | not visible in this image | UNVERIFIED |
| C4 canon colors, badge Theo | MindrianOS, no panel text names Larry | not shown | not visible in this image | UNVERIFIED |
| C5 too small: plain message names the width | pass | the box says "/m:os needs 30 columns. Widen the panel. The status line and /mos-state still work." That names the width | PROVEN |
| C6 every Button-looking element has a mechanism, hints name working slash commands | not shown | not visible in this image | UNVERIFIED |
| C7 no em-dash, no ICM, Brain or MCP in the panel area | pass | no dash, no ICM, Brain or MCP word in the panel area (also grep on the text capture) | PROVEN |
| C8 yellow never text on paper, text on colored blocks readable | not shown | not visible in this image | UNVERIFIED |
| C9 state name is one of the book names | not shown | not visible in this image | UNVERIFIED |
| C10 no real room name, home path or person name | pass | only the scratch folder name /tmp/mos-face-shots-XXXX and the fixture room demo-room show; grep of the files finds no home path and no real room name | PROVEN |
| C11 chip quotes the reply lead as written | not shown | not visible in this image | UNVERIFIED |
| C12 status parity fields with label and value | not shown | not visible in this image | UNVERIFIED |
| C13 Job line form, guess label, buttons | not shown | not visible in this image | UNVERIFIED |
| C14 canon faces from the asset | not shown | not visible in this image | UNVERIFIED |

### Installed layout (packed payload, full plugin), docked 120x40, scratch config (installed/wide.png)

| Check | Result | What I saw | Label |
|---|---|---|---|
| C1 fits at 80x24, readable status words | not shown | not visible in this image | UNVERIFIED |
| C2 under 60 columns: words and text bar, actions kept | not shown | not visible in this image | UNVERIFIED |
| C3 NO_COLOR: meaning in words or shapes | not shown | not visible in this image | UNVERIFIED |
| C4 canon colors, badge Theo | MindrianOS, no panel text names Larry | pass | badge and Rest tile as in the other images; no Larry in panel text | PROVEN |
| C5 too small: plain message names the width | not shown | not visible in this image | UNVERIFIED |
| C6 every Button-looking element has a mechanism, hints name working slash commands | not shown | not visible in this image | UNVERIFIED |
| C7 no em-dash, no ICM, Brain or MCP in the panel area | pass | no dash, no ICM, Brain or MCP word in the panel area (also grep on the text capture) | PROVEN |
| C8 yellow never text on paper, text on colored blocks readable | not shown | not visible in this image | UNVERIFIED |
| C9 state name is one of the book names | pass | Rest | PROVEN |
| C10 no real room name, home path or person name | pass | only the scratch folder name /tmp/mos-face-shots-XXXX and the fixture room demo-room show; grep of the files finds no home path and no real room name | PROVEN |
| C11 chip quotes the reply lead as written | not shown | not visible in this image | UNVERIFIED |
| C12 status parity fields with label and value | partial | here the panel read the room through the plugin tools: WRITES TO nothing - this session is not bound with [ Bind a room ], beside ROOM demo-room, Discovery stage, FILED, STALE, HEALTH; NOW says "This room has no identity yet, so its reasoning cannot be trusted to belong to it". The own status line of the plugin, drawn under the prompt box, reads "MindrianOS" for the room, then Next: map unknowns and v2.0.0-beta.74. The panel and the status line name different rooms, and the panel contradicts itself on the room (it says unbound, yet ROOM names demo-room) | PROVEN |
| C13 Job line form, guess label, buttons | partial | the Job heading shows; its statement is cut off by the bottom of the pane at 40 rows | PROVEN |
| C14 canon faces from the asset | not shown | not visible in this image | UNVERIFIED |

### Faces sheet (11 canon SVG faces over 11 block faces) (faces.png)

| Check | Result | What I saw | Label |
|---|---|---|---|
| C1 fits at 80x24, readable status words | not shown | not visible in this image | UNVERIFIED |
| C2 under 60 columns: words and text bar, actions kept | not shown | not visible in this image | UNVERIFIED |
| C3 NO_COLOR: meaning in words or shapes | not shown | not visible in this image | UNVERIFIED |
| C4 canon colors, badge Theo | MindrianOS, no panel text names Larry | not shown | not visible in this image | UNVERIFIED |
| C5 too small: plain message names the width | not shown | not visible in this image | UNVERIFIED |
| C6 every Button-looking element has a mechanism, hints name working slash commands | not shown | not visible in this image | UNVERIFIED |
| C7 no em-dash, no ICM, Brain or MCP in the panel area | not shown | not visible in this image | UNVERIFIED |
| C8 yellow never text on paper, text on colored blocks readable | not shown | not visible in this image | UNVERIFIED |
| C9 state name is one of the book names | not shown | not visible in this image | UNVERIFIED |
| C10 no real room name, home path or person name | pass | no text but state labels | PROVEN |
| C11 chip quotes the reply lead as written | not shown | not visible in this image | UNVERIFIED |
| C12 status parity fields with label and value | not shown | not visible in this image | UNVERIFIED |
| C13 Job line form, guess label, buttons | not shown | not visible in this image | UNVERIFIED |
| C14 canon faces from the asset | pass with one difference | the sheet shows the 11 canon labels: Rest, Listening, Searching, Found, Challenge, Contradiction, Reframe, Nothing found, Your decision, Boundary, Handover. Plane colors match in all 11 (cream, white, cobalt, red, yellow, black, grey). Bar tilt matches for the eleven (Challenge and Reframe lean left, Rest and Listening lean right, Searching leans right in the blue plane). Eye size is coarser at 12 cells but in line. Difference: Handover. The canon draws an outlined (hollow) bar and hollow square eyes; the block face draws a solid thin bar and solid small eyes, so the hollow shape is lost at this size | PROVEN |

## Captures of plans 16, 17 and 18 (G1, G3, G4, G5, G7, G2)

All taken on the dashboard docked beside the chat (46 columns), room of 18 sections, 3 of them with 16, 2000 and 4 files. All files of the fixture are new (just created), so every file row carries the cobalt "new" mark: that is a fixture effect, not a finding about real rooms.

| Capture | What it shows | Result | Label |
|---|---|---|---|
| pane/sent-denied.png | after /mos-advice with the shim tool missing and the raw call denied | PASS (G1): one line, "Theo was not asked: the call was not allowed". No "Theo was sent" row is drawn. | PROVEN |
| pane/sent-denied.png | the chat answer of the command still says "Asking Theo. A framework name, a problem type and a short excerpt of your own words are sent." above the panel line that says nothing was sent | FINDING (minor, honesty): the chat line reads as a claim after the call failed | PROVEN (image); fix is PREFERENCE |
| pane/sent-answered.png | after an answered call (stub) with a link and a code span in the person's words | PASS (G3): 'Theo was sent: "I want to test whether my market sizing assumption is right." (left out: a link, code)'. It says what was removed by kind and it wraps in 2 rows | PROVEN (against a stub, not Theo) |
| pane/job-hint.png | no recorded job, no cue in the talk | PASS (G4): 'Job: no guess yet. Say what you want to decide, test or find, in two different phrases, and one may come.' | PROVEN |
| pane/pane-wide.png, sent-*.png, job-hint.png | idle gauge | PASS (G5): eight white boxes, then the bold label "Context gauge: waiting for the first reply". The inline pane (pane-std.png) shows "Context: waiting for the first reply" with no boxes. The boxes are still 10 bright rows of 35 | PROVEN; keeping them is PREFERENCE (P17-2) |
| pane/tree-sections-big.png | tree, sections, 46x40 | PASS: pinned face tile, Theo | MindrianOS, Rest and the quote at the top; crumb row "demo-room  all 18"; all 18 sections in 18 button rows; Find and Close; hint; Refresh "read 3s ago". The body is 28 rows and the 18 sections fit in one page, so page 2 does not exist here | PROVEN |
| pane/tree-2000-p1-big.png | drill into the 2000 file folder, page 1 | PASS: crumb "~rchive-2000  1-28 of 300  first 300 of 2000"; 28 file rows; Up, Next, Find, Close; the header stays in view | PROVEN |
| pane/tree-2000-p2-big.png | page 2 | PASS: "29-56 of 300"; buttons Up, Previous, Next | PROVEN |
| pane/tree-folder16-big.png | drill into a 16 file folder | PASS: crumb "demo-room / evidence-16  all 16"; all 16 rows; header and crumb in view | PROVEN |
| pane/tree-find-legal-big.png | /mos-tree find legal | PASS: 'demo-room  2 matches for "legal"'; two rows legal-contracts and legal-review | PROVEN |
| pane/tree-cleared-big.png | /mos-tree clear | PASS: back to "all 18" | PROVEN |
| pane/tree-sections-p1-small.png | tree, sections, 46x24 (words header) | PASS: "demo-room  1-17 of 18" with 17 rows and Next, Find, Close | PROVEN |
| pane/tree-sections-p2-small.png | page 2 | DEFECT: "18-18 of 18" holds one row (team-roster) and 16 empty rows below it, then Previous, Find, Close at the foot | PROVEN |
| pane/tree-folder16-small.png | 16 file folder at 46x24 | the window is 17 rows, so "all 16" fits; the "1-14 of 16" case of plan 18 does not occur here | PROVEN |
| pane/tree-find-legal-small.png, tree-2000-p1-small.png | filter and 2000 folder at 46x24 | PASS: "2 matches for legal"; "1-17 of 300  first 300 of 2000" (the crumb is cut to "~rchive-2000", see the gaps) | PROVEN |
| pane/tree-toosmall-120x13.png | a docked pane of 8 rows | PASS: "/m:os needs 9 rows to browse the room", then a line that ends "/mos-tree still lists every name in the pro~" and [ Close ] | PROVEN |
| pane/tree-inline-80x24.png, tree-inline-60x24.png, tree-inline-50x30.png, tree-inline-nocolor-80x24.png | the inline pane (80x24, 60 columns, 50 columns) after /mos-tree | DEFECT for reach: the inline pane says "/m:os needs 9 rows to browse the room" and offers only [ Close ]. The command output in the chat lists 10 of 18 names. So at the book floor, the tree can be read only from the chat text | PROVEN |
| pane/explore-mos-tree-list-usage.png | /mos-tree list | DEFECT (docs): the command answers with its usage line; "list" is not a word it accepts, plain /mos-tree opens the view. The plan 18 summary says "/mos-tree list opens the view" | PROVEN |

The inline pane at 80x24 and at 60x24 gets about 6 rows (the box holds the tile of 4 rows, the state line, the quote and the context row). Plan 18 assumed 76x10. Not run: resize after open; hotkeys; Tab (none is drawn); the click on a name or a button (tmux cannot click).

## Clutter audit of the 80x24 and the docked views (numbers)

- Border-nesting depth: inline 80x24 has 1 border (the host's rounded box around the pane); docked has 0 boxes and one divider column. PROVEN (pane-std.png, pane-wide.png).
- Signals for the state Rest on the docked view: 3 (the word Rest, the face tile, the badge). The context state is told twice (the label and the eight boxes). PROVEN.
- Marks on every row: 18 of 18 section buttons carry both brackets and the triangle; 28 of 28 file rows carry the bracket and the cobalt "new" mark (fixture: all files are new). PROVEN (tree-sections-big.png, tree-2000-p1-big.png).
- Share of cells on chrome: docked 46x44 region of sent-answered.png: 1077 non blank cells, of which 164 are plane cells (face and gauge), 102 button cells and 93 border cells: 33 percent chrome and planes. At 120x40 (pane-wide.png): 952 cells, 164 planes, 68 button cells, 93 border cells: 34 percent. PROVEN (counted from the text captures).
- At 120x40 the overview does not fit its 35 rows: the Job statement, the Job buttons, THEO, SPEAKS, STANCE, MODE, VERSION and ASK are below the bottom. At 140x45 (40 rows) all of them show except the end of the VERSION row (cut at the pane edge: "update 9.9.9 is"). PROVEN.

## Banned word and dash hits (every .txt, listed by Task 1 Step 5)

| File:line | Hit | Class |
|---|---|---|
| chip.txt:10, installed/band.txt:10, installed/wide.txt:10, pane/pane-std.txt:6, pane/pane-narrow.txt:7, pane/pane-nocolor.txt:6, pane/pane-inline-60x24.txt:5, pane/pane-wide.txt:11, pane/sent-answered.txt:11, pane/sent-denied.txt:11, pane/tree-sections-big.txt:9 | the chat chip "Larry | MindrianOS" | quoted (the synthetic reply wrote it; the chat chip is drawn by the panel from the reply's own bold lead, D-07) |
| every file | em-dash or en-dash | none found |
| every file | ICM, Brain, MCP | none found |
| every file | Larry in a panel-authored line | none found; no hit is classed as panel, so C4 holds |

The word "MindrianOS" and "mos:" appear in the host's own message lines and in the badge; they are not on the banned list.

## Rubric score (mindrian-tui-consult, rubric-pageton, mapping ours: all yes = 5, 80 percent = 4, 60 = 3, 40 = 2, below = 1)

Evidence: the images above. Architecture and Code Quality are NA (a mod). Terminal Resilience has 4 of 5 lines UNVERIFIED (no resize, no cleanup run), so it is not scored.

| Category | Y | N | NA | Score | Notes (label) |
|---|---|---|---|---|---|
| Visual Design | 4 | 3 | 0 | 2 | N: more than 4 colors in view (white, cobalt, orange, gold, grey); the 10 idle gauge rows are noise; the "new" mark on every file row (PROVEN) |
| Layout and Composition | 3 | 2 | 1 | 3 | N: the pane is cut at the foot at 120x40 and text touches the edge ("update 9.9.9 is", quote cut with a tilde); NA: layout stability (UNVERIFIED) |
| Information Architecture | 3 | 2 | 0 | 3 | N: the key rows (Job, ASK) sit below the fold; density is 9 data rows in 40 (PROVEN, plan 17 audit) |
| Interaction Design | 4 | 0 | 3 | 5 | every Y rests on a slash route that works; no press was tried (UNVERIFIED); no focus mark is drawn (NA: none is promised) |
| State Handling | 3 | 0 | 3 | 5 | empty, error and too-small states are written (the denied line, the 9 row and 30 column messages); loading and transitions NA (UNVERIFIED) |
| Navigation | 4 | 1 | 0 | 4 | N: the crumb "~rchive-2000" loses the room and cuts a word (PROVEN) |
| Component Quality | 0 | 2 | 4 | 1 | N: the VERSION row is cut with no mark; no selection mark on list rows (PREFERENCE) |
| Accessibility | 2 | 1 | 2 | 3 | N: the NO_COLOR band draws white bars (PROVEN); the NO_COLOR pane is fine (PROVEN); contrast on light themes UNVERIFIED |
| Architecture and Code Quality | | | all | NA | |
| Terminal Resilience | 1 | 0 | 4 | not scored | 4 lines UNVERIFIED |

Sum of the 8 scored categories: 26 of 40. This sum and the mapping are ours; neither source gives one.

Nielsen's three: visibility of system status: yes (the delivery line, the counter, "read 3s ago", the gauge label; PROVEN). Error prevention: yes for the denied call, but the chat line "are sent" stays after a denial (PROVEN, minor). Match the real world: partly; the recorded job text uses "Hughes 1983 reverse salient", which is not plain English (D-04, PROVEN in sent-answered.png).

Usability then brand, honesty above both (consult skill): honesty passes for G1 and G3 on a real screen. Usability fails at the sizes people use (the fold, the inline room). Brand is restrained apart from the idle boxes.

## Gaps for the main session (repair plan 380-19)

Labels: all PROVEN unless said.

1. C12 and C13 at 120x40 and inline sizes: the Job statement and its buttons, THEO, SPEAKS, STANCE, MODE, VERSION and ASK are below the fold at 120x40 (35 pane rows) and out of view in the inline pane (80x24, 60x24, 50x30: only the tile and the context row show). Images pane-wide.png, pane-std.png, pane-narrow.png. Fix: fold the overview so NOW, NEXT and Job fit in 24 rows (cuts from the plan 17 audit that need a ruling: idle canvas rows, blank separators, hints).
2. C2: under 60 columns the face tile is drawn (narrow.png, pane-narrow.png). Either the width ladder of the book applies (words and a text bar) or the plan 18 constant (tile from 40 columns) needs a book follow-up. Needs a ruling.
3. C3: with NO_COLOR the band draws six rows of plain white bars (nocolor.png). The pane switches to words (pane-nocolor.png). Fix: the band reads the plain flag at session start.
4. C5 on the band: at 28 columns the band disappears with no message (small.png). The pane shows the 30 column message (pane-small.png). Minor.
5. G7 reach: the inline pane cannot open the tree ("needs 9 rows"), so at the 80x24 floor and in a 60 column split the tree is reachable only through the chat text (tree-inline-*.png). Plan 18 tested 76x10; the real room is about 6 rows. Needs a ruling: draw the tree in the chat area, or allow the inline pane to grow.
6. Tree crumb: on the counter row the crumb is cut at the start inside a word ("~rchive-2000", tree-2000-p1-big.png, tree-2000-p1-small.png). Fix: counter on its own row or cut at a name boundary.
7. Tree pager: with 18 names and a 17 row window, page 2 holds one name and 16 empty rows (tree-sections-p2-small.png). Fix: balance the pages.
8. /mos-tree list answers with the usage line (explore-mos-tree-list-usage.png); the plan 18 summary and the Sections hint say otherwise. Fix: accept list, or correct the summary.
9. The chat text after /mos-advice says the words "are sent" while the panel says Theo was not asked (sent-denied.png). Minor honesty fix: say "Asking Theo" only.
10. C14: the Handover block face loses the hollow bar and hollow eyes of the canon face (faces.png). PREFERENCE (a 12 cell limit).
11. Panel contradiction on the real tools path: "WRITES TO nothing - this session is not bound" beside "ROOM demo-room, Discovery stage" (installed/wide.png). The plan 17 audit item 2, still present.
12. The grey load notice box overlaps host text at 80 to 100 columns (std.png, narrow.png, pane/job-hint.png). It is the session start message of the panel shown by the host. Minor.
13. Not diagnosed: in every scratch capture NOW says "Theo is not answering its health check" while the status line fixture says the brain is ok. The panel runs its own probe. Cause UNVERIFIED (scratch network, python or the probe). The real-tools path shows a different NOW. See 380-LIVE-EVIDENCE.md.

## Needs a real screen

The person's own terminal font and theme; the host's select-label colors on a light theme; any click on a button or a name (tmux sends no mouse); resize after the pane is open; Tab, Enter and hotkeys (none is drawn); the person's real room (age of files, so the "new" mark is not on every row); Windows (python3 and the 120 second poll); a live model reply with a live Theo answer; Desktop and Cowork (deliberate skip N7).

## Verdict (one line)

Honest and mostly readable on the docked pane at 46 columns, with G1, G3, G4 and G5 fixed on a real screen, but it fails C2, C3 (band), C12 and C13 at the sizes people use, and the inline pane cannot reach the tree at the 80x24 floor: STATUS PARTIAL.

## Five worst problems and the exact fix (consult skill format)

1. The overview is taller than its room at every size (gap 1). Fix: apply the plan 17 cut list after a ruling so NOW, NEXT and Job fit in 24 rows.
2. The inline pane hides the tree and the overview (gaps 1 and 5). Fix: let the inline box grow to the rows it needs, or put the tree in the chat text with the pager.
3. The NO_COLOR band is six white bars (gap 3). Fix: the band follows the plain flag.
4. Under 60 columns the face tile stays and the dashboard button breaks over two lines (gap 2). Fix: words and a text bar below 60 columns; one line button label.
5. The tree crumb and pager (gaps 6 and 7). Fix: put the counter on its own row; balance the last page.

