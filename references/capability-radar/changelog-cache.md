# Changelog Cache

This file is a rendered human-readable VIEW. `data/capability-ledger.json` is the source of record;
`/mos:radar --fetch` writes the ledger first (Step 3b of `commands/radar.md`), then regenerates
this view from it.

Last fetched: 2026-05-05 (stale - see honesty record below; regenerated on next `/mos:radar --fetch`)
Source: https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md

**Honesty record (Canon Part 6 dog-fooding).** This file sat frozen at Claude Code 2.1.128
from 2026-05-05 until Phase 265 corrected the write-back link in `commands/radar.md`.
`138-CONTEXT.md` claimed on 2026-06-01 that "the cache already carries the 2.1.148-159
findings" - that claim was false. Those findings only ever existed inside 138-CONTEXT.md's own
markdown table, which is exactly the rot pattern this file's write-back step now exists to end.
The stale entries below (2.1.110 through 2.1.128) are preserved as-is rather than silently
backfilled; `data/capability-ledger.json` already covers 2.1.128 through 2.1.246 (see its
`ledger_covers` block), and the next `/mos:radar --fetch` will regenerate this entire view from
the ledger rather than hand-authoring the gap here.

## Recent Changes Relevant to MindrianOS (stale, pending next --fetch regeneration)

### 2.1.128
- **Domain:** plugins_mcp
- **Change:** Bare `/color` picks random session color; `/mcp` shows tool count for connected servers and flags servers with 0 tools; `--plugin-dir` accepts `.zip` archives; updated `/model` picker with collapsed Opus 4.7 entries; MCP reconnects summarize re-announced tools by server prefix; `/plugin update` fixed for npm-sourced plugins
- **MindrianOS impact:** `.zip` distribution is a side-channel for beta testers (Lawrence + 4 new testers in `docs/testers/`) ahead of marketplace tag promotion. `/mcp` 0-tool flagging is direct diagnostic for Brain MCP failure modes - candidate for `/mos:doctor --brain` integration. `/plugin update` npm fix matters if MindrianOS ever ships an npm-sourced variant.

### 2.1.126
- **Domain:** code
- **Change:** `claude project purge [path]` deletes Claude Code state with `--dry-run`, `-y`, `-i`, `--all` flags; `--dangerously-skip-permissions` bypasses prompts for protected paths; OAuth code can be pasted when browser callback unreachable; PowerShell improvements on Windows
- **MindrianOS impact:** `claude project purge` is a clean-slate command for testers when a room install goes sideways. Could replace ad-hoc `~/.claude/plugins/mindrian-os.stale-*` cleanup. PowerShell parity matters if MindrianOS expands to Windows testers.

### 2.1.122
- **Domain:** plugins_mcp + models
- **Change:** Added `ANTHROPIC_BEDROCK_SERVICE_TIER` env variable; `/resume` finds session from pasted PR URL; `/mcp` shows hidden claude.ai connectors with deduplication hints
- **MindrianOS impact:** Bedrock tier selection is relevant for enterprise customers down the road. `/mcp` connector dedup helps when users have both claude.ai-managed MCPs and locally-configured Brain MCP.

### 2.1.121
- **Domain:** plugins_mcp + code
- **Change:** Added `alwaysLoad` MCP server config option to skip tool-search deferral; `/skills` now has type-to-filter search box; PostToolUse hooks can replace tool output via `hookSpecificOutput.updatedToolOutput`; MCP servers auto-retry transient startup errors up to 3 times
- **MindrianOS impact:** **alwaysLoad is the big one for Brain.** Today Brain tools are discovered at the 10% context threshold; `alwaysLoad: true` would surface them from turn 1 - eliminates the "Larry doesn't know about Brain yet" cold-start window. Direct candidate for `.mcp.json` update. PostToolUse `updatedToolOutput` lets hooks rewrite tool output - could enforce Part 8 boundary on Brain query responses (sanitize before they reach the model). MCP auto-retry reduces flake-driven Brain timeouts.

### 2.1.120
- **Domain:** code + plugins_mcp
- **Change:** Git for Windows no longer required (PowerShell fallback); `claude ultrareview [target]` non-interactive subcommand; Skills can reference `${CLAUDE_EFFORT}`; `claude plugin validate` accepts more manifest fields
- **MindrianOS impact:** `${CLAUDE_EFFORT}` in skills lets MindrianOS skills calibrate verbosity (Larry-extended vs quick-larry mode). Plugin validate expansion means `plugin.json` can declare more metadata that the marketplace honors.

### 2.1.119
- **Domain:** code
- **Change:** `/config` settings persist to `~/.claude/settings.json`; added `prUrlTemplate` setting; `CLAUDE_CODE_HIDE_CWD` env variable; `--from-pr` accepts GitLab and Bitbucket PRs; `--print` mode honors agent `tools:` and `disallowedTools:` frontmatter
- **MindrianOS impact:** `--print` mode honoring agent frontmatter means MindrianOS agents (larry-extended, mos-research, etc.) can be invoked non-interactively with their tool restrictions intact - opens scripting/automation paths.

