---
date: 2026-04-28
target: Anthropic (Claude Code team)
status: draft
filing_blocked_until: /mos:doctor lands in v1.11.1 (so we can answer "why didn't your tooling catch this?")
artifact_evidence:
  - ~/.claude/plugins/mindrian-os.stale-1.10.10-20260428-095548/.claude-plugin/plugin.json (the lying file)
  - claude_version: 2.1.121
related:
  - docs/autopsies/2026-04-28-install-cache-drift-incident.md
---

# Upstream Bug Report — Claude Code plugin manager misreports update state

> Status: **DRAFT**, hold until /mos:doctor ships in v1.11.1. Anthropic's first
> question will be "why didn't your tooling catch this?" — answer it before filing.

## Summary

`claude plugin update <plugin>@<marketplace>` reports "already at latest" while the live install's `plugin.json` is at a version older than what the marketplace cache has already downloaded. Affects MindrianOS Plugin install at version 1.10.10 while marketplace had v1.10.12, v1.10.17, AND v1.11.0 cached and ready.

## Environment

- `claude --version`: **2.1.121 (Claude Code)**
- Operating system: Linux (jsagi user, /home/jsagi as home)
- Plugin: `mos@mindrian-marketplace`
- Marketplace ref pin: yes (`v1.11.0` in marketplace.json `source.ref`)
- Plugin source: `https://github.com/jsagir/mindrian-os-plugin.git` (public repo)

## Reproduction

(To be confirmed by Anthropic — we have only one data point and the live state has now been recovered.)

Hypothesis based on observed end-state:

1. User installs `mos@mindrian-marketplace` at some version (e.g., 1.10.10) at time T0.
2. Marketplace is updated multiple times between T0 and T1 (v1.10.12, v1.10.17, v1.11.0). Each update downloads the plugin tree to `~/.claude/plugins/cache/mindrian-marketplace/mos/<version>/`.
3. User runs `/plugin marketplace update` to refresh the marketplace catalog. Catalog shows "v1.11.0 available" (or doesn't — to be determined).
4. User runs `claude plugin update mos@mindrian-marketplace`. Manager reports "already at latest" or equivalent. No file movement occurs.
5. `~/.claude/plugins/mindrian-os/.claude-plugin/plugin.json` continues to read `1.10.10`. The user runs the stale plugin without knowing.

The smoking gun: the marketplace cache directory has the new versions ready (`~/.claude/plugins/cache/mindrian-marketplace/mos/1.11.0/` has all 5,617 files). The cache → live-install transition is the broken step.

## Observed end-state evidence

```
$ jq -r .version ~/.claude/plugins/mindrian-os/.claude-plugin/plugin.json
1.10.10

$ ls -d ~/.claude/plugins/cache/mindrian-marketplace/mos/*/
.../mos/1.10.12/
.../mos/1.10.17/
.../mos/1.11.0/

$ jq -r .version ~/.claude/plugins/cache/mindrian-marketplace/mos/1.11.0/.claude-plugin/plugin.json
1.11.0

$ # marketplace.json source ref:
$ jq -r '.plugins[0].source.ref' ~/mindrian-marketplace/.claude-plugin/marketplace.json
v1.11.0
```

The lying `plugin.json` from the stale install has been preserved at:
`~/.claude/plugins/mindrian-os.stale-1.10.10-20260428-095548/.claude-plugin/plugin.json`

We can ship this file as evidence on request.

## Severity

**High for plugin authors and end users.**

For plugin authors: every release after the user's last update is invisible. We discovered this 4 versions stale (1.10.10 → 1.11.0 across v1.10.12, v1.10.17, v1.11.0). At Mindrian's release cadence (5-10 versions per month), users could be running plugins from 60+ days ago without knowing.

For end users: silent staleness means bug fixes don't land, security patches don't land, new features don't appear. The user sees no indication anything is wrong. The user attributes new behaviors observed in others (who got proper updates) to "magic" or "you must have a newer version" — which is correct, but they have no way to detect it themselves.

This is a class-2 bug per common reliability frameworks: silent corruption with no feedback loop.

## Workaround (what we tell our users)

1. Run `/mos:doctor` (Mindrian's own diagnostic, ships in v1.11.1) — detects the drift by directly comparing `~/.claude/plugins/mindrian-os/.claude-plugin/plugin.json` against the highest semver in `~/.claude/plugins/cache/mindrian-marketplace/mos/`.
2. Run `/mos:doctor --fix` to back up the stale install and replace it with the latest cached version via `cp -aT`.

This is a workaround, not a fix. The fix has to be in Claude Code's plugin manager.

## What "fix" looks like

Two reasonable fixes:

**Option 1 (defensive):** `claude plugin update` reads `plugin.json` from the live install and compares against the marketplace cache's highest semver before reporting state. If they differ, either install (the user said update) or report drift explicitly with a numeric diff.

**Option 2 (preventive):** `claude plugin update` always overwrites the live install from the marketplace cache when invoked, regardless of whether the manager thinks they match. This treats the cache as source-of-truth. Slower, but eliminates the failure mode by design.

We expect Option 1 is the correct fix, but Option 2 would also resolve our pain.

## Why this report is being filed late

The bug was probably present since Anthropic's plugin manager shipped. We didn't catch it earlier because we were not actively monitoring the install-cache → live-install transition from outside the Claude Code process. We caught it only because we started preparing to onboard 16 testers and an admin diagnostic showed zero adoption — at which point we questioned the metric, dug into the data path, and incidentally discovered our own install was 4 versions stale.

If you can share any logs or telemetry from the user's `claude plugin update` invocation, we can correlate it with the file-system end-state to narrow the failure mode. Otherwise this report is from the outside looking in.

## Contact

- Jonathan Sagir, MindrianOS Plugin author
- Email: jsagir@gmail.com
- GitHub: jsagir/mindrian-os-plugin
- Plugin marketplace: jsagir/mindrian-marketplace

## Related artifacts to share on request

- `docs/autopsies/2026-04-28-install-cache-drift-incident.md` — full internal autopsy with both Incident A (this) and Incident B (Brain telemetry, unrelated to Claude Code)
- `~/.claude/plugins/mindrian-os.stale-1.10.10-20260428-095548/.claude-plugin/plugin.json` — the lying file
- `commands/doctor.md` + `scripts/doctor.cjs` — our workaround
- `scripts/test-doctor-recovery.cjs` — regression test that simulates the failure mode in isolation
