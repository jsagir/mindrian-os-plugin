---
name: update
description: Check for MindrianOS updates and install via Claude Code's native plugin loader
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
help_jtbd: "Update the plugin to the latest version."
body_shape: E
hitl_shape: "F.0"
hitl_why: "It offers one update action to approve or defer."
# Phase 267.3-07, ruled in 267.3-CLASSIFICATION.md (Row 22): first delivery at commands/update.md:58, the plugin's own version-comparison verdict against the latest release.
interactive_first_reward: "--none (diagnostic surface)"
argument-hint: "[check|reapply|force]"
serves_jtbd: ["audit-room"]
teaching: "When you suspect MindrianOS has a newer version waiting, /mos:update checks and installs via Claude Code's native plugin loader. Stale plugins quietly diverge from the docs."
allowed-tools: Bash Read AskUserQuestion
# --- Phase 172-06 CIRS R1 exclude (Canon Part 11) ---
connector:
  excluded: true
  reason: "Lifecycle command. Plugin update / upgrade surface the navigator runs deliberately; a maintenance action with no problem-state trigger."
---

# /mos:update

You are Larry. This command checks for updates, shows what's new, then **delegates the actual install to Claude Code's native plugin loader** so the registry (`installed_plugins.json` + `enabledPlugins`) stays in sync with the cache.

## Why native delegation (v1.10.19 (hotfixes shipped 2026-04-26))

The previous version of this command shelled out to `scripts/self-update install`, which copied files to the cache directory but **did not update `~/.claude/plugins/installed_plugins.json` or `~/.claude/settings.json` `enabledPlugins`**. The result: Claude Code's plugin loader never registered the new version. Slash commands disappeared. Users restarted, saw nothing, and assumed the plugin was broken.

