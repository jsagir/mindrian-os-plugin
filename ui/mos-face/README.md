# mos-face

The /m:os face panel mod. It draws a side panel, one status line and buttons in the prompt box, natively in the Claude Code terminal. It shows the state of the room in plain English.

## Walled package

This folder is a walled package (CLAUDE.md D-17, Phase 369.26 precedent, D-05 of Phase 380).

- It has its own folder, its own package.json and its own package-lock.json.
- It is never in the root package.json or the root npm-shrinkwrap.json.
- Nothing from ui reaches the tarball. Only built output ships, under lib/mos-face/dist, in a later plan.
- Its one devDependency is typescript, at the same exact version and integrity as tools/ts-check.
- The engine writes .claude-plugin/types itself. That folder is never committed.

## How to run it

Run these commands in this folder.

- Load it in a session: `claude --plugin-dir ui/mos-face` (from the repo root).
- Test it: `claude plugin test .` (34 original tests and the egress tests).
- Check the plugin shape: `claude plugin validate .`
- Type-check it: `npm run typecheck` (the script lands in a later plan).
- Build it: `npm run build` (the script lands in a later plan).
- Install the lockfile: `npm ci --ignore-scripts`.

## Egress

What leaves the machine (Canon Part 8, decision D-03 of Phase 380, plan 380-04). Three calls and no more.

1. The ask to Theo through the guarded shim tool. It carries a framework name, a problem type and, by default, a short excerpt of the person's own recent words (at most 240 characters). The panel shows the excerpt in full ("Theo was sent: ...").
2. The same ask to the raw theo server, only when the shim failed or was denied. With proposal P1 on, it carries a framework name and a problem type only.
3. A search on the raw theo server. Its query is one framework name or one problem type from a closed list (HANDLE_QUERIES in hooks/advice.ts). It never holds a word of the person.

Never sent: assistant text, room files, claims, artifacts.

### What the excerpt removes

Before anything is sent, `sanitize` removes code, links, email addresses, file paths and key-like strings. Then `stripNames` removes names with three rules. A run of removed words becomes one "(a name)".

- S1, known names: the room slug, each part of it (3 letters or more), the workspace folder name and the session folder name. Whole words, any case. A plain function word inside a slug (the, and) is left out of the list.
- S2, proper names: each capitalized word that does not start a sentence, and each all-caps word of 2 letters or more. The words of the framework names and problem types, Theo, PWS, MindrianOS, the pronoun I, weekday and month names and the acronyms PWS JTBD SWOT PEST API AI UX MVP ROI KPI are kept.
- S3, sentence starts: the first word of each sentence (start of text, after a full stop, a question mark, an exclamation mark or a line break) goes, unless it is a common word (COMMON_STARTS in advice.ts), a cue word of a framework rule (so Customers, Symptom or Blocked survive) or a framework word. "Acme is losing money" loses Acme. "We lost three deals" keeps We. A plain noun at the start of a sentence (Money) is removed too: that costs a little fit and never leaks.

### Residual risk

A name typed in lowercase in the middle of a sentence is not caught, unless it equals a known name (S1). A name in a script without capital letters is caught only by S1. The panel shows the excerpt in full and /mos-words turns it off. The plugin egress guard is a second line on the shim path; its effect on a call that a plugin module makes is UNVERIFIED (tests/test-380-egress.cjs prints what the guard says about the six question shapes).

### Default and opt-out

The excerpt is on by default (owner ruling 2026-10-21). Two ways to turn it off.

- /mos-words in the session, or the Words button in the panel. This lasts until the session ends. PROVEN across two separate `claude -p` processes at plan time: a new session starts with the excerpt on again. Plan 10 proves it again on the shipped build.
- MOS_FACE_WORDS=off (also 0 or false) in the settings environment. The excerpt is then off from the start of every session. /mos-words turns it on for that session. This works only while proposal P2 is on.

### Two proposals, one flag each

Both go beyond D-03 as written. Both are planner proposals, on by default, in hooks/proposals.ts. The navigator can veto either in plan 11, section B.

- P1 shimOnlyExcerpt: the excerpt travels only through the guarded shim. Reason: the raw theo server never passes lib/core/part8-egress-guard.cjs (CLAUDE.md, THEO-04).
- P2 envSwitch: MOS_FACE_WORDS=off at session start makes the opt-out last. Reason: the opt-out does not survive a new session.

