# 383 Routing and memory diagnosis (QA383-02, QA383-03)

Date: 2026-11-05. Repo HEAD at start: eda4844b1 (version 2.0.0-beta.78). All hook runs below used mkdtemp homes under the session scratchpad. No file was written under ~/MindrianRooms.

Marks: PROVEN code fact (read in this repo and run here), CITED (from a vendor doc, not run here), STILL OPEN (cannot be decided without the owner's session).

## Question

Two findings, both "reported, not yet reproduced":

- QA383-02: no /mos command ran in 19 turns. The user's words matched commands. The example is "I know what I want, I need the how", which is the trigger of the roadmap command. Larry answered by hand each time.
- QA383-03: no context_assemble call and no memory_event call happened.

The owner's account (383-QA-REPORT-verbatim.md): the user was a first-time physicist on a Windows laptop. No room was ever made on that laptop (QA383-01). The report guesses that commands do not fire when no room exists. The full report text is still not in the repo. This file therefore cannot name which cause hit that session. It names every cause that can be shown in code, and says which are still open.

## C1 Mode 1 "Just Talk" text suppresses routing

Claim: with no room, the session-start text tells Larry not to route.

Evidence, file:line:

- scripts/session-start:797 defines MODE_MENU. It ends: "Default to Just Talk if the navigator starts talking instead of picking."
- scripts/session-start:799 puts that menu into the cold-start context.
- scripts/session-start:808 holds the Mode 1 paragraph: "No methodology routing, no filing, no room creation suggestions unless the user explicitly asks ... Do NOT suggest /mos:new-project unprompted."

Command run (hook run with an empty rooms home, cwd outside any room, after `check-onboard --write` so the onboarding state is CURRENT):

```
exit=0
len 5672 modeRouting true modeBehavior true firstInstall false
...**Mode 1 (Just Talk):** You are a thinking partner. No methodology routing, no filing, no room creation suggestions unless the user explicitly asks. Use the Ask-Tell Dial naturally. Do NOT suggest /mos:new-project unprompted.
```

A second run in a brand new home (no onboarding marker) took the FIRST_INSTALL branch instead (scripts/session-start:722 and :741): `firstInstall true modeBehavior false`. That branch does not carry the Mode 1 text. It asks one open question and hands the answer to scripts/first-install-router.cjs.

Verdict: PROVEN that, on every no-room session after the first one, the Mode 1 text tells Larry not to route. PROVEN that the very first session on a machine does not carry that text. The owner's user was described as a first-time user, so whether the Mode 1 text reached the 19 turns is STILL OPEN (it did if the QA session was not the first session on that machine, or if the user had an earlier session).

Can it explain the owner's session: yes if session 2 or later; no if it was session 1. Fix chosen: Task 2, Mode 1 text.

## C2 Hook-side routing needs a room

Claim: the engine decision block runs only when a room is bound, so no room means no routing.

Evidence, file:line (re-read in full, the early returns PATTERNS.md flagged as guard lines):

- scripts/intent-classifier.cjs:587 `if (!message) return 0;`
- :594 `if (TURN_IS_HARNESS) return 0;`
- :597 `if (!root) return 0;` (no rooms root)
- :617 `if (unboundPickerSuppressed(root)) return 0;`
- :679 `if (corpus.length === 0) return 0;` (no registered or sealed room)
- :3702 `if (roomDir) {` wraps the call at :3732 `navP = emitEngineDecisionBlock(roomDir, sessionId)`.

Commands run, message `I know what I want, I need the how` on stdin through scripts/intent-classifier:

No room (empty rooms home):

```
exit=0 stdout_bytes=284 stderr_bytes=0
Voice reminder: open with one move glyph and Larry | MindrianOS. Use 2 to 8 sentences, at most one question, no framework list unless asked, and claim only what ran. ...
```

One room (made with navigation birthRoom in the temp rooms home), cwd outside the room:

```
exit=0 stdout_bytes=684
Voice reminder: ... (same line)
## NAVIGATION DECISION (engine v1)
fire_skill: null
suppress_skills: []
offer_next_step: null
tier_mode: tier_0
activated_skills: [larry-personality, context-engine, room-passive, room-proactive]
routing_source: legacy
Why: Tier 0 fallback: no quadruple available for sectionPath. ...
```

One room, cwd inside the room: `[NAV DECISION unchanged - prior block stands]`.

What emitEngineDecisionBlock produces: a decision block for the reach sensors (which skills the room may activate, `fire_skill`, `offer_next_step`). It is not a slash-command invocation. With a room, `fire_skill` is `null` for this message. So the hook-level engine does not run /mos:scientific-roadmap in either state. The no-room versus room difference at this gate is a navigation block that names no command in both cases.

Verdict: PROVEN that `if (roomDir)` gates the engine block. PROVEN that this gate cannot be the reason a command did not run, because the engine never invokes a command with or without a room for this message. The research hypothesis "the decide() path only runs if (roomDir)" is true and irrelevant to command firing.

Can it explain the owner's session: no. Fix chosen: none. The routing engine stays unchanged (one governed reach path).

## C3 Command registry entry

Claim (RESEARCH hypothesis 5): no entry for /mos:scientific-roadmap in data/command-registry.json.

Command run:

```
node -e '...r.commands...' -> true 113
{"command":"/mos:scientific-roadmap","kind":"methodology","surface":"navigator", ... "serves_jtbd":["find-bottleneck","validate-idea"],"teaching":"When you know what must be deliver...
node scripts/build-command-registry.cjs --check
command-registry: OK
```

The earlier "no entry" reading treated the `commands` array as an object. The entry is present.

Readers of data/command-registry.json: lib/brain/chain-recommender.cjs, lib/workflow/command-resolver (suggest_next), lib/core/chain-step-dispatcher.cjs, lib/core/framework-chain-composer.cjs, lib/core/surface-fence.cjs, lib/core/verification-stamp.cjs, lib/core/part8-egress-guard.cjs. None of them maps a user sentence to a command. On the CLI, the meaning-to-command step is the host's skill listing: commands/scientific-roadmap.md has a description that says "Use when you can say what must be delivered but not how." (frontmatter line 3) and no disable-model-invocation key.

Verdict: PROVEN, entry present, generator check OK. Fix chosen: none. If the entry is ever missing, run `node scripts/build-command-registry.cjs` (the generator), never a hand edit.

## C4 Skill listing budget

Claim: the host drops descriptions of the least-invoked skills when the listing overflows its character budget, so a fresh user's roadmap description may be cut.

Evidence: CITED, code.claude.com/docs/en/skills, section "Skill descriptions are cut short": the listing budget is a share of the context window, and when it overflows, descriptions of the least-invoked skills are dropped first. A fresh user has invoked nothing.

Measured here (tests/test-383-no-room-routing.cjs, leg N5):

```
LISTING entries=227 description_chars=18545 method=commands/*.md+skills/*/SKILL.md minus disable-model-invocation
```

Method: the count of commands/*.md and skills/*/SKILL.md files that do not set disable-model-invocation, and the characters of their description fields. The budget itself is not in this repo, so the test does not say whether 18,545 characters overflow it.

Verdict: the listing size is PROVEN (measured). Whether it overflowed on the QA laptop is STILL OPEN. The check is `/doctor` (listing estimate) or `claude --debug` (overflow warning) on the QA laptop, plan 383-11.

Can it explain the owner's session: yes, it is room independent. Fix chosen: none in this phase.

## C5 Hooks do not run on Windows without Git Bash

Claim: on Windows the bash hooks do nothing or fail, so the C1 text never reaches the session.

Evidence, file:line:

- hooks/run-hook.cmd:46 `where bash` branch: runs the first bash on PATH.
- hooks/run-hook.cmd:54 and 56: "No bash found - exit silently ... exit /b 0".
- 383-RESEARCH.md E1 (PROVEN on a Windows host there): `where bash` lists `C:\Windows\System32\bash.exe` (the WSL launcher) first and no Git Bash on PATH. The standard Git paths at lines 32 and 38 are checked first, so a machine with Git for Windows in the standard place is not affected.
- hooks/hooks.json: session-start and intent-classifier run through run-hook.cmd. scripts/sessionstart-npm-reconcile.cjs and scripts/sessionstart-coordinator.cjs run as node and do not need bash.

Verdict: PROVEN as a code fact that two outcomes exist (WSL launcher gets the script path, or silent exit 0). Which branch hit the QA laptop is STILL OPEN. In either outcome the C1 text never reaches the session, and routing rests on the skill listing (C4) and the agent doctrine alone.

Can it explain the owner's session: yes. Fix chosen: none here. Plan 383-09 records it in the D-07 seed; plan 383-11 checks which branch the laptop takes.

## C6 The mindrian-os MCP server not connected, and no first-turn notice

Claim: if the room tools are missing from the session, nothing tells the user.

Evidence:

- `grep` over scripts/, hooks/ and lib/mcp for "tools did not load", "server not connected" and similar finds no first-turn notice (no match). RESEARCH hypothesis 4 holds.
- scripts/sessionstart-coordinator.cjs:48 requires lib/mcp/adapter-client.cjs, which requires `@modelcontextprotocol/client` at load (lib/mcp/adapter-client.cjs:24). The server package is `@modelcontextprotocol/server` (package.json:48). A plugin root without node_modules loses both.
- scripts/sessionstart-npm-reconcile.cjs is the SessionStart hook that runs `npm install` when node_modules is missing or out of sync. It prints only `{continue:true}`, so a failed install is silent.
- settings.json line 2 `"agent": "larry-extended"` makes agents/larry-extended.md the main-thread agent on the CLI, so the doctrine text of that file is in the session even when the MCP server is down and even when no bash hook ran. tests/test-114-substrate-preload.sh is the only test that names the setting.

Verdict: PROVEN that no first-turn notice exists. PROVEN that the doctrine text reaches a CLI session independently of the server. No reachable CLI state is shown in which the server is down AND the doctrine does not load. UNVERIFIED: that Claude Code applies the plugin `agent` key in the QA laptop's session (needs a live session).

Fix chosen: a doctrine sentence in agents/larry-extended.md (Task 2). The hook notice (Task 3) does not fire: its rule needs a CLI state where the doctrine does not reach the session, none is shown, and on Desktop and Cowork no hook runs at all, so a hook cannot cover them.

## C7 Memory calls need a bound room

Claim: zero context_assemble and zero memory_event is the doctrine's own behavior when no room is bound.

Evidence:

- agents/larry-extended.md:163: "Operating policy: run `context_assemble` at turn start in a bound room. Fire `memory_event` silently on every substantive turn." Both calls are tied to a bound room.
- lib/mcp/tools/context.cjs:119 to 129: with no usable room.db the tool returns `{ ok: false, reason: 'no_room_db' ... }`. With no room at all it refuses.
- QA383-01: no room was ever made on the QA laptop. So zero calls matches the doctrine.

Verdict: PROVEN. The calls were not skipped by mistake; with no room they are not meant to run. The gap is that nothing told the user that nothing was being remembered.

Can it explain the owner's session: yes, fully, given QA383-01. Fix chosen: a doctrine sentence (agents/larry-extended.md) and a one-line instruction in the session-start no-room context (Task 2).

## Decision table

| Cause | Verdict | Fix chosen | Plan and task |
|-------|---------|------------|---------------|
| C1 Mode 1 text suppresses routing | PROVEN text; reach on the QA session STILL OPEN | Rewrite the Mode 1 paragraph so a named method need still routes and a stated goal gets one /mos:new-project offer | 383-05 Task 2 |
| C2 `if (roomDir)` gate | PROVEN gate; cannot explain (engine fires no command with or without a room) | None | none |
| C3 Registry entry | PROVEN present | None. If missing: run the generator, never a hand edit | none |
| C4 Skill listing budget | CITED; size measured (227 entries, 18,545 chars); overflow STILL OPEN | None; check on the QA laptop | 383-11 |
| C5 Hooks absent on Windows | PROVEN code fact; branch on the laptop STILL OPEN | None here; recorded in the D-07 seed | 383-09 (seed), 383-11 (check) |
| C6 MCP server down, no notice | PROVEN no notice; doctrine reaches the CLI; reach on Desktop UNVERIFIED | Doctrine sentence: say it in the first reply. Hook notice not built | 383-05 Task 2; Task 3 not built |
| C7 Memory calls need a room | PROVEN | Doctrine sentence plus session-start line: say once that nothing is remembered and offer a room | 383-05 Task 2 |

## Live eval leg

The claim "a scripted session reaches /mos:scientific-roadmap with and without a room" needs a live model. UNVERIFIED in this phase. The executor does not start a nested Claude session. Command for a manual or nightly run on a machine with a live model:

```
claude plugin eval  (grader: tool_used: Skill, expected skill name: scientific-roadmap)
  prompt: "I know what I want, I need the how"
  run once with an empty rooms home, once with one room bound
```

Source: 383-RESEARCH.md, citing code.claude.com/docs/en/skills (Troubleshooting). The exact flags of `claude plugin eval` were not checked here.

## Rethinking Room mirror

Per CLAUDE.md Dev-Research Compositing, this finding touches MindrianOS's own architecture. A mirror entry for ~/MindrianRooms/rethinking-mindrianos/research/ is drafted in the session scratchpad:
/tmp/claude-1000/-home-jsagi-dev-MindrianOS-Plugin-release/491e046f-77d7-4444-b831-aea38fda4686/scratchpad/rethinking-mirror-383-05-routing.md
Nothing was written under ~/MindrianRooms. The main session files it.