### 2.1.118
- **Domain:** code + plugins_mcp
- **Change:** Vim visual and visual-line modes; merged `/cost` and `/stats` into `/usage`; custom themes via `/theme` or `~/.claude/themes/` JSON files; Hooks can invoke MCP tools via `type: "mcp_tool"`; added `DISABLE_UPDATES` env var
- **MindrianOS impact:** **Hooks → MCP tools is a major shift.** SessionStart, PostToolUse, etc. can now call Brain MCP directly without spawning a child Node process. Could collapse the `lib/core/brain-client.cjs` proxy layer. Custom themes opens De Stijl as a sanctioned theme distribution. `/usage` replacement means token-budget glyph in statusline should track the new command output schema.

### 2.1.117
- **Domain:** desktop_cowork + plugins_mcp
- **Change:** Forked subagents enabled on external builds with `CLAUDE_CODE_FORK_SUBAGENT=1`; Agent frontmatter `mcpServers` now loaded for main-thread sessions via `--agent`; `/resume` offers summarization for stale large sessions; concurrent MCP server connections default for faster startup; plugin dependencies auto-resolved from configured marketplaces
- **MindrianOS impact:** **Forked subagents on external builds** was the unlock for parallel methodology pipelines outside Anthropic infrastructure, at the time this was written. **This is now stale: as of Claude Code 2.1.232, fork mode is on by default in every interactive session, and `CLAUDE_CODE_FORK_SUBAGENT` inverted from an opt-in to an opt-out (`=0` turns it off; `=1` opts in for non-interactive/SDK use only).** See `references/capability-radar/capabilities-index.md`'s Fork Mode Defaults section and `data/capability-ledger.json` for the corrected, current description. Agent-level `mcpServers` declaration means individual agents (e.g. `mos-research`) can require Brain MCP without polluting global config. Plugin deps auto-resolution simplifies MindrianOS Brain MCP coupling.

### 2.1.116
- **Domain:** plugins_mcp
- **Change:** `/resume` on large sessions 67% faster with improved fork handling; faster MCP startup; `resources/templates/list` deferred to first `@`-mention; smoother fullscreen scrolling; `/terminal-setup` configures editor scroll sensitivity; thinking spinner shows inline progress
- **MindrianOS impact:** Faster MCP startup directly improves Brain connection time. The `resources/templates/list` deferral is something to validate against `.mcp.json` - Brain may need to opt into eager template loading if it relies on templates being available at startup.

### 2.1.111
- **Domain:** models + code
- **Change:** Claude Opus 4.7 xhigh available via `/effort`; Auto mode for Max subscribers with Opus 4.7; `/effort` opens interactive slider without arguments; "Auto (match terminal)" theme; added `/less-permission-prompts` skill; added `/ultrareview` for parallel code review
- **MindrianOS impact:** **Opus 4.7 was the current top-tier model at the time this entry was written; it is historical now** (see `capabilities-index.md`'s models section for the current generation). No config key naming a fixed executor model exists anywhere in this repo - the claim that once stood here was wrong; the real surfaces are alias-based (`lib/core/model-profiles.cjs`, `.planning/config.json`). The xhigh effort tier is overkill for most plans but worth knowing for the load-bearing migration phases (108, 109). `/ultrareview` is a built-in pattern that could displace any custom MindrianOS multi-reviewer flows.

### 2.1.110
- **Domain:** code + desktop_cowork
- **Change:** Added `/tui fullscreen` command; added push notification tool for Remote Control; changed `Ctrl+O` to toggle normal/verbose transcript; `/focus` toggles focus view; added `autoScrollEnabled` config; `--resume`/`--continue` resurrects unexpired scheduled tasks
- **MindrianOS impact:** Push notification tool opens async user signaling - Larry could ping the user when Brain finishes an enrichment cycle or when a proactive scan finds a contradiction. `/focus` view aligns with the canon's focus-node concept (Phase 109 D-01) - consider statusline coordination so the `🎯` glyph respects `/focus` state.

## New capabilities NOT in capabilities-index.md (last updated 2026-03-22)

The following are recent additions worth merging into the curated index:

1. **`alwaysLoad` MCP config** (2.1.121) - eliminates Brain MCP cold-start window
2. **Hooks → MCP tools** (2.1.118) - hook scripts can call Brain directly, no Node child process
3. **Forked subagents on external builds** (2.1.117) - parallel methodology pipelines unlocked
4. **Agent frontmatter `mcpServers`** (2.1.117) - per-agent Brain MCP scoping
5. **PostToolUse `updatedToolOutput`** (2.1.121) - Part 8 sanitization layer for Brain responses
6. **`--plugin-dir` accepts `.zip`** (2.1.128) - beta-tester distribution side-channel
7. **`/mcp` 0-tool flagging** (2.1.128) - Brain MCP failure-mode diagnostic
8. **Opus 4.7 + xhigh effort** (2.1.111) - top model at the time + max-effort tier (Opus 4.7 is historical now; see the models section of `capabilities-index.md`)
9. **`/ultrareview` built-in** (2.1.111) - built-in parallel code review pattern
10. **`/effort` slider** (2.1.111) - runtime effort calibration for skills (`${CLAUDE_EFFORT}`)
11. **`/usage` (replaces `/cost` + `/stats`)** (2.1.118) - statusline token-budget glyph should track new schema
12. **Custom themes via JSON** (2.1.118) - De Stijl as sanctioned theme distribution
13. **`claude project purge`** (2.1.126) - clean-slate command for tester recovery
14. **MCP auto-retry on transient errors** (2.1.121) - Brain reliability improvement
15. **Concurrent MCP startup** (2.1.117) - faster session start