A veto is one flag set to false, the dist rebuilt (node scripts/build-mos-face.cjs, added by plan 380-08) and the tests re-run. tests/egress.test.ts reads the flags and holds for both values of each, so no test edit and no re-plan is needed.

## Budgets

The mod adds no hook and no read that can starve a prompt (MOD380-05). The tests in tests/budget.test.ts and the gate tests/test-380-budget.cjs pin everything on this page.

### The hook list

The module registers events only: session.start, 13 command.run commands (mos-state, mos-face, mos-style, mos-chip, mos-suggest, mos-ask, mos-refresh, mos-words, mos-text, mos-plain, mos-advice, mos-auto, theo-calls), prompt.submit, turn.start, tool.call, turn.complete and 5 ui.render entries. There is no shell hook. The module's hooks/hooks.json holds only the module list, and the hooks.json of the plugin names no shell command for this mod. `claude plugin validate --json` prints the list, and the gate fails on any addition.

prompt.submit and turn.start do no file, tool, network or process work and never wait on the clock.

### The limits the tests assert

| Limit | Value | Test |
|-------|-------|------|
| Tick of the panel | every 120 seconds | B3 |
| Tool reads on a tick | at most 4 | B3 |
| Subprocesses | 0 | B1, G1 |
| Network fetches on an ordinary tick | 0 | B3 |
| Reach checks (Theo health, the website) | every 600 seconds, started together, each cut off after 4 seconds with no status | B3, B4 |
| A read of the room | cut off after 30 seconds | B5b |
| Slow read | over 8 seconds | B5 |
| Back-off after a slow or failed read | the next ticks wait 2x, 4x, then 8x of 120 seconds, never more than 600 seconds | B5, B5b |
| A quick read | resets the wait | B5 |
| The person's own refresh (/mos-refresh, the Refresh button) | always reads, and asks Theo and the website again | B5 |
| Reads in flight | one (a second refresh during a read is ignored, for 45 seconds at most) | B6 |
| Timers | the 220 ms spinner stops when the turn ends; the 400 ms flash stops when the flash ends | B8 |

### Where the home and rooms folders are

The panel finds them the way the plugin does: the home folder is HOME, then USERPROFILE (a native Windows process may not set HOME). The rooms folder is MINDRIAN_ROOMS_HOME when it is set, else the home folder plus /MindrianRooms (lib/core/cross-room-aggregator.cjs holds the same rule). Paths use forward slashes. A registry that holds the default root with a tilde follows the same rule. This also lets a test or a hermetic screenshot point the panel at a scratch rooms folder.

### No python

The panel no longer needs python3. The old fallback ran a python3 graph query. It is removed (SEED-142 named the Windows gap: python3 is not on a default Windows PATH). The graph numbers come from the room tools. When those are out of reach, the panel reads the room from files and says the graph numbers were not read, instead of guessing.

### Not measured yet

The real idle CPU cost of the panel on a machine is measured by plan 380-10 and is UNVERIFIED until then. This page states limits, not a CPU number.

## Copy

The panel speaks as Theo, in plain English (D-04). Every word it writes follows these rules. The rules come from the mos-brand book e947a5d (read only, at /home/jsagi/mos-brand).

What the words must be:

- Clear, curious, demanding, grounded, warm and practical: short paragraphs, concrete nouns, no hype word, and generated text is never called validated evidence (mos-brand book e947a5d, segment writing/voice).
- No em-dash and no en-dash. A dash is a release blocker (mos-brand book e947a5d, references/brand-rules.md, rule 1).
- Theo supports the inquiry and the person keeps the judgment (references/brand-rules.md, rules 3 and 4).
- The panel names the thinking partner Theo. The panel never introduces a second character (segment identity/naming).
- Say Theo, never Brain. Say data room, never ICM. A button never runs anything: it puts a command or a question in the prompt box. Nothing looks pressable unless a real mechanism presses it (segment experience/terminal, status PROPOSED, so each of these carries that status).
- No MCP word, no Aura word, no person's name and no institution's name.

What the tests scan:

- tests/copy.test.tsx draws the band and the pane in 7 states, 4 face styles, 4 widths (100, 48, 40 and 30) and plain mode, opens every block, and scans every Text and every Button. It also scans the 13 command descriptions and results, every toast, and every table (glossary, thoughts, labels, why lines).
- tests/test-380-copy.cjs reads every string of the hook sources (also JSX text) and scans the manifest description. It runs the commands check below.
- scripts/face-commands.cjs --check keeps hooks/commands.ts honest against data/command-registry.json: no unknown command, no stack word, no PLUGIN_VERSION constant. A changed registry sentence only warns. Run --write, then the build.
- A command name such as /mos:brain-derive is a name the plugin owns. The scan removes command names before it looks for words.

