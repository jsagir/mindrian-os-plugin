---
title: Claude surface radar
date: 2026-11-27
scope: Anthropic changes 2026-01-01 to 2026-11-27 that change where and how a Claude Code plugin runs
method: Tavily search and tavily_extract only; each primary page below was read with tavily_extract on 2026-11-27
subject: MindrianOS plugin (skills, commands, agents, hooks, mods, local stdio MCP server, local SQLite room graph)
room_copy: rethinking-mindrianos/research/2026-11-27-claude-surface-radar/claude-surface-radar.md; repo copy .planning/quick/261127-hdl-surface-model-cowork-merged-into-chat/
---

# Claude surface radar (2026-11-27)

## Summary in plain words

The old picture had three places: the Claude Code CLI, Claude Desktop, and Cowork. Each place ran on your own computer. That picture is gone.

1. **Chat and Cowork are now one thing, and it runs in Anthropic's cloud.** Since 2026-10-06, new Cowork tasks on Pro, Max and Ultra run on Anthropic's servers. There is no setting to run them locally. The merged "one Claude" conversation does Cowork work in an isolated cloud sandbox.
2. **Your computer is now a remote device.** A cloud conversation reaches your files, browser, apps and local MCP servers only through the open Claude Desktop app. If the app is closed, the task continues in the cloud but cannot touch your computer.
3. **Plugins live on the claude.ai account, and each surface loads a different part.** Chat loads skills, commands and remote connectors. Chat ignores agents, hooks and local MCP servers. Cowork loads agents and hooks. Claude Code loads everything.
4. **A plugin with a top-level `bin/` folder cannot be installed in Chat or Cowork at all.** MindrianOS has a top-level `bin/` folder (checked in the repo, read only).
5. **The only place that runs a plugin "in full on your computer" is Claude Code**: the CLI, the IDE extensions, and the Desktop Code tab in a local session. Code-tab cloud sessions and new-Projects cloud threads start from a fresh repo clone and do not see your disk.
6. **The documented route from the cloud back to a local Claude Code session is Remote Control.** New Projects use Remote Control to run a thread on your computer.

For a plugin whose truth is a SQLite file on the user's disk, this means: the room is reachable only from a local Claude Code session, from a cloud surface through an open Desktop app (device bridge), or through Remote Control. Every other surface is "no room".

## Dated table

Legend: P = primary source (Anthropic page read with tavily_extract). S = secondary source. The impact column is for a plugin with hooks, a local stdio MCP server and a local SQLite room.

