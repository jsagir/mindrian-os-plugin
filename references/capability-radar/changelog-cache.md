# Changelog Cache

This file is a rendered human-readable VIEW. `data/capability-ledger.json` is the source of record;
`/mos:radar --fetch` writes the ledger first (Step 3b of `commands/radar.md`), then regenerates
this view from it.

Last fetched: 2026-10-02
Source (2.1.281 and later): https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md
Source (2.1.247 through 2.1.280): https://github.com/anthropics/claude-code/releases

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

- **2.1.283 and 2.1.286 (plugins_mcp):** 2.1.283 added MCP tool and WebFetch outputs to OpenTelemetry spans plus MCP startup and sign-in fixes; 2.1.286 added list mouse support, marketplace error and listing improvements, and headless MCP startup. No repo surface plausibly touched.
- **2.1.280:** Agent-type PermissionRequest hooks are now refused. `hooks/hooks.json` registers no PermissionRequest event and only command-type hooks.
- **2.1.274:** MCP entries of type sdk are skipped with a warning. `.mcp.json` declares two stdio command servers, no sdk entry.
- **2.1.274:** Plugin and marketplace clones leave Git LFS files as pointers. No LFS-tracked files exist (`.gitattributes` carries no lfs filter) and the marketplace source is npm, not a git clone.
- **2.1.265:** `--plugin-dir` can point at a folder of plugins. Dev scripts pass the single repo plugin; nothing gained.
- **2.1.257:** Queued MCP elicitation asks send their idle notification on time. Host notification timing only; see the elicitation finding.
- **2.1.257:** Symlinked plugin component paths are refused. No symlinks exist under `commands/`, `agents/`, `skills/`, `hooks/`, `pipelines/`, `output-styles/`.
- **2.1.259 and 2.1.267:** `model:` and `effort:` frontmatter on commands and skills is now honored. No command or skill declares either key (all 17 agents use `model: inherit`, covered by the 2.1.257 row).
- **2.1.247, 250, 252, 258, 260, 263, 266, 267, 270, 272, 273, 276, 278:** Remaining release content, screened with no change plausibly touching a shipped surface beyond what the rows above already cite (the 2.1.260 prompt-cache cause and the 2.1.273 claude.ai plugin access are folded into rows).