The reply chip (D-07, Quote the reply as is): the colored chip in a reply quotes the reply's own lead as it stands. It adds, removes and rewrites nothing, and it is built from the reply, never from panel copy. So the word Larry appears in the chip only when the reply put it there. The move glyph of the reply is shown as the color of the chip, as before.

The glossary is vendored text from the owner's PWS repository. It is scanned for names, never edited here. Whether it ships in the public tarball is the owner's decision (plan 11).

## Surfaces

The panel draws only in the Claude Code terminal. Desktop and Cowork get no panel in this phase. This is a deliberate skip (D-05, N7). Their plain MCP reads stay as they are.

## Decisions

Written in plan 380-07. The canon is the mos-brand book e947a5d (read only, /home/jsagi/mos-brand). The terminal segment `segments/experience/terminal` is PROPOSED in the book: the owner has not ruled on it, so each rule taken from it carries that status. A rule taken from `segments/foundations/color`, `segments/identity/theo/states` or `segments/identity/theo` is ruled. The tests behind this section are tests/colors.test.tsx and tests/test-380-decisions.cjs.

### N2 Colors

The face and the panel follow the canon colors by state (mos-brand book e947a5d): `segments/foundations/color` (tokens and the contrast table) and `segments/identity/theo/states` (what each state must not imply). In the face: blue is building, red is challenging, yellow is contradiction or reframe, black is the human decision, white is handover. The older workspace-mod ruling C-32 (ui/mindrian-workspace-mod, 2026-10-06: no yellow, no blue, red only for points with no evidence) is superseded for this panel by the navigator ruling of 2026-10-23 (D-02). The book itself marks the terminal color roles as "Owner decision needed" (`segments/experience/terminal`, PROPOSED), and this panel does not take its roles from that text.

- Blue is attention, never proof. A blue route is attention, not proof (`segments/foundations/color`). Found does not imply correctness, verification or approval (`segments/identity/theo/states`). Test K4 fails if the search or found state draws the words proof, proves, proven, verified, validated or correct.
- Yellow is a plane or a chip ground with ink text on it. Yellow text on paper fails (`segments/foundations/color`). Test K3 and a static scan fail on any yellow text.
- There is no green state, and no state named like a breakthrough (`segments/identity/theo/states`). Test K6.
- Words carry the meaning; color never does alone (`segments/experience/accessibility`).

Contrast, computed by the test and equal to the book table within 0.05:

| Pair | Tested | Book |
|------|--------|------|
| ink on paper | 17.31 | 17.31 |
| soft ink 4B4943 on paper | 8.25 | 8.25 |
| paper on cobalt | 7.63 | 7.63 |
| paper on red | 4.60 | 4.6 |
| ink on yellow | 11.23 | 11.23 |
| ink on white | 18.88 | 18.88 |
| yellow on paper (never text) | 1.54 | 1.54 |

Every move chip pair of the panel is at least 4.5. Two pairs are below the floor and are recorded, not hidden: the heading marker is soft ink (2.10) or cobalt (2.27) on ink, under the 3 to 1 floor for meaningful non-text (`segments/experience/accessibility`). The heading words stay in paper, so no meaning is lost, but the focus change is carried by color alone. This is open for plans 380-10 and 380-11.

### N4 Two status lines

Default: both are kept, the plugin's own line and the panel's pinned NOW line. The book (mos-brand book e947a5d) records that an old status line still draws beside a new band, and says "both show until the person removes the old one" (`segments/experience/terminal`, PROPOSED). The panel's line is silent when all is quiet, and the plugin line keeps context, stage and version, as the same segment says. The clash with ui/mindrian-workspace-mod, which also draws a band and a pane, is avoided because that package is dev-only (its README says "Dev-only load"). Test D4 fails if it ever ships, so a person decides before two panes can draw.

### N5 Commands

The names stay /mos-* with a hyphen (a decision the book does not rule, so there is no segment text to cite beyond mos-brand book e947a5d, `segments/experience/terminal`). The plugin's own commands use a colon (/mos:*), and the colon names are not renamed. /mos-words stays the opt-out of the own-words excerpt (see Egress). The book has no entry for opt-out and consent controls, and no ruling on command names (`segments/experience/terminal`, PROPOSED, rules only that every button has a slash command). Plan 380-11 proposes a book segment for opt-out and consent controls. The proposal is not in the book.

