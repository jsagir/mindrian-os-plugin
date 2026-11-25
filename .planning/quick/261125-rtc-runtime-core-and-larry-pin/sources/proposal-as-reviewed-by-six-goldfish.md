# Proposal: guarantee the MindrianOS runtime agent loads for every installed user

Status: draft for goldfish review, 2026-11-25. Nothing in this proposal is built. Written by the Elephant (the session that holds the full context). Reviewers get only this file.

## 1. The problem in one paragraph

MindrianOS is a Claude Code plugin (`mos`, from the marketplace `jsagir/mindrian-marketplace`). Its main experience is an agent file, `agents/larry-extended.md`. When that agent runs as the main session agent, its text replaces the default system prompt. That text holds the persona (Larry, a thinking partner) and also most of the operating rules of the product: read the room context at turn start, record each turn, how decision cards work, how to hand off after an approval, how to ask the remote method graph. So if the agent does not load, the user loses the voice AND the operating rules. Users install by pasting one sentence into their coding agent, which reads an install skill (`get-mindrian`, a SKILL.md at a stable public URL) and follows it. The owner wants: every user who installs gets this agent as the running agent, without asking for it, as close to 100% as the host allows.

## 2. Terms

- **Main session agent**: the agent whose prompt, tools and model the main thread of a Claude Code session takes on. Chosen by the `--agent <name>` flag or the `agent` key in a settings file.
- **Plugin agent**: an agent file shipped inside a plugin. Its scoped name is `<plugin>:<agent>`, here `mos:larry-extended`.
- **User-level agent**: an agent file in `~/.claude/agents/`. Plain name, no plugin prefix.
- **Rooms folder**: `~/MindrianRooms` by default. Users start Claude Code inside it. It holds one folder per project ("room").
- **Larry**: the persona. Every reply opens with a colored square and the label `Larry | MindrianOS`. The install skill uses this label as its visible proof that the plugin loaded.
- **Theo**: today, the name of the remote method graph that Larry asks for methodology. In this proposal it would become **Theo-Remote**.
- **Theo-local**: proposed name for the runtime on the user's machine (the agent plus the room tools). Larry stays the voice of Theo-local.
- **Doctor**: the plugin's self-check command (`/mos:doctor`, or `npx @mindrian_os/cli doctor`). It can repair drift.
- **Status check**: a read-only one-line node script in the install skill that prints PASS or FAIL lines per install step.

## 3. Facts, each with its source and how sure it is

F1. The plugin root holds `settings.json` with `"agent": "larry-extended"` (bare name) and a `statusLine` key. Source: the file in the installed plugin, version 2.0.0-beta.87. Certain.

F2. In one live session (Windows, Claude Code CLI, plugin beta.87, 2026-11-25) the session started with the larry-extended agent prompt as its system prompt while the user's own settings had no `agent` key. So the plugin-root `settings.json` agent key took effect in that session. Observed once. The Claude Code version was not recorded.

F3. The current Claude Code docs pages that were fetched (plugin manifest reference, plugin components, plugins overview) no longer describe a plugin-root `settings.json`. An older copy of the docs said: "Plugins can include a settings.json file at the plugin root to apply default configuration when the plugin is enabled. Currently, only the agent key is supported." Source: web search 2026-11-25. So the mechanism in F1 works today (F2) but is not in the current docs. Whether it is deprecated is NOT known.

F4. The `agent` key is a documented setting: "Start every session as a named subagent with its prompt, tools, and model", allowed in any settings file (user `~/.claude/settings.json`, project `.claude/settings.json`, local `.claude/settings.local.json`, managed). Source: Claude Code settings reference. Certain.

F5. `claude --agent <name>` starts a session as that agent. "The CLI flag overrides the setting if both are present." Plugin agents can be named with the scoped form, for example `claude --agent my-plugin:security-reviewer`. Source: Claude Code sub-agents docs. Certain.

F6. For plugin agents, these frontmatter fields are ignored: `hooks`, `mcpServers`, `permissionMode`. The docs say: "If you need them, copy the agent file into `.claude/agents/` or `~/.claude/agents/`." Also `initialPrompt` (auto-submitted first turn when the agent is the main session agent) is "Ignored for plugin subagents". Source: sub-agents docs. Certain.

F7. Agent definition priority when two share a name: managed settings, then the `--agents` CLI flag, then project `.claude/agents/`, then user `~/.claude/agents/`, then plugin `agents/` (lowest). Source: third-party summaries of the docs. Likely, not read first-hand.

F8. Settings precedence is local over project over user. A plugin-root default is assumed to be below all of them. So a user who already has `"agent": "something"` in their own settings never gets Larry, and nothing tells them. First half is from the docs; the plugin-default position is an assumption.

F9. Known gaps on other surfaces, from public issue reports: the `agent` setting was ignored on Claude Code for Web (issue 13953, closed); it was ignored by sessions dispatched from the agent view until a later release (issue 63156, fixed). Whether Claude Desktop (Code tab) and Cowork apply a plugin-root `agent` key or a user `agent` setting is NOT known. Desktop has a second plugin package, `mos-desktop`. There is no way to pass `--agent` in Desktop.

