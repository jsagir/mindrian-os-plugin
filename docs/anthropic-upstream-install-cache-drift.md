# Claude Code Plugin Manager -- Install Cache Drift (Bug Report Draft)

**Status:** Draft for Anthropic submission
**Filed:** 2026-04-30 (held since Phase 93; released after /mos:doctor classes A-F shipped in Phase 95.1)
**Affected versions:** Claude Code 1.x -- 2.x (multiple users observed)
**Reporter:** Jonathan Sagir (MindrianOS Plugin maintainer)

## Symptom

Two confirmed incidents (2026-04-13 + 2026-04-28) where the live plugin install at `~/.claude/plugins/<plugin>/` was a stale older version while the marketplace cache at `~/.claude/plugins/cache/<marketplace>/<plugin>/` had a newer version cached and ready. The plugin manager reported "already at latest" while `plugin.json` in the install dir said an older version.

In incident 1: `~/.claude/plugins/mindrian-os/.claude-plugin/plugin.json` reported `1.10.10`. The marketplace cache had `1.10.12, 1.10.17, 1.11.0` cached. Claude Code reported "already up to date" and `plugin marketplace update` did not refresh the install dir.

In incident 2: same pattern at v1.11.x.

The state was indistinguishable from a working install until commands silently failed (referenced files that existed in the source repo but not in the install).

## Reproduction

Difficult to reproduce intentionally; appears to be a state where the marketplace cache fetch succeeds but the install-dir replacement step is skipped or interrupted. Both incidents were observed only on Linux WSL2 hosts; macOS / native Linux not yet tested.

## Workaround (MindrianOS-side, not asking for upstream change)

MindrianOS Plugin v1.11.1+ ships `/mos:doctor` (Phase 93, extended in Phase 95.1):

- Reads `~/.claude/plugins/mindrian-os/.claude-plugin/plugin.json` for the install version
- Enumerates `~/.claude/plugins/cache/mindrian-marketplace/mos/*` directory names as semver candidates
- Compares; reports drift
- `/mos:doctor --fix` backs up the stale install (rename to `.stale-<old>-<timestamp>`) and copies the latest marketplace cache to the install location

## What we'd find useful from Anthropic

1. **Diagnostic visibility:** When `claude plugin update <plugin>@<marketplace>` runs, expose the actual install version vs marketplace version comparison, even when the manager believes there's no work to do.
2. **Forced-refresh flag:** A `--force` or `--reinstall` flag on `claude plugin update` that bypasses the "already up to date" early return and re-executes the cache-to-install copy step.
3. **Auto-detection at session start:** Optional. The session-start could observe install-cache drift and surface a one-line advisory.

## What we are NOT asking for

- We don't need a fix for this specific transition path; our local /mos:doctor handles it.
- We don't want this filed as a security issue; it's a UX observability issue.
- We don't want behavior changes to plugin auto-update; the existing "stable by default, opt-in to latest" model is correct.

## Pointers

- `MindrianOS-Plugin/scripts/doctor.cjs` (the workaround implementation)
- `MindrianOS-Plugin/docs/autopsies/2026-04-13-wrong-workspace-incident.md` (incident 1)
- `MindrianOS-Plugin/docs/autopsies/2026-04-28-install-cache-drift-incident.md` (incident 2)

## Submission target

Anthropic feedback channel for Claude Code (TBD -- confirm correct channel before sending).
