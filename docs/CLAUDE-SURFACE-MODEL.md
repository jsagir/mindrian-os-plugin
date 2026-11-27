# Claude surface model

Status: doctrine.
Written 2026-11-27 from the Claude surface radar of 2026-11-27 (Tavily extract of primary Anthropic pages).
This file is the one place that says where MindrianOS runs. CLAUDE.md (Tri-Polar table, Three surfaces constraint) and .claude/includes/decisions.md (decision 4) point here.

## In plain words

The old picture had three places on your own computer: the Claude Code CLI, Claude Desktop, and Cowork. That picture is gone. Three facts replace it. First, chat and Cowork are now one Claude, and it runs in Anthropic's cloud. Second, your computer is now a remote device: a cloud task reaches your files and local MCP servers only through the open Desktop app (the device bridge). Third, MindrianOS runs in full only in local Claude Code: the CLI, and a local Desktop Code-tab session. Remote Control drives such a local session from the cloud.

Here is one picture. The room is a notebook on your desk. Local Claude Code sits at the desk. Desktop chat works in Anthropic's office. It can read or write the notebook only while the Desktop app holds the line open. A write over that line can say "done" when the page never arrived.

Why it matters: a feature that needs the room must work in local Claude Code. Anywhere else it must say "no room" honestly (decision 8, honest refusal).

Terms used in this file. "Desktop chat" means the merged chat (formerly chat plus Cowork). "Device bridge" means the open Claude Desktop app on a linked computer, which a cloud task uses to reach the computer. "The room" means the local SQLite room (room.db) and its folder.

## The six surfaces

| Surface | Model runs | Plugin parts that load | Local MCP server | Room (local SQLite) |
|---|---|---|---|---|
| 1. Claude Code CLI (terminal, IDE) | Anthropic API, tools on the machine | All: skills, commands, agents, hooks, mods, MCP, `bin/` | Yes, on the machine | Yes |
| 2. Desktop Code tab, local session | Same as the CLI (bundled Claude Code) | All (plugins, hooks, `.mcp.json`, `~/.claude.json`, `claude_desktop_config.json`) | Yes | Yes |
| 3. Desktop Code tab, cloud session (also claude.ai/code, Projects cloud threads, cloud scheduled tasks) | Anthropic-managed VM | Only what is committed to the repo (single repo); Projects threads skip repo hooks and `.mcp.json`; account skills and connectors | Only if committed in `.mcp.json`, and then it runs in the VM | No. The VM has a clone, not the user's disk |
| 4. Desktop chat ("one Claude") with device bridge | Anthropic cloud sandbox | Chat column: skills, commands as skills, remote connectors. Hooks and agents run only in Cowork-type sessions (in the cloud VM) | Only through the open Desktop app on a linked computer; observed prefix `mcp__remote-devices__...` | Only through the device bridge, only while Desktop is open; a write can fail silently (2.1.300 fix) |
| 5. Web and mobile (claude.ai, iOS, Android) | Anthropic cloud | Same as 4 | Only through a linked computer with Desktop open | Same as 4, else none |
| 6. Remote Control (claude.ai/code or mobile driving a local Claude Code session) | Local Claude Code on the machine | All (local session) | Yes | Yes, while the machine is awake |

CLAUDE.md Tri-Polar rows map to these surfaces: Claude Code CLI = surface 1; Claude Desktop Code tab = surfaces 2 (local session) and 3 (cloud session); Claude Desktop chat (formerly chat plus Cowork) = surfaces 4 and 5; Remote Control (surface 6) is a local Claude Code session driven from the cloud.

## Which plugin parts load where

| Component | Chat | Cowork | Claude Code |
|---|---|---|---|
| Skills | Loads | Loads | Loads |
| Commands | Loads as a skill | Loads | Loads |
| Agents | Ignored | Loads | Loads |
| Hooks | Ignored | Loads | Loads |
| Local MCP server | Ignored | Loads when the Cowork session runs on your computer | Loads |
| Top-level `bin/` | Can't be installed | Can't be installed | Loads |

Source: https://claude.com/docs/plugins/platform-support (read 2026-11-27, page undated). The hooks-in-Chat change of Desktop v1.52386.0 (2026-09-10) is for third-party (3P) deployments only, not for consumer Max.

MindrianOS today (read from the repo; no install test on claude.ai was run, UNVERIFIED item 11):

- The repo has a top-level `bin/` (cli.js, mindrian-mcp-server.cjs and others). By the table, Customize > Plugins refuses this plugin shape.
- The mod `hooks/mos-face.json` works only in Claude Code.
- `.mcp.json` sets `alwaysLoad: true` on both servers (mindrian-os, mindrian-brain). A cloud first turn waits for them if the plugin is synced (Claude Code 2.1.304, 2026-10-19).

## Where the room is reachable

The room has 3 routes:

- (a) A local Claude Code session (surfaces 1, 2 and 6).
- (b) A cloud surface (surfaces 4 and 5) through the device bridge, only while the Desktop app is open on a linked computer.
- (c) Remote Control, while the machine is awake with Remote Control on.

Every other case is "no room". Code-tab cloud sessions, claude.ai/code, Projects cloud threads and cloud scheduled tasks start from a fresh clone and do not see the user's disk.

Warning: a write from a cloud session to the user's computer reported success where the file never arrived (fixed in Claude Code 2.1.300, 2026-10-14). Every bridged room write needs a read-back.

Warning: if the Desktop app closes, the cloud task keeps running but cannot reach the computer (support article 15520349). An older page says the session may have ended (UNVERIFIED item 4).

## Design rules