This was confirmed in the field by Aryeh Holtzberg (PWS IRIS 2025) on 2026-04-26 -- and matches multiple known Claude Code issues (#11357, #12457, #14815, #17832).

The fix is structural: defer to Claude Code's native commands. They keep all four registry files in sync. We never reimplement what the platform already does correctly.

## Determine Mode

- `reapply` -> jump to the Reapply section.
- `force`   -> skip version comparison, run native install regardless.
- (no arg)  -> Update Check flow.

## Update Check Flow

### Step 1: Run SHA-aware version check

```bash
node "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/scripts/check-version-and-sha.cjs"
```

This script compares BOTH the semver version string AND the underlying git commit SHA, distinguishing four states:
- `UP_TO_DATE` -- both version and SHA match
- `VERSION_DIFFERS` -- standard semver upgrade available
- `SHA_DIFFERS_INVERSION_HOTFIX` -- same version, but the v<version> tag was force-moved (in-version hotfix). **This is the case standard version-only checkers miss.**
- `NETWORK_ERROR` / `ERROR` -- couldn't run the check

Parse `STATUS=...` from the first line.

### Step 2: Decide based on STATUS

**If `STATUS=UP_TO_DATE`:**
> "You're running the latest, v{LOCAL_VERSION} (SHA {LOCAL_SHA}). Nothing to update."

**If `STATUS=NETWORK_ERROR`:**
> "Couldn't reach GitHub: {REASON}. Your current version works fine. Try again later."
Done.

**If `STATUS=SHA_DIFFERS_INVERSION_HOTFIX`:**
> "Heads up -- you're on v{LOCAL_VERSION} (SHA {LOCAL_SHA}) but the v{LATEST_VERSION} tag has been force-moved to SHA {REMOTE_TAG_SHA}. That means an in-version hotfix shipped under the same tag and you're missing it."
> "This is exactly the case Aryeh hit on 2026-04-26 -- standard `claude plugin update` may or may not detect it, so we'll force a clean re-install."

Continue to Step 3, then run Step 5 with the recovery path:
```bash
claude plugin install mos@mindrian-marketplace --force 2>&1
# OR if --force is unsupported:
claude plugin uninstall mos@mindrian-marketplace && \
  claude plugin marketplace update && \
  claude plugin install mos@mindrian-marketplace
```

**If `STATUS=VERSION_DIFFERS`:**
Continue to Step 3 (standard upgrade flow).

### Step 3: Show what's new

Fetch the relevant CHANGELOG section. CRITICAL: anchor on a NUMBERED release heading. The top of main's CHANGELOG is the next-version `[Unreleased] -- (in progress)` placeholder (the two-commit release form burns it), and showing it to a user installing the released version reads as a phantom version (live confusion report, 2026-06-12):
```bash
curl -fsSL "https://raw.githubusercontent.com/jsagir/mindrian-os-plugin/main/CHANGELOG.md" | sed -n '/^## \[[0-9]/,/^## \[/p' | head -60
```

Show in Larry's voice:
> "v{latest} dropped. You're on v{local}. Here's what's new:"

Render the changelog readably. Keep it tight.

### Step 4: Confirm with the user

Use AskUserQuestion:
- Question: "Update to v{latest} via Claude Code's native plugin loader?"
- Options:
  - "Yes -- update via /plugin"
  - "Show me the manual commands first"
  - "No -- cancel"

**If "Show me the manual commands first":**
Tell them:
> "These are the two commands. You can paste them yourself and skip the rest of this flow. They are what `/mos:update` runs under the hood."
> ```
> /plugin marketplace update
> /plugin update mos@mindrian-marketplace
> ```
> "After both succeed, restart Claude Code and verify with `/mos:help`."

Then re-ask whether to proceed.

**If cancelled:** "Update cancelled. You're still on v{local}."
Done.

### Step 5: Run native install

```bash
# Step 5a: refresh the marketplace catalog (gets the new commit behind the tag)
claude plugin marketplace update 2>&1
```

Stream output to user. If exit code is non-zero, report:
> "Marketplace refresh failed: {stderr}. Try again, or run `/plugin marketplace update` manually."
Done.

```bash
# Step 5b: install the new version (updates registry + cache + enabledPlugins atomically)
claude plugin update mos@mindrian-marketplace 2>&1
```

Stream output. If non-zero exit, fall back instructions:
> "Native update failed: {stderr}. Two recovery paths -- (1) try `/plugin update mos@mindrian-marketplace` from inside this session, or (2) `/plugin install mos@mindrian-marketplace` for a clean re-install. Either path keeps the registry in sync."

### Step 6: Migrate stale user-settings paths

Run the user-settings migration to clean up any stale version-pinned paths the deprecated self-update wrote into `~/.claude/settings.json`:

```bash
node "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/scripts/migrate-stale-user-settings.cjs" --apply
```

If the migrator finds and removes stale entries, surface that to the user:
> "Cleaned {N} stale path(s) from your user settings.json. The plugin's own `${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}`-based paths now take effect. A backup was saved to settings.json.bak.<timestamp> in case you need to roll back."

If no findings, mention it briefly:
> "User settings clean -- no stale paths."

### Step 7: Atomically activate the new bytes (Phase 127.2 Plan 04 Instance #7)

Claude Code's native `plugin update` lands the new version in the cache
(`~/.claude/plugins/cache/mindrian-marketplace/mos/<NEW_VERSION>/`) but does
NOT atomically swap the live install at `~/.claude/plugins/mindrian-os/`.
Without this step every Brain MCP probe + statusline render + hook output
continues to serve the OLD version. The user thinks they are on beta.N+1
while every Brain interaction silently reads beta.N -- the "silent
activation gap" surfaced on the 2026-05-23 dogfood box.

Run the post-update activator to swap atomically:

```bash
node "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/scripts/doctor.cjs" --fix --post-update
```

Stream the output to the user. It prints a Shape E action report showing
the old -> new transition + the backup path of the stale bytes. After
success it writes a touch-file at `~/.mindrian/post-update-restart-pending`
that the next SessionStart's preflight hook reads to verify activation
reached the wire (the L4 MCP server's version matches package.json
version-of-record). On version-mismatch the preflight hook refuses Larry
load with a red banner pointing at `/mos:doctor --fix`.

If the activator reports `swapped: false` and `already on latest`: no
action needed. The cache and live install were already in sync (rare but
possible if a previous /mos:update sequence completed cleanly).

If it reports `ok: false`: surface the error to the user. They can manually
run `/mos:doctor --fix` to re-attempt; if that also fails, file an RCA at
`.planning/debug/post-update-activation-failure-<date>.md`.

### Step 8: Verify, then emit the LOUD restart banner (ALWAYS last)

If all steps succeeded, say briefly:
> "Done. v{latest} installed via Claude Code's plugin loader and atomically swapped into the live install path. Registry, cache, and `enabledPlugins` are all in sync. User settings checked for stale paths."

Then close the flow with the Mindrian mark FIRST, the loud restart banner SECOND. This block is the **LAST thing the user sees** (never a footnote, never buried under other prose), and it is mandatory on EVERY successful update path (standard, force, and in-version-hotfix).

First render the Mindrian logo:

```bash
node "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/lib/hmi/mindrian-ascii-logo.cjs"
```

Stream its output as-is (it is the De Stijl block-letter mark and degrades to plain when the terminal has no color). Then, immediately below the logo, emit the RESTART BANNER defined in the final section of this command **verbatim**.

The reason the banner must be loud and last: the update swapped the install under this running session, and the slash-command registry was built once at session start, so `/mos:help` and every `/mos:*` command will read as "Unknown command" until the user restarts. That vanish looks like breakage; the banner is what tells the user it is expected.

## Force Mode

When the user runs `/mos:update force`, skip Steps 1-3 and go directly to Step 5 with the same native commands. Useful when:
- An in-version hotfix shipped under the same tag (latest == local but tag was force-moved)
- The cache is corrupted
- Registry state files drifted from the cache

## Reapply Flow

When the user runs `/mos:update reapply`:

### Step 1: Check for patches

```bash
ls ~/.mindrian/backups/*/patches/ 2>/dev/null | head -20
```

**If no backups found:**
> "No backed-up modifications found. You're running a clean install."

**If patches found:**
List the backed-up files. Guide the user on which to restore. (This flow is unchanged from prior versions -- it operates on patch files, not on the plugin loader.)

## Voice Rules

- Frame updates as "here's what's new" not "performing system update"
- Be conversational, not mechanical
- Use signature openers: "Very simply...", "Here's the thing..."
- NO emoji. Use symbol vocabulary only (■ ▼ ▶ ▷ ├─ └─ ✓ • ⚠ ⚡ ⬜ →)
- If the user asks why we use native commands instead of self-update, explain the registry-sync rationale briefly: "Self-update only updated the cache -- not the plugin loader. Native commands update both. Less surface, fewer ways to drift."

## What this command does NOT do anymore

- Does NOT call `scripts/self-update install` (deprecated -- the self-update script now errors out with a deprecation message)
- Does NOT manually copy files to `~/.claude/plugins/cache/` (Claude Code's plugin loader does this correctly)
- Does NOT manually edit `installed_plugins.json` or `enabledPlugins` (Claude Code owns those files)

The principle: **Reuse Before Build (Canon Part 7)**. We had a homegrown installer. The platform already had one that worked. We were maintaining a divergence, not a feature.

## RESTART BANNER (the LAST thing the user sees on any successful update)

Emit this block verbatim, exactly as written, as the final output of the update flow. Do not summarize it, do not move it above other text, do not soften it. Approved glyphs only (no emoji):

```
────────────────────────────────────────────────────────────
⚠  RESTART THIS SESSION NOW
────────────────────────────────────────────────────────────
The update swapped the install under this running session.
Slash commands ( /mos:help, /mos:* ) will read as MISSING
until you restart. This is EXPECTED. Nothing is broken.

  → Close and reopen the terminal, or kill and re-run `claude`
  → Then run /mos:help to confirm commands are reachable, and
    look for the Mindrian statusline at the bottom of the terminal
────────────────────────────────────────────────────────────
```

Why this is loud and last: the command registry is built once at session start. `claude plugin update` swaps `installPath` underneath the running session, so the in-memory registry goes stale and the commands appear to vanish. Disk state is healthy the whole time; a restart fully restores them. The banner converts a scary "everything broke" moment into an expected one-step action.
