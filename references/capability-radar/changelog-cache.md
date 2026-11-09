# Changelog Cache

This file is a rendered human-readable VIEW. `data/capability-ledger.json` is the source of record;
`/mos:radar --fetch` writes the ledger first (Step 3b of `commands/radar.md`), then regenerates
this view from it.

Last fetched: 2026-11-09
Source (2.1.281 and later): https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md (2.1.321 screened 2026-11-09 from the second live ask-first fetch; 2.1.319 screened 2026-11-08 from the first live ask-first fetch; 2.1.288 through 2.1.318 screened 2026-11-07 from a full local read)
Source (2.1.247 through 2.1.280): https://github.com/anthropics/claude-code/releases

**Provenance (screen of 2026-11-09).** Claude Code 2.1.321 was screened from the second live run of
the ask-first radar fetch: one public GET of the fixed CHANGELOG URL, no room data (1192343 of 1192343
characters read, complete, 438 headers, fetch time 2026-11-09T19:51:53Z). The file has no 2.1.320
entry, so 2.1.321 is the only version newer than 2.1.319. All 118 bullets were screened as data. Four
rows were added (one no-op, three dormant). The ledger now covers 2.1.128 through 2.1.321 and the
installed host is 2.1.321.

**Provenance (screen of 2026-11-08).** Claude Code 2.1.319 was screened from the first live run of
the ask-first radar fetch: one public GET of the fixed CHANGELOG URL, no room data, run through
`scripts/radar-changelog-slice.cjs --approve` with the navigator's go-ahead (1175667 of 1175667
characters read, complete, 437 headers, fetch time 2026-11-08T08:16:43Z). All 146 bullets of 2.1.319
were screened as data; most are gateway, VS Code, cloud, Chrome and permission-fix lines with no
shipped repo surface. Four rows were added (one no-op, three dormant). The ledger now covers
2.1.128 through 2.1.319 and the installed host is 2.1.319.

**Provenance (screen of 2026-11-07).** Claude Code 2.1.288 through 2.1.318 were screened from a full
local read of the main CHANGELOG.md (1175667 characters, complete; newest read 2.1.319, oldest read
2.1.287). The file has no entry for 2.1.297, 2.1.298, 2.1.313 and 2.1.315. Version 2.1.319 was in the
file and is screened by the 2026-11-08 entry above. Six dormant rows were added; no live fetch ran
for this entry.

**Provenance (gap closed 2026-10-02).** The 2026-10-01 fetch left Claude Code 2.1.247 through
2.1.280 unscreened, because the main CHANGELOG.md only carries 2.1.281 and later. On 2026-10-02
that range was screened from the GitHub release notes. No release tag exists for 2.1.249, 2.1.253
to 2.1.256, 2.1.262, 2.1.264 or 2.1.279. The ledger now covers 2.1.128 through 2.1.287 with no
unscreened range. The 2.1.247 to 2.1.280 rows are dormant (untriaged) and their destinations were
repo-checked on 2026-10-02; the 2.1.281 to 2.1.287 rows remain a fields-only summary not yet
verified against repo files. The earlier stale entries (2.1.110 through 2.1.128) from the May 2026
cache are superseded by the ledger and are no longer repeated here.

**Elicitation finding (2026-10-02).** No release in 2.1.247 to 2.1.280 changed elicitation form
defaults; the only elicitation-adjacent change there was 2.1.257's notification timing for a queued
ask. MCP URL-mode elicitation landed in 2.1.281 (2.1.283 carries no elicitation change); 2.1.284
made an Elicitation hook's block decision decline the elicitation; 2.1.287 added MCP URL prompts
with a per-server bareElicitationCapability fallback key, and its form-field line is a
screen-reader fix, not a form-behavior change. The "not set / required" grant card was observed ON
2.1.287 (SEED-104), so the navigator's 2026-10-02 "Normal card on CLI" ruling stands.

## Recent Changes Relevant to MindrianOS