1. Treat the local Claude Code session (surfaces 1, 2 and 6) as the only full runtime. Hooks are a local Claude Code feature.
2. Treat every cloud surface as "no hooks that touch the user's disk" and "no room unless bridged".
3. Do not depend on a plugin upload to claude.ai. Chat and Cowork refuse the current plugin shape (top-level `bin/`, a mod), per the table. A claude.ai-facing package needs a separate shape: skills plus a remote or bridged MCP server.
4. A local stdio server that the merged chat reaches must work as a desktop-config server or a desktop extension. It must survive a closed app. It must confirm every write with a read-back.
5. With `alwaysLoad: true` on both MindrianOS servers, cloud sessions wait for them on the first turn if the plugin is synced (2.1.304).
6. A feature that needs the room states "no room" honestly on a surface without a route to it, and never reports a room write it did not read back (decision 8).

## Key dates

P = primary source (Anthropic page read with tavily_extract). S = secondary source.

| Date | Change | P/S |
|---|---|---|
| 2026-01-12 | Cowork research preview runs locally on your computer in an isolated VM | P |
| 2026-07-07 | Cowork on web and mobile; sessions run remotely (beta) | P |
| 2026-09-15 | Synced plugins need Claude Code 2.1.273 or later; the date is secondary | P (version) / S (date) |
| 2026-09-16 | The unified experience rolls out to Pro and Max | P |
| 2026-09-17 | Projects redesigned; threads are Claude Code cloud sessions; the date is secondary | P (content) / S (date) |
| 2026-10-06 | New Cowork tasks on Pro, Max and Ultra run in the cloud; no switch back | P |
| 2026-10-13 | Desktop v2.37337.1: computer-registration fix | P |
| 2026-10-14 | Claude Code 2.1.300: write fix for cloud sessions | P |
| 2026-10-19 | Claude Code 2.1.304: `alwaysLoad` first-turn wait | P |
| 2026-10-23 | Unified experience GA for Enterprise | P |
| 2026-11-12 | Unified experience GA for Team | P |
| 2026-11-16 | Chat and Cowork unified turns on by default in existing Enterprise orgs | P |
| 2026-11-20 | Desktop v6.28899.6, bundled Claude Code 2.1.330; the latest build read | P |

## UNVERIFIED

None of the 11 items below is proven.

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

## Field evidence (spike 012)

Windows Desktop, 2026-11-27, spike 012 legs A1 and A2. This is one machine, one run.

- A local stdio server added to `claude_desktop_config.json` appeared in the merged chat as `mcp__remote-devices__s1-probe__s1_spawn` and `__s1_status`.
- A1: a detached child spawned by that server reached `complete` 5 s after start while the reply ended (pid 19768, 10:11:59Z to 10:12:04Z).
- A2: the owner quit Desktop from the tray within about 2 s of the spawn reply; the child still reached `complete` (pid 20764, 10:13:15Z to 10:13:20Z). The exact quit time was not recorded.
- B1 and B2 (separate Cowork) were not applicable: the account has the merged experience.

## Open product fixes

The product fixes are not done here. They are planted as SEED-173 at .planning/seeds/SEED-173-claude-surface-model-product-fixes.md (owner decision 2026-11-27, "Map now, fixes later").

- (a) The top-level bin/ blocks a plugin install in chat.
- (b) Hooks, agents and local MCP servers are ignored in chat; re-check the Phase 367 Desktop path.
- (c) A room write from a cloud session can report success and not arrive.
- (d) alwaysLoad: true on both servers makes a cloud first turn wait.
- (e) The 'cowork' label stays as a legacy label for now.
- (f) New Projects threads skip repo hooks and .mcp.json.
- (g) Other doctrine text still names the old three surfaces.

## Recheck by

The rollout moves, so this map ages. Recheck on or after 2026-12-01 (the Team default-on date that only a secondary source gives, UNVERIFIED item 8), and at each Claude Desktop or Claude Code changelog entry that names Chat, Cowork, cloud sessions, plugins, hooks or MCP. Re-read the undated platform-support and plugins pages at each recheck (UNVERIFIED item 10). The session that rechecks updates the radar in both homes and this file in the same commit.

## Sources

Radar, two homes:

- .planning/quick/261127-hdl-surface-model-cowork-merged-into-chat/claude-surface-radar.md (repo copy)
- ~/MindrianRooms/rethinking-mindrianos/research/2026-11-27-claude-surface-radar/claude-surface-radar.md (room copy, the durable reasoning trail per the Dev-Research Compositing rule)

Primary URLs cited by the radar:

- https://support.claude.com/en/articles/12138966-release-notes
- https://claude.com/docs/cowork/changelog
- https://claude.com/docs/third-party/claude-desktop/extensions
- https://support.claude.com/en/articles/13837440
- https://claude.com/resources/articles/cowork-is-now-claude
- https://support.claude.com/en/articles/16761823
- https://claude.com/resources/articles/projects-redesigned
- https://support.claude.com/en/articles/15520349
- https://code.claude.com/docs/en/changelog
- https://support.claude.com/en/articles/17444462
- https://support.claude.com/en/articles/18516354-install-an-artifact-as-an-app
- https://claude.com/docs/plugins/platform-support
- https://claude.com/docs/cowork/guide/plugins
- https://support.claude.com/en/articles/13364135
- https://support.claude.com/en/articles/13345190
- https://code.claude.com/docs/en/desktop
- https://code.claude.com/docs/en/cloud-environments
- https://code.claude.com/docs/en/remote-control
- https://code.claude.com/docs/en/claude-projects
- https://support.claude.com/en/articles/9517075
- https://code.claude.com/docs/en/plugins/loading
- https://claude.com/docs/connectors/building/mcp-apps/getting-started.md
- https://support.claude.com/en/articles/13947068
