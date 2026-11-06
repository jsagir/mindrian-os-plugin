Source: relayed from the owner's parallel session, hypotheses, changelog text is untrusted; verify in code

# Job 3 radar diff + triage (jsagi-cc)
Source: raw.githubusercontent.com anthropics/claude-code CHANGELOG.md, fetched via curl into scratch; ledger_covers.to=2.1.287; installed claude=2.1.319. NOT written to any repo. UNVERIFIED: dates absent in source; versions 2.1.297/298/313/315 have no entry.
Entries newer than ledger: 27 (2.1.288..2.1.318)

mcp_tool hook type: NOT FOUND in any entry above 2.1.287 (grep mcp_tool = 0 hits).
/ultrareview: built-in, 14 fix entries (2.1.290-2.1.316), no new capability; 2.1.309/314 add workspace-trust gate for `claude ultrareview`.

## Candidate rows (Added/Changed lines touching hooks/plugins/skills/agents/statusline/monitor/mcp), capped 200 chars

- 2.1.318 | Changed subagent progress summaries on Bedrock, Vertex, Foundry, or with telemetry off: on a cold prompt cache, one can now wait up to 5 minutes for the subagent's pending response
- 2.1.318 | Changed `/claude-api managed-agents-onboard` to give a new agent's built-in tools, and a quickstart template's MCP tools, the `auto` permission policy ("Judge risky actions") by default, matching the 
- 2.1.317 | Added `onFailure: "block"` for Agent SDK hook callbacks, so a callback that fails blocks the action instead of letting it run
- 2.1.317 | Added a notice when auto mode's check has no answer for a subagent's tool call, which used to leave nothing in the main view
- 2.1.317 | Changed exit to skip the "Background work is running" prompt for plugin monitors
- 2.1.317 | Changed the built-in `plugin-authoring` skill to offer once, after a mod you built works, to help share the mod
- 2.1.314 | Changed auto mode in Cowork cloud sessions: a hook's allow of an MCP tool call now counts as no answer, so the classifier or a permission prompt decides
- 2.1.314 | Changed hook `if` conditions such as `Monitor(tail *)` to match the Monitor tool's shell commands as `Bash(tail *)` matches Bash's
- 2.1.314 | Changed the `claude-api` skill to ask to read a Managed Agents workflow run's workflow before changing the agent to improve that run
- 2.1.312 | Changed prompt and agent hooks to run at most 24 at a time per session, sub-agents included, plus at most 12 that have waited longer than their event's timeout; a `timeout` under 1 second now counts a
- 2.1.312 | Changed a subagent's `autoCompactWindow` to lower the window set by `CLAUDE_CODE_AUTO_COMPACT_WINDOW`, where it had no effect before; it still never raises that window
- 2.1.312 | Changed OpenTelemetry `mcp_server.name` to report the real name of fixed-URL remote MCP servers declared by plugins from the official Anthropic marketplace, instead of `custom`
- 2.1.311 | Changed sessions that set `CLAUDE_CODE_SYNC_SKILLS` with feature-flag fetching off to reuse a claude.ai skills list up to 10 minutes old that another session on the machine fetched
- 2.1.310 | Added the Monitor tool and plugin monitors on Bedrock, Vertex, and Foundry, and when telemetry or nonessential traffic is disabled; long foreground sleeps are now blocked there too
- 2.1.310 | Changed the error for an MCP tool call that times out in a non-interactive session while the server's elicitation is unanswered: it now tells Claude that no answer came and not to repeat the call
- 2.1.309 | Changed the `/claude-api` skill to build Managed Agents subagent teams on `multiagent_20261001` with dynamic workflows on by default, instead of `coordinator`
- 2.1.307 | Added the `claude_code.safety_event` OpenTelemetry event for each tool call a permission rule, auto mode, a safety check, a hook or the sandbox stopped, prompted or sent back
- 2.1.305 | Changed `allowedMcpServers` to stop filtering `managed-mcp.json` stdio servers that use `${VAR}` only in `env`: one your allowlist left out now loads on upgrade; use `deniedMcpServers` to keep it off
- 2.1.305 | Changed plugins that Claude Desktop mounts by path to no longer keep their `allowed-tools` when your organization's managed settings set `allowManagedPermissionRulesOnly`
- 2.1.304 | Added a transcript line when a plugin that runs first skips one of your mod's hooks, naming the event and the plugin
- 2.1.304 | Changed mods' `settings.read` hooks to receive each settings layer and rewrite the merged settings, so a managed mod can make an organization's setting a ceiling, including the `cleanupPeriodDays` the
- 2.1.304 | Changed compaction to send Claude the skill list again afterwards; `/reload-skills` now sends only new or changed skills
- 2.1.304 | Changed skill hooks: the skills of one source (a repo, your own folder, or a plugin) can register at most 1,024 hooks and 16,384 matcher characters per session
- 2.1.304 | Changed skills under a policy that allows hooks from plugins only: a skill used in the main conversation whose hooks are kept out no longer gets its `allowed-tools`
- 2.1.302 | Changed fork subagents (`subagent_type: "fork"`) to be on by default in `claude -p`, the Agent SDK, the desktop app and VS Code, as they already are in the terminal; `CLAUDE_CODE_FORK_SUBAGENT=0` turn
- 2.1.302 | Changed the desktop app and VS Code to always run the main conversation's subagents in the background, as the terminal does, rather than let Claude choose; a subagent's own Agent calls in `claude -p`,
- 2.1.302 | Changed prompt and agent hooks so that at most 12 of one event run at a time; the rest wait their turn
- 2.1.301 | Added OpenTelemetry tracing guidance to the `claude-api` skill, including setting up trace destinations with the `ant` CLI
- 2.1.301 | Changed a mod hook's `.catch` handler to run only when the hook throws or times out; events raised beneath the hook's own calls now skip that hook without asking its `.catch`
- 2.1.300 | Added support for rewriting a workflow agent's `prompt` and `model` in the `agent.spawn` mod hook, which could only refuse workflow agents before
- 2.1.300 | Added the `prompt.change` mod hook, raised when the prompt box's text changes without a typed edit: a recalled history entry, a clear, an undo, or a plugin's fill
- 2.1.300 | Changed the `claude-api` skill to leave Managed Agents sessions in place unless you ask to archive or delete them
- 2.1.300 | Changed `PermissionRequest` hooks in Cowork cloud sessions: a `setMode` update in a hook's allow is now ignored; the rest of the approval still applies
- 2.1.300 | Changed hooks: `updatedInput` from PreToolUse and PermissionRequest hooks is now validated like Claude's own input: unknown keys are dropped, and input the tool rejects denies the call
- 2.1.299 | Added `$.prompt.media` so a `prompt.submit` hook of a mod installed by managed settings can read the bytes of an image or document attached to the prompt
- 2.1.299 | Added `--shutdown-drain-sec` to `claude self-hosted-runner orchestrator`: on SIGTERM it stops polling and gives the poll in flight and running spawn hooks up to that many seconds to finish
- 2.1.299 | Added the skill's frontmatter, source, plugin name and file path to what a mod's `skill.prompt` hook receives
- 2.1.299 | Added `--disallow-tools` and a `disallowed_tools` case field to `claude plugin eval` to keep specific built-in tools, such as Agent, out of eval runs
- 2.1.299 | Added a `queue` door to the `session.append` mod hook, so a mod can make the transcript's queue records differ from the prompt as sent
- 2.1.299 | Added a note in `/plugin` and `claude plugin validate` naming a mod's hooks that are skipped where an organization manages Claude Code
- 2.1.299 | Changed plugin hooks and workflow scripts to refuse values they hand back that nest deeper than 28,000 levels, with an error naming the limit (workflow scripts allowed 100,000)
- 2.1.299 | Changed actions a plugin hook can block to be refused, not let through, when the hook cannot be handed them or cannot hand back its answer; a tool that already ran has its result withheld
- 2.1.299 | Changed requests to claude.ai's connector proxy and to Anthropic-hosted MCP servers to no longer follow HTTP redirects; redirects by a connector's own server are unaffected
- 2.1.299 | Changed MCP requests in cloud and self-hosted runner sessions to no longer follow HTTP redirects from the session's MCP proxy
- 2.1.299 | Changed skill and command loading: one whose file or folder name has hidden, direction-changing or blank-like characters, `<` or `>` is no longer offered until renamed; such a `name:` is ignored
- 2.1.299 | Changed `ui.render` trees in `claude plugin test`: each mod's Box or Text root now carries `part: { plugin }` naming the mod, so exact-tree assertions must include it
- 2.1.299 | Changed `claude plugin test` to fail a call to a mod's served `$` method that has not answered within ten seconds, as a session does
- 2.1.299 | Changed MCP allow rules to reach only the server they name: `mcp__a` no longer allows a server named `a__b` or `a_`; write `mcp__<server>__*` with the server's whole normalized name
- 2.1.299 | Changed agent `tools:` lists to take only the named MCP server's tools; list a server whose name contains `__` as `mcp__<whole name>__*`
- 2.1.299 | Changed cloud session and Remote Control MCP connectors to negotiate MCP protocol version 2026-07-28 by default on installs that fetch no flags; `MCP_PROTOCOL_NEGOTIATION=legacy` opts out
- 2.1.299 | Changed MCP tool descriptions and server instructions from Anthropic's first-party MCP servers at `api.anthropic.com` to reach Claude in full instead of being cut at 4,096 characters
- 2.1.299 | Changed auto mode in Cowork cloud sessions: a `PermissionRequest` hook can no longer approve shell commands or subagents; those prompts wait or are denied
- 2.1.299 | Changed `UserPromptSubmit` hooks to run before a skill or custom slash command expands, so a hook that blocks the prompt now also stops its embedded shell commands
- 2.1.299 | Changed a skill's own front-matter `UserPromptSubmit` hook to first run on the prompt after the one that invokes the skill
- 2.1.299 | Changed the `turn.start` mod hook to also hear subagents' and teammates' turns, not only the main loop's; tell them apart by `e.agentId` (absent on the main loop)
- 2.1.296 | Added `autoCompactWindow` to subagent frontmatter and `--agents` definitions, so a subagent can auto-compact earlier than the main conversation's window
- 2.1.296 | Added a note in `/plugin` on a plugin whose hooks are left out because another enabled plugin has the same name
- 2.1.296 | Changed the default limit on MCP tool descriptions sent up front and on MCP server instructions from 2,048 to 4,096 characters
- 2.1.295 | Added `onFailure: "block"` for command and HTTP hooks: a hook that can't start, times out, or exits with an unexpected code blocks the action instead of letting it through
- 2.1.295 | Added a warning to `claude plugin install`, `enable`, `disable` and `marketplace add` when the settings file they write to does not load
- 2.1.295 | Added advice to `claude plugin validate` when a plugin's README has no install line: it prints the line to paste and never changes the exit code, even with `--strict`
- 2.1.295 | Changed MCP tool descriptions the model loads through tool search to be cut at 16,384 characters instead of 2,048
- 2.1.295 | Changed subagents to preload at most 32 skills from the `skills` field, each once; a subagent with the Skill tool can still invoke the rest
- 2.1.295 | Changed claude.ai connectors to negotiate MCP protocol version 2026-07-28 by default on installs that fetch no flags; `MCP_PROTOCOL_NEGOTIATION=legacy` opts out
- 2.1.295 | Changed what Claude and you read when a mod denies a tool call after the tool ran: it now says the tool ran and a plugin withheld its result
- 2.1.295 | Changed WebSocket (`ws`) MCP servers: a message over 16 MiB is no longer parsed and closes the connection, the limit the other transports already have
- 2.1.293 | Added `agentType` to the `subagentStatusLine` payload, so scripts can tell custom subagent types apart
- 2.1.293 | Changed claude.ai skill syncing to check for changes about every 40 minutes, instead of every 10, while no session is in use
- 2.1.293 | Changed the order of agent lists and of MCP servers announced to the model: names with non-ASCII characters now sort after ASCII names
- 2.1.293 | Changed OpenTelemetry `claude_code.at_mention` logging to emit at most 100 agent and 100 MCP-resource events each time a prompt is read
- 2.1.292 | Added `--marketplace <source>` to `claude plugin install`: adds the marketplace if needed, under the same policy checks as `claude plugin marketplace add`, then installs the plugin from it
- 2.1.292 | Added `prompt.autocomplete`, an event a mod hooks to add its own rows to the prompt box's autocomplete list
- 2.1.292 | Added workflow agents to the `agent.spawn` mod hook, with their run and index, so a mod can refuse them
- 2.1.292 | Changed local (stdio) MCP server connections to negotiate protocol version 2026-07-28 by default on every install, including Bedrock, Vertex and Foundry; `MCP_PROTOCOL_NEGOTIATION=legacy` opts out
- 2.1.292 | Changed `claude plugin test`: a failed `expect` inside a hook the test registered, or a stub answer the engine refuses, now fails the test instead of passing silently
- 2.1.292 | Changed agent names to allow at most 256 characters: a longer one is rejected, and a skill's or a plugin file's `name` longer than that is ignored
- 2.1.290 | Added `serverToolUses` to the result of a mod's `turn.step` hook: the tool calls the API ran itself (the advisor), each with its id, name, input, start and end
- 2.1.290 | Added `agentId` to the `tool.check` event of plugin hooks, so a hook can tell a subagent's permission check from the main session's
- 2.1.290 | Added `ceiling` to the question and verdict a mod's `tool.check` hook reads, naming the approval an organization requires for a tool
- 2.1.290 | Added `ThemeKey` and `Color` types to the plugin hooks typings, so an editor lists the theme colors a mod's drawing can name
- 2.1.290 | Added to `claude plugin validate`: each hook a mod registers at a gating site is listed with whether it has a `.catch` (`gatingHooks` under `--json`)
- 2.1.290 | Changed what a mod's `$.process.spawn` rejects with when another mod denies it after the child ran: it now says the call ran and a plugin withheld its result
- 2.1.290 | Changed skills and custom commands to refuse a `!` shell command that contains raw control characters other than tab and newline, with a message that shows where they are
- 2.1.290 | Changed plugin hooks so long text is clipped and logged instead of being refused or dropped silently
- 2.1.290 | Changed an in-process teammate's `agent_id` in Agent results to its agent ID (its `name@team` address stays in `teammate_id`); TeammateIdle hooks no longer fire from its subagents or forks
- 2.1.290 | Changed `claude plugin update` on a plugin loaded from a directory to print just its reason, without the "Failed to update plugin" prefix, as for built-in plugins
- 2.1.290 | Changed the `claude-api` skill's Managed Agents examples to turn off the web tools unless the agent needs them and to use the `auto` permission policy
- 2.1.289 | Added `agent.spawn` for teammates, one agent id across plugin hook events, and idle and waiting states in `$.agent.list()`
- 2.1.288 | Added a re-authenticate prompt when an MCP server asks for more OAuth scope during a tool call
- 2.1.288 | Changed MCP URL prompts from servers that can't report when you're done to wait for "I'm done, continue" before the tool call continues, so you can finish in the browser first