### 2.1.321 (date not in fetched fields)
- **Domain:** code
- **Change:** A mod's own tool calls ($.tool.call, $.mcp.call) raise no permission prompt; deny rules and organization policy still apply. Mods Claude writes turn on without asking in auto and bypass modes and do not load in dontAsk mode.
- **MindrianOS impact:** The face panel is a plugin mod (`hooks/mos-face.json`). Note only; the owner check that the panel still loads in dontAsk is owed to Phase 392 or a later mod phase.

### 2.1.321 (date not in fetched fields)
- **Domain:** plugins_mcp
- **Change:** Fixed an MCP server showing connected with no tools after a reconnect or a directory change while tools were loading; also fixed context usage estimates that overcounted tool definitions.
- **MindrianOS impact:** The `mindrian-os` server (`.mcp.json`, alwaysLoad) has a large tool list. Watch item and measurement note for Phase 392; dormant.

### 2.1.321 (date not in fetched fields)
- **Domain:** desktop_cowork
- **Change:** A project's MCP server is no longer disconnected after the first message in a Desktop Code tab session when the desktop app has an MCP server or extension of the same name.
- **MindrianOS impact:** This touches the Desktop prefix risk (owner item A). The real mos-desktop install test is still owed; not claimed fixed for us. Dormant.

### 2.1.321 (date not in fetched fields)
- **Domain:** plugins_mcp
- **Change:** Plugin auto-updates and marketplace updates no longer download a plugin again per worktree; nested `.claude/skills` folders inside `~/.claude/plugins` no longer load; skill and command names with a Bamum letter are refused.
- **MindrianOS impact:** Install and update path only. All command and skill names are ASCII (113 command files, 125 skill folders, 231 name fields checked). No action (no-op row).

### 2.1.319 (date not in fetched fields)
- **Domain:** plugins_mcp
- **Change:** MCP servers on the older handshake no longer fail to connect or return empty results, because Claude Code stopped declaring an extension it only uses with newer servers.
- **MindrianOS impact:** Both servers in `.mcp.json` are stdio and `tests/test-267-mcpv2-brain-shim.cjs` covers both handshake eras. A free fix, no change needed (no-op row).

### 2.1.319 (date not in fetched fields)
- **Domain:** plugins_mcp
- **Change:** MCP tasks work in the terminal without feature-flag fetching: a server tool call run as a task moves to the background and the result is reported later. `CLAUDE_CODE_DISABLE_MCP_TASKS=1` turns it off.
- **MindrianOS impact:** `lib/mcp/capability-registry.cjs` holds only a commented Phase 58 tasks hook point, and the CLI surface maps tasks to false. A candidate for long tools; dormant.

### 2.1.319 (date not in fetched fields)
- **Domain:** code
- **Change:** PostToolUse hooks now run, with up to 10 seconds, on tool calls that finish after a new message interrupts the turn.
- **MindrianOS impact:** `hooks/hooks.json` registers nine PostToolUse hooks (timeouts 3 to 5); each must stay safe on a half-finished turn. Dormant check.

### 2.1.319 (date not in fetched fields)
- **Domain:** code
- **Change:** A slash command typed after a leading space, tab or newline now runs instead of going to Claude as plain text.
- **MindrianOS impact:** `scripts/admin-command-gate.cjs` already trims leading whitespace before it matches, so a gated command cannot slip by. No test pins the leading-whitespace case; dormant.

### 2.1.318 (date not in fetched fields)
- **Domain:** plugins_mcp
- **Change:** A stdio MCP server that dies in under 3 s for its own reason is pinned to the legacy handshake for 7 days; one that exits on the version probe is no longer re-probed each start. Both shipped stdio servers must start clean when cold.
- **MindrianOS impact:** Both servers in `.mcp.json` are stdio; `tests/test-267-mcpv2-brain-shim.cjs` covers both handshake eras. Dormant.

