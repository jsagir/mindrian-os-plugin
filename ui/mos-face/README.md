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
- Review the shipped copy with the book (read only, in a scratch folder): `node scripts/book-review.cjs --out <file>`. It exits 1 if the book changes during the run and 77 if the book or the claude CLI is missing.
- Draw the contact sheet of the 11 canon faces (the canon renderer's SVG above the panel's block faces, as a PNG): `node scripts/face-sheet.cjs --out <file.png>`. It exits 77 if the claude CLI or the Playwright CLI is missing.
- Type-check it: `npm run typecheck` (the script lands in a later plan).
- Build it: `npm run build` (the script lands in a later plan).
- Install the lockfile: `npm ci --ignore-scripts`.

## How to try the panel from a checkout

Written in plan 380-17 from a diagnosis with fixture plugins in a scratch home (380-17-G6-FACTS.md in the phase folder; claude 2.1.309). Plain words:

- The whole plugin, built dist: `claude --plugin-dir /path/to/MindrianOS-Plugin-release`. The plugin folder is named mos, so for this session it replaces the installed plugin named mos, and it brings its own commands and the panel together. This is the way to try the panel with the /mos:* commands. Tested with a stand-in folder named mos, not with the real plugin root (the real root runs real session code, so it was not run in the diagnosis).
- The mod alone: `claude --plugin-dir ui/mos-face`. Since the source is named mos-face (plan 380-09 follow-up), the session keeps the installed plugin and adds the mod next to it: the /mos:* commands stay and the panel loads (run R1 of the facts file).
- The old trap. When the source folder was named mos (commit bfc7cd798 to the follow-up), the same line replaced the installed plugin without any message. The session then held only the mod: "Unknown command: /mos:rooms", and the tool for Theo asks was gone (run R1b). Any folder given to `--plugin-dir` whose manifest name is mos does this.
- How to see it. Start with `claude --debug` (or `--debug-file FILE`). The log then holds the line `Plugin "mos" from --plugin-dir overrides installed version`. `claude plugin list` does not show it: the installed row still reads enabled.
- How to keep a session-only copy from shadowing the installed one. Put `"enabledPlugins": {"mos@inline": false}` in a settings file. A turned-off session-only plugin does not shadow, so the installed copy loads (run R4). The entry is for a manifest named mos; for a folder named mos-face the id is `mos-face@inline`.
- The capture harness of plans 03 and 10 loads a throwaway plugin that holds only the dist. The /mos:* commands are absent there by design.

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

### Sent line

Added in plan 380-16 (D-03, D-04; gaps G1 and G3 of the first real terminal run). One ask has one honest sentence about what happened to the person's words. The row under "Ask Theo now" is in one of these states:

- sent: `Theo was sent: "..."`. A call that carried the words was answered.
- may have been received: `A call to Theo failed on the way, so Theo may have received: "..."`. A call that carried the words failed. The note under the ask says `Theo did not answer`.
- not asked: `Theo was not asked: the call was not allowed`, or `Theo was not asked: this session has no Theo tool to call`. Every call was refused or the tool is missing. No excerpt is shown, because none left.
- handles only: `Theo was sent only a framework name and a problem type this time`. No words were due, or Words is off (`Theo is sent only a framework name and a problem type`).

The sent line and the not-asked line never show together. A new ask clears the old row while it is in flight.

When the words had a part removed, the row says what kind of thing, never the text: `(left out: a link, an email address, a file path, code, a key-like string, a long name, a name, the rest of a long message)`. The kinds come in that fixed order and each shows once. A removed part is named by its kind only.

The text that goes on the wire did not change. `sanitize` is now the text of `sanitizeNoted`, which runs the same steps in the same order and also notes which step removed something. tests/sent.test.tsx S9 pins six texts to the output of the code before this plan.

A tool that does not exist in the session makes the engine throw `no tool named "..." in this session` (measured, plan 380-16). The panel treats that call as never sent.

Canon: mos-brand book e947a5d, segments/experience/terminal (status: proposed), "Rules that hold everywhere", "Side panel template" (One signal: a state is said once) and "Priority order" (honesty sits above usability and brand).

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

The module registers events only: session.start, 15 command.run commands (mos-state, mos-face, mos-style, mos-chip, mos-suggest, mos-ask, mos-refresh, mos-words, mos-text, mos-plain, mos-advice, mos-auto, theo-calls, mos-job, mos-tree), prompt.submit, turn.start, tool.call, turn.complete and 5 ui.render entries. There is no shell hook. The module's hooks/hooks.json holds only the module list, and the hooks.json of the plugin names no shell command for this mod. `claude plugin validate --json` prints the list, and the gate fails on any addition.

prompt.submit and turn.start do no file, tool, network or process work and never wait on the clock.

### The limits the tests assert

