# Phase 380 discuss-phase answers from the mos-brand book

Protocol: agent-interaction-protocol applies. Claims are marked PROVEN (I read or ran it), UNVERIFIED, or ASSUMED. No em-dashes. Canon Part 8: no user data was sent to the Brain.

## 0. Which book, and what it says about itself

- The canon (mos-brand book e947a5d): /home/jsagi/mos-brand, package version 2.43.0, git HEAD e947a5d, branch book-fixes-site-phase-62-63. PROVEN (`mos-brand --version`, `git rev-parse`). Navigator ruling: this checkout IS the canon. Cite every ruling below as "the canon (mos-brand book e947a5d)" plus the segment path. No other copy is authority; the site copy was compared only as a check.
- Installed copy /home/jsagi/dev/mindrian-website/site/node_modules/mindrian-design-system: version 2.43.0, site/package.json pins `github:jsagir/mos-brand#e947a5d`. A `diff -rq` against the clone showed only repo-only files (.git, .github, .gitignore, .gitattributes, consumers, package-lock.json). PROVEN. No content difference. I did not touch website/node_modules (old pin 3340eb2).
- The canon does not call itself v5 or any earlier name. I searched ROOM.md, INDEX.md, CONTEXT.md, package.json, README.md, references/brand-rules.md and references/workflow-adoptions.md. None define a canon label or number. PROVEN (grep).
- The only places the book says "Canon v5" are the proposed terminal segment and its skill: segments/experience/terminal/CONTEXT.md line 33, segments/experience/terminal/segment.json (humanCheck), segments/experience/terminal/entries/2026-10-20/GUIDE.md lines 12, 54, 65, and skills/mindrian-tui-designer/SKILL.md line 14. The label there points to an owner "terminal consult skill" ruling of 2026-10-06, not to a book-wide canon. PROVEN. The label is a stale name inside a proposed segment; I do not use it as authority and do not apply it to the canon. Open item for the navigator: the proposed terminal segment should drop or define that label (see N1).
- Supersession check. references/workflow-adoptions.md records: the brand-color-lockup intake supersedes the full-blue face treatment (lines about "Corrected logo face and wink"); the Phase 59 owner rulings D-01 to D-05 dated 2026-10-21 (stage faces use book state colours; type scale; geometry and timing; quiet paper #ECEAE2); and owner-authorised rulings dated 2026-10-23 (figure text floor, scaled dash pair). I quote below only from current segment entries and these dated rulings. No quoted rule comes from a superseded entry. PROVEN for the files read; UNVERIFIED for entries I did not open (forms/engagement, uiux-rulings, motion recipes).
- Book status limits. experience/terminal is status `proposed` (owner has not ruled). experience/uiux-rulings is pending (workflow-adoptions: "Planned UI/UX rulings are pending, not passed"). PROVEN.

## 1. How the book was asked (read-only)

- Scratch consumer: /tmp/claude-1000/-home-jsagi/c03816a4-113f-4230-9448-0156b88f0247/scratchpad/consumer (intake copy at .../scratchpad/intake-380.json). The plugin repo and ~/mos-brand were not written. PROVEN (init, configure, adopt --apply ran only with --project pointing at the scratch folder; `git status` of the book shows only the two foreign untracked consumer files that were there before).
- Intake declared: who = product "M:OS face panel mod", MindrianOS plugin team; what = side panel, one-line status, prompt-box buttons and /mos-* commands shipped in the plugin; surfaces = terminal, app-ui, mcp-tool; language en; JTBD = when I work in a room in Claude Code, I want to see room state beside the chat, so I act without running a command.
- Result: configure ok (47 segments). Direct segments: experience/terminal (proposed), experience/accessibility, experience/layout, foundations/tokens, identity/theo/states. Adjacent: foundations/color, foundations/typography, identity/theo, identity/theo/framework-language, identity/spoken-voice, identity/logo/favicons, experience/forms/engagement (proposed), experience/faq. Baseline: writing/voice, writing/punctuation, references/brand-rules.md. PROVEN (context.json in scratchpad).
- Not routed by these surfaces: experience/motion. I read it anyway for the motion question. Surface `mcp-tool` has no segment of its own. UNVERIFIED whether a better surface choice would route motion.

## 2. Gray areas

### G1. Where the mod installs and how it loads from the plugin
- Question: What loads the panel after `claude plugin install`, with no manual copy (MOD380-01)?
- Canon ruling (e947a5d): BOOK-SILENT. The book governs look and words, not packaging. Nearest text: segments/experience/terminal/entries/2026-10-20/GUIDE.md "Side panel template" says the panel is "a companion to a host session: a docked panel, a pinned status line, and the prompt box as the only place an action lands."
- Status: BOOK-SILENT. Not a design question; a packaging question for the plugin's own rules.
- Facts found (not book): plugin.json (2.0.0-beta.72) has no mod field. PROVEN. A precedent exists: ui/mindrian-workspace-mod (Phase 369.26), loaded with `claude --plugin-dir ui/mindrian-workspace-mod`, declared "a walled package", never in root package.json, files array or tarball (its README and package.json). PROVEN. How a released plugin makes that mod load for an installed user is UNVERIFIED (the README says its live render check is PENDING-HUMAN). Owner fact: the mod backup is a plain copy, not a git repo (handoff note).
- Note: the mod's hooks.json is `{ "modules": ["./register.tsx"] }` (PROVEN). Phase 380 depends on the 369.26 precedent for how that loads.

### G2. Panel states and voice colors
- Question: Which colors mean what in the panel and the face?
- Canon ruling (e947a5d): BOOK-RULED for the face and the palette. identity/theo/states (segments/identity/theo/states/entries/2026-10-19/content.html) names 11 states with a "What must not be implied" column: Rest, Listening, Search (blue plane), Found, Challenge (red plane), Contradiction (yellow plane), Reframe, Limit, Your decision, Boundary, Handover. foundations/color (entries/2026-10-19/content.html): "In Theo's face, the colors preserve the authored voice vocabulary: blue building, red challenging, yellow contradiction or reframe, black human decision, white handover." "A blue route is attention, not proof; label its status separately." "Yellow text on paper fails." Tokens: paper #F7F5EE, ink #111111, soft #4B4943, cobalt #1F3FBF, red #D6281F, yellow #F2C200. Rule: "Do not add a green breakthrough achieved state." "The face supports the words; it never replaces them" (identity/theo content). "Use color with a defined meaning ... Evidence status always has words."
- Status: BOOK-RULED for face colors. CONFLICT for the terminal color roles: experience/terminal GUIDE.md "Color roles: two sources disagree" lists Claude Code mods (red = assumption needing examination, never a generic error; blue = evidence; yellow = contradiction) against plugin ui-system (red = errors, yellow = warnings, green = success, cyan = commands). The book itself says "Owner decision needed" and picks neither. I record both and pick neither.
- Mod check (PROVEN, read hooks/face.ts and tests): the mod uses 7 face states (rest, listen, search, found, none, refused, handover) in types/index.d.ts, against the book's 11. The book states Challenge, Contradiction, Reframe, Limit, Your decision exist; the memory note lists the same 11 as "Theo states". Gap for plan: map or add states. UNVERIFIED how the mod draws "Move" colors (blue, red, yellow, black, white exist in types).
- Owner facts that stand: memory ruling 2026-10-21 (face colors keep the voice vocabulary; blue is attention, never proof). Ruling 2026-10-06 (C-32 in the workspace mod README): red only for points with no evidence; no yellow; no blue in pane. Those C-32 facts conflict with the book's face colors; see N2.

### G3. Button labels and copy (plain English)
- Question: What do the buttons and panel lines say?
- Canon ruling (e947a5d): BOOK-RULED on style. writing/voice (segments/writing/voice/entries/2026-10-19/content.html): "Clear, Curious, Demanding, Grounded, Warm, Practical"; "Write like a thoughtful colleague examining real work. Use short paragraphs and concrete nouns."; prefer project, question, explore, connect, structure, evidence, assumption, possibility, next move; avoid "revolutionary, game-changing, supercharge, ... instant insight, AI workforce and autonomous strategist"; "Do not describe generated content as validated evidence." references/brand-rules.md rule 1: never em dashes (release blocker); rule 4: "The person retains judgment"; rule 5: facts, assumptions, proposed connections and results stay distinct. experience/terminal GUIDE.md: "Plain English in the teaching voice. Say Theo, never Brain. Say data room, never ICM." and "Never draw something that looks pressable unless a real mechanism presses it." Side panel template: "A button never runs anything. It puts a command or a question in the prompt box."
- Status: BOOK-RULED for style. Terminal segment is proposed, so its rules carry "proposed" status.
- Conflict on the persona name: see G9.
- Mod check: the mod's /mos-face help says "the Theo faces box" and uses "data room" style words (PROVEN in tests list); Larry-voice not confirmed. UNVERIFIED whether any em-dash or ICM or Brain word exists in the mod copy. I did not run `mos-brand review` on the mod because it reads Markdown, HTML or text. Recommend running it on the generated text.

### G4. What the Theo ask sends (Canon Part 8)
- Question: What may the panel send to Theo?
- Canon ruling (e947a5d): BOOK-SILENT on data egress. The book rules claims and honesty ("Do not describe generated content as validated evidence"; "Show no success before it is confirmed", GUIDE.md "Honesty sits above both"), not Part 8. Transparency fits the book rule 5 "keep facts ... distinct": the mod shows the sent text in full.
- Status: CONFLICT inside the project (not the book). MOD380-03 in ROADMAP.md (line 3789) says "the Theo ask sends handles only and no room content (Canon Part 8)". The owner ruling 2026-10-21 (memory feedback_panel_may_send_own_words_to_theo.md) allows a cleaned excerpt of the person's own prompts, 240 characters, on by default, off with /mos-words, always shown in full; never assistant text, room files, claims. CLAUDE.md line 51: "User data NEVER egresses to the Brain". Both recorded; not picked. See N3.
- Facts from the mod (PROVEN, hooks/advice.ts): `sanitize` and `wordsFor` build the excerpt; `questionFor` builds the question; `askTheo` calls `brain_ask` through `mcp__plugin_mos_mindrian-brain__brain_ask` then `mcp__theo__brain_ask`. ALSO `searchChapters` calls `mcp__theo__search` with up to 8 words (4+ letters) taken from the same excerpt. That is a second egress path. The ruling text names only brain_ask. When words are off, `words` is '' and searchChapters is skipped (PROVEN by reading line 262 and the test "Words: shared can be switched off" passing). The 240-char cap is applied by sanitize; whether the 8 search words are sanitized the same way is PROVEN (they derive from `words`, which is the sanitized text).

### G5. The one-line status
- Question: When does the status line speak and what does it say?
- Canon ruling (e947a5d): BOOK-RULED, from the proposed terminal guide: "Status line: The 'now' line in one breath. Silent when all is quiet. Context, stage and version stay on the plugin line." and "One signal: A state is said once in the panel. The status line may repeat it, because the panel can be hidden." (GUIDE.md Side panel template). Words carry meaning, color never alone.
- Status: BOOK-RULED but PROPOSED status (terminal segment). The mod follows this (test: "the status line is the NOW line in one breath, and says nothing when all is quiet" passes, PROVEN).
- Open: two status lines. GUIDE.md "Measured on a real terminal": "An old status line still draws beside a new band: Both show until the person removes the old one." The book records the fact, not a decision. Owner recommendation (memory): keep both. Not ruled. See N4.

### G6. /mos-* command names and the opt-out
- Question: Are the names and the opt-out right?
- Canon ruling (e947a5d): BOOK-SILENT on names. Related rule: GUIDE.md "Keyboard routes: Every button has a slash command, and a hint line at the foot names them. Hotkeys do not fire from the prompt box." and "A hint that names a key says where that key works. A slash-command hint is always safe." Naming: segments/identity/naming (entries/2026-10-19/content.html) rules spelling: "Spell MindrianOS, m:os, Theo and DataRoom consistently. Keep m:os lowercase" (voice segment). Rule 2 in brand-rules.md: exact logo, LTR.
- Status: BOOK-SILENT for the command names and the opt-out. Facts (PROVEN): 12 commands in the handoff, but register.tsx also registers /mos-words (memory ruling) and the list is built in a loop at register.tsx lines 548-565. The exact count is UNVERIFIED (I did not count the registered names). Naming mismatch to flag: `/mos-*` is a hyphen name that sits beside the plugin's `/mos:*` names (colon) and `/m:os`. UNVERIFIED which the owner wants.
- No book segment covers an opt-out or a settings surface for a plugin feature. Propose a segment entry under experience/terminal: "opt-out and consent controls". See N5.

### G7. Accessibility and contrast
- Question: What accessibility floor does the panel meet?
- Canon ruling (e947a5d): BOOK-RULED. segments/experience/accessibility/entries/2026-10-19/content.html: "Target WCAG 2.2 AA for production interfaces. Ordinary text needs at least 4.5 to 1 contrast; ... meaningful non-text UI ... 3 to 1"; "Use labels as well as color"; "Aim for 44 px comfortable interactive targets; WCAG 2.2 AA's target-size minimum is 24 CSS px"; "Respect prefers-reduced-motion". foundations/color: ink/paper 17.31:1; soft #4B4943 / paper 8.25:1; paper/blue 7.63:1; paper/red 4.6:1; ink/yellow 11.23:1; "yellow / paper 1.54:1 do not use for text". Terminal guide: "Respect NO_COLOR. Keep the screen readable at 80 by 24, and compact it below 60 columns." and "Words carry the meaning. Color never does alone."
- Status: BOOK-RULED. A terminal has no CSS px, so the 24 px and 44 px floors do not map; BOOK-SILENT on terminal target size and on terminal color contrast against the host's own palette. GUIDE.md says host select labels use host colors and are "unreadable on cream until measured". See N6.
- Open question already in the book: "the book has no token for secondary text on ink. The panel uses dimmed paper." (GUIDE.md Ground and color). BOOK-SILENT. Owner question stands (memory also lists it).
- Mod check (PROVEN, tests pass): plain mode (NO_COLOR) keeps every meaning; too small (<30 cols) shows a message; narrow mode shows words and a text bar; the width ladder 50/40/30 matches the GUIDE.md ladder.

### G8. Terminal vs Desktop vs Cowork (tri-polar)
- Question: Where does the panel work?
- Canon ruling (e947a5d): BOOK-SILENT. The terminal guide covers the terminal only. No book segment names Desktop or Cowork. The product rule (CLAUDE.md line 185, "Tri-Polar three-surface") requires all three surfaces be considered; line 41 maps the surface differences.
- Facts: the mod uses engine hooks (`$.ui.panes`, `$.command.register`) which exist only in Claude Code terminal. ASSUMED: Desktop and Cowork do not host mods. UNVERIFIED (no run). The mod's own reads use MCP tools, which work on all three, but nothing draws.
- Status: BOOK-SILENT. Propose segment "experience/terminal: Claude Code mods and non-terminal fallback". See N7.

### G9. Persona name in the panel copy (Larry or Theo)
- Question: Does the panel speak as Larry or as Theo?
- Canon ruling (e947a5d): identity/naming (segments/identity/naming/entries/2026-10-19/content.html): "Larry's teaching voice informs how the story is explained. Public-facing material in this new direction calls the thinking partner Theo. Do not introduce Larry as a second character in the website unless the content is explicitly about Lawrence Aronhime or the teaching origins." brand-rules.md rule 3: "MindrianOS leads; the DataRoom is the developing project; Theo supports the inquiry." Terminal guide: "Say Theo, never Brain."
- Owner fact (MEMORY.md line "UI copy plain English"): "every user-visible word is plain English in Larry's voice". The plugin's MCP instructions also make Larry the persona that speaks in chat.
- Status: CONFLICT. Canon: Theo, and Larry not introduced as a second character in public material. Memory ruling 2026-10-06: Larry's voice for UI words. They can be read as compatible (Larry's teaching style, Theo's name), but I do not decide. See N8.

### G10. Motion
- Question: What may move?
- Canon ruling (e947a5d): BOOK-RULED. Terminal guide: "Motion is a spinner or a progress mark. The Theo face may change between states and never loops for decoration." references/brand-rules.md rule 19: no independent ambient loops, "Declare relevance and teaching purpose." segments/experience/motion (content.html): "Motion explains a change in understanding. Use one dominant movement per beat." accessibility: respect prefers-reduced-motion; "Provide a visible motion setting only where motion can run." Timing rulings D-05 (workflow-adoptions): feedback 200 ms, relation 420 ms, reframe 760 ms, ease cubic-bezier(.22,1,.36,1).
- Status: BOOK-RULED, but the book holds two easing values for the face and has NOT ruled between them (workflow-adoptions "Open owner question: Theo face easing": cubic-bezier(0.23,1,0.32,1) with 440/700 ms in visual-language, against cubic-bezier(0.22,1,0.36,1) with the ranges in tokens and motion). That is an open CONFLICT inside the book. In a terminal neither applies directly (no CSS easing).
- Mod check: PROVEN in register.tsx: `$.clock.every(400, ...)` flash (lines ~229), `$.clock.every(220, ...)` spinner (~720), flash for 9 s (`LIT_FLASH_MS`), keep 10 minutes. This is a spinner and a state flash, which the guide allows. Whether the 400 ms flash is "decoration" is a judgment; UNVERIFIED.

### G11. How the book's rules show in the mod
- Question: How does the panel prove it follows the book (so the owner can see it)?
- Canon ruling (e947a5d): BOOK-RULED on the process: the book wants a recorded review. `mos-brand checklist` reads each selected segment's `humanCheck`; `run start` makes a Brief, Produce, Review, Return-learning record, and the review "answers every human check with evidence" (references/cli-guide.md "A reviewable unit of work"; workflow-adoptions "Extension 2026-10-21"). Terminal guide Review section: score ten categories plus three checks; label every finding PROVEN, UNVERIFIED or PREFERENCE; "Output a one-line verdict, the five worst problems with exact fixes, and what still needs a real screen." Rule 7: start from the job; return learning to the project.
- Status: BOOK-RULED. Evidence rule: the guide says "Work from a real captured screen, never from props alone" (skills/mindrian-tui-designer/SKILL.md Test section). The mod tests are props; the handoff says screenshots exist but I did not see them. UNVERIFIED. Phase 380 needs captured screens at wide, 80x24, under 60 columns and NO_COLOR.

### G12. Honest labels when the panel cannot read
- Question: What does the panel say when the read fails or is denied?
- Canon ruling (e947a5d): BOOK-RULED by the terminal guide States row: "Initial, loading, empty, partial, error, stale and too small each have words." and "Folded parts ... The last good reading stays visible and says how old it is." Errors: "Three lines, no stack trace. x What failed / Why: / Fix:". Honesty: "Show no success before it is confirmed."
- Status: BOOK-RULED (proposed segment). Mod check: tests for "a tool the permission mode refused is not asked again, and the panel says what it could not read", "the panel shows how old its reading is", "a read that hangs is cut off, shows as stale" pass (PROVEN).

## 3. Needs the navigator

N1. (CONFLICT, stale label) The canon (e947a5d) holds that e947a5d is the canon, yet its proposed terminal segment and the tui-designer skill still say "Canon v5". Should those texts drop the label, and shall I cite their color roles as "owner terminal consult ruling 2026-10-06, proposed" meanwhile?
N2. (CONFLICT, face colors) Book 2.43.0 says face colors are blue, red, yellow, black, white by state. The workspace mod's C-32 ruling (2026-10-06) draws no yellow and no blue, and red only for no-evidence points. Which one does the face panel follow?
N3. (CONFLICT, Part 8) MOD380-03 says handles only. The 2026-10-21 owner exception allows a 240-char own-words excerpt, on by default, and the mod also sends up to 8 of those words to mcp__theo__search. Do you confirm the exception for both calls, and should the default be off for the released product?
N4. (BOOK-SILENT, two status lines) Keep both the plugin line and the pinned panel line, or remove one?
N5. (BOOK-SILENT, opt-out and command names) Do you want the commands to stay `/mos-*` (hyphen), and shall I propose a book entry for opt-out and consent controls?
N6. (BOOK-SILENT, terminal contrast) The book has no token for secondary text on ink and no rule for host-colored dialogs. Do you rule "dimmed paper" as the secondary text, or shall I propose a token?
N7. (BOOK-SILENT, surfaces) The panel draws only in the Claude Code terminal. Do you accept "terminal only, plain MCP reads elsewhere" for beta.73, and shall I propose a segment for the fallback?
N8. (CONFLICT, persona) Canon: Theo is the public name; Larry is not introduced as a second character. Your 2026-10-06 rule: UI words in Larry's voice. Does the panel say "Theo" and write in Larry's teaching style, or speak as Larry?
N9. (BOOK-SILENT, face states) The mod draws 7 states and the book names 11. Do you want all 11 mapped before release, or only the ones with a real event?
N10. (packaging, not a book question) How should the released plugin load the mod: the Phase 369.26 walled-package precedent, or something else? I could not verify install behavior.

## 4. Adoption audit (read-only)

### 4.1 Files, sizes and entry points
Source: /home/jsagi/dev/mos-face-mod (backup) is identical to ~/.claude/dev-mods/0edce8e1-1cd3-4a4c-8354-d35eb4d22ffd/mos-face (`diff -rq` printed nothing). PROVEN. Not a git repo.

| File | Lines | Bytes |
| --- | --- | --- |
| hooks/register.tsx | 1340 | 54106 |
| hooks/commands.ts | 522 | 28214 |
| hooks/advice.ts | 375 | 16032 |
| hooks/lines.ts | 347 | 15079 |
| hooks/glossary.ts | 88 | 12485 |
| hooks/source.ts | 245 | 8237 |
| hooks/face.ts | 228 | 9303 |
| hooks/probe.ts | 193 | 7412 |
| hooks/voice.ts | 119 | 5503 |
| hooks/meter.ts | 93 | 3609 |
| hooks/bind.ts | 28 | 1188 |
| hooks/hooks.json | 1 | 34 |
| panel.test.tsx | 694 | 32828 |
| tsconfig.json | 3 | 56 |
| types/index.d.ts | 161 | 3463 |
| Total | 4437 | 197549 |

(wc column order: first number lines, second bytes. PROVEN.)
- Entry point: hooks/hooks.json is `{ "modules": ["./register.tsx"] }`. register.tsx registers hooks, atoms, the pane, the band and 12+ commands. PROVEN.
- tsconfig.json extends `./.claude-plugin/types/tsconfig.json`, which does not exist in the backup folder. PROVEN (folder listing). The tests still ran. The type check was NOT run. UNVERIFIED.
- glossary.ts and commands.ts are generated (handoff). UNVERIFIED how they are regenerated; no generator script is in the folder (PROVEN: none listed).
- probe.ts "written by an unknown second writer, kept" (handoff). Provenance unknown. PROVEN that it is in the folder; its author is UNVERIFIED.

### 4.2 Tests
- Command: `claude plugin test .` inside a COPY at /tmp/claude-1000/-home-jsagi/c03816a4-113f-4230-9448-0156b88f0247/scratchpad/modtest (copied from ~/dev/mos-face-mod; nothing outside the scratchpad was written).
- Result PROVEN: `34 pass, 0 fail, Ran 34 tests across 1 file [3.03s]`. The ROADMAP and handoff say 29. The real count is 34. MOD380-02 should say 34 or "all tests". The tests are props and engine tests; no real terminal. The run was offline in design (tests use fake tools). UNVERIFIED whether a test touches the network; none failed without it.

### 4.3 What the mod reads, writes and sends (Part 8 view)
Reads:
- MCP tools in the plugin's own server (source.ts line 20 `TOOL = 'mcp__plugin_mos_mindrian-os__'`): room_state_bound, status_read, room_graph, claim_read per handoff. PROVEN prefix; list UNVERIFIED line by line.
- Files (`$.fs.read`, `$.fs.list`): STATE.md of the room, `.mindrian/minto-stale.json`, folder listings of room sections (source.ts, probe.ts, register.tsx line ~508). PROVEN.
- A subprocess (probe.ts line 152): `python3 -c <fixed SQL script> <room>/.mindrian/room.db`, opened `mode=ro`, 8000 ms timeout. PROVEN. It needs python3 on the user's machine. Windows ships no python3 by default. ASSUMED a risk.
- Network (probe.ts): `$.http.fetch('https://www.mindrian-os.com/')` and `https://<theoHost>/health`. Host only, no body, no user data. PROVEN. Whether the plugin's own egress policy allows a website fetch from a UI mod is UNVERIFIED.
- Session: `$.session.messages` (recent user prompts, for the words), `$.session.usage`, `$.session.cwd`, `$.session.id`, `$.env.get`. PROVEN (usage counts).

Writes:
- No `fs.write`, no `appendFile`, no `mkdir` in hooks source (grep). PROVEN. probe.ts comment: "Nothing is written". The panel state is kept in engine atoms (session scope). Persistence of settings such as /mos-words across sessions is UNVERIFIED.
- The mod fills the prompt box (`$.prompt.fill`, `$.prompt.suggest`) but never submits. PROVEN by count; "never submits" ASSUMED from the book-matching design and tests.

Sends (Theo, Part 8 view):
- `brain_ask` with a question from `questionFor(handle, words)`: framework name, problem type, and the cleaned words (<=240 chars) when words are on. PROVEN.
- `mcp__theo__search` with up to 8 words from the same cleaned excerpt, when words are on. PROVEN (advice.ts lines 191 to 205).
- Not sent: assistant text, room files, claims (per ruling; code PROVEN only to build from user messages, `wordsFor(handle.matched, recentUser)`). Room names or paths in the cleaned text: `sanitize` strips links, emails, paths, code, key-like strings per ruling; test "the words that travel are cleaned" passes. A room name or venture name typed in prose is NOT stripped. ASSUMED risk.

### 4.4 Hooks and reads that could starve a prompt
- No shell hooks: hooks.json has only the module list. PROVEN. MOD380-05 as worded ("adds no hook") holds for shell hooks. The engine hooks are in-process function hooks.
- Timer: `$.clock.every(120000)` triggers `refresh` every 2 minutes (register.tsx line 570): MCP reads, file reads and listings, the python3 subprocess (8 s timeout), two HTTP fetches. Each read has a cutoff (`withTimeout`, line 295; test "a read that hangs is cut off" passes). PROVEN. This is the slow-machine risk named in the phase handoff ("the mod reads room state on a timer, so a slow machine makes it worse"). Real cost on a CPU-starved machine: UNVERIFIED.
- Animation timers: 400 ms flash while a section is lit (9 s), 220 ms spinner while a read runs. PROVEN. They call `$.ui.invalidate`, which redraws the pane; the render cost is UNVERIFIED.
- Every second turn the mod calls Theo (`/mos-auto`, on by default per the "Ask Theo" test). That is a network call per two turns. PROVEN by test name; default setting UNVERIFIED.
- Auto mode may deny the MCP reads ("Classifier unavailable"); denied tools are remembered 10 minutes (source.ts `DENIED_FOR_MS = 600000`). PROVEN.
- The plugin has its own hooks with timeouts of 5 to 120 seconds (hooks/hooks.json lines 10-58). The mod adds none of them. PROVEN. Phase 379.1 (the runaway CPU fix) is a dependency per the roadmap.

### 4.5 Gaps against MOD380-01 to MOD380-06
- MOD380-01 (installs and loads from the plugin, no manual copy): GAP. plugin.json has no mod entry (PROVEN). The mod is not in the repo (PROVEN: only ui/mindrian-workspace-mod exists). A precedent loads with `--plugin-dir` (PROVEN) but the installed path is UNVERIFIED. The mod's session-scoped copy dies with the session.
- MOD380-02 (29 tests run in the release gate): GAP and WRONG NUMBER. Real count 34 (PROVEN). No release gate wiring exists for this folder (UNVERIFIED: I did not grep release.sh for the mod; for the workspace mod, tests are run through `bash tests/run-all-369.26.sh`, PROVEN in its README). The tests need `claude plugin test`, so a release host needs the claude CLI. ASSUMED.
- MOD380-03 (handles only, no room content, Part 8): CONFLICT with the owner exception (N3). A second path, mcp__theo__search, carries the words (PROVEN). Room content: none read into the ask (PROVEN by code reading of askTheo and questionFor only partly: `questionFor` I read at the top, full function UNVERIFIED).
- MOD380-04 (TypeScript rules, D-17: erasable-only core, TSX only in a walled built package): GAP, PROVEN fact: the mod is TSX plus .ts; CLAUDE.md line 132-135 says TSX only in walled `ui/*`, built for release, only built assets ship, packages with own lockfile, never in the root package.json. The mod has no package.json, no lockfile, no build, and tsconfig extends a missing base. The workspace mod uses a `scripts/lay-types.cjs` to lay the engine types. UNVERIFIED whether the same step fits here.
- MOD380-05 (no hook or read that can starve a prompt): PARTIAL. No shell hook (PROVEN). A 2-minute poll with a subprocess and two fetches exists (PROVEN). No measured budget exists (UNVERIFIED). Add a measurement and a kill switch.
- MOD380-06 (real-room receipt, RULE 10): GAP. Nothing in the mod folder is a receipt. UNVERIFIED how RULE 10 is signed; not read.
- Overlap, not in the requirements: a second mod (ui/mindrian-workspace-mod, Phase 369.26) already draws a band and a pane. The two mods may draw two panes. PROVEN that both exist; the clash is UNVERIFIED.

### 4.6 Gaps against the book's rulings
- Face states: 7 in the mod, 11 in the book (G2). PROVEN.
- Color roles in terminals: conflict inside the book; no pick (G2, N2).
- Persona name Theo or Larry (G9).
- Real-screen evidence: none seen; the book wants captured screens at wide, 80x24, narrow and NO_COLOR (G11). UNVERIFIED that the earlier screenshots exist.
- Em dash and word list: not scanned (G3). UNVERIFIED.
- Secondary text token: missing in the book (G7).
- Terminal segment is only proposed (PROVEN): any compliance claim against it carries "proposed".
- The book's intake and `run start` record is not created for Phase 380. The scratch intake used in this file is a draft only, at /tmp/claude-1000/-home-jsagi/c03816a4-113f-4230-9448-0156b88f0247/scratchpad/intake-380.json. The plugin repo has no .mindrian intake. PROVEN.

## 5. Mid-turn notes handled
- Navigator correction: the book is 2.43.0 at e947a5d, not Canon v5. Applied; section 0 reports what the book says about itself.
- Copy rule: used /home/jsagi/mos-brand at e947a5d; compared with the site's installed copy (same version, same content); did not use the old website copy.
- A pasted note about paths and a Codex handoff (docs/HANDOFF-IMAGES-FOR-CODEX.md) was received. It asks for no action in this task. I took no action on Codex.