### 2.1.310 (date not in fetched fields)
- **Domain:** code
- **Change:** Plugin monitors are background watchers declared in monitors/monitors.json; a candidate to replace poll-style hooks. They do not start with the -p flag. Candidate only, no change planned.
- **MindrianOS impact:** No monitors file ships today. A candidate for later, not a change now.

### 2.1.299 (date not in fetched fields)
- **Domain:** code
- **Change:** UserPromptSubmit hooks see the raw typed line before a skill or command expands; a block also stops its embedded shell commands. No shipped hook returns updatedInput. The admin gate already reads the raw prompt.
- **MindrianOS impact:** The admin command gate already works on the raw typed line. No change needed.

### 2.1.299 (date not in fetched fields)
- **Domain:** plugins_mcp
- **Change:** An agent tools list takes only the named server's tools; a server name with a double underscore needs the whole name plus __*. No shipped line breaks it, but 13 agents list tools only under allowed-tools, which the host ignores.
- **MindrianOS impact:** Those 13 agents inherit every tool; their read-only comments do not hold at the host level. Tracked in phase 391.

### 2.1.295 (date not in fetched fields)
- **Domain:** code
- **Change:** onFailure block makes a command or HTTP hook that cannot start, times out or exits oddly stop the action. Already on the Part 8 egress guard; the web credential guard has none. SDK callbacks follow in 2.1.317.
- **MindrianOS impact:** The egress guard already uses it. The web credential hook does not; that is a decision for the owner.

### 2.1.292 (date not in fetched fields)
- **Domain:** plugins_mcp
- **Change:** Claude Code asks stdio, HTTP and connector servers for MCP protocol 2026-07-28 by default; MCP_PROTOCOL_NEGOTIATION=legacy opts out. Both shipped servers negotiate it clean in local runs.
- **MindrianOS impact:** No change needed; both servers pass the local handshake test.

### 2.1.287 (date not in fetched fields)
- **Domain:** plugins_mcp + models
- **Change:** Claude Mods for plugins, including a built-in mod; MCP URL prompts; improved MCP tool handling; Opus/Sonnet 1M context default on multiple providers.
- **MindrianOS impact:** Mods may be a new plugin extension point (unread). URL prompts touch the gate and key-handoff flow. 1M default is absorbed by alias-based `lib/core/model-profiles.cjs`.

### 2.1.285 (date not in fetched fields)
- **Domain:** plugins_mcp
- **Change:** Plugin configuration via CLI; MCP tool lists refresh after protocol changes; managed allowedProviders setting; plugin dependency install fix.
- **MindrianOS impact:** CLI plugin configuration may simplify tester setup docs.

### 2.1.284 (date not in fetched fields)
- **Domain:** models + plugins_mcp
- **Change:** Sonnet 5.5 as default model; plugin options forms in VS Code; marketplace sparse install fix; MCP reconnection handling.
- **MindrianOS impact:** Default model change flows through the `sonnet` alias; no config change expected.

### 2.1.282 (date not in fetched fields)
- **Domain:** plugins_mcp
- **Change:** The name claude-ai is reserved for skills, workflows and MCP servers; plugin uninstall options fix; marketplace validation; Skill rule matching for the anthropic-skills namespace.
- **MindrianOS impact:** A first grep found no repo surface using the reserved name; likely a no-op.

### 2.1.281 (date not in fetched fields)
- **Domain:** plugins_mcp
- **Change:** MCP URL-mode elicitation; MCP server validation in plugin checks; resumed sessions with MCP tool calls fixed; plugin validate reporting.
- **MindrianOS impact:** URL-mode elicitation extends the existing elicitation rows; validation reporting may overlap the release-gate manifest checks.

### 2.1.280 (2026-09-22)
- **Domain:** plugins_mcp
- **Change:** An environment variable now sets the 2,048-character cap on MCP tool descriptions and server instructions.
- **MindrianOS impact:** The mindrian-os server instructions measure 1984 bytes, so they are under the cap and arrive whole. The truncation seen in sessions is the remote pws-brain-mcp server (a user-level config entry, not shipped by this plugin). Touches `lib/mcp/runtime-instructions.cjs` and the tool-description floor tests.

