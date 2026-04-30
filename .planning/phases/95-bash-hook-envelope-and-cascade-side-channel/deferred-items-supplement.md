---
filed: 2026-04-30
type: post-ship-finding
context: v1.12.0 three-surface smoke test in fresh session after restart (2026-04-30)
status: escalation-candidate
priority: high (release-pipeline correctness)
related_phase: 95.5 (proposed)
---

# v1.12.0 Smoke Finding — Dual-Install Drift Bug

## Summary

v1.12.0 shipped cleanly to GitHub + marketplace + dev workspace + git tag. All five release-process gates green. Test suite 27/27. But the smoke test in a fresh session after restart and after running `/plugin marketplace update` + `claude plugin update mos@mindrian-marketplace` showed the live PostToolUse hook still firing the v1.11.0 script.

Root cause: **dual-install drift**. Two mos plugin paths exist on the user's machine:

- `~/.claude/plugins/cache/mindrian-marketplace/mos/1.12.0/` — updated by native loader (v1.12.0)
- `~/.claude/plugins/mindrian-os/` — manual checkout, independent of marketplace, stuck at v1.11.0

The native loader updates the marketplace cache + `installed_plugins.json` registry. It does NOT update or remove the parallel manual checkout. SessionStart banners in the smoke session printed BOTH versions — confirmation that two mos registrations are firing simultaneously, and the manual one wins for hook invocation because of `MINDRIAN_OS_ROOT=/home/jsagi/.claude/plugins/mindrian-os` env var in `~/.claude/settings.json`.

## Why the /mos:update skill didn't catch this

The /mos:update skill (introduced in v1.10.19 hotfix sweep, 2026-04-26) was designed to fix the Aryeh Holtzberg field bug where `scripts/self-update install` updated the cache but not the registry. The fix was structural: defer to Claude Code's native plugin loader so registry + cache + enabledPlugins stay in sync.

The skill's assumption: there's ONE active install path (the cache). The dual-install case is unhandled. When a manual checkout exists at `~/.claude/plugins/mindrian-os/`, the native loader doesn't touch it, and the env var continues pointing there.

## Smoke test evidence

From 2026-04-30 fresh-session smoke:

```
Step 1 (version load) — MIXED:
  dev workspace plugin.json:                1.12.0
  ~/.claude/plugins/mindrian-os/...json:    1.11.0  <-- this is what hooks load

Step 3 (side-channel file) — FAIL:
  /home/jsagi/MindrianOS-Plugin/room/.mindrian/last-cascade.json
  was NOT created — the live hook lacks the v1.12.0 atomic writer block

Step 6 (Edit envelope) — FAIL same root cause

mtime delta proves it:
  dev/scripts/post-write:    2026-04-29 21:53  (Phase 95-02 GREEN ship)
  ~/.claude/plugins/mindrian-os/scripts/post-write:  2026-04-28 09:32  (stale)
```

## The fix path for the user (immediate)

Three options ranked by cleanliness:

1. **Fix A — delete the stale manual checkout.**
   ```bash
   rm -rf ~/.claude/plugins/mindrian-os
   ```
   The marketplace cache install at `~/.claude/plugins/cache/mindrian-marketplace/mos/1.12.0/` becomes the only mos registration. Restart. Hooks resolve to v1.12.0.

2. **Fix B — sync v1.12.0 into the manual path.**
   ```bash
   rsync -a --delete ~/.claude/plugins/cache/mindrian-marketplace/mos/1.12.0/ ~/.claude/plugins/mindrian-os/
   ```
   Preserves the path the env var points at. Restart.

3. **Fix C — reconfigure env var.**
   Edit `~/.claude/settings.json`. Change `MINDRIAN_OS_ROOT` to a cache-versioned path. Fragile — needs pin-chasing per release.

Recommended: Fix A (cleanest) or Fix B (preserves user habit).

## The fix path for the plugin (Phase 95.5 candidate)

The plugin should detect this drift class proactively. Options:

1. **/mos:update skill enhancement** — before declaring success, scan for dual-install paths. If found, surface as a warning with the rsync recovery command. Block the success message until resolved.

2. **SessionStart hook enhancement** — when SessionStart fires, check if MORE THAN ONE mos plugin path exists. If yes, log a warning to STATE.md and surface in the welcome banner: "DUAL-INSTALL DETECTED — see /mos:doctor for fix."

3. **/mos:doctor command** (proposed) — runs full health diagnostic including dual-install detection, env var path coherence check, registry/cache/manual-checkout drift scan, and the 5 release-process gates. One command, one report, with concrete recovery actions.

The third option is the most defensible long-term. It also catches related drift classes we haven't anticipated yet.

## Connection to existing phases

- **Phase 95.5 (proposed)** — bash post-write side-channel CONSUMER (the half-wired finding from W2 plan-checker disclosure). Could absorb /mos:doctor scaffold as a sibling deliverable since both are post-Phase-95 release-pipeline correctness work.
- **Phase 92 (Constitution refactor + Trust Layer)** — directive 1 validation IS this category of work. /mos:doctor is a Trust Layer surface.
- **Phase 88.2 (uiux-selector-block)** — /mos:doctor's report renders via Shape A (Action Report) with F.0 mini-gate per finding (Approve/Reject/Defer recovery actions). Cool-UI dividend.

## Provenance

Filed by Larry on 2026-04-30 immediately after the user's three-surface smoke test in a fresh Claude Code session reported NO for the headline question ("Did v1.12.0 restore the cascade loop in production?"). The smoke output IS the evidence trail. Code is correct; install pipeline has a class of drift the /mos:update skill assumed didn't exist.

## Resolution

This finding is captured. The user's immediate next action is Fix A or Fix B (manual). The plugin's followup work is captured for Phase 95.5 or 92 to absorb.
