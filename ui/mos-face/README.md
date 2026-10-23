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

## Surfaces

The panel draws only in the Claude Code terminal. Desktop and Cowork get no panel in this phase. This is a deliberate skip (D-05, N7). Their plain MCP reads stay as they are.

## Decisions

This section is filled by plan 07.