### 2.1.277 (2026-09-18)
- **Domain:** code
- **Change:** Subagent results now arrive under a subagent-output header, indented (2.1.277); in auto mode a subagent hands its work back through a reviewed call (2.1.271).
- **MindrianOS impact:** `commands/research.md` consumes research-lane-analyst JSON, and that parse is unchecked under the new framing. Candidate verification target.

### 2.1.275 (2026-09-17)
- **Domain:** plugins_mcp + desktop_cowork
- **Change:** npm-source plugins are fetched with `npm pack --ignore-scripts` and integrity-verified; skills and plugins enabled on a claude.ai account sync into terminal sessions signed in with it (2.1.273 made sign-in request plugin access).
- **MindrianOS impact:** The marketplace ships mos as npm `@mindrian_os/cli` and `package.json` has no install scripts, so nothing is lost; the dependency install path (`lib/core/mcp-dep-heal.cjs`) is unread. The account sync touches the Desktop/Cowork-to-CLI install story and is untriaged.

### 2.1.274 (2026-09-17)
- **Domain:** plugins_mcp
- **Change:** AskUserQuestion preview notes attach to the highlighted option and Enter no longer drops them.
- **MindrianOS impact:** `lib/hmi/dial-presenter.cjs` fills the option preview field with the De Stijl reach panel, so dial cards benefit passively; no code change expected.

### 2.1.271 (2026-09-14)
- **Domain:** code + plugins_mcp
- **Change:** Agent frontmatter `omitClaudeMd` runs a plugin subagent without user, project and local CLAUDE.md. The `claude plugin` install, update, uninstall, enable and disable verbs gained `--json` (2.1.268), and install and update gained `--accept-command` taking the sha256 of a prior `--json` run.
- **MindrianOS impact:** `agents/research-lane-analyst.md` lists the key as supported but does not set it; a candidate for its Part 8 never-see-room-content isolation. `scripts/release.sh` prints the user install lines, which the new flags could tighten.

### 2.1.269 (2026-09-11)
- **Domain:** plugins_mcp
- **Change:** `claude plugin eval` runs a plugin eval suite against Claude Code with scored, reproducible JSON and HTML results.
- **MindrianOS impact:** Standing rule: MindrianOS evals run through Jev (`scripts/jev-devtime-client.cjs`). A watch item, not a replacement.

### 2.1.265 (2026-09-08)
- **Domain:** plugins_mcp
- **Change:** The Installed tab and plugin details now prefer the marketplace entry over plugin.json.
- **MindrianOS impact:** FINDING: the marketplace description is stale (it still says 73 commands, 8 agents, 13 hooks) and `release.sh` Step 4 bumps only versions, so users now see the stale text on the Installed tab. Destinations: `scripts/release.sh`, `.claude-plugin/plugin.json`.

### 2.1.261 (2026-09-04)
- **Domain:** plugins_mcp
- **Change:** `/skill-doctor` shows which loaded skills go unused and what each costs in context.
- **MindrianOS impact:** The plugin ships 126 skills under `skills/`, so this is a ready host-side read on their context cost for a pruning pass.

### 2.1.259 (2026-09-02)
- **Domain:** plugins_mcp + desktop_cowork
- **Change:** `claude plugin validate` gained `--json` for a machine-readable report; `managedMcpServers` lets an organization push HTTP/SSE MCP servers to every user, and entries that run a command are skipped.
- **MindrianOS impact:** `scripts/verify-release` (lines 38, 52) and `scripts/release.sh` (lines 577, 1632) parse the validate text output today; the JSON form would make that gate structural. Both plugin servers are stdio commands, and a raw HTTP Brain entry would bypass the mindrian-brain shim Part 8 guard.