Total candidate lines: 90

## Triage (jsagi-cc judgement, HYPOTHESES until checked in code)
HIGH (touches what the plugin ships; verify before next release):
1. 2.1.295 `onFailure:"block"` for command and HTTP hooks (2.1.317 for SDK callbacks): opt-in fail-closed. Fit: Part 8 guard hooks. Risk: a slow hook (Phase 384) could then block a prompt. Do not enable before 384 is done.
2. 2.1.299 agent `tools:` lists take only the named MCP server's tools; `mcp__a` no longer matches `a__b`. Check the 17 agents' `tools:` lines and allow rules for the `plugin_mos_mindrian-os` / `plugin_mos_mindrian-brain` names.
3. 2.1.292/2.1.295/2.1.299 MCP protocol 2026-07-28 negotiated by default (stdio too). Check the mindrian-os and mindrian-brain servers negotiate cleanly; opt-out is MCP_PROTOCOL_NEGOTIATION=legacy.
4. 2.1.299 UserPromptSubmit hooks now run BEFORE skill/command expansion; hook `updatedInput` is validated, unknown keys dropped. Affects scripts/mva-detect.cjs and navigation hooks that rely on order.
5. 2.1.312 / 2.1.302 prompt and agent hooks capped (24 per session, 12 per event). Only matters if plugin uses prompt/agent hooks; command hooks unaffected (UNVERIFIED which types hooks.json uses).
6. 2.1.299 skill/command names with hidden or `<>` characters are no longer offered; 2.1.292 agent names max 256 chars. Cheap check over 126 skills / 113 commands.
MEDIUM:
7. 2.1.296 `autoCompactWindow` in subagent frontmatter: candidate for long-run agents (framework-runner).
8. 2.1.295 subagents preload max 32 skills: check agents with `skills:` lists.
9. 2.1.310/2.1.317 plugin monitors (Monitor tool) now on all providers: possible replacement for poll-style hooks. Candidate, not a reason to cut.
10. 2.1.304 skill hooks: max 1,024 hooks per source; 2.1.299 plugin hook return nesting limit. Low risk at 40 hooks.
11. 2.1.302 fork subagents on by default everywhere: relevant to the 389 parallel Test step design.
LOW / informational: 2.1.307 safety_event OTel; 2.1.292 `claude plugin install --marketplace`; 2.1.295/299 `claude plugin validate` advice; claude-api skill changes.
ASKED ABOUT:
- hook type `mcp_tool`: NOT in the changelog at 2.1.288-2.1.318. The earlier note cannot be confirmed from this source; treat as unverified (it may be in a different doc).
- built-in /ultrareview: exists, 14 fix entries, no new capability. It uploads the repo to the cloud, so it is a Part 8 question for MindrianOS code. 2.1.309/2.1.314 add a workspace-trust gate.
Ledger action (for jsagi-33 / owner, not done here): append rows only for items 1-4 and 9 as `dormant`; set ledger_covers.to=2.1.318, installed 2.1.319. The fetch procedure's WebFetch path truncates at 100k chars of a 1.15 MB file, so only 2.1.304+ is seen; curl of the raw file gave the full range. Suggest the command use a local parse.
