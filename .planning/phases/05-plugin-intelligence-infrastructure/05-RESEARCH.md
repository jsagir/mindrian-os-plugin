# Phase 5: Plugin Intelligence Infrastructure - Research

**Researched:** 2026-03-22
**Domain:** Claude Code plugin self-management, context awareness, capability tracking
**Confidence:** MEDIUM (mixed -- some features have clear implementation paths, others hit platform limitations)

## Summary

Phase 5 covers three distinct capabilities: self-update, context window awareness, and capability radar. Research reveals a clear spectrum from **highly practical** to **necessarily aspirational**.

**Self-update (UPDT-01, UPDT-02)** is the most straightforward. Claude Code's plugin marketplace system already handles auto-updates via git-based version tracking. The GSD update workflow provides an excellent reference pattern for user-facing update commands with changelog display, backup, and reapply. The key insight: MindrianOS does NOT need to build npm-based update infrastructure -- the marketplace git mechanism IS the update system. The `/mindrian-os:update` command becomes a thin wrapper around checking marketplace version, displaying changelog, and triggering reinstall with user modification backup.

**Context window awareness (CTXW-01, CTXW-02)** has a split story. The statusline API exposes `context_window.used_percentage`, `context_window.context_window_size`, and `model.id` -- giving us rich data. However, this data is only available to statusline scripts, NOT to hooks or skills directly. The feature request (GitHub issue #34340) to expose `CLAUDE_CONTEXT_USED`, `CLAUDE_CONTEXT_MAX`, `CLAUDE_CONTEXT_PERCENT` as hook environment variables remains OPEN and unimplemented as of March 2026. The practical approach: use a statusline script to write context state to a temp file, then have skills/hooks read that file. Model detection is achievable through the statusline's `model.id` field.

**Capability radar (RADR-01, RADR-02)** is the most aspirational. Anthropic does NOT provide official RSS feeds. Community-scraped feeds exist on GitHub but are unreliable. The Claude Code changelog lives at `github.com/anthropics/claude-code/blob/main/CHANGELOG.md` and GitHub releases are available. The practical approach: a reference file (`references/capability-radar/`) with curated entries that Larry can reference, plus a command that fetches the GitHub changelog and summarizes recent changes. Daily automated digests are NOT practical without persistent background processes.

**Primary recommendation:** Build self-update as the hero feature (high impact, achievable). Build context awareness with a statusline-bridge pattern (creative but reliable). Build capability radar as a curated reference + manual fetch command (honest about limitations, still useful).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UPDT-01 | `/mindrian-os:update` checks for and installs plugin updates with changelog display | Marketplace git versioning + GSD update workflow pattern. Plugin version in plugin.json, changelog in CHANGELOG.md, marketplace handles distribution. Command pattern is well-established. |
| UPDT-02 | Update backs up user modifications and offers reapply after clean install | GSD's `gsd-local-patches/backup-meta.json` pattern directly applicable. Detect modified files via checksum comparison, backup to `mindrian-patches/`, reapply after clean install. |
| CTXW-01 | Plugin monitors context window and adapts loading strategy | Statusline API provides `context_window.used_percentage` and `context_window.context_window_size`. Bridge pattern: statusline writes to temp file, skills read it. Adaptive loading via skill that checks usage before loading heavy references. |
| CTXW-02 | Plugin warns user approaching context limits and suggests /clear | Same statusline bridge. Threshold warnings at 70%/85%/95%. Suggest `/clear` or reference unloading. Model-aware thresholds (Sonnet 200K hits limits faster). |
| RADR-01 | Plugin tracks Anthropic releases and surfaces relevant capabilities | GitHub CHANGELOG.md is the reliable source. Command fetches + summarizes. Curated reference file for known capabilities. No official RSS exists. |
| RADR-02 | Capability updates tagged by domain with daily digest | Domain tagging achievable in curated reference. "Daily digest" reframed as "on-demand digest" since plugins lack persistent background processes. SessionStart can surface recent capability updates from reference. |
</phase_requirements>

## Standard Stack

### Core (No New Dependencies)

This phase requires ZERO new libraries. Everything is built with existing plugin infrastructure.

| Component | Implementation | Purpose | Why No Library |
|-----------|---------------|---------|----------------|
| Update command | Bash script + markdown command | Version check, changelog, backup | Marketplace handles install; we just orchestrate |
| Context bridge | Bash statusline script + temp file | Expose context data to skills | Claude Code statusline API provides the data |
| Capability reference | Markdown files in references/ | Curated capability index | Static content, Larry interprets |
| Changelog fetcher | curl + bash script | Fetch GitHub CHANGELOG.md | Single HTTP request, no parsing library needed |

### Existing Infrastructure Used

| Component | Already Exists | Phase 5 Usage |
|-----------|---------------|---------------|
| `plugin.json` | Version field ("0.1.0") | Source of truth for installed version |
| `hooks/hooks.json` | SessionStart, Stop, PostToolUse | SessionStart: inject context awareness + capability alerts |
| `scripts/session-start` | Room context loading | Extend with context budget + capability radar injection |
| `skills/context-engine/` | User memory, session continuity | Extend with context window awareness behavior |
| `references/` | Methodology refs, brain schema | Add `capability-radar/` subdirectory |
| `settings.json` | Agent config | Add statusline config for context monitoring |

## Architecture Patterns

### Recommended Additions to Plugin Structure

```
MindrianOS-Plugin/
├── commands/
│   ├── update.md                   # /mindrian-os:update
│   └── capability-radar.md         # /mindrian-os:capability-radar
├── scripts/
│   ├── check-update                # Version comparison + changelog fetch
│   ├── backup-modifications        # Detect + backup user changes
│   ├── reapply-modifications       # Reapply backed-up changes
│   └── context-monitor             # Statusline script (writes bridge file)
├── skills/
│   └── context-engine/SKILL.md     # Extended with context awareness
├── references/
│   └── capability-radar/
│       ├── capabilities-index.md   # Curated capability entries
│       └── changelog-cache.md      # Last fetched changelog summary
└── settings.json                   # Extended with statusline config
```

### Pattern 1: Marketplace-Native Update

**What:** Use Claude Code's marketplace versioning as the source of truth. The update command checks if the marketplace has a newer version, shows changelog, and triggers reinstall.

**When to use:** Always -- this is how Claude Code plugins are meant to update.

**How it works:**
1. Read current version from `plugin.json` ("0.1.0")
2. Script fetches CHANGELOG.md from the GitHub repo (raw URL)
3. Compare versions, extract entries between current and latest
4. Display changelog, get user confirmation
5. Plugin reinstall happens via marketplace mechanism
6. Detect user modifications via file checksums (pre-computed at install time)
7. Backup modified files to workspace `mindrian-patches/`
8. After update, offer to reapply patches

**Key difference from GSD:** GSD uses npm. MindrianOS uses the plugin marketplace. The UX is similar but the update mechanism differs.

### Pattern 2: Statusline-to-Skill Bridge

**What:** A statusline script writes context state to a well-known temp file. Skills and session-start read this file to get model and context data.

**When to use:** Whenever skills need context window data (which hooks cannot access directly).

**How it works:**
1. `scripts/context-monitor` is configured as the statusline command
2. On each assistant message, it receives JSON with `model.id`, `context_window.used_percentage`, `context_window.context_window_size`
3. It writes a simple key-value file to `/tmp/mindrian-context-state`
4. `scripts/session-start` reads this file to inject context awareness
5. `context-engine` skill references this data for adaptive behavior

**Important limitation:** The statusline runs AFTER assistant messages, not before. Context data is always "last known state" not "current state." This is acceptable for adaptive loading since decisions are made at session start and periodically, not per-message.

```bash
# scripts/context-monitor (statusline script)
#!/bin/bash
input=$(cat)
MODEL_ID=$(echo "$input" | jq -r '.model.id')
MODEL_NAME=$(echo "$input" | jq -r '.model.display_name')
CTX_PCT=$(echo "$input" | jq -r '.context_window.used_percentage // 0')
CTX_SIZE=$(echo "$input" | jq -r '.context_window.context_window_size // 200000')
CTX_REMAINING=$(echo "$input" | jq -r '.context_window.remaining_percentage // 100')

# Write bridge file for skills/hooks to read
BRIDGE="/tmp/mindrian-context-state"
cat > "$BRIDGE" <<EOF
MODEL_ID=$MODEL_ID
MODEL_NAME=$MODEL_NAME
CTX_PCT=$CTX_PCT
CTX_SIZE=$CTX_SIZE
CTX_REMAINING=$CTX_REMAINING
TIMESTAMP=$(date +%s)
EOF

# Also display in statusline
# Color-code by usage
if [ "${CTX_PCT%.*}" -ge 85 ]; then
  COLOR='\033[31m'  # Red
elif [ "${CTX_PCT%.*}" -ge 70 ]; then
  COLOR='\033[33m'  # Yellow
else
  COLOR='\033[32m'  # Green
fi
RESET='\033[0m'

echo -e "[MindrianOS] ${COLOR}${CTX_PCT%.*}% ctx${RESET} | $MODEL_NAME"
```

### Pattern 3: Curated Capability Index

**What:** A markdown reference file with structured capability entries that Larry can reference, plus a command that fetches fresh changelog data.

**When to use:** For capability radar -- honest about the impossibility of automated real-time tracking.

**Structure of `references/capability-radar/capabilities-index.md`:**
```markdown
# Claude Capability Index for MindrianOS

Last updated: 2026-03-22

## Capabilities by Domain

### models
- **Opus 4.6 (1M context)**: Extended thinking, adaptive reasoning, 128K max output
- **Sonnet 4.6**: Balanced speed/intelligence, 200K default / 1M extended context
- **Haiku 4.5**: Fast background tasks

### plugins_mcp
- **Plugin marketplace**: Git-based distribution, auto-updates
- **MCP tool search**: Auto-discovers tools at 10% context threshold
- **Agent teams**: Experimental multi-agent coordination

### code
- **Statusline API**: Real-time context window, model, cost data
- **Hooks**: SessionStart, Stop, PostToolUse, SessionEnd
- **Background tasks**: run_in_background parameter

### desktop_cowork
- **Cowork**: Multi-user persistent agents, 00_Context/ shared state
- **Desktop**: Conversational interface, MCP server support

### visualization
- **Mermaid rendering**: Built-in diagram support
- **SVG generation**: Direct SVG output capability
```

### Anti-Patterns to Avoid

- **Building a full RSS aggregator inside a plugin:** Plugins have no persistent background processes. No cron, no daemon. Anything automated must run within hook time budgets (2-3 seconds).
- **Assuming hook env vars expose context data:** They do NOT (as of March 2026). Issue #34340 is still open. Do not build code that reads `CLAUDE_CONTEXT_USED` from hooks -- it does not exist.
- **Bypassing the marketplace update system:** Do NOT build npm/curl-based self-install. The marketplace is the distribution mechanism. Work with it, not around it.
- **Blocking SessionStart with heavy network calls:** The session-start hook must complete in under 2 seconds. Changelog fetching or version checking should NOT happen in SessionStart. Use the explicit `/mindrian-os:update` command instead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Plugin distribution | Custom npm/curl installer | Marketplace git mechanism | Marketplace handles cloning, caching, version tracking |
| Version comparison | Semver parsing in bash | Simple string comparison or `sort -V` | Edge cases in semver are numerous |
| Context window tracking | Token counting approximation | Statusline bridge to `/tmp/mindrian-context-state` | Statusline API gives exact data; approximation is fragile |
| RSS aggregation | HTTP polling + XML parsing | Curated markdown reference + on-demand GitHub fetch | No persistent processes; RSS feeds don't exist officially |
| File modification detection | Git diff on plugin directory | Checksum file generated at install time | Plugin is in cache dir; git status not reliable there |

## Common Pitfalls

### Pitfall 1: Statusline Not Available on All Surfaces
**What goes wrong:** The statusline is a CLI-only feature. Desktop and Cowork surfaces may not run statusline scripts.
**Why it happens:** Statusline is a terminal UI component.
**How to avoid:** Context bridge file should have a graceful fallback. If `/tmp/mindrian-context-state` is stale (>5 min) or missing, assume conservative defaults (200K window, 50% usage). Skills should work without context data -- it enhances, never gates.
**Warning signs:** Skills that crash or behave incorrectly when context bridge file is missing.

### Pitfall 2: Update Command Can't Actually Reinstall
**What goes wrong:** A plugin command cannot reinstall itself. The `update` command can detect and display what's new, but the actual reinstall requires user action outside the plugin.
**Why it happens:** Plugin commands run within the plugin context. Self-modifying that context is undefined behavior.
**How to avoid:** The update command should: (1) detect version difference, (2) show changelog, (3) backup modifications, (4) tell the user to run the reinstall command: `claude plugin update mindrian-os@mindrian-marketplace`. The command orchestrates, but the user executes the final step.
**Warning signs:** Attempting `claude plugin install` from within a plugin command.

### Pitfall 3: Context Percentage Is Stale
**What goes wrong:** The bridge file reflects the state after the LAST assistant message, not the current one. Skills reading it get slightly stale data.
**Why it happens:** Statusline updates after assistant messages, debounced at 300ms.
**How to avoid:** Treat context data as "last known state." Use conservative thresholds (warn at 70% not 90%). Never make critical decisions based on exact percentages.
**Warning signs:** Code that assumes context data is real-time.

### Pitfall 4: Capability Radar Becomes Maintenance Burden
**What goes wrong:** A curated capabilities reference goes stale within weeks. Nobody updates it.
**Why it happens:** Manual curation requires ongoing effort.
**How to avoid:** Keep the reference minimal and structural. Domain tags matter more than exhaustive entries. The `/mindrian-os:capability-radar` command fetches fresh CHANGELOG.md from GitHub -- the reference is a supplement, not the primary source.
**Warning signs:** Reference file with entries older than 3 months.

### Pitfall 5: Aggressive Compression Breaks Methodology Quality
**What goes wrong:** Context-aware compression strips methodology references too aggressively on Sonnet, degrading teaching quality.
**Why it happens:** Compression logic is too mechanical -- strips by token count without understanding pedagogical importance.
**How to avoid:** Compression tiers should be semantic, not mechanical. Tier 1 (always loaded): thin skills, routing index. Tier 2 (load on demand): methodology references. Tier 3 (compress/defer): examples, extended patterns. Never compress the routing index or Larry's personality.
**Warning signs:** Larry giving generic responses without framework depth on Sonnet.

## Code Examples

### Update Command Structure
```markdown
# commands/update.md
---
name: update
description: Check for MindrianOS plugin updates, display changelog, backup modifications
---

## Check for Updates

1. Run the update check script:
   `bash "${CLAUDE_PLUGIN_ROOT}/scripts/check-update"`

2. Parse the output:
   - If `UP_TO_DATE`: tell user they're current
   - If `UPDATE_AVAILABLE`: display the changelog section
   - If `CHECK_FAILED`: suggest manual check

3. If update available, show changelog and offer to backup modifications:
   `bash "${CLAUDE_PLUGIN_ROOT}/scripts/backup-modifications"`

4. Instruct user to run:
   `claude plugin update mindrian-os@mindrian-marketplace`

5. After update, suggest checking for backed-up modifications:
   "Run /mindrian-os:update reapply to restore your custom changes"
```

### Check Update Script Pattern
```bash
# scripts/check-update
#!/bin/bash
# Reads current version from plugin.json
# Fetches latest version from GitHub marketplace/releases
# Compares and outputs changelog diff

PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CURRENT_VERSION=$(jq -r '.version' "$PLUGIN_ROOT/.claude-plugin/plugin.json")

# Fetch latest CHANGELOG.md from GitHub
CHANGELOG_URL="https://raw.githubusercontent.com/mindrian/mindrian-os-plugin/main/CHANGELOG.md"
CHANGELOG=$(curl -sf "$CHANGELOG_URL" 2>/dev/null)

if [ $? -ne 0 ]; then
  echo "CHECK_FAILED"
  echo "Could not reach update server. Check your connection."
  exit 0
fi

# Extract latest version from changelog (first ## [X.Y.Z] entry)
LATEST_VERSION=$(echo "$CHANGELOG" | grep -oP '## \[\K[0-9]+\.[0-9]+\.[0-9]+' | head -1)

if [ "$CURRENT_VERSION" = "$LATEST_VERSION" ]; then
  echo "UP_TO_DATE"
  echo "v${CURRENT_VERSION}"
else
  echo "UPDATE_AVAILABLE"
  echo "CURRENT=${CURRENT_VERSION}"
  echo "LATEST=${LATEST_VERSION}"
  echo "---CHANGELOG---"
  # Extract entries between current and latest
  echo "$CHANGELOG" | sed -n "/## \[${LATEST_VERSION}\]/,/## \[${CURRENT_VERSION}\]/p" | head -n -1
fi
```

### Model-Aware Context Strategy
```markdown
# In context-engine SKILL.md (extended section)

## Context Window Awareness

Read `/tmp/mindrian-context-state` if it exists (written by statusline bridge).
If the file is missing or older than 5 minutes, use conservative defaults.

### Model-Specific Behavior

| Model | Context Size | Strategy |
|-------|-------------|----------|
| Opus (1M) | 1,000,000 | Rich context: load full references inline when relevant |
| Sonnet (200K) | 200,000 | Lean context: thin skills only, load references on-demand |
| Unknown | 200,000 | Conservative: treat as Sonnet |

### Context Threshold Actions

| Usage | Action |
|-------|--------|
| < 50% | Normal operation. Load references freely. |
| 50-70% | Mention context usage if user asks for heavy operations. |
| 70-85% | Warn user: "We're using 75% of context. Consider /clear before starting a new methodology." |
| 85-95% | Active warning: "Context is getting tight. I'll be more concise. Consider /clear to free space." |
| > 95% | Auto-compact will trigger. Warn: "Claude will auto-compact soon -- your room context will reload." |

### Adaptive Reference Loading

When context > 60% on Sonnet (or > 80% on Opus):
- Do NOT load full methodology references inline
- Use `disable-model-invocation: true` pattern for methodology commands
- Summarize Room findings instead of quoting full entries
- Skip proactive intelligence in SessionStart (save tokens)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No plugin update mechanism | Marketplace git versioning + auto-update | Claude Code 1.0.50+ (late 2025) | Plugins can version and distribute updates |
| No context visibility | Statusline API with full context_window JSON | Claude Code 1.0.60+ (early 2026) | Scripts can read model, context %, token counts |
| 200K fixed context | 1M extended context for Opus 4.6 | Early 2026 | Plugins must be model-aware for optimal behavior |
| Hooks get no context data | Still no context data in hooks (issue #34340 open) | N/A -- unresolved | Bridge pattern required for hook/skill awareness |
| No official Anthropic RSS | Still no official RSS | N/A | Community feeds unreliable; GitHub changelog is best source |

**Key platform limitation:** `CLAUDE_CONTEXT_USED`, `CLAUDE_CONTEXT_MAX`, `CLAUDE_CONTEXT_PERCENT` environment variables do NOT exist in hooks. This is an open feature request. The statusline bridge pattern is the workaround.

## Open Questions

1. **Can a plugin command trigger plugin reinstall?**
   - What we know: `/plugin update` and `/plugin install` are Claude Code built-in commands. A plugin's own command cannot invoke these directly.
   - What's unclear: Whether a command's markdown can instruct Claude to run a built-in command, or if the user must manually type it.
   - Recommendation: Design the update command to prepare everything (changelog, backup) and then display clear instructions for the user to execute the final step. This is honest and reliable.

2. **Does FORCE_AUTOUPDATE_PLUGINS auto-update the plugin?**
   - What we know: `FORCE_AUTOUPDATE_PLUGINS=true` forces plugin auto-updates even when main auto-updater is disabled.
   - What's unclear: Whether this runs silently on startup or prompts the user. Whether it preserves user modifications.
   - Recommendation: Do not rely on auto-update for the user experience. The explicit `/mindrian-os:update` command gives users control and visibility. Auto-update is a nice-to-have supplement.

3. **Can statusline scripts write to arbitrary locations?**
   - What we know: Statusline scripts are bash scripts that run in the user's shell context. They should have normal filesystem permissions.
   - What's unclear: Whether there are sandboxing restrictions we haven't found.
   - Recommendation: Write to `/tmp/mindrian-context-state` (standard temp location). Include error handling for write failures.

4. **How does the plugin detect its own installation path at runtime?**
   - What we know: `${CLAUDE_PLUGIN_ROOT}` is available in hooks and MCP configs. The `CLAUDE_PLUGIN_ROOT` env var points to the cached plugin installation directory.
   - What's unclear: Whether this is available inside statusline scripts or only in hooks.
   - Recommendation: Use `CLAUDE_PLUGIN_ROOT` in hooks, use `$(dirname "$0")/..` in scripts for self-referencing.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Bash script tests (manual verification + automated script checks) |
| Config file | None -- plugin is markdown + bash, no test runner |
| Quick run command | `bash scripts/check-update 2>&1 | head -5` |
| Full suite command | Manual verification per requirement |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UPDT-01 | Update command shows version + changelog | smoke | `bash scripts/check-update` | Wave 0 |
| UPDT-02 | Backup detects modified files | smoke | `bash scripts/backup-modifications /tmp/test-plugin` | Wave 0 |
| CTXW-01 | Statusline bridge writes context state | unit | `echo '{"model":{"id":"opus"},"context_window":{"used_percentage":45,"context_window_size":1000000}}' \| bash scripts/context-monitor && cat /tmp/mindrian-context-state` | Wave 0 |
| CTXW-02 | Context threshold warnings in skill | manual-only | Verify skill text includes threshold table and actions | N/A |
| RADR-01 | Capability radar fetches changelog | smoke | `curl -sf https://raw.githubusercontent.com/mindrian/mindrian-os-plugin/main/CHANGELOG.md \| head -20` | Wave 0 |
| RADR-02 | Domain-tagged capability entries | manual-only | Verify references/capability-radar/capabilities-index.md has domain sections | N/A |

### Sampling Rate
- **Per task commit:** Run smoke tests for scripts
- **Per wave merge:** Verify all scripts execute without errors
- **Phase gate:** All commands registered in help, all scripts executable, statusline bridge functional

### Wave 0 Gaps
- [ ] `scripts/check-update` -- version comparison and changelog fetch
- [ ] `scripts/backup-modifications` -- file checksum comparison
- [ ] `scripts/context-monitor` -- statusline bridge script
- [ ] `references/capability-radar/capabilities-index.md` -- curated reference
- [ ] `tests/fixtures/sample-changelog.md` -- test fixture for changelog parsing

## Practical vs Aspirational Assessment

| Feature | Practical? | Notes |
|---------|-----------|-------|
| Version detection from plugin.json | YES | Trivial `jq -r '.version'` |
| Changelog display from GitHub | YES | `curl` to raw GitHub URL |
| User modification backup | YES | File checksum comparison |
| Automatic reinstall from command | NO | Plugin cannot reinstall itself; user must run `/plugin update` |
| Patch reapply after update | PARTIAL | Can backup and offer, but reapply is manual guidance |
| Context % from statusline | YES | Statusline API provides exact data |
| Model detection | YES | `model.id` in statusline JSON |
| Context data in hooks | NO | Not exposed (issue #34340 open) |
| Statusline-to-file bridge | YES | Standard bash file I/O |
| Adaptive loading by model | YES | Skill instructions + bridge data |
| Real-time RSS from Anthropic | NO | No official feeds exist |
| GitHub changelog fetch | YES | Public URL, `curl` |
| Domain-tagged capability index | YES | Curated markdown reference |
| Daily automated digest | NO | No persistent background processes in plugins |
| On-demand capability check | YES | Command triggers fetch + summarize |

## Sources

### Primary (HIGH confidence)
- [Claude Code Environment Variables](https://code.claude.com/docs/en/env-vars) -- Full env var reference including `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`, `CLAUDE_CODE_AUTO_COMPACT_WINDOW`, `ANTHROPIC_MODEL`, `FORCE_AUTOUPDATE_PLUGINS`
- [Claude Code Statusline Docs](https://code.claude.com/docs/en/statusline) -- Complete statusline JSON schema with `context_window`, `model`, all available fields
- [Claude Code Plugin Marketplaces](https://code.claude.com/docs/en/plugin-marketplaces) -- Plugin distribution, version tracking, auto-update, `CLAUDE_CODE_PLUGIN_SEED_DIR`
- [GSD Update Workflow](~/.claude/get-shit-done/workflows/update.md) -- Proven update pattern with version detection, changelog, backup, reapply

### Secondary (MEDIUM confidence)
- [GitHub Issue #34340](https://github.com/anthropics/claude-code/issues/34340) -- Feature request for context window usage in hooks (OPEN, not implemented)
- [Claude Code GitHub CHANGELOG.md](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md) -- Official changelog, fetchable via raw URL
- [Anthropic Releases on Releasebot](https://releasebot.io/updates/anthropic/claude-code) -- Third-party release tracking

### Tertiary (LOW confidence -- needs validation)
- [Community Anthropic RSS Feed](https://github.com/taobojlen/anthropic-rss-feed) -- Scraped feed, reliability unknown
- [Anthropic Engineering RSS](https://github.com/conoro/anthropic-engineering-rss-feed) -- Scraped feed, uses Playwright

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing infrastructure
- Self-update architecture: MEDIUM -- marketplace mechanism clear, but command-triggered reinstall has open questions
- Context awareness: MEDIUM -- statusline bridge is creative but unverified in production; bridge pattern is sound engineering
- Capability radar: LOW-MEDIUM -- practical approach identified, but aspirational features (daily digest) honestly not achievable
- Pitfalls: HIGH -- well-documented platform limitations with clear workarounds

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (30 days -- stable domain, but issue #34340 could ship any time)
