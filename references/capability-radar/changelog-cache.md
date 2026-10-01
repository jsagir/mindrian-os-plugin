# Changelog Cache

This file is a rendered human-readable VIEW. `data/capability-ledger.json` is the source of record;
`/mos:radar --fetch` writes the ledger first (Step 3b of `commands/radar.md`), then regenerates
this view from it.

Last fetched: 2026-10-01
Source: https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md

**Provenance gap (honest record).** The 2026-10-01 fetch carried no changelog entries for Claude
Code 2.1.247 through 2.1.280, so those versions were NOT screened. The ledger covers 2.1.128
through 2.1.246 from the earlier Phase 265 pass and 2.1.281 through 2.1.287 from this fetch; the
range in between is an open gap, recorded in `ledger_covers.coverage_gap`. The earlier stale
entries (2.1.110 through 2.1.128) from the May 2026 cache are superseded by the ledger and are
no longer repeated here. All rows below are status `dormant` (untriaged) and were taken from a
fields-only summary, not verified against repo files.

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

### 2.1.283 and 2.1.286 (no ledger row)
- **Domain:** plugins_mcp
- **Change:** 2.1.283 added MCP tool and WebFetch outputs to OpenTelemetry spans plus MCP startup and sign-in fixes; 2.1.286 added list mouse support, marketplace error and listing improvements, and headless MCP startup.
- **MindrianOS impact:** Screened out: no repo surface plausibly touched.
