# Codex deep review brief: guaranteeing the MindrianOS runtime agent (2026-11-25)

You are reviewing work done by another agent (Claude) in one long session. Review it adversarially and end to end. Do not edit, commit, push or deploy anything. Read-only. Write your findings to stdout.

## The owner's intent, in order

1. "Set agent": make Larry (`mos:larry-extended`) the running agent.
2. Find the bugs in the MindrianOS plugin that need fixing (a Windows session filed a report: `/home/jsagi/dev/MindrianOS-Plugin/docs/2026-11-24-HANDOFF-room-wiring-faults-critical.md`).
3. Fix the install skill that website visitors copy, so every user gets the Larry agent as the running agent without asking for it. Owner's later wording: the runtime "runs the local and triggers the remote graph to make suggestions based on JTBD".
4. Make sure it goes out in the immediate version cut (beta.88).
5. Revisit phases 399, 400 and 400.1 so they fit this work.
6. Latest, not yet acted on: rename the agent from `larry-extended` to `/m:os-Theo_Local`, and call the remote graph ("brain") `/m:os-Theo_Remote`.

## What was changed (verify each claim yourself)

A. Marketplace repo `/home/jsagi/mindrian-marketplace`, commit `ff0cfaf` on master, PUSHED to GitHub.
   Files: `plugins/get-mindrian/skills/get-mindrian/SKILL.md`, `references/commands.md`, `references/troubleshooting.md`.
   Change: a "Larry pin". The install writes `"agent": "mos:larry-extended"` into `<rooms folder>/.claude/settings.json` (preview, yes, apply, undo), a status-check line `A8 Larry pinned in rooms folder`, an INFO line for a user-wide agent, troubleshooting text.
   Diff: `git -C /home/jsagi/mindrian-marketplace show ff0cfaf`.

B. Plugin repo `/home/jsagi/dev/MindrianOS-Plugin-release`, local `main`, NOT pushed, NOT released:
   - `2086ed966`: `output-styles/destijl.md` gains a "Runtime core" section and a runtime marker; `tests/test-261125-runtime-core-forced-style.cjs`; a CHANGELOG entry under beta.88.
   - `8f8e9c737`: `.planning/quick/261125-rtc-runtime-core-and-larry-pin/WEBSITE-HANDOFF.md`.
   `agents/larry-extended.md` and the plugin root `settings.json` (which still holds the deprecated `"agent": "larry-extended"`) were deliberately left unchanged.

C. Worktree `/home/jsagi/dev/MindrianOS-Plugin-399` (branch `work/400-job-sentences-cynefin-layer`): one new untracked file,
   `.planning/phases/400.1-*/400.1-ADDENDUM-2026-11-25-runtime-core.md`.

D. Windows side (reachable as `/mnt/c/Users/jsagi/...`): `~/.claude/settings.json` got `"agent": "mos:larry-extended"` early in the session, on a premise the agent later retracted as wrong (the plugin already set it). Design note: `/mnt/c/Users/jsagi/dev/theo-local-runtime-proposal.md`.

E. Website repo `/home/jsagi/dev/mindrian-website` (branch `book-site`, dirty tree, 519 commits ahead of remote): NOT changed. Its setup sentence points at the raw GitHub address of the skill in A.

## Claims the agent made that you should test

1. Claude Code 2.1.323 deprecated a plugin's `agent` setting (changelog). A project-level pin naming a plugin agent takes effect and beats a user-wide `agent`; a pin naming a missing agent does not stop a session starting (measured on 2.1.332 Windows with `claude -p`).
2. The forced output style (`force-for-plugin: true`) loads even when another agent is the main agent; the marker answered `MOS-STYLE-CORE-1 MOS-AGENT-PRESENT` by default and `MOS-STYLE-CORE-1` with `--agent mos:grading` (2.1.329 WSL, `--plugin-dir`).
3. Seven test failures on plugin main predate the change (test-359-prose-budget B5 x3, test-3696-voice-first-budget V7, lib/memory/body-shape-coverage.test.cjs 5a/6/7).
4. `tests/test-261119-g5g-get-mindrian.cjs` passes 28/28 against the changed skill.
5. Agent names: a throwaway plugin showed Claude Code 2.1.329 accepts agent `name:` values `theo-local`, `Theo_Local`, `m:os-Theo_Local` and `/m:os-Theo_Local`, and resolves `--agent /m:os-Theo_Local`.

## What to review, deepest first

1. **Did the published skill change (A) do harm or leave a trap?** Read the whole procedure as an installing agent would. Check the one-line node scripts in `references/commands.md` by reading them and by running them in a throwaway HOME (never the real one): quoting on bash, zsh, PowerShell and CMD; history expansion; merge and backup behaviour; `undo`; a `settings.local.json` override; a rooms folder moved by `MINDRIAN_ROOMS_HOME`. Is the consent honest? Was publishing before a clean-machine install defensible? What breaks for users who install today if the agent is later renamed?
2. **Is the runtime core (B) correct and safe?** Does any sentence in it contradict `agents/larry-extended.md`, the hooks (`hooks/hooks.json`, `scripts/`), the MCP server instructions, or Canon Part 8 (no room content to the remote graph)? Is "Theo matches method to that job; Theo gets the job and framework names" true to the code (`lib/mcp/tools/sensors.cjs`, `lib/brain/`, `data/framework-jobs.json`)? Does a 7.5 KB style in every session, including sessions with another main agent, cost or break anything? Is the marker test meaningful?
3. **Was leaving the deprecated plugin `agent` key the right call for beta.88?** What exactly happens to existing users on update under each choice?
4. **The rename (intent 6).** Blast radius of renaming `agents/larry-extended.md` / `name: larry-extended` to `/m:os-Theo_Local`: grep the plugin for every reference (tests with byte pins, hooks, skills, commands, data ledgers, the 399 and 400 job labels on agents, the website claims, the published pin). Is a name with `/`, `:` and uppercase safe across `--agent`, the `agent` setting, `@agent-` mentions, the Agent tool `subagent_type`, Windows paths, and Desktop or Cowork? Propose the safest migration: alias period, pin rewrite, order of releases. Same for calling the remote graph `/m:os-Theo_Remote` (MCP server name `mindrian-brain`, tool names `brain_ask` / `brain_query`, the word "Theo" in copy).
5. **Process.** Where did the agent overreach, guess, or report more than it verified? Did it follow the repo's own rules (W1 to W4 in `docs/OPEN-HANDOFFS.md` of the plugin: one working tree per agent, stage paths not folders, no push without a commit review, a main commit is not a release)? It pushed A without a review by the owner.
6. **What is still missing against intents 2, 4 and 5?** The original wiring bugs (claims written with no edges, `artifact_file` never indexing notes: `lib/mcp/tools/views.cjs`, `lib/core/navigation/typed-claim.cjs`, `lib/core/navigation/section-gate.cjs:115`) were diagnosed and not fixed.

## Output format

- Findings ranked Blocker / Major / Minor, each with file:line or command evidence and a concrete fix.
- A section "Verified", a section "Could not verify", a section "The agent was wrong about".
- A recommended order of next actions (at most 8), stating which need the owner.
- Plain sentences. No em dashes.