| Limit | Value | Test |
|-------|-------|------|
| Tick of the panel | every 120 seconds | B3 |
| Tool reads on a tick | at most 4 | B3 |
| File reads of the Job line on a tick | exactly 1 (the room's job state file, cut off after 4 seconds); none at prompt time | J9 |
| File reads of the status line files on a tick | 8 (the 7 status line files and the room health file, started together, one cut-off of 4 seconds; the mode file only when a room is read); none at prompt time; no tool, fetch or process added | B9 |
| Subprocesses | 0 | B1, G1 |
| Network fetches on an ordinary tick | 0 | B3 |
| Reach checks (Theo health, the website) | every 600 seconds, started together, each cut off after 4 seconds with no status | B3, B4 |
| A read of the room | cut off after 30 seconds | B5b |
| Slow read | over 8 seconds | B5 |
| Back-off after a slow or failed read | the next ticks wait 2x, 4x, then 8x of 120 seconds, never more than 600 seconds | B5, B5b |
| A quick read | resets the wait | B5 |
| The person's own refresh (/mos-refresh, the Refresh button) | always reads, and asks Theo and the website again | B5 |
| Reads in flight | one (a second refresh during a read is ignored, for 45 seconds at most) | B6 |
| Timers | the 220 ms spinner (the running mark in the Theo calls pane) stops when the turn ends; the 400 ms flash of a lit section stops when the flash ends. The face has no timer (plan 380-13) | B8, W4 |

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

- tests/copy.test.tsx draws the band and the pane in 10 states (the 11 canon states except Reframe, which no real event reaches; its thoughts are scanned in C4), 3 face styles (tile, mini and line), 4 widths (100, 48, 40 and 30) and plain mode, opens every block, and scans every Text and every Button. It also scans the 15 command descriptions and results, every toast, and every table (glossary, thoughts, labels, why lines).
- tests/test-380-copy.cjs reads every string of the hook sources (also JSX text) and scans the manifest description. It runs the commands check below.
- scripts/face-commands.cjs --check keeps hooks/commands.ts honest against data/command-registry.json: no unknown command, no stack word, no PLUGIN_VERSION constant. A changed registry sentence only warns. Run --write, then the build.
- A command name such as /mos:brain-derive is a name the plugin owns. The scan removes command names before it looks for words.

The reply chip (D-07, Quote the reply as is): the colored chip in a reply quotes the reply's own lead as it stands. It adds, removes and rewrites nothing, and it is built from the reply, never from panel copy. So the word Larry appears in the chip only when the reply put it there. The move glyph of the reply is shown as the color of the chip, as before.

The glossary is vendored text from the owner's PWS repository. It is scanned for names, never edited here. Whether it ships in the public tarball is the owner's decision (plan 11).

## Surfaces

The panel draws only in the Claude Code terminal. Desktop and Cowork get no panel in this phase. This is a deliberate skip (D-05, N7). Their plain MCP reads stay as they are.

## Job line

Added in plan 380-14 (D-09, MOD380-08). The panel shows one Job line: what the person is probably trying to do, as one sentence in the jobs-to-be-done form the plugin already uses, "When I am in this situation, I want to do this, so that I get this." It sits in the side panel between NEXT and ASK. It is a guess, it is labelled a guess, and it sends nothing anywhere.

What it shows. A heading (JOB, then "a guess, is this it?", or "set by you"), the sentence, and two buttons. For example: "When I am in the Design stage, I want to decide if a venture / opportunity / approach is worth pursuing, so that I can say go or no-go and write down my reason." Under 40 columns the line is one short row with the want clause only and the word guess kept. With no usable record and no cue match, one dim row says there is no guess yet and what makes one: two different phrases of one job in your own words ("Job: no guess yet. Say what you want to decide, test or find, in two different phrases, and one may come."); the line invents nothing.

Where each part comes from, in order:

1. The room's recorded job: `<room>/.mindrian/jtbd-state.json`, written by the plugin's own classifier (`lib/hmi/jtbd-classifier.cjs`, `lib/hmi/jtbd-state.cjs`, the same file the status line reads). The panel reads it once for each refresh tick, with a cut-off of 4 seconds, and keeps only the fields of the current job (`compactJob`). An automatic job is used for 24 hours and is a guess. A job the person set with /mos:jtbd set, not yet expired, is shown as set by you and is not a guess. An expired set job, a job older than 24 hours, an unknown id and the steady state (explore) are ignored.
2. When there is no usable record: a cue match over the person's last prompts in this session (up to 6, held in memory), against the cues of the plugin's own taxonomy. The method is the classifier's: distinct cue phrases found in the person's words. The panel adds one rule: a cue is found only as a whole phrase, not inside a longer word. At least 2 distinct cues of one job and a strict lead over every other job give a guess; a tie or fewer gives none. The match is computed from memory when the pane draws. No file is read for it.
3. The room state: the stage from the room reading and the open section of the panel, for the "in this situation" part of the sentence. Without an open section the "and looking at" part is absent.

The form comes from the plugin's JTBD method, not from a new one (Canon Part 7): the 13 job ids, their one-line wants and their cues are copied from `lib/hmi/jtbd-taxonomy.json` into `hooks/jobs.ts` by `scripts/face-jobs.cjs --write`, and `--check` fails on drift, a missing outcome, a banned word or a stale header. The "so that" clauses are the one thing the plugin did not have; they are written in `scripts/face-jobs.cjs` (OUTCOMES), drawn from each job's completion shape, and listed below for review. The form when, want, so is the one the book's own intake uses (mos-brand book e947a5d, the consumer intake schema fields jtbd.when, jtbd.want and jtbd.so; references/brand-rules.md rule 7, start from the job).

Why it is a guess. The book's voice segment (`segments/writing/voice`) says: do not describe generated content as validated evidence. The terminal guide (`segments/experience/terminal`, proposed) says thoughts are questions or hedged reflections. So every predicted line holds the word guess, its heading asks "is this it?", and it never says this is your job, or validated, confirmed or proven. The label is in words; no color carries it.

What it never does. It makes no Theo call, no Brain call, no tool call, no http call and no process call (Canon Part 8). It never prints any text of the person's prompts: the sentence is built from the taxonomy text, the stage and the section name only. It never reads the goal field of the state file, which holds a navigator-ratified local sentence; the panel does not even keep that field in memory (`compactJob` copies the current job only). Tests J5 (canary tests on prompt words and goal text, and a check that the same session sends the same calls with the line shown and hidden) and N2 (no tool name, fetch, process call or import of advice.ts in the job sources) prove it.

Dismiss and correct, one action each:

| Action | What it does |
|--------|--------------|
| Not this | Hides a guess for this session until the recorded job changes (or, for a guess from the talk, until the guess changes). It changes only a panel atom and makes no call. A job the person set has no Not this button. |
| Fix: /mos:jtbd set | Puts the text /mos:jtbd set in the prompt box. It never runs it and never submits it. |
| /mos-job (the 14th command) | Shows or hides the line from the keyboard. A line hidden this way stays hidden until the command runs again. |

Placement. The terminal side-panel template of the book puts decisions first (where this session writes, what is wrong now, what to do next) and then asks about the work. The Job line sits after NEXT and before ASK. The canon has no segment for an intent line in a side panel: the book is silent on it. A segment text is proposed in plan 380-11 (item A5).

Budget. One added file read for each refresh tick (test J9: 1, 2, 3 reads over 3 ticks), nothing at prompt time, no timer, no new hook except the command. The budget tests B1 to B8 pass with the 14th command in the pinned lists.

Surfaces. Terminal only. Desktop and Cowork have no panel (D-05, N7), a deliberate skip; the same job is already reachable there through /mos:jtbd.

The 13 outcome clauses, for the navigator to read. The want text is the plugin taxonomy's own one-line (first letter lowered, final stop mark removed: a full stop, or the question mark of connect-domains, which the book review showed as "field?." in the sentence), so it carries the taxonomy's words, for example the citation in find-bottleneck.

| Job id | Want (from the plugin taxonomy) | Outcome clause (so that, reviewed here) | Shown |
|--------|------|---------|-------|
| decide-pursue | decide if a venture / opportunity / approach is worth pursuing | I can say go or no-go and write down my reason | yes |
| find-problem | find the problem worth solving (not the symptom, the root) | I know the real problem in a sentence I can test | yes |
| understand-market | understand the market for this idea - size, structure, dynamics | I can say how big the market is and who else is in it | yes |
| find-bottleneck | find the lagging component (Hughes 1983 reverse salient) blocking progress | I know which part to fix first | yes |
| prepare-pitch | prepare for an investor / partner / customer meeting | I walk in with the story ready and the hard questions covered | yes |
| validate-idea | test if an idea / hypothesis / claim holds up under scrutiny | I know what holds up, what does not and what I still need to find out | yes |
| compare-options | compare alternatives across criteria - choose between A/B/C | I can choose between the options and say why | yes |
| connect-domains | find cross-domain analogues - what does this look like in another field | I see what this looks like in another field and what that could teach me | yes |
| surface-contradiction | notice and resolve internal contradictions in the room | I know which claims pull apart and which one I keep | yes |
| plan-execution | plan the next 90 days - milestones, owners, dates | I know the next 90 days, with owners and dates | yes |
| file-meeting | capture and route meeting intelligence into the room | I can see what the meeting changes in my data room | yes |
| audit-room | audit Data Room health - gaps, drift, evidence tier, decision quality | I know where my data room is thin or out of step | yes |
| explore | no specific job - general thinking, talking, ranging | I notice what is worth following | never shown |

## Status parity

Added in plan 380-15 (D-08, MOD380-07). The panel keeps what the plugin status line prints, and adds the room and filing facts, from the same local files. Nothing new is sent anywhere and nothing new is read at prompt time.

Where the list comes from. `tests/test-380-status-parity.cjs` builds the list of status line fields from the status line's own code: the keys of `collectSignals` (lib/statusline/cockpit-signals.cjs), the keys and assignments of `rowState` and the segments written by scripts/context-monitor, and the focus segment of scripts/statusline-mos. Every name must be a key of `STATUS_FIELDS` or an entry of `EXCLUDED` in `hooks/status.ts` (with a reason). A field added to the status line later fails the test until it is mapped. The segments mintoSeg and dialSeg are built into `roomInfo`, which is never written, so they are dormant and are not fields (the test checks that).

| Status line field | Source (local file or host) | Panel field | Wide label | Narrow label | Shown when |
|-------------------|-----------------------------|-------------|------------|--------------|------------|
| room, stage | STATE.md of the room read (tools, else files) | ROOM | ROOM | ROOM | always; not read when no room was read |
| section | the sections table of STATE.md | FILED | FILED | FILED | always (entries in N sections); not read when no room was read |
| health | ~/.mindrian/room-health.json | HEALTH | HEALTH | HEALTH | always; not read when the file is missing or damaged |
| post_update | ~/.mindrian/post-update-restart-pending | NOW | NOW | NOW | when the file exists: NOW says a restart is pending and names /mos:doctor --fix, and HEALTH reads drift |
| ctx_pct | the host's context usage | Context | Context | CTX | when the host gives a usage (waiting before that); words ok, watch or cliff, and a text bar when narrow |
| next_move | ~/.mindrian/next-move.json, then the recorded job | NEXT MOVE | NEXT MOVE | MOVE | always: Theo's first command when fresh, else the routed move, else the recorded job id, else "none yet" (the status line's two hyphens, said in words) |
| brain | ~/.mindrian/bridge/brain-health.json, then the reach check | THEO | THEO | THEO | always: on, off, or not read |
| voice_glyph, who, agent_label, voice_switched, switch_direction | ~/.mindrian/voice-mark.json | SPEAKS | SPEAKS | VOICE | when the file says something: who speaks (Theo, or Claude when the file says the host spoke) and the move of the mark, or that the voice just switched |
| stance, stance_forced_color | ~/.mindrian/stance-state.json | STANCE | STANCE | STANCE | when a stance is set |
| jtbd | the room's jtbd-state.json (plan 380-14) | JOB | JOB | JOB | the Job block of plan 14 (a guess, or set by you) |
| operator | the room's conversation-operator.json | MODE | MODE | MODE | when the mode is not just talk (the status line hides the default too) |
| version, update_available | ~/.mindrian/install-state.json, ~/.mindrian/update-check.json | VERSION | VERSION | VER | always; names an available update when it differs from the running version |