F10. What happens when the `agent` setting names an agent that does not exist (for example after the plugin is uninstalled) is NOT known. A public feature request proposes "warn and fall back"; that is a request, not documented behavior.

F11. The larry-extended prompt text refers to plugin files by an absolute path that includes the plugin version (for example `.../plugins/cache/mindrian-marketplace/mos/2.0.0-beta.87/references/personality/voice-dna.md`). The session doctrine of the plugin says the greeting comes from `initialPrompt`, which F6 says is ignored for a plugin agent.

F12. The plugin also has hooks (session start context, a per-prompt voice reminder, graph hooks) and an MCP server whose instructions carry a short copy of the operating loop. These load with the plugin whether or not the agent is the main agent. On Desktop the docs of the install skill say hooks and the status line exist only in Claude Code in a terminal.

F13. Already edited locally, not committed, in the install skill: a status-check line `A4 Larry is the main agent` (FAIL when the user settings, or the rooms folder project or local settings, hold an `agent` key that names another agent) and a fix script that rewrites only such an overriding key to `mos:larry-extended`, with a backup. Tested in a throwaway home folder: FAIL, fix, PASS, second run changes nothing.

F14. The install skill ends route A with a restart hand-over: the user quits, runs `cd ~/MindrianRooms && claude`, and pastes a resume sentence. Route B is Claude Desktop by clicks. Route C is another coding agent with a shell (Codex, Cursor) that hands over to Claude Code. Route D is a chat with no shell.

## 4. Options

**Option A. Rely on the plugin default, check and repair overrides.** Keep F1 as the mechanism. Ship F13. Cost: small, done. Risk: F3 (undocumented mechanism may stop working with no signal except the missing Larry label).

**Option B. Pin with the documented setting.** The installer writes `"agent": "mos:larry-extended"` into `<rooms folder>/.claude/settings.json` (B1), or into `~/.claude/settings.json` (B2), or both. Uses F4. B1 covers sessions started in the rooms folder and beats a user-wide agent choice; B2 covers every folder but replaces the user's own choice everywhere and stays after uninstall (F10).

**Option C. Launcher.** The installer adds a `mindrian` command (shell function or small script on PATH, per system) that runs `claude --agent mos:larry-extended` in the rooms folder. Uses F5, which beats every settings file. The hand-over line in F14 becomes `mindrian`. Risk: users who type `claude` directly get whatever settings give them; PATH and shell-profile edits on three systems.

**Option D. User-level runtime agent named `theo-local`.** The installer (or the doctor) copies the larry-extended file to `~/.claude/agents/theo-local.md`. As a user-level agent it supports `hooks`, `mcpServers`, `permissionMode` and `initialPrompt` (F6). Settings and launcher then name `theo-local`. The persona stays Larry: same prompt, same reply label. Costs: the copy goes stale on each plugin update, so the doctor must re-sync it; the versioned paths in the prompt (F11) must be rewritten at copy time or made version-free; after uninstall the copy and any `agent` key remain; two agents with the same content exist (`mos:larry-extended` and `theo-local`).

**Option E. Rename inside the plugin only.** Rename the plugin agent to `theo-local` (scoped name `mos:theo-local`), no user-level copy. Changes the label, not the reliability. Keeps the plugin-agent limits of F6.

**Naming layer (independent of A to E).** Three names: Larry = the voice the user meets; Theo-local = the runtime on the machine; Theo-Remote = the remote method graph (today just "Theo"). One sentence in the prompt ties them: "Larry is the voice of Theo-local, the MindrianOS runtime on this machine."

## 5. The Elephant's current recommendation (to be attacked)

Combine A + B1 + C now, and treat D as a second step only if a test shows that `initialPrompt` or agent-level hooks are needed:

1. Keep the plugin default (A) and ship the override check (F13).
2. Installer writes the documented pin into the rooms folder (B1), with a backup, covered by the first consent point of the install.
3. Installer adds the `mindrian` launcher (C) and the hand-over uses it.
4. Desktop and Cowork: no flag exists, so the Larry label on the first reply stays the check; if it is missing the skill sends the user to troubleshooting.
5. Naming layer: adopt in docs and one prompt sentence; do not rename files yet.

Proposed proof before release: on a clean Windows machine and a clean Mac, (a) install, restart, first reply carries the Larry label when started by `claude` in the rooms folder, by `mindrian`, and by `claude` in another folder; (b) repeat with a user-wide `agent` key naming another agent; (c) remove the plugin-root `settings.json` from the cache to simulate the mechanism disappearing and repeat; (d) uninstall the plugin and start `claude` in the rooms folder to see what a dangling pin does; (e) Desktop Code tab and Cowork first reply.

## 6. Open questions

Q1. Is the plugin-root `settings.json` agent key still supported, or on its way out?
Q2. Does a project-level `agent` pin naming a plugin agent resolve reliably at startup (plugin loaded before the agent is resolved)?
Q3. What does Claude Code do with an `agent` key that names a missing agent?
Q4. Do Desktop Code tab and Cowork honor the `agent` setting, the plugin default, or neither?
Q5. Is Option D worth its sync cost? What exactly is lost today because `initialPrompt` and agent hooks are ignored?
Q6. Does the three-name model help a newcomer or confuse them?
