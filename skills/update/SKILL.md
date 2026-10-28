---
name: update
description: Check for MindrianOS updates and install via Claude Code's native plugin loader
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
help_jtbd: "Update the plugin to the latest version."
body_shape: E
layer: "harness"
layer_why: "Checks for and installs a newer plugin version via the native plugin loader; an install-cache/tooling maintenance operation over the harness."
hitl_shape: "F.0"
hitl_why: "It offers one update action to approve or defer."
# Phase 267.3-07, ruled in 267.3-CLASSIFICATION.md (Row 22): first delivery at commands/update.md:58, the plugin's own version-comparison verdict against the latest release.
interactive_first_reward: "--none (diagnostic surface)"
argument-hint: "[check|force]"
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

Four steps, nothing more: Check, Confirm, Loader, Verify. Fetching and swapping the new bytes have no owner in this plugin any more. The Claude Code loader owns both, end to end.

## Why native delegation (v1.10.19 (hotfixes shipped 2026-04-26))

The previous version of this command shelled out to `scripts/self-update install`, which copied files to the cache directory but **did not update `~/.claude/plugins/installed_plugins.json` or `~/.claude/settings.json` `enabledPlugins`**. The result: Claude Code's plugin loader never registered the new version. Slash commands disappeared. Users restarted, saw nothing, and assumed the plugin was broken.

This was confirmed in the field by Aryeh Holtzberg (PWS IRIS 2025) on 2026-04-26 -- and matches multiple known Claude Code issues (#11357, #12457, #14815, #17832).

The fix is structural: defer to Claude Code's native commands. They keep all four registry files in sync. We never reimplement what the platform already does correctly.

## Determine Mode

- `force`   -> skip the UP_TO_DATE stop in Step 1 and run Steps 3 and 4 regardless. It exists for a corrupted cache or registry state that drifted from the cache. It adds no code path of its own: it is the same loader call.
- (no arg)  -> Update Check flow.

The old patch-restore mode is gone (see the last section). `check` is the same as no argument.

## Update Check Flow

### Step 1: Check

```bash
node "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/scripts/check-version-and-sha.cjs"
```

This script compares the installed version with the version pinned in the marketplace catalog. A published npm version is immutable, so a version comparison is the whole check. Three states:
- `UP_TO_DATE` -- the installed version matches the catalog pin
- `VERSION_DIFFERS` -- a newer version is available
- `NETWORK_ERROR` / `ERROR` -- couldn't run the check

Parse `STATUS=...` from the first line.

**If `STATUS=UP_TO_DATE`:**
> "You're running the latest, v{LOCAL_VERSION}. Nothing to update."

Say that in one line and STOP. No confirmation, no loader call, and no restart banner: nothing was swapped, so nothing needs a restart.

**If `STATUS=NETWORK_ERROR` or `STATUS=ERROR`:**
> "Couldn't reach the marketplace catalog: {REASON}. Your current version works fine. Try again later."

Done.

**If `STATUS=VERSION_DIFFERS`:** continue to Step 2.

### Step 2: Confirm

First show what's new. Fetch the relevant CHANGELOG section. CRITICAL: anchor on a NUMBERED release heading. The top of main's CHANGELOG is the next-version `[Unreleased] -- (in progress)` placeholder (the two-commit release form burns it), and showing it to a user installing the released version reads as a phantom version (live confusion report, 2026-06-12):
```bash
curl -fsSL "https://raw.githubusercontent.com/jsagir/mindrian-os-plugin/main/CHANGELOG.md" | sed -n '/^## \[[0-9]/,/^## \[/p' | head -60
```

Show in Larry's voice:
> "v{latest} dropped. You're on v{local}. Here's what's new:"

Render the changelog readably. Keep it tight. Then ask.

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
> claude plugin update mos@mindrian-marketplace
> ```
> "After both succeed, restart Claude Code and verify with `/mos:help`."

Then re-ask whether to proceed.

**If cancelled:** "Update cancelled. You're still on v{local}."
Done.

### Step 3: Loader

```bash
# Step 3a: refresh the marketplace catalog (gets the new pin)
claude plugin marketplace update 2>&1
```

Stream output to user. If exit code is non-zero, report:
> "Marketplace refresh failed: {stderr}. Try again, or run `/plugin marketplace update` manually."
Done.

```bash
# Step 3b: install the new version (updates registry + cache + enabledPlugins atomically)
claude plugin update mos@mindrian-marketplace 2>&1
```

Stream output. If non-zero exit, fall back instructions:
> "Native update failed: {stderr}. Two recovery paths -- (1) try `/plugin update mos@mindrian-marketplace` from inside this session, or (2) `/plugin install mos@mindrian-marketplace` for a clean re-install. Either path keeps the registry in sync."

What the loader owns, so nobody adds a staging step back: it installs the package into a shared `~/.claude/plugins/npm-cache`, copies the package into a versioned cache directory, and runs `npm ci --ignore-scripts` there with a 60 second cap. This command does none of that.

### Step 4: Verify

Re-run the version check from Step 1 and report the new version.

If Step 3 ran and the version moved, a real swap happened. Say briefly:
> "Done. v{latest} installed via Claude Code's plugin loader. Registry, cache, and `enabledPlugins` are all in sync."

Then close the flow with the Mindrian mark FIRST, the loud restart banner SECOND. This block is the **LAST thing the user sees** (never a footnote, never buried under other prose), and it fires ONLY on a real swap (standard or force). It never fires on `UP_TO_DATE`.

First render the Mindrian logo:

```bash
node "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/lib/hmi/mindrian-ascii-logo.cjs"
```

Stream its output as-is (it is the De Stijl block-letter mark and degrades to plain when the terminal has no color). Then, immediately below the logo, emit the RESTART BANNER defined in the final section of this command **verbatim**.

The reason the banner must be loud and last: the update swapped the install under this running session, and the slash-command registry was built once at session start, so `/mos:help` and every `/mos:*` command will read as "Unknown command" until the user restarts. That vanish looks like breakage; the banner is what tells the user it is expected.

The next session detects that the version changed, runs a bounded offline self-check, and shows the result as one statusline segment beside the version. Larry opens that session with the detail plus one insight. That is why this command no longer writes a file to remind itself to check later.

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
- Does NOT stage or swap bytes (the loader's fetch-and-cache step and its copy into the versioned cache directory do)
- Does NOT install dependencies (the loader's `npm ci --ignore-scripts` does)
- Does NOT migrate stale settings paths (the second install location is retired, plan 341-07)
- Does NOT write a restart touch-file (the next session's version-change check is the signal now, per D-07a)
- Does NOT check a tag SHA (published npm versions are immutable, so an in-version hotfix is a new version)
- Does NOT restore backed-up local patches (the old patch-restore mode is retired: it listed a backup folder that nothing writes any more, and the local wiring it served was done by the retired shell installer)

The principle: **Reuse Before Build (Canon Part 7)**. We had a homegrown installer. The platform already had one that worked. We were maintaining a divergence, not a feature.

## RESTART BANNER (the LAST thing the user sees after a real swap)

Emit this block verbatim, exactly as written, as the final output of the update flow, and only when Step 4 saw a real swap. Do not summarize it, do not move it above other text, do not soften it. Approved glyphs only (no emoji):

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