### N6 Secondary text on ink

The panel uses dimmed paper for secondary text. The book (mos-brand book e947a5d) says it has no token for secondary text on ink and that the panel uses dimmed paper (`segments/experience/terminal`, PROPOSED). Measured: paper at 50 percent over ink is #848380, and its contrast over ink is 4.98 to 1, above the 4.5 floor of `segments/experience/accessibility`. This is a stand-in for the host's own dim rule, which is UNVERIFIED on a real screen until plan 380-10. Soft ink is never used as text on ink (2.10 to 1). Plan 380-11 proposes a token to the book. The proposal is not in the book.

### N7 Surfaces

The panel draws only in the Claude Code terminal (mos-brand book e947a5d covers the terminal only). Desktop and Cowork get no panel in this beta. They keep the same plain tool reads. This is a deliberate skip of the tri-polar rule (CLAUDE.md), not an oversight, because the engine hooks that draw a pane exist only in the terminal. The book has no text for Desktop or Cowork: its terminal segment covers the terminal only (`segments/experience/terminal`, PROPOSED). Plan 380-11 proposes a fallback segment. The proposal is not in the book.

### N9 State map

The book (mos-brand book e947a5d) names 11 states (`segments/identity/theo/states`: "use exact state names"). The panel draws 7 and writes each label as the book's exact name. Four have no pose here on purpose: a pose would be a new panel feature, and no real event sets it. A state is mapped only where a real event exists.

| Book state | Mod state | Drawn label | What happens in the panel |
|------------|-----------|-------------|---------------------------|
| Rest | rest | Rest | No current intervention. |
| Listening | listen | Listening | A turn began and Theo is attending. |
| Search | search | Search | A real call to Theo is running. The state ends when the call ends. |
| Found | found | Found | A call to Theo returned material. It does not mean the material is right. |
| Challenge | unmapped | none | No event sets this pose. The red chip shows when a reply leads with the challenging marker. |
| Contradiction | unmapped | none | No event sets this pose. The yellow chip shows when a reply leads with the contradiction marker. |
| Reframe | unmapped | none | The plugin has no reframe marker, so there is no real event. Reframes reach the person in words. |
| Limit | none | Limit | A call to Theo returned nothing. The words say that nothing was found. |
| Your decision | unmapped | none | The panel never asks for a decision. The black chip shows when a reply leads with the gate marker. |
| Boundary | refused | Boundary | A call was blocked by the permission mode. The panel says what it could not read. |
| Handover | handover | Handover | A turn finished with an answer. It does not mean the project is complete. |

Two things stay as the asset has them: the asset file calls two states "Searching" and "Nothing found" in its visible-label field. The states entry says to use exact state names and to localize visible labels, so the panel writes Search and Limit. The detail line keeps the plain words of what happened.

### HOLLOW

HOLLOW (#8F8B80) is the one tone in face.ts that is not a canon token. The canon draws a hollow pose (Handover) as a white fill with an 8 unit ink outline. A pixel grid cannot show an outline that thin, so the panel fills the bar and the eyes of the hollow pose with this grey. It is not a canon token and it is not used anywhere else. Plan 380-11 asks the book for a ruling.

### GEOMETRY

The face poses are the canon poses, number for number, never a redraw: mos-brand book e947a5d, `segments/identity/theo/entries/2026-10-19/asset-fa8504998f.json`, drawn by the renderer `segments/identity/theo/entries/2026-10-19/asset-d96217b320.js` on a 400 unit master. The sha256 of the asset file is e54e7c6a3c11a039059fb47833b09e865cd3981e2910b4f13571e87c06682da2. Test K7 compares every pose and plane with the table in tests/canon.ts, and tests/test-380-decisions.cjs compares that table with the book. Before plan 380-07 the poses were an older copy of the geometry and none of the 7 equalled the canon; Boundary also drew a black plane where the canon draws red.

What the panel does not draw from the canon: the 14 unit frame round the tile (it is smaller than one cell at 6 to 16 cells), the outline of a hollow pose (see HOLLOW), and the motion fields of the asset (sway, bob and still; the panel only moves the running mark on the ground line while a call runs). The canon's easing is an open question in the book itself, and a terminal has no easing.