Panel-only facts (the status line has no such field): STALE, the sections whose reasoning is older than their files (nothing when none, not read when no room was read), and WRITES TO (plan 05, already in the panel).

Two fields are excluded, each with a reason that the executor checked:

- focus: scripts/statusline-mos prints it only when a bash variable session_id is set, and no script in scripts/ sets that variable, so the segment is dormant (test P11). Its source is the room database, which the panel no longer opens (plan 05 removed the subprocess), and the one tool that reads it would add a fifth tool read to each tick.
- governing_thought: the last leg of the status line's Next move. It needs the active section and its reasoning file, a second read tree, and it would pass the budget of 8 local reads for each tick. The panel's NEXT MOVE goes routed move, recorded job, then "none yet". The plan named only focus; this second exclusion was found when the field list was built from the code.

What the panel adds to the status line: the status line changes shape by state (at drift, broken, a pending restart or the context cliff it replaces Next, the Theo chip and the stance chip with one fix). The panel keeps every field in every state: the fix is a row in NOW with its button, and the rest stay as rows. The status line prints the host agent's name (agent_label) from stdin; a mod cannot read it, so SPEAKS uses the voice file's own who. The status line also trusts any recorded job, where the Job block ignores an automatic job older than 24 hours (plan 14).

Order and one signal. The terminal side-panel template (mos-brand book e947a5d, segments/experience/terminal, proposed) says: order decisions first (where this session writes, what is wrong now, what to do next), then ask about the work, folded details last; a state is said once in the panel. The panel follows it: WRITES TO and the room facts, NOW, NEXT and the NEXT MOVE row, JOB, the plugin facts (THEO, SPEAKS, STANCE, MODE, VERSION), ASK, then the folded blocks. Each state word is in one text row (test P7); NOW says what to do about a problem and names no state word that a field row already says (for example the room check problem says "found a problem", and HEALTH says drift). The context meter keeps its place at the top beside its canvas (the template's width ladder puts the face tile and the context canvas first, and a colored plane always carries its words); this is the one place the order differs from a list that puts context with the plugin facts.

The template's Status line row says "Context, stage and version stay on the plugin line". The navigator's ruling D-08 (2026-10-23) governs this panel instead: the panel carries context, stage and version. The pinned line under the prompt box stays as the template says (the NOW line in one breath). The book is silent on the panel carrying parity fields, so plan 380-11 proposes a book follow-up (A6) for the row.

Width ladder. At 50 columns or more the wide labels; at 40 to 49 the wide labels with a smaller tile; under 40 columns and in plain mode the narrow labels and a text bar for the context, and every field stays; under 30 columns the one message. No field is dropped at any width (test P4 at 56, 44 and 35 columns, and P11 in plain mode).

Budget. Each tick reads 8 small files started together under one cut-off of 4 seconds: next-move.json, brain-health.json, post-update-restart-pending, voice-mark.json, stance-state.json, update-check.json and room-health.json from the .mindrian folder of the home folder, and the room's conversation-operator.json. A missing or damaged file gives null, never a guessed value. Nothing is read in prompt.submit or turn.start, no tool, fetch, process or timer is added, and no value of these files is sent anywhere (tests B9, P14).

Panel height. The panel scrolls; the height below is the number of rows of the drawing, computed from the draw tree with the wrap of each text counted (the computation matched the real capture at 46 columns row for row, and the capture shows JOB on row 33). It is an estimate (about 2 rows either way), not a screen measurement, for 56 and 35 columns, because the real dock is 46 columns wide.

| Panel width | Rows, every optional row set | Rows, no optional row set | Rows added by this plan |
|-------------|------------------------------|---------------------------|-------------------------|
| 56 columns (wide, tile 12) | about 52 | about 47 | 5 to 10 |
| 44 columns (standard, tile 8) | about 54 | about 48 | 5 to 10 |
| 35 columns (narrow, words and text bar) | about 50 | about 44 | 5 to 10 |

The Job sentence alone is 3 rows at 56 columns, 4 at 44 and 3 at 35 (plan 14 noted 5 to 6 in a worse case). On a 40 row terminal the first screen ends at the JOB heading, so the plugin facts sit below the fold until the person scrolls. Plan 380-10 reviews that.

Capture harness. `node ui/mos-face/scripts/capture-shots.cjs --session-home` fills the scratch HOME with the status line files in the formats the plugin's own readers accept (the builder is in scripts/lib/tmux-session.cjs and the parity test uses the same one), and the demo room with a recorded job, a mode and a stale list. HOME goes to the session only, the login symlink still comes from the real home, and the builder refuses the real home folder and any room outside the scratch home (tests P11 to P11d, S2). It needs the scratch config (it is refused with --config real). The fixture has no Theo host record, so Theo is not checked: the THEO row follows the local health file and NOW says nothing about Theo (since plan 380-19, see Truth of the words).

Surfaces. Terminal only. Desktop and Cowork have no panel (D-05, N7), a deliberate skip; the same facts are available there through the plugin's own tools.

## Context gauge

Added in plan 380-17 (D-04, D-08, D-11; gap G5 of the first real terminal run). Before the first reply has used any of the window, the eight boxes under the face look like empty boxes. The words next to them now say what they are. The boxes are not redrawn and not dimmed.

| State | The row says |
|-------|--------------|
| Waiting, boxes drawn (wide and standard panel) | Context gauge: waiting for the first reply |
| Waiting, no boxes (narrow, plain mode, short terminal) | Context: waiting for the first reply |
| A reading, including 0 percent and 100 percent | Context 62% - watch (the label, the rounded percent, a space, a hyphen, the words of the band) |

The words are chosen by `gaugeText` in `hooks/gauge.ts`: a union of an idle line and a reading line, one switch on the band with a check that fails to compile when a band is not handled. A figure the host did not give (or a figure that is not a number) is waiting; zero is a reading. The word gauge never appears on a reading, so a state is said once (test G-5).

Why it is labelled and not dimmed. A dimmed fill needs a color for secondary text on the ink ground, and the book has none: the terminal segment says "the book has no token for secondary text on ink. The panel uses dimmed paper", and D-11 forbids an invented hex. The 18 pixel pins of `tests/meter-pin.test.ts` also fix the idle canvas, and they are not edited. Cutting the idle canvas (4 of 40 rows) is a separate choice that needs a ruling (380-17-CLUTTER-AUDIT.md).

Canon: mos-brand book e947a5d, segments/experience/terminal (status proposed: Rules that hold everywhere, Side panel template States, One signal, Ground and color), segments/writing/voice. The book's own review of the three strings found nothing (exit 2, REVIEW-REQUIRED, findings empty, which is its normal clean result). Where the book is silent, the proposals P17-1 and P17-2 are in the phase folder.

One wrap to know: at 35 columns the short words are 36 characters, so the row may wrap to two rows (UNVERIFIED, props only).

## Room tree

Added in plan 380-18 (D-04, D-08; gaps G7 and G2 of the first real terminal run). Press Sections and the panel shows a browse view of the room instead of the overview. The view is a list-to-detail drill-down: the list of sections, then the files of one section, then a folder inside it. Nothing else of the overview is drawn while it is open (one open part at a time, as the book says in Folded parts).

What the view shows, top to bottom:

| Part | What it is |
|------|-----------|
| Header | The Theo face tile (3 rows) beside the label, when the pane has 24 rows or more and 40 columns or more and plain mode is off. Otherwise one row of words. It never scrolls away, because the body fits the room. |
| Crumb | One row: the room name and the open path (cut at the start, so the last part survives), and the counter: all 14, 1-10 of 14, 11-14 of 14, 2 matches for "legal", no match for "zzz", none. A folder of more than 300 names says first 300 of N. |
| Window | The rows of this page. A paged window is padded, so the controls do not move. Every section and every file is one Button, with the same key as before (sec-NAME, entry-PATH-NAME). |
| Controls | Only the ones that can act: Up (inside a folder), Previous (after page 1), Next (before the last page), Find, Close. One row from 52 columns, else two explicit rows. |
| Hint | Where each route works, and no key promised. |
| Refresh | One row from 24 rows. |

The layout rows (`treeLayout` in hooks/tree.ts; the pure test pins them):

| Body rows | Columns | Plain | Header | Hint rows | Control rows | Fixed rows | Window rows |
|-----------|---------|-------|--------|-----------|--------------|------------|-------------|
| 40 | 56 | no | tile | 2 | 1 | 8 | 32 |
| 24 | 44 | no | tile | 3 | 2 | 10 | 14 |
| 24 | 35 | no | words | 3 | 2 | 8 | 16 |
| 23 | 56 | no | words | 1 | 1 | 4 | 19 |
| 11 | 44 | no | words | 1 | 2 | 5 | 6 |
| 9 | 35 | no | words | 1 | 2 | 5 | 4 |
| 8 | 56 | no | too small, needs 9 rows | | | | |
| 40 | 56 | yes | words | 2 | 1 | 6 | 34 |

Fixed rows are the header, the crumb row (1), the controls, the hint and the refresh row. The window is the body rows less the fixed rows. Under 9 rows, or when the window would be under 4 rows, the view says in words that /m:os needs N rows to browse the room and that /mos-tree still lists every name, and it draws only Close.

Commands. `/mos-tree` is the keyboard route: it works from the prompt box everywhere. With no argument it prints the current page as plain text (the crumb line, the counter line, one line for each name with its count, and the hint lines). Every verb also opens the browse view if it is closed (except `up` on a closed view).

| Command | What it does | Example |
|---------|--------------|---------|
| /mos-tree | Prints the current page | /mos-tree |
| /mos-tree next, /mos-tree prev | Moves one page | /mos-tree next |
| /mos-tree up | Goes back one level: folder, section, list, closed | /mos-tree up |
| /mos-tree find WORD | Keeps the names that hold the word. A word in lowercase ignores case; a capital letter matches the case exactly. | /mos-tree find legal |
| /mos-tree open WORD | Opens the one section or folder that the word picks, or puts a question about the one file in the prompt box. With none or many it says how many names hold the word. | /mos-tree open market-analysis |
| /mos-tree clear | Removes the filter | /mos-tree clear |

Why the body stays inside scroll.bodyRows. The host gives the pane a number of rows (`scroll.bodyRows`, the room, never the rows showing). A body that is taller is scrolled by the host, and the host has no pinned header, so the face and the header left the screen (shots real-7, real-8 and real-10). The browse view keeps its whole body inside that number and pages the list itself, so the host has nothing to scroll.

What the host cannot do (380-18-HOST-FACTS.md in the phase folder has the line references of the laid types file):

- No pinned header above a scrolling body: a search of the laid types for sticky, pinned header and fixed region finds nothing.
- Escape is the person's own key. It returns the focus (types lines 1449 and 10871). The panel binds no Escape.
- A hotkey fires only while the pane holds the keys, and never from the prompt box (types lines 9872 to 9877). The hint names the slash command, which does work from the prompt box.
- Input in a pane, Tab walking and the focus chord are UNVERIFIED on a real screen. No hotkey and no Input is drawn until a real screen proves them. A Client region with its own key handler is an option for a later plan, with a second module and a build change as its cost.
- The room an inline pane gets at 80 by 24 is not stated by the types (UNVERIFIED); the tests assume 76 by 10.

Tests: tests/tree.test.ts (the pure model) and tests/tree-pane.test.tsx (the pane and the command, 24 groups). Canon: mos-brand book e947a5d, segments/experience/terminal (status proposed: Side panel template, Width ladder, States, Keyboard routes), segments/writing/voice. The book is silent on long lists in a side panel; the proposals P18-1 to P18-3 are in the phase folder (380-16-BOOK-PROPOSALS.md).

## Truth of the words

Added in plan 380-19 (D-03, D-04, D-08; gaps 9, 11, 12 and 13 of the first real terminal run). The panel says only what is true. Canon: mos-brand book e947a5d, segments/experience/terminal GUIDE.md lines 92 (one signal) and 96 (states), status proposed. The diagnosis with its evidence is 380-19-FACTS.md in the phase folder.

- The advice text. The chat text after /mos-advice is returned before the call has an outcome, so it makes no claim of delivery. It says "Asking Theo.", what goes if Theo is reached (a framework name, a problem type, and the short excerpt when it is on), and that the panel says what went or that nothing did. It never says are sent, is sent or were sent. The sent line of plan 16 still says what happened after the call. What Theo receives is unchanged (D-03, tests E1 to E10 and tests/test-380-egress.cjs).
- The ROOM row. When the room tools answer that the session is not bound, they still return the registry's active room. The row names that room and now ends with ", not bound", so it never disagrees with WRITES TO. On the files path the same words show when no record binds this session. A different room that is bound keeps its own words, "not the room this session writes to".
- The NOW line and the Theo light. A Theo that was not checked is not a Theo that failed. When no Theo host is recorded (brain-prewarm.json), probe.ts makes a Reach whose host is NO_HOST (status.ts) and asks nothing. NOW says Theo is not answering only for a check that ran and failed (a recorded host with no answer or a 5xx) or for a local health file that says error. The THEO row, the pinned status line, the Theo light and the plain text of /mos-text follow the same rule: an unchecked Theo is "not read", "Theo ?" or "not checked", and the local health file still decides on and off.
- The load notice. At session start the host shows one short line, "/m:os loaded. /mos-state opens it.", in place of a long notice that wrapped to a box of four rows over the host notice. Whether any overlap with the host notice is gone is for the real screen check of plan 380-20; the rest is host behavior.

Tests: tests/truth.test.tsx (W1 to W16).

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

D-11 (navigator ruling of 2026-10-23) keeps this as it is after the canon faces: secondary text on the ink ground stays dimmed paper, and no hex is invented. Test S6 of tests/test-380-copy.cjs fails on any color literal in the hook sources that is not one of the seven canon tokens (F7F5EE, 111111, FFFFFF, 1F3FBF, D6281F, F2C200, 4B4943), and on a change of the secondary text style. A proposed segment text for the book goes into the follow-up file of the phase folder; nothing is written into the book repo.

### N7 Surfaces

The panel draws only in the Claude Code terminal (mos-brand book e947a5d covers the terminal only). Desktop and Cowork get no panel in this beta. They keep the same plain tool reads. This is a deliberate skip of the tri-polar rule (CLAUDE.md), not an oversight, because the engine hooks that draw a pane exist only in the terminal. The book has no text for Desktop or Cowork: its terminal segment covers the terminal only (`segments/experience/terminal`, PROPOSED). Plan 380-11 proposes a fallback segment. The proposal is not in the book.

### N9 State map

The book (mos-brand book e947a5d) names 11 states (`segments/identity/theo/states`: "use exact state names"). Since plan 380-13 (D-10) the panel draws all 11, each from the canon asset, and writes each label as the asset spells it. A state is mapped only where a real event exists; a state that no event reaches is listed as unmapped. The table is the mapping in `hooks/face-events.ts` (EVENT_STATES and UNMAPPED_STATES). Test W2 fails when an event maps to an id that is not in the asset, when a canon state is neither mapped nor listed as unmapped, and when a listed state is also mapped.

| Drawn label | State id | Mapping | Event or reason | Book spelling |
|-------------|----------|---------|-----------------|---------------|
| Rest | rest | mapped | The session is quiet: the face returns here 9 seconds after a finished turn, and when the person interrupts a turn (turn.aborted). | Rest |
| Listening | listen | mapped | A turn began (turn.start) and Theo is attending. | Listening |
| Searching | search | mapped | A call is running (tool.call). The state ends when the call ends. | Search |
| Found | found | mapped | A call returned material (tool.ok). It does not mean the material is right. | Found |
| Challenge | challenge | mapped | A reply leads with the red square (lead.red). The pressure is on the claim, never on the person. | Challenge |
| Contradiction | contradiction | mapped | A reply leads with the yellow square (lead.yellow). The face does not pick a winner. | Contradiction |
| Reframe | reframe | unmapped | No real event reaches it. In the canon colors yellow stands for contradiction or reframe, and the reply marker does not say which; the persona marker names the yellow square contradiction, so the yellow square maps to Contradiction. The plugin has no reframe marker. Reframes reach the person in words. | Reframe |
| Nothing found | limit | mapped | A call returned nothing or failed (tool.empty, tool.failed), or a turn ended on an error (turn.error). It does not mean there is no knowledge anywhere. | Limit |
| Your decision | decision | mapped | A reply leads with the black square (lead.black), the gate marker. It is never set by scrolling, and the panel never approves for the person. | Your decision |
| Boundary | boundary | mapped | The permission mode refused a call (tool.denied), or the model refused (turn.refusal). The panel says what it could not do. | Boundary |
| Handover | handover | mapped | A turn finished with an answer (turn.complete) whose lead square is blue, white or none. It does not mean the project is complete. | Handover |

What each state must not imply, from `segments/identity/theo/states` (mos-brand book e947a5d), and where the panel keeps to it (threat T-380-51; the label always sits beside the face):

- Challenge must not condemn the person. The Challenge thoughts hold none of wrong, fail, bad, blame, stupid (test W7).
- Contradiction must not pick a winner. Its thoughts hold none of winner, right, correct, true (W7).
- Reframe must not present the new framing as established truth. Its thoughts hold none of the real, truth, actually (W7).
- Your decision must not look like approval triggered by scrolling. Its thoughts hold none of approve, confirm, sign off (W7), and no event of the panel sets it but the black square of a reply.
- Found must not imply correctness (test K4: no proof word in the search and found states).
- Nothing found must not imply sadness or absence of knowledge everywhere. Its thoughts hold none of sad, sorry, nothing exists (W7).
- Boundary is a constrained pose with an explicit explanation: the detail line says what was refused.
- Handover is not completion of the whole project.

Two spellings differ between the book and the asset, and the panel follows the asset (navigator ruling of 2026-10-23): the book states table says Search and Limit, and the asset's visible labels say Searching and Nothing found. D-10 also says the label Limit becomes Nothing found. The conflict is recorded here for the book follow-ups, and test K5 pins the exact pair. The proposed terminal guide (`segments/experience/terminal`, PROPOSED) lists seven states in yet older words (rest, listening, searching, found, nothing found, boundary and hand over); the book holds more than one spelling of these names, and it needs one.

### HOLLOW

HOLLOW (#8F8B80) was the one tone in face.ts that was not a canon token. D-10 (plan 380-13) removed it, with the old poses. The canon draws a hollow pose (Handover) as a white fill with an 8 unit ink outline. The rasterizer of `hooks/theo-face.ts` now draws that pose from the asset with palette colors only: the bar and the eyes take the white fill with a one cell ink ring when the stroke is thinner than a cell. No tone outside the seven canon tokens remains in the hook sources (D-11, test S6).

### GEOMETRY

The face poses are the canon poses, number for number, never a redraw: mos-brand book e947a5d, `segments/identity/theo/entries/2026-10-19/asset-fa8504998f.json`, drawn by the renderer `segments/identity/theo/entries/2026-10-19/asset-d96217b320.js` on a 400 unit master. The sha256 of the asset file is e54e7c6a3c11a039059fb47833b09e865cd3981e2910b4f13571e87c06682da2. Since plan 380-13 the panel holds no pose number at all: it reads the asset file at session start (`hooks/theo-face.ts`, readFaceAsset: the dev path `assets/asset-fa8504998f.json` first, the shipped path `lib/mos-face/dist/assets/asset-fa8504998f.json` second) and draws each face from it. The copy in `assets/` is byte for byte the canon file (tests/test-380-theo-faces.cjs checks the hash), tests/face-fixture.ts holds the asset text and the attributes that the canon renderer itself sets (taken by running the renderer in a vm with a fake DOM), and test G2 compares the composition with them. Test K7 compares every pose and plane with the table in tests/canon.ts, and tests/test-380-decisions.cjs compares that table with the book. Test F5 fails when a pose tuple of the asset is typed in any hook file.

If the asset cannot be read from either path, the panel draws the words-only line face (`LINE_FACE`) and says in one plain sentence that the face file could not be read. It never falls back to typed numbers (test W5).

What the panel does not draw from the canon: the motion fields of the asset (sway, bob and still), and the easing between states. A terminal cannot ease, and the face changes state at once and never loops. The frame ring is drawn only at 16 cells and up (plan 380-12 deviation 1: at 6, 8 and 12 cells it would be most of the face). The face is 12 cells wide on a wide panel, 8 on a standard panel, 6 in the mini style and in none in the line style; 6 is coarse, and Handover reads from the moved bar and the white plane more than from the outline below 16.

## Visual change (D-10)

Date: 2026-10-23, plan 380-13. This is a deliberate visual change, not a refactor. The faces on the screen are different faces.

Old model (plans 02 to 11): 7 states (rest, listen, search, found, none, refused, handover) drawn from older poses in `hooks/face.ts` (POSES); a crew style with six workshop faces (CREW) that appeared in four of the states; a tick that animated a small white square along the ground line of the Search state (a 220 ms loop); the tone HOLLOW (#8F8B80) for the hollow pose; the labels Search, Limit and Hand over in some places.

New model: 11 canon states drawn from the canon asset through `hooks/theo-face.ts`; no loop (the face changes state at once and never moves for decoration); no crew faces; the asset's own labels (Rest, Listening, Searching, Found, Challenge, Contradiction, Reframe, Nothing found, Your decision, Boundary, Handover); styles tile, mini and line. Events map to states only where a real event exists (section N9; Reframe stays unmapped and listed).

Old state to new state:

| Old state id | Old label | New state id | New label |
|--------------|-----------|--------------|-----------|
| rest | Rest | rest | Rest |
| listen | Listening | listen | Listening |
| search | Search | search | Searching |
| found | Found | found | Found |
| none | Limit | limit | Nothing found |
| refused | Boundary | boundary | Boundary |
| handover | Handover | handover | Handover |
| (none) | (none) | challenge, contradiction, decision | Challenge, Contradiction, Your decision (reached through the lead square of a reply) |
| (none) | (none) | reframe | Reframe (drawn, no real event reaches it) |

A failed call to Theo, or a turn that ended on an error, used to show Boundary (refused). It now shows Nothing found, as D-10 says an empty or failed result does; a call the permission mode refused, and a refusal by the model, still show Boundary.

Pins: the raster pins of plan 02 are retired and the pins of plan 380-12 stand in their place. The plan counted 120 pins. They were 84 state pins (7 states, 4 ticks, 3 sizes), 18 crew pins (6 faces, 3 sizes) and 18 pins of the context canvas. The 102 face pins described faces that no longer exist and are retired. The 18 canvas pins describe `hooks/meter.ts`, which D-10 did not touch, so they are not retired: they moved unchanged to `tests/meter-pin.test.ts`. The sha256 of the old pin table text (the object PIN of `tests/raster-pin.test.ts` as it stood at commit 4e0888481, 120 entries) is c48c6cba043e5ee9e506ef2ea44abffabd826cbdd803d1b64e9e1baf23c9a5c4. Added: the 44 pins of `tests/theo-face-pin.test.ts` (11 states, sizes 6, 8, 12 and 16), taken from the asset in plan 380-12.

Deferred, for the navigator: the crew style is dropped because the canon asset named by D-10 (identity/theo) has no crew faces. The canon source for faces of that kind is the robots segment of the book (`segments/identity/robots`, mos-brand book e947a5d, with the consumer file `consumers/workshop-robot-faces.json`). Bringing a crew style back is a new plan.

Secondary text (D-11): secondary text on the ink ground stays dimmed paper. No hex is invented (section N6; test S6).

## Surfaces

Written in plan 380-09 (D-05, MOD380-01, tri-polar rule). Each line says how sure we are.

PROVEN (seen in a real run):
- The shipped dist loads in the real engine on the Claude Code terminal. `tests/test-380-installed-layout.cjs` packs the repo, lays it out like an installed plugin, runs `npm ci --ignore-scripts` there, and `claude --plugin-dir LAYOUT -p "/mos-text"` prints the panel's own text (the line starting `mos: /m:os state`).
- The plugin adds no shell hook. The module is the only new line of wiring: `hooks/mos-face.json` (key `modules`), named in the plugin manifest field `hooks` next to `hooks/hooks.json`. The manifest field `types` names `lib/mos-face/dist/types/index.d.ts`, because the engine must know the panel's state before it lets the module write it.
- The state owner is the plugin name. The shipped plugin is named `mos`, so the panel keeps its state under `mos` (the 37 atoms in `hooks/register.tsx` and the `PluginState` key in `types/index.d.ts`). Under the old name `mos-face` the engine denied every `state.set` ("mos-face owns that value and only its owner writes it").

DELIBERATE SKIP (stated, not forgotten; N7):
- No panel is claimed on Claude Desktop or Cowork. Those surfaces get the plain MCP reads the plugin already serves.

ASSUMED and UNVERIFIED:
- The engine's type header lists desktop, vscode and mobile among the surfaces a mod can mount on. The tests mount only the terminal surface, so we have not seen what any other surface draws.
- The Desktop copy is the npm pack payload and carries the same `hooks/mos-face.json`. The payload gate (`node scripts/release-lib/build-desktop-artifact.cjs --check`) passes with the dist in it, but nobody has opened that copy and watched. A person records the Desktop observation at the cut (RULE 10, the face panel bullet).