### 2.1.257 (2026-09-01)
- **Domain:** models
- **Change:** `CLAUDE_CODE_SUBAGENT_MODEL` became a default that an agent's `model:` overrides (2.1.251); a `_FORCE` variant overrides every agent (2.1.257).
- **MindrianOS impact:** All 17 plugin agents declare `model: inherit`; `lib/core/model-profiles.cjs` and `lib/core/claude-routing.cjs` never read the env var. Destination: `agents/`.

### 2.1.251 (2026-08-28)
- **Domain:** plugins_mcp + code
- **Change:** PreModelSwitch and PostModelSwitch hook events can block, confirm or annotate a model switch; SessionStart resume hooks receive staleness and re-cache cost; status line scripts receive a `prompt_cache` object (hit ratio, misses, warm or cold; a likely miss cause was added in 2.1.260).
- **MindrianOS impact:** `hooks/hooks.json` registers 12 events, neither switch event. `scripts/statusline-mos` does not read `prompt_cache`; a candidate cockpit signal.

### 2.1.248 (2026-08-27)
- **Domain:** code
- **Change:** Agent frontmatter `experimental.cacheTtl` (5m or 1h) sets a per-agent prompt cache TTL when no subagent TTL setting is configured.
- **MindrianOS impact:** None of the 17 plugin agents set it; the long research lanes are the candidates.

### Screened out (no ledger row)

- **2.1.321 (the other 108 bullets, no-action items first):** The Fable 5.2 model addition (the project never pins or uses a Fable model) and the Cowork rule that a PostToolUse hook can no longer replace the AskUserQuestion answer (`hooks/hooks.json` has no PostToolUse hook that matches AskUserQuestion). The rest is gateway, remote control, VS Code, cloud session, Windows, macOS, Chrome, Bash and file permission fixes, OpenTelemetry and /model picker lines with no shipped repo surface.
- **2.1.319 (the other 140 bullets):** Claude apps gateway, self-hosted runner, VS Code, cloud session, Claude in Chrome, Claude Tag, auto mode server check, Bash and sed permission fixes, /diff, /rewind, OpenTelemetry, agents view, artifact database and /claude-api lines. None touches a shipped surface: the repo has no gateway or runner config, no subagentStatusLine, no PermissionRequest hook, and no Monitor use. `permissions.denyInsteadOfPrompting` and the mod hot-reload fixes were read and judged not to change a repo dependency.
- **2.1.283 and 2.1.286 (plugins_mcp):** 2.1.283 added MCP tool and WebFetch outputs to OpenTelemetry spans plus MCP startup and sign-in fixes; 2.1.286 added list mouse support, marketplace error and listing improvements, and headless MCP startup. No repo surface plausibly touched.
- **2.1.280:** Agent-type PermissionRequest hooks are now refused. `hooks/hooks.json` registers no PermissionRequest event and only command-type hooks.
- **2.1.274:** MCP entries of type sdk are skipped with a warning. `.mcp.json` declares two stdio command servers, no sdk entry.
- **2.1.274:** Plugin and marketplace clones leave Git LFS files as pointers. No LFS-tracked files exist (`.gitattributes` carries no lfs filter) and the marketplace source is npm, not a git clone.
- **2.1.265:** `--plugin-dir` can point at a folder of plugins. Dev scripts pass the single repo plugin; nothing gained.
- **2.1.257:** Queued MCP elicitation asks send their idle notification on time. Host notification timing only; see the elicitation finding.
- **2.1.257:** Symlinked plugin component paths are refused. No symlinks exist under `commands/`, `agents/`, `skills/`, `hooks/`, `pipelines/`, `output-styles/`.
- **2.1.259 and 2.1.267:** `model:` and `effort:` frontmatter on commands and skills is now honored. No command or skill declares either key (all 17 agents use `model: inherit`, covered by the 2.1.257 row).
- **2.1.247, 250, 252, 258, 260, 263, 266, 267, 270, 272, 273, 276, 278:** Remaining release content, screened with no change plausibly touching a shipped surface beyond what the rows above already cite (the 2.1.260 prompt-cache cause and the 2.1.273 claude.ai plugin access are folded into rows).