| Date | Item | Source URL | P/S | Impact on MindrianOS-type plugin |
|---|---|---|---|---|
| 2026-01-12 | Cowork research preview, Max, macOS only. "It runs locally on your computer in an isolated VM, enabling direct access to local files and MCP integrations." | https://support.claude.com/en/articles/12138966-release-notes | P | Start of the 3-surface model. Cowork ran locally then. |
| 2026-01-16 | Cowork preview expanded to Pro (macOS only). | same release notes | P | Nothing new. |
| 2026-02-24 | Cowork plugins and plugin marketplace, admin controls for Team and Enterprise. | same release notes | P | Plugins become account objects for Cowork. |
| 2026-02-25 | Scheduled tasks in Cowork; new Customize section groups skills, plugins, connectors. | same release notes | P | Customize > Plugins becomes the install point outside Claude Code. |
| 2026-03-17 | Dispatch: persistent Cowork thread from the phone (research preview, Pro/Max). | same release notes | P | Dispatch runs on the user's desktop. Closed to new users from 2026-09-16. |
| 2026-03-23 | Computer use research preview in Cowork and Claude Code; Dispatch improvements. | same release notes | P | Not directly relevant. |
| 2026-03-25 | Interactive apps (MCP Apps) in Claude for iOS and Android. | same release notes | P | MCP Apps from remote connectors render on mobile. A local stdio server does not reach mobile directly. |
| 2026-04-09 | Cowork GA on macOS and Windows through Claude Desktop. | same release notes | P | Nothing new. |
| 2026-06-25 | Trusted Devices for Remote Control (Team/Enterprise admins). | same release notes | P | Admins can gate Remote Control per device. |
| 2026-07-07 | Cowork on web and mobile. "Cowork runs your sessions remotely (in beta)". Chat and Cowork share one home. | same release notes | P | First move of Cowork work off the user's computer. |
| 2026-08-13 | Desktop v1.30096.1: Rewind added to cloud sessions; fix for cloud and Remote Control sessions. | https://claude.com/docs/cowork/changelog | P | The Desktop Code tab has cloud sessions as a first-class mode. |
| 2026-08-17 | Desktop v1.32352.0: Code sessions run hooks from marketplace plugins (the 3P extensions page names this version). | https://claude.com/docs/third-party/claude-desktop/extensions | P | 3P deployments only (see Q1). |
| 2026-08-25 | Memory works across chat and Cowork in the cloud. | release notes | P | Account memory is kept in the cloud, separate from any room memory. |
| 2026-08-27 | Desktop v1.40609.0: `/mcp` in a local Code session lists servers from `.mcp.json`, `~/.claude.json`, plugins and claude.ai connectors. `/resume` of terminal sessions in the app. | Desktop changelog | P | The local Code tab has the full Claude Code MCP surface. |
| 2026-09-10 | Desktop v1.52386.0, 3P section: "Changed hooks from organization plugins to also run in Chat, matching Cowork and Code." | Desktop changelog | P | 3P only. Does not apply to consumer Max. |
| 2026-09-15 | Claude Code 2.1.273 bundled in claude-code-action on this date (secondary). Synced plugins need Claude Code v2.1.273 or later (primary). | https://support.claude.com/en/articles/13837440 ; https://github.com/anthropics/claude-code-action/issues/1568 | P (version) / S (date) | Plugins added on claude.ai sync into Claude Code as `@synced` plugins. One-way. |
| 2026-09-16 | "Claude Cowork comes to every conversation": the new unified experience, rolling out to Pro and Max on web, desktop and mobile. | release notes ; https://claude.com/resources/articles/cowork-is-now-claude ; https://support.claude.com/en/articles/16761823 | P | The chat surface now does Cowork work. Dispatch is closed to new users. Add from GitHub is not supported. |
| 2026-09-17 | "Projects redesigned: from folder to conversation": a project is one conversation, and its threads are parallel Claude Code cloud sessions. Beta, starts in Claude Code. | https://claude.com/resources/articles/projects-redesigned (date from Tavily page metadata) ; https://bosio.digital/articles/claude-projects-redesign (S) | P (content) / S (date) | New surface. Cloud threads skip repo hooks and `.mcp.json`. |
| 2026-09-17 | Desktop v2.2553.0: file viewing added to cloud sessions. | Desktop changelog | P | Cloud Code sessions move closer to the local UI. |
| 2026-09-25 | Developer portal to submit plugins to the Claude directory. | release notes | P | Directory review derives supported surfaces from the component table. |
| 2026-09-29 | Desktop v2.16120.0: worktree sessions (Claude Code 2.1.275+) read hooks and MCP servers from the opened project folder. | Desktop changelog | P | The local Code tab follows Claude Code config rules. |
| 2026-10-06 | New Cowork tasks on Pro, Max and Ultra run in the cloud. The "Only on your computer" option is removed. No switch back. Local tasks started earlier stay local. | https://support.claude.com/en/articles/15520349 | P | Cowork is no longer a local surface for consumers. Local file and local MCP access only through the open Desktop app. |
| 2026-10-06 | Desktop v2.26454.0: fixed Cmd+Q / Quit skipping the "Claude is still working" prompt and stopping running sessions. | Desktop changelog | P | A quit of Desktop stops local sessions (with a prompt). |
| 2026-10-08 | Desktop v2.31226.0 (3P): `desktopHome` added for "Unified Claude (beta)". | Desktop changelog | P | 3P admin control for the merged surface. |
| 2026-10-13 | Desktop v2.37337.1: "Fixed chats losing access to this computer's files and apps when registering the computer took more than a few seconds." | Desktop changelog | P | Confirms a computer-registration step behind the merged chat's local access (the device bridge). |
| 2026-10-14 | Claude Code 2.1.300: "Fixed Write, Edit and NotebookEdit in Cowork cloud sessions reporting success for a path on your own computer, where the file never arrived." | https://code.claude.com/docs/en/changelog | P | Cloud-session writes to the local disk go through a bridge and can fail. A room write from the cloud is not guaranteed. |
| 2026-10-14 | Claude Code 2.1.299/2.1.300: `PermissionRequest` hook behavior changed "in Cowork cloud sessions". | Claude Code changelog | P | Hooks do run inside Cowork cloud sessions (in the cloud VM, not on the user's computer). |
| 2026-10-19 | Claude Code 2.1.304: "Improved cloud sessions: a new conversation's first turn no longer waits for the local (stdio) MCP servers of plugins synced from claude.ai, unless a server sets `alwaysLoad: true`." | Claude Code changelog | P | A synced plugin's stdio server can start inside a cloud session. MindrianOS sets `alwaysLoad: true` on both servers, so a cloud first turn waits for them. A stdio server in the cloud sees the cloud VM disk, not the user's room. |
| 2026-10-23 | Unified experience GA for Claude Enterprise. | https://claude.com/resources/articles/cowork-is-now-claude (update line) | P | Enterprise users move to the merged surface. |
| 2026-11-03 | Desktop v4.16336.0: Chat/Cowork switch removed from a project page under Unified Claude. A message starts a Cowork task, or a chat on a computer that cannot run Cowork. | Desktop changelog | P | Old Projects in Desktop are Cowork-first. |
| 2026-11-09 | Claude Code 2.1.321: PostToolUse hook change "in Cowork cloud sessions". | Claude Code changelog | P | Second confirmation that hooks run in Cowork cloud sessions. |
| 2026-11-10 | Desktop: an unset `desktopHome` opens Unified Claude after 12:00 PM PT on 2026-11-10 (3P configs). Chat/Cowork switches removed from Setup. | Desktop changelog (v4.29.0 2026-10-27, v4.4212.0 2026-10-29, v5.1231.0 2026-11-10) | P | 3P fleets move to the merged surface. |
| 2026-11-12 | Unified experience GA for Claude Team. | https://claude.com/resources/articles/cowork-is-now-claude | P | Team users move to the merged surface. |
| 2026-11-16 | "Chat and Cowork unified" turns on by default in existing Enterprise orgs that made no choice. | https://support.claude.com/en/articles/17444462 | P | The Enterprise default is the merged cloud surface. |
| 2026-11-17 | Desktop v6.6395.0: Claude Code managed `allowedMcpServers`/`deniedMcpServers` apply to Settings > Developer local MCP servers in Chat and Cowork. Reverted in v6.28899.2 (2026-11-19). | Desktop changelog | P | Admins actively target local MCP servers from `claude_desktop_config.json` in Chat and Cowork. |
| 2026-11-17 | Desktop release channels (Stable, Latest). | release notes | P | Desktop behavior can differ by channel. Test both. |
| 2026-11-20 | Desktop v6.28899.6, bundled Claude Code 2.1.330. | Desktop changelog | P | The latest Desktop build read for this radar. |
| 2026-11-24 | Install artifacts as apps (beta), Mac/Windows, Desktop 6.28899.0 or later. | release notes ; https://support.claude.com/en/articles/18516354-install-an-artifact-as-an-app | P | A new local-app surface. Not a plugin runtime. |
| 2026-11-24 | Send files to connected apps and save files from them (beta). | release notes | P | Remote connectors can move files. |

## Answers

### Q1. Merged Desktop chat, consumer Max: do Claude Code plugins load? Which parts?

Answer: partly. The account plugin loads in the merged chat with skills, commands (as skills) and remote MCP connectors. Agents, hooks and local MCP servers are "Ignored" in the Chat column. Executables in a top-level `bin/` make Chat and Cowork refuse the whole plugin.

- Component table (Chat / Cowork / Claude Code): Skills: Loads / Loads / Loads. Commands: "Loads as a skill" / Loads / Loads. Agents: Ignored / Loads / Loads. Hooks: Ignored / Loads / Loads. Local MCP server: Ignored / "Loads when the Cowork session runs on your computer" / Loads. Top-level `bin/`: "Can't be installed" / "Can't be installed" / Loads. Source: https://claude.com/docs/plugins/platform-support (read 2026-11-27, page undated).
- "Hooks and sub-agents run in Cowork and Claude Code, not in chat, so they appear grayed out in chat." "A plugin's local MCP server runs in Cowork and Claude Code, not in chat." Source: https://support.claude.com/en/articles/13837440 (undated).
- "Local connectors and plugins that include local MCP servers work through the desktop app only." Source: https://support.claude.com/en/articles/15520349.
- Hooks in Chat on Desktop 1.52386.0+ applies to **third-party (3P) deployments only**. The page is "Claude Desktop on 3P" (Bedrock, Vertex, Foundry, gateway). The Cowork plugins guide links to it only "if your organization deploys Claude Desktop with its own model provider" (https://claude.com/docs/cowork/guide/plugins). The Desktop changelog lists "hooks from organization plugins to also run in Chat" under the 3P heading of v1.52386.0 (2026-09-10).
- Gap: the docs use "Chat" and "Cowork" as columns. No primary page says which column the merged conversation follows after it starts a Cowork task. See UNVERIFIED.
- MindrianOS-specific: the repo has a top-level `bin/` (cli.js, mindrian-mcp-server.cjs and others) and a mod (`hooks/mos-face.json` with `modules`). By the table, Customize > Plugins refuses an upload of this plugin, and the mod works only in Claude Code.

### Q2. Where does the merged chat's model run, and how does it reach local MCP servers? What happens if Desktop quits mid-task?

Answer: the work runs in an isolated cloud sandbox on Anthropic's servers. The task reaches local files, the browser, computer use and local connectors through the open Claude Desktop app on a registered ("linked") computer. If the app is closed, the cloud task keeps running but loses access to the computer.

- "Cowork tasks run in the cloud: Claude's work runs in an isolated, temporary environment on Anthropic's servers ... can't reach your home or company network ... When a task needs a local file or your browser, Claude reaches your computer through the Claude Desktop app ... If the desktop app is offline, the session can't reach your computer." https://support.claude.com/en/articles/13364135
- Enterprise: "when a task needs to run code or work with files, Claude continues the same conversation in an isolated cloud sandbox managed by Anthropic." "Through the Claude desktop app, members can link their computers so Claude can work with local folders, local MCP servers, and applications. Your Remote control and device policies govern this." Admin row: "Remote control ... When off, web, mobile, and scheduled tasks can't use a member's linked computer." https://support.claude.com/en/articles/17444462
- A computer-registration step exists: Desktop v2.37337.1 (2026-10-13) "Fixed chats losing access to this computer's files and apps when registering the computer took more than a few seconds."
- Quit mid-task: "If the app is closed, the session keeps running but can't reach your local files." (15520349). The Cowork troubleshooting text also says "If the app was closed or your computer went to sleep, the session may have ended" (https://support.claude.com/en/articles/13345190). The two pages differ. The cloud-first page (15520349) describes the newer model.
- Write failure risk: Claude Code 2.1.300 (2026-10-14) fixed cloud-session writes that reported "success for a path on your own computer, where the file never arrived".
- The tool prefix `mcp__remote-devices__<server>__<tool>` (observed on Windows) has no primary source. See UNVERIFIED.

### Q3. Desktop Code tab: local vs cloud sessions

Answer: a local Code-tab session is full Claude Code on the machine. A cloud Code-tab session is a fresh repo clone on an Anthropic VM. It has no access to local files or machine-scoped plugins.

- Environments: Local ("runs on your machine with direct access to your files"), Cloud ("runs on Anthropic-managed infrastructure ... continue even if you close the app"), SSH, WSL. https://code.claude.com/docs/en/desktop
- Local session: loads MCP servers from `claude_desktop_config.json`, `~/.claude.json` and `.mcp.json`. "Hooks and skills defined in settings apply to both" (CLI and Desktop). Plugins run in full. Sources: the same page, and 13837440: "In Claude Code, a plugin runs in full on your computer, including its skills, sub-agents, hooks, and MCP servers."
- Cloud session: "Cloud sessions start from a fresh clone ... Anything you've installed or configured only on your own machine isn't available." Repo `.claude/settings.json` hooks and `.mcp.json`: yes, in single-repo sessions only. Plugins declared in repo settings: no. User-scope plugins: no. `~/.claude.json` MCP servers: no. https://code.claude.com/docs/en/cloud-environments
- "Plugins you install on your computer at user or local scope aren't available in cloud sessions." https://code.claude.com/docs/en/desktop
- Can a cloud session see local files? No source says yes. Remote Control is the documented way to drive a local session from claude.ai/code: "Remote Control executes on your machine, so your local MCP servers, tools, and project configuration stay available." https://code.claude.com/docs/en/remote-control

### Q4. New Projects: plugins, hooks, MCP; where threads run; Library and memory

Answer: threads are Claude Code cloud sessions by default. They do not run repo hooks or repo `.mcp.json` servers. Plugins come from Project settings > Plugins. MCP comes from claude.ai connectors. A thread can run on the user's computer through Remote Control. Then it uses local hooks and MCP servers.

- Sources: https://code.claude.com/docs/en/claude-projects (undated); https://support.claude.com/en/articles/9517075; blog https://claude.com/resources/articles/projects-redesigned (2026-09-17).
- A cloud thread starts with: project repos and files, instructions and memory, repo `CLAUDE.md` "but not the repositories' `.mcp.json` servers or `.claude/settings.json` hooks, permission rules, and `env`", account connectors, and a cloud environment.
- Hooks in repo settings: "Not run. To use your hooks, run the thread on your own computer." Plugins in repo settings: "Not loaded. Add the plugin in Project settings > Plugins instead." MCP in `.mcp.json`: "Not loaded. Use the connectors on your claude.ai account instead." The project conversation itself "has no connectors".
- Local thread (Remote Control, Claude Code v2.1.280 or later on that computer): "Works with the files, tools, MCP servers, and Claude Code settings on that machine, including its hooks"; "Starts with the project's instructions, but not with its memory files loaded"; "Runs only while that computer is awake with Remote Control turned on".
- Library: "the files and folders you added and the files that threads produced." Uploads are copies.
- Memory: "Notes Claude keeps about the project ... stored as files. Every cloud thread reads the index file `MEMORY.md`." It is separate from Claude Code's local auto memory and from repo `CLAUDE.md`.
- Availability: public beta on Pro, Max and Ultra in claude.ai/code and the Desktop Code tab. Chat, Cowork, Team and Enterprise come later (9517075).

### Q5. Other 2026 items that matter

- **claude.ai/code cloud sessions**: a fresh clone, committed config only (cloud-environments page). Account skills load in place of `~/.claude/skills/` (desktop page).
- **Plugin sync**: account plugins sync into Claude Code v2.1.273+ as `@synced`. In terminal sessions their skills, agents, hooks, MCP servers and LSP servers load. The sync is one-way. `syncClaudeAiPlugins: false` stops it. Plugins do not sync with an API-key or Bedrock sign-in. https://support.claude.com/en/articles/13837440 ; https://code.claude.com/docs/en/plugins/loading
- **Hooks and stdio MCP servers inside Cowork cloud sessions**: Claude Code changelog entries 2.1.299, 2.1.300, 2.1.304, 2.1.314 and 2.1.321 name hook behavior and synced-plugin stdio servers in cloud sessions. They run in the cloud VM.
- **Remote Control**: drives a local session from claude.ai/code or mobile. Trusted Devices from 2026-06-25. Projects use it for local threads.
- **MCP Apps**: render inline in Claude. Desktop runs the example servers locally from the Settings > Developer config. https://claude.com/docs/connectors/building/mcp-apps/getting-started.md ; mobile interactive apps from 2026-03-25.
- **Artifacts as desktop apps**: beta from 2026-11-24, Desktop 6.28899.0+, Free to Enterprise. https://support.claude.com/en/articles/18516354-install-an-artifact-as-an-app
- **Plugin marketplace in Desktop and claude.ai**: Customize > Plugins. Limits: 25 marketplaces, 200 MB and 5,000 files per plugin. Sources: GitHub, and public GitLab/Bitbucket. Claude Code `/plugin directory` in v2.1.287+. (platform-support page)
- **Skills in chat**: plugin skills load in chat; commands load as skills (platform-support page).
- **Scheduled tasks**: run in the cloud. Tasks created on the computer moved to the cloud (15520349). Code-tab `/loop` tasks run for up to 30 days (Desktop v6.28899.6, 3P section).
- **Dispatch**: "isn't available to new users" (16761823). Dispatch runs on the desktop and needs the app open (https://support.claude.com/en/articles/13947068).
- **VM isolation**: one cloud sandbox for each session, removed at session end, with no access to the home or company network (13364135). The Enterprise EDR sensor runs in the local VM, not in the cloud sandbox (17444462).

## What MindrianOS must assume now

| Surface | Model runs | Plugin parts that load | Local MCP server | Room (local SQLite) |
|---|---|---|---|---|
| 1. Claude Code CLI (terminal, IDE) | Anthropic API, tools on the machine | All: skills, commands, agents, hooks, mods, MCP, `bin/` | Yes, on the machine | Yes |
| 2. Desktop Code tab, local session | Same as the CLI (bundled Claude Code) | All (plugins, hooks, `.mcp.json`, `~/.claude.json`, `claude_desktop_config.json`) | Yes | Yes |
| 3. Desktop Code tab, cloud session (also claude.ai/code, Projects cloud threads, cloud scheduled tasks) | Anthropic-managed VM | Only what is committed to the repo (single repo); Projects threads skip repo hooks and `.mcp.json`; account skills and connectors | Only if committed in `.mcp.json`, and then it runs in the VM | No. The VM has a clone, not the user's disk |
| 4. Merged Desktop chat ("one Claude") with device bridge | Anthropic cloud sandbox | Chat column: skills, commands as skills, remote connectors. Hooks and agents run only in Cowork-type sessions (in the cloud VM) | Only through the open Desktop app on a linked computer; observed prefix `mcp__remote-devices__...` | Only through the bridge, only while Desktop is open; a write can fail silently (2.1.300 fix) |
| 5. Web and mobile (claude.ai, iOS, Android) | Anthropic cloud | Same as 4 | Only through a linked computer with Desktop open | Same as 4, else none |
| 6. Remote Control (claude.ai/code or mobile driving a local Claude Code session) | Local Claude Code on the machine | All (local session) | Yes | Yes, while the machine is awake |

Rules to design by:

1. Treat the local Claude Code session (surfaces 1, 2 and 6) as the only full runtime. Hooks are a local Claude Code feature.
2. Treat every cloud surface as "no hooks that touch the user's disk" and "no room unless bridged".
3. Do not depend on a plugin upload to claude.ai. Chat and Cowork refuse the current plugin shape (top-level `bin/`, a mod), per the table. A claude.ai-facing package needs a separate shape: skills plus a remote or bridged MCP server.
4. A local stdio server that the merged chat reaches must work as a desktop-config server or a desktop extension. It must survive a closed app. It must confirm every write with a read-back.
5. With `alwaysLoad: true` on both MindrianOS servers, cloud sessions wait for them on the first turn if the plugin is synced (2.1.304).

## UNVERIFIED

1. Which component column (Chat or Cowork) the merged consumer conversation follows after it starts a Cowork task. No primary page states it. ASSUMED: Cowork rules apply inside the cloud sandbox, so hooks and agents run there, in the cloud VM.
2. Whether a plugin-bundled local stdio MCP server runs on the user's computer (through the bridge) or inside the cloud VM in a merged-chat cloud task. 15520349 says plugins with local MCP servers "work through the desktop app only". Claude Code 2.1.304 says that synced plugins' stdio servers start in cloud sessions. The two sources do not resolve this.
3. The tool prefix `mcp__remote-devices__<server>__<tool>` and the names "remote devices", "device bridge" and "Claude for Windows connection". Observed on one Windows machine on 2026-11-27. No primary source found.
4. The exact behavior of a merged-chat task when Desktop quits mid-tool-call. Two primary pages differ ("keeps running but can't reach your local files" vs "the session may have ended").
5. The 2026-09-16 date comes from the release notes, not from article 16761823 (undated).
6. The 2026-09-17 date of "Projects redesigned" comes from Tavily page metadata and secondary coverage (bosio.digital).
7. The 2026-09-15 date for Claude Code 2.1.273 comes from a secondary GitHub issue. The primary sources give the version only.
8. The Team default-on date 2026-12-01 has a secondary source only (aiswitch.co.kr). It is not used in the table.
9. Support article 14479288 ("Claude Cowork architecture overview") failed to fetch. Its content is not used.
10. The platform-support and plugins pages are undated. Their content is as read on 2026-11-27.
11. The MindrianOS-specific claims (`bin/`, mod, `alwaysLoad`) come from a read of the repo's `.claude-plugin/plugin.json`, `.mcp.json`, `bin/` and `hooks/mos-face.json`. No install test on claude.ai was run.

## Field evidence (2026-11-27, Windows Desktop, spike 012 legs A1 and A2)

- A local stdio server added to `claude_desktop_config.json` appeared in the merged chat as `mcp__remote-devices__s1-probe__s1_spawn` and `__s1_status`.
- A1: a detached child spawned by that server reached `complete` 5 s after start while the reply ended (pid 19768, 10:11:59Z to 10:12:04Z).
- A2: the owner quit Desktop from the tray within about 2 s of the spawn reply; the child still reached `complete` (pid 20764, 10:13:15Z to 10:13:20Z). The exact quit time was not recorded.
- B1 and B2 (separate Cowork) were not applicable: the account has the merged experience.
